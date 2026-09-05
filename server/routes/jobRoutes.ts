import { Router } from 'express';
import { generateJobSlug } from '../db/database';
import { detectJobDuplicate, mergeJobRecords } from '../services/duplicateEngine';
import { requireAdmin } from '../auth/authManager';
import { JobRepository, AuditRepository } from '../db/repositories';

export const jobRouter = Router();

// 1. Get Live Approved Jobs with Query Filters & Pagination
jobRouter.get('/', (req, res) => {
  try {
    const {
      search,
      jobType,
      region,
      province,
      city,
      experienceLevel,
      salaryMin,
      sortBy,
      isGovt,
      isUrgent,
      isFeatured,
      page = '1',
      limit = '50'
    } = req.query as Record<string, string>;

    const result = JobRepository.getAll({
      search,
      jobType,
      region,
      province,
      city,
      experienceLevel,
      salaryMin: salaryMin ? Number(salaryMin) : undefined,
      sortBy,
      isGovt: isGovt === 'true',
      isUrgent: isUrgent === 'true',
      isFeatured: isFeatured === 'true',
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 50
    });

    res.json({
      success: true,
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: Math.ceil(result.total / result.limit),
      jobs: result.jobs
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error fetching jobs' });
  }
});

// 2. Get Single Job by ID
jobRouter.get('/:id', (req, res) => {
  const job = JobRepository.getById(req.params.id) || JobRepository.getPending().find(j => j.id === req.params.id);
  if (!job) {
    return res.status(404).json({ success: false, message: 'Job posting not found.' });
  }
  res.json({ success: true, job });
});

// 3. Get Single Job by SEO Slug
jobRouter.get('/slug/:slug', (req, res) => {
  const job = JobRepository.getBySlug(req.params.slug);
  if (!job) {
    return res.status(404).json({ success: false, message: 'Job posting not found.' });
  }
  res.json({ success: true, job });
});

// 4. Create Job (Employer or Admin)
jobRouter.post('/', (req, res) => {
  try {
    const jobData = req.body;
    if (!jobData.title || !jobData.company) {
      return res.status(400).json({ success: false, message: 'Job title and hiring company are required.' });
    }

    // Check duplicate using authoritative duplicate engine
    const existing = JobRepository.getAll({ limit: 1000 }).jobs;
    const pending = JobRepository.getPending();
    const dupCheck = detectJobDuplicate(jobData, [...existing, ...pending]);

    const newJob = JobRepository.create({
      ...jobData,
      slug: generateJobSlug(jobData.title, jobData.city, jobData.id),
      isDuplicate: dupCheck.isDuplicate,
      duplicateScore: dupCheck.confidence,
      duplicateCategory: dupCheck.duplicateCategory,
      duplicateMatchReason: dupCheck.reason,
      duplicateOfJobId: dupCheck.matchedExistingJob?.id
    });

    AuditRepository.add({
      user: req.body.submittedByName || 'Employer / Admin',
      role: 'Job Poster',
      action: 'Job Created',
      target: `${newJob.title} at ${newJob.company}`,
      status: 'Success'
    });

    res.status(201).json({ success: true, job: newJob });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error creating job' });
  }
});

// 5. Update Job
jobRouter.put('/:id', requireAdmin, (req, res) => {
  try {
    const updated = JobRepository.update(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Job not found.' });
    }
    AuditRepository.add({
      user: 'Administrator',
      role: 'Admin',
      action: 'Job Updated',
      target: `${updated.title} (${updated.id})`,
      status: 'Success'
    });
    res.json({ success: true, job: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error updating job' });
  }
});

// 6. Delete Job
jobRouter.delete('/:id', requireAdmin, (req, res) => {
  const deleted = JobRepository.delete(req.params.id);
  // Also try deleting from pending queue
  const pending = JobRepository.getPending();
  const pendingIdx = pending.findIndex(p => p.id === req.params.id);
  if (pendingIdx !== -1) {
    JobRepository.rejectPending(req.params.id, 'Deleted by administrator');
  }

  if (!deleted && pendingIdx === -1) {
    return res.status(404).json({ success: false, message: 'Job not found.' });
  }

  AuditRepository.add({
    user: 'Administrator',
    role: 'Admin',
    action: 'Job Deleted',
    target: `Job ID ${req.params.id}`,
    status: 'Success'
  });
  res.json({ success: true, message: 'Job deleted successfully.' });
});

// 7. Get Pending Jobs Queue
jobRouter.get('/queue/pending', requireAdmin, (req, res) => {
  const pending = JobRepository.getPending();
  res.json({ success: true, pendingJobs: pending });
});

// 8. Approve Pending Job
jobRouter.post('/queue/pending/:id/approve', requireAdmin, (req, res) => {
  const approved = JobRepository.approvePending(req.params.id);
  if (!approved) {
    return res.status(404).json({ success: false, message: 'Pending job not found.' });
  }
  AuditRepository.add({
    user: 'Administrator',
    role: 'Job Moderator',
    action: 'Job Approved & Published Live',
    target: `${approved.title} at ${approved.company}`,
    status: 'Success'
  });
  res.json({ success: true, job: approved, message: 'Job approved and live on portal!' });
});

// 9. Reject Pending Job
jobRouter.post('/queue/pending/:id/reject', requireAdmin, (req, res) => {
  const rejected = JobRepository.rejectPending(req.params.id, req.body.reason);
  if (!rejected) {
    return res.status(404).json({ success: false, message: 'Pending job not found.' });
  }
  AuditRepository.add({
    user: 'Administrator',
    role: 'Job Moderator',
    action: 'Job Rejected',
    target: `Job ID ${req.params.id} (Reason: ${req.body.reason || 'None specified'})`,
    status: 'Success'
  });
  res.json({ success: true, message: 'Job rejected.' });
});

// 10. Multi-Signal Duplicate Detection on Demand
jobRouter.post('/detect-duplicates', (req, res) => {
  const candidateJob = req.body;
  const existing = JobRepository.getAll({ limit: 1000 }).jobs;
  const pending = JobRepository.getPending();
  const result = detectJobDuplicate(candidateJob, [...existing, ...pending]);
  res.json({ success: true, result });
});

// 11. Override Duplicate Decision (Admin Only)
jobRouter.post('/override-duplicate', requireAdmin, (req, res) => {
  try {
    const { jobId, reason = 'Manually verified as distinct vacancy by administrator' } = req.body;
    if (!jobId) {
      return res.status(400).json({ success: false, message: 'jobId is required.' });
    }

    let job = JobRepository.getById(jobId);
    let isLive = true;
    if (!job) {
      job = JobRepository.getPending().find(j => j.id === jobId);
      isLive = false;
    }

    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found.' });
    }

    const previousDuplicateInfo = {
      isDuplicate: job.isDuplicate,
      duplicateScore: job.duplicateScore,
      duplicateCategory: job.duplicateCategory,
      duplicateOfJobId: job.duplicateOfJobId
    };

    const updates = {
      isDuplicate: false,
      duplicateScore: 0,
      duplicateCategory: 'NONE',
      duplicateMatchReason: `Overridden by admin: ${reason}`,
      duplicateOverriddenAt: new Date().toISOString(),
      duplicateOverriddenReason: reason
    };

    if (isLive) {
      JobRepository.update(jobId, updates);
    } else {
      const pending = JobRepository.getPending();
      const idx = pending.findIndex(j => j.id === jobId);
      if (idx !== -1) {
        pending[idx] = { ...pending[idx], ...updates };
        // Save back pending
        const { Database } = require('../db/database');
        Database.savePendingJobs(pending);
      }
    }

    AuditRepository.add({
      user: 'Administrator',
      role: 'Quality Assurance',
      action: 'Duplicate Decision Overridden',
      target: `Job ${job.title} (${jobId})`,
      status: 'Success',
      metadata: {
        reason,
        previousState: previousDuplicateInfo
      }
    });

    res.json({
      success: true,
      message: 'Duplicate status cleared successfully. Job is now classified as unique.',
      job: { ...job, ...updates }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error overriding duplicate' });
  }
});

// 12. Intelligent Merge of Duplicates
jobRouter.post('/merge', requireAdmin, (req, res) => {
  const { primaryJobId, secondaryJobId } = req.body;
  const primary = JobRepository.getById(primaryJobId) || JobRepository.getPending().find(j => j.id === primaryJobId);
  const secondary = JobRepository.getById(secondaryJobId) || JobRepository.getPending().find(j => j.id === secondaryJobId);

  if (!primary || !secondary) {
    return res.status(400).json({ success: false, message: 'Both primary and secondary jobs must exist to merge.' });
  }

  const merged = mergeJobRecords(primary, secondary);
  JobRepository.update(primaryJobId, merged);

  // If secondary was in pending or live, mark/remove as merged
  JobRepository.delete(secondaryJobId);
  JobRepository.rejectPending(secondaryJobId, `Merged into job ${primaryJobId}`);

  AuditRepository.add({
    user: 'Administrator',
    role: 'Admin',
    action: 'Jobs Merged Intelligently',
    target: `Merged ${secondary.title} (${secondaryJobId}) into ${primary.title} (${primaryJobId})`,
    status: 'Success',
    metadata: { primaryJobId, secondaryJobId }
  });

  res.json({ success: true, job: merged, message: 'Jobs merged successfully with preserved metadata!' });
});
