import * as cheerio from 'cheerio';
import { Currency, Region } from '../types/job';
import { safeFetchWithRetry, validateSafeScrapeUrl } from '../../server/utils/ssrfProtection';
import { parsePdfFromUrl, sanitizeUrlForLog, sanitizeSecretString } from '../../server/services/pdfParserEngine';
import { MOCK_CONSOLIDATED_PDF_GAZETTES } from '../data/mockPdfConsolidatedAds';

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
  applicationUrl?: string;

  // Additive Structured Field Extensions (STEP 66-A)
  advertisedPositions?: string[];
  totalVacancies?: number;
  employmentType?: string;
  ageLimit?: string;
  minimumAge?: number;
  maximumAge?: number;
  qualificationSummary?: string;
  domicile?: string;
  contactEmail?: string;
  responsibilitiesList?: string[];
  extractedText?: string;
  relatedSourceUrls?: string[];

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
  mediaUrl?: string;
  newspaperDate?: string;

  // Next page pagination discovery
  nextPageUrl?: string;
}

export interface ScrapeOptions {
  page?: number;
  startPage?: number;
  endPage?: number;
  sinceTimestamp?: string;
  toTimestamp?: string;
  keywords?: string;
  runId?: string;
  targetPageUrl?: string;
}

export interface AdapterAttemptResult extends ScrapeExecutionResult {
  matched: boolean;
  adapterName: 'Greenhouse' | 'Lever' | 'SmartRecruiters' | 'Ashby';
  status: 'success' | 'empty' | 'error';
  failureCategory?: 'http_error' | 'network_error' | 'json_parse_error' | 'invalid_response';
  httpStatus?: number;
  diagnostic?: string;
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
 * Verifies whether a candidate media URL shares the same origin or official apex CDN domain as baseUrl.
 * Prevents arbitrary third-party image downloads and untrusted tracking/ad network fetches.
 */
export function isSafeMediaOrigin(candidateUrl: string, baseUrl: string): boolean {
  try {
    const candidateObj = new URL(candidateUrl);
    const baseObj = new URL(baseUrl);

    // Only permit HTTP(S) protocols
    if (
      (candidateObj.protocol !== 'http:' && candidateObj.protocol !== 'https:') ||
      (baseObj.protocol !== 'http:' && baseObj.protocol !== 'https:')
    ) {
      return false;
    }

    // Reject HTTP downgrade from an HTTPS source
    if (baseObj.protocol === 'https:' && candidateObj.protocol !== 'https:') {
      return false;
    }

    // Exact same-origin permission (protocol + hostname + port)
    if (candidateObj.origin === baseObj.origin) {
      return true;
    }

    // Reject unapproved port changes or non-default ports for cross-origin media
    if (candidateObj.port !== baseObj.port || candidateObj.port !== '') {
      return false;
    }

    const candidateHost = candidateObj.hostname.toLowerCase();
    const baseHost = baseObj.hostname.toLowerCase();

    // Reject public-suffix and multi-tenant hosting collisions & tenant domains using strict hostname boundaries
    const multiTenantSuffixes = ['pages.dev', 'blogspot.com', 'github.io', 'vercel.app', 'netlify.app', 'herokuapp.com', 'co.uk', 'com.pk'];
    if (
      multiTenantSuffixes.some(
        s => candidateHost === s || candidateHost.endsWith(`.${s}`) || baseHost === s || baseHost.endsWith(`.${s}`)
      )
    ) {
      return false;
    }

    // Explicit, verified cross-origin CDN hostname allowlist only (HTTPS required)
    const OFFICIAL_CDN_ALLOWLIST = new Set([
      'fpsc.gov.pk',
      'ppsc.gop.pk',
      'spsc.gos.pk',
      'kppsc.gov.pk',
      'bpsc.gob.pk',
      'cdn.fpsc.gov.pk',
      'cdn.ppsc.gop.pk',
      'cdn.spsc.gos.pk',
      'cdn.kppsc.gov.pk',
      'cdn.bpsc.gob.pk'
    ]);

    if (candidateObj.protocol === 'https:' && OFFICIAL_CDN_ALLOWLIST.has(candidateHost)) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Maps raw extracted OCR jobs from linked recruitment images to ScrapedJobResult records.
 * Strictly enforces status: 'Pending' and extractionMethod: 'linked_image_ocr' regardless of config.autoApprove.
 */
export function mapLinkedImageOcrJobs(
  extractedJobs: any[],
  config: Pick<ScraperTargetConfig, 'name' | 'autoApprove'>,
  targetUrl: string,
  imgUrl: string,
  imgContext: { fullExtractedText?: string; rawTextSample?: string } = {},
  options: Pick<ScrapeOptions, 'runId'> = {}
): ScrapedJobResult[] {
  return (extractedJobs || []).map(j => ({
    id: j.id,
    title: j.title,
    company: j.company || config.name,
    jobType: j.jobType || 'On-site',
    region: (j.region || 'Pakistan') as Region,
    province: j.province,
    city: j.city,
    salary: j.salary || 'Per Advertisement',
    currency: 'PKR' as Currency,
    experienceLevel: (j.experienceLevel || 'Mid') as any,
    department: j.department || config.name,
    tags: j.tags || [config.name, 'Linked Image Ad'],
    description: j.description || `Vacancy extracted via OCR from linked advertisement image.`,
    extractedText: j.extractedText || imgContext.fullExtractedText || imgContext.rawTextSample,
    requirements: j.requirements || [],
    benefits: j.benefits || [],
    postedAt: j.postedAt || 'Recent',
    deadlineDate: j.deadlineDate,
    applicationsCount: 0,
    status: 'Pending',
    sourceUrl: targetUrl,
    clippingImageUrl: imgUrl,
    mediaUrl: imgUrl,
    sourcePortal: config.name,
    extractionMethod: 'linked_image_ocr',
    scrapeRunId: options.runId,
    scrapedAt: new Date().toISOString(),
    isGovtJob: j.isGovtJob,
    govtDepartment: j.govtDepartment,
    govtScale: j.govtScale,
    govtCategory: j.govtCategory,
    advertisedPositions: j.advertisedPositions,
    totalVacancies: j.totalVacancies,
    employmentType: j.employmentType,
    ageLimit: j.ageLimit,
    minimumAge: typeof j.minimumAge === 'number' ? j.minimumAge : (j.minimumAge ? Number(j.minimumAge) : undefined),
    maximumAge: typeof j.maximumAge === 'number' ? j.maximumAge : (j.maximumAge ? Number(j.maximumAge) : undefined),
    qualificationSummary: j.qualificationSummary,
    domicile: j.domicile,
    contactEmail: j.contactEmail,
    responsibilitiesList: j.responsibilitiesList,
    relatedSourceUrls: [imgUrl]
  }));
}

const ZERO_VACANCY_MEDIA_DIAGNOSTICS = new Set([
  'PDF_TEXT_ZERO_VACANCIES',
  'PDF_SCANNED_FALLBACK_NO_VACANCIES',
  'IMAGE_OCR_NO_VACANCIES',
  'HTML_TEXT_NO_VACANCIES'
]);

const SUPPORTED_IMAGE_EXTENSION_REGEX = /\.(jpg|jpeg|png|webp|bmp)$/i;
const UNSUPPORTED_IMAGE_EXTENSION_REGEX = /\.(gif|tiff|tif|svg|ico)$/i;
const SUPPORTED_IMAGE_CONTENT_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/bmp',
  'image/x-ms-bmp'
]);
const UNSUPPORTED_IMAGE_CONTENT_TYPES = new Set([
  'image/gif',
  'image/svg+xml',
  'image/tiff',
  'image/x-icon',
  'image/vnd.microsoft.icon'
]);

function mapMediaResultError(mediaResult: { diagnosticCode?: string; message?: string; errorMessage?: string }): Error {
  const rawMsg =
    mediaResult.message ||
    mediaResult.errorMessage ||
    (mediaResult.diagnosticCode ? `Media extraction error (${mediaResult.diagnosticCode})` : 'Invalid media response: extraction failed');
  const statusMatch = rawMsg.match(/HTTP\s+(\d{3})/i);
  const parsedStatus = statusMatch ? parseInt(statusMatch[1], 10) : undefined;
  const msgLower = rawMsg.toLowerCase();
  const hasKnownClassificationKeyword =
    Boolean(parsedStatus) ||
    msgLower.includes('403') ||
    msgLower.includes('404') ||
    msgLower.includes('forbidden') ||
    msgLower.includes('not found') ||
    msgLower.includes('timeout') ||
    msgLower.includes('timed out') ||
    msgLower.includes('etimedout') ||
    msgLower.includes('abort') ||
    msgLower.includes('invalid pdf') ||
    msgLower.includes('html instead of pdf') ||
    msgLower.includes('ocr') ||
    msgLower.includes('unsupported');
  const err: any = new Error(hasKnownClassificationKeyword ? rawMsg : `Media extraction failed: ${rawMsg}`);
  if (parsedStatus) {
    err.status = parsedStatus;
    err.statusCode = parsedStatus;
    err.httpStatus = parsedStatus;
  }
  if (mediaResult.diagnosticCode) {
    err.diagnosticCode = mediaResult.diagnosticCode;
  }
  return err;
}

/**
 * Maps raw extracted OCR jobs from a direct image advertisement URL to ScrapedJobResult records.
 * Strictly enforces status: 'Pending' and extractionMethod: 'image_ocr' regardless of config.autoApprove.
 */
export function mapDirectImageOcrJobs(
  extractedJobs: any[],
  config: Pick<ScraperTargetConfig, 'name' | 'autoApprove' | 'isNewspaperClippingPortal'>,
  imageUrl: string,
  imgContext: { fullExtractedText?: string; rawTextSample?: string; fileName?: string } = {},
  options: Pick<ScrapeOptions, 'runId'> = {}
): ScrapedJobResult[] {
  return (extractedJobs || []).map(j => ({
    id: j.id,
    title: j.title,
    company: j.company || config.name,
    jobType: j.jobType || 'On-site',
    region: (j.region || 'Pakistan') as Region,
    province: j.province,
    city: j.city,
    salary: j.salary || 'Per Advertisement',
    currency: 'PKR' as Currency,
    experienceLevel: (j.experienceLevel || 'Mid') as any,
    department: j.department || config.name,
    tags: j.tags || [config.name, 'Image OCR Ad'],
    description: j.description || `Vacancy extracted via vision OCR from advertisement image.`,
    extractedText: j.extractedText || imgContext.fullExtractedText || imgContext.rawTextSample,
    requirements: j.requirements || [],
    benefits: j.benefits || [],
    postedAt: j.postedAt || 'Recent',
    deadlineDate: j.deadlineDate,
    applicationsCount: 0,
    status: 'Pending',
    sourceUrl: imageUrl,
    clippingImageUrl: imageUrl,
    mediaUrl: imageUrl,
    isNewspaperAd: Boolean(config.isNewspaperClippingPortal || j.isNewspaperAd),
    newspaperName: config.isNewspaperClippingPortal ? config.name : j.newspaperName,
    sourcePortal: config.name,
    extractionMethod: 'image_ocr',
    scrapeRunId: options.runId,
    scrapedAt: new Date().toISOString(),
    isGovtJob: j.isGovtJob,
    govtDepartment: j.govtDepartment,
    govtScale: j.govtScale,
    govtCategory: j.govtCategory,
    advertisedPositions: j.advertisedPositions,
    totalVacancies: j.totalVacancies,
    employmentType: j.employmentType,
    ageLimit: j.ageLimit,
    minimumAge: typeof j.minimumAge === 'number' ? j.minimumAge : (j.minimumAge ? Number(j.minimumAge) : undefined),
    maximumAge: typeof j.maximumAge === 'number' ? j.maximumAge : (j.maximumAge ? Number(j.maximumAge) : undefined),
    qualificationSummary: j.qualificationSummary,
    domicile: j.domicile,
    contactEmail: j.contactEmail,
    responsibilitiesList: j.responsibilitiesList,
    relatedSourceUrls: [imageUrl]
  }));
}

/**
 * Conservative recruitment image candidate discovery from HTML.
 * STRICT SAFETY RULES:
 * - Never downloads every image on a page.
 * - Restricts candidate images to genuine job/ad/document images using conservative criteria.
 * - Enforces same-origin or same-apex CDN safety; rejects arbitrary third-party domains.
 * - Rejects logos, icons, avatars, banners, tracking pixels, and social media icons.
 * - Deduplicates URLs and bounds candidates to a maximum of 3 per page.
 */
export function findCandidateRecruitmentImages(html: string, baseUrl: string): string[] {
  if (!html || typeof html !== 'string') return [];
  const $ = cheerio.load(html);
  const candidates: string[] = [];
  const seen = new Set<string>();

  const RECRUITMENT_KEYWORDS = /(?:advertisement|recruitment|vacancy|vacancies|career|gazette|corrigendum|walk[- ]?in|asami|nokri|job[_-]?ad|hiring|clipping)/i;
  const EXCLUSION_KEYWORDS = /(?:logo|icon|favicon|avatar|thumb|thumbnail|header[_-]?bg|footer|nav|menu|button|sprite|badge|pixel|analytics|tracker|shim|spinner|loading|share|social|facebook|twitter|instagram|linkedin|whatsapp|youtube)/i;

  const checkCandidate = (rawUrl: string, altText: string = '', titleText: string = '', classText: string = '') => {
    if (!rawUrl || candidates.length >= 3) return;
    const cleanUrl = rawUrl.trim();
    if (!cleanUrl || cleanUrl.startsWith('data:') || cleanUrl.startsWith('javascript:')) return;

    const resolved = resolveUrl(cleanUrl, baseUrl);
    if (!resolved.startsWith('http://') && !resolved.startsWith('https://')) return;

    // Check extension
    const pathLower = resolved.split('?')[0].toLowerCase();
    const isSupportedImage = /\.(jpg|jpeg|png|webp|bmp)$/i.test(pathLower);
    if (!isSupportedImage) return;

    // Origin Safety: Candidate must be same-origin or same-apex official CDN domain
    if (!isSafeMediaOrigin(resolved, baseUrl)) return;

    // SSRF Check
    const ssrfCheck = validateSafeScrapeUrl(resolved);
    if (!ssrfCheck.safe) return;

    // Canonicalize / deduplicate
    const canonical = resolved.split('#')[0];
    if (seen.has(canonical)) return;

    // Evaluate context: URL, alt text, title text, class/id text
    const combinedContext = `${pathLower} ${altText} ${titleText} ${classText}`.toLowerCase();

    // Check exclusion
    if (EXCLUSION_KEYWORDS.test(combinedContext) && !combinedContext.includes('advertisement') && !combinedContext.includes('recruitment')) {
      return;
    }

    // Check recruitment signals
    const hasRecruitmentSignal = RECRUITMENT_KEYWORDS.test(combinedContext);
    if (hasRecruitmentSignal) {
      seen.add(canonical);
      candidates.push(resolved);
    }
  };

  // 1. Inspect <img> tags
  $('img').each((_, el) => {
    if (candidates.length >= 3) return;
    const src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-original') || '';
    const alt = $(el).attr('alt') || '';
    const title = $(el).attr('title') || '';
    const className = $(el).attr('class') || $(el).attr('id') || '';

    // Ignore tiny images (tracking pixels or icons) if dimensions specified
    const width = parseInt($(el).attr('width') || '', 10);
    const height = parseInt($(el).attr('height') || '', 10);
    if ((!isNaN(width) && width < 100) || (!isNaN(height) && height < 100)) {
      return;
    }

    checkCandidate(src, alt, title, className);
  });

  // 2. Inspect <a> tags pointing directly to images
  $('a[href]').each((_, el) => {
    if (candidates.length >= 3) return;
    const href = $(el).attr('href') || '';
    const text = $(el).text() || '';
    const title = $(el).attr('title') || '';
    checkCandidate(href, text, title, $(el).attr('class') || '');
  });

  return candidates;
}

/**
 * Detects next-page pagination URL from HTML with semantic selectors.
 * Skips disabled controls (.disabled, [disabled], [aria-disabled="true"]) and non-navigational hrefs.
 */
export function extractNextPageUrl(html: string, currentUrl: string): string | null {
  try {
    const $ = cheerio.load(html);

    const isUsableHref = (el: any, rawHref: string | undefined): rawHref is string => {
      if (!rawHref) return false;
      const trimmed = rawHref.trim();
      if (!trimmed || trimmed === '#' || trimmed.startsWith('#') || /^javascript:/i.test(trimmed)) {
        return false;
      }
      const node = $(el);
      if (
        node.is('.disabled, [disabled], [aria-disabled="true"]') ||
        node.closest('.disabled, .page-item.disabled, li.disabled, [aria-disabled="true"]').length > 0
      ) {
        return false;
      }
      return true;
    };

    // 1. Check standard HTML link rel="next" or anchor rel="next"
    const relLink = $('link[rel="next"]').first();
    const relLinkHref = relLink.attr('href');
    if (relLink.length > 0 && relLinkHref && !relLinkHref.trim().startsWith('#') && !/^javascript:/i.test(relLinkHref.trim())) {
      return resolveUrl(relLinkHref.trim(), currentUrl);
    }

    let anchorRelHref: string | null = null;
    $('a[rel="next"]').each((_, el) => {
      if (anchorRelHref) return;
      const href = $(el).attr('href');
      if (isUsableHref(el, href)) {
        anchorRelHref = resolveUrl(href.trim(), currentUrl);
      }
    });
    if (anchorRelHref) return anchorRelHref;

    // 2. Check aria-label="Next" or title="Next"
    let ariaNextHref: string | null = null;
    $('a[aria-label*="Next" i], a[aria-label*="اگلا" i], a[title*="Next" i]').each((_, el) => {
      if (ariaNextHref) return;
      const href = $(el).attr('href');
      if (isUsableHref(el, href)) {
        ariaNextHref = resolveUrl(href.trim(), currentUrl);
      }
    });
    if (ariaNextHref) return ariaNextHref;

    // 3. Check pagination next button classes
    let classNextHref: string | null = null;
    $('.pagination .next a, .pager .next a, li.next a, li.pagination-next a, a.next-page, a.page-next').each((_, el) => {
      if (classNextHref) return;
      const href = $(el).attr('href');
      if (isUsableHref(el, href)) {
        classNextHref = resolveUrl(href.trim(), currentUrl);
      }
    });
    if (classNextHref) return classNextHref;

    // 4. Look for anchor containing text "Next" or "اگلا"
    let textNextHref: string | null = null;
    $('a').each((_, el) => {
      if (textNextHref) return;
      const text = $(el).text().trim().toLowerCase().replace(/\s+/g, ' ');
      if (
        text === 'next' ||
        text === 'next >' ||
        text === 'next ›' ||
        text === 'next »' ||
        text === 'next →' ||
        text === '›' ||
        text === '»' ||
        text === 'اگلا' ||
        text === 'اگلا صفحہ'
      ) {
        const href = $(el).attr('href');
        if (isUsableHref(el, href)) {
          textNextHref = resolveUrl(href.trim(), currentUrl);
        }
      }
    });

    return textNextHref;
  } catch {
    return null;
  }
}

export function mapGreenhouseJob(j: any, config: ScraperTargetConfig, options: ScrapeOptions = {}): ScrapedJobResult {
  const targetUrl = config.url || config.portalUrl || '';
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
    originalApplyUrl: undefined,
    applicationUrl: undefined,
    sourcePortal: config.name,
    extractionMethod: 'greenhouse_api',
    scrapeRunId: options.runId,
    scrapedAt: new Date().toISOString()
  };
}

