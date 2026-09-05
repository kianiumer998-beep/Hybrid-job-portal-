import { Database, generateJobSlug } from '../db/database';
import { detectJobDuplicate } from './duplicateEngine';
import { scrapeTargetPortal, ScraperTargetConfig } from '../../src/services/scraperService';

export interface ScraperRunOptions {
  mode: 'complete' | 'page_range' | 'since_last' | 'custom_date' | 'source_only';
  sourceId?: string;
  startPage?: number;
  endPage?: number;
  sinceTimestamp?: string;
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
  summary: string;
}> {
  const runId = `RUN-${Date.now().toString(36).toUpperCase()}`;
  const startTime = new Date().toISOString();
  const allSources = Database.getScraperSources();

  // Filter sources based on options
  let targets: ScraperTargetConfig[] = [];
  if (options.sourceId) {
    targets = allSources.filter(s => s.id === options.sourceId);
  } else {
    targets = allSources.filter(s => s.status === 'Active Scheduled');
  }

  if (targets.length === 0) {
    targets = allSources.slice(0, 3);
  }

  const existingLiveJobs = Database.getJobs();
  const existingPendingJobs = Database.getPendingJobs();
  const combinedExisting = [...existingLiveJobs, ...existingPendingJobs];

  const harvestedJobs: any[] = [];
  const duplicateJobs: any[] = [];
  const uniqueJobs: any[] = [];
  const publishedJobs: any[] = [];
  const pendingJobs: any[] = [];
  let failedCount = 0;

  for (const target of targets) {
    try {
      const rawResults = await scrapeTargetPortal(target);

      for (const raw of rawResults) {
        // Enforce honest data standards (Rule 10 & 27: Never invent missing information)
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
          sourceType: target.isGovtPortal ? 'Official Government Source' : target.isNewspaperClippingPortal ? 'Newspaper Source' : 'External Aggregator',
          lastVerified: new Date().toISOString()
        };

        const quality = evaluateJobQuality(standardizedJob);
        standardizedJob.qualityScore = quality.score;

        // Apply Multi-Signal Duplicate Detection
        const duplicateCheck = detectJobDuplicate(standardizedJob, combinedExisting, harvestedJobs);

        if (duplicateCheck.isDuplicate) {
          standardizedJob.isDuplicate = true;
          standardizedJob.duplicateScore = duplicateCheck.confidence;
          standardizedJob.duplicateCategory = duplicateCheck.duplicateCategory;
          standardizedJob.duplicateMatchReason = duplicateCheck.reason;
          standardizedJob.duplicateOfJobId = duplicateCheck.matchedExistingJob?.id;
          standardizedJob.duplicateOfJobTitle = duplicateCheck.matchedExistingJob?.title;
          duplicateJobs.push(standardizedJob);
        } else {
          standardizedJob.isDuplicate = false;
          standardizedJob.duplicateScore = 0;
          uniqueJobs.push(standardizedJob);
        }

        harvestedJobs.push(standardizedJob);
      }
    } catch (err) {
      console.error(`[Scraper Engine] Error scraping target ${target.name}:`, err);
      failedCount++;
    }
  }

  // Handle publishing vs pending review according to source rule
  for (const job of uniqueJobs) {
    const target = targets.find(t => t.id === job.scraperSourceId);
    const autoPublish = (target && target.autoApprove) || options.autoPublishTrusted;

    if (autoPublish && job.qualityScore >= 70) {
      job.status = 'Approved';
      const live = Database.addJob(job);
      publishedJobs.push(live);
    } else {
      job.status = 'Pending';
      const pending = Database.addPendingJob(job);
      pendingJobs.push(pending);
    }
  }

  const endTime = new Date().toISOString();

  // Save Scraper Run Record into Database
  const runRecord = {
    id: runId,
    startTime,
    endTime,
    mode: options.mode,
    sourceName: options.sourceId ? targets[0]?.name : `Multiple (${targets.length} Portals)`,
    sourcesCount: targets.length,
    pagesScraped: options.mode === 'page_range' ? (options.endPage || 1) - (options.startPage || 1) + 1 : targets.length * 2,
    totalFound: harvestedJobs.length,
    newJobsCount: uniqueJobs.length,
    duplicateCount: duplicateJobs.length,
    publishedCount: publishedJobs.length,
    pendingCount: pendingJobs.length,
    failedCount,
    status: failedCount === 0 ? 'Success' : failedCount < targets.length ? 'Partial' : 'Failed'
  };

  Database.addScraperRun(runRecord);

  // Add system audit log
  Database.addAuditLog({
    user: 'Automated Scraper Engine',
    role: 'Scraper Manager',
    action: 'Scraper Run Completed',
    target: `Run ${runId}: ${uniqueJobs.length} new jobs, ${duplicateJobs.length} duplicates`,
    status: 'Success'
  });

  return {
    runId,
    totalFound: harvestedJobs.length,
    newJobs: uniqueJobs,
    duplicateJobs,
    publishedJobs,
    pendingJobs,
    failedCount,
    summary: `Harvested ${harvestedJobs.length} total vacancies. ${uniqueJobs.length} unique, ${duplicateJobs.length} duplicates identified. ${publishedJobs.length} published live directly.`
  };
}
