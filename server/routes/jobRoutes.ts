import crypto from 'crypto';
import path from 'path';
import { Router } from 'express';
import { Database, generateJobSlug } from '../db/database';
import { detectJobDuplicate, mergeJobRecords } from '../services/duplicateEngine';
import { requireAdminPermission } from '../auth/authManager';
import { JobRepository, AuditRepository, NotificationRepository, UserRepository } from '../db/repositories';
import { calculateJobMissingFields, isScrapedJob, deriveJobSourceType, isNonJobRecord, isNeedsReviewRecord } from '../services/jobValidation';
import { withMongoRetry, isTransientMongoError } from '../db/repositories/ScraperRepository';
import { isMongoConfigured } from '../db/mongodb';
import { saveAttachment, getAttachmentStream, deleteAttachmentFile, validateAttachmentMagicBytes, getAttachmentMimeType } from '../services/attachmentStorage';
import { JobAttachment } from '../../src/types/job';
import { getProvinceForCity } from '../../src/utils/locationCatalog';

export const jobRouter = Router();

import { JobVisibilityRepository } from '../db/repositories/JobVisibilityRepository';
import { evaluateApplyAccess } from '../services/applyAccessPolicy';

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

    const user = (req as any).user;
    const isPremium = await JobVisibilityRepository.isUserPremiumAuthoritative(user?.userId || user?.id);

    let sanitizedJobs = result.jobs;
    const applySettings = Database.getApplySettings();
    if (Array.isArray(sanitizedJobs)) {
      sanitizedJobs = await Promise.all(
        sanitizedJobs.map(async (job: any) => {
          const policyApplied = await JobVisibilityRepository.applyPolicyToJob(job);
          let filtered = JobVisibilityRepository.filterJobForUser(policyApplied, user, isPremium);
          
          const accessRes = await evaluateApplyAccess(user, policyApplied, applySettings, isPremium);
          if (!accessRes.allowed) {
            // Attach metadata and redact apply destinations only
            filtered.externalApplyUrl = "[LOCKED]";
            filtered.applicationUrl = "[LOCKED]";
            filtered._applyGate = accessRes.gate;
          }
          return filtered;
        })
      );
    }

    res.json({
      success: true,
      ...result,
      jobs: sanitizedJobs
    });
  } catch (err: any) {
    console.error('Error in GET /api/jobs:', err);
    res.status(500).json({ success: false, message: err.message || 'Error fetching jobs' });
  }
});

// 1b. Get Priority Placement Jobs (VIP, Pinned, Featured, Urgent)
jobRouter.get('/priority', async (req, res) => {
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
      isGovt
    } = req.query as Record<string, string>;

    const result = await JobRepository.getPriorityPlacementJobs({
      search,
      jobType,
      region,
      province,
      city,
      experienceLevel,
      salaryMin: salaryMin ? parseInt(salaryMin, 10) : undefined,
      sortBy,
      isGovt: isGovt === 'true'
    });

    const user = (req as any).user;
    const isPremium = await JobVisibilityRepository.isUserPremiumAuthoritative(user?.userId || user?.id);

    let sanitizedJobs = result.jobs;
    const applySettings = Database.getApplySettings();
    if (Array.isArray(sanitizedJobs)) {
      sanitizedJobs = await Promise.all(
        sanitizedJobs.map(async (job: any) => {
          const policyApplied = await JobVisibilityRepository.applyPolicyToJob(job);
          let filtered = JobVisibilityRepository.filterJobForUser(policyApplied, user, isPremium);

          const accessRes = await evaluateApplyAccess(user, policyApplied, applySettings, isPremium);
          if (!accessRes.allowed) {
            filtered.externalApplyUrl = "[LOCKED]";
            filtered.applicationUrl = "[LOCKED]";
            filtered._applyGate = accessRes.gate;
          }
          return filtered;
        })
      );
    }

    res.json({
      success: true,
      tierCounts: result.tierCounts,
      slotLimits: result.slotLimits,
      jobs: sanitizedJobs
    });
  } catch (err: any) {
    console.error('Error in GET /api/jobs/priority:', err);
    res.status(500).json({ success: false, message: err.message || 'Error fetching priority jobs' });
  }
});

// 2. Get Pending Jobs Queue (Admin Only)
jobRouter.get('/queue/pending', requireAdminPermission('jobs.manage'), async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  try {
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const rawLimit = parseInt(String(req.query.limit || '200'), 10) || 200;
    const limit = Math.min(200, Math.max(1, rawLimit));

    if (!isMongoConfigured()) {
      const fallbackPending = Database.getPendingJobs();
      return res.status(200).json({
        success: true,
        pendingJobs: fallbackPending,
        jobs: fallbackPending,
        dataSource: 'local_fallback',
        fallback: true,
        count: fallbackPending.length,
        total: fallbackPending.length,
        page: 1,
        limit: fallbackPending.length || 200,
        totalPages: 1
      });
    }

    const pendingResult = await withMongoRetry(() => JobRepository.getPending({ page, limit }));
    const pendingJobsList = Array.isArray(pendingResult) ? pendingResult : ((pendingResult as any).pendingJobs || []);
    const total = (pendingResult as any).total ?? pendingJobsList.length;
    const currentPage = (pendingResult as any).page ?? page;
    const currentLimit = (pendingResult as any).limit ?? limit;
    const totalPages = (pendingResult as any).totalPages ?? (Math.ceil(total / currentLimit) || 1);

    return res.status(200).json({
      success: true,
      pendingJobs: pendingJobsList,
      jobs: pendingJobsList,
      dataSource: 'mongodb',
      count: pendingJobsList.length,
      total,
      page: currentPage,
      limit: currentLimit,
      totalPages
    });
  } catch (err: any) {
    console.error('Error in GET /api/jobs/queue/pending:', err);
    const isTransient = isTransientMongoError(err) ||
      String(err?.message || '').toLowerCase().includes('mongo') ||
      String(err?.name || '').toLowerCase().includes('mongo') ||
      String(err?.message || '').toLowerCase().includes('timeout');
    const statusCode = isTransient ? 503 : 500;
    return res.status(statusCode).json({
      success: false,
      errorType: isTransient ? 'TransientDatabaseError' : 'DatabaseError',
      isDatabaseUnavailable: true,
      message: `Authoritative pending database (MongoDB) is temporarily unavailable: ${err?.message || 'Database error'}. Pending queue mutations are paused to protect consistency.`,
      pendingJobs: [],
      jobs: []
    });
  }
});

