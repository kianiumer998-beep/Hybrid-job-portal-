import * as cheerio from 'cheerio';
import { Currency, Region } from '../types/job';

export interface ScraperTargetConfig {
  id: string;
  name: string;
  url: string;
  keywords: string;
  interval: '15m' | '1h' | '6h' | '24h' | '7d';
  autoApprove: boolean;
  status: 'Active Scheduled' | 'Paused';
  lastRun?: string;
  scrapedCount: number;
  isUniversalKeywordless?: boolean;
  isNewspaperClippingPortal?: boolean;
  isGovtPortal?: boolean;
  lastStartedAt?: string;
  lastSuccessfulScrapeAt?: string;
  lastCompletedAt?: string;
  lastRunId?: string;
  healthStatus?: 'healthy' | 'warning' | 'error';
  lastErrorMessage?: string;
}

export interface ScrapedJobResult {
  id: string;
  title: string;
  company: string;
  jobType: 'Remote' | 'On-site' | 'Hybrid';
  region: Region;
  province?: string;
  city?: string;
  district?: string;
  salary: string;
  currency: Currency;
  experienceLevel: 'Junior' | 'Mid' | 'Senior' | 'Lead';
  department: string;
  tags: string[];
  description: string;
  requirements: string[];
  benefits: string[];
  postedAt: string;
  datePosted?: string;
  deadlineDate?: string;
  applicationsCount: number;
  status: 'Approved' | 'Pending';
  sourceUrl: string;
  sourceJobId?: string;
  originalApplyUrl?: string;

  // Government extensions
  isGovtJob?: boolean;
  govtDepartment?: string;
  govtScale?: string;
  govtCategory?: 'Federal' | 'Provincial' | 'Defense' | 'Healthcare' | 'Education' | 'Public Sector';

  // Newspaper clipping extensions
  isNewspaperAd?: boolean;
  newspaperName?: string;
  clippingImageUrl?: string;
  newspaperDate?: string;
}

export interface ScrapeOptions {
  page?: number;
  startPage?: number;
  endPage?: number;
  sinceTimestamp?: string;
}

/**
 * Deduplication helper
 */
export function deduplicateJobs<T extends { title: string; company: string; sourceUrl?: string }>(
  existingList: T[],
  newList: T[]
): T[] {
  const existingKeys = new Set(
    existingList.map(item =>
      `${(item.title || '').trim().toLowerCase()}_${(item.company || '').trim().toLowerCase()}_${(item.sourceUrl || '').trim().toLowerCase()}`
    )
  );

  return newList.filter(item => {
    const key = `${(item.title || '').trim().toLowerCase()}_${(item.company || '').trim().toLowerCase()}_${(item.sourceUrl || '').trim().toLowerCase()}`;
    if (existingKeys.has(key)) {
      return false;
    }
    existingKeys.add(key);
    return true;
  });
}

/**
 * Extract schema.org JobPosting JSON-LD if present
 */
