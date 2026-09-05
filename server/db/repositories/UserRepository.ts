import { Database } from '../database';

export class UserRepository {
  static getAll(): any[] {
    return Database.getUsers();
  }

  static getById(id: string): any | null {
    return Database.getUserById(id);
  }

  static getByEmail(email: string): any | null {
    return Database.getUserByEmail(email);
  }

  static create(userData: any): any {
    return Database.addUser(userData);
  }

  static update(id: string, updates: any): any | null {
    return Database.updateUser(id, updates);
  }

  static delete(id: string): boolean {
    return Database.deleteUser(id);
  }
}
