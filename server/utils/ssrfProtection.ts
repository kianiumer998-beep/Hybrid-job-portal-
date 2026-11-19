import { URL } from 'url';
import net from 'net';
import dns, { promises as dnsPromises } from 'dns';
import { Agent } from 'undici';

/**
 * Evaluates whether a literal IPv4 or IPv6 string falls into a private,
 * loopback, link-local, carrier-grade NAT, multicast, reserved, or cloud metadata IP range.
 */
function evaluateIpv4(a: number, b: number, c: number, d: number): { blocked: boolean; reason?: string } {
  // 127.0.0.0/8 (loopback)
  if (a === 127) return { blocked: true, reason: 'Loopback IP address (127.0.0.0/8)' };
  // 0.0.0.0/8 (broadcast / current network)
  if (a === 0) return { blocked: true, reason: 'Current network IP address (0.0.0.0/8)' };
  // 10.0.0.0/8 (private)
  if (a === 10) return { blocked: true, reason: 'Private RFC1918 IP address (10.0.0.0/8)' };
  // 172.16.0.0/12 (private: 172.16.0.0 - 172.31.255.255)
  if (a === 172 && b >= 16 && b <= 31) return { blocked: true, reason: 'Private RFC1918 IP address (172.16.0.0/12)' };
  // 192.168.0.0/16 (private)
  if (a === 192 && b === 168) return { blocked: true, reason: 'Private RFC1918 IP address (192.168.0.0/16)' };
  // 169.254.0.0/16 (link-local & AWS/GCP/Azure cloud metadata: 169.254.169.254)
  if (a === 169 && b === 254) return { blocked: true, reason: 'Link-local / Cloud metadata address (169.254.0.0/16)' };
  // 100.64.0.0/10 (carrier-grade NAT / shared space)
  if (a === 100 && b >= 64 && b <= 127) return { blocked: true, reason: 'Shared address space (100.64.0.0/10)' };
  // 192.0.0.0/24 (IETF protocol assignments - preserve globally reachable exceptions 192.0.0.9 and 192.0.0.10)
  if (a === 192 && b === 0 && c === 0 && d !== 9 && d !== 10) {
    return { blocked: true, reason: 'IETF protocol assignments reserved IP address (192.0.0.0/24)' };
  }
  // 192.88.99.0/24 (deprecated 6to4 relay anycast)
  if (a === 192 && b === 88 && c === 99) {
    return { blocked: true, reason: 'Deprecated 6to4 relay anycast IP address (192.88.99.0/24)' };
  }
  // 192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24 (TEST-NETs)
  if ((a === 192 && b === 0 && c === 2) || (a === 198 && b === 51 && c === 100) || (a === 203 && b === 0 && c === 113)) {
    return { blocked: true, reason: 'Test-net reserved IP address' };
  }
  // 198.18.0.0/15 (benchmarking)
  if (a === 198 && (b === 18 || b === 19)) return { blocked: true, reason: 'Benchmarking reserved IP address' };
  // 224.0.0.0/4 (multicast) & 240.0.0.0/4 (reserved)
  if (a >= 224) return { blocked: true, reason: 'Multicast or reserved IP address' };

  return { blocked: false };
}

function parseIpv6(ip: string): number[] | null {
  let s = ip.trim().toLowerCase();
  if (s.startsWith('[') && s.endsWith(']')) {
    s = s.slice(1, -1).trim();
  }

  // Check for embedded IPv4 dotted-quad suffix (e.g. ::ffff:192.168.1.1)
  const lastColon = s.lastIndexOf(':');
  if (lastColon !== -1) {
    const tail = s.slice(lastColon + 1);
    if (tail.includes('.')) {
      const parts = tail.split('.').map(x => parseInt(x, 10));
      if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) {
        return null;
      }
      const hex1 = (((parts[0] << 8) | parts[1]) >>> 0).toString(16);
      const hex2 = (((parts[2] << 8) | parts[3]) >>> 0).toString(16);
      s = s.slice(0, lastColon) + ':' + hex1 + ':' + hex2;
    }
  }

  // Handle double-colon compression
  let parts: string[];
  if (s.includes('::')) {
    const halves = s.split('::');
    if (halves.length !== 2) return null; // Only one :: is allowed
    const left = halves[0] ? halves[0].split(':') : [];
    const right = halves[1] ? halves[1].split(':') : [];
    const missing = 8 - (left.length + right.length);
    if (missing < 1) return null;
    parts = [...left, ...Array(missing).fill('0'), ...right];
  } else {
    parts = s.split(':');
  }

  if (parts.length !== 8) return null;

  const words: number[] = [];
  for (const p of parts) {
    if (!/^[0-9a-f]{1,4}$/i.test(p)) return null;
    words.push(parseInt(p, 16));
  }
  return words;
}

