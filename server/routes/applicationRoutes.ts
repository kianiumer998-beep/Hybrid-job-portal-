import { Router } from 'express';
import path from 'path';
import crypto from 'crypto';
import { ApplicationRepository, AuditRepository, JobRepository, UserRepository } from '../db/repositories';
import { Database } from '../db/database';
import { ADMIN_ROLES, hasAdminPermission, requireAdminPermission, requireAuth } from '../auth/authManager';
import { cvStorage, validateCvMagicBytes, generateCvDownloadToken, verifyCvDownloadToken } from '../services/cvStorage';

export const applicationRouter = Router();

// Dedicated in-memory per-IP rate limiters for public CV upload and application submission
const cvUploadAttempts = new Map<string, { count: number; firstAttempt: number; lockedUntil?: number }>();
const CV_UPLOAD_MAX_ATTEMPTS = 10;
const CV_UPLOAD_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

const applicationSubmitAttempts = new Map<string, { count: number; firstAttempt: number; lockedUntil?: number }>();
const APPLICATION_SUBMIT_MAX_ATTEMPTS = 15;
const APPLICATION_SUBMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function checkAndRecordBucketLimit(
  store: Map<string, { count: number; firstAttempt: number; lockedUntil?: number }>,
  ip: string,
  maxAttempts: number,
  windowMs: number
): { blocked: boolean; retryAfterSeconds?: number } {
  const now = Date.now();
  const entry = store.get(ip);

  if (entry) {
    if (entry.lockedUntil && now < entry.lockedUntil) {
      return { blocked: true, retryAfterSeconds: Math.ceil((entry.lockedUntil - now) / 1000) };
    }

    if (now - entry.firstAttempt > windowMs) {
      store.set(ip, { count: 1, firstAttempt: now });
      return { blocked: false };
    }

    if (entry.count >= maxAttempts) {
      const remainingMs = Math.max(1000, windowMs - (now - entry.firstAttempt));
      entry.lockedUntil = now + remainingMs;
      return { blocked: true, retryAfterSeconds: Math.ceil(remainingMs / 1000) };
    }

    entry.count += 1;
    if (entry.count >= maxAttempts) {
      entry.lockedUntil = entry.firstAttempt + windowMs;
    }
    return { blocked: false };
  }

  store.set(ip, { count: 1, firstAttempt: now });
  return { blocked: false };
}

