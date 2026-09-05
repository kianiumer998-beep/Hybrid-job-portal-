import { generateJobSlug } from '../db/database';
import { detectJobDuplicate } from './duplicateEngine';
import { scrapeTargetPortal, ScraperTargetConfig } from '../../src/services/scraperService';
import { JobRepository, ScraperRepository, AuditRepository } from '../db/repositories';

export interface ScraperRunOptions {
  mode: 'complete' | 'page_range' | 'since_last' | 'custom_date' | 'source_only';
  sourceId?: string;
  sourceIds?: string[];
  startPage?: number;
  endPage?: number;
  sinceTimestamp?: string;
  fromTimestamp?: string;
  toTimestamp?: string;
  autoPublishTrusted?: boolean;
}

export interface JobQualityReport {
  score: number; // 0 - 100
  missingFields: string[];
  warnings: string[];
  isPublishReady: boolean;
}

export function evaluateJobQuality(job: any): JobQualityReport {
  const missing: string[] = [];
  const warnings: string[] = [];
  let score = 100;

  if (!job.title || job.title.trim().length < 3) {
    missing.push('Title');
    score -= 30;
  }
  if (!job.company || job.company.trim().length < 2) {
    missing.push('Company');
    score -= 25;
  }
  if (!job.description || job.description.trim().length < 20) {
    missing.push('Detailed Description');
    score -= 20;
  }
  if (!job.sourceUrl) {
    missing.push('Original Source Link');
    score -= 15;
  }
  if (!job.salary || job.salary === 'Salary not disclosed') {
    warnings.push('Salary not disclosed by employer');
    score -= 5;
  }
  if (!job.deadlineDate) {
    warnings.push('Explicit application deadline not detected');
    score -= 5;
  }

  score = Math.max(0, Math.min(100, score));

  return {
    score,
    missingFields: missing,
    warnings,
    isPublishReady: score >= 60 && missing.length === 0
  };
}

