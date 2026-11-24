import { getMongoDb, getUsersCollection, isMongoConfigured } from '../mongodb';
import { UserRepository } from './UserRepository';

const isTest = () => process.env.IS_TEST === 'true';
const isMongoActive = () => isMongoConfigured() && !isTest();
let deliveryLogIndexesPromise: Promise<void> | null = null;

function operationKey(value: string): string {
  return Buffer.from(String(value || '').trim(), 'utf8').toString('base64url').slice(0, 220);
}

export class SubscriptionUsageRepository {
  /** Mongo-backed provider delivery history with 90-day retention. */
  static async logMessageDelivery(input: { eventId: string; userId: string; featureId: string; channel: string; provider: string; status: 'SENT' | 'FAILED' }): Promise<boolean> {
    if (!isMongoActive()) return false;
    const eventId = String(input.eventId || '').trim();
    const userId = String(input.userId || '').trim();
    if (!eventId || !userId) return false;
    const db = await getMongoDb();
    const coll = db.collection('subscription_message_delivery_logs');
    if (!deliveryLogIndexesPromise) {
      deliveryLogIndexesPromise = Promise.all([
        coll.createIndex({ eventId: 1, channel: 1 }, { unique: true }),
        coll.createIndex({ createdAt: 1 }, { expireAfterSeconds: 7776000 })
      ]).then(() => undefined).catch((error: any) => {
        deliveryLogIndexesPromise = null;
        throw error;
      });
    }
    await deliveryLogIndexesPromise;
    const now = new Date().toISOString();
    await coll.updateOne({ eventId, channel: input.channel }, {
      $set: {
        userId,
        featureId: input.featureId,
        channel: input.channel,
        provider: input.provider,
        status: input.status,
        lastAttemptAt: now
      },
      $setOnInsert: { eventId, createdAt: now },
      $inc: { attempts: 1 }
    }, { upsert: true });
    return true;
  }

