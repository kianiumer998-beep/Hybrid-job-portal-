import { Router } from 'express';
import { generateJobSlug } from '../db/database';
import { detectJobDuplicate, mergeJobRecords } from '../services/duplicateEngine';
import { requireAdmin } from '../auth/authManager';
import { JobRepository, AuditRepository, NotificationRepository } from '../db/repositories';

export const jobRouter = Router();

// 1. Get Live Approved Jobs with Query Filters & Pagination
jobRouter.get('/', async (req, res) => {
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

    const result = await JobRepository.getAll({
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
    console.error('Error in GET /api/jobs:', err);
    res.status(500).json({ success: false, message: err.message || 'Error fetching jobs' });
  }
});

// 2. Get Pending Jobs Queue (Admin Only)
jobRouter.get('/queue/pending', requireAdmin, async (req, res) => {
  try {
    const pending = await JobRepository.getPending();
    res.json({ success: true, pendingJobs: pending, jobs: pending });
  } catch (err: any) {
    console.error('Error in GET /api/jobs/queue/pending:', err);
    res.status(500).json({ success: false, message: err.message || 'Error fetching pending jobs' });
  }
});

// 3. Approve Pending Job
jobRouter.post('/queue/pending/:id/approve', requireAdmin, async (req, res) => {
  try {
    const { force } = req.body || {};
    const pendingList = await JobRepository.getPending();
    const targetJob = pendingList.find(j => j.id === req.params.id);

    if (targetJob) {
      if (targetJob.source === 'scraper' || targetJob.scraperId) {
        const missing: string[] = [];
        if (!targetJob.company) missing.push('Company');
        const hasLoc = targetJob.location || targetJob.country || targetJob.region || targetJob.province || targetJob.city || targetJob.district;
        if (!hasLoc) missing.push('Location');
        if (!targetJob.salary) missing.push('Salary');
        if (!targetJob.currency) missing.push('Currency');
        if (!targetJob.experienceLevel) missing.push('Experience');
        if (!targetJob.department) missing.push('Department');
        if (!targetJob.description) missing.push('Description');
        if (!targetJob.jobType) missing.push('Job Type');
        if (!targetJob.sourceUrl && !targetJob.applicationUrl && !targetJob.applyUrl) missing.push('Source URL');
        if (!targetJob.postedAt) missing.push('Posted Date');
        
        if (missing.length > 0) {
          return res.status(422).json({
            success: false,
            missingFields: missing,
            message: 'Job requires manual completion before publishing.'
          });
        }
      }

      if (!force) {
        const liveJobs = (await JobRepository.getAll({ limit: 10000 })).jobs;
        const otherPending = pendingList.filter(j => j.id !== req.params.id);
        const dupCheck = detectJobDuplicate(targetJob, liveJobs, otherPending);
        if (dupCheck.isDuplicate && dupCheck.confidence >= 80) {
          return res.status(409).json({
            success: false,
            isDuplicate: true,
            duplicateResult: dupCheck,
            message: `Approval blocked: Detected as duplicate of "${dupCheck.matchedExistingJob?.title || 'existing listing'}" (${dupCheck.confidence}% match). Pass force: true to override.`
          });
        }
      }
    }

    const approved = await JobRepository.approvePending(req.params.id);
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
    console.error('Error in POST /api/jobs/queue/pending/:id/approve:', err);
    res.status(500).json({ success: false, message: err.message || 'Error approving job' });
  }
});

// 4. Reject Pending Job
jobRouter.post('/queue/pending/:id/reject', requireAdmin, async (req, res) => {
  try {
    const rejected = await JobRepository.rejectPending(req.params.id, req.body?.reason);
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
    console.error('Error in POST /api/jobs/queue/pending/:id/reject:', err);
    res.status(500).json({ success: false, message: err.message || 'Error rejecting job' });
  }
});

// 5. Bulk Delete Jobs
jobRouter.post('/bulk-delete', requireAdmin, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'Array of job IDs is required.' });
    }
    const count = await JobRepository.bulkDelete(ids);
    AuditRepository.add({
      user: (req as any).user?.name || 'Administrator',
      role: 'Admin',
      action: 'Bulk Jobs Deleted',
      target: `${count} of ${ids.length} jobs deleted`,
      status: 'Success'
    });
    res.json({ success: true, deletedCount: count });
  } catch (err: any) {
    console.error('Error in POST /api/jobs/bulk-delete:', err);
    res.status(500).json({ success: false, message: err.message || 'Error in bulk delete' });
  }
});

