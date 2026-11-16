import { Router } from 'express';
import { NotificationRepository, MAX_NOTIFICATION_RESULTS } from '../db/repositories';
import { requireAuth } from '../auth/authManager';

export const notificationRouter = Router();

const ALLOWED_NOTIFICATION_TYPES = new Set(['info', 'success', 'warning', 'error', 'alert']);

function getAuthenticatedUserId(req: any): string {
  const raw = req.user?.userId || req.user?.id;
  if (typeof raw !== 'string' && typeof raw !== 'number') {
    return '';
  }
  return String(raw).trim();
}

function validateNotificationId(rawId: unknown): string | null {
  if (typeof rawId !== 'string') return null;
  const trimmed = rawId.trim();
  if (!trimmed || trimmed.length > 200) return null;
  if (/[\x00-\x1f\x7f]/.test(trimmed) || trimmed.startsWith('$')) return null;
  return trimmed;
}

// 1. Get current user's notifications
notificationRouter.get('/', requireAuth, async (req: any, res: any) => {
  try {
    const authUserId = getAuthenticatedUserId(req);
    if (!authUserId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    let type: string | undefined;
    if (req.query?.type !== undefined) {
      if (typeof req.query.type !== 'string') {
        return res.status(400).json({ success: false, message: 'Invalid notification type filter.' });
      }
      const trimmedType = req.query.type.trim();
      if (trimmedType.length > 0) {
        if (!ALLOWED_NOTIFICATION_TYPES.has(trimmedType)) {
          return res.status(400).json({ success: false, message: 'Invalid notification type filter.' });
        }
        type = trimmedType;
      }
    }

    let unreadOnly = false;
    if (req.query?.unreadOnly !== undefined) {
      if (typeof req.query.unreadOnly !== 'string') {
        return res.status(400).json({ success: false, message: 'Invalid unreadOnly filter.' });
      }
      const trimmedUnread = req.query.unreadOnly.trim().toLowerCase();
      if (trimmedUnread === 'true') {
        unreadOnly = true;
      } else if (trimmedUnread !== '' && trimmedUnread !== 'false') {
        return res.status(400).json({ success: false, message: 'Invalid unreadOnly filter.' });
      }
    }

    let limit: number | undefined;
    if (req.query?.limit !== undefined && req.query.limit !== '') {
      if (typeof req.query.limit !== 'string' || !/^\d+$/.test(req.query.limit.trim())) {
        return res.status(400).json({ success: false, message: 'Invalid limit parameter.' });
      }
      const parsed = Number.parseInt(req.query.limit.trim(), 10);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid limit parameter.' });
      }
      limit = Math.min(parsed, MAX_NOTIFICATION_RESULTS);
    }

    const notifications = await NotificationRepository.getAllAsync({
      userId: authUserId,
      type,
      unreadOnly,
      limit
    });

    return res.json({ success: true, notifications });
  } catch (err: any) {
    console.error('[NotificationRoutes] Failed to fetch notifications:', err);
    return res.status(500).json({ success: false, message: 'Unable to fetch notifications at this time.' });
  }
});

// 2. Get unread notification count for current user
notificationRouter.get('/unread-count', requireAuth, async (req: any, res: any) => {
  try {
    const authUserId = getAuthenticatedUserId(req);
    if (!authUserId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const unreadCount = await NotificationRepository.getUnreadCountAsync(authUserId);
    return res.json({ success: true, unreadCount });
  } catch (err: any) {
    console.error('[NotificationRoutes] Failed to fetch unread notification count:', err);
    return res.status(500).json({ success: false, message: 'Unable to fetch unread notification count at this time.' });
  }
});

// 3. Mark all notifications as read for current user
notificationRouter.patch('/read-all', requireAuth, async (req: any, res: any) => {
  try {
    const authUserId = getAuthenticatedUserId(req);
    if (!authUserId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const updatedCount = await NotificationRepository.markAllAsReadAsync(authUserId);
    return res.json({ success: true, updatedCount, message: 'Notifications marked as read.' });
  } catch (err: any) {
    console.error('[NotificationRoutes] Failed to mark all notifications as read:', err);
    return res.status(500).json({ success: false, message: 'Unable to update notifications at this time.' });
  }
});

// 4. Mark one notification as read for current user
notificationRouter.patch('/:id/read', requireAuth, async (req: any, res: any) => {
  try {
    const authUserId = getAuthenticatedUserId(req);
    if (!authUserId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const notifId = validateNotificationId(req.params?.id);
    if (!notifId) {
      return res.status(400).json({ success: false, message: 'Invalid notification ID.' });
    }

    const success = await NotificationRepository.markAsReadAsync(notifId, authUserId);

    if (!success) {
      return res.status(404).json({ success: false, message: 'Notification not found or access denied.' });
    }

    return res.json({ success: true, message: 'Notification marked as read.' });
  } catch (err: any) {
    console.error('[NotificationRoutes] Failed to mark notification as read:', err);
    return res.status(500).json({ success: false, message: 'Unable to update notification at this time.' });
  }
});