  static async reserveMessageQuota(userId: string, featureId: string, eventId: string, now = new Date()): Promise<{ ok: boolean; reason: 'reserved' | 'already_processed' | 'unavailable' | 'quota_exhausted'; month: string }> {
    const allowed = ['email_alerts', 'whatsapp_alerts', 'sms_alerts'];
    const uid = String(userId || '').trim();
    const event = String(eventId || '').trim();
    if (!uid || !allowed.includes(featureId) || !event || event.length > 200) throw new Error('Valid user, channel and event reference are required.');
    const month = now.toISOString().slice(0, 7);
    const markerKey = featureId + '-' + operationKey(event);
    const marker = 'subscriptionMessageOperations.' + markerKey;
    const usagePath = 'subscriptionMessageUsage.' + featureId + '.' + month + '.used';
    const enabledPath = 'subscriptionEntitlements.' + featureId + '.enabled';
    const expiryPath = 'subscriptionEntitlements.' + featureId + '.expiresAt';
    const unlimitedPath = 'subscriptionEntitlements.' + featureId + '.unlimitedMessages';
    const quotaPath = 'subscriptionEntitlements.' + featureId + '.monthlyMessageQuota';
    const nowIso = now.toISOString();

    if (isMongoActive()) {
      const coll = await getUsersCollection();
      const updated = await coll.findOneAndUpdate({
        id: uid,
        membershipStatus: 'Active',
        subscriptionExpiresAt: { $gt: nowIso },
        $or: [
          { [enabledPath]: true, [expiryPath]: { $gt: nowIso } },
          { subscriptionFeatureIds: { $exists: false } },
          { subscriptionFeatureIds: { $size: 0 } },
          { subscriptionFeatureIds: featureId, [enabledPath]: { $exists: false } }
        ],
        [marker]: { $nin: ['RESERVED', 'SENT'] },
        $expr: { $or: [
          { $eq: [{ $ifNull: ['$' + unlimitedPath, false] }, true] },
          { $and: [
            { $eq: [{ $type: '$' + unlimitedPath }, 'missing'] },
            { $eq: [{ $type: '$' + quotaPath }, 'missing'] }
          ] },
          { $lt: [{ $ifNull: ['$' + usagePath, 0] }, { $ifNull: ['$' + quotaPath, 0] }] }
        ] }
      }, {
        $inc: { [usagePath]: 1 },
        $set: { [marker]: 'RESERVED', updatedAt: nowIso }
      }, { returnDocument: 'after', includeResultMetadata: false } as any);
      if (updated) return { ok: true, reason: 'reserved', month };
      const current = await coll.findOne({ id: uid });
      if (!current) return { ok: false, reason: 'unavailable', month };
      if (current.subscriptionMessageOperations?.[markerKey] === 'RESERVED' || current.subscriptionMessageOperations?.[markerKey] === 'SENT') return { ok: false, reason: 'already_processed', month };
      const legacyAccess = !Array.isArray(current.subscriptionFeatureIds) || current.subscriptionFeatureIds.length === 0;
      const entitlement = current.subscriptionEntitlements?.[featureId];
      const legacyEntitlement = legacyAccess || (!entitlement && current.subscriptionFeatureIds?.includes(featureId));
      const featureExpiry = Date.parse(String(entitlement?.expiresAt || ''));
      const membershipExpiry = Date.parse(String(current.subscriptionExpiresAt || ''));
      if (current.membershipStatus !== 'Active' || !Number.isFinite(membershipExpiry) || membershipExpiry <= now.getTime() ||
          (!legacyEntitlement && (entitlement?.enabled !== true || !Number.isFinite(featureExpiry) || featureExpiry <= now.getTime()))) return { ok: false, reason: 'unavailable', month };
      return { ok: false, reason: 'quota_exhausted', month };
    }

    const user = await UserRepository.getByIdAsync(uid);
    if (!user) return { ok: false, reason: 'unavailable', month };
    const ops = user.subscriptionMessageOperations || {};
    if (ops[markerKey] === 'RESERVED' || ops[markerKey] === 'SENT') return { ok: false, reason: 'already_processed', month };
    const entitlement = user.subscriptionEntitlements?.[featureId];
    const featureExpiry = Date.parse(String(entitlement?.expiresAt || ''));
    const membershipExpiry = Date.parse(String(user.subscriptionExpiresAt || ''));
    const legacyAccess = !Array.isArray(user.subscriptionFeatureIds) || user.subscriptionFeatureIds.length === 0;
    const legacyEntitlement = legacyAccess || (!entitlement && user.subscriptionFeatureIds?.includes(featureId));
    if (user.membershipStatus !== 'Active' || !Number.isFinite(membershipExpiry) || membershipExpiry <= now.getTime() ||
        (!legacyEntitlement && (entitlement?.enabled !== true || !Number.isFinite(featureExpiry) || featureExpiry <= now.getTime()))) return { ok: false, reason: 'unavailable', month };
    const usage = user.subscriptionMessageUsage || {};
    const used = Number(usage[featureId]?.[month]?.used) || 0;
    const quota = Number(entitlement?.monthlyMessageQuota);
    const legacyUnmetered = legacyEntitlement || !entitlement || (entitlement.unlimitedMessages === undefined && entitlement.monthlyMessageQuota === undefined);
    if (!legacyUnmetered && entitlement.unlimitedMessages !== true && (!Number.isInteger(quota) || quota <= 0 || used >= quota)) return { ok: false, reason: 'quota_exhausted', month };
    await UserRepository.updateAsync(uid, {
      subscriptionMessageUsage: { ...usage, [featureId]: { ...(usage[featureId] || {}), [month]: { ...(usage[featureId]?.[month] || {}), used: used + 1 } } },
      subscriptionMessageOperations: { ...ops, [markerKey]: 'RESERVED' }
    });
    return { ok: true, reason: 'reserved', month };
  }

  static async completeMessageQuota(userId: string, featureId: string, eventId: string): Promise<boolean> {
    const uid = String(userId || '').trim();
    const markerKey = featureId + '-' + operationKey(eventId);
    const marker = 'subscriptionMessageOperations.' + markerKey;
    const now = new Date().toISOString();
    if (isMongoActive()) {
      const coll = await getUsersCollection();
      const result = await coll.updateOne({ id: uid, [marker]: 'RESERVED' }, { $set: { [marker]: 'SENT', updatedAt: now } });
      if (result.modifiedCount === 1) return true;
      return Boolean(await coll.findOne({ id: uid, [marker]: 'SENT' }));
    }
    const user = await UserRepository.getByIdAsync(uid);
    if (!user) return false;
    if (user.subscriptionMessageOperations?.[markerKey] === 'SENT') return true;
    if (user.subscriptionMessageOperations?.[markerKey] !== 'RESERVED') return false;
    await UserRepository.updateAsync(uid, { subscriptionMessageOperations: { ...user.subscriptionMessageOperations, [markerKey]: 'SENT' } });
    return true;
  }

