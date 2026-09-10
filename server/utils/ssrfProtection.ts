import { URL } from 'url';
import net from 'net';
import { Agent } from 'undici';

// Resilient dispatcher for public scraper requests that handles
// government / national portal certificates (missing intermediate CA chains, etc.)
const scraperTlsDispatcher = new Agent({
  connect: {
    rejectUnauthorized: false
  },
  headersTimeout: 15000,
  bodyTimeout: 15000
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

  // Check if hostname is an IP address
  const isIp = net.isIP(hostname);
  if (isIp) {
    // Check IPv4 private and reserved ranges
    if (isIp === 4) {
      const parts = hostname.split('.').map(p => parseInt(p, 10));
      const [a, b] = parts;

      // 127.0.0.0/8 (loopback)
      if (a === 127) return { safe: false, error: 'Loopback IP addresses are blocked.' };
      // 0.0.0.0/8 (current network)
      if (a === 0) return { safe: false, error: 'Broadcast/current network IP addresses are blocked.' };
      // 10.0.0.0/8 (private)
      if (a === 10) return { safe: false, error: 'Private RFC1918 (10.0.0.0/8) IP addresses are blocked.' };
      // 172.16.0.0/12 (private)
      if (a === 172 && b >= 16 && b <= 31) return { safe: false, error: 'Private RFC1918 (172.16.0.0/12) IP addresses are blocked.' };
      // 192.168.0.0/16 (private)
      if (a === 192 && b === 168) return { safe: false, error: 'Private RFC1918 (192.168.0.0/16) IP addresses are blocked.' };
      // 169.254.0.0/16 (link-local, cloud metadata: 169.254.169.254)
      if (a === 169 && b === 254) return { safe: false, error: 'Link-local and cloud metadata addresses are blocked.' };
      // 224.0.0.0/4 (multicast) & 240.0.0.0/4 (reserved)
      if (a >= 224) return { safe: false, error: 'Multicast and reserved IP addresses are blocked.' };
    }

    // Check IPv6 loopback / unique local / link local
    if (isIp === 6) {
      if (hostname === '::1' || hostname === '0:0:0:0:0:0:0:1') {
        return { safe: false, error: 'IPv6 loopback address is blocked.' };
      }
      if (hostname.startsWith('fc') || hostname.startsWith('fd')) {
        return { safe: false, error: 'IPv6 unique-local addresses are blocked.' };
      }
      if (hostname.startsWith('fe80:')) {
        return { safe: false, error: 'IPv6 link-local addresses are blocked.' };
      }
    }
  }

  return { safe: true, parsedUrl: parsed };
}

/**
 * Fetches a URL with SSRF protection, timeout, and automatic retry with exponential backoff.
 */
export async function safeFetchWithRetry(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = 10000,
  maxRetries: number = 1
): Promise<Response> {
  const check = validateSafeScrapeUrl(url);
  if (!check.safe) {
    throw new Error(`SSRF Blocked: ${check.error}`);
  }

  let attempt = 0;
  let lastError: any = null;

  while (attempt <= maxRetries) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const mergedHeaders = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,application/json,application/pdf;q=0.8,*/*;q=0.7',
        'Accept-Language': 'en-US,en;q=0.9,ur;q=0.8',
        ...(options.headers || {})
      };

      const res = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: mergedHeaders,
        // @ts-ignore - dispatcher is supported by undici in Node.js
        dispatcher: (options as any)?.dispatcher || scraperTlsDispatcher
      });

      clearTimeout(timeoutId);
      return res;
    } catch (err: any) {
      clearTimeout(timeoutId);
      lastError = err;
      attempt++;

      if (attempt <= maxRetries) {
        const delay = Math.min(400 * Math.pow(2, attempt), 1500);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  const isAbort = lastError?.name === 'AbortError' || lastError?.message?.includes('aborted');
  const errorReason = isAbort ? `Connection timed out after ${timeoutMs}ms` : (lastError?.message || 'Host unreachable');
  throw new Error(`Failed to fetch ${url}. Cause: ${errorReason}`);
}
