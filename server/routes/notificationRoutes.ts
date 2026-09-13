import { Router } from 'express';
import { requireAdmin, authenticateOptionalUser, authenticateUser } from '../auth/authManager';
import { NotificationRepository, AuditRepository } from '../db/repositories';

export const notificationRouter = Router();

// 1. Get active notifications for current user or visitor
notificationRouter.get('/', authenticateOptionalUser, async (req, res) => {
  try {
    const user = (req as any).user;
    const userId = req.query.userId as string || user?.id;
    const role = req.query.role as string || user?.role;
    const plan = req.query.plan as string || user?.plan;
    const membershipStatus = req.query.membershipStatus as string || user?.membershipStatus;

    const notifs = await NotificationRepository.getForUser({
      userId,
      role,
      plan,
      membershipStatus
    });

    res.json({
      success: true,
      notifications: notifs
    });
  } catch (err: any) {
    console.error('Error in GET /api/notifications:', err);
    res.status(500).json({ success: false, message: err.message || 'Error fetching notifications' });
  }
});

// 2. Admin: Get all notifications (Drafts, Published, Archived)
notificationRouter.get('/admin/all', requireAdmin, async (req, res) => {
  try {
    const notifs = await NotificationRepository.getAllAdmin();
    res.json({
      success: true,
      notifications: notifs
    });
  } catch (err: any) {
    console.error('Error in GET /api/notifications/admin/all:', err);
    res.status(500).json({ success: false, message: err.message || 'Error fetching admin notifications' });
  }
});

// 3. Admin: Create new broadcast or persistent notification
notificationRouter.post('/admin', requireAdmin, async (req, res) => {
  try {
    const data = req.body;
    if (!data.title || (!data.body && !data.messageBody)) {
      return res.status(400).json({ success: false, message: 'Notification title and body are required.' });
    }

    const adminName = (req as any).user?.name || (req as any).user?.email || 'Administrator';
    const created = await NotificationRepository.create(data, adminName);

    AuditRepository.add({
      user: adminName,
      role: 'Admin',
      action: 'Notification Created & Published',
      target: `${created.title} (${created.targetAudience})`,
      status: 'Success'
    });

    res.json({
      success: true,
      notification: created,
      message: 'Notification successfully created and dispatched!'
    });
  } catch (err: any) {
    console.error('Error in POST /api/notifications/admin:', err);
    res.status(500).json({ success: false, message: err.message || 'Error creating notification' });
  }
});

// 4. Admin: Update notification
notificationRouter.put('/admin/:id', requireAdmin, async (req, res) => {
  try {
    const updated = await NotificationRepository.update(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Notification not found.' });
    }

    const adminName = (req as any).user?.name || 'Administrator';
    AuditRepository.add({
      user: adminName,
      role: 'Admin',
      action: 'Notification Updated',
      target: `Notification ${req.params.id} (${updated.title})`,
      status: 'Success'
    });

    res.json({
      success: true,
      notification: updated,
      message: 'Notification updated successfully.'
    });
  } catch (err: any) {
    console.error('Error in PUT /api/notifications/admin/:id:', err);
    res.status(500).json({ success: false, message: err.message || 'Error updating notification' });
  }
});

// 5. Admin: Delete notification
notificationRouter.delete('/admin/:id', requireAdmin, async (req, res) => {
  try {
    const deleted = await NotificationRepository.delete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Notification not found.' });
    }

    const adminName = (req as any).user?.name || 'Administrator';
    AuditRepository.add({
      user: adminName,
      role: 'Admin',
      action: 'Notification Deleted',
      target: `Notification ID ${req.params.id}`,
      status: 'Success'
    });

    res.json({
      success: true,
      message: 'Notification and associated state records removed successfully.'
    });
  } catch (err: any) {
    console.error('Error in DELETE /api/notifications/admin/:id:', err);
    res.status(500).json({ success: false, message: err.message || 'Error deleting notification' });
  }
});