/**
 * Evaluates whether a literal IPv4 or IPv6 string falls into a private,
 * loopback, link-local, carrier-grade NAT, multicast, reserved, or cloud metadata IP range.
 * Fully supports IPv4-mapped IPv6 (both dotted decimal and hexadecimal formats),
 * compressed and expanded IPv6, unique-local, link-local, multicast, documentation,
 * and other special-purpose non-global ranges without blocking legitimate public addresses.
 */
export function isPrivateOrBlockedIp(ip: string): { blocked: boolean; reason?: string } {
  if (!ip || typeof ip !== 'string') return { blocked: false };
  let cleanIp = ip.trim().toLowerCase();

  // Strip enclosing brackets if passed in IPv6 URL host format (e.g. [::1] -> ::1)
  if (cleanIp.startsWith('[') && cleanIp.endsWith(']')) {
    cleanIp = cleanIp.slice(1, -1).trim();
  }

  const ipType = net.isIP(cleanIp);
  if (!ipType) return { blocked: false };

  if (ipType === 4) {
    const parts = cleanIp.split('.').map(p => parseInt(p, 10));
    if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) {
      return { blocked: true, reason: 'Malformed IPv4 address' };
    }
    return evaluateIpv4(parts[0], parts[1], parts[2], parts[3]);
  }

  if (ipType === 6) {
    const words = parseIpv6(cleanIp);
    if (!words) {
      return { blocked: true, reason: 'Malformed IPv6 address' };
    }

    // 1. IPv6 loopback address ::1/128 (compressed or expanded)
    if (words.every((w, i) => (i === 7 ? w === 1 : w === 0))) {
      return { blocked: true, reason: 'IPv6 loopback address (::1)' };
    }

    // 2. IPv6 unspecified address ::/128 (compressed or expanded)
    if (words.every(w => w === 0)) {
      return { blocked: true, reason: 'IPv6 unspecified address (::)' };
    }

    // 3. IPv4-mapped IPv6 (::ffff:0:0/96)
    // Supports both dotted decimal (::ffff:127.0.0.1) and hexadecimal (::ffff:7f00:1) representations
    const isMapped = words.slice(0, 5).every(w => w === 0) && words[5] === 0xffff;
    if (isMapped) {
      const a = (words[6] >> 8) & 0xff;
      const b = words[6] & 0xff;
      const c = (words[7] >> 8) & 0xff;
      const d = words[7] & 0xff;
      const v4Check = evaluateIpv4(a, b, c, d);
      if (v4Check.blocked) {
        return { blocked: true, reason: `IPv4-mapped ${v4Check.reason}` };
      }
      return { blocked: false };
    }

    // 4. Deprecated IPv4-compatible IPv6 (::/96)
    // Deprecated transition mechanism (RFC 4291 section 2.5.5.1); rejected rather than treated as public
    if (words.slice(0, 6).every(w => w === 0)) {
      return { blocked: true, reason: 'Deprecated IPv4-compatible address (::/96)' };
    }

    // 5. 6to4 transition prefix (2002::/16)
    // Embeds IPv4 addresses and must not bypass SSRF protection
    if (words[0] === 0x2002) {
      return { blocked: true, reason: 'IPv6 6to4 transition address (2002::/16)' };
    }

    // 6. Teredo tunneling prefix (2001:0000::/32)
    // Embeds IPv4 addresses and is an IPv6 transition mechanism not accepted as a public target
    if (words[0] === 0x2001 && words[1] === 0x0000) {
      return { blocked: true, reason: 'IPv6 Teredo tunneling address (2001::/32)' };
    }

    // 7. NAT64 well-known prefix (64:ff9b::/96)
    // Translation prefix representing embedded IPv4 destinations; blocked from bypassing private IPv4 checks
    if (
      words[0] === 0x0064 &&
      words[1] === 0xff9b &&
      words[2] === 0 &&
      words[3] === 0 &&
      words[4] === 0 &&
      words[5] === 0
    ) {
      return { blocked: true, reason: 'IPv6 NAT64 well-known prefix (64:ff9b::/96)' };
    }

    // 8. NAT64 local-use prefix (64:ff9b:1::/48)
    if (words[0] === 0x0064 && words[1] === 0xff9b && words[2] === 0x0001) {
      return { blocked: true, reason: 'IPv6 NAT64 local-use prefix (64:ff9b:1::/48)' };
    }

    // 9. IPv6 unique-local address (fc00::/7 covering fc00::/8 and fd00::/8)
    if ((words[0] & 0xfe00) === 0xfc00) {
      return { blocked: true, reason: 'IPv6 unique-local address (fc00::/7)' };
    }

    // 10. IPv6 link-local unicast address (fe80::/10 covering fe80:: - febf:ffff:...)
    if ((words[0] & 0xffc0) === 0xfe80) {
      return { blocked: true, reason: 'IPv6 link-local address (fe80::/10)' };
    }

    // 11. IPv6 multicast address (ff00::/8)
    if ((words[0] & 0xff00) === 0xff00) {
      return { blocked: true, reason: 'IPv6 multicast address (ff00::/8)' };
    }

    // 12. IPv6 documentation address (2001:db8::/32)
    if (words[0] === 0x2001 && words[1] === 0x0db8) {
      return { blocked: true, reason: 'IPv6 documentation address (2001:db8::/32)' };
    }

    // 13. IPv6 documentation address (3fff::/20)
    if (words[0] === 0x3fff && (words[1] & 0xf000) === 0x0000) {
      return { blocked: true, reason: 'IPv6 documentation address (3fff::/20)' };
    }

    // 14. IPv6 discard-only prefix (100::/64) and dummy prefix (100:0:0:1::/64)
    if (words[0] === 0x0100 && words[1] === 0 && words[2] === 0 && words[3] === 0) {
      return { blocked: true, reason: 'IPv6 discard-only address (100::/64)' };
    }
    if (words[0] === 0x0100 && words[1] === 0 && words[2] === 0 && words[3] === 0x0001) {
      return { blocked: true, reason: 'IPv6 special-purpose address (100:0:0:1::/64)' };
    }

    // 15. IPv6 benchmarking address (2001:2::/48)
    if (words[0] === 0x2001 && words[1] === 0x0002) {
      return { blocked: true, reason: 'IPv6 benchmarking address (2001:2::/48)' };
    }

    // 16. IPv6 Segment Routing SID prefix (5f00::/16)
    if (words[0] === 0x5f00) {
      return { blocked: true, reason: 'IPv6 Segment Routing SID prefix (5f00::/16)' };
    }

    // 17. IPv6 deprecated site-local address (fec0::/10)
    if ((words[0] & 0xffc0) === 0xfec0) {
      return { blocked: true, reason: 'IPv6 site-local address (fec0::/10)' };
    }

    // 18. Non-globally-reachable portions of 2001::/23 (IETF protocol assignments)
    // Preserve globally reachable exceptions:
    // - 2001:1::1/128, 2001:1::2/128, 2001:1::3/128
    // - 2001:3::/32
    // - 2001:4:112::/48
    // - 2001:20::/28
    // - 2001:30::/28
    if (words[0] === 0x2001 && (words[1] & 0xfe00) === 0x0000) {
      const is20011Global =
        words[1] === 0x0001 &&
        words[2] === 0 &&
        words[3] === 0 &&
        words[4] === 0 &&
        words[5] === 0 &&
        words[6] === 0 &&
        (words[7] === 1 || words[7] === 2 || words[7] === 3);
      const isAmtGlobal = words[1] === 0x0003;
      const isAs112Global = words[1] === 0x0004 && words[2] === 0x0112;
      const isOrchidV2Global = (words[1] & 0xfff0) === 0x0020;
      const isDroneIdGlobal = (words[1] & 0xfff0) === 0x0030;

      if (!is20011Global && !isAmtGlobal && !isAs112Global && !isOrchidV2Global && !isDroneIdGlobal) {
        return { blocked: true, reason: 'IPv6 non-global IETF protocol assignment (2001::/23)' };
      }
    }

    // 19. Restrict ordinary IPv6 addresses to Global Unicast (2000::/3)
    if ((words[0] & 0xe000) !== 0x2000) {
      return { blocked: true, reason: 'Non-global-unicast IPv6 address (outside 2000::/3)' };
    }
  }

  return { blocked: false };
}

