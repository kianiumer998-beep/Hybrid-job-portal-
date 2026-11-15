import assert from 'assert';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import express from 'express';
import { createServer, Server } from 'http';

process.env.IS_TEST = 'true';
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = '';
process.env.MONGO_URI = '';

import { AuditRepository, SAFE_AUDIT_WARNING } from '../db/repositories/AuditRepository';
import { UserRepository } from '../db/repositories/UserRepository';
import { PaymentRepository } from '../db/repositories/PaymentRepository';
import { PaymentSettingsRepository } from '../db/repositories/PaymentSettingsRepository';
import { ApplicationRepository } from '../db/repositories/ApplicationRepository';
import { JobRepository } from '../db/repositories/JobRepository';
import { JobVisibilityRepository } from '../db/repositories/JobVisibilityRepository';
import { NotificationRepository } from '../db/repositories/NotificationRepository';
import { AdRepository } from '../db/repositories/AdRepository';
import { PricingRepository } from '../db/repositories/PricingRepository';
import { CurrencyRepository } from '../db/repositories/CurrencyRepository';
import { SeoRepository } from '../db/repositories/SeoRepository';
import { SystemSettingsRepository } from '../db/repositories/SystemSettingsRepository';
import { Database } from '../db/database';
import { auditRouter } from '../routes/auditRoutes';
import { transactionRouter } from '../routes/transactionRoutes';
import { applicationRouter } from '../routes/applicationRoutes';
import { jobRouter } from '../routes/jobRoutes';
import { userRouter } from '../routes/userRoutes';
import { adRouter } from '../routes/adRoutes';
import { pricingRouter } from '../routes/pricingRoutes';
import { currencyRouter } from '../routes/currencyRoutes';
import { seoRouter } from '../routes/seoRoutes';
import { paymentSettingsRouter } from '../routes/paymentSettingsRoutes';
import { systemSettingsRouter } from '../routes/systemSettingsRoutes';
import { jobVisibilityRouter } from '../routes/jobVisibilityRoutes';
import { createToken } from '../auth/authManager';
import { cvStorage } from '../services/cvStorage';
import { INITIAL_CURRENCY_CONFIG } from '../../src/data/mockAdminSuiteData';

const AUDIT_JSON_PATH = path.resolve(process.cwd(), 'data', 'audit_logs.json');
const DATA_DIR = path.resolve(process.cwd(), 'data');

