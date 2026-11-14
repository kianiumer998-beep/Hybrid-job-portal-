import fs from 'fs';
import path from 'path';
import { Database } from '../database';
import { getMongoDb, isMongoConfigured, withMongoTimeout } from '../mongodb';

const COLLECTION_NAME = 'audit_logs';

const isTest = () => process.env.IS_TEST === 'true';

let inMemoryAuditStore: any[] = [];
let indexInitPromise: Promise<void> | null = null;

export class AuditRepository {
  static mockCollection: any = null;
  private static migrationDone = false;

  static setMockCollection(coll: any): void {
    if (coll !== null && !isTest()) {
      throw new Error('Security violation: Mock collection injection is strictly prohibited outside test mode.');
    }
    AuditRepository.mockCollection = coll;
    AuditRepository.migrationDone = false;
  }

  static resetTestStore(): void {
    AuditRepository.mockCollection = null;
    AuditRepository.migrationDone = false;
    inMemoryAuditStore = [];
  }

  private static async getCollection(): Promise<any> {
    if (AuditRepository.mockCollection) {
      return AuditRepository.mockCollection;
    }
    if (!isMongoConfigured()) {
      if (isTest()) {
        return createInMemoryMongoCollectionAdapter();
      }
      throw new Error('Database unavailable: Cannot perform audit log operation when MongoDB is not configured.');
    }
    const db = await getMongoDb();
    return db.collection(COLLECTION_NAME);
  }

  static async ensureIndexes(): Promise<void> {
    if (!isMongoConfigured() && !AuditRepository.mockCollection) {
      if (isTest()) return;
      throw new Error('Database unavailable: Cannot initialize indexes when MongoDB is not configured.');
    }
    if (!indexInitPromise) {
      indexInitPromise = (async () => {
        try {
          const coll = await AuditRepository.getCollection();
          if (coll && typeof coll.createIndex === 'function') {
            await coll.createIndex({ id: 1 }, { unique: true });
            await coll.createIndex({ timestamp: -1 });
          }
        } catch (err: any) {
          indexInitPromise = null;
          throw new Error(`MongoDB audit indexes initialization failed: ${err?.message || err}`);
        }
      })();
    }
    return indexInitPromise;
  }