/**
 * Custom DNS lookup handler for undici Agent to prevent DNS rebinding attacks at socket connection time.
 */
function safeDnsLookup(
  hostname: string,
  options: dns.LookupOptions,
  callback: (err: NodeJS.ErrnoException | null, address: string | dns.LookupAddress[], family?: number) => void
): void {
  dns.lookup(hostname, options, (err, address, family) => {
    if (err) {
      return callback(err, address, family);
    }

    const addrs: dns.LookupAddress[] = Array.isArray(address)
      ? address
      : [{ address: address as string, family: family || net.isIP(address as string) || 4 }];

    for (const entry of addrs) {
      const check = isPrivateOrBlockedIp(entry.address);
      if (check.blocked) {
        const ssrfErr = new Error(`SSRF Blocked: Hostname "${hostname}" resolved to blocked IP "${entry.address}" (${check.reason})`);
        return callback(ssrfErr as any, [] as any);
      }
    }

    return callback(null, address as any, family);
  });
}

// Resilient dispatcher for public scraper requests with standard TLS verification and DNS rebinding protection
export const scraperTlsDispatcher = new Agent({
  headersTimeout: 15000,
  bodyTimeout: 15000,
  connect: {
    lookup: safeDnsLookup
  } as any
});

export interface SafeUrlResult {
  safe: boolean;
  error?: string;
  parsedUrl?: URL;
}

