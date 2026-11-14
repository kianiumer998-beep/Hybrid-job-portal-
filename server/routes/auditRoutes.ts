import { Router } from 'express';
import { AuditRepository } from '../db/repositories/AuditRepository';
import { requireAdminPermission, requireAuth, authMiddleware } from '../auth/authManager';

export const auditRouter = Router();

auditRouter.use(authMiddleware);

// Get audit logs (Admin Only)
auditRouter.get('/', requireAdminPermission('audit.view'), async (req, res) => {
  try {
    const logs = await AuditRepository.getAll();
    res.json({ success: true, logs });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error fetching audit logs' });
  }
});

// Append audit log (Requires authentication, derives actor identity strictly from authenticated token)
auditRouter.post('/', requireAuth, async (req: any, res) => {
  try {
    const authUser = req.user;
    const actorUser = authUser?.name || authUser?.email || 'Authenticated User';
    const actorRole = authUser?.role || 'Member';
    const { action, target, status, details, metadata } = req.body || {};

    // Ignore any client-supplied actor identity fields (user, role, userId, admin, etc.)
    await AuditRepository.add({
      user: actorUser,
      role: actorRole,
      action: typeof action === 'string' && action.trim() ? action.trim() : 'General Action',
      target: typeof target === 'string' && target.trim() ? target.trim() : 'Portal',
      status: status === 'Warning' || status === 'Error' ? status : 'Success',
      details: details || metadata
    });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error persisting audit log' });
  }
});
