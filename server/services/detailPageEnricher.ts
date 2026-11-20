import * as cheerio from 'cheerio';
import net from 'net';
import { ScrapedJobResult, ScraperTargetConfig } from '../../src/services/scraperService';
import { Region } from '../../src/types/job';
import { safeFetchWithRetry, validateSafeScrapeUrl } from '../utils/ssrfProtection';

const DATE_REGEX = /(?:\b\d{1,2}(?:st|nd|rd|th)?\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}\b|\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}\b)/i;

export const MAX_DETAIL_HTML_BYTES = 2 * 1024 * 1024; // 2 MB strict upper bound

function normalizeHostName(host: string): string {
  return host.trim().toLowerCase().replace(/^www\./, '');
}

function normalizePortForProtocol(parsed: URL): string {
  if (parsed.port) return parsed.port;
  return parsed.protocol === 'https:' ? '443' : '80';
}

function isValidHttpUrl(url?: string): boolean {
  if (!url || typeof url !== 'string' || !url.trim()) return false;
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    return validateSafeScrapeUrl(parsed.toString()).safe;
  } catch {
    return false;
  }
}

/**
 * Validates that a candidate detail-page URL (or final post-redirect response URL)
 * stays strictly within the permitted target portal origin rules:
 * - Valid HTTP/HTTPS target portal URL required
 * - Passes validateSafeScrapeUrl SSRF protections
 * - Same normalized hostname (with optional www. normalization) OR legitimate subdomain of target hostname
 * - Rejects unrelated hosts and parent-domain expansion
 * - No HTTPS-to-HTTP protocol downgrade
 * - No unexpected port change
 */
export function isPermittedDetailOrigin(
  candidateUrl: string | undefined,
  targetPortalUrl: string | undefined
): boolean {
  if (!candidateUrl || typeof candidateUrl !== 'string' || !candidateUrl.trim()) return false;
  if (!targetPortalUrl || typeof targetPortalUrl !== 'string' || !targetPortalUrl.trim()) return false;

  const trimmedCandidate = candidateUrl.trim();
  const trimmedTarget = targetPortalUrl.trim();

  if (!trimmedCandidate.startsWith('http://') && !trimmedCandidate.startsWith('https://')) return false;
  if (!trimmedTarget.startsWith('http://') && !trimmedTarget.startsWith('https://')) return false;

  const ssrfCheck = validateSafeScrapeUrl(trimmedCandidate);
  if (!ssrfCheck.safe || !ssrfCheck.parsedUrl) return false;

  let targetParsed: URL;
  try {
    targetParsed = new URL(trimmedTarget);
  } catch {
    return false;
  }

  if (targetParsed.protocol !== 'http:' && targetParsed.protocol !== 'https:') return false;

  const candidateParsed = ssrfCheck.parsedUrl;

  // Enforce no HTTPS downgrade
  if (targetParsed.protocol === 'https:' && candidateParsed.protocol !== 'https:') {
    return false;
  }

  // Enforce port match
  if (normalizePortForProtocol(candidateParsed) !== normalizePortForProtocol(targetParsed)) {
    return false;
  }

  const targetHost = normalizeHostName(targetParsed.hostname);
  const candidateHost = normalizeHostName(candidateParsed.hostname);
  if (!targetHost || !candidateHost) return false;

  const isExactSameHost = candidateHost === targetHost;
  const isTargetIp = net.isIP(targetHost) !== 0;
  const isLegitimateSubdomain = !isTargetIp && candidateHost.endsWith('.' + targetHost);

  return isExactSameHost || isLegitimateSubdomain;
}

/**
 * Validates whether a URL is a legitimate, crawlable job detail page.
 * Requires a valid target portal URL, blocks non-HTTP(S) protocols, binary/PDF file extensions,
 * circular listing URLs, external/parent domains, downgrades, port changes, and SSRF targets.
 */
