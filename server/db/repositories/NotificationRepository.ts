import {
  getNotificationsCollection,
  getUserNotificationRecordsCollection,
  isMongoConfigured,
  executeWithFallback
} from '../mongodb';
import { Database } from '../database';
import { sanitizeServerHtml } from '../../utils/sanitizeHtml';

function generateNotifId(): string {
  return `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
}

export class NotificationRepository {
  /**
   * Retrieves all notifications for Admin Dashboard management with stats.
   */
  static async getAllAdmin(): Promise<any[]> {
    return executeWithFallback(
      async () => {
        const coll = await getNotificationsCollection();
        const notifs = await coll.find({}).sort({ createdAt: -1 }).toArray();
        if (notifs && notifs.length > 0) {
          return notifs.map(doc => {
            const { _id, ...safeDoc } = doc;
            return safeDoc;
          });
        }
        return Database.getNotifications();
      },
      () => Database.getNotifications(),
      'NotificationRepository.getAllAdmin'
    );
  }

  /**
   * Retrieves active, scheduled, and target-matched notifications for a user/guest.
   */
  static async getForUser(params: {
    userId?: string;
    role?: string;
    plan?: string;
    membershipStatus?: string;
  }): Promise<any[]> {
    return executeWithFallback(
      async () => {
        const notifsColl = await getNotificationsCollection();
        const userRecordsColl = await getUserNotificationRecordsCollection();

        const now = new Date().toISOString();

        // Query active & published notifications
        const activeNotifs = await notifsColl
          .find({
            status: 'published',
            enabled: { $ne: false }
          })
          .sort({ priority: -1, createdAt: -1 })
          .toArray();

        // Fetch user-specific notification states if userId is provided
        let userRecordMap = new Map<string, any>();
        if (params.userId) {
          const userRecords = await userRecordsColl
            .find({ userId: params.userId })
            .toArray();
          userRecords.forEach(r => userRecordMap.set(r.notificationId, r));
        }

        const filtered: any[] = [];

        for (const doc of activeNotifs) {
          const { _id, ...notif } = doc;

          // Check schedule startDate
          if (notif.startDate && notif.startDate > now) {
            continue; // Scheduled for future
          }

          // Check expiryDate
          if (notif.expiryDate && notif.expiryDate < now) {
            continue; // Expired
          }

          // Check targetAudience
          if (notif.targetAudience === 'specific_users') {
            if (!params.userId || !Array.isArray(notif.targetUserIds) || !notif.targetUserIds.includes(params.userId)) {
              continue;
            }
          } else if (notif.targetAudience === 'employers') {
            const isEmp = params.role?.toLowerCase()?.includes('employer');
            if (!isEmp) continue;
          } else if (notif.targetAudience === 'jobseekers') {
            const isSeeker = !params.role?.toLowerCase()?.includes('employer');
            if (!isSeeker) continue;
          } else if (notif.targetAudience === 'subscribers') {
            const isSub = params.plan === 'Premium' && params.membershipStatus !== 'Expired';
            if (!isSub) continue;
          } else if (notif.targetAudience === 'unpaid_expired') {
            const isUnpaid = params.plan === 'Free' || params.membershipStatus === 'Expired' || params.membershipStatus === 'Revoked';
            if (!isUnpaid) continue;
          }

          // User state
          const state = params.userId ? userRecordMap.get(notif.id) : null;
          const isDismissed = state?.dismissed === true;
          const isCompleted = state?.completed === true;
          const isOverridden = state?.adminOverridden === true;

          // If user dismissed it and it is NOT an incomplete mandatory action, skip from active list
          if (isDismissed && !(notif.isMandatory && !isCompleted && !isOverridden)) {
            continue;
          }

          notif.userState = {
            read: state?.read === true,
            readAt: state?.readAt,
            dismissed: isDismissed,
            dismissedAt: state?.dismissedAt,
            completed: isCompleted,
            completedAt: state?.completedAt,
            adminOverridden: isOverridden
          };

          filtered.push(notif);
        }

        return filtered;
      },
      () => {
        const list = Database.getNotifications();
        const records = Database.getUserNotificationRecords();
        const userRecordMap = new Map<string, any>();
        if (params.userId) {
          records.filter(r => r.userId === params.userId).forEach(r => userRecordMap.set(r.notificationId, r));
        }
        return list.filter(n => n.enabled !== false && n.status === 'published');
      },
      'NotificationRepository.getForUser'
    );
  }

  /**
   * Retrieves single notification by ID.
   */
  static async getById(id: string): Promise<any | null> {
    return executeWithFallback(
      async () => {
        const coll = await getNotificationsCollection();
        const doc = await coll.findOne({ id });
        if (!doc) return Database.getNotifications().find(n => n.id === id) || null;
        const { _id, ...safeDoc } = doc;
        return safeDoc;
      },
      () => Database.getNotifications().find(n => n.id === id) || null,
      'NotificationRepository.getById'
    );
  }

  /**
   * Creates a persistent notification.
   */
  static async create(data: any, createdBy?: string): Promise<any> {
    const id = data.id || generateNotifId();
    const now = new Date().toISOString();

    const newNotif = {
      id,
      title: (data.title || '').trim(),
      body: sanitizeServerHtml(data.body || data.messageBody || ''),
      plainText: (data.plainText || data.body || '').replace(/<[^>]*>/g, '').trim(),
      imageUrl: data.imageUrl || undefined,
      ctaText: data.ctaText ? data.ctaText.trim() : undefined,
      ctaUrl: data.ctaUrl ? data.ctaUrl.trim() : undefined,
      target: data.target === '_self' ? '_self' : '_blank',
      enabled: data.enabled !== false,
      priority: data.priority || 'normal',
      startDate: data.startDate || now,
      expiryDate: data.expiryDate || undefined,
      targetAudience: data.targetAudience || 'all',
      targetUserIds: Array.isArray(data.targetUserIds) ? data.targetUserIds : [],
      channels: {
        bell: data.channels?.bell !== false,
        popup: Boolean(data.channels?.popup),
        pageBanner: Boolean(data.channels?.pageBanner)
      },
      dismissible: data.dismissible !== false,
      status: data.status || 'published',

      // Mandatory Action fields
      isMandatory: Boolean(data.isMandatory),
      mandatoryActionType: data.mandatoryActionType || undefined,
      policyVersion: data.policyVersion || undefined,
      restrictedFeatures: Array.isArray(data.restrictedFeatures) ? data.restrictedFeatures : ['post_job'],

      createdAt: now,
      updatedAt: now,
      createdBy: createdBy || 'System Admin',
      recipientsCount: data.recipientsCount || 0,
      viewCount: 0,
      clickCount: 0,
      completionCount: 0
    };

    if (isMongoConfigured()) {
      const coll = await getNotificationsCollection();
      await coll.updateOne({ id }, { $set: newNotif }, { upsert: true });
      try {
        Database.addNotification(newNotif);
      } catch {}
      return newNotif;
    }

    Database.addNotification(newNotif);
    return newNotif;
  }

  /**
   * Updates an existing notification.
   */
  static async update(id: string, updates: any): Promise<any | null> {
    const safeUpdates: any = { ...updates };
    delete safeUpdates._id;
    delete safeUpdates.id;
    safeUpdates.updatedAt = new Date().toISOString();

    if (safeUpdates.body) {
      safeUpdates.body = sanitizeServerHtml(safeUpdates.body);
    }
    if (safeUpdates.messageBody) {
      safeUpdates.body = sanitizeServerHtml(safeUpdates.messageBody);
      delete safeUpdates.messageBody;
    }

    if (isMongoConfigured()) {
      const coll = await getNotificationsCollection();
      await coll.updateOne({ id }, { $set: safeUpdates });
      try {
        Database.updateNotification(id, safeUpdates);
      } catch {}
      const updated = await coll.findOne({ id });
      if (updated) {
        const { _id, ...safeDoc } = updated;
        return safeDoc;
      }
      return Database.getNotifications().find(n => n.id === id) || null;
    }

    return Database.updateNotification(id, safeUpdates);
  }

  /**
   * Deletes a notification and all associated user records.
   */
  static async delete(id: string): Promise<boolean> {
    if (isMongoConfigured()) {
      const notifsColl = await getNotificationsCollection();
      const userRecordsColl = await getUserNotificationRecordsCollection();
      const [res] = await Promise.all([
        notifsColl.deleteOne({ id }),
        userRecordsColl.deleteMany({ notificationId: id })
      ]);
      try {
        Database.deleteNotification(id);
      } catch {}
      return res.deletedCount > 0;
    }

    return Database.deleteNotification(id);
  }

  /**
   * Marks a notification as Read for a user.
   */
  static async markRead(userId: string, notificationId: string): Promise<boolean> {
    const recordId = `${userId}_${notificationId}`;
    const now = new Date().toISOString();

    if (isMongoConfigured()) {
      const coll = await getUserNotificationRecordsCollection();
      await coll.updateOne(
        { id: recordId },
        {
          $set: {
            id: recordId,
            userId,
            notificationId,
            read: true,
            readAt: now,
            updatedAt: now
          }
        },
        { upsert: true }
      );
      try {
        const notifsColl = await getNotificationsCollection();
        await notifsColl.updateOne({ id: notificationId }, { $inc: { viewCount: 1 } });
      } catch {}

      try {
        const records = Database.getUserNotificationRecords();
        const idx = records.findIndex(r => r.id === recordId || (r.userId === userId && r.notificationId === notificationId));
        if (idx !== -1) {
          records[idx] = { ...records[idx], read: true, readAt: now, updatedAt: now };
        } else {
          records.push({ id: recordId, userId, notificationId, read: true, readAt: now, updatedAt: now });
        }
        Database.saveUserNotificationRecords(records);
      } catch {}

      return true;
    }

    const records = Database.getUserNotificationRecords();
    const idx = records.findIndex(r => r.id === recordId || (r.userId === userId && r.notificationId === notificationId));
    if (idx !== -1) {
      records[idx] = { ...records[idx], read: true, readAt: now, updatedAt: now };
    } else {
      records.push({ id: recordId, userId, notificationId, read: true, readAt: now, updatedAt: now });
    }
    Database.saveUserNotificationRecords(records);
    return true;
  }

  /**
   * Marks all notifications as Read for a user.
   */
  static async markAllRead(userId: string): Promise<boolean> {
    const notifs = await this.getForUser({ userId });
    for (const notif of notifs) {
      await this.markRead(userId, notif.id);
    }
    return true;
  }

  /**
   * Dismisses a notification for a user (if dismissible).
   */
  static async dismiss(userId: string, notificationId: string): Promise<{ success: boolean; message?: string }> {
    const recordId = `${userId}_${notificationId}`;
    const now = new Date().toISOString();

    if (isMongoConfigured()) {
      const coll = await getUserNotificationRecordsCollection();
      await coll.updateOne(
        { id: recordId },
        {
          $set: {
            id: recordId,
            userId,
            notificationId,
            dismissed: true,
            dismissedAt: now,
            updatedAt: now
          }
        },
        { upsert: true }
      );

      try {
        const records = Database.getUserNotificationRecords();
        const idx = records.findIndex(r => r.id === recordId || (r.userId === userId && r.notificationId === notificationId));
        if (idx !== -1) {
          records[idx] = { ...records[idx], dismissed: true, dismissedAt: now, updatedAt: now };
        } else {
          records.push({ id: recordId, userId, notificationId, dismissed: true, dismissedAt: now, updatedAt: now });
        }
        Database.saveUserNotificationRecords(records);
      } catch {}

      return { success: true };
    }

    const records = Database.getUserNotificationRecords();
    const idx = records.findIndex(r => r.id === recordId || (r.userId === userId && r.notificationId === notificationId));
    if (idx !== -1) {
      records[idx] = { ...records[idx], dismissed: true, dismissedAt: now, updatedAt: now };
    } else {
      records.push({ id: recordId, userId, notificationId, dismissed: true, dismissedAt: now, updatedAt: now });
    }
    Database.saveUserNotificationRecords(records);
    return { success: true };
  }

  /**
   * Completes a mandatory action for a user (KYC, Terms, CTA confirmation, custom acknowledgement).
   */
  static async completeMandatoryAction(
    userId: string,
    notificationId: string,
    metadata?: any
  ): Promise<any> {
    const recordId = `${userId}_${notificationId}`;
    const now = new Date().toISOString();
    const newRecord = {
      id: recordId,
      userId,
      notificationId,
      completed: true,
      completedAt: now,
      read: true,
      readAt: now,
      metadata: metadata || {},
      updatedAt: now
    };

    if (isMongoConfigured()) {
      const coll = await getUserNotificationRecordsCollection();
      await coll.updateOne(
        { id: recordId },
        { $set: newRecord },
        { upsert: true }
      );
      try {
        const notifsColl = await getNotificationsCollection();
        await notifsColl.updateOne({ id: notificationId }, { $inc: { completionCount: 1 } });
      } catch {}

      try {
        const records = Database.getUserNotificationRecords();
        const idx = records.findIndex(r => r.id === recordId || (r.userId === userId && r.notificationId === notificationId));
        if (idx !== -1) {
          records[idx] = { ...records[idx], ...newRecord };
        } else {
          records.push(newRecord);
        }
        Database.saveUserNotificationRecords(records);
      } catch {}

      return {
        success: true,
        notificationId,
        userId,
        completedAt: now
      };
    }

    const records = Database.getUserNotificationRecords();
    const idx = records.findIndex(r => r.id === recordId || (r.userId === userId && r.notificationId === notificationId));
    if (idx !== -1) {
      records[idx] = { ...records[idx], ...newRecord };
    } else {
      records.push(newRecord);
    }
    Database.saveUserNotificationRecords(records);

    return {
      success: true,
      notificationId,
      userId,
      completedAt: now
    };
  }

  /**
   * Admin Override / Unlock for a user on a mandatory notification.
   */
  static async overrideMandatoryAction(
    adminUserId: string,
    targetUserId: string,
    notificationId: string
  ): Promise<any> {
    const recordId = `${targetUserId}_${notificationId}`;
    const now = new Date().toISOString();
    const updated = {
      id: recordId,
      userId: targetUserId,
      notificationId,
      adminOverridden: true,
      overriddenBy: adminUserId,
      overriddenAt: now,
      updatedAt: now
    };

    if (isMongoConfigured()) {
      const coll = await getUserNotificationRecordsCollection();
      await coll.updateOne({ id: recordId }, { $set: updated }, { upsert: true });

      try {
        const records = Database.getUserNotificationRecords();
        const idx = records.findIndex(r => r.id === recordId);
        if (idx !== -1) {
          records[idx] = { ...records[idx], ...updated };
        } else {
          records.push(updated);
        }
        Database.saveUserNotificationRecords(records);
      } catch {}

      return {
        success: true,
        targetUserId,
        notificationId,
        overriddenBy: adminUserId,
        overriddenAt: now
      };
    }

    const records = Database.getUserNotificationRecords();
    const idx = records.findIndex(r => r.id === recordId);
    if (idx !== -1) {
      records[idx] = { ...records[idx], ...updated };
    } else {
      records.push(updated);
    }
    Database.saveUserNotificationRecords(records);

    return {
      success: true,
      targetUserId,
      notificationId,
      overriddenBy: adminUserId,
      overriddenAt: now
    };
  }

  /**
   * Checks whether a user is restricted by an incomplete mandatory action.
   */
  static async checkUserRestricted(
    userId: string,
    action: string = 'post_job'
  ): Promise<{ restricted: boolean; reason?: string; notification?: any }> {
    if (!userId) return { restricted: false };

    return executeWithFallback(
      async () => {
        const notifsColl = await getNotificationsCollection();
        const userRecordsColl = await getUserNotificationRecordsCollection();

        const mandatoryNotifs = await notifsColl
          .find({
            status: 'published',
            enabled: { $ne: false },
            isMandatory: true
          })
          .toArray();

        if (mandatoryNotifs.length === 0) {
          return { restricted: false };
        }

        const userRecords = await userRecordsColl.find({ userId }).toArray();
        const userRecordMap = new Map<string, any>();
        userRecords.forEach(r => userRecordMap.set(r.notificationId, r));

        for (const notif of mandatoryNotifs) {
          if (Array.isArray(notif.restrictedFeatures) && notif.restrictedFeatures.length > 0) {
            if (!notif.restrictedFeatures.includes(action) && !notif.restrictedFeatures.includes('all')) {
              continue;
            }
          }

          if (notif.targetAudience === 'specific_users') {
            if (!Array.isArray(notif.targetUserIds) || !notif.targetUserIds.includes(userId)) {
              continue;
            }
          }

          const state = userRecordMap.get(notif.id);
          const isCompleted = state?.completed === true;
          const isOverridden = state?.adminOverridden === true;

          if (!isCompleted && !isOverridden) {
            const { _id, ...safeNotif } = notif;
            return {
              restricted: true,
              reason: `Action blocked: Incomplete mandatory requirement "${notif.title}" (${notif.mandatoryActionType || 'Policy Acceptance'}). Please complete the required action to unlock this functionality.`,
              notification: safeNotif
            };
          }
        }

        return { restricted: false };
      },
      () => ({ restricted: false }),
      'NotificationRepository.checkUserRestricted'
    );
  }
}
