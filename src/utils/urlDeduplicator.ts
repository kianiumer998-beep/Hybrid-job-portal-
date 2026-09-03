import { OfficialGovtPdfPortal } from '../data/mockPdfConsolidatedAds';
import { ConsolidatedPdfGazette, Job } from '../types/job';

export interface AnalyzedUrlResult {
  rawUrl: string;
  normalizedUrl: string;
  domain: string;
  status: 'unique' | 'duplicate' | 'invalid';
  duplicateReason?: string;
  existingPortalName?: string;
  detectedName: string;
  detectedOrg: string;
  detectedFormat: 'PDF Advertisement (pdfplumber)' | 'Structured HTML Table (BeautifulSoup)' | 'Dynamic JavaScript / REST Endpoint' | 'ASPX / PHP Secure Form' | 'International Remote / NGO Feed';
  detectedSector: string;
  detectedJurisdiction: string;
  detectedCrawlerMethod: string;
  requiredHeaders: {
    userAgent: string;
    referer?: string;
    sslVerification: boolean;
    timeoutSeconds: number;
  };
}

export interface BatchAnalysisSummary {
  totalInputLines: number;
  totalUrlsExtracted: number;
  uniqueCount: number;
  duplicateCount: number;
  invalidCount: number;
  results: AnalyzedUrlResult[];
}

/**
 * Normalizes a URL for robust comparison:
 * - Lowercases domain
 * - Strips http/https difference (normalizes to standard)
 * - Strips 'www.' prefix
 * - Strips trailing slashes
 * - Strips standard tracking queries (utm_*, ref, fbclid)
 */
export function normalizeUrl(rawUrl: string): string {
  try {
    let clean = rawUrl.trim();
    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
      clean = 'https://' + clean;
    }
    const parsed = new URL(clean);
    
    // Remove www.
    let hostname = parsed.hostname.toLowerCase();
    if (hostname.startsWith('www.')) {
      hostname = hostname.substring(4);
    }
    
    // Normalize path (remove trailing slashes)
    let pathname = parsed.pathname.replace(/\/+$/, '');
    if (!pathname) pathname = '';

    // Filter out common tracking query params
    const searchParams = new URLSearchParams();
    parsed.searchParams.forEach((val, key) => {
      const lower = key.toLowerCase();
      if (!lower.startsWith('utm_') && lower !== 'ref' && lower !== 'fbclid' && lower !== 'gclid') {
        searchParams.append(key, val);
      }
    });

    const searchStr = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return `${hostname}${pathname}${searchStr}`;
  } catch {
    return rawUrl.trim().toLowerCase().replace(/\/+$/, '');
  }
}

/**
 * Intelligent detector for Pakistani and international recruitment portals
 */
