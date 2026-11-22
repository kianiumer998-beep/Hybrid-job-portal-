import crypto from 'crypto';
import { ScraperRepository, isTransientMongoError } from '../db/repositories/ScraperRepository';
import {
  JobRepository,
  MAX_SCRAPER_INSERT_RETRIES,
  ScraperPersistenceCollisionError,
  isMongoDuplicateKeyError
} from '../db/repositories/JobRepository';
import { AuditRepository } from '../db/repositories/AuditRepository';
import { scrapeTargetPortal, ScrapedJobResult, ScraperTargetConfig } from '../../src/services/scraperService';
import { validateSafeScrapeUrl } from '../utils/ssrfProtection';
import { sanitizeUrlForLog } from './pdfParserEngine';
import { detectJobDuplicate, DuplicateMatchResult } from './duplicateEngine';
import { enrichScrapedJobsBatch } from './detailPageEnricher';

export interface ScraperRunOptions {
  mode: 'complete' | 'since_last' | 'page_range' | 'custom_date' | 'keyword_drill';
  sourceId?: string;
  sourceIds?: string[];
  startPage?: number;
  endPage?: number;
  sinceTimestamp?: string;
  fromTimestamp?: string;
  toTimestamp?: string;
  keywords?: string;
  /** Optional per-source candidate limit used by the background scheduler only. */
  maxJobsPerSource?: number;
  autoPublishTrusted?: boolean;
  duplicateMode?: 'with' | 'without';
  /** Shared ID for grouping source-level executions from one scheduler tick. */
  batchId?: string;
}

export const SCRAPER_RUN_ALREADY_ACTIVE_CODE = 'SCRAPER_RUN_ALREADY_ACTIVE';

export class ScraperRunConflictError extends Error {
  code: string;
  status: number;
  statusCode: number;
  activeRun: ActiveRunStatus;

  constructor(message?: string, activeRun?: ActiveRunStatus) {
    const activeInfo = activeRun?.runId ? ` (active run: ${activeRun.runId})` : '';
    super(message || `Another scraper execution is already in progress${activeInfo}.`);
    this.name = 'ScraperRunConflictError';
    this.code = SCRAPER_RUN_ALREADY_ACTIVE_CODE;
    this.status = 409;
    this.statusCode = 409;
    this.activeRun = activeRun ? { ...activeRun } : getActiveRunStatus();
  }
}

export function isScraperRunConflictError(err: any): boolean {
  return Boolean(
    err &&
      (err.code === SCRAPER_RUN_ALREADY_ACTIVE_CODE ||
        err.name === 'ScraperRunConflictError' ||
        err.statusCode === 409 ||
        err.status === 409)
  );
}

export interface ScraperEngineRuntimeDeps {
  getConfigsFn?: () => Promise<any[]>;
  updateSourceStatsFn?: (sourceId: string, stats: any) => Promise<void>;
  addRunFn?: (run: any) => Promise<any>;
  scrapePageFn?: typeof scrapeTargetPortal;
  enrichJobsFn?: typeof enrichScrapedJobsBatch;
  findDuplicateCandidatesFn?: (candidateJob: any) => Promise<any[]>;
  createJobFn?: (jobData: any) => Promise<any>;
  addPendingJobFn?: (jobData: any) => Promise<any>;
  auditAddFn?: (entry: any) => Promise<any> | void;
}

export interface ActiveRunStatus {
  isActive: boolean;
  isPaused: boolean;
  stopped?: boolean;
  runId?: string;
  mode?: string;
  duplicateMode?: 'with' | 'without';
  totalSources: number;
  completedSources: number;
  remainingSources: number;
  currentSource?: {
    id: string;
    name: string;
    url: string;
    index: number;
  };
  totalFound: number;
  totalNew: number;
  totalDuplicates: number;
  totalPending: number;
  totalPublished: number;
  totalFailedSources: number;
  currentError?: string;
  runProgress: number;
  startTime?: string;
  lastUpdated?: string;
}

let activeRunState: ActiveRunStatus = {
  isActive: false,
  isPaused: false,
  stopped: false,
  totalSources: 0,
  completedSources: 0,
  remainingSources: 0,
  totalFound: 0,
  totalNew: 0,
  totalDuplicates: 0,
  totalPending: 0,
  totalPublished: 0,
  totalFailedSources: 0,
  runProgress: 0
};

let isScraperExecutionLocked = false;
let shouldStopActiveRun = false;
let pauseResolver: (() => void) | null = null;
let pausePromise: Promise<void> | null = null;

export function isScraperExecutionActive(): boolean {
  return isScraperExecutionLocked || activeRunState.isActive;
}

export function getActiveRunStatus(): ActiveRunStatus {
  return {
    ...activeRunState,
    isActive: Boolean(isScraperExecutionLocked || activeRunState.isActive)
  };
}

export function pauseActiveRun(): boolean {
  if (!activeRunState.isActive || activeRunState.isPaused) return false;
  activeRunState.isPaused = true;
  pausePromise = new Promise((resolve) => {
    pauseResolver = resolve;
  });
  return true;
}

export function resumeActiveRun(): boolean {
  if (!activeRunState.isActive || !activeRunState.isPaused) return false;
  activeRunState.isPaused = false;
  if (pauseResolver) {
    pauseResolver();
    pauseResolver = null;
    pausePromise = null;
  }
  return true;
}

export function stopActiveRun(): boolean {
  if (!activeRunState.isActive) return false;
  shouldStopActiveRun = true;
  if (activeRunState.isPaused && pauseResolver) {
    pauseResolver();
    pauseResolver = null;
    pausePromise = null;
  }
  return true;
}

export function resetActiveRun(): ActiveRunStatus {
  if (isScraperExecutionLocked || activeRunState.isActive) {
    throw new ScraperRunConflictError(
      `Cannot reset active scraper run (${activeRunState.runId || 'in progress'}) while execution is running. Stop the run first.`,
      getActiveRunStatus()
    );
  }
  shouldStopActiveRun = false;
  if (pauseResolver) {
    pauseResolver();
    pauseResolver = null;
    pausePromise = null;
  }
  activeRunState = {
    isActive: false,
    isPaused: false,
    stopped: false,
    totalSources: 0,
    completedSources: 0,
    remainingSources: 0,
    totalFound: 0,
    totalNew: 0,
    totalDuplicates: 0,
    totalPending: 0,
    totalPublished: 0,
    totalFailedSources: 0,
    runProgress: 0
  };
  return { ...activeRunState };
}

export interface ScraperRunSummary {
  runId: string;
  duplicateMode?: 'with' | 'without';
  startTime: string;
  endTime: string;
  stopped?: boolean;
  status?: 'Completed' | 'Partial' | 'Failed' | 'Stopped';
  targetsScraped?: number;
  historyPersistedToMongo?: boolean;
  historyPersistenceMode?: 'mongodb' | 'memory' | 'failed';
  historyPersistenceError?: string;
  totalFound: number;
  totalNew: number;
  totalDuplicates: number;
  totalPending: number;
  totalPublished: number;
  totalFailedSources: number;
  totalFailedToSave?: number;
  failedToSaveErrors?: Array<{ title: string; error: string }>;
  pagesAttempted: number;
  pagesSuccessful: number;
  jobsAccepted: number;
  jobsRejected: number;
  publishedJobs: any[];
  pendingJobs: any[];
  duplicateJobs: any[];
  sourcesStats: Array<{
    sourceId: string;
    sourceName: string;
    sourceUrl: string;
    startedAt: string;
    completedAt: string;
    found: number;
    rawCandidateCount?: number;
    newCount: number;
    dupCount: number;
    persistedCount?: number;
    failedToSaveCount?: number;
    rejectedCount?: number;
    pagesAttempted: number;
    pagesSuccessful: number;
    failed: boolean;
    error?: string;
    failureCategory?: string;
    lastSuccessfulScrapeAt?: string;
  }>;
  executionDurationMs: number;
  message?: string;
}

