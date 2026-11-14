import fs from 'fs';
import path from 'path';
import { SiteSeoConfig } from '../../../src/types/adminSuite';
import { INITIAL_SITE_SEO_CONFIG } from '../../../src/data/mockAdminSuiteData';
import { getMongoDb, isMongoConfigured, withMongoTimeout } from '../mongodb';

const COLLECTION_NAME = 'system_settings';
const DOC_KEY = 'site_seo_config';

export const SEO_COLLECTION_NAME = COLLECTION_NAME;
export const SEO_DOC_KEY = DOC_KEY;

export type StoredSiteSeoConfig = SiteSeoConfig & {
  updatedAt?: string;
};

const VALID_BANNER_TYPES = new Set(['info', 'warning', 'success', 'urgent']);

const isTest = () => process.env.IS_TEST === 'true';
let testSeoConfig: StoredSiteSeoConfig | null = null;

export function resetSeoTestStore(): void {
  testSeoConfig = null;
}

export function cloneDefaultSeoConfig(): StoredSiteSeoConfig {
  return {
    ...INITIAL_SITE_SEO_CONFIG,
    metaKeywords: [...INITIAL_SITE_SEO_CONFIG.metaKeywords],
    announcementBanner: {
      ...INITIAL_SITE_SEO_CONFIG.announcementBanner
    }
  };
}

export function normalizeSeoConfig(raw: any, base?: SiteSeoConfig): StoredSiteSeoConfig {
  const fallback = base ? normalizeSeoConfigRaw(base) : cloneDefaultSeoConfig();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return fallback;
  }

  const rawBanner =
    raw.announcementBanner && typeof raw.announcementBanner === 'object' && !Array.isArray(raw.announcementBanner)
      ? raw.announcementBanner
      : {};

  const bannerType =
    typeof rawBanner.bannerType === 'string' && VALID_BANNER_TYPES.has(rawBanner.bannerType)
      ? (rawBanner.bannerType as SiteSeoConfig['announcementBanner']['bannerType'])
      : fallback.announcementBanner.bannerType;

  const metaKeywords = Array.isArray(raw.metaKeywords)
    ? raw.metaKeywords.filter((k: any) => typeof k === 'string').map((k: string) => k.trim()).filter(Boolean)
    : [...fallback.metaKeywords];

  const normalized: StoredSiteSeoConfig = {
    siteTitle: typeof raw.siteTitle === 'string' ? raw.siteTitle : fallback.siteTitle,
    tagline: typeof raw.tagline === 'string' ? raw.tagline : fallback.tagline,
    metaDescription: typeof raw.metaDescription === 'string' ? raw.metaDescription : fallback.metaDescription,
    metaKeywords,
    canonicalUrl: typeof raw.canonicalUrl === 'string' ? raw.canonicalUrl : fallback.canonicalUrl,
    ogImageUrl: typeof raw.ogImageUrl === 'string' ? raw.ogImageUrl : fallback.ogImageUrl,
    twitterHandle: typeof raw.twitterHandle === 'string' ? raw.twitterHandle : fallback.twitterHandle,
    googleSearchConsoleVerification:
      typeof raw.googleSearchConsoleVerification === 'string'
        ? raw.googleSearchConsoleVerification
        : fallback.googleSearchConsoleVerification,
    bingWebmasterVerification:
      typeof raw.bingWebmasterVerification === 'string'
        ? raw.bingWebmasterVerification
        : fallback.bingWebmasterVerification,
    googleAnalyticsId:
      typeof raw.googleAnalyticsId === 'string' ? raw.googleAnalyticsId : fallback.googleAnalyticsId,
    googleTagManagerId:
      typeof raw.googleTagManagerId === 'string' ? raw.googleTagManagerId : fallback.googleTagManagerId,
    facebookPixelId:
      typeof raw.facebookPixelId === 'string' ? raw.facebookPixelId : fallback.facebookPixelId,
    robotsTxtContent:
      typeof raw.robotsTxtContent === 'string' ? raw.robotsTxtContent : fallback.robotsTxtContent,
    maintenanceMode:
      typeof raw.maintenanceMode === 'boolean' ? raw.maintenanceMode : fallback.maintenanceMode,
    maintenanceNotice:
      typeof raw.maintenanceNotice === 'string' ? raw.maintenanceNotice : fallback.maintenanceNotice,
    announcementBanner: {
      enabled:
        typeof rawBanner.enabled === 'boolean'
          ? rawBanner.enabled
          : fallback.announcementBanner.enabled,
      text:
        typeof rawBanner.text === 'string'
          ? rawBanner.text
          : fallback.announcementBanner.text,
      linkUrl:
        typeof rawBanner.linkUrl === 'string'
          ? rawBanner.linkUrl
          : fallback.announcementBanner.linkUrl,
      linkText:
        typeof rawBanner.linkText === 'string'
          ? rawBanner.linkText
          : fallback.announcementBanner.linkText,
      bannerType
    }
  };

  if (typeof raw.updatedAt === 'string' && raw.updatedAt.trim()) {
    normalized.updatedAt = raw.updatedAt;
  }

  return normalized;
}

