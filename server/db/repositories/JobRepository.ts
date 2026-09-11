import {
  getJobsCollection,
  getPendingJobsCollection,
  normalizeMongoJob,
  isMongoConfigured
} from '../mongodb';
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

function assertMongoAvailable() {
  if (!isMongoConfigured()) {
    throw new Error(
      'Database Configuration Error: MONGODB_URI environment variable is not defined or invalid. Production requires a valid MongoDB connection string.'
    );
  }
}

export class JobRepository {
  /**
   * Reads all approved / active jobs directly from MongoDB with filtering, sorting, and pagination.
   */
  static async getAll(filter: JobFilterOptions = {}): Promise<{ jobs: any[]; total: number; page: number; limit: number }> {
    assertMongoAvailable();
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

    // Dynamically check expiration on each retrieved document
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
  }

  /**
   * Get single job by ID directly from MongoDB.
   */
  static async getById(id: string): Promise<any | null> {
    assertMongoAvailable();
    const jobsColl = await getJobsCollection();
    const doc = await jobsColl.findOne({ id });
    if (!doc) return null;

    const normalized = normalizeMongoJob(doc);
    const isExpired = checkJobExpired(normalized);
    return {
      ...normalized,
      isExpired,
      status: isExpired ? 'Expired' : (normalized.status || 'Approved')
    };
  }

  /**
   * Get single job by SEO slug directly from MongoDB.
   */
  static async getBySlug(slug: string): Promise<any | null> {
    assertMongoAvailable();
    const jobsColl = await getJobsCollection();
    const doc = await jobsColl.findOne({ slug });
    if (!doc) return null;

    const normalized = normalizeMongoJob(doc);
    const isExpired = checkJobExpired(normalized);
    return {
      ...normalized,
      isExpired,
      status: isExpired ? 'Expired' : (normalized.status || 'Approved')
    };
  }

  /**
   * Creates a new live job directly in MongoDB.
   */
  static async create(jobData: any): Promise<any> {
    assertMongoAvailable();
    const jobsColl = await getJobsCollection();

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
    await jobsColl.updateOne({ id }, { $set: normalized }, { upsert: true });
    return normalized;
  }

  /**
   * Updates an existing job directly in MongoDB.
   */
  static async update(id: string, updates: any): Promise<any | null> {
    assertMongoAvailable();
    const jobsColl = await getJobsCollection();
    const pendingColl = await getPendingJobsCollection();

    // Prevent overriding MongoDB's immutable _id
    const safeUpdates = { ...updates };
    delete safeUpdates._id;
    safeUpdates.updatedAt = new Date().toISOString();

    const updatedLive = await jobsColl.findOneAndUpdate(
      { id },
      { $set: safeUpdates },
      { returnDocument: 'after' }
    );

    if (updatedLive) {
      return normalizeMongoJob(updatedLive);
    }

    // Fallback: check pending jobs collection
    const updatedPending = await pendingColl.findOneAndUpdate(
      { id },
      { $set: safeUpdates },
      { returnDocument: 'after' }
    );

    return updatedPending ? normalizeMongoJob(updatedPending) : null;
  }

  /**
   * Deletes a job from MongoDB (both live jobs and pending queue).
   */
  static async delete(id: string): Promise<boolean> {
    assertMongoAvailable();
    const jobsColl = await getJobsCollection();
    const pendingColl = await getPendingJobsCollection();

    const [delLive, delPending] = await Promise.all([
      jobsColl.deleteOne({ id }),
      pendingColl.deleteOne({ id })
    ]);

    return (delLive.deletedCount || 0) > 0 || (delPending.deletedCount || 0) > 0;
  }

  /**
   * Bulk add / ingest jobs directly into MongoDB.
   */
  static async createBatch(
    jobsList: any[],
    autoApprove: boolean = true
  ): Promise<{ inserted: number; updated: number; total: number }> {
    assertMongoAvailable();
    if (!Array.isArray(jobsList) || jobsList.length === 0) {
      const coll = autoApprove ? await getJobsCollection() : await getPendingJobsCollection();
      const count = await coll.countDocuments();
      return { inserted: 0, updated: 0, total: count };
    }

    const coll = autoApprove ? await getJobsCollection() : await getPendingJobsCollection();
    let inserted = 0;
    let updated = 0;
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
      const res = await coll.bulkWrite(operations, { ordered: false });
      inserted = res.upsertedCount || 0;
      updated = res.modifiedCount || 0;
    }

