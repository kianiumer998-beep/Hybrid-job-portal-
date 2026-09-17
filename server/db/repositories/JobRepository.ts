import {
  getJobsCollection,
  getPendingJobsCollection,
  normalizeMongoJob,
  isMongoConfigured,
  withMongoTimeout,
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
  lightweight?: boolean;
}

export interface PendingJobOptions {
  limit?: number;
  page?: number;
  status?: string;
  search?: string;
  lightweight?: boolean;
}

export function checkJobExpired(job: any): boolean {
  if (!job) return false;
  if (job.status === 'Expired' || job.isExpired === true) {
    return true;
  }
  const deadlineStr = job.deadline || job.deadlineDate || job.closingDeadline;
  if (!deadlineStr) return false;

  const deadlineTime = new Date(deadlineStr).getTime();
  if (isNaN(deadlineTime)) return false;

  return deadlineTime < Date.now();
}

function generateJobId(): string {
  return `job-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
}

function filterLocalJobs(jobs: any[], filter: JobFilterOptions = {}): any[] {
  let list = Array.isArray(jobs) ? [...jobs] : [];

  if (!filter.includeExpired) {
    list = list.filter((j) => {
      if (checkJobExpired(j)) return false;
      const st = j.status || 'Approved';
      return st === 'Approved';
    });
  }

  if (filter.search && filter.search.trim()) {
    const q = filter.search.trim().toLowerCase();
    list = list.filter(
      (j) =>
        (j.title && j.title.toLowerCase().includes(q)) ||
        (j.company && j.company.toLowerCase().includes(q)) ||
        (j.city && j.city.toLowerCase().includes(q)) ||
        (j.department && j.department.toLowerCase().includes(q))
    );
  }

  if (filter.jobType && filter.jobType !== 'All') {
    list = list.filter((j) => j.jobType === filter.jobType);
  }
  if (filter.region && filter.region !== 'All') {
    list = list.filter((j) => j.region === filter.region);
  }
  if (filter.province && filter.province !== 'All') {
    list = list.filter((j) => j.province === filter.province);
  }
  if (filter.city && filter.city !== 'All') {
    list = list.filter((j) => j.city === filter.city);
  }
  if (filter.isGovt) {
    list = list.filter((j) => j.isGovtJob);
  }
  if (filter.isUrgent) {
    list = list.filter((j) => j.urgent);
  }
  if (filter.isFeatured) {
    list = list.filter((j) => j.featured || j.isPinnedTop);
  }

  return list;
}

export class JobRepository {
  /**
   * Reads all approved / active jobs directly from MongoDB with filtering, sorting, and pagination.
   * Gracefully falls back to local database on network timeout or connection error.
   */
  static async getAll(filter: JobFilterOptions = {}): Promise<{ jobs: any[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, filter.page || 1);
    const limit = Math.min(2000, Math.max(1, filter.limit || 500));
    const skip = (page - 1) * limit;

    if (isMongoConfigured()) {
      try {
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

        const mongoPromise = (async () => {
          const total = await jobsColl.countDocuments(query);
          const cursor = jobsColl.find(query, { projection: { extractedText: 0 } }).sort(sort).skip(skip).limit(limit);
          const rawDocs = await cursor.toArray();
          return { total, rawDocs };
        })();

        const { total, rawDocs } = await withMongoTimeout(mongoPromise, 8000, 'getAll');

        const jobs = rawDocs.map((doc) => {
          const normalized = normalizeMongoJob(doc);
          const isExpired = checkJobExpired(normalized);
          return {
            ...normalized,
            isExpired,
            status: isExpired ? 'Expired' : (normalized.status || 'Approved')
          };
        });

        // Warm local fallback cache in the background
        if (page === 1 && !filter.search && jobs.length > 0) {
          try {
            Database.saveJobs(jobs);
          } catch {}
        }

        return { jobs, total, page, limit };
      } catch (err: any) {
        console.warn(`[JobRepository] MongoDB error in getAll (${err?.message || err}). Serving from local fallback.`);
        resetMongoClient(err);
      }
    }

    // Local JSON Database Fallback
    const allLocal = Database.getJobs();
    const filtered = filterLocalJobs(allLocal, filter);
    const paginated = filtered.slice(skip, skip + limit);
    return {
      jobs: paginated,
      total: filtered.length,
      page,
      limit
    };
  }

  /**
   * Get single job by ID with fallback.
   */
  static async getById(id: string): Promise<any | null> {
    if (isMongoConfigured()) {
      try {
        const jobsColl = await getJobsCollection();
        const doc = await withMongoTimeout(jobsColl.findOne({ id }), 5000, 'getById');
        if (doc) {
          const normalized = normalizeMongoJob(doc);
          const isExpired = checkJobExpired(normalized);
          return {
            ...normalized,
            isExpired,
            status: isExpired ? 'Expired' : (normalized.status || 'Approved')
          };
        }
      } catch (err: any) {
        console.warn(`[JobRepository] MongoDB error in getById for ${id}:`, err?.message);
        resetMongoClient(err);
      }
    }

    return Database.getJobById(id);
  }

  /**
   * Get single job by SEO slug with fallback.
   */
  static async getBySlug(slug: string): Promise<any | null> {
    if (isMongoConfigured()) {
      try {
        const jobsColl = await getJobsCollection();
        const doc = await withMongoTimeout(jobsColl.findOne({ slug }), 5000, 'getBySlug');
        if (doc) {
          const normalized = normalizeMongoJob(doc);
          const isExpired = checkJobExpired(normalized);
          return {
            ...normalized,
            isExpired,
            status: isExpired ? 'Expired' : (normalized.status || 'Approved')
          };
        }
      } catch (err: any) {
        console.warn(`[JobRepository] MongoDB error in getBySlug for ${slug}:`, err?.message);
        resetMongoClient(err);
      }
    }

    return Database.getJobBySlug(slug);
  }

  /**
   * Creates a new live job directly in MongoDB and mirrors to local backup.
   */
  static async create(jobData: any): Promise<any> {
    const id = jobData.id || generateJobId();
    const slug = jobData.slug || generateJobSlug(jobData.title, jobData.city, id);
    const now = new Date().toISOString();

    const newJob: any = {
      ...jobData,
      id,
      slug,
      status: jobData.status || 'Approved',
      createdAt: jobData.createdAt || now,
      updatedAt: now,
      applicationsCount: typeof jobData.applicationsCount === 'number' ? jobData.applicationsCount : 0
    };

    const normalized = normalizeMongoJob(newJob);

    // Save locally
    try {
      Database.addJob(normalized);
    } catch {}

    if (isMongoConfigured()) {
      try {
        const jobsColl = await getJobsCollection();
        await withMongoTimeout(jobsColl.updateOne({ id }, { $set: normalized }, { upsert: true }), 8000, 'create');
      } catch (err: any) {
        console.warn(`[JobRepository] MongoDB error creating job ${id}:`, err?.message);
        resetMongoClient(err);
      }
    }

    return normalized;
  }

  /**
   * Updates an existing job directly in MongoDB and mirrors to local backup.
   */
  static async update(id: string, updates: any): Promise<any | null> {
    const safeUpdates = { ...updates };
    delete safeUpdates._id;
    safeUpdates.updatedAt = new Date().toISOString();

    // Mirror locally
    let localUpdated: any = null;
    try {
      localUpdated = Database.updateJob(id, safeUpdates);
    } catch {}

    if (isMongoConfigured()) {
      try {
        const jobsColl = await getJobsCollection();
        const pendingColl = await getPendingJobsCollection();

        const updatedLive = await withMongoTimeout(
          jobsColl.findOneAndUpdate({ id }, { $set: safeUpdates }, { returnDocument: 'after' }),
          8000,
          'update'
        );

        if (updatedLive) {
          return normalizeMongoJob(updatedLive);
        }

        const updatedPending = await withMongoTimeout(
          pendingColl.findOneAndUpdate({ id }, { $set: safeUpdates }, { returnDocument: 'after' }),
          8000,
          'updatePending'
        );

        if (updatedPending) {
          return normalizeMongoJob(updatedPending);
        }
      } catch (err: any) {
        console.warn(`[JobRepository] MongoDB error updating job ${id}:`, err?.message);
        resetMongoClient(err);
      }
    }

    return localUpdated;
  }

  /**
   * Deletes a job from MongoDB and local backup.
   */
  static async delete(id: string): Promise<boolean> {
    let localDeleted = false;
    try {
      localDeleted = Database.deleteJob(id);
    } catch {}

    if (isMongoConfigured()) {
      try {
        const jobsColl = await getJobsCollection();
        const pendingColl = await getPendingJobsCollection();

        const [delLive, delPending] = await withMongoTimeout(
          Promise.all([jobsColl.deleteOne({ id }), pendingColl.deleteOne({ id })]),
          8000,
          'delete'
        );

        return (delLive.deletedCount || 0) > 0 || (delPending.deletedCount || 0) > 0 || localDeleted;
      } catch (err: any) {
        console.warn(`[JobRepository] MongoDB error deleting job ${id}:`, err?.message);
        resetMongoClient(err);
      }
    }

    return localDeleted;
  }

  /**
   * Bulk add / ingest jobs directly into MongoDB and local backup.
   */
  static async createBatch(
    jobsList: any[],
    autoApprove = true
  ): Promise<{ inserted: number; updated: number; total: number }> {
    if (!Array.isArray(jobsList) || jobsList.length === 0) {
      return { inserted: 0, updated: 0, total: 0 };
    }

    // Mirror locally
    let localRes = { inserted: 0, updated: 0, total: 0 };
    try {
      localRes = autoApprove
        ? Database.addJobsBatch(jobsList, autoApprove)
        : Database.addPendingJobsBatch(jobsList);
    } catch {}

    if (isMongoConfigured()) {
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
          const res = await withMongoTimeout(coll.bulkWrite(operations, { ordered: false }), 12000, 'createBatch');
          const total = await coll.countDocuments();
          return {
            inserted: res.upsertedCount || 0,
            updated: res.modifiedCount || 0,
            total
          };
        }
      } catch (err: any) {
        console.warn('[JobRepository] MongoDB error in createBatch:', err?.message);
        resetMongoClient(err);
      }
    }

    return localRes;
  }

  /**
   * Alias for createBatch(..., true).
   */
  static async bulkAdd(jobsList: any[], status = 'Approved') {
    return this.createBatch(jobsList, status === 'Approved');
  }

  /**
   * Bulk update multiple jobs.
   */
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

  /**
   * Bulk delete jobs by ID array.
   */
  static async bulkDelete(ids: string[]): Promise<number> {
    if (!Array.isArray(ids) || ids.length === 0) return 0;

    let localCount = 0;
    for (const id of ids) {
      if (Database.deleteJob(id)) localCount++;
    }

    if (isMongoConfigured()) {
      try {
        const jobsColl = await getJobsCollection();
        const pendingColl = await getPendingJobsCollection();

        const [resLive, resPending] = await withMongoTimeout(
          Promise.all([
            jobsColl.deleteMany({ id: { $in: ids } }),
            pendingColl.deleteMany({ id: { $in: ids } })
          ]),
          8000,
          'bulkDelete'
        );

        return (resLive.deletedCount || 0) + (resPending.deletedCount || 0);
      } catch (err: any) {
        console.warn('[JobRepository] MongoDB error in bulkDelete:', err?.message);
        resetMongoClient(err);
      }
    }

    return localCount;
  }

  // --- PENDING QUEUE OPERATIONS ---

  /**
   * Retrieves pending scraper / user jobs with limits, projection, and fallback.
   */
  static async getPending(options: PendingJobOptions = {}): Promise<any[]> {
    const limit = Math.min(1000, Math.max(1, options.limit || 300));
    const page = Math.max(1, options.page || 1);
    const skip = (page - 1) * limit;

    if (isMongoConfigured()) {
      try {
        const pendingColl = await getPendingJobsCollection();
        const query: any = {};

        if (options.status) {
          query.status = options.status;
        } else {
          query.status = { $ne: 'Rejected' };
        }

        if (options.search && options.search.trim()) {
          const q = options.search.trim();
          const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
          query.$or = [{ title: regex }, { company: regex }, { city: regex }];
        }

        const projection = options.lightweight
          ? {
              id: 1,
              title: 1,
              company: 1,
              department: 1,
              city: 1,
              region: 1,
              salary: 1,
              sourceUrl: 1,
              sourceJobId: 1,
              deadlineDate: 1,
              isGovtJob: 1,
              status: 1,
              createdAt: 1,
              isDuplicate: 1,
              duplicateOfJobId: 1
            }
          : { extractedText: 0 };

        const mongoPromise = pendingColl
          .find(query, { projection })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .toArray();

        const docs = await withMongoTimeout(mongoPromise, 8000, 'getPending');
        const results = docs.map(normalizeMongoJob);

        // Keep local pending backup fresh in background
        if (page === 1 && !options.search && results.length > 0) {
          try {
            Database.savePendingJobs(results);
          } catch {}
        }

        return results;
      } catch (err: any) {
        console.warn(`[JobRepository] MongoDB error in getPending (${err?.message || err}). Serving local fallback.`);
        resetMongoClient(err);
      }
    }

    // Local fallback
    const local = Database.getPendingJobs();
    let filtered = local.filter((j) => j.status !== 'Rejected');
    if (options.status) {
      filtered = filtered.filter((j) => j.status === options.status);
    }
    if (options.search && options.search.trim()) {
      const q = options.search.trim().toLowerCase();
      filtered = filtered.filter(
        (j) =>
          (j.title && j.title.toLowerCase().includes(q)) ||
          (j.company && j.company.toLowerCase().includes(q))
      );
    }
    return filtered.slice(skip, skip + limit);
  }

  /**
   * Adds a job into pending_jobs and local fallback.
   */
  static async addPending(jobData: any): Promise<any> {
    const id = jobData.id || generateJobId();
    const slug = jobData.slug || generateJobSlug(jobData.title, jobData.city, id);
    const now = new Date().toISOString();

    const newPending = normalizeMongoJob({
      ...jobData,
      id,
      slug,
      status: jobData.status || 'Pending',
      createdAt: jobData.createdAt || now,
      updatedAt: now,
      applicationsCount: 0
    });

    // Mirror locally
    try {
      Database.addPendingJob(newPending);
    } catch {}

    if (isMongoConfigured()) {
      try {
        const pendingColl = await getPendingJobsCollection();
        await withMongoTimeout(
          pendingColl.updateOne({ id }, { $set: newPending }, { upsert: true }),
          8000,
          'addPending'
        );
      } catch (err: any) {
        console.warn(`[JobRepository] MongoDB error adding pending job ${id}:`, err?.message);
        resetMongoClient(err);
      }
    }

    return newPending;
  }

  /**
   * Adds a batch of pending jobs directly into MongoDB pending_jobs.
   */
  static async addPendingBatch(jobsList: any[]): Promise<{ inserted: number; updated: number; total: number }> {
    return this.createBatch(jobsList, false);
  }

  /**
   * Atomically approves a pending job.
   */
  static async approvePending(id: string): Promise<any | null> {
    let localApproved: any = null;
    try {
      localApproved = Database.approvePendingJob(id);
    } catch {}

    if (isMongoConfigured()) {
      try {
        const pendingColl = await getPendingJobsCollection();
        const jobsColl = await getJobsCollection();

        const pendingDoc = await withMongoTimeout(pendingColl.findOneAndDelete({ id }), 8000, 'approvePendingFind');
        if (!pendingDoc) {
          const existing = await jobsColl.findOne({ id });
          if (existing) {
            const updated = await jobsColl.findOneAndUpdate(
              { id },
              { $set: { status: 'Approved', verifiedDate: new Date().toISOString() } },
              { returnDocument: 'after' }
            );
            return updated ? normalizeMongoJob(updated) : localApproved;
          }
          return localApproved;
        }

        const approvedJob = normalizeMongoJob({
          ...pendingDoc,
          status: 'Approved',
          verifiedDate: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });

        await withMongoTimeout(jobsColl.updateOne({ id }, { $set: approvedJob }, { upsert: true }), 8000, 'approvePendingInsert');
        return approvedJob;
      } catch (err: any) {
        console.warn(`[JobRepository] MongoDB error approving pending job ${id}:`, err?.message);
        resetMongoClient(err);
      }
    }

    return localApproved;
  }

  /**
   * Rejects a pending job.
   */
  static async rejectPending(id: string, reason?: string): Promise<boolean> {
    let localRejected = false;
    try {
      localRejected = Database.rejectPendingJob(id, reason);
    } catch {}

    if (isMongoConfigured()) {
      try {
        const pendingColl = await getPendingJobsCollection();
        const res = await withMongoTimeout(
          pendingColl.updateOne(
            { id },
            {
              $set: {
                status: 'Rejected',
                rejectionReason: reason || 'Rejected by administrator',
                rejectedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              }
            }
          ),
          8000,
          'rejectPending'
        );
        return res.matchedCount > 0 || localRejected;
      } catch (err: any) {
        console.warn(`[JobRepository] MongoDB error rejecting pending job ${id}:`, err?.message);
        resetMongoClient(err);
      }
    }

    return localRejected;
  }

  /**
   * Bulk approves pending jobs.
   */
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
          errors.push({ id, error: `Pending job with ID "${id}" could not be found or processed.` });
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

  /**
   * Bulk rejects pending jobs.
   */
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

  /**
   * Bulk deletes duplicate jobs directly from pending queue.
   */
  static async bulkDeleteDuplicates(ids: string[]): Promise<{
    successCount: number;
    failureCount: number;
    errors: { id: string; error: string }[];
  }> {
    let successCount = 0;
    const errors: { id: string; error: string }[] = [];

    for (const id of ids) {
      try {
        let deleted = false;
        if (isMongoConfigured()) {
          try {
            const pendingColl = await getPendingJobsCollection();
            const doc = await withMongoTimeout(pendingColl.findOne({ id }), 5000, 'findDuplicate');
            if (doc) {
              const res = await withMongoTimeout(pendingColl.deleteOne({ id }), 5000, 'deleteDuplicate');
              if (res.deletedCount && res.deletedCount > 0) {
                deleted = true;
              }
            }
          } catch (mErr: any) {
            resetMongoClient(mErr);
          }
        }

        try {
          if (Database.deleteJob(id)) {
            deleted = true;
          }
        } catch {}

        if (deleted) {
          successCount++;
        } else {
          errors.push({ id, error: `Failed to delete duplicate job "${id}".` });
        }
      } catch (err: any) {
        errors.push({ id, error: err.message || `Failed to delete duplicate job "${id}".` });
      }
    }

    return {
      successCount,
      failureCount: errors.length,
      errors
    };
  }

  /**
   * Keep Original + Delete Duplicates.
   */
  static async keepOriginalAndDeleteDuplicates(duplicateIds: string[]): Promise<{
    successCount: number;
    failureCount: number;
    errors: { id: string; error: string }[];
  }> {
    return this.bulkDeleteDuplicates(duplicateIds);
  }

  /**
   * Overwrite Original:
   * Selected duplicate's content replaces the original job's content in the live jobs.
   */
  static async overwriteOriginalWithDuplicates(duplicateIds: string[]): Promise<{
    successCount: number;
    failureCount: number;
    errors: { id: string; error: string }[];
  }> {
    let successCount = 0;
    const errors: { id: string; error: string }[] = [];

    for (const dupId of duplicateIds) {
      try {
        let dupDoc: any = null;
        if (isMongoConfigured()) {
          try {
            const pendingColl = await getPendingJobsCollection();
            dupDoc = await withMongoTimeout(pendingColl.findOne({ id: dupId }), 5000, 'findDupDoc');
          } catch (mErr: any) {
            resetMongoClient(mErr);
          }
        }

        if (!dupDoc) {
          dupDoc = Database.getPendingJobs().find((j) => j.id === dupId);
        }

        if (!dupDoc) {
          errors.push({ id: dupId, error: `Duplicate job "${dupId}" was not found in pending queue.` });
          continue;
        }

        const originalId = dupDoc.duplicateOfJobId || dupDoc.duplicateMatchedJob?.id;
        if (!originalId || originalId === dupId) {
          errors.push({ id: dupId, error: `Invalid original ID link for duplicate "${dupId}".` });
          continue;
        }

        // Apply overwrite to live
        const replacement = { ...dupDoc, id: originalId, status: 'Approved', isDuplicate: false };
        await this.update(originalId, replacement);
        await this.delete(dupId);
        successCount++;
      } catch (err: any) {
        errors.push({ id: dupId, error: err.message || `Error overwriting original with duplicate "${dupId}".` });
      }
    }

    return {
      successCount,
      failureCount: errors.length,
      errors
    };
  }
}
