import assert from 'assert';
import fs from 'fs';
import path from 'path';
import dns from 'dns';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PDFParse } from 'pdf-parse';

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
  formatAnalyticsCurrency,
  getPktDayBoundsMs
} from '../../src/components/admin/AdminAnalyticsOverview';
import {
  deriveSourceClassification,
  isHistoricallyProven,
  getConfiguredCapabilities,
  getProvenCapabilities,
  hasIncompletePaginationDiagnostic,
  isWorkingSource,
  isPartialSource,
  isUnavailableSource
} from '../../src/services/scraperClassification';
import {
  detectMediaFormat,
  extractJobsFromImageWithOcr,
  extractJobsFromPdfText,
  parsePdfFromUrl,
  sanitizeUrlForLog,
  sanitizeSecretString,
  classifyExtractedJobEvidence
} from '../services/pdfParserEngine';
import {
  findCandidateRecruitmentImages,
  isSafeMediaOrigin,
  mapLinkedImageOcrJobs,
  mapDirectImageOcrJobs,
  extractNextPageUrl,
  deduplicateJobs,
  scrapeGreenhouseApi,
  scrapeLeverApi,
  scrapeRestJobApis,
  scrapeTargetPortal,
  MAX_PORTAL_HTML_BYTES,
  MAX_ATS_JSON_BYTES,
  MaxPayloadExceededError,
  readBoundedResponseText,
  readBoundedResponseJson
} from '../../src/services/scraperService';
import {
  canonicalizePaginationUrl,
  validateDiscoveredNextPageUrl,
  crawlPortalPages,
  evaluateCheckpointEligibility,
  buildSourceCompletionStatsUpdate,
  executeScraperWithWizard,
  getActiveRunStatus,
  pauseActiveRun,
  resumeActiveRun,
  stopActiveRun,
  resetActiveRun,
  isScraperExecutionActive,
  isScraperRunConflictError,
  SCRAPER_RUN_ALREADY_ACTIVE_CODE,
  resolveNonCollidingCandidateId
} from '../services/scraperEngine';
import {
  detectJobDuplicate,
  DuplicateIndex,
  normalizeExactJobUrl,
  isGenericApplicationPortalUrl
} from '../services/duplicateEngine';
import {
  JobRepository,
  JobApprovalConflictError,
  ScraperPersistenceCollisionError,
  MAX_SCRAPER_INSERT_RETRIES,
  isMongoDuplicateKeyError,
  isSameLogicalJobRecord
} from '../db/repositories/JobRepository';
import { Database } from '../db/database';
import { scraperRouter, handleSchedulerTickRequest, mapScrapedResultToRouteJob } from '../routes/scraperRoutes';
import { featureFlags } from '../config/featureFlags';
import {
  deriveRunStatus,
  buildScraperRunFeedback,
  applyResetActiveRunResult,
  computeToggledSourceStatus,
  computeToggledAutoApprove,
  computeDeletedSourceList,
  computeAddedSourceList,
  computeBulkStatusSources,
  computeBulkAutoApproveSources,
  saveAndApplySourceConfigUpdate
} from '../../src/components/admin/AutomatedScraperHub';
import {
  ScraperRepository,
  getDefaultSchedulerSettings
} from '../db/repositories/ScraperRepository';
import {
  initScraperScheduler,
  runSchedulerTick,
  stopScraperScheduler,
  isValidSchedulerScope,
  setGlobalSchedulerState
} from '../services/scraperScheduler';
import {
  MAX_DETAIL_HTML_BYTES,
  isEligibleDetailUrl,
  isPermittedDetailOrigin,
  readBoundedHtmlResponse,
  enrichJobFromDetailPage,
  enrichScrapedJobsBatch
} from '../services/detailPageEnricher';
import {
  validateSafeScrapeUrl,
  isPrivateOrBlockedIp,
  resolveAndValidateDns,
  safeFetchWithRetry,
  scraperTlsDispatcher
} from '../utils/ssrfProtection';
import { Agent } from 'undici';
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
  ConsolidatedPdfGazette,
  DEFAULT_JOB_POSTING_PRICING_CONFIG,
  Job,
  JobPostingFeeLog,
  PaymentTransaction,
  ScrapedJobAuditEntry,
  ScraperBatchRun,
  Subscriber
} from '../../src/types/job';
import {
  executeAutoScrapeRunCoordinator,
  executeScrapeAllPortalsCoordinator,
  executeManualIngestCoordinator,
  executeParseUrlExtractionCoordinator,
  executeOneClickParseUrlCoordinator
} from '../../src/components/PdfConsolidatedScraperModal';
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

  // --- PHASE8.1-D (AUDIT-23 TO AUDIT-32): 10 ANALYTICS FINANCIAL INTEGRITY REGRESSION TESTS ---
  await runTest('AUDIT-23 [PKT Timezone & Midnight Boundary]: Today range uses Asia/Karachi (UTC+5) day boundaries and parses PKT-suffixed timestamps accurately', () => {
    // 2026-11-17T21:00:00Z is 2026-11-18 02:00:00 PKT (next calendar day in Pakistan!)
    const refAfterUtcMidnightPkt = '2026-11-17T21:00:00.000Z';
    const bounds = getPktDayBoundsMs(Date.parse(refAfterUtcMidnightPkt));
    assert.strictEqual(bounds.pktDateKey, '2026-11-18');

    // 2026-11-17T18:59:59.999Z = 2026-11-17 23:59:59.999 PKT -> yesterday in PKT (excluded)
    assert.strictEqual(
      isTimestampInRange(parseAnalyticsTimestamp('2026-11-17T18:59:59.999Z'), 'today', refAfterUtcMidnightPkt),
      false
    );
    // 2026-11-17T19:00:00.000Z = 2026-11-18 00:00:00.000 PKT -> exact start of PKT Today (included)
    assert.strictEqual(
      isTimestampInRange(parseAnalyticsTimestamp('2026-11-17T19:00:00.000Z'), 'today', refAfterUtcMidnightPkt),
      true
    );
    // Stored PKT string format ("YYYY-MM-DD HH:MM PKT")
    assert.strictEqual(
      isTimestampInRange(parseAnalyticsTimestamp('2026-11-18 01:30 PKT'), 'today', refAfterUtcMidnightPkt),
      true
    );
    assert.strictEqual(
      isTimestampInRange(parseAnalyticsTimestamp('2026-11-17 23:45 PKT'), 'today', refAfterUtcMidnightPkt),
      false
    );

    const txs: PaymentTransaction[] = [
      {
        id: 'tx-pkt-today-1',
        dateTime: '2026-11-17T19:30:00.000Z', // Nov 18 00:30 PKT (Today in PKT)
        amount: 2000,
        currency: 'PKR',
        type: 'Subscription',
        status: 'Success',
        paymentMethod: 'JazzCash'
      },
      {
        id: 'tx-pkt-today-2',
        dateTime: '2026-11-18 11:45 PKT', // Nov 18 11:45 PKT (Today in PKT)
        amount: 3000,
        currency: 'PKR',
        type: 'Job Posting Fee',
        status: 'Success',
        paymentMethod: 'Easypaisa'
      },
      {
        id: 'tx-pkt-yesterday',
        dateTime: '2026-11-17T18:30:00.000Z', // Nov 17 23:30 PKT (Yesterday in PKT)
        amount: 9000,
        currency: 'PKR',
        type: 'Subscription',
        status: 'Success',
        paymentMethod: 'Bank Transfer'
      }
    ];

    const todayMetrics = computeAnalyticsMetrics({
      paymentTransactions: txs,
      timeRange: 'today',
      referenceDate: refAfterUtcMidnightPkt
    });
    assert.strictEqual(todayMetrics.countedTransactionsCount, 2);
    assert.strictEqual(todayMetrics.totalTransactionsRevenuePkr, 5000);
    assert.strictEqual(todayMetrics.totalGrossRevenuePkr, 5000);

    // Pre-midnight PKT (Nov 17 23:30 PKT = Nov 17 18:30Z) includes Nov 16 19:30Z (Nov 17 00:30 PKT)
    const refBeforePktMidnight = '2026-11-17T18:30:00.000Z';
    assert.strictEqual(
      isTimestampInRange(parseAnalyticsTimestamp('2026-11-16T19:30:00.000Z'), 'today', refBeforePktMidnight),
      true
    );
    assert.strictEqual(
      isTimestampInRange(parseAnalyticsTimestamp('2026-11-17T19:00:00.000Z'), 'today', refBeforePktMidnight),
      false
    );
  });

  await runTest('AUDIT-24 [Mixed Dated + Undated Financial Records]: Undated eligible records force N/A in bounded ranges while undated ineligible records do not corrupt valid totals', () => {
    const refNow = '2026-11-17T12:00:00.000Z';

    // 1. Mixed dated + undated Paid fee logs must NOT return partial numeric total in bounded ranges
    const mixedFeeLogs: JobPostingFeeLog[] = [
      { id: 'f-dated', dateTime: '2026-11-17 09:00', userId: 'u1', userName: 'U1', userEmail: 'u1@t.pk', jobTitle: 'Role A', amount: 1500, currency: 'PKR', paymentMethod: 'Wallet', status: 'Paid' },
      { id: 'f-undated', dateTime: '', userId: 'u2', userName: 'U2', userEmail: 'u2@t.pk', jobTitle: 'Role B', amount: 2500, currency: 'PKR', paymentMethod: 'Wallet', status: 'Paid' }
    ];
    for (const r of ['today', '7days', '30days'] as AnalyticsTimeRange[]) {
      const m = computeAnalyticsMetrics({ feeLogs: mixedFeeLogs, timeRange: r, referenceDate: refNow });
      assert.strictEqual(m.totalFeeLogsPkr, null, `Mixed dated+undated Paid fee logs in ${r} must return null`);
      assert.strictEqual(m.totalGrossRevenuePkr, null, `Mixed dated+undated Gross Revenue in ${r} must return null`);
    }
    const allTimeMixed = computeAnalyticsMetrics({ feeLogs: mixedFeeLogs, timeRange: 'all', referenceDate: refNow });
    assert.strictEqual(allTimeMixed.totalFeeLogsPkr, 4000);
    assert.strictEqual(allTimeMixed.totalGrossRevenuePkr, 4000);

    // 2. Mixed dated + undated Success revenue tx, Active subscriber, Paid ad -> bounded N/A
    const mixedTx = computeAnalyticsMetrics({
      paymentTransactions: [
        { id: 't1', dateTime: '2026-11-17 08:00', amount: 1000, currency: 'PKR', type: 'Subscription', status: 'Success', paymentMethod: 'JazzCash' },
        { id: 't2', dateTime: '', amount: 2000, currency: 'PKR', type: 'Subscription', status: 'Success', paymentMethod: 'Easypaisa' }
      ],
      timeRange: '7days',
      referenceDate: refNow
    });
    assert.strictEqual(mixedTx.totalTransactionsRevenuePkr, null);
    assert.strictEqual(mixedTx.totalGrossRevenuePkr, null);

    // 3. Undated INELIGIBLE records (Pending, Failed, Refunded, Wallet Deposit, Refund, Exempt) do NOT corrupt valid dated totals
    const datedValidWithUndatedIneligible = computeAnalyticsMetrics({
      paymentTransactions: [
        { id: 'tx-ok', dateTime: '2026-11-17 09:00', amount: 3000, currency: 'PKR', type: 'Job Posting Fee', status: 'Success', paymentMethod: 'JazzCash' },
        { id: 'tx-dep-nodate', dateTime: '', amount: 50000, currency: 'PKR', type: 'Wallet Deposit', status: 'Success', paymentMethod: 'Bank Transfer' },
        { id: 'tx-ref-nodate', dateTime: '', amount: 2000, currency: 'PKR', type: 'Refund', status: 'Success', paymentMethod: 'Wallet' },
        { id: 'tx-pend-nodate', dateTime: '', amount: 4000, currency: 'PKR', type: 'Subscription', status: 'Pending', paymentMethod: 'Easypaisa' }
      ],
      feeLogs: [
        { id: 'log-pend-nodate', dateTime: '', userId: 'ux', userName: 'X', userEmail: 'x@t.pk', jobTitle: 'Pending', amount: 1200, currency: 'PKR', paymentMethod: 'Wallet', status: 'Pending' },
        { id: 'log-ref-nodate', dateTime: '', userId: 'uy', userName: 'Y', userEmail: 'y@t.pk', jobTitle: 'Refunded', amount: 1800, currency: 'PKR', paymentMethod: 'Wallet', status: 'Refunded' }
      ],
      subscribers: [
        { id: 'sub-pend-nodate', name: 'P', email: 'p@t.pk', phone: '03001111111', plan: 'Monthly', paymentMethod: 'JazzCash', amountPaid: 999, currency: 'PKR', status: 'Pending', subscribedAt: '', whatsappEnabled: false }
      ],
      ads: [
        { id: 'ad-exempt-nodate', status: 'active', paymentStatus: 'Exempt', campaignCostPkr: 5000 } as unknown as Advertisement,
        { id: 'ad-refund-nodate', status: 'rejected', paymentStatus: 'Refunded', campaignCostPkr: 7000 } as unknown as Advertisement
      ],
      timeRange: 'today',
      referenceDate: refNow
    });
    assert.strictEqual(datedValidWithUndatedIneligible.totalTransactionsRevenuePkr, 3000);
    assert.strictEqual(datedValidWithUndatedIneligible.totalFeeLogsPkr, 0);
    assert.strictEqual(datedValidWithUndatedIneligible.totalSubscribersPkr, 0);
    assert.strictEqual(datedValidWithUndatedIneligible.totalAdsPkr, 0);
    assert.strictEqual(datedValidWithUndatedIneligible.totalGrossRevenuePkr, 3000);
  });

  await runTest('AUDIT-25 [Missing Paid Ad Cost Propagation]: Paid ad missing cost makes both totalAdsPkr and totalGrossRevenuePkr null (N/A) even with other valid streams', () => {
    const metrics = computeAnalyticsMetrics({
      paymentTransactions: [
        { id: 'tx-valid', dateTime: '2026-11-17 09:00', amount: 4000, currency: 'PKR', type: 'Subscription', status: 'Success', paymentMethod: 'JazzCash' }
      ],
      ads: [
        { id: 'ad-paid-ok', status: 'active', paymentStatus: 'Paid', campaignCostPkr: 5000, createdAt: '2026-11-17T08:00:00.000Z' } as unknown as Advertisement,
        { id: 'ad-paid-missing-cost', status: 'active', paymentStatus: 'Paid', createdAt: '2026-11-17T09:00:00.000Z' } as unknown as Advertisement
      ]
    });
    assert.strictEqual(metrics.totalTransactionsRevenuePkr, 4000);
    assert.strictEqual(metrics.totalAdsPkr, null);
    assert.strictEqual(metrics.totalGrossRevenuePkr, null);
    assert.strictEqual(formatAnalyticsCurrency(metrics.totalGrossRevenuePkr, 'PKR'), 'N/A');
  });

  await runTest('AUDIT-26 [Missing Ad Payment Status Propagation]: Ad with missing paymentStatus mixed with Paid ads and valid transactions makes totalAdsPkr and totalGrossRevenuePkr null (N/A)', () => {
    const metrics = computeAnalyticsMetrics({
      paymentTransactions: [
        { id: 'tx-valid-2', dateTime: '2026-11-17 09:00', amount: 2500, currency: 'PKR', type: 'Job Posting Fee', status: 'Success', paymentMethod: 'Wallet' }
      ],
      ads: [
        { id: 'ad-verified-paid', status: 'active', paymentStatus: 'Paid', campaignCostPkr: 6000, createdAt: '2026-11-17T08:00:00.000Z' } as unknown as Advertisement,
        { id: 'ad-missing-status', status: 'active', campaignCostPkr: 9000, createdAt: '2026-11-17T10:00:00.000Z' } as unknown as Advertisement
      ]
    });
    assert.strictEqual(metrics.totalAdsPkr, null);
    assert.strictEqual(metrics.totalGrossRevenuePkr, null);
  });

  await runTest('AUDIT-27 [Gross Revenue Uncertainty Propagation]: Uncertainty in any individual revenue stream always propagates null to totalGrossRevenuePkr', () => {
    // 1. Unconvertible subscriber currency propagates to Gross Revenue despite valid feeLogs + txs
    const subUncertain = computeAnalyticsMetrics({
      paymentTransactions: [
        { id: 'tx-pkr', dateTime: '2026-11-17 09:00', amount: 3000, currency: 'PKR', type: 'Job Posting Fee', status: 'Success', paymentMethod: 'Wallet' }
      ],
      subscribers: [
        { id: 'sub-usd-norate', name: 'Intl', email: 'i@t.pk', phone: '03001234567', plan: 'Pro', paymentMethod: 'Stripe', amountPaid: 20, currency: 'USD', status: 'Active', subscribedAt: '2026-11-17 10:00', whatsappEnabled: true }
      ]
    });
    assert.strictEqual(subUncertain.totalTransactionsRevenuePkr, 3000);
    assert.strictEqual(subUncertain.totalSubscribersPkr, null);
    assert.strictEqual(subUncertain.totalGrossRevenuePkr, null);

    // 2. Unconvertible fee log propagates to Gross Revenue despite valid txs
    const feeUncertain = computeAnalyticsMetrics({
      paymentTransactions: [
        { id: 'tx-pkr-2', dateTime: '2026-11-17 09:00', amount: 3000, currency: 'PKR', type: 'Subscription', status: 'Success', paymentMethod: 'JazzCash' }
      ],
      feeLogs: [
        { id: 'log-aed-norate', dateTime: '2026-11-17 10:00', userId: 'u9', userName: 'Gulf Co', userEmail: 'g@co.ae', jobTitle: 'Lead', amount: 100, currency: 'AED', paymentMethod: 'Card', status: 'Paid' }
      ]
    });
    assert.strictEqual(feeUncertain.totalFeeLogsPkr, null);
    assert.strictEqual(feeUncertain.totalGrossRevenuePkr, null);
  });

  await runTest('AUDIT-28 [Repeated Legitimate Job Postings]: Does NOT suppress repeated job posting payments sharing userId, jobTitle, and amount', () => {
    // Same employer posts the same job title twice at the same fee:
    // tx-job-1 claimed by log-tx-job-1; log-job-2 is a legitimate second payment; tx-job-3 + log-tx-job-3 is a third.
    const metrics = computeAnalyticsMetrics({
      paymentTransactions: [
        {
          id: 'tx-job-1',
          transactionId: 'TID-J1',
          dateTime: '2026-11-17 09:00',
          amount: 2000,
          currency: 'PKR',
          type: 'Job Posting Fee',
          status: 'Success',
          paymentMethod: 'Wallet',
          userId: 'u-emp-repeat',
          jobTitleRef: 'Senior React Developer'
        },
        {
          id: 'tx-job-3',
          transactionId: 'TID-J3',
          dateTime: '2026-11-17 16:00',
          amount: 2000,
          currency: 'PKR',
          type: 'Job Posting Fee',
          status: 'Success',
          paymentMethod: 'Wallet',
          userId: 'u-emp-repeat',
          jobTitleRef: 'Senior React Developer'
        }
      ],
      feeLogs: [
        {
          id: 'log-tx-job-1',
          dateTime: '2026-11-17 09:00',
          userId: 'u-emp-repeat',
          userName: 'Repeat Corp',
          userEmail: 'hr@repeat.pk',
          jobTitle: 'Senior React Developer',
          amount: 2000,
          currency: 'PKR',
          paymentMethod: 'Wallet',
          status: 'Paid'
        },
        {
          id: 'log-job-2-standalone',
          dateTime: '2026-11-17 12:30',
          userId: 'u-emp-repeat',
          userName: 'Repeat Corp',
          userEmail: 'hr@repeat.pk',
          jobTitle: 'Senior React Developer',
          amount: 2000,
          currency: 'PKR',
          paymentMethod: 'Easypaisa',
          status: 'Paid'
        },
        {
          id: 'log-tx-job-3',
          dateTime: '2026-11-17 16:00',
          userId: 'u-emp-repeat',
          userName: 'Repeat Corp',
          userEmail: 'hr@repeat.pk',
          jobTitle: 'Senior React Developer',
          amount: 2000,
          currency: 'PKR',
          paymentMethod: 'Wallet',
          status: 'Paid'
        }
      ]
    });

    assert.strictEqual(metrics.totalTransactionsRevenuePkr, 4000);
    assert.strictEqual(metrics.totalFeeLogsPkr, 6000);
    assert.strictEqual(metrics.totalGrossRevenuePkr, 6000);

    // Also test tx-1 without a linked log + distinct timestamp repeated standalone log-2 (e.g. 5 hours later)
    const separateTimeRepeat = computeAnalyticsMetrics({
      paymentTransactions: [
        {
          id: 'tx-repeat-early',
          dateTime: '2026-11-17 09:00',
          amount: 2000,
          currency: 'PKR',
          type: 'Job Posting Fee',
          status: 'Success',
          paymentMethod: 'JazzCash',
          userId: 'u-emp-same',
          jobTitleRef: 'DevOps Engineer'
        }
      ],
      feeLogs: [
        {
          id: 'log-repeat-later',
          dateTime: '2026-11-17 14:00',
          userId: 'u-emp-same',
          userName: 'Same Emp',
          userEmail: 'same@emp.pk',
          jobTitle: 'DevOps Engineer',
          amount: 2000,
          currency: 'PKR',
          paymentMethod: 'Easypaisa',
          status: 'Paid'
        }
      ]
    });
    assert.strictEqual(separateTimeRepeat.totalGrossRevenuePkr, 4000);
  });

  await runTest('AUDIT-29 [Repeated Subscription Renewals]: Does NOT suppress legitimate repeated subscription renewals sharing userId/email and amount', () => {
    const metrics = computeAnalyticsMetrics({
      paymentTransactions: [
        {
          id: 'tx-sub-jan',
          transactionId: 'TID-SUB-1',
          dateTime: '2026-10-15 10:00',
          amount: 1200,
          currency: 'PKR',
          type: 'Subscription',
          status: 'Success',
          paymentMethod: 'JazzCash',
          userId: 'u-sub-repeat',
          userEmail: 'loyal@seeker.pk'
        }
      ],
      subscribers: [
        {
          id: 'sub-tx-sub-jan',
          name: 'Loyal Seeker',
          email: 'loyal@seeker.pk',
          phone: '03001112233',
          plan: 'Pro Alerts',
          paymentMethod: 'JazzCash',
          paymentTransactionId: 'tx-sub-jan',
          amountPaid: 1200,
          currency: 'PKR',
          status: 'Active',
          subscribedAt: '2026-10-15 10:00',
          whatsappEnabled: true
        },
        {
          id: 'sub-renewal-nov',
          name: 'Loyal Seeker',
          email: 'loyal@seeker.pk',
          phone: '03001112233',
          plan: 'Pro Alerts',
          paymentMethod: 'Easypaisa',
          amountPaid: 1200,
          currency: 'PKR',
          status: 'Active',
          subscribedAt: '2026-11-15 10:00',
          whatsappEnabled: true
        }
      ]
    });
    assert.strictEqual(metrics.totalTransactionsRevenuePkr, 1200);
    assert.strictEqual(metrics.totalSubscribersPkr, 2400);
    assert.strictEqual(metrics.totalGrossRevenuePkr, 2400);

    // Renewal at a later date even when original transaction has no linked subscriber record
    const renewalLaterMonth = computeAnalyticsMetrics({
      paymentTransactions: [
        {
          id: 'tx-sub-oct',
          dateTime: '2026-10-10 09:00',
          amount: 1500,
          currency: 'PKR',
          type: 'Subscription',
          status: 'Success',
          paymentMethod: 'JazzCash',
          userId: 'u-renew',
          userEmail: 'renew@seeker.pk'
        }
      ],
      subscribers: [
        {
          id: 'sub-nov-standalone',
          name: 'Renew User',
          email: 'renew@seeker.pk',
          phone: '03009998877',
          plan: 'Pro Alerts',
          paymentMethod: 'Easypaisa',
          amountPaid: 1500,
          currency: 'PKR',
          status: 'Active',
          subscribedAt: '2026-11-10',
          whatsappEnabled: true
        }
      ]
    });
    assert.strictEqual(renewalLaterMonth.totalGrossRevenuePkr, 3000);
  });

  await runTest('AUDIT-30 [Missing Currency Safety]: Does NOT default missing or blank currency to PKR and propagates N/A to metrics', () => {
    assert.strictEqual(convertRecordAmountToPkr(2000, undefined), null);
    assert.strictEqual(convertRecordAmountToPkr(2000, null), null);
    assert.strictEqual(convertRecordAmountToPkr(2000, ''), null);
    assert.strictEqual(convertRecordAmountToPkr(2000, '   '), null);
    assert.strictEqual(convertRecordAmountToPkr(2000, 'PKR'), 2000);

    const txMissingCurr = computeAnalyticsMetrics({
      paymentTransactions: [
        { id: 'tx-nocurr', dateTime: '2026-11-17 09:00', amount: 100, currency: '' as any, type: 'Subscription', status: 'Success', paymentMethod: 'Stripe' }
      ]
    });
    assert.strictEqual(txMissingCurr.totalTransactionsRevenuePkr, null);
    assert.strictEqual(txMissingCurr.totalGrossRevenuePkr, null);

    const subMissingCurr = computeAnalyticsMetrics({
      subscribers: [
        { id: 'sub-nocurr', name: 'No Curr', email: 'nc@t.pk', phone: '03001112233', plan: 'Pro', paymentMethod: 'Stripe', amountPaid: 50, currency: undefined as any, status: 'Active', subscribedAt: '2026-11-17 09:00', whatsappEnabled: true }
      ]
    });
    assert.strictEqual(subMissingCurr.totalSubscribersPkr, null);
    assert.strictEqual(subMissingCurr.totalGrossRevenuePkr, null);
  });

  await runTest('AUDIT-31 [Invalid FX Rates]: Rejects zero, negative, NaN, Infinity, or unconfigured exchange rates cleanly as null (N/A)', () => {
    const badRatesConfig: CurrencyExchangeConfig = {
      baseCurrency: 'PKR',
      supportedCurrencies: ['PKR', 'USD', 'AED', 'SAR'],
      internationalPricingTiers: INITIAL_CURRENCY_CONFIG.internationalPricingTiers,
      autoSyncEnabled: false,
      lastSyncedAt: '2026-11-17',
      rates: {
        PKR: 1,
        USD: 0,
        AED: -0.015,
        SAR: Number.NaN,
        EUR: Number.POSITIVE_INFINITY,
        GBP: 0.003,
        CAD: 0,
        AUD: 0
      }
    };

    assert.strictEqual(convertRecordAmountToPkr(100, 'USD', badRatesConfig), null);
    assert.strictEqual(convertRecordAmountToPkr(100, 'AED', badRatesConfig), null);
    assert.strictEqual(convertRecordAmountToPkr(100, 'SAR', badRatesConfig), null);
    assert.strictEqual(convertRecordAmountToPkr(100, 'EUR', badRatesConfig), null);
    assert.strictEqual(convertRecordAmountToPkr(100, 'PKR', badRatesConfig), 100);
    assert.strictEqual(convertRecordAmountToPkr(30, 'GBP', badRatesConfig), 10000);

    const metricsBadFx = computeAnalyticsMetrics({
      paymentTransactions: [
        { id: 'tx-bad-fx', dateTime: '2026-11-17 09:00', amount: 50, currency: 'USD', type: 'Job Posting Fee', status: 'Success', paymentMethod: 'Stripe' }
      ],
      currencyConfig: badRatesConfig
    });
    assert.strictEqual(metricsBadFx.totalTransactionsRevenuePkr, null);
    assert.strictEqual(metricsBadFx.totalGrossRevenuePkr, null);
    assert.strictEqual(formatAnalyticsCurrency(metricsBadFx.totalGrossRevenuePkr, 'PKR', badRatesConfig), 'N/A');
  });

  await runTest('AUDIT-32 [Unique ID/Ref Deduplication & Ambiguous Legacy Handling]: Deduplicates linked IDs/refs cleanly and exposes uncertainty on genuinely ambiguous unlinked legacy pairs', () => {
    // 1. User-embedded transaction sharing transactionId (even with different id) with central paymentTransactions is NOT double-counted
    const embeddedDup = computeAnalyticsMetrics({
      paymentTransactions: [
        { id: 'tx-central-1', transactionId: 'TID-SHARED-99', dateTime: '2026-11-17 10:00', amount: 2500, currency: 'PKR', type: 'Job Posting Fee', status: 'Success', paymentMethod: 'Wallet', userId: 'u-1', jobTitleRef: 'Architect' }
      ],
      users: [
        {
          id: 'u-1',
          name: 'User One',
          email: 'u1@pk.test',
          role: 'Employer/Job Poster',
          plan: 'Free',
          autoRenew: false,
          createdAt: '2026-11-01',
          transactions: [
            { id: 'user-tx-mirror', transactionId: 'TID-SHARED-99', dateTime: '2026-11-17 10:00', amount: 2500, currency: 'PKR', type: 'Job Posting Fee', status: 'Success', paymentMethod: 'Wallet' }
          ]
        }
      ]
    });
    assert.strictEqual(embeddedDup.countedTransactionsCount, 1);
    assert.strictEqual(embeddedDup.totalTransactionsRevenuePkr, 2500);
    assert.strictEqual(embeddedDup.totalGrossRevenuePkr, 2500);

    // 2. Ambiguous unlinked legacy FeeLog matching an unclaimed tx (same user, title, amount, same timestamp, no tx link on log)
    // Must expose uncertainty (totalGrossRevenuePkr === null) rather than silently hiding a payment or silently double-counting
    const ambiguousLegacyFee = computeAnalyticsMetrics({
      paymentTransactions: [
        {
          id: 'tx-unclaimed-legacy',
          transactionId: 'TID-LEGACY-1',
          dateTime: '2026-11-17 10:00',
          amount: 2000,
          currency: 'PKR',
          type: 'Job Posting Fee',
          status: 'Success',
          paymentMethod: 'Wallet',
          userId: 'u-legacy',
          jobTitleRef: 'Systems Analyst'
        }
      ],
      feeLogs: [
        {
          id: 'legacy-fee-no-tx-ref',
          dateTime: '2026-11-17 10:00',
          userId: 'u-legacy',
          userName: 'Legacy Emp',
          userEmail: 'legacy@emp.pk',
          jobTitle: 'Systems Analyst',
          amount: 2000,
          currency: 'PKR',
          paymentMethod: 'Wallet',
          status: 'Paid'
        }
      ]
    });
    assert.strictEqual(ambiguousLegacyFee.totalTransactionsRevenuePkr, 2000);
    assert.strictEqual(ambiguousLegacyFee.totalFeeLogsPkr, 2000);
    assert.strictEqual(ambiguousLegacyFee.ambiguousFinancialDeduplicationCount, 1);
    assert.strictEqual(ambiguousLegacyFee.totalGrossRevenuePkr, null);

    // 3. Ambiguous unlinked legacy Subscriber matching an unclaimed Subscription tx on same PKT calendar day
    const ambiguousLegacySub = computeAnalyticsMetrics({
      paymentTransactions: [
        {
          id: 'tx-sub-unclaimed',
          dateTime: '2026-11-17 11:00',
          amount: 1200,
          currency: 'PKR',
          type: 'Subscription',
          status: 'Success',
          paymentMethod: 'JazzCash',
          userId: 'u-sub-leg',
          userEmail: 'subleg@pk.test'
        }
      ],
      subscribers: [
        {
          id: 'sub-legacy-noref',
          name: 'Legacy Sub',
          email: 'subleg@pk.test',
          phone: '03005556677',
          plan: 'Pro Alerts',
          paymentMethod: 'JazzCash',
          amountPaid: 1200,
          currency: 'PKR',
          status: 'Active',
          subscribedAt: '2026-11-17',
          whatsappEnabled: true
        }
      ]
    });
    assert.strictEqual(ambiguousLegacySub.ambiguousFinancialDeduplicationCount, 1);
    assert.strictEqual(ambiguousLegacySub.totalGrossRevenuePkr, null);
  });

  await runTest('AUDIT-33 [Rolling Range Upper/Lower Bounds & PKT/All-Time Preservation]: 7 Days and 30 Days cap at refMs (excluding future-dated same-PKT-day records) while keeping exact lower bounds, PKT Today midnight bounds, and All Time undated inclusion', () => {
    const refNowIso = '2026-11-17T12:00:00.000Z'; // 2026-11-17 17:00:00 PKT
    const refMs = Date.parse(refNowIso);
    const msPerDay = 24 * 60 * 60 * 1000;

    // 1. Direct helper checks for refMs upper bound (even when still inside same PKT calendar day before 18:59:59.999Z)
    assert.strictEqual(isTimestampInRange(refMs - 1, '7days', refNowIso), true, 'Just before refMs must be included in 7days');
    assert.strictEqual(isTimestampInRange(refMs, '7days', refNowIso), true, 'Exact refMs must be included in 7days');
    assert.strictEqual(isTimestampInRange(refMs + 1, '7days', refNowIso), false, 'Just after refMs (even same PKT day) must be excluded from 7days');
    assert.strictEqual(isTimestampInRange(refMs + 60 * 60 * 1000, '7days', refNowIso), false, 'Future timestamp +1h same PKT day must be excluded from 7days');

    assert.strictEqual(isTimestampInRange(refMs - 1, '30days', refNowIso), true, 'Just before refMs must be included in 30days');
    assert.strictEqual(isTimestampInRange(refMs, '30days', refNowIso), true, 'Exact refMs must be included in 30days');
    assert.strictEqual(isTimestampInRange(refMs + 1, '30days', refNowIso), false, 'Just after refMs (even same PKT day) must be excluded from 30days');

    // 2. Exact lower boundaries for 7 Days and 30 Days
    const sevenDaysStart = refMs - 7 * msPerDay;
    const thirtyDaysStart = refMs - 30 * msPerDay;
    assert.strictEqual(isTimestampInRange(sevenDaysStart, '7days', refNowIso), true, 'Exact 7-day lower bound must be included');
    assert.strictEqual(isTimestampInRange(sevenDaysStart - 1, '7days', refNowIso), false, '1ms before 7-day lower bound must be excluded');
    assert.strictEqual(isTimestampInRange(thirtyDaysStart, '30days', refNowIso), true, 'Exact 30-day lower bound must be included');
    assert.strictEqual(isTimestampInRange(thirtyDaysStart - 1, '30days', refNowIso), false, '1ms before 30-day lower bound must be excluded');

    // 3. Today preserves Asia/Karachi (PKT, UTC+5) midnight boundaries
    assert.strictEqual(isTimestampInRange(Date.parse('2026-11-16T18:59:59.999Z'), 'today', refNowIso), false, 'Nov 16 23:59:59.999 PKT excluded from Nov 17 PKT Today');
    assert.strictEqual(isTimestampInRange(Date.parse('2026-11-16T19:00:00.000Z'), 'today', refNowIso), true, 'Nov 17 00:00:00.000 PKT included in Nov 17 PKT Today');
    assert.strictEqual(isTimestampInRange(Date.parse('2026-11-17T18:59:59.999Z'), 'today', refNowIso), true, 'Nov 17 23:59:59.999 PKT included in Nov 17 PKT Today');
    assert.strictEqual(isTimestampInRange(Date.parse('2026-11-17T19:00:00.000Z'), 'today', refNowIso), false, 'Nov 18 00:00:00.000 PKT excluded from Nov 17 PKT Today');

    // 4. All Time still includes undated records
    assert.strictEqual(isTimestampInRange(null, 'all', refNowIso), true, 'All Time must include null/undated timestamp');

    // 5. End-to-end computeAnalyticsMetrics verification across all ranges
    const txs: PaymentTransaction[] = [
      { id: 'tx-just-before', dateTime: new Date(refMs - 1000).toISOString(), amount: 1000, currency: 'PKR', type: 'Subscription', status: 'Success', paymentMethod: 'JazzCash' },
      { id: 'tx-just-after-same-pkt-day', dateTime: new Date(refMs + 1000).toISOString(), amount: 9000, currency: 'PKR', type: 'Subscription', status: 'Success', paymentMethod: 'JazzCash' },
      { id: 'tx-7d-lower-ok', dateTime: new Date(sevenDaysStart).toISOString(), amount: 2000, currency: 'PKR', type: 'Job Posting Fee', status: 'Success', paymentMethod: 'Wallet' },
      { id: 'tx-7d-lower-out', dateTime: new Date(sevenDaysStart - 1000).toISOString(), amount: 4000, currency: 'PKR', type: 'Job Posting Fee', status: 'Success', paymentMethod: 'Wallet' },
      { id: 'tx-30d-lower-ok', dateTime: new Date(thirtyDaysStart).toISOString(), amount: 8000, currency: 'PKR', type: 'Ad Campaign Fee', status: 'Success', paymentMethod: 'Bank Transfer' },
      { id: 'tx-30d-lower-out', dateTime: new Date(thirtyDaysStart - 1000).toISOString(), amount: 16000, currency: 'PKR', type: 'Ad Campaign Fee', status: 'Success', paymentMethod: 'Bank Transfer' }
    ];

    const m7 = computeAnalyticsMetrics({ paymentTransactions: txs, timeRange: '7days', referenceDate: refNowIso });
    assert.strictEqual(m7.totalTransactionsRevenuePkr, 3000);
    assert.strictEqual(m7.totalGrossRevenuePkr, 3000);

    const m30 = computeAnalyticsMetrics({ paymentTransactions: txs, timeRange: '30days', referenceDate: refNowIso });
    assert.strictEqual(m30.totalTransactionsRevenuePkr, 15000);
    assert.strictEqual(m30.totalGrossRevenuePkr, 15000);

    const undatedAllTime = computeAnalyticsMetrics({
      paymentTransactions: [
        { id: 'tx-dated', dateTime: new Date(refMs - 1000).toISOString(), amount: 1000, currency: 'PKR', type: 'Subscription', status: 'Success', paymentMethod: 'JazzCash' },
        { id: 'tx-undated', dateTime: '', amount: 5000, currency: 'PKR', type: 'Subscription', status: 'Success', paymentMethod: 'Easypaisa' }
      ],
      timeRange: 'all',
      referenceDate: refNowIso
    });
    assert.strictEqual(undatedAllTime.totalTransactionsRevenuePkr, 6000);
    assert.strictEqual(undatedAllTime.totalGrossRevenuePkr, 6000);
  });

  await runTest('AUDIT-34 [Subscriber Paid Financial Eligibility & Free Trial Filtering]: Free Trial and zero-value subscribers are excluded from paid count, revenue, missing-date uncertainty, and ambiguous deduplication, while valid Active and Expiring Soon positive-value subscribers are counted correctly', () => {
    const refNow = '2026-11-17T12:00:00.000Z';

    const subscribers: Subscriber[] = [
      // A. Active Free Trial with zero amount (Not counted as paid, no revenue)
      {
        id: 'sub-ft-zero',
        name: 'Free Trial Zero',
        email: 'ft0@t.pk',
        phone: '03001111111',
        plan: 'Basic',
        paymentMethod: 'Free Trial',
        amountPaid: 0,
        currency: 'PKR',
        status: 'Active',
        subscribedAt: '2026-11-17 10:00',
        whatsappEnabled: false
      },
      // B. Active Free Trial with a positive amount (Inconsistent legacy record, must not be treated as paid revenue)
      {
        id: 'sub-ft-positive',
        name: 'Free Trial Positive',
        email: 'ftp@t.pk',
        phone: '03002222222',
        plan: 'Pro',
        paymentMethod: 'Free Trial',
        amountPaid: 1500,
        currency: 'PKR',
        status: 'Active',
        subscribedAt: '2026-11-17 10:00',
        whatsappEnabled: true
      },
      // C. Active zero-value non-trial subscriber (Not counted as paid)
      {
        id: 'sub-zero-paid',
        name: 'Zero Paid',
        email: 'zp@t.pk',
        phone: '03003333333',
        plan: 'Basic',
        paymentMethod: 'JazzCash',
        amountPaid: 0,
        currency: 'PKR',
        status: 'Active',
        subscribedAt: '2026-11-17 10:00',
        whatsappEnabled: false
      },
      // D. Active positive-value paid subscriber (Counted correctly)
      {
        id: 'sub-active-paid',
        name: 'Active Paid',
        email: 'ap@t.pk',
        phone: '03004444444',
        plan: 'Pro Alerts',
        paymentMethod: 'Easypaisa',
        amountPaid: 1200,
        currency: 'PKR',
        status: 'Active',
        subscribedAt: '2026-11-17 10:00',
        whatsappEnabled: true
      },
      // E. Expiring Soon positive-value paid subscriber (Counted correctly)
      {
        id: 'sub-exp-paid',
        name: 'Expiring Paid',
        email: 'exp@t.pk',
        phone: '03005555555',
        plan: 'VIP',
        paymentMethod: 'Bank Transfer',
        amountPaid: 2500,
        currency: 'PKR',
        status: 'Expiring Soon',
        subscribedAt: '2026-11-17 10:00',
        whatsappEnabled: true
      },
      // F. Undated Free Trial (Must not make bounded-range financial totals N/A)
      {
        id: 'sub-ft-undated',
        name: 'Undated FT',
        email: 'uft@t.pk',
        phone: '03006666666',
        plan: 'Basic',
        paymentMethod: 'Free Trial',
        amountPaid: 0,
        currency: 'PKR',
        status: 'Active',
        subscribedAt: '',
        whatsappEnabled: false
      }
    ];

    const metricsToday = computeAnalyticsMetrics({
      subscribers,
      timeRange: 'today',
      referenceDate: refNow
    });

    assert.strictEqual(metricsToday.paidSubscribersCount, 2, 'Only Active Paid and Expiring Paid count as paid subscribers');
    assert.strictEqual(metricsToday.totalSubscribersPkr, 3700, 'Total subscriber revenue is 1200 + 2500 = 3700');
    assert.strictEqual(metricsToday.totalGrossRevenuePkr, 3700, 'Free trial and zero-value records do not corrupt gross revenue');
    assert.strictEqual(metricsToday.missingEligibleFinancialDateCount, 0, 'Undated Free Trial does not create false financial date missing uncertainty');

    // G. Existing linked paid subscriber retains correct transaction deduplication and gross revenue
    const linkedMetrics = computeAnalyticsMetrics({
      paymentTransactions: [
        {
          id: 'tx-sub-linked-1',
          dateTime: '2026-11-17 09:00',
          amount: 1200,
          currency: 'PKR',
          type: 'Subscription',
          status: 'Success',
          paymentMethod: 'Easypaisa'
        }
      ],
      subscribers: [
        {
          id: 'sub-linked-1',
          name: 'Linked Sub',
          email: 'linked@t.pk',
          phone: '03007777777',
          plan: 'Pro',
          paymentMethod: 'Easypaisa',
          paymentTransactionId: 'tx-sub-linked-1',
          amountPaid: 1200,
          currency: 'PKR',
          status: 'Active',
          subscribedAt: '2026-11-17 09:00',
          whatsappEnabled: true
        }
      ]
    });
    assert.strictEqual(linkedMetrics.totalTransactionsRevenuePkr, 1200);
    assert.strictEqual(linkedMetrics.totalSubscribersPkr, 1200);
    assert.strictEqual(linkedMetrics.totalGrossRevenuePkr, 1200, 'Linked paid subscriber is deduplicated cleanly against authoritative transaction');
  });

  await runTest('Scraper Classification: newly configured source is Configured / Not Yet Verified and never Working', () => {
    const unverifiedSource = {
      id: 'portal-new-test',
      name: 'New Test Portal',
      url: 'https://example.com/careers',
      status: 'Active Scheduled',
      healthStatus: 'healthy',
      scrapedCount: 0
    };

    const classification = deriveSourceClassification(unverifiedSource);
    assert.strictEqual(classification.historicallyProven, false);
    assert.strictEqual(classification.overallStatus, 'Configured / Not Yet Verified');
    assert.notStrictEqual(classification.overallStatus, 'Working', 'Unverified source must not be classified as Working');
  });

  await runTest('Scraper Classification: historically proven successful source is Working', () => {
    const provenSource = {
      id: 'portal-proven-test',
      name: 'Proven Portal',
      url: 'https://example.com/careers',
      status: 'Active Scheduled',
      healthStatus: 'Jobs Found',
      scrapedCount: 15,
      lastSuccessfulScrapeAt: new Date().toISOString()
    };

    const classification = deriveSourceClassification(provenSource);
    assert.strictEqual(classification.historicallyProven, true);
    assert.strictEqual(classification.overallStatus, 'Working');
  });

  await runTest('Scraper Classification: historically proven source with transient error is Partial and maintains historical proof', () => {
    const failingProvenSource = {
      id: 'portal-failing-proven',
      name: 'Failing Proven Portal',
      url: 'https://example.com/careers',
      status: 'Active Scheduled',
      healthStatus: '404',
      lastHttpStatus: 404,
      scrapedCount: 10,
      lastSuccessfulScrapeAt: '2026-11-01T00:00:00.000Z'
    };

    const classification = deriveSourceClassification(failingProvenSource);
    assert.strictEqual(classification.historicallyProven, true, 'Transient error never clears historical success');
    assert.strictEqual(classification.overallStatus, 'Partial');
  });

  // ============================================================================
  // STEP-8.1 TEST-ONLY FOLLOW-UP: EDGE CASES A THROUGH G
  // ============================================================================

  await runTest('Scraper Classification Edge Case A: Unverified source with healthStatus="healthy" and scrapedCount=0 must remain Configured / Not Yet Verified', () => {
    const unverifiedSource = {
      id: 'source-edge-a',
      name: 'Newly Configured Portal A',
      url: 'https://example.com/careers',
      status: 'Active Scheduled',
      healthStatus: 'healthy',
      scrapedCount: 0
    };

    const classification = deriveSourceClassification(unverifiedSource);
    assert.strictEqual(classification.historicallyProven, false, 'Unverified source must have historicallyProven = false');
    assert.strictEqual(classification.overallStatus, 'Configured / Not Yet Verified', 'Must be Configured / Not Yet Verified');
    assert.strictEqual(isWorkingSource(unverifiedSource), false, 'isWorkingSource must return false');
    assert.ok(classification.statusReason.includes('Configured / Not Yet Verified'), 'Reason must document unverified status');
  });

  await runTest('Scraper Classification Edge Case B: Historically proven source with healthStatus="No Jobs", no error, and valid historical proof must follow intended Working classification', () => {
    const provenNoJobsSource = {
      id: 'source-edge-b',
      name: 'Proven Source Zero Jobs This Run',
      url: 'https://example.com/careers',
      status: 'Active Scheduled',
      healthStatus: 'No Jobs',
      lastHttpStatus: 200,
      lastErrorMessage: '',
      scrapedCount: 14,
      lastSuccessfulScrapeAt: '2026-11-15T08:00:00.000Z'
    };

    const classification = deriveSourceClassification(provenNoJobsSource);
    assert.strictEqual(classification.historicallyProven, true, 'Source has valid historical proof');
    assert.strictEqual(classification.overallStatus, 'Working', 'Proven source with 0 jobs and no errors remains Working');
    assert.strictEqual(isWorkingSource(provenNoJobsSource), true, 'isWorkingSource must return true');
    assert.ok(classification.statusReason.includes('Verified operational with 14 vacancies harvested'));
  });

  await runTest('Scraper Classification Edge Case C: Unverified source with HTTP 404 must not be classified as Working', () => {
    const unverified404Source = {
      id: 'source-edge-c',
      name: 'Unverified 404 Portal',
      url: 'https://example.com/careers',
      status: 'Active Scheduled',
      healthStatus: '404',
      lastHttpStatus: 404,
      lastErrorMessage: 'Not Found',
      scrapedCount: 0
    };

    const classification = deriveSourceClassification(unverified404Source);
    assert.strictEqual(classification.historicallyProven, false, 'No historical proof');
    assert.strictEqual(classification.overallStatus, 'Partial', 'Unverified failure maps to Partial for operator attention');
    assert.strictEqual(isWorkingSource(unverified404Source), false, 'Must not be classified as Working');
    assert.strictEqual(isPartialSource(unverified404Source), true, 'isPartialSource must return true');
  });

  await runTest('Scraper Classification Edge Case D: Disabled source must remain Unavailable regardless of historical proof', () => {
    const unprovenDisabled = {
      id: 'source-edge-d1',
      name: 'Unproven Disabled Portal',
      url: 'https://example.com/careers',
      status: 'Disabled',
      healthStatus: 'healthy',
      scrapedCount: 0
    };
    const c1 = deriveSourceClassification(unprovenDisabled);
    assert.strictEqual(c1.overallStatus, 'Unavailable', 'Unproven disabled must be Unavailable');
    assert.strictEqual(isUnavailableSource(unprovenDisabled), true);
    assert.strictEqual(isWorkingSource(unprovenDisabled), false);

    const provenDisabled = {
      id: 'source-edge-d2',
      name: 'Proven Disabled Portal',
      url: 'https://example.com/careers',
      status: 'Disabled',
      healthStatus: 'Jobs Found',
      scrapedCount: 42,
      lastSuccessfulScrapeAt: '2026-11-01T00:00:00.000Z'
    };
    const c2 = deriveSourceClassification(provenDisabled);
    assert.strictEqual(c2.overallStatus, 'Unavailable', 'Proven disabled must be Unavailable');
    assert.strictEqual(c2.historicallyProven, true, 'Historical proof is preserved');
    assert.strictEqual(isUnavailableSource(provenDisabled), true);
    assert.strictEqual(isWorkingSource(provenDisabled), false);
  });

  await runTest('Scraper Classification Edge Case E: Paused source must never be classified as Working (Partial if proven, Configured / Not Yet Verified if unproven)', () => {
    // Proven paused source
    const provenPaused = {
      id: 'source-edge-e1',
      name: 'Proven Paused Portal',
      url: 'https://example.com/careers',
      status: 'Paused',
      healthStatus: 'Jobs Found',
      scrapedCount: 18,
      lastSuccessfulScrapeAt: '2026-11-12T10:00:00.000Z'
    };
    const c1 = deriveSourceClassification(provenPaused);
    assert.strictEqual(c1.historicallyProven, true);
    assert.strictEqual(c1.overallStatus, 'Partial', 'Proven paused source expected status is Partial');
    assert.strictEqual(isWorkingSource(provenPaused), false, 'Must NEVER be classified as Working');
    assert.strictEqual(isPartialSource(provenPaused), true);
    assert.ok(c1.statusReason.includes('Source is currently Paused, historically proven with 18 vacancies'));

    // Unproven paused source
    const unprovenPaused = {
      id: 'source-edge-e2',
      name: 'Unproven Paused Portal',
      url: 'https://example.com/careers',
      status: 'Paused',
      healthStatus: 'healthy',
      scrapedCount: 0
    };
    const c2 = deriveSourceClassification(unprovenPaused);
    assert.strictEqual(c2.historicallyProven, false);
    assert.strictEqual(c2.overallStatus, 'Configured / Not Yet Verified', 'Unproven paused source remains Configured / Not Yet Verified');
    assert.strictEqual(isWorkingSource(unprovenPaused), false, 'Must NEVER be classified as Working');
  });

  await runTest('Scraper Classification Edge Case F: Unverified provenExtractionMethods with zero scrapedCount and no valid timestamp must NOT establish historical proof', () => {
    const methodsOnlySource = {
      id: 'source-edge-f',
      name: 'Unverified Methods Portal',
      pdfUrl: 'https://example.com/gazette.pdf',
      formatType: 'PDF Advertisement',
      status: 'Active Scheduled',
      healthStatus: 'Jobs Found',
      scrapedCount: 0,
      provenExtractionMethods: ['government_pdf_engine', 'detail', 'json_ld']
    };

    assert.strictEqual(isHistoricallyProven(methodsOnlySource), false, 'Arbitrary provenExtractionMethods alone must NOT grant historical proof');
    const provenCaps = getProvenCapabilities(methodsOnlySource);
    assert.deepStrictEqual(provenCaps, [], 'Proven capabilities must remain empty without genuine historical proof');

    const classification = deriveSourceClassification(methodsOnlySource);
    assert.strictEqual(classification.historicallyProven, false);
    assert.strictEqual(classification.overallStatus, 'Configured / Not Yet Verified', 'Source with only unverified methods must stay Configured / Not Yet Verified');
    assert.strictEqual(isWorkingSource(methodsOnlySource), false);
  });

  await runTest('Scraper Classification Edge Case G: Invalid lastSuccessfulScrapeAt must not count as historical proof', () => {
    const invalidTimestamps = [
      '',
      '   ',
      'invalid-date',
      'null',
      'undefined',
      '1970-01-01T00:00:00.000Z'
    ];

    for (const ts of invalidTimestamps) {
      const source = {
        id: `source-edge-g-${ts}`,
        name: `Invalid TS Source (${ts})`,
        url: 'https://example.com/careers',
        status: 'Active Scheduled',
        healthStatus: 'healthy',
        scrapedCount: 0,
        lastSuccessfulScrapeAt: ts
      };

      assert.strictEqual(
        isHistoricallyProven(source),
        false,
        `Timestamp "${ts}" must not count as historical proof`
      );

      const classification = deriveSourceClassification(source);
      assert.strictEqual(
        classification.historicallyProven,
        false,
        `Timestamp "${ts}" must not make classification historically proven`
      );
      assert.strictEqual(
        classification.overallStatus,
        'Configured / Not Yet Verified',
        `Source with timestamp "${ts}" and 0 scrapes must be Configured / Not Yet Verified`
      );
      assert.strictEqual(isWorkingSource(source), false, 'Must not be Working');
    }
  });

  // ============================================================================
  // STEP-8.2-A PRODUCTION SAFETY & MEDIA EXTRACTION REGRESSION TESTS (CASES 1-16)
  // ============================================================================

  await runTest('STEP-8.2-A Case 1 [Unit]: Linked-image OCR mapping helper always enforces Pending even when config.autoApprove=true', () => {
    // Verify that OCR-derived jobs originating from linked images are never automatically approved
    // regardless of whether the scraper target configuration has autoApprove enabled.
    const autoApproveConfig = {
      name: 'Newspaper Ad Portal',
      autoApprove: true
    };

    const simulatedOcrJobs = [
      {
        id: 'ocr-job-1',
        title: 'Assistant Director',
        company: 'Public Sector Organization',
        status: 'Approved' as const, // Attempted pre-approved input must still be forced to Pending
        isGovtJob: true,
        govtScale: 'BPS-17'
      }
    ];

    const mappedLinkedImageJobs = mapLinkedImageOcrJobs(
      simulatedOcrJobs,
      autoApproveConfig,
      'https://fpsc.gov.pk/jobs',
      'https://fpsc.gov.pk/ads/ad.jpg'
    );

    assert.strictEqual(autoApproveConfig.autoApprove, true, 'Target portal config has autoApprove set to true');
    assert.strictEqual(mappedLinkedImageJobs.length, 1);
    assert.strictEqual(mappedLinkedImageJobs[0].status, 'Pending', 'Linked-image OCR job must remain Pending even with autoApprove=true');
    assert.strictEqual(mappedLinkedImageJobs[0].extractionMethod, 'linked_image_ocr');
  });

  await runTest('STEP-8.2-A Case 2 [Unit]: Unknown government classification is not silently converted to Federal', () => {
    // When a job listing does not establish Federal or Provincial classification,
    // govtCategory must remain undefined rather than being assigned 'Federal'.
    const sampleUnknownOrg = `
      AUTONOMOUS RESEARCH FOUNDATION
      SENIOR SCIENTIFIC OFFICER
      Total Vacancies: 2
      Experience: 5 years in molecular biology
      Closing Date: 20-12-2026
      Qualification: Ph.D in Biotechnology
    `;

    const jobs = extractJobsFromPdfText(sampleUnknownOrg, 'https://example.com/ad.pdf', 'Autonomous Research Foundation');
    assert.strictEqual(jobs.length, 1);
    assert.strictEqual(jobs[0].title.length > 0, true);
    assert.strictEqual(
      jobs[0].govtCategory,
      undefined,
      'Unknown government classification must be undefined, never defaulted to Federal'
    );
  });

  await runTest('STEP-8.2-A Case 3 [Unit]: Explicitly verified government classification remains preserved', () => {
    // Case 3a: Explicit Federal Public Service Commission listing establishes Federal classification
    const federalSample = `
      FEDERAL PUBLIC SERVICE COMMISSION
      Consolidated Advertisement No. 12/2026
      Case No. F.4-250/2026-R
      ASSISTANT EXECUTIVE ENGINEER (BPS-17)
      MINISTRY OF HOUSING AND WORKS
      Total Vacancies: 4
      Closing Date: 31-12-2026
      Qualification: Bachelor Degree in Civil Engineering.
    `;
    const federalJobs = extractJobsFromPdfText(federalSample, 'https://fpsc.gov.pk/ad.pdf', 'FPSC');
    assert.strictEqual(federalJobs.length, 1);
    assert.strictEqual(federalJobs[0].isGovtJob, true);
    assert.strictEqual(federalJobs[0].govtScale, 'BPS-17');
    assert.strictEqual(federalJobs[0].govtCategory, 'Federal', 'FPSC listing must be classified as Federal');

    // Case 3b: Explicit Punjab Public Service Commission listing establishes Provincial classification
    const provincialSample = `
      PUNJAB PUBLIC SERVICE COMMISSION
      ADVERTISEMENT NO. 08/2026
      MEDICAL OFFICER (BPS-17)
      PUNJAB SPECIALIZED HEALTHCARE DEPARTMENT
      Total Vacancies: 15
      Closing Date: 15-12-2026
      Qualification: MBBS from a recognized university.
    `;
    const provincialJobs = extractJobsFromPdfText(provincialSample, 'https://ppsc.gop.pk/ad.pdf', 'PPSC');
    assert.strictEqual(provincialJobs.length, 1);
    assert.strictEqual(provincialJobs[0].isGovtJob, true);
    assert.strictEqual(provincialJobs[0].govtScale, 'BPS-17');
    assert.strictEqual(provincialJobs[0].govtCategory, 'Provincial', 'PPSC listing must be classified as Provincial');
  });

  await runTest('STEP-8.2-A Case 4 [Unit]: Valid JPEG/PNG/WEBP/BMP signatures are accepted', () => {
    // JPEG magic bytes: 0xFF 0xD8 0xFF
    const jpegBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46]);
    const jpegDetected = detectMediaFormat(jpegBuffer, 'image/jpeg', 'https://example.com/ad.jpg');
    assert.strictEqual(jpegDetected.format, 'jpeg');
    assert.strictEqual(jpegDetected.mimeType, 'image/jpeg');
    assert.strictEqual(jpegDetected.isSupportedMedia, true);

    // PNG magic bytes: 0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A
    const pngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00]);
    const pngDetected = detectMediaFormat(pngBuffer, 'image/png', 'https://example.com/ad.png');
    assert.strictEqual(pngDetected.format, 'png');
    assert.strictEqual(pngDetected.mimeType, 'image/png');
    assert.strictEqual(pngDetected.isSupportedMedia, true);

    // WEBP magic bytes: RIFF....WEBP
    const webpBuffer = Buffer.concat([
      Buffer.from('RIFF'),
      Buffer.from([0x24, 0x00, 0x00, 0x00]),
      Buffer.from('WEBP'),
      Buffer.from('VP8 ')
    ]);
    const webpDetected = detectMediaFormat(webpBuffer, 'image/webp', 'https://example.com/ad.webp');
    assert.strictEqual(webpDetected.format, 'webp');
    assert.strictEqual(webpDetected.mimeType, 'image/webp');
    assert.strictEqual(webpDetected.isSupportedMedia, true);

    // BMP magic bytes: 0x42 0x4D (BM)
    const bmpBuffer = Buffer.from([0x42, 0x4D, 0x36, 0x00, 0x00, 0x00]);
    const bmpDetected = detectMediaFormat(bmpBuffer, 'image/bmp', 'https://example.com/ad.bmp');
    assert.strictEqual(bmpDetected.format, 'bmp');
    assert.strictEqual(bmpDetected.mimeType, 'image/bmp');
    assert.strictEqual(bmpDetected.isSupportedMedia, true);

    // PDF magic bytes: %PDF- (0x25 0x50 0x44 0x46 0x2D)
    const pdfBuffer = Buffer.from('%PDF-1.5 standard document header');
    const pdfDetected = detectMediaFormat(pdfBuffer, 'application/pdf', 'https://example.com/ad.pdf');
    assert.strictEqual(pdfDetected.format, 'pdf');
    assert.strictEqual(pdfDetected.mimeType, 'application/pdf');
    assert.strictEqual(pdfDetected.isSupportedMedia, true);
  });

  await runTest('STEP-8.2-A Case 5 [Unit]: Invalid bytes with image/jpeg MIME are rejected', () => {
    // A server responding with content-type: image/jpeg but arbitrary non-image binary bytes
    // must NOT be accepted as supported media by detectMediaFormat.
    const corruptBinary = Buffer.from('corrupt non-image binary data stream that has no JPEG SOI marker');
    const detected = detectMediaFormat(corruptBinary, 'image/jpeg', 'https://example.com/fake.jpg');
    assert.strictEqual(detected.format, 'unknown', 'Corrupt binary must not be identified as jpeg');
    assert.strictEqual(detected.isSupportedMedia, false, 'Corrupt binary must be rejected as unsupported media');

    const corruptPngBinary = Buffer.from('corrupt non-PNG binary bytes stream');
    const detectedPng = detectMediaFormat(corruptPngBinary, 'image/png', 'https://example.com/fake.png');
    assert.strictEqual(detectedPng.format, 'unknown', 'Corrupt binary must not be identified as png');
    assert.strictEqual(detectedPng.isSupportedMedia, false);
  });

  await runTest('STEP-8.2-A Case 6 [Unit]: HTML/JSON/plain-text responses with image extensions are rejected', () => {
    // 1. HTML error page returned under .jpg URL
    const htmlErrorBinary = Buffer.from('<!DOCTYPE html><html><body><h1>404 Not Found</h1></body></html>');
    const detectedHtml = detectMediaFormat(htmlErrorBinary, 'text/html', 'https://example.com/missing_ad.jpg');
    assert.strictEqual(detectedHtml.format, 'html', 'HTML error page must be detected as html format');

    // 2. JSON error response returned under .png URL
    const jsonErrorBinary = Buffer.from('{"status": 404, "error": "Image document not found on remote server"}');
    const detectedJson = detectMediaFormat(jsonErrorBinary, 'application/json', 'https://example.com/ad.png');
    assert.strictEqual(detectedJson.format, 'unknown', 'JSON error response must be detected as unknown format');
    assert.strictEqual(detectedJson.isSupportedMedia, false, 'JSON response must not be accepted as media');

    // 3. Plain text error returned under .webp URL
    const textErrorBinary = Buffer.from('Access Denied: You do not have permission to access this resource.');
    const detectedText = detectMediaFormat(textErrorBinary, 'text/plain', 'https://example.com/ad.webp');
    assert.strictEqual(detectedText.format, 'unknown', 'Plain text error must be detected as unknown format');
    assert.strictEqual(detectedText.isSupportedMedia, false, 'Plain text must not be accepted as media');
  });

  await runTest('STEP-8.2-A Case 7 [Unit]: Existing valid PDF extraction remains functional', () => {
    const gazetteSample = `
      GOVERNMENT OF PAKISTAN
      FEDERAL PUBLIC SERVICE COMMISSION
      Consolidated Advertisement No. 10/2026
      
      Case No. F.4-150/2026-R
      1. LECTURER (MATHEMATICS) (BPS-17)
      MINISTRY OF FEDERAL EDUCATION & PROFESSIONAL TRAINING
      Total Vacancies: 5
      Age Limit: 22-30 years
      Closing Date: 31-12-2026
      Qualification: Second Class or Grade 'C' Master's degree in Mathematics.
    `;

    const jobs = extractJobsFromPdfText(gazetteSample, 'https://fpsc.gov.pk/gazette.pdf', 'FPSC', 'gazette.pdf');
    assert.strictEqual(jobs.length, 1);
    assert.strictEqual(jobs[0].title, 'LECTURER (MATHEMATICS) (BPS-17)');
    assert.strictEqual(jobs[0].govtScale, 'BPS-17');
    assert.strictEqual(jobs[0].pdfTotalVacanciesInCase, 5);
    assert.strictEqual(jobs[0].status, 'Pending', 'Status must remain Pending');
  });

  await runTest('STEP-8.2-A Case 8 [Unit]: Scanned PDF fallback diagnostics remain correct', async () => {
    // When text extracted from PDF is minimal (< 50 chars), it qualifies as scanned document
    const minimalText = 'Scan 001 Page 1';
    assert.ok(minimalText.length < 50, 'Text under 50 chars correctly triggers scanned PDF OCR fallback');

    // Verify OCR diagnostics when Gemini API key is missing
    const savedKey = process.env.GEMINI_API_KEY;
    try {
      delete process.env.GEMINI_API_KEY;
      const pngBinary = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
      const res = await extractJobsFromImageWithOcr(pngBinary, 'image/png', 'https://example.com/scanned.png');
      assert.strictEqual(res.diagnosticCode, 'OCR_KEY_MISSING');
      assert.strictEqual(res.jobs.length, 0);
      assert.ok(res.diagnosticMessage.includes('Gemini Vision API key is not configured'));
    } finally {
      if (savedKey) process.env.GEMINI_API_KEY = savedKey;
    }
  });

  await runTest('STEP-8.2-A Case 9 [Mocked]: Actual oversized parser response is rejected', async () => {
    // Mock global fetch to return an HTTP 200 response with Content-Length > 15 MB
    const originalFetch = globalThis.fetch;
    try {
      // @ts-ignore
      globalThis.fetch = async () => {
        return new Response(Buffer.alloc(1024), {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Length': String(16 * 1024 * 1024) // 16 MB
          }
        });
      };

      const result = await parsePdfFromUrl('https://example.com/oversized_document.pdf');
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.diagnosticCode, 'OVERSIZED_DOCUMENT');
      assert.ok(result.message.includes('15 MB'), 'Error message must specify 15 MB limit');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  await runTest('STEP-8.2-A Case 10 [Unit]: Actual OCR diagnostic sanitization does not expose API keys or URL credentials', () => {
    // Test URL sanitization
    const urlWithKey = 'https://example.com/api/v1/ocr?key=AIzaSyA1234567890abcdef1234567890abcdef&auth=secret_token_12345&version=2';
    const sanitizedUrl = sanitizeUrlForLog(urlWithKey);
    assert.strictEqual(sanitizedUrl.includes('AIzaSyA1234567890abcdef1234567890abcdef'), false, 'API key must not be present in sanitized URL');
    assert.strictEqual(sanitizedUrl.includes('secret_token_12345'), false, 'Auth token must not be present in sanitized URL');
    assert.ok(sanitizedUrl.includes('REDACTED'), 'Redaction tag must be present in sanitized URL');

    // Test URL with basic auth credentials
    const urlWithBasicAuth = 'https://admin:superSecretPassword@example.com/secure/ad.pdf';
    const sanitizedAuthUrl = sanitizeUrlForLog(urlWithBasicAuth);
    assert.strictEqual(sanitizedAuthUrl.includes('superSecretPassword'), false, 'Password must be stripped from URL authority');

    // Test secret string sanitization in error messages
    const errorString = 'Request failed with 400: key=AIzaSyA1234567890abcdef1234567890abcdef and Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';
    const sanitizedError = sanitizeSecretString(errorString);
    assert.strictEqual(sanitizedError.includes('AIzaSyA1234567890abcdef1234567890abcdef'), false);
    assert.strictEqual(sanitizedError.includes('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'), false);
    assert.ok(sanitizedError.includes('[REDACTED_API_KEY]'));
    assert.ok(sanitizedError.includes('[REDACTED_TOKEN]'));
  });

  await runTest('STEP-8.2-A Case 11 [Unit]: Linked-image candidates remain deduplicated and capped at 3', () => {
    // HTML containing 6 candidate recruitment images, with 2 duplicate references
    const htmlWithManyCandidates = `
      <html>
        <body>
          <img src="/media/advertisements/recruitment_ad_1.jpg" alt="Federal Recruitment Ad 1" />
          <img src="/media/advertisements/recruitment_ad_2.jpg" alt="Federal Recruitment Ad 2" />
          <img src="/media/advertisements/recruitment_ad_1.jpg" alt="Federal Recruitment Ad 1 Duplicate" />
          <img src="/media/advertisements/recruitment_ad_3.jpg" alt="Federal Recruitment Ad 3" />
          <img src="/media/advertisements/recruitment_ad_4.jpg" alt="Federal Recruitment Ad 4" />
          <img src="/media/advertisements/recruitment_ad_5.jpg" alt="Federal Recruitment Ad 5" />
        </body>
      </html>
    `;

    const candidates = findCandidateRecruitmentImages(htmlWithManyCandidates, 'https://example.com/jobs');
    assert.strictEqual(candidates.length, 3, 'Candidates must be strictly capped at 3');
    const uniqueCandidates = new Set(candidates);
    assert.strictEqual(uniqueCandidates.size, 3, 'Candidates must contain zero duplicates');
    assert.strictEqual(candidates[0], 'https://example.com/media/advertisements/recruitment_ad_1.jpg');
    assert.strictEqual(candidates[1], 'https://example.com/media/advertisements/recruitment_ad_2.jpg');
    assert.strictEqual(candidates[2], 'https://example.com/media/advertisements/recruitment_ad_3.jpg');
  });

  await runTest('STEP-8.2-A Case 12 [Unit]: SSRF-blocked candidates are never fetched', () => {
    // HTML with candidate images on loopback, cloud metadata, and internal subnets
    const htmlWithSsrfTargets = `
      <html>
        <body>
          <img src="http://127.0.0.1/recruitment_ad.jpg" alt="Federal Recruitment Ad" />
          <img src="http://169.254.169.254/latest/meta-data/ad.jpg" alt="Federal Recruitment Ad" />
          <img src="http://10.0.0.1/intranet/recruitment_ad.jpg" alt="Federal Recruitment Ad" />
          <img src="http://192.168.1.1/router/recruitment_ad.jpg" alt="Federal Recruitment Ad" />
        </body>
      </html>
    `;

    const candidates = findCandidateRecruitmentImages(htmlWithSsrfTargets, 'http://127.0.0.1/jobs');
    assert.strictEqual(candidates.length, 0, 'SSRF-blocked URLs must never be added to candidates');
  });

  await runTest('STEP-8.2-A Case 13 [Unit]: Valid same-origin recruitment images remain eligible', () => {
    // 1. Same-origin URL is safe
    const sameOriginSafe = isSafeMediaOrigin('https://fpsc.gov.pk/media/ad.jpg', 'https://fpsc.gov.pk/jobs');
    assert.strictEqual(sameOriginSafe, true, 'Same-origin media URL must be safe');

    // 2. Same apex official CDN domain is safe
    const cdnSafe = isSafeMediaOrigin('https://cdn.fpsc.gov.pk/media/ad.jpg', 'https://fpsc.gov.pk/jobs');
    assert.strictEqual(cdnSafe, true, 'Official CDN sharing apex domain must be safe');

    // 3. Unrelated third-party domain is rejected
    const thirdPartyRejected = isSafeMediaOrigin('https://untrusted-ad-network.com/banner.jpg', 'https://fpsc.gov.pk/jobs');
    assert.strictEqual(thirdPartyRejected, false, 'Arbitrary third-party domain must be rejected');
  });

  await runTest('STEP-8.2-A Case 14 [Unit]: Decorative/logo/tracking images remain excluded', () => {
    const htmlWithDecorativeAssets = `
      <html>
        <body>
          <img src="/images/site-logo.png" alt="Company Logo" width="180" height="50" />
          <img src="/icons/facebook-icon.png" alt="Facebook Share" width="32" height="32" />
          <img src="/icons/twitter-icon.png" alt="Twitter Share" width="32" height="32" />
          <img src="/assets/header-background.jpg" alt="Header Background" />
          <img src="/analytics/tracker.png" alt="Tracking Pixel" width="1" height="1" />
          <img src="/avatars/user-default.jpg" alt="User Avatar" />
          <img src="/ui/nav-button.png" alt="Navigation Button" />
        </body>
      </html>
    `;

    const candidates = findCandidateRecruitmentImages(htmlWithDecorativeAssets, 'https://example.com');
    assert.strictEqual(candidates.length, 0, 'Decorative, logo, and tracking assets must be completely excluded');
  });

  await runTest('STEP-8.2-A Case 15 [Unit]: No synthetic jobs are created', () => {
    // 1. Empty string yields 0 jobs
    const emptyJobs = extractJobsFromPdfText('', 'https://example.com/empty.pdf');
    assert.strictEqual(emptyJobs.length, 0, 'Empty document must produce 0 jobs');

    // 2. Marketing or non-recruitment copy yields 0 jobs
    const marketingCopy = `
      Welcome to our annual corporate summit! Join us in exploring the future of technology,
      cloud computing, and innovation. Discover new products, register for workshops, and
      network with global industry leaders.
    `;
    const nonRecruitmentJobs = extractJobsFromPdfText(marketingCopy, 'https://example.com/summit.pdf');
    assert.strictEqual(nonRecruitmentJobs.length, 0, 'Non-recruitment text must never produce synthetic jobs');
  });

  await runTest('STEP-8.2-A Case 16 [Unit]: Existing scraper approval, duplicate detection and job-review behavior remain unchanged', () => {
    const existingJobs = [
      { id: 'job-1', title: 'Lecturer Mathematics', company: 'FPSC', sourceUrl: 'https://fpsc.gov.pk/ad.pdf' },
      { id: 'job-2', title: 'Assistant Director', company: 'FPSC', sourceUrl: 'https://fpsc.gov.pk/ad.pdf' }
    ];

    const incomingJobs = [
      { id: 'job-1-dup', title: 'Lecturer Mathematics', company: 'FPSC', sourceUrl: 'https://fpsc.gov.pk/ad.pdf' },
      { id: 'job-3-new', title: 'Statistical Officer', company: 'FPSC', sourceUrl: 'https://fpsc.gov.pk/ad.pdf' }
    ];

    const deduplicated = deduplicateJobs(existingJobs, incomingJobs);
    assert.strictEqual(deduplicated.length, 1, 'Only non-duplicate incoming jobs should survive deduplication');
    assert.strictEqual(deduplicated[0].title, 'Statistical Officer');
    assert.strictEqual(existingJobs.length, 2, 'Existing jobs list must remain untouched');
  });

  // ============================================================================
  // STEP-8.2-C MEDIA ORIGIN SECURITY & JOB CLASSIFICATION PRECISION TESTS
  // ============================================================================

  await runTest('STEP-8.2-C Case 1 [Unit]: isSafeMediaOrigin strict origin, explicit CDN allowlist, boundary matching, and downgrade/tenant protections', () => {
    // 1. Same-origin media is allowed
    assert.strictEqual(
      isSafeMediaOrigin('https://fpsc.gov.pk/media/ad.jpg', 'https://fpsc.gov.pk/jobs'),
      true,
      'Same-origin media URL must be eligible'
    );

    // 2. Explicitly allowlisted official CDN hostname is allowed
    assert.strictEqual(
      isSafeMediaOrigin('https://cdn.fpsc.gov.pk/ads/ad.jpg', 'https://fpsc.gov.pk/jobs'),
      true,
      'Explicitly allowlisted gov CDN hostname must be allowed'
    );

    // 3. Dynamic cdn.<arbitrary-gov-domain> NOT in explicit allowlist must be rejected
    assert.strictEqual(
      isSafeMediaOrigin('https://cdn.arbitrary-dept.gov.pk/ads/ad.jpg', 'https://arbitrary-dept.gov.pk/jobs'),
      false,
      'Non-allowlisted dynamic cdn.<host> must be rejected'
    );

    // 4. Unapproved sibling subdomain / unrelated domain is rejected
    assert.strictEqual(
      isSafeMediaOrigin('https://evil.fpsc.gov.pk/ad.jpg', 'https://fpsc.gov.pk/jobs'),
      false,
      'Unapproved sibling subdomain must be rejected'
    );

    // 5. Public-suffix and multi-tenant hosting collisions (pages.dev, blogspot.com, github.io) must be rejected
    assert.strictEqual(
      isSafeMediaOrigin('https://attacker.pages.dev/ad.jpg', 'https://legit.pages.dev/jobs'),
      false,
      'Multi-tenant pages.dev collision must be rejected'
    );
    assert.strictEqual(
      isSafeMediaOrigin('https://attacker.blogspot.com/ad.jpg', 'https://victim.blogspot.com/jobs'),
      false,
      'Multi-tenant blogspot.com collision must be rejected'
    );
    assert.strictEqual(
      isSafeMediaOrigin('https://attacker.github.io/ad.jpg', 'https://victim.github.io/jobs'),
      false,
      'Multi-tenant github.io collision must be rejected'
    );

    // 6. HTTP downgrade from an HTTPS source must be rejected
    assert.strictEqual(
      isSafeMediaOrigin('http://fpsc.gov.pk/ad.jpg', 'https://fpsc.gov.pk/jobs'),
      false,
      'HTTP downgrade from HTTPS source must be rejected'
    );

    // 7. Unapproved port changes must be rejected
    assert.strictEqual(
      isSafeMediaOrigin('https://fpsc.gov.pk:8443/ad.jpg', 'https://fpsc.gov.pk/jobs'),
      false,
      'Unapproved port change must be rejected'
    );

    // 8. Lookalike hostnames must be rejected
    assert.strictEqual(
      isSafeMediaOrigin('https://fpsc.gov.pk.evil.com/ad.jpg', 'https://fpsc.gov.pk/jobs'),
      false,
      'Lookalike hostname must be rejected'
    );
  });

  await runTest('STEP-8.2-D Case 1b [Unit]: Direct validateSafeScrapeUrl SSRF validation on loopback, private IP, metadata, and public HTTPS URLs', () => {
    assert.strictEqual(validateSafeScrapeUrl('http://127.0.0.1/ad.jpg').safe, false, 'Loopback IPv4 must fail SSRF check');
    assert.strictEqual(validateSafeScrapeUrl('https://localhost/ad.jpg').safe, false, 'localhost must fail SSRF check');
    assert.strictEqual(validateSafeScrapeUrl('http://10.0.0.5/ad.jpg').safe, false, 'RFC1918 10.0.0.0/8 must fail SSRF check');
    assert.strictEqual(validateSafeScrapeUrl('http://192.168.1.10/ad.jpg').safe, false, 'RFC1918 192.168.0.0/16 must fail SSRF check');
    assert.strictEqual(validateSafeScrapeUrl('http://172.16.0.1/ad.jpg').safe, false, 'RFC1918 172.16.0.0/12 must fail SSRF check');
    assert.strictEqual(validateSafeScrapeUrl('http://169.254.169.254/latest/meta-data/').safe, false, 'Cloud metadata IP must fail SSRF check');
    assert.strictEqual(validateSafeScrapeUrl('http://0.0.0.0/ad.jpg').safe, false, '0.0.0.0 must fail SSRF check');
    assert.strictEqual(validateSafeScrapeUrl('http://metadata.google.internal/computeMetadata/v1/').safe, false, 'Internal metadata host must fail SSRF check');
    assert.strictEqual(validateSafeScrapeUrl('file:///etc/passwd').safe, false, 'file:// protocol must fail SSRF check');
    assert.strictEqual(validateSafeScrapeUrl('https://fpsc.gov.pk/media/ad.jpg').safe, true, 'Public HTTPS URL must pass SSRF check');
  });

  await runTest('STEP-8.2-C Case 2 [Unit]: Job-specific government classification isolation via classifyExtractedJobEvidence', () => {
    const rawJobs = [
      {
        title: 'LECTURER (MATHEMATICS) (BPS-17)',
        company: 'Federal Public Service Commission',
        description: 'Federal government post under BPS-17 scale.'
      },
      {
        title: 'SOFTWARE ENGINEER',
        company: 'Private Tech Solutions Ltd',
        description: 'Commercial software development role in private sector.'
      },
      {
        title: 'CLERICAL ASSISTANT',
        company: 'Public Department',
        description: 'General clerical duties and office administration.'
      }
    ];

    const mappedJobs = rawJobs.map((rj, idx) => {
      const classification = classifyExtractedJobEvidence(rj);
      return {
        id: `ocr-test-${idx}`,
        title: rj.title,
        company: rj.company,
        ...classification
      };
    });

    assert.strictEqual(mappedJobs.length, 3);

    // Job 1: Genuine Federal Government Job
    assert.strictEqual(mappedJobs[0].isGovtJob, true);
    assert.strictEqual(mappedJobs[0].govtScale, 'BPS-17');
    assert.strictEqual(mappedJobs[0].govtCategory, 'Federal');
    assert.strictEqual(mappedJobs[0].resolvedProvince, 'Federal');
    assert.strictEqual(mappedJobs[0].jobCategory, 'Government Sector');

    // Job 2: Unrelated Private Job (must remain unknown / undefined for government flags)
    assert.strictEqual(mappedJobs[1].isGovtJob, undefined, 'Private job must not be marked as government');
    assert.strictEqual(mappedJobs[1].govtScale, undefined);
    assert.strictEqual(mappedJobs[1].govtCategory, undefined);
    assert.strictEqual(mappedJobs[1].resolvedProvince, undefined);
    assert.strictEqual(mappedJobs[1].jobCategory, undefined);

    // Job 3: Government job without enough evidence for Federal/Provincial classification
    assert.strictEqual(mappedJobs[2].isGovtJob, true);
    assert.strictEqual(mappedJobs[2].govtCategory, undefined, 'Unspecified jurisdiction must not be forced to Federal');
    assert.strictEqual(mappedJobs[2].resolvedProvince, undefined);
  });

  await runTest('STEP-8.2-C Case 3 [Unit]: Actual mapLinkedImageOcrJobs production helper enforces Pending status for autoApprove=true and autoApprove=false', () => {
    const extracted = [
      {
        id: 'ocr-linked-1',
        title: 'Junior Clerk (BPS-11)',
        company: 'Provincial Department'
      }
    ];

    const withAutoApproveTrue = mapLinkedImageOcrJobs(
      extracted,
      { name: 'Official Portal', autoApprove: true },
      'https://fpsc.gov.pk/jobs',
      'https://fpsc.gov.pk/ads/clerk.jpg'
    );

    const withAutoApproveFalse = mapLinkedImageOcrJobs(
      extracted,
      { name: 'Official Portal', autoApprove: false },
      'https://fpsc.gov.pk/jobs',
      'https://fpsc.gov.pk/ads/clerk.jpg'
    );

    assert.strictEqual(withAutoApproveTrue.length, 1);
    assert.strictEqual(withAutoApproveTrue[0].status, 'Pending', 'Production mapper must enforce Pending when autoApprove=true');
    assert.strictEqual(withAutoApproveTrue[0].extractionMethod, 'linked_image_ocr');

    assert.strictEqual(withAutoApproveFalse.length, 1);
    assert.strictEqual(withAutoApproveFalse[0].status, 'Pending', 'Production mapper must enforce Pending when autoApprove=false');
    assert.strictEqual(withAutoApproveFalse[0].extractionMethod, 'linked_image_ocr');
  });

  // ============================================================================
  // STEP-8.3 ADAPTER FAILURE VISIBILITY & DISCOVERED PAGINATION URL TESTS
  // ============================================================================

  await runTest('STEP-8.3 Case 1 [Mocked]: API adapters treat valid empty arrays as legitimate zero-job success across Greenhouse, Lever, SmartRecruiters, and Ashby', async () => {
    const emptyFetch = async (url: string) => ({
      ok: true,
      status: 200,
      json: async () => {
        if (url.includes('boards-api.greenhouse.io')) return { jobs: [] };
        if (url.includes('api.lever.co')) return [];
        if (url.includes('api.smartrecruiters.com')) return { content: [] };
        if (url.includes('api.ashbyhq.com')) return { jobs: [] };
        return {};
      }
    }) as any;

    const gh = await scrapeGreenhouseApi({ id: 'gh1', name: 'GH Co', url: 'https://boards.greenhouse.io/acme' }, {}, emptyFetch);
    assert.strictEqual(gh?.status, 'empty');
    assert.strictEqual(gh?.jobs.length, 0);
    assert.strictEqual(gh?.failureCategory, undefined);

    const lever = await scrapeLeverApi({ id: 'lv1', name: 'Lever Co', url: 'https://jobs.lever.co/acme' }, {}, emptyFetch);
    assert.strictEqual(lever?.status, 'empty');
    assert.strictEqual(lever?.jobs.length, 0);
    assert.strictEqual(lever?.failureCategory, undefined);

    const sr = await scrapeRestJobApis({ id: 'sr1', name: 'SR Co', url: 'https://careers.smartrecruiters.com/acme' }, {}, emptyFetch);
    assert.strictEqual(sr?.status, 'empty');
    assert.strictEqual(sr?.adapterName, 'SmartRecruiters');
    assert.strictEqual(sr?.jobs.length, 0);

    const ashby = await scrapeRestJobApis({ id: 'ab1', name: 'Ashby Co', url: 'https://jobs.ashbyhq.com/acme' }, {}, emptyFetch);
    assert.strictEqual(ashby?.status, 'empty');
    assert.strictEqual(ashby?.adapterName, 'Ashby');
    assert.strictEqual(ashby?.jobs.length, 0);

    const targetEmpty = await scrapeTargetPortal({ id: 'gh2', name: 'GH Empty', url: 'https://boards.greenhouse.io/emptyco' }, {}, emptyFetch);
    assert.deepStrictEqual(targetEmpty, [], 'Valid empty API response must resolve to empty array without error');
  });

  await runTest('STEP-8.3 Case 2 [Mocked]: HTTP, network, JSON parse, and malformed structure failures return distinct diagnostics instead of silent empty results', async () => {
    const http503Fetch = async () => ({ ok: false, status: 503, json: async () => ({}) }) as any;
    const ghHttp = await scrapeGreenhouseApi({ id: 'gh-err', name: 'GH Fail', url: 'https://boards.greenhouse.io/failco' }, {}, http503Fetch);
    assert.strictEqual(ghHttp?.status, 'error');
    assert.strictEqual(ghHttp?.failureCategory, 'http_error');
    assert.strictEqual(ghHttp?.httpStatus, 503);
    assert.strictEqual(ghHttp?.diagnostic?.includes('Greenhouse'), true);
    assert.strictEqual(ghHttp?.diagnostic?.includes('503'), true);

    const networkErrFetch = async () => { throw new Error('ECONNRESET socket hang up'); };
    const leverNet = await scrapeLeverApi({ id: 'lv-net', name: 'Lever Net', url: 'https://jobs.lever.co/failco' }, {}, networkErrFetch);
    assert.strictEqual(leverNet?.status, 'error');
    assert.strictEqual(leverNet?.failureCategory, 'network_error');
    assert.strictEqual(leverNet?.diagnostic?.includes('Lever'), true);

    const badJsonFetch = async () => ({
      ok: true,
      status: 200,
      json: async () => { throw new SyntaxError('Unexpected token < in JSON'); }
    }) as any;
    const srJson = await scrapeRestJobApis({ id: 'sr-json', name: 'SR Json', url: 'https://careers.smartrecruiters.com/failco' }, {}, badJsonFetch);
    assert.strictEqual(srJson?.status, 'error');
    assert.strictEqual(srJson?.adapterName, 'SmartRecruiters');
    assert.strictEqual(srJson?.failureCategory, 'json_parse_error');
    assert.strictEqual(srJson?.diagnostic?.includes('SmartRecruiters'), true);

    const invalidShapeFetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ status: 'ok', message: 'not an array' })
    }) as any;
    const ashbyShape = await scrapeRestJobApis({ id: 'ab-shape', name: 'Ashby Shape', url: 'https://jobs.ashbyhq.com/failco' }, {}, invalidShapeFetch);
    assert.strictEqual(ashbyShape?.status, 'error');
    assert.strictEqual(ashbyShape?.adapterName, 'Ashby');
    assert.strictEqual(ashbyShape?.failureCategory, 'invalid_response');
    assert.strictEqual(ashbyShape?.diagnostic?.includes('Ashby'), true);
  });

  await runTest('STEP-8.3 Case 3 [Mocked]: Adapter failures sanitize secrets and preserve existing HTML fallback (and surface error if fallback also yields 0 jobs)', async () => {
    const secretErrFetch = async () => {
      throw new Error('Request failed Authorization Bearer super_secret_bearer_999 for token=SECRET_PARAM_XYZ');
    };
    const secretDiag = await scrapeGreenhouseApi(
      { id: 'gh-sec', name: 'GH Secret', url: 'https://boards.greenhouse.io/acme?api_key=MY_API_KEY_123&token=SECRET_TOKEN_ABC' },
      {},
      secretErrFetch
    );
    assert.strictEqual(secretDiag?.status, 'error');
    assert.strictEqual(secretDiag?.diagnostic?.includes('MY_API_KEY_123'), false, 'Diagnostic must redact api_key');
    assert.strictEqual(secretDiag?.diagnostic?.includes('SECRET_TOKEN_ABC'), false, 'Diagnostic must redact token query param');
    assert.strictEqual(secretDiag?.diagnostic?.includes('super_secret_bearer_999'), false, 'Diagnostic must redact bearer token');
    assert.strictEqual(secretDiag?.diagnostic?.includes('SECRET_PARAM_XYZ'), false, 'Diagnostic must redact inline secret param');

    // HTML fallback succeeds when Greenhouse API fails with HTTP 502 and portal HTML contains jobs
    const fallbackSuccessFetch = async (url: string) => {
      if (url.includes('boards-api.greenhouse.io')) {
        return { ok: false, status: 502, json: async () => ({}) } as any;
      }
      return {
        ok: true,
        status: 200,
        url,
        headers: new Map([['content-type', 'text/html']]),
        text: async () => `
          <html><body>
            <div class="job-card">
              <h2 class="job-title"><a href="/jobs/101">Senior Backend Engineer</a></h2>
              <span class="location">Lahore, Pakistan</span>
            </div>
          </body></html>
        `
      } as any;
    };
    const recoveredJobs = await scrapeTargetPortal(
      { id: 'gh-fb', name: 'GH Portal', url: 'https://boards.greenhouse.io/fallbackco' },
      {},
      fallbackSuccessFetch
    );
    assert.strictEqual(recoveredJobs.length, 1, 'Existing HTML fallback must recover jobs after API failure');
    assert.strictEqual(recoveredJobs[0].title, 'Senior Backend Engineer');
    assert.strictEqual(recoveredJobs[0].extractionMethod, 'html_cheerio');

    // Empty HTML after API failure must throw the API failure instead of returning silent empty []
    const fallbackEmptyFetch = async (url: string) => {
      if (url.includes('api.lever.co')) {
        return { ok: false, status: 503, json: async () => ({}) } as any;
      }
      return {
        ok: true,
        status: 200,
        url,
        headers: new Map([['content-type', 'text/html']]),
        text: async () => '<html><body><div>No jobs shell</div></body></html>'
      } as any;
    };
    let threwOnEmptyFallback = false;
    try {
      await scrapeTargetPortal(
        { id: 'lv-empty-fb', name: 'Lever Fail', url: 'https://jobs.lever.co/broken' },
        {},
        fallbackEmptyFetch
      );
    } catch (err: any) {
      threwOnEmptyFallback = true;
      assert.strictEqual(err.status, 503);
      assert.strictEqual(String(err.message).includes('Lever'), true);
    }
    assert.strictEqual(threwOnEmptyFallback, true, 'API failure must not be hidden when HTML fallback extracts 0 jobs');
  });

  await runTest('STEP-8.3 Case 4 [Unit]: crawlPortalPages actually follows discovered nextPageUrl (with optional www), preserves config.url, and supports numeric fallback', async () => {
    const requestedUrls: Array<{ page?: number; targetPageUrl?: string }> = [];
    const portalConfig = {
      id: 'pag-1',
      name: 'Official Careers',
      url: 'https://careers.example.pk/openings'
    };

    const nextLinkCrawl = await crawlPortalPages(
      portalConfig,
      { mode: 'complete' },
      undefined,
      'RUN-TEST-1',
      async (_cfg, opts) => {
        requestedUrls.push({ page: opts.page, targetPageUrl: opts.targetPageUrl });
        if (opts.page === 1) {
          return [{
            id: 'j1',
            title: 'Job Page 1',
            company: 'Official',
            jobType: 'On-site',
            region: 'Pakistan',
            salary: 'PKR 100k',
            currency: 'PKR',
            experienceLevel: 'Mid',
            department: 'IT',
            tags: [],
            description: 'desc',
            requirements: [],
            benefits: [],
            postedAt: 'Today',
            applicationsCount: 0,
            status: 'Pending',
            sourceUrl: 'https://careers.example.pk/openings',
            extractionMethod: 'html_cheerio',
            nextPageUrl: 'https://www.careers.example.pk/openings/cursor?token=batch2'
          }];
        }
        return [{
          id: 'j2',
          title: 'Job Page 2',
          company: 'Official',
          jobType: 'On-site',
          region: 'Pakistan',
          salary: 'PKR 120k',
          currency: 'PKR',
          experienceLevel: 'Senior',
          department: 'IT',
          tags: [],
          description: 'desc',
          requirements: [],
          benefits: [],
          postedAt: 'Today',
          applicationsCount: 0,
          status: 'Pending',
          sourceUrl: 'https://www.careers.example.pk/openings/cursor?token=batch2',
          extractionMethod: 'html_cheerio'
        }];
      }
    );

    assert.strictEqual(requestedUrls.length, 2);
    assert.strictEqual(requestedUrls[0].targetPageUrl, undefined);
    assert.strictEqual(requestedUrls[1].targetPageUrl, 'https://www.careers.example.pk/openings/cursor?token=batch2', 'Engine must pass actual discovered nextPageUrl');
    assert.strictEqual(portalConfig.url, 'https://careers.example.pk/openings', 'Original portal config.url must never be overwritten');
    assert.strictEqual(nextLinkCrawl.rawResults.length, 2);
    assert.strictEqual(nextLinkCrawl.paginationDiagnostic, undefined);

    // Numeric fallback still works when no nextPageUrl exists and page 1 returns >= 10 jobs
    const numericCalls: Array<{ page?: number; targetPageUrl?: string }> = [];
    const tenJobs = Array.from({ length: 10 }, (_, idx) => ({
      id: `n-${idx}`,
      title: `Numeric Job ${idx}`,
      company: 'Official',
      jobType: 'On-site' as const,
      region: 'Pakistan' as const,
      salary: 'Salary not disclosed',
      currency: 'PKR' as const,
      experienceLevel: 'Mid' as const,
      department: 'IT',
      tags: [],
      description: 'desc',
      requirements: [],
      benefits: [],
      postedAt: 'Today',
      applicationsCount: 0,
      status: 'Pending' as const,
      sourceUrl: 'https://careers.example.pk/openings',
      extractionMethod: 'html_cheerio'
    }));

    const numericCrawl = await crawlPortalPages(
      portalConfig,
      { mode: 'complete' },
      undefined,
      'RUN-NUM',
      async (_cfg, opts) => {
        numericCalls.push({ page: opts.page, targetPageUrl: opts.targetPageUrl });
        return opts.page === 1 ? tenJobs : [];
      }
    );

    assert.strictEqual(numericCalls.length, 2);
    assert.strictEqual(numericCalls[1].page, 2);
    assert.strictEqual(numericCalls[1].targetPageUrl, undefined, 'Numeric fallback must use numeric page param without targetPageUrl');
    assert.strictEqual(numericCrawl.rawResults.length, 10);
  });

  await runTest('STEP-8.3 Case 5 [Unit]: Pagination URL validation rejects external hosts, private/metadata SSRF URLs, cycles, and enforces 25-page cap & page_range', async () => {
    const portalBase = 'https://portal.gov.pk/jobs';

    // 1. External host rejected
    const extRes = validateDiscoveredNextPageUrl('https://evil.com/jobs?page=2', portalBase, new Set([canonicalizePaginationUrl(portalBase)]));
    assert.strictEqual(extRes.valid, false, 'External hostname must be rejected');

    // 2. Loopback / private / metadata SSRF URLs rejected
    assert.strictEqual(validateDiscoveredNextPageUrl('http://127.0.0.1/jobs?page=2', portalBase, new Set()).valid, false);
    assert.strictEqual(validateDiscoveredNextPageUrl('http://localhost/jobs?page=2', portalBase, new Set()).valid, false);
    assert.strictEqual(validateDiscoveredNextPageUrl('http://169.254.169.254/latest/meta-data', portalBase, new Set()).valid, false);
    assert.strictEqual(validateDiscoveredNextPageUrl('http://10.0.0.5/jobs?page=2', portalBase, new Set()).valid, false);

    // 3. Cycle stopped safely in crawlPortalPages without making an extra request
    let cycleAttempts = 0;
    const cycleCrawl = await crawlPortalPages(
      { id: 'cyc', name: 'Cycle Portal', url: portalBase },
      { mode: 'complete' },
      undefined,
      'RUN-CYC',
      async (_cfg, opts) => {
        cycleAttempts++;
        return [{
          id: `c-${cycleAttempts}`,
          title: 'Repeated Page Job',
          company: 'Portal',
          jobType: 'On-site',
          region: 'Pakistan',
          salary: 'Salary not disclosed',
          currency: 'PKR',
          experienceLevel: 'Mid',
          department: 'General',
          tags: [],
          description: 'desc',
          requirements: [],
          benefits: [],
          postedAt: 'Today',
          applicationsCount: 0,
          status: 'Pending',
          sourceUrl: portalBase,
          extractionMethod: 'html_cheerio',
          nextPageUrl: opts.page === 1
            ? 'https://portal.gov.pk/jobs?page=2#section'
            : 'https://www.portal.gov.pk/jobs/?page=2'
        }];
      }
    );
    assert.strictEqual(cycleAttempts, 2, 'Cycle detection must stop after page 2 instead of looping back to page 2');
    assert.strictEqual(cycleCrawl.sourcePagesAttempted, 2);
    assert.strictEqual(Boolean(cycleCrawl.paginationDiagnostic && cycleCrawl.paginationDiagnostic.toLowerCase().includes('cycle')), true);

    // 4. External/SSRF nextPageUrl stops chain without fetching the bad URL
    let externalStopAttempts = 0;
    const extStopCrawl = await crawlPortalPages(
      { id: 'ext-stop', name: 'Ext Portal', url: portalBase },
      { mode: 'complete' },
      undefined,
      'RUN-EXT',
      async () => {
        externalStopAttempts++;
        return [{
          id: 'e1',
          title: 'Valid Page 1 Job',
          company: 'Portal',
          jobType: 'On-site',
          region: 'Pakistan',
          salary: 'Salary not disclosed',
          currency: 'PKR',
          experienceLevel: 'Mid',
          department: 'General',
          tags: [],
          description: 'desc',
          requirements: [],
          benefits: [],
          postedAt: 'Today',
          applicationsCount: 0,
          status: 'Pending',
          sourceUrl: portalBase,
          extractionMethod: 'html_cheerio',
          nextPageUrl: 'https://phishing-site.com/jobs?page=2'
        }];
      }
    );
    assert.strictEqual(externalStopAttempts, 1);
    assert.strictEqual(extStopCrawl.sourcePagesSuccessful, 1);
    assert.strictEqual(Boolean(extStopCrawl.paginationDiagnostic && extStopCrawl.paginationDiagnostic.includes('External hostname')), true);

    // 5. 25-page safety cap enforced
    let capAttempts = 0;
    const capCrawl = await crawlPortalPages(
      { id: 'cap', name: 'Cap Portal', url: portalBase },
      { mode: 'complete' },
      undefined,
      'RUN-CAP',
      async (_cfg, opts) => {
        capAttempts++;
        const nextNum = (opts.page || 1) + 1;
        return [{
          id: `cap-${opts.page}`,
          title: `Cap Job ${opts.page}`,
          company: 'Portal',
          jobType: 'On-site',
          region: 'Pakistan',
          salary: 'Salary not disclosed',
          currency: 'PKR',
          experienceLevel: 'Mid',
          department: 'General',
          tags: [],
          description: 'desc',
          requirements: [],
          benefits: [],
          postedAt: 'Today',
          applicationsCount: 0,
          status: 'Pending',
          sourceUrl: portalBase,
          extractionMethod: 'html_cheerio',
          nextPageUrl: `https://portal.gov.pk/jobs?page=${nextNum}`
        }];
      }
    );
    assert.strictEqual(capAttempts, 25, 'Complete pagination must enforce 25-page safety cap');
    assert.strictEqual(capCrawl.hitSafetyLimit, true);

    // 6. page_range mode behavior preserved
    const rangePages: Array<{ page?: number; targetPageUrl?: string }> = [];
    const rangeCrawl = await crawlPortalPages(
      { id: 'rng', name: 'Range Portal', url: portalBase },
      { mode: 'page_range', startPage: 2, endPage: 4 },
      undefined,
      'RUN-RNG',
      async (_cfg, opts) => {
        rangePages.push({ page: opts.page, targetPageUrl: opts.targetPageUrl });
        return [{
          id: `rng-${opts.page}`,
          title: `Range Job ${opts.page}`,
          company: 'Portal',
          jobType: 'On-site',
          region: 'Pakistan',
          salary: 'Salary not disclosed',
          currency: 'PKR',
          experienceLevel: 'Mid',
          department: 'General',
          tags: [],
          description: 'desc',
          requirements: [],
          benefits: [],
          postedAt: 'Today',
          applicationsCount: 0,
          status: 'Pending',
          sourceUrl: portalBase,
          extractionMethod: 'html_cheerio',
          nextPageUrl: 'https://portal.gov.pk/custom-next-ignored-in-page-range'
        }];
      }
    );
    assert.deepStrictEqual(
      rangePages.map(p => p.page),
      [2, 3, 4],
      'page_range mode must crawl explicit start..end pages'
    );
    assert.strictEqual(rangePages.every(p => p.targetPageUrl === undefined), true, 'page_range mode must not switch to complete-mode targetPageUrl');
    assert.strictEqual(rangeCrawl.rawResults.length, 3);
  });

  await runTest('STEP-8.3-A [Unit]: evaluateCheckpointEligibility rejects incomplete pagination diagnostics from crawlPortalPages', async () => {
    const basePortal = 'https://portal.gov.pk/jobs';
    const makeJob = (id: string, title: string, nextPageUrl?: string) => ({
      id,
      title,
      company: 'Portal',
      jobType: 'On-site' as const,
      region: 'Pakistan' as const,
      salary: 'Salary not disclosed',
      currency: 'PKR' as const,
      experienceLevel: 'Mid' as const,
      department: 'General',
      tags: [] as string[],
      description: 'Valid vacancy description for testing',
      requirements: [] as string[],
      benefits: [] as string[],
      postedAt: 'Today',
      applicationsCount: 0,
      status: 'Pending' as const,
      sourceUrl: basePortal,
      extractionMethod: 'html_cheerio' as const,
      nextPageUrl
    });

    // 1. Page 1 returns valid jobs, then unsafe/external nextPageUrl stops pagination
    const externalStopCrawl = await crawlPortalPages(
      { id: 'ckpt-ext', name: 'External Stop Portal', url: basePortal },
      { mode: 'complete' },
      undefined,
      'RUN-83A-EXT',
      async () => [makeJob('ext-1', 'Civil Engineer', 'https://attacker.example.com/jobs?page=2')]
    );
    assert.strictEqual(externalStopCrawl.rawResults.length, 1, 'Page 1 valid job must remain preserved');
    assert.strictEqual(externalStopCrawl.sourcePagesAttempted, 1);
    assert.strictEqual(externalStopCrawl.sourcePagesSuccessful, 1);
    assert.strictEqual(externalStopCrawl.hitSafetyLimit, false);
    assert.strictEqual(typeof externalStopCrawl.paginationDiagnostic, 'string');
    assert.strictEqual(
      externalStopCrawl.paginationDiagnostic!.toLowerCase().includes('external'),
      true,
      'External nextPageUrl must surface a paginationDiagnostic'
    );
    assert.strictEqual(
      evaluateCheckpointEligibility({
        mode: 'complete',
        hasNoPageErrors: !externalStopCrawl.lastPageError && externalStopCrawl.sourcePagesAttempted === externalStopCrawl.sourcePagesSuccessful,
        hitSafetyLimit: externalStopCrawl.hitSafetyLimit,
        paginationDiagnostic: externalStopCrawl.paginationDiagnostic,
        isDetectionSuccessful: true,
        hasUnsavedRequiredVacancies: false
      }),
      false,
      'Non-empty paginationDiagnostic (external/unsafe nextPageUrl) must block checkpoint advancement'
    );

    // 2. Page 1 returns valid jobs, then SSRF/loopback nextPageUrl stops pagination
    const ssrfStopCrawl = await crawlPortalPages(
      { id: 'ckpt-ssrf', name: 'SSRF Stop Portal', url: basePortal },
      { mode: 'complete' },
      undefined,
      'RUN-83A-SSRF',
      async () => [makeJob('ssrf-1', 'Data Analyst', 'http://127.0.0.1:8080/internal')]
    );
    assert.strictEqual(ssrfStopCrawl.rawResults.length, 1);
    assert.ok(ssrfStopCrawl.paginationDiagnostic, 'SSRF/loopback nextPageUrl must produce paginationDiagnostic');
    assert.strictEqual(
      evaluateCheckpointEligibility({
        mode: 'complete',
        hasNoPageErrors: !ssrfStopCrawl.lastPageError && ssrfStopCrawl.sourcePagesAttempted === ssrfStopCrawl.sourcePagesSuccessful,
        hitSafetyLimit: ssrfStopCrawl.hitSafetyLimit,
        paginationDiagnostic: ssrfStopCrawl.paginationDiagnostic,
        isDetectionSuccessful: true,
        hasUnsavedRequiredVacancies: false
      }),
      false,
      'SSRF paginationDiagnostic must block checkpoint advancement'
    );

    // 3. Discovered nextPageUrl cycle / repeated URL after multi-page crawl blocks checkpoint
    const cyclicCrawl = await crawlPortalPages(
      { id: 'ckpt-cyc', name: 'Cyclic Portal', url: basePortal },
      { mode: 'complete' },
      undefined,
      'RUN-83A-CYC',
      async (_cfg, opts) => {
        if (opts.page === 1) {
          return [makeJob('cyc-1', 'Accountant', 'https://portal.gov.pk/jobs?page=2')];
        }
        return [makeJob('cyc-2', 'Auditor', 'https://portal.gov.pk/jobs')];
      }
    );
    assert.strictEqual(cyclicCrawl.rawResults.length, 2, 'Jobs crawled before cycle detection must remain preserved');
    assert.ok(
      cyclicCrawl.paginationDiagnostic?.toLowerCase().includes('cycle'),
      'Discovered nextPageUrl cycle must produce paginationDiagnostic'
    );
    assert.strictEqual(
      evaluateCheckpointEligibility({
        mode: 'complete',
        hasNoPageErrors: !cyclicCrawl.lastPageError && cyclicCrawl.sourcePagesAttempted === cyclicCrawl.sourcePagesSuccessful,
        hitSafetyLimit: cyclicCrawl.hitSafetyLimit,
        paginationDiagnostic: cyclicCrawl.paginationDiagnostic,
        isDetectionSuccessful: true,
        hasUnsavedRequiredVacancies: false
      }),
      false,
      'Discovered URL cycle paginationDiagnostic must block checkpoint advancement'
    );

    // 4. Numeric pagination cycle blocks checkpoint advancement
    const numericCyclePortal = 'https://portal.gov.pk/jobs?page=2';
    const numericCycleCrawl = await crawlPortalPages(
      { id: 'ckpt-num', name: 'Numeric Cycle Portal', url: numericCyclePortal },
      { mode: 'complete' },
      undefined,
      'RUN-83A-NUM',
      async () => Array.from({ length: 10 }, (_, idx) => makeJob(`num-${idx}`, `Officer ${idx}`))
    );
    assert.strictEqual(numericCycleCrawl.rawResults.length, 10);
    assert.ok(
      numericCycleCrawl.paginationDiagnostic?.toLowerCase().includes('numeric page 2'),
      `Expected numeric pagination cycle diagnostic, got: ${numericCycleCrawl.paginationDiagnostic}`
    );
    assert.strictEqual(
      evaluateCheckpointEligibility({
        mode: 'complete',
        hasNoPageErrors: !numericCycleCrawl.lastPageError && numericCycleCrawl.sourcePagesAttempted === numericCycleCrawl.sourcePagesSuccessful,
        hitSafetyLimit: numericCycleCrawl.hitSafetyLimit,
        paginationDiagnostic: numericCycleCrawl.paginationDiagnostic,
        isDetectionSuccessful: true,
        hasUnsavedRequiredVacancies: false
      }),
      false,
      'Numeric pagination cycle diagnostic must block checkpoint advancement'
    );

    // 5. Genuine natural end of pagination allows checkpoint advancement
    const naturalCrawl = await crawlPortalPages(
      { id: 'ckpt-nat', name: 'Natural End Portal', url: basePortal },
      { mode: 'complete' },
      undefined,
      'RUN-83A-NAT',
      async (_cfg, opts) => {
        if (opts.page === 1) {
          return [makeJob('nat-1', 'Project Manager', 'https://portal.gov.pk/jobs?page=2')];
        }
        return [makeJob('nat-2', 'Operations Lead')];
      }
    );
    assert.strictEqual(naturalCrawl.rawResults.length, 2);
    assert.strictEqual(naturalCrawl.hitSafetyLimit, false);
    assert.strictEqual(naturalCrawl.paginationDiagnostic, undefined);
    assert.strictEqual(
      evaluateCheckpointEligibility({
        mode: 'complete',
        hasNoPageErrors: !naturalCrawl.lastPageError && naturalCrawl.sourcePagesAttempted === naturalCrawl.sourcePagesSuccessful,
        hitSafetyLimit: naturalCrawl.hitSafetyLimit,
        paginationDiagnostic: naturalCrawl.paginationDiagnostic,
        isDetectionSuccessful: true,
        hasUnsavedRequiredVacancies: false
      }),
      true,
      'Clean complete crawl ending naturally without diagnostic must advance checkpoint'
    );

    // 6. Existing checkpoint protections remain intact
    assert.strictEqual(
      evaluateCheckpointEligibility({
        mode: 'complete',
        hasNoPageErrors: true,
        hitSafetyLimit: true,
        paginationDiagnostic: undefined,
        isDetectionSuccessful: true,
        hasUnsavedRequiredVacancies: false
      }),
      false,
      'Safety limit truncation must block checkpoint advancement'
    );
    assert.strictEqual(
      evaluateCheckpointEligibility({
        mode: 'complete',
        hasNoPageErrors: false,
        hitSafetyLimit: false,
        paginationDiagnostic: undefined,
        isDetectionSuccessful: true,
        hasUnsavedRequiredVacancies: false
      }),
      false,
      'Page errors must block checkpoint advancement'
    );
    assert.strictEqual(
      evaluateCheckpointEligibility({
        mode: 'page_range',
        hasNoPageErrors: true,
        hitSafetyLimit: false,
        paginationDiagnostic: undefined,
        isDetectionSuccessful: true,
        hasUnsavedRequiredVacancies: false
      }),
      false,
      'Non-complete modes must block checkpoint advancement'
    );
    assert.strictEqual(
      evaluateCheckpointEligibility({
        mode: 'complete',
        hasNoPageErrors: true,
        hitSafetyLimit: false,
        paginationDiagnostic: undefined,
        isDetectionSuccessful: true,
        hasUnsavedRequiredVacancies: true
      }),
      false,
      'Unsaved required vacancies must block checkpoint advancement'
    );
  });

  await runTest('STEP-8.4-A Case 1 [Unit]: Historical proof rejects arbitrary provenExtractionMethods while preserving genuine proof and unambiguous structural capabilities', () => {
    // 1. Arbitrary provenExtractionMethods without scrapedCount or valid lastSuccessfulScrapeAt
    const tagOnly = {
      id: 'src-84a-1a',
      name: 'Tag Only Portal',
      url: 'https://jobs.gov.pk/listings',
      status: 'Active Scheduled',
      healthStatus: 'Jobs Found',
      scrapedCount: 0,
      hasDetailPageEnrichment: true,
      hasStructuredData: true,
      provenExtractionMethods: ['government_pdf_engine', 'html_cheerio', 'detail', 'json_ld']
    };
    assert.strictEqual(isHistoricallyProven(tagOnly), false);
    assert.deepStrictEqual(getProvenCapabilities(tagOnly), []);
    assert.ok(getConfiguredCapabilities(tagOnly).includes('Detail Page'));
    assert.ok(getConfiguredCapabilities(tagOnly).includes('JSON-LD'));
    assert.strictEqual(deriveSourceClassification(tagOnly).overallStatus, 'Configured / Not Yet Verified');

    // 2. Genuine scrapedCount proves history and unambiguous PDF-only capability (never Detail/JSON-LD from unverified tags)
    const pdfProven = {
      id: 'src-84a-1b',
      name: 'PDF Gazette Portal',
      pdfUrl: 'https://jobs.gov.pk/gazette.pdf',
      formatType: 'PDF Advertisement',
      status: 'Active Scheduled',
      healthStatus: 'Jobs Found',
      scrapedCount: 8,
      hasDetailPageEnrichment: true,
      hasStructuredData: true,
      provenExtractionMethods: ['detail', 'json_ld']
    };
    assert.strictEqual(isHistoricallyProven(pdfProven), true);
    const pdfCaps = getProvenCapabilities(pdfProven);
    assert.strictEqual(pdfCaps.includes('PDF'), true);
    assert.strictEqual(pdfCaps.includes('Detail Page'), false);
    assert.strictEqual(pdfCaps.includes('JSON-LD'), false);

    // 3. Valid lastSuccessfulScrapeAt (with scrapedCount=0) proves history and unambiguous HTML/Portal capability
    const tsProvenHtml = {
      id: 'src-84a-1c',
      name: 'Timestamp Proven HTML Portal',
      url: 'https://careers.gov.pk/openings',
      status: 'Active Scheduled',
      healthStatus: 'No Jobs',
      scrapedCount: 0,
      lastSuccessfulScrapeAt: '2026-11-10T12:00:00.000Z'
    };
    assert.strictEqual(isHistoricallyProven(tsProvenHtml), true);
    const tsCaps = getProvenCapabilities(tsProvenHtml);
    assert.strictEqual(tsCaps.includes('HTML'), true);
    assert.strictEqual(tsCaps.includes('Portal'), true);
    assert.strictEqual(deriveSourceClassification(tsProvenHtml).overallStatus, 'Working');

    // 4. Invalid timestamps do not prove history even with provenExtractionMethods
    for (const badTs of ['', '   ', 'not-a-date', '1970-01-01T00:00:00.000Z']) {
      const invalidTsSrc = {
        id: `src-84a-bad-${badTs}`,
        name: 'Bad Timestamp Source',
        url: 'https://careers.gov.pk/openings',
        status: 'Active Scheduled',
        healthStatus: 'healthy',
        scrapedCount: 0,
        lastSuccessfulScrapeAt: badTs,
        provenExtractionMethods: ['html_cheerio']
      };
      assert.strictEqual(isHistoricallyProven(invalidTsSrc), false);
      assert.deepStrictEqual(getProvenCapabilities(invalidTsSrc), []);
    }
  });

  await runTest('STEP-8.4-A Case 2 [Unit]: Incomplete pagination diagnostics classify proven sources as Partial and clean runs clear diagnostics back to Working', () => {
    const diagnostics = [
      'Pagination cycle detected: repeated next-page URL (https://portal.gov.pk/jobs?page=2)',
      'Pagination cycle detected on numeric page 2',
      'External hostname "evil.example.com" rejected (expected portal host "portal.gov.pk")',
      'SSRF validation rejected next-page URL: Loopback IP address (127.0.0.0/8)',
      'Unsafe protocol "javascript:" rejected for next-page URL',
      'Pagination truncated at safety limit of 25 pages (checkpoint preserved)'
    ];

    for (const diag of diagnostics) {
      assert.strictEqual(hasIncompletePaginationDiagnostic(diag), true, `Expected pagination diagnostic match for: ${diag}`);
      const c = deriveSourceClassification({
        id: 'src-84a-pag',
        name: 'Paginated Portal',
        url: 'https://portal.gov.pk/jobs',
        status: 'Active Scheduled',
        healthStatus: 'Jobs Found',
        scrapedCount: 25,
        lastSuccessfulScrapeAt: '2026-11-10T00:00:00.000Z',
        lastErrorMessage: diag
      });
      assert.strictEqual(c.historicallyProven, true);
      assert.strictEqual(c.overallStatus, 'Partial', `Expected Partial instead of Working for diagnostic: ${diag}`);
    }

    // Engine completion stats preserve Jobs Found with diagnostic on incomplete run, then clear lastErrorMessage on clean run
    const incompleteCompletion = buildSourceCompletionStatsUpdate({
      sourceCompletedAt: '2026-11-18T01:00:00.000Z',
      previousLastSuccessfulScrapeAt: '2026-11-10T00:00:00.000Z',
      runId: 'RUN-84A-INC',
      isCheckpointEligible: false,
      isDetectionSuccessful: true,
      isAllPersistAttemptsFailed: false,
      hasUnsavedRequiredVacancies: false,
      sourceSaveFailures: 0,
      sourceUniqueSaveFailures: 0,
      sourceDupSaveFailures: 0,
      sourcePagesAttempted: 1,
      lastPageError: null,
      paginationDiagnostic: 'External hostname "evil.example.com" rejected (expected portal host "portal.gov.pk")',
      hitSafetyLimit: false,
      maxSafetyPages: 25,
      isCompleteMode: true,
      sourceValid: 5,
      sourceFound: 5,
      sourcePersisted: 5,
      sourceIntentionalSkips: 0
    });
    assert.strictEqual(incompleteCompletion.successHealth, 'Jobs Found');
    assert.strictEqual(
      incompleteCompletion.statsUpdate.lastErrorMessage,
      'External hostname "evil.example.com" rejected (expected portal host "portal.gov.pk")'
    );
    assert.strictEqual(incompleteCompletion.statsUpdate.lastSuccessfulScrapeAt, '2026-11-10T00:00:00.000Z');

    const cleanCompletion = buildSourceCompletionStatsUpdate({
      sourceCompletedAt: '2026-11-18T02:00:00.000Z',
      previousLastSuccessfulScrapeAt: '2026-11-10T00:00:00.000Z',
      runId: 'RUN-84A-CLEAN',
      isCheckpointEligible: true,
      isDetectionSuccessful: true,
      isAllPersistAttemptsFailed: false,
      hasUnsavedRequiredVacancies: false,
      sourceSaveFailures: 0,
      sourceUniqueSaveFailures: 0,
      sourceDupSaveFailures: 0,
      sourcePagesAttempted: 2,
      lastPageError: null,
      paginationDiagnostic: undefined,
      hitSafetyLimit: false,
      maxSafetyPages: 25,
      isCompleteMode: true,
      sourceValid: 12,
      sourceFound: 12,
      sourcePersisted: 12,
      sourceIntentionalSkips: 0
    });
    assert.strictEqual(cleanCompletion.successHealth, 'Jobs Found');
    assert.strictEqual(cleanCompletion.lastErrorNotice, undefined);
    assert.strictEqual(cleanCompletion.statsUpdate.lastErrorMessage, '', 'Clean run must explicitly clear previous diagnostic');
    assert.strictEqual(cleanCompletion.statsUpdate.lastSuccessfulScrapeAt, '2026-11-18T02:00:00.000Z');

    const clearedClassification = deriveSourceClassification({
      id: 'src-84a-pag',
      name: 'Paginated Portal',
      url: 'https://portal.gov.pk/jobs',
      status: 'Active Scheduled',
      healthStatus: cleanCompletion.statsUpdate.healthStatus,
      scrapedCount: 37,
      lastSuccessfulScrapeAt: cleanCompletion.statsUpdate.lastSuccessfulScrapeAt,
      lastErrorMessage: cleanCompletion.statsUpdate.lastErrorMessage
    });
    assert.strictEqual(clearedClassification.overallStatus, 'Working');

    // Unavailable and unverified-source behaviors remain preserved
    assert.strictEqual(
      deriveSourceClassification({
        id: 'src-84a-disabled',
        name: 'Disabled Portal',
        url: 'https://portal.gov.pk/jobs',
        status: 'Disabled',
        healthStatus: 'Jobs Found',
        scrapedCount: 20,
        lastErrorMessage: 'Pagination cycle detected on numeric page 2'
      }).overallStatus,
      'Unavailable'
    );
    assert.strictEqual(
      deriveSourceClassification({
        id: 'src-84a-unverified',
        name: 'Fresh Unverified Portal',
        url: 'https://portal.gov.pk/jobs',
        status: 'Active Scheduled',
        healthStatus: 'healthy',
        scrapedCount: 0,
        lastErrorMessage: ''
      }).overallStatus,
      'Configured / Not Yet Verified'
    );
  });

  await runTest('STEP-8.4-A1 [Mocked]: ScraperRepository.updateSourceStats requires explicit acknowledged=true and matchedCount>0 before mutating cached stats', async () => {
    const configs = await ScraperRepository.getConfigs();
    const testId = 'step-84a-repo-cache-test';
    const baseRecord = {
      id: testId,
      name: 'Cache Integrity Test Portal',
      url: 'https://portal.gov.pk/jobs',
      status: 'Active Scheduled',
      healthStatus: 'healthy',
      scrapedCount: 0,
      lastStartedAt: '2026-11-17T00:00:00.000Z',
      lastCompletedAt: '2026-11-17T00:05:00.000Z',
      lastSuccessfulScrapeAt: undefined as string | undefined,
      lastRunId: 'RUN-BASE',
      lastErrorMessage: 'stale error',
      lastHttpStatus: 200
    };
    const existingIdx = configs.findIndex(s => s.id === testId);
    if (existingIdx !== -1) configs.splice(existingIdx, 1);
    configs.push({ ...baseRecord });

    try {
      const target = () => configs.find(s => s.id === testId)!;
      const assertUnchangedBaseline = (label: string) => {
        const current = target();
        assert.strictEqual(current.scrapedCount, 0, `${label}: scrapedCount must remain unchanged`);
        assert.strictEqual(current.healthStatus, 'healthy', `${label}: healthStatus must remain unchanged`);
        assert.strictEqual(current.lastStartedAt, '2026-11-17T00:00:00.000Z', `${label}: lastStartedAt must remain unchanged`);
        assert.strictEqual(current.lastCompletedAt, '2026-11-17T00:05:00.000Z', `${label}: lastCompletedAt must remain unchanged`);
        assert.strictEqual(current.lastSuccessfulScrapeAt, undefined, `${label}: lastSuccessfulScrapeAt must remain unchanged`);
        assert.strictEqual(current.lastRunId, 'RUN-BASE', `${label}: lastRunId must remain unchanged`);
        assert.strictEqual(current.lastErrorMessage, 'stale error', `${label}: lastErrorMessage must remain unchanged`);
        assert.strictEqual(current.lastHttpStatus, 200, `${label}: lastHttpStatus must remain unchanged`);
      };

      const attemptedStats = {
        lastStartedAt: '2026-11-18T01:00:00.000Z',
        lastCompletedAt: '2026-11-18T01:01:00.000Z',
        lastSuccessfulScrapeAt: '2026-11-18T01:01:00.000Z',
        lastRunId: 'RUN-ATTEMPT',
        scrapedCountIncrement: 10,
        healthStatus: 'Jobs Found',
        lastErrorMessage: '',
        lastHttpStatus: 201
      };

      // 1. MongoDB write exception -> zero cached mutations
      await ScraperRepository.updateSourceStats(testId, attemptedStats, {
        isMongoConfiguredFn: () => true,
        getCollectionFn: async () => ({
          updateOne: async () => {
            throw new Error('Mongo write failed');
          }
        })
      });
      assertUnchangedBaseline('Mongo exception');

      // 2. Missing acknowledged -> zero cached mutations
      await ScraperRepository.updateSourceStats(testId, attemptedStats, {
        isMongoConfiguredFn: () => true,
        getCollectionFn: async () => ({
          updateOne: async () => ({ matchedCount: 1, modifiedCount: 1 })
        })
      });
      assertUnchangedBaseline('Missing acknowledged');

      // 3. acknowledged: false -> zero cached mutations
      await ScraperRepository.updateSourceStats(testId, attemptedStats, {
        isMongoConfiguredFn: () => true,
        getCollectionFn: async () => ({
          updateOne: async () => ({ acknowledged: false, matchedCount: 1, modifiedCount: 1, upsertedCount: 0 })
        })
      });
      assertUnchangedBaseline('acknowledged=false');

      // 4. Missing matchedCount -> zero cached mutations
      await ScraperRepository.updateSourceStats(testId, attemptedStats, {
        isMongoConfiguredFn: () => true,
        getCollectionFn: async () => ({
          updateOne: async () => ({ acknowledged: true, modifiedCount: 1, upsertedCount: 0 })
        })
      });
      assertUnchangedBaseline('Missing matchedCount');

      // 5. matchedCount: 0 with positive modifiedCount -> zero cached mutations
      await ScraperRepository.updateSourceStats(testId, attemptedStats, {
        isMongoConfiguredFn: () => true,
        getCollectionFn: async () => ({
          updateOne: async () => ({ acknowledged: true, matchedCount: 0, modifiedCount: 1, upsertedCount: 0 })
        })
      });
      assertUnchangedBaseline('matchedCount=0 with modifiedCount=1');

      // 6. matchedCount: 0 with positive upsertedCount -> zero cached mutations
      await ScraperRepository.updateSourceStats(testId, attemptedStats, {
        isMongoConfiguredFn: () => true,
        getCollectionFn: async () => ({
          updateOne: async () => ({ acknowledged: true, matchedCount: 0, modifiedCount: 0, upsertedCount: 1 })
        })
      });
      assertUnchangedBaseline('matchedCount=0 with upsertedCount=1');

      // 7. Explicit acknowledged: true + matchedCount: 1 -> permits cache updates
      await ScraperRepository.updateSourceStats(
        testId,
        {
          lastStartedAt: '2026-11-18T01:03:00.000Z',
          lastCompletedAt: '2026-11-18T01:03:30.000Z',
          lastSuccessfulScrapeAt: '2026-11-18T01:03:30.000Z',
          lastRunId: 'RUN-CONFIRMED',
          scrapedCountIncrement: 7,
          healthStatus: 'Jobs Found',
          lastErrorMessage: '',
          lastHttpStatus: 200
        },
        {
          isMongoConfiguredFn: () => true,
          getCollectionFn: async () => ({
            updateOne: async () => ({ acknowledged: true, matchedCount: 1, modifiedCount: 1, upsertedCount: 0 })
          })
        }
      );
      assert.strictEqual(target().scrapedCount, 7);
      assert.strictEqual(target().healthStatus, 'Jobs Found');
      assert.strictEqual(target().lastStartedAt, '2026-11-18T01:03:00.000Z');
      assert.strictEqual(target().lastCompletedAt, '2026-11-18T01:03:30.000Z');
      assert.strictEqual(target().lastSuccessfulScrapeAt, '2026-11-18T01:03:30.000Z');
      assert.strictEqual(target().lastRunId, 'RUN-CONFIRMED');
      assert.strictEqual(target().lastErrorMessage, '');

      // 8. Memory-only mode preserves existing cache updates cleanly
      await ScraperRepository.updateSourceStats(
        testId,
        {
          lastCompletedAt: '2026-11-18T01:04:00.000Z',
          lastSuccessfulScrapeAt: '2026-11-18T01:04:00.000Z',
          lastRunId: 'RUN-MEM',
          scrapedCountIncrement: 3,
          healthStatus: 'Jobs Found',
          lastErrorMessage: ''
        },
        {
          isMongoConfiguredFn: () => false
        }
      );
      assert.strictEqual(target().scrapedCount, 10);
      assert.strictEqual(target().lastSuccessfulScrapeAt, '2026-11-18T01:04:00.000Z');
      assert.strictEqual(target().lastRunId, 'RUN-MEM');
    } finally {
      const cleanupIdx = configs.findIndex(s => s.id === testId);
      if (cleanupIdx !== -1) configs.splice(cleanupIdx, 1);
    }
  });

  await runTest('STEP-8.4-A Case 4 [Unit]: Detail-page URL validation enforces same-host/subdomain rules, protocol/port safety, and rejects parent expansion', () => {
    const portalUrl = 'https://jobs.portal.gov.pk/listings';

    // Same host & www normalization
    assert.strictEqual(isEligibleDetailUrl('https://jobs.portal.gov.pk/vacancy/12', portalUrl), true);
    assert.strictEqual(isEligibleDetailUrl('https://www.jobs.portal.gov.pk/vacancy/12', portalUrl), true);

    // Legitimate subdomain of target hostname
    assert.strictEqual(isEligibleDetailUrl('https://detail.jobs.portal.gov.pk/vacancy/12', portalUrl), true);

    // Parent-domain expansion rejected
    assert.strictEqual(isEligibleDetailUrl('https://portal.gov.pk/vacancy/12', portalUrl), false, 'Parent-domain expansion must be rejected');

    // Unrelated hosts & lookalike suffix rejected
    assert.strictEqual(isEligibleDetailUrl('https://other-portal.gov.pk/vacancy/12', portalUrl), false);
    assert.strictEqual(isEligibleDetailUrl('https://evilportal.gov.pk/vacancy/12', 'https://portal.gov.pk/listings'), false);

    // HTTPS downgrade rejected
    assert.strictEqual(isEligibleDetailUrl('http://jobs.portal.gov.pk/vacancy/12', portalUrl), false);

    // Unexpected port rejected
    assert.strictEqual(isEligibleDetailUrl('https://jobs.portal.gov.pk:8443/vacancy/12', portalUrl), false);

    // Missing/invalid target portal URL rejected
    assert.strictEqual(isEligibleDetailUrl('https://jobs.portal.gov.pk/vacancy/12', undefined), false);
    assert.strictEqual(isEligibleDetailUrl('https://jobs.portal.gov.pk/vacancy/12', ''), false);

    // Circular listing URL rejected, query-differentiated detail URL accepted
    assert.strictEqual(isEligibleDetailUrl('https://jobs.portal.gov.pk/listings/', portalUrl), false);
    assert.strictEqual(isEligibleDetailUrl('https://jobs.portal.gov.pk/listings?id=99', portalUrl), true);

    // Post-redirect origin validation helper checks
    assert.strictEqual(isPermittedDetailOrigin('https://detail.jobs.portal.gov.pk/final', portalUrl), true);
    assert.strictEqual(isPermittedDetailOrigin('https://portal.gov.pk/final', portalUrl), false);
  });

  await runTest('STEP-8.4-A Case 5 [Mocked]: Detail enrichment enforces origin, MIME/HTML signature, 2 MB limit, Apply link extraction, and non-destructive fallback', async () => {
    const portalCfg = {
      id: 'detail-test',
      name: 'Gov Portal',
      url: 'https://portal.gov.pk/jobs'
    };

    const makeListing = (overrides: Record<string, any> = {}) => ({
      id: 'job-det-1',
      sourceJobId: 'SRC-101',
      title: 'Assistant Director',
      company: 'Gov Portal',
      jobType: 'On-site' as const,
      region: 'Pakistan' as const,
      salary: 'Salary not disclosed',
      currency: 'PKR' as const,
      experienceLevel: 'Mid' as const,
      department: 'General',
      tags: [] as string[],
      description: 'Short summary',
      requirements: [] as string[],
      benefits: [] as string[],
      postedAt: 'Today',
      applicationsCount: 0,
      status: 'Pending' as const,
      sourceUrl: 'https://portal.gov.pk/jobs/101',
      extractionMethod: 'html_cheerio' as const,
      ...overrides
    });

    // 1. Missing sourceUrl never falls back to fetching originalApplyUrl
    let fetchCalls = 0;
    const noSourceJob = makeListing({ sourceUrl: undefined, originalApplyUrl: 'https://portal.gov.pk/apply/101' });
    const noSourceRes = await enrichJobFromDetailPage(
      noSourceJob,
      portalCfg,
      async () => {
        fetchCalls++;
        return new Response('<html></html>', { status: 200 });
      }
    );
    assert.strictEqual(fetchCalls, 0, 'Must never fetch originalApplyUrl when sourceUrl is missing');
    assert.strictEqual(noSourceRes, noSourceJob);

    // 2. External final redirect URL is rejected without merging
    const externalRedirectJob = await enrichJobFromDetailPage(
      makeListing(),
      portalCfg,
      async () => {
        const res = new Response('<html><body><h1>Hacked Title</h1><div id="job-description">' + 'X'.repeat(150) + '</div></body></html>', {
          status: 200,
          headers: { 'content-type': 'text/html' }
        });
        Object.defineProperty(res, 'url', { value: 'https://external-phish.com/hijack' });
        return res;
      }
    );
    assert.strictEqual(externalRedirectJob.title, 'Assistant Director');
    assert.strictEqual(externalRedirectJob.description, 'Short summary');

    // 3. Unsupported Content-Types (PDF, JSON, PNG, plain text) and missing Content-Type non-HTML payloads rejected
    const nonHtmlPayloads = [
      { body: '%PDF-1.4 binary pdf payload ' + 'A'.repeat(200), ct: 'application/pdf' },
      { body: JSON.stringify({ title: 'JSON Title', pad: 'A'.repeat(200) }), ct: 'application/json' },
      { body: 'PNG binary payload ' + 'A'.repeat(200), ct: 'image/png' },
      { body: 'Plain text non-html body ' + 'A'.repeat(200), ct: 'text/plain' },
      { body: JSON.stringify({ title: 'Untyped JSON', pad: 'A'.repeat(200) }), ct: '' }
    ];
    for (const sample of nonHtmlPayloads) {
      const resJob = await enrichJobFromDetailPage(
        makeListing(),
        portalCfg,
        async () => {
          const headers: Record<string, string> = sample.ct ? { 'content-type': sample.ct } : {};
          return new Response(sample.body, { status: 200, headers });
        }
      );
      assert.strictEqual(resJob.description, 'Short summary', `Non-HTML (${sample.ct || 'empty CT'}) must not be parsed`);
    }

    // 4. Oversized (> 2 MB) body without Content-Length cancels stream cleanly and returns original job unchanged
    let streamCancelled = false;
    const oversizedStream = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(new Uint8Array(600 * 1024));
      },
      cancel() {
        streamCancelled = true;
      }
    });
    const oversizedJob = await enrichJobFromDetailPage(
      makeListing(),
      portalCfg,
      async () => {
        const res = new Response(oversizedStream, {
          status: 200,
          headers: { 'content-type': 'text/html; charset=utf-8' }
        });
        Object.defineProperty(res, 'url', { value: 'https://portal.gov.pk/jobs/101' });
        return res;
      }
    );
    assert.strictEqual(streamCancelled, true, 'Oversized detail response stream (> 2 MB) must be cancelled');
    assert.strictEqual(oversizedJob.description, 'Short summary');

    // 5. Valid bounded HTML: JSON-LD item.url must NOT map to originalApplyUrl; valid Apply link IS extracted; sourceUrl/sourceJobId/extractionMethod preserved
    assert.strictEqual(MAX_DETAIL_HTML_BYTES, 2 * 1024 * 1024);
    const richHtml = `<!DOCTYPE html><html><head>
      <script type="application/ld+json">${JSON.stringify({
        '@type': 'JobPosting',
        title: 'Assistant Director Planning',
        url: 'https://portal.gov.pk/jobs/101/jsonld-posting-url',
        description: 'Comprehensive federal planning department vacancy overseeing development evaluations and policy research across ministries.'
      })}</script>
    </head><body>
      <h1>Assistant Director Planning</h1>
      <div id="job-description">Comprehensive federal planning department vacancy overseeing development evaluations and policy research across ministries.</div>
      <a href="https://apply.portal.gov.pk/submit/101">Apply Now</a>
    </body></html>`;

    const enrichedWithoutExistingApply = await enrichJobFromDetailPage(
      makeListing(),
      portalCfg,
      async () => {
        const res = new Response(richHtml, { status: 200, headers: { 'content-type': 'text/html' } });
        Object.defineProperty(res, 'url', { value: 'https://portal.gov.pk/jobs/101' });
        return res;
      }
    );
    assert.strictEqual(enrichedWithoutExistingApply.title, 'Assistant Director Planning');
    assert.strictEqual(
      enrichedWithoutExistingApply.originalApplyUrl,
      'https://apply.portal.gov.pk/submit/101',
      'Must extract valid Apply link rather than JSON-LD item.url'
    );
    assert.strictEqual(enrichedWithoutExistingApply.sourceUrl, 'https://portal.gov.pk/jobs/101');
    assert.strictEqual(enrichedWithoutExistingApply.sourceJobId, 'SRC-101');
    assert.strictEqual(enrichedWithoutExistingApply.extractionMethod, 'html_cheerio');

    // JSON-LD-only page (no Apply link) must leave originalApplyUrl undefined
    const jsonLdOnlyHtml = `<!DOCTYPE html><html><head>
      <script type="application/ld+json">${JSON.stringify({
        '@type': 'JobPosting',
        title: 'Senior Econometrician',
        url: 'https://portal.gov.pk/jobs/101/jsonld-only'
      })}</script>
    </head><body><div id="job-description">Detailed econometric research post requiring master degree and quantitative evaluation skills.</div></body></html>`;
    const jsonLdOnlyRes = await enrichJobFromDetailPage(
      makeListing(),
      portalCfg,
      async () => new Response(jsonLdOnlyHtml, { status: 200, headers: { 'content-type': 'text/html' } })
    );
    assert.strictEqual(jsonLdOnlyRes.originalApplyUrl, undefined, 'JSON-LD item.url must NEVER map to originalApplyUrl');

    // Existing valid originalApplyUrl must remain preserved
    const preservedApplyRes = await enrichJobFromDetailPage(
      makeListing({ originalApplyUrl: 'https://official-apply.gov.pk/form/999' }),
      portalCfg,
      async () => new Response(richHtml, { status: 200, headers: { 'content-type': 'text/html' } })
    );
    assert.strictEqual(preservedApplyRes.originalApplyUrl, 'https://official-apply.gov.pk/form/999');

    // Batch enrichment preserves job order and returns failed item unchanged
    const batchResults = await enrichScrapedJobsBatch(
      [
        makeListing({ id: 'b-1', sourceUrl: 'https://portal.gov.pk/jobs/101' }),
        makeListing({ id: 'b-2', title: 'Keep On Failure', sourceUrl: 'https://portal.gov.pk/jobs/fail' })
      ],
      portalCfg,
      3,
      async (url) => {
        if (url.includes('/fail')) throw new Error('Simulated timeout');
        return new Response(richHtml, { status: 200, headers: { 'content-type': 'text/html' } });
      }
    );
    assert.strictEqual(batchResults.length, 2);
    assert.strictEqual(batchResults[0].id, 'b-1');
    assert.strictEqual(batchResults[0].title, 'Assistant Director Planning');
    assert.strictEqual(batchResults[1].id, 'b-2');
    assert.strictEqual(batchResults[1].title, 'Keep On Failure');
  });

  // ============================================================================
  // STEP-8.4-B: MONGODB FAIL-CLOSED READS, CACHE & SCHEDULER SAFETY TESTS
  // ============================================================================

  await runTest('STEP-8.4-B Case 1 [Mocked]: ScraperRepository.getConfigs fails closed on collection lookup and read/timeout errors without falling back or seeding', async () => {
    const repoAny = ScraperRepository as any;
    const prevCachedSources = Array.isArray(repoAny.cachedSources) ? repoAny.cachedSources.map((s: any) => ({ ...s })) : [];
    repoAny.cachedSources = [{ id: 'stale-src-1', name: 'Stale Cached Portal', url: 'https://stale.example/jobs', status: 'Active Scheduled' }];

    try {
      let seedCalled = false;

      // 1a. Collection lookup error must propagate (no cached/default fallback)
      await assert.rejects(
        () => ScraperRepository.getConfigs({
          isMongoConfiguredFn: () => true,
          getCollectionFn: async () => {
            throw new Error('MongoDB connection refused on collection lookup');
          }
        }),
        /connection refused/i
      );

      // 1b. Read error on find().toArray() must propagate and must NOT trigger seeding
      await assert.rejects(
        () => ScraperRepository.getConfigs({
          isMongoConfiguredFn: () => true,
          getCollectionFn: async () => ({
            find: () => ({
              toArray: async () => {
                throw new Error('MongoNetworkTimeoutError: read timed out');
              }
            }),
            insertMany: async () => {
              seedCalled = true;
              return { acknowledged: true, insertedCount: 1 };
            }
          })
        }),
        /timed out/i
      );
      assert.strictEqual(seedCalled, false, 'Must NEVER seed defaults when read query failed or timed out');

      // Stale cache must remain unchanged after read failures
      assert.strictEqual(repoAny.cachedSources.length, 1);
      assert.strictEqual(repoAny.cachedSources[0].id, 'stale-src-1');
    } finally {
      repoAny.cachedSources = prevCachedSources;
    }
  });

  await runTest('STEP-8.4-B Case 2 [Mocked]: ScraperRepository.getConfigs seeds only on confirmed empty collection with acknowledged=true and preserves memory-only mode', async () => {
    const repoAny = ScraperRepository as any;
    const prevCachedSources = Array.isArray(repoAny.cachedSources) ? repoAny.cachedSources.map((s: any) => ({ ...s })) : [];

    try {
      // 2a. Confirmed empty collection with unacknowledged insertMany must throw
      repoAny.cachedSources = [{ id: 'stale-only', name: 'Stale Only', url: 'https://stale.example', status: 'Active Scheduled' }];
      await assert.rejects(
        () => ScraperRepository.getConfigs({
          isMongoConfiguredFn: () => true,
          getCollectionFn: async () => ({
            find: () => ({ toArray: async () => [] }),
            insertMany: async () => ({ acknowledged: false, insertedCount: 0 })
          })
        }),
        /failed confirmation/i
      );
      assert.strictEqual(repoAny.cachedSources[0].id, 'stale-only', 'Failed seed must not overwrite cachedSources');

      // 2b. Confirmed empty collection with acknowledged=true seeds defaults and updates cachedSources
      let seededCount = 0;
      const seeded = await ScraperRepository.getConfigs({
        isMongoConfiguredFn: () => true,
        getCollectionFn: async () => ({
          find: () => ({ toArray: async () => [] }),
          insertMany: async (docs: any[]) => {
            seededCount = docs.length;
            return { acknowledged: true, insertedCount: docs.length };
          }
        })
      });
      assert.ok(seeded.length > 0 && seededCount === seeded.length, 'Confirmed empty DB must seed verified default portals');

      // 2c. Authoritative non-empty DB read refreshes cache and returns DB docs
      const dbDocs = [{ id: 'db-portal-1', name: 'DB Portal 1', portalUrl: 'https://db.gov.pk/jobs' }];
      const fetched = await ScraperRepository.getConfigs({
        isMongoConfiguredFn: () => true,
        getCollectionFn: async () => ({
          find: () => ({ toArray: async () => dbDocs }),
          updateMany: async () => ({ acknowledged: true, matchedCount: 1 })
        })
      });
      assert.strictEqual(fetched.length, 1);
      assert.strictEqual(fetched[0].id, 'db-portal-1');
      assert.strictEqual(fetched[0].url, 'https://db.gov.pk/jobs');

      // 2d. Memory-only mode preserves cachedSources return cleanly
      const memResult = await ScraperRepository.getConfigs({
        isMongoConfiguredFn: () => false
      });
      assert.strictEqual(memResult.length, 1);
      assert.strictEqual(memResult[0].id, 'db-portal-1');
    } finally {
      repoAny.cachedSources = prevCachedSources;
    }
  });

  await runTest('STEP-8.4-B Case 3 [Mocked]: ScraperRepository.getSchedulerSettings & saveSchedulerSettings fail closed on read/timeout, preserve enabled=false, and validate seed/write acks', async () => {
    const repoAny = ScraperRepository as any;
    const prevSettings = { ...repoAny.cachedSettings };
    repoAny.cachedSettings = { ...getDefaultSchedulerSettings(), enabled: true, isPersistedToMongo: false };

    try {
      // 3a. DB lookup failure propagates instead of returning cached enabled=true
      await assert.rejects(
        () => ScraperRepository.getSchedulerSettings({
          isMongoConfiguredFn: () => true,
          getDbFn: async () => {
            throw new Error('Mongo DB unreachable');
          }
        }),
        /unreachable/i
      );

      // 3b. findOne timeout/error propagates and does NOT seed defaults
      let seedReplaceCalled = false;
      await assert.rejects(
        () => ScraperRepository.getSchedulerSettings({
          isMongoConfiguredFn: () => true,
          getDbFn: async () => ({
            collection: () => ({
              findOne: async () => {
                throw new Error('MongoNetworkTimeoutError on findOne');
              },
              replaceOne: async () => {
                seedReplaceCalled = true;
                return { acknowledged: true, upsertedCount: 1 };
              }
            })
          })
        }),
        /timeout/i
      );
      assert.strictEqual(seedReplaceCalled, false);

      // 3c. Confirmed null document triggers seed replaceOne requiring explicit ack + match/upsert
      await assert.rejects(
        () => ScraperRepository.getSchedulerSettings({
          isMongoConfiguredFn: () => true,
          getDbFn: async () => ({
            collection: () => ({
              findOne: async () => null,
              replaceOne: async () => ({ acknowledged: false, matchedCount: 0, upsertedCount: 0 })
            })
          })
        }),
        /not confirmed/i
      );

      const seededSettings = await ScraperRepository.getSchedulerSettings({
        isMongoConfiguredFn: () => true,
        getDbFn: async () => ({
          collection: () => ({
            findOne: async () => null,
            replaceOne: async () => ({ acknowledged: true, matchedCount: 0, upsertedCount: 1 })
          })
        })
      });
      assert.strictEqual(seededSettings.isPersistedToMongo, true);

      // 3d. Persisted enabled: false is preserved (never turned into enabled: true)
      const pausedFromDb = await ScraperRepository.getSchedulerSettings({
        isMongoConfiguredFn: () => true,
        getDbFn: async () => ({
          collection: () => ({
            findOne: async () => ({ id: 'global_scheduler_settings', enabled: false, scope: 'single', singleSourceId: 'src-1' })
          })
        })
      });
      assert.strictEqual(pausedFromDb.enabled, false, 'Saved enabled=false must remain false');
      assert.strictEqual(pausedFromDb.scope, 'single');
      assert.strictEqual(pausedFromDb.isPersistedToMongo, true);

      // 3e. saveSchedulerSettings rejects unconfirmed write (acknowledged=true with 0 match/upsert)
      await assert.rejects(
        () => ScraperRepository.saveSchedulerSettings(
          { enabled: true },
          {
            isMongoConfiguredFn: () => true,
            getDbFn: async () => ({
              collection: () => ({
                findOne: async () => ({ id: 'global_scheduler_settings', enabled: false, scope: 'all' }),
                replaceOne: async () => ({ acknowledged: true, matchedCount: 0, upsertedCount: 0 })
              })
            })
          }
        ),
        /not confirmed/i
      );

      // 3f. Memory-only mode preserves existing non-persisted behavior cleanly
      const memSettings = await ScraperRepository.getSchedulerSettings({
        isMongoConfiguredFn: () => false
      });
      assert.strictEqual(memSettings.isPersistedToMongo, false);
      const memSaved = await ScraperRepository.saveSchedulerSettings(
        { enabled: true, scope: 'working' },
        { isMongoConfiguredFn: () => false }
      );
      assert.strictEqual(memSaved.enabled, true);
      assert.strictEqual(memSaved.scope, 'working');
      assert.strictEqual(memSaved.isPersistedToMongo, false);
    } finally {
      repoAny.cachedSettings = prevSettings;
    }
  });

  await runTest('STEP-8.4-B Case 4 [Mocked]: initScraperScheduler refuses to start cron on settings read failure or enabled=false and starts on enabled=true', async () => {
    stopScraperScheduler();
    try {
      let cronCalls = 0;
      const mockCronTask = { stop: () => {}, start: () => {} } as any;
      const fakeCron = ((_expr: string, _fn: any) => {
        cronCalls++;
        return mockCronTask;
      }) as any;

      // 4a. Settings read failure -> must NOT call cron.schedule
      const startedOnErr = await initScraperScheduler({
        getSchedulerSettingsFn: async () => {
          throw new Error('MongoDB read failure on boot');
        },
        resetStaleSchedulesFn: async () => ({ resetCount: 0 }),
        scheduleCronFn: fakeCron
      });
      assert.strictEqual(startedOnErr, false);
      assert.strictEqual(cronCalls, 0, 'cron.schedule must NOT be called when reading settings fails');

      // 4b. Settings enabled=false -> must NOT call cron.schedule
      const startedOnPaused = await initScraperScheduler({
        getSchedulerSettingsFn: async () => ({ ...getDefaultSchedulerSettings(), enabled: false }),
        resetStaleSchedulesFn: async () => ({ resetCount: 0 }),
        scheduleCronFn: fakeCron
      });
      assert.strictEqual(startedOnPaused, false);
      assert.strictEqual(cronCalls, 0, 'cron.schedule must NOT be called when scheduler is paused');

      // 4c. setGlobalSchedulerState(true) when settings read fails afterwards reports isRunning=false
      const stateResult = await setGlobalSchedulerState(true, {
        saveSchedulerSettingsFn: async (s) => ({ ...getDefaultSchedulerSettings(), ...s, enabled: true, isPersistedToMongo: true }),
        getSchedulerSettingsFn: async () => {
          throw new Error('Auth check failed after save');
        },
        resetStaleSchedulesFn: async () => ({ resetCount: 0 }),
        scheduleCronFn: fakeCron
      });
      assert.strictEqual(stateResult.isRunning, false);
      assert.strictEqual(cronCalls, 0);

      // 4d. Settings enabled=true -> starts cron cleanly (mocked cron so no live background timer remains)
      const startedOnEnabled = await initScraperScheduler({
        getSchedulerSettingsFn: async () => ({ ...getDefaultSchedulerSettings(), enabled: true, scope: 'all' }),
        resetStaleSchedulesFn: async () => ({ resetCount: 0 }),
        scheduleCronFn: fakeCron
      });
      assert.strictEqual(startedOnEnabled, true);
      assert.strictEqual(cronCalls, 1);
    } finally {
      stopScraperScheduler();
    }
  });

  await runTest('STEP-8.4-B Case 5 [Mocked]: runSchedulerTick aborts cleanly with 0 executions on authoritative read failures and rejects unknown scope', async () => {
    let execCalls = 0;
    const mockExecute = (async () => {
      execCalls++;
      return { totalFound: 1, totalDuplicates: 0 };
    }) as any;

    const dueSource = {
      id: 'due-src-1',
      name: 'Due Source',
      url: 'https://due.gov.pk/jobs',
      status: 'Active Scheduled',
      interval: '1h',
      nextRunAt: new Date(Date.now() - 60_000).toISOString()
    };

    // 5a. Authoritative settings read error aborts tick cleanly
    const resSettingsErr = await runSchedulerTick({
      isScraperEnabledFn: () => true,
      getSchedulerSettingsFn: async () => {
        throw new Error('Settings DB timeout');
      },
      executeScraperFn: mockExecute
    });
    assert.strictEqual(resSettingsErr.aborted, true);
    assert.deepStrictEqual(resSettingsErr.triggeredSources, []);
    assert.ok(String(resSettingsErr.error || '').includes('Settings DB timeout'));
    assert.strictEqual(execCalls, 0);

    // 5b. Authoritative configs read error aborts tick cleanly
    const resConfigsErr = await runSchedulerTick({
      isScraperEnabledFn: () => true,
      getSchedulerSettingsFn: async () => ({ ...getDefaultSchedulerSettings(), enabled: true, scope: 'all' }),
      getConfigsFn: async () => {
        throw new Error('Configs collection unreachable');
      },
      executeScraperFn: mockExecute
    });
    assert.strictEqual(resConfigsErr.aborted, true);
    assert.deepStrictEqual(resConfigsErr.triggeredSources, []);
    assert.ok(String(resConfigsErr.error || '').includes('Configs collection unreachable'));
    assert.strictEqual(execCalls, 0);

    // 5c. scope='group' with getGroups() failure aborts tick cleanly
    const resGroupsErr = await runSchedulerTick({
      isScraperEnabledFn: () => true,
      getSchedulerSettingsFn: async () => ({
        ...getDefaultSchedulerSettings(),
        enabled: true,
        scope: 'group',
        selectedGroupId: 'grp-1'
      }),
      getConfigsFn: async () => [{ ...dueSource }],
      getGroupsFn: async () => {
        throw new Error('Groups collection timeout');
      },
      executeScraperFn: mockExecute
    });
    assert.strictEqual(resGroupsErr.aborted, true);
    assert.deepStrictEqual(resGroupsErr.triggeredSources, []);
    assert.ok(String(resGroupsErr.error || '').includes('Groups collection timeout'));
    assert.strictEqual(execCalls, 0);

    // 5d. Unknown/invalid scope never falls back to all sources (0 executed)
    assert.strictEqual(isValidSchedulerScope('unknown_scope'), false);
    const resUnknownScope = await runSchedulerTick({
      isScraperEnabledFn: () => true,
      getSchedulerSettingsFn: async () => ({
        ...getDefaultSchedulerSettings(),
        enabled: true,
        scope: 'unknown_scope' as any
      }),
      getConfigsFn: async () => [{ ...dueSource }],
      executeScraperFn: mockExecute
    });
    assert.strictEqual(resUnknownScope.aborted, undefined);
    assert.deepStrictEqual(resUnknownScope.triggeredSources, []);
    assert.strictEqual(execCalls, 0, 'Unknown scope must execute 0 sources');

    // 5e. Valid scope='single' with due source executes normally when all reads succeed
    const resValid = await runSchedulerTick({
      isScraperEnabledFn: () => true,
      getSchedulerSettingsFn: async () => ({
        ...getDefaultSchedulerSettings(),
        enabled: true,
        scope: 'single',
        singleSourceId: 'due-src-1'
      }),
      getConfigsFn: async () => [{ ...dueSource }],
      updateSourceScheduleFn: async () => true,
      executeScraperFn: mockExecute
    });
    assert.deepStrictEqual(resValid.triggeredSources, ['due-src-1']);
    assert.strictEqual(execCalls, 1);
  });

  await runTest('STEP-8.4-B Case 6 [Mocked]: ScraperRepository group methods enforce fail-closed reads and confirmed writes without corrupting cachedGroups', async () => {
    const repoAny = ScraperRepository as any;
    const prevGroups = Array.isArray(repoAny.cachedGroups) ? repoAny.cachedGroups.map((g: any) => ({ ...g, sourceIds: [...(g.sourceIds || [])] })) : [];

    repoAny.cachedGroups = [
      { id: 'grp-cached-1', name: 'Cached Group', description: 'Original', sourceIds: ['s1'], createdAt: '2026-01-01', updatedAt: '2026-01-01' }
    ];

    try {
      // 6a. getGroups DB failure must propagate instead of returning cachedGroups
      await assert.rejects(
        () => ScraperRepository.getGroups({
          isMongoConfiguredFn: () => true,
          getCollectionFn: async () => ({
            find: () => ({ sort: () => ({ toArray: async () => { throw new Error('Groups read failure'); } }) })
          })
        }),
        /Groups read failure/i
      );

      // 6b. getGroups confirmed empty seeds defaults & rejects unacked seed
      await assert.rejects(
        () => ScraperRepository.getGroups({
          isMongoConfiguredFn: () => true,
          getCollectionFn: async () => ({
            find: () => ({ sort: () => ({ toArray: async () => [] }) }),
            insertMany: async () => ({ acknowledged: false, insertedCount: 0 })
          })
        }),
        /failed confirmation/i
      );
      assert.strictEqual(repoAny.cachedGroups.length, 1);
      assert.strictEqual(repoAny.cachedGroups[0].id, 'grp-cached-1');

      // 6c. createGroup rejects unacked insertOne or error and does NOT push to cachedGroups
      await assert.rejects(
        () => ScraperRepository.createGroup(
          { name: 'Unacked Group', sourceIds: ['s2'] },
          {
            isMongoConfiguredFn: () => true,
            getCollectionFn: async () => ({
              insertOne: async () => ({ acknowledged: false })
            })
          }
        ),
        /not acknowledged/i
      );
      assert.strictEqual(repoAny.cachedGroups.length, 1);

      // Confirmed createGroup updates cachedGroups
      const created = await ScraperRepository.createGroup(
        { name: 'Confirmed Group', sourceIds: ['s2'] },
        {
          isMongoConfiguredFn: () => true,
          getCollectionFn: async () => ({
            insertOne: async () => ({ acknowledged: true, insertedId: 'obj-1' })
          })
        }
      );
      assert.strictEqual(created.name, 'Confirmed Group');
      assert.strictEqual(repoAny.cachedGroups.length, 2);

      // 6d. updateGroup / addSourcesToGroup / removeSourcesFromGroup propagate errors and do not mutate cachedGroups
      await assert.rejects(
        () => ScraperRepository.updateGroup(
          'grp-cached-1',
          { name: 'Tampered Name' },
          {
            isMongoConfiguredFn: () => true,
            getCollectionFn: async () => ({
              findOneAndUpdate: async () => {
                throw new Error('updateGroup failed');
              }
            })
          }
        ),
        /updateGroup failed/i
      );
      assert.strictEqual(repoAny.cachedGroups[0].name, 'Cached Group', 'updateGroup error must not mutate cache');

      // Null result from MongoDB findOneAndUpdate returns null without falling back to memory cache mutation
      const missingUpd = await ScraperRepository.updateGroup(
        'grp-cached-1',
        { name: 'Should Not Apply' },
        {
          isMongoConfiguredFn: () => true,
          getCollectionFn: async () => ({
            findOneAndUpdate: async () => null
          })
        }
      );
      assert.strictEqual(missingUpd, null);
      assert.strictEqual(repoAny.cachedGroups[0].name, 'Cached Group');

      await assert.rejects(
        () => ScraperRepository.addSourcesToGroup(
          'grp-cached-1',
          ['s99'],
          {
            isMongoConfiguredFn: () => true,
            getCollectionFn: async () => ({
              findOneAndUpdate: async () => {
                throw new Error('addSources error');
              }
            })
          }
        ),
        /addSources error/i
      );
      assert.deepStrictEqual(repoAny.cachedGroups[0].sourceIds, ['s1']);

      await assert.rejects(
        () => ScraperRepository.removeSourcesFromGroup(
          'grp-cached-1',
          ['s1'],
          {
            isMongoConfiguredFn: () => true,
            getCollectionFn: async () => ({
              findOneAndUpdate: async () => {
                throw new Error('removeSources error');
              }
            })
          }
        ),
        /removeSources error/i
      );
      assert.deepStrictEqual(repoAny.cachedGroups[0].sourceIds, ['s1']);

      // 6e. deleteGroup rejects unacked write & does NOT remove from cachedGroups; confirmed delete updates cache
      await assert.rejects(
        () => ScraperRepository.deleteGroup('grp-cached-1', {
          isMongoConfiguredFn: () => true,
          getCollectionFn: async () => ({
            deleteOne: async () => ({ acknowledged: false, deletedCount: 1 })
          })
        }),
        /not acknowledged/i
      );
      assert.strictEqual(repoAny.cachedGroups.length, 2);

      const deletedConfirmed = await ScraperRepository.deleteGroup('grp-cached-1', {
        isMongoConfiguredFn: () => true,
        getCollectionFn: async () => ({
          deleteOne: async () => ({ acknowledged: true, deletedCount: 1 })
        })
      });
      assert.strictEqual(deletedConfirmed, true);
      assert.strictEqual(repoAny.cachedGroups.some((g: any) => g.id === 'grp-cached-1'), false);

      // 6f. Memory-only group mode preserves existing behavior cleanly
      const memAdded = await ScraperRepository.createGroup(
        { name: 'Mem Only Group', sourceIds: ['m1'] },
        { isMongoConfiguredFn: () => false }
      );
      const memUpdated = await ScraperRepository.addSourcesToGroup(memAdded.id, ['m2'], { isMongoConfiguredFn: () => false });
      assert.deepStrictEqual(memUpdated?.sourceIds, ['m1', 'm2']);
    } finally {
      repoAny.cachedGroups = prevGroups;
    }
  });

  await runTest('STEP-8.4-B Case 7 [Mocked]: ScraperRepository.getRuns clears stale cachedRuns on empty DB and propagates errors; addRun never throws and skips cache on failed/unacked writes', async () => {
    const repoAny = ScraperRepository as any;
    const prevRuns = Array.isArray(repoAny.cachedRuns) ? [...repoAny.cachedRuns] : [];
    repoAny.cachedRuns = [{ id: 'stale-run-1', totalFound: 5 }];

    try {
      // 7a. DB read error propagates instead of serving stale cachedRuns
      await assert.rejects(
        () => ScraperRepository.getRuns({
          isMongoConfiguredFn: () => true,
          getCollectionFn: async () => ({
            find: () => ({ sort: () => ({ limit: () => ({ toArray: async () => { throw new Error('Runs read error'); } }) }) })
          })
        }),
        /Runs read error/i
      );
      assert.strictEqual(repoAny.cachedRuns.length, 1);

      // 7b. Confirmed empty DB result [] clears stale cachedRuns and returns []
      const emptyRuns = await ScraperRepository.getRuns({
        isMongoConfiguredFn: () => true,
        getCollectionFn: async () => ({
          find: () => ({ sort: () => ({ limit: () => ({ toArray: async () => [] }) }) })
        })
      });
      assert.deepStrictEqual(emptyRuns, []);
      assert.deepStrictEqual(repoAny.cachedRuns, [], 'Confirmed empty runs query must clear stale cachedRuns');

      // 7c. addRun on Mongo exception must NOT throw (protects caller after jobs saved) and must skip cachedRuns
      const failedRun = await ScraperRepository.addRun(
        { id: 'run-fail-1', totalFound: 3 },
        {
          isMongoConfiguredFn: () => true,
          getCollectionFn: async () => ({
            insertOne: async () => {
              throw new Error('insertOne failed');
            }
          })
        }
      );
      assert.strictEqual(failedRun.isPersistedToMongo, false);
      assert.ok(String(failedRun.persistenceError).includes('insertOne failed'));
      assert.strictEqual(repoAny.cachedRuns.length, 0, 'Failed addRun must NOT add unpersisted run to cachedRuns');

      // 7d. addRun on unacknowledged write must NOT throw and must skip cachedRuns
      const unackedRun = await ScraperRepository.addRun(
        { id: 'run-unacked-1', totalFound: 4 },
        {
          isMongoConfiguredFn: () => true,
          getCollectionFn: async () => ({
            insertOne: async () => ({ acknowledged: false })
          })
        }
      );
      assert.strictEqual(unackedRun.isPersistedToMongo, false);
      assert.strictEqual(repoAny.cachedRuns.length, 0);

      // 7e. addRun on confirmed acknowledged=true updates cachedRuns and returns isPersistedToMongo=true
      const okRun = await ScraperRepository.addRun(
        { id: 'run-ok-1', totalFound: 7 },
        {
          isMongoConfiguredFn: () => true,
          getCollectionFn: async () => ({
            insertOne: async () => ({ acknowledged: true, insertedId: 'r-1' })
          })
        }
      );
      assert.strictEqual(okRun.isPersistedToMongo, true);
      assert.strictEqual(repoAny.cachedRuns.length, 1);
      assert.strictEqual(repoAny.cachedRuns[0].id, 'run-ok-1');

      // 7f. Memory-only addRun updates cachedRuns cleanly with isPersistedToMongo=false
      const memRun = await ScraperRepository.addRun(
        { id: 'run-mem-1', totalFound: 2 },
        { isMongoConfiguredFn: () => false }
      );
      assert.strictEqual(memRun.isPersistedToMongo, false);
      assert.strictEqual(repoAny.cachedRuns[0].id, 'run-mem-1');
    } finally {
      repoAny.cachedRuns = prevRuns;
    }
  });

  await runTest('STEP-8.4-B Case 8 [Mocked]: updateSourceSchedule and runSchedulerTick update schedule state only after confirmed acknowledged=true and matchedCount>0', async () => {
    const repoAny = ScraperRepository as any;
    const prevSources = Array.isArray(repoAny.cachedSources) ? repoAny.cachedSources.map((s: any) => ({ ...s })) : [];
    const testId = 'step-84b-sched-test';
    repoAny.cachedSources = [
      { id: testId, name: 'Schedule Test Portal', url: 'https://sched.gov.pk', status: 'Active Scheduled', nextRunAt: '2026-11-17T00:00:00.000Z' }
    ];

    try {
      // 8a. DB exception -> returns false, cache untouched
      const okOnErr = await ScraperRepository.updateSourceSchedule(
        testId,
        { nextRunAt: '2026-11-19T00:00:00.000Z' },
        {
          isMongoConfiguredFn: () => true,
          getCollectionFn: async () => ({
            updateOne: async () => {
              throw new Error('Schedule write error');
            }
          })
        }
      );
      assert.strictEqual(okOnErr, false);
      assert.strictEqual(repoAny.cachedSources[0].nextRunAt, '2026-11-17T00:00:00.000Z');

      // 8b. Unacknowledged or 0 matchedCount -> returns false, cache untouched
      const okOnUnacked = await ScraperRepository.updateSourceSchedule(
        testId,
        { nextRunAt: '2026-11-19T00:00:00.000Z' },
        {
          isMongoConfiguredFn: () => true,
          getCollectionFn: async () => ({ updateOne: async () => ({ acknowledged: false, matchedCount: 1 }) })
        }
      );
      assert.strictEqual(okOnUnacked, false);
      assert.strictEqual(repoAny.cachedSources[0].nextRunAt, '2026-11-17T00:00:00.000Z');

      const okOnZeroMatch = await ScraperRepository.updateSourceSchedule(
        testId,
        { nextRunAt: '2026-11-19T00:00:00.000Z' },
        {
          isMongoConfiguredFn: () => true,
          getCollectionFn: async () => ({ updateOne: async () => ({ acknowledged: true, matchedCount: 0 }) })
        }
      );
      assert.strictEqual(okOnZeroMatch, false);
      assert.strictEqual(repoAny.cachedSources[0].nextRunAt, '2026-11-17T00:00:00.000Z');

      // 8c. Confirmed write -> returns true, cache updated
      const okConfirmed = await ScraperRepository.updateSourceSchedule(
        testId,
        { nextRunAt: '2026-11-18T12:00:00.000Z', lastRunAt: '2026-11-18T00:00:00.000Z' },
        {
          isMongoConfiguredFn: () => true,
          getCollectionFn: async () => ({ updateOne: async () => ({ acknowledged: true, matchedCount: 1 }) })
        }
      );
      assert.strictEqual(okConfirmed, true);
      assert.strictEqual(repoAny.cachedSources[0].nextRunAt, '2026-11-18T12:00:00.000Z');
      assert.strictEqual(repoAny.cachedSources[0].lastRunAt, '2026-11-18T00:00:00.000Z');

      // 8d. runSchedulerTick preserves runtime source schedule fields untouched if updateSourceSchedule returns false
      const runtimeSource = {
        id: 'rt-1',
        name: 'Runtime Source',
        url: 'https://rt.gov.pk',
        status: 'Active Scheduled',
        interval: '1h',
        nextRunAt: '2026-11-17T00:00:00.000Z',
        lastRunAt: '2026-11-16T00:00:00.000Z'
      };
      await runSchedulerTick({
        isScraperEnabledFn: () => true,
        getSchedulerSettingsFn: async () => ({ ...getDefaultSchedulerSettings(), enabled: true, scope: 'all' }),
        getConfigsFn: async () => [runtimeSource],
        executeScraperFn: (async () => ({ totalFound: 1, totalDuplicates: 0 })) as any,
        updateSourceScheduleFn: async () => false
      });
      assert.strictEqual(runtimeSource.nextRunAt, '2026-11-17T00:00:00.000Z', 'Unpersisted schedule write must not mutate source.nextRunAt');
      assert.strictEqual(runtimeSource.lastRunAt, '2026-11-16T00:00:00.000Z', 'Unpersisted schedule write must not mutate source.lastRunAt');
    } finally {
      repoAny.cachedSources = prevSources;
    }
  });

  await runTest('STEP-8.4-B Case 9 [Mocked]: ScraperRepository.saveConfigs requires acknowledged=true with match/upsert > 0 and preserves cache and partial-error format on failure', async () => {
    const repoAny = ScraperRepository as any;
    const prevSources = Array.isArray(repoAny.cachedSources) ? repoAny.cachedSources.map((s: any) => ({ ...s })) : [];
    const baseline = [{ id: 'base-1', name: 'Baseline', url: 'https://base.gov.pk' }];
    repoAny.cachedSources = baseline;

    try {
      const nextConfigs = [
        { id: 'cfg-1', name: 'Config One', url: 'https://one.gov.pk' },
        { id: 'cfg-2', name: 'Config Two', url: 'https://two.gov.pk' }
      ];

      // 9a. Missing result or missing/false acknowledged rejected
      await assert.rejects(
        () => ScraperRepository.saveConfigs(nextConfigs, {
          isMongoConfiguredFn: () => true,
          getCollectionFn: async () => ({ replaceOne: async () => undefined })
        }),
        /not confirmed/i
      );
      await assert.rejects(
        () => ScraperRepository.saveConfigs(nextConfigs, {
          isMongoConfiguredFn: () => true,
          getCollectionFn: async () => ({ replaceOne: async () => ({ matchedCount: 1 }) })
        }),
        /not confirmed/i
      );
      await assert.rejects(
        () => ScraperRepository.saveConfigs(nextConfigs, {
          isMongoConfiguredFn: () => true,
          getCollectionFn: async () => ({ replaceOne: async () => ({ acknowledged: false, matchedCount: 1 }) })
        }),
        /not confirmed/i
      );

      // 9b. Zero matchedCount & zero upsertedCount rejected even with acknowledged=true
      await assert.rejects(
        () => ScraperRepository.saveConfigs(nextConfigs, {
          isMongoConfiguredFn: () => true,
          getCollectionFn: async () => ({ replaceOne: async () => ({ acknowledged: true, matchedCount: 0, upsertedCount: 0 }) })
        }),
        /not confirmed/i
      );
      assert.strictEqual(repoAny.cachedSources[0].id, 'base-1', 'Failed saveConfigs must leave cachedSources intact');

      // 9c. Partial persistence failure preserves exact error format and retains previous cache
      let callCount = 0;
      await assert.rejects(
        () => ScraperRepository.saveConfigs(nextConfigs, {
          isMongoConfiguredFn: () => true,
          getCollectionFn: async () => ({
            replaceOne: async () => {
              callCount++;
              if (callCount === 1) return { acknowledged: true, matchedCount: 1, upsertedCount: 0 };
              return { acknowledged: true, matchedCount: 0, upsertedCount: 0 };
            }
          })
        }),
        /Partial persistence failure: persisted 1\/2 sources before error on source "cfg-2"/
      );
      assert.strictEqual(repoAny.cachedSources[0].id, 'base-1');

      // 9d. All valid configs confirmed (match or upsert) -> updates cachedSources
      await ScraperRepository.saveConfigs(nextConfigs, {
        isMongoConfiguredFn: () => true,
        getCollectionFn: async () => ({
          replaceOne: async (filter: any) =>
            filter.id === 'cfg-1'
              ? { acknowledged: true, matchedCount: 1, upsertedCount: 0 }
              : { acknowledged: true, matchedCount: 0, upsertedCount: 1 }
        })
      });
      assert.strictEqual(repoAny.cachedSources.length, 2);
      assert.strictEqual(repoAny.cachedSources[1].id, 'cfg-2');
    } finally {
      repoAny.cachedSources = prevSources;
    }
  });

  // ============================================================================
  // STEP-8.4-B1: EXACT INSERT COUNT VALIDATION FOR DEFAULT SCRAPER SEEDS
  // ============================================================================

  await runTest('STEP-8.4-B1 Case 1 [Mocked]: ScraperRepository.getConfigs seed rejects missing/zero/partial/unacked insertedCount, succeeds only on exact count match, and preserves cache & memory mode', async () => {
    const repoAny = ScraperRepository as any;
    const prevCachedSources = Array.isArray(repoAny.cachedSources)
      ? repoAny.cachedSources.map((s: any) => ({ ...s }))
      : [];

    const baselineCache = [
      { id: 'baseline-cached-source', name: 'Baseline Cached Portal', url: 'https://baseline.gov.pk/jobs', status: 'Active Scheduled' }
    ];
    const baselineSnapshot = JSON.stringify(baselineCache);

    try {
      // 1. acknowledged=false with insertedCount=0 -> reject
      repoAny.cachedSources = baselineCache.map(s => ({ ...s }));
      await assert.rejects(
        () => ScraperRepository.getConfigs({
          isMongoConfiguredFn: () => true,
          getCollectionFn: async () => ({
            find: () => ({ toArray: async () => [] }),
            insertMany: async () => ({ acknowledged: false, insertedCount: 0 })
          })
        }),
        /failed confirmation/i
      );
      assert.strictEqual(JSON.stringify(repoAny.cachedSources), baselineSnapshot, 'Case 1: cache must stay unchanged on rejected seed');

      // 2. acknowledged=true with insertedCount missing -> reject
      await assert.rejects(
        () => ScraperRepository.getConfigs({
          isMongoConfiguredFn: () => true,
          getCollectionFn: async () => ({
            find: () => ({ toArray: async () => [] }),
            insertMany: async () => ({ acknowledged: true })
          })
        }),
        /failed confirmation/i
      );
      assert.strictEqual(JSON.stringify(repoAny.cachedSources), baselineSnapshot, 'Case 2: cache must stay unchanged on missing insertedCount');

      // 3. acknowledged=true with insertedCount=0 -> reject
      await assert.rejects(
        () => ScraperRepository.getConfigs({
          isMongoConfiguredFn: () => true,
          getCollectionFn: async () => ({
            find: () => ({ toArray: async () => [] }),
            insertMany: async () => ({ acknowledged: true, insertedCount: 0 })
          })
        }),
        /failed confirmation/i
      );
      assert.strictEqual(JSON.stringify(repoAny.cachedSources), baselineSnapshot, 'Case 3: cache must stay unchanged on zero insertedCount');

      // 4. acknowledged=true with insertedCount smaller than expected (partial) -> reject
      await assert.rejects(
        () => ScraperRepository.getConfigs({
          isMongoConfiguredFn: () => true,
          getCollectionFn: async () => ({
            find: () => ({ toArray: async () => [] }),
            insertMany: async (docs: any[]) => ({
              acknowledged: true,
              insertedCount: Math.max(1, docs.length - 1)
            })
          })
        }),
        /failed confirmation/i
      );
      assert.strictEqual(JSON.stringify(repoAny.cachedSources), baselineSnapshot, 'Case 4: cache must stay unchanged on partial insertedCount');

      // 4b. acknowledged=true with negative insertedCount -> reject
      await assert.rejects(
        () => ScraperRepository.getConfigs({
          isMongoConfiguredFn: () => true,
          getCollectionFn: async () => ({
            find: () => ({ toArray: async () => [] }),
            insertMany: async () => ({ acknowledged: true, insertedCount: -1 })
          })
        }),
        /failed confirmation/i
      );
      assert.strictEqual(JSON.stringify(repoAny.cachedSources), baselineSnapshot, 'Case 4b: cache must stay unchanged on negative insertedCount');

      // 5 & 7. acknowledged=true with insertedCount === expected document count -> succeed & update cachedSources
      let capturedDocs: any[] = [];
      const seededConfigs = await ScraperRepository.getConfigs({
        isMongoConfiguredFn: () => true,
        getCollectionFn: async () => ({
          find: () => ({ toArray: async () => [] }),
          insertMany: async (docs: any[]) => {
            capturedDocs = docs;
            return { acknowledged: true, insertedCount: docs.length };
          }
        })
      });
      assert.ok(capturedDocs.length > 0);
      assert.strictEqual(seededConfigs.length, capturedDocs.length);
      assert.deepStrictEqual(repoAny.cachedSources, seededConfigs, 'Case 7: successful seed must update cachedSources with seeded configs');

      // 8. Existing memory-only behavior remains unchanged
      repoAny.cachedSources = baselineCache.map(s => ({ ...s }));
      const memoryConfigs = await ScraperRepository.getConfigs({
        isMongoConfiguredFn: () => false
      });
      assert.strictEqual(JSON.stringify(memoryConfigs), baselineSnapshot, 'Case 8: memory-only mode must preserve cachedSources');
    } finally {
      repoAny.cachedSources = prevCachedSources;
    }
  });

  await runTest('STEP-8.4-B1 Case 2 [Mocked]: ScraperRepository.getGroups seed rejects missing/zero/partial/unacked insertedCount, succeeds only on exact count match, and preserves cache & memory mode', async () => {
    const repoAny = ScraperRepository as any;
    const prevCachedGroups = Array.isArray(repoAny.cachedGroups)
      ? repoAny.cachedGroups.map((g: any) => ({ ...g, sourceIds: [...(g.sourceIds || [])] }))
      : [];

    const baselineGroups = [
      { id: 'baseline-group-1', name: 'Baseline Group', description: 'Baseline', sourceIds: ['src-a'], createdAt: '2026-01-01', updatedAt: '2026-01-01' }
    ];
    const baselineSnapshot = JSON.stringify(baselineGroups);

    try {
      // 1. acknowledged=false with insertedCount=0 -> reject
      repoAny.cachedGroups = baselineGroups.map(g => ({ ...g, sourceIds: [...g.sourceIds] }));
      await assert.rejects(
        () => ScraperRepository.getGroups({
          isMongoConfiguredFn: () => true,
          getCollectionFn: async () => ({
            find: () => ({ sort: () => ({ toArray: async () => [] }) }),
            insertMany: async () => ({ acknowledged: false, insertedCount: 0 })
          })
        }),
        /failed confirmation/i
      );
      assert.strictEqual(JSON.stringify(repoAny.cachedGroups), baselineSnapshot, 'Case 1: cachedGroups must stay unchanged on rejected seed');

      // 2. acknowledged=true with insertedCount missing -> reject
      await assert.rejects(
        () => ScraperRepository.getGroups({
          isMongoConfiguredFn: () => true,
          getCollectionFn: async () => ({
            find: () => ({ sort: () => ({ toArray: async () => [] }) }),
            insertMany: async () => ({ acknowledged: true })
          })
        }),
        /failed confirmation/i
      );
      assert.strictEqual(JSON.stringify(repoAny.cachedGroups), baselineSnapshot, 'Case 2: cachedGroups must stay unchanged on missing insertedCount');

      // 3. acknowledged=true with insertedCount=0 -> reject
      await assert.rejects(
        () => ScraperRepository.getGroups({
          isMongoConfiguredFn: () => true,
          getCollectionFn: async () => ({
            find: () => ({ sort: () => ({ toArray: async () => [] }) }),
            insertMany: async () => ({ acknowledged: true, insertedCount: 0 })
          })
        }),
        /failed confirmation/i
      );
      assert.strictEqual(JSON.stringify(repoAny.cachedGroups), baselineSnapshot, 'Case 3: cachedGroups must stay unchanged on zero insertedCount');

      // 4. acknowledged=true with insertedCount smaller than expected (partial) -> reject
      await assert.rejects(
        () => ScraperRepository.getGroups({
          isMongoConfiguredFn: () => true,
          getCollectionFn: async () => ({
            find: () => ({ sort: () => ({ toArray: async () => [] }) }),
            insertMany: async (docs: any[]) => ({
              acknowledged: true,
              insertedCount: Math.max(1, docs.length - 1)
            })
          })
        }),
        /failed confirmation/i
      );
      assert.strictEqual(JSON.stringify(repoAny.cachedGroups), baselineSnapshot, 'Case 4: cachedGroups must stay unchanged on partial insertedCount');

      // 4b. acknowledged=true with negative insertedCount -> reject
      await assert.rejects(
        () => ScraperRepository.getGroups({
          isMongoConfiguredFn: () => true,
          getCollectionFn: async () => ({
            find: () => ({ sort: () => ({ toArray: async () => [] }) }),
            insertMany: async () => ({ acknowledged: true, insertedCount: -1 })
          })
        }),
        /failed confirmation/i
      );
      assert.strictEqual(JSON.stringify(repoAny.cachedGroups), baselineSnapshot, 'Case 4b: cachedGroups must stay unchanged on negative insertedCount');

      // 5 & 7. acknowledged=true with insertedCount === expected document count -> succeed & update cachedGroups
      let capturedGroupDocs: any[] = [];
      const seededGroups = await ScraperRepository.getGroups({
        isMongoConfiguredFn: () => true,
        getCollectionFn: async () => ({
          find: () => ({ sort: () => ({ toArray: async () => [] }) }),
          insertMany: async (docs: any[]) => {
            capturedGroupDocs = docs;
            return { acknowledged: true, insertedCount: docs.length };
          }
        })
      });
      assert.ok(capturedGroupDocs.length > 0);
      assert.strictEqual(seededGroups.length, capturedGroupDocs.length);
      assert.deepStrictEqual(repoAny.cachedGroups, seededGroups, 'Case 7: successful seed must update cachedGroups with seeded groups');

      // 8. Existing memory-only behavior remains unchanged
      repoAny.cachedGroups = baselineGroups.map(g => ({ ...g, sourceIds: [...g.sourceIds] }));
      const memoryGroups = await ScraperRepository.getGroups({
        isMongoConfiguredFn: () => false
      });
      assert.strictEqual(JSON.stringify(memoryGroups), baselineSnapshot, 'Case 8: memory-only mode must preserve cachedGroups');
    } finally {
      repoAny.cachedGroups = prevCachedGroups;
    }
  });


  // ============================================================================
  // STEP-8.4-C1: DUPLICATE LOOKUP FAIL-CLOSED, SINGLE-RUN LOCK, SAFE RESET/STOP,
  //              RUN-HISTORY FEEDBACK & ADMIN SOURCE SETTINGS SAVE SAFETY
  // ============================================================================

  const makeMockCursorCollection = (handlers: {
    exactLive?: () => Promise<any[]>;
    exactPending?: () => Promise<any[]>;
    contentLive?: () => Promise<any[]>;
    contentPending?: () => Promise<any[]>;
  }, isPending: boolean) => ({
    find: (query: any) => {
      const isInternalId = Boolean(query && 'id' in query && !('$or' in query));
      const isExact = Boolean(query && '$or' in query);
      const getDocs = async () => {
        if (isInternalId) return [];
        if (isExact) {
          if (isPending) return handlers.exactPending ? handlers.exactPending() : [];
          return handlers.exactLive ? handlers.exactLive() : [];
        }
        if (isPending) return handlers.contentPending ? handlers.contentPending() : [];
        return handlers.contentLive ? handlers.contentLive() : [];
      };

      return {
        toArray: getDocs,
        sort: () => ({
          limit: () => ({
            toArray: getDocs
          }),
          toArray: getDocs
        }),
        limit: () => ({
          toArray: getDocs
        })
      };
    }
  });

  const candidateSample = {
    id: 'cand-84c1-1',
    title: 'Software Engineer',
    company: 'Tech Corp Pakistan',
    sourceJobId: 'ext-101',
    sourceUrl: 'https://portal.gov.pk/jobs/101',
    description: 'Full stack engineering vacancy',
    extractionMethod: 'html_cheerio'
  };

  await runTest('STEP-8.4-C1 Case 1 [Mocked]: JobRepository.findDuplicateCandidates rejects when Live or Pending exact-match query fails', async () => {
    // 1. Live exact query fails even when Pending succeeds
    await assert.rejects(
      () =>
        JobRepository.findDuplicateCandidates(candidateSample, {
          isMongoConfiguredFn: () => true,
          getJobsCollectionFn: async () =>
            makeMockCursorCollection(
              {
                exactLive: async () => {
                  throw new Error('live exact query failed');
                }
              },
              false
            ),
          getPendingJobsCollectionFn: async () =>
            makeMockCursorCollection(
              {
                exactPending: async () => [{ id: 'p-1', title: 'Old Job', company: 'Tech Corp Pakistan' }]
              },
              true
            )
        }),
      /exact-match lookup failed.*live exact query failed/i
    );

    // 2. Pending exact query fails even when Live succeeds
    await assert.rejects(
      () =>
        JobRepository.findDuplicateCandidates(candidateSample, {
          isMongoConfiguredFn: () => true,
          getJobsCollectionFn: async () =>
            makeMockCursorCollection(
              {
                exactLive: async () => [{ id: 'l-1', title: 'Live Job', company: 'Tech Corp Pakistan' }]
              },
              false
            ),
          getPendingJobsCollectionFn: async () =>
            makeMockCursorCollection(
              {
                exactPending: async () => {
                  throw new Error('pending exact query failed');
                }
              },
              true
            )
        }),
      /exact-match lookup failed.*pending exact query failed/i
    );
  });

  await runTest('STEP-8.4-C1 Case 2 [Mocked]: JobRepository.findDuplicateCandidates rejects when Live or Pending content-match query fails', async () => {
    // 1. Live content query fails after exact-match succeeded
    await assert.rejects(
      () =>
        JobRepository.findDuplicateCandidates(candidateSample, {
          isMongoConfiguredFn: () => true,
          getJobsCollectionFn: async () =>
            makeMockCursorCollection(
              {
                exactLive: async () => [],
                contentLive: async () => {
                  throw new Error('live content query timed out');
                }
              },
              false
            ),
          getPendingJobsCollectionFn: async () =>
            makeMockCursorCollection(
              {
                exactPending: async () => [],
                contentPending: async () => [{ id: 'p-2', title: 'Software Engineer', company: 'Tech Corp Pakistan' }]
              },
              true
            )
        }),
      /content-match lookup failed.*live content query timed out/i
    );

    // 2. Pending content query fails after exact-match succeeded
    await assert.rejects(
      () =>
        JobRepository.findDuplicateCandidates(candidateSample, {
          isMongoConfiguredFn: () => true,
          getJobsCollectionFn: async () =>
            makeMockCursorCollection(
              {
                exactLive: async () => [],
                contentLive: async () => [{ id: 'l-2', title: 'Software Engineer', company: 'Tech Corp Pakistan' }]
              },
              false
            ),
          getPendingJobsCollectionFn: async () =>
            makeMockCursorCollection(
              {
                exactPending: async () => [],
                contentPending: async () => {
                  throw new Error('pending content query timed out');
                }
              },
              true
            )
        }),
      /content-match lookup failed.*pending content query timed out/i
    );
  });

  await runTest('STEP-8.4-C1 Case 3 [Mocked]: Failed duplicate lookup prevents candidate publish/pending insert, surfaces Database Error, preserves checkpoint, and retains earlier saved jobs', async () => {
    const prevCheckpoint = '2026-11-10T00:00:00.000Z';
    const createdLive: any[] = [];
    const insertedPending: any[] = [];
    const recordedStats: any[] = [];

    const sourceCfg = {
      id: 'src-dup-fail',
      name: 'Dup Fail Portal',
      url: 'https://portal.gov.pk/jobs',
      status: 'Active Scheduled',
      autoApprove: true,
      lastSuccessfulScrapeAt: prevCheckpoint
    };

    try {
      const summary = await executeScraperWithWizard(
        { mode: 'complete', sourceIds: [sourceCfg.id], autoPublishTrusted: true, duplicateMode: 'with' },
        {
          getConfigsFn: async () => [{ ...sourceCfg }],
          updateSourceStatsFn: async (_id, stats) => {
            recordedStats.push(stats);
          },
          addRunFn: async (run) => ({ ...run, isPersistedToMongo: false }),
          scrapePageFn: async () => [
            {
              id: 'raw-1',
              title: 'Civil Engineer',
              company: 'National Highway Authority',
              jobType: 'On-site',
              region: 'Pakistan',
              salary: 'PKR 120,000',
              currency: 'PKR',
              experienceLevel: 'Mid',
              department: 'Engineering',
              tags: [],
              description: 'First job valid and saved before second candidate lookup fails.',
              requirements: [],
              benefits: [],
              postedAt: 'Today',
              applicationsCount: 0,
              status: 'Pending',
              sourceUrl: 'https://portal.gov.pk/jobs/1',
              extractionMethod: 'html_cheerio'
            },
            {
              id: 'raw-2',
              title: 'Network Security Officer',
              company: 'Cyber Wing Islamabad',
              jobType: 'On-site',
              region: 'Pakistan',
              salary: 'PKR 150,000',
              currency: 'PKR',
              experienceLevel: 'Senior',
              department: 'IT',
              tags: [],
              description: 'Second job triggers duplicate lookup failure.',
              requirements: [],
              benefits: [],
              postedAt: 'Today',
              applicationsCount: 0,
              status: 'Pending',
              sourceUrl: 'https://portal.gov.pk/jobs/2',
              extractionMethod: 'html_cheerio'
            }
          ],
          enrichJobsFn: async (jobs) => jobs,
          findDuplicateCandidatesFn: async (job) => {
            if (job.title === 'Network Security Officer') {
              throw new Error('MongoDB connection closed during duplicate lookup');
            }
            return [];
          },
          createJobFn: async (job) => {
            createdLive.push(job);
            return job;
          },
          addPendingJobFn: async (job) => {
            insertedPending.push(job);
            return job;
          },
          auditAddFn: () => {}
        }
      );

      // Earlier saved job preserved, second candidate NEVER published or inserted into Pending
      assert.strictEqual(createdLive.length, 1, 'First verified job must remain saved without rollback');
      assert.strictEqual(createdLive[0].title, 'Civil Engineer');
      assert.strictEqual(insertedPending.length, 0, 'Failing candidate must NOT be inserted into Pending');
      assert.strictEqual(createdLive.some(j => j.title === 'Network Security Officer'), false);

      // Source failed cleanly with Database Error and checkpoint preserved
      assert.strictEqual(summary.totalFailedSources, 1);
      assert.strictEqual(summary.sourcesStats.length, 1);
      assert.strictEqual(summary.sourcesStats[0].failed, true);
      assert.strictEqual(summary.sourcesStats[0].lastSuccessfulScrapeAt, prevCheckpoint);
      assert.ok(summary.sourcesStats[0].error?.toLowerCase().includes('duplicate verification failed'));

      const failureStat = recordedStats[recordedStats.length - 1];
      assert.strictEqual(failureStat.healthStatus, 'Database Error');
      assert.strictEqual(failureStat.lastSuccessfulScrapeAt, undefined, 'Must not advance lastSuccessfulScrapeAt on failure');
    } finally {
      if (!isScraperExecutionActive()) resetActiveRun();
    }
  });

  await runTest('STEP-8.4-C1 Case 4 [Mocked]: Process-wide execution lock rejects second concurrent executeScraperWithWizard immediately (before first finishes, including while paused)', async () => {
    let releaseFirstRun!: () => void;
    const gate = new Promise<void>(resolve => {
      releaseFirstRun = resolve;
    });
    let secondInvocationStartedConfigRead = false;

    const firstPromise = executeScraperWithWizard(
      { mode: 'complete', sourceIds: ['src-lock-1'] },
      {
        getConfigsFn: async () => [
          { id: 'src-lock-1', name: 'Lock Source 1', url: 'https://portal.gov.pk/jobs', status: 'Active Scheduled' }
        ],
        updateSourceStatsFn: async () => {},
        addRunFn: async (run) => ({ ...run, isPersistedToMongo: false }),
        scrapePageFn: async () => {
          // Pause while active to verify lock stays held when paused too
          pauseActiveRun();
          await gate;
          return [];
        },
        enrichJobsFn: async (jobs) => jobs,
        findDuplicateCandidatesFn: async () => [],
        auditAddFn: () => {}
      }
    );

    try {
      // Wait one microtask until pauseActiveRun is hit inside scrapePageFn
      await new Promise(r => setTimeout(r, 15));
      assert.strictEqual(isScraperExecutionActive(), true);
      const snapshotBeforeSecond = getActiveRunStatus();
      assert.strictEqual(snapshotBeforeSecond.isActive, true);
      assert.strictEqual(snapshotBeforeSecond.isPaused, true);

      // Concurrent second attempt must throw synchronously/immediately without overwriting activeRunState
      let caughtErr: any = null;
      try {
        await executeScraperWithWizard(
          { mode: 'complete', sourceIds: ['src-lock-2'] },
          {
            getConfigsFn: async () => {
              secondInvocationStartedConfigRead = true;
              return [];
            }
          }
        );
      } catch (err) {
        caughtErr = err;
      }

      assert.ok(caughtErr, 'Second concurrent run must reject');
      assert.strictEqual(isScraperRunConflictError(caughtErr), true);
      assert.strictEqual(caughtErr.code, SCRAPER_RUN_ALREADY_ACTIVE_CODE);
      assert.strictEqual(caughtErr.status, 409);
      assert.strictEqual(secondInvocationStartedConfigRead, false, 'Lock must be acquired before first await');

      // Active state and pause state must remain intact
      const snapshotAfterSecond = getActiveRunStatus();
      assert.strictEqual(snapshotAfterSecond.runId, snapshotBeforeSecond.runId);
      assert.strictEqual(snapshotAfterSecond.isPaused, true);
    } finally {
      resumeActiveRun();
      releaseFirstRun();
      await firstPromise;
      resetActiveRun();
    }
  });

  await runTest('STEP-8.4-C1 Case 5 [Mocked]: executeScraperWithWizard releases execution lock reliably on success, failure, and empty-target early exits', async () => {
    try {
      // 1. Empty sourceIds early exit releases lock
      const emptySummary = await executeScraperWithWizard(
        { mode: 'complete', sourceIds: [] },
        { getConfigsFn: async () => [] }
      );
      assert.strictEqual(emptySummary.totalFound, 0);
      assert.strictEqual(isScraperExecutionActive(), false, 'Lock must release after empty sourceIds early exit');

      // 2. Unmatched sourceIds early exit releases lock
      const noMatchSummary = await executeScraperWithWizard(
        { mode: 'complete', sourceIds: ['nonexistent-src'] },
        { getConfigsFn: async () => [{ id: 'other-src', name: 'Other', url: 'https://portal.gov.pk', status: 'Active Scheduled' }] }
      );
      assert.strictEqual(noMatchSummary.totalFound, 0);
      assert.strictEqual(isScraperExecutionActive(), false, 'Lock must release after no-match early exit');

      // 3. Throwing getConfigsFn releases lock
      await assert.rejects(
        () =>
          executeScraperWithWizard(
            { mode: 'complete' },
            {
              getConfigsFn: async () => {
                throw new Error('DB read error during config fetch');
              }
            }
          ),
        /DB read error/
      );
      assert.strictEqual(isScraperExecutionActive(), false, 'Lock must release on config fetch failure');

      // 4. Subsequent run succeeds cleanly proving lock was released
      const okSummary = await executeScraperWithWizard(
        { mode: 'complete', sourceIds: ['src-after'] },
        {
          getConfigsFn: async () => [{ id: 'src-after', name: 'After Source', url: 'https://portal.gov.pk/jobs', status: 'Active Scheduled' }],
          updateSourceStatsFn: async () => {},
          addRunFn: async (run) => ({ ...run, isPersistedToMongo: false }),
          scrapePageFn: async () => [],
          enrichJobsFn: async (jobs) => jobs,
          auditAddFn: () => {}
        }
      );
      assert.ok(okSummary.runId);
      assert.strictEqual(isScraperExecutionActive(), false);
    } finally {
      if (!isScraperExecutionActive()) resetActiveRun();
    }
  });

  await runTest('STEP-8.4-C1 Case 6 [Mocked]: scraperScheduler.runSchedulerTick aborts cleanly on SCRAPER_RUN_ALREADY_ACTIVE (409) without advancing schedules or counting skipped source', async () => {
    const dueTime = new Date(Date.now() - 60000).toISOString();
    const sources = [
      {
        id: 'sched-409-1',
        name: 'Due Source 1',
        status: 'Active Scheduled',
        interval: '1h',
        lastRunAt: undefined as string | undefined,
        lastCompletedAt: undefined as string | undefined,
        nextRunAt: dueTime
      },
      {
        id: 'sched-409-2',
        name: 'Due Source 2',
        status: 'Active Scheduled',
        interval: '1h',
        lastRunAt: undefined as string | undefined,
        lastCompletedAt: undefined as string | undefined,
        nextRunAt: dueTime
      }
    ];
    const scheduleUpdates: any[] = [];
    const executedIds: string[] = [];

    const tickRes = await runSchedulerTick({
      isScraperEnabledFn: () => true,
      isAutoApproveEnabledFn: () => false,
      getSchedulerSettingsFn: async () => ({
        ...getDefaultSchedulerSettings(),
        enabled: true,
        scope: 'all'
      }),
      getConfigsFn: async () => sources,
      updateSourceScheduleFn: async (id, sched) => {
        scheduleUpdates.push({ id, sched });
        return true;
      },
      executeScraperFn: async (opts) => {
        executedIds.push(opts.sourceId || '');
        const err: any = new Error('Another scraper execution is already in progress');
        err.code = SCRAPER_RUN_ALREADY_ACTIVE_CODE;
        err.status = 409;
        err.statusCode = 409;
        throw err;
      }
    });

    assert.strictEqual(executedIds.length, 1, 'Must stop tick on first 409 conflict without hitting second source');
    assert.deepStrictEqual(tickRes.triggeredSources, [], 'Skipped source must not be counted in triggeredSources');
    assert.strictEqual(tickRes.aborted, true);
    assert.strictEqual(tickRes.skippedDueToConflict, true);
    assert.strictEqual(scheduleUpdates.length, 0, 'Skipped source schedule (lastRunAt/lastCompletedAt/nextRunAt) must not be updated');
    assert.strictEqual(sources[0].nextRunAt, dueTime, 'Original nextRunAt must remain due so next tick can pick it up');
    assert.strictEqual(sources[0].lastRunAt, undefined);
    assert.strictEqual(sources[0].lastCompletedAt, undefined);
  });

  await runTest('STEP-8.4-C1 Case 7 [Integration]: POST /run, POST /retry, and POST /groups/:id/run return HTTP 409 when a run is active', async () => {
    const repoAny = ScraperRepository as any;
    const prevCachedSources = repoAny.cachedSources ? [...repoAny.cachedSources] : [];
    const prevCachedGroups = repoAny.cachedGroups ? [...repoAny.cachedGroups] : [];

    let releaseRun!: () => void;
    const gate = new Promise<void>(resolve => {
      releaseRun = resolve;
    });

    const invokePostRoute = async (routePath: string, body: any = {}, params: any = {}) => {
      const layer = (scraperRouter as any).stack.find(
        (l: any) => l.route && l.route.path === routePath && l.route.methods.post
      );
      assert.ok(layer, `Expected POST route ${routePath} on scraperRouter`);
      const finalHandler = layer.route.stack[layer.route.stack.length - 1].handle;
      let statusCode = 200;
      let payload: any = null;
      const req: any = { body, params, user: { name: 'Admin' } };
      const res: any = {
        status(code: number) {
          statusCode = code;
          return res;
        },
        json(data: any) {
          payload = data;
          return res;
        }
      };
      await finalHandler(req, res, () => {});
      return { statusCode, payload };
    };

    repoAny.cachedSources = [
      { id: 'route-409-src', name: 'Route 409 Portal', url: 'https://portal.gov.pk/jobs', status: 'Active Scheduled' }
    ];
    repoAny.cachedGroups = [
      { id: 'route-409-grp', name: 'Route 409 Group', description: 'Test', sourceIds: ['route-409-src'], createdAt: '2026-01-01', updatedAt: '2026-01-01' }
    ];

    const activePromise = executeScraperWithWizard(
      { mode: 'complete', sourceIds: ['route-409-src'] },
      {
        getConfigsFn: async () => repoAny.cachedSources,
        updateSourceStatsFn: async () => {},
        addRunFn: async (run) => ({ ...run, isPersistedToMongo: false }),
        scrapePageFn: async () => {
          await gate;
          return [];
        },
        enrichJobsFn: async (jobs) => jobs,
        auditAddFn: () => {}
      }
    );

    try {
      await new Promise(r => setTimeout(r, 15));

      const runResp = await invokePostRoute('/run', { mode: 'complete', sourceIds: ['route-409-src'] });
      assert.strictEqual(runResp.statusCode, 409, 'POST /run must return HTTP 409 while active');
      assert.strictEqual(runResp.payload.success, false);
      assert.strictEqual(runResp.payload.code, SCRAPER_RUN_ALREADY_ACTIVE_CODE);

      const retryResp = await invokePostRoute('/retry', { sourceIds: ['route-409-src'] });
      assert.strictEqual(retryResp.statusCode, 409, 'POST /retry must return HTTP 409 while active');
      assert.strictEqual(retryResp.payload.success, false);
      assert.strictEqual(retryResp.payload.code, SCRAPER_RUN_ALREADY_ACTIVE_CODE);

      const groupResp = await invokePostRoute('/groups/:id/run', {}, { id: 'route-409-grp' });
      assert.strictEqual(groupResp.statusCode, 409, 'POST /groups/:id/run must return HTTP 409 while active');
      assert.strictEqual(groupResp.payload.success, false);
      assert.strictEqual(groupResp.payload.code, SCRAPER_RUN_ALREADY_ACTIVE_CODE);
    } finally {
      releaseRun();
      await activePromise;
      resetActiveRun();
      repoAny.cachedSources = prevCachedSources;
      repoAny.cachedGroups = prevCachedGroups;
    }
  });

  await runTest('STEP-8.4-C1 Case 8 [Integration]: resetActiveRun refuses reset while run is active and POST /active-run/reset returns HTTP 409', async () => {
    let releaseRun!: () => void;
    const gate = new Promise<void>(resolve => {
      releaseRun = resolve;
    });

    const resetLayer = (scraperRouter as any).stack.find(
      (l: any) => l.route && l.route.path === '/active-run/reset' && l.route.methods.post
    );
    assert.ok(resetLayer);
    const resetHandler = resetLayer.route.stack[resetLayer.route.stack.length - 1].handle;

    const activePromise = executeScraperWithWizard(
      { mode: 'complete', sourceIds: ['reset-lock-src'] },
      {
        getConfigsFn: async () => [{ id: 'reset-lock-src', name: 'Reset Lock Portal', url: 'https://portal.gov.pk/jobs', status: 'Active Scheduled' }],
        updateSourceStatsFn: async () => {},
        addRunFn: async (run) => ({ ...run, isPersistedToMongo: false }),
        scrapePageFn: async () => {
          pauseActiveRun();
          await gate;
          return [];
        },
        enrichJobsFn: async (jobs) => jobs,
        auditAddFn: () => {}
      }
    );

    try {
      await new Promise(r => setTimeout(r, 15));
      const beforeStatus = getActiveRunStatus();
      assert.strictEqual(beforeStatus.isActive, true);
      assert.strictEqual(beforeStatus.isPaused, true);

      // Direct resetActiveRun throws conflict without clearing state
      assert.throws(() => resetActiveRun(), /Cannot reset active scraper run/i);
      const afterDirect = getActiveRunStatus();
      assert.strictEqual(afterDirect.isActive, true);
      assert.strictEqual(afterDirect.isPaused, true);
      assert.strictEqual(afterDirect.runId, beforeStatus.runId);

      // Route POST /active-run/reset returns HTTP 409 with success=false
      let routeStatus = 200;
      let routeJson: any = null;
      await resetHandler(
        { body: {}, params: {} },
        {
          status(code: number) {
            routeStatus = code;
            return this;
          },
          json(data: any) {
            routeJson = data;
            return this;
          }
        },
        () => {}
      );
      assert.strictEqual(routeStatus, 409);
      assert.strictEqual(routeJson.success, false);
      assert.strictEqual(routeJson.code, SCRAPER_RUN_ALREADY_ACTIVE_CODE);
      assert.strictEqual(routeJson.activeRun.isActive, true);
    } finally {
      resumeActiveRun();
      releaseRun();
      await activePromise;
      resetActiveRun();
    }
  });

  await runTest('STEP-8.4-C1 Case 9 [Unit]: resetActiveRun succeeds normally after active run ends or stops', async () => {
    const summary = await executeScraperWithWizard(
      { mode: 'complete', sourceIds: ['reset-ok-src'] },
      {
        getConfigsFn: async () => [{ id: 'reset-ok-src', name: 'Reset OK Portal', url: 'https://portal.gov.pk/jobs', status: 'Active Scheduled' }],
        updateSourceStatsFn: async () => {},
        addRunFn: async (run) => ({ ...run, isPersistedToMongo: false }),
        scrapePageFn: async () => [],
        enrichJobsFn: async (jobs) => jobs,
        auditAddFn: () => {}
      }
    );
    assert.strictEqual(summary.status, 'Completed');
    assert.strictEqual(isScraperExecutionActive(), false);

    const resetState = resetActiveRun();
    assert.strictEqual(resetState.isActive, false);
    assert.strictEqual(resetState.completedSources, 0);
    assert.strictEqual(resetState.runProgress, 0);
    assert.strictEqual(resetState.stopped, false);
  });

  await runTest('STEP-8.4-C1 Case 10 [Mocked]: Graceful stop marks run Stopped (not Completed), preserves partial completedSources/runProgress, and deriveRunStatus returns Stopped', async () => {
    const savedRuns: any[] = [];
    const sources = [
      { id: 'stop-1', name: 'Source 1', url: 'https://portal1.gov.pk/jobs', status: 'Active Scheduled' },
      { id: 'stop-2', name: 'Source 2', url: 'https://portal2.gov.pk/jobs', status: 'Active Scheduled' },
      { id: 'stop-3', name: 'Source 3', url: 'https://portal3.gov.pk/jobs', status: 'Active Scheduled' }
    ];
    let crawledSourceCount = 0;

    try {
      const summary = await executeScraperWithWizard(
        { mode: 'complete', sourceIds: ['stop-1', 'stop-2', 'stop-3'] },
        {
          getConfigsFn: async () => sources,
          updateSourceStatsFn: async () => {},
          addRunFn: async (run) => {
            savedRuns.push(run);
            return { ...run, isPersistedToMongo: false };
          },
          scrapePageFn: async () => {
            crawledSourceCount++;
            if (crawledSourceCount === 1) {
              // Trigger stop while processing first source so source 2 and 3 are skipped
              stopActiveRun();
            }
            return [];
          },
          enrichJobsFn: async (jobs) => jobs,
          auditAddFn: () => {}
        }
      );

      assert.strictEqual(crawledSourceCount, 1, 'Remaining 2 sources must not run after stop');
      assert.strictEqual(summary.stopped, true);
      assert.strictEqual(summary.status, 'Stopped');
      assert.strictEqual(summary.targetsScraped, 1);
      assert.ok(summary.message?.toLowerCase().includes('stopped early after 1 of 3 sources'));

      const postStatus = getActiveRunStatus();
      assert.strictEqual(postStatus.isActive, false);
      assert.strictEqual(postStatus.stopped, true);
      assert.strictEqual(postStatus.completedSources, 1, 'Must reflect actual processed sources, not 3');
      assert.strictEqual(postStatus.remainingSources, 2);
      assert.strictEqual(postStatus.runProgress, 33, 'Must not force runProgress to 100 after early stop');

      assert.strictEqual(savedRuns.length, 1);
      assert.strictEqual(savedRuns[0].stopped, true);
      assert.strictEqual(savedRuns[0].status, 'Stopped');
      assert.strictEqual(savedRuns[0].targetsScraped, 1);

      assert.strictEqual(deriveRunStatus(savedRuns[0]), 'Stopped');
      assert.strictEqual(deriveRunStatus({ failedSources: 0, targetsScraped: 3, stopped: true }), 'Stopped');
      assert.strictEqual(deriveRunStatus({ failedSources: 0, targetsScraped: 3 }), 'Completed');
      assert.strictEqual(deriveRunStatus({ failedSources: 1, targetsScraped: 3 }), 'Partial');
      assert.strictEqual(deriveRunStatus({ failedSources: 3, targetsScraped: 3 }), 'Failed');
    } finally {
      if (!isScraperExecutionActive()) resetActiveRun();
    }
  });

  await runTest('STEP-8.4-C1 Case 11 [Mocked]: executeScraperWithWizard surfaces failed addRun persistence cleanly without losing saved jobs', async () => {
    const savedJobs: any[] = [];
    try {
      const summary = await executeScraperWithWizard(
        { mode: 'complete', sourceIds: ['hist-fail-src'] },
        {
          getConfigsFn: async () => [
            { id: 'hist-fail-src', name: 'Hist Fail Portal', url: 'https://portal.gov.pk/jobs', status: 'Active Scheduled', autoApprove: false }
          ],
          updateSourceStatsFn: async () => {},
          addRunFn: async (run) => ({
            ...run,
            isPersistedToMongo: false,
            persistenceError: 'MongoDB write timeout on scraper_runs'
          }),
          scrapePageFn: async () => [
            {
              id: 'hist-job-1',
              title: 'Project Coordinator',
              company: 'Planning Commission',
              jobType: 'On-site',
              region: 'Pakistan',
              salary: 'PKR 100,000',
              currency: 'PKR',
              experienceLevel: 'Mid',
              department: 'Planning',
              tags: [],
              description: 'Valid saved vacancy even when addRun fails.',
              requirements: [],
              benefits: [],
              postedAt: 'Today',
              applicationsCount: 0,
              status: 'Pending',
              sourceUrl: 'https://portal.gov.pk/jobs/pc',
              extractionMethod: 'html_cheerio'
            }
          ],
          enrichJobsFn: async (jobs) => jobs,
          findDuplicateCandidatesFn: async () => [],
          addPendingJobFn: async (job) => {
            savedJobs.push(job);
            return job;
          },
          auditAddFn: () => {}
        }
      );

      assert.strictEqual(savedJobs.length, 1, 'Saved jobs must remain intact');
      assert.strictEqual(summary.totalPending, 1);
      assert.strictEqual(summary.totalFailedSources, 0);
      assert.strictEqual(summary.historyPersistedToMongo, false);
      assert.strictEqual(summary.historyPersistenceMode, 'failed');
      assert.strictEqual(summary.historyPersistenceError, 'MongoDB write timeout on scraper_runs');
      assert.ok(summary.message?.includes('Run history was not saved to MongoDB'));
    } finally {
      if (!isScraperExecutionActive()) resetActiveRun();
    }
  });

  await runTest('STEP-8.4-C1 Case 12 [Mocked]: Successful ScraperRepository.addRun persistence distinguishes mongodb vs memory modes in run summary', async () => {
    try {
      const mongoResult = await ScraperRepository.addRun(
        { id: 'run-mongo-ok', mode: 'complete', totalFound: 2 },
        {
          isMongoConfiguredFn: () => true,
          getCollectionFn: async () => ({
            insertOne: async () => ({ acknowledged: true })
          })
        }
      );
      assert.strictEqual(mongoResult.isPersistedToMongo, true);

      const mongoSummary = await executeScraperWithWizard(
        { mode: 'complete', sourceIds: ['hist-ok-src'] },
        {
          getConfigsFn: async () => [
            { id: 'hist-ok-src', name: 'Hist OK Portal', url: 'https://portal.gov.pk/jobs', status: 'Active Scheduled' }
          ],
          updateSourceStatsFn: async () => {},
          addRunFn: async () => mongoResult,
          scrapePageFn: async () => [],
          enrichJobsFn: async (jobs) => jobs,
          auditAddFn: () => {}
        }
      );
      assert.strictEqual(mongoSummary.historyPersistedToMongo, true);
      assert.strictEqual(mongoSummary.historyPersistenceMode, 'mongodb');
      assert.strictEqual(mongoSummary.historyPersistenceError, undefined);

      const memorySummary = await executeScraperWithWizard(
        { mode: 'complete', sourceIds: ['hist-mem-src'] },
        {
          getConfigsFn: async () => [
            { id: 'hist-mem-src', name: 'Hist Mem Portal', url: 'https://portal.gov.pk/jobs', status: 'Active Scheduled' }
          ],
          updateSourceStatsFn: async () => {},
          addRunFn: async (run) =>
            ScraperRepository.addRun(run, { isMongoConfiguredFn: () => false }),
          scrapePageFn: async () => [],
          enrichJobsFn: async (jobs) => jobs,
          auditAddFn: () => {}
        }
      );
      assert.strictEqual(memorySummary.historyPersistedToMongo, false);
      assert.strictEqual(memorySummary.historyPersistenceMode, 'memory');
      assert.strictEqual(memorySummary.historyPersistenceError, undefined);
    } finally {
      if (!isScraperExecutionActive()) resetActiveRun();
    }
  });

  await runTest('STEP-8.4-C1 Case 13 [Mocked]: All 6 admin source config handlers retain previous state and report error when saveConfigs fails or returns success=false', async () => {
    const initialSources: any[] = [
      { id: 's-1', name: 'Portal One', url: 'https://one.gov.pk', category: 'Government Sector', region: 'Pakistan', status: 'Active Scheduled', interval: '24h', autoApprove: false },
      { id: 's-2', name: 'Portal Two', url: 'https://two.gov.pk', category: 'Government Sector', region: 'Pakistan', status: 'Paused', interval: '24h', autoApprove: true }
    ];

    const runFailureCase = async (name: string, updatedSources: any[], mode: 'false' | 'reject') => {
      let liveState = initialSources.map(s => ({ ...s }));
      let propsState = initialSources.map(s => ({ ...s }));
      let selectedIds = ['s-1', 's-2'];
      let modalClosed = false;
      let statusMsg: any = null;

      const ok = await saveAndApplySourceConfigUpdate({
        updatedSources,
        saveConfigsFn: async () => {
          if (mode === 'reject') throw new Error(`Network failure on ${name}`);
          return { success: false, message: `MongoDB error on ${name}` };
        },
        setLiveSourcesFn: (next) => {
          liveState = next;
        },
        propsSetSourcesFn: (next) => {
          propsState = next;
        },
        afterApplyFn: () => {
          selectedIds = selectedIds.filter(id => id !== 's-1');
          modalClosed = true;
        },
        setStatusMessageFn: (msg) => {
          statusMsg = msg;
        },
        successText: 'Saved',
        fallbackErrorText: 'Save failed'
      });

      assert.strictEqual(ok, false, `${name} (${mode}) must return false`);
      assert.deepStrictEqual(liveState, initialSources, `${name} (${mode}): liveSources must remain unchanged`);
      assert.deepStrictEqual(propsState, initialSources, `${name} (${mode}): propsSetSources must remain unchanged`);
      assert.deepStrictEqual(selectedIds, ['s-1', 's-2'], `${name} (${mode}): selectedSourceIds must remain unchanged`);
      assert.strictEqual(modalClosed, false, `${name} (${mode}): post-save cleanup must not execute on failure`);
      assert.strictEqual(statusMsg?.type, 'error', `${name} (${mode}): must surface error status`);
    };

    const newSrc: any = { id: 's-3', name: 'Portal Three', url: 'https://three.gov.pk', category: 'Government Sector', region: 'Pakistan', status: 'Active Scheduled', interval: '24h', autoApprove: false };
    const candidateMutations: Array<[string, any[]]> = [
      ['handleToggleSourceStatus', computeToggledSourceStatus(initialSources, 's-1')],
      ['handleToggleAutoApprove', computeToggledAutoApprove(initialSources, 's-1')],
      ['handleDeleteSource', computeDeletedSourceList(initialSources, 's-1')],
      ['handleAddNewSource', computeAddedSourceList(initialSources, newSrc)],
      ['handleBulkToggleStatus', computeBulkStatusSources(initialSources, ['s-1', 's-2'], false)],
      ['handleBulkSetAutoApprove', computeBulkAutoApproveSources(initialSources, ['s-1', 's-2'], true)]
    ];

    for (const [handlerName, updatedList] of candidateMutations) {
      await runFailureCase(handlerName, updatedList, 'false');
      await runFailureCase(handlerName, updatedList, 'reject');
    }
  });

  await runTest('STEP-8.4-C1 Case 14 [Mocked]: All 6 admin source config handlers update state and show success only after confirmed saveConfigs success=true', async () => {
    const initialSources: any[] = [
      { id: 's-1', name: 'Portal One', url: 'https://one.gov.pk', category: 'Government Sector', region: 'Pakistan', status: 'Active Scheduled', interval: '24h', autoApprove: false },
      { id: 's-2', name: 'Portal Two', url: 'https://two.gov.pk', category: 'Government Sector', region: 'Pakistan', status: 'Paused', interval: '24h', autoApprove: false }
    ];

    // Verify async ordering: state must NOT be updated before saveConfigs resolves
    let resolveSave!: (val: any) => void;
    const pendingSave = new Promise(resolve => {
      resolveSave = resolve;
    });
    let liveState = initialSources.map(s => ({ ...s }));
    let propsState = initialSources.map(s => ({ ...s }));
    let selectedIds = ['s-1', 's-2'];
    let statusMsg: any = null;

    const toggled = computeToggledSourceStatus(initialSources, 's-1');
    const togglePromise = saveAndApplySourceConfigUpdate({
      updatedSources: toggled,
      saveConfigsFn: () => pendingSave,
      setLiveSourcesFn: next => { liveState = next; },
      propsSetSourcesFn: next => { propsState = next; },
      setStatusMessageFn: msg => { statusMsg = msg; },
      successText: 'Source status updated.',
      fallbackErrorText: 'Failed'
    });

    await new Promise(r => setTimeout(r, 10));
    assert.strictEqual(liveState[0].status, 'Active Scheduled', 'State must wait for backend confirmation before updating');
    assert.strictEqual(statusMsg, null);

    resolveSave({ success: true });
    const toggleOk = await togglePromise;
    assert.strictEqual(toggleOk, true);
    assert.strictEqual(liveState[0].status, 'Paused');
    assert.strictEqual(propsState[0].status, 'Paused');
    assert.strictEqual(statusMsg.type, 'success');

    // Verify remaining 5 mutations succeed after saveConfigs resolves { success: true }
    const deleteOk = await saveAndApplySourceConfigUpdate({
      updatedSources: computeDeletedSourceList(initialSources, 's-1'),
      saveConfigsFn: async () => ({ success: true }),
      setLiveSourcesFn: next => { liveState = next; },
      propsSetSourcesFn: next => { propsState = next; },
      afterApplyFn: () => { selectedIds = selectedIds.filter(id => id !== 's-1'); },
      setStatusMessageFn: msg => { statusMsg = msg; },
      successText: 'Deleted',
      fallbackErrorText: 'Failed'
    });
    assert.strictEqual(deleteOk, true);
    assert.strictEqual(liveState.length, 1);
    assert.deepStrictEqual(selectedIds, ['s-2']);

    const bulkAuto = computeBulkAutoApproveSources(initialSources, ['s-1', 's-2'], true);
    assert.strictEqual(bulkAuto.every(s => s.autoApprove === true), true);
    const bulkStat = computeBulkStatusSources(initialSources, ['s-1', 's-2'], true);
    assert.strictEqual(bulkStat.every(s => s.status === 'Active Scheduled'), true);
    const toggledAuto = computeToggledAutoApprove(initialSources, 's-1');
    assert.strictEqual(toggledAuto[0].autoApprove, true);
    const added = computeAddedSourceList(initialSources, { ...initialSources[0], id: 's-3', name: 'New' });
    assert.strictEqual(added.length, 3);
    assert.strictEqual(added[0].id, 's-3');
  });

  await runTest('STEP-8.4-C1 Case 15 [Unit]: Admin feedback surfaces run-history persistence warning and preserves active state on reset 409 conflict', () => {
    // 1. Run succeeded at scraping jobs, but run history failed to persist to MongoDB
    const histWarn = buildScraperRunFeedback(
      {
        success: true,
        totalFound: 12,
        jobsAccepted: 10,
        totalDuplicates: 2,
        historyPersistedToMongo: false,
        historyPersistenceMode: 'failed',
        historyPersistenceError: 'E11000 duplicate key / timeout'
      },
      {
        actionLabel: 'Run',
        successText: 'Scraper finished! Discovered 12 jobs (10 approved, 2 duplicates).',
        emptyWarningText: 'Scraper execution finished with notices.'
      }
    );
    assert.strictEqual(histWarn.historyFailed, true);
    assert.strictEqual(histWarn.type, 'error', 'History persistence failure must surface as visible warning/error alert');
    assert.ok(histWarn.text.includes('12 jobs'));
    assert.ok(histWarn.text.includes('Run history was NOT saved to MongoDB'));
    assert.ok(histWarn.logText.includes('E11000'));

    // 2. Clean stopped run feedback renders honest stopped notice
    const stoppedFeedback = buildScraperRunFeedback(
      {
        success: true,
        stopped: true,
        status: 'Stopped',
        message: 'Scrape run stopped early after 1 of 3 sources.'
      },
      {
        actionLabel: 'Run',
        successText: 'Completed',
        emptyWarningText: 'Notice'
      }
    );
    assert.strictEqual(stoppedFeedback.type, 'info');
    assert.ok(stoppedFeedback.text.includes('stopped early'));

    // 3. Reset blocked by 409 does not clear isScrapingActive
    let isScraping = true;
    let activeRun = { isActive: true, runId: 'RUN-ACTIVE' };
    let resetStatus: any = null;
    const logs: string[] = [];
    const didReset = applyResetActiveRunResult(
      {
        success: false,
        code: SCRAPER_RUN_ALREADY_ACTIVE_CODE,
        message: 'Cannot reset active scraper run while execution is running.',
        activeRun: { isActive: true, runId: 'RUN-ACTIVE' }
      },
      {
        setActiveRunStatus: s => { activeRun = s; },
        setIsScrapingActive: v => { isScraping = v; },
        logMessage: m => logs.push(m),
        setStatusMessage: m => { resetStatus = m; }
      }
    );
    assert.strictEqual(didReset, false);
    assert.strictEqual(isScraping, true, 'Rejected reset must not clear active UI state');
    assert.strictEqual(activeRun.isActive, true);
    assert.strictEqual(resetStatus.type, 'error');
    assert.ok(logs.some(l => l.includes('Reset blocked')));
  });

  await runTest('STEP-8.4-C2 Case 1 [Mocked]: While execution lock is held before activeRunState initialization, getActiveRunStatus().isActive must be true', async () => {
    resetActiveRun();
    assert.strictEqual(getActiveRunStatus().isActive, false);

    let releasePreInit!: () => void;
    const preInitGate = new Promise<void>(resolve => {
      releasePreInit = resolve;
    });

    const runPromise = executeScraperWithWizard(
      { mode: 'complete', sourceIds: ['pre-init-src'] },
      {
        getConfigsFn: async () => {
          await preInitGate;
          return [];
        }
      }
    );

    try {
      await new Promise(r => setTimeout(r, 10));
      const preInitStatus = getActiveRunStatus();
      assert.strictEqual(isScraperExecutionActive(), true, 'Execution lock must be active while awaiting getConfigsFn');
      assert.strictEqual(preInitStatus.isActive, true, 'getActiveRunStatus().isActive must be true before activeRunState initialization');

      let conflictErr: any = null;
      try {
        await executeScraperWithWizard({ mode: 'complete', sourceIds: ['pre-init-src-2'] }, { getConfigsFn: async () => [] });
      } catch (err) {
        conflictErr = err;
      }
      assert.ok(conflictErr, 'Concurrent run during pre-init window must reject');
      assert.strictEqual(isScraperRunConflictError(conflictErr), true);
      assert.strictEqual(conflictErr.activeRun?.isActive, true, 'Conflict activeRun payload must report isActive=true');
    } finally {
      releasePreInit();
      await runPromise;
      resetActiveRun();
    }
  });

  await runTest('STEP-8.4-C2 Case 2 [Mocked]: During final history persistence, getActiveRunStatus().isActive remains true while lock is held and preserves run metrics', async () => {
    resetActiveRun();

    let releaseHistory!: () => void;
    const historyGate = new Promise<void>(resolve => {
      releaseHistory = resolve;
    });
    let observedDuringHistory: any = null;
    let persistedRunId: string | undefined;

    const activeGetLayer = (scraperRouter as any).stack.find(
      (l: any) => l.route && l.route.path === '/active-run' && l.route.methods.get
    );
    assert.ok(activeGetLayer);
    const activeGetHandler = activeGetLayer.route.stack[activeGetLayer.route.stack.length - 1].handle;

    const runPromise = executeScraperWithWizard(
      { mode: 'complete', sourceIds: ['hist-lock-src'] },
      {
        getConfigsFn: async () => [
          { id: 'hist-lock-src', name: 'History Lock Portal', url: 'https://portal.gov.pk/jobs', status: 'Active Scheduled' }
        ],
        updateSourceStatsFn: async () => {},
        scrapePageFn: async () => [],
        enrichJobsFn: async (jobs) => jobs,
        auditAddFn: () => {},
        addRunFn: async (run) => {
          persistedRunId = run.id;
          observedDuringHistory = getActiveRunStatus();
          await historyGate;
          return { ...run, isPersistedToMongo: false };
        }
      }
    );

    try {
      await new Promise(r => setTimeout(r, 15));
      assert.ok(observedDuringHistory, 'addRunFn should have been entered');
      assert.strictEqual(observedDuringHistory.isActive, true, 'getActiveRunStatus().isActive must remain true during final history persistence');
      assert.strictEqual(observedDuringHistory.runId, persistedRunId, 'runId must be preserved during final history persistence');
      assert.strictEqual(observedDuringHistory.completedSources, 1, 'completedSources must be preserved during final history persistence');
      assert.strictEqual(observedDuringHistory.runProgress, 100, 'runProgress must be preserved during final history persistence');

      let routePayload: any = null;
      activeGetHandler(
        { body: {}, params: {} },
        { json(data: any) { routePayload = data; return this; } },
        () => {}
      );
      assert.strictEqual(routePayload?.activeRun?.isActive, true, 'GET /active-run must report isActive=true during final history persistence');

      let conflictErr: any = null;
      try {
        await executeScraperWithWizard({ mode: 'complete', sourceIds: ['hist-lock-src-2'] }, { getConfigsFn: async () => [] });
      } catch (err) {
        conflictErr = err;
      }
      assert.strictEqual(isScraperRunConflictError(conflictErr), true, 'Lock must still block concurrent runs during final history persistence');
      assert.strictEqual(conflictErr.activeRun?.isActive, true);
    } finally {
      releaseHistory();
      await runPromise;
      resetActiveRun();
    }
  });

  await runTest('STEP-8.4-C2 Case 3 [Mocked]: After lock release (completion, early stop, and error exits), getActiveRunStatus().isActive must be false', async () => {
    resetActiveRun();

    await executeScraperWithWizard(
      { mode: 'complete', sourceIds: ['unlock-ok'] },
      {
        getConfigsFn: async () => [
          { id: 'unlock-ok', name: 'Unlock OK Portal', url: 'https://portal.gov.pk/jobs', status: 'Active Scheduled' }
        ],
        updateSourceStatsFn: async () => {},
        addRunFn: async (run) => ({ ...run, isPersistedToMongo: false }),
        scrapePageFn: async () => [],
        enrichJobsFn: async (jobs) => jobs,
        auditAddFn: () => {}
      }
    );
    assert.strictEqual(isScraperExecutionActive(), false);
    assert.strictEqual(getActiveRunStatus().isActive, false, 'Status must be inactive after normal completion');

    await assert.rejects(
      () =>
        executeScraperWithWizard(
          { mode: 'complete', sourceIds: ['unlock-err'] },
          {
            getConfigsFn: async () => {
              throw new Error('Config load failure');
            }
          }
        ),
      /Config load failure/
    );
    assert.strictEqual(isScraperExecutionActive(), false);
    assert.strictEqual(getActiveRunStatus().isActive, false, 'Status must be inactive after error exit');

    await executeScraperWithWizard(
      { mode: 'complete', sourceIds: ['unlock-stop-1', 'unlock-stop-2'] },
      {
        getConfigsFn: async () => [
          { id: 'unlock-stop-1', name: 'Unlock Stop 1', url: 'https://portal1.gov.pk/jobs', status: 'Active Scheduled' },
          { id: 'unlock-stop-2', name: 'Unlock Stop 2', url: 'https://portal2.gov.pk/jobs', status: 'Active Scheduled' }
        ],
        updateSourceStatsFn: async () => {},
        addRunFn: async (run) => ({ ...run, isPersistedToMongo: false }),
        scrapePageFn: async () => {
          stopActiveRun();
          return [];
        },
        enrichJobsFn: async (jobs) => jobs,
        auditAddFn: () => {}
      }
    );
    assert.strictEqual(isScraperExecutionActive(), false);
    const stoppedStatus = getActiveRunStatus();
    assert.strictEqual(stoppedStatus.isActive, false, 'Status must be inactive after stopped run releases lock');
    assert.strictEqual(stoppedStatus.stopped, true);
    resetActiveRun();
  });

  await runTest('STEP-8.4-C2 Case 4 [Integration]: POST /scheduler-tick returns HTTP 409 and success=false when runSchedulerTick returns skippedDueToConflict=true', async () => {
    const repoAny = ScraperRepository as any;
    const prevCachedSources = repoAny.cachedSources ? [...repoAny.cachedSources] : [];
    const prevCachedSettings = repoAny.cachedSchedulerSettings ? { ...repoAny.cachedSchedulerSettings } : null;
    const prevWebScraperFlag = featureFlags.enableWebScraper;

    const pastDueIso = new Date(Date.now() - 120000).toISOString();
    repoAny.cachedSchedulerSettings = {
      ...getDefaultSchedulerSettings(),
      enabled: true,
      scope: 'all',
      scanMode: 'complete'
    };
    repoAny.cachedSources = [
      {
        id: 'tick-route-409-src',
        name: 'Tick Route 409 Portal',
        url: 'https://portal.gov.pk/jobs',
        status: 'Active Scheduled',
        interval: '1h',
        lastRunAt: undefined,
        lastCompletedAt: undefined,
        nextRunAt: pastDueIso
      }
    ];
    featureFlags.enableWebScraper = true;

    let releaseActiveRun!: () => void;
    const runGate = new Promise<void>(resolve => {
      releaseActiveRun = resolve;
    });

    const tickLayer = (scraperRouter as any).stack.find(
      (l: any) => l.route && l.route.path === '/scheduler-tick' && l.route.methods.post
    );
    assert.ok(tickLayer, 'Expected POST /scheduler-tick route on scraperRouter');
    const tickHandler = tickLayer.route.stack[tickLayer.route.stack.length - 1].handle;

    const activePromise = executeScraperWithWizard(
      { mode: 'complete', sourceIds: ['tick-route-409-src'] },
      {
        getConfigsFn: async () => repoAny.cachedSources,
        updateSourceStatsFn: async () => {},
        addRunFn: async (run) => ({ ...run, isPersistedToMongo: false }),
        scrapePageFn: async () => {
          await runGate;
          return [];
        },
        enrichJobsFn: async (jobs) => jobs,
        auditAddFn: () => {}
      }
    );

    try {
      await new Promise(r => setTimeout(r, 15));
      const expectedActive = getActiveRunStatus();
      assert.strictEqual(expectedActive.isActive, true);

      let statusCode = 200;
      let payload: any = null;
      await tickHandler(
        { body: {}, params: {}, user: { name: 'Admin' } },
        {
          status(code: number) {
            statusCode = code;
            return this;
          },
          json(data: any) {
            payload = data;
            return this;
          }
        },
        () => {}
      );

      assert.strictEqual(statusCode, 409, 'POST /scheduler-tick must return HTTP 409 on conflict');
      assert.strictEqual(payload.success, false, 'POST /scheduler-tick must set success=false on conflict');
      assert.strictEqual(payload.code, SCRAPER_RUN_ALREADY_ACTIVE_CODE);
      assert.ok(typeof payload.message === 'string' && payload.message.toLowerCase().includes('already in progress'));
      assert.strictEqual(payload.activeRun?.isActive, true);
      assert.strictEqual(payload.activeRun?.runId, expectedActive.runId);
      assert.strictEqual(payload.skippedDueToConflict, true);
      assert.strictEqual(payload.aborted, true);
      assert.deepStrictEqual(payload.triggeredSources, []);
      assert.strictEqual(repoAny.cachedSources[0].nextRunAt, pastDueIso, 'Conflict must not advance nextRunAt');
      assert.strictEqual(repoAny.cachedSources[0].lastRunAt, undefined);
      assert.strictEqual(repoAny.cachedSources[0].lastCompletedAt, undefined);
    } finally {
      releaseActiveRun();
      await activePromise;
      resetActiveRun();
      repoAny.cachedSources = prevCachedSources;
      repoAny.cachedSchedulerSettings = prevCachedSettings;
      featureFlags.enableWebScraper = prevWebScraperFlag;
    }
  });

  await runTest('STEP-8.4-C2 Case 5 [Integration]: POST /scheduler-tick retains success=true and HTTP 200 on normal successful tick', async () => {
    const repoAny = ScraperRepository as any;
    const prevCachedSources = repoAny.cachedSources ? [...repoAny.cachedSources] : [];
    const prevCachedSettings = repoAny.cachedSchedulerSettings ? { ...repoAny.cachedSchedulerSettings } : null;
    const prevWebScraperFlag = featureFlags.enableWebScraper;

    repoAny.cachedSchedulerSettings = {
      ...getDefaultSchedulerSettings(),
      enabled: true,
      scope: 'all',
      scanMode: 'complete'
    };
    repoAny.cachedSources = [
      {
        id: 'tick-route-ok-src',
        name: 'Tick Route OK Portal',
        url: 'https://portal.gov.pk/jobs',
        status: 'Active Scheduled',
        interval: '1h',
        nextRunAt: new Date(Date.now() + 3600000).toISOString()
      }
    ];
    featureFlags.enableWebScraper = true;

    try {
      const tickLayer = (scraperRouter as any).stack.find(
        (l: any) => l.route && l.route.path === '/scheduler-tick' && l.route.methods.post
      );
      assert.ok(tickLayer);
      const tickHandler = tickLayer.route.stack[tickLayer.route.stack.length - 1].handle;

      let statusCode = 200;
      let payload: any = null;
      await tickHandler(
        { body: {}, params: {}, user: { name: 'Admin' } },
        {
          status(code: number) {
            statusCode = code;
            return this;
          },
          json(data: any) {
            payload = data;
            return this;
          }
        },
        () => {}
      );

      assert.strictEqual(statusCode, 200);
      assert.strictEqual(payload.success, true);
      assert.deepStrictEqual(payload.triggeredSources, []);
      assert.ok(typeof payload.summary === 'string' && payload.summary.includes('Tick completed'));
      assert.strictEqual(payload.code, undefined);
      assert.strictEqual(payload.skippedDueToConflict, undefined);
    } finally {
      repoAny.cachedSources = prevCachedSources;
      repoAny.cachedSchedulerSettings = prevCachedSettings;
      featureFlags.enableWebScraper = prevWebScraperFlag;
    }
  });

  await runTest('STEP-8.4-C2 Case 6 [Integration]: Non-conflict aborted scheduler tick must not be reported as a 409 lock conflict', async () => {
    let statusCode = 200;
    let payload: any = null;

    await handleSchedulerTickRequest(
      { body: {}, params: {}, user: { name: 'Admin' } },
      {
        status(code: number) {
          statusCode = code;
          return this;
        },
        json(data: any) {
          payload = data;
          return this;
        }
      },
      () =>
        runSchedulerTick({
          isScraperEnabledFn: () => true,
          getSchedulerSettingsFn: async () => {
            throw new Error('Authoritative MongoDB settings read failed');
          }
        })
    );

    assert.notStrictEqual(statusCode, 409, 'Non-conflict abort must never return HTTP 409');
    assert.strictEqual(statusCode, 500);
    assert.strictEqual(payload.success, false);
    assert.notStrictEqual(payload.code, SCRAPER_RUN_ALREADY_ACTIVE_CODE, 'Must not label DB read abort as SCRAPER_RUN_ALREADY_ACTIVE');
    assert.strictEqual(payload.code, undefined);
    assert.strictEqual(payload.aborted, true);
    assert.notStrictEqual(payload.skippedDueToConflict, true);
    assert.deepStrictEqual(payload.triggeredSources, []);
    assert.ok(payload.message.includes('Authoritative MongoDB settings read failed'));
  });

  await runTest('STEP-8.5-A Case 1 [Mocked]: Existing live job ID collision is detected by findDuplicateCandidates and never overwrites original live job or application history', async () => {
    resetActiveRun();
    const liveStore = new Map<string, any>([
      [
        'colliding-live-1',
        {
          id: 'colliding-live-1',
          title: 'Existing Medical Officer',
          company: 'Health Dept',
          sourceJobId: 'HD-100',
          sourceUrl: 'https://health.gov.pk/jobs/100',
          status: 'Approved',
          applicationsCount: 19,
          applications: [{ id: 'app-1', userId: 'u1' }],
          applicationHistory: [{ at: '2026-01-10', applicant: 'u1' }]
        }
      ]
    ]);
    const pendingStore = new Map<string, any>();

    const makeMockColl = (store: Map<string, any>) => ({
      find(query: any) {
        const docs = Array.from(store.values()).filter((doc) => {
          if (query?.id !== undefined && doc.id === query.id) {
            return true;
          }
          if (query?.$or && Array.isArray(query.$or)) {
            return query.$or.some((clause: any) => {
              if (clause.id !== undefined) return doc.id === clause.id;
              if (clause.sourceJobId !== undefined) return doc.sourceJobId === clause.sourceJobId;
              return false;
            });
          }
          return false;
        });
        return {
          limit() { return this; },
          sort() { return this; },
          async toArray() { return docs; }
        };
      }
    });

    // Verify findDuplicateCandidates includes internal candidate ID even when content differs
    const candidates = await JobRepository.findDuplicateCandidates(
      {
        id: 'colliding-live-1',
        title: 'Completely Different Engineer Role',
        company: 'Works Dept',
        sourceJobId: 'WD-999',
        sourceUrl: 'https://works.gov.pk/jobs/999'
      },
      {
        isMongoConfiguredFn: () => true,
        getJobsCollectionFn: async () => makeMockColl(liveStore),
        getPendingJobsCollectionFn: async () => makeMockColl(pendingStore)
      }
    );
    assert.strictEqual(candidates.some(c => c.id === 'colliding-live-1'), true, 'findDuplicateCandidates must match internal id across live jobs');

    // Run scraper engine with autoPublishTrusted=true (writes to live) and colliding candidate ID
    const summary = await executeScraperWithWizard(
      { mode: 'complete', sourceIds: ['src-live-col'], autoPublishTrusted: true },
      {
        getConfigsFn: async () => [
          { id: 'src-live-col', name: 'Works Portal', url: 'https://works.gov.pk/jobs', status: 'Active Scheduled', autoApprove: true }
        ],
        updateSourceStatsFn: async () => {},
        addRunFn: async (run) => ({ ...run, isPersistedToMongo: false }),
        scrapePageFn: async () => [
          {
            id: 'colliding-live-1',
            title: 'Civil Structural Engineer',
            company: 'Works Dept',
            jobType: 'On-site',
            region: 'Pakistan',
            salary: 'PKR 150,000',
            currency: 'PKR',
            experienceLevel: 'Mid',
            department: 'Works',
            tags: [],
            description: 'Non-duplicate job with colliding internal ID.',
            requirements: [],
            benefits: [],
            postedAt: 'Today',
            applicationsCount: 0,
            status: 'Pending',
            sourceJobId: 'WD-999',
            sourceUrl: 'https://works.gov.pk/jobs/999',
            originalApplyUrl: 'https://works.gov.pk/apply/999',
            applicationUrl: 'https://works.gov.pk/form/999',
            extractionMethod: 'html_cheerio'
          }
        ],
        enrichJobsFn: async (jobs) => jobs,
        findDuplicateCandidatesFn: (cand) =>
          JobRepository.findDuplicateCandidates(cand, {
            isMongoConfiguredFn: () => true,
            getJobsCollectionFn: async () => makeMockColl(liveStore),
            getPendingJobsCollectionFn: async () => makeMockColl(pendingStore)
          }),
        createJobFn: async (job) => {
          liveStore.set(job.id, job);
          return job;
        },
        auditAddFn: () => {}
      }
    );

    assert.strictEqual(summary.totalPublished, 1);
    assert.strictEqual(liveStore.size, 2, 'Colliding candidate must be saved as a separate job rather than overwriting');
    const originalLive = liveStore.get('colliding-live-1');
    assert.strictEqual(originalLive.title, 'Existing Medical Officer');
    assert.strictEqual(originalLive.applicationsCount, 19);
    assert.strictEqual(originalLive.applications.length, 1);
    assert.strictEqual(originalLive.applicationHistory.length, 1);
    resetActiveRun();
  });

  await runTest('STEP-8.5-A Case 2 [Mocked]: Existing pending job ID collision assigns fresh ID and preserves existing pending record', async () => {
    resetActiveRun();
    const liveStore = new Map<string, any>();
    const pendingStore = new Map<string, any>([
      [
        'colliding-pending-1',
        {
          id: 'colliding-pending-1',
          title: 'Original Pending Lecturer',
          company: 'Education Dept',
          sourceJobId: 'ED-10',
          sourceUrl: 'https://edu.gov.pk/10',
          status: 'Pending',
          applicationsCount: 0
        }
      ]
    ]);

    const makeMockColl = (store: Map<string, any>) => ({
      find(query: any) {
        const docs = Array.from(store.values()).filter((doc) => {
          if (query?.id !== undefined && doc.id === query.id) {
            return true;
          }
          if (query?.$or && Array.isArray(query.$or)) {
            return query.$or.some((clause: any) => clause.id !== undefined && doc.id === clause.id);
          }
          return false;
        });
        return {
          limit() { return this; },
          sort() { return this; },
          async toArray() { return docs; }
        };
      }
    });

    const summary = await executeScraperWithWizard(
      { mode: 'complete', sourceIds: ['src-pend-col'] },
      {
        getConfigsFn: async () => [
          { id: 'src-pend-col', name: 'Transport Portal', url: 'https://transport.gov.pk/jobs', status: 'Active Scheduled', autoApprove: false }
        ],
        updateSourceStatsFn: async () => {},
        addRunFn: async (run) => ({ ...run, isPersistedToMongo: false }),
        scrapePageFn: async () => [
          {
            id: 'colliding-pending-1',
            title: 'Fleet Operations Analyst',
            company: 'Transport Dept',
            jobType: 'On-site',
            region: 'Pakistan',
            salary: 'PKR 95,000',
            currency: 'PKR',
            experienceLevel: 'Mid',
            department: 'Operations',
            tags: [],
            description: 'Pending collision test.',
            requirements: [],
            benefits: [],
            postedAt: 'Today',
            applicationsCount: 0,
            status: 'Pending',
            sourceJobId: 'TR-55',
            sourceUrl: 'https://transport.gov.pk/55',
            extractionMethod: 'html_cheerio'
          }
        ],
        enrichJobsFn: async (jobs) => jobs,
        findDuplicateCandidatesFn: (cand) =>
          JobRepository.findDuplicateCandidates(cand, {
            isMongoConfiguredFn: () => true,
            getJobsCollectionFn: async () => makeMockColl(liveStore),
            getPendingJobsCollectionFn: async () => makeMockColl(pendingStore)
          }),
        addPendingJobFn: async (job) => {
          pendingStore.set(job.id, job);
          return job;
        },
        auditAddFn: () => {}
      }
    );

    assert.strictEqual(summary.totalPending, 1);
    assert.strictEqual(pendingStore.size, 2, 'Both existing and new pending records must coexist');
    assert.strictEqual(pendingStore.get('colliding-pending-1').title, 'Original Pending Lecturer');
    assert.notStrictEqual(summary.pendingJobs[0].id, 'colliding-pending-1');
    resetActiveRun();
  });

  await runTest('STEP-8.5-A Case 3 [Unit]: Scraped candidate receives a fresh unique internal ID on collision across DB or current batch', () => {
    const candidateA: any = {
      id: 'dup-id-100',
      slug: 'old-slug-dup-id-100',
      title: 'Inspector',
      scraperSourceId: 'fia'
    };
    const res1 = resolveNonCollidingCandidateId(
      candidateA,
      [{ id: 'dup-id-100', title: 'Old Job' }],
      [],
      'fia'
    );
    assert.strictEqual(res1.collided, true);
    assert.strictEqual(res1.previousId, 'dup-id-100');
    assert.notStrictEqual(candidateA.id, 'dup-id-100');
    assert.ok(candidateA.id.startsWith('scraped-fia-'));
    assert.strictEqual(candidateA.slug, undefined, 'Stale slug tied to colliding id should be cleared');

    const candidateB: any = { id: candidateA.id, title: 'Sub Inspector', scraperSourceId: 'fia' };
    const res2 = resolveNonCollidingCandidateId(candidateB, [], [candidateA], 'fia');
    assert.strictEqual(res2.collided, true);
    assert.notStrictEqual(candidateB.id, candidateA.id);
  });

  await runTest('STEP-8.5-A Case 4 [Mocked]: Original job ID, applicationsCount, applications, and applicationHistory remain completely unchanged on collision', async () => {
    resetActiveRun();
    const originalJob = {
      id: 'fixed-live-42',
      title: 'Budget Analyst',
      company: 'Finance Division',
      sourceJobId: 'FIN-42',
      sourceUrl: 'https://finance.gov.pk/42',
      applicationsCount: 37,
      applications: [{ appId: 'a1' }, { appId: 'a2' }],
      applicationHistory: [{ event: 'submitted', ts: '2026-02-01' }]
    };
    const savedJobs: any[] = [];

    await executeScraperWithWizard(
      { mode: 'complete', sourceIds: ['src-hist-keep'], autoPublishTrusted: true },
      {
        getConfigsFn: async () => [
          { id: 'src-hist-keep', name: 'Ministry Portal', url: 'https://ministry.gov.pk/jobs', status: 'Active Scheduled', autoApprove: true }
        ],
        updateSourceStatsFn: async () => {},
        addRunFn: async (run) => ({ ...run, isPersistedToMongo: false }),
        scrapePageFn: async () => [
          {
            id: 'fixed-live-42',
            title: 'Network Architect',
            company: 'IT Board',
            jobType: 'On-site',
            region: 'Pakistan',
            salary: 'PKR 180,000',
            currency: 'PKR',
            experienceLevel: 'Senior',
            department: 'IT',
            tags: [],
            description: 'Unique job sharing ID fixed-live-42.',
            requirements: [],
            benefits: [],
            postedAt: 'Today',
            applicationsCount: 0,
            status: 'Pending',
            sourceJobId: 'IT-42',
            sourceUrl: 'https://itb.gov.pk/42',
            extractionMethod: 'html_cheerio'
          }
        ],
        enrichJobsFn: async (jobs) => jobs,
        findDuplicateCandidatesFn: async () => [originalJob],
        createJobFn: async (job) => {
          savedJobs.push(job);
          return job;
        },
        auditAddFn: () => {}
      }
    );

    assert.strictEqual(originalJob.id, 'fixed-live-42');
    assert.strictEqual(originalJob.applicationsCount, 37);
    assert.strictEqual(originalJob.applications.length, 2);
    assert.strictEqual(originalJob.applicationHistory.length, 1);
    assert.strictEqual(savedJobs.length, 1);
    assert.notStrictEqual(savedJobs[0].id, 'fixed-live-42');
    resetActiveRun();
  });

  await runTest('STEP-8.5-A Case 5 [Mocked]: Source identifiers (sourceJobId, sourceUrl, originalApplyUrl, applicationUrl) remain intact after ID regeneration', async () => {
    resetActiveRun();
    const persisted: any[] = [];
    const existing = { id: 'id-reuse-src', title: 'Other Job', company: 'Other Org' };

    await executeScraperWithWizard(
      { mode: 'complete', sourceIds: ['src-ident'] },
      {
        getConfigsFn: async () => [
          { id: 'src-ident', name: 'Identity Portal', url: 'https://portal.gov.pk/jobs', status: 'Active Scheduled', autoApprove: false }
        ],
        updateSourceStatsFn: async () => {},
        addRunFn: async (run) => ({ ...run, isPersistedToMongo: false }),
        scrapePageFn: async () => [
          {
            id: 'id-reuse-src',
            title: 'Procurement Specialist',
            company: 'WAPDA',
            jobType: 'On-site',
            region: 'Pakistan',
            salary: 'PKR 130,000',
            currency: 'PKR',
            experienceLevel: 'Mid',
            department: 'Supply Chain',
            tags: [],
            description: 'Preserve all source identifiers.',
            requirements: [],
            benefits: [],
            postedAt: 'Today',
            applicationsCount: 0,
            status: 'Pending',
            sourceJobId: 'WAPDA-EXT-881',
            sourceUrl: 'https://portal.gov.pk/jobs/wapda-881',
            originalApplyUrl: 'https://portal.gov.pk/apply/wapda-881',
            applicationUrl: 'https://apply.wapda.gov.pk/form/881',
            extractionMethod: 'html_cheerio'
          }
        ],
        enrichJobsFn: async (jobs) => jobs,
        findDuplicateCandidatesFn: async () => [existing],
        addPendingJobFn: async (job) => {
          persisted.push(job);
          return job;
        },
        auditAddFn: () => {}
      }
    );

    assert.strictEqual(persisted.length, 1);
    assert.notStrictEqual(persisted[0].id, 'id-reuse-src');
    assert.strictEqual(persisted[0].sourceJobId, 'WAPDA-EXT-881');
    assert.strictEqual(persisted[0].sourceUrl, 'https://portal.gov.pk/jobs/wapda-881');
    assert.strictEqual(persisted[0].originalApplyUrl, 'https://portal.gov.pk/apply/wapda-881');
    assert.strictEqual(persisted[0].applicationUrl, 'https://apply.wapda.gov.pk/form/881');
    assert.strictEqual(persisted[0].scraperSourceId, 'src-ident');
    resetActiveRun();
  });

  await runTest('STEP-8.5-A Case 6 [Mocked]: Existing duplicate detection (with and without modes) still detects duplicates after ID regeneration', async () => {
    resetActiveRun();
    const existingDup = {
      id: 'same-id-dup-1',
      title: 'Assistant Director Accounts',
      company: 'SBP',
      sourceJobId: 'SBP-2026-09',
      sourceUrl: 'https://sbp.org.pk/careers/09',
      status: 'Approved',
      applicationsCount: 11
    };

    // 6a: duplicateMode === 'with' saves to pending under fresh ID with duplicateOfJobId pointing to original
    const pendingSaved: any[] = [];
    const withSummary = await executeScraperWithWizard(
      { mode: 'complete', sourceIds: ['src-dup-mode'], duplicateMode: 'with' },
      {
        getConfigsFn: async () => [
          { id: 'src-dup-mode', name: 'SBP', url: 'https://sbp.org.pk/careers', status: 'Active Scheduled', autoApprove: true }
        ],
        updateSourceStatsFn: async () => {},
        addRunFn: async (run) => ({ ...run, isPersistedToMongo: false }),
        scrapePageFn: async () => [
          {
            id: 'same-id-dup-1',
            title: 'Assistant Director Accounts',
            company: 'SBP',
            jobType: 'On-site',
            region: 'Pakistan',
            salary: 'PKR 140,000',
            currency: 'PKR',
            experienceLevel: 'Mid',
            department: 'Finance',
            tags: [],
            description: 'Duplicate with same id and same sourceJobId.',
            requirements: [],
            benefits: [],
            postedAt: 'Today',
            applicationsCount: 0,
            status: 'Pending',
            sourceJobId: 'SBP-2026-09',
            sourceUrl: 'https://sbp.org.pk/careers/09',
            extractionMethod: 'html_cheerio'
          }
        ],
        enrichJobsFn: async (jobs) => jobs,
        findDuplicateCandidatesFn: async () => [existingDup],
        addPendingJobFn: async (job) => {
          pendingSaved.push(job);
          return job;
        },
        auditAddFn: () => {}
      }
    );

    assert.strictEqual(withSummary.totalDuplicates, 1);
    assert.strictEqual(withSummary.totalPending, 1);
    assert.strictEqual(withSummary.totalPublished, 0);
    assert.strictEqual(pendingSaved.length, 1);
    assert.notStrictEqual(pendingSaved[0].id, 'same-id-dup-1');
    assert.strictEqual(pendingSaved[0].isDuplicate, true);
    assert.strictEqual(pendingSaved[0].duplicateOfJobId, 'same-id-dup-1');
    assert.strictEqual(existingDup.applicationsCount, 11);

    // 6b: duplicateMode === 'without' skips duplicate cleanly
    const withoutPending: any[] = [];
    const withoutSummary = await executeScraperWithWizard(
      { mode: 'complete', sourceIds: ['src-dup-mode'], duplicateMode: 'without' },
      {
        getConfigsFn: async () => [
          { id: 'src-dup-mode', name: 'SBP', url: 'https://sbp.org.pk/careers', status: 'Active Scheduled', autoApprove: true }
        ],
        updateSourceStatsFn: async () => {},
        addRunFn: async (run) => ({ ...run, isPersistedToMongo: false }),
        scrapePageFn: async () => [
          {
            id: 'same-id-dup-1',
            title: 'Assistant Director Accounts',
            company: 'SBP',
            jobType: 'On-site',
            region: 'Pakistan',
            salary: 'PKR 140,000',
            currency: 'PKR',
            experienceLevel: 'Mid',
            department: 'Finance',
            tags: [],
            description: 'Duplicate with same id and same sourceJobId.',
            requirements: [],
            benefits: [],
            postedAt: 'Today',
            applicationsCount: 0,
            status: 'Pending',
            sourceJobId: 'SBP-2026-09',
            sourceUrl: 'https://sbp.org.pk/careers/09',
            extractionMethod: 'html_cheerio'
          }
        ],
        enrichJobsFn: async (jobs) => jobs,
        findDuplicateCandidatesFn: async () => [existingDup],
        addPendingJobFn: async (job) => {
          withoutPending.push(job);
          return job;
        },
        auditAddFn: () => {}
      }
    );

    assert.strictEqual(withoutSummary.totalDuplicates, 1);
    assert.strictEqual(withoutSummary.totalPending, 0);
    assert.strictEqual(withoutPending.length, 0);
    assert.strictEqual(existingDup.applicationsCount, 11);
    resetActiveRun();
  });

  await runTest('STEP-8.5-A Case 7 [Mocked]: Existing conflicting live record is NOT overwritten during pending approval and pending record stays untouched', async () => {
    const existingLive = {
      id: 'conflict-approve-1',
      title: 'Senior Medical Specialist',
      company: 'PIMS Hospital',
      sourceJobId: 'PIMS-1',
      status: 'Approved',
      applicationsCount: 24,
      applications: [{ id: 'cand-1' }]
    };
    const pendingDoc = {
      id: 'conflict-approve-1',
      title: 'Junior Software Developer',
      company: 'Tech Corp',
      sourceJobId: 'TECH-99',
      status: 'Pending',
      applicationsCount: 0
    };

    let liveUpdateCalls = 0;
    let pendingDeleteCalls = 0;

    assert.strictEqual(isSameLogicalJobRecord(pendingDoc, existingLive), false);

    let caughtErr: any = null;
    try {
      await JobRepository.approvePending('conflict-approve-1', {
        isMongoConfiguredFn: () => true,
        applyVisibilityPolicyFn: async (j) => j,
        getPendingJobsCollectionFn: async () => ({
          findOne: async () => pendingDoc,
          deleteOne: async () => {
            pendingDeleteCalls++;
            return { acknowledged: true, deletedCount: 1 };
          }
        }),
        getJobsCollectionFn: async () => ({
          findOne: async () => existingLive,
          updateOne: async () => {
            liveUpdateCalls++;
            return { acknowledged: true, matchedCount: 1 };
          }
        })
      });
    } catch (err) {
      caughtErr = err;
    }

    assert.ok(caughtErr instanceof JobApprovalConflictError, 'Conflicting live job ID must throw JobApprovalConflictError');
    assert.strictEqual(caughtErr.status, 409);
    assert.strictEqual(caughtErr.code, 'LIVE_JOB_ID_CONFLICT');
    assert.strictEqual(liveUpdateCalls, 0, 'Existing live job must NEVER be overwritten on ID conflict');
    assert.strictEqual(pendingDeleteCalls, 0, 'Pending record must remain untouched on ID conflict');
    assert.strictEqual(existingLive.applicationsCount, 24);
    assert.strictEqual(existingLive.applications.length, 1);
  });

  await runTest('STEP-8.5-A Case 8 [Mocked]: Failed or unacknowledged live MongoDB write keeps pending record intact', async () => {
    const unconfirmedResults: any[] = [
      { acknowledged: false, upsertedCount: 1, matchedCount: 0 },
      { acknowledged: true, matchedCount: 0, upsertedCount: 0 },
      { matchedCount: 1, upsertedCount: 0 },
      { acknowledged: true },
      null,
      undefined
    ];

    for (let i = 0; i < unconfirmedResults.length; i++) {
      const mockWriteResult = unconfirmedResults[i];
      let pendingDeleted = false;

      await assert.rejects(
        () =>
          JobRepository.approvePending(`unacked-pending-${i}`, {
            isMongoConfiguredFn: () => true,
            applyVisibilityPolicyFn: async (j) => j,
            getPendingJobsCollectionFn: async () => ({
              findOne: async () => ({
                id: `unacked-pending-${i}`,
                title: 'Verification Job',
                company: 'Audit Dept',
                status: 'Pending'
              }),
              deleteOne: async () => {
                pendingDeleted = true;
                return { acknowledged: true, deletedCount: 1 };
              }
            }),
            getJobsCollectionFn: async () => ({
              findOne: async () => null,
              updateOne: async () => mockWriteResult
            })
          }),
        /could not be confirmed by MongoDB/i
      );

      assert.strictEqual(pendingDeleted, false, `Case ${i}: pending record must NOT be deleted when live write result is unconfirmed`);
    }
  });

  await runTest('STEP-8.5-A Case 9 [Mocked]: Explicitly acknowledged live write permits pending deletion and safe retry preserves live application history', async () => {
    // 9a: Normal upsert (acknowledged=true, upsertedCount=1)
    let liveMap = new Map<string, any>();
    let pendingMap = new Map<string, any>([
      [
        'ack-ok-1',
        {
          id: 'ack-ok-1',
          title: 'Finance Officer',
          company: 'AGPR',
          sourceJobId: 'AGPR-1',
          sourceUrl: 'https://agpr.gov.pk/1',
          status: 'Pending',
          applicationsCount: 0
        }
      ]
    ]);
    const opsOrder: string[] = [];

    const approvedNew = await JobRepository.approvePending('ack-ok-1', {
      isMongoConfiguredFn: () => true,
      applyVisibilityPolicyFn: async (j) => j,
      getPendingJobsCollectionFn: async () => ({
        findOne: async ({ id }: any) => pendingMap.get(id) || null,
        deleteOne: async ({ id }: any) => {
          opsOrder.push('deleteOne');
          const existed = pendingMap.delete(id);
          return { acknowledged: true, deletedCount: existed ? 1 : 0 };
        }
      }),
      getJobsCollectionFn: async () => ({
        findOne: async ({ id }: any) => liveMap.get(id) || null,
        updateOne: async ({ id }: any, update: any) => {
          opsOrder.push('updateOne');
          liveMap.set(id, update.$set);
          return { acknowledged: true, matchedCount: 0, upsertedCount: 1 };
        }
      })
    });

    assert.strictEqual(approvedNew?.status, 'Approved');
    assert.deepStrictEqual(opsOrder, ['updateOne', 'deleteOne']);
    assert.strictEqual(pendingMap.has('ack-ok-1'), false);
    assert.strictEqual(liveMap.get('ack-ok-1')?.status, 'Approved');

    // 9b: Safe retry when same logical record is already in live jobsColl with live applicationsCount=8
    const retryLive = new Map<string, any>([
      [
        'retry-same-1',
        {
          id: 'retry-same-1',
          title: 'Tax Inspector',
          company: 'FBR',
          sourceJobId: 'FBR-77',
          sourceUrl: 'https://fbr.gov.pk/77',
          status: 'Approved',
          verifiedDate: '2026-02-15T10:00:00.000Z',
          applicationsCount: 8,
          applications: [{ id: 'app-1' }, { id: 'app-2' }],
          applicationHistory: [{ ts: '2026-02-16' }]
        }
      ]
    ]);
    const retryPending = new Map<string, any>([
      [
        'retry-same-1',
        {
          id: 'retry-same-1',
          title: 'Tax Inspector',
          company: 'FBR',
          sourceJobId: 'FBR-77',
          sourceUrl: 'https://fbr.gov.pk/77',
          status: 'Pending',
          applicationsCount: 0
        }
      ]
    ]);

    const retriedApproved = await JobRepository.approvePending('retry-same-1', {
      isMongoConfiguredFn: () => true,
      applyVisibilityPolicyFn: async (j) => j,
      getPendingJobsCollectionFn: async () => ({
        findOne: async ({ id }: any) => retryPending.get(id) || null,
        deleteOne: async ({ id }: any) => {
          retryPending.delete(id);
          return { acknowledged: true, deletedCount: 1 };
        }
      }),
      getJobsCollectionFn: async () => ({
        findOne: async ({ id }: any) => retryLive.get(id) || null,
        updateOne: async ({ id }: any, update: any) => {
          retryLive.set(id, update.$set);
          return { acknowledged: true, matchedCount: 1, upsertedCount: 0 };
        }
      })
    });

    assert.strictEqual(retriedApproved?.status, 'Approved');
    assert.strictEqual(retriedApproved?.applicationsCount, 8, 'Safe retry must preserve existing live applicationsCount');
    assert.strictEqual(retriedApproved?.applications?.length, 2, 'Safe retry must preserve existing applications');
    assert.strictEqual(retriedApproved?.applicationHistory?.length, 1);
    assert.strictEqual(retriedApproved?.verifiedDate, '2026-02-15T10:00:00.000Z');
    assert.strictEqual(retryPending.has('retry-same-1'), false, 'Safe retry must clean up orphaned pending record');
  });

  await runTest('STEP-8.5-A Case 10 [Mocked]: Existing normal pending approval behavior (MongoDB and in-memory modes) remains intact', async () => {
    // 10a: In-memory Database fallback when MongoDB is not configured
    const memPendingId = `mem-pending-normal-${Date.now()}`;
    const createdMem = Database.addPendingJob({
      id: memPendingId,
      title: 'Normal Pending In-Memory Job',
      company: 'Test Authority',
      city: 'Lahore',
      status: 'Pending'
    });
    assert.strictEqual(createdMem.status, 'Pending');
    const approvedMem = await JobRepository.approvePending(memPendingId);
    assert.strictEqual(approvedMem?.status, 'Approved');
    assert.ok(approvedMem?.verifiedDate);

    // 10b: Normal MongoDB pending approval (no pre-existing live conflict)
    const normalLiveStore = new Map<string, any>();
    const normalPendingStore = new Map<string, any>([
      [
        'mongo-normal-pending-1',
        {
          id: 'mongo-normal-pending-1',
          title: 'Assistant Engineer Civil',
          company: 'NHA',
          city: 'Islamabad',
          tags: ['Engineering', 'NHA'],
          status: 'Pending',
          applicationsCount: 0
        }
      ]
    ]);

    const approvedNormalMongo = await JobRepository.approvePending('mongo-normal-pending-1', {
      isMongoConfiguredFn: () => true,
      applyVisibilityPolicyFn: async (j) => ({ ...j, visibilityApplied: true }),
      getPendingJobsCollectionFn: async () => ({
        findOne: async ({ id }: any) => normalPendingStore.get(id) || null,
        deleteOne: async ({ id }: any) => {
          const existed = normalPendingStore.delete(id);
          return { acknowledged: true, deletedCount: existed ? 1 : 0 };
        }
      }),
      getJobsCollectionFn: async () => ({
        findOne: async ({ id }: any) => normalLiveStore.get(id) || null,
        updateOne: async ({ id }: any, update: any) => {
          normalLiveStore.set(id, update.$set);
          return { acknowledged: true, matchedCount: 0, upsertedCount: 1 };
        }
      })
    });

    assert.strictEqual(approvedNormalMongo?.id, 'mongo-normal-pending-1');
    assert.strictEqual(approvedNormalMongo?.status, 'Approved');
    assert.strictEqual(approvedNormalMongo?.visibilityApplied, true);
    assert.ok(approvedNormalMongo?.verifiedDate);
    assert.strictEqual(normalPendingStore.has('mongo-normal-pending-1'), false);
    assert.strictEqual(normalLiveStore.get('mongo-normal-pending-1')?.status, 'Approved');

    // 10c: Missing pending & missing live job returns null cleanly
    const missingRes = await JobRepository.approvePending('does-not-exist-anywhere', {
      isMongoConfiguredFn: () => true,
      getPendingJobsCollectionFn: async () => ({ findOne: async () => null }),
      getJobsCollectionFn: async () => ({ findOne: async () => null })
    });
    assert.strictEqual(missingRes, null);

    // Clean up memory job
    await JobRepository.delete(memPendingId);
  });

  // =========================================================================
  // STEP-8.5-A1 — Complete Atomic Scraper ID Collision Protection (12 Tests)
  // =========================================================================

  await runTest('STEP-8.5-A1 Case 1 [Mocked]: Internal ID lookup in findDuplicateCandidates is independent and NOT truncated by the 50-record exact limit', async () => {
    const noisyExactDocs = Array.from({ length: 65 }, (_, idx) => ({
      id: `noise-exact-${idx}`,
      title: `Noisy Exact Match ${idx}`,
      company: 'Audit Authority',
      sourceJobId: 'SHARED-SRC-65',
      sourceUrl: 'https://audit.gov.pk/shared',
      status: 'Approved'
    }));
    const targetIdDoc = {
      id: 'target-id-beyond-50',
      title: 'Distinct Role With Matching Internal ID',
      company: 'Distinct Org',
      sourceJobId: 'UNRELATED-999',
      sourceUrl: 'https://unrelated.org/999',
      status: 'Approved',
      applicationsCount: 44
    };

    const recordedIdQueries: Array<{ query: any; limitCalled: number | null }> = [];
    const recordedOrQueries: Array<{ query: any; limitCalled: number | null }> = [];

    const makeLargeColl = (extraTarget?: any) => ({
      find(query: any) {
        let appliedLimit: number | null = null;
        const isDirectIdQuery = query && typeof query.id === 'string' && !query.$or;
        const isOrQuery = Boolean(query && Array.isArray(query.$or));

        const cursor = {
          limit(n: number) {
            appliedLimit = n;
            return cursor;
          },
          sort() {
            return cursor;
          },
          async toArray() {
            if (isDirectIdQuery) {
              recordedIdQueries.push({ query, limitCalled: appliedLimit });
              return extraTarget && extraTarget.id === query.id ? [extraTarget] : [];
            }
            if (isOrQuery) {
              recordedOrQueries.push({ query, limitCalled: appliedLimit });
              const matched = noisyExactDocs.filter((d) =>
                query.$or.some((c: any) => c.sourceJobId === d.sourceJobId)
              );
              return typeof appliedLimit === 'number' ? matched.slice(0, appliedLimit) : matched;
            }
            return [];
          }
        };
        return cursor;
      }
    });

    const pool = await JobRepository.findDuplicateCandidates(
      {
        id: 'target-id-beyond-50',
        title: 'Fresh Unrelated Position',
        company: 'Completely New Dept',
        sourceJobId: 'SHARED-SRC-65',
        sourceUrl: 'https://audit.gov.pk/shared'
      },
      {
        isMongoConfiguredFn: () => true,
        getJobsCollectionFn: async () => makeLargeColl(targetIdDoc),
        getPendingJobsCollectionFn: async () => makeLargeColl(undefined)
      }
    );

    assert.strictEqual(recordedIdQueries.length, 2, 'Both Live and Pending collections must receive independent { id } queries');
    for (const q of recordedIdQueries) {
      assert.strictEqual(q.limitCalled, null, 'Independent internal-ID lookup must NEVER apply the 50-record limit');
      assert.strictEqual(q.query.$or, undefined, 'Internal-ID lookup must not be combined with $or');
      assert.strictEqual(q.query.id, 'target-id-beyond-50');
    }
    for (const q of recordedOrQueries) {
      assert.ok(q.limitCalled === 50 || q.limitCalled === 5001 || q.limitCalled === null, 'External sourceJobId/URL $or lookup must not silently truncate beyond configured bounds');
      assert.strictEqual(
        q.query.$or.some((c: any) => c.id !== undefined),
        false,
        '$or query must not contain internal id clause'
      );
    }
    assert.strictEqual(
      pool.some((c) => c.id === 'target-id-beyond-50'),
      true,
      'Matching internal ID record must be included even when >50 external exact matches exist'
    );
  });

  await runTest('STEP-8.5-A1 Case 2 [Mocked]: Live collection exact internal ID match is returned even when cursor omits limit()', async () => {
    const liveDoc = {
      id: 'live-only-id-9',
      title: 'Chief Medical Officer',
      company: 'Hospital Board',
      status: 'Approved',
      applicationsCount: 14
    };

    const pool = await JobRepository.findDuplicateCandidates(
      { id: 'live-only-id-9', title: 'Junior Clerk', company: 'Tax Office' },
      {
        isMongoConfiguredFn: () => true,
        getJobsCollectionFn: async () => ({
          find(query: any) {
            // Supports both direct .toArray() (for { id }) and .sort/.limit/.toArray() (for content queries)
            const res = query?.id === 'live-only-id-9' ? [liveDoc] : [];
            return {
              limit() { return this; },
              sort() { return this; },
              async toArray() { return res; }
            };
          }
        }),
        getPendingJobsCollectionFn: async () => ({
          find() {
            return {
              limit() { return this; },
              sort() { return this; },
              async toArray() { return []; }
            };
          }
        })
      }
    );

    const matched = pool.find((d) => d.id === 'live-only-id-9');
    assert.ok(matched, 'Live record with matching internal id must be present in duplicate candidate pool');
    assert.strictEqual(matched.applicationsCount, 14);
  });

  await runTest('STEP-8.5-A1 Case 3 [Mocked]: Pending collection exact internal ID match is returned independently', async () => {
    const pendingDoc = {
      id: 'pending-only-id-17',
      title: 'Research Officer',
      company: 'Planning Commission',
      status: 'Pending',
      applicationsCount: 0
    };

    const pool = await JobRepository.findDuplicateCandidates(
      { id: 'pending-only-id-17', title: 'Network Admin', company: 'IT Authority' },
      {
        isMongoConfiguredFn: () => true,
        getJobsCollectionFn: async () => ({
          find() {
            return {
              limit() { return this; },
              sort() { return this; },
              async toArray() { return []; }
            };
          }
        }),
        getPendingJobsCollectionFn: async () => ({
          find(query: any) {
            const res = query?.id === 'pending-only-id-17' ? [pendingDoc] : [];
            return {
              limit() { return this; },
              sort() { return this; },
              async toArray() { return res; }
            };
          }
        })
      }
    );

    assert.strictEqual(pool.some((d) => d.id === 'pending-only-id-17'), true);
  });

  await runTest('STEP-8.5-A1 Case 4 [Mocked]: Fail-closed when either Live or Pending independent internal-ID lookup throws', async () => {
    const okColl = (doc?: any) => ({
      find() {
        return {
          limit() { return this; },
          sort() { return this; },
          async toArray() { return doc ? [doc] : []; }
        };
      }
    });
    const failingIdColl = (label: string) => ({
      find(query: any) {
        return {
          limit() { return this; },
          sort() { return this; },
          async toArray() {
            if (query?.id !== undefined) {
              throw new Error(`${label} id lookup failure`);
            }
            return [];
          }
        };
      }
    });

    await assert.rejects(
      () =>
        JobRepository.findDuplicateCandidates(
          { id: 'fail-live-id' },
          {
            isMongoConfiguredFn: () => true,
            getJobsCollectionFn: async () => failingIdColl('live'),
            getPendingJobsCollectionFn: async () => okColl({ id: 'fail-live-id', title: 'Partial' })
          }
        ),
      /internal-ID lookup failed/i
    );

    await assert.rejects(
      () =>
        JobRepository.findDuplicateCandidates(
          { id: 'fail-pending-id' },
          {
            isMongoConfiguredFn: () => true,
            getJobsCollectionFn: async () => okColl({ id: 'fail-pending-id', title: 'Partial' }),
            getPendingJobsCollectionFn: async () => failingIdColl('pending')
          }
        ),
      /internal-ID lookup failed/i
    );
  });

  const createMockRegistryColl = () => {
    const registryMap = new Map<string, any>();
    return {
      insertOne: async (doc: any) => {
        if (registryMap.has(doc._id)) {
          const err: any = new Error(
            `E11000 duplicate key error collection: scraper_job_id_registry index: _id_ dup key: { _id: "${doc._id}" }`
          );
          err.code = 11000;
          throw err;
        }
        registryMap.set(doc._id, doc);
        return { acknowledged: true, insertedId: doc._id };
      },
      deleteOne: async (filter: any) => {
        const id = filter._id;
        const existed = registryMap.has(id);
        registryMap.delete(id);
        return { acknowledged: true, deletedCount: existed ? 1 : 0 };
      },
      findOne: async (filter: any) => registryMap.get(filter._id) || null
    };
  };

  await runTest('STEP-8.5-A1 Case 5 [Mocked]: createScrapedLive and addScrapedPending perform atomic insertOne without upsert and require confirmation', async () => {
    const liveOps: string[] = [];
    const pendingOps: string[] = [];

    const savedLive = await JobRepository.createScrapedLive(
      {
        id: 'atomic-live-free-1',
        title: 'Systems Architect',
        company: 'NADRA',
        city: 'Islamabad',
        sourceJobId: 'NAD-1',
        sourceUrl: 'https://nadra.gov.pk/1'
      },
      {
        isMongoConfiguredFn: () => true,
        applyVisibilityPolicyFn: async (j) => j,
        getIdRegistryCollectionFn: async () => createMockRegistryColl(),
        getPendingJobsCollectionFn: async () => ({
          findOne: async () => null
        }),
        getJobsCollectionFn: async () => ({
          updateOne: async () => {
            liveOps.push('updateOne-FORBIDDEN');
            throw new Error('upsert updateOne must never be called by createScrapedLive');
          },
          insertOne: async (doc: any) => {
            liveOps.push(`insertOne:${doc.id}`);
            return { acknowledged: true, insertedId: 'oid-live-1' };
          }
        })
      }
    );
    assert.strictEqual(savedLive.id, 'atomic-live-free-1');
    assert.strictEqual(savedLive.status, 'Approved');
    assert.deepStrictEqual(liveOps, ['insertOne:atomic-live-free-1']);

    const savedPending = await JobRepository.addScrapedPending(
      {
        id: 'atomic-pending-free-1',
        title: 'Data Officer',
        company: 'PBS',
        city: 'Lahore',
        sourceJobId: 'PBS-1',
        sourceUrl: 'https://pbs.gov.pk/1'
      },
      {
        isMongoConfiguredFn: () => true,
        getIdRegistryCollectionFn: async () => createMockRegistryColl(),
        getJobsCollectionFn: async () => ({
          findOne: async () => null
        }),
        getPendingJobsCollectionFn: async () => ({
          updateOne: async () => {
            pendingOps.push('updateOne-FORBIDDEN');
            throw new Error('upsert updateOne must never be called by addScrapedPending');
          },
          insertOne: async (doc: any) => {
            pendingOps.push(`insertOne:${doc.id}`);
            return { acknowledged: true, insertedId: 'oid-pending-1' };
          }
        })
      }
    );
    assert.strictEqual(savedPending.id, 'atomic-pending-free-1');
    assert.strictEqual(savedPending.status, 'Pending');
    assert.deepStrictEqual(pendingOps, ['insertOne:atomic-pending-free-1']);

    // Unacknowledged or missing insertedId must fail closed
    await assert.rejects(
      () =>
        JobRepository.createScrapedLive(
          { id: 'unacked-live-1', title: 'Test', company: 'Org' },
          {
            isMongoConfiguredFn: () => true,
            applyVisibilityPolicyFn: async (j) => j,
            getIdRegistryCollectionFn: async () => createMockRegistryColl(),
            getPendingJobsCollectionFn: async () => ({ findOne: async () => null }),
            getJobsCollectionFn: async () => ({
              insertOne: async () => ({ acknowledged: false, insertedId: 'oid-x' })
            })
          }
        ),
      /could not be confirmed/i
    );

    await assert.rejects(
      () =>
        JobRepository.addScrapedPending(
          { id: 'missing-oid-pending-1', title: 'Test', company: 'Org' },
          {
            isMongoConfiguredFn: () => true,
            getIdRegistryCollectionFn: async () => createMockRegistryColl(),
            getJobsCollectionFn: async () => ({ findOne: async () => null }),
            getPendingJobsCollectionFn: async () => ({
              insertOne: async () => ({ acknowledged: true })
            })
          }
        ),
      /could not be confirmed/i
    );
  });

  await runTest('STEP-8.5-A1 Case 6 [Mocked]: Concurrent E11000 race on Live scraper insert preserves existing live job and retries with fresh ID', async () => {
    resetActiveRun();
    const existingLiveDoc = {
      id: 'race-live-id-1',
      slug: 'original-doctor-race-live-id-1',
      title: 'Original Consultant Cardiologist',
      company: 'NICVD',
      status: 'Approved',
      applicationsCount: 53,
      applications: [{ id: 'app-90' }],
      applicationHistory: [{ ts: '2026-03-01' }]
    };
    const liveStore = new Map<string, any>([['race-live-id-1', existingLiveDoc]]);
    const insertAttempts: string[] = [];

    const mockJobsColl = {
      async insertOne(doc: any) {
        insertAttempts.push(doc.id);
        if (liveStore.has(doc.id)) {
          const dupErr: any = new Error(`E11000 duplicate key error collection: jobs index: id_1 dup key: { id: "${doc.id}" }`);
          dupErr.code = 11000;
          throw dupErr;
        }
        liveStore.set(doc.id, doc);
        return { acknowledged: true, insertedId: `oid-${doc.id}` };
      },
      async updateOne() {
        throw new Error('upsert must NOT be used by scraped live insert');
      }
    };

    // Simulate race: findDuplicateCandidates returned empty BEFORE concurrent writer inserted race-live-id-1
    const summary = await executeScraperWithWizard(
      { mode: 'complete', sourceIds: ['src-race-live'], autoPublishTrusted: true },
      {
        getConfigsFn: async () => [
          { id: 'src-race-live', name: 'Works Portal', url: 'https://works.gov.pk/jobs', status: 'Active Scheduled', autoApprove: true }
        ],
        updateSourceStatsFn: async () => {},
        addRunFn: async (run) => ({ ...run, isPersistedToMongo: false }),
        scrapePageFn: async () => [
          {
            id: 'race-live-id-1',
            slug: 'stale-slug-race-live-id-1',
            title: 'Structural Project Engineer',
            company: 'PWD',
            city: 'Islamabad',
            jobType: 'On-site',
            region: 'Pakistan',
            salary: 'PKR 175,000',
            currency: 'PKR',
            experienceLevel: 'Mid',
            department: 'Engineering',
            tags: [],
            description: 'Race condition protection test for live collection.',
            requirements: [],
            benefits: [],
            postedAt: 'Today',
            applicationsCount: 0,
            status: 'Pending',
            sourceJobId: 'PWD-88',
            sourceUrl: 'https://pwd.gov.pk/88',
            extractionMethod: 'html_cheerio'
          }
        ],
        enrichJobsFn: async (jobs) => jobs,
        findDuplicateCandidatesFn: async () => [],
        createJobFn: (job) =>
          JobRepository.createScrapedLive(job, {
            isMongoConfiguredFn: () => true,
            applyVisibilityPolicyFn: async (j) => j,
            getIdRegistryCollectionFn: async () => createMockRegistryColl(),
            getPendingJobsCollectionFn: async () => ({ findOne: async () => null }),
            getJobsCollectionFn: async () => mockJobsColl
          }),
        auditAddFn: () => {}
      }
    );

    assert.deepStrictEqual(insertAttempts[0], 'race-live-id-1');
    assert.strictEqual(insertAttempts.length, 2, 'Should fail once on E11000 and succeed cleanly on second attempt');
    assert.strictEqual(liveStore.size, 2, 'Both existing and new live records must coexist');
    assert.strictEqual(liveStore.get('race-live-id-1').title, 'Original Consultant Cardiologist');
    assert.strictEqual(liveStore.get('race-live-id-1').applicationsCount, 53);
    assert.strictEqual(liveStore.get('race-live-id-1').applications.length, 1);
    assert.strictEqual(liveStore.get('race-live-id-1').applicationHistory.length, 1);

    assert.strictEqual(summary.totalPublished, 1);
    assert.notStrictEqual(summary.publishedJobs[0].id, 'race-live-id-1');
    assert.ok(liveStore.has(summary.publishedJobs[0].id));
    assert.notStrictEqual(summary.publishedJobs[0].slug, 'stale-slug-race-live-id-1');
    const expectedSlugSuffix = String(summary.publishedJobs[0].id).replace(/[^a-z0-9]+/gi, '').slice(-8);
    assert.ok(String(summary.publishedJobs[0].slug).endsWith(expectedSlugSuffix));
    resetActiveRun();
  });

  await runTest('STEP-8.5-A1 Case 7 [Mocked]: Concurrent E11000 race on Pending scraper insert preserves existing pending job and retries cleanly', async () => {
    resetActiveRun();
    const existingPendingDoc = {
      id: 'race-pending-id-1',
      title: 'Existing Pending Tax Auditor',
      company: 'FBR',
      sourceJobId: 'FBR-11',
      status: 'Pending',
      applicationsCount: 0
    };
    const pendingStore = new Map<string, any>([['race-pending-id-1', existingPendingDoc]]);
    const insertAttempts: string[] = [];

    const mockPendingColl = {
      async insertOne(doc: any) {
        insertAttempts.push(doc.id);
        if (pendingStore.has(doc.id)) {
          const dupErr: any = new Error(`E11000 duplicate key error collection: pending_jobs index: id_1 dup key: { id: "${doc.id}" }`);
          dupErr.code = 11000;
          throw dupErr;
        }
        pendingStore.set(doc.id, doc);
        return { acknowledged: true, insertedId: `oid-${doc.id}` };
      }
    };

    const summary = await executeScraperWithWizard(
      { mode: 'complete', sourceIds: ['src-race-pending'] },
      {
        getConfigsFn: async () => [
          { id: 'src-race-pending', name: 'Transport Portal', url: 'https://transport.gov.pk/jobs', status: 'Active Scheduled', autoApprove: false }
        ],
        updateSourceStatsFn: async () => {},
        addRunFn: async (run) => ({ ...run, isPersistedToMongo: false }),
        scrapePageFn: async () => [
          {
            id: 'race-pending-id-1',
            title: 'Traffic Signal Technician',
            company: 'Traffic Authority',
            city: 'Karachi',
            jobType: 'On-site',
            region: 'Pakistan',
            salary: 'PKR 75,000',
            currency: 'PKR',
            experienceLevel: 'Junior',
            department: 'Operations',
            tags: [],
            description: 'Pending E11000 collision protection test.',
            requirements: [],
            benefits: [],
            postedAt: 'Today',
            applicationsCount: 0,
            status: 'Pending',
            sourceJobId: 'TA-502',
            sourceUrl: 'https://ta.gov.pk/502',
            extractionMethod: 'html_cheerio'
          }
        ],
        enrichJobsFn: async (jobs) => jobs,
        findDuplicateCandidatesFn: async () => [],
        addPendingJobFn: (job) =>
          JobRepository.addScrapedPending(job, {
            isMongoConfiguredFn: () => true,
            getIdRegistryCollectionFn: async () => createMockRegistryColl(),
            getJobsCollectionFn: async () => ({ findOne: async () => null }),
            getPendingJobsCollectionFn: async () => mockPendingColl
          }),
        auditAddFn: () => {}
      }
    );

    assert.strictEqual(insertAttempts[0], 'race-pending-id-1');
    assert.strictEqual(insertAttempts.length, 2);
    assert.strictEqual(pendingStore.size, 2);
    assert.strictEqual(pendingStore.get('race-pending-id-1').title, 'Existing Pending Tax Auditor');
    assert.strictEqual(summary.totalPending, 1);
    assert.notStrictEqual(summary.pendingJobs[0].id, 'race-pending-id-1');
    assert.ok(pendingStore.has(summary.pendingJobs[0].id));
    resetActiveRun();
  });

  await runTest('STEP-8.5-A1 Case 8 [Mocked]: Source identity fields and cross-collection uniqueness are preserved across E11000 collision retries', async () => {
    let calls = 0;
    const saved = await JobRepository.createScrapedLive(
      {
        id: 'cross-coll-id-1',
        slug: 'old-cross-coll-slug',
        title: 'Hydraulic Engineer',
        company: 'IRSA',
        city: 'Islamabad',
        scraperSourceId: 'irsa-portal',
        scraperSourceName: 'IRSA Official Portal',
        sourceJobId: 'IRSA-2026-44',
        sourceUrl: 'https://irsa.gov.pk/jobs/44',
        originalApplyUrl: 'https://irsa.gov.pk/apply/44',
        applicationUrl: 'https://careers.irsa.gov.pk/form/44'
      },
      {
        isMongoConfiguredFn: () => true,
        applyVisibilityPolicyFn: async (j) => j,
        getIdRegistryCollectionFn: async () => createMockRegistryColl(),
        getPendingJobsCollectionFn: async () => ({
          // First ID exists in opposite (pending) collection!
          findOne: async ({ id }: any) => (id === 'cross-coll-id-1' ? { id } : null)
        }),
        getJobsCollectionFn: async () => ({
          insertOne: async (doc: any) => {
            calls++;
            // Also simulate one concurrent E11000 on the first fresh live ID
            if (calls === 1) {
              const e: any = new Error('E11000 duplicate key');
              e.code = 11000;
              throw e;
            }
            return { acknowledged: true, insertedId: `oid-${doc.id}` };
          }
        })
      }
    );

    assert.strictEqual(calls, 2);
    assert.notStrictEqual(saved.id, 'cross-coll-id-1');
    assert.ok(saved.id.startsWith('scraped-irsa-portal-'));
    assert.notStrictEqual(saved.slug, 'old-cross-coll-slug');
    const expectedSavedSlugSuffix = String(saved.id).replace(/[^a-z0-9]+/gi, '').slice(-8);
    assert.ok(String(saved.slug).endsWith(expectedSavedSlugSuffix));
    assert.strictEqual(saved.sourceJobId, 'IRSA-2026-44');
    assert.strictEqual(saved.sourceUrl, 'https://irsa.gov.pk/jobs/44');
    assert.strictEqual(saved.originalApplyUrl, 'https://irsa.gov.pk/apply/44');
    assert.strictEqual(saved.applicationUrl, 'https://careers.irsa.gov.pk/form/44');
    assert.strictEqual(saved.scraperSourceId, 'irsa-portal');
    assert.strictEqual(saved.scraperSourceName, 'IRSA Official Portal');
  });

  await runTest('STEP-8.5-A1 Case 9 [Mocked]: Exhausting bounded retries on persistent E11000 fails closed without upsert and records scraper save failure', async () => {
    resetActiveRun();
    let upsertCalled = false;
    let insertCount = 0;

    await assert.rejects(
      () =>
        JobRepository.createScrapedLive(
          {
            id: 'always-collide-1',
            title: 'Persistent Conflict Job',
            company: 'Test Org',
            scraperSourceId: 'conflict-src'
          },
          {
            isMongoConfiguredFn: () => true,
            applyVisibilityPolicyFn: async (j) => j,
            getIdRegistryCollectionFn: async () => createMockRegistryColl(),
            getPendingJobsCollectionFn: async () => ({ findOne: async () => null }),
            getJobsCollectionFn: async () => ({
              insertOne: async () => {
                insertCount++;
                const err: any = new Error('E11000 duplicate key error');
                err.code = 11000;
                throw err;
              },
              updateOne: async () => {
                upsertCalled = true;
                return { acknowledged: true, matchedCount: 1 };
              }
            })
          }
        ),
      (err: any) =>
        err instanceof ScraperPersistenceCollisionError &&
        err.collisionRetriesExhausted === true &&
        err.attempts === MAX_SCRAPER_INSERT_RETRIES + 1
    );

    assert.strictEqual(insertCount, MAX_SCRAPER_INSERT_RETRIES + 1);
    assert.strictEqual(upsertCalled, false, 'Must NEVER fall back to upsert when collision retries exhaust');

    // End-to-end inside executeScraperWithWizard with custom direct insert fn throwing E11000 endlessly
    let engineCalls = 0;
    let checkpointStatsCaptured: any = null;
    const summary = await executeScraperWithWizard(
      { mode: 'complete', sourceIds: ['src-exhaust'], autoPublishTrusted: true },
      {
        getConfigsFn: async () => [
          {
            id: 'src-exhaust',
            name: 'Exhaust Portal',
            url: 'https://exhaust.gov.pk/jobs',
            status: 'Active Scheduled',
            autoApprove: true,
            lastSuccessfulScrapeAt: '2026-11-01T00:00:00.000Z'
          }
        ],
        updateSourceStatsFn: async (_id, stats) => {
          if (stats && stats.lastCompletedAt) checkpointStatsCaptured = stats;
        },
        addRunFn: async (run) => ({ ...run, isPersistedToMongo: false }),
        scrapePageFn: async () => [
          {
            id: 'exhaust-job-1',
            title: 'Biosecurity Officer',
            company: 'Food Authority',
            jobType: 'On-site',
            region: 'Pakistan',
            salary: 'PKR 110,000',
            currency: 'PKR',
            experienceLevel: 'Mid',
            department: 'Lab',
            tags: [],
            description: 'Bounded retry exhaustion check.',
            requirements: [],
            benefits: [],
            postedAt: 'Today',
            applicationsCount: 0,
            status: 'Pending',
            sourceJobId: 'FA-1',
            sourceUrl: 'https://fa.gov.pk/1',
            extractionMethod: 'html_cheerio'
          }
        ],
        enrichJobsFn: async (jobs) => jobs,
        findDuplicateCandidatesFn: async () => [],
        createJobFn: async () => {
          engineCalls++;
          const err: any = new Error('E11000 duplicate key error');
          err.code = 11000;
          throw err;
        },
        auditAddFn: () => {}
      }
    );

    assert.strictEqual(engineCalls, MAX_SCRAPER_INSERT_RETRIES + 1);
    assert.strictEqual(summary.totalPublished, 0);
    assert.strictEqual(summary.totalPending, 0);
    assert.strictEqual(summary.totalFailedToSave, 1);
    assert.strictEqual(summary.failedToSaveErrors?.length, 1);
    assert.strictEqual(
      checkpointStatsCaptured?.lastSuccessfulScrapeAt,
      '2026-11-01T00:00:00.000Z',
      'Save failure from collision exhaustion must block checkpoint advancement'
    );
    resetActiveRun();
  });

  await runTest('STEP-8.5-A1 Case 10 [Mocked]: Non-collision DB errors are NOT retried as ID collisions and fail immediately', async () => {
    assert.strictEqual(isMongoDuplicateKeyError({ code: 11000 }), true);
    assert.strictEqual(isMongoDuplicateKeyError({ code: 11001 }), true);
    assert.strictEqual(isMongoDuplicateKeyError(new Error('E11000 duplicate key error')), true);
    assert.strictEqual(isMongoDuplicateKeyError(new Error('MongoNetworkTimeoutError: socket timed out')), false);

    let networkAttempts = 0;
    await assert.rejects(
      () =>
        JobRepository.addScrapedPending(
          { id: 'net-err-1', title: 'Analyst', company: 'Org' },
          {
            isMongoConfiguredFn: () => true,
            getIdRegistryCollectionFn: async () => createMockRegistryColl(),
            getJobsCollectionFn: async () => ({ findOne: async () => null }),
            getPendingJobsCollectionFn: async () => ({
              insertOne: async () => {
                networkAttempts++;
                const err: any = new Error('MongoNetworkTimeoutError: timed out');
                err.code = 89;
                throw err;
              }
            })
          }
        ),
      /MongoNetworkTimeoutError/
    );
    assert.strictEqual(networkAttempts, 1, 'Non-collision errors must not trigger collision retry loop');
  });

  await runTest('STEP-8.5-A1 Case 11 [Unit]: Legacy non-scraper JobRepository.create and JobRepository.addPending methods remain intact and preserve existing signatures', () => {
    assert.strictEqual(typeof JobRepository.create, 'function');
    assert.strictEqual(typeof JobRepository.addPending, 'function');
    assert.strictEqual(typeof JobRepository.createScrapedLive, 'function');
    assert.strictEqual(typeof JobRepository.addScrapedPending, 'function');
    assert.strictEqual(JobRepository.create === JobRepository.createScrapedLive, false);
    assert.strictEqual(JobRepository.addPending === JobRepository.addScrapedPending, false);
  });

  await runTest('STEP-8.5-A1 Case 12 [Mocked]: Existing duplicateMode (with/without) and normal approvePending flows continue working properly after atomic persistence update', async () => {
    resetActiveRun();
    const pendingStore = new Map<string, any>();
    const liveStore = new Map<string, any>([
      [
        'existing-live-base-1',
        {
          id: 'existing-live-base-1',
          title: 'Director Planning',
          company: 'HEC',
          sourceJobId: 'HEC-10',
          sourceUrl: 'https://hec.gov.pk/10',
          status: 'Approved',
          applicationsCount: 6
        }
      ]
    ]);

    const summaryWith = await executeScraperWithWizard(
      { mode: 'complete', sourceIds: ['src-hec'], duplicateMode: 'with' },
      {
        getConfigsFn: async () => [
          { id: 'src-hec', name: 'HEC', url: 'https://hec.gov.pk', status: 'Active Scheduled', autoApprove: true }
        ],
        updateSourceStatsFn: async () => {},
        addRunFn: async (run) => ({ ...run, isPersistedToMongo: false }),
        scrapePageFn: async () => [
          {
            id: 'existing-live-base-1',
            title: 'Director Planning',
            company: 'HEC',
            city: 'Islamabad',
            jobType: 'On-site',
            region: 'Pakistan',
            salary: 'PKR 220,000',
            currency: 'PKR',
            experienceLevel: 'Senior',
            department: 'Planning',
            tags: [],
            description: 'Duplicate job in with mode.',
            requirements: [],
            benefits: [],
            postedAt: 'Today',
            applicationsCount: 0,
            status: 'Pending',
            sourceJobId: 'HEC-10',
            sourceUrl: 'https://hec.gov.pk/10',
            extractionMethod: 'html_cheerio'
          }
        ],
        enrichJobsFn: async (jobs) => jobs,
        findDuplicateCandidatesFn: async () => [liveStore.get('existing-live-base-1')],
        addPendingJobFn: (job) =>
          JobRepository.addScrapedPending(job, {
            isMongoConfiguredFn: () => true,
            getIdRegistryCollectionFn: async () => createMockRegistryColl(),
            getJobsCollectionFn: async () => ({ findOne: async ({ id }: any) => liveStore.get(id) || null }),
            getPendingJobsCollectionFn: async () => ({
              insertOne: async (doc: any) => {
                pendingStore.set(doc.id, doc);
                return { acknowledged: true, insertedId: `oid-${doc.id}` };
              }
            })
          }),
        auditAddFn: () => {}
      }
    );

    assert.strictEqual(summaryWith.totalDuplicates, 1);
    assert.strictEqual(summaryWith.totalPending, 1);
    assert.strictEqual(pendingStore.size, 1);
    const savedPendingDup = Array.from(pendingStore.values())[0];
    assert.notStrictEqual(savedPendingDup.id, 'existing-live-base-1');
    assert.strictEqual(savedPendingDup.isDuplicate, true);
    assert.strictEqual(savedPendingDup.duplicateOfJobId, 'existing-live-base-1');

    // Approve a distinct non-conflicting pending record cleanly
    const approvedNormal = await JobRepository.approvePending(savedPendingDup.id, {
      isMongoConfiguredFn: () => true,
      applyVisibilityPolicyFn: async (j) => j,
      getPendingJobsCollectionFn: async () => ({
        findOne: async ({ id }: any) => pendingStore.get(id) || null,
        deleteOne: async ({ id }: any) => {
          pendingStore.delete(id);
          return { acknowledged: true, deletedCount: 1 };
        }
      }),
      getJobsCollectionFn: async () => ({
        findOne: async ({ id }: any) => liveStore.get(id) || null,
        updateOne: async ({ id }: any, update: any) => {
          liveStore.set(id, update.$set);
          return { acknowledged: true, matchedCount: 0, upsertedCount: 1 };
        }
      })
    });

    assert.strictEqual(approvedNormal?.status, 'Approved');
    assert.strictEqual(liveStore.get('existing-live-base-1')?.applicationsCount, 6);
    assert.strictEqual(pendingStore.size, 0);
    resetActiveRun();
  });

  // =========================================================================
  // STEP-8.6-A — TARGETED SSRF SECURITY FIXES (5 Tests)
  // =========================================================================

  await runTest('STEP-8.6-A Case 1 [Unit]: Robust IPv4-mapped IPv6 validation blocks loopback, private, and metadata ranges in both dotted and hex formats while allowing public IPs', () => {
    // 1. ::ffff:127.0.0.1 (dotted loopback)
    const t1 = isPrivateOrBlockedIp('::ffff:127.0.0.1');
    assert.strictEqual(t1.blocked, true);
    assert.ok(t1.reason?.includes('Loopback'));
    assert.strictEqual(validateSafeScrapeUrl('http://[::ffff:127.0.0.1]/jobs').safe, false);

    // 2. ::ffff:7f00:1 (hex loopback)
    const t2 = isPrivateOrBlockedIp('::ffff:7f00:1');
    assert.strictEqual(t2.blocked, true);
    assert.ok(t2.reason?.includes('Loopback'));
    assert.strictEqual(validateSafeScrapeUrl('http://[::ffff:7f00:1]/jobs').safe, false);

    // 3. ::ffff:a00:5 (hex RFC1918 10.0.0.5)
    const t3 = isPrivateOrBlockedIp('::ffff:a00:5');
    assert.strictEqual(t3.blocked, true);
    assert.ok(t3.reason?.includes('10.0.0.0/8'));
    assert.strictEqual(validateSafeScrapeUrl('http://[::ffff:a00:5]/jobs').safe, false);

    // 4. ::ffff:c0a8:101 (hex RFC1918 192.168.1.1)
    const t4 = isPrivateOrBlockedIp('::ffff:c0a8:101');
    assert.strictEqual(t4.blocked, true);
    assert.ok(t4.reason?.includes('192.168.0.0/16'));
    assert.strictEqual(validateSafeScrapeUrl('http://[::ffff:c0a8:101]/jobs').safe, false);

    // 5. ::ffff:a9fe:a9fe (hex Cloud metadata / link-local 169.254.169.254)
    const t5 = isPrivateOrBlockedIp('::ffff:a9fe:a9fe');
    assert.strictEqual(t5.blocked, true);
    assert.ok(t5.reason?.includes('169.254.0.0/16'));
    assert.strictEqual(validateSafeScrapeUrl('http://[::ffff:a9fe:a9fe]/latest/meta-data/').safe, false);

    // 6. Legitimate public IPv4-mapped IPv6 (dotted and hex) must NOT be blocked
    const pubDotted = isPrivateOrBlockedIp('::ffff:8.8.8.8');
    assert.strictEqual(pubDotted.blocked, false);
    assert.strictEqual(validateSafeScrapeUrl('https://[::ffff:8.8.8.8]/jobs').safe, true);

    const pubHex = isPrivateOrBlockedIp('::ffff:808:808');
    assert.strictEqual(pubHex.blocked, false);
    assert.strictEqual(validateSafeScrapeUrl('https://[::ffff:808:808]/jobs').safe, true);
  });

  await runTest('STEP-8.6-A Case 2 [Unit]: Comprehensive IPv6 validation identifies loopback, unspecified, ULA, link-local, multicast, and documentation while permitting public IPv6', () => {
    // 1. Compressed loopback
    const cLoop = isPrivateOrBlockedIp('::1');
    assert.strictEqual(cLoop.blocked, true);
    assert.ok(cLoop.reason?.includes('loopback'));
    assert.strictEqual(validateSafeScrapeUrl('http://[::1]/api').safe, false);

    // 2. Expanded loopback (with and without brackets)
    for (const expLoop of ['0:0:0:0:0:0:0:1', '0000:0000:0000:0000:0000:0000:0000:0001', '[0:0:0:0:0:0:0:1]']) {
      const res = isPrivateOrBlockedIp(expLoop);
      assert.strictEqual(res.blocked, true);
      assert.ok(res.reason?.includes('loopback'));
    }
    assert.strictEqual(validateSafeScrapeUrl('http://[0:0:0:0:0:0:0:1]/api').safe, false);

    // 3. Compressed unspecified
    const cUnspec = isPrivateOrBlockedIp('::');
    assert.strictEqual(cUnspec.blocked, true);
    assert.ok(cUnspec.reason?.includes('unspecified'));
    assert.strictEqual(validateSafeScrapeUrl('http://[::]/api').safe, false);

    // 4. Expanded unspecified
    for (const expUnspec of ['0:0:0:0:0:0:0:0', '0000:0000:0000:0000:0000:0000:0000:0000']) {
      const res = isPrivateOrBlockedIp(expUnspec);
      assert.strictEqual(res.blocked, true);
      assert.ok(res.reason?.includes('unspecified'));
    }
    assert.strictEqual(validateSafeScrapeUrl('http://[0:0:0:0:0:0:0:0]/api').safe, false);

    // 5. Unique-local addresses (fc00::/7 covering fc00:: and fd00::)
    for (const ula of ['fc00::1', 'fd00::1', 'fd12:3456:789a::1']) {
      const res = isPrivateOrBlockedIp(ula);
      assert.strictEqual(res.blocked, true, `Expected ${ula} to be blocked as unique-local`);
      assert.ok(res.reason?.includes('unique-local'));
      assert.strictEqual(validateSafeScrapeUrl(`http://[${ula}]/jobs`).safe, false);
    }

    // 6. Link-local addresses (fe80::/10 covering fe80:: to febf::)
    for (const linkLocal of ['fe80::1', 'fe80::200:f8ff:fe21:67cf', 'febf::1']) {
      const res = isPrivateOrBlockedIp(linkLocal);
      assert.strictEqual(res.blocked, true, `Expected ${linkLocal} to be blocked as link-local`);
      assert.ok(res.reason?.includes('link-local'));
      assert.strictEqual(validateSafeScrapeUrl(`http://[${linkLocal}]/jobs`).safe, false);
    }

    // 7. Multicast addresses (ff00::/8)
    for (const mc of ['ff02::1', 'ff01::1', 'ff05::2']) {
      const res = isPrivateOrBlockedIp(mc);
      assert.strictEqual(res.blocked, true, `Expected ${mc} to be blocked as multicast`);
      assert.ok(res.reason?.includes('multicast'));
      assert.strictEqual(validateSafeScrapeUrl(`http://[${mc}]/jobs`).safe, false);
    }

    // 8. Documentation addresses (2001:db8::/32)
    for (const doc of ['2001:db8::1', '2001:0db8:85a3:0000:0000:8a2e:0370:7334']) {
      const res = isPrivateOrBlockedIp(doc);
      assert.strictEqual(res.blocked, true, `Expected ${doc} to be blocked as documentation`);
      assert.ok(res.reason?.includes('documentation'));
      assert.strictEqual(validateSafeScrapeUrl(`http://[${doc}]/jobs`).safe, false);
    }

    // 9. Legitimate public IPv6 addresses must NOT be blocked
    for (const pubIpv6 of [
      '2607:f8b0:4005:805::200e',
      '2001:4860:4860::8888',
      '2a00:1450:4009:81f::200e'
    ]) {
      const res = isPrivateOrBlockedIp(pubIpv6);
      assert.strictEqual(res.blocked, false, `Expected public IPv6 ${pubIpv6} to be allowed`);
      assert.strictEqual(validateSafeScrapeUrl(`https://[${pubIpv6}]/jobs`).safe, true);
    }
  });

  await runTest('STEP-8.6-A Case 3 [Unit]: Caller-supplied dispatcher cannot override scraperTlsDispatcher and normal request options are preserved', async () => {
    const originalFetch = globalThis.fetch;
    let interceptedInit: any = null;
    const foreignDispatcher = new Agent({ connect: { timeout: 1234 } });

    globalThis.fetch = (async (_input: any, init: any) => {
      interceptedInit = init;
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }) as any;

    try {
      const res = await safeFetchWithRetry(
        'https://[2607:f8b0:4005:805::200e]/test-endpoint',
        {
          method: 'POST',
          body: JSON.stringify({ query: 'vacancies' }),
          headers: {
            'X-Custom-Client': 'AutomatedPortalEngine',
            'Authorization': 'Bearer secret-token-123'
          },
          // Attempt to pass custom foreign dispatcher to override internal protection
          dispatcher: foreignDispatcher
        } as any,
        5000,
        0
      );

      assert.strictEqual(res.status, 200);
      assert.ok(interceptedInit, 'fetch must have been called');
      assert.strictEqual(
        interceptedInit.dispatcher,
        scraperTlsDispatcher,
        'Internal scraperTlsDispatcher MUST be enforced'
      );
      assert.notStrictEqual(
        interceptedInit.dispatcher,
        foreignDispatcher,
        'Caller-supplied dispatcher must NEVER replace internal scraperTlsDispatcher'
      );
      assert.strictEqual(interceptedInit.method, 'POST');
      assert.strictEqual(interceptedInit.body, JSON.stringify({ query: 'vacancies' }));
      assert.strictEqual(interceptedInit.headers['X-Custom-Client'], 'AutomatedPortalEngine');
      assert.strictEqual(interceptedInit.headers['Authorization'], 'Bearer secret-token-123');
      assert.ok(interceptedInit.headers['User-Agent'], 'Default User-Agent header must be preserved');
      assert.strictEqual(interceptedInit.redirect, 'manual');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  await runTest('STEP-8.6-A Case 4 [Unit]: Intermediate 429 and redirect response bodies are cancelled, final body is readable, and timers/listeners cleaned up', async () => {
    const originalFetch = globalThis.fetch;
    const originalClearTimeout = globalThis.clearTimeout;

    let cancelCalled429 = false;
    let cancelCalled302 = false;
    let cancelCalled200 = false;
    let fetchCalls = 0;
    let clearTimeoutCount = 0;

    globalThis.clearTimeout = (id: any) => {
      clearTimeoutCount++;
      return originalClearTimeout(id);
    };

    function createTrackedResponse(bodyText: string, init: ResponseInit, type: '429' | '302' | '200') {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(bodyText));
          controller.close();
        },
        cancel() {
          if (type === '429') cancelCalled429 = true;
          if (type === '302') cancelCalled302 = true;
          if (type === '200') cancelCalled200 = true;
        }
      });
      return new Response(stream, init);
    }

    // Call sequence:
    // Hop 1: 429 -> will be retried (attempt 0 -> attempt 1)
    // Hop 2: 302 -> redirects to target URL
    // Hop 3: 200 -> final response
    globalThis.fetch = (async () => {
      fetchCalls++;
      if (fetchCalls === 1) {
        return createTrackedResponse('Rate limited, retry shortly', { status: 429, headers: { 'Retry-After': '0' } }, '429');
      }
      if (fetchCalls === 2) {
        return createTrackedResponse('Redirecting to secure target', {
          status: 302,
          headers: { Location: 'https://[2001:4860:4860::8888]/final-target' }
        }, '302');
      }
      return createTrackedResponse(JSON.stringify({ success: true, count: 42 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }, '200');
    }) as any;

    const parentController = new AbortController();
    const parentSignal = parentController.signal;
    let activeAbortListeners = 0;
    const origAddListener = parentSignal.addEventListener.bind(parentSignal);
    const origRemoveListener = parentSignal.removeEventListener.bind(parentSignal);
    parentSignal.addEventListener = (type: string, listener: any, opts: any) => {
      if (type === 'abort') activeAbortListeners++;
      return origAddListener(type, listener, opts);
    };
    parentSignal.removeEventListener = (type: string, listener: any, opts: any) => {
      if (type === 'abort') activeAbortListeners--;
      return origRemoveListener(type, listener, opts);
    };

    try {
      const finalRes = await safeFetchWithRetry(
        'https://[2607:f8b0:4005:805::200e]/initial',
        { signal: parentSignal },
        5000,
        1
      );

      assert.strictEqual(finalRes.status, 200);
      assert.strictEqual(cancelCalled429, true, 'Intermediate 429 response body MUST be canceled before retry');
      assert.strictEqual(cancelCalled302, true, 'Intermediate 302 redirect response body MUST be canceled before next hop');
      assert.strictEqual(cancelCalled200, false, 'Final 200 response body must NOT be canceled by safeFetchWithRetry');

      // Final response body remains fully readable by caller
      const text = await finalRes.text();
      assert.strictEqual(JSON.parse(text).count, 42);

      // Verify timer and listener cleanup
      assert.strictEqual(activeAbortListeners, 0, 'Parent abort signal listener must be removed after completion');
      assert.ok(clearTimeoutCount >= 2, 'Timeouts must be cleared for each attempt');
    } finally {
      globalThis.fetch = originalFetch;
      globalThis.clearTimeout = originalClearTimeout;
    }
  });

  await runTest('STEP-8.6-A Case 5 [Unit]: Timeout and parent abort listener are cleaned up safely on failure paths without resource leaks', async () => {
    const originalFetch = globalThis.fetch;
    const originalClearTimeout = globalThis.clearTimeout;

    let clearedTimeouts = 0;
    globalThis.clearTimeout = (id: any) => {
      clearedTimeouts++;
      return originalClearTimeout(id);
    };

    globalThis.fetch = (async () => {
      throw new Error('Simulated network failure on target host');
    }) as any;

    const parentController = new AbortController();
    const parentSignal = parentController.signal;
    let activeAbortListeners = 0;
    const origAddListener = parentSignal.addEventListener.bind(parentSignal);
    const origRemoveListener = parentSignal.removeEventListener.bind(parentSignal);
    parentSignal.addEventListener = (type: string, listener: any, opts: any) => {
      if (type === 'abort') activeAbortListeners++;
      return origAddListener(type, listener, opts);
    };
    parentSignal.removeEventListener = (type: string, listener: any, opts: any) => {
      if (type === 'abort') activeAbortListeners--;
      return origRemoveListener(type, listener, opts);
    };

    try {
      await assert.rejects(
        () =>
          safeFetchWithRetry(
            'https://[2607:f8b0:4005:805::200e]/fail-path',
            { signal: parentSignal },
            3000,
            0
          ),
        /Remote portal unavailable.*Simulated network failure/
      );

      assert.strictEqual(activeAbortListeners, 0, 'Parent abort listener must be cleaned up on failure path');
      assert.ok(clearedTimeouts >= 1, 'Attempt timeout must be cleared on failure path');
    } finally {
      globalThis.fetch = originalFetch;
      globalThis.clearTimeout = originalClearTimeout;
    }
  });

  await runTest('STEP-8.6-A2 Case 1 [Unit]: Special-purpose IPv6 range validation blocks 6to4, Teredo, NAT64, and deprecated IPv4-compatible addresses while preserving public IPv4-mapped and public IPv6', () => {
    // 1. 6to4 transition prefix (2002::/16)
    const t6to4_1 = isPrivateOrBlockedIp('2002:0a00:0001::1');
    assert.strictEqual(t6to4_1.blocked, true);
    assert.ok(t6to4_1.reason?.includes('6to4'));
    assert.strictEqual(validateSafeScrapeUrl('http://[2002:0a00:0001::1]/jobs').safe, false);

    const t6to4_2 = isPrivateOrBlockedIp('2002:c0a8:0101::1');
    assert.strictEqual(t6to4_2.blocked, true);
    assert.ok(t6to4_2.reason?.includes('6to4'));
    assert.strictEqual(validateSafeScrapeUrl('http://[2002:c0a8:0101::1]/jobs').safe, false);

    // 2. Teredo tunneling prefix (2001:0000::/32)
    const teredo = isPrivateOrBlockedIp('2001:0000:4136:e378:8000:63bf:3fff:fdd2');
    assert.strictEqual(teredo.blocked, true);
    assert.ok(teredo.reason?.includes('Teredo'));
    assert.strictEqual(validateSafeScrapeUrl('http://[2001:0000:4136:e378:8000:63bf:3fff:fdd2]/jobs').safe, false);

    // 3. NAT64 well-known prefix (64:ff9b::/96)
    const nat64 = isPrivateOrBlockedIp('64:ff9b::a00:1');
    assert.strictEqual(nat64.blocked, true);
    assert.ok(nat64.reason?.includes('NAT64'));
    assert.strictEqual(validateSafeScrapeUrl('http://[64:ff9b::a00:1]/jobs').safe, false);

    // 4. Deprecated IPv4-compatible IPv6 (::/96)
    const compatHex = isPrivateOrBlockedIp('::a00:1');
    assert.strictEqual(compatHex.blocked, true);
    assert.ok(compatHex.reason?.includes('IPv4-compatible'));
    assert.strictEqual(validateSafeScrapeUrl('http://[::a00:1]/jobs').safe, false);

    const compatDotted = isPrivateOrBlockedIp('::8.8.8.8');
    assert.strictEqual(compatDotted.blocked, true);
    assert.ok(compatDotted.reason?.includes('IPv4-compatible'));
    assert.strictEqual(validateSafeScrapeUrl('http://[::8.8.8.8]/jobs').safe, false);

    // 5. Legitimate public IPv4-mapped IPv6 (::ffff:0:0/96) must remain allowed
    const mappedDotted = isPrivateOrBlockedIp('::ffff:8.8.8.8');
    assert.strictEqual(mappedDotted.blocked, false);
    assert.strictEqual(validateSafeScrapeUrl('https://[::ffff:8.8.8.8]/jobs').safe, true);

    const mappedHex = isPrivateOrBlockedIp('::ffff:808:808');
    assert.strictEqual(mappedHex.blocked, false);
    assert.strictEqual(validateSafeScrapeUrl('https://[::ffff:808:808]/jobs').safe, true);

    // 6. Legitimate public IPv6 addresses continue passing
    for (const pubIpv6 of [
      '2607:f8b0:4005:805::200e',
      '2001:4860:4860::8888',
      '2a00:1450:4009:81f::200e'
    ]) {
      const res = isPrivateOrBlockedIp(pubIpv6);
      assert.strictEqual(res.blocked, false, `Expected public IPv6 ${pubIpv6} to be allowed`);
      assert.strictEqual(validateSafeScrapeUrl(`https://[${pubIpv6}]/jobs`).safe, true);
    }
  });

  // ============================================================================
  // STEP-8.6-B1: Strict Streaming Response-Size Limits for HTML & ATS JSON
  // ============================================================================

  await runTest('STEP-8.6-B1 Case 1 [Mocked]: Main HTML response below 8MB limit succeeds and extracts jobs', async () => {
    const htmlBody = `
      <html><body>
        <div class="job-card">
          <h2 class="job-title"><a href="/jobs/101">Principal Cloud Architect</a></h2>
          <span class="location">Islamabad, Pakistan</span>
          <div class="company">TechCorp</div>
        </div>
      </body></html>
    `;
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(htmlBody));
        controller.close();
      }
    });
    const mockFetch = async () => ({
      ok: true,
      status: 200,
      headers: new Headers({
        'content-type': 'text/html',
        'content-length': String(new TextEncoder().encode(htmlBody).byteLength)
      }),
      body: stream
    } as any);

    const jobs = await scrapeTargetPortal(
      { id: 'html-ok', name: 'TechCorp Portal', url: 'https://example.com/careers' },
      {},
      mockFetch
    );
    assert.strictEqual(jobs.length, 1);
    assert.strictEqual(jobs[0].title, 'Principal Cloud Architect');
    assert.strictEqual(jobs[0].company, 'TechCorp');
  });

  await runTest('STEP-8.6-B1 Case 2 [Mocked]: HTML response with Content-Length above 8MB is rejected early and stream is cancelled', async () => {
    let streamCancelled = false;
    let cancelReason = '';
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('<html><body>Oversized</body></html>'));
      },
      cancel(reason) {
        streamCancelled = true;
        cancelReason = String(reason);
      }
    });
    const mockFetch = async () => ({
      ok: true,
      status: 200,
      headers: new Headers({
        'content-type': 'text/html',
        'content-length': String(9 * 1024 * 1024) // 9 MB > 8 MB
      }),
      body: stream
    } as any);

    let errorCaught: any = null;
    try {
      await scrapeTargetPortal(
        { id: 'html-cl-over', name: 'Giant Portal', url: 'https://example.com/careers' },
        {},
        mockFetch
      );
    } catch (err: any) {
      errorCaught = err;
    }
    assert.ok(errorCaught, 'Oversized HTML response with Content-Length above 8MB must be rejected');
    assert.ok(
      /Content-Length.*exceeds maximum allowed limit/i.test(errorCaught.message),
      `Error message must indicate Content-Length exceeded: ${errorCaught.message}`
    );
    assert.strictEqual(streamCancelled, true, 'Response body stream must be cancelled immediately upon Content-Length rejection');
    assert.ok(cancelReason.includes('exceeds limit'), `Cancel reason must indicate limit exceeded: ${cancelReason}`);
  });

  await runTest('STEP-8.6-B1 Case 3 [Mocked]: Chunked HTML stream exceeding 8MB without Content-Length is rejected and cancelled immediately', async () => {
    let chunkStreamCancelled = false;
    const chunkSize = 3 * 1024 * 1024; // 3 MB per chunk
    let chunkCount = 0;
    const stream = new ReadableStream({
      pull(controller) {
        chunkCount++;
        if (chunkCount <= 4) { // 4 * 3 MB = 12 MB > 8 MB limit
          controller.enqueue(new Uint8Array(chunkSize));
        } else {
          controller.close();
        }
      },
      cancel(reason) {
        chunkStreamCancelled = true;
      }
    });
    const mockFetch = async () => ({
      ok: true,
      status: 200,
      headers: new Headers({
        'content-type': 'text/html'
        // No Content-Length header (chunked transfer)
      }),
      body: stream
    } as any);

    let errorCaught: any = null;
    try {
      await scrapeTargetPortal(
        { id: 'html-chunk-over', name: 'Chunk Portal', url: 'https://example.com/careers' },
        {},
        mockFetch
      );
    } catch (err: any) {
      errorCaught = err;
    }
    assert.ok(errorCaught, 'Chunked HTML stream exceeding 8MB must be rejected');
    assert.ok(
      /stream exceeded maximum allowed limit/i.test(errorCaught.message),
      `Error message must indicate stream limit exceeded: ${errorCaught.message}`
    );
    assert.strictEqual(chunkStreamCancelled, true, 'Oversized chunked HTML stream must be cancelled immediately');
  });

  await runTest('STEP-8.6-B1 Case 4 [Mocked]: ATS JSON below 5MB parses correctly across Greenhouse, Lever, SmartRecruiters, and Ashby', async () => {
    // Greenhouse
    const ghData = JSON.stringify({
      jobs: [
        { id: 401, title: 'Lead Platform Engineer', absolute_url: 'https://boards.greenhouse.io/acme/401', updated_at: '2026-11-01' }
      ]
    });
    const ghFetch = async () => ({
      ok: true,
      status: 200,
      headers: new Headers({
        'content-type': 'application/json',
        'content-length': String(new TextEncoder().encode(ghData).byteLength)
      }),
      body: new ReadableStream({
        start(c) {
          c.enqueue(new TextEncoder().encode(ghData));
          c.close();
        }
      })
    } as any);
    const ghResult = await scrapeGreenhouseApi(
      { id: 'gh-valid', name: 'GH Acme', url: 'https://boards.greenhouse.io/acme' },
      {},
      ghFetch
    );
    assert.strictEqual(ghResult?.status, 'success');
    assert.strictEqual(ghResult?.jobs.length, 1);
    assert.strictEqual(ghResult?.jobs[0].title, 'Lead Platform Engineer');

    // Lever
    const leverData = JSON.stringify([
      { id: 'lv-99', text: 'Senior Infrastructure Engineer', hostedUrl: 'https://jobs.lever.co/acme/lv-99' }
    ]);
    const leverFetch = async () => ({
      ok: true,
      status: 200,
      headers: new Headers({
        'content-type': 'application/json',
        'content-length': String(new TextEncoder().encode(leverData).byteLength)
      }),
      body: new ReadableStream({
        start(c) {
          c.enqueue(new TextEncoder().encode(leverData));
          c.close();
        }
      })
    } as any);
    const leverResult = await scrapeLeverApi(
      { id: 'lv-valid', name: 'Lever Acme', url: 'https://jobs.lever.co/acme' },
      {},
      leverFetch
    );
    assert.strictEqual(leverResult?.status, 'success');
    assert.strictEqual(leverResult?.jobs.length, 1);
    assert.strictEqual(leverResult?.jobs[0].title, 'Senior Infrastructure Engineer');

    // SmartRecruiters
    const srData = JSON.stringify({
      content: [
        { id: 'sr-11', name: 'Senior Fullstack Engineer', company: { name: 'SRAcme' } }
      ]
    });
    const srFetch = async () => ({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      body: new ReadableStream({
        start(c) {
          c.enqueue(new TextEncoder().encode(srData));
          c.close();
        }
      })
    } as any);
    const srResult = await scrapeRestJobApis(
      { id: 'sr-valid', name: 'SR Acme', url: 'https://careers.smartrecruiters.com/acme' },
      {},
      srFetch
    );
    assert.strictEqual(srResult?.status, 'success');
    assert.strictEqual(srResult?.jobs.length, 1);
    assert.strictEqual(srResult?.jobs[0].title, 'Senior Fullstack Engineer');

    // Ashby
    const ashbyData = JSON.stringify({
      jobs: [
        { id: 'ab-22', title: 'Data Platform Engineer', jobUrl: 'https://jobs.ashbyhq.com/acme/ab-22' }
      ]
    });
    const ashbyFetch = async () => ({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      body: new ReadableStream({
        start(c) {
          c.enqueue(new TextEncoder().encode(ashbyData));
          c.close();
        }
      })
    } as any);
    const ashbyResult = await scrapeRestJobApis(
      { id: 'ab-valid', name: 'Ashby Acme', url: 'https://jobs.ashbyhq.com/acme' },
      {},
      ashbyFetch
    );
    assert.strictEqual(ashbyResult?.status, 'success');
    assert.strictEqual(ashbyResult?.jobs.length, 1);
    assert.strictEqual(ashbyResult?.jobs[0].title, 'Data Platform Engineer');
  });

  await runTest('STEP-8.6-B1 Case 5 [Mocked]: ATS JSON Content-Length exceeding 5MB limit is rejected and stream is cancelled', async () => {
    let atsStreamCancelled = false;
    const stream = new ReadableStream({
      start(c) {
        c.enqueue(new TextEncoder().encode('{"jobs": []}'));
      },
      cancel() {
        atsStreamCancelled = true;
      }
    });
    const mockFetch = async () => ({
      ok: true,
      status: 200,
      headers: new Headers({
        'content-type': 'application/json',
        'content-length': String(6 * 1024 * 1024) // 6 MB > 5 MB
      }),
      body: stream
    } as any);

    const ghRes = await scrapeGreenhouseApi(
      { id: 'gh-over', name: 'GH Big', url: 'https://boards.greenhouse.io/bigco' },
      {},
      mockFetch
    );
    assert.strictEqual(ghRes?.status, 'error');
    assert.strictEqual(ghRes?.failureCategory, 'invalid_response');
    assert.ok(ghRes?.diagnostic?.includes('Content-Length'));
    assert.ok(ghRes?.diagnostic?.includes('exceeds maximum allowed limit'));
    assert.strictEqual(atsStreamCancelled, true, 'ATS response body stream must be cancelled upon Content-Length overflow');
  });

  await runTest('STEP-8.6-B1 Case 6 [Mocked]: Chunked ATS JSON exceeding 5MB without Content-Length is rejected and cancelled immediately', async () => {
    let chunkCancelled = false;
    let chunkIdx = 0;
    const stream = new ReadableStream({
      pull(c) {
        chunkIdx++;
        if (chunkIdx <= 10) { // Keep stream open so cancellation hook fires upon exceeding 5MB limit
          c.enqueue(new Uint8Array(2 * 1024 * 1024));
        } else {
          c.close();
        }
      },
      cancel() {
        chunkCancelled = true;
      }
    });
    const mockFetch = async () => ({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      body: stream
    } as any);

    const leverRes = await scrapeLeverApi(
      { id: 'lv-chunk-over', name: 'Lever Big', url: 'https://jobs.lever.co/bigco' },
      {},
      mockFetch
    );
    assert.strictEqual(leverRes?.status, 'error');
    assert.strictEqual(leverRes?.failureCategory, 'invalid_response');
    assert.ok(leverRes?.diagnostic?.includes('stream exceeded maximum allowed limit'));
    assert.strictEqual(chunkCancelled, true, 'Chunked ATS stream must be cancelled immediately when 5 MB is exceeded');
  });

  await runTest('STEP-8.6-B1 Case 7 [Unit]: Direct reader helper cancels oversized streams and enforces byte limits', async () => {
    let customCancelled = false;
    let cancelReason = '';
    const testStream = new ReadableStream({
      start(c) {
        c.enqueue(new Uint8Array(200));
        c.enqueue(new Uint8Array(200));
      },
      cancel(reason) {
        customCancelled = true;
        cancelReason = String(reason);
      }
    });
    const mockRes = {
      headers: new Headers(),
      body: testStream
    };
    await assert.rejects(
      () => readBoundedResponseText(mockRes, 300, 'CustomStream'),
      (err: any) => {
        assert.strictEqual(err.name, 'MaxPayloadExceededError');
        assert.strictEqual(err.maxBytes, 300);
        assert.strictEqual(err.actualBytes, 400);
        return true;
      }
    );
    assert.strictEqual(customCancelled, true, 'Stream must be cancelled on overflow');
    assert.ok(cancelReason.includes('exceeded limit'), `Cancel reason must mention limit: ${cancelReason}`);
  });

  await runTest('STEP-8.6-B1 Case 8 [Mocked]: Malformed ATS JSON remains an adapter error (failureCategory=json_parse_error) and does not crash', async () => {
    const badJsonFetch = async () => ({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      body: new ReadableStream({
        start(c) {
          c.enqueue(new TextEncoder().encode('<invalid><xml>not json</xml></invalid>'));
          c.close();
        }
      })
    } as any);
    const srRes = await scrapeRestJobApis(
      { id: 'sr-malformed', name: 'SR Malformed', url: 'https://careers.smartrecruiters.com/malformed' },
      {},
      badJsonFetch
    );
    assert.strictEqual(srRes?.status, 'error');
    assert.strictEqual(srRes?.failureCategory, 'json_parse_error');
    assert.ok(srRes?.diagnostic?.includes('SmartRecruiters'));
    assert.ok(srRes?.diagnostic?.includes('failure=json_parse_error'));
  });

  await runTest('STEP-8.6-B1 Case 9 [Mocked]: Valid empty ATS arrays remain valid empty results and do not invoke error or fallback', async () => {
    const emptyGhFetch = async () => ({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      body: new ReadableStream({
        start(c) {
          c.enqueue(new TextEncoder().encode(JSON.stringify({ jobs: [] })));
          c.close();
        }
      })
    } as any);
    const ghEmpty = await scrapeGreenhouseApi(
      { id: 'gh-empty', name: 'GH Empty', url: 'https://boards.greenhouse.io/emptyco' },
      {},
      emptyGhFetch
    );
    assert.strictEqual(ghEmpty?.status, 'empty');
    assert.strictEqual(ghEmpty?.jobs.length, 0);
    assert.strictEqual(ghEmpty?.failureCategory, undefined);

    const emptyLeverFetch = async () => ({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      body: new ReadableStream({
        start(c) {
          c.enqueue(new TextEncoder().encode('[]'));
          c.close();
        }
      })
    } as any);
    const leverEmpty = await scrapeLeverApi(
      { id: 'lv-empty', name: 'Lever Empty', url: 'https://jobs.lever.co/emptyco' },
      {},
      emptyLeverFetch
    );
    assert.strictEqual(leverEmpty?.status, 'empty');
    assert.strictEqual(leverEmpty?.jobs.length, 0);
    assert.strictEqual(leverEmpty?.failureCategory, undefined);

    // Full portal scrape with valid empty ATS must resolve to empty array [] without error
    const portalEmpty = await scrapeTargetPortal(
      { id: 'gh-empty-portal', name: 'GH Empty Portal', url: 'https://boards.greenhouse.io/emptyco' },
      {},
      emptyGhFetch
    );
    assert.deepStrictEqual(portalEmpty, [], 'Valid empty ATS API response must resolve to []');
  });

  await runTest('STEP-8.6-B1 Case 10 [Mocked]: Existing HTML fallback after ATS size-limit failure recovers jobs from HTML or surfaces ATS error if HTML yields 0', async () => {
    // 1. HTML fallback recovers jobs when ATS is oversized (> 5 MB) and portal HTML has jobs
    const fallbackSuccessFetch = async (url: string) => {
      if (url.includes('boards-api.greenhouse.io')) {
        return {
          ok: true,
          status: 200,
          headers: new Headers({
            'content-type': 'application/json',
            'content-length': String(10 * 1024 * 1024) // 10 MB > 5 MB
          }),
          body: new ReadableStream({
            start(c) { c.enqueue(new TextEncoder().encode('{"jobs": []}')); }
          })
        } as any;
      }
      return {
        ok: true,
        status: 200,
        url,
        headers: new Headers({ 'content-type': 'text/html' }),
        body: new ReadableStream({
          start(c) {
            c.enqueue(new TextEncoder().encode(`
              <html><body>
                <div class="job-card">
                  <h2 class="job-title"><a href="/jobs/501">Senior DevOps Specialist</a></h2>
                  <span class="location">Karachi, Pakistan</span>
                </div>
              </body></html>
            `));
            c.close();
          }
        })
      } as any;
    };

    const recoveredJobs = await scrapeTargetPortal(
      { id: 'gh-recover', name: 'GH Recovery', url: 'https://boards.greenhouse.io/recoveryco' },
      {},
      fallbackSuccessFetch
    );
    assert.strictEqual(recoveredJobs.length, 1, 'HTML fallback must recover jobs even after ATS size-limit error');
    assert.strictEqual(recoveredJobs[0].title, 'Senior DevOps Specialist');

    // 2. When HTML fallback contains 0 jobs, the ATS size-limit error must be thrown (not silently [])
    const emptyHtmlFallbackFetch = async (url: string) => {
      if (url.includes('boards-api.greenhouse.io')) {
        return {
          ok: true,
          status: 200,
          headers: new Headers({
            'content-type': 'application/json',
            'content-length': String(10 * 1024 * 1024)
          }),
          body: new ReadableStream({
            start(c) { c.enqueue(new TextEncoder().encode('{}')); }
          })
        } as any;
      }
      return {
        ok: true,
        status: 200,
        url,
        headers: new Headers({ 'content-type': 'text/html' }),
        body: new ReadableStream({
          start(c) {
            c.enqueue(new TextEncoder().encode('<html><body><div>No jobs on page</div></body></html>'));
            c.close();
          }
        })
      } as any;
    };

    await assert.rejects(
      () =>
        scrapeTargetPortal(
          { id: 'gh-recover-fail', name: 'GH Recovery Fail', url: 'https://boards.greenhouse.io/recoveryfail' },
          {},
          emptyHtmlFallbackFetch
        ),
      /Greenhouse Adapter.*Content-Length.*exceeds/i
    );
  });

  // ============================================================================
  // STEP-8.6-B2: Special-Purpose IP Protection, HTTPS->HTTP Downgrade & Cleanup
  // ============================================================================

  await runTest('STEP-8.6-B2 Case 1 [Unit]: IPv4 special-purpose ranges 192.0.0.0/24 and 192.88.99.0/24 blocked while preserving 192.0.0.9 and 192.0.0.10', () => {
    // Non-globally-reachable entries in 192.0.0.0/24
    for (const ip of ['192.0.0.0', '192.0.0.1', '192.0.0.8', '192.0.0.11', '192.0.0.170', '192.0.0.255']) {
      const check = isPrivateOrBlockedIp(ip);
      assert.strictEqual(check.blocked, true, `Expected ${ip} in 192.0.0.0/24 to be blocked`);
      assert.strictEqual(validateSafeScrapeUrl(`https://${ip}/jobs`).safe, false);
      // Verify IPv4-mapped IPv6 form also enforces the same rule
      const mapped = isPrivateOrBlockedIp(`::ffff:${ip}`);
      assert.strictEqual(mapped.blocked, true, `Expected ::ffff:${ip} to be blocked`);
    }

    // Globally reachable exceptions 192.0.0.9 and 192.0.0.10
    for (const allowedIp of ['192.0.0.9', '192.0.0.10']) {
      const check = isPrivateOrBlockedIp(allowedIp);
      assert.strictEqual(check.blocked, false, `Expected globally reachable exception ${allowedIp} to remain allowed`);
      assert.strictEqual(validateSafeScrapeUrl(`https://${allowedIp}/jobs`).safe, true);
      assert.strictEqual(isPrivateOrBlockedIp(`::ffff:${allowedIp}`).blocked, false);
    }

    // Deprecated 192.88.99.0/24 (6to4 relay anycast)
    for (const ip of ['192.88.99.0', '192.88.99.1', '192.88.99.255']) {
      const check = isPrivateOrBlockedIp(ip);
      assert.strictEqual(check.blocked, true, `Expected deprecated 6to4 relay ${ip} to be blocked`);
      assert.strictEqual(validateSafeScrapeUrl(`http://${ip}/jobs`).safe, false);
    }
  });

  await runTest('STEP-8.6-B2 Case 2 [Unit]: IPv6 special-purpose prefixes (64:ff9b:1::/48, 100:0:0:1::/64, 3fff::/20, 5f00::/16, 2001::/23), 2000::/3 gate, and globally reachable exceptions', () => {
    // Missing special-purpose IPv6 ranges must be blocked
    const blockedIpv6s = [
      '64:ff9b:1::1',
      '64:ff9b:1::c0a8:101',
      '100:0:0:1::1',
      '3fff::1',
      '3fff:0fff:ffff::1',
      '5f00::1',
      '5f00:abcd::1',
      // Non-globally-reachable 2001::/23 portions
      '2001:1::4',
      '2001:1:1::1',
      '2001:4:113::1',
      '2001:5::1',
      '2001:1ff:ffff::1',
      // Non-global-unicast outside 2000::/3
      '4000::1',
      '8000::1',
      'fe00::1',
      // Existing protections preserved
      '::ffff:127.0.0.1',
      '::ffff:7f00:1',
      '2002:0a00:0001::1',
      '2001:0000:4136:e378:8000:63bf:3fff:fdd2',
      '64:ff9b::a00:1',
      '::8.8.8.8',
      'fc00::1',
      'fe80::1',
      'ff02::1',
      'fec0::1'
    ];
    for (const ip of blockedIpv6s) {
      const res = isPrivateOrBlockedIp(ip);
      assert.strictEqual(res.blocked, true, `Expected IPv6 ${ip} to be blocked`);
      assert.strictEqual(validateSafeScrapeUrl(`https://[${ip}]/jobs`).safe, false);
    }

    // Globally reachable IPv6 exceptions MUST be preserved
    const allowedIpv6s = [
      '2001:1::1',
      '2001:1::2',
      '2001:1::3',
      '2001:3::1',
      '2001:3:ffff::1',
      '2001:4:112::1',
      '2001:20::1',
      '2001:2f:ffff::1',
      '2001:30::1',
      '2001:3f:ffff::1',
      // Public IPv4-mapped & ordinary 2000::/3 global unicast
      '::ffff:8.8.8.8',
      '::ffff:808:808',
      '2607:f8b0:4005:805::200e',
      '2001:4860:4860::8888',
      '2a00:1450:4009:81f::200e',
      '3fff:1000::1' // Outside 3fff::/20 and inside 2000::/3
    ];
    for (const ip of allowedIpv6s) {
      const res = isPrivateOrBlockedIp(ip);
      assert.strictEqual(res.blocked, false, `Expected globally reachable IPv6 ${ip} to remain allowed (got blocked: ${res.reason})`);
      assert.strictEqual(validateSafeScrapeUrl(`https://[${ip}]/jobs`).safe, true);
    }
  });

  await runTest('STEP-8.6-B2 Case 3 [Unit]: HTTPS-to-HTTP redirect downgrade is rejected, cancels intermediate body, never issues HTTP request, while preserving HTTP->HTTPS upgrade', async () => {
    const originalFetch = globalThis.fetch;
    const requestedUrls: string[] = [];
    let downgradeRedirectBodyCancelled = false;
    let upgradeRedirectBodyCancelled = false;

    try {
      // 1. HTTPS -> HTTP downgrade must be rejected BEFORE making a second request
      globalThis.fetch = (async (input: any) => {
        const url = String(input);
        requestedUrls.push(url);
        return {
          status: 302,
          ok: false,
          headers: new Headers({ location: 'http://[2607:f8b0:4005:805::200e]/downgraded' }),
          bodyUsed: false,
          body: {
            cancel: async () => {
              downgradeRedirectBodyCancelled = true;
            }
          }
        } as any;
      }) as any;

      await assert.rejects(
        () => safeFetchWithRetry('https://[2607:f8b0:4005:805::200e]/secure-start', {}, 5000, 1),
        /SSRF Blocked: HTTPS-to-HTTP redirect downgrade rejected/
      );

      assert.strictEqual(requestedUrls.length, 1, 'Downgraded HTTP second request MUST NOT be made (nor retried)');
      assert.strictEqual(downgradeRedirectBodyCancelled, true, 'Intermediate HTTPS->HTTP redirect response body must be cancelled');

      // 2. HTTP -> HTTPS upgrade must remain permitted
      requestedUrls.length = 0;
      globalThis.fetch = (async (input: any) => {
        const url = String(input);
        requestedUrls.push(url);
        if (url.startsWith('http://')) {
          return {
            status: 301,
            ok: false,
            headers: new Headers({ location: 'https://[2607:f8b0:4005:805::200e]/upgraded' }),
            bodyUsed: false,
            body: {
              cancel: async () => {
                upgradeRedirectBodyCancelled = true;
              }
            }
          } as any;
        }
        return new Response('<html><body>Upgraded OK</body></html>', { status: 200 });
      }) as any;

      const upgradedRes = await safeFetchWithRetry('http://[2607:f8b0:4005:805::200e]/upgrade-start', {}, 5000, 1);
      assert.strictEqual(upgradedRes.status, 200);
      assert.strictEqual(requestedUrls.length, 2, 'HTTP->HTTPS redirect must follow second request cleanly');
      assert.strictEqual(requestedUrls[1].startsWith('https://'), true);
      assert.strictEqual(upgradeRedirectBodyCancelled, true, 'Intermediate HTTP->HTTPS redirect body must be cancelled');
      assert.strictEqual(await upgradedRes.text(), '<html><body>Upgraded OK</body></html>');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  await runTest('STEP-8.6-B2 Case 4 [Unit]: Non-2xx response bodies are cancelled in HTML, ATS, and PDF paths without masking HTTP errors', async () => {
    // 1. Main HTML fetch non-2xx cancels unused body even if body.cancel throws
    let htmlCancelAttempted = false;
    const htmlNonOkFetch = async () => ({
      ok: false,
      status: 503,
      bodyUsed: false,
      body: {
        cancel: async () => {
          htmlCancelAttempted = true;
          throw new Error('cancel hook noise must not mask HTTP 503');
        }
      }
    } as any);

    await assert.rejects(
      () => scrapeTargetPortal({ id: 'non2xx-html', name: 'Down HTML', url: 'https://example.com/jobs' }, {}, htmlNonOkFetch),
      (err: any) => err?.status === 503 && /HTTP 503/.test(err.message)
    );
    assert.strictEqual(htmlCancelAttempted, true, 'Main HTML non-2xx body must be cancelled');

    // 2. ATS adapter fetch non-2xx cancels unused body and preserves http_error classification
    let atsCancelAttempted = false;
    const atsNonOkFetch = async () => ({
      ok: false,
      status: 502,
      bodyUsed: false,
      body: {
        cancel: async () => {
          atsCancelAttempted = true;
          throw new Error('ats cancel noise');
        }
      }
    } as any);

    const atsRes = await scrapeGreenhouseApi(
      { id: 'non2xx-ats', name: 'Down ATS', url: 'https://boards.greenhouse.io/downco' },
      {},
      atsNonOkFetch
    );
    assert.strictEqual(atsCancelAttempted, true, 'ATS non-2xx body must be cancelled');
    assert.strictEqual(atsRes?.status, 'error');
    assert.strictEqual(atsRes?.failureCategory, 'http_error');
    assert.strictEqual(atsRes?.httpStatus, 502);

    // 3. PDF fetch non-2xx cancels unused body and preserves HTTP_ERROR diagnostic
    const originalFetch = globalThis.fetch;
    let pdfCancelAttempted = false;
    try {
      globalThis.fetch = (async () => ({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: new Headers(),
        bodyUsed: false,
        body: {
          cancel: async () => {
            pdfCancelAttempted = true;
            throw new Error('pdf cancel noise');
          }
        }
      })) as any;

      const pdfRes = await parsePdfFromUrl('https://[2607:f8b0:4005:805::200e]/missing.pdf', 'Missing Dept');
      assert.strictEqual(pdfCancelAttempted, true, 'PDF non-2xx body must be cancelled');
      assert.strictEqual(pdfRes.success, false);
      assert.strictEqual(pdfRes.diagnosticCode, 'HTTP_ERROR');
      assert.ok(pdfRes.message?.includes('404'));
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  await runTest('STEP-8.6-B2 Case 5 [Unit]: Stream reader locks released in finally and streams cancelled once on read errors and overflow across HTML, PDF, and Detail Enricher', async () => {
    const makeTrackedStream = (mode: 'success' | 'error' | 'overflow', chunkBytes = 100) => {
      let lockActive = false;
      let releaseCount = 0;
      let cancelCount = 0;
      let reads = 0;
      return {
        get stats() {
          return { lockActive, releaseCount, cancelCount };
        },
        stream: {
          getReader() {
            lockActive = true;
            return {
              async read() {
                reads++;
                if (mode === 'error') {
                  throw new Error('Simulated TCP reset mid-stream');
                }
                if (mode === 'success') {
                  if (reads === 1) return { done: false, value: new TextEncoder().encode('<html><body><p>OK</p></body></html>') };
                  return { done: true, value: undefined };
                }
                // overflow mode: yield chunks indefinitely until cancelled
                return { done: false, value: new Uint8Array(chunkBytes) };
              },
              async cancel() {
                cancelCount++;
              },
              releaseLock() {
                releaseCount++;
                lockActive = false;
              }
            };
          }
        }
      };
    };

    // A. readBoundedResponseText (scraperService.ts)
    const okHtmlTracker = makeTrackedStream('success');
    const okText = await readBoundedResponseText({ headers: new Headers(), body: okHtmlTracker.stream }, 1024, 'OK');
    assert.ok(okText.includes('<p>OK</p>'));
    assert.strictEqual(okHtmlTracker.stats.lockActive, false, 'HTML reader lock must be released on success');
    assert.strictEqual(okHtmlTracker.stats.releaseCount, 1);
    assert.strictEqual(okHtmlTracker.stats.cancelCount, 0);

    const errHtmlTracker = makeTrackedStream('error');
    await assert.rejects(
      () => readBoundedResponseText({ headers: new Headers(), body: errHtmlTracker.stream }, 1024, 'ErrStream'),
      /Simulated TCP reset mid-stream/
    );
    assert.strictEqual(errHtmlTracker.stats.lockActive, false, 'HTML reader lock must be released on read error');
    assert.strictEqual(errHtmlTracker.stats.releaseCount, 1);
    assert.strictEqual(errHtmlTracker.stats.cancelCount, 1, 'HTML stream must be cancelled exactly once on read error');

    const overHtmlTracker = makeTrackedStream('overflow', 600);
    await assert.rejects(
      () => readBoundedResponseText({ headers: new Headers(), body: overHtmlTracker.stream }, 1000, 'OverStream'),
      /exceeded maximum allowed limit/
    );
    assert.strictEqual(overHtmlTracker.stats.lockActive, false, 'HTML reader lock must be released on overflow');
    assert.strictEqual(overHtmlTracker.stats.releaseCount, 1);
    assert.strictEqual(overHtmlTracker.stats.cancelCount, 1, 'HTML stream must be cancelled exactly once on overflow');

    // B. readBoundedHtmlResponse + enrichJobFromDetailPage (detailPageEnricher.ts)
    const okDetailTracker = makeTrackedStream('success');
    const detailOkRes = await readBoundedHtmlResponse({ headers: new Headers(), body: okDetailTracker.stream } as any, MAX_DETAIL_HTML_BYTES);
    assert.ok(detailOkRes.html?.includes('<p>OK</p>'));
    assert.strictEqual(okDetailTracker.stats.lockActive, false, 'Detail reader lock must be released on success');
    assert.strictEqual(okDetailTracker.stats.releaseCount, 1);

    const errDetailTracker = makeTrackedStream('error');
    const baseJob: any = {
      id: 'job-det-1',
      title: 'Existing Listing Title',
      company: 'Existing Co',
      sourceUrl: 'https://portal.gov.pk/jobs/555',
      description: 'Original listing description preserved'
    };
    const errDetailJob = await enrichJobFromDetailPage(
      baseJob,
      { id: 'p1', name: 'Portal', url: 'https://portal.gov.pk/list' },
      async () => ({
        ok: true,
        status: 200,
        url: 'https://portal.gov.pk/jobs/555',
        headers: new Headers({ 'content-type': 'text/html' }),
        body: errDetailTracker.stream
      } as any)
    );
    assert.strictEqual(errDetailJob.title, 'Existing Listing Title', 'Detail read failure must preserve original listing');
    assert.strictEqual(errDetailTracker.stats.lockActive, false, 'Detail reader lock must be released on read error');
    assert.strictEqual(errDetailTracker.stats.releaseCount, 1);
    assert.strictEqual(errDetailTracker.stats.cancelCount, 1, 'Detail stream must be cancelled once on read error');

    const overDetailTracker = makeTrackedStream('overflow', 1024 * 1024);
    const overDetailRes = await readBoundedHtmlResponse({ headers: new Headers(), body: overDetailTracker.stream } as any, MAX_DETAIL_HTML_BYTES);
    assert.strictEqual(overDetailRes.oversized, true);
    assert.strictEqual(overDetailTracker.stats.lockActive, false, 'Detail reader lock must be released on overflow');
    assert.strictEqual(overDetailTracker.stats.cancelCount, 1, 'Detail stream must be cancelled once on overflow');

    // C. parsePdfFromUrl (pdfParserEngine.ts)
    const originalFetch = globalThis.fetch;
    try {
      const errPdfTracker = makeTrackedStream('error');
      globalThis.fetch = (async () => ({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/pdf' }),
        body: errPdfTracker.stream
      })) as any;

      const errPdfResult = await parsePdfFromUrl('https://[2607:f8b0:4005:805::200e]/broken.pdf', 'Dept');
      assert.strictEqual(errPdfResult.success, false);
      assert.strictEqual(errPdfResult.diagnosticCode, 'NETWORK_ERROR');
      assert.strictEqual(errPdfTracker.stats.lockActive, false, 'PDF reader lock must be released on read error');
      assert.strictEqual(errPdfTracker.stats.releaseCount, 1);
      assert.strictEqual(errPdfTracker.stats.cancelCount, 1, 'PDF stream must be cancelled once on read error');

      const overPdfTracker = makeTrackedStream('overflow', 6 * 1024 * 1024);
      globalThis.fetch = (async () => ({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/pdf' }),
        body: overPdfTracker.stream
      })) as any;

      const overPdfResult = await parsePdfFromUrl('https://[2607:f8b0:4005:805::200e]/huge.pdf', 'Dept');
      assert.strictEqual(overPdfResult.success, false);
      assert.strictEqual(overPdfResult.diagnosticCode, 'OVERSIZED_DOCUMENT');
      assert.strictEqual(overPdfTracker.stats.lockActive, false, 'PDF reader lock must be released on overflow');
      assert.strictEqual(overPdfTracker.stats.releaseCount, 1);
      assert.strictEqual(overPdfTracker.stats.cancelCount, 1, 'PDF stream must be cancelled once on overflow');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  await runTest('STEP-8.6-B2 Case 6 [Unit]: Existing Undici dispatcher timeouts, safeFetchWithRetry timeout expiry, and scraperEngine skip-to-next-source behavior remain unchanged', async () => {
    // 1. Verify existing Undici dispatcher configuration (15000ms idle timeouts) and size constants remain untouched
    assert.strictEqual(MAX_PORTAL_HTML_BYTES, 8 * 1024 * 1024);
    assert.strictEqual(MAX_ATS_JSON_BYTES, 5 * 1024 * 1024);
    assert.strictEqual(MAX_DETAIL_HTML_BYTES, 2 * 1024 * 1024);
    assert.ok(scraperTlsDispatcher instanceof Agent, 'scraperTlsDispatcher must remain an Undici Agent');

    // 2. Verify existing safeFetchWithRetry AbortController timeout & maxRetries work cleanly
    const originalFetch = globalThis.fetch;
    let attemptCount = 0;
    try {
      globalThis.fetch = ((_input: any, init: any) =>
        new Promise((_resolve, reject) => {
          attemptCount++;
          init?.signal?.addEventListener('abort', () => {
            const abortErr: any = new Error('The operation was aborted');
            abortErr.name = 'AbortError';
            reject(abortErr);
          }, { once: true });
        })) as any;

      await assert.rejects(
        () => safeFetchWithRetry('https://[2607:f8b0:4005:805::200e]/slow', {}, 40, 1),
        /Connection timed out after 40ms/
      );
      assert.strictEqual(attemptCount, 2, 'Existing maxRetries=1 retry count must execute 2 total attempts before timing out');
    } finally {
      globalThis.fetch = originalFetch;
    }

    // 3. Verify executeScraperWithWizard marks timed-out source as Timeout and moves cleanly to next source
    const recordedStats: Array<{ id: string; stats: any }> = [];
    const persistedJobs: any[] = [];
    const summary = await executeScraperWithWizard(
      { mode: 'complete', duplicateMode: 'without', sourceIds: ['src-timeout-1', 'src-healthy-2'] },
      {
        getConfigsFn: async () => [
          { id: 'src-timeout-1', name: 'Slow Source', url: 'https://slow.example.pk/jobs', status: 'Active Scheduled' },
          { id: 'src-healthy-2', name: 'Healthy Source', url: 'https://fast.example.pk/jobs', status: 'Active Scheduled' }
        ],
        updateSourceStatsFn: async (id: string, stats: any) => {
          recordedStats.push({ id, stats });
        },
        addRunFn: async () => ({ persistence: 'memory' }),
        scrapePageFn: async (config: any) => {
          if (config.id === 'src-timeout-1') {
            throw new Error(`Remote portal unavailable: ${config.url} (Connection timed out after 10000ms)`);
          }
          return [
            {
              id: 'healthy-job-1',
              title: 'Civil Engineer',
              company: 'Fast Authority',
              jobType: 'On-site',
              region: 'Pakistan',
              salary: 'Market Competitive',
              currency: 'PKR',
              experienceLevel: 'Mid',
              department: 'Engineering',
              tags: ['Engineering'],
              description: 'Civil engineering vacancy on healthy portal',
              requirements: [],
              benefits: [],
              postedAt: 'Today',
              applicationsCount: 0,
              status: 'Pending',
              sourceUrl: 'https://fast.example.pk/jobs/1',
              extractionMethod: 'html_cheerio'
            } as any
          ];
        },
        enrichJobsFn: async (jobs: any[]) => jobs,
        findDuplicateCandidatesFn: async () => [],
        createJobFn: async (job: any) => {
          persistedJobs.push(job);
          return job;
        },
        addPendingJobFn: async (job: any) => {
          persistedJobs.push(job);
          return job;
        },
        auditAddFn: async () => {}
      }
    );

    assert.strictEqual(summary.sourcesStats.length, 2, 'Scraper must process both sources without aborting on first timeout');
    assert.strictEqual(summary.sourcesStats[0].sourceId, 'src-timeout-1');
    assert.strictEqual(summary.sourcesStats[0].failed, true);
    assert.strictEqual(summary.sourcesStats[1].sourceId, 'src-healthy-2');
    assert.strictEqual(summary.sourcesStats[1].failed, false);
    assert.strictEqual(persistedJobs.length, 1, 'Healthy next source job must be persisted after previous source timed out');

    const timeoutFinalStat = recordedStats.filter(s => s.id === 'src-timeout-1').pop();
    assert.strictEqual(timeoutFinalStat?.stats?.healthStatus, 'Timeout', 'Timed-out source must retain Timeout healthStatus');
  });

  await runTest('STEP-8.6-B3 Case 1 [Unit]: Initial DNS preflight timeout stops waiting, issues zero HTTP fetches, preserves retries and late-completion safety', async () => {
    const originalLookup = dns.promises.lookup;
    const originalFetch = globalThis.fetch;
    const unhandledRejections: any[] = [];
    const onUnhandled = (reason: any) => unhandledRejections.push(reason);
    process.on('unhandledRejection', onUnhandled);

    let dnsCalls = 0;
    let fetchCalls = 0;
    const deferredSettlements: Array<{ resolve: (v: any) => void; reject: (e: any) => void }> = [];

    try {
      (dns.promises as any).lookup = () => {
        dnsCalls++;
        return new Promise((resolve, reject) => {
          deferredSettlements.push({ resolve, reject });
        });
      };

      globalThis.fetch = (async () => {
        fetchCalls++;
        return new Response('should never be called', { status: 200 });
      }) as any;

      const startedAt = Date.now();
      await assert.rejects(
        () => safeFetchWithRetry('https://hanging-dns.example.pk/jobs', {}, 35, 1),
        /Remote portal unavailable: https:\/\/hanging-dns\.example\.pk\/jobs \(Connection timed out after 35ms\)/
      );
      const elapsedMs = Date.now() - startedAt;

      assert.strictEqual(dnsCalls, 2, 'Initial DNS preflight timeout must honor existing maxRetries=1 retry count (2 total attempts)');
      assert.strictEqual(fetchCalls, 0, 'No HTTP fetch must occur when DNS preflight times out');
      assert.ok(elapsedMs < 3000, `Expected prompt timeout without hanging indefinitely (elapsed=${elapsedMs}ms)`);

      // Trigger late completion (both resolve to private IP and rejection) after timeout expired
      assert.strictEqual(deferredSettlements.length, 2);
      deferredSettlements[0].resolve([{ address: '93.184.216.34', family: 4 }]);
      const lateErr: any = new Error('Late EAI_AGAIN after abort');
      lateErr.code = 'EAI_AGAIN';
      deferredSettlements[1].reject(lateErr);

      await new Promise(r => setTimeout(r, 25));
      assert.strictEqual(fetchCalls, 0, 'Late DNS completion must never trigger an HTTP fetch');
      assert.strictEqual(unhandledRejections.length, 0, 'Late DNS completion/rejection must never trigger unhandledRejection');

      // Also verify recovery on retry attempt 2 when attempt 1 DNS timed out and attempt 2 resolves quickly
      dnsCalls = 0;
      fetchCalls = 0;
      let attempt1Resolve: ((v: any) => void) | null = null;
      (dns.promises as any).lookup = () => {
        dnsCalls++;
        if (dnsCalls === 1) {
          return new Promise((resolve) => {
            attempt1Resolve = resolve;
          });
        }
        return Promise.resolve([{ address: '93.184.216.34', family: 4 }]);
      };
      globalThis.fetch = (async () => {
        fetchCalls++;
        return new Response('<html>Recovered on attempt 2</html>', { status: 200 });
      }) as any;

      const recoveredRes = await safeFetchWithRetry('https://flaky-dns.example.pk/jobs', {}, 35, 1);
      assert.strictEqual(recoveredRes.status, 200);
      assert.strictEqual(dnsCalls, 2);
      assert.strictEqual(fetchCalls, 1, 'Only non-timed-out retry attempt should issue HTTP fetch');

      // Resolving the stale attempt-1 lookup later must not trigger extra fetches
      attempt1Resolve?.([{ address: '127.0.0.1', family: 4 }]);
      await new Promise(r => setTimeout(r, 20));
      assert.strictEqual(fetchCalls, 1);
      assert.strictEqual(unhandledRejections.length, 0);
    } finally {
      process.off('unhandledRejection', onUnhandled);
      (dns.promises as any).lookup = originalLookup;
      globalThis.fetch = originalFetch;
    }
  });

  await runTest('STEP-8.6-B3 Case 2 [Unit]: Redirect DNS timeout prevents redirected request, cancels 302 body, and blocked DNS remains fail-closed', async () => {
    const originalLookup = dns.promises.lookup;
    const originalFetch = globalThis.fetch;
    const requestedUrls: string[] = [];
    let redirectBodyCancelled = false;
    let lateRedirectResolve: ((v: any) => void) | null = null;
    const unhandledRejections: any[] = [];
    const onUnhandled = (reason: any) => unhandledRejections.push(reason);
    process.on('unhandledRejection', onUnhandled);

    try {
      // 1. Redirect target DNS times out while initial hop succeeded
      (dns.promises as any).lookup = (hostname: string) => {
        if (hostname === 'start-ok.example.pk') {
          return Promise.resolve([{ address: '93.184.216.34', family: 4 }]);
        }
        return new Promise((resolve) => {
          lateRedirectResolve = resolve;
        });
      };

      globalThis.fetch = (async (input: any) => {
        const u = String(input);
        requestedUrls.push(u);
        return {
          status: 302,
          ok: false,
          headers: new Headers({ location: 'https://slow-redirect-dns.example.pk/target' }),
          bodyUsed: false,
          body: {
            cancel: async () => {
              redirectBodyCancelled = true;
            }
          }
        } as any;
      }) as any;

      await assert.rejects(
        () => safeFetchWithRetry('https://start-ok.example.pk/jobs', {}, 40, 0),
        /Connection timed out after 40ms/
      );
      assert.deepStrictEqual(requestedUrls, ['https://start-ok.example.pk/jobs'], 'Redirected URL must NEVER be fetched when redirect DNS times out');
      assert.strictEqual(redirectBodyCancelled, true, 'Intermediate 302 body must be cancelled even when redirect DNS times out');

      lateRedirectResolve?.([{ address: '93.184.216.34', family: 4 }]);
      await new Promise(r => setTimeout(r, 20));
      assert.strictEqual(requestedUrls.length, 1, 'Late redirect DNS completion must not trigger redirected fetch');
      assert.strictEqual(unhandledRejections.length, 0);

      // 2. Existing SSRF blocked-address DNS resolution remains fail-closed (no retries, no fetch)
      requestedUrls.length = 0;
      let blockedDnsLookups = 0;
      (dns.promises as any).lookup = () => {
        blockedDnsLookups++;
        return Promise.resolve([{ address: '169.254.169.254', family: 4 }]);
      };
      await assert.rejects(
        () => safeFetchWithRetry('https://metadata-alias.example.pk/secret', {}, 500, 1),
        /SSRF Blocked:.*169\.254\.169\.254/
      );
      assert.strictEqual(blockedDnsLookups, 1, 'SSRF Blocked DNS failure must fail closed immediately without retry');
      assert.strictEqual(requestedUrls.length, 0);

      // 3. Direct resolveAndValidateDns() cleans up AbortSignal listener on normal completion and abort
      const controller = new AbortController();
      let activeAbortListeners = 0;
      const origAdd = controller.signal.addEventListener.bind(controller.signal);
      const origRem = controller.signal.removeEventListener.bind(controller.signal);
      controller.signal.addEventListener = (t: string, l: any, o: any) => {
        if (t === 'abort') activeAbortListeners++;
        return origAdd(t, l, o);
      };
      controller.signal.removeEventListener = (t: string, l: any, o: any) => {
        if (t === 'abort') activeAbortListeners--;
        return origRem(t, l, o);
      };

      (dns.promises as any).lookup = () => Promise.resolve([{ address: '93.184.216.34', family: 4 }]);
      const okDns = await resolveAndValidateDns(new URL('https://public-ok.example.pk/jobs'), controller.signal);
      assert.strictEqual(okDns.safe, true);
      assert.strictEqual(activeAbortListeners, 0, 'Abort listener must be removed after fast DNS success');
    } finally {
      process.off('unhandledRejection', onUnhandled);
      (dns.promises as any).lookup = originalLookup;
      globalThis.fetch = originalFetch;
    }
  });

  await runTest('STEP-8.6-B3 Case 3 [Unit]: Existing call-site timeout durations (10s HTML/Detail, 15s ATS/PDF/Undici) remain unchanged', () => {
    const ssrfSource = fs.readFileSync(path.join(process.cwd(), 'server', 'utils', 'ssrfProtection.ts'), 'utf8');
    const scraperServiceSource = fs.readFileSync(path.join(process.cwd(), 'src', 'services', 'scraperService.ts'), 'utf8');
    const pdfSource = fs.readFileSync(path.join(process.cwd(), 'server', 'services', 'pdfParserEngine.ts'), 'utf8');
    const detailSource = fs.readFileSync(path.join(process.cwd(), 'server', 'services', 'detailPageEnricher.ts'), 'utf8');
    const engineSource = fs.readFileSync(path.join(process.cwd(), 'server', 'services', 'scraperEngine.ts'), 'utf8');

    assert.ok(ssrfSource.includes('headersTimeout: 15000'));
    assert.ok(ssrfSource.includes('bodyTimeout: 15000'));
    assert.ok(ssrfSource.includes('timeoutMs: number = 10000'));
    assert.ok(ssrfSource.includes('maxRetries: number = 1'));
    assert.ok(/10000\s*,\s*1/.test(scraperServiceSource));
    assert.ok(/15000/.test(scraperServiceSource));
    assert.ok(/15000\s*,\s*1/.test(pdfSource));
    assert.ok(/10000\s*,\s*1/.test(detailSource));
    assert.ok(!engineSource.includes('30000') && !engineSource.includes('60000'), 'No 30s/60s source deadline should exist in scraperEngine.ts');
  });

  await runTest('STEP-8.6-B3 Case 4 [Unit]: PDFParse.destroy() runs once on success, runs after getText() throws, never discards extracted text on destroy failure, and preserves OCR fallback', async () => {
    const originalFetch = globalThis.fetch;
    const origGetText = PDFParse.prototype.getText;
    const origGetTable = PDFParse.prototype.getTable;
    const origDestroy = PDFParse.prototype.destroy;
    const savedGeminiKey = process.env.GEMINI_API_KEY;

    const fakePdfBytes = Buffer.from('%PDF-1.4\n%Mock binary PDF header\n');
    const mockPdfFetch = () => {
      globalThis.fetch = (async () =>
        new Response(fakePdfBytes, {
          status: 200,
          headers: { 'content-type': 'application/pdf' }
        })) as any;
    };

    try {
      delete process.env.GEMINI_API_KEY;
      mockPdfFetch();

      // 1. destroy() executes exactly once after successful extraction
      let destroyCount = 0;
      const sampleVacancyText =
        'Case No. F4-101/2026\nAssistant Director (BPS-17)\nQualification: Master Degree in Computer Science\nNo. of Vacancies: 3\nClosing Date: 30-11-2026';

      PDFParse.prototype.getText = (async () => ({ text: sampleVacancyText, total: 2 })) as any;
      PDFParse.prototype.getTable = (async () => ({ pages: [] })) as any;
      PDFParse.prototype.destroy = (async () => {
        destroyCount++;
      }) as any;

      const okResult = await parsePdfFromUrl('https://[2607:f8b0:4005:805::200e]/vacancies.pdf', 'FPSC');
      assert.strictEqual(okResult.success, true);
      assert.strictEqual(okResult.diagnosticCode, 'PDF_TEXT_SUCCESS');
      assert.strictEqual(destroyCount, 1, 'destroy() must execute once after successful PDF extraction');
      assert.ok(okResult.extractedJobs.length >= 1);

      // 2. destroy() executes once even when getText() throws, AND preserves OCR fallback path
      destroyCount = 0;
      PDFParse.prototype.getText = (async () => {
        throw new Error('Corrupt PDF XRef stream');
      }) as any;
      PDFParse.prototype.destroy = (async () => {
        destroyCount++;
      }) as any;

      const failedExtractResult = await parsePdfFromUrl('https://[2607:f8b0:4005:805::200e]/corrupt.pdf', 'FPSC');
      assert.strictEqual(destroyCount, 1, 'destroy() must execute in finally when getText() throws');
      assert.strictEqual(failedExtractResult.diagnosticCode, 'PDF_SCANNED_OCR_KEY_MISSING', 'Actual PDF extraction failure must preserve existing OCR fallback path');

      // 3. destroy() failure does NOT discard successfully extracted text, does NOT mark pdfParseFailed, and does NOT trigger OCR fallback
      destroyCount = 0;
      PDFParse.prototype.getText = (async () => ({ text: sampleVacancyText, total: 1 })) as any;
      PDFParse.prototype.destroy = (async () => {
        destroyCount++;
        throw new Error('Simulated PDF worker cleanup error on destroy()');
      }) as any;

      const destroyErrResult = await parsePdfFromUrl('https://[2607:f8b0:4005:805::200e]/cleanup-err.pdf', 'FPSC');
      assert.strictEqual(destroyCount, 1, 'destroy() must still be called once');
      assert.strictEqual(destroyErrResult.success, true, 'destroy() error must NOT invalidate successful extraction');
      assert.strictEqual(destroyErrResult.diagnosticCode, 'PDF_TEXT_SUCCESS', 'destroy() error must NOT convert extraction to OCR fallback or failure');
      assert.strictEqual(destroyErrResult.formatType, 'pdf');
      assert.ok(destroyErrResult.fullExtractedText?.includes('Assistant Director'));
      assert.ok(destroyErrResult.extractedJobs.length >= 1);

      // 4. Double failure: both getText() and destroy() throw -> still preserves OCR fallback path without crashing on destroy() error
      destroyCount = 0;
      PDFParse.prototype.getText = (async () => {
        throw new Error('Bad PDF object dictionary');
      }) as any;
      PDFParse.prototype.destroy = (async () => {
        destroyCount++;
        throw new Error('Cleanup throw after getText failure');
      }) as any;

      const bothThrowResult = await parsePdfFromUrl('https://[2607:f8b0:4005:805::200e]/both-fail.pdf', 'FPSC');
      assert.strictEqual(destroyCount, 1);
      assert.strictEqual(bothThrowResult.diagnosticCode, 'PDF_SCANNED_OCR_KEY_MISSING', 'destroy() throw after parse failure must not mask extraction failure / OCR fallback');
    } finally {
      PDFParse.prototype.getText = origGetText;
      PDFParse.prototype.getTable = origGetTable;
      PDFParse.prototype.destroy = origDestroy;
      globalThis.fetch = originalFetch;
      if (savedGeminiKey !== undefined) {
        process.env.GEMINI_API_KEY = savedGeminiKey;
      } else {
        delete process.env.GEMINI_API_KEY;
      }
    }
  });

  // ============================================================================
  // MASTER STEP (GROUPS A, B, C): SCRAPER RELIABILITY IMPROVEMENTS
  // ============================================================================

  await runTest('MASTER-STEP Group A Case 1 [Mocked]: Direct image URLs and extensionless image Content-Types route to OCR with media provenance, while unsupported image formats reject cleanly', async () => {
    let parseMediaCalls = 0;
    const mockParseMedia = (async (mediaUrl: string) => {
      parseMediaCalls++;
      return {
        success: true,
        diagnosticCode: 'IMAGE_OCR_SUCCESS',
        formatType: 'image',
        fullExtractedText: 'Advertisement for Data Analyst at Public Sector',
        extractedJobs: [
          {
            title: 'Data Analyst',
            department: 'Planning Board',
            location: 'Islamabad',
            closingDate: '2026-12-15',
            qualifications: ['BS Computer Science'],
            applicationInstructions: 'Apply online',
            sourceUrl: mediaUrl,
            extractionMethod: 'image_ocr'
          }
        ]
      };
    }) as any;

    const jpgJobs = await scrapeTargetPortal(
      {
        id: 'img-src-1',
        name: 'Jang Classified Image',
        url: 'https://[2607:f8b0:4005:805::200e]/ads/career-notice.jpg?v=2',
        keywords: '',
        interval: '24h',
        autoApprove: false,
        status: 'Active Scheduled',
        scrapedCount: 0
      },
      {},
      undefined,
      mockParseMedia
    );

    assert.strictEqual(parseMediaCalls, 1, 'Direct JPG URL must call OCR parser directly');
    assert.strictEqual(jpgJobs.length, 1);
    assert.strictEqual(jpgJobs[0].extractionMethod, 'image_ocr');
    assert.strictEqual(jpgJobs[0].status, 'Pending');
    assert.ok(jpgJobs[0].clippingImageUrl?.includes('career-notice.jpg'));
    assert.ok(jpgJobs[0].mediaUrl?.includes('career-notice.jpg'));

    // Unsupported extension (.gif / .svg) rejected before network/OCR
    await assert.rejects(
      () =>
        scrapeTargetPortal(
          {
            id: 'img-bad-ext',
            name: 'SVG Icon Url',
            url: 'https://[2607:f8b0:4005:805::200e]/logo.svg',
            keywords: '',
            interval: '24h',
            autoApprove: false,
            status: 'Active Scheduled',
            scrapedCount: 0
          },
          {},
          undefined,
          mockParseMedia
        ),
      /Unsupported image/i
    );

    // Extensionless URL returning image/png Content-Type cancels HTML body read and routes to OCR
    const originalFetch = globalThis.fetch;
    let bodyCancelled = false;
    try {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('PNGDATA'));
        },
        cancel() {
          bodyCancelled = true;
        }
      });
      globalThis.fetch = (async () =>
        new Response(stream, {
          status: 200,
          headers: { 'content-type': 'image/png' }
        })) as any;

      const extlessJobs = await scrapeTargetPortal(
        {
          id: 'img-src-extless',
          name: 'Extensionless Image Endpoint',
          url: 'https://[2607:f8b0:4005:805::200e]/notice/download?id=99',
          keywords: '',
          interval: '24h',
          autoApprove: false,
          status: 'Active Scheduled',
          scrapedCount: 0
        },
        {},
        undefined,
        mockParseMedia
      );

      assert.strictEqual(bodyCancelled, true, 'Extensionless image response stream must be cancelled before OCR routing');
      assert.strictEqual(parseMediaCalls, 2);
      assert.strictEqual(extlessJobs.length, 1);
      assert.strictEqual(extlessJobs[0].extractionMethod, 'image_ocr');
    } finally {
      globalThis.fetch = originalFetch;
    }

    // Direct mapper preserves all PDF & image fields in mapScrapedResultToRouteJob
    const directMapped = mapDirectImageOcrJobs(
      [
        {
          title: 'Network Administrator',
          department: 'IT Directorate',
          location: 'Lahore',
          sourceUrl: 'https://example.pk/ad.png',
          domicile: 'Punjab'
        }
      ],
      { name: 'Example Org', autoApprove: true },
      'https://example.pk/ad.png',
      { fullExtractedText: 'OCR sample text' }
    );
    const routeJob = mapScrapedResultToRouteJob({
      ...directMapped[0],
      domicileQuota: 'Punjab',
      isPdfScraped: true,
      pdfFileName: 'Notice.pdf',
      pdfSourceUrl: 'https://example.pk/Notice.pdf?page=1',
      pdfCaseNumber: 'F.4-22/2026',
      pdfParserEngine: 'gemini-vision-ocr'
    });
    assert.strictEqual(routeJob.domicileQuota, 'Punjab');
    assert.strictEqual(routeJob.isPdfScraped, true);
    assert.strictEqual(routeJob.pdfFileName, 'Notice.pdf');
    assert.strictEqual(routeJob.pdfSourceUrl, 'https://example.pk/Notice.pdf?page=1');
    assert.strictEqual(routeJob.pdfCaseNumber, 'F.4-22/2026');
    assert.strictEqual(routeJob.pdfParserEngine, 'gemini-vision-ocr');
    assert.strictEqual(routeJob.clippingImageUrl, 'https://example.pk/ad.png');
    assert.strictEqual(routeJob.mediaUrl, 'https://example.pk/ad.png');
  });

  await runTest('MASTER-STEP Group A Case 2 [Mocked]: Zero-vacancy PDF responses accurately report success=false on parsePdfFromUrl without breaking clean empty [] in scrapeTargetPortal, and real OCR failures still throw', async () => {
    const originalFetch = globalThis.fetch;
    const origGetText = PDFParse.prototype.getText;
    const origGetTable = PDFParse.prototype.getTable;
    const origDestroy = PDFParse.prototype.destroy;

    try {
      globalThis.fetch = (async () =>
        new Response(Buffer.from('%PDF-1.4\n%Mock PDF'), {
          status: 200,
          headers: { 'content-type': 'application/pdf' }
        })) as any;

      PDFParse.prototype.getText = (async () => ({
        text: 'General Public Tender and Office Circular without any employment positions or vacancies listed at all. Reference code T-100/2026.',
        total: 1
      })) as any;
      PDFParse.prototype.getTable = (async () => ({ pages: [] })) as any;
      PDFParse.prototype.destroy = (async () => {}) as any;

      const zeroVacPdf = await parsePdfFromUrl('https://[2607:f8b0:4005:805::200e]/circular.pdf?id=7', 'Public Dept');
      assert.strictEqual(zeroVacPdf.diagnosticCode, 'PDF_TEXT_ZERO_VACANCIES');
      assert.strictEqual(zeroVacPdf.success, false, 'Zero extracted jobs must report success=false');

      const portalEmpty = await scrapeTargetPortal(
        {
          id: 'pdf-zero-vac',
          name: 'Zero Vacancy PDF Portal',
          url: 'https://[2607:f8b0:4005:805::200e]/circular.pdf?id=7',
          keywords: '',
          interval: '24h',
          autoApprove: false,
          status: 'Active Scheduled',
          scrapedCount: 0
        },
        {},
        undefined,
        (async () => ({
          success: false,
          diagnosticCode: 'PDF_SCANNED_FALLBACK_NO_VACANCIES',
          formatType: 'pdf',
          extractedJobs: []
        })) as any
      );
      assert.deepStrictEqual(portalEmpty, [], 'Zero-vacancy PDF/OCR diagnostic must resolve to clean [] instead of Invalid PDF');

      // Real OCR failure must still surface an error
      await assert.rejects(
        () =>
          scrapeTargetPortal(
            {
              id: 'ocr-key-fail',
              name: 'OCR Key Missing Portal',
              url: 'https://[2607:f8b0:4005:805::200e]/scan.jpg',
              keywords: '',
              interval: '24h',
              autoApprove: false,
              status: 'Active Scheduled',
              scrapedCount: 0
            },
            {},
            undefined,
            (async () => ({
              success: false,
              diagnosticCode: 'IMAGE_OCR_KEY_MISSING',
              message: 'GEMINI_API_KEY missing',
              formatType: 'image',
              extractedJobs: []
            })) as any
          ),
        /GEMINI_API_KEY|OCR/i
      );
    } finally {
      globalThis.fetch = originalFetch;
      PDFParse.prototype.getText = origGetText;
      PDFParse.prototype.getTable = origGetTable;
      PDFParse.prototype.destroy = origDestroy;
    }
  });

  await runTest('MASTER-STEP Group A Case 3 [Mocked]: provenExtractionMethods are persisted ONLY on verified persisted jobs, never on rejected or failed runs', async () => {
    const statUpdates: any[] = [];
    const baseSource = {
      id: 'proven-src-1',
      name: 'Proven Portal',
      url: 'https://proven.example.pk/jobs',
      keywords: '',
      category: 'Government Sector',
      region: 'Pakistan',
      depth: 'Standard (25 Jobs)',
      deduplication: true,
      interval: '24h',
      autoApprove: false,
      status: 'Active Scheduled',
      scrapedCount: 0,
      successRate: 100
    };

    // Case 3a: Persist succeeds -> provenExtractionMethodsToAdd recorded
    await executeScraperWithWizard(
      { mode: 'complete', sourceId: 'proven-src-1' },
      {
        getConfigsFn: async () => [{ ...baseSource }],
        scrapePageFn: (async () => [
          {
            title: 'Research Associate',
            company: 'Energy Council',
            location: 'Islamabad',
            extractionMethod: 'json_ld',
            sourceUrl: 'https://proven.example.pk/jobs/1'
          }
        ]) as any,
        enrichJobsFn: async (jobs) => jobs,
        findDuplicateCandidatesFn: async () => [],
        addPendingJobFn: async (job) => job,
        createJobFn: async (job) => job,
        updateSourceStatsFn: async (_id, stats) => {
          statUpdates.push(stats);
        },
        addRunFn: async (run) => ({ ...run, isPersistedToMongo: true }),
        auditAddFn: async () => {}
      }
    );

    const okUpdate = statUpdates[statUpdates.length - 1];
    assert.deepStrictEqual(okUpdate.provenExtractionMethodsToAdd, ['json_ld']);

    // Case 3b: Persistence fails -> provenExtractionMethodsToAdd must NOT contain the unpersisted method
    statUpdates.length = 0;
    await executeScraperWithWizard(
      { mode: 'complete', sourceId: 'proven-src-1' },
      {
        getConfigsFn: async () => [{ ...baseSource }],
        scrapePageFn: (async () => [
          {
            title: 'Survey Engineer',
            company: 'Energy Council',
            location: 'Lahore',
            extractionMethod: 'embedded_state',
            sourceUrl: 'https://proven.example.pk/jobs/2'
          }
        ]) as any,
        enrichJobsFn: async (jobs) => jobs,
        findDuplicateCandidatesFn: async () => [],
        addPendingJobFn: async () => {
          throw new Error('Write failure');
        },
        createJobFn: async () => {
          throw new Error('Write failure');
        },
        updateSourceStatsFn: async (_id, stats) => {
          statUpdates.push(stats);
        },
        addRunFn: async (run) => ({ ...run, isPersistedToMongo: true }),
        auditAddFn: async () => {}
      }
    );

    const failUpdate = statUpdates[statUpdates.length - 1];
    assert.strictEqual(
      failUpdate.provenExtractionMethodsToAdd,
      undefined,
      'Failed persistence must never mark provenExtractionMethods'
    );
  });

  await runTest('MASTER-STEP Group B Case 1 [Mocked]: extractNextPageUrl skips disabled links and nextPageUrl propagates across JSON-LD, Embedded State, HTML Semantic, and Linked Image strategies', async () => {
    const disabledHtml = `
      <ul class="pagination">
        <li class="page-item disabled"><a class="page-link" href="/jobs?page=2" rel="next">Next</a></li>
        <li class="page-item"><a class="page-link" href="/jobs?page=3" aria-disabled="true">Next Page</a></li>
        <li class="page-item"><a class="page-link" href="#">›</a></li>
        <li class="page-item"><a class="page-link" href="/jobs?page=4">Next ›</a></li>
      </ul>
    `;
    const nextUrl = extractNextPageUrl(disabledHtml, 'https://example.pk/jobs?page=1');
    assert.strictEqual(nextUrl, 'https://example.pk/jobs?page=4', 'extractNextPageUrl must skip disabled and # links and return active Next link');

    const originalFetch = globalThis.fetch;
    try {
      const jsonLdHtml = `
        <html><head>
        <script type="application/ld+json">
          {"@type":"JobPosting","title":"Cloud Architect","hiringOrganization":{"name":"NatGrid"},"jobLocation":{"address":{"addressLocality":"Islamabad"}},"url":"https://[2607:f8b0:4005:805::200e]/job/1"}
        </script>
        </head><body><a rel="next" href="/careers?page=2">Next</a></body></html>
      `;
      globalThis.fetch = (async () => new Response(jsonLdHtml, { status: 200, headers: { 'content-type': 'text/html' } })) as any;

      const jsonLdJobs = await scrapeTargetPortal(
        {
          id: 'pag-jsonld',
          name: 'JSON-LD Portal',
          url: 'https://[2607:f8b0:4005:805::200e]/careers?page=1',
          keywords: '',
          interval: '24h',
          autoApprove: false,
          status: 'Active Scheduled',
          scrapedCount: 0
        },
        {}
      );
      assert.strictEqual(jsonLdJobs.length, 1);
      assert.strictEqual(jsonLdJobs[0].nextPageUrl, 'https://[2607:f8b0:4005:805::200e]/careers?page=2');

      const embeddedHtml = `
        <html><body>
        <script id="__NEXT_DATA__" type="application/json">
          {"props":{"pageProps":{"jobs":[{"title":"DevOps Engineer","company":"TechGov","location":"Karachi","url":"https://[2607:f8b0:4005:805::200e]/j/9"}]}}}
        </script>
        <a rel="next" href="/board?p=2">Next</a>
        </body></html>
      `;
      globalThis.fetch = (async () => new Response(embeddedHtml, { status: 200, headers: { 'content-type': 'text/html' } })) as any;

      const embeddedJobs = await scrapeTargetPortal(
        {
          id: 'pag-embedded',
          name: 'NextJS Portal',
          url: 'https://[2607:f8b0:4005:805::200e]/board?p=1',
          keywords: '',
          interval: '24h',
          autoApprove: false,
          status: 'Active Scheduled',
          scrapedCount: 0
        },
        {}
      );
      assert.strictEqual(embeddedJobs.length, 1);
      assert.strictEqual(embeddedJobs[0].nextPageUrl, 'https://[2607:f8b0:4005:805::200e]/board?p=2');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  await runTest('MASTER-STEP Group B Case 2 [Mocked]: crawlPortalPages paginates custom_date (inclusive toTimestamp) & keyword_drill while surfacing mid-crawl page errors cleanly', async () => {
    const visitedPages: string[] = [];
    const target = {
      id: 'crawl-mode-src',
      name: 'Multi-Mode Portal',
      url: 'https://multi.example.pk/jobs?page=1',
      keywords: 'Engineer',
      interval: '24h' as const,
      autoApprove: false,
      status: 'Active Scheduled' as const,
      scrapedCount: 0
    };

    const customDateCrawl = await crawlPortalPages(
      target,
      { mode: 'custom_date', toTimestamp: '2026-11-15' },
      '2026-11-01',
      'RUN-GROUPB-1',
      (async (cfg: any) => {
        visitedPages.push(cfg.url);
        if (cfg.url.endsWith('page=1')) {
          return [
            {
              title: 'Civil Engineer',
              company: 'PWD',
              location: 'Lahore',
              datePosted: '2026-11-15T18:30:00Z', // Same UTC day as inclusive toTimestamp
              sourceUrl: 'https://multi.example.pk/j/1',
              nextPageUrl: 'https://multi.example.pk/jobs?page=2'
            }
          ];
        }
        return [
          {
            title: 'Mechanical Engineer',
            company: 'PWD',
            location: 'Multan',
            datePosted: '2026-11-10T09:00:00Z',
            sourceUrl: 'https://multi.example.pk/j/2'
          }
        ];
      }) as any
    );

    assert.strictEqual(customDateCrawl.sourcePagesAttempted, 2, 'custom_date must follow nextPageUrl pagination');
    assert.strictEqual(customDateCrawl.rawResults.length, 2);

    // Execute full wizard with toTimestamp inclusive YYYY-MM-DD filtering and keyword_drill check
    const savedJobs: any[] = [];
    const customSummary = await executeScraperWithWizard(
      { mode: 'custom_date', sourceId: 'crawl-mode-src', fromTimestamp: '2026-11-01', toTimestamp: '2026-11-15' },
      {
        getConfigsFn: async () => [{ ...target }],
        scrapePageFn: (async () => [
          {
            title: 'Inclusive Day Job',
            company: 'PWD',
            location: 'Lahore',
            datePosted: '2026-11-15T20:00:00Z',
            sourceUrl: 'https://multi.example.pk/j/inc'
          },
          {
            title: 'Too Late Job',
            company: 'PWD',
            location: 'Lahore',
            datePosted: '2026-11-17T08:00:00Z',
            sourceUrl: 'https://multi.example.pk/j/late'
          }
        ]) as any,
        enrichJobsFn: async (j) => j,
        findDuplicateCandidatesFn: async () => [],
        addPendingJobFn: async (j) => {
          savedJobs.push(j);
          return j;
        },
        updateSourceStatsFn: async () => {},
        addRunFn: async (r) => ({ ...r, isPersistedToMongo: true }),
        auditAddFn: async () => {}
      }
    );
    assert.strictEqual(customSummary.totalFound, 1, 'Inclusive end-of-day toTimestamp keeps Nov 15 and drops Nov 17');
    assert.strictEqual(savedJobs[0].title, 'Inclusive Day Job');

    // Page-2 timeout yielding 0 valid jobs across crawl must report failure healthStatus instead of clean "No Jobs"
    const partialErrUpdate = buildSourceCompletionStatsUpdate({
      sourceCompletedAt: new Date().toISOString(),
      previousLastSuccessfulScrapeAt: '2026-11-01T00:00:00.000Z',
      runId: 'RUN-PAGE-ERR',
      isCheckpointEligible: false,
      isDetectionSuccessful: false,
      isAllPersistAttemptsFailed: false,
      hasUnsavedRequiredVacancies: false,
      sourceSaveFailures: 0,
      sourceUniqueSaveFailures: 0,
      sourceDupSaveFailures: 0,
      sourcePagesAttempted: 2,
      lastPageError: new Error('Connection timeout on page 2'),
      hitSafetyLimit: false,
      maxSafetyPages: 25,
      isCompleteMode: true,
      sourceValid: 0,
      sourceFound: 0,
      sourcePersisted: 0,
      sourceIntentionalSkips: 0
    });
    assert.strictEqual(partialErrUpdate.statsUpdate.healthStatus, 'Timeout');
    assert.ok(partialErrUpdate.lastErrorNotice?.includes('Crawling interrupted'));
  });

  await runTest('MASTER-STEP Group C Case 1 [Unit/Mocked]: Database Error classification, stale schedule recovery to Active Scheduled, persisted counter integrity, and scheduler error tracking', async () => {
    // 1. Unverified source with Database Error must classify as Partial (not Configured / Not Yet Verified)
    const dbErrClass = deriveSourceClassification({
      id: 'unv-db-err',
      name: 'Unverified DB Err Source',
      status: 'Active Scheduled',
      scrapedCount: 0,
      healthStatus: 'Database Error',
      lastErrorMessage: 'Duplicate lookup failed'
    });
    assert.strictEqual(dbErrClass.overallStatus, 'Partial');

    // 2. resetStaleSchedules restores Running/Processing sources to Active Scheduled (not Idle)
    const repoAny = ScraperRepository as any;
    const prevCached = Array.isArray(repoAny.cachedSources) ? [...repoAny.cachedSources] : [];
    const origGetConfigs = ScraperRepository.getConfigs;
    const origSaveConfigs = ScraperRepository.saveConfigs;
    let savedConfigsSnapshot: any[] = [];
    try {
      ScraperRepository.getConfigs = async () => [
        { id: 'r1', name: 'Running One', status: 'Running' },
        { id: 'r2', name: 'Processing Two', status: 'Processing' },
        { id: 'p3', name: 'Paused Three', status: 'Paused' }
      ];
      ScraperRepository.saveConfigs = async (cfgs: any[]) => {
        savedConfigsSnapshot = cfgs;
      };
      const resetRes = await ScraperRepository.resetStaleSchedules();
      assert.strictEqual(resetRes.resetCount, 2);
      assert.strictEqual(savedConfigsSnapshot.find(c => c.id === 'r1')?.status, 'Active Scheduled');
      assert.strictEqual(savedConfigsSnapshot.find(c => c.id === 'r2')?.status, 'Active Scheduled');
      assert.strictEqual(savedConfigsSnapshot.find(c => c.id === 'p3')?.status, 'Paused');
    } finally {
      ScraperRepository.getConfigs = origGetConfigs;
      ScraperRepository.saveConfigs = origSaveConfigs;
      repoAny.cachedSources = prevCached;
    }

    // 3. Failed DB persistence must NOT increment totalNew / jobsAccepted / sourceStats.newCount
    let recordedRunPayload: any = null;
    const failedPersistSummary = await executeScraperWithWizard(
      { mode: 'complete', sourceId: 'fail-count-src' },
      {
        getConfigsFn: async () => [
          {
            id: 'fail-count-src',
            name: 'Counter Integrity Portal',
            url: 'https://integrity.example.pk/jobs',
            keywords: '',
            category: 'Government Sector',
            region: 'Pakistan',
            depth: 'Standard (25 Jobs)',
            deduplication: true,
            interval: '24h',
            autoApprove: false,
            status: 'Active Scheduled',
            scrapedCount: 0,
            successRate: 100
          }
        ],
        scrapePageFn: (async () => [
          {
            title: 'Valid Role One',
            company: 'Integrity Dept',
            location: 'Islamabad',
            sourceUrl: 'https://integrity.example.pk/1'
          },
          {
            title: 'Valid Role Two',
            company: 'Integrity Dept',
            location: 'Islamabad',
            sourceUrl: 'https://integrity.example.pk/2'
          },
          {
            title: 'X', // Rejected due to short title < 3
            company: 'Integrity Dept',
            location: 'Islamabad',
            sourceUrl: 'https://integrity.example.pk/3'
          }
        ]) as any,
        enrichJobsFn: async (j) => j,
        findDuplicateCandidatesFn: async () => [],
        addPendingJobFn: async (job) => {
          if (job.title === 'Valid Role Two') {
            throw new Error('DB timeout saving second role');
          }
          return job;
        },
        updateSourceStatsFn: async () => {},
        addRunFn: async (run) => {
          recordedRunPayload = run;
          return { ...run, isPersistedToMongo: true };
        },
        auditAddFn: async () => {}
      }
    );

    assert.strictEqual(failedPersistSummary.totalFound, 2);
    assert.strictEqual(failedPersistSummary.totalNew, 1, 'Failed save must NOT increment totalNew');
    assert.strictEqual(failedPersistSummary.jobsAccepted, 1, 'Failed save must NOT increment jobsAccepted');
    assert.strictEqual(failedPersistSummary.totalFailedToSave, 1);
    assert.strictEqual(failedPersistSummary.jobsRejected, 1);
    assert.strictEqual(failedPersistSummary.sourcesStats[0].newCount, 1);
    assert.strictEqual(failedPersistSummary.sourcesStats[0].persistedCount, 1);
    assert.strictEqual(failedPersistSummary.sourcesStats[0].failedToSaveCount, 1);
    assert.strictEqual(failedPersistSummary.sourcesStats[0].rejectedCount, 1);
    assert.strictEqual(recordedRunPayload.totalNew, 1);
    assert.strictEqual(recordedRunPayload.totalFailedToSave, 1);

    // 4. runSchedulerTick separates threw-error source into failedSources and records tick failure run
    let schedRecordedRun: any = null;
    const dueSrc1 = {
      id: 'sched-err-src',
      name: 'Errored Source',
      url: 'https://err.example.pk',
      status: 'Active Scheduled',
      interval: '1h',
      nextRunAt: new Date(Date.now() - 60_000).toISOString()
    };
    const dueSrc2 = {
      id: 'sched-ok-src',
      name: 'OK Source',
      url: 'https://ok.example.pk',
      status: 'Active Scheduled',
      interval: '1h',
      nextRunAt: new Date(Date.now() - 60_000).toISOString()
    };
    const schedTickRes = await runSchedulerTick({
      isScraperEnabledFn: () => true,
      getSchedulerSettingsFn: async () => ({ ...getDefaultSchedulerSettings(), enabled: true, scope: 'all' }),
      getConfigsFn: async () => [dueSrc1, dueSrc2],
      updateSourceScheduleFn: async () => true,
      executeScraperFn: (async (opts: any) => {
        if (opts.sourceId === 'sched-err-src') {
          throw new Error('Unexpected uncaught source crash');
        }
        return { totalFound: 2, totalDuplicates: 0 };
      }) as any,
      addRunFn: async (run) => {
        schedRecordedRun = run;
        return { ...run, isPersistedToMongo: true };
      }
    });

    assert.deepStrictEqual(schedTickRes.triggeredSources, ['sched-ok-src'], 'Errored source must NOT appear in triggeredSources');
    assert.deepStrictEqual(schedTickRes.failedSources, ['sched-err-src']);
    assert.ok(schedRecordedRun, 'Scheduler tick with uncaught execution error must record run history');
    assert.strictEqual(schedRecordedRun.status, 'Partial');
    assert.strictEqual(schedRecordedRun.failedSources, 1);
  });

  // --- STEP-8.4-F: PDF SCRAPER UI DUPLICATE PERSISTENCE PREVENTION TESTS ---
  await runTest('STEP-8.4-F-1 [Auto-Scrape /scraper/run No Double Import]: handleTriggerAutoScrapeRun coordinator refreshes read-only without calling onBatchImportJobs, keeping counters, portal timestamps, and audit logs working', async () => {
    const sampleTargets: ConsolidatedPdfGazette[] = [
      {
        id: 'fpsc-portal-1',
        title: 'FPSC Consolidated Advt 08/2026',
        organization: 'FPSC',
        pdfFileName: 'fpsc_08_2026.pdf',
        pdfUrl: 'https://fpsc.gov.pk/advt-08-2026.pdf',
        fileSizeFormatted: '2.1 MB',
        totalPages: 4,
        gazetteIssueNumber: '08/2026',
        publicationDate: '2026-11-18',
        closingDeadline: '2026-12-05',
        rawTextSample: '',
        extractedVacancies: []
      }
    ];

    const publishedJob = {
      id: 'db-job-pub-1',
      title: 'Assistant Director (BS-17)',
      company: 'FPSC',
      status: 'Approved',
      salary: 'PKR 95,000',
      region: 'Pakistan',
      isGovtJob: true,
      isPdfScraped: true,
      tags: ['FPSC']
    } as unknown as Job;

    const pendingJob = {
      id: 'db-job-pend-1',
      title: 'Inspector Customs (BS-16)',
      company: 'FPSC',
      status: 'Pending',
      salary: 'PKR 80,000',
      region: 'Pakistan',
      isGovtJob: true,
      isPdfScraped: true,
      tags: ['Customs']
    } as unknown as Job;

    let refreshJobsCalls = 0;
    let recordedTimestamps: { ids: string[]; counts: Record<string, number> } | null = null;
    let loggedBatch: ScraperBatchRun | null = null;
    let loggedAudits: ScrapedJobAuditEntry[] = [];

    const outcome = await executeAutoScrapeRunCoordinator({
      targets: sampleTargets,
      autoScrapeConfig: {
        enabled: true,
        intervalMinutes: 15,
        targetScope: 'all',
        preventDuplicates: true,
        autoApprove: true
      },
      runScraperFn: async () => ({
        success: true,
        runId: 'RUN-AUTO-101',
        publishedJobs: [publishedJob],
        pendingJobs: [pendingJob],
        duplicateJobs: [],
        totalFound: 3,
        totalDuplicates: 1,
        totalFailedSources: 0,
        jobsRejected: 0,
        executionDurationMs: 850,
        sourcesStats: [{ sourceId: 'fpsc-portal-1', found: 3 }]
      }),
      onRefreshJobs: async () => {
        refreshJobsCalls++;
      },
      updatePortalScrapedTimestamp: (ids, counts) => {
        recordedTimestamps = { ids, counts };
      },
      onLogBatchRun: (batch, audits) => {
        loggedBatch = batch;
        loggedAudits = audits;
      }
    });

    assert.strictEqual(refreshJobsCalls, 1, 'Should refresh jobs read-only from backend after /scraper/run');
    assert.deepStrictEqual(recordedTimestamps, {
      ids: ['fpsc-portal-1'],
      counts: { 'fpsc-portal-1': 3 }
    });
    assert.ok(loggedBatch, 'Batch run log must still be recorded');
    assert.strictEqual((loggedBatch as ScraperBatchRun).batchId, 'RUN-AUTO-101');
    assert.strictEqual((loggedBatch as ScraperBatchRun).totalExtracted, 3);
    assert.strictEqual((loggedBatch as ScraperBatchRun).approvedCount, 1);
    assert.strictEqual((loggedBatch as ScraperBatchRun).pendingCount, 1);
    assert.strictEqual((loggedBatch as ScraperBatchRun).duplicatesSkipped, 1);
    assert.strictEqual(loggedAudits.length, 2);
    assert.ok(outcome.toastMessage.includes('Harvested 2 new vacancies, skipped 1 duplicates'));

    // Also assert handleTriggerAutoScrapeRun inside PdfConsolidatedScraperModal.tsx has NO onBatchImportJobs call
    const modalSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/PdfConsolidatedScraperModal.tsx'),
      'utf8'
    );
    const autoFnStart = modalSource.indexOf('const handleTriggerAutoScrapeRun = async () =>');
    const autoFnEnd = modalSource.indexOf('const handleScrapeAllPortals = async () =>');
    assert.ok(autoFnStart > 0 && autoFnEnd > autoFnStart);
    const autoFnSlice = modalSource.slice(autoFnStart, autoFnEnd);
    assert.strictEqual(
      autoFnSlice.includes('onBatchImportJobs('),
      false,
      'handleTriggerAutoScrapeRun must NOT invoke onBatchImportJobs'
    );
    assert.ok(modalSource.includes('executeAutoScrapeRunCoordinator'));

    const adminSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/AdminDashboard.tsx'),
      'utf8'
    );
    assert.ok(
      adminSource.includes('onRefreshJobs={onReloadJobs}'),
      'AdminDashboard must pass read-only onReloadJobs as onRefreshJobs to PdfConsolidatedScraperModal'
    );
  });

  await runTest('STEP-8.4-F-2 [Scrape All Portals /scraper/run Blocked Re-Import]: handleScrapeAllPortals results display counters & timestamps but CANNOT be re-imported through handleIngest / onBatchImportJobs', async () => {
    const gazettes: ConsolidatedPdfGazette[] = [
      {
        id: 'wapda-portal-1',
        title: 'WAPDA Career Notice 2026',
        organization: 'WAPDA',
        pdfFileName: 'wapda_2026.pdf',
        pdfUrl: 'https://wapda.gov.pk/careers.pdf',
        fileSizeFormatted: '1.8 MB',
        totalPages: 2,
        gazetteIssueNumber: 'W-02/2026',
        publicationDate: '2026-11-18',
        closingDeadline: '2026-12-10',
        rawTextSample: '',
        extractedVacancies: []
      }
    ];

    const persistedJob1 = {
      id: 'persisted-wapda-1',
      title: 'Junior Engineer (Electrical)',
      company: 'WAPDA',
      status: 'Approved',
      salary: 'PKR 110,000',
      isDuplicate: false
    } as unknown as Job;
    const dupJob = {
      id: 'dup-wapda-1',
      title: 'Sub Divisional Officer',
      company: 'WAPDA',
      status: 'Pending',
      salary: 'PKR 105,000',
      isDuplicate: true
    } as unknown as Job;

    let refreshCount = 0;
    let timestampUpdate: { ids: string[]; counts: Record<string, number> } | null = null;

    const scrapeOutcome = await executeScrapeAllPortalsCoordinator({
      targetGazettes: gazettes,
      runScraperFn: async () => ({
        success: true,
        publishedJobs: [persistedJob1],
        pendingJobs: [],
        duplicateJobs: [dupJob],
        totalFound: 2,
        totalDuplicates: 1,
        totalFailedSources: 0,
        sourcesStats: [{ sourceId: 'wapda-portal-1', found: 2 }]
      }),
      onRefreshJobs: async () => {
        refreshCount++;
      },
      updatePortalScrapedTimestamp: (ids, counts) => {
        timestampUpdate = { ids, counts };
      }
    });

    assert.strictEqual(scrapeOutcome.alreadyPersistedByBackendRun, true);
    assert.deepStrictEqual(scrapeOutcome.selectedJobIds, []);
    assert.strictEqual(scrapeOutcome.allJobs.length, 2);
    assert.strictEqual(scrapeOutcome.uniqueOnes.length, 1);
    assert.strictEqual(refreshCount, 1);
    assert.deepStrictEqual(timestampUpdate, {
      ids: ['wapda-portal-1'],
      counts: { 'wapda-portal-1': 2 }
    });

    // Even if all job IDs are selected and ingest is invoked (both direct publish and pending review),
    // onBatchImportJobs must NEVER be called for already-persisted /scraper/run results.
    let batchImportCalls = 0;
    let logCalls = 0;
    const blockedPublish = executeManualIngestCoordinator({
      extractedVacancies: scrapeOutcome.allJobs,
      selectedJobIds: scrapeOutcome.allJobs.map(j => j.id),
      alreadyPersistedByBackendRun: scrapeOutcome.alreadyPersistedByBackendRun,
      autoApprove: true,
      activeGazette: gazettes[0],
      parserEngine: 'pdfplumber',
      parseLogs: [],
      stats: { duplicateCount: 1, overrideCount: 0 },
      onBatchImportJobs: () => {
        batchImportCalls++;
      },
      onLogBatchRun: () => {
        logCalls++;
      }
    });

    assert.strictEqual(blockedPublish.imported, false);
    assert.strictEqual(blockedPublish.blockedReason, 'already_persisted_by_backend_run');
    assert.strictEqual(batchImportCalls, 0, 'Manual ingest must NOT call onBatchImportJobs for /scraper/run jobs');
    assert.strictEqual(logCalls, 0);

    const modalSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/PdfConsolidatedScraperModal.tsx'),
      'utf8'
    );
    assert.ok(modalSource.includes('disabled={areExtractedJobsPersistedByBackendRun}'));
    assert.ok(modalSource.includes('Already Persisted by Backend Scraper Engine'));
  });

  await runTest('STEP-8.4-F-3 [Preserve /scraper/parse-url Workflows]: parse-url extraction + manual ingest and 1-click parse-url still call onBatchImportJobs cleanly with audit logs & timestamps', async () => {
    const gazette: ConsolidatedPdfGazette = {
      id: 'ppsc-portal-1',
      title: 'PPSC Advt 29/2026',
      organization: 'PPSC',
      pdfFileName: 'ppsc_29_2026.pdf',
      pdfUrl: 'https://ppsc.gop.pk/advt-29-2026.pdf',
      fileSizeFormatted: '1.5 MB',
      totalPages: 3,
      gazetteIssueNumber: '29/2026',
      publicationDate: '2026-11-18',
      closingDeadline: '2026-12-08',
      rawTextSample: '',
      extractedVacancies: []
    };

    const parsedJob = {
      id: 'parsed-ppsc-1',
      title: 'Tehsildar (BS-16)',
      company: 'PPSC',
      salary: 'PKR 78,000',
      description: 'Revenue officer recruitment',
      requirements: ['Bachelor Degree'],
      benefits: ['Pension'],
      tags: ['PPSC'],
      sourceUrl: 'https://ppsc.gop.pk/advt-29-2026.pdf',
      isPdfScraped: true
    } as unknown as Job;

    // 1. parse-url extraction -> manual handleIngest path
    const parseRes = await executeParseUrlExtractionCoordinator({
      targetUrl: gazette.pdfUrl,
      organization: gazette.organization,
      title: gazette.title,
      existingJobs: [],
      parseUrlFn: async () => ({
        success: true,
        jobs: [parsedJob],
        message: 'Extracted 1 job from PDF',
        rawTextSample: 'Case No 29/2026 Tehsildar'
      })
    });

    assert.strictEqual(parseRes.alreadyPersistedByBackendRun, false);
    assert.strictEqual(parseRes.enrichedJobs.length, 1);
    assert.deepStrictEqual(parseRes.selectedJobIds, ['parsed-ppsc-1']);

    let importedPayload: { jobs: Job[]; autoApprove: boolean; title: string } | null = null;
    let manualBatchRun: ScraperBatchRun | null = null;
    let manualAuditCount = 0;

    const ingestRes = executeManualIngestCoordinator({
      extractedVacancies: parseRes.enrichedJobs,
      selectedJobIds: parseRes.selectedJobIds,
      alreadyPersistedByBackendRun: parseRes.alreadyPersistedByBackendRun,
      autoApprove: true,
      activeGazette: gazette,
      parserEngine: 'pdfplumber',
      parseLogs: ['Parsed 1 job'],
      stats: { duplicateCount: 0, overrideCount: 0 },
      onBatchImportJobs: (jobs, autoApprove, title) => {
        importedPayload = { jobs, autoApprove, title };
      },
      onLogBatchRun: (batch, audits) => {
        manualBatchRun = batch;
        manualAuditCount = audits.length;
      }
    });

    assert.strictEqual(ingestRes.imported, true);
    assert.ok(importedPayload);
    assert.strictEqual((importedPayload as { jobs: Job[] }).jobs.length, 1);
    assert.strictEqual((importedPayload as { jobs: Job[] }).jobs[0].id, 'parsed-ppsc-1');
    assert.ok(manualBatchRun);
    assert.strictEqual((manualBatchRun as ScraperBatchRun).totalExtracted, 1);
    assert.strictEqual(manualAuditCount, 1);

    // 2. 1-Click parse-url workflow
    let oneClickImported: Job[] = [];
    let oneClickTimestampIds: string[] = [];
    let oneClickBatch: ScraperBatchRun | null = null;

    const oneClickRes = await executeOneClickParseUrlCoordinator({
      targetG: gazette,
      existingJobs: [],
      parseUrlFn: async () => ({
        success: true,
        jobs: [parsedJob]
      }),
      onBatchImportJobs: (jobs) => {
        oneClickImported = jobs;
      },
      updatePortalScrapedTimestamp: (ids) => {
        oneClickTimestampIds = ids;
      },
      onLogBatchRun: (batch) => {
        oneClickBatch = batch;
      }
    });

    assert.strictEqual(oneClickRes.alreadyPersistedByBackendRun, false);
    assert.strictEqual(oneClickImported.length, 1);
    assert.deepStrictEqual(oneClickTimestampIds, ['ppsc-portal-1']);
    assert.ok(oneClickBatch);
    assert.strictEqual((oneClickBatch as ScraperBatchRun).approvedCount, 1);
  });

  // --- STEP-8.5-B: SAFE EXACT SOURCE IDENTITY MATCHING TESTS ---
  await runTest('STEP-8.5-B-1 [Same sourceUrl With Harmless Formatting Differences]: Hostname casing, default ports, fragments, trailing slashes, and tracking params are normalized and detected without mutating stored URLs', () => {
    const rawExistingUrl = 'https://Careers.Example.COM:443/openings/Backend-Engineer/?utm_source=feed&fbclid=abc#details';
    const rawCandidateUrl = '  https://careers.example.com/openings/Backend-Engineer#top  ';

    const existingJob = {
      id: 'job-src-norm-1',
      title: 'Backend Software Developer',
      company: 'Alpha Systems',
      status: 'Approved',
      sourceUrl: rawExistingUrl
    };
    const candidateJob = {
      id: 'cand-src-norm-1',
      title: 'Completely Different Listing Title',
      company: 'Beta Holdings',
      sourceUrl: rawCandidateUrl
    };

    const arrayResult = detectJobDuplicate(candidateJob, [existingJob]);
    assert.strictEqual(arrayResult.isDuplicate, true);
    assert.strictEqual(arrayResult.confidence, 100);
    assert.strictEqual(arrayResult.comparisonDetails.sourceUrlMatch, true);
    assert.strictEqual(arrayResult.comparisonDetails.applyUrlMatch, false);

    const indexResult = detectJobDuplicate(candidateJob, new DuplicateIndex([existingJob]));
    assert.strictEqual(indexResult.isDuplicate, true);
    assert.strictEqual(indexResult.confidence, 100);
    assert.strictEqual(indexResult.comparisonDetails.sourceUrlMatch, true);

    // Original stored URL values must remain untouched
    assert.strictEqual(existingJob.sourceUrl, rawExistingUrl);
    assert.strictEqual(candidateJob.sourceUrl, rawCandidateUrl);
    assert.strictEqual(
      normalizeExactJobUrl(rawExistingUrl),
      normalizeExactJobUrl(rawCandidateUrl)
    );
  });

  await runTest('STEP-8.5-B.1-A [HTTP vs HTTPS Protocol Preservation]: Same-scheme formatting normalizes cleanly while HTTP and HTTPS remain distinct across normalization, matching, and lookup', async () => {
    // 1. Same HTTP URL with harmless formatting differences (:80, uppercase host, trailing slash, tracking, fragment) matches
    const httpRawA = 'http://Careers.Example.COM:80/vacancies/Civil-Engineer/?utm_medium=cpc#section1';
    const httpRawB = 'http://careers.example.com/vacancies/Civil-Engineer#top';
    assert.strictEqual(normalizeExactJobUrl(httpRawA), 'http://careers.example.com/vacancies/Civil-Engineer');
    assert.strictEqual(normalizeExactJobUrl(httpRawA), normalizeExactJobUrl(httpRawB));

    const httpExisting = {
      id: 'http-exist-1',
      title: 'Civil Engineer',
      company: 'Alpha Infrastructure',
      status: 'Approved',
      sourceUrl: httpRawA,
      originalApplyUrl: 'http://APPLY.EXAMPLE.COM:80/form/101/?gclid=track1#apply'
    };
    const httpSameSchemeCand = {
      id: 'http-cand-1',
      title: 'Different Role Title',
      company: 'Beta Group',
      sourceUrl: httpRawB
    };
    assert.strictEqual(detectJobDuplicate(httpSameSchemeCand, [httpExisting]).isDuplicate, true);
    assert.strictEqual(detectJobDuplicate(httpSameSchemeCand, new DuplicateIndex([httpExisting])).isDuplicate, true);

    // 2. Same HTTPS URL with harmless formatting differences (:443, uppercase host, trailing slash, tracking, fragment) matches
    const httpsRawA = 'https://Careers.Example.COM:443/vacancies/Civil-Engineer/?fbclid=xyz#section1';
    const httpsRawB = 'https://careers.example.com/vacancies/Civil-Engineer';
    assert.strictEqual(normalizeExactJobUrl(httpsRawA), 'https://careers.example.com/vacancies/Civil-Engineer');
    assert.strictEqual(normalizeExactJobUrl(httpsRawA), normalizeExactJobUrl(httpsRawB));

    const httpsExisting = {
      id: 'https-exist-1',
      title: 'Electrical Specialist',
      company: 'Gamma Grid',
      status: 'Approved',
      sourceUrl: httpsRawA,
      originalApplyUrl: 'https://APPLY.EXAMPLE.COM:443/form/202/?utm_campaign=fall#start'
    };
    const httpsSameSchemeCand = {
      id: 'https-cand-1',
      title: 'Unrelated Coordinator Title',
      company: 'Delta Holdings',
      sourceUrl: httpsRawB
    };
    assert.strictEqual(detectJobDuplicate(httpsSameSchemeCand, [httpsExisting]).isDuplicate, true);
    assert.strictEqual(detectJobDuplicate(httpsSameSchemeCand, new DuplicateIndex([httpsExisting])).isDuplicate, true);

    // 3. HTTP and HTTPS versions of the same hostname/path do NOT become an exact URL match
    assert.notStrictEqual(normalizeExactJobUrl(httpRawB), normalizeExactJobUrl(httpsRawB));

    const crossProtocolSourceCand = {
      id: 'cross-proto-src-1',
      title: 'Unrelated Maritime Analyst',
      company: 'Oceanic Org',
      sourceUrl: 'https://careers.example.com/vacancies/Civil-Engineer'
    };
    const crossProtoSrcArr = detectJobDuplicate(crossProtocolSourceCand, [httpExisting]);
    assert.strictEqual(crossProtoSrcArr.isDuplicate, false);
    assert.strictEqual(crossProtoSrcArr.comparisonDetails.sourceUrlMatch, false);

    const crossProtoSrcIdx = detectJobDuplicate(crossProtocolSourceCand, new DuplicateIndex([httpExisting]));
    assert.strictEqual(crossProtoSrcIdx.isDuplicate, false);
    assert.strictEqual(crossProtoSrcIdx.comparisonDetails.sourceUrlMatch, false);

    const crossProtoApplyCand = {
      id: 'cross-proto-apply-1',
      title: 'Different Supply Chain Lead',
      company: 'Other Org',
      sourceUrl: 'https://otherboard.example.pk/listings/55',
      applicationUrl: 'https://apply.example.com/form/101'
    };
    assert.strictEqual(detectJobDuplicate(crossProtoApplyCand, [httpExisting]).isDuplicate, false);
    assert.strictEqual(detectJobDuplicate(crossProtoApplyCand, new DuplicateIndex([httpExisting])).isDuplicate, false);

    // 4. JobRepository.findDuplicateCandidates does not inject cross-protocol http:// fallback for https:// URLs
    const seenLookupQueries: any[] = [];
    const mockColl = () => ({
      find: (query: any) => {
        if (query && query.$or) seenLookupQueries.push(query);
        return {
          sort: () => ({ limit: () => ({ toArray: async () => [] }) }),
          limit: () => ({ toArray: async () => [] }),
          toArray: async () => []
        };
      }
    });
    await JobRepository.findDuplicateCandidates(
      {
        title: 'Protocol Lookup Test',
        company: 'Protocol Co',
        sourceUrl: 'https://careers.example.com/vacancies/Civil-Engineer/',
        applicationUrl: 'https://apply.example.com/form/202/'
      },
      {
        isMongoConfiguredFn: () => true,
        getJobsCollectionFn: async () => mockColl(),
        getPendingJobsCollectionFn: async () => mockColl()
      }
    );
    const serializedLookup = JSON.stringify(seenLookupQueries);
    assert.strictEqual(serializedLookup.includes('http://careers.example.com'), false);
    assert.strictEqual(serializedLookup.includes('http://apply.example.com'), false);
    assert.strictEqual(httpExisting.sourceUrl, httpRawA);
    assert.strictEqual(httpsExisting.sourceUrl, httpsRawA);
  });

  await runTest('STEP-8.5-B.1-B [Repeated Query-Parameter Ordering Preservation]: Repeated keys preserve relative order while distinct keys canonicalize and tracking params strip safely', () => {
    // 1. Same repeated-key parameters in the same order match
    const repSameA = 'https://jobs.example.pk/search?tag=b&tag=a&utm_source=digest';
    const repSameB = 'https://jobs.example.pk/search?tag=b&tag=a&fbclid=click123#results';
    assert.strictEqual(normalizeExactJobUrl(repSameA), 'https://jobs.example.pk/search?tag=b&tag=a');
    assert.strictEqual(normalizeExactJobUrl(repSameA), normalizeExactJobUrl(repSameB));

    const existRep = {
      id: 'rep-exist-1',
      title: 'Data Analyst',
      company: 'Horizon Corp',
      status: 'Approved',
      sourceUrl: repSameA
    };
    const candRepMatch = {
      id: 'rep-cand-match',
      title: 'Completely Distinct Title',
      company: 'Vertex Labs',
      sourceUrl: repSameB
    };
    assert.strictEqual(detectJobDuplicate(candRepMatch, [existRep]).isDuplicate, true);
    assert.strictEqual(detectJobDuplicate(candRepMatch, new DuplicateIndex([existRep])).isDuplicate, true);

    // 2. Same repeated-key parameters in a DIFFERENT order remain distinct
    const repReordered = 'https://jobs.example.pk/search?tag=a&tag=b';
    assert.strictEqual(normalizeExactJobUrl(repReordered), 'https://jobs.example.pk/search?tag=a&tag=b');
    assert.notStrictEqual(normalizeExactJobUrl(repSameA), normalizeExactJobUrl(repReordered));

    const candRepDiffOrder = {
      id: 'rep-cand-diff-order',
      title: 'Unrelated Auditor Role',
      company: 'Summit Co',
      sourceUrl: repReordered
    };
    const diffOrderArr = detectJobDuplicate(candRepDiffOrder, [existRep]);
    assert.strictEqual(diffOrderArr.isDuplicate, false);
    assert.strictEqual(diffOrderArr.comparisonDetails.sourceUrlMatch, false);

    const diffOrderIdx = detectJobDuplicate(candRepDiffOrder, new DuplicateIndex([existRep]));
    assert.strictEqual(diffOrderIdx.isDuplicate, false);
    assert.strictEqual(diffOrderIdx.comparisonDetails.sourceUrlMatch, false);

    // 3. Different meaningful query values remain distinct
    const candDiffValues = {
      id: 'rep-cand-diff-val',
      title: 'Unrelated Operations Role',
      company: 'Summit Co',
      sourceUrl: 'https://jobs.example.pk/search?tag=b&tag=c'
    };
    assert.strictEqual(detectJobDuplicate(candDiffValues, [existRep]).isDuplicate, false);
    assert.strictEqual(detectJobDuplicate(candDiffValues, new DuplicateIndex([existRep])).isDuplicate, false);

    // 4. Tracking-parameter differences do not break a match when repeated-key relative order + distinct keys match
    const mixA = 'https://apply.example.pk/apply?tag=second&dept=eng&tag=first&gh_src=board&utm_campaign=2026';
    const mixB = 'https://apply.example.pk/apply?dept=eng&tag=second&gclid=999&tag=first#step1';
    assert.strictEqual(normalizeExactJobUrl(mixA), 'https://apply.example.pk/apply?dept=eng&tag=second&tag=first');
    assert.strictEqual(normalizeExactJobUrl(mixA), normalizeExactJobUrl(mixB));

    const existMixApply = {
      id: 'mix-exist-1',
      title: 'Systems Engineer',
      company: 'Aero Dynamics',
      status: 'Approved',
      sourceUrl: 'https://aero.example.pk/jobs/1',
      originalApplyUrl: mixA
    };
    const candMixApply = {
      id: 'mix-cand-1',
      title: 'Other Board Name',
      company: 'Aggregator XYZ',
      sourceUrl: 'https://agg.example.pk/jobs/999',
      applicationUrl: mixB
    };
    const mixArrRes = detectJobDuplicate(candMixApply, [existMixApply]);
    assert.strictEqual(mixArrRes.isDuplicate, true);
    assert.strictEqual(mixArrRes.comparisonDetails.applyUrlMatch, true);
    const mixIdxRes = detectJobDuplicate(candMixApply, new DuplicateIndex([existMixApply]));
    assert.strictEqual(mixIdxRes.isDuplicate, true);
    assert.strictEqual(mixIdxRes.comparisonDetails.applyUrlMatch, true);

    // 5. Existing single-value distinct-key query normalization remains canonical
    assert.strictEqual(
      normalizeExactJobUrl('https://portal.example.pk/job?jobId=101&dept=it&utm_source=x'),
      normalizeExactJobUrl('https://portal.example.pk/job?dept=it&jobId=101&fbclid=y')
    );
  });

  await runTest('STEP-8.5-B-2 [Apply URL Cross-Field Match & Source-vs-Apply Isolation]: originalApplyUrl matches applicationUrl across records (and lookup retrieves them), while sourceUrl is never compared against apply URLs', async () => {
    const existingWithOrigApply = {
      id: 'exist-apply-1',
      title: 'Cloud Infrastructure Architect',
      company: 'Indus Cloud',
      status: 'Approved',
      sourceUrl: 'https://portal-a.example.pk/listing/901',
      originalApplyUrl: 'https://apply.induscloud.pk/requisitions/REQ-442/apply?utm_campaign=q4#form'
    };
    const candWithAppUrl = {
      id: 'cand-apply-1',
      title: 'Platform SRE Lead',
      company: 'Partner Aggregator',
      sourceUrl: 'https://aggregator-b.example.pk/post/774',
      applicationUrl: 'https://APPLY.INDUSCLOUD.PK:443/requisitions/REQ-442/apply/#start'
    };

    // 1. Array pool detection
    const arrayRes = detectJobDuplicate(candWithAppUrl, [existingWithOrigApply]);
    assert.strictEqual(arrayRes.isDuplicate, true);
    assert.strictEqual(arrayRes.confidence, 100);
    assert.strictEqual(arrayRes.comparisonDetails.applyUrlMatch, true);
    assert.strictEqual(arrayRes.comparisonDetails.sourceUrlMatch, false);
    assert.ok(arrayRes.matchingSignals.includes('Identical Apply Destination URL'));

    // 2. DuplicateIndex detection
    const idxRes = detectJobDuplicate(candWithAppUrl, new DuplicateIndex([existingWithOrigApply]));
    assert.strictEqual(idxRes.isDuplicate, true);
    assert.strictEqual(idxRes.confidence, 100);
    assert.strictEqual(idxRes.comparisonDetails.applyUrlMatch, true);

    // 3. JobRepository.findDuplicateCandidates queries both normalized & raw apply URLs across originalApplyUrl/applicationUrl
    const seenExactQueries: any[] = [];
    const mockColl = () => ({
      find: (query: any) => {
        if (query && query.$or) seenExactQueries.push(query);
        const docs = query && query.$or ? [existingWithOrigApply] : [];
        let idx = 0;
        return {
          sort: function() { return this; },
          batchSize: function() { return this; },
          limit: function() { return this; },
          hasNext: async function() { return idx < docs.length; },
          next: async function() { return docs[idx++]; },
          toArray: async () => docs
        };
      }
    });
    const lookedUp = await JobRepository.findDuplicateCandidates(candWithAppUrl, {
      isMongoConfiguredFn: () => true,
      getJobsCollectionFn: async () => mockColl(),
      getPendingJobsCollectionFn: async () => mockColl()
    });
    assert.ok(lookedUp.some(j => j.id === 'exist-apply-1'));
    assert.ok(
      seenExactQueries.some(q =>
        JSON.stringify(q).includes('https://apply.induscloud.pk/requisitions/REQ-442/apply')
      ),
      'Candidate lookup should include normalized apply URL variants'
    );

    // 4. Do NOT compare detail-page sourceUrl against another record's apply URL
    const detailOnlyExisting = {
      id: 'detail-only-1',
      title: 'Principal Botanist',
      company: 'Botany Institute',
      status: 'Approved',
      sourceUrl: 'https://botany.example.pk/vacancies/8821'
    };
    const crossFieldCandidate = {
      id: 'cross-field-cand-1',
      title: 'Digital Marketing Specialist',
      company: 'Media House',
      sourceUrl: 'https://media.example.pk/jobs/501',
      originalApplyUrl: 'https://botany.example.pk/vacancies/8821'
    };
    const crossArrayRes = detectJobDuplicate(crossFieldCandidate, [detailOnlyExisting]);
    assert.strictEqual(crossArrayRes.isDuplicate, false);
    assert.strictEqual(crossArrayRes.comparisonDetails.sourceUrlMatch, false);
    assert.strictEqual(crossArrayRes.comparisonDetails.applyUrlMatch, false);

    const crossIdxRes = detectJobDuplicate(crossFieldCandidate, new DuplicateIndex([detailOnlyExisting]));
    assert.strictEqual(crossIdxRes.isDuplicate, false);
  });

  await runTest('STEP-8.5-B-3 [Distinct URLs Do Not False-Match]: Different detail-page sourceUrls and different apply destinations remain unique', () => {
    const existing = {
      id: 'distinct-exist-1',
      title: 'Frontend Engineer',
      company: 'North Star Labs',
      status: 'Approved',
      sourceUrl: 'https://northstar.example.pk/jobs/1001',
      originalApplyUrl: 'https://apply.northstar.example.pk/jobs/1001/apply',
      applicationUrl: 'https://apply.northstar.example.pk/jobs/1001/apply'
    };
    const candidate = {
      id: 'distinct-cand-1',
      title: 'Accountant Officer',
      company: 'South Valley Corp',
      sourceUrl: 'https://northstar.example.pk/jobs/1002',
      originalApplyUrl: 'https://apply.northstar.example.pk/jobs/1002/apply',
      applicationUrl: 'https://apply.northstar.example.pk/jobs/1002/apply'
    };

    const arrayRes = detectJobDuplicate(candidate, [existing]);
    assert.strictEqual(arrayRes.isDuplicate, false);
    assert.strictEqual(arrayRes.comparisonDetails.sourceUrlMatch, false);
    assert.strictEqual(arrayRes.comparisonDetails.applyUrlMatch, false);

    const idxRes = detectJobDuplicate(candidate, new DuplicateIndex([existing]));
    assert.strictEqual(idxRes.isDuplicate, false);
  });

  await runTest('STEP-8.5-B-4 [Shared Generic Application Portal Protection]: Unrelated jobs sharing a generic /apply or portal root URL are NOT classified as duplicates', () => {
    const genericApplyUrls = [
      'https://online.fpsc.gov.pk/',
      'https://careers.acme.example.pk/apply',
      'https://portal.ppsc.example.pk/online-apply.aspx',
      'https://jobs.corp.example.com/careers/apply-now'
    ];

    for (const portalUrl of genericApplyUrls) {
      assert.strictEqual(
        isGenericApplicationPortalUrl(portalUrl),
        true,
        `Expected generic portal classification for ${portalUrl}`
      );

      const jobA = {
        id: 'gen-a',
        title: 'Senior Medical Officer (BS-18)',
        company: 'Provincial Health Dept',
        status: 'Approved',
        sourceUrl: 'https://health.example.pk/vacancies/case-101',
        originalApplyUrl: portalUrl
      };
      const jobB = {
        id: 'gen-b',
        title: 'Civil Structural Engineer',
        company: 'Provincial Works Dept',
        sourceUrl: 'https://works.example.pk/vacancies/case-202',
        applicationUrl: portalUrl
      };

      const arrayRes = detectJobDuplicate(jobB, [jobA]);
      assert.strictEqual(arrayRes.isDuplicate, false, `Generic apply URL ${portalUrl} must NOT trigger duplicate match`);
      assert.strictEqual(arrayRes.comparisonDetails.applyUrlMatch, false);

      const idxRes = detectJobDuplicate(jobB, new DuplicateIndex([jobA]));
      assert.strictEqual(idxRes.isDuplicate, false, `DuplicateIndex must NOT match generic apply URL ${portalUrl}`);
    }
  });

  await runTest('STEP-8.5-B-5 [Meaningful Query Parameters Preserved]: Distinguishing query parameters remain distinct while non-semantic tracking params are stripped', () => {
    const jobQuery1 = {
      id: 'q-1',
      title: 'Research Associate',
      company: 'Institute One',
      status: 'Approved',
      sourceUrl: 'https://portal.edu.pk/vacancy?jobId=101&utm_source=email',
      originalApplyUrl: 'https://apply.edu.pk/form?req=REQ-101&gh_src=LinkedIn'
    };
    const jobDifferentQuery = {
      id: 'q-2',
      title: 'Finance Controller',
      company: 'Institute Two',
      sourceUrl: 'https://portal.edu.pk/vacancy?jobId=202&utm_source=email',
      applicationUrl: 'https://apply.edu.pk/form?req=REQ-202&gh_src=LinkedIn'
    };
    const jobSameMeaningfulDifferentTracking = {
      id: 'q-3',
      title: 'Another Title',
      company: 'Aggregator Site',
      sourceUrl: 'https://aggregator.example.pk/post/999',
      applicationUrl: 'https://apply.edu.pk/form?req=REQ-101&fbclid=xyz987&gclid=abc123'
    };

    // Different meaningful query params -> NOT duplicate
    const diffArray = detectJobDuplicate(jobDifferentQuery, [jobQuery1]);
    assert.strictEqual(diffArray.isDuplicate, false);
    const diffIdx = detectJobDuplicate(jobDifferentQuery, new DuplicateIndex([jobQuery1]));
    assert.strictEqual(diffIdx.isDuplicate, false);

    // Same meaningful query params + different tracking params -> IS duplicate
    const sameArray = detectJobDuplicate(jobSameMeaningfulDifferentTracking, [jobQuery1]);
    assert.strictEqual(sameArray.isDuplicate, true);
    assert.strictEqual(sameArray.confidence, 100);
    assert.strictEqual(sameArray.comparisonDetails.applyUrlMatch, true);

    const sameIdx = detectJobDuplicate(jobSameMeaningfulDifferentTracking, new DuplicateIndex([jobQuery1]));
    assert.strictEqual(sameIdx.isDuplicate, true);
    assert.strictEqual(sameIdx.comparisonDetails.applyUrlMatch, true);
  });

  await runTest('STEP-8.5-B-6 [Missing, Empty, and Malformed URLs Safe]: Invalid, non-HTTP(S), empty, or malformed URL strings never produce false positives', () => {
    const invalidValues = [undefined, null, '', '   ', 'N/A', 'not-a-url', 'mailto:hr@acme.pk', 'javascript:void(0)', '#', 'http://'];

    for (const badVal of invalidValues) {
      assert.strictEqual(normalizeExactJobUrl(badVal), null);
    }

    const existingMalformed = {
      id: 'mal-1',
      title: 'Petroleum Geologist',
      company: 'Oil & Gas Co',
      status: 'Approved',
      sourceUrl: 'N/A',
      originalApplyUrl: 'mailto:careers@oilgas.pk',
      applicationUrl: '   '
    };
    const candidateMalformed = {
      id: 'mal-2',
      title: 'Hospital Pharmacist',
      company: 'City Medical Center',
      sourceUrl: 'N/A',
      originalApplyUrl: 'not-a-valid-url',
      applicationUrl: 'mailto:careers@oilgas.pk'
    };

    const arrayRes = detectJobDuplicate(candidateMalformed, [existingMalformed]);
    assert.strictEqual(arrayRes.isDuplicate, false);
    assert.strictEqual(arrayRes.comparisonDetails.sourceUrlMatch, false);
    assert.strictEqual(arrayRes.comparisonDetails.applyUrlMatch, false);

    const idxRes = detectJobDuplicate(candidateMalformed, new DuplicateIndex([existingMalformed]));
    assert.strictEqual(idxRes.isDuplicate, false);
  });

  await runTest('STEP-8.5-B-7 [Existing sourceJobId & Similarity Thresholds Preserved]: sourceJobId exact match and >= 65% title/company similarity continue working unchanged', () => {
    const existingById = {
      id: 'id-exist-1',
      title: 'Mechanical Engineer',
      company: 'Heavy Industries',
      status: 'Approved',
      sourceJobId: 'EXT-JOB-5541',
      sourceUrl: 'https://portal-a.example.pk/1'
    };
    const candById = {
      id: 'id-cand-1',
      title: 'Completely Renamed Role',
      company: 'Other Alias',
      sourceJobId: 'EXT-JOB-5541',
      sourceUrl: 'https://portal-b.example.pk/2'
    };

    const resIdArr = detectJobDuplicate(candById, [existingById]);
    assert.strictEqual(resIdArr.isDuplicate, true);
    assert.strictEqual(resIdArr.confidence, 100);
    assert.strictEqual(resIdArr.comparisonDetails.sourceJobIdMatch, true);

    const resIdIdx = detectJobDuplicate(candById, new DuplicateIndex([existingById]));
    assert.strictEqual(resIdIdx.isDuplicate, true);
    assert.strictEqual(resIdIdx.comparisonDetails.sourceJobIdMatch, true);

    // Title + Company similarity >= 65% threshold (45 + 30 + 10 = 85%) without matching URLs
    const existingSim = {
      id: 'sim-exist-1',
      title: 'Senior DevOps Engineer',
      company: 'Indus Digital Solutions',
      city: 'Lahore',
      status: 'Approved',
      sourceUrl: 'https://indus.example.pk/jobs/10'
    };
    const candSim = {
      id: 'sim-cand-1',
      title: 'Senior DevOps Engineer',
      company: 'Indus Digital Solutions',
      city: 'Lahore',
      sourceUrl: 'https://otherboard.example.pk/listing/888'
    };
    const resSimArr = detectJobDuplicate(candSim, [existingSim]);
    assert.strictEqual(resSimArr.isDuplicate, true);
    assert.strictEqual(resSimArr.confidence, 85);
    assert.strictEqual(resSimArr.comparisonDetails.sourceUrlMatch, false);
    assert.strictEqual(resSimArr.comparisonDetails.applyUrlMatch, false);

    // Below threshold (30% company-only match -> < 65% not duplicate)
    const candDiffTitle = {
      id: 'sim-cand-2',
      title: 'Chief Financial Officer',
      company: 'Indus Digital Solutions',
      city: 'Karachi',
      sourceUrl: 'https://otherboard.example.pk/listing/999'
    };
    const resBelow = detectJobDuplicate(candDiffTitle, [existingSim]);
    assert.strictEqual(resBelow.isDuplicate, false);
  });

  // --- STEP-8.5-C.1: CONSOLIDATED DUPLICATE LOOKUP & CROSS-COLLECTION ID SAFETY FIX TESTS ---
  await runTest('STEP-8.5-C.1-1 [Unbounded Exact Identifier Lookup Beyond 50 Results]: findDuplicateCandidates consumes cursor without silent 50-limit truncation', async () => {
    const targetDoc = { id: 'ext-deep-100', title: 'Senior Software Engineer', company: 'Deep Tech', sourceJobId: 'JOB-EXT-100', status: 'Approved' };
    const manyDocs = Array.from({ length: 60 }, (_, i) => ({
      id: `doc-${i}`,
      title: `Job Title ${i}`,
      company: 'Other Co',
      sourceJobId: `JOB-${i}`,
      status: 'Approved'
    }));
    manyDocs[55] = targetDoc;

    const mockCursor = (docs: any[]) => {
      let idx = 0;
      return {
        sort: function() { return this; },
        batchSize: function() { return this; },
        hasNext: async function() { return idx < docs.length; },
        next: async function() { return docs[idx++]; },
        toArray: async () => docs
      };
    };

    const mockColl = (docs: any[]) => ({
      find: () => mockCursor(docs)
    });

    const candidates = await JobRepository.findDuplicateCandidates(
      { sourceJobId: 'JOB-EXT-100', title: 'Senior Software Engineer', company: 'Deep Tech' },
      {
        isMongoConfiguredFn: () => true,
        getJobsCollectionFn: async () => mockColl(manyDocs),
        getPendingJobsCollectionFn: async () => mockColl([])
      }
    );

    assert.ok(candidates.some(c => c.id === 'ext-deep-100'), 'Must find record beyond index 50 without silent truncation');
  });

  await runTest('STEP-8.5-C.1-2 [Unbounded Content Candidate Lookup Beyond 35 Results]: findDuplicateCandidates consumes content match cursor without silent 35-limit truncation', async () => {
    const targetDoc = { id: 'content-deep-50', title: 'Principal Cloud Architect', company: 'Enterprise Corp', status: 'Approved' };
    const manyDocs = Array.from({ length: 45 }, (_, i) => ({
      id: `content-doc-${i}`,
      title: `Unrelated Title ${i}`,
      company: `Company ${i}`,
      status: 'Approved'
    }));
    manyDocs[40] = targetDoc;

    const mockCursor = (docs: any[]) => {
      let idx = 0;
      return {
        sort: function() { return this; },
        batchSize: function() { return this; },
        hasNext: async function() { return idx < docs.length; },
        next: async function() { return docs[idx++]; },
        toArray: async () => docs
      };
    };

    const mockColl = (docs: any[]) => ({
      find: () => mockCursor(docs)
    });

    const candidates = await JobRepository.findDuplicateCandidates(
      { title: 'Principal Cloud Architect', company: 'Enterprise Corp' },
      {
        isMongoConfiguredFn: () => true,
        getJobsCollectionFn: async () => mockColl(manyDocs),
        getPendingJobsCollectionFn: async () => mockColl([])
      }
    );

    assert.ok(candidates.some(c => c.id === 'content-deep-50'), 'Must find content match beyond index 35');
  });

  await runTest('STEP-8.5-C.1-3 [Full Cursor Consumption across Live and Pending Collections]: Both live and pending cursors are fully iterated via hasNext/next', async () => {
    let liveConsumed = 0;
    let pendingConsumed = 0;

    const mockCursor = (count: number, prefix: string) => {
      let idx = 0;
      const docs = Array.from({ length: count }, (_, i) => ({ id: `${prefix}-${i}`, title: 'Test', company: 'Test Co' }));
      return {
        sort: function() { return this; },
        batchSize: function() { return this; },
        hasNext: async function() {
          const has = idx < docs.length;
          if (has && prefix === 'live') liveConsumed++;
          if (has && prefix === 'pending') pendingConsumed++;
          return has;
        },
        next: async function() { return docs[idx++]; },
        toArray: async () => docs
      };
    };

    let liveCalls = 0;
    let pendingCalls = 0;
    const mockJobsColl = {
      find: () => {
        liveCalls++;
        return mockCursor(liveCalls === 1 ? 12 : 0, 'live');
      }
    };
    const mockPendingColl = {
      find: () => {
        pendingCalls++;
        return mockCursor(pendingCalls === 1 ? 8 : 0, 'pending');
      }
    };

    const candidates = await JobRepository.findDuplicateCandidates(
      { title: 'Test Job UniqueTokenXYZ', company: 'Test Co' },
      {
        isMongoConfiguredFn: () => true,
        getJobsCollectionFn: async () => mockJobsColl,
        getPendingJobsCollectionFn: async () => mockPendingColl
      }
    );

    assert.strictEqual(liveConsumed, 12);
    assert.strictEqual(pendingConsumed, 8);
    assert.strictEqual(candidates.length, 20);
  });

  await runTest('STEP-8.5-C.1-4 [Cursor/Database Error Rejection Fails Closed]: Lookup failure throws database error and prevents incomplete candidate merging', async () => {
    const failingColl = {
      find: () => ({
        sort: function() { return this; },
        batchSize: function() { return this; },
        hasNext: async function() { throw new Error('Simulated MongoDB cursor read timeout'); },
        next: async function() { return null; },
        toArray: async () => { throw new Error('Simulated MongoDB cursor read timeout'); }
      })
    };

    await assert.rejects(
      () =>
        JobRepository.findDuplicateCandidates(
          { title: 'Engineer', company: 'Tech' },
          {
            isMongoConfiguredFn: () => true,
            getJobsCollectionFn: async () => failingColl,
            getPendingJobsCollectionFn: async () => failingColl
          }
        ),
      /Simulated MongoDB cursor read timeout/
    );
  });

  await runTest('STEP-8.5-C.1-5 & 6 & 8 & 9 [Atomic ID Reservation, Concurrency Collision, Best-Effort Release & Retention]: persistScrapedAtomic uses scraper_job_id_registry, prevents cross-collection ID clashes, retries on collision, and releases unsuccessful claims', async () => {
    const registryStore = new Map<string, any>();
    const liveStore = new Map<string, any>();
    const pendingStore = new Map<string, any>();

    const mockRegistryColl = {
      insertOne: async (doc: any) => {
        if (registryStore.has(doc._id)) {
          const err: any = new Error('E11000 duplicate key error collection: scraper_job_id_registry index: _id_ dup key');
          err.code = 11000;
          throw err;
        }
        registryStore.set(doc._id, doc);
        return { acknowledged: true, insertedId: doc._id };
      },
      deleteOne: async (filter: any) => {
        const id = filter._id;
        const existed = registryStore.has(id);
        registryStore.delete(id);
        return { acknowledged: true, deletedCount: existed ? 1 : 0 };
      }
    };

    const mockJobsColl = {
      insertOne: async (doc: any) => {
        if (liveStore.has(doc.id)) {
          const err: any = new Error('Duplicate key on jobs');
          err.code = 11000;
          throw err;
        }
        liveStore.set(doc.id, doc);
        return { acknowledged: true, insertedId: doc.id };
      },
      findOne: async (q: any) => liveStore.get(q.id) || null
    };

    const mockPendingColl = {
      insertOne: async (doc: any) => {
        if (pendingStore.has(doc.id)) {
          const err: any = new Error('Duplicate key on pending');
          err.code = 11000;
          throw err;
        }
        pendingStore.set(doc.id, doc);
        return { acknowledged: true, insertedId: doc.id };
      },
      findOne: async (q: any) => pendingStore.get(q.id) || null
    };

    // Pre-claim an ID in pending to test cross-collection collision & release
    pendingStore.set('CLASH-ID', { id: 'CLASH-ID', title: 'Existing Pending' });

    const deps = {
      isMongoConfiguredFn: () => true,
      getJobsCollectionFn: async () => mockJobsColl,
      getPendingJobsCollectionFn: async () => mockPendingColl,
      getIdRegistryCollectionFn: async () => mockRegistryColl,
      maxRetries: 3
    };

    const saved = await (JobRepository as any).persistScrapedAtomic('live', {
      id: 'CLASH-ID',
      title: 'New Live Job',
      company: 'Corp'
    }, deps);

    assert.ok(saved);
    assert.notStrictEqual(saved.id, 'CLASH-ID', 'Must retry with fresh ID when ID exists in opposite collection');
    assert.ok(liveStore.has(saved.id));
    assert.ok(registryStore.has(saved.id), 'Successful reservation must remain recorded in registry');
    assert.strictEqual(registryStore.has('CLASH-ID'), false, 'Unsuccessful conflicting claim must be released best-effort');
  });

  await runTest('STEP-8.5-C.1-7 [Registry Connection Failure Fails Closed]: Registry write failure throws database error and performs no target insertion', async () => {
    const liveStore = new Map<string, any>();
    const mockRegistryColl = {
      insertOne: async () => {
        throw new Error('MongoDB network timeout writing to scraper_job_id_registry');
      },
      deleteOne: async () => ({ deletedCount: 0 })
    };
    const mockJobsColl = {
      insertOne: async (doc: any) => { liveStore.set(doc.id, doc); return { acknowledged: true, insertedId: doc.id }; },
      findOne: async () => null
    };

    await assert.rejects(
      () =>
        (JobRepository as any).persistScrapedAtomic('live', {
          id: 'FAIL-REG-ID',
          title: 'Unsaved Job',
          company: 'Co'
        }, {
          isMongoConfiguredFn: () => true,
          getJobsCollectionFn: async () => mockJobsColl,
          getPendingJobsCollectionFn: async () => ({ findOne: async () => null }),
          getIdRegistryCollectionFn: async () => mockRegistryColl,
          maxRetries: 1
        }),
      /MongoDB network timeout/
    );

    assert.strictEqual(liveStore.size, 0, 'No target insertion must occur when registry fails');
  });

  await runTest('STEP-8.5-C.3-1 [Deterministic Synchronization Barrier Concurrent Cross-Collection Reservation Race]: Two concurrent persistScrapedAtomic operations targeting opposite collections attempting the same ID ensure unique reservation and safe retry without duplicate cross-collection persistence', async () => {
    // Deterministic unit-level concurrency simulation, not a real production MongoDB integration test
    const registryStore = new Map<string, any>();
    const liveStore = new Map<string, any>();
    const pendingStore = new Map<string, any>();

    let barrierCount = 0;
    let releaseBarrier: (() => void) | null = null;
    const barrierPromise = new Promise<void>((resolve) => {
      releaseBarrier = resolve;
    });

    const mockRegistryColl = {
      insertOne: async (doc: any) => {
        // Deterministic synchronization barrier: both concurrent operations must reach reservation before either proceeds
        if (doc._id === 'DETERMINISTIC-RACE-ID') {
          barrierCount++;
          if (barrierCount === 2 && releaseBarrier) {
            releaseBarrier();
          } else {
            await barrierPromise;
          }
        }

        // Synchronous atomic check-and-insert with no await between checking and setting in shared map
        if (registryStore.has(doc._id)) {
          const err: any = new Error(
            `E11000 duplicate key error collection: scraper_job_id_registry index: _id_ dup key: { _id: "${doc._id}" }`
          );
          err.code = 11000;
          throw err;
        }
        registryStore.set(doc._id, doc);
        return { acknowledged: true, insertedId: doc._id };
      },
      deleteOne: async (filter: any) => {
        const id = filter._id;
        const existed = registryStore.has(id);
        registryStore.delete(id);
        return { acknowledged: true, deletedCount: existed ? 1 : 0 };
      }
    };

    const mockJobsColl = {
      insertOne: async (doc: any) => {
        if (liveStore.has(doc.id)) {
          const err: any = new Error('Duplicate key on jobs');
          err.code = 11000;
          throw err;
        }
        liveStore.set(doc.id, doc);
        return { acknowledged: true, insertedId: doc.id };
      },
      findOne: async (q: any) => liveStore.get(q.id) || null
    };

    const mockPendingColl = {
      insertOne: async (doc: any) => {
        if (pendingStore.has(doc.id)) {
          const err: any = new Error('Duplicate key on pending');
          err.code = 11000;
          throw err;
        }
        pendingStore.set(doc.id, doc);
        return { acknowledged: true, insertedId: doc.id };
      },
      findOne: async (q: any) => pendingStore.get(q.id) || null
    };

    const deps = {
      isMongoConfiguredFn: () => true,
      getJobsCollectionFn: async () => mockJobsColl,
      getPendingJobsCollectionFn: async () => mockPendingColl,
      getIdRegistryCollectionFn: async () => mockRegistryColl,
      maxRetries: 5
    };

    const [res1, res2] = await Promise.all([
      (JobRepository as any).persistScrapedAtomic('live', { id: 'DETERMINISTIC-RACE-ID', title: 'Live Race', company: 'Co' }, deps),
      (JobRepository as any).persistScrapedAtomic('pending', { id: 'DETERMINISTIC-RACE-ID', title: 'Pending Race', company: 'Co' }, deps)
    ]);

    assert.ok(res1);
    assert.ok(res2);
    assert.notStrictEqual(res1.id, res2.id, 'Both operations must have different final IDs');

    // The original ID is assigned to exactly one successful record across both collections
    const liveHasOriginal = liveStore.has('DETERMINISTIC-RACE-ID');
    const pendingHasOriginal = pendingStore.has('DETERMINISTIC-RACE-ID');
    assert.strictEqual(
      (liveHasOriginal ? 1 : 0) + (pendingHasOriginal ? 1 : 0),
      1,
      'The original ID must be assigned to exactly one successful record'
    );
    assert.strictEqual(liveHasOriginal && pendingHasOriginal, false, 'The original ID must not be present in both collections');

    // Every successfully persisted final ID exists in the registry
    assert.strictEqual(registryStore.has(res1.id), true, 'First final ID must exist in registry');
    assert.strictEqual(registryStore.has(res2.id), true, 'Second final ID must exist in registry');

    // No registry ID is assigned to two different persisted records
    assert.strictEqual(liveStore.has(res2.id), false, 'Second ID must not exist in liveStore');
    assert.strictEqual(pendingStore.has(res1.id), false, 'First ID must not exist in pendingStore');

    // Total persisted count across collections matches expected
    assert.strictEqual(liveStore.size, 1);
    assert.strictEqual(pendingStore.size, 1);
    assert.strictEqual(registryStore.size, 2);
  });

  await runTest('STEP-8.5-C.3-2 [Real 5,000 Safety Threshold Boundary & Incremental Consumed Count Enforcement]: findDuplicateCandidates stops at threshold+1 and closes cursor on overflow', async () => {
    let consumedCount = 0;
    let cursorClosed = false;
    const TOTAL_MOCK_DOCS = 6000;

    const mockCursor = {
      sort: function() { return this; },
      batchSize: function() { return this; },
      hasNext: async function() { return consumedCount < TOTAL_MOCK_DOCS; },
      next: async function() {
        if (consumedCount >= TOTAL_MOCK_DOCS) return null;
        consumedCount++;
        return {
          id: `oversize-doc-${consumedCount}`,
          title: `Oversize Title ${consumedCount}`,
          company: 'Scale Corp'
        };
      },
      close: async function() {
        cursorClosed = true;
      }
    };

    const mockColl = {
      find: () => mockCursor
    };

    let caughtErr: any = null;
    try {
      await JobRepository.findDuplicateCandidates(
        { sourceJobId: 'ANY-SRC-ID', title: 'Any Title', company: 'Scale Corp' },
        {
          isMongoConfiguredFn: () => true,
          getJobsCollectionFn: async () => mockColl,
          getPendingJobsCollectionFn: async () => ({ find: () => ({ hasNext: async () => false, next: async () => null, close: async () => {} }) })
        }
      );
    } catch (err: any) {
      caughtErr = err;
    }

    assert.ok(caughtErr, 'Must throw error when candidate safety threshold (5000) is exceeded');
    assert.strictEqual(caughtErr.name, 'MongoDuplicateSafetyThresholdExceeded');
    assert.strictEqual(caughtErr.isDatabaseError, true);
    assert.strictEqual(cursorClosed, true, 'Cursor must be closed in finally upon threshold overflow');
    // Processing stops at the first document exceeding 5,000 candidates (5,001), not consuming the whole 6,000 result
    assert.strictEqual(consumedCount, 5001, 'Cursor consumption must stop immediately at threshold+1 (5001) without reading remaining records');
  });

  await runTest('STEP-8.5-C.3-3 [Exactly 5,000 Unique Candidates Permitted & Duplicate IDs Do Not Inflate Count]: 5,000 unique candidates pass and duplicate IDs do not count toward threshold', async () => {
    // 1. Exactly 5,000 unique candidates
    let count5k = 0;
    const mockCursor5k = {
      sort: function() { return this; },
      batchSize: function() { return this; },
      hasNext: async function() { return count5k < 5000; },
      next: async function() {
        if (count5k >= 5000) return null;
        count5k++;
        return {
          id: `exact-5k-doc-${count5k}`,
          title: `Title ${count5k}`,
          company: 'Boundary Co'
        };
      },
      close: async function() {}
    };

    const res5k = await JobRepository.findDuplicateCandidates(
      { sourceJobId: 'EXACT-5K', title: 'Boundary Title', company: 'Boundary Co' },
      {
        isMongoConfiguredFn: () => true,
        getJobsCollectionFn: async () => ({ find: () => mockCursor5k }),
        getPendingJobsCollectionFn: async () => ({ find: () => ({ hasNext: async () => false, next: async () => null, close: async () => {} }) })
      }
    );
    assert.strictEqual(res5k.length, 5000, 'Exactly 5,000 unique candidates must be permitted without throwing');

    // 2. 10,000 documents with only 100 unique IDs do not trigger threshold
    let count10k = 0;
    const mockCursorDups = {
      sort: function() { return this; },
      batchSize: function() { return this; },
      hasNext: async function() { return count10k < 10000; },
      next: async function() {
        if (count10k >= 10000) return null;
        count10k++;
        const uniqueId = `dup-id-${count10k % 100}`;
        return {
          id: uniqueId,
          title: `Duplicate Document ${count10k}`,
          company: 'Dups Co'
        };
      },
      close: async function() {}
    };

    const resDups = await JobRepository.findDuplicateCandidates(
      { sourceJobId: 'MANY-DUPS', title: 'Dups Title', company: 'Dups Co' },
      {
        isMongoConfiguredFn: () => true,
        getJobsCollectionFn: async () => ({ find: () => mockCursorDups }),
        getPendingJobsCollectionFn: async () => ({ find: () => ({ hasNext: async () => false, next: async () => null, close: async () => {} }) })
      }
    );
    assert.strictEqual(resDups.length, 100, 'Duplicate IDs must not inflate candidate count beyond true unique records');
  });

  await runTest('STEP-8.5-C.3-4 [Fallback Capped limit(5001) + toArray() and toArray()-Only Fail-Closed Rejection]: limit(5001) rejects overflow and toArray()-only cursor fails closed', async () => {
    // 1. limit() + toArray() fallback rejects overflow when 5,001 documents returned
    let appliedLimit: number | null = null;
    let fallbackClosed = false;
    const mockLimitCursorOverflow = {
      limit: (n: number) => {
        appliedLimit = n;
        return {
          close: async () => { fallbackClosed = true; },
          toArray: async () => Array.from({ length: 5001 }, (_, i) => ({ id: `lim-ov-${i}`, title: `T ${i}` }))
        };
      }
    };

    await assert.rejects(
      () =>
        JobRepository.findDuplicateCandidates(
          { sourceJobId: 'LIM-OV', title: 'T', company: 'C' },
          {
            isMongoConfiguredFn: () => true,
            getJobsCollectionFn: async () => ({ find: () => mockLimitCursorOverflow }),
            getPendingJobsCollectionFn: async () => ({ find: () => ({ hasNext: async () => false, next: async () => null, close: async () => {} }) })
          }
        ),
      (err: any) => {
        assert.strictEqual(err.name, 'MongoDuplicateSafetyThresholdExceeded');
        return true;
      }
    );
    assert.strictEqual(appliedLimit, 5001, 'Fallback limit() must be capped at MAX_CANDIDATE_SAFETY_THRESHOLD + 1 (5001)');
    assert.strictEqual(fallbackClosed, true, 'Limited cursor must be closed in finally');

    // 2. toArray()-only cursor without incremental iteration or limit() fails closed without calling toArray()
    let toArrayCalled = false;
    const mockUnboundedToArrayCursor = {
      toArray: async () => {
        toArrayCalled = true;
        return [];
      }
    };

    await assert.rejects(
      () =>
        JobRepository.findDuplicateCandidates(
          { sourceJobId: 'UNBOUNDED', title: 'T', company: 'C' },
          {
            isMongoConfiguredFn: () => true,
            getJobsCollectionFn: async () => ({ find: () => mockUnboundedToArrayCursor }),
            getPendingJobsCollectionFn: async () => ({ find: () => ({ hasNext: async () => false, next: async () => null, close: async () => {} }) })
          }
        ),
      (err: any) => {
        assert.strictEqual(err.name, 'MongoDuplicateUnsupportedCursorError');
        return true;
      }
    );
    assert.strictEqual(toArrayCalled, false, 'Unbounded toArray() must NEVER be called on an unlimitable, non-iterable cursor');
  });

  await runTest('STEP-8.5-C.3-5 [Reservation Error Lifecycle Safety & Ambiguous Write Retention]: Verified across confirmed conflicts, duplicate-key rejections, timeouts, and unacknowledged writes', async () => {
    // 1. Ambiguous write timeout retains reservation in registry
    const registryStore = new Map<string, any>();
    const mockRegistryColl = {
      insertOne: async (doc: any) => {
        registryStore.set(doc._id, doc);
        return { acknowledged: true, insertedId: doc._id };
      },
      deleteOne: async (filter: any) => {
        registryStore.delete(filter._id);
        return { acknowledged: true, deletedCount: 1 };
      }
    };

    await assert.rejects(
      () =>
        (JobRepository as any).persistScrapedAtomic('live', {
          id: 'TIMEOUT-ID',
          title: 'Timeout Job',
          company: 'Co'
        }, {
          isMongoConfiguredFn: () => true,
          getJobsCollectionFn: async () => ({
            insertOne: async () => { throw new Error('Simulated write timeout after dispatch'); },
            findOne: async () => null
          }),
          getPendingJobsCollectionFn: async () => ({ findOne: async () => null }),
          getIdRegistryCollectionFn: async () => mockRegistryColl,
          maxRetries: 0
        }),
      /Simulated write timeout/
    );
    assert.strictEqual(registryStore.has('TIMEOUT-ID'), true, 'Ambiguous write timeout MUST retain registry reservation');

    // 2. Unacknowledged write retains reservation in registry
    await assert.rejects(
      () =>
        (JobRepository as any).persistScrapedAtomic('live', {
          id: 'UNACK-ID',
          title: 'Unacked Job',
          company: 'Co'
        }, {
          isMongoConfiguredFn: () => true,
          getJobsCollectionFn: async () => ({
            insertOne: async () => ({ acknowledged: false }),
            findOne: async () => null
          }),
          getPendingJobsCollectionFn: async () => ({ findOne: async () => null }),
          getIdRegistryCollectionFn: async () => mockRegistryColl,
          maxRetries: 0
        }),
      /could not be confirmed/
    );
    assert.strictEqual(registryStore.has('UNACK-ID'), true, 'Unacknowledged write MUST retain registry reservation');

    // 3. Opposite collection read failure retains reservation in registry
    await assert.rejects(
      () =>
        (JobRepository as any).persistScrapedAtomic('live', {
          id: 'READ-FAIL-ID',
          title: 'Read Fail Job',
          company: 'Co'
        }, {
          isMongoConfiguredFn: () => true,
          getJobsCollectionFn: async () => ({ insertOne: async () => ({ acknowledged: true, insertedId: 'x' }), findOne: async () => null }),
          getPendingJobsCollectionFn: async () => ({
            findOne: async () => { throw new Error('Simulated opposite collection read error'); }
          }),
          getIdRegistryCollectionFn: async () => mockRegistryColl,
          maxRetries: 0
        }),
      /Opposite collection check failed/
    );
    assert.strictEqual(registryStore.has('READ-FAIL-ID'), true, 'Opposite collection read error MUST retain registry reservation');

    // 4. Confirmed target insert duplicate key rejection releases reservation and retries cleanly
    const liveStore = new Map<string, any>();
    liveStore.set('COLLIDE-KEY-ID', { id: 'COLLIDE-KEY-ID', title: 'Pre-existing' });

    const retrySaved = await (JobRepository as any).persistScrapedAtomic('live', {
      id: 'COLLIDE-KEY-ID',
      title: 'Retry Target Job',
      company: 'Co'
    }, {
      isMongoConfiguredFn: () => true,
      getJobsCollectionFn: async () => ({
        insertOne: async (doc: any) => {
          if (doc.id === 'COLLIDE-KEY-ID') {
            const err: any = new Error('E11000 duplicate key error');
            err.code = 11000;
            throw err;
          }
          liveStore.set(doc.id, doc);
          return { acknowledged: true, insertedId: doc.id };
        },
        findOne: async () => null
      }),
      getPendingJobsCollectionFn: async () => ({ findOne: async () => null }),
      getIdRegistryCollectionFn: async () => mockRegistryColl,
      maxRetries: 2
    });

    assert.ok(retrySaved);
    assert.notStrictEqual(retrySaved.id, 'COLLIDE-KEY-ID', 'Must assign fresh unique ID after duplicate key collision');
    assert.strictEqual(registryStore.has('COLLIDE-KEY-ID'), false, 'Confirmed target duplicate-key rejection must release original claim');
    assert.strictEqual(registryStore.has(retrySaved.id), true, 'Fresh retry ID must retain reservation');
  });

  await runTest('STEP-8.5-C.2-3 [Incremental Cursor & Safety Threshold Enforcement]: consumeCursor enforces safety threshold during incremental iteration and closes cursor', async () => {
    let closedCalled = false;
    const docs = Array.from({ length: 15 }, (_, i) => ({ id: `doc-${i}`, title: `Title ${i}` }));
    let idx = 0;
    const mockCursor = {
      sort: function() { return this; },
      batchSize: function() { return this; },
      hasNext: async function() { return idx < docs.length; },
      next: async function() { return docs[idx++]; },
      close: async function() { closedCalled = true; }
    };

    const mockColl = {
      find: () => mockCursor
    };

    const candidates = await JobRepository.findDuplicateCandidates(
      { sourceJobId: 'NON-EXISTENT', title: 'Test', company: 'Co' },
      {
        isMongoConfiguredFn: () => true,
        getJobsCollectionFn: async () => mockColl,
        getPendingJobsCollectionFn: async () => ({ find: () => ({ hasNext: async () => false, next: async () => null, close: async () => {} }) })
      }
    );

    assert.strictEqual(candidates.length, 15);
    assert.strictEqual(closedCalled, true, 'Cursor must be closed on completion');
  });

  await runTest('STEP-8.5-C.1-10 [Preservation of STEP-8.5-A, B, B.1 Behaviors]: URL normalization, protocol preservation, query ordering and generic portal protection remain intact', () => {
    const norm = normalizeExactJobUrl('https://Careers.Example.COM:443/jobs/1?tag=b&tag=a&utm_source=feed#top');
    assert.strictEqual(norm, 'https://careers.example.com/jobs/1?tag=b&tag=a');
    assert.strictEqual(isGenericApplicationPortalUrl('https://example.com/apply'), true);
  });

  await runTest('STEP-8.5-C.4 [Unreachable Test Registry Fallback Removed & Fail-Closed MongoDB Gate]: persistScrapedAtomic resolves real MongoDB scraper_job_id_registry, fails closed when unconfigured or connection unavailable, and supports explicitly injected test registry', async () => {
    // 1. Verify obsolete symbols are not present or exported
    assert.strictEqual((JobRepository as any).testRegistryStore, undefined, 'testRegistryStore must be removed');
    assert.strictEqual((JobRepository as any).getTestIdRegistryCollection, undefined, 'getTestIdRegistryCollection must be removed');

    // 2. Unconfigured MongoDB must throw immediately and NEVER reach registry collection resolution
    let registryAcquisitionAttempted = false;
    await assert.rejects(
      () =>
        (JobRepository as any).persistScrapedAtomic(
          'live',
          { id: 'unconfigured-test-1', title: 'Test', company: 'Co' },
          {
            isMongoConfiguredFn: () => false,
            getIdRegistryCollectionFn: async () => {
              registryAcquisitionAttempted = true;
              return createMockRegistryColl();
            }
          }
        ),
      /Database Configuration Error: MONGODB_URI environment variable is not defined or invalid/
    );
    assert.strictEqual(registryAcquisitionAttempted, false, 'Unconfigured MongoDB must fail closed before registry acquisition');

    // 3. Without injected test registry, default path strictly queries getMongoDb() and fails closed when MongoDB is unavailable
    await assert.rejects(
      () =>
        (JobRepository as any).persistScrapedAtomic(
          'live',
          { id: 'prod-resolution-test-1', title: 'Test', company: 'Co' },
          {
            isMongoConfiguredFn: () => true,
            getJobsCollectionFn: async () => ({ insertOne: async () => ({ acknowledged: true, insertedId: '1' }) })
          }
        ),
      (err: any) =>
        err !== null &&
        (err.message.includes('MongoDB') ||
          err.message.includes('connect') ||
          err.message.includes('MONGODB_URI') ||
          err.name === 'MongoServerSelectionError' ||
          err.name === 'MongoNetworkError')
    );

    // 4. Explicit test registry dependency injection functions correctly without any hidden in-memory fallback
    let customRegistryCalled = false;
    const customColl = createMockRegistryColl();
    const res = await (JobRepository as any).persistScrapedAtomic(
      'live',
      {
        id: 'explicit-injected-reg-1',
        title: 'Injected Registry Job',
        company: 'Test Org'
      },
      {
        isMongoConfiguredFn: () => true,
        getIdRegistryCollectionFn: async () => {
          customRegistryCalled = true;
          return customColl;
        },
        getJobsCollectionFn: async () => ({
          insertOne: async (doc: any) => ({ acknowledged: true, insertedId: `oid-${doc.id}` })
        }),
        getPendingJobsCollectionFn: async () => ({
          findOne: async () => null
        })
      }
    );
    assert.strictEqual(customRegistryCalled, true, 'Explicitly injected getIdRegistryCollectionFn must be invoked');
    assert.strictEqual(res.id, 'explicit-injected-reg-1');
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