/**
 * Validates a target URL against SSRF (Server-Side Request Forgery) attacks.
 * Blocks private IP ranges, loopback addresses, local domains, cloud metadata endpoints,
 * and non-HTTP(S) protocols.
 */
export function validateSafeScrapeUrl(urlStr: string): SafeUrlResult {
  if (!urlStr || typeof urlStr !== 'string') {
    return { safe: false, error: 'Target URL is required.' };
  }

  const trimmed = urlStr.trim();
  let parsed: URL;

  try {
    parsed = new URL(trimmed);
  } catch {
    return { safe: false, error: `Invalid URL format: "${trimmed}". Must include http:// or https://` };
  }

  // Only allow HTTP and HTTPS protocols
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { safe: false, error: `Protocol "${parsed.protocol}" is forbidden. Only HTTP and HTTPS are permitted.` };
  }

  const hostname = parsed.hostname.toLowerCase();
  const rawHost = hostname.startsWith('[') && hostname.endsWith(']')
    ? hostname.slice(1, -1).trim()
    : hostname;

  // Block localhost and common local/internal hostnames
  if (
    rawHost === 'localhost' ||
    rawHost.endsWith('.localhost') ||
    rawHost.endsWith('.local') ||
    rawHost.endsWith('.internal') ||
    rawHost.endsWith('.lan') ||
    rawHost.endsWith('.corp') ||
    rawHost === 'metadata.google.internal' ||
    rawHost === 'instance-data'
  ) {
    return { safe: false, error: `Access to internal host "${hostname}" is blocked for security.` };
  }

  // Check if hostname is a literal IP address (IPv4 or IPv6)
  const isIp = net.isIP(rawHost);
  if (isIp) {
    const ipCheck = isPrivateOrBlockedIp(rawHost);
    if (ipCheck.blocked) {
      return { safe: false, error: ipCheck.reason || 'IP address is blocked.' };
    }
  }

  return { safe: true, parsedUrl: parsed };
}

