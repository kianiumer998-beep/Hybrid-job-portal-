import assert from 'assert';
import express from 'express';
import { createServer, Server } from 'http';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

/**
 * Data Snapshot interface representing directory state and read integrity.
 */
export interface DataSnapshot {
  valid: boolean;
  error?: string;
  files: Record<string, string>; // filename -> sha256 hex
  errors: Record<string, string>; // filename -> error message
}

/**
 * Creates a complete SHA-256 snapshot of all JSON files in the data directory.
 * Does not silently swallow read errors: any read failure marks the snapshot invalid.
 */
export function getDataDirectorySnapshot(
  targetDir?: string,
  customReadFile?: (filePath: string) => Buffer
): DataSnapshot {
  const dataDir = targetDir || path.resolve(process.cwd(), 'data');
  const snapshot: DataSnapshot = {
    valid: true,
    files: {},
    errors: {}
  };

  if (!fs.existsSync(dataDir)) {
    snapshot.valid = false;
    snapshot.error = `Data directory does not exist: ${dataDir}`;
    return snapshot;
  }

  let fileNames: string[];
  try {
    fileNames = fs.readdirSync(dataDir);
  } catch (err: any) {
    snapshot.valid = false;
    snapshot.error = `Failed to read data directory: ${err?.message || err}`;
    return snapshot;
  }

  const readFileFn = customReadFile || ((p: string) => fs.readFileSync(p));

  for (const file of fileNames) {
    if (file.endsWith('.json')) {
      const filePath = path.join(dataDir, file);
      try {
        const content = readFileFn(filePath);
        const hash = crypto.createHash('sha256').update(content).digest('hex');
        snapshot.files[file] = hash;
      } catch (err: any) {
        snapshot.valid = false;
        snapshot.errors[file] = err?.message || String(err);
      }
    }
  }

  if (Object.keys(snapshot.errors).length > 0) {
    snapshot.valid = false;
    snapshot.error = `Snapshot encountered read errors in: ${Object.keys(snapshot.errors).join(', ')}`;
  }

  return snapshot;
}

/**
 * Compares pre-test and post-test snapshots.
 * Detects modifications, deletions, additions, and unreadable files.
 */
export interface IntegrityResult {
  passed: boolean;
  failures: string[];
}

export function evaluateStorageIntegrity(
  preSnapshot: DataSnapshot,
  postSnapshot: DataSnapshot
): IntegrityResult {
  const failures: string[] = [];

  // 1. Verify pre-test snapshot validity
  if (!preSnapshot.valid) {
    failures.push(`Pre-test snapshot is INVALID: ${preSnapshot.error || 'Unknown error'}`);
    for (const [file, err] of Object.entries(preSnapshot.errors || {})) {
      failures.push(`Pre-test read failure for ${file}: ${err}`);
    }
  }

  // 2. Verify post-test snapshot validity
  if (!postSnapshot.valid) {
    failures.push(`Post-test snapshot is INVALID: ${postSnapshot.error || 'Unknown error'}`);
    for (const [file, err] of Object.entries(postSnapshot.errors || {})) {
      failures.push(`Post-test read failure for ${file}: ${err}`);
    }
  }

  // 3. Compare files if pre-test was valid
  if (preSnapshot.valid) {
    // Check for deletions, modifications, or unreadable files in post-test
    for (const [file, preHash] of Object.entries(preSnapshot.files)) {
      if (postSnapshot.errors && file in postSnapshot.errors) {
        failures.push(`File ${file} could not be read during post-test snapshot (${postSnapshot.errors[file]}); cannot verify integrity`);
      } else if (!(file in postSnapshot.files)) {
        failures.push(`JSON file DELETED during test: ${file}`);
      } else if (postSnapshot.files[file] !== preHash) {
        failures.push(`JSON file MODIFIED during test: ${file} (expected SHA-256: ${preHash}, got: ${postSnapshot.files[file]})`);
      }
    }

    // Check for newly created files
    for (const file of Object.keys(postSnapshot.files)) {
      if (!(file in preSnapshot.files)) {
        failures.push(`Unauthorized new JSON file created: ${file}`);
      }
    }
  }

  return {
    passed: failures.length === 0,
    failures
  };
}

/**
 * Restores original own property descriptors and checks for exact restoration.
 * Removes any temporary mock properties that were not present on target originally.
 */
export interface RestorationResult {
  restored: boolean;
  mismatches: string[];
}

export function restoreAndVerifyDescriptors(
  target: any,
  originalDescriptors: PropertyDescriptorMap,
  targetName: string
): RestorationResult {
  const mismatches: string[] = [];

  // 1. Remove mock properties that were not present originally
  const currentKeysBefore = Object.getOwnPropertyNames(target);
  for (const key of currentKeysBefore) {
    if (!Object.prototype.hasOwnProperty.call(originalDescriptors, key)) {
      try {
        delete target[key];
      } catch (delErr: any) {
        mismatches.push(`Failed to delete temporary mock property ${targetName}.${key}: ${delErr?.message || delErr}`);
      }
      if (Object.prototype.hasOwnProperty.call(target, key)) {
        mismatches.push(`Temporary mock property ${targetName}.${key} was not removed after restoration`);
      }
    }
  }

  // 2. Re-apply all original property descriptors
  try {
    Object.defineProperties(target, originalDescriptors);
  } catch (defErr: any) {
    mismatches.push(`Object.defineProperties failed on ${targetName}: ${defErr?.message || defErr}`);
  }

  // 3. Verify every property descriptor against original
  const currentDescriptorsAfter = Object.getOwnPropertyDescriptors(target);
  for (const key of Object.getOwnPropertyNames(originalDescriptors)) {
    const orig = originalDescriptors[key];
    const curr = currentDescriptorsAfter[key];
    if (!curr) {
      mismatches.push(`${targetName}.${key} is missing after restoration`);
      continue;
    }
    if (orig.value !== curr.value) {
      mismatches.push(`${targetName}.${key} value mismatch`);
    }
    if (orig.get !== curr.get || orig.set !== curr.set) {
      mismatches.push(`${targetName}.${key} getter/setter mismatch`);
    }
    if (
      orig.writable !== curr.writable ||
      orig.enumerable !== curr.enumerable ||
      orig.configurable !== curr.configurable
    ) {
      mismatches.push(`${targetName}.${key} descriptor attributes mismatch`);
    }
  }

  // 4. Verify no extra properties exist
  for (const key of Object.getOwnPropertyNames(target)) {
    if (!Object.prototype.hasOwnProperty.call(originalDescriptors, key)) {
      mismatches.push(`Extra property ${targetName}.${key} remains on target after restoration`);
    }
  }

  return {
    restored: mismatches.length === 0,
    mismatches
  };
}

/**
 * Determines final test suite outcome.
 * Strict: any functional failure, integrity failure, or restoration failure forces exit code 1.
 */
export interface SuiteDecisionInput {
  passCount: number;
  testCount: number;
  integrityFailed: boolean;
  restorationFailed: boolean;
  suiteError: any;
}

