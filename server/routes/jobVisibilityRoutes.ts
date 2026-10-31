import { Router } from 'express';
import { JobVisibilityRepository, FieldVisibility, JobSourceType } from '../db/repositories/JobVisibilityRepository';
import { requireAdminPermission } from '../auth/authManager';
import { AuditRepository, JobRepository } from '../db/repositories';

export const jobVisibilityRouter = Router();

const ALLOWED_FIELDS = [
  'title', 'company', 'companyLogo', 'jobType', 'region', 'country', 'province',
  'city', 'district', 'salary', 'salaryNumericMin', 'currency', 'experienceLevel', 
  'department', 'tags', 'description', 'requirements', 'responsibilities', 
  'benefits', 'postedAt', 'featured', 'urgent', 'isPinnedTop', 'isFutureJob', 
  'futureIntakeDate', 'priorityTier', 'applicationsCount', 'status', 
  'rejectionReason', 'suspensionReason', 'isSuspended', 'submittedByUserId', 
  'paymentStatus', 'jobCategory', 'sourceUrl', 'scraperSourceId', 'scraperSourceName', 
  'scrapedSourceDomain', 'scrapedAt', 'scrapedTime', 'applicationUrl', 
  'contactEmailOrPhone', 'contactEmail', 'deadlineDate', 'scraperBatchId', 'scraperRunType', 
  'scrapedTimezone', 'scrapedRawSalary', 'deduplicationScore', 'reviewTimeline', 
  'lastScrapedAt', 'isGovtJob', 'govtDepartment', 'govtScale', 'govtCategory', 
  'isNewspaperAd', 'newspaperName', 'clippingImageUrl', 'mediaUrl', 'newspaperDate', 
  'attachments', 'externalApplyUrl', 'pdfSourceUrl', 'extractedText', 'responsibilitiesList',
  'pdfFileName', 'pdfCaseNumber', 'pdfTotalVacanciesInCase', 'domicileQuota', 'challanFee',
  'ageRelaxationNote', 'pdfParserEngine', 'extractionSourceType', 'isDuplicate', 
  'duplicateScore', 'duplicateCategory', 'duplicateTags', 'duplicateMatchReason',
  'duplicateOfJobId', 'duplicateOfJobTitle', 'duplicateMatchedCompany', 'isDuplicateOverride',
  'duplicateOverrideNote', 'duplicateDetectedAt', 'applicationType', 'isLocationConfirmed',
  'locationConfirmedAt', 'isManuallyCorrected', 'manuallyCorrectedAt', 'metadata', 'createdAt', 'updatedAt'
];

const ALLOWED_VISIBILITIES = ['Free', 'Premium', 'Hidden'];
const ALLOWED_SOURCES = ['user_posted', 'scraped', 'admin_created'];

function validateFieldRules(rules: any) {
  if (!rules || typeof rules !== 'object') return 'fieldRules must be an object';
  for (const [field, visibility] of Object.entries(rules)) {
    if (!ALLOWED_FIELDS.includes(field)) return `Invalid field name: "${field}"`;
    if (!ALLOWED_VISIBILITIES.includes(visibility as string)) return `Invalid visibility value: "${visibility}" for field "${field}"`;
  }
  return null;
}

// 1. Get all policies (Admin)
jobVisibilityRouter.get('/policies', requireAdminPermission('settings.manage'), async (req, res) => {
  try {
    const policies = await JobVisibilityRepository.getAllPolicies();
    res.json({ success: true, policies });
  } catch (err: any) {
    console.error('Error fetching visibility policies:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch visibility policies from authoritative source.' });
  }
});

// 2. Save / Update a default policy (Admin)
jobVisibilityRouter.post('/policies', requireAdminPermission('settings.manage'), async (req, res) => {
  try {
    const { source, fieldRules, sourceKey } = req.body;
    if (!ALLOWED_SOURCES.includes(source)) {
      return res.status(400).json({ success: false, message: `Invalid source. Must be one of: ${ALLOWED_SOURCES.join(', ')}` });
    }

    const validationError = validateFieldRules(fieldRules);
    if (validationError) {
      return res.status(400).json({ success: false, message: validationError });
    }

    const saved = await JobVisibilityRepository.savePolicy(source as JobSourceType, fieldRules, sourceKey);
    AuditRepository.add({
      user: (req as any).user?.name || 'Administrator',
      role: 'Admin',
      action: 'Visibility Default Policy Updated',
      target: `Source: ${source}${sourceKey ? ` (${sourceKey})` : ''}`,
      status: 'Success'
    });

    res.json({ success: true, policy: saved, message: 'Visibility policy saved successfully.' });
  } catch (err: any) {
    console.error('Error saving visibility policy:', err);
    res.status(500).json({ success: false, message: 'Failed to persist visibility policy.' });
  }
});

