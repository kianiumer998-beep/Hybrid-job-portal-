import * as cheerio from 'cheerio';
import { Currency, Region } from '../types/job';
import { safeFetchWithRetry, validateSafeScrapeUrl } from '../../server/utils/ssrfProtection';
import { parsePdfFromUrl } from '../../server/services/pdfParserEngine';

export interface ScraperTargetConfig {
  id: string;
  name: string;
  url?: string;
  portalUrl?: string;
  keywords?: string;
  interval?: '15m' | '30m' | '1h' | '6h' | '24h' | '7d';
  autoApprove?: boolean;
  status?: 'Active Scheduled' | 'Paused';
  lastRun?: string;
  scrapedCount?: number;
  isUniversalKeywordless?: boolean;
  isNewspaperClippingPortal?: boolean;
  isGovtPortal?: boolean;
  formatType?: string;
  pdfUrl?: string;
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

  // Verified Source Evidence
  sourcePortal?: string;
  extractionMethod: string;
  scrapeRunId?: string;
  scrapedAt?: string;

  // Government & PDF extensions
  isGovtJob?: boolean;
  govtDepartment?: string;
  govtScale?: string;
  govtCategory?: 'Federal' | 'Provincial' | 'Defense' | 'Healthcare' | 'Education' | 'Public Sector';
  isPdfScraped?: boolean;
  pdfFileName?: string;
  pdfSourceUrl?: string;
  pdfCaseNumber?: string;
  pdfTotalVacanciesInCase?: number;
  domicileQuota?: string;
  ageRelaxationNote?: string;
  pdfParserEngine?: string;

  // Newspaper clipping extensions
  isNewspaperAd?: boolean;
  newspaperName?: string;
  clippingImageUrl?: string;
  newspaperDate?: string;

  // Next page pagination discovery
  nextPageUrl?: string;
}

export interface ScrapeOptions {
  page?: number;
  startPage?: number;
  endPage?: number;
  sinceTimestamp?: string;
  runId?: string;
}

export interface ScrapeExecutionResult {
  jobs: ScrapedJobResult[];
  nextPageUrl?: string;
  extractionMethod: string;
  totalFoundOnPage: number;
}

/**
 * Deduplication helper across array of jobs
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
 * Normalizes an arbitrary relative or absolute URL safely.
 */
function resolveUrl(relativeOrAbsolute: string, baseUrl: string): string {
  try {
    return new URL(relativeOrAbsolute, baseUrl).toString();
  } catch {
    return relativeOrAbsolute;
  }
}

/**
 * Detects next-page pagination URL from HTML with semantic selectors.
 */
export function extractNextPageUrl(html: string, currentUrl: string): string | null {
  try {
    const $ = cheerio.load(html);

    // 1. Check standard HTML link rel="next"
    const relNext = $('link[rel="next"]').attr('href') || $('a[rel="next"]').attr('href');
    if (relNext) {
      return resolveUrl(relNext, currentUrl);
    }

    // 2. Check aria-label="Next" or title="Next"
    const ariaNext = $('a[aria-label*="Next" i], a[aria-label*="اگلا" i], a[title*="Next" i]').attr('href');
    if (ariaNext && !ariaNext.startsWith('#') && !ariaNext.startsWith('javascript:')) {
      return resolveUrl(ariaNext, currentUrl);
    }

    // 3. Check pagination next button classes
    const classNext = $('.pagination .next a, .pager .next a, li.next a, li.pagination-next a, a.next-page, a.page-next').attr('href');
    if (classNext && !classNext.startsWith('#') && !classNext.startsWith('javascript:')) {
      return resolveUrl(classNext, currentUrl);
    }

    // 4. Look for anchor containing text "Next" or "اگلا"
    let textNextHref: string | null = null;
    $('a').each((_, el) => {
      if (textNextHref) return;
      const text = $(el).text().trim().toLowerCase();
      if (text === 'next' || text === 'next >' || text === 'next »' || text === 'اگلا' || text === 'اگلا صفحہ') {
        const href = $(el).attr('href');
        if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
          textNextHref = resolveUrl(href, currentUrl);
        }
      }
    });

    return textNextHref;
  } catch {
    return null;
  }
}

/**
 * ADAPTER 1: Greenhouse API Adapter (boards-api.greenhouse.io)
 */
