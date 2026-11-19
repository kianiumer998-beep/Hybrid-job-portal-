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
    const userToSave = {
      ...cleanUserData,
      id,
      walletBalance: initialWalletBalance,
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
    if (isTest()) {
      const id = userData.id || `user-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
      const user = { ...userData, id };
      inMemoryUsers.set(id, user);
      return user;
    }
    if (isMongoActive()) {
      throw new Error('MongoDB is configured. Synchronous create is prohibited to ensure authoritative persistence; use createAsync.');
    }
    return Database.addUser(userData);
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

