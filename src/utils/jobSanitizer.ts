import { Job } from '../types/job';

/**
 * Strips any mentions of "scraped", "AI scraped", "harvested", "extracted from portal", etc.
 * from public-facing job data so users see a pristine, native job listing without any trace of scraping.
 */
export function sanitizeJobTitle(title: string): string {
  if (!title) return '';
  return title
    .replace(/\s*\(\s*AI\s*Scraped\s*\)/gi, '')
    .replace(/\s*\(\s*Scraped\s*\)/gi, '')
    .replace(/\s*\[\s*AI\s*Scraped\s*\]/gi, '')
    .replace(/\s*\[\s*Scraped\s*\]/gi, '')
    .replace(/\s*-\s*AI\s*Scraped/gi, '')
    .replace(/\s*-\s*Scraped/gi, '')
    .replace(/\bAI\s*Scraped\b/gi, '')
    .replace(/\bScraped\b/gi, '')
    .trim();
}

export function sanitizeJobCompanyName(company: string): string {
  if (!company) return '';
  return company
    .replace(/\s*\(via\s+[^\)]+\)/gi, '')
    .replace(/\s*\(scraped[^\)]*\)/gi, '')
    .trim();
}

export function sanitizeJobDescription(description: string): string {
  if (!description) return '';
  let clean = description
    .replace(/^Automated job scraped from[^\n]*\n*/gim, '')
    .replace(/^Automated job extracted from[^\n]*\n*/gim, '')
    .replace(/^Automated ingestion from[^\n]*\n*/gim, '')
    .replace(/^Automated extraction payload[^\n]*\n*/gim, '')
    .replace(/^Automated backup ingestion[^\n]*\n*/gim, '')
    .replace(/^Scraped from[^\n]*\n*/gim, '')
    .replace(/^Scraped live matching target payload[^\n]*\n*/gim, '')
    .replace(/^Harvested from[^\n]*\n*/gim, '')
    .replace(/^LinkedIn Global Remote Developer Feed extraction\.\s*/gim, '')
    .replace(/Federal Govt announcement scraped from FPSC Official Portal\.\s*/gim, 'Official Federal Public Service Commission recruitment. ')
    .replace(/\bAI\s*Scraped\b/gi, '')
    .replace(/\bscraped from\b/gi, 'sourced for')
    .replace(/\bscraped\b/gi, '')
    .trim();

  if (!clean || clean.length < 15) {
    clean = 'We are seeking a talented professional to join our team. The ideal candidate will bring strong domain expertise, proactive problem-solving abilities, and a collaborative mindset to deliver high-impact results.';
  }

  return clean;
}

export function sanitizeJobTags(tags: string[]): string[] {
  if (!tags || !Array.isArray(tags)) return [];
  return tags.filter(tag => {
    if (!tag) return false;
    const lower = tag.toLowerCase().trim();
    if (lower === 'scraped' || lower.includes('scraped') || lower.includes('scraper')) return false;
    if (lower === 'ai analyzed' || lower === 'ai-analyzed' || lower === 'ai scraped' || lower === 'ai-scraped') return false;
    return true;
  });
}

export function sanitizeJob(job: Job): Job {
  if (!job) return job;
  return {
    ...job,
    title: sanitizeJobTitle(job.title),
    company: sanitizeJobCompanyName(job.company),
    description: sanitizeJobDescription(job.description),
    tags: sanitizeJobTags(job.tags)
  };
}