// 3. Approve Pending Job
jobRouter.post('/queue/pending/:id/approve', requireAdminPermission('jobs.manage'), async (req, res) => {
  try {
    const { force } = req.body || {};
    const pendingList = await JobRepository.getPending();
    let targetJob = pendingList.find(j => j.id === req.params.id);

    if (!targetJob && !force) {
      targetJob = await JobRepository.getPendingById(req.params.id);
    }

    if (!targetJob && !force) {
      return res.status(404).json({ success: false, message: 'Pending job not found.' });
    }

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
jobRouter.post('/queue/pending/:id/reject', requireAdminPermission('jobs.manage'), async (req, res) => {
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
        const recipientUserId = String(target.submittedByUserId);
        const recipient = await UserRepository.getByIdAsync(recipientUserId);
        if (recipient) {
          const rejectionReason = reason || 'Details did not meet submission criteria.';
          const body = `Your job submission "${target.title}" was not approved. Reason: ${rejectionReason}`;
          const stableEventId = `notif-job-reject-${id}`;

          await NotificationRepository.createAsync({
            userId: recipientUserId,
            title: 'Job Submission Rejected',
            message: body,
            type: 'warning',
            channel: 'in-app',
            eventId: stableEventId,
            idempotencyKey: stableEventId,
            metadata: { jobId: id, jobTitle: target.title, reason: rejectionReason }
          }, 'System - Job Moderation');
          notificationSent = true;
        }
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
jobRouter.post('/bulk-delete', requireAdminPermission('jobs.manage'), async (req, res) => {
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
          const user = await UserRepository.getByIdAsync(userId);
          if (!user) {
            notificationsSkipped += userJobs.length;
            continue;
          }

          const sortedJobIds = Array.from(new Set(userJobs.map(j => j.id))).sort();
          const hashInput = JSON.stringify(['bulk-delete', userId, sortedJobIds]);
          const hash = crypto.createHash('sha256').update(hashInput).digest('hex');
          const stableEventId = `notif-job-bulk-delete-${hash}`;

          const titles = userJobs.map(j => `"${j.title}"`).slice(0, 3).join(', ');
          const extra = userJobs.length > 3 ? ` and ${userJobs.length - 3} more` : '';
          const body = userJobs.length === 1
            ? `Your job posting "${userJobs[0].title}" has been removed by administration.`
            : `${userJobs.length} of your job postings (${titles}${extra}) have been removed by administration.`;

          await NotificationRepository.createAsync({
            userId,
            title: 'Job Posting Removed',
            message: body,
            type: 'alert',
            channel: 'in-app',
            eventId: stableEventId,
            idempotencyKey: stableEventId,
            metadata: { userJobCount: userJobs.length, jobIds: sortedJobIds }
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
jobRouter.post('/bulk-approve', requireAdminPermission('jobs.manage'), async (req, res) => {
  try {
    const { ids, force = false } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'Array of job IDs is required.' });
    }

    let idsToApprove = ids;
    let duplicateWarnings: any[] = [];
    let missingFieldWarnings: any[] = [];
    let unresolvedErrors: { id: string; error: string }[] = [];

    if (!force) {
      const liveJobs = (await JobRepository.getAll({ limit: 10000 })).jobs;
      const allPending = await JobRepository.getPending();
      const pendingMap = new Map<string, any>();
      for (const j of allPending) {
        if (j && j.id) pendingMap.set(j.id, j);
      }

      const missingIds = ids.filter(id => !pendingMap.has(id));
      if (missingIds.length > 0) {
        const additionalPending = await JobRepository.getPendingByIds(missingIds);
        for (const j of additionalPending) {
          if (j && j.id) pendingMap.set(j.id, j);
        }
      }

      const allPendingItems = Array.from(pendingMap.values());
      const validIds: string[] = [];

      for (const id of ids) {
        const pendingJob = pendingMap.get(id);
        if (!pendingJob) {
          unresolvedErrors.push({ id, error: `Pending job with ID "${id}" could not be found or processed.` });
          continue;
        }

        if (isScrapedJob(pendingJob)) {
          const missingFields = calculateJobMissingFields(pendingJob);
          if (missingFields.length > 0) {
            missingFieldWarnings.push({ id, title: pendingJob.title, missingFields });
            continue;
          }
        }
        const otherPending = allPendingItems.filter(j => j.id !== id);
        const dup = detectJobDuplicate(pendingJob, liveJobs, otherPending);
        if (dup.isDuplicate && dup.confidence >= 80) {
          duplicateWarnings.push({ id, title: pendingJob.title, match: dup });
          continue;
        }
        validIds.push(id);
      }
      idsToApprove = validIds;
    }

    const result = await JobRepository.bulkApprovePending(idsToApprove);
    const combinedErrors = [...unresolvedErrors, ...result.errors];
    const totalFailureCount = combinedErrors.length;
    AuditRepository.add({
      user: (req as any).user?.name || 'Administrator',
      role: 'Admin',
      action: 'Bulk Jobs Approved',
      target: `${result.successCount} jobs approved (${totalFailureCount} failed, ${duplicateWarnings.length} duplicates skipped, ${missingFieldWarnings.length} missing fields skipped)`,
      status: totalFailureCount === 0 ? 'Success' : 'Warning'
    });
    const hasFailures = totalFailureCount > 0;
    const isFullySuccessful = !hasFailures && result.successCount > 0;
    res.json({
      success: isFullySuccessful,
      successCount: result.successCount,
      failureCount: totalFailureCount,
      skippedDuplicatesCount: duplicateWarnings.length,
      skippedMissingFieldsCount: missingFieldWarnings.length,
      duplicateWarnings,
      missingFieldWarnings,
      errors: combinedErrors,
      approvedCount: result.successCount,
      approvedJobs: result.approvedJobs,
      message: `${result.successCount} jobs approved.${hasFailures ? ` (${totalFailureCount} failed)` : ''}${duplicateWarnings.length > 0 ? ` (${duplicateWarnings.length} duplicates skipped)` : ''}${missingFieldWarnings.length > 0 ? ` (${missingFieldWarnings.length} skipped with missing fields)` : ''}`
    });
  } catch (err: any) {
    console.error('Error in POST /api/jobs/bulk-approve:', err);
    res.status(500).json({ success: false, message: err.message || 'Error in bulk approve' });
  }
});

// 7. Bulk Reject Pending Jobs
jobRouter.post('/bulk-reject', requireAdminPermission('jobs.manage'), async (req, res) => {
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
          const user = await UserRepository.getByIdAsync(userId);
          if (!user) {
            notificationsSkipped += userJobs.length;
            continue;
          }

          const rejectionReason = reason || 'Details did not meet submission criteria.';
          const sortedJobIds = Array.from(new Set(userJobs.map(j => j.id))).sort();
          const hashInput = JSON.stringify(['bulk-reject', userId, sortedJobIds, rejectionReason]);
          const hash = crypto.createHash('sha256').update(hashInput).digest('hex');
          const stableEventId = `notif-job-bulk-reject-${hash}`;

          const titles = userJobs.map(j => `"${j.title}"`).slice(0, 3).join(', ');
          const extra = userJobs.length > 3 ? ` and ${userJobs.length - 3} more` : '';
          const body = userJobs.length === 1
            ? `Your job submission "${userJobs[0].title}" was not approved. Reason: ${rejectionReason}`
            : `${userJobs.length} of your job submissions (${titles}${extra}) were not approved. Reason: ${rejectionReason}`;

          await NotificationRepository.createAsync({
            userId,
            title: 'Job Submission Rejected',
            message: body,
            type: 'warning',
            channel: 'in-app',
            eventId: stableEventId,
            idempotencyKey: stableEventId,
            metadata: { userJobCount: userJobs.length, jobIds: sortedJobIds, reason: rejectionReason }
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
jobRouter.post('/bulk-delete-duplicates', requireAdminPermission('jobs.manage'), async (req, res) => {
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
    const isDbUnavailable = isTransientMongoError(err) || String(err?.message || '').toLowerCase().includes('mongo');
    res.status(isDbUnavailable ? 503 : 500).json({
      success: false,
      errorType: isDbUnavailable ? 'DatabaseUnavailable' : 'Error',
      message: err.message || 'Error deleting duplicate jobs'
    });
  }
});
jobRouter.post('/duplicates/bulk-delete', requireAdminPermission('jobs.manage'), async (req, res) => {
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
    const isDbUnavailable = isTransientMongoError(err) || String(err?.message || '').toLowerCase().includes('mongo');
    res.status(isDbUnavailable ? 503 : 500).json({
      success: false,
      errorType: isDbUnavailable ? 'DatabaseUnavailable' : 'Error',
      message: err.message || 'Error deleting duplicate jobs'
    });
  }
});

// 9. Keep Original + Delete Duplicates
jobRouter.post('/keep-original-delete-duplicates', requireAdminPermission('jobs.manage'), async (req, res) => {
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
    const isDbUnavailable = isTransientMongoError(err) || String(err?.message || '').toLowerCase().includes('mongo');
    res.status(isDbUnavailable ? 503 : 500).json({
      success: false,
      errorType: isDbUnavailable ? 'DatabaseUnavailable' : 'Error',
      message: err.message || 'Error processing keep original'
    });
  }
});
jobRouter.post('/duplicates/keep-original', requireAdminPermission('jobs.manage'), async (req, res) => {
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
    const isDbUnavailable = isTransientMongoError(err) || String(err?.message || '').toLowerCase().includes('mongo');
    res.status(isDbUnavailable ? 503 : 500).json({
      success: false,
      errorType: isDbUnavailable ? 'DatabaseUnavailable' : 'Error',
      message: err.message || 'Error processing keep original'
    });
  }
});

// 10. Overwrite Original with Duplicate Data
jobRouter.post('/overwrite-original', requireAdminPermission('jobs.manage'), async (req, res) => {
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
    const isDbUnavailable = isTransientMongoError(err) || String(err?.message || '').toLowerCase().includes('mongo');
    res.status(isDbUnavailable ? 503 : 500).json({
      success: false,
      errorType: isDbUnavailable ? 'DatabaseUnavailable' : 'Error',
      message: err.message || 'Error overwriting original with duplicate'
    });
  }
});
jobRouter.post('/duplicates/overwrite-original', requireAdminPermission('jobs.manage'), async (req, res) => {
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
    const isDbUnavailable = isTransientMongoError(err) || String(err?.message || '').toLowerCase().includes('mongo');
    res.status(isDbUnavailable ? 503 : 500).json({
      success: false,
      errorType: isDbUnavailable ? 'DatabaseUnavailable' : 'Error',
      message: err.message || 'Error overwriting original with duplicate'
    });
  }
});

// 8. Bulk Update Jobs
jobRouter.post('/bulk-update', requireAdminPermission('jobs.manage'), async (req, res) => {
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
jobRouter.post('/bulk-add', requireAdminPermission('jobs.manage'), async (req, res) => {
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
jobRouter.post('/batch', requireAdminPermission('jobs.manage'), async (req, res) => {
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

export interface AdminImportValidationError {
  index: number;
  title?: string;
  message: string;
  type?: 'duplicate' | 'error';
  confidence?: number;
  duplicateCategory?: string;
  matchedJobId?: string;
  matchedJobTitle?: string;
}

const ADMIN_IMPORT_MAX_RECORDS = 500;
const ADMIN_IMPORT_DUPLICATE_THRESHOLD = 80;
const ADMIN_IMPORT_STRING_ARRAY_FIELDS = [
  'tags',
  'requirements',
  'benefits',
  'responsibilities',
  'responsibilitiesList',
  'advertisedPositions',
  'relatedSourceUrls',
  'duplicateTags'
] as const;

const ADMIN_IMPORT_DUPLICATE_CONTROL_FIELDS = [
  'isDuplicate',
  'duplicateScore',
  'duplicateCategory',
  'duplicateTags',
  'duplicateMatchReason',
  'duplicateOfJobId',
  'duplicateOfJobTitle',
  'duplicateMatchedCompany',
  'isDuplicateOverride',
  'duplicateOverrideNote',
  'duplicateDetectedAt'
] as const;

const ADMIN_IMPORT_REQUIRED_ATTACHMENT_STRINGS: Array<keyof Pick<JobAttachment, 'id' | 'name' | 'fileUrl' | 'fileType' | 'uploadedAt'>> = [
  'id',
  'name',
  'fileUrl',
  'fileType',
  'uploadedAt'
];

export function validateAdminImportAttachment(
  att: unknown,
  recordIndex: number,
  attIndex: number,
  recordLabel?: string
): AdminImportValidationError | null {
  if (
    att === null ||
    typeof att !== 'object' ||
    Array.isArray(att) ||
    Object.prototype.toString.call(att) !== '[object Object]'
  ) {
    return {
      index: recordIndex,
      title: recordLabel,
      type: 'error',
      message: `Record #${recordIndex + 1} (index ${recordIndex}): Attachment at attachments[${attIndex}] must be a plain object.`
    };
  }

  const obj = att as Record<string, unknown>;
  for (const field of ADMIN_IMPORT_REQUIRED_ATTACHMENT_STRINGS) {
    const val = obj[field];
    if (typeof val !== 'string' || !val.trim()) {
      return {
        index: recordIndex,
        title: recordLabel,
        type: 'error',
        message: `Record #${recordIndex + 1} (index ${recordIndex}): Attachment at attachments[${attIndex}] requires non-empty string "${field}".`
      };
    }
  }

  for (const optStrField of ['fileName', 'description'] as const) {
    const val = obj[optStrField];
    if (val !== undefined && val !== null && typeof val !== 'string') {
      return {
        index: recordIndex,
        title: recordLabel,
        type: 'error',
        message: `Record #${recordIndex + 1} (index ${recordIndex}): Attachment at attachments[${attIndex}] optional "${optStrField}" must be a string when supplied.`
      };
    }
  }

  if (obj.isPublic !== undefined && obj.isPublic !== null && typeof obj.isPublic !== 'boolean') {
    return {
      index: recordIndex,
      title: recordLabel,
      type: 'error',
      message: `Record #${recordIndex + 1} (index ${recordIndex}): Attachment at attachments[${attIndex}] optional "isPublic" must be a boolean when supplied.`
    };
  }

  if (
    obj.sizeBytes !== undefined &&
    obj.sizeBytes !== null &&
    (typeof obj.sizeBytes !== 'number' || !Number.isFinite(obj.sizeBytes) || obj.sizeBytes < 0)
  ) {
    return {
      index: recordIndex,
      title: recordLabel,
      type: 'error',
      message: `Record #${recordIndex + 1} (index ${recordIndex}): Attachment at attachments[${attIndex}] optional "sizeBytes" must be a finite non-negative number when supplied.`
    };
  }

  return null;
}

export function isFullSnapshotImportPayload(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false;
  const obj = payload as Record<string, unknown>;
  return Boolean(
    obj.snapshotVersion ||
    (Array.isArray(obj.jobs) &&
      (Array.isArray(obj.users) ||
        Array.isArray(obj.subscribers) ||
        Array.isArray(obj.feeLogs) ||
        Array.isArray(obj.pendingJobs)))
  );
}

export function validateAdminImportJobsPayload(rawBody: unknown): {
  valid: boolean;
  jobs: any[];
  errors: AdminImportValidationError[];
  message: string;
} {
  if (isFullSnapshotImportPayload(rawBody)) {
    return {
      valid: false,
      jobs: [],
      errors: [{ index: 0, type: 'error', message: 'Full system snapshot payloads cannot be imported via bulk job import.' }],
      message: 'Full system snapshot payloads are rejected. Provide a { jobs: [...] } array of job objects.'
    };
  }

  const batchJobs = Array.isArray(rawBody)
    ? rawBody
    : (rawBody && typeof rawBody === 'object' ? (rawBody as Record<string, unknown>).jobs : undefined);

  if (!Array.isArray(batchJobs) || batchJobs.length === 0) {
    return {
      valid: false,
      jobs: [],
      errors: [{ index: 0, type: 'error', message: 'A non-empty array of job objects is required.' }],
      message: 'A non-empty array of job objects is required.'
    };
  }

  if (batchJobs.length > ADMIN_IMPORT_MAX_RECORDS) {
    return {
      valid: false,
      jobs: [],
      errors: [
        {
          index: ADMIN_IMPORT_MAX_RECORDS,
          type: 'error',
          message: `Batch size ${batchJobs.length} exceeds the maximum limit of ${ADMIN_IMPORT_MAX_RECORDS} records.`
        }
      ],
      message: `Batch limit exceeded: maximum ${ADMIN_IMPORT_MAX_RECORDS} jobs allowed per import (received ${batchJobs.length}).`
    };
  }

  const errors: AdminImportValidationError[] = [];

  for (let i = 0; i < batchJobs.length; i++) {
    const item = batchJobs[i];
    if (
      item === null ||
      typeof item !== 'object' ||
      Array.isArray(item) ||
      Object.prototype.toString.call(item) !== '[object Object]'
    ) {
      const receivedType = item === null ? 'null' : Array.isArray(item) ? 'array' : typeof item;
      errors.push({
        index: i,
        type: 'error',
        message: `Record #${i + 1} (index ${i}): Expected a plain job object, received ${receivedType}.`
      });
      continue;
    }

    const record = item as Record<string, any>;
    const recordLabel = typeof record.title === 'string' && record.title.trim() ? record.title.trim() : undefined;

    if (isNonJobRecord(record)) {
      errors.push({
        index: i,
        title: recordLabel,
        type: 'error',
        message: `Record #${i + 1} (index ${i}): Non-job records (isNonJob/NON_JOB) cannot be imported.`
      });
      continue;
    }

    if (isNeedsReviewRecord(record)) {
      errors.push({
        index: i,
        title: recordLabel,
        type: 'error',
        message: `Record #${i + 1} (index ${i}): Records marked NEEDS_REVIEW cannot be directly imported as Approved.`
      });
      continue;
    }

    if (typeof record.title !== 'string' || !record.title.trim()) {
      errors.push({
        index: i,
        title: recordLabel,
        type: 'error',
        message: `Record #${i + 1} (index ${i}): Valid non-empty string "title" is required.`
      });
      continue;
    }

    if (typeof record.company !== 'string' || !record.company.trim()) {
      errors.push({
        index: i,
        title: recordLabel,
        type: 'error',
        message: `Record #${i + 1} (index ${i}): Valid non-empty string "company" is required.`
      });
      continue;
    }

    const locationFields = ['city', 'province', 'region', 'country', 'location'] as const;
    let hasInvalidLocationType = false;
    for (const locField of locationFields) {
      if (record[locField] !== undefined && record[locField] !== null && typeof record[locField] !== 'string') {
        errors.push({
          index: i,
          title: recordLabel,
          type: 'error',
          message: `Record #${i + 1} (index ${i}): Location field "${locField}" must be a string when supplied.`
        });
        hasInvalidLocationType = true;
        break;
      }
    }
    if (hasInvalidLocationType) continue;

    const missingFields = calculateJobMissingFields(record);
    if (missingFields.length > 0) {
      errors.push({
        index: i,
        title: recordLabel,
        type: 'error',
        message: `Record #${i + 1} (index ${i}): Missing required publication field(s): ${missingFields.join(', ')}.`
      });
      continue;
    }

    if (record.description !== undefined && record.description !== null && typeof record.description !== 'string') {
      errors.push({
        index: i,
        title: recordLabel,
        type: 'error',
        message: `Record #${i + 1} (index ${i}): Optional "description" must be a string when supplied.`
      });
      continue;
    }

    let hasInvalidArrayField = false;
    for (const arrField of ADMIN_IMPORT_STRING_ARRAY_FIELDS) {
      const val = record[arrField];
      if (val !== undefined && val !== null) {
        if (!Array.isArray(val) || !val.every((entry: unknown) => typeof entry === 'string')) {
          errors.push({
            index: i,
            title: recordLabel,
            type: 'error',
            message: `Record #${i + 1} (index ${i}): Optional "${arrField}" must be an array of strings when supplied.`
          });
          hasInvalidArrayField = true;
          break;
        }
      }
    }
    if (hasInvalidArrayField) continue;

    if (record.attachments !== undefined && record.attachments !== null) {
      if (!Array.isArray(record.attachments)) {
        errors.push({
          index: i,
          title: recordLabel,
          type: 'error',
          message: `Record #${i + 1} (index ${i}): Optional "attachments" must be an array when supplied.`
        });
        continue;
      }
      let attachmentError: AdminImportValidationError | null = null;
      for (let aIdx = 0; aIdx < record.attachments.length; aIdx++) {
        attachmentError = validateAdminImportAttachment(record.attachments[aIdx], i, aIdx, recordLabel);
        if (attachmentError) break;
      }
      if (attachmentError) {
        errors.push(attachmentError);
        continue;
      }
    }
  }

  if (errors.length > 0) {
    return {
      valid: false,
      jobs: [],
      errors,
      message: `Validation failed for ${errors.length} record(s). First error: ${errors[0].message}`
    };
  }

  return {
    valid: true,
    jobs: batchJobs,
    errors: [],
    message: 'Validation passed'
  };
}

export function buildSanitizedAdminImportJob(item: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = { ...item };

  // Never trust client-supplied identifiers, slugs, timestamps, counts, status, ownership, or moderation states
  delete sanitized._id;
  delete sanitized.id;
  delete sanitized.slug;
  delete sanitized.submittedByUserId;
  delete sanitized.postedByUserId;
  delete sanitized.userId;
  delete sanitized.createdAt;
  delete sanitized.updatedAt;
  delete sanitized.applicationsCount;
  delete sanitized.status;
  delete sanitized.isExpired;
  delete sanitized.isSuspended;
  delete sanitized.suspensionReason;
  delete sanitized.rejectionReason;
  delete sanitized.visibilitySource;
  delete sanitized.isNonJob;
  delete sanitized.classificationState;
  delete sanitized.reviewStatus;
  delete sanitized._titleTokens;
  delete sanitized._companyTokens;

  // Never trust imported duplicate-control metadata
  for (const dupField of ADMIN_IMPORT_DUPLICATE_CONTROL_FIELDS) {
    delete sanitized[dupField];
  }

  const cleanTitle = String(item.title).trim();
  const cleanCompany = String(item.company).trim();
  const cleanCity = typeof item.city === 'string' && item.city.trim() ? item.city.trim() : undefined;

  const rawCountry = typeof item.country === 'string' ? item.country.trim() : '';
  const resolvedCountry =
    rawCountry || (item.country === undefined || item.country === null || item.country === '' ? 'Pakistan' : item.country);

  let resolvedProvince =
    typeof item.province === 'string' && item.province.trim() ? item.province.trim() : undefined;
  if (!resolvedProvince && cleanCity) {
    const mappedProv = getProvinceForCity(cleanCity);
    if (mappedProv) {
      resolvedProvince = mappedProv;
    }
  }

  const newId = `job-import-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  const newSlug = generateJobSlug(cleanTitle, cleanCity, newId);
  const now = new Date().toISOString();

  const sanitizedAttachments = Array.isArray(item.attachments)
    ? item.attachments.map((att: JobAttachment) => ({ ...att }))
    : undefined;

  return {
    ...sanitized,
    ...(sanitizedAttachments !== undefined ? { attachments: sanitizedAttachments } : {}),
    id: newId,
    slug: newSlug,
    title: cleanTitle,
    company: cleanCompany,
    ...(cleanCity ? { city: cleanCity } : {}),
    country: resolvedCountry,
    ...(resolvedProvince ? { province: resolvedProvince } : {}),
    status: 'Approved',
    sourceType: isScrapedJob(sanitized) ? 'scraped' : 'admin_created',
    isAdminCreated: true,
    createdAt: now,
    updatedAt: now,
    applicationsCount: 0
  };
}

export class DuplicateCheckLoadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DuplicateCheckLoadError';
  }
}

export function getDuplicatePoolMaxPages(): number {
  const raw = Number(process.env.ADMIN_IMPORT_MAX_POOL_PAGES);
  return Number.isInteger(raw) && raw > 0 ? raw : 1000;
}

export async function loadAuthoritativeDuplicatePool(
  maxPages: number = getDuplicatePoolMaxPages()
): Promise<any[]> {
  if (!Number.isInteger(maxPages) || maxPages < 1) {
    throw new DuplicateCheckLoadError('Invalid duplicate-check pagination limit configuration.');
  }

  const liveJobs: any[] = [];
  for (let page = 1; ; page++) {
    const res = await JobRepository.getAll({ page, limit: 1000, includeExpired: true });
    if (!res || !Array.isArray(res.jobs)) {
      throw new DuplicateCheckLoadError('Authoritative live jobs could not be loaded for duplicate detection.');
    }
    if (res.jobs.length === 0) {
      break;
    }
    liveJobs.push(...res.jobs);

    const hasExplicitTotal = typeof res.total === 'number' && Number.isFinite(res.total);
    const pageLimit = typeof res.limit === 'number' && res.limit > 0 ? res.limit : 1000;
    const reachedEnd =
      (hasExplicitTotal && liveJobs.length >= res.total) ||
      res.jobs.length < pageLimit;

    if (reachedEnd) {
      break;
    }

    if (page >= maxPages) {
      if (hasExplicitTotal) {
        throw new DuplicateCheckLoadError(
          `Authoritative live-job duplicate pool exceeded maximum pagination limit of ${maxPages} page(s) (${liveJobs.length} of ${res.total} loaded). Import aborted to prevent incomplete duplicate checks.`
        );
      }
      const nextRes = await JobRepository.getAll({ page: page + 1, limit: 1000, includeExpired: true });
      if (!nextRes || !Array.isArray(nextRes.jobs)) {
        throw new DuplicateCheckLoadError('Authoritative live jobs could not be verified beyond final page.');
      }
      if (nextRes.jobs.length === 0) {
        break;
      }
      throw new DuplicateCheckLoadError(
        `Authoritative live-job duplicate pool exceeded maximum pagination limit of ${maxPages} page(s) with additional records remaining. Import aborted to prevent incomplete duplicate checks.`
      );
    }
  }

  const pendingJobs: any[] = [];
  if (!isMongoConfigured() && process.env.IS_TEST !== 'true') {
    const pendingRes = await JobRepository.getPending();
    if (!Array.isArray(pendingRes)) {
      throw new DuplicateCheckLoadError('Authoritative pending jobs could not be loaded for duplicate detection.');
    }
    const hasExplicitTotal =
      typeof (pendingRes as any).total === 'number' && Number.isFinite((pendingRes as any).total);
    if (hasExplicitTotal && pendingRes.length < (pendingRes as any).total) {
      throw new DuplicateCheckLoadError(
        `Authoritative pending-job duplicate pool returned incomplete local fallback data (${pendingRes.length} of ${(pendingRes as any).total} loaded). Import aborted to prevent incomplete duplicate checks.`
      );
    }
    pendingJobs.push(...pendingRes);
  } else {
    for (let pendingPage = 1; ; pendingPage++) {
      const pendingRes = await JobRepository.getPending({ page: pendingPage, limit: 500 });
      if (!Array.isArray(pendingRes)) {
        throw new DuplicateCheckLoadError('Authoritative pending jobs could not be loaded for duplicate detection.');
      }
      if (pendingRes.length === 0) {
        break;
      }
      pendingJobs.push(...pendingRes);

      const hasExplicitTotal =
        typeof (pendingRes as any).total === 'number' && Number.isFinite((pendingRes as any).total);
      const totalPending = hasExplicitTotal ? (pendingRes as any).total : pendingJobs.length;
      const pendingLimit =
        typeof (pendingRes as any).limit === 'number' && (pendingRes as any).limit > 0
          ? (pendingRes as any).limit
          : 500;
      const reachedEnd =
        (hasExplicitTotal && pendingJobs.length >= totalPending) ||
        pendingRes.length < pendingLimit;

      if (reachedEnd) {
        break;
      }

      if (pendingPage >= maxPages) {
        if (hasExplicitTotal) {
          throw new DuplicateCheckLoadError(
            `Authoritative pending-job duplicate pool exceeded maximum pagination limit of ${maxPages} page(s) (${pendingJobs.length} of ${totalPending} loaded). Import aborted to prevent incomplete duplicate checks.`
          );
        }
        const nextPending = await JobRepository.getPending({ page: pendingPage + 1, limit: 500 });
        if (!Array.isArray(nextPending)) {
          throw new DuplicateCheckLoadError('Authoritative pending jobs could not be verified beyond final page.');
        }
        if (nextPending.length === 0) {
          break;
        }
        throw new DuplicateCheckLoadError(
          `Authoritative pending-job duplicate pool exceeded maximum pagination limit of ${maxPages} page(s) with additional records remaining. Import aborted to prevent incomplete duplicate checks.`
        );
      }
    }
  }

  return [...liveJobs, ...pendingJobs];
}

// 10b. Dedicated Safe Admin Bulk Job Import (Validated, Duplicate-Protected, Non-Overwriting, Sequential Persistence)
jobRouter.post('/admin-import', requireAdminPermission('jobs.manage'), async (req, res) => {
  try {
    const validation = validateAdminImportJobsPayload(req.body);
    if (!validation.valid) {
      const requestedCount = isFullSnapshotImportPayload(req.body)
        ? 0
        : Array.isArray(req.body)
          ? req.body.length
          : Array.isArray(req.body?.jobs)
            ? req.body.jobs.length
            : 0;
      const batchFailureMessage =
        requestedCount > 0
          ? `Batch validation failed on ${validation.errors.length} of ${requestedCount} record(s); entire batch rejected so 0 of ${requestedCount} record(s) were written. ${validation.message}`
          : validation.message;
      return res.status(400).json({
        success: false,
        message: batchFailureMessage,
        processed: requestedCount,
        requestedCount,
        importedCount: 0,
        failedCount: requestedCount,
        skippedDuplicateCount: 0,
        errors: validation.errors,
        partialSuccess: false
      });
    }

    const validatedJobs = validation.jobs;
    const requestedCount = validatedJobs.length;

    // Fail closed before writing any record if authoritative live/expired/pending jobs cannot be loaded completely
    let existingPool: any[] = [];
    try {
      existingPool = await loadAuthoritativeDuplicatePool();
    } catch (poolErr: any) {
      const isDuplicateLoadErr = poolErr instanceof DuplicateCheckLoadError || poolErr?.name === 'DuplicateCheckLoadError';
      const isDbUnavailable =
        !isDuplicateLoadErr &&
        (isTransientMongoError(poolErr) || String(poolErr?.message || '').toLowerCase().includes('mongo'));
      return res.status(isDbUnavailable ? 503 : 500).json({
        success: false,
        errorType: isDbUnavailable ? 'DatabaseUnavailable' : 'DuplicateCheckLoadError',
        message: `Bulk import aborted (fail-closed): Unable to load complete existing live, expired, and pending jobs for duplicate detection. ${poolErr?.message || ''}`.trim(),
        processed: requestedCount,
        requestedCount,
        importedCount: 0,
        failedCount: requestedCount,
        skippedDuplicateCount: 0,
        errors: [
          {
            index: 0,
            type: 'error',
            message: poolErr?.message || 'Unable to load complete existing jobs for duplicate detection.'
          }
        ],
        partialSuccess: false
      });
    }

    let importedCount = 0;
    let failedCount = 0;
    let skippedDuplicateCount = 0;
    const errors: AdminImportValidationError[] = [];
    const persistedBatchJobs: any[] = [];

    for (let i = 0; i < validatedJobs.length; i++) {
      const rawItem = validatedJobs[i];
      const titleLabel = String(rawItem.title).trim();
      try {
        const jobPayload = buildSanitizedAdminImportJob(rawItem);
        const dupCheck = detectJobDuplicate({ ...jobPayload }, existingPool, persistedBatchJobs);

        if (dupCheck.isDuplicate && dupCheck.confidence >= ADMIN_IMPORT_DUPLICATE_THRESHOLD) {
          skippedDuplicateCount++;
          const matchedTitle = dupCheck.matchedExistingJob?.title || 'existing listing';
          const matchedCompany = dupCheck.matchedExistingJob?.company ? ` at "${dupCheck.matchedExistingJob.company}"` : '';
          errors.push({
            index: i,
            title: titleLabel,
            type: 'duplicate',
            confidence: dupCheck.confidence,
            duplicateCategory: dupCheck.duplicateCategory,
            matchedJobId: dupCheck.matchedExistingJob?.id,
            matchedJobTitle: dupCheck.matchedExistingJob?.title,
            message: `Skipped duplicate (${dupCheck.confidence}% confidence, ${dupCheck.duplicateCategory}): matches "${matchedTitle}"${matchedCompany}.`
          });
          continue;
        }

        const saved = await JobRepository.create(jobPayload);
        if (!saved || !saved.id) {
          throw new Error('Repository failed to confirm job persistence.');
        }
        importedCount++;
        persistedBatchJobs.push({ ...saved });
      } catch (saveErr: any) {
        failedCount++;
        errors.push({
          index: i,
          title: titleLabel,
          type: 'error',
          message: saveErr?.message || 'Failed to persist job record'
        });
      }
    }

    const processed = importedCount + skippedDuplicateCount + failedCount;
    const partialSuccess = importedCount > 0 && (failedCount > 0 || skippedDuplicateCount > 0);

    if (importedCount > 0) {
      try {
        await AuditRepository.add({
          user: (req as any).user?.name || 'Administrator',
          role: (req as any).user?.role || 'Admin',
          action: 'Admin Bulk Job Import',
          target: `Imported ${importedCount}/${requestedCount} jobs (${skippedDuplicateCount} duplicate(s) skipped, ${failedCount} failed)`,
          status: partialSuccess ? 'Warning' : 'Success'
        });
      } catch (auditErr) {
        console.warn('[admin-import] Audit logging failed (non-blocking):', auditErr);
      }
    }

    if (importedCount === 0 && failedCount > 0) {
      return res.status(500).json({
        success: false,
        message: `Import failed: 0 of ${requestedCount} job(s) persisted (${failedCount} failed${skippedDuplicateCount > 0 ? `, ${skippedDuplicateCount} skipped as duplicate` : ''}).`,
        processed,
        requestedCount,
        importedCount: 0,
        failedCount,
        skippedDuplicateCount,
        errors,
        partialSuccess: false
      });
    }

    if (importedCount === 0 && skippedDuplicateCount > 0) {
      return res.status(200).json({
        success: false,
        message: `No jobs imported: 0 of ${requestedCount} job(s) saved (${skippedDuplicateCount} skipped as duplicate).`,
        processed,
        requestedCount,
        importedCount: 0,
        failedCount: 0,
        skippedDuplicateCount,
        errors,
        partialSuccess: false
      });
    }

    const statusNotes: string[] = [];
    if (skippedDuplicateCount > 0) statusNotes.push(`${skippedDuplicateCount} duplicate(s) skipped`);
    if (failedCount > 0) statusNotes.push(`${failedCount} failed`);

    return res.status(200).json({
      success: true,
      message: partialSuccess
        ? `Partial import completed: ${importedCount} of ${requestedCount} job(s) saved (${statusNotes.join(', ')}).`
        : `Successfully imported ${importedCount} job(s) into the live catalog.`,
      processed,
      requestedCount,
      importedCount,
      failedCount,
      skippedDuplicateCount,
      errors,
      partialSuccess
    });
  } catch (err: any) {
    console.error('Error in POST /api/jobs/admin-import:', err);
    return res.status(500).json({
      success: false,
      message: err?.message || 'Unexpected error during admin bulk job import',
      processed: 0,
      requestedCount: Array.isArray(req.body?.jobs) ? req.body.jobs.length : 0,
      importedCount: 0,
      failedCount: Array.isArray(req.body?.jobs) ? req.body.jobs.length : 0,
      skippedDuplicateCount: 0,
      errors: [{ index: 0, type: 'error', message: err?.message || 'Server error during bulk import' }],
      partialSuccess: false
    });
  }
});

// 11. Multi-Signal Duplicate Detection on Demand
jobRouter.post('/detect-duplicates', requireAdminPermission('jobs.manage'), async (req, res) => {
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
jobRouter.post('/override-duplicate', requireAdminPermission('jobs.manage'), async (req, res) => {
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
jobRouter.post('/merge', requireAdminPermission('jobs.manage'), async (req, res) => {
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
    let job = await JobRepository.getBySlug(slug);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found.' });
    }

    const user = (req as any).user;
    const isPremium = await JobVisibilityRepository.isUserPremiumAuthoritative(user?.userId || user?.id);
    const policyAppliedJob = await JobVisibilityRepository.applyPolicyToJob(job);
    let filteredJob = JobVisibilityRepository.filterJobForUser(policyAppliedJob, user, isPremium);

    const applySettings = Database.getApplySettings();
    const accessRes = await evaluateApplyAccess(user, policyAppliedJob, applySettings, isPremium);
    if (!accessRes.allowed) {
      // Attach metadata and redact apply destinations only
      filteredJob.externalApplyUrl = "[LOCKED]";
      filteredJob.applicationUrl = "[LOCKED]";
      filteredJob._applyGate = accessRes.gate;
    }

    res.json({ success: true, job: filteredJob });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error fetching job details' });
  }
});

// 14-A. Secure Supporting Document Attachment Upload (Admin Only)
jobRouter.post('/attachments/upload', requireAdminPermission('jobs.manage'), async (req, res) => {
  try {
    const { fileName, fileType, fileBase64, description } = req.body;

    if (!fileName || !fileBase64) {
      return res.status(400).json({ success: false, message: 'File name and file content (base64) are required.' });
    }

    const ext = path.extname(fileName).toLowerCase();
    const allowedExts = ['.pdf', '.jpg', '.jpeg', '.png', '.webp'];
    if (!allowedExts.includes(ext)) {
      return res.status(400).json({
        success: false,
        message: `Invalid file extension "${ext}". Supported formats are PDF (.pdf), JPEG (.jpg, .jpeg), PNG (.png), and WebP (.webp).`
      });
    }

    const base64Data = fileBase64.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    const MAX_ATTACHMENT_SIZE = 15 * 1024 * 1024; // 15MB limit
    if (buffer.length > MAX_ATTACHMENT_SIZE) {
      return res.status(400).json({
        success: false,
        message: `Document exceeds 15 MB limit. Uploaded size: ${(buffer.length / (1024 * 1024)).toFixed(2)} MB.`
      });
    }

    const isValidHeader = validateAttachmentMagicBytes(buffer, ext);
    if (!isValidHeader) {
      return res.status(400).json({
        success: false,
        message: `File header does not match a valid ${ext.toUpperCase()} document. Corrupt or executable files are prohibited.`
      });
    }

    const storageRes = await saveAttachment(fileName, buffer, fileType);

    const isPublic = req.body.isPublic === true; // Default false (private)
    const attachment: JobAttachment = {
      id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      name: fileName,
      fileUrl: storageRes.fileUrl,
      fileType: storageRes.contentType,
      sizeBytes: storageRes.sizeBytes,
      uploadedAt: new Date().toISOString(),
      description: description ? String(description).trim() : undefined,
      isPublic
    };

    AuditRepository.add({
      user: (req as any).user?.name || 'Administrator',
      role: 'Admin',
      action: 'Job Document Attachment Uploaded',
      target: fileName,
      status: 'Success',
      metadata: { storedFileName: storageRes.storedFileName, sizeBytes: buffer.length, isPublic }
    });

    res.status(201).json({
      success: true,
      attachment,
      message: 'Document attachment uploaded successfully.'
    });
  } catch (err: any) {
    console.error('Error uploading job attachment:', err);
    res.status(500).json({ success: false, message: err.message || 'Error processing document attachment.' });
  }
});

// 14-B. Stream / Serve Uploaded Job Document Attachment (Protected for Private Attachments)
jobRouter.get('/attachments/:filename', async (req, res) => {
  try {
    const rawFileName = req.params.filename;
    const safeFileName = path.basename(rawFileName);

    const attachmentData = getAttachmentStream(safeFileName);
    if (!attachmentData) {
      return res.status(404).json({ success: false, message: 'Attachment file not found.' });
    }

    // Authoritative check for Attachment and Field Visibility access
    const user = (req as any).user;
    const isPremium = await JobVisibilityRepository.isUserPremiumAuthoritative(user?.userId || user?.id);
    const targetJobId = typeof req.query.jobId === 'string' && req.query.jobId.trim() ? req.query.jobId.trim() : undefined;
    
    const isAllowed = await JobRepository.verifyAttachmentAccess(safeFileName, user, isPremium, targetJobId);
    if (!isAllowed) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. This document requires a Premium subscription or elevated privileges to view.'
      });
    }

    const isPublic = await JobRepository.isAttachmentPublic(safeFileName);

    const isDownload = req.query.download === '1' || req.query.download === 'true';
    const disposition = isDownload ? 'attachment' : 'inline';

    res.setHeader('Content-Type', attachmentData.contentType);
    res.setHeader('Content-Length', attachmentData.size);
    res.setHeader('Content-Disposition', `${disposition}; filename="${encodeURIComponent(safeFileName)}"`);
    res.setHeader('Cache-Control', isPublic ? 'public, max-age=86400' : 'private, no-cache');

    attachmentData.stream.pipe(res);
  } catch (err: any) {
    console.error('Error streaming attachment:', err);
    res.status(500).json({ success: false, message: 'Error serving attachment file.' });
  }
});

// 14-C. Add Attachment to Existing Job (Admin Only)
jobRouter.post('/:id/attachments', requireAdminPermission('jobs.manage'), async (req, res) => {
  try {
    const { id } = req.params;
    const { attachment } = req.body;

    if (!attachment || !attachment.fileUrl || !attachment.name) {
      return res.status(400).json({ success: false, message: 'Valid attachment object with name and fileUrl is required.' });
    }

    let existingJob = await JobRepository.getById(id);
    if (!existingJob) {
      existingJob = (await JobRepository.getPending()).find(j => j.id === id);
    }

    if (!existingJob) {
      return res.status(404).json({ success: false, message: 'Job not found.' });
    }

    const currentAttachments: JobAttachment[] = Array.isArray(existingJob.attachments) ? existingJob.attachments : [];
    const isPublic = attachment.isPublic === true; // Default false (private)
    const newAttachment: JobAttachment = {
      id: attachment.id || `att-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      name: attachment.name,
      fileUrl: attachment.fileUrl,
      fileType: attachment.fileType || getAttachmentMimeType(attachment.name),
      sizeBytes: attachment.sizeBytes,
      uploadedAt: attachment.uploadedAt || new Date().toISOString(),
      description: attachment.description,
      isPublic
    };

    const updatedAttachments = [...currentAttachments, newAttachment];
    const updatedJob = await JobRepository.update(id, { attachments: updatedAttachments });

    AuditRepository.add({
      user: (req as any).user?.name || 'Administrator',
      role: 'Admin',
      action: 'Document Attached to Job',
      target: `Job ${existingJob.title} (${id}) - Attachment: ${newAttachment.name} (${isPublic ? 'Public' : 'Private'})`,
      status: 'Success'
    });

    res.json({
      success: true,
      message: 'Attachment saved to job successfully.',
      attachment: newAttachment,
      attachments: updatedAttachments,
      job: updatedJob
    });
  } catch (err: any) {
    console.error('Error attaching document to job:', err);
    res.status(500).json({ success: false, message: err.message || 'Error saving attachment to job.' });
  }
});

// 14-D. Update Attachment Visibility (Admin Only)
jobRouter.patch('/:id/attachments/:attachmentId/visibility', requireAdminPermission('jobs.manage'), async (req, res) => {
  try {
    const { id, attachmentId } = req.params;
    const { isPublic } = req.body;

    if (typeof isPublic !== 'boolean') {
      return res.status(400).json({ success: false, message: 'isPublic boolean value is required.' });
    }

    let existingJob = await JobRepository.getById(id);
    if (!existingJob) {
      existingJob = (await JobRepository.getPending()).find(j => j.id === id);
    }

    if (!existingJob) {
      return res.status(404).json({ success: false, message: 'Job not found.' });
    }

    const currentAttachments: JobAttachment[] = Array.isArray(existingJob.attachments) ? existingJob.attachments : [];
    const targetAtt = currentAttachments.find(a => a.id === attachmentId);

    if (!targetAtt) {
      return res.status(404).json({ success: false, message: 'Attachment not found on this job.' });
    }

    targetAtt.isPublic = isPublic;

    const updatedJob = await JobRepository.update(id, { attachments: currentAttachments });

    AuditRepository.add({
      user: (req as any).user?.name || 'Administrator',
      role: 'Admin',
      action: 'Attachment Visibility Changed',
      target: `Job ${existingJob.title} (${id}) - Attachment ${targetAtt.name}: ${isPublic ? 'PUBLIC (Show to Users)' : 'PRIVATE (Admin Only)'}`,
      status: 'Success'
    });

    res.json({
      success: true,
      message: `Attachment visibility set to ${isPublic ? 'Public' : 'Private'}.`,
      attachment: targetAtt,
      attachments: currentAttachments,
      job: updatedJob
    });
  } catch (err: any) {
    console.error('Error toggling attachment visibility:', err);
    res.status(500).json({ success: false, message: err.message || 'Error updating attachment visibility.' });
  }
});

// 14-D. Remove Attachment from Existing Job (Admin Only)
jobRouter.delete('/:id/attachments/:attachmentId', requireAdminPermission('jobs.manage'), async (req, res) => {
  try {
    const { id, attachmentId } = req.params;

    let existingJob = await JobRepository.getById(id);
    if (!existingJob) {
      existingJob = (await JobRepository.getPending()).find(j => j.id === id);
    }

    if (!existingJob) {
      return res.status(404).json({ success: false, message: 'Job not found.' });
    }

    const currentAttachments: JobAttachment[] = Array.isArray(existingJob.attachments) ? existingJob.attachments : [];
    const targetAtt = currentAttachments.find(a => a.id === attachmentId);

    if (!targetAtt) {
      return res.status(404).json({ success: false, message: 'Attachment not found on this job.' });
    }

    const updatedAttachments = currentAttachments.filter(a => a.id !== attachmentId);
    const updatedJob = await JobRepository.update(id, { attachments: updatedAttachments });

    // Clean up local file if stored locally
    if (targetAtt.fileUrl && targetAtt.fileUrl.startsWith('/api/jobs/attachments/')) {
      deleteAttachmentFile(targetAtt.fileUrl);
    }

    AuditRepository.add({
      user: (req as any).user?.name || 'Administrator',
      role: 'Admin',
      action: 'Document Attachment Removed from Job',
      target: `Job ${existingJob.title} (${id}) - Removed: ${targetAtt.name}`,
      status: 'Success'
    });

    res.json({
      success: true,
      message: 'Attachment removed successfully.',
      attachments: updatedAttachments,
      job: updatedJob
    });
  } catch (err: any) {
    console.error('Error removing attachment from job:', err);
    res.status(500).json({ success: false, message: err.message || 'Error removing attachment from job.' });
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

    const user = (req as any).user;
    const isPremium = await JobVisibilityRepository.isUserPremiumAuthoritative(user?.userId || user?.id);
    const policyAppliedJob = await JobVisibilityRepository.applyPolicyToJob(job);
    let filteredJob = JobVisibilityRepository.filterJobForUser(policyAppliedJob, user, isPremium);

    const applySettings = Database.getApplySettings();
    const accessRes = await evaluateApplyAccess(user, policyAppliedJob, applySettings, isPremium);
    if (!accessRes.allowed) {
      // Attach metadata and redact apply destinations only
      filteredJob.externalApplyUrl = "[LOCKED]";
      filteredJob.applicationUrl = "[LOCKED]";
      filteredJob._applyGate = accessRes.gate;
    }

    res.json({ success: true, job: filteredJob });
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

    const isScrapedOrigin = canCreateApproved && isScrapedJob(jobData);
    let derivedSourceType: string;
    if (isScrapedOrigin) {
      derivedSourceType = 'scraped';
    } else if (canCreateApproved) {
      derivedSourceType = 'admin_created';
    } else {
      derivedSourceType = 'user_posted';
    }

    // Requirement C: Country defaults to Pakistan when missing or blank
    const rawCountry = typeof jobData.country === 'string' ? jobData.country.trim() : '';
    const resolvedCountry = rawCountry || (jobData.country === undefined || jobData.country === null || jobData.country === '' ? 'Pakistan' : jobData.country);

    // Requirement D: Automatic City -> Province mapping if city is known and province is not explicitly set
    let resolvedProvince = typeof jobData.province === 'string' && jobData.province.trim() ? jobData.province.trim() : undefined;
    if (!resolvedProvince && jobData.city && typeof jobData.city === 'string' && jobData.city.trim()) {
      const mappedProv = getProvinceForCity(jobData.city.trim());
      if (mappedProv) {
        resolvedProvince = mappedProv;
      }
    }

    const newJob: any = {
      ...jobData,
      country: resolvedCountry,
      province: resolvedProvince,
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
      // Strictly ignore any client-supplied status: 'Approved' and strip client-controlled ID / owner-alias / scraper fields
      delete newJob.id;
      delete newJob.postedByUserId;
      delete newJob.userId;
      delete newJob.isScraped;
      delete newJob.isPdfScraped;
      delete newJob.scraperSourceId;
      delete newJob.scraperSourceName;
      delete newJob.scrapedSourceDomain;
      delete newJob.sourcePortal;
      delete newJob.scrapeRunId;
      delete newJob.scrapedAt;
      delete newJob.extractionMethod;
      delete newJob.sourceJobId;
      delete newJob.pdfSourceUrl;
      delete newJob.pdfFileName;
      newJob.sourceType = 'user_posted';
      newJob.slug = generateJobSlug(jobData.title, jobData.city);
      newJob.status = 'Pending';
      newJob.featured = false;
      newJob.urgent = false;
      newJob.isPinnedTop = false;
      newJob.isFutureJob = false;
      newJob.priorityTier = 'standard';
      newJob.isVerified = false;
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
jobRouter.put('/:id', requireAdminPermission('jobs.manage'), async (req, res) => {
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
jobRouter.delete('/:id', requireAdminPermission('jobs.manage'), async (req, res) => {
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
          const recipientUserId = String(existing.submittedByUserId);
          const recipient = await UserRepository.getByIdAsync(recipientUserId);
          if (recipient) {
            const body = `Your job posting "${existing.title}" has been removed by administration.`;
            const stableEventId = `notif-job-delete-${id}`;

            await NotificationRepository.createAsync({
              userId: recipientUserId,
              title: 'Job Posting Removed',
              message: body,
              type: 'alert',
              channel: 'in-app',
              eventId: stableEventId,
              idempotencyKey: stableEventId,
              metadata: { jobId: id, jobTitle: existing.title }
            }, 'System - Job Moderation');
            notificationSent = true;
          }
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
jobRouter.post('/restore-expired/:id', requireAdminPermission('jobs.manage'), async (req, res) => {
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
jobRouter.post('/bulk-restore-expired', requireAdminPermission('jobs.manage'), async (req, res) => {
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
jobRouter.delete('/permanent/:id', requireAdminPermission('jobs.manage'), async (req, res) => {
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
          const recipientUserId = String(existing.submittedByUserId);
          const recipient = await UserRepository.getByIdAsync(recipientUserId);
          if (recipient) {
            const body = `Your job posting "${existing.title}" has been permanently removed by administration.`;
            const stableEventId = `notif-job-perm-delete-${id}`;

            await NotificationRepository.createAsync({
              userId: recipientUserId,
              title: 'Job Posting Removed',
              message: body,
              type: 'alert',
              channel: 'in-app',
              eventId: stableEventId,
              idempotencyKey: stableEventId,
              metadata: { jobId: id, jobTitle: existing.title }
            }, 'System - Job Moderation');
            notificationSent = true;
          }
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
jobRouter.post('/bulk-update-location', requireAdminPermission('jobs.manage'), async (req, res) => {
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
jobRouter.post('/bulk-mark-non-job', requireAdminPermission('jobs.manage'), async (req, res) => {
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
jobRouter.post('/convert-to-job', requireAdminPermission('jobs.manage'), async (req, res) => {
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

// 17. Admin Universal Job List (Live + Pending) for Central Visibility Management
jobRouter.get('/admin/all', requireAdminPermission('jobs.manage'), async (req, res) => {
  try {
    const livePage = Math.max(1, parseInt(String(req.query.livePage || req.query.page || '1'), 10));
    const pendingPage = Math.max(1, parseInt(String(req.query.pendingPage || req.query.page || '1'), 10));
    const rawLimit = parseInt(String(req.query.limit || '100'), 10) || 100;
    const limit = Math.min(500, Math.max(1, rawLimit));

    const status = String(req.query.status || 'All');
    const source = String(req.query.source || 'All');
    const owner = String(req.query.owner || '');
    const scraper = String(req.query.scraper || '');
    const search = String(req.query.search || '');
    const visibility = String(req.query.visibility || 'All');

    let liveJobs: any[] = [];
    let liveTotal = 0;
    let liveHasMore = false;

    let pendingJobs: any[] = [];
    let pendingTotal = 0;
    let pendingHasMore = false;

    if (status === 'All' || status === 'Approved' || status === 'Expired') {
      const liveRes = await JobRepository.getAll({
        page: livePage,
        limit,
        status: status !== 'All' ? status : undefined,
        includeExpired: status === 'All' || status === 'Expired',
        sourceType: source !== 'All' ? source : undefined,
        submittedByUserId: owner || undefined,
        scraperSourceId: scraper || undefined,
        search: search || undefined,
        visibility: visibility !== 'All' ? visibility : undefined
      });
      liveJobs = liveRes.jobs || [];
      liveTotal = liveRes.total || 0;
      liveHasMore = (livePage * limit) < liveTotal;
    }

    if (status === 'All' || status === 'Pending') {
      const pendingRes = await JobRepository.getPending({
        page: pendingPage,
        limit,
        sourceType: source !== 'All' ? source : undefined,
        submittedByUserId: owner || undefined,
        scraperSourceId: scraper || undefined,
        search: search || undefined,
        visibility: visibility !== 'All' ? visibility : undefined
      });
      pendingJobs = Array.isArray(pendingRes) ? pendingRes : ((pendingRes as any).pendingJobs || []);
      pendingTotal = (pendingRes as any).total ?? pendingJobs.length;
      pendingHasMore = (pendingPage * limit) < pendingTotal;
    }

    const combined = [
      ...liveJobs.map((j: any) => ({ ...j, _isAdminView: true })),
      ...pendingJobs.map((j: any) => ({ ...j, _isAdminView: true, status: j.status || 'Pending' }))
    ];

    const hasMore = liveHasMore || pendingHasMore;

    res.json({
      success: true,
      jobs: combined,
      count: combined.length,
      liveTotal,
      pendingTotal,
      total: liveTotal + pendingTotal,
      livePage,
      pendingPage,
      liveHasMore,
      pendingHasMore,
      hasMore,
      limit
    });
  } catch (err: any) {
    console.error('Error in GET /api/jobs/admin/all:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch universal job list for administration.' });
  }
});


