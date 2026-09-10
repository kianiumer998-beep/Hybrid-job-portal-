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

  const isBrowser = typeof window !== 'undefined';
  const hostname = isBrowser ? window.location.hostname : '';
  const isVercel = Boolean(isBrowser && (hostname.endsWith('.vercel.app') || hostname.includes('vercel.app')));

  // 1. Explicitly configured backend URL (e.g. Render backend URL passed via env)
  if (envUrl) {
    const stripped = envUrl.replace(/\/+$/, '').replace(/\/api\/?$/, '');
    return `${stripped}/api`;
  }

  // 2. Production Vercel deployment where frontend is hosted statically on Vercel
  if (isVercel) {
    const runtimeUrl = isBrowser ? (localStorage.getItem('hybrid_backend_api_url') || '') : '';
    if (runtimeUrl.trim()) {
      const stripped = runtimeUrl.trim().replace(/\/+$/, '').replace(/\/api\/?$/, '');
      return `${stripped}/api`;
    }

    throw new Error(
      '[HybridJobs API Configuration Error] Production Vercel deployment detected without configured Render backend URL! Please configure VITE_API_BASE_URL or VITE_BACKEND_URL in your Vercel Project Environment Variables to your Render service URL (e.g. https://<app-name>.onrender.com).'
    );
  }

  // 3. Keep /api fallback only for local/full-stack development/preview where Express serves the API
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

