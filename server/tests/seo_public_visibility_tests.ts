import assert from 'assert';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import express from 'express';
import { createServer, Server } from 'http';

// Ensure strict test mode before importing repositories/routes
process.env.IS_TEST = 'true';
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = '';
process.env.MONGO_URI = '';

import { seoRouter, isJobEligibleForPublicSeo } from '../routes/seoRoutes';
import { JobRepository } from '../db/repositories/JobRepository';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const SEO_JSON_PATH = path.join(DATA_DIR, 'seo_config.json');

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
  assert.strictEqual(fs.existsSync(SEO_JSON_PATH), false, 'data/seo_config.json MUST NEVER exist');
}

async function runTests() {
  console.log('=== Starting STEP-C.1.1 Public SEO Visibility Guard Test Suite ===\n');

  const initialSnapshot = getDataDirectorySnapshot();
  assert.strictEqual(fs.existsSync(SEO_JSON_PATH), false, 'data/seo_config.json must not exist before tests');

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
  // SECTION 1: UNIT TESTS FOR isJobEligibleForPublicSeo
  // Strict status validation & legacy compatibility table
  // ==========================================
  console.log('--- Section 1: Helper isJobEligibleForPublicSeo Unit Tests ---');

  const futureDeadline = '2035-12-31';
  const pastDeadline = '2020-01-01';

  // 1. Missing property -> Legacy-compatible (Approved)
  await runTest('1.1. Status input: missing property -> legacy-compatible (Approved)', () => {
    const job = { id: 'j-missing', title: 'Senior Dev', company: 'Tech Corp', deadline: futureDeadline };
    assert.strictEqual(isJobEligibleForPublicSeo(job), true);
  });

  // 2. undefined -> Legacy-compatible (Approved)
  await runTest('1.2. Status input: undefined -> legacy-compatible (Approved)', () => {
    assert.strictEqual(isJobEligibleForPublicSeo({ status: undefined, deadline: futureDeadline }), true);
  });

  // 3. null -> Legacy-compatible (Approved)
  await runTest('1.3. Status input: null -> legacy-compatible (Approved)', () => {
    assert.strictEqual(isJobEligibleForPublicSeo({ status: null, deadline: futureDeadline }), true);
  });

  // 4. Empty string -> Legacy-compatible (Approved)
  await runTest('1.4. Status input: empty string ("") -> legacy-compatible (Approved)', () => {
    assert.strictEqual(isJobEligibleForPublicSeo({ status: '', deadline: futureDeadline }), true);
  });

  // 5. Whitespace-only string -> Legacy-compatible (Approved)
  await runTest('1.5. Status input: whitespace-only string ("   ") -> legacy-compatible (Approved)', () => {
    assert.strictEqual(isJobEligibleForPublicSeo({ status: '   ', deadline: futureDeadline }), true);
    assert.strictEqual(isJobEligibleForPublicSeo({ status: '\t\n  ', deadline: futureDeadline }), true);
  });

  // 6. "Approved" -> Eligible, subject to other checks
  await runTest('1.6. Status input: "Approved" -> eligible, subject to other checks', () => {
    assert.strictEqual(isJobEligibleForPublicSeo({ status: 'Approved', deadline: futureDeadline }), true);
  });

  // 7. "approved" -> Eligible, subject to other checks (and casing variations)
  await runTest('1.7. Status input: "approved" & casing variations -> eligible', () => {
    assert.strictEqual(isJobEligibleForPublicSeo({ status: 'approved', deadline: futureDeadline }), true);
    assert.strictEqual(isJobEligibleForPublicSeo({ status: 'APPROVED', deadline: futureDeadline }), true);
    assert.strictEqual(isJobEligibleForPublicSeo({ status: '  Approved  ', deadline: futureDeadline }), true);
    assert.strictEqual(isJobEligibleForPublicSeo({ status: 'aPpRoVeD', deadline: futureDeadline }), true);
  });

  // 8. "Pending" -> Rejected
  await runTest('1.8. Status input: "Pending" -> rejected regardless of casing', () => {
    assert.strictEqual(isJobEligibleForPublicSeo({ status: 'Pending', deadline: futureDeadline }), false);
    assert.strictEqual(isJobEligibleForPublicSeo({ status: 'pending', deadline: futureDeadline }), false);
    assert.strictEqual(isJobEligibleForPublicSeo({ status: 'PENDING', deadline: futureDeadline }), false);
  });

  // 9. "Rejected" -> Rejected
  await runTest('1.9. Status input: "Rejected" -> rejected regardless of casing', () => {
    assert.strictEqual(isJobEligibleForPublicSeo({ status: 'Rejected', deadline: futureDeadline }), false);
    assert.strictEqual(isJobEligibleForPublicSeo({ status: 'rejected', deadline: futureDeadline }), false);
    assert.strictEqual(isJobEligibleForPublicSeo({ status: 'REJECTED', deadline: futureDeadline }), false);
  });

  // 10. "Suspended" -> Rejected
  await runTest('1.10. Status input: "Suspended" -> rejected regardless of casing', () => {
    assert.strictEqual(isJobEligibleForPublicSeo({ status: 'Suspended', deadline: futureDeadline }), false);
    assert.strictEqual(isJobEligibleForPublicSeo({ status: 'suspended', deadline: futureDeadline }), false);
    assert.strictEqual(isJobEligibleForPublicSeo({ status: 'SUSPENDED', deadline: futureDeadline }), false);
  });

  // 11. "Expired" -> Rejected
  await runTest('1.11. Status input: "Expired" -> rejected regardless of casing', () => {
    assert.strictEqual(isJobEligibleForPublicSeo({ status: 'Expired', deadline: futureDeadline }), false);
    assert.strictEqual(isJobEligibleForPublicSeo({ status: 'expired', deadline: futureDeadline }), false);
    assert.strictEqual(isJobEligibleForPublicSeo({ status: 'EXPIRED', deadline: futureDeadline }), false);
  });

  // 12. 123 (numeric) -> Rejected
  await runTest('1.12. Status input: 123 (numeric) -> rejected', () => {
    assert.strictEqual(isJobEligibleForPublicSeo({ status: 123, deadline: futureDeadline }), false);
  });

  // 13. 0 (numeric) -> Rejected
  await runTest('1.13. Status input: 0 (numeric) -> rejected', () => {
    assert.strictEqual(isJobEligibleForPublicSeo({ status: 0, deadline: futureDeadline }), false);
  });

  // 14. true (boolean) -> Rejected
  await runTest('1.14. Status input: true (boolean) -> rejected', () => {
    assert.strictEqual(isJobEligibleForPublicSeo({ status: true, deadline: futureDeadline }), false);
  });

  // 15. false (boolean) -> Rejected
  await runTest('1.15. Status input: false (boolean) -> rejected', () => {
    assert.strictEqual(isJobEligibleForPublicSeo({ status: false, deadline: futureDeadline }), false);
  });

  // 16. {} (object) -> Rejected
  await runTest('1.16. Status input: {} (object) -> rejected', () => {
    assert.strictEqual(isJobEligibleForPublicSeo({ status: {}, deadline: futureDeadline }), false);
  });

  // 17. [] (array) -> Rejected
  await runTest('1.17. Status input: [] (array) -> rejected', () => {
    assert.strictEqual(isJobEligibleForPublicSeo({ status: [], deadline: futureDeadline }), false);
  });

  // Additional status tests: non-Approved strings
  await runTest('1.18. Status input: other non-Approved strings ("Draft", "Archived", "Review") -> rejected', () => {
    assert.strictEqual(isJobEligibleForPublicSeo({ status: 'Draft', deadline: futureDeadline }), false);
    assert.strictEqual(isJobEligibleForPublicSeo({ status: 'Archived', deadline: futureDeadline }), false);
    assert.strictEqual(isJobEligibleForPublicSeo({ status: 'Review', deadline: futureDeadline }), false);
    assert.strictEqual(isJobEligibleForPublicSeo({ status: 'Unknown', deadline: futureDeadline }), false);
  });

  // Preserved flags: suspended, duplicate, expired
  await runTest('1.19. Flagged suspended job (isSuspended: true) is rejected even if status is Approved', () => {
    assert.strictEqual(isJobEligibleForPublicSeo({ status: 'Approved', isSuspended: true, deadline: futureDeadline }), false);
  });

  await runTest('1.20. Flagged duplicate job (isDuplicate: true) is rejected even if status is Approved', () => {
    assert.strictEqual(isJobEligibleForPublicSeo({ status: 'Approved', isDuplicate: true, deadline: futureDeadline }), false);
  });

  await runTest('1.21. Flagged expired job (isExpired: true) is rejected even if status is Approved', () => {
    assert.strictEqual(isJobEligibleForPublicSeo({ status: 'Approved', isExpired: true, deadline: futureDeadline }), false);
  });

  // Preserved actual expiry via checkJobExpired
  await runTest('1.22. Job with expired deadline (past date) is rejected via checkJobExpired', () => {
    assert.strictEqual(isJobEligibleForPublicSeo({ status: 'Approved', deadline: pastDeadline }), false);
    assert.strictEqual(isJobEligibleForPublicSeo({ status: 'Approved', deadlineDate: pastDeadline }), false);
    assert.strictEqual(isJobEligibleForPublicSeo({ status: 'Approved', closingDeadline: pastDeadline }), false);
  });

  // Preserved restored job handling via checkJobExpired
  await runTest('1.23. Intentional restored job handling in checkJobExpired is preserved', () => {
    const restoredJob = {
      status: 'Approved',
      deadline: pastDeadline,
      restoredAt: new Date().toISOString(),
      isExpired: false
    };
    assert.strictEqual(isJobEligibleForPublicSeo(restoredJob), true);
  });

  // Malformed job entities (not status, but job itself)
  await runTest('1.24. Null, undefined, non-objects, and primitives for job itself are rejected safely', () => {
    assert.strictEqual(isJobEligibleForPublicSeo(null), false);
    assert.strictEqual(isJobEligibleForPublicSeo(undefined), false);
    assert.strictEqual(isJobEligibleForPublicSeo(''), false);
    assert.strictEqual(isJobEligibleForPublicSeo(123), false);
    assert.strictEqual(isJobEligibleForPublicSeo(true), false);
  });

  // ==========================================
  // SECTION 2: HTTP ROUTE INTEGRATION TESTS
  // ==========================================
  console.log('\n--- Section 2: HTTP Route Integration Tests (/job-meta, /public-job, /sitemap.xml) ---');

  // Test fixtures
  const fixtures: Record<string, any> = {
    'job-pub-1': {
      id: 'job-pub-1',
      slug: 'senior-full-stack-engineer-lahore',
      title: 'Senior Full Stack Engineer',
      company: 'PakTech Solutions',
      city: 'Lahore',
      province: 'Punjab',
      region: 'Pakistan',
      jobType: 'Full-time',
      salary: 'PKR 250,000 - 350,000',
      description: '<p>Looking for a talented Senior Full Stack Engineer in Lahore.</p>',
      status: 'Approved',
      deadline: futureDeadline,
      createdAt: '2026-01-01T00:00:00.000Z'
    },
    'job-legacy-1': {
      id: 'job-legacy-1',
      slug: 'backend-dev-karachi',
      title: 'Backend Developer',
      company: 'Karachi Software',
      city: 'Karachi',
      province: 'Sindh',
      region: 'Pakistan',
      jobType: 'Full-time',
      description: 'Legacy posting without explicit status',
      deadline: futureDeadline,
      createdAt: '2026-01-02T00:00:00.000Z'
    },
    'job-pending-1': {
      id: 'job-pending-1',
      slug: 'confidential-pending-job',
      title: 'Secret Lead Architect',
      company: 'Confidential Stealth Co',
      status: 'Pending',
      rejectionReason: 'Not yet reviewed by moderation',
      description: 'Confidential unapproved draft',
      deadline: futureDeadline
    },
    'job-rejected-1': {
      id: 'job-rejected-1',
      slug: 'scam-job-posting',
      title: 'Suspicious High Pay Role',
      company: 'Spam Co',
      status: 'Rejected',
      internalNotes: 'Flagged for suspicious fee requests',
      description: 'Rejected job',
      deadline: futureDeadline
    },
    'job-suspended-1': {
      id: 'job-suspended-1',
      slug: 'suspended-status-job',
      title: 'Suspended Job Position',
      company: 'Halted Operations Ltd',
      status: 'Suspended',
      description: 'Suspended job',
      deadline: futureDeadline
    },
    'job-flag-suspended-1': {
      id: 'job-flag-suspended-1',
      slug: 'flag-suspended-job',
      title: 'Flag Suspended Job Position',
      company: 'Blocked Co',
      status: 'Approved',
      isSuspended: true,
      description: 'Flagged suspended',
      deadline: futureDeadline
    },
    'job-duplicate-1': {
      id: 'job-duplicate-1',
      slug: 'duplicate-entry-job',
      title: 'Duplicate Job Listing',
      company: 'Mirror Co',
      status: 'Approved',
      isDuplicate: true,
      description: 'Duplicate job',
      deadline: futureDeadline
    },
    'job-status-expired-1': {
      id: 'job-status-expired-1',
      slug: 'status-expired-role',
      title: 'Expired Role',
      company: 'Old Co',
      status: 'Expired',
      deadline: futureDeadline
    },
    'job-flag-expired-1': {
      id: 'job-flag-expired-1',
      slug: 'flag-expired-role',
      title: 'Flag Expired Role',
      company: 'Old Co',
      status: 'Approved',
      isExpired: true,
      deadline: futureDeadline
    },
    'job-deadline-expired-1': {
      id: 'job-deadline-expired-1',
      slug: 'deadline-expired-role',
      title: 'Deadline Expired Role',
      company: 'Past Deadline Co',
      status: 'Approved',
      deadline: pastDeadline
    },
    'job-malformed-num': {
      id: 'job-malformed-num',
      slug: 'malformed-num-role',
      title: 'Malformed Num Role',
      company: 'Bad Data Co',
      status: 123,
      deadline: futureDeadline
    },
    'job-malformed-bool': {
      id: 'job-malformed-bool',
      slug: 'malformed-bool-role',
      title: 'Malformed Bool Role',
      company: 'Bad Data Co',
      status: true,
      deadline: futureDeadline
    },
    'job-malformed-obj': {
      id: 'job-malformed-obj',
      slug: 'malformed-obj-role',
      title: 'Malformed Obj Role',
      company: 'Bad Data Co',
      status: { custom: 'status' },
      deadline: futureDeadline
    },
    'job-malformed-arr': {
      id: 'job-malformed-arr',
      slug: 'malformed-arr-role',
      title: 'Malformed Arr Role',
      company: 'Bad Data Co',
      status: ['Pending'],
      deadline: futureDeadline
    }
  };

  // Stub JobRepository to avoid touching real data files while testing routes comprehensively
  const originalGetById = JobRepository.getById;
  const originalGetBySlug = JobRepository.getBySlug;
  const originalGetAll = JobRepository.getAll;

  JobRepository.getById = async (id: string) => {
    const job = fixtures[id];
    return job ? JSON.parse(JSON.stringify(job)) : null;
  };

  JobRepository.getBySlug = async (slug: string) => {
    const job = Object.values(fixtures).find((j) => j.slug === slug);
    return job ? JSON.parse(JSON.stringify(job)) : null;
  };

  JobRepository.getAll = async () => {
    return {
      jobs: Object.values(fixtures).map((j) => JSON.parse(JSON.stringify(j))),
      total: Object.keys(fixtures).length,
      page: 1,
      limit: 1000
    };
  };

  const app = express();
  app.use(express.json());
  app.use('/api/seo', seoRouter);

  const server: Server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${address.port}/api/seo`;

  try {
    // 2.1 GET /job-meta/:id for approved job returns 200 with full metadata
    await runTest('2.1. GET /job-meta/:id returns 200 with metadata for approved job by ID', async () => {
      const res = await fetch(`${baseUrl}/job-meta/job-pub-1`);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(data.metaTitle.includes('Senior Full Stack Engineer'));
      assert.ok(data.canonicalUrl.includes('/jobs/senior-full-stack-engineer-lahore'));
      assert.strictEqual(data.jsonLd['@type'], 'JobPosting');
      assert.strictEqual(data.jsonLd.title, 'Senior Full Stack Engineer');
    });

    // 2.2 GET /job-meta/:id for approved job by slug returns 200
    await runTest('2.2. GET /job-meta/:id returns 200 for approved job by slug', async () => {
      const res = await fetch(`${baseUrl}/job-meta/senior-full-stack-engineer-lahore`);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(data.metaTitle.includes('Senior Full Stack Engineer'));
    });

    // 2.3 GET /job-meta/:id for legacy active job returns 200
    await runTest('2.3. GET /job-meta/:id returns 200 for legacy active job with omitted status', async () => {
      const res = await fetch(`${baseUrl}/job-meta/job-legacy-1`);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(data.metaTitle.includes('Backend Developer'));
    });

    // 2.4 GET /job-meta/:id returns 404 for Pending job (zero private leak)
    await runTest('2.4. GET /job-meta/:id returns safe 404 for Pending job without leaking private details', async () => {
      const res = await fetch(`${baseUrl}/job-meta/job-pending-1`);
      assert.strictEqual(res.status, 404);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.message, 'Job not found');
      // Zero leakage of title, rejection reason, or status
      assert.strictEqual(data.metaTitle, undefined);
      assert.strictEqual(data.jsonLd, undefined);
      assert.strictEqual(JSON.stringify(data).includes('Secret Lead Architect'), false);
      assert.strictEqual(JSON.stringify(data).includes('Not yet reviewed'), false);
    });

    // 2.5 GET /job-meta/:id returns 404 for Rejected job
    await runTest('2.5. GET /job-meta/:id returns safe 404 for Rejected job', async () => {
      const res = await fetch(`${baseUrl}/job-meta/job-rejected-1`);
      assert.strictEqual(res.status, 404);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.message, 'Job not found');
      assert.strictEqual(JSON.stringify(data).includes('Suspicious High Pay'), false);
    });

    // 2.6 GET /job-meta/:id returns 404 for Suspended job
    await runTest('2.6. GET /job-meta/:id returns safe 404 for Suspended job', async () => {
      const res = await fetch(`${baseUrl}/job-meta/job-suspended-1`);
      assert.strictEqual(res.status, 404);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.message, 'Job not found');
    });

    // 2.7 GET /job-meta/:id returns 404 for Flag-suspended job
    await runTest('2.7. GET /job-meta/:id returns safe 404 for Flag-suspended job (isSuspended: true)', async () => {
      const res = await fetch(`${baseUrl}/job-meta/job-flag-suspended-1`);
      assert.strictEqual(res.status, 404);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.message, 'Job not found');
    });

    // 2.8 GET /job-meta/:id returns 404 for Duplicate job
    await runTest('2.8. GET /job-meta/:id returns safe 404 for Duplicate job (isDuplicate: true)', async () => {
      const res = await fetch(`${baseUrl}/job-meta/job-duplicate-1`);
      assert.strictEqual(res.status, 404);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.message, 'Job not found');
    });

    // 2.9 GET /job-meta/:id returns 404 for Expired status job
    await runTest('2.9. GET /job-meta/:id returns safe 404 for Expired status job', async () => {
      const res = await fetch(`${baseUrl}/job-meta/job-status-expired-1`);
      assert.strictEqual(res.status, 404);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.message, 'Job not found');
    });

    // 2.10 GET /job-meta/:id returns 404 for Flagged expired job
    await runTest('2.10. GET /job-meta/:id returns safe 404 for Flag-expired job (isExpired: true)', async () => {
      const res = await fetch(`${baseUrl}/job-meta/job-flag-expired-1`);
      assert.strictEqual(res.status, 404);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.message, 'Job not found');
    });

    // 2.11 GET /job-meta/:id returns 404 for Deadline expired job
    await runTest('2.11. GET /job-meta/:id returns safe 404 for Deadline-expired job (past deadline)', async () => {
      const res = await fetch(`${baseUrl}/job-meta/job-deadline-expired-1`);
      assert.strictEqual(res.status, 404);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.message, 'Job not found');
    });

    // 2.12 GET /job-meta/:id returns 404 for Non-existent job
    await runTest('2.12. GET /job-meta/:id returns safe 404 for non-existent job ID', async () => {
      const res = await fetch(`${baseUrl}/job-meta/does-not-exist-9999`);
      assert.strictEqual(res.status, 404);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.message, 'Job not found');
    });

    // 2.13 GET /job-meta/:id returns 404 for Malformed Number status
    await runTest('2.13. GET /job-meta/:id returns safe 404 for job with numeric status (123)', async () => {
      const res = await fetch(`${baseUrl}/job-meta/job-malformed-num`);
      assert.strictEqual(res.status, 404);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.message, 'Job not found');
    });

    // 2.14 GET /job-meta/:id returns 404 for Malformed Boolean status
    await runTest('2.14. GET /job-meta/:id returns safe 404 for job with boolean status (true)', async () => {
      const res = await fetch(`${baseUrl}/job-meta/job-malformed-bool`);
      assert.strictEqual(res.status, 404);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.message, 'Job not found');
    });

    // 2.15 GET /job-meta/:id returns 404 for Malformed Object status
    await runTest('2.15. GET /job-meta/:id returns safe 404 for job with object status ({})', async () => {
      const res = await fetch(`${baseUrl}/job-meta/job-malformed-obj`);
      assert.strictEqual(res.status, 404);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.message, 'Job not found');
    });

    // 2.16 GET /job-meta/:id returns 404 for Malformed Array status
    await runTest('2.16. GET /job-meta/:id returns safe 404 for job with array status ([])', async () => {
      const res = await fetch(`${baseUrl}/job-meta/job-malformed-arr`);
      assert.strictEqual(res.status, 404);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.message, 'Job not found');
    });

    // 2.17 GET /public-job/:idOrSlug returns 200 SSR HTML for approved job
    await runTest('2.17. GET /public-job/:idOrSlug returns 200 SSR HTML for approved job by ID', async () => {
      const res = await fetch(`${baseUrl}/public-job/job-pub-1`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.headers.get('content-type')?.includes('text/html'), true);
      const html = await res.text();
      assert.ok(html.includes('Senior Full Stack Engineer'));
      assert.ok(html.includes('PakTech Solutions'));
      assert.ok(html.includes('/jobs/senior-full-stack-engineer-lahore'));
    });

    // 2.18 GET /public-job/:idOrSlug returns 200 SSR HTML for approved job by slug
    await runTest('2.18. GET /public-job/:idOrSlug returns 200 SSR HTML for approved job by slug', async () => {
      const res = await fetch(`${baseUrl}/public-job/senior-full-stack-engineer-lahore`);
      assert.strictEqual(res.status, 200);
      const html = await res.text();
      assert.ok(html.includes('Senior Full Stack Engineer'));
    });

    // 2.19 GET /public-job/:idOrSlug returns 404 HTML for Pending job
    await runTest('2.19. GET /public-job/:idOrSlug returns 404 HTML for Pending job without leaking private details', async () => {
      const res = await fetch(`${baseUrl}/public-job/job-pending-1`);
      assert.strictEqual(res.status, 404);
      const html = await res.text();
      assert.ok(html.includes('404 - Job Vacancy Not Found'));
      assert.strictEqual(html.includes('Secret Lead Architect'), false);
      assert.strictEqual(html.includes('Confidential Stealth Co'), false);
    });

    // 2.20 GET /public-job/:idOrSlug returns 404 HTML for Rejected job
    await runTest('2.20. GET /public-job/:idOrSlug returns 404 HTML for Rejected job', async () => {
      const res = await fetch(`${baseUrl}/public-job/job-rejected-1`);
      assert.strictEqual(res.status, 404);
      const html = await res.text();
      assert.ok(html.includes('404 - Job Vacancy Not Found'));
      assert.strictEqual(html.includes('Suspicious High Pay'), false);
    });

    // 2.21 GET /public-job/:idOrSlug returns 404 HTML for Suspended job
    await runTest('2.21. GET /public-job/:idOrSlug returns 404 HTML for Suspended job', async () => {
      const res = await fetch(`${baseUrl}/public-job/job-suspended-1`);
      assert.strictEqual(res.status, 404);
      const html = await res.text();
      assert.ok(html.includes('404 - Job Vacancy Not Found'));
    });

    // 2.22 GET /public-job/:idOrSlug returns 404 HTML for Flag-suspended job
    await runTest('2.22. GET /public-job/:idOrSlug returns 404 HTML for Flag-suspended job', async () => {
      const res = await fetch(`${baseUrl}/public-job/job-flag-suspended-1`);
      assert.strictEqual(res.status, 404);
      const html = await res.text();
      assert.ok(html.includes('404 - Job Vacancy Not Found'));
    });

    // 2.23 GET /public-job/:idOrSlug returns 404 HTML for Duplicate job
    await runTest('2.23. GET /public-job/:idOrSlug returns 404 HTML for Duplicate job', async () => {
      const res = await fetch(`${baseUrl}/public-job/job-duplicate-1`);
      assert.strictEqual(res.status, 404);
      const html = await res.text();
      assert.ok(html.includes('404 - Job Vacancy Not Found'));
    });

    // 2.24 GET /public-job/:idOrSlug returns 404 HTML for Status expired job
    await runTest('2.24. GET /public-job/:idOrSlug returns 404 HTML for Status-expired job', async () => {
      const res = await fetch(`${baseUrl}/public-job/job-status-expired-1`);
      assert.strictEqual(res.status, 404);
      const html = await res.text();
      assert.ok(html.includes('404 - Job Vacancy Not Found'));
    });

    // 2.25 GET /public-job/:idOrSlug returns 404 HTML for Flag expired job
    await runTest('2.25. GET /public-job/:idOrSlug returns 404 HTML for Flag-expired job', async () => {
      const res = await fetch(`${baseUrl}/public-job/job-flag-expired-1`);
      assert.strictEqual(res.status, 404);
      const html = await res.text();
      assert.ok(html.includes('404 - Job Vacancy Not Found'));
    });

    // 2.26 GET /public-job/:idOrSlug returns 404 HTML for Deadline expired job
    await runTest('2.26. GET /public-job/:idOrSlug returns 404 HTML for Deadline-expired job', async () => {
      const res = await fetch(`${baseUrl}/public-job/job-deadline-expired-1`);
      assert.strictEqual(res.status, 404);
      const html = await res.text();
      assert.ok(html.includes('404 - Job Vacancy Not Found'));
    });

    // 2.27 GET /public-job/:idOrSlug returns 404 HTML for malformed status jobs
    await runTest('2.27. GET /public-job/:idOrSlug returns 404 HTML for jobs with malformed non-string status', async () => {
      const resNum = await fetch(`${baseUrl}/public-job/job-malformed-num`);
      assert.strictEqual(resNum.status, 404);
      const htmlNum = await resNum.text();
      assert.ok(htmlNum.includes('404 - Job Vacancy Not Found'));

      const resBool = await fetch(`${baseUrl}/public-job/job-malformed-bool`);
      assert.strictEqual(resBool.status, 404);
      const htmlBool = await resBool.text();
      assert.ok(htmlBool.includes('404 - Job Vacancy Not Found'));
    });

    // 2.28 GET /public-job/:idOrSlug returns 404 HTML for non-existent job
    await runTest('2.28. GET /public-job/:idOrSlug returns 404 HTML for non-existent job', async () => {
      const res = await fetch(`${baseUrl}/public-job/non-existent-xyz`);
      assert.strictEqual(res.status, 404);
      const html = await res.text();
      assert.ok(html.includes('404 - Job Vacancy Not Found'));
    });

    // 2.29 GET /sitemap.xml includes only public approved jobs and excludes all non-public and malformed jobs
    await runTest('2.29. GET /sitemap.xml includes approved jobs and excludes pending/rejected/suspended/duplicate/expired/malformed', async () => {
      const res = await fetch(`${baseUrl}/sitemap.xml`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.headers.get('content-type')?.includes('application/xml'), true);
      const xml = await res.text();

      // Must include approved active jobs
      assert.ok(xml.includes('/jobs/senior-full-stack-engineer-lahore'), 'Approved job slug must be in sitemap');
      assert.ok(xml.includes('/jobs/backend-dev-karachi'), 'Legacy approved job slug must be in sitemap');

      // Must NEVER include non-public / ineligible jobs
      assert.strictEqual(xml.includes('/jobs/confidential-pending-job'), false, 'Pending job must NOT be in sitemap');
      assert.strictEqual(xml.includes('/jobs/scam-job-posting'), false, 'Rejected job must NOT be in sitemap');
      assert.strictEqual(xml.includes('/jobs/suspended-status-job'), false, 'Suspended job must NOT be in sitemap');
      assert.strictEqual(xml.includes('/jobs/flag-suspended-job'), false, 'Flag-suspended job must NOT be in sitemap');
      assert.strictEqual(xml.includes('/jobs/duplicate-entry-job'), false, 'Duplicate job must NOT be in sitemap');
      assert.strictEqual(xml.includes('/jobs/status-expired-role'), false, 'Status-expired job must NOT be in sitemap');
      assert.strictEqual(xml.includes('/jobs/flag-expired-role'), false, 'Flag-expired job must NOT be in sitemap');
      assert.strictEqual(xml.includes('/jobs/deadline-expired-role'), false, 'Deadline-expired job must NOT be in sitemap');
      assert.strictEqual(xml.includes('/jobs/malformed-num-role'), false, 'Malformed numeric status job must NOT be in sitemap');
      assert.strictEqual(xml.includes('/jobs/malformed-bool-role'), false, 'Malformed boolean status job must NOT be in sitemap');
      assert.strictEqual(xml.includes('/jobs/malformed-obj-role'), false, 'Malformed object status job must NOT be in sitemap');
      assert.strictEqual(xml.includes('/jobs/malformed-arr-role'), false, 'Malformed array status job must NOT be in sitemap');
    });

  } finally {
    // Restore stubs
    JobRepository.getById = originalGetById;
    JobRepository.getBySlug = originalGetBySlug;
    JobRepository.getAll = originalGetAll;

    // Close server
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  // ==========================================
  // SECTION 3: DATA INTEGRITY CHECK
  // ==========================================
  console.log('\n--- Section 3: Data Directory Integrity Check ---');
  await runTest('3.1. Protected JSON data files remain strictly unchanged', () => {
    const finalSnapshot = getDataDirectorySnapshot();
    assertDataSnapshotUnchanged(initialSnapshot, finalSnapshot);
  });

  console.log(`\n=== Test Results: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test execution error:', err);
  process.exit(1);
});