// 1. Secure Real CV Upload Endpoint
applicationRouter.post('/upload-cv', async (req, res) => {
  try {
    const ip = req.ip || req.socket.remoteAddress || 'unknown-client';
    const rateCheck = checkAndRecordBucketLimit(cvUploadAttempts, ip, CV_UPLOAD_MAX_ATTEMPTS, CV_UPLOAD_WINDOW_MS);
    if (rateCheck.blocked) {
      return res.status(429).json({
        success: false,
        message: `Too many CV upload attempts. Please try again in ${rateCheck.retryAfterSeconds || 60} seconds.`,
        retryAfterSeconds: rateCheck.retryAfterSeconds || 60
      });
    }

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
        'Job Moderator'
      ];
      if (adminRoles.includes(user.role)) {
        isAuthorized = true;
      } else {
        // Check if user is the applicant or employer on the corresponding application
        const currentUserId = user.userId || user.id;
        const applications = await ApplicationRepository.getAllAsync();
        const expectedCvPath = `/api/applications/cv/${safeFileName}`;

        const matchingApps = applications.filter(
          a =>
            typeof a.cvFileUrl === 'string' &&
            a.cvFileUrl.split('?')[0] === expectedCvPath
        );

        const isOwner = matchingApps.some(
          a =>
            (currentUserId && String(a.applicantId) === String(currentUserId)) ||
            (user.email && a.applicantEmail === user.email)
        );

        if (isOwner) {
          isAuthorized = true;
        } else if (currentUserId && matchingApps.length > 0) {
          for (const app of matchingApps) {
            if (!app.jobId) continue;
            const job = await JobRepository.getById(String(app.jobId));
            const jobOwnerId = job?.submittedByUserId || job?.postedByUserId || job?.userId;
            if (job && jobOwnerId && String(jobOwnerId) === String(currentUserId)) {
              isAuthorized = true;
              break;
            }
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
applicationRouter.get('/', requireAuth, async (req, res) => {
  try {
    const { jobId, applicantId } = req.query as Record<string, string>;
    const user = (req as any).user;

    // If not admin, limit to user's own applications unless querying a job they own
    const adminRoles = ['Super Admin', 'Admin', 'Job Moderator'];
    const isAdmin = user && adminRoles.includes(user.role);

    let filterApplicantId: string | undefined = applicantId;
    if (!isAdmin && user) {
      const currentUserId = user.userId || user.id;
      if (jobId) {
        const job = await JobRepository.getById(String(jobId));
        if (!job) {
          return res.status(404).json({ success: false, message: 'Job not found.' });
        }
        const jobOwnerId = job.submittedByUserId || job.postedByUserId || job.userId;
        const isJobOwner = Boolean(
          currentUserId &&
          jobOwnerId &&
          String(jobOwnerId) === String(currentUserId)
        );
        filterApplicantId = isJobOwner ? undefined : currentUserId;
      } else {
        filterApplicantId = currentUserId;
      }
    }

    const apps = await ApplicationRepository.getAllAsync({ jobId, applicantId: filterApplicantId });

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
applicationRouter.post('/', requireAuth, async (req, res) => {
  try {
    const ip = req.ip || req.socket.remoteAddress || 'unknown-client';
    const rateCheck = checkAndRecordBucketLimit(
      applicationSubmitAttempts,
      ip,
      APPLICATION_SUBMIT_MAX_ATTEMPTS,
      APPLICATION_SUBMIT_WINDOW_MS
    );
    if (rateCheck.blocked) {
      return res.status(429).json({
        success: false,
        message: `Too many application submissions. Please try again in ${rateCheck.retryAfterSeconds || 60} seconds.`,
        retryAfterSeconds: rateCheck.retryAfterSeconds || 60
      });
    }

    const authUser = (req as any).user;
    const effectiveApplicantId = String(authUser?.userId || authUser?.id || '').trim();
    if (!effectiveApplicantId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please log in.'
      });
    }

    const dbUser = await UserRepository.getByIdAsync(effectiveApplicantId);

    const {
      jobId,
      jobTitle,
      companyName,
      applicantPhone: rawApplicantPhone,
      coverLetter,
      answers,
      cvFileUrl
    } = req.body;

    const applicantName = String(
      dbUser?.name || dbUser?.fullName || authUser?.name || ''
    ).trim();
    const applicantEmail = String(
      dbUser?.email || authUser?.email || ''
    ).trim();
    const profilePhone = String(
      dbUser?.phone || dbUser?.phoneNumber || authUser?.phone || ''
    ).trim();
    const applicantPhone =
      profilePhone ||
      (typeof rawApplicantPhone === 'string' ? rawApplicantPhone.trim() : '');

    if (!jobId || !applicantName || !applicantEmail) {
      return res.status(400).json({ success: false, message: 'Job ID, applicant name, and email are required.' });
    }

    // Validate and sanitize internal CV URL before expensive operations or persistence
    let sanitizedCvFileUrl: string | undefined = undefined;
    if (typeof cvFileUrl === 'string' && cvFileUrl.trim()) {
      const rawUrl = cvFileUrl.trim();

      if (
        rawUrl.includes('\0') ||
        rawUrl.includes('\\') ||
        rawUrl.includes('..') ||
        /%(2e|2f|5c)/i.test(rawUrl)
      ) {
        return res.status(400).json({
          success: false,
          message: 'Invalid CV file URL.'
        });
      }

      let parsedUrl: URL;
      try {
        parsedUrl = new URL(rawUrl, 'http://localhost');
      } catch {
        return res.status(400).json({
          success: false,
          message: 'Invalid CV file URL.'
        });
      }

      const pathname = parsedUrl.pathname;
      const isInternalCvPath =
        pathname.startsWith('/api/applications/cv') ||
        rawUrl.includes('/api/applications/cv');

      if (isInternalCvPath) {
        const prefix = '/api/applications/cv/';
        if (!pathname.startsWith(prefix)) {
          return res.status(400).json({
            success: false,
            message: 'Invalid CV file URL.'
          });
        }

        const rawSegment = pathname.slice(prefix.length);
        let decodedSegment = '';
        try {
          decodedSegment = decodeURIComponent(rawSegment);
        } catch {
          return res.status(400).json({
            success: false,
            message: 'Invalid CV file URL.'
          });
        }

        const fileName = path.basename(decodedSegment);
        if (
          !fileName ||
          fileName !== decodedSegment ||
          fileName !== rawSegment ||
          fileName === '.' ||
          fileName === '..' ||
          fileName.includes('/') ||
          fileName.includes('\\') ||
          fileName.includes('..')
        ) {
          return res.status(400).json({
            success: false,
            message: 'Invalid CV file path.'
          });
        }

        const token = parsedUrl.searchParams.get('token') || '';
        if (!token || !verifyCvDownloadToken(fileName, token)) {
          return res.status(400).json({
            success: false,
            message: 'Invalid or unauthorized CV download token.'
          });
        }

        sanitizedCvFileUrl = `/api/applications/cv/${fileName}`;
      } else {
        sanitizedCvFileUrl = rawUrl;
      }
    }

    // Check employer / admin apply settings server-side
    const settings = Database.getApplySettings();

    // Verify target job exists and is currently live/approved
    const job = await JobRepository.getById(jobId);
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found.'
      });
    }

    if (
      job.status === 'Expired' ||
      job.status === 'Pending' ||
      job.status === 'Rejected' ||
      job.status === 'Draft' ||
      (job.status && job.status !== 'Approved') ||
      job.isExpired === true ||
      job.isSuspended === true
    ) {
      return res.status(400).json({
        success: false,
        message: 'This position is not currently open for applications.'
      });
    }

    // Check deadline enforcement
    if (settings.enforceDeadlines) {
      if (job.deadline || job.deadlineDate || job.closingDeadline) {
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

    if (settings.requireCv && !sanitizedCvFileUrl) {
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

    // Duplicate Application Protection
    const existingApp = await ApplicationRepository.findExistingAsync(
      jobId,
      effectiveApplicantId,
      applicantEmail
    );

    if (existingApp) {
      return res.status(409).json({
        success: false,
        message: 'You have already submitted an application for this vacancy.',
        applicationId: existingApp.id
      });
    }

    const newApp = await ApplicationRepository.createAsync({
      jobId,
      jobTitle: jobTitle || 'Position',
      companyName: companyName || 'Company',
      applicantId: effectiveApplicantId,
      applicantName,
      applicantEmail,
      applicantPhone,
      coverLetter,
      answers: answers || {},
      cvFileUrl: sanitizedCvFileUrl,
      status: 'Applied'
    });

    // Increment applications count on the job (non-fatal error isolation)
    try {
      const job = await JobRepository.getById(jobId);
      if (job) {
        await JobRepository.update(jobId, {
          applicationsCount: (job.applicationsCount || 0) + 1
        });
      }
    } catch (counterErr: any) {
      console.warn(
        `[ApplicationRoutes] Notice: Failed to increment applicationsCount for job ${jobId} on application ${newApp.id}:`,
        counterErr?.message || counterErr
      );
    }

    AuditRepository.add({
      user: (req as any).user.name,
      role: (req as any).user.role,
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
applicationRouter.patch('/:id/status', requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const currentUserId = String(user?.userId || user?.id || '').trim();
    if (!user || !currentUserId) {
      return res.status(401).json({ success: false, message: 'Authentication required. Please log in.' });
    }

    const isAdminRole = Boolean(user.role && (ADMIN_ROLES as readonly string[]).includes(user.role));
    const canManageAllApplications = hasAdminPermission(user.role, 'applications.manage');

    if (isAdminRole && !canManageAllApplications) {
      return res.status(403).json({
        success: false,
        message: `Access denied: Role '${user.role}' does not have required permission 'applications.manage'.`
      });
    }

    if (!canManageAllApplications) {
      if (user.role !== 'Employer') {
        return res.status(403).json({
          success: false,
          message: 'Access denied: Employer or administrative privileges required to update application status.'
        });
      }

      const existingApplication = await ApplicationRepository.getByIdAsync(req.params.id);
      if (!existingApplication) {
        return res.status(404).json({ success: false, message: 'Application not found.' });
      }

      const targetJobId = existingApplication.jobId ? String(existingApplication.jobId).trim() : '';
      const job = targetJobId ? await JobRepository.getById(targetJobId) : null;
      const jobOwnerId = job?.submittedByUserId || job?.postedByUserId || job?.userId;
      const isJobOwner = Boolean(
        user.role === 'Employer' &&
        job &&
        jobOwnerId &&
        String(jobOwnerId) === currentUserId
      );

      if (!isJobOwner) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: You can only update applications for jobs you own.'
        });
      }
    }

    const { status, notes } = req.body;
    const updated = await ApplicationRepository.updateStatusAsync(req.params.id, status, notes);
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
