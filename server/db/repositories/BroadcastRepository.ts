import { Collection } from 'mongodb';
import { getMongoDb } from '../mongodb';
import { BroadcastCampaign } from '../../../src/types/adminSuite';

const COLLECTION = 'broadcast_campaigns';

export const SYNTHETIC_CAMPAIGN_IDS = ['camp-01', 'camp-02', 'camp-03'] as const;

export const ALLOWED_CHANNELS = [
  'Email',
  'WhatsApp',
  'SMS',
  'Push Notification',
  'Multi-Channel'
] as const;

export const ALLOWED_AUDIENCES = [
  'All Users',
  'Job Seekers Only',
  'Employers / Posters',
  'Subscribed Members',
  'Unpaid / Expired Users',
  'Government Job Seekers',
  'Overseas / Gulf Candidates'
] as const;

export type BroadcastChannel = (typeof ALLOWED_CHANNELS)[number];
export type BroadcastAudience = (typeof ALLOWED_AUDIENCES)[number];

// Collection-instance-safe index initialization tracking
const inFlightInitMap = new WeakMap<Collection<any>, Promise<void>>();
const initializedSet = new WeakSet<Collection<any>>();

export function isBroadcastCollectionInitialized(coll: Collection<any>): boolean {
  return initializedSet.has(coll);
}

export function validateBroadcastPayload(payload: any): { valid: boolean; error?: string; clean?: Partial<BroadcastCampaign> } {
  if (!payload || typeof payload !== 'object') {
    return { valid: false, error: 'Broadcast payload must be an object.' };
  }

  // 1. Title
  if (!payload.title || typeof payload.title !== 'string' || !payload.title.trim()) {
    return { valid: false, error: 'Campaign title is required and must be a non-empty string.' };
  }
  const cleanTitle = payload.title.trim();
  if (cleanTitle.length > 250) {
    return { valid: false, error: 'Campaign title cannot exceed 250 characters.' };
  }

  // 2. Channel
  if (!payload.channel || !ALLOWED_CHANNELS.includes(payload.channel)) {
    return {
      valid: false,
      error: `Invalid channel "${payload.channel}". Allowed channels: ${ALLOWED_CHANNELS.join(', ')}.`
    };
  }

  // 3. Target Audience
  if (!payload.targetAudience || !ALLOWED_AUDIENCES.includes(payload.targetAudience)) {
    return {
      valid: false,
      error: `Invalid target audience "${payload.targetAudience}". Allowed audiences: ${ALLOWED_AUDIENCES.join(', ')}.`
    };
  }

  // 4. Subject
  const rawSubject = payload.subject && typeof payload.subject === 'string' && payload.subject.trim() ? payload.subject.trim() : cleanTitle;
  if (!rawSubject) {
    return { valid: false, error: 'Campaign subject is required.' };
  }
  if (rawSubject.length > 300) {
    return { valid: false, error: 'Campaign subject cannot exceed 300 characters.' };
  }

  // 5. Message Body
  if (!payload.messageBody || typeof payload.messageBody !== 'string' || !payload.messageBody.trim()) {
    return { valid: false, error: 'Campaign message body is required and cannot be empty.' };
  }
  const cleanMessageBody = payload.messageBody.trim();

  // 6. Optional Category Filter
  const cleanCategoryFilter = payload.categoryFilter && typeof payload.categoryFilter === 'string' && payload.categoryFilter.trim()
    ? payload.categoryFilter.trim()
    : 'All Categories';

  // 7. Recipients Count
  let cleanRecipientsCount = 0;
  if (typeof payload.recipientsCount === 'number' && Number.isFinite(payload.recipientsCount) && payload.recipientsCount >= 0) {
    cleanRecipientsCount = Math.floor(payload.recipientsCount);
  }

  return {
    valid: true,
    clean: {
      title: cleanTitle,
      channel: payload.channel as BroadcastChannel,
      targetAudience: payload.targetAudience as BroadcastAudience,
      subject: rawSubject,
      messageBody: cleanMessageBody,
      categoryFilter: cleanCategoryFilter,
      recipientsCount: cleanRecipientsCount
    }
  };
}