function normalizeSeoConfigRaw(cfg: SiteSeoConfig): StoredSiteSeoConfig {
  return {
    ...cfg,
    metaKeywords: Array.isArray(cfg.metaKeywords) ? [...cfg.metaKeywords] : [],
    announcementBanner: {
      ...(cfg.announcementBanner || INITIAL_SITE_SEO_CONFIG.announcementBanner)
    }
  };
}

function stripReservedKeys(payload: Record<string, any>): Record<string, any> {
  const { _id, key, ...rest } = payload;
  return rest;
}

function readLegacyJsonReadOnly(legacyFilePath?: string): any | null {
  const filePath = legacyFilePath || path.resolve(process.cwd(), 'data', 'seo_config.json');
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const raw = fs.readFileSync(filePath, 'utf-8');
    if (!raw || !raw.trim()) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }
    return parsed;
  } catch (err) {
    console.warn('[SeoRepository] Legacy seo_config.json read warning (ignored safely):', err);
    return null;
  }
}

export class SeoRepository {
  static async getConfig(overrideCollection?: any, overrideDocKey?: string): Promise<StoredSiteSeoConfig> {
    if (!overrideCollection && isTest() && !isMongoConfigured()) {
      if (testSeoConfig) {
        return normalizeSeoConfig(testSeoConfig);
      }
      return cloneDefaultSeoConfig();
    }

    if (!overrideCollection && !isMongoConfigured()) {
      return cloneDefaultSeoConfig();
    }

    const docKey = overrideDocKey || DOC_KEY;
    let doc: any = null;

    if (overrideCollection) {
      doc = await overrideCollection.findOne({ key: docKey });
    } else {
      const db = await getMongoDb();
      const coll = db.collection(COLLECTION_NAME);
      doc = await withMongoTimeout(
        coll.findOne({ key: docKey }),
        8000,
        'fetch SEO config'
      );
    }

    if (!doc) {
      // One-time non-destructive migration if legacy data/seo_config.json exists on disk (read-only)
      const legacy = readLegacyJsonReadOnly();
      if (legacy) {
        const migrated = await this.migrateLegacyConfigIfUnconfigured(
          legacy,
          overrideCollection,
          docKey
        );
        return migrated.config;
      }
      return cloneDefaultSeoConfig();
    }

    const storedPayload = doc.config !== undefined ? doc.config : doc.value;
    if (!storedPayload || typeof storedPayload !== 'object' || Array.isArray(storedPayload)) {
      throw new Error(
        'Data Integrity Error: SEO configuration document exists in database but has invalid or missing "config" field.'
      );
    }

    return normalizeSeoConfig(storedPayload);
  }

  static async saveConfig(
    updates: Partial<StoredSiteSeoConfig> | Record<string, any>,
    overrideCollection?: any,
    overrideDocKey?: string
  ): Promise<StoredSiteSeoConfig> {
    if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
      throw new Error('Validation Error: SEO configuration payload must be a JSON object.');
    }

    const cleanUpdates = stripReservedKeys(updates);

    if (!overrideCollection && isTest() && !isMongoConfigured()) {
      const current = testSeoConfig ? normalizeSeoConfig(testSeoConfig) : cloneDefaultSeoConfig();
      const merged = normalizeSeoConfig(
        {
          ...current,
          ...cleanUpdates,
          announcementBanner: {
            ...current.announcementBanner,
            ...(cleanUpdates.announcementBanner && typeof cleanUpdates.announcementBanner === 'object'
              ? cleanUpdates.announcementBanner
              : {})
          },
          updatedAt: new Date().toISOString()
        },
        current
      );
      testSeoConfig = merged;
      return normalizeSeoConfig(merged);
    }

    if (!overrideCollection && !isMongoConfigured()) {
      throw new Error('Database unavailable: Cannot persist SEO configuration when MongoDB is not configured.');
    }

