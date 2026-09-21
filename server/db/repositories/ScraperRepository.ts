import {
  getScraperSourcesCollection,
  getScraperRunsCollection,
  getScraperGroupsCollection,
  getMongoDb,
  isMongoConfigured,
  recoverMongoClient,
  isTransientMongoError,
  isBrokenClientError
} from '../mongodb';

export { isTransientMongoError, isBrokenClientError };

export async function withMongoRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  initialDelayMs = 1000,
  maxDelayMs = 8000
): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err: any) {
      attempt++;
      if (attempt <= retries && isTransientMongoError(err)) {
        const delay = Math.min(maxDelayMs, initialDelayMs * Math.pow(2, attempt - 1));

        if (isBrokenClientError(err)) {
          console.log(`[Mongo Retry] Broken MongoClient or topology error encountered (attempt ${attempt}/${retries}): ${err?.message || err}. Initiating centralized recovery and retrying in ${delay}ms...`);
          try {
            await recoverMongoClient(err);
          } catch (recoverErr: any) {
            console.log(`[Mongo Retry] Centralized MongoClient recovery attempt failed: ${recoverErr?.message || recoverErr}`);
          }
        } else {
          // If transient errors persist beyond attempt 1, proactively trigger recovery to renew connection pool
          if (attempt >= 2) {
            try {
              await recoverMongoClient(err);
            } catch {
              // Ignore recovery errors, will retry via driver
            }
          }
          console.log(`[Mongo Retry] Transient database error encountered (attempt ${attempt}/${retries}): ${err?.message || err}. Retrying via driver pool in ${delay}ms...`);
        }

        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
}

interface LocalScraperLockState {
  ownerId: string;
  acquiredAt: Date;
  expiresAt: Date;
}

const localScraperLocks = new Map<string, LocalScraperLockState>();
import { ALL_VERIFIED_SCRAPER_PORTALS } from '../../../src/data/allScraperPortals';

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

  /**
   * Retrieves all scraper source configurations from MongoDB scraper_sources collection.
   * On first run with empty collection, auto-seeds from verified sources into MongoDB.
   */
  static async getConfigs(): Promise<any[]> {
    if (isMongoConfigured()) {
      const normalized = await withMongoRetry(async () => {
        const coll = await getScraperSourcesCollection();
        const docs = await coll.find({}, { projection: { _id: 0 } }).toArray();
        if (docs && docs.length > 0) {
          let hasMissingStatus = false;
          const norm = docs.map((s: any) => {
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

          if (hasMissingStatus) {
            coll.updateMany(
              { $or: [{ status: { $exists: false } }, { status: null }, { status: '' }, { interval: { $exists: false } }] },
              { $set: { status: 'Active Scheduled', interval: '24h' } }
            ).catch(e => console.warn('[ScraperRepository] Notice updating missing statuses:', e.message));
          }
          return norm;
        }
        return null;
      });

      if (normalized) {
        this.cachedSources = normalized;
        return normalized;
      }

      // Auto-seed initial sources into MongoDB scraper_sources collection if empty
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
        await withMongoRetry(async () => {
          const coll = await getScraperSourcesCollection();
          await coll.insertMany(cleanDocs);
        });
        console.log(`[ScraperRepository] Seeded ${cleanDocs.length} scraper sources into MongoDB scraper_sources.`);
        this.cachedSources = cleanDocs;
        return cleanDocs;
      }
    }

    return this.cachedSources;
  }

  /**
   * Persists all scraper source configurations directly to MongoDB scraper_sources collection.
   * Uses batched bulkWrite to avoid serial roundtrip network timeouts.
   */
  static async saveConfigs(configs: any[]): Promise<void> {
    if (!Array.isArray(configs) || configs.length === 0) return;

    if (isMongoConfigured()) {
      await withMongoRetry(async () => {
        const coll = await getScraperSourcesCollection();
        const bulkOps = configs
          .filter(cfg => cfg && cfg.id)
          .map(cfg => {
            const { _id, ...clean } = cfg;
            return {
              replaceOne: {
                filter: { id: clean.id },
                replacement: clean,
                upsert: true
              }
            };
          });

        if (bulkOps.length > 0) {
          const CHUNK_SIZE = 100;
          for (let i = 0; i < bulkOps.length; i += CHUNK_SIZE) {
            const chunk = bulkOps.slice(i, i + CHUNK_SIZE);
            await coll.bulkWrite(chunk, { ordered: false });
          }
        }
      });
    }

    this.cachedSources = configs;
  }

  /**
   * Saves a single scraper source configuration to MongoDB.
   */
  static async saveConfig(cfg: any): Promise<void> {
    if (!cfg || !cfg.id) return;
    if (isMongoConfigured()) {
      await withMongoRetry(async () => {
        const coll = await getScraperSourcesCollection();
        const { _id, ...clean } = cfg;
        await coll.replaceOne({ id: clean.id }, clean, { upsert: true });
      });
    }
    const idx = this.cachedSources.findIndex(s => s.id === cfg.id);
    if (idx !== -1) {
      this.cachedSources[idx] = cfg;
    } else {
      this.cachedSources.push(cfg);
    }
  }

  /**
   * Retrieves scraper execution run history from MongoDB scraper_runs collection sorted by timestamp desc.
   */
  static async getRuns(): Promise<any[]> {
    if (isMongoConfigured()) {
      const runs = await withMongoRetry(async () => {
        const coll = await getScraperRunsCollection();
        return await coll.find({}, { projection: { _id: 0 } })
          .sort({ startedAt: -1, timestamp: -1 })
          .limit(100)
          .toArray();
      });

      if (runs) {
        this.cachedRuns = runs;
        return runs;
      }
      return [];
    }

    return this.cachedRuns;
  }

  /**
   * Records a new scraper execution run into MongoDB scraper_runs collection.
   */
  static async addRun(run: any): Promise<any> {
    const newRun = {
      ...run,
      id: run.id || `run-${Date.now()}`,
      timestamp: run.startedAt || new Date().toISOString()
    };
    const { _id, ...clean } = newRun;

    if (isMongoConfigured()) {
      await withMongoRetry(async () => {
        const coll = await getScraperRunsCollection();
        await coll.insertOne(clean);
      });
    }

    this.cachedRuns.unshift(clean);
    if (this.cachedRuns.length > 100) {
      this.cachedRuns = this.cachedRuns.slice(0, 100);
    }

    return clean;
  }

  /**
   * Updates health stats, counts, and run timestamps for a scraper source in MongoDB scraper_sources collection.
   */
  static async updateSourceStats(sourceId: string, stats: {
    lastStartedAt?: string;
    lastSuccessfulScrapeAt?: string;
    lastCompletedAt?: string;
    lastRunId?: string;
    scrapedCountIncrement?: number;
    healthStatus?: 'Healthy' | 'Jobs Found' | 'No Jobs' | '404' | '403' | 'Timeout' | 'Invalid PDF' | 'HTML' | 'Fetch Error' | 'Disabled' | string;
    lastErrorMessage?: string;
    lastHttpStatus?: number;
  }): Promise<void> {
    if (isMongoConfigured()) {
      await withMongoRetry(async () => {
        const coll = await getScraperSourcesCollection();
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

        if (Object.keys(updateOps).length > 0) {
          await coll.updateOne({ id: sourceId }, updateOps);
        }
      });
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
    }
  }

  // --- SOURCE GROUPS MANAGEMENT (MongoDB scraper_groups) ---

  private static cachedGroups: ScraperSourceGroup[] = getDefaultGroups();

  /**
   * Retrieves all source groups from MongoDB. Auto-seeds defaults on first run.
   */
  static async getGroups(): Promise<ScraperSourceGroup[]> {
    if (isMongoConfigured()) {
      return await withMongoRetry(async () => {
        const coll = await getScraperGroupsCollection();
        const docs = await coll.find({}, { projection: { _id: 0 } }).sort({ name: 1 }).toArray();
        if (docs && docs.length > 0) {
          this.cachedGroups = docs as ScraperSourceGroup[];
          return docs as ScraperSourceGroup[];
        }

        // Auto-seed default groups if empty
        const defaults = getDefaultGroups();
        if (defaults.length > 0) {
          await coll.insertMany(defaults);
          console.log(`[ScraperRepository] Seeded ${defaults.length} default source groups into MongoDB.`);
          this.cachedGroups = defaults;
          return defaults;
        }
        return [];
      });
    }
    return this.cachedGroups;
  }

  /**
   * Creates a new source group in MongoDB.
   */
  static async createGroup(data: { name: string; description?: string; sourceIds?: string[] }): Promise<ScraperSourceGroup> {
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

    if (isMongoConfigured()) {
      await withMongoRetry(async () => {
        const coll = await getScraperGroupsCollection();
        await coll.insertOne(newGroup);
      });
    }

    this.cachedGroups.push(newGroup);
    return newGroup;
  }

  /**
   * Renames or updates a source group in MongoDB.
   */
  static async updateGroup(id: string, updates: { name?: string; description?: string; sourceIds?: string[] }): Promise<ScraperSourceGroup | null> {
    const now = new Date().toISOString();
    const $set: any = { updatedAt: now };
    if (updates.name !== undefined) $set.name = updates.name.trim();
    if (updates.description !== undefined) $set.description = updates.description.trim();
    if (Array.isArray(updates.sourceIds)) $set.sourceIds = updates.sourceIds;

    if (isMongoConfigured()) {
      return await withMongoRetry(async () => {
        const coll = await getScraperGroupsCollection();
        const updated = await coll.findOneAndUpdate(
          { id },
          { $set },
          { returnDocument: 'after', projection: { _id: 0 } }
        );
        if (updated) {
          const idx = this.cachedGroups.findIndex(g => g.id === id);
          if (idx !== -1) this.cachedGroups[idx] = updated as ScraperSourceGroup;
          return updated as ScraperSourceGroup;
        }
        return null;
      });
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
   */
  static async deleteGroup(id: string): Promise<boolean> {
    if (isMongoConfigured()) {
      return await withMongoRetry(async () => {
        const coll = await getScraperGroupsCollection();
        const res = await coll.deleteOne({ id });
        this.cachedGroups = this.cachedGroups.filter(g => g.id !== id);
        return (res.deletedCount || 0) > 0;
      });
    }
    const initialLen = this.cachedGroups.length;
    this.cachedGroups = this.cachedGroups.filter(g => g.id !== id);
    return this.cachedGroups.length < initialLen;
  }

  /**
   * Adds sources to a group in MongoDB.
   */
  static async addSourcesToGroup(id: string, sourceIds: string[]): Promise<ScraperSourceGroup | null> {
    if (!Array.isArray(sourceIds) || sourceIds.length === 0) {
      return this.cachedGroups.find(g => g.id === id) || null;
    }
    const now = new Date().toISOString();

    if (isMongoConfigured()) {
      return await withMongoRetry(async () => {
        const coll = await getScraperGroupsCollection();
        const updated = await coll.findOneAndUpdate(
          { id },
          {
            $addToSet: { sourceIds: { $each: sourceIds } },
            $set: { updatedAt: now }
          },
          { returnDocument: 'after', projection: { _id: 0 } }
        );
        if (updated) {
          const idx = this.cachedGroups.findIndex(g => g.id === id);
          if (idx !== -1) this.cachedGroups[idx] = updated as ScraperSourceGroup;
          return updated as ScraperSourceGroup;
        }
        return null;
      });
    }

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
   */
  static async removeSourcesFromGroup(id: string, sourceIds: string[]): Promise<ScraperSourceGroup | null> {
    if (!Array.isArray(sourceIds) || sourceIds.length === 0) {
      return this.cachedGroups.find(g => g.id === id) || null;
    }
    const now = new Date().toISOString();

    if (isMongoConfigured()) {
      return await withMongoRetry(async () => {
        const coll = await getScraperGroupsCollection();
        const updated = await coll.findOneAndUpdate(
          { id },
          {
            $pull: { sourceIds: { $in: sourceIds } } as any,
            $set: { updatedAt: now }
          },
          { returnDocument: 'after', projection: { _id: 0 } }
        );
        if (updated) {
          const idx = this.cachedGroups.findIndex(g => g.id === id);
          if (idx !== -1) this.cachedGroups[idx] = updated as ScraperSourceGroup;
          return updated as ScraperSourceGroup;
        }
        return null;
      });
    }

    const idx = this.cachedGroups.findIndex(g => g.id === id);
    if (idx !== -1) {
      this.cachedGroups[idx].sourceIds = this.cachedGroups[idx].sourceIds.filter(sid => !sourceIds.includes(sid));
      this.cachedGroups[idx].updatedAt = now;
      return this.cachedGroups[idx];
    }
    return null;
  }

  private static cachedExpiryOffsetDays: number = 1;

  /**
   * Retrieves the configured portal expiry offset in days (0, 1, or 2, default: 1).
   */
  static async getExpirySettings(): Promise<{ offsetDays: number }> {
    if (isMongoConfigured()) {
      const doc = await withMongoRetry(async () => {
        const db = await (await import('../mongodb')).getMongoDb();
        return await db.collection('scraper_settings').findOne({ id: 'portal_expiry_config' });
      });
      if (doc && typeof doc.offsetDays === 'number') {
        this.cachedExpiryOffsetDays = Math.max(0, Math.min(2, doc.offsetDays));
      }
    }
    return { offsetDays: this.cachedExpiryOffsetDays };
  }

  /**
   * Updates the portal expiry offset (0, 1, or 2 days).
   */
  static async updateExpirySettings(settings: { offsetDays: number }): Promise<{ offsetDays: number }> {
    const safeOffset = Math.max(0, Math.min(2, Number(settings.offsetDays) || 0));

    if (isMongoConfigured()) {
      await withMongoRetry(async () => {
        const db = await (await import('../mongodb')).getMongoDb();
        await db.collection('scraper_settings').updateOne(
          { id: 'portal_expiry_config' },
          {
            $set: {
              id: 'portal_expiry_config',
              offsetDays: safeOffset,
              updatedAt: new Date().toISOString()
            }
          },
          { upsert: true }
        );
      });
    }

    this.cachedExpiryOffsetDays = safeOffset;
    return { offsetDays: safeOffset };
  }

  /**
   * Acquires a cross-instance distributed lock for automatic scraper scheduler batches.
   * Lock key defaults to 'AUTO_SCRAPER_BATCH_LOCK'.
   * Safe TTL ensures a crashed or stopped instance auto-releases the lock after expiry.
   */
  static async acquireDistributedLock(
    lockKey: string = 'AUTO_SCRAPER_BATCH_LOCK',
    ownerId: string,
    ttlMs: number = 300000
  ): Promise<boolean> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlMs);

    if (isMongoConfigured()) {
      try {
        return await withMongoRetry(async () => {
          const db = await getMongoDb();
          const coll = db.collection('scraper_locks');

          const res = await coll.updateOne(
            {
              id: lockKey,
              $or: [
                { ownerId: ownerId },
                { expiresAt: { $lte: now } },
                { expiresAt: { $exists: false } }
              ]
            },
            {
              $set: {
                id: lockKey,
                ownerId: ownerId,
                acquiredAt: now,
                expiresAt: expiresAt
              }
            },
            { upsert: true }
          );

          return res.matchedCount > 0 || res.upsertedCount > 0;
        });
      } catch (err: any) {
        if (err.code === 11000) {
          return false;
        }
        console.warn(`[ScraperRepository] Mongo lock acquisition notice:`, err.message);
        return false;
      }
    }

    const local = localScraperLocks.get(lockKey);
    if (local && local.ownerId !== ownerId && local.expiresAt.getTime() > now.getTime()) {
      return false;
    }
    localScraperLocks.set(lockKey, { ownerId, acquiredAt: now, expiresAt });
    return true;
  }

  /**
   * Releases a distributed lock. ONLY the lock owner matching ownerId can release it.
   */
  static async releaseDistributedLock(
    lockKey: string = 'AUTO_SCRAPER_BATCH_LOCK',
    ownerId: string
  ): Promise<boolean> {
    if (isMongoConfigured()) {
      try {
        return await withMongoRetry(async () => {
          const db = await getMongoDb();
          const coll = db.collection('scraper_locks');
          const res = await coll.deleteOne({ id: lockKey, ownerId: ownerId });
          return res.deletedCount > 0;
        });
      } catch (err: any) {
        console.warn(`[ScraperRepository] Mongo lock release notice:`, err.message);
        return false;
      }
    }

    const local = localScraperLocks.get(lockKey);
    if (local && local.ownerId === ownerId) {
      localScraperLocks.delete(lockKey);
      return true;
    }
    return false;
  }

  /**
   * Pings the database to verify if MongoDB connectivity is healthy.
   */
  static async isHealthy(): Promise<boolean> {
    if (!isMongoConfigured()) return false;
    try {
      const db = await getMongoDb();
      await db.command({ ping: 1 });
      return true;
    } catch {
      return false;
    }
  }
}

