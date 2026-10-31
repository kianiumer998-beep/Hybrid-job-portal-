import fs from 'fs';
import path from 'path';
import { getMongoDb, isMongoConfigured } from '../mongodb';

export type FieldVisibility = 'Free' | 'Premium' | 'Hidden';
export type JobSourceType = 'user_posted' | 'scraped' | 'admin_created';

export interface VisibilityPolicy {
  source: JobSourceType;
  sourceKey?: string; // Optional source-specific key for scrapers
  fieldRules: Record<string, FieldVisibility>;
  updatedAt: string;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const POLICIES_FILE = path.join(DATA_DIR, 'job_visibility_policies.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DEFAULT_SUPPORTED_FIELDS = [
  'title', 'company', 'companyLogo', 'jobType', 'region', 'country', 'province',
  'city', 'district', 'salary', 'experienceLevel', 'department', 'tags',
  'description', 'requirements', 'responsibilities', 'benefits', 'deadlineDate',
  'attachments', 'applicationUrl', 'contactEmail'
];

function getDefaultPolicy(source: JobSourceType): VisibilityPolicy {
  const fieldRules: Record<string, FieldVisibility> = {};
  for (const f of DEFAULT_SUPPORTED_FIELDS) {
    // Default sensitive fields to Free or Premium as appropriate, others Free
    if (['applicationUrl', 'contactEmail', 'attachments'].includes(f)) {
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

  static {
    try {
      if (fs.existsSync(POLICIES_FILE)) {
        const content = fs.readFileSync(POLICIES_FILE, 'utf-8');
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          for (const p of parsed) {
            if (p && p.source) {
              const key = p.sourceKey ? `${p.source}:${p.sourceKey}` : p.source;
              JobVisibilityRepository.localPolicies.set(key, p);
            }
          }
        }
      }
    } catch (err) {
      console.warn('[JobVisibilityRepository] Failed to load local visibility policies:', err);
    }
  }

  private static saveLocalPolicies(): void {
    try {
      const arr = Array.from(JobVisibilityRepository.localPolicies.values());
      fs.writeFileSync(POLICIES_FILE, JSON.stringify(arr, null, 2), 'utf-8');
    } catch (err) {
      console.error('[JobVisibilityRepository] Failed to save local visibility policies:', err);
    }
  }

  /**
   * Retrieves the active policy for a given source and optional sourceKey.
   */
  static async getPolicy(source: JobSourceType, sourceKey?: string): Promise<VisibilityPolicy> {
    if (isMongoConfigured()) {
      try {
        const db = getMongoDb();
        const coll = db.collection('job_visibility_policies');
        const query: any = { source };
        if (sourceKey) query.sourceKey = sourceKey;
        const doc = await coll.findOne(query);
        if (doc) {
          return {
            source: doc.source,
            sourceKey: doc.sourceKey,
            fieldRules: doc.fieldRules || {},
            updatedAt: doc.updatedAt || new Date().toISOString()
          };
        }
      } catch (err) {
        console.warn('[JobVisibilityRepository] Mongo policy get error, falling back:', err);
      }
    }

    const key = sourceKey ? `${source}:${sourceKey}` : source;
    return JobVisibilityRepository.localPolicies.get(key) || getDefaultPolicy(source);
  }

  /**
   * Retrieves all policies.
   */
  static async getAllPolicies(): Promise<VisibilityPolicy[]> {
    if (isMongoConfigured()) {
      try {
        const db = getMongoDb();
        const coll = db.collection('job_visibility_policies');
        const docs = await coll.find({}).toArray();
        if (docs.length > 0) {
          return docs.map(d => ({
            source: d.source,
            sourceKey: d.sourceKey,
            fieldRules: d.fieldRules || {},
            updatedAt: d.updatedAt || new Date().toISOString()
          }));
        }
      } catch (err) {
        console.warn('[JobVisibilityRepository] Mongo get all policies error:', err);
      }
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
      try {
        const db = getMongoDb();
        const coll = db.collection('job_visibility_policies');
        const query: any = { source };
        if (sourceKey) query.sourceKey = sourceKey;
        else query.sourceKey = { $exists: false };

        await coll.updateOne(query, { $set: policy }, { upsert: true });
      } catch (err) {
        console.error('[JobVisibilityRepository] Mongo policy save error:', err);
        throw new Error('Failed to persist visibility policy to MongoDB.');
      }
    }

    const key = sourceKey ? `${source}:${sourceKey}` : source;
    JobVisibilityRepository.localPolicies.set(key, policy);
    JobVisibilityRepository.saveLocalPolicies();

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
   * Applies the appropriate default policy to a job during approval or creation.
   */
  static async applyPolicyToJob(job: any): Promise<any> {
    if (!job) return job;
    // If job already has explicit fieldVisibility rules set, respect individual overrides
    if (job.fieldVisibility && typeof job.fieldVisibility === 'object' && Object.keys(job.fieldVisibility).length > 0) {
      return job;
    }

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

    return {
      ...job,
      fieldVisibility: { ...(policy.fieldRules || {}) },
      visibilitySource: source
    };
  }

  /**
   * Filters job fields based on requester's role and authoritative subscription status.
   */
  static filterJobForUser(job: any, user: any): any {
    if (!job) return job;

    const isAdmin = Boolean(
      user && ['Super Admin', 'Admin', 'Job Moderator', 'Scraper Manager'].includes(user.role)
    );
    if (isAdmin) {
      return job;
    }

    // Check authoritative premium entitlement
    const isPremiumActive = Boolean(
      user &&
      user.plan === 'Premium' &&
      user.membershipStatus === 'Active' &&
      (!user.expiryDate || new Date(user.expiryDate).getTime() > Date.now())
    );

    const rules = job.fieldVisibility || {};
    const filtered = { ...job };

    for (const field of DEFAULT_SUPPORTED_FIELDS) {
      const visibility: FieldVisibility = rules[field] || (['applicationUrl', 'contactEmail', 'attachments'].includes(field) ? 'Premium' : 'Free');

      if (visibility === 'Hidden') {
        delete filtered[field];
      } else if (visibility === 'Premium' && !isPremiumActive) {
        // Redact premium field for free or unauthenticated users
        if (field === 'attachments') {
          filtered[field] = [];
        } else if (field === 'applicationUrl' || field === 'contactEmail') {
          filtered[field] = '🔒 Unlock with Premium Subscription';
        } else {
          filtered[field] = '🔒 [Premium Content - Upgrade to View]';
        }
      }
    }

    return filtered;
  }
}
