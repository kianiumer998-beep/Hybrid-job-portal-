import { Router } from 'express';
import { FeeLogRepository } from '../db/repositories/FeeLogRepository';
import { hasAdminPermission, ADMIN_ROLES } from '../auth/authManager';
import { UserRepository } from '../db/repositories/UserRepository';

export const feeLogRouter = Router();

/**
 * Middleware requiring admin privileges with either 'finance.manage' or 'payments.manage' permission.
 */
async function requireFeeLogAccess(req: any, res: any, next: any) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Please log in.'
    });
  }

  try {
    const userId = req.user.userId || req.user.id;
    const dbUser = userId ? await UserRepository.getByIdAsync(userId) : null;
    if (!dbUser || dbUser.role !== req.user.role) {
      return res.status(401).json({
        success: false,
        message: 'Your administrative session is no longer valid. Please log in again.'
      });
    }

    const effectiveRole = dbUser?.role || req.user.role;
    if (!(ADMIN_ROLES as readonly string[]).includes(effectiveRole)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Administrative privileges required.'
      });
    }

    const canManageFinance = hasAdminPermission(effectiveRole, 'finance.manage');
    const canManagePayments = hasAdminPermission(effectiveRole, 'payments.manage');

    if (!canManageFinance && !canManagePayments) {
      return res.status(403).json({
        success: false,
        message: `Access denied: Role '${effectiveRole}' lacks finance.manage or payments.manage permission.`
      });
    }

    req.user.role = effectiveRole;
    next();
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: 'Authorization verification error.'
    });
  }
}

// 1. Get all durable fee logs (Admin only, requires finance.manage or payments.manage)
feeLogRouter.get('/', requireFeeLogAccess, async (req, res) => {
  try {
    const feeLogs = await FeeLogRepository.getAllFeeLogs();
    res.json({
      success: true,
      feeLogs
    });
  } catch (err: any) {
    console.error('[FeeLogRouter] Error fetching durable fee logs:', err);
    res.status(500).json({
      success: false,
      message: err?.message || 'Failed to fetch durable fee logs.'
    });
  }
});

// 2. Archive single fee log entry (Admin only)
// Note: Deleting a fee log must NEVER delete its original payment transaction.
feeLogRouter.delete('/:id', requireFeeLogAccess, async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || !id.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Log ID is required.'
      });
    }

    const adminUser = (req as any).user?.name || (req as any).user?.email || 'Admin';
    await FeeLogRepository.archiveFeeLog(id.trim(), adminUser);

    res.json({
      success: true,
      message: 'Fee log entry archived successfully. Payment transaction preserved.',
      archivedId: id.trim()
    });
  } catch (err: any) {
    console.error('[FeeLogRouter] Error archiving fee log:', err);
    res.status(500).json({
      success: false,
      message: err?.message || 'Failed to archive fee log entry.'
    });
  }
});

// 3. Bulk archive fee log entries (Admin only)
feeLogRouter.post('/bulk-delete', requireFeeLogAccess, async (req, res) => {
  try {
    const { logIds } = req.body;
    if (!Array.isArray(logIds) || logIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'logIds array is required.'
      });
    }

    const adminUser = (req as any).user?.name || (req as any).user?.email || 'Admin';
    const archivedCount = await FeeLogRepository.bulkArchiveFeeLogs(logIds, adminUser);

    res.json({
      success: true,
      message: `${archivedCount} fee log entries archived successfully. Underlying transactions preserved.`,
      archivedCount
    });
  } catch (err: any) {
    console.error('[FeeLogRouter] Error bulk archiving fee logs:', err);
    res.status(500).json({
      success: false,
      message: err?.message || 'Failed to bulk archive fee logs.'
    });
  }
});

// 4. Safely import existing legacy LocalStorage fee logs into MongoDB (Admin only)
feeLogRouter.post('/import-legacy', requireFeeLogAccess, async (req, res) => {
  try {
    const { records } = req.body;
    if (!Array.isArray(records)) {
      return res.status(400).json({
        success: false,
        message: 'records must be an array of fee logs.'
      });
    }

    const adminUser = (req as any).user?.name || (req as any).user?.email || 'Admin';
    const result = await FeeLogRepository.importLegacyRecords(records, adminUser);

    const alreadyRepresentedCount =
      typeof result.alreadyRepresentedCount === 'number'
        ? Math.max(0, result.alreadyRepresentedCount)
        : 0;

    res.json({
      success: true,
      importedCount: result.importedCount,
      verifiedCount: result.verifiedCount,
      skippedCount: result.skippedCount,
      alreadyRepresentedCount,
      records: result.records
    });
  } catch (err: any) {
    console.error('[FeeLogRouter] Error importing legacy fee logs:', err);
    res.status(500).json({
      success: false,
      message: err?.message || 'Failed to import legacy fee logs.'
    });
  }
});
