/**
 * Safe LocalStorage Utility with automatic QuotaExceededError handling,
 * defensive cache-eviction, and silent fallback to prevent React lifecycle white-screen crashes.
 */

export function safeLocalStorageSet(key: string, value: any): boolean {
  try {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    localStorage.setItem(key, serialized);
    return true;
  } catch (error: any) {
    console.warn(`[SafeStorage] localStorage.setItem failed for key "${key}":`, error);
    
    // Check if it's a QuotaExceededError
    const isQuotaError = 
      error?.name === 'QuotaExceededError' ||
      error?.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      error?.code === 22 ||
      error?.code === 1014;

    if (isQuotaError) {
      try {
        // Evict bulky non-essential cached entries to free storage
        localStorage.removeItem('career_pak_pdf_gazettes'); // Can always be restored from master code
        
        // Trim batch runs if too large
        const savedRuns = localStorage.getItem('career_pak_scraper_batch_runs');
        if (savedRuns) {
          try {
            const parsed = JSON.parse(savedRuns);
            if (Array.isArray(parsed) && parsed.length > 20) {
              localStorage.setItem('career_pak_scraper_batch_runs', JSON.stringify(parsed.slice(0, 15)));
            }
          } catch {
            localStorage.removeItem('career_pak_scraper_batch_runs');
          }
        }

        // Trim audit logs if too large
        const savedLogs = localStorage.getItem('career_pak_scraped_audit_logs');
        if (savedLogs) {
          try {
            const parsed = JSON.parse(savedLogs);
            if (Array.isArray(parsed) && parsed.length > 30) {
              localStorage.setItem('career_pak_scraped_audit_logs', JSON.stringify(parsed.slice(0, 20)));
            }
          } catch {
            localStorage.removeItem('career_pak_scraped_audit_logs');
          }
        }

        // Retry saving the original key after cleaning up
        const serialized = typeof value === 'string' ? value : JSON.stringify(value);
        localStorage.setItem(key, serialized);
        return true;
      } catch (retryError) {
        console.warn(`[SafeStorage] Retry after quota eviction also failed for key "${key}". Skipping write to preserve app stability.`, retryError);
        return false;
      }
    }
    return false;
  }
}

export function safeLocalStorageGet<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null || raw === undefined) return defaultValue;
    return JSON.parse(raw) as T;
  } catch (error) {
    console.warn(`[SafeStorage] Failed to read or parse key "${key}":`, error);
    return defaultValue;
  }
}

/**
 * Safe alert replacement that won't throw SecurityError inside sandboxed iframes.
 */
export function safeAlert(message: string): void {
  try {
    if (typeof window !== 'undefined' && typeof window.alert === 'function') {
      window.alert(message);
    }
  } catch (e) {
    console.log('[SafeAlert Notice]:', message);
  }
}
