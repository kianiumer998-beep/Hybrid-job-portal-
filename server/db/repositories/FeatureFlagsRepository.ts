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
        // Invalid, missing, or unknown keys preserve existing valid value from current.
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

    const db = await getMongoDb();
    const coll = db.collection(COLLECTION_NAME);

    // 1. Ensure document exists first using atomic upsert with $setOnInsert for defaults
    const setOnInsertFields: Record<string, any> = {
      key: DOC_KEY,
      updatedAt: new Date().toISOString()
    };
    for (const key of Object.keys(DEFAULT_FEATURE_FLAGS) as (keyof AdminFeatureFlags)[]) {
      setOnInsertFields[`flags.${key}`] = DEFAULT_FEATURE_FLAGS[key];
    }

    await withMongoTimeout(
      coll.updateOne(
        { key: DOC_KEY },
        { $setOnInsert: setOnInsertFields },
        { upsert: true }
      ),
      8000,
      'ensure feature flags document'
    );

    // 2. Perform separate atomic $set operation containing only explicitly supplied valid boolean flag fields and updatedAt
    const setFields: Record<string, any> = {
      updatedAt: new Date().toISOString()
    };

    let hasValidUpdates = false;
    if (updates && typeof updates === 'object') {
      for (const key of Object.keys(DEFAULT_FEATURE_FLAGS) as (keyof AdminFeatureFlags)[]) {
        if (updates[key] !== undefined && typeof updates[key] === 'boolean') {
          setFields[`flags.${key}`] = updates[key];
          hasValidUpdates = true;
        }
      }
    }

    if (hasValidUpdates) {
      await withMongoTimeout(
        coll.updateOne(
          { key: DOC_KEY },
          { $set: setFields },
          { upsert: true }
        ),
        8000,
        'update feature flags'
      );
    }

    return await this.getFlags();
  }
}
