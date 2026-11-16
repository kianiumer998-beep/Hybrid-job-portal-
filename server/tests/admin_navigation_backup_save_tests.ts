import assert from 'assert';
import fs from 'fs';
import path from 'path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

process.env.MONGODB_URI = '';
process.env.MONGO_URI = '';
process.env.IS_TEST = 'true';
process.env.NODE_ENV = 'test';

import {
  AdminCategory,
  ADMIN_TAB_CATEGORIES,
  ADMIN_ROLE_DEFAULT_PERMS,
  checkAdminTabPermission,
  navigateWithAdminPermission,
  buildAllModulesMenuGroups
} from '../../src/components/AdminDashboard';
import {
  AdminAnalyticsOverview,
  ANALYTICS_SHORTCUT_TAB_IDS
} from '../../src/components/admin/AdminAnalyticsOverview';
import {
  AdminDataBackupHub,
  isSystemSnapshotPayload,
  processBackupImportJson,
  sanitizeUserForBackup,
  buildAdminSnapshotPayload,
  escapeCsvCell,
  buildCsvContent,
  triggerBlobDownload,
  BACKUP_EXPORT_SCOPE
} from '../../src/components/admin/AdminDataBackupHub';
import {
  BACKUP_SNAPSHOT_SCHEMA_VERSION
} from '../../src/types/adminSuite';
import {
  executeFeeConfigSave
} from '../../src/components/admin/AdminFeeManager';
import { DEFAULT_LANDING_PAGE_CONFIG } from '../../src/types/landing';
import { DEFAULT_JOB_POSTING_PRICING_CONFIG } from '../../src/types/job';
import { DEFAULT_AD_PRICING_CONFIG } from '../../src/types/ad';
import { DEFAULT_WHATSAPP_CONFIG } from '../../src/components/WhatsAppStickyButton';
import { INITIAL_SITE_SEO_CONFIG } from '../../src/data/mockAdminSuiteData';

interface TestCounts {
  passed: number;
  failed: number;
  skipped: number;
}

