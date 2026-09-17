// Centralized Production API Service for Hybrid Job Portal

/**
 * Deterministic API base resolution for HybridJobs.
 * - In development (localhost / 127.0.0.1): defaults to '/api'.
 * - In production when frontend and backend are separate (e.g. Vercel frontend -> Render backend):
 *   Uses the configured Render backend API URL.
 * - Never silently use /api in production when frontend/backend are separate.
 * - Keep every jobs GET/POST request on the same backend API.
 * - Do not use localStorage as a source of job data.
 */
export function getResolvedApiBase(): string {
  const envUrl = (
    (import.meta as any).env?.VITE_API_BASE_URL ||
    (import.meta as any).env?.VITE_BACKEND_URL ||
    (import.meta as any).env?.VITE_RENDER_API_URL ||
    (typeof window !== 'undefined' && ((window as any).__BACKEND_URL__ || (window as any).VITE_API_BASE_URL || (window as any).VITE_BACKEND_URL)) ||
    ''
  ).toString().trim();

  // 1. Explicitly configured backend URL (e.g. Render backend URL passed via env)
  if (envUrl) {
    const stripped = envUrl.replace(/\/+$/, '').replace(/\/api\/?$/, '');
    return `${stripped}/api`;
  }

  const isBrowser = typeof window !== 'undefined';
  const hostname = isBrowser ? window.location.hostname : '';
  const isVercel = Boolean(isBrowser && (hostname.endsWith('.vercel.app') || hostname.includes('vercel.app')));
  const isLocal = Boolean(
    isBrowser &&
    (hostname === 'localhost' ||
     hostname === '127.0.0.1' ||
     hostname === '0.0.0.0' ||
     hostname.includes('.run.app') ||
     hostname.includes('.preview.') ||
     hostname.includes('localhost'))
  );

  // 2. Production Vercel deployment where frontend is hosted statically on Vercel
  if (isVercel) {
    const runtimeUrl = isBrowser ? (localStorage.getItem('hybrid_backend_api_url') || '') : '';
    if (runtimeUrl.trim()) {
      const stripped = runtimeUrl.trim().replace(/\/+$/, '').replace(/\/api\/?$/, '');
      return `${stripped}/api`;
    }
    // Production Render backend
    return 'https://hybrid-job-portal.onrender.com/api';
  }

  // 3. Custom domain / standalone production deployment outside local dev
  if (isBrowser && !isLocal && (hostname.includes('.com') || hostname.includes('.org') || hostname.includes('.io') || hostname.includes('.app'))) {
    return 'https://hybrid-job-portal.onrender.com/api';
  }

  // 4. Local dev / container preview where Express serves the API on /api
  return '/api';
}

export const API_BASE = getResolvedApiBase();

function getAuthHeader(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  const token = localStorage.getItem('hybrid_auth_token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export async function safeFetchJson<T = any>(url: string, init?: RequestInit): Promise<T> {
  try {
    const res = await fetch(url, {
      cache: 'no-store',
      ...init,
      headers: {
        ...(init?.headers || {})
      }
    });
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await res.text();
      console.warn(`[API] Expected JSON but received ${contentType} (${res.status}) from ${url}:`, text.slice(0, 120));
      return {
        success: false,
        message: `API endpoint returned non-JSON response (${res.status} ${res.statusText || ''})`.trim()
      } as unknown as T;
    }
    const data = await res.json();
    return data;
  } catch (err: any) {
    console.error(`[API] Network error for ${url}:`, err);
    return {
      success: false,
      message: err?.message || 'Network error occurred while communicating with server'
    } as unknown as T;
  }
}

