import cron from 'node-cron';
import { ScraperRepository, ScraperSchedulerSettings } from '../db/repositories/ScraperRepository';
import { executeScraperWithWizard, isScraperRunConflictError } from './scraperEngine';
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
  '12h': 12 * 60 * 60 * 1000,
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

const VALID_SCOPES: ScraperSchedulerSettings['scope'][] = ['all', 'selected', 'group', 'working', 'failed', 'single'];

export function isValidSchedulerScope(scope: any): scope is ScraperSchedulerSettings['scope'] {
  return VALID_SCOPES.includes(scope);
}

/**
 * Resolves the eligible source IDs according to the configured scheduled scope.
 * An unknown/invalid scope will never resolve to all sources.
 * Missing or empty IDs for selected/group/single return an empty Set (0 sources).
 */
async function resolveScopedSourceIds(
  settings: ScraperSchedulerSettings,
  allSources: any[],
  getGroupsFn: () => Promise<any[]> = () => ScraperRepository.getGroups()
): Promise<Set<string> | null> {
  const scope = settings.scope;

  // Unknown or invalid scope: must never fall back to all sources
  if (!isValidSchedulerScope(scope)) {
    console.warn(`[Scheduler Engine] Unknown scheduler scope "${scope}". Rejecting fallback to all sources.`);
    return new Set<string>();
  }

  if (scope === 'all') {
    return null; // null represents all active sources
  }

  if (scope === 'selected') {
    const selectedIds = Array.isArray(settings.selectedSourceIds) ? settings.selectedSourceIds.filter(Boolean) : [];
    if (selectedIds.length === 0) {
      console.warn('[Scheduler Engine] Scope is "selected" but no source IDs are configured. Running 0 sources.');
      return new Set<string>();
    }
    return new Set(selectedIds);
  }

  if (scope === 'group') {
    if (!settings.selectedGroupId || !settings.selectedGroupId.trim()) {
      console.warn('[Scheduler Engine] Scope is "group" but no groupId is configured. Running 0 sources.');
      return new Set<string>();
    }
    const groups = await getGroupsFn();
    const targetGroup = groups.find(g => g.id === settings.selectedGroupId);
    if (!targetGroup || !Array.isArray(targetGroup.sourceIds) || targetGroup.sourceIds.length === 0) {
      console.warn(`[Scheduler Engine] Group "${settings.selectedGroupId}" not found or has 0 sources. Running 0 sources.`);
      return new Set<string>();
    }
    return new Set(targetGroup.sourceIds);
  }

  if (scope === 'single') {
    if (!settings.singleSourceId || !settings.singleSourceId.trim()) {
      console.warn('[Scheduler Engine] Scope is "single" but no singleSourceId is configured. Running 0 sources.');
      return new Set<string>();
    }
    return new Set([settings.singleSourceId.trim()]);
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

  return new Set<string>();
}

export interface SchedulerRuntimeDeps {
  getSchedulerSettingsFn?: () => Promise<ScraperSchedulerSettings>;
  saveSchedulerSettingsFn?: (settings: Partial<ScraperSchedulerSettings>) => Promise<ScraperSchedulerSettings>;
  getConfigsFn?: () => Promise<any[]>;
  getGroupsFn?: () => Promise<any[]>;
  updateSourceScheduleFn?: (
    sourceId: string,
    schedule: { lastRunAt?: string; lastCompletedAt?: string; nextRunAt?: string }
  ) => Promise<boolean>;
  executeScraperFn?: typeof executeScraperWithWizard;
  addRunFn?: (run: any) => Promise<any>;
  isScraperEnabledFn?: () => boolean;
  isAutoApproveEnabledFn?: () => boolean;
  scheduleCronFn?: typeof cron.schedule;
  resetStaleSchedulesFn?: () => Promise<{ resetCount: number }>;
}

/**
 * Executes a scheduler tick: checks individual source intervals and triggers scraping for due sources within the configured scope.
 * Fail-closed: if authoritative settings, configs, or groups (when scope === 'group') fail to load,
 * aborts the tick immediately with 0 sources executed and returns a visible aborted/error diagnostic.
 */
export async function runSchedulerTick(
  _deps?: SchedulerRuntimeDeps
): Promise<{
  triggeredSources: string[];
  failedSources?: string[];
  aborted?: boolean;
  skippedDueToConflict?: boolean;
  error?: string;
  summary: any;
}> {
  if (isTickExecuting) {
    console.log('[Scheduler Engine] Previous tick still executing. Skipping tick.');
    return { triggeredSources: [], summary: 'Concurrent tick avoided' };
  }

  isTickExecuting = true;
  const tickStartedAt = new Date();
  // One stable batch ID groups all per-source executions triggered by this scheduler tick.
  // Individual run IDs remain unique for backward compatibility.
  const schedulerBatchId = `SCHED-BATCH-${tickStartedAt.getTime().toString(36).toUpperCase()}`;
  lastTickTime = tickStartedAt.toISOString();
  const triggered: string[] = [];
  const failed: string[] = [];
  const plannedSourceIds: string[] = [];
  const successfulRunResults: any[] = [];
  const scheduleUpdateErrors: Array<{ sourceId: string; error: string }> = [];
  const failedErrors: Array<{ sourceId: string; sourceName: string; sourceUrl: string; error: string }> = [];

  const isScraperEnabled = _deps?.isScraperEnabledFn ? _deps.isScraperEnabledFn() : featureFlags.enableWebScraper;
  const isAutoApproveEnabled = _deps?.isAutoApproveEnabledFn
    ? _deps.isAutoApproveEnabledFn()
    : featureFlags.enableScraperAutoApprove;
  const getSettingsFn = _deps?.getSchedulerSettingsFn || (() => ScraperRepository.getSchedulerSettings());
  const getConfigsFn = _deps?.getConfigsFn || (() => ScraperRepository.getConfigs());
  const getGroupsFn = _deps?.getGroupsFn || (() => ScraperRepository.getGroups());
  const updateScheduleFn =
    _deps?.updateSourceScheduleFn ||
    ((sourceId, schedule) => ScraperRepository.updateSourceSchedule(sourceId, schedule));
  const executeFn = _deps?.executeScraperFn || executeScraperWithWizard;
  const addRunFn = _deps?.addRunFn || ((run: any) => ScraperRepository.addRun(run));

  try {
    if (!isScraperEnabled) {
      console.log('[Scheduler Engine] Web scraper is disabled by feature flag.');
      return { triggeredSources: [], summary: 'Web scraper disabled by feature flag' };
    }

    let settings: ScraperSchedulerSettings;
    let sources: any[];
    let scopedSourceIds: Set<string> | null;

    try {
      settings = await getSettingsFn();
      if (!settings.enabled) {
        console.log('[Scheduler Engine] Scheduler is paused in settings. Skipping tick.');
        return { triggeredSources: [], summary: 'Scheduler paused in settings' };
      }

      sources = await getConfigsFn();
      scopedSourceIds = await resolveScopedSourceIds(settings, sources, getGroupsFn);
    } catch (authErr: any) {
      const errorMsg = authErr?.message || String(authErr);
      console.error(`[Scheduler Engine] Aborting scheduler tick due to authoritative DB read failure: ${errorMsg}`);
      return {
        triggeredSources: [],
        aborted: true,
        error: errorMsg,
        summary: `Scheduler tick aborted cleanly (authoritative read failure): ${errorMsg}`
      };
    }

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
          const persisted = await updateScheduleFn(src.id, { nextRunAt });
          if (persisted) {
            src.nextRunAt = nextRunAt;
          }
          continue;
        }

        // Check if source is due
        if (now >= nextRunMs) {
          plannedSourceIds.push(src.id);
          console.log(`[Scheduler Engine] Source "${src.name}" (${src.id}) is due for scrape (Interval: ${src.interval || settings.interval || '24h'}, Scope: ${settings.scope}).`);

          try {
            // Resolve scheduled mode: preserve 'since_last' as backward-compatible default
            let scheduledMode: 'since_last' | 'complete' | 'page_range' = 'since_last';
            if (settings.scanMode === 'complete') {
              scheduledMode = 'complete';
            } else if (settings.scanMode === 'page_range') {
              scheduledMode = 'page_range';
            }

            const validStartPage = Math.max(1, Number(settings.startPage) || 1);
            const validEndPage = Math.max(validStartPage, Number(settings.endPage) || validStartPage);

            const runResult = await executeFn({
              mode: scheduledMode,
              sourceId: src.id,
              startPage: scheduledMode === 'page_range' ? validStartPage : undefined,
              endPage: scheduledMode === 'page_range' ? validEndPage : undefined,
              autoPublishTrusted: (settings.autoApprove ?? src.autoApprove) && isAutoApproveEnabled,
              duplicateMode: settings.duplicateMode === 'without' ? 'without' : 'with',
              batchId: schedulerBatchId
            });

            triggered.push(src.id);
            successfulRunResults.push(runResult);
            console.log(`[Scheduler Engine] Source "${src.name}" scraped. Found: ${runResult.totalFound}, Duplicates: ${runResult.totalDuplicates}`);
          } catch (srcErr: any) {
            if (isScraperRunConflictError(srcErr)) {
              const conflictMsg = srcErr?.message || 'Another scraper execution is already in progress';
              console.warn(`[Scheduler Engine] Skipped due source "${src.name}" (${src.id}) and aborted tick cleanly without advancing schedule: ${conflictMsg}`);
              return {
                triggeredSources: triggered,
                failedSources: failed.length > 0 ? failed : undefined,
                aborted: true,
                skippedDueToConflict: true,
                error: conflictMsg,
                summary: `Scheduler tick skipped due source "${src.id}" and aborted cleanly (${conflictMsg}).`
              };
            }
            const errMsg = srcErr?.message || String(srcErr);
            failed.push(src.id);
            failedErrors.push({
              sourceId: src.id,
              sourceName: src.name || src.id,
              sourceUrl: src.url || '',
              error: errMsg
            });
            console.error(`[Scheduler Engine] Source "${src.name}" execution error: ${errMsg}. Scheduler continuing with other due sources.`);
          }

          // Schedule next run regardless of single source outcome, mutating source runtime object only if persisted
          const completedNow = new Date();
          const lastRunAt = completedNow.toISOString();
          const lastCompletedAt = completedNow.toISOString();
          const nextRunAt = new Date(completedNow.getTime() + intervalMs).toISOString();

          const persisted = await updateScheduleFn(src.id, {
            lastRunAt,
            lastCompletedAt,
            nextRunAt
          });
          if (persisted) {
            src.lastRunAt = lastRunAt;
            src.lastCompletedAt = lastCompletedAt;
            src.nextRunAt = nextRunAt;
          }
        }
      } catch (sourceLoopErr: any) {
        const loopErrMsg = sourceLoopErr?.message || String(sourceLoopErr);
        if (triggered.includes(src.id)) {
          scheduleUpdateErrors.push({ sourceId: src.id, error: loopErrMsg });
        } else if (!failed.includes(src.id)) {
          failed.push(src.id);
          failedErrors.push({
          sourceId: src.id,
          sourceName: src.name || src.id,
          sourceUrl: src.url || '',
          error: loopErrMsg
          });
        }
        console.warn(`[Scheduler Engine] Notice processing source "${src.name}" during tick:`, loopErrMsg);
      }
    }

    // Persist scheduler failure/execution record when an unexpected execution error threw before executeScraperWithWizard recorded a run
    if (failed.length > 0) {
      const tickEnd = new Date();
      try {
        await addRunFn({
          id: `SCHED-${tickEnd.getTime().toString(36).toUpperCase()}`,
          batchId: schedulerBatchId,
          startedAt: tickStartedAt.toISOString(),
          completedAt: tickEnd.toISOString(),
          mode: settings.scanMode || 'since_last',
          triggerType: 'Scheduled Cron',
          targetsScraped: triggered.length + failed.length,
          totalTargetsPlanned: triggered.length + failed.length,
          status: triggered.length > 0 ? 'Partial' : 'Failed',
          totalFound: 0,
          totalNew: 0,
          totalDuplicates: 0,
          newPublished: 0,
          newPending: 0,
          duplicatesFlagged: 0,
          failedSources: failed.length,
          executionTimeMs: tickEnd.getTime() - tickStartedAt.getTime(),
          message: `Scheduler tick encountered ${failed.length} source execution error(s): ${failedErrors.map(e => `${e.sourceName}: ${e.error}`).join('; ')}`,
          sourcesStats: failedErrors.map(e => ({
            sourceId: e.sourceId,
            sourceName: e.sourceName,
            sourceUrl: e.sourceUrl,
            startedAt: tickStartedAt.toISOString(),
            completedAt: tickEnd.toISOString(),
            found: 0,
            newCount: 0,
            dupCount: 0,
            pagesAttempted: 1,
            pagesSuccessful: 0,
            failed: true,
            error: e.error
          }))
        });
      } catch (runPersistErr: any) {
        console.warn('[Scheduler Engine] Unable to record failed tick run summary:', runPersistErr?.message || runPersistErr);
      }
    }

    // Persist one aggregate parent record for this scheduler batch. Per-source run records remain untouched.
    if (plannedSourceIds.length > 0) {
      const batchEndedAt = new Date();
      const successfulSourcesStats = successfulRunResults.flatMap(result =>
        Array.isArray(result?.sourcesStats) ? result.sourcesStats : []
      );
      const failedSourcesStats = failedErrors.map(error => ({
        sourceId: error.sourceId,
        sourceName: error.sourceName,
        sourceUrl: error.sourceUrl,
        startedAt: tickStartedAt.toISOString(),
        completedAt: batchEndedAt.toISOString(),
        found: 0,
        newCount: 0,
        dupCount: 0,
        pagesAttempted: 1,
        pagesSuccessful: 0,
        failed: true,
        error: error.error,
        failureCategory: 'Scheduler Execution Failed'
      }));
      const completedRunCount = successfulRunResults.filter(result => !result?.status || result.status === 'Completed').length;
      const partialRunCount = successfulRunResults.filter(result => result?.status === 'Partial' || result?.status === 'Stopped').length;
      const failedRunCount = successfulRunResults.filter(result => result?.status === 'Failed').length;
      const batchFailedSourceCount = failed.length + failedRunCount;
      const batchStatus = batchFailedSourceCount > 0
        ? (completedRunCount + partialRunCount > 0 ? 'Partial' : 'Failed')
        : (partialRunCount > 0 || scheduleUpdateErrors.length > 0 ? 'Partial' : 'Completed');
      try {
        await addRunFn({
          id: `SCHED-BATCH-SUMMARY-${tickStartedAt.getTime().toString(36).toUpperCase()}`,
          batchId: schedulerBatchId,
          recordType: 'batch_summary',
          triggerType: 'Scheduled Cron',
          startedAt: tickStartedAt.toISOString(),
          completedAt: batchEndedAt.toISOString(),
          mode: settings.scanMode || 'since_last',
          duplicateMode: settings.duplicateMode === 'without' ? 'without' : 'with',
          targetsScraped: triggered.length,
          totalTargetsPlanned: plannedSourceIds.length,
          successfulSources: completedRunCount,
          partialSources: partialRunCount,
          failedSources: batchFailedSourceCount,
          scheduleUpdateFailures: scheduleUpdateErrors.length,
          status: batchStatus,
          totalFound: successfulRunResults.reduce((sum, result) => sum + (Number(result?.totalFound) || 0), 0),
          totalNew: successfulRunResults.reduce((sum, result) => sum + (Number(result?.totalNew) || 0), 0),
          totalDuplicates: successfulRunResults.reduce((sum, result) => sum + (Number(result?.totalDuplicates) || 0), 0),
          totalFailedToSave: successfulRunResults.reduce((sum, result) => sum + (Number(result?.totalFailedToSave) || 0), 0),
          newPublished: successfulRunResults.reduce((sum, result) => sum + (Number(result?.totalPublished) || 0), 0),
          newPending: successfulRunResults.reduce((sum, result) => sum + (Number(result?.totalPending) || 0), 0),
          duplicatesFlagged: successfulRunResults.reduce((sum, result) => sum + (Number(result?.totalDuplicates) || 0), 0),
          executionTimeMs: batchEndedAt.getTime() - tickStartedAt.getTime(),
          scheduleUpdateErrors,
          sourcesStats: [...successfulSourcesStats, ...failedSourcesStats],
          message: `Scheduler batch completed: ${triggered.length} successful, ${failed.length} failed, ${scheduleUpdateErrors.length} schedule update warning(s) across ${plannedSourceIds.length} due sources.`
        });
      } catch (batchPersistErr: any) {
        console.warn('[Scheduler Engine] Unable to persist aggregate batch summary:', batchPersistErr?.message || batchPersistErr);
      }
    }

    return {
      triggeredSources: triggered,
      failedSources: failed.length > 0 ? failed : undefined,
      summary: failed.length > 0
        ? `Tick completed (Scope: ${settings.scope}). Triggered ${triggered.length} sources, ${failed.length} failed.`
        : `Tick completed (Scope: ${settings.scope}). Triggered ${triggered.length} sources.`
    };
  } finally {
    isTickExecuting = false;
  }
}

