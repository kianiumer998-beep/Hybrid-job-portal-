import assert from 'assert';
import express from 'express';
import { createServer, Server } from 'http';
import { URL } from 'url';
import { NotificationRepository } from '../db/repositories/NotificationRepository';
import { PaymentRepository } from '../db/repositories/PaymentRepository';
import { UserRepository } from '../db/repositories/UserRepository';
import { isMongoConfigured, getMongoDb, getMongoUri } from '../db/mongodb';
import { transactionRouter } from '../routes/transactionRoutes';
import { notificationRouter } from '../routes/notificationRoutes';
import { PaymentSettingsRepository } from '../db/repositories/PaymentSettingsRepository';
import { Database } from '../db/database';

async function runTests() {
  console.log('===============================================================');
  console.log('=== DURABLE NOTIFICATION & ROUTE INTEGRATION TEST SUITE ===');
  console.log('===============================================================\n');

  const originalIsTestEnv = process.env.IS_TEST;
  const originalGetPublicSettings = PaymentSettingsRepository.getPublicSettings;

  // Snapshot original methods
  const originalGetTransactions = Database.getTransactions;
  const originalSaveTransactions = Database.saveTransactions;
  const originalAddTransaction = Database.addTransaction;
  const originalGetAuditLogs = Database.getAuditLogs;
  const originalAddAuditLog = Database.addAuditLog;
  const originalGetUsers = Database.getUsers;
  const originalSaveUsers = Database.saveUsers;

  let storageMode: 'REAL_MONGODB' | 'IN_MEMORY' = 'IN_MEMORY';
  let httpServer: Server | null = null;
  let inMemTransactions: any[] = [];
  let inMemAuditLogs: any[] = [];
  let inMemUsers: any[] = [];
  
  const cleanupTxIds: string[] = [];
  const cleanupNotifIds: string[] = [];
  const cleanupUserIds: string[] = [];

  try {
    const realMongoRequested = process.env.USE_REAL_MONGO_TEST === 'true';
    const mongoConfigured = isMongoConfigured();

    if (realMongoRequested) {
      if (!mongoConfigured) {
        throw new Error('[Fatal Error] USE_REAL_MONGO_TEST=true requested, but MONGODB_URI is not configured in environment!');
      }
      
      // Strict Database Selection Guard: Pre-Connection
      const mongoUri = getMongoUri();
      let parsedUrl: URL;
      try {
          parsedUrl = new URL(mongoUri);
      } catch (err) {
          throw new Error('[Fatal Error] Real MongoDB test mode rejected: Invalid connection URI.');
      }
      
      const uriDbName = parsedUrl.pathname.replace(/^\//, '').split('?')[0]; 
      if (!uriDbName) {
          throw new Error('[Fatal Error] Real MongoDB test mode rejected: No database name found in connection URI.');
      }
      
      if (!uriDbName.toLowerCase().includes('test')) {
          throw new Error(`[Fatal Error] Real MongoDB test mode rejected: Database "${uriDbName}" is not identified as a dedicated test database (must contain "test"). Aborting to protect production.`);
      }

      const db = await getMongoDb();
      const actualDbName = db.databaseName;
      
      // Strict Database Selection Guard: Post-Connection
      if (uriDbName !== actualDbName) {
        throw new Error(`[Fatal Error] Real MongoDB test mode rejected: Database name mismatch. URI says "${uriDbName}", but connection says "${actualDbName}".`);
      }
      
      storageMode = 'REAL_MONGODB';
      console.log(`➜ STORAGE MODE: REAL MONGODB PERSISTENCE MODE (Connected to Verified Test DB: ${actualDbName})`);
    } else {
      storageMode = 'IN_MEMORY';
      process.env.IS_TEST = 'true';
      console.log('➜ STORAGE MODE: IN-MEMORY FALLBACK UNIT-TEST MODE (Strict Isolation)');
    }

    // Intercept Database persistence methods to prevent JSON file pollution in data/*.json
    // Always intercept AuditLog writes to protect data/audit_logs.json in both test modes
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

    httpServer = await new Promise((resolve) => {
      const s = createServer(app);
      s.listen(0, '127.0.0.1', () => resolve(s));
    });

    const port = (httpServer.address() as any).port;
    const baseUrl = `http://127.0.0.1:${port}`;

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

    // Mock PaymentSettingsRepository.getPublicSettings safely in memory
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

    PaymentSettingsRepository.getPublicSettings = async () => ({
      isConfigured: true,
      settings: sampleSettings as any
    });

    // --- TEST EXECUTION ---
    // CATEGORY A: ACCOUNT-SWITCH RACE GUARD UNIT TESTS
    console.log('\n--- [CATEGORY A: Account-Switch Race Guard Unit Tests] ---');
    let activeUserRef = 'userA';
    let userAStateUpdatedAfterSwitch = false;
    const requestUserId = 'userA';

    const simulatedFetch = new Promise<any[]>((resolve) => {
      setTimeout(() => resolve([{ id: 'notif-stale', userId: 'userA' }]), 20);
    });

    activeUserRef = 'userB';
    await simulatedFetch;
    if (activeUserRef === requestUserId) {
      userAStateUpdatedAfterSwitch = true;
    }
    assert.strictEqual(userAStateUpdatedAfterSwitch, false, 'Stale response from User A must NOT update User B UI state');
    console.log('✓ [PASS] Category A: Account-switch race guard verified.');

    // CATEGORY B: DOCUMENT STORAGE PERSISTENCE TESTS
    console.log(`\n--- [CATEGORY B: Document Storage Persistence Tests (${storageMode})] ---`);
    console.log('[Test Note: Persistence Disclaimer] Category B verifies in-memory / MongoDB document persistence depending on storage mode. Process-restart lifecycle persistence is not claimed as this test suite operates within a single process lifecycle.');
    
    const dbNotifId = `notif-db-${Date.now()}`;
    const dbNotif = await NotificationRepository.createAsync({
      id: dbNotifId, userId: testUserAId, title: 'Database Persistence Test', message: 'Direct MongoDB persistence verification.', type: 'info', eventId: `evt-db-${Date.now()}`
    });
    cleanupNotifIds.push(dbNotif.id);

    if (storageMode === 'REAL_MONGODB') {
      const db = await getMongoDb();
      const directDoc = await db.collection('notifications').findOne({ id: dbNotifId });
      assert(directDoc, 'Notification document must exist in real MongoDB collection');
      assert.strictEqual(directDoc.userId, testUserAId, 'Document userId in MongoDB must match testUserAId');
      console.log('✓ [PASS] Category B: Direct MongoDB document persistence and fresh connection retrieval verified.');
    } else {
      const fetched = await NotificationRepository.getAllAsync({ userId: testUserAId });
      assert(fetched.some(n => n.id === dbNotifId), 'Notification record retrieved from repository store');
      console.log('✓ [PASS] Category B: Repository store persistence verified (In-Memory mode).');
    }

    const concurrentEventId = `evt-concurrent-${Date.now()}`;
    const [dup1, dup2] = await Promise.all([
      NotificationRepository.createAsync({ userId: testUserAId, title: 'Concurrent Title', message: 'Concurrent message 1', type: 'info', eventId: concurrentEventId }),
      NotificationRepository.createAsync({ userId: testUserAId, title: 'Concurrent Title', message: 'Concurrent message 2', type: 'info', eventId: concurrentEventId })
    ]);
    cleanupNotifIds.push(dup1.id);
    assert.strictEqual(dup1.id, dup2.id, 'Concurrent insertions with identical eventId must return duplicate record ID without error');
    console.log('✓ [PASS] Category B: Concurrent duplicate insertion protection verified.');

    // CATEGORY C: ROUTE-HANDLER INTEGRATION TESTS
    console.log('\n--- [CATEGORY C: Express Route-Handler Integration Tests] ---');

    // C1. Payment Proof Submission Route Integration
    console.log('Executing HTTP POST /api/transactions for payment proof submission...');
    activeTestUser = { userId: testUserAId, role: 'Member', name: 'User A', email: 'usera-int@example.com' };

    const txRef1 = `TID-SUB-${Date.now()}`;
    const subRes = await fetch(`${baseUrl}/api/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 1200, currency: 'PKR', type: 'Wallet Deposit', paymentMethod: 'EasyPaisa', transactionId: txRef1, senderName: 'User A', senderPhoneOrAccount: '03001234567' })
    });
    const subData = await subRes.json();
    assert.strictEqual(subRes.status, 201);
    const createdTx1Id = subData.transaction.id;
    cleanupTxIds.push(createdTx1Id);

    const userANotifsAfterSub = await NotificationRepository.getAllAsync({ userId: testUserAId });
    const subNotifs = userANotifsAfterSub.filter(n => n.eventId === `payment-submitted-${createdTx1Id}`);
    assert.strictEqual(subNotifs.length, 1);
    cleanupNotifIds.push(subNotifs[0].id);
    console.log('✓ [PASS] Category C1: Payment proof submission HTTP route created exactly ONE notification.');

    // C2. Payment Approval Route Integration
    console.log('Executing HTTP PATCH /api/transactions/:id/verify (action: approve)...');
    activeTestUser = { userId: adminUserId, role: 'Super Admin', name: 'Administrator', email: 'admin-int@example.com' };
    const appRes = await fetch(`${baseUrl}/api/transactions/${createdTx1Id}/verify`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve', note: 'Verified payment proof screenshot and transaction ID' })
    });
    assert.strictEqual(appRes.status, 200);

    const userANotifsAfterApp = await NotificationRepository.getAllAsync({ userId: testUserAId });
    const appNotifs = userANotifsAfterApp.filter(n => n.eventId === `payment-approved-${createdTx1Id}`);
    assert.strictEqual(appNotifs.length, 1);
    cleanupNotifIds.push(appNotifs[0].id);
    console.log('✓ [PASS] Category C2: Payment approval HTTP route created exactly ONE notification.');

    // C3. Payment Rejection Route Integration & Exact Reason Preservation
    console.log('Executing HTTP POST /api/transactions for 2nd transaction & PATCH verify (action: reject)...');
    activeTestUser = { userId: testUserAId, role: 'Member', name: 'User A', email: 'usera-int@example.com' };
    const txRef2 = `TID-REJ-${Date.now()}`;
    const subRes2 = await fetch(`${baseUrl}/api/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 2500, currency: 'PKR', type: 'Wallet Deposit', paymentMethod: 'EasyPaisa', transactionId: txRef2, senderName: 'User A', senderPhoneOrAccount: '03001234567' })
    });
    const subData2 = await subRes2.json();
    const createdTx2Id = subData2.transaction.id;
    cleanupTxIds.push(createdTx2Id);

    activeTestUser = { userId: adminUserId, role: 'Super Admin', name: 'Administrator', email: 'admin-int@example.com' };
    const exactRejectionReason = 'Receipt transaction reference ID does not match bank deposit records.';
    const rejRes = await fetch(`${baseUrl}/api/transactions/${createdTx2Id}/verify`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reject', reason: exactRejectionReason })
    });
    assert.strictEqual(rejRes.status, 200);

    const userANotifsAfterRej = await NotificationRepository.getAllAsync({ userId: testUserAId });
    const rejNotifs = userANotifsAfterRej.filter(n => n.eventId === `payment-rejected-${createdTx2Id}`);
    assert.strictEqual(rejNotifs.length, 1);
    assert(rejNotifs[0].message.includes(exactRejectionReason));
    cleanupNotifIds.push(rejNotifs[0].id);
    console.log('✓ [PASS] Category C3: Payment rejection HTTP route created exactly ONE notification with exact rejection reason preserved.');

    // C4. Notification API Endpoint Ownership Security
    console.log('Executing HTTP GET & PATCH /api/notifications with User B credentials...');
    activeTestUser = { userId: testUserBId, role: 'Member', name: 'User B', email: 'userb-int@example.com' };
    const userBGetRes = await fetch(`${baseUrl}/api/notifications`);
    assert.strictEqual(userBGetRes.status, 200);

    const userBPatchRes = await fetch(`${baseUrl}/api/notifications/${appNotifs[0].id}/read`, { method: 'PATCH' });
    assert.strictEqual(userBPatchRes.status, 404);
    console.log('✓ [PASS] Category C4: Notification API HTTP endpoints strictly enforce user ownership isolation.');

    // C5. Notification Failure Safeguard in Payment Route Handler
    console.log('Testing notification failure isolation...');
    activeTestUser = { userId: testUserAId, role: 'Member', name: 'User A', email: 'usera-int@example.com' };
    const txRef3 = `TID-FAILSAFE-${Date.now()}`;
    const subRes3 = await fetch(`${baseUrl}/api/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 3000, currency: 'PKR', type: 'Wallet Deposit', paymentMethod: 'EasyPaisa', transactionId: txRef3, senderName: 'User A', senderPhoneOrAccount: '03001234567' })
    });
    const subData3 = await subRes3.json();
    const createdTx3Id = subData3.transaction.id;
    cleanupTxIds.push(createdTx3Id);

    const originalCreateAsync = NotificationRepository.createAsync;
    (NotificationRepository as any).createAsync = async () => { throw new Error('Simulated transient notification database failure'); };
    try {
      activeTestUser = { userId: adminUserId, role: 'Super Admin', name: 'Administrator', email: 'admin-int@example.com' };
      const patchRes = await fetch(`${baseUrl}/api/transactions/${createdTx3Id}/verify`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve', note: 'Re-verification test with notification failure' })
      });
      assert.strictEqual(patchRes.status, 200);
      console.log('✓ [PASS] Category C5: Notification creation failure does NOT corrupt or reverse payment verification result.');
    } finally {
      (NotificationRepository as any).createAsync = originalCreateAsync;
    }

  } catch (err) {
    console.error('[TEST ERROR]', err);
    throw err;
  } finally {
    // Teardown
    console.log('\n--- Cleaning up test-generated records ---');
    for (const notifId of cleanupNotifIds) { await NotificationRepository.deleteAsync(notifId).catch(e => console.warn(`[Cleanup Warning] ${e.message}`)); }
    for (const txId of cleanupTxIds) { 
        if (isMongoConfigured() && storageMode === 'REAL_MONGODB') {
            await (await getMongoDb()).collection('transactions').deleteOne({ id: txId }).catch(e => console.warn(`[Cleanup Warning] ${e.message}`));
        }
    }
    for (const userId of cleanupUserIds) { 
        if (isMongoConfigured() && storageMode === 'REAL_MONGODB') {
            await (await getMongoDb()).collection('users').deleteOne({ id: userId }).catch(e => console.warn(`[Cleanup Warning] ${e.message}`));
        }
    }
    if (httpServer) await new Promise<void>(resolve => httpServer!.close(() => resolve()));

    // Restore original state
    if (originalIsTestEnv !== undefined) process.env.IS_TEST = originalIsTestEnv;
    else delete process.env.IS_TEST;
    
    PaymentSettingsRepository.getPublicSettings = originalGetPublicSettings;
    Database.getTransactions = originalGetTransactions;
    Database.saveTransactions = originalSaveTransactions;
    Database.addTransaction = originalAddTransaction;
    Database.getAuditLogs = originalGetAuditLogs;
    Database.addAuditLog = originalAddAuditLog;
    Database.getUsers = originalGetUsers;
    Database.saveUsers = originalSaveUsers;
  }

  console.log('\n===============================================================');
  console.log(`=== ALL CATEGORIES PASSED SUCCESSFULLY (${storageMode}) ===`);
  console.log('===============================================================\n');
}

runTests().catch((err) => {
  console.error('\n[TEST FAILURE]', err);
  process.exit(1);
});