// 6. User: Mark notification as read
notificationRouter.post('/:id/read', authenticateOptionalUser, async (req, res) => {
  try {
    const userId = req.body.userId || (req as any).user?.id;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID is required to mark read.' });
    }

    await NotificationRepository.markRead(userId, req.params.id);
    res.json({ success: true, message: 'Notification marked as read.' });
  } catch (err: any) {
    console.error('Error in POST /api/notifications/:id/read:', err);
    res.status(500).json({ success: false, message: err.message || 'Error marking read' });
  }
});

// 7. User: Mark all notifications as read
notificationRouter.post('/read-all', authenticateOptionalUser, async (req, res) => {
  try {
    const userId = req.body.userId || (req as any).user?.id;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID is required to mark all read.' });
    }

    await NotificationRepository.markAllRead(userId);
    res.json({ success: true, message: 'All notifications marked as read.' });
  } catch (err: any) {
    console.error('Error in POST /api/notifications/read-all:', err);
    res.status(500).json({ success: false, message: err.message || 'Error marking all read' });
  }
});

// 8. User: Dismiss notification
notificationRouter.post('/:id/dismiss', authenticateOptionalUser, async (req, res) => {
  try {
    const userId = req.body.userId || (req as any).user?.id;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID is required to dismiss.' });
    }

    const result = await NotificationRepository.dismiss(userId, req.params.id);
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json({ success: true, message: 'Notification dismissed.' });
  } catch (err: any) {
    console.error('Error in POST /api/notifications/:id/dismiss:', err);
    res.status(500).json({ success: false, message: err.message || 'Error dismissing notification' });
  }
});

// 9. User: Complete Mandatory Action (KYC submission, Terms acceptance, CTA confirmation, custom)
notificationRouter.post('/:id/complete-mandatory', authenticateOptionalUser, async (req, res) => {
  try {
    const userId = req.body.userId || (req as any).user?.id;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID is required to complete mandatory action.' });
    }

    const result = await NotificationRepository.completeMandatoryAction(
      userId,
      req.params.id,
      req.body.metadata
    );

    AuditRepository.add({
      user: userId,
      role: 'User',
      action: 'Mandatory Action Completed',
      target: `Notification ${req.params.id} (${result.policyVersion || 'Action'})`,
      status: 'Success'
    });

    res.json({
      success: true,
      message: 'Mandatory action completed successfully. Restriction has been removed.',
      ...result
    });
  } catch (err: any) {
    console.error('Error in POST /api/notifications/:id/complete-mandatory:', err);
    res.status(500).json({ success: false, message: err.message || 'Error completing mandatory action' });
  }
});

// 10. Admin: Override Mandatory Restriction for specific user
notificationRouter.post('/admin/:id/override-mandatory', requireAdmin, async (req, res) => {
  try {
    const { targetUserId } = req.body;
    if (!targetUserId) {
      return res.status(400).json({ success: false, message: 'targetUserId is required.' });
    }

    const adminName = (req as any).user?.name || (req as any).user?.email || 'Administrator';
    const result = await NotificationRepository.overrideMandatoryAction(
      adminName,
      targetUserId,
      req.params.id
    );

    AuditRepository.add({
      user: adminName,
      role: 'Admin',
      action: 'Admin Override - Mandatory Action Unlocked',
      target: `User ${targetUserId} unlocked for notification ${req.params.id}`,
      status: 'Success'
    });

    res.json({
      success: true,
      message: `User ${targetUserId} has been administratively unlocked and restriction cleared.`,
      ...result
    });
  } catch (err: any) {
    console.error('Error in POST /api/notifications/admin/:id/override-mandatory:', err);
    res.status(500).json({ success: false, message: err.message || 'Error overriding mandatory action' });
  }
});

// 11. Check user restriction status
notificationRouter.get('/user/:userId/restrictions', async (req, res) => {
  try {
    const action = (req.query.action as string) || 'post_job';
    const check = await NotificationRepository.checkUserRestricted(req.params.userId, action);
    res.json({
      success: true,
      ...check
    });
  } catch (err: any) {
    console.error('Error in GET /api/notifications/user/:userId/restrictions:', err);
    res.status(500).json({ success: false, message: err.message || 'Error checking restrictions' });
  }
});