export function isEligibleDetailUrl(detailUrl: string | undefined, targetPortalUrl: string | undefined): boolean {
  if (!detailUrl || typeof detailUrl !== 'string') return false;

  const trimmed = detailUrl.trim();
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) return false;

  // Skip binary/document files (already handled by specialized document parsers)
  const cleanPath = trimmed.split('?')[0].split('#')[0].toLowerCase();
  if (
    cleanPath.endsWith('.pdf') ||
    cleanPath.endsWith('.jpg') ||
    cleanPath.endsWith('.jpeg') ||
    cleanPath.endsWith('.png') ||
    cleanPath.endsWith('.gif') ||
    cleanPath.endsWith('.webp') ||
    cleanPath.endsWith('.doc') ||
    cleanPath.endsWith('.docx') ||
    cleanPath.endsWith('.xls') ||
    cleanPath.endsWith('.xlsx') ||
    cleanPath.endsWith('.zip') ||
    cleanPath.endsWith('.rar')
  ) {
    return false;
  }

  if (!isPermittedDetailOrigin(trimmed, targetPortalUrl)) {
    return false;
  }

  try {
    const targetParsed = new URL(targetPortalUrl!.trim());
    const candidateParsed = new URL(trimmed);
    const targetHost = normalizeHostName(targetParsed.hostname);
    const detailHost = normalizeHostName(candidateParsed.hostname);
    const targetPath = targetParsed.pathname.replace(/\/+$/, '');
    const detailPath = candidateParsed.pathname.replace(/\/+$/, '');

    // Prevent circular re-crawling of the exact same listing URL (when path & query match)
    if (
      detailHost === targetHost &&
      targetPath === detailPath &&
      targetParsed.search === candidateParsed.search
    ) {
      return false;
    }
  } catch {
    return false;
  }

  return true;
}

/**
 * Conservative check ensuring an un-typed or sniffed body is genuine HTML/XHTML,
 * rejecting binary payloads, PDFs, JSON, feeds, and plain text.
 */
export function isHtmlContentTypeAllowed(contentTypeHeader: string | null): 'allowed' | 'missing' | 'rejected' {
  const raw = (contentTypeHeader || '').trim().toLowerCase();
  if (!raw) return 'missing';
  const mediaType = raw.split(';')[0].trim();
  if (!mediaType) return 'missing';
  if (mediaType === 'text/html' || mediaType === 'application/xhtml+xml') {
    return 'allowed';
  }
  return 'rejected';
}

export function looksLikeHtmlDocument(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  if (text.includes('\u0000')) return false;

  const head = text.slice(0, 4096).replace(/^\uFEFF/, '').trimStart();
  if (!head) return false;

  const headLower = head.toLowerCase();
  if (
    headLower.startsWith('{') ||
    headLower.startsWith('[') ||
    headLower.startsWith('%pdf-') ||
    headLower.startsWith('<?xml') && !headLower.includes('<html') && !headLower.includes('xhtml') ||
    headLower.startsWith('<rss') ||
    headLower.startsWith('<feed')
  ) {
    return false;
  }

  const hasHtmlStartOrContainer =
    /^(?:<!doctype\s+html\b|<html[\s>]|<head[\s>]|<body[\s>]|<main[\s>]|<article[\s>]|<div[\s>]|<section[\s>]|<table[\s>])/i.test(head) ||
    /(?:<!doctype\s+html\b|<html[\s>]|<body[\s>]|<head[\s>])/i.test(head);

  const hasClosingTag = /<\/(?:html|body|head|div|section|main|article|table|p|h1|h2|script)\s*>/i.test(text);
  return hasHtmlStartOrContainer && hasClosingTag;
}

/**
 * Reads an HTTP response body cleanly with a strict byte limit, canceling the stream
 * immediately if Content-Length exceeds maxBytes or streamed bytes exceed maxBytes.
 */
