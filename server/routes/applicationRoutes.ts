import { Router } from 'express';
import path from 'path';
import crypto from 'crypto';
import { ApplicationRepository, AuditRepository, JobRepository } from '../db/repositories';
import { Database } from '../db/database';
import { requireAdmin } from '../auth/authManager';
import { cvStorage, validateCvMagicBytes, generateCvDownloadToken, verifyCvDownloadToken } from '../services/cvStorage';

export const applicationRouter = Router();

// 1. Secure Real CV Upload Endpoint
applicationRouter.post('/upload-cv', async (req, res) => {
  try {
    const { fileName, fileType, fileBase64 } = req.body;

    if (!fileName || !fileBase64) {
      return res.status(400).json({ success: false, message: 'File name and file content (base64) are required.' });
    }

    // 1. Validate extension
    const ext = path.extname(fileName).toLowerCase();
    const allowedExts = ['.pdf', '.doc', '.docx'];
    if (!allowedExts.includes(ext)) {
      return res.status(400).json({
        success: false,
        message: `Invalid file extension "${ext}". Only PDF, DOC, and DOCX files are permitted.`
      });
    }

    // 2. Validate MIME type
    const allowedMimeTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/octet-stream' // fallback for some browsers
    ];
    if (fileType && !allowedMimeTypes.includes(fileType.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: `Invalid MIME type "${fileType}". Only PDF and Word documents are permitted.`
      });
    }

    // 3. Remove base64 data header if present and convert to buffer
    const base64Data = fileBase64.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // 4. Validate file size (Max 5MB = 5 * 1024 * 1024 bytes)
    const MAX_SIZE = 5 * 1024 * 1024;
    if (buffer.length > MAX_SIZE) {
      return res.status(400).json({
        success: false,
        message: `File size exceeds the 5MB maximum limit. Your file is ${(buffer.length / (1024 * 1024)).toFixed(2)} MB.`
      });
    }

    // 5. File signature / Magic bytes validation
    const isValidSignature = validateCvMagicBytes(buffer, ext);
    if (!isValidSignature) {
      return res.status(400).json({
        success: false,
        message: `File header does not match a valid ${ext.toUpperCase()} document. Executable or corrupted files are prohibited.`
      });
    }

    // 6. Generate secure randomized storage filename (prevents directory traversal & collisions)
    const uniqueToken = crypto.randomBytes(16).toString('hex');
    const sanitizedBase = path.basename(fileName, ext).replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 30);
    const storedFileName = `${Date.now()}-${uniqueToken}-${sanitizedBase}${ext}`;

    // 7. Write securely using storage abstraction
    const mimeMap: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    };
    const storageResult = await cvStorage.save(storedFileName, buffer, mimeMap[ext] || 'application/octet-stream');

    // 8. Generate short-lived download token for the uploader session
    const downloadToken = generateCvDownloadToken(storedFileName, 24); // 24 hours
    const fileUrl = `${storageResult.relativeUrl}?token=${downloadToken}`;

    AuditRepository.add({
      user: (req as any).user?.name || 'Candidate',
      role: (req as any).user?.role || 'Applicant',
      action: 'CV Uploaded Securely',
      target: fileName,
      status: 'Success',
      metadata: { storedFileName, sizeBytes: buffer.length }
    });

    res.status(201).json({
      success: true,
      fileUrl,
      rawRelativeUrl: storageResult.relativeUrl,
      downloadToken,
      fileName,
      storedFileName,
      fileSize: buffer.length,
      message: 'CV uploaded and validated securely.'
    });
  } catch (err: any) {
    console.error('CV Upload Error:', err);
    res.status(500).json({ success: false, message: err.message || 'Error processing CV upload.' });
  }
});

// 2. Serve / Stream Uploaded CV - STRICTLY PROTECTED
applicationRouter.get('/cv/:filename', async (req, res) => {
  try {
    const rawFileName = req.params.filename;
    // Prevent directory traversal
    const safeFileName = path.basename(rawFileName);

    const exists = await cvStorage.exists(safeFileName);
    if (!exists) {
      return res.status(404).json({ success: false, message: 'CV file not found.' });
    }

    // AUTHORIZATION CHECK:
    // Only allow:
    // 1. Authenticated Admin / Moderator / Employer
    // 2. The applicant owning the application containing this CV
    // 3. A valid temporary download token (?token=...)
    const token = req.query.token as string | undefined;
    const user = (req as any).user;

    let isAuthorized = false;

    // Check signed token
    if (token && verifyCvDownloadToken(safeFileName, token)) {
      isAuthorized = true;
    }

    // Check user session
    if (!isAuthorized && user) {
      const adminRoles = [
        'Super Admin',
        'Admin',
        'Job Moderator',
        'Scraper Manager',
        'Payment Manager',
        'Finance Manager'
      ];
      if (adminRoles.includes(user.role) || user.isDemoAdmin) {
        isAuthorized = true;
      } else {
        // Check if user is the applicant or employer on the corresponding application
        const applications = ApplicationRepository.getAll();
        const matchingApp = applications.find(
          a => a.cvFileUrl && a.cvFileUrl.includes(safeFileName)
        );

        if (matchingApp) {
          if (matchingApp.applicantId === user.userId || matchingApp.applicantEmail === user.email) {
            isAuthorized = true;
          }
        }
      }
    }

    if (!isAuthorized) {
      AuditRepository.add({
        user: user?.name || 'Anonymous',
        role: user?.role || 'Guest',
        action: 'Unauthorized CV Access Attempt Blocked',
        target: safeFileName,
        status: 'Error'
      });
      return res.status(403).json({
        success: false,
        message: 'Access Denied: You do not have authorization to access or download this candidate CV.'
      });
    }

    const { stream, contentType, size } = await cvStorage.getStream(safeFileName);

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', size);
    res.setHeader('Content-Disposition', `inline; filename="${safeFileName}"`);
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');

    stream.pipe(res);
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Error retrieving CV file.' });
  }
});

