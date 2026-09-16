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
        if (users && users.length > 0) {
          return users.map(u => {
            const { _id, ...safe } = u;
            return safe;
          });
        }
      } catch (err: any) {
        console.warn('[MongoDB] getAll users fallback:', err.message);
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
      } catch (err: any) {
        console.warn('[MongoDB] getById user fallback:', err.message);
      }
    }
    return Database.getUserById(id);
  }

  static getByEmail(email: string): any | null {
    return Database.getUserByEmail(email);
  }

  static async getByEmailAsync(email: string): Promise<any | null> {
    if (isMongoConfigured() && email) {
      try {
        const coll = await getUsersCollection();
        const user = await coll.findOne({ email: email.toLowerCase().trim() });
        if (user) {
          const { _id, ...safe } = user;
          return safe;
        }
      } catch (err: any) {
        console.warn('[MongoDB] getByEmail user fallback:', err.message);
      }
    }
    return Database.getUserByEmail(email);
  }

  static create(userData: any): any {
    const user = Database.addUser(userData);
    this.syncMongoUser(user);
    return user;
  }

  static update(id: string, updates: any): any | null {
    const user = Database.updateUser(id, updates);
    if (user) {
      this.syncMongoUser(user);
    }
    return user;
  }

  static delete(id: string): boolean {
    const deleted = Database.deleteUser(id);
    if (deleted && isMongoConfigured()) {
      getUsersCollection()
        .then(coll => coll.deleteOne({ id }))
        .catch(err => console.warn('[MongoDB] Delete user notice:', err.message));
    }
    return deleted;
  }

  private static syncMongoUser(user: any): void {
    if (!isMongoConfigured() || !user?.id) return;
    getUsersCollection()
      .then(coll => {
        coll.updateOne(
          { id: user.id },
          { $set: user },
          { upsert: true }
        ).catch(err => console.warn('[MongoDB] Sync user notice:', err.message));
      })
      .catch(() => {});
  }
}

