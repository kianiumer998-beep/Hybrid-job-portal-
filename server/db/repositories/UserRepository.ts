import { Database } from '../database';
import { getUsersCollection, isMongoConfigured } from '../mongodb';

export class UserRepository {
  static getAll(): any[] {
    return Database.getUsers();
  }

  static async getAllAsync(): Promise<any[]> {
    if (isMongoConfigured()) {
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
    return Database.getUserById(id);
  }

  static async getByIdAsync(id: string): Promise<any | null> {
    if (!id) return null;
    if (isMongoConfigured()) {
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
    return Database.getUserByEmail(email);
  }

  static async getByEmailAsync(email: string): Promise<any | null> {
    if (!email) return null;
    if (isMongoConfigured()) {
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

    if (isMongoConfigured()) {
      const coll = await getUsersCollection();
      await coll.insertOne({ ...userToSave });
      return userToSave;
    }

    return Database.addUser(userToSave);
  }

  static create(userData: any): any {
    if (isMongoConfigured()) {
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

    if (isMongoConfigured()) {
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

    if (isMongoConfigured()) {
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

    if (isMongoConfigured()) {
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
    if (isMongoConfigured()) {
      throw new Error('MongoDB is configured. Synchronous update is prohibited to ensure authoritative persistence; use updateAsync.');
    }
    return Database.updateUser(id, updates);
  }

  /**
   * Asynchronously deletes a user.
   * When MongoDB is configured, deletes strictly from MongoDB.
   */
  static async deleteAsync(id: string): Promise<boolean> {
    if (isMongoConfigured()) {
      const coll = await getUsersCollection();
      const res = await coll.deleteOne({ id });
      return res.deletedCount > 0;
    }
    return Database.deleteUser(id);
  }

  static delete(id: string): boolean {
    if (isMongoConfigured()) {
      throw new Error('MongoDB is configured. Synchronous delete is prohibited to ensure authoritative persistence; use deleteAsync.');
    }
    return Database.deleteUser(id);
  }
}

