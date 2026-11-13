import assert from 'assert';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

process.env.MONGODB_URI = '';
process.env.MONGO_URI = '';
process.env.IS_TEST = 'true';
process.env.NODE_ENV = 'test';

import { formatChatUserRoleLabel } from '../../src/components/AdminDashboard';
import {
  AdminFeeManager,
  normalizeFeeSearchText,
  normalizeFeeEmail,
  isUserEmailExempt,
  toggleExemptEmailList,
  filterFeeManagerUsers,
  applyGlobalFreeToggleToCategories
} from '../../src/components/admin/AdminFeeManager';
import {
  AdminEmployerKycHub,
  safeKycText,
  getKycCompanyInitial,
  getSafeKycRequests,
  getKycStatusCounts,
  applyKycRequestUpdate,
  filterEmployerKycRequests
} from '../../src/components/admin/AdminEmployerKycHub';
import { DEFAULT_CATEGORY_POSTING_FEES } from '../../src/types/landing';
import { UserAccount } from '../../src/types/job';
import { EmployerKycRequest } from '../../src/types/adminSuite';

interface TestCounts {
  passed: number;
  failed: number;
  skipped: number;
}

function runSuite() {
  console.log('==================================================================');
  console.log('   STEP-07-01: ADMIN PANEL RUNTIME CRASH SAFETY REGRESSION SUITE  ');
  console.log('==================================================================');

  const counts: TestCounts = {
    passed: 0,
    failed: 0,
    skipped: 0
  };

  const runTest = (name: string, fn: () => void) => {
    try {
      fn();
      counts.passed++;
      console.log(`✓ Passed: ${name}`);
    } catch (err: any) {
      counts.failed++;
      console.error(`✗ Failed: ${name}`);
      console.error(`  Error: ${err?.stack || err?.message || err}`);
    }
  };

  // --- 1. CHAT HUB ROLE SPLIT SAFETY ---
  runTest('Chat Hub: handles undefined, null, empty, whitespace, and non-string roles safely', () => {
    assert.strictEqual(formatChatUserRoleLabel(undefined), 'Member');
    assert.strictEqual(formatChatUserRoleLabel(null), 'Member');
    assert.strictEqual(formatChatUserRoleLabel(''), 'Member');
    assert.strictEqual(formatChatUserRoleLabel('    '), 'Member');
    assert.strictEqual(formatChatUserRoleLabel(123 as any), 'Member');
    assert.strictEqual(formatChatUserRoleLabel({} as any), 'Member');
  });

  runTest('Chat Hub: preserves existing first-word role display for valid roles', () => {
    assert.strictEqual(formatChatUserRoleLabel('Job Seeker'), 'Job');
    assert.strictEqual(formatChatUserRoleLabel('Employer'), 'Employer');
    assert.strictEqual(formatChatUserRoleLabel('Super Admin'), 'Super');
    assert.strictEqual(formatChatUserRoleLabel('  Payment   Manager  '), 'Payment');
  });

  // --- 2. CATEGORY FEES / FREE EXEMPTIONS STRING & SEARCH SAFETY ---
  const legacyMixedUsers = [
    {
      id: 'u-valid-1',
      name: 'Ayesha Khan',
      email: 'Ayesha.Khan@TechCorp.pk',
      companyName: 'TechCorp Pakistan',
      role: 'Employer',
      plan: 'Free'
    },
    {
      id: 'u-legacy-missing-all',
      name: undefined as any,
      email: null as any,
      companyName: undefined as any,
      role: undefined as any,
      plan: undefined as any
    },
    {
      id: 'u-legacy-email-only',
      name: null as any,
      email: 'ops@legacyfirm.com',
      companyName: '',
      role: 'Employer',
      plan: 'Premium'
    },
    null as any
  ] as UserAccount[];

  runTest('Fee Manager: normalizeFeeSearchText and normalizeFeeEmail safely handle nullish/non-string inputs', () => {
    assert.strictEqual(normalizeFeeSearchText(undefined), '');
    assert.strictEqual(normalizeFeeSearchText(null), '');
    assert.strictEqual(normalizeFeeSearchText(42), '');
    assert.strictEqual(normalizeFeeSearchText('  Tech Corp  '), 'tech corp');
    assert.strictEqual(normalizeFeeEmail('  VIP@Example.COM '), 'vip@example.com');
    assert.strictEqual(normalizeFeeEmail(null), '');
  });

  runTest('Fee Manager: filterFeeManagerUsers does not crash when user name/email/companyName are null or undefined', () => {
    const allUsers = filterFeeManagerUsers(legacyMixedUsers, '');
    assert.strictEqual(allUsers.length, 3);

    const byName = filterFeeManagerUsers(legacyMixedUsers, 'ayesha');
    assert.strictEqual(byName.length, 1);
    assert.strictEqual(byName[0].id, 'u-valid-1');

    const byCompany = filterFeeManagerUsers(legacyMixedUsers, 'techcorp pakistan');
    assert.strictEqual(byCompany.length, 1);
    assert.strictEqual(byCompany[0].id, 'u-valid-1');

    const byEmail = filterFeeManagerUsers(legacyMixedUsers, 'legacyfirm.com');
    assert.strictEqual(byEmail.length, 1);
    assert.strictEqual(byEmail[0].id, 'u-legacy-email-only');

    const noMatches = filterFeeManagerUsers(legacyMixedUsers, 'nonexistent-query');
    assert.strictEqual(noMatches.length, 0);
  });

  runTest('Fee Manager: exempt email check handles missing user email and dirty exemptUserEmails arrays safely', () => {
    const dirtyExemptList: any[] = [null, undefined, '', '  AYESHA.KHAN@techcorp.pk ', 'vip@partner.pk'];
    assert.strictEqual(isUserEmailExempt(undefined, dirtyExemptList), false);
    assert.strictEqual(isUserEmailExempt(null, dirtyExemptList), false);
    assert.strictEqual(isUserEmailExempt('', dirtyExemptList), false);
    assert.strictEqual(isUserEmailExempt('ayesha.khan@techcorp.pk', dirtyExemptList), true);
    assert.strictEqual(isUserEmailExempt('  VIP@Partner.PK ', dirtyExemptList), true);
    assert.strictEqual(isUserEmailExempt('other@company.pk', dirtyExemptList), false);
  });

  runTest('Fee Manager: toggleExemptEmailList grants, revokes, and ignores missing/blank emails safely', () => {
    const initial: any[] = ['  Boss@Corp.PK ', null, undefined, ''];
    const afterInvalid = toggleExemptEmailList(initial, undefined);
    assert.deepStrictEqual(afterInvalid, ['boss@corp.pk']);

    const afterGrant = toggleExemptEmailList(afterInvalid, ' New@Employer.PK ');
    assert.deepStrictEqual(afterGrant, ['boss@corp.pk', 'new@employer.pk']);

    const afterRevoke = toggleExemptEmailList(afterGrant, 'BOSS@corp.pk');
    assert.deepStrictEqual(afterRevoke, ['new@employer.pk']);
  });

  runTest('Fee Manager: 100% Free toggle preserves existing category fees & cat-govt/cat-news defaults', () => {
    const enabled = applyGlobalFreeToggleToCategories(DEFAULT_CATEGORY_POSTING_FEES, true);
    assert.ok(enabled.length === DEFAULT_CATEGORY_POSTING_FEES.length);
    assert.ok(enabled.every((c) => c.isFree === true));

    const disabled = applyGlobalFreeToggleToCategories(enabled, false);
    for (const cat of disabled) {
      const original = DEFAULT_CATEGORY_POSTING_FEES.find((o) => o.categoryId === cat.categoryId)!;
      assert.strictEqual(cat.feePkr, original.feePkr);
      if (cat.categoryId === 'cat-govt' || cat.categoryId === 'cat-news') {
        assert.strictEqual(cat.isFree, true);
      } else {
        assert.strictEqual(cat.isFree, false);
      }
    }
  });

  runTest('Fee Manager: SSR component render succeeds with incomplete legacy user & landingConfig records', () => {
    const html = renderToStaticMarkup(
      React.createElement(AdminFeeManager, {
        users: legacyMixedUsers,
        landingConfig: {
          exemptUserEmails: [null as any, 'ops@legacyfirm.com', '  Admin@TEST.pk '],
          categoryPostingFees: DEFAULT_CATEGORY_POSTING_FEES
        } as any
      })
    );
    assert.ok(html.includes('Dynamic Job Posting Fees'));
    assert.ok(html.includes('Employer 100% Free Waivers (2)'));
  });

  // --- 3. EMPLOYER KYC SEARCH & LEGACY FIELD SAFETY ---
  const legacyKycRecords = [
    {
      id: 'kyc-complete-1',
      companyName: 'Lahore Cloud Systems',
      contactPerson: 'Bilal Ahmed',
      email: 'bilal@lahorecloud.pk',
      phone: '+92-300-1112233',
      ntnOrTaxNumber: 'NTN-998877',
      secpRegistrationNumber: 'SECP-123',
      companyWebsite: 'https://lahorecloud.pk',
      status: 'Pending',
      submittedAt: '2025-01-10'
    },
    {
      id: 'kyc-legacy-incomplete-2',
      companyName: undefined as any,
      contactPerson: null as any,
      email: undefined as any,
      phone: undefined as any,
      ntnOrTaxNumber: null as any,
      status: 'Pending',
      submittedAt: undefined as any
    },
    {
      id: 'kyc-legacy-partial-3',
      companyName: 'karachi logistics',
      contactPerson: undefined as any,
      email: 'kyc@karachilogistics.pk',
      phone: '',
      ntnOrTaxNumber: 'TAX-4455',
      status: 'Verified',
      badgeLevel: 'Standard Verified',
      submittedAt: '2025-02-01'
    },
    null as any
  ] as EmployerKycRequest[];

  runTest('KYC Hub: safeKycText and getKycCompanyInitial handle missing/null company names safely', () => {
    assert.strictEqual(safeKycText(undefined), '');
    assert.strictEqual(safeKycText(null), '');
    assert.strictEqual(getKycCompanyInitial(undefined), 'C');
    assert.strictEqual(getKycCompanyInitial(null), 'C');
    assert.strictEqual(getKycCompanyInitial('   '), 'C');
    assert.strictEqual(getKycCompanyInitial('karachi logistics'), 'K');
  });

  runTest('KYC Hub: filterEmployerKycRequests safely searches incomplete legacy records across all fields & status tabs', () => {
    const all = filterEmployerKycRequests(legacyKycRecords, 'All', '');
    assert.strictEqual(all.length, 3);

    const byCompany = filterEmployerKycRequests(legacyKycRecords, 'All', 'lahore');
    assert.strictEqual(byCompany.length, 1);
    assert.strictEqual(byCompany[0].id, 'kyc-complete-1');

    const byContact = filterEmployerKycRequests(legacyKycRecords, 'Pending', 'bilal');
    assert.strictEqual(byContact.length, 1);
    assert.strictEqual(byContact[0].id, 'kyc-complete-1');

    const byNtnVerified = filterEmployerKycRequests(legacyKycRecords, 'Verified', '4455');
    assert.strictEqual(byNtnVerified.length, 1);
    assert.strictEqual(byNtnVerified[0].id, 'kyc-legacy-partial-3');

    const byEmail = filterEmployerKycRequests(legacyKycRecords, 'All', 'karachilogistics.pk');
    assert.strictEqual(byEmail.length, 1);
    assert.strictEqual(byEmail[0].id, 'kyc-legacy-partial-3');

    const pendingMiss = filterEmployerKycRequests(legacyKycRecords, 'Rejected', 'anything');
    assert.strictEqual(pendingMiss.length, 0);
  });

  runTest('KYC Hub: getSafeKycRequests excludes null, undefined, and non-object entries from response array without rewriting incomplete records', () => {
    const dirtyResponse = [
      null,
      legacyKycRecords[0],
      undefined,
      [] as any,
      'invalid-string' as any,
      legacyKycRecords[1],
      legacyKycRecords[2]
    ];
    const safe = getSafeKycRequests(dirtyResponse);
    assert.strictEqual(safe.length, 3);
    assert.strictEqual(safe[0].id, 'kyc-complete-1');
    assert.strictEqual(safe[1].id, 'kyc-legacy-incomplete-2');
    assert.strictEqual(safe[2].id, 'kyc-legacy-partial-3');
    assert.strictEqual(getSafeKycRequests(undefined).length, 0);
    assert.strictEqual(getSafeKycRequests(null).length, 0);
  });

  runTest('KYC Hub: Pending and Verified counters handle null entries and incomplete records safely', () => {
    const mixedWithStatusEdgeCases = [
      null,
      undefined,
      legacyKycRecords[0], // Pending
      legacyKycRecords[1], // Pending (incomplete fields)
      legacyKycRecords[2], // Verified
      { id: 'kyc-no-status-4', companyName: 'Legacy Draft' } as any,
      { id: 'kyc-rejected-5', status: 'Rejected' } as any
    ];
    const countsResult = getKycStatusCounts(mixedWithStatusEdgeCases);
    assert.strictEqual(countsResult.total, 5);
    assert.strictEqual(countsResult.pending, 2);
    assert.strictEqual(countsResult.verified, 1);
    assert.strictEqual(countsResult.rejected, 1);
  });

  runTest('KYC Hub: search, filtering, and approve/reject state updates work cleanly with valid records mixed with null entries', () => {
    const mixed = [null, legacyKycRecords[0], undefined, legacyKycRecords[1], legacyKycRecords[2]];
    const approvedRecord: EmployerKycRequest = {
      ...legacyKycRecords[0],
      status: 'Verified',
      badgeLevel: 'Top Employer'
    };
    const afterApprove = applyKycRequestUpdate(mixed, 'kyc-complete-1', approvedRecord);
    assert.strictEqual(afterApprove.length, 3);
    assert.strictEqual(afterApprove[0].status, 'Verified');
    assert.strictEqual(afterApprove[0].badgeLevel, 'Top Employer');
    assert.strictEqual(getKycStatusCounts(afterApprove).pending, 1);
    assert.strictEqual(getKycStatusCounts(afterApprove).verified, 2);

    const rejectedRecord: EmployerKycRequest = {
      ...legacyKycRecords[1],
      status: 'Rejected',
      rejectionReason: 'Incomplete tax ID'
    };
    const afterReject = applyKycRequestUpdate([...afterApprove, null], 'kyc-legacy-incomplete-2', rejectedRecord);
    assert.strictEqual(afterReject.length, 3);
    assert.strictEqual(getKycStatusCounts(afterReject).pending, 0);
    assert.strictEqual(getKycStatusCounts(afterReject).rejected, 1);
    assert.strictEqual(filterEmployerKycRequests(afterReject, 'Verified', 'lahore').length, 1);
    assert.strictEqual(filterEmployerKycRequests(afterReject, 'Rejected', '').length, 1);
  });

  runTest('KYC Hub: SSR render path initializes cleanly without crashing', () => {
    const html = renderToStaticMarkup(React.createElement(AdminEmployerKycHub));
    assert.ok(html.length > 0);
  });

  console.log('------------------------------------------------------------------');
  console.log(`Summary: Passed=${counts.passed}, Failed=${counts.failed}, Skipped=${counts.skipped}`);
  console.log('==================================================================');

  if (counts.failed > 0) {
    process.exit(1);
  }
}

runSuite();