function createEmptySummary(runId: string, startTime: Date, message: string): ScraperRunSummary {
  const endTime = new Date();
  return {
    runId,
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    totalFound: 0,
    totalNew: 0,
    totalDuplicates: 0,
    totalPending: 0,
    totalPublished: 0,
    totalFailedSources: 0,
    totalFailedToSave: 0,
    pagesAttempted: 0,
    pagesSuccessful: 0,
    jobsAccepted: 0,
    jobsRejected: 0,
    publishedJobs: [],
    pendingJobs: [],
    duplicateJobs: [],
    sourcesStats: [],
    executionDurationMs: endTime.getTime() - startTime.getTime(),
    message
  };
}

export interface CheckpointEligibilityInput {
  mode: ScraperRunOptions['mode'];
  hasNoPageErrors: boolean;
  hitSafetyLimit: boolean;
  paginationDiagnostic?: string;
  isDetectionSuccessful: boolean;
  hasUnsavedRequiredVacancies: boolean;
}

/**
 * Evaluates whether a scrape run qualifies to advance target.lastSuccessfulScrapeAt.
 * Rejects incomplete pagination stopped by MAX_SAFETY_PAGES OR a paginationDiagnostic
 * (unsafe/external/SSRF URL, repeated URL, or discovered/numeric cycle).
 */
export function evaluateCheckpointEligibility(input: CheckpointEligibilityInput): boolean {
  const isCompleteMode = input.mode === 'complete';
  const hasNoPaginationStopDiagnostic = !input.paginationDiagnostic || input.paginationDiagnostic.trim().length === 0;
  const isNaturalPaginationEnd = !input.hitSafetyLimit && hasNoPaginationStopDiagnostic;
  return (
    isCompleteMode &&
    input.hasNoPageErrors &&
    isNaturalPaginationEnd &&
    input.isDetectionSuccessful &&
    !input.hasUnsavedRequiredVacancies
  );
}

export interface SourceCompletionStatsInput {
  sourceCompletedAt: string;
  previousLastSuccessfulScrapeAt?: string;
  runId: string;
  isCheckpointEligible: boolean;
  isDetectionSuccessful: boolean;
  isAllPersistAttemptsFailed: boolean;
  hasUnsavedRequiredVacancies: boolean;
  sourceSaveFailures: number;
  sourceUniqueSaveFailures: number;
  sourceDupSaveFailures: number;
  sourcePagesAttempted: number;
  lastPageError: any;
  paginationDiagnostic?: string;
  hitSafetyLimit: boolean;
  maxSafetyPages: number;
  isCompleteMode: boolean;
  sourceValid: number;
  sourceFound: number;
  sourcePersisted: number;
  sourceIntentionalSkips: number;
  provenExtractionMethodsToAdd?: string[];
}

/**
 * Computes source healthStatus, surface notice, and stats update payload after a scrape run.
 * Writes an empty string for lastErrorMessage when there is no current error so stale
 * pagination or transient diagnostics are cleared in MongoDB on subsequent clean runs.
 */
export function buildSourceCompletionStatsUpdate(input: SourceCompletionStatsInput): {
  successHealth: string;
  lastErrorNotice?: string;
  sourceError?: string;
  statsUpdate: {
    lastCompletedAt: string;
    lastSuccessfulScrapeAt?: string;
    lastRunId: string;
    scrapedCountIncrement?: number;
    healthStatus: string;
    lastErrorMessage: string;
    provenExtractionMethodsToAdd?: string[];
  };
} {
  let successHealth = 'No Jobs';
  let lastErrorNotice: string | undefined;
  let sourceError: string | undefined;

  if (input.isAllPersistAttemptsFailed) {
    sourceError = `Database save failure: ${input.sourceSaveFailures} valid vacancies failed to persist`;
    successHealth = 'Database Error';
    lastErrorNotice = sourceError;
  } else if (input.isDetectionSuccessful) {
    successHealth = 'Jobs Found';
    if (input.hasUnsavedRequiredVacancies) {
      const failureParts: string[] = [];
      if (input.sourceUniqueSaveFailures > 0) failureParts.push(`${input.sourceUniqueSaveFailures} unique`);
      if (input.sourceDupSaveFailures > 0) failureParts.push(`${input.sourceDupSaveFailures} duplicate`);
      lastErrorNotice = `${failureParts.join(' and ')} vacancies failed to save to database (checkpoint preserved)`;
    } else if (input.lastPageError) {
      lastErrorNotice = `Crawling interrupted on page ${input.sourcePagesAttempted} (${input.lastPageError?.message || input.lastPageError}) (checkpoint preserved)`;
    } else if (input.paginationDiagnostic) {
      lastErrorNotice = input.paginationDiagnostic;
    } else if (input.hitSafetyLimit) {
      lastErrorNotice = `Pagination truncated at safety limit of ${input.maxSafetyPages} pages (checkpoint preserved)`;
    } else if (!input.isCompleteMode) {
      // Checkpoint preserved for non-complete modes (e.g. page_range, quick, custom_date, since_last)
    } else if (input.sourceSaveFailures > 0) {
      lastErrorNotice = `${input.sourceSaveFailures} of ${input.sourceValid} vacancies failed to save to database`;
    }
  } else if (input.lastPageError) {
    const errMsg = String(input.lastPageError?.message || input.lastPageError || 'Page crawl error');
    const errLower = errMsg.toLowerCase();
    successHealth = errLower.includes('timeout') || errLower.includes('timed out') || errLower.includes('etimedout') || errLower.includes('abort')
      ? 'Timeout'
      : 'Fetch Error';
    lastErrorNotice = `Crawling interrupted on page ${input.sourcePagesAttempted} (${errMsg}) (checkpoint preserved)`;
  } else {
    successHealth = 'No Jobs';
    lastErrorNotice = input.paginationDiagnostic || (
      input.sourceFound > 0
        ? `0 valid vacancies extracted (${input.sourceFound} candidates rejected as invalid/low-quality)`
        : '0 vacancies extracted from target source'
    );
  }

  const cleanMethods =
    input.isDetectionSuccessful && input.sourcePersisted > 0 && Array.isArray(input.provenExtractionMethodsToAdd)
      ? Array.from(new Set(input.provenExtractionMethodsToAdd.map(m => String(m || '').trim()).filter(Boolean)))
      : [];

  return {
    successHealth,
    lastErrorNotice,
    sourceError,
    statsUpdate: {
      lastCompletedAt: input.sourceCompletedAt,
      lastSuccessfulScrapeAt: input.isCheckpointEligible
        ? input.sourceCompletedAt
        : input.previousLastSuccessfulScrapeAt,
      lastRunId: input.runId,
      scrapedCountIncrement: input.isDetectionSuccessful
        ? (input.sourcePersisted + input.sourceIntentionalSkips)
        : undefined,
      healthStatus: successHealth,
      lastErrorMessage: lastErrorNotice ?? '',
      ...(cleanMethods.length > 0 ? { provenExtractionMethodsToAdd: cleanMethods } : {})
    }
  };
}

/**
 * Canonicalizes a pagination URL for cycle detection while preserving query parameters.
 * Normalizes scheme, host (stripping optional leading www.), trailing slashes, sorted query params, and strips hash fragments.
 */
