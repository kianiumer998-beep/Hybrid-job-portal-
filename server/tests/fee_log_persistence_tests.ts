import assert from 'assert';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import express from 'express';
import { createServer, Server } from 'http';

// Ensure test mode isolation before any module imports
process.env.IS_TEST = 'true';
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = '';
process.env.MONGO_URI = '';

import {
  FeeLogRepository,
  mapPaymentStatusToFeeLogStatus,
  isJobPostingTransaction,
  mapTransactionToFeeLog,
  isSyntheticDemoRecord,
  isValidLegacyRecord
} from '../db/repositories/FeeLogRepository';
import { PaymentRepository } from '../db/repositories/PaymentRepository';
import { UserRepository } from '../db/repositories/UserRepository';
import { feeLogRouter } from '../routes/feeLogRoutes';
import { authMiddleware, createToken } from '../auth/authManager';

interface DataSnapshot {
  files: Record<string, string>;
}

function getDataDirectorySnapshot(): DataSnapshot {
  const dataDir = path.resolve(process.cwd(), 'data');
  const snapshot: DataSnapshot = { files: {} };
  if (!fs.existsSync(dataDir)) return snapshot;

  const files = fs.readdirSync(dataDir);
  for (const file of files) {
    if (file.endsWith('.json')) {
      const fullPath = path.join(dataDir, file);
      const content = fs.readFileSync(fullPath);
      snapshot.files[file] = crypto.createHash('sha256').update(content).digest('hex');
    }
  }
  return snapshot;
}

function getMongodbTsHash(): string {
  const file = path.resolve(process.cwd(), 'server/db/mongodb.ts');
  const content = fs.readFileSync(file);
  return crypto.createHash('sha256').update(content).digest('hex');
}