/**
 * Strict streaming response size limits (STEP-8.6-B1)
 * - Main HTML portal responses: maximum 8 MB
 * - ATS JSON responses: maximum 5 MB
 */
export const MAX_PORTAL_HTML_BYTES = 8 * 1024 * 1024; // 8 MB
export const MAX_ATS_JSON_BYTES = 5 * 1024 * 1024;     // 5 MB

export class MaxPayloadExceededError extends Error {
  public readonly maxBytes: number;
  public readonly actualBytes?: number;

  constructor(message: string, maxBytes: number, actualBytes?: number) {
    super(message);
    this.name = 'MaxPayloadExceededError';
    this.maxBytes = maxBytes;
    this.actualBytes = actualBytes;
    Object.setPrototypeOf(this, MaxPayloadExceededError.prototype);
  }
}

/**
 * Safely cancels or destroys a response body stream upon overflow or read failure.
 */
async function cancelStream(stream: any, reader?: any, reason?: string): Promise<void> {
  const cancelMsg = reason || 'Response body exceeded maximum allowed limit';
  if (reader) {
    let readerCancelled = false;
    try {
      if (typeof reader.cancel === 'function') {
        await reader.cancel(cancelMsg);
        readerCancelled = true;
      }
    } catch {}
    if (readerCancelled) {
      return;
    }
  }
  if (stream) {
    try {
      if (typeof stream.cancel === 'function') {
        await stream.cancel(cancelMsg);
      } else if (typeof stream.destroy === 'function') {
        stream.destroy();
      }
    } catch {}
  }
}

