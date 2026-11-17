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
  AdminNavMode,
  ADMIN_TAB_CATEGORIES,
  ADMIN_ROLE_DEFAULT_PERMS,
  checkAdminTabPermission,
  navigateWithAdminPermission,
  buildAllModulesMenuGroups,
  buildProfessionalAllModulesMenuGroups
} from '../../src/components/AdminDashboard';
import {
  ADMIN_NAVIGATION_MODULES,
  CLASSIC_ADMIN_CATEGORIES,
  CLASSIC_CATEGORY_MODULE_ORDER,
  PROFESSIONAL_ADMIN_CATEGORIES,
  ADMIN_TAB_ALIASES,
  resolveCanonicalAdminTab,
  getAdminNavModeStorageKey,
  resolveStoredAdminNavMode,
  persistAdminNavMode,
  getClassicCategorySubTabs,
  buildProfessionalMenuCategories,
  searchAdminNavigationModules,
  AdminNavCounts,
  AdminNavigationModeToggle,
  AdminProfessionalSidebar,
  AdminProfessionalMobileDrawer
} from '../../src/components/admin/AdminDashboardNavigation';
import {
  AdminAnalyticsOverview,
  ANALYTICS_SHORTCUT_TAB_IDS,
  computeAnalyticsMetrics,
  AnalyticsTimeRange,
  parseAnalyticsTimestamp,
  isTimestampInRange,
  convertRecordAmountToPkr,
  convertPkrAmount,
  formatAnalyticsCurrency
} from '../../src/components/admin/AdminAnalyticsOverview';
import {
  AdminAiQualityEnhancer,
  evaluateRuleBasedJobQuality,
  applyRuleBasedEnhancement
} from '../../src/components/admin/AdminAiQualityEnhancer';
import {
  AdminBulkNotificationTool,
  BulkNotificationBroadcast,
  NOTIFICATION_DRAFTS_STORAGE_KEY,
  inspectStoredNotificationDrafts,
  parseStoredNotificationDrafts,
  saveNotificationDraftToStorage,
  deleteNotificationDraftFromStorage
} from '../../src/components/admin/AdminBulkNotificationTool';
import {
  AdminPaymentMethodsManager,
  CAMPAIGN_DURATION_PRESETS_KEY,
  saveDurationPresetsToStorage
} from '../../src/components/admin/AdminPaymentMethodsManager';
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
  BACKUP_SNAPSHOT_SCHEMA_VERSION,
  CurrencyExchangeConfig
} from '../../src/types/adminSuite';
import {
  executeFeeConfigSave
} from '../../src/components/admin/AdminFeeManager';
import { executeAuthoritativeJobUpdate } from '../../src/App';
import { DEFAULT_LANDING_PAGE_CONFIG } from '../../src/types/landing';
import {
  DEFAULT_JOB_POSTING_PRICING_CONFIG,
  Job,
  JobPostingFeeLog,
  PaymentTransaction,
  Subscriber
} from '../../src/types/job';
import { Advertisement, DEFAULT_AD_PRICING_CONFIG } from '../../src/types/ad';
import { DEFAULT_ADMIN_RECEIVING_PAYMENT_CONFIG } from '../../src/types/adminPayment';
import { DEFAULT_WHATSAPP_CONFIG } from '../../src/components/WhatsAppStickyButton';
import { INITIAL_SITE_SEO_CONFIG, INITIAL_CURRENCY_CONFIG } from '../../src/data/mockAdminSuiteData';

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

  // --- STEP G (STEP-PHASE8.1-B): PROFESSIONAL ADMIN MENU ALONGSIDE CLASSIC MENU ---
  const sampleNavCounts: AdminNavCounts = {
    activeJobsCount: 12,
    pendingJobsCount: 4,
    activeAdsCount: 3,
    pendingProofsCount: 2,
    feeLogsCount: 9,
    usersCount: 25,
    kycBadgeText: '3 KYC',
    kycPendingCount: 3,
    subscribersCount: 8,
    chatMessagesCount: 6
  };

  await runTest('PHASE 8.1-B: Canonical module registry has exactly 31 unique modules mapped across 7 Classic and 8 Professional categories', () => {
    assert.strictEqual(ADMIN_NAVIGATION_MODULES.length, 31, 'Expected exactly 31 unique modules (30 existing + locations-manager)');
    const ids = ADMIN_NAVIGATION_MODULES.map((m) => m.id);
    assert.strictEqual(new Set(ids).size, 31, 'Canonical module IDs must be strictly unique');
    assert.strictEqual(CLASSIC_ADMIN_CATEGORIES.length, 7);
    assert.strictEqual(PROFESSIONAL_ADMIN_CATEGORIES.length, 8);

    const expectedProStructure: Record<string, string[]> = {
      'overview-analytics': ['analytics', 'activity-logs'],
      'jobs-moderation': ['jobs', 'pending', 'add-job', 'ai-enhancer'],
      'scraper-ingestion': ['scraper'],
      'ads-campaigns': ['campaign-center', 'advertisements', 'landing-customizer'],
      'finance-payments': ['pricing-controller', 'admin-payment-methods', 'payment-proofs', 'fee-management', 'fee-logs', 'currency-forex'],
      'users-kyc-support': ['user-audit', 'employer-kyc', 'subscribers', 'chat-hub'],
      'communication-alerts': ['whatsapp-manager', 'broadcast-center', 'bulk-notifications'],
      'platform-settings-data': ['locations-manager', 'apply-settings', 'modal-content-manager', 'job-visibility', 'seo-config', 'settings', 'form-customizer', 'data-backup']
    };

    const superAdminCanAccess = (tabId: string) =>
      checkAdminTabPermission('Super Admin', ADMIN_ROLE_DEFAULT_PERMS['Super Admin'], true, tabId);

    const proGroups = buildProfessionalMenuCategories(sampleNavCounts, superAdminCanAccess);
    assert.strictEqual(proGroups.length, 8, 'Super Admin must see all 8 Professional categories');

    for (const [catId, expectedIds] of Object.entries(expectedProStructure)) {
      const group = proGroups.find((g) => g.id === catId);
      assert.ok(group, `Expected Professional category "${catId}" to exist`);
      assert.deepStrictEqual(
        group!.items.map((it) => it.id),
        expectedIds,
        `Mismatch in child modules for Professional category "${catId}"`
      );
    }

    // Classic All Modules Matrix preserves original 30 modules and zero duplicates (excluding locations-manager)
    const allModulesGroups = buildAllModulesMenuGroups(sampleNavCounts);
    const matrixIds = allModulesGroups.flatMap((g) => g.items.map((i) => i.id));
    assert.strictEqual(matrixIds.length, 30);
    assert.strictEqual(new Set(matrixIds).size, 30);
    assert.strictEqual(matrixIds.includes('locations-manager'), false, 'Classic All Modules Matrix must NOT include locations-manager');
    assert.strictEqual(matrixIds.filter((id) => id === 'whatsapp-manager').length, 1);

    // Every module ID and alias exists in ADMIN_TAB_CATEGORIES
    for (const mod of ADMIN_NAVIGATION_MODULES) {
      assert.strictEqual(ADMIN_TAB_CATEGORIES[mod.id], mod.classicCategory);
      for (const alias of mod.aliases || []) {
        assert.strictEqual(ADMIN_TAB_CATEGORIES[alias], mod.classicCategory);
      }
    }
  });

  await runTest('PHASE 8.1-B: Menu mode defaults to classic and persists locally per adminId using admin_nav_mode_${adminId} with zero backend calls', () => {
    const storeMap = new Map<string, string>();
    const mockStorage: Pick<Storage, 'getItem' | 'setItem'> = {
      getItem: (k: string) => (storeMap.has(k) ? storeMap.get(k)! : null),
      setItem: (k: string, v: string) => {
        storeMap.set(k, v);
      }
    };

    assert.strictEqual(getAdminNavModeStorageKey('adm-101'), 'admin_nav_mode_adm-101');
    assert.strictEqual(getAdminNavModeStorageKey('  '), null);
    assert.strictEqual(getAdminNavModeStorageKey(null), null);

    // Missing, null, empty, invalid -> Classic default
    assert.strictEqual(resolveStoredAdminNavMode(undefined, mockStorage), 'classic');
    assert.strictEqual(resolveStoredAdminNavMode('adm-101', mockStorage), 'classic');
    assert.strictEqual(resolveStoredAdminNavMode('adm-101', null), 'classic');

    storeMap.set('admin_nav_mode_adm-101', 'invalid-mode');
    assert.strictEqual(resolveStoredAdminNavMode('adm-101', mockStorage), 'classic');

    // Persisting professional mode is isolated to the specific adminId
    assert.strictEqual(persistAdminNavMode('adm-101', 'professional', mockStorage), true);
    assert.strictEqual(storeMap.get('admin_nav_mode_adm-101'), 'professional');
    assert.strictEqual(resolveStoredAdminNavMode('adm-101', mockStorage), 'professional');
    assert.strictEqual(resolveStoredAdminNavMode('adm-202', mockStorage), 'classic');

    // Switching back to classic works cleanly
    assert.strictEqual(persistAdminNavMode('adm-101', 'classic', mockStorage), true);
    assert.strictEqual(resolveStoredAdminNavMode('adm-101', mockStorage), 'classic');

    // Type check & zero network dependency check on AdminDashboardNavigation.tsx
    const defaultMode: AdminNavMode = resolveStoredAdminNavMode('adm-303', {
      getItem: () => {
        throw new Error('Storage denied');
      }
    });
    assert.strictEqual(defaultMode, 'classic');

    const navModuleSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/admin/AdminDashboardNavigation.tsx'),
      'utf8'
    );
    assert.strictEqual(navModuleSource.includes('fetch('), false);
    assert.strictEqual(navModuleSource.includes('/api/'), false);
    assert.ok(navModuleSource.includes('admin_nav_mode_'));

    const dashSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/AdminDashboard.tsx'),
      'utf8'
    );
    assert.ok(dashSource.includes("const [navMode, setNavMode] = useState<AdminNavMode>('classic')"));
    assert.ok(dashSource.includes('resolveStoredAdminNavMode(verifiedAdminId)'));
    assert.ok(dashSource.includes('persistAdminNavMode(verifiedAdminId, safeMode)'));
  });

  await runTest('PHASE 8.1-B: Tab aliases (stats, url-scraper, scraped-history), locations-manager, and whatsapp-manager resolve cleanly without duplicate screens or forbidden imports', () => {
    assert.strictEqual(ADMIN_TAB_ALIASES.stats, 'analytics');
    assert.strictEqual(ADMIN_TAB_ALIASES['url-scraper'], 'scraper');
    assert.strictEqual(ADMIN_TAB_ALIASES['scraped-history'], 'scraper');

    assert.strictEqual(resolveCanonicalAdminTab('stats'), 'analytics');
    assert.strictEqual(resolveCanonicalAdminTab('url-scraper'), 'scraper');
    assert.strictEqual(resolveCanonicalAdminTab('scraped-history'), 'scraper');
    assert.strictEqual(resolveCanonicalAdminTab('locations-manager'), 'locations-manager');

    assert.strictEqual(ADMIN_TAB_CATEGORIES['stats'], 'settings');
    assert.strictEqual(ADMIN_TAB_CATEGORIES['url-scraper'], 'scraper');
    assert.strictEqual(ADMIN_TAB_CATEGORIES['scraped-history'], 'scraper');
    assert.strictEqual(ADMIN_TAB_CATEGORIES['locations-manager'], 'settings');

    // Aliases work in permission checks
    assert.strictEqual(checkAdminTabPermission('Super Admin', ['*'], true, 'stats'), true);
    assert.strictEqual(checkAdminTabPermission('Custom Settings', ['settings.manage'], true, 'stats'), true);
    assert.strictEqual(checkAdminTabPermission('Custom Settings', ['settings.manage'], true, 'locations-manager'), true);
    assert.strictEqual(checkAdminTabPermission('Job Moderator', ADMIN_ROLE_DEFAULT_PERMS['Job Moderator'], true, 'stats'), false);
    assert.strictEqual(checkAdminTabPermission('Job Moderator', ADMIN_ROLE_DEFAULT_PERMS['Job Moderator'], true, 'locations-manager'), false);

    const dashSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/AdminDashboard.tsx'),
      'utf8'
    );
    const navSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/admin/AdminDashboardNavigation.tsx'),
      'utf8'
    );

    // Existing components wired cleanly without duplicates or unmounted legacy files
    assert.ok(dashSource.includes("(adminTab === 'analytics' || adminTab === 'stats')"));
    assert.ok(dashSource.includes("adminTab === 'locations-manager' && canAccessAdminTab('locations-manager')"));
    assert.ok(dashSource.includes("<AdminLocationManager />"));
    assert.ok(dashSource.includes("<AdminWhatsAppManager"));
    assert.ok(dashSource.includes("<AdminWhatsAppSettings"));
    assert.ok(dashSource.includes("<AutomatedScraperHub"));

    for (const forbiddenRef of ['AdminUrlScraperController', 'ScrapedJobHistoryModule', 'AdminDuplicateResolutionModal']) {
      assert.strictEqual(dashSource.includes(forbiddenRef), false, `AdminDashboard.tsx must not reference ${forbiddenRef}`);
      assert.strictEqual(navSource.includes(forbiddenRef), false, `AdminDashboardNavigation.tsx must not reference ${forbiddenRef}`);
    }
  });

  await runTest('PHASE 8.1-B: Role-based permissions hide unauthorized modules & empty Professional categories cleanly', () => {
    // 1. SEO Manager sees ONLY platform-settings-data -> ['seo-config']
    const seoCan = (t: string) => checkAdminTabPermission('SEO Manager', ADMIN_ROLE_DEFAULT_PERMS['SEO Manager'], true, t);
    const seoPro = buildProfessionalMenuCategories(sampleNavCounts, seoCan);
    assert.strictEqual(seoPro.length, 1);
    assert.strictEqual(seoPro[0].id, 'platform-settings-data');
    assert.deepStrictEqual(seoPro[0].items.map((i) => i.id), ['seo-config']);

    // 2. Payment Manager sees ONLY finance-payments -> ['admin-payment-methods', 'payment-proofs', 'fee-logs']
    const payCan = (t: string) => checkAdminTabPermission('Payment Manager', ADMIN_ROLE_DEFAULT_PERMS['Payment Manager'], true, t);
    const payPro = buildProfessionalMenuCategories(sampleNavCounts, payCan);
    assert.strictEqual(payPro.length, 1);
    assert.strictEqual(payPro[0].id, 'finance-payments');
    assert.deepStrictEqual(payPro[0].items.map((i) => i.id), ['admin-payment-methods', 'payment-proofs', 'fee-logs']);

    // 3. Finance Manager sees all 6 finance modules
    const finCan = (t: string) => checkAdminTabPermission('Finance Manager', ADMIN_ROLE_DEFAULT_PERMS['Finance Manager'], true, t);
    const finPro = buildProfessionalMenuCategories(sampleNavCounts, finCan);
    assert.strictEqual(finPro.length, 1);
    assert.deepStrictEqual(
      finPro[0].items.map((i) => i.id),
      ['pricing-controller', 'admin-payment-methods', 'payment-proofs', 'fee-management', 'fee-logs', 'currency-forex']
    );

    // 4. Job Moderator sees only jobs-moderation
    const jobModCan = (t: string) => checkAdminTabPermission('Job Moderator', ADMIN_ROLE_DEFAULT_PERMS['Job Moderator'], true, t);
    const jobPro = buildProfessionalMenuCategories(sampleNavCounts, jobModCan);
    assert.strictEqual(jobPro.length, 1);
    assert.strictEqual(jobPro[0].id, 'jobs-moderation');
    assert.deepStrictEqual(jobPro[0].items.map((i) => i.id), ['jobs', 'pending', 'add-job', 'ai-enhancer']);

    // 5. Custom Audit Viewer sees only overview-analytics -> ['activity-logs']
    const auditCan = (t: string) => checkAdminTabPermission('Custom Audit', ['audit.view'], true, t);
    const auditPro = buildProfessionalMenuCategories(sampleNavCounts, auditCan);
    assert.strictEqual(auditPro.length, 1);
    assert.strictEqual(auditPro[0].id, 'overview-analytics');
    assert.deepStrictEqual(auditPro[0].items.map((i) => i.id), ['activity-logs']);

    // 6. Custom Users Manager sees only users-kyc-support
    const usersCan = (t: string) => checkAdminTabPermission('Custom Users', ['users.manage'], true, t);
    const usersPro = buildProfessionalMenuCategories(sampleNavCounts, usersCan);
    assert.strictEqual(usersPro.length, 1);
    assert.strictEqual(usersPro[0].id, 'users-kyc-support');
    assert.deepStrictEqual(usersPro[0].items.map((i) => i.id), ['user-audit', 'employer-kyc', 'subscribers', 'chat-hub']);

    // 7. Custom Settings Manager sees analytics, communication-alerts, and settings WITHOUT data-backup
    const settingsCan = (t: string) => checkAdminTabPermission('Custom Settings', ['settings.manage'], true, t);
    const settingsPro = buildProfessionalMenuCategories(sampleNavCounts, settingsCan);
    const settingsIds = settingsPro.flatMap((g) => g.items.map((i) => i.id));
    assert.ok(settingsIds.includes('locations-manager'));
    assert.ok(settingsIds.includes('whatsapp-manager'));
    assert.ok(settingsIds.includes('analytics'));
    assert.strictEqual(settingsIds.includes('data-backup'), false, 'Non-Admin with settings.manage must NEVER see data-backup');

    // Classic sub-tabs respect permission filter AND omit locations-manager
    const classicSettingsTabs = getClassicCategorySubTabs('settings', sampleNavCounts, settingsCan).map((t) => t.id);
    assert.deepStrictEqual(classicSettingsTabs, [
      'apply-settings',
      'modal-content-manager',
      'job-visibility',
      'settings',
      'form-customizer',
      'analytics'
    ]);
    assert.strictEqual(classicSettingsTabs.includes('locations-manager'), false);
    assert.strictEqual(classicSettingsTabs.includes('data-backup'), false);

    // Unverified admin sees 0 categories/modules
    const unverifiedPro = buildProfessionalMenuCategories(sampleNavCounts, (t) =>
      checkAdminTabPermission('Super Admin', ['*'], false, t)
    );
    assert.strictEqual(unverifiedPro.length, 0);
  });

  await runTest('PHASE 8.1-B: Bilingual search matches English, Urdu, IDs, aliases, keywords, and category names while respecting permissions', () => {
    const superCan = (t: string) => checkAdminTabPermission('Super Admin', ['*'], true, t);
    const jobModCan = (t: string) => checkAdminTabPermission('Job Moderator', ADMIN_ROLE_DEFAULT_PERMS['Job Moderator'], true, t);

    assert.ok(searchAdminNavigationModules('jazzcash', sampleNavCounts, superCan).some((m) => m.id === 'admin-payment-methods'));
    assert.ok(searchAdminNavigationModules('شہر', sampleNavCounts, superCan).some((m) => m.id === 'locations-manager'));
    assert.ok(searchAdminNavigationModules('cities', sampleNavCounts, superCan).some((m) => m.id === 'locations-manager'));
    assert.ok(searchAdminNavigationModules('stats', sampleNavCounts, superCan).some((m) => m.id === 'analytics'));
    assert.ok(searchAdminNavigationModules('رسید', sampleNavCounts, superCan).some((m) => m.id === 'payment-proofs'));
    assert.ok(searchAdminNavigationModules('Finance & Payments', sampleNavCounts, superCan).length === 6);

    // Restricted role search must never reveal unauthorized modules
    assert.strictEqual(searchAdminNavigationModules('jazzcash', sampleNavCounts, jobModCan).length, 0);
    assert.strictEqual(searchAdminNavigationModules('Finance & Payments', sampleNavCounts, jobModCan).length, 0);
    assert.deepStrictEqual(
      searchAdminNavigationModules('اسپیم', sampleNavCounts, jobModCan).map((m) => m.id),
      ['ai-enhancer']
    );
  });

  await runTest('PHASE 8.1-B: Professional mode UI components render cleanly via SSR and untouched feature internal tabs remain intact', () => {
    const toggleHtml = renderToStaticMarkup(
      React.createElement(AdminNavigationModeToggle, {
        mode: 'classic',
        onChangeMode: () => {}
      })
    );
    assert.ok(toggleHtml.includes('Classic Menu'));
    assert.ok(toggleHtml.includes('Professional Menu'));
    assert.ok(toggleHtml.includes('aria-pressed="true"'));

    const superCan = (t: string) => checkAdminTabPermission('Super Admin', ['*'], true, t);
    const sidebarExpandedHtml = renderToStaticMarkup(
      React.createElement(AdminProfessionalSidebar, {
        activeTab: 'stats',
        counts: sampleNavCounts,
        canAccessTab: superCan,
        onSelectTab: () => {},
        onOpenAllModules: () => {},
        isCollapsed: false,
        onToggleCollapse: () => {}
      })
    );
    assert.ok(sidebarExpandedHtml.includes('Overview &amp; Analytics'));
    assert.ok(sidebarExpandedHtml.includes('All Modules Matrix'));
    assert.ok(sidebarExpandedHtml.includes('aria-label="Collapse sidebar"'));

    const sidebarCollapsedHtml = renderToStaticMarkup(
      React.createElement(AdminProfessionalSidebar, {
        activeTab: 'locations-manager',
        counts: sampleNavCounts,
        canAccessTab: superCan,
        onSelectTab: () => {},
        onOpenAllModules: () => {},
        isCollapsed: true,
        onToggleCollapse: () => {}
      })
    );
    assert.ok(sidebarCollapsedHtml.includes('aria-label="Expand sidebar"'));

    const drawerClosedHtml = renderToStaticMarkup(
      React.createElement(AdminProfessionalMobileDrawer, {
        isOpen: false,
        onClose: () => {},
        activeTab: 'analytics',
        counts: sampleNavCounts,
        canAccessTab: superCan,
        onSelectTab: () => {},
        onOpenAllModules: () => {}
      })
    );
    assert.strictEqual(drawerClosedHtml, '');

    const drawerOpenHtml = renderToStaticMarkup(
      React.createElement(AdminProfessionalMobileDrawer, {
        isOpen: true,
        onClose: () => {},
        activeTab: 'analytics',
        counts: sampleNavCounts,
        canAccessTab: superCan,
        onSelectTab: () => {},
        onOpenAllModules: () => {}
      })
    );
    assert.ok(drawerOpenHtml.includes('role="dialog"'));
    assert.ok(drawerOpenHtml.includes('Professional Admin Menu'));
    assert.ok(drawerOpenHtml.includes('All Modules'));

    // Verify AdminDashboard exposes visible mobile All Modules + drawer button in Professional mode
    const dashSource = fs.readFileSync(path.resolve(process.cwd(), 'src/components/AdminDashboard.tsx'), 'utf8');
    assert.ok(dashSource.includes('Open Professional Navigation Drawer'));
    assert.ok(dashSource.includes('<span>All Modules</span>'));

    // Verify untouched feature internal tabs remain intact
    const featureInternalChecks: Array<[string, string[]]> = [
      ['src/components/admin/AutomatedScraperHub.tsx', ["'overview' | 'sources' | 'run' | 'history' | 'review' | 'settings'"]],
      ['src/components/ads/AdminAdHub.tsx', ["'directory' | 'approvals' | 'slots' | 'customizer' | 'pricing' | 'performance'"]],
      ['src/components/admin/AdminCampaignCenter.tsx', ['handleTogglePlacement', 'selectedPlacementFilter', 'selectedStatusFilter']],
      ['src/components/admin/LandingPageCustomizer.tsx', ["'hero' | 'sections' | 'custom-cards' | 'design' | 'promos' | 'preview'"]],
      ['src/components/admin/AdminFeeManager.tsx', ["'categories' | 'exemptions' | 'global-tiers' | 'job-waivers'"]],
      ['src/components/admin/AdminPaymentMethodsManager.tsx', ["'methods' | 'durations'"]],
      ['src/components/admin/AdminBroadcastCenter.tsx', ["'compose' | 'history' | 'templates' | 'providers'"]]
    ];
    for (const [relPath, markers] of featureInternalChecks) {
      const content = fs.readFileSync(path.resolve(process.cwd(), relPath), 'utf8');
      for (const marker of markers) {
        assert.ok(content.includes(marker), `Expected untouched internal sub-tab marker "${marker}" in ${relPath}`);
      }
    }
  });

  await runTest('Classic Parity Restoration: preserves exact 7 categories, original 30-module Classic sub-tabs & All Modules Matrix order, and keeps Location Manager inside Classic Settings', () => {
    const expectedClassicOrder: Record<AdminCategory, string[]> = {
      jobs: ['jobs', 'pending', 'add-job', 'ai-enhancer'],
      scraper: ['scraper'],
      ads: ['campaign-center', 'advertisements', 'landing-customizer'],
      payments: [
        'pricing-controller',
        'admin-payment-methods',
        'payment-proofs',
        'fee-management',
        'fee-logs',
        'currency-forex'
      ],
      users: ['user-audit', 'employer-kyc', 'subscribers', 'chat-hub'],
      alerts: ['whatsapp-manager', 'broadcast-center', 'bulk-notifications'],
      settings: [
        'apply-settings',
        'modal-content-manager',
        'job-visibility',
        'seo-config',
        'settings',
        'form-customizer',
        'activity-logs',
        'data-backup',
        'analytics'
      ]
    };

    assert.deepStrictEqual(
      CLASSIC_ADMIN_CATEGORIES.map((c) => c.id),
      ['jobs', 'scraper', 'ads', 'payments', 'users', 'alerts', 'settings']
    );
    assert.deepStrictEqual(CLASSIC_CATEGORY_MODULE_ORDER, expectedClassicOrder);

    const superCan = (t: string) => checkAdminTabPermission('Super Admin', ['*'], true, t);

    // Verify Classic sub-tabs for all 7 categories
    for (const cat of CLASSIC_ADMIN_CATEGORIES) {
      const subTabs = getClassicCategorySubTabs(cat.id, sampleNavCounts, superCan);
      assert.deepStrictEqual(
        subTabs.map((t) => t.id),
        expectedClassicOrder[cat.id],
        `Classic sub-tab order mismatch for category "${cat.id}"`
      );
    }

    // Specifically verify Classic Settings has NO locations-manager entry and matches exact 9-item order
    const classicSettingsIds = getClassicCategorySubTabs('settings', sampleNavCounts, superCan).map((t) => t.id);
    assert.strictEqual(classicSettingsIds.includes('locations-manager'), false);
    assert.deepStrictEqual(classicSettingsIds, expectedClassicOrder.settings);

    // Verify All Modules Matrix preserves exact original 7 groups and 30 ordered module IDs
    const allModules = buildAllModulesMenuGroups(sampleNavCounts);
    assert.deepStrictEqual(
      allModules.map((g) => g.catKey),
      ['jobs', 'scraper', 'ads', 'payments', 'users', 'alerts', 'settings']
    );
    for (const group of allModules) {
      assert.deepStrictEqual(
        group.items.map((i) => i.id),
        expectedClassicOrder[group.catKey],
        `All Modules Matrix order mismatch for "${group.catKey}"`
      );
      assert.strictEqual(
        group.items.some((i) => i.id === 'locations-manager'),
        false,
        `All Modules Matrix group "${group.catKey}" must not contain locations-manager`
      );
    }

    // Verify Classic sub-tab counts, dynamic labels, and NEW badges match original behavior
    const jobsSubTabs = getClassicCategorySubTabs('jobs', sampleNavCounts, superCan);
    assert.strictEqual(jobsSubTabs[0].label, 'Live Listings (12)');
    assert.strictEqual(jobsSubTabs[1].label, 'Pending Approvals (4)');
    assert.strictEqual(jobsSubTabs[1].badge, 4);

    const paySubTabs = getClassicCategorySubTabs('payments', sampleNavCounts, superCan);
    assert.strictEqual(paySubTabs[0].isNew, true);
    assert.strictEqual(paySubTabs[1].isNew, true);
    assert.strictEqual(paySubTabs[2].label, 'Receipt Proofs Verification (2)');
    assert.strictEqual(paySubTabs[4].label, 'Per-Job Fee Logs (9)');

    const usersSubTabs = getClassicCategorySubTabs('users', sampleNavCounts, superCan);
    assert.strictEqual(usersSubTabs[0].label, 'User Directory (25)');
    assert.strictEqual(usersSubTabs[1].label, 'Employer KYC Verification (3)');
    assert.strictEqual(usersSubTabs[2].label, 'Paid Subscribers (8)');
    assert.strictEqual(usersSubTabs[3].label, 'User Support Chat Hub (6)');

    // Verify existing <AdminLocationManager /> remains rendered inside Classic settings tab in AdminDashboard.tsx
    const dashSource = fs.readFileSync(path.resolve(process.cwd(), 'src/components/AdminDashboard.tsx'), 'utf8');
    const settingsTabIdx = dashSource.indexOf("{adminTab === 'settings' && (");
    const locationsInSettingsIdx = dashSource.indexOf('<AdminLocationManager />', settingsTabIdx);
    assert.ok(settingsTabIdx !== -1, 'Expected Classic settings tab render block in AdminDashboard.tsx');
    assert.ok(locationsInSettingsIdx > settingsTabIdx, 'Expected original <AdminLocationManager /> inside Classic settings screen');
  });

  await runTest('AUDIT-01: Professional All Modules modal exposes all 31 canonical modules grouped by PROFESSIONAL_ADMIN_CATEGORIES while Classic preserves 30', () => {
    const sampleNavCounts: AdminNavCounts = {
      activeJobsCount: 10,
      pendingJobsCount: 2,
      activeAdsCount: 3,
      pendingProofsCount: 1,
      feeLogsCount: 4,
      usersCount: 20,
      kycBadgeText: '2 KYC',
      kycPendingCount: 2,
      subscribersCount: 5,
      chatMessagesCount: 6
    };

    const proMatrixGroups = buildProfessionalAllModulesMenuGroups(sampleNavCounts);
    assert.strictEqual(proMatrixGroups.length, 8);
    assert.deepStrictEqual(
      proMatrixGroups.map((g) => g.catKey),
      PROFESSIONAL_ADMIN_CATEGORIES.map((c) => c.id)
    );
    const proIds = proMatrixGroups.flatMap((g) => g.items.map((i) => i.id));
    assert.strictEqual(proIds.length, 31, 'Professional All Modules must contain all 31 canonical modules');
    assert.strictEqual(new Set(proIds).size, 31, 'Professional All Modules must have zero duplicate module IDs');
    assert.ok(proIds.includes('locations-manager'), 'Professional All Modules must include locations-manager');

    const classicMatrixGroups = buildAllModulesMenuGroups(sampleNavCounts);
    const classicIds = classicMatrixGroups.flatMap((g) => g.items.map((i) => i.id));
    assert.strictEqual(classicIds.length, 30, 'Classic All Modules must still contain exact 30 modules');
    assert.strictEqual(classicIds.includes('locations-manager'), false);

    const dashSource = fs.readFileSync(path.resolve(process.cwd(), 'src/components/AdminDashboard.tsx'), 'utf8');
    assert.ok(
      dashSource.includes("navMode === 'professional'\n                      ? buildProfessionalAllModulesMenuGroups(navCounts)\n                      : buildAllModulesMenuGroups(navCounts)") ||
        dashSource.includes('buildProfessionalAllModulesMenuGroups(navCounts)'),
      'AdminDashboard modal must switch to buildProfessionalAllModulesMenuGroups in professional mode'
    );
  });

  await runTest('AUDIT-02: AdminDashboard wires ai-enhancer to onUpdateJob (never onAddJob) and App.tsx handleUpdateJob returns explicit confirmation', () => {
    const dashSource = fs.readFileSync(path.resolve(process.cwd(), 'src/components/AdminDashboard.tsx'), 'utf8');
    const aiBlockStart = dashSource.indexOf("adminTab === 'ai-enhancer'");
    assert.ok(aiBlockStart !== -1, 'Expected ai-enhancer render branch in AdminDashboard.tsx');
    const aiBlockEnd = dashSource.indexOf('/>', aiBlockStart);
    const aiBlock = dashSource.slice(aiBlockStart, aiBlockEnd);
    assert.ok(aiBlock.includes('onUpdateJob={onUpdateJob}'), 'ai-enhancer must receive real onUpdateJob callback');
    assert.strictEqual(aiBlock.includes('onAddJob('), false, 'ai-enhancer must NEVER route updates to onAddJob');

    const appSource = fs.readFileSync(path.resolve(process.cwd(), 'src/App.tsx'), 'utf8');
    const updateIdx = appSource.indexOf('const handleUpdateJob = async (updatedJob: Job)');
    assert.ok(updateIdx !== -1);
    const updateSnippet = appSource.slice(updateIdx, updateIdx + 700);
    assert.ok(updateSnippet.includes('res && res.success'), 'handleUpdateJob must verify api.jobs.update success response');
    assert.ok(updateSnippet.includes('success: false'), 'handleUpdateJob must return explicit { success: false } on failure');
  });

  await runTest('AUDIT-03: Rule-Based Quality Analyzer removes mock/AI fabrications, verifies update success/failure, preserves ID, and handles empty state cleanly', async () => {
    const enhancerSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/admin/AdminAiQualityEnhancer.tsx'),
      'utf8'
    );
    assert.strictEqual(enhancerSource.includes('INITIAL_AI_AUDIT_REPORTS'), false, 'Must not pre-populate with mock audit reports');
    assert.strictEqual(enhancerSource.includes('120,000 - 180,000'), false, 'Must not fabricate salary benchmarks');
    assert.strictEqual(enhancerSource.includes('Spearhead technical roadmap'), false, 'Must not fabricate job bullet deliverables');
    assert.strictEqual(enhancerSource.includes('alert('), false, 'Must not use blocking window.alert');

    const emptyHtml = renderToStaticMarkup(React.createElement(AdminAiQualityEnhancer, { jobs: [], pendingJobs: [] }));
    assert.ok(emptyHtml.includes('Rule-Based Quality Analyzer'));
    assert.ok(emptyHtml.includes('No jobs available to analyze'));
    assert.ok(emptyHtml.includes('Update Unavailable') || emptyHtml.includes('read-only'));

    const sampleJob: any = {
      id: 'job-audit-test-1',
      title: 'Senior Backend Engineer',
      company: 'Acme Systems',
      region: 'Pakistan',
      jobType: 'Full-Time',
      experienceLevel: 'Senior',
      salary: '',
      description: 'Build reliable backend APIs.',
      tags: ['Node.js'],
      requirements: ['4+ years TypeScript']
    };

    // Unscanned listing must show Not scanned instead of fake 88 / 85 fallback scores
    const unscannedHtml = renderToStaticMarkup(
      React.createElement(AdminAiQualityEnhancer, { jobs: [sampleJob], pendingJobs: [], onUpdateJob: async () => ({ success: true }) })
    );
    assert.ok(unscannedHtml.includes('Not scanned yet'));
    assert.ok(unscannedHtml.includes('Not scanned'));
    assert.strictEqual(unscannedHtml.includes('>88<'), false);
    assert.strictEqual(unscannedHtml.includes('85/100'), false);

    // Deterministic scoring & preservation of ID and empty salary
    const report = evaluateRuleBasedJobQuality(sampleJob);
    assert.strictEqual(report.jobId, 'job-audit-test-1');
    assert.ok(!report.suggestedSalaryRange.includes('120,000'));
    assert.ok(report.enhancedDescriptionPreview.includes('Build reliable backend APIs.'));

    // Missing callback returns error without mutation
    const missingOutcome = await applyRuleBasedEnhancement({
      activeJob: sampleJob,
      activeReport: report,
      onUpdateJob: undefined
    });
    assert.strictEqual(missingOutcome.ok, false);

    // Backend rejection / false must surface failure
    const failedOutcome = await applyRuleBasedEnhancement({
      activeJob: sampleJob,
      activeReport: report,
      onUpdateJob: async () => ({ success: false, message: 'Forbidden by role' })
    });
    assert.strictEqual(failedOutcome.ok, false);
    assert.strictEqual(failedOutcome.message, 'Forbidden by role');

    // Rejected promise must surface failure cleanly
    const rejectedOutcome = await applyRuleBasedEnhancement({
      activeJob: sampleJob,
      activeReport: report,
      onUpdateJob: async () => {
        throw new Error('Network unreachable');
      }
    });
    assert.strictEqual(rejectedOutcome.ok, false);
    assert.strictEqual(rejectedOutcome.message, 'Network unreachable');

    // Confirmed update preserves job ID and never invents salary
    let receivedUpdate: any = null;
    const okOutcome = await applyRuleBasedEnhancement({
      activeJob: sampleJob,
      activeReport: report,
      onUpdateJob: async (j) => {
        receivedUpdate = j;
        return { success: true, job: j };
      }
    });
    assert.strictEqual(okOutcome.ok, true);
    assert.strictEqual(receivedUpdate.id, 'job-audit-test-1');
    assert.strictEqual(receivedUpdate.salary, '');
    assert.ok(receivedUpdate.tags.includes('Node.js'));
    assert.ok(receivedUpdate.tags.includes('Full-Time'));
  });

  await runTest('AUDIT-04: Analytics Overview removes hardcoded +24.6%, 100% Retained, 18500, and 98% fallbacks and handles zero denominators safely', () => {
    const analyticsSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/admin/AdminAnalyticsOverview.tsx'),
      'utf8'
    );
    assert.strictEqual(analyticsSource.includes('+24.6%'), false);
    assert.strictEqual(analyticsSource.includes('100% Retained'), false);
    assert.strictEqual(analyticsSource.includes('18500'), false);
    assert.strictEqual(analyticsSource.includes('Operational (All Clusters Active)'), false);

    const zeroMetrics = computeAnalyticsMetrics({ jobs: [], users: [], subscribers: [], feeLogs: [], auditLogs: [], ads: [] });
    assert.strictEqual(zeroMetrics.scraperSuccessRate, null);
    assert.strictEqual(zeroMetrics.totalGrossRevenuePkr, 0);
    assert.strictEqual(zeroMetrics.totalAdsPkr, 0);
    assert.deepStrictEqual(zeroMetrics.regionBreakdown, []);

    const zeroHtml = renderToStaticMarkup(
      React.createElement(AdminAnalyticsOverview, { jobs: [], pendingJobs: [], users: [], subscribers: [], feeLogs: [], auditLogs: [], batchRuns: [], ads: [] })
    );
    assert.ok(zeroHtml.includes('N/A'));
    assert.ok(zeroHtml.includes('Not Verified (No Telemetry Feed)'));
    assert.ok(zeroHtml.includes('No live job listings loaded yet.'));

    const adMetrics = computeAnalyticsMetrics({
      jobs: [{ id: 'j1', region: 'Pakistan' } as any],
      auditLogs: [
        { id: 'a1', status: 'Approved Live' } as any,
        { id: 'a2', status: 'Pending Review' } as any
      ],
      ads: [{ id: 'ad1', status: 'active', paymentStatus: 'Paid', campaignCostPkr: 5000 } as unknown as Advertisement]
    });
    assert.strictEqual(adMetrics.scraperSuccessRate, 50);
    assert.strictEqual(adMetrics.totalAdsPkr, 5000);
    assert.strictEqual(adMetrics.activeAdsCount, 1);
    assert.deepStrictEqual(adMetrics.regionBreakdown, [{ regionName: 'Pakistan', count: 1, pct: 100 }]);
  });

  await runTest('AUDIT-05: Bulk Notification Draft Builder starts with empty drafts [], safely parses storage, and avoids fake delivery claims', () => {
    const bulkSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/admin/AdminBulkNotificationTool.tsx'),
      'utf8'
    );
    assert.strictEqual(bulkSource.includes('INITIAL_BROADCAST_HISTORY'), false);
    assert.strictEqual(bulkSource.includes('Open Rate'), false);
    assert.strictEqual(bulkSource.includes('Click Rate'), false);
    assert.strictEqual(bulkSource.includes('alert('), false);

    assert.deepStrictEqual(parseStoredNotificationDrafts(null), []);
    assert.deepStrictEqual(parseStoredNotificationDrafts('{invalid json'), []);
    assert.deepStrictEqual(parseStoredNotificationDrafts('{"not":"array"}'), []);
    assert.strictEqual(parseStoredNotificationDrafts('[{"id":"d1"}]').length, 0);
    const validDraftJson = JSON.stringify([
      {
        id: 'd1',
        timestamp: '2026-11-17 09:00',
        title: 'Valid Local Draft',
        category: 'Career Alert',
        priority: 'high',
        channel: 'In-App',
        targetAudience: 'All Registered Users & Subscribers',
        messageBody: 'Sample draft message body',
        recipientsCount: 12,
        openRatePercent: 0,
        clickRatePercent: 0,
        status: 'Draft'
      }
    ]);
    assert.strictEqual(parseStoredNotificationDrafts(validDraftJson).length, 1);

    const html = renderToStaticMarkup(React.createElement(AdminBulkNotificationTool, { users: [], subscribers: [] }));
    assert.ok(html.includes('Bulk Notification Draft Builder'));
    assert.ok(html.includes('Delivery Not Connected Here'));
    assert.ok(html.includes('No local notification drafts saved yet'));
    assert.strictEqual(html.includes('Open Rate'), false);
  });

  await runTest('AUDIT-06: Payment Methods Manager distinguishes server-persisted payment settings from browser-local duration presets', () => {
    const paySource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/admin/AdminPaymentMethodsManager.tsx'),
      'utf8'
    );
    assert.ok(paySource.includes('api.paymentSettings.get()'));
    assert.ok(paySource.includes('api.paymentSettings.update(payload)'));
    assert.ok(paySource.includes('Local Duration Presets'));
    assert.ok(paySource.includes('Browser Local Storage Only'));
    const html = renderToStaticMarkup(React.createElement(AdminPaymentMethodsManager));
    assert.ok(html.includes('/api/payment-settings'));
    assert.ok(html.includes('Save &amp; Publish Payment Settings'));
  });

  await runTest('AUDIT-07: All 31 canonical AdminDashboard tabs have explicit permission guards in source', () => {
    const dashSource = fs.readFileSync(path.resolve(process.cwd(), 'src/components/AdminDashboard.tsx'), 'utf8');
    const canonicalIds = ADMIN_NAVIGATION_MODULES.map((m) => m.id);
    assert.strictEqual(canonicalIds.length, 31);
    for (const id of canonicalIds) {
      if (id === 'scraper') {
        assert.ok(
          dashSource.includes("(adminTab === 'scraper' || adminTab === 'url-scraper' || adminTab === 'scraped-history') && canAccessAdminTab(adminTab)"),
          'Expected guarded scraper/alias branch'
        );
      } else if (id === 'analytics') {
        assert.ok(
          dashSource.includes("(adminTab === 'analytics' || adminTab === 'stats') && canAccessAdminTab('analytics')"),
          'Expected guarded analytics/stats branch'
        );
      } else if (id === 'settings') {
        const idx = dashSource.indexOf("{adminTab === 'settings' && (");
        assert.ok(idx !== -1 && dashSource.slice(idx, idx + 80).includes("canAccessAdminTab('settings')"), 'Expected guarded settings branch');
      } else {
        assert.ok(
          dashSource.includes(`adminTab === '${id}' && canAccessAdminTab('${id}')`),
          `Expected permission guard on render branch for canonical tab "${id}"`
        );
      }
    }
  });

  // --- STEP 7 (AUDIT-08 TO AUDIT-22): 15 COMPREHENSIVE REGRESSION TESTS ---
  await runTest('AUDIT-08 [Fee Logs Filtering]: Paid fee logs are summed while Pending, Failed, and Refunded logs are excluded', () => {
    const feeLogs: JobPostingFeeLog[] = [
      {
        id: 'log-1',
        dateTime: '2026-11-16 10:00',
        userId: 'u-1',
        userName: 'Employer A',
        userEmail: 'a@co.pk',
        jobTitle: 'Backend Engineer',
        amount: 2000,
        currency: 'PKR',
        paymentMethod: 'Easypaisa',
        status: 'Paid'
      },
      {
        id: 'log-2',
        dateTime: '2026-11-16 11:00',
        userId: 'u-2',
        userName: 'Employer B',
        userEmail: 'b@co.pk',
        jobTitle: 'Pending Role',
        amount: 3500,
        currency: 'PKR',
        paymentMethod: 'JazzCash',
        status: 'Pending'
      },
      {
        id: 'log-3',
        dateTime: '2026-11-16 12:00',
        userId: 'u-3',
        userName: 'Employer C',
        userEmail: 'c@co.pk',
        jobTitle: 'Failed Role',
        amount: 4000,
        currency: 'PKR',
        paymentMethod: 'Bank Transfer',
        status: 'Failed'
      },
      {
        id: 'log-4',
        dateTime: '2026-11-16 13:00',
        userId: 'u-4',
        userName: 'Employer D',
        userEmail: 'd@co.pk',
        jobTitle: 'Refunded Role',
        amount: 5000,
        currency: 'PKR',
        paymentMethod: 'Wallet',
        status: 'Refunded'
      }
    ];

    const metrics = computeAnalyticsMetrics({ feeLogs });
    assert.strictEqual(metrics.paidFeeLogsCount, 1);
    assert.strictEqual(metrics.totalFeeLogsPkr, 2000);
    assert.strictEqual(metrics.totalGrossRevenuePkr, 2000);
  });

  await runTest('AUDIT-09 [Authoritative Transaction Revenue]: Counts Success revenue transactions and excludes Wallet Deposit, Refund, and refunded/compensated items', () => {
    const txs: PaymentTransaction[] = [
      {
        id: 'tx-sub-1',
        dateTime: '2026-11-16 09:00',
        amount: 1500,
        currency: 'PKR',
        type: 'Subscription',
        status: 'Success',
        paymentMethod: 'JazzCash'
      },
      {
        id: 'tx-job-1',
        dateTime: '2026-11-16 09:30',
        amount: 2500,
        currency: 'PKR',
        type: 'Job Posting Fee',
        status: 'Success',
        paymentMethod: 'Easypaisa'
      },
      {
        id: 'tx-ad-1',
        dateTime: '2026-11-16 09:45',
        amount: 6000,
        currency: 'PKR',
        type: 'Advertisement',
        status: 'Success',
        paymentMethod: 'Bank Transfer'
      },
      {
        id: 'tx-dep-1',
        dateTime: '2026-11-16 10:00',
        amount: 25000,
        currency: 'PKR',
        type: 'Wallet Deposit',
        status: 'Success',
        paymentMethod: 'Bank Transfer'
      },
      {
        id: 'tx-ref-1',
        dateTime: '2026-11-16 10:15',
        amount: 3000,
        currency: 'PKR',
        type: 'Refund',
        status: 'Success',
        paymentMethod: 'Wallet'
      },
      {
        id: 'tx-pending-1',
        dateTime: '2026-11-16 10:30',
        amount: 9000,
        currency: 'PKR',
        type: 'Subscription',
        status: 'Pending',
        paymentMethod: 'Easypaisa'
      },
      {
        id: 'tx-comp-1',
        dateTime: '2026-11-16 10:45',
        amount: 4500,
        currency: 'PKR',
        type: 'Ad Campaign Fee',
        status: 'Success',
        paymentMethod: 'Wallet',
        compensatedAt: '2026-11-16T11:00:00.000Z'
      } as any
    ];

    const metrics = computeAnalyticsMetrics({ paymentTransactions: txs });
    assert.strictEqual(metrics.countedTransactionsCount, 3);
    assert.strictEqual(metrics.totalTransactionsRevenuePkr, 10000);
    assert.strictEqual(metrics.totalGrossRevenuePkr, 10000);
  });

  await runTest('AUDIT-10 [Double-Count Prevention]: Linked Job Posting Fees, Subscriptions, and Ad Campaigns are NOT double-counted in totalGrossRevenuePkr', () => {
    const paymentTransactions: PaymentTransaction[] = [
      {
        id: 'tx-job-linked',
        transactionId: 'TID-JOB-100',
        dateTime: '2026-11-16 09:00',
        amount: 2000,
        currency: 'PKR',
        type: 'Job Posting Fee',
        status: 'Success',
        paymentMethod: 'Wallet',
        userId: 'u-emp-1',
        jobTitleRef: 'Cloud Architect'
      },
      {
        id: 'tx-ad-linked',
        transactionId: 'TID-AD-200',
        dateTime: '2026-11-16 10:00',
        amount: 6000,
        currency: 'PKR',
        type: 'Ad Campaign Fee',
        status: 'Success',
        paymentMethod: 'Wallet',
        adIdRef: 'ad-linked-1'
      },
      {
        id: 'tx-sub-linked',
        transactionId: 'TID-SUB-300',
        dateTime: '2026-11-16 11:00',
        amount: 1200,
        currency: 'PKR',
        type: 'Subscription',
        status: 'Success',
        paymentMethod: 'JazzCash',
        userId: 'u-seek-1',
        userEmail: 'seeker@pk.test'
      }
    ];

    const feeLogs: JobPostingFeeLog[] = [
      {
        id: 'log-tx-job-linked',
        dateTime: '2026-11-16 09:00',
        userId: 'u-emp-1',
        userName: 'Employer One',
        userEmail: 'emp1@co.pk',
        jobTitle: 'Cloud Architect',
        amount: 2000,
        currency: 'PKR',
        paymentMethod: 'Wallet',
        status: 'Paid'
      },
      {
        id: 'log-standalone',
        dateTime: '2026-11-16 12:00',
        userId: 'u-emp-2',
        userName: 'Employer Two',
        userEmail: 'emp2@co.pk',
        jobTitle: 'DevOps Lead',
        amount: 1500,
        currency: 'PKR',
        paymentMethod: 'Easypaisa',
        status: 'Paid'
      }
    ];

    const subscribers: Subscriber[] = [
      {
        id: 'sub-linked',
        name: 'Seeker Linked',
        email: 'seeker@pk.test',
        phone: '03001112223',
        plan: 'Monthly',
        paymentMethod: 'JazzCash',
        paymentTransactionId: 'tx-sub-linked',
        amountPaid: 1200,
        currency: 'PKR',
        status: 'Active',
        subscribedAt: '2026-11-16',
        whatsappEnabled: true
      }
    ];

    const ads = [
      {
        id: 'ad-linked-1',
        status: 'active',
        paymentStatus: 'Paid',
        campaignCostPkr: 6000,
        walletTxId: 'tx-ad-linked',
        createdAt: '2026-11-16T10:00:00.000Z'
      }
    ] as unknown as Advertisement[];

    const metrics = computeAnalyticsMetrics({
      paymentTransactions,
      feeLogs,
      subscribers,
      ads
    });

    // Individual breakdown totals reflect their full stream:
    assert.strictEqual(metrics.totalTransactionsRevenuePkr, 9200);
    assert.strictEqual(metrics.totalFeeLogsPkr, 3500);
    assert.strictEqual(metrics.totalSubscribersPkr, 1200);
    assert.strictEqual(metrics.totalAdsPkr, 6000);
    // Deduplicated gross = 9200 (all linked txs) + 1500 (unlinked standalone fee log) = 10700
    assert.strictEqual(metrics.totalGrossRevenuePkr, 10700);
  });

  await runTest('AUDIT-11 [Ads Financial Accuracy]: Rejects synthetic totalCostPkr, excludes unpaid/refunded/exempt, and returns null/N/A when paid ad lacks verified cost or status', () => {
    // 1. Synthetic totalCostPkr with missing paymentStatus is NOT trusted and yields null (N/A)
    const syntheticOnly = computeAnalyticsMetrics({
      ads: [{ id: 'ad-synth', status: 'active', totalCostPkr: 9999 } as unknown as Advertisement]
    });
    assert.strictEqual(syntheticOnly.totalAdsPkr, null);

    // 2. Paid ad with missing cost fields and no matching tx yields null (N/A)
    const missingCostPaidAd = computeAnalyticsMetrics({
      ads: [{ id: 'ad-nocost', status: 'active', paymentStatus: 'Paid' } as unknown as Advertisement]
    });
    assert.strictEqual(missingCostPaidAd.totalAdsPkr, null);

    // 3. Real Advertisement fields (Paid + Pending Wallet Deduction + Refunded + Exempt)
    const mixedAds = computeAnalyticsMetrics({
      ads: [
        { id: 'ad-paid-cost', status: 'active', paymentStatus: 'Paid', campaignCostPkr: 6000 } as unknown as Advertisement,
        { id: 'ad-paid-budget', status: 'active', paymentStatus: 'Paid', budget: 4000 } as unknown as Advertisement,
        { id: 'ad-pending', status: 'pending_approval', paymentStatus: 'Pending Wallet Deduction', campaignCostPkr: 8000 } as unknown as Advertisement,
        { id: 'ad-refunded', status: 'rejected', paymentStatus: 'Refunded', campaignCostPkr: 7000 } as unknown as Advertisement,
        { id: 'ad-exempt', status: 'active', paymentStatus: 'Exempt', campaignCostPkr: 5000 } as unknown as Advertisement
      ]
    });
    assert.strictEqual(mixedAds.paidAdsCount, 2);
    assert.strictEqual(mixedAds.totalAdsPkr, 10000);
    assert.strictEqual(mixedAds.totalGrossRevenuePkr, 10000);

    // 4. Paid ad referencing authoritative transaction via walletTxId recovers verified amount
    const linkedCostAd = computeAnalyticsMetrics({
      paymentTransactions: [
        {
          id: 'tx-wallet-ad',
          dateTime: '2026-11-16 08:00',
          amount: 11000,
          currency: 'PKR',
          type: 'Ad Campaign Fee',
          status: 'Success',
          paymentMethod: 'Wallet'
        }
      ],
      ads: [
        { id: 'ad-wallet-ref', status: 'active', paymentStatus: 'Paid', walletTxId: 'tx-wallet-ad' } as unknown as Advertisement
      ]
    });
    assert.strictEqual(linkedCostAd.totalAdsPkr, 11000);
    assert.strictEqual(linkedCostAd.totalGrossRevenuePkr, 11000);
  });

  await runTest('AUDIT-12 [Analytics Time Ranges]: Filters metrics accurately across Today, 7 Days, 30 Days, and All Time using deterministic referenceDate', () => {
    const refNow = '2026-11-17T12:00:00.000Z';
    const feeLogs: JobPostingFeeLog[] = [
      { id: 'f-today', dateTime: '2026-11-17 09:00', userId: 'u1', userName: 'U1', userEmail: 'u1@t.pk', jobTitle: 'Today Job', amount: 1000, currency: 'PKR', paymentMethod: 'Wallet', status: 'Paid' },
      { id: 'f-5d', dateTime: '2026-11-12 09:00', userId: 'u2', userName: 'U2', userEmail: 'u2@t.pk', jobTitle: '5d Job', amount: 2000, currency: 'PKR', paymentMethod: 'Wallet', status: 'Paid' },
      { id: 'f-20d', dateTime: '2026-10-28 09:00', userId: 'u3', userName: 'U3', userEmail: 'u3@t.pk', jobTitle: '20d Job', amount: 3000, currency: 'PKR', paymentMethod: 'Wallet', status: 'Paid' },
      { id: 'f-60d', dateTime: '2026-09-18 09:00', userId: 'u4', userName: 'U4', userEmail: 'u4@t.pk', jobTitle: '60d Job', amount: 4000, currency: 'PKR', paymentMethod: 'Wallet', status: 'Paid' }
    ];

    const todayMetrics = computeAnalyticsMetrics({ feeLogs, timeRange: 'today', referenceDate: refNow });
    const sevenDayMetrics = computeAnalyticsMetrics({ feeLogs, timeRange: '7days', referenceDate: refNow });
    const thirtyDayMetrics = computeAnalyticsMetrics({ feeLogs, timeRange: '30days', referenceDate: refNow });
    const allTimeMetrics = computeAnalyticsMetrics({ feeLogs, timeRange: 'all', referenceDate: refNow });

    assert.strictEqual(todayMetrics.totalFeeLogsPkr, 1000);
    assert.strictEqual(sevenDayMetrics.totalFeeLogsPkr, 3000);
    assert.strictEqual(thirtyDayMetrics.totalFeeLogsPkr, 6000);
    assert.strictEqual(allTimeMetrics.totalFeeLogsPkr, 10000);
    assert.strictEqual(parseAnalyticsTimestamp('2026-11-17 09:00') !== null, true);
    assert.strictEqual(isTimestampInRange(null, '7days' as AnalyticsTimeRange, refNow), false);
  });

  await runTest('AUDIT-13 [Analytics Missing Dates]: Never assumes undated records match bounded windows and preserves All Time', () => {
    const refNow = '2026-11-17T12:00:00.000Z';
    const datelessAds = [
      { id: 'ad-no-date', status: 'active', paymentStatus: 'Paid', campaignCostPkr: 5000 }
    ] as unknown as Advertisement[];
    const datelessFeeLogs = [
      { id: 'f-no-date', userId: 'u1', userName: 'U1', userEmail: 'u1@t.pk', jobTitle: 'Undated', amount: 2500, currency: 'PKR', paymentMethod: 'Wallet', status: 'Paid' }
    ] as unknown as JobPostingFeeLog[];

    const ranges: AnalyticsTimeRange[] = ['today', '7days', '30days'];
    for (const r of ranges) {
      const bounded = computeAnalyticsMetrics({ ads: datelessAds, feeLogs: datelessFeeLogs, timeRange: r, referenceDate: refNow });
      assert.strictEqual(bounded.totalAdsPkr, null, `Undated ads in ${r} must return null (N/A)`);
      assert.strictEqual(bounded.totalFeeLogsPkr, null, `Undated fee logs in ${r} must return null (N/A)`);
      assert.strictEqual(bounded.totalGrossRevenuePkr, null, `All-undated financials in ${r} must return null (N/A)`);
      assert.ok(bounded.missingDateRecordsCount >= 2);
    }

    const allTime = computeAnalyticsMetrics({ ads: datelessAds, feeLogs: datelessFeeLogs, timeRange: 'all', referenceDate: refNow });
    assert.strictEqual(allTime.totalAdsPkr, 5000);
    assert.strictEqual(allTime.totalFeeLogsPkr, 2500);
    assert.strictEqual(allTime.totalGrossRevenuePkr, 7500);
  });

  await runTest('AUDIT-14 [Analytics Currency Safety]: Removes 0.0036 fallback and INITIAL_CURRENCY_CONFIG default, formats configured rates cleanly, and renders N/A when unconfigured/invalid', () => {
    const analyticsSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/admin/AdminAnalyticsOverview.tsx'),
      'utf8'
    );
    assert.strictEqual(analyticsSource.includes('0.0036'), false, 'Hardcoded 0.0036 USD rate must be removed from runtime logic');
    assert.strictEqual(analyticsSource.includes('INITIAL_CURRENCY_CONFIG'), false, 'Mock INITIAL_CURRENCY_CONFIG must not be imported/used as fallback');

    // Unconfigured or zero/negative/NaN currency rates yield N/A cleanly (PKR still works)
    assert.strictEqual(convertRecordAmountToPkr(100, 'USD', undefined), null);
    assert.strictEqual(convertPkrAmount(10000, 'USD', undefined), null);
    assert.strictEqual(formatAnalyticsCurrency(10000, 'USD', undefined), 'N/A');
    assert.strictEqual(formatAnalyticsCurrency(10000, 'PKR', undefined), 'PKR 10,000');

    const badConfig: CurrencyExchangeConfig = {
      baseCurrency: 'PKR',
      supportedCurrencies: ['PKR', 'USD', 'AED', 'SAR'],
      internationalPricingTiers: INITIAL_CURRENCY_CONFIG.internationalPricingTiers,
      autoSyncEnabled: false,
      lastSyncedAt: '2026-11-17',
      rates: { PKR: 1, USD: 0, AED: -1, SAR: Number.NaN, EUR: 0.003, GBP: 0.0025, CAD: 0, AUD: 0 }
    };
    assert.strictEqual(formatAnalyticsCurrency(10000, 'USD', badConfig), 'N/A');
    assert.strictEqual(formatAnalyticsCurrency(10000, 'AED', badConfig), 'N/A');
    assert.strictEqual(formatAnalyticsCurrency(10000, 'SAR', badConfig), 'N/A');

    // Valid configured rate converts cleanly in both directions
    const validConfig: CurrencyExchangeConfig = {
      baseCurrency: 'PKR',
      supportedCurrencies: ['PKR', 'USD', 'AED', 'SAR'],
      internationalPricingTiers: INITIAL_CURRENCY_CONFIG.internationalPricingTiers,
      autoSyncEnabled: true,
      lastSyncedAt: '2026-11-17',
      rates: { PKR: 1, USD: 0.004, AED: 0.015, SAR: 0.015, EUR: 0.0035, GBP: 0.003, CAD: 0.0055, AUD: 0.006 }
    };
    assert.strictEqual(convertRecordAmountToPkr(40, 'USD', validConfig), 10000);
    assert.strictEqual(convertPkrAmount(10000, 'USD', validConfig), 40);
    assert.strictEqual(formatAnalyticsCurrency(10000, 'USD', validConfig), 'USD 40');
    assert.strictEqual(formatAnalyticsCurrency(10000, 'AED', validConfig), 'AED 150');
  });

  await runTest('AUDIT-15 [Analytics paymentTransactions Wiring]: AdminDashboard wires paymentTransactions={currentTransactions} to AdminAnalyticsOverview', () => {
    const dashSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/AdminDashboard.tsx'),
      'utf8'
    );
    const analyticsBlockStart = dashSource.indexOf('<AdminAnalyticsOverview');
    assert.ok(analyticsBlockStart !== -1, 'Expected <AdminAnalyticsOverview in AdminDashboard.tsx');
    const analyticsBlockEnd = dashSource.indexOf('/>', analyticsBlockStart);
    const analyticsBlock = dashSource.slice(analyticsBlockStart, analyticsBlockEnd);
    assert.ok(
      analyticsBlock.includes('paymentTransactions={currentTransactions}'),
      'AdminAnalyticsOverview must receive authoritative paymentTransactions={currentTransactions} prop'
    );
  });

  await runTest('AUDIT-16 [Bulk Notification Corrupt-Draft Rendering Safety]: SSR with valid + malformed drafts renders safely without crash and ignores invalid items', () => {
    const prevStorage = (globalThis as any).localStorage;
    const mixedRaw = JSON.stringify([
      {
        id: 'valid-1',
        timestamp: '2026-11-17 08:30',
        title: 'Legit Verified Broadcast',
        category: 'Career Alert',
        priority: 'invalid-priority',
        channel: 'Email',
        targetAudience: 'All Registered Users & Subscribers',
        messageBody: 'Valid notification body text.',
        recipientsCount: 42,
        status: 'Draft'
      },
      { id: 'bad-missing-fields' },
      { id: 'bad-channel', timestamp: '2026-11-17', title: 'Bad', category: 'Alert', channel: 'CarrierPigeon', targetAudience: 'All', messageBody: 'Body', recipientsCount: 5, status: 'Draft' },
      'raw-string-entry'
    ]);

    (globalThis as any).localStorage = {
      getItem: () => mixedRaw,
      setItem: () => {
        throw new Error('Should not overwrite storage on mount');
      }
    };

    try {
      const html = renderToStaticMarkup(React.createElement(AdminBulkNotificationTool, { users: [], subscribers: [] }));
      assert.ok(html.includes('Legit Verified Broadcast'));
      assert.ok(html.includes('1 Local Drafts'));
      assert.ok(html.includes('malformed local draft entry(ies)'));
      assert.strictEqual(html.includes('bad-missing-fields'), false);
      assert.strictEqual(html.includes('CarrierPigeon'), false);
    } finally {
      (globalThis as any).localStorage = prevStorage;
    }
  });

  await runTest('AUDIT-17 [Bulk Notification Storage Recovery]: Corrupt JSON or malformed drafts do NOT overwrite existing localStorage data on mount', () => {
    const corruptRaw = '{corrupted_json_payload!!!';
    const inspection = inspectStoredNotificationDrafts(corruptRaw);
    assert.deepStrictEqual(inspection.drafts, []);
    assert.strictEqual(inspection.hasCorruptJson, true);
    assert.ok(inspection.warningMessage && inspection.warningMessage.includes('preserved'));

    // Real component mount against mock storage must NEVER invoke setItem
    const prevStorage = (globalThis as any).localStorage;
    let storedValue = corruptRaw;
    let setItemCalls = 0;

    (globalThis as any).localStorage = {
      getItem: (key: string) => (key === NOTIFICATION_DRAFTS_STORAGE_KEY ? storedValue : null),
      setItem: (key: string, val: string) => {
        setItemCalls++;
        if (key === NOTIFICATION_DRAFTS_STORAGE_KEY) storedValue = val;
      }
    };

    try {
      const html = renderToStaticMarkup(React.createElement(AdminBulkNotificationTool, { users: [], subscribers: [] }));
      assert.strictEqual(setItemCalls, 0, 'Mount must NEVER overwrite corrupt localStorage');
      assert.strictEqual(storedValue, corruptRaw, 'Original corrupt localStorage payload must remain intact');
      assert.ok(html.includes('preserved without overwriting'));
    } finally {
      (globalThis as any).localStorage = prevStorage;
    }
  });

  await runTest('AUDIT-18 [Bulk Notification Write Failures]: Failing localStorage.setItem on save or delete blocks false confirmation and preserves existing drafts', () => {
    const existingDraft: BulkNotificationBroadcast = {
      id: 'draft-existing',
      timestamp: '2026-11-17 09:00',
      title: 'Existing Draft',
      category: 'Career Alert',
      priority: 'normal',
      channel: 'In-App',
      targetAudience: 'All Registered Users & Subscribers',
      messageBody: 'Existing body',
      recipientsCount: 10,
      openRatePercent: 0,
      clickRatePercent: 0,
      status: 'Draft'
    };
    const newDraft: BulkNotificationBroadcast = {
      ...existingDraft,
      id: 'draft-new',
      title: 'New Unwritable Draft'
    };

    const failingStorage = {
      setItem: () => {
        throw new Error('QuotaExceededError: Storage full');
      }
    };

    const saveRes = saveNotificationDraftToStorage(failingStorage, [existingDraft], newDraft);
    assert.strictEqual(saveRes.ok, false);
    assert.ok(saveRes.error && saveRes.error.includes('QuotaExceededError'));
    assert.strictEqual(saveRes.drafts.length, 1);
    assert.strictEqual(saveRes.drafts[0].id, 'draft-existing');

    const delRes = deleteNotificationDraftFromStorage(failingStorage, [existingDraft], 'draft-existing');
    assert.strictEqual(delRes.ok, false);
    assert.ok(delRes.error && delRes.error.includes('QuotaExceededError'));
    assert.strictEqual(delRes.drafts.length, 1);
    assert.strictEqual(delRes.drafts[0].id, 'draft-existing');
  });

  await runTest('AUDIT-19 [Job Update Refresh Separation]: Confirmed server update + failed/throwing job refresh keeps success:true and attaches refreshWarning', async () => {
    const jobToEdit = {
      id: 'job-refresh-test',
      title: 'Staff Data Engineer',
      company: 'Indus Cloud',
      status: 'Approved'
    } as unknown as Job;

    // 1. Throwing reloadJobs()
    const throwReloadOutcome = await executeAuthoritativeJobUpdate({
      updatedJob: jobToEdit,
      updateJobApi: async (_id, j) => ({ success: true, job: j }),
      reloadJobs: async () => {
        throw new Error('GET /api/jobs timed out after save');
      }
    });
    assert.strictEqual(throwReloadOutcome.success, true);
    assert.strictEqual(throwReloadOutcome.job?.id, 'job-refresh-test');
    assert.ok(throwReloadOutcome.refreshWarning?.includes('timed out'));

    // 2. Non-throwing failed reloadJobs() response
    const failedReloadOutcome = await executeAuthoritativeJobUpdate({
      updatedJob: jobToEdit,
      updateJobApi: async (_id, j) => ({ success: true, job: j }),
      reloadJobs: async () => ({ success: false, message: 'Pending queue refresh returned 503' })
    });
    assert.strictEqual(failedReloadOutcome.success, true);
    assert.ok(failedReloadOutcome.refreshWarning?.includes('503'));

    // 3. Server mutation failure still returns success:false
    const failedSaveOutcome = await executeAuthoritativeJobUpdate({
      updatedJob: jobToEdit,
      updateJobApi: async () => ({ success: false, message: 'Validation failed on server' }),
      reloadJobs: async () => ({ success: true })
    });
    assert.strictEqual(failedSaveOutcome.success, false);
    assert.strictEqual(failedSaveOutcome.message, 'Validation failed on server');
  });

  await runTest('AUDIT-20 [Pending Job Enhancement Preservation]: applyRuleBasedEnhancement on a Pending job preserves id, status Pending, and factual empty salary', async () => {
    const pendingJob = {
      id: 'pending-job-77',
      title: 'Senior DevOps Engineer',
      company: 'Karachi Fintech',
      region: 'Pakistan',
      jobType: 'Remote',
      experienceLevel: 'Senior',
      salary: '',
      description: 'Manage Kubernetes and CI/CD pipelines across multi-region clusters.',
      tags: ['Kubernetes'],
      requirements: ['5+ years AWS'],
      status: 'Pending'
    } as unknown as Job;

    const report = evaluateRuleBasedJobQuality(pendingJob);
    let sentJob: Job | null = null;
    const outcome = await applyRuleBasedEnhancement({
      activeJob: pendingJob,
      activeReport: report,
      onUpdateJob: async (updated) => {
        sentJob = updated;
        return { success: true, job: updated };
      }
    });

    assert.strictEqual(outcome.ok, true);
    assert.ok(sentJob);
    assert.strictEqual((sentJob as any).id, 'pending-job-77');
    assert.strictEqual((sentJob as any).status, 'Pending');
    assert.strictEqual((sentJob as any).salary, '');
    assert.strictEqual(outcome.updatedJob?.status, 'Pending');
  });

  await runTest('AUDIT-21 [Audit Warning Surface]: Preserves ok:true while surfacing auditPersisted === false and auditWarning (and refreshWarning)', async () => {
    const job = {
      id: 'job-audit-warn-1',
      title: 'Principal Security Engineer',
      company: 'Lahore Cyber',
      region: 'Pakistan',
      jobType: 'On-site',
      experienceLevel: 'Senior',
      salary: 'PKR 450,000',
      description: 'Lead security architecture and compliance programs.',
      tags: ['AppSec', 'IAM'],
      requirements: ['CISSP preferred'],
      status: 'Pending'
    } as unknown as Job;

    const report = evaluateRuleBasedJobQuality(job);

    // 1. End-to-end through executeAuthoritativeJobUpdate -> applyRuleBasedEnhancement
    const outcome = await applyRuleBasedEnhancement({
      activeJob: job,
      activeReport: report,
      onUpdateJob: async (updated) =>
        executeAuthoritativeJobUpdate({
          updatedJob: updated,
          updateJobApi: async (_id, j) => ({
            success: true,
            job: j,
            auditPersisted: false,
            auditWarning: 'Job saved, but audit log write failed on MongoDB.'
          }),
          reloadJobs: async () => ({ success: false, message: 'Refresh timed out cleanly.' })
        })
    });

    assert.strictEqual(outcome.ok, true);
    assert.strictEqual(outcome.auditPersisted, false);
    assert.ok(outcome.auditWarning?.includes('audit log write failed'));
    assert.ok(outcome.refreshWarning?.includes('Refresh timed out'));
  });

  await runTest('AUDIT-22 [Duration Preset Storage Failure]: Failing localStorage.setItem surfaces visible error, suppresses success state, preserves edits, and keeps server payment settings untouched', () => {
    const failingStorage = {
      setItem: () => {
        throw new Error('QuotaExceededError');
      }
    };

    const customConfig = {
      ...DEFAULT_ADMIN_RECEIVING_PAYMENT_CONFIG,
      activeDurationOptions: [
        ...DEFAULT_ADMIN_RECEIVING_PAYMENT_CONFIG.activeDurationOptions,
        {
          id: 'custom-10d',
          label: '10 Days Sprint',
          days: 10,
          enabled: true,
          pricePkr: 7500,
          isApprovedForDisplay: true,
          badge: 'Custom'
        }
      ]
    };

    const writeRes = saveDurationPresetsToStorage(failingStorage, customConfig);
    assert.strictEqual(writeRes.ok, false);
    assert.ok(writeRes.error && writeRes.error.includes('QuotaExceededError'));
    assert.ok(writeRes.error.includes('unsaved edits remain on screen'));

    // Also verify AdminPaymentMethodsManager.tsx wires error handling cleanly without touching server paymentSettings update
    const paySource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/admin/AdminPaymentMethodsManager.tsx'),
      'utf8'
    );
    assert.ok(paySource.includes(CAMPAIGN_DURATION_PRESETS_KEY));
    assert.ok(paySource.includes('durationSaveError'));
    assert.ok(paySource.includes('role="alert"'));
    assert.ok(paySource.includes('saveDurationPresetsToStorage'));
    assert.ok(paySource.includes('api.paymentSettings.update(payload)'));
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
