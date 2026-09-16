import {
  getJobsCollection,
  getPendingJobsCollection,
  normalizeMongoJob,
  isMongoConfigured,
  executeWithFallback,
  resetMongoClient
} from '../mongodb';
import { Database } from '../database';
import { generateJobSlug } from '../../utils/slugify';

export interface JobFilterOptions {
  search?: string;
  jobType?: string;
  region?: string;
  province?: string;
  city?: string;
  experienceLevel?: string;
  salaryMin?: number;
  sortBy?: string;
  isGovt?: boolean;
  isUrgent?: boolean;
  isFeatured?: boolean;
  page?: number;
  limit?: number;
  includeExpired?: boolean;
}

export function parseDeadlineTimestamp(deadlineStr?: string): number | null {
  if (!deadlineStr || typeof deadlineStr !== 'string') return null;
  const clean = deadlineStr.trim();
  if (!clean) return null;

  // Try standard ISO / JS date parsing
  let ts = new Date(clean).getTime();
  if (!isNaN(ts)) return ts;

  // Try parsing formats like DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = clean.match(/^(\d{1,2})[-\/\.](\d{1,2})[-\/\.](\d{4})$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    const year = parseInt(dmyMatch[3], 10);
    const parsed = new Date(year, month, day, 23, 59, 59).getTime();
    if (!isNaN(parsed)) return parsed;
  }

  // Try DD Mon YYYY e.g. "15 Oct 2025" or "15-Oct-2025"
  const textDateMatch = clean.match(/^(\d{1,2})[-\s]([A-Za-z]{3,9})[-\s](\d{4})/);
  if (textDateMatch) {
    const parsed = new Date(clean).getTime();
    if (!isNaN(parsed)) return parsed;
  }

  return null;
}

export function checkJobExpired(job: any, offsetDays: number = 1): boolean {
  if (!job) return false;
  if (job.status === 'Expired' || job.isExpired === true) {
    return true;
  }
  const deadlineStr = job.deadlineDate || job.deadline || job.closingDeadline;
  if (!deadlineStr) return false;

  const deadlineTime = parseDeadlineTimestamp(deadlineStr);
  if (!deadlineTime) return false;

  // Portal expiry = deadline + (offsetDays * 24h)
  // Offset is ONLY for removing from LIVE portal, never modifies source deadline
  const safeOffsetDays = Math.max(0, Math.min(2, offsetDays));
  const portalExpiryTime = deadlineTime + (safeOffsetDays * 24 * 60 * 60 * 1000);

  return Date.now() > portalExpiryTime;
}