  static async releaseMessageQuota(userId: string, featureId: string, eventId: string, month: string): Promise<boolean> {
    const uid = String(userId || '').trim();
    const markerKey = featureId + '-' + operationKey(eventId);
    const marker = 'subscriptionMessageOperations.' + markerKey;
    const usagePath = 'subscriptionMessageUsage.' + featureId + '.' + month + '.used';
    const now = new Date().toISOString();
    if (isMongoActive()) {
      const coll = await getUsersCollection();
      const result = await coll.updateOne({ id: uid, [marker]: 'RESERVED', [usagePath]: { $gt: 0 } }, {
        $inc: { [usagePath]: -1 }, $set: { [marker]: 'FAILED', updatedAt: now }
      });
      if (result.modifiedCount === 1) return true;
      return Boolean(await coll.findOne({ id: uid, [marker]: 'FAILED' }));
    }
    const user = await UserRepository.getByIdAsync(uid);
    if (!user) return false;
    if (user.subscriptionMessageOperations?.[markerKey] === 'FAILED') return true;
    if (user.subscriptionMessageOperations?.[markerKey] !== 'RESERVED') return false;
    const usage = user.subscriptionMessageUsage || {};
    const used = Math.max(0, (Number(usage[featureId]?.[month]?.used) || 0) - 1);
    await UserRepository.updateAsync(uid, {
      subscriptionMessageUsage: { ...usage, [featureId]: { ...(usage[featureId] || {}), [month]: { ...(usage[featureId]?.[month] || {}), used } } },
      subscriptionMessageOperations: { ...user.subscriptionMessageOperations, [markerKey]: 'FAILED' }
    });
    return true;
  }

  static async consumeCampaignCredit(userId: string, placement: string, durationHours: number, campaignId: string, smsRecipientsCount = 0): Promise<{ user: any; credit: any } | null> {
    const uid = String(userId || '').trim();
    const cleanPlacement = String(placement || '').trim();
    const campaign = String(campaignId || '').trim();
    if (!uid || !cleanPlacement || !Number.isInteger(durationHours) || durationHours < 1 || durationHours > 8760 ||
        !campaign || campaign.length > 200 ||
        (cleanPlacement === 'sms-broadcast' && (!Number.isInteger(smsRecipientsCount) || smsRecipientsCount < 1 || smsRecipientsCount > 100000))) {
      throw new Error('Valid user, campaign placement, duration and campaign reference are required.');
    }
    const markerKey = operationKey(campaign);
    const marker = 'subscriptionCampaignOperations.' + markerKey;
    const now = new Date().toISOString();
    const creditsPath = 'subscriptionEntitlements.campaign_credits.campaignCredits';
    const creditQuery = { placement: cleanPlacement, durationHours, ...(cleanPlacement === 'sms-broadcast' ? { smsRecipientsCount } : {}), remaining: { $gt: 0 } };
    if (isMongoActive()) {
      const coll = await getUsersCollection();
      const updatedDoc = await coll.findOneAndUpdate({
        id: uid, membershipStatus: 'Active', subscriptionExpiresAt: { $gt: now },
        'subscriptionEntitlements.campaign_credits.enabled': true,
        'subscriptionEntitlements.campaign_credits.expiresAt': { $gt: now },
        [creditsPath]: { $elemMatch: creditQuery },
        [marker]: { $ne: 'CONSUMED' }
      }, {
        $inc: { 'subscriptionEntitlements.campaign_credits.campaignCredits.$[credit].remaining': -1 },
        $set: { [marker]: 'CONSUMED', updatedAt: now }
      } as any, {
        returnDocument: 'after', includeResultMetadata: false,
        arrayFilters: [{
          'credit.placement': cleanPlacement, 'credit.durationHours': durationHours,
          ...(cleanPlacement === 'sms-broadcast' ? { 'credit.smsRecipientsCount': smsRecipientsCount } : {}),
          'credit.remaining': { $gt: 0 }
        }]
      } as any);
      if (!updatedDoc) {
        const previouslyConsumed = await coll.findOne({ id: uid, [marker]: 'CONSUMED' });
        if (!previouslyConsumed) return null;
        const { _id, ...safePrevious } = previouslyConsumed;
        return { user: safePrevious, credit: { placement: cleanPlacement, durationHours, smsRecipientsCount, campaignId: campaign } };
      }
      const { _id, ...safe } = updatedDoc;
      return { user: safe, credit: { placement: cleanPlacement, durationHours, smsRecipientsCount, campaignId: campaign } };
    }
    const user = await UserRepository.getByIdAsync(uid);
    if (!user) return null;
    const ops = user.subscriptionCampaignOperations || {};
    if (ops[markerKey] === 'CONSUMED') return { user, credit: { placement: cleanPlacement, durationHours, smsRecipientsCount, campaignId: campaign } };
    if (ops[markerKey] === 'RESTORED') return null;
    const membershipExpiry = Date.parse(String(user.subscriptionExpiresAt || ''));
    const featureExpiry = Date.parse(String(user.subscriptionEntitlements?.campaign_credits?.expiresAt || ''));
    if (user.membershipStatus !== 'Active' || !Number.isFinite(membershipExpiry) || membershipExpiry <= Date.now() ||
        user.subscriptionEntitlements?.campaign_credits?.enabled !== true ||
        !Number.isFinite(featureExpiry) || featureExpiry <= Date.now()) return null;
    const credits = user.subscriptionEntitlements.campaign_credits.campaignCredits || [];
    const index = credits.findIndex((item: any) => item?.placement === cleanPlacement &&
      Number(item?.durationHours) === durationHours &&
      (cleanPlacement !== 'sms-broadcast' || Number(item?.smsRecipientsCount) === smsRecipientsCount) &&
      Number(item?.remaining) > 0);
    if (index < 0) return null;
    const updatedCredits = credits.map((item: any, i: number) => i === index ? { ...item, remaining: Number(item.remaining) - 1 } : item);
    const updated = await UserRepository.updateAsync(uid, {
      subscriptionEntitlements: { ...user.subscriptionEntitlements, campaign_credits: { ...user.subscriptionEntitlements.campaign_credits, campaignCredits: updatedCredits } },
      subscriptionCampaignOperations: { ...ops, [markerKey]: 'CONSUMED' }
    });
    return updated ? { user: updated, credit: { placement: cleanPlacement, durationHours, smsRecipientsCount, campaignId: campaign } } : null;
  }

