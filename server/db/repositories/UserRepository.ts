import { Database } from '../database';
import { getMongoClient, getUsersCollection, isMongoConfigured } from '../mongodb';

const isTest = () => process.env.IS_TEST === 'true';
const isMongoActive = () => isMongoConfigured() && !isTest();
const inMemoryUsers = new Map<string, any>();

export interface RoleMutationParams {
  targetUserId: string;
  newRole: string;
  actorId: string;
  actorRoleFallback?: string;
  newPermissions: string[];
}

export interface RoleMutationResult {
  ok: boolean;
  status: number;
  message: string;
  user?: any;
  actor?: any;
  actorRole?: string;
  oldRole?: string;
  newRole?: string;
  permissions?: string[];
}

class RoleGuardRejectionError extends Error {
  public readonly result: RoleMutationResult;
  constructor(result: RoleMutationResult) {
    super(result.message);
    this.name = 'RoleGuardRejectionError';
    this.result = result;
  }
}

export class UserRepository {
  private static roleMutationQueue: Promise<any> = Promise.resolve();
  static getAll(): any[] {
    if (isTest()) return Array.from(inMemoryUsers.values());
    return Database.getUsers();
  }

  static async getAllAsync(): Promise<any[]> {
    if (isTest()) return Array.from(inMemoryUsers.values());
    if (isMongoActive()) {
      const coll = await getUsersCollection();
      const users = await coll.find({}).sort({ createdAt: -1 }).toArray();
      return (users || []).map(u => {
        const { _id, ...safe } = u;
        return safe;
      });
    }
    return Database.getUsers();
  }

  static getById(id: string): any | null {
    if (isTest()) return inMemoryUsers.get(id) || null;
    return Database.getUserById(id);
  }

  static async getByIdAsync(id: string): Promise<any | null> {
    if (!id) return null;
    if (isTest()) return inMemoryUsers.get(id) || null;
    if (isMongoActive()) {
      const coll = await getUsersCollection();
      const user = await coll.findOne({ id });
      if (user) {
        const { _id, ...safe } = user;
        return safe;
      }
      return null;
    }
    return Database.getUserById(id);
  }

  static getByEmail(email: string): any | null {
    if (!email) return null;
    if (isTest()) {
      const normalized = email.toLowerCase().trim();
      return Array.from(inMemoryUsers.values()).find(u => u.email?.toLowerCase().trim() === normalized) || null;
    }
    return Database.getUserByEmail(email);
  }

  static async getByEmailAsync(email: string): Promise<any | null> {
    if (!email) return null;
    if (isTest()) {
      const normalized = email.toLowerCase().trim();
      return Array.from(inMemoryUsers.values()).find(u => u.email?.toLowerCase().trim() === normalized) || null;
    }
    if (isMongoActive()) {
      const coll = await getUsersCollection();
      const user = await coll.findOne({ email: email.toLowerCase().trim() });
      if (user) {
        const { _id, ...safe } = user;
        return safe;
      }
      return null;
    }
    return Database.getUserByEmail(email);
  }

