import crypto from 'crypto';
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

export interface NotificationFilters {
  userId?: string;
  type?: string;
  unreadOnly?: boolean;
  limit?: number;
}

export const MAX_NOTIFICATION_RESULTS = 500;

let inMemoryNotifications: NotificationRecord[] = [];
let indexInitPromise: Promise<void> | null = null;
let mockNotificationsCollection: any = null;

type StorageMode = 'real-mongo' | 'mock-mongo' | 'in-memory';

const isProduction = () => process.env.NODE_ENV === 'production';
const isTest = () => process.env.IS_TEST === 'true';
const useRealMongoTest = () => process.env.USE_REAL_MONGO_TEST === 'true';

function resolveAsyncStorageMode(): StorageMode {
  if (isProduction()) {
    if (!isMongoConfigured()) {
      throw new Error('Notification storage is unavailable: MongoDB is not configured for production.');
    }
    return 'real-mongo';
  }

  if (isTest() && mockNotificationsCollection !== null) {
    return 'mock-mongo';
  }

  if (isTest() && useRealMongoTest()) {
    if (!isMongoConfigured()) {
      throw new Error('Notification storage is unavailable: USE_REAL_MONGO_TEST=true requires MONGODB_URI or MONGO_URI.');
    }
    return 'real-mongo';
  }

  if (!isTest() && isMongoConfigured()) {
    return 'real-mongo';
  }

  return 'in-memory';
}

function assertSyncInMemoryAllowed(methodName: string): void {
  if (isProduction()) {
    throw new Error(`NotificationRepository.${methodName}() is disabled in production; use the durable asynchronous MongoDB method instead.`);
  }
}

async function getNotificationsCollectionForMode(mode: 'real-mongo' | 'mock-mongo') {
  if (mode === 'mock-mongo') {
    return mockNotificationsCollection;
  }
  const db = await getMongoDb();
  return db.collection('notifications');
}

function isDuplicateKeyError(err: any): boolean {
  return err?.code === 11000 || /E11000|duplicate key|cannot create unique index/i.test(err?.message || '');
}

export async function ensureNotificationIndexes(): Promise<void> {
  const mode = resolveAsyncStorageMode();
  if (mode === 'in-memory') return;

  if (!indexInitPromise) {
    const initRun = (async () => {
      try {
        const coll = await getNotificationsCollectionForMode(mode);
        if (!coll || typeof coll.createIndex !== 'function') {
          throw new Error('MongoDB notifications collection does not expose createIndex().');
        }
        await coll.createIndex({ id: 1 }, { unique: true });
        await coll.createIndex({ eventId: 1 }, { unique: true, sparse: true });
        await coll.createIndex({ idempotencyKey: 1 }, { unique: true, sparse: true });
        await coll.createIndex({ userId: 1, createdAt: -1 });
      } catch (err: any) {
        console.error('[NotificationRepository] MongoDB index initialization error on notifications collection:', err?.message || err);
        if (isDuplicateKeyError(err)) {
          throw new Error(
            'MongoDB notifications unique index initialization failed due to existing duplicate records. Manual investigation is required before proceeding.'
          );
        }
        throw new Error(`MongoDB notifications index initialization failed: ${err?.message || err}`);
      }
    })();
    indexInitPromise = initRun;
    try {
      await initRun;
    } catch (err) {
      if (indexInitPromise === initRun) {
        indexInitPromise = null;
      }
      throw err;
    }
    return;
  }

  return indexInitPromise;
}

if (!isProduction() && isMongoConfigured() && (!isTest() || useRealMongoTest())) {
  ensureNotificationIndexes().catch((err) => {
    console.error('[NotificationRepository] Background index setup failed:', err?.message || err);
  });
}

function resolveNotificationLimit(rawLimit?: number): number {
  if (typeof rawLimit !== 'number' || !Number.isFinite(rawLimit) || rawLimit <= 0) {
    return MAX_NOTIFICATION_RESULTS;
  }
  return Math.min(Math.floor(rawLimit), MAX_NOTIFICATION_RESULTS);
}

function canonicalizeValue(val: any): any {
  if (val === null || typeof val !== 'object') {
    return val;
  }
  if (Array.isArray(val)) {
    return val.map(canonicalizeValue);
  }
  if (val instanceof Date) {
    return val.toISOString();
  }
  const sorted: Record<string, any> = {};
  for (const key of Object.keys(val).sort()) {
    if (val[key] !== undefined) {
      sorted[key] = canonicalizeValue(val[key]);
    }
  }
  return sorted;
}

