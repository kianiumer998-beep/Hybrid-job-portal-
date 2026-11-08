import { AdminFeatureFlags } from '../../../src/types/job';
import { getMongoDb, isMongoConfigured, withMongoTimeout } from '../mongodb';

const COLLECTION_NAME = 'system_settings';
const DOC_KEY = 'admin_feature_flags';

export const DEFAULT_FEATURE_FLAGS: AdminFeatureFlags = {
  enableWebScraper: true,
  enableUniversalKeywordlessScraper: true,
  enableNewspaperClippings: true,
  enableScraperAutoApprove: false,
  enableGovtJobsPortal: true,
  enablePostingFeePaywall: true,
  enableCvBuilderPaywall: true,
  enableLiveSupportChat: true,
  deduplicationEnabled: true,
};

export class FeatureFlagsRepository {
  static sanitizeFlags(raw: any, current: AdminFeatureFlags = DEFAULT_FEATURE_FLAGS): AdminFeatureFlags {
    const result: AdminFeatureFlags = { ...current };
    if (!raw || typeof raw !== 'object') {
      return result;
    }
    for (const key of Object.keys(DEFAULT_FEATURE_FLAGS) as (keyof AdminFeatureFlags)[]) {
      if (raw[key] !== undefined) {
        if (typeof raw[key] === 'boolean') {
          result[key] = raw[key];
        }
        // If raw[key] is not a boolean (invalid value), preserve existing valid value (current[key])
      }
    }
    return result;
  }

  static async getFlags(): Promise<AdminFeatureFlags> {
    if (!isMongoConfigured()) {
      return { ...DEFAULT_FEATURE_FLAGS };
    }
    const db = await getMongoDb();
    const coll = db.collection(COLLECTION_NAME);
    const doc = await withMongoTimeout(
      coll.findOne({ key: DOC_KEY }),
      8000,
      'fetch feature flags'
    );
    if (!doc || !doc.flags) {
      return { ...DEFAULT_FEATURE_FLAGS };
    }
    return this.sanitizeFlags(doc.flags, DEFAULT_FEATURE_FLAGS);
  }

  static async saveFlags(updates: Partial<AdminFeatureFlags>, currentFlags?: AdminFeatureFlags): Promise<AdminFeatureFlags> {
    if (!isMongoConfigured()) {
      const baseline = currentFlags || DEFAULT_FEATURE_FLAGS;
      return FeatureFlagsRepository.sanitizeFlags(updates, baseline);
    }

    // Use latest persisted document as baseline when MongoDB is configured
    const latest = await this.getFlags();
    const merged = this.sanitizeFlags(updates, latest);

    const db = await getMongoDb();
    const coll = db.collection(COLLECTION_NAME);

    const setFields: Record<string, any> = {
      updatedAt: new Date().toISOString()
    };
    for (const key of Object.keys(DEFAULT_FEATURE_FLAGS) as (keyof AdminFeatureFlags)[]) {
      setFields[`flags.${key}`] = merged[key];
    }

    await withMongoTimeout(
      coll.updateOne(
        { key: DOC_KEY },
        { 
          $set: setFields,
          $setOnInsert: { key: DOC_KEY }
        },
        { upsert: true }
      ),
      8000,
      'save feature flags'
    );

    return merged;
  }
}
