import { getMongoDb, isMongoConfigured, getUsersCollection } from '../mongodb';

export type FieldVisibility = 'Free' | 'Premium' | 'Hidden';
export type JobSourceType = 'user_posted' | 'scraped' | 'admin_created';

export interface VisibilityPolicy {
  source: JobSourceType;
  sourceKey?: string;
  fieldRules: Record<string, FieldVisibility>;
  updatedAt: string;
}

// 1. Strictly Admin-only / internal moderation & scraper fields (NEVER exposed to non-admins, NEVER configurable via policy)
export const ADMIN_INTERNAL_FIELDS = [
  'paymentStatus', 'rejectionReason', 'suspensionReason', 'isSuspended', 
  'reviewTimeline', 'duplicateScore', 'duplicateCategory', 'duplicateTags', 
  'duplicateMatchReason', 'duplicateOfJobId', 'duplicateOfJobTitle', 
  'duplicateMatchedCompany', 'isDuplicateOverride', 'duplicateOverrideNote', 
  'duplicateDetectedAt', 'isDuplicate', 'scraperBatchId', 'scraperRunType', 
  'scrapedTimezone', 'scrapedRawSalary', 'deduplicationScore', 'extractedText', 
  'pdfParserEngine', 'extractionSourceType', 'isLocationConfirmed', 
  'locationConfirmedAt', 'isManuallyCorrected', 'manuallyCorrectedAt', 
  'metadata', 'lastScrapedAt', 'scraperSourceId', 'scraperSourceName', 
  'scrapedSourceDomain', 'scrapedAt', 'scrapedTime', '_isAdminView'
];
export const ADMIN_INTERNAL_SET = new Set(ADMIN_INTERNAL_FIELDS);

// 2. Configurable Sensitive Fields (Subject to Free / Premium / Hidden policy)
export const CONFIGURABLE_SENSITIVE_FIELDS = [
  'applicationUrl', 'contactEmail', 'contactEmailOrPhone', 'attachments', 
  'externalApplyUrl', 'sourceUrl', 'pdfSourceUrl', 'mediaUrl', 'salary', 
  'pdfFileName', 'pdfCaseNumber', 'pdfTotalVacanciesInCase'
];
export const CONFIGURABLE_SENSITIVE_SET = new Set(CONFIGURABLE_SENSITIVE_FIELDS);

// 3. Standard Public Fields (Default Free, configurable if needed)
export const PUBLIC_STANDARD_FIELDS = [
  'title', 'company', 'companyLogo', 'jobType', 'region', 'country', 'province',
  'city', 'district', 'salaryNumericMin', 'currency', 'experienceLevel', 
  'department', 'tags', 'description', 'requirements', 'responsibilities', 
  'responsibilitiesList', 'benefits', 'postedAt', 'featured', 'urgent', 
  'isPinnedTop', 'isFutureJob', 'futureIntakeDate', 'priorityTier', 
  'applicationsCount', 'status', 'jobCategory', 'isGovtJob', 'govtDepartment', 
  'govtScale', 'govtCategory', 'isNewspaperAd', 'newspaperName', 'clippingImageUrl', 
  'newspaperDate', 'deadlineDate', 'domicileQuota', 'challanFee', 'ageRelaxationNote', 
  'createdAt', 'updatedAt'
];

// 4. All Configurable Registry Fields (Allowed in Admin Policy API)
export const CONFIGURABLE_REGISTRY_FIELDS = [
  ...PUBLIC_STANDARD_FIELDS,
  ...CONFIGURABLE_SENSITIVE_FIELDS
];
export const CONFIGURABLE_REGISTRY_SET = new Set(CONFIGURABLE_REGISTRY_FIELDS);

// 5. Allowed Metadata keys in sanitized responses
export const ALLOWED_METADATA_KEYS = new Set(['id', 'slug', 'sourceType', 'visibilitySource', 'fieldVisibility', 'isExpired', '_id']);

function getDefaultPolicy(source: JobSourceType): VisibilityPolicy {
  const fieldRules: Record<string, FieldVisibility> = {};
  for (const f of CONFIGURABLE_REGISTRY_FIELDS) {
    fieldRules[f] = CONFIGURABLE_SENSITIVE_SET.has(f) ? 'Premium' : 'Free';
  }
  return {
    source,
    fieldRules,
    updatedAt: new Date().toISOString()
  };
}

