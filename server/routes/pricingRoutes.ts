import { Router } from 'express';
import crypto from 'crypto';
import { PricingRepository, AuditRepository } from '../db/repositories';
import { requireAdminPermission, requireAuth } from '../auth/authManager';
import { dispatchEarlyAccessReminderNow, runSubscriptionReminderTick } from '../services/subscriptionReminderScheduler';

export const pricingRouter = Router();
const cvAiRecentRequests = new Map<string, number[]>();

const CV_AI_PROVIDERS: Record<string, { endpoint: string; defaultModel: string }> = {
  openai: { endpoint: 'https://api.openai.com/v1/chat/completions', defaultModel: 'gpt-4o-mini' },
  gemini: { endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', defaultModel: 'gemini-2.0-flash' },
  groq: { endpoint: 'https://api.groq.com/openai/v1/chat/completions', defaultModel: 'llama-3.3-70b-versatile' }
};

function cvAiEncryptionKey(): Buffer {
  const secret = String(process.env.JWT_SECRET || '');
  if (secret.length < 32) throw new Error('Secure CV AI key storage is unavailable: configure a JWT_SECRET of at least 32 characters.');
  return crypto.createHash('sha256').update('hybrid-job-portal:cv-ai-key:v1:' + secret).digest();
}

function encryptCvAiKey(value: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', cvAiEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [iv.toString('base64'), cipher.getAuthTag().toString('base64'), encrypted.toString('base64')].join('.');
}

function decryptCvAiKey(value: string): string {
  const [ivPart, tagPart, dataPart] = String(value || '').split('.');
  if (!ivPart || !tagPart || !dataPart) throw new Error('Stored CV AI provider key is invalid. Please re-enter it in Admin settings.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', cvAiEncryptionKey(), Buffer.from(ivPart, 'base64'));
  decipher.setAuthTag(Buffer.from(tagPart, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(dataPart, 'base64')), decipher.final()]).toString('utf8');
}

function publicPricing(pricing: any): any {
  const safe = { ...pricing, cvBuilder: { ...(pricing?.cvBuilder || {}) } };
  const config = safe.cvBuilder.aiProviderConfig || {};
  delete safe.cvBuilder.aiProviderConfig;
  safe.cvBuilder.aiProviderConfigured = Boolean(config.apiKeyEncrypted && config.verified === true && CV_AI_PROVIDERS[config.provider]);
  return safe;
}

function publicCvAiConfig(pricing: any): any {
  const config = pricing?.cvBuilder?.aiProviderConfig || {};
  return {
    provider: CV_AI_PROVIDERS[config.provider] ? config.provider : 'openai',
    model: String(config.model || CV_AI_PROVIDERS[config.provider]?.defaultModel || CV_AI_PROVIDERS.openai.defaultModel),
    apiKeyConfigured: Boolean(config.apiKeyEncrypted && CV_AI_PROVIDERS[config.provider]),
    connectionVerified: config.verified === true
  };
}