export function canonicalizePaginationUrl(urlStr: string): string {
  try {
    const parsed = new URL(urlStr.trim());
    const protocol = parsed.protocol.toLowerCase();
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
    const port = parsed.port ? `:${parsed.port}` : '';
    const pathname = parsed.pathname.replace(/\/+$/, '') || '/';
    const sortedParams = new URLSearchParams(
      Array.from(parsed.searchParams.entries()).sort(([aK, aV], [bK, bV]) =>
        aK === bK ? aV.localeCompare(bV) : aK.localeCompare(bK)
      )
    );
    const query = sortedParams.toString();
    return `${protocol}//${hostname}${port}${pathname}${query ? `?${query}` : ''}`;
  } catch {
    return (urlStr || '').trim().toLowerCase().split('#')[0];
  }
}

/**
 * Validates a discovered next-page URL before following it in complete pagination mode:
 * - HTTP/HTTPS only
 * - Existing SSRF protection (blocks private IPs, localhost, loopback, metadata endpoints)
 * - Same portal hostname only (with optional www. normalization) and matching port
 * - Protocol downgrade rejection (HTTPS portal -> HTTP link rejected)
 * - Canonical URL cycle detection against already-visited URLs
 */
export function validateDiscoveredNextPageUrl(
  candidateUrl: string,
  portalUrl: string,
  visitedCanonicalUrls: Set<string>
): { valid: boolean; reason?: string; canonicalUrl?: string; normalizedUrl?: string } {
  if (!candidateUrl || typeof candidateUrl !== 'string' || !candidateUrl.trim()) {
    return { valid: false, reason: 'Empty next-page URL rejected' };
  }

  let candidateParsed: URL;
  let portalParsed: URL;
  try {
    candidateParsed = new URL(candidateUrl.trim());
  } catch {
    return { valid: false, reason: `Malformed next-page URL rejected: ${sanitizeUrlForLog(candidateUrl)}` };
  }

  try {
    portalParsed = new URL(portalUrl.trim());
  } catch {
    return { valid: false, reason: 'Invalid portal base URL' };
  }

  if (candidateParsed.protocol !== 'http:' && candidateParsed.protocol !== 'https:') {
    return {
      valid: false,
      reason: `Unsafe protocol "${candidateParsed.protocol}" rejected for next-page URL`
    };
  }

  const ssrfCheck = validateSafeScrapeUrl(candidateParsed.toString());
  if (!ssrfCheck.safe) {
    return {
      valid: false,
      reason: `SSRF validation rejected next-page URL: ${ssrfCheck.error || 'unsafe target'}`
    };
  }

  if (portalParsed.protocol === 'https:' && candidateParsed.protocol !== 'https:') {
    return {
      valid: false,
      reason: 'HTTP protocol downgrade rejected for next-page URL'
    };
  }

  const normalizeHost = (host: string) => host.toLowerCase().replace(/^www\./, '');
  if (normalizeHost(candidateParsed.hostname) !== normalizeHost(portalParsed.hostname)) {
    return {
      valid: false,
      reason: `External hostname "${candidateParsed.hostname}" rejected (expected portal host "${portalParsed.hostname}")`
    };
  }

  if (candidateParsed.port !== portalParsed.port) {
    return {
      valid: false,
      reason: `Port mismatch on next-page URL rejected`
    };
  }

  const canonicalUrl = canonicalizePaginationUrl(candidateParsed.toString());
  if (visitedCanonicalUrls.has(canonicalUrl)) {
    return {
      valid: false,
      reason: `Pagination cycle detected: repeated next-page URL (${sanitizeUrlForLog(candidateParsed.toString())})`,
      canonicalUrl
    };
  }

  return {
    valid: true,
    canonicalUrl,
    normalizedUrl: candidateParsed.toString()
  };
}