/**
 * Checks Content-Length header against maxBytes limit before reading body stream.
 * Stops and cancels stream early if header indicates an oversized response.
 */
async function checkContentLengthHeader(response: any, maxBytes: number, contextLabel: string): Promise<void> {
  let clHeader: any = null;
  if (response?.headers) {
    if (typeof response.headers.get === 'function') {
      clHeader = response.headers.get('content-length');
    } else if (response.headers['content-length'] !== undefined) {
      clHeader = response.headers['content-length'];
    } else if (response.headers['Content-Length'] !== undefined) {
      clHeader = response.headers['Content-Length'];
    }
  }

  if (clHeader !== null && clHeader !== undefined) {
    const clNum = parseInt(String(clHeader).trim(), 10);
    if (!isNaN(clNum) && clNum > maxBytes) {
      if (!response?.bodyUsed) {
        await cancelStream(response?.body, undefined, `Content-Length ${clNum} exceeds limit ${maxBytes}`);
      }
      throw new MaxPayloadExceededError(
        `${contextLabel} Content-Length (${clNum} bytes) exceeds maximum allowed limit of ${maxBytes} bytes (${(maxBytes / (1024 * 1024)).toFixed(0)} MB)`,
        maxBytes,
        clNum
      );
    }
  }
}

/**
 * Concatenates Uint8Array chunks and decodes as UTF-8 string without intermediate memory bloat.
 */
function decodeUtf8Chunks(chunks: Uint8Array[]): string {
  if (chunks.length === 0) return '';
  if (chunks.length === 1) {
    return new TextDecoder('utf-8').decode(chunks[0]);
  }
  let totalLength = 0;
  for (let i = 0; i < chunks.length; i++) {
    totalLength += chunks[i].byteLength;
  }
  const merged = new Uint8Array(totalLength);
  let offset = 0;
  for (let i = 0; i < chunks.length; i++) {
    merged.set(chunks[i], offset);
    offset += chunks[i].byteLength;
  }
  return new TextDecoder('utf-8').decode(merged);
}

/**
 * Reusable bounded response reader that enforces strict byte limits on streaming responses.
 * Checks Content-Length when available, independently counts actual streamed bytes, immediately
 * stops and cancels response streams upon overflow, and avoids unbounded memory buffering.
 */
export async function readBoundedResponseText(
  response: any,
  maxBytes: number,
  contextLabel: string = 'Response'
): Promise<string> {
  if (!response) {
    return '';
  }

  // 1. Fast early rejection on Content-Length header if present
  await checkContentLengthHeader(response, maxBytes, contextLabel);

  // 2. Stream-based bounded reading if body stream is present
  if (response.body) {
    // 2a. Standard WHATWG ReadableStream (reader-based)
    if (typeof response.body.getReader === 'function') {
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let totalBytes = 0;
      let streamCleanedUp = false;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            streamCleanedUp = true;
            break;
          }
          if (value) {
            const chunkBytes = value.byteLength !== undefined ? value.byteLength : value.length || 0;
            totalBytes += chunkBytes;
            if (totalBytes > maxBytes) {
              streamCleanedUp = true;
              await cancelStream(response.body, reader, `${contextLabel} exceeded limit of ${maxBytes} bytes`);
              throw new MaxPayloadExceededError(
                `${contextLabel} body stream exceeded maximum allowed limit of ${maxBytes} bytes (${(maxBytes / (1024 * 1024)).toFixed(0)} MB)`,
                maxBytes,
                totalBytes
              );
            }
            chunks.push(value instanceof Uint8Array ? value : new Uint8Array(value));
          }
        }
      } catch (readErr: any) {
        if (!streamCleanedUp) {
          streamCleanedUp = true;
          await cancelStream(response.body, reader);
        }
        throw readErr;
      } finally {
        try {
          reader.releaseLock();
        } catch {}
      }

      return decodeUtf8Chunks(chunks);
    }

    // 2b. Async-iterable streams (Node Readable streams, custom iterators)
    if (typeof response.body[Symbol.asyncIterator] === 'function') {
      const chunks: Uint8Array[] = [];
      let totalBytes = 0;
      let streamCleanedUp = false;
      try {
        for await (const chunk of response.body) {
          const u8 = typeof chunk === 'string'
            ? new TextEncoder().encode(chunk)
            : chunk instanceof Uint8Array
              ? chunk
              : new Uint8Array(chunk);
          totalBytes += u8.byteLength;
          if (totalBytes > maxBytes) {
            streamCleanedUp = true;
            await cancelStream(response.body, undefined, `${contextLabel} exceeded limit of ${maxBytes} bytes`);
            throw new MaxPayloadExceededError(
              `${contextLabel} body stream exceeded maximum allowed limit of ${maxBytes} bytes (${(maxBytes / (1024 * 1024)).toFixed(0)} MB)`,
              maxBytes,
              totalBytes
            );
          }
          chunks.push(u8);
        }
        streamCleanedUp = true;
      } catch (readErr: any) {
        if (!streamCleanedUp) {
          streamCleanedUp = true;
          await cancelStream(response.body);
        }
        throw readErr;
      }

      return decodeUtf8Chunks(chunks);
    }
  }

  // 3. Fallback for test mocks that supply .text() without a stream body
  if (typeof response.text === 'function') {
    const rawText = await response.text();
    const byteLength = typeof rawText === 'string' ? new TextEncoder().encode(rawText).byteLength : 0;
    if (byteLength > maxBytes) {
      throw new MaxPayloadExceededError(
        `${contextLabel} body size (${byteLength} bytes) exceeded maximum allowed limit of ${maxBytes} bytes (${(maxBytes / (1024 * 1024)).toFixed(0)} MB)`,
        maxBytes,
        byteLength
      );
    }
    return rawText || '';
  }

  // 4. Raw string handling
  if (typeof response === 'string') {
    const byteLength = new TextEncoder().encode(response).byteLength;
    if (byteLength > maxBytes) {
      throw new MaxPayloadExceededError(
        `${contextLabel} body size (${byteLength} bytes) exceeded maximum allowed limit of ${maxBytes} bytes (${(maxBytes / (1024 * 1024)).toFixed(0)} MB)`,
        maxBytes,
        byteLength
      );
    }
    return response;
  }

  return '';
}

