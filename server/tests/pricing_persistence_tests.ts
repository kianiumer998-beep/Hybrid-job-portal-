import assert from 'assert';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import express from 'express';
import { createServer, Server } from 'http';

process.env.IS_TEST = 'true';
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = '';
process.env.MONGO_URI = '';

import { PricingRepository } from '../db/repositories/PricingRepository';
import { AuditRepository } from '../db/repositories/AuditRepository';
import { UserRepository } from '../db/repositories/UserRepository';
import { pricingRouter } from '../routes/pricingRoutes';
import { authMiddleware, createToken } from '../auth/authManager';
import {
  resolveRestoredStandardFee,
  executeCompleteFeeConfigSave,
  applyGlobalFreeToggleToCategories
} from '../../src/components/admin/AdminFeeManager';
import { DEFAULT_LANDING_PAGE_CONFIG, DEFAULT_CATEGORY_POSTING_FEES } from '../../src/types/landing';
import { DEFAULT_HOMEPAGE_PRIORITY_SLOT_CONFIG, DEFAULT_JOB_POSTING_PRICING_CONFIG } from '../../src/types/job';

const PRICING_JSON_PATH = path.resolve(process.cwd(), 'data', 'pricing_config.json');

function sha256File(filePath: string): string | null {
  if (!fs.existsSync(filePath)) return null;
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function createMockPricingCollection(options: { failFindOne?: boolean; failUpdateOne?: boolean } = {}) {
  const store = new Map<string, any>();
  const ops: string[] = [];

  return {
    store,
    ops,
    async findOne(query: { key: string }) {
      ops.push(`findOne:${query.key}`);
      if (options.failFindOne) {
        throw new Error('Simulated MongoDB pricing read timeout');
      }
      const doc = store.get(query.key);
      return doc ? JSON.parse(JSON.stringify(doc)) : null;
    },
    async updateOne(
      query: { key: string },
      update: { $set?: Record<string, any>; $setOnInsert?: Record<string, any> },
      opts?: { upsert?: boolean }
    ) {
      ops.push(`updateOne:${query.key}`);
      if (options.failUpdateOne) {
        throw new Error('Simulated MongoDB pricing write failure');
      }
      const existing = store.get(query.key);
      if (!existing) {
        if (!opts?.upsert) {
          return { acknowledged: true, matchedCount: 0, modifiedCount: 0, upsertedCount: 0 };
        }
        const newDoc: Record<string, any> = { key: query.key };
        if (update.$setOnInsert) {
          Object.assign(newDoc, JSON.parse(JSON.stringify(update.$setOnInsert)));
        }
        if (update.$set) {
          Object.assign(newDoc, JSON.parse(JSON.stringify(update.$set)));
        }
        store.set(query.key, newDoc);
        return { acknowledged: true, matchedCount: 0, modifiedCount: 0, upsertedCount: 1 };
      }

      if (update.$set) {
        const merged = { ...existing, ...JSON.parse(JSON.stringify(update.$set)) };
        store.set(query.key, merged);
        return { acknowledged: true, matchedCount: 1, modifiedCount: 1, upsertedCount: 0 };
      }

      return { acknowledged: true, matchedCount: 1, modifiedCount: 0, upsertedCount: 0 };
    }
  };
}

async function runPricingPersistenceTests() {
  console.log('==================================================================');
  console.log('  STEP-B: PRICING PERSISTENCE & CALCULATION REGRESSION TESTS      ');
  console.log('==================================================================');

  const initialPricingHash = sha256File(PRICING_JSON_PATH);
  const originalPricingFileContent = fs.existsSync(PRICING_JSON_PATH)
    ? fs.readFileSync(PRICING_JSON_PATH, 'utf-8')
    : null;
  const originalAuditAdd = AuditRepository.add;

  AuditRepository.add = (entry: any) => ({
    id: `audit-${Date.now()}`,
    timestamp: new Date().toISOString(),
    ...entry
  });

  const adminUser = UserRepository.create({
    name: 'Pricing Test Admin',
    email: 'pricing-admin-stepb@test.local',
    password: 'StrongPassword123!',
    role: 'Super Admin',
    status: 'Active',
    plan: 'Free'
  });
  const adminToken = createToken({
    id: adminUser.id,
    email: adminUser.email,
    role: adminUser.role,
    name: adminUser.name
  });

  const app = express();
  app.use(express.json());
  app.use(authMiddleware);
  app.use('/api/pricing', pricingRouter);

  let server: Server | null = null;
  let baseUrl = '';

  const startServer = async () => {
    server = createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', () => resolve()));
    const addr = server.address() as any;
    baseUrl = `http://127.0.0.1:${addr.port}`;
  };

  try {
    await startServer();
    const mockColl = createMockPricingCollection();
    PricingRepository.setMockCollection(mockColl);

    // Scenario 1: Global standard fee edit persists & reloads across fresh GET
    console.log('[1/12] Testing global standard fee edit persistence and reload...');
    const put1 = await fetch(`${baseUrl}/api/pricing`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        jobPosting: {
          standardFeePkr: 1450
        }
      })
    });
    assert.strictEqual(put1.status, 200);
    const put1Body = await put1.json();
    assert.strictEqual(put1Body.success, true);
    assert.strictEqual(put1Body.pricing.jobPosting.standardFeePkr, 1450);

    const get1 = await fetch(`${baseUrl}/api/pricing`);
    assert.strictEqual(get1.status, 200);
    const get1Body = await get1.json();
    assert.strictEqual(get1Body.pricing.jobPosting.standardFeePkr, 1450);

    // Verify zero writes to data/pricing_config.json when MongoDB collection is active
    assert.strictEqual(sha256File(PRICING_JSON_PATH), initialPricingHash);
    console.log('  OK: Global standard fee persisted in Mongo store without touching JSON.');

    // Scenario 2: Global discount updates final price accurately
    console.log('[2/12] Testing global discount persistence and server calculation...');
    const put2 = await fetch(`${baseUrl}/api/pricing`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        jobPosting: {
          standardFeePkr: 2000,
          globalDiscount: 25
        }
      })
    });
    assert.strictEqual(put2.status, 200);

    const calcGlobal = await fetch(`${baseUrl}/api/pricing/calculate-job`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        priorityTier: 'standard',
        jobCategory: 'Private Corporate',
        userEmail: 'normal-employer@company.pk'
      })
    });
    const calcGlobalBody = await calcGlobal.json();
    assert.strictEqual(calcGlobalBody.success, true);
    // Private Corporate default fee is 1000? Let's verify: default category fee is 1000 or standardFeePkr!
    // Wait: let's check what Private Corporate category fee is (cat-corp is 1000 by default).
    // With 25% global discount on 1000, finalPrice is 750; on unmatched category (standardFeePkr 2000), 1500.
    const calcUnmatched = await fetch(`${baseUrl}/api/pricing/calculate-job`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        priorityTier: 'standard',
        jobCategory: 'Custom Unlisted Sector',
        userEmail: 'normal-employer@company.pk'
      })
    });
    const calcUnmatchedBody = await calcUnmatched.json();
    assert.strictEqual(calcUnmatchedBody.calculation.basePrice, 2000);
    assert.strictEqual(calcUnmatchedBody.calculation.finalPrice, 1500);
    console.log('  OK: Global discount persisted & applied cleanly.');

    // Scenario 3: Master Free Mode produces 0 after save & reload
    console.log('[3/12] Testing Master Free Mode (isFreeAllPostings: true) -> 0 PKR...');
    const putFree = await fetch(`${baseUrl}/api/pricing`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        jobPosting: {
          standardFeePkr: 1750,
          isFreeAllPostings: true,
          globalDiscount: 0
        },
        landingPageConfig: {
          ...DEFAULT_LANDING_PAGE_CONFIG,
          isFreeAllPostings: true,
          globalDiscount: 0
        }
      })
    });
    assert.strictEqual(putFree.status, 200);
    const calcFree = await fetch(`${baseUrl}/api/pricing/calculate-job`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        priorityTier: 'vip_bundle',
        jobCategory: 'Private Corporate',
        userEmail: 'employer@company.pk'
      })
    });
    const calcFreeBody = await calcFree.json();
    assert.strictEqual(calcFreeBody.calculation.finalPrice, 0);
    console.log('  OK: Master Free Mode yields 0 PKR across tiers.');

    // Scenario 4: Turning Master Free Mode off restores configured standard fee (NOT 500)
    console.log('[4/12] Testing Master Free Mode disable restores configured standard fee (not 500)...');
    const restoredFee = resolveRestoredStandardFee(0, 1750);
    assert.strictEqual(restoredFee, 1750);
    const fallbackToPositiveCurrent = resolveRestoredStandardFee(1200, undefined);
    assert.strictEqual(fallbackToPositiveCurrent, 1200);
    const zeroFallbackWhenNeverPositive = resolveRestoredStandardFee(0, 0);
    assert.strictEqual(zeroFallbackWhenNeverPositive, 0);

    const toggledCategories = applyGlobalFreeToggleToCategories(
      DEFAULT_CATEGORY_POSTING_FEES.map((c) => ({ ...c, isFree: true })),
      false
    );
    assert.ok(toggledCategories.every((c) => c.isFree === false));

    let capturedPayload: any = null;
    const feeSaveOutcome = await executeCompleteFeeConfigSave(
      {
        standardFeePkr: restoredFee,
        globalDiscount: 0,
        isFreeAllPostings: false,
        categoryPostingFees: toggledCategories,
        exemptUserEmails: [],
        landingPageConfig: {
          ...DEFAULT_LANDING_PAGE_CONFIG,
          isFreeAllPostings: false,
          categoryPostingFees: toggledCategories
        }
      },
      async (payload) => {
        capturedPayload = payload;
        const r = await fetch(`${baseUrl}/api/pricing`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`
          },
          body: JSON.stringify({
            jobPosting: {
              standardFeePkr: payload.standardFeePkr,
              globalDiscount: payload.globalDiscount,
              isFreeAllPostings: payload.isFreeAllPostings,
              categoryPostingFees: payload.categoryPostingFees,
              exemptUserEmails: payload.exemptUserEmails
            },
            landingPageConfig: payload.landingPageConfig
          })
        });
        return r.json();
      }
    );
    assert.strictEqual(feeSaveOutcome.success, true);
    assert.strictEqual(capturedPayload.standardFeePkr, 1750);

    const calcAfterRestore = await fetch(`${baseUrl}/api/pricing/calculate-job`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        priorityTier: 'standard',
        jobCategory: 'Unlisted Sector',
        userEmail: 'employer@company.pk'
      })
    });
    const calcAfterRestoreBody = await calcAfterRestore.json();
    assert.strictEqual(calcAfterRestoreBody.calculation.finalPrice, 1750);
    console.log('  OK: Turning Master Free Mode off restored 1750 PKR (never 500).');

    // Scenario 5 & 6: Category fee and category discount updates match UserDashboard sector labels
    console.log('[5-6/12] Testing category fee & category discount updates...');
    const customCategories = [
      { categoryId: 'cat-corp', categoryName: 'Corporate / Private Sector', feePkr: 1200, isFree: false, discountPercent: 10 },
      { categoryId: 'cat-govt', categoryName: 'Government & Public Sector (FPSC/PPSC)', feePkr: 800, isFree: false, discountPercent: 25 },
      { categoryId: 'cat-news', categoryName: 'Newspaper Classified Ad', feePkr: 0, isFree: true, discountPercent: 0 },
      { categoryId: 'cat-remote', categoryName: 'International & Remote Jobs', feePkr: 3000, isFree: false, discountPercent: 0 }
    ];
    await fetch(`${baseUrl}/api/pricing`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        jobPosting: {
          standardFeePkr: 1750,
          globalDiscount: 0,
          isFreeAllPostings: false,
          categoryPostingFees: customCategories
        }
      })
    });

    const calcCorp = await (await fetch(`${baseUrl}/api/pricing/calculate-job`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priorityTier: 'standard', jobCategory: 'Private Corporate' })
    })).json();
    assert.strictEqual(calcCorp.calculation.basePrice, 1200);
    assert.strictEqual(calcCorp.calculation.finalPrice, 1080); // 1200 - 10% = 1080

    const calcGovt = await (await fetch(`${baseUrl}/api/pricing/calculate-job`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priorityTier: 'standard', jobCategory: 'Government Sector' })
    })).json();
    assert.strictEqual(calcGovt.calculation.basePrice, 800);
    assert.strictEqual(calcGovt.calculation.finalPrice, 600); // 800 - 25% = 600

    const calcNews = await (await fetch(`${baseUrl}/api/pricing/calculate-job`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priorityTier: 'standard', jobCategory: 'Newspaper Classified' })
    })).json();
    assert.strictEqual(calcNews.calculation.finalPrice, 0);
    console.log('  OK: Category fees & discounts matched UserDashboard sector strings.');

    // Scenario 7: Employer exemption grant and revoke
    console.log('[7/12] Testing employer exemption grant and revoke...');
    await fetch(`${baseUrl}/api/pricing`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        jobPosting: {
          exemptUserEmails: ['  VIP@Employer.PK  ']
        }
      })
    });

    const calcExempt = await (await fetch(`${baseUrl}/api/pricing/calculate-job`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        priorityTier: 'featured_top',
        jobCategory: 'Private Corporate',
        userEmail: 'vip@employer.pk'
      })
    })).json();
    assert.strictEqual(calcExempt.calculation.finalPrice, 0);

    // Revoke exemption
    await fetch(`${baseUrl}/api/pricing`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        jobPosting: {
          exemptUserEmails: []
        }
      })
    });

    const calcRevoked = await (await fetch(`${baseUrl}/api/pricing/calculate-job`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        priorityTier: 'standard',
        jobCategory: 'Private Corporate',
        userEmail: 'vip@employer.pk'
      })
    })).json();
    assert.strictEqual(calcRevoked.calculation.finalPrice, 1080);
    console.log('  OK: Employer exemption grant & revoke persisted cleanly.');

    // Scenario 8: Custom categories added or deleted survive save & reload
    console.log('[8/12] Testing custom categories added & deleted survive save & reload...');
    const reducedAndCustom = [
      ...customCategories.filter((c) => c.categoryId !== 'cat-news'),
      { categoryId: 'cat-custom-tech', categoryName: 'AI & Robotics Roles', feePkr: 2200, isFree: false, discountPercent: 0 }
    ];
    await fetch(`${baseUrl}/api/pricing`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        jobPosting: {
          categoryPostingFees: reducedAndCustom
        },
        landingPageConfig: {
          ...DEFAULT_LANDING_PAGE_CONFIG,
          categoryPostingFees: reducedAndCustom
        }
      })
    });
    const reloadedAfterCatEdit = await (await fetch(`${baseUrl}/api/pricing`)).json();
    const savedCats = reloadedAfterCatEdit.pricing.jobPosting.categoryPostingFees;
    assert.strictEqual(savedCats.some((c: any) => c.categoryId === 'cat-news'), false, 'Deleted default category should stay deleted');
    assert.strictEqual(savedCats.some((c: any) => c.categoryId === 'cat-custom-tech'), true, 'Added custom category should survive reload');
    assert.strictEqual(
      reloadedAfterCatEdit.pricing.landingPageConfig.categoryPostingFees.some((c: any) => c.categoryId === 'cat-custom-tech'),
      true,
      'landingPageConfig.categoryPostingFees must stay synchronized'
    );
    console.log('  OK: Category additions & deletions survived reload in sync.');

    // Scenario 9: Failed pricing save returns failure, does not report success, and preserves confirmed state
    console.log('[9/12] Testing failed pricing save fails closed and preserves confirmed state...');
    const failingSaveColl = createMockPricingCollection({ failUpdateOne: true });
    failingSaveColl.store.set('authoritative_pricing_config', JSON.parse(JSON.stringify(mockColl.store.get('authoritative_pricing_config'))));
    PricingRepository.setMockCollection(failingSaveColl);

    const failSaveOutcome = await executeCompleteFeeConfigSave(
      {
        standardFeePkr: 9999,
        globalDiscount: 50,
        isFreeAllPostings: true,
        categoryPostingFees: [],
        exemptUserEmails: ['bad@fail.pk']
      },
      async (payload) => {
        const res = await fetch(`${baseUrl}/api/pricing`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`
          },
          body: JSON.stringify({ jobPosting: payload })
        });
        return res.json();
      }
    );
    assert.strictEqual(failSaveOutcome.success, false, 'Failed save must return success: false');

    // Confirm Mongo state was unchanged
    const afterFailedSave = await (await fetch(`${baseUrl}/api/pricing`)).json();
    assert.strictEqual(afterFailedSave.pricing.jobPosting.standardFeePkr, 1750);

    // Also confirm read failure fails closed (no silent fallback)
    const failingReadColl = createMockPricingCollection({ failFindOne: true });
    PricingRepository.setMockCollection(failingReadColl);
    const failedReadRes = await fetch(`${baseUrl}/api/pricing`);
    assert.strictEqual(failedReadRes.status, 500, 'MongoDB read failure must return HTTP 500 fail closed');

    PricingRepository.setMockCollection(mockColl);
    console.log('  OK: Failed read/write failed closed and preserved confirmed state.');

    // Scenario 10: User-facing fee display & payment submission amount derive strictly from server calculateJob
    console.log('[10/12] Verifying UserDashboard and App strictly use server calculateJob and zero localStorage authority...');
    const userDashSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/UserDashboard.tsx'), 'utf-8');
    const appSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/App.tsx'), 'utf-8');
    const feeMgrSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/admin/AdminFeeManager.tsx'), 'utf-8');

    assert.strictEqual(userDashSrc.includes('computeJobPostingCost'), false, 'UserDashboard must not contain local computeJobPostingCost');
    assert.strictEqual(userDashSrc.includes('api.pricing.calculateJob'), true, 'UserDashboard must call api.pricing.calculateJob');
    assert.strictEqual(userDashSrc.includes('amount: feeToPay'), true, 'Payment submission must use calculatedPostingFee');
    assert.strictEqual(appSrc.includes("localStorage.getItem('hybrid_job_posting_fee')"), false, 'App must not read hybrid_job_posting_fee from localStorage');
    assert.strictEqual(appSrc.includes("localStorage.getItem('hybrid_job_posting_pricing')"), false, 'App must not read hybrid_job_posting_pricing from localStorage');
    assert.strictEqual(appSrc.includes("localStorage.getItem('hybrid_landing_page_config')"), false, 'App must not read hybrid_landing_page_config from localStorage');
    assert.strictEqual(feeMgrSrc.includes('500'), false, 'AdminFeeManager must not hardcode 500 PKR fallback');
    console.log('  OK: Source contracts verified (server-calculated fees, no localStorage authority, no 500 fallback).');

    // Scenario 11: Urgent, featured, future, and VIP bundle calculations match server config
    console.log('[11/12] Testing urgent, featured_top, future_job, and vip_bundle server calculations...');
    await fetch(`${baseUrl}/api/pricing`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        jobPosting: {
          standardFeePkr: 1000,
          urgentFeePkr: 600,
          featuredTopFeePkr: 1400,
          futureJobFeePkr: 900,
          vipBundleFeePkr: 3100,
          globalDiscount: 0,
          isFreeAllPostings: false,
          categoryPostingFees: [
            { categoryId: 'cat-corp', categoryName: 'Corporate / Private Sector', feePkr: 1000, isFree: false, discountPercent: 0 }
          ]
        }
      })
    });

    const tierExpectations: Array<[string, number]> = [
      ['standard', 1000],
      ['urgent', 1600],
      ['featured_top', 2400],
      ['future_job', 1900],
      ['vip_bundle', 3100]
    ];
    for (const [tier, expectedPrice] of tierExpectations) {
      const calcRes = await (await fetch(`${baseUrl}/api/pricing/calculate-job`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priorityTier: tier, jobCategory: 'Private Corporate' })
      })).json();
      assert.strictEqual(
        calcRes.calculation.finalPrice,
        expectedPrice,
        `Tier ${tier} expected ${expectedPrice}, got ${calcRes.calculation.finalPrice}`
      );
    }
    console.log('  OK: All 5 tier calculations match server configuration.');

    // Scenario 12: Priority slot & tier settings preserved when saving Fee Management updates
    console.log('[12/12] Testing priority slots & tier settings preservation when saving Fee Management updates...');
    await fetch(`${baseUrl}/api/pricing`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        jobPosting: {
          ...DEFAULT_JOB_POSTING_PRICING_CONFIG,
          standardFeePkr: 1111,
          vipBundleFeePkr: 3333,
          urgentDurationDays: 22,
          homepagePrioritySlots: {
            ...DEFAULT_HOMEPAGE_PRIORITY_SLOT_CONFIG,
            vipBundle: { enabled: true, maxSlots: 7 },
            featuredTop: { enabled: false, maxSlots: 3 }
          }
        }
      })
    });

    // Fee Management saves only its fields (standardFeePkr, globalDiscount, isFreeAllPostings, categoryPostingFees, exemptUserEmails, landingPageConfig)
    await fetch(`${baseUrl}/api/pricing`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        jobPosting: {
          standardFeePkr: 1555,
          globalDiscount: 5,
          isFreeAllPostings: false,
          categoryPostingFees: customCategories,
          exemptUserEmails: ['keep@slots.pk']
        },
        landingPageConfig: {
          ...DEFAULT_LANDING_PAGE_CONFIG,
          isFreeAllPostings: false,
          globalDiscount: 5,
          categoryPostingFees: customCategories,
          exemptUserEmails: ['keep@slots.pk']
        }
      })
    });

    const preservedCheck = await (await fetch(`${baseUrl}/api/pricing`)).json();
    assert.strictEqual(preservedCheck.pricing.jobPosting.standardFeePkr, 1555);
    assert.strictEqual(preservedCheck.pricing.jobPosting.vipBundleFeePkr, 3333);
    assert.strictEqual(preservedCheck.pricing.jobPosting.urgentDurationDays, 22);
    assert.strictEqual(preservedCheck.pricing.jobPosting.homepagePrioritySlots.vipBundle.maxSlots, 7);
    assert.strictEqual(preservedCheck.pricing.jobPosting.homepagePrioritySlots.featuredTop.enabled, false);
    assert.strictEqual(preservedCheck.pricing.jobPosting.homepagePrioritySlots.featuredTop.maxSlots, 3);
    console.log('  OK: Priority slots and tier settings preserved across Fee Management save.');

    // Bonus check: local unconfigured mode works and cleans up without corrupting data/pricing_config.json
    PricingRepository.setMockCollection(null);
    const localPricing = await PricingRepository.update({
      jobPosting: { standardFeePkr: 1337 }
    });
    assert.strictEqual(localPricing.jobPosting.standardFeePkr, 1337);
    const localReadBack = await PricingRepository.get();
    assert.strictEqual(localReadBack.jobPosting.standardFeePkr, 1337);

    console.log('\n==================================================================');
    console.log('  ALL 12 PRICING PERSISTENCE & CALCULATION TESTS PASSED!          ');
    console.log('==================================================================');
  } finally {
    PricingRepository.setMockCollection(null);
    AuditRepository.add = originalAuditAdd;
    if (server) {
      await new Promise<void>((resolve) => server!.close(() => resolve()));
    }
    if (originalPricingFileContent !== null) {
      fs.writeFileSync(PRICING_JSON_PATH, originalPricingFileContent, 'utf-8');
    } else if (fs.existsSync(PRICING_JSON_PATH)) {
      fs.unlinkSync(PRICING_JSON_PATH);
    }
    assert.strictEqual(sha256File(PRICING_JSON_PATH), initialPricingHash, 'data/pricing_config.json hash must be restored cleanly');
  }
}

runPricingPersistenceTests().catch((err) => {
  console.error('Pricing persistence tests FAILED:', err);
  process.exit(1);
});
