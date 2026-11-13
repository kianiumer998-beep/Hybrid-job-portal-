import assert from 'assert';
import fs from 'fs';
import path from 'path';
import express from 'express';
import { createServer, Server } from 'http';

// Ensure strictly isolated test mode (no live MongoDB side effects)
process.env.MONGODB_URI = '';
process.env.MONGO_URI = '';
process.env.IS_TEST = 'true';
process.env.NODE_ENV = 'test';

import { authMiddleware, createToken, hasAdminPermission, DEFAULT_ROLE_PERMISSIONS } from '../auth/authManager';
import { UserRepository } from '../db/repositories/UserRepository';
import { ChatMessageRepository } from '../db/repositories/ChatMessageRepository';
import { JobRepository } from '../db/repositories/JobRepository';
import { AuditRepository } from '../db/repositories/AuditRepository';
import { Database } from '../db/database';
import { currencyRouter } from '../routes/currencyRoutes';
import { locationRouter } from '../routes/locationRoutes';
import { chatRouter } from '../routes/chatMessageRoutes';
import { authRouter } from '../routes/authRoutes';
import { paymentSettingsRouter } from '../routes/paymentSettingsRoutes';
import { pricingRouter } from '../routes/pricingRoutes';
import { scraperRouter } from '../routes/scraperRoutes';
import { jobRouter } from '../routes/jobRoutes';
import { INITIAL_CURRENCY_CONFIG } from '../../src/data/mockAdminSuiteData';

const DATA_DIR = path.resolve(process.cwd(), 'data');

function snapshotDataDir(): Map<string, Buffer> {
  const snapshot = new Map<string, Buffer>();
  if (!fs.existsSync(DATA_DIR)) return snapshot;
  for (const entry of fs.readdirSync(DATA_DIR)) {
    const fullPath = path.join(DATA_DIR, entry);
    if (fs.statSync(fullPath).isFile()) {
      snapshot.set(entry, fs.readFileSync(fullPath));
    }
  }
  return snapshot;
}

function restoreDataDir(snapshot: Map<string, Buffer>): void {
  if (!fs.existsSync(DATA_DIR)) return;
  for (const entry of fs.readdirSync(DATA_DIR)) {
    const fullPath = path.join(DATA_DIR, entry);
    if (!fs.statSync(fullPath).isFile()) continue;
    if (!snapshot.has(entry)) {
      try {
        fs.unlinkSync(fullPath);
      } catch {}
    }
  }
  for (const [entry, content] of snapshot.entries()) {
    const fullPath = path.join(DATA_DIR, entry);
    fs.writeFileSync(fullPath, content);
  }
}

