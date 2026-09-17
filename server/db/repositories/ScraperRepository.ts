import {
  getScraperSourcesCollection,
  getScraperRunsCollection,
  getScraperGroupsCollection,
  isMongoConfigured
} from '../mongodb';
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
      try {
        const coll = await getScraperSourcesCollection();
        const docs = await coll.find({}, { projection: { _id: 0 } }).toArray();
        if (docs && docs.length > 0) {
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

          if (hasMissingStatus) {
            coll.updateMany(
              { $or: [{ status: { $exists: false } }, { status: null }, { status: '' }, { interval: { $exists: false } }] },
              { $set: { status: 'Active Scheduled', interval: '24h' } }
            ).catch(e => console.warn('[ScraperRepository] Notice updating missing statuses:', e.message));
          }

          this.cachedSources = normalized;
          return normalized;
        }

        // Auto-seed initial sources into MongoDB scraper_sources collection if empty
        const defaults = getDefaultSources();
        if (defaults.length > 0) {
          try {
            const cleanDocs = defaults.map(s => {
              const { _id, ...clean } = s as any;
              return {
                ...clean,
                status: clean.status || 'Active Scheduled',
                interval: clean.interval || '24h',
                healthStatus: clean.healthStatus || 'healthy'
              };
            });
            await coll.insertMany(cleanDocs);
            console.log(`[ScraperRepository] Seeded ${cleanDocs.length} scraper sources into MongoDB scraper_sources.`);
            this.cachedSources = cleanDocs;
            return cleanDocs;
          } catch (seedErr: any) {
            console.warn('[ScraperRepository] Notice seeding sources into MongoDB:', seedErr.message);
          }
        }
      } catch (err: any) {
        console.error('[ScraperRepository] MongoDB error reading scraper_sources:', err.message);
      }
    }

    return this.cachedSources;
  }

  /**
   * Persists all scraper source configurations directly to MongoDB scraper_sources collection.
   */
  static async saveConfigs(configs: any[]): Promise<void> {
    if (!Array.isArray(configs)) return;
    this.cachedSources = configs;

    if (isMongoConfigured()) {
      try {
        const coll = await getScraperSourcesCollection();
        for (const cfg of configs) {
          if (!cfg || !cfg.id) continue;
          const { _id, ...clean } = cfg;
          await coll.replaceOne({ id: clean.id }, clean, { upsert: true });
        }
      } catch (err: any) {
        console.error('[ScraperRepository] MongoDB error saving scraper_sources:', err.message);
      }
    }
  }

  /**
   * Retrieves scraper execution run history from MongoDB scraper_runs collection sorted by timestamp desc.
   */
  static async getRuns(): Promise<any[]> {
    if (isMongoConfigured()) {
      try {
        const coll = await getScraperRunsCollection();
        const runs = await coll.find({}, { projection: { _id: 0 } })
          .sort({ startedAt: -1, timestamp: -1 })
          .limit(100)
          .toArray();

        if (runs && runs.length > 0) {
          this.cachedRuns = runs;
          return runs;
        }
      } catch (err: any) {
        console.error('[ScraperRepository] MongoDB error reading scraper_runs:', err.message);
      }
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
      try {
        const coll = await getScraperRunsCollection();
        await coll.insertOne(clean);
      } catch (err: any) {
        console.error('[ScraperRepository] MongoDB error adding to scraper_runs:', err.message);
      }
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
      try {
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
      } catch (err: any) {
        console.error(`[ScraperRepository] MongoDB error updating source stats for "${sourceId}":`, err.message);
      }
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
      try {
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
      } catch (err: any) {
        console.error('[ScraperRepository] MongoDB error reading scraper_groups:', err.message);
      }
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
      try {
        const coll = await getScraperGroupsCollection();
        await coll.insertOne(newGroup);
      } catch (err: any) {
        console.error('[ScraperRepository] Error inserting group:', err.message);
      }
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
      try {
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
      } catch (err: any) {
        console.error(`[ScraperRepository] Error updating group "${id}":`, err.message);
      }
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
      try {
        const coll = await getScraperGroupsCollection();
        const res = await coll.deleteOne({ id });
        this.cachedGroups = this.cachedGroups.filter(g => g.id !== id);
        return (res.deletedCount || 0) > 0;
      } catch (err: any) {
        console.error(`[ScraperRepository] Error deleting group "${id}":`, err.message);
      }
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
      try {
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
      } catch (err: any) {
        console.error(`[ScraperRepository] Error adding sources to group "${id}":`, err.message);
      }
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
      try {
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
      } catch (err: any) {
        console.error(`[ScraperRepository] Error removing sources from group "${id}":`, err.message);
      }
    }

    const idx = this.cachedGroups.findIndex(g => g.id === id);
    if (idx !== -1) {
      this.cachedGroups[idx].sourceIds = this.cachedGroups[idx].sourceIds.filter(sid => !sourceIds.includes(sid));
      this.cachedGroups[idx].updatedAt = now;
      return this.cachedGroups[idx];
    }
    return null;
  }
}
