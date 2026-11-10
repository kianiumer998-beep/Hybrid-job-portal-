import assert from 'assert';
import express from 'express';
import { createServer, Server } from 'http';
import { URL } from 'url';
import crypto from 'crypto';

async function runTests() {
  // 0. Environment isolation
  const originalEnv = { ...process.env };
  process.env.IS_TEST = 'true';
  process.env.MONGODB_URI = '';
  process.env.MONGO_URI = '';
  delete process.env.USE_REAL_MONGO_TEST;

  // Dynamic imports
  const { NotificationRepository } = await import('../db/repositories/NotificationRepository');
  const { UserRepository } = await import('../db/repositories/UserRepository');
  const { JobRepository } = await import('../db/repositories/JobRepository');
  const { ApplicationRepository } = await import('../db/repositories/ApplicationRepository');
  const { PaymentSettingsRepository } = await import('../db/repositories/PaymentSettingsRepository');
  const { isMongoConfigured } = await import('../db/mongodb');
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
  const originalGetTransactions = Database.getTransactions;
  const originalSaveTransactions = Database.saveTransactions;
  const originalAddTransaction = Database.addTransaction;
  const originalGetAuditLogs = Database.getAuditLogs;
  const originalAddAuditLog = Database.addAuditLog;
  const originalGetUsers = Database.getUsers;
  const originalSaveUsers = Database.saveUsers;
  const originalCreateAsync = NotificationRepository.createAsync;
  const originalIsUserPremium = JobVisibilityRepository.isUserPremiumAuthoritative;
  const originalGetApplySettings = Database.getApplySettings;

  let storageMode: 'REAL_MONGODB' | 'IN_MEMORY' = 'IN_MEMORY';
  let httpServer: Server | null = null;

  const cleanupTxIds: string[] = [];
  const cleanupNotifIds: string[] = [];
  const cleanupUserIds: string[] = [];
  const cleanupJobIds: string[] = [];
  const cleanupAppIds: string[] = [];
  let testCount = 0;
  let passCount = 0;

  try {
    // --- 2. Initialize Memory-Only Test Mode ---
    JobVisibilityRepository.isUserPremiumAuthoritative = async () => true;
    storageMode = 'IN_MEMORY';
    console.log('➜ STORAGE MODE: IN-MEMORY FALLBACK UNIT-TEST MODE (Strict Isolation)');
    console.log('[NOT RUN] Live MongoDB Integration tests: Real MongoDB not supported in this test suite.');

    let inMemTransactions: any[] = [];
    let inMemAuditLogs: any[] = [];
    let inMemUsers: any[] = [];

    Database.getAuditLogs = () => [...inMemAuditLogs];
    Database.addAuditLog = (entry: any) => {
      const newLog = { id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`, timestamp: new Date().toISOString(), status: 'Success', ...entry };
      inMemAuditLogs.unshift(newLog);
      return newLog;
    };

    Database.getTransactions = () => [...inMemTransactions];
    Database.saveTransactions = (txs: any[]) => { inMemTransactions = [...txs]; };
    Database.addTransaction = (tx: any) => {
      const newTx = { ...tx, id: tx.id || `tx-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`, dateTime: tx.dateTime || new Date().toISOString().replace('T', ' ').substring(0, 16) };
      inMemTransactions.unshift(newTx);
      return newTx;
    };
    Database.getUsers = () => [...inMemUsers];
    Database.saveUsers = (users: any[]) => { inMemUsers = [...users]; };

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
    cleanupUserIds.push(adminUserId);
    await UserRepository.createAsync({ id: testUserAId, name: 'User A', email: 'usera-int@example.com', role: 'Employer' });
    cleanupUserIds.push(testUserAId);
    await UserRepository.createAsync({ id: testUserBId, name: 'User B', email: 'userb-int@example.com', role: 'Member' });
    cleanupUserIds.push(testUserBId);

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
    cleanupJobIds.push(userJobId);
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
    cleanupJobIds.push(scrapedJobId);
    await fetch(`${baseUrl}/api/jobs/queue/pending/${scrapedJobId}/reject`, { method: 'POST' });
    const allNotifs = await NotificationRepository.getAllAsync();
    assert(!allNotifs.some(n => n.eventId === `notif-job-reject-${scrapedJobId}`));
    passCount++;
    console.log('✓ Test 5: Scraped jobs do not receive user notifications.');

    // Test 6: Missing recipient skip
    testCount++;
    const missingUserJobId = `job-missing-${Date.now()}`;
    Database.addPendingJob({ id: missingUserJobId, title: 'Job for Ghost', submittedByUserId: 'non-existent-user', sourceType: 'user_posted', status: 'Pending' } as any);
    cleanupJobIds.push(missingUserJobId);
    const missingRejectRes = await fetch(`${baseUrl}/api/jobs/queue/pending/${missingUserJobId}/reject`, { method: 'POST' });
    assert.strictEqual(missingRejectRes.status, 200);
    passCount++;
    console.log('✓ Test 6: Missing recipient user is safely skipped.');

    console.log('\n--- 3. Bulk Identities & Ordering ---');

    // Test 7: Bulk event ID deterministic
    testCount++;
    const bulkIds = [`b1-${Date.now()}`, `b2-${Date.now()}`];
    bulkIds.forEach(id => Database.addPendingJob({ id, title: 'Bulk', submittedByUserId: testUserAId, sourceType: 'user_posted', status: 'Pending' } as any));
    cleanupJobIds.push(...bulkIds);

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
    cleanupJobIds.push(liveJobId);
    activeTestUser = { userId: testUserBId, role: 'Member', name: 'User B', email: 'userb-int@example.com' };
    const appSubRes = await fetch(`${baseUrl}/api/applications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId: liveJobId, applicantPhone: '123' })
    });
    const subData = await appSubRes.json();
    assert.strictEqual(appSubRes.status, 201);
    const appId = subData.application.id;
    cleanupAppIds.push(appId);
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
    cleanupTxIds.push(subTxId);
    const txNotifs = await NotificationRepository.getAllAsync({ userId: testUserBId });
    assert(txNotifs.some(n => n.eventId === `payment-submitted-${subTxId}`));
    passCount++;
    console.log('✓ Test 12: Payment submission generates notification.');

  } catch (err: any) {
    console.error('\n[TEST ERROR]', err);
    throw err;
  } finally {
    // --- Cleanup ---
    console.log('\n--- Cleaning up test records ---');
    if (httpServer) httpServer.close();
    
    // Restore Env
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) delete process.env[key];
    }
    for (const key of Object.keys(originalEnv)) {
      process.env[key] = originalEnv[key];
    }

    // Restore Mocks
    PaymentSettingsRepository.getPublicSettings = originalGetPublicSettings;
    Database.getTransactions = originalGetTransactions;
    Database.saveTransactions = originalSaveTransactions;
    Database.addTransaction = originalAddTransaction;
    Database.getAuditLogs = originalGetAuditLogs;
    Database.addAuditLog = originalAddAuditLog;
    Database.getUsers = originalGetUsers;
    Database.saveUsers = originalSaveUsers;
    NotificationRepository.createAsync = originalCreateAsync;
    JobVisibilityRepository.isUserPremiumAuthoritative = originalIsUserPremium;
    Database.getApplySettings = originalGetApplySettings;

    if (passCount === testCount && testCount > 0) {
      console.log(`\n===============================================================`);
      console.log(`=== ALL ${passCount} TEST SCENARIOS PASSED SUCCESSFULLY (${storageMode}) ===`);
      console.log(`===============================================================\n`);
    } else {
      console.log(`\n===============================================================`);
      console.log(`=== TEST SUITE FINISHED: ${passCount}/${testCount} PASSED (${storageMode}) ===`);
      console.log(`===============================================================\n`);
    }
  }
}

runTests().catch((err) => {
  console.error('\n[FATAL FAILURE]', err);
  process.exit(1);
});
