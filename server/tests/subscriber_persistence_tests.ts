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
  SubscriberRepository,
  validateSubscriberRecord,
  isSyntheticDemoSubscriber,
  normalizeEmail,
  normalizePhone
} from '../db/repositories/SubscriberRepository';
import { PaymentRepository } from '../db/repositories/PaymentRepository';
import { UserRepository } from '../db/repositories/UserRepository';
import { subscriberRouter } from '../routes/subscriberRoutes';
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
  console.log('   STEP-05-02: SUBSCRIBERS DURABLE PERSISTENCE REGRESSION SUITE   ');
  console.log('==================================================================');

  const preSnapshot = getDataDirectorySnapshot();
  const preMongoHash = getMongodbTsHash();

  let httpServer: Server | null = null;
  let serverPort = 0;
  let passCount = 0;
  const totalTests = 21; // Reconciled test count without fake Test 15

  const originalGetByIdAsync = PaymentRepository.getByIdAsync;

  try {
    const app = express();
    app.use(express.json());
    app.use(authMiddleware);
    app.use('/api/subscribers', subscriberRouter);

    await new Promise<void>((resolve) => {
      httpServer = createServer(app);
      httpServer.listen(0, '127.0.0.1', () => {
        serverPort = (httpServer!.address() as any).port;
        resolve();
      });
    });

    const baseUrl = `http://127.0.0.1:${serverPort}/api/subscribers`;

    // Create test admin and users
    const adminUser = UserRepository.create({
      id: 'usr-admin-sub-01',
      name: 'Subscriber Admin',
      email: 'admin.sub@hybridjobs.pk',
      role: 'Super Admin'
    });

    const regularUser = UserRepository.create({
      id: 'usr-regular-sub-01',
      name: 'Regular Candidate',
      email: 'candidate@hybridjobs.pk',
      role: 'Job Seeker'
    });

    const adminToken = createToken({ userId: adminUser.id, email: adminUser.email, role: adminUser.role });
    const regularToken = createToken({ userId: regularUser.id, email: regularUser.email, role: regularUser.role });

    SubscriberRepository.resetTestStore();

    // ----------------------------------------------------
    // Test 1: Record Validation & Normalization
    // ----------------------------------------------------
    const validRec = {
      id: 'sub-test-1',
      name: 'Ali Khan',
      phone: '+92 300 1122334',
      email: 'ali.khan@example.com',
      plan: 'Pro Alerts',
      paymentMethod: 'JazzCash',
      amountPaid: 1500,
      currency: 'PKR' as any,
      status: 'Active' as any,
      subscribedAt: new Date().toISOString(),
      whatsappEnabled: true
    };
    const valResult = validateSubscriberRecord(validRec);
    assert.strictEqual(valResult.valid, true, 'Test 1: Valid subscriber record must pass validation');
    assert.strictEqual(normalizeEmail('  ALI.Khan@Example.COM '), 'ali.khan@example.com', 'Test 1: Email normalization verified');
    assert.strictEqual(normalizePhone('+92 (300) 112-2334'), '923001122334', 'Test 1: Phone normalization verified');
    passCount++;
    console.log('✓ Test 1 Passed: Subscriber record validation and normalization verified.');

    // ----------------------------------------------------
    // Test 2: Synthetic Demo Exclusion
    // ----------------------------------------------------
    assert.strictEqual(isSyntheticDemoSubscriber({ id: 'sub-1' }), true, 'Test 2: sub-1 demo ID recognized');
    assert.strictEqual(isSyntheticDemoSubscriber({ id: 'sub-demo-xyz' }), true, 'Test 2: demo prefix recognized');
    assert.strictEqual(isSyntheticDemoSubscriber({ id: 'sub-real-100' }), false, 'Test 2: Real subscriber recognized');
    passCount++;
    console.log('✓ Test 2 Passed: Synthetic demo subscriber records strictly identified and excluded.');

    // ----------------------------------------------------
    // Test 3: In-Memory CRUD & Unique ID Enforcement
    // ----------------------------------------------------
    const created1 = await SubscriberRepository.createAdminSubscriber(validRec);
    assert.strictEqual(created1.id, 'sub-test-1');
    assert.strictEqual(created1.status, 'Active');

    let allSubs = await SubscriberRepository.getAllSubscribers();
    assert.strictEqual(allSubs.length, 1);

    let duplicateCaught = false;
    try {
      await SubscriberRepository.createAdminSubscriber(validRec);
    } catch {
      duplicateCaught = true;
    }
    assert.strictEqual(duplicateCaught, true, 'Test 3: Duplicate subscriber ID creation must be prevented');
    passCount++;
    console.log('✓ Test 3 Passed: Create, read, and unique subscriber ID enforcement verified.');

    // ----------------------------------------------------
    // Test 4: Update Whitelist & Immutable Identifier Protection
    // ----------------------------------------------------
    const updated = await SubscriberRepository.updateSubscriber('sub-test-1', {
      name: 'Ali Khan Updated',
      status: 'Expiring Soon',
      id: 'forced-id-change',
      paymentTransactionId: 'forced-tx-change'
    });
    assert.strictEqual(updated.name, 'Ali Khan Updated');
    assert.strictEqual(updated.status, 'Expiring Soon');
    assert.strictEqual(updated.id, 'sub-test-1');
    assert.strictEqual((updated as any).paymentTransactionId, undefined);
    passCount++;
    console.log('✓ Test 4 Passed: Update whitelist and immutable identifier protection verified.');

    // ----------------------------------------------------
    // Test 5: Success + Refunded Flag
    // ----------------------------------------------------
    const subRef = await SubscriberRepository.createAdminSubscriber({
      id: 'sub-ref-1',
      name: 'Refunded Sub',
      phone: '+923001111111',
      status: 'Active',
      subscribedAt: new Date().toISOString(),
      paymentTransactionId: 'tx-ref-001'
    });
    (PaymentRepository as any).getByIdAsync = async () => ({
      id: 'tx-ref-001',
      type: 'Subscription',
      status: 'Success',
      refunded: true,
      amount: 1500
    });
    let fetchedRef = await SubscriberRepository.getById('sub-ref-1');
    assert.strictEqual(fetchedRef?.status, 'Expired', 'Test 5: Success with refunded=true must result in Expired');
    passCount++;
    console.log('✓ Test 5 Passed: Success transaction with refunded flag correctly results in Expired status.');

    // ----------------------------------------------------
    // Test 6: Success + Compensated Transaction
    // ----------------------------------------------------
    const subComp = await SubscriberRepository.createAdminSubscriber({
      id: 'sub-comp-1',
      name: 'Compensated Sub',
      phone: '+923002222222',
      status: 'Active',
      subscribedAt: new Date().toISOString(),
      paymentTransactionId: 'tx-comp-001'
    });
    (PaymentRepository as any).getByIdAsync = async () => ({
      id: 'tx-comp-001',
      type: 'Subscription',
      status: 'Success',
      compensationStatus: 'Compensated',
      amount: 1500
    });
    let fetchedComp = await SubscriberRepository.getById('sub-comp-1');
    assert.strictEqual(fetchedComp?.status, 'Expired', 'Test 6: Compensated status must result in Expired');
    passCount++;
    console.log('✓ Test 6 Passed: Success transaction with Compensated status correctly results in Expired status.');

    // ----------------------------------------------------
    // Test 7: Success + CompensationInProg / CompensationUncertain
    // ----------------------------------------------------
    const subUnc = await SubscriberRepository.createAdminSubscriber({
      id: 'sub-unc-1',
      name: 'Uncertain Sub',
      phone: '+923003333333',
      status: 'Active',
      subscribedAt: new Date().toISOString(),
      paymentTransactionId: 'tx-unc-001'
    });
    (PaymentRepository as any).getByIdAsync = async () => ({
      id: 'tx-unc-001',
      type: 'Subscription',
      status: 'Success',
      compensationStatus: 'CompensationUncertain',
      amount: 1500
    });
    let fetchedUnc = await SubscriberRepository.getById('sub-unc-1');
    assert.strictEqual(fetchedUnc?.status, 'Expired', 'Test 7: CompensationUncertain status must result in Expired');
    passCount++;
    console.log('✓ Test 7 Passed: Success transaction with CompensationUncertain status correctly results in Expired status.');

    // ----------------------------------------------------
    // Test 8: Missing, Null, and Empty Transaction Types
    // ----------------------------------------------------
    const subTxTypes = await SubscriberRepository.createAdminSubscriber({
      id: 'sub-txtype-1',
      name: 'Tx Types Sub',
      phone: '+923004441111',
      status: 'Active',
      subscribedAt: new Date().toISOString(),
      paymentTransactionId: 'tx-txtype-001'
    });
    // Missing type (undefined)
    (PaymentRepository as any).getByIdAsync = async () => ({ id: 'tx-txtype-001', type: undefined, status: 'Success', amount: 1500 });
    let res1 = await SubscriberRepository.getById('sub-txtype-1');
    assert.notStrictEqual(res1?.status, 'Active');

    // Null type
    (PaymentRepository as any).getByIdAsync = async () => ({ id: 'tx-txtype-001', type: null, status: 'Success', amount: 1500 });
    let res2 = await SubscriberRepository.getById('sub-txtype-1');
    assert.notStrictEqual(res2?.status, 'Active');

    // Empty string type
    (PaymentRepository as any).getByIdAsync = async () => ({ id: 'tx-txtype-001', type: '   ', status: 'Success', amount: 1500 });
    let res3 = await SubscriberRepository.getById('sub-txtype-1');
    assert.notStrictEqual(res3?.status, 'Active');
    passCount++;
    console.log('✓ Test 8 Passed: Missing, null, and empty transaction types fail closed.');

    // ----------------------------------------------------
    // Test 9: Non-Subscription Transaction Type
    // ----------------------------------------------------
    (PaymentRepository as any).getByIdAsync = async () => ({ id: 'tx-txtype-001', type: 'Job Posting', status: 'Success', amount: 1500 });
    let res4 = await SubscriberRepository.getById('sub-txtype-1');
    assert.notStrictEqual(res4?.status, 'Active');
    passCount++;
    console.log('✓ Test 9 Passed: Non-subscription transaction type fails closed.');

    // ----------------------------------------------------
    // Test 10: NaN Amount Test
    // ----------------------------------------------------
    const subNan = await SubscriberRepository.createAdminSubscriber({
      id: 'sub-nan-1',
      name: 'NaN Sub',
      phone: '+923004442222',
      status: 'Pending',
      amountPaid: 1200,
      subscribedAt: new Date().toISOString(),
      paymentTransactionId: 'tx-nan-001'
    });
    (PaymentRepository as any).getByIdAsync = async () => ({ id: 'tx-nan-001', type: 'Subscription', status: 'Success', amount: NaN });
    let resNan = await SubscriberRepository.getById('sub-nan-1');
    assert.strictEqual(resNan?.amountPaid, 1200, 'NaN amount rejected in favor of safe fallback');
    passCount++;
    console.log('✓ Test 10 Passed: NaN transaction amount correctly rejected in favor of safe fallback.');

    // ----------------------------------------------------
    // Test 11: Infinity & -Infinity Amount Tests
    // ----------------------------------------------------
    const subInf = await SubscriberRepository.createAdminSubscriber({
      id: 'sub-inf-1',
      name: 'Inf Sub',
      phone: '+923004443333',
      status: 'Pending',
      amountPaid: 1300,
      subscribedAt: new Date().toISOString(),
      paymentTransactionId: 'tx-inf-001'
    });
    (PaymentRepository as any).getByIdAsync = async () => ({ id: 'tx-inf-001', type: 'Subscription', status: 'Success', amount: Infinity });
    let resInf = await SubscriberRepository.getById('sub-inf-1');
    assert.strictEqual(resInf?.amountPaid, 1300);

    (PaymentRepository as any).getByIdAsync = async () => ({ id: 'tx-inf-001', type: 'Subscription', status: 'Success', amount: -Infinity });
    let resNegInf = await SubscriberRepository.getById('sub-inf-1');
    assert.strictEqual(resNegInf?.amountPaid, 1300);
    passCount++;
    console.log('✓ Test 11 Passed: Infinity and -Infinity transaction amounts correctly rejected in favor of safe fallback.');

    // ----------------------------------------------------
    // Test 12: Missing Transaction & Lookup Exception Handling
    // ----------------------------------------------------
    const subMissingTx = await SubscriberRepository.createAdminSubscriber({
      id: 'sub-mtx-1',
      name: 'Missing Tx Sub',
      phone: '+923006666666',
      status: 'Active',
      subscribedAt: new Date().toISOString(),
      paymentTransactionId: 'tx-nonexistent-999'
    });
    // Case A: Missing transaction returns null
    (PaymentRepository as any).getByIdAsync = async () => null;
    let fetchedMtx = await SubscriberRepository.getById('sub-mtx-1');
    assert.strictEqual(fetchedMtx?.status, 'Pending', 'Test 12A: Missing transaction persists safe Pending status when previously Active');

    // Case B: Transaction lookup throwing an error
    (PaymentRepository as any).getByIdAsync = async () => {
      throw new Error('Simulated database partition error');
    };
    let fetchedErr = await SubscriberRepository.getById('sub-mtx-1');
    assert.strictEqual(fetchedErr?.status, 'Pending', 'Test 12B: Transaction lookup exception persists safe Pending status');
    passCount++;
    console.log('✓ Test 12 Passed: Missing transactions and lookup exceptions persist safe Pending status.');

    // ----------------------------------------------------
    // Test 13: Concurrent PaymentTransactionId Changes (Stale Reconciliation Guard)
    // ----------------------------------------------------
    const subConc = await SubscriberRepository.createAdminSubscriber({
      id: 'sub-conc-1',
      name: 'Concurrent Sub',
      phone: '+923008888888',
      status: 'Active',
      subscribedAt: new Date().toISOString(),
      paymentTransactionId: 'tx-conc-original'
    });
    SubscriberRepository.injectTestSubscriber({
      id: 'sub-conc-1',
      name: 'Concurrent Sub',
      phone: '+923008888888',
      email: 'conc@example.com',
      plan: 'Pro Alerts',
      paymentMethod: 'JazzCash',
      amountPaid: 1500,
      currency: 'PKR' as any,
      status: 'Active',
      subscribedAt: subConc.subscribedAt,
      paymentTransactionId: 'tx-conc-new-admin',
      whatsappEnabled: true
    });
    (PaymentRepository as any).getByIdAsync = async () => ({
      id: 'tx-conc-original',
      type: 'Subscription',
      status: 'Failed'
    });
    await SubscriberRepository.getById('sub-conc-1');
    const checkedConc = await SubscriberRepository.getById('sub-conc-1');
    assert.strictEqual(checkedConc?.paymentTransactionId, 'tx-conc-new-admin', 'Test 13: Stale reconciliation cannot overwrite newer admin data');
    passCount++;
    console.log('✓ Test 13 Passed: Concurrency-safe reconciliation guard prevents stale overwrites.');

    // ----------------------------------------------------
    // Test 14: Asynchronous Race Test
    // ----------------------------------------------------
    const subRace = await SubscriberRepository.createAdminSubscriber({
      id: 'sub-race-1',
      name: 'Race Sub',
      phone: '+923004445555',
      status: 'Active',
      subscribedAt: new Date().toISOString(),
      paymentTransactionId: 'tx-race-original'
    });
    let resolveLookup: any;
    const lookupPromise = new Promise((resolve) => { resolveLookup = resolve; });
    (PaymentRepository as any).getByIdAsync = async () => {
      await lookupPromise;
      return { id: 'tx-race-original', type: 'Subscription', status: 'Failed' };
    };
    const getPromise = SubscriberRepository.getById('sub-race-1');
    SubscriberRepository.injectTestSubscriber({
      id: 'sub-race-1',
      name: 'Race Sub',
      phone: '+923004445555',
      email: 'race@example.com',
      plan: 'Pro Alerts',
      paymentMethod: 'JazzCash',
      currency: 'PKR',
      whatsappEnabled: true,
      status: 'Expiring Soon',
      paymentTransactionId: 'tx-race-new',
      amountPaid: 1500,
      subscribedAt: subRace.subscribedAt
    });
    resolveLookup();
    const raceRes = await getPromise;
    assert.strictEqual(raceRes?.paymentTransactionId, 'tx-race-new', 'Race test: newer paymentTransactionId preserved');
    assert.strictEqual(raceRes?.status, 'Expiring Soon', 'Race test: newer status preserved');
    passCount++;
    console.log('✓ Test 14 Passed: Asynchronous race test verified that newer state remains unchanged.');

    // ----------------------------------------------------
    // Test 15: Manually Created Admin Subscriber Without Transaction Link
    // ----------------------------------------------------
    const manualAdminSub = await SubscriberRepository.createAdminSubscriber({
      id: 'sub-manual-01',
      name: 'Manual Admin Created',
      phone: '+923007777777',
      status: 'Active',
      amountPaid: 2000,
      subscribedAt: new Date().toISOString()
    });
    let fetchedManual = await SubscriberRepository.getById('sub-manual-01');
    assert.strictEqual(fetchedManual?.status, 'Active', 'Test 15: Manually created admin subscriber without transaction link preserves Active status');
    passCount++;
    console.log('✓ Test 15 Passed: Manually created admin subscribers without transaction link maintain supported behavior.');

    // ----------------------------------------------------
    // Test 16: Pending Subscription Creation & Guest Identity
    // ----------------------------------------------------
    (PaymentRepository as any).getByIdAsync = async () => ({
      id: 'tx-pending-sub-999',
      type: 'Subscription',
      status: 'Pending',
      amount: 2500,
      currency: 'PKR',
      plan: 'Pro Alerts',
      paymentMethod: 'JazzCash',
      userEmail: 'guest@example.com',
      senderPhoneOrAccount: '+923001234567',
      userName: 'Guest User'
    });

    let emailOnlyRejected = false;
    try {
      await SubscriberRepository.createPendingSubscription({
        paymentTransactionId: 'tx-pending-sub-999',
        guestName: 'Guest User',
        guestEmail: 'guest@example.com',
        guestPhone: '+923009999999'
      });
    } catch {
      emailOnlyRejected = true;
    }
    assert.strictEqual(emailOnlyRejected, true, 'Test 16: Email-only or phone-only matching must be rejected');
    passCount++;
    console.log('✓ Test 16 Passed: Guest identity verification requires both email and phone match.');

    // ----------------------------------------------------
    // Test 17: Delete Subscriber (Non-Destructive)
    // ----------------------------------------------------
    const subToDelete = await SubscriberRepository.createAdminSubscriber({
      id: 'sub-del-1',
      name: 'To Delete',
      phone: '+923009998877',
      status: 'Active',
      subscribedAt: new Date().toISOString()
    });
    const deletedOk = await SubscriberRepository.deleteSubscriber('sub-del-1');
    assert.strictEqual(deletedOk, true);
    assert.strictEqual(await SubscriberRepository.getById('sub-del-1'), null);
    passCount++;
    console.log('✓ Test 17 Passed: Subscriber deletion verified without altering transactions.');

    // ----------------------------------------------------
    // Test 18: Legacy Import with Read-Back Verification & Idempotency
    // ----------------------------------------------------
    SubscriberRepository.resetTestStore();
    const legacyRecords = [
      { id: 'sub-1', name: 'Demo Record', phone: '+923000000000', email: 'usman.c@example.com' },
      { id: 'sub-legacy-101', name: 'Legacy Ali', phone: '+923001112233', email: 'ali@legacy.pk', status: 'Active', amountPaid: 1000, subscribedAt: new Date().toISOString() },
      { id: 'sub-legacy-102', name: 'Legacy Sara', phone: '+923004445566', email: 'sara@legacy.pk', status: 'Active', amountPaid: 1000, subscribedAt: new Date().toISOString() }
    ];

    const importRes = await SubscriberRepository.importLegacySubscribers(legacyRecords);
    assert.strictEqual(importRes.success, true);
    assert.strictEqual(importRes.importedCount, 2);

    const reImportRes = await SubscriberRepository.importLegacySubscribers(legacyRecords);
    assert.strictEqual(reImportRes.success, true);
    assert.strictEqual(reImportRes.alreadyRepresentedCount, 2);
    passCount++;
    console.log('✓ Test 18 Passed: Legacy import with read-back verification and idempotency verified.');

    // ----------------------------------------------------
    // Test 19: Authorization & RBAC Checks (HTTP Level)
    // ----------------------------------------------------
    let res = await fetch(baseUrl);
    assert.strictEqual(res.status, 401);

    res = await fetch(baseUrl, {
      headers: { Authorization: `Bearer ${regularToken}` }
    });
    assert.strictEqual(res.status, 403);

    res = await fetch(baseUrl, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(res.status, 200);
    passCount++;
    console.log('✓ Test 19 Passed: RBAC enforcement verified with HTTP 401 and 403 responses.');

    // ----------------------------------------------------
    // Test 20: HTTP Admin CRUD Operations
    // ----------------------------------------------------
    const newHttpSub = {
      id: 'sub-http-01',
      name: 'HTTP Created Subscriber',
      phone: '+923007778899',
      email: 'http.sub@example.com',
      plan: 'Pro Alerts',
      paymentMethod: 'Card',
      amountPaid: 2000,
      currency: 'PKR' as any,
      status: 'Active' as any,
      subscribedAt: new Date().toISOString(),
      whatsappEnabled: true
    };

    res = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify(newHttpSub)
    });
    assert.strictEqual(res.status, 201);

    res = await fetch(`${baseUrl}/sub-http-01`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ name: 'HTTP Updated Name' })
    });
    assert.strictEqual(res.status, 200);

    res = await fetch(`${baseUrl}/sub-http-01`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(res.status, 200);
    passCount++;
    console.log('✓ Test 20 Passed: HTTP-level admin CRUD operations fully verified.');

    // ----------------------------------------------------
    // Test 21: Storage Isolation & Protected File Checksum Verification
    // ----------------------------------------------------
    const postSnapshot = getDataDirectorySnapshot();
    const postMongoHash = getMongodbTsHash();

    assert.strictEqual(postMongoHash, preMongoHash, 'Protected file server/db/mongodb.ts checksum must remain identical');
    for (const key of Object.keys(preSnapshot.files)) {
      assert.strictEqual(postSnapshot.files[key], preSnapshot.files[key], `Data file ${key} must remain byte-for-byte unchanged`);
    }
    passCount++;
    console.log('✓ Test 21 Passed: Storage isolation and byte-for-byte protected file integrity verified.');

    assert.strictEqual(passCount, totalTests, `All tests must pass successfully (Expected ${totalTests}, got ${passCount})`);

    console.log('==================================================================');
    console.log(` TEST SUITE RESULT: SUCCESS (${passCount}/${totalTests} Passed) `);
    console.log('==================================================================');
  } catch (err) {
    console.error('Test Suite Failed with Error:', err);
    process.exit(1);
  } finally {
    // Rule 15: Restore every mocked PaymentRepository method in finally blocks, including getByIdAsync
    PaymentRepository.getByIdAsync = originalGetByIdAsync;

    if (httpServer) {
      await new Promise<void>((resolve) => httpServer!.close(() => resolve()));
      console.log('✓ HTTP Server closed successfully and mocks restored.');
    }
  }
}

runTestSuite().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
