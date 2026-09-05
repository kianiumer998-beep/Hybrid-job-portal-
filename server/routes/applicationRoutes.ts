import { Router } from 'express';
import { Database } from '../db/database';
import { requireAdmin } from '../auth/authManager';

export const applicationRouter = Router();

// Get applications (filter by jobId or applicantId, or all for admin)
applicationRouter.get('/', (req, res) => {
  try {
    const { jobId, applicantId } = req.query as Record<string, string>;
    let apps = Database.getApplications();

    if (jobId) {
      apps = apps.filter(a => a.jobId === jobId);
    }
    if (applicantId) {
      apps = apps.filter(a => a.applicantId === applicantId);
    }

    res.json({ success: true, applications: apps });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error fetching applications' });
  }
});

// Submit Application
applicationRouter.post('/', (req, res) => {
  try {
    const { jobId, jobTitle, companyName, applicantId, applicantName, applicantEmail, applicantPhone, coverLetter, answers, cvFileUrl } = req.body;

    if (!jobId || !applicantName || !applicantEmail) {
      return res.status(400).json({ success: false, message: 'Job ID, applicant name, and email are required.' });
    }

    // Check if apply settings require CV or phone
    const settings = Database.getApplySettings();
    if (settings.requirePhone && !applicantPhone) {
      return res.status(400).json({ success: false, message: 'A valid contact phone number is required.' });
    }

    const newApp = Database.addApplication({
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

    Database.addAuditLog({
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

// Update Application Status (Reviewed, Shortlisted, Rejected)
applicationRouter.patch('/:id/status', requireAdmin, (req, res) => {
  try {
    const { status, notes } = req.body;
    const apps = Database.getApplications();
    const idx = apps.findIndex(a => a.id === req.params.id);
    if (idx === -1) {
      return res.status(404).json({ success: false, message: 'Application not found.' });
    }

    apps[idx].status = status;
    if (notes) apps[idx].adminNotes = notes;
    apps[idx].updatedAt = new Date().toISOString();
    Database.saveApplications(apps);

    res.json({ success: true, application: apps[idx] });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error updating application status' });
  }
});