/**
 * Reads and parses JSON responses under strict streaming byte limits.
 * Avoids unbounded memory allocation and rejects oversized or malformed payloads.
 */
export async function readBoundedResponseJson<T = any>(
  response: any,
  maxBytes: number,
  contextLabel: string = 'JSON Response'
): Promise<T> {
  // If response has no stream body and no .text(), but has .json() (lightweight test mock)
  if (!response?.body && typeof response?.text !== 'function' && typeof response?.json === 'function') {
    await checkContentLengthHeader(response, maxBytes, contextLabel);
    const data = await response.json();
    return data as T;
  }

  const rawText = await readBoundedResponseText(response, maxBytes, contextLabel);
  return JSON.parse(rawText) as T;
}

/**
 * Shared safe executor for JSON-based ATS adapters (Greenhouse, Lever, SmartRecruiters, Ashby).
 * Distinguishes valid empty job arrays from HTTP, network, JSON parse, and malformed structure failures,
 * logging concise secret-sanitized diagnostics without breaking HTML fallback.
 */
function sanitizeAdapterLogDetail(input: string): string {
  return sanitizeSecretString(input).replace(
    /\b(api[_-]?key|apikey|token|access_token|authorization|auth|secret|password|passwd|pwd|sig|signature)[:=]\s*([^\s,;&]+)/gi,
    '$1=[REDACTED]'
  );
}

async function executeAtsJsonAdapter<T>(params: {
  adapterName: AdapterAttemptResult['adapterName'];
  extractionMethod: string;
  apiUrl: string;
  targetUrl: string;
  extractItems: (data: any) => T[] | null;
  mapItem: (item: T) => ScrapedJobResult;
  fetchFn: typeof safeFetchWithRetry;
}): Promise<AdapterAttemptResult> {
  const { adapterName, extractionMethod, apiUrl, targetUrl, extractItems, mapItem, fetchFn } = params;
  const safeTargetForLog = sanitizeUrlForLog(targetUrl);

  let res: any;
  try {
    res = await fetchFn(apiUrl, { headers: { 'Accept': 'application/json' } }, 15000);
  } catch (err: any) {
    const httpStatus = typeof err?.status === 'number' ? err.status : typeof err?.statusCode === 'number' ? err.statusCode : undefined;
    const rawDetail = sanitizeAdapterLogDetail(String(err?.message || err || 'Network failure'));
    const diagnostic = `[${adapterName} Adapter] failure=network_error${httpStatus ? ` status=${httpStatus}` : ''} target=${safeTargetForLog}: ${rawDetail}`;
    console.warn(diagnostic);
    return {
      matched: true,
      adapterName,
      status: 'error',
      failureCategory: 'network_error',
      httpStatus,
      diagnostic,
      jobs: [],
      extractionMethod,
      totalFoundOnPage: 0
    };
  }

  if (!res || !res.ok) {
    if (res && !res.bodyUsed) {
      await cancelStream(res.body, undefined, 'Non-2xx ATS HTTP response');
    }
    const status = typeof res?.status === 'number' ? res.status : undefined;
    const diagnostic = `[${adapterName} Adapter] failure=http_error${status !== undefined ? ` status=${status}` : ''} target=${safeTargetForLog}`;
    console.warn(diagnostic);
    return {
      matched: true,
      adapterName,
      status: 'error',
      failureCategory: 'http_error',
      httpStatus: status,
      diagnostic,
      jobs: [],
      extractionMethod,
      totalFoundOnPage: 0
    };
  }

  let data: any;
  try {
    data = await readBoundedResponseJson(res, MAX_ATS_JSON_BYTES, `${adapterName} ATS JSON`);
  } catch (parseErr: any) {
    const isSizeError = parseErr?.name === 'MaxPayloadExceededError' || /exceeded|maximum allowed limit/i.test(parseErr?.message || '');
    const failureCategory = isSizeError ? 'invalid_response' : 'json_parse_error';
    const rawDetail = sanitizeAdapterLogDetail(String(parseErr?.message || 'Malformed JSON response'));
    const diagnostic = `[${adapterName} Adapter] failure=${failureCategory} status=${res.status} target=${safeTargetForLog}: ${rawDetail}`;
    console.warn(diagnostic);
    return {
      matched: true,
      adapterName,
      status: 'error',
      failureCategory,
      httpStatus: res.status,
      diagnostic,
      jobs: [],
      extractionMethod,
      totalFoundOnPage: 0
    };
  }

  const items = extractItems(data);
  if (!items) {
    const diagnostic = `[${adapterName} Adapter] failure=invalid_response status=${res.status} target=${safeTargetForLog}: unexpected response structure`;
    console.warn(diagnostic);
    return {
      matched: true,
      adapterName,
      status: 'error',
      failureCategory: 'invalid_response',
      httpStatus: res.status,
      diagnostic,
      jobs: [],
      extractionMethod,
      totalFoundOnPage: 0
    };
  }

  const jobs = items.map(mapItem);
  return {
    matched: true,
    adapterName,
    status: jobs.length > 0 ? 'success' : 'empty',
    jobs,
    extractionMethod,
    totalFoundOnPage: jobs.length
  };
}

/**
 * ADAPTER 1: Greenhouse API Adapter (boards-api.greenhouse.io)
 */
export async function scrapeGreenhouseApi(
  config: ScraperTargetConfig,
  options: ScrapeOptions = {},
  fetchFn: typeof safeFetchWithRetry = safeFetchWithRetry
): Promise<AdapterAttemptResult | null> {
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

  return executeAtsJsonAdapter<any>({
    adapterName: 'Greenhouse',
    extractionMethod: 'greenhouse_api',
    apiUrl: `https://boards-api.greenhouse.io/v1/boards/${boardToken}/jobs?content=true`,
    targetUrl,
    extractItems: (data) => (data && Array.isArray(data.jobs) ? data.jobs : null),
    mapItem: (j) => mapGreenhouseJob(j, config, options),
    fetchFn
  });
}

export function mapLeverJob(j: any, config: ScraperTargetConfig, options: ScrapeOptions = {}): ScrapedJobResult {
  const targetUrl = config.url || config.portalUrl || '';
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
    sourceUrl: j.hostedUrl || targetUrl,
    sourceJobId: String(j.id),
    originalApplyUrl: (j.applyUrl && j.applyUrl !== j.hostedUrl) ? j.applyUrl : undefined,
    applicationUrl: (j.applyUrl && j.applyUrl !== j.hostedUrl) ? j.applyUrl : undefined,
    sourcePortal: config.name,
    extractionMethod: 'lever_api',
    scrapeRunId: options.runId,
    scrapedAt: new Date().toISOString()
  };
}

/**
 * ADAPTER 2: Lever API Adapter (api.lever.co)
 */