// 3. Get applications (filter by jobId or applicantId, or all for admin)
applicationRouter.get('/', (req, res) => {
  try {
    const { jobId, applicantId } = req.query as Record<string, string>;
    const user = (req as any).user;

    // If not admin, limit to user's own applications
    const adminRoles = ['Super Admin', 'Admin', 'Job Moderator'];
    const isAdmin = user && (adminRoles.includes(user.role) || user.isDemoAdmin);

    let filterApplicantId = applicantId;
    if (!isAdmin && user) {
      filterApplicantId = user.userId || user.id;
    }

    const apps = ApplicationRepository.getAll({ jobId, applicantId: filterApplicantId });

    // Append authorized download tokens to CV URLs for this response so legitimate viewers can open them
    const enrichedApps = apps.map(app => {
      if (app.cvFileUrl) {
        const fileName = path.basename(app.cvFileUrl.split('?')[0]);
        const token = generateCvDownloadToken(fileName, 12);
        return {
          ...app,
          cvFileUrl: `/api/applications/cv/${fileName}?token=${token}`
        };
      }
      return app;
    });

    res.json({ success: true, applications: enrichedApps });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error fetching applications' });
  }
});

// 4. Submit Job Application (Server-side settings enforcement)
applicationRouter.post('/', (req, res) => {
  try {
    const {
      jobId,
      jobTitle,
      companyName,
      applicantId,
      applicantName,
      applicantEmail,
      applicantPhone,
      coverLetter,
      answers,
      cvFileUrl
    } = req.body;

    if (!jobId || !applicantName || !applicantEmail) {
      return res.status(400).json({ success: false, message: 'Job ID, applicant name, and email are required.' });
    }

    // Check employer / admin apply settings server-side
    const settings = Database.getApplySettings();

    // Check deadline enforcement
    if (settings.enforceDeadlines) {
      const job = JobRepository.getById(jobId);
      if (job && (job.deadline || job.deadlineDate || job.closingDeadline)) {
        const deadlineStr = job.deadline || job.deadlineDate || job.closingDeadline;
        const deadlineTime = new Date(deadlineStr).getTime();
        if (!isNaN(deadlineTime) && deadlineTime < Date.now()) {
          return res.status(400).json({
            success: false,
            message: settings.expiredJobMessage || 'The application deadline for this position has passed.'
          });
        }
      }
    }

    if (settings.requireEmail && !applicantEmail.trim()) {
      return res.status(400).json({ success: false, message: 'Email address is required.' });
    }

    if (settings.requirePhone && (!applicantPhone || !applicantPhone.trim())) {
      return res.status(400).json({ success: false, message: 'A valid contact phone number is required by employer.' });
    }

    if (settings.requireCv && (!cvFileUrl || !cvFileUrl.trim())) {
      return res.status(400).json({ success: false, message: 'CV upload is required for this application.' });
    }

    // Check mandatory custom questions
    if (settings.customQuestions && Array.isArray(settings.customQuestions)) {
      for (const q of settings.customQuestions) {
        if (q.required && (!answers || !answers[q.id])) {
          return res.status(400).json({
            success: false,
            message: `Please answer mandatory question: "${q.question}"`
          });
        }
      }
    }

    const newApp = ApplicationRepository.create({
      jobId,
      jobTitle: jobTitle || 'Position',
      companyName: companyName || 'Company',
      applicantId: applicantId || (req as any).user?.userId || 'guest',
      applicantName,
      applicantEmail,
      applicantPhone,
      coverLetter,
      answers: answers || {},
      cvFileUrl: cvFileUrl || undefined,
      status: 'Applied'
    });

    // Increment applications count on the job
    const job = JobRepository.getById(jobId);
    if (job) {
      JobRepository.update(jobId, {
        applicationsCount: (job.applicationsCount || 0) + 1
      });
    }

    AuditRepository.add({
      user: applicantName,
      role: 'Job Seeker',
      action: 'Job Application Submitted',
      target: `${jobTitle} at ${companyName}`,
      status: 'Success'
    });

    res.status(201).json({
      success: true,
      application: newApp,
      message: settings.successMessage || 'Application submitted successfully!'
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error submitting application' });
  }
});

// 5. Update Application Status (Reviewed, Shortlisted, Rejected)
applicationRouter.patch('/:id/status', requireAdmin, (req, res) => {
  try {
    const { status, notes } = req.body;
    const updated = ApplicationRepository.updateStatus(req.params.id, status, notes);
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Application not found.' });
    }

    AuditRepository.add({
      user: (req as any).user?.name || 'Administrator',
      role: (req as any).user?.role || 'Hiring Manager',
      action: 'Application Status Updated',
      target: `Application ID ${req.params.id} -> ${status}`,
      status: 'Success'
    });

    res.json({ success: true, application: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error updating application status' });
  }
});