export async function executeScraperWithWizard(options: ScraperRunOptions): Promise<{
  runId: string;
  totalFound: number;
  newJobs: any[];
  duplicateJobs: any[];
  publishedJobs: any[];
  pendingJobs: any[];
  failedCount: number;
  sourcesStats: Array<{
    sourceId: string;
    sourceName: string;
    found: number;
    newCount: number;
    duplicateCount: number;
    failed: boolean;
    error?: string;
  }>;
  summary: string;
}> {
  const runId = `RUN-${Date.now().toString(36).toUpperCase()}`;
  const startTime = new Date().toISOString();
  const allSources: ScraperTargetConfig[] = ScraperRepository.getConfigs();

  // Filter sources based on options (support both sourceIds[] and sourceId)
  let targets: ScraperTargetConfig[] = [];
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
  const sourcesStats: any[] = [];

  for (const target of targets) {
    const sourceRunStart = new Date().toISOString();
    ScraperRepository.updateSourceStats(target.id, {
      lastStartedAt: sourceRunStart,
      lastRunId: runId
    });

    let sourceFound = 0;
    let sourceNew = 0;
    let sourceDup = 0;
    let sourceFailed = false;
    let sourceError = '';

    try {
      // Determine cutoff date for mode: 'since_last' or 'custom_date'
      let sinceTimestamp = options.sinceTimestamp || options.fromTimestamp;
      if (options.mode === 'since_last') {
        sinceTimestamp = target.lastSuccessfulScrapeAt || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      }

      // Determine pages to scrape based on mode
      const startPage = options.mode === 'page_range' ? Math.max(1, options.startPage || 1) : 1;
      const endPage = options.mode === 'page_range' ? Math.max(startPage, options.endPage || startPage) : 1;

      const rawResults: any[] = [];

      for (let page = startPage; page <= endPage; page++) {
        const pageResults = await scrapeTargetPortal(target, {
          page,
          startPage,
          endPage,
          sinceTimestamp
        });
        rawResults.push(...pageResults);
      }

      sourceFound = rawResults.length;

      for (const raw of rawResults) {
        // Honest data standards: Never invent missing information
        const standardizedSalary = (raw.salary && raw.salary.trim())
          ? raw.salary
          : 'Salary not disclosed';

        const standardizedJob: any = {
          ...raw,
          id: `scraped-${target.id}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
          slug: generateJobSlug(raw.title, raw.city, raw.id),
          salary: standardizedSalary,
          scraperSourceId: target.id,
          scraperSourceName: target.name,
          scrapedAt: new Date().toISOString(),
          firstSeenAt: new Date().toISOString(),
          lastSeenAt: new Date().toISOString(),
          scrapeRunId: runId,
          sourceType: target.isGovtPortal ? 'Official Government Source' : target.isNewspaperClippingPortal ? 'Newspaper Source' : 'External Aggregator',
          lastVerified: new Date().toISOString(),
          extractionStatus: 'Extracted'
        };

        const quality = evaluateJobQuality(standardizedJob);
        standardizedJob.qualityScore = quality.score;

        // Multi-Signal Duplicate Detection against existing DB and current batch
        const duplicateCheck = detectJobDuplicate(standardizedJob, combinedExisting, harvestedJobs);

        if (duplicateCheck.isDuplicate) {
          standardizedJob.isDuplicate = true;
          standardizedJob.duplicateScore = duplicateCheck.confidence;
          standardizedJob.duplicateCategory = duplicateCheck.duplicateCategory;
          standardizedJob.duplicateMatchReason = duplicateCheck.reason;
          standardizedJob.duplicateOfJobId = duplicateCheck.matchedExistingJob?.id;
          standardizedJob.duplicateOfJobTitle = duplicateCheck.matchedExistingJob?.title;
          duplicateJobs.push(standardizedJob);
          sourceDup++;
        } else {
          standardizedJob.isDuplicate = false;
          standardizedJob.duplicateScore = 0;
          standardizedJob.duplicateCategory = 'NONE';
          uniqueJobs.push(standardizedJob);
          sourceNew++;
        }

        harvestedJobs.push(standardizedJob);
      }

      // Record successful source completion
      ScraperRepository.updateSourceStats(target.id, {
        lastSuccessfulScrapeAt: new Date().toISOString(),
        lastCompletedAt: new Date().toISOString(),
        scrapedCountIncrement: rawResults.length,
        healthStatus: 'healthy',
        lastErrorMessage: ''
      });
    } catch (err: any) {
      console.error(`[Scraper Engine] Error scraping target ${target.name}:`, err);
      failedCount++;
      sourceFailed = true;
      sourceError = err?.message || 'Extraction error';

      ScraperRepository.updateSourceStats(target.id, {
        lastCompletedAt: new Date().toISOString(),
        healthStatus: 'error',
        lastErrorMessage: sourceError
      });
    }

    sourcesStats.push({
      sourceId: target.id,
      sourceName: target.name,
      found: sourceFound,
      newCount: sourceNew,
      duplicateCount: sourceDup,
      failed: sourceFailed,
      error: sourceError || undefined
    });
  }

  // Handle publishing vs pending review
  for (const job of uniqueJobs) {
    const target = targets.find(t => t.id === job.scraperSourceId);
    const autoPublish = (target && target.autoApprove) || options.autoPublishTrusted;

    if (autoPublish && job.qualityScore >= 75) {
      job.status = 'Approved';
      const live = JobRepository.create(job);
      publishedJobs.push(live);
    } else {
      job.status = 'Pending';
      const pending = JobRepository.addPending(job);
      pendingJobs.push(pending);
    }
  }

  // Also save duplicates to pending review queue so admin can inspect/override/merge them
  for (const dup of duplicateJobs) {
    dup.status = 'Pending';
    JobRepository.addPending(dup);
    pendingJobs.push(dup);
  }

  const endTime = new Date().toISOString();

  // Save Scraper Run Record into Database
  const runRecord = {
    id: runId,
    startTime,
    endTime,
    mode: options.mode,
    sourceName: targets.length === 1 ? targets[0]?.name : `Multiple (${targets.length} Portals)`,
    sourcesCount: targets.length,
    pagesScraped: options.mode === 'page_range' ? (options.endPage || 1) - (options.startPage || 1) + 1 : targets.length,
    totalFound: harvestedJobs.length,
    newJobsCount: uniqueJobs.length,
    duplicateCount: duplicateJobs.length,
    publishedCount: publishedJobs.length,
    pendingCount: pendingJobs.length,
    failedCount,
    sourcesStats,
    status: failedCount === 0 ? 'Success' : failedCount < targets.length ? 'Partial' : 'Failed'
  };

  ScraperRepository.addRun(runRecord);

  // Add system audit log
  AuditRepository.add({
    user: 'Automated Scraper Engine',
    role: 'Scraper Manager',
    action: 'Scraper Run Completed',
    target: `Run ${runId}: ${uniqueJobs.length} new jobs, ${duplicateJobs.length} duplicates from ${targets.length} sources`,
    status: 'Success',
    metadata: { runId, mode: options.mode, sourcesCount: targets.length }
  });

  return {
    runId,
    totalFound: harvestedJobs.length,
    newJobs: uniqueJobs,
    duplicateJobs,
    publishedJobs,
    pendingJobs,
    failedCount,
    sourcesStats,
    summary: `Harvested ${harvestedJobs.length} real vacancies across ${targets.length} portals. ${uniqueJobs.length} unique, ${duplicateJobs.length} duplicates detected. ${publishedJobs.length} published directly, ${pendingJobs.length} ready in review queue.`
  };
}