export async function crawlPortalPages(
  target: ScraperTargetConfig,
  options: Pick<ScraperRunOptions, 'mode' | 'startPage' | 'endPage' | 'toTimestamp' | 'keywords' | 'maxJobsPerSource'>,
  sinceTimestamp: string | undefined,
  runId: string,
  scrapePageFn: typeof scrapeTargetPortal = scrapeTargetPortal
): Promise<{
  rawResults: ScrapedJobResult[];
  sourcePagesAttempted: number;
  sourcePagesSuccessful: number;
  lastPageError: any;
  hitSafetyLimit: boolean;
  paginationDiagnostic?: string;
  maxSafetyPages: number;
}> {
  const rawResults: ScrapedJobResult[] = [];
  const MAX_SAFETY_PAGES = 25;
  const requestedJobLimit = Number(options.maxJobsPerSource);
  const maxJobsPerSource = Number.isSafeInteger(requestedJobLimit) && requestedJobLimit > 0
    ? Math.min(requestedJobLimit, 500)
    : undefined;
  const keywordList = (options.keywords || '')
    .split(',')
    .map(keyword => keyword.trim().toLowerCase())
    .filter(keyword => keyword.length >= 2);

  let startPage = 1;
  let maxAllowedPage = 1;
  let pageRangeTruncatedBySafetyCap = false;

  const isMultiPageMode =
    options.mode === 'complete' ||
    options.mode === 'custom_date' ||
    options.mode === 'keyword_drill';

  if (options.mode === 'page_range') {
    startPage = Math.max(1, options.startPage || 1);
    const requestedEndPage = Math.max(startPage, options.endPage || startPage);
    maxAllowedPage = Math.min(startPage + MAX_SAFETY_PAGES, requestedEndPage);
    pageRangeTruncatedBySafetyCap = requestedEndPage > maxAllowedPage;
  } else if (isMultiPageMode) {
    startPage = 1;
    maxAllowedPage = MAX_SAFETY_PAGES;
  }

  const effectiveKeywords =
    options.mode === 'keyword_drill'
      ? (options.keywords || target.keywords || '').trim() || undefined
      : undefined;
  const effectiveToTimestamp =
    options.mode === 'custom_date' ? options.toTimestamp : undefined;

  const portalBaseUrl = (target.url || target.portalUrl || target.pdfUrl || '').trim();
  const visitedPageUrls = new Set<string>();
  if (portalBaseUrl) {
    if (startPage > 1) {
      try {
        const startUrlObj = new URL(portalBaseUrl);
        startUrlObj.searchParams.set('page', String(startPage));
        visitedPageUrls.add(canonicalizePaginationUrl(startUrlObj.toString()));
      } catch {
        visitedPageUrls.add(canonicalizePaginationUrl(portalBaseUrl));
      }
    } else {
      visitedPageUrls.add(canonicalizePaginationUrl(portalBaseUrl));
    }
  }

  let currentPage = startPage;
  let currentTargetPageUrl: string | undefined = undefined;
  let hasMorePages = true;
  let lastPageError: any = null;
  let hitSafetyLimit = false;
  let paginationDiagnostic: string | undefined = undefined;
  let sourcePagesAttempted = 0;
  let sourcePagesSuccessful = 0;

  while (currentPage <= maxAllowedPage && hasMorePages) {
    sourcePagesAttempted++;

    try {
      const pageResults = await scrapePageFn(target, {
        page: currentPage,
        startPage,
        endPage: maxAllowedPage,
        sinceTimestamp,
        toTimestamp: effectiveToTimestamp,
        keywords: effectiveKeywords,
        runId,
        targetPageUrl: currentTargetPageUrl
      });

      sourcePagesSuccessful++;

      if (pageResults && pageResults.length > 0) {
        const keywordMatchedPageResults = keywordList.length > 0
          ? pageResults.filter(job => {
              const searchableText = [
                job.title,
                job.description,
                job.department,
                job.company,
                ...(Array.isArray(job.tags) ? job.tags : []),
                ...(Array.isArray(job.requirements) ? job.requirements : [])
              ].filter(Boolean).join(' ').toLowerCase();
              return keywordList.some(keyword => searchableText.includes(keyword));
            })
          : pageResults;
        const remainingJobSlots = maxJobsPerSource === undefined
          ? keywordMatchedPageResults.length
          : Math.max(0, maxJobsPerSource - rawResults.length);
        rawResults.push(...keywordMatchedPageResults.slice(0, remainingJobSlots));

        const discoveredNextUrl = pageResults.find(
          j => typeof j.nextPageUrl === 'string' && j.nextPageUrl.trim().length > 0
        )?.nextPageUrl?.trim();
        const jobLimitReached = maxJobsPerSource !== undefined && rawResults.length >= maxJobsPerSource;
        const mayHaveMorePages = options.mode === 'page_range'
          ? currentPage < maxAllowedPage
          : isMultiPageMode && (Boolean(discoveredNextUrl) || pageResults.length >= 10);

        if (jobLimitReached) {
          if (mayHaveMorePages) {
            paginationDiagnostic = `Configured per-portal job limit of ${maxJobsPerSource} reached; remaining pages were not scanned and the completion checkpoint was preserved.`;
            if (isMultiPageMode && currentPage >= maxAllowedPage) {
              hitSafetyLimit = true;
            }
          }
          hasMorePages = false;
        } else if (isMultiPageMode) {

          if (discoveredNextUrl) {
            const validation = validateDiscoveredNextPageUrl(discoveredNextUrl, portalBaseUrl, visitedPageUrls);
            if (!validation.valid) {
              paginationDiagnostic = validation.reason || 'Unsafe or repeated next-page URL rejected';
              console.warn(`[Scraper Engine] Pagination stopped safely for "${target.name}": ${paginationDiagnostic}`);
              hasMorePages = false;
            } else if (currentPage < maxAllowedPage) {
              if (validation.canonicalUrl) {
                visitedPageUrls.add(validation.canonicalUrl);
              }
              currentTargetPageUrl = validation.normalizedUrl;
              currentPage++;
            } else {
              hitSafetyLimit = true;
              hasMorePages = false;
            }
          } else if (pageResults.length >= 10) {
            if (currentPage < maxAllowedPage) {
              currentTargetPageUrl = undefined;
              const nextNumericPage = currentPage + 1;
              if (portalBaseUrl) {
                try {
                  const numUrl = new URL(portalBaseUrl);
                  numUrl.searchParams.set('page', String(nextNumericPage));
                  const numCanonical = canonicalizePaginationUrl(numUrl.toString());
                  if (visitedPageUrls.has(numCanonical)) {
                    paginationDiagnostic = `Pagination cycle detected on numeric page ${nextNumericPage}`;
                    console.warn(`[Scraper Engine] Pagination stopped safely for "${target.name}": ${paginationDiagnostic}`);
                    hasMorePages = false;
                    continue;
                  }
                  visitedPageUrls.add(numCanonical);
                } catch {}
              }
              currentPage = nextNumericPage;
            } else {
              hitSafetyLimit = true;
              hasMorePages = false;
            }
          } else {
            hasMorePages = false;
          }
        } else if (options.mode === 'page_range') {
          currentTargetPageUrl = undefined;
          if (currentPage >= maxAllowedPage && pageRangeTruncatedBySafetyCap) {
            hitSafetyLimit = true;
          }
          currentPage++;
        } else {
          hasMorePages = false;
        }
      } else {
        hasMorePages = false;
      }
    } catch (pageErr: any) {
      lastPageError = pageErr;
      console.log(`[Scraper Engine] Page ${currentPage} notice on source ${target.name}: ${pageErr?.message || pageErr}`);
      hasMorePages = false;
    }
  }

  return {
    rawResults,
    sourcePagesAttempted,
    sourcePagesSuccessful,
    lastPageError,
    hitSafetyLimit,
    paginationDiagnostic,
    maxSafetyPages: MAX_SAFETY_PAGES
  };
}

