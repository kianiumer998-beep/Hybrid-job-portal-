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
      const updatedDoc = await (coll as any).findOneAndUpdate(
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
      const updatedDoc = await (coll as any).findOneAndUpdate(
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

  /** Grants a purchased CV quota package once per payment transaction. */
  static async grantCvPackageEntitlementAsync(userId: string, packageSnapshot: Record<string, any>, transactionId: string): Promise<any | null> {
    const cleanUserId = String(userId || '').trim();
    const cleanTransactionId = String(transactionId || '').trim();
    const packageId = String(packageSnapshot?.packageId || packageSnapshot?.id || '').trim();
    const durationDays = Number(packageSnapshot?.durationDays);
    if (!cleanUserId || !cleanTransactionId || !packageId || !Number.isInteger(durationDays) || durationDays <= 0 || durationDays > 3650) {
      throw new Error('Valid user, CV package, transaction and package duration are required.');
    }
    const numericFields = ['cvCreateLimit', 'editLimit', 'pdfExportLimit', 'atsExportLimit', 'shareLimit'];
    const limits: Record<string, number> = {};
    for (const field of numericFields) {
      const value = Number(packageSnapshot[field]);
      if (!Number.isInteger(value) || value < 0 || value > 10000) throw new Error(`Invalid CV package quota: ${field}.`);
      limits[field] = value;
    }
    const grantedAt = new Date().toISOString();
    const entitlement = {
      packageId,
      packageName: String(packageSnapshot.packageName || packageSnapshot.name || packageId).slice(0, 80),
      transactionId: cleanTransactionId,
      pricePkr: Number(packageSnapshot.pricePkr),
      grantedAt,
      expiresAt: new Date(Date.now() + durationDays * 86400000).toISOString(),
      durationDays,
      limits,
      usage: { cvCreateLimit: 0, editLimit: 0, pdfExportLimit: 0, atsExportLimit: 0, shareLimit: 0 },
      noWatermark: packageSnapshot.noWatermark === true
    };
    if (!Number.isFinite(entitlement.pricePkr) || entitlement.pricePkr <= 0) throw new Error('CV package price is invalid.');
    const updatedAt = grantedAt;
    if (isTest()) {
      const existing = inMemoryUsers.get(cleanUserId);
      if (!existing) return null;
      const list = Array.isArray(existing.cvPackageEntitlements) ? existing.cvPackageEntitlements : [];
      if (list.some((item: any) => item?.transactionId === cleanTransactionId)) return existing;
      const updated = { ...existing, cvPackageEntitlements: [...list, entitlement], updatedAt };
      inMemoryUsers.set(cleanUserId, updated);
      return updated;
    }
    if (isMongoActive()) {
      const coll = await getUsersCollection();
      const updatedDoc = await coll.findOneAndUpdate(
        { id: cleanUserId, 'cvPackageEntitlements.transactionId': { $ne: cleanTransactionId } },
        { $push: { cvPackageEntitlements: entitlement }, $set: { updatedAt } },
        { returnDocument: 'after' }
      );
      if (updatedDoc) { const { _id, ...safe } = updatedDoc; return safe; }
      const existing = await coll.findOne({ id: cleanUserId });
      if (!existing) return null;
      if ((Array.isArray(existing.cvPackageEntitlements) ? existing.cvPackageEntitlements : []).some((item: any) => item?.transactionId === cleanTransactionId)) {
        const { _id, ...safe } = existing; return safe;
      }
      return null;
    }
    const existing = Database.getUserById(cleanUserId);
    if (!existing) return null;
    const list = Array.isArray(existing.cvPackageEntitlements) ? existing.cvPackageEntitlements : [];
    if (list.some((item: any) => item?.transactionId === cleanTransactionId)) return existing;
    return Database.updateUser(cleanUserId, { cvPackageEntitlements: [...list, entitlement], updatedAt });
  }

  /** Atomically deducts wallet funds and grants a CV package, idempotently tied to its transaction. */
  static async purchaseCvPackageWithWalletAsync(userId: string, amount: number, packageSnapshot: Record<string, any>, transactionId: string): Promise<{ ok: boolean; user?: any; reason?: 'not_found' | 'insufficient' }> {
    const cleanUserId = String(userId || '').trim();
    const cleanTransactionId = String(transactionId || '').trim();
    if (!cleanUserId || !cleanTransactionId || !Number.isFinite(amount) || amount <= 0) throw new Error('Valid user, transaction and positive payment amount are required.');
    const durationDays = Number(packageSnapshot?.durationDays);
    const packageId = String(packageSnapshot?.packageId || packageSnapshot?.id || '').trim();
    if (!packageId || !Number.isInteger(durationDays) || durationDays <= 0 || durationDays > 3650) throw new Error('CV package snapshot is invalid.');
    const limits: Record<string, number> = {};
    for (const field of ['cvCreateLimit', 'editLimit', 'pdfExportLimit', 'atsExportLimit', 'shareLimit']) {
      const value = Number(packageSnapshot[field]);
      if (!Number.isInteger(value) || value < 0 || value > 10000) throw new Error(`Invalid CV package quota: ${field}.`);
      limits[field] = value;
    }
    const grantedAt = new Date().toISOString();
    const entitlement = {
      packageId,
      packageName: String(packageSnapshot.packageName || packageSnapshot.name || packageId).slice(0, 80),
      transactionId: cleanTransactionId,
      pricePkr: amount,
      grantedAt,
      expiresAt: new Date(Date.now() + durationDays * 86400000).toISOString(),
      durationDays,
      limits,
      usage: { cvCreateLimit: 0, editLimit: 0, pdfExportLimit: 0, atsExportLimit: 0, shareLimit: 0 },
      noWatermark: packageSnapshot.noWatermark === true
    };
    const updatedAt = grantedAt;
    if (isTest()) {
      const existing = inMemoryUsers.get(cleanUserId);
      if (!existing) return { ok: false, reason: 'not_found' };
      const list = Array.isArray(existing.cvPackageEntitlements) ? existing.cvPackageEntitlements : [];
      if (list.some((item: any) => item?.transactionId === cleanTransactionId)) return { ok: true, user: existing };
      const balance = Number(existing.walletBalance || 0);
      if (!Number.isFinite(balance) || balance < amount) return { ok: false, reason: 'insufficient' };
      const updated = { ...existing, walletBalance: balance - amount, cvPackageEntitlements: [...list, entitlement], updatedAt };
      inMemoryUsers.set(cleanUserId, updated);
      return { ok: true, user: updated };
    }
    if (isMongoActive()) {
      const coll = await getUsersCollection();
      const updatedDoc = await coll.findOneAndUpdate(
        { id: cleanUserId, walletBalance: { $gte: amount }, 'cvPackageEntitlements.transactionId': { $ne: cleanTransactionId } },
        { $inc: { walletBalance: -amount }, $push: { cvPackageEntitlements: entitlement }, $set: { updatedAt } },
        { returnDocument: 'after' }
      );
      if (updatedDoc) { const { _id, ...safe } = updatedDoc; return { ok: true, user: safe }; }
      const existing = await coll.findOne({ id: cleanUserId });
      if (!existing) return { ok: false, reason: 'not_found' };
      if ((Array.isArray(existing.cvPackageEntitlements) ? existing.cvPackageEntitlements : []).some((item: any) => item?.transactionId === cleanTransactionId)) {
        const { _id, ...safe } = existing; return { ok: true, user: safe };
      }
      return { ok: false, reason: 'insufficient' };
    }
    const existing = Database.getUserById(cleanUserId);
    if (!existing) return { ok: false, reason: 'not_found' };
    const list = Array.isArray(existing.cvPackageEntitlements) ? existing.cvPackageEntitlements : [];
    if (list.some((item: any) => item?.transactionId === cleanTransactionId)) return { ok: true, user: existing };
    const balance = Number(existing.walletBalance || 0);
    if (!Number.isFinite(balance) || balance < amount) return { ok: false, reason: 'insufficient' };
    const updated = Database.updateUser(cleanUserId, { walletBalance: balance - amount, cvPackageEntitlements: [...list, entitlement], updatedAt });
    return updated ? { ok: true, user: updated } : { ok: false, reason: 'not_found' };
  }

  /** Atomically saves CV documents and consumes package creation/edit quotas. */
  static async saveCvDocumentsWithPackageUsageAsync(
    userId: string,
    documents: any[],
    activeCvData: any,
    transactionId: string,
    createCount: number,
    editCount: number,
    createLimit: number,
    editLimit: number,
    templateEditUsage: Record<string, { count: number; limit: number }> = {}
  ): Promise<any | null> {
    const cleanUserId = String(userId || '').trim();
    const cleanTransactionId = String(transactionId || '').trim();
    const usesPackageQuota = Boolean(cleanTransactionId);
    if (!cleanUserId || (!usesPackageQuota && (createCount > 0 || editCount > 0)) || !Array.isArray(documents) ||
      !Number.isInteger(createCount) || createCount < 0 || !Number.isInteger(editCount) || editCount < 0 ||
      !Number.isInteger(createLimit) || createLimit < 0 || !Number.isInteger(editLimit) || editLimit < 0 ||
      !templateEditUsage || typeof templateEditUsage !== 'object' || Object.values(templateEditUsage).some((item: any) => !Number.isInteger(item?.count) || item.count < 1 || !Number.isInteger(item?.limit) || item.limit < 1)) {
      throw new Error('Invalid CV save or quota usage request.');
    }
    const now = new Date().toISOString();
    const updatedAt = now;
    const increments: Record<string, number> = {};
    const parseTemplateUsageKey = (key: string) => {
      const separator = key.lastIndexOf('::');
      const templateId = separator > 0 ? key.slice(0, separator) : key;
      const field = separator > 0 ? key.slice(separator + 2) : 'editCount';
      if (!['editCount', 'createCount'].includes(field)) throw new Error('Invalid per-design CV usage field.');
      return { templateId, field };
    };
    if (createCount > 0) {
      increments['cvPackageEntitlements.$[grant].usage.cvCreateLimit'] = createCount;
    }
    if (editCount > 0) {
      increments['cvPackageEntitlements.$[grant].usage.editLimit'] = editCount;
    }
    for (const [usageKey, usage] of Object.entries(templateEditUsage)) {
      const parsed = parseTemplateUsageKey(usageKey);
      increments[`cvTemplateUsage.${parsed.templateId}.${parsed.field}`] = usage.count;
    }
    if (isTest()) {
      const existing = inMemoryUsers.get(cleanUserId);
      if (!existing) return null;
      const list = Array.isArray(existing.cvPackageEntitlements) ? existing.cvPackageEntitlements : [];
      const grant = usesPackageQuota ? list.find((item: any) => {
        if (item?.transactionId !== cleanTransactionId || !item.expiresAt || Date.parse(item.expiresAt) <= Date.now()) return false;
        const limits = item.limits || {};
        const usage = item.usage || {};
        return Number(limits.cvCreateLimit || 0) === createLimit && Number(limits.editLimit || 0) === editLimit &&
          createCount <= Math.max(0, createLimit - Number(usage.cvCreateLimit || 0)) &&
          editCount <= Math.max(0, editLimit - Number(usage.editLimit || 0));
      }) : null;
      if (usesPackageQuota && !grant) return null;
      const templateUsage = existing.cvTemplateUsage || {};
      for (const [usageKey, usage] of Object.entries(templateEditUsage)) {
        const parsed = parseTemplateUsageKey(usageKey);
        const used = Number(templateUsage?.[parsed.templateId]?.[parsed.field] || 0);
        if (used + usage.count > usage.limit) return null;
      }
      const updatedGrant = grant ? { ...grant, usage: {
        ...(grant.usage || {}),
        cvCreateLimit: Number(grant.usage?.cvCreateLimit || 0) + createCount,
        editLimit: Number(grant.usage?.editLimit || 0) + editCount
      }} : null;
      const updatedList = grant ? list.map((item: any) => item?.transactionId === cleanTransactionId ? updatedGrant : item) : list;
      const updatedTemplateUsage = { ...templateUsage };
      for (const [usageKey, usage] of Object.entries(templateEditUsage)) {
        const parsed = parseTemplateUsageKey(usageKey);
        updatedTemplateUsage[parsed.templateId] = {
          ...(updatedTemplateUsage[parsed.templateId] || {}),
          [parsed.field]: Number(updatedTemplateUsage[parsed.templateId]?.[parsed.field] || 0) + usage.count
        };
      }
      const updated = { ...existing, cvDocuments: documents, cvData: activeCvData, cvPackageEntitlements: updatedList, ...(Object.keys(templateEditUsage).length ? { cvTemplateUsage: updatedTemplateUsage } : {}), updatedAt };
      inMemoryUsers.set(cleanUserId, updated);
      return updated;
    }
    if (isMongoActive()) {
      const coll = await getUsersCollection();
      const elemMatch: Record<string, any> = { transactionId: cleanTransactionId, expiresAt: { $gt: now } };
      if (createCount > 0) {
        elemMatch['limits.cvCreateLimit'] = { $gte: createCount };
        elemMatch['usage.cvCreateLimit'] = { $lte: createLimit - createCount };
      }
      if (editCount > 0) {
        elemMatch['limits.editLimit'] = { $gte: editCount };
        elemMatch['usage.editLimit'] = { $lte: editLimit - editCount };
      }
      const filter: Record<string, any> = { id: cleanUserId };
      if (usesPackageQuota) filter.cvPackageEntitlements = { $elemMatch: elemMatch };
      const templateConditions: any[] = [];
      for (const [usageKey, usage] of Object.entries(templateEditUsage)) {
        const parsed = parseTemplateUsageKey(usageKey);
        const field = `cvTemplateUsage.${parsed.templateId}.${parsed.field}`;
        templateConditions.push({ $or: [{ [field]: { $lte: usage.limit - usage.count } }, { [field]: { $exists: false } }] });
      }
      if (templateConditions.length) filter.$and = templateConditions;
      const arrayFilter: Record<string, any> = { 'grant.transactionId': cleanTransactionId, 'grant.expiresAt': { $gt: now } };
      const update: any = { $set: { cvDocuments: documents, cvData: activeCvData, updatedAt } };
      if (Object.keys(increments).length) {
        update.$inc = increments;
        if (usesPackageQuota) {
          if (createCount > 0) {
            arrayFilter['grant.limits.cvCreateLimit'] = createLimit;
            arrayFilter['grant.usage.cvCreateLimit'] = { $lte: createLimit - createCount };
          }
          if (editCount > 0) {
            arrayFilter['grant.limits.editLimit'] = editLimit;
            arrayFilter['grant.usage.editLimit'] = { $lte: editLimit - editCount };
          }
        }
      }
      const updatedDoc = await coll.findOneAndUpdate(filter, update, { returnDocument: 'after', ...(usesPackageQuota && (createCount > 0 || editCount > 0) ? { arrayFilters: [arrayFilter] } : {}) });
      if (!updatedDoc) return null;
      const { _id, ...safe } = updatedDoc;
      return safe;
    }
    const existing = Database.getUserById(cleanUserId);
    if (!existing) return null;
    const list = Array.isArray(existing.cvPackageEntitlements) ? existing.cvPackageEntitlements : [];
    const grant = usesPackageQuota ? list.find((item: any) => item?.transactionId === cleanTransactionId &&
      Date.parse(String(item?.expiresAt || '')) > Date.now() &&
      Number(item?.limits?.cvCreateLimit || 0) === createLimit && Number(item?.limits?.editLimit || 0) === editLimit &&
      createCount <= Math.max(0, createLimit - Number(item?.usage?.cvCreateLimit || 0)) &&
      editCount <= Math.max(0, editLimit - Number(item?.usage?.editLimit || 0))) : null;
    if (usesPackageQuota && !grant) return null;
    const templateUsage = existing.cvTemplateUsage || {};
    for (const [usageKey, usage] of Object.entries(templateEditUsage)) {
      const parsed = parseTemplateUsageKey(usageKey);
      if (Number(templateUsage?.[parsed.templateId]?.[parsed.field] || 0) + usage.count > usage.limit) return null;
    }
    const updatedList = grant ? list.map((item: any) => item?.transactionId === cleanTransactionId ? {
      ...item, usage: { ...(item.usage || {}),
        cvCreateLimit: Number(item.usage?.cvCreateLimit || 0) + createCount,
        editLimit: Number(item.usage?.editLimit || 0) + editCount
      }
    } : item) : list;
    const updatedTemplateUsage = { ...templateUsage };
    for (const [usageKey, usage] of Object.entries(templateEditUsage)) {
      const parsed = parseTemplateUsageKey(usageKey);
      updatedTemplateUsage[parsed.templateId] = {
        ...(updatedTemplateUsage[parsed.templateId] || {}),
        [parsed.field]: Number(updatedTemplateUsage[parsed.templateId]?.[parsed.field] || 0) + usage.count
      };
    }
    return Database.updateUser(cleanUserId, { cvDocuments: documents, cvData: activeCvData, cvPackageEntitlements: updatedList, ...(Object.keys(templateEditUsage).length ? { cvTemplateUsage: updatedTemplateUsage } : {}), updatedAt });
  }

  /** Atomically consumes the package quota and optional per-design quota for one CV action. */
  static async consumeCvActionQuotasAsync(
    userId: string,
    templateId: string,
    action: 'pdfExportLimit' | 'atsExportLimit' | 'shareLimit',
    packageGrant?: { transactionId: string; limit: number } | null,
    templateLimit: number = 0
  ): Promise<any | null> {
    const cleanUserId = String(userId || '').trim();
    const cleanTemplateId = String(templateId || '').trim();
    if (!cleanUserId || !cleanTemplateId || !['pdfExportLimit', 'atsExportLimit', 'shareLimit'].includes(action) ||
      !Number.isInteger(templateLimit) || templateLimit < 0 ||
      (packageGrant && (!String(packageGrant.transactionId || '').trim() || !Number.isInteger(packageGrant.limit) || packageGrant.limit < 1))) {
      throw new Error('Invalid CV action quota request.');
    }
    const now = new Date().toISOString();
    const updatedAt = now;
    const designPath = `cvTemplateUsage.${cleanTemplateId}.${action}`;
    const packagePath = packageGrant ? `cvPackageEntitlements.$[grant].usage.${action}` : '';
    const increment: Record<string, number> = {};
    if (packageGrant) increment[packagePath] = 1;
    if (templateLimit > 0) increment[designPath] = 1;
    if (isTest()) {
      const existing = inMemoryUsers.get(cleanUserId);
      if (!existing) return null;
      const list = Array.isArray(existing.cvPackageEntitlements) ? existing.cvPackageEntitlements : [];
      if (packageGrant && !list.some((item: any) => item?.transactionId === packageGrant.transactionId &&
        Date.parse(String(item?.expiresAt || '')) > Date.now() &&
        Number(item?.limits?.[action] || 0) === packageGrant.limit &&
        Number(item?.usage?.[action] || 0) < packageGrant.limit)) return null;
      const designUsed = Number(existing.cvTemplateUsage?.[cleanTemplateId]?.[action] || 0);
      if (templateLimit > 0 && designUsed >= templateLimit) return null;
      const updatedList = packageGrant ? list.map((item: any) => item?.transactionId === packageGrant.transactionId ? {
        ...item, usage: { ...(item.usage || {}), [action]: Number(item.usage?.[action] || 0) + 1 }
      } : item) : list;
      const updated = {
        ...existing,
        cvPackageEntitlements: updatedList,
        ...(templateLimit > 0 ? { cvTemplateUsage: {
          ...(existing.cvTemplateUsage || {}),
          [cleanTemplateId]: { ...(existing.cvTemplateUsage?.[cleanTemplateId] || {}), [action]: designUsed + 1 }
        }} : {}),
        updatedAt
      };
      inMemoryUsers.set(cleanUserId, updated);
      return updated;
    }
    if (isMongoActive()) {
      const filter: Record<string, any> = { id: cleanUserId };
      if (packageGrant) {
        filter.cvPackageEntitlements = { $elemMatch: {
          transactionId: packageGrant.transactionId,
          expiresAt: { $gt: now },
          [`limits.${action}`]: packageGrant.limit,
          [`usage.${action}`]: { $lt: packageGrant.limit }
        }};
      }
      if (templateLimit > 0) {
        filter.$or = [
          { [designPath]: { $lt: templateLimit } },
          { [designPath]: { $exists: false } }
        ];
      }
      const options: any = { returnDocument: 'after' };
      if (packageGrant) {
        options.arrayFilters = [{
          'grant.transactionId': packageGrant.transactionId,
          'grant.expiresAt': { $gt: now },
          [`grant.limits.${action}`]: packageGrant.limit,
          [`grant.usage.${action}`]: { $lt: packageGrant.limit }
        }];
      }
      const updatedDoc = await (await getUsersCollection()).findOneAndUpdate(filter, {
        ...(Object.keys(increment).length ? { $inc: increment } : {}),
        $set: { updatedAt }
      }, options);
      if (!updatedDoc) return null;
      const { _id, ...safe } = updatedDoc;
      return safe;
    }
    const existing = Database.getUserById(cleanUserId);
    if (!existing) return null;
    const list = Array.isArray(existing.cvPackageEntitlements) ? existing.cvPackageEntitlements : [];
    if (packageGrant && !list.some((item: any) => item?.transactionId === packageGrant.transactionId &&
      Date.parse(String(item?.expiresAt || '')) > Date.now() &&
      Number(item?.limits?.[action] || 0) === packageGrant.limit &&
      Number(item?.usage?.[action] || 0) < packageGrant.limit)) return null;
    const designUsed = Number(existing.cvTemplateUsage?.[cleanTemplateId]?.[action] || 0);
    if (templateLimit > 0 && designUsed >= templateLimit) return null;
    const updatedList = packageGrant ? list.map((item: any) => item?.transactionId === packageGrant.transactionId ? {
      ...item, usage: { ...(item.usage || {}), [action]: Number(item.usage?.[action] || 0) + 1 }
    } : item) : list;
    return Database.updateUser(cleanUserId, {
      cvPackageEntitlements: updatedList,
      ...(templateLimit > 0 ? { cvTemplateUsage: {
        ...(existing.cvTemplateUsage || {}),
        [cleanTemplateId]: { ...(existing.cvTemplateUsage?.[cleanTemplateId] || {}), [action]: designUsed + 1 }
      }} : {}),
      updatedAt
    });
  }

  /** Atomically consumes a single export/share quota from an active CV package. */
  static async consumeCvPackageQuotaAsync(userId: string, transactionId: string, action: 'pdfExportLimit' | 'atsExportLimit' | 'shareLimit', limit: number): Promise<any | null> {
    const cleanUserId = String(userId || '').trim();
    const cleanTransactionId = String(transactionId || '').trim();
    if (!cleanUserId || !cleanTransactionId || !['pdfExportLimit', 'atsExportLimit', 'shareLimit'].includes(action) || !Number.isInteger(limit) || limit < 0) throw new Error('Invalid CV package quota request.');
    const now = new Date().toISOString();
    const updatedAt = now;
    if (isTest()) {
      const existing = inMemoryUsers.get(cleanUserId);
      if (!existing) return null;
      const list = Array.isArray(existing.cvPackageEntitlements) ? existing.cvPackageEntitlements : [];
      const grant = list.find((item: any) => item?.transactionId === cleanTransactionId &&
        Date.parse(String(item?.expiresAt || '')) > Date.now() &&
        Number(item?.limits?.[action] || 0) === limit && Number(item?.usage?.[action] || 0) < limit);
      if (!grant) return null;
      const updatedList = list.map((item: any) => item?.transactionId === cleanTransactionId ? {
        ...item, usage: { ...(item.usage || {}), [action]: Number(item.usage?.[action] || 0) + 1 }
      } : item);
      const updated = { ...existing, cvPackageEntitlements: updatedList, updatedAt };
      inMemoryUsers.set(cleanUserId, updated);
      return updated;
    }
    if (isMongoActive()) {
      const coll = await getUsersCollection();
      const filter: Record<string, any> = {
        id: cleanUserId,
        cvPackageEntitlements: { $elemMatch: { transactionId: cleanTransactionId, expiresAt: { $gt: now }, [`limits.${action}`]: limit, [`usage.${action}`]: { $lt: limit } } }
      };
      const arrayFilter: Record<string, any> = {
        'grant.transactionId': cleanTransactionId,
        'grant.expiresAt': { $gt: now },
        [`grant.limits.${action}`]: limit,
        [`grant.usage.${action}`]: { $lt: limit }
      };
      const updatedDoc = await coll.findOneAndUpdate(filter, {
        $inc: { [`cvPackageEntitlements.$[grant].usage.${action}`]: 1 },
        $set: { updatedAt }
      }, { returnDocument: 'after', arrayFilters: [arrayFilter] });
      if (!updatedDoc) return null;
      const { _id, ...safe } = updatedDoc;
      return safe;
    }
    const existing = Database.getUserById(cleanUserId);
    if (!existing) return null;
    const list = Array.isArray(existing.cvPackageEntitlements) ? existing.cvPackageEntitlements : [];
    const grant = list.find((item: any) => item?.transactionId === cleanTransactionId &&
      Date.parse(String(item?.expiresAt || '')) > Date.now() &&
      Number(item?.limits?.[action] || 0) === limit && Number(item?.usage?.[action] || 0) < limit);
    if (!grant) return null;
    const updatedList = list.map((item: any) => item?.transactionId === cleanTransactionId ? {
      ...item, usage: { ...(item.usage || {}), [action]: Number(item.usage?.[action] || 0) + 1 }
    } : item);
    return Database.updateUser(cleanUserId, { cvPackageEntitlements: updatedList, updatedAt });
  }

  /** Atomically activates a subscription and its optional CV quota grant with one wallet deduction. */
  static async purchaseSubscriptionWithCvBenefitsAsync(
    userId: string,
    amount: number,
    membershipUpdates: Record<string, any>,
    packageSnapshot: Record<string, any>,
    transactionId: string
  ): Promise<any | null> {
    const cleanUserId = String(userId || '').trim();
    const cleanTransactionId = String(transactionId || '').trim();
    const packageId = String(packageSnapshot?.id || '').trim();
    const durationDays = Number(packageSnapshot?.durationDays);
    if (!cleanUserId || !cleanTransactionId || !packageId || !Number.isFinite(amount) || amount <= 0 ||
      !Number.isInteger(durationDays) || durationDays <= 0 || durationDays > 3650) {
      throw new Error('Subscription CV benefit purchase snapshot is invalid.');
    }
    const benefits = packageSnapshot.cvBenefits || {};
    const limits: Record<string, number> = {};
    for (const field of ['cvCreateLimit', 'editLimit', 'pdfExportLimit', 'atsExportLimit', 'shareLimit']) {
      const value = Number(benefits[field] ?? 0);
      if (!Number.isInteger(value) || value < 0 || value > 10000) throw new Error(`Invalid subscription CV benefit quota: ${field}.`);
      limits[field] = value;
    }
    const grantedAt = new Date().toISOString();
    const entitlement = {
      packageId: `subscription:${packageId}`,
      packageName: `${String(packageSnapshot.name || packageId).slice(0, 70)} CV Benefits`,
      transactionId: cleanTransactionId,
      pricePkr: amount,
      grantedAt,
      expiresAt: new Date(Date.now() + durationDays * 86400000).toISOString(),
      durationDays,
      limits,
      usage: { cvCreateLimit: 0, editLimit: 0, pdfExportLimit: 0, atsExportLimit: 0, shareLimit: 0 },
      noWatermark: benefits.noWatermark === true
    };
    const setPayload: Record<string, any> = { ...(membershipUpdates || {}), updatedAt: grantedAt };
    delete setPayload.id;
    delete setPayload._id;
    delete setPayload.walletBalance;
    if (isTest()) {
      const existing = inMemoryUsers.get(cleanUserId);
      if (!existing) return null;
      const current = Array.isArray(existing.cvPackageEntitlements) ? existing.cvPackageEntitlements : [];
      if (current.some((item: any) => item?.transactionId === cleanTransactionId)) return existing;
      const balance = Number(existing.walletBalance || 0);
      if (!Number.isFinite(balance) || balance < amount) return null;
      const updated = {
        ...existing, ...setPayload, walletBalance: balance - amount,
        cvPackageEntitlements: [...current, entitlement]
      };
      inMemoryUsers.set(cleanUserId, updated);
      return updated;
    }
    if (isMongoActive()) {
      const coll = await getUsersCollection();
      const updatedDoc = await coll.findOneAndUpdate(
        { id: cleanUserId, walletBalance: { $gte: amount }, 'cvPackageEntitlements.transactionId': { $ne: cleanTransactionId } },
        { $inc: { walletBalance: -amount }, $set: setPayload, $push: { cvPackageEntitlements: entitlement } },
        { returnDocument: 'after' }
      );
      if (updatedDoc) { const { _id, ...safe } = updatedDoc; return safe; }
      const existing = await coll.findOne({ id: cleanUserId });
      if (existing && (Array.isArray(existing.cvPackageEntitlements) ? existing.cvPackageEntitlements : []).some((item: any) => item?.transactionId === cleanTransactionId)) {
        const { _id, ...safe } = existing; return safe;
      }
      return null;
    }
    const existing = Database.getUserById(cleanUserId);
    if (!existing) return null;
    const current = Array.isArray(existing.cvPackageEntitlements) ? existing.cvPackageEntitlements : [];
    if (current.some((item: any) => item?.transactionId === cleanTransactionId)) return existing;
    const balance = Number(existing.walletBalance || 0);
    if (!Number.isFinite(balance) || balance < amount) return null;
    return Database.updateUser(cleanUserId, {
      ...setPayload,
      walletBalance: balance - amount,
      cvPackageEntitlements: [...current, entitlement]
    });
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

