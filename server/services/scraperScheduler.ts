import cron from 'node-cron';
import { ScraperRepository, isTransientMongoError } from '../db/repositories/ScraperRepository';
import { JobRepository } from '../db/repositories/JobRepository';
import { executeScraperWithWizard, getActiveRunStatus, stopActiveRun } from './scraperEngine';
import { featureFlags } from '../config/featureFlags';

export type SchedulerBatchStatus = 'Idle' | 'Running' | 'Stopping' | 'Stopped' | 'Completed';

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
  schedulerRunning: boolean;
  tickCronPattern: string;
  activeSourcesCount: number;
  dueSourcesCount: number;
  lastTickTimestamp: string;

  // Batch status fields
  batchStatus: SchedulerBatchStatus;
  batchRunId: string | null;
  batchTotal: number;
  batchCompleted: number;
  batchCurrentIndex: number;
  batchCurrentSourceId: string | null;
  batchCurrentSourceName: string | null;
  batchTriggeredSources: string[];
  batchStartedAt: string | null;
  batchLastUpdatedAt: string | null;

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
let isSchedulerEnabled = true;
let isTickExecuting = false;
let lastTickTime: string = 'Never';

interface SchedulerBatchState {
  batchRunId: string | null;
  batchStatus: SchedulerBatchStatus;
  batchTotal: number;
  batchCompleted: number;
  batchCurrentIndex: number;
  batchCurrentSourceId: string | null;
  batchCurrentSourceName: string | null;
  batchTriggeredSources: string[];
  batchStartedAt: string | null;
  batchLastUpdatedAt: string | null;
  cancelRequested: boolean;
  generationId: number;
}

let batchState: SchedulerBatchState = {
  batchRunId: null,
  batchStatus: 'Idle',
  batchTotal: 0,
  batchCompleted: 0,
  batchCurrentIndex: 0,
  batchCurrentSourceId: null,
  batchCurrentSourceName: null,
  batchTriggeredSources: [],
  batchStartedAt: null,
  batchLastUpdatedAt: null,
  cancelRequested: false,
  generationId: 0,
};

function parseIntervalToMs(intervalStr?: string): number {
  if (!intervalStr) return INTERVAL_MS_MAP['24h'];
  return INTERVAL_MS_MAP[intervalStr] || INTERVAL_MS_MAP['24h'];
}

export function startScraperScheduler(): void {
  isSchedulerEnabled = true;
  batchState.cancelRequested = false;
  batchState.generationId++;

  if (batchState.batchStatus === 'Stopped' || batchState.batchStatus === 'Stopping') {
    batchState.batchStatus = 'Idle';
    batchState.batchCurrentSourceId = null;
    batchState.batchCurrentSourceName = null;
  }

  if (!scheduledTask) {
    scheduledTask = cron.schedule('*/2 * * * *', async () => {
      try {
        await runSchedulerTick();
      } catch (err: any) {
        console.log('[Scheduler Engine] Scheduler tick notice:', err?.message || err);
      }
    });
  }

  console.log('⏱️ [Scheduler Engine] Scraper scheduler enabled/started (pattern: */2 * * * *).');
}

export function stopScraperScheduler(): void {
  isSchedulerEnabled = false;
  batchState.cancelRequested = true;
  batchState.generationId++;

  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
  }

  if (batchState.batchStatus === 'Running') {
    batchState.batchStatus = 'Stopping';
  } else {
    batchState.batchStatus = 'Stopped';
  }

  batchState.batchLastUpdatedAt = new Date().toISOString();
  console.log('🛑 [Scheduler Engine] Scraper scheduler stopped/disabled.');
}

/**
 * Initializes the dynamic cron scheduler.
 * Ticks every 2 minutes to evaluate configured intervals for all sources.
 */
export function initScraperScheduler(): void {
  startScraperScheduler();
}

/**
 * Executes a scheduler tick: batches all due sources into ONE BATCH RUN and processes them sequentially.
 */
