import { Router } from 'express';
import { Database, generateJobSlug } from '../db/database';
import { detectJobDuplicate, mergeJobRecords } from '../services/duplicateEngine';
import { requireAdmin } from '../auth/authManager';

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

    let jobs = Database.getJobs().filter(j => j.status === 'Approved' || (!j.status && !j.isSuspended));

    // Filter by text search
    if (search && search.trim()) {
      const q = search.toLowerCase().trim();
      jobs = jobs.filter(j => 
        (j.title && j.title.toLowerCase().includes(q)) ||
        (j.company && j.company.toLowerCase().includes(q)) ||
        (j.department && j.department.toLowerCase().includes(q)) ||
        (j.description && j.description.toLowerCase().includes(q)) ||
        (j.tags && j.tags.some((t: string) => t.toLowerCase().includes(q)))
      );
    }

    // Filter by jobType
    if (jobType && jobType !== 'All') {
      jobs = jobs.filter(j => j.jobType === jobType);
    }

    // Filter by region
    if (region && region !== 'All') {
      jobs = jobs.filter(j => j.region === region);
    }

    // Filter by province
    if (province && province !== 'All') {
      jobs = jobs.filter(j => j.province === province);
    }

    // Filter by city
    if (city && city !== 'All') {
      jobs = jobs.filter(j => j.city === city);
    }

    // Filter by experience level
    if (experienceLevel && experienceLevel !== 'All') {
      jobs = jobs.filter(j => j.experienceLevel === experienceLevel);
    }

    // Filter by minimum salary
    if (salaryMin && Number(salaryMin) > 0) {
      const minVal = Number(salaryMin);
      jobs = jobs.filter(j => (j.salaryNumericMin || 0) >= minVal);
    }

    // Filter by Government flag
    if (isGovt === 'true') {
      jobs = jobs.filter(j => j.isGovtJob);
    }

    // Filter by Urgent / Featured
    if (isUrgent === 'true') {
      jobs = jobs.filter(j => j.urgent);
    }
    if (isFeatured === 'true') {
      jobs = jobs.filter(j => j.featured || j.isPinnedTop);
    }

    // Sort order
    if (sortBy === 'salary-high') {
      jobs.sort((a, b) => (b.salaryNumericMin || 0) - (a.salaryNumericMin || 0));
    } else if (sortBy === 'salary-low') {
      jobs.sort((a, b) => (a.salaryNumericMin || 0) - (b.salaryNumericMin || 0));
    } else if (sortBy === 'popular') {
      jobs.sort((a, b) => (b.applicationsCount || 0) - (a.applicationsCount || 0));
    } else {
      // Default: Pinned first, then latest
      jobs.sort((a, b) => {
        if (a.isPinnedTop && !b.isPinnedTop) return -1;
        if (!a.isPinnedTop && b.isPinnedTop) return 1;
        return (new Date(b.createdAt || 0).getTime()) - (new Date(a.createdAt || 0).getTime());
      });
    }

    const total = jobs.length;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const paginated = jobs.slice((pageNum - 1) * limitNum, pageNum * limitNum);

    res.json({
      success: true,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
      jobs: paginated
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error fetching jobs' });
  }
});

// 2. Get Single Job by ID
jobRouter.get('/:id', (req, res) => {
  const job = Database.getJobById(req.params.id);
  if (!job) {
    return res.status(404).json({ success: false, message: 'Job posting not found.' });
  }
  res.json({ success: true, job });
});

// 3. Get Single Job by SEO Slug
jobRouter.get('/slug/:slug', (req, res) => {
  const job = Database.getJobBySlug(req.params.slug);
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

    // Check duplicate
    const existing = Database.getJobs();
    const dupCheck = detectJobDuplicate(jobData, existing);

    const newJob = Database.addJob({
      ...jobData,
      slug: generateJobSlug(jobData.title, jobData.city, jobData.id),
      isDuplicate: dupCheck.isDuplicate,
      duplicateScore: dupCheck.confidence,
      duplicateMatchReason: dupCheck.reason
    });

    Database.addAuditLog({
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
    const updated = Database.updateJob(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Job not found.' });
    }
    Database.addAuditLog({
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
  const deleted = Database.deleteJob(req.params.id);
  if (!deleted) {
    return res.status(404).json({ success: false, message: 'Job not found.' });
  }
  Database.addAuditLog({
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
  const pending = Database.getPendingJobs();
  res.json({ success: true, pendingJobs: pending });
});

// 8. Approve Pending Job
jobRouter.post('/queue/pending/:id/approve', requireAdmin, (req, res) => {
  const approved = Database.approvePendingJob(req.params.id);
  if (!approved) {
    return res.status(404).json({ success: false, message: 'Pending job not found.' });
  }
  Database.addAuditLog({
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
  const rejected = Database.rejectPendingJob(req.params.id, req.body.reason);
  if (!rejected) {
    return res.status(404).json({ success: false, message: 'Pending job not found.' });
  }
  Database.addAuditLog({
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
  const existing = Database.getJobs();
  const pending = Database.getPendingJobs();
  const result = detectJobDuplicate(candidateJob, [...existing, ...pending]);
  res.json({ success: true, result });
});

// 11. Intelligent Merge of Duplicates
jobRouter.post('/merge', requireAdmin, (req, res) => {
  const { primaryJobId, secondaryJobId } = req.body;
  const primary = Database.getJobById(primaryJobId) || Database.getPendingJobs().find(j => j.id === primaryJobId);
  const secondary = Database.getJobById(secondaryJobId) || Database.getPendingJobs().find(j => j.id === secondaryJobId);

  if (!primary || !secondary) {
    return res.status(400).json({ success: false, message: 'Both primary and secondary jobs must exist to merge.' });
  }

  const merged = mergeJobRecords(primary, secondary);
  Database.updateJob(primaryJobId, merged);

  // If secondary was in pending or live, mark/remove as merged
  Database.deleteJob(secondaryJobId);
  const remainingPending = Database.getPendingJobs().filter(j => j.id !== secondaryJobId);
  Database.savePendingJobs(remainingPending);

  Database.addAuditLog({
    user: 'Administrator',
    role: 'Admin',
    action: 'Jobs Merged Intelligently',
    target: `Merged ${secondary.title} into ${primary.title}`,
    status: 'Success'
  });

  res.json({ success: true, job: merged, message: 'Jobs merged successfully with preserved metadata!' });
});