async function scrapeGreenhouseApi(config: ScraperTargetConfig, options: ScrapeOptions): Promise<ScrapeExecutionResult | null> {
  const targetUrl = config.url || config.portalUrl || '';
  if (!targetUrl) return null;
  const url = targetUrl.toLowerCase();
  if (!url.includes('boards.greenhouse.io') && !url.includes('api.greenhouse.io')) {
    return null;
  }

  let boardToken = '';
  if (url.includes('boards.greenhouse.io/')) {
    boardToken = targetUrl.split('boards.greenhouse.io/')[1]?.split('/')[0]?.split('?')[0];
  } else if (url.includes('api.greenhouse.io/v1/boards/')) {
    boardToken = targetUrl.split('api.greenhouse.io/v1/boards/')[1]?.split('/')[0]?.split('?')[0];
  }

  if (!boardToken) return null;

  try {
    const apiUrl = `https://boards-api.greenhouse.io/v1/boards/${boardToken}/jobs?content=true`;
    const res = await safeFetchWithRetry(apiUrl, { headers: { 'Accept': 'application/json' } }, 15000);
    if (!res.ok) return null;

    const data: any = await res.json();
    if (!data || !Array.isArray(data.jobs)) return { jobs: [], extractionMethod: 'greenhouse_api', totalFoundOnPage: 0 };

    const jobs: ScrapedJobResult[] = data.jobs.map((j: any) => {
      const locName = j.location?.name || '';
      const isRemote = locName.toLowerCase().includes('remote') || (j.title || '').toLowerCase().includes('remote');
      const isPk = locName.toLowerCase().includes('pakistan') || (config.keywords || '').toLowerCase().includes('pakistan');
      const cleanDesc = (j.content || '').replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();

      return {
        id: `gh-${config.id}-${j.id}`,
        title: (j.title || '').trim() || 'Untitled Position',
        company: config.name,
        jobType: isRemote ? 'Remote' : 'On-site',
        region: isPk ? 'Pakistan' : 'Global',
        city: locName || undefined,
        salary: 'Salary not disclosed',
        currency: 'USD' as Currency,
        experienceLevel: (j.title || '').toLowerCase().includes('senior') ? 'Senior' : (j.title || '').toLowerCase().includes('lead') ? 'Lead' : 'Mid',
        department: j.departments?.[0]?.name || config.keywords || 'General',
        tags: [config.name, 'Greenhouse ATS', isRemote ? 'Remote' : 'On-site'],
        description: cleanDesc.slice(0, 1500) || `Official job listing on ${config.name} careers portal.`,
        requirements: [],
        benefits: [],
        postedAt: j.updated_at ? new Date(j.updated_at).toLocaleDateString() : 'Recent',
        datePosted: j.updated_at,
        applicationsCount: 0,
        status: config.autoApprove ? 'Approved' : 'Pending',
        sourceUrl: j.absolute_url || targetUrl,
        sourceJobId: String(j.id),
        originalApplyUrl: j.absolute_url || targetUrl,
        sourcePortal: config.name,
        extractionMethod: 'greenhouse_api',
        scrapeRunId: options.runId,
        scrapedAt: new Date().toISOString()
      };
    });

    return {
      jobs,
      extractionMethod: 'greenhouse_api',
      totalFoundOnPage: jobs.length
    };
  } catch (err: any) {
    console.warn(`[Greenhouse Adapter] Extraction failed for ${targetUrl}:`, err?.message || err);
    return { jobs: [], extractionMethod: 'greenhouse_api', totalFoundOnPage: 0 };
  }
}

/**
 * ADAPTER 2: Lever API Adapter (api.lever.co)
 */