export function evaluateSuiteDecision(input: SuiteDecisionInput): {
  isSuccess: boolean;
  exitCode: number;
  summary: string;
} {
  const hasFunctionalFailure =
    input.suiteError !== null || input.passCount !== input.testCount || input.testCount === 0;
  const isSuccess = !hasFunctionalFailure && !input.integrityFailed && !input.restorationFailed;
  const exitCode = isSuccess ? 0 : 1;
  const summary = isSuccess ? 'SUCCESS' : 'FAILURE';
  return { isSuccess, exitCode, summary };
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
  if (!preTestSnapshot.valid) {
    console.error(`[FATAL] Pre-test data directory snapshot is invalid: ${preTestSnapshot.error}`);
    process.exit(1);
  }

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

  // --- 1. Capture Original Property Descriptors for Authoritative Restoration ---
  const databaseDescriptors = Object.getOwnPropertyDescriptors(Database);
  const paymentRepoDescriptors = Object.getOwnPropertyDescriptors(PaymentSettingsRepository);
  const visibilityRepoDescriptors = Object.getOwnPropertyDescriptors(JobVisibilityRepository);
  const notificationRepoDescriptors = Object.getOwnPropertyDescriptors(NotificationRepository);

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
  Database.getJobById = (id: string) =>
    inMemJobs.find((j) => j.id === id) || inMemPendingJobs.find((j) => j.id === id) || null;
  Database.getJobBySlug = (slug: string) =>
    inMemJobs.find((j) => j.slug === slug || j.id === slug) ||
    inMemPendingJobs.find((j) => j.slug === slug || j.id === slug) ||
    null;
  Database.addJob = (job: any) => {
    const fresh = { ...job, id: job.id || `job-${Date.now()}` };
    inMemJobs.unshift(fresh);
    return fresh;
  };
  Database.addJobsBatch = (newJobs: any[]) => {
    newJobs.forEach((j) => inMemJobs.unshift(j));
    return { inserted: newJobs.length, updated: 0, total: inMemJobs.length };
  };
  Database.updateJob = (id: string, updates: any) => {
    const idx = inMemJobs.findIndex((j) => j.id === id);
    if (idx !== -1) {
      inMemJobs[idx] = { ...inMemJobs[idx], ...updates };
      return inMemJobs[idx];
    }
    const pIdx = inMemPendingJobs.findIndex((j) => j.id === id);
    if (pIdx !== -1) {
      inMemPendingJobs[pIdx] = { ...inMemPendingJobs[pIdx], ...updates };
      return inMemPendingJobs[pIdx];
    }
    return null;
  };
  Database.deleteJob = (id: string) => {
    const prev = inMemJobs.length + inMemPendingJobs.length;
    inMemJobs = inMemJobs.filter((j) => j.id !== id);
    inMemPendingJobs = inMemPendingJobs.filter((j) => j.id !== id);
    return inMemJobs.length + inMemPendingJobs.length < prev;
  };
  Database.getPendingJobs = () => [...inMemPendingJobs];
  Database.savePendingJobs = (jobs: any[]) => { inMemPendingJobs = [...jobs]; };
  Database.addPendingJob = (job: any) => {
    const fresh = { ...job, id: job.id || `pending-${Date.now()}` };
    inMemPendingJobs.unshift(fresh);
    return fresh;
  };
  Database.addPendingJobsBatch = (newPending: any[]) => {
    newPending.forEach((j) => inMemPendingJobs.unshift(j));
    return { inserted: newPending.length, updated: 0, total: inMemPendingJobs.length };
  };
  Database.approvePendingJob = (id: string) => {
    const job = inMemPendingJobs.find((j) => j.id === id);
    if (!job) return null;
    inMemPendingJobs = inMemPendingJobs.filter((j) => j.id !== id);
    return Database.addJob({ ...job, status: 'Approved' });
  };
  Database.rejectPendingJob = (id: string, reason?: string) => {
    const job = inMemPendingJobs.find((j) => j.id === id);
    if (!job) return false;
    job.status = 'Rejected';
    job.rejectionReason = reason;
    return true;
  };

  // USERS
  Database.getUsers = () => [...inMemUsers];
  Database.saveUsers = (users: any[]) => { inMemUsers = [...users]; };
  Database.getUserById = (id: string) => inMemUsers.find((u) => u.id === id) || null;
  Database.getUserByEmail = (email: string) =>
    inMemUsers.find((u) => u.email?.toLowerCase() === email.toLowerCase()) || null;
  Database.addUser = (user: any) => {
    const fresh = { ...user, id: user.id || `user-${Date.now()}` };
    inMemUsers.unshift(fresh);
    return fresh;
  };
  Database.updateUser = (id: string, updates: any) => {
    const idx = inMemUsers.findIndex((u) => u.id === id);
    if (idx === -1) return null;
    inMemUsers[idx] = { ...inMemUsers[idx], ...updates };
    return inMemUsers[idx];
  };
  Database.deleteUser = (id: string) => {
    const prev = inMemUsers.length;
    inMemUsers = inMemUsers.filter((u) => u.id !== id);
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
    const idx = inMemSavedJobs[uid].findIndex((j) => j.id === job.id);
    if (idx >= 0) inMemSavedJobs[uid].splice(idx, 1);
    else inMemSavedJobs[uid].unshift(job);
    return { saved: idx < 0, count: inMemSavedJobs[uid].length };
  };
  Database.getJobAlerts = (uid: string) => inMemJobAlerts[uid] || [];
  Database.addJobAlert = (uidOrAlert: any, data?: any) => {
    const uid = data ? uidOrAlert : uidOrAlert.userId || 'guest';
    const alert = data || uidOrAlert;
    if (!inMemJobAlerts[uid]) inMemJobAlerts[uid] = [];
    const fresh = { ...alert, id: alert.id || `alert-${Date.now()}` };
    inMemJobAlerts[uid].unshift(fresh);
    return fresh;
  };
  Database.deleteJobAlert = (id: string, uid?: string) => {
    if (uid && inMemJobAlerts[uid]) {
      inMemJobAlerts[uid] = inMemJobAlerts[uid].filter((a) => a.id !== id);
      return true;
    }
    return false;
  };
  Database.getUserDocuments = (uid: string) => inMemUserDocs[uid] || [];
  Database.addUserDocument = (uidOrDoc: any, data?: any) => {
    const uid = data ? uidOrDoc : uidOrDoc.userId || 'guest';
    const doc = data || uidOrDoc;
    if (!inMemUserDocs[uid]) inMemUserDocs[uid] = [];
    const fresh = { ...doc, id: doc.id || `doc-${Date.now()}` };
    inMemUserDocs[uid].unshift(fresh);
    return fresh;
  };
  Database.deleteUserDocument = (id: string, uid?: string) => {
    if (uid && inMemUserDocs[uid]) {
      inMemUserDocs[uid] = inMemUserDocs[uid].filter((d) => d.id !== id);
      return true;
    }
    return false;
  };

  let httpServer: Server | null = null;
  let testCount = 0;
  let passCount = 0;
  let suiteError: any = null;

  try {
    // --- 3. Initialize Memory-Only Test Mode ---
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
    app.use((req, res, next) => {
      if (activeTestUser) {
        (req as any).user = activeTestUser;
      }
      next();
    });
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

    await UserRepository.createAsync({
      id: adminUserId,
      name: 'Administrator',
      email: 'admin-int@example.com',
      role: 'Super Admin'
    });
    await UserRepository.createAsync({
      id: testUserAId,
      name: 'User A',
      email: 'usera-int@example.com',
      role: 'Employer'
    });
    await UserRepository.createAsync({
      id: testUserBId,
      name: 'User B',
      email: 'userb-int@example.com',
      role: 'Member'
    });

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
    Database.addPendingJob({
      id: userJobId,
      title: 'Software Job',
      submittedByUserId: testUserAId,
      sourceType: 'user_posted',
      status: 'Pending'
    } as any);
    activeTestUser = { userId: adminUserId, role: 'Super Admin' };
    const rejectRes = await fetch(`${baseUrl}/api/jobs/queue/pending/${userJobId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Incomplete' })
    });
    assert.strictEqual(rejectRes.status, 200);
    const userANotifs = await NotificationRepository.getAllAsync({ userId: testUserAId });
    assert(userANotifs.some((n) => n.eventId === `notif-job-reject-${userJobId}`));
    passCount++;
    console.log('✓ Test 4: Single rejection notifies verified owner.');

    // Test 5: Scraped/Admin jobs do not notify
    testCount++;
    const scrapedJobId = `scraped-${Date.now()}`;
    Database.addPendingJob({
      id: scrapedJobId,
      title: 'Scraped Job',
      isScraped: true,
      sourceType: 'scraped',
      status: 'Pending'
    } as any);
    await fetch(`${baseUrl}/api/jobs/queue/pending/${scrapedJobId}/reject`, { method: 'POST' });
    const allNotifs = await NotificationRepository.getAllAsync();
    assert(!allNotifs.some((n) => n.eventId === `notif-job-reject-${scrapedJobId}`));
    passCount++;
    console.log('✓ Test 5: Scraped jobs do not receive user notifications.');

    // Test 6: Missing recipient skip
    testCount++;
    const missingUserJobId = `job-missing-${Date.now()}`;
    Database.addPendingJob({
      id: missingUserJobId,
      title: 'Job for Ghost',
      submittedByUserId: 'non-existent-user',
      sourceType: 'user_posted',
      status: 'Pending'
    } as any);
    const missingRejectRes = await fetch(
      `${baseUrl}/api/jobs/queue/pending/${missingUserJobId}/reject`,
      { method: 'POST' }
    );
    assert.strictEqual(missingRejectRes.status, 200);
    passCount++;
    console.log('✓ Test 6: Missing recipient user is safely skipped.');

    console.log('\n--- 3. Bulk Identities & Ordering ---');

    // Test 7: Bulk event ID deterministic
    testCount++;
    const bulkIds = [`b1-${Date.now()}`, `b2-${Date.now()}`];
    bulkIds.forEach((id) =>
      Database.addPendingJob({
        id,
        title: 'Bulk',
        submittedByUserId: testUserAId,
        sourceType: 'user_posted',
        status: 'Pending'
      } as any)
    );

    const hashInput1 = JSON.stringify(['bulk-reject', testUserAId, [...bulkIds].sort(), 'Bulk Reject']);
    const expectedEventId = `notif-job-bulk-reject-${crypto.createHash('sha256').update(hashInput1).digest('hex')}`;

    await fetch(`${baseUrl}/api/jobs/bulk-reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [...bulkIds].reverse(), reason: 'Bulk Reject' })
    });
    const bulkNotifs = await NotificationRepository.getAllAsync({ userId: testUserAId });
    assert(bulkNotifs.some((n) => n.eventId === expectedEventId));
    passCount++;
    console.log('✓ Test 7: Bulk event IDs remain deterministic regardless of ordering.');

    console.log('\n--- 4. Application Notifications & Security ---');

    // Test 8: Application submission notifies verified job owner
    testCount++;
    const liveJobId = `live-job-${Date.now()}`;
    Database.addJob({
      id: liveJobId,
      title: 'Live Job',
      submittedByUserId: testUserAId,
      sourceType: 'user_posted',
      status: 'Approved'
    } as any);
    activeTestUser = {
      userId: testUserBId,
      role: 'Member',
      name: 'User B',
      email: 'userb-int@example.com'
    };
    const appSubRes = await fetch(`${baseUrl}/api/applications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId: liveJobId, applicantPhone: '123' })
    });
    const subData = await appSubRes.json();
    assert.strictEqual(appSubRes.status, 201);
    const appId = subData.application.id;
    const ownerNotifsSub = await NotificationRepository.getAllAsync({ userId: testUserAId });
    assert(ownerNotifsSub.some((n) => n.eventId === `notif-app-submit-${appId}`));
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
    assert(applicantNotifs.some((n) => n.eventId.includes(`-Applied-Shortlisted-`)));
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
      body: JSON.stringify({
        amount: 1000,
        type: 'Wallet Deposit',
        paymentMethod: 'easypaisa',
        transactionId: txId,
        senderName: 'B',
        senderPhoneOrAccount: '123'
      })
    });
    const txData = await txRes.json();
    assert.strictEqual(txRes.status, 201);
    const subTxId = txData.transaction.id;
    const txNotifs = await NotificationRepository.getAllAsync({ userId: testUserBId });
    assert(txNotifs.some((n) => n.eventId === `payment-submitted-${subTxId}`));
    passCount++;
    console.log('✓ Test 12: Payment submission generates notification.');

    console.log('\n--- 6. Failure-Path Controlled Regressions ---');

    // Test 13: Controlled snapshot read failure regression (pure in-memory simulation)
    testCount++;
    const mockReadSnapshot = getDataDirectorySnapshot(
      undefined,
      (filePath: string) => {
        if (filePath.endsWith('audit_logs.json')) {
          throw new Error('EACCES: permission denied, simulated read error');
        }
        return fs.readFileSync(filePath);
      }
    );
    assert.strictEqual(mockReadSnapshot.valid, false, 'Snapshot with read error must be marked invalid');
    assert(mockReadSnapshot.errors['audit_logs.json'], 'Read error for audit_logs.json must be recorded');
    const mockIntegrityResult = evaluateStorageIntegrity(mockReadSnapshot, preTestSnapshot);
    assert.strictEqual(mockIntegrityResult.passed, false, 'Integrity check must fail when snapshot has read errors');
    assert(
      mockIntegrityResult.failures.some((f) => f.includes('audit_logs.json')),
      'Failure list must report unreadable audit_logs.json'
    );
    passCount++;
    console.log('✓ Test 13: Controlled snapshot read failure correctly marks snapshot invalid and fails integrity.');

    // Test 14: Controlled integrity-failure non-zero exit regression (pure in-memory simulation)
    testCount++;
    const syntheticPre: DataSnapshot = {
      valid: true,
      files: { 'jobs.json': 'hash_aaa', 'users.json': 'hash_bbb' },
      errors: {}
    };
    const syntheticPostModified: DataSnapshot = {
      valid: true,
      files: { 'jobs.json': 'hash_corrupted', 'users.json': 'hash_bbb' },
      errors: {}
    };
    const syntheticPostDeleted: DataSnapshot = {
      valid: true,
      files: { 'users.json': 'hash_bbb' },
      errors: {}
    };
    const syntheticPostAdded: DataSnapshot = {
      valid: true,
      files: { 'jobs.json': 'hash_aaa', 'users.json': 'hash_bbb', 'new.json': 'hash_ccc' },
      errors: {}
    };

    const resModified = evaluateStorageIntegrity(syntheticPre, syntheticPostModified);
    assert.strictEqual(resModified.passed, false, 'Modified file must fail integrity');

    const resDeleted = evaluateStorageIntegrity(syntheticPre, syntheticPostDeleted);
    assert.strictEqual(resDeleted.passed, false, 'Deleted file must fail integrity');

    const resAdded = evaluateStorageIntegrity(syntheticPre, syntheticPostAdded);
    assert.strictEqual(resAdded.passed, false, 'Added file must fail integrity');

    // Prove that evaluateSuiteDecision returns isSuccess: false, exitCode: 1 when integrityFailed: true
    const decisionIntegrityFail = evaluateSuiteDecision({
      passCount: 14,
      testCount: 14,
      integrityFailed: true,
      restorationFailed: false,
      suiteError: null
    });
    assert.strictEqual(decisionIntegrityFail.isSuccess, false, 'Integrity failure must not produce SUCCESS');
    assert.strictEqual(decisionIntegrityFail.exitCode, 1, 'Integrity failure must produce non-zero exit code (1)');
    assert.strictEqual(decisionIntegrityFail.summary, 'FAILURE');
    passCount++;
    console.log('✓ Test 14: Controlled integrity failure verified to produce FAILURE and exit code 1.');

    // Test 15: Controlled restoration-mismatch non-zero exit regression (pure in-memory simulation)
    testCount++;
    const dummyTarget: any = {
      realMethod: () => 'original',
      realValue: 123
    };
    const dummyDesc = Object.getOwnPropertyDescriptors(dummyTarget);

    // 15A: Test successful restoration on clean dummy
    dummyTarget.realMethod = () => 'tampered';
    dummyTarget.mockProperty = 'temp_value';

    const cleanRestore = restoreAndVerifyDescriptors(dummyTarget, dummyDesc, 'DummyTarget');
    assert.strictEqual(cleanRestore.restored, true, 'Clean restore must succeed');
    assert.strictEqual(dummyTarget.realMethod(), 'original', 'Method must be restored');
    assert.strictEqual(dummyTarget.mockProperty, undefined, 'Mock property must be removed');

    // 15B: Actual restoration mismatch test (property cannot be removed / non-configurable mock)
    const failingTarget: any = {
      realMethod: () => 'original'
    };
    const failingDesc = Object.getOwnPropertyDescriptors(failingTarget);

    // Define a non-configurable mock property that cannot be deleted
    Object.defineProperty(failingTarget, 'unremovableMock', {
      value: 'permanent_mock',
      configurable: false,
      writable: true,
      enumerable: true
    });

    const failedRestore = restoreAndVerifyDescriptors(failingTarget, failingDesc, 'FailingTarget');
    assert.strictEqual(failedRestore.restored, false, 'restoreAndVerifyDescriptors must return restored=false on actual failure');
    assert(
      failedRestore.mismatches.length > 0,
      'mismatches must contain actual restoration failures'
    );
    assert(
      failedRestore.mismatches.some((m) => m.includes('unremovableMock')),
      'mismatches must mention unremovableMock property'
    );

    // Feed the ACTUAL result into evaluateSuiteDecision
    const decisionActualRestoreFail = evaluateSuiteDecision({
      passCount: 15,
      testCount: 15,
      integrityFailed: false,
      restorationFailed: !failedRestore.restored,
      suiteError: null
    });
    assert.strictEqual(decisionActualRestoreFail.isSuccess, false, 'Actual restoration failure must not produce SUCCESS');
    assert.strictEqual(decisionActualRestoreFail.exitCode, 1, 'Actual restoration failure must produce non-zero exit code (1)');
    assert.strictEqual(decisionActualRestoreFail.summary, 'FAILURE');
    passCount++;
    console.log('✓ Test 15: Actual restoration mismatch correctly returns restored=false, captures failures, and produces FAILURE with exit code 1.');

    console.log('\n--- 7. STEP-D.2.1 Production Fail-Closed, MongoDB Branch, Bounded Reads, User Isolation, Read-State & API Error Security ---');

    // Controlled Fake MongoDB Collection implementing indexes, find/sort/limit/toArray, findOne, countDocuments, insertOne, updateOne, updateMany, deleteOne
    class FakeMongoNotificationCollection {
      docs: any[] = [];
      indexes: Array<{ key: Record<string, any>; options: Record<string, any> }> = [];
      createIndexCalls = 0;
      failCreateIndexTimes = 0;
      forcedOperationError: Error | null = null;
      onBeforeInsert?: (doc: any, coll: FakeMongoNotificationCollection) => Promise<void> | void;

      private matchesFilter(doc: any, filter: Record<string, any>): boolean {
        if (!filter || Object.keys(filter).length === 0) return true;
        for (const [k, v] of Object.entries(filter)) {
          if (k === '$or' && Array.isArray(v)) {
            if (!v.some((sub) => this.matchesFilter(doc, sub))) return false;
            continue;
          }
          if (k === '$and' && Array.isArray(v)) {
            if (!v.every((sub) => this.matchesFilter(doc, sub))) return false;
            continue;
          }
          if (v && typeof v === 'object' && !Array.isArray(v) && '$ne' in v) {
            if (doc[k] === v.$ne) return false;
            continue;
          }
          if (doc[k] !== v) return false;
        }
        return true;
      }

      async createIndex(key: Record<string, any>, options: Record<string, any> = {}): Promise<string> {
        this.createIndexCalls++;
        if (this.failCreateIndexTimes > 0) {
          this.failCreateIndexTimes--;
          throw new Error('Simulated temporary index initialization failure on mongo-rs0.internal:27017');
        }
        if (options.unique) {
          const field = Object.keys(key)[0];
          const seen = new Set<any>();
          for (const d of this.docs) {
            const val = d[field];
            if (options.sparse && (val === undefined || val === null)) continue;
            if (seen.has(val)) {
              const dupErr: any = new Error(`E11000 duplicate key error collection: portal.notifications index: ${field}_1 dup key: { ${field}: "${val}" }`);
              dupErr.code = 11000;
              throw dupErr;
            }
            seen.add(val);
          }
        }
        const sig = JSON.stringify({ key, options });
        if (!this.indexes.some((idx) => JSON.stringify(idx) === sig)) {
          this.indexes.push({ key, options });
        }
        return Object.keys(key).join('_');
      }

      find(query: Record<string, any> = {}) {
        const self = this;
        let sortSpec: Record<string, 1 | -1> | null = null;
        let limitNum: number | null = null;
        const cursor = {
          sort(spec: Record<string, 1 | -1>) {
            sortSpec = spec;
            return cursor;
          },
          limit(n: number) {
            limitNum = n;
            return cursor;
          },
          async toArray(): Promise<any[]> {
            if (self.forcedOperationError) throw self.forcedOperationError;
            let matched = self.docs.filter((d) => self.matchesFilter(d, query)).map((d) => ({ ...d }));
            if (sortSpec) {
              const entries = Object.entries(sortSpec);
              matched.sort((a, b) => {
                for (const [field, dir] of entries) {
                  const va = a[field] ?? '';
                  const vb = b[field] ?? '';
                  if (va !== vb) {
                    if (va < vb) return dir === 1 ? -1 : 1;
                    return dir === 1 ? 1 : -1;
                  }
                }
                return 0;
              });
            }
            if (typeof limitNum === 'number' && limitNum > 0) {
              matched = matched.slice(0, limitNum);
            }
            return matched;
          }
        };
        return cursor;
      }

      async findOne(query: Record<string, any>): Promise<any | null> {
        if (this.forcedOperationError) throw this.forcedOperationError;
        const found = this.docs.find((d) => this.matchesFilter(d, query));
        return found ? { ...found } : null;
      }

      async countDocuments(query: Record<string, any>): Promise<number> {
        if (this.forcedOperationError) throw this.forcedOperationError;
        return this.docs.filter((d) => this.matchesFilter(d, query)).length;
      }

      async insertOne(doc: any): Promise<{ acknowledged: boolean; insertedId: string }> {
        if (this.forcedOperationError) throw this.forcedOperationError;
        if (this.onBeforeInsert) {
          await this.onBeforeInsert(doc, this);
        }
        // Enforce all unique indexes registered on collection
        for (const idx of this.indexes) {
          if (!idx.options.unique) continue;
          const field = Object.keys(idx.key)[0];
          const val = doc[field];
          if (idx.options.sparse && (val === undefined || val === null)) continue;
          if (this.docs.some((existing) => existing[field] === val)) {
            const dupErr: any = new Error(`E11000 duplicate key error index: ${field}_1`);
            dupErr.code = 11000;
            throw dupErr;
          }
        }
        const stored = { _id: `mongo-oid-${this.docs.length + 1}`, ...doc };
        this.docs.push(stored);
        return { acknowledged: true, insertedId: stored._id };
      }

      async updateOne(filter: Record<string, any>, update: { $set?: Record<string, any> }): Promise<{ matchedCount: number; modifiedCount: number }> {
        if (this.forcedOperationError) throw this.forcedOperationError;
        const target = this.docs.find((d) => this.matchesFilter(d, filter));
        if (!target) return { matchedCount: 0, modifiedCount: 0 };
        let modified = 0;
        if (update?.$set) {
          for (const [k, v] of Object.entries(update.$set)) {
            if (target[k] !== v) {
              target[k] = v;
              modified = 1;
            }
          }
        }
        return { matchedCount: 1, modifiedCount: modified };
      }

      async updateMany(filter: Record<string, any>, update: { $set?: Record<string, any> }): Promise<{ matchedCount: number; modifiedCount: number }> {
        if (this.forcedOperationError) throw this.forcedOperationError;
        let matchedCount = 0;
        let modifiedCount = 0;
        for (const target of this.docs) {
          if (!this.matchesFilter(target, filter)) continue;
          matchedCount++;
          if (update?.$set) {
            let changed = false;
            for (const [k, v] of Object.entries(update.$set)) {
              if (target[k] !== v) {
                target[k] = v;
                changed = true;
              }
            }
            if (changed) modifiedCount++;
          }
        }
        return { matchedCount, modifiedCount };
      }

      async deleteOne(filter: Record<string, any>): Promise<{ deletedCount: number }> {
        if (this.forcedOperationError) throw this.forcedOperationError;
        const idx = this.docs.findIndex((d) => this.matchesFilter(d, filter));
        if (idx === -1) return { deletedCount: 0 };
        this.docs.splice(idx, 1);
        return { deletedCount: 1 };
      }
    }

    // Test 16: Production Storage Fail-Closed & Security Guards (Category A)
    testCount++;
    {
      NotificationRepository.setMockCollection(null);
      NotificationRepository.clearInMemoryStore();
      await NotificationRepository.createAsync({
        id: 'mem-sentinel-1',
        userId: 'sentinel-user',
        title: 'Sentinel',
        message: 'In-memory sentinel must never leak into production'
      });

      const savedNodeEnv = process.env.NODE_ENV;
      const savedIsTest = process.env.IS_TEST;
      const savedMongoUri = process.env.MONGODB_URI;
      const savedMongoUriAlt = process.env.MONGO_URI;
      try {
        // 16a: Missing Mongo URI in production fails closed (even when IS_TEST=true!)
        process.env.NODE_ENV = 'production';
        process.env.MONGODB_URI = '';
        process.env.MONGO_URI = '';

        for (const testFlag of ['false', 'true']) {
          process.env.IS_TEST = testFlag;
          await assert.rejects(
            () => NotificationRepository.getAllAsync({ userId: 'sentinel-user' }),
            /unavailable|not configured/i,
            `Production getAllAsync must fail closed when Mongo URI is missing (IS_TEST=${testFlag})`
          );
          await assert.rejects(
            () => NotificationRepository.getUnreadCountAsync('sentinel-user'),
            /unavailable|not configured/i
          );
          await assert.rejects(
            () => NotificationRepository.createAsync({ userId: 'sentinel-user', title: 'X', message: 'Y' }),
            /unavailable|not configured/i
          );
          await assert.rejects(
            () => NotificationRepository.markAsReadAsync('mem-sentinel-1', 'sentinel-user'),
            /unavailable|not configured/i
          );
          await assert.rejects(
            () => NotificationRepository.markAllAsReadAsync('sentinel-user'),
            /unavailable|not configured/i
          );
          await assert.rejects(
            () => NotificationRepository.deleteAsync('mem-sentinel-1', 'sentinel-user'),
            /unavailable|not configured/i
          );
          await assert.rejects(
            () => NotificationRepository.sendAsync({ userId: 'sentinel-user', title: 'X', message: 'Y' }),
            /unavailable|not configured/i
          );
        }

        // 16b: Sync in-memory methods (including clearInMemoryStore) must throw in production and preserve store
        assert.throws(() => NotificationRepository.getAll({ userId: 'sentinel-user' }), /disabled in production/i);
        assert.throws(() => NotificationRepository.create({ userId: 'sentinel-user', title: 'S', message: 'S' }), /disabled in production/i);
        assert.throws(() => NotificationRepository.markAsRead('mem-sentinel-1'), /disabled in production/i);
        assert.throws(() => NotificationRepository.markAllAsRead('sentinel-user'), /disabled in production/i);
        assert.throws(() => NotificationRepository.delete('mem-sentinel-1', 'sentinel-user'), /disabled in production/i);
        assert.throws(() => NotificationRepository.send({ userId: 'sentinel-user', title: 'S', message: 'S' }), /disabled in production/i);
        assert.throws(() => NotificationRepository.clearInMemoryStore(), /disabled in production/i);
        process.env.IS_TEST = 'true';
        assert.throws(() => NotificationRepository.clearInMemoryStore(), /disabled in production/i);
        process.env.IS_TEST = 'false';

        // 16c: setMockCollection strictly rejected in production or when IS_TEST !== 'true'
        assert.throws(
          () => NotificationRepository.setMockCollection(new FakeMongoNotificationCollection()),
          /Security violation/i
        );
        process.env.NODE_ENV = 'test';
        process.env.IS_TEST = 'false';
        assert.throws(
          () => NotificationRepository.setMockCollection(new FakeMongoNotificationCollection()),
          /Security violation/i
        );

        // 16d: Configured-but-broken MongoDB in production throws instead of falling back to memory
        process.env.NODE_ENV = 'production';
        process.env.IS_TEST = 'false';
        process.env.MONGODB_URI = 'invalid-scheme://internal-bad-mongo:27017/portal';
        await assert.rejects(
          () => NotificationRepository.getAllAsync({ userId: 'sentinel-user' }),
          /Invalid scheme|index initialization failed|operation failed/i,
          'Production with failing MongoDB must throw instead of silently returning in-memory sentinel'
        );
      } finally {
        process.env.NODE_ENV = savedNodeEnv;
        process.env.IS_TEST = savedIsTest;
        process.env.MONGODB_URI = savedMongoUri;
        process.env.MONGO_URI = savedMongoUriAlt;
        NotificationRepository.setMockCollection(null);
        NotificationRepository.clearInMemoryStore();
        // Verify sentinel remained untouched across production clearInMemoryStore attempts until non-production cleanup
        // (and non-production clearInMemoryStore successfully clears the store)
        assert.strictEqual((await NotificationRepository.getAllAsync({ userId: 'sentinel-user' })).length, 0);
      }
    }
    passCount++;
    console.log('✓ Test 16: Production fails closed without URI, ignores IS_TEST=true, blocks sync methods + clearInMemoryStore(), rejects unauthorized mock injection, and never falls back to memory on DB failure.');

    // Test 17: Controlled Fake MongoDB Indexes, Retry After Failure & Duplicate Pre-Existing Data Protection (Category B)
    testCount++;
    {
      const fakeColl = new FakeMongoNotificationCollection();
      fakeColl.failCreateIndexTimes = 1;
      NotificationRepository.setMockCollection(fakeColl);

      // First call fails during index init and must NOT cache rejected promise
      await assert.rejects(
        () => NotificationRepository.getAllAsync({ userId: 'u-idx' }),
        /index initialization failed/i
      );

      // Second call retries index initialization and succeeds
      const emptyList = await NotificationRepository.getAllAsync({ userId: 'u-idx' });
      assert.deepStrictEqual(emptyList, []);

      // Verify all 4 required indexes exist
      const hasUniqueId = fakeColl.indexes.some((i) => i.key.id === 1 && i.options.unique === true);
      const hasUniqueSparseEventId = fakeColl.indexes.some((i) => i.key.eventId === 1 && i.options.unique === true && i.options.sparse === true);
      const hasUniqueSparseIdemp = fakeColl.indexes.some((i) => i.key.idempotencyKey === 1 && i.options.unique === true && i.options.sparse === true);
      const hasUserCreatedIdx = fakeColl.indexes.some((i) => i.key.userId === 1 && i.key.createdAt === -1);
      assert.strictEqual(hasUniqueId, true, 'Must create unique index on id');
      assert.strictEqual(hasUniqueSparseEventId, true, 'Must create unique sparse index on eventId');
      assert.strictEqual(hasUniqueSparseIdemp, true, 'Must create unique sparse index on idempotencyKey');
      assert.strictEqual(hasUserCreatedIdx, true, 'Must create { userId: 1, createdAt: -1 } index');

      // Duplicate existing data preventing unique index must fail safely WITHOUT deleting or rewriting existing records
      const dupColl = new FakeMongoNotificationCollection();
      dupColl.docs.push(
        { id: 'dup-id-1', userId: 'u1', title: 'A', message: 'M1', createdAt: '2026-01-01T00:00:00.000Z' },
        { id: 'dup-id-1', userId: 'u1', title: 'B', message: 'M2', createdAt: '2026-01-02T00:00:00.000Z' }
      );
      NotificationRepository.setMockCollection(dupColl);
      await assert.rejects(
        () => NotificationRepository.getAllAsync({ userId: 'u1' }),
        /existing duplicate records.*Manual investigation/i
      );
      assert.strictEqual(dupColl.docs.length, 2, 'Duplicate records must NOT be deleted or rewritten automatically');
      NotificationRepository.setMockCollection(null);
    }
    passCount++;
    console.log('✓ Test 17: Controlled MongoDB verifies all 4 indexes, retries after failed index init, and preserves duplicate data on unique index conflict.');

    // Test 18: Controlled MongoDB Unique ID, Concurrency E11000 Race & Collision Checks (Category B & G)
    testCount++;
    {
      const fakeColl = new FakeMongoNotificationCollection();
      NotificationRepository.setMockCollection(fakeColl);

      // Unique ID enforcement (explicit duplicate id without shared eventId)
      const explicit1 = await NotificationRepository.createAsync({
        id: 'notif-unique-fixed-1',
        userId: 'mongo-u1',
        title: 'First',
        message: 'Body 1'
      });
      assert.strictEqual(explicit1.id, 'notif-unique-fixed-1');
      await assert.rejects(
        () => NotificationRepository.createAsync({
          id: 'notif-unique-fixed-1',
          userId: 'mongo-u1',
          title: 'Second',
          message: 'Body 2'
        }),
        /duplicate key/i
      );

      // Canonical metadata comparison (property order independence + actual diff rejection)
      const evtMeta = `evt-meta-${Date.now()}`;
      const metaA = await NotificationRepository.createAsync({
        userId: 'mongo-u1',
        title: 'Meta Test',
        message: 'Same message',
        type: 'info',
        channel: 'in-app',
        eventId: evtMeta,
        metadata: { z: 2, a: 1, nested: { second: 'b', first: 'a' } }
      });
      const metaB = await NotificationRepository.createAsync({
        userId: 'mongo-u1',
        title: 'Meta Test',
        message: 'Same message',
        type: 'info',
        channel: 'in-app',
        eventId: evtMeta,
        metadata: { a: 1, nested: { first: 'a', second: 'b' }, z: 2 }
      });
      assert.strictEqual(metaB.id, metaA.id, 'Same metadata with different property order must match existing record');
      await assert.rejects(
        () => NotificationRepository.createAsync({
          userId: 'mongo-u1',
          title: 'Meta Test',
          message: 'Same message',
          type: 'info',
          channel: 'in-app',
          eventId: evtMeta,
          metadata: { a: 1, nested: { first: 'a', second: 'CHANGED' }, z: 2 }
        }),
        /idempotency collision/i
      );

      // Concurrent duplicate event race (two findOne calls before insertOne runs -> second hits E11000 and recovers)
      const evtRace = `evt-race-${Date.now()}`;
      let insertBarrierCount = 0;
      let releaseRace!: () => void;
      const barrierReady = new Promise<void>((resolve) => {
        releaseRace = resolve;
      });
      fakeColl.onBeforeInsert = async () => {
        insertBarrierCount++;
        if (insertBarrierCount === 1) {
          // Wait a microtask/tick so second caller also finishes findOne before first inserts
          await new Promise((r) => setTimeout(r, 15));
          releaseRace();
        } else {
          await barrierReady;
        }
      };

      const [r1, r2] = await Promise.all([
        NotificationRepository.createAsync({
          userId: 'mongo-u1',
          title: 'Concurrent Alert',
          message: 'Order #123',
          type: 'success',
          channel: 'in-app',
          eventId: evtRace,
          metadata: { orderId: '123', step: 1 }
        }),
        NotificationRepository.createAsync({
          userId: 'mongo-u1',
          title: 'Concurrent Alert',
          message: 'Order #123',
          type: 'success',
          channel: 'in-app',
          eventId: evtRace,
          metadata: { step: 1, orderId: '123' }
        })
      ]);
      fakeColl.onBeforeInsert = undefined;
      assert.strictEqual(r1.id, r2.id, 'Concurrent duplicate event must resolve to same notification');
      assert.strictEqual(
        fakeColl.docs.filter((d) => d.eventId === evtRace).length,
        1,
        'Concurrent duplicate event must only persist 1 document in MongoDB'
      );

      // Different user & different content collision against MongoDB record
      await assert.rejects(
        () => NotificationRepository.createAsync({
          userId: 'mongo-u2',
          title: 'Concurrent Alert',
          message: 'Order #123',
          type: 'success',
          channel: 'in-app',
          eventId: evtRace,
          metadata: { orderId: '123', step: 1 }
        }),
        /idempotency collision/i
      );
      await assert.rejects(
        () => NotificationRepository.createAsync({
          userId: 'mongo-u1',
          title: 'Tampered Title',
          message: 'Order #123',
          type: 'success',
          channel: 'in-app',
          eventId: evtRace,
          metadata: { orderId: '123', step: 1 }
        }),
        /idempotency collision/i
      );

      NotificationRepository.setMockCollection(null);
    }
    passCount++;
    console.log('✓ Test 18: MongoDB branch enforces unique id, canonical metadata matching, E11000 race recovery, and collision rejection.');

    // Test 19: Bounded 500-Result Read Limit, Deterministic Ordering, Filters & Independent Unread Count (Category C — MongoDB & In-Memory)
    testCount++;
    {
      for (const modeLabel of ['mongo-branch', 'in-memory-branch'] as const) {
        let fakeColl: FakeMongoNotificationCollection | null = null;
        if (modeLabel === 'mongo-branch') {
          fakeColl = new FakeMongoNotificationCollection();
          NotificationRepository.setMockCollection(fakeColl);
        } else {
          NotificationRepository.setMockCollection(null);
          NotificationRepository.clearInMemoryStore();
        }

        const heavyUser = `heavy-user-${modeLabel}`;
        const baseTs = Date.parse('2026-01-01T00:00:00.000Z');
        // Insert 550 notifications for heavyUser (530 unread, 20 read); include identical-timestamp tiebreaker docs
        for (let i = 0; i < 550; i++) {
          const isRead = i < 20;
          const isTie = i >= 545; // Last 5 share exact same createdAt to test secondary id desc tiebreak
          const ts = isTie
            ? new Date(baseTs + 600 * 1000).toISOString()
            : new Date(baseTs + i * 1000).toISOString();
          await NotificationRepository.createAsync({
            id: `n-${String(i).padStart(4, '0')}`,
            userId: heavyUser,
            title: `Notice ${i}`,
            message: `Body ${i}`,
            type: i % 2 === 0 ? 'info' : 'warning',
            isRead,
            createdAt: ts
          });
        }
        // Also insert a record for another user
        await NotificationRepository.createAsync({
          id: 'n-other-user',
          userId: 'other-user-only',
          title: 'Other',
          message: 'Other',
          type: 'warning',
          isRead: false,
          createdAt: new Date(baseTs + 999 * 1000).toISOString()
        });

        const defaultLimited = await NotificationRepository.getAllAsync({ userId: heavyUser });
        assert.strictEqual(defaultLimited.length, 500, `${modeLabel}: Default getAllAsync must cap at 500`);

        const overRequested = await NotificationRepository.getAllAsync({ userId: heavyUser, limit: 1000 });
        assert.strictEqual(overRequested.length, 500, `${modeLabel}: Caller must never exceed 500`);

        // Verify deterministic descending order + secondary id desc tiebreak on latest 5
        assert.deepStrictEqual(
          defaultLimited.slice(0, 5).map((n) => n.id),
          ['n-0549', 'n-0548', 'n-0547', 'n-0546', 'n-0545'],
          `${modeLabel}: Must sort deterministically descending by createdAt then id`
        );

        // Verify unreadCount remains independent of 500-item list limit (530 unread!)
        const unreadCount = await NotificationRepository.getUnreadCountAsync(heavyUser);
        assert.strictEqual(unreadCount, 530, `${modeLabel}: Unread count must reflect all 530 unread records beyond 500-cap`);

        // Verify type and unreadOnly filters remain effective
        const warningUnread = await NotificationRepository.getAllAsync({
          userId: heavyUser,
          type: 'warning',
          unreadOnly: true
        });
        assert.strictEqual(warningUnread.every((n) => n.userId === heavyUser && n.type === 'warning' && !n.isRead && !n.read), true);
        assert.strictEqual(warningUnread.length, 265, `${modeLabel}: Expected 265 unread warning notifications`);

        // Verify HTTP route also enforces max 500 even when ?limit=1000 is requested
        if (modeLabel === 'mongo-branch') {
          activeTestUser = { userId: heavyUser, role: 'Member' };
          const httpListRes = await fetch(`${baseUrl}/api/notifications?limit=1000`);
          const httpListData = await httpListRes.json();
          assert.strictEqual(httpListRes.status, 200);
          assert.strictEqual(httpListData.notifications.length, 500);

          const httpCountRes = await fetch(`${baseUrl}/api/notifications/unread-count`);
          const httpCountData = await httpCountRes.json();
          assert.strictEqual(httpCountRes.status, 200);
          assert.strictEqual(httpCountData.unreadCount, 530);
        }

        NotificationRepository.setMockCollection(null);
        NotificationRepository.clearInMemoryStore();
      }
    }
    passCount++;
    console.log('✓ Test 19: Bounded 500-record reads, deterministic descending ordering, filters, and independent unreadCount verified in both MongoDB and in-memory modes.');

    // Test 20: User Isolation & Scoped Delete Security (Category D — MongoDB & In-Memory & HTTP)
    testCount++;
    {
      for (const modeLabel of ['mongo-branch', 'in-memory-branch'] as const) {
        if (modeLabel === 'mongo-branch') {
          NotificationRepository.setMockCollection(new FakeMongoNotificationCollection());
        } else {
          NotificationRepository.setMockCollection(null);
          NotificationRepository.clearInMemoryStore();
        }

        const nA1 = await NotificationRepository.createAsync({ id: `iso-a1-${modeLabel}`, userId: 'iso-user-A', title: 'A1', message: 'M' });
        const nB1 = await NotificationRepository.createAsync({ id: `iso-b1-${modeLabel}`, userId: 'iso-user-B', title: 'B1', message: 'M' });
        const nB2 = await NotificationRepository.createAsync({ id: `iso-b2-${modeLabel}`, userId: 'iso-user-B', title: 'B2', message: 'M' });

        // User A cannot mark User B's notification read
        const crossMarkRepo = await NotificationRepository.markAsReadAsync(nB1.id, 'iso-user-A');
        assert.strictEqual(crossMarkRepo, false, `${modeLabel}: Cross-user markAsReadAsync must fail`);

        activeTestUser = { userId: 'iso-user-A', role: 'Member' };
        const crossMarkHttp = await fetch(`${baseUrl}/api/notifications/${encodeURIComponent(nB1.id)}/read`, { method: 'PATCH' });
        assert.strictEqual(crossMarkHttp.status, 404, `${modeLabel}: Cross-user PATCH /:id/read must return 404`);

        // GET /api/notifications returns only authenticated user's notifications even if query tries ?userId=iso-user-B
        const getAuthRes = await fetch(`${baseUrl}/api/notifications?userId=iso-user-B`);
        const getAuthData = await getAuthRes.json();
        assert.strictEqual(getAuthRes.status, 200);
        assert.deepStrictEqual(getAuthData.notifications.map((n: any) => n.id), [nA1.id]);

        // markAllAsRead for User A cannot change User B's records
        const patchAllRes = await fetch(`${baseUrl}/api/notifications/read-all`, { method: 'PATCH' });
        const patchAllData = await patchAllRes.json();
        assert.strictEqual(patchAllRes.status, 200);
        assert.strictEqual(patchAllData.updatedCount, 1);
        assert.strictEqual(await NotificationRepository.getUnreadCountAsync('iso-user-B'), 2);

        // User A cannot delete User B's notification
        assert.strictEqual(await NotificationRepository.deleteAsync(nB1.id, 'iso-user-A'), false);
        // Missing / empty / whitespace userId must NOT perform unscoped deletion
        assert.strictEqual(await NotificationRepository.deleteAsync(nB1.id), false);
        assert.strictEqual(await NotificationRepository.deleteAsync(nB1.id, ''), false);
        assert.strictEqual(await NotificationRepository.deleteAsync(nB1.id, '   '), false);
        assert.strictEqual((await NotificationRepository.getAllAsync({ userId: 'iso-user-B' })).length, 2);

        // Correct user-scoped delete succeeds only for owner
        assert.strictEqual(await NotificationRepository.deleteAsync(nB2.id, 'iso-user-B'), true);
        assert.deepStrictEqual(
          (await NotificationRepository.getAllAsync({ userId: 'iso-user-B' })).map((n) => n.id),
          [nB1.id]
        );

        NotificationRepository.setMockCollection(null);
        NotificationRepository.clearInMemoryStore();
      }
    }
    passCount++;
    console.log('✓ Test 20: User isolation for GET, markAsRead, markAllAsRead, and user-scoped deleteAsync verified in MongoDB and in-memory modes.');

    // Test 21: Read-State Compatibility (isRead + read Dual Write & Legacy Documents) (Category E)
    testCount++;
    {
      const fakeColl = new FakeMongoNotificationCollection();
      // Seed legacy docs directly into MongoDB:
      // 1) legacy-read-only-true: { read: true } (no isRead) -> already read!
      // 2) legacy-isread-only-true: { isRead: true } (no read) -> already read!
      // 3) legacy-read-only-false: { read: false } (no isRead) -> unread!
      // 4) legacy-isread-only-false: { isRead: false } (no read) -> unread!
      fakeColl.docs.push(
        { id: 'leg-r-true', userId: 'leg-user', title: 'R1', message: 'M', read: true, createdAt: '2026-02-01T00:00:00.000Z' },
        { id: 'leg-ir-true', userId: 'leg-user', title: 'R2', message: 'M', isRead: true, createdAt: '2026-02-02T00:00:00.000Z' },
        { id: 'leg-r-false', userId: 'leg-user', title: 'U1', message: 'M', read: false, createdAt: '2026-02-03T00:00:00.000Z' },
        { id: 'leg-ir-false', userId: 'leg-user', title: 'U2', message: 'M', isRead: false, createdAt: '2026-02-04T00:00:00.000Z' }
      );
      NotificationRepository.setMockCollection(fakeColl);

      assert.strictEqual(await NotificationRepository.getUnreadCountAsync('leg-user'), 2);
      const unreadOnlyDocs = await NotificationRepository.getAllAsync({ userId: 'leg-user', unreadOnly: true });
      assert.deepStrictEqual(unreadOnlyDocs.map((d) => d.id), ['leg-ir-false', 'leg-r-false']);

      // markAsReadAsync sets BOTH isRead: true and read: true
      assert.strictEqual(await NotificationRepository.markAsReadAsync('leg-r-false', 'leg-user'), true);
      const updatedOne = fakeColl.docs.find((d) => d.id === 'leg-r-false');
      assert.strictEqual(updatedOne.isRead, true);
      assert.strictEqual(updatedOne.read, true);

      // Idempotent call on already-read doc still returns true and preserves read state
      assert.strictEqual(await NotificationRepository.markAsReadAsync('leg-r-true', 'leg-user'), true);

      // markAllAsReadAsync updates ONLY the remaining unread doc (count === 1) and sets both isRead & read
      const bulkUpdatedCount = await NotificationRepository.markAllAsReadAsync('leg-user');
      assert.strictEqual(bulkUpdatedCount, 1, 'markAllAsReadAsync must update only records that are actually unread');
      const updatedBulk = fakeColl.docs.find((d) => d.id === 'leg-ir-false');
      assert.strictEqual(updatedBulk.isRead, true);
      assert.strictEqual(updatedBulk.read, true);
      assert.strictEqual(await NotificationRepository.getUnreadCountAsync('leg-user'), 0);

      NotificationRepository.setMockCollection(null);
    }
    passCount++;
    console.log('✓ Test 21: Read-state compatibility sets both read & isRead and handles legacy single-field documents consistently.');

    // Test 22: API Error Sanitization & Safe Input Validation (Category F)
    testCount++;
    {
      const fakeColl = new FakeMongoNotificationCollection();
      NotificationRepository.setMockCollection(fakeColl);
      await NotificationRepository.getAllAsync({ userId: 'sec-user' }); // initialize indexes first

      const internalHost = 'mongo-primary-secret.internal.prod:27017';
      const secretMarker = 'SECRET_SCRAM_CREDENTIAL_MARKER_987';
      fakeColl.forcedOperationError = new Error(`MongoServerSelectionError: connection failed to ${internalHost} with auth ${secretMarker}`);

      activeTestUser = { userId: 'sec-user', role: 'Member' };
      const endpoints = [
        { method: 'GET', url: `${baseUrl}/api/notifications` },
        { method: 'GET', url: `${baseUrl}/api/notifications/unread-count` },
        { method: 'PATCH', url: `${baseUrl}/api/notifications/read-all` },
        { method: 'PATCH', url: `${baseUrl}/api/notifications/notif-1/read` }
      ];

      for (const ep of endpoints) {
        const res = await fetch(ep.url, { method: ep.method });
        const rawText = await res.text();
        assert.strictEqual(res.status, 500, `${ep.method} ${ep.url} must return 500 on DB failure`);
        assert.strictEqual(rawText.includes(internalHost), false, `${ep.url} must NOT expose internal hostname`);
        assert.strictEqual(rawText.includes(secretMarker), false, `${ep.url} must NOT expose secret marker`);
        assert.strictEqual(rawText.includes('MongoServerSelectionError'), false, `${ep.url} must NOT expose driver class`);
        const parsed = JSON.parse(rawText);
        assert.strictEqual(parsed.success, false);
        assert.ok(typeof parsed.message === 'string' && parsed.message.length > 0);
      }

      // Clear error and verify safe 400 validation without breaking valid calls
      fakeColl.forcedOperationError = null;
      const badTypeRes = await fetch(`${baseUrl}/api/notifications?type=invalidType`);
      assert.strictEqual(badTypeRes.status, 400);
      const badUnreadRes = await fetch(`${baseUrl}/api/notifications?unreadOnly=notABool`);
      assert.strictEqual(badUnreadRes.status, 400);
      const badLimitRes = await fetch(`${baseUrl}/api/notifications?limit=-10`);
      assert.strictEqual(badLimitRes.status, 400);
      const badIdRes = await fetch(`${baseUrl}/api/notifications/${encodeURIComponent('$ne')}/read`, { method: 'PATCH' });
      assert.strictEqual(badIdRes.status, 400);

      // Valid query params work normally
      const okFilterRes = await fetch(`${baseUrl}/api/notifications?type=info&unreadOnly=true&limit=10`);
      assert.strictEqual(okFilterRes.status, 200);

      NotificationRepository.setMockCollection(null);
    }
    passCount++;
    console.log('✓ Test 22: API endpoints sanitize internal MongoDB errors on all 4 routes and reject malformed inputs with 400.');

    // Test 23: Canonical Metadata Comparison in In-Memory Mode Too (Category G)
    testCount++;
    {
      NotificationRepository.setMockCollection(null);
      NotificationRepository.clearInMemoryStore();
      const evtMemMeta = `evt-mem-meta-${Date.now()}`;
      const m1 = await NotificationRepository.createAsync({
        userId: 'mem-meta-user',
        title: 'Mem Meta',
        message: 'Same',
        type: 'info',
        channel: 'in-app',
        eventId: evtMemMeta,
        metadata: { k2: 'v2', k1: 'v1', deep: { b: 2, a: 1 } }
      });
      const m2 = await NotificationRepository.createAsync({
        userId: 'mem-meta-user',
        title: 'Mem Meta',
        message: 'Same',
        type: 'info',
        channel: 'in-app',
        eventId: evtMemMeta,
        metadata: { k1: 'v1', deep: { a: 1, b: 2 }, k2: 'v2' }
      });
      assert.strictEqual(m2.id, m1.id);
      await assert.rejects(
        () => NotificationRepository.createAsync({
          userId: 'mem-meta-user',
          title: 'Mem Meta',
          message: 'Same',
          type: 'info',
          channel: 'in-app',
          eventId: evtMemMeta,
          metadata: { k1: 'v1', deep: { a: 1, b: 999 }, k2: 'v2' }
        }),
        /idempotency collision/i
      );
      NotificationRepository.clearInMemoryStore();
    }
    passCount++;
    console.log('✓ Test 23: In-memory metadata comparison is key-order-independent and rejects actual diffs.');

    // Test 24: STEP-D.2.1-C.1 Strictly Positive Bounded Limit Edge Cases & clearInMemoryStore() Non-Clearance Proof
    testCount++;
    {
      // 24a: Prove production clearInMemoryStore() throws WITHOUT wiping existing in-memory records
      NotificationRepository.setMockCollection(null);
      NotificationRepository.clearInMemoryStore();
      await NotificationRepository.createAsync({
        id: 'clear-guard-sentinel',
        userId: 'clear-guard-user',
        title: 'Keep Me',
        message: 'Must not be cleared in production'
      });

      const savedEnv = process.env.NODE_ENV;
      const savedIsTest = process.env.IS_TEST;
      try {
        process.env.NODE_ENV = 'production';
        process.env.IS_TEST = 'true';
        assert.throws(() => NotificationRepository.clearInMemoryStore(), /disabled in production/i);
      } finally {
        process.env.NODE_ENV = savedEnv;
        process.env.IS_TEST = savedIsTest;
      }
      assert.strictEqual(
        (await NotificationRepository.getAllAsync({ userId: 'clear-guard-user' })).length,
        1,
        'Blocked production clearInMemoryStore() must leave in-memory store intact'
      );
      NotificationRepository.clearInMemoryStore();
      assert.strictEqual(
        (await NotificationRepository.getAllAsync({ userId: 'clear-guard-user' })).length,
        0,
        'Non-production clearInMemoryStore() must continue clearing normally'
      );

      // 24b: Verify FakeMongoNotificationCollection simulates MongoDB .limit(0) = no limit
      const limitTestColl = new FakeMongoNotificationCollection();
      const baseLimitTs = Date.parse('2026-03-01T00:00:00.000Z');
      for (let i = 0; i < 510; i++) {
        limitTestColl.docs.push({
          id: `lim-${String(i).padStart(4, '0')}`,
          userId: 'lim-user',
          title: `Limit Test ${i}`,
          message: `Msg ${i}`,
          isRead: false,
          read: false,
          createdAt: new Date(baseLimitTs + i * 1000).toISOString()
        });
      }
      const rawLimitZeroDocs = await limitTestColl.find({ userId: 'lim-user' }).limit(0).toArray();
      assert.strictEqual(
        rawLimitZeroDocs.length,
        510,
        'FakeMongoNotificationCollection.limit(0) must simulate MongoDB unbounded semantics'
      );

      // 24c: Test all required edge-case limits across BOTH fake MongoDB and in-memory branches
      for (const branch of ['mongo-branch', 'in-memory-branch'] as const) {
        if (branch === 'mongo-branch') {
          NotificationRepository.setMockCollection(limitTestColl);
        } else {
          NotificationRepository.setMockCollection(null);
          NotificationRepository.clearInMemoryStore();
          for (const d of limitTestColl.docs) {
            await NotificationRepository.createAsync({ ...d });
          }
        }

        const rHalf = await NotificationRepository.getAllAsync({ userId: 'lim-user', limit: 0.5 });
        assert.strictEqual(rHalf.length, 1, `${branch}: limit 0.5 must resolve to 1, not 0`);
        assert.strictEqual(rHalf[0].id, 'lim-0509', `${branch}: limit 0.5 must return the latest notification`);

        const rOne = await NotificationRepository.getAllAsync({ userId: 'lim-user', limit: 1 });
        assert.strictEqual(rOne.length, 1, `${branch}: limit 1 must return 1`);

        const r499 = await NotificationRepository.getAllAsync({ userId: 'lim-user', limit: 499 });
        assert.strictEqual(r499.length, 499, `${branch}: limit 499 must return 499`);

        const r500 = await NotificationRepository.getAllAsync({ userId: 'lim-user', limit: 500 });
        assert.strictEqual(r500.length, 500, `${branch}: limit 500 must return 500`);

        const r501 = await NotificationRepository.getAllAsync({ userId: 'lim-user', limit: 501 });
        assert.strictEqual(r501.length, 500, `${branch}: limit 501 must clamp to 500`);

        const rZero = await NotificationRepository.getAllAsync({ userId: 'lim-user', limit: 0 });
        assert.strictEqual(rZero.length, 500, `${branch}: limit 0 must default to 500`);

        const rNeg = await NotificationRepository.getAllAsync({ userId: 'lim-user', limit: -15 });
        assert.strictEqual(rNeg.length, 500, `${branch}: negative limit must default to 500`);

        const rNaN = await NotificationRepository.getAllAsync({ userId: 'lim-user', limit: Number.NaN });
        assert.strictEqual(rNaN.length, 500, `${branch}: NaN limit must default to 500`);

        const rInf = await NotificationRepository.getAllAsync({ userId: 'lim-user', limit: Number.POSITIVE_INFINITY });
        assert.strictEqual(rInf.length, 500, `${branch}: Infinity limit must default to 500`);

        NotificationRepository.setMockCollection(null);
        NotificationRepository.clearInMemoryStore();
      }
    }
    passCount++;
    console.log('✓ Test 24: clearInMemoryStore() production guard & strictly positive bounded limits (0.5->1, 1, 499, 500, 501->500, 0/-15/NaN/Infinity->500) verified with Mongo .limit(0) semantics.');

  } catch (err: any) {
    console.error('\n[TEST SCENARIO FAILURE]', err);
    suiteError = err;
  } finally {
    // --- 7. Robust Cleanup & Mandatory Integrity Verification ---
    console.log('\n--- Finalizing Suite & Verifying Storage Integrity ---');
    
    // Await server closure (cleanup path ensures we continue if this fails)
    if (httpServer) {
      try {
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('HTTP server close timeout')), 5000);
          httpServer!.close((err) => {
            clearTimeout(timeout);
            if (err) reject(err);
            else resolve();
          });
        });
        console.log('✓ HTTP Server closed successfully.');
      } catch (srvErr) {
        console.error('! Error during HTTP server closure:', srvErr);
      }
    }
    
    // Restoration of Property Descriptors (Exact & Authoritative)
    let restorationFailed = false;
    try {
      const dbRestore = restoreAndVerifyDescriptors(Database, databaseDescriptors, 'Database');
      const paymentRestore = restoreAndVerifyDescriptors(
        PaymentSettingsRepository,
        paymentRepoDescriptors,
        'PaymentSettingsRepository'
      );
      const visibilityRestore = restoreAndVerifyDescriptors(
        JobVisibilityRepository,
        visibilityRepoDescriptors,
        'JobVisibilityRepository'
      );
      const notifRestore = restoreAndVerifyDescriptors(
        NotificationRepository,
        notificationRepoDescriptors,
        'NotificationRepository'
      );

      const allRestored =
        dbRestore.restored &&
        paymentRestore.restored &&
        visibilityRestore.restored &&
        notifRestore.restored;
      if (!allRestored) {
        restorationFailed = true;
        const allMismatches = [
          ...dbRestore.mismatches,
          ...paymentRestore.mismatches,
          ...visibilityRestore.mismatches,
          ...notifRestore.mismatches
        ];
        console.error('\n[METHOD RESTORATION VERIFICATION FAILURE]\n' + allMismatches.map((m) => ` - ${m}`).join('\n'));
      } else {
        console.log('✓ Full method-restoration verification passed for Database, PaymentSettingsRepository, JobVisibilityRepository, and NotificationRepository.');
      }
    } catch (restoreErr) {
      console.error('! Error during method descriptor restoration:', restoreErr);
      restorationFailed = true;
    }

    // Clear Notification mock collection, index init state, and memory store BEFORE env restoration
    try {
      process.env.IS_TEST = 'true';
      process.env.NODE_ENV = 'test';
      NotificationRepository.setMockCollection(null);
      NotificationRepository.resetIndexInitStateForTests();
      NotificationRepository.clearInMemoryStore();
    } catch (clearErr) {
      console.error('! Error clearing notification mock/in-memory store:', clearErr);
      restorationFailed = true;
    }

    // Take post-test snapshot
    let integrityFailed = false;
    try {
      const postTestSnapshot = getDataDirectorySnapshot();
      const integrityResult = evaluateStorageIntegrity(preTestSnapshot, postTestSnapshot);
      if (!integrityResult.passed) {
        integrityFailed = true;
        console.error('\n[STORAGE INTEGRITY FAILURE]\n' + integrityResult.failures.map((f) => ` - ${f}`).join('\n'));
      } else {
        console.log('✓ Storage isolation verified (Byte-for-byte SHA-256 snapshot check passed).');
      }
    } catch (verifErr: any) {
      console.error('\n[INTEGRITY VERIFICATION CRITICAL ERROR]', verifErr);
      integrityFailed = true;
    }

    // Restore original process.env
    try {
      for (const key of Object.keys(process.env)) {
        if (!(key in originalEnv)) delete process.env[key];
      }
      for (const key of Object.keys(originalEnv)) {
        process.env[key] = originalEnv[key];
      }
    } catch (envErr) {
      console.error('! Error restoring environment variables:', envErr);
      restorationFailed = true;
    }

    // Evaluate final suite outcome
    const decision = evaluateSuiteDecision({
      passCount,
      testCount,
      integrityFailed,
      restorationFailed,
      suiteError
    });

    console.log(`\n===============================================================`);
    console.log(`=== TEST SUITE FINISHED: ${decision.summary} ===`);
    console.log(`=== Functional Scenarios: ${passCount}/${testCount} Passed ===`);
    console.log(`=== Storage Integrity: ${integrityFailed ? 'FAILED' : 'PASSED'} ===`);
    console.log(`=== Method Restoration: ${restorationFailed ? 'FAILED' : 'PASSED'} ===`);
    console.log(`===============================================================\n`);

    if (decision.exitCode !== 0) {
      process.exit(decision.exitCode);
    }
  }
}

runTests().catch((err) => {
  console.error('\n[FATAL EXIT ERROR]', err);
  process.exit(1);
});