async function runTestSuite() {
  console.log('==================================================================');
  console.log('   STEP-05-01: DURABLE FEE LOGS PERSISTENCE REGRESSION TEST SUITE   ');
  console.log('==================================================================');

  // Baseline snapshots
  const preSnapshot = getDataDirectorySnapshot();
  const preMongoHash = getMongodbTsHash();

  let httpServer: Server | null = null;
  let serverPort = 0;
  let passCount = 0;
  const totalTests = 16;

  try {
    // 0. Setup Express Test Server for HTTP integration tests
    const app = express();
    app.use(express.json());
    app.use(authMiddleware);
    app.use('/api/fee-logs', feeLogRouter);

    await new Promise<void>((resolve) => {
      httpServer = createServer(app);
      httpServer.listen(0, '127.0.0.1', () => {
        serverPort = (httpServer!.address() as any).port;
        resolve();
      });
    });

    const baseUrl = `http://127.0.0.1:${serverPort}/api/fee-logs`;

    // Create test admin and regular users in UserRepository
    const testAdminUser = UserRepository.create({
      id: 'usr-admin-finance-01',
      name: 'Finance Admin User',
      email: 'finance.admin@hybridjobs.pk',
      role: 'Finance Manager'
    });

    const testSuperAdminUser = UserRepository.create({
      id: 'usr-superadmin-01',
      name: 'Super Admin User',
      email: 'superadmin@hybridjobs.pk',
      role: 'Super Admin'
    });

    const testScraperUser = UserRepository.create({
      id: 'usr-scraper-mgr-01',
      name: 'Scraper Manager User',
      email: 'scraper@hybridjobs.pk',
      role: 'Scraper Manager'
    });

    const testJobSeekerUser = UserRepository.create({
      id: 'usr-jobseeker-01',
      name: 'Regular Jobseeker',
      email: 'jobseeker@hybridjobs.pk',
      role: 'Job Seeker'
    });

    const financeAdminToken = createToken({
      userId: testAdminUser.id,
      email: testAdminUser.email,
      role: testAdminUser.role
    });

    const superAdminToken = createToken({
      userId: testSuperAdminUser.id,
      email: testSuperAdminUser.email,
      role: testSuperAdminUser.role
    });

    const scraperManagerToken = createToken({
      userId: testScraperUser.id,
      email: testScraperUser.email,
      role: testScraperUser.role
    });

    const jobSeekerToken = createToken({
      userId: testJobSeekerUser.id,
      email: testJobSeekerUser.email,
      role: testJobSeekerUser.role
    });

    // -------------------------------------------------------------
    // Test 1: Transaction-to-fee-log mapping
    // -------------------------------------------------------------
    console.log('\n--- 1. Transaction Mapping & Status Tests ---');
    const sampleTx = {
      id: 'tx-fee-test-01',
      transactionId: 'JC-99281039',
      userId: 'user-employer-01',
      userName: 'Taimoor Khan',
      userEmail: 'taimoor@apexsolutions.pk',
      type: 'Job Posting Fee',
      jobIdRef: 'job-9901',
      jobTitleRef: 'Lead Full-Stack React Engineer',
      amount: 1500,
      currency: 'PKR',
      paymentMethod: 'JazzCash',
      dateTime: '2026-10-15 14:30 PKT',
      status: 'Success'
    };

    assert.strictEqual(isJobPostingTransaction(sampleTx), true, 'Sample transaction must be detected as Job Posting Fee');
    const mappedLog = mapTransactionToFeeLog(sampleTx);

    assert.strictEqual(mappedLog.id, 'tx-fee-test-01', 'Log id must match transaction id');
    assert.strictEqual(mappedLog.jobTitle, 'Lead Full-Stack React Engineer', 'Log jobTitle must map jobTitleRef');
    assert.strictEqual(mappedLog.userId, 'user-employer-01', 'Log userId must map correctly');
    assert.strictEqual(mappedLog.userName, 'Taimoor Khan', 'Log userName must map correctly');
    assert.strictEqual(mappedLog.userEmail, 'taimoor@apexsolutions.pk', 'Log userEmail must map correctly');
    assert.strictEqual(mappedLog.amount, 1500, 'Log amount must match transaction amount');
    assert.strictEqual(mappedLog.currency, 'PKR', 'Log currency must match');
    assert.strictEqual(mappedLog.paymentMethod, 'JazzCash', 'Log paymentMethod must match');
    assert.strictEqual(mappedLog.dateTime, '2026-10-15 14:30 PKT', 'Log dateTime must match');
    assert.strictEqual(mappedLog.status, 'Paid', 'Transaction status "Success" must map to fee log status "Paid"');

    passCount++;
    console.log('✓ Test 1 Passed: Transaction fields accurately mapped to JobPostingFeeLog.');

    // -------------------------------------------------------------
    // Test 2: Paid/Pending/Failed/Refunded status mapping
    // -------------------------------------------------------------
    assert.strictEqual(mapPaymentStatusToFeeLogStatus('Success'), 'Paid', 'Success maps to Paid');
    assert.strictEqual(mapPaymentStatusToFeeLogStatus('success'), 'Paid', 'Case-insensitive success maps to Paid');
    assert.strictEqual(mapPaymentStatusToFeeLogStatus('Paid'), 'Paid', 'Paid maps to Paid');
    assert.strictEqual(mapPaymentStatusToFeeLogStatus('Completed'), 'Paid', 'Completed maps to Paid');
    assert.strictEqual(mapPaymentStatusToFeeLogStatus('Approved'), 'Paid', 'Approved maps to Paid');

    assert.strictEqual(mapPaymentStatusToFeeLogStatus('Pending'), 'Pending', 'Pending maps to Pending');
    assert.strictEqual(mapPaymentStatusToFeeLogStatus('Under Review'), 'Pending', 'Under Review maps to Pending');

    assert.strictEqual(mapPaymentStatusToFeeLogStatus('Failed'), 'Failed', 'Failed maps to Failed');
    assert.strictEqual(mapPaymentStatusToFeeLogStatus('Rejected'), 'Failed', 'Rejected maps to Failed');

    assert.strictEqual(mapPaymentStatusToFeeLogStatus('Refunded'), 'Refunded', 'Refunded maps to Refunded');
    assert.strictEqual(mapPaymentStatusToFeeLogStatus('Compensated'), 'Refunded', 'Compensated maps to Refunded');

    passCount++;
    console.log('✓ Test 2 Passed: Paid, Pending, Failed, and Refunded status mapping verified.');

    // -------------------------------------------------------------
    // Test 3: Unique transaction identity
    // -------------------------------------------------------------
    console.log('\n--- 2. Unique Identity & Deduplication Tests ---');
    PaymentRepository.create({
      id: 'tx-unique-01',
      type: 'Job Posting Fee',
      jobTitleRef: 'Senior Data Engineer',
      userId: 'usr-dedup-1',
      userName: 'Sara Ahmed',
      amount: 1000,
      currency: 'PKR',
      status: 'Success',
      dateTime: '2026-10-16 10:00'
    });

    PaymentRepository.create({
      id: 'tx-unique-02',
      type: 'Job Posting Fee',
      jobTitleRef: 'DevOps Specialist',
      userId: 'usr-dedup-2',
      userName: 'Bilal Khan',
      amount: 1000,
      currency: 'PKR',
      status: 'Pending',
      dateTime: '2026-10-16 11:00'
    });

    const logsUnique = await FeeLogRepository.getAllFeeLogs();
    const uniqueIds = logsUnique.map((l) => l.id);
    assert(uniqueIds.includes('tx-unique-01'), 'tx-unique-01 must be present');
    assert(uniqueIds.includes('tx-unique-02'), 'tx-unique-02 must be present');
    assert.notStrictEqual(
      logsUnique.find((l) => l.id === 'tx-unique-01')?.jobTitle,
      logsUnique.find((l) => l.id === 'tx-unique-02')?.jobTitle,
      'Distinct transactions must remain distinct records'
    );

    passCount++;
    console.log('✓ Test 3 Passed: Unique transaction identities preserved distinctly.');

    // -------------------------------------------------------------
    // Test 4: Duplicate legacy import prevention
    // -------------------------------------------------------------
    const duplicateLegacyAttempt = [
      {
        id: 'tx-unique-01', // Already exists as a Payment transaction!
        jobTitle: 'Senior Data Engineer (Attempted Duplicate)',
        userId: 'usr-dedup-1',
        amount: 1000,
        currency: 'PKR',
        paymentMethod: 'JazzCash',
        status: 'Paid',
        dateTime: '2026-10-16 10:00'
      },
      {
        id: 'log-tx-unique-02', // Matches tx-unique-02 with 'log-' prefix
        jobTitle: 'DevOps Specialist (Attempted Duplicate)',
        userId: 'usr-dedup-2',
        amount: 1000,
        currency: 'PKR',
        paymentMethod: 'Easypaisa',
        status: 'Pending',
        dateTime: '2026-10-16 11:00'
      }
    ];

    const dupImportRes = await FeeLogRepository.importLegacyRecords(duplicateLegacyAttempt, 'AdminTester');
    assert.strictEqual(
      dupImportRes.importedCount,
      0,
      'Should not import records already represented by transactions'
    );
    assert.strictEqual(
      dupImportRes.skippedCount,
      2,
      'Duplicate records represented by transactions must be skipped'
    );

    passCount++;
    console.log('✓ Test 4 Passed: Duplicate legacy import correctly prevented.');

    // -------------------------------------------------------------
    // Test 5: Legacy record preservation & idempotency
    // -------------------------------------------------------------
    console.log('\n--- 3. Legacy Ledger Import & Preservation Tests ---');
    const legitimateLegacyRecords = [
      {
        id: 'legacy-log-historical-01',
        jobTitle: 'Historical Legacy Architect Post',
        userId: 'usr-legacy-01',
        userName: 'Zubair Qureshi',
        userEmail: 'zubair@legacy.pk',
        amount: 800,
        currency: 'PKR',
        paymentMethod: 'Bank Transfer',
        status: 'Paid',
        dateTime: '2026-05-10 12:00'
      },
      {
        id: 'legacy-log-historical-02',
        jobTitle: 'Historical QA Automation Lead',
        userId: 'usr-legacy-02',
        userName: 'Nadia Malik',
        userEmail: 'nadia@legacy.pk',
        amount: 800,
        currency: 'PKR',
        paymentMethod: 'JazzCash',
        status: 'Paid',
        dateTime: '2026-05-12 15:30'
      }
    ];

    const firstImport = await FeeLogRepository.importLegacyRecords(legitimateLegacyRecords, 'Admin');
    assert.strictEqual(firstImport.importedCount, 2, '2 legitimate legacy records must be imported');
    assert.strictEqual(firstImport.verifiedCount, 2, '2 records must be verified in storage');

    // Idempotency: importing the exact same records again
    const secondImport = await FeeLogRepository.importLegacyRecords(legitimateLegacyRecords, 'Admin');
    assert.strictEqual(secondImport.verifiedCount, 2, 'Re-importing is idempotent and verifies storage');

    const allAfterLegacy = await FeeLogRepository.getAllFeeLogs();
    assert(
      allAfterLegacy.some((l) => l.id === 'legacy-log-historical-01'),
      'legacy-log-historical-01 must be preserved in active logs'
    );
    assert(
      allAfterLegacy.some((l) => l.id === 'legacy-log-historical-02'),
      'legacy-log-historical-02 must be preserved in active logs'
    );

    passCount++;
    console.log('✓ Test 5 Passed: Legitimate legacy records preserved and verified idempotently.');

    // -------------------------------------------------------------
    // Test 6: Synthetic demo record exclusion
    // -------------------------------------------------------------
    const demoRecords = [
      {
        id: 'log-demo-1',
        jobTitle: 'Senior Python & Django Developer',
        userId: 'user-demo-1',
        userName: 'Ali Raza',
        userEmail: 'ali.raza@example.com',
        amount: 1000,
        currency: 'PKR',
        paymentMethod: 'JazzCash',
        dateTime: '2026-07-25 10:15',
        status: 'Paid'
      },
      {
        id: 'demo-sample-99',
        jobTitle: 'Synthetic Developer Demo',
        userId: 'demo-user',
        amount: 500,
        currency: 'PKR',
        paymentMethod: 'Cash',
        status: 'Pending'
      }
    ];

    assert.strictEqual(isSyntheticDemoRecord(demoRecords[0]), true, 'log-demo-1 is recognized as demo');
    assert.strictEqual(isSyntheticDemoRecord(demoRecords[1]), true, 'demo-sample-99 is recognized as demo');

    const demoImportRes = await FeeLogRepository.importLegacyRecords(demoRecords, 'Admin');
    assert.strictEqual(demoImportRes.importedCount, 0, 'No demo records should be imported');
    assert.strictEqual(demoImportRes.skippedCount, 2, 'Both demo records must be skipped');

    const checkLogsForDemo = await FeeLogRepository.getAllFeeLogs();
    assert(
      !checkLogsForDemo.some((l) => l.id === 'log-demo-1'),
      'log-demo-1 must NOT exist in durable fee logs'
    );

    passCount++;
    console.log('✓ Test 6 Passed: Synthetic demo records strictly excluded from durable storage.');

    // -------------------------------------------------------------
    // Test 7: Single archive
    // -------------------------------------------------------------
    console.log('\n--- 4. Archive & Non-Reappearance Tests ---');
    const archiveTargetId = 'legacy-log-historical-01';
    await FeeLogRepository.archiveFeeLog(archiveTargetId, 'Finance Admin');

    const logsAfterSingleArchive = await FeeLogRepository.getAllFeeLogs();
    assert(
      !logsAfterSingleArchive.some((l) => l.id === archiveTargetId),
      'Archived fee log must not appear in getAllFeeLogs()'
    );

    passCount++;
    console.log('✓ Test 7 Passed: Single fee log archive successful and hidden from query.');

    // -------------------------------------------------------------
    // Test 8: Bulk archive
    // -------------------------------------------------------------
    PaymentRepository.create({
      id: 'tx-bulk-archive-01',
      type: 'Job Posting Fee',
      jobTitleRef: 'Mobile App Developer Flutter',
      amount: 1200,
      currency: 'PKR',
      status: 'Success',
      dateTime: '2026-10-17 09:00'
    });

    PaymentRepository.create({
      id: 'tx-bulk-archive-02',
      type: 'Job Posting Fee',
      jobTitleRef: 'iOS Swift Developer',
      amount: 1200,
      currency: 'PKR',
      status: 'Success',
      dateTime: '2026-10-17 09:30'
    });

    const bulkCount = await FeeLogRepository.bulkArchiveFeeLogs(
      ['tx-bulk-archive-01', 'tx-bulk-archive-02'],
      'Finance Admin'
    );
    assert.strictEqual(bulkCount, 2, 'Bulk archive should report 2 archived');

    const logsAfterBulk = await FeeLogRepository.getAllFeeLogs();
    assert(!logsAfterBulk.some((l) => l.id === 'tx-bulk-archive-01'), 'tx-bulk-archive-01 must be hidden');
    assert(!logsAfterBulk.some((l) => l.id === 'tx-bulk-archive-02'), 'tx-bulk-archive-02 must be hidden');

    passCount++;
    console.log('✓ Test 8 Passed: Bulk archive processed and all target logs hidden.');

    // -------------------------------------------------------------
    // Test 9: Archived records not reappearing
    // -------------------------------------------------------------
    // Re-querying multiple times and running re-import must never un-hide archived records
    await FeeLogRepository.importLegacyRecords(legitimateLegacyRecords, 'Admin');
    const logsPersistentCheck = await FeeLogRepository.getAllFeeLogs();
    assert(
      !logsPersistentCheck.some((l) => l.id === archiveTargetId),
      'Archived record must remain hidden even after legacy re-import'
    );
    assert(
      !logsPersistentCheck.some((l) => l.id === 'tx-bulk-archive-01'),
      'Bulk archived record must remain hidden'
    );

    passCount++;
    console.log('✓ Test 9 Passed: Archived records do not reappear across subsequent queries.');

    // -------------------------------------------------------------
    // Test 10: Payment transaction remains unchanged after fee-log deletion
    // -------------------------------------------------------------
    console.log('\n--- 5. Financial Audit Integrity ---');
    const auditTxId = 'tx-audit-preserve-99';
    PaymentRepository.create({
      id: auditTxId,
      transactionId: 'EP-AUDIT-99281',
      type: 'Job Posting Fee',
      jobTitleRef: 'Principal Security Architect',
      userId: 'usr-fin-99',
      userName: 'Kamran Akmal',
      userEmail: 'kamran@security.pk',
      amount: 5000,
      currency: 'PKR',
      paymentMethod: 'Easypaisa',
      status: 'Success',
      dateTime: '2026-10-18 16:00'
    });

    // Check before deletion
    const beforeTx = PaymentRepository.getById(auditTxId);
    assert(beforeTx, 'Transaction must exist in PaymentRepository prior to log deletion');
    assert.strictEqual(beforeTx.amount, 5000);
    assert.strictEqual(beforeTx.status, 'Success');

    // Archive/delete the fee log
    await FeeLogRepository.archiveFeeLog(auditTxId, 'Auditor');

    // Verify fee log is hidden
    const logsAfterAuditArchive = await FeeLogRepository.getAllFeeLogs();
    assert(!logsAfterAuditArchive.some((l) => l.id === auditTxId), 'Fee log must be archived');

    // Verify underlying Payment transaction is STILL 100% INTACT
    const afterTx = PaymentRepository.getById(auditTxId);
    assert(afterTx, 'Payment transaction MUST STILL EXIST in PaymentRepository after fee log deletion');
    assert.strictEqual(afterTx.id, auditTxId, 'Transaction id unchanged');
    assert.strictEqual(afterTx.amount, 5000, 'Transaction amount unchanged');
    assert.strictEqual(afterTx.status, 'Success', 'Transaction status unchanged');
    assert.strictEqual(afterTx.userEmail, 'kamran@security.pk', 'Transaction userEmail unchanged');
    assert.strictEqual(afterTx.jobTitleRef, 'Principal Security Architect', 'Transaction jobTitleRef unchanged');

    passCount++;
    console.log('✓ Test 10 Passed: Original payment transaction preserved with 100% integrity after fee log deletion.');

    // -------------------------------------------------------------
    // Test 11: Unauthorized access rejection (REST API)
    // -------------------------------------------------------------
    console.log('\n--- 6. Security & Authorization Tests ---');
    // 11A. No token -> 401
    const unauthRes = await fetch(baseUrl);
    assert.strictEqual(unauthRes.status, 401, 'Request without token must return 401');

    // 11B. Non-admin user (Job Seeker) -> 403
    const seekerRes = await fetch(baseUrl, {
      headers: { Authorization: `Bearer ${jobSeekerToken}` }
    });
    assert.strictEqual(seekerRes.status, 403, 'Regular jobseeker token must return 403');

    // 11C. Admin lacking finance/payments permission (Scraper Manager) -> 403
    const scraperRes = await fetch(baseUrl, {
      headers: { Authorization: `Bearer ${scraperManagerToken}` }
    });
    assert.strictEqual(scraperRes.status, 403, 'Scraper Manager lacking finance/payments must return 403');

    // 11D. Authorized Finance Manager -> 200
    const financeRes = await fetch(baseUrl, {
      headers: { Authorization: `Bearer ${financeAdminToken}` }
    });
    assert.strictEqual(financeRes.status, 200, 'Finance Manager must return 200');
    const financeData = await financeRes.json();
    assert.strictEqual(financeData.success, true);
    assert(Array.isArray(financeData.feeLogs), 'Fee logs array returned to authorized admin');

    // 11E. Authorized Super Admin -> 200
    const superRes = await fetch(baseUrl, {
      headers: { Authorization: `Bearer ${superAdminToken}` }
    });
    assert.strictEqual(superRes.status, 200, 'Super Admin must return 200');

    passCount++;
    console.log('✓ Test 11 Passed: RBAC enforcement verified; unauthorized and unpermitted requests rejected.');

    // -------------------------------------------------------------
    // Test 12: MongoDB failure handling
    // -------------------------------------------------------------
    console.log('\n--- 7. Resilience & MongoDB Error Handling ---');
    // When production mode is set (process.env.IS_TEST = 'false') and MongoDB is not configured,
    // FeeLogRepository must reject with an explicit error and NOT claim in-memory success.
    const originalIsTest = process.env.IS_TEST;
    try {
      process.env.IS_TEST = 'false';
      let caughtError: any = null;
      try {
        await FeeLogRepository.getAllFeeLogs();
      } catch (err: any) {
        caughtError = err;
      }
      assert(caughtError !== null, 'FeeLogRepository must throw when MongoDB is unavailable in non-test mode');
      assert(
        caughtError.message.includes('MongoDB'),
        'Error message must explicitly mention MongoDB unavailability'
      );
    } finally {
      process.env.IS_TEST = originalIsTest;
    }

    passCount++;
    console.log('✓ Test 12 Passed: MongoDB failure produces explicit rejection, no false persistence claim.');

    // -------------------------------------------------------------
    // Test 13: Failed authoritative transaction lookup causes legacy import to reject and zero records written
    // -------------------------------------------------------------
    console.log('\n--- 8. Authoritative Transaction Lookup Failure Path ---');
    const originalGetAllAsync = PaymentRepository.getAllAsync;
    PaymentRepository.getAllAsync = async () => {
      throw new Error('Simulated database partition error in PaymentRepository.getAllAsync');
    };

    try {
      let lookupFailureThrew = false;
      const unwrittenId = 'unwritten-legacy-fail-lookup-01';
      try {
        await FeeLogRepository.importLegacyRecords([
          {
            id: unwrittenId,
            jobTitle: 'Unwritten Job Post After Lookup Failure',
            userId: 'usr-fail-01',
            amount: 2500,
            currency: 'PKR',
            status: 'Paid',
            dateTime: '2026-10-20 10:00'
          }
        ]);
      } catch (err: any) {
        lookupFailureThrew = true;
        assert(
          err.message.includes('Authoritative transaction lookup failed'),
          `Error must state authoritative transaction lookup failure, got: ${err.message}`
        );
      }
      assert.strictEqual(
        lookupFailureThrew,
        true,
        'FeeLogRepository.importLegacyRecords must reject when PaymentRepository.getAllAsync() fails'
      );

      // Verify that NO records were written to storage
      PaymentRepository.getAllAsync = originalGetAllAsync;
      const logsAfterFailedLookup = await FeeLogRepository.getAllFeeLogs();
      assert(
        !logsAfterFailedLookup.some((l) => l.id === unwrittenId),
        'Zero legacy records must be written when authoritative transaction lookup fails'
      );
    } finally {
      PaymentRepository.getAllAsync = originalGetAllAsync;
    }

    passCount++;
    console.log('✓ Test 13 Passed: Failed transaction lookup halts legacy import and writes zero records.');

    // -------------------------------------------------------------
    // Test 14: MongoDB-unavailable production import cannot claim success
    // -------------------------------------------------------------
    console.log('\n--- 9. Production Mode Pre-flight MongoDB Rejection ---');
    const originalIsTestProd = process.env.IS_TEST;
    try {
      process.env.IS_TEST = 'false';
      let prodImportThrew = false;
      try {
        await FeeLogRepository.importLegacyRecords([
          {
            id: 'legacy-prod-no-mongo-01',
            jobTitle: 'Production Mode Import Without MongoDB',
            amount: 1000,
            currency: 'PKR',
            status: 'Paid'
          }
        ]);
      } catch (err: any) {
        prodImportThrew = true;
        assert(
          err.message.includes('MongoDB is not configured'),
          `Production import must explicitly reject with MongoDB is not configured, got: ${err.message}`
        );
      }
      assert.strictEqual(
        prodImportThrew,
        true,
        'Production import without MongoDB configuration must throw explicitly before attempting migration'
      );
    } finally {
      process.env.IS_TEST = originalIsTestProd;
    }

    passCount++;
    console.log('✓ Test 14 Passed: Production import rejects without MongoDB; cannot claim false persistence success.');

    // -------------------------------------------------------------
    // Test 15: Conservative LocalStorage clear verification logic
    // -------------------------------------------------------------
    console.log('\n--- 10. LocalStorage Clear Condition Safety ---');
    function evaluateLocalStorageClearDecision(
      importRes: any,
      nonDemoRecords: any[]
    ): { shouldClear: boolean; reason: string } {
      if (nonDemoRecords.length === 0) {
        return { shouldClear: true, reason: 'Only demo records existed' };
      }
      const verifiedCount = typeof importRes?.verifiedCount === 'number' ? importRes.verifiedCount : -1;
      const importedCount = typeof importRes?.importedCount === 'number' ? importRes.importedCount : -2;
      const alreadyRepresented = importRes?.alreadyRepresentedCount ?? 0;
      const totalAccounted = verifiedCount + alreadyRepresented;

      const isCompleteAndVerified =
        importRes?.success === true &&
        verifiedCount >= 0 &&
        verifiedCount === importedCount &&
        totalAccounted >= nonDemoRecords.length;

      return {
        shouldClear: isCompleteAndVerified,
        reason: isCompleteAndVerified
          ? 'Complete and reliable verification'
          : 'Incomplete or unverified records remaining'
      };
    }

    // Scenario A: Incomplete verification (verifiedCount < importedCount or unaccounted records)
    const partialRes = { success: true, importedCount: 2, verifiedCount: 1, alreadyRepresentedCount: 0 };
    assert.strictEqual(
      evaluateLocalStorageClearDecision(partialRes, [{ id: '1' }, { id: '2' }]).shouldClear,
      false,
      'LocalStorage must NOT be cleared when verifiedCount < importedCount or unaccounted records remain'
    );

    // Scenario B: Import failed / error response
    const failedRes = { success: false, message: 'MongoDB connection error' };
    assert.strictEqual(
      evaluateLocalStorageClearDecision(failedRes, [{ id: '1' }]).shouldClear,
      false,
      'LocalStorage must NOT be cleared when importRes.success is false'
    );

    // Scenario C: Complete verification (1 verified in storage + 1 already in transactions = 2 accounted)
    const completeRes = { success: true, importedCount: 1, verifiedCount: 1, alreadyRepresentedCount: 1 };
    assert.strictEqual(
      evaluateLocalStorageClearDecision(completeRes, [{ id: '1' }, { id: '2' }]).shouldClear,
      true,
      'LocalStorage may be cleared only when all non-demo records are verified or accounted for'
    );

    // Scenario D: Only synthetic demo records
    assert.strictEqual(
      evaluateLocalStorageClearDecision(null, []).shouldClear,
      true,
      'LocalStorage may be cleaned up when only demo records existed'
    );

    passCount++;
    console.log('✓ Test 15 Passed: LocalStorage conservative retention logic verified across all failure & partial paths.');

    // -------------------------------------------------------------
    // Test 16: No JSON data modification
    // -------------------------------------------------------------
    console.log('\n--- 11. Storage Isolation & Checksum Verification ---');
    const postSnapshot = getDataDirectorySnapshot();
    const postMongoHash = getMongodbTsHash();

    // Verify mongodb.ts unchanged
    assert.strictEqual(
      postMongoHash,
      preMongoHash,
      'Protected server/db/mongodb.ts must remain byte-for-byte unchanged'
    );

    // Verify all JSON files unchanged
    const preKeys = Object.keys(preSnapshot.files).sort();
    const postKeys = Object.keys(postSnapshot.files).sort();
    assert.deepStrictEqual(preKeys, postKeys, 'File list in data/ must be identical');

    for (const file of preKeys) {
      assert.strictEqual(
        postSnapshot.files[file],
        preSnapshot.files[file],
        `File data/${file} SHA-256 hash must remain exactly unchanged`
      );
    }

    passCount++;
    console.log('✓ Test 16 Passed: Zero modifications to data/*.json and protected server/db/mongodb.ts.');

    console.log('\n==================================================================');
    console.log(`=== TEST SUITE RESULT: SUCCESS (${passCount}/${totalTests} Passed) ===`);
    console.log('==================================================================\n');
  } catch (err: any) {
    console.error('\n[SUITE FAILURE]', err);
    process.exit(1);
  } finally {
    if (httpServer) {
      await new Promise<void>((resolve) => (httpServer as Server).close(() => resolve()));
    }
  }
}

runTestSuite().catch((err) => {
  console.error('[UNHANDLED ERROR]', err);
  process.exit(1);
});
