import cron from 'node-cron';
import { ScraperRepository } from '../db/repositories/ScraperRepository';
import { executeScraperWithWizard } from './scraperEngine';
import { featureFlags } from '../config/featureFlags';

export interface SchedulerSourceStatus {
  sourceId: string;
  sourceName: string;
  interval: string;
  intervalMs: number;
  status: string;
  lastRunAt?: string;
  nextRunAt?: string;
  isDue: boolean;
  healthStatus?: string;
}

export interface SchedulerStatusResponse {
  isRunning: boolean;
  tickCronPattern: string;
  activeSourcesCount: number;
  dueSourcesCount: number;
  lastTickTimestamp: string;
  sources: SchedulerSourceStatus[];
}

const INTERVAL_MS_MAP: Record<string, number> = {
  '15m': 15 * 60 * 1000,
  '30m': 30 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '6h': 6 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000
};

let scheduledTask: ReturnType<typeof cron.schedule> | null = null;
let isTickExecuting = false;
let lastTickTime: string = 'Never';

function parseIntervalToMs(intervalStr?: string): number {
  if (!intervalStr) return INTERVAL_MS_MAP['24h'];
  return INTERVAL_MS_MAP[intervalStr] || INTERVAL_MS_MAP['24h'];
}

/**
 * Executes a scheduler tick: checks individual source intervals and triggers scraping for due sources.
 */
export async function runSchedulerTick(): Promise<{ triggeredSources: string[]; summary: any }> {
  if (isTickExecuting) {
    console.log('[Scheduler Engine] Previous tick still executing. Skipping tick.');
    return { triggeredSources: [], summary: 'Concurrent tick avoided' };
  }

  isTickExecuting = true;
  lastTickTime = new Date().toISOString();
  const triggered: string[] = [];

  try {
    if (!featureFlags.enableWebScraper) {
      console.log('[Scheduler Engine] Web scraper is disabled by feature flag.');
      return { triggeredSources: [], summary: 'Web scraper disabled by feature flag' };
    }

    const sources = await ScraperRepository.getConfigs();
    const now = Date.now();
    const updatedSources = [...sources];
    let hasUpdates = false;

    for (let i = 0; i < updatedSources.length; i++) {
      const src = updatedSources[i];
      if (src.status !== 'Active Scheduled') continue;

      const intervalMs = parseIntervalToMs(src.interval);
      let nextRunMs = src.nextRunAt ? new Date(src.nextRunAt).getTime() : 0;

      // Initialize nextRunAt if not set
      if (!nextRunMs || isNaN(nextRunMs)) {
        nextRunMs = now + intervalMs;
        updatedSources[i] = {
          ...src,
          nextRunAt: new Date(nextRunMs).toISOString()
        };
        hasUpdates = true;
        continue;
      }

      // Check if source is due
      if (now >= nextRunMs) {
        console.log(`[Scheduler Engine] Source "${src.name}" (${src.id}) is due for scrape (Interval: ${src.interval || '24h'}).`);
        triggered.push(src.id);

        try {
          const runResult = await executeScraperWithWizard({
            mode: 'since_last',
            sourceId: src.id,
            autoPublishTrusted: src.autoApprove && featureFlags.enableScraperAutoApprove
          });

          console.log(`[Scheduler Engine] Source "${src.name}" scraped. Found: ${runResult.totalFound}, Duplicates: ${runResult.totalDuplicates}`);
        } catch (srcErr: any) {
          console.log(`[Scheduler Engine] Source "${src.name}" tick notice: ${srcErr?.message || srcErr}`);
        }

        // Schedule next run
        const completedNow = new Date();
        updatedSources[i] = {
          ...updatedSources[i],
          lastRunAt: completedNow.toISOString(),
          lastCompletedAt: completedNow.toISOString(),
          nextRunAt: new Date(completedNow.getTime() + intervalMs).toISOString()
        };
        hasUpdates = true;
      }
    }

    if (hasUpdates) {
      await ScraperRepository.saveConfigs(updatedSources);
    }

    return {
      triggeredSources: triggered,
      summary: `Tick completed. Triggered ${triggered.length} sources.`
    };
  } finally {
    isTickExecuting = false;
  }
}

/**
 * Initializes the dynamic cron scheduler.
 * Ticks every 2 minutes to check configured intervals for all sources.
 */
export function initScraperScheduler(): void {
  if (scheduledTask) {
    scheduledTask.stop();
  }

  // Ticks every 2 minutes to evaluate each source's configured interval
  scheduledTask = cron.schedule('*/2 * * * *', async () => {
    try {
      await runSchedulerTick();
    } catch (err: any) {
      console.log('[Scheduler Engine] Scheduler tick notice:', err?.message || err);
    }
  });

  console.log('⏱️ [Scheduler Engine] Dynamic interval-aware scraper scheduler initialized (tick pattern: */2 * * * *).');
}

/**
 * Returns the current runtime status of the scheduler and all configured sources.
 */
export async function getSchedulerStatus(): Promise<SchedulerStatusResponse> {
  const sources = await ScraperRepository.getConfigs();
  const now = Date.now();

  const sourceStatuses: SchedulerSourceStatus[] = sources.map(src => {
    const intervalMs = parseIntervalToMs(src.interval);
    const nextRunMs = src.nextRunAt ? new Date(src.nextRunAt).getTime() : 0;
    const isDue = src.status === 'Active Scheduled' && (nextRunMs <= now);

    return {
      sourceId: src.id,
      sourceName: src.name,
      interval: src.interval || '24h',
      intervalMs,
      status: src.status,
      lastRunAt: src.lastRunAt || src.lastCompletedAt,
      nextRunAt: src.nextRunAt,
      isDue,
      healthStatus: src.healthStatus || 'healthy'
    };
  });

  return {
    isRunning: scheduledTask !== null,
    tickCronPattern: '*/2 * * * *',
    activeSourcesCount: sources.filter(s => s.status === 'Active Scheduled').length,
    dueSourcesCount: sourceStatuses.filter(s => s.isDue).length,
    lastTickTimestamp: lastTickTime,
    sources: sourceStatuses
  };
}
