import { Database } from '../database';

export class AuditRepository {
  static getAll(): any[] {
    return Database.getAuditLogs();
  }

  static add(entry: {
    user: string;
    role: string;
    action: string;
    target: string;
    status?: 'Success' | 'Warning' | 'Error';
    ip?: string;
    metadata?: any;
  }): any {
    return Database.addAuditLog(entry);
  }
}