function safeAiText(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

// 1. Get Complete Dynamic Pricing Configuration
pricingRouter.get('/', async (req, res) => {
  try {
    const pricing = await PricingRepository.get();
    res.json({ success: true, pricing: publicPricing(pricing) });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error fetching pricing' });
  }
});

// 2. Calculate Job Posting Price Server-Side (Authoritative)
pricingRouter.post('/calculate-job', async (req, res) => {
  try {
    const calculation = await PricingRepository.calculateJobPostingPrice(req.body);
    res.json({ success: true, calculation });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error calculating job price' });
  }
});

// 3. Calculate Advertisement Price Server-Side (Authoritative)
pricingRouter.post('/calculate-ad', async (req, res) => {
  try {
    const calculation = await PricingRepository.calculateAdPrice(req.body);
    res.json({ success: true, calculation });
  } catch (err: any) {
    const statusCode = typeof err?.statusCode === 'number' && err.statusCode >= 400 ? err.statusCode : 500;
    res.status(statusCode).json({ success: false, message: err.message || 'Error calculating ad price' });
  }
});

// CV AI provider configuration. API keys are encrypted at rest and never returned to clients.
pricingRouter.get('/cv-ai/config', requireAdminPermission('finance.manage'), async (_req, res) => {
  try {
    res.json({ success: true, config: publicCvAiConfig(await PricingRepository.get()) });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Unable to load CV AI configuration.' });
  }
});

pricingRouter.put('/cv-ai/config', requireAdminPermission('finance.manage'), async (req, res) => {
  try {
    const provider = String(req.body?.provider || 'openai').trim().toLowerCase();
    if (!CV_AI_PROVIDERS[provider]) return res.status(400).json({ success: false, message: 'Choose a supported AI provider.' });
    const model = safeAiText(req.body?.model, 100);
    if (!model || !/^[a-zA-Z0-9._:-]+$/.test(model)) return res.status(400).json({ success: false, message: 'Enter a valid AI model name.' });
    const apiKey = safeAiText(req.body?.apiKey, 500);
    const clearApiKey = req.body?.clearApiKey === true;
    const current = await PricingRepository.get();
    const existing = current?.cvBuilder?.aiProviderConfig || {};
    const config: any = { provider, model, verified: false };
    if (clearApiKey) {
      // Explicit removal disables user access until a new provider key is saved.
    } else if (apiKey) {
      if (apiKey.length < 12) return res.status(400).json({ success: false, message: 'The API key looks too short. Check it and try again.' });
      config.apiKeyEncrypted = encryptCvAiKey(apiKey);
    } else if (existing.apiKeyEncrypted && existing.provider === provider && String(existing.model || '') === model) {
      config.apiKeyEncrypted = existing.apiKeyEncrypted;
      config.verified = existing.verified === true;
    } else {
      return res.status(400).json({ success: false, message: 'Enter an API key before saving provider settings.' });
    }
    const updated = await PricingRepository.update({ cvBuilder: { aiProviderConfig: config } });
    res.json({ success: true, config: publicCvAiConfig(updated), message: clearApiKey ? 'AI provider key removed.' : 'AI provider settings saved securely.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Unable to save CV AI provider settings.' });
  }
});

pricingRouter.post('/cv-ai/test', requireAdminPermission('finance.manage'), async (_req, res) => {
  try {
    const pricing = await PricingRepository.get();
    const config = pricing?.cvBuilder?.aiProviderConfig || {};
    const providerConfig = CV_AI_PROVIDERS[String(config.provider || '')];
    if (!providerConfig || !config.apiKeyEncrypted) return res.status(400).json({ success: false, message: 'Save a provider API key before testing the connection.' });
    const response = await fetch(providerConfig.endpoint, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + decryptCvAiKey(config.apiKeyEncrypted), 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: String(config.model || providerConfig.defaultModel), temperature: 0, max_tokens: 5, messages: [{ role: 'user', content: 'Reply with OK.' }] }),
      signal: AbortSignal.timeout(20000)
    });
    if (!response.ok) return res.status(response.status === 401 || response.status === 403 ? 400 : 503).json({ success: false, message: response.status === 401 || response.status === 403 ? 'The provider rejected this API key. Check the key and model.' : 'The provider test request failed. Check the selected model and try again.' });
    const updated = await PricingRepository.update({ cvBuilder: { aiProviderConfig: { ...config, verified: true } } });
    res.json({ success: true, config: publicCvAiConfig(updated), message: 'AI provider connection verified successfully.' });
  } catch (err: any) {
    const timeout = err?.name === 'TimeoutError' || err?.name === 'AbortError';
    res.status(timeout ? 504 : 500).json({ success: false, message: timeout ? 'Provider test timed out. Please try again.' : 'Unable to verify the AI provider connection.' });
  }
});

pricingRouter.post('/cv-ai/generate', requireAuth, async (req: any, res) => {
  try {
    const userKey = String(req.user?.userId || req.user?.id || req.user?.email || '').trim();
    if (!userKey) return res.status(401).json({ success: false, message: 'Please sign in again to use the AI Writing Assistant.' });
    const now = Date.now();
    const recent = (cvAiRecentRequests.get(userKey) || []).filter((timestamp) => now - timestamp < 60000);
    if (recent.length >= 8) return res.status(429).json({ success: false, message: 'AI request limit reached. Please wait a minute before trying again.' });
    recent.push(now);
    cvAiRecentRequests.set(userKey, recent);
    if (cvAiRecentRequests.size > 5000) {
      for (const [key, timestamps] of cvAiRecentRequests) {
        if (!timestamps.some((timestamp) => now - timestamp < 60000)) cvAiRecentRequests.delete(key);
      }
    }
    const pricing = await PricingRepository.get();
    const cv = pricing?.cvBuilder || {};
    if (cv.aiWritingAssistantEnabled !== true) return res.status(403).json({ success: false, message: 'The AI Writing Assistant is currently disabled by the administrator.' });
    const config = cv.aiProviderConfig || {};
    const provider = String(config.provider || '');
    const providerConfig = CV_AI_PROVIDERS[provider];
    if (!providerConfig || !config.apiKeyEncrypted || config.verified !== true) return res.status(503).json({ success: false, message: 'The AI Writing Assistant provider has not been verified by an administrator yet.' });
    const action = String(req.body?.action || '');
    if (!['improve_summary', 'rewrite_bullet'].includes(action)) return res.status(400).json({ success: false, message: 'Choose a supported CV writing task.' });
    const sourceText = safeAiText(req.body?.text, 5000);
    const jobTitle = safeAiText(req.body?.jobTitle, 160);
    if (sourceText.length < 10) return res.status(400).json({ success: false, message: 'Enter at least 10 characters to improve.' });
    const model = String(config.model || providerConfig.defaultModel).slice(0, 100);
    const taskInstruction = action === 'improve_summary'
      ? 'Rewrite the supplied professional summary into a clear, concise, ATS-friendly CV summary (about 50–100 words).'
      : 'Rewrite the supplied work-experience bullet into one concise, impact-focused CV bullet.';
    const response = await fetch(providerConfig.endpoint, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + decryptCvAiKey(config.apiKeyEncrypted), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        temperature: 0.35,
        max_tokens: 350,
        messages: [
          { role: 'system', content: 'You are a careful CV writing assistant. Improve wording only. Never invent employers, qualifications, skills, metrics, achievements, dates, or facts. Preserve the meaning and factual claims. Return only the improved text, without markdown or commentary.' },
          { role: 'user', content: taskInstruction + (jobTitle ? ' Target role: ' + jobTitle + '.' : '') + '\n\nText to improve:\n' + sourceText }
        ]
      }),
      signal: AbortSignal.timeout(30000)
    });
    if (!response.ok) {
      const status = response.status;
      return res.status(status === 401 || status === 403 ? 502 : 503).json({ success: false, message: status === 401 || status === 403 ? 'The AI provider rejected the API key. Check the key in Admin CV settings.' : 'The AI provider is temporarily unavailable. Please try again later.' });
    }
    const payload: any = await response.json();
    const raw = payload?.choices?.[0]?.message?.content;
    const suggestion = typeof raw === 'string' ? raw.trim() : Array.isArray(raw) ? raw.map((part: any) => part?.text || '').join('').trim() : '';
    if (!suggestion || suggestion.length > 5000) return res.status(502).json({ success: false, message: 'The AI provider returned an empty or invalid response.' });
    res.json({ success: true, suggestion, provider, model });
  } catch (err: any) {
    const timeout = err?.name === 'TimeoutError' || err?.name === 'AbortError';
    res.status(timeout ? 504 : 500).json({ success: false, message: timeout ? 'The AI request timed out. Please try again.' : 'Unable to generate a CV suggestion right now.' });
  }
});

