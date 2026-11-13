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
  processBackupImportJson
} from '../../src/components/admin/AdminDataBackupHub';
import {
  executeFeeConfigSave
} from '../../src/components/admin/AdminFeeManager';
import { DEFAULT_LANDING_PAGE_CONFIG } from '../../src/types/landing';

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