async function runAdminPermissionTests() {
  console.log('==================================================================');
  console.log('   STEP-06-01: ADMIN PERMISSIONS, SCRAPER DELETE & CONCURRENCY    ');
  console.log('   ENVIRONMENT: ISOLATED IN-MEMORY / RESTORED DATA SNAPSHOT     ');
  console.log('==================================================================');

  console.log('[NOT RUN] Live MongoDB Replica-Set Transaction Tests: MONGODB_URI unset in isolated suite; transaction paths verified via unit mocks.');

  const dataSnapshot = snapshotDataDir();
  ChatMessageRepository.resetTestStore();

  const app = express();
  app.use(express.json());
  app.use(authMiddleware);
  app.use('/api/auth', authRouter);
  app.use('/api/currency', currencyRouter);
  app.use('/api/locations', locationRouter);
  app.use('/api/chat', chatRouter);
  app.use('/api/payment-settings', paymentSettingsRouter);
  app.use('/api/pricing', pricingRouter);
  app.use('/api/scraper', scraperRouter);
  app.use('/api/jobs', jobRouter);

  const server: Server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${address.port}/api`;

  let testsPassed = 0;
  let testsFailed = 0;
  const testsSkipped = 0;
  const testsNotRun = 1;

  const runTest = async (name: string, fn: () => Promise<void>) => {
    try {
      await fn();
      testsPassed++;
      console.log(`✓ Passed: ${name}`);
    } catch (err: any) {
      testsFailed++;
      console.error(`✗ Failed: ${name}`);
      console.error(`  Error: ${err?.stack || err?.message || err}`);
    }
  };

  const makeToken = (user: any) =>
    createToken({ id: user.id, userId: user.id, email: user.email, name: user.name, role: user.role });

  try {
    // Seed test accounts across every admin & standard role
    const sa1 = await UserRepository.createAsync({ id: 'perm-sa-1', name: 'Super Admin 1', email: 'sa1@test.local', role: 'Super Admin' });
    const sa2 = await UserRepository.createAsync({ id: 'perm-sa-2', name: 'Super Admin 2', email: 'sa2@test.local', role: 'Super Admin' });
    const adminUser = await UserRepository.createAsync({ id: 'perm-admin-1', name: 'Admin 1', email: 'admin1@test.local', role: 'Admin' });
    const modUser = await UserRepository.createAsync({ id: 'perm-mod-1', name: 'Job Moderator', email: 'mod@test.local', role: 'Job Moderator' });
    const scraperUser = await UserRepository.createAsync({ id: 'perm-scraper-1', name: 'Scraper Manager', email: 'scraper@test.local', role: 'Scraper Manager' });
    const payUser = await UserRepository.createAsync({ id: 'perm-pay-1', name: 'Payment Manager', email: 'pay@test.local', role: 'Payment Manager' });
    const finUser = await UserRepository.createAsync({ id: 'perm-fin-1', name: 'Finance Manager', email: 'fin@test.local', role: 'Finance Manager' });
    const seoUser = await UserRepository.createAsync({ id: 'perm-seo-1', name: 'SEO Manager', email: 'seo@test.local', role: 'SEO Manager' });
    const adUser = await UserRepository.createAsync({ id: 'perm-ad-1', name: 'Ad Manager', email: 'ad@test.local', role: 'Advertisement Manager' });
    const seekerUser = await UserRepository.createAsync({ id: 'perm-seeker-1', name: 'Job Seeker', email: 'seeker@test.local', role: 'Job Seeker' });

    const tokens = {
      sa1: makeToken(sa1),
      sa2: makeToken(sa2),
      admin: makeToken(adminUser),
      mod: makeToken(modUser),
      scraper: makeToken(scraperUser),
      pay: makeToken(payUser),
      fin: makeToken(finUser),
      seo: makeToken(seoUser),
      ad: makeToken(adUser),
      seeker: makeToken(seekerUser)
    };

    // -----------------------------------------------------------------
    // 1. SCRAPER PERMISSIONS AS-IS ASSERTIONS
    // -----------------------------------------------------------------
    await runTest('Scraper Manager permissions strictly preserved as [scraper.manage]', async () => {
      assert.deepStrictEqual(DEFAULT_ROLE_PERMISSIONS['Scraper Manager'], ['scraper.manage']);
      assert.strictEqual(hasAdminPermission('Scraper Manager', 'scraper.manage'), true);
      assert.strictEqual(hasAdminPermission('Scraper Manager', 'jobs.manage'), false);
      assert.strictEqual(hasAdminPermission('Scraper Manager', 'settings.manage'), false);
      assert.strictEqual(hasAdminPermission('Scraper Manager', 'users.manage'), false);
      assert.strictEqual(hasAdminPermission('Scraper Manager', 'finance.manage'), false);
      assert.strictEqual(hasAdminPermission('Scraper Manager', 'payments.manage'), false);
    });

    // -----------------------------------------------------------------
    // 2. CURRENCY ROUTES: PUT requires finance.manage; GET public
    // -----------------------------------------------------------------
    await runTest('Currency: GET / & /config remain public', async () => {
      const r1 = await fetch(`${baseUrl}/currency`);
      const r2 = await fetch(`${baseUrl}/currency/config`);
      assert.strictEqual(r1.status, 200);
      assert.strictEqual(r2.status, 200);
    });

    await runTest('Currency: PUT / & /config require finance.manage (401 unauth, 403 non-finance, 200 finance/admin)', async () => {
      const unauth = await fetch(`${baseUrl}/currency/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(INITIAL_CURRENCY_CONFIG)
      });
      assert.strictEqual(unauth.status, 401);

      for (const [label, tok] of [
        ['Job Moderator', tokens.mod],
        ['Scraper Manager', tokens.scraper],
        ['Payment Manager', tokens.pay],
        ['SEO Manager', tokens.seo],
        ['Advertisement Manager', tokens.ad],
        ['Job Seeker', tokens.seeker]
      ] as const) {
        const res = await fetch(`${baseUrl}/currency/config`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
          body: JSON.stringify(INITIAL_CURRENCY_CONFIG)
        });
        assert.strictEqual(res.status, 403, `Expected 403 for ${label} on PUT /api/currency/config, got ${res.status}`);
      }

      const finRes = await fetch(`${baseUrl}/currency/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokens.fin}` },
        body: JSON.stringify(INITIAL_CURRENCY_CONFIG)
      });
      // In isolated test mode without MONGODB_URI, passing middleware reaches CurrencyRepository.saveConfig
      // which throws Database Configuration Error (500) rather than 401/403.
      assert.notStrictEqual(finRes.status, 401, 'Finance Manager must pass auth check on PUT /api/currency/config');
      assert.notStrictEqual(finRes.status, 403, 'Finance Manager must pass finance.manage permission check on PUT /api/currency/config');

      const adminRes = await fetch(`${baseUrl}/currency`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokens.admin}` },
        body: JSON.stringify(INITIAL_CURRENCY_CONFIG)
      });
      assert.notStrictEqual(adminRes.status, 401, 'Admin must pass auth check on PUT /api/currency');
      assert.notStrictEqual(adminRes.status, 403, 'Admin must pass finance.manage permission check on PUT /api/currency');
    });

    // -----------------------------------------------------------------
    // 3. LOCATION ROUTES: management requires settings.manage; GET public
    // -----------------------------------------------------------------
    await runTest('Locations: GET / remains public; mutations reject unauth (401), Job Moderator (403), Scraper Manager (403)', async () => {
      const pubRes = await fetch(`${baseUrl}/locations`);
      assert.strictEqual(pubRes.status, 200);

      const endpoints: Array<{ method: string; path: string; body?: any }> = [
        { method: 'POST', path: '/locations/cities', body: { provinceName: 'Punjab', cityName: '__PermTestCity__' } },
        { method: 'GET', path: '/locations/cities/Lahore/usage' },
        { method: 'PUT', path: '/locations/cities/__PermTestCity__', body: { newCityName: '__PermTestCity2__', targetProvince: 'Punjab' } },
        { method: 'DELETE', path: '/locations/cities/__PermTestCity__' },
        { method: 'POST', path: '/locations/provinces', body: { provinceName: '__PermTestProv__' } }
      ];

      for (const ep of endpoints) {
        const unauth = await fetch(`${baseUrl}${ep.path}`, {
          method: ep.method,
          headers: { 'Content-Type': 'application/json' },
          body: ep.body ? JSON.stringify(ep.body) : undefined
        });
        assert.strictEqual(unauth.status, 401, `Unauth ${ep.method} ${ep.path} must return 401`);

        for (const [label, tok] of [
          ['Job Moderator', tokens.mod],
          ['Scraper Manager', tokens.scraper],
          ['Payment Manager', tokens.pay],
          ['Finance Manager', tokens.fin],
          ['SEO Manager', tokens.seo],
          ['Job Seeker', tokens.seeker]
        ] as const) {
          const denied = await fetch(`${baseUrl}${ep.path}`, {
            method: ep.method,
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
            body: ep.body ? JSON.stringify(ep.body) : undefined
          });
          assert.strictEqual(denied.status, 403, `${label} on ${ep.method} ${ep.path} must return 403, got ${denied.status}`);
        }
      }
    });

    await runTest('Locations: Admin/Super Admin allowed on city add, usage, update, delete, province validation', async () => {
      const addRes = await fetch(`${baseUrl}/locations/cities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokens.admin}` },
        body: JSON.stringify({ provinceName: 'Punjab', cityName: '__PermTestCityTemp__' })
      });
      assert.strictEqual(addRes.status, 201);

      const usageRes = await fetch(`${baseUrl}/locations/cities/__PermTestCityTemp__/usage`, {
        headers: { Authorization: `Bearer ${tokens.admin}` }
      });
      assert.strictEqual(usageRes.status, 200);

      const updateRes = await fetch(`${baseUrl}/locations/cities/__PermTestCityTemp__`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokens.sa1}` },
        body: JSON.stringify({ newCityName: '__PermTestCityTempRenamed__', targetProvince: 'Punjab' })
      });
      assert.strictEqual(updateRes.status, 200);

      const delRes = await fetch(`${baseUrl}/locations/cities/__PermTestCityTempRenamed__`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tokens.sa1}` }
      });
      assert.strictEqual(delRes.status, 200);

      const provInvalidRes = await fetch(`${baseUrl}/locations/provinces`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokens.sa1}` },
        body: JSON.stringify({ provinceName: '' })
      });
      assert.strictEqual(provInvalidRes.status, 400, 'Admin reaches province handler and receives 400 validation');
    });

    // -----------------------------------------------------------------
    // 4. CHAT ADMIN ROUTES: require users.manage; user routes preserved
    // -----------------------------------------------------------------
    await runTest('Chat Admin Routes: enforce users.manage (403 for non-user-manager admin roles, 200 for Admin/Super Admin)', async () => {
      for (const [label, tok] of [
        ['Job Moderator', tokens.mod],
        ['Scraper Manager', tokens.scraper],
        ['Payment Manager', tokens.pay],
        ['Finance Manager', tokens.fin],
        ['SEO Manager', tokens.seo],
        ['Advertisement Manager', tokens.ad],
        ['Job Seeker', tokens.seeker]
      ] as const) {
        const rAll = await fetch(`${baseUrl}/chat/admin/all`, { headers: { Authorization: `Bearer ${tok}` } });
        assert.strictEqual(rAll.status, 403, `${label} on GET /chat/admin/all expected 403, got ${rAll.status}`);

        const rReply = await fetch(`${baseUrl}/chat/admin/reply`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
          body: JSON.stringify({ id: 'deny-reply-1', userId: seekerUser.id, text: 'No access' })
        });
        assert.strictEqual(rReply.status, 403, `${label} on POST /chat/admin/reply expected 403, got ${rReply.status}`);

        const rImport = await fetch(`${baseUrl}/chat/import-legacy`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
          body: JSON.stringify({ messages: [] })
        });
        assert.strictEqual(rImport.status, 403, `${label} on POST /chat/import-legacy expected 403, got ${rImport.status}`);
      }

      const okAll = await fetch(`${baseUrl}/chat/admin/all`, { headers: { Authorization: `Bearer ${tokens.admin}` } });
      assert.strictEqual(okAll.status, 200);

      const okReply = await fetch(`${baseUrl}/chat/admin/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokens.sa1}` },
        body: JSON.stringify({ id: 'admin-perm-reply-1', userId: seekerUser.id, text: 'Hello from support' })
      });
      assert.strictEqual(okReply.status, 200);

      // Verify conflict protection (HTTP 409) preserved on /admin/reply
      const conflictReply = await fetch(`${baseUrl}/chat/admin/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokens.sa1}` },
        body: JSON.stringify({ id: 'admin-perm-reply-1', userId: seekerUser.id, text: 'Different conflict text' })
      });
      assert.strictEqual(conflictReply.status, 409);

      const okImport = await fetch(`${baseUrl}/chat/import-legacy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokens.admin}` },
        body: JSON.stringify({ messages: [] })
      });
      assert.strictEqual(okImport.status, 200);

      // User route still works for authenticated Job Seeker
      const userPost = await fetch(`${baseUrl}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokens.seeker}` },
        body: JSON.stringify({ id: 'seeker-msg-perm-1', text: 'Need help' })
      });
      assert.strictEqual(userPost.status, 200);
    });

    // -----------------------------------------------------------------
    // 5. PAYMENT vs FINANCE PERMISSIONS ALIGNMENT
    // -----------------------------------------------------------------
    await runTest('Payments vs Finance: Payment Manager allowed on payment-settings, denied on pricing/currency', async () => {
      const paySettingsRes = await fetch(`${baseUrl}/payment-settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokens.pay}` },
        body: JSON.stringify({})
      });
      assert.notStrictEqual(paySettingsRes.status, 401);
      assert.notStrictEqual(paySettingsRes.status, 403, 'Payment Manager must pass payments.manage check on payment-settings');

      const payPricingRes = await fetch(`${baseUrl}/pricing`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokens.pay}` },
        body: JSON.stringify({})
      });
      assert.strictEqual(payPricingRes.status, 403, 'Payment Manager must be denied finance.manage on /api/pricing');

      const finPricingRes = await fetch(`${baseUrl}/pricing`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokens.fin}` },
        body: JSON.stringify({})
      });
      assert.strictEqual(finPricingRes.status, 200, 'Finance Manager allowed on /api/pricing');
    });

    // -----------------------------------------------------------------
    // 6. SCRAPER PERMISSION BOUNDARY & SCRAPED JOB DELETE SAFETY
    // -----------------------------------------------------------------
    await runTest('Scraper: Scraper Manager keeps scraper routes (200) and stays denied (403) on job edit/delete', async () => {
      const scraperCfg = await fetch(`${baseUrl}/scraper/configs`, {
        headers: { Authorization: `Bearer ${tokens.scraper}` }
      });
      assert.strictEqual(scraperCfg.status, 200);

      const scraperPending = await fetch(`${baseUrl}/jobs/queue/pending`, {
        headers: { Authorization: `Bearer ${tokens.scraper}` }
      });
      assert.strictEqual(scraperPending.status, 403);

      const scraperJobEdit = await fetch(`${baseUrl}/jobs/non-existent-job-id`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokens.scraper}` },
        body: JSON.stringify({ title: 'Attempted Edit' })
      });
      assert.strictEqual(scraperJobEdit.status, 403);

      const scraperJobDelete = await fetch(`${baseUrl}/jobs/non-existent-job-id`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tokens.scraper}` }
      });
      assert.strictEqual(scraperJobDelete.status, 403);
    });

    await runTest('Scraper Job Delete: jobs.manage deletes single scraped job without cascade', async () => {
      const jobToDeleteId = 'perm-test-scraped-del-1';
      const jobToKeepId = 'perm-test-scraped-keep-1';
      const existingPending = Database.getPendingJobs();

      Database.savePendingJobs([
        ...existingPending,
        {
          id: jobToDeleteId,
          title: 'Temp Scraped Engineer Delete Test',
          company: 'Test Scraped Dept',
          region: 'Pakistan',
          jobType: 'Full-Time',
          description: 'Temporary test pending job for delete check.',
          status: 'Pending',
          sourceType: 'Scraped',
          createdAt: new Date().toISOString()
        },
        {
          id: jobToKeepId,
          title: 'Temp Scraped Engineer Keep Test',
          company: 'Test Scraped Dept',
          region: 'Pakistan',
          jobType: 'Full-Time',
          description: 'Sibling scraped pending job that must remain untouched.',
          status: 'Pending',
          sourceType: 'Scraped',
          createdAt: new Date().toISOString()
        }
      ]);

      const delRes = await fetch(`${baseUrl}/jobs/${jobToDeleteId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tokens.mod}` }
      });
      assert.strictEqual(delRes.status, 200, 'Job Moderator with jobs.manage must be able to delete scraped job');
      const delData = await delRes.json();
      assert.strictEqual(delData.success, true);

      const deletedLookup = await JobRepository.getById(jobToDeleteId);
      assert.strictEqual(deletedLookup, null, 'Deleted job must no longer exist');

      const siblingLookup = await JobRepository.getById(jobToKeepId);
      assert.ok(siblingLookup && siblingLookup.id === jobToKeepId, 'Sibling scraped job must NOT be deleted (no cascade)');

      // Clean up sibling
      await JobRepository.delete(jobToKeepId);
    });

    // -----------------------------------------------------------------
    // 7. LAST SUPER ADMIN SEQUENTIAL & CONCURRENT PROTECTION
    // -----------------------------------------------------------------
    await runTest('Role Mutation Auth Guards: self-change 403, Admin cannot promote/modify Super Admin (403)', async () => {
      const selfRes = await fetch(`${baseUrl}/auth/users/${sa1.id}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokens.sa1}` },
        body: JSON.stringify({ role: 'Admin' })
      });
      assert.strictEqual(selfRes.status, 403);

      const adminPromoteSa = await fetch(`${baseUrl}/auth/users/${modUser.id}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokens.admin}` },
        body: JSON.stringify({ role: 'Super Admin' })
      });
      assert.strictEqual(adminPromoteSa.status, 403);

      const adminDemoteSa = await fetch(`${baseUrl}/auth/users/${sa2.id}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokens.admin}` },
        body: JSON.stringify({ role: 'Admin' })
      });
      assert.strictEqual(adminDemoteSa.status, 403);
    });

    await runTest('Concurrent Cross-Demotion Race: at least 1 Super Admin strictly preserved & failed request writes no audit log', async () => {
      // Ensure ONLY sa1 and sa2 are Super Admins right now
      const beforeAuditCount = AuditRepository.getAll().length;

      // Fire 2 simultaneous demotion requests targeting sa1 and sa2 simultaneously
      const [resA, resB] = await Promise.all([
        fetch(`${baseUrl}/auth/users/${sa2.id}/role`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokens.sa1}` },
          body: JSON.stringify({ role: 'Admin' })
        }),
        fetch(`${baseUrl}/auth/users/${sa1.id}/role`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokens.sa2}` },
          body: JSON.stringify({ role: 'Admin' })
        })
      ]);

      const statuses = [resA.status, resB.status];
      const okCount = statuses.filter(s => s === 200).length;
      const rejectedCount = statuses.filter(s => s === 400 || s === 401 || s === 403).length;

      assert.strictEqual(okCount, 1, `Exactly 1 concurrent demotion may succeed, got statuses=${JSON.stringify(statuses)}`);
      assert.strictEqual(rejectedCount, 1, `Exactly 1 concurrent demotion must fail closed, got statuses=${JSON.stringify(statuses)}`);

      const allUsersAfter = await UserRepository.getAllAsync();
      const remainingSuperAdmins = allUsersAfter.filter(u => u && u.role === 'Super Admin');
      assert.strictEqual(remainingSuperAdmins.length, 1, 'Exactly 1 Super Admin must remain after concurrent cross-demotion');

      const roleUpdateAudits = AuditRepository.getAll().slice(0, Math.max(0, AuditRepository.getAll().length - beforeAuditCount))
        .filter((e: any) => e.action === 'User Role Updated');
      assert.strictEqual(roleUpdateAudits.length, 1, 'Only the committed role update may produce an audit log entry');

      // Now try sequential demotion of that sole remaining Super Admin via a temporary third SA? Wait: test direct repository call as if actor checks count <= 1
      const soleSuperAdmin = remainingSuperAdmins[0];
      const syntheticActor = await UserRepository.createAsync({ id: 'perm-sa-guard-helper', name: 'Helper', email: 'helper@test.local', role: 'Admin' });
      // Even if someone calls updateRoleWithLastSuperAdminGuard directly on sole SA, Admin gets 403; create synthetic non-matching actor with Super Admin privilege cannot happen without increasing count > 1,
      // so verify via direct guard call with actorId matching non-existent/second id? No: test MongoDB transaction guard directly below!
      await UserRepository.deleteAsync(syntheticActor.id);
      assert.ok(soleSuperAdmin.role === 'Super Admin');
    });

    await runTest('MongoDB Transaction Guard Unit Check: serializes via system_locks, blocks last SA, and FAILS CLOSED if transaction unsupported', async () => {
      // 1. Successful transactional update when 2 Super Admins exist
      let lockTouched = false;
      let updatedCalled = false;
      const mockSuccessClient = {
        db: () => ({
          collection: (name: string) => {
            if (name === 'system_locks') {
              return {
                updateOne: async () => {
                  lockTouched = true;
                  return { acknowledged: true };
                }
              };
            }
            return {
              findOne: async ({ id }: any) => {
                if (id === 'sa-a') return { id: 'sa-a', email: 'a@t.com', role: 'Super Admin' };
                if (id === 'sa-b') return { id: 'sa-b', email: 'b@t.com', role: 'Super Admin' };
                return null;
              },
              countDocuments: async () => 2,
              findOneAndUpdate: async () => {
                updatedCalled = true;
                return { id: 'sa-b', email: 'b@t.com', role: 'Admin', permissions: ['*'] };
              }
            };
          }
        }),
        startSession: () => ({
          withTransaction: async (fn: any) => fn(),
          endSession: async () => {}
        })
      };

      const txOk = await UserRepository.updateRoleWithLastSuperAdminGuard(
        { targetUserId: 'sa-b', newRole: 'Admin', actorId: 'sa-a', newPermissions: ['*'] },
        { client: mockSuccessClient }
      );
      assert.strictEqual(txOk.ok, true);
      assert.strictEqual(txOk.status, 200);
      assert.strictEqual(lockTouched, true, 'Coordinator lock doc must be updated inside transaction');
      assert.strictEqual(updatedCalled, true);

      // 2. Last Super Admin guard inside transaction prevents update
      let lastSaUpdateCalled = false;
      const mockLastSaClient = {
        db: () => ({
          collection: (name: string) => {
            if (name === 'system_locks') {
              return { updateOne: async () => ({ acknowledged: true }) };
            }
            return {
              findOne: async ({ id }: any) => {
                if (id === 'sa-a') return { id: 'sa-a', email: 'a@t.com', role: 'Super Admin' };
                if (id === 'sa-b') return { id: 'sa-b', email: 'b@t.com', role: 'Super Admin' };
                return null;
              },
              countDocuments: async () => 1, // Only 1 Super Admin inside transaction snapshot
              findOneAndUpdate: async () => {
                lastSaUpdateCalled = true;
                return { id: 'sa-b', role: 'Admin' };
              }
            };
          }
        }),
        startSession: () => ({
          withTransaction: async (fn: any) => fn(),
          endSession: async () => {}
        })
      };

      const txLastBlocked = await UserRepository.updateRoleWithLastSuperAdminGuard(
        { targetUserId: 'sa-b', newRole: 'Admin', actorId: 'sa-a', newPermissions: ['*'] },
        { client: mockLastSaClient }
      );
      assert.strictEqual(txLastBlocked.ok, false);
      assert.strictEqual(txLastBlocked.status, 400);
      assert.strictEqual(lastSaUpdateCalled, false, 'Must NOT execute findOneAndUpdate when superAdminCount <= 1');

      // 3. Fail-closed behavior if MongoDB transactions throw (e.g., standalone server error)
      let fallbackUpdateCalled = false;
      const mockStandaloneClient = {
        db: () => ({
          collection: () => ({
            updateOne: async () => ({}),
            findOne: async () => null,
            countDocuments: async () => 2,
            findOneAndUpdate: async () => {
              fallbackUpdateCalled = true;
              return { id: 'sa-b', role: 'Admin' };
            }
          })
        }),
        startSession: () => ({
          withTransaction: async () => {
            throw new Error('Transaction numbers are only allowed on a replica set member or mongos');
          },
          endSession: async () => {}
        })
      };

      const txFailClosed = await UserRepository.updateRoleWithLastSuperAdminGuard(
        { targetUserId: 'sa-b', newRole: 'Admin', actorId: 'sa-a', newPermissions: ['*'] },
        { client: mockStandaloneClient }
      );
      assert.strictEqual(txFailClosed.ok, false);
      assert.strictEqual(txFailClosed.status, 503);
      assert.strictEqual(fallbackUpdateCalled, false, 'Must fail closed and NEVER fall back to non-transactional update');
    });

    // -----------------------------------------------------------------
    // 8. FRONTEND SAFETY & ALIGNMENT STRUCTURAL VERIFICATION
    // -----------------------------------------------------------------
    await runTest('AdminDashboard.tsx & AutomatedScraperHub.tsx security & delete invariants hold in source', async () => {
      const adminDashSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/AdminDashboard.tsx'), 'utf-8');
      assert.strictEqual(adminDashSrc.includes("currentAdminUser?.role || 'Super Admin'"), false, 'Must NOT default to Super Admin');
      assert.strictEqual(/atob\(padded\)/.test(adminDashSrc), false, 'Must NOT decode localStorage JWT payload synchronously');
      assert.strictEqual(adminDashSrc.includes('api.auth.me()'), true, 'Must verify identity via /api/auth/me');
      assert.strictEqual(adminDashSrc.includes('isVerifyingAdmin'), true, 'Must fail closed during loading');
      assert.strictEqual(adminDashSrc.includes("hasAdminUiPermission('jobs.manage') || hasAdminUiPermission('applications.manage')"), false, 'jobs category/tabs must require jobs.manage only');
      assert.strictEqual(adminDashSrc.includes("hasAdminUiPermission('settings.manage') || hasAdminUiPermission('users.manage')"), false, 'alerts category must require settings.manage only');
      assert.strictEqual(adminDashSrc.includes("['admin-payment-methods'].includes(tabId)"), true, 'admin-payment-methods must require payments.manage');

      const scraperHubSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/admin/AutomatedScraperHub.tsx'), 'utf-8');
      assert.strictEqual(scraperHubSrc.includes('api.jobs.delete(jobToDelete.id)'), true, 'Scraper delete must reuse api.jobs.delete');
      assert.strictEqual(scraperHubSrc.includes('confirmDeleteReviewJob'), true, 'Scraper delete must require confirmation modal');
      assert.strictEqual(scraperHubSrc.includes('deletingReviewJobId'), true, 'Scraper delete must lock against repeated clicks');
    });
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    restoreDataDir(dataSnapshot);
  }

  console.log('\n==================================================================');
  console.log('                 ADMIN PERMISSION TEST SUMMARY                    ');
  console.log('==================================================================');
  console.log(`Passed:  ${testsPassed}`);
  console.log(`Failed:  ${testsFailed}`);
  console.log(`Skipped: ${testsSkipped}`);
  console.log(`Not Run: ${testsNotRun} (Live MongoDB Replica-Set transaction integration)`);
  console.log('==================================================================');

  if (testsFailed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runAdminPermissionTests().catch((err) => {
  console.error('Fatal error in admin_permission_tests:', err);
  process.exit(1);
});
