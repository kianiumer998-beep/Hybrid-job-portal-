import { expect } from 'chai';
import sinon from 'sinon';
import { evaluateApplyAccess } from '../services/applyAccessPolicy.ts';
import { JobVisibilityRepository } from '../db/repositories/JobVisibilityRepository.ts';

async function runTests() {
  console.log('Starting Apply Membership Gate Policy Logic Tests (STEP65-F.1.1)...');
  let testsPassed = 0;
  let testsFailed = 0;

  const runTest = async (name: string, fn: () => Promise<void>) => {
    try {
      await fn();
      console.log(`✅ ${name}`);
      testsPassed++;
    } catch (err) {
      console.error(`❌ ${name}`);
      console.error(err);
      testsFailed++;
    }
  };

  const defaultSettings = {
    applyButtonRequiresPremium: false,
    premiumPopupTitle: 'Premium Only',
    premiumPopupMessage: 'Upgrade to apply',
    premiumFieldMessages: {}
  };

  const isPremiumStub = sinon.stub(JobVisibilityRepository, 'isUserPremiumAuthoritative');

  await runTest('1. Admin should always be allowed', async () => {
    const user = { id: 'admin1', role: 'Admin' };
    const res = await evaluateApplyAccess(user, {}, defaultSettings);
    if (res.allowed !== true) throw new Error('Expected allowed: true');
  });

  await runTest('2. Super Admin should always be allowed', async () => {
    const user = { id: 'sadmin1', role: 'Super Admin' };
    const res = await evaluateApplyAccess(user, {}, defaultSettings);
    if (res.allowed !== true) throw new Error('Expected allowed: true');
  });

  await runTest('3. Free user allowed if no gates are active', async () => {
    isPremiumStub.resolves(false);
    const user = { id: 'user1' };
    const res = await evaluateApplyAccess(user, {}, defaultSettings);
    if (res.allowed !== true) throw new Error('Expected allowed: true');
  });

  await runTest('4. Free user restricted by global gate', async () => {
    isPremiumStub.resolves(false);
    const user = { id: 'user1' };
    const settings = { ...defaultSettings, applyButtonRequiresPremium: true };
    const res = await evaluateApplyAccess(user, {}, settings);
    if (res.allowed !== false) throw new Error('Expected allowed: false');
    if (res.gate?.requiresUpgrade !== true) throw new Error('Expected requiresUpgrade: true');
  });

  await runTest('5. Premium user allowed by global gate', async () => {
    isPremiumStub.resolves(true);
    const user = { id: 'user1' };
    const settings = { ...defaultSettings, applyButtonRequiresPremium: true };
    const res = await evaluateApplyAccess(user, {}, settings);
    if (res.allowed !== true) throw new Error('Expected allowed: true');
  });

  await runTest('6. Free user restricted by premium applicationUrl field', async () => {
    isPremiumStub.resolves(false);
    const user = { id: 'user1' };
    const job = { fieldVisibility: { applicationUrl: 'Premium' } };
    const res = await evaluateApplyAccess(user, job, defaultSettings);
    if (res.allowed !== false) throw new Error('Expected allowed: false');
    if (!res.gate?.requiredFields?.includes('applicationUrl')) throw new Error('Expected applicationUrl in requiredFields');
  });

  await runTest('7. Premium user allowed by premium applicationUrl field', async () => {
    isPremiumStub.resolves(true);
    const user = { id: 'user1' };
    const job = { fieldVisibility: { applicationUrl: 'Premium' } };
    const res = await evaluateApplyAccess(user, job, defaultSettings);
    if (res.allowed !== true) throw new Error('Expected allowed: true');
  });

  await runTest('8. Free user restricted by premium externalApplyUrl field', async () => {
    isPremiumStub.resolves(false);
    const user = { id: 'user1' };
    const job = { fieldVisibility: { externalApplyUrl: 'Premium' } };
    const res = await evaluateApplyAccess(user, job, defaultSettings);
    if (res.allowed !== false) throw new Error('Expected allowed: false');
  });

  await runTest('9. Informational sourceUrl alone does NOT block Apply', async () => {
    isPremiumStub.resolves(false);
    const user = { id: 'user1' };
    const job = { fieldVisibility: { sourceUrl: 'Premium' } };
    const res = await evaluateApplyAccess(user, job, defaultSettings);
    if (res.allowed !== true) throw new Error('Expected allowed: true even if sourceUrl is Premium');
  });

  await runTest('10. Custom field message should be used', async () => {
    isPremiumStub.resolves(false);
    const user = { id: 'user1' };
    const job = { fieldVisibility: { applicationUrl: 'Premium' } };
    const settings = { ...defaultSettings, premiumFieldMessages: { applicationUrl: 'Custom' } };
    const res = await evaluateApplyAccess(user, job, settings);
    if (res.gate?.message !== 'Custom') throw new Error('Expected custom message');
  });

  await runTest('11. Hidden fields should NOT restrict apply', async () => {
    isPremiumStub.resolves(false);
    const job = { fieldVisibility: { applicationUrl: 'Hidden' } };
    const res = await evaluateApplyAccess({id:'u1'}, job, defaultSettings);
    if (res.allowed !== true) throw new Error('Expected allowed: true');
  });

  await runTest('12. Multiple premium fields: only application-related block', async () => {
    isPremiumStub.resolves(false);
    const job = { fieldVisibility: { applicationUrl: 'Premium', sourceUrl: 'Premium' } };
    const res = await evaluateApplyAccess({id:'u1'}, job, defaultSettings);
    if (res.allowed !== false) throw new Error('Expected allowed: false');
    if (res.gate?.requiredFields?.length !== 1) throw new Error('Expected only 1 blocked field (applicationUrl)');
  });

  await runTest('13. Non-apply fields premium', async () => {
    isPremiumStub.resolves(false);
    const job = { fieldVisibility: { salary: 'Premium' } };
    const res = await evaluateApplyAccess({id:'u1'}, job, defaultSettings);
    if (res.allowed !== true) throw new Error('Expected allowed: true');
  });

  await runTest('14. Global gate restricted even if all fields free', async () => {
    isPremiumStub.resolves(false);
    const settings = { ...defaultSettings, applyButtonRequiresPremium: true };
    const res = await evaluateApplyAccess({id:'u1'}, {}, settings);
    if (res.allowed !== false) throw new Error('Expected allowed: false');
  });

  await runTest('15. Authenticated user with no ID as guest', async () => {
    isPremiumStub.resolves(false);
    const settings = { ...defaultSettings, applyButtonRequiresPremium: true };
    const res = await evaluateApplyAccess({}, {}, settings);
    if (res.allowed !== false) throw new Error('Expected allowed: false');
  });

  await runTest('16. Null user as guest', async () => {
    isPremiumStub.resolves(false);
    const settings = { ...defaultSettings, applyButtonRequiresPremium: true };
    const res = await evaluateApplyAccess(null, {}, settings);
    if (res.allowed !== false) throw new Error('Expected allowed: false');
  });

  await runTest('17. Global gate custom title/message', async () => {
    isPremiumStub.resolves(false);
    const settings = { ...defaultSettings, applyButtonRequiresPremium: true, premiumPopupTitle: 'T', premiumPopupMessage: 'M' };
    const res = await evaluateApplyAccess({id:'u1'}, {}, settings);
    if (res.gate?.title !== 'T') throw new Error('Expected title T');
    if (res.gate?.message !== 'M') throw new Error('Expected message M');
  });

  await runTest('18. isPremiumPrecalculated should be respected and avoid stub', async () => {
    // If we pass true/false explicitly, it should NOT use the stub (authoritative DB lookup)
    const resTrue = await evaluateApplyAccess({id:'u1'}, {}, defaultSettings, true);
    expect(resTrue.allowed).to.be.true;
    
    const settings = { ...defaultSettings, applyButtonRequiresPremium: true };
    const resFalse = await evaluateApplyAccess({id:'u1'}, {}, settings, false);
    expect(resFalse.allowed).to.be.false;
  });

  await runTest('19. _visibilityHints should be respected for gating', async () => {
    isPremiumStub.resolves(false);
    const job = { _visibilityHints: { applicationUrl: { requiresUpgrade: true } } };
    const res = await evaluateApplyAccess({id:'u1'}, job, defaultSettings);
    expect(res.allowed).to.be.false;
    expect(res.gate?.requiredFields).to.include('applicationUrl');
  });

  console.log(`\nTests Summary: ${testsPassed} passed, ${testsFailed} failed`);
  process.exit(testsFailed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('Unhandled error in test runner:', err);
  process.exit(1);
});
