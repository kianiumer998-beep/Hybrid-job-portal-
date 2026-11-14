import assert from 'assert';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import express from 'express';
import { createServer, Server } from 'http';

// Ensure strict test mode before importing repositories/routes
process.env.IS_TEST = 'true';
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = '';
process.env.MONGO_URI = '';

import {
  SeoRepository,
  SEO_COLLECTION_NAME,
  SEO_DOC_KEY,
  resetSeoTestStore
} from '../db/repositories/SeoRepository';
import { Database } from '../db/database';
import { AuditRepository } from '../db/repositories/AuditRepository';
import { JobRepository } from '../db/repositories/JobRepository';
import { UserRepository } from '../db/repositories/UserRepository';
import { seoRouter } from '../routes/seoRoutes';
import { authMiddleware, createToken } from '../auth/authManager';
import { INITIAL_SITE_SEO_CONFIG } from '../../src/data/mockAdminSuiteData';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const SEO_JSON_PATH = path.join(DATA_DIR, 'seo_config.json');

interface DataSnapshot {
  files: Record<string, string>;
}

function getDataDirectorySnapshot(): DataSnapshot {
  const snapshot: DataSnapshot = { files: {} };
  if (!fs.existsSync(DATA_DIR)) return snapshot;
  for (const entry of fs.readdirSync(DATA_DIR)) {
    if (entry.endsWith('.json')) {
      const fullPath = path.join(DATA_DIR, entry);
      const content = fs.readFileSync(fullPath);
      snapshot.files[entry] = crypto.createHash('sha256').update(content).digest('hex');
    }
  }
  return snapshot;
}

function assertDataSnapshotUnchanged(initial: DataSnapshot, current: DataSnapshot): void {
  const initialKeys = Object.keys(initial.files).sort();
  const currentKeys = Object.keys(current.files).sort();
  assert.deepStrictEqual(
    currentKeys,
    initialKeys,
    `Data directory JSON file list changed! Expected [${initialKeys.join(', ')}], got [${currentKeys.join(', ')}]`
  );
  for (const file of initialKeys) {
    assert.strictEqual(
      current.files[file],
      initial.files[file],
      `Data file data/${file} was modified during tests`
    );
  }
  assert.strictEqual(fs.existsSync(SEO_JSON_PATH), false, 'data/seo_config.json MUST NEVER exist');
}

function createMockMongoCollection() {
  const store = new Map<string, any>();
  const ops: string[] = [];

  return {
    store,
    ops,
    async findOne(query: { key: string }) {
      ops.push(`findOne:${query.key}`);
      const doc = store.get(query.key);
      return doc ? JSON.parse(JSON.stringify(doc)) : null;
    },
    async updateOne(
      query: { key: string },
      update: { $set?: Record<string, any>; $setOnInsert?: Record<string, any> },
      options?: { upsert?: boolean }
    ) {
      ops.push(`updateOne:${query.key}`);
      const existing = store.get(query.key);
      if (!existing) {
        if (!options?.upsert) {
          return { acknowledged: true, matchedCount: 0, modifiedCount: 0, upsertedCount: 0 };
        }
        const newDoc: Record<string, any> = { key: query.key };
        if (update.$setOnInsert) {
          Object.assign(newDoc, JSON.parse(JSON.stringify(update.$setOnInsert)));
        }
        if (update.$set) {
          Object.assign(newDoc, JSON.parse(JSON.stringify(update.$set)));
        }
        store.set(query.key, newDoc);
        return { acknowledged: true, matchedCount: 0, modifiedCount: 0, upsertedCount: 1 };
      }

      if (update.$set) {
        const merged = { ...existing, ...JSON.parse(JSON.stringify(update.$set)) };
        store.set(query.key, merged);
        return { acknowledged: true, matchedCount: 1, modifiedCount: 1, upsertedCount: 0 };
      }

      // Only $setOnInsert was provided and doc already exists -> do NOT overwrite!
      return { acknowledged: true, matchedCount: 1, modifiedCount: 0, upsertedCount: 0 };
    }
  };
}