/**
 * Stops the background cron scheduler task if active (used by shutdown or tests).
 */
export function stopScraperScheduler(): void {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
  }
}

/**
 * Initializes the dynamic cron scheduler.
 * Ticks every 2 minutes to check configured intervals for all sources.
 * Fail-closed: refuses to call cron.schedule if reading authoritative scheduler settings fails.
 */
export async function initScraperScheduler(_deps?: SchedulerRuntimeDeps): Promise<boolean> {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
  }

  const resetFn =
    _deps?.resetStaleSchedulesFn ||
    (typeof (ScraperRepository as any)?.resetStaleSchedules === 'function'
      ? () => (ScraperRepository as any).resetStaleSchedules()
      : null);

  if (resetFn) {
    resetFn().catch((err: any) => {
      console.log('[Scheduler Engine] resetStaleSchedules notice:', err?.message || err);
    });
  }

  const getSettingsFn = _deps?.getSchedulerSettingsFn || (() => ScraperRepository.getSchedulerSettings());
  const scheduleFn = _deps?.scheduleCronFn || cron.schedule;

  try {
    const settings = await getSettingsFn();
    if (!settings.enabled) {
      console.log('⏱️ [Scheduler Engine] Scraper scheduler is currently paused per database settings.');
      return false;
    }

    scheduledTask = scheduleFn('*/2 * * * *', async () => {
      try {
        await runSchedulerTick(_deps);
      } catch (err: any) {
        console.log('[Scheduler Engine] Scheduler tick notice:', err?.message || err);
      }
    });
    console.log(`⏱️ [Scheduler Engine] Dynamic interval-aware scraper scheduler initialized (tick: */2 * * * *, scope: ${settings.scope || 'all'}).`);
    return true;
  } catch (err: any) {
    scheduledTask = null;
    console.error(
      '[Scheduler Engine] Refusing to start background cron scheduler because authoritative scheduler settings could not be loaded:',
      err?.message || err
    );
    return false;
  }
}

