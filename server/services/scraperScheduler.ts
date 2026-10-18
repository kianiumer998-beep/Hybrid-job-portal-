import cron from 'node-cron';
import { ScraperRepository, ScraperSchedulerSettings } from '../db/repositories/ScraperRepository';
import { executeScraperWithWizard } from './scraperEngine';
import { featureFlags } from '../config/featureFlags';
import { deriveSourceClassification } from '../../src/services/scraperClassification';

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
  settings?: ScraperSchedulerSettings;
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
 * Resolves the eligible source IDs according to the configured scheduled scope.
 */
async function resolveScopedSourceIds(
  settings: ScraperSchedulerSettings,
  allSources: any[]
): Promise<Set<string> | null> {
  const scope = settings.scope || 'all';

  if (scope === 'selected') {
    const selectedIds = Array.isArray(settings.selectedSourceIds) ? settings.selectedSourceIds : [];
    return new Set(selectedIds);
  }

  if (scope === 'group') {
    if (!settings.selectedGroupId) return new Set();
    const groups = await ScraperRepository.getGroups();
    const targetGroup = groups.find(g => g.id === settings.selectedGroupId);
    return new Set(targetGroup?.sourceIds || []);
  }

  if (scope === 'working') {
    const workingIds = allSources
      .filter(s => deriveSourceClassification(s).overallStatus === 'Working')
      .map(s => s.id);
    return new Set(workingIds);
  }

  if (scope === 'failed') {
    const failedIds = allSources.filter(s => {
      const h = s.healthStatus || '';
      return ['404', '403', 'Timeout', 'Invalid PDF', 'HTML', 'Fetch Error', 'error', 'warning'].includes(h) ||
             (s.lastErrorMessage && s.lastErrorMessage.length > 0 && s.lastErrorMessage !== '0 vacancies extracted from target source');
    }).map(s => s.id);
    return new Set(failedIds);
  }

  if (scope === 'single') {
    return new Set(settings.singleSourceId ? [settings.singleSourceId] : []);
  }

  // 'all' scope: all active sources are eligible
  return null;
}

/**
 * Executes a scheduler tick: checks individual source intervals and triggers scraping for due sources within the configured scope.
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

    const settings = await ScraperRepository.getSchedulerSettings();
    if (!settings.enabled) {
      console.log('[Scheduler Engine] Scheduler is paused in settings. Skipping tick.');
      return { triggeredSources: [], summary: 'Scheduler paused in settings' };
    }

    const sources = await ScraperRepository.getConfigs();
    const scopedSourceIds = await resolveScopedSourceIds(settings, sources);
    const now = Date.now();

    for (const src of sources) {
      try {
        const isActive = src.status === 'Active Scheduled' || src.status === 'Active';
        if (!isActive) {
          // Source is paused, disabled, or inactive
          continue;
        }

        // Apply scheduled scope filtering
        if (scopedSourceIds !== null && !scopedSourceIds.has(src.id)) {
          continue;
        }

        const intervalMs = parseIntervalToMs(src.interval || settings.interval);
        let nextRunMs = src.nextRunAt ? new Date(src.nextRunAt).getTime() : 0;

        // Initialize nextRunAt if not set
        if (!nextRunMs || isNaN(nextRunMs)) {
          nextRunMs = now + intervalMs;
          const nextRunAt = new Date(nextRunMs).toISOString();
          src.nextRunAt = nextRunAt;
          await ScraperRepository.updateSourceSchedule(src.id, { nextRunAt });
          continue;
        }

        // Check if source is due
        if (now >= nextRunMs) {
          console.log(`[Scheduler Engine] Source "${src.name}" (${src.id}) is due for scrape (Interval: ${src.interval || settings.interval || '24h'}, Scope: ${settings.scope}).`);
          triggered.push(src.id);

          try {
            const runResult = await executeScraperWithWizard({
              mode: 'since_last',
              sourceId: src.id,
              autoPublishTrusted: (settings.autoApprove ?? src.autoApprove) && featureFlags.enableScraperAutoApprove,
              duplicateMode: settings.duplicateMode || 'with'
            });

            console.log(`[Scheduler Engine] Source "${src.name}" scraped. Found: ${runResult.totalFound}, Duplicates: ${runResult.totalDuplicates}`);
          } catch (srcErr: any) {
            console.log(`[Scheduler Engine] Source "${src.name}" execution notice: ${srcErr?.message || srcErr}. Scheduler continuing with other due sources.`);
          }

          // Schedule next run regardless of single source outcome
          const completedNow = new Date();
          const lastRunAt = completedNow.toISOString();
          const lastCompletedAt = completedNow.toISOString();
          const nextRunAt = new Date(completedNow.getTime() + intervalMs).toISOString();

          src.lastRunAt = lastRunAt;
          src.lastCompletedAt = lastCompletedAt;
          src.nextRunAt = nextRunAt;

          await ScraperRepository.updateSourceSchedule(src.id, {
            lastRunAt,
            lastCompletedAt,
            nextRunAt
          });
        }
      } catch (sourceLoopErr: any) {
        console.warn(`[Scheduler Engine] Notice processing source "${src.name}" during tick:`, sourceLoopErr?.message || sourceLoopErr);
      }
    }

    return {
      triggeredSources: triggered,
      summary: `Tick completed (Scope: ${settings.scope}). Triggered ${triggered.length} sources.`
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
    scheduledTask = null;
  }

  // Safely reset any stale schedule states on boot
  if (typeof (ScraperRepository as any)?.resetStaleSchedules === 'function') {
    (ScraperRepository as any).resetStaleSchedules().catch((err: any) => {
      console.log('[Scheduler Engine] resetStaleSchedules notice:', err?.message || err);
    });
  }

  // Read saved settings to decide whether to activate
  ScraperRepository.getSchedulerSettings().then(settings => {
    if (!settings.enabled) {
      console.log('⏱️ [Scheduler Engine] Scraper scheduler is currently paused per database settings.');
      return;
    }

    scheduledTask = cron.schedule('*/2 * * * *', async () => {
      try {
        await runSchedulerTick();
      } catch (err: any) {
        console.log('[Scheduler Engine] Scheduler tick notice:', err?.message || err);
      }
    });
    console.log(`⏱️ [Scheduler Engine] Dynamic interval-aware scraper scheduler initialized (tick: */2 * * * *, scope: ${settings.scope || 'all'}).`);
  }).catch(err => {
    console.warn('[Scheduler Engine] Notice reading scheduler settings on boot:', err?.message || err);
    scheduledTask = cron.schedule('*/2 * * * *', async () => {
      try {
        await runSchedulerTick();
      } catch (tickErr: any) {
        console.log('[Scheduler Engine] Scheduler tick notice:', tickErr?.message || tickErr);
      }
    });
  });
}