function normalizeNotificationRecord(doc: any): NotificationRecord {
  if (!doc) return doc;
  const { _id, ...safe } = doc;
  const isRead = Boolean(safe.isRead || safe.read);
  return {
    ...safe,
    isRead,
    read: isRead
  } as NotificationRecord;
}

function validateExistingNotificationRecord(existing: any, record: NotificationRecord): boolean {
  if (!existing) return true;
  const normExisting = normalizeNotificationRecord(existing);

  // 1. Verify userId consistency
  if (String(normExisting.userId ?? '') !== String(record.userId ?? '')) {
    return false;
  }
  // 2. Verify recipient consistency
  if (String(normExisting.recipient ?? '') !== String(record.recipient ?? '')) {
    return false;
  }
  // 3. Verify title, message, type and channel
  if (normExisting.title !== record.title) {
    return false;
  }
  if (normExisting.message !== record.message) {
    return false;
  }
  if (normExisting.type !== record.type) {
    return false;
  }
  if (normExisting.channel !== record.channel) {
    return false;
  }
  // 4. Canonical key-order-independent metadata comparison
  const existingMeta = JSON.stringify(canonicalizeValue(normExisting.metadata ?? {}));
  const incomingMeta = JSON.stringify(canonicalizeValue(record.metadata ?? {}));
  if (existingMeta !== incomingMeta) {
    return false;
  }

  return true;
}

function sortNotificationsDescending(list: NotificationRecord[]): NotificationRecord[] {
  return [...list].sort((a, b) => {
    const rawA = String(a.createdAt ?? '');
    const rawB = String(b.createdAt ?? '');
    const parsedA = Date.parse(rawA);
    const parsedB = Date.parse(rawB);

    if (!Number.isNaN(parsedA) && !Number.isNaN(parsedB) && parsedB !== parsedA) {
      return parsedB - parsedA;
    }
    if (rawB !== rawA) {
      return rawB < rawA ? -1 : 1;
    }

    const idA = String(a.id ?? '');
    const idB = String(b.id ?? '');
    if (idB !== idA) {
      return idB < idA ? -1 : 1;
    }
    return 0;
  });
}

