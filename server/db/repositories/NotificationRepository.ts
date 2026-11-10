import { getMongoDb, isMongoConfigured } from '../mongodb';

export interface NotificationRecord {
  id: string;
  userId?: string;
  title: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error' | 'alert';
  channel?: 'in-app' | 'email' | 'whatsapp' | 'sms' | 'push';
  recipient?: string;
  isRead?: boolean;
  read?: boolean;
  eventId?: string;
  idempotencyKey?: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

let inMemoryNotifications: NotificationRecord[] = [];

let indexInitPromise: Promise<void> | null = null;

const isTest = () => process.env.IS_TEST === 'true';
const isMongoActive = () => isMongoConfigured() && (!isTest() || process.env.USE_REAL_MONGO_TEST === 'true');

async function getNotificationsCollection() {
  const db = await getMongoDb();
  return db.collection('notifications');
}

export async function ensureNotificationIndexes(): Promise<void> {
  if (!isMongoActive()) return;
  if (!indexInitPromise) {
    indexInitPromise = (async () => {
      try {
        const coll = await getNotificationsCollection();
        await coll.createIndex({ eventId: 1 }, { unique: true, sparse: true });
        await coll.createIndex({ idempotencyKey: 1 }, { unique: true, sparse: true });
        await coll.createIndex({ userId: 1, createdAt: -1 });
        console.log('[NotificationRepository] MongoDB unique indexes verified on notifications collection.');
      } catch (err: any) {
        indexInitPromise = null;
        console.error('[NotificationRepository] MongoDB index initialization error on notifications collection:', err?.message || err);
        throw new Error(`MongoDB notifications index initialization failed: ${err?.message || err}`);
      }
    })();
  }
  return indexInitPromise;
}

ensureNotificationIndexes().catch((err) => {
  if (isMongoActive()) {
    console.error('[NotificationRepository] Background index setup failed:', err?.message || err);
  }
});

function normalizeNotificationRecord(doc: any): NotificationRecord {
  if (!doc) return doc;
  const { _id, ...safe } = doc;
  const isRead = Boolean(safe.isRead ?? safe.read ?? false);
  return {
    ...safe,
    isRead,
    read: isRead
  } as NotificationRecord;
}

function validateExistingNotificationRecord(existing: any, record: NotificationRecord): boolean {
  if (!existing) return true;
  const normExisting = normalizeNotificationRecord(existing);

  // 1. Verify userId whenever supplied.
  if (record.userId !== undefined && String(normExisting.userId ?? '') !== String(record.userId ?? '')) {
    return false;
  }
  // 2. Verify recipient whenever supplied.
  if (record.recipient !== undefined && String(normExisting.recipient ?? '') !== String(record.recipient ?? '')) {
    return false;
  }
  // 3. Verify title, message, type and channel.
  if (record.title !== undefined && normExisting.title !== record.title) {
    return false;
  }
  if (record.message !== undefined && normExisting.message !== record.message) {
    return false;
  }
  if (record.type !== undefined && normExisting.type !== record.type) {
    return false;
  }
  if (record.channel !== undefined && normExisting.channel !== record.channel) {
    return false;
  }
  // 4. Verify relevant metadata when supplied.
  if (record.metadata !== undefined) {
    if (JSON.stringify(normExisting.metadata ?? {}) !== JSON.stringify(record.metadata)) {
      return false;
    }
  }

  return true;
}

export class NotificationRepository {
  static getAll(filters?: { userId?: string; type?: string; unreadOnly?: boolean }): NotificationRecord[] {
    let list = [...inMemoryNotifications];
    if (filters?.userId) {
      list = list.filter(n => String(n.userId) === String(filters.userId));
    }
    if (filters?.type) {
      list = list.filter(n => n.type === filters.type);
    }
    if (filters?.unreadOnly) {
      list = list.filter(n => !n.isRead && !n.read);
    }
    return list.map(normalizeNotificationRecord);
  }

