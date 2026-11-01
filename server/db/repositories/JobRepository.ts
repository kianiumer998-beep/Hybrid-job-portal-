import path from 'path';
import {
  getJobsCollection,
  getPendingJobsCollection,
  normalizeMongoJob,
  isMongoConfigured,
  executeWithMongoRetry,
  withMongoTimeout
} from '../mongodb';
import { Database } from '../database';
import { generateJobSlug } from '../../utils/slugify';
import { JobVisibilityRepository } from './JobVisibilityRepository';

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
  sourceType?: string;
  submittedByUserId?: string;
  scraperSourceId?: string;
  status?: string;
  visibility?: string;
}

export function parseDeadlineTimestamp(deadlineStr?: string): number | null {
  if (!deadlineStr || typeof deadlineStr !== 'string') return null;
  const clean = deadlineStr.trim();
  if (!clean) return null;

  // Normalize ordinal suffixes (e.g. "22nd September 2026" -> "22 September 2026")
  const normalized = clean.replace(/(\d+)(st|nd|rd|th)/gi, '$1');

  // Try parsing formats like DD-MM-YYYY or DD/MM/YYYY first
  const dmyMatch = normalized.match(/^(\d{1,2})[-\/\.](\d{1,2})[-\/\.](\d{4})$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    const year = parseInt(dmyMatch[3], 10);

    // Validate actual calendar components strictly
    if (month < 0 || month > 11 || day < 1 || day > 31 || year < 1900 || year > 2100) {
      return null;
    }
    const testDate = new Date(year, month, day);
    if (
      testDate.getFullYear() !== year ||
      testDate.getMonth() !== month ||
      testDate.getDate() !== day
    ) {
      return null;
    }

    const parsed = new Date(year, month, day, 23, 59, 59).getTime();
    if (!isNaN(parsed)) return parsed;
  }

  // Try standard ISO / JS date parsing
  let ts = new Date(normalized).getTime();
  if (!isNaN(ts)) {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return null;
    return ts;
  }

  // Try DD Mon YYYY e.g. "15 Oct 2025" or "15-Oct-2025"
  const textDateMatch = normalized.match(/^(\d{1,2})[-\s]([A-Za-z]{3,9})[-\s](\d{4})/);
  if (textDateMatch) {
    const parsed = new Date(normalized).getTime();
    if (!isNaN(parsed)) return parsed;
  }

  return null;
}

