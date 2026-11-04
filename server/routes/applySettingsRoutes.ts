import { Router } from 'express';
import { Database } from '../db/database';
import { requireAdminPermission } from '../auth/authManager';

export const applySettingsRouter = Router();

// 1. Get Apply Flow & Button Configuration
applySettingsRouter.get('/', (req, res) => {
  try {
    const settings = Database.getApplySettings();
    res.json({ success: true, settings });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error fetching apply settings' });
  }
});

// 2. Update Apply Flow & Button Configuration (Admin Only)
applySettingsRouter.put('/', requireAdminPermission('settings.manage'), (req, res) => {
  try {
    const current = Database.getApplySettings();
    const updated = {
      ...current,
      ...req.body,
      updatedAt: new Date().toISOString()
    };

    // Validate new premium gate settings
    if (req.body.applyButtonRequiresPremium !== undefined && typeof req.body.applyButtonRequiresPremium !== 'boolean') {
      return res.status(400).json({ success: false, message: 'Invalid applyButtonRequiresPremium type.' });
    }
    if (req.body.premiumPopupTitle && typeof req.body.premiumPopupTitle !== 'string') {
      return res.status(400).json({ success: false, message: 'Invalid premiumPopupTitle type.' });
    }
    if (req.body.premiumPopupMessage && typeof req.body.premiumPopupMessage !== 'string') {
      return res.status(400).json({ success: false, message: 'Invalid premiumPopupMessage type.' });
    }
    if (req.body.premiumFieldMessages && typeof req.body.premiumFieldMessages !== 'object') {
      return res.status(400).json({ success: false, message: 'Invalid premiumFieldMessages object.' });
    }

    Database.saveApplySettings(updated);

    Database.addAuditLog({
      user: (req as any).user?.name || (req as any).user?.email || 'Administrator',
      role: (req as any).user?.role || 'Content Manager',
      action: 'Apply Settings & Form Flow Updated',
      target: 'Candidate Application Experience',
      status: 'Success'
    });

    res.json({ success: true, settings: updated, message: 'Application settings and form flow updated successfully!' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error updating apply settings' });
  }
});
