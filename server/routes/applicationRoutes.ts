import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { ApplicationRepository, AuditRepository, JobRepository } from '../db/repositories';
import { Database } from '../db/database';
import { requireAdmin } from '../auth/authManager';

export const applicationRouter = Router();

const UPLOADS_DIR = path.join(process.cwd(), 'data', 'uploads', 'cvs');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// 1. Secure Real CV Upload Endpoint
applicationRouter.post('/upload-cv', (req, res) => {
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

    // 3. Remove base64 data header if present
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

    // 5. Generate secure randomized filename
    const uniqueToken = crypto.randomBytes(16).toString('hex');
    const sanitizedBase = path.basename(fileName, ext).replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 30);
    const storedFileName = `${Date.now()}-${uniqueToken}-${sanitizedBase}${ext}`;
    const destinationPath = path.join(UPLOADS_DIR, storedFileName);

    // 6. Write securely to storage
    fs.writeFileSync(destinationPath, buffer);

    const fileUrl = `/api/applications/cv/${storedFileName}`;

    AuditRepository.add({
      user: 'Candidate',
      role: 'Applicant',
      action: 'CV Uploaded',
      target: fileName,
      status: 'Success',
      metadata: { storedFileName, sizeBytes: buffer.length }
    });

    res.status(201).json({
      success: true,
      fileUrl,
      fileName,
      fileSize: buffer.length,
      message: 'CV uploaded and validated securely.'
    });
  } catch (err: any) {
    console.error('CV Upload Error:', err);
    res.status(500).json({ success: false, message: err.message || 'Error processing CV upload.' });
  }
});

// 2. Serve / Stream Uploaded CV securely
applicationRouter.get('/cv/:filename', (req, res) => {
  try {
    const rawFileName = req.params.filename;
    // Prevent directory traversal
    const safeFileName = path.basename(rawFileName);
    const filePath = path.join(UPLOADS_DIR, safeFileName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'CV file not found.' });
    }

    const ext = path.extname(safeFileName).toLowerCase();
    let contentType = 'application/octet-stream';
    if (ext === '.pdf') contentType = 'application/pdf';
    else if (ext === '.doc') contentType = 'application/msword';
    else if (ext === '.docx') contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${safeFileName}"`);
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Error retrieving CV file.' });
  }
});

// 3. Get applications (filter by jobId or applicantId, or all for admin)
applicationRouter.get('/', (req, res) => {
  try {
    const { jobId, applicantId } = req.query as Record<string, string>;
    const apps = ApplicationRepository.getAll({ jobId, applicantId });
    res.json({ success: true, applications: apps });
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
      applicantId: applicantId || 'guest',
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
      user: 'Administrator',
      role: 'Hiring Manager',
      action: 'Application Status Updated',
      target: `Application ID ${req.params.id} -> ${status}`,
      status: 'Success'
    });

    res.json({ success: true, application: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error updating application status' });
  }
});