async function scrapeLeverApi(config: ScraperTargetConfig, options: ScrapeOptions): Promise<ScrapeExecutionResult | null> {
  const targetUrl = config.url || config.portalUrl || '';
  if (!targetUrl) return null;
  const url = targetUrl.toLowerCase();
  if (!url.includes('jobs.lever.co')) {
    return null;
  }

  const siteName = targetUrl.split('jobs.lever.co/')[1]?.split('/')[0]?.split('?')[0];
  if (!siteName) return null;

  try {
    const apiUrl = `https://api.lever.co/v0/postings/${siteName}?mode=json`;
    const res = await safeFetchWithRetry(apiUrl, { headers: { 'Accept': 'application/json' } }, 15000);
    if (!res.ok) return null;

    const data: any = await res.json();
    if (!Array.isArray(data)) return { jobs: [], extractionMethod: 'lever_api', totalFoundOnPage: 0 };

    const jobs: ScrapedJobResult[] = data.map((j: any) => {
      const loc = j.categories?.location || '';
      const isRemote = loc.toLowerCase().includes('remote') || j.workplaceType === 'remote';
      const isPk = loc.toLowerCase().includes('pakistan');

      return {
        id: `lever-${config.id}-${j.id}`,
        title: (j.text || '').trim() || 'Untitled Position',
        company: config.name,
        jobType: isRemote ? 'Remote' : 'On-site',
        region: isPk ? 'Pakistan' : 'Global',
        city: loc || undefined,
        salary: 'Salary not disclosed',
        currency: 'USD' as Currency,
        experienceLevel: (j.text || '').toLowerCase().includes('senior') ? 'Senior' : 'Mid',
        department: j.categories?.team || j.categories?.department || 'General',
        tags: [config.name, 'Lever ATS', isRemote ? 'Remote' : 'On-site'],
        description: (j.descriptionPlain || j.description || '').replace(/<[^>]*>?/gm, ' ').slice(0, 1500) || `Official vacancy on ${config.name}.`,
        requirements: [],
        benefits: [],
        postedAt: j.createdAt ? new Date(j.createdAt).toLocaleDateString() : 'Recent',
        datePosted: j.createdAt ? new Date(j.createdAt).toISOString() : undefined,
        applicationsCount: 0,
        status: config.autoApprove ? 'Approved' : 'Pending',
        sourceUrl: j.hostedUrl || j.applyUrl || targetUrl,
        sourceJobId: String(j.id),
        originalApplyUrl: j.applyUrl || j.hostedUrl || targetUrl,
        sourcePortal: config.name,
        extractionMethod: 'lever_api',
        scrapeRunId: options.runId,
        scrapedAt: new Date().toISOString()
      };
    });

    return {
      jobs,
      extractionMethod: 'lever_api',
      totalFoundOnPage: jobs.length
    };
  } catch (err: any) {
    console.warn(`[Lever Adapter] Extraction failed for ${targetUrl}:`, err?.message || err);
    return { jobs: [], extractionMethod: 'lever_api', totalFoundOnPage: 0 };
  }
}

/**
 * ADAPTER 3: SmartRecruiters & Ashby REST APIs
 */
async function scrapeRestJobApis(config: ScraperTargetConfig, options: ScrapeOptions): Promise<ScrapeExecutionResult | null> {
  const targetUrl = config.url || config.portalUrl || '';
  if (!targetUrl) return null;
  const url = targetUrl.toLowerCase();

  // SmartRecruiters
  if (url.includes('smartrecruiters.com/')) {
    const company = targetUrl.split('smartrecruiters.com/')[1]?.split('/')[0]?.split('?')[0];
    if (company && !['jobs', 'careers', 'search'].includes(company)) {
      try {
        const apiUrl = `https://api.smartrecruiters.com/v1/companies/${company}/postings`;
        const res = await safeFetchWithRetry(apiUrl, { headers: { 'Accept': 'application/json' } }, 15000);
        if (res.ok) {
          const data: any = await res.json();
          if (data && Array.isArray(data.content)) {
            const jobs: ScrapedJobResult[] = data.content.map((j: any) => ({
              id: `sr-${config.id}-${j.id}`,
              title: j.name || 'Untitled Position',
              company: j.company?.name || config.name,
              jobType: (j.location?.remote || (j.name || '').toLowerCase().includes('remote')) ? 'Remote' : 'On-site',
              region: (j.location?.country || '').toLowerCase() === 'pk' ? 'Pakistan' : 'Global',
              city: j.location?.city || undefined,
              salary: 'Salary not disclosed',
              currency: 'USD' as Currency,
              experienceLevel: (j.experienceLevel?.id === 'senior' || (j.name || '').toLowerCase().includes('senior')) ? 'Senior' : 'Mid',
              department: j.department?.label || 'General',
              tags: [config.name, 'SmartRecruiters'],
              description: `Position at ${config.name}. Apply on official portal.`,
              requirements: [],
              benefits: [],
              postedAt: j.releasedDate ? new Date(j.releasedDate).toLocaleDateString() : 'Recent',
              datePosted: j.releasedDate,
              applicationsCount: 0,
              status: config.autoApprove ? 'Approved' : 'Pending',
              sourceUrl: `https://jobs.smartrecruiters.com/${company}/${j.id}`,
              sourceJobId: String(j.id),
              originalApplyUrl: `https://jobs.smartrecruiters.com/${company}/${j.id}`,
              sourcePortal: config.name,
              extractionMethod: 'smartrecruiters_api',
              scrapeRunId: options.runId,
              scrapedAt: new Date().toISOString()
            }));

            return { jobs, extractionMethod: 'smartrecruiters_api', totalFoundOnPage: jobs.length };
          }
        }
      } catch {}
    }
  }

  // Ashby
  if (url.includes('jobs.ashbyhq.com/')) {
    const company = targetUrl.split('jobs.ashbyhq.com/')[1]?.split('/')[0]?.split('?')[0];
    if (company) {
      try {
        const apiUrl = `https://api.ashbyhq.com/posting-api/job-board/${company}`;
        const res = await safeFetchWithRetry(apiUrl, { headers: { 'Accept': 'application/json' } }, 15000);
        if (res.ok) {
          const data: any = await res.json();
          if (data && Array.isArray(data.jobs)) {
            const jobs: ScrapedJobResult[] = data.jobs.map((j: any) => ({
              id: `ashby-${config.id}-${j.id}`,
              title: j.title || 'Untitled Position',
              company: config.name,
              jobType: j.isRemote ? 'Remote' : 'On-site',
              region: (j.location || '').toLowerCase().includes('pakistan') ? 'Pakistan' : 'Global',
              city: j.location || undefined,
              salary: 'Salary not disclosed',
              currency: 'USD' as Currency,
              experienceLevel: (j.title || '').toLowerCase().includes('senior') ? 'Senior' : 'Mid',
              department: j.department || 'General',
              tags: [config.name, 'Ashby ATS'],
              description: (j.descriptionHtml || '').replace(/<[^>]*>?/gm, ' ').slice(0, 1500) || `Official listing at ${config.name}`,
              requirements: [],
              benefits: [],
              postedAt: j.publishedDate ? new Date(j.publishedDate).toLocaleDateString() : 'Recent',
              datePosted: j.publishedDate,
              applicationsCount: 0,
              status: config.autoApprove ? 'Approved' : 'Pending',
              sourceUrl: j.jobUrl || targetUrl,
              sourceJobId: String(j.id),
              originalApplyUrl: j.jobUrl || targetUrl,
              sourcePortal: config.name,
              extractionMethod: 'ashby_api',
              scrapeRunId: options.runId,
              scrapedAt: new Date().toISOString()
            }));

            return { jobs, extractionMethod: 'ashby_api', totalFoundOnPage: jobs.length };
          }
        }
      } catch {}
    }
  }

  return null;
}

