/**
 * Pure Smart Source Classification Logic (58-E.5 Phase 1)
 *
 * Strictly isolated pure TypeScript utility for deriving source classification
 * and extraction capability metadata from existing source records.
 *
 * ABSOLUTE SAFETY RULES:
 * - 100% deterministic, side-effect free.
 * - ZERO database calls (no MongoDB).
 * - ZERO network/HTTP calls.
 * - ZERO mutation of input source records.
 * - ZERO integration with existing scraper execution or "Scrape Now" controls.
 * - NEVER deletes, disables, or alters any source or URL.
 */

import type { ScraperTargetConfig } from './scraperService';

/**
 * Standardized extraction capability types.
 * Avoids single-format limitations by allowing multiple capabilities per source.
 */
export type ExtractionCapability = 'PDF' | 'HTML' | 'Portal' | 'Detail Page' | 'JSON-LD';

/**
 * High-level three-tier operational status.
 * Mutually exclusive derived summary of current health and historical reliability.
 */
export type OverallSourceStatus = 'Working' | 'Partial' | 'Unavailable' | 'Configured / Not Yet Verified';

/**
 * Structural input interface for any classifiable scraper source.
 * Compatible with ScraperTargetConfig, MongoDB documents, and UI ScraperSourceItem
 * without creating circular dependencies.
 */
export interface ClassifiableSourceInput {
  id: string;
  name: string;
  url?: string;
  portalUrl?: string;
  pdfUrl?: string;
  formatType?: string;
  crawlerMethod?: string;
  status?: string;
  healthStatus?: string;
  scrapedCount?: number;
  lastSuccessfulScrapeAt?: string;
  lastCompletedAt?: string;
  lastErrorMessage?: string;
  lastHttpStatus?: number;
  /**
   * Optional verified extraction methods from past successful job records
   * (e.g. ['government_pdf_engine', 'html_cheerio', 'json_ld']).
   */
  provenExtractionMethods?: string[];
  hasDetailPageEnrichment?: boolean;
  hasStructuredData?: boolean;
  [key: string]: any;
}

/**
 * Derived classification metadata for a scraper source.
 */
export interface SourceClassification {
  /**
   * High-level operational status derived conservatively:
   * - Working: Verified working or credible historical success with no active serious failure.
   * - Configured / Not Yet Verified: Newly configured source awaiting first verification / execution.
   * - Partial: Historically proven with a current recoverable error, or mixed/partial signals.
   * - Unavailable: Sustained unreachable/network failure. (May still be historically proven).
   */
  overallStatus: OverallSourceStatus;

  /**
   * Permanent historical protection:
   * True if reliable evidence confirms at least one genuine successful extraction (scrapedCount > 0 or valid lastSuccessfulScrapeAt).
   * A subsequent transient error (404, 403, timeout, etc.) NEVER resets this to false.
   */
  historicallyProven: boolean;

  /**
   * Capabilities verified by actual extraction evidence.
   * Configured infrastructure (e.g., mere presence of a URL) does NOT qualify.
   */
  provenCapabilities: ExtractionCapability[];

  /**
   * Capabilities configured on the source infrastructure (URLs, declared formats, adapters).
   */
  configuredCapabilities: ExtractionCapability[];

  /**
   * Human-readable explanation of why this classification was assigned.
   */
  statusReason: string;
}

/**
 * Evaluates whether a source has reliable historical proof of genuine successful job extraction.
 *
 * Protection rules:
 * - Returns true ONLY if scrapedCount > 0 OR lastSuccessfulScrapeAt is a valid non-zero timestamp.
 * - Arbitrary, manually supplied, or unverified provenExtractionMethods tags NEVER establish historical proof.
 * - A subsequent run failure (404, 403, Timeout, Invalid PDF, etc.) NEVER clears historical success.
 */