function generateJobId(): string {
  return `job-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
}

function queryLocalJobs(filter: JobFilterOptions = {}): { jobs: any[]; total: number; page: number; limit: number } {
  let list = Database.getJobs().filter(j => !j.isSuspended);

  if (!filter.includeExpired) {
    list = list.filter(j => (j.status === 'Approved' || !j.status) && j.isExpired !== true);
  } else {
    list = list.filter(j => j.status === 'Approved' || j.status === 'Expired' || !j.status);
  }

  if (filter.search && filter.search.trim()) {
    const q = filter.search.toLowerCase().trim();
    list = list.filter(j =>
      (j.title && j.title.toLowerCase().includes(q)) ||
      (j.company && j.company.toLowerCase().includes(q)) ||
      (j.department && j.department.toLowerCase().includes(q)) ||
      (j.description && j.description.toLowerCase().includes(q)) ||
      (j.city && j.city.toLowerCase().includes(q)) ||
      (Array.isArray(j.tags) && j.tags.some((t: string) => t.toLowerCase().includes(q)))
    );
  }

  if (filter.jobType && filter.jobType !== 'All') {
    list = list.filter(j => j.jobType === filter.jobType);
  }

  if (filter.region && filter.region !== 'All') {
    list = list.filter(j => j.region === filter.region);
  }

  if (filter.province && filter.province !== 'All') {
    list = list.filter(j => j.province === filter.province);
  }

  if (filter.city && filter.city !== 'All') {
    list = list.filter(j => j.city === filter.city);
  }

  if (filter.experienceLevel && filter.experienceLevel !== 'All') {
    list = list.filter(j => j.experienceLevel === filter.experienceLevel);
  }

  if (filter.salaryMin && filter.salaryMin > 0) {
    list = list.filter(j => (j.salaryNumericMin || 0) >= filter.salaryMin!);
  }

  if (filter.isGovt) {
    list = list.filter(j => j.isGovtJob === true);
  }

  if (filter.isUrgent) {
    list = list.filter(j => j.urgent === true);
  }

  if (filter.isFeatured) {
    list = list.filter(j => j.featured === true || j.isPinnedTop === true);
  }

  // Sort
  if (filter.sortBy === 'salary-high') {
    list.sort((a, b) => (b.salaryNumericMin || 0) - (a.salaryNumericMin || 0));
  } else if (filter.sortBy === 'salary-low') {
    list.sort((a, b) => (a.salaryNumericMin || 0) - (b.salaryNumericMin || 0));
  } else if (filter.sortBy === 'popular') {
    list.sort((a, b) => (b.applicationsCount || 0) - (a.applicationsCount || 0));
  } else if (filter.sortBy === 'oldest') {
    list.sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
  } else {
    // Default newest with pinned top first
    list.sort((a, b) => {
      if (a.isPinnedTop && !b.isPinnedTop) return -1;
      if (!a.isPinnedTop && b.isPinnedTop) return 1;
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });
  }

  const total = list.length;
  const page = Math.max(1, filter.page || 1);
  const limit = Math.min(10000, Math.max(1, filter.limit || 5000));
  const skip = (page - 1) * limit;
  const paged = list.slice(skip, skip + limit).map(doc => {
    const normalized = normalizeMongoJob(doc);
    const isExpired = checkJobExpired(normalized);
    return {
      ...normalized,
      isExpired,
      status: isExpired ? 'Expired' : (normalized.status || 'Approved')
    };
  });

  return { jobs: paged, total, page, limit };
}

export class JobRepository {
  /**
   * Reads all approved / active jobs directly with filtering, sorting, and pagination.
   */
  static async getAll(filter: JobFilterOptions = {}): Promise<{ jobs: any[]; total: number; page: number; limit: number }> {
    return executeWithFallback(
      async () => {
        const jobsColl = await getJobsCollection();

        const query: any = {
          isSuspended: { $ne: true }
        };

        if (!filter.includeExpired) {
          query.$and = [
            {
              $or: [
                { status: 'Approved' },
                { status: { $exists: false } }
              ]
            },
            {
              $or: [
                { isExpired: { $ne: true } },
                { isExpired: { $exists: false } }
              ]
            }
          ];
        } else {
          query.$or = [
            { status: 'Approved' },
            { status: 'Expired' },
            { status: { $exists: false } }
          ];
        }

        if (filter.search && filter.search.trim()) {
          const q = filter.search.trim();
          const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const regex = new RegExp(escaped, 'i');
          const searchOr = [
            { title: regex },
            { company: regex },
            { department: regex },
            { description: regex },
            { tags: regex },
            { city: regex }
          ];
          if (query.$and) {
            query.$and.push({ $or: searchOr });
          } else {
            query.$and = [{ $or: searchOr }];
          }
        }

        if (filter.jobType && filter.jobType !== 'All') {
          query.jobType = filter.jobType;
        }

        if (filter.region && filter.region !== 'All') {
          query.region = filter.region;
        }

        if (filter.province && filter.province !== 'All') {
          query.province = filter.province;
        }

        if (filter.city && filter.city !== 'All') {
          query.city = filter.city;
        }

        if (filter.experienceLevel && filter.experienceLevel !== 'All') {
          query.experienceLevel = filter.experienceLevel;
        }

        if (filter.salaryMin && filter.salaryMin > 0) {
          query.salaryNumericMin = { $gte: filter.salaryMin };
        }

        if (filter.isGovt) {
          query.isGovtJob = true;
        }

        if (filter.isUrgent) {
          query.urgent = true;
        }

        if (filter.isFeatured) {
          const featuredOr = [{ featured: true }, { isPinnedTop: true }];
          if (query.$and) {
            query.$and.push({ $or: featuredOr });
          } else {
            query.$and = [{ $or: featuredOr }];
          }
        }

        // Determine sort
        let sort: any = { isPinnedTop: -1, createdAt: -1 };
        if (filter.sortBy === 'salary-high') {
          sort = { salaryNumericMin: -1, createdAt: -1 };
        } else if (filter.sortBy === 'salary-low') {
          sort = { salaryNumericMin: 1, createdAt: -1 };
        } else if (filter.sortBy === 'popular') {
          sort = { applicationsCount: -1, createdAt: -1 };
        } else if (filter.sortBy === 'oldest') {
          sort = { createdAt: 1 };
        }

        const page = Math.max(1, filter.page || 1);
        const limit = Math.min(10000, Math.max(1, filter.limit || 5000));
        const skip = (page - 1) * limit;

        const total = await jobsColl.countDocuments(query);
        const cursor = jobsColl.find(query).sort(sort).skip(skip).limit(limit);
        const rawDocs = await cursor.toArray();

        const jobs = rawDocs.map((doc) => {
          const normalized = normalizeMongoJob(doc);
          const isExpired = checkJobExpired(normalized);
          return {
            ...normalized,
            isExpired,
            status: isExpired ? 'Expired' : (normalized.status || 'Approved')
          };
        });

        return { jobs, total, page, limit };
      },
      () => queryLocalJobs(filter),
      'JobRepository.getAll'
    );
  }

  /**
   * Get single job by ID.
   */
  static async getById(id: string): Promise<any | null> {
    return executeWithFallback(
      async () => {
        const jobsColl = await getJobsCollection();
        const doc = await jobsColl.findOne({ id });
        if (!doc) {
          return Database.getJobById(id);
        }

        const normalized = normalizeMongoJob(doc);
        const isExpired = checkJobExpired(normalized);
        return {
          ...normalized,
          isExpired,
          status: isExpired ? 'Expired' : (normalized.status || 'Approved')
        };
      },
      () => Database.getJobById(id),
      'JobRepository.getById'
    );
  }

  /**
   * Get single job by SEO slug.
   */
  static async getBySlug(slug: string): Promise<any | null> {
    return executeWithFallback(
      async () => {
        const jobsColl = await getJobsCollection();
        const doc = await jobsColl.findOne({ slug });
        if (!doc) {
          return Database.getJobBySlug(slug);
        }

        const normalized = normalizeMongoJob(doc);
        const isExpired = checkJobExpired(normalized);
        return {
          ...normalized,
          isExpired,
          status: isExpired ? 'Expired' : (normalized.status || 'Approved')
        };
      },
      () => Database.getJobBySlug(slug),
      'JobRepository.getBySlug'
    );
  }

  /**
   * Creates a new live job.
   */
  static async create(jobData: any): Promise<any> {
    const localJob = Database.addJob(jobData);
    if (isMongoConfigured()) {
      try {
        const jobsColl = await getJobsCollection();
        const normalized = normalizeMongoJob(localJob);
        await jobsColl.updateOne({ id: normalized.id }, { $set: normalized }, { upsert: true });
      } catch (err: any) {
        console.warn('[JobRepository] Notice writing job to MongoDB:', err.message);
      }
    }
    return localJob;
  }

  /**
   * Updates an existing job.
   */
  static async update(id: string, updates: any): Promise<any | null> {
    const localUpdated = Database.updateJob(id, updates);
    if (isMongoConfigured()) {
      try {
        const jobsColl = await getJobsCollection();
        const pendingColl = await getPendingJobsCollection();
        const safeUpdates = { ...updates };
        delete safeUpdates._id;
        safeUpdates.updatedAt = new Date().toISOString();

        await Promise.all([
          jobsColl.updateOne({ id }, { $set: safeUpdates }),
          pendingColl.updateOne({ id }, { $set: safeUpdates })
        ]);
      } catch (err: any) {
        console.warn('[JobRepository] Notice updating job in MongoDB:', err.message);
      }
    }
    return localUpdated;
  }

  /**
   * Deletes a job (both live jobs and pending queue).
   */
  static async delete(id: string): Promise<boolean> {
    const localDeleted = Database.deleteJob(id);
    if (isMongoConfigured()) {
      try {
        const jobsColl = await getJobsCollection();
        const pendingColl = await getPendingJobsCollection();
        await Promise.all([
          jobsColl.deleteOne({ id }),
          pendingColl.deleteOne({ id })
        ]);
      } catch (err: any) {
        console.warn('[JobRepository] Notice deleting job from MongoDB:', err.message);
      }
    }
    return localDeleted;
  }

  /**
   * Bulk add / ingest jobs.
   */
  static async createBatch(
    jobsList: any[],
    autoApprove: boolean = true
  ): Promise<{ inserted: number; updated: number; total: number }> {
    const localRes = autoApprove
      ? Database.addJobsBatch(jobsList, autoApprove)
      : Database.addPendingJobsBatch(jobsList);

    if (isMongoConfigured() && Array.isArray(jobsList) && jobsList.length > 0) {
      try {
        const coll = autoApprove ? await getJobsCollection() : await getPendingJobsCollection();
        const now = new Date().toISOString();
        const operations = jobsList
          .filter((j) => j && j.title)
          .map((j) => {
            const id = j.id || generateJobId();
            const slug = j.slug || generateJobSlug(j.title, j.city, id);
            const doc = normalizeMongoJob({
              ...j,
              id,
              slug,
              status: autoApprove ? 'Approved' : 'Pending',
              createdAt: j.createdAt || now,
              updatedAt: now
            });
            return {
              updateOne: {
                filter: { id },
                update: { $set: doc },
                upsert: true
              }
            };
          });

        if (operations.length > 0) {
          await coll.bulkWrite(operations, { ordered: false });
        }
      } catch (err: any) {
        console.warn('[JobRepository] Notice bulk batch in MongoDB:', err.message);
      }
    }

    return localRes;
  }

  static async bulkAdd(jobsList: any[], status: string = 'Approved') {
    return this.createBatch(jobsList, status === 'Approved');
  }

  static async bulkUpdate(jobsList: any[]): Promise<number> {
    if (!Array.isArray(jobsList) || jobsList.length === 0) return 0;
    let count = 0;
    for (const j of jobsList) {
      if (j && j.id) {
        const updated = await this.update(j.id, j);
        if (updated) count++;
      }
    }
    return count;
  }

  static async bulkDelete(ids: string[]): Promise<number> {
    if (!Array.isArray(ids) || ids.length === 0) return 0;
    let count = 0;
    for (const id of ids) {
      if (Database.deleteJob(id)) count++;
    }

    if (isMongoConfigured()) {
      try {
        const jobsColl = await getJobsCollection();
        const pendingColl = await getPendingJobsCollection();
        await Promise.all([
          jobsColl.deleteMany({ id: { $in: ids } }),
          pendingColl.deleteMany({ id: { $in: ids } })
        ]);
      } catch (err: any) {
        console.warn('[JobRepository] Notice bulk deleting in MongoDB:', err.message);
      }
    }

    return count;
  }

  // --- PENDING QUEUE OPERATIONS ---

  /**
   * Retrieves pending scraper / user jobs safely without timing out.
   */
  static async getPending(): Promise<any[]> {
    return executeWithFallback(
      async () => {
        const pendingColl = await getPendingJobsCollection();
        const docs = await pendingColl
          .find({ status: { $ne: 'Rejected' } })
          .sort({ createdAt: -1 })
          .toArray();

        if (docs && docs.length > 0) {
          return docs.map(normalizeMongoJob);
        }
        return Database.getPendingJobs().filter(p => p.status !== 'Rejected');
      },
      () => Database.getPendingJobs().filter(p => p.status !== 'Rejected'),
      'JobRepository.getPending'
    );
  }

  /**
   * Adds a job into pending_jobs collection.
   */
  static async addPending(jobData: any): Promise<any> {
    const localPending = Database.addPendingJob(jobData);
    if (isMongoConfigured()) {
      try {
        const pendingColl = await getPendingJobsCollection();
        const normalized = normalizeMongoJob(localPending);
        await pendingColl.updateOne({ id: normalized.id }, { $set: normalized }, { upsert: true });
      } catch (err: any) {
        console.warn('[JobRepository] Notice adding pending job to MongoDB:', err.message);
      }
    }
    return localPending;
  }

  static async addPendingBatch(jobsList: any[]): Promise<{ inserted: number; updated: number; total: number }> {
    return this.createBatch(jobsList, false);
  }

  /**
   * Atomically approves a pending job.
   */
  static async approvePending(id: string): Promise<any | null> {
    const approved = Database.approvePendingJob(id);
    if (isMongoConfigured()) {
      try {
        const pendingColl = await getPendingJobsCollection();
        const jobsColl = await getJobsCollection();
        const pendingDoc = await pendingColl.findOneAndDelete({ id });
        if (pendingDoc || approved) {
          const toSave = normalizeMongoJob({
            ...(pendingDoc || approved),
            status: 'Approved',
            verifiedDate: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
          await jobsColl.updateOne({ id }, { $set: toSave }, { upsert: true });
        }
      } catch (err: any) {
        console.warn('[JobRepository] Notice approving pending job in MongoDB:', err.message);
      }
    }
    return approved;
  }

  /**
   * Rejects a pending job.
   */
  static async rejectPending(id: string, reason?: string): Promise<boolean> {
    const localRejected = Database.rejectPendingJob(id, reason);
    if (isMongoConfigured()) {
      try {
        const pendingColl = await getPendingJobsCollection();
        await pendingColl.updateOne(
          { id },
          {
            $set: {
              status: 'Rejected',
              rejectionReason: reason || 'Rejected by administrator',
              rejectedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }
          }
        );
      } catch (err: any) {
        console.warn('[JobRepository] Notice rejecting pending job in MongoDB:', err.message);
      }
    }
    return localRejected;
  }

  static async bulkApprovePending(ids: string[]): Promise<{
    successCount: number;
    failureCount: number;
    errors: { id: string; error: string }[];
    approvedJobs: any[];
  }> {
    const approvedJobs: any[] = [];
    const errors: { id: string; error: string }[] = [];

    for (const id of ids) {
      try {
        const approved = await this.approvePending(id);
        if (approved) {
          approvedJobs.push(approved);
        } else {
          errors.push({ id, error: `Pending job with ID "${id}" could not be found.` });
        }
      } catch (err: any) {
        errors.push({ id, error: err.message || `Error approving job "${id}".` });
      }
    }

    return {
      successCount: approvedJobs.length,
      failureCount: errors.length,
      errors,
      approvedJobs
    };
  }

  static async bulkRejectPending(ids: string[], reason?: string): Promise<{
    successCount: number;
    failureCount: number;
    errors: { id: string; error: string }[];
  }> {
    let successCount = 0;
    const errors: { id: string; error: string }[] = [];

    for (const id of ids) {
      try {
        const rejected = await this.rejectPending(id, reason);
        if (rejected) {
          successCount++;
        } else {
          errors.push({ id, error: `Pending job with ID "${id}" could not be found or marked rejected.` });
        }
      } catch (err: any) {
        errors.push({ id, error: err.message || `Error rejecting job "${id}".` });
      }
    }

    return {
      successCount,
      failureCount: errors.length,
      errors
    };
  }

  static async bulkDeleteDuplicates(ids: string[]): Promise<{
    successCount: number;
    failureCount: number;
    errors: { id: string; error: string }[];
  }> {
    let successCount = 0;
    const errors: { id: string; error: string }[] = [];

    for (const id of ids) {
      try {
        Database.deleteJob(id);
        successCount++;
      } catch (err: any) {
        errors.push({ id, error: err.message || `Failed to delete duplicate job "${id}".` });
      }
    }

    if (isMongoConfigured()) {
      try {
        const pendingColl = await getPendingJobsCollection();
        await pendingColl.deleteMany({ id: { $in: ids } });
      } catch (err: any) {
        console.warn('[JobRepository] Notice bulk deleting duplicates in MongoDB:', err.message);
      }
    }

    return {
      successCount,
      failureCount: errors.length,
      errors
    };
  }

  static async keepOriginalAndDeleteDuplicates(duplicateIds: string[]): Promise<{
    successCount: number;
    failureCount: number;
    errors: { id: string; error: string }[];
  }> {
    return this.bulkDeleteDuplicates(duplicateIds);
  }

  static async overwriteOriginalWithDuplicates(duplicateIds: string[]): Promise<{
    successCount: number;
    failureCount: number;
    errors: { id: string; error: string }[];
  }> {
    return this.bulkApprovePending(duplicateIds);
  }

  static async scanAndExpireDueJobs(offsetDays: number = 1): Promise<{ expiredCount: number; expiredJobIds: string[] }> {
    const jobs = Database.getJobs();
    const expiredJobIds: string[] = [];
    const safeOffsetDays = Math.max(0, Math.min(2, offsetDays));

    for (const job of jobs) {
      if (job.status === 'Approved' && checkJobExpired(job, safeOffsetDays)) {
        job.status = 'Expired';
        job.isExpired = true;
        job.expiredAt = new Date().toISOString();
        expiredJobIds.push(job.id);
      }
    }

    if (expiredJobIds.length > 0) {
      Database.saveJobs(jobs);
    }

    if (isMongoConfigured() && expiredJobIds.length > 0) {
      try {
        const jobsColl = await getJobsCollection();
        await jobsColl.updateMany(
          { id: { $in: expiredJobIds } },
          {
            $set: {
              status: 'Expired',
              isExpired: true,
              expiredAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }
          }
        );
      } catch (err: any) {
        console.warn('[JobRepository] Notice expiring jobs in MongoDB:', err.message);
      }
    }

    return {
      expiredCount: expiredJobIds.length,
      expiredJobIds
    };
  }

  static async restoreJobToLive(id: string): Promise<any | null> {
    const updated = Database.updateJob(id, { status: 'Approved', isExpired: false });
    if (isMongoConfigured()) {
      try {
        const jobsColl = await getJobsCollection();
        await jobsColl.updateOne(
          { id },
          {
            $set: {
              status: 'Approved',
              isExpired: false,
              restoredAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            },
            $unset: { expiredAt: '' }
          }
        );
      } catch (err: any) {
        console.warn('[JobRepository] Notice restoring job in MongoDB:', err.message);
      }
    }
    return updated;
  }

  static async bulkRestoreJobs(ids: string[]): Promise<number> {
    let count = 0;
    for (const id of ids) {
      if (Database.updateJob(id, { status: 'Approved', isExpired: false })) {
        count++;
      }
    }
    if (isMongoConfigured()) {
      try {
        const jobsColl = await getJobsCollection();
        await jobsColl.updateMany(
          { id: { $in: ids } },
          {
            $set: {
              status: 'Approved',
              isExpired: false,
              restoredAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            },
            $unset: { expiredAt: '' }
          }
        );
      } catch (err: any) {
        console.warn('[JobRepository] Notice bulk restoring jobs in MongoDB:', err.message);
      }
    }
    return count;
  }

  static async deleteJobPermanently(id: string): Promise<boolean> {
    return this.delete(id);
  }

  static async bulkUpdateLocation(
    jobIds: string[],
    locationData: { region?: string; province?: string; city?: string; district?: string }
  ): Promise<{ successCount: number; errors: any[] }> {
    if (!Array.isArray(jobIds) || jobIds.length === 0) {
      return { successCount: 0, errors: [] };
    }

    let modified = 0;
    for (const id of jobIds) {
      const updated = Database.updateJob(id, locationData);
      if (updated) modified++;
    }

    if (isMongoConfigured()) {
      try {
        const jobsColl = await getJobsCollection();
        const pendingColl = await getPendingJobsCollection();
        const updateFields: any = { ...locationData, updatedAt: new Date().toISOString() };
        await Promise.all([
          jobsColl.updateMany({ id: { $in: jobIds } }, { $set: updateFields }),
          pendingColl.updateMany({ id: { $in: jobIds } }, { $set: updateFields })
        ]);
      } catch (err: any) {
        console.warn('[JobRepository] Notice bulk updating location in MongoDB:', err.message);
      }
    }

    return {
      successCount: modified,
      errors: []
    };
  }
}