/**
 * Returns the current runtime status of the scheduler and all configured sources.
 */
export async function getSchedulerStatus(): Promise<SchedulerStatusResponse> {
  const sources = await ScraperRepository.getConfigs();
  const settings = await ScraperRepository.getSchedulerSettings();
  const scopedSourceIds = await resolveScopedSourceIds(settings, sources);
  const now = Date.now();

  const sourceStatuses: SchedulerSourceStatus[] = sources.map(src => {
    const intervalMs = parseIntervalToMs(src.interval || settings.interval);
    const nextRunMs = src.nextRunAt ? new Date(src.nextRunAt).getTime() : 0;
    const isActive = src.status === 'Active Scheduled' || src.status === 'Active';
    const isScoped = scopedSourceIds === null || scopedSourceIds.has(src.id);
    const isDue = isActive && isScoped && (nextRunMs <= now);

    return {
      sourceId: src.id,
      sourceName: src.name,
      interval: src.interval || settings.interval || '24h',
      intervalMs,
      status: src.status,
      lastRunAt: src.lastRunAt || src.lastCompletedAt,
      nextRunAt: src.nextRunAt,
      isDue,
      healthStatus: src.healthStatus || 'healthy'
    };
  });

  const activeInScopeCount = sources.filter(s => {
    const isActive = s.status === 'Active Scheduled' || s.status === 'Active';
    const isScoped = scopedSourceIds === null || scopedSourceIds.has(s.id);
    return isActive && isScoped;
  }).length;

  return {
    isRunning: scheduledTask !== null,
    tickCronPattern: '*/2 * * * *',
    activeSourcesCount: activeInScopeCount,
    dueSourcesCount: sourceStatuses.filter(s => s.isDue).length,
    lastTickTimestamp: lastTickTime,
    sources: sourceStatuses,
    settings
  };
}

/**
 * Enables or pauses the global scraper scheduler runtime.
 */
export async function setGlobalSchedulerState(enabled: boolean): Promise<{ isRunning: boolean; message: string }> {
  try {
    await ScraperRepository.saveSchedulerSettings({ enabled });
  } catch (err: any) {
    console.warn('[Scheduler Engine] Failed to persist scheduler state update:', err?.message || err);
  }

  if (enabled) {
    if (!scheduledTask) {
      initScraperScheduler();
    }
    return { isRunning: true, message: 'Global scraper scheduler enabled successfully.' };
  } else {
    if (scheduledTask) {
      scheduledTask.stop();
      scheduledTask = null;
    }
    return { isRunning: false, message: 'Global scraper scheduler paused successfully.' };
  }
}