/**
 * Returns the current runtime status of the scheduler and all configured sources.
 */
export async function getSchedulerStatus(_deps?: SchedulerRuntimeDeps): Promise<SchedulerStatusResponse> {
  const getConfigsFn = _deps?.getConfigsFn || (() => ScraperRepository.getConfigs());
  const getSettingsFn = _deps?.getSchedulerSettingsFn || (() => ScraperRepository.getSchedulerSettings());
  const getGroupsFn = _deps?.getGroupsFn || (() => ScraperRepository.getGroups());

  const sources = await getConfigsFn();
  const settings = await getSettingsFn();
  const scopedSourceIds = await resolveScopedSourceIds(settings, sources, getGroupsFn);
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
export async function setGlobalSchedulerState(
  enabled: boolean,
  _deps?: SchedulerRuntimeDeps
): Promise<{ isRunning: boolean; isPersistedToMongo: boolean; message: string }> {
  const saveSettingsFn =
    _deps?.saveSchedulerSettingsFn || ((s) => ScraperRepository.saveSchedulerSettings(s));

  const saved = await saveSettingsFn({ enabled });
  const isPersistedToMongo = Boolean((saved as any).isPersistedToMongo);

  if (enabled) {
    if (!scheduledTask) {
      await initScraperScheduler(_deps);
    }
    const isRunning = scheduledTask !== null;
    return {
      isRunning,
      isPersistedToMongo,
      message: isRunning
        ? isPersistedToMongo
          ? 'Global scraper scheduler enabled and saved to MongoDB.'
          : 'Global scraper scheduler enabled in memory cache (MongoDB not configured).'
        : 'Global scraper scheduler settings saved, but cron failed to start because authoritative settings could not be confirmed.'
    };
  } else {
    stopScraperScheduler();
    return {
      isRunning: false,
      isPersistedToMongo,
      message: isPersistedToMongo
        ? 'Global scraper scheduler paused and saved to MongoDB.'
        : 'Global scraper scheduler paused in memory cache (MongoDB not configured).'
    };
  }
}