// 6. Bulk Approve Pending Jobs
jobRouter.post('/bulk-approve', requireAdmin, async (req, res) => {
  try {
    const { ids, force = false } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'Array of job IDs is required.' });
    }

    let idsToApprove = ids;
    let duplicateWarnings: any[] = [];

    if (!force) {
      const liveJobs = (await JobRepository.getAll({ limit: 10000 })).jobs;
      const allPending = await JobRepository.getPending();
      const validIds: string[] = [];

      for (const id of ids) {
        const pendingJob = allPending.find(j => j.id === id);
        if (pendingJob) {
          if (pendingJob.source === 'scraper' || pendingJob.scraperId) {
            const missing: string[] = [];
            if (!pendingJob.company) missing.push('Company');
            const hasLoc = pendingJob.location || pendingJob.country || pendingJob.region || pendingJob.province || pendingJob.city || pendingJob.district;
            if (!hasLoc) missing.push('Location');
            if (!pendingJob.salary) missing.push('Salary');
            if (!pendingJob.currency) missing.push('Currency');
            if (!pendingJob.experienceLevel) missing.push('Experience');
            if (!pendingJob.department) missing.push('Department');
            if (!pendingJob.description) missing.push('Description');
            if (!pendingJob.jobType) missing.push('Job Type');
            if (!pendingJob.sourceUrl && !pendingJob.applicationUrl && !pendingJob.applyUrl) missing.push('Source URL');
            if (!pendingJob.postedAt) missing.push('Posted Date');
            
            if (missing.length > 0) {
              return res.status(422).json({
                success: false,
                missingFields: missing,
                message: 'Job requires manual completion before publishing.'
              });
            }
          }

          const otherPending = allPending.filter(j => j.id !== id);
          const dup = detectJobDuplicate(pendingJob, liveJobs, otherPending);
          if (dup.isDuplicate && dup.confidence >= 80) {
            duplicateWarnings.push({ id, title: pendingJob.title, match: dup });
            continue;
          }
        }
        validIds.push(id);
      }
      idsToApprove = validIds;
    }

    const result = await JobRepository.bulkApprovePending(idsToApprove);
    AuditRepository.add({
      user: (req as any).user?.name || 'Administrator',
      role: 'Admin',
      action: 'Bulk Jobs Approved',
      target: `${result.successCount} jobs approved (${result.failureCount} failed, ${duplicateWarnings.length} duplicates skipped)`,
      status: result.failureCount === 0 ? 'Success' : 'Warning'
    });
    res.json({
      success: true,
      successCount: result.successCount,
      failureCount: result.failureCount,
      skippedDuplicatesCount: duplicateWarnings.length,
      duplicateWarnings,
      errors: result.errors,
      approvedCount: result.successCount,
      approvedJobs: result.approvedJobs,
      message: `${result.successCount} jobs approved.${duplicateWarnings.length > 0 ? ` (${duplicateWarnings.length} duplicates skipped)` : ''}`
    });
  } catch (err: any) {
    console.error('Error in POST /api/jobs/bulk-approve:', err);
    res.status(500).json({ success: false, message: err.message || 'Error in bulk approve' });
  }
});

// 7. Bulk Reject Pending Jobs
jobRouter.post('/bulk-reject', requireAdmin, async (req, res) => {
  try {
    const { ids, reason } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'Array of job IDs is required.' });
    }
    const result = await JobRepository.bulkRejectPending(ids, reason);
    AuditRepository.add({
      user: (req as any).user?.name || 'Administrator',
      role: 'Admin',
      action: 'Bulk Jobs Rejected',
      target: `${result.successCount} jobs rejected (${result.failureCount} failed)`,
      status: result.failureCount === 0 ? 'Success' : 'Warning'
    });
    res.json({
      success: true,
      successCount: result.successCount,
      failureCount: result.failureCount,
      errors: result.errors,
      rejectedCount: result.successCount
    });
  } catch (err: any) {
    console.error('Error in POST /api/jobs/bulk-reject:', err);
    res.status(500).json({ success: false, message: err.message || 'Error in bulk reject' });
  }
});