  static async getAllAsync(filters?: { userId?: string; type?: string; unreadOnly?: boolean }): Promise<NotificationRecord[]> {
    if (isMongoActive()) {
      await ensureNotificationIndexes();
      try {
        const coll = await getNotificationsCollection();
        const query: Record<string, any> = {};
        if (filters?.userId) {
          query.userId = String(filters.userId);
        }
        if (filters?.type) {
          query.type = filters.type;
        }
        if (filters?.unreadOnly) {
          query.$and = [{ isRead: { $ne: true } }, { read: { $ne: true } }];
        }

        const docs = await coll.find(query).sort({ createdAt: -1 }).toArray();
        return (docs || []).map(normalizeNotificationRecord);
      } catch (err: any) {
        throw new Error(`MongoDB notifications operation failed: ${err.message || err}`);
      }
    }
    return this.getAll(filters);
  }

  static async getUnreadCountAsync(userId: string): Promise<number> {
    if (!userId) return 0;
    if (isMongoActive()) {
      await ensureNotificationIndexes();
      try {
        const coll = await getNotificationsCollection();
        return await coll.countDocuments({ userId: String(userId), isRead: { $ne: true }, read: { $ne: true } });
      } catch (err: any) {
        throw new Error(`MongoDB notifications operation failed: ${err.message || err}`);
      }
    }
    return this.getAll({ userId, unreadOnly: true }).length;
  }

  static create(data: Partial<NotificationRecord> | any, _author?: string): NotificationRecord {
    const eventKey = data.eventId || data.idempotencyKey || undefined;
    const isRead = Boolean(data.isRead ?? data.read ?? false);

    const record: NotificationRecord = {
      id: data.id || `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      userId: data.userId ? String(data.userId) : undefined,
      title: data.title || 'System Notification',
      message: data.message || data.body || data.plainText || '',
      type: data.type || 'info',
      channel: data.channel || 'in-app',
      recipient: data.recipient || undefined,
      isRead,
      read: isRead,
      eventId: eventKey,
      idempotencyKey: eventKey,
      metadata: data.metadata || undefined,
      createdAt: data.createdAt || new Date().toISOString()
    };

    if (eventKey) {
      const existing = inMemoryNotifications.find(n => n.eventId === eventKey || n.idempotencyKey === eventKey);
      if (existing) {
        if (!validateExistingNotificationRecord(existing, record)) {
          throw new Error('Notification idempotency collision: existing notification with eventId belongs to another recipient or contains conflicting content.');
        }
        return normalizeNotificationRecord(existing);
      }
    }

    inMemoryNotifications.unshift(record);
    if (inMemoryNotifications.length > 500) {
      inMemoryNotifications = inMemoryNotifications.slice(0, 500);
    }
    return record;
  }

  static async createAsync(data: Partial<NotificationRecord> | any, author?: string): Promise<NotificationRecord> {
    const eventKey = data.eventId || data.idempotencyKey || undefined;
    const isRead = Boolean(data.isRead ?? data.read ?? false);

    const record: NotificationRecord = {
      id: data.id || `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      userId: data.userId ? String(data.userId) : undefined,
      title: data.title || 'System Notification',
      message: data.message || data.body || data.plainText || '',
      type: data.type || 'info',
      channel: data.channel || 'in-app',
      recipient: data.recipient || undefined,
      isRead,
      read: isRead,
      eventId: eventKey,
      idempotencyKey: eventKey,
      metadata: data.metadata || undefined,
      createdAt: data.createdAt || new Date().toISOString()
    };

    if (isMongoActive()) {
      await ensureNotificationIndexes();
      try {
        const coll = await getNotificationsCollection();
        if (eventKey) {
          const existing = await coll.findOne({
            $or: [{ eventId: eventKey }, { idempotencyKey: eventKey }]
          });
          if (existing) {
            if (!validateExistingNotificationRecord(existing, record)) {
              throw new Error('Notification idempotency collision: existing notification with eventId belongs to another recipient or contains conflicting content.');
            }
            return normalizeNotificationRecord(existing);
          }
        }
        await coll.insertOne({ ...record });
        return record;
      } catch (err: any) {
        if (err?.message?.includes('idempotency collision')) {
          throw err;
        }
        if (err?.code === 11000 && eventKey) {
          try {
            const coll = await getNotificationsCollection();
            const existing = await coll.findOne({
              $or: [{ eventId: eventKey }, { idempotencyKey: eventKey }]
            });
            if (existing) {
              if (!validateExistingNotificationRecord(existing, record)) {
                throw new Error('Notification idempotency collision: existing notification with eventId belongs to another recipient or contains conflicting content.');
              }
              return normalizeNotificationRecord(existing);
            }
          } catch (raceErr: any) {
            if (raceErr.message?.includes('idempotency collision')) {
              throw raceErr;
            }
          }
        }
        throw new Error(`MongoDB notifications operation failed: ${err.message || err}`);
      }
    }

    return this.create(data, author);
  }

