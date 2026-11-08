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
  static sanitizeFlags(raw: any): AdminFeatureFlags {
    const result: AdminFeatureFlags = { ...DEFAULT_FEATURE_FLAGS };
    if (!raw || typeof raw !== 'object') {
      return result;
    }
    for (const key of Object.keys(DEFAULT_FEATURE_FLAGS) as (keyof AdminFeatureFlags)[]) {
      if (raw[key] !== undefined && typeof raw[key] === 'boolean') {
        result[key] = raw[key];
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
    return this.sanitizeFlags(doc.flags);
  }

  static async saveFlags(updates: Partial<AdminFeatureFlags>, currentFlags: AdminFeatureFlags): Promise<AdminFeatureFlags> {
    if (!isMongoConfigured()) {
      return FeatureFlagsRepository.sanitizeFlags({ ...currentFlags, ...updates });
    }

    const merged = FeatureFlagsRepository.sanitizeFlags({ ...currentFlags, ...updates });

    const db = await getMongoDb();
    const coll = db.collection(COLLECTION_NAME);

    await withMongoTimeout(
      coll.updateOne(
        { key: DOC_KEY },
        { $set: { key: DOC_KEY, flags: merged, updatedAt: new Date().toISOString() } },
        { upsert: true }
      ),
      8000,
      'save feature flags'
    );

    return merged;
  }
}
