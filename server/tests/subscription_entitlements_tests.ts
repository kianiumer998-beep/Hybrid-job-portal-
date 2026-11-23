process.env.IS_TEST = 'true';

import assert from 'node:assert/strict';
import { normalizeSubscriptionFeatureCatalog, resolveSubscriptionPackage } from '../services/subscriptionEntitlements';
import { UserRepository } from '../db/repositories/UserRepository';

async function run() {
  const catalog = normalizeSubscriptionFeatureCatalog([
    { id: 'early_access', label: 'Early Access', enabled: true, pricePkr: 500, durationDays: 30, includedSlots: 0, slotDurationDays: 30 },
    { id: 'whatsapp_alerts', label: 'WhatsApp Alerts', enabled: true, pricePkr: 300, durationDays: 30, includedSlots: 0, slotDurationDays: 30 },
    { id: 'sms_alerts', label: 'SMS Alerts', enabled: false, pricePkr: 200, durationDays: 30, includedSlots: 0, slotDurationDays: 30 },
    { id: 'unknown_feature', label: 'Unsupported', enabled: true, pricePkr: 1 }
  ]);
  assert.equal(catalog.length, 3, 'unsupported IDs are excluded from the feature catalog');
  assert.equal(catalog[2].id, 'sms_alerts');

  const pricing = { subscriptionFeatureCatalog: catalog, subscriptionBundleDiscountPercent: 10 };
  const bundle = resolveSubscriptionPackage({ id: 'bundle', name: 'Bundle', pricingMode: 'catalog', featureIds: ['early_access', 'whatsapp_alerts'], durationDays: 30 }, pricing);
  assert.equal(bundle.undiscountedPricePkr, 800, 'bundle subtotal is derived from admin-configured feature prices');
  assert.equal(bundle.pricePkr, 720, 'configured bundle discount is applied server-side');
  assert.deepEqual(bundle.featureIds, ['early_access', 'whatsapp_alerts']);

  assert.throws(
    () => resolveSubscriptionPackage({ id: 'bad', pricingMode: 'catalog', featureIds: ['sms_alerts'] }, pricing),
    /unavailable or disabled/,
    'disabled feature cannot be included in a new purchase'
  );
  assert.throws(
    () => resolveSubscriptionPackage({ id: 'bad', pricingMode: 'catalog', featureIds: ['untrusted'] }, pricing),
    /Unsupported subscription feature/,
    'unknown feature IDs are rejected'
  );

  const fixed = resolveSubscriptionPackage({ id: 'fixed', pricingMode: 'fixed', pricePkr: 999, configuredPricePkr: 850, featureIds: [] }, pricing);
  assert.equal(fixed.pricePkr, 850, 'fixed packages keep their configured price');
  const slotUserId = 'subscription-slot-test-user';
  await UserRepository.createAsync({
    id: slotUserId,
    walletBalance: 0,
    membershipStatus: 'Active',
    subscriptionExpiresAt: new Date(Date.now() + 86400000).toISOString(),
    subscriptionEntitlements: {
      urgent_job_posting: {
        enabled: true,
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        includedSlots: 1,
        remainingSlots: 1
      }
    }
  });
  const firstRedemption = await UserRepository.consumeSubscriptionFeatureSlotAsync(slotUserId, 'urgent_job_posting', 'job-123');
  assert.equal(firstRedemption.subscriptionEntitlements.urgent_job_posting.remainingSlots, 0, 'a posting slot is consumed exactly once');
  const repeatedRedemption = await UserRepository.consumeSubscriptionFeatureSlotAsync(slotUserId, 'urgent_job_posting', 'job-123');
  assert.equal(repeatedRedemption.subscriptionEntitlements.urgent_job_posting.remainingSlots, 0, 'repeated redemption does not consume another slot');
  const restored = await UserRepository.restoreSubscriptionFeatureSlotAsync(slotUserId, 'urgent_job_posting', 'job-123');
  assert.equal(restored.subscriptionEntitlements.urgent_job_posting.remainingSlots, 1, 'failed job update compensation restores the consumed slot');

  const cvUserId = 'subscription-cv-benefits-test-user';
  await UserRepository.createAsync({ id: cvUserId, walletBalance: 0, cvPackageEntitlements: [] });
  const cvBenefits = {
    packageId: 'subscription:cv-pro',
    packageName: 'CV Pro Benefits',
    pricePkr: 500,
    durationDays: 30,
    cvCreateLimit: 2,
    editLimit: 5,
    pdfExportLimit: 3,
    atsExportLimit: 2,
    shareLimit: 1,
    noWatermark: true,
    premiumDesignIds: ['executive', 'tech']
  };
  const firstCvGrant = await UserRepository.grantCvPackageEntitlementAsync(cvUserId, cvBenefits, 'cv-subscription-tx-1');
  assert.equal(firstCvGrant.cvPackageEntitlements.length, 1, 'approved subscription grants one CV benefit entitlement');
  assert.deepEqual(firstCvGrant.cvPackageEntitlements[0].premiumDesignIds, ['executive', 'tech'], 'subscription retains included premium design IDs');
  assert.equal(firstCvGrant.cvPackageEntitlements[0].noWatermark, true, 'subscription retains the no-watermark entitlement');
  const repeatedCvGrant = await UserRepository.grantCvPackageEntitlementAsync(cvUserId, cvBenefits, 'cv-subscription-tx-1');
  assert.equal(repeatedCvGrant.cvPackageEntitlements.length, 1, 'replayed approval does not duplicate CV entitlements');
  const cvExport = await UserRepository.consumeCvActionQuotasAsync(cvUserId, 'executive', 'pdfExportLimit', { transactionId: 'cv-subscription-tx-1', limit: 3 }, 0);
  assert.equal(cvExport.cvPackageEntitlements[0].usage.pdfExportLimit, 1, 'PDF export consumes one server-side package quota');

  const walletCvUserId = 'subscription-cv-wallet-test-user';
  await UserRepository.createAsync({ id: walletCvUserId, walletBalance: 1000, cvPackageEntitlements: [] });
  const walletCvPackage = { packageId: 'cv-starter', packageName: 'CV Starter', durationDays: 30, cvCreateLimit: 1, editLimit: 2, pdfExportLimit: 2, atsExportLimit: 1, shareLimit: 1, noWatermark: false };
  const walletCvPurchase = await UserRepository.purchaseCvPackageWithWalletAsync(walletCvUserId, 250, walletCvPackage, 'cv-wallet-tx-1');
  assert.equal(walletCvPurchase.ok, true, 'wallet purchase grants the CV package');
  assert.equal(walletCvPurchase.user.walletBalance, 750, 'wallet CV purchase deducts the exact amount');
  const repeatedWalletCvPurchase = await UserRepository.purchaseCvPackageWithWalletAsync(walletCvUserId, 250, walletCvPackage, 'cv-wallet-tx-1');
  assert.equal(repeatedWalletCvPurchase.user.walletBalance, 750, 'replayed wallet purchase does not double-charge');
  assert.equal(repeatedWalletCvPurchase.user.cvPackageEntitlements.length, 1, 'replayed wallet purchase does not duplicate the package');

  console.log('Subscription entitlement tests passed (21 assertions).');
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
