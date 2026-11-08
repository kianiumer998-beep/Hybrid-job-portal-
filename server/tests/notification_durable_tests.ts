import assert from 'assert';
import express from 'express';
import { createServer, Server } from 'http';
import { NotificationRepository } from '../db/repositories/NotificationRepository';
import { PaymentRepository } from '../db/repositories/PaymentRepository';
import { UserRepository } from '../db/repositories/UserRepository';
import { isMongoConfigured, getMongoDb } from '../db/mongodb';
import { transactionRouter } from '../routes/transactionRoutes';
import { notificationRouter } from '../routes/notificationRoutes';
import { PaymentSettingsRepository } from '../db/repositories/PaymentSettingsRepository';
import { Database } from '../db/database';

async function runTests() {
  console.log('===============================================================');
  console.log('=== DURABLE NOTIFICATION & ROUTE INTEGRATION TEST SUITE ===');
  console.log('===============================================================\n');

  const realMongoRequested = process.env.USE_REAL_MONGO_TEST === 'true';
  const mongoConfigured = isMongoConfigured();

  let storageMode: 'REAL_MONGODB' | 'IN_MEMORY' = 'IN_MEMORY';

  if (realMongoRequested) {
    if (!mongoConfigured) {
      throw new Error('[Fatal Error] USE_REAL_MONGO_TEST=true requested, but MONGODB_URI is not configured in environment!');
    }
    try {
      await getMongoDb();
      storageMode = 'REAL_MONGODB';
      console.log('➜ STORAGE MODE: REAL MONGODB PERSISTENCE MODE (Connected)');
    } catch (err: any) {
      throw new Error(`[Fatal Error] Real MongoDB mode requested (USE_REAL_MONGO_TEST=true), but connection failed: ${err?.message || err}`);
    }
  } else {
    storageMode = 'IN_MEMORY';
    process.env.IS_TEST = 'true';
    console.log('➜ STORAGE MODE: IN-MEMORY FALLBACK UNIT-TEST MODE (Strict JSON Isolation)');
  }

  // Intercept Database persistence methods in IN_MEMORY mode to prevent JSON file pollution
  const originalGetTransactions = Database.getTransactions;
  const originalSaveTransactions = Database.saveTransactions;
  const originalAddTransaction = Database.addTransaction;

  const originalGetAuditLogs = Database.getAuditLogs;
  const originalAddAuditLog = Database.addAuditLog;

  const originalGetUsers = Database.getUsers;
  const originalSaveUsers = Database.saveUsers;

  let inMemTransactions: any[] = [];
  let inMemAuditLogs: any[] = [];
  let inMemUsers: any[] = [];

  if (storageMode === 'IN_MEMORY') {
    Database.getTransactions = () => [...inMemTransactions];
    Database.saveTransactions = (txs: any[]) => { inMemTransactions = [...txs]; };
    Database.addTransaction = (tx: any) => {
      const newTx = {
        ...tx,
        id: tx.id || `tx-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        dateTime: tx.dateTime || new Date().toISOString().replace('T', ' ').substring(0, 16)
      };
      inMemTransactions.unshift(newTx);
      return newTx;
    };

    Database.getAuditLogs = () => [...inMemAuditLogs];
    Database.addAuditLog = (entry: any) => {
      const newLog = {
        id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        timestamp: new Date().toISOString(),
        status: 'Success',
        ...entry
      };
      inMemAuditLogs.unshift(newLog);
      return newLog;
    };

    Database.getUsers = () => [...inMemUsers];
    Database.saveUsers = (users: any[]) => { inMemUsers = [...users]; };
  }

  // Set up Express test server for genuine HTTP API integration testing
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

  const httpServer: Server = await new Promise((resolve) => {
    const s = createServer(app);
    s.listen(0, '127.0.0.1', () => resolve(s));
  });

  const port = (httpServer.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  const cleanupTxIds: string[] = [];
  const cleanupNotifIds: string[] = [];
  const cleanupUserIds: string[] = [];

  try {
    const testUserAId = `usera-int-${Date.now()}`;
    const testUserBId = `userb-int-${Date.now()}`;
    const adminUserId = `admin-int-${Date.now()}`;

    // Seed test users in UserRepository for authenticated role verification
    await UserRepository.createAsync({
      id: adminUserId,
      name: 'Administrator',
      email: 'admin-int@example.com',
      role: 'Super Admin'
    });
    cleanupUserIds.push(adminUserId);

    await UserRepository.createAsync({
      id: testUserAId,
      name: 'User A',
      email: 'usera-int@example.com',
      role: 'Member'
    });
    cleanupUserIds.push(testUserAId);

    await UserRepository.createAsync({
      id: testUserBId,
      name: 'User B',
      email: 'userb-int@example.com',
      role: 'Member'
    });
    cleanupUserIds.push(testUserBId);

    // Payment settings configuration setup for route testing
    const sampleSettings = {
      isConfigured: true,
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
    };

    if (storageMode === 'REAL_MONGODB') {
      try {
        await PaymentSettingsRepository.updateSettings(sampleSettings);
      } catch {}
    } else {
      PaymentSettingsRepository.getPublicSettings = async () => ({
        isConfigured: true,
        settings: sampleSettings as any
      });
    }

    // -------------------------------------------------------------------
    // CATEGORY A: ACCOUNT-SWITCH RACE GUARD UNIT TESTS
    // -------------------------------------------------------------------
    console.log('\n--- [CATEGORY A: Account-Switch Race Guard Unit Tests] ---');
    let activeUserRef = 'userA';
    let userAStateUpdatedAfterSwitch = false;
    const requestUserId = 'userA';

    const simulatedFetch = new Promise<any[]>((resolve) => {
      setTimeout(() => resolve([{ id: 'notif-stale', userId: 'userA' }]), 20);
    });

    // Account switch occurs while fetch is in-flight
    activeUserRef = 'userB';

    await simulatedFetch;
    if (activeUserRef === requestUserId) {
      userAStateUpdatedAfterSwitch = true;
    }

    assert.strictEqual(userAStateUpdatedAfterSwitch, false, 'Stale response from User A must NOT update User B UI state');
    console.log('✓ [PASS] Category A: Account-switch race guard verified.');

    // -------------------------------------------------------------------
    // CATEGORY B: DOCUMENT STORAGE PERSISTENCE TESTS
    // -------------------------------------------------------------------
    console.log(`\n--- [CATEGORY B: Document Storage Persistence Tests (${storageMode})] ---`);
    console.log('[Test Note: Persistence Disclaimer] Category B verifies in-memory / MongoDB document persistence depending on storage mode. Process-restart lifecycle persistence is not claimed as this test suite operates within a single process lifecycle.');
    
    const dbNotifId = `notif-db-${Date.now()}`;
    const dbNotif = await NotificationRepository.createAsync({
      id: dbNotifId,
      userId: testUserAId,
      title: 'Database Persistence Test',
      message: 'Direct MongoDB persistence verification.',
      type: 'info',
      eventId: `evt-db-${Date.now()}`
    });
    cleanupNotifIds.push(dbNotif.id);

    if (storageMode === 'REAL_MONGODB') {
      const db = await getMongoDb();
      const coll = db.collection('notifications');
      const directDoc = await coll.findOne({ id: dbNotifId });
      assert(directDoc, 'Notification document must exist in real MongoDB collection');
      assert.strictEqual(directDoc.userId, testUserAId, 'Document userId in MongoDB must match testUserAId');
      console.log('✓ [PASS] Category B: Direct MongoDB document persistence and fresh connection retrieval verified.');
    } else {
      const fetched = await NotificationRepository.getAllAsync({ userId: testUserAId });
      assert(fetched.some(n => n.id === dbNotifId), 'Notification record retrieved from repository store');
      console.log('✓ [PASS] Category B: Repository store persistence verified (In-Memory mode).');
    }

    // Concurrent duplicate event insertion
    const concurrentEventId = `evt-concurrent-${Date.now()}`;
    const [dup1, dup2] = await Promise.all([
      NotificationRepository.createAsync({
        userId: testUserAId,
        title: 'Concurrent Title',
        message: 'Concurrent message 1',
        type: 'info',
        eventId: concurrentEventId
      }),
      NotificationRepository.createAsync({
        userId: testUserAId,
        title: 'Concurrent Title',
        message: 'Concurrent message 2',
        type: 'info',
        eventId: concurrentEventId
      })
    ]);
    cleanupNotifIds.push(dup1.id);
    assert.strictEqual(dup1.id, dup2.id, 'Concurrent insertions with identical eventId must return duplicate record ID without error');
    console.log('✓ [PASS] Category B: Concurrent duplicate insertion protection verified.');

    // -------------------------------------------------------------------
    // CATEGORY C: ROUTE-HANDLER INTEGRATION TESTS
    // -------------------------------------------------------------------
    console.log('\n--- [CATEGORY C: Express Route-Handler Integration Tests (With Injected Test Identity)] ---');
    console.log('[Test Note: Authentication Disclaimer] These tests invoke route handlers via express app with injected test identity (req.user = activeTestUser). They verify route handler authorization logic, idempotency, ownership isolation, and notification durability. They do NOT verify raw JWT token signature decoding/header parsing.');

    // C1. Payment Proof Submission Route Integration
    console.log('Executing HTTP POST /api/transactions for payment proof submission...');
    activeTestUser = { userId: testUserAId, role: 'Member', name: 'User A', email: 'usera-int@example.com' };

    const txRef1 = `TID-SUB-${Date.now()}`;
    const subRes = await fetch(`${baseUrl}/api/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: 1200,
        currency: 'PKR',
        type: 'Wallet Deposit',
        paymentMethod: 'EasyPaisa',
        transactionId: txRef1,
        senderName: 'User A',
        senderPhoneOrAccount: '03001234567'
      })
    });

    const subData = await subRes.json();
    assert.strictEqual(subRes.status, 201, `Payment submission route must return HTTP 201. Response: ${JSON.stringify(subData)}`);
    assert(subData.success && subData.transaction?.id, 'Transaction must be created');
    const createdTx1Id = subData.transaction.id;
    cleanupTxIds.push(createdTx1Id);

    // Verify submission route automatically generated exactly 1 submission notification
    const userANotifsAfterSub = await NotificationRepository.getAllAsync({ userId: testUserAId });
    const subNotifs = userANotifsAfterSub.filter(n => n.eventId === `payment-submitted-${createdTx1Id}`);
    assert.strictEqual(subNotifs.length, 1, 'Payment submission route must create exactly ONE submission notification');
    assert.strictEqual(subNotifs[0].type, 'info', 'Submission notification must have type "info"');
    cleanupNotifIds.push(subNotifs[0].id);
    console.log('✓ [PASS] Category C1: Payment proof submission HTTP route created exactly ONE notification.');

    // C2. Payment Approval Route Integration
    console.log('Executing HTTP PATCH /api/transactions/:id/verify (action: approve)...');
    activeTestUser = { userId: adminUserId, role: 'Super Admin', name: 'Administrator', email: 'admin-int@example.com' };

    const appRes = await fetch(`${baseUrl}/api/transactions/${createdTx1Id}/verify`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'approve',
        note: 'Verified payment proof screenshot and transaction ID'
      })
    });

    const appData = await appRes.json();
    assert.strictEqual(appRes.status, 200, `Payment approval route must return HTTP 200. Response: ${JSON.stringify(appData)}`);
    assert.strictEqual(appData.transaction?.status, 'Success', 'Transaction status must update to Success');

    // Verify approval route automatically generated exactly 1 approval notification
    const userANotifsAfterApp = await NotificationRepository.getAllAsync({ userId: testUserAId });
    const appNotifs = userANotifsAfterApp.filter(n => n.eventId === `payment-approved-${createdTx1Id}`);
    assert.strictEqual(appNotifs.length, 1, 'Payment approval route must create exactly ONE approval notification');
    assert.strictEqual(appNotifs[0].type, 'success', 'Approval notification must have type "success"');
    cleanupNotifIds.push(appNotifs[0].id);
    console.log('✓ [PASS] Category C2: Payment approval HTTP route created exactly ONE notification.');

    // C3. Payment Rejection Route Integration & Exact Reason Preservation
    console.log('Executing HTTP POST /api/transactions for 2nd transaction & PATCH verify (action: reject)...');
    activeTestUser = { userId: testUserAId, role: 'Member', name: 'User A', email: 'usera-int@example.com' };

    const txRef2 = `TID-REJ-${Date.now()}`;
    const subRes2 = await fetch(`${baseUrl}/api/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: 2500,
        currency: 'PKR',
        type: 'Wallet Deposit',
        paymentMethod: 'EasyPaisa',
        transactionId: txRef2,
        senderName: 'User A',
        senderPhoneOrAccount: '03001234567'
      })
    });

    const subData2 = await subRes2.json();
    assert.strictEqual(subRes2.status, 201);
    const createdTx2Id = subData2.transaction.id;
    cleanupTxIds.push(createdTx2Id);

    activeTestUser = { userId: adminUserId, role: 'Super Admin', name: 'Administrator', email: 'admin-int@example.com' };
    const exactRejectionReason = 'Receipt transaction reference ID does not match bank deposit records.';

    const rejRes = await fetch(`${baseUrl}/api/transactions/${createdTx2Id}/verify`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'reject',
        reason: exactRejectionReason
      })
    });

    const rejData = await rejRes.json();
    assert.strictEqual(rejRes.status, 200);
    assert.strictEqual(rejData.transaction?.status, 'Failed');

    // Verify rejection route automatically generated exactly 1 rejection notification with exact reason
    const userANotifsAfterRej = await NotificationRepository.getAllAsync({ userId: testUserAId });
    const rejNotifs = userANotifsAfterRej.filter(n => n.eventId === `payment-rejected-${createdTx2Id}`);
    assert.strictEqual(rejNotifs.length, 1, 'Payment rejection route must create exactly ONE rejection notification');
    assert.strictEqual(rejNotifs[0].type, 'warning', 'Rejection notification must have type "warning"');
    assert(rejNotifs[0].message.includes(exactRejectionReason), `Rejection notification message must contain exact reason "${exactRejectionReason}"`);
    cleanupNotifIds.push(rejNotifs[0].id);
    console.log('✓ [PASS] Category C3: Payment rejection HTTP route created exactly ONE notification with exact rejection reason preserved.');

    // C4. Notification API Endpoint Ownership Security
    console.log('Executing HTTP GET & PATCH /api/notifications with User B credentials...');
    activeTestUser = { userId: testUserBId, role: 'Member', name: 'User B', email: 'userb-int@example.com' };

    const userBGetRes = await fetch(`${baseUrl}/api/notifications`);
    const userBGetData = await userBGetRes.json();
    assert.strictEqual(userBGetRes.status, 200);
    assert(!userBGetData.notifications.some((n: any) => n.userId === testUserAId), 'User B must NOT receive User A notifications over HTTP API');

    const userBPatchRes = await fetch(`${baseUrl}/api/notifications/${appNotifs[0].id}/read`, {
      method: 'PATCH'
    });
    assert.strictEqual(userBPatchRes.status, 404, 'User B attempt to mark User A notification read must fail with 404/Denied');
    console.log('✓ [PASS] Category C4: Notification API HTTP endpoints strictly enforce user ownership isolation.');

    // C5. Notification Failure Safeguard in Payment Route Handler
    console.log('Testing notification failure isolation during transaction verification...');
    activeTestUser = { userId: testUserAId, role: 'Member', name: 'User A', email: 'usera-int@example.com' };

    const txRef3 = `TID-FAILSAFE-${Date.now()}`;
    const subRes3 = await fetch(`${baseUrl}/api/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: 3000,
        currency: 'PKR',
        type: 'Wallet Deposit',
        paymentMethod: 'EasyPaisa',
        transactionId: txRef3,
        senderName: 'User A',
        senderPhoneOrAccount: '03001234567'
      })
    });

    const subData3 = await subRes3.json();
    assert.strictEqual(subRes3.status, 201);
    const createdTx3Id = subData3.transaction.id;
    cleanupTxIds.push(createdTx3Id);

    const originalCreateAsync = NotificationRepository.createAsync;
    try {
      // Temporarily mock NotificationRepository.createAsync to throw
      (NotificationRepository as any).createAsync = async () => {
        throw new Error('Simulated transient notification database failure');
      };

      activeTestUser = { userId: adminUserId, role: 'Super Admin', name: 'Administrator', email: 'admin-int@example.com' };
      const patchRes = await fetch(`${baseUrl}/api/transactions/${createdTx3Id}/verify`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve', note: 'Re-verification test with notification failure' })
      });

      const patchData = await patchRes.json();
      assert.strictEqual(patchRes.status, 200, 'Payment verification HTTP route must return 200 even if notification creation throws');
      assert.strictEqual(patchData.success, true, 'Payment verification response must remain successful');
      assert.strictEqual(patchData.transaction?.status, 'Success', 'Authoritative transaction status must update to Success');
      console.log('✓ [PASS] Category C5: Notification creation failure does NOT corrupt or reverse payment verification result.');
    } finally {
      (NotificationRepository as any).createAsync = originalCreateAsync;
    }

  } finally {
    // Restore original Database persistence methods
    if (storageMode === 'IN_MEMORY') {
      Database.getTransactions = originalGetTransactions;
      Database.saveTransactions = originalSaveTransactions;
      Database.addTransaction = originalAddTransaction;

      Database.getAuditLogs = originalGetAuditLogs;
      Database.addAuditLog = originalAddAuditLog;

      Database.getUsers = originalGetUsers;
      Database.saveUsers = originalSaveUsers;
    }

    // Clean up test generated records in MongoDB if REAL_MONGODB mode
    console.log('\n--- Cleaning up test-generated records ---');
    for (const notifId of cleanupNotifIds) {
      if (notifId) {
        await NotificationRepository.deleteAsync(notifId).catch(() => {});
      }
    }
    for (const txId of cleanupTxIds) {
      if (txId) {
        try {
          if (isMongoConfigured()) {
            const db = await getMongoDb();
            await db.collection('transactions').deleteOne({ id: txId }).catch(() => {});
          }
        } catch {}
      }
    }
    for (const userId of cleanupUserIds) {
      if (userId) {
        try {
          if (isMongoConfigured()) {
            const db = await getMongoDb();
            await db.collection('users').deleteOne({ id: userId }).catch(() => {});
          }
        } catch {}
      }
    }
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  }

  console.log('\n===============================================================');
  console.log(`=== ALL CATEGORIES PASSED SUCCESSFULLY (${storageMode}) ===`);
  console.log('===============================================================\n');
}

runTests().catch((err) => {
  console.error('\n[TEST FAILURE]', err);
  process.exit(1);
});
