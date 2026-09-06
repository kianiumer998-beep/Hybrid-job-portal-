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
}

/**
 * Authoritative Scraper Execution Engine with Multi-Source, Pagination, Cutoffs, and Duplication Control
 */
export async function executeScraperWithWizard(options: ScraperRunOptions): Promise<ScraperRunSummary> {
  const startTime = new Date();
  const timestampStr = startTime.toISOString().replace('T', ' ').substring(0, 19);
  const runId = `RUN-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

  const allSources = ScraperRepository.getConfigs();
  let targets: ScraperTargetConfig[] = [];

  // Filter sources based on requested options
  if (options.sourceIds && options.sourceIds.length > 0) {
    targets = allSources.filter(s => options.sourceIds!.includes(s.id));
  } else if (options.sourceId) {
    targets = allSources.filter(s => s.id === options.sourceId);
  } else {
    targets = allSources.filter(s => s.status === 'Active Scheduled');
  }

  if (targets.length === 0) {
    targets = allSources.slice(0, 5);
  }

  const existingLiveJobs = JobRepository.getAll({ limit: 1000 }).jobs;
  const existingPendingJobs = JobRepository.getPending();
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

  for (const target of targets) {
    const sourceRunStart = new Date().toISOString();
    ScraperRepository.updateSourceStats(target.id, {
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
        // Use authoritative lastSuccessfulScrapeAt, fallback to 7 days if never scraped before
        sinceTimestamp = target.lastSuccessfulScrapeAt || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      } else if (options.mode === 'custom_date') {
        sinceTimestamp = options.fromTimestamp;
      }

      // 2. Determine pages to crawl
      // Mode 'complete' (ALL AVAILABLE): crawl up to safe limit of 5 pages or until 0 jobs returned
      // Mode 'page_range': crawl precisely from startPage to endPage
      let startPage = 1;
      let endPage = 1;

      if (options.mode === 'page_range') {
        startPage = Math.max(1, options.startPage || 1);
        endPage = Math.max(startPage, Math.min(startPage + 20, options.endPage || startPage));
      } else if (options.mode === 'complete') {
        startPage = 1;
        endPage = 5; // Safe crawling ceiling for all available
      }

      const rawResults: ScrapedJobResult[] = [];

      for (let page = startPage; page <= endPage; page++) {
        sourcePagesAttempted++;
        totalPagesAttempted++;

        try {
          const pageResults = await scrapeTargetPortal(target, {
            page,
            startPage,
            endPage,
            sinceTimestamp
          });

          sourcePagesSuccessful++;
          totalPagesSuccessful++;

          if (pageResults && pageResults.length > 0) {
            rawResults.push(...pageResults);
          } else if (options.mode === 'complete') {
            // Reached the end of available jobs for this source
            break;
          }
        } catch (pageErr: any) {
          console.warn(`[Scraper Engine] Page ${page} failed for source ${target.name}:`, pageErr?.message || pageErr);
          // Continue to next page or next source without crashing
        }
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
        // Honest data standards: Never invent missing information
        const standardizedSalary = (raw.salary && raw.salary.trim() && raw.salary.toLowerCase() !== 'negotiable')
          ? raw.salary
          : 'Salary not disclosed';

        // Assess extraction quality
        const isQualityAcceptable = raw.title && raw.title.trim().length >= 3 && raw.company && raw.company.trim().length >= 2;
        if (!isQualityAcceptable) {
          totalJobsRejected++;
          continue; // Reject low quality / invalid vacancies
        }

        const standardizedJob: any = {
          ...raw,
          id: `scraped-${target.id}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
          salary: standardizedSalary,
          scraperSourceId: target.id,
          scraperSourceName: target.name,
          scrapedSourceDomain: target.url ? new URL(target.url.startsWith('http') ? target.url : 'https://' + target.url).hostname : 'target-portal.com',
          scrapedAt: timestampStr,
          scrapedTime: startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }),
          sourceUrl: raw.sourceUrl || target.url,
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

        if (dupCheck.isDuplicate) {
          sourceDup++;
          duplicateJobs.push(standardizedJob);
          // Duplicate saved into pending review queue with duplicate flag
          JobRepository.addPending(standardizedJob);
          combinedExisting.push(standardizedJob);
        } else {
          sourceNew++;
          uniqueJobs.push(standardizedJob);

          if (standardizedJob.status === 'Approved') {
            JobRepository.create(standardizedJob);
            publishedJobs.push(standardizedJob);
          } else {
            JobRepository.addPending(standardizedJob);
            pendingJobs.push(standardizedJob);
          }
          combinedExisting.push(standardizedJob);
        }
      }

      // Update source stats with successful run
      const sourceCompletedAt = new Date().toISOString();
      ScraperRepository.updateSourceStats(target.id, {
        lastCompletedAt: sourceCompletedAt,
        lastSuccessfulScrapeAt: sourceCompletedAt,
        lastRunId: runId,
        scrapedCountIncrement: sourceFound,
        healthStatus: 'healthy',
        lastErrorMessage: undefined
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
        lastSuccessfulScrapeAt: sourceCompletedAt
      });
    } catch (err: any) {
      failedCount++;
      sourceFailed = true;
      sourceError = err.message || 'Scraping target failed';
      console.error(`[Scraper Engine] Source error on ${target.name} (${target.url}):`, err);

      const sourceCompletedAt = new Date().toISOString();
      ScraperRepository.updateSourceStats(target.id, {
        lastCompletedAt: sourceCompletedAt,
        healthStatus: 'error',
        lastErrorMessage: sourceError
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
  }

  const endTime = new Date();
  const duration = endTime.getTime() - startTime.getTime();

  // Save audit log for the scraper execution run
  ScraperRepository.addRun({
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
    totalFailedSources: failedCount,
    pagesAttempted: totalPagesAttempted,
    pagesSuccessful: totalPagesSuccessful,
    jobsAccepted: uniqueJobs.length,
    jobsRejected: totalJobsRejected,
    publishedJobs,
    pendingJobs,
    duplicateJobs,
    sourcesStats,
    executionDurationMs: duration
  };
}
