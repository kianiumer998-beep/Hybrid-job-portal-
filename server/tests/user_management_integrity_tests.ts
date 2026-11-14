import assert from 'assert';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import express from 'express';
import { createServer, Server } from 'http';

// Ensure strictly isolated test mode
process.env.MONGODB_URI = '';
process.env.MONGO_URI = '';
process.env.IS_TEST = 'true';
process.env.NODE_ENV = 'test';

import { authMiddleware, createToken } from '../auth/authManager';
import { userRouter } from '../routes/userRoutes';
import { UserRepository } from '../db/repositories/UserRepository';
import { JobRepository } from '../db/repositories/JobRepository';
import { ApplicationRepository } from '../db/repositories/ApplicationRepository';
import { PaymentRepository } from '../db/repositories/PaymentRepository';
import { SubscriberRepository } from '../db/repositories/SubscriberRepository';
import { AuditRepository } from '../db/repositories/AuditRepository';

const DATA_DIR = path.resolve(process.cwd(), 'data');

function getDataSnapshot(): Record<string, string> {
  const snapshot: Record<string, string> = {};
  if (!fs.existsSync(DATA_DIR)) return snapshot;
  for (const entry of fs.readdirSync(DATA_DIR)) {
    if (entry.endsWith('.json')) {
      const content = fs.readFileSync(path.join(DATA_DIR, entry));
      snapshot[entry] = crypto.createHash('sha256').update(content).digest('hex');
    }
  }
  return snapshot;
}

function getFileHash(relPath: string): string {
  const content = fs.readFileSync(path.resolve(process.cwd(), relPath));
  return crypto.createHash('sha256').update(content).digest('hex');
}