export function checkJobExpired(job: any, offsetDays: number = 1): boolean {
  if (!job) return false;
  if (job.status === 'Expired' || job.isExpired === true) {
    return true;
  }
  // Admin restore protection: if job was explicitly restored to live, preserve restore status
  if (job.restoredAt && job.isExpired === false && (job.status === 'Approved' || !job.status)) {
    return false;
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

    const query: any = {
      isSuspended: { $ne: true }
    };

    if (filter.status === 'Expired') {
      const expiredClause = {
        $or: [
          { status: 'Expired' },
          { isExpired: true },
          { deadlineDate: { $exists: true, $nin: [null, ''] } },
          { deadline: { $exists: true, $nin: [null, ''] } },
          { closingDeadline: { $exists: true, $nin: [null, ''] } }
        ]
      };
      if (query.$and) {
        query.$and.push(expiredClause);
      } else {
        query.$and = [expiredClause];
      }
    } else if (filter.status === 'Approved' || !filter.includeExpired) {
      const approvedCandidateClause = {
        $or: [
          { status: 'Approved' },
          { status: { $exists: false } }
        ]
      };
      const notExplicitlyExpiredClause = {
        isExpired: { $ne: true }
      };
      if (query.$and) {
        query.$and.push(approvedCandidateClause, notExplicitlyExpiredClause);
      } else {
        query.$and = [approvedCandidateClause, notExplicitlyExpiredClause];
      }
    } else {
      const allStatusClause = {
        $or: [
          { status: 'Approved' },
          { status: 'Expired' },
          { status: { $exists: false } }
        ]
      };
      if (query.$and) {
        query.$and.push(allStatusClause);
      } else {
        query.$and = [allStatusClause];
      }
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

    if (filter.sourceType && filter.sourceType !== 'All') {
      if (filter.sourceType === 'user_posted') {
        const userCond = {
          $and: [
            { isScraped: { $ne: true } },
            { isAdminCreated: { $ne: true } },
            { sourceType: { $ne: 'admin_created' } }
          ]
        };
        if (query.$and) query.$and.push(userCond);
        else query.$and = [userCond];
      } else if (filter.sourceType === 'scraped') {
        const scrapedOr = [{ isScraped: true }, { sourceType: 'scraped' }, { scraperSourceId: { $exists: true, $ne: '' } }];
        if (query.$and) query.$and.push({ $or: scrapedOr });
        else query.$and = [{ $or: scrapedOr }];
      } else if (filter.sourceType === 'admin_created') {
        const adminOr = [{ isAdminCreated: true }, { sourceType: 'admin_created' }];
        if (query.$and) query.$and.push({ $or: adminOr });
        else query.$and = [{ $or: adminOr }];
      }
    }

    if (filter.submittedByUserId && filter.submittedByUserId.trim()) {
      const uRegex = new RegExp(filter.submittedByUserId.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.submittedByUserId = uRegex;
    }

    if (filter.scraperSourceId && filter.scraperSourceId.trim()) {
      const sRegex = new RegExp(filter.scraperSourceId.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.scraperSourceId = sRegex;
    }

    if (filter.visibility && filter.visibility !== 'All') {
      if (filter.visibility === 'Overrides') {
        const overridesClause = { fieldVisibility: { $exists: true, $nin: [null, {}] } };
        if (query.$and) query.$and.push(overridesClause);
        else query.$and = [overridesClause];
      } else if (filter.visibility === 'Default') {
        const defaultClause = {
          $or: [
            { fieldVisibility: { $exists: false } },
            { fieldVisibility: null },
            { fieldVisibility: {} }
          ]
        };
        if (query.$and) query.$and.push(defaultClause);
        else query.$and = [defaultClause];
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
    const limit = Math.min(1000, Math.max(1, filter.limit || 100));
    const skip = (page - 1) * limit;

    // In-memory test fallback
    if (process.env.IS_TEST === 'true') {
      const allJobs = Database.getJobs().map(normalizeMongoJob);
      const processedJobs = allJobs
        .filter((normalized) => {
          if (filter.status === 'Approved' && normalized.status !== 'Approved' && normalized.status) return false;
          if (filter.status === 'Expired' && normalized.status !== 'Expired') return false;
          if (filter.jobType && filter.jobType !== 'All' && normalized.jobType !== filter.jobType) return false;
          return true;
        })
        .map((normalized) => {
          const isExpired = checkJobExpired(normalized);
          return {
            ...normalized,
            isExpired,
            status: isExpired ? 'Expired' : (normalized.status || 'Approved')
          };
        })
        .filter((evaluated) => {
          let matchesStatus = true;
          if (filter.status === 'Expired') matchesStatus = evaluated.isExpired === true;
          else if (filter.status === 'Approved') matchesStatus = evaluated.isExpired !== true && (evaluated.status === 'Approved' || !evaluated.status);
          else if (!filter.includeExpired) matchesStatus = evaluated.isExpired !== true;
          return matchesStatus;
        });

      const total = processedJobs.length;
      const paginatedJobs = processedJobs.slice(skip, skip + limit);
      return { jobs: paginatedJobs, total, page, limit };
    }

    // Production path
    assertMongoAvailable();
    const jobsColl = await getJobsCollection();
    const cursor = jobsColl.find(query).sort(sort);

    let total = 0;
    const paginatedJobs: any[] = [];
    const BATCH_SIZE = 200;
    let processed = 0;
    let batch: any[];

    while (true) {
      const batchCursor = jobsColl.find(query).sort(sort).skip(processed).limit(BATCH_SIZE);
      batch = await batchCursor.toArray();
      if (batch.length === 0) break;
      processed += batch.length;

      for (const doc of batch) {
        const normalized = normalizeMongoJob(doc);
        const isExpired = checkJobExpired(normalized);
        const evaluated = {
          ...normalized,
          isExpired,
          status: isExpired ? 'Expired' : (normalized.status || 'Approved')
        };

        let matchesStatus = true;
        if (filter.status === 'Expired') matchesStatus = evaluated.isExpired === true;
        else if (filter.status === 'Approved') matchesStatus = evaluated.isExpired !== true && (evaluated.status === 'Approved' || !evaluated.status);
        else if (!filter.includeExpired) matchesStatus = evaluated.isExpired !== true;

        if (matchesStatus) {
          const currentIndex = total;
          total++;
          if (currentIndex >= skip && paginatedJobs.length < limit) {
            paginatedJobs.push(evaluated);
          }
        }
      }
      if (batch.length < BATCH_SIZE) break;
    }
    return { jobs: paginatedJobs, total, page, limit };
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
   * Helper to preserve admin confirmed or manually corrected location metadata
   * if the job in the database was already confirmed or corrected by an admin.
   */
  static applyLocationProtection(incomingDoc: any, existingDoc: any): any {
    if (!existingDoc) return incomingDoc;

    const isAlreadyProtected =
      existingDoc.isLocationConfirmed === true ||
      existingDoc.isLocationVerified === true ||
      existingDoc.isManuallyCorrected === true ||
      existingDoc.metadata?.isLocationConfirmed === true ||
      existingDoc.metadata?.isLocationVerified === true ||
      existingDoc.metadata?.isManuallyCorrected === true;

    if (!isAlreadyProtected) return incomingDoc;

    const isIncomingExplicitConfirmation =
      incomingDoc.isLocationConfirmed === true ||
      incomingDoc.isLocationVerified === true ||
      incomingDoc.isManuallyCorrected === true ||
      incomingDoc.metadata?.isLocationConfirmed === true ||
      incomingDoc.metadata?.isLocationVerified === true ||
      incomingDoc.metadata?.isManuallyCorrected === true;

    if (isIncomingExplicitConfirmation) {
      return incomingDoc;
    }

    return {
      ...incomingDoc,
      region: existingDoc.region || incomingDoc.region,
      country: existingDoc.country || incomingDoc.country || 'Pakistan',
      province: existingDoc.province || incomingDoc.province,
      city: existingDoc.city || incomingDoc.city,
      district: existingDoc.district || incomingDoc.district,
      isLocationConfirmed: existingDoc.isLocationConfirmed ?? true,
      locationConfirmedAt: existingDoc.locationConfirmedAt,
      isManuallyCorrected: existingDoc.isManuallyCorrected ?? true,
      manuallyCorrectedAt: existingDoc.manuallyCorrectedAt,
      metadata: {
        ...(incomingDoc.metadata || {}),
        ...(existingDoc.metadata || {}),
        isLocationConfirmed: existingDoc.metadata?.isLocationConfirmed ?? existingDoc.isLocationConfirmed ?? true,
        isManuallyCorrected: existingDoc.metadata?.isManuallyCorrected ?? existingDoc.isManuallyCorrected ?? true
      }
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

    const existingDoc = await jobsColl.findOne({ id });
    const rawCountry = typeof jobData.country === 'string' ? jobData.country.trim() : '';
    const resolvedCountry = rawCountry || (jobData.country === undefined || jobData.country === null || jobData.country === '' ? 'Pakistan' : jobData.country);

    let newJob: any = {
      ...jobData,
      id,
      slug,
      country: resolvedCountry,
      status: jobData.status || 'Approved',
      createdAt: jobData.createdAt || now,
      updatedAt: now,
      applicationsCount: typeof jobData.applicationsCount === 'number' ? jobData.applicationsCount : 0
    };

    if (existingDoc) {
      newJob = JobRepository.applyLocationProtection(newJob, existingDoc);
    }

    // Apply appropriate visibility policy based on derived source
    newJob = await JobVisibilityRepository.applyPolicyToJob(newJob);

    const normalized = normalizeMongoJob(newJob);
    await jobsColl.updateOne({ id }, { $set: normalized }, { upsert: true });
    return normalized;
  }

  /**
   * Updates an existing job directly in MongoDB.
   */
  static async update(id: string, updates: any): Promise<any | null> {
    if (!isMongoConfigured()) {
      const live = Database.getJobs().find((j: any) => j.id === id);
      if (live) return Database.updateJob(id, updates);
      const pending = Database.getPendingJobs().find((j: any) => j.id === id);
      if (pending) {
        const safe = { ...updates };
        if (safe.status === 'Approved' && pending.status !== 'Approved') {
          safe.status = pending.status || 'Pending';
        }
        const allPending = Database.getPendingJobs();
        const idx = allPending.findIndex((j: any) => j.id === id);
        if (idx !== -1) {
          allPending[idx] = { ...allPending[idx], ...safe, updatedAt: new Date().toISOString() };
          Database.savePendingJobs(allPending);
          return allPending[idx];
        }
      }
      return null;
    }
    assertMongoAvailable();
    const jobsColl = await getJobsCollection();
    const pendingColl = await getPendingJobsCollection();

    // Prevent overriding MongoDB's immutable _id
    let safeUpdates = { ...updates };
    delete safeUpdates._id;
    safeUpdates.updatedAt = new Date().toISOString();

    const existingLive = await jobsColl.findOne({ id });
    if (existingLive) {
      safeUpdates = JobRepository.applyLocationProtection(safeUpdates, existingLive);
      const updatedLive = await jobsColl.findOneAndUpdate(
        { id },
        { $set: safeUpdates },
        { returnDocument: 'after' }
      );
      if (updatedLive) {
        return normalizeMongoJob(updatedLive);
      }
    }

    // Fallback: check pending jobs collection
    const existingPending = await pendingColl.findOne({ id });
    if (existingPending) {
      safeUpdates = JobRepository.applyLocationProtection(safeUpdates, existingPending);
      // Safeguard: an ordinary update to a pending record must not set status to 'Approved'
      // in the pending collection, preventing orphaned approved records in pending queue.
      // Approval must flow through approvePending() to be published to the live jobs collection.
      if (safeUpdates.status === 'Approved' && existingPending.status !== 'Approved') {
        safeUpdates.status = existingPending.status || 'Pending';
      }
      const updatedPending = await pendingColl.findOneAndUpdate(
        { id },
        { $set: safeUpdates },
        { returnDocument: 'after' }
      );
      return updatedPending ? normalizeMongoJob(updatedPending) : null;
    }

    return null;
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

    const validJobs = jobsList.filter((j) => j && j.title);
    const existingIds = validJobs.map((j) => j.id).filter(Boolean);

    // Fetch existing documents for this batch only to protect confirmed/manual locations
    const existingDocsMap = new Map<string, any>();
    if (existingIds.length > 0) {
      const existingDocs = await coll.find({ id: { $in: existingIds } }).toArray();
      for (const doc of existingDocs) {
        if (doc && doc.id) {
          existingDocsMap.set(doc.id, doc);
        }
      }
    }

    const operations = validJobs.map((j) => {
      const id = j.id || generateJobId();
      const slug = j.slug || generateJobSlug(j.title, j.city, id);
      let rawDoc: any = {
        ...j,
        id,
        slug,
        status: autoApprove ? 'Approved' : 'Pending',
        createdAt: j.createdAt || now,
        updatedAt: now
      };

      const existingDoc = existingDocsMap.get(id);
      if (existingDoc) {
        rawDoc = JobRepository.applyLocationProtection(rawDoc, existingDoc);
      }

      const doc = normalizeMongoJob(rawDoc);

      return (async () => {
        // Apply visibility policy before writing
        const withVisibility = await JobVisibilityRepository.applyPolicyToJob(doc);
        return {
          updateOne: {
            filter: { id },
            update: { $set: withVisibility },
            upsert: true
          }
        };
      })();
    });

    if (operations.length > 0) {
      const resolvedOps = await Promise.all(operations);
      const res = await coll.bulkWrite(resolvedOps, { ordered: false });
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
  static async getPending(filter?: { page?: number; limit?: number; lightweight?: boolean; search?: string; sourceType?: string; submittedByUserId?: string; scraperSourceId?: string; visibility?: string }): Promise<any[]> {
    if (!isMongoConfigured()) {
      const fallback = Database.getPendingJobs();
      Object.defineProperty(fallback, 'total', { value: fallback.length, enumerable: true });
      Object.defineProperty(fallback, 'page', { value: 1, enumerable: true });
      Object.defineProperty(fallback, 'limit', { value: fallback.length || 200, enumerable: true });
      Object.defineProperty(fallback, 'totalPages', { value: 1, enumerable: true });
      Object.defineProperty(fallback, 'pendingJobs', { value: fallback, enumerable: true });
      return fallback;
    }

    assertMongoAvailable();
    const pendingColl = await getPendingJobsCollection();

    const page = Math.max(1, parseInt(String(filter?.page || 1), 10) || 1);
    const rawLimit = parseInt(String(filter?.limit || 200), 10) || 200;
    const limit = Math.min(500, Math.max(1, rawLimit));
    const skip = (page - 1) * limit;

    const andClauses: any[] = [{ status: 'Pending' }];

    if (filter?.search && filter.search.trim()) {
      const q = filter.search.trim();
      const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');
      andClauses.push({
        $or: [
          { title: regex },
          { company: regex },
          { description: regex },
          { tags: regex },
          { city: regex },
          { id: regex }
        ]
      });
    }

    if (filter?.sourceType && filter.sourceType !== 'All') {
      if (filter.sourceType === 'user_posted') {
        andClauses.push({
          isScraped: { $ne: true },
          isAdminCreated: { $ne: true },
          sourceType: { $ne: 'admin_created' }
        });
      } else if (filter.sourceType === 'scraped') {
        andClauses.push({
          $or: [
            { isScraped: true },
            { sourceType: 'scraped' },
            { scraperSourceId: { $exists: true, $ne: '' } }
          ]
        });
      } else if (filter.sourceType === 'admin_created') {
        andClauses.push({
          $or: [
            { isAdminCreated: true },
            { sourceType: 'admin_created' }
          ]
        });
      }
    }

    if (filter?.submittedByUserId && filter.submittedByUserId.trim()) {
      const escapedUser = filter.submittedByUserId.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      andClauses.push({ submittedByUserId: new RegExp(escapedUser, 'i') });
    }

    if (filter?.scraperSourceId && filter.scraperSourceId.trim()) {
      const escapedScraper = filter.scraperSourceId.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      andClauses.push({ scraperSourceId: new RegExp(escapedScraper, 'i') });
    }

    if (filter?.visibility && filter.visibility !== 'All') {
      if (filter.visibility === 'Overrides') {
        andClauses.push({ fieldVisibility: { $exists: true, $nin: [null, {}] } });
      } else if (filter.visibility === 'Default') {
        andClauses.push({
          $or: [
            { fieldVisibility: { $exists: false } },
            { fieldVisibility: null },
            { fieldVisibility: {} }
          ]
        });
      }
    }

    const query = andClauses.length === 1 ? andClauses[0] : { $and: andClauses };

    const total = await withMongoTimeout(pendingColl.countDocuments(query), 30000, 'getPendingCount');
    const docs = await withMongoTimeout(
      pendingColl
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      30000,
      'getPendingDocs'
    );

    const normalized = docs.map(normalizeMongoJob);
    const totalPages = Math.ceil(total / limit) || 1;

    Object.defineProperty(normalized, 'total', { value: total, enumerable: true });
    Object.defineProperty(normalized, 'page', { value: page, enumerable: true });
    Object.defineProperty(normalized, 'limit', { value: limit, enumerable: true });
    Object.defineProperty(normalized, 'totalPages', { value: totalPages, enumerable: true });
    Object.defineProperty(normalized, 'pendingJobs', { value: normalized, enumerable: true });

    return normalized;
  }

  /**
   * Retrieves a single pending job directly by ID from pending_jobs.
   */
  static async getPendingById(id: string): Promise<any | null> {
    if (!id) return null;
    if (!isMongoConfigured()) {
      const job = Database.getPendingJobs().find((j: any) => j.id === id && j.status === 'Pending');
      return job || null;
    }
    assertMongoAvailable();
    const pendingColl = await getPendingJobsCollection();
    const doc = await withMongoTimeout(
      pendingColl.findOne({ id, status: 'Pending' }),
      30000,
      'getPendingById'
    );
    return doc ? normalizeMongoJob(doc) : null;
  }

  /**
   * Retrieves multiple pending jobs directly by IDs from pending_jobs.
   */
  static async getPendingByIds(ids: string[]): Promise<any[]> {
    if (!Array.isArray(ids) || ids.length === 0) return [];
    if (!isMongoConfigured()) {
      const idsSet = new Set(ids);
      return Database.getPendingJobs().filter((j: any) => idsSet.has(j.id) && j.status === 'Pending');
    }
    assertMongoAvailable();
    const pendingColl = await getPendingJobsCollection();
    const docs = await withMongoTimeout(
      pendingColl.find({ id: { $in: ids }, status: 'Pending' }).toArray(),
      30000,
      'getPendingByIds'
    );
    return docs.map(normalizeMongoJob);
  }

  /**
   * Performs targeted candidate lookup across Live and Pending jobs collections
   * based on exact identifiers (sourceJobId, URLs) and content signals (company, title tokens).
   */
  static async findDuplicateCandidates(candidateJob: any): Promise<any[]> {
    if (!candidateJob || typeof candidateJob !== 'object') {
      return [];
    }

    if (!isMongoConfigured()) {
      const allLive = Database.getJobs();
      const allPending = Database.getPendingJobs();
      return [...allLive, ...allPending];
    }

    assertMongoAvailable();

    const candidatePoolMap = new Map<string, any>();
    const jobsColl = await getJobsCollection();
    const pendingColl = await getPendingJobsCollection();

    // 1. Gather exact identifier signals
    const exactOrClauses: any[] = [];

    const rawSourceJobId = candidateJob.sourceJobId ? String(candidateJob.sourceJobId).trim() : '';
    if (rawSourceJobId) {
      exactOrClauses.push({ sourceJobId: rawSourceJobId });
    }

    const urlCandidates: string[] = [];
    if (candidateJob.sourceUrl) urlCandidates.push(String(candidateJob.sourceUrl).trim());
    if (candidateJob.originalApplyUrl) urlCandidates.push(String(candidateJob.originalApplyUrl).trim());
    if (candidateJob.applicationUrl) urlCandidates.push(String(candidateJob.applicationUrl).trim());

    const distinctUrls = new Set<string>();
    for (const u of urlCandidates) {
      if (u && u.length > 5) {
        distinctUrls.add(u);
        try {
          const parsed = new URL(u);
          if (parsed.search) {
            distinctUrls.add(`${parsed.origin}${parsed.pathname}`);
          }
          const strippedSlash = u.replace(/\/+$/, '');
          if (strippedSlash) distinctUrls.add(strippedSlash);
        } catch {
          // ignore URL parsing errors
        }
      }
    }

    if (distinctUrls.size > 0) {
      const urlList = Array.from(distinctUrls);
      exactOrClauses.push(
        { sourceUrl: { $in: urlList } },
        { originalApplyUrl: { $in: urlList } },
        { applicationUrl: { $in: urlList } }
      );
    }

    if (exactOrClauses.length > 0) {
      const exactQuery = { $or: exactOrClauses };
      try {
        const [liveExact, pendingExact] = await Promise.all([
          jobsColl.find(exactQuery).limit(50).toArray(),
          pendingColl.find(exactQuery).limit(50).toArray()
        ]);
        for (const doc of [...liveExact, ...pendingExact]) {
          if (doc && doc.id && !candidatePoolMap.has(doc.id)) {
            candidatePoolMap.set(doc.id, normalizeMongoJob(doc));
          }
        }
      } catch (err: any) {
        console.warn('[JobRepository] Notice querying exact duplicate candidates:', err?.message || err);
      }
    }

    // 2. Content & Text Signal Queries (Compound & Targeted)
    const company = typeof candidateJob.company === 'string' ? candidateJob.company.trim() : '';
    const title = typeof candidateJob.title === 'string' ? candidateJob.title.trim() : '';

    let companyRegex: RegExp | null = null;
    if (company && company.length >= 2) {
      const escapedCompany = company.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      companyRegex = new RegExp(`^${escapedCompany}$`, 'i');
    }

    let titleTokenRegex: RegExp | null = null;
    if (title && title.length >= 3) {
      const titleTokens = title
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((w: string) => w.length >= 3 && !['jobs', 'hiring', 'vacancy', 'vacancies', 'required', 'position', 'posts', 'with', 'from', 'each', 'need', 'male', 'female'].includes(w));

      if (titleTokens.length >= 2) {
        const tokenLookaheads = titleTokens.slice(0, 3).map((t: string) => `(?=.*${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`).join('');
        titleTokenRegex = new RegExp(tokenLookaheads, 'i');
      } else if (titleTokens.length === 1 && titleTokens[0].length >= 4) {
        titleTokenRegex = new RegExp(titleTokens[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      }
    }

    const contentQueries: Array<{ query: any; limit: number }> = [];

    // Priority A: Compound Company + Title Match (Prevents crowding out of old jobs for large employers)
    if (companyRegex && titleTokenRegex) {
      contentQueries.push({ query: { company: companyRegex, title: titleTokenRegex }, limit: 35 });
    }

    // Priority B: Cross-Source Title Token Match (Always executed when title tokens exist to catch cross-portal duplicates)
    if (titleTokenRegex) {
      contentQueries.push({ query: { title: titleTokenRegex }, limit: 35 });
    }

    // Priority C: Company-Only Fallback (when title tokens are sparse)
    if (companyRegex && !titleTokenRegex) {
      contentQueries.push({ query: { company: companyRegex }, limit: 35 });
    }

    for (const { query, limit } of contentQueries) {
      try {
        const [liveDocs, pendingDocs] = await Promise.all([
          jobsColl.find(query).sort({ createdAt: -1 }).limit(limit).toArray(),
          pendingColl.find(query).sort({ createdAt: -1 }).limit(limit).toArray()
        ]);
        for (const doc of [...liveDocs, ...pendingDocs]) {
          if (doc && doc.id && !candidatePoolMap.has(doc.id)) {
            candidatePoolMap.set(doc.id, normalizeMongoJob(doc));
          }
        }
      } catch (err: any) {
        console.warn('[JobRepository] Notice querying content duplicate candidates:', err?.message || err);
      }
    }

    return Array.from(candidatePoolMap.values());
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

    const existingPending = await pendingColl.findOne({ id });
    const rawCountry = typeof jobData.country === 'string' ? jobData.country.trim() : '';
    const resolvedCountry = rawCountry || (jobData.country === undefined || jobData.country === null || jobData.country === '' ? 'Pakistan' : jobData.country);

    let pendingDoc: any = {
      ...jobData,
      id,
      slug,
      country: resolvedCountry,
      status: 'Pending',
      createdAt: jobData.createdAt || now,
      updatedAt: now,
      applicationsCount: 0
    };

    if (existingPending) {
      pendingDoc = JobRepository.applyLocationProtection(pendingDoc, existingPending);
    }

    const newPending = normalizeMongoJob(pendingDoc);

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
    if (!isMongoConfigured()) {
      return Database.approvePendingJob(id);
    }
    assertMongoAvailable();
    const pendingColl = await getPendingJobsCollection();
    const jobsColl = await getJobsCollection();

    const pendingDoc = await pendingColl.findOne({ id });
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

    let rawApproved = {
      ...pendingDoc,
      status: 'Approved',
      verifiedDate: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Apply visibility policy (merging defaults with any existing overrides)
    rawApproved = await JobVisibilityRepository.applyPolicyToJob(rawApproved);

    const approvedJob = normalizeMongoJob(rawApproved);

    // Write to live jobs collection FIRST before deleting from pending collection
    await jobsColl.updateOne({ id }, { $set: approvedJob }, { upsert: true });

    // Only after live write succeeds, remove from pending collection
    await pendingColl.deleteOne({ id });

    return approvedJob;
  }

  /**
   * Rejects a pending job in MongoDB.
   */
  static async rejectPending(id: string, reason?: string): Promise<boolean> {
    if (!isMongoConfigured()) {
      return Database.rejectPendingJob(id, reason);
    }
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
    if (!isMongoConfigured()) {
      const approvedJobs: any[] = [];
      const errors: { id: string; error: string }[] = [];
      for (const id of ids) {
        try {
          const approved = Database.approvePendingJob(id);
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
    if (!isMongoConfigured()) {
      let successCount = 0;
      const errors: { id: string; error: string }[] = [];
      for (const id of ids) {
        try {
          const rejected = Database.rejectPendingJob(id, reason);
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
    if (!isMongoConfigured()) {
      const pending = Database.getPendingJobs();
      let successCount = 0;
      const errors: { id: string; error: string }[] = [];
      const idsSet = new Set(ids);
      const remaining: any[] = [];

      for (const job of pending) {
        if (idsSet.has(job.id)) {
          const isDuplicate = Boolean(
            job.isDuplicate === true ||
            job.duplicateOfJobId ||
            job.duplicateMatchedJob ||
            job.duplicateWarning ||
            job.duplicateScore ||
            job.duplicateMatchReason ||
            job.duplicateCategory ||
            (typeof job.description === 'string' && job.description.toLowerCase().includes('duplicate'))
          );

          if (!isDuplicate) {
            errors.push({ id: job.id, error: `Job "${job.id}" is not marked as a duplicate in local queue. Deletion blocked to preserve original.` });
            remaining.push(job);
            continue;
          }

          successCount++;
        } else {
          remaining.push(job);
        }
      }

      for (const id of ids) {
        if (!pending.some((j: any) => j.id === id)) {
          errors.push({ id, error: `Duplicate job with ID "${id}" was not found in pending queue.` });
        }
      }

      Database.savePendingJobs(remaining);
      return { successCount, failureCount: errors.length, errors };
    }

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
          doc.duplicateWarning ||
          doc.duplicateScore ||
          doc.duplicateMatchReason ||
          doc.duplicateCategory ||
          (typeof doc.description === 'string' && doc.description.toLowerCase().includes('duplicate'))
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
    if (!isMongoConfigured()) {
      const pending = Database.getPendingJobs();
      let successCount = 0;
      const errors: { id: string; error: string }[] = [];
      const idsSet = new Set(duplicateIds);
      const remaining: any[] = [];

      for (const job of pending) {
        if (idsSet.has(job.id)) {
          const isDuplicate = Boolean(
            job.isDuplicate === true ||
            job.duplicateOfJobId ||
            job.duplicateMatchedJob ||
            job.duplicateWarning ||
            job.duplicateScore ||
            job.duplicateMatchReason ||
            job.duplicateCategory ||
            (typeof job.description === 'string' && job.description.toLowerCase().includes('duplicate'))
          );

          if (!isDuplicate) {
            errors.push({ id: job.id, error: `Job "${job.id}" is not verified as a duplicate in local queue. Operation blocked to protect original.` });
            remaining.push(job);
            continue;
          }

          const originalId = job.duplicateOfJobId || job.duplicateMatchedJob?.id;
          if (originalId && originalId === job.id) {
            errors.push({ id: job.id, error: `Target duplicate ID is identical to original ID (${job.id}). Operation blocked to preserve original.` });
            remaining.push(job);
            continue;
          }

          successCount++;
        } else {
          remaining.push(job);
        }
      }

      for (const id of duplicateIds) {
        if (!pending.some((j: any) => j.id === id)) {
          errors.push({ id, error: `Duplicate job "${id}" was not found in pending queue.` });
        }
      }

      Database.savePendingJobs(remaining);
      return { successCount, failureCount: errors.length, errors };
    }

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
          dupDoc.duplicateWarning ||
          dupDoc.duplicateScore ||
          dupDoc.duplicateMatchReason ||
          dupDoc.duplicateCategory ||
          (typeof dupDoc.description === 'string' && dupDoc.description.toLowerCase().includes('duplicate'))
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
    if (!isMongoConfigured()) {
      const pending = Database.getPendingJobs();
      let successCount = 0;
      const errors: { id: string; error: string }[] = [];
      const remainingPending: any[] = [];
      const idsSet = new Set(duplicateIds);

      for (const dupJob of pending) {
        if (idsSet.has(dupJob.id)) {
          const isDuplicate = Boolean(
            dupJob.isDuplicate === true ||
            dupJob.duplicateOfJobId ||
            dupJob.duplicateMatchedJob ||
            dupJob.duplicateWarning ||
            dupJob.duplicateScore ||
            dupJob.duplicateMatchReason ||
            dupJob.duplicateCategory ||
            (typeof dupJob.description === 'string' && dupJob.description.toLowerCase().includes('duplicate'))
          );

          if (!isDuplicate) {
            errors.push({ id: dupJob.id, error: `Job "${dupJob.id}" is not a duplicate. Cannot overwrite original.` });
            remainingPending.push(dupJob);
            continue;
          }

          const originalId = dupJob.duplicateOfJobId || dupJob.duplicateMatchedJob?.id;
          if (!originalId) {
            errors.push({ id: dupJob.id, error: `No original job linked to duplicate "${dupJob.id}". Cannot overwrite.` });
            remainingPending.push(dupJob);
            continue;
          }

          const originalJob = Database.getJobById(originalId);
          if (!originalJob) {
            errors.push({ id: dupJob.id, error: `Linked original job "${originalId}" was not found in live listings.` });
            remainingPending.push(dupJob);
            continue;
          }

          const now = new Date().toISOString();
          const { id: _ignoredId, isDuplicate: _ignoredDup, duplicateOfJobId: _ignoredDupOf, ...replacementData } = dupJob;
          Database.updateJob(originalId, {
            ...originalJob,
            ...replacementData,
            id: originalId,
            updatedAt: now,
            status: 'Approved',
            isDuplicate: false
          });
          successCount++;
        } else {
          remainingPending.push(dupJob);
        }
      }

      for (const id of duplicateIds) {
        if (!pending.some((j: any) => j.id === id)) {
          errors.push({ id, error: `Duplicate job "${id}" was not found in pending queue.` });
        }
      }

      Database.savePendingJobs(remainingPending);
      return { successCount, failureCount: errors.length, errors };
    }

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
          dupDoc.duplicateWarning ||
          dupDoc.duplicateScore ||
          dupDoc.duplicateMatchReason ||
          dupDoc.duplicateCategory ||
          (typeof dupDoc.description === 'string' && dupDoc.description.toLowerCase().includes('duplicate'))
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

  /**
   * Scans approved live jobs and moves any that have reached portal expiry to 'Expired' status.
   * STRICT POLICY:
   * - Preserves the REAL source application deadline in `deadlineDate`.
   * - Never modifies the source deadline.
   * - Uses admin-configurable portal expiry offset (0 / +1 / +2 days).
   * - Expired jobs remain stored in the database for admin review.
   */
  static async scanAndExpireDueJobs(offsetDays: number = 1): Promise<{ expiredCount: number; expiredJobIds: string[] }> {
    assertMongoAvailable();
    const jobsColl = await getJobsCollection();
    const safeOffsetDays = Math.max(0, Math.min(2, offsetDays));

    const activeJobs = await jobsColl.find({
      isSuspended: { $ne: true },
      $or: [
        { status: 'Approved' },
        { status: { $exists: false } }
      ],
      $and: [
        { isExpired: { $ne: true } },
        {
          $or: [
            { deadlineDate: { $exists: true, $ne: '' } },
            { deadline: { $exists: true, $ne: '' } },
            { closingDeadline: { $exists: true, $ne: '' } }
          ]
        }
      ]
    }).toArray();

    const expiredJobIds: string[] = [];
    const now = new Date().toISOString();

    for (const job of activeJobs) {
      if (checkJobExpired(job, safeOffsetDays)) {
        expiredJobIds.push(job.id);
      }
    }

    if (expiredJobIds.length > 0) {
      await jobsColl.updateMany(
        { id: { $in: expiredJobIds } },
        {
          $set: {
            status: 'Expired',
            isExpired: true,
            expiredAt: now,
            updatedAt: now
          }
        }
      );
      console.log(`[JobRepository] Moved ${expiredJobIds.length} jobs to Expired status (offset: +${safeOffsetDays} days). Deadlines preserved.`);
    }

    return {
      expiredCount: expiredJobIds.length,
      expiredJobIds
    };
  }

  /**
   * Restores an Expired job back to Live ('Approved') status.
   * Preserves the original `deadlineDate` untouched.
   */
  static async restoreJobToLive(id: string): Promise<any | null> {
    assertMongoAvailable();
    const jobsColl = await getJobsCollection();
    const now = new Date().toISOString();

    const existing = await jobsColl.findOne({ id });
    if (!existing) return null;

    const res = await jobsColl.findOneAndUpdate(
      { id },
      {
        $set: {
          status: 'Approved',
          isExpired: false,
          restoredAt: now,
          updatedAt: now
        },
        $unset: {
          expiredAt: ''
        }
      },
      { returnDocument: 'after', projection: { _id: 0 } }
    );

    return res ? normalizeMongoJob(res) : null;
  }

  /**
   * Bulk restores expired jobs to Live ('Approved') status.
   * Preserves original `deadlineDate` untouched.
   */
  static async bulkRestoreJobs(ids: string[]): Promise<number> {
    assertMongoAvailable();
    if (!Array.isArray(ids) || ids.length === 0) return 0;
    const jobsColl = await getJobsCollection();
    const now = new Date().toISOString();

    const res = await jobsColl.updateMany(
      { id: { $in: ids } },
      {
        $set: {
          status: 'Approved',
          isExpired: false,
          restoredAt: now,
          updatedAt: now
        },
        $unset: {
          expiredAt: ''
        }
      }
    );

    return res.modifiedCount || 0;
  }

  /**
   * Permanently deletes a job from both live and pending collections.
   */
  static async deleteJobPermanently(id: string): Promise<boolean> {
    assertMongoAvailable();
    const jobsColl = await getJobsCollection();
    const pendingColl = await getPendingJobsCollection();

    const res1 = await jobsColl.deleteOne({ id });
    const res2 = await pendingColl.deleteOne({ id });

    return (res1.deletedCount || 0) > 0 || (res2.deletedCount || 0) > 0;
  }

  /**
   * Bulk updates location data (region, province, city, district) for jobs.
   */
  static async bulkUpdateLocation(
    jobIds: string[],
    locationData: { region?: string; province?: string; city?: string; district?: string }
  ): Promise<{ successCount: number; errors: any[] }> {
    assertMongoAvailable();
    if (!Array.isArray(jobIds) || jobIds.length === 0) {
      return { successCount: 0, errors: [] };
    }

    const jobsColl = await getJobsCollection();
    const pendingColl = await getPendingJobsCollection();

    const updateFields: any = { updatedAt: new Date().toISOString() };
    if (locationData.region) updateFields.region = locationData.region;
    if (locationData.province) updateFields.province = locationData.province;
    if (locationData.city) updateFields.city = locationData.city;
    if (locationData.district) updateFields.district = locationData.district;

    const res1 = await jobsColl.updateMany({ id: { $in: jobIds } }, { $set: updateFields });
    const res2 = await pendingColl.updateMany({ id: { $in: jobIds } }, { $set: updateFields });

    const totalModified = (res1.modifiedCount || 0) + (res2.modifiedCount || 0);

    return {
      successCount: totalModified,
      errors: []
    };
  }

  /**
   * Retrieves jobs matching an array of IDs from either jobs or pending_jobs collection.
   */
  static async getJobsByIds(ids: string[]): Promise<any[]> {
    if (!Array.isArray(ids) || ids.length === 0) return [];
    if (!isMongoConfigured()) {
      const all = [...Database.getJobs(), ...Database.getPendingJobs()];
      return all.filter(j => ids.includes(j.id));
    }
    assertMongoAvailable();
    const jobsColl = await getJobsCollection();
    const pendingColl = await getPendingJobsCollection();

    const [liveDocs, pendingDocs] = await Promise.all([
      jobsColl.find({ id: { $in: ids } }).toArray(),
      pendingColl.find({ id: { $in: ids } }).toArray()
    ]);

    const map = new Map<string, any>();
    for (const doc of pendingDocs) {
      map.set(doc.id, normalizeMongoJob(doc));
    }
    for (const doc of liveDocs) {
      map.set(doc.id, normalizeMongoJob(doc));
    }

    return Array.from(map.values());
  }

  /**
   * Bulk deletes jobs with classification of source types for audit logging.
   */
  static async bulkDeleteWithClassification(ids: string[]): Promise<{
    deletedCount: number;
    scrapedCount: number;
    userPostedCount: number;
    adminCreatedCount: number;
    unknownCount: number;
    userPostedJobs: any[];
  }> {
    if (!Array.isArray(ids) || ids.length === 0) {
      return { deletedCount: 0, scrapedCount: 0, userPostedCount: 0, adminCreatedCount: 0, unknownCount: 0, userPostedJobs: [] };
    }

    const matchedJobs = await this.getJobsByIds(ids);
    const userPostedJobs: any[] = [];
    let scrapedCount = 0;
    let userPostedCount = 0;
    let adminCreatedCount = 0;
    let unknownCount = 0;

    for (const job of matchedJobs) {
      const isScraped = Boolean(
        job.sourceUrl ||
        job.sourceWebsite ||
        job.isScraped ||
        job.ingestionMethod === 'scraper' ||
        job.ingestionMethod === 'pdf' ||
        job.scrapedFrom
      );

      if (isScraped) {
        scrapedCount++;
      } else if (job.submittedByUserId) {
        userPostedCount++;
        userPostedJobs.push(job);
      } else if (job.createdByAdmin || job.postedByRole === 'admin') {
        adminCreatedCount++;
      } else {
        unknownCount++;
      }
    }

    const deletedCount = await this.bulkDelete(ids);

    return {
      deletedCount,
      scrapedCount,
      userPostedCount,
      adminCreatedCount,
      unknownCount,
      userPostedJobs
    };
  }

  /**
   * Bulk rejects pending jobs with classification.
   */
  static async bulkRejectPendingWithClassification(ids: string[], reason?: string): Promise<{
    successCount: number;
    failureCount: number;
    errors: { id: string; error: string }[];
    rejectedCount: number;
    scrapedCount: number;
    userPostedCount: number;
    adminCreatedCount: number;
    unknownCount: number;
    userPostedJobs: any[];
  }> {
    if (!Array.isArray(ids) || ids.length === 0) {
      return {
        successCount: 0,
        failureCount: 0,
        errors: [],
        rejectedCount: 0,
        scrapedCount: 0,
        userPostedCount: 0,
        adminCreatedCount: 0,
        unknownCount: 0,
        userPostedJobs: []
      };
    }

    const matchedJobs = await this.getJobsByIds(ids);
    const userPostedJobs: any[] = [];
    let scrapedCount = 0;
    let userPostedCount = 0;
    let adminCreatedCount = 0;
    let unknownCount = 0;

    for (const job of matchedJobs) {
      const isScraped = Boolean(
        job.sourceUrl ||
        job.sourceWebsite ||
        job.isScraped ||
        job.ingestionMethod === 'scraper' ||
        job.ingestionMethod === 'pdf' ||
        job.scrapedFrom
      );

      if (isScraped) {
        scrapedCount++;
      } else if (job.submittedByUserId) {
        userPostedCount++;
        userPostedJobs.push(job);
      } else if (job.createdByAdmin || job.postedByRole === 'admin') {
        adminCreatedCount++;
      } else {
        unknownCount++;
      }
    }

    const res = await this.bulkRejectPending(ids, reason);

    return {
      successCount: res.successCount,
      failureCount: res.failureCount,
      errors: res.errors,
      rejectedCount: res.successCount,
      scrapedCount,
      userPostedCount,
      adminCreatedCount,
      unknownCount,
      userPostedJobs
    };
  }

  /**
   * Marks a job or set of jobs as non-job in database.
   */
  static async bulkMarkNonJob(ids: string[], reason?: string): Promise<{ successCount: number; modifiedCount: number }> {
    if (!Array.isArray(ids) || ids.length === 0) return { successCount: 0, modifiedCount: 0 };
    if (!isMongoConfigured()) return { successCount: 0, modifiedCount: 0 };
    assertMongoAvailable();
    const pendingColl = await getPendingJobsCollection();
    const res = await pendingColl.updateMany(
      { id: { $in: ids } },
      { $set: { isNonJob: true, status: 'Rejected', rejectionReason: reason || 'Marked as Non-Job announcement', updatedAt: new Date().toISOString() } }
    );
    return { successCount: res.modifiedCount || 0, modifiedCount: res.modifiedCount || 0 };
  }

  /**
   * Converts a non-job or pending item back to job format.
   */
  static async convertToJob(id: string, updates: any = {}): Promise<any | null> {
    if (!isMongoConfigured()) return null;
    assertMongoAvailable();
    const pendingColl = await getPendingJobsCollection();
    const res = await pendingColl.findOneAndUpdate(
      { id },
      { $set: { ...updates, isNonJob: false, status: 'Pending', updatedAt: new Date().toISOString() } },
      { returnDocument: 'after' }
    );
    return res ? normalizeMongoJob(res) : null;
  }

  /**
   * Checks whether a stored attachment filename is flagged as public on any job.
   */
  static async isAttachmentPublic(filename: string): Promise<boolean> {
    const cleanFilename = path.basename(filename);
    if (!cleanFilename) return false;

    if (isMongoConfigured()) {
      try {
        const jobsColl = await getJobsCollection();
        const pendingColl = await getPendingJobsCollection();

        const query = {
          attachments: {
            $elemMatch: {
              fileUrl: { $regex: cleanFilename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') },
              isPublic: true
            }
          }
        };

        const [publicLive, publicPending] = await Promise.all([
          jobsColl.findOne(query, { projection: { id: 1 } }),
          pendingColl.findOne(query, { projection: { id: 1 } })
        ]);

        return Boolean(publicLive || publicPending);
      } catch (err: any) {
        console.error('[JobRepository] Error checking isAttachmentPublic in MongoDB:', err);
        // Fail closed on Mongo failure
        throw err;
      }
    }

    // Local file fallback
    try {
      const allJobs = [...Database.getJobs(), ...Database.getPendingJobs()];
      for (const j of allJobs) {
        if (Array.isArray(j.attachments)) {
          const match = j.attachments.find(
            (a: any) => a && a.fileUrl && a.fileUrl.includes(cleanFilename) && a.isPublic === true
          );
          if (match) return true;
        }
      }
    } catch (err) {}

    return false;
  }

  /**
   * Checks if an attachment filename belongs to any job where 'attachments' visibility is 'Free'.
   */
  static async isAttachmentAccessibleForFree(filename: string): Promise<boolean> {
    const cleanFilename = path.basename(filename);
    if (!cleanFilename) return false;

    if (isMongoConfigured()) {
      try {
        const jobsColl = await getJobsCollection();
        const pendingColl = await getPendingJobsCollection();

        const query = {
          attachments: {
            $elemMatch: {
              fileUrl: { $regex: cleanFilename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }
            }
          },
          "fieldVisibility.attachments": "Free"
        };

        const [freeLive, freePending] = await Promise.all([
          jobsColl.findOne(query, { projection: { id: 1 } }),
          pendingColl.findOne(query, { projection: { id: 1 } })
        ]);

        return Boolean(freeLive || freePending);
      } catch (err: any) {
        console.error('[JobRepository] Error checking isAttachmentAccessibleForFree in MongoDB:', err);
        // Fail closed on Mongo failure
        throw err;
      }
    }

    // Local fallback
    try {
      const allJobs = [...Database.getJobs(), ...Database.getPendingJobs()];
      for (const j of allJobs) {
        if (j.fieldVisibility?.attachments === 'Free' && Array.isArray(j.attachments)) {
          const match = j.attachments.find((a: any) => a && a.fileUrl && a.fileUrl.includes(cleanFilename));
          if (match) return true;
        }
      }
    } catch {}

    return false;
  }

  /**
   * Comprehensive attachment access verification.
   * Verifies association, parent job existence, field visibility rules, and individual attachment privacy.
   * Handles duplicate filenames across multiple jobs strictly.
   */
  static async verifyAttachmentAccess(filename: string, user: any, isPremium: boolean, jobId?: string): Promise<boolean> {
    const cleanFilename = path.basename(filename);
    if (!cleanFilename || cleanFilename === '.' || cleanFilename === '..') return false;

    const isAdmin = Boolean(user && ['Super Admin', 'Admin', 'Job Moderator', 'Scraper Manager'].includes(user.role));

    // Fallback to in-memory Database for tests (IS_TEST=true)
    if (process.env.IS_TEST === 'true') {
      const allJobs = Database.getJobs();
      const matchingJobs = allJobs.filter((j: any) =>
        Array.isArray(j.attachments) &&
        j.attachments.some((a: any) => a && a.fileUrl && (a.fileUrl.includes(cleanFilename) || path.basename(a.fileUrl) === cleanFilename)) &&
        (!jobId || j.id === jobId)
      );

      if (matchingJobs.length === 0) return false;
      if (isAdmin) return true;

      for (const parentJob of matchingJobs) {
        const att = parentJob.attachments.find((a: any) => a && a.fileUrl && (a.fileUrl.includes(cleanFilename) || path.basename(a.fileUrl) === cleanFilename));
        if (!att || att.isPublic !== true) return false;
        const visibility = parentJob.fieldVisibility?.attachments || 'Premium';
        if (visibility === 'Hidden' || (visibility === 'Premium' && !isPremium)) return false;
      }
      return true;
    } else if (isMongoConfigured()) {
      try {
        const jobsColl = await getJobsCollection();
        const pendingColl = await getPendingJobsCollection();

        const regex = cleanFilename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const query: any = {
          attachments: {
            $elemMatch: {
              fileUrl: { $regex: regex }
            }
          }
        };
        if (jobId) {
          query.id = jobId;
        }

        const [matchLive, matchPending] = await Promise.all([
          withMongoTimeout(jobsColl.find(query).toArray(), 10000, 'verifyAttachmentLive'),
          withMongoTimeout(pendingColl.find(query).toArray(), 10000, 'verifyAttachmentPending')
        ]);

        const matchingJobs = [...matchLive, ...matchPending];

        if (matchingJobs.length === 0) {
          // Parent job does not exist or attachment is unassociated/orphaned
          return false;
        }

        // Admin access is granted only for existing associated parent job attachments
        if (isAdmin) {
          return matchingJobs.some(j =>
            Array.isArray(j.attachments) &&
            j.attachments.some((a: any) => a && a.fileUrl && (a.fileUrl.includes(cleanFilename) || path.basename(a.fileUrl) === cleanFilename))
          );
        }

        // Non-admin enforcement:
        // Must evaluate matching parent jobs. If duplicate filenames exist across jobs with different policies,
        // every referencing job must authorize access (fail-safe).
        for (const parentJob of matchingJobs) {
          const attList = Array.isArray(parentJob.attachments) ? parentJob.attachments : [];
          const att = attList.find((a: any) => a && a.fileUrl && (a.fileUrl.includes(cleanFilename) || path.basename(a.fileUrl) === cleanFilename));
          if (!att) {
            return false;
          }

          // 1. Existing privacy rule: individual attachment must be public
          if (att.isPublic !== true) {
            return false;
          }

          // 2. Job fieldVisibility policy
          const visibility: string = parentJob.fieldVisibility?.attachments || 'Premium';
          if (visibility === 'Hidden') {
            return false;
          }
          if (visibility === 'Premium' && !isPremium) {
            return false;
          }
        }

        return true;
      } catch (err: any) {
        console.error('[JobRepository] Error verifying attachment access in MongoDB:', err);
        throw err; // Fail closed: explicit error on Mongo failure, never silent fallback
      }
    }

    // Local fallback only when MongoDB is NOT configured
    try {
      const allJobs = [...Database.getJobs(), ...Database.getPendingJobs()];
      const matchingJobs = allJobs.filter((j: any) =>
        (!jobId || j.id === jobId) &&
        Array.isArray(j.attachments) &&
        j.attachments.some((a: any) => a && a.fileUrl && (a.fileUrl.includes(cleanFilename) || path.basename(a.fileUrl) === cleanFilename))
      );

      if (matchingJobs.length === 0) {
        return false;
      }

      if (isAdmin) {
        return true;
      }

      for (const parentJob of matchingJobs) {
        const attList = Array.isArray(parentJob.attachments) ? parentJob.attachments : [];
        const att = attList.find((a: any) => a && a.fileUrl && (a.fileUrl.includes(cleanFilename) || path.basename(a.fileUrl) === cleanFilename));
        if (!att || att.isPublic !== true) {
          return false;
        }

        const visibility: string = parentJob.fieldVisibility?.attachments || 'Premium';
        if (visibility === 'Hidden') {
          return false;
        }
        if (visibility === 'Premium' && !isPremium) {
          return false;
        }
      }

      return true;
    } catch {
      return false;
    }
  }
}