export async function readBoundedHtmlResponse(
  res: Response,
  maxBytes: number = MAX_DETAIL_HTML_BYTES
): Promise<{ html: string | null; oversized: boolean }> {
  const contentLengthHeader = res.headers?.get('content-length');
  if (contentLengthHeader) {
    const declaredLength = parseInt(contentLengthHeader, 10);
    if (!isNaN(declaredLength) && declaredLength > maxBytes) {
      await res.body?.cancel?.().catch(() => {});
      return { html: null, oversized: true };
    }
  }

  if (res.body && typeof res.body.getReader === 'function') {
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;
    let streamClosedOrCancelled = false;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          streamClosedOrCancelled = true;
          break;
        }
        if (!value || value.byteLength === 0) continue;

        totalBytes += value.byteLength;
        if (totalBytes > maxBytes) {
          streamClosedOrCancelled = true;
          try {
            await reader.cancel('Detail response exceeded maximum allowed 2 MB size');
          } catch {}
          return { html: null, oversized: true };
        }
        chunks.push(value);
      }
    } catch {
      if (!streamClosedOrCancelled) {
        streamClosedOrCancelled = true;
        try {
          await reader.cancel();
        } catch {}
      }
      return { html: null, oversized: false };
    } finally {
      try {
        reader.releaseLock();
      } catch {}
    }

    const combined = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.byteLength;
    }

    return {
      html: new TextDecoder('utf-8', { fatal: false }).decode(combined),
      oversized: false
    };
  }

  // Fallback for mocked Response-like objects without ReadableStream .body.getReader()
  if (typeof res.arrayBuffer === 'function') {
    const buf = await res.arrayBuffer();
    if (buf.byteLength > maxBytes) {
      return { html: null, oversized: true };
    }
    return {
      html: new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(buf)),
      oversized: false
    };
  }

  const txt = await res.text();
  if (Buffer.byteLength(txt, 'utf8') > maxBytes) {
    return { html: null, oversized: true };
  }
  return { html: txt, oversized: false };
}

/**
 * Extracted raw attributes from a verified detail page.
 */
interface ExtractedDetailData {
  title?: string;
  company?: string;
  govtDepartment?: string;
  govtScale?: string;
  jobType?: 'Remote' | 'On-site' | 'Hybrid';
  city?: string;
  province?: string;
  region?: Region;
  salary?: string;
  vacancies?: number;
  experience?: string;
  experienceLevel?: 'Junior' | 'Mid' | 'Senior' | 'Lead';
  ageLimit?: string;
  deadlineDate?: string;
  applicationStartDate?: string;
  expiryDate?: string;
  datePosted?: string;
  description?: string;
  requirements?: string[];
  benefits?: string[];
  originalApplyUrl?: string;
}

/**
 * Fetches and extracts high-fidelity verified job details from a linked detail page.
 * Uses a strict non-destructive fallback: if detail extraction fails, redirects externally,
 * returns non-HTML/oversized content, or is incomplete, existing listing data is fully preserved.
 */
export async function enrichJobFromDetailPage(
  rawJob: ScrapedJobResult,
  portalConfig?: ScraperTargetConfig,
  fetchFn: typeof safeFetchWithRetry = safeFetchWithRetry
): Promise<ScrapedJobResult> {
  const portalUrl = portalConfig?.url || portalConfig?.portalUrl || '';
  const detailUrl = rawJob.sourceUrl;

  if (!isEligibleDetailUrl(detailUrl, portalUrl)) {
    return rawJob;
  }

  try {
    const res = await fetchFn(
      detailUrl!,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
      },
      10000,
      1
    );

    if (!res.ok) {
      try {
        if (!res.bodyUsed) await res.body?.cancel?.();
      } catch {}
      console.log(`[Detail Enrichment] Remote detail page returned HTTP ${res.status} for "${detailUrl}"`);
      return rawJob;
    }

    // Post-fetch redirect origin, protocol, port, and SSRF validation
    const finalUrl = typeof res.url === 'string' && res.url.trim().length > 0 ? res.url.trim() : detailUrl!;
    if (!isPermittedDetailOrigin(finalUrl, portalUrl)) {
      try {
        if (!res.bodyUsed) await res.body?.cancel?.();
      } catch {}
      console.warn(`[Detail Enrichment] Rejected unsafe or external final redirect URL "${finalUrl}" for "${detailUrl}"`);
      return rawJob;
    }

    const ctStatus = isHtmlContentTypeAllowed(res.headers?.get('content-type') || null);
    if (ctStatus === 'rejected') {
      try {
        if (!res.bodyUsed) await res.body?.cancel?.();
      } catch {}
      return rawJob;
    }

    const { html, oversized } = await readBoundedHtmlResponse(res, MAX_DETAIL_HTML_BYTES);
    if (oversized || !html || html.trim().length < 100) {
      return rawJob;
    }

    if (ctStatus === 'missing' && !looksLikeHtmlDocument(html)) {
      return rawJob;
    }

    if (!looksLikeHtmlDocument(html)) {
      return rawJob;
    }

    const detail = parseDetailPageHtml(html, finalUrl, portalConfig);
    return mergeDetailIntoListing(rawJob, detail, portalConfig);
  } catch (err: any) {
    console.log(`[Detail Enrichment] Notice fetching detail page "${detailUrl}": ${err?.message || err}`);
    return rawJob;
  }
}

