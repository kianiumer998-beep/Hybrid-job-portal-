import { Collection } from 'mongodb';
import * as crypto from 'crypto';
import { getMongoDb, isMongoConfigured } from '../mongodb';

export type BroadcastRecipientStatus =
  | 'WaitingForProvider'
  | 'Queued'
  | 'Sent'
  | 'Delivered'
  | 'Failed'
  | 'Skipped';

export interface BroadcastRecipientRecord {
  id: string;
  campaignId: string;
  subscriberId: string;
  channel: 'Email' | 'WhatsApp' | 'SMS';
  status: BroadcastRecipientStatus;
  contactMask?: string;
  providerMessageId?: string;
  failureReason?: string;
  attempts: number;
  createdAt: string;
  updatedAt: string;
  lastAttemptAt?: string;
}

const COLLECTION = 'broadcast_campaign_recipients';
const indexesReady = new WeakSet<Collection<any>>();

function safeText(value: unknown, max = 300): string {
  return String(value ?? '').trim().slice(0, max);
}

export const BroadcastRecipientRepository = {
  async collection(): Promise<Collection<BroadcastRecipientRecord>> {
    if (!isMongoConfigured()) throw new Error('MongoDB is not configured.');
    const db = await getMongoDb();
    const collection = db.collection<BroadcastRecipientRecord>(COLLECTION);
    if (!indexesReady.has(collection)) {
      await collection.createIndex({ campaignId: 1, subscriberId: 1, channel: 1 }, { unique: true, name: 'uniq_campaign_recipient_channel' });
      await collection.createIndex({ campaignId: 1, status: 1, updatedAt: -1 }, { name: 'idx_campaign_recipient_status' });
      await collection.createIndex({ subscriberId: 1, updatedAt: -1 }, { name: 'idx_recipient_history' });
      indexesReady.add(collection);
    }
    return collection;
  },

  async prepare(campaignId: string, recipients: Array<{ subscriberId: string; channel: 'Email' | 'WhatsApp' | 'SMS'; contactMask?: string }>) {
    const id = safeText(campaignId, 160);
    if (!id) throw new Error('Campaign ID is required.');
    if (!Array.isArray(recipients) || recipients.length > 10000) throw new Error('Recipient list must contain no more than 10,000 entries.');
    const collection = await this.collection();
    const now = new Date().toISOString();
    const unique = new Map<string, typeof recipients[number]>();
    for (const recipient of recipients) {
      const subscriberId = safeText(recipient?.subscriberId, 160);
      const channel = recipient?.channel;
      if (!subscriberId || !['Email', 'WhatsApp', 'SMS'].includes(channel)) continue;
      unique.set(subscriberId + ':' + channel, { subscriberId, channel, contactMask: safeText(recipient.contactMask, 80) });
    }
    const docs = Array.from(unique.values()).map((r) => ({
      id: 'bcr-' + crypto.createHash('sha256').update(id + '|' + r.subscriberId + '|' + r.channel).digest('hex'),
      campaignId: id,
      subscriberId: r.subscriberId,
      channel: r.channel,
      status: 'WaitingForProvider' as const,
      contactMask: r.contactMask,
      attempts: 0,
      createdAt: now,
      updatedAt: now
    }));
    let inserted = 0;
    if (docs.length) {
      try {
        const result = await collection.insertMany(docs as any, { ordered: false });
        inserted = result.insertedCount;
      } catch (err: any) {
        if (err?.code !== 11000 && !Array.isArray(err?.writeErrors)) throw err;
        inserted = Number(err?.result?.insertedCount || err?.insertedCount || 0);
      }
    }
    const total = await collection.countDocuments({ campaignId: id });
    return { campaignId: id, eligible: unique.size, newlyPrepared: inserted, totalRecipients: total, deliveryEnabled: false, status: 'WaitingForProvider' as const };
  },

  async list(campaignId: string, page = 1, pageSize = 50) {
    const collection = await this.collection();
    const safePage = Math.max(1, Math.floor(Number(page) || 1));
    const safeSize = Math.min(100, Math.max(1, Math.floor(Number(pageSize) || 50)));
    const filter = { campaignId: safeText(campaignId, 160) };
    const [items, total] = await Promise.all([
      collection.find(filter).sort({ updatedAt: -1, _id: -1 }).skip((safePage - 1) * safeSize).limit(safeSize).toArray(),
      collection.countDocuments(filter)
    ]);
    return { items: items.map(({ _id, ...item }: any) => item), total, page: safePage, pageSize: safeSize };
  },

  async summary(campaignId: string) {
    const collection = await this.collection();
    const rows = await collection.aggregate([
      { $match: { campaignId: safeText(campaignId, 160) } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]).toArray();
    const counts: Record<string, number> = { WaitingForProvider: 0, Queued: 0, Sent: 0, Delivered: 0, Failed: 0, Skipped: 0 };
    for (const row of rows) if (typeof row._id === 'string' && row._id in counts) counts[row._id] = Number(row.count) || 0;
    return { campaignId: safeText(campaignId, 160), counts, total: Object.values(counts).reduce((a, b) => a + b, 0), deliveryEnabled: false };
  },

  async retryFailed(campaignId: string) {
    const collection = await this.collection();
    const now = new Date().toISOString();
    const result = await collection.updateMany(
      { campaignId: safeText(campaignId, 160), status: 'Failed' },
      { $set: { status: 'WaitingForProvider', updatedAt: now, failureReason: 'Retry requested; waiting for provider integration.' } }
    );
    return { retried: result.modifiedCount, deliveryEnabled: false };
  }
};
