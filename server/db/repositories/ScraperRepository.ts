import {
  getScraperSourcesCollection,
  getScraperRunsCollection,
  getScraperGroupsCollection,
  getMongoDb,
  isMongoConfigured,
  isMongoAvailable,
  resetMongoClient
} from '../mongodb';
import { ALL_VERIFIED_SCRAPER_PORTALS } from '../../../src/data/allScraperPortals';

export interface ScraperSchedulerSettings {
  enabled: boolean;
  interval: string;
  scope: 'all' | 'selected' | 'group' | 'working' | 'failed' | 'single';
  selectedSourceIds?: string[];
  selectedGroupId?: string;
  singleSourceId?: string;
  scanMode?: 'since_last' | 'complete' | 'page_range';
  startPage?: number;
  endPage?: number;
  duplicateMode?: 'with' | 'without';
  autoApprove?: boolean;
  depth?: string;
  keywords?: string;
  updatedAt?: string;
  isPersistedToMongo?: boolean;
}

export function getDefaultSchedulerSettings(): ScraperSchedulerSettings {
  return {
    enabled: true,
    interval: '24h',
    scope: 'all',
    selectedSourceIds: [],
    selectedGroupId: '',
    singleSourceId: '',
    scanMode: 'since_last',
    startPage: 1,
    endPage: 1,
    duplicateMode: 'with',
    autoApprove: false,
    depth: 'Standard (25 Jobs)',
    keywords: 'jobs, careers, recruitment, vacancies, officers, lecturer',
    updatedAt: new Date().toISOString(),
    isPersistedToMongo: false
  };
}

/**
 * Safely executes a promise with an enforced timeout to prevent network stalls.
 */