/**
 * Parses raw HTML of a job detail page across 5 complementary extraction strategies:
 * 1. JSON-LD Schema.org JobPosting
 * 2. OpenGraph & Meta Tags
 * 3. Dedicated Semantic Description & Requirements Containers
 * 4. Key-Value & Definition Lists (Employer, Scale, Vacancies, Experience, Age, Deadline, etc.)
 * 5. Direct Apply URL Resolution
 */
function parseDetailPageHtml(html: string, currentUrl: string, portalConfig?: ScraperTargetConfig): ExtractedDetailData {
  const $ = cheerio.load(html);
  const detail: ExtractedDetailData = {};

  // ==========================================
  // STRATEGY 1: JSON-LD Structured Data
  // ==========================================
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const content = $(el).html();
      if (!content) return;
      const parsed = JSON.parse(content);
      const items = Array.isArray(parsed) ? parsed : (parsed['@graph'] || [parsed]);

      for (const item of items) {
        if (item['@type'] === 'JobPosting' || (Array.isArray(item['@type']) && item['@type'].includes('JobPosting'))) {
          if (item.title && typeof item.title === 'string' && item.title.trim().length >= 3) {
            detail.title = item.title.trim();
          }

          if (item.hiringOrganization?.name && typeof item.hiringOrganization.name === 'string') {
            const org = item.hiringOrganization.name.trim();
            if (org.length >= 2) {
              detail.company = org;
              detail.govtDepartment = org;
            }
          }

          if (item.description && typeof item.description === 'string') {
            const cleanDesc = item.description.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
            if (cleanDesc.length >= 50) {
              detail.description = cleanDesc;
            }
          }

          if (item.validThrough && typeof item.validThrough === 'string') {
            const match = item.validThrough.match(DATE_REGEX);
            detail.deadlineDate = match ? match[0] : item.validThrough.trim();
          }

          // validFrom is source-provided structured evidence for the opening date.
          if (item.validFrom && typeof item.validFrom === 'string') {
            const match = item.validFrom.match(DATE_REGEX);
            if (match) detail.applicationStartDate = match[0];
          }

          if (item.datePosted && typeof item.datePosted === 'string') {
            detail.datePosted = item.datePosted.trim();
          }

          if (item.employmentType) {
            const et = String(item.employmentType).toLowerCase();
            if (et.includes('remote')) detail.jobType = 'Remote';
            else if (et.includes('hybrid')) detail.jobType = 'Hybrid';
            else detail.jobType = 'On-site';
          }

          if (item.baseSalary) {
            const val = item.baseSalary.value;
            const curr = item.baseSalary.currency || 'PKR';
            if (typeof val === 'number') {
              detail.salary = `${curr} ${val.toLocaleString()}`;
            } else if (val && (val.minValue || val.maxValue)) {
              detail.salary = `${curr} ${val.minValue || 0} - ${val.maxValue || 0}`;
            }
          }

          if (item.jobLocation?.address) {
            const addr = item.jobLocation.address;
            if (addr.addressLocality) detail.city = addr.addressLocality;
            if (addr.addressRegion) detail.province = addr.addressRegion;
            const country = (addr.addressCountry || '').toLowerCase();
            if (country === 'pk' || country.includes('pakistan')) detail.region = 'Pakistan';
          }
        }
      }
    } catch {}
  });

  // ==========================================
  // STRATEGY 2: Meta Tags
  // ==========================================
  const ogTitle = $('meta[property="og:title"]').attr('content')?.trim();
  const ogDesc = $('meta[property="og:description"], meta[name="description"]').attr('content')?.trim();

  if (!detail.title && ogTitle && ogTitle.length >= 3 && ogTitle.length <= 150) {
    if (!/login|sign in|home|careers|welcome|job portal/i.test(ogTitle)) {
      detail.title = ogTitle;
    }
  }

  // ==========================================
  // STRATEGY 3: Clean Noise Before DOM Traversal
  // ==========================================
  $('script, style, noscript, svg, nav, header, footer, iframe, aside, .navbar, .menu, .sidebar-nav, .cookie-banner, .login-modal').remove();

  // Primary H1 heading title
  const h1 = $('h1').first().text().replace(/\s+/g, ' ').trim();
  if (h1 && h1.length >= 3 && h1.length <= 150 && !/login|sign in|register|home|careers|welcome/i.test(h1)) {
    if (!detail.title || detail.title.length < h1.length) {
      detail.title = h1;
    }
  }

  // ==========================================
  // STRATEGY 4: Employer / Organization Detection
  // ==========================================
  let detectedEmployer = '';
  $('*').each((_, el) => {
    if (detectedEmployer) return;
    const txt = $(el).clone().children().remove().end().text().trim();
    if (/^(About\s+Employer|Employer|Organization|Hiring\s+Department|Ministry|Department|Company\s*Name)$/i.test(txt)) {
      const nextTxt = $(el).next().text().trim() || $(el).parent().next().text().trim();
      if (nextTxt && nextTxt.length >= 3 && nextTxt.length < 150 && !/^(apply|share|save|login|register|home)/i.test(nextTxt)) {
        detectedEmployer = nextTxt.replace(/\s+/g, ' ');
      }
    }
  });

  if (detectedEmployer) {
    detail.company = detectedEmployer;
    detail.govtDepartment = detectedEmployer;
  }

  // ==========================================
  // STRATEGY 5: Key-Value Label Scanning (Tables, DLs, Labels)
  // ==========================================
  const labelsToScan = [
    { key: 'govtScale', patterns: [/^(Grade|BPS|Scale|Pay\s*Scale|Post\s*Scale|Govt\s*Scale)$/i] },
    { key: 'jobType', patterns: [/^(Job\s*Type|Employment\s*Type|Nature\s*of\s*Post|Position\s*Type)$/i] },
    { key: 'vacancies', patterns: [/^(Vacancies|Number\s*of\s*Posts|No\.\s*of\s*(?:Posts|Vacancies)|Total\s*Posts|Total\s*Vacancies|Positions)$/i] },
    { key: 'experience', patterns: [/^(Experience|Required\s*Experience|Min\s*Experience|Work\s*Experience)$/i] },
    { key: 'ageLimit', patterns: [/^(Age\s*Limit|Age|Maximum\s*Age|Age\s*Relaxation)$/i] },
    { key: 'applicationStartDate', patterns: [/^(Application\s*(?:Start|Opening)\s*Date|Applications?\s*(?:Open|Start)\s*Date|Opening\s*Date|Apply\s*From)$/i] },
    { key: 'expiryDate', patterns: [/^(Job\s*Expiry\s*Date|Posting\s*Expiry\s*Date|Vacancy\s*Expiry\s*Date)$/i] },
    { key: 'deadline', patterns: [/^(Application\s*Deadline|Deadline|Last\s*Date(?:\s*to\s*Apply)?|Closing\s*Date|Valid\s*Through|Apply\s*Before)$/i] },
    { key: 'location', patterns: [/^(Location|Place\s*of\s*Posting|Station|City|District|Province|Domicile)$/i] },
    { key: 'salary', patterns: [/^(Salary|Pay\s*Package|Remuneration|Pay)$/i] }
  ];

  const kvData: Record<string, string> = {};

  // A. Table rows
  $('tr').each((_, tr) => {
    const th = $(tr).find('th, td').first().text().trim();
    const td = $(tr).find('td').last().text().trim();
    if (th && td && th !== td && th.length < 50 && td.length < 200) {
      for (const item of labelsToScan) {
        if (kvData[item.key]) continue;
        for (const pat of item.patterns) {
          if (pat.test(th)) {
            kvData[item.key] = td.replace(/\s+/g, ' ');
            break;
          }
        }
      }
    }
  });

  // B. Definition lists
  $('dt').each((_, dt) => {
    const key = $(dt).text().trim();
    const val = $(dt).next('dd').text().trim();
    if (key && val && key.length < 50 && val.length < 200) {
      for (const item of labelsToScan) {
        if (kvData[item.key]) continue;
        for (const pat of item.patterns) {
          if (pat.test(key)) {
            kvData[item.key] = val.replace(/\s+/g, ' ');
            break;
          }
        }
      }
    }
  });

  // C. Direct label tags (strong, b, span, div, etc.)
  $('*').each((_, el) => {
    const txt = $(el).clone().children().remove().end().text().trim();
    if (!txt || txt.length > 40) return;

    for (const item of labelsToScan) {
      if (kvData[item.key]) continue;
      for (const pat of item.patterns) {
        if (pat.test(txt)) {
          const nextVal = $(el).next().text().trim() || $(el).parent().next().text().trim();
          if (nextVal && nextVal.length > 0 && nextVal.length < 200) {
            kvData[item.key] = nextVal.replace(/\s+/g, ' ');
          }
          break;
        }
      }
    }
  });

  // Populate structured fields from KV data
  if (kvData.govtScale) {
    detail.govtScale = kvData.govtScale;
  }

  if (kvData.jobType && !detail.jobType) {
    const jtLower = kvData.jobType.toLowerCase();
    if (jtLower.includes('remote')) detail.jobType = 'Remote';
    else if (jtLower.includes('hybrid')) detail.jobType = 'Hybrid';
    else detail.jobType = 'On-site';
  }

  if (kvData.vacancies) {
    const vMatch = kvData.vacancies.match(/\b(\d+)\b/);
    if (vMatch) {
      detail.vacancies = parseInt(vMatch[1], 10);
    }
  }

  if (kvData.experience) {
    detail.experience = kvData.experience;
    const expLower = kvData.experience.toLowerCase();
    if (expLower.includes('senior') || /\b(?:5|6|7|8|9|10)\+?\s*years?\b/i.test(expLower)) {
      detail.experienceLevel = 'Senior';
    } else if (/\b(?:3|4)\+?\s*years?\b/i.test(expLower)) {
      detail.experienceLevel = 'Mid';
    } else if (/\b(?:1|2)\+?\s*years?\b/i.test(expLower)) {
      detail.experienceLevel = 'Junior';
    }
  }

  if (kvData.ageLimit) {
    detail.ageLimit = kvData.ageLimit;
  }

  if (kvData.applicationStartDate && !detail.applicationStartDate) {
    const startMatch = kvData.applicationStartDate.match(DATE_REGEX);
    if (startMatch) detail.applicationStartDate = startMatch[0];
  }

  if (kvData.expiryDate) {
    const expiryMatch = kvData.expiryDate.match(DATE_REGEX);
    if (expiryMatch) detail.expiryDate = expiryMatch[0];
  }

  if (kvData.deadline && !detail.deadlineDate) {
    const dMatch = kvData.deadline.match(DATE_REGEX);
    detail.deadlineDate = dMatch ? dMatch[0] : kvData.deadline;
  }

  if (kvData.location && !detail.city) {
    detail.city = kvData.location;
  }

  if (kvData.salary && !detail.salary) {
    detail.salary = kvData.salary;
  }

  // ==========================================
  // STRATEGY 6: Dedicated Description Container
  // ==========================================
  const descContainer = $(
    '#job-description-container, #job-description, .job-description, #jobDescription, .job-details, #job-details, .job-body, .description-content, [itemprop="description"], .vacancy-desc, .job-detail-content'
  ).first();

  let descText = '';
  if (descContainer.length > 0) {
    descText = descContainer.text().replace(/\s+/g, ' ').trim();
  } else if (!detail.description && ogDesc && ogDesc.length >= 50) {
    descText = ogDesc;
  }

  if (descText && descText.length >= 50) {
    detail.description = descText;
  }

  // ==========================================
  // STRATEGY 7: Dedicated Qualifications Container
  // ==========================================
  const qualContainer = $('#qualifications-container, .qualifications, #requirements, .requirements, [itemprop="qualifications"]').first();
  const reqItems: string[] = [];
  if (qualContainer.length > 0) {
    qualContainer.find('li, div.badge, span, p').each((_, qEl) => {
      const qTxt = $(qEl).text().replace(/\s+/g, ' ').trim();
      if (qTxt.length >= 3 && qTxt.length <= 150 && !reqItems.includes(qTxt)) {
        reqItems.push(qTxt);
      }
    });
  }

  if (reqItems.length > 0) {
    detail.requirements = reqItems;
  }

  // ==========================================
  // STRATEGY 8: Direct Apply Link Extraction
  // ==========================================
  let applyHref = '';
  $('a[href]').each((_, el) => {
    if (applyHref) return;
    const aText = $(el).text().trim().toLowerCase();
    const href = $(el).attr('href') || '';
    if (
      (aText === 'apply now' || aText === 'apply' || aText.includes('login to apply') || aText.includes('online apply')) &&
      !href.startsWith('#') &&
      !href.startsWith('javascript:')
    ) {
      try {
        const resolved = new URL(href.trim(), currentUrl);
        if (
          (resolved.protocol === 'http:' || resolved.protocol === 'https:') &&
          validateSafeScrapeUrl(resolved.toString()).safe
        ) {
          applyHref = resolved.toString();
        }
      } catch {}
    }
  });

  if (applyHref) {
    detail.originalApplyUrl = applyHref;
  }

  return detail;
}

