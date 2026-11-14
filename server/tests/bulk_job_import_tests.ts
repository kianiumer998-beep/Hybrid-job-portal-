import assert from 'assert';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import express from 'express';
import { createServer, Server } from 'http';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// Ensure strict isolated test mode before importing repositories/routes
process.env.IS_TEST = 'true';
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = '';
process.env.MONGO_URI = '';

import { processBackupImportJson, AdminDataBackupHub } from '../../src/components/admin/AdminDataBackupHub';
import { jobRouter } from '../routes/jobRoutes';
import { JobRepository } from '../db/repositories/JobRepository';
import { AuditRepository } from '../db/repositories/AuditRepository';
import { UserRepository } from '../db/repositories/UserRepository';
import { authMiddleware, createToken } from '../auth/authManager';

const DATA_DIR = path.resolve(process.cwd(), 'data');

interface DataSnapshot {
  files: Record<string, string>;
}

function getDataDirectorySnapshot(): DataSnapshot {
  const snapshot: DataSnapshot = { files: {} };
  if (!fs.existsSync(DATA_DIR)) return snapshot;
  for (const entry of fs.readdirSync(DATA_DIR)) {
    if (entry.endsWith('.json')) {
      const fullPath = path.join(DATA_DIR, entry);
      const content = fs.readFileSync(fullPath);
      snapshot.files[entry] = crypto.createHash('sha256').update(content).digest('hex');
    }
  }
  return snapshot;
}

function assertDataSnapshotUnchanged(initial: DataSnapshot, current: DataSnapshot): void {
  const initialKeys = Object.keys(initial.files).sort();
  const currentKeys = Object.keys(current.files).sort();
  assert.deepStrictEqual(
    currentKeys,
    initialKeys,
    `Data directory JSON file list changed! Expected [${initialKeys.join(', ')}], got [${currentKeys.join(', ')}]`
  );
  for (const file of initialKeys) {
    assert.strictEqual(
      current.files[file],
      initial.files[file],
      `Data file data/${file} was modified during tests`
    );
  }
}