export const api = {
  // --- AUTH ---
  auth: {
    async register(data: { name: string; email: string; password: string; role?: string; phone?: string; companyName?: string }) {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return res.json();
    },
    async login(data: { email: string; password: string }) {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return res.json();
    },
    async adminLogin(passkey: string) {
      const res = await fetch(`${API_BASE}/auth/admin-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passkey })
      });
      const data = await res.json();
      if (data.token) {
        localStorage.setItem('hybrid_auth_token', data.token);
        localStorage.setItem('hybrid_admin_dev_passkey', passkey);
      }
      return data;
    },
    async me() {
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: getAuthHeader()
      });
      return res.json();
    },
    async logout() {
      try {
        await fetch(`${API_BASE}/auth/logout`, {
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
      const res = await fetch(`${API_BASE}/jobs${qs ? `?${qs}` : ''}`);
      return res.json();
    },
    async getById(id: string) {
      const res = await fetch(`${API_BASE}/jobs/${id}`);
      return res.json();
    },
    async getBySlug(slug: string) {
      const res = await fetch(`${API_BASE}/jobs/slug/${slug}`);
      return res.json();
    },
    async create(jobData: any) {
      const res = await fetch(`${API_BASE}/jobs`, {
        method: 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify(jobData)
      });
      return res.json();
    },
    async update(id: string, updates: any) {
      const res = await fetch(`${API_BASE}/jobs/${id}`, {
        method: 'PUT',
        headers: getAuthHeader(),
        body: JSON.stringify(updates)
      });
      return res.json();
    },
    async delete(id: string) {
      const res = await fetch(`${API_BASE}/jobs/${id}`, {
        method: 'DELETE',
        headers: getAuthHeader()
      });
      return res.json();
    },
    async getPendingQueue() {
      const res = await fetch(`${API_BASE}/jobs/queue/pending`, {
        headers: getAuthHeader()
      });
      return res.json();
    },
    async approvePending(id: string) {
      const res = await fetch(`${API_BASE}/jobs/queue/pending/${id}/approve`, {
        method: 'POST',
        headers: getAuthHeader()
      });
      return res.json();
    },
    async rejectPending(id: string, reason?: string) {
      const res = await fetch(`${API_BASE}/jobs/queue/pending/${id}/reject`, {
        method: 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify({ reason })
      });
      return res.json();
    },
    async detectDuplicates(jobData: any) {
      const res = await fetch(`${API_BASE}/jobs/detect-duplicates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(jobData)
      });
      return res.json();
    },
    async overrideDuplicate(jobId: string, reason?: string) {
      const res = await fetch(`${API_BASE}/jobs/override-duplicate`, {
        method: 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify({ jobId, reason })
      });
      return res.json();
    },
    async mergeJobs(primaryJobId: string, secondaryJobId: string) {
      const res = await fetch(`${API_BASE}/jobs/merge`, {
        method: 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify({ primaryJobId, secondaryJobId })
      });
      return res.json();
    },
    async bulkDelete(ids: string[]) {
      const res = await fetch(`${API_BASE}/jobs/bulk-delete`, {
        method: 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify({ ids })
      });
      return res.json();
    },
    async bulkApprove(ids: string[]) {
      const res = await fetch(`${API_BASE}/jobs/bulk-approve`, {
        method: 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify({ ids })
      });
      return res.json();
    },
    async bulkReject(ids: string[], reason?: string) {
      const res = await fetch(`${API_BASE}/jobs/bulk-reject`, {
        method: 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify({ ids, reason })
      });
      return res.json();
    },
    async bulkUpdate(jobs: any[]) {
      const res = await fetch(`${API_BASE}/jobs/bulk-update`, {
        method: 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify({ jobs })
      });
      return res.json();
    },
    async bulkAdd(jobs: any[], status: string = 'Approved') {
      const res = await fetch(`${API_BASE}/jobs/bulk-add`, {
        method: 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify({ jobs, status })
      });
      return res.json();
    }
  },

  // --- APPLICATIONS ---
  applications: {
    async getAll(jobId?: string, applicantId?: string) {
      const params = new URLSearchParams();
      if (jobId) params.append('jobId', jobId);
      if (applicantId) params.append('applicantId', applicantId);
      const res = await fetch(`${API_BASE}/applications?${params.toString()}`);
      return res.json();
    },
    async submit(data: any) {
      const res = await fetch(`${API_BASE}/applications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return res.json();
    },
    async uploadCv(file: File): Promise<{ success: boolean; fileUrl?: string; fileName?: string; fileSize?: number; message?: string }> {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async () => {
          try {
            const base64 = reader.result as string;
            const res = await fetch(`${API_BASE}/applications/upload-cv`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                fileName: file.name,
                fileType: file.type,
                fileBase64: base64
              })
            });
            const data = await res.json();
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
      const res = await fetch(`${API_BASE}/applications/${id}/status`, {
        method: 'PATCH',
        headers: getAuthHeader(),
        body: JSON.stringify({ status, notes })
      });
      return res.json();
    }
  },

  // --- PRICING ---
  pricing: {
    async get() {
      const res = await fetch(`${API_BASE}/pricing`);
      return res.json();
    },
    async calculateJob(options: any) {
      const res = await fetch(`${API_BASE}/pricing/calculate-job`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options)
      });
      return res.json();
    },
    async calculateAd(options: any) {
      const res = await fetch(`${API_BASE}/pricing/calculate-ad`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options)
      });
      return res.json();
    },
    async update(pricingData: any) {
      const res = await fetch(`${API_BASE}/pricing`, {
        method: 'PUT',
        headers: getAuthHeader(),
        body: JSON.stringify(pricingData)
      });
      return res.json();
    }
  },

  // --- APPLY SETTINGS ---
  applySettings: {
    async get() {
      const res = await fetch(`${API_BASE}/apply-settings`);
      return res.json();
    },
    async update(settingsData: any) {
      const res = await fetch(`${API_BASE}/apply-settings`, {
        method: 'PUT',
        headers: getAuthHeader(),
        body: JSON.stringify(settingsData)
      });
      return res.json();
    }
  },

  // --- SCRAPER ---
  scraper: {
    async getConfigs() {
      const res = await fetch(`${API_BASE}/scraper/configs`);
      return res.json();
    },
    async saveConfigs(configs: any[]) {
      const res = await fetch(`${API_BASE}/scraper/configs`, {
        method: 'PUT',
        headers: getAuthHeader(),
        body: JSON.stringify(configs)
      });
      return res.json();
    },
    async run(options: {
      mode: 'complete' | 'page_range' | 'since_last' | 'custom_date' | 'source_only';
      sourceId?: string;
      sourceIds?: string[];
      startPage?: number;
      endPage?: number;
      sinceTimestamp?: string;
      fromTimestamp?: string;
      toTimestamp?: string;
      autoPublishTrusted?: boolean;
    }) {
      const res = await fetch(`${API_BASE}/scraper/run`, {
        method: 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify(options)
      });
      return res.json();
    },
    async getRuns() {
      const res = await fetch(`${API_BASE}/scraper/runs`);
      return res.json();
    },
    async parseUrl(dataOrUrl: { url: string; organization?: string; title?: string } | string, organization?: string, title?: string) {
      const payload = typeof dataOrUrl === 'string'
        ? { url: dataOrUrl, organization, title }
        : dataOrUrl;
      const res = await fetch(`${API_BASE}/scraper/parse-url`, {
        method: 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify(payload)
      });
      return res.json();
    }
  },

  // --- SEO ---
  seo: {
    async getConfig() {
      const res = await fetch(`${API_BASE}/seo/config`);
      return res.json();
    },
    async updateConfig(configData: any) {
      const res = await fetch(`${API_BASE}/seo/config`, {
        method: 'PUT',
        headers: getAuthHeader(),
        body: JSON.stringify(configData)
      });
      return res.json();
    }
  },

  // --- TRANSACTIONS ---
  transactions: {
    async getAll(userId?: string) {
      const qs = userId ? `?userId=${userId}` : '';
      const res = await fetch(`${API_BASE}/transactions${qs}`);
      return res.json();
    },
    async submit(txData: any) {
      const res = await fetch(`${API_BASE}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(txData)
      });
      return res.json();
    },
    async verify(id: string, action: 'approve' | 'reject', note?: string, reason?: string) {
      const res = await fetch(`${API_BASE}/transactions/${id}/verify`, {
        method: 'PATCH',
        headers: getAuthHeader(),
        body: JSON.stringify({ action, note, reason })
      });
      return res.json();
    }
  },

  // --- ADVERTISEMENTS ---
  ads: {
    async getAll(status?: string, placement?: string) {
      const params = new URLSearchParams();
      if (status) params.append('status', status);
      if (placement) params.append('placement', placement);
      const res = await fetch(`${API_BASE}/ads?${params.toString()}`);
      return res.json();
    },
    async create(adData: any) {
      const res = await fetch(`${API_BASE}/ads`, {
        method: 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify(adData)
      });
      return res.json();
    },
    async update(id: string, adData: any) {
      const res = await fetch(`${API_BASE}/ads/${id}`, {
        method: 'PUT',
        headers: getAuthHeader(),
        body: JSON.stringify(adData)
      });
      return res.json();
    },
    async delete(id: string) {
      const res = await fetch(`${API_BASE}/ads/${id}`, {
        method: 'DELETE',
        headers: getAuthHeader()
      });
      return res.json();
    },
    async recordClick(id: string) {
      await fetch(`${API_BASE}/ads/${id}/click`, { method: 'POST' });
    },
    async recordImpression(id: string) {
      await fetch(`${API_BASE}/ads/${id}/impression`, { method: 'POST' });
    }
  },

  // --- AUDIT LOGS ---
  audit: {
    async getLogs() {
      const res = await fetch(`${API_BASE}/audit-logs`, {
        headers: getAuthHeader()
      });
      return res.json();
    }
  },

  // --- ADMIN SETTINGS & FLAGS ---
  admin: {
    async getFeatureFlags() {
      const res = await fetch(`${API_BASE}/admin/feature-flags`, { headers: getAuthHeader() });
      return res.json();
    },
    async updateFeatureFlags(flags: any) {
      const res = await fetch(`${API_BASE}/admin/feature-flags`, {
        method: 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify(flags)
      });
      return res.json();
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