export function isHistoricallyProven(source: ClassifiableSourceInput): boolean {
  if (!source) return false;

  // 1. Direct cumulative extraction count
  if (typeof source.scrapedCount === 'number' && Number.isFinite(source.scrapedCount) && source.scrapedCount > 0) {
    return true;
  }

  // 2. Verified last successful scrape timestamp
  if (typeof source.lastSuccessfulScrapeAt === 'string') {
    const trimmed = source.lastSuccessfulScrapeAt.trim();
    if (trimmed.length > 0) {
      const timeMs = new Date(trimmed).getTime();
      if (!isNaN(timeMs) && timeMs > 0) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Derives the configured capabilities declared in the source's infrastructure.
 * Note: Configured capability DOES NOT equal proven capability.
 */
export function getConfiguredCapabilities(source: ClassifiableSourceInput): ExtractionCapability[] {
  if (!source) return [];

  const capabilities = new Set<ExtractionCapability>();

  const url = (source.url || '').toLowerCase();
  const portalUrl = (source.portalUrl || '').toLowerCase();
  const pdfUrl = (source.pdfUrl || '').toLowerCase();
  const formatType = (source.formatType || '').toLowerCase();
  const crawlerMethod = (source.crawlerMethod || '').toLowerCase();

  // 1. Configured PDF
  const hasExplicitPdfUrl = pdfUrl.trim().startsWith('http');
  const urlEndsWithPdf = url.split('?')[0].endsWith('.pdf') || portalUrl.split('?')[0].endsWith('.pdf');
  const formatIndicatesPdf = formatType.includes('pdf') || crawlerMethod.includes('pdf');
  if (hasExplicitPdfUrl || urlEndsWithPdf || formatIndicatesPdf) {
    capabilities.add('PDF');
  }

  // 2. Configured HTML
  const hasPortalUrl = portalUrl.trim().startsWith('http');
  const formatIndicatesHtml = formatType.includes('html') || crawlerMethod.includes('cheerio') || crawlerMethod.includes('html');
  if (hasPortalUrl || formatIndicatesHtml) {
    capabilities.add('HTML');
  }

  // 3. Configured Portal
  const hasValidPortalEndpoint = hasPortalUrl || (url.startsWith('http') && !urlEndsWithPdf);
  if (hasValidPortalEndpoint) {
    capabilities.add('Portal');
  }

  // 4. Configured Detail Page
  const methodIndicatesDetail = crawlerMethod.includes('detail') || Boolean(source.hasDetailPageEnrichment);
  if (methodIndicatesDetail) {
    capabilities.add('Detail Page');
  }

  // 5. Configured JSON-LD
  const methodIndicatesJsonLd = crawlerMethod.includes('json_ld') || Boolean(source.hasStructuredData);
  if (methodIndicatesJsonLd) {
    capabilities.add('JSON-LD');
  }

  return Array.from(capabilities);
}

/**
 * Derives the verified capabilities supported by reliable historical extraction evidence.
 *
 * Strict conservative rules:
 * - If isHistoricallyProven(source) is false, provenCapabilities is EMPTY.
 * - Unverified provenExtractionMethods tags and configured flags (e.g. pdfUrl, portalUrl,
 *   hasDetailPageEnrichment, hasStructuredData) do NOT grant proven status on their own.
 * - Preserves structural capability classification ONLY when genuine historical proof exists
 *   AND the source configuration unambiguously identifies a single extraction channel.
 */
export function getProvenCapabilities(source: ClassifiableSourceInput): ExtractionCapability[] {
  if (!source || !isHistoricallyProven(source)) {
    return [];
  }

  const proven = new Set<ExtractionCapability>();

  const configured = getConfiguredCapabilities(source);
  const isConfiguredPdf = configured.includes('PDF');
  const isConfiguredHtml = configured.includes('HTML') || configured.includes('Portal');

  const hasDistinctPdfUrl = Boolean(source.pdfUrl && source.pdfUrl.trim().startsWith('http'));
  const hasDistinctPortalUrl = Boolean(source.portalUrl && source.portalUrl.trim().startsWith('http'));

  // 1. Unambiguously PDF-only source with genuine historical success:
  if (isConfiguredPdf && !isConfiguredHtml && !hasDistinctPortalUrl) {
    proven.add('PDF');
  }

  // 2. Unambiguously HTML/Portal-only source with genuine historical success:
  if (isConfiguredHtml && !isConfiguredPdf && !hasDistinctPdfUrl) {
    proven.add('HTML');
    proven.add('Portal');
  }

  return Array.from(proven);
}

/**
 * Detects whether a source's lastErrorMessage reflects an incomplete pagination stop
 * (unsafe/rejected next-page URL, external host rejection, SSRF rejection, repeated/cyclic URL,
 * numeric pagination cycle, safety-limit truncation, or mid-crawl page interruption).
 */
export function hasIncompletePaginationDiagnostic(lastErrorMessage?: string): boolean {
  if (!lastErrorMessage || typeof lastErrorMessage !== 'string') return false;
  const msg = lastErrorMessage.trim().toLowerCase();
  if (!msg) return false;

  if (
    msg.includes('next-page url') ||
    msg.includes('pagination cycle detected') ||
    msg.includes('repeated next-page') ||
    msg.includes('pagination truncated at safety limit') ||
    msg.includes('ssrf validation rejected') ||
    msg.includes('crawling interrupted on page')
  ) {
    return true;
  }

  if (msg.includes('external hostname') && msg.includes('rejected')) {
    return true;
  }

  if (msg.includes('numeric page') && msg.includes('cycle')) {
    return true;
  }

  if (msg.includes('safety limit of') && msg.includes('page')) {
    return true;
  }

  if (
    msg.includes('pagination') &&
    (msg.includes('incomplete') || msg.includes('truncated') || msg.includes('cycle') || msg.includes('rejected') || msg.includes('unsafe') || msg.includes('stopped'))
  ) {
    return true;
  }

  return false;
}

/**
 * Derives the overall operational status and classification of a scraper source.
 *
 * Rules:
 * - Never mutates the source.
 * - Never deletes or disables any source.
 * - Preserves historical success across transient failures.
 * - Incomplete pagination diagnostics classify historically proven sources as Partial, never Working.
 */
export function deriveSourceClassification(source: ClassifiableSourceInput): SourceClassification {
  if (!source) {
    return {
      overallStatus: 'Unavailable',
      historicallyProven: false,
      provenCapabilities: [],
      configuredCapabilities: [],
      statusReason: 'Invalid or missing source configuration'
    };
  }

  const historicallyProven = isHistoricallyProven(source);
  const configuredCapabilities = getConfiguredCapabilities(source);
  const provenCapabilities = getProvenCapabilities(source);

  const health = (source.healthStatus || '').trim();
  const healthLower = health.toLowerCase();
  const errorMsg = (source.lastErrorMessage || '').toLowerCase();
  const httpStatus = Number(source.lastHttpStatus || 0);
  const scrapedCount = typeof source.scrapedCount === 'number' ? source.scrapedCount : 0;
  const isPaused = source.status === 'Paused' || source.status === 'Disabled';
  const hasIncompletePagination = hasIncompletePaginationDiagnostic(source.lastErrorMessage);

  // 1. Detect severe sustained network/DNS unavailability
  const isSustainedDead =
    errorMsg.includes('enotfound') ||
    errorMsg.includes('nxdomain') ||
    errorMsg.includes('econnrefused') ||
    errorMsg.includes('dns unreachable') ||
    errorMsg.includes('remote server offline') ||
    errorMsg.includes('permanently blocked') ||
    source.status === 'Disabled';

  if (isSustainedDead) {
    const reason = historicallyProven
      ? `Currently Unavailable: Sustained network/DNS failure (${source.lastErrorMessage || 'Host unreachable'}), historically proven with ${scrapedCount} vacancies`
      : `Currently Unavailable: Host unreachable (${source.lastErrorMessage || 'DNS/Network down'}), no successful extractions recorded`;

    return {
      overallStatus: 'Unavailable',
      historicallyProven,
      provenCapabilities,
      configuredCapabilities,
      statusReason: reason
    };
  }

  // 2. Working Classification
  // Requirements:
  // - Not paused/disabled
  // - No active incomplete-pagination diagnostic
  // - Recent run succeeded (Jobs Found, healthy, or 0 jobs without error on a reachable host)
  const isRecentSuccess =
    healthLower === 'jobs found' ||
    healthLower === 'healthy';

  const isZeroJobsWithoutError =
    healthLower === 'no jobs' &&
    !errorMsg.includes('fail') &&
    !errorMsg.includes('error') &&
    !hasIncompletePagination &&
    httpStatus !== 404 &&
    httpStatus !== 403;

  if (!isPaused && !hasIncompletePagination && historicallyProven && (isRecentSuccess || isZeroJobsWithoutError)) {
    const reason = scrapedCount > 0
      ? `Working: Verified operational with ${scrapedCount} vacancies harvested`
      : 'Working: Online and verified healthy';

    return {
      overallStatus: 'Working',
      historicallyProven,
      provenCapabilities,
      configuredCapabilities,
      statusReason: reason
    };
  }

  // 3. Partial / Needs Attention Classification
  // Scenarios:
  // A) Historically proven source with incomplete pagination crawl (diagnostic present alongside Jobs Found)
  // B) Historically proven source currently encountering a transient error (404, 403, Timeout, Invalid PDF, Fetch Error)
  // C) Source with health status "warning"
  // D) Paused source that is historically proven
  const isTransientFailure =
    health === '404' ||
    health === '403' ||
    health === 'Timeout' ||
    health === 'Invalid PDF' ||
    health === 'HTML' ||
    health === 'Fetch Error' ||
    healthLower === 'warning' ||
    httpStatus === 404 ||
    httpStatus === 403 ||
    hasIncompletePagination;

  if (historicallyProven) {
    const failureDetail = hasIncompletePagination
      ? 'Incomplete pagination crawl'
      : (health ? `Latest run recorded ${health}` : 'Requires operator review');
    const reason = isPaused
      ? `Partial: Source is currently ${source.status}, historically proven with ${scrapedCount} vacancies`
      : `Partial / Needs Attention: ${failureDetail} (${source.lastErrorMessage || 'Transient issue'}), historically proven with ${scrapedCount} vacancies`;

    return {
      overallStatus: 'Partial',
      historicallyProven: true,
      provenCapabilities,
      configuredCapabilities,
      statusReason: reason
    };
  }

  // 4. Sources not yet historically proven
  if (isTransientFailure) {
    return {
      overallStatus: 'Partial',
      historicallyProven: false,
      provenCapabilities,
      configuredCapabilities,
      statusReason: `Partial: Unverified source encountered ${health || 'error'} (${source.lastErrorMessage || 'Awaiting initial success'})`
    };
  }

  // Default: unverified active source awaiting first run (Configured / Not Yet Verified)
  return {
    overallStatus: 'Configured / Not Yet Verified',
    historicallyProven: false,
    provenCapabilities,
    configuredCapabilities,
    statusReason: 'Configured / Not Yet Verified: Awaiting initial execution and successful extraction'
  };
}

/**
 * Convenient pure boolean helper for filtering Working sources.
 */
export function isWorkingSource(source: ClassifiableSourceInput): boolean {
  return deriveSourceClassification(source).overallStatus === 'Working';
}

/**
 * Convenient pure boolean helper for filtering Partial / Needs Attention sources.
 */
export function isPartialSource(source: ClassifiableSourceInput): boolean {
  return deriveSourceClassification(source).overallStatus === 'Partial';
}

/**
 * Convenient pure boolean helper for filtering Unavailable sources.
 */
export function isUnavailableSource(source: ClassifiableSourceInput): boolean {
  return deriveSourceClassification(source).overallStatus === 'Unavailable';
}

/**
 * Checks whether a source has proven a specific extraction capability through historical evidence.
 */
export function hasProvenCapability(source: ClassifiableSourceInput, capability: ExtractionCapability): boolean {
  return getProvenCapabilities(source).includes(capability);
}

/**
 * Checks whether a source has configured infrastructure for a specific extraction capability.
 */
export function hasConfiguredCapability(source: ClassifiableSourceInput, capability: ExtractionCapability): boolean {
  return getConfiguredCapabilities(source).includes(capability);
}