async function runUserManagementIntegrityTests() {
  console.log('==================================================================');
  console.log('   STEP-A: USER MANAGEMENT, VALIDATION & DELETION INTEGRITY SUITE ');
  console.log('   ENVIRONMENT: ISOLATED IN-MEMORY TEST MODE (NO DATA MUTATION)    ');
  console.log('==================================================================');

  const preDataSnapshot = getDataSnapshot();
  const preMongoHash = getFileHash('server/db/mongodb.ts');

  const recordedAudits: any[] = [];
  const originalAuditAdd = AuditRepository.add;
  let shouldFailAudit = false;

  AuditRepository.add = (entry: any) => {
    if (shouldFailAudit) {
      throw new Error('Simulated audit log storage failure');
    }
    recordedAudits.push({
      id: `test-audit-${recordedAudits.length + 1}`,
      timestamp: new Date().toISOString(),
      ...entry
    });
    return entry;
  };

  SubscriberRepository.resetTestStore();

  const app = express();
  app.use(express.json());
  app.use(authMiddleware);
  app.use('/api/users', userRouter);

  const server: Server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as { port: number }).port;
  const baseUrl = `http://127.0.0.1:${port}/api/users`;

  const makeToken = (user: any) =>
    createToken({ id: user.id, userId: user.id, email: user.email, name: user.name, role: user.role });

  let passed = 0;
  let failed = 0;

  const runTest = async (name: string, fn: () => Promise<void>) => {
    try {
      await fn();
      passed++;
      console.log(`✓ Passed: ${name}`);
    } catch (err: any) {
      failed++;
      console.error(`✗ Failed: ${name}`);
      console.error(`  Error: ${err?.stack || err?.message || err}`);
    }
  };

  // Seed test users in isolated in-memory UserRepository
  const superAdmin = await UserRepository.createAsync({
    id: 'usr-sa-primary',
    name: 'Primary Super Admin',
    email: 'sa.primary@test.local',
    role: 'Super Admin',
    plan: 'Premium',
    membershipStatus: 'Active',
    paymentStatus: 'Paid',
    autoRenew: true
  });

  const superAdminSecondary = await UserRepository.createAsync({
    id: 'usr-sa-secondary',
    name: 'Secondary Super Admin',
    email: 'sa.secondary@test.local',
    role: 'Super Admin',
    plan: 'Premium',
    membershipStatus: 'Active',
    paymentStatus: 'Paid',
    autoRenew: true
  });

  const adminUser = await UserRepository.createAsync({
    id: 'usr-admin-1',
    name: 'Standard Admin',
    email: 'admin1@test.local',
    role: 'Admin',
    plan: 'Premium',
    membershipStatus: 'Active',
    paymentStatus: 'Paid',
    autoRenew: false
  });

  const systemProtectedUser = await UserRepository.createAsync({
    id: 'usr-system-protected',
    name: 'Protected System Account',
    email: 'system.account@test.local',
    role: 'Admin',
    isSystem: true,
    isProtected: true
  });

  const moderatorUser = await UserRepository.createAsync({
    id: 'usr-mod-1',
    name: 'Job Moderator',
    email: 'mod1@test.local',
    role: 'Job Moderator',
    plan: 'Free'
  });

  const paidMember = await UserRepository.createAsync({
    id: 'usr-paid-member-1',
    name: 'Paid Member',
    email: 'paid.member@test.local',
    role: 'Employer',
    plan: 'Premium',
    membershipStatus: 'Active',
    paymentStatus: 'Paid',
    autoRenew: true,
    expiryDate: '2028-12-31 23:59',
    renewalCount: 2,
    passwordHash: 'secret-hash-value',
    salt: 'secret-salt-value'
  });

  const deletableMember = await UserRepository.createAsync({
    id: 'usr-deletable-1',
    name: 'Deletable Member',
    email: 'deletable@test.local',
    role: 'Job Seeker',
    plan: 'Free',
    membershipStatus: 'Active',
    paymentStatus: 'Paid'
  });

  const saToken = makeToken(superAdmin);
  const adminToken = makeToken(adminUser);
  const modToken = makeToken(moderatorUser);
  const memberToken = makeToken(paidMember);

  try {
    await runTest('1. Admin PUT /api/users/:id persists membership changes and preserves Paid paymentStatus on revocation', async () => {
      const revokeRes = await fetch(`${baseUrl}/${paidMember.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          plan: 'Free',
          membershipStatus: 'Revoked',
          autoRenew: false,
          expiryDate: '2026-01-15 00:00',
          adminNotes: 'Membership ended without erasing payment history'
        })
      });
      assert.strictEqual(revokeRes.status, 200);
      const revokeJson = await revokeRes.json();
      assert.strictEqual(revokeJson.success, true);
      assert.strictEqual(revokeJson.user.plan, 'Free');
      assert.strictEqual(revokeJson.user.membershipStatus, 'Revoked');
      assert.strictEqual(revokeJson.user.paymentStatus, 'Paid', 'Paid paymentStatus must be preserved on revocation');
      assert.strictEqual(revokeJson.user.autoRenew, false);
      assert.strictEqual(revokeJson.user.expiryDate, '2026-01-15 00:00');
      assert.strictEqual(revokeJson.user.passwordHash, undefined);
      assert.strictEqual(revokeJson.user.salt, undefined);

      // Authoritative read-back
      const getRes = await fetch(`${baseUrl}/${paidMember.id}`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      assert.strictEqual(getRes.status, 200);
      const getJson = await getRes.json();
      assert.strictEqual(getJson.user.plan, 'Free');
      assert.strictEqual(getJson.user.membershipStatus, 'Revoked');
      assert.strictEqual(getJson.user.paymentStatus, 'Paid');
      assert.strictEqual(getJson.user.adminNotes, 'Membership ended without erasing payment history');
    });

    await runTest('2. Admin PUT /api/users/:id strictly rejects protected, unknown, and invalid fields with HTTP 400', async () => {
      const invalidPayloads = [
        { role: 'Super Admin' },
        { permissions: ['*'] },
        { walletBalance: 999999 },
        { passwordHash: 'tampered' },
        { id: 'another-id' },
        { _id: 'mongo-id' },
        { unknownArbitraryField: 'bad' },
        { plan: 'Enterprise' },
        { membershipStatus: 'SuspendedForever' },
        { paymentStatus: 'Freebie' },
        { autoRenew: 'true' },
        { expiryDate: '2026-02-31' },
        { expiryDate: 'not-a-valid-date' },
        { renewalCount: -5 },
        {}
      ];

      for (const badPayload of invalidPayloads) {
        const res = await fetch(`${baseUrl}/${paidMember.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`
          },
          body: JSON.stringify(badPayload)
        });
        assert.strictEqual(
          res.status,
          400,
          `Payload ${JSON.stringify(badPayload)} must be rejected with 400 (got ${res.status})`
        );
      }
    });

    await runTest('3. Ordinary Admin cannot modify a Super Admin via PUT /api/users/:id (403)', async () => {
      const res = await fetch(`${baseUrl}/${superAdmin.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({ plan: 'Free' })
      });
      assert.strictEqual(res.status, 403);
    });

    await runTest('4. Normal user cannot modify protected fields or another user profile via PUT /api/users/:id', async () => {
      const selfRes = await fetch(`${baseUrl}/${paidMember.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${memberToken}`
        },
        body: JSON.stringify({ name: 'Paid Member Updated', plan: 'Premium', role: 'Super Admin', walletBalance: 50000 })
      });
      assert.strictEqual(selfRes.status, 200);
      const selfJson = await selfRes.json();
      assert.strictEqual(selfJson.user.name, 'Paid Member Updated');
      assert.strictEqual(selfJson.user.plan, 'Free', 'Self-update must not restore revoked plan');
      assert.strictEqual(selfJson.user.role, 'Employer', 'Self-update must not escalate role');

      const otherRes = await fetch(`${baseUrl}/${deletableMember.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${memberToken}`
        },
        body: JSON.stringify({ name: 'Hacked' })
      });
      assert.strictEqual(otherRes.status, 403);
    });

    await runTest('5. DELETE /api/users/:id enforces auth, permissions, invalid ID, and 404 checks', async () => {
      const unauthRes = await fetch(`${baseUrl}/${deletableMember.id}`, { method: 'DELETE' });
      assert.strictEqual(unauthRes.status, 401);

      const memberDelRes = await fetch(`${baseUrl}/${deletableMember.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${memberToken}` }
      });
      assert.strictEqual(memberDelRes.status, 403);

      const modDelRes = await fetch(`${baseUrl}/${deletableMember.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${modToken}` }
      });
      assert.strictEqual(modDelRes.status, 403);

      const invalidIdRes = await fetch(`${baseUrl}/%20%20`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      assert.strictEqual(invalidIdRes.status, 400);

      const missingRes = await fetch(`${baseUrl}/non-existent-user-id`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      assert.strictEqual(missingRes.status, 404);
    });

    await runTest('6. DELETE /api/users/:id blocks self-delete, Admin deleting Super Admin, protected system account, and last Super Admin', async () => {
      // Self-deletion blocked
      const selfDelRes = await fetch(`${baseUrl}/${adminUser.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      assert.strictEqual(selfDelRes.status, 403);

      // Ordinary Admin deleting Super Admin blocked
      const adminDelSaRes = await fetch(`${baseUrl}/${superAdminSecondary.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      assert.strictEqual(adminDelSaRes.status, 403);

      // Protected system account blocked
      const sysDelRes = await fetch(`${baseUrl}/${systemProtectedUser.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${saToken}` }
      });
      assert.strictEqual(sysDelRes.status, 403);

      // Super Admin can delete secondary Super Admin when another remains
      const saDelSecondaryRes = await fetch(`${baseUrl}/${superAdminSecondary.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${saToken}` }
      });
      assert.strictEqual(saDelSecondaryRes.status, 200);

      // Last remaining Super Admin cannot delete self (403)
      const saSelfDelRes = await fetch(`${baseUrl}/${superAdmin.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${saToken}` }
      });
      assert.strictEqual(saSelfDelRes.status, 403);
    });

    await runTest('7. DELETE /api/users/:id permanently deletes target user without cascading to jobs, applications, transactions, subscribers, or audit logs', async () => {
      // Track unrelated records in isolated repositories before deleting user
      const subRecord = await SubscriberRepository.createAdminSubscriber({
        id: 'sub-keep-after-del',
        name: 'Deletable Member Subscriber',
        email: deletableMember.email,
        phone: '+923001234567',
        status: 'Active',
        subscribedAt: new Date().toISOString()
      });

      const preJobs = await JobRepository.getAll({});
      const preApps = await ApplicationRepository.getAllAsync();
      const prePays = await PaymentRepository.getAllAsync();
      const preAuditCount = recordedAudits.length;

      const delRes = await fetch(`${baseUrl}/${deletableMember.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      assert.strictEqual(delRes.status, 200);
      const delJson = await delRes.json();
      assert.strictEqual(delJson.success, true);
      assert.strictEqual(delJson.deletedId, deletableMember.id);

      // Read-back confirms deletion
      const readBackRes = await fetch(`${baseUrl}/${deletableMember.id}`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      assert.strictEqual(readBackRes.status, 404);

      const listRes = await fetch(`${baseUrl}`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      assert.strictEqual(listRes.status, 200);
      const listJson = await listRes.json();
      assert.strictEqual(listJson.users.some((u: any) => u.id === deletableMember.id), false);

      // Unrelated domain records remain untouched
      const keptSub = await SubscriberRepository.getById(subRecord.id);
      assert.ok(keptSub, 'Subscriber record must NOT be cascade-deleted');
      assert.strictEqual((await JobRepository.getAll({})).total, preJobs.total);
      assert.strictEqual((await ApplicationRepository.getAllAsync()).length, preApps.length);
      assert.strictEqual((await PaymentRepository.getAllAsync()).length, prePays.length);

      // Safe audit entry recorded without secrets
      assert.ok(recordedAudits.length > preAuditCount, 'Audit log must record user deletion');
      const lastAudit = recordedAudits[recordedAudits.length - 1];
      assert.strictEqual(lastAudit.action, 'User Account Deleted');
      assert.strictEqual(lastAudit.metadata?.targetUserId, deletableMember.id);
      assert.strictEqual(JSON.stringify(lastAudit).includes('passwordHash'), false);
    });

    await runTest('8. Audit logging failure does NOT fail an otherwise successful PUT or DELETE user mutation', async () => {
      const tempUser = await UserRepository.createAsync({
        id: 'usr-audit-fail-test',
        name: 'Audit Resilience User',
        email: 'audit.resilience@test.local',
        role: 'Employer',
        plan: 'Premium',
        membershipStatus: 'Active',
        paymentStatus: 'Paid'
      });

      shouldFailAudit = true;

      const putRes = await fetch(`${baseUrl}/${tempUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({ plan: 'Free', membershipStatus: 'Revoked', autoRenew: false })
      });
      assert.strictEqual(putRes.status, 200);
      const putJson = await putRes.json();
      assert.strictEqual(putJson.success, true);
      assert.strictEqual(putJson.user.membershipStatus, 'Revoked');
      assert.strictEqual(putJson.user.paymentStatus, 'Paid');

      const delRes = await fetch(`${baseUrl}/${tempUser.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      assert.strictEqual(delRes.status, 200);
      const delJson = await delRes.json();
      assert.strictEqual(delJson.success, true);
      assert.strictEqual(await UserRepository.getByIdAsync(tempUser.id), null);

      shouldFailAudit = false;
    });

    await runTest('9. Protected files and data/*.json checksums remain byte-for-byte identical', async () => {
      const postDataSnapshot = getDataSnapshot();
      const postMongoHash = getFileHash('server/db/mongodb.ts');
      assert.strictEqual(postMongoHash, preMongoHash, 'server/db/mongodb.ts must remain untouched');
      assert.deepStrictEqual(postDataSnapshot, preDataSnapshot, 'data/*.json files must remain byte-for-byte untouched');
    });
  } finally {
    AuditRepository.add = originalAuditAdd;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  console.log('==================================================================');
  console.log(` TEST SUMMARY: ${passed} passed, ${failed} failed`);
  console.log('==================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runUserManagementIntegrityTests().catch((err) => {
  console.error('Fatal error in user_management_integrity_tests:', err);
  process.exit(1);
});