// 8. Bulk Delete Duplicates (Delete Selected Duplicates)
jobRouter.post('/bulk-delete-duplicates', requireAdmin, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'Array of duplicate job IDs is required.' });
    }
    const result = await JobRepository.bulkDeleteDuplicates(ids);
    AuditRepository.add({
      user: (req as any).user?.name || 'Administrator',
      role: 'Admin',
      action: 'Bulk Duplicate Jobs Deleted',
      target: `${result.successCount} duplicate jobs deleted (${result.failureCount} failed)`,
      status: result.failureCount === 0 ? 'Success' : 'Warning'
    });
    res.json({
      success: true,
      successCount: result.successCount,
      failureCount: result.failureCount,
      errors: result.errors
    });
  } catch (err: any) {
    console.error('Error in POST /api/jobs/bulk-delete-duplicates:', err);
    res.status(500).json({ success: false, message: err.message || 'Error deleting duplicate jobs' });
  }
});
jobRouter.post('/duplicates/bulk-delete', requireAdmin, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'Array of duplicate job IDs is required.' });
    }
    const result = await JobRepository.bulkDeleteDuplicates(ids);
    AuditRepository.add({
      user: (req as any).user?.name || 'Administrator',
      role: 'Admin',
      action: 'Bulk Duplicate Jobs Deleted',
      target: `${result.successCount} duplicate jobs deleted (${result.failureCount} failed)`,
      status: result.failureCount === 0 ? 'Success' : 'Warning'
    });
    res.json({
      success: true,
      successCount: result.successCount,
      failureCount: result.failureCount,
      errors: result.errors
    });
  } catch (err: any) {
    console.error('Error in POST /api/jobs/duplicates/bulk-delete:', err);
    res.status(500).json({ success: false, message: err.message || 'Error deleting duplicate jobs' });
  }
});

// 9. Keep Original + Delete Duplicates
jobRouter.post('/keep-original-delete-duplicates', requireAdmin, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'Array of duplicate job IDs is required.' });
    }
    const result = await JobRepository.keepOriginalAndDeleteDuplicates(ids);
    AuditRepository.add({
      user: (req as any).user?.name || 'Administrator',
      role: 'Admin',
      action: 'Keep Original + Delete Duplicates Processed',
      target: `${result.successCount} duplicates removed while original preserved (${result.failureCount} failed)`,
      status: result.failureCount === 0 ? 'Success' : 'Warning'
    });
    res.json({
      success: true,
      successCount: result.successCount,
      failureCount: result.failureCount,
      errors: result.errors
    });
  } catch (err: any) {
    console.error('Error in POST /api/jobs/keep-original-delete-duplicates:', err);
    res.status(500).json({ success: false, message: err.message || 'Error processing keep original' });
  }
});
jobRouter.post('/duplicates/keep-original', requireAdmin, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'Array of duplicate job IDs is required.' });
    }
    const result = await JobRepository.keepOriginalAndDeleteDuplicates(ids);
    AuditRepository.add({
      user: (req as any).user?.name || 'Administrator',
      role: 'Admin',
      action: 'Keep Original + Delete Duplicates Processed',
      target: `${result.successCount} duplicates removed while original preserved (${result.failureCount} failed)`,
      status: result.failureCount === 0 ? 'Success' : 'Warning'
    });
    res.json({
      success: true,
      successCount: result.successCount,
      failureCount: result.failureCount,
      errors: result.errors
    });
  } catch (err: any) {
    console.error('Error in POST /api/jobs/duplicates/keep-original:', err);
    res.status(500).json({ success: false, message: err.message || 'Error processing keep original' });
  }
});