  static async migrateLegacyRecords(): Promise<number> {
    if (AuditRepository.migrationDone) return 0;
    
    let legacyLogs: any[] = [];
    try {
      legacyLogs = Database.getAuditLogs() || [];
    } catch (err) {
      console.warn('[AuditRepository] Could not read legacy audit_logs.json:', err);
      return 0;
    }

    if (!Array.isArray(legacyLogs) || legacyLogs.length === 0) {
      AuditRepository.migrationDone = true;
      return 0;
    }

    const coll = await AuditRepository.getCollection();
    let migratedCount = 0;

    for (const log of legacyLogs) {
      if (!log || typeof log !== 'object') {
        throw new Error('Data Integrity Error: Invalid audit log record found during legacy migration.');
      }
      const recordId = log.id || `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const normalizedRecord = {
        id: recordId,
        timestamp: log.timestamp || new Date().toISOString(),
        user: log.user || 'System Admin',
        role: log.role || 'Super Admin',
        action: log.action || 'General Action',
        target: log.target || 'Portal',
        status: log.status || 'Success',
        ip: log.ip,
        details: log.details,
        metadata: log.metadata
      };

      if (AuditRepository.mockCollection || (isTest() && !isMongoConfigured())) {
        const existing = await coll.findOne({ id: recordId });
        if (!existing) {
          await coll.insertOne(normalizedRecord);
          migratedCount++;
        }
      } else {
        const res = await withMongoTimeout(
          coll.updateOne(
            { id: recordId },
            { $setOnInsert: normalizedRecord },
            { upsert: true }
          ),
          10000,
          'migrate legacy audit record'
        );
        if (res && res.acknowledged === false) {
          throw new Error(`Database Write Error: MongoDB migration write not acknowledged for audit record ${recordId}.`);
        }
        if (res && (res.upsertedCount > 0 || res.modifiedCount > 0 || res.matchedCount === 0)) {
          migratedCount++;
        }
      }
    }

    AuditRepository.migrationDone = true;
    return migratedCount;
  }

  static async getAll(): Promise<any[]> {
    if (!isMongoConfigured() && !AuditRepository.mockCollection) {
      if (isTest()) {
        return [...inMemoryAuditStore].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      }
      throw new Error('Database unavailable: Cannot fetch audit logs when MongoDB is not configured.');
    }

    await AuditRepository.ensureIndexes();
    await AuditRepository.migrateLegacyRecords();

    const coll = await AuditRepository.getCollection();
    if (AuditRepository.mockCollection || (isTest() && !isMongoConfigured())) {
      const all = await coll.find();
      return (all || []).sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }

    const docs = await withMongoTimeout(
      coll.find({}).sort({ timestamp: -1 }).toArray(),
      10000,
      'fetch audit logs'
    );
    return (docs || []).map(({ _id, ...rest }: any) => rest);
  }

  static async add(entry: {
    user?: string;
    role?: string;
    action: string;
    target: string;
    status?: 'Success' | 'Warning' | 'Error';
    ip?: string;
    details?: any;
    metadata?: any;
    id?: string;
    timestamp?: string;
  }): Promise<any> {
    if (!entry || typeof entry !== 'object') {
      throw new Error('Validation Error: Audit log entry must be an object.');
    }

    const record = {
      id: entry.id || `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: entry.timestamp || new Date().toISOString(),
      user: entry.user || 'System Admin',
      role: entry.role || 'Super Admin',
      action: typeof entry.action === 'string' && entry.action.trim() ? entry.action.trim() : 'General Action',
      target: typeof entry.target === 'string' && entry.target.trim() ? entry.target.trim() : 'Portal',
      status: entry.status === 'Warning' || entry.status === 'Error' ? entry.status : 'Success',
      ip: entry.ip,
      details: entry.details,
      metadata: entry.metadata
    };

    if (!isMongoConfigured() && !AuditRepository.mockCollection) {
      if (isTest()) {
        inMemoryAuditStore.unshift(record);
        return record;
      }
      throw new Error('Database unavailable: Cannot add audit log when MongoDB is not configured.');
    }

    await AuditRepository.ensureIndexes();
    const coll = await AuditRepository.getCollection();

    if (AuditRepository.mockCollection || (isTest() && !isMongoConfigured())) {
      await coll.insertOne(record);
      return record;
    }

    const res = await withMongoTimeout(
      coll.updateOne(
        { id: record.id },
        { $setOnInsert: record },
        { upsert: true }
      ),
      10000,
      'add audit log'
    );

    if (res && res.acknowledged === false) {
      throw new Error('Database Write Error: MongoDB audit log write operation was not acknowledged.');
    }

    return record;
  }
}

function createInMemoryMongoCollectionAdapter() {
  return {
    async find(_query?: any) {
      return [...inMemoryAuditStore];
    },
    async findOne(query: any) {
      if (query?.id) {
        return inMemoryAuditStore.find(item => item.id === query.id) || null;
      }
      return null;
    },
    async insertOne(doc: any) {
      inMemoryAuditStore.unshift(doc);
      return { acknowledged: true, insertedId: doc.id };
    },
    async updateOne(filter: any, update: any, _options?: any) {
      const id = filter?.id;
      const existing = inMemoryAuditStore.find(item => item.id === id);
      if (existing) {
        return { acknowledged: true, upsertedCount: 0, modifiedCount: 0, matchedCount: 1 };
      }
      const setOnInsert = update?.$setOnInsert || {};
      inMemoryAuditStore.unshift(setOnInsert);
      return { acknowledged: true, upsertedCount: 1, modifiedCount: 0, matchedCount: 0 };
    },
    async createIndex(_spec: any, _options?: any) {
      return 'index_created';
    }
  };
}