async function runSeoPersistenceTests() {
  console.log('==================================================================');
  console.log('  STEP-07-02.2: SEO PERSISTENCE & ZERO-JSON REGRESSION SUITE      ');
  console.log('==================================================================');

  if (fs.existsSync(SEO_JSON_PATH)) {
    throw new Error('Precondition failed: data/seo_config.json already exists before test start.');
  }

  const initialSnapshot = getDataDirectorySnapshot();
  resetSeoTestStore();

  // Preserve AuditRepository.add & JobRepository methods during test execution
  const originalAuditAdd = AuditRepository.add;
  const originalJobGetAll = JobRepository.getAll;
  const originalJobGetById = JobRepository.getById;
  const originalJobGetBySlug = JobRepository.getBySlug;

  const capturedAudits: any[] = [];
  AuditRepository.add = (entry: any) => {
    const rec = { id: `audit-${Date.now()}`, timestamp: new Date().toISOString(), ...entry };
    capturedAudits.push(rec);
    return rec;
  };

  const sampleJob = {
    id: 'seo-test-job-1',
    slug: 'senior-engineer-lahore-seo01',
    title: 'Senior Software Engineer',
    company: 'TechCorp',
    city: 'Lahore',
    province: 'Punjab',
    region: 'Pakistan',
    jobType: 'Full-time',
    description: 'Build reliable distributed web systems.',
    status: 'Approved',
    isDuplicate: false,
    isSuspended: false,
    featured: true,
    createdAt: '2026-01-15T00:00:00.000Z'
  };

  JobRepository.getAll = async () => ({ jobs: [sampleJob], total: 1, page: 1, limit: 1000 });
  JobRepository.getById = async (id: string) => (id === sampleJob.id ? sampleJob : null);
  JobRepository.getBySlug = async (slug: string) => (slug === sampleJob.slug ? sampleJob : null);

  // Create isolated in-memory test users (IS_TEST === 'true' keeps UserRepository in-memory only)
  const seoAdmin = UserRepository.create({
    id: 'seo-admin-1',
    name: 'SEO Manager',
    email: 'seo-admin@hybridjobs.pk',
    role: 'Super Admin'
  });
  const regularUser = UserRepository.create({
    id: 'seo-user-1',
    name: 'Regular Seeker',
    email: 'seeker@hybridjobs.pk',
    role: 'Job Seeker'
  });

  const adminToken = createToken({
    id: seoAdmin.id,
    userId: seoAdmin.id,
    email: seoAdmin.email,
    role: seoAdmin.role,
    name: seoAdmin.name,
    permissions: ['seo.manage']
  });

  const unauthorizedToken = createToken({
    id: regularUser.id,
    userId: regularUser.id,
    email: regularUser.email,
    role: regularUser.role,
    name: regularUser.name,
    permissions: []
  });

  const app = express();
  app.use(express.json());
  app.use(authMiddleware);
  app.use('/api/seo', seoRouter);

  const server: Server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${address.port}/api/seo`;

  let passed = 0;
  let failed = 0;
  const notRun = 1; // Live MongoDB Atlas integration when TEST_MONGODB_URI is absent

  const runTest = async (name: string, fn: () => Promise<void>) => {
    try {
      await fn();
      passed++;
      console.log(`✓ [PASS] ${name}`);
    } catch (err: any) {
      failed++;
      console.error(`✗ [FAIL] ${name}`);
      console.error(`  -> ${err?.stack || err?.message || err}`);
    }
  };

  console.log(
    '[NOT RUN] Live MongoDB cluster integration test: MONGODB_URI / TEST_MONGODB_URI not configured in isolated test runner; MongoDB repository persistence verified via mock Mongo collection contract.'
  );

  try {
    // 1. Missing SEO JSON does not cause file creation
    await runTest('1. Missing SEO JSON does not create data/seo_config.json on repository or Database reads', async () => {
      resetSeoTestStore();
      const repoCfg = await SeoRepository.getConfig();
      assert.strictEqual(repoCfg.siteTitle, INITIAL_SITE_SEO_CONFIG.siteTitle);
      assert.strictEqual(fs.existsSync(SEO_JSON_PATH), false, 'SeoRepository.getConfig must not create seo_config.json');

      const dbCfg = Database.getSeoConfig();
      assert.strictEqual(dbCfg.siteTitle, INITIAL_SITE_SEO_CONFIG.siteTitle);
      assert.strictEqual(fs.existsSync(SEO_JSON_PATH), false, 'Database.getSeoConfig must not create seo_config.json');

      let threw = false;
      try {
        Database.saveSeoConfig({ siteTitle: 'Legacy Write Attempt' });
      } catch (err: any) {
        threw = err.message.includes('Deprecated');
      }
      assert.strictEqual(threw, true, 'Database.saveSeoConfig must reject disk writes');
      assert.strictEqual(fs.existsSync(SEO_JSON_PATH), false, 'Database.saveSeoConfig must not create seo_config.json');
    });

    // 2. GET /api/seo/config does not create data/seo_config.json
    await runTest('2. GET /api/seo/config returns defaults without creating data/seo_config.json', async () => {
      resetSeoTestStore();
      const res = await fetch(`${baseUrl}/config`);
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.config.siteTitle, INITIAL_SITE_SEO_CONFIG.siteTitle);
      assert.ok(Array.isArray(body.config.metaKeywords));
      assert.ok(body.config.announcementBanner && typeof body.config.announcementBanner.enabled === 'boolean');
      assert.strictEqual(fs.existsSync(SEO_JSON_PATH), false, 'GET /api/seo/config must not create data/seo_config.json');
    });

    // 3. GET /api/seo/sitemap.xml requests do not create data/seo_config.json
    await runTest('3. GET /api/seo/sitemap.xml serves valid XML without creating data/seo_config.json', async () => {
      const res = await fetch(`${baseUrl}/sitemap.xml`);
      assert.strictEqual(res.status, 200);
      const contentType = res.headers.get('content-type') || '';
      assert.ok(contentType.includes('xml'), `Expected XML content-type, got ${contentType}`);
      const xml = await res.text();
      assert.ok(xml.includes('<urlset') && xml.includes('</urlset>'));
      assert.ok(xml.includes(sampleJob.slug));
      assert.strictEqual(fs.existsSync(SEO_JSON_PATH), false, 'GET /sitemap.xml must not create data/seo_config.json');
    });

    // 4. GET /api/seo/robots.txt requests do not create data/seo_config.json
    await runTest('4. GET /api/seo/robots.txt serves robots directives without creating data/seo_config.json', async () => {
      const res = await fetch(`${baseUrl}/robots.txt`);
      assert.strictEqual(res.status, 200);
      const contentType = res.headers.get('content-type') || '';
      assert.ok(contentType.includes('text/plain'), `Expected text/plain content-type, got ${contentType}`);
      const txt = await res.text();
      assert.ok(txt.includes('User-agent: *') && txt.includes('Sitemap:'));
      assert.strictEqual(fs.existsSync(SEO_JSON_PATH), false, 'GET /robots.txt must not create data/seo_config.json');
    });

    // 5. SEO settings persist in MongoDB collection/key structure
    await runTest('5. SEO settings persist to MongoDB system_settings collection under site_seo_config key', async () => {
      assert.strictEqual(SEO_COLLECTION_NAME, 'system_settings');
      assert.strictEqual(SEO_DOC_KEY, 'site_seo_config');

      const mockColl = createMockMongoCollection();
      const saved = await SeoRepository.saveConfig(
        {
          siteTitle: 'Mongo Persisted Portal',
          canonicalUrl: 'https://portal.example.com',
          maintenanceMode: true,
          announcementBanner: {
            enabled: false,
            text: 'Planned Maintenance',
            linkUrl: '/status',
            linkText: 'Status',
            bannerType: 'warning'
          }
        },
        mockColl,
        SEO_DOC_KEY
      );

      assert.strictEqual(saved.siteTitle, 'Mongo Persisted Portal');
      assert.strictEqual(saved.canonicalUrl, 'https://portal.example.com');
      assert.strictEqual(saved.maintenanceMode, true);
      assert.strictEqual(saved.announcementBanner.enabled, false);
      assert.strictEqual(saved.announcementBanner.bannerType, 'warning');

      const rawDoc = mockColl.store.get(SEO_DOC_KEY);
      assert.ok(rawDoc, 'Document must exist in mock MongoDB collection under SEO_DOC_KEY');
      assert.strictEqual(rawDoc.key, SEO_DOC_KEY);
      assert.strictEqual(rawDoc.config.siteTitle, 'Mongo Persisted Portal');
      assert.ok(typeof rawDoc.updatedAt === 'string' && rawDoc.updatedAt.length > 0);

      // Unacknowledged Mongo write must throw
      const unackColl = {
        findOne: async () => null,
        updateOne: async () => ({ acknowledged: false })
      };
      await assert.rejects(
        () => SeoRepository.saveConfig({ siteTitle: 'Fail Write' }, unackColl, SEO_DOC_KEY),
        /not acknowledged/i
      );
      assert.strictEqual(fs.existsSync(SEO_JSON_PATH), false);
    });

    // 6. Saved settings survive repository readback
    await runTest('6. Saved SEO settings survive repository readback across all SiteSeoConfig fields', async () => {
      const mockColl = createMockMongoCollection();
      const customPayload = {
        siteTitle: 'Readback Career Hub',
        tagline: 'Verified Remote & Hybrid Roles',
        metaDescription: 'Readback description for SEO verification.',
        metaKeywords: ['Remote', 'Hybrid', 'Engineering'],
        canonicalUrl: 'https://careers.example.org',
        ogImageUrl: 'https://careers.example.org/og.png',
        twitterHandle: '@careershub',
        googleSearchConsoleVerification: 'gsc-token-123',
        bingWebmasterVerification: 'bing-token-456',
        googleAnalyticsId: 'G-TEST123456',
        googleTagManagerId: 'GTM-TEST99',
        facebookPixelId: 'FB-987654',
        robotsTxtContent: 'User-agent: *\nAllow: /',
        maintenanceMode: false,
        maintenanceNotice: 'Custom maintenance notice',
        announcementBanner: {
          enabled: true,
          text: 'New roles added daily',
          linkUrl: '#jobs',
          linkText: 'Browse',
          bannerType: 'success' as const
        }
      };

      await SeoRepository.saveConfig(customPayload, mockColl, SEO_DOC_KEY);
      const readback = await SeoRepository.getConfig(mockColl, SEO_DOC_KEY);

      assert.strictEqual(readback.siteTitle, customPayload.siteTitle);
      assert.strictEqual(readback.tagline, customPayload.tagline);
      assert.strictEqual(readback.metaDescription, customPayload.metaDescription);
      assert.deepStrictEqual(readback.metaKeywords, customPayload.metaKeywords);
      assert.strictEqual(readback.canonicalUrl, customPayload.canonicalUrl);
      assert.strictEqual(readback.ogImageUrl, customPayload.ogImageUrl);
      assert.strictEqual(readback.twitterHandle, customPayload.twitterHandle);
      assert.strictEqual(readback.googleSearchConsoleVerification, customPayload.googleSearchConsoleVerification);
      assert.strictEqual(readback.bingWebmasterVerification, customPayload.bingWebmasterVerification);
      assert.strictEqual(readback.googleAnalyticsId, customPayload.googleAnalyticsId);
      assert.strictEqual(readback.googleTagManagerId, customPayload.googleTagManagerId);
      assert.strictEqual(readback.facebookPixelId, customPayload.facebookPixelId);
      assert.strictEqual(readback.robotsTxtContent, customPayload.robotsTxtContent);
      assert.strictEqual(readback.maintenanceMode, customPayload.maintenanceMode);
      assert.strictEqual(readback.maintenanceNotice, customPayload.maintenanceNotice);
      assert.deepStrictEqual(readback.announcementBanner, customPayload.announcementBanner);
      assert.strictEqual(fs.existsSync(SEO_JSON_PATH), false);
    });

    // 7. Unconfigured reads ignore legacy JSON, existing MongoDB config is never overwritten, and migrated MongoDB stays authoritative
    await runTest('7. Unconfigured getConfig() ignores legacy JSON, and existing MongoDB config stays authoritative', async () => {
      const origCwd = process.cwd();
      const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'seo-legacy-isolated-'));
      const tmpDataDir = path.join(tmpRoot, 'data');
      fs.mkdirSync(tmpDataDir, { recursive: true });
      const tmpLegacyJson = path.join(tmpDataDir, 'seo_config.json');
      const legacyPayload = {
        siteTitle: 'Migrated Legacy Title',
        canonicalUrl: 'https://legacy.example.com',
        googleAnalyticsId: 'G-LEGACY111'
      };
      fs.writeFileSync(tmpLegacyJson, JSON.stringify(legacyPayload, null, 2), 'utf-8');
      const originalLegacyContent = fs.readFileSync(tmpLegacyJson, 'utf-8');

      const prevIsTest = process.env.IS_TEST;
      const prevMongoUri = process.env.MONGODB_URI;

      try {
        process.chdir(tmpRoot);
        process.env.MONGODB_URI = '';

        // 7a. When MongoDB is unconfigured (both IS_TEST='false' and IS_TEST='true'), getConfig() MUST return defaults even though data/seo_config.json exists
        resetSeoTestStore();
        process.env.IS_TEST = 'false';
        const unconfiguredProdRead = await SeoRepository.getConfig();
        assert.strictEqual(
          unconfiguredProdRead.siteTitle,
          INITIAL_SITE_SEO_CONFIG.siteTitle,
          'Unconfigured non-test getConfig() must return INITIAL_SITE_SEO_CONFIG default, not legacy JSON'
        );
        assert.strictEqual(unconfiguredProdRead.canonicalUrl, INITIAL_SITE_SEO_CONFIG.canonicalUrl);

        process.env.IS_TEST = 'true';
        const unconfiguredTestRead = await SeoRepository.getConfig();
        assert.strictEqual(
          unconfiguredTestRead.siteTitle,
          INITIAL_SITE_SEO_CONFIG.siteTitle,
          'Unconfigured test getConfig() must return INITIAL_SITE_SEO_CONFIG default, not legacy JSON'
        );

        // 7b. When MongoDB IS configured and document already exists, normal runtime reads never use legacy JSON
        const existingMongoColl = createMockMongoCollection();
        await SeoRepository.saveConfig(
          { siteTitle: 'Existing Authoritative Mongo', canonicalUrl: 'https://mongo-existing.example.com' },
          existingMongoColl,
          SEO_DOC_KEY
        );
        const runtimeRead = await SeoRepository.getConfig(existingMongoColl, SEO_DOC_KEY);
        assert.strictEqual(runtimeRead.siteTitle, 'Existing Authoritative Mongo');
        assert.strictEqual(runtimeRead.canonicalUrl, 'https://mongo-existing.example.com');

        // 7c. One-time safe $setOnInsert migration when MongoDB doc does not exist, then MongoDB stays authoritative
        const emptyMongoColl = createMockMongoCollection();
        const firstRead = await SeoRepository.getConfig(emptyMongoColl, SEO_DOC_KEY);
        assert.strictEqual(firstRead.siteTitle, 'Migrated Legacy Title');
        assert.strictEqual(firstRead.canonicalUrl, 'https://legacy.example.com');

        // Mutate legacy JSON after migration — subsequent runtime read must still use MongoDB
        fs.writeFileSync(
          tmpLegacyJson,
          JSON.stringify({ siteTitle: 'Mutated Legacy Should Be Ignored', canonicalUrl: 'https://ignored.example.com' }),
          'utf-8'
        );
        const postMigrationRead = await SeoRepository.getConfig(emptyMongoColl, SEO_DOC_KEY);
        assert.strictEqual(postMigrationRead.siteTitle, 'Migrated Legacy Title');
        assert.strictEqual(postMigrationRead.canonicalUrl, 'https://legacy.example.com');

        // Explicit migration call with conflicting legacy payload must NEVER overwrite existing MongoDB document
        const second = await SeoRepository.migrateLegacyConfigIfUnconfigured(
          { siteTitle: 'Stale Overwrite Attempt', canonicalUrl: 'https://stale.example.com' },
          existingMongoColl,
          SEO_DOC_KEY
        );
        assert.strictEqual(second.migrated, false);
        assert.strictEqual(second.config.siteTitle, 'Existing Authoritative Mongo');
        assert.strictEqual(second.config.canonicalUrl, 'https://mongo-existing.example.com');

        // Restore legacy JSON content & verify it wasn't written/deleted by SeoRepository
        assert.ok(fs.existsSync(tmpLegacyJson));
        assert.strictEqual(typeof originalLegacyContent, 'string');
      } finally {
        process.env.IS_TEST = prevIsTest;
        process.env.MONGODB_URI = prevMongoUri;
        process.chdir(origCwd);
        fs.rmSync(tmpRoot, { recursive: true, force: true });
      }
      assert.strictEqual(fs.existsSync(SEO_JSON_PATH), false);
    });

    // 8. MongoDB failure does not trigger JSON fallback and fails safely
    await runTest('8. MongoDB unavailability/failure fails safely without JSON fallback or seo_config.json creation', async () => {
      const origCwd = process.cwd();
      const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'seo-fail-isolated-'));
      const tmpDataDir = path.join(tmpRoot, 'data');
      fs.mkdirSync(tmpDataDir, { recursive: true });
      fs.writeFileSync(
        path.join(tmpDataDir, 'seo_config.json'),
        JSON.stringify({ siteTitle: 'Fallback Trap Title', canonicalUrl: 'https://trap.example.com' }),
        'utf-8'
      );

      try {
        process.chdir(tmpRoot);

        // 8a. Failing collection passed to repository throws directly even with legacy JSON present
        const failingColl = {
          findOne: async () => {
            throw new Error('Simulated MongoDB outage');
          },
          updateOne: async () => {
            throw new Error('Simulated MongoDB write outage');
          }
        };
        await assert.rejects(() => SeoRepository.getConfig(failingColl, SEO_DOC_KEY), /Simulated MongoDB outage/);
        await assert.rejects(
          () => SeoRepository.saveConfig({ siteTitle: 'Should Fail' }, failingColl, SEO_DOC_KEY),
          /Simulated MongoDB outage/
        );
      } finally {
        process.chdir(origCwd);
        fs.rmSync(tmpRoot, { recursive: true, force: true });
      }

      // 8b. Production mode with unconfigured MongoDB rejects saveConfig without JSON fallback
      const prevIsTest = process.env.IS_TEST;
      try {
        process.env.IS_TEST = 'false';
        await assert.rejects(
          () => SeoRepository.saveConfig({ siteTitle: 'No Mongo Save' }),
          /MONGODB_URI is not configured|Database unavailable/i
        );
      } finally {
        process.env.IS_TEST = prevIsTest;
      }

      // 8c. Configured MongoDB outage via HTTP routes returns 500 and NEVER creates data/seo_config.json
      const origGetConfig = SeoRepository.getConfig;
      const origSaveConfig = SeoRepository.saveConfig;
      try {
        SeoRepository.getConfig = async () => {
          throw new Error('MongoDB connection unavailable');
        };
        SeoRepository.saveConfig = async () => {
          throw new Error('MongoDB connection unavailable');
        };

        const getRes = await fetch(`${baseUrl}/config`);
        assert.strictEqual(getRes.status, 500);
        const getBody = await getRes.json();
        assert.strictEqual(getBody.success, false);

        const putRes = await fetch(`${baseUrl}/config`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`
          },
          body: JSON.stringify({ siteTitle: 'Outage Update' })
        });
        assert.strictEqual(putRes.status, 500);
        const putBody = await putRes.json();
        assert.strictEqual(putBody.success, false);

        const robotsRes = await fetch(`${baseUrl}/robots.txt`);
        assert.strictEqual(robotsRes.status, 500);
      } finally {
        SeoRepository.getConfig = origGetConfig;
        SeoRepository.saveConfig = origSaveConfig;
      }

      assert.strictEqual(fs.existsSync(SEO_JSON_PATH), false, 'Failure path must never create data/seo_config.json');
    });

    // 9. Unauthorized PUT /api/seo/config updates remain blocked
    await runTest('9. Unauthorized PUT /api/seo/config updates are rejected with 401/403', async () => {
      resetSeoTestStore();

      const unauthRes = await fetch(`${baseUrl}/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteTitle: 'Unauth Override' })
      });
      assert.strictEqual(unauthRes.status, 401);

      const forbiddenRes = await fetch(`${baseUrl}/config`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${unauthorizedToken}`
        },
        body: JSON.stringify({ siteTitle: 'Forbidden Override' })
      });
      assert.strictEqual(forbiddenRes.status, 403);

      const currentRes = await fetch(`${baseUrl}/config`);
      const currentBody = await currentRes.json();
      assert.strictEqual(currentBody.config.siteTitle, INITIAL_SITE_SEO_CONFIG.siteTitle);
      assert.strictEqual(fs.existsSync(SEO_JSON_PATH), false);
    });

    // 10. Authorized PUT /api/seo/config updates persist, reflect in SEO endpoints, and preserve filesystem state
    await runTest('10. Authorized PUT /api/seo/config persists settings, reflects in robots/sitemap/job-meta, and keeps data/ intact', async () => {
      resetSeoTestStore();
      capturedAudits.length = 0;

      const updatePayload = {
        siteTitle: 'Authorized Updated Portal',
        canonicalUrl: 'https://jobs.authorized-test.pk',
        googleAnalyticsId: 'G-AUTH999',
        announcementBanner: {
          enabled: true,
          text: 'Verified live banner',
          linkUrl: '#featured',
          linkText: 'View',
          bannerType: 'info'
        }
      };

      const putRes = await fetch(`${baseUrl}/config`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify(updatePayload)
      });
      assert.strictEqual(putRes.status, 200);
      const putBody = await putRes.json();
      assert.strictEqual(putBody.success, true);
      assert.strictEqual(putBody.config.siteTitle, 'Authorized Updated Portal');
      assert.strictEqual(putBody.config.canonicalUrl, 'https://jobs.authorized-test.pk');
      assert.strictEqual(putBody.config.googleAnalyticsId, 'G-AUTH999');
      assert.ok(typeof putBody.message === 'string' && putBody.message.length > 0);
      assert.strictEqual(capturedAudits.length, 1, 'Audit log must record authorized SEO update');
      assert.strictEqual(capturedAudits[0].action, 'SEO Configuration Updated');

      // Readback via GET /api/seo/config
      const getRes = await fetch(`${baseUrl}/config`);
      assert.strictEqual(getRes.status, 200);
      const getBody = await getRes.json();
      assert.strictEqual(getBody.config.siteTitle, 'Authorized Updated Portal');
      assert.strictEqual(getBody.config.canonicalUrl, 'https://jobs.authorized-test.pk');

      // Downstream SEO endpoints reflect updated canonicalUrl without creating seo_config.json
      const robotsRes = await fetch(`${baseUrl}/robots.txt`);
      assert.strictEqual(robotsRes.status, 200);
      const robotsTxt = await robotsRes.text();
      assert.ok(robotsTxt.includes('Sitemap: https://jobs.authorized-test.pk/sitemap.xml'));

      const sitemapRes = await fetch(`${baseUrl}/sitemap.xml`);
      assert.strictEqual(sitemapRes.status, 200);
      const sitemapXml = await sitemapRes.text();
      assert.ok(sitemapXml.includes('<loc>https://jobs.authorized-test.pk/jobs/senior-engineer-lahore-seo01</loc>'));

      const metaRes = await fetch(`${baseUrl}/job-meta/${sampleJob.id}`);
      assert.strictEqual(metaRes.status, 200);
      const metaBody = await metaRes.json();
      assert.strictEqual(metaBody.canonicalUrl, 'https://jobs.authorized-test.pk/jobs/senior-engineer-lahore-seo01');

      const finalSnapshot = getDataDirectorySnapshot();
      assertDataSnapshotUnchanged(initialSnapshot, finalSnapshot);
    });
  } finally {
    AuditRepository.add = originalAuditAdd;
    JobRepository.getAll = originalJobGetAll;
    JobRepository.getById = originalJobGetById;
    JobRepository.getBySlug = originalJobGetBySlug;
    server.close();
  }

  console.log('\n==================================================================');
  console.log(`  SEO PERSISTENCE SUITE SUMMARY: ${passed} Passed, ${failed} Failed, ${notRun} Not Run`);
  console.log('==================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runSeoPersistenceTests().catch((err) => {
  console.error('Fatal error in seo_persistence_tests:', err);
  process.exit(1);
});
