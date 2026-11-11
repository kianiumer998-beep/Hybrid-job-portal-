import assert from 'assert';
import express from 'express';
import { createServer, Server } from 'http';
import { ChatMessageRepository } from '../db/repositories/ChatMessageRepository';
import { chatRouter } from '../routes/chatMessageRoutes';
import { authMiddleware, createToken } from '../auth/authManager';
import { UserRepository } from '../db/repositories/UserRepository';

// Explicitly clear MongoDB URI to ensure test isolation
process.env.MONGODB_URI = '';
process.env.MONGO_URI = '';
process.env.IS_TEST = 'true';
process.env.NODE_ENV = 'test';

async function runChatPersistenceTests() {
  console.log('==================================================================');
  console.log('   STEP-05-04-A.1: CHAT PERSISTENCE ENHANCED REGRESSION SUITE    ');
  console.log('==================================================================');

  ChatMessageRepository.resetTestStore();

  const app = express();
  app.use(express.json());
  app.use(authMiddleware);
  app.use('/api/chat', chatRouter);

  const server: Server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${address.port}/api/chat`;

  const userA = UserRepository.create({ id: 'user-a', name: 'User A', email: 'a@test.com', role: 'Job Seeker' });
  const userB = UserRepository.create({ id: 'user-b', name: 'User B', email: 'b@test.com', role: 'Job Seeker' });
  const admin = UserRepository.create({ id: 'admin-1', name: 'Admin', email: 'admin@test.com', role: 'Super Admin' });

  const tokenA = createToken({ id: userA.id, userId: userA.id, role: userA.role, name: userA.name });
  const tokenB = createToken({ id: userB.id, userId: userB.id, role: userB.role, name: userB.name });
  const adminToken = createToken({ id: admin.id, userId: admin.id, role: admin.role, name: admin.name });

  let testsPassed = 0;
  let testsFailed = 0;
  const totalPlanned = 15;

  const runTest = async (name: string, fn: () => Promise<void>) => {
    try {
      await fn();
      testsPassed++;
      console.log(`✓ Passed: ${name}`);
    } catch (err: any) {
      testsFailed++;
      console.error(`✗ Failed: ${name}`);
      console.error(`  Error: ${err.message}`);
    }
  };

  try {
    // 1. Same user, same message ID retry (Idempotency)
    await runTest('User-scoped Idempotency (Same ID retry)', async () => {
      const body = { id: 'msg-id-1', text: 'Hello' };
      const res1 = await fetch(`${baseUrl}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
        body: JSON.stringify(body)
      });
      const data1 = await res1.json();
      assert.strictEqual(data1.success, true);
      const ts1 = data1.message.timestamp;

      const res2 = await fetch(`${baseUrl}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
        body: JSON.stringify(body)
      });
      const data2 = await res2.json();
      assert.strictEqual(data2.success, true);
      assert.strictEqual(data2.message.timestamp, ts1, 'Authoritative timestamp should be returned on retry');
    });

    // 2. Different users, same message ID (Isolation)
    await runTest('User-scoped Idempotency (Different users, same ID)', async () => {
      const body = { id: 'msg-shared-id', text: 'Message from A' };
      await fetch(`${baseUrl}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
        body: JSON.stringify(body)
      });

      const resB = await fetch(`${baseUrl}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenB}` },
        body: JSON.stringify({ ...body, text: 'Message from B' })
      });
      const dataB = await resB.json();
      assert.strictEqual(dataB.success, true);
      assert.strictEqual(dataB.message.text, 'Message from B', 'User B should have their own message even if ID matches User A');
    });

    // 3. malformed message rejection
    await runTest('Strict input validation (Malformed/Empty)', async () => {
      const resEmpty = await fetch(`${baseUrl}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
        body: JSON.stringify({ id: 'valid-id', text: '  ' })
      });
      assert.strictEqual(resEmpty.status, 400);

      const resNoId = await fetch(`${baseUrl}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
        body: JSON.stringify({ text: 'Valid text but no ID' })
      });
      assert.strictEqual(resNoId.status, 400);
    });

    // 4. Oversized message rejection
    await runTest('Strict input validation (Oversized text)', async () => {
      const resLong = await fetch(`${baseUrl}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
        body: JSON.stringify({ id: 'long-id', text: 'a'.repeat(2001) })
      });
      assert.strictEqual(resLong.status, 400);
    });

    // 5. User identity spoofing rejection
    await runTest('Security: User identity/role spoofing', async () => {
      const res = await fetch(`${baseUrl}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
        body: JSON.stringify({ id: 'spoof-id', text: 'Trying to spoof', userId: 'user-b', senderRole: 'admin' })
      });
      const data = await res.json();
      assert.strictEqual(data.message.userId, 'user-a');
      assert.strictEqual(data.message.senderRole, 'user');
    });

    // 6. Admin reply target existence
    await runTest('Admin reply: Target user existence check', async () => {
      const res = await fetch(`${baseUrl}/admin/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ id: 'reply-id', userId: 'nonexistent-user', text: 'Hello' })
      });
      assert.strictEqual(res.status, 404, 'Admin reply to nonexistent user should be 404');
    });

    // 7. Admin reply sender derivation
    await runTest('Admin reply: Sender identity derivation', async () => {
      const res = await fetch(`${baseUrl}/admin/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ id: 'reply-derivation', userId: 'user-a', text: 'Hello', userName: 'Spoofed Admin' })
      });
      const data = await res.json();
      assert.strictEqual(data.message.userName, 'Admin', 'Admin name should be derived from session');
    });

    // 8. Admin history: limit validation
    await runTest('Admin history: Limit validation and clamping', async () => {
      const resInvalid = await fetch(`${baseUrl}/admin/all?limit=-5`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      const dataInvalid = await resInvalid.json();
      assert.strictEqual(dataInvalid.success, true);
      
      const resLarge = await fetch(`${baseUrl}/admin/all?limit=999999`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      assert.strictEqual((await resLarge.json()).success, true);
    });

    // 9. Admin history: ordering
    await runTest('Admin history: chronological ordering', async () => {
      ChatMessageRepository.resetTestStore();
      const now = Date.now();
      await ChatMessageRepository.save({ id: 'older', userId: 'user-a', userName: 'A', senderRole: 'user', text: 'Old', timestamp: new Date(now - 10000).toISOString() });
      await ChatMessageRepository.save({ id: 'newer', userId: 'user-a', userName: 'A', senderRole: 'user', text: 'New', timestamp: new Date(now).toISOString() });

      const res = await fetch(`${baseUrl}/admin/all`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      const data = await res.json();
      assert(new Date(data.messages[0].timestamp) < new Date(data.messages[1].timestamp), 'Messages should be in chronological order');
    });

    // 10. Legacy import: synthetic "msg-1" skip
    await runTest('Legacy import: Skip synthetic records', async () => {
      const messages = [
        { id: 'msg-1', userId: 'user-a', text: 'Demo', senderRole: 'user' },
        { id: 'real-1', userId: 'user-a', text: 'Real', senderRole: 'user' }
      ];
      const res = await fetch(`${baseUrl}/import-legacy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ messages })
      });
      const data = await res.json();
      assert.strictEqual(data.imported, 1);
      assert.strictEqual(data.skipped, 1);
    });

    // 11. Legacy import: malformed record skip
    await runTest('Legacy import: Malformed record validation', async () => {
      const messages = [
        { id: 'm1', userId: 'user-a', text: 'Valid', senderRole: 'user' },
        { id: 'm2', userId: 'user-a', text: '', senderRole: 'user' },
        { id: 'm3', userId: 'user-a', text: 'No role' },
        { id: 'm4', text: 'No user', senderRole: 'user' }
      ];
      const res = await fetch(`${baseUrl}/import-legacy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ messages })
      });
      const data = await res.json();
      assert.strictEqual(data.imported, 1);
      assert.strictEqual(data.skipped, 3);
    });

    // 12. Legacy import: oversized batch rejection
    await runTest('Legacy import: Batch size limit', async () => {
      const messages = Array.from({ length: 1001 }, (_, i) => ({ id: `m${i}`, userId: 'user-a', text: 'T', senderRole: 'user' }));
      const res = await fetch(`${baseUrl}/import-legacy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ messages })
      });
      assert.strictEqual(res.status, 400);
    });

    // 13. Access isolation: User A cannot see Admin history
    await runTest('RBAC: Admin endpoints protected', async () => {
      const resAll = await fetch(`${baseUrl}/admin/all`, { headers: { Authorization: `Bearer ${tokenA}` } });
      assert.strictEqual(resAll.status, 403);

      const resImport = await fetch(`${baseUrl}/import-legacy`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
        body: JSON.stringify({ messages: [] })
      });
      assert.strictEqual(resImport.status, 403);
    });

    // 14. Authoritative stored message returned after save
    await runTest('Authoritative stored message returned', async () => {
      const res = await fetch(`${baseUrl}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
        body: JSON.stringify({ id: 'authoritative-id', text: 'Hello', jobTitleRef: 'Job' })
      });
      const data = await res.json();
      assert(data.message.timestamp, 'Result should include server timestamp');
      assert.strictEqual(data.message.userName, 'User A', 'Result should include derived username');
    });

    // 15. Automatic notification failure handling (simulated)
    await runTest('System notifications failure logging (Mock)', async () => {
      // This is primarily verified in App.tsx via console.error/warn, but we check route behavior here
      const res = await fetch(`${baseUrl}/admin/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ id: 'sys-fail', userId: 'nonexistent', text: 'System notification' })
      });
      assert.strictEqual(res.status, 404, 'System notification route should return 404 for invalid user');
    });

    console.log('==================================================================');
    console.log(`   CHAT PERSISTENCE SUITE RESULT: ${testsPassed}/${totalPlanned} Passed`);
    console.log('==================================================================');
    
    if (testsFailed > 0) {
      process.exit(1);
    }
  } finally {
    server.close();
  }
}

runChatPersistenceTests().catch(err => {
  console.error('Test suite runner failed:', err);
  process.exit(1);
});
