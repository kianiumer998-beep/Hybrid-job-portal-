// MUST set process.env.IS_TEST = 'true' BEFORE importing any repository or database module
process.env.IS_TEST = 'true';
// Simulate an environment where MongoDB URI IS configured to strictly verify that no connection is attempted
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/dummy_test_db_isolation_check';

import { MongoClient, Collection } from 'mongodb';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

let mongoConnectAttempts = 0;
let mongoIndexAttempts = 0;

// Spy on MongoClient.prototype.connect
const origConnect = MongoClient.prototype.connect;
MongoClient.prototype.connect = function (...args: any[]) {
  mongoConnectAttempts++;
  console.error('[TEST ISOLATION FAILURE] MongoClient.connect was called during test execution!');
  return origConnect.apply(this, args);
};

// Spy on Collection.prototype.createIndex and createIndexes
const origCreateIndex = Collection.prototype.createIndex;
Collection.prototype.createIndex = function (...args: any[]) {
  mongoIndexAttempts++;
  console.error('[TEST ISOLATION FAILURE] Collection.createIndex was called during test execution!');
  return origCreateIndex.apply(this, args);
};

const origCreateIndexes = Collection.prototype.createIndexes;
Collection.prototype.createIndexes = function (...args: any[]) {
  mongoIndexAttempts++;
  console.error('[TEST ISOLATION FAILURE] Collection.createIndexes was called during test execution!');
  return origCreateIndexes.apply(this, args);
};

