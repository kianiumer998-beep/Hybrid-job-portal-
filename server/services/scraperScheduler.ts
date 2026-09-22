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
  isSchedulerEnabled: boolean;
  tickCronPattern: string;
  activeSourcesCount: number;
  dueSourcesCount: number;
  overdueSourcesCount: number;
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
 * Sets the global scheduler enabled/disabled flag.
 */
export async function setGlobalSchedulerState(enabled: boolean): Promise<boolean> {
  await ScraperRepository.updateSchedulerConfig({ enabled });
  if (!enabled) {
    const currentRun = getActiveRunStatus();
    if (currentRun.isActive && currentRun.isSchedulerRun) {
      console.log('[Scheduler Engine] Disabling scheduler while background run active. Terminating background run...');
      stopActiveRun();
    }
  }
  return enabled;
}

/**
 * Executes a scheduler tick: checks individual source intervals and triggers scraping for due sources.
 */
export async function runSchedulerTick(): Promise<{ triggeredSources: string[]; summary: any }> {
  // Check admin config toggle first
  const config = await ScraperRepository.getSchedulerConfig();
  if (!config.enabled) {
    return { triggeredSources: [], summary: 'Automatic scheduler disabled by Administrator' };
  }

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
      const isStale = (Date.now() - lastActiveMs) > 2 * 60 * 1000;
      if (isStale) {
        console.warn(`[Scheduler Engine] Active scraper run (${currentRun.runId || 'unknown'}) is stale (>2m inactive). Auto-stopping to unblock scheduler.`);
        stopActiveRun();
      } else {
        console.log(`[Scheduler Engine] Scraper engine currently active (${currentRun.runId || 'in-progress'}, ${currentRun.status}). Deferring scheduled tick.`);
        return { triggeredSources: [], summary: `Scraper engine busy with run ${currentRun.runId || 'in-progress'}` };
      }
    }

    const sources = await ScraperRepository.getConfigs();
    const now = Date.now();
    const updatedSources = [...sources];
    let hasUpdates = false;

    // Filter active sources
    for (let i = 0; i < updatedSources.length; i++) {
      const src = updatedSources[i];
      const isActive = src.status === 'Active Scheduled' || src.status === 'Active';
      if (!isActive) continue;

      const intervalMs = parseIntervalToMs(src.interval);
      let nextRunMs = src.nextRunAt ? new Date(src.nextRunAt).getTime() : 0;

      // Initialize nextRunAt if missing or invalid
      if (!nextRunMs || isNaN(nextRunMs)) {
        nextRunMs = now + intervalMs;
        updatedSources[i] = {
          ...src,
          nextRunAt: new Date(nextRunMs).toISOString()
        };
        hasUpdates = true;
        continue;
      }

      // Check if this source was stuck in the past (> 30 minutes in the past from previous days)
      const isStalePastDate = (now - nextRunMs) > 30 * 60 * 1000;
      if (isStalePastDate) {
        console.log(`[Scheduler Engine] Source "${src.name}" had past schedule timestamp (${src.nextRunAt}). Auto-aligning to future.`);
        nextRunMs = now + intervalMs + ((i % 15) * 60 * 1000);
        updatedSources[i] = {
          ...src,
          nextRunAt: new Date(nextRunMs).toISOString()
        };
        hasUpdates = true;
        continue;
      }

      // Check if source is due now
      if (now >= nextRunMs) {
        console.log(`[Scheduler Engine] Source "${src.name}" (${src.id}) is due for scrape (Interval: ${src.interval || '24h'}).`);
        triggered.push(src.id);

        let wasBusy = false;

        try {
          const runResult = await executeScraperWithWizard({
            mode: 'since_last',
            sourceId: src.id,
            isSchedulerRun: true,
            autoPublishTrusted: src.autoApprove && featureFlags.enableScraperAutoApprove
          });

          console.log(`[Scheduler Engine] Source "${src.name}" scraped. Found: ${runResult.totalFound}, Duplicates: ${runResult.totalDuplicates}`);
        } catch (srcErr: any) {
          const errMsg = String(srcErr?.message || srcErr || '');
          if (errMsg.includes('already in progress')) {
            wasBusy = true;
            console.log(`[Scheduler Engine] Source "${src.name}" tick deferred: Scraper run in progress. Retrying next tick.`);
          } else {
            const detail = errMsg.replace(/Failed to fetch|fetch failed/gi, 'remote portal unreachable');
            console.log(`[Scheduler Engine] Source "${src.name}" tick notice: ${detail}`);
          }
        }

        if (wasBusy) {
          // If the engine became busy, defer this source to next tick (2 minutes)
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

  // Clean any stale past dates from previous days on startup
  ScraperRepository.resetStaleSchedules().catch(err => {
    console.warn('[Scheduler Engine] Startup schedule alignment notice:', err.message);
  });

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
  const config = await ScraperRepository.getSchedulerConfig();
  const now = Date.now();

  let overdueCount = 0;

  const sourceStatuses: SchedulerSourceStatus[] = sources.map(src => {
    const intervalMs = parseIntervalToMs(src.interval);
    const nextRunMs = src.nextRunAt ? new Date(src.nextRunAt).getTime() : 0;
    const isActive = src.status === 'Active Scheduled' || src.status === 'Active';
    const isOverdue = isActive && nextRunMs > 0 && nextRunMs < now;
    if (isOverdue) overdueCount++;

    return {
      sourceId: src.id,
      sourceName: src.name,
      interval: src.interval || '24h',
      intervalMs,
      status: src.status,
      lastRunAt: src.lastRunAt || src.lastCompletedAt,
      nextRunAt: src.nextRunAt,
      isDue: isActive && (nextRunMs <= now),
      healthStatus: src.healthStatus || 'healthy'
    };
  });

  return {
    isRunning: scheduledTask !== null && config.enabled,
    isSchedulerEnabled: config.enabled,
    tickCronPattern: '*/2 * * * *',
    activeSourcesCount: sources.filter(s => s.status === 'Active Scheduled' || s.status === 'Active').length,
    dueSourcesCount: sourceStatuses.filter(s => s.isDue).length,
    overdueSourcesCount: overdueCount,
    lastTickTimestamp: lastTickTime,
    sources: sourceStatuses
  };
}