// 10. Overwrite Original with Duplicate Data
jobRouter.post('/overwrite-original', requireAdmin, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'Array of duplicate job IDs is required.' });
    }
    const result = await JobRepository.overwriteOriginalWithDuplicates(ids);
    AuditRepository.add({
      user: (req as any).user?.name || 'Administrator',
      role: 'Admin',
      action: 'Overwrite Original with Duplicate Data',
      target: `${result.successCount} originals overwritten with duplicate data (${result.failureCount} failed)`,
      status: result.failureCount === 0 ? 'Success' : 'Warning'
    });
    res.json({
      success: true,
      successCount: result.successCount,
      failureCount: result.failureCount,
      errors: result.errors
    });
  } catch (err: any) {
    console.error('Error in POST /api/jobs/overwrite-original:', err);
    res.status(500).json({ success: false, message: err.message || 'Error overwriting original with duplicate' });
  }
});
jobRouter.post('/duplicates/overwrite-original', requireAdmin, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'Array of duplicate job IDs is required.' });
    }
    const result = await JobRepository.overwriteOriginalWithDuplicates(ids);
    AuditRepository.add({
      user: (req as any).user?.name || 'Administrator',
      role: 'Admin',
      action: 'Overwrite Original with Duplicate Data',
      target: `${result.successCount} originals overwritten with duplicate data (${result.failureCount} failed)`,
      status: result.failureCount === 0 ? 'Success' : 'Warning'
    });
    res.json({
      success: true,
      successCount: result.successCount,
      failureCount: result.failureCount,
      errors: result.errors
    });
  } catch (err: any) {
    console.error('Error in POST /api/jobs/duplicates/overwrite-original:', err);
    res.status(500).json({ success: false, message: err.message || 'Error overwriting original with duplicate' });
  }
});

// 8. Bulk Update Jobs
jobRouter.post('/bulk-update', requireAdmin, async (req, res) => {
  try {
    const { jobs: updatedList } = req.body;
    if (!Array.isArray(updatedList) || updatedList.length === 0) {
      return res.status(400).json({ success: false, message: 'Array of jobs is required.' });
    }
    const updatedCount = await JobRepository.bulkUpdate(updatedList);
    res.json({ success: true, updatedCount });
  } catch (err: any) {
    console.error('Error in POST /api/jobs/bulk-update:', err);
    res.status(500).json({ success: false, message: err.message || 'Error in bulk update' });
  }
});

// 9. Bulk Add Jobs
jobRouter.post('/bulk-add', requireAdmin, async (req, res) => {
  try {
    const { jobs: batchJobs, status = 'Approved' } = req.body;
    if (!Array.isArray(batchJobs) || batchJobs.length === 0) {
      return res.status(400).json({ success: false, message: 'Array of jobs is required.' });
    }
    const isLive = status === 'Approved';
    const result = isLive 
      ? await JobRepository.createBatch(batchJobs, true)
      : await JobRepository.addPendingBatch(batchJobs);
    res.json({ success: true, result });
  } catch (err: any) {
    console.error('Error in POST /api/jobs/bulk-add:', err);
    res.status(500).json({ success: false, message: err.message || 'Error in bulk add' });
  }
});

// 10. Batch Ingest & Persist Jobs (Direct MongoDB Storage - Admin Only)
jobRouter.post('/batch', requireAdmin, async (req, res) => {
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

    let liveRes = { inserted: 0, updated: 0, total: 0 };
    let pendingRes = { inserted: 0, updated: 0, total: 0 };

    if (toLive.length > 0) {
      liveRes = await JobRepository.createBatch(toLive, true);
    }
    if (toPending.length > 0) {
      pendingRes = await JobRepository.addPendingBatch(toPending);
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
    console.error('Error in POST /api/jobs/batch:', err);
    res.status(500).json({ success: false, message: err.message || 'Error processing batch jobs' });
  }
});

// 11. Multi-Signal Duplicate Detection on Demand
jobRouter.post('/detect-duplicates', async (req, res) => {
  try {
    const candidateJob = req.body;
    const existing = (await JobRepository.getAll({ limit: 1000 })).jobs;
    const pending = await JobRepository.getPending();
    const result = detectJobDuplicate(candidateJob, [...existing, ...pending]);
    res.json({ success: true, result });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error detecting duplicates' });
  }
});