// 4. Update Dynamic Pricing Configuration (Admin Only)
pricingRouter.put('/', requireAdminPermission('finance.manage'), async (req, res) => {
  try {
    const updated = await PricingRepository.update(req.body);

    const auditOutcome = await AuditRepository.addAfterPrimaryOperation({
      user: (req as any).user?.name || (req as any).user?.email || 'Administrator',
      role: (req as any).user?.role || 'Finance Manager',
      action: 'Pricing Configuration Updated',
      target: 'Dynamic Job & Ad Pricing Matrix',
      status: 'Success'
    }, 'PUT /api/pricing');

    res.json({
      success: true,
      pricing: publicPricing(updated),
      message: 'Pricing configuration updated successfully!',
      ...(auditOutcome.persisted ? {} : { auditPersisted: false, auditWarning: auditOutcome.auditWarning })
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error updating pricing' });
  }
});

// 5. Manual Reminder Dispatch (Early Access Immediate Reminder or Full Scheduled Tick)
pricingRouter.post('/reminders/dispatch', requireAdminPermission('finance.manage'), async (req, res) => {
  try {
    const scope = String(req.body?.scope || 'early-access');
    if (scope === 'early-access') {
      const customSubject = typeof req.body?.customSubject === 'string' ? req.body.customSubject.trim().slice(0, 140) : undefined;
      const customMessage = typeof req.body?.customMessage === 'string' ? req.body.customMessage.trim().slice(0, 400) : undefined;
      const rawChannels = req.body?.channels && typeof req.body.channels === 'object' ? req.body.channels : undefined;
      const channels = rawChannels
        ? {
            inApp: rawChannels.inApp !== undefined ? Boolean(rawChannels.inApp) : undefined,
            email: rawChannels.email !== undefined ? Boolean(rawChannels.email) : undefined,
            whatsapp: rawChannels.whatsapp !== undefined ? Boolean(rawChannels.whatsapp) : undefined,
            sms: rawChannels.sms !== undefined ? Boolean(rawChannels.sms) : undefined
          }
        : undefined;

      const summary = await dispatchEarlyAccessReminderNow({
        customSubject,
        customMessage,
        channels,
        manualTrigger: true
      });

      await AuditRepository.addAfterPrimaryOperation({
        user: (req as any).user?.name || (req as any).user?.email || 'Administrator',
        role: (req as any).user?.role || 'Admin',
        action: 'Early Access Reminder Dispatched',
        target: `${summary.eligibleMembers} Early Access members · ${summary.jobsCount} jobs`,
        status: 'Success'
      }, 'POST /api/pricing/reminders/dispatch');

      return res.json({
        success: true,
        scope,
        summary,
        message: summary.jobsCount === 0
          ? 'No active Early Access jobs are currently locked. Reminder skipped.'
          : `Dispatched to ${summary.eligibleMembers} Early Access member(s) for ${summary.jobsCount} job(s) (In-App: ${summary.inAppSent}, Email: ${summary.emailSent}, WhatsApp: ${summary.whatsappSent}, SMS: ${summary.smsSent}).`
      });
    }

    if (scope === 'all-scheduled') {
      const result = await runSubscriptionReminderTick(new Date());
      return res.json({
        success: true,
        scope,
        summary: result,
        message: result.skipped
          ? 'Reminder scheduler is already running.'
          : `Processed ${result.scanned} account(s); dispatched ${result.notified} scheduled notification(s)/alert(s).`
      });
    }

    return res.status(400).json({ success: false, message: 'Unsupported reminder dispatch scope.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error dispatching reminders' });
  }
});