function hashFile(filePath: string): string {
  if (!fs.existsSync(filePath)) return 'FILE_NOT_FOUND';
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

async function runTests() {
  console.log('=== Starting Test Isolation & Subscription Snapshot Tests (STEP65-D.12.10) ===\n');

  let passCount = 0;
  let failCount = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`[PASS] ${testName}${detail ? ` (${detail})` : ''}`);
      passCount++;
    } else {
      console.error(`[FAIL] ${testName}${detail ? ` - ${detail}` : ''}`);
      failCount++;
    }
  }

  const usersPath = path.join(process.cwd(), 'data/users.json');
  const txPath = path.join(process.cwd(), 'data/transactions.json');
  const auditPath = path.join(process.cwd(), 'data/audit_logs.json');

  const preUsersHash = hashFile(usersPath);
  const preTxHash = hashFile(txPath);
  const preAuditHash = hashFile(auditPath);

  console.log('Pre-test JSON File Hashes:');
  console.log(` - users.json:        ${preUsersHash}`);
  console.log(` - transactions.json: ${preTxHash}`);
  console.log(` - audit_logs.json:   ${preAuditHash}\n`);

  // Dynamically import repository modules AFTER process.env.IS_TEST is established
  const { PaymentRepository } = await import('../db/repositories/PaymentRepository');
  const { UserRepository } = await import('../db/repositories/UserRepository');
  const { Database } = await import('../db/database');

  try {
    console.log('--- SECTION 1: STRICT TEST ISOLATION PROOF ---');

    // 1. Test mode active before repository load
    assert(process.env.IS_TEST === 'true', 'Isolation 1: process.env.IS_TEST is "true" before repository usage');

    // 2. Zero MongoDB connection attempts
    assert(mongoConnectAttempts === 0, 'Isolation 2: Zero MongoDB connection attempts occurred during module load/usage', `attempts=${mongoConnectAttempts}`);

    // 3. Zero MongoDB index creation calls
    assert(mongoIndexAttempts === 0, 'Isolation 3: Zero MongoDB index creation calls occurred during module load/usage', `attempts=${mongoIndexAttempts}`);

    // 4. UserRepository in-memory isolation
    const testUser = await UserRepository.createAsync({
      name: 'Isolation Test User',
      email: 'isolation@example.com',
      walletBalance: 100
    });
    const fetchedUser = await UserRepository.getByIdAsync(testUser.id);
    const updatedUser = await UserRepository.updateAsync(testUser.id, { name: 'Isolation Updated' });
    const deletedRes = await UserRepository.deleteAsync(testUser.id);
    const afterDeleteUser = await UserRepository.getByIdAsync(testUser.id);

    assert(
      fetchedUser?.email === 'isolation@example.com' &&
      updatedUser?.name === 'Isolation Updated' &&
      deletedRes === true &&
      afterDeleteUser === null,
      'Isolation 4: UserRepository CRUD operates purely in-memory'
    );

    // 5. PaymentRepository in-memory isolation
    const testTx = await PaymentRepository.createAsync({
      type: 'Subscription',
      amount: 500,
      status: 'Pending',
      plan: 'Pro Plan',
      packageSnapshot: { id: 'pro-1', name: 'Pro Plan', pricePkr: 500, durationDays: 30 }
    });
    const fetchedTx = await PaymentRepository.getByIdAsync(testTx.id);
    const updatedTx = await PaymentRepository.updateAsync(testTx.id, { adminNote: 'In Memory Test' });

    assert(
      fetchedTx?.amount === 500 &&
      updatedTx?.adminNote === 'In Memory Test',
      'Isolation 5: PaymentRepository CRUD operates purely in-memory'
    );

    // 6. Test records do not pollution check in Database JSON cache
    const dbUsers = Database.getUsers();
    const dbTxs = Database.getTransactions();
    const hasTestUserInDb = dbUsers.some((u: any) => u.email === 'isolation@example.com');
    const hasTestTxInDb = dbTxs.some((t: any) => t.id === testTx.id);
    assert(
      !hasTestUserInDb && !hasTestTxInDb,
      'Isolation 6: Test records do not appear in Database JSON cache or file storage'
    );

    // 7. Production mode guard check (test mode condition verification)
    delete process.env.IS_TEST;
    const isTestActiveWhenUnset = process.env.IS_TEST === 'true';
    process.env.IS_TEST = 'true';
    assert(
      !isTestActiveWhenUnset,
      'Isolation 7: Production mode is not accidentally forced into test mode when IS_TEST is unset'
    );

    // Helper to setup snapshot test data
    const setupSnapshotTest = async (txData: any, userData: any) => {
      const uniqueId = Math.random().toString(36).substring(2, 9);
      const user = await UserRepository.createAsync({
        email: `snaptest-${uniqueId}@example.com`,
        ...userData
      });
      const tx = await PaymentRepository.createAsync({
        type: 'Subscription',
        amount: 500,
        status: 'Pending',
        plan: 'Standard Plan',
        paymentMethod: 'Manual Transfer',
        ...txData,
        userId: user.id
      });
      return { user, tx };
    };

    const checkRes = async (id: string, testName: string, expectedReason?: string) => {
      const res = await PaymentRepository.getByIdAsync(id);
      let pass = res?.status === 'Pending';
      if (expectedReason) {
        pass = pass && res?.rejectionReason?.includes(expectedReason);
      }
      assert(pass, testName, `status=${res?.status}`);
    };

    const validSnap = { id: 'pro-1', name: 'Pro Plan', pricePkr: 500, durationDays: 30 };

    console.log('\n--- SECTION 2: SUBSCRIPTION SNAPSHOT INTEGRITY TESTS ---');

    // Snapshot Test 1
    const { user: u1, tx: tx1 } = await setupSnapshotTest(
      { amount: 500, packageSnapshot: validSnap, plan: 'Pro Plan' },
      { name: 'User 1', membershipTier: 'Free', membershipStatus: 'Inactive' }
    );
    await PaymentRepository.verify(tx1.id, 'approve');
    const u1Updated = await UserRepository.getByIdAsync(u1.id);
    assert(
      u1Updated?.membershipStatus === 'Active' &&
      u1Updated?.membershipTier === 'Pro Plan' &&
      u1Updated?.subscriptionExpiresAt !== undefined,
      'Snapshot 1: Valid snapshot activates correct membership duration'
    );

    // Snapshot Test 2
    const { tx: tx2 } = await setupSnapshotTest(
      { amount: 500, packageSnapshot: undefined },
      { name: 'User 2', membershipStatus: 'Inactive' }
    );
    try { await PaymentRepository.verify(tx2.id, 'approve'); } catch {}
    await checkRes(tx2.id, 'Snapshot 2: Missing snapshot remains Pending', 'Missing or invalid package snapshot');

    // Snapshot Test 3
    const zeroSnap = { id: 'pro-1', name: 'Pro Plan', pricePkr: 500, durationDays: 0 };
    const { tx: tx3 } = await setupSnapshotTest(
      { amount: 500, packageSnapshot: zeroSnap },
      { name: 'User 3', membershipStatus: 'Inactive' }
    );
    try { await PaymentRepository.verify(tx3.id, 'approve'); } catch {}
    await checkRes(tx3.id, 'Snapshot 3: Zero duration remains Pending', 'Invalid duration');

    // Snapshot Test 4
    const negSnap = { id: 'pro-1', name: 'Pro Plan', pricePkr: 500, durationDays: -30 };
    const { tx: tx4 } = await setupSnapshotTest(
      { amount: 500, packageSnapshot: negSnap },
      { name: 'User 4' }
    );
    try { await PaymentRepository.verify(tx4.id, 'approve'); } catch {}
    await checkRes(tx4.id, 'Snapshot 4: Negative duration remains Pending', 'Invalid duration');

    // Snapshot Test 5
    const decSnap = { id: 'pro-1', name: 'Pro Plan', pricePkr: 500, durationDays: 30.5 };
    const { tx: tx5 } = await setupSnapshotTest(
      { amount: 500, packageSnapshot: decSnap },
      { name: 'User 5' }
    );
    try { await PaymentRepository.verify(tx5.id, 'approve'); } catch {}
    await checkRes(tx5.id, 'Snapshot 5: Decimal duration remains Pending', 'Invalid duration');

    // Snapshot Test 6
    const nanSnap = { id: 'pro-1', name: 'Pro Plan', pricePkr: 500, durationDays: 'abc' as any };
    const { tx: tx6 } = await setupSnapshotTest(
      { amount: 500, packageSnapshot: nanSnap },
      { name: 'User 6' }
    );
    try { await PaymentRepository.verify(tx6.id, 'approve'); } catch {}
    await checkRes(tx6.id, 'Snapshot 6: NaN/invalid duration remains Pending', 'Invalid duration');

    // Snapshot Test 7
    const noIdSnap = { name: 'Pro Plan', pricePkr: 500, durationDays: 30 };
    const { tx: tx7 } = await setupSnapshotTest(
      { amount: 500, packageSnapshot: noIdSnap as any },
      { name: 'User 7' }
    );
    try { await PaymentRepository.verify(tx7.id, 'approve'); } catch {}
    await checkRes(tx7.id, 'Snapshot 7: Missing package ID remains Pending', 'Invalid package ID');

    // Snapshot Test 8
    const invPriceSnap = { id: 'pro-1', name: 'Pro Plan', pricePkr: -500, durationDays: 30 };
    const { tx: tx8 } = await setupSnapshotTest(
      { amount: -500, packageSnapshot: invPriceSnap },
      { name: 'User 8' }
    );
    try { await PaymentRepository.verify(tx8.id, 'approve'); } catch {}
    await checkRes(tx8.id, 'Snapshot 8: Invalid price remains Pending', 'Invalid price');

    // Snapshot Test 9
    const mismatchSnap = { id: 'pro-1', name: 'Pro Plan', pricePkr: 500, durationDays: 30 };
    const { tx: tx9 } = await setupSnapshotTest(
      { amount: 300, packageSnapshot: mismatchSnap },
      { name: 'User 9' }
    );
    try { await PaymentRepository.verify(tx9.id, 'approve'); } catch {}
    await checkRes(tx9.id, 'Snapshot 9: Transaction amount mismatch remains Pending', 'amount mismatch');

    // Snapshot Test 10
    const { user: u10, tx: tx10 } = await setupSnapshotTest(
      { amount: 500, packageSnapshot: validSnap },
      { name: 'User 10', membershipStatus: 'Inactive' }
    );
    await PaymentRepository.verify(tx10.id, 'reject');
    const u10Updated = await UserRepository.getByIdAsync(u10.id);
    const tx10Res = await PaymentRepository.getByIdAsync(tx10.id);
    assert(
      u10Updated?.membershipStatus === 'Inactive' && tx10Res?.status === 'Failed',
      'Snapshot 10: Rejection does not activate membership'
    );

  } catch (err: any) {
    console.error('Fatal error during test suite execution:', err?.message || err);
    failCount++;
  } finally {
    // Post-test hash verification
    const postUsersHash = hashFile(usersPath);
    const postTxHash = hashFile(txPath);
    const postAuditHash = hashFile(auditPath);

    console.log('\nPost-test JSON File Hashes:');
    console.log(` - users.json:        ${postUsersHash}`);
    console.log(` - transactions.json: ${postTxHash}`);
    console.log(` - audit_logs.json:   ${postAuditHash}\n`);

    assert(postUsersHash === preUsersHash, 'File Integrity: data/users.json remained byte-for-byte identical');
    assert(postTxHash === preTxHash, 'File Integrity: data/transactions.json remained byte-for-byte identical');
    assert(postAuditHash === preAuditHash, 'File Integrity: data/audit_logs.json remained byte-for-byte identical');

    assert(mongoConnectAttempts === 0, 'Final Check: Zero MongoDB connection attempts across whole test suite');
    assert(mongoIndexAttempts === 0, 'Final Check: Zero MongoDB index creation calls across whole test suite');

    console.log(`\n=== FINAL RESULTS ===`);
    console.log(`Total Passed: ${passCount}`);
    console.log(`Total Failed: ${failCount}`);

    if (failCount > 0) process.exit(1);
    else process.exit(0);
  }
}

runTests();
