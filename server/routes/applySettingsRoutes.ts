import { Router } from 'express';
import { Database } from '../db/database';
import { requireAdmin } from '../auth/authManager';

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
applySettingsRouter.put('/', requireAdmin, (req, res) => {
  try {
    const current = Database.getApplySettings();
    const updated = {
      ...current,
      ...req.body,
      updatedAt: new Date().toISOString()
    };

    Database.saveApplySettings(updated);

    Database.addAuditLog({
      user: 'Administrator',
      role: 'Content Manager',
      action: 'Apply Settings & Form Flow Updated',
      target: 'Candidate Application Experience',
      status: 'Success'
    });

    res.json({ success: true, settings: updated, message: 'Application settings and form flow updated successfully!' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error updating apply settings' });
  }
});