export function detectPortalMetadata(rawUrl: string): Omit<AnalyzedUrlResult, 'rawUrl' | 'normalizedUrl' | 'status' | 'duplicateReason' | 'existingPortalName'> {
  let urlLower = rawUrl.toLowerCase();
  let domain = '';
  try {
    const parsed = new URL(rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`);
    domain = parsed.hostname.replace(/^www\./, '');
  } catch {
    domain = rawUrl.split('/')[0];
  }

  let detectedName = 'Government Recruitment Portal';
  let detectedOrg = 'Public Sector Department';
  let detectedSector = 'Federal & Autonomous';
  let detectedJurisdiction = 'Federal';
  let detectedFormat: AnalyzedUrlResult['detectedFormat'] = 'Structured HTML Table (BeautifulSoup)';
  let detectedCrawlerMethod = 'BeautifulSoup (HTML Table Parser)';
  let sslVerification = true;

  // Format detection
  if (urlLower.endsWith('.pdf') || urlLower.includes('.pdf?') || urlLower.includes('/pdf/') || urlLower.includes('gazette') || urlLower.includes('advertisement') || urlLower.includes('advt')) {
    detectedFormat = 'PDF Advertisement (pdfplumber)';
    detectedCrawlerMethod = 'pdfplumber OCR + Text Pipeline (BPS Table Extraction)';
  } else if (urlLower.includes('.aspx') || urlLower.includes('.asp') || urlLower.includes('.php?') || urlLower.includes('login') || urlLower.includes('apply')) {
    detectedFormat = 'ASPX / PHP Secure Form';
    detectedCrawlerMethod = 'Python requests + __VIEWSTATE / Session Token Auth';
  } else if (urlLower.includes('/api/') || urlLower.includes('careers') || urlLower.includes('jobs') || domain.includes('rozee') || domain.includes('undp') || domain.includes('unicef')) {
    detectedFormat = 'Dynamic JavaScript / REST Endpoint';
    detectedCrawlerMethod = 'Selenium Headless / REST JSON Ingestion';
  }

  // Domain specific Pakistani intelligence
  if (domain.includes('fpsc.gov.pk')) {
    detectedName = 'Federal Public Service Commission (FPSC)';
    detectedOrg = 'Federal Public Service Commission';
    detectedSector = 'Federal & Autonomous';
    detectedJurisdiction = 'Federal';
    detectedFormat = 'PDF Advertisement (pdfplumber)';
    detectedCrawlerMethod = 'pdfplumber (Consolidated Federal Gazette)';
  } else if (domain.includes('ppsc.gop.pk')) {
    detectedName = 'Punjab Public Service Commission (PPSC)';
    detectedOrg = 'Punjab Public Service Commission';
    detectedSector = 'Provincial & Local / Municipal';
    detectedJurisdiction = 'Punjab';
  } else if (domain.includes('spsc.gos.pk')) {
    detectedName = 'Sindh Public Service Commission (SPSC)';
    detectedOrg = 'Sindh Public Service Commission';
    detectedSector = 'Provincial & Local / Municipal';
    detectedJurisdiction = 'Sindh';
  } else if (domain.includes('kppsc.gov.pk')) {
    detectedName = 'Khyber Pakhtunkhwa Public Service Commission (KPPSC)';
    detectedOrg = 'KP Public Service Commission';
    detectedSector = 'Provincial & Local / Municipal';
    detectedJurisdiction = 'Khyber Pakhtunkhwa';
  } else if (domain.includes('bpsc.gob.pk')) {
    detectedName = 'Balochistan Public Service Commission (BPSC)';
    detectedOrg = 'Balochistan Public Service Commission';
    detectedSector = 'Provincial & Local / Municipal';
    detectedJurisdiction = 'Balochistan';
  } else if (domain.includes('njp.gov.pk') || domain.includes('jobs.gov.pk')) {
    detectedName = 'National Job Portal (NJP Pakistan)';
    detectedOrg = 'Ministry of IT & Telecom';
    detectedSector = 'Federal & Autonomous';
    detectedJurisdiction = 'Federal';
  } else if (domain.includes('nts.org.pk')) {
    detectedName = 'National Testing Service (NTS Pakistan)';
    detectedOrg = 'National Testing Service';
    detectedSector = 'Higher Education & Training';
    detectedJurisdiction = 'Federal';
  } else if (domain.includes('ots.org.pk')) {
    detectedName = 'Open Testing Service (OTS)';
    detectedOrg = 'Open Testing Service';
    detectedSector = 'Higher Education & Training';
    detectedJurisdiction = 'Federal';
  } else if (domain.includes('joinpakarmy.gov.pk')) {
    detectedName = 'Pakistan Army Official Recruitment';
    detectedOrg = 'Pakistan Army (GHQ Rawalpindi)';
    detectedSector = 'Law Enforcement & Security';
    detectedJurisdiction = 'Federal';
  } else if (domain.includes('joinpaknavy.gov.pk')) {
    detectedName = 'Pakistan Navy Recruitment Directorate';
    detectedOrg = 'Pakistan Navy (NHQ Islamabad)';
    detectedSector = 'Law Enforcement & Security';
    detectedJurisdiction = 'Federal';
  } else if (domain.includes('joinpaf.gov.pk')) {
    detectedName = 'Pakistan Air Force (PAF Selection)';
    detectedOrg = 'Pakistan Air Force (AHQ)';
    detectedSector = 'Law Enforcement & Security';
    detectedJurisdiction = 'Federal';
  } else if (domain.includes('punjabpolice.gov.pk')) {
    detectedName = 'Punjab Police Department';
    detectedOrg = 'Punjab Police Headquarters';
    detectedSector = 'Law Enforcement & Security';
    detectedJurisdiction = 'Punjab';
  } else if (domain.includes('sindhpolice.gov.pk')) {
    detectedName = 'Sindh Police Recruitment Cell';
    detectedOrg = 'Sindh Police Central Office';
    detectedSector = 'Law Enforcement & Security';
    detectedJurisdiction = 'Sindh';
  } else if (domain.includes('kppolice.gov.pk')) {
    detectedName = 'KP Police Directorate of IT & Recruitment';
    detectedOrg = 'Khyber Pakhtunkhwa Police';
    detectedSector = 'Law Enforcement & Security';
    detectedJurisdiction = 'Khyber Pakhtunkhwa';
  } else if (domain.includes('wapda.gov.pk')) {
    detectedName = 'WAPDA Official Careers';
    detectedOrg = 'Water & Power Development Authority';
    detectedSector = 'Federal & Autonomous';
    detectedJurisdiction = 'Federal';
  } else if (domain.includes('pakrail.gov.pk') || domain.includes('pakistanrailways.gov.pk')) {
    detectedName = 'Pakistan Railways Recruitment';
    detectedOrg = 'Ministry of Railways';
    detectedSector = 'Federal & Autonomous';
    detectedJurisdiction = 'Federal';
  } else if (domain.includes('undp.org') || domain.includes('unicef.org') || domain.includes('who.int')) {
    detectedName = `${domain.toUpperCase().split('.')[0]} Pakistan Mission`;
    detectedOrg = 'United Nations Agency';
    detectedSector = 'International & UN Agencies';
    detectedJurisdiction = 'International';
    detectedFormat = 'Dynamic JavaScript / REST Endpoint';
    detectedCrawlerMethod = 'REST JSON Ingestion';
  } else {
    // Derive generic name from domain
    const cleanDomain = domain.replace(/\.(gov|gop|gos|gob|org|com|edu|net)\.pk$/, '').replace(/\.(com|org|net|edu)$/, '');
    const capitalized = cleanDomain.charAt(0).toUpperCase() + cleanDomain.slice(1);
    detectedName = `${capitalized} Recruitment Portal`;
    detectedOrg = `${capitalized} Department / Organization`;

    if (domain.includes('punjab') || domain.includes('gop.pk')) detectedJurisdiction = 'Punjab';
    else if (domain.includes('sindh') || domain.includes('gos.pk')) detectedJurisdiction = 'Sindh';
    else if (domain.includes('kp.gov') || domain.includes('kpk')) detectedJurisdiction = 'Khyber Pakhtunkhwa';
    else if (domain.includes('balochistan') || domain.includes('gob.pk')) detectedJurisdiction = 'Balochistan';
    else if (domain.includes('ajk.gov')) detectedJurisdiction = 'AJK';
  }

  // Handle government portals with self-signed SSL certs
  if (domain.endsWith('.gov.pk') || domain.endsWith('.gop.pk') || domain.endsWith('.gos.pk') || domain.endsWith('.gob.pk')) {
    sslVerification = false; // Bypass SSL errors common in Pakistani gov certs
  }

  return {
    domain,
    detectedName,
    detectedOrg,
    detectedFormat,
    detectedSector,
    detectedJurisdiction,
    detectedCrawlerMethod,
    requiredHeaders: {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      referer: rawUrl,
      sslVerification,
      timeoutSeconds: 25
    }
  };
}

/**
 * Processes a raw text block containing multiple links, extracts all valid URLs,
 * performs rigorous deduplication against:
 * 1) The pasted batch itself
 * 2) Existing verified scraper portals
 * 3) Existing registered gazettes/custom sites
 */
export function analyzeBatchUrls(
  rawInput: string,
  existingPortals: OfficialGovtPdfPortal[],
  existingGazettes: ConsolidatedPdfGazette[]
): BatchAnalysisSummary {
  if (!rawInput || !rawInput.trim()) {
    return {
      totalInputLines: 0,
      totalUrlsExtracted: 0,
      uniqueCount: 0,
      duplicateCount: 0,
      invalidCount: 0,
      results: []
    };
  }

  // Build lookup sets of existing normalized URLs
  const existingUrlMap = new Map<string, string>(); // normalizedUrl -> Portal Name

  existingPortals.forEach(p => {
    if (p.portalUrl) {
      existingUrlMap.set(normalizeUrl(p.portalUrl), p.name);
    }
    if (p.pdfUrl) {
      existingUrlMap.set(normalizeUrl(p.pdfUrl), `${p.name} (PDF)`);
    }
  });

  existingGazettes.forEach(g => {
    if (g.pdfUrl) {
      existingUrlMap.set(normalizeUrl(g.pdfUrl), g.title);
    }
  });

  // Extract URLs using regex from text
  const urlRegex = /(https?:\/\/[^\s"',<>]+)|([a-zA-Z0-9-]+\.(gov\.pk|gop\.pk|gos\.pk|gob\.pk|org\.pk|edu\.pk|com\.pk|org|edu|com|net)[^\s"',<>]*)/gi;
  const matches: string[] = rawInput.match(urlRegex) || [];

  const seenInBatch = new Set<string>();
  const results: AnalyzedUrlResult[] = [];
  let uniqueCount = 0;
  let duplicateCount = 0;
  let invalidCount = 0;

  // Split lines for stats
  const lines = rawInput.split('\n').filter(l => l.trim().length > 0);

  matches.forEach(rawMatch => {
    let cleanMatch = rawMatch.trim();
    if (!cleanMatch.startsWith('http://') && !cleanMatch.startsWith('https://')) {
      cleanMatch = 'https://' + cleanMatch;
    }

    try {
      new URL(cleanMatch); // Validate URL structure
      const normalized = normalizeUrl(cleanMatch);

      // Check if duplicate in batch
      if (seenInBatch.has(normalized)) {
        duplicateCount++;
        const meta = detectPortalMetadata(cleanMatch);
        results.push({
          rawUrl: cleanMatch,
          normalizedUrl: normalized,
          domain: meta.domain,
          status: 'duplicate',
          duplicateReason: 'Duplicate within this pasted list (repeated link)',
          ...meta
        });
        return;
      }
      seenInBatch.add(normalized);

      // Check if duplicate against existing registry
      if (existingUrlMap.has(normalized)) {
        const existingName = existingUrlMap.get(normalized);
        duplicateCount++;
        const meta = detectPortalMetadata(cleanMatch);
        results.push({
          rawUrl: cleanMatch,
          normalizedUrl: normalized,
          domain: meta.domain,
          status: 'duplicate',
          duplicateReason: `Already registered in system as: "${existingName}"`,
          existingPortalName: existingName,
          ...meta
        });
        return;
      }

      // Check if matching domain has exact same endpoint
      const meta = detectPortalMetadata(cleanMatch);
      uniqueCount++;
      results.push({
        rawUrl: cleanMatch,
        normalizedUrl: normalized,
        domain: meta.domain,
        status: 'unique',
        ...meta
      });
    } catch {
      invalidCount++;
      results.push({
        rawUrl: rawMatch,
        normalizedUrl: rawMatch,
        domain: 'invalid-domain',
        status: 'invalid',
        duplicateReason: 'Malformed URL format',
        detectedName: 'Invalid Link',
        detectedOrg: 'Unknown',
        detectedFormat: 'Structured HTML Table (BeautifulSoup)',
        detectedSector: 'Federal & Autonomous',
        detectedJurisdiction: 'Federal',
        detectedCrawlerMethod: 'N/A',
        requiredHeaders: {
          userAgent: 'Mozilla/5.0',
          sslVerification: false,
          timeoutSeconds: 10
        }
      });
    }
  });

  return {
    totalInputLines: lines.length,
    totalUrlsExtracted: matches.length,
    uniqueCount,
    duplicateCount,
    invalidCount,
    results
  };
}
