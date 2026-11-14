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
import {
  buildBulkMembershipEnforcementPlan,
  executeBulkMembershipEnforcement
} from '../../src/App';

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

    await runTest('9. STEP-A.1 Bulk enforcement fixes inconsistent Revoked + Premium/autoRenew:true accounts (past & future expiry) while preserving Revoked status and Paid history', async () => {
      const revokedPastExpiry = await UserRepository.createAsync({
        id: 'usr-revoked-inconsistent-past',
        name: 'Revoked Inconsistent Past',
        email: 'revoked.inconsistent.past@test.local',
        role: 'Employer',
        plan: 'Premium',
        membershipStatus: 'Revoked',
        paymentStatus: 'Paid',
        autoRenew: true,
        expiryDate: '2024-01-10 00:00',
        createdAt: '2024-01-01T00:00:00.000Z'
      });

      const revokedFutureExpiry = await UserRepository.createAsync({
        id: 'usr-revoked-inconsistent-future',
        name: 'Revoked Inconsistent Future',
        email: 'revoked.inconsistent.future@test.local',
        role: 'Employer',
        plan: 'Premium',
        membershipStatus: 'Revoked',
        paymentStatus: 'Paid',
        autoRenew: true,
        expiryDate: '2029-12-31 23:59',
        createdAt: '2025-01-01T00:00:00.000Z'
      });

      const updateCalls: Array<{ userId: string; updates: Record<string, any> }> = [];
      const authoritativeApplied: any[] = [];

      const result = await executeBulkMembershipEnforcement({
        users: [revokedPastExpiry as any, revokedFutureExpiry as any],
        jobs: [],
        pendingJobs: [],
        updateUserProfile: async (userId, updates) => {
          updateCalls.push({ userId, updates });
          const res = await fetch(`${baseUrl}/${userId}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${adminToken}`
            },
            body: JSON.stringify(updates)
          });
          return res.json();
        },
        bulkUpdateJobs: async () => ({ success: true }),
        reloadJobs: async () => {},
        applyAuthoritativeUserUpdate: (raw) => {
          authoritativeApplied.push(raw);
          return raw;
        },
        addAuditLog: async (entry) => AuditRepository.add({ user: adminUser.name, role: adminUser.role, ...entry })
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.updatedCount, 2);
      assert.strictEqual(updateCalls.length, 2);

      for (const uid of [revokedPastExpiry.id, revokedFutureExpiry.id]) {
        const readRes = await fetch(`${baseUrl}/${uid}`, {
          headers: { Authorization: `Bearer ${adminToken}` }
        });
        assert.strictEqual(readRes.status, 200);
        const readJson = await readRes.json();
        assert.strictEqual(readJson.user.plan, 'Free', `${uid} plan must become Free`);
        assert.strictEqual(readJson.user.membershipStatus, 'Revoked', `${uid} must remain Revoked`);
        assert.strictEqual(readJson.user.paymentStatus, 'Paid', `${uid} Paid paymentStatus must be preserved`);
        assert.strictEqual(readJson.user.autoRenew, false, `${uid} autoRenew must become false`);
      }

      // Verify expiry dates were preserved without mutation
      const pastRead = await UserRepository.getByIdAsync(revokedPastExpiry.id);
      const futureRead = await UserRepository.getByIdAsync(revokedFutureExpiry.id);
      assert.strictEqual(pastRead?.expiryDate, '2024-01-10 00:00');
      assert.strictEqual(futureRead?.expiryDate, '2029-12-31 23:59');
    });

    await runTest('10. STEP-A.1 Bulk enforcement skips redundant updates for consistent Revoked Paid and Revoked Unpaid accounts', async () => {
      const revokedConsistentPaid = {
        id: 'usr-revoked-clean-paid',
        name: 'Revoked Clean Paid',
        email: 'revoked.clean.paid@test.local',
        role: 'Employer',
        plan: 'Free' as const,
        membershipStatus: 'Revoked' as const,
        paymentStatus: 'Paid' as const,
        autoRenew: false,
        expiryDate: '2024-02-01 00:00',
        createdAt: '2024-01-01T00:00:00.000Z'
      };
      const revokedConsistentUnpaid = {
        id: 'usr-revoked-clean-unpaid',
        name: 'Revoked Clean Unpaid',
        email: 'revoked.clean.unpaid@test.local',
        role: 'Employer',
        plan: 'Free' as const,
        membershipStatus: 'Revoked' as const,
        paymentStatus: 'Unpaid' as const,
        autoRenew: false,
        expiryDate: '2024-02-01 00:00',
        createdAt: '2024-01-01T00:00:00.000Z'
      };

      const plan = buildBulkMembershipEnforcementPlan(
        [revokedConsistentPaid, revokedConsistentUnpaid],
        [],
        []
      );
      assert.strictEqual(plan.allUpdateTargets.length, 0, 'Consistent Revoked accounts must not enqueue updates');
      assert.strictEqual(plan.expiredTargets.length, 0);
      assert.strictEqual(plan.unpaidTargets.length, 0);
      assert.strictEqual(plan.revokedTargets.length, 0);

      let apiPutCalled = false;
      const res = await executeBulkMembershipEnforcement({
        users: [revokedConsistentPaid, revokedConsistentUnpaid],
        jobs: [],
        pendingJobs: [],
        updateUserProfile: async () => {
          apiPutCalled = true;
          return { success: true };
        },
        bulkUpdateJobs: async () => ({ success: true }),
        reloadJobs: async () => {},
        applyAuthoritativeUserUpdate: (raw) => raw,
        addAuditLog: async () => {}
      });

      assert.strictEqual(apiPutCalled, false, 'No backend PUT call may occur for consistent Revoked users');
      assert.strictEqual(res.updatedCount, 0);
      assert.strictEqual(revokedConsistentPaid.paymentStatus, 'Paid');
      assert.strictEqual(revokedConsistentUnpaid.paymentStatus, 'Unpaid');
    });

    await runTest('11. STEP-A.1 Expired-only Paid account stays Expired (not Unpaid) and preserves Paid paymentStatus', async () => {
      const expiredPaidUser = await UserRepository.createAsync({
        id: 'usr-expired-paid-1',
        name: 'Expired Paid User',
        email: 'expired.paid@test.local',
        role: 'Employer',
        plan: 'Premium',
        membershipStatus: 'Active',
        paymentStatus: 'Paid',
        autoRenew: true,
        expiryDate: '2024-05-01 00:00',
        createdAt: '2024-04-01T00:00:00.000Z'
      });

      const plan = buildBulkMembershipEnforcementPlan([expiredPaidUser as any], [], []);
      assert.strictEqual(plan.expiredTargets.length, 1);
      assert.strictEqual(plan.unpaidTargets.length, 0);
      assert.strictEqual(plan.revokedTargets.length, 0);

      const res = await executeBulkMembershipEnforcement({
        users: [expiredPaidUser as any],
        jobs: [],
        pendingJobs: [],
        updateUserProfile: async (userId, updates) => {
          const put = await fetch(`${baseUrl}/${userId}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${adminToken}`
            },
            body: JSON.stringify(updates)
          });
          return put.json();
        },
        bulkUpdateJobs: async () => ({ success: true }),
        reloadJobs: async () => {},
        applyAuthoritativeUserUpdate: (raw) => raw,
        addAuditLog: async (entry) => AuditRepository.add({ user: adminUser.name, role: adminUser.role, ...entry })
      });

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.updatedCount, 1);

      const persisted = await UserRepository.getByIdAsync(expiredPaidUser.id);
      assert.strictEqual(persisted?.membershipStatus, 'Expired');
      assert.strictEqual(persisted?.paymentStatus, 'Paid');
      assert.strictEqual(persisted?.plan, 'Free');
      assert.strictEqual(persisted?.autoRenew, false);
    });

    await runTest('12. STEP-A.1 Failed backend user update reports failure and skips suspending that user jobs while suspending succeeded users jobs', async () => {
      const failingRevokedUser = {
        id: 'usr-failing-revoked',
        name: 'Failing Revoked User',
        email: 'failing.revoked@test.local',
        role: 'Employer',
        plan: 'Premium' as const,
        membershipStatus: 'Revoked' as const,
        paymentStatus: 'Paid' as const,
        autoRenew: true,
        createdAt: '2025-01-01T00:00:00.000Z'
      };
      const succeedingUnpaidUser = {
        id: 'usr-succeeding-unpaid',
        name: 'Succeeding Unpaid User',
        email: 'succeeding.unpaid@test.local',
        role: 'Employer',
        plan: 'Premium' as const,
        membershipStatus: 'Active' as const,
        paymentStatus: 'Unpaid' as const,
        autoRenew: true,
        createdAt: '2025-01-01T00:00:00.000Z'
      };
      const activePaidUser = {
        id: 'usr-active-valid',
        name: 'Valid Active User',
        email: 'valid.active@test.local',
        role: 'Employer',
        plan: 'Premium' as const,
        membershipStatus: 'Active' as const,
        paymentStatus: 'Paid' as const,
        autoRenew: true,
        expiryDate: '2029-12-31 23:59',
        createdAt: '2025-01-01T00:00:00.000Z'
      };

      const testJobs: any[] = [
        { id: 'job-fail-user', title: 'Job A', submittedByUserId: failingRevokedUser.id, status: 'Approved' },
        { id: 'job-ok-user', title: 'Job B', submittedByUserId: succeedingUnpaidUser.id, status: 'Approved' },
        { id: 'job-active-user', title: 'Job C', submittedByUserId: activePaidUser.id, status: 'Approved' }
      ];

      let suspendedBatches: any[] = [];
      const res = await executeBulkMembershipEnforcement({
        users: [failingRevokedUser, succeedingUnpaidUser, activePaidUser],
        jobs: testJobs,
        pendingJobs: [],
        updateUserProfile: async (userId, updates) => {
          if (userId === failingRevokedUser.id) {
            return { success: false, message: 'Simulated HTTP 500 error' };
          }
          return {
            success: true,
            user: { ...succeedingUnpaidUser, ...updates }
          };
        },
        bulkUpdateJobs: async (updatedJobs) => {
          suspendedBatches = updatedJobs;
          return { success: true };
        },
        reloadJobs: async () => {},
        applyAuthoritativeUserUpdate: (raw) => raw,
        addAuditLog: async () => {}
      });

      assert.strictEqual(res.success, false, 'Partial failure must NOT report success');
      assert.strictEqual(res.failedUsers.length, 1);
      assert.strictEqual(res.failedUsers[0].userId, failingRevokedUser.id);
      assert.strictEqual(res.updatedCount, 1);
      assert.strictEqual(res.suspendedJobsCount, 1);
      assert.deepStrictEqual(suspendedBatches.map(j => j.id), ['job-ok-user'], 'Only succeeded inactive user jobs may be suspended; failed user and active user jobs must NOT be suspended');
    });

    await runTest('13. STEP-A.1 Existing Unpaid enforcement behavior downgrades Premium Unpaid to Free/Revoked/autoRenew:false with past expiry', async () => {
      const unpaidUser = await UserRepository.createAsync({
        id: 'usr-unpaid-enforce-1',
        name: 'Unpaid Enforce User',
        email: 'unpaid.enforce@test.local',
        role: 'Employer',
        plan: 'Premium',
        membershipStatus: 'Active',
        paymentStatus: 'Unpaid',
        autoRenew: true,
        expiryDate: '2029-12-31 23:59',
        createdAt: '2025-01-01T00:00:00.000Z'
      });

      let suspendedJobIds: string[] = [];
      const res = await executeBulkMembershipEnforcement({
        users: [unpaidUser as any],
        jobs: [
          { id: 'job-unpaid-1', title: 'Unpaid Job', submittedByUserId: unpaidUser.id, status: 'Approved' } as any,
          { id: 'job-already-susp', title: 'Already Suspended', submittedByUserId: unpaidUser.id, status: 'Suspended' } as any
        ],
        pendingJobs: [],
        updateUserProfile: async (userId, updates) => {
          const put = await fetch(`${baseUrl}/${userId}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${adminToken}`
            },
            body: JSON.stringify(updates)
          });
          return put.json();
        },
        bulkUpdateJobs: async (updatedJobs) => {
          suspendedJobIds = updatedJobs.map(j => j.id);
          return { success: true };
        },
        reloadJobs: async () => {},
        applyAuthoritativeUserUpdate: (raw) => raw,
        addAuditLog: async (entry) => AuditRepository.add({ user: adminUser.name, role: adminUser.role, ...entry })
      });

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.updatedCount, 1);
      assert.deepStrictEqual(suspendedJobIds, ['job-unpaid-1']);

      const persisted = await UserRepository.getByIdAsync(unpaidUser.id);
      assert.strictEqual(persisted?.plan, 'Free');
      assert.strictEqual(persisted?.membershipStatus, 'Revoked');
      assert.strictEqual(persisted?.autoRenew, false);
      assert.ok(new Date(persisted!.expiryDate!).getTime() < Date.now(), 'Unpaid user expiry must be moved to the past');
    });

    await runTest('14. Protected files and data/*.json checksums remain byte-for-byte identical', async () => {
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
