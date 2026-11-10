import { Router } from 'express';
import { CommunicationProviderRepository, AuditRepository } from '../db/repositories';
import { requireAdminPermission } from '../auth/authManager';

export const communicationProviderRouter = Router();

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

    AuditRepository.add({
      user: user?.name || user?.email || 'Administrator',
      role: user?.role || 'System Manager',
      action: 'Communication Provider Settings Updated',
      target: 'System Settings',
      status: 'Success',
      metadata: {
        updatedFields: changedFieldNames
      }
    });

    return res.json({
      success: true,
      config: updatedConfig,
      message: 'Communication provider settings saved successfully.'
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
