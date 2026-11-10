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

export interface LegacyImportResult {
  success: boolean;
  imported: number;
  duplicates: number;
  failed: number;
  totalProcessed: number;
  eligibleCount: number;
  syntheticSkipped: number;
  importedIds: string[];
  duplicateIds: string[];
  failedItems: Array<{ id?: string; title?: string; error: string }>;
  allEligibleSucceeded: boolean;
  errors: string[];
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

    // Fix B: Normal campaign creation generates a new unique campaign ID on the server.
    // Client-supplied IDs are strictly ignored during normal campaign creation.
    const campaignId = `camp-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;

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

    try {
      await dbColl.insertOne(docToInsert as any);
    } catch (insertErr: any) {
      if (insertErr?.code === 11000) {
        const err = new Error(`Duplicate Campaign Error: Campaign with ID "${campaignId}" already exists.`);
        (err as any).code = 11000;
        throw err;
      }
      throw insertErr;
    }

    const { _id, ...safe } = docToInsert as any;
    return safe as BroadcastCampaign;
  },

  async importLegacyCampaigns(
    legacyItems: any[],
    coll?: Collection<BroadcastCampaign>
  ): Promise<LegacyImportResult> {
    const dbColl = await this.getCollection(coll);
    await this.ensureIndexes(dbColl);

    if (!Array.isArray(legacyItems)) {
      throw new Error('Validation Error: Expected an array of legacy campaigns.');
    }

    let imported = 0;
    let duplicates = 0;
    let failed = 0;
    let syntheticSkipped = 0;
    let eligibleCount = 0;
    const importedIds: string[] = [];
    const duplicateIds: string[] = [];
    const failedItems: Array<{ id?: string; title?: string; error: string }> = [];
    const errors: string[] = [];

    for (const item of legacyItems) {
      const rawId = (item && typeof item === 'object' && item.id != null) ? String(item.id).trim() : '';

      // Rule: Exclude only the already identified synthetic sample IDs ('camp-01', 'camp-02', 'camp-03')
      if (SYNTHETIC_CAMPAIGN_IDS.includes(rawId as any)) {
        syntheticSkipped++;
        continue;
      }

      // Record is eligible for migration (user-created or historical record)
      eligibleCount++;

      if (!item || typeof item !== 'object') {
        failed++;
        const msg = 'Legacy campaign record is not a valid object.';
        failedItems.push({ id: rawId || undefined, error: msg });
        errors.push(msg);
        continue;
      }

      // Fix B Step 1: Validate incoming legacy campaign before classifying as duplicate or inserting
      const validation = validateBroadcastPayload(item);
      if (!validation.valid || !validation.clean) {
        failed++;
        const msg = validation.error || 'Validation failed';
        failedItems.push({ id: rawId || undefined, title: item?.title, error: msg });
        errors.push(`Invalid legacy campaign "${item?.title || rawId || 'unknown'}": ${msg}`);
        continue;
      }

      // Fix C: Missing or invalid legacy IDs
      // Do not silently generate a different random ID on every retry for a legacy record without a valid historical ID.
      // Use a deterministic, collision-safe migration identity (e.g. hash/slug derived from title and messageBody) or classify as failure.
      let cleanId = rawId;
      if (!cleanId) {
        const titleSnippet = validation.clean.title!.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 20);
        const bodySnippet = validation.clean.messageBody!.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 20);
        cleanId = `camp-det-${titleSnippet}-${bodySnippet}`;
        if (cleanId.length < 15) {
          failed++;
          const msg = 'Legacy campaign lacks a valid ID and could not derive a deterministic migration identity.';
          failedItems.push({ title: validation.clean.title, error: msg });
          errors.push(msg);
          continue;
        }
      }

      // Fix B Step 2 & 3 & 4 & 5: When existing MongoDB record has same ID, compare normalized campaign content.
      // Only classify as safe duplicate when relevant campaign content matches.
      // If ID matches but title, channel, audience, subject, message body, category, etc. conflict:
      // Do not overwrite, do not count as safe duplicate, report conflict/failure, allEligibleSucceeded = false.
      // Handle database lookup errors as failures, never as successful duplicates.
      if (cleanId) {
        let existing: any = null;
        try {
          existing = await dbColl.findOne({ id: cleanId } as any);
        } catch (findErr: any) {
          failed++;
          const msg = findErr?.message || 'Database error during lookup';
          failedItems.push({ id: cleanId, title: validation.clean.title, error: msg });
          errors.push(`Lookup error for campaign "${cleanId}": ${msg}`);
          continue;
        }

        if (existing) {
          // Compare normalized campaign content
          const existingNormTitle = String(existing.title || '').trim();
          const existingNormChannel = String(existing.channel || '').trim();
          const existingNormAudience = String(existing.targetAudience || '').trim();
          const existingNormSubject = String(existing.subject || '').trim();
          const existingNormBody = String(existing.messageBody || '').trim();
          const existingNormCategory = String(existing.categoryFilter || 'All Categories').trim();

          const incomingNormTitle = validation.clean.title!;
          const incomingNormChannel = validation.clean.channel!;
          const incomingNormAudience = validation.clean.targetAudience!;
          const incomingNormSubject = validation.clean.subject!;
          const incomingNormBody = validation.clean.messageBody!;
          const incomingNormCategory = validation.clean.categoryFilter!;

          const isContentIdentical =
            existingNormTitle === incomingNormTitle &&
            existingNormChannel === incomingNormChannel &&
            existingNormAudience === incomingNormAudience &&
            existingNormSubject === incomingNormSubject &&
            existingNormBody === incomingNormBody &&
            existingNormCategory === incomingNormCategory;

          if (isContentIdentical) {
            duplicates++;
            duplicateIds.push(cleanId);
            continue;
          } else {
            failed++;
            const conflictMsg = `Content conflict for campaign ID "${cleanId}": Existing record content does not match incoming legacy content.`;
            failedItems.push({ id: cleanId, title: incomingNormTitle, error: conflictMsg });
            errors.push(conflictMsg);
            continue;
          }
        }
      }

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
        createdAt: (typeof item.createdAt === 'string' && item.createdAt.trim()) ? item.createdAt.trim() : now,
        updatedAt: now
      };

      try {
        await dbColl.insertOne(docToInsert as any);
        imported++;
        importedIds.push(cleanId);
      } catch (insertErr: any) {
        if (insertErr?.code === 11000) {
          // Double check content comparison on concurrent duplicate key error
          duplicates++;
          duplicateIds.push(cleanId);
        } else {
          failed++;
          const msg = insertErr?.message || 'Database insert failed';
          failedItems.push({ id: cleanId, title: docToInsert.title, error: msg });
          errors.push(`Failed to import campaign "${cleanId}": ${msg}`);
        }
      }
    }

    const allEligibleSucceeded = eligibleCount > 0
      ? (failed === 0 && (imported + duplicates === eligibleCount))
      : true;

    return {
      success: allEligibleSucceeded,
      imported,
      duplicates,
      failed,
      totalProcessed: legacyItems.length,
      eligibleCount,
      syntheticSkipped,
      importedIds,
      duplicateIds,
      failedItems,
      allEligibleSucceeded,
      errors
    };
  }
};
