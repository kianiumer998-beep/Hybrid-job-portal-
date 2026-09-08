import { Router } from 'express';
import { Database, generateJobSlug } from '../db/database';
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
      includeExpired,
      page = '1',
      limit = '10000'
    } = req.query as Record<string, string>;

    const result = JobRepository.getAll({
      search,
      jobType,
      region,
      province,
      city,
      experienceLevel,
      salaryMin: salaryMin ? parseInt(salaryMin, 10) : undefined,
      sortBy,
      isGovt: isGovt === 'true',
      isUrgent: isUrgent === 'true',
      isFeatured: isFeatured === 'true',
      includeExpired: includeExpired === 'true',
      page: parseInt(page, 10),
      limit: parseInt(limit, 10)
    });

    res.json({
      success: true,
      ...result
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error fetching jobs' });
  }
});

// 2. Get Pending Jobs Queue
jobRouter.get('/queue/pending', (req, res) => {
  try {
    const pending = JobRepository.getPending();
    res.json({ success: true, pendingJobs: pending });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error fetching pending jobs' });
  }
});

// 3. Approve Pending Job
jobRouter.post('/queue/pending/:id/approve', requireAdmin, (req, res) => {
  try {
    const approved = JobRepository.approvePending(req.params.id);
    if (!approved) {
      return res.status(404).json({ success: false, message: 'Pending job not found.' });
    }
    AuditRepository.add({
      user: (req as any).user?.name || 'Administrator',
      role: 'Job Moderator',
      action: 'Job Approved & Published Live',
      target: `${approved.title} at ${approved.company}`,
      status: 'Success'
    });
    res.json({ success: true, job: approved, message: 'Job approved and live on portal!' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error approving job' });
  }
});

// 4. Reject Pending Job
jobRouter.post('/queue/pending/:id/reject', requireAdmin, (req, res) => {
  try {
    const rejected = JobRepository.rejectPending(req.params.id, req.body?.reason);
    if (!rejected) {
      return res.status(404).json({ success: false, message: 'Pending job not found.' });
    }
    AuditRepository.add({
      user: (req as any).user?.name || 'Administrator',
      role: 'Job Moderator',
      action: 'Job Rejected',
      target: `Job ID ${req.params.id} (Reason: ${req.body?.reason || 'None specified'})`,
      status: 'Success'
    });
    res.json({ success: true, message: 'Job rejected.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error rejecting job' });
  }
});

// 5. Bulk Delete Jobs
jobRouter.post('/bulk-delete', requireAdmin, (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'Array of job IDs is required.' });
    }
    let count = 0;
    for (const id of ids) {
      if (JobRepository.delete(id)) count++;
    }
    AuditRepository.add({
      user: (req as any).user?.name || 'Administrator',
      role: 'Admin',
      action: 'Bulk Jobs Deleted',
      target: `${count} of ${ids.length} jobs deleted`,
      status: 'Success'
    });
    res.json({ success: true, deletedCount: count });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error in bulk delete' });
  }
});

// 6. Bulk Approve Pending Jobs
jobRouter.post('/bulk-approve', requireAdmin, (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'Array of job IDs is required.' });
    }
    const approved: any[] = [];
    for (const id of ids) {
      const app = JobRepository.approvePending(id);
      if (app) approved.push(app);
    }
    AuditRepository.add({
      user: (req as any).user?.name || 'Administrator',
      role: 'Admin',
      action: 'Bulk Jobs Approved',
      target: `${approved.length} jobs approved`,
      status: 'Success'
    });
    res.json({ success: true, approvedCount: approved.length, approvedJobs: approved });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error in bulk approve' });
  }
});

// 7. Bulk Reject Pending Jobs
jobRouter.post('/bulk-reject', requireAdmin, (req, res) => {
  try {
    const { ids, reason } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'Array of job IDs is required.' });
    }
    let rejectedCount = 0;
    for (const id of ids) {
      if (JobRepository.rejectPending(id, reason)) rejectedCount++;
    }
    AuditRepository.add({
      user: (req as any).user?.name || 'Administrator',
      role: 'Admin',
      action: 'Bulk Jobs Rejected',
      target: `${rejectedCount} jobs rejected`,
      status: 'Success'
    });
    res.json({ success: true, rejectedCount });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error in bulk reject' });
  }
});