function extractJsonLdJobs(html: string, baseUrl: string, config: ScraperTargetConfig): ScrapedJobResult[] {
  const $ = cheerio.load(html);
  const results: ScrapedJobResult[] = [];

  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const content = $(el).html();
      if (!content) return;
      const parsed = JSON.parse(content);
      const items = Array.isArray(parsed) ? parsed : (parsed['@graph'] || [parsed]);

      for (const item of items) {
        if (item['@type'] === 'JobPosting' || item['@type']?.includes?.('JobPosting')) {
          const title = (item.title || item.name || '').trim();
          if (!title) continue;

          const company = item.hiringOrganization?.name || config.name;
          const description = (item.description || '').replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();

          // Location handling
          let city = '';
          let province = '';
          let region: Region = 'Global';
          if (item.jobLocation?.address) {
            const addr = item.jobLocation.address;
            city = addr.addressLocality || '';
            province = addr.addressRegion || '';
            const country = addr.addressCountry || '';
            if (country === 'PK' || country.toLowerCase().includes('pakistan')) region = 'Pakistan';
            else if (country === 'US' || country.toLowerCase().includes('united states')) region = 'US';
            else if (country === 'AE' || country.toLowerCase().includes('emirates')) region = 'UAE';
            else if (country === 'SA' || country.toLowerCase().includes('saudi')) region = 'Saudi Arabia';
            else if (country === 'GB' || country.toLowerCase().includes('uk')) region = 'UK';
          }

          // Remote classification (Google Jobs standard: TELECOMMUTE)
          const isRemote = item.jobLocationType === 'TELECOMMUTE' ||
            item.applicantLocationRequirements !== undefined ||
            title.toLowerCase().includes('remote') ||
            description.toLowerCase().includes('remote');

          const jobType = isRemote ? 'Remote' : 'On-site';

          // Factual salary - do NOT invent if missing!
          let salary = 'Salary not disclosed';
          let currency: Currency = 'PKR';
          if (item.baseSalary) {
            const val = item.baseSalary.value;
            currency = (item.baseSalary.currency || 'USD') as Currency;
            if (typeof val === 'number') {
              salary = `${currency} ${val.toLocaleString()}`;
            } else if (val && (val.minValue || val.maxValue)) {
              salary = `${currency} ${val.minValue || 0} - ${val.maxValue || 0}`;
            }
          }

          results.push({
            id: `scraped-${config.id}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
            title,
            company,
            jobType,
            region,
            province: province || undefined,
            city: city || undefined,
            salary,
            currency,
            experienceLevel: title.toLowerCase().includes('senior') ? 'Senior' : title.toLowerCase().includes('junior') ? 'Junior' : 'Mid',
            department: config.keywords?.split(',')[0]?.trim() || 'General',
            tags: [config.name, jobType, region],
            description: description.slice(0, 1500) || `Job opportunity at ${company}.`,
            requirements: [],
            benefits: [],
            postedAt: item.datePosted || 'Recent',
            datePosted: item.datePosted,
            deadlineDate: item.validThrough,
            applicationsCount: 0,
            status: config.autoApprove ? 'Approved' : 'Pending',
            sourceUrl: item.url || baseUrl,
            sourceJobId: item.identifier?.value || undefined,
            originalApplyUrl: item.url || baseUrl,
            isGovtJob: config.isGovtPortal
          });
        }
      }
    } catch {
      // Ignore malformed JSON-LD block
    }
  });

  return results;
}

/**
 * Extracts jobs from ATS portals (Greenhouse, Lever, etc.)
 */
async function scrapeAtsPortal(config: ScraperTargetConfig): Promise<ScrapedJobResult[]> {
  const url = config.url.toLowerCase();

  // Greenhouse API adapter
  if (url.includes('boards.greenhouse.io') || url.includes('api.greenhouse.io')) {
    const boardToken = config.url.split('boards.greenhouse.io/')[1]?.split('/')[0]?.split('?')[0];
    if (boardToken) {
      try {
        const apiUrl = `https://boards-api.greenhouse.io/v1/boards/${boardToken}/jobs?content=true`;
        const res = await fetch(apiUrl, { headers: { 'Accept': 'application/json' } });
        if (res.ok) {
          const data = await res.json();
          if (data.jobs && Array.isArray(data.jobs)) {
            return data.jobs.slice(0, 20).map((j: any) => ({
              id: `scraped-${config.id}-${j.id}`,
              title: j.title || 'Untitled Role',
              company: config.name,
              jobType: (j.location?.name || '').toLowerCase().includes('remote') ? 'Remote' : 'On-site',
              region: (j.location?.name || '').toLowerCase().includes('pakistan') ? 'Pakistan' : 'Global',
              city: j.location?.name || undefined,
              salary: 'Salary not disclosed',
              currency: 'USD' as Currency,
              experienceLevel: (j.title || '').toLowerCase().includes('senior') ? 'Senior' : 'Mid',
              department: j.departments?.[0]?.name || config.keywords || 'Engineering',
              tags: [config.name, j.departments?.[0]?.name || 'Tech'],
              description: (j.content || '').replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').slice(0, 1500) || 'Full job details available on portal.',
              requirements: [],
              benefits: [],
              postedAt: j.updated_at ? new Date(j.updated_at).toLocaleDateString() : 'Recent',
              datePosted: j.updated_at,
              applicationsCount: 0,
              status: config.autoApprove ? 'Approved' : 'Pending',
              sourceUrl: j.absolute_url || config.url,
              sourceJobId: String(j.id),
              originalApplyUrl: j.absolute_url || config.url
            }));
          }
        }
      } catch (err) {
        console.warn(`[ATS Adapter] Greenhouse API fetch failed for ${config.url}:`, err);
      }
    }
  }

  // Lever API adapter
  if (url.includes('jobs.lever.co')) {
    const siteName = config.url.split('jobs.lever.co/')[1]?.split('/')[0]?.split('?')[0];
    if (siteName) {
      try {
        const apiUrl = `https://api.lever.co/v0/postings/${siteName}?mode=json`;
        const res = await fetch(apiUrl, { headers: { 'Accept': 'application/json' } });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            return data.slice(0, 20).map((j: any) => ({
              id: `scraped-${config.id}-${j.id}`,
              title: j.text || 'Untitled Role',
              company: config.name,
              jobType: (j.categories?.location || '').toLowerCase().includes('remote') || j.workplaceType === 'remote' ? 'Remote' : 'On-site',
              region: (j.categories?.location || '').toLowerCase().includes('pakistan') ? 'Pakistan' : 'Global',
              city: j.categories?.location || undefined,
              salary: 'Salary not disclosed',
              currency: 'USD' as Currency,
              experienceLevel: (j.text || '').toLowerCase().includes('senior') ? 'Senior' : 'Mid',
              department: j.categories?.team || j.categories?.department || 'General',
              tags: [config.name, j.categories?.team || 'General'],
              description: (j.descriptionPlain || j.description || '').slice(0, 1500) || 'Full job details on posting.',
              requirements: [],
              benefits: [],
              postedAt: j.createdAt ? new Date(j.createdAt).toLocaleDateString() : 'Recent',
              datePosted: j.createdAt ? new Date(j.createdAt).toISOString() : undefined,
              applicationsCount: 0,
              status: config.autoApprove ? 'Approved' : 'Pending',
              sourceUrl: j.hostedUrl || j.applyUrl || config.url,
              sourceJobId: String(j.id),
              originalApplyUrl: j.applyUrl || j.hostedUrl || config.url
            }));
          }
        }
      } catch (err) {
        console.warn(`[ATS Adapter] Lever API fetch failed for ${config.url}:`, err);
      }
    }
  }

  return [];
}

