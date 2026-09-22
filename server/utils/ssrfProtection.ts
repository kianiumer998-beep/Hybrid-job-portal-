import { URL } from 'url';
import net from 'net';
import dns, { promises as dnsPromises } from 'dns';
import { Agent } from 'undici';

/**
 * Evaluates whether a literal IPv4 or IPv6 string falls into a private,
 * loopback, link-local, carrier-grade NAT, multicast, reserved, or cloud metadata IP range.
 */
export function isPrivateOrBlockedIp(ip: string): { blocked: boolean; reason?: string } {
  if (!ip || typeof ip !== 'string') return { blocked: false };
  let cleanIp = ip.trim().toLowerCase();

  // Strip IPv4-mapped IPv6 prefix if present (e.g. ::ffff:127.0.0.1 -> 127.0.0.1)
  if (cleanIp.startsWith('::ffff:')) {
    cleanIp = cleanIp.slice(7);
  }

  const ipType = net.isIP(cleanIp);
  if (!ipType) return { blocked: false };

  if (ipType === 4) {
    const parts = cleanIp.split('.').map(p => parseInt(p, 10));
    if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) {
      return { blocked: true, reason: 'Malformed IPv4 address' };
    }
    const [a, b, c, d] = parts;

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
    // 192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24 (TEST-NETs)
    if ((a === 192 && b === 0 && c === 2) || (a === 198 && b === 51 && c === 100) || (a === 203 && b === 0 && c === 113)) {
      return { blocked: true, reason: 'Test-net reserved IP address' };
    }
    // 198.18.0.0/15 (benchmarking)
    if (a === 198 && (b === 18 || b === 19)) return { blocked: true, reason: 'Benchmarking reserved IP address' };
    // 224.0.0.0/4 (multicast) & 240.0.0.0/4 (reserved)
    if (a >= 224) return { blocked: true, reason: 'Multicast or reserved IP address' };
  }

  if (ipType === 6) {
    if (cleanIp === '::1' || cleanIp === '0:0:0:0:0:0:0:1') {
      return { blocked: true, reason: 'IPv6 loopback address' };
    }
    if (cleanIp === '::' || cleanIp === '0:0:0:0:0:0:0:0') {
      return { blocked: true, reason: 'IPv6 unspecified address' };
    }
    if (cleanIp.startsWith('fc') || cleanIp.startsWith('fd')) {
      return { blocked: true, reason: 'IPv6 unique-local address (fc00::/7)' };
    }
    if (cleanIp.startsWith('fe80:') || cleanIp.startsWith('fe8') || cleanIp.startsWith('fe9') || cleanIp.startsWith('fea') || cleanIp.startsWith('feb')) {
      return { blocked: true, reason: 'IPv6 link-local address (fe80::/10)' };
    }
    if (cleanIp.startsWith('ff')) {
      return { blocked: true, reason: 'IPv6 multicast address' };
    }
    if (cleanIp.startsWith('2001:db8:')) {
      return { blocked: true, reason: 'IPv6 documentation address' };
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
const scraperTlsDispatcher = new Agent({
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

  // Block localhost and common local/internal hostnames
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.lan') ||
    hostname.endsWith('.corp') ||
    hostname === 'metadata.google.internal' ||
    hostname === 'instance-data'
  ) {
    return { safe: false, error: `Access to internal host "${hostname}" is blocked for security.` };
  }

  // Check if hostname is a literal IP address
  const isIp = net.isIP(hostname);
  if (isIp) {
    const ipCheck = isPrivateOrBlockedIp(hostname);
    if (ipCheck.blocked) {
      return { safe: false, error: ipCheck.reason || 'IP address is blocked.' };
    }
  }

  return { safe: true, parsedUrl: parsed };
}

/**
 * Asynchronously resolves a URL's hostname via DNS and verifies that all resolved IP addresses are public.
 */
export async function resolveAndValidateDns(parsedUrl: URL): Promise<{ safe: boolean; error?: string }> {
  const hostname = parsedUrl.hostname.toLowerCase();

  // If hostname is already a literal IP address, it was already validated by validateSafeScrapeUrl
  if (net.isIP(hostname)) {
    const ipCheck = isPrivateOrBlockedIp(hostname);
    if (ipCheck.blocked) {
      return { safe: false, error: `Literal IP address "${hostname}" is blocked (${ipCheck.reason}).` };
    }
    return { safe: true };
  }

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
}

/**
 * Fetches a URL with SSRF protection, timeout, automatic retry with exponential backoff,
 * safe DNS resolution checks, and safe manual redirect validation to prevent redirect-based SSRF bypass.
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

  const initialDnsCheck = await resolveAndValidateDns(initialCheck.parsedUrl!);
  if (!initialDnsCheck.safe) {
    throw new Error(`SSRF Blocked: ${initialDnsCheck.error}`);
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
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const onParentAbort = () => controller.abort();
    if (options.signal) {
      options.signal.addEventListener('abort', onParentAbort, { once: true });
    }

    try {
      let currentUrl = url;
      let currentMethod = (options.method || 'GET').toUpperCase();
      let currentBody = options.body;
      let redirectHops = 0;
      const visitedUrls = new Set<string>([currentUrl]);

      const mergedHeaders = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,application/json,application/pdf;q=0.8,*/*;q=0.7',
        'Accept-Language': 'en-US,en;q=0.9,ur;q=0.8',
        ...(options.headers || {})
      };

      while (true) {
        // Enforce manual redirect handling to intercept and validate every redirect target
        const res = await fetch(currentUrl, {
          ...options,
          method: currentMethod,
          body: currentBody,
          redirect: 'manual',
          signal: controller.signal,
          headers: mergedHeaders,
          // @ts-ignore - dispatcher is supported by undici in Node.js
          dispatcher: (options as any)?.dispatcher || scraperTlsDispatcher
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
            attempt++;
            await new Promise(r => setTimeout(r, delayMs));
            continue;
          }
          clearTimeout(timeoutId);
          if (options.signal) {
            options.signal.removeEventListener('abort', onParentAbort);
          }
          return res;
        }

        // Check if response is a redirect
        if (REDIRECT_STATUSES.has(res.status)) {
          const location = res.headers.get('location');
          if (!location) {
            // No location header provided with redirect status, return response as is
            clearTimeout(timeoutId);
            if (options.signal) {
              options.signal.removeEventListener('abort', onParentAbort);
            }
            return res;
          }

          redirectHops++;
          if (redirectHops > MAX_REDIRECT_HOPS) {
            throw new Error(`SSRF Blocked: Maximum redirect hops (${MAX_REDIRECT_HOPS}) exceeded`);
          }

          let nextUrl: string;
          try {
            nextUrl = new URL(location, currentUrl).toString();
          } catch {
            throw new Error(`SSRF Blocked: Invalid redirect Location "${location}"`);
          }

          // Check for redirect loop
          if (visitedUrls.has(nextUrl)) {
            throw new Error(`SSRF Blocked: Redirect loop detected (${nextUrl})`);
          }
          visitedUrls.add(nextUrl);

          // Validate redirect target syntax, protocol, and hostname against SSRF
          const redirectCheck = validateSafeScrapeUrl(nextUrl);
          if (!redirectCheck.safe) {
            throw new Error(`SSRF Blocked on redirect: ${redirectCheck.error}`);
          }

          // Resolve and validate redirect target DNS
          const redirectDnsCheck = await resolveAndValidateDns(redirectCheck.parsedUrl!);
          if (!redirectDnsCheck.safe) {
            throw new Error(`SSRF Blocked on redirect: ${redirectDnsCheck.error}`);
          }

          // Adjust method/body for standard HTTP redirect specifications:
          // 303: always convert to GET with no body
          // 301/302: if method was not GET/HEAD, convert to GET with no body
          if (res.status === 303 || ((res.status === 301 || res.status === 302) && currentMethod !== 'GET' && currentMethod !== 'HEAD')) {
            currentMethod = 'GET';
            currentBody = undefined;
          }

          currentUrl = nextUrl;
          continue;
        }

        // Not a redirect, return response
        clearTimeout(timeoutId);
        if (options.signal) {
          options.signal.removeEventListener('abort', onParentAbort);
        }
        return res;
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (options.signal) {
        options.signal.removeEventListener('abort', onParentAbort);
      }
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
    : (lastError?.code === 'ENOTFOUND' || lastError?.code === 'EAI_AGAIN' || String(lastError?.message || '').toLowerCase().includes('fetch failed')
      ? 'Remote server offline or DNS unreachable'
      : (lastError?.message || 'Host unreachable'));
  throw new Error(`Remote portal unavailable: ${url} (${errorReason})`);
}