export class JobVisibilityRepository {
  private static localPolicies: Map<string, VisibilityPolicy> = new Map([
    ['user_posted', getDefaultPolicy('user_posted')],
    ['scraped', getDefaultPolicy('scraped')],
    ['admin_created', getDefaultPolicy('admin_created')]
  ]);

  /**
   * Retrieves the active policy for a given source and optional sourceKey.
   */
  static async getPolicy(source: JobSourceType, sourceKey?: string): Promise<VisibilityPolicy> {
    if (process.env.IS_TEST === 'true' || (process.env.NODE_ENV !== 'production' && !isMongoConfigured())) {
      const key = sourceKey ? `${source}:${sourceKey}` : source;
      return JobVisibilityRepository.localPolicies.get(key) || getDefaultPolicy(source);
    }

    if (!isMongoConfigured()) {
      throw new Error('MongoDB configuration required for job visibility policy persistence in production');
    }

    const db = await getMongoDb();
    const coll = db.collection('job_visibility_policies');
    const query: any = { source };
    if (sourceKey) query.sourceKey = sourceKey;
    else query.sourceKey = { $exists: false };

    const doc = await coll.findOne(query);
    if (doc) {
      return {
        source: doc.source,
        sourceKey: doc.sourceKey,
        fieldRules: doc.fieldRules || {},
        updatedAt: doc.updatedAt || new Date().toISOString()
      };
    }
    return getDefaultPolicy(source);
  }

  /**
   * Retrieves all policies.
   */
  static async getAllPolicies(): Promise<VisibilityPolicy[]> {
    if (process.env.IS_TEST === 'true' || (process.env.NODE_ENV !== 'production' && !isMongoConfigured())) {
      return Array.from(JobVisibilityRepository.localPolicies.values());
    }

    if (!isMongoConfigured()) {
      throw new Error('MongoDB configuration required for job visibility policies in production');
    }

    const db = await getMongoDb();
    const coll = db.collection('job_visibility_policies');
    const docs = await coll.find({}).toArray();
    return docs.map(d => ({
      source: d.source,
      sourceKey: d.sourceKey,
      fieldRules: d.fieldRules || {},
      updatedAt: d.updatedAt || new Date().toISOString()
    }));
  }

  /**
   * Saves or updates a policy.
   */
  static async savePolicy(source: JobSourceType, fieldRules: Record<string, FieldVisibility>, sourceKey?: string): Promise<VisibilityPolicy> {
    const policy: VisibilityPolicy = {
      source,
      sourceKey,
      fieldRules,
      updatedAt: new Date().toISOString()
    };

    if (process.env.IS_TEST === 'true' || (process.env.NODE_ENV !== 'production' && !isMongoConfigured())) {
      const key = sourceKey ? `${source}:${sourceKey}` : source;
      JobVisibilityRepository.localPolicies.set(key, policy);
      return policy;
    }

    if (!isMongoConfigured()) {
      throw new Error('MongoDB configuration required to save job visibility policy in production');
    }

    const db = await getMongoDb();
    const coll = db.collection('job_visibility_policies');
    const query: any = { source };
    if (sourceKey) query.sourceKey = sourceKey;
    else query.sourceKey = { $exists: false };

    const res = await coll.updateOne(query, { $set: policy }, { upsert: true });
    if (!res || (!res.acknowledged && !res.upsertedCount && !res.modifiedCount && !res.matchedCount)) {
      throw new Error('Failed to persist job visibility policy to MongoDB');
    }

    return policy;
  }

  /**
   * Determines the source type of a job.
   */
  static deriveJobSource(job: any): JobSourceType {
    if (!job) return 'user_posted';
    if (job.sourceType === 'admin_created' || job.isAdminCreated || job.createdByRole === 'Admin' || job.createdByRole === 'Super Admin') {
      return 'admin_created';
    }
    if (job.isScraped || job.isPdfScraped || job.sourceType === 'scraped' || job.sourceType === 'pdf_scraped' || job.scraperSourceId) {
      return 'scraped';
    }
    return 'user_posted';
  }