/**
 * ADAPTER 4: Government PDF Parser (Connected to pdfParserEngine)
 * Handles FPSC, PPSC, WAPDA, KPPSC, SPSC, BPSC, or any PDF recruitment gazette.
 */
async function scrapeGovernmentPdfPortal(config: ScraperTargetConfig, options: ScrapeOptions): Promise<ScrapeExecutionResult | null> {
  const effectiveUrl = config.url || config.portalUrl || config.pdfUrl || '';
  const isExplicitPdf =
    (config.formatType && config.formatType.includes('PDF')) ||
    (config.pdfUrl && config.pdfUrl.trim().length > 0) ||
    (effectiveUrl && effectiveUrl.toLowerCase().split('?')[0].endsWith('.pdf'));

  if (!isExplicitPdf) return null;

  const targetPdfUrl = (config.pdfUrl && config.pdfUrl.startsWith('http')) ? config.pdfUrl : effectiveUrl;
  if (!targetPdfUrl || !targetPdfUrl.startsWith('http')) return null;

  try {
    const pdfResult = await parsePdfFromUrl(targetPdfUrl, config.name);
    if (!pdfResult.success || !pdfResult.extractedJobs || pdfResult.extractedJobs.length === 0) {
      return {
        jobs: [],
        extractionMethod: 'government_pdf_engine',
        totalFoundOnPage: 0
      };
    }

    const jobs: ScrapedJobResult[] = pdfResult.extractedJobs.map(j => ({
      id: j.id,
      title: j.title,
      company: j.company || config.name,
      jobType: j.jobType || 'On-site',
      region: (j.region || 'Pakistan') as Region,
      salary: j.salary || 'Government Pay Scale',
      currency: 'PKR',
      experienceLevel: (j.experienceLevel || 'Mid') as any,
      department: j.department || config.name,
      tags: j.tags || [config.name, 'PDF Gazette'],
      description: j.description || `Official government vacancy extracted from ${pdfResult.fileName || 'recruitment notice'}.`,
      requirements: j.requirements || [],
      benefits: j.benefits || [],
      postedAt: j.postedAt || 'Recent',
      deadlineDate: j.deadlineDate,
      applicationsCount: 0,
      status: config.autoApprove ? 'Approved' : 'Pending',
      sourceUrl: targetPdfUrl,
      sourceJobId: j.pdfCaseNumber || undefined,
      originalApplyUrl: targetPdfUrl,
      sourcePortal: config.name,
      extractionMethod: 'government_pdf_engine',
      scrapeRunId: options.runId,
      scrapedAt: new Date().toISOString(),
      isGovtJob: true,
      govtDepartment: j.govtDepartment || config.name,
      govtScale: j.govtScale,
      govtCategory: j.govtCategory || 'Federal',
      isPdfScraped: true,
      pdfFileName: pdfResult.fileName,
      pdfSourceUrl: targetPdfUrl,
      pdfCaseNumber: j.pdfCaseNumber,
      pdfTotalVacanciesInCase: j.pdfTotalVacanciesInCase,
      domicileQuota: j.domicileQuota,
      ageRelaxationNote: j.ageRelaxationNote,
      pdfParserEngine: 'pdfplumber'
    }));

    return {
      jobs,
      extractionMethod: 'government_pdf_engine',
      totalFoundOnPage: jobs.length
    };
  } catch (err: any) {
    console.warn(`[PDF Adapter] Failed parsing PDF for ${config.name}:`, err?.message || err);
    return { jobs: [], extractionMethod: 'government_pdf_engine', totalFoundOnPage: 0 };
  }
}