  static checkUserRestricted(_userId: string, _target?: string): { restricted: boolean; reason?: string; notification?: any } {
    return { restricted: false };
  }

  static markAsRead(id: string): boolean {
    const item = inMemoryNotifications.find(n => n.id === id);
    if (item) {
      item.isRead = true;
      return true;
    }
    return false;
  }

  static async markAsReadAsync(id: string, userId: string): Promise<boolean> {
    if (!id || !userId) return false;
    if (isMongoActive()) {
      await ensureNotificationIndexes();
      try {
        const coll = await getNotificationsCollection();
        const res = await coll.updateOne(
          { id: String(id), userId: String(userId) },
          { $set: { isRead: true } }
        );
        return res.modifiedCount > 0 || res.matchedCount > 0;
      } catch (err: any) {
        throw new Error(`MongoDB notifications operation failed: ${err.message || err}`);
      }
    }
    const item = inMemoryNotifications.find(n => n.id === String(id) && String(n.userId) === String(userId));
    if (item) {
      item.isRead = true;
      return true;
    }
    return false;
  }

  static markAllAsRead(userId?: string): number {
    let count = 0;
    for (const item of inMemoryNotifications) {
      if (!userId || String(item.userId) === String(userId)) {
        if (!item.isRead) {
          item.isRead = true;
          count++;
        }
      }
    }
    return count;
  }

  static async markAllAsReadAsync(userId: string): Promise<number> {
    if (!userId) return 0;
    if (isMongoActive()) {
      await ensureNotificationIndexes();
      try {
        const coll = await getNotificationsCollection();
        const res = await coll.updateMany(
          { userId: String(userId), isRead: { $ne: true } },
          { $set: { isRead: true } }
        );
        return res.modifiedCount;
      } catch (err: any) {
        throw new Error(`MongoDB notifications operation failed: ${err.message || err}`);
      }
    }
    return this.markAllAsRead(userId);
  }

  static delete(id: string): boolean {
    const prevLen = inMemoryNotifications.length;
    inMemoryNotifications = inMemoryNotifications.filter(n => n.id !== id);
    return inMemoryNotifications.length < prevLen;
  }

  static async deleteAsync(id: string, userId?: string): Promise<boolean> {
    if (!id) return false;
    if (isMongoActive()) {
      await ensureNotificationIndexes();
      try {
        const coll = await getNotificationsCollection();
        const query: Record<string, any> = { id: String(id) };
        if (userId) query.userId = String(userId);
        const res = await coll.deleteOne(query);
        return res.deletedCount > 0;
      } catch (err: any) {
        throw new Error(`MongoDB notifications operation failed: ${err.message || err}`);
      }
    }
    return this.delete(id);
  }

  static send(data: Partial<NotificationRecord>): NotificationRecord {
    return this.create(data);
  }

  static async sendAsync(data: Partial<NotificationRecord>): Promise<NotificationRecord> {
    return this.createAsync(data);
  }

  static clearInMemoryStore(): void {
    inMemoryNotifications = [];
  }
}
