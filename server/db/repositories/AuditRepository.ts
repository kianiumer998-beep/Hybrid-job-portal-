import crypto from 'crypto';
import { Database } from '../database';
import { getMongoDb, isMongoConfigured, withMongoTimeout } from '../mongodb';

const COLLECTION_NAME = 'audit_logs';

const isTest = () => process.env.IS_TEST === 'true';

let inMemoryAuditStore: any[] = [];
let indexInitPromise: Promise<void> | null = null;
let migrationPromise: Promise<number> | null = null;

export interface AuditWriteOutcome {
  persisted: boolean;
  record?: any;
  auditWarning?: string;
}

function canonicalizeValue(val: any): any {
  if (val === null || typeof val !== 'object') {
    return val;
  }
  if (Array.isArray(val)) {
    return val.map(canonicalizeValue);
  }
  const sorted: Record<string, any> = {};
  for (const key of Object.keys(val).sort()) {
    if (val[key] !== undefined) {
      sorted[key] = canonicalizeValue(val[key]);
    }
  }
  return sorted;
}

function computeDeterministicLegacyAuditId(record: Record<string, any>, index: number): string {
  const { id: _ignoredId, _id: _ignoredMongoId, ...rest } = record;
  const payload = JSON.stringify({
    index,
    record: canonicalizeValue(rest)
  });
  const hash = crypto.createHash('sha256').update(payload).digest('hex');
  return `legacy-audit-${hash.slice(0, 24)}`;
}

function stripMongoId(doc: any): any {
  if (!doc || typeof doc !== 'object') return doc;
  const { _id, ...rest } = doc;
  return rest;
}

function auditRecordsMatch(existing: any, expected: any): boolean {
  const cleanExisting = canonicalizeValue(stripMongoId(existing));
  const cleanExpected = canonicalizeValue(stripMongoId(expected));
  return JSON.stringify(cleanExisting) === JSON.stringify(cleanExpected);
}

function validateAndNormalizeLegacyRecord(log: any, index: number): Record<string, any> {
  if (!log || typeof log !== 'object' || Array.isArray(log)) {
    throw new Error(`Data Integrity Error: Malformed legacy audit record at index ${index} (expected object).`);
  }

  const rawId = log.id;
  if (rawId !== undefined && rawId !== null && typeof rawId !== 'string') {
    throw new Error(`Data Integrity Error: Invalid non-string id at legacy audit record index ${index}.`);
  }

  const hasValidId = typeof rawId === 'string' && rawId.trim().length > 0;
  const idLabel = hasValidId ? rawId : '(missing id)';

  if (typeof log.action !== 'string' || !log.action.trim()) {
    throw new Error(
      `Data Integrity Error: Malformed legacy audit record at index ${index} (id: ${idLabel}): missing or invalid "action".`
    );
  }

  if (log.timestamp !== undefined && log.timestamp !== null) {
    if (typeof log.timestamp !== 'string' || !log.timestamp.trim() || Number.isNaN(Date.parse(log.timestamp))) {
      throw new Error(
        `Data Integrity Error: Malformed legacy audit record at index ${index} (id: ${idLabel}): invalid "timestamp".`
      );
    }
  }

  const { _id: _mongoId, ...preservedFields } = log;
  const recordId = hasValidId ? rawId : computeDeterministicLegacyAuditId(preservedFields, index);

  return {
    ...preservedFields,
    id: recordId
  };
}

export class AuditRepository {
  static mockCollection: any = null;
  private static migrationDone = false;

  static setMockCollection(coll: any): void {
    if (coll !== null && !isTest()) {
      throw new Error('Security violation: Mock collection injection is strictly prohibited outside test mode.');
    }
    AuditRepository.mockCollection = coll;
    AuditRepository.migrationDone = false;
    indexInitPromise = null;
    migrationPromise = null;
  }

  static resetTestStore(): void {
    AuditRepository.mockCollection = null;
    AuditRepository.migrationDone = false;
    indexInitPromise = null;
    migrationPromise = null;
    inMemoryAuditStore = [];
  }

  static isMigrationComplete(): boolean {
    return AuditRepository.migrationDone;
  }