export async function runSchedulerTick(): Promise<{ triggeredSources: string[]; summary: any }> {
  if (!isSchedulerEnabled) {
    console.log('[Scheduler Engine] Scheduler is disabled. Skipping tick.');
    return { triggeredSources: [], summary: 'Scheduler is disabled' };
  }

  if (isTickExecuting || batchState.batchStatus === 'Running' || batchState.batchStatus === 'Stopping') {
    console.log('[Scheduler Engine] Scheduler batch currently running or tick executing. Skipping tick.');
    return { triggeredSources: [], summary: 'Scheduler tick deferred (batch run in progress)' };
  }

  isTickExecuting = true;
  lastTickTime = new Date().toISOString();

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

    // 2. Check if a manual scraper run is already executing (prevent conflicts & handle stale runs)
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

    let sources: any[];
    try {
      sources = await ScraperRepository.getConfigs();
    } catch (cfgErr: any) {
      if (isTransientMongoError(cfgErr)) {
        console.warn(`[Scheduler Engine] Scheduler tick deferred: MongoDB temporarily unavailable while reading source configurations (${cfgErr.message}).`);
        return { triggeredSources: [], summary: 'Scheduler tick deferred: MongoDB temporarily unavailable.' };
      }
      throw cfgErr;
    }
    const now = Date.now();
    const dueSources: typeof sources = [];
    const updatedSources = [...sources];
    let initialConfigUpdates = false;

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
        initialConfigUpdates = true;
        continue;
      }

      // Check if source is due
      if (now >= nextRunMs) {
        dueSources.push(src);
      }
    }

    if (initialConfigUpdates) {
      await ScraperRepository.saveConfigs(updatedSources);
    }

    if (dueSources.length === 0) {
      return {
        triggeredSources: [],
        summary: 'Tick completed. No due sources found.'
      };
    }

    // Create ONE Scheduler Batch for all due sources!
    batchState.generationId++;
    const currentGen = batchState.generationId;
    const batchRunId = `SCHED-BATCH-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const LOCK_KEY = 'AUTO_SCRAPER_BATCH_LOCK';
    const LOCK_TTL_MS = 5 * 60 * 1000; // 5 minute TTL for batch execution

    // 3. Acquire distributed lock across instances to prevent duplicate concurrent scheduler batches
    const lockAcquired = await ScraperRepository.acquireDistributedLock(LOCK_KEY, batchRunId, LOCK_TTL_MS);
    if (!lockAcquired) {
      console.log(`[Scheduler Engine] Distributed scraper lock is currently held by another server instance. Skipping tick.`);
      return { triggeredSources: [], summary: 'Scheduler tick deferred (distributed lock held by another instance)' };
    }

    batchState = {
      batchRunId,
      batchStatus: 'Running',
      batchTotal: dueSources.length,
      batchCompleted: 0,
      batchCurrentIndex: 0,
      batchCurrentSourceId: null,
      batchCurrentSourceName: null,
      batchTriggeredSources: dueSources.map(s => s.id),
      batchStartedAt: new Date().toISOString(),
      batchLastUpdatedAt: new Date().toISOString(),
      cancelRequested: false,
      generationId: currentGen
    };

    console.log(`[Scheduler Engine] Starting batch ${batchRunId} with ${dueSources.length} due sources.`);

    let configsToUpdate = [...updatedSources];
    try {
      configsToUpdate = await ScraperRepository.getConfigs();
    } catch {
      configsToUpdate = [...updatedSources];
    }
    let hasBatchConfigUpdates = false;
    let isPausedForMongo = false;

    try {
      for (let i = 0; i < dueSources.length; i++) {
        const src = dueSources[i];

        // CRITICAL: Check cancellation / stop / generation token before starting every next source!
        if (!isSchedulerEnabled || batchState.cancelRequested || batchState.generationId !== currentGen || batchState.batchRunId !== batchRunId) {
          console.log(`[Scheduler Engine] Batch ${batchRunId} cancelled/stopped before source ${i + 1}/${dueSources.length} ("${src.name}"). Halting batch.`);
          if ((!isSchedulerEnabled || batchState.cancelRequested) && batchState.batchRunId === batchRunId) {
            batchState.batchStatus = 'Stopped';
            batchState.batchCurrentSourceId = null;
            batchState.batchCurrentSourceName = null;
            batchState.batchLastUpdatedAt = new Date().toISOString();
          }
          break;
        }

        // Refresh/extend distributed lock before executing each source
        const lockHeld = await ScraperRepository.acquireDistributedLock(LOCK_KEY, batchRunId, LOCK_TTL_MS);
        if (!lockHeld) {
          console.warn(`[Scheduler Engine] Batch ${batchRunId} lost distributed lock ownership before source "${src.name}". Halting batch.`);
          if (batchState.batchRunId === batchRunId) {
            batchState.batchStatus = 'Stopped';
            batchState.batchCurrentSourceId = null;
            batchState.batchCurrentSourceName = null;
            batchState.batchLastUpdatedAt = new Date().toISOString();
          }
          break;
        }

        if (batchState.batchRunId === batchRunId && batchState.generationId === currentGen) {
          batchState.batchCurrentIndex = i + 1;
          batchState.batchCurrentSourceId = src.id;
          batchState.batchCurrentSourceName = src.name;
          batchState.batchLastUpdatedAt = new Date().toISOString();
        }

        console.log(`[Scheduler Engine] Batch ${batchRunId} [${i + 1}/${dueSources.length}] Executing source "${src.name}" (${src.id})`);

        let sourceCompleted = false;
        let wasBusy = false;

        try {
          const runResult = await executeScraperWithWizard({
            mode: 'since_last',
            sourceId: src.id,
            autoPublishTrusted: src.autoApprove && featureFlags.enableScraperAutoApprove,
            isSchedulerRun: true
          });

          if (
            runResult?.status === 'Paused' ||
            runResult?.isPaused ||
            (runResult?.message && runResult.message.toLowerCase().includes('paused'))
          ) {
            isPausedForMongo = true;
            console.warn(`[Scheduler Engine] Batch ${batchRunId} source "${src.name}" paused because MongoDB is unavailable. Halting batch safely.`);
          } else {
            sourceCompleted = true;
            console.log(`[Scheduler Engine] Batch ${batchRunId} source "${src.name}" completed. Found: ${runResult.totalFound}`);
          }
        } catch (srcErr: any) {
          const errMsg = String(srcErr?.message || srcErr || '');
          if (isTransientMongoError(srcErr) || errMsg.includes('MongoDB unavailable') || errMsg.includes('transient')) {
            isPausedForMongo = true;
            console.warn(`[Scheduler Engine] Batch ${batchRunId} source "${src.name}" halted on MongoDB error: ${errMsg}`);
          } else if (errMsg.includes('already in progress') || errMsg.includes('currently in progress') || errMsg.includes('currently executing')) {
            wasBusy = true;
            console.log(`[Scheduler Engine] Source "${src.name}" tick deferred: Scraper run in progress.`);
          } else {
            const detail = errMsg.replace(/Failed to fetch|fetch failed/gi, 'remote portal unreachable');
            console.log(`[Scheduler Engine] Source "${src.name}" tick notice: ${detail}`);
          }
        }

        if (isPausedForMongo) {
          console.warn(`[Scheduler Engine] Deferring scheduler tick for source "${src.name}" and remaining batch sources due to MongoDB outage.`);
          if (batchState.batchRunId === batchRunId && batchState.generationId === currentGen) {
            batchState.batchStatus = 'Idle';
            batchState.batchCurrentSourceId = null;
            batchState.batchCurrentSourceName = null;
            batchState.batchLastUpdatedAt = new Date().toISOString();
          }
          break;
        }

        // Check cancellation immediately after source completes
        if (!isSchedulerEnabled || batchState.cancelRequested || batchState.generationId !== currentGen || batchState.batchRunId !== batchRunId) {
          if (sourceCompleted) {
            if (batchState.batchRunId === batchRunId && batchState.generationId === currentGen) {
              batchState.batchCompleted++;
            }
            const completedNow = new Date();
            const intervalMs = parseIntervalToMs(src.interval);
            const cfgIdx = configsToUpdate.findIndex(c => c.id === src.id);
            if (cfgIdx !== -1) {
              configsToUpdate[cfgIdx] = {
                ...configsToUpdate[cfgIdx],
                lastRunAt: completedNow.toISOString(),
                lastCompletedAt: completedNow.toISOString(),
                nextRunAt: new Date(completedNow.getTime() + intervalMs).toISOString()
              };
              hasBatchConfigUpdates = true;
            }
          }
          console.log(`[Scheduler Engine] Batch ${batchRunId} stopped after source ${i + 1}/${dueSources.length} ("${src.name}").`);
          if ((!isSchedulerEnabled || batchState.cancelRequested) && batchState.batchRunId === batchRunId) {
            batchState.batchStatus = 'Stopped';
            batchState.batchCurrentSourceId = null;
            batchState.batchCurrentSourceName = null;
            batchState.batchLastUpdatedAt = new Date().toISOString();
          }
          break;
        }

        if (wasBusy) {
          // Defer this source to next tick (2 minutes)
          const cfgIdx = configsToUpdate.findIndex(c => c.id === src.id);
          if (cfgIdx !== -1) {
            configsToUpdate[cfgIdx] = {
              ...configsToUpdate[cfgIdx],
              nextRunAt: new Date(Date.now() + 2 * 60 * 1000).toISOString()
            };
            hasBatchConfigUpdates = true;
          }
          break; // Stop evaluating further sources in this batch if engine busy
        }

        // Schedule next run ONLY for successfully completed source
        if (sourceCompleted) {
          if (batchState.batchRunId === batchRunId && batchState.generationId === currentGen) {
            batchState.batchCompleted++;
            batchState.batchLastUpdatedAt = new Date().toISOString();
          }
          const completedNow = new Date();
          const intervalMs = parseIntervalToMs(src.interval);
          const cfgIdx = configsToUpdate.findIndex(c => c.id === src.id);
          if (cfgIdx !== -1) {
            configsToUpdate[cfgIdx] = {
              ...configsToUpdate[cfgIdx],
              lastRunAt: completedNow.toISOString(),
              lastCompletedAt: completedNow.toISOString(),
              nextRunAt: new Date(completedNow.getTime() + intervalMs).toISOString()
            };
            hasBatchConfigUpdates = true;
          }
        }
      }

      if (hasBatchConfigUpdates) {
        try {
          await ScraperRepository.saveConfigs(configsToUpdate);
        } catch (saveErr: any) {
          console.warn('[Scheduler Engine] Notice saving batch configs:', saveErr?.message || saveErr);
        }
      }

      if (batchState.batchRunId === batchRunId && batchState.generationId === currentGen && batchState.batchStatus === 'Running') {
        batchState.batchStatus = isPausedForMongo ? 'Idle' : 'Completed';
        batchState.batchCurrentSourceId = null;
        batchState.batchCurrentSourceName = null;
        batchState.batchLastUpdatedAt = new Date().toISOString();
      }

      return {
        triggeredSources: dueSources.map(s => s.id),
        summary: isPausedForMongo
          ? `Scheduler batch paused due to temporary MongoDB outage after ${batchState.batchCompleted}/${dueSources.length} sources.`
          : `Scheduler batch completed ${batchState.batchCompleted}/${dueSources.length} sources.`
      };
    } finally {
      // Always release distributed lock when batch finishes, stops, or errors out
      await ScraperRepository.releaseDistributedLock(LOCK_KEY, batchRunId);
    }
  } finally {
    isTickExecuting = false;
  }
}

/**
 * Returns the current runtime status of the scheduler, batch progress, and all configured sources.
 */
export async function getSchedulerStatus(): Promise<SchedulerStatusResponse> {
  let sources: any[] = [];
  try {
    sources = await ScraperRepository.getConfigs();
  } catch (err: any) {
    console.warn('[Scheduler Engine] Notice fetching configs for scheduler status:', err?.message || err);
  }
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
    isRunning: isSchedulerEnabled,
    schedulerRunning: isSchedulerEnabled,
    tickCronPattern: '*/2 * * * *',
    activeSourcesCount: sources.filter(s => s.status === 'Active Scheduled' || s.status === 'Active').length,
    dueSourcesCount: sourceStatuses.filter(s => s.isDue).length,
    lastTickTimestamp: lastTickTime,

    batchStatus: batchState.batchStatus,
    batchRunId: batchState.batchRunId,
    batchTotal: batchState.batchTotal,
    batchCompleted: batchState.batchCompleted,
    batchCurrentIndex: batchState.batchCurrentIndex,
    batchCurrentSourceId: batchState.batchCurrentSourceId,
    batchCurrentSourceName: batchState.batchCurrentSourceName,
    batchTriggeredSources: batchState.batchTriggeredSources,
    batchStartedAt: batchState.batchStartedAt,
    batchLastUpdatedAt: batchState.batchLastUpdatedAt,

    sources: sourceStatuses
  };
}
