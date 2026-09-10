import { Database } from '../database';
import {
  getScraperSourcesCollection,
  getScraperRunsCollection,
  isMongoConfigured
} from '../mongodb';

export class ScraperRepository {
  private static cachedSources: any[] | null = null;

  /**
   * Retrieves all scraper source configurations from MongoDB.
   * On first run with empty collection, auto-seeds from verified sources.
   */
  static async getConfigs(): Promise<any[]> {
    if (isMongoConfigured()) {
      try {
        const coll = await getScraperSourcesCollection();
        const docs = await coll.find({}, { projection: { _id: 0 } }).toArray();
        if (docs && docs.length > 0) {
          this.cachedSources = docs;
          return docs;
        }

        // Auto-seed initial sources from Database if MongoDB collection is empty
        const defaultSources = Database.getScraperSources();
        if (defaultSources && defaultSources.length > 0) {
          try {
            const cleanDocs = defaultSources.map(s => {
              const { _id, ...clean } = s;
              return clean;
            });
            await coll.insertMany(cleanDocs);
            console.log(`[ScraperRepository] Seeded ${cleanDocs.length} scraper sources into MongoDB.`);
            this.cachedSources = cleanDocs;
            return cleanDocs;
          } catch (seedErr: any) {
            console.warn('[ScraperRepository] Notice seeding sources into MongoDB:', seedErr.message);
          }
        }
      } catch (err: any) {
        console.error('[ScraperRepository] Error reading scraper sources from MongoDB:', err.message);
      }
    }

    const localSources = Database.getScraperSources();
    this.cachedSources = localSources;
    return localSources;
  }

  /**
   * Persists all scraper source configurations to MongoDB.
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
        console.error('[ScraperRepository] Error saving scraper sources to MongoDB:', err.message);
      }
    }

    // Also persist to local database file as secondary safeguard
    try {
      Database.saveScraperSources(configs);
    } catch {}
  }

  /**
   * Retrieves scraper execution run history from MongoDB sorted by timestamp desc.
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
          return runs;
        }
      } catch (err: any) {
        console.error('[ScraperRepository] Error reading scraper runs from MongoDB:', err.message);
      }
    }

    return Database.getScraperRuns();
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
        console.error('[ScraperRepository] Error adding scraper run to MongoDB:', err.message);
      }
    }

    try {
      Database.addScraperRun(clean);
    } catch {}

    return clean;
  }

  /**
   * Updates health stats, counts, and run timestamps for a scraper source in MongoDB.
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
        console.error(`[ScraperRepository] Error updating source stats for "${sourceId}" in MongoDB:`, err.message);
      }
    }

    // Also update local database file
    try {
      const configs = Database.getScraperSources();
      const idx = configs.findIndex(s => s.id === sourceId);
      if (idx !== -1) {
        if (stats.lastStartedAt) configs[idx].lastStartedAt = stats.lastStartedAt;
        if (stats.lastSuccessfulScrapeAt) configs[idx].lastSuccessfulScrapeAt = stats.lastSuccessfulScrapeAt;
        if (stats.lastCompletedAt) configs[idx].lastCompletedAt = stats.lastCompletedAt;
        if (stats.lastRunId) configs[idx].lastRunId = stats.lastRunId;
        if (stats.scrapedCountIncrement) {
          configs[idx].scrapedCount = (configs[idx].scrapedCount || 0) + stats.scrapedCountIncrement;
        }
        if (stats.healthStatus) configs[idx].healthStatus = stats.healthStatus;
        if (stats.lastErrorMessage !== undefined) configs[idx].lastErrorMessage = stats.lastErrorMessage;

        Database.saveScraperSources(configs);
        this.cachedSources = configs;
      }
    } catch {}
  }
}