  private static useRealMongo(): boolean {
    return !AuditRepository.mockCollection && isMongoConfigured();
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
      const initRun = (async () => {
        try {
          const coll = await AuditRepository.getCollection();
          if (!coll || typeof coll.createIndex !== 'function') {
            throw new Error('MongoDB audit collection does not expose createIndex().');
          }
          const useTimeout = AuditRepository.useRealMongo();
          const idx1 = coll.createIndex({ id: 1 }, { unique: true });
          await (useTimeout ? withMongoTimeout(idx1, 10000, 'create audit id unique index') : idx1);
          const idx2 = coll.createIndex({ timestamp: -1 });
          await (useTimeout ? withMongoTimeout(idx2, 10000, 'create audit timestamp index') : idx2);
        } catch (err: any) {
          throw new Error(`MongoDB audit indexes initialization failed: ${err?.message || err}`);
        }
      })();
      indexInitPromise = initRun;
      try {
        await initRun;
      } catch (err) {
        if (indexInitPromise === initRun) {
          indexInitPromise = null;
        }
        throw err;
      }
      return;
    }
    return indexInitPromise;
  }

  static async migrateLegacyRecords(): Promise<number> {
    if (AuditRepository.migrationDone) return 0;

    if (migrationPromise) {
      return migrationPromise;
    }

    const run = (async () => {
      try {
        let legacyLogs: any;
        try {
          legacyLogs = Database.getAuditLogs();
        } catch (readErr: any) {
          throw new Error(`Legacy audit migration read failed: ${readErr?.message || readErr}`);
        }

        if (!Array.isArray(legacyLogs)) {
          throw new Error('Data Integrity Error: Legacy audit logs source did not return an array.');
        }

        if (legacyLogs.length === 0) {
          AuditRepository.migrationDone = true;
          return 0;
        }

        const seenIds = new Map<string, number>();
        const normalizedRecords: Array<{ index: number; record: Record<string, any> }> = [];

        for (let i = 0; i < legacyLogs.length; i++) {
          const normalized = validateAndNormalizeLegacyRecord(legacyLogs[i], i);
          if (seenIds.has(normalized.id)) {
            throw new Error(
              `Data Integrity Error: Duplicate legacy audit record ID "${normalized.id}" at index ${i} (first seen at index ${seenIds.get(normalized.id)}).`
            );
          }
          seenIds.set(normalized.id, i);
          normalizedRecords.push({ index: i, record: normalized });
        }

        const coll = await AuditRepository.getCollection();
        const useTimeout = AuditRepository.useRealMongo();
        let migratedCount = 0;

        for (const { index, record } of normalizedRecords) {
          let res: any;
          try {
            const writePromise = coll.updateOne(
              { id: record.id },
              { $setOnInsert: record },
              { upsert: true }
            );
            res = useTimeout
              ? await withMongoTimeout(writePromise, 10000, 'migrate legacy audit record')
              : await writePromise;
          } catch (writeErr: any) {
            const isDuplicateKey =
              writeErr?.code === 11000 ||
              /E11000|duplicate key/i.test(writeErr?.message || '');

            if (!isDuplicateKey) {
              throw new Error(
                `Migration write failed at index ${index} (id: ${record.id}): ${writeErr?.message || writeErr}`
              );
            }

            const findPromise = coll.findOne({ id: record.id });
            const existing = useTimeout
              ? await withMongoTimeout(findPromise, 10000, 'verify concurrent migration audit record')
              : await findPromise;

            if (!existing) {
              throw new Error(
                `Data Integrity Error: Duplicate-key reported at index ${index} (id: ${record.id}), but existing record was not found.`
              );
            }

            if (!auditRecordsMatch(existing, record)) {
              throw new Error(
                `Data Integrity Error: Duplicate-key conflict at index ${index} (id: ${record.id}): existing record does not match source record.`
              );
            }

            // Concurrent instance already persisted the exact expected record
            continue;
          }

          if (!res || res.acknowledged === false) {
            throw new Error(
              `Database Write Error: MongoDB migration write not acknowledged at index ${index} (id: ${record.id}).`
            );
          }

          const upserted = Number(res.upsertedCount || 0);
          const matched = Number(res.matchedCount || 0);
          if (upserted === 0 && matched === 0) {
            throw new Error(
              `Migration Verification Error: Legacy audit record at index ${index} (id: ${record.id}) was neither inserted nor matched.`
            );
          }

          if (upserted > 0) {
            migratedCount++;
          }
        }

        AuditRepository.migrationDone = true;
        return migratedCount;
      } catch (err) {
        AuditRepository.migrationDone = false;
        throw err;
      }
    })();

    migrationPromise = run;
    try {
      return await run;
    } finally {
      if (migrationPromise === run) {
        migrationPromise = null;
      }
    }
  }

  static async getAll(): Promise<any[]> {
    if (!isMongoConfigured() && !AuditRepository.mockCollection) {
      if (isTest()) {
        return [...inMemoryAuditStore].sort(
          (a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()
        );
      }
      throw new Error('Database unavailable: Cannot fetch audit logs when MongoDB is not configured.');
    }

    await AuditRepository.ensureIndexes();
    await AuditRepository.migrateLegacyRecords();

    const coll = await AuditRepository.getCollection();
    const useTimeout = AuditRepository.useRealMongo();
    const findResult = coll.find({});

    let rawDocs: any[];
    if (findResult && typeof findResult.sort === 'function') {
      const toArrayPromise = findResult.sort({ timestamp: -1 }).toArray();
      rawDocs = useTimeout ? await withMongoTimeout(toArrayPromise, 10000, 'fetch audit logs') : await toArrayPromise;
    } else if (findResult && typeof findResult.toArray === 'function') {
      const toArrayPromise = findResult.toArray();
      rawDocs = useTimeout ? await withMongoTimeout(toArrayPromise, 10000, 'fetch audit logs') : await toArrayPromise;
    } else {
      rawDocs = useTimeout ? await withMongoTimeout(findResult, 10000, 'fetch audit logs') : await findResult;
    }

    return (rawDocs || [])
      .map(stripMongoId)
      .sort((a: any, b: any) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
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
    [key: string]: any;
  }): Promise<any> {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error('Validation Error: Audit log entry must be an object.');
    }

    const { _id: _mongoId, ...restEntry } = entry;
    const record: Record<string, any> = {
      ...restEntry,
      id: entry.id || `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: entry.timestamp || new Date().toISOString(),
      user: entry.user || 'System Admin',
      role: entry.role || 'Super Admin',
      action: typeof entry.action === 'string' && entry.action.trim() ? entry.action.trim() : 'General Action',
      target: typeof entry.target === 'string' && entry.target.trim() ? entry.target.trim() : 'Portal',
      status: entry.status === 'Warning' || entry.status === 'Error' ? entry.status : 'Success'
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
    const useTimeout = AuditRepository.useRealMongo();

    const writePromise = coll.updateOne(
      { id: record.id },
      { $setOnInsert: record },
      { upsert: true }
    );
    const res = useTimeout
      ? await withMongoTimeout(writePromise, 10000, 'add audit log')
      : await writePromise;

    if (!res || res.acknowledged === false) {
      throw new Error('Database Write Error: MongoDB audit log write operation was not acknowledged.');
    }

    return record;
  }

  /**
   * Non-destructive audit persistence wrapper for call-sites where the primary
   * business operation has already succeeded (or an authorization denial is being enforced).
   * Never swallows failures silently: logs explicitly and returns auditPersisted + auditWarning.
   */
  static async addAfterPrimaryOperation(
    entry: Parameters<typeof AuditRepository.add>[0],
    context?: string
  ): Promise<AuditWriteOutcome> {
    try {
      const record = await AuditRepository.add(entry);
      return { persisted: true, record };
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      const prefix = context ? `[AuditPersistenceError] [${context}]` : '[AuditPersistenceError]';
      console.error(`${prefix} Durable audit log persistence failed for "${entry?.action}":`, errMsg);
      return {
        persisted: false,
        auditWarning: `Audit log could not be persisted durably: ${errMsg}`
      };
    }
  }
}

function createInMemoryMongoCollectionAdapter() {
  return {
    async find(_query?: any) {
      return [...inMemoryAuditStore];
    },
    async findOne(query: any) {
      if (query?.id) {
        return inMemoryAuditStore.find((item) => item.id === query.id) || null;
      }
      return null;
    },
    async insertOne(doc: any) {
      inMemoryAuditStore.unshift(doc);
      return { acknowledged: true, insertedId: doc.id };
    },
    async updateOne(filter: any, update: any, _options?: any) {
      const id = filter?.id;
      const existing = inMemoryAuditStore.find((item) => item.id === id);
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
