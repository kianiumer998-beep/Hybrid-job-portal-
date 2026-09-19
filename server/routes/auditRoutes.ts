import { Router } from 'express';
import { Database } from '../db/database';
import { requireAdmin, requireAuth } from '../auth/authManager';

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

// Append audit log (Requires authentication, derives actor identity strictly from authenticated token)
auditRouter.post('/', requireAuth, (req: any, res) => {
  try {
    const authUser = req.user;
    const actorUser = authUser?.name || authUser?.email || 'Authenticated User';
    const actorRole = authUser?.role || 'Member';
    const { action, target, status, details } = req.body;

    Database.addAuditLog({
      user: actorUser,
      role: actorRole,
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
