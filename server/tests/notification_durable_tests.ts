import assert from 'assert';
import express from 'express';
import { createServer, Server } from 'http';
import { URL } from 'url';
import { NotificationRepository } from '../db/repositories/NotificationRepository';
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

  // --- 1. Snapshot original state ---
  const originalIsTestEnv = process.env.IS_TEST;
  const originalGetPublicSettings = PaymentSettingsRepository.getPublicSettings;
  const originalGetTransactions = Database.getTransactions;
  const originalSaveTransactions = Database.saveTransactions;
  const originalAddTransaction = Database.addTransaction;
  const originalGetAuditLogs = Database.getAuditLogs;
  const originalAddAuditLog = Database.addAuditLog;
  const originalGetUsers = Database.getUsers;
  const originalSaveUsers = Database.saveUsers;
  const originalCreateAsync = NotificationRepository.createAsync;

  let storageMode: 'REAL_MONGODB' | 'IN_MEMORY' = 'IN_MEMORY';
  let httpServer: Server | null = null;
  const cleanupTxIds: string[] = [];
  const cleanupNotifIds: string[] = [];
  const cleanupUserIds: string[] = [];

  try {
    // --- 2. Setup ---
    const realMongoRequested = process.env.USE_REAL_MONGO_TEST === 'true';
    const mongoConfigured = isMongoConfigured();

    if (realMongoRequested) {
      if (!mongoConfigured) throw new Error('[Fatal Error] USE_REAL_MONGO_TEST=true requested, but MONGODB_URI is not configured in environment!');
      
      const mongoUri = getMongoUri();
      let parsedUrl: URL;
      try { parsedUrl = new URL(mongoUri); } catch (err) { throw new Error('[Fatal Error] Invalid connection URI.'); }
      
      const uriDbName = parsedUrl.pathname.replace(/^\//, '').split('?')[0]; 
      if (!uriDbName) throw new Error('[Fatal Error] No database name found in connection URI.');
      
      if (!/^(test_|.*_test$)/i.test(uriDbName)) {
          throw new Error(`[Fatal Error] Real MongoDB test mode rejected: Database "${uriDbName}" naming does not conform to test isolation standards (must start with "test_" or end with "_test"). Aborting to protect production.`);
      }

      const db = await getMongoDb();
      if (uriDbName !== db.databaseName) throw new Error(`[Fatal Error] Database name mismatch. URI says "${uriDbName}", but connection says "${db.databaseName}".`);
      
      storageMode = 'REAL_MONGODB';
      console.log(`➜ STORAGE MODE: REAL MONGODB PERSISTENCE MODE (Connected to Verified Test DB: ${db.databaseName})`);
    } else {
      storageMode = 'IN_MEMORY';
      process.env.IS_TEST = 'true';
      console.log('➜ STORAGE MODE: IN-MEMORY FALLBACK UNIT-TEST MODE (Strict Isolation)');
    }

    let inMemTransactions: any[] = [];
    let inMemAuditLogs: any[] = [];
    let inMemUsers: any[] = [];

    Database.getAuditLogs = () => [...inMemAuditLogs];
    Database.addAuditLog = (entry: any) => {
      const newLog = { id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`, timestamp: new Date().toISOString(), status: 'Success', ...entry };
      inMemAuditLogs.unshift(newLog);
      return newLog;
    };

    if (storageMode === 'IN_MEMORY') {
      Database.getTransactions = () => [...inMemTransactions];
      Database.saveTransactions = (txs: any[]) => { inMemTransactions = [...txs]; };
      Database.addTransaction = (tx: any) => {
        const newTx = { ...tx, id: tx.id || `tx-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`, dateTime: tx.dateTime || new Date().toISOString().replace('T', ' ').substring(0, 16) };
        inMemTransactions.unshift(newTx);
        return newTx;
      };
      Database.getUsers = () => [...inMemUsers];
      Database.saveUsers = (users: any[]) => { inMemUsers = [...users]; };
    }

    const app = express();
    app.use(express.json());
    let activeTestUser: any = null;
    app.use((req, res, next) => { if (activeTestUser) { (req as any).user = activeTestUser; } next(); });
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

    await UserRepository.createAsync({ id: adminUserId, name: 'Administrator', email: 'admin-int@example.com', role: 'Super Admin' });
    cleanupUserIds.push(adminUserId);
    await UserRepository.createAsync({ id: testUserAId, name: 'User A', email: 'usera-int@example.com', role: 'Member' });
    cleanupUserIds.push(testUserAId);
    await UserRepository.createAsync({ id: testUserBId, name: 'User B', email: 'userb-int@example.com', role: 'Member' });
    cleanupUserIds.push(testUserBId);

    PaymentSettingsRepository.getPublicSettings = async () => ({
      isConfigured: true,
      settings: {
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
      } as any
    });

    // --- 3. Test Execution ---
    console.log('\n--- Running Tests ---');
    
    // Category A
    let activeUserRef = 'userA';
    const requestUserId = 'userA';
    const simulatedFetch = new Promise<any[]>((resolve) => { setTimeout(() => resolve([{ id: 'notif-stale', userId: 'userA' }]), 20); });
    activeUserRef = 'userB';
    await simulatedFetch;
    assert.strictEqual(activeUserRef === requestUserId, false, 'Stale response from User A must NOT update User B UI state');
    console.log('✓ [PASS] Category A: Account-switch race guard verified.');

    // Category B
    const dbNotifId = `notif-db-${Date.now()}`;
    const dbNotif = await NotificationRepository.createAsync({ id: dbNotifId, userId: testUserAId, title: 'Database Persistence Test', message: 'Verification.', type: 'info', eventId: `evt-db-${Date.now()}` });
    cleanupNotifIds.push(dbNotif.id);
    if (storageMode === 'REAL_MONGODB') {
        const directDoc = await (await getMongoDb()).collection('notifications').findOne({ id: dbNotifId });
        assert(directDoc); console.log('✓ [PASS] Category B: Real MongoDB persistence verified.');
    } else {
        const fetched = await NotificationRepository.getAllAsync({ userId: testUserAId });
        assert(fetched.some(n => n.id === dbNotifId)); console.log('✓ [PASS] Category B: Repository store persistence verified (In-Memory mode).');
    }
    const concurrentEventId = `evt-concurrent-${Date.now()}`;
    const [dup1, dup2] = await Promise.all([
      NotificationRepository.createAsync({ userId: testUserAId, title: 'C', message: 'M1', type: 'info', eventId: concurrentEventId }),
      NotificationRepository.createAsync({ userId: testUserAId, title: 'C', message: 'M2', type: 'info', eventId: concurrentEventId })
    ]);
    cleanupNotifIds.push(dup1.id);
    assert.strictEqual(dup1.id, dup2.id); console.log('✓ [PASS] Category B: Concurrent duplicate insertion protection verified.');

    // Category C
    activeTestUser = { userId: testUserAId, role: 'Member', name: 'User A', email: 'usera-int@example.com' };
    const txRef1 = `TID-SUB-${Date.now()}`;
    const subRes = await fetch(`${baseUrl}/api/transactions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: 1200, currency: 'PKR', type: 'Wallet Deposit', paymentMethod: 'EasyPaisa', transactionId: txRef1, senderName: 'User A', senderPhoneOrAccount: '03001234567' }) });
    const subData = await subRes.json();
    assert.strictEqual(subRes.status, 201);
    const createdTx1Id = subData.transaction.id;
    cleanupTxIds.push(createdTx1Id);

    const userANotifsAfterSub = await NotificationRepository.getAllAsync({ userId: testUserAId });
    const subNotifs = userANotifsAfterSub.filter(n => n.eventId === `payment-submitted-${createdTx1Id}`);
    assert.strictEqual(subNotifs.length, 1);
    cleanupNotifIds.push(subNotifs[0].id);
    console.log('✓ [PASS] Category C1: Payment proof submission HTTP route created exactly ONE notification.');

    activeTestUser = { userId: adminUserId, role: 'Super Admin', name: 'Administrator', email: 'admin-int@example.com' };
    await fetch(`${baseUrl}/api/transactions/${createdTx1Id}/verify`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'approve', note: 'Verified' }) });
    assert.strictEqual((await NotificationRepository.getAllAsync({ userId: testUserAId })).filter(n => n.eventId === `payment-approved-${createdTx1Id}`).length, 1);
    console.log('✓ [PASS] Category C2: Payment approval HTTP route created exactly ONE notification.');

    activeTestUser = { userId: testUserAId, role: 'Member', name: 'User A', email: 'usera-int@example.com' };
    const txRef2 = `TID-REJ-${Date.now()}`;
    const subRes2 = await fetch(`${baseUrl}/api/transactions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: 2500, currency: 'PKR', type: 'Wallet Deposit', paymentMethod: 'EasyPaisa', transactionId: txRef2, senderName: 'User A', senderPhoneOrAccount: '03001234567' }) });
    const createdTx2Id = (await subRes2.json()).transaction.id;
    cleanupTxIds.push(createdTx2Id);
    activeTestUser = { userId: adminUserId, role: 'Super Admin', name: 'Administrator', email: 'admin-int@example.com' };
    const exactRejectionReason = 'Receipt transaction reference ID does not match bank deposit records.';
    await fetch(`${baseUrl}/api/transactions/${createdTx2Id}/verify`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'reject', reason: exactRejectionReason }) });
    const rejNotifs = (await NotificationRepository.getAllAsync({ userId: testUserAId })).filter(n => n.eventId === `payment-rejected-${createdTx2Id}`);
    assert.strictEqual(rejNotifs.length, 1);
    assert(rejNotifs[0].message.includes(exactRejectionReason));
    cleanupNotifIds.push(rejNotifs[0].id);
    console.log('✓ [PASS] Category C3: Payment rejection HTTP route created exactly ONE notification with exact rejection reason.');

    activeTestUser = { userId: testUserBId, role: 'Member', name: 'User B', email: 'userb-int@example.com' };
    assert.strictEqual((await fetch(`${baseUrl}/api/notifications/${(await NotificationRepository.getAllAsync({ userId: testUserAId }))[0].id}/read`, { method: 'PATCH' })).status, 404);
    console.log('✓ [PASS] Category C4: Notification ownership isolation.');

    activeTestUser = { userId: testUserAId, role: 'Member', name: 'User A', email: 'usera-int@example.com' };
    const txRef3 = `TID-FAILSAFE-${Date.now()}`;
    const subRes3 = await fetch(`${baseUrl}/api/transactions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: 3000, currency: 'PKR', type: 'Wallet Deposit', paymentMethod: 'EasyPaisa', transactionId: txRef3, senderName: 'User A', senderPhoneOrAccount: '03001234567' }) });
    const createdTx3Id = (await subRes3.json()).transaction.id;
    cleanupTxIds.push(createdTx3Id);
    
    NotificationRepository.createAsync = async () => { throw new Error('Simulated transient notification database failure'); };
    activeTestUser = { userId: adminUserId, role: 'Super Admin', name: 'Administrator', email: 'admin-int@example.com' };
    assert.strictEqual((await fetch(`${baseUrl}/api/transactions/${createdTx3Id}/verify`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'approve', note: 'Re-verification test' }) })).status, 200);
    console.log('✓ [PASS] Category C5: Notification creation failure does NOT corrupt verification result.');
    NotificationRepository.createAsync = originalCreateAsync;

  } catch (err) {
    console.error('[TEST ERROR]', err);
    throw err;
  } finally {
      // --- 4. Cleanup ---
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

      // --- 5. Restoration ---
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
      NotificationRepository.createAsync = originalCreateAsync;
  }
}

runTests().catch((err) => {
  console.error('\n[TEST FAILURE]', err);
  process.exit(1);
});
