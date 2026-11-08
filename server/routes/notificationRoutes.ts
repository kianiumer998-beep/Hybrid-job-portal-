import { Router } from 'express';
import { NotificationRepository } from '../db/repositories';
import { requireAuth } from '../auth/authManager';

export const notificationRouter = Router();

// 1. Get current user's notifications
notificationRouter.get('/', requireAuth, async (req: any, res: any) => {
  try {
    const authUserId = req.user?.userId || req.user?.id;
    if (!authUserId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const type = typeof req.query?.type === 'string' ? req.query.type : undefined;
    const unreadOnly = req.query?.unreadOnly === 'true';

    const notifications = await NotificationRepository.getAllAsync({
      userId: String(authUserId),
      type,
      unreadOnly
    });

    return res.json({ success: true, notifications });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || 'Error fetching notifications' });
  }
});

// 2. Get unread notification count for current user
notificationRouter.get('/unread-count', requireAuth, async (req: any, res: any) => {
  try {
    const authUserId = req.user?.userId || req.user?.id;
    if (!authUserId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const unreadCount = await NotificationRepository.getUnreadCountAsync(String(authUserId));
    return res.json({ success: true, unreadCount });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || 'Error fetching unread count' });
  }
});

// 3. Mark all notifications as read for current user
notificationRouter.patch('/read-all', requireAuth, async (req: any, res: any) => {
  try {
    const authUserId = req.user?.userId || req.user?.id;
    if (!authUserId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const updatedCount = await NotificationRepository.markAllAsReadAsync(String(authUserId));
    return res.json({ success: true, updatedCount, message: 'Notifications marked as read.' });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || 'Error marking notifications as read' });
  }
});

// 4. Mark one notification as read for current user
notificationRouter.patch('/:id/read', requireAuth, async (req: any, res: any) => {
  try {
    const authUserId = req.user?.userId || req.user?.id;
    if (!authUserId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const { id } = req.params;
    const success = await NotificationRepository.markAsReadAsync(String(id), String(authUserId));

    if (!success) {
      return res.status(404).json({ success: false, message: 'Notification not found or access denied.' });
    }

    return res.json({ success: true, message: 'Notification marked as read.' });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || 'Error updating notification' });
  }
});
