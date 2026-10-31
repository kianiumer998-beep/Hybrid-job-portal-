import { getMongoDb, isMongoConfigured, getUsersCollection } from '../mongodb';

export type FieldVisibility = 'Free' | 'Premium' | 'Hidden';
export type JobSourceType = 'user_posted' | 'scraped' | 'admin_created';

export interface VisibilityPolicy {
  source: JobSourceType;
  sourceKey?: string;
  fieldRules: Record<string, FieldVisibility>;
  updatedAt: string;
}

const DEFAULT_SUPPORTED_FIELDS = [
  'title', 'company', 'companyLogo', 'jobType', 'region', 'country', 'province',
  'city', 'district', 'salary', 'experienceLevel', 'department', 'tags',
  'description', 'requirements', 'responsibilities', 'benefits', 'deadlineDate',
  'attachments', 'applicationUrl', 'contactEmail', 'contactEmailOrPhone', 'externalApplyUrl',
  'sourceUrl', 'pdfSourceUrl', 'clippingImageUrl', 'mediaUrl', 'govtDepartment', 'govtScale'
];

function getDefaultPolicy(source: JobSourceType): VisibilityPolicy {
  const fieldRules: Record<string, FieldVisibility> = {};
  for (const f of DEFAULT_SUPPORTED_FIELDS) {
    if (['applicationUrl', 'contactEmail', 'contactEmailOrPhone', 'attachments', 'externalApplyUrl', 'sourceUrl', 'pdfSourceUrl'].includes(f)) {
      fieldRules[f] = 'Premium';
    } else {
      fieldRules[f] = 'Free';
    }
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
    if (isMongoConfigured()) {
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
      // If no specific policy found in Mongo, return default for source
      return getDefaultPolicy(source);
    }

    const key = sourceKey ? `${source}:${sourceKey}` : source;
    return JobVisibilityRepository.localPolicies.get(key) || getDefaultPolicy(source);
  }

  /**
   * Retrieves all policies.
   */
  static async getAllPolicies(): Promise<VisibilityPolicy[]> {
    if (isMongoConfigured()) {
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
    return Array.from(JobVisibilityRepository.localPolicies.values());
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

    if (isMongoConfigured()) {
      const db = await getMongoDb();
      const coll = db.collection('job_visibility_policies');
      const query: any = { source };
      if (sourceKey) query.sourceKey = sourceKey;
      else query.sourceKey = { $exists: false };

      await coll.updateOne(query, { $set: policy }, { upsert: true });
    } else {
      const key = sourceKey ? `${source}:${sourceKey}` : source;
      JobVisibilityRepository.localPolicies.set(key, policy);
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
   * Authoritatively verifies user's premium status from the database.
   */
  static async isUserPremiumAuthoritative(userId: string | undefined): Promise<boolean> {
    if (!userId) return false;
    
    if (isMongoConfigured()) {
      try {
        const coll = await getUsersCollection();
        const userDoc = await coll.findOne({ id: userId });
        if (!userDoc) return false;

        // Strict criteria: MembershipStatus === 'Active' AND expiryDate is in the future
        if (userDoc.membershipStatus === 'Active' && userDoc.expiryDate) {
          const expiryMs = new Date(userDoc.expiryDate).getTime();
          return !isNaN(expiryMs) && expiryMs > Date.now();
        }
        return false;
      } catch (err: any) {
        console.error('[JobVisibilityRepository] Authoritative Premium Check Failed (MongoDB):', err);
        throw new Error(`Authoritative subscription verification failed: ${err.message || 'Database connection error'}`);
      }
    } else {
      // Fallback for non-Mongo environments (development)
      try {
        const { Database } = await import('../database');
        const user = Database.getUserById(userId);
        if (user && user.membershipStatus === 'Active' && user.expiryDate) {
          const expiryMs = new Date(user.expiryDate).getTime();
          return !isNaN(expiryMs) && expiryMs > Date.now();
        }
        return false;
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

    // Central Field Registry
    const ALL_REGISTRY_FIELDS = [
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

    for (const field of ALL_REGISTRY_FIELDS) {
      // Default to Premium for known sensitive fields if no specific rule exists
      const sensitiveFields = ['applicationUrl', 'contactEmail', 'contactEmailOrPhone', 'attachments', 'externalApplyUrl', 'sourceUrl', 'pdfSourceUrl', 'mediaUrl'];
      const visibility: FieldVisibility = rules[field] || (sensitiveFields.includes(field) ? 'Premium' : 'Free');

      if (visibility === 'Hidden') {
        delete filtered[field];
      } else if (visibility === 'Premium' && !authoritativePremium) {
        // Redact premium field for free or unauthenticated users
        if (field === 'attachments') {
          filtered[field] = [];
        } else if (sensitiveFields.includes(field)) {
          filtered[field] = '🔒 Unlock with Premium Subscription';
        } else {
          filtered[field] = '🔒 [Premium Content - Upgrade to View]';
        }
      }
    }

    // Preserve existing attachment Public/Private permission filtering independently
    if (Array.isArray(filtered.attachments)) {
      filtered.attachments = filtered.attachments.filter((a: any) => a && a.isPublic === true);
    }

    return filtered;
  }
}