export async function withMongoTimeout<T>(promise: Promise<T>, timeoutMs = 15000, label = 'Operation'): Promise<T> {
  let timer: NodeJS.Timeout | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const timeoutErr = new Error(`MongoDB ${label} timed out after ${timeoutMs}ms`);
      timeoutErr.name = 'MongoNetworkTimeoutError';
      reject(timeoutErr);
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    return result;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export interface ScraperSourceGroup {
  id: string;
  name: string;
  description?: string;
  sourceIds: string[];
  createdAt: string;
  updatedAt: string;
}

function getDefaultGroups(): ScraperSourceGroup[] {
  const portals = ALL_VERIFIED_SCRAPER_PORTALS || [];
  const now = new Date().toISOString();

  const govtIds = portals.filter(p => p.category === 'Public Service Commission' || p.category === 'Federal Ministry' || p.sector === 'Federal & Autonomous').map(p => p.id);
  const federalIds = portals.filter(p => p.jurisdiction === 'Federal').map(p => p.id);
  const punjabIds = portals.filter(p => p.jurisdiction === 'Punjab').map(p => p.id);
  const sindhIds = portals.filter(p => p.jurisdiction === 'Sindh').map(p => p.id);
  const eduIds = portals.filter(p => p.category === 'Higher Education & Universities').map(p => p.id);
  const healthIds = portals.filter(p => p.category === 'Healthcare & Medical Cadres').map(p => p.id);
  const testingIds = portals.filter(p => p.category === 'Testing & Assessment Service').map(p => p.id);

  return [
    {
      id: 'group-government',
      name: 'Government',
      description: 'Federal ministries, commissions, and core constitutional authorities',
      sourceIds: govtIds,
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'group-federal',
      name: 'Federal',
      description: 'All Federal jurisdiction departments and autonomous agencies',
      sourceIds: federalIds,
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'group-punjab',
      name: 'Punjab',
      description: 'Punjab Provincial departments, authorities, and testing services',
      sourceIds: punjabIds,
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'group-sindh',
      name: 'Sindh',
      description: 'Sindh Provincial departments, health networks, and public bodies',
      sourceIds: sindhIds,
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'group-education',
      name: 'Education',
      description: 'Public sector universities, academic colleges, and education directorates',
      sourceIds: eduIds,
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'group-healthcare',
      name: 'Healthcare',
      description: 'Medical colleges, specialized healthcare directorates, and hospital cadres',
      sourceIds: healthIds,
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'group-testing-services',
      name: 'Testing Services',
      description: 'NTS, PTS, OTS, ETEA, UTS, and recruitment screening testing services',
      sourceIds: testingIds,
      createdAt: now,
      updatedAt: now
    }
  ];
}

function getDefaultSources(): any[] {
  return (ALL_VERIFIED_SCRAPER_PORTALS || []).map((s: any) => ({
    ...s,
    url: s.url || s.portalUrl || s.pdfUrl || '',
    portalUrl: s.portalUrl || s.url || '',
    status: s.status || 'Active Scheduled',
    interval: s.interval || '24h',
    healthStatus: s.healthStatus || 'healthy'
  }));
}

export class ScraperRepository {
  private static cachedSources: any[] = getDefaultSources();
  private static cachedRuns: any[] = [];
  private static cachedSettings: ScraperSchedulerSettings = getDefaultSchedulerSettings();

  /**
   * Retrieves all scraper source configurations from MongoDB scraper_sources collection.
   * On confirmed empty collection, auto-seeds verified default sources into MongoDB.
   * In configured-MongoDB mode, DB lookup/read/timeout/seed failures propagate (fail-closed)
   * instead of falling back to cached or default configurations.
   */
  static async getConfigs(_deps?: {
    isMongoConfiguredFn?: () => boolean;
    getCollectionFn?: () => Promise<any>;
  }): Promise<any[]> {
    const isMongoCfgFn = _deps?.isMongoConfiguredFn || isMongoConfigured;
    const getCollFn = _deps?.getCollectionFn || getScraperSourcesCollection;

    if (isMongoCfgFn()) {
      const coll = await getCollFn();
      const docs: any = await withMongoTimeout<any>(
        coll.find({}, { projection: { _id: 0 } }).toArray(),
        15000,
        'getConfigs'
      );

      if (!Array.isArray(docs)) {
        throw new Error('Unexpected non-array response reading scraper_sources from MongoDB');
      }

      if (docs.length > 0) {
        let hasMissingStatus = false;
        const normalized = docs.map((s: any) => {
          const status = s.status || 'Active Scheduled';
          const interval = s.interval || '24h';
          if (!s.status || !s.interval) {
            hasMissingStatus = true;
          }
          return {
            ...s,
            status,
            interval,
            url: s.url || s.portalUrl || s.pdfUrl || '',
            portalUrl: s.portalUrl || s.url || '',
            healthStatus: s.healthStatus || 'healthy'
          };
        });

        if (hasMissingStatus && typeof coll.updateMany === 'function') {
          coll.updateMany(
            { $or: [{ status: { $exists: false } }, { status: null }, { status: '' }, { interval: { $exists: false } }] },
            { $set: { status: 'Active Scheduled', interval: '24h' } }
          ).catch((e: any) => console.warn('[ScraperRepository] Notice updating missing statuses:', e?.message || e));
        }

        this.cachedSources = normalized;
        return normalized;
      }

      // Auto-seed initial sources into MongoDB scraper_sources collection ONLY when confirmed empty
      const defaults = getDefaultSources();
      if (defaults.length > 0) {
        const cleanDocs = defaults.map(s => {
          const { _id, ...clean } = s as any;
          return {
            ...clean,
            status: clean.status || 'Active Scheduled',
            interval: clean.interval || '24h',
            healthStatus: clean.healthStatus || 'healthy'
          };
        });
        const seedResult: any = await withMongoTimeout<any>(coll.insertMany(cleanDocs), 15000, 'seedConfigs');
        if (
          !seedResult ||
          seedResult.acknowledged !== true ||
          typeof seedResult.insertedCount !== 'number' ||
          seedResult.insertedCount !== cleanDocs.length
        ) {
          throw new Error(
            `MongoDB insertMany seeding scraper_sources failed confirmation (acknowledged=${String(seedResult?.acknowledged)}, insertedCount=${String(seedResult?.insertedCount)}, expected=${cleanDocs.length})`
          );
        }
        console.log(`[ScraperRepository] Seeded ${cleanDocs.length} scraper sources into MongoDB scraper_sources.`);
        this.cachedSources = cleanDocs;
        return cleanDocs;
      }

      this.cachedSources = [];
      return [];
    }

    return this.cachedSources;
  }

  /**
   * Persists all scraper source configurations directly to MongoDB scraper_sources collection.
   * In configured-MongoDB mode, in-memory cache is only replaced once all configurations are verified persisted.
   * If persistence fails or partially fails, last known cache state is retained and an error is thrown.
   */
  static async saveConfigs(
    configs: any[],
    _deps?: {
      isMongoConfiguredFn?: () => boolean;
      getCollectionFn?: () => Promise<any>;
    }
  ): Promise<void> {
    if (!Array.isArray(configs)) return;

    const isMongoCfgFn = _deps?.isMongoConfiguredFn || isMongoConfigured;
    const getCollFn = _deps?.getCollectionFn || getScraperSourcesCollection;

    if (!isMongoCfgFn()) {
      this.cachedSources = configs;
      return;
    }

    let coll: any;
    try {
      coll = await getCollFn();
    } catch (collErr: any) {
      const msg = `Failed to get scraper_sources collection: ${collErr?.message || collErr}`;
      console.warn(`[ScraperRepository] ${msg}`);
      throw new Error(msg);
    }

    const validConfigs = configs.filter(cfg => cfg && cfg.id);
    let persistedCount = 0;

    for (const cfg of validConfigs) {
      const { _id, ...clean } = cfg;
      try {
        const result: any = await withMongoTimeout<any>(
          coll.replaceOne({ id: clean.id }, clean, { upsert: true }),
          10000,
          'saveConfig'
        );
        const hasMatchOrUpsert =
          (typeof result?.matchedCount === 'number' && result.matchedCount > 0) ||
          (typeof result?.upsertedCount === 'number' && result.upsertedCount > 0);
        if (!result || result.acknowledged !== true || !hasMatchOrUpsert) {
          throw new Error(`Write was not confirmed by MongoDB for source "${clean.id}"`);
        }
        persistedCount++;
      } catch (err: any) {
        const errorMsg = persistedCount > 0
          ? `Partial persistence failure: persisted ${persistedCount}/${validConfigs.length} sources before error on source "${clean.id}": ${err?.message || err}`
          : `Failed to persist scraper configurations to MongoDB on source "${clean.id}": ${err?.message || err}`;
        console.warn(`[ScraperRepository] ${errorMsg}`);
        throw new Error(errorMsg);
      }
    }

    // Only update in-memory cache once all configurations have been successfully persisted to MongoDB
    this.cachedSources = configs;
  }

  /**
   * Retrieves scraper execution run history from MongoDB scraper_runs collection sorted by timestamp desc.
   * In configured-MongoDB mode, DB read failures propagate and confirmed empty collections clear cachedRuns.
   */
  static async getRuns(_deps?: {
    isMongoConfiguredFn?: () => boolean;
    getCollectionFn?: () => Promise<any>;
  }): Promise<any[]> {
    const isMongoCfgFn = _deps?.isMongoConfiguredFn || isMongoConfigured;
    const getCollFn = _deps?.getCollectionFn || getScraperRunsCollection;

    if (isMongoCfgFn()) {
      const coll = await getCollFn();
      const runs: any = await withMongoTimeout<any>(
        coll.find({}, { projection: { _id: 0 } })
          .sort({ startedAt: -1, timestamp: -1 })
          .limit(100)
          .toArray(),
        15000,
        'getRuns'
      );

      if (!Array.isArray(runs)) {
        throw new Error('Unexpected non-array response reading scraper_runs from MongoDB');
      }

      this.cachedRuns = runs;
      return runs;
    }

    return this.cachedRuns;
  }

  /**
   * Retrieves one bounded page of scraper history without truncating MongoDB history.
   * Offset pagination keeps the existing /runs response contract available to older clients.
   */
  static async getRunsPage(
    offset = 0,
    limit = 50,
    _deps?: {
      isMongoConfiguredFn?: () => boolean;
      getCollectionFn?: () => Promise<any>;
    }
  ): Promise<{ runs: any[]; total: number; hasMore: boolean }> {
    const safeOffset = Math.max(0, Math.floor(Number(offset) || 0));
    const safeLimit = Math.min(100, Math.max(1, Math.floor(Number(limit) || 50)));
    const isMongoCfgFn = _deps?.isMongoConfiguredFn || isMongoConfigured;
    const getCollFn = _deps?.getCollectionFn || getScraperRunsCollection;

    if (isMongoCfgFn()) {
      const coll = await getCollFn();
      const [runs, total] = await Promise.all([
        withMongoTimeout<any[]>(
          coll.find({}, { projection: { _id: 0 } })
            .sort({ startedAt: -1, timestamp: -1 })
            .skip(safeOffset)
            .limit(safeLimit)
            .toArray(),
          15000,
          'getRunsPage'
        ),
        withMongoTimeout<number>(coll.countDocuments({}), 15000, 'countScraperRuns')
      ]);

      if (!Array.isArray(runs) || !Number.isFinite(total)) {
        throw new Error('Unexpected response reading paginated scraper history from MongoDB');
      }
      if (safeOffset === 0) this.cachedRuns = runs.slice(0, 100);
      return { runs, total, hasMore: safeOffset + runs.length < total };
    }

    const runs = this.cachedRuns.slice(safeOffset, safeOffset + safeLimit);
    return {
      runs,
      total: this.cachedRuns.length,
      hasMore: safeOffset + runs.length < this.cachedRuns.length
    };
  }

  /**
   * Records a new scraper execution run into MongoDB scraper_runs collection.
   * Does NOT throw on Mongo failure so active scrape runs never fail after jobs are persisted;
   * skips updating cachedRuns on failed/unacknowledged Mongo writes and marks isPersistedToMongo=false.
   */
  static async addRun(
    run: any,
    _deps?: {
      isMongoConfiguredFn?: () => boolean;
      getCollectionFn?: () => Promise<any>;
    }
  ): Promise<any> {
    const isMongoCfgFn = _deps?.isMongoConfiguredFn || isMongoConfigured;
    const getCollFn = _deps?.getCollectionFn || getScraperRunsCollection;

    const newRun = {
      ...run,
      id: run.id || `run-${Date.now()}`,
      timestamp: run.startedAt || new Date().toISOString()
    };
    const { _id, ...clean } = newRun;

    if (isMongoCfgFn()) {
      try {
        const coll = await getCollFn();
        const insertResult: any = await withMongoTimeout<any>(coll.insertOne(clean), 10000, 'addRun');
        if (!insertResult || insertResult.acknowledged !== true) {
          const persistenceError = 'MongoDB insertOne was not explicitly acknowledged (acknowledged=true required)';
          console.error(`[ScraperRepository] ${persistenceError} for run "${clean.id}". Skipped adding to cachedRuns.`);
          return {
            ...clean,
            isPersistedToMongo: false,
            persistenceError
          };
        }

        this.cachedRuns.unshift(clean);
        if (this.cachedRuns.length > 100) {
          this.cachedRuns = this.cachedRuns.slice(0, 100);
        }
        return {
          ...clean,
          isPersistedToMongo: true
        };
      } catch (err: any) {
        const persistenceError = err?.message || String(err);
        console.error(`[ScraperRepository] Failed to persist scraper run "${clean.id}" to MongoDB: ${persistenceError}. Skipped adding to cachedRuns.`);
        return {
          ...clean,
          isPersistedToMongo: false,
          persistenceError
        };
      }
    }

    this.cachedRuns.unshift(clean);
    if (this.cachedRuns.length > 100) {
      this.cachedRuns = this.cachedRuns.slice(0, 100);
    }

    return {
      ...clean,
      isPersistedToMongo: false
    };
  }

  static isDatabaseHealthy(): boolean {
    return isMongoConfigured() && isMongoAvailable();
  }

  /**
   * Updates health stats, counts, and run timestamps for a scraper source in MongoDB scraper_sources collection.
   * When MongoDB is configured, in-memory cached stats are updated ONLY after the MongoDB write
   * is confirmed acknowledged and matched at least one document.
   */
  static async updateSourceStats(sourceId: string, stats: {
    lastStartedAt?: string;
    lastSuccessfulScrapeAt?: string;
    lastCompletedAt?: string;
    lastRunId?: string;
    scrapedCountIncrement?: number;
    healthStatus?: 'Healthy' | 'Jobs Found' | 'No Jobs' | '404' | '403' | 'Timeout' | 'Invalid PDF' | 'HTML' | 'Fetch Error' | 'Database Error' | 'Disabled' | string;
    lastErrorMessage?: string;
    lastHttpStatus?: number;
    provenExtractionMethodsToAdd?: string[];
  }, _deps?: {
    isMongoConfiguredFn?: () => boolean;
    getCollectionFn?: () => Promise<any>;
  }): Promise<void> {
    let mongoWriteSucceeded = false;
    const isMongoCfgFn = _deps?.isMongoConfiguredFn || isMongoConfigured;
    const getCollFn = _deps?.getCollectionFn || getScraperSourcesCollection;
    const mongoConfigured = isMongoCfgFn();
    const cleanProvenMethods = Array.isArray(stats.provenExtractionMethodsToAdd)
      ? Array.from(new Set(stats.provenExtractionMethodsToAdd.map(m => String(m || '').trim()).filter(Boolean)))
      : [];

    if (mongoConfigured) {
      try {
        const coll = await getCollFn();
        const $set: any = {};
        if (stats.lastStartedAt) $set.lastStartedAt = stats.lastStartedAt;
        if (stats.lastSuccessfulScrapeAt) $set.lastSuccessfulScrapeAt = stats.lastSuccessfulScrapeAt;
        if (stats.lastCompletedAt) $set.lastCompletedAt = stats.lastCompletedAt;
        if (stats.lastRunId) $set.lastRunId = stats.lastRunId;
        if (stats.healthStatus) $set.healthStatus = stats.healthStatus;
        if (stats.lastErrorMessage !== undefined) $set.lastErrorMessage = stats.lastErrorMessage;
        if (stats.lastHttpStatus !== undefined) $set.lastHttpStatus = stats.lastHttpStatus;

        const updateOps: any = {};
        if (Object.keys($set).length > 0) updateOps.$set = $set;
        if (stats.scrapedCountIncrement) updateOps.$inc = { scrapedCount: stats.scrapedCountIncrement };
        if (cleanProvenMethods.length > 0) {
          updateOps.$addToSet = { provenExtractionMethods: { $each: cleanProvenMethods } };
        }

        if (Object.keys(updateOps).length > 0) {
          const updateResult: any = await withMongoTimeout<any>(coll.updateOne({ id: sourceId }, updateOps), 10000, 'updateSourceStats');
          if (
            updateResult &&
            updateResult.acknowledged === true &&
            typeof updateResult.matchedCount === 'number' &&
            updateResult.matchedCount > 0
          ) {
            mongoWriteSucceeded = true;
          } else {
            console.warn(`[ScraperRepository] Warning: updateSourceStats lacked explicit acknowledgement (acknowledged=true) or matched 0 documents in MongoDB for source "${sourceId}". Cache update skipped.`);
          }
        } else {
          mongoWriteSucceeded = true;
        }
      } catch (err: any) {
        console.warn(`[ScraperRepository] Notice updating source stats for "${sourceId}" in MongoDB:`, err?.message || err);
      }
    }

    // Critical cache integrity rule: when MongoDB is configured, never mutate
    // in-memory source stats unless MongoDB write confirmation succeeded.
    if (mongoConfigured && !mongoWriteSucceeded) {
      console.warn(`[ScraperRepository] Skipped updating in-memory cached source stats for "${sourceId}" due to unpersisted MongoDB write.`);
      return;
    }

    // Update in-memory cached representation
    const idx = this.cachedSources.findIndex(s => s.id === sourceId);
    if (idx !== -1) {
      if (stats.lastStartedAt) this.cachedSources[idx].lastStartedAt = stats.lastStartedAt;
      if (stats.lastSuccessfulScrapeAt) this.cachedSources[idx].lastSuccessfulScrapeAt = stats.lastSuccessfulScrapeAt;
      if (stats.lastCompletedAt) this.cachedSources[idx].lastCompletedAt = stats.lastCompletedAt;
      if (stats.lastRunId) this.cachedSources[idx].lastRunId = stats.lastRunId;
      if (stats.scrapedCountIncrement) {
        this.cachedSources[idx].scrapedCount = (this.cachedSources[idx].scrapedCount || 0) + stats.scrapedCountIncrement;
      }
      if (stats.healthStatus) this.cachedSources[idx].healthStatus = stats.healthStatus;
      if (stats.lastErrorMessage !== undefined) this.cachedSources[idx].lastErrorMessage = stats.lastErrorMessage;
      if (stats.lastHttpStatus !== undefined) this.cachedSources[idx].lastHttpStatus = stats.lastHttpStatus;
      if (cleanProvenMethods.length > 0) {
        const existingMethods = Array.isArray(this.cachedSources[idx].provenExtractionMethods)
          ? this.cachedSources[idx].provenExtractionMethods
          : [];
        this.cachedSources[idx].provenExtractionMethods = Array.from(new Set([...existingMethods, ...cleanProvenMethods]));
      }
    }
  }

  /**
   * Updates only scheduling timing fields for a scraper source in MongoDB scraper_sources collection.
   * When MongoDB is configured, mutates cachedSources ONLY when write is confirmed
   * (acknowledged === true && matchedCount > 0). Returns true when persisted/no-op, false on unconfirmed/error.
   */
  static async updateSourceSchedule(
    sourceId: string,
    schedule: {
      lastRunAt?: string;
      lastCompletedAt?: string;
      nextRunAt?: string;
    },
    _deps?: {
      isMongoConfiguredFn?: () => boolean;
      getCollectionFn?: () => Promise<any>;
    }
  ): Promise<boolean> {
    const isMongoCfgFn = _deps?.isMongoConfiguredFn || isMongoConfigured;
    const getCollFn = _deps?.getCollectionFn || getScraperSourcesCollection;
    const mongoConfigured = isMongoCfgFn();

    const $set: any = {};
    if (schedule.lastRunAt !== undefined) $set.lastRunAt = schedule.lastRunAt;
    if (schedule.lastCompletedAt !== undefined) $set.lastCompletedAt = schedule.lastCompletedAt;
    if (schedule.nextRunAt !== undefined) $set.nextRunAt = schedule.nextRunAt;

    if (Object.keys($set).length === 0) {
      return true;
    }

    if (mongoConfigured) {
      let mongoWriteSucceeded = false;
      try {
        const coll = await getCollFn();
        const updateResult: any = await withMongoTimeout<any>(
          coll.updateOne({ id: sourceId }, { $set }),
          10000,
          'updateSourceSchedule'
        );
        if (
          updateResult &&
          updateResult.acknowledged === true &&
          typeof updateResult.matchedCount === 'number' &&
          updateResult.matchedCount > 0
        ) {
          mongoWriteSucceeded = true;
        } else {
          console.warn(
            `[ScraperRepository] Warning: updateSourceSchedule lacked explicit acknowledgement (acknowledged=true) or matched 0 documents for source "${sourceId}". Cache update skipped.`
          );
        }
      } catch (err: any) {
        console.warn(`[ScraperRepository] Notice updating source schedule for "${sourceId}" in MongoDB:`, err?.message || err);
      }

      if (!mongoWriteSucceeded) {
        return false;
      }
    }

    // Update in-memory cached representation
    const idx = this.cachedSources.findIndex(s => s.id === sourceId);
    if (idx !== -1) {
      if (schedule.lastRunAt !== undefined) this.cachedSources[idx].lastRunAt = schedule.lastRunAt;
      if (schedule.lastCompletedAt !== undefined) this.cachedSources[idx].lastCompletedAt = schedule.lastCompletedAt;
      if (schedule.nextRunAt !== undefined) this.cachedSources[idx].nextRunAt = schedule.nextRunAt;
    }

    return true;
  }

  // --- SOURCE GROUPS MANAGEMENT (MongoDB scraper_groups) ---

  private static cachedGroups: ScraperSourceGroup[] = getDefaultGroups();

  /**
   * Retrieves all source groups from MongoDB. Auto-seeds defaults only on confirmed empty collection.
   * In configured-MongoDB mode, DB lookup/read/timeout/seed failures propagate (fail-closed).
   */
  static async getGroups(_deps?: {
    isMongoConfiguredFn?: () => boolean;
    getCollectionFn?: () => Promise<any>;
  }): Promise<ScraperSourceGroup[]> {
    const isMongoCfgFn = _deps?.isMongoConfiguredFn || isMongoConfigured;
    const getCollFn = _deps?.getCollectionFn || getScraperGroupsCollection;

    if (isMongoCfgFn()) {
      const coll = await getCollFn();
      const docs: any = await withMongoTimeout<any>(
        coll.find({}, { projection: { _id: 0 } }).sort({ name: 1 }).toArray(),
        15000,
        'getGroups'
      );

      if (!Array.isArray(docs)) {
        throw new Error('Unexpected non-array response reading scraper_groups from MongoDB');
      }

      if (docs.length > 0) {
        this.cachedGroups = docs as ScraperSourceGroup[];
        return docs as ScraperSourceGroup[];
      }

      // Auto-seed default groups ONLY when confirmed empty
      const defaults = getDefaultGroups();
      if (defaults.length > 0) {
        const seedRes: any = await withMongoTimeout<any>(coll.insertMany(defaults), 15000, 'seedGroups');
        if (
          !seedRes ||
          seedRes.acknowledged !== true ||
          typeof seedRes.insertedCount !== 'number' ||
          seedRes.insertedCount !== defaults.length
        ) {
          throw new Error(
            `MongoDB insertMany seeding scraper_groups failed confirmation (acknowledged=${String(seedRes?.acknowledged)}, insertedCount=${String(seedRes?.insertedCount)}, expected=${defaults.length})`
          );
        }
        console.log(`[ScraperRepository] Seeded ${defaults.length} default source groups into MongoDB.`);
        this.cachedGroups = defaults;
        return defaults;
      }

      this.cachedGroups = [];
      return [];
    }

    return this.cachedGroups;
  }

  /**
   * Creates a new source group in MongoDB.
   * Updates cachedGroups only after confirmed MongoDB acknowledgement.
   */
  static async createGroup(
    data: { name: string; description?: string; sourceIds?: string[] },
    _deps?: {
      isMongoConfiguredFn?: () => boolean;
      getCollectionFn?: () => Promise<any>;
    }
  ): Promise<ScraperSourceGroup> {
    const isMongoCfgFn = _deps?.isMongoConfiguredFn || isMongoConfigured;
    const getCollFn = _deps?.getCollectionFn || getScraperGroupsCollection;

    const now = new Date().toISOString();
    const id = `group-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newGroup: ScraperSourceGroup = {
      id,
      name: data.name.trim(),
      description: data.description?.trim() || '',
      sourceIds: Array.isArray(data.sourceIds) ? data.sourceIds : [],
      createdAt: now,
      updatedAt: now
    };

    if (isMongoCfgFn()) {
      const coll = await getCollFn();
      const insertRes: any = await withMongoTimeout<any>(coll.insertOne(newGroup), 10000, 'createGroup');
      if (!insertRes || insertRes.acknowledged !== true) {
        throw new Error(`MongoDB insertOne for source group "${newGroup.name}" was not acknowledged`);
      }
      this.cachedGroups.push(newGroup);
      return newGroup;
    }

    this.cachedGroups.push(newGroup);
    return newGroup;
  }

  /**
   * Renames or updates a source group in MongoDB.
   * Propagates DB errors and never falls back to mutating cachedGroups when MongoDB is configured.
   */
  static async updateGroup(
    id: string,
    updates: { name?: string; description?: string; sourceIds?: string[] },
    _deps?: {
      isMongoConfiguredFn?: () => boolean;
      getCollectionFn?: () => Promise<any>;
    }
  ): Promise<ScraperSourceGroup | null> {
    const isMongoCfgFn = _deps?.isMongoConfiguredFn || isMongoConfigured;
    const getCollFn = _deps?.getCollectionFn || getScraperGroupsCollection;

    const now = new Date().toISOString();
    const $set: any = { updatedAt: now };
    if (updates.name !== undefined) $set.name = updates.name.trim();
    if (updates.description !== undefined) $set.description = updates.description.trim();
    if (Array.isArray(updates.sourceIds)) $set.sourceIds = updates.sourceIds;

    if (isMongoCfgFn()) {
      const coll = await getCollFn();
      const rawUpdated: any = await withMongoTimeout<any>(
        coll.findOneAndUpdate(
          { id },
          { $set },
          { returnDocument: 'after', projection: { _id: 0 } }
        ),
        10000,
        'updateGroup'
      );
      const updated =
        rawUpdated && typeof rawUpdated === 'object' && 'value' in rawUpdated && !('id' in rawUpdated)
          ? rawUpdated.value
          : rawUpdated;

      if (!updated) {
        return null;
      }

      const idx = this.cachedGroups.findIndex(g => g.id === id);
      if (idx !== -1) {
        this.cachedGroups[idx] = updated as ScraperSourceGroup;
      } else {
        this.cachedGroups.push(updated as ScraperSourceGroup);
      }
      return updated as ScraperSourceGroup;
    }

    const idx = this.cachedGroups.findIndex(g => g.id === id);
    if (idx !== -1) {
      this.cachedGroups[idx] = { ...this.cachedGroups[idx], ...$set };
      return this.cachedGroups[idx];
    }
    return null;
  }

  /**
   * Deletes a source group from MongoDB.
   * Requires explicit MongoDB acknowledgement before updating cachedGroups.
   */
  static async deleteGroup(
    id: string,
    _deps?: {
      isMongoConfiguredFn?: () => boolean;
      getCollectionFn?: () => Promise<any>;
    }
  ): Promise<boolean> {
    const isMongoCfgFn = _deps?.isMongoConfiguredFn || isMongoConfigured;
    const getCollFn = _deps?.getCollectionFn || getScraperGroupsCollection;

    if (isMongoCfgFn()) {
      const coll = await getCollFn();
      const res: any = await withMongoTimeout<any>(coll.deleteOne({ id }), 10000, 'deleteGroup');
      if (!res || res.acknowledged !== true) {
        throw new Error(`MongoDB deleteOne for source group "${id}" was not acknowledged`);
      }
      const deleted = typeof res.deletedCount === 'number' && res.deletedCount > 0;
      if (deleted) {
        this.cachedGroups = this.cachedGroups.filter(g => g.id !== id);
      }
      return deleted;
    }

    const initialLen = this.cachedGroups.length;
    this.cachedGroups = this.cachedGroups.filter(g => g.id !== id);
    return this.cachedGroups.length < initialLen;
  }

  /**
   * Adds sources to a group in MongoDB.
   * Propagates DB errors and never falls back to mutating cachedGroups when MongoDB is configured.
   */
  static async addSourcesToGroup(
    id: string,
    sourceIds: string[],
    _deps?: {
      isMongoConfiguredFn?: () => boolean;
      getCollectionFn?: () => Promise<any>;
    }
  ): Promise<ScraperSourceGroup | null> {
    const isMongoCfgFn = _deps?.isMongoConfiguredFn || isMongoConfigured;
    const getCollFn = _deps?.getCollectionFn || getScraperGroupsCollection;

    if (isMongoCfgFn()) {
      const coll = await getCollFn();
      if (!Array.isArray(sourceIds) || sourceIds.length === 0) {
        const existing: any = await withMongoTimeout<any>(
          coll.findOne({ id }, { projection: { _id: 0 } }),
          10000,
          'addSourcesToGroupRead'
        );
        if (!existing) return null;
        const idx = this.cachedGroups.findIndex(g => g.id === id);
        if (idx !== -1) this.cachedGroups[idx] = existing as ScraperSourceGroup;
        return existing as ScraperSourceGroup;
      }

      const now = new Date().toISOString();
      const rawUpdated: any = await withMongoTimeout<any>(
        coll.findOneAndUpdate(
          { id },
          {
            $addToSet: { sourceIds: { $each: sourceIds } },
            $set: { updatedAt: now }
          },
          { returnDocument: 'after', projection: { _id: 0 } }
        ),
        10000,
        'addSourcesToGroup'
      );
      const updated =
        rawUpdated && typeof rawUpdated === 'object' && 'value' in rawUpdated && !('id' in rawUpdated)
          ? rawUpdated.value
          : rawUpdated;

      if (!updated) {
        return null;
      }

      const idx = this.cachedGroups.findIndex(g => g.id === id);
      if (idx !== -1) {
        this.cachedGroups[idx] = updated as ScraperSourceGroup;
      } else {
        this.cachedGroups.push(updated as ScraperSourceGroup);
      }
      return updated as ScraperSourceGroup;
    }

    if (!Array.isArray(sourceIds) || sourceIds.length === 0) {
      return this.cachedGroups.find(g => g.id === id) || null;
    }
    const now = new Date().toISOString();
    const idx = this.cachedGroups.findIndex(g => g.id === id);
    if (idx !== -1) {
      const merged = Array.from(new Set([...this.cachedGroups[idx].sourceIds, ...sourceIds]));
      this.cachedGroups[idx].sourceIds = merged;
      this.cachedGroups[idx].updatedAt = now;
      return this.cachedGroups[idx];
    }
    return null;
  }

  /**
   * Removes sources from a group in MongoDB.
   * Propagates DB errors and never falls back to mutating cachedGroups when MongoDB is configured.
   */
  static async removeSourcesFromGroup(
    id: string,
    sourceIds: string[],
    _deps?: {
      isMongoConfiguredFn?: () => boolean;
      getCollectionFn?: () => Promise<any>;
    }
  ): Promise<ScraperSourceGroup | null> {
    const isMongoCfgFn = _deps?.isMongoConfiguredFn || isMongoConfigured;
    const getCollFn = _deps?.getCollectionFn || getScraperGroupsCollection;

    if (isMongoCfgFn()) {
      const coll = await getCollFn();
      if (!Array.isArray(sourceIds) || sourceIds.length === 0) {
        const existing: any = await withMongoTimeout<any>(
          coll.findOne({ id }, { projection: { _id: 0 } }),
          10000,
          'removeSourcesFromGroupRead'
        );
        if (!existing) return null;
        const idx = this.cachedGroups.findIndex(g => g.id === id);
        if (idx !== -1) this.cachedGroups[idx] = existing as ScraperSourceGroup;
        return existing as ScraperSourceGroup;
      }

      const now = new Date().toISOString();
      const rawUpdated: any = await withMongoTimeout<any>(
        coll.findOneAndUpdate(
          { id },
          {
            $pull: { sourceIds: { $in: sourceIds } } as any,
            $set: { updatedAt: now }
          },
          { returnDocument: 'after', projection: { _id: 0 } }
        ),
        10000,
        'removeSourcesFromGroup'
      );
      const updated =
        rawUpdated && typeof rawUpdated === 'object' && 'value' in rawUpdated && !('id' in rawUpdated)
          ? rawUpdated.value
          : rawUpdated;

      if (!updated) {
        return null;
      }

      const idx = this.cachedGroups.findIndex(g => g.id === id);
      if (idx !== -1) {
        this.cachedGroups[idx] = updated as ScraperSourceGroup;
      } else {
        this.cachedGroups.push(updated as ScraperSourceGroup);
      }
      return updated as ScraperSourceGroup;
    }

    if (!Array.isArray(sourceIds) || sourceIds.length === 0) {
      return this.cachedGroups.find(g => g.id === id) || null;
    }
    const now = new Date().toISOString();
    const idx = this.cachedGroups.findIndex(g => g.id === id);
    if (idx !== -1) {
      this.cachedGroups[idx].sourceIds = this.cachedGroups[idx].sourceIds.filter(sid => !sourceIds.includes(sid));
      this.cachedGroups[idx].updatedAt = now;
      return this.cachedGroups[idx];
    }
    return null;
  }

  /**
   * Saves or updates an individual scraper configuration.
   */
  static async saveConfig(cfg: any): Promise<void> {
    if (!cfg || !cfg.id) return;
    const current = await this.getConfigs();
    const idx = current.findIndex(c => c.id === cfg.id);
    if (idx !== -1) {
      current[idx] = { ...current[idx], ...cfg };
    } else {
      current.push(cfg);
    }
    await this.saveConfigs(current);
  }

  /**
   * Resets any stale in-progress or executing schedules upon server boot.
   */
  static async resetStaleSchedules(): Promise<{ resetCount: number }> {
    try {
      const configs = await this.getConfigs();
      let resetCount = 0;
      const now = new Date().toISOString();

      for (const cfg of configs) {
        if (cfg.status === 'Running' || cfg.status === 'Processing') {
          cfg.status = 'Active Scheduled';
          cfg.updatedAt = now;
          resetCount++;
        }
      }

      if (resetCount > 0) {
        await this.saveConfigs(configs);
      }

      console.log(`[ScraperRepository] resetStaleSchedules completed. Reset ${resetCount} active/stale schedules.`);
      return { resetCount };
    } catch (err: any) {
      console.warn(`[ScraperRepository] resetStaleSchedules notice: ${err?.message || err}`);
      return { resetCount: 0 };
    }
  }

  /**
   * Retrieves authoritative scraper scheduler settings from MongoDB scraper_settings collection.
   * In configured-MongoDB mode, DB lookup/read/timeout/seed failures propagate (fail-closed)
   * instead of falling back to cached/default settings.
   */
  static async getSchedulerSettings(_deps?: {
    isMongoConfiguredFn?: () => boolean;
    getDbFn?: () => Promise<any>;
  }): Promise<ScraperSchedulerSettings> {
    const isMongoCfgFn = _deps?.isMongoConfiguredFn || isMongoConfigured;
    const getDatabaseFn = _deps?.getDbFn || getMongoDb;

    if (isMongoCfgFn()) {
      const db = await getDatabaseFn();
      const coll = db.collection('scraper_settings');
      const doc: any = await withMongoTimeout<any>(
        coll.findOne({ id: 'global_scheduler_settings' }, { projection: { _id: 0 } }),
        10000,
        'getSchedulerSettings'
      );
      if (doc) {
        const merged: ScraperSchedulerSettings = {
          ...getDefaultSchedulerSettings(),
          ...doc,
          isPersistedToMongo: true
        };
        this.cachedSettings = merged;
        return merged;
      }

      // Auto-seed default scheduler settings ONLY when findOne succeeded and returned null
      const defaults = getDefaultSchedulerSettings();
      const { isPersistedToMongo: _, ...cleanDefaults } = defaults;
      const seedResult: any = await withMongoTimeout<any>(
        coll.replaceOne(
          { id: 'global_scheduler_settings' },
          { id: 'global_scheduler_settings', ...cleanDefaults },
          { upsert: true }
        ),
        10000,
        'seedSchedulerSettings'
      );
      const hasMatchOrUpsert =
        (typeof seedResult?.matchedCount === 'number' && seedResult.matchedCount > 0) ||
        (typeof seedResult?.upsertedCount === 'number' && seedResult.upsertedCount > 0);
      if (!seedResult || seedResult.acknowledged !== true || !hasMatchOrUpsert) {
        throw new Error('Initial scheduler settings seed write was not confirmed by MongoDB');
      }
      this.cachedSettings = { ...defaults, isPersistedToMongo: true };
      return this.cachedSettings;
    }

    return { ...this.cachedSettings, isPersistedToMongo: false };
  }

  /**
   * Authoritatively persists scheduler settings to MongoDB scraper_settings collection.
   */
  static async saveSchedulerSettings(
    settings: Partial<ScraperSchedulerSettings>,
    _deps?: {
      isMongoConfiguredFn?: () => boolean;
      getDbFn?: () => Promise<any>;
    }
  ): Promise<ScraperSchedulerSettings> {
    const VALID_SCOPES: ScraperSchedulerSettings['scope'][] = ['all', 'selected', 'group', 'working', 'failed', 'single'];
    if (settings.scope !== undefined && !VALID_SCOPES.includes(settings.scope)) {
      throw new Error(`Invalid scheduler scope "${settings.scope}". Supported scopes are: ${VALID_SCOPES.join(', ')}`);
    }

    if (settings.scanMode !== undefined && !['since_last', 'complete', 'page_range'].includes(settings.scanMode)) {
      throw new Error(`Invalid scanMode "${settings.scanMode}". Supported scan modes are: since_last, complete, page_range`);
    }

    if (settings.duplicateMode !== undefined && !['with', 'without'].includes(settings.duplicateMode)) {
      throw new Error(`Invalid duplicateMode "${settings.duplicateMode}". Supported values are: with, without`);
    }

    const isMongoCfgFn = _deps?.isMongoConfiguredFn || isMongoConfigured;
    const getDatabaseFn = _deps?.getDbFn || getMongoDb;

    const current = await this.getSchedulerSettings(_deps);
    const { isPersistedToMongo: _cp, ...cleanCurrent } = current as any;
    const { isPersistedToMongo: _sp, ...cleanSettings } = settings as any;

    const updated: ScraperSchedulerSettings = {
      ...cleanCurrent,
      ...cleanSettings,
      updatedAt: new Date().toISOString()
    };

    if (!isMongoCfgFn()) {
      this.cachedSettings = { ...updated, isPersistedToMongo: false };
      return this.cachedSettings;
    }

    try {
      const db = await getDatabaseFn();
      const coll = db.collection('scraper_settings');
      const { isPersistedToMongo: _, ...docToPersist } = updated as any;
      const result: any = await withMongoTimeout<any>(
        coll.replaceOne(
          { id: 'global_scheduler_settings' },
          { id: 'global_scheduler_settings', ...docToPersist },
          { upsert: true }
        ),
        10000,
        'saveSchedulerSettings'
      );
      const hasMatchOrUpsert =
        (typeof result?.matchedCount === 'number' && result.matchedCount > 0) ||
        (typeof result?.upsertedCount === 'number' && result.upsertedCount > 0);
      if (!result || result.acknowledged !== true || !hasMatchOrUpsert) {
        throw new Error('Write was not confirmed by MongoDB for scraper_settings');
      }
      this.cachedSettings = { ...updated, isPersistedToMongo: true };
      return this.cachedSettings;
    } catch (err: any) {
      console.warn(`[ScraperRepository] Failed to persist scraper settings to MongoDB: ${err?.message || err}`);
      throw err;
    }
  }
}

/**
 * Checks whether an error from MongoDB is transient and safe to retry.
 */
export function isTransientMongoError(err: any): boolean {
  if (!err) return false;
  const msg = (err.message || '').toLowerCase();
  const name = (err.name || '').toLowerCase();
  return (
    name.includes('network') ||
    name.includes('timeout') ||
    msg.includes('connection') ||
    msg.includes('topology') ||
    msg.includes('econnrefused') ||
    msg.includes('timed out') ||
    Boolean(err.hasErrorLabel?.('TransientTransactionError')) ||
    Boolean(err.hasErrorLabel?.('RetryableWriteError'))
  );
}

/**
 * Executes an async database operation with exponential backoff retry for transient network issues.
 */
export async function withMongoRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  delayMs = 500
): Promise<T> {
  let lastErr: any;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      if (!isTransientMongoError(err) || i === retries - 1) {
        throw err;
      }
      await new Promise(res => setTimeout(res, delayMs * Math.pow(2, i)));
    }
  }
  throw lastErr;
}

