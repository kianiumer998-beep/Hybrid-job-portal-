import { Router } from 'express';
import { PaymentSettingsRepository, AuditRepository } from '../db/repositories';
import { requireAdminPermission } from '../auth/authManager';

export const paymentSettingsRouter = Router();

// 1. GET Public Payment Settings (Unauthenticated / Public)
paymentSettingsRouter.get('/', async (req, res) => {
  try {
    const { isConfigured, settings } = await PaymentSettingsRepository.getPublicSettings();
    if (!isConfigured || !settings) {
      return res.json({
        success: true,
        configured: false,
        settings: null,
        message: 'Payment instructions are currently unconfigured.'
      });
    }

    return res.json({
      success: true,
      configured: true,
      settings
    });
  } catch (err: any) {
    console.error('[PaymentSettingsRoutes] Error fetching payment settings:', err?.message || err);
    return res.status(503).json({
      success: false,
      configured: false,
      settings: null,
      message: 'Payment settings database service is temporarily unavailable.'
    });
  }
});

// 2. PUT Update Payment Settings (Admin with 'payments.manage' permission only)
paymentSettingsRouter.put('/', requireAdminPermission('payments.manage'), async (req, res) => {
  try {
    const user = (req as any).user;
    const updatedSettings = await PaymentSettingsRepository.updateSettings(req.body, user);

    AuditRepository.add({
      user: user?.name || user?.email || 'Administrator',
      role: user?.role || 'Payment Manager',
      action: 'Payment Settings Updated',
      target: 'Public Receiving Payment Instructions',
      status: 'Success',
      metadata: {
        isConfigured: updatedSettings.isConfigured,
        enabledMethods: Object.entries(updatedSettings.methods)
          .filter(([_, m]) => m.enabled)
          .map(([k]) => k)
      }
    });

    return res.json({
      success: true,
      configured: updatedSettings.isConfigured,
      settings: updatedSettings,
      message: 'Payment settings saved and published successfully!'
    });
  } catch (err: any) {
    const msg = err?.message || 'Failed to update payment settings.';
    const isValidationError = msg.startsWith('Validation Error') || msg.startsWith('Invalid request');

    if (isValidationError) {
      return res.status(400).json({
        success: false,
        message: msg
      });
    }

    console.error('[PaymentSettingsRoutes] Error persisting payment settings:', err);
    return res.status(503).json({
      success: false,
      message: msg || 'Database service unavailable. Failed to save payment settings.'
    });
  }
});
