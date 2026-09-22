import { Job } from '../types/job';

export type JobSourceType = 'scraped' | 'user_posted' | 'admin_created' | 'imported' | 'unknown';

/**
 * Determines if a job originated from automated scrapers, crawlers, or document parsers.
 * Standard user or manually created employer jobs do not have scraper metadata.
 */
export function isScrapedJob(job: Partial<Job> | null | undefined): boolean {
  if (!job) return false;
  const j = job as any;
  if (j.isPdfScraped === true) return true;
  if (j.isScraped === true) return true;
  if (j.sourceType === 'scraped') return true;
  if (Boolean(j.scraperSourceId && String(j.scraperSourceId).trim())) return true;
  if (Boolean(j.scraperSourceName && String(j.scraperSourceName).trim())) return true;
  if (Boolean(j.scrapedSourceDomain && String(j.scrapedSourceDomain).trim())) return true;
  if (Boolean(j.sourcePortal && String(j.sourcePortal).trim())) return true;
  if (Boolean(j.scrapeRunId && String(j.scrapeRunId).trim())) return true;
  if (Boolean(j.scrapedAt && String(j.scrapedAt).trim())) return true;
  if (Boolean(j.extractionMethod && String(j.extractionMethod).trim())) return true;
  if (Boolean(j.sourceJobId && String(j.sourceJobId).trim())) return true;
  if (Boolean(j.pdfSourceUrl && String(j.pdfSourceUrl).trim())) return true;
  if (Boolean(j.pdfFileName && String(j.pdfFileName).trim())) return true;
  if (typeof j.id === 'string' && /^(scraped|gh|lever|sr|ashby|ld|html|doc|ocr|pdf|next)-/i.test(j.id)) {
    return true;
  }
  return false;
}

/**
 * Authoritatively derives or validates the job's source classification.
 * Prevents client spoofing: any job matching scraper origins is always 'scraped'.
 */
export function deriveJobSourceType(job: Partial<Job> | any): JobSourceType {
  if (!job) return 'unknown';

  // 1. Scraper origin check always takes precedence to protect notification safety
  if (isScrapedJob(job)) {
    return 'scraped';
  }

  // 2. If already explicitly assigned a valid sourceType and not scraped
  if (job.sourceType && ['user_posted', 'admin_created', 'imported', 'unknown'].includes(job.sourceType)) {
    return job.sourceType as JobSourceType;
  }

  // 3. User-posted check: submitted by an authenticated user/employer
  if (job.submittedByUserId && String(job.submittedByUserId).trim()) {
    return 'user_posted';
  }

  // 4. Admin-created check
  if (job.createdByAdmin === true || job.postedByAdmin === true || job.adminAuthor === true) {
    return 'admin_created';
  }

  // 5. Imported check
  if (job.isImported === true || (typeof job.id === 'string' && job.id.startsWith('import-'))) {
    return 'imported';
  }

  return 'unknown';
}

/**
 * Checks if a salary string is a non-factual placeholder or generic fallback.
 */
export function isGenericOrFallbackSalary(salary: string | undefined | null): boolean {
  if (!salary) return true;
  const s = String(salary).trim().toLowerCase();
  if (!s) return true;
  if (
    s === 'negotiable' ||
    s === 'salary not disclosed' ||
    s === 'not disclosed' ||
    s === 'competitive' ||
    s === 'tbd' ||
    s === 'as per company policy' ||
    s === 'market competitive' ||
    s.includes('government pay scale') ||
    s === 'best in industry'
  ) {
    return true;
  }
  return false;
}

/**
 * Calculates the list of critical factual fields that are missing from a job record.
 * Does not invent values; calculates directly from the record.
 * 
 * In accordance with production business rules, only fields that are actually
 * required for publishing block approval:
 * - Title (must be specified and not 'Untitled Position')
 * - Company / Employer (must be specified)
 * - Location (must have city, province, region, country, or location)
 * 
 * Note: Job Type, Salary, and Experience Level are preserved when provided by the source,
 * but are NOT blindly mandatory for publication if the source legitimately
 * did not publish them (e.g. government gazettes, unstated compensation/modality).
 */
export function calculateJobMissingFields(job: Partial<Job> | null | undefined): string[] {
  if (!job) {
    return ['Title', 'Company', 'Location'];
  }

  const missing: string[] = [];

  // Title - required for publishing
  const title = job.title ? String(job.title).trim() : '';
  if (!title || title.toLowerCase() === 'untitled position') {
    missing.push('Title');
  }

  // Company / Employer - required for publishing
  const company = job.company ? String(job.company).trim() : '';
  if (!company) {
    missing.push('Company');
  }

  // Location: city, province, region, country, or location - required for publishing
  const hasCity = Boolean(job.city && String(job.city).trim());
  const hasProvince = Boolean(job.province && String(job.province).trim());
  const hasRegion = Boolean(job.region && String(job.region).trim() && job.region !== 'Global');
  const hasCountry = Boolean((job as any).country && String((job as any).country).trim());
  const hasLocation = Boolean((job as any).location && String((job as any).location).trim());
  if (!hasCity && !hasProvince && !hasRegion && !hasCountry && !hasLocation) {
    missing.push('Location');
  }

  return missing;
}