/**
 * ADAPTER 5: JSON-LD Schema.org JobPosting Extractor
 */
function extractJsonLdJobs(html: string, baseUrl: string, config: ScraperTargetConfig, options: ScrapeOptions): ScrapedJobResult[] {
  const $ = cheerio.load(html);
  const results: ScrapedJobResult[] = [];

  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const content = $(el).html();
      if (!content) return;
      const parsed = JSON.parse(content);
      const items = Array.isArray(parsed) ? parsed : (parsed['@graph'] || [parsed]);

      for (const item of items) {
        if (item['@type'] === 'JobPosting' || (Array.isArray(item['@type']) && item['@type'].includes('JobPosting'))) {
          const title = (item.title || item.name || '').trim();
          if (!title || title.length < 3) continue;

          const company = item.hiringOrganization?.name || config.name;
          const description = (item.description || '').replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();

          let city = '';
          let province = '';
          let region: Region = 'Global';
          if (item.jobLocation?.address) {
            const addr = item.jobLocation.address;
            city = addr.addressLocality || '';
            province = addr.addressRegion || '';
            const country = (addr.addressCountry || '').toLowerCase();
            if (country === 'pk' || country.includes('pakistan')) region = 'Pakistan';
            else if (country === 'us' || country.includes('united states')) region = 'US';
            else if (country === 'ae' || country.includes('emirates')) region = 'UAE';
            else if (country === 'sa' || country.includes('saudi')) region = 'Saudi Arabia';
            else if (country === 'gb' || country.includes('uk')) region = 'UK';
          }

          const isRemote =
            item.jobLocationType === 'TELECOMMUTE' ||
            item.applicantLocationRequirements !== undefined ||
            title.toLowerCase().includes('remote') ||
            description.toLowerCase().includes('remote');

          const jobType = isRemote ? 'Remote' : 'On-site';

          // Factual salary handling: NEVER invent salary if missing
          let salary = 'Salary not disclosed';
          let currency: Currency = region === 'Pakistan' ? 'PKR' : 'USD';
          if (item.baseSalary) {
            const val = item.baseSalary.value;
            currency = (item.baseSalary.currency || currency) as Currency;
            if (typeof val === 'number') {
              salary = `${currency} ${val.toLocaleString()}`;
            } else if (val && (val.minValue || val.maxValue)) {
              salary = `${currency} ${val.minValue || 0} - ${val.maxValue || 0}`;
            }
          }

          results.push({
            id: `ld-${config.id}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
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
            tags: [config.name, jobType, region, 'JSON-LD Verified'],
            description: description.slice(0, 1500) || `Official vacancy listed on ${company}.`,
            requirements: [],
            benefits: [],
            postedAt: item.datePosted ? new Date(item.datePosted).toLocaleDateString() : 'Recent',
            datePosted: item.datePosted,
            deadlineDate: item.validThrough,
            applicationsCount: 0,
            status: config.autoApprove ? 'Approved' : 'Pending',
            sourceUrl: item.url || baseUrl,
            sourceJobId: item.identifier?.value || undefined,
            originalApplyUrl: item.url || baseUrl,
            sourcePortal: config.name,
            extractionMethod: 'json_ld',
            scrapeRunId: options.runId,
            scrapedAt: new Date().toISOString(),
            isGovtJob: config.isGovtPortal
          });
        }
      }
    } catch {
      // Skip invalid JSON-LD block
    }
  });

  return results;
}

/**
 * ADAPTER 6: JavaScript Websites Embedded State Extractor
 * Extracts server-rendered state (__NEXT_DATA__, __NUXT_DATA__, window.__INITIAL_STATE__)
 */
function extractEmbeddedStateJobs(html: string, currentUrl: string, config: ScraperTargetConfig, options: ScrapeOptions): ScrapedJobResult[] {
  const $ = cheerio.load(html);
  const results: ScrapedJobResult[] = [];

  // Next.js data
  const nextDataRaw = $('#__NEXT_DATA__').html();
  if (nextDataRaw) {
    try {
      const nextData = JSON.parse(nextDataRaw);
      const pageProps = nextData?.props?.pageProps;
      const candidateList = pageProps?.jobs || pageProps?.postings || pageProps?.vacancies || pageProps?.data?.jobs;
      if (Array.isArray(candidateList)) {
        for (const item of candidateList) {
          const title = item.title || item.name || item.jobTitle;
          if (!title || typeof title !== 'string') continue;

          results.push({
            id: `next-${config.id}-${item.id || Date.now().toString(36)}`,
            title: title.trim(),
            company: item.company || item.companyName || config.name,
            jobType: item.isRemote || (item.title || '').toLowerCase().includes('remote') ? 'Remote' : 'On-site',
            region: config.isGovtPortal ? 'Pakistan' : 'Global',
            city: item.city || item.location || undefined,
            salary: item.salary || 'Salary not disclosed',
            currency: 'USD' as Currency,
            experienceLevel: (item.title || '').toLowerCase().includes('senior') ? 'Senior' : 'Mid',
            department: item.department || 'General',
            tags: [config.name, 'Next.js SSR'],
            description: item.description || `Listing from ${config.name}`,
            requirements: item.requirements || [],
            benefits: [],
            postedAt: item.postedAt || 'Recent',
            applicationsCount: 0,
            status: config.autoApprove ? 'Approved' : 'Pending',
            sourceUrl: item.url ? resolveUrl(item.url, currentUrl) : currentUrl,
            sourceJobId: item.id ? String(item.id) : undefined,
            originalApplyUrl: item.url ? resolveUrl(item.url, currentUrl) : currentUrl,
            sourcePortal: config.name,
            extractionMethod: 'javascript_state_extraction',
            scrapeRunId: options.runId,
            scrapedAt: new Date().toISOString()
          });
        }
      }
    } catch {}
  }

  return results;
}

/**
 * ADAPTER 7: HTML / Cheerio Semantic Table & Job Cards Extractor
 */
function extractHtmlSemanticJobs(html: string, currentUrl: string, config: ScraperTargetConfig, options: ScrapeOptions): ScrapedJobResult[] {
  const $ = cheerio.load(html);
  const extractedJobs: ScrapedJobResult[] = [];

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
    'table.table tr.job-row',
    '.views-row'
  ];

  for (const sel of selectors) {
    const elements = $(sel);
    if (elements.length > 0) {
      elements.each((_, el) => {
        if (extractedJobs.length >= 35) return;
        const container = $(el);

        const linkEl = container.find('a[href]').first();
        const rawTitle = (container.find('h2, h3, h4, .title, .job-title, td.job-title').first().text() || linkEl.text()).trim();
        if (!rawTitle || rawTitle.length < 3 || rawTitle.length > 150) return;

        // Skip navigation / boilerplate text
        if (/^(view\s*all|apply\s*now|learn\s*more|read\s*more|load\s*more|filter|search)/i.test(rawTitle)) return;

        let href = linkEl.attr('href') || '';
        const fullUrl = href ? resolveUrl(href, currentUrl) : currentUrl;

        const company = (container.find('.company, .organization, .employer, .company-name').first().text().trim()) || config.name;
        const location = (container.find('.location, .city, .region').first().text().trim()) || '';
        const snippet = (container.find('.description, .snippet, p').first().text().trim()) || '';

        const combined = `${rawTitle} ${location} ${snippet}`.toLowerCase();
        const isRemote = combined.includes('remote') || combined.includes('work from home');
        const isHybrid = combined.includes('hybrid');
        const jobType = isRemote ? 'Remote' : isHybrid ? 'Hybrid' : 'On-site';

        let region: Region = 'Global';
        if (location.toLowerCase().includes('pakistan') || config.name.toLowerCase().includes('pakistan') || config.isGovtPortal) {
          region = 'Pakistan';
        } else if (location.toLowerCase().includes('uae') || location.toLowerCase().includes('dubai')) {
          region = 'UAE';
        } else if (location.toLowerCase().includes('us') || location.toLowerCase().includes('united states')) {
          region = 'US';
        }

        // Factual salary extraction
        let salary = 'Salary not disclosed';
        const salaryMatch = combined.match(/(?:pkr|rs|usd|\$|aed|sar|£|€)\s?[\d,]+(?:\s?-\s?[\d,]+)?(?:\s?(?:\/|per)?\s?(?:mo|month|yr|year))?/i);
        if (salaryMatch) {
          salary = salaryMatch[0];
        }

        extractedJobs.push({
          id: `html-${config.id}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
          title: rawTitle,
          company,
          jobType,
          region,
          city: location || undefined,
          salary,
          currency: region === 'Pakistan' ? 'PKR' : 'USD',
          experienceLevel: rawTitle.toLowerCase().includes('senior') ? 'Senior' : rawTitle.toLowerCase().includes('junior') ? 'Junior' : 'Mid',
          department: config.keywords?.split(',')[0]?.trim() || 'General',
          tags: [config.name, jobType, region],
          description: snippet || `Official vacancy listed on ${config.name}. Visit source URL for complete qualifications.`,
          requirements: [],
          benefits: [],
          postedAt: 'Recent',
          applicationsCount: 0,
          status: config.autoApprove ? 'Approved' : 'Pending',
          sourceUrl: fullUrl,
          originalApplyUrl: fullUrl,
          sourcePortal: config.name,
          extractionMethod: 'html_cheerio',
          scrapeRunId: options.runId,
          scrapedAt: new Date().toISOString(),
          isGovtJob: config.isGovtPortal
        });
      });

      if (extractedJobs.length > 0) break;
    }
  }

  // ADAPTER 8: Generic Fallback - Factual Job Link Extraction
  if (extractedJobs.length === 0) {
    $('a[href]').each((_, el) => {
      if (extractedJobs.length >= 20) return;
      const a = $(el);
      const text = a.text().trim();
      const href = a.attr('href') || '';

      const isJobLink = (
        (href.includes('/job/') || href.includes('/careers/') || href.includes('/vacancy/') || href.includes('/post/') || href.includes('/opportunity/')) &&
        text.length > 5 &&
        text.length < 100 &&
        !/^(apply\s*now|view\s*all|login|register|home|about|contact|terms|privacy)/i.test(text)
      );

      if (isJobLink) {
        const fullUrl = resolveUrl(href, currentUrl);
        extractedJobs.push({
          id: `generic-${config.id}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
          title: text,
          company: config.name,
          jobType: text.toLowerCase().includes('remote') ? 'Remote' : 'On-site',
          region: config.isGovtPortal ? 'Pakistan' : 'Global',
          salary: 'Salary not disclosed',
          currency: config.isGovtPortal ? 'PKR' : 'USD',
          experienceLevel: text.toLowerCase().includes('senior') ? 'Senior' : 'Mid',
          department: config.keywords?.split(',')[0]?.trim() || 'General',
          tags: [config.name, 'Heuristic'],
          description: `Listing from ${config.name}: ${text}. Refer to original URL for full requirements.`,
          requirements: [],
          benefits: [],
          postedAt: 'Recent',
          applicationsCount: 0,
          status: config.autoApprove ? 'Approved' : 'Pending',
          sourceUrl: fullUrl,
          originalApplyUrl: fullUrl,
          sourcePortal: config.name,
          extractionMethod: 'generic_fallback',
          scrapeRunId: options.runId,
          scrapedAt: new Date().toISOString(),
          isGovtJob: config.isGovtPortal
        });
      }
    });
  }

  return extractedJobs;
}

/**
 * Universal scraper pipeline for an individual target portal.
 * STRICT POLICY: NEVER invent or synthesize fake jobs.
 * 0 jobs extracted = returns empty array.
 */
export async function scrapeTargetPortal(
  config: ScraperTargetConfig,
  options: ScrapeOptions = {}
): Promise<ScrapedJobResult[]> {
  const effectiveUrl = config.url || config.portalUrl || config.pdfUrl || '';
  config.url = effectiveUrl;

  if (!effectiveUrl) {
    console.warn(`[Scraper Pipeline] Portal "${config.name}" has no valid URL configured.`);
    return [];
  }

  try {
    // 1. Check Government PDF Adapter
    const pdfResult = await scrapeGovernmentPdfPortal(config, options);
    if (pdfResult && pdfResult.jobs.length > 0) {
      return filterByOptions(pdfResult.jobs, options);
    }

    // 2. Check Greenhouse ATS Adapter
    const ghResult = await scrapeGreenhouseApi(config, options);
    if (ghResult && ghResult.jobs.length > 0) {
      return filterByOptions(ghResult.jobs, options);
    }

    // 3. Check Lever ATS Adapter
    const leverResult = await scrapeLeverApi(config, options);
    if (leverResult && leverResult.jobs.length > 0) {
      return filterByOptions(leverResult.jobs, options);
    }

    // 4. Check SmartRecruiters / Ashby REST APIs
    const restResult = await scrapeRestJobApis(config, options);
    if (restResult && restResult.jobs.length > 0) {
      return filterByOptions(restResult.jobs, options);
    }

    // 5. Build paginated target URL if page > 1
    let targetUrl = effectiveUrl;
    if (options.page && options.page > 1) {
      try {
        const urlObj = new URL(targetUrl);
        urlObj.searchParams.set('page', String(options.page));
        targetUrl = urlObj.toString();
      } catch {}
    }

    // 6. Safe Fetch with SSRF protection, timeout, and retries
    const response = await safeFetchWithRetry(targetUrl, {}, 10000, 1);
    if (!response.ok) {
      console.warn(`[Scraper Pipeline] Target ${config.name} (${targetUrl}) responded with HTTP ${response.status}.`);
      return [];
    }

    // Check if Content-Type is PDF (e.g. redirected or served without .pdf extension)
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/pdf')) {
      const pdfRes = await parsePdfFromUrl(targetUrl, config.name);
      if (pdfRes.success && pdfRes.extractedJobs.length > 0) {
        return filterByOptions(pdfRes.extractedJobs.map(j => ({
          ...j,
          sourcePortal: config.name,
          extractionMethod: 'government_pdf_engine',
          scrapeRunId: options.runId
        })) as any, options);
      }
      return [];
    }

    const html = await response.text();

    // Check if the HTML page contains recruitment PDF gazette links (e.g., FPSC/PPSC circulars)
    if (config.isGovtPortal || config.formatType?.includes('PDF') || /fpsc|ppsc|wapda|kppsc|spsc|bpsc/i.test(config.name)) {
      const $ = cheerio.load(html);
      let linkedPdfUrl: string | null = null;

      $('a[href]').each((_, el) => {
        if (linkedPdfUrl) return;
        const href = $(el).attr('href') || '';
        const text = $(el).text().toLowerCase();
        if (
          href.toLowerCase().split('?')[0].endsWith('.pdf') &&
          (/adv|advertisement|consolidated|gazette|vacancy|recruitment|phase/i.test(href) || /adv|advertisement|gazette/i.test(text))
        ) {
          linkedPdfUrl = resolveUrl(href, targetUrl);
        }
      });

      if (linkedPdfUrl) {
        const pdfRes = await parsePdfFromUrl(linkedPdfUrl, config.name);
        if (pdfRes.success && pdfRes.extractedJobs.length > 0) {
          return filterByOptions(pdfRes.extractedJobs.map(j => ({
            ...j,
            sourcePortal: config.name,
            extractionMethod: 'government_pdf_engine',
            scrapeRunId: options.runId
          })) as any, options);
        }
      }
    }

    // 7. Extract JSON-LD Schema.org structured data (highest fidelity)
    const jsonLdJobs = extractJsonLdJobs(html, targetUrl, config, options);
    if (jsonLdJobs.length > 0) {
      return filterByOptions(jsonLdJobs, options);
    }

    // 8. Extract JavaScript embedded state (__NEXT_DATA__, etc.)
    const jsJobs = extractEmbeddedStateJobs(html, targetUrl, config, options);
    if (jsJobs.length > 0) {
      return filterByOptions(jsJobs, options);
    }

    // 9. Semantic HTML Tables and Job Cards
    const htmlJobs = extractHtmlSemanticJobs(html, targetUrl, config, options);

    // Detect next page link if available and attach to jobs
    const nextPageUrl = extractNextPageUrl(html, targetUrl);
    if (nextPageUrl && htmlJobs.length > 0) {
      htmlJobs.forEach(j => { j.nextPageUrl = nextPageUrl; });
    }

    return filterByOptions(htmlJobs, options);
  } catch (error: any) {
    console.warn(`[Scraper Pipeline] Error scraping ${config.name} (${config.url}):`, error?.message || error);
    // Never invent fake jobs on error
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
        if (!j.datePosted) return true;
        const postTime = new Date(j.datePosted).getTime();
        return isNaN(postTime) || postTime >= cutoff;
      });
    }
  }

  return filtered;
}