export async function scrapeLeverApi(
  config: ScraperTargetConfig,
  options: ScrapeOptions = {},
  fetchFn: typeof safeFetchWithRetry = safeFetchWithRetry
): Promise<AdapterAttemptResult | null> {
  const targetUrl = config.url || config.portalUrl || '';
  if (!targetUrl) return null;
  const url = targetUrl.toLowerCase();
  if (!url.includes('jobs.lever.co')) {
    return null;
  }

  const siteName = targetUrl.split('jobs.lever.co/')[1]?.split('/')[0]?.split('?')[0];
  if (!siteName) return null;

  return executeAtsJsonAdapter<any>({
    adapterName: 'Lever',
    extractionMethod: 'lever_api',
    apiUrl: `https://api.lever.co/v0/postings/${siteName}?mode=json`,
    targetUrl,
    extractItems: (data) => (Array.isArray(data) ? data : null),
    mapItem: (j) => mapLeverJob(j, config, options),
    fetchFn
  });
}

export function mapSmartRecruitersJob(j: any, config: ScraperTargetConfig, options: ScrapeOptions = {}): ScrapedJobResult {
  const targetUrl = config.url || config.portalUrl || '';
  const company = targetUrl.split('smartrecruiters.com/')[1]?.split('/')[0]?.split('?')[0] || '';
  const detailUrl = `https://jobs.smartrecruiters.com/${company}/${j.id}`;
  return {
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
    sourceUrl: detailUrl,
    sourceJobId: String(j.id),
    originalApplyUrl: (j.applyUrl && j.applyUrl !== detailUrl) ? j.applyUrl : undefined,
    applicationUrl: (j.applyUrl && j.applyUrl !== detailUrl) ? j.applyUrl : undefined,
    sourcePortal: config.name,
    extractionMethod: 'smartrecruiters_api',
    scrapeRunId: options.runId,
    scrapedAt: new Date().toISOString()
  };
}

export function mapAshbyJob(j: any, config: ScraperTargetConfig, options: ScrapeOptions = {}): ScrapedJobResult {
  const targetUrl = config.url || config.portalUrl || '';
  return {
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
    originalApplyUrl: (j.applyUrl && j.applyUrl !== j.jobUrl) ? j.applyUrl : undefined,
    applicationUrl: (j.applyUrl && j.applyUrl !== j.jobUrl) ? j.applyUrl : undefined,
    sourcePortal: config.name,
    extractionMethod: 'ashby_api',
    scrapeRunId: options.runId,
    scrapedAt: new Date().toISOString()
  };
}

/**
 * ADAPTER 3: SmartRecruiters & Ashby REST APIs
 */
export async function scrapeRestJobApis(
  config: ScraperTargetConfig,
  options: ScrapeOptions = {},
  fetchFn: typeof safeFetchWithRetry = safeFetchWithRetry
): Promise<AdapterAttemptResult | null> {
  const targetUrl = config.url || config.portalUrl || '';
  if (!targetUrl) return null;
  const url = targetUrl.toLowerCase();

  // SmartRecruiters
  if (url.includes('smartrecruiters.com/')) {
    const company = targetUrl.split('smartrecruiters.com/')[1]?.split('/')[0]?.split('?')[0];
    if (company && !['jobs', 'careers', 'search'].includes(company)) {
      return executeAtsJsonAdapter<any>({
        adapterName: 'SmartRecruiters',
        extractionMethod: 'smartrecruiters_api',
        apiUrl: `https://api.smartrecruiters.com/v1/companies/${company}/postings`,
        targetUrl,
        extractItems: (data) => (data && Array.isArray(data.content) ? data.content : null),
        mapItem: (j) => mapSmartRecruitersJob(j, config, options),
        fetchFn
      });
    }
  }

  // Ashby
  if (url.includes('jobs.ashbyhq.com/')) {
    const company = targetUrl.split('jobs.ashbyhq.com/')[1]?.split('/')[0]?.split('?')[0];
    if (company) {
      return executeAtsJsonAdapter<any>({
        adapterName: 'Ashby',
        extractionMethod: 'ashby_api',
        apiUrl: `https://api.ashbyhq.com/posting-api/job-board/${company}`,
        targetUrl,
        extractItems: (data) => (data && Array.isArray(data.jobs) ? data.jobs : null),
        mapItem: (j) => mapAshbyJob(j, config, options),
        fetchFn
      });
    }
  }

  return null;
}

/**
 * ADAPTER 4: Government PDF Parser (Connected to pdfParserEngine)
 * Handles FPSC, PPSC, WAPDA, KPPSC, SPSC, BPSC, or any PDF recruitment gazette.
 */
async function scrapeGovernmentPdfPortal(
  config: ScraperTargetConfig,
  options: ScrapeOptions,
  parseMediaFn: typeof parsePdfFromUrl = parsePdfFromUrl
): Promise<ScrapeExecutionResult | null> {
  const effectiveUrl = config.url || config.portalUrl || config.pdfUrl || '';
  const isExplicitPdf =
    (config.formatType && config.formatType.includes('PDF')) ||
    (config.pdfUrl && config.pdfUrl.trim().length > 0) ||
    (effectiveUrl && effectiveUrl.toLowerCase().split('?')[0].endsWith('.pdf'));

  if (!isExplicitPdf) return null;

  const targetPdfUrl = (config.pdfUrl && config.pdfUrl.startsWith('http')) ? config.pdfUrl : effectiveUrl;
  if (!targetPdfUrl || !targetPdfUrl.startsWith('http')) return null;

  try {
    const pdfResult = await parseMediaFn(targetPdfUrl, config.name);
    if (ZERO_VACANCY_MEDIA_DIAGNOSTICS.has(pdfResult.diagnosticCode || '') && (!pdfResult.extractedJobs || pdfResult.extractedJobs.length === 0)) {
      return {
        jobs: [],
        extractionMethod: 'government_pdf_engine',
        totalFoundOnPage: 0
      };
    }
    if (!pdfResult.success) {
      throw mapMediaResultError(pdfResult);
    }
    if (pdfResult.formatType === 'html') {
      throw new Error(`HTML instead of PDF: Expected PDF document from ${targetPdfUrl} but server returned an HTML response`);
    }
    if (!pdfResult.extractedJobs || pdfResult.extractedJobs.length === 0) {
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
      extractedText: j.extractedText || pdfResult.fullExtractedText || pdfResult.rawTextSample,
      requirements: j.requirements || [],
      benefits: j.benefits || [],
      postedAt: j.postedAt || 'Recent',
      deadlineDate: j.deadlineDate,
      applicationsCount: 0,
      status: config.autoApprove ? 'Approved' : 'Pending',
      sourceUrl: targetPdfUrl,
      sourceJobId: j.pdfCaseNumber || undefined,
      originalApplyUrl: j.originalApplyUrl || undefined,
      applicationUrl: j.applicationUrl || undefined,
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
      pdfParserEngine: 'pdfplumber',
      advertisedPositions: j.advertisedPositions,
      totalVacancies: j.totalVacancies,
      employmentType: j.employmentType,
      ageLimit: j.ageLimit,
      minimumAge: typeof j.minimumAge === 'number' ? j.minimumAge : (j.minimumAge ? Number(j.minimumAge) : undefined),
      maximumAge: typeof j.maximumAge === 'number' ? j.maximumAge : (j.maximumAge ? Number(j.maximumAge) : undefined),
      qualificationSummary: j.qualificationSummary,
      domicile: j.domicile,
      contactEmail: j.contactEmail,
      responsibilitiesList: j.responsibilitiesList || j.responsibilities,
      relatedSourceUrls: j.relatedSourceUrls
    }));

    return {
      jobs,
      extractionMethod: 'government_pdf_engine',
      totalFoundOnPage: jobs.length
    };
  } catch (err: any) {
    console.log(`[PDF Adapter] PDF parsing note for ${config.name}: ${err?.message || err}`);
    throw err;
  }
}

/**
 * ADAPTER 5: JSON-LD Schema.org JobPosting Extractor
 */
