import { Router } from 'express';
import { CurrencyRepository } from '../db/repositories/CurrencyRepository';
import { requireAdminPermission } from '../auth/authManager';
import { AuditRepository } from '../db/repositories/AuditRepository';

export const currencyRouter = Router();

// GET /api/currency/config (or /api/currency)
currencyRouter.get(['/', '/config'], async (req, res) => {
  try {
    const result = await CurrencyRepository.getConfig();
    res.json({
      success: true,
      isConfigured: result.isConfigured,
      config: result.config
    });
  } catch (err: any) {
    console.error('[Currency Route Error] GET /api/currency/config:', err);
    res.status(500).json({
      success: false,
      message: err?.message || 'Error retrieving currency exchange configuration.'
    });
  }
});

// PUT /api/currency/config (or /api/currency)
currencyRouter.put(['/', '/config'], requireAdminPermission('finance.manage'), async (req, res) => {
  try {
    const savedConfig = await CurrencyRepository.saveConfig(req.body);

    const auditOutcome = await AuditRepository.addAfterPrimaryOperation({
      user: (req as any).user?.name || (req as any).user?.email || 'Administrator',
      role: (req as any).user?.role || 'Admin',
      action: 'Currency Exchange Configuration Updated',
      target: 'System Settings',
      status: 'Success'
    }, 'PUT /api/currency/config');

    res.json({
      success: true,
      isConfigured: true,
      config: savedConfig,
      message: 'Currency exchange configuration saved successfully to database.',
      ...(auditOutcome.persisted ? {} : { auditPersisted: false, auditWarning: auditOutcome.auditWarning })
    });
  } catch (err: any) {
    console.error('[Currency Route Error] PUT /api/currency/config:', err);
    const isValidationError = err?.message && err.message.startsWith('Validation Error');
    res.status(isValidationError ? 400 : 500).json({
      success: false,
      message: err?.message || 'Failed to save currency configuration.'
    });
  }
});