// 8. Bulk Update Jobs
jobRouter.post('/bulk-update', requireAdmin, (req, res) => {
  try {
    const { jobs: updatedList } = req.body;
    if (!Array.isArray(updatedList) || updatedList.length === 0) {
      return res.status(400).json({ success: false, message: 'Array of jobs is required.' });
    }
    let updatedCount = 0;
    for (const j of updatedList) {
      if (j && j.id) {
        if (JobRepository.update(j.id, j)) updatedCount++;
      }
    }
    res.json({ success: true, updatedCount });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error in bulk update' });
  }
});

// 9. Bulk Add Jobs
jobRouter.post('/bulk-add', requireAdmin, (req, res) => {
  try {
    const { jobs: batchJobs, status = 'Approved' } = req.body;
    if (!Array.isArray(batchJobs) || batchJobs.length === 0) {
      return res.status(400).json({ success: false, message: 'Array of jobs is required.' });
    }
    const isLive = status === 'Approved';
    const result = isLive 
      ? JobRepository.createBatch(batchJobs, true)
      : JobRepository.addPendingBatch(batchJobs);
    res.json({ success: true, result });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error in bulk add' });
  }
});

// 10. Batch Ingest & Persist Jobs (Real Server-side DB Storage)
jobRouter.post('/batch', (req, res) => {
  try {
    const { jobs: batchJobs, autoPublish = false, autoApprove = false } = req.body;
    if (!Array.isArray(batchJobs) || batchJobs.length === 0) {
      return res.status(400).json({ success: false, message: 'Valid array of jobs is required.' });
    }

    const shouldApprove = autoPublish || autoApprove;
    const toLive: any[] = [];
    const toPending: any[] = [];

    for (const raw of batchJobs) {
      if (!raw || !raw.title) continue;
      if (shouldApprove || raw.status === 'Approved') {
        toLive.push({ ...raw, status: 'Approved' });
      } else {
        toPending.push({ ...raw, status: 'Pending' });
      }
    }

    let liveRes = { inserted: 0, updated: 0, total: Database.getJobs().length };
    let pendingRes = { inserted: 0, updated: 0, total: Database.getPendingJobs().length };

    if (toLive.length > 0) {
      liveRes = Database.addJobsBatch(toLive, true);
    }
    if (toPending.length > 0) {
      pendingRes = Database.addPendingJobsBatch(toPending);
    }

    AuditRepository.add({
      user: (req as any).user?.name || 'Administrator',
      role: 'Job Batch Importer',
      action: 'Batch Ingestion & Persistence',
      target: `${batchJobs.length} Jobs (${toLive.length} Live, ${toPending.length} Pending)`,
      status: 'Success'
    });

    res.json({
      success: true,
      totalReceived: batchJobs.length,
      liveCount: liveRes.total,
      pendingCount: pendingRes.total,
      insertedLive: liveRes.inserted,
      updatedLive: liveRes.updated,
      insertedPending: pendingRes.inserted,
      updatedPending: pendingRes.updated
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error processing batch jobs' });
  }
});

// 11. Multi-Signal Duplicate Detection on Demand
jobRouter.post('/detect-duplicates', (req, res) => {
  const candidateJob = req.body;
  const existing = JobRepository.getAll({ limit: 1000 }).jobs;
  const pending = JobRepository.getPending();
  const result = detectJobDuplicate(candidateJob, [...existing, ...pending]);
  res.json({ success: true, result });
});

// 12. Override Duplicate Decision (Admin Only)
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
        Database.savePendingJobs(pending);
      }
    }

    AuditRepository.add({
      user: (req as any).user?.name || 'Administrator',
      role: 'Quality Assurance',
      action: 'Duplicate Decision Overridden',
      target: `Job ${job.title} (${jobId})`,
      status: 'Success',
      metadata: { reason }
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

// 13. Intelligent Merge of Duplicates
jobRouter.post('/merge', requireAdmin, (req, res) => {
  const { primaryJobId, secondaryJobId } = req.body;
  const primary = JobRepository.getById(primaryJobId) || JobRepository.getPending().find(j => j.id === primaryJobId);
  const secondary = JobRepository.getById(secondaryJobId) || JobRepository.getPending().find(j => j.id === secondaryJobId);

  if (!primary || !secondary) {
    return res.status(400).json({ success: false, message: 'Both primary and secondary jobs must exist to merge.' });
  }

  const merged = mergeJobRecords(primary, secondary);
  JobRepository.update(primaryJobId, merged);

  JobRepository.delete(secondaryJobId);
  JobRepository.rejectPending(secondaryJobId, `Merged into job ${primaryJobId}`);

  AuditRepository.add({
    user: (req as any).user?.name || 'Administrator',
    role: 'Admin',
    action: 'Jobs Merged Intelligently',
    target: `Merged ${secondary.title} (${secondaryJobId}) into ${primary.title} (${primaryJobId})`,
    status: 'Success',
    metadata: { primaryJobId, secondaryJobId }
  });

  res.json({ success: true, job: merged, message: 'Jobs merged successfully.' });
});

// 14. Get Job Details by ID or Slug (Must be placed AFTER specific endpoints)
jobRouter.get('/:idOrSlug', (req, res) => {
  try {
    const { idOrSlug } = req.params;
    let job = JobRepository.getById(idOrSlug);
    if (!job) {
      job = JobRepository.getBySlug(idOrSlug);
    }

    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found.' });
    }

    res.json({ success: true, job });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error fetching job details' });
  }
});

// 15. Post a Job (Direct Public or Employer Submission)
jobRouter.post('/', (req, res) => {
  try {
    const jobData = req.body;

    if (!jobData.title || !jobData.company) {
      return res.status(400).json({ success: false, message: 'Job title and company name are required.' });
    }

    const newJob: any = {
      ...jobData,
      slug: generateJobSlug(jobData.title, jobData.city, jobData.id),
      createdAt: new Date().toISOString(),
      applicationsCount: 0
    };

    const user = (req as any).user;
    const adminRoles = ['Super Admin', 'Admin', 'Job Moderator'];
    const isAdmin = user && (adminRoles.includes(user.role) || user.isDemoAdmin);

    let savedJob: any;
    if (isAdmin || jobData.status === 'Approved') {
      newJob.status = 'Approved';
      savedJob = JobRepository.create(newJob);
      AuditRepository.add({
        user: user?.name || 'Administrator',
        role: user?.role || 'Admin',
        action: 'Job Created & Published (Admin Direct)',
        target: `${savedJob.title} at ${savedJob.company}`,
        status: 'Success'
      });
    } else {
      newJob.status = 'Pending';
      savedJob = JobRepository.addPending(newJob);
      AuditRepository.add({
        user: user?.name || 'Guest Employer',
        role: user?.role || 'Employer',
        action: 'Job Submitted for Review',
        target: `${savedJob.title} at ${savedJob.company}`,
        status: 'Success'
      });
    }

    res.status(201).json({
      success: true,
      job: savedJob,
      message: (isAdmin || jobData.status === 'Approved') ? 'Job published live!' : 'Job submitted for verification and review.'
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error creating job' });
  }
});

// 16. Update Job
jobRouter.put('/:id', requireAdmin, (req, res) => {
  try {
    const updated = JobRepository.update(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Job not found.' });
    }
    AuditRepository.add({
      user: (req as any).user?.name || 'Administrator',
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

// 17. Delete Job
jobRouter.delete('/:id', requireAdmin, (req, res) => {
  const deleted = JobRepository.delete(req.params.id);
  const pending = JobRepository.getPending();
  const pendingIdx = pending.findIndex(p => p.id === req.params.id);
  if (pendingIdx !== -1) {
    JobRepository.rejectPending(req.params.id, 'Deleted by administrator');
  }

  if (!deleted && pendingIdx === -1) {
    return res.status(404).json({ success: false, message: 'Job not found.' });
  }

  AuditRepository.add({
    user: (req as any).user?.name || 'Administrator',
    role: 'Admin',
    action: 'Job Deleted',
    target: `Job ID ${req.params.id}`,
    status: 'Success'
  });
  res.json({ success: true, message: 'Job deleted successfully.' });
});