export function extractJsonLdJobs(html: string, baseUrl: string, config: ScraperTargetConfig, options: ScrapeOptions = {}): ScrapedJobResult[] {
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
            originalApplyUrl: (item.applicationUrl || item.applyUrl) ? resolveUrl(item.applicationUrl || item.applyUrl, baseUrl) : undefined,
            applicationUrl: (item.applicationUrl || item.applyUrl) ? resolveUrl(item.applicationUrl || item.applyUrl, baseUrl) : undefined,
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
export function extractEmbeddedStateJobs(html: string, currentUrl: string, config: ScraperTargetConfig, options: ScrapeOptions = {}): ScrapedJobResult[] {
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
            originalApplyUrl: item.applyUrl ? resolveUrl(item.applyUrl, currentUrl) : undefined,
            applicationUrl: item.applyUrl ? resolveUrl(item.applyUrl, currentUrl) : undefined,
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
export function extractHtmlSemanticJobs(html: string, currentUrl: string, config: ScraperTargetConfig, options: ScrapeOptions = {}): ScrapedJobResult[] {
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
          originalApplyUrl: undefined,
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
          originalApplyUrl: undefined,
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
 * Canonicalizes a PDF/portal URL for consistent deduplication and loop prevention.
 * Rules:
 * - Lowercases protocol, host, and path
 * - Strips query parameters and hash fragments
 * - Strips trailing slashes
 * Examples:
 *  "https://example.gov/file.pdf" -> "https://example.gov/file.pdf"
 *  "https://example.gov/file.pdf?download=1" -> "https://example.gov/file.pdf"
 *  "https://example.gov/file.pdf/" -> "https://example.gov/file.pdf"
 */
function canonicalizePdfUrl(urlStr: string | undefined | null): string {
  if (!urlStr || typeof urlStr !== 'string') return '';
  const trimmed = urlStr.trim();
  if (!trimmed) return '';
  try {
    const parsed = new URL(trimmed);
    const cleanHost = parsed.hostname.toLowerCase();
    const cleanPort = parsed.port ? `:${parsed.port}` : '';
    let cleanPath = parsed.pathname.toLowerCase().replace(/\/+$/, '');
    if (!cleanPath) cleanPath = '/';
    return `${parsed.protocol}//${cleanHost}${cleanPort}${cleanPath}`;
  } catch {
    return trimmed.toLowerCase().split('?')[0].split('#')[0].replace(/\/+$/, '');
  }
}

/**
 * Evaluates whether a Government PDF error qualifies for safe official portal fallback.
 * Strictly adheres to 58-D.5 rules:
 * ALLOWED:
 *  - HTTP 404 (Not Found)
 *  - HTML returned instead of expected PDF
 *  - Empty document (0 bytes)
 *  - Invalid / corrupt PDF / binary decoding failure
 *  - HTTP 403 ONLY when the official portalUrl is a separate accessible official portal URL passing SSRF validation
 * DISALLOWED:
 *  - SSRF or security violations
 *  - HTTP 429 (Rate Limited)
 *  - Primary domain DNS failures / connection refused / unreachable network
 *  - Hard timeouts (>10s/15s / AbortError / ETIMEDOUT)
 *  - Redirect security violations
 */
function isEligibleForPortalFallback(
  err: any,
  config: ScraperTargetConfig,
  targetPdfUrl: string
): boolean {
  // 1. Confirm official portalUrl is explicitly configured on source
  const portalUrl = config.portalUrl?.trim();
  if (!portalUrl || !portalUrl.startsWith('http')) {
    return false;
  }

  // 2. portalUrl must be distinct from the failed PDF URL (canonical comparison)
  if (canonicalizePdfUrl(portalUrl) === canonicalizePdfUrl(targetPdfUrl)) {
    return false;
  }

  // 3. portalUrl must pass existing SSRF protection
  const ssrfCheck = validateSafeScrapeUrl(portalUrl);
  if (!ssrfCheck.safe) {
    return false;
  }

  // 4. Inspect error message, code, and HTTP status
  const msg = String(err?.message || err || '').toLowerCase();
  const status = Number(err?.status || err?.statusCode || err?.httpStatus || 0);

  // STRICT DISALLOWED CONDITIONS:
  // - SSRF or security rejections
  if (msg.includes('ssrf') || msg.includes('blocked') || msg.includes('security') || msg.includes('forbidden protocol')) {
    return false;
  }
  // - HTTP 429 Rate Limiting
  if (status === 429 || msg.includes('429') || msg.includes('rate limit')) {
    return false;
  }
  // - DNS failure or connection refused (remote host completely down)
  if (msg.includes('enotfound') || msg.includes('eai_again') || msg.includes('dns') || msg.includes('econnrefused') || msg.includes('offline or dns unreachable')) {
    return false;
  }
  // - Hard timeout (>10s/15s)
  if (msg.includes('timeout') || msg.includes('timed out') || msg.includes('etimedout') || msg.includes('aborterror')) {
    return false;
  }
  // - Redirect security violation
  if (msg.includes('redirect loop') || msg.includes('maximum redirect hops')) {
    return false;
  }

  // STRICT ALLOWED CONDITIONS:
  // - HTTP 404 Not Found
  if (status === 404 || msg.includes('404') || msg.includes('not found')) {
    return true;
  }
  // - HTML returned instead of expected PDF
  if (msg.includes('html instead of pdf') || msg.includes('text/html') || msg.includes('received html content')) {
    return true;
  }
  // - Empty document response (0 bytes)
  if (msg.includes('empty response') || msg.includes('0 bytes')) {
    return true;
  }
  // - Corrupt / invalid PDF binary or parsing extraction failure
  if (msg.includes('invalid pdf') || msg.includes('failed to parse pdf') || msg.includes('decoding issue') || msg.includes('pdf extraction failed') || msg.includes('exceeds maximum supported size')) {
    return true;
  }
  // - HTTP 403 ONLY when portalUrl is a separate accessible official portal URL
  if (status === 403 || msg.includes('403') || msg.includes('forbidden')) {
    return true;
  }

  return false;
}

async function scrapeDirectImagePortal(
  config: ScraperTargetConfig,
  options: ScrapeOptions,
  parseMediaFn: typeof parsePdfFromUrl = parsePdfFromUrl
): Promise<ScrapeExecutionResult | null> {
  const effectiveUrl = (config.url || config.portalUrl || config.pdfUrl || '').trim();
  if (!effectiveUrl || !effectiveUrl.startsWith('http')) return null;

  const pathWithoutQuery = effectiveUrl.toLowerCase().split('?')[0];
  if (UNSUPPORTED_IMAGE_EXTENSION_REGEX.test(pathWithoutQuery)) {
    throw new Error('Unsupported image type. Only JPG, JPEG, PNG, WEBP, and BMP are supported for recruitment document extraction.');
  }

  if (!SUPPORTED_IMAGE_EXTENSION_REGEX.test(pathWithoutQuery)) {
    return null;
  }

  const imgResult = await parseMediaFn(effectiveUrl, config.name);
  if (ZERO_VACANCY_MEDIA_DIAGNOSTICS.has(imgResult.diagnosticCode || '') && (!imgResult.extractedJobs || imgResult.extractedJobs.length === 0)) {
    return {
      jobs: [],
      extractionMethod: 'image_ocr',
      totalFoundOnPage: 0
    };
  }
  if (!imgResult.success) {
    throw mapMediaResultError(imgResult);
  }
  if (!imgResult.extractedJobs || imgResult.extractedJobs.length === 0) {
    return {
      jobs: [],
      extractionMethod: 'image_ocr',
      totalFoundOnPage: 0
    };
  }

  const jobs = mapDirectImageOcrJobs(imgResult.extractedJobs, config, effectiveUrl, imgResult, options);
  return {
    jobs,
    extractionMethod: 'image_ocr',
    totalFoundOnPage: jobs.length
  };
}

/**
 * Universal scraper pipeline for an individual target portal.
 * STRICT POLICY: NEVER invent or synthesize fake jobs.
 * 0 jobs extracted = returns empty array.
 */
export async function scrapeTargetPortal(
  config: ScraperTargetConfig,
  options: ScrapeOptions = {},
  fetchFn: typeof safeFetchWithRetry = safeFetchWithRetry,
  parseMediaFn: typeof parsePdfFromUrl = parsePdfFromUrl
): Promise<ScrapedJobResult[]> {
  const effectiveUrl = config.url || config.portalUrl || config.pdfUrl || '';
  if (!config.url && effectiveUrl) {
    config.url = effectiveUrl;
  }

  if (!effectiveUrl) {
    console.log(`[Scraper Pipeline] Portal "${config.name}" has no valid URL configured.`);
    return [];
  }

  let pdfFallbackAttempted = false;
  let originalPdfFailureNotice: string | null = null;
  const failedPdfUrls = new Set<string>();
  const adapterErrors: AdapterAttemptResult[] = [];

  try {
    // 1. Check Government PDF Adapter
    let pdfResult: ScrapeExecutionResult | null = null;
    try {
      pdfResult = await scrapeGovernmentPdfPortal(config, options, parseMediaFn);
    } catch (pdfErr: any) {
      const targetPdfUrl = (config.pdfUrl && config.pdfUrl.startsWith('http')) ? config.pdfUrl : effectiveUrl;
      if (targetPdfUrl) {
        failedPdfUrls.add(canonicalizePdfUrl(targetPdfUrl));
      }
      if (config.pdfUrl && config.pdfUrl.startsWith('http')) {
        failedPdfUrls.add(canonicalizePdfUrl(config.pdfUrl));
      }

      // Check if this error is eligible for safe official portal fallback
      const canFallback = isEligibleForPortalFallback(pdfErr, config, targetPdfUrl);
      if (!canFallback) {
        // Disallowed error or no safe distinct portalUrl: rethrow original error immediately
        throw pdfErr;
      }

      // Recoverable: proceed to official portalUrl fallback
      pdfFallbackAttempted = true;
      originalPdfFailureNotice = pdfErr?.message || 'PDF unreachable';
      console.log(`[Scraper Pipeline] PDF recovery fallback for "${config.name}": Original PDF (${sanitizeUrlForLog(targetPdfUrl)}) failed (${sanitizeSecretString(originalPdfFailureNotice)}). Recovering via official portal fallback: ${sanitizeUrlForLog(config.portalUrl || '')}`);
    }

    if (pdfResult) {
      return filterByOptions(pdfResult.jobs, options);
    }

    // 1b. Check Direct Image Advertisement URL Adapter (JPG, PNG, WEBP, BMP; never send images to HTML parser)
    if (!options.targetPageUrl) {
      const directImageResult = await scrapeDirectImagePortal(config, options, parseMediaFn);
      if (directImageResult) {
        return filterByOptions(directImageResult.jobs, options);
      }
    }

    // 2. Check Greenhouse ATS Adapter (skip API re-check when fetching subsequent HTML paginated pages)
    if (!options.targetPageUrl) {
      const ghResult = await scrapeGreenhouseApi(config, options, fetchFn);
      if (ghResult) {
        if (ghResult.status === 'success') {
          return filterByOptions(ghResult.jobs, options);
        }
        if (ghResult.status === 'empty') {
          return [];
        }
        if (ghResult.status === 'error') {
          adapterErrors.push(ghResult);
        }
      }

      // 3. Check Lever ATS Adapter
      const leverResult = await scrapeLeverApi(config, options, fetchFn);
      if (leverResult) {
        if (leverResult.status === 'success') {
          return filterByOptions(leverResult.jobs, options);
        }
        if (leverResult.status === 'empty') {
          return [];
        }
        if (leverResult.status === 'error') {
          adapterErrors.push(leverResult);
        }
      }

      // 4. Check SmartRecruiters / Ashby REST APIs
      const restResult = await scrapeRestJobApis(config, options, fetchFn);
      if (restResult) {
        if (restResult.status === 'success') {
          return filterByOptions(restResult.jobs, options);
        }
        if (restResult.status === 'empty') {
          return [];
        }
        if (restResult.status === 'error') {
          adapterErrors.push(restResult);
        }
      }
    }

    // 5. Build paginated target URL (use validated discovered targetPageUrl when provided; preserve original config.url)
    let targetUrl = (pdfFallbackAttempted && config.portalUrl) ? config.portalUrl.trim() : effectiveUrl;
    if (options.targetPageUrl) {
      const targetPageSsrf = validateSafeScrapeUrl(options.targetPageUrl);
      if (!targetPageSsrf.safe) {
        throw new Error(`Unsafe pagination URL rejected: ${targetPageSsrf.error || 'SSRF validation failed'}`);
      }
      targetUrl = options.targetPageUrl;
    } else if (options.page && options.page > 1) {
      try {
        const urlObj = new URL(targetUrl);
        urlObj.searchParams.set('page', String(options.page));
        targetUrl = urlObj.toString();
      } catch {}
    }

    // 6. Safe Fetch with SSRF protection, timeout, and retries
    const response = await fetchFn(targetUrl, {}, 10000, 1);
    if (!response || !response.ok) {
      if (response && !response.bodyUsed) {
        await cancelStream(response.body, undefined, 'Non-2xx portal HTTP response');
      }
      const status = typeof response?.status === 'number' ? response.status : 'unknown';
      console.log(`[Scraper Pipeline] Target ${config.name} (${sanitizeUrlForLog(targetUrl)}) responded with HTTP ${status}.`);
      const httpErr: any = new Error(`HTTP ${status}: Target returned status ${status}`);
      if (typeof response?.status === 'number') {
        httpErr.status = response.status;
        httpErr.statusCode = response.status;
        httpErr.httpStatus = response.status;
      }
      throw httpErr;
    }

    const finalResponseUrl = response.url || targetUrl;
    // Prevent loop if portal URL or its redirect destination matches the known failed PDF URL
    if (
      failedPdfUrls.has(canonicalizePdfUrl(targetUrl)) ||
      failedPdfUrls.has(canonicalizePdfUrl(finalResponseUrl))
    ) {
      if (!response.bodyUsed) {
        await cancelStream(response.body, undefined, 'PDF Loop Prevented');
      }
      throw new Error(`PDF Loop Prevented: Target URL or redirect destination is already known to be a failed PDF (${finalResponseUrl || targetUrl})`);
    }

    // Check Content-Type / final URL extension before reading as HTML text
    const rawContentType = (response?.headers && typeof response.headers.get === 'function' ? response.headers.get('content-type') : response?.headers?.['content-type']) || '';
    const contentType = String(rawContentType).toLowerCase();
    const cleanContentType = contentType.split(';')[0].trim();
    const finalPathLower = finalResponseUrl.toLowerCase().split('?')[0];

    if (contentType.includes('application/pdf') || finalPathLower.endsWith('.pdf')) {
      if (!response.bodyUsed) {
        await cancelStream(response.body, undefined, 'Redirected to PDF parser engine');
      }
      const pdfRes = await parseMediaFn(finalResponseUrl, config.name);
      if (ZERO_VACANCY_MEDIA_DIAGNOSTICS.has(pdfRes.diagnosticCode || '') && (!pdfRes.extractedJobs || pdfRes.extractedJobs.length === 0)) {
        return [];
      }
      if (!pdfRes.success) {
        throw mapMediaResultError(pdfRes);
      }
      if (pdfRes.formatType === 'html') {
        throw new Error(`HTML instead of PDF: Expected PDF response from ${finalResponseUrl} but received HTML content`);
      }
      if (pdfRes.extractedJobs.length > 0) {
        return filterByOptions(pdfRes.extractedJobs.map(j => ({
          ...j,
          sourcePortal: config.name,
          extractionMethod: 'government_pdf_engine',
          scrapeRunId: options.runId
        })) as any, options);
      }
      return [];
    }

    // Check for unsupported or supported image responses (never route binary images into HTML Cheerio parser)
    if (UNSUPPORTED_IMAGE_CONTENT_TYPES.has(cleanContentType) || UNSUPPORTED_IMAGE_EXTENSION_REGEX.test(finalPathLower)) {
      if (!response.bodyUsed) {
        await cancelStream(response.body, undefined, 'Unsupported image type rejected');
      }
      throw new Error('Unsupported image type. Only JPG, JPEG, PNG, WEBP, and BMP are supported for recruitment document extraction.');
    }

    if (
      cleanContentType.startsWith('image/') ||
      SUPPORTED_IMAGE_CONTENT_TYPES.has(cleanContentType) ||
      SUPPORTED_IMAGE_EXTENSION_REGEX.test(finalPathLower)
    ) {
      if (!response.bodyUsed) {
        await cancelStream(response.body, undefined, 'Routed image/* response to OCR parser');
      }
      const imgRes = await parseMediaFn(finalResponseUrl, config.name);
      if (ZERO_VACANCY_MEDIA_DIAGNOSTICS.has(imgRes.diagnosticCode || '') && (!imgRes.extractedJobs || imgRes.extractedJobs.length === 0)) {
        return [];
      }
      if (!imgRes.success) {
        throw mapMediaResultError(imgRes);
      }
      if (imgRes.extractedJobs && imgRes.extractedJobs.length > 0) {
        const mappedImgJobs = mapDirectImageOcrJobs(imgRes.extractedJobs, config, finalResponseUrl, imgRes, options);
        return filterByOptions(mappedImgJobs, options);
      }
      return [];
    }

    const html = await readBoundedResponseText(response, MAX_PORTAL_HTML_BYTES, 'Main HTML portal response');

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
          const resolved = resolveUrl(href, targetUrl);
          // Strictly prevent re-fetching the same failed PDF that triggered fallback (canonical comparison)
          if (resolved && !failedPdfUrls.has(canonicalizePdfUrl(resolved))) {
            linkedPdfUrl = resolved;
          }
        }
      });

      if (linkedPdfUrl) {
        const pdfRes = await parseMediaFn(linkedPdfUrl, config.name);
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

    const effectiveHtmlBaseUrl = finalResponseUrl || targetUrl;
    const discoveredNextPageUrl = extractNextPageUrl(html, effectiveHtmlBaseUrl);
    const attachNextPageUrl = (items: ScrapedJobResult[]) => {
      if (discoveredNextPageUrl && items.length > 0) {
        items.forEach(j => {
          if (!j.nextPageUrl) {
            j.nextPageUrl = discoveredNextPageUrl;
          }
        });
      }
      return items;
    };

    // 7. Extract JSON-LD Schema.org structured data (highest fidelity)
    const jsonLdJobs = extractJsonLdJobs(html, effectiveHtmlBaseUrl, config, options);
    if (jsonLdJobs.length > 0) {
      attachNextPageUrl(jsonLdJobs);
      if (pdfFallbackAttempted && originalPdfFailureNotice) {
        console.log(`[Scraper Pipeline] Successfully recovered ${jsonLdJobs.length} vacancies for "${config.name}" via official portal JSON-LD (${effectiveHtmlBaseUrl}) after PDF failure (${originalPdfFailureNotice}).`);
      }
      return filterByOptions(jsonLdJobs, options);
    }

    // 8. Extract JavaScript embedded state (__NEXT_DATA__, etc.)
    const jsJobs = extractEmbeddedStateJobs(html, effectiveHtmlBaseUrl, config, options);
    if (jsJobs.length > 0) {
      attachNextPageUrl(jsJobs);
      if (pdfFallbackAttempted && originalPdfFailureNotice) {
        console.log(`[Scraper Pipeline] Successfully recovered ${jsJobs.length} vacancies for "${config.name}" via official portal embedded state (${effectiveHtmlBaseUrl}) after PDF failure (${originalPdfFailureNotice}).`);
      }
      return filterByOptions(jsJobs, options);
    }

    // 9. Semantic HTML Tables and Job Cards
    const htmlJobs = extractHtmlSemanticJobs(html, effectiveHtmlBaseUrl, config, options);
    attachNextPageUrl(htmlJobs);

    // 10. Linked Image OCR (Bounded, conservative extraction for recruitment ads embedded as images)
    if (htmlJobs.length === 0 || config.isNewspaperClippingPortal) {
      const candidateImages = findCandidateRecruitmentImages(html, effectiveHtmlBaseUrl);
      if (candidateImages.length > 0) {
        console.log(`[Scraper Pipeline] Found ${candidateImages.length} recruitment image candidate(s) on ${effectiveHtmlBaseUrl}. Invoking bounded linked image OCR...`);

        const linkedImageJobs: ScrapedJobResult[] = [];
        for (const imgUrl of candidateImages) {
          const ssrfCheck = validateSafeScrapeUrl(imgUrl);
          if (!ssrfCheck.safe) {
            console.log(`[Scraper Pipeline] Candidate recruitment image skipped due to SSRF: ${ssrfCheck.error}`);
            continue;
          }

          try {
            const imgResult = await parseMediaFn(imgUrl, config.name);
            if (imgResult.success && imgResult.extractedJobs && imgResult.extractedJobs.length > 0) {
              const mapped = mapLinkedImageOcrJobs(
                imgResult.extractedJobs,
                config,
                effectiveHtmlBaseUrl,
                imgUrl,
                imgResult,
                options
              );
              linkedImageJobs.push(...mapped);
            }
          } catch (imgErr) {
            console.log(`[Scraper Pipeline] Linked image OCR notice for ${imgUrl}:`, imgErr);
          }
        }

        if (linkedImageJobs.length > 0) {
          const deduplicated = attachNextPageUrl(deduplicateJobs(htmlJobs, linkedImageJobs));
          if (pdfFallbackAttempted && originalPdfFailureNotice) {
            console.log(`[Scraper Pipeline] Successfully recovered ${deduplicated.length} vacancies for "${config.name}" via linked image OCR (${effectiveHtmlBaseUrl}) after PDF failure (${originalPdfFailureNotice}).`);
          }
          return filterByOptions(deduplicated, options);
        }
      }
    }

    if (pdfFallbackAttempted && originalPdfFailureNotice) {
      if (htmlJobs.length > 0) {
        console.log(`[Scraper Pipeline] Successfully recovered ${htmlJobs.length} vacancies for "${config.name}" via official portal semantic HTML (${effectiveHtmlBaseUrl}) after PDF failure (${originalPdfFailureNotice}).`);
      } else {
        console.log(`[Scraper Pipeline] Note for "${config.name}": Official portal fallback (${effectiveHtmlBaseUrl}) loaded successfully, but no structured vacancies were detected on page.`);
      }
    }

    const finalHtmlJobs = filterByOptions(htmlJobs, options);
    if (finalHtmlJobs.length === 0 && adapterErrors.length > 0) {
      const primaryErr = adapterErrors[0];
      const err: any = new Error(primaryErr.diagnostic || `${primaryErr.adapterName} API failed (${primaryErr.failureCategory})`);
      if (primaryErr.httpStatus) {
        err.status = primaryErr.httpStatus;
        err.statusCode = primaryErr.httpStatus;
        err.httpStatus = primaryErr.httpStatus;
      }
      throw err;
    }

    return finalHtmlJobs;
  } catch (error: any) {
    if (pdfFallbackAttempted && originalPdfFailureNotice) {
      console.log(`[Scraper Pipeline] Notice for "${config.name}" (${sanitizeUrlForLog(config.url || effectiveUrl)}): Original PDF failed (${sanitizeSecretString(originalPdfFailureNotice)}); portal fallback also failed: ${sanitizeSecretString(error?.message || 'Remote portal did not respond')}`);
      const combinedError: any = new Error(`Original PDF failed (${originalPdfFailureNotice}); portal fallback also failed: ${error?.message || 'Remote portal did not respond'}`);
      if (error?.status || error?.statusCode || error?.httpStatus) {
        combinedError.status = error.status || error.statusCode || error.httpStatus;
        combinedError.statusCode = combinedError.status;
        combinedError.httpStatus = combinedError.status;
      }
      throw combinedError;
    }

    console.log(`[Scraper Pipeline] Notice for "${config.name}" (${sanitizeUrlForLog(config.url || effectiveUrl)}): ${sanitizeSecretString(error?.message || 'Remote portal did not respond')}`);

    // Isolate static test gazette fallback strictly from production and standard real scraper runs
    if (process.env.NODE_ENV !== 'production' && process.env.ENABLE_MOCK_PDF_FALLBACK === 'true') {
      const gazette = MOCK_CONSOLIDATED_PDF_GAZETTES.find(g =>
        (config.id && g.id.toLowerCase().includes(config.id.toLowerCase().replace('portal-', ''))) ||
        (g.organization && config.name && g.organization.toLowerCase().includes(config.name.toLowerCase().split('(')[0].trim())) ||
        (g.pdfUrl && config.pdfUrl && g.pdfUrl.toLowerCase() === config.pdfUrl.toLowerCase())
      );

      if (gazette && gazette.extractedVacancies && gazette.extractedVacancies.length > 0) {
        return filterByOptions(gazette.extractedVacancies.map(j => ({
          ...j,
          sourcePortal: config.name,
          extractionMethod: 'government_pdf_engine',
          rawSourceHtml: undefined,
          scrapeRunId: options.runId
        })) as any, options);
      }
    }

    // Propagate genuine HTTP/network/PDF/HTML-instead-of-PDF error to scraperEngine
    throw error;
  }
}

/**
 * Filter results by scrape options (sinceTimestamp, toTimestamp, keywords, etc.)
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

  if (options.toTimestamp) {
    const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(options.toTimestamp.trim());
    const parsedTo = new Date(options.toTimestamp).getTime();
    const toCutoff = !isNaN(parsedTo) ? (isDateOnly ? parsedTo + 24 * 60 * 60 * 1000 - 1 : parsedTo) : NaN;
    if (!isNaN(toCutoff)) {
      filtered = filtered.filter(j => {
        if (!j.datePosted) return true;
        const postTime = new Date(j.datePosted).getTime();
        return isNaN(postTime) || postTime <= toCutoff;
      });
    }
  }

  if (options.keywords && options.keywords.trim()) {
    const keywordList = options.keywords
      .split(',')
      .map(k => k.trim().toLowerCase())
      .filter(k => k.length >= 2);
    if (keywordList.length > 0) {
      filtered = filtered.filter(j => {
        const haystack = [
          j.title,
          j.description,
          j.department,
          j.company,
          ...(Array.isArray(j.tags) ? j.tags : []),
          ...(Array.isArray(j.requirements) ? j.requirements : [])
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return keywordList.some(kw => haystack.includes(kw));
      });
    }
  }

  return filtered;
}