// 12. Override Duplicate Decision (Admin Only)
jobRouter.post('/override-duplicate', requireAdmin, async (req, res) => {
  try {
    const { jobId, reason = 'Manually verified as distinct vacancy by administrator' } = req.body;
    if (!jobId) {
      return res.status(400).json({ success: false, message: 'jobId is required.' });
    }

    let job = await JobRepository.getById(jobId);
    let isLive = true;
    if (!job) {
      job = (await JobRepository.getPending()).find(j => j.id === jobId);
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
      await JobRepository.update(jobId, updates);
    } else {
      await JobRepository.update(jobId, updates);
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
jobRouter.post('/merge', requireAdmin, async (req, res) => {
  try {
    const { primaryJobId, secondaryJobId } = req.body;
    const primary = (await JobRepository.getById(primaryJobId)) || (await JobRepository.getPending()).find(j => j.id === primaryJobId);
    const secondary = (await JobRepository.getById(secondaryJobId)) || (await JobRepository.getPending()).find(j => j.id === secondaryJobId);

    if (!primary || !secondary) {
      return res.status(400).json({ success: false, message: 'Both primary and secondary jobs must exist to merge.' });
    }

    const merged = mergeJobRecords(primary, secondary);
    await JobRepository.update(primaryJobId, merged);

    await JobRepository.delete(secondaryJobId);
    await JobRepository.rejectPending(secondaryJobId, `Merged into job ${primaryJobId}`);

    AuditRepository.add({
      user: (req as any).user?.name || 'Administrator',
      role: 'Admin',
      action: 'Jobs Merged Intelligently',
      target: `Merged ${secondary.title} (${secondaryJobId}) into ${primary.title} (${primaryJobId})`,
      status: 'Success',
      metadata: { primaryJobId, secondaryJobId }
    });

    res.json({ success: true, job: merged, message: 'Jobs merged successfully.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error merging jobs' });
  }
});

// 14. Specific slug route
jobRouter.get('/slug/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const job = await JobRepository.getBySlug(slug);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found.' });
    }
    res.json({ success: true, job });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error fetching job details' });
  }
});

// 15. Get Job Details by ID or Slug (Must be placed AFTER specific sub-paths)
jobRouter.get('/:idOrSlug', async (req, res) => {
  try {
    const { idOrSlug } = req.params;
    let job = await JobRepository.getById(idOrSlug);
    if (!job) {
      job = await JobRepository.getBySlug(idOrSlug);
    }

    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found.' });
    }

    res.json({ success: true, job });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error fetching job details' });
  }
});

// 16. Post a Job (Direct Admin or Public/Employer Submission)
jobRouter.post('/', async (req, res) => {
  try {
    const jobData = req.body;

    if (!jobData.title || !jobData.company) {
      return res.status(400).json({ success: false, message: 'Job title and company name are required.' });
    }

    const user = (req as any).user;
    const authUserId = user?.userId || user?.id;
    if (authUserId) {
      const restriction = await NotificationRepository.checkUserRestricted(authUserId, 'post_job');
      if (restriction.restricted) {
        return res.status(403).json({
          success: false,
          message: restriction.reason || 'You are restricted from posting jobs due to an incomplete mandatory requirement.',
          notification: restriction.notification
        });
      }
    }

    const newJob: any = {
      ...jobData,
      slug: generateJobSlug(jobData.title, jobData.city, jobData.id),
      createdAt: new Date().toISOString(),
      applicationsCount: 0
    };

    const canCreateApproved = Boolean(
      user && ['Super Admin', 'Admin', 'Job Moderator'].includes(user.role)
    );

    let savedJob: any;
    if (canCreateApproved) {
      newJob.status = 'Approved';
      savedJob = await JobRepository.create(newJob);
      AuditRepository.add({
        user: user?.name || 'Administrator',
        role: user?.role || 'Admin',
        action: 'Job Created & Published (Admin Direct)',
        target: `${savedJob.title} at ${savedJob.company}`,
        status: 'Success'
      });
    } else {
      // Non-admin / guest / user / employer submissions MUST always become Pending -> MongoDB.pending_jobs
      // Strictly ignore any client-supplied status: 'Approved'
      newJob.status = 'Pending';
      savedJob = await JobRepository.addPending(newJob);
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
      message: canCreateApproved ? 'Job published live!' : 'Job submitted for verification and review.'
    });
  } catch (err: any) {
    console.error('Error in POST /api/jobs:', err);
    res.status(500).json({ success: false, message: err.message || 'Error creating job' });
  }
});