/**
 * Executes factual, non-invented scraping for a target URL
 */
export async function scrapeTargetPortal(
  config: ScraperTargetConfig,
  options: ScrapeOptions = {}
): Promise<ScrapedJobResult[]> {
  try {
    // 1. Try ATS adapter first if matched
    const atsResults = await scrapeAtsPortal(config);
    if (atsResults.length > 0) {
      return filterByOptions(atsResults, options);
    }

    // 2. Fetch target URL with pagination support if specified
    let targetUrl = config.url;
    if (options.page && options.page > 1) {
      const urlObj = new URL(targetUrl);
      urlObj.searchParams.set('page', String(options.page));
      targetUrl = urlObj.toString();
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const response = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,application/json,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,ur;q=0.8'
      }
    });
    clearTimeout(timeout);

    if (!response.ok) {
      console.warn(`[Scraper Engine] Target ${config.name} (${targetUrl}) returned status ${response.status}.`);
      return [];
    }

    const html = await response.text();

    // 3. Try extracting JSON-LD structured data (highest fidelity)
    const jsonLdJobs = extractJsonLdJobs(html, targetUrl, config);
    if (jsonLdJobs.length > 0) {
      return filterByOptions(jsonLdJobs, options);
    }

    // 4. HTML Semantic Parsing
    const $ = cheerio.load(html);
    const extractedJobs: ScrapedJobResult[] = [];

    // Identify candidate job card containers
    const selectors = [
      'article.job',
      '.job-card',
      '.job-listing',
      '.vacancy-item',
      '.career-item',
      '.opening-item',
      'li[data-job-id]',
      'div[itemtype*="JobPosting"]',
      '.table-jobs tbody tr',
      '.views-row'
    ];

    let matchedContainer = false;

    for (const sel of selectors) {
      const elements = $(sel);
      if (elements.length > 0) {
        matchedContainer = true;
        elements.each((_, el) => {
          if (extractedJobs.length >= 25) return;
          const container = $(el);

          // Find link and title
          const linkEl = container.find('a[href]').first();
          const title = (container.find('h2, h3, h4, .title, .job-title').first().text() || linkEl.text()).trim();
          if (!title || title.length < 3 || title.length > 150) return;

          let href = linkEl.attr('href') || '';
          if (href && !href.startsWith('http')) {
            try {
              href = new URL(href, config.url).toString();
            } catch {}
          }

          const company = (container.find('.company, .organization, .employer, .company-name').first().text().trim()) || config.name;
          const location = (container.find('.location, .city, .region').first().text().trim()) || '';
          const snippet = (container.find('.description, .snippet, p').first().text().trim()) || '';

          // Detect factual job type
          const combined = `${title} ${location} ${snippet}`.toLowerCase();
          const isRemote = combined.includes('remote') || combined.includes('work from home');
          const isHybrid = combined.includes('hybrid');
          const jobType = isRemote ? 'Remote' : isHybrid ? 'Hybrid' : 'On-site';

          // Extract region from location or keywords
          let region: Region = 'Global';
          if (location.toLowerCase().includes('pakistan') || config.name.toLowerCase().includes('pakistan') || config.isGovtPortal) {
            region = 'Pakistan';
          } else if (location.toLowerCase().includes('uae') || location.toLowerCase().includes('dubai')) {
            region = 'UAE';
          } else if (location.toLowerCase().includes('us') || location.toLowerCase().includes('united states')) {
            region = 'US';
          }

          // Rule 10: NEVER invent salary! Only use if explicitly presented
          let salary = 'Salary not disclosed';
          const salaryMatch = combined.match(/(?:pkr|rs|usd|\$|aed|sar|£|€)\s?[\d,]+(?:\s?-\s?[\d,]+)?(?:\s?(?:\/|per)?\s?(?:mo|month|yr|year))?/i);
          if (salaryMatch) {
            salary = salaryMatch[0];
          }

          extractedJobs.push({
            id: `scraped-${config.id}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
            title,
            company,
            jobType,
            region,
            city: location || undefined,
            salary,
            currency: region === 'Pakistan' ? 'PKR' : 'USD',
            experienceLevel: title.toLowerCase().includes('senior') ? 'Senior' : title.toLowerCase().includes('junior') ? 'Junior' : 'Mid',
            department: config.keywords?.split(',')[0]?.trim() || 'General',
            tags: [config.name, jobType, region],
            description: snippet || `Official vacancy listed on ${config.name}. Visit original source URL for complete qualifications.`,
            requirements: [],
            benefits: [],
            postedAt: 'Recent',
            applicationsCount: 0,
            status: config.autoApprove ? 'Approved' : 'Pending',
            sourceUrl: href || config.url,
            originalApplyUrl: href || config.url,
            isGovtJob: config.isGovtPortal
          });
        });
        if (extractedJobs.length > 0) break;
      }
    }

    // If no dedicated container matched, search for distinct job links
    if (!matchedContainer || extractedJobs.length === 0) {
      $('a[href]').each((_, el) => {
        if (extractedJobs.length >= 15) return;
        const a = $(el);
        const text = a.text().trim();
        const href = a.attr('href') || '';

        // Check if link looks like a job posting
        const isJobLink = (
          (href.includes('/job/') || href.includes('/careers/') || href.includes('/vacancy/') || href.includes('/post/')) &&
          text.length > 5 &&
          text.length < 100 &&
          !text.toLowerCase().includes('apply now') &&
          !text.toLowerCase().includes('view all')
        );

        if (isJobLink) {
          let fullUrl = href;
          if (!href.startsWith('http')) {
            try {
              fullUrl = new URL(href, config.url).toString();
            } catch {}
          }

          extractedJobs.push({
            id: `scraped-${config.id}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
            title: text,
            company: config.name,
            jobType: text.toLowerCase().includes('remote') ? 'Remote' : 'On-site',
            region: config.isGovtPortal ? 'Pakistan' : 'Global',
            salary: 'Salary not disclosed',
            currency: config.isGovtPortal ? 'PKR' : 'USD',
            experienceLevel: text.toLowerCase().includes('senior') ? 'Senior' : 'Mid',
            department: config.keywords?.split(',')[0]?.trim() || 'General',
            tags: [config.name],
            description: `Listing from ${config.name}: ${text}. Refer to original URL for requirements and application process.`,
            requirements: [],
            benefits: [],
            postedAt: 'Recent',
            applicationsCount: 0,
            status: config.autoApprove ? 'Approved' : 'Pending',
            sourceUrl: fullUrl,
            originalApplyUrl: fullUrl,
            isGovtJob: config.isGovtPortal
          });
        }
      });
    }

    // Return factual results, NEVER generate synthetic fake vacancies on zero results!
    return filterByOptions(extractedJobs, options);
  } catch (error: any) {
    console.warn(`[Scraper Engine] Scraping error for ${config.name} (${config.url}):`, error?.message || error);
    // Return empty array on failure, do NOT invent fake jobs
    return [];
  }
}

/**
 * Filter results by scrape options (sinceTimestamp, datePosted, etc.)
 */
function filterByOptions(jobs: ScrapedJobResult[], options: ScrapeOptions): ScrapedJobResult[] {
  let filtered = jobs;

  if (options.sinceTimestamp) {
    const cutoff = new Date(options.sinceTimestamp).getTime();
    if (!isNaN(cutoff)) {
      filtered = filtered.filter(j => {
        if (!j.datePosted) return true; // Keep if no exact date to avoid missing jobs
        const postTime = new Date(j.datePosted).getTime();
        return isNaN(postTime) || postTime >= cutoff;
      });
    }
  }

  return filtered;
}
