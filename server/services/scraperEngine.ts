import { ScraperRepository } from '../db/repositories/ScraperRepository';
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

export interface ActiveScraperRunState {
  runId: string;
  status: 'Idle' | 'Running' | 'Paused' | 'Stopped' | 'Completed' | 'Error';
  totalSources: number;
  completedSourcesCount: number;
  remainingSourcesCount: number;
  currentSourceId?: string;
  currentSourceName?: string;
  currentSourceIndex: number;
  jobsFound: number;
  newJobsCount: number;
  duplicatesCount: number;
  pendingCount: number;
  publishedCount: number;
  failedSourcesCount: number;
  currentError?: string;
  startTime: string;
  lastUpdatedTime: string;
  options?: ScraperRunOptions;
  remainingTargets?: ScraperTargetConfig[];
}

export interface ScraperRunSummary {
  runId: string;
  startTime: string;
  endTime: string;
  totalFound: number;
  totalNew: number;
  totalDuplicates: number;
  totalFailedSources: number;
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

// Global active run state holder for real-time monitoring and pause/resume/stop control
let activeRunState: ActiveScraperRunState & {
  isPaused?: boolean;
  isStopped?: boolean;
  isActive?: boolean;
  completedSources?: number;
  remainingSources?: number;
  totalFound?: number;
  newJobs?: number;
  duplicates?: number;
  pending?: number;
  published?: number;
  failedSources?: number;
} = {
  runId: '',
  status: 'Idle',
  totalSources: 0,
  completedSourcesCount: 0,
  remainingSourcesCount: 0,
  currentSourceIndex: 0,
  jobsFound: 0,
  newJobsCount: 0,
  duplicatesCount: 0,
  pendingCount: 0,
  publishedCount: 0,
  failedSourcesCount: 0,
  startTime: '',
  lastUpdatedTime: new Date().toISOString()
};

let activeRunCancelRequested = false;
let activeRunPauseRequested = false;

export function getActiveRunStatus(): any {
  const isPaused = activeRunState.status === 'Paused' || activeRunPauseRequested;
  const isStopped = activeRunState.status === 'Stopped' || activeRunCancelRequested;
  const isActive = activeRunState.status === 'Running' || isPaused;

  return {
    ...activeRunState,
    isActive,
    isPaused,
    isStopped,
    completedSources: activeRunState.completedSourcesCount,
    remainingSources: activeRunState.remainingSourcesCount,
    totalFound: activeRunState.jobsFound,
    newJobs: activeRunState.newJobsCount,
    duplicates: activeRunState.duplicatesCount,
    pending: activeRunState.pendingCount,
    published: activeRunState.publishedCount,
    failedSources: activeRunState.failedSourcesCount
  };
}

export function pauseActiveRun(): boolean {
  if (activeRunState.status === 'Running') {
    activeRunPauseRequested = true;
    activeRunState.status = 'Paused';
    activeRunState.isPaused = true;
    activeRunState.lastUpdatedTime = new Date().toISOString();
    return true;
  }
  return false;
}

export function stopActiveRun(): boolean {
  if (activeRunState.status === 'Running' || activeRunState.status === 'Paused') {
    activeRunCancelRequested = true;
    activeRunPauseRequested = false;
    activeRunState.status = 'Stopped';
    activeRunState.isStopped = true;
    activeRunState.isPaused = false;
    activeRunState.lastUpdatedTime = new Date().toISOString();
    return true;
  }
  return false;
}

export function resetActiveRun(): boolean {
  activeRunCancelRequested = false;
  activeRunPauseRequested = false;
  activeRunState = {
    runId: '',
    status: 'Idle',
    totalSources: 0,
    completedSourcesCount: 0,
    remainingSourcesCount: 0,
    currentSourceIndex: 0,
    jobsFound: 0,
    newJobsCount: 0,
    duplicatesCount: 0,
    pendingCount: 0,
    publishedCount: 0,
    failedSourcesCount: 0,
    startTime: '',
    lastUpdatedTime: new Date().toISOString()
  };
  return true;
}

export async function resumeActiveRun(): Promise<ScraperRunSummary | boolean | null> {
  if (activeRunState.status !== 'Paused' && !activeRunPauseRequested) {
    return false;
  }

  activeRunPauseRequested = false;
  activeRunCancelRequested = false;
  activeRunState.status = 'Running';
  activeRunState.isPaused = false;
  activeRunState.isStopped = false;
  activeRunState.lastUpdatedTime = new Date().toISOString();

  // If the run loop was waiting in memory, setting flags above will immediately resume it.
  // If the previous loop broke and we have remaining targets, continue execution:
  if (activeRunState.remainingTargets && activeRunState.remainingTargets.length > 0) {
    const remainingOptions: ScraperRunOptions = {
      ...(activeRunState.options || { mode: 'complete' }),
      sourceIds: activeRunState.remainingTargets.map(t => t.id)
    };
    return executeScraperWithWizard(remainingOptions);
  }

  return true;
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
    totalFailedSources: 0,
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
  // Prevent concurrent scraper runs (with automatic watchdog recovery for stale runs)
  if (activeRunState.status === 'Running') {
    const lastActiveMs = new Date(activeRunState.lastUpdatedTime || activeRunState.startTime || 0).getTime();
    const isStale = (Date.now() - lastActiveMs) > 5 * 60 * 1000;
    if (isStale) {
      console.warn(`[Scraper Engine] Previous run ${activeRunState.runId} appears stale (>5 minutes without updates). Auto-clearing state to unblock scraper.`);
      activeRunState.status = 'Completed';
      activeRunState.isStopped = true;
      activeRunCancelRequested = false;
      activeRunPauseRequested = false;
    } else {
      throw new Error('A scraper run is already in progress. Please wait for it to complete or pause/stop it first.');
    }
  }

  const startTime = new Date();
  const timestampStr = startTime.toISOString().replace('T', ' ').substring(0, 19);
  const runId = `RUN-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

  activeRunCancelRequested = false;
  activeRunPauseRequested = false;

  const allSources = await ScraperRepository.getConfigs();
  let targets: ScraperTargetConfig[] = [];

  // Filter sources based on requested options
  if (options.sourceIds !== undefined) {
    if (options.sourceIds.length === 0) {
      console.log('[Scraper Engine] Empty source selection provided. Run aborted.');
      return createEmptySummary(runId, startTime, 'No scraper sources selected. Scraper run was not executed.');
    }
    targets = allSources.filter(s => options.sourceIds!.includes(s.id));
  } else if (options.sourceId) {
    targets = allSources.filter(s => s.id === options.sourceId);
  } else {
    // Run All Enabled: skip Disabled, Invalid/404, permanently blocked sources
    targets = allSources.filter(s => {
      if (s.status === 'Disabled' || s.status === 'Paused') return false;
      const isActive = s.status === 'Active Scheduled' || s.status === 'Active';
      if (!isActive) return false;

      const h = s.healthStatus || '';
      const errMsg = (s.lastErrorMessage || '').toLowerCase();
      if (h === '404' || h === 'Invalid PDF' || errMsg.includes('404') || errMsg.includes('invalid pdf')) return false;
      if (h === '403' || errMsg.includes('permanently blocked') || errMsg.includes('access denied')) return false;

      return true;
    });
  }

  if (targets.length === 0) {
    console.log('[Scraper Engine] No active or matching scraper sources found to execute.');
    return createEmptySummary(runId, startTime, 'No active or matching scraper sources found to execute.');
  }

  // Initialize live tracking state
  activeRunState = {
    runId,
    status: 'Running',
    totalSources: targets.length,
    completedSourcesCount: 0,
    remainingSourcesCount: targets.length,
    currentSourceIndex: 0,
    jobsFound: 0,
    newJobsCount: 0,
    duplicatesCount: 0,
    pendingCount: 0,
    publishedCount: 0,
    failedSourcesCount: 0,
    startTime: startTime.toISOString(),
    lastUpdatedTime: new Date().toISOString(),
    options,
    remainingTargets: [...targets]
  };

  try {
    const existingLiveJobs = (await JobRepository.getAll({ limit: 2000 })).jobs;
    const existingPendingJobs = await JobRepository.getPending();
    const combinedExisting = [...existingLiveJobs, ...existingPendingJobs];

  const harvestedJobs: any[] = [];
  const duplicateJobs: any[] = [];
  const uniqueJobs: any[] = [];
  const publishedJobs: any[] = [];
  const pendingJobs: any[] = [];
  let failedCount = 0;
  let totalPagesAttempted = 0;
  let totalPagesSuccessful = 0;
  let totalJobsRejected = 0;

  const sourcesStats: ScraperRunSummary['sourcesStats'] = [];

  for (let tIdx = 0; tIdx < targets.length; tIdx++) {
    const target = targets[tIdx];

    // Check if Pause requested before source
    if (activeRunPauseRequested) {
      activeRunState.status = 'Paused';
      activeRunState.isPaused = true;
      activeRunState.remainingTargets = targets.slice(tIdx);
      activeRunState.remainingSourcesCount = targets.length - tIdx;
      activeRunState.lastUpdatedTime = new Date().toISOString();
      console.log(`[Scraper Engine] Run ${runId} paused before source ${target.name}. Waiting for resume or stop...`);
      while (activeRunPauseRequested && !activeRunCancelRequested) {
        await new Promise(r => setTimeout(r, 400));
      }
      if (activeRunCancelRequested) {
        activeRunState.status = 'Stopped';
        activeRunState.isStopped = true;
        activeRunState.isPaused = false;
        activeRunState.lastUpdatedTime = new Date().toISOString();
        break;
      }
      activeRunState.status = 'Running';
      activeRunState.isPaused = false;
      activeRunState.lastUpdatedTime = new Date().toISOString();
    }

    // Check if Stop requested before source
    if (activeRunCancelRequested) {
      activeRunState.status = 'Stopped';
      activeRunState.isStopped = true;
      activeRunState.remainingTargets = targets.slice(tIdx);
      activeRunState.remainingSourcesCount = targets.length - tIdx;
      activeRunState.lastUpdatedTime = new Date().toISOString();
      console.log(`[Scraper Engine] Run ${runId} stopped by user request.`);
      break;
    }

    activeRunState.currentSourceId = target.id;
    activeRunState.currentSourceName = target.name;
    activeRunState.currentSourceIndex = tIdx + 1;
    activeRunState.remainingSourcesCount = targets.length - tIdx;
    activeRunState.lastUpdatedTime = new Date().toISOString();

    const effectiveUrl = target.url || (target as any).portalUrl || (target as any).pdfUrl || '';
    target.url = effectiveUrl;
    const sourceRunStart = new Date().toISOString();
    await ScraperRepository.updateSourceStats(target.id, {
      lastStartedAt: sourceRunStart,
      lastRunId: runId
    });

    let sourceFound = 0;
    let sourceNew = 0;
    let sourceDup = 0;
    let sourcePagesAttempted = 0;
    let sourcePagesSuccessful = 0;
    let sourceFailed = false;
    let sourceError = '';

    try {
      // 1. Determine cutoff date
      let sinceTimestamp = options.sinceTimestamp;
      if (options.mode === 'since_last') {
        sinceTimestamp = target.lastSuccessfulScrapeAt || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      } else if (options.mode === 'custom_date') {
        sinceTimestamp = options.fromTimestamp;
      }

      // 2. Dynamic next-page crawl loop (no hard-coded 25-page limit)
      const rawResults: ScrapedJobResult[] = [];

      let startPage = 1;
      let maxAllowedPage = 1;

      if (options.mode === 'page_range') {
        startPage = Math.max(1, options.startPage || 1);
        maxAllowedPage = options.endPage ? Math.max(startPage, options.endPage) : startPage;
      } else if (options.mode === 'complete') {
        startPage = 1;
        maxAllowedPage = options.endPage ? Math.max(1, options.endPage) : 200;
      }

      let currentPage = startPage;
      let hasMorePages = true;

      while (currentPage <= maxAllowedPage && hasMorePages) {
        if (activeRunPauseRequested) {
          activeRunState.status = 'Paused';
          activeRunState.isPaused = true;
          activeRunState.lastUpdatedTime = new Date().toISOString();
          while (activeRunPauseRequested && !activeRunCancelRequested) {
            await new Promise(r => setTimeout(r, 400));
          }
          if (activeRunCancelRequested) {
            hasMorePages = false;
            break;
          }
          activeRunState.status = 'Running';
          activeRunState.isPaused = false;
          activeRunState.lastUpdatedTime = new Date().toISOString();
        }

        if (activeRunCancelRequested) {
          hasMorePages = false;
          break;
        }

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

            const nextPageDetected = pageResults.some(j => !!j.nextPageUrl);
            if (options.mode === 'complete') {
              if (nextPageDetected && currentPage < maxAllowedPage) {
                currentPage++;
              } else if (pageResults.length >= 10 && currentPage < maxAllowedPage) {
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
            hasMorePages = false;
          }
        } catch (pageErr: any) {
          console.log(`[Scraper Engine] Page ${currentPage} notice on source ${target.name}: ${pageErr?.message || pageErr}`);
          hasMorePages = false;
        }
      }

      // Date filtering for custom_date, since_last, and cutoff bounds
      let filteredResults = rawResults;
      const parseJobTime = (j: ScrapedJobResult): number | null => {
        const rawTimeStr = j.datePosted || j.postedAt;
        if (!rawTimeStr || typeof rawTimeStr !== 'string' || rawTimeStr.trim().toLowerCase() === 'recent') return null;
        const parsed = new Date(rawTimeStr).getTime();
        return isNaN(parsed) ? null : parsed;
      };

      if (options.mode === 'custom_date') {
        if (options.fromTimestamp) {
          const fromTime = new Date(options.fromTimestamp).getTime();
          if (!isNaN(fromTime)) {
            filteredResults = filteredResults.filter(j => {
              const postTime = parseJobTime(j);
              return postTime === null || postTime >= fromTime;
            });
          }
        }
        if (options.toTimestamp) {
          const toTime = new Date(options.toTimestamp).getTime();
          if (!isNaN(toTime)) {
            filteredResults = filteredResults.filter(j => {
              const postTime = parseJobTime(j);
              return postTime === null || postTime <= toTime;
            });
          }
        }
      } else if (sinceTimestamp) {
        const cutoffTime = new Date(sinceTimestamp).getTime();
        if (!isNaN(cutoffTime)) {
          filteredResults = filteredResults.filter(j => {
            const postTime = parseJobTime(j);
            return postTime === null || postTime >= cutoffTime;
          });
        }
      }

      sourceFound = filteredResults.length;

      for (const raw of filteredResults) {
        const standardizedSalary = (raw.salary && raw.salary.trim() && raw.salary.toLowerCase() !== 'negotiable' && raw.salary.toLowerCase() !== 'salary not disclosed')
          ? raw.salary.trim()
          : (raw.salary && raw.salary.trim() ? raw.salary.trim() : undefined);

        const isQualityAcceptable = !!(raw.title && raw.title.trim().length >= 3 && raw.company && raw.company.trim().length >= 2);
        if (!isQualityAcceptable) {
          totalJobsRejected++;
          continue;
        }

        const domain = target.url ? new URL(target.url.startsWith('http') ? target.url : 'https://' + target.url).hostname : 'target-portal.com';

        // Location determination - preserve extracted location, or fallback to source configuration
        const isPakPortal = (target as any).region === 'Pakistan' ||
          target.isGovtPortal ||
          domain.endsWith('.pk') ||
          /pakistan|fpsc|ppsc|spsc|kppsc|bpsc|federal|punjab|sindh|kpk|balochistan|islamabad|lahore|karachi|peshawar|quetta|wapda|nadra|hec|ptcl|ogdcl|fia|nab|fbr/i.test(target.name) ||
          /pakistan|islamabad|lahore|karachi|rawalpindi|peshawar|quetta|multan|faisalabad|sialkot|gujranwala/i.test(`${raw.title} ${raw.city || ''} ${raw.department || ''} ${raw.province || ''}`);

        let resolvedRegion = (raw.region && raw.region !== 'Global') ? raw.region : ((target as any).region || (isPakPortal ? 'Pakistan' : 'Global'));
        let resolvedProvince = raw.province || (target as any).province;
        let resolvedCity = raw.city || (target as any).city;
        let resolvedDistrict = (raw as any).district || (target as any).district;

        // If source location enforcement is enabled, override with source settings
        if (target.useSourceLocation) {
          if ((target as any).region) resolvedRegion = (target as any).region;
          if (target.province) resolvedProvince = target.province;
          if (target.city) resolvedCity = target.city;
          if (target.district) resolvedDistrict = target.district;
        }

        // Pakistani province auto-detection if still unassigned
        if ((resolvedRegion === 'Pakistan' || isPakPortal) && !resolvedProvince) {
          const combinedLocText = `${target.name} ${raw.title} ${resolvedCity || ''} ${raw.department || ''}`.toLowerCase();
          if (combinedLocText.includes('federal') || combinedLocText.includes('fpsc') || combinedLocText.includes('islamabad') || combinedLocText.includes('national')) {
            resolvedProvince = 'Federal';
          } else if (combinedLocText.includes('punjab') || combinedLocText.includes('ppsc') || combinedLocText.includes('lahore') || combinedLocText.includes('rawalpindi') || combinedLocText.includes('multan') || combinedLocText.includes('faisalabad')) {
            resolvedProvince = 'Punjab';
          } else if (combinedLocText.includes('sindh') || combinedLocText.includes('spsc') || combinedLocText.includes('karachi') || combinedLocText.includes('hyderabad') || combinedLocText.includes('sukkur')) {
            resolvedProvince = 'Sindh';
          } else if (combinedLocText.includes('kpk') || combinedLocText.includes('kp') || combinedLocText.includes('kppsc') || combinedLocText.includes('peshawar') || combinedLocText.includes('abbottabad')) {
            resolvedProvince = 'Khyber Pakhtunkhwa';
          } else if (combinedLocText.includes('balochistan') || combinedLocText.includes('bpsc') || combinedLocText.includes('quetta') || combinedLocText.includes('gwadar')) {
            resolvedProvince = 'Balochistan';
          } else if (combinedLocText.includes('ajk') || combinedLocText.includes('azad kashmir') || combinedLocText.includes('muzaffarabad')) {
            resolvedProvince = 'Azad Kashmir';
          } else if (combinedLocText.includes('gilgit') || combinedLocText.includes('baltistan')) {
            resolvedProvince = 'Gilgit-Baltistan';
          }
        }

        const standardizedJob: any = {
          ...raw,
          id: raw.id || `scraped-${target.id}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
          salary: standardizedSalary || '',
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
          jobCategory: (target as any).category || (raw as any).jobCategory || undefined,
          region: resolvedRegion,
          province: resolvedProvince || undefined,
          city: resolvedCity || undefined,
          district: resolvedDistrict || undefined,
          isGovtJob: (target as any).category === 'Government Sector' || (target as any).isGovtPortal || !!raw.isGovtJob,
          isNewspaperAd: (target as any).category === 'Newspaper Classified' || !!raw.isNewspaperAd,
          newspaperName: (target as any).category === 'Newspaper Classified' ? target.name : (raw.newspaperName || undefined),
          clippingImageUrl: raw.clippingImageUrl || raw.mediaUrl || undefined,
          pdfSourceUrl: raw.pdfSourceUrl || (raw.sourceUrl && typeof raw.sourceUrl === 'string' && raw.sourceUrl.toLowerCase().endsWith('.pdf') ? raw.sourceUrl : undefined),
          extractedText: raw.extractedText || raw.rawText || undefined,
          mediaUrl: raw.mediaUrl || raw.clippingImageUrl || undefined,
          deadlineDate: raw.deadlineDate || undefined,
          status: (target.autoApprove && options.autoPublishTrusted) ? 'Approved' : 'Pending'
        };

