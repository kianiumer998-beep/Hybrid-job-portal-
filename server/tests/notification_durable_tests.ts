import assert from 'assert';
import express from 'express';
import { createServer, Server } from 'http';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

/**
 * Helper to calculate SHA-256 of all JSON files in /data
 */
function getDataDirectorySnapshot(): Record<string, string> {
  const dataDir = path.resolve(process.cwd(), 'data');
  const snapshot: Record<string, string> = {};
  
  if (!fs.existsSync(dataDir)) return snapshot;

  const files = fs.readdirSync(dataDir);
  for (const file of files) {
    if (file.endsWith('.json')) {
      const filePath = path.join(dataDir, file);
      const content = fs.readFileSync(filePath);
      const hash = crypto.createHash('sha256').update(content).digest('hex');
      snapshot[file] = hash;
    }
  }
  return snapshot;
}

async function runTests() {
  // 0. Environment isolation
  const originalEnv = { ...process.env };
  process.env.IS_TEST = 'true';
  process.env.MONGODB_URI = '';
  process.env.MONGO_URI = '';
  delete process.env.USE_REAL_MONGO_TEST;

  // Pre-test snapshot
  const preTestSnapshot = getDataDirectorySnapshot();

  // Dynamic imports
  const { NotificationRepository } = await import('../db/repositories/NotificationRepository');
  const { UserRepository } = await import('../db/repositories/UserRepository');
  const { JobRepository } = await import('../db/repositories/JobRepository');
  const { ApplicationRepository } = await import('../db/repositories/ApplicationRepository');
  const { PaymentSettingsRepository } = await import('../db/repositories/PaymentSettingsRepository');
  const { transactionRouter } = await import('../routes/transactionRoutes');
  const { notificationRouter } = await import('../routes/notificationRoutes');
  const { jobRouter } = await import('../routes/jobRoutes');
  const { applicationRouter } = await import('../routes/applicationRoutes');
  const { JobVisibilityRepository } = await import('../db/repositories/JobVisibilityRepository');
  const { Database } = await import('../db/database');

  console.log('===============================================================');
  console.log('=== DURABLE NOTIFICATION & ROUTE INTEGRATION TEST SUITE ===');
  console.log('===============================================================\n');

  // --- 1. Snapshot original state ---
  const originalGetPublicSettings = PaymentSettingsRepository.getPublicSettings;
  const originalIsUserPremium = JobVisibilityRepository.isUserPremiumAuthoritative;

  // --- 2. Comprehensive Database Mocking (Storage Isolation) ---
  const originalDatabase = { ...Database };
  
  // In-memory state for the test
  let inMemTransactions: any[] = [];
  let inMemAuditLogs: any[] = [];
  let inMemUsers: any[] = [];
  let inMemJobs: any[] = [];
  let inMemPendingJobs: any[] = [];
  let inMemApplications: any[] = [];

  // Override all persistence methods to prevent JSON file writes
  Database.saveTransactions = (txs: any[]) => { inMemTransactions = [...txs]; };
  Database.addTransaction = (tx: any) => {
    const newTx = { ...tx, id: tx.id || `tx-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`, dateTime: tx.dateTime || new Date().toISOString().replace('T', ' ').substring(0, 16) };
    inMemTransactions.unshift(newTx);
    return newTx;
  };
  Database.getTransactions = () => [...inMemTransactions];

  Database.addAuditLog = (entry: any) => {
    const newLog = { id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`, timestamp: new Date().toISOString(), status: 'Success', ...entry };
    inMemAuditLogs.unshift(newLog);
    return newLog;
  };
  Database.getAuditLogs = () => [...inMemAuditLogs];

  Database.saveUsers = (users: any[]) => { inMemUsers = [...users]; };
  Database.getUsers = () => [...inMemUsers];

  Database.saveJobs = (jobs: any[]) => { inMemJobs = [...jobs]; };
  Database.getJobs = () => [...inMemJobs];
  Database.addJob = (job: any) => {
    inMemJobs.push(job);
    return job;
  };

  Database.savePendingJobs = (jobs: any[]) => { inMemPendingJobs = [...jobs]; };
  Database.getPendingJobs = () => [...inMemPendingJobs];
  Database.addPendingJob = (job: any) => {
    inMemPendingJobs.push(job);
    return job;
  };

  Database.saveApplications = (apps: any[]) => { inMemApplications = [...apps]; };
  Database.getApplications = () => [...inMemApplications];
  Database.addApplication = (app: any) => {
    inMemApplications.push(app);
    return app;
  };

  // Stub other potentially dangerous methods
  const noop = () => {};
  Database.saveAds = noop;
  Database.saveApplySettings = noop;
  (Database as any).saveLocationCatalog = noop;
  Database.savePricing = noop;
  (Database as any).saveScraperRuns = noop;
  Database.saveScraperSources = noop;
  Database.saveSeoConfig = noop;
  Database.addScraperRun = (run: any) => ({ ...run, id: run.id || `run-${Date.now()}` });

  let httpServer: Server | null = null;
  let testCount = 0;
  let passCount = 0;

  try {
    // --- 3. Initialize Memory-Only Test Mode Mocks ---
    JobVisibilityRepository.isUserPremiumAuthoritative = async () => true;
    console.log('➜ STORAGE MODE: IN-MEMORY FALLBACK UNIT-TEST MODE (Strict Isolation)');
    console.log('[NOT RUN] Live MongoDB Integration tests: Real MongoDB not supported in this test suite.');

    Database.getApplySettings = () => ({
      requireCv: false,
      requirePhone: false,
      requireEmail: false,
      enforceDeadlines: false
    });

    PaymentSettingsRepository.getPublicSettings = async () => ({
      isConfigured: true,
      settings: {
        isConfigured: true,
        requireCv: false,
        requirePhone: false,
        requireEmail: false,
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

    const app = express();
    app.use(express.json());
    let activeTestUser: any = null;
    app.use((req, res, next) => { if (activeTestUser) { (req as any).user = activeTestUser; } next(); });
    app.use('/api/transactions', transactionRouter);
    app.use('/api/notifications', notificationRouter);
    app.use('/api/jobs', jobRouter);
    app.use('/api/applications', applicationRouter);

    httpServer = await new Promise((resolve) => {
      const s = createServer(app);
      s.listen(0, '127.0.0.1', () => resolve(s));
    });

    const port = (httpServer.address() as any).port;
    const baseUrl = `http://127.0.0.1:${port}`;

    const testUserAId = `usera-int-${Date.now()}`;
    const testUserBId = `userb-int-${Date.now()}`;
    const adminUserId = `admin-int-${Date.now()}`;

    await UserRepository.createAsync({ id: adminUserId, name: 'Administrator', email: 'admin-int@example.com', role: 'Super Admin' });
    await UserRepository.createAsync({ id: testUserAId, name: 'User A', email: 'usera-int@example.com', role: 'Employer' });
    await UserRepository.createAsync({ id: testUserBId, name: 'User B', email: 'userb-int@example.com', role: 'Member' });

    console.log('\n--- 1. Idempotency & Conflict Validation ---');

    // Test 1: Same event key + same recipient/content
    testCount++;
    const eventKey1 = `evt-idemp-same-${Date.now()}`;
    const notif1a = await NotificationRepository.createAsync({
      userId: testUserAId,
      title: 'Title Match',
      message: 'Message Match',
      type: 'info',
      channel: 'in-app',
      eventId: eventKey1
    });
    const notif1b = await NotificationRepository.createAsync({
      userId: testUserAId,
      title: 'Title Match',
      message: 'Message Match',
      type: 'info',
      channel: 'in-app',
      eventId: eventKey1
    });
    assert.strictEqual(notif1a.id, notif1b.id);
    passCount++;
    console.log('✓ Test 1: Same key + same content returns existing record.');

    // Test 2: Same event key + different recipient
    testCount++;
    try {
      await NotificationRepository.createAsync({
        userId: testUserBId,
        title: 'Title Match',
        message: 'Message Match',
        type: 'info',
        channel: 'in-app',
        eventId: eventKey1
      });
      assert.fail('Should have rejected different recipient');
    } catch (err: any) {
      assert(err.message.includes('idempotency collision'));
    }
    passCount++;
    console.log('✓ Test 2: Same key + different recipient is rejected.');

    // Test 3: Same event key + different content
    testCount++;
    try {
      await NotificationRepository.createAsync({
        userId: testUserAId,
        title: 'Different Title',
        message: 'Message Match',
        type: 'info',
        channel: 'in-app',
        eventId: eventKey1
      });
      assert.fail('Should have rejected different content');
    } catch (err: any) {
      assert(err.message.includes('idempotency collision'));
    }
    passCount++;
    console.log('✓ Test 3: Same key + different content is rejected.');

    console.log('\n--- 2. Job Moderation & Exclusions ---');

    // Test 4: Single rejection notifies verified owner
    testCount++;
    const userJobId = `job-user-${Date.now()}`;
    Database.addPendingJob({ id: userJobId, title: 'Software Job', submittedByUserId: testUserAId, sourceType: 'user_posted', status: 'Pending' } as any);
    activeTestUser = { userId: adminUserId, role: 'Super Admin' };
    const rejectRes = await fetch(`${baseUrl}/api/jobs/queue/pending/${userJobId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Incomplete' })
    });
    assert.strictEqual(rejectRes.status, 200);
    const userANotifs = await NotificationRepository.getAllAsync({ userId: testUserAId });
    assert(userANotifs.some(n => n.eventId === `notif-job-reject-${userJobId}`));
    passCount++;
    console.log('✓ Test 4: Single rejection notifies verified owner.');

    // Test 5: Scraped/Admin jobs do not notify
    testCount++;
    const scrapedJobId = `scraped-${Date.now()}`;
    Database.addPendingJob({ id: scrapedJobId, title: 'Scraped Job', isScraped: true, sourceType: 'scraped', status: 'Pending' } as any);
    await fetch(`${baseUrl}/api/jobs/queue/pending/${scrapedJobId}/reject`, { method: 'POST' });
    const allNotifs = await NotificationRepository.getAllAsync();
    assert(!allNotifs.some(n => n.eventId === `notif-job-reject-${scrapedJobId}`));
    passCount++;
    console.log('✓ Test 5: Scraped jobs do not receive user notifications.');

    // Test 6: Missing recipient skip
    testCount++;
    const missingUserJobId = `job-missing-${Date.now()}`;
    Database.addPendingJob({ id: missingUserJobId, title: 'Job for Ghost', submittedByUserId: 'non-existent-user', sourceType: 'user_posted', status: 'Pending' } as any);
    const missingRejectRes = await fetch(`${baseUrl}/api/jobs/queue/pending/${missingUserJobId}/reject`, { method: 'POST' });
    assert.strictEqual(missingRejectRes.status, 200);
    passCount++;
    console.log('✓ Test 6: Missing recipient user is safely skipped.');

    console.log('\n--- 3. Bulk Identities & Ordering ---');

    // Test 7: Bulk event ID deterministic
    testCount++;
    const bulkIds = [`b1-${Date.now()}`, `b2-${Date.now()}`];
    bulkIds.forEach(id => Database.addPendingJob({ id, title: 'Bulk', submittedByUserId: testUserAId, sourceType: 'user_posted', status: 'Pending' } as any));

    const hashInput1 = JSON.stringify(['bulk-reject', testUserAId, [...bulkIds].sort(), 'Bulk Reject']);
    const expectedEventId = `notif-job-bulk-reject-${crypto.createHash('sha256').update(hashInput1).digest('hex')}`;

    await fetch(`${baseUrl}/api/jobs/bulk-reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [...bulkIds].reverse(), reason: 'Bulk Reject' })
    });
    const bulkNotifs = await NotificationRepository.getAllAsync({ userId: testUserAId });
    assert(bulkNotifs.some(n => n.eventId === expectedEventId));
    passCount++;
    console.log('✓ Test 7: Bulk event IDs remain deterministic regardless of ordering.');

    console.log('\n--- 4. Application Notifications & Security ---');

    // Test 8: Application submission notifies verified job owner
    testCount++;
    const liveJobId = `live-job-${Date.now()}`;
    Database.addJob({ id: liveJobId, title: 'Live Job', submittedByUserId: testUserAId, sourceType: 'user_posted', status: 'Approved' } as any);
    activeTestUser = { userId: testUserBId, role: 'Member', name: 'User B', email: 'userb-int@example.com' };
    const appSubRes = await fetch(`${baseUrl}/api/applications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId: liveJobId, applicantPhone: '123' })
    });
    const subData = await appSubRes.json();
    assert.strictEqual(appSubRes.status, 201);
    const appId = subData.application.id;
    const ownerNotifsSub = await NotificationRepository.getAllAsync({ userId: testUserAId });
    assert(ownerNotifsSub.some(n => n.eventId === `notif-app-submit-${appId}`));
    passCount++;
    console.log('✓ Test 8: Application submission notifies only the verified job owner.');

    // Test 9: Application status update notifies verified applicant
    testCount++;
    activeTestUser = { userId: testUserAId, role: 'Employer' };
    const statusUpdateRes = await fetch(`${baseUrl}/api/applications/${appId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'Shortlisted' })
    });
    assert.strictEqual(statusUpdateRes.status, 200);
    const applicantNotifs = await NotificationRepository.getAllAsync({ userId: testUserBId });
    assert(applicantNotifs.some(n => n.eventId.includes(`-Applied-Shortlisted-`)));
    passCount++;
    console.log('✓ Test 9: Status update notifies only the verified applicant.');

    // Test 10: Repeated unchanged status does not notify
    testCount++;
    const currentNotifCount = (await NotificationRepository.getAllAsync({ userId: testUserBId })).length;
    await fetch(`${baseUrl}/api/applications/${appId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'Shortlisted' })
    });
    const afterNotifCount = (await NotificationRepository.getAllAsync({ userId: testUserBId })).length;
    assert.strictEqual(afterNotifCount, currentNotifCount);
    passCount++;
    console.log('✓ Test 10: Repeated unchanged status does not create a new notification.');

    // Test 11: Unauthorized 403 before lookup
    testCount++;
    activeTestUser = { userId: testUserBId, role: 'Member' }; // Not owner
    const unauthRes = await fetch(`${baseUrl}/api/applications/non-existent-id/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'Hired' })
    });
    assert.strictEqual(unauthRes.status, 403);
    passCount++;
    console.log('✓ Test 11: Unauthorized requests receive 403 before application lookup.');

    console.log('\n--- 5. Payment Regressions ---');

    // Test 12: Payment proof submission notification
    testCount++;
    activeTestUser = { userId: testUserBId, role: 'Member' };
    const txId = `tx-${Date.now()}`;
    const txRes = await fetch(`${baseUrl}/api/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 1000, type: 'Wallet Deposit', paymentMethod: 'easypaisa', transactionId: txId, senderName: 'B', senderPhoneOrAccount: '123' })
    });
    const txData = await txRes.json();
    assert.strictEqual(txRes.status, 201);
    const subTxId = txData.transaction.id;
    const txNotifs = await NotificationRepository.getAllAsync({ userId: testUserBId });
    assert(txNotifs.some(n => n.eventId === `payment-submitted-${subTxId}`));
    passCount++;
    console.log('✓ Test 12: Payment submission generates notification.');

    console.log('\n--- 6. Storage Safety Regression ---');
    
    testCount++;
    const postTestSnapshot = getDataDirectorySnapshot();
    for (const [file, preHash] of Object.entries(preTestSnapshot)) {
      const postHash = postTestSnapshot[file];
      assert.strictEqual(postHash, preHash, `Storage corruption detected in ${file}! Hash mismatch.`);
    }
    // Check for new files
    for (const file of Object.keys(postTestSnapshot)) {
      if (!(file in preTestSnapshot)) {
        assert.fail(`Unauthorized new data file created: ${file}`);
      }
    }
    passCount++;
    console.log('✓ Test 13: Storage isolation verified (SHA-256 integrity check passed).');

  } catch (err: any) {
    console.error('\n[TEST ERROR]', err);
    throw err;
  } finally {
    // --- Cleanup ---
    if (httpServer) httpServer.close();
    
    // Restore Env
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) delete process.env[key];
    }
    for (const key of Object.keys(originalEnv)) {
      process.env[key] = originalEnv[key];
    }

    // Restore Repository methods
    PaymentSettingsRepository.getPublicSettings = originalGetPublicSettings;
    JobVisibilityRepository.isUserPremiumAuthoritative = originalIsUserPremium;

    // Restore Database methods
    Object.assign(Database, originalDatabase);
    
    // Clear Notification memory store
    NotificationRepository.clearInMemoryStore();

    if (passCount === testCount && testCount > 0) {
      console.log(`\n===============================================================`);
      console.log(`=== ALL ${passCount} TEST SCENARIOS PASSED SUCCESSFULLY (IN_MEMORY) ===`);
      console.log(`===============================================================\n`);
    } else {
      console.log(`\n===============================================================`);
      console.log(`=== TEST SUITE FINISHED: ${passCount}/${testCount} PASSED (IN_MEMORY) ===`);
      console.log(`===============================================================\n`);
      process.exit(1);
    }
  }
}

runTests().catch((err) => {
  console.error('\n[FATAL FAILURE]', err);
  process.exit(1);
});
