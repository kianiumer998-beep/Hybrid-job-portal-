import {
  getScraperSourcesCollection,
  getScraperRunsCollection,
  isMongoConfigured
} from '../mongodb';
import { ALL_VERIFIED_SCRAPER_PORTALS } from '../../../src/data/allScraperPortals';

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
    healthStatus?: 'healthy' | 'warning' | 'error';
    lastErrorMessage?: string;
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
    }
  }
}
