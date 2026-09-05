import { Database } from '../database';

export class ScraperRepository {
  static getConfigs(): any[] {
    return Database.getScraperSources();
  }

  static saveConfigs(configs: any[]): void {
    Database.saveScraperSources(configs);
  }

  static getRuns(): any[] {
    return Database.getScraperRuns();
  }

  static addRun(run: any): any {
    return Database.addScraperRun(run);
  }

  static updateSourceStats(sourceId: string, stats: {
    lastStartedAt?: string;
    lastSuccessfulScrapeAt?: string;
    lastCompletedAt?: string;
    lastRunId?: string;
    scrapedCountIncrement?: number;
    healthStatus?: 'healthy' | 'warning' | 'error';
    lastErrorMessage?: string;
  }): void {
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
    }
  }
}
