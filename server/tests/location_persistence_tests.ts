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

import { LocationRepository } from '../db/repositories/LocationRepository';
import { AuditRepository } from '../db/repositories/AuditRepository';
import { UserRepository } from '../db/repositories/UserRepository';
import { locationRouter } from '../routes/locationRoutes';
import { authMiddleware, createToken } from '../auth/authManager';
import { PAKISTAN_LOCATIONS } from '../../src/data/pakistanLocations';

const LOCATION_JSON_PATH = path.resolve(process.cwd(), 'data', 'location_catalog.json');
const JOBS_JSON_PATH = path.resolve(process.cwd(), 'data', 'jobs.json');

function sha256File(filePath: string): string | null {
  if (!fs.existsSync(filePath)) return null;
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function createMockLocationCollection(options: { failFindOne?: boolean; failUpdateOne?: boolean; unacknowledgedWrite?: boolean } = {}) {
  const store = new Map<string, any>();
  const ops: string[] = [];

  return {
    store,
    ops,
    async findOne(query: { _id: string }) {
      ops.push(`findOne:${query._id}`);
      if (options.failFindOne) {
        throw new Error('Simulated MongoDB location read failure');
      }
      const doc = store.get(query._id);
      return doc ? JSON.parse(JSON.stringify(doc)) : null;
    },
    async updateOne(
      query: { _id: string },
      update: { $set?: Record<string, any>; $setOnInsert?: Record<string, any> },
      opts?: { upsert?: boolean }
    ) {
      ops.push(`updateOne:${query._id}`);
      if (options.failUpdateOne) {
        throw new Error('Simulated MongoDB location write failure');
      }
      if (options.unacknowledgedWrite) {
        return { acknowledged: false, matchedCount: 0, modifiedCount: 0, upsertedCount: 0 };
      }
      const existing = store.get(query._id);
      if (!existing) {
        if (!opts?.upsert) {
          return { acknowledged: true, matchedCount: 0, modifiedCount: 0, upsertedCount: 0 };
        }
        const newDoc: Record<string, any> = { _id: query._id };
        if (update.$setOnInsert) {
          Object.assign(newDoc, JSON.parse(JSON.stringify(update.$setOnInsert)));
        }
        if (update.$set) {
          Object.assign(newDoc, JSON.parse(JSON.stringify(update.$set)));
        }
        store.set(query._id, newDoc);
        return { acknowledged: true, matchedCount: 0, modifiedCount: 0, upsertedCount: 1 };
      }

      if (update.$set) {
        const merged = { ...existing, ...JSON.parse(JSON.stringify(update.$set)) };
        store.set(query._id, merged);
        return { acknowledged: true, matchedCount: 1, modifiedCount: 1, upsertedCount: 0 };
      }

      // Only $setOnInsert -> doc exists, do not overwrite
      return { acknowledged: true, matchedCount: 1, modifiedCount: 0, upsertedCount: 0 };
    }
  };
}

function createMockUsageCollection(docs: any[], fail = false) {
  return {
    async countDocuments(filter: any) {
      if (fail) {
        throw new Error('Simulated MongoDB countDocuments failure');
      }
      const regex: RegExp | null = filter?.city instanceof RegExp ? filter.city : null;
      return docs.filter((d) => (regex ? regex.test(String(d.city || '')) : true)).length;
    }
  };
}

async function runLocationPersistenceTests() {
  console.log('==================================================================');
  console.log('  STEP-B: LOCATION PERSISTENCE & FAIL-CLOSED REGRESSION TESTS     ');
  console.log('==================================================================');

  const initialLocationHash = sha256File(LOCATION_JSON_PATH);
  const initialJobsHash = sha256File(JOBS_JSON_PATH);
  const originalLocationContent = fs.existsSync(LOCATION_JSON_PATH)
    ? fs.readFileSync(LOCATION_JSON_PATH, 'utf-8')
    : null;

  const originalAuditAdd = AuditRepository.add;
  AuditRepository.add = (entry: any) => ({
    id: `audit-${Date.now()}`,
    timestamp: new Date().toISOString(),
    ...entry
  });

  const adminUser = UserRepository.create({
    name: 'Location Test Admin',
    email: 'location-admin-stepb@test.local',
    password: 'StrongPassword123!',
    role: 'Super Admin',
    status: 'Active',
    plan: 'Free'
  });
  const adminToken = createToken({
    id: adminUser.id,
    email: adminUser.email,
    role: adminUser.role,
    name: adminUser.name
  });

  const app = express();
  app.use(express.json());
  app.use(authMiddleware);
  app.use('/api/locations', locationRouter);

  let server: Server | null = null;
  let baseUrl = '';

  const startServer = async () => {
    server = createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', () => resolve()));
    const addr = server.address() as any;
    baseUrl = `http://127.0.0.1:${addr.port}`;
  };

  try {
    await startServer();

    // Scenario 6 & 1: First-run seed in MongoDB ($setOnInsert) + available read
    console.log('[1/10] Testing first-run atomic $setOnInsert seed and available Mongo read...');
    const mongoColl = createMockLocationCollection();
    LocationRepository.setMockCollection(mongoColl);
    LocationRepository.setMockUsageCollections(
      createMockUsageCollection([{ city: 'Lahore' }, { city: 'Karachi' }]),
      createMockUsageCollection([{ city: 'Lahore' }])
    );

    const firstRead = await (await fetch(`${baseUrl}/api/locations`)).json();
    assert.strictEqual(firstRead.success, true);
    assert.ok(Array.isArray(firstRead.locations) && firstRead.locations.length > 0);
    assert.ok(mongoColl.store.has('master_catalog'), 'Mongo catalog should be seeded via $setOnInsert');
    assert.strictEqual(sha256File(LOCATION_JSON_PATH), initialLocationHash, 'Mongo seed must not modify local JSON');
    console.log('  OK: First-run seed and available MongoDB read succeeded.');

    // Scenario 7: Empty catalog (locations: []) is respected without reseeding defaults
    console.log('[2/10] Testing empty catalog (locations: []) in MongoDB is NOT overwritten or reseeded...');
    const emptyMongoColl = createMockLocationCollection();
    emptyMongoColl.store.set('master_catalog', {
      _id: 'master_catalog',
      locations: [],
      updatedAt: new Date().toISOString()
    });
    LocationRepository.setMockCollection(emptyMongoColl);
    const emptyRes = await (await fetch(`${baseUrl}/api/locations`)).json();
    assert.strictEqual(emptyRes.success, true);
    assert.deepStrictEqual(emptyRes.locations, [], 'Empty catalog must stay empty');
    assert.strictEqual(emptyMongoColl.ops.filter((op) => op.startsWith('updateOne')).length, 0, 'Must not reseed existing empty catalog');
    console.log('  OK: Empty locations catalog respected.');

    // Scenario 2: MongoDB configured & unavailable read fails closed (no JSON fallback)
    console.log('[3/10] Testing MongoDB unavailable read fails closed (HTTP 500, no JSON fallback)...');
    LocationRepository.setMockCollection(createMockLocationCollection({ failFindOne: true }));
    const failReadRes = await fetch(`${baseUrl}/api/locations`);
    assert.strictEqual(failReadRes.status, 500, 'Unavailable MongoDB read must return HTTP 500');
    const failReadBody = await failReadRes.json();
    assert.strictEqual(failReadBody.success, false);
    await assert.rejects(() => LocationRepository.getAll(), /Simulated MongoDB location read failure/);
    console.log('  OK: Unavailable MongoDB read failed closed.');

    // Scenario 3 & 4: MongoDB unavailable save fails closed & does NOT write local JSON
    console.log('[4/10] Testing failed MongoDB save fails closed and leaves local JSON untouched...');
    const failWriteColl = createMockLocationCollection({ failUpdateOne: true });
    failWriteColl.store.set('master_catalog', {
      _id: 'master_catalog',
      locations: JSON.parse(JSON.stringify(PAKISTAN_LOCATIONS)),
      updatedAt: new Date().toISOString()
    });
    LocationRepository.setMockCollection(failWriteColl);

    const addFailRes = await fetch(`${baseUrl}/api/locations/cities`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ provinceName: 'Punjab', cityName: 'NeverWrittenCity' })
    });
    assert.strictEqual(addFailRes.status, 500, 'Failed MongoDB write must return HTTP 500');
    const addFailBody = await addFailRes.json();
    assert.strictEqual(addFailBody.success, false);
    assert.strictEqual(sha256File(LOCATION_JSON_PATH), initialLocationHash, 'Local location_catalog.json MUST NOT be written on MongoDB failure');

    // Also verify unacknowledged Mongo write throws & fails closed
    const unackColl = createMockLocationCollection({ unacknowledgedWrite: true });
    unackColl.store.set('master_catalog', {
      _id: 'master_catalog',
      locations: JSON.parse(JSON.stringify(PAKISTAN_LOCATIONS)),
      updatedAt: new Date().toISOString()
    });
    LocationRepository.setMockCollection(unackColl);
    await assert.rejects(() => LocationRepository.saveAll(PAKISTAN_LOCATIONS), /not acknowledged/i);
    assert.strictEqual(sha256File(LOCATION_JSON_PATH), initialLocationHash);
    console.log('  OK: Failed & unacknowledged Mongo writes failed closed without touching local JSON.');

    // Scenario 8: checkCityUsage fails closed when MongoDB errors (no silent data/jobs.json fallback)
    console.log('[5/10] Testing checkCityUsage fails closed when MongoDB errors...');
    LocationRepository.setMockCollection(mongoColl);
    LocationRepository.setMockUsageCollections(
      createMockUsageCollection([], true),
      createMockUsageCollection([])
    );
    const usageFailRes = await fetch(`${baseUrl}/api/locations/cities/Lahore/usage`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(usageFailRes.status, 500, 'Unavailable MongoDB usage check must return HTTP 500');
    await assert.rejects(() => LocationRepository.checkCityUsage('Lahore'), /Simulated MongoDB countDocuments failure/);

    LocationRepository.setMockUsageCollections(
      createMockUsageCollection([{ city: 'Lahore' }, { city: 'Lahore' }]),
      createMockUsageCollection([{ city: 'Lahore' }])
    );
    const usageOkRes = await (await fetch(`${baseUrl}/api/locations/cities/Lahore/usage`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    })).json();
    assert.strictEqual(usageOkRes.success, true);
    assert.strictEqual(usageOkRes.totalUsageCount, 3);
    console.log('  OK: checkCityUsage fails closed on error and returns exact counts when available.');

    // Scenario 9 & 10: Add / update (rename & move province) / delete city, add province, and duplicate city protection
    console.log('[6-9/10] Testing add, duplicate check, rename + move province, delete city, and add province in MongoDB...');
    const addCityRes = await fetch(`${baseUrl}/api/locations/cities`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ provinceName: 'Punjab', cityName: 'Taxila', districts: ['Heavy Industries'] })
    });
    assert.strictEqual(addCityRes.status, 201);

    // Duplicate city protection across provinces
    const dupCityRes = await fetch(`${baseUrl}/api/locations/cities`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ provinceName: 'Sindh', cityName: 'taxila' })
    });
    assert.strictEqual(dupCityRes.status, 400);

    // Add new province
    const addProvRes = await fetch(`${baseUrl}/api/locations/provinces`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ provinceName: 'Gilgit-Baltistan Test' })
    });
    assert.strictEqual(addProvRes.status, 201);

    // Move & rename city from Punjab to Gilgit-Baltistan Test
    const updateCityRes = await fetch(`${baseUrl}/api/locations/cities/Taxila`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        newCityName: 'Taxila Moved',
        targetProvince: 'Gilgit-Baltistan Test',
        districts: ['Zone A']
      })
    });
    assert.strictEqual(updateCityRes.status, 200);
    const catalogAfterMove = await LocationRepository.getAll();
    const oldProv = catalogAfterMove.find((p) => p.province === 'Punjab');
    const newProv = catalogAfterMove.find((p) => p.province === 'Gilgit-Baltistan Test');
    assert.strictEqual(oldProv?.cities.some((c) => c.name === 'Taxila'), false);
    assert.strictEqual(newProv?.cities.some((c) => c.name === 'Taxila Moved'), true);

    // Delete city
    const delCityRes = await fetch(`${baseUrl}/api/locations/cities/${encodeURIComponent('Taxila Moved')}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(delCityRes.status, 200);
    const catalogAfterDelete = await LocationRepository.getAll();
    const newProvAfterDel = catalogAfterDelete.find((p) => p.province === 'Gilgit-Baltistan Test');
    assert.strictEqual(newProvAfterDel?.cities.some((c) => c.name === 'Taxila Moved'), false);
    assert.strictEqual(sha256File(LOCATION_JSON_PATH), initialLocationHash, 'Mongo mutations must not write local JSON');
    console.log('  OK: Add, duplicate protection, move/rename, add province, and delete city verified.');

    // Scenario 5: MongoDB unconfigured local JSON read/write works cleanly (and restores original file afterwards)
    console.log('[10/10] Testing unconfigured MongoDB local JSON read/write mode...');
    LocationRepository.setMockCollection(null);
    LocationRepository.setMockUsageCollections(null, null);

    const localAdd = await LocationRepository.addCity('Punjab', 'LocalTestCityStepB', ['District 1']);
    assert.strictEqual(localAdd.success, true);
    const localAfterAdd = await LocationRepository.getAll();
    assert.strictEqual(
      localAfterAdd.some((p) => p.cities.some((c) => c.name === 'LocalTestCityStepB')),
      true
    );
    const localDel = await LocationRepository.deleteCity('LocalTestCityStepB');
    assert.strictEqual(localDel.success, true);
    console.log('  OK: Unconfigured local JSON read/write works cleanly.');

    console.log('\n==================================================================');
    console.log('  ALL 10 LOCATION PERSISTENCE & FAIL-CLOSED TESTS PASSED!         ');
    console.log('==================================================================');
  } finally {
    LocationRepository.setMockCollection(null);
    LocationRepository.setMockUsageCollections(null, null);
    AuditRepository.add = originalAuditAdd;
    if (server) {
      await new Promise<void>((resolve) => server!.close(() => resolve()));
    }
    if (originalLocationContent !== null) {
      fs.writeFileSync(LOCATION_JSON_PATH, originalLocationContent, 'utf-8');
    } else if (fs.existsSync(LOCATION_JSON_PATH)) {
      fs.unlinkSync(LOCATION_JSON_PATH);
    }
    assert.strictEqual(sha256File(LOCATION_JSON_PATH), initialLocationHash, 'data/location_catalog.json hash must be restored cleanly');
    assert.strictEqual(sha256File(JOBS_JSON_PATH), initialJobsHash, 'data/jobs.json must never be touched');
  }
}

runLocationPersistenceTests().catch((err) => {
  console.error('Location persistence tests FAILED:', err);
  process.exit(1);
});