    const total = await coll.countDocuments();
    return { inserted, updated, total };
  }

  /**
   * Alias for createBatch(..., true).
   */
  static async bulkAdd(jobsList: any[], status: string = 'Approved') {
    return this.createBatch(jobsList, status === 'Approved');
  }

  /**
   * Bulk update multiple jobs in MongoDB.
   */
  static async bulkUpdate(jobsList: any[]): Promise<number> {
    assertMongoAvailable();
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
   * Bulk delete jobs by ID array directly from MongoDB.
   */
  static async bulkDelete(ids: string[]): Promise<number> {
    assertMongoAvailable();
    if (!Array.isArray(ids) || ids.length === 0) return 0;

    const jobsColl = await getJobsCollection();
    const pendingColl = await getPendingJobsCollection();

    const [resLive, resPending] = await Promise.all([
      jobsColl.deleteMany({ id: { $in: ids } }),
      pendingColl.deleteMany({ id: { $in: ids } })
    ]);

    return (resLive.deletedCount || 0) + (resPending.deletedCount || 0);
  }

  // --- PENDING QUEUE OPERATIONS (Direct MongoDB pending_jobs collection) ---

  /**
   * Retrieves pending scraper / user jobs directly from MongoDB pending_jobs.
   */
  static async getPending(): Promise<any[]> {
    assertMongoAvailable();
    const pendingColl = await getPendingJobsCollection();
    const docs = await pendingColl
      .find({ status: { $ne: 'Rejected' } })
      .sort({ createdAt: -1 })
      .toArray();

    return docs.map(normalizeMongoJob);
  }

  /**
   * Adds a job into MongoDB pending_jobs collection.
   */
  static async addPending(jobData: any): Promise<any> {
    assertMongoAvailable();
    const pendingColl = await getPendingJobsCollection();

    const id = jobData.id || generateJobId();
    const slug = jobData.slug || generateJobSlug(jobData.title, jobData.city, id);
    const now = new Date().toISOString();

    const newPending = normalizeMongoJob({
      ...jobData,
      id,
      slug,
      status: 'Pending',
      createdAt: jobData.createdAt || now,
      updatedAt: now,
      applicationsCount: 0
    });

    await pendingColl.updateOne({ id }, { $set: newPending }, { upsert: true });
    return newPending;
  }

  /**
   * Adds a batch of pending jobs directly into MongoDB pending_jobs.
   */
  static async addPendingBatch(jobsList: any[]): Promise<{ inserted: number; updated: number; total: number }> {
    return this.createBatch(jobsList, false);
  }

  /**
   * Atomically approves a pending job:
   * 1. Finds and removes the record from pending_jobs.
   * 2. Sets status to 'Approved' and inserts/upserts into live jobs.
   */
  static async approvePending(id: string): Promise<any | null> {
    assertMongoAvailable();
    const pendingColl = await getPendingJobsCollection();
    const jobsColl = await getJobsCollection();

    const pendingDoc = await pendingColl.findOneAndDelete({ id });
    if (!pendingDoc) {
      // Check if it was already in jobs
      const existing = await jobsColl.findOne({ id });
      if (existing) {
        const updated = await jobsColl.findOneAndUpdate(
          { id },
          { $set: { status: 'Approved', verifiedDate: new Date().toISOString() } },
          { returnDocument: 'after' }
        );
        return updated ? normalizeMongoJob(updated) : null;
      }
      return null;
    }

    const approvedJob = normalizeMongoJob({
      ...pendingDoc,
      status: 'Approved',
      verifiedDate: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    await jobsColl.updateOne({ id }, { $set: approvedJob }, { upsert: true });
    return approvedJob;
  }

  /**
   * Rejects a pending job in MongoDB.
   */
  static async rejectPending(id: string, reason?: string): Promise<boolean> {
    assertMongoAvailable();
    const pendingColl = await getPendingJobsCollection();

    const res = await pendingColl.updateOne(
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

    return res.matchedCount > 0;
  }

  /**
   * Bulk approves pending jobs:
   * Moves each from pending_jobs into jobs collection with status 'Approved'.
   * Returns exact success/failure counts and per-ID errors.
   */
  static async bulkApprovePending(ids: string[]): Promise<{
    successCount: number;
    failureCount: number;
    errors: { id: string; error: string }[];
    approvedJobs: any[];
  }> {
    assertMongoAvailable();
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
   * Bulk rejects pending jobs:
   * Sets status to 'Rejected' with timestamp and optional reason.
   * Returns exact success/failure counts and per-ID errors.
   */
  static async bulkRejectPending(ids: string[], reason?: string): Promise<{
    successCount: number;
    failureCount: number;
    errors: { id: string; error: string }[];
  }> {
    assertMongoAvailable();
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
   * Bulk deletes duplicate jobs directly from pending_jobs (and jobs if present).
   * Operates strictly on duplicate IDs (verifying isDuplicate === true) without touching originals.
   */
  static async bulkDeleteDuplicates(ids: string[]): Promise<{
    successCount: number;
    failureCount: number;
    errors: { id: string; error: string }[];
  }> {
    assertMongoAvailable();
    const pendingColl = await getPendingJobsCollection();
    let successCount = 0;
    const errors: { id: string; error: string }[] = [];

    for (const id of ids) {
      try {
        const doc = await pendingColl.findOne({ id });
        if (!doc) {
          errors.push({ id, error: `Duplicate job with ID "${id}" was not found in pending queue.` });
          continue;
        }

        const isDuplicate = Boolean(
          doc.isDuplicate === true ||
          doc.duplicateOfJobId ||
          doc.duplicateMatchedJob ||
          doc.duplicateWarning
        );

        if (!isDuplicate) {
          errors.push({ id, error: `Job "${id}" is not marked as a duplicate in MongoDB. Deletion blocked to preserve original.` });
          continue;
        }

        const res = await pendingColl.deleteOne({ id });
        if (res.deletedCount && res.deletedCount > 0) {
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
   * Keep Original + Delete Duplicates:
   * The original job remains active and untouched.
   * The selected duplicate jobs (verified isDuplicate === true) are deleted from MongoDB pending queue.
   * Never deletes original jobs.
   */
  static async keepOriginalAndDeleteDuplicates(duplicateIds: string[]): Promise<{
    successCount: number;
    failureCount: number;
    errors: { id: string; error: string }[];
  }> {
    assertMongoAvailable();
    const pendingColl = await getPendingJobsCollection();
    let successCount = 0;
    const errors: { id: string; error: string }[] = [];

    for (const dupId of duplicateIds) {
      try {
        const dupDoc = await pendingColl.findOne({ id: dupId });
        if (!dupDoc) {
          errors.push({ id: dupId, error: `Duplicate job "${dupId}" was not found in pending queue.` });
          continue;
        }

        const isDuplicate = Boolean(
          dupDoc.isDuplicate === true ||
          dupDoc.duplicateOfJobId ||
          dupDoc.duplicateMatchedJob ||
          dupDoc.duplicateWarning
        );

        if (!isDuplicate) {
          errors.push({ id: dupId, error: `Job "${dupId}" is not verified as a duplicate in MongoDB. Operation blocked to protect original.` });
          continue;
        }

        const originalId = dupDoc.duplicateOfJobId || dupDoc.duplicateMatchedJob?.id;
        if (originalId && originalId === dupId) {
          errors.push({ id: dupId, error: `Target duplicate ID is identical to original ID (${dupId}). Operation blocked to preserve original.` });
          continue;
        }

        // Delete duplicate record only. Original is untouched and preserved.
        const delRes = await pendingColl.deleteOne({ id: dupId });
        if (delRes.deletedCount && delRes.deletedCount > 0) {
          successCount++;
        } else {
          errors.push({ id: dupId, error: `Failed to remove duplicate job "${dupId}".` });
        }
      } catch (err: any) {
        errors.push({ id: dupId, error: err.message || `Error preserving original and deleting duplicate "${dupId}".` });
      }
    }

    return {
      successCount,
      failureCount: errors.length,
      errors
    };
  }

  /**
   * Overwrite Original:
   * Selected duplicate's content replaces the original job's content in the live jobs collection.
   * Original's unique ID and creation metadata are preserved.
   * The duplicate is then deleted from the pending queue.
   * Never deletes the original.
   */
  static async overwriteOriginalWithDuplicates(duplicateIds: string[]): Promise<{
    successCount: number;
    failureCount: number;
    errors: { id: string; error: string }[];
  }> {
    assertMongoAvailable();
    const pendingColl = await getPendingJobsCollection();
    const jobsColl = await getJobsCollection();
    let successCount = 0;
    const errors: { id: string; error: string }[] = [];

    for (const dupId of duplicateIds) {
      try {
        const dupDoc = await pendingColl.findOne({ id: dupId });
        if (!dupDoc) {
          errors.push({ id: dupId, error: `Duplicate job "${dupId}" was not found in pending queue.` });
          continue;
        }

        const isDuplicate = Boolean(
          dupDoc.isDuplicate === true ||
          dupDoc.duplicateOfJobId ||
          dupDoc.duplicateMatchedJob ||
          dupDoc.duplicateWarning
        );

        if (!isDuplicate) {
          errors.push({ id: dupId, error: `Job "${dupId}" is not a duplicate. Cannot overwrite original.` });
          continue;
        }

        const originalId = dupDoc.duplicateOfJobId || dupDoc.duplicateMatchedJob?.id;
        if (!originalId) {
          errors.push({ id: dupId, error: `No original job linked to duplicate "${dupId}". Cannot overwrite.` });
          continue;
        }

        if (originalId === dupId) {
          errors.push({ id: dupId, error: `Duplicate ID and original ID are identical (${dupId}). Operation aborted.` });
          continue;
        }

        const originalDoc = await jobsColl.findOne({ id: originalId });
        if (!originalDoc) {
          errors.push({ id: dupId, error: `Linked original job "${originalId}" was not found in live listings.` });
          continue;
        }

        const now = new Date().toISOString();
        const {
          _id,
          id: _ignoredId,
          createdAt: _ignoredCreatedAt,
          applicationsCount: _ignoredAppsCount,
          isDuplicate: _ignoredDup,
          duplicateOfJobId: _ignoredDupOf,
          duplicateMatchedJob: _ignoredMatchedJob,
          ...replacementData
        } = dupDoc;

        const updatedOriginal = {
          ...originalDoc,
          ...replacementData,
          id: originalId, // Always keep original ID
          createdAt: originalDoc.createdAt || now,
          updatedAt: now,
          status: 'Approved',
          verifiedDate: now,
          isDuplicate: false
        };
        delete updatedOriginal._id;

        // Atomically replace the original doc with updated data
        await jobsColl.replaceOne({ id: originalId }, updatedOriginal);

        // Delete duplicate from pending queue
        await pendingColl.deleteOne({ id: dupId });
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