async function runSuite() {
  console.log('==================================================================');
  console.log('   STEP-07-02: ADMIN NAVIGATION, BACKUP & SAVE-SAFETY TESTS       ');
  console.log('==================================================================');

  const counts: TestCounts = {
    passed: 0,
    failed: 0,
    skipped: 0
  };

  const runTest = async (name: string, fn: () => void | Promise<void>) => {
    try {
      await fn();
      counts.passed++;
      console.log(`✓ Passed: ${name}`);
    } catch (err: any) {
      counts.failed++;
      console.error(`✗ Failed: ${name}`);
      console.error(`  Error: ${err?.stack || err?.message || err}`);
    }
  };

  // --- STEP A: ANALYTICS SHORTCUTS & PERMISSION-AWARE NAVIGATION ---
  await runTest('Analytics: corrected shortcut IDs (broadcast-center, ai-enhancer, data-backup) are valid tabs in ADMIN_TAB_CATEGORIES', () => {
    assert.ok(ANALYTICS_SHORTCUT_TAB_IDS.includes('broadcast-center'));
    assert.ok(ANALYTICS_SHORTCUT_TAB_IDS.includes('ai-enhancer'));
    assert.ok(ANALYTICS_SHORTCUT_TAB_IDS.includes('data-backup'));

    for (const tabId of ANALYTICS_SHORTCUT_TAB_IDS) {
      assert.ok(
        ADMIN_TAB_CATEGORIES[tabId],
        `Expected Analytics shortcut tab "${tabId}" to exist in ADMIN_TAB_CATEGORIES`
      );
    }

    const analyticsSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/admin/AdminAnalyticsOverview.tsx'),
      'utf8'
    );
    assert.ok(!analyticsSource.includes("onNavigateTab('broadcast')"), 'Invalid shortcut broadcast must be removed');
    assert.ok(!analyticsSource.includes("onNavigateTab('ai-quality')"), 'Invalid shortcut ai-quality must be removed');
    assert.ok(!analyticsSource.includes("onNavigateTab('backup-hub')"), 'Invalid shortcut backup-hub must be removed');
    assert.ok(analyticsSource.includes("onNavigateTab('broadcast-center')"));
    assert.ok(analyticsSource.includes("onNavigateTab('ai-enhancer')"));
    assert.ok(analyticsSource.includes("onNavigateTab('data-backup')"));

    const html = renderToStaticMarkup(React.createElement(AdminAnalyticsOverview));
    assert.ok(html.includes('Platform Intelligence &amp; Global Metrics'));
  });

  await runTest('Analytics navigation: updates activeTab and activeCategory when permission is granted', () => {
    let activeTab = 'analytics';
    let activeCategory: AdminCategory = 'settings';

    const canAccess = (tabId: string) =>
      checkAdminTabPermission('Super Admin', ADMIN_ROLE_DEFAULT_PERMS['Super Admin'], true, tabId);

    assert.strictEqual(
      navigateWithAdminPermission({
        targetTab: 'broadcast-center',
        canAccessTab: canAccess,
        tabCategories: ADMIN_TAB_CATEGORIES,
        onSetTab: (t) => { activeTab = t; },
        onSetCategory: (c) => { activeCategory = c; }
      }),
      true
    );
    assert.strictEqual(activeTab, 'broadcast-center');
    assert.strictEqual(activeCategory, 'alerts');

    assert.strictEqual(
      navigateWithAdminPermission({
        targetTab: 'ai-enhancer',
        canAccessTab: canAccess,
        tabCategories: ADMIN_TAB_CATEGORIES,
        onSetTab: (t) => { activeTab = t; },
        onSetCategory: (c) => { activeCategory = c; }
      }),
      true
    );
    assert.strictEqual(activeTab, 'ai-enhancer');
    assert.strictEqual(activeCategory, 'jobs');

    assert.strictEqual(
      navigateWithAdminPermission({
        targetTab: 'data-backup',
        canAccessTab: canAccess,
        tabCategories: ADMIN_TAB_CATEGORIES,
        onSetTab: (t) => { activeTab = t; },
        onSetCategory: (c) => { activeCategory = c; }
      }),
      true
    );
    assert.strictEqual(activeTab, 'data-backup');
    assert.strictEqual(activeCategory, 'settings');
  });

  await runTest('Analytics navigation: missing permission does NOT change activeTab or activeCategory', () => {
    let activeTab = 'jobs';
    let activeCategory: AdminCategory = 'jobs';

    const jobModCanAccess = (tabId: string) =>
      checkAdminTabPermission('Job Moderator', ADMIN_ROLE_DEFAULT_PERMS['Job Moderator'], true, tabId);

    // Job Moderator lacks settings.manage and finance.manage
    const deniedTargets = ['broadcast-center', 'data-backup', 'fee-logs', 'currency-forex', 'user-audit', 'advertisements'];
    for (const target of deniedTargets) {
      const moved = navigateWithAdminPermission({
        targetTab: target,
        canAccessTab: jobModCanAccess,
        tabCategories: ADMIN_TAB_CATEGORIES,
        onSetTab: (t) => { activeTab = t; },
        onSetCategory: (c) => { activeCategory = c; }
      });
      assert.strictEqual(moved, false, `Expected navigation to "${target}" to be blocked for Job Moderator`);
      assert.strictEqual(activeTab, 'jobs');
      assert.strictEqual(activeCategory, 'jobs');
    }

    // Permitted shortcut for Job Moderator succeeds and keeps category consistent
    const allowedMoved = navigateWithAdminPermission({
      targetTab: 'ai-enhancer',
      canAccessTab: jobModCanAccess,
      tabCategories: ADMIN_TAB_CATEGORIES,
      onSetTab: (t) => { activeTab = t; },
      onSetCategory: (c) => { activeCategory = c; }
    });
    assert.strictEqual(allowedMoved, true);
    assert.strictEqual(activeTab, 'ai-enhancer');
    assert.strictEqual(activeCategory, 'jobs');
  });

  // --- STEP B & C: ALL MODULES QUICK MENU & TAB_CATEGORIES ---
  await runTest('All Modules quick menu: includes all 4 missing modules in correct categories without duplicates and preserves English/Urdu search', () => {
    const groups = buildAllModulesMenuGroups({
      activeJobsCount: 5,
      pendingJobsCount: 2,
      activeAdsCount: 1,
      pendingProofsCount: 0,
      feeLogsCount: 3,
      usersCount: 10,
      kycBadgeText: '1 KYC',
      subscribersCount: 4,
      chatMessagesCount: 7
    });

    const paymentsGroup = groups.find((g) => g.catKey === 'payments');
    assert.ok(paymentsGroup, 'Payments quick-menu group must exist');
    const pricingItem = paymentsGroup!.items.find((i) => i.id === 'pricing-controller');
    assert.ok(pricingItem, 'pricing-controller must appear in Payments quick-menu group');
    assert.ok(pricingItem!.label.toLowerCase().includes('pricing'));
    assert.ok(pricingItem!.urdu.includes('فیسیں'));

    const settingsGroup = groups.find((g) => g.catKey === 'settings');
    assert.ok(settingsGroup, 'Settings quick-menu group must exist');
    for (const expectedId of ['apply-settings', 'modal-content-manager', 'job-visibility']) {
      const found = settingsGroup!.items.find((i) => i.id === expectedId);
      assert.ok(found, `${expectedId} must appear in Settings quick-menu group`);
      assert.ok(found!.urdu.trim().length > 0, `${expectedId} must include Urdu keywords`);
    }

    // Verify zero duplicate IDs across the entire quick menu
    const allIds = groups.flatMap((g) => g.items.map((i) => i.id));
    assert.strictEqual(new Set(allIds).size, allIds.length, 'Quick menu must not contain duplicate module IDs');
  });

  await runTest('Category mapping: modal-content-manager maps to settings and respects permission guard', () => {
    assert.strictEqual(ADMIN_TAB_CATEGORIES['modal-content-manager'], 'settings');
    assert.strictEqual(ADMIN_TAB_CATEGORIES['apply-settings'], 'settings');
    assert.strictEqual(ADMIN_TAB_CATEGORIES['job-visibility'], 'settings');
    assert.strictEqual(ADMIN_TAB_CATEGORIES['pricing-controller'], 'payments');

    // Unauthorized role cannot open modal-content-manager
    let activeTab = 'jobs';
    let activeCategory: AdminCategory = 'jobs';
    const scraperBlocked = navigateWithAdminPermission({
      targetTab: 'modal-content-manager',
      canAccessTab: (t) => checkAdminTabPermission('Scraper Manager', ADMIN_ROLE_DEFAULT_PERMS['Scraper Manager'], true, t),
      tabCategories: ADMIN_TAB_CATEGORIES,
      onSetTab: (t) => { activeTab = t; },
      onSetCategory: (c) => { activeCategory = c; }
    });
    assert.strictEqual(scraperBlocked, false);
    assert.strictEqual(activeTab, 'jobs');
    assert.strictEqual(activeCategory, 'jobs');

    // Authorized role navigates cleanly and sets activeCategory to 'settings'
    const adminAllowed = navigateWithAdminPermission({
      targetTab: 'modal-content-manager',
      canAccessTab: (t) => checkAdminTabPermission('Super Admin', ADMIN_ROLE_DEFAULT_PERMS['Super Admin'], true, t),
      tabCategories: ADMIN_TAB_CATEGORIES,
      onSetTab: (t) => { activeTab = t; },
      onSetCategory: (c) => { activeCategory = c; }
    });
    assert.strictEqual(adminAllowed, true);
    assert.strictEqual(activeTab, 'modal-content-manager');
    assert.strictEqual(activeCategory, 'settings');
  });

  // --- STEP D: BACKUP HUB FULL SNAPSHOT RESTORE SAFETY ---
  await runTest('Backup Hub: rejects full snapshot JSON safely without invoking bulk-job or snapshot restore callbacks', () => {
    const sampleSnapshot = JSON.stringify({
      snapshotVersion: '2.5.0-ENTERPRISE',
      createdAt: '2026-11-13T00:00:00.000Z',
      jobs: [{ id: 'job-1', title: 'Backend Engineer' }],
      users: [{ id: 'u-1', name: 'Admin' }]
    });

    assert.strictEqual(isSystemSnapshotPayload(JSON.parse(sampleSnapshot)), true);
    assert.strictEqual(
      isSystemSnapshotPayload({ jobs: [{ id: 'j1' }], users: [], feeLogs: [] }),
      true
    );

    let importCalled = false;
    const res = processBackupImportJson(sampleSnapshot, () => {
      importCalled = true;
    });
    assert.strictEqual(res.status, 'rejected');
    assert.strictEqual(res.kind, 'full-snapshot');
    assert.strictEqual(res.importedCount, 0);
    assert.strictEqual(importCalled, false);
    assert.ok(res.message.toLowerCase().includes('temporarily unavailable'));
  });

  await runTest('Backup Hub: normal JSON array-of-jobs import still invokes onImportBulkJobs and preserves download UI while disabling snapshot restore', () => {
    const jobsArrayPayload = JSON.stringify([
      { id: 'bulk-1', title: 'Frontend Developer', company: 'Acme PK' },
      { id: 'bulk-2', title: 'QA Lead', company: 'Beta Tech' }
    ]);

    assert.strictEqual(isSystemSnapshotPayload(JSON.parse(jobsArrayPayload)), false);

    let receivedJobs: any[] = [];
    const res = processBackupImportJson(jobsArrayPayload, (imported) => {
      receivedJobs = imported;
    });
    assert.strictEqual(res.status, 'success');
    assert.strictEqual(res.kind, 'job-array');
    assert.strictEqual(res.importedCount, 2);
    assert.strictEqual(receivedJobs.length, 2);
    assert.strictEqual(receivedJobs[0].id, 'bulk-1');

    // Invalid / unrecognized non-array payload
    const badRes = processBackupImportJson('{"hello":"world"}', () => {
      throw new Error('Should not be called');
    });
    assert.strictEqual(badRes.status, 'error');

    // SSR markup check: snapshot download intact, restore disabled, no false success text
    const html = renderToStaticMarkup(React.createElement(AdminDataBackupHub));
    assert.ok(html.includes('Download System JSON Backup'));
    assert.ok(html.includes('Temporarily Unavailable'));
    assert.ok(html.includes('Full Snapshot Restore Temporarily Unavailable'));
    assert.ok(html.includes('disabled=""'));
    assert.ok(!html.includes('Full Snapshot successfully restored'));

    // Also verify AdminDashboard source does not emit false snapshot restore alert
    const dashSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/AdminDashboard.tsx'),
      'utf8'
    );
    assert.ok(!dashSource.includes('System state restored successfully from Snapshot!'));
  });

  // --- STEP E: FEE MANAGER SAVE SAFETY ---
  await runTest('Fee Manager: missing save callback returns error and never reports success', async () => {
    const result = await executeFeeConfigSave(DEFAULT_LANDING_PAGE_CONFIG, undefined);
    assert.strictEqual(result.success, false);
    assert.ok(result.message.toLowerCase().includes('save failed'));
  });

  await runTest('Fee Manager: synchronous throw, rejected Promise, and failure object from save callback return error and never report success', async () => {
    const syncThrowResult = await executeFeeConfigSave(DEFAULT_LANDING_PAGE_CONFIG, () => {
      throw new Error('Callback exploded synchronously');
    });
    assert.strictEqual(syncThrowResult.success, false);
    assert.ok(syncThrowResult.message.includes('Callback exploded synchronously'));

    const rejectedResult = await executeFeeConfigSave(DEFAULT_LANDING_PAGE_CONFIG, async () => {
      throw new Error('Network 500 during save');
    });
    assert.strictEqual(rejectedResult.success, false);
    assert.ok(rejectedResult.message.includes('Network 500 during save'));

    const falseFlagResult = await executeFeeConfigSave(DEFAULT_LANDING_PAGE_CONFIG, async () => ({
      success: false,
      message: 'Forbidden by backend'
    }));
    assert.strictEqual(falseFlagResult.success, false);
    assert.ok(falseFlagResult.message.includes('Forbidden by backend'));
  });

  await runTest('Fee Manager: resolved async save callback awaits completion and returns accurate success state', async () => {
    let completed = false;
    const savedConfigs: any[] = [];
    const result = await executeFeeConfigSave(DEFAULT_LANDING_PAGE_CONFIG, async (cfg) => {
      await new Promise((resolve) => setTimeout(resolve, 15));
      savedConfigs.push(cfg);
      completed = true;
      return { success: true };
    });
    assert.strictEqual(completed, true);
    assert.strictEqual(savedConfigs.length, 1);
    assert.strictEqual(result.success, true);
    assert.ok(!result.message.toLowerCase().includes('mongodb'));
  });

  // --- STEP F (STEP-D.3.1): BACKUP SECURITY, PAYMENT COMPLETENESS, ACCESS & CSV HARDENING ---
  await runTest('Backup Credential Sanitization: strips sensitive auth fields (including all required aliases, nested objects, and array items) without mutating original users and preserving legitimate fields', () => {
    const rawUser: any = {
      id: 'user-sec-1',
      name: 'Ayesha Khan',
      email: 'ayesha@example.pk',
      password: 'PlaintextSecretPassword123!',
      passwordHash: '$2b$10$hashvalue999',
      salt: 'randomSaltXYZ',
      accessToken: 'jwt-access-abc',
      refreshToken: 'jwt-refresh-def',
      resetToken: 'reset-tok-123',
      verificationToken: 'verify-tok-456',
      sessionToken: 'sess-tok-789',
      passwordResetToken: 'pw-reset-alias-111',
      emailVerificationToken: 'email-verify-alias-222',
      authToken: 'auth-tok-alias-333',
      twoFactorSecret: '2fa-secret-alias-444',
      mfaSecret: 'mfa-secret-alias-555',
      password_hash: 'hash-1',
      'PASSWORD-HASH': 'hash-2',
      hashedPassword: 'hash-3',
      passwordDigest: 'digest-1',
      apiKey: 'apikey-1',
      api_key: 'apikey-2',
      privateKey: 'priv-1',
      private_key: 'priv-2',
      otpSecret: 'otp-1',
      mfaRecoveryCodes: ['mfa-1'],
      bearerToken: 'bearer-1',
      idToken: 'idtok-1',
      clientSecret: 'clientsec-1',
      authorization: 'Bearer auth-1',
      role: 'Employer/Job Poster',
      companyName: 'Indus Cloud',
      plan: 'Premium',
      membershipStatus: 'Active',
      walletBalance: 4500,
      autoRenew: true,
      verificationStatus: 'Verified',
      kycStatus: 'Approved',
      nestedProfileMeta: {
        secureNotes: 'keep me',
        clientSecret: 'nested-secret-1',
        api_key: 'nested-apikey-1',
        passwordResetToken: 'nested-pw-reset-111',
        twoFactorSecret: 'nested-2fa-secret-444'
      },
      employmentHistory: [
        {
          company: 'Tech Corp',
          title: 'Engineer',
          apiKey: 'array-secret-1',
          authToken: 'array-auth-tok-333',
          nestedDetails: {
            private_key: 'deep-secret-1',
            emailVerificationToken: 'deep-email-verify-222',
            mfaSecret: 'deep-mfa-secret-555'
          }
        }
      ],
      transactions: [
        {
          id: 'tx-user-1',
          dateTime: '2026-11-15 10:00',
          amount: 1500,
          currency: 'PKR',
          type: 'Subscription',
          status: 'Success',
          paymentMethod: 'JazzCash'
        }
      ],
      appliedJobs: [
        {
          id: 'app-user-1',
          jobId: 'job-99',
          jobTitle: 'Staff Engineer',
          companyName: 'Indus Cloud',
          applicantId: 'user-sec-1',
          applicantName: 'Ayesha Khan',
          applicantEmail: 'ayesha@example.pk',
          appliedAt: '2026-11-14T12:00:00Z',
          status: 'Applied'
        }
      ],
      customFieldsData: { ntn: 'NTN-445566' },
      createdAt: '2026-01-10T00:00:00.000Z'
    };

    const rawCopyBefore = JSON.stringify(rawUser);
    const sanitized = sanitizeUserForBackup(rawUser);

    // Original user object must remain completely untouched (source non-mutation)
    assert.strictEqual(JSON.stringify(rawUser), rawCopyBefore);
    assert.strictEqual(rawUser.password, 'PlaintextSecretPassword123!');
    assert.strictEqual(rawUser.passwordHash, '$2b$10$hashvalue999');
    assert.strictEqual(rawUser.clientSecret, 'clientsec-1');
    assert.strictEqual(rawUser.passwordResetToken, 'pw-reset-alias-111');
    assert.strictEqual(rawUser.mfaSecret, 'mfa-secret-alias-555');

    // All required sensitive keys and aliases must NEVER appear in sanitized result
    const sensitiveKeysToCheck = [
      'password',
      'passwordHash',
      'salt',
      'accessToken',
      'refreshToken',
      'resetToken',
      'verificationToken',
      'sessionToken',
      'passwordResetToken',
      'emailVerificationToken',
      'authToken',
      'twoFactorSecret',
      'mfaSecret',
      'password_hash',
      'PASSWORD-HASH',
      'hashedPassword',
      'passwordDigest',
      'apiKey',
      'api_key',
      'privateKey',
      'private_key',
      'otpSecret',
      'mfaRecoveryCodes',
      'bearerToken',
      'idToken',
      'clientSecret',
      'authorization'
    ];

    for (const sensitiveKey of sensitiveKeysToCheck) {
      assert.strictEqual(sensitiveKey in sanitized, false, `Expected top-level "${sensitiveKey}" to be stripped`);
    }

    assert.strictEqual(sanitized.nestedProfileMeta.clientSecret, undefined);
    assert.strictEqual(sanitized.nestedProfileMeta.api_key, undefined);
    assert.strictEqual(sanitized.nestedProfileMeta.passwordResetToken, undefined);
    assert.strictEqual(sanitized.nestedProfileMeta.twoFactorSecret, undefined);
    assert.strictEqual(sanitized.nestedProfileMeta.secureNotes, 'keep me');

    assert.strictEqual(sanitized.employmentHistory[0].apiKey, undefined);
    assert.strictEqual(sanitized.employmentHistory[0].authToken, undefined);
    assert.strictEqual(sanitized.employmentHistory[0].nestedDetails.private_key, undefined);
    assert.strictEqual(sanitized.employmentHistory[0].nestedDetails.emailVerificationToken, undefined);
    assert.strictEqual(sanitized.employmentHistory[0].nestedDetails.mfaSecret, undefined);
    assert.strictEqual(sanitized.employmentHistory[0].company, 'Tech Corp');

    // Legitimate profile, company, wallet, transactions, and customFieldsData fields must be preserved
    assert.strictEqual(sanitized.id, 'user-sec-1');
    assert.strictEqual(sanitized.name, 'Ayesha Khan');
    assert.strictEqual(sanitized.email, 'ayesha@example.pk');
    assert.strictEqual(sanitized.companyName, 'Indus Cloud');
    assert.strictEqual(sanitized.plan, 'Premium');
    assert.strictEqual(sanitized.walletBalance, 4500);
    assert.strictEqual(sanitized.verificationStatus, 'Verified');
    assert.strictEqual(sanitized.kycStatus, 'Approved');
    assert.strictEqual(sanitized.transactions?.length, 1);
    assert.strictEqual(sanitized.appliedJobs?.length, 1);
    assert.deepStrictEqual(sanitized.customFieldsData, { ntn: 'NTN-445566' });

    // Verify full snapshot JSON excludes all sensitive aliases/values and manifest lists all required labels
    const snapshot = buildAdminSnapshotPayload({ users: [rawUser] });
    for (const expectedLabel of [
      'passwordResetToken',
      'emailVerificationToken',
      'authToken',
      'twoFactorSecret',
      'mfaSecret'
    ]) {
      assert.ok(
        snapshot.manifest.sanitizationApplied.strippedUserFields.includes(expectedLabel),
        `Expected manifest.sanitizationApplied.strippedUserFields to include "${expectedLabel}"`
      );
    }
    const serialized = JSON.stringify(snapshot);
    assert.strictEqual(serialized.includes('PlaintextSecretPassword123!'), false);
    assert.strictEqual(serialized.includes('$2b$10$hashvalue999'), false);
    assert.strictEqual(serialized.includes('randomSaltXYZ'), false);
    assert.strictEqual(serialized.includes('jwt-access-abc'), false);
    assert.strictEqual(serialized.includes('jwt-refresh-def'), false);
    assert.strictEqual(serialized.includes('reset-tok-123'), false);
    assert.strictEqual(serialized.includes('verify-tok-456'), false);
    assert.strictEqual(serialized.includes('sess-tok-789'), false);
    assert.strictEqual(serialized.includes('pw-reset-alias-111'), false);
    assert.strictEqual(serialized.includes('email-verify-alias-222'), false);
    assert.strictEqual(serialized.includes('auth-tok-alias-333'), false);
    assert.strictEqual(serialized.includes('2fa-secret-alias-444'), false);
    assert.strictEqual(serialized.includes('mfa-secret-alias-555'), false);
    assert.strictEqual(serialized.includes('nested-pw-reset-111'), false);
    assert.strictEqual(serialized.includes('nested-2fa-secret-444'), false);
    assert.strictEqual(serialized.includes('array-auth-tok-333'), false);
    assert.strictEqual(serialized.includes('deep-email-verify-222'), false);
    assert.strictEqual(serialized.includes('deep-mfa-secret-555'), false);
    assert.strictEqual(serialized.includes('clientsec-1'), false);
    assert.strictEqual(serialized.includes('nested-secret-1'), false);
    assert.strictEqual(serialized.includes('deep-secret-1'), false);
    assert.strictEqual(JSON.stringify(rawUser), rawCopyBefore);
  });

  await runTest('Backup Snapshot Completeness & Manifest: separates paymentTransactions from feeLogs, includes safe configs, and lists excluded categories honestly', () => {
    const sampleJobs: any[] = [{ id: 'j-1', title: 'Backend Dev', company: 'Co', status: 'Approved' }];
    const samplePending: any[] = [{ id: 'pj-1', title: 'Pending Dev', company: 'Co', status: 'Pending' }];
    const sampleFeeLogs: any[] = [
      { id: 'fee-1', dateTime: '2026-11-10', userId: 'u1', userName: 'U1', userEmail: 'u1@t.pk', jobTitle: 'Backend Dev', amount: 1000, currency: 'PKR', paymentMethod: 'Easypaisa', status: 'Paid' }
    ];
    const sampleTransactions: any[] = [
      { id: 'ptx-1', dateTime: '2026-11-11', amount: 2500, currency: 'PKR', type: 'Subscription', status: 'Success', paymentMethod: 'JazzCash' },
      { id: 'ptx-2', dateTime: '2026-11-12', amount: 500, currency: 'PKR', type: 'Wallet Deposit', status: 'Pending', paymentMethod: 'Bank Transfer' }
    ];
    const sampleAuditLogs: any[] = [{ id: 'sa-1', jobId: 'pj-1', jobTitle: 'Scraped Job' }];
    const sampleBatchRuns: any[] = [{ batchId: 'br-1', status: 'Completed' }];

    const snapshot = buildAdminSnapshotPayload({
      jobs: sampleJobs,
      pendingJobs: samplePending,
      users: [{ id: 'u1', name: 'U1', email: 'u1@t.pk', role: 'Job Seeker', plan: 'Free', autoRenew: false, createdAt: '2026-01-01', password: 'secret' } as any],
      subscribers: [{ id: 'sub-1', name: 'S1', email: 's1@t.pk', phone: '0300', plan: 'Pro Alerts', paymentMethod: 'JazzCash', amountPaid: 300, currency: 'PKR', status: 'Active', subscribedAt: '2026-11-01', whatsappEnabled: true }],
      feeLogs: sampleFeeLogs,
      paymentTransactions: sampleTransactions,
      ads: [{ id: 'ad-1', title: 'Promo' }],
      auditLogs: sampleAuditLogs,
      batchRuns: sampleBatchRuns,
      customFormFields: [{ id: 'cf-1', label: 'City', type: 'text', required: true, active: true }],
      featureFlags: { enableWebScraper: true } as any,
      jobPostingPricing: DEFAULT_JOB_POSTING_PRICING_CONFIG,
      adPricingConfig: DEFAULT_AD_PRICING_CONFIG,
      landingConfig: DEFAULT_LANDING_PAGE_CONFIG,
      seoConfig: INITIAL_SITE_SEO_CONFIG,
      whatsAppSupportConfig: DEFAULT_WHATSAPP_CONFIG,
      createdAt: '2026-11-16T10:00:00.000Z'
    });

    assert.strictEqual(snapshot.snapshotVersion, BACKUP_SNAPSHOT_SCHEMA_VERSION);
    assert.strictEqual(snapshot.manifest.schemaVersion, BACKUP_SNAPSHOT_SCHEMA_VERSION);
    assert.strictEqual(snapshot.manifest.createdAt, '2026-11-16T10:00:00.000Z');
    assert.strictEqual(snapshot.manifest.exportScope, BACKUP_EXPORT_SCOPE);
    assert.strictEqual(snapshot.manifest.isCompleteDatabaseBackup, false);

    // paymentTransactions preserved separately from feeLogs
    assert.strictEqual(snapshot.paymentTransactions.length, 2);
    assert.strictEqual(snapshot.feeLogs.length, 1);
    assert.strictEqual(snapshot.totalPaymentTransactions, 2);
    assert.strictEqual(snapshot.totalFeeLogs, 1);
    assert.strictEqual(snapshot.paymentTransactions[0].id, 'ptx-1');
    assert.strictEqual(snapshot.feeLogs[0].id, 'fee-1');

    // Manifest counts match exported array lengths
    assert.strictEqual(snapshot.manifest.recordCounts.jobs, snapshot.jobs.length);
    assert.strictEqual(snapshot.manifest.recordCounts.pendingJobs, snapshot.pendingJobs.length);
    assert.strictEqual(snapshot.manifest.recordCounts.users, snapshot.users.length);
    assert.strictEqual(snapshot.manifest.recordCounts.subscribers, snapshot.subscribers.length);
    assert.strictEqual(snapshot.manifest.recordCounts.feeLogs, snapshot.feeLogs.length);
    assert.strictEqual(snapshot.manifest.recordCounts.paymentTransactions, snapshot.paymentTransactions.length);
    assert.strictEqual(snapshot.manifest.recordCounts.ads, snapshot.ads.length);
    assert.strictEqual(snapshot.manifest.recordCounts.scraperAuditLogs, snapshot.scraperAuditLogs.length);
    assert.strictEqual(snapshot.manifest.recordCounts.scraperBatchRuns, snapshot.scraperBatchRuns.length);
    assert.strictEqual(snapshot.manifest.recordCounts.customFormFields, snapshot.customFormFields.length);

    // Scraper logs labeled scraper-specific (not durable security audit logs)
    const scraperAuditCat = snapshot.manifest.includedCategories.find((c) => c.key === 'scraperAuditLogs');
    assert.ok(scraperAuditCat);
    assert.ok(scraperAuditCat!.label.toLowerCase().includes('scraper-specific'));
    assert.ok(scraperAuditCat!.description.toLowerCase().includes('not the durable security audit log'));

    // Excluded categories clearly listed
    const excludedKeys = new Set(snapshot.manifest.excludedCategories.map((e) => e.key));
    for (const requiredExcludedKey of [
      'paymentMethodSettings',
      'communicationProviderSecrets',
      'durableSecurityAuditRecords',
      'applications',
      'notifications',
      'savedJobsAndAlerts',
      'userDocuments',
      'kycRecords',
      'otherServerDatabaseCollections'
    ]) {
      assert.ok(excludedKeys.has(requiredExcludedKey), `Missing excluded category ${requiredExcludedKey}`);
    }

    // Safe admin configs included
    assert.ok(snapshot.adminConfig.jobPostingPricing);
    assert.ok(snapshot.adminConfig.adPricingConfig);
    assert.ok(snapshot.adminConfig.landingConfig);
    assert.ok(snapshot.adminConfig.seoConfig);
    assert.ok(snapshot.adminConfig.whatsAppSupportConfig);

    // New snapshot format still rejected by bulk job importer
    assert.strictEqual(isSystemSnapshotPayload(snapshot), true);
    const importRes = processBackupImportJson(JSON.stringify(snapshot));
    assert.strictEqual(importRes.status, 'rejected');
    assert.strictEqual(importRes.kind, 'full-snapshot');

    // UI renders honest scope and transaction counts
    const html = renderToStaticMarkup(
      React.createElement(AdminDataBackupHub, {
        jobs: sampleJobs,
        feeLogs: sampleFeeLogs,
        paymentTransactions: sampleTransactions
      })
    );
    assert.ok(html.includes('Selected Admin Data Snapshot'));
    assert.ok(html.includes('Not a Complete Database Backup'));
    assert.ok(html.includes('2 payment transactions'));
    assert.ok(html.includes('1 separate fee logs'));
    assert.ok(!html.includes('Download Complete Portal State'));
    assert.ok(!html.includes('Immutable cryptographic snapshot'));
    assert.ok(!html.includes('Full Enterprise Backup'));
  });

  await runTest('Backup RBAC Access Control: data-backup restricted strictly to verified Super Admin and Admin (blocked for non-Admin/non-Super-Admin even with settings.manage or *)', () => {
    // Verified Super Admin and Admin allowed
    assert.strictEqual(checkAdminTabPermission('Super Admin', ['*'], true, 'data-backup'), true);
    assert.strictEqual(checkAdminTabPermission('Admin', ['*'], true, 'data-backup'), true);
    assert.strictEqual(checkAdminTabPermission('Admin', [], true, 'data-backup'), true);

    // Unverified admins denied
    assert.strictEqual(checkAdminTabPermission('Super Admin', ['*'], false, 'data-backup'), false);
    assert.strictEqual(checkAdminTabPermission('Admin', ['*'], false, 'data-backup'), false);

    // Non-Admin/non-Super-Admin roles denied even if given settings.manage or '*'
    for (const role of [
      'Job Moderator',
      'Scraper Manager',
      'Payment Manager',
      'Finance Manager',
      'SEO Manager',
      'Advertisement Manager',
      'Custom Settings Manager'
    ]) {
      assert.strictEqual(
        checkAdminTabPermission(role, ['settings.manage'], true, 'data-backup'),
        false,
        `${role} with settings.manage must be denied data-backup`
      );
      assert.strictEqual(
        checkAdminTabPermission(role, ['*'], true, 'data-backup'),
        false,
        `${role} with * permission must still be denied data-backup`
      );
      // Direct navigation helper blocked
      let activeTab = 'jobs';
      let activeCat: AdminCategory = 'jobs';
      const moved = navigateWithAdminPermission({
        targetTab: 'data-backup',
        canAccessTab: (t) => checkAdminTabPermission(role, ['settings.manage'], true, t),
        tabCategories: ADMIN_TAB_CATEGORIES,
        onSetTab: (t) => { activeTab = t; },
        onSetCategory: (c) => { activeCat = c; }
      });
      assert.strictEqual(moved, false);
      assert.strictEqual(activeTab, 'jobs');
      assert.strictEqual(activeCat, 'jobs');
    }

    // Other settings.manage tabs remain accessible when permission granted
    assert.strictEqual(checkAdminTabPermission('Custom Role', ['settings.manage'], true, 'settings'), true);
    assert.strictEqual(checkAdminTabPermission('Custom Role', ['settings.manage'], true, 'apply-settings'), true);

    // Verify AdminDashboard wires currentTransactions, safe configs, and guarded tab render
    const dashSource = fs.readFileSync(path.resolve(process.cwd(), 'src/components/AdminDashboard.tsx'), 'utf8');
    assert.ok(dashSource.includes("adminTab === 'data-backup' && canAccessAdminTab('data-backup')"));
    assert.ok(dashSource.includes('paymentTransactions={currentTransactions}'));
    assert.ok(dashSource.includes('jobPostingPricing={jobPostingPricing}'));
    assert.ok(dashSource.includes('adPricingConfig={pricingConfig}'));
    assert.ok(dashSource.includes('landingConfig={landingConfig}'));
    assert.ok(dashSource.includes('seoConfig={effectiveSeoConfig}'));
    assert.ok(dashSource.includes('whatsAppSupportConfig={currentWhatsAppConfig}'));
  });

  await runTest('CSV Security & Data Correctness: preserves zero and negative numbers while neutralizing formula injection and escaping quotes/commas/newlines', () => {
    // 1. Numeric zero values preserved
    assert.strictEqual(escapeCsvCell(0), '"0"');
    assert.strictEqual(escapeCsvCell(-0), '"0"');
    assert.strictEqual(escapeCsvCell(null), '""');
    assert.strictEqual(escapeCsvCell(undefined), '""');

    // 2. Legitimate negative numeric values NOT altered with leading quote
    assert.strictEqual(escapeCsvCell(-250), '"-250"');
    assert.strictEqual(escapeCsvCell(-0.75), '"-0.75"');

    // 3. Commas, embedded double quotes, and newlines properly escaped and quoted
    assert.strictEqual(escapeCsvCell('Lahore, Punjab'), '"Lahore, Punjab"');
    assert.strictEqual(escapeCsvCell('Senior "Cloud" Architect'), '"Senior ""Cloud"" Architect"');
    assert.strictEqual(escapeCsvCell('Line 1\nLine 2'), '"Line 1\nLine 2"');

    // 4. Formula injection neutralized on untrusted strings (including whitespace/control char prefixes)
    for (const dangerous of [
      '=SUM(A1:A5)',
      '+1+1',
      '-2+3',
      '@SUM(1,1)',
      '  =CMD()',
      '\t+cmd|"/C calc"!A0',
      '\r\n-10+20',
      '\u0000@HYPERLINK("http://evil")'
    ]) {
      const escaped = escapeCsvCell(dangerous);
      assert.ok(escaped.startsWith('"\''), `Expected formula string "${JSON.stringify(dangerous)}" to be neutralized, got ${escaped}`);
    }

    // 5. Full CSV table preserves column order, zero, negative numbers, and safe escaping
    const csv = buildCsvContent(
      ['ID', 'Title', 'Amount', 'WalletBalance'],
      [
        ['row-1', '=1+1', 0, -125],
        ['row-2', 'Normal "Text", Inc\nLine2', 500, 0]
      ]
    );
    const lines = csv.split('\n');
    assert.strictEqual(lines[0], 'ID,Title,Amount,WalletBalance');
    assert.strictEqual(lines[1], '"row-1","\'=1+1","0","-125"');
    assert.ok(csv.includes('"Normal ""Text"", Inc\nLine2","500","0"'));
  });

  await runTest('Blob Downloads & Security Confirmation: uses Blob/objectURL downloads (no data: URIs), uses correct snapshot filename, renders new filename in UI, and omits old misleading filename', async () => {
    const hubSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/admin/AdminDataBackupHub.tsx'),
      'utf8'
    );
    assert.strictEqual(hubSource.includes('data:text/json'), false, 'Must NOT use data:text/json URI download');
    assert.strictEqual(hubSource.includes('data:text/csv'), false, 'Must NOT use data:text/csv URI download');
    assert.ok(hubSource.includes('URL.createObjectURL'));
    assert.ok(hubSource.includes('URL.revokeObjectURL'));
    assert.ok(hubSource.includes('Security Notice: This file contains private personal or payment information and must be stored securely.'));

    // Assert new filename is present and old misleading filename is completely absent from AdminDataBackupHub.tsx source
    assert.ok(hubSource.includes('careerpak_selected_admin_data_snapshot_YYYY-MM-DD.json'));
    assert.strictEqual(hubSource.includes('careerpak_complete_system_backup'), false, 'Old misleading filename must be completely absent from AdminDataBackupHub.tsx');

    // Render component and verify UI elements
    const html = renderToStaticMarkup(React.createElement(AdminDataBackupHub));
    assert.ok(html.includes('careerpak_selected_admin_data_snapshot_YYYY-MM-DD.json'));
    assert.strictEqual(html.includes('careerpak_complete_system_backup'), false);

    // Behavioral check with mocked DOM globals
    const prevDocument = (globalThis as any).document;
    const prevCreateObjectUrl = URL.createObjectURL;
    const prevRevokeObjectUrl = URL.revokeObjectURL;

    let createdBlob: Blob | null = null;
    let revokedUrl: string | null = null;
    let clicked = false;
    let removed = false;
    const attrs: Record<string, string> = {};

    (URL as any).createObjectURL = (blob: Blob) => {
      createdBlob = blob;
      return 'blob:mock-test-url-123';
    };
    (URL as any).revokeObjectURL = (url: string) => {
      revokedUrl = url;
    };
    (globalThis as any).document = {
      createElement: () => ({
        style: {},
        setAttribute: (k: string, v: string) => { attrs[k] = v; },
        click: () => { clicked = true; },
        remove: () => { removed = true; }
      }),
      body: {
        appendChild: () => {}
      }
    };

    try {
      const issuedUrl = triggerBlobDownload('{"ok":true}', 'application/json;charset=utf-8;', 'careerpak_selected_admin_data_snapshot_2026-11-16.json', { revokeDelayMs: 0 });
      assert.strictEqual(issuedUrl, 'blob:mock-test-url-123');
      assert.ok(createdBlob instanceof Blob);
      assert.strictEqual(attrs.href, 'blob:mock-test-url-123');
      assert.strictEqual(attrs.download, 'careerpak_selected_admin_data_snapshot_2026-11-16.json');
      assert.strictEqual(clicked, true);
      assert.strictEqual(removed, true);
      await new Promise((resolve) => setTimeout(resolve, 15));
      assert.strictEqual(revokedUrl, 'blob:mock-test-url-123');
    } finally {
      (globalThis as any).document = prevDocument;
      (URL as any).createObjectURL = prevCreateObjectUrl;
      (URL as any).revokeObjectURL = prevRevokeObjectUrl;
    }
  });

  console.log('------------------------------------------------------------------');
  console.log(`Summary: Passed=${counts.passed}, Failed=${counts.failed}, Skipped=${counts.skipped}`);
  console.log('==================================================================');

  if (counts.failed > 0) {
    process.exit(1);
  }
}

runSuite().catch((err) => {
  console.error('Unhandled suite failure:', err);
  process.exit(1);
});
