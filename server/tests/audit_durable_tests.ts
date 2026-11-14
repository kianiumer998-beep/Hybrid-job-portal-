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

import { AuditRepository } from '../db/repositories/AuditRepository';
import { UserRepository } from '../db/repositories/UserRepository';
import { Database } from '../db/database';
import { auditRouter } from '../routes/auditRoutes';
import { createToken } from '../auth/authManager';

const AUDIT_JSON_PATH = path.resolve(process.cwd(), 'data', 'audit_logs.json');

function sha256File(filePath: string): string | null {
  if (!fs.existsSync(filePath)) return null;
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function createMockAuditCollection(initialDocs: any[] = [], options: { failInsert?: boolean; failFind?: boolean; unacknowledged?: boolean } = {}) {
  const store = new Map<string, any>();
  initialDocs.forEach(d => {
    if (d.id) store.set(d.id, JSON.parse(JSON.stringify(d)));
  });

  return {
    store,
    async find() {
      if (options.failFind) throw new Error('Simulated MongoDB audit find failure');
      return Array.from(store.values()).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    },
    async findOne(query: any) {
      if (query?.id) {
        return store.get(query.id) || null;
      }
      return null;
    },
    async insertOne(doc: any) {
      if (options.failInsert) throw new Error('Simulated MongoDB audit insert failure');
      store.set(doc.id, JSON.parse(JSON.stringify(doc)));
      return { acknowledged: true, insertedId: doc.id };
    },
    async updateOne(filter: any, update: any, optionsObj?: any) {
      if (options.failInsert) throw new Error('Simulated MongoDB audit write failure');
      if (options.unacknowledged) {
        return { acknowledged: false, upsertedCount: 0, modifiedCount: 0, matchedCount: 0 };
      }
      const id = filter?.id;
      const existing = store.get(id);
      if (existing) {
        return { acknowledged: true, upsertedCount: 0, modifiedCount: 0, matchedCount: 1 };
      }
      const setOnInsert = update?.$setOnInsert || {};
      store.set(id, JSON.parse(JSON.stringify(setOnInsert)));
      return { acknowledged: true, upsertedCount: 1, modifiedCount: 0, matchedCount: 0 };
    },
    async createIndex() {
      return 'index_ok';
    }
  };
}

async function runAuditDurableTests() {
  console.log('==================================================================');
  console.log('  STEP-D.1 — DURABLE AUDIT LOGS & SAFE LEGACY MIGRATION TESTS     ');
  console.log('==================================================================');

  const preTestJsonHash = sha256File(AUDIT_JSON_PATH);
  const legacyLogs = Database.getAuditLogs() || [];
  console.log(`[Test Setup] Loaded ${legacyLogs.length} legacy audit records from data/audit_logs.json`);

  // Test 1: New audit record persists to MongoDB
  await (async function test1() {
    AuditRepository.resetTestStore();
    const mockColl = createMockAuditCollection();
    AuditRepository.setMockCollection(mockColl);

    const newEntry = {
      user: 'Test Admin',
      role: 'Super Admin',
      action: 'Test Durable Add',
      target: 'Audit Collection',
      status: 'Success' as const,
      metadata: { testId: 1 }
    };

    const added = await AuditRepository.add(newEntry);
    assert.ok(added.id, 'Added record must have an ID');
    assert.strictEqual(added.action, 'Test Durable Add');

    const all = await AuditRepository.getAll();
    assert.strictEqual(all.length, legacyLogs.length + 1, 'Collection must contain legacy records plus the added record');
    const found = all.find(l => l.action === 'Test Durable Add');
    assert.ok(found, 'Added record must be present in fetched audit logs');
    console.log('✓ Test 1 Passed: New audit record persists to MongoDB.');
  })();

  // Test 2: Existing 335 legacy records migrate without loss
  await (async function test2() {
    AuditRepository.resetTestStore();
    const mockColl = createMockAuditCollection();
    AuditRepository.setMockCollection(mockColl);

    const all = await AuditRepository.getAll();
    assert.strictEqual(all.length, legacyLogs.length, `All ${legacyLogs.length} legacy records must migrate without loss`);
    console.log(`✓ Test 2 Passed: Existing ${legacyLogs.length} legacy records migrated without loss.`);
  })();

  // Test 3: Re-running migration creates no duplicates
  await (async function test3() {
    const all1 = await AuditRepository.getAll();
    const all2 = await AuditRepository.getAll();
    assert.strictEqual(all1.length, all2.length, 'Re-running migration/getAll must create no duplicates');
    console.log('✓ Test 3 Passed: Re-running migration creates no duplicates.');
  })();

  // Test 4: Concurrent migration attempts remain duplicate-safe
  await (async function test4() {
    AuditRepository.resetTestStore();
    const mockColl = createMockAuditCollection();
    AuditRepository.setMockCollection(mockColl);

    const results = await Promise.all([
      AuditRepository.getAll(),
      AuditRepository.getAll(),
      AuditRepository.getAll()
    ]);

    for (const res of results) {
      assert.strictEqual(res.length, legacyLogs.length);
    }
    console.log('✓ Test 4 Passed: Concurrent migration attempts remain duplicate-safe.');
  })();

  // Test 5: Original IDs and timestamps are preserved
  await (async function test5() {
    AuditRepository.resetTestStore();
    const mockColl = createMockAuditCollection();
    AuditRepository.setMockCollection(mockColl);

    const all = await AuditRepository.getAll();
    const firstLegacy = legacyLogs[0];
    const found = all.find(l => l.id === firstLegacy.id);
    assert.ok(found, 'Legacy record ID must be preserved');
    assert.strictEqual(found.timestamp, firstLegacy.timestamp, 'Legacy timestamp must be preserved');
    console.log('✓ Test 5 Passed: Original IDs and timestamps are preserved.');
  })();

  // Test 6: Missing MongoDB configuration fails closed in production
  await (async function test6() {
    const origEnv = process.env.IS_TEST;
    try {
      process.env.IS_TEST = 'false';
      process.env.MONGODB_URI = '';
      AuditRepository.resetTestStore();

      let failed = false;
      try {
        await AuditRepository.add({ action: 'Fail Prod', target: 'Test' });
      } catch (err: any) {
        failed = true;
        assert.ok(err.message.includes('MongoDB is not configured') || err.message.includes('Database unavailable'));
      }
      assert.strictEqual(failed, true, 'Operation must fail closed when MongoDB is unconfigured in production');
    } finally {
      process.env.IS_TEST = origEnv;
    }
    console.log('✓ Test 6 Passed: Missing MongoDB configuration fails closed in production.');
  })();

  // Test 7: MongoDB connection/write failure does not report successful persistence
  await (async function test7() {
    AuditRepository.resetTestStore();
    const failingColl = createMockAuditCollection([], { failInsert: true });
    AuditRepository.setMockCollection(failingColl);

    let failed = false;
    try {
      await AuditRepository.add({ action: 'Should Fail', target: 'Test' });
    } catch (err: any) {
      failed = true;
    }
    assert.strictEqual(failed, true, 'MongoDB write failure must throw and not report success');
    console.log('✓ Test 7 Passed: MongoDB connection failure does not report successful persistence.');
  })();

  // Test 8: Audit GET returns records in correct timestamp order (descending)
  await (async function test8() {
    AuditRepository.resetTestStore();
    const mockColl = createMockAuditCollection();
    AuditRepository.setMockCollection(mockColl);

    await AuditRepository.add({ action: 'Action A', target: 'T1', timestamp: '2026-01-01T00:00:00.000Z' });
    await AuditRepository.add({ action: 'Action B', target: 'T2', timestamp: '2026-01-03T00:00:00.000Z' });
    await AuditRepository.add({ action: 'Action C', target: 'T3', timestamp: '2026-01-02T00:00:00.000Z' });

    const all = await AuditRepository.getAll();
    const customActions = all.filter(l => ['Action A', 'Action B', 'Action C'].includes(l.action));
    assert.strictEqual(customActions[0].action, 'Action B');
    assert.strictEqual(customActions[1].action, 'Action C');
    assert.strictEqual(customActions[2].action, 'Action A');
    console.log('✓ Test 8 Passed: Audit GET returns records in correct timestamp order.');
  })();

  // Test 9 & 10: API endpoints, auth, audit.view permission, and client-supplied actor identity ignoring
  await (async function test9_10() {
    AuditRepository.resetTestStore();
    const mockColl = createMockAuditCollection();
    AuditRepository.setMockCollection(mockColl);

    const app = express();
    app.use(express.json());
    app.use('/api/audit', auditRouter);

    const server: Server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address() as any;
    const baseUrl = `http://127.0.0.1:${address.port}/api/audit`;

    try {
      const adminUser = UserRepository.create({
        id: 'admin-1',
        name: 'Real Admin',
        email: 'admin@portal.test',
        password: 'Password123!',
        role: 'Super Admin',
        status: 'Active'
      });
      const normalUser = UserRepository.create({
        id: 'user-1',
        name: 'Normal User',
        email: 'user@portal.test',
        password: 'Password123!',
        role: 'Member',
        status: 'Active'
      });

      const adminToken = createToken({ userId: adminUser.id, email: adminUser.email, name: adminUser.name, role: adminUser.role });
      const normalToken = createToken({ userId: normalUser.id, email: normalUser.email, name: normalUser.name, role: normalUser.role });

      // Test GET without token -> 401
      const resUnauthorized = await fetch(baseUrl);
      assert.strictEqual(resUnauthorized.status, 401);

      // Test GET with normal user (lacks audit.view) -> 403
      const resForbidden = await fetch(baseUrl, {
        headers: { Authorization: `Bearer ${normalToken}` }
      });
      assert.strictEqual(resForbidden.status, 403);

      // Test POST with normal user attempting to spoof admin identity in body
      const resPost = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${normalToken}`
        },
        body: JSON.stringify({
          user: 'Spoofed SuperAdmin',
          role: 'Super Admin',
          action: 'Malicious Action',
          target: 'System'
        })
      });
      assert.strictEqual(resPost.status, 200);

      const logs = await AuditRepository.getAll();
      const addedLog = logs.find(l => l.action === 'Malicious Action');
      assert.ok(addedLog, 'Audit log must be created');
      assert.strictEqual(addedLog.user, 'Normal User', 'Client-supplied actor identity must be ignored and replaced by authenticated token identity');
      assert.strictEqual(addedLog.role, 'Member', 'Client-supplied role must be ignored');

      // Test GET with admin token -> 200 with logs
      const resAdminGet = await fetch(baseUrl, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      assert.strictEqual(resAdminGet.status, 200);
      const jsonRes = await resAdminGet.json() as any;
      assert.strictEqual(jsonRes.success, true);
      assert.ok(Array.isArray(jsonRes.logs));
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }

    console.log('✓ Tests 9 & 10 Passed: Auth, audit.view permission, and client-supplied actor identity ignoring.');
  })();

  // Test 11: Audit history is not truncated at 500 records in MongoDB
  await (async function test11() {
    AuditRepository.resetTestStore();
    const mockColl = createMockAuditCollection();
    AuditRepository.setMockCollection(mockColl);

    for (let i = 0; i < 505; i++) {
      await AuditRepository.add({ action: `Action ${i}`, target: `Target ${i}` });
    }

    const all = await AuditRepository.getAll();
    assert.ok(all.length >= 505, 'MongoDB audit history must not be truncated at 500 records');
    console.log('✓ Test 11 Passed: Audit history is not truncated at 500 records.');
  })();

  // Test 12: Existing JSON file remains byte-for-byte unchanged during tests
  await (async function test12() {
    const postTestJsonHash = sha256File(AUDIT_JSON_PATH);
    assert.strictEqual(postTestJsonHash, preTestJsonHash, 'Existing audit_logs.json file must remain byte-for-byte unchanged');
    console.log('✓ Test 12 Passed: Existing JSON file remains byte-for-byte unchanged.');
  })();

  console.log('==================================================================');
  console.log('  ALL STEP-D.1 DURABLE AUDIT LOGS TESTS PASSED SUCCESSFULLY!       ');
  console.log('==================================================================');
}

runAuditDurableTests().catch(err => {
  console.error('Audit durable tests failed:', err);
  process.exit(1);
});
