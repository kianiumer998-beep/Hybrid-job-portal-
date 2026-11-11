import assert from 'assert';
import express from 'express';
import { createServer, Server } from 'http';
import { ChatMessageRepository } from '../db/repositories/ChatMessageRepository';
import { chatRouter } from '../routes/chatMessageRoutes';
import { authMiddleware, createToken } from '../auth/authManager';
import { UserRepository } from '../db/repositories/UserRepository';

process.env.IS_TEST = 'true';
process.env.NODE_ENV = 'test';

async function runChatPersistenceTests() {
  console.log('==================================================================');
  console.log('   STEP-05-04-A: CHAT MESSAGE PERSISTENCE REGRESSION SUITE       ');
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

  try {
    // 1. User Message Creation and Retrieval
    {
      const res = await fetch(`${baseUrl}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
        body: JSON.stringify({ text: 'Hello from A', id: 'msg-a-1' })
      });
      const data = await res.json();
      assert.strictEqual(data.success, true, 'User A should send message');
      assert.strictEqual(data.message.text, 'Hello from A');
      assert.strictEqual(data.message.userId, 'user-a');

      const getRes = await fetch(`${baseUrl}`, {
        headers: { Authorization: `Bearer ${tokenA}` }
      });
      const getData = await getRes.json();
      assert.strictEqual(getData.messages.length, 1);
      assert.strictEqual(getData.messages[0].id, 'msg-a-1');
      console.log('✓ Test 1 Passed: User message creation and retrieval verified.');
    }

    // 2. Admin Reply Creation and Retrieval
    {
      const res = await fetch(`${baseUrl}/admin/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ userId: 'user-a', text: 'Admin reply to A', id: 'msg-adm-1' })
      });
      const data = await res.json();
      assert.strictEqual(data.success, true, 'Admin should reply to A');
      assert.strictEqual(data.message.senderRole, 'admin');

      const getRes = await fetch(`${baseUrl}`, {
        headers: { Authorization: `Bearer ${tokenA}` }
      });
      const getData = await getRes.json();
      assert.strictEqual(getData.messages.length, 2, 'User A should see 2 messages now');
      assert.strictEqual(getData.messages[1].senderRole, 'admin');
      console.log('✓ Test 2 Passed: Admin reply creation and retrieval verified.');
    }

    // 3. User A cannot read User B messages
    {
      await ChatMessageRepository.save({
        id: 'msg-b-1', userId: 'user-b', userName: 'User B', senderRole: 'user', text: 'Secret B', timestamp: new Date().toISOString()
      });

      const res = await fetch(`${baseUrl}`, {
        headers: { Authorization: `Bearer ${tokenA}` }
      });
      const data = await res.json();
      const hasB = data.messages.some((m: any) => m.userId === 'user-b');
      assert.strictEqual(hasB, false, 'User A should not see User B messages');
      console.log('✓ Test 3 Passed: User conversation isolation verified.');
    }

    // 4. Unauthenticated requests rejected
    {
      const res = await fetch(`${baseUrl}`);
      assert.strictEqual(res.status, 401, 'Unauthenticated GET should be 401');
      
      const postRes = await fetch(`${baseUrl}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'No auth' })
      });
      assert.strictEqual(postRes.status, 401, 'Unauthenticated POST should be 401');
      console.log('✓ Test 4 Passed: Unauthenticated requests correctly rejected.');
    }

    // 5. Unauthorized user cannot access admin inbox or reply
    {
      const res = await fetch(`${baseUrl}/admin/all`, {
        headers: { Authorization: `Bearer ${tokenA}` }
      });
      assert.strictEqual(res.status, 403, 'User A should not access admin inbox');

      const replyRes = await fetch(`${baseUrl}/admin/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
        body: JSON.stringify({ userId: 'user-b', text: 'Impersonating admin' })
      });
      assert.strictEqual(replyRes.status, 403, 'User A should not send admin reply');
      console.log('✓ Test 5 Passed: RBAC protection for admin endpoints verified.');
    }

    // 6. Sender identity/role spoofing rejected
    {
      const res = await fetch(`${baseUrl}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
        body: JSON.stringify({ text: 'Spoofing', senderRole: 'admin', userId: 'user-b' })
      });
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.message.senderRole, 'user', 'Should force senderRole to user');
      assert.strictEqual(data.message.userId, 'user-a', 'Should force userId to authenticated user');
      console.log('✓ Test 6 Passed: Sender identity and role spoofing prevented.');
    }

    // 7. Empty and oversized message rejected
    {
      const resEmpty = await fetch(`${baseUrl}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
        body: JSON.stringify({ text: '   ' })
      });
      assert.strictEqual(resEmpty.status, 400, 'Empty message should be rejected');

      const resLong = await fetch(`${baseUrl}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
        body: JSON.stringify({ text: 'a'.repeat(2001) })
      });
      assert.strictEqual(resLong.status, 400, 'Oversized message should be rejected');
      console.log('✓ Test 7 Passed: Message validation (empty/long) verified.');
    }

    // 8. Duplicate request does not create duplicate message (Idempotency)
    {
      const msgId = 'idempotent-1';
      const body = { text: 'Retry me', id: msgId };
      
      const res1 = await fetch(`${baseUrl}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
        body: JSON.stringify(body)
      });
      assert.strictEqual((await res1.json()).success, true);

      const res2 = await fetch(`${baseUrl}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
        body: JSON.stringify(body)
      });
      assert.strictEqual((await res2.json()).success, true);

      const getRes = await fetch(`${baseUrl}`, {
        headers: { Authorization: `Bearer ${tokenA}` }
      });
      const getData = await getRes.json();
      const matches = getData.messages.filter((m: any) => m.id === msgId);
      assert.strictEqual(matches.length, 1, 'Should not create duplicate message on retry');
      console.log('✓ Test 8 Passed: Message creation idempotency verified.');
    }

    // 9. Multiple messages preserve deterministic order
    {
      ChatMessageRepository.resetTestStore();
      const ts = new Date().getTime();
      await ChatMessageRepository.save({ id: 'm1', userId: 'user-a', userName: 'A', senderRole: 'user', text: '1', timestamp: new Date(ts).toISOString() });
      await ChatMessageRepository.save({ id: 'm2', userId: 'user-a', userName: 'A', senderRole: 'user', text: '2', timestamp: new Date(ts + 1000).toISOString() });
      await ChatMessageRepository.save({ id: 'm3', userId: 'user-a', userName: 'A', senderRole: 'user', text: '3', timestamp: new Date(ts + 2000).toISOString() });

      const res = await fetch(`${baseUrl}`, {
        headers: { Authorization: `Bearer ${tokenA}` }
      });
      const data = await res.json();
      assert.strictEqual(data.messages[0].text, '1');
      assert.strictEqual(data.messages[1].text, '2');
      assert.strictEqual(data.messages[2].text, '3');
      console.log('✓ Test 9 Passed: Message ordering verified.');
    }

    // 10. Legacy migration
    {
      const legacy = [
        { id: 'leg-1', userId: 'user-a', userName: 'A', senderRole: 'user', text: 'Legacy 1', timestamp: new Date().toISOString() },
        { id: 'msg-1', userId: 'user-demo-1', userName: 'Ali', senderRole: 'admin', text: 'Demo', timestamp: new Date().toISOString() }
      ];

      const res = await fetch(`${baseUrl}/import-legacy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ messages: legacy })
      });
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.imported, 1, 'Should import 1 non-demo message');
      
      const getRes = await fetch(`${baseUrl}`, {
        headers: { Authorization: `Bearer ${tokenA}` }
      });
      const getData = await getRes.json();
      assert(getData.messages.some((m: any) => m.id === 'leg-1'), 'Legacy message should be present');
      assert(!getData.messages.some((m: any) => m.id === 'msg-1'), 'Demo message should NOT be imported');
      console.log('✓ Test 10 Passed: Legacy migration logic verified.');
    }

    console.log('==================================================================');
    console.log('   CHAT PERSISTENCE SUITE RESULT: SUCCESS (10 Passed)            ');
    console.log('==================================================================');
  } finally {
    server.close();
  }
}

runChatPersistenceTests().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
