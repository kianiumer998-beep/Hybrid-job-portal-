import { Router } from 'express';
import { CommunicationProviderRepository, AuditRepository } from '../db/repositories';
import { requireAdminPermission } from '../auth/authManager';
import { sendProviderTestMessage } from '../services/communicationDeliveryService';

export const communicationProviderRouter = Router();
const providerTestLastSentAt = new Map<string, number>();

// GET /api/settings/communication/providers (Admin only)
communicationProviderRouter.get('/', requireAdminPermission('settings.manage'), async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const config = await CommunicationProviderRepository.getConfig();
    return res.json({
      success: true,
      config
    });
  } catch (err: any) {
    console.error('[CommunicationProviderRoutes] Error fetching provider configuration:', err);
    return res.status(500).json({
      success: false,
      message: err?.message || 'Failed to fetch communication provider settings.'
    });
  }
});

// PUT /api/settings/communication/providers (Admin only)
communicationProviderRouter.put('/', requireAdminPermission('settings.manage'), async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const user = (req as any).user;
    const body = req.body || {};

    // Input Validation: Provider selections
    if (body.emailProvider && !['smtp', 'sendgrid', 'resend'].includes(body.emailProvider)) {
      return res.status(400).json({
        success: false,
        message: 'Validation Error: emailProvider must be one of "smtp", "sendgrid", or "resend".'
      });
    }

    if (body.whatsappProvider && !['meta-cloud', 'twilio'].includes(body.whatsappProvider)) {
      return res.status(400).json({
        success: false,
        message: 'Validation Error: whatsappProvider must be one of "meta-cloud" or "twilio".'
      });
    }
    if (body.smsProvider && !['disabled', 'twilio'].includes(body.smsProvider)) {
      return res.status(400).json({
        success: false,
        message: 'Validation Error: smsProvider must be one of "disabled" or "twilio".'
      });
    }
    if (body.smsFromNumber && typeof body.smsFromNumber === 'string' &&
        !/^\+?[1-9][0-9]{7,14}$/.test(body.smsFromNumber.trim())) {
      return res.status(400).json({
        success: false,
        message: 'Validation Error: smsFromNumber must be a valid international sender number.'
      });
    }

    // SMTP Port Validation
    if (body.smtpPort !== undefined && body.smtpPort !== null && body.smtpPort !== '') {
      const portNum = Number(body.smtpPort);
      if (!Number.isInteger(portNum) || portNum < 1 || portNum > 65535) {
        return res.status(400).json({
          success: false,
          message: 'Validation Error: smtpPort must be an integer between 1 and 65535.'
        });
      }
    }

    // Email format validation for sender address if provided and non-empty
    if (body.smtpSenderEmail && typeof body.smtpSenderEmail === 'string' && body.smtpSenderEmail.trim() !== '') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(body.smtpSenderEmail.trim())) {
        return res.status(400).json({
          success: false,
          message: 'Validation Error: Invalid smtpSenderEmail format.'
        });
      }
    }

    const clearSecrets = Array.isArray(body.clearSecrets) ? body.clearSecrets : [];

    const updatedConfig = await CommunicationProviderRepository.saveConfig(body, clearSecrets);

    // Audit log change containing ONLY field names (never secret values or credentials)
    const changedFieldNames = Object.keys(body).filter(k => k !== 'clearSecrets');
    if (clearSecrets.length > 0) {
      changedFieldNames.push(`cleared:${clearSecrets.join(',')}`);
    }

    const auditOutcome = await AuditRepository.addAfterPrimaryOperation({
      user: user?.name || user?.email || 'Administrator',
      role: user?.role || 'System Manager',
      action: 'Communication Provider Settings Updated',
      target: 'System Settings',
      status: 'Success',
      metadata: {
        updatedFields: changedFieldNames
      }
    }, 'PUT /api/settings/communication/providers');

    return res.json({
      success: true,
      config: updatedConfig,
      message: 'Communication provider settings saved successfully.',
      ...(auditOutcome.persisted ? {} : { auditPersisted: false, auditWarning: auditOutcome.auditWarning })
    });
  } catch (err: any) {
    if (err?.message?.includes('Validation Error') || err?.message?.includes('Unknown configuration field')) {
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }
    if (err?.message?.includes('Encryption Key Missing') || err?.message?.includes('Invalid Encryption Key')) {
      return res.status(500).json({
        success: false,
        message: `Security Configuration Error: ${err.message}`
      });
    }
    console.error('[CommunicationProviderRoutes] Error updating provider configuration:', err);
    return res.status(500).json({
      success: false,
      message: err?.message || 'Failed to update communication provider settings.'
    });
  }
});


/** POST /api/settings/communication/providers/test — one rate-limited admin test send. */
communicationProviderRouter.post('/test', requireAdminPermission('settings.manage'), async (req: any, res) => {
  const channel = String(req.body?.channel || '');
  const recipient = String(req.body?.recipient || '').trim();
  const adminKey = String(req.user?.userId || req.user?.id || req.user?.email || 'admin');
  if (!['email', 'whatsapp', 'sms'].includes(channel)) {
    return res.status(400).json({ success: false, message: 'Channel must be email, whatsapp or sms.' });
  }
  if (channel === 'email') {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient) || recipient.length > 254) {
      return res.status(400).json({ success: false, message: 'Enter a valid test email address.' });
    }
  } else {
    const digits = recipient.replace(/[^0-9]/g, '');
    if (digits.length < 8 || digits.length > 15) {
      return res.status(400).json({ success: false, message: 'Enter a valid international phone number for the test recipient.' });
    }
  }
  const lastSentAt = providerTestLastSentAt.get(adminKey) || 0;
  if (Date.now() - lastSentAt < 30000) {
    return res.status(429).json({ success: false, message: 'Please wait 30 seconds before sending another provider test.' });
  }
  providerTestLastSentAt.set(adminKey, Date.now());
  const subject = 'Hybrid Job Portal — Provider Test';
  const message = 'This is a test message from Hybrid Job Portal. Your selected communication provider accepted this test.';
  try {
    const sent = await sendProviderTestMessage(channel as 'email' | 'whatsapp' | 'sms', recipient, subject, message);
    const maskedRecipient = channel === 'email'
      ? recipient.replace(/^(.{1,2})[^@]*(@.*)$/, '$1***$2')
      : '***' + recipient.replace(/[^0-9]/g, '').slice(-4);
    const audit = await AuditRepository.addAfterPrimaryOperation({
      user: req.user?.name || req.user?.email || 'Administrator',
      role: req.user?.role || 'Administrator',
      action: 'Communication Provider Test',
      target: channel,
      status: sent ? 'Success' : 'Warning',
      metadata: { channel, recipient: maskedRecipient, acceptedByProvider: sent }
    }, 'POST /api/settings/communication/providers/test');
    if (!sent) return res.status(502).json({ success: false, message: 'The provider did not accept the test. Check its enabled state, sender details and saved credentials.' });
    return res.json({ success: true, message: 'Test message accepted by the selected provider.', ...(audit.persisted ? {} : { auditPersisted: false, auditWarning: audit.auditWarning }) });
  } catch (error: any) {
    return res.status(502).json({ success: false, message: error?.message || 'Provider test failed.' });
  }
});