/**
 * Merges extracted detail page data into the existing listing job.
 * Follows strict non-destructive merge rules:
 * - If detail page provides verified, non-empty data, merge it.
 * - If detail page is missing a field, PRESERVE existing listing value.
 * - Never replace valid data with null, undefined, or empty string.
 */
function mergeDetailIntoListing(
  listing: ScrapedJobResult,
  detail: ExtractedDetailData,
  portalConfig?: ScraperTargetConfig
): ScrapedJobResult {
  const merged: ScrapedJobResult = { ...listing };

  // 1. Title: Prefer detail title if more descriptive
  if (detail.title && detail.title.length >= 3) {
    if (!listing.title || listing.title.toLowerCase() === 'untitled position' || listing.title.length < detail.title.length) {
      merged.title = detail.title;
    }
  }

  // 2. Company / Employer: Prefer specific employer over generic portal name
  if (detail.company && detail.company.length >= 2) {
    const isGenericPortalName =
      !listing.company ||
      listing.company.toLowerCase().includes('portal') ||
      listing.company.toLowerCase().includes('directory') ||
      listing.company.toLowerCase().includes('careers') ||
      (portalConfig?.name && listing.company.toLowerCase() === portalConfig.name.toLowerCase());

    if (isGenericPortalName || listing.company.length < detail.company.length) {
      merged.company = detail.company;
    }
  }

  if (detail.govtDepartment) {
    merged.govtDepartment = detail.govtDepartment;
  }

  // 3. Government Scale & Categorization
  if (detail.govtScale) {
    merged.govtScale = detail.govtScale;
    merged.isGovtJob = true;
  }

  // 4. Job Description: Use richer detail description
  if (detail.description && detail.description.length >= 50) {
    const isListingBoilerplate =
      !listing.description ||
      listing.description.length < 150 ||
      listing.description.toLowerCase().includes('visit source url') ||
      listing.description.toLowerCase().includes('official vacancy listed on') ||
      listing.description.toLowerCase().includes('refer to original url');

    if (isListingBoilerplate || detail.description.length > (listing.description?.length || 0)) {
      merged.description = detail.description;
    }
  }

  // 5. Requirements & Experience: Merge without duplicates
  const reqSet = new Set<string>(listing.requirements || []);
  if (detail.experience) {
    reqSet.add(`Experience: ${detail.experience}`);
  }
  if (detail.ageLimit) {
    reqSet.add(`Age Limit: ${detail.ageLimit}`);
  }
  if (detail.requirements && detail.requirements.length > 0) {
    for (const r of detail.requirements) {
      reqSet.add(r);
    }
  }
  if (reqSet.size > 0) {
    merged.requirements = Array.from(reqSet);
  }

  // 6. Structured metadata extensions
  if (detail.vacancies && detail.vacancies > 0) {
    merged.pdfTotalVacanciesInCase = detail.vacancies;
  }

  if (detail.ageLimit) {
    merged.ageRelaxationNote = detail.ageLimit;
  }

  if (detail.applicationStartDate && !listing.applicationStartDate) {
    merged.applicationStartDate = detail.applicationStartDate;
  }

  if (detail.expiryDate && !listing.expiryDate) {
    merged.expiryDate = detail.expiryDate;
  }

  if (detail.deadlineDate) {
    merged.deadlineDate = detail.deadlineDate;
  }

  if (detail.jobType) {
    merged.jobType = detail.jobType;
  }

  if (detail.experienceLevel && (!listing.experienceLevel || listing.experienceLevel === 'Mid')) {
    merged.experienceLevel = detail.experienceLevel;
  }

  if (detail.city && !listing.city) {
    merged.city = detail.city;
  }

  if (detail.province && !listing.province) {
    merged.province = detail.province;
  }

  if (detail.region) {
    merged.region = detail.region;
  }

  if (detail.salary && (!listing.salary || listing.salary.toLowerCase() === 'salary not disclosed')) {
    merged.salary = detail.salary;
  }

  if (!isValidHttpUrl(listing.originalApplyUrl) && isValidHttpUrl(detail.originalApplyUrl)) {
    merged.originalApplyUrl = detail.originalApplyUrl;
  }
  // Fill the user-facing destination only when absent; preserve any existing URL.
  if (!isValidHttpUrl(listing.applicationUrl) && isValidHttpUrl(detail.originalApplyUrl)) {
    merged.applicationUrl = detail.originalApplyUrl;
  }

  return merged;
}