function buildNotificationRecord(data: Partial<NotificationRecord> | any): NotificationRecord {
  const eventKey = data.eventId || data.idempotencyKey || undefined;
  const isRead = Boolean(data.isRead || data.read);

  return {
    id: data.id ? String(data.id) : `notif-${Date.now()}-${crypto.randomBytes(5).toString('hex')}`,
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
}

function queryInMemoryNotifications(filters?: NotificationFilters): NotificationRecord[] {
  let list = [...inMemoryNotifications];
  if (filters?.userId) {
    list = list.filter(n => String(n.userId ?? '') === String(filters.userId));
  }
  if (filters?.type) {
    list = list.filter(n => n.type === filters.type);
  }
  if (filters?.unreadOnly) {
    list = list.filter(n => !n.isRead && !n.read);
  }
  const limit = resolveNotificationLimit(filters?.limit);
  return sortNotificationsDescending(list).slice(0, limit).map(normalizeNotificationRecord);
}

function createInMemoryNotification(data: Partial<NotificationRecord> | any): NotificationRecord {
  const record = buildNotificationRecord(data);
  const eventKey = record.eventId || record.idempotencyKey || undefined;

  if (eventKey) {
    const existing = inMemoryNotifications.find(n => n.eventId === eventKey || n.idempotencyKey === eventKey);
    if (existing) {
      if (!validateExistingNotificationRecord(existing, record)) {
        throw new Error('Notification idempotency collision: existing notification with eventId belongs to another recipient or contains conflicting content.');
      }
      return normalizeNotificationRecord(existing);
    }
  }

  if (inMemoryNotifications.some(n => n.id === record.id)) {
    throw new Error(`Notification duplicate id error: notification with id "${record.id}" already exists.`);
  }

  inMemoryNotifications.unshift(record);
  return normalizeNotificationRecord(record);
}

export class NotificationRepository {
  /**
   * Test-only hook to exercise the MongoDB-backed repository branch using a controlled mock collection.
   * Strictly prohibited unless IS_TEST === 'true' and NODE_ENV !== 'production'.
   */
  static setMockCollection(coll: any): void {
    if (coll !== null && (!isTest() || isProduction())) {
      throw new Error('Security violation: Notification mock collection injection is strictly prohibited outside non-production test mode.');
    }
    mockNotificationsCollection = coll;
    indexInitPromise = null;
  }

  static resetIndexInitStateForTests(): void {
    if (!isTest() || isProduction()) {
      throw new Error('Security violation: Index state reset is strictly prohibited outside non-production test mode.');
    }
    indexInitPromise = null;
  }

  static getAll(filters?: NotificationFilters): NotificationRecord[] {
    assertSyncInMemoryAllowed('getAll');
    return queryInMemoryNotifications(filters);
  }

  static async getAllAsync(filters?: NotificationFilters): Promise<NotificationRecord[]> {
    const mode = resolveAsyncStorageMode();
    const limit = resolveNotificationLimit(filters?.limit);

    if (mode === 'in-memory') {
      return queryInMemoryNotifications({ ...filters, limit });
    }

    await ensureNotificationIndexes();
    try {
      const coll = await getNotificationsCollectionForMode(mode);
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

      const docs = await coll
        .find(query)
        .sort({ createdAt: -1, id: -1 })
        .limit(limit)
        .toArray();
      return (docs || []).map(normalizeNotificationRecord);
    } catch (err: any) {
      console.error('[NotificationRepository] getAllAsync MongoDB error:', err?.message || err);
      throw new Error(`MongoDB notifications operation failed: ${err?.message || err}`);
    }
  }

  static async getUnreadCountAsync(userId: string): Promise<number> {
    const mode = resolveAsyncStorageMode();
    const cleanUserId = typeof userId === 'string' ? userId.trim() : '';
    if (!cleanUserId) return 0;

    if (mode === 'in-memory') {
      return inMemoryNotifications.filter(
        n => String(n.userId ?? '') === cleanUserId && !n.isRead && !n.read
      ).length;
    }

    await ensureNotificationIndexes();
    try {
      const coll = await getNotificationsCollectionForMode(mode);
      return await coll.countDocuments({
        userId: cleanUserId,
        isRead: { $ne: true },
        read: { $ne: true }
      });
    } catch (err: any) {
      console.error('[NotificationRepository] getUnreadCountAsync MongoDB error:', err?.message || err);
      throw new Error(`MongoDB notifications operation failed: ${err?.message || err}`);
    }
  }

  static create(data: Partial<NotificationRecord> | any, _author?: string): NotificationRecord {
    assertSyncInMemoryAllowed('create');
    return createInMemoryNotification(data);
  }

  static async createAsync(data: Partial<NotificationRecord> | any, _author?: string): Promise<NotificationRecord> {
    const mode = resolveAsyncStorageMode();
    const record = buildNotificationRecord(data);
    const eventKey = record.eventId || record.idempotencyKey || undefined;

    if (mode === 'in-memory') {
      return createInMemoryNotification(record);
    }

    await ensureNotificationIndexes();
    try {
      const coll = await getNotificationsCollectionForMode(mode);
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
      return normalizeNotificationRecord(record);
    } catch (err: any) {
      if (err?.message?.includes('idempotency collision')) {
        throw err;
      }
      if (isDuplicateKeyError(err)) {
        if (eventKey) {
          try {
            const coll = await getNotificationsCollectionForMode(mode);
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
            if (raceErr?.message?.includes('idempotency collision')) {
              throw raceErr;
            }
          }
        }
        throw new Error(`Notification duplicate key error: record with id "${record.id}" already exists.`);
      }
      console.error('[NotificationRepository] createAsync MongoDB error:', err?.message || err);
      throw new Error(`MongoDB notifications operation failed: ${err?.message || err}`);
    }
  }

  static checkUserRestricted(_userId: string, _target?: string): { restricted: boolean; reason?: string; notification?: any } {
    return { restricted: false };
  }

  static markAsRead(id: string): boolean {
    assertSyncInMemoryAllowed('markAsRead');
    const item = inMemoryNotifications.find(n => n.id === id);
    if (item) {
      item.isRead = true;
      item.read = true;
      return true;
    }
    return false;
  }

  static async markAsReadAsync(id: string, userId: string): Promise<boolean> {
    const mode = resolveAsyncStorageMode();
    const cleanId = typeof id === 'string' ? id.trim() : '';
    const cleanUserId = typeof userId === 'string' ? userId.trim() : '';
    if (!cleanId || !cleanUserId) return false;

    if (mode === 'in-memory') {
      const item = inMemoryNotifications.find(
        n => n.id === cleanId && String(n.userId ?? '') === cleanUserId
      );
      if (!item) return false;
      if (!item.isRead && !item.read) {
        item.isRead = true;
        item.read = true;
      }
      return true;
    }

    await ensureNotificationIndexes();
    try {
      const coll = await getNotificationsCollectionForMode(mode);
      const res = await coll.updateOne(
        {
          id: cleanId,
          userId: cleanUserId,
          isRead: { $ne: true },
          read: { $ne: true }
        },
        { $set: { isRead: true, read: true } }
      );
      if ((res?.modifiedCount ?? 0) > 0 || (res?.matchedCount ?? 0) > 0) {
        return true;
      }
      const existingOwned = await coll.findOne({ id: cleanId, userId: cleanUserId });
      return Boolean(existingOwned);
    } catch (err: any) {
      console.error('[NotificationRepository] markAsReadAsync MongoDB error:', err?.message || err);
      throw new Error(`MongoDB notifications operation failed: ${err?.message || err}`);
    }
  }

  static markAllAsRead(userId?: string): number {
    assertSyncInMemoryAllowed('markAllAsRead');
    let count = 0;
    for (const item of inMemoryNotifications) {
      if (!userId || String(item.userId ?? '') === String(userId)) {
        if (!item.isRead && !item.read) {
          item.isRead = true;
          item.read = true;
          count++;
        }
      }
    }
    return count;
  }

  static async markAllAsReadAsync(userId: string): Promise<number> {
    const mode = resolveAsyncStorageMode();
    const cleanUserId = typeof userId === 'string' ? userId.trim() : '';
    if (!cleanUserId) return 0;

    if (mode === 'in-memory') {
      let count = 0;
      for (const item of inMemoryNotifications) {
        if (String(item.userId ?? '') === cleanUserId && !item.isRead && !item.read) {
          item.isRead = true;
          item.read = true;
          count++;
        }
      }
      return count;
    }

    await ensureNotificationIndexes();
    try {
      const coll = await getNotificationsCollectionForMode(mode);
      const res = await coll.updateMany(
        {
          userId: cleanUserId,
          isRead: { $ne: true },
          read: { $ne: true }
        },
        { $set: { isRead: true, read: true } }
      );
      return res?.modifiedCount ?? 0;
    } catch (err: any) {
      console.error('[NotificationRepository] markAllAsReadAsync MongoDB error:', err?.message || err);
      throw new Error(`MongoDB notifications operation failed: ${err?.message || err}`);
    }
  }

  static delete(id: string, userId?: string): boolean {
    assertSyncInMemoryAllowed('delete');
    const cleanId = typeof id === 'string' ? id.trim() : '';
    const cleanUserId = typeof userId === 'string' ? userId.trim() : '';
    if (!cleanId || !cleanUserId) return false;
    const prevLen = inMemoryNotifications.length;
    inMemoryNotifications = inMemoryNotifications.filter(
      n => !(n.id === cleanId && String(n.userId ?? '') === cleanUserId)
    );
    return inMemoryNotifications.length < prevLen;
  }

  static async deleteAsync(id: string, userId?: string): Promise<boolean> {
    const mode = resolveAsyncStorageMode();
    const cleanId = typeof id === 'string' ? id.trim() : '';
    const cleanUserId = typeof userId === 'string' ? userId.trim() : '';
    if (!cleanId || !cleanUserId) return false;

    if (mode === 'in-memory') {
      const prevLen = inMemoryNotifications.length;
      inMemoryNotifications = inMemoryNotifications.filter(
        n => !(n.id === cleanId && String(n.userId ?? '') === cleanUserId)
      );
      return inMemoryNotifications.length < prevLen;
    }

    await ensureNotificationIndexes();
    try {
      const coll = await getNotificationsCollectionForMode(mode);
      const res = await coll.deleteOne({ id: cleanId, userId: cleanUserId });
      return (res?.deletedCount ?? 0) > 0;
    } catch (err: any) {
      console.error('[NotificationRepository] deleteAsync MongoDB error:', err?.message || err);
      throw new Error(`MongoDB notifications operation failed: ${err?.message || err}`);
    }
  }

  static send(data: Partial<NotificationRecord>): NotificationRecord {
    assertSyncInMemoryAllowed('send');
    return this.create(data);
  }

  static async sendAsync(data: Partial<NotificationRecord>): Promise<NotificationRecord> {
    return this.createAsync(data);
  }

  static clearInMemoryStore(): void {
    inMemoryNotifications = [];
  }
}