export function generateUniqueScrapedJobId(sourceId?: string, usedIds?: Set<string>): string {
  const safeSource = (sourceId || 'src').replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 32) || 'src';
  for (let attempt = 0; attempt < 25; attempt++) {
    const randPart =
      typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID().replace(/-/g, '').slice(0, 10)
        : `${Math.random().toString(36).substring(2, 8)}${Math.random().toString(36).substring(2, 6)}`;
    const candidate = `scraped-${safeSource}-${Date.now().toString(36)}-${randPart}`;
    if (!usedIds || !usedIds.has(candidate)) {
      return candidate;
    }
  }
  return `scraped-${safeSource}-${Date.now().toString(36)}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
}

/**
 * Ensures a scraped candidate job has a unique internal ID that does not collide with
 * any existing Live, Pending, or current-batch job record. Preserves all source identity fields
 * (sourceJobId, sourceUrl, originalApplyUrl, applicationUrl, scraperSourceId) untouched.
 */
export function resolveNonCollidingCandidateId(
  standardizedJob: any,
  duplicateCandidates: any[] = [],
  harvestedJobs: any[] = [],
  sourceId?: string
): { collided: boolean; previousId: string; resolvedId: string } {
  const usedIds = new Set<string>();
  for (const item of duplicateCandidates) {
    if (item && item.id) usedIds.add(String(item.id).trim());
  }
  for (const item of harvestedJobs) {
    if (item && item.id) usedIds.add(String(item.id).trim());
  }

  const currentId = standardizedJob?.id ? String(standardizedJob.id).trim() : '';
  const collided = !currentId || usedIds.has(currentId);

  if (collided) {
    const freshId = generateUniqueScrapedJobId(sourceId || standardizedJob?.scraperSourceId, usedIds);
    standardizedJob.id = freshId;
    if (standardizedJob.slug) {
      delete standardizedJob.slug;
    }
    console.warn(
      `[Scraper Engine] Internal job ID collision detected (${currentId || 'empty'}). Assigned fresh ID "${freshId}" while preserving source identity.`
    );
    return { collided: true, previousId: currentId, resolvedId: freshId };
  }

  return { collided: false, previousId: currentId, resolvedId: currentId };
}

/**
 * Executes atomic scraper persistence with bounded retry on duplicate-key / ID collisions.
 * Synchronizes any newly assigned ID/slug back onto standardizedJob (preserving source identity fields).
 * Never falls back to upsert; throws if retries are exhausted or a non-collision error occurs.
 */
async function persistScrapedCandidateWithRetry(
  standardizedJob: any,
  persistFn: (jobData: any) => Promise<any>,
  harvestedJobs: any[],
  sourceId?: string,
  maxRetries: number = MAX_SCRAPER_INSERT_RETRIES
): Promise<any> {
  const usedIds = new Set<string>();
  for (const item of harvestedJobs) {
    if (item && item.id) usedIds.add(String(item.id).trim());
  }

  let candidateToPersist = standardizedJob;
  let lastErr: any = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (candidateToPersist?.id) {
      usedIds.add(String(candidateToPersist.id).trim());
    }
    try {
      const saved = await persistFn(candidateToPersist);
      if (saved && typeof saved === 'object' && saved.id) {
        standardizedJob.id = saved.id;
        if (saved.slug) {
          standardizedJob.slug = saved.slug;
        }
      } else if (candidateToPersist?.id && candidateToPersist.id !== standardizedJob.id) {
        standardizedJob.id = candidateToPersist.id;
        if (candidateToPersist.slug) {
          standardizedJob.slug = candidateToPersist.slug;
        } else {
          delete standardizedJob.slug;
        }
      }
      return saved;
    } catch (err: any) {
      if (!isMongoDuplicateKeyError(err) || err?.collisionRetriesExhausted === true) {
        throw err;
      }
      lastErr = err;
      if (attempt < maxRetries) {
        const freshId = generateUniqueScrapedJobId(sourceId || standardizedJob?.scraperSourceId, usedIds);
        usedIds.add(freshId);
        candidateToPersist = {
          ...standardizedJob,
          id: freshId
        };
        if (candidateToPersist.slug) {
          delete candidateToPersist.slug;
        }
        continue;
      }
      throw new ScraperPersistenceCollisionError(
        `Scraper persistence failed after ${maxRetries + 1} attempts due to persistent ID collisions.`,
        {
          attempts: maxRetries + 1,
          attemptedIds: Array.from(usedIds),
          cause: lastErr
        }
      );
    }
  }

  throw lastErr;
}

/**
 * Authoritative Scraper Execution Engine with Multi-Source, Dynamic Pagination,
 * Cutoffs, and Centralized Duplication Control.
 * STRICT ZERO-FAKE-JOB POLICY: Never fabricates or synthesizes jobs.
 */
export async function executeScraperWithWizard(
  options: ScraperRunOptions,
  _deps?: ScraperEngineRuntimeDeps
): Promise<ScraperRunSummary> {
  if (isScraperExecutionLocked || activeRunState.isActive) {
    throw new ScraperRunConflictError(
      `Another scraper execution is already in progress${activeRunState.runId ? ` (${activeRunState.runId})` : ''}.`,
      getActiveRunStatus()
    );
  }
  isScraperExecutionLocked = true;

  const getConfigsFn = _deps?.getConfigsFn || (() => ScraperRepository.getConfigs());
  const updateSourceStatsFn = _deps?.updateSourceStatsFn || ((id: string, stats: any) => ScraperRepository.updateSourceStats(id, stats));
  const addRunFn = _deps?.addRunFn || ((run: any) => ScraperRepository.addRun(run));
  const scrapePageFn = _deps?.scrapePageFn || scrapeTargetPortal;
  const enrichJobsFn = _deps?.enrichJobsFn || enrichScrapedJobsBatch;
  const findDuplicateCandidatesFn =
    _deps?.findDuplicateCandidatesFn || ((job: any) => JobRepository.findDuplicateCandidates(job));
  const createJobFn = _deps?.createJobFn || ((job: any) => JobRepository.createScrapedLive(job));
  const addPendingJobFn = _deps?.addPendingJobFn || ((job: any) => JobRepository.addScrapedPending(job));
  const auditAddFn = _deps?.auditAddFn || ((entry: any) => AuditRepository.add(entry));

  const startTime = new Date();
  const timestampStr = startTime.toISOString().replace('T', ' ').substring(0, 19);
  const runId = `RUN-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

  try {
    const allSources = await getConfigsFn();
    let targets: ScraperTargetConfig[] = [];

    // Filter sources based on requested options
    if (options.sourceIds !== undefined) {
      if (options.sourceIds.length === 0) {
        // User or caller explicitly provided an empty selection - abort without action
        console.log('[Scraper Engine] Empty source selection provided. Run aborted.');
        return createEmptySummary(runId, startTime, 'No scraper sources selected. Scraper run was not executed.');
      }
      targets = allSources.filter(s => options.sourceIds!.includes(s.id));
    } else if (options.sourceId) {
      targets = allSources.filter(s => s.id === options.sourceId);
    } else {
      // Run All Enabled: skip Disabled, Invalid/404, permanently blocked sources
      // Failed sources (Timeout, HTML, Fetch Error, No Jobs) remain available through Retry
      targets = allSources.filter(s => {
        if (s.status === 'Disabled' || s.status === 'Paused') return false;
        const isActive = s.status === 'Active Scheduled' || s.status === 'Active';
        if (!isActive) return false;

        // Skip Invalid / 404
        const h = s.healthStatus || '';
        const errMsg = (s.lastErrorMessage || '').toLowerCase();
        if (h === '404' || h === 'Invalid PDF' || errMsg.includes('404') || errMsg.includes('invalid pdf')) return false;

        // Skip permanently blocked sources (403, permanently blocked)
        if (h === '403' || errMsg.includes('permanently blocked') || errMsg.includes('access denied')) return false;

        return true;
      });
    }

    // If no matching sources exist, return early. NEVER automatically default to first 5 sources!
    if (targets.length === 0) {
      console.log('[Scraper Engine] No active or matching scraper sources found to execute.');
      return createEmptySummary(runId, startTime, 'No active or matching scraper sources found to execute.');
    }

    // Initialize active-run live state
    shouldStopActiveRun = false;
    if (pauseResolver) {
      pauseResolver();
      pauseResolver = null;
      pausePromise = null;
    }

    const duplicateMode: 'with' | 'without' = options.duplicateMode === 'without' ? 'without' : 'with';

    activeRunState = {
      isActive: true,
      isPaused: false,
      stopped: false,
      runId,
      mode: options.mode,
      duplicateMode,
      totalSources: targets.length,
      completedSources: 0,
      remainingSources: targets.length,
      totalFound: 0,
      totalNew: 0,
      totalDuplicates: 0,
      totalPending: 0,
      totalPublished: 0,
      totalFailedSources: 0,
      runProgress: 0,
      startTime: startTime.toISOString(),
      lastUpdated: startTime.toISOString()
    };

    const harvestedJobs: any[] = [];
    const duplicateJobs: any[] = [];
    const uniqueJobs: any[] = [];
    const publishedJobs: any[] = [];
    const pendingJobs: any[] = [];
    const failedToSaveErrors: Array<{ title: string; error: string; isDuplicate: boolean }> = [];
    let failedCount = 0;
    let totalPagesAttempted = 0;
    let totalPagesSuccessful = 0;
    let totalJobsRejected = 0;
    let wasStopped = false;

    const sourcesStats: ScraperRunSummary['sourcesStats'] = [];

    for (let targetIdx = 0; targetIdx < targets.length; targetIdx++) {
      if (shouldStopActiveRun) {
        wasStopped = true;
        console.log(`[Scraper Engine] Active scraper run ${runId} stopped by user request.`);
        break;
      }

      if (activeRunState.isPaused && pausePromise) {
        console.log(`[Scraper Engine] Active scraper run ${runId} paused. Awaiting resume...`);
        await pausePromise;
        if (shouldStopActiveRun) {
          wasStopped = true;
          console.log(`[Scraper Engine] Active scraper run ${runId} stopped while paused.`);
          break;
        }
      }

      const target = targets[targetIdx];
      activeRunState.currentSource = {
        id: target.id,
        name: target.name,
        url: target.url || '',
        index: targetIdx + 1
      };
      activeRunState.completedSources = sourcesStats.length;
      activeRunState.remainingSources = targets.length - sourcesStats.length;
      activeRunState.runProgress = Math.round((sourcesStats.length / targets.length) * 100);
      activeRunState.lastUpdated = new Date().toISOString();

      const effectiveUrl = target.url || (target as any).portalUrl || (target as any).pdfUrl || '';
      target.url = effectiveUrl;
      const sourceRunStart = new Date().toISOString();

      let sourceFound = 0;
      let sourceValid = 0;
      let sourceNew = 0;
      let sourceDup = 0;
      let sourceRejected = 0;
      let sourcePersisted = 0;
      let sourceSaveFailures = 0;
      let sourceUniqueSaveFailures = 0;
      let sourceDupSaveFailures = 0;
      let sourceIntentionalSkips = 0;
      let sourcePagesAttempted = 0;
      let sourcePagesSuccessful = 0;
      let sourceFailed = false;
      let sourceError = '';
      const sourcePersistedMethods = new Set<string>();

      try {
        try {
          await updateSourceStatsFn(target.id, {
            lastStartedAt: sourceRunStart,
            lastRunId: runId
          });
        } catch (startStatErr: any) {
          console.warn(`[Scraper Engine] Notice recording start timestamp for "${target.name}":`, startStatErr?.message || startStatErr);
        }

        // 1. Determine cutoff date
        let sinceTimestamp = options.sinceTimestamp;
        if (options.mode === 'since_last') {
          sinceTimestamp = target.lastSuccessfulScrapeAt || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        } else if (options.mode === 'custom_date') {
          sinceTimestamp = options.fromTimestamp;
        }

        // 2. Dynamic next-page crawl loop (follows validated discovered nextPageUrl or numeric fallback)
        const crawlResult = await crawlPortalPages(target, options, sinceTimestamp, runId, scrapePageFn);
        const {
          rawResults,
          lastPageError,
          hitSafetyLimit,
          paginationDiagnostic,
          maxSafetyPages: MAX_SAFETY_PAGES
        } = crawlResult;
        sourcePagesAttempted = crawlResult.sourcePagesAttempted;
        sourcePagesSuccessful = crawlResult.sourcePagesSuccessful;
        totalPagesAttempted += sourcePagesAttempted;
        totalPagesSuccessful += sourcePagesSuccessful;

        // If all page attempts failed, surface the root error for proper health categorization
        if (sourcePagesSuccessful === 0 && lastPageError) {
          throw lastPageError;
        }

        // Custom date upper cutoff (toTimestamp) filter
        let filteredResults = rawResults;
        if (options.mode === 'custom_date' && options.toTimestamp) {
          const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(options.toTimestamp.trim());
          const parsedTo = new Date(options.toTimestamp).getTime();
          const toTime = !isNaN(parsedTo) ? (isDateOnly ? parsedTo + 24 * 60 * 60 * 1000 - 1 : parsedTo) : NaN;
          if (!isNaN(toTime)) {
            filteredResults = filteredResults.filter(j => {
              if (!j.datePosted) return true;
              const postTime = new Date(j.datePosted).getTime();
              return isNaN(postTime) || postTime <= toTime;
            });
          }
        }

        sourceFound = filteredResults.length;

        // Detail page enrichment: fetch linked detail pages to obtain complete job descriptions,
        // specific employers, grades, deadlines, and requirements before duplicate evaluation.
        const enrichedResults = await enrichJobsFn(filteredResults, target);

        for (const raw of enrichedResults) {
          // Factual integrity: Never invent missing information
          const standardizedSalary = (raw.salary && raw.salary.trim() && raw.salary.toLowerCase() !== 'negotiable')
            ? raw.salary
            : 'Salary not disclosed';

          // Assess extraction quality
          const isQualityAcceptable = !!(raw.title && raw.title.trim().length >= 3 && raw.company && raw.company.trim().length >= 2);
          if (!isQualityAcceptable) {
            sourceRejected++;
            totalJobsRejected++;
            continue; // Reject low quality / invalid vacancies
          }

          const domain = target.url ? new URL(target.url.startsWith('http') ? target.url : 'https://' + target.url).hostname : 'target-portal.com';

          const standardizedJob: any = {
            ...raw,
            id: raw.id || `scraped-${target.id}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
            salary: standardizedSalary,
            scraperSourceId: target.id,
            scraperSourceName: target.name,
            scrapedSourceDomain: domain,
            sourceUrl: raw.sourceUrl || target.url,
            originalApplyUrl: raw.originalApplyUrl || undefined,
            sourceJobId: raw.sourceJobId || undefined,
            scrapedAt: timestampStr,
            scrapedTime: startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }),
            extractionMethod: raw.extractionMethod || 'html_cheerio',
            scrapeRunId: runId,
            jobCategory: (target as any).category || 'General',
            region: raw.region || (target as any).region || 'Pakistan',
            isGovtJob: (target as any).category === 'Government Sector' || (target as any).isGovtPortal || raw.isGovtJob,
            isNewspaperAd: (target as any).category === 'Newspaper Classified',
            newspaperName: (target as any).category === 'Newspaper Classified' ? target.name : undefined,
            status: (target.autoApprove && options.autoPublishTrusted) ? 'Approved' : 'Pending'
          };

          // Multi-signal targeted duplicate candidates lookup across Live + Pending MongoDB (FAIL-CLOSED)
          let duplicateCandidates: any[];
          try {
            duplicateCandidates = await findDuplicateCandidatesFn(standardizedJob);
          } catch (candErr: any) {
            const lookupErr: any = new Error(
              `Duplicate verification failed during database lookup for "${standardizedJob.title}": ${candErr?.message || candErr}`
            );
            lookupErr.name = candErr?.name || 'MongoDuplicateLookupError';
            lookupErr.isDatabaseError = true;
            lookupErr.cause = candErr;
            throw lookupErr;
          }

          // Reassign a fresh unique internal ID if standardizedJob.id collides with any Live/Pending/batch record
          resolveNonCollidingCandidateId(standardizedJob, duplicateCandidates, harvestedJobs, target.id);

          // Multi-signal deduplication check against Live/Pending candidates + intra-batch harvestedJobs
          const dupCheck: DuplicateMatchResult = detectJobDuplicate(
            standardizedJob,
            duplicateCandidates,
            harvestedJobs
          );

          standardizedJob.isDuplicate = dupCheck.isDuplicate;
          standardizedJob.duplicateScore = dupCheck.confidence;
          standardizedJob.duplicateCategory = dupCheck.duplicateCategory;
          standardizedJob.duplicateTags = dupCheck.duplicateTags;
          standardizedJob.duplicateMatchReason = dupCheck.reason;
          standardizedJob.duplicateOfJobId = dupCheck.matchedExistingJob?.id;
          standardizedJob.duplicateMatchedJob = dupCheck.matchedExistingJob;

          harvestedJobs.push(standardizedJob);
          activeRunState.totalFound++;
          sourceValid++;

          if (dupCheck.isDuplicate) {
            sourceDup++;
            duplicateJobs.push(standardizedJob);
            activeRunState.totalDuplicates++;

            if (duplicateMode === 'without') {
              // "Without Duplicates" mode:
              // Do not create a NEW pending vacancy from this duplicate.
              // Do not publish it, and do not modify or delete the original job.
              // Duplicate counter is incremented, intentional skip recorded, continue processing next candidate.
              sourceIntentionalSkips++;
              continue;
            }

            // Duplicates are NEVER published live. Saved to pending queue with duplicate flags
            try {
              await persistScrapedCandidateWithRetry(standardizedJob, addPendingJobFn, harvestedJobs, target.id);
              pendingJobs.push(standardizedJob);
              activeRunState.totalPending++;
              sourcePersisted++;
              if (standardizedJob.extractionMethod) {
                sourcePersistedMethods.add(String(standardizedJob.extractionMethod).trim());
              }
            } catch (pErr: any) {
              console.error(`[Scraper Engine] Failed saving duplicate pending job (${standardizedJob.title}):`, pErr?.message || pErr);
              sourceSaveFailures++;
              sourceDupSaveFailures++;
              failedToSaveErrors.push({
                title: standardizedJob.title,
                error: pErr?.message || String(pErr),
                isDuplicate: true
              });
            }
          } else {
            if (standardizedJob.status === 'Approved') {
              try {
                await persistScrapedCandidateWithRetry(standardizedJob, createJobFn, harvestedJobs, target.id);
                publishedJobs.push(standardizedJob);
                activeRunState.totalPublished++;
                sourceNew++;
                uniqueJobs.push(standardizedJob);
                activeRunState.totalNew++;
                sourcePersisted++;
                if (standardizedJob.extractionMethod) {
                  sourcePersistedMethods.add(String(standardizedJob.extractionMethod).trim());
                }
              } catch (cErr: any) {
                console.error(`[Scraper Engine] Failed saving approved job (${standardizedJob.title}):`, cErr?.message || cErr);
                sourceSaveFailures++;
                sourceUniqueSaveFailures++;
                failedToSaveErrors.push({
                  title: standardizedJob.title,
                  error: cErr?.message || String(cErr),
                  isDuplicate: false
                });
              }
            } else {
              try {
                await persistScrapedCandidateWithRetry(standardizedJob, addPendingJobFn, harvestedJobs, target.id);
                pendingJobs.push(standardizedJob);
                activeRunState.totalPending++;
                sourceNew++;
                uniqueJobs.push(standardizedJob);
                activeRunState.totalNew++;
                sourcePersisted++;
                if (standardizedJob.extractionMethod) {
                  sourcePersistedMethods.add(String(standardizedJob.extractionMethod).trim());
                }
              } catch (pErr: any) {
                console.error(`[Scraper Engine] Failed saving pending job (${standardizedJob.title}):`, pErr?.message || pErr);
                sourceSaveFailures++;
                sourceUniqueSaveFailures++;
                failedToSaveErrors.push({
                  title: standardizedJob.title,
                  error: pErr?.message || String(pErr),
                  isDuplicate: false
                });
              }
            }
          }
        }

        // Accurate source success & checkpoint accounting:
        const hasValidDetections = sourceValid > 0;
        const hasSuccessfulHandledVacancies = (sourcePersisted + sourceIntentionalSkips) > 0;
        const isAllPersistAttemptsFailed = hasValidDetections && !hasSuccessfulHandledVacancies && sourceSaveFailures > 0;
        const isDetectionSuccessful = hasValidDetections && hasSuccessfulHandledVacancies;

        const isCompleteMode = options.mode === 'complete';
        const hasNoPageErrors = !lastPageError && (sourcePagesAttempted === sourcePagesSuccessful);
        const hasUnsavedUniqueVacancies = sourceUniqueSaveFailures > 0;
        const hasUnsavedRequiredDuplicates = duplicateMode === 'with' && sourceDupSaveFailures > 0;
        const hasUnsavedRequiredVacancies = hasUnsavedUniqueVacancies || hasUnsavedRequiredDuplicates;
        const isCheckpointEligible = evaluateCheckpointEligibility({
          mode: options.mode,
          hasNoPageErrors,
          hitSafetyLimit,
          paginationDiagnostic,
          isDetectionSuccessful,
          hasUnsavedRequiredVacancies
        });

        const sourceCompletedAt = new Date().toISOString();
        const completion = buildSourceCompletionStatsUpdate({
          sourceCompletedAt,
          previousLastSuccessfulScrapeAt: target.lastSuccessfulScrapeAt,
          runId,
          isCheckpointEligible,
          isDetectionSuccessful,
          isAllPersistAttemptsFailed,
          hasUnsavedRequiredVacancies,
          sourceSaveFailures,
          sourceUniqueSaveFailures,
          sourceDupSaveFailures,
          sourcePagesAttempted,
          lastPageError,
          paginationDiagnostic,
          hitSafetyLimit,
          maxSafetyPages: MAX_SAFETY_PAGES,
          isCompleteMode,
          sourceValid,
          sourceFound,
          sourcePersisted,
          sourceIntentionalSkips,
          provenExtractionMethodsToAdd: Array.from(sourcePersistedMethods)
        });

        const lastErrorNotice = completion.lastErrorNotice;

        if (isAllPersistAttemptsFailed && completion.sourceError) {
          sourceFailed = true;
          failedCount++;
          activeRunState.totalFailedSources++;
          sourceError = completion.sourceError;
          activeRunState.currentError = sourceError;
        }

        await updateSourceStatsFn(target.id, completion.statsUpdate);

        sourcesStats.push({
          sourceId: target.id,
          sourceName: target.name,
          sourceUrl: target.url,
          startedAt: sourceRunStart,
          completedAt: sourceCompletedAt,
          found: sourceValid,
          rawCandidateCount: sourceFound,
          newCount: sourceNew,
          dupCount: sourceDup,
          persistedCount: sourcePersisted,
          failedToSaveCount: sourceSaveFailures,
          rejectedCount: sourceRejected,
          pagesAttempted: sourcePagesAttempted,
          pagesSuccessful: sourcePagesSuccessful,
          failed: sourceFailed,
          failureCategory: sourceSaveFailures > 0
            ? 'Database Save Failed'
            : duplicateMode === 'without' && sourceValid > 0 && sourceNew === 0 && sourceDup > 0
              ? 'Duplicate Skipped'
              : sourceValid === 0 && sourceRejected > 0
                ? 'Incomplete Extraction'
                : sourceValid === 0
                  ? 'No Jobs Found'
                  : undefined,
          error: sourceError || lastErrorNotice,
          lastSuccessfulScrapeAt: isCheckpointEligible ? sourceCompletedAt : target.lastSuccessfulScrapeAt
        });
      } catch (err: any) {
        failedCount++;
        sourceFailed = true;
        sourceError = err.message || 'Scraping target failed';
        activeRunState.totalFailedSources++;
        activeRunState.currentError = sourceError;
        console.log(`[Scraper Engine] Source notice on ${target.name} (${target.url}): ${err?.message || err}`);

        const errLower = sourceError.toLowerCase();
        let classifiedHealth: string = 'Fetch Error';
        let httpStatus: number | undefined = err.status || err.statusCode || err.httpStatus;

        const isDbError =
          err?.isDatabaseError === true ||
          err?.name === 'MongoNetworkTimeoutError' ||
          err?.name === 'MongoConnectionUnavailableError' ||
          err?.name?.includes('Mongo') ||
          errLower.includes('mongodb') ||
          errLower.includes('mongo') ||
          errLower.includes('duplicate verification') ||
          errLower.includes('duplicate candidate') ||
          errLower.includes('topology was destroyed');

        if (isDbError) {
          classifiedHealth = 'Database Error';
        } else if (httpStatus === 404 || errLower.includes('404') || errLower.includes('not found')) {
          classifiedHealth = '404';
          if (!httpStatus) httpStatus = 404;
        } else if (httpStatus === 403 || errLower.includes('403') || errLower.includes('forbidden') || errLower.includes('access denied')) {
          classifiedHealth = '403';
          if (!httpStatus) httpStatus = 403;
        } else if (errLower.includes('timeout') || errLower.includes('timed out') || errLower.includes('etimedout') || errLower.includes('aborterror')) {
          classifiedHealth = 'Timeout';
        } else if (errLower.includes('html instead of pdf') || errLower.includes('non-pdf') || errLower.includes('cheerio') || errLower.includes('html parse') || errLower.includes('invalid html') || errLower.includes('selector')) {
          classifiedHealth = 'HTML';
        } else if (errLower.includes('invalid pdf') || errLower.includes('pdf error') || errLower.includes('corrupt pdf') || (errLower.includes('pdf') && errLower.includes('fail'))) {
          classifiedHealth = 'Invalid PDF';
        } else {
          classifiedHealth = 'Fetch Error';
        }

        const sourceCompletedAt = new Date().toISOString();
        try {
          await updateSourceStatsFn(target.id, {
            lastCompletedAt: sourceCompletedAt,
            healthStatus: classifiedHealth,
            lastErrorMessage: sourceError,
            lastHttpStatus: httpStatus
          });
        } catch (saveErr: any) {
          console.warn(`[Scraper Engine] Notice saving failure stats for "${target.name}":`, saveErr?.message || saveErr);
        }

        sourcesStats.push({
          sourceId: target.id,
          sourceName: target.name,
          sourceUrl: target.url,
          startedAt: sourceRunStart,
          completedAt: sourceCompletedAt,
          found: sourceValid,
          rawCandidateCount: sourceFound,
          newCount: sourceNew,
          dupCount: sourceDup,
          persistedCount: sourcePersisted,
          failedToSaveCount: sourceSaveFailures,
          rejectedCount: sourceRejected,
          pagesAttempted: sourcePagesAttempted,
          pagesSuccessful: sourcePagesSuccessful,
          failed: true,
          failureCategory: isDbError
            ? 'Database Error'
            : ['404', '403', 'Timeout', 'Fetch Error'].includes(classifiedHealth)
              ? 'Website Unavailable'
              : classifiedHealth === 'Invalid PDF'
                ? 'Document Failed'
                : classifiedHealth === 'HTML'
                  ? 'Extraction Failed'
                  : 'Extraction Failed',
          error: sourceError,
          lastSuccessfulScrapeAt: target.lastSuccessfulScrapeAt
        });
      }
    }

    if (shouldStopActiveRun) {
      wasStopped = true;
    }

    const processedSourcesCount = sourcesStats.length;
    const derivedRunStatus: 'Completed' | 'Partial' | 'Failed' | 'Stopped' = wasStopped
      ? 'Stopped'
      : failedCount === 0
      ? 'Completed'
      : failedCount < targets.length
      ? 'Partial'
      : 'Failed';

    // Update final active run state accurately (do not mark unscraped sources complete or force 100% if stopped)
    activeRunState.isActive = false;
    activeRunState.isPaused = false;
    activeRunState.stopped = wasStopped;
    activeRunState.currentSource = undefined;
    if (wasStopped) {
      activeRunState.completedSources = processedSourcesCount;
      activeRunState.remainingSources = Math.max(0, targets.length - processedSourcesCount);
      activeRunState.runProgress = targets.length > 0 ? Math.round((processedSourcesCount / targets.length) * 100) : 0;
    } else {
      activeRunState.completedSources = targets.length;
      activeRunState.remainingSources = 0;
      activeRunState.runProgress = 100;
    }
    activeRunState.lastUpdated = new Date().toISOString();

    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();

    // Save audit log for the scraper execution run and surface history persistence status
    let runRecordResult: any = null;
    let historyPersistenceThrownError: string | undefined;
    try {
      runRecordResult = await addRunFn({
        id: runId,
        batchId: options.batchId || runId,
        startedAt: startTime.toISOString(),
        completedAt: endTime.toISOString(),
        mode: options.mode,
        duplicateMode,
        targetsScraped: processedSourcesCount,
        totalTargetsPlanned: targets.length,
        stopped: wasStopped,
        status: derivedRunStatus,
        totalFound: harvestedJobs.length,
        totalNew: uniqueJobs.length,
        totalDuplicates: duplicateJobs.length,
        totalFailedToSave: failedToSaveErrors.length,
        jobsAccepted: uniqueJobs.length,
        jobsRejected: totalJobsRejected,
        newPublished: publishedJobs.length,
        newPending: pendingJobs.length,
        duplicatesFlagged: duplicateJobs.length,
        failedSources: failedCount,
        executionTimeMs: duration,
        sourcesStats
      });
    } catch (addRunErr: any) {
      historyPersistenceThrownError = addRunErr?.message || String(addRunErr);
      console.error(`[Scraper Engine] Error persisting scraper run history "${runId}":`, historyPersistenceThrownError);
    }

    const historyPersistedToMongo = Boolean(runRecordResult?.isPersistedToMongo);
    const historyPersistenceError: string | undefined =
      historyPersistenceThrownError ||
      (typeof runRecordResult?.persistenceError === 'string' && runRecordResult.persistenceError.trim()
        ? runRecordResult.persistenceError.trim()
        : undefined);
    const historyPersistenceMode: 'mongodb' | 'memory' | 'failed' = historyPersistedToMongo
      ? 'mongodb'
      : historyPersistenceError
      ? 'failed'
      : 'memory';

    auditAddFn({
      user: 'Administrator',
      role: 'Scraper Hub',
      action: wasStopped ? 'Scraper Run Stopped' : 'Scraper Run Completed',
      target: `${processedSourcesCount}/${targets.length} Source Portals (${harvestedJobs.length} Jobs Harvested)`,
      status: (wasStopped || failedCount > 0 || failedToSaveErrors.length > 0 || historyPersistenceMode === 'failed') ? 'Warning' : 'Success',
      metadata: {
        mode: options.mode,
        duplicateMode,
        stopped: wasStopped,
        runStatus: derivedRunStatus,
        targetsScraped: processedSourcesCount,
        totalTargetsPlanned: targets.length,
        totalFound: harvestedJobs.length,
        published: publishedJobs.length,
        pending: pendingJobs.length,
        duplicates: duplicateJobs.length,
        failedSources: failedCount,
        historyPersistedToMongo,
        historyPersistenceMode,
        historyPersistenceError
      }
    });

    const baseMessage = wasStopped
      ? `Scrape run stopped early after ${processedSourcesCount} of ${targets.length} sources. Extracted ${harvestedJobs.length} verified vacancies.`
      : `Scrape run completed across ${targets.length} sources. Extracted ${harvestedJobs.length} verified vacancies.`;
    const summaryMessage = historyPersistenceMode === 'failed'
      ? `${baseMessage} Warning: Run history was not saved to MongoDB (${historyPersistenceError || 'database write failed'}).`
      : baseMessage;

    return {
      runId,
      duplicateMode,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      stopped: wasStopped,
      status: derivedRunStatus,
      targetsScraped: processedSourcesCount,
      historyPersistedToMongo,
      historyPersistenceMode,
      historyPersistenceError,
      totalFound: harvestedJobs.length,
      totalNew: uniqueJobs.length,
      totalDuplicates: duplicateJobs.length,
      totalPending: pendingJobs.length,
      totalPublished: publishedJobs.length,
      totalFailedSources: failedCount,
      totalFailedToSave: failedToSaveErrors.length,
      failedToSaveErrors: failedToSaveErrors.length > 0 ? failedToSaveErrors : undefined,
      pagesAttempted: totalPagesAttempted,
      pagesSuccessful: totalPagesSuccessful,
      jobsAccepted: uniqueJobs.length,
      jobsRejected: totalJobsRejected,
      publishedJobs,
      pendingJobs,
      duplicateJobs,
      sourcesStats,
      executionDurationMs: duration,
      message: summaryMessage
    };
  } finally {
    isScraperExecutionLocked = false;
    activeRunState.isActive = false;
    activeRunState.isPaused = false;
    shouldStopActiveRun = false;
    if (pauseResolver) {
      pauseResolver();
      pauseResolver = null;
      pausePromise = null;
    }
  }
}