export const BroadcastRepository = {
  resetIndexInitialization(coll?: Collection<any>): void {
    if (coll) {
      inFlightInitMap.delete(coll);
      initializedSet.delete(coll);
    }
  },

  async getCollection(coll?: Collection<BroadcastCampaign>): Promise<Collection<BroadcastCampaign>> {
    if (coll) return coll;
    const db = await getMongoDb();
    return db.collection<BroadcastCampaign>(COLLECTION);
  },

  async ensureIndexes(coll?: Collection<BroadcastCampaign>): Promise<void> {
    const dbColl = await this.getCollection(coll);

    if (initializedSet.has(dbColl)) {
      return;
    }

    const existingPromise = inFlightInitMap.get(dbColl);
    if (existingPromise) {
      return existingPromise;
    }

    const initPromise = (async () => {
      try {
        await dbColl.createIndex(
          { id: 1 },
          { unique: true, name: 'unique_broadcast_campaign_id' }
        );
        await dbColl.createIndex(
          { createdAt: -1 },
          { name: 'idx_broadcast_campaigns_created_at' }
        );
        initializedSet.add(dbColl);
      } finally {
        inFlightInitMap.delete(dbColl);
      }
    })();

    inFlightInitMap.set(dbColl, initPromise);
    return initPromise;
  },

  async getAll(coll?: Collection<BroadcastCampaign>): Promise<BroadcastCampaign[]> {
    const dbColl = await this.getCollection(coll);
    await this.ensureIndexes(dbColl);
    const records = await dbColl.find({}).sort({ createdAt: -1, _id: -1 } as any).toArray();
    return records.map(r => {
      const { _id, ...safe } = r as any;
      return safe as BroadcastCampaign;
    });
  },

  async getById(id: string, coll?: Collection<BroadcastCampaign>): Promise<BroadcastCampaign | null> {
    const dbColl = await this.getCollection(coll);
    await this.ensureIndexes(dbColl);
    const doc = await dbColl.findOne({ id } as any);
    if (!doc) return null;
    const { _id, ...safe } = doc as any;
    return safe as BroadcastCampaign;
  },

  async createCampaign(input: any, coll?: Collection<BroadcastCampaign>): Promise<BroadcastCampaign> {
    const dbColl = await this.getCollection(coll);
    await this.ensureIndexes(dbColl);

    const validation = validateBroadcastPayload(input);
    if (!validation.valid || !validation.clean) {
      throw new Error(`Validation Error: ${validation.error}`);
    }

    // Determine ID
    let campaignId = typeof input.id === 'string' && input.id.trim() ? input.id.trim() : '';
    if (!campaignId) {
      campaignId = `camp-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;
    } else {
      // Check for duplicate / idempotency
      const existing = await dbColl.findOne({ id: campaignId } as any);
      if (existing) {
        throw new Error(`Duplicate Campaign Error: Campaign with ID "${campaignId}" already exists.`);
      }
    }

    const now = new Date().toISOString();
    // Delivery safety: Newly created campaigns are strictly Draft only.
    // Client-supplied status, sentAt, openRate, clickRate are NEVER trusted.
    const docToInsert: BroadcastCampaign & { createdAt: string; updatedAt: string } = {
      id: campaignId,
      title: validation.clean.title!,
      channel: validation.clean.channel!,
      targetAudience: validation.clean.targetAudience!,
      categoryFilter: validation.clean.categoryFilter || 'All Categories',
      subject: validation.clean.subject!,
      messageBody: validation.clean.messageBody!,
      sentAt: undefined, // No delivery in this step
      status: 'Draft',   // Strictly Draft only
      recipientsCount: validation.clean.recipientsCount ?? 0,
      openRate: 0,
      clickRate: 0,
      createdAt: now,
      updatedAt: now
    };

    await dbColl.insertOne(docToInsert as any);

    const { _id, ...safe } = docToInsert as any;
    return safe as BroadcastCampaign;
  },

  async importLegacyCampaigns(
    legacyItems: any[],
    coll?: Collection<BroadcastCampaign>
  ): Promise<{ imported: number; skipped: number; totalProcessed: number; errors: string[] }> {
    const dbColl = await this.getCollection(coll);
    await this.ensureIndexes(dbColl);

    if (!Array.isArray(legacyItems)) {
      throw new Error('Validation Error: Expected an array of legacy campaigns.');
    }

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const item of legacyItems) {
      if (!item || typeof item !== 'object') {
        skipped++;
        continue;
      }

      const itemId = item.id ? String(item.id).trim() : '';

      // Rule: Never import known synthetic initial sample campaigns
      if (SYNTHETIC_CAMPAIGN_IDS.includes(itemId as any)) {
        skipped++;
        continue;
      }

      // Check if already in database (retry safety / duplicate prevention)
      if (itemId) {
        const existing = await dbColl.findOne({ id: itemId } as any);
        if (existing) {
          skipped++;
          continue;
        }
      }

      const validation = validateBroadcastPayload(item);
      if (!validation.valid || !validation.clean) {
        skipped++;
        errors.push(`Skipped invalid campaign "${item?.title || itemId}": ${validation.error}`);
        continue;
      }

      const cleanId = itemId || `camp-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;
      const now = new Date().toISOString();

      // Delivery safety: Never treat legacy sample 'Sent' records as genuine deliveries.
      // All imported user records are stored strictly as Draft.
      const docToInsert: BroadcastCampaign & { createdAt: string; updatedAt: string } = {
        id: cleanId,
        title: validation.clean.title!,
        channel: validation.clean.channel!,
        targetAudience: validation.clean.targetAudience!,
        categoryFilter: validation.clean.categoryFilter || 'All Categories',
        subject: validation.clean.subject!,
        messageBody: validation.clean.messageBody!,
        sentAt: undefined,
        status: 'Draft',
        recipientsCount: validation.clean.recipientsCount ?? 0,
        openRate: 0,
        clickRate: 0,
        createdAt: item.createdAt || now,
        updatedAt: now
      };

      try {
        await dbColl.insertOne(docToInsert as any);
        imported++;
      } catch (insertErr: any) {
        if (insertErr?.code === 11000) {
          skipped++;
        } else {
          errors.push(`Failed to import campaign "${cleanId}": ${insertErr.message}`);
        }
      }
    }

    return {
      imported,
      skipped,
      totalProcessed: legacyItems.length,
      errors
    };
  }
};
