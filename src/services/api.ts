// Centralized Production API Service for Hybrid Job Portal

const API_BASE = '/api';

function getAuthHeader(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  const token = localStorage.getItem('hybrid_auth_token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  // Only include testing passkey if admin explicitly logged in using demo credentials
  const passkey = localStorage.getItem('hybrid_admin_dev_passkey');
  if (passkey) {
    headers['x-admin-passkey'] = passkey;
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
  }
};