// 3. Update Individual Job Visibility (Admin)
jobVisibilityRouter.patch('/jobs/:id/visibility', requireAdminPermission('jobs.manage'), async (req, res) => {
  try {
    const { id } = req.params;
    const { fieldVisibility } = req.body;

    const validationError = validateFieldRules(fieldVisibility);
    if (validationError) {
      return res.status(400).json({ success: false, message: validationError });
    }

    let job = await JobRepository.getById(id);
    if (!job) {
      job = (await JobRepository.getPending()).find(j => j.id === id);
    }

    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found in live or pending records.' });
    }

    const updated = await JobRepository.update(id, { fieldVisibility });
    AuditRepository.add({
      user: (req as any).user?.name || 'Administrator',
      role: 'Admin',
      action: 'Individual Job Visibility Updated',
      target: `Job: ${job.title} (${id})`,
      status: 'Success'
    });

    res.json({ success: true, job: updated, message: 'Job visibility updated successfully.' });
  } catch (err: any) {
    console.error('Error updating individual job visibility:', err);
    res.status(500).json({ success: false, message: 'Failed to update job visibility record.' });
  }
});

// 4. Bulk Update Job Visibility (Admin)
jobVisibilityRouter.post('/jobs/bulk-visibility', requireAdminPermission('jobs.manage'), async (req, res) => {
  try {
    const { jobIds, fieldVisibility, selectedFields } = req.body;
    if (!Array.isArray(jobIds) || jobIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Non-empty jobIds array is required.' });
    }

    if (jobIds.length > 500) {
      return res.status(400).json({ success: false, message: 'Maximum batch size is 500 jobs per request.' });
    }

    const validationError = validateFieldRules(fieldVisibility);
    if (validationError) {
      return res.status(400).json({ success: false, message: validationError });
    }

    if (selectedFields && (!Array.isArray(selectedFields) || selectedFields.some(f => !ALLOWED_FIELDS.includes(f)))) {
      return res.status(400).json({ success: false, message: 'Invalid selectedFields array provided.' });
    }

    const safeIds = jobIds.map(String);
    let successCount = 0;
    let failureCount = 0;
    const errors: { id: string; error: string }[] = [];

    for (const id of safeIds) {
      try {
        const job = await JobRepository.getById(id) || (await JobRepository.getPending()).find(j => j.id === id);
        if (job) {
          const currentRules = job.fieldVisibility || {};
          const mergedRules = { ...currentRules };
          
          if (Array.isArray(selectedFields) && selectedFields.length > 0) {
            for (const f of selectedFields) {
              if (fieldVisibility[f]) {
                mergedRules[f] = fieldVisibility[f];
              }
            }
          } else {
            Object.assign(mergedRules, fieldVisibility);
          }

          await JobRepository.update(id, { fieldVisibility: mergedRules });
          successCount++;
        } else {
          failureCount++;
          errors.push({ id, error: 'Job not found in live or pending queues.' });
        }
      } catch (err: any) {
        failureCount++;
        errors.push({ id, error: err?.message || 'Failed to update record.' });
      }
    }

    AuditRepository.add({
      user: (req as any).user?.name || 'Administrator',
      role: 'Admin',
      action: 'Bulk Job Visibility Updated',
      target: `${successCount} jobs updated successfully (${failureCount} failed)`,
      status: failureCount === 0 ? 'Success' : 'Warning'
    });

    res.json({
      success: failureCount === 0,
      successCount,
      failureCount,
      errors,
      message: `Successfully updated visibility for ${successCount} jobs.${failureCount > 0 ? ` (${failureCount} failed)` : ''}`
    });
  } catch (err: any) {
    console.error('Error in bulk visibility update:', err);
    res.status(500).json({ success: false, message: 'Failed to execute bulk visibility update.' });
  }
});
