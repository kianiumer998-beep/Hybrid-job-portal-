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
      limit = '5000'
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

// 2. Get Pending Jobs Queue (MUST be before /:idOrSlug)
jobRouter.get('/queue/pending', (req, res) => {
  try {
    const pending = JobRepository.getPending();
    res.json({ success: true, pendingJobs: pending });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error fetching pending jobs' });
  }
});

// 3. Batch Ingest & Persist Jobs (Real Server-side DB Storage)
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

// 4. Two-Way State Sync (Guarantees persistence across sessions & browsers)
jobRouter.post('/sync-all', (req, res) => {
  try {
    const { liveJobs = [], pendingJobs = [] } = req.body;
    let liveRes = { inserted: 0, updated: 0, total: Database.getJobs().length };
    let pendingRes = { inserted: 0, updated: 0, total: Database.getPendingJobs().length };

    if (Array.isArray(liveJobs) && liveJobs.length > 0) {
      liveRes = Database.addJobsBatch(liveJobs, true);
    }
    if (Array.isArray(pendingJobs) && pendingJobs.length > 0) {
      pendingRes = Database.addPendingJobsBatch(pendingJobs);
    }

    res.json({
      success: true,
      liveCount: liveRes.total,
      pendingCount: pendingRes.total,
      liveDetails: liveRes,
      pendingDetails: pendingRes
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error syncing jobs' });
  }
});

// 5. Multi-Signal Duplicate Detection on Demand
jobRouter.post('/detect-duplicates', (req, res) => {
  const candidateJob = req.body;
  const existing = JobRepository.getAll({ limit: 1000 }).jobs;
  const pending = JobRepository.getPending();
  const result = detectJobDuplicate(candidateJob, [...existing, ...pending]);
  res.json({ success: true, result });
});

// 6. Override Duplicate Decision (Admin Only)
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

    res.json({
      success: true,
      message: 'Duplicate status cleared successfully. Job is now classified as unique.',
      job: { ...job, ...updates }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error overriding duplicate' });
  }
});

// 7. Intelligent Merge of Duplicates
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

  res.json({ success: true, message: 'Jobs merged successfully.' });
});

// 8. Approve Pending Job
jobRouter.post('/queue/pending/:id/approve', (req, res) => {
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
});

// 9. Reject Pending Job
jobRouter.post('/queue/pending/:id/reject', (req, res) => {
  const rejected = JobRepository.rejectPending(req.params.id, req.body.reason);
  if (!rejected) {
    return res.status(404).json({ success: false, message: 'Pending job not found.' });
  }
  res.json({ success: true, message: 'Job rejected.' });
});

// 10. Get Job Details by ID or Slug (Must be placed AFTER specific endpoints)
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

// 3. Post a Job (Direct Public or Employer Submission)
jobRouter.post('/', (req, res) => {
  try {
    const jobData = req.body;

    if (!jobData.title || !jobData.company) {
      return res.status(400).json({ success: false, message: 'Job title and company name are required.' });
    }

    // Default values
    const newJob: any = {
      ...jobData,
      slug: generateJobSlug(jobData.title, jobData.company, jobData.city),
      createdAt: new Date().toISOString(),
      applicationsCount: 0
    };

    // Auto-approve or queue in pending based on configuration or auth
    const user = (req as any).user;
    const adminRoles = ['Super Admin', 'Admin', 'Job Moderator'];
    const isAdmin = user && (adminRoles.includes(user.role) || user.isDemoAdmin);

    let savedJob: any;
    if (isAdmin) {
      newJob.status = 'Approved';
      savedJob = JobRepository.create(newJob);
      AuditRepository.add({
        user: user.name,
        role: user.role,
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
      message: isAdmin ? 'Job published live!' : 'Job submitted for verification and review.'
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error creating job' });
  }
});

// 4. Batch Ingest Jobs (with multi-signal deduplication)
jobRouter.post('/batch', requireAdmin, (req, res) => {
  try {
    const { jobs: batchJobs, autoPublish = false } = req.body;
    if (!Array.isArray(batchJobs) || batchJobs.length === 0) {
      return res.status(400).json({ success: false, message: 'Valid array of jobs is required.' });
    }

    const existingLive = JobRepository.getAll({ limit: 1000 }).jobs;
    const existingPending = JobRepository.getPending();
    const existingPool = [...existingLive, ...existingPending];

    const insertedLive: any[] = [];
    const insertedPending: any[] = [];
    const duplicates: any[] = [];

    for (const raw of batchJobs) {
      if (!raw.title || !raw.company) continue;

      const dupCheck = detectJobDuplicate(raw, existingPool);
      const enriched = {
        ...raw,
        isDuplicate: dupCheck.isDuplicate,
        duplicateScore: dupCheck.confidence,
        duplicateCategory: dupCheck.duplicateCategory,
        duplicateTags: dupCheck.duplicateTags,
        duplicateMatchReason: dupCheck.reason,
        duplicateOfJobId: dupCheck.matchedExistingJob?.id
      };

      if (dupCheck.isDuplicate) {
        duplicates.push(enriched);
        JobRepository.addPending(enriched);
        existingPool.push(enriched);
      } else if (autoPublish) {
        enriched.status = 'Approved';
        const created = JobRepository.create(enriched);
        insertedLive.push(created);
        existingPool.push(created);
      } else {
        enriched.status = 'Pending';
        const pending = JobRepository.addPending(enriched);
        insertedPending.push(pending);
        existingPool.push(pending);
      }
    }

    AuditRepository.add({
      user: (req as any).user?.name || 'Administrator',
      role: 'Job Batch Importer',
      action: 'Batch Ingestion Completed',
      target: `${batchJobs.length} Jobs (${insertedLive.length} Live, ${insertedPending.length} Pending, ${duplicates.length} Duplicates)`,
      status: 'Success'
    });

    res.json({
      success: true,
      totalReceived: batchJobs.length,
      insertedLive: insertedLive.length,
      insertedPending: insertedPending.length,
      duplicatesDetected: duplicates.length,
      duplicates
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error processing batch jobs' });
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