// 17. Update Job
jobRouter.put('/:id', requireAdmin, async (req, res) => {
  try {
    const updated = await JobRepository.update(req.params.id, req.body);
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
    console.error('Error in PUT /api/jobs/:id:', err);
    res.status(500).json({ success: false, message: err.message || 'Error updating job' });
  }
});

// 18. Delete Job
jobRouter.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const deleted = await JobRepository.delete(req.params.id);

    if (!deleted) {
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
  } catch (err: any) {
    console.error('Error in DELETE /api/jobs/:id:', err);
    res.status(500).json({ success: false, message: err.message || 'Error deleting job' });
  }
});

// 19. Restore Expired Job to Live (Admin Only) - Preserves original deadlineDate
jobRouter.post('/restore-expired/:id', requireAdmin, async (req, res) => {
  try {
    const restored = await JobRepository.restoreJobToLive(req.params.id);
    if (!restored) {
      return res.status(404).json({ success: false, message: 'Job not found.' });
    }
    AuditRepository.add({
      user: (req as any).user?.name || 'Administrator',
      role: 'Admin',
      action: 'Expired Job Restored to Live',
      target: `${restored.title} (${restored.id})`,
      status: 'Success'
    });
    res.json({ success: true, job: restored, message: 'Job restored to live status successfully. Original deadline preserved.' });
  } catch (err: any) {
    console.error('Error in POST /api/jobs/restore-expired/:id:', err);
    res.status(500).json({ success: false, message: err.message || 'Error restoring expired job' });
  }
});

// 20. Bulk Restore Expired Jobs to Live (Admin Only) - Preserves original deadlineDate
jobRouter.post('/bulk-restore-expired', requireAdmin, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'Array of job IDs required' });
    }
    const count = await JobRepository.bulkRestoreJobs(ids);
    AuditRepository.add({
      user: (req as any).user?.name || 'Administrator',
      role: 'Admin',
      action: 'Bulk Expired Jobs Restored to Live',
      target: `${count} Jobs`,
      status: 'Success'
    });
    res.json({ success: true, count, message: `${count} expired jobs restored to live successfully.` });
  } catch (err: any) {
    console.error('Error in POST /api/jobs/bulk-restore-expired:', err);
    res.status(500).json({ success: false, message: err.message || 'Error bulk restoring expired jobs' });
  }
});

// 21. Permanently Delete Job (Admin Only)
jobRouter.delete('/permanent/:id', requireAdmin, async (req, res) => {
  try {
    const deleted = await JobRepository.deleteJobPermanently(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Job not found in live or pending queues.' });
    }
    AuditRepository.add({
      user: (req as any).user?.name || 'Administrator',
      role: 'Admin',
      action: 'Job Permanently Deleted',
      target: `Job ID ${req.params.id}`,
      status: 'Success'
    });
    res.json({ success: true, message: 'Job permanently deleted from system.' });
  } catch (err: any) {
    console.error('Error in DELETE /api/jobs/permanent/:id:', err);
    res.status(500).json({ success: false, message: err.message || 'Error deleting job permanently' });
  }
});

// 22. Bulk Update Job Locations (Admin Only)
jobRouter.post('/bulk-update-location', requireAdmin, async (req, res) => {
  try {
    const { jobIds, locationData } = req.body;
    if (!Array.isArray(jobIds) || jobIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Array of job IDs required' });
    }
    const result = await JobRepository.bulkUpdateLocation(jobIds, locationData || {});
    AuditRepository.add({
      user: (req as any).user?.name || 'Administrator',
      role: 'Admin',
      action: 'Bulk Job Location Updated',
      target: `${result.successCount} Jobs`,
      status: 'Success'
    });
    res.json({ success: true, ...result, message: `Updated location for ${result.successCount} jobs.` });
  } catch (err: any) {
    console.error('Error in POST /api/jobs/bulk-update-location:', err);
    res.status(500).json({ success: false, message: err.message || 'Error bulk updating job location' });
  }
});

