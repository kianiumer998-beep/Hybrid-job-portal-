import cron from 'node-cron';
import { ScraperRepository } from '../db/repositories/ScraperRepository';
import { JobRepository } from '../db/repositories/JobRepository';
import { executeScraperWithWizard, getActiveRunStatus, stopActiveRun } from './scraperEngine';
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

function isMongoTimeoutNotice(errOrMsg: any): boolean {
  if (!errOrMsg) return false;
  const str = String(errOrMsg?.message || errOrMsg).toLowerCase();
  return (
    str.includes('mongo') ||
    str.includes('database unavailable') ||
    str.includes('server selection timed out') ||
    str.includes('sockettimeout') ||
    str.includes('connecttimeout') ||
    str.includes('connection timed out') ||
    str.includes('timed out after') ||
    str.includes('buffering timed out') ||
    str.includes('topology is closed') ||
    str.includes('econnrefused') ||
    (str.includes('timeout') && (str.includes('db') || str.includes('pool') || str.includes('connection')))
  );
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
    // 1. Run authoritative job expiry scan based on admin portal expiry offset
    try {
      const expirySettings = await ScraperRepository.getExpirySettings();
      await JobRepository.scanAndExpireDueJobs(expirySettings.offsetDays);
    } catch (expErr: any) {
      console.warn('[Scheduler Engine] Expiry scan notice:', expErr.message);
    }

    if (!featureFlags.enableWebScraper) {
      console.log('[Scheduler Engine] Web scraper is disabled by feature flag.');
      return { triggeredSources: [], summary: 'Web scraper disabled by feature flag' };
    }

    // 2. Check if a scraper run is already executing (prevent conflicts & handle stale runs)
    const currentRun = getActiveRunStatus();
    if (currentRun.isActive) {
      const lastActiveMs = new Date(currentRun.lastUpdatedTime || currentRun.startTime || 0).getTime();
      const isStale = (Date.now() - lastActiveMs) > 5 * 60 * 1000;
      if (isStale) {
        console.warn(`[Scheduler Engine] Active scraper run (${currentRun.runId || 'unknown'}) is stale (>5m inactive). Auto-stopping to unblock scheduler.`);
        stopActiveRun();
      } else {
        console.log(`[Scheduler Engine] Scraper engine currently active (${currentRun.runId || 'in-progress'}, ${currentRun.status}). Deferring scheduled source runs to next tick.`);
        return { triggeredSources: [], summary: `Scraper engine busy with run ${currentRun.runId || 'in-progress'}` };
      }
    }

    const sources = await ScraperRepository.getConfigs();
    const now = Date.now();
    const updatedSources = [...sources];
    let hasUpdates = false;

    for (let i = 0; i < updatedSources.length; i++) {
      const src = updatedSources[i];
      const isActive = src.status === 'Active Scheduled' || src.status === 'Active';
      if (!isActive) continue;

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

        let wasBusy = false;
        let isDbUnavailable = false;

        try {
          const runResult = await executeScraperWithWizard({
            mode: 'since_last',
            sourceId: src.id,
            autoPublishTrusted: src.autoApprove && featureFlags.enableScraperAutoApprove
          });

          const currentRunState = getActiveRunStatus();
          if (currentRunState.status === 'Error' && isMongoTimeoutNotice(currentRunState.currentError || runResult.message)) {
            isDbUnavailable = true;
            console.warn(
              `[Scheduler Engine] Database availability notice: Scrape for "${src.name}" aborted due to MongoDB timeout (${currentRunState.currentError || runResult.message}). Remote source portal is healthy.`
            );
          } else {
            console.log(`[Scheduler Engine] Source "${src.name}" scraped. Found: ${runResult.totalFound}, Duplicates: ${runResult.totalDuplicates}`);
          }
        } catch (srcErr: any) {
          const errMsg = String(srcErr?.message || srcErr || '');
          if (errMsg.includes('already in progress')) {
            wasBusy = true;
            console.log(`[Scheduler Engine] Source "${src.name}" tick deferred: Scraper run in progress. Retrying next tick.`);
          } else if (isMongoTimeoutNotice(errMsg)) {
            isDbUnavailable = true;
            console.warn(
              `[Scheduler Engine] Database availability notice: MongoDB timeout during scrape for "${src.name}": ${errMsg}. Remote source portal is healthy.`
            );
          } else {
            const detail = errMsg.replace(/Failed to fetch|fetch failed/gi, 'remote portal unreachable');
            console.log(`[Scheduler Engine] Source "${src.name}" tick notice: ${detail}`);
          }
        }

        if (wasBusy) {
          // If the engine became busy, defer this source to next tick (2 minutes) rather than skipping full interval
          updatedSources[i] = {
            ...updatedSources[i],
            nextRunAt: new Date(Date.now() + 2 * 60 * 1000).toISOString()
          };
          hasUpdates = true;
          break; // Stop evaluating further sources in this tick
        }

        if (isDbUnavailable) {
          // Database is temporarily unavailable (Mongo timeout).
          // Do not mark portal as failed; defer to next tick to allow MongoDB connectivity to recover.
          updatedSources[i] = {
            ...updatedSources[i],
            nextRunAt: new Date(Date.now() + 2 * 60 * 1000).toISOString()
          };
          hasUpdates = true;
          break; // Stop evaluating further sources in this tick
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
      try {
        await ScraperRepository.saveConfigs(updatedSources);
      } catch (saveErr: any) {
        console.warn('[Scheduler Engine] Notice saving scheduler state:', saveErr?.message || saveErr);
      }
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
    const isActive = src.status === 'Active Scheduled' || src.status === 'Active';
    const isDue = isActive && (nextRunMs <= now);

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
    activeSourcesCount: sources.filter(s => s.status === 'Active Scheduled' || s.status === 'Active').length,
    dueSourcesCount: sourceStatuses.filter(s => s.isDue).length,
    lastTickTimestamp: lastTickTime,
    sources: sourceStatuses
  };
}