  /**
   * Applies the appropriate default policy to a job.
   * Merges defaults and existing overrides field-by-field.
   */
  static async applyPolicyToJob(job: any): Promise<any> {
    if (!job) return job;
    
    const source = JobVisibilityRepository.deriveJobSource(job);
    let policy: VisibilityPolicy;

    if (source === 'scraped' && job.scraperSourceId) {
      policy = await JobVisibilityRepository.getPolicy('scraped', job.scraperSourceId);
      if (!policy || !policy.fieldRules || Object.keys(policy.fieldRules).length === 0) {
        policy = await JobVisibilityRepository.getPolicy('scraped');
      }
    } else {
      policy = await JobVisibilityRepository.getPolicy(source);
    }

    const mergedRules = { ...(policy.fieldRules || {}) };
    
    // Respect existing individual overrides field-by-field
    if (job.fieldVisibility && typeof job.fieldVisibility === 'object') {
      Object.assign(mergedRules, job.fieldVisibility);
    }

    return {
      ...job,
      fieldVisibility: mergedRules,
      visibilitySource: source
    };
  }

  /**
   * Helper function to evaluate user document for active, non-expired Premium status.
   */
  static evaluateUserDocForPremium(userDoc: any): boolean {
    if (!userDoc) return false;
    if (userDoc.membershipStatus === 'Active') {
      const authoritativeExpiry = userDoc.subscriptionExpiresAt || userDoc.expiryDate;
      if (authoritativeExpiry) {
        const expiryMs = new Date(authoritativeExpiry).getTime();
        return !isNaN(expiryMs) && expiryMs > Date.now();
      }
    }
    return false;
  }

  /**
   * Authoritatively verifies user's premium status from the database.
   * Checks both subscriptionExpiresAt (new) and expiryDate (legacy).
   */
  static async isUserPremiumAuthoritative(userId: string | undefined): Promise<boolean> {
    if (!userId) return false;
    
    if (isMongoConfigured()) {
      try {
        const coll = await getUsersCollection();
        const userDoc = await coll.findOne({ id: userId });
        return JobVisibilityRepository.evaluateUserDocForPremium(userDoc);
      } catch (err: any) {
        console.error('[JobVisibilityRepository] Authoritative Premium Check Failed (MongoDB):', err);
        // Fail closed: propagate error to prevent unauthorized access during DB failure
        throw new Error(`Authoritative subscription verification failed: ${err.message || 'Database connection error'}`);
      }
    } else {
      // Fallback for non-Mongo environments (development)
      try {
        const { Database } = await import('../database');
        const user = Database.getUserById(userId);
        return JobVisibilityRepository.evaluateUserDocForPremium(user);
      } catch (err) {
        console.error('[JobVisibilityRepository] Fallback Premium Check Failed:', err);
        return false;
      }
    }
  }

  /**
   * Filters job fields based on requester's role and authoritative subscription status.
   */
  static filterJobForUser(job: any, user: any, authoritativePremium: boolean = false): any {
    if (!job) return job;

    const isAdmin = Boolean(
      user && ['Super Admin', 'Admin', 'Job Moderator', 'Scraper Manager'].includes(user.role)
    );
    if (isAdmin) {
      return job;
    }

    const rules = job.fieldVisibility || {};
    const filtered = { ...job };

    // Strictly strip all Admin-only / internal fields for all non-admin users regardless of Free/Premium
    for (const internalField of ADMIN_INTERNAL_FIELDS) {
      delete filtered[internalField];
    }

    // Remove any unknown/unregistered fields to prevent leaks for non-admin users
    for (const key of Object.keys(filtered)) {
      if (!CONFIGURABLE_REGISTRY_SET.has(key) && !ALLOWED_METADATA_KEYS.has(key)) {
        delete filtered[key];
      }
    }

    for (const field of CONFIGURABLE_REGISTRY_FIELDS) {
      if (!(field in filtered)) continue;

      const visibility: FieldVisibility = rules[field] || (CONFIGURABLE_SENSITIVE_SET.has(field) ? 'Premium' : 'Free');

      if (visibility === 'Hidden') {
        delete filtered[field];
      } else if (visibility === 'Premium' && !authoritativePremium) {
        // Redact premium field for free or unauthenticated users
        if (field === 'attachments') {
          filtered[field] = [];
        } else if (CONFIGURABLE_SENSITIVE_SET.has(field)) {
          filtered[field] = '🔒 Unlock with Premium Subscription';
        } else {
          filtered[field] = '🔒 [Premium Content - Upgrade to View]';
        }
        
        // Add metadata hint for UI
        if (!filtered._visibilityHints) filtered._visibilityHints = {};
        filtered._visibilityHints[field] = {
          visibility,
          requiresUpgrade: true
        };
      }
    }

    // Preserve existing attachment Public/Private permission filtering independently
    if (Array.isArray(filtered.attachments)) {
      filtered.attachments = filtered.attachments.filter((a: any) => a && a.isPublic === true);
    }

    return filtered;
  }
}


