import { Job } from '../types/job';

/**
 * Determines if a job originated from automated scrapers, crawlers, or document parsers.
 * Standard user or manually created employer jobs do not have scraper metadata.
 */
export function isScrapedJob(job: Partial<Job> | null | undefined): boolean {
  if (!job) return false;
  const j = job as any;
  if (j.isPdfScraped === true) return true;
  if (j.isScraped === true) return true;
  if (Boolean(j.scraperSourceId && String(j.scraperSourceId).trim())) return true;
  if (Boolean(j.scraperSourceName && String(j.scraperSourceName).trim())) return true;
  if (Boolean(j.scrapedSourceDomain && String(j.scrapedSourceDomain).trim())) return true;
  if (Boolean(j.sourcePortal && String(j.sourcePortal).trim())) return true;
  if (Boolean(j.scrapeRunId && String(j.scrapeRunId).trim())) return true;
  if (Boolean(j.extractionMethod && String(j.extractionMethod).trim())) return true;
  if (Boolean(j.sourceJobId && String(j.sourceJobId).trim())) return true;
  if (typeof j.id === 'string' && /^(scraped|gh|lever|sr|ashby|ld|html|doc|ocr|pdf|next)-/i.test(j.id)) {
    return true;
  }
  return false;
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
 * Critical factual fields for publication:
 * - Title
 * - Company
 * - Location (must have city, province, region, country, or location)
 * - Job Type (must be specified, e.g. Remote, Hybrid, On-site)
 * - Salary (must be a factual salary, not a generic fallback)
 * - Experience (must specify experience level)
 */
export function calculateJobMissingFields(job: Partial<Job> | null | undefined): string[] {
  if (!job) {
    return ['Title', 'Company', 'Location', 'Job Type', 'Salary', 'Experience'];
  }

  const missing: string[] = [];

  // Title
  const title = job.title ? String(job.title).trim() : '';
  if (!title || title.toLowerCase() === 'untitled position') {
    missing.push('Title');
  }

  // Company / Employer
  const company = job.company ? String(job.company).trim() : '';
  if (!company) {
    missing.push('Company');
  }

  // Location: city, province, region, country, or location
  const hasCity = Boolean(job.city && String(job.city).trim());
  const hasProvince = Boolean(job.province && String(job.province).trim());
  const hasRegion = Boolean(job.region && String(job.region).trim() && job.region !== 'Global');
  const hasCountry = Boolean((job as any).country && String((job as any).country).trim());
  const hasLocation = Boolean((job as any).location && String((job as any).location).trim());
  if (!hasCity && !hasProvince && !hasRegion && !hasCountry && !hasLocation) {
    missing.push('Location');
  }

  // Job Type
  const jobType = job.jobType ? String(job.jobType).trim() : '';
  if (!jobType) {
    missing.push('Job Type');
  }

  // Salary
  if (isGenericOrFallbackSalary(job.salary)) {
    missing.push('Salary');
  }

  // Experience
  const exp = job.experienceLevel ? String(job.experienceLevel).trim() : '';
  if (!exp) {
    missing.push('Experience');
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
