import { getResolvedApiBase } from './api';

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (typeof window !== 'undefined') {
    const token = window.localStorage.getItem('hybrid_auth_token');
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function requestCvAi(path: string, method: 'GET' | 'PUT' | 'POST', payload?: Record<string, any>): Promise<any> {
  const response = await fetch(`${getResolvedApiBase()}${path}`, {
    method,
    headers: getAuthHeaders(),
    ...(payload ? { body: JSON.stringify(payload) } : {})
  });
  let result: any;
  try { result = await response.json(); } catch { result = null; }
  if (!response.ok && result && typeof result === 'object') return { ...result, success: false };
  if (!response.ok) return { success: false, message: 'CV AI service request failed (' + response.status + ').' };
  return result;
}

export const cvAiApi = {
  getConfig: () => requestCvAi('/pricing/cv-ai/config', 'GET'),
  updateConfig: (config: { provider: string; model: string; apiKey?: string; clearApiKey?: boolean }) =>
    requestCvAi('/pricing/cv-ai/config', 'PUT', config),
  generate: (payload: { action: 'improve_summary' | 'rewrite_bullet'; text: string; jobTitle?: string }) =>
    requestCvAi('/pricing/cv-ai/generate', 'POST', payload)
};