        // Deduplication check
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

        if (dupCheck.isDuplicate) {
          sourceDup++;
          duplicateJobs.push(standardizedJob);
          await JobRepository.addPending(standardizedJob);
          combinedExisting.push(standardizedJob);
        } else {
          sourceNew++;
          uniqueJobs.push(standardizedJob);

          if (standardizedJob.status === 'Approved') {
            await JobRepository.create(standardizedJob);
            publishedJobs.push(standardizedJob);
          } else {
            await JobRepository.addPending(standardizedJob);
            pendingJobs.push(standardizedJob);
          }
          combinedExisting.push(standardizedJob);
        }
      }

      // Update source stats
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
      console.log(`[Scraper Engine] Source notice on ${target.name} (${target.url}): ${err?.message || err}`);

      const errLower = sourceError.toLowerCase();
      let classifiedHealth: string = 'Fetch Error';
      let httpStatus: number | undefined = err.status || err.statusCode || err.httpStatus;

      if (httpStatus === 404 || errLower.includes('404') || errLower.includes('not found')) {
        classifiedHealth = '404';
        if (!httpStatus) httpStatus = 404;
      } else if (httpStatus === 403 || errLower.includes('403') || errLower.includes('forbidden') || errLower.includes('access denied')) {
        classifiedHealth = '403';
        if (!httpStatus) httpStatus = 403;
      } else if (errLower.includes('timeout') || errLower.includes('timed out') || errLower.includes('etimedout') || errLower.includes('aborterror')) {
        classifiedHealth = 'Timeout';
      } else if (errLower.includes('invalid pdf') || errLower.includes('pdf error') || errLower.includes('corrupt pdf') || (errLower.includes('pdf') && errLower.includes('fail'))) {
        classifiedHealth = 'Invalid PDF';
      } else if (errLower.includes('cheerio') || errLower.includes('html parse') || errLower.includes('invalid html') || errLower.includes('selector')) {
        classifiedHealth = 'HTML';
      } else {
        classifiedHealth = 'Fetch Error';
      }

      const sourceCompletedAt = new Date().toISOString();
      await ScraperRepository.updateSourceStats(target.id, {
        lastCompletedAt: sourceCompletedAt,
        healthStatus: classifiedHealth,
        lastErrorMessage: sourceError,
        lastHttpStatus: httpStatus
      });

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

    // Update live state counts after each source
    activeRunState.completedSourcesCount = tIdx + 1;
    activeRunState.remainingSourcesCount = targets.length - (tIdx + 1);
    activeRunState.jobsFound = harvestedJobs.length;
    activeRunState.newJobsCount = uniqueJobs.length;
    activeRunState.duplicatesCount = duplicateJobs.length;
    activeRunState.pendingCount = pendingJobs.length;
    activeRunState.publishedCount = publishedJobs.length;
    activeRunState.failedSourcesCount = failedCount;
    activeRunState.currentError = sourceError || undefined;
    activeRunState.lastUpdatedTime = new Date().toISOString();
  }

  const endTime = new Date();
  const duration = endTime.getTime() - startTime.getTime();

  if (activeRunState.status !== 'Paused' && activeRunState.status !== 'Stopped') {
    activeRunState.status = 'Completed';
  }
  activeRunState.lastUpdatedTime = endTime.toISOString();

  // Save audit log
  await ScraperRepository.addRun({
    id: runId,
    batchId: runId,
    startedAt: startTime.toISOString(),
    completedAt: endTime.toISOString(),
    mode: options.mode,
    targetsScraped: sourcesStats.length,
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
    target: `${sourcesStats.length} Source Portals (${harvestedJobs.length} Jobs Harvested)`,
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
    totalFailedSources: failedCount,
    pagesAttempted: totalPagesAttempted,
    pagesSuccessful: totalPagesSuccessful,
    jobsAccepted: uniqueJobs.length,
    jobsRejected: totalJobsRejected,
    publishedJobs,
    pendingJobs,
    duplicateJobs,
    sourcesStats,
    executionDurationMs: duration,
    message: `Scrape run completed across ${sourcesStats.length} sources. Extracted ${harvestedJobs.length} verified vacancies.`
  };
} catch (runErr: any) {
  console.error(`[Scraper Engine] Fatal run error in ${runId}:`, runErr);
  if (activeRunState.status !== 'Paused' && activeRunState.status !== 'Stopped') {
    activeRunState.status = 'Completed';
    activeRunState.isStopped = true;
  }
  activeRunState.currentError = runErr?.message || String(runErr);
  activeRunState.lastUpdatedTime = new Date().toISOString();
  throw runErr;
} finally {
  if (activeRunState.status === 'Running' && !activeRunPauseRequested) {
    activeRunState.status = 'Completed';
  }
  activeRunState.lastUpdatedTime = new Date().toISOString();
}
}

