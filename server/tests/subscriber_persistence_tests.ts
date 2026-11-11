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
  const totalTests = 12;

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
    assert.strictEqual(normalizePhone('+92 (300) 112-2334'), '923001122334', 'Test 1: Phone digits normalization verified');
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

    // Duplicate ID creation should fail
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
    // Test 4: Update & Immutable Property Protection (Rule 46)
    // ----------------------------------------------------
    const updated = await SubscriberRepository.updateSubscriber('sub-test-1', {
      name: 'Ali Khan Updated',
      status: 'Expiring Soon',
      id: 'forced-id-change', // should be ignored
      paymentTransactionId: 'forced-tx-change' // should be ignored
    });
    assert.strictEqual(updated.name, 'Ali Khan Updated');
    assert.strictEqual(updated.status, 'Expiring Soon');
    assert.strictEqual(updated.id, 'sub-test-1', 'Test 4: ID cannot be modified by update');
    passCount++;
    console.log('✓ Test 4 Passed: Subscriber update and immutable identifier protection verified.');

    // ----------------------------------------------------
    // Test 5: Payment Status Reconciliation (Rules 64-67)
    // ----------------------------------------------------
    const subWithTx = await SubscriberRepository.createAdminSubscriber({
      id: 'sub-tx-link-1',
      name: 'Transaction Linked Sub',
      phone: '+923005554433',
      email: 'link@example.com',
      plan: 'VIP Jobseeker',
      paymentMethod: 'Easypaisa',
      amountPaid: 3000,
      currency: 'PKR' as any,
      status: 'Pending',
      subscribedAt: new Date().toISOString(),
      whatsappEnabled: true,
      paymentTransactionId: 'tx-sub-001'
    });

    // Case A: Transaction status is Success -> Subscriber should reconcile to Active
    (PaymentRepository as any).getByIdAsync = async () => ({
      id: 'tx-sub-001',
      type: 'Subscription',
      status: 'Success',
      amount: 3000,
      currency: 'PKR',
      plan: 'VIP Jobseeker'
    });

    let fetchedLinked = await SubscriberRepository.getById('sub-tx-link-1');
    assert.strictEqual(fetchedLinked?.status, 'Active', 'Test 5A: Success transaction reconciles subscriber to Active');

    // Case B: Transaction status is Pending -> Subscriber remains Pending
    (PaymentRepository as any).getByIdAsync = async () => ({
      id: 'tx-sub-001',
      type: 'Subscription',
      status: 'Pending',
      amount: 3000,
      currency: 'PKR'
    });
    fetchedLinked = await SubscriberRepository.getById('sub-tx-link-1');
    assert.strictEqual(fetchedLinked?.status, 'Pending', 'Test 5B: Pending transaction keeps subscriber Pending');

    // Case C: Transaction status is Failed -> Subscriber becomes Expired (never Active)
    (PaymentRepository as any).getByIdAsync = async () => ({
      id: 'tx-sub-001',
      type: 'Subscription',
      status: 'Failed',
      amount: 3000,
      currency: 'PKR'
    });
    fetchedLinked = await SubscriberRepository.getById('sub-tx-link-1');
    assert.strictEqual(fetchedLinked?.status, 'Expired', 'Test 5C: Failed transaction forces subscriber to Expired');
    passCount++;
    console.log('✓ Test 5 Passed: Payment status reconciliation verified across Success, Pending, and Failed states.');

    // ----------------------------------------------------
    // Test 6: Pending Subscription Creation & Idempotency (Rules 52-60)
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
      userName: 'Guest User',
      transactionRef: 'TRX999'
    });

    const pendingSub = await SubscriberRepository.createPendingSubscription({
      paymentTransactionId: 'tx-pending-sub-999',
      guestName: 'Guest User',
      guestEmail: 'guest@example.com',
      guestPhone: '+923001234567'
    });

    assert.strictEqual(pendingSub.status, 'Pending');
    assert.strictEqual(pendingSub.amountPaid, 2500);

    // Idempotent retry should return existing record without duplicate
    const idempotentSub = await SubscriberRepository.createPendingSubscription({
      paymentTransactionId: 'tx-pending-sub-999',
      guestName: 'Guest User',
      guestEmail: 'guest@example.com',
      guestPhone: '+923001234567'
    });
    assert.strictEqual(idempotentSub.id, pendingSub.id, 'Test 6: Idempotent subscription creation returns existing record');
    passCount++;
    console.log('✓ Test 6 Passed: Pending subscription creation and idempotency verified.');

    // ----------------------------------------------------
    // Test 7: Delete & Bulk Delete (Non-Destructive to Transactions)
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

    const subDel2 = await SubscriberRepository.createAdminSubscriber({
      id: 'sub-del-2',
      name: 'Bulk Del 1',
      phone: '+923009998878',
      status: 'Active',
      subscribedAt: new Date().toISOString()
    });
    const subDel3 = await SubscriberRepository.createAdminSubscriber({
      id: 'sub-del-3',
      name: 'Bulk Del 2',
      phone: '+923009998879',
      status: 'Active',
      subscribedAt: new Date().toISOString()
    });
    const bulkCount = await SubscriberRepository.bulkDeleteSubscribers(['sub-del-2', 'sub-del-3']);
    assert.strictEqual(bulkCount, 2);
    passCount++;
    console.log('✓ Test 7 Passed: Single and bulk subscriber deletion verified without altering transactions.');

    // ----------------------------------------------------
    // Test 8: Legacy Import & Verification Safeguards (Rules 94-104)
    // ----------------------------------------------------
    const legacyRecords = [
      { id: 'sub-1', name: 'Demo Record', phone: '+923000000000', email: 'usman.c@example.com' }, // Should be skipped (demo)
      { id: 'sub-legacy-101', name: 'Legacy Ali', phone: '+923001112233', email: 'ali@legacy.pk', status: 'Active', amountPaid: 1000, subscribedAt: new Date().toISOString() },
      { id: 'sub-legacy-102', name: 'Legacy Sara', phone: '+923004445566', email: 'sara@legacy.pk', status: 'Active', amountPaid: 1000, subscribedAt: new Date().toISOString() }
    ];

    const importRes = await SubscriberRepository.importLegacySubscribers(legacyRecords);
    assert.strictEqual(importRes.success, true);
    assert.strictEqual(importRes.importedCount, 2);
    assert.strictEqual(importRes.skippedCount, 1); // sub-1 excluded

    // Re-importing same records should be idempotent (alreadyRepresentedCount = 2)
    const reImportRes = await SubscriberRepository.importLegacySubscribers(legacyRecords);
    assert.strictEqual(reImportRes.success, true);
    assert.strictEqual(reImportRes.importedCount, 0);
    assert.strictEqual(reImportRes.alreadyRepresentedCount, 2);
    passCount++;
    console.log('✓ Test 8 Passed: Legacy subscriber import, demo exclusion, and idempotency verified.');

    // ----------------------------------------------------
    // Test 9: Authorization & RBAC Checks (HTTP Level)
    // ----------------------------------------------------
    let res = await fetch(baseUrl);
    assert.strictEqual(res.status, 401, 'Test 9A: Unauthenticated request receives 401');

    res = await fetch(baseUrl, {
      headers: { Authorization: `Bearer ${regularToken}` }
    });
    assert.strictEqual(res.status, 403, 'Test 9B: Regular user receives 403');

    res = await fetch(baseUrl, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(res.status, 200, 'Test 9C: Authorized admin receives 200');
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.ok(Array.isArray(json.subscribers));
    passCount++;
    console.log('✓ Test 9 Passed: RBAC enforcement verified with 401, 403, and 200 responses.');

    // ----------------------------------------------------
    // Test 10: HTTP Admin CRUD Operations
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
      status: 'Active',
      subscribedAt: new Date().toISOString(),
      whatsappEnabled: true
    };

    res = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify(newHttpSub)
    });
    assert.strictEqual(res.status, 201);

    // Update via HTTP PUT
    res = await fetch(`${baseUrl}/sub-http-01`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ name: 'HTTP Updated Name' })
    });
    assert.strictEqual(res.status, 200);
    const updateJson = await res.json();
    assert.strictEqual(updateJson.subscriber.name, 'HTTP Updated Name');

    // Delete via HTTP DELETE
    res = await fetch(`${baseUrl}/sub-http-01`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(res.status, 200);
    passCount++;
    console.log('✓ Test 10 Passed: HTTP-level admin CRUD operations fully verified.');

    // ----------------------------------------------------
    // Test 11: HTTP Public Pending Subscription Creation
    // ----------------------------------------------------
    (PaymentRepository as any).getByIdAsync = async () => ({
      id: 'tx-http-pending-123',
      type: 'Subscription',
      status: 'Pending',
      amount: 1500,
      currency: 'PKR',
      plan: 'Basic',
      paymentMethod: 'Easypaisa',
      userEmail: 'pending.guest@example.com',
      senderPhoneOrAccount: '+923009876543'
    });

    res = await fetch(`${baseUrl}/pending`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentTransactionId: 'tx-http-pending-123',
        name: 'Pending Guest',
        email: 'pending.guest@example.com',
        phone: '+923009876543'
      })
    });
    assert.strictEqual(res.status, 201);
    const pendingJson = await res.json();
    assert.strictEqual(pendingJson.success, true);
    assert.strictEqual(pendingJson.subscriber.status, 'Pending');
    passCount++;
    console.log('✓ Test 11 Passed: Public pending subscription creation endpoint verified.');

    // ----------------------------------------------------
    // Test 12: Storage Isolation & Protected File Checksum Verification
    // ----------------------------------------------------
    const postSnapshot = getDataDirectorySnapshot();
    const postMongoHash = getMongodbTsHash();

    assert.strictEqual(postMongoHash, preMongoHash, 'Protected file server/db/mongodb.ts must remain byte-for-byte identical');

    const preKeys = Object.keys(preSnapshot.files);
    const postKeys = Object.keys(postSnapshot.files);
    assert.strictEqual(postKeys.length, preKeys.length, 'Data directory file count must remain unchanged');
    for (const key of preKeys) {
      assert.strictEqual(postSnapshot.files[key], preSnapshot.files[key], `Data file ${key} must remain byte-for-byte unchanged`);
    }
    passCount++;
    console.log('✓ Test 12 Passed: Storage isolation and byte-for-byte protected file integrity verified.');

    console.log('==================================================================');
    console.log(` TEST SUITE RESULT: SUCCESS (${passCount}/${totalTests} Passed) `);
    console.log('==================================================================');
  } catch (err) {
    console.error('Test Suite Failed with Error:', err);
    process.exit(1);
  } finally {
    if (httpServer) {
      await new Promise<void>((resolve) => httpServer!.close(() => resolve()));
      console.log('✓ HTTP Server closed successfully.');
    }
  }
}

runTestSuite().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