/**
 * Enriches a batch of scraped listing results with controlled concurrency.
 * Caps simultaneous detail requests (concurrency: 3) to prevent remote server strain.
 * Gracefully handles any individual job detail fetch failure without discarding the job.
 */
export async function enrichScrapedJobsBatch(
  jobs: ScrapedJobResult[],
  portalConfig?: ScraperTargetConfig,
  concurrency = 3,
  fetchFn: typeof safeFetchWithRetry = safeFetchWithRetry
): Promise<ScrapedJobResult[]> {
  if (!Array.isArray(jobs) || jobs.length === 0) return [];

  const results: ScrapedJobResult[] = new Array(jobs.length);
  let currentIndex = 0;

  async function worker() {
    while (currentIndex < jobs.length) {
      const idx = currentIndex++;
      const item = jobs[idx];
      try {
        results[idx] = await enrichJobFromDetailPage(item, portalConfig, fetchFn);
      } catch (err: any) {
        console.log(`[Detail Enrichment Batch] Notice on index ${idx} (${item.title}): ${err?.message || err}`);
        results[idx] = item; // Guaranteed non-destructive fallback
      }
    }
  }

  const workerCount = Math.min(concurrency, jobs.length);
  const workers = Array.from({ length: workerCount }, () => worker());
  await Promise.all(workers);

  return results;
}
