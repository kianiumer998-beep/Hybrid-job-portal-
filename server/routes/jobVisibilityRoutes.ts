import { Router } from 'express';
import { JobVisibilityRepository, FieldVisibility, JobSourceType } from '../db/repositories/JobVisibilityRepository';
import { requireAdminPermission } from '../auth/authManager';
import { AuditRepository, JobRepository } from '../db/repositories';

export const jobVisibilityRouter = Router();

// 1. Get all policies (Admin)
jobVisibilityRouter.get('/policies', requireAdminPermission('settings.manage'), async (req, res) => {
  try {
    const policies = await JobVisibilityRepository.getAllPolicies();
    res.json({ success: true, policies });
  } catch (err: any) {
    console.error('Error fetching visibility policies:', err);
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch visibility policies.' });
  }
});

// 2. Save / Update a default policy (Admin)
jobVisibilityRouter.post('/policies', requireAdminPermission('settings.manage'), async (req, res) => {
  try {
    const { source, fieldRules, sourceKey } = req.body;
    if (!source || !fieldRules || typeof fieldRules !== 'object') {
      return res.status(400).json({ success: false, message: 'Valid source and fieldRules object are required.' });
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
    res.status(500).json({ success: false, message: err.message || 'Failed to save visibility policy.' });
  }
});

// 3. Update Individual Job Visibility (Admin)
jobVisibilityRouter.patch('/jobs/:id/visibility', requireAdminPermission('jobs.manage'), async (req, res) => {
  try {
    const { id } = req.params;
    const { fieldVisibility } = req.body;

    if (!fieldVisibility || typeof fieldVisibility !== 'object') {
      return res.status(400).json({ success: false, message: 'fieldVisibility object is required.' });
    }

    let job = await JobRepository.getById(id);
    let isLive = true;
    if (!job) {
      job = (await JobRepository.getPending()).find(j => j.id === id);
      isLive = false;
    }

    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found.' });
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
    res.status(500).json({ success: false, message: err.message || 'Failed to update job visibility.' });
  }
});

// 4. Bulk Update Job Visibility (Admin)
jobVisibilityRouter.post('/jobs/bulk-visibility', requireAdminPermission('jobs.manage'), async (req, res) => {
  try {
    const { jobIds, fieldVisibility, selectedFields } = req.body;
    if (!Array.isArray(jobIds) || jobIds.length === 0 || !fieldVisibility || typeof fieldVisibility !== 'object') {
      return res.status(400).json({ success: false, message: 'Valid jobIds array and fieldVisibility object are required.' });
    }

    let successCount = 0;
    let failureCount = 0;

    for (const id of jobIds) {
      try {
        const job = await JobRepository.getById(id) || (await JobRepository.getPending()).find(j => j.id === id);
        if (job) {
          const currentRules = job.fieldVisibility || {};
          const mergedRules = { ...currentRules };
          
          // If specific fields are targeted, update only those fields
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
        }
      } catch {
        failureCount++;
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
      success: true,
      successCount,
      failureCount,
      message: `Successfully updated visibility for ${successCount} jobs.`
    });
  } catch (err: any) {
    console.error('Error in bulk visibility update:', err);
    res.status(500).json({ success: false, message: err.message || 'Failed to execute bulk visibility update.' });
  }
});
