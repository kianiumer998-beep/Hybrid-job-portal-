export interface NotificationRecord {
  id: string;
  userId?: string;
  title: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error' | 'alert';
  channel?: 'in-app' | 'email' | 'whatsapp' | 'sms' | 'push';
  recipient?: string;
  isRead?: boolean;
  metadata?: Record<string, any>;
  createdAt: string;
}

// In-memory / persistent notification storage
let inMemoryNotifications: NotificationRecord[] = [];

export class NotificationRepository {
  static getAll(filters?: { userId?: string; type?: string; unreadOnly?: boolean }): NotificationRecord[] {
    let list = [...inMemoryNotifications];
    if (filters?.userId) {
      list = list.filter(n => n.userId === filters.userId);
    }
    if (filters?.type) {
      list = list.filter(n => n.type === filters.type);
    }
    if (filters?.unreadOnly) {
      list = list.filter(n => !n.isRead);
    }
    return list;
  }

  static create(data: Partial<NotificationRecord> | any, _author?: string): NotificationRecord {
    const record: NotificationRecord = {
      id: data.id || `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      title: data.title || 'System Notification',
      message: data.message || data.body || data.plainText || '',
      type: data.type || 'info',
      channel: data.channel || 'in-app',
      isRead: data.isRead ?? false,
      createdAt: new Date().toISOString(),
      ...data
    };
    inMemoryNotifications.unshift(record);
    if (inMemoryNotifications.length > 500) {
      inMemoryNotifications = inMemoryNotifications.slice(0, 500);
    }
    return record;
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

  static markAllAsRead(userId?: string): number {
    let count = 0;
    for (const item of inMemoryNotifications) {
      if (!userId || item.userId === userId) {
        if (!item.isRead) {
          item.isRead = true;
          count++;
        }
      }
    }
    return count;
  }

  static delete(id: string): boolean {
    const prevLen = inMemoryNotifications.length;
    inMemoryNotifications = inMemoryNotifications.filter(n => n.id !== id);
    return inMemoryNotifications.length < prevLen;
  }

  static send(data: Partial<NotificationRecord>): NotificationRecord {
    return this.create(data);
  }
}