/**
 * Asynchronously resolves a URL's hostname via DNS and verifies that all resolved IP addresses are public.
 */
export async function resolveAndValidateDns(
  parsedUrl: URL,
  signal?: AbortSignal
): Promise<{ safe: boolean; error?: string }> {
  const createAbortError = () => {
    const err: any = new Error('The operation was aborted');
    err.name = 'AbortError';
    return err;
  };

  if (signal?.aborted) {
    throw createAbortError();
  }

  const hostname = parsedUrl.hostname.toLowerCase();
  const rawHost = hostname.startsWith('[') && hostname.endsWith(']')
    ? hostname.slice(1, -1).trim()
    : hostname;

  // If hostname is already a literal IP address, it was already validated by validateSafeScrapeUrl
  if (net.isIP(rawHost)) {
    const ipCheck = isPrivateOrBlockedIp(rawHost);
    if (ipCheck.blocked) {
      return { safe: false, error: `Literal IP address "${hostname}" is blocked (${ipCheck.reason}).` };
    }
    return { safe: true };
  }

  const performLookup = async (): Promise<{ safe: boolean; error?: string }> => {
    try {
      const addresses = await dnsPromises.lookup(hostname, { all: true });
      if (!addresses || addresses.length === 0) {
        return { safe: false, error: `DNS resolution returned no IP addresses for hostname "${hostname}".` };
      }

      for (const addr of addresses) {
        const check = isPrivateOrBlockedIp(addr.address);
        if (check.blocked) {
          return {
            safe: false,
            error: `Hostname "${hostname}" resolved to blocked IP address "${addr.address}" (${check.reason}).`
          };
        }
      }

      return { safe: true };
    } catch (err: any) {
      return {
        safe: false,
        error: `DNS resolution failed for hostname "${hostname}": ${err.message || 'Domain not found'}`
      };
    }
  };

  if (!signal) {
    return performLookup();
  }

  return new Promise<{ safe: boolean; error?: string }>((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
      signal.removeEventListener('abort', onAbort);
    };

    const onAbort = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(createAbortError());
    };

    signal.addEventListener('abort', onAbort, { once: true });

    if (signal.aborted) {
      onAbort();
      return;
    }

    // performLookup() handles all lookup rejections internally, so late settlement after abort
    // cannot raise an unhandled promise rejection and cannot trigger downstream actions.
    performLookup().then(
      (result) => {
        if (settled) return;
        settled = true;
        cleanup();
        if (signal.aborted) {
          reject(createAbortError());
          return;
        }
        resolve(result);
      },
      (err) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(err);
      }
    );
  });
}

async function cancelResponseBody(res: any): Promise<void> {
  if (!res) return;
  try {
    if (res.body && !res.bodyUsed) {
      if (typeof res.body.cancel === 'function') {
        await res.body.cancel();
      } else if (typeof res.body.destroy === 'function') {
        res.body.destroy();
      }
    }
  } catch {
    // Ignore stream cancellation errors on closed/consumed streams
  }
}

const DEFAULT_SAFE_SCRAPE_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept':
    'text/html,application/xhtml+xml,application/xml;q=0.9,application/json,application/pdf;q=0.8,*/*;q=0.7',
  'Accept-Language': 'en-US,en;q=0.9,ur;q=0.8'
};

// Conservative explicit allowlist of non-sensitive headers permitted across cross-origin redirects.
// Any credential, authorization, cookie, proxy-authorization, API-key, token, secret, or password
// header is automatically excluded on origin transitions regardless of casing.
const CROSS_ORIGIN_SAFE_HEADER_NAMES = new Set<string>([
  'accept',
  'accept-language',
  'accept-encoding',
  'user-agent',
  'cache-control',
  'pragma'
]);

