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
import { Database } from '../db/database';
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

  await runTest('1.15. Frontend rejects invalid string-array elements consistently (not only Array.isArray)', () => {
    for (const field of ['tags', 'requirements', 'benefits', 'responsibilities', 'responsibilitiesList', 'advertisedPositions', 'relatedSourceUrls', 'duplicateTags']) {
      let called = false;
      const res = processBackupImportJson(
        JSON.stringify([{ title: 'Valid Role', company: 'Valid Co', city: 'Lahore', [field]: ['ok-item', 42] }]),
        () => {
          called = true;
        }
      );
      assert.strictEqual(res.status, 'error', `Frontend should reject non-string element in ${field}`);
      assert.ok(res.message.includes(field));
      assert.strictEqual(called, false);
    }
  });

  await runTest('1.16. Frontend rejects non-job and NEEDS_REVIEW markers before invoking callback', () => {
    const markerPayloads = [
      { title: 'News Article', company: 'Daily News', city: 'Lahore', isNonJob: true },
      { title: 'Blog Post', company: 'Daily News', city: 'Lahore', classificationState: 'NON_JOB' },
      { title: 'Press Release', company: 'Daily News', city: 'Lahore', reviewStatus: 'NON_JOB' },
      { title: 'Uncertain Row', company: 'Org', city: 'Lahore', classificationState: 'NEEDS_REVIEW' },
      { title: 'Uncertain Row 2', company: 'Org', city: 'Lahore', reviewStatus: 'NEEDS_REVIEW' }
    ];
    for (const rec of markerPayloads) {
      let called = false;
      const res = processBackupImportJson(JSON.stringify([rec]), () => {
        called = true;
      });
      assert.strictEqual(res.status, 'error');
      assert.strictEqual(called, false);
      assert.ok(res.errors && res.errors[0].index === 0);
    }
  });

  await runTest('1.17. Frontend validates JobAttachment objects strictly and preserves valid attachments', () => {
    const invalidAttachments = [
      'not-an-array',
      [null],
      [['nested']],
      [{ id: 'a1', name: 'Ad', fileUrl: 'https://x.test/a.pdf', fileType: 'application/pdf' }], // missing uploadedAt
      [{ id: ' ', name: 'Ad', fileUrl: 'https://x.test/a.pdf', fileType: 'application/pdf', uploadedAt: '2026-01-01T00:00:00Z' }],
      [{ id: 'a1', name: 'Ad', fileUrl: 'https://x.test/a.pdf', fileType: 'application/pdf', uploadedAt: '2026-01-01T00:00:00Z', isPublic: 'yes' }],
      [{ id: 'a1', name: 'Ad', fileUrl: 'https://x.test/a.pdf', fileType: 'application/pdf', uploadedAt: '2026-01-01T00:00:00Z', sizeBytes: -5 }],
      [{ id: 'a1', name: 'Ad', fileUrl: 'https://x.test/a.pdf', fileType: 'application/pdf', uploadedAt: '2026-01-01T00:00:00Z', fileName: 123 }]
    ];
    for (const badAtt of invalidAttachments) {
      let called = false;
      const res = processBackupImportJson(
        JSON.stringify([{ title: 'Valid', company: 'Co', city: 'Lahore', attachments: badAtt }]),
        () => {
          called = true;
        }
      );
      assert.strictEqual(res.status, 'error');
      assert.ok(res.errors && res.errors[0].index === 0);
      assert.strictEqual(called, false);
    }

    const validAtt = {
      id: 'att-1',
      name: 'Official Gazette Notice',
      fileUrl: 'https://cdn.example.com/notice.pdf',
      fileType: 'application/pdf',
      uploadedAt: '2026-11-14T00:00:00.000Z',
      fileName: 'notice.pdf',
      description: 'Official PDF clipping',
      isPublic: true,
      sizeBytes: 102400
    };
    let received: any[] = [];
    const okRes = processBackupImportJson(
      JSON.stringify([{ title: 'With Attachment', company: 'Public Co', city: 'Lahore', attachments: [validAtt] }]),
      (jobs) => {
        received = jobs;
      }
    );
    assert.strictEqual(okRes.status, 'success');
    assert.deepStrictEqual(received[0].attachments, [validAtt]);
  });

  await runTest('1.18. Frontend atomic validation counts reconcile requestedCount, processed, failedCount, importedCount=0, skippedDuplicateCount=0', () => {
    let called = false;
    const mixedFour = JSON.stringify([
      { title: 'Valid Frontend 1', company: 'Co A', city: 'Lahore' },
      { title: 'Valid Frontend 2', company: 'Co B', city: 'Karachi' },
      { title: 'Invalid Frontend 3', company: '' },
      { title: 'Valid Frontend 4', company: 'Co D', city: 'Islamabad' }
    ]);
    const res = processBackupImportJson(mixedFour, () => {
      called = true;
    });
    assert.strictEqual(called, false);
    assert.strictEqual(res.status, 'error');
    assert.strictEqual(res.requestedCount, 4);
    assert.strictEqual(res.processed, 4);
    assert.strictEqual(res.failedCount, 4, 'Entire 4-record batch rejected before persistence must report failedCount=4');
    assert.strictEqual(res.importedCount, 0);
    assert.strictEqual(res.skippedDuplicateCount, 0);
    assert.ok(res.errors && res.errors.length === 1 && res.errors[0].index === 2);
    assert.ok(res.message.includes('0 of 4'));
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

  const existingPendingJob = {
    id: 'existing-pending-job-202',
    slug: 'existing-pending-job-202-slug',
    title: 'Senior Cloud Infrastructure Architect',
    company: 'Nimbus Systems PK',
    city: 'Karachi',
    country: 'Pakistan',
    status: 'Pending',
    createdAt: '2026-01-01T00:00:00.000Z'
  };
  const existingExpiredJob = {
    id: 'existing-expired-job-303',
    slug: 'existing-expired-job-303-slug',
    title: 'Expired Senior Petroleum Geologist',
    company: 'Indus Basin Energy Ltd',
    city: 'Rawalpindi',
    country: 'Pakistan',
    status: 'Expired',
    isExpired: true,
    deadlineDate: '2024-01-01',
    createdAt: '2024-01-01T00:00:00.000Z'
  };
  inMemoryJobsStore.set(existingExpiredJob.id, JSON.parse(JSON.stringify(existingExpiredJob)));

  const inMemoryPendingJobs: any[] = [JSON.parse(JSON.stringify(existingPendingJob))];

  let failOnTitles = new Set<string>();
  let returnFalsyOnTitles = new Set<string>();
  let simulateGetAllFailure = false;
  let simulateGetPendingFailure = false;
  let customGetAllHandler: ((filter: any) => Promise<any>) | null = null;
  let customGetPendingHandler: ((filter: any) => Promise<any>) | null = null;
  let getPendingCallArgs: any[][] = [];
  let createCallCount = 0;
  let auditEntries: any[] = [];

  const originalCreate = JobRepository.create;
  const originalGetAll = JobRepository.getAll;
  const originalGetPending = JobRepository.getPending;
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

  JobRepository.getAll = async (filter: any = {}) => {
    if (customGetAllHandler) {
      return customGetAllHandler(filter);
    }
    if (simulateGetAllFailure) {
      throw new Error('Simulated live catalog load failure');
    }
    const allJobs = Array.from(inMemoryJobsStore.values())
      .filter((j) => (filter.includeExpired ? true : j.status !== 'Expired' && j.isExpired !== true))
      .map((j) => JSON.parse(JSON.stringify(j)));
    const page = Math.max(1, filter.page || 1);
    const limit = Math.min(1000, Math.max(1, filter.limit || 100));
    const start = (page - 1) * limit;
    return {
      jobs: allJobs.slice(start, start + limit),
      total: allJobs.length,
      page,
      limit
    };
  };

  JobRepository.getPending = async (...args: any[]) => {
    getPendingCallArgs.push(args);
    const filter = args[0];
    if (customGetPendingHandler) {
      return customGetPendingHandler(filter);
    }
    if (simulateGetPendingFailure) {
      throw new Error('Simulated pending queue load failure');
    }
    const safeFilter = filter || {};
    const list = inMemoryPendingJobs.map((j) => JSON.parse(JSON.stringify(j)));
    const page = Math.max(1, safeFilter?.page || 1);
    const limit = Math.min(500, Math.max(1, safeFilter?.limit || 200));
    const start = (page - 1) * limit;
    const sliced = list.slice(start, start + limit);
    Object.defineProperty(sliced, 'total', { value: list.length, enumerable: true });
    Object.defineProperty(sliced, 'limit', { value: limit, enumerable: true });
    return sliced;
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

    await runTest('2.9. Duplicate against existing live job is skipped with exact index, explanation, and 0 DB writes', async () => {
      createCallCount = 0;
      const storeSizeBefore = inMemoryJobsStore.size;
      const res = await postImport({
        jobs: [
          {
            title: existingProtectedJob.title,
            company: existingProtectedJob.company,
            city: existingProtectedJob.city
          }
        ]
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(createCallCount, 0, 'Live duplicate must NOT call JobRepository.create');
      assert.strictEqual(inMemoryJobsStore.size, storeSizeBefore);
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.requestedCount, 1);
      assert.strictEqual(data.processed, 1);
      assert.strictEqual(data.importedCount, 0);
      assert.strictEqual(data.failedCount, 0);
      assert.strictEqual(data.skippedDuplicateCount, 1);
      assert.strictEqual(data.errors.length, 1);
      assert.strictEqual(data.errors[0].index, 0);
      assert.strictEqual(data.errors[0].type, 'duplicate');
      assert.ok(data.errors[0].message.toLowerCase().includes('duplicate'));
    });

    await runTest('2.10. Duplicate against existing pending job is skipped without DB write', async () => {
      createCallCount = 0;
      const res = await postImport({
        jobs: [
          {
            title: existingPendingJob.title,
            company: existingPendingJob.company,
            city: existingPendingJob.city
          }
        ]
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(createCallCount, 0, 'Pending duplicate must NOT call JobRepository.create');
      assert.strictEqual(data.importedCount, 0);
      assert.strictEqual(data.failedCount, 0);
      assert.strictEqual(data.skippedDuplicateCount, 1);
      assert.strictEqual(data.processed, 1);
      assert.strictEqual(data.errors[0].index, 0);
      assert.strictEqual(data.errors[0].type, 'duplicate');
    });

    await runTest('2.11. Duplicate within same imported batch skips second record and reconciles counts accurately', async () => {
      createCallCount = 0;
      const storeSizeBefore = inMemoryJobsStore.size;
      const res = await postImport({
        jobs: [
          {
            id: 'same-batch-client-id',
            title: 'Principal Cybersecurity Analyst',
            company: 'ShieldCorp PK',
            city: 'Islamabad'
          },
          {
            id: 'same-batch-client-id',
            title: 'Principal Cybersecurity Analyst',
            company: 'ShieldCorp PK',
            city: 'Islamabad'
          },
          {
            title: 'Embedded Firmware Engineer',
            company: 'SiliconLahore Ltd',
            city: 'Lahore'
          }
        ]
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(createCallCount, 2, 'Only non-duplicate records may trigger JobRepository.create');
      assert.strictEqual(inMemoryJobsStore.size, storeSizeBefore + 2);
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.requestedCount, 3);
      assert.strictEqual(data.processed, 3);
      assert.strictEqual(data.importedCount, 2);
      assert.strictEqual(data.skippedDuplicateCount, 1);
      assert.strictEqual(data.failedCount, 0);
      assert.strictEqual(data.partialSuccess, true);
      assert.strictEqual(
        data.importedCount + data.skippedDuplicateCount + data.failedCount,
        data.requestedCount
      );
      assert.strictEqual(data.errors.length, 1);
      assert.strictEqual(data.errors[0].index, 1);
      assert.strictEqual(data.errors[0].type, 'duplicate');
    });

    await runTest('2.12. Mixed reconciliation: imported + live/batch duplicates + persistence error reconcile exactly', async () => {
      failOnTitles = new Set(['DB Failing Role']);
      createCallCount = 0;
      const res = await postImport({
        jobs: [
          { title: 'Fresh Unique Robotics Lead', company: 'RoboTech PK', city: 'Lahore' },
          { title: existingProtectedJob.title, company: existingProtectedJob.company, city: existingProtectedJob.city },
          { title: 'DB Failing Role', company: 'Transient Co', city: 'Multan' },
          { title: 'Second Unique Economist', company: 'Policy Group', city: 'Islamabad' }
        ]
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(createCallCount, 3, 'Duplicate at index 1 must NOT be passed to JobRepository.create');
      assert.strictEqual(data.requestedCount, 4);
      assert.strictEqual(data.processed, 4);
      assert.strictEqual(data.importedCount, 2);
      assert.strictEqual(data.skippedDuplicateCount, 1);
      assert.strictEqual(data.failedCount, 1);
      assert.strictEqual(data.partialSuccess, true);
      assert.strictEqual(data.errors.length, 2);
      assert.strictEqual(data.errors[0].index, 1);
      assert.strictEqual(data.errors[0].type, 'duplicate');
      assert.strictEqual(data.errors[1].index, 2);
      assert.strictEqual(data.errors[1].type, 'error');
      failOnTitles.clear();
    });

    await runTest('2.13. Fail-closed duplicate pool loading: live or pending repository error aborts before writing any record', async () => {
      createCallCount = 0;
      simulateGetAllFailure = true;
      const liveFailRes = await postImport({
        jobs: [{ title: 'Should Not Write Live Fail', company: 'Safe Co', city: 'Lahore' }]
      });
      assert.strictEqual(liveFailRes.status, 500);
      const liveFailData = await liveFailRes.json();
      assert.strictEqual(liveFailData.success, false);
      assert.strictEqual(liveFailData.importedCount, 0);
      assert.strictEqual(createCallCount, 0);
      simulateGetAllFailure = false;

      simulateGetPendingFailure = true;
      const pendingFailRes = await postImport({
        jobs: [{ title: 'Should Not Write Pending Fail', company: 'Safe Co', city: 'Lahore' }]
      });
      assert.strictEqual(pendingFailRes.status, 500);
      const pendingFailData = await pendingFailRes.json();
      assert.strictEqual(pendingFailData.success, false);
      assert.strictEqual(pendingFailData.importedCount, 0);
      assert.strictEqual(createCallCount, 0);
      simulateGetPendingFailure = false;
    });

    await runTest('2.14. Non-job and NEEDS_REVIEW markers are rejected before writes (HTTP 400)', async () => {
      const blockedRecords = [
        { title: 'News Bulletin', company: 'Gazette', city: 'Lahore', isNonJob: true },
        { title: 'Blog Summary', company: 'Gazette', city: 'Lahore', classificationState: 'NON_JOB' },
        { title: 'Editorial Notice', company: 'Gazette', city: 'Lahore', reviewStatus: 'NON_JOB' },
        { title: 'Ambiguous Clipping', company: 'Gazette', city: 'Lahore', classificationState: 'NEEDS_REVIEW' },
        { title: 'Low Confidence Item', company: 'Gazette', city: 'Lahore', reviewStatus: 'NEEDS_REVIEW' }
      ];
      createCallCount = 0;
      for (const rec of blockedRecords) {
        const res = await postImport({ jobs: [rec] });
        assert.strictEqual(res.status, 400);
        const data = await res.json();
        assert.strictEqual(data.success, false);
        assert.strictEqual(data.importedCount, 0);
        assert.strictEqual(data.errors[0].index, 0);
      }
      assert.strictEqual(createCallCount, 0, 'Non-job and NEEDS_REVIEW records must NEVER be written');
    });

    await runTest('2.15. Forged duplicate metadata is stripped while genuine scraper metadata and attachments are preserved', async () => {
      createCallCount = 0;
      const validAttachment = {
        id: 'att-gazette-1',
        name: 'Official Advertisement PDF',
        fileUrl: 'https://example.gov.pk/ad.pdf',
        fileType: 'application/pdf',
        uploadedAt: '2026-11-14T00:00:00.000Z',
        fileName: 'ad.pdf',
        description: 'Scanned gazette page',
        isPublic: true,
        sizeBytes: 512000
      };

      // 1) Forged isDuplicateOverride must NOT bypass real duplicate check against existing live job
      const bypassAttemptRes = await postImport({
        jobs: [
          {
            title: existingProtectedJob.title,
            company: existingProtectedJob.company,
            city: existingProtectedJob.city,
            isDuplicate: false,
            isDuplicateOverride: true,
            duplicateOverrideNote: 'force allow'
          }
        ]
      });
      assert.strictEqual(bypassAttemptRes.status, 200);
      const bypassData = await bypassAttemptRes.json();
      assert.strictEqual(bypassData.skippedDuplicateCount, 1);
      assert.strictEqual(bypassData.importedCount, 0);
      assert.strictEqual(createCallCount, 0);

      // 2) Unique scraped job with forged duplicate metadata strips all 10 duplicate-control fields while preserving scraper metadata & valid attachment
      const uniqueRes = await postImport({
        jobs: [
          {
            title: 'Assistant Director Procurement BPS-17',
            company: 'Federal Public Service Commission',
            city: 'Islamabad',
            isScraped: true,
            scraperSourceId: 'fpsc-official-src',
            scraperSourceName: 'FPSC Portal',
            scrapedSourceDomain: 'fpsc.gov.pk',
            sourceUrl: 'https://www.fpsc.gov.pk/jobs/proc-17',
            sourceJobId: 'fpsc-proc-17-2026',
            isDuplicate: true,
            duplicateScore: 99,
            duplicateCategory: 'LIVE DUPLICATE',
            duplicateMatchReason: 'forged reason',
            duplicateOfJobId: 'fake-id',
            duplicateOfJobTitle: 'fake-title',
            duplicateMatchedCompany: 'fake-company',
            isDuplicateOverride: true,
            duplicateOverrideNote: 'forged note',
            duplicateDetectedAt: '2026-01-01T00:00:00.000Z',
            attachments: [validAttachment]
          }
        ]
      });
      assert.strictEqual(uniqueRes.status, 200);
      const uniqueData = await uniqueRes.json();
      assert.strictEqual(uniqueData.importedCount, 1);

      const saved = Array.from(inMemoryJobsStore.values()).find(
        (j) => j.title === 'Assistant Director Procurement BPS-17'
      );
      assert.ok(saved, 'Unique scraped record should be saved');
      for (const forgedField of [
        'isDuplicate',
        'duplicateScore',
        'duplicateCategory',
        'duplicateMatchReason',
        'duplicateOfJobId',
        'duplicateOfJobTitle',
        'duplicateMatchedCompany',
        'isDuplicateOverride',
        'duplicateOverrideNote',
        'duplicateDetectedAt'
      ]) {
        assert.strictEqual(saved[forgedField], undefined, `Forged field "${forgedField}" must be stripped`);
      }
      assert.strictEqual(saved.isScraped, true);
      assert.strictEqual(saved.scraperSourceId, 'fpsc-official-src');
      assert.strictEqual(saved.scraperSourceName, 'FPSC Portal');
      assert.strictEqual(saved.sourceType, 'scraped');
      assert.deepStrictEqual(saved.attachments, [validAttachment]);
    });

    await runTest('2.16. Backend rejects invalid attachment objects before writes (HTTP 400)', async () => {
      createCallCount = 0;
      const badAttachmentBatches = [
        [{ id: '1', name: 'File', fileUrl: 'https://x.pk/a.pdf', fileType: 'application/pdf' }], // missing uploadedAt
        [null],
        [{ id: '1', name: 'File', fileUrl: 'https://x.pk/a.pdf', fileType: 'application/pdf', uploadedAt: '2026-01-01', sizeBytes: -1 }],
        [{ id: '1', name: 'File', fileUrl: 'https://x.pk/a.pdf', fileType: 'application/pdf', uploadedAt: '2026-01-01', isPublic: 'true' }],
        [{ id: '1', name: 'File', fileUrl: 'https://x.pk/a.pdf', fileType: 'application/pdf', uploadedAt: '2026-01-01', description: 404 }]
      ];
      for (const attachments of badAttachmentBatches) {
        const res = await postImport({
          jobs: [
            { title: 'Valid Role Pre', company: 'Co A', city: 'Lahore' },
            { title: 'Bad Attachment Role', company: 'Co B', city: 'Lahore', attachments }
          ]
        });
        assert.strictEqual(res.status, 400);
        const data = await res.json();
        assert.strictEqual(data.importedCount, 0);
        assert.strictEqual(data.errors[0].index, 1);
      }
      assert.strictEqual(createCallCount, 0, 'Invalid attachment in any row must reject entire batch before writes');
    });

    await runTest('2.17. Existing expired job is included in duplicate pool and detected as duplicate without DB write', async () => {
      createCallCount = 0;
      let sawIncludeExpiredTrue = false;
      customGetAllHandler = async (filter: any) => {
        if (filter.includeExpired === true) sawIncludeExpiredTrue = true;
        const allJobs = Array.from(inMemoryJobsStore.values())
          .filter((j) => (filter.includeExpired ? true : j.status !== 'Expired' && j.isExpired !== true))
          .map((j) => JSON.parse(JSON.stringify(j)));
        return { jobs: allJobs, total: allJobs.length, page: filter.page || 1, limit: filter.limit || 1000 };
      };

      try {
        const res = await postImport({
          jobs: [
            {
              title: existingExpiredJob.title,
              company: existingExpiredJob.company,
              city: existingExpiredJob.city
            }
          ]
        });
        assert.strictEqual(res.status, 200);
        const data = await res.json();
        assert.strictEqual(sawIncludeExpiredTrue, true, 'Duplicate pool loader must pass includeExpired: true');
        assert.strictEqual(createCallCount, 0, 'Expired duplicate must NOT be written');
        assert.strictEqual(data.success, false);
        assert.strictEqual(data.requestedCount, 1);
        assert.strictEqual(data.processed, 1);
        assert.strictEqual(data.importedCount, 0);
        assert.strictEqual(data.failedCount, 0);
        assert.strictEqual(data.skippedDuplicateCount, 1);
        assert.strictEqual(data.errors[0].index, 0);
        assert.strictEqual(data.errors[0].type, 'duplicate');
      } finally {
        customGetAllHandler = null;
      }
    });

    await runTest('2.18. Multi-page live-job pagination reaches final page and detects duplicate on last page', async () => {
      createCallCount = 0;
      const pagesLoaded: number[] = [];
      const pagedLivePool = [
        { id: 'pg-live-1', title: 'Page 1 Role', company: 'Alpha Co', city: 'Lahore', status: 'Approved' },
        { id: 'pg-live-2', title: 'Page 2 Role', company: 'Beta Co', city: 'Karachi', status: 'Approved' },
        { id: 'pg-live-3', title: 'Final Page Marine Surveyor', company: 'Gwadar Maritime Authority', city: 'Gwadar', status: 'Expired', isExpired: true }
      ];
      customGetAllHandler = async (filter: any) => {
        const p = filter.page || 1;
        pagesLoaded.push(p);
        const pageSize = 1;
        const item = pagedLivePool[p - 1];
        return {
          jobs: item ? [JSON.parse(JSON.stringify(item))] : [],
          total: pagedLivePool.length,
          page: p,
          limit: pageSize
        };
      };

      try {
        const res = await postImport({
          jobs: [
            {
              title: 'Final Page Marine Surveyor',
              company: 'Gwadar Maritime Authority',
              city: 'Gwadar'
            }
          ]
        });
        assert.strictEqual(res.status, 200);
        const data = await res.json();
        assert.deepStrictEqual(pagesLoaded, [1, 2, 3], 'All 3 live pages must be loaded sequentially');
        assert.strictEqual(data.skippedDuplicateCount, 1);
        assert.strictEqual(data.importedCount, 0);
        assert.strictEqual(createCallCount, 0);
      } finally {
        customGetAllHandler = null;
      }
    });

    await runTest('2.19. Multi-page pending-job pagination reaches final page and detects duplicate on last page', async () => {
      createCallCount = 0;
      const pendingPagesLoaded: number[] = [];
      const pagedPendingPool = [
        { id: 'pg-pend-1', title: 'Pending P1 Officer', company: 'Org 1', city: 'Lahore', status: 'Pending' },
        { id: 'pg-pend-2', title: 'Pending P2 Auditor', company: 'Org 2', city: 'Multan', status: 'Pending' },
        { id: 'pg-pend-3', title: 'Pending Final Page Hydrologist', company: 'WAPDA Hydrology', city: 'Peshawar', status: 'Pending' }
      ];
      customGetPendingHandler = async (filter: any) => {
        const p = filter?.page || 1;
        pendingPagesLoaded.push(p);
        const pageSize = 1;
        const item = pagedPendingPool[p - 1];
        const arr = item ? [JSON.parse(JSON.stringify(item))] : [];
        Object.defineProperty(arr, 'total', { value: pagedPendingPool.length, enumerable: true });
        Object.defineProperty(arr, 'limit', { value: pageSize, enumerable: true });
        return arr;
      };

      try {
        const res = await postImport({
          jobs: [
            {
              title: 'Pending Final Page Hydrologist',
              company: 'WAPDA Hydrology',
              city: 'Peshawar'
            }
          ]
        });
        assert.strictEqual(res.status, 200);
        const data = await res.json();
        assert.deepStrictEqual(pendingPagesLoaded, [1, 2, 3], 'All 3 pending pages must be loaded sequentially');
        assert.strictEqual(data.skippedDuplicateCount, 1);
        assert.strictEqual(data.importedCount, 0);
        assert.strictEqual(createCallCount, 0);
      } finally {
        customGetPendingHandler = null;
      }
    });

    await runTest('2.20. Live-job pagination limit reached while records remain fails closed with DuplicateCheckLoadError and 0 writes', async () => {
      createCallCount = 0;
      let livePageCalls = 0;
      customGetAllHandler = async (filter: any) => {
        livePageCalls++;
        return {
          jobs: [{ id: `live-overflow-${filter.page}`, title: `Live Job ${filter.page}`, company: 'Overflow Co', city: 'Lahore', status: 'Approved' }],
          total: 1005, // exceeds default 1000-page safety limit when limit=1
          page: filter.page,
          limit: 1
        };
      };

      try {
        const res = await postImport({
          jobs: [{ title: 'Should Abort Live Overflow', company: 'Safe Corp', city: 'Lahore' }]
        });
        assert.strictEqual(res.status, 500);
        const data = await res.json();
        assert.strictEqual(livePageCalls, 1000, 'Must stop and fail closed at the 1000-page safety limit');
        assert.strictEqual(data.success, false);
        assert.strictEqual(data.errorType, 'DuplicateCheckLoadError');
        assert.strictEqual(data.requestedCount, 1);
        assert.strictEqual(data.processed, 1);
        assert.strictEqual(data.importedCount, 0);
        assert.strictEqual(data.failedCount, 1);
        assert.strictEqual(data.skippedDuplicateCount, 0);
        assert.strictEqual(createCallCount, 0, 'Zero records may be written when live duplicate pool is incomplete');
      } finally {
        customGetAllHandler = null;
      }
    });

    await runTest('2.21. Pending-job pagination limit reached while records remain fails closed with DuplicateCheckLoadError and 0 writes', async () => {
      createCallCount = 0;
      let pendingPageCalls = 0;
      customGetPendingHandler = async (filter: any) => {
        pendingPageCalls++;
        const arr = [{ id: `pend-overflow-${filter.page}`, title: `Pending Job ${filter.page}`, company: 'Overflow Pending Co', city: 'Karachi', status: 'Pending' }];
        Object.defineProperty(arr, 'total', { value: 1005, enumerable: true });
        Object.defineProperty(arr, 'limit', { value: 1, enumerable: true });
        return arr;
      };

      try {
        const res = await postImport({
          jobs: [
            { title: 'Should Abort Pending Overflow 1', company: 'Safe Corp', city: 'Lahore' },
            { title: 'Should Abort Pending Overflow 2', company: 'Safe Corp', city: 'Karachi' }
          ]
        });
        assert.strictEqual(res.status, 500);
        const data = await res.json();
        assert.strictEqual(pendingPageCalls, 1000, 'Must stop and fail closed at the 1000-page safety limit');
        assert.strictEqual(data.success, false);
        assert.strictEqual(data.errorType, 'DuplicateCheckLoadError');
        assert.strictEqual(data.requestedCount, 2);
        assert.strictEqual(data.processed, 2);
        assert.strictEqual(data.importedCount, 0);
        assert.strictEqual(data.failedCount, 2);
        assert.strictEqual(data.skippedDuplicateCount, 0);
        assert.strictEqual(createCallCount, 0, 'Zero records may be written when pending duplicate pool is incomplete');
      } finally {
        customGetPendingHandler = null;
      }
    });

    await runTest('2.22. Atomic batch validation accounting reconciles requestedCount, processed, and failedCount across backend & frontend', async () => {
      createCallCount = 0;
      const mixedPayload = [
        { title: 'Atomic Valid Job 1', company: 'Alpha PK', city: 'Lahore' },
        { title: 'Atomic Valid Job 2', company: 'Beta PK', city: 'Karachi' },
        { title: 'Atomic Invalid Missing Company', company: '', city: 'Islamabad' },
        { title: 'Atomic Valid Job 4', company: 'Delta PK', city: 'Multan' }
      ];

      const frontendRes = processBackupImportJson(JSON.stringify(mixedPayload));
      assert.strictEqual(frontendRes.status, 'error');
      assert.strictEqual(frontendRes.requestedCount, 4);
      assert.strictEqual(frontendRes.processed, 4);
      assert.strictEqual(frontendRes.failedCount, 4);
      assert.strictEqual(frontendRes.importedCount, 0);
      assert.strictEqual(frontendRes.skippedDuplicateCount, 0);
      assert.strictEqual(frontendRes.errors?.length, 1);
      assert.strictEqual(frontendRes.errors?.[0].index, 2);

      const backendRes = await postImport({ jobs: mixedPayload });
      assert.strictEqual(backendRes.status, 400);
      const backendData = await backendRes.json();
      assert.strictEqual(createCallCount, 0, 'Atomic validation failure must persist zero records');
      assert.strictEqual(backendData.success, false);
      assert.strictEqual(backendData.requestedCount, 4);
      assert.strictEqual(backendData.processed, 4);
      assert.strictEqual(backendData.failedCount, 4, 'All 4 records in rejected batch were prevented from importing');
      assert.strictEqual(backendData.importedCount, 0);
      assert.strictEqual(backendData.skippedDuplicateCount, 0);
      assert.strictEqual(backendData.partialSuccess, false);
      assert.strictEqual(backendData.errors.length, 1, 'Preserve exact indexed error for invalid row only');
      assert.strictEqual(backendData.errors[0].index, 2);
      assert.ok(backendData.message.includes('0 of 4'));
    });

    await runTest('2.23. Non-Mongo fallback (IS_TEST !== "true") calls JobRepository.getPending() without pagination args and detects pending duplicates beyond 500', async () => {
      createCallCount = 0;
      getPendingCallArgs = [];
      const largePendingPool = Array.from({ length: 550 }, (_, idx) => ({
        id: `local-pending-${idx + 1}`,
        title:
          idx === 535
            ? 'Senior Geothermal Exploration Engineer'
            : `Local Fallback Pending Role ${idx + 1}`,
        company: idx === 535 ? 'Northern Thermal Energy PK' : `Fallback Org ${idx + 1}`,
        city: idx === 535 ? 'Gilgit' : 'Lahore',
        status: 'Pending'
      }));

      customGetPendingHandler = async (filter: any) => {
        // Mimic JobRepository.getPending local fallback behavior: slice if filter?.limit is passed, full list if no args
        if (filter && filter.limit) {
          return largePendingPool.slice(0, Math.min(500, filter.limit)).map((j) => ({ ...j }));
        }
        return largePendingPool.map((j) => ({ ...j }));
      };

      const prevIsTest = process.env.IS_TEST;
      const prevMongoUri = process.env.MONGODB_URI;
      const prevMongoUriAlt = process.env.MONGO_URI;
      process.env.IS_TEST = 'false';
      process.env.MONGODB_URI = '';
      process.env.MONGO_URI = '';

      try {
        const res = await postImport({
          jobs: [
            {
              title: 'Senior Geothermal Exploration Engineer',
              company: 'Northern Thermal Energy PK',
              city: 'Gilgit'
            },
            {
              title: 'Unique Non-Mongo Fallback Role 2026',
              company: 'Karakoram Clean Grid Corp',
              city: 'Skardu'
            }
          ]
        });
        assert.strictEqual(res.status, 200);
        const data = await res.json();
        assert.strictEqual(getPendingCallArgs.length, 1, 'Non-Mongo fallback must invoke getPending() once');
        assert.strictEqual(
          getPendingCallArgs[0].length,
          0,
          'Non-Mongo fallback must call JobRepository.getPending() with ZERO arguments (no { page, limit })'
        );
        assert.strictEqual(data.requestedCount, 2);
        assert.strictEqual(data.processed, 2);
        assert.strictEqual(data.importedCount, 1);
        assert.strictEqual(data.skippedDuplicateCount, 1, 'Pending record #536 (>500) must be caught as duplicate');
        assert.strictEqual(data.failedCount, 0);
        assert.strictEqual(data.partialSuccess, true);
        assert.strictEqual(createCallCount, 1, 'Only the unique job should be persisted');
      } finally {
        customGetPendingHandler = null;
        process.env.IS_TEST = prevIsTest;
        process.env.MONGODB_URI = prevMongoUri;
        process.env.MONGO_URI = prevMongoUriAlt;
      }
    });

    await runTest('2.24. Real unstubbed JobRepository.getPending() in non-Mongo mode returns full >500 fallback collection vs sliced paginated call', async () => {
      createCallCount = 0;
      const realPendingFixture = Array.from({ length: 560 }, (_, idx) => ({
        id: `db-fallback-pending-${idx + 1}`,
        title:
          idx === 545
            ? 'Director of Indus Telemetry Analytics'
            : `Database Fallback Pending Position ${idx + 1}`,
        company: idx === 545 ? 'Sindh Irrigation Tech Authority' : `Telemetry Dept ${idx + 1}`,
        city: idx === 545 ? 'Hyderabad' : 'Karachi',
        status: 'Pending'
      }));

      const origDbGetPendingJobs = Database.getPendingJobs;
      const currentWrappedGetPending = JobRepository.getPending;
      Database.getPendingJobs = () => realPendingFixture.map((j) => ({ ...j }));
      JobRepository.getPending = originalGetPending;

      const prevIsTest = process.env.IS_TEST;
      const prevMongoUri = process.env.MONGODB_URI;
      const prevMongoUriAlt = process.env.MONGO_URI;
      process.env.IS_TEST = 'false';
      process.env.MONGODB_URI = '';
      process.env.MONGO_URI = '';

      try {
        // Confirm why pagination args fail in non-Mongo fallback (would slice to 500 and miss idx 545)
        const slicedOldCall = await originalGetPending({ page: 1, limit: 500 });
        assert.strictEqual(slicedOldCall.length, 500);
        assert.strictEqual(slicedOldCall.some((j: any) => j.id === 'db-fallback-pending-546'), false);

        const res = await postImport({
          jobs: [
            {
              title: 'Director of Indus Telemetry Analytics',
              company: 'Sindh Irrigation Tech Authority',
              city: 'Hyderabad'
            }
          ]
        });
        assert.strictEqual(res.status, 200);
        const data = await res.json();
        assert.strictEqual(data.success, false);
        assert.strictEqual(data.requestedCount, 1);
        assert.strictEqual(data.processed, 1);
        assert.strictEqual(data.importedCount, 0);
        assert.strictEqual(data.skippedDuplicateCount, 1);
        assert.strictEqual(data.failedCount, 0);
        assert.strictEqual(createCallCount, 0, 'Real JobRepository.getPending() fallback must block duplicate at index 545');
      } finally {
        JobRepository.getPending = currentWrappedGetPending;
        Database.getPendingJobs = origDbGetPendingJobs;
        process.env.IS_TEST = prevIsTest;
        process.env.MONGODB_URI = prevMongoUri;
        process.env.MONGO_URI = prevMongoUriAlt;
      }
    });

    await runTest('2.25. Non-Mongo fallback fails closed (HTTP 500, 0 writes) when pending fallback result is non-array, throws, or is incomplete', async () => {
      const prevIsTest = process.env.IS_TEST;
      const prevMongoUri = process.env.MONGODB_URI;
      const prevMongoUriAlt = process.env.MONGO_URI;
      process.env.IS_TEST = 'false';
      process.env.MONGODB_URI = '';
      process.env.MONGO_URI = '';

      const incompleteArr = [{ id: 'inc-1', title: 'Only One', company: 'Org', city: 'Lahore', status: 'Pending' }];
      Object.defineProperty(incompleteArr, 'total', { value: 550, enumerable: true });

      const badResponses: Array<{ label: string; handler: () => Promise<any> }> = [
        { label: 'null response', handler: async () => null },
        { label: 'plain object response', handler: async () => ({ jobs: [] }) },
        {
          label: 'rejected fallback promise',
          handler: async () => {
            throw new Error('Disk fallback read error');
          }
        },
        { label: 'incomplete total vs length', handler: async () => incompleteArr }
      ];

      try {
        for (const testCase of badResponses) {
          createCallCount = 0;
          customGetPendingHandler = testCase.handler;
          const res = await postImport({
            jobs: [
              { title: 'Safe Job Should Not Persist 1', company: 'Verify Safe Corp', city: 'Lahore' },
              { title: 'Safe Job Should Not Persist 2', company: 'Verify Safe Corp', city: 'Karachi' }
            ]
          });
          assert.strictEqual(res.status, 500, `${testCase.label} must fail closed with HTTP 500`);
          const data = await res.json();
          assert.strictEqual(data.success, false);
          assert.strictEqual(data.errorType, 'DuplicateCheckLoadError', `${testCase.label} must return DuplicateCheckLoadError`);
          assert.strictEqual(data.requestedCount, 2);
          assert.strictEqual(data.processed, 2);
          assert.strictEqual(data.importedCount, 0);
          assert.strictEqual(data.failedCount, 2);
          assert.strictEqual(data.skippedDuplicateCount, 0);
          assert.strictEqual(createCallCount, 0, `${testCase.label} must write 0 jobs`);
        }
      } finally {
        customGetPendingHandler = null;
        process.env.IS_TEST = prevIsTest;
        process.env.MONGODB_URI = prevMongoUri;
        process.env.MONGO_URI = prevMongoUriAlt;
      }
    });

    await runTest('2.26. When MongoDB IS configured and IS_TEST !== "true", paginated JobRepository.getPending({ page, limit: 500 }) continues to be used', async () => {
      createCallCount = 0;
      getPendingCallArgs = [];
      const pagedPendingPool = [
        { id: 'mongo-p1', title: 'Mongo Page 1 Role', company: 'Mongo Org 1', city: 'Lahore', status: 'Pending' },
        { id: 'mongo-p2', title: 'Mongo Page 2 Nuclear Safety Inspector', company: 'PNRA Pakistan', city: 'Islamabad', status: 'Pending' }
      ];
      customGetPendingHandler = async (filter: any) => {
        const p = filter?.page || 1;
        const item = pagedPendingPool[p - 1];
        const arr = item ? [{ ...item }] : [];
        Object.defineProperty(arr, 'total', { value: pagedPendingPool.length, enumerable: true });
        Object.defineProperty(arr, 'limit', { value: 1, enumerable: true });
        return arr;
      };

      const prevIsTest = process.env.IS_TEST;
      const prevMongoUri = process.env.MONGODB_URI;
      const prevMongoUriAlt = process.env.MONGO_URI;
      process.env.IS_TEST = 'false';
      process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/mock_configured_check';
      process.env.MONGO_URI = '';

      try {
        const res = await postImport({
          jobs: [
            {
              title: 'Mongo Page 2 Nuclear Safety Inspector',
              company: 'PNRA Pakistan',
              city: 'Islamabad'
            }
          ]
        });
        assert.strictEqual(res.status, 200);
        const data = await res.json();
        assert.strictEqual(getPendingCallArgs.length, 2, 'Mongo-configured mode must paginate through both pages');
        assert.deepStrictEqual(getPendingCallArgs[0], [{ page: 1, limit: 500 }]);
        assert.deepStrictEqual(getPendingCallArgs[1], [{ page: 2, limit: 500 }]);
        assert.strictEqual(data.skippedDuplicateCount, 1);
        assert.strictEqual(data.importedCount, 0);
        assert.strictEqual(createCallCount, 0);
      } finally {
        customGetPendingHandler = null;
        process.env.IS_TEST = prevIsTest;
        process.env.MONGODB_URI = prevMongoUri;
        process.env.MONGO_URI = prevMongoUriAlt;
      }
    });
  } finally {
    JobRepository.create = originalCreate;
    JobRepository.getAll = originalGetAll;
    JobRepository.getPending = originalGetPending;
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

  await runTest('3.4. AdminDataBackupHub UI renders intact with async loading, duplicate-click protection & duplicate-skipped display', () => {
    const hubSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/admin/AdminDataBackupHub.tsx'), 'utf8');
    assert.ok(hubSrc.includes('isImporting'));
    assert.ok(hubSrc.includes('importInFlightRef'));
    assert.ok(hubSrc.includes('disabled={isImporting}'));
    assert.ok(hubSrc.includes('Duplicates Skipped:'));
    assert.ok(hubSrc.includes('skippedDuplicateCount'));
    assert.ok(hubSrc.includes('skippedDuplicates === 0'));

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