async function runTests() {
  console.log('=== Starting STEP-C.2 Bulk Job Import Validation, Safety & Results Test Suite ===\n');

  const initialSnapshot = getDataDirectorySnapshot();
  let passed = 0;
  let failed = 0;

  const runTest = async (name: string, fn: () => Promise<void> | void) => {
    try {
      await fn();
      passed++;
      console.log(`✓ [PASS] ${name}`);
    } catch (err: any) {
      failed++;
      console.error(`✗ [FAIL] ${name}`);
      console.error(`  -> ${err?.stack || err?.message || err}`);
    }
  };

  // ==========================================
  // SECTION 1: FRONTEND VALIDATION TESTS (processBackupImportJson)
  // ==========================================
  console.log('--- Section 1: Frontend JSON Validation (processBackupImportJson) ---');

  await runTest('1.1. Valid single-job array passes validation and invokes callback once', () => {
    let called = 0;
    let received: any[] = [];
    const payload = JSON.stringify([{ title: 'Backend Engineer', company: 'Acme PK', city: 'Lahore' }]);
    const res = processBackupImportJson(payload, (jobs) => {
      called++;
      received = jobs;
    });
    assert.strictEqual(res.status, 'success');
    assert.strictEqual(res.kind, 'job-array');
    assert.strictEqual(res.importedCount, 1);
    assert.strictEqual(called, 1);
    assert.strictEqual(received.length, 1);
  });

  await runTest('1.2. Valid multiple-job array passes validation and preserves all records', () => {
    const payload = JSON.stringify([
      { title: 'Frontend Engineer', company: 'Beta Tech', city: 'Karachi' },
      { title: 'QA Lead', company: 'Gamma Labs', province: 'Punjab' }
    ]);
    let received: any[] = [];
    const res = processBackupImportJson(payload, (jobs) => {
      received = jobs;
    });
    assert.strictEqual(res.status, 'success');
    assert.strictEqual(res.importedCount, 2);
    assert.strictEqual(received.length, 2);
  });

  await runTest('1.3. Empty input is rejected without calling callback', () => {
    for (const raw of ['', '   ', '\n\t']) {
      let called = false;
      const res = processBackupImportJson(raw, () => {
        called = true;
      });
      assert.strictEqual(res.status, 'error');
      assert.strictEqual(res.importedCount, 0);
      assert.strictEqual(called, false);
    }
  });

  await runTest('1.4. Invalid JSON syntax is rejected without calling callback', () => {
    let called = false;
    const res = processBackupImportJson('[{ "title": "Broken"', () => {
      called = true;
    });
    assert.strictEqual(res.status, 'error');
    assert.ok(res.message.includes('Invalid JSON'));
    assert.strictEqual(called, false);
  });

  await runTest('1.5. Non-array JSON (object, string, number, boolean, null) is rejected', () => {
    for (const raw of ['{"title":"Single Object"}', '"hello"', '123', 'true', 'null']) {
      let called = false;
      const res = processBackupImportJson(raw, () => {
        called = true;
      });
      assert.strictEqual(res.status, 'error');
      assert.strictEqual(called, false);
    }
  });

  await runTest('1.6. Empty array [] is rejected', () => {
    let called = false;
    const res = processBackupImportJson('[]', () => {
      called = true;
    });
    assert.strictEqual(res.status, 'error');
    assert.ok(res.message.toLowerCase().includes('empty'));
    assert.strictEqual(called, false);
  });

  await runTest('1.7. Array containing null is rejected with record index', () => {
    let called = false;
    const res = processBackupImportJson(
      JSON.stringify([{ title: 'Valid', company: 'Co', city: 'Lahore' }, null]),
      () => {
        called = true;
      }
    );
    assert.strictEqual(res.status, 'error');
    assert.ok(res.message.includes('index 1'));
    assert.strictEqual(called, false);
  });

  await runTest('1.8. Array containing primitive values is rejected with record index', () => {
    for (const prim of ['string-val', 42, true]) {
      let called = false;
      const res = processBackupImportJson(JSON.stringify([prim]), () => {
        called = true;
      });
      assert.strictEqual(res.status, 'error');
      assert.ok(res.message.includes('index 0'));
      assert.strictEqual(called, false);
    }
  });

  await runTest('1.9. Array containing nested array is rejected with record index', () => {
    let called = false;
    const res = processBackupImportJson(
      JSON.stringify([[{ title: 'Nested', company: 'Co' }]]),
      () => {
        called = true;
      }
    );
    assert.strictEqual(res.status, 'error');
    assert.ok(res.message.includes('index 0'));
    assert.strictEqual(called, false);
  });

  await runTest('1.10. Object missing title or empty title is rejected with record index', () => {
    for (const badJob of [{ company: 'Acme' }, { title: '   ', company: 'Acme' }, { title: 123, company: 'Acme' }]) {
      let called = false;
      const res = processBackupImportJson(JSON.stringify([badJob]), () => {
        called = true;
      });
      assert.strictEqual(res.status, 'error');
      assert.ok(res.message.includes('index 0'));
      assert.strictEqual(called, false);
    }
  });

  await runTest('1.11. Object missing company or invalid company type is rejected with record index', () => {
    for (const badJob of [
      { title: 'Dev' },
      { title: 'Dev', company: '   ' },
      { title: 'Dev', company: 999 },
      { title: 'Dev', company: null }
    ]) {
      let called = false;
      const res = processBackupImportJson(JSON.stringify([badJob]), () => {
        called = true;
      });
      assert.strictEqual(res.status, 'error');
      assert.ok(res.message.includes('index 0'));
      assert.strictEqual(called, false);
    }
  });

  await runTest('1.12. Array exceeding 500 records is rejected', () => {
    const oversized = Array.from({ length: 501 }, (_, idx) => ({
      title: `Job ${idx}`,
      company: 'Scale Corp',
      city: 'Lahore'
    }));
    let called = false;
    const res = processBackupImportJson(JSON.stringify(oversized), () => {
      called = true;
    });
    assert.strictEqual(res.status, 'error');
    assert.ok(res.message.includes('500'));
    assert.strictEqual(called, false);
  });

  await runTest('1.13. Full system snapshot payload is rejected and restore remains disabled', () => {
    let called = false;
    const snapshot = JSON.stringify({
      snapshotVersion: '2.5.0-ENTERPRISE',
      jobs: [{ title: 'Dev', company: 'Co' }],
      users: [{ id: 'u1', name: 'Admin' }]
    });
    const res = processBackupImportJson(snapshot, () => {
      called = true;
    });
    assert.strictEqual(res.status, 'rejected');
    assert.strictEqual(res.kind, 'full-snapshot');
    assert.strictEqual(called, false);
  });

  await runTest('1.14. Mixed valid + malformed array rejects entire batch without silently discarding bad rows', () => {
    let called = false;
    const mixed = JSON.stringify([
      { title: 'Good Job 1', company: 'Valid Co', city: 'Lahore' },
      { title: 'Bad Job 2', company: '' },
      { title: 'Good Job 3', company: 'Valid Co', city: 'Karachi' }
    ]);
    const res = processBackupImportJson(mixed, () => {
      called = true;
    });
    assert.strictEqual(res.status, 'error');
    assert.strictEqual(res.importedCount, 0);
    assert.ok(res.message.includes('index 1'));
    assert.strictEqual(called, false);
  });

  // ==========================================
  // SECTION 2: BACKEND ENDPOINT VALIDATION, SECURITY & PERSISTENCE TESTS
  // ==========================================
  console.log('\n--- Section 2: Backend POST /api/jobs/admin-import Validation & Persistence Safety ---');

  // Isolated in-memory store simulating existing production jobs
  const inMemoryJobsStore = new Map<string, any>();
  const existingProtectedJob = {
    id: 'existing-protected-job-101',
    slug: 'existing-protected-job-101-slug',
    title: 'Original Protected Position',
    company: 'Original Protected Corp',
    city: 'Islamabad',
    country: 'Pakistan',
    status: 'Approved',
    submittedByUserId: 'legit-owner-77',
    applicationsCount: 42,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z'
  };
  inMemoryJobsStore.set(existingProtectedJob.id, JSON.parse(JSON.stringify(existingProtectedJob)));

  let failOnTitles = new Set<string>();
  let returnFalsyOnTitles = new Set<string>();
  let createCallCount = 0;
  let auditEntries: any[] = [];

  const originalCreate = JobRepository.create;
  const originalAuditAdd = AuditRepository.add;
  const originalGetUserByIdAsync = UserRepository.getByIdAsync;

  const testAdminUser = { id: 'admin-import-tester', name: 'Import Admin', role: 'Super Admin' };
  const testSeoUser = { id: 'seo-user-tester', name: 'SEO Only', role: 'SEO Manager' };

  UserRepository.getByIdAsync = async (id: string) => {
    if (id === testAdminUser.id) return testAdminUser;
    if (id === testSeoUser.id) return testSeoUser;
    return null;
  };

  AuditRepository.add = async (entry: any) => {
    auditEntries.push(entry);
    return entry;
  };

  JobRepository.create = async (jobData: any) => {
    createCallCount++;
    if (failOnTitles.has(jobData.title)) {
      throw new Error(`Simulated DB write error for "${jobData.title}"`);
    }
    if (returnFalsyOnTitles.has(jobData.title)) {
      return null;
    }
    const saved = {
      ...jobData,
      visibilitySource: jobData.sourceType || 'admin_created'
    };
    inMemoryJobsStore.set(saved.id, JSON.parse(JSON.stringify(saved)));
    return JSON.parse(JSON.stringify(saved));
  };

  const adminToken = createToken({ userId: testAdminUser.id, id: testAdminUser.id, role: testAdminUser.role, name: testAdminUser.name });
  const seoToken = createToken({ userId: testSeoUser.id, id: testSeoUser.id, role: testSeoUser.role, name: testSeoUser.name });

  const app = express();
  app.use(express.json({ limit: '5mb' }));
  app.use(authMiddleware);
  app.use('/api/jobs', jobRouter);

  const server: Server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as { port: number };
  const endpoint = `http://127.0.0.1:${address.port}/api/jobs/admin-import`;

  const postImport = async (body: unknown, token: string | null = adminToken) => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });
  };

  try {
    await runTest('2.1. Route requires admin authentication and jobs.manage permission (401/403)', async () => {
      const unauthRes = await postImport({ jobs: [{ title: 'Test', company: 'Co', city: 'Lahore' }] }, null);
      assert.strictEqual(unauthRes.status, 401);

      const forbiddenRes = await postImport({ jobs: [{ title: 'Test', company: 'Co', city: 'Lahore' }] }, seoToken);
      assert.strictEqual(forbiddenRes.status, 403);
      assert.strictEqual(createCallCount, 0);
    });

    await runTest('2.2. Backend validation rejects empty array, non-array, >500 records, and snapshot payload with zero DB writes', async () => {
      createCallCount = 0;

      const emptyRes = await postImport({ jobs: [] });
      assert.strictEqual(emptyRes.status, 400);

      const nonArrRes = await postImport({ jobs: { title: 'Not Array' } });
      assert.strictEqual(nonArrRes.status, 400);

      const overLimit = Array.from({ length: 501 }, (_, i) => ({ title: `J${i}`, company: 'Co', city: 'Lahore' }));
      const limitRes = await postImport({ jobs: overLimit });
      assert.strictEqual(limitRes.status, 400);

      const snapRes = await postImport({
        snapshotVersion: '2.5.0',
        jobs: [{ title: 'Snap Job', company: 'Co', city: 'Lahore' }],
        users: []
      });
      assert.strictEqual(snapRes.status, 400);

      assert.strictEqual(createCallCount, 0, 'Pre-validation failures must NEVER trigger any repository write');
    });

    await runTest('2.3. Backend rejects null, primitives, nested arrays, missing/invalid title or company, missing location, invalid description/array fields', async () => {
      const invalidCases: Array<{ label: string; jobs: any[] }> = [
        { label: 'null record', jobs: [null] },
        { label: 'primitive string record', jobs: ['raw-string'] },
        { label: 'primitive number record', jobs: [42] },
        { label: 'nested array record', jobs: [[{ title: 'A', company: 'B', city: 'Lahore' }]] },
        { label: 'missing title', jobs: [{ company: 'Acme', city: 'Lahore' }] },
        { label: 'empty title', jobs: [{ title: '   ', company: 'Acme', city: 'Lahore' }] },
        { label: 'missing company', jobs: [{ title: 'Dev', city: 'Lahore' }] },
        { label: 'invalid company type', jobs: [{ title: 'Dev', company: 123, city: 'Lahore' }] },
        { label: 'missing location', jobs: [{ title: 'Dev', company: 'Acme' }] },
        { label: 'invalid optional description type', jobs: [{ title: 'Dev', company: 'Acme', city: 'Lahore', description: 999 }] },
        { label: 'invalid optional tags array field', jobs: [{ title: 'Dev', company: 'Acme', city: 'Lahore', tags: 'not-an-array' }] },
        { label: 'invalid optional tags element type', jobs: [{ title: 'Dev', company: 'Acme', city: 'Lahore', tags: ['valid', 123] }] }
      ];

      createCallCount = 0;
      for (const tc of invalidCases) {
        const res = await postImport({ jobs: tc.jobs });
        assert.strictEqual(res.status, 400, `Expected 400 for ${tc.label}, got ${res.status}`);
        const data = await res.json();
        assert.strictEqual(data.success, false);
        assert.strictEqual(data.importedCount, 0);
        assert.ok(Array.isArray(data.errors) && data.errors.length > 0, `Expected errors array for ${tc.label}`);
        assert.strictEqual(data.errors[0].index, 0);
      }
      assert.strictEqual(createCallCount, 0, 'Zero writes should happen when any record fails pre-validation');
    });

    await runTest('2.4. Mixed batch with one invalid record rejects complete request before writing any job', async () => {
      createCallCount = 0;
      const res = await postImport({
        jobs: [
          { title: 'Valid First Job', company: 'Good Co', city: 'Lahore' },
          { title: 'Invalid Missing Location', company: 'Bad Co' }
        ]
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.importedCount, 0);
      assert.strictEqual(data.errors[0].index, 1);
      assert.strictEqual(createCallCount, 0, 'Valid first job must NOT be persisted if second job fails pre-validation');
    });

    await runTest('2.5. Salary, experienceLevel, and jobType remain optional if publication rules do not require them', async () => {
      createCallCount = 0;
      const res = await postImport({
        jobs: [{ title: 'Minimal Valid Govt Job', company: 'Public Dept', city: 'Quetta' }]
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.importedCount, 1);
      assert.strictEqual(data.failedCount, 0);
      assert.strictEqual(createCallCount, 1);
    });

    await runTest('2.6. Persistence safety: imported ID, slug, ownership, status, timestamps, and applicationsCount cannot spoof or overwrite existing jobs', async () => {
      const storeSizeBefore = inMemoryJobsStore.size;
      const res = await postImport({
        jobs: [
          {
            id: existingProtectedJob.id,
            slug: existingProtectedJob.slug,
            title: 'Attempted Overwrite Job',
            company: 'Attacker Import Co',
            city: 'Lahore',
            status: 'Pending',
            submittedByUserId: 'evil-user-999',
            postedByUserId: 'evil-poster-888',
            userId: 'evil-id-777',
            applicationsCount: 999,
            createdAt: '2000-01-01T00:00:00.000Z',
            updatedAt: '2000-01-01T00:00:00.000Z'
          }
        ]
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.importedCount, 1);
      assert.strictEqual(data.failedCount, 0);

      // Existing job MUST remain 100% untouched
      const protectedAfter = inMemoryJobsStore.get(existingProtectedJob.id);
      assert.deepStrictEqual(protectedAfter, existingProtectedJob, 'Existing job record must NEVER be overwritten');

      // New record must exist with a brand new server-generated ID and slug
      assert.strictEqual(inMemoryJobsStore.size, storeSizeBefore + 1);
      const createdRecord = Array.from(inMemoryJobsStore.values()).find((j) => j.title === 'Attempted Overwrite Job');
      assert.ok(createdRecord, 'Imported job must be stored as a new record');
      assert.notStrictEqual(createdRecord.id, existingProtectedJob.id, 'Imported ID must never be reused');
      assert.ok(createdRecord.id.startsWith('job-import-'), 'Server must generate fresh ID');
      assert.notStrictEqual(createdRecord.slug, existingProtectedJob.slug, 'Imported slug must never be reused');
      assert.strictEqual(createdRecord.status, 'Approved', 'Status must be forced to Approved');
      assert.strictEqual(createdRecord.applicationsCount, 0, 'applicationsCount must initialize to 0');
      assert.strictEqual(createdRecord.submittedByUserId, undefined, 'submittedByUserId must not be accepted from import JSON');
      assert.strictEqual(createdRecord.postedByUserId, undefined, 'postedByUserId must not be accepted from import JSON');
      assert.strictEqual(createdRecord.userId, undefined, 'userId must not be accepted from import JSON');
      assert.notStrictEqual(createdRecord.createdAt, '2000-01-01T00:00:00.000Z', 'Fresh createdAt timestamp required');
      assert.notStrictEqual(createdRecord.updatedAt, '2000-01-01T00:00:00.000Z', 'Fresh updatedAt timestamp required');
    });

    await runTest('2.7. Partial success: one repository failure does not inflate success count and subsequent records still persist', async () => {
      failOnTitles = new Set(['Failing Middle Job']);
      returnFalsyOnTitles = new Set(['Unconfirmed Falsy Job']);
      createCallCount = 0;

      const res = await postImport({
        jobs: [
          { title: 'Persisted First Job', company: 'Co A', city: 'Lahore' },
          { title: 'Failing Middle Job', company: 'Co B', city: 'Karachi' },
          { title: 'Unconfirmed Falsy Job', company: 'Co C', city: 'Multan' },
          { title: 'Persisted Last Job', company: 'Co D', city: 'Peshawar' }
        ]
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(createCallCount, 4, 'All 4 validated records must be attempted sequentially');
      assert.strictEqual(data.requestedCount, 4);
      assert.strictEqual(data.processed, 4);
      assert.strictEqual(data.importedCount, 2, 'Only confirmed saves may count as imported');
      assert.strictEqual(data.failedCount, 2);
      assert.strictEqual(data.partialSuccess, true);
      assert.strictEqual(data.errors.length, 2);
      assert.strictEqual(data.errors[0].index, 1);
      assert.ok(data.errors[0].message.includes('Simulated DB write error'));
      assert.strictEqual(data.errors[1].index, 2);

      failOnTitles.clear();
      returnFalsyOnTitles.clear();
    });

    await runTest('2.8. All-failure persistence response reports 0 imported and exact failure count (HTTP 500)', async () => {
      failOnTitles = new Set(['Fail One', 'Fail Two']);
      const res = await postImport({
        jobs: [
          { title: 'Fail One', company: 'Co 1', city: 'Lahore' },
          { title: 'Fail Two', company: 'Co 2', city: 'Karachi' }
        ]
      });

      assert.strictEqual(res.status, 500);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.requestedCount, 2);
      assert.strictEqual(data.processed, 2);
      assert.strictEqual(data.importedCount, 0);
      assert.strictEqual(data.failedCount, 2);
      assert.strictEqual(data.partialSuccess, false);
      assert.strictEqual(data.errors.length, 2);
      assert.strictEqual(data.errors[0].index, 0);
      assert.strictEqual(data.errors[1].index, 1);

      failOnTitles.clear();
    });
  } finally {
    JobRepository.create = originalCreate;
    AuditRepository.add = originalAuditAdd;
    UserRepository.getByIdAsync = originalGetUserByIdAsync;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  // ==========================================
  // SECTION 3: FRONTEND WIRING & SOURCE CONTRACT VERIFICATION
  // ==========================================
  console.log('\n--- Section 3: Frontend Async Integration & Source Contract Verification ---');

  await runTest('3.1. AdminDashboard no longer uses unsafe forEach(onAddJob) and awaits onImportBulkJobs', () => {
    const dashSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/AdminDashboard.tsx'), 'utf8');
    assert.strictEqual(dashSrc.includes('importedJobs.forEach((j) => onAddJob(j))'), false);
    assert.ok(dashSrc.includes('const handleImportBulkJobs = async (importedJobs: Job[])'));
    assert.ok(dashSrc.includes('return await onImportBulkJobs(importedJobs)'));
  });

  await runTest('3.2. App.tsx calls api.jobs.importBulk, refreshes once via loadBackendJobs, and propagates API errors', () => {
    const appSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/App.tsx'), 'utf8');
    assert.ok(appSrc.includes('const handleImportBulkJobs = async (importedJobs: Job[])'));
    assert.ok(appSrc.includes('api.jobs.importBulk(importedJobs)'));
    assert.ok(appSrc.includes('onImportBulkJobs={handleImportBulkJobs}'));
  });

  await runTest('3.3. api.ts exposes api.jobs.importBulk targeting POST /jobs/admin-import', () => {
    const apiSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/services/api.ts'), 'utf8');
    assert.ok(apiSrc.includes('async importBulk(jobs: any[])'));
    assert.ok(apiSrc.includes('/jobs/admin-import'));
  });

  await runTest('3.4. AdminDataBackupHub UI renders intact with async loading & duplicate-click protection', () => {
    const hubSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/admin/AdminDataBackupHub.tsx'), 'utf8');
    assert.ok(hubSrc.includes('isImporting'));
    assert.ok(hubSrc.includes('importInFlightRef'));
    assert.ok(hubSrc.includes('disabled={isImporting}'));

    const html = renderToStaticMarkup(React.createElement(AdminDataBackupHub));
    assert.ok(html.includes('Download System JSON Backup'));
    assert.ok(html.includes('Temporarily Unavailable'));
  });

  // ==========================================
  // SECTION 4: PROTECTED DATA INTEGRITY CHECK
  // ==========================================
  console.log('\n--- Section 4: Protected Data Integrity Check ---');
  await runTest('4.1. All production JSON data files remain byte-for-byte unchanged', () => {
    const finalSnapshot = getDataDirectorySnapshot();
    assertDataSnapshotUnchanged(initialSnapshot, finalSnapshot);
  });

  console.log(`\n=== STEP-C.2 Test Results: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test execution error:', err);
  process.exit(1);
});