function isSameOrigin(urlA: URL, urlB: URL): boolean {
  const defaultPort = (protocol: string) => (protocol === 'https:' ? '443' : '80');
  const portA = urlA.port || defaultPort(urlA.protocol);
  const portB = urlB.port || defaultPort(urlB.protocol);
  return (
    urlA.protocol.toLowerCase() === urlB.protocol.toLowerCase() &&
    urlA.hostname.toLowerCase() === urlB.hostname.toLowerCase() &&
    portA === portB
  );
}

function normalizeHeadersInput(headersInit?: HeadersInit): Record<string, string> {
  const merged: Record<string, string> = { ...DEFAULT_SAFE_SCRAPE_HEADERS };

  const setHeaderCaseInsensitive = (rawKey: string, rawVal: unknown) => {
    const key = String(rawKey || '').trim();
    if (!key || rawVal === undefined || rawVal === null) return;
    const lower = key.toLowerCase();
    for (const existingKey of Object.keys(merged)) {
      if (existingKey.toLowerCase() === lower) {
        delete merged[existingKey];
      }
    }
    merged[key] = String(rawVal);
  };

  if (!headersInit) {
    return merged;
  }

  if (
    headersInit instanceof Headers ||
    (typeof (headersInit as any).forEach === 'function' && typeof (headersInit as any).get === 'function')
  ) {
    (headersInit as Headers).forEach((value, key) => {
      setHeaderCaseInsensitive(key, value);
    });
    return merged;
  }

  if (Array.isArray(headersInit)) {
    for (const entry of headersInit) {
      if (Array.isArray(entry) && entry.length >= 2) {
        setHeaderCaseInsensitive(entry[0], entry[1]);
      }
    }
    return merged;
  }

  if (typeof headersInit === 'object') {
    for (const [key, value] of Object.entries(headersInit as Record<string, unknown>)) {
      if (Array.isArray(value)) {
        setHeaderCaseInsensitive(key, value.join(', '));
      } else {
        setHeaderCaseInsensitive(key, value);
      }
    }
  }

  return merged;
}

function filterHeadersForCrossOrigin(headers: Record<string, string>): Record<string, string> {
  const filtered: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (CROSS_ORIGIN_SAFE_HEADER_NAMES.has(key.toLowerCase())) {
      filtered[key] = value;
    }
  }
  return filtered;
}

/**
 * Fetches a URL with SSRF protection, timeout, automatic retry with exponential backoff,
 * safe DNS resolution checks, and safe manual redirect validation to prevent redirect-based SSRF bypass.
 * Enforces use of the internal DNS-validated scraperTlsDispatcher (caller dispatcher cannot override).
 * Performs safe resource cleanup of intermediate 429 and redirect response bodies and attempt timers.
 * Strips sensitive headers and rejects body-preserving 307/308 redirects across origin boundaries.
 */
