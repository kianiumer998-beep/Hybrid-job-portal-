import { Collection } from 'mongodb';
import { getMongoDb, isMongoConfigured } from '../mongodb';

export type BroadcastScheduleState = 'Scheduled' | 'Paused' | 'Cancelled' | 'WaitingForProvider';

export interface BroadcastScheduleRecord {
  id: string;
  campaignId: string;
  scheduledAt: string;
  timezone: string;
  state: BroadcastScheduleState;
  createdAt: string;
  updatedAt: string;
  note: string;
}

const COLLECTION = 'broadcast_campaign_schedules';
const ready = new WeakSet<Collection<any>>();

export const BroadcastScheduleRepository = {
  async collection(): Promise<Collection<BroadcastScheduleRecord>> {
    if (!isMongoConfigured()) throw new Error('MongoDB is not configured.');
    const db = await getMongoDb();
    const collection = db.collection<BroadcastScheduleRecord>(COLLECTION);
    if (!ready.has(collection)) {
      await collection.createIndex({ campaignId: 1 }, { unique: true, name: 'uniq_campaign_schedule' });
      await collection.createIndex({ state: 1, scheduledAt: 1 }, { name: 'idx_due_broadcast_schedules' });
      ready.add(collection);
    }
    return collection;
  },

  async schedule(campaignId: string, scheduledAt: string, timezone: string) {
    const id = String(campaignId || '').trim().slice(0, 160);
    const date = new Date(scheduledAt);
    if (!id || !Number.isFinite(date.getTime()) || date.getTime() <= Date.now()) {
      throw new Error('Choose a valid future schedule date and time.');
    }
    const safeTimezone = String(timezone || 'Asia/Karachi').trim().slice(0, 80);
    try {
      Intl.DateTimeFormat('en-US', { timeZone: safeTimezone });
    } catch {
      throw new Error('Invalid timezone.');
    }
    const collection = await this.collection();
    const now = new Date().toISOString();
    const record: BroadcastScheduleRecord = {
      id: 'bcs-' + id,
      campaignId: id,
      scheduledAt: date.toISOString(),
      timezone: safeTimezone,
      state: 'WaitingForProvider',
      createdAt: now,
      updatedAt: now,
      note: 'Scheduled time saved. Dispatch is disabled until a verified provider integration is configured.'
    };
    await collection.updateOne(
      { campaignId: id },
      { $set: record, $setOnInsert: { createdAt: now } },
      { upsert: true }
    );
    return record;
  },

  async list() {
    const collection = await this.collection();
    const items = await collection.find({}).sort({ scheduledAt: 1 }).limit(500).toArray();
    return items.map(({ _id, ...item }: any) => item);
  },

  async updateState(campaignId: string, state: 'Paused' | 'Cancelled' | 'WaitingForProvider') {
    const collection = await this.collection();
    const id = String(campaignId || '').trim().slice(0, 160);
    const result = await collection.updateOne(
      { campaignId: id },
      { $set: { state, updatedAt: new Date().toISOString(), note: state === 'Paused' ? 'Paused by administrator.' : state === 'Cancelled' ? 'Cancelled by administrator.' : 'Waiting for provider integration.' } }
    );
    if (!result.matchedCount) throw new Error('Schedule not found.');
    return { campaignId: id, state };
  }
};