function sha256File(filePath: string): string | null {
  if (!fs.existsSync(filePath)) return null;
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function getDataHashes(): Record<string, string | null> {
  const result: Record<string, string | null> = {};
  for (const file of fs.readdirSync(DATA_DIR).sort()) {
    if (file.endsWith('.json')) {
      result[file] = sha256File(path.join(DATA_DIR, file));
    }
  }
  return result;
}

interface MockAuditOptions {
  failInsert?: boolean;
  failFind?: boolean;
  failCreateIndex?: boolean;
  unacknowledged?: boolean;
  failAtWriteCount?: number;
  simulateRaceOnIds?: Record<string, any>;
  nonDuplicateErrorOnIds?: Record<string, Error>;
}

function createMockAuditCollection(initialDocs: any[] = [], options: MockAuditOptions = {}) {
  const store = new Map<string, any>();
  initialDocs.forEach((d) => {
    if (d.id) store.set(d.id, JSON.parse(JSON.stringify(d)));
  });

  let writeAttempts = 0;

  return {
    store,
    options,
    async find(_query?: any) {
      if (options.failFind) throw new Error('Simulated MongoDB audit find failure');
      return Array.from(store.values()).sort(
        (a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()
      );
    },
    async findOne(query: any) {
      if (query?.id) {
        return store.get(query.id) ? JSON.parse(JSON.stringify(store.get(query.id))) : null;
      }
      return null;
    },
    async insertOne(doc: any) {
      if (options.failInsert) throw new Error('Simulated MongoDB audit insert failure');
      store.set(doc.id, JSON.parse(JSON.stringify(doc)));
      return { acknowledged: true, insertedId: doc.id };
    },
    async updateOne(filter: any, update: any, _opts?: any) {
      writeAttempts++;
      if (options.failInsert) {
        throw new Error('Simulated MongoDB audit write failure');
      }
      if (options.failAtWriteCount && writeAttempts === options.failAtWriteCount) {
        throw new Error(`Simulated partial migration write failure at attempt #${writeAttempts}`);
      }
      if (options.unacknowledged) {
        return { acknowledged: false, upsertedCount: 0, modifiedCount: 0, matchedCount: 0 };
      }

      const id = filter?.id;
      if (options.nonDuplicateErrorOnIds && options.nonDuplicateErrorOnIds[id]) {
        throw options.nonDuplicateErrorOnIds[id];
      }
      if (options.simulateRaceOnIds && Object.prototype.hasOwnProperty.call(options.simulateRaceOnIds, id)) {
        const racedDoc = options.simulateRaceOnIds[id];
        if (racedDoc) {
          store.set(id, JSON.parse(JSON.stringify(racedDoc)));
        }
        const dupErr: any = new Error(`E11000 duplicate key error collection: audit_logs index: id_1 dup key: { id: "${id}" }`);
        dupErr.code = 11000;
        throw dupErr;
      }

      const existing = store.get(id);
      if (existing) {
        return { acknowledged: true, upsertedCount: 0, modifiedCount: 0, matchedCount: 1 };
      }
      const setOnInsert = update?.$setOnInsert || {};
      store.set(id, JSON.parse(JSON.stringify(setOnInsert)));
      return { acknowledged: true, upsertedCount: 1, modifiedCount: 0, matchedCount: 0 };
    },
    async createIndex(_spec: any, _opts?: any) {
      if (options.failCreateIndex) {
        throw new Error('Simulated MongoDB createIndex failure');
      }
      return 'index_ok';
    }
  };
}

async function runAuditDurableTests() {
  console.log('==================================================================');
  console.log('  STEP-D.1.1 — DURABLE AUDIT LOGS & MIGRATION SAFETY TESTS        ');
  console.log('==================================================================');

  const preTestJsonHash = sha256File(AUDIT_JSON_PATH);
  const preAllDataHashes = getDataHashes();
  const realLegacyLogs = Database.getAuditLogs() || [];
  console.log(`[Test Setup] Loaded ${realLegacyLogs.length} legacy audit records from data/audit_logs.json`);

  let totalTests = 0;
  let passedTests = 0;

  async function runCase(name: string, fn: () => Promise<void>) {
    totalTests++;
    await fn();
    passedTests++;
    console.log(`✓ ${name}`);
  }

  const origGetAuditLogs = Database.getAuditLogs;

  try {
    // 1. New audit record persists to MongoDB
    await runCase('Test 1: New audit record persists to MongoDB', async () => {
      AuditRepository.resetTestStore();
      const mockColl = createMockAuditCollection();
      AuditRepository.setMockCollection(mockColl);

      const added = await AuditRepository.add({
        user: 'Test Admin',
        role: 'Super Admin',
        action: 'Test Durable Add',
        target: 'Audit Collection',
        status: 'Success',
        metadata: { testId: 1 }
      });
      assert.ok(added.id, 'Added record must have an ID');
      assert.strictEqual(added.action, 'Test Durable Add');

      const all = await AuditRepository.getAll();
      assert.strictEqual(all.length, realLegacyLogs.length + 1);
      assert.ok(all.find((l) => l.id === added.id && l.action === 'Test Durable Add'));
    });

    // 2. Existing 335 legacy records migrate without loss
    await runCase(`Test 2: Existing ${realLegacyLogs.length} legacy records migrate without loss`, async () => {
      AuditRepository.resetTestStore();
      const mockColl = createMockAuditCollection();
      AuditRepository.setMockCollection(mockColl);

      const all = await AuditRepository.getAll();
      assert.strictEqual(all.length, realLegacyLogs.length);
      assert.strictEqual(AuditRepository.isMigrationComplete(), true);
    });

    // 3. Legacy JSON read failure does not mark migration complete & propagates clear error
    await runCase('Test 3: Legacy JSON read failure propagates error and does not mark migration complete', async () => {
      AuditRepository.resetTestStore();
      const mockColl = createMockAuditCollection();
      AuditRepository.setMockCollection(mockColl);

      Database.getAuditLogs = () => {
        throw new Error('EACCES: simulated legacy audit_logs.json read error');
      };

      let threw = false;
      try {
        await AuditRepository.getAll();
      } catch (err: any) {
        threw = true;
        assert.ok(err.message.includes('Legacy audit migration read failed'), `Unexpected message: ${err.message}`);
      } finally {
        Database.getAuditLogs = origGetAuditLogs;
      }

      assert.strictEqual(threw, true, 'Read failure must propagate');
      assert.strictEqual(AuditRepository.isMigrationComplete(), false, 'Migration must NOT be marked complete on read failure');
    });

    // 4. Migration can retry successfully after temporary read & index initialization failures
    await runCase('Test 4: Migration retries successfully after temporary read and index failures', async () => {
      AuditRepository.resetTestStore();
      const mockColl = createMockAuditCollection([], { failCreateIndex: true });
      AuditRepository.setMockCollection(mockColl);

      // First fail on index creation
      let idxFailed = false;
      try {
        await AuditRepository.getAll();
      } catch (err: any) {
        idxFailed = true;
        assert.ok(err.message.includes('indexes initialization failed'));
      }
      assert.strictEqual(idxFailed, true);
      assert.strictEqual(AuditRepository.isMigrationComplete(), false);

      // Heal index creation, fail JSON read temporarily
      mockColl.options.failCreateIndex = false;
      Database.getAuditLogs = () => {
        throw new Error('Temporary EIO read error');
      };
      let readFailed = false;
      try {
        await AuditRepository.getAll();
      } catch (_readErr: any) {
        readFailed = true;
      } finally {
        Database.getAuditLogs = origGetAuditLogs;
      }
      assert.strictEqual(readFailed, true);
      assert.strictEqual(AuditRepository.isMigrationComplete(), false);

      // Retry succeeds cleanly
      const all = await AuditRepository.getAll();
      assert.strictEqual(all.length, realLegacyLogs.length);
      assert.strictEqual(AuditRepository.isMigrationComplete(), true);
    });

    // 5. Missing legacy IDs produce deterministic IDs & repeated migration does not duplicate them
    await runCase('Test 5 & 6: Missing legacy IDs produce deterministic IDs and repeated migration creates no duplicates', async () => {
      const legacyWithoutIds = [
        {
          timestamp: '2026-08-01T10:00:00.000Z',
          user: 'Legacy Actor A',
          role: 'Admin',
          action: 'Legacy Action No ID 1',
          target: 'Target A',
          status: 'Success'
        },
        {
          timestamp: '2026-08-01T10:05:00.000Z',
          user: 'Legacy Actor B',
          role: 'Moderator',
          action: 'Legacy Action No ID 2',
          target: 'Target B',
          status: 'Warning'
        }
      ];

      Database.getAuditLogs = () => legacyWithoutIds;
      try {
        AuditRepository.resetTestStore();
        const mockColl1 = createMockAuditCollection();
        AuditRepository.setMockCollection(mockColl1);
        const migrated1 = await AuditRepository.getAll();
        assert.strictEqual(migrated1.length, 2);
        const idsRun1 = migrated1.map((r) => r.id).sort();
        assert.ok(idsRun1[0].startsWith('legacy-audit-'));
        assert.ok(idsRun1[1].startsWith('legacy-audit-'));
        assert.notStrictEqual(idsRun1[0], idsRun1[1]);

        // Simulate fresh application restart against same DB store
        AuditRepository.resetTestStore();
        const mockColl2 = createMockAuditCollection(migrated1);
        AuditRepository.setMockCollection(mockColl2);
        const countNew = await AuditRepository.migrateLegacyRecords();
        assert.strictEqual(countNew, 0, 'Repeated migration must not re-insert missing-ID records');
        const migrated2 = await AuditRepository.getAll();
        assert.strictEqual(migrated2.length, 2);
        assert.deepStrictEqual(migrated2.map((r) => r.id).sort(), idsRun1);
      } finally {
        Database.getAuditLogs = origGetAuditLogs;
      }
    });

    // 6. Additional legacy fields, original IDs, timestamps, and metadata are preserved verbatim
    await runCase('Test 7: Additional legacy fields, original IDs, timestamps, and metadata are preserved', async () => {
      const customLegacy = [
        {
          id: 'orig-legacy-999',
          timestamp: '2025-05-05T05:05:05.000Z',
          user: 'Original Actor',
          role: 'Custom Role',
          action: 'Custom Legacy Event',
          target: 'Legacy Target',
          status: 'Warning',
          ip: '10.0.0.42',
          details: 'Detailed explanation',
          metadata: { nested: { flag: true, count: 7 } },
          customLegacySource: 'archive-v1',
          correlationId: 'corr-abc-123'
        }
      ];

      Database.getAuditLogs = () => customLegacy;
      try {
        AuditRepository.resetTestStore();
        const mockColl = createMockAuditCollection();
        AuditRepository.setMockCollection(mockColl);

        const all = await AuditRepository.getAll();
        assert.strictEqual(all.length, 1);
        const rec = all[0];
        assert.strictEqual(rec.id, 'orig-legacy-999');
        assert.strictEqual(rec.timestamp, '2025-05-05T05:05:05.000Z');
        assert.strictEqual(rec.ip, '10.0.0.42');
        assert.strictEqual(rec.details, 'Detailed explanation');
        assert.deepStrictEqual(rec.metadata, { nested: { flag: true, count: 7 } });
        assert.strictEqual(rec.customLegacySource, 'archive-v1');
        assert.strictEqual(rec.correlationId, 'corr-abc-123');
      } finally {
        Database.getAuditLogs = origGetAuditLogs;
      }

      // Also verify real 335 legacy records keep original IDs and timestamps
      AuditRepository.resetTestStore();
      const realMock = createMockAuditCollection();
      AuditRepository.setMockCollection(realMock);
      const realMigrated = await AuditRepository.getAll();
      const firstReal = realLegacyLogs[0];
      const matchedReal = realMigrated.find((r) => r.id === firstReal.id);
      assert.ok(matchedReal, 'Original ID from data/audit_logs.json must be preserved');
      assert.strictEqual(matchedReal.timestamp, firstReal.timestamp, 'Original timestamp must be preserved');
    });

    // 7. Malformed legacy records explicitly report position & ID
    await runCase('Test 8: Malformed legacy records report index and ID rather than silently skipping', async () => {
      const badLegacy = [
        { id: 'ok-1', timestamp: '2026-01-01T00:00:00.000Z', action: 'Valid', target: 'T' },
        { id: 'bad-rec-2', timestamp: '2026-01-01T00:00:00.000Z', action: '', target: 'T' }
      ];
      Database.getAuditLogs = () => badLegacy;
      try {
        AuditRepository.resetTestStore();
        const mockColl = createMockAuditCollection();
        AuditRepository.setMockCollection(mockColl);

        let errorMsg = '';
        try {
          await AuditRepository.getAll();
        } catch (err: any) {
          errorMsg = err.message;
        }
        assert.ok(errorMsg.includes('index 1'), `Must report index 1, got: ${errorMsg}`);
        assert.ok(errorMsg.includes('bad-rec-2'), `Must report record ID bad-rec-2, got: ${errorMsg}`);
        assert.strictEqual(AuditRepository.isMigrationComplete(), false);
      } finally {
        Database.getAuditLogs = origGetAuditLogs;
      }
    });

    // 8. Concurrent migration duplicate-key race is safely handled
    await runCase('Test 9: Concurrent migration duplicate-key race (matching record) is safely handled', async () => {
      const raceRecord = {
        id: 'race-id-1',
        timestamp: '2026-03-01T12:00:00.000Z',
        user: 'Admin',
        role: 'Super Admin',
        action: 'Concurrent Action',
        target: 'Target',
        status: 'Success'
      };
      Database.getAuditLogs = () => [raceRecord];
      try {
        AuditRepository.resetTestStore();
        const mockColl = createMockAuditCollection([], {
          simulateRaceOnIds: { 'race-id-1': raceRecord }
        });
        AuditRepository.setMockCollection(mockColl);

        const results = await Promise.all([
          AuditRepository.getAll(),
          AuditRepository.getAll(),
          AuditRepository.getAll()
        ]);
        for (const r of results) {
          assert.strictEqual(r.length, 1);
          assert.strictEqual(r[0].id, 'race-id-1');
        }
        assert.strictEqual(AuditRepository.isMigrationComplete(), true);
      } finally {
        Database.getAuditLogs = origGetAuditLogs;
      }
    });

    // 9. Genuine MongoDB failure & conflicting duplicate-key are NOT mistaken for duplicate-key success
    await runCase('Test 10: Genuine MongoDB failure and conflicting E11000 are NOT treated as success', async () => {
      const sampleRec = {
        id: 'err-rec-1',
        timestamp: '2026-03-01T12:00:00.000Z',
        user: 'Admin',
        role: 'Super Admin',
        action: 'Test Action',
        target: 'Target'
      };
      Database.getAuditLogs = () => [sampleRec];
      try {
        // Case A: Non-duplicate MongoDB error
        AuditRepository.resetTestStore();
        const failingColl = createMockAuditCollection([], {
          nonDuplicateErrorOnIds: { 'err-rec-1': new Error('MongoNetworkError: connection reset') }
        });
        AuditRepository.setMockCollection(failingColl);
        let networkFailed = false;
        try {
          await AuditRepository.migrateLegacyRecords();
        } catch (err: any) {
          networkFailed = true;
          assert.ok(err.message.includes('MongoNetworkError'));
        }
        assert.strictEqual(networkFailed, true);
        assert.strictEqual(AuditRepository.isMigrationComplete(), false);

        // Case B: E11000 where existing record does NOT match source record
        AuditRepository.resetTestStore();
        const conflictColl = createMockAuditCollection([], {
          simulateRaceOnIds: {
            'err-rec-1': { ...sampleRec, action: 'DIFFERENT ACTION' }
          }
        });
        AuditRepository.setMockCollection(conflictColl);
        let conflictFailed = false;
        try {
          await AuditRepository.migrateLegacyRecords();
        } catch (err: any) {
          conflictFailed = true;
          assert.ok(err.message.includes('does not match legacy source record'));
        }
        assert.strictEqual(conflictFailed, true);
        assert.strictEqual(AuditRepository.isMigrationComplete(), false);
      } finally {
        Database.getAuditLogs = origGetAuditLogs;
      }
    });

    // 10. Partial migration does not report completion and retries cleanly
    await runCase('Test 11: Partial migration does not report completion and retries idempotently', async () => {
      const twoLogs = [
        { id: 'part-1', timestamp: '2026-04-01T00:00:00.000Z', action: 'First', target: 'T1' },
        { id: 'part-2', timestamp: '2026-04-02T00:00:00.000Z', action: 'Second', target: 'T2' }
      ];
      Database.getAuditLogs = () => twoLogs;
      try {
        AuditRepository.resetTestStore();
        const mockColl = createMockAuditCollection([], { failAtWriteCount: 2 });
        AuditRepository.setMockCollection(mockColl);

        let partialFailed = false;
        try {
          await AuditRepository.migrateLegacyRecords();
        } catch (err: any) {
          partialFailed = true;
          assert.ok(err.message.includes('partial migration'));
        }
        assert.strictEqual(partialFailed, true);
        assert.strictEqual(AuditRepository.isMigrationComplete(), false, 'Partial migration must NOT mark complete');
        assert.strictEqual(mockColl.store.size, 1, 'First record was written before failure');

        // Retry succeeds without duplicating part-1
        mockColl.options.failAtWriteCount = undefined;
        const migratedRetry = await AuditRepository.migrateLegacyRecords();
        assert.strictEqual(migratedRetry, 1, 'Only the remaining 1 record should be newly inserted');
        assert.strictEqual(AuditRepository.isMigrationComplete(), true);
        assert.strictEqual(mockColl.store.size, 2);
      } finally {
        Database.getAuditLogs = origGetAuditLogs;
      }
    });

    // 11. Missing MongoDB fails closed in production & write rejection never reports success
    await runCase('Test 12: Missing MongoDB in production fails closed & rejected write never reports success', async () => {
      const origIsTest = process.env.IS_TEST;
      try {
        process.env.IS_TEST = 'false';
        process.env.MONGODB_URI = '';
        AuditRepository.resetTestStore();

        let prodFailed = false;
        try {
          await AuditRepository.add({ action: 'Fail Prod', target: 'Test' });
        } catch (err: any) {
          prodFailed = true;
          assert.ok(err.message.includes('MongoDB is not configured'));
        }
        assert.strictEqual(prodFailed, true);
      } finally {
        process.env.IS_TEST = origIsTest;
      }

      AuditRepository.resetTestStore();
      AuditRepository.setMockCollection(createMockAuditCollection([], { failInsert: true }));
      let writeFailed = false;
      try {
        await AuditRepository.add({ action: 'Should Reject', target: 'Test' });
      } catch {
        writeFailed = true;
      }
      assert.strictEqual(writeFailed, true);
    });

    // 12. Timestamp ordering & no 500-record truncation
    await runCase('Test 13: Descending timestamp order and no 500-record truncation', async () => {
      Database.getAuditLogs = () => [];
      try {
        AuditRepository.resetTestStore();
        const mockColl = createMockAuditCollection();
        AuditRepository.setMockCollection(mockColl);

        await AuditRepository.add({ action: 'Action A', target: 'T1', timestamp: '2026-01-01T00:00:00.000Z' });
        await AuditRepository.add({ action: 'Action B', target: 'T2', timestamp: '2026-01-03T00:00:00.000Z' });
        await AuditRepository.add({ action: 'Action C', target: 'T3', timestamp: '2026-01-02T00:00:00.000Z' });

        for (let i = 0; i < 505; i++) {
          await AuditRepository.add({
            action: `Bulk ${i}`,
            target: `T-${i}`,
            timestamp: '2025-01-01T00:00:00.000Z'
          });
        }

        const all = await AuditRepository.getAll();
        assert.strictEqual(all.length, 508, 'History must not be truncated at 500 records');
        assert.strictEqual(all[0].action, 'Action B');
        assert.strictEqual(all[1].action, 'Action C');
        assert.strictEqual(all[2].action, 'Action A');
      } finally {
        Database.getAuditLogs = origGetAuditLogs;
      }
    });

    // 13. Audit GET permissions & POST actor identity spoofing protection
    await runCase('Test 14: Audit GET permissions and POST actor identity protections remain intact', async () => {
      Database.getAuditLogs = () => [];
      try {
        AuditRepository.resetTestStore();
        const mockColl = createMockAuditCollection();
        AuditRepository.setMockCollection(mockColl);

        const app = express();
        app.use(express.json());
        app.use('/api/audit', auditRouter);

        const server: Server = createServer(app);
        await new Promise<void>((resolve) => server.listen(0, resolve));
        const port = (server.address() as any).port;
        const baseUrl = `http://127.0.0.1:${port}/api/audit`;

        try {
          const adminUser = UserRepository.create({
            id: `audit-admin-${Date.now()}`,
            name: 'Real Admin',
            email: `audit-admin-${Date.now()}@portal.test`,
            password: 'Password123!',
            role: 'Super Admin',
            status: 'Active'
          });
          const normalUser = UserRepository.create({
            id: `audit-user-${Date.now()}`,
            name: 'Normal User',
            email: `audit-user-${Date.now()}@portal.test`,
            password: 'Password123!',
            role: 'Member',
            status: 'Active'
          });

          const adminToken = createToken({ userId: adminUser.id, email: adminUser.email, name: adminUser.name, role: adminUser.role });
          const normalToken = createToken({ userId: normalUser.id, email: normalUser.email, name: normalUser.name, role: normalUser.role });

          const resUnauth = await fetch(baseUrl);
          assert.strictEqual(resUnauth.status, 401);

          const resForbid = await fetch(baseUrl, { headers: { Authorization: `Bearer ${normalToken}` } });
          assert.strictEqual(resForbid.status, 403);

          const resPost = await fetch(baseUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${normalToken}`
            },
            body: JSON.stringify({
              user: 'Spoofed SuperAdmin',
              role: 'Super Admin',
              action: 'Spoof Attempt',
              target: 'Portal'
            })
          });
          assert.strictEqual(resPost.status, 200);

          const logs = await AuditRepository.getAll();
          const entry = logs.find((l) => l.action === 'Spoof Attempt');
          assert.ok(entry);
          assert.strictEqual(entry.user, 'Normal User');
          assert.strictEqual(entry.role, 'Member');

          const resAdminGet = await fetch(baseUrl, { headers: { Authorization: `Bearer ${adminToken}` } });
          assert.strictEqual(resAdminGet.status, 200);
          const jsonRes = (await resAdminGet.json()) as any;
          assert.strictEqual(jsonRes.success, true);
          assert.ok(Array.isArray(jsonRes.logs));

          // Failing audit write on POST /api/audit reports explicit 500 failure without raw DB leakage
          mockColl.options.failInsert = true;
          const resFailPost = await fetch(baseUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${normalToken}`
            },
            body: JSON.stringify({ action: 'Fail Durable Write', target: 'Portal' })
          });
          assert.strictEqual(resFailPost.status, 500);
          const failPostJson = (await resFailPost.json()) as any;
          assert.strictEqual(failPostJson.success, false);
          assert.strictEqual(failPostJson.message, 'Failed to persist audit log.');
          assert.ok(!String(failPostJson.message).includes('Simulated MongoDB'));
        } finally {
          await new Promise<void>((resolve) => server.close(() => resolve()));
        }
      } finally {
        Database.getAuditLogs = origGetAuditLogs;
      }
    });

    // 14-17. Business Operation Safety Tests (Payment, Application, Job, Unauthorized CV Access)
    await (async () => {
      const origAuditAdd = AuditRepository.add;
      const origGetSettings = PaymentSettingsRepository.getPublicSettings;
      const origPayCreate = PaymentRepository.createAsync;
      const origPayFindTx = PaymentRepository.findByTransactionIdAsync;
      const origNotifCreate = NotificationRepository.createAsync;
      const origApplySettings = Database.getApplySettings;
      const origJobGetById = JobRepository.getById;
      const origJobUpdate = JobRepository.update;
      const origJobApprovePending = JobRepository.approvePending;
      const origJobGetPending = JobRepository.getPending;
      const origJobGetAll = JobRepository.getAll;
      const origIsPremium = JobVisibilityRepository.isUserPremiumAuthoritative;
      const origApplyPolicy = JobVisibilityRepository.applyPolicyToJob;
      const origAppFindExisting = ApplicationRepository.findExistingAsync;
      const origAppCreate = ApplicationRepository.createAsync;
      const origAppGetAll = ApplicationRepository.getAllAsync;
      const origUserGetById = UserRepository.getByIdAsync;
      const origCvExists = cvStorage.exists;

      const createdTransactions: any[] = [];
      const createdApplications: any[] = [];
      let approvePendingCallCount = 0;
      let jobUpdateCallCount = 0;

      const testApplicant = {
        id: 'biz-applicant-1',
        userId: 'biz-applicant-1',
        name: 'Biz Applicant',
        email: 'biz-applicant@test.local',
        phone: '+92 300 1234567',
        role: 'Member'
      };
      const testAdmin = {
        id: 'biz-admin-1',
        userId: 'biz-admin-1',
        name: 'Biz Admin',
        email: 'biz-admin@test.local',
        role: 'Super Admin',
        permissions: ['*']
      };
      let currentReqUser: any = testApplicant;

      const app = express();
      app.use(express.json());
      app.use((req, _res, next) => {
        (req as any).user = currentReqUser;
        next();
      });
      app.use('/api/transactions', transactionRouter);
      app.use('/api/applications', applicationRouter);
      app.use('/api/jobs', jobRouter);

      const server: Server = createServer(app);
      await new Promise<void>((resolve) => server.listen(0, resolve));
      const baseUrl = `http://127.0.0.1:${(server.address() as any).port}`;

      try {
        // Force AuditRepository.add to reject (simulating raw MongoDB failure with internal host details)
        AuditRepository.add = async () => {
          throw new Error('MongoServerSelectionError: connection timed out to primary-rs0.internal.mongo:27017');
        };
        NotificationRepository.createAsync = async (d: any) => d;
        JobVisibilityRepository.isUserPremiumAuthoritative = async () => true;
        JobVisibilityRepository.applyPolicyToJob = async (j: any) => j;
        UserRepository.getByIdAsync = async (id: string) =>
          id === testAdmin.id ? testAdmin : id === testApplicant.id ? testApplicant : null;

        // Test 15: Payment submission succeeds even when audit write fails
        await runCase('Test 15: Audit failure after payment persistence preserves success and exposes auditWarning', async () => {
          PaymentSettingsRepository.getPublicSettings = async () => ({
            isConfigured: true,
            settings: {
              isConfigured: true,
              defaultMethod: 'easypaisa',
              methods: {
                easypaisa: {
                  id: 'easypaisa',
                  name: 'EasyPaisa',
                  accountTitle: 'Test Account',
                  accountNumber: '03001234567',
                  enabled: true,
                  transactionIdRequired: true,
                  screenshotRequired: false
                }
              }
            } as any
          });
          PaymentRepository.findByTransactionIdAsync = async () => null;
          PaymentRepository.createAsync = async (tx: any) => {
            const saved = { ...tx, id: `tx-test-${createdTransactions.length + 1}` };
            createdTransactions.push(saved);
            return saved;
          };

          currentReqUser = testApplicant;
          const res = await fetch(`${baseUrl}/api/transactions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              amount: 1000,
              type: 'Wallet Deposit',
              paymentMethod: 'easypaisa',
              transactionId: `TXN-AUDIT-FAIL-${Date.now()}`,
              senderName: 'Biz Applicant',
              senderPhoneOrAccount: '03001234567'
            })
          });
          const data = (await res.json()) as any;
          assert.strictEqual(res.status, 201, `Expected 201, got ${res.status}: ${JSON.stringify(data)}`);
          assert.strictEqual(data.success, true);
          assert.ok(data.transaction?.id);
          assert.strictEqual(data.auditPersisted, false);
          assert.strictEqual(data.auditWarning, SAFE_AUDIT_WARNING);
          assert.ok(!String(data.auditWarning).includes('primary-rs0.internal.mongo'), 'Raw DB hostname must not leak publicly');
          assert.strictEqual(createdTransactions.length, 1, 'Payment must only be persisted once');
        });

        // Test 16: Application creation succeeds even when audit write fails
        await runCase('Test 16: Audit failure after application creation preserves success and exposes auditWarning', async () => {
          Database.getApplySettings = () => ({
            requireCv: false,
            requirePhone: false,
            requireEmail: false,
            enforceDeadlines: false,
            allowExternalApplication: true,
            enableApplyButton: true,
            successMessage: 'Application submitted!'
          });
          JobRepository.getById = async (id: string) => ({
            id,
            title: 'Senior Engineer',
            company: 'Acme Corp',
            status: 'Approved',
            applicationsCount: 0,
            submittedByUserId: testAdmin.id
          });
          JobRepository.update = async (id: string, updates: any) => ({ id, ...updates });
          ApplicationRepository.findExistingAsync = async () => null;
          ApplicationRepository.createAsync = async (payload: any) => {
            const saved = { ...payload, id: `app-test-${createdApplications.length + 1}`, appliedAt: new Date().toISOString() };
            createdApplications.push(saved);
            return saved;
          };

          currentReqUser = testApplicant;
          const res = await fetch(`${baseUrl}/api/applications`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jobId: 'job-live-1',
              jobTitle: 'Senior Engineer',
              companyName: 'Acme Corp',
              coverLetter: 'Test cover letter'
            })
          });
          const data = (await res.json()) as any;
          assert.strictEqual(res.status, 201, `Expected 201, got ${res.status}: ${JSON.stringify(data)}`);
          assert.strictEqual(data.success, true);
          assert.ok(data.application?.id);
          assert.strictEqual(data.auditPersisted, false);
          assert.strictEqual(data.auditWarning, SAFE_AUDIT_WARNING);
          assert.ok(!String(data.auditWarning).includes('primary-rs0.internal.mongo'), 'Raw DB hostname must not leak publicly');
          assert.strictEqual(createdApplications.length, 1, 'Application must only be created once');
        });

        // Test 17: Job approval & job update succeed without unsafe retry/rollback when audit write fails
        await runCase('Test 17: Audit failure after job operations preserves committed result without unsafe retry', async () => {
          JobRepository.getPending = async () => [
            { id: 'pending-job-1', title: 'Pending Role', company: 'Beta Co', status: 'Pending' }
          ];
          JobRepository.getAll = async () => ({ jobs: [], total: 0, page: 1, limit: 50 });
          JobRepository.approvePending = async (id: string) => {
            approvePendingCallCount++;
            return { id, title: 'Pending Role', company: 'Beta Co', status: 'Approved' };
          };
          JobRepository.update = async (id: string, body: any) => {
            jobUpdateCallCount++;
            return { id, title: body.title || 'Updated Role', status: 'Approved' };
          };

          currentReqUser = testAdmin;
          const resApprove = await fetch(`${baseUrl}/api/jobs/queue/pending/pending-job-1/approve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ force: true })
          });
          const approveData = (await resApprove.json()) as any;
          assert.strictEqual(resApprove.status, 200);
          assert.strictEqual(approveData.success, true);
          assert.strictEqual(approveData.job?.status, 'Approved');
          assert.strictEqual(approveData.auditPersisted, false);
          assert.ok(approveData.auditWarning);
          assert.strictEqual(approvePendingCallCount, 1, 'Job approval must not be retried');

          const resUpdate = await fetch(`${baseUrl}/api/jobs/job-live-1`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: 'Updated Role' })
          });
          const updateData = (await resUpdate.json()) as any;
          assert.strictEqual(resUpdate.status, 200);
          assert.strictEqual(updateData.success, true);
          assert.strictEqual(updateData.job?.title, 'Updated Role');
          assert.strictEqual(updateData.auditPersisted, false);
          assert.ok(updateData.auditWarning);
          assert.strictEqual(jobUpdateCallCount, 1, 'Job update must not be retried');
        });

        // Test 18: Unauthorized CV access remains denied (403) even if audit persistence fails
        await runCase('Test 18: Unauthorized CV access remains denied (403) even when audit write fails', async () => {
          cvStorage.exists = async () => true;
          ApplicationRepository.getAllAsync = async () => [];
          currentReqUser = testApplicant; // Not owner, not admin, no valid token

          const res = await fetch(`${baseUrl}/api/applications/cv/secret-candidate-cv.pdf`);
          const data = (await res.json()) as any;
          assert.strictEqual(res.status, 403, `Expected 403 Access Denied, got ${res.status}: ${JSON.stringify(data)}`);
          assert.strictEqual(data.success, false);
          assert.ok(data.message.includes('Access Denied'));
          assert.strictEqual(data.auditPersisted, false);
          assert.ok(data.auditWarning);
        });
      } finally {
        AuditRepository.add = origAuditAdd;
        PaymentSettingsRepository.getPublicSettings = origGetSettings;
        PaymentRepository.createAsync = origPayCreate;
        PaymentRepository.findByTransactionIdAsync = origPayFindTx;
        NotificationRepository.createAsync = origNotifCreate;
        Database.getApplySettings = origApplySettings;
        JobRepository.getById = origJobGetById;
        JobRepository.update = origJobUpdate;
        JobRepository.approvePending = origJobApprovePending;
        JobRepository.getPending = origJobGetPending;
        JobRepository.getAll = origJobGetAll;
        JobVisibilityRepository.isUserPremiumAuthoritative = origIsPremium;
        JobVisibilityRepository.applyPolicyToJob = origApplyPolicy;
        ApplicationRepository.findExistingAsync = origAppFindExisting;
        ApplicationRepository.createAsync = origAppCreate;
        ApplicationRepository.getAllAsync = origAppGetAll;
        UserRepository.getByIdAsync = origUserGetById;
        cvStorage.exists = origCvExists;
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    })();

    // 20-23. Existing-ID migration matching vs conflict, incomplete state, and retry after resolution
    await runCase('Test 20: Existing matching ID is accepted cleanly without duplicate insertion', async () => {
      const legacyRec = {
        id: 'existing-match-1',
        timestamp: '2026-02-01T09:30:00.000Z',
        user: 'Admin User',
        role: 'Super Admin',
        action: 'Existing Matched Action',
        target: 'Portal Setting',
        status: 'Success',
        metadata: { version: 2, tag: 'alpha' },
        extraLegacyNote: 'preserved'
      };
      Database.getAuditLogs = () => [legacyRec];
      try {
        AuditRepository.resetTestStore();
        // Pre-populate Mongo collection with same logical record plus Mongo _id and different property ordering
        const preExistingInDb = {
          _id: 'mongo-objectid-xyz',
          extraLegacyNote: 'preserved',
          metadata: { tag: 'alpha', version: 2 },
          status: 'Success',
          target: 'Portal Setting',
          action: 'Existing Matched Action',
          role: 'Super Admin',
          user: 'Admin User',
          timestamp: '2026-02-01T09:30:00.000Z',
          id: 'existing-match-1'
        };
        const mockColl = createMockAuditCollection([preExistingInDb]);
        AuditRepository.setMockCollection(mockColl);

        const migratedCount = await AuditRepository.migrateLegacyRecords();
        assert.strictEqual(migratedCount, 0, 'Pre-existing matching record must not be newly inserted');
        assert.strictEqual(AuditRepository.isMigrationComplete(), true);
        assert.strictEqual(mockColl.store.size, 1);
      } finally {
        Database.getAuditLogs = origGetAuditLogs;
      }
    });

    await runCase('Test 21: Existing conflicting ID stops migration, preserves existing doc, stays incomplete, and retries cleanly when resolved', async () => {
      const legacyRec = {
        id: 'existing-conflict-1',
        timestamp: '2026-02-01T09:30:00.000Z',
        user: 'Legacy Actor',
        role: 'Admin',
        action: 'Legacy Action Original',
        target: 'Target A',
        status: 'Success'
      };
      const conflictingDbDoc = {
        _id: 'mongo-obj-conflict',
        id: 'existing-conflict-1',
        timestamp: '2026-02-01T09:30:00.000Z',
        user: 'Other Actor',
        role: 'Super Admin',
        action: 'Different Conflicting Action',
        target: 'Target B',
        status: 'Warning'
      };

      Database.getAuditLogs = () => [legacyRec];
      try {
        AuditRepository.resetTestStore();
        const mockColl = createMockAuditCollection([conflictingDbDoc]);
        AuditRepository.setMockCollection(mockColl);

        let conflictErrMsg = '';
        try {
          await AuditRepository.getAll();
        } catch (err: any) {
          conflictErrMsg = err.message;
        }
        assert.ok(conflictErrMsg.includes('Existing audit record conflict'), `Expected conflict error, got: ${conflictErrMsg}`);
        assert.ok(conflictErrMsg.includes('existing-conflict-1'));
        assert.strictEqual(AuditRepository.isMigrationComplete(), false, 'Migration MUST remain incomplete on conflict');
        assert.strictEqual(mockColl.store.get('existing-conflict-1')?.action, 'Different Conflicting Action', 'Conflicting document must NOT be overwritten');

        // Resolve conflict and verify retry succeeds cleanly
        mockColl.store.set('existing-conflict-1', JSON.parse(JSON.stringify(legacyRec)));
        const allAfterResolve = await AuditRepository.getAll();
        assert.strictEqual(AuditRepository.isMigrationComplete(), true, 'Migration completes once conflict is resolved');
        assert.strictEqual(allAfterResolve.length, 1);
        assert.strictEqual(allAfterResolve[0].action, 'Legacy Action Original');
      } finally {
        Database.getAuditLogs = origGetAuditLogs;
      }
    });

    // 22. Public audit warning sanitization & server-side diagnostic logging
    await runCase('Test 22: Public auditWarning hides raw DB details while server logs retain diagnostics', async () => {
      const origAuditAdd = AuditRepository.add;
      const origConsoleError = console.error;
      const capturedErrors: string[] = [];

      try {
        console.error = (...args: any[]) => {
          capturedErrors.push(args.map((a) => String(a)).join(' '));
        };
        AuditRepository.add = async () => {
          throw new Error('MongoNetworkError: failed to connect to cluster0-shard-00-01.abc.mongodb.net:27017');
        };

        const outcome = await AuditRepository.addAfterPrimaryOperation(
          { action: 'Sensitive Op', target: 'Users', user: 'Admin', role: 'Super Admin' },
          'PUT /api/users/:id'
        );

        assert.strictEqual(outcome.persisted, false);
        assert.strictEqual(outcome.auditWarning, SAFE_AUDIT_WARNING);
        assert.ok(!outcome.auditWarning!.includes('mongodb.net'));
        assert.ok(!outcome.auditWarning!.includes('27017'));
        assert.ok(!outcome.auditWarning!.includes('MongoNetworkError'));

        const loggedText = capturedErrors.join('\n');
        assert.ok(loggedText.includes('PUT /api/users/:id'), 'Server log must preserve route context');
        assert.ok(loggedText.includes('cluster0-shard-00-01.abc.mongodb.net:27017'), 'Server log must preserve internal DB diagnostic detail');
      } finally {
        AuditRepository.add = origAuditAdd;
        console.error = origConsoleError;
      }
    });

    // 23-26. Remaining non-scraper routes & PaymentRepository compensation audit-failure safety
    await (async () => {
      const origAuditAdd = AuditRepository.add;
      const origDbAddAuditLog = Database.addAuditLog;
      const origUserGetById = UserRepository.getByIdAsync;
      const origUserUpdate = UserRepository.updateAsync;
      const origUserCredit = UserRepository.creditWalletBalanceAsync;
      const origAdCreate = AdRepository.createAsync;
      const origPricingUpdate = PricingRepository.update;
      const origCurrencySave = CurrencyRepository.saveConfig;
      const origSeoSave = SeoRepository.saveConfig;
      const origPaySettingsUpdate = PaymentSettingsRepository.updateSettings;
      const origSysWhatsAppSave = SystemSettingsRepository.saveWhatsAppSupportConfig;
      const origSysWhatsAppGet = SystemSettingsRepository.getWhatsAppSupportConfig;
      const origVisSavePolicy = JobVisibilityRepository.savePolicy;
      const origPayGetById = PaymentRepository.getByIdAsync;
      const origPayUpdate = PaymentRepository.updateAsync;
      const origDbGetAds = Database.getAds;

      let directJsonAuditCalls = 0;
      let userUpdateCalls = 0;
      let walletCreditCalls = 0;

      const adminUser = {
        id: 'stepd12-admin-1',
        userId: 'stepd12-admin-1',
        name: 'StepD12 Admin',
        email: 'stepd12-admin@test.local',
        role: 'Super Admin',
        permissions: ['*']
      };

      const app = express();
      app.use(express.json());
      app.use((req, _res, next) => {
        (req as any).user = adminUser;
        next();
      });
      app.use('/api/users', userRouter);
      app.use('/api/ads', adRouter);
      app.use('/api/pricing', pricingRouter);
      app.use('/api/currency', currencyRouter);
      app.use('/api/seo', seoRouter);
      app.use('/api/payment-settings', paymentSettingsRouter);
      app.use('/api/system-settings', systemSettingsRouter);
      app.use('/api/visibility', jobVisibilityRouter);

      const server: Server = createServer(app);
      await new Promise<void>((resolve) => server.listen(0, resolve));
      const baseUrl = `http://127.0.0.1:${(server.address() as any).port}`;

      try {
        Database.addAuditLog = () => {
          directJsonAuditCalls++;
          throw new Error('Direct Database.addAuditLog must not be called by updated routes');
        };
        AuditRepository.add = async () => {
          throw new Error('MongoWriteConcernError: replica set primary stepped down at db-node-2.internal:27017');
        };
        UserRepository.getByIdAsync = async (id: string) => {
          if (id === adminUser.id) return adminUser;
          if (id === 'target-user-1') {
            return { id: 'target-user-1', name: 'Target User', email: 'target@test.local', role: 'Member', walletBalance: 500 };
          }
          return null;
        };

        await runCase('Test 23: Audit failure after PUT /api/users/:id preserves user update without false 500', async () => {
          UserRepository.updateAsync = async (id: string, updates: any) => {
            userUpdateCalls++;
            return { id, name: updates.name || 'Target User', email: 'target@test.local', role: 'Member', ...updates };
          };

          const res = await fetch(`${baseUrl}/api/users/target-user-1`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Updated Target User' })
          });
          const data = (await res.json()) as any;
          assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}: ${JSON.stringify(data)}`);
          assert.strictEqual(data.success, true);
          assert.strictEqual(data.user?.name, 'Updated Target User');
          assert.strictEqual(data.auditPersisted, false);
          assert.strictEqual(data.auditWarning, SAFE_AUDIT_WARNING);
          assert.ok(!String(data.auditWarning).includes('db-node-2.internal'));
          assert.strictEqual(userUpdateCalls, 1, 'User update must only execute once');
        });

        await runCase('Test 24: Audit failure after ad & configuration updates preserves success without direct JSON writes', async () => {
          AdRepository.createAsync = async (payload: any) => ({ ...payload, id: 'ad-stepd12-1' });
          PricingRepository.update = async (payload: any) => ({ ...payload, updatedAt: new Date().toISOString() });
          CurrencyRepository.saveConfig = async (payload: any) => payload;
          SeoRepository.saveConfig = async (payload: any) => ({ ...payload, siteTitle: payload.siteTitle || 'Updated Site' });
          PaymentSettingsRepository.updateSettings = async (payload: any) => ({
            isConfigured: true,
            methods: { easypaisa: { enabled: true } },
            ...payload
          });
          SystemSettingsRepository.getWhatsAppSupportConfig = async () => ({
            enabled: false,
            phoneNumber: '',
            defaultMessage: 'Hi',
            agentName: 'Support',
            supportHoursText: '9-5',
            position: 'bottom-right',
            showGreetingBubble: false,
            greetingText: 'Hello'
          });
          SystemSettingsRepository.saveWhatsAppSupportConfig = async (cfg: any) => cfg;
          JobVisibilityRepository.savePolicy = async (source: any, rules: any) => ({
            source,
            fieldRules: rules,
            updatedAt: new Date().toISOString()
          });

          const adRes = await fetch(`${baseUrl}/api/ads`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: 'StepD12 Banner Ad',
              clientName: 'Acme',
              placement: 'sidebar-top',
              targetUrl: 'https://example.com',
              type: 'banner'
            })
          });
          const adData = (await adRes.json()) as any;
          assert.strictEqual(adRes.status, 201, `Ad create failed: ${JSON.stringify(adData)}`);
          assert.strictEqual(adData.success, true);
          assert.strictEqual(adData.auditPersisted, false);
          assert.strictEqual(adData.auditWarning, SAFE_AUDIT_WARNING);

          const endpoints: Array<{ method: string; url: string; body: any }> = [
            { method: 'PUT', url: `${baseUrl}/api/pricing`, body: { featuredJobPrice: 2500 } },
            { method: 'PUT', url: `${baseUrl}/api/currency/config`, body: INITIAL_CURRENCY_CONFIG },
            { method: 'PUT', url: `${baseUrl}/api/seo/config`, body: { siteTitle: 'PakJobs Portal' } },
            { method: 'PUT', url: `${baseUrl}/api/payment-settings`, body: { defaultMethod: 'easypaisa' } },
            { method: 'PUT', url: `${baseUrl}/api/system-settings/communication`, body: { whatsAppSupportConfig: { agentName: 'Support Team' } } },
            { method: 'POST', url: `${baseUrl}/api/visibility/policies`, body: { source: 'user_posted', fieldRules: { company: 'Free' } } }
          ];

          for (const ep of endpoints) {
            const r = await fetch(ep.url, {
              method: ep.method,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(ep.body)
            });
            const j = (await r.json()) as any;
            assert.strictEqual(r.status, 200, `${ep.method} ${ep.url} failed: ${r.status} ${JSON.stringify(j)}`);
            assert.strictEqual(j.success, true);
            assert.strictEqual(j.auditPersisted, false);
            assert.strictEqual(j.auditWarning, SAFE_AUDIT_WARNING);
          }

          assert.strictEqual(directJsonAuditCalls, 0, 'Direct Database.addAuditLog must NOT be used by any updated route');
        });

        await runCase('Test 25: Audit failure in PaymentRepository.compensateAdvertisementPayment executes wallet refund once with safe warning', async () => {
          const mockTxState: Record<string, any> = {
            'tx-comp-1': {
              id: 'tx-comp-1',
              transactionId: 'TXN-COMP-1',
              userId: 'target-user-1',
              userName: 'Target User',
              type: 'Advertisement',
              paymentMethod: 'Wallet Balance',
              amount: 300,
              currency: 'PKR',
              status: 'Success'
            }
          };

          Database.getAds = () => [];
          PaymentRepository.getByIdAsync = async (id: string) =>
            mockTxState[id] ? { ...mockTxState[id] } : null;
          PaymentRepository.updateAsync = async (id: string, updates: any) => {
            if (!mockTxState[id]) return null;
            mockTxState[id] = { ...mockTxState[id], ...updates };
            return { ...mockTxState[id] };
          };
          UserRepository.creditWalletBalanceAsync = async (_userId: string, amt: number) => {
            walletCreditCalls++;
            return { id: 'target-user-1', walletBalance: 500 + amt };
          };

          const compResult = await PaymentRepository.compensateAdvertisementPayment('tx-comp-1', {
            authenticatedUserId: 'target-user-1',
            isAdmin: false,
            failureReason: 'Simulated ad creation failure'
          });

          assert.strictEqual(compResult.compensated, true);
          assert.strictEqual(compResult.restoredAmount, 300);
          assert.strictEqual(compResult.auditPersisted, false);
          assert.strictEqual(compResult.auditWarning, SAFE_AUDIT_WARNING);
          assert.strictEqual(walletCreditCalls, 1, 'Wallet refund credit must execute strictly once');
        });
      } finally {
        AuditRepository.add = origAuditAdd;
        Database.addAuditLog = origDbAddAuditLog;
        UserRepository.getByIdAsync = origUserGetById;
        UserRepository.updateAsync = origUserUpdate;
        UserRepository.creditWalletBalanceAsync = origUserCredit;
        AdRepository.createAsync = origAdCreate;
        PricingRepository.update = origPricingUpdate;
        CurrencyRepository.saveConfig = origCurrencySave;
        SeoRepository.saveConfig = origSeoSave;
        PaymentSettingsRepository.updateSettings = origPaySettingsUpdate;
        SystemSettingsRepository.saveWhatsAppSupportConfig = origSysWhatsAppSave;
        SystemSettingsRepository.getWhatsAppSupportConfig = origSysWhatsAppGet;
        JobVisibilityRepository.savePolicy = origVisSavePolicy;
        PaymentRepository.getByIdAsync = origPayGetById;
        PaymentRepository.updateAsync = origPayUpdate;
        Database.getAds = origDbGetAds;
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    })();

    // 19. Existing audit_logs.json and all data/*.json files remain byte-for-byte unchanged
    await runCase('Test 19: data/audit_logs.json and all data/*.json remain byte-for-byte unchanged', async () => {
      const postTestJsonHash = sha256File(AUDIT_JSON_PATH);
      assert.strictEqual(postTestJsonHash, preTestJsonHash, 'data/audit_logs.json must remain byte-for-byte unchanged');
      const postAllDataHashes = getDataHashes();
      assert.deepStrictEqual(postAllDataHashes, preAllDataHashes, 'All data/*.json files must remain byte-for-byte unchanged');
    });
  } finally {
    Database.getAuditLogs = origGetAuditLogs;
  }

  console.log('==================================================================');
  console.log(`  RESULTS: ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY!`);
  console.log('==================================================================');
}

runAuditDurableTests().catch((err) => {
  console.error('Audit durable tests failed:', err);
  process.exit(1);
});
