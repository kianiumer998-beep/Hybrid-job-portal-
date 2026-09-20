import { Router } from 'express';
import { generateJobSlug } from '../db/database';
import { detectJobDuplicate, mergeJobRecords } from '../services/duplicateEngine';
import { requireAdmin } from '../auth/authManager';
import { JobRepository, AuditRepository, NotificationRepository } from '../db/repositories';
import { calculateJobMissingFields, isScrapedJob, deriveJobSourceType } from '../services/jobValidation';
import { withMongoRetry, isTransientMongoError } from '../db/repositories/ScraperRepository';

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
    const pending = await withMongoRetry(() => JobRepository.getPending());
    res.json({ success: true, pendingJobs: pending, jobs: pending });
  } catch (err: any) {
    console.error('Error in GET /api/jobs/queue/pending:', err);
    if (isTransientMongoError(err)) {
      return res.status(503).json({
        success: false,
        errorType: 'TransientDatabaseError',
        message: 'The database is temporarily busy or undergoing a transient network timeout. Please refresh in a few moments.'
      });
    }
    res.status(500).json({ success: false, message: err.message || 'Error fetching pending jobs' });
  }
});

// 3. Approve Pending Job
jobRouter.post('/queue/pending/:id/approve', requireAdmin, async (req, res) => {
  try {
    const { force } = req.body || {};
    const pendingList = await JobRepository.getPending();
    const targetJob = pendingList.find(j => j.id === req.params.id);

    if (targetJob && !force) {
      if (isScrapedJob(targetJob)) {
        const missingFields = calculateJobMissingFields(targetJob);
        if (missingFields.length > 0) {
          return res.status(422).json({
            success: false,
            hasMissingFields: true,
            missingFields,
            message: `Approval blocked: Scraped job is missing required factual fields (${missingFields.join(', ')}). Please use Quick Edit to provide required information before publishing.`
          });
        }
      }

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
    const { id } = req.params;
    const { reason } = req.body || {};

    const pendingJobs = await JobRepository.getPending();
    const target = pendingJobs.find(j => j.id === id);

    const rejected = await JobRepository.rejectPending(id, reason);
    if (!rejected) {
      return res.status(404).json({ success: false, message: 'Pending job not found.' });
    }

    let notificationSent = false;
    // Check source type and scraper flags authoritatively
    const isScraped = isScrapedJob(target);
    const sourceType = deriveJobSourceType(target);

    // Only notify genuine user-posted listings with a verified submittedByUserId
    if (target && !isScraped && sourceType === 'user_posted' && target.submittedByUserId) {
      try {
        const rejectionReason = reason || 'Details did not meet submission criteria.';
        const body = `Your job submission "${target.title}" was not approved. Reason: ${rejectionReason}`;
        await NotificationRepository.create({
          title: 'Job Submission Rejected',
          body,
          plainText: body,
          targetAudience: 'specific_users',
          targetUserIds: [String(target.submittedByUserId)],
          channels: { bell: true, popup: false, pageBanner: false },
          status: 'published'
        }, 'System - Job Moderation');
        notificationSent = true;
      } catch (notifErr) {
        console.error(`Failed to dispatch rejection notification for job ${id}:`, notifErr);
      }
    }

    AuditRepository.add({
      user: (req as any).user?.name || 'Administrator',
      role: 'Job Moderator',
      action: 'Job Rejected',
      target: `Job ID ${id} (${isScraped ? 'Scraped' : sourceType}) Reason: ${reason || 'None specified'}`,
      status: 'Success',
      metadata: {
        jobId: id,
        sourceType: isScraped ? 'scraped' : sourceType,
        notificationSent,
        notificationSkipped: !notificationSent
      }
    });

    res.json({
      success: true,
      message: 'Job rejected.',
      notificationSent,
      sourceType: isScraped ? 'scraped' : sourceType
    });
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
    // Limit batch size to 500
    const safeIds = ids.slice(0, 500).map(String);

    const result = await JobRepository.bulkDeleteWithClassification(safeIds);

    let notificationsSent = 0;
    let notificationsSkipped = result.scrapedCount + result.adminCreatedCount + result.unknownCount;

    // Send notifications ONLY to authentic user_posted jobs with verified submittedByUserId
    if (result.userPostedJobs.length > 0) {
      const userJobMap = new Map<string, any[]>();
      for (const job of result.userPostedJobs) {
        if (job.submittedByUserId && !isScrapedJob(job)) {
          const uId = String(job.submittedByUserId);
          if (!userJobMap.has(uId)) userJobMap.set(uId, []);
          userJobMap.get(uId)!.push(job);
        } else {
          notificationsSkipped++;
        }
      }

      for (const [userId, userJobs] of userJobMap.entries()) {
        try {
          const titles = userJobs.map(j => `"${j.title}"`).slice(0, 3).join(', ');
          const extra = userJobs.length > 3 ? ` and ${userJobs.length - 3} more` : '';
          const body = userJobs.length === 1
            ? `Your job posting "${userJobs[0].title}" has been removed by administration.`
            : `${userJobs.length} of your job postings (${titles}${extra}) have been removed by administration.`;

          await NotificationRepository.create({
            title: 'Job Posting Removed',
            body,
            plainText: body,
            targetAudience: 'specific_users',
            targetUserIds: [userId],
            channels: { bell: true, popup: false, pageBanner: false },
            status: 'published'
          }, 'System - Job Moderation');

          notificationsSent++;
        } catch (notifErr) {
          console.error(`Failed to dispatch deletion notification to user ${userId}:`, notifErr);
        }
      }
    }

    AuditRepository.add({
      user: (req as any).user?.name || 'Administrator',
      role: 'Admin',
      action: 'Bulk Jobs Deleted',
      target: `${result.deletedCount} of ${safeIds.length} jobs deleted (${result.scrapedCount} scraped, ${result.userPostedCount} user-posted, ${result.adminCreatedCount} admin-created)`,
      status: 'Success',
      metadata: {
        totalRequested: safeIds.length,
        deletedCount: result.deletedCount,
        scrapedDeletedCount: result.scrapedCount,
        userPostedDeletedCount: result.userPostedCount,
        adminCreatedDeletedCount: result.adminCreatedCount,
        unknownDeletedCount: result.unknownCount,
        notificationsSent,
        notificationsSkipped
      }
    });

    res.json({
      success: true,
      deletedCount: result.deletedCount,
      scrapedDeletedCount: result.scrapedCount,
      userPostedDeletedCount: result.userPostedCount,
      notificationsSent,
      notificationsSkipped
    });
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
    let missingFieldWarnings: any[] = [];

    if (!force) {
      const liveJobs = (await JobRepository.getAll({ limit: 10000 })).jobs;
      const allPending = await JobRepository.getPending();
      const validIds: string[] = [];

      for (const id of ids) {
        const pendingJob = allPending.find(j => j.id === id);
        if (pendingJob) {
          if (isScrapedJob(pendingJob)) {
            const missingFields = calculateJobMissingFields(pendingJob);
            if (missingFields.length > 0) {
              missingFieldWarnings.push({ id, title: pendingJob.title, missingFields });
              continue;
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
      target: `${result.successCount} jobs approved (${result.failureCount} failed, ${duplicateWarnings.length} duplicates skipped, ${missingFieldWarnings.length} missing fields skipped)`,
      status: result.failureCount === 0 ? 'Success' : 'Warning'
    });
    res.json({
      success: true,
      successCount: result.successCount,
      failureCount: result.failureCount,
      skippedDuplicatesCount: duplicateWarnings.length,
      skippedMissingFieldsCount: missingFieldWarnings.length,
      duplicateWarnings,
      missingFieldWarnings,
      errors: result.errors,
      approvedCount: result.successCount,
      approvedJobs: result.approvedJobs,
      message: `${result.successCount} jobs approved.${duplicateWarnings.length > 0 ? ` (${duplicateWarnings.length} duplicates skipped)` : ''}${missingFieldWarnings.length > 0 ? ` (${missingFieldWarnings.length} skipped with missing fields)` : ''}`
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
    const safeIds = ids.slice(0, 500).map(String);
    const result = await JobRepository.bulkRejectPendingWithClassification(safeIds, reason);

    let notificationsSent = 0;
    let notificationsSkipped = result.scrapedCount;

    // Send notifications ONLY to authentic user_posted jobs with verified submittedByUserId
    if (result.userPostedJobs.length > 0) {
      const userJobMap = new Map<string, any[]>();
      for (const job of result.userPostedJobs) {
        if (job.submittedByUserId && !isScrapedJob(job)) {
          const uId = String(job.submittedByUserId);
          if (!userJobMap.has(uId)) userJobMap.set(uId, []);
          userJobMap.get(uId)!.push(job);
        } else {
          notificationsSkipped++;
        }
      }

      for (const [userId, userJobs] of userJobMap.entries()) {
        try {
          const titles = userJobs.map(j => `"${j.title}"`).slice(0, 3).join(', ');
          const extra = userJobs.length > 3 ? ` and ${userJobs.length - 3} more` : '';
          const rejectionReason = reason || 'Details did not meet submission criteria.';
          const body = userJobs.length === 1
            ? `Your job submission "${userJobs[0].title}" was not approved. Reason: ${rejectionReason}`
            : `${userJobs.length} of your job submissions (${titles}${extra}) were not approved. Reason: ${rejectionReason}`;

          await NotificationRepository.create({
            title: 'Job Submission Rejected',
            body,
            plainText: body,
            targetAudience: 'specific_users',
            targetUserIds: [userId],
            channels: { bell: true, popup: false, pageBanner: false },
            status: 'published'
          }, 'System - Job Moderation');

          notificationsSent++;
        } catch (notifErr) {
          console.error(`Failed to dispatch rejection notification to user ${userId}:`, notifErr);
        }
      }
    }

    AuditRepository.add({
      user: (req as any).user?.name || 'Administrator',
      role: 'Admin',
      action: 'Bulk Jobs Rejected',
      target: `${result.successCount} jobs rejected (${result.scrapedCount} scraped, ${result.userPostedCount} user-posted, ${result.failureCount} failed)`,
      status: result.failureCount === 0 ? 'Success' : 'Warning',
      metadata: {
        totalRequested: safeIds.length,
        rejectedCount: result.successCount,
        scrapedRejectedCount: result.scrapedCount,
        userPostedRejectedCount: result.userPostedCount,
        notificationsSent,
        notificationsSkipped,
        failureCount: result.failureCount
      }
    });

    res.json({
      success: true,
      successCount: result.successCount,
      rejectedCount: result.successCount,
      scrapedRejectedCount: result.scrapedCount,
      userPostedRejectedCount: result.userPostedCount,
      notificationsSent,
      notificationsSkipped,
      failureCount: result.failureCount,
      errors: result.errors
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

    const canCreateApproved = Boolean(
      user && ['Super Admin', 'Admin', 'Job Moderator'].includes(user.role)
    );

    const isScrapedOrigin = isScrapedJob(jobData);
    let derivedSourceType: string;
    if (isScrapedOrigin) {
      derivedSourceType = 'scraped';
    } else if (canCreateApproved) {
      derivedSourceType = 'admin_created';
    } else if (authUserId) {
      derivedSourceType = 'user_posted';
    } else {
      derivedSourceType = 'unknown';
    }

    const newJob: any = {
      ...jobData,
      sourceType: derivedSourceType,
      // Strictly enforce submittedByUserId from verified authentication token, never trust client-supplied identity!
      submittedByUserId: authUserId || undefined,
      slug: generateJobSlug(jobData.title, jobData.city, jobData.id),
      createdAt: new Date().toISOString(),
      applicationsCount: 0
    };

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
    const { id } = req.params;
    const existing = (await JobRepository.getJobsByIds([id]))[0];

    const deleted = await JobRepository.delete(id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Job not found.' });
    }

    let notificationSent = false;
    if (existing) {
      const isScraped = isScrapedJob(existing);
      const st = deriveJobSourceType(existing);
      if (!isScraped && st === 'user_posted' && existing.submittedByUserId) {
        try {
          const body = `Your job posting "${existing.title}" has been removed by administration.`;
          await NotificationRepository.create({
            title: 'Job Posting Removed',
            body,
            plainText: body,
            targetAudience: 'specific_users',
            targetUserIds: [String(existing.submittedByUserId)],
            channels: { bell: true, popup: false, pageBanner: false },
            status: 'published'
          }, 'System - Job Moderation');
          notificationSent = true;
        } catch (notifErr) {
          console.error(`Failed to dispatch deletion notification for job ${id}:`, notifErr);
        }
      }
    }

    AuditRepository.add({
      user: (req as any).user?.name || 'Administrator',
      role: 'Admin',
      action: 'Job Deleted',
      target: `Job ID ${id} (${existing ? (isScrapedJob(existing) ? 'scraped' : deriveJobSourceType(existing)) : 'unknown'})`,
      status: 'Success',
      metadata: { jobId: id, notificationSent }
    });
    res.json({ success: true, message: 'Job deleted successfully.', notificationSent });
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
    const { id } = req.params;
    const existing = (await JobRepository.getJobsByIds([id]))[0];

    const deleted = await JobRepository.deleteJobPermanently(id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Job not found in live or pending queues.' });
    }

    let notificationSent = false;
    if (existing) {
      const isScraped = isScrapedJob(existing);
      const st = deriveJobSourceType(existing);
      if (!isScraped && st === 'user_posted' && existing.submittedByUserId) {
        try {
          const body = `Your job posting "${existing.title}" has been permanently removed by administration.`;
          await NotificationRepository.create({
            title: 'Job Posting Removed',
            body,
            plainText: body,
            targetAudience: 'specific_users',
            targetUserIds: [String(existing.submittedByUserId)],
            channels: { bell: true, popup: false, pageBanner: false },
            status: 'published'
          }, 'System - Job Moderation');
          notificationSent = true;
        } catch (notifErr) {
          console.error(`Failed to dispatch deletion notification for job ${id}:`, notifErr);
        }
      }
    }

    AuditRepository.add({
      user: (req as any).user?.name || 'Administrator',
      role: 'Admin',
      action: 'Job Permanently Deleted',
      target: `Job ID ${id} (${existing ? (isScrapedJob(existing) ? 'scraped' : deriveJobSourceType(existing)) : 'unknown'})`,
      status: 'Success',
      metadata: { jobId: id, notificationSent }
    });
    res.json({ success: true, message: 'Job permanently deleted from system.', notificationSent });
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

// 23. Bulk Mark Pending Records as Non-Job (Admin Only)
jobRouter.post('/bulk-mark-non-job', requireAdmin, async (req, res) => {
  try {
    const { ids, reason } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'Array of job IDs required' });
    }
    const result = await JobRepository.bulkMarkNonJob(ids, reason || 'Marked as Non-Job by administrator');
    AuditRepository.add({
      user: (req as any).user?.name || 'Administrator',
      role: 'Admin',
      action: 'Bulk Jobs Marked as Non-Job',
      target: `${result.successCount} Jobs marked as Non-Job`,
      status: 'Success'
    });
    res.json({ success: true, ...result, message: `${result.successCount} records retained as Non-Job.` });
  } catch (err: any) {
    console.error('Error in POST /api/jobs/bulk-mark-non-job:', err);
    res.status(500).json({ success: false, message: err.message || 'Error marking records as non-job' });
  }
});

// 24. Convert Non-Job/Needs-Review record to Standard Job (Admin Only)
jobRouter.post('/convert-to-job', requireAdmin, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) {
      return res.status(400).json({ success: false, message: 'Job ID is required' });
    }
    const success = await JobRepository.convertToJob(id);
    if (!success) {
      return res.status(404).json({ success: false, message: 'Job not found in pending queue.' });
    }
    AuditRepository.add({
      user: (req as any).user?.name || 'Administrator',
      role: 'Admin',
      action: 'Record Converted to Job',
      target: `Job ID ${id}`,
      status: 'Success'
    });
    res.json({ success: true, message: 'Record converted to standard Job successfully.' });
  } catch (err: any) {
    console.error('Error in POST /api/jobs/convert-to-job:', err);
    res.status(500).json({ success: false, message: err.message || 'Error converting record to job' });
  }
});