export async function safeFetchWithRetry(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = 10000,
  maxRetries: number = 1
): Promise<Response> {
  const initialCheck = validateSafeScrapeUrl(url);
  if (!initialCheck.safe) {
    throw new Error(`SSRF Blocked: ${initialCheck.error}`);
  }

  const MAX_REDIRECT_HOPS = 5;
  const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

  let attempt = 0;
  let lastError: any = null;

  while (attempt <= maxRetries) {
    if (options.signal?.aborted) {
      throw new Error(`Execution aborted: ${options.signal.reason || 'Source execution timed out'}`);
    }

    const controller = new AbortController();
    let timerCleared = false;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const onParentAbort = () => controller.abort();
    if (options.signal) {
      options.signal.addEventListener('abort', onParentAbort, { once: true });
    }

    const cleanupAttemptTimers = () => {
      if (!timerCleared) {
        timerCleared = true;
        clearTimeout(timeoutId);
        if (options.signal) {
          options.signal.removeEventListener('abort', onParentAbort);
        }
      }
    };

    try {
      // Initial DNS preflight covered by the active attempt's timeoutMs / AbortController budget
      const initialDnsCheck = await resolveAndValidateDns(initialCheck.parsedUrl!, controller.signal);
      if (!initialDnsCheck.safe) {
        throw new Error(`SSRF Blocked: ${initialDnsCheck.error}`);
      }
      if (controller.signal.aborted) {
        const abortErr: any = new Error('The operation was aborted');
        abortErr.name = 'AbortError';
        throw abortErr;
      }

      let currentUrl = url;
      let currentMethod = (options.method || 'GET').toUpperCase();
      let currentBody = options.body;
      let currentHeaders = normalizeHeadersInput(options.headers);
      let redirectHops = 0;
      const visitedUrls = new Set<string>([currentUrl]);

      // FIX 2: Caller-supplied options.dispatcher must NEVER replace scraperTlsDispatcher.
      // Every protected request must use the internal scraperTlsDispatcher.
      const {
        dispatcher: _ignoredCallerDispatcher,
        headers: _ignoredHeaders,
        method: _ignoredMethod,
        body: _ignoredBody,
        referrer: _ignoredReferrer,
        referrerPolicy: _ignoredReferrerPolicy,
        ...safeOptions
      } = (options as any) || {};
      // Preserve caller referrer settings only while requests remain same-origin.
      // Once a redirect crosses an origin boundary, fail closed against Referer leakage.
      let currentReferrer = (options as any).referrer;
      let currentReferrerPolicy = (options as any).referrerPolicy;

      while (true) {
        // Enforce manual redirect handling to intercept and validate every redirect target
        const res = await fetch(currentUrl, {
          ...safeOptions,
          method: currentMethod,
          body: currentBody,
          redirect: 'manual',
          signal: controller.signal,
          headers: currentHeaders,
          referrer: currentReferrer,
          referrerPolicy: currentReferrerPolicy,
          // @ts-ignore - dispatcher is supported by undici in Node.js
          dispatcher: scraperTlsDispatcher
        });

        // Handle HTTP 429 Rate Limiting with bounded backoff
        if (res.status === 429) {
          const retryAfter = res.headers.get('retry-after');
          let delayMs = 1000;
          if (retryAfter) {
            const parsed = parseInt(retryAfter, 10);
            if (!isNaN(parsed) && parsed > 0) {
              delayMs = Math.min(parsed * 1000, 2000); // Bounded backoff max 2s
            }
          }
          if (attempt < maxRetries) {
            // FIX 3: Cancel previous response body before retrying
            await cancelResponseBody(res);
            // FIX 3: Clear previous attempt timeout & remove parent abort listener before next attempt
            cleanupAttemptTimers();
            attempt++;
            await new Promise(r => setTimeout(r, delayMs));
            break; // Start fresh attempt with clean timers/controller from initial URL
          }
          // Final 429 response when retries exhausted: return response to caller WITHOUT canceling body
          cleanupAttemptTimers();
          return res;
        }

        // Check if response is a redirect
        if (REDIRECT_STATUSES.has(res.status)) {
          const location = res.headers.get('location');
          if (!location) {
            // No location header provided with redirect status, return response as is to caller (final response)
            cleanupAttemptTimers();
            return res;
          }

          redirectHops++;
          if (redirectHops > MAX_REDIRECT_HOPS) {
            await cancelResponseBody(res);
            throw new Error(`SSRF Blocked: Maximum redirect hops (${MAX_REDIRECT_HOPS}) exceeded`);
          }

          let nextUrl: string;
          try {
            nextUrl = new URL(location, currentUrl).toString();
          } catch {
            await cancelResponseBody(res);
            throw new Error(`SSRF Blocked: Invalid redirect Location "${location}"`);
          }

          // Check for redirect loop
          if (visitedUrls.has(nextUrl)) {
            await cancelResponseBody(res);
            throw new Error(`SSRF Blocked: Redirect loop detected (${nextUrl})`);
          }
          visitedUrls.add(nextUrl);

          // Validate redirect target syntax, protocol, and hostname against SSRF
          const redirectCheck = validateSafeScrapeUrl(nextUrl);
          if (!redirectCheck.safe) {
            await cancelResponseBody(res);
            throw new Error(`SSRF Blocked on redirect: ${redirectCheck.error}`);
          }

          // Reject HTTPS-to-HTTP protocol downgrade redirects while preserving HTTP-to-HTTPS upgrades
          const currentParsed = new URL(currentUrl);
          const nextParsed = redirectCheck.parsedUrl!;
          if (currentParsed.protocol === 'https:' && nextParsed.protocol === 'http:') {
            await cancelResponseBody(res);
            throw new Error(`SSRF Blocked: HTTPS-to-HTTP redirect downgrade rejected (${nextUrl})`);
          }

          const crossOriginRedirect = !isSameOrigin(currentParsed, nextParsed);

          // Prevent cross-origin request-body and non-idempotent method leakage via 307/308
          if (
            crossOriginRedirect &&
            (res.status === 307 || res.status === 308) &&
            ((currentBody !== undefined && currentBody !== null) ||
              (currentMethod !== 'GET' && currentMethod !== 'HEAD'))
          ) {
            await cancelResponseBody(res);
            throw new Error(
              `SSRF Blocked: Cross-origin ${res.status} redirect preserving ${currentMethod} method/body rejected (${nextUrl})`
            );
          }

          // FIX 3: Cancel intermediate redirect response body before redirect DNS preflight or next hop
          await cancelResponseBody(res);

          // Resolve and validate redirect target DNS under the active attempt AbortController signal
          const redirectDnsCheck = await resolveAndValidateDns(nextParsed, controller.signal);
          if (!redirectDnsCheck.safe) {
            throw new Error(`SSRF Blocked on redirect: ${redirectDnsCheck.error}`);
          }
          if (controller.signal.aborted) {
            const abortErr: any = new Error('The operation was aborted');
            abortErr.name = 'AbortError';
            throw abortErr;
          }

          // Adjust method/body for standard HTTP redirect specifications:
          // 303: always convert to GET with no body
          // 301/302: if method was not GET/HEAD, convert to GET with no body
          if (
            res.status === 303 ||
            ((res.status === 301 || res.status === 302) && currentMethod !== 'GET' && currentMethod !== 'HEAD')
          ) {
            currentMethod = 'GET';
            currentBody = undefined;
          }

          // Apply conservative safe-header filtering across origin changes
          if (crossOriginRedirect) {
            currentHeaders = filterHeadersForCrossOrigin(currentHeaders);
            if (currentMethod === 'GET' || currentMethod === 'HEAD') {
              currentBody = undefined;
            }
            // Explicitly suppress the Fetch-generated Referer on this and later hops.
            currentReferrer = '';
            currentReferrerPolicy = 'no-referrer';
          }

          currentUrl = nextUrl;
          continue;
        }

        // Non-redirect, non-retryable response (e.g. 200, 404, 500):
        // Clean up attempt timers, do NOT cancel response body, return to caller
        cleanupAttemptTimers();
        return res;
      }
    } catch (err: any) {
      cleanupAttemptTimers();
      lastError = err;

      // If error is an SSRF Blocked error, do NOT retry - throw immediately
      if (err.message && err.message.startsWith('SSRF Blocked')) {
        throw err;
      }

      attempt++;

      if (options.signal?.aborted) {
        break;
      }

      if (attempt <= maxRetries) {
        const delay = Math.min(400 * Math.pow(2, attempt), 1500);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  const isAbort = lastError?.name === 'AbortError' || lastError?.message?.includes('aborted');
  const errorReason = isAbort
    ? `Connection timed out after ${timeoutMs}ms`
    : lastError?.code === 'ENOTFOUND' ||
      lastError?.code === 'EAI_AGAIN' ||
      String(lastError?.message || '').toLowerCase().includes('fetch failed')
    ? 'Remote server offline or DNS unreachable'
    : lastError?.message || 'Host unreachable';
  throw new Error(`Remote portal unavailable: ${url} (${errorReason})`);
}

