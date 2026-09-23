import { ScraperRepository, isTransientMongoError } from '../db/repositories/ScraperRepository';
import { JobRepository } from '../db/repositories/JobRepository';
import { AuditRepository } from '../db/repositories/AuditRepository';
import { scrapeTargetPortal, ScrapedJobResult, ScraperTargetConfig } from '../../src/services/scraperService';
import { detectJobDuplicate, DuplicateMatchResult } from './duplicateEngine';

export interface ScraperRunOptions {
  mode: 'complete' | 'since_last' | 'page_range' | 'custom_date' | 'keyword_drill';
  sourceId?: string;
  sourceIds?: string[];
  startPage?: number;
  endPage?: number;
  sinceTimestamp?: string;
  fromTimestamp?: string;
  toTimestamp?: string;
  autoPublishTrusted?: boolean;
}

export interface ActiveRunStatus {
  isActive: boolean;
  isPaused: boolean;
  runId?: string;
  mode?: string;
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

let shouldStopActiveRun = false;
let pauseResolver: (() => void) | null = null;
let pausePromise: Promise<void> | null = null;

export function getActiveRunStatus(): ActiveRunStatus {
  return { ...activeRunState };
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
  shouldStopActiveRun = false;
  if (pauseResolver) {
    pauseResolver();
    pauseResolver = null;
    pausePromise = null;
  }
  activeRunState = {
    isActive: false,
    isPaused: false,
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
  startTime: string;
  endTime: string;
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
    newCount: number;
    dupCount: number;
    pagesAttempted: number;
    pagesSuccessful: number;
    failed: boolean;
    error?: string;
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

/**
 * Authoritative Scraper Execution Engine with Multi-Source, Dynamic Pagination,
 * Cutoffs, and Centralized Duplication Control.
 * STRICT ZERO-FAKE-JOB POLICY: Never fabricates or synthesizes jobs.
 */
export async function executeScraperWithWizard(options: ScraperRunOptions): Promise<ScraperRunSummary> {
  const startTime = new Date();
  const timestampStr = startTime.toISOString().replace('T', ' ').substring(0, 19);
  const runId = `RUN-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

  const allSources = await ScraperRepository.getConfigs();
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

  activeRunState = {
    isActive: true,
    isPaused: false,
    runId,
    mode: options.mode,
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

  let existingLiveJobs: any[] = [];
  let existingPendingJobs: any[] = [];
  try {
    const liveRes = await JobRepository.getAll({ limit: 1000 });
    existingLiveJobs = liveRes.jobs || [];
  } catch (e: any) {
    console.warn('[Scraper Engine] Notice loading live jobs for deduplication:', e.message);
  }

  try {
    existingPendingJobs = await JobRepository.getPending({ lightweight: true, limit: 1000 });
  } catch (e: any) {
    console.warn('[Scraper Engine] Notice loading pending jobs for deduplication:', e.message);
  }

  const combinedExisting = [...existingLiveJobs, ...existingPendingJobs];

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

  const sourcesStats: ScraperRunSummary['sourcesStats'] = [];

  for (let targetIdx = 0; targetIdx < targets.length; targetIdx++) {
    if (shouldStopActiveRun) {
      console.log(`[Scraper Engine] Active scraper run ${runId} stopped by user request.`);
      break;
    }

    if (activeRunState.isPaused && pausePromise) {
      console.log(`[Scraper Engine] Active scraper run ${runId} paused. Awaiting resume...`);
      await pausePromise;
      if (shouldStopActiveRun) break;
    }

    const target = targets[targetIdx];
    activeRunState.currentSource = {
      id: target.id,
      name: target.name,
      url: target.url || '',
      index: targetIdx + 1
    };
    activeRunState.completedSources = targetIdx;
    activeRunState.remainingSources = targets.length - targetIdx;
    activeRunState.runProgress = Math.round((targetIdx / targets.length) * 100);
    activeRunState.lastUpdated = new Date().toISOString();

    const effectiveUrl = target.url || (target as any).portalUrl || (target as any).pdfUrl || '';
    target.url = effectiveUrl;
    const sourceRunStart = new Date().toISOString();

    let sourceFound = 0;
    let sourceNew = 0;
    let sourceDup = 0;
    let sourcePagesAttempted = 0;
    let sourcePagesSuccessful = 0;
    let sourceFailed = false;
    let sourceError = '';

    try {
      try {
        await ScraperRepository.updateSourceStats(target.id, {
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

      // 2. Dynamic next-page crawl loop (No fixed 5-page ceiling!)
      const rawResults: ScrapedJobResult[] = [];
      const MAX_SAFETY_PAGES = 25;

      let startPage = 1;
      let maxAllowedPage = 1;

      if (options.mode === 'page_range') {
        startPage = Math.max(1, options.startPage || 1);
        maxAllowedPage = Math.max(startPage, Math.min(startPage + MAX_SAFETY_PAGES, options.endPage || startPage));
      } else if (options.mode === 'complete') {
        startPage = 1;
        maxAllowedPage = MAX_SAFETY_PAGES; // Crawl until next-page exhaustion or max safety limit
      }

      let currentPage = startPage;
      let hasMorePages = true;
      let lastPageError: any = null;

      while (currentPage <= maxAllowedPage && hasMorePages) {
        sourcePagesAttempted++;
        totalPagesAttempted++;

        try {
          const pageResults = await scrapeTargetPortal(target, {
            page: currentPage,
            startPage,
            endPage: maxAllowedPage,
            sinceTimestamp,
            runId
          });

          sourcePagesSuccessful++;
          totalPagesSuccessful++;

          if (pageResults && pageResults.length > 0) {
            rawResults.push(...pageResults);

            // Check if there is next page discovery
            const nextPageDetected = pageResults.some(j => !!j.nextPageUrl);
            if (options.mode === 'complete') {
              // If page returned jobs and next-page was detected, advance
              if (nextPageDetected && currentPage < maxAllowedPage) {
                currentPage++;
              } else if (pageResults.length >= 10 && currentPage < maxAllowedPage) {
                // Heuristic: full page likely has next page
                currentPage++;
              } else {
                hasMorePages = false;
              }
            } else if (options.mode === 'page_range') {
              currentPage++;
            } else {
              hasMorePages = false;
            }
          } else {
            // 0 jobs on this page means reached the end
            hasMorePages = false;
          }
        } catch (pageErr: any) {
          lastPageError = pageErr;
          console.log(`[Scraper Engine] Page ${currentPage} notice on source ${target.name}: ${pageErr?.message || pageErr}`);
          hasMorePages = false;
        }
      }

      // If all page attempts failed, surface the root error for proper health categorization
      if (sourcePagesSuccessful === 0 && lastPageError) {
        throw lastPageError;
      }

      // Custom date upper cutoff (toTimestamp) filter
      let filteredResults = rawResults;
      if (options.mode === 'custom_date' && options.toTimestamp) {
        const toTime = new Date(options.toTimestamp).getTime();
        if (!isNaN(toTime)) {
          filteredResults = filteredResults.filter(j => {
            if (!j.datePosted) return true;
            const postTime = new Date(j.datePosted).getTime();
            return isNaN(postTime) || postTime <= toTime;
          });
        }
      }

      sourceFound = filteredResults.length;

      for (const raw of filteredResults) {
        // Factual integrity: Never invent missing information
        const standardizedSalary = (raw.salary && raw.salary.trim() && raw.salary.toLowerCase() !== 'negotiable')
          ? raw.salary
          : 'Salary not disclosed';

        // Assess extraction quality
        const isQualityAcceptable = !!(raw.title && raw.title.trim().length >= 3 && raw.company && raw.company.trim().length >= 2);
        if (!isQualityAcceptable) {
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
          sourcePortal: target.name,
          sourceUrl: raw.sourceUrl || target.url,
          originalApplyUrl: raw.originalApplyUrl || raw.sourceUrl || target.url,
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

        // Multi-signal deduplication check
        const dupCheck: DuplicateMatchResult = detectJobDuplicate(
          standardizedJob,
          combinedExisting,
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

        if (dupCheck.isDuplicate) {
          sourceDup++;
          duplicateJobs.push(standardizedJob);
          activeRunState.totalDuplicates++;

          // Duplicates are NEVER published live. Saved to pending queue with duplicate flags
          try {
            await JobRepository.addPending(standardizedJob);
            pendingJobs.push(standardizedJob);
            activeRunState.totalPending++;
          } catch (pErr: any) {
            console.error(`[Scraper Engine] Failed saving duplicate pending job (${standardizedJob.title}):`, pErr?.message || pErr);
            failedToSaveErrors.push({
              title: standardizedJob.title,
              error: pErr?.message || String(pErr),
              isDuplicate: true
            });
          }
          combinedExisting.push(standardizedJob);
        } else {
          sourceNew++;
          uniqueJobs.push(standardizedJob);
          activeRunState.totalNew++;

          if (standardizedJob.status === 'Approved') {
            try {
              await JobRepository.create(standardizedJob);
              publishedJobs.push(standardizedJob);
              activeRunState.totalPublished++;
            } catch (cErr: any) {
              console.error(`[Scraper Engine] Failed saving approved job (${standardizedJob.title}):`, cErr?.message || cErr);
              failedToSaveErrors.push({
                title: standardizedJob.title,
                error: cErr?.message || String(cErr),
                isDuplicate: false
              });
            }
          } else {
            try {
              await JobRepository.addPending(standardizedJob);
              pendingJobs.push(standardizedJob);
              activeRunState.totalPending++;
            } catch (pErr: any) {
              console.error(`[Scraper Engine] Failed saving pending job (${standardizedJob.title}):`, pErr?.message || pErr);
              failedToSaveErrors.push({
                title: standardizedJob.title,
                error: pErr?.message || String(pErr),
                isDuplicate: false
              });
            }
          }
          combinedExisting.push(standardizedJob);
        }
      }

      // Update source stats honestly: Jobs Found vs No Jobs
      const sourceCompletedAt = new Date().toISOString();
      const isJobsFound = sourceFound > 0;
      const successHealth = isJobsFound ? 'Jobs Found' : 'No Jobs';

      await ScraperRepository.updateSourceStats(target.id, {
        lastCompletedAt: sourceCompletedAt,
        lastSuccessfulScrapeAt: isJobsFound ? sourceCompletedAt : target.lastSuccessfulScrapeAt,
        lastRunId: runId,
        scrapedCountIncrement: sourceFound,
        healthStatus: successHealth,
        lastErrorMessage: isJobsFound ? undefined : '0 vacancies extracted from target source'
      });

      sourcesStats.push({
        sourceId: target.id,
        sourceName: target.name,
        sourceUrl: target.url,
        startedAt: sourceRunStart,
        completedAt: sourceCompletedAt,
        found: sourceFound,
        newCount: sourceNew,
        dupCount: sourceDup,
        pagesAttempted: sourcePagesAttempted,
        pagesSuccessful: sourcePagesSuccessful,
        failed: false,
        lastSuccessfulScrapeAt: isJobsFound ? sourceCompletedAt : target.lastSuccessfulScrapeAt
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

      const isDbError = isTransientMongoError(err) ||
        err?.name === 'MongoNetworkTimeoutError' ||
        err?.name === 'MongoConnectionUnavailableError' ||
        err?.name?.includes('Mongo') ||
        errLower.includes('mongodb') ||
        errLower.includes('mongo') ||
        errLower.includes('econnrefused') ||
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
      } else if (errLower.includes('invalid pdf') || errLower.includes('pdf error') || errLower.includes('corrupt pdf') || (errLower.includes('pdf') && errLower.includes('fail'))) {
        classifiedHealth = 'Invalid PDF';
      } else if (errLower.includes('html instead of pdf') || errLower.includes('non-pdf') || errLower.includes('cheerio') || errLower.includes('html parse') || errLower.includes('invalid html') || errLower.includes('selector')) {
        classifiedHealth = 'HTML';
      } else {
        classifiedHealth = 'Fetch Error';
      }

      const sourceCompletedAt = new Date().toISOString();
      try {
        await ScraperRepository.updateSourceStats(target.id, {
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
        found: 0,
        newCount: 0,
        dupCount: 0,
        pagesAttempted: sourcePagesAttempted,
        pagesSuccessful: sourcePagesSuccessful,
        failed: true,
        error: sourceError,
        lastSuccessfulScrapeAt: target.lastSuccessfulScrapeAt
      });
    }
  }

  // Mark active run state complete
  activeRunState.isActive = false;
  activeRunState.isPaused = false;
  activeRunState.completedSources = targets.length;
  activeRunState.remainingSources = 0;
  activeRunState.runProgress = 100;
  activeRunState.lastUpdated = new Date().toISOString();

  const endTime = new Date();
  const duration = endTime.getTime() - startTime.getTime();

  // Save audit log for the scraper execution run
  await ScraperRepository.addRun({
    id: runId,
    batchId: runId,
    startedAt: startTime.toISOString(),
    completedAt: endTime.toISOString(),
    mode: options.mode,
    targetsScraped: targets.length,
    totalFound: harvestedJobs.length,
    newPublished: publishedJobs.length,
    newPending: pendingJobs.length,
    duplicatesFlagged: duplicateJobs.length,
    failedSources: failedCount,
    executionTimeMs: duration,
    sourcesStats
  });

  AuditRepository.add({
    user: 'Administrator',
    role: 'Scraper Hub',
    action: 'Scraper Run Completed',
    target: `${targets.length} Source Portals (${harvestedJobs.length} Jobs Harvested)`,
    status: failedCount > 0 ? 'Warning' : 'Success',
    metadata: {
      mode: options.mode,
      totalFound: harvestedJobs.length,
      published: publishedJobs.length,
      pending: pendingJobs.length,
      duplicates: duplicateJobs.length,
      failedSources: failedCount
    }
  });

  return {
    runId,
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
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
    message: `Scrape run completed across ${targets.length} sources. Extracted ${harvestedJobs.length} verified vacancies.`
  };
}