  static async restoreCampaignCredit(userId: string, placement: string, durationHours: number, campaignId: string, smsRecipientsCount = 0): Promise<boolean> {
    const uid = String(userId || '').trim();
    const cleanPlacement = String(placement || '').trim();
    const markerKey = operationKey(campaignId);
    const marker = 'subscriptionCampaignOperations.' + markerKey;
    const now = new Date().toISOString();
    if (!uid || !cleanPlacement || !Number.isInteger(durationHours) || durationHours < 1 || !markerKey) return false;
    if (isMongoActive()) {
      const coll = await getUsersCollection();
      const result = await coll.updateOne({ id: uid, [marker]: 'CONSUMED' }, {
        $inc: { 'subscriptionEntitlements.campaign_credits.campaignCredits.$[credit].remaining': 1 },
        $set: { [marker]: 'RESTORED', updatedAt: now }
      } as any, {
        arrayFilters: [{
          'credit.placement': cleanPlacement, 'credit.durationHours': durationHours,
          ...(cleanPlacement === 'sms-broadcast' ? { 'credit.smsRecipientsCount': smsRecipientsCount } : {})
        }]
      } as any);
      if (result.modifiedCount === 1) return true;
      return Boolean(await coll.findOne({ id: uid, [marker]: 'RESTORED' }));
    }
    const user = await UserRepository.getByIdAsync(uid);
    if (!user) return false;
    if (user.subscriptionCampaignOperations?.[markerKey] === 'RESTORED') return true;
    if (user.subscriptionCampaignOperations?.[markerKey] !== 'CONSUMED') return false;
    const credits = user.subscriptionEntitlements?.campaign_credits?.campaignCredits || [];
    let restored = false;
    const updatedCredits = credits.map((item: any) => {
      if (!restored && item?.placement === cleanPlacement && Number(item?.durationHours) === durationHours &&
          (cleanPlacement !== 'sms-broadcast' || Number(item?.smsRecipientsCount) === smsRecipientsCount)) {
        restored = true;
        return { ...item, remaining: Number(item.remaining || 0) + 1 };
      }
      return item;
    });
    if (!restored) return false;
    const updated = await UserRepository.updateAsync(uid, {
      subscriptionEntitlements: { ...user.subscriptionEntitlements, campaign_credits: { ...user.subscriptionEntitlements.campaign_credits, campaignCredits: updatedCredits } },
      subscriptionCampaignOperations: { ...user.subscriptionCampaignOperations, [markerKey]: 'RESTORED' }
    });
    return Boolean(updated);
  }
}
