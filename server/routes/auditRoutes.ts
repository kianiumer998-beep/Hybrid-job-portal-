import { Router } from 'express';
import { Database } from '../db/database';
import { requireAdmin } from '../auth/authManager';

export const auditRouter = Router();

// Get audit logs (Admin Only)
auditRouter.get('/', requireAdmin, (req, res) => {
  try {
    const logs = Database.getAuditLogs();
    res.json({ success: true, logs });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error fetching audit logs' });
  }
});

// Append audit log
auditRouter.post('/', (req, res) => {
  try {
    const { user, role, action, target, status, details } = req.body;
    Database.addAuditLog({
      user: user || 'Anonymous',
      role: role || 'Guest',
      action: action || 'General Action',
      target: target || 'Portal',
      status: status || 'Success',
      details
    });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});
