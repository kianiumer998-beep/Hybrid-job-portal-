import assert from 'assert';
import express from 'express';
import { createServer, Server } from 'http';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

/**
 * Robust SHA-256 Snapshot for data directory integrity
 */
function getDataDirectorySnapshot(): Record<string, string> {
  const dataDir = path.resolve(process.cwd(), 'data');
  const snapshot: Record<string, string> = {};
  
  if (!fs.existsSync(dataDir)) return snapshot;

  const files = fs.readdirSync(dataDir);
  for (const file of files) {
    if (file.endsWith('.json')) {
      const filePath = path.join(dataDir, file);
      try {
        const content = fs.readFileSync(filePath);
        const hash = crypto.createHash('sha256').update(content).digest('hex');
        snapshot[file] = hash;
      } catch (err) {
        // If file is deleted during snapshot, it won't be in the map
      }
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

  // Take pre-test snapshot
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

  // --- 1. Capture Original State for Authoritative Restoration ---
  const databaseDescriptors = Object.getOwnPropertyDescriptors(Database);
  const paymentRepoDescriptors = Object.getOwnPropertyDescriptors(PaymentSettingsRepository);
  const visibilityRepoDescriptors = Object.getOwnPropertyDescriptors(JobVisibilityRepository);

  // --- 2. Complete Persistence & Read-Path Isolation Mocks ---
  
  // In-memory isolated state
  let inMemTransactions: any[] = [];
  let inMemAuditLogs: any[] = [];
  let inMemUsers: any[] = [];
  let inMemJobs: any[] = [];
  let inMemPendingJobs: any[] = [];
  let inMemApplications: any[] = [];
  let inMemScraperRuns: any[] = [];
  let inMemSavedJobs: Record<string, any[]> = {};
  let inMemJobAlerts: Record<string, any[]> = {};
  let inMemUserDocs: Record<string, any[]> = {};
  let inMemAds: any[] = [];
  let inMemPricing: any = { jobPosting: {} };
  let inMemApplySettings: any = {};
  let inMemSeo: any = {};
  let inMemScraperSources: any[] = [];

  const noop = () => {};

  // Mock ALL Database methods that use safeReadJson or safeWriteJson
  
  // JOBS & PENDING
  Database.getJobs = () => [...inMemJobs];
  Database.saveJobs = (jobs: any[]) => { inMemJobs = [...jobs]; };
  Database.getJobById = (id: string) => inMemJobs.find(j => j.id === id) || inMemPendingJobs.find(j => j.id === id) || null;
  Database.getJobBySlug = (slug: string) => inMemJobs.find(j => j.slug === slug || j.id === slug) || inMemPendingJobs.find(j => j.slug === slug || j.id === slug) || null;
  Database.addJob = (job: any) => {
    const fresh = { ...job, id: job.id || `job-${Date.now()}` };
    inMemJobs.unshift(fresh);
    return fresh;
  };
  Database.addJobsBatch = (newJobs: any[]) => {
    newJobs.forEach(j => inMemJobs.unshift(j));
    return { inserted: newJobs.length, updated: 0, total: inMemJobs.length };
  };
  Database.updateJob = (id: string, updates: any) => {
    const idx = inMemJobs.findIndex(j => j.id === id);
    if (idx !== -1) {
      inMemJobs[idx] = { ...inMemJobs[idx], ...updates };
      return inMemJobs[idx];
    }
    const pIdx = inMemPendingJobs.findIndex(j => j.id === id);
    if (pIdx !== -1) {
      inMemPendingJobs[pIdx] = { ...inMemPendingJobs[pIdx], ...updates };
      return inMemPendingJobs[pIdx];
    }
    return null;
  };
  Database.deleteJob = (id: string) => {
    const prev = inMemJobs.length + inMemPendingJobs.length;
    inMemJobs = inMemJobs.filter(j => j.id !== id);
    inMemPendingJobs = inMemPendingJobs.filter(j => j.id !== id);
    return (inMemJobs.length + inMemPendingJobs.length) < prev;
  };
  Database.getPendingJobs = () => [...inMemPendingJobs];
  Database.savePendingJobs = (jobs: any[]) => { inMemPendingJobs = [...jobs]; };
  Database.addPendingJob = (job: any) => {
    const fresh = { ...job, id: job.id || `pending-${Date.now()}` };
    inMemPendingJobs.unshift(fresh);
    return fresh;
  };
  Database.addPendingJobsBatch = (newPending: any[]) => {
    newPending.forEach(j => inMemPendingJobs.unshift(j));
    return { inserted: newPending.length, updated: 0, total: inMemPendingJobs.length };
  };
  Database.approvePendingJob = (id: string) => {
    const job = inMemPendingJobs.find(j => j.id === id);
    if (!job) return null;
    inMemPendingJobs = inMemPendingJobs.filter(j => j.id !== id);
    return Database.addJob({ ...job, status: 'Approved' });
  };
  Database.rejectPendingJob = (id: string, reason?: string) => {
    const job = inMemPendingJobs.find(j => j.id === id);
    if (!job) return false;
    job.status = 'Rejected';
    job.rejectionReason = reason;
    return true;
  };

  // USERS
  Database.getUsers = () => [...inMemUsers];
  Database.saveUsers = (users: any[]) => { inMemUsers = [...users]; };
  Database.getUserById = (id: string) => inMemUsers.find(u => u.id === id) || null;
  Database.getUserByEmail = (email: string) => inMemUsers.find(u => u.email?.toLowerCase() === email.toLowerCase()) || null;
  Database.addUser = (user: any) => {
    const fresh = { ...user, id: user.id || `user-${Date.now()}` };
    inMemUsers.unshift(fresh);
    return fresh;
  };
  Database.updateUser = (id: string, updates: any) => {
    const idx = inMemUsers.findIndex(u => u.id === id);
    if (idx === -1) return null;
    inMemUsers[idx] = { ...inMemUsers[idx], ...updates };
    return inMemUsers[idx];
  };
  Database.deleteUser = (id: string) => {
    const prev = inMemUsers.length;
    inMemUsers = inMemUsers.filter(u => u.id !== id);
    return inMemUsers.length < prev;
  };

  // APPLICATIONS
  Database.getApplications = () => [...inMemApplications];
  Database.saveApplications = (apps: any[]) => { inMemApplications = [...apps]; };
  Database.addApplication = (app: any) => {
    const fresh = { ...app, id: app.id || `app-${Date.now()}`, appliedAt: new Date().toISOString() };
    inMemApplications.unshift(fresh);
    return fresh;
  };

  // TRANSACTIONS
  Database.getTransactions = () => [...inMemTransactions];
  Database.saveTransactions = (txs: any[]) => { inMemTransactions = [...txs]; };
  Database.addTransaction = (tx: any) => {
    const fresh = { ...tx, id: tx.id || `tx-${Date.now()}`, dateTime: new Date().toISOString() };
    inMemTransactions.unshift(fresh);
    return fresh;
  };

  // AUDIT LOGS
  Database.getAuditLogs = () => [...inMemAuditLogs];
  Database.addAuditLog = (entry: any) => {
    const fresh = { ...entry, id: `log-${Date.now()}`, timestamp: new Date().toISOString() };
    inMemAuditLogs.unshift(fresh);
  };

  // SCRAPER
  Database.getScraperSources = () => [...inMemScraperSources];
  Database.saveScraperSources = (s: any[]) => { inMemScraperSources = [...s]; };
  Database.getScraperRuns = () => [...inMemScraperRuns];
  Database.addScraperRun = (run: any) => {
    const fresh = { ...run, id: run.id || `run-${Date.now()}` };
    inMemScraperRuns.unshift(fresh);
    return fresh;
  };

  // SETTINGS & ADS
  Database.getAds = () => [...inMemAds];
  Database.saveAds = (ads: any[]) => { inMemAds = [...ads]; };
  Database.getPricing = () => ({ ...inMemPricing });
  Database.savePricing = (p: any) => { inMemPricing = { ...p }; };
  Database.getApplySettings = () => ({ ...inMemApplySettings });
  Database.saveApplySettings = (s: any) => { inMemApplySettings = { ...s }; };
  Database.getSeoConfig = () => ({ ...inMemSeo });
  Database.saveSeoConfig = (c: any) => { inMemSeo = { ...c }; };

  // USER DATA
  Database.getSavedJobs = (uid: string) => inMemSavedJobs[uid] || [];
  Database.toggleSavedJob = (uid: string, job: any) => {
    if (!inMemSavedJobs[uid]) inMemSavedJobs[uid] = [];
    const idx = inMemSavedJobs[uid].findIndex(j => j.id === job.id);
    if (idx >= 0) inMemSavedJobs[uid].splice(idx, 1);
    else inMemSavedJobs[uid].unshift(job);
    return { saved: idx < 0, count: inMemSavedJobs[uid].length };
  };
  Database.getJobAlerts = (uid: string) => inMemJobAlerts[uid] || [];
  Database.addJobAlert = (uidOrAlert: any, data?: any) => {
    const uid = data ? uidOrAlert : (uidOrAlert.userId || 'guest');
    const alert = data || uidOrAlert;
    if (!inMemJobAlerts[uid]) inMemJobAlerts[uid] = [];
    const fresh = { ...alert, id: alert.id || `alert-${Date.now()}` };
    inMemJobAlerts[uid].unshift(fresh);
    return fresh;
  };
  Database.deleteJobAlert = (id: string, uid?: string) => {
    if (uid && inMemJobAlerts[uid]) {
      inMemJobAlerts[uid] = inMemJobAlerts[uid].filter(a => a.id !== id);
      return true;
    }
    return false;
  };
  Database.getUserDocuments = (uid: string) => inMemUserDocs[uid] || [];
  Database.addUserDocument = (uidOrDoc: any, data?: any) => {
    const uid = data ? uidOrDoc : (uidOrDoc.userId || 'guest');
    const doc = data || uidOrDoc;
    if (!inMemUserDocs[uid]) inMemUserDocs[uid] = [];
    const fresh = { ...doc, id: doc.id || `doc-${Date.now()}` };
    inMemUserDocs[uid].unshift(fresh);
    return fresh;
  };
  Database.deleteUserDocument = (id: string, uid?: string) => {
    if (uid && inMemUserDocs[uid]) {
      inMemUserDocs[uid] = inMemUserDocs[uid].filter(d => d.id !== id);
      return true;
    }
    return false;
  };

  const originalGetPublicSettings = PaymentSettingsRepository.getPublicSettings;
  const originalIsUserPremium = JobVisibilityRepository.isUserPremiumAuthoritative;

  let httpServer: Server | null = null;
  let testCount = 0;
  let passCount = 0;
  let suiteError: any = null;

  try {
    // --- 3. Initialize Memory-Only Test Mode Mocks ---
    JobVisibilityRepository.isUserPremiumAuthoritative = async () => true;
    console.log('➜ STORAGE MODE: IN-MEMORY FALLBACK UNIT-TEST MODE (Strict Isolation)');
    console.log('[NOT RUN] Live MongoDB Integration tests: Real MongoDB not supported in this test suite.');

    inMemApplySettings = {
      requireCv: false,
      requirePhone: false,
      requireEmail: false,
      enforceDeadlines: false
    };

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

  } catch (err: any) {
    console.error('\n[TEST SCENARIO FAILURE]', err);
    suiteError = err;
  } finally {
    // --- 6. Robust Cleanup & Mandatory Integrity Verification ---
    console.log('\n--- Finalizing Suite & Verifying Storage Integrity ---');
    
    // Await server closure (cleanup path ensures we continue if this fails)
    if (httpServer) {
      try {
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('HTTP server close timeout')), 5000);
          httpServer!.close((err) => {
            clearTimeout(timeout);
            err ? reject(err) : resolve();
          });
        });
        console.log('✓ HTTP Server closed successfully.');
      } catch (srvErr) {
        console.error('! Error during HTTP server closure:', srvErr);
      }
    }
    
    // Restoration of Property Descriptors (Bulletproof Restoration)
    const restore = (target: any, descriptors: PropertyDescriptorMap) => {
      const currentKeys = Object.getOwnPropertyNames(target);
      currentKeys.forEach(key => {
        if (!(key in descriptors)) {
          // Remove mock properties that didn't exist originally
          delete target[key];
        }
      });
      Object.defineProperties(target, descriptors);
    };

    restore(Database, databaseDescriptors);
    restore(PaymentSettingsRepository, paymentRepoDescriptors);
    restore(JobVisibilityRepository, visibilityRepoDescriptors);
    
    // Internal verification of restoration
    const isRestored = Database.saveJobs === databaseDescriptors.saveJobs.value;
    console.log(`✓ Original Database & Repository methods restored: ${isRestored}`);

    // Clear Notification memory store
    NotificationRepository.clearInMemoryStore();

    // Take post-test snapshot
    let integrityFailed = false;
    let integrityMessage = '';

    try {
      const postTestSnapshot = getDataDirectorySnapshot();
      
      // 1. Check for file deletions or modifications
      for (const [file, preHash] of Object.entries(preTestSnapshot)) {
        const postHash = postTestSnapshot[file];
        if (!postHash) {
          integrityFailed = true;
          integrityMessage += `\n- FAILURE: JSON file DELETED during test: ${file}`;
        } else if (postHash !== preHash) {
          integrityFailed = true;
          integrityMessage += `\n- FAILURE: JSON file MODIFIED during test: ${file}`;
        }
      }
      // 2. Check for new files
      for (const file of Object.keys(postTestSnapshot)) {
        if (!(file in preTestSnapshot)) {
          integrityFailed = true;
          integrityMessage += `\n- FAILURE: Unauthorized new JSON file created: ${file}`;
        }
      }

      if (integrityFailed) {
        console.error('\n[STORAGE INTEGRITY FAILURE]' + integrityMessage);
      } else {
        console.log('✓ Storage isolation verified (Byte-for-byte snapshot check passed).');
      }
    } catch (verifErr: any) {
      console.error('\n[INTEGRITY VERIFICATION CRITICAL ERROR]', verifErr);
      integrityFailed = true;
    }

    // Restore Env
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) delete process.env[key];
    }
    for (const key of Object.keys(originalEnv)) {
      process.env[key] = originalEnv[key];
    }

    // Final outcome evaluation
    const finalPassed = (passCount === testCount && !integrityFailed && !suiteError);
    
    console.log(`\n===============================================================`);
    console.log(`=== TEST SUITE FINISHED: ${finalPassed ? 'SUCCESS' : 'FAILURE'} ===`);
    console.log(`=== Functional Scenarios: ${passCount}/${testCount} Passed ===`);
    console.log(`=== Storage Integrity: ${integrityFailed ? 'FAILED' : 'PASSED'} ===`);
    console.log(`===============================================================\n`);

    if (!finalPassed) {
      process.exit(1);
    }
  }
}

runTests().catch((err) => {
  console.error('\n[FATAL EXIT ERROR]', err);
  process.exit(1);
});