export const api = {
  // --- AUTH ---
  auth: {
    async register(data: { name: string; email: string; password: string; role?: string; phone?: string; companyName?: string }) {
      return safeFetchJson(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
    },
    async login(data: { email: string; password: string }) {
      return safeFetchJson(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
    },
    async adminLogin(passkey: string) {
      const data = await safeFetchJson(`${API_BASE}/auth/admin-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passkey })
      });
      if (data?.token) {
        localStorage.setItem('hybrid_auth_token', data.token);
        localStorage.setItem('hybrid_admin_dev_passkey', passkey);
      }
      return data;
    },
    async me() {
      return safeFetchJson(`${API_BASE}/auth/me`, {
        headers: getAuthHeader()
      });
    },
    async logout() {
      try {
        await safeFetchJson(`${API_BASE}/auth/logout`, {
          method: 'POST',
          headers: getAuthHeader()
        });
      } catch {}
      localStorage.removeItem('hybrid_auth_token');
      localStorage.removeItem('hybrid_admin_dev_passkey');
    }
  },

  // --- JOBS ---
  jobs: {
    async getAll(params?: Record<string, string>) {
      const qs = params ? new URLSearchParams(params).toString() : '';
      return safeFetchJson(`${API_BASE}/jobs${qs ? `?${qs}` : ''}`);
    },
    async getById(id: string) {
      return safeFetchJson(`${API_BASE}/jobs/${id}`);
    },
    async getBySlug(slug: string) {
      return safeFetchJson(`${API_BASE}/jobs/slug/${slug}`);
    },
    async create(jobData: any) {
      return safeFetchJson(`${API_BASE}/jobs`, {
        method: 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify(jobData)
      });
    },
    async update(id: string, updates: any) {
      return safeFetchJson(`${API_BASE}/jobs/${id}`, {
        method: 'PUT',
        headers: getAuthHeader(),
        body: JSON.stringify(updates)
      });
    },
    async delete(id: string) {
      return safeFetchJson(`${API_BASE}/jobs/${id}`, {
        method: 'DELETE',
        headers: getAuthHeader()
      });
    },
    async getPendingQueue() {
      return safeFetchJson(`${API_BASE}/jobs/queue/pending`, {
        headers: getAuthHeader()
      });
    },
    async approvePending(id: string) {
      return safeFetchJson(`${API_BASE}/jobs/queue/pending/${id}/approve`, {
        method: 'POST',
        headers: getAuthHeader()
      });
    },
    async rejectPending(id: string, reason?: string) {
      return safeFetchJson(`${API_BASE}/jobs/queue/pending/${id}/reject`, {
        method: 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify({ reason })
      });
    },
    async detectDuplicates(jobData: any) {
      return safeFetchJson(`${API_BASE}/jobs/detect-duplicates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(jobData)
      });
    },
    async overrideDuplicate(jobId: string, reason?: string) {
      return safeFetchJson(`${API_BASE}/jobs/override-duplicate`, {
        method: 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify({ jobId, reason })
      });
    },
    async mergeJobs(primaryJobId: string, secondaryJobId: string) {
      return safeFetchJson(`${API_BASE}/jobs/merge`, {
        method: 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify({ primaryJobId, secondaryJobId })
      });
    },
    async bulkDelete(ids: string[]) {
      return safeFetchJson(`${API_BASE}/jobs/bulk-delete`, {
        method: 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify({ ids })
      });
    },
    async bulkApprove(ids: string[]) {
      return safeFetchJson(`${API_BASE}/jobs/bulk-approve`, {
        method: 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify({ ids })
      });
    },
    async bulkReject(ids: string[], reason?: string) {
      return safeFetchJson(`${API_BASE}/jobs/bulk-reject`, {
        method: 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify({ ids, reason })
      });
    },
    async bulkUpdate(jobs: any[]) {
      return safeFetchJson(`${API_BASE}/jobs/bulk-update`, {
        method: 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify({ jobs })
      });
    },
    async bulkAdd(jobs: any[], status: string = 'Approved') {
      return safeFetchJson(`${API_BASE}/jobs/bulk-add`, {
        method: 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify({ jobs, status })
      });
    },
    async bulkDeleteDuplicates(ids: string[]) {
      return safeFetchJson(`${API_BASE}/jobs/bulk-delete-duplicates`, {
        method: 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify({ ids })
      });
    },
    async keepOriginal(ids: string[]) {
      return safeFetchJson(`${API_BASE}/jobs/keep-original-delete-duplicates`, {
        method: 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify({ ids })
      });
    },
    async keepOriginalDeleteDuplicates(ids: string[]) {
      return safeFetchJson(`${API_BASE}/jobs/keep-original-delete-duplicates`, {
        method: 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify({ ids })
      });
    },
    async overwriteOriginal(ids: string[]) {
      return safeFetchJson(`${API_BASE}/jobs/overwrite-original`, {
        method: 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify({ ids })
      });
    }
  },

  // --- APPLICATIONS ---
  applications: {
    async getAll(jobId?: string, applicantId?: string) {
      const params = new URLSearchParams();
      if (jobId) params.append('jobId', jobId);
      if (applicantId) params.append('applicantId', applicantId);
      return safeFetchJson(`${API_BASE}/applications?${params.toString()}`);
    },
    async submit(data: any) {
      return safeFetchJson(`${API_BASE}/applications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
    },
    async uploadCv(file: File): Promise<{ success: boolean; fileUrl?: string; fileName?: string; fileSize?: number; message?: string }> {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async () => {
          try {
            const base64 = reader.result as string;
            const data = await safeFetchJson(`${API_BASE}/applications/upload-cv`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                fileName: file.name,
                fileType: file.type,
                fileBase64: base64
              })
            });
            resolve(data);
          } catch (err) {
            reject(err);
          }
        };
        reader.onerror = () => reject(new Error('Failed to read file from local system.'));
        reader.readAsDataURL(file);
      });
    },
    async updateStatus(id: string, status: string, notes?: string) {
      return safeFetchJson(`${API_BASE}/applications/${id}/status`, {
        method: 'PATCH',
        headers: getAuthHeader(),
        body: JSON.stringify({ status, notes })
      });
    }
  },

  // --- PRICING ---
  pricing: {
    async get() {
      return safeFetchJson(`${API_BASE}/pricing`);
    },
    async calculateJob(options: any) {
      return safeFetchJson(`${API_BASE}/pricing/calculate-job`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options)
      });
    },
    async calculateAd(options: any) {
      return safeFetchJson(`${API_BASE}/pricing/calculate-ad`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options)
      });
    },
    async update(pricingData: any) {
      return safeFetchJson(`${API_BASE}/pricing`, {
        method: 'PUT',
        headers: getAuthHeader(),
        body: JSON.stringify(pricingData)
      });
    }
  },

  // --- APPLY SETTINGS ---
  applySettings: {
    async get() {
      return safeFetchJson(`${API_BASE}/apply-settings`);
    },
    async update(settingsData: any) {
      return safeFetchJson(`${API_BASE}/apply-settings`, {
        method: 'PUT',
        headers: getAuthHeader(),
        body: JSON.stringify(settingsData)
      });
    }
  },

  // --- SCRAPER ---
  scraper: {
    async getConfigs() {
      return safeFetchJson(`${API_BASE}/scraper/configs`, { headers: getAuthHeader() });
    },
    async saveConfigs(configs: any[]) {
      return safeFetchJson(`${API_BASE}/scraper/configs`, {
        method: 'PUT',
        headers: getAuthHeader(),
        body: JSON.stringify(configs)
      });
    },
    async run(options: any) {
      return safeFetchJson(`${API_BASE}/scraper/run`, {
        method: 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify(options)
      });
    },
    async getRuns() {
      return safeFetchJson(`${API_BASE}/scraper/runs`, { headers: getAuthHeader() });
    },
    async retrySources(sourceIds?: string[], retryAllFailed?: boolean) {
      return safeFetchJson(`${API_BASE}/scraper/retry`, {
        method: 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify({ sourceIds, retryAllFailed })
      });
    },
    async getGroups() {
      return safeFetchJson(`${API_BASE}/scraper/groups`, { headers: getAuthHeader() });
    },
    async createGroup(data: { name: string; description?: string; sourceIds?: string[] }) {
      return safeFetchJson(`${API_BASE}/scraper/groups`, {
        method: 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify(data)
      });
    },
    async updateGroup(id: string, updates: { name?: string; description?: string; sourceIds?: string[] }) {
      return safeFetchJson(`${API_BASE}/scraper/groups/${id}`, {
        method: 'PUT',
        headers: getAuthHeader(),
        body: JSON.stringify(updates)
      });
    },
    async deleteGroup(id: string) {
      return safeFetchJson(`${API_BASE}/scraper/groups/${id}`, {
        method: 'DELETE',
        headers: getAuthHeader()
      });
    },
    async addSourcesToGroup(id: string, sourceIds: string[]) {
      return safeFetchJson(`${API_BASE}/scraper/groups/${id}/add-sources`, {
        method: 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify({ sourceIds })
      });
    },
    async removeSourcesFromGroup(id: string, sourceIds: string[]) {
      return safeFetchJson(`${API_BASE}/scraper/groups/${id}/remove-sources`, {
        method: 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify({ sourceIds })
      });
    },
    async moveSourceToGroup(sourceId: string, targetGroupId?: string | null) {
      return safeFetchJson(`${API_BASE}/scraper/sources/${sourceId}/move-group`, {
        method: 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify({ targetGroupId })
      });
    },
    async bulkMoveSourcesToGroup(sourceIds: string[], targetGroupId?: string | null) {
      return safeFetchJson(`${API_BASE}/scraper/sources/bulk-move-group`, {
        method: 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify({ sourceIds, targetGroupId })
      });
    },
    async runGroup(id: string) {
      return safeFetchJson(`${API_BASE}/scraper/groups/${id}/run`, {
        method: 'POST',
        headers: getAuthHeader()
      });
    },
    async getSchedulerStatus() {
      return safeFetchJson(`${API_BASE}/scraper/scheduler-status`, { headers: getAuthHeader() });
    },
    async schedulerTick() {
      return safeFetchJson(`${API_BASE}/scraper/scheduler-tick`, {
        method: 'POST',
        headers: getAuthHeader()
      });
    },
    async triggerSchedulerTick() {
      return safeFetchJson(`${API_BASE}/scraper/scheduler-tick`, {
        method: 'POST',
        headers: getAuthHeader()
      });
    },
    async parseUrl(dataOrUrl: { url: string; organization?: string; title?: string } | string, organization?: string, title?: string) {
      const payload = typeof dataOrUrl === 'string'
        ? { url: dataOrUrl, organization, title }
        : dataOrUrl;
      return safeFetchJson(`${API_BASE}/scraper/parse-url`, {
        method: 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify(payload)
      });
    }
  },

  // --- SEO ---
  seo: {
    async getConfig() {
      return safeFetchJson(`${API_BASE}/seo/config`);
    },
    async updateConfig(configData: any) {
      return safeFetchJson(`${API_BASE}/seo/config`, {
        method: 'PUT',
        headers: getAuthHeader(),
        body: JSON.stringify(configData)
      });
    }
  },

  // --- TRANSACTIONS ---
  transactions: {
    async getAll(userId?: string) {
      const qs = userId ? `?userId=${userId}` : '';
      return safeFetchJson(`${API_BASE}/transactions${qs}`);
    },
    async submit(txData: any) {
      return safeFetchJson(`${API_BASE}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(txData)
      });
    },
    async verify(id: string, action: 'approve' | 'reject', note?: string, reason?: string) {
      return safeFetchJson(`${API_BASE}/transactions/${id}/verify`, {
        method: 'PATCH',
        headers: getAuthHeader(),
        body: JSON.stringify({ action, note, reason })
      });
    }
  },

  // --- ADVERTISEMENTS ---
  ads: {
    async getAll(status?: string, placement?: string) {
      const params = new URLSearchParams();
      if (status) params.append('status', status);
      if (placement) params.append('placement', placement);
      return safeFetchJson(`${API_BASE}/ads?${params.toString()}`);
    },
    async create(adData: any) {
      return safeFetchJson(`${API_BASE}/ads`, {
        method: 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify(adData)
      });
    },
    async update(id: string, adData: any) {
      return safeFetchJson(`${API_BASE}/ads/${id}`, {
        method: 'PUT',
        headers: getAuthHeader(),
        body: JSON.stringify(adData)
      });
    },
    async delete(id: string) {
      return safeFetchJson(`${API_BASE}/ads/${id}`, {
        method: 'DELETE',
        headers: getAuthHeader()
      });
    },
    async recordClick(id: string) {
      try {
        await fetch(`${API_BASE}/ads/${id}/click`, { method: 'POST' });
      } catch {}
    },
    async recordImpression(id: string) {
      try {
        await fetch(`${API_BASE}/ads/${id}/impression`, { method: 'POST' });
      } catch {}
    }
  },

  // --- AUDIT LOGS ---
  audit: {
    async getLogs() {
      return safeFetchJson(`${API_BASE}/audit-logs`, {
        headers: getAuthHeader()
      });
    }
  },

  // --- ADMIN SETTINGS & FLAGS ---
  admin: {
    async getFeatureFlags() {
      return safeFetchJson(`${API_BASE}/admin/feature-flags`, { headers: getAuthHeader() });
    },
    async updateFeatureFlags(flags: any) {
      return safeFetchJson(`${API_BASE}/admin/feature-flags`, {
        method: 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify(flags)
      });
    }
  },

  // --- SITE SETTINGS (LANDING, CAMPAIGNS, WHATSAPP) ---
  settings: {
    async getLanding() {
      return safeFetchJson<{ success: boolean; config: any }>(`${API_BASE}/settings/landing`);
    },
    async updateLanding(config: any) {
      return safeFetchJson<{ success: boolean; config: any; message?: string }>(`${API_BASE}/settings/landing`, {
        method: 'PUT',
        headers: getAuthHeader(),
        body: JSON.stringify(config)
      });
    },
    async getCampaigns() {
      return safeFetchJson<{ success: boolean; config: any }>(`${API_BASE}/settings/campaigns`);
    },
    async updateCampaigns(config: any) {
      return safeFetchJson<{ success: boolean; config: any; message?: string }>(`${API_BASE}/settings/campaigns`, {
        method: 'PUT',
        headers: getAuthHeader(),
        body: JSON.stringify(config)
      });
    },
    async getWhatsApp() {
      return safeFetchJson<{ success: boolean; config: any }>(`${API_BASE}/settings/whatsapp`);
    },
    async updateWhatsApp(config: any) {
      return safeFetchJson<{ success: boolean; config: any; message?: string }>(`${API_BASE}/settings/whatsapp`, {
        method: 'PUT',
        headers: getAuthHeader(),
        body: JSON.stringify(config)
      });
    }
  }
};

export function setRuntimeBackendUrl(url: string): void {
  if (typeof window !== 'undefined') {
    if (url && url.trim()) {
      localStorage.setItem('hybrid_backend_api_url', url.trim());
    } else {
      localStorage.removeItem('hybrid_backend_api_url');
    }
  }
}

