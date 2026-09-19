import { Database } from '../database';
import { getUsersCollection, isMongoConfigured } from '../mongodb';

export class UserRepository {
  static getAll(): any[] {
    return Database.getUsers();
  }

  static async getAllAsync(): Promise<any[]> {
    if (isMongoConfigured()) {
      try {
        const coll = await getUsersCollection();
        const users = await coll.find({}).sort({ createdAt: -1 }).toArray();
        return (users || []).map(u => {
          const { _id, ...safe } = u;
          return safe;
        });
      } catch (err) {
        // Fallback to local database only on genuine connection/query failure
      }
    }
    return Database.getUsers();
  }

  static getById(id: string): any | null {
    return Database.getUserById(id);
  }

  static async getByIdAsync(id: string): Promise<any | null> {
    if (isMongoConfigured()) {
      try {
        const coll = await getUsersCollection();
        const user = await coll.findOne({ id });
        if (user) {
          const { _id, ...safe } = user;
          return safe;
        }
        return null;
      } catch (err) {
        // Fallback to local database only on genuine connection/query failure
      }
    }
    return Database.getUserById(id);
  }

  static getByEmail(email: string): any | null {
    return Database.getUserByEmail(email);
  }

  static async getByEmailAsync(email: string): Promise<any | null> {
    if (!email) return null;
    if (isMongoConfigured()) {
      try {
        const coll = await getUsersCollection();
        const user = await coll.findOne({ email: email.toLowerCase().trim() });
        if (user) {
          const { _id, ...safe } = user;
          return safe;
        }
        return null;
      } catch (err) {
        // Fallback to local database only on genuine connection/query failure
      }
    }
    return Database.getUserByEmail(email);
  }

  /**
   * Asynchronously creates a new user.
   * When MongoDB is configured, writes to MongoDB first, awaits it, and returns authoritative user.
   */
  static async createAsync(userData: any): Promise<any> {
    const id = userData.id || `user-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const userToSave = {
      ...userData,
      id,
      walletBalance: Number(userData.walletBalance || 0),
      createdAt: userData.createdAt || new Date().toISOString(),
      updatedAt: userData.updatedAt || new Date().toISOString()
    };

    if (isMongoConfigured()) {
      const coll = await getUsersCollection();
      await coll.insertOne({ ...userToSave });
      try {
        Database.addUser(userToSave);
      } catch {}
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
   * When MongoDB is configured, writes to MongoDB first, awaits it, and returns authoritative updated user.
   */
  static async updateAsync(id: string, updates: any): Promise<any | null> {
    const updatePayload = {
      ...updates,
      updatedAt: new Date().toISOString()
    };

    if (isMongoConfigured()) {
      try {
        const coll = await getUsersCollection();
        const updatedDoc = await coll.findOneAndUpdate(
          { id },
          { $set: updatePayload },
          { returnDocument: 'after' }
        );
        if (updatedDoc) {
          const { _id, ...safe } = updatedDoc;
          try {
            Database.updateUser(id, updates);
          } catch {}
          return safe;
        }
        return null;
      } catch (err) {
        // Fallback to local database only on genuine connection/query failure
      }
    }

    return Database.updateUser(id, updates);
  }

  static update(id: string, updates: any): any | null {
    if (isMongoConfigured()) {
      throw new Error('MongoDB is configured. Synchronous update is prohibited to ensure authoritative persistence; use updateAsync.');
    }
    return Database.updateUser(id, updates);
  }

  /**
   * Asynchronously deletes a user.
   * When MongoDB is configured, writes to MongoDB first, awaits it.
   */
  static async deleteAsync(id: string): Promise<boolean> {
    if (isMongoConfigured()) {
      const coll = await getUsersCollection();
      const res = await coll.deleteOne({ id });
      try {
        Database.deleteUser(id);
      } catch {}
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