/**
 * Formats missing fields into a display string, e.g.:
 * "Missing: Location, Salary, Experience"
 */
export function formatMissingFieldsNotice(missingFields: string[]): string {
  if (!missingFields || missingFields.length === 0) return '';
  return `Missing: ${missingFields.join(', ')}`;
}

// -------------------------------------------------------------
// Detailed Field Checkers for Admin Scraper Review Filtering
// -------------------------------------------------------------

export function hasMissingDescription(job: Partial<Job> | null | undefined): boolean {
  if (!job) return true;
  const desc = job.description ? String(job.description).trim() : '';
  return !desc || desc.length < 15;
}

export function hasMissingLocation(job: Partial<Job> | null | undefined): boolean {
  if (!job) return true;
  const hasCity = Boolean(job.city && String(job.city).trim());
  const hasProvince = Boolean(job.province && String(job.province).trim());
  const hasRegion = Boolean(job.region && String(job.region).trim() && job.region !== 'Global');
  const hasCountry = Boolean((job as any).country && String((job as any).country).trim());
  const hasLocation = Boolean((job as any).location && String((job as any).location).trim());
  return !hasCity && !hasProvince && !hasRegion && !hasCountry && !hasLocation;
}

export function hasMissingCompany(job: Partial<Job> | null | undefined): boolean {
  if (!job) return true;
  const comp = job.company ? String(job.company).trim() : '';
  return !comp || comp.toLowerCase() === 'unknown' || comp.toLowerCase() === 'unspecified';
}

export function hasMissingSalary(job: Partial<Job> | null | undefined): boolean {
  if (!job) return true;
  return !job.salary || isGenericOrFallbackSalary(job.salary);
}

export function hasMissingDeadline(job: Partial<Job> | null | undefined): boolean {
  if (!job) return true;
  const j = job as any;
  const deadline = job.deadlineDate || j.deadline || j.closingDeadline || j.lastDate;
  return !deadline || !String(deadline).trim();
}

export function hasMissingExperience(job: Partial<Job> | null | undefined): boolean {
  if (!job) return true;
  const exp = job.experienceLevel ? String(job.experienceLevel).trim() : '';
  return !exp || exp.toLowerCase() === 'unspecified';
}

export function hasMissingJobType(job: Partial<Job> | null | undefined): boolean {
  if (!job) return true;
  const jt = job.jobType ? String(job.jobType).trim() : '';
  return !jt;
}

export function isPdfDocumentJob(job: Partial<Job> | null | undefined): boolean {
  if (!job) return false;
  const j = job as any;
  if (j.isPdfScraped === true) return true;
  if (Boolean(j.pdfSourceUrl && String(j.pdfSourceUrl).trim())) return true;
  if (Boolean(j.sourcePdfUrl && String(j.sourcePdfUrl).trim())) return true;
  if (j.extractionMethod === 'OCR' || j.extractionMethod === 'PDF_STRUCTURED') return true;
  const url = String(j.sourceUrl || j.applicationUrl || '').toLowerCase();
  return url.includes('.pdf') || url.includes('/advertisement') || url.includes('/jobs/download');
}

export function isOcrRequired(job: Partial<Job> | null | undefined): boolean {
  if (!job) return false;
  const j = job as any;
  if (j.documentProcessingStatus === 'OCR_REQUIRED') return true;
  if (isPdfDocumentJob(job) && (!job.description || job.description.trim().length < 30) && !j.documentProcessingStatus) {
    return true;
  }
  return false;
}

export function isOcrFailed(job: Partial<Job> | null | undefined): boolean {
  if (!job) return false;
  const j = job as any;
  return j.documentProcessingStatus === 'OCR_FAILED' || Boolean(j.documentProcessingError);
}

export function isNonJobRecord(job: Partial<Job> | null | undefined): boolean {
  if (!job) return false;
  const j = job as any;
  return j.isNonJob === true || j.classificationState === 'NON_JOB' || j.reviewStatus === 'NON_JOB';
}

export function isNeedsReviewRecord(job: Partial<Job> | null | undefined): boolean {
  if (!job) return false;
  const j = job as any;
  return j.classificationState === 'NEEDS_REVIEW' || j.reviewStatus === 'NEEDS_REVIEW';
}