  /**
   * Asynchronously creates a new user.
   * When MongoDB is configured, writes strictly to MongoDB and returns the authoritative user.
   */
  static async createAsync(userData: any): Promise<any> {
    const id = userData.id || `user-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    let initialWalletBalance = 0;
    if (userData?.walletBalance !== undefined) {
      if (
        typeof userData.walletBalance !== 'number' ||
        !Number.isFinite(userData.walletBalance) ||
        userData.walletBalance < 0
      ) {
        throw new Error('Invalid walletBalance: must be a finite non-negative number.');
      }
      initialWalletBalance = userData.walletBalance;
    }

    const { _id: _ignoredId, ...cleanUserData } = userData || {};
    delete cleanUserData.walletEscrowBalance;
    delete cleanUserData.walletEscrowOperations;
    const userToSave = {
      ...cleanUserData,
      id,
      walletBalance: initialWalletBalance,
      walletEscrowBalance: 0,
      createdAt: userData?.createdAt || new Date().toISOString(),
      updatedAt: userData?.updatedAt || new Date().toISOString()
    };

    if (isTest()) {
      inMemoryUsers.set(id, userToSave);
      return userToSave;
    }

    if (isMongoActive()) {
      const coll = await getUsersCollection();
      await coll.insertOne({ ...userToSave });
      return userToSave;
    }

    return Database.addUser(userToSave);
  }

  static create(userData: any): any {
    const safeUserData = { ...(userData || {}) };
    delete safeUserData.walletEscrowBalance;
    delete safeUserData.walletEscrowOperations;
    if (isTest()) {
      const id = safeUserData.id || `user-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
      const user = { ...safeUserData, id, walletEscrowBalance: 0 };
      inMemoryUsers.set(id, user);
      return user;
    }
    if (isMongoActive()) {
      throw new Error('MongoDB is configured. Synchronous create is prohibited to ensure authoritative persistence; use createAsync.');
    }
    return Database.addUser({ ...safeUserData, walletEscrowBalance: 0 });
  }

  /**
   * Asynchronously updates a user.
   * When MongoDB is configured, writes strictly to MongoDB and returns the authoritative updated user.
   */
  static async updateAsync(id: string, updates: any): Promise<any | null> {
    const safeUpdates = { ...(updates || {}) };
    delete safeUpdates._id;
    const updatePayload = {
      ...safeUpdates,
      updatedAt: new Date().toISOString()
    };

    if (isTest()) {
      const existing = inMemoryUsers.get(id);
      if (!existing) return null;
      const updated = { ...existing, ...updatePayload };
      inMemoryUsers.set(id, updated);
      return updated;
    }

    if (isMongoActive()) {
      const coll = await getUsersCollection();
      const updatedDoc = await coll.findOneAndUpdate(
        { id },
        { $set: updatePayload },
        { returnDocument: 'after' }
      );
      if (updatedDoc) {
        const { _id, ...safe } = updatedDoc;
        return safe;
      }
      return null;
    }

    return Database.updateUser(id, updates);
  }

  /**
   * Atomically deducts a positive amount from a user's walletBalance.
   * Enforces sufficient balance via MongoDB filter { id: userId, walletBalance: { $gte: amount } }
   * and mutates balance via atomic $inc: { walletBalance: -amount }.
   * Returns the updated user (without _id), or null if user does not exist or has insufficient balance.
   */
  static async deductWalletBalanceAsync(
    userId: string,
    amount: number,
    extraUpdates?: Record<string, any>
  ): Promise<any | null> {
    const cleanUserId = typeof userId === 'string' ? userId.trim() : '';
    if (!cleanUserId) {
      throw new Error('Valid userId is required for wallet deduction.');
    }
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
      throw new Error('Wallet deduction amount must be a finite number strictly greater than 0.');
    }

    const safeExtraUpdates: Record<string, any> = { ...(extraUpdates || {}) };
    delete safeExtraUpdates._id;
    delete safeExtraUpdates.id;
    delete safeExtraUpdates.walletBalance;
    const setPayload: Record<string, any> = {
      ...safeExtraUpdates,
      updatedAt: new Date().toISOString()
    };

    if (isTest()) {
      const existing = inMemoryUsers.get(cleanUserId);
      if (!existing || (existing.walletBalance || 0) < amount) return null;
      const updated = {
        ...existing,
        ...setPayload,
        walletBalance: (existing.walletBalance || 0) - amount
      };
      inMemoryUsers.set(cleanUserId, updated);
      return updated;
    }

    if (isMongoActive()) {
      const coll = await getUsersCollection();
      const updatedDoc = await coll.findOneAndUpdate(
        { id: cleanUserId, walletBalance: { $gte: amount } },
        {
          $inc: { walletBalance: -amount },
          $set: setPayload
        },
        { returnDocument: 'after' }
      );
      if (!updatedDoc) {
        return null;
      }
      if (
        typeof updatedDoc.walletBalance !== 'number' ||
        !Number.isFinite(updatedDoc.walletBalance) ||
        updatedDoc.walletBalance < 0
      ) {
        throw new Error(`Invalid walletBalance state on user ${cleanUserId}.`);
      }
      const { _id, ...safe } = updatedDoc;
      return safe;
    }

    const existingUser = Database.getUserById(cleanUserId);
    if (!existingUser) {
      return null;
    }
    if (
      typeof existingUser.walletBalance !== 'number' ||
      !Number.isFinite(existingUser.walletBalance) ||
      existingUser.walletBalance < 0
    ) {
      throw new Error(`Invalid stored walletBalance for user ${cleanUserId}.`);
    }
    if (existingUser.walletBalance < amount) {
      return null;
    }

    return Database.updateUser(cleanUserId, {
      ...setPayload,
      walletBalance: existingUser.walletBalance - amount
    });
  }

  /** Atomically consumes one purchased posting slot and records the job redemption key. */
  static async consumeSubscriptionFeatureSlotAsync(userId: string, featureId: string, jobId: string): Promise<any | null> {
    const cleanUserId = String(userId || '').trim();
    const cleanFeatureId = String(featureId || '').trim();
    const cleanJobId = String(jobId || '').trim();
    const allowed = new Set(['urgent_job_posting', 'featured_job_posting', 'premium_job_posting']);
    if (!cleanUserId || !allowed.has(cleanFeatureId) || !cleanJobId || cleanJobId.length > 200) {
      throw new Error('Valid user, posting feature and job references are required.');
    }
    const markerKey = ('slot-' + cleanFeatureId + '-' + cleanJobId).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
    const marker = 'subscriptionSlotOperations.' + markerKey;
    const slotsPath = 'subscriptionEntitlements.' + cleanFeatureId + '.remainingSlots';
    const enabledPath = 'subscriptionEntitlements.' + cleanFeatureId + '.enabled';
    const expiryPath = 'subscriptionEntitlements.' + cleanFeatureId + '.expiresAt';
    const now = new Date().toISOString();

    if (isTest()) {
      const existing = inMemoryUsers.get(cleanUserId);
      if (!existing) return null;
      const operations = existing.subscriptionSlotOperations || {};
      if (operations[markerKey] === 'CONSUMED') return existing;
      const entitlement = existing.subscriptionEntitlements?.[cleanFeatureId];
      const membershipExpiry = Date.parse(String(existing.subscriptionExpiresAt || ''));
      const featureExpiry = Date.parse(String(entitlement?.expiresAt || ''));
      if (existing.membershipStatus !== 'Active' || !Number.isFinite(membershipExpiry) || membershipExpiry <= Date.now() ||
          entitlement?.enabled !== true || !Number.isFinite(featureExpiry) || featureExpiry <= Date.now() ||
          !Number.isInteger(Number(entitlement.remainingSlots)) || Number(entitlement.remainingSlots) <= 0) return null;
      const updated = {
        ...existing,
        subscriptionEntitlements: {
          ...existing.subscriptionEntitlements,
          [cleanFeatureId]: { ...entitlement, remainingSlots: Number(entitlement.remainingSlots) - 1 }
        },
        subscriptionSlotOperations: { ...operations, [markerKey]: 'CONSUMED' },
        updatedAt: now
      };
      inMemoryUsers.set(cleanUserId, updated);
      return updated;
    }

    if (isMongoActive()) {
      const coll = await getUsersCollection();
      const updatedDoc = await coll.findOneAndUpdate(
        {
          id: cleanUserId,
          membershipStatus: 'Active',
          subscriptionExpiresAt: { $gt: now },
          [enabledPath]: true,
          [expiryPath]: { $gt: now },
          [slotsPath]: { $gt: 0 },
          [marker]: { $ne: 'CONSUMED' }
        },
        { $inc: { [slotsPath]: -1 }, $set: { [marker]: 'CONSUMED', updatedAt: now } },
        { returnDocument: 'after' }
      );
      if (updatedDoc) {
        const { _id, ...safe } = updatedDoc;
        return safe;
      }
      const existing = await coll.findOne({ id: cleanUserId, [marker]: 'CONSUMED' });
      if (existing) {
        const { _id, ...safe } = existing;
        return safe;
      }
      return null;
    }

    const existing = Database.getUserById(cleanUserId);
    if (!existing) return null;
    const operations = existing.subscriptionSlotOperations || {};
    if (operations[markerKey] === 'CONSUMED') return existing;
    const entitlement = existing.subscriptionEntitlements?.[cleanFeatureId];
    const membershipExpiry = Date.parse(String(existing.subscriptionExpiresAt || ''));
    const featureExpiry = Date.parse(String(entitlement?.expiresAt || ''));
    if (existing.membershipStatus !== 'Active' || !Number.isFinite(membershipExpiry) || membershipExpiry <= Date.now() ||
        entitlement?.enabled !== true || !Number.isFinite(featureExpiry) || featureExpiry <= Date.now() ||
        !Number.isInteger(Number(entitlement.remainingSlots)) || Number(entitlement.remainingSlots) <= 0) return null;
    return Database.updateUser(cleanUserId, {
      subscriptionEntitlements: {
        ...existing.subscriptionEntitlements,
        [cleanFeatureId]: { ...entitlement, remainingSlots: Number(entitlement.remainingSlots) - 1 }
      },
      subscriptionSlotOperations: { ...operations, [markerKey]: 'CONSUMED' },
      updatedAt: now
    });
  }

  /** Compensates a slot redemption if the pending job update fails. */
  static async restoreSubscriptionFeatureSlotAsync(userId: string, featureId: string, jobId: string): Promise<any | null> {
    const cleanUserId = String(userId || '').trim();
    const cleanFeatureId = String(featureId || '').trim();
    const cleanJobId = String(jobId || '').trim();
    const allowed = new Set(['urgent_job_posting', 'featured_job_posting', 'premium_job_posting']);
    if (!cleanUserId || !allowed.has(cleanFeatureId) || !cleanJobId) throw new Error('Valid slot restoration references are required.');
    const markerKey = ('slot-' + cleanFeatureId + '-' + cleanJobId).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
    const marker = 'subscriptionSlotOperations.' + markerKey;
    const slotsPath = 'subscriptionEntitlements.' + cleanFeatureId + '.remainingSlots';
    const now = new Date().toISOString();

    if (isTest()) {
      const existing = inMemoryUsers.get(cleanUserId);
      if (!existing) return null;
      const operations = existing.subscriptionSlotOperations || {};
      if (operations[markerKey] === 'REFUNDED') return existing;
      if (operations[markerKey] !== 'CONSUMED') return null;
      const entitlement = existing.subscriptionEntitlements?.[cleanFeatureId];
      if (!entitlement) return null;
      const updated = {
        ...existing,
        subscriptionEntitlements: {
          ...existing.subscriptionEntitlements,
          [cleanFeatureId]: { ...entitlement, remainingSlots: Math.max(0, Number(entitlement.remainingSlots) || 0) + 1 }
        },
        subscriptionSlotOperations: { ...operations, [markerKey]: 'REFUNDED' },
        updatedAt: now
      };
      inMemoryUsers.set(cleanUserId, updated);
      return updated;
    }

    if (isMongoActive()) {
      const coll = await getUsersCollection();
      const updatedDoc = await coll.findOneAndUpdate(
        { id: cleanUserId, [marker]: 'CONSUMED' },
        { $inc: { [slotsPath]: 1 }, $set: { [marker]: 'REFUNDED', updatedAt: now } },
        { returnDocument: 'after' }
      );
      if (updatedDoc) {
        const { _id, ...safe } = updatedDoc;
        return safe;
      }
      const existing = await coll.findOne({ id: cleanUserId, [marker]: 'REFUNDED' });
      if (existing) {
        const { _id, ...safe } = existing;
        return safe;
      }
      return null;
    }

    const existing = Database.getUserById(cleanUserId);
    if (!existing) return null;
    const operations = existing.subscriptionSlotOperations || {};
    if (operations[markerKey] === 'REFUNDED') return existing;
    if (operations[markerKey] !== 'CONSUMED') return null;
    const entitlement = existing.subscriptionEntitlements?.[cleanFeatureId];
    if (!entitlement) return null;
    return Database.updateUser(cleanUserId, {
      subscriptionEntitlements: {
        ...existing.subscriptionEntitlements,
        [cleanFeatureId]: { ...entitlement, remainingSlots: Math.max(0, Number(entitlement.remainingSlots) || 0) + 1 }
      },
      subscriptionSlotOperations: { ...operations, [markerKey]: 'REFUNDED' },
      updatedAt: now
    });
  }

  /**
   * Idempotently deducts wallet funds for a durable operation such as subscription auto-renewal.
   * The operation marker and wallet debit are written atomically in MongoDB.
   */
  static async deductWalletBalanceOnceAsync(
    userId: string,
    amount: number,
    operationKey: string,
    extraUpdates?: Record<string, any>,
    expectedState?: Record<string, any>
  ): Promise<any | null> {
    const cleanUserId = String(userId || '').trim();
    const cleanKey = String(operationKey || '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
    if (!cleanUserId || !cleanKey) throw new Error('Valid user and wallet operation references are required.');
    if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error('Wallet deduction must be a positive whole PKR amount.');
    const marker = `walletEscrowOperations.${cleanKey}`;
    const updatedAt = new Date().toISOString();
    const setPayload: Record<string, any> = { ...(extraUpdates || {}), [marker]: 'DEDUCTED', updatedAt };
    delete setPayload._id;
    delete setPayload.id;
    delete setPayload.walletBalance;
    if (isTest()) {
      const existing = inMemoryUsers.get(cleanUserId);
      if (!existing) return null;
      if (expectedState && Object.entries(expectedState).some(([key, value]) => existing[key] !== value)) return null;
      const operations = existing.walletEscrowOperations || {};
      if (operations[cleanKey] === 'DEDUCTED') return existing;
      const balance = Number(existing.walletBalance || 0);
      if (!Number.isFinite(balance) || balance < amount) return null;
      const updated = {
        ...existing,
        ...extraUpdates,
        walletBalance: balance - amount,
        walletEscrowOperations: { ...operations, [cleanKey]: 'DEDUCTED' },
        updatedAt
      };
      inMemoryUsers.set(cleanUserId, updated);
      return updated;
    }
    if (isMongoActive()) {
      const coll = await getUsersCollection();
      const updatedDoc = await coll.findOneAndUpdate(
        { id: cleanUserId, walletBalance: { $gte: amount }, ...(expectedState || {}), [marker]: { $ne: 'DEDUCTED' } },
        { $inc: { walletBalance: -amount }, $set: setPayload },
        { returnDocument: 'after' }
      );
      if (updatedDoc) {
        const { _id, ...safe } = updatedDoc;
        return safe;
      }
      const existing = await coll.findOne({ id: cleanUserId, [marker]: 'DEDUCTED' });
      if (existing) {
        const { _id, ...safe } = existing;
        return safe;
      }
      return null;
    }
    const existing = Database.getUserById(cleanUserId);
    if (!existing) return null;
    if (expectedState && Object.entries(expectedState).some(([key, value]) => existing[key] !== value)) return null;
    const operations = existing.walletEscrowOperations || {};
    if (operations[cleanKey] === 'DEDUCTED') return existing;
    const balance = Number(existing.walletBalance || 0);
    if (!Number.isFinite(balance) || balance < amount) return null;
    return Database.updateUser(cleanUserId, {
      ...extraUpdates,
      walletBalance: balance - amount,
      walletEscrowOperations: { ...operations, [cleanKey]: 'DEDUCTED' },
      updatedAt
    });
  }

  /**
   * Atomically credits a positive amount to a user's walletBalance.
   * Mutates balance via atomic MongoDB $inc: { walletBalance: amount }.
   * Returns the updated user (without _id), or null if user does not exist.
   */
  static async creditWalletBalanceAsync(
    userId: string,
    amount: number,
    extraUpdates?: Record<string, any>
  ): Promise<any | null> {
    const cleanUserId = typeof userId === 'string' ? userId.trim() : '';
    if (!cleanUserId) {
      throw new Error('Valid userId is required for wallet credit.');
    }
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
      throw new Error('Wallet credit amount must be a finite number strictly greater than 0.');
    }

    const safeExtraUpdates: Record<string, any> = { ...(extraUpdates || {}) };
    delete safeExtraUpdates._id;
    delete safeExtraUpdates.id;
    delete safeExtraUpdates.walletBalance;
    const setPayload: Record<string, any> = {
      ...safeExtraUpdates,
      updatedAt: new Date().toISOString()
    };

    if (isTest()) {
      const existing = inMemoryUsers.get(cleanUserId);
      if (!existing) return null;
      const updated = {
        ...existing,
        ...setPayload,
        walletBalance: (existing.walletBalance || 0) + amount
      };
      inMemoryUsers.set(cleanUserId, updated);
      return updated;
    }

    if (isMongoActive()) {
      const coll = await getUsersCollection();
      const updatedDoc = await coll.findOneAndUpdate(
        { id: cleanUserId },
        {
          $inc: { walletBalance: amount },
          $set: setPayload
        },
        { returnDocument: 'after' }
      );
      if (!updatedDoc) {
        return null;
      }
      if (
        typeof updatedDoc.walletBalance !== 'number' ||
        !Number.isFinite(updatedDoc.walletBalance) ||
        updatedDoc.walletBalance < 0
      ) {
        throw new Error(`Invalid walletBalance state on user ${cleanUserId}.`);
      }
      const { _id, ...safe } = updatedDoc;
      return safe;
    }

    const existingUser = Database.getUserById(cleanUserId);
    if (!existingUser) {
      return null;
    }
    if (
      typeof existingUser.walletBalance !== 'number' ||
      !Number.isFinite(existingUser.walletBalance) ||
      existingUser.walletBalance < 0
    ) {
      throw new Error(`Invalid stored walletBalance for user ${cleanUserId}.`);
    }

    return Database.updateUser(cleanUserId, {
      ...setPayload,
      walletBalance: existingUser.walletBalance + amount
    });
  }

  /** Atomically move available wallet funds into campaign escrow exactly once. */
  static async holdWalletBalanceInEscrowAsync(userId: string, amount: number, operationKey: string): Promise<any | null> {
    const cleanUserId = String(userId || '').trim();
    const cleanKey = String(operationKey || '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
    if (!cleanUserId || !cleanKey) throw new Error('Valid user and escrow operation references are required.');
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('Escrow hold amount must be greater than zero.');
    const marker = `walletEscrowOperations.${cleanKey}`;
    const updatedAt = new Date().toISOString();

    if (isTest()) {
      const existing = inMemoryUsers.get(cleanUserId);
      if (!existing) return null;
      const operations = existing.walletEscrowOperations || {};
      if (operations[cleanKey] === 'HELD') return existing;
      const balance = Number(existing.walletBalance || 0);
      if (!Number.isFinite(balance) || balance < amount) return null;
      const updated = {
        ...existing,
        walletBalance: balance - amount,
        walletEscrowBalance: Number(existing.walletEscrowBalance || 0) + amount,
        walletEscrowOperations: { ...operations, [cleanKey]: 'HELD' },
        updatedAt
      };
      inMemoryUsers.set(cleanUserId, updated);
      return updated;
    }

    if (isMongoActive()) {
      const coll = await getUsersCollection();
      const updatedDoc = await coll.findOneAndUpdate(
        { id: cleanUserId, walletBalance: { $gte: amount }, [marker]: { $ne: 'HELD' } },
        { $inc: { walletBalance: -amount, walletEscrowBalance: amount }, $set: { [marker]: 'HELD', updatedAt } },
        { returnDocument: 'after' }
      );
      if (updatedDoc) {
        const { _id, ...safe } = updatedDoc;
        return safe;
      }
      const existing = await coll.findOne({ id: cleanUserId });
      if (existing && existing.walletEscrowOperations?.[cleanKey] === 'HELD') {
        const { _id, ...safe } = existing;
        return safe;
      }
      return null;
    }

    const existing = Database.getUserById(cleanUserId);
    if (!existing) return null;
    const operations = existing.walletEscrowOperations || {};
    if (operations[cleanKey] === 'HELD') return existing;
    const balance = Number(existing.walletBalance || 0);
    if (!Number.isFinite(balance) || balance < amount) return null;
    return Database.updateUser(cleanUserId, {
      walletBalance: balance - amount,
      walletEscrowBalance: Number(existing.walletEscrowBalance || 0) + amount,
      walletEscrowOperations: { ...operations, [cleanKey]: 'HELD' },
      updatedAt
    });
  }

  /** Settle a held campaign amount once: capture it or release it back to available wallet funds. */
  static async settleWalletEscrowAsync(
    userId: string,
    amount: number,
    operationKey: string,
    releaseToWallet: boolean
  ): Promise<any | null> {
    const cleanUserId = String(userId || '').trim();
    const cleanKey = String(operationKey || '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
    if (!cleanUserId || !cleanKey) throw new Error('Valid user and escrow settlement references are required.');
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('Escrow settlement amount must be greater than zero.');
    const marker = `walletEscrowOperations.${cleanKey}`;
    const updatedAt = new Date().toISOString();
    const resultState = releaseToWallet ? 'RELEASED' : 'CAPTURED';

    if (isTest()) {
      const existing = inMemoryUsers.get(cleanUserId);
      if (!existing) return null;
      const operations = existing.walletEscrowOperations || {};
      if (operations[cleanKey] === resultState) return existing;
      if (operations[cleanKey] === 'CAPTURED' || operations[cleanKey] === 'RELEASED') {
        throw new Error(`Campaign escrow was already settled as ${operations[cleanKey]} and cannot be settled again.`);
      }
      const held = Number(existing.walletEscrowBalance || 0);
      if (!Number.isFinite(held) || held < amount) return null;
      const updated = {
        ...existing,
        walletEscrowBalance: held - amount,
        ...(releaseToWallet ? { walletBalance: Number(existing.walletBalance || 0) + amount } : {}),
        walletEscrowOperations: { ...operations, [cleanKey]: resultState },
        updatedAt
      };
      inMemoryUsers.set(cleanUserId, updated);
      return updated;
    }

    if (isMongoActive()) {
      const coll = await getUsersCollection();
      const increments: Record<string, number> = { walletEscrowBalance: -amount };
      if (releaseToWallet) increments.walletBalance = amount;
      const updatedDoc = await coll.findOneAndUpdate(
        { id: cleanUserId, walletEscrowBalance: { $gte: amount }, [marker]: { $exists: false } },
        { $inc: increments, $set: { [marker]: resultState, updatedAt } },
        { returnDocument: 'after' }
      );
      if (updatedDoc) {
        const { _id, ...safe } = updatedDoc;
        return safe;
      }
      const existing = await coll.findOne({ id: cleanUserId });
      if (existing && existing.walletEscrowOperations?.[cleanKey] === resultState) {
        const { _id, ...safe } = existing;
        return safe;
      }
      if (existing && ['CAPTURED', 'RELEASED'].includes(existing.walletEscrowOperations?.[cleanKey])) {
        throw new Error(`Campaign escrow was already settled as ${existing.walletEscrowOperations[cleanKey]} and cannot be settled again.`);
      }
      return null;
    }

    const existing = Database.getUserById(cleanUserId);
    if (!existing) return null;
    const operations = existing.walletEscrowOperations || {};
    if (operations[cleanKey] === resultState) return existing;
    if (operations[cleanKey] === 'CAPTURED' || operations[cleanKey] === 'RELEASED') {
      throw new Error(`Campaign escrow was already settled as ${operations[cleanKey]} and cannot be settled again.`);
    }
    const held = Number(existing.walletEscrowBalance || 0);
    if (!Number.isFinite(held) || held < amount) return null;
    return Database.updateUser(cleanUserId, {
      walletEscrowBalance: held - amount,
      ...(releaseToWallet ? { walletBalance: Number(existing.walletBalance || 0) + amount } : {}),
      walletEscrowOperations: { ...operations, [cleanKey]: resultState },
      updatedAt
    });
  }

  /** Idempotent credit used for refunds of older campaigns created before escrow was introduced. */
  static async creditWalletBalanceOnceAsync(userId: string, amount: number, operationKey: string): Promise<any | null> {
    const cleanUserId = String(userId || '').trim();
    const cleanKey = String(operationKey || '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
    if (!cleanUserId || !cleanKey) throw new Error('Valid user and refund operation references are required.');
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('Refund amount must be greater than zero.');
    const marker = `walletEscrowOperations.${cleanKey}`;
    const updatedAt = new Date().toISOString();

    if (isTest()) {
      const existing = inMemoryUsers.get(cleanUserId);
      if (!existing) return null;
      const operations = existing.walletEscrowOperations || {};
      if (operations[cleanKey] === 'REFUNDED') return existing;
      const updated = {
        ...existing,
        walletBalance: Number(existing.walletBalance || 0) + amount,
        walletEscrowOperations: { ...operations, [cleanKey]: 'REFUNDED' },
        updatedAt
      };
      inMemoryUsers.set(cleanUserId, updated);
      return updated;
    }

    if (isMongoActive()) {
      const coll = await getUsersCollection();
      const updatedDoc = await coll.findOneAndUpdate(
        { id: cleanUserId, [marker]: { $ne: 'REFUNDED' } },
        { $inc: { walletBalance: amount }, $set: { [marker]: 'REFUNDED', updatedAt } },
        { returnDocument: 'after' }
      );
      if (updatedDoc) {
        const { _id, ...safe } = updatedDoc;
        return safe;
      }
      const existing = await coll.findOne({ id: cleanUserId });
      if (existing && existing.walletEscrowOperations?.[cleanKey] === 'REFUNDED') {
        const { _id, ...safe } = existing;
        return safe;
      }
      return null;
    }

    const existing = Database.getUserById(cleanUserId);
    if (!existing) return null;
    const operations = existing.walletEscrowOperations || {};
    if (operations[cleanKey] === 'REFUNDED') return existing;
    return Database.updateUser(cleanUserId, {
      walletBalance: Number(existing.walletBalance || 0) + amount,
      walletEscrowOperations: { ...operations, [cleanKey]: 'REFUNDED' },
      updatedAt
    });
  }

  /** Grants one paid CV design once. Repeated approval of the same transaction is idempotent. */
  static async grantCvDesignEntitlementAsync(userId: string, entitlement: Record<string, any>): Promise<any | null> {
    const cleanUserId = String(userId || '').trim();
    const templateId = String(entitlement?.templateId || '').trim();
    const transactionId = String(entitlement?.transactionId || '').trim();
    if (!cleanUserId || !templateId || !transactionId) throw new Error('Valid user, CV design and transaction references are required.');
    const safeEntitlement = {
      templateId,
      templateName: String(entitlement.templateName || templateId).slice(0, 80),
      transactionId,
      amount: Number(entitlement.amount),
      currency: 'PKR',
      purchasedAt: String(entitlement.purchasedAt || new Date().toISOString())
    };
    if (!Number.isFinite(safeEntitlement.amount) || safeEntitlement.amount <= 0) throw new Error('CV design purchase amount is invalid.');
    const updatedAt = new Date().toISOString();

    if (isTest()) {
      const existing = inMemoryUsers.get(cleanUserId);
      if (!existing) return null;
      const entitlements = Array.isArray(existing.cvDesignEntitlements) ? existing.cvDesignEntitlements : [];
      const sameTx = entitlements.find((item: any) => item?.transactionId === transactionId);
      if (sameTx) return existing;
      if (entitlements.some((item: any) => item?.templateId === templateId)) throw new Error('This CV design has already been purchased.');
      const updated = { ...existing, cvDesignEntitlements: [...entitlements, safeEntitlement], updatedAt };
      inMemoryUsers.set(cleanUserId, updated);
      return updated;
    }

    if (isMongoActive()) {
      const coll = await getUsersCollection();
      const updatedDoc = await coll.findOneAndUpdate(
        { id: cleanUserId, 'cvDesignEntitlements.templateId': { $ne: templateId } },
        { $push: { cvDesignEntitlements: safeEntitlement }, $set: { updatedAt } },
        { returnDocument: 'after', includeResultMetadata: false }
      );
      if (updatedDoc) {
        const { _id, ...safe } = updatedDoc;
        return safe;
      }
      const existing = await coll.findOne({ id: cleanUserId });
      if (!existing) return null;
      const entitlements = Array.isArray(existing.cvDesignEntitlements) ? existing.cvDesignEntitlements : [];
      if (entitlements.some((item: any) => item?.transactionId === transactionId)) {
        const { _id, ...safe } = existing;
        return safe;
      }
      if (entitlements.some((item: any) => item?.templateId === templateId)) throw new Error('This CV design has already been purchased.');
      return null;
    }

    const existing = Database.getUserById(cleanUserId);
    if (!existing) return null;
    const entitlements = Array.isArray(existing.cvDesignEntitlements) ? existing.cvDesignEntitlements : [];
    if (entitlements.some((item: any) => item?.transactionId === transactionId)) return existing;
    if (entitlements.some((item: any) => item?.templateId === templateId)) throw new Error('This CV design has already been purchased.');
    return Database.updateUser(cleanUserId, { cvDesignEntitlements: [...entitlements, safeEntitlement], updatedAt });
  }

  /** Atomically deducts wallet funds and grants a single CV design in the same user-document update. */
  static async purchaseCvDesignWithWalletAsync(
    userId: string,
    amount: number,
    entitlement: Record<string, any>
  ): Promise<{ ok: boolean; user?: any; reason?: 'not_found' | 'already_owned' | 'insufficient' }> {
    const cleanUserId = String(userId || '').trim();
    const templateId = String(entitlement?.templateId || '').trim();
    const transactionId = String(entitlement?.transactionId || '').trim();
    if (!cleanUserId || !templateId || !transactionId) throw new Error('Valid user, CV design and transaction references are required.');
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('CV design purchase amount must be positive.');
    const safeEntitlement = {
      templateId,
      templateName: String(entitlement.templateName || templateId).slice(0, 80),
      transactionId,
      amount,
      currency: 'PKR',
      purchasedAt: String(entitlement.purchasedAt || new Date().toISOString())
    };
    const updatedAt = new Date().toISOString();

    if (isTest()) {
      const existing = inMemoryUsers.get(cleanUserId);
      if (!existing) return { ok: false, reason: 'not_found' };
      const entitlements = Array.isArray(existing.cvDesignEntitlements) ? existing.cvDesignEntitlements : [];
      if (entitlements.some((item: any) => item?.templateId === templateId)) return { ok: false, reason: 'already_owned' };
      const balance = Number(existing.walletBalance || 0);
      if (!Number.isFinite(balance) || balance < amount) return { ok: false, reason: 'insufficient' };
      const updated = { ...existing, walletBalance: balance - amount, cvDesignEntitlements: [...entitlements, safeEntitlement], updatedAt };
      inMemoryUsers.set(cleanUserId, updated);
      return { ok: true, user: updated };
    }

    if (isMongoActive()) {
      const coll = await getUsersCollection();
      const updatedDoc = await coll.findOneAndUpdate(
        { id: cleanUserId, walletBalance: { $gte: amount }, 'cvDesignEntitlements.templateId': { $ne: templateId } },
        { $inc: { walletBalance: -amount }, $push: { cvDesignEntitlements: safeEntitlement }, $set: { updatedAt } },
        { returnDocument: 'after', includeResultMetadata: false }
      );
      if (updatedDoc) {
        if (typeof updatedDoc.walletBalance !== 'number' || !Number.isFinite(updatedDoc.walletBalance) || updatedDoc.walletBalance < 0) {
          throw new Error('Invalid wallet balance after CV design purchase.');
        }
        const { _id, ...safe } = updatedDoc;
        return { ok: true, user: safe };
      }
      const existing = await coll.findOne({ id: cleanUserId });
      if (!existing) return { ok: false, reason: 'not_found' };
      const entitlements = Array.isArray(existing.cvDesignEntitlements) ? existing.cvDesignEntitlements : [];
      if (entitlements.some((item: any) => item?.templateId === templateId)) return { ok: false, reason: 'already_owned' };
      return { ok: false, reason: 'insufficient' };
    }

    const existing = Database.getUserById(cleanUserId);
    if (!existing) return { ok: false, reason: 'not_found' };
    const entitlements = Array.isArray(existing.cvDesignEntitlements) ? existing.cvDesignEntitlements : [];
    if (entitlements.some((item: any) => item?.templateId === templateId)) return { ok: false, reason: 'already_owned' };
    const balance = Number(existing.walletBalance || 0);
    if (!Number.isFinite(balance) || balance < amount) return { ok: false, reason: 'insufficient' };
    const updated = Database.updateUser(cleanUserId, {
      walletBalance: balance - amount,
      cvDesignEntitlements: [...entitlements, safeEntitlement],
      updatedAt
    });
    return updated ? { ok: true, user: updated } : { ok: false, reason: 'not_found' };
  }

  static update(id: string, updates: any): any | null {
    if (isMongoActive()) {
      throw new Error('MongoDB is configured. Synchronous update is prohibited to ensure authoritative persistence; use updateAsync.');
    }
    return Database.updateUser(id, updates);
  }

  /**
   * Asynchronously deletes a user.
   * When MongoDB is configured, deletes strictly from MongoDB.
   */
  static async deleteAsync(id: string): Promise<boolean> {
    if (isTest()) {
      return inMemoryUsers.delete(id);
    }

    if (isMongoActive()) {
      const coll = await getUsersCollection();
      const res = await coll.deleteOne({ id });
      return res.deletedCount > 0;
    }
    return Database.deleteUser(id);
  }

  static delete(id: string): boolean {
    if (isTest()) {
      return inMemoryUsers.delete(id);
    }
    if (isMongoActive()) {
      throw new Error('MongoDB is configured. Synchronous delete is prohibited to ensure authoritative persistence; use deleteAsync.');
    }
    return Database.deleteUser(id);
  }

  private static evaluateRoleMutationGuard(params: {
    actor: any;
    actorId: string;
    actorRoleFallback?: string;
    targetUser: any;
    targetUserId: string;
    newRole: string;
    superAdminCount: number;
  }): RoleMutationResult | null {
    const { actor, actorId, actorRoleFallback, targetUser, targetUserId, newRole, superAdminCount } = params;
    const actorRole = actor?.role || actorRoleFallback;

    // Only an existing Super Admin or Admin may manage user roles
    if (!actor || (actorRole !== 'Super Admin' && actorRole !== 'Admin')) {
      return {
        ok: false,
        status: 403,
        message: 'Access denied: Only Super Admin or Admin may manage user roles.'
      };
    }

    // Prevent a user from changing their own role
    if (String(targetUserId) === String(actorId)) {
      return {
        ok: false,
        status: 403,
        message: 'Action blocked: You cannot change your own administrative role.'
      };
    }

    if (!targetUser) {
      return {
        ok: false,
        status: 404,
        message: 'Target user not found.'
      };
    }

    const oldRole = targetUser.role || 'Job Seeker';

    // Only an existing Super Admin can assign the Super Admin role or modify an existing Super Admin
    if (newRole === 'Super Admin' && actorRole !== 'Super Admin') {
      return {
        ok: false,
        status: 403,
        message: 'Access denied: Only an existing Super Admin can assign the Super Admin role.'
      };
    }

    if (oldRole === 'Super Admin' && actorRole !== 'Super Admin') {
      return {
        ok: false,
        status: 403,
        message: 'Access denied: Only a Super Admin can modify another Super Admin account.'
      };
    }

    // Prevent changing the last/only Super Admin into a lower role
    if (oldRole === 'Super Admin' && newRole !== 'Super Admin' && superAdminCount <= 1) {
      return {
        ok: false,
        status: 400,
        message: 'Action blocked: Cannot demote the last remaining Super Admin account.'
      };
    }

    return null;
  }

  /**
   * Atomically updates a user's administrative role with concurrency-safe protection
   * against demoting the last remaining Super Admin account.
   * - In MongoDB mode: uses client.startSession() + session.withTransaction() and a lock coordinator doc.
   *   Fails closed if transactions are unavailable; never falls back to non-transactional updates.
   * - In In-Memory / File DB mode: serializes all role mutations through an async mutex queue.
   */
  static async updateRoleWithLastSuperAdminGuard(
    params: RoleMutationParams,
    mongoOverride?: { client: any; db?: any }
  ): Promise<RoleMutationResult> {
    const { targetUserId, newRole, actorId, actorRoleFallback, newPermissions } = params;

    if (mongoOverride || isMongoActive()) {
      let client: any;
      try {
        client = mongoOverride?.client ?? (await getMongoClient());
      } catch (err: any) {
        console.error('[UserRepository] MongoDB client unavailable for transactional role update:', err?.message || err);
        return {
          ok: false,
          status: 503,
          message: 'Database transaction unavailable: failed closed to protect Super Admin consistency.'
        };
      }

      const db = mongoOverride?.db ?? client.db();
      const session = client.startSession();
      let outcome: RoleMutationResult | null = null;

      try {
        await session.withTransaction(async () => {
          const locksColl = db.collection('system_locks');
          const usersColl = db.collection('users');
          const nowIso = new Date().toISOString();

          // Touch a shared coordinator document so concurrent role mutations serialize cleanly
          await locksColl.updateOne(
            { _id: 'super_admin_role_mutation_guard' },
            { $inc: { seq: 1 }, $set: { updatedAt: nowIso } },
            { upsert: true, session }
          );

          const actor = actorId ? await usersColl.findOne({ id: actorId }, { session }) : null;
          const targetUser = await usersColl.findOne({ id: targetUserId }, { session });
          const oldRole = targetUser?.role || 'Job Seeker';

          let superAdminCount = 0;
          if (oldRole === 'Super Admin' && newRole !== 'Super Admin') {
            superAdminCount = await usersColl.countDocuments({ role: 'Super Admin' }, { session });
          }

          const rejection = UserRepository.evaluateRoleMutationGuard({
            actor,
            actorId,
            actorRoleFallback,
            targetUser,
            targetUserId,
            newRole,
            superAdminCount
          });

          if (rejection) {
            throw new RoleGuardRejectionError(rejection);
          }

          const updatedDoc = await usersColl.findOneAndUpdate(
            { id: targetUser.id },
            {
              $set: {
                role: newRole,
                permissions: newPermissions,
                updatedAt: nowIso
              }
            },
            { returnDocument: 'after', session }
          );

          if (!updatedDoc) {
            throw new RoleGuardRejectionError({
              ok: false,
              status: 500,
              message: 'Failed to update user role.'
            });
          }

          const { _id: _uId, ...safeUser } = updatedDoc;
          const { _id: _aId, ...safeActor } = actor || {};
          outcome = {
            ok: true,
            status: 200,
            message: `Role updated from '${oldRole}' to '${newRole}'.`,
            user: safeUser,
            actor: safeActor,
            actorRole: actor?.role || actorRoleFallback,
            oldRole,
            newRole,
            permissions: newPermissions
          };
        });

        if (!outcome) {
          return {
            ok: false,
            status: 500,
            message: 'Role update transaction completed without an authoritative outcome.'
          };
        }
        return outcome;
      } catch (err: any) {
        if (err instanceof RoleGuardRejectionError) {
          return err.result;
        }
        console.error('[UserRepository] Transactional role update aborted/failed closed:', err?.message || err);
        return {
          ok: false,
          status: 503,
          message: 'Role update failed: transactional Super Admin protection could not be guaranteed.'
        };
      } finally {
        await session.endSession().catch(() => {});
      }
    }

    // In-memory / File DB mode: serialize all role mutations through an async mutex queue
    const runSerialized = async (): Promise<RoleMutationResult> => {
      const actor = actorId ? (isTest() ? inMemoryUsers.get(actorId) || null : Database.getUserById(actorId)) : null;
      const targetUser = isTest() ? inMemoryUsers.get(targetUserId) || null : Database.getUserById(targetUserId);
      const oldRole = targetUser?.role || 'Job Seeker';

      let superAdminCount = 0;
      if (oldRole === 'Super Admin' && newRole !== 'Super Admin') {
        const allUsers = isTest() ? Array.from(inMemoryUsers.values()) : Database.getUsers();
        superAdminCount = allUsers.filter(u => u && u.role === 'Super Admin').length;
      }

      const rejection = UserRepository.evaluateRoleMutationGuard({
        actor,
        actorId,
        actorRoleFallback,
        targetUser,
        targetUserId,
        newRole,
        superAdminCount
      });

      if (rejection) {
        return rejection;
      }

      const updatedAt = new Date().toISOString();
      let updatedUser: any = null;
      if (isTest()) {
        updatedUser = {
          ...targetUser,
          role: newRole,
          permissions: newPermissions,
          updatedAt
        };
        inMemoryUsers.set(targetUser.id, updatedUser);
      } else {
        updatedUser = Database.updateUser(targetUser.id, {
          role: newRole,
          permissions: newPermissions,
          updatedAt
        });
      }

      if (!updatedUser) {
        return {
          ok: false,
          status: 500,
          message: 'Failed to update user role.'
        };
      }

      return {
        ok: true,
        status: 200,
        message: `Role updated from '${oldRole}' to '${newRole}'.`,
        user: updatedUser,
        actor,
        actorRole: actor?.role || actorRoleFallback,
        oldRole,
        newRole,
        permissions: newPermissions
      };
    };

    const queuedPromise = UserRepository.roleMutationQueue.then(runSerialized, runSerialized);
    UserRepository.roleMutationQueue = queuedPromise.then(() => undefined, () => undefined);
    return queuedPromise;
  }
}

