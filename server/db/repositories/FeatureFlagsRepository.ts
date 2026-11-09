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
  enableEmailAlerts: false,
  enableWhatsAppAlerts: false,
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

    // 2. Perform separate atomic $set update (upsert: false since document is guaranteed to exist by step 1)
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
      const updateResult = await withMongoTimeout(
        coll.updateOne(
          { key: DOC_KEY },
          { $set: setFields },
          { upsert: false }
        ),
        8000,
        'update feature flags'
      );

      // Bounded recovery strategy: if document disappeared between step 1 and step 2 (matchedCount === 0),
      // re-ensure the document with $setOnInsert and retry the $set update separately to prevent path conflicts.
      if (updateResult.matchedCount === 0) {
        await withMongoTimeout(
          coll.updateOne(
            { key: DOC_KEY },
            { $setOnInsert: setOnInsertFields },
            { upsert: true }
          ),
          8000,
          're-ensure feature flags document'
        );

        const retryResult = await withMongoTimeout(
          coll.updateOne(
            { key: DOC_KEY },
            { $set: setFields },
            { upsert: false }
          ),
          8000,
          'retry update feature flags'
        );

        if (retryResult.matchedCount === 0) {
          throw new Error('Persistence Error: Failed to update feature flags document in MongoDB after recovery attempt.');
        }
      }
    }

    return await this.getFlags();
  }
}
