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

  private static mockCollection: any = null;

  /**
   * Test-only helper to exercise the MongoDB driver query/update code path with an isolated mock collection.
   */
  static setMockCollection(coll: any): void {
    JobVisibilityRepository.mockCollection = coll;
  }

  /**
   * Retrieves the active policy for a given source and optional sourceKey.
   * Enforces 3-tier policy inheritance:
   * 1. Built-in defaults (base fallback)
   * 2. Saved generic source policy overrides built-in defaults
   * 3. Saved scraper-specific policy overrides only explicitly defined fields
   * Note: Missing scraper-specific policy does NOT reset generic rules to built-in defaults.
   */
  static async getPolicy(source: JobSourceType, sourceKey?: string): Promise<VisibilityPolicy> {
    if (!JobVisibilityRepository.mockCollection) {
      if (process.env.IS_TEST !== 'true' && (process.env.NODE_ENV === 'production' || !isMongoConfigured())) {
        if (!isMongoConfigured()) {
          throw new Error('MongoDB configuration required for job visibility policy persistence in production');
        }
      }

      if (process.env.IS_TEST === 'true' || (process.env.NODE_ENV !== 'production' && !isMongoConfigured())) {
        // 1. Layer generic source policy
        const genericPolicy = JobVisibilityRepository.localPolicies.get(source);
        const base = getDefaultPolicy(source);
        const mergedFieldRules: Record<string, FieldVisibility> = { ...base.fieldRules };
        let effectiveUpdatedAt = base.updatedAt;

        if (genericPolicy && genericPolicy.fieldRules) {
          Object.assign(mergedFieldRules, genericPolicy.fieldRules);
          if (genericPolicy.updatedAt) effectiveUpdatedAt = genericPolicy.updatedAt;
        }

        // 2. Layer scraper-specific policy if sourceKey provided
        if (sourceKey && typeof sourceKey === 'string' && sourceKey.trim()) {
          const specificKey = `${source}:${sourceKey.trim()}`;
          const specificPolicy = JobVisibilityRepository.localPolicies.get(specificKey);
          if (specificPolicy && specificPolicy.fieldRules) {
            Object.assign(mergedFieldRules, specificPolicy.fieldRules);
            if (specificPolicy.updatedAt) effectiveUpdatedAt = specificPolicy.updatedAt;
          }
        }

        const resPol: VisibilityPolicy = {
          source,
          fieldRules: mergedFieldRules,
          updatedAt: effectiveUpdatedAt
        };
        if (sourceKey && typeof sourceKey === 'string' && sourceKey.trim()) {
          resPol.sourceKey = sourceKey.trim();
        }
        return resPol;
      }
    }

    // MongoDB authoritative path (executed in production or via mockCollection)
    const coll = JobVisibilityRepository.mockCollection || (await getMongoDb()).collection('job_visibility_policies');
    const base = getDefaultPolicy(source);
    const mergedFieldRules: Record<string, FieldVisibility> = { ...base.fieldRules };
    let effectiveUpdatedAt = base.updatedAt;

    // 1. Layer generic source policy
    const genericDoc = await coll.findOne({ source, sourceKey: { $exists: false } });
    if (genericDoc && genericDoc.fieldRules) {
      Object.assign(mergedFieldRules, genericDoc.fieldRules);
      if (genericDoc.updatedAt) effectiveUpdatedAt = genericDoc.updatedAt;
    }

    // 2. Layer scraper-specific policy if sourceKey provided
    if (sourceKey && typeof sourceKey === 'string' && sourceKey.trim()) {
      const specificDoc = await coll.findOne({ source, sourceKey: sourceKey.trim() });
      if (specificDoc && specificDoc.fieldRules) {
        Object.assign(mergedFieldRules, specificDoc.fieldRules);
        if (specificDoc.updatedAt) effectiveUpdatedAt = specificDoc.updatedAt;
      }
    }

    const resPol: VisibilityPolicy = {
      source,
      fieldRules: mergedFieldRules,
      updatedAt: effectiveUpdatedAt
    };
    if (sourceKey && typeof sourceKey === 'string' && sourceKey.trim()) {
      resPol.sourceKey = sourceKey.trim();
    }
    return resPol;
  }

  /**
   * Retrieves all policies.
   */
  static async getAllPolicies(): Promise<VisibilityPolicy[]> {
    if (!JobVisibilityRepository.mockCollection) {
      if (process.env.IS_TEST === 'true' || (process.env.NODE_ENV !== 'production' && !isMongoConfigured())) {
        return Array.from(JobVisibilityRepository.localPolicies.values());
      }

      if (!isMongoConfigured()) {
        throw new Error('MongoDB configuration required for job visibility policies in production');
      }
    }

    const coll = JobVisibilityRepository.mockCollection || (await getMongoDb()).collection('job_visibility_policies');
    const docs = await coll.find({}).toArray();
    return docs.map(d => {
      const pol: VisibilityPolicy = {
        source: d.source,
        fieldRules: d.fieldRules || {},
        updatedAt: d.updatedAt || new Date().toISOString()
      };
      if (d.sourceKey) {
        pol.sourceKey = d.sourceKey;
      }
      return pol;
    });
  }

  /**
   * Saves or updates a policy.
   * When sourceKey is absent, omits the sourceKey property completely from the document and $set payload.
   */
  static async savePolicy(source: JobSourceType, fieldRules: Record<string, FieldVisibility>, sourceKey?: string): Promise<VisibilityPolicy> {
    const policy: VisibilityPolicy = {
      source,
      fieldRules,
      updatedAt: new Date().toISOString()
    };
    if (sourceKey && typeof sourceKey === 'string' && sourceKey.trim()) {
      policy.sourceKey = sourceKey.trim();
    }

    if (!JobVisibilityRepository.mockCollection) {
      if (process.env.IS_TEST === 'true' || (process.env.NODE_ENV !== 'production' && !isMongoConfigured())) {
        const key = policy.sourceKey ? `${source}:${policy.sourceKey}` : source;
        JobVisibilityRepository.localPolicies.set(key, policy);
        return policy;
      }

      if (!isMongoConfigured()) {
        throw new Error('MongoDB configuration required to save job visibility policy in production');
      }
    }

    const coll = JobVisibilityRepository.mockCollection || (await getMongoDb()).collection('job_visibility_policies');
    const query: any = { source };
    if (policy.sourceKey) {
      query.sourceKey = policy.sourceKey;
    } else {
      query.sourceKey = { $exists: false };
    }

    const res = await coll.updateOne(query, { $set: policy }, { upsert: true });
    if (!res || (!res.acknowledged && !res.upsertedCount && !res.modifiedCount && !res.matchedCount)) {
      throw new Error('Failed to persist job visibility policy to MongoDB');
    }

    return policy;
  }

  /**
   * Determines the source type of a job.
   */
  static deriveJobSource(jobOrSource: any): JobSourceType {
    if (!jobOrSource) return 'user_posted';
    if (typeof jobOrSource === 'string') {
      if (jobOrSource === 'pdf_scraped' || jobOrSource === 'scraped') return 'scraped';
      if (jobOrSource === 'admin_created') return 'admin_created';
      if (jobOrSource === 'user_posted') return 'user_posted';
      return 'user_posted';
    }
    const job = jobOrSource;
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
    const policy = await JobVisibilityRepository.getPolicy(source, source === 'scraped' ? job.scraperSourceId : undefined);

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