    const docKey = overrideDocKey || DOC_KEY;
    const current = await this.getConfig(overrideCollection, docKey);
    const updatedAt = new Date().toISOString();

    const updatedConfig = normalizeSeoConfig(
      {
        ...current,
        ...cleanUpdates,
        announcementBanner: {
          ...current.announcementBanner,
          ...(cleanUpdates.announcementBanner && typeof cleanUpdates.announcementBanner === 'object'
            ? cleanUpdates.announcementBanner
            : {})
        },
        updatedAt
      },
      current
    );

    if (overrideCollection) {
      const result = await overrideCollection.updateOne(
        { key: docKey },
        {
          $set: {
            key: docKey,
            config: updatedConfig,
            updatedAt
          }
        },
        { upsert: true }
      );
      if (result && result.acknowledged === false) {
        throw new Error('Database Write Error: MongoDB write operation was not acknowledged.');
      }
    } else {
      const db = await getMongoDb();
      const coll = db.collection(COLLECTION_NAME);
      const result = await withMongoTimeout(
        coll.updateOne(
          { key: docKey },
          {
            $set: {
              key: docKey,
              config: updatedConfig,
              updatedAt
            }
          },
          { upsert: true }
        ),
        8000,
        'save SEO config'
      );
      if (result && result.acknowledged === false) {
        throw new Error('Database Write Error: MongoDB write operation was not acknowledged.');
      }
    }

    return await this.getConfig(overrideCollection, docKey);
  }

  static async migrateLegacyConfigIfUnconfigured(
    legacyPayload?: any,
    overrideCollection?: any,
    overrideDocKey?: string,
    legacyFilePath?: string
  ): Promise<{ migrated: boolean; config: StoredSiteSeoConfig }> {
    const rawLegacy = legacyPayload !== undefined ? legacyPayload : readLegacyJsonReadOnly(legacyFilePath);
    if (!rawLegacy || typeof rawLegacy !== 'object' || Array.isArray(rawLegacy)) {
      return {
        migrated: false,
        config: await this.getConfig(overrideCollection, overrideDocKey)
      };
    }

    const candidateConfig = normalizeSeoConfig(stripReservedKeys(rawLegacy));
    const docKey = overrideDocKey || DOC_KEY;
    const now = new Date().toISOString();

    if (!overrideCollection && isTest() && !isMongoConfigured()) {
      if (!testSeoConfig) {
        testSeoConfig = {
          ...candidateConfig,
          updatedAt: candidateConfig.updatedAt || now
        };
        return { migrated: true, config: normalizeSeoConfig(testSeoConfig) };
      }
      return { migrated: false, config: normalizeSeoConfig(testSeoConfig) };
    }

    if (!overrideCollection && !isMongoConfigured()) {
      throw new Error('Database unavailable: Cannot migrate legacy SEO configuration when MongoDB is not configured.');
    }

    let res: any;
    if (overrideCollection) {
      res = await overrideCollection.updateOne(
        { key: docKey },
        {
          $setOnInsert: {
            key: docKey,
            config: candidateConfig,
            migratedFromLegacyJsonAt: now,
            updatedAt: candidateConfig.updatedAt || now
          }
        },
        { upsert: true }
      );
    } else {
      const db = await getMongoDb();
      const coll = db.collection(COLLECTION_NAME);
      res = await withMongoTimeout(
        coll.updateOne(
          { key: docKey },
          {
            $setOnInsert: {
              key: docKey,
              config: candidateConfig,
              migratedFromLegacyJsonAt: now,
              updatedAt: candidateConfig.updatedAt || now
            }
          },
          { upsert: true }
        ),
        8000,
        'migrate legacy SEO config if unconfigured'
      );
    }

    if (res && res.acknowledged === false) {
      throw new Error('Database Write Error: MongoDB migration write operation was not acknowledged.');
    }

    const inserted = Boolean(res && res.upsertedCount && res.upsertedCount > 0);
    // Read directly from collection to avoid recursion
    let currentDoc: any = null;
    if (overrideCollection) {
      currentDoc = await overrideCollection.findOne({ key: docKey });
    } else {
      const db = await getMongoDb();
      const coll = db.collection(COLLECTION_NAME);
      currentDoc = await withMongoTimeout(coll.findOne({ key: docKey }), 8000, 'readback SEO config');
    }

    const storedPayload = currentDoc ? (currentDoc.config !== undefined ? currentDoc.config : currentDoc.value) : null;
    return {
      migrated: inserted,
      config: storedPayload ? normalizeSeoConfig(storedPayload) : candidateConfig
    };
  }
}
