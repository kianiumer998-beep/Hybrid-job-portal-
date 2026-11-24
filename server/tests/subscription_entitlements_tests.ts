process.env.IS_TEST = 'true';

import assert from 'node:assert/strict';
import { normalizeSubscriptionFeatureCatalog, resolveSubscriptionPackage } from '../services/subscriptionEntitlements';
import { UserRepository } from '../db/repositories/UserRepository';
import { SubscriptionUsageRepository } from '../db/repositories/SubscriptionUsageRepository';
import { PaymentRepository } from '../db/repositories/PaymentRepository';

async function run() {
  const catalog = normalizeSubscriptionFeatureCatalog([
    { id: 'early_access', label: 'Early Access', enabled: true, pricePkr: 500, durationDays: 30, includedSlots: 0, slotDurationDays: 30 },
    { id: 'whatsapp_alerts', label: 'WhatsApp Alerts', enabled: true, pricePkr: 300, durationDays: 30, includedSlots: 0, slotDurationDays: 30 },
    { id: 'sms_alerts', label: 'SMS Alerts', enabled: false, pricePkr: 200, durationDays: 30, includedSlots: 0, slotDurationDays: 30, unlimitedMessages: false, monthlyMessageQuota: 2 },
    { id: 'campaign_credits', label: 'Campaign Credits', enabled: true, pricePkr: 900, durationDays: 30, includedSlots: 0, slotDurationDays: 30, campaignCredits: [{ placement: 'sidebar', durationHours: 168, quantity: 2 }] },
    { id: 'unknown_feature', label: 'Unsupported', enabled: true, pricePkr: 1 }
  ]);
  assert.equal(catalog.length, 4, 'unsupported IDs are excluded while campaign credits are supported');
  assert.equal(catalog[2].id, 'sms_alerts');
  assert.equal(catalog[1].unlimitedMessages, true, 'legacy catalog entries preserve unmetered compatibility');
  assert.equal(catalog[2].monthlyMessageQuota, 2, 'explicit monthly quotas are normalized');
  assert.deepEqual(catalog[3].campaignCredits, [{ placement: 'sidebar', durationHours: 168, quantity: 2 }], 'placement-specific campaign credits are normalized');

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

  const campaignPackage = resolveSubscriptionPackage({ id: 'campaign-plan', pricingMode: 'catalog', featureIds: ['campaign_credits'], durationDays: 30 }, { subscriptionFeatureCatalog: catalog });
  assert.equal(campaignPackage.pricePkr, 900, 'campaign credit catalog price is calculated server-side');
  assert.equal(campaignPackage.featureSnapshots[0].campaignCredits?.[0].quantity, 2, 'campaign credit rules are frozen in the purchase snapshot');
  assert.throws(
    () => resolveSubscriptionPackage({ id: 'bad-campaign', pricingMode: 'catalog', featureIds: ['campaign_credits'] }, { subscriptionFeatureCatalog: catalog.map((item: any) => item.id === 'campaign_credits' ? { ...item, campaignCredits: [] } : item) }),
    /Configure at least one placement/,
    'campaign credit feature cannot be sold without redemption rules'
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

  const quotaUserId = 'subscription-message-quota-test-user';
  const future = new Date(Date.now() + 86400000).toISOString();
  await UserRepository.createAsync({
    id: quotaUserId,
    walletBalance: 0,
    membershipStatus: 'Active',
    subscriptionExpiresAt: future,
    subscriptionEntitlements: {
      sms_alerts: { enabled: true, expiresAt: future, unlimitedMessages: false, monthlyMessageQuota: 2 }
    }
  });
  const firstReservation = await SubscriptionUsageRepository.reserveMessageQuota(quotaUserId, 'sms_alerts', 'event-1');
  assert.equal(firstReservation.ok, true, 'first paid message reserves one quota unit');
  const duplicateReservation = await SubscriptionUsageRepository.reserveMessageQuota(quotaUserId, 'sms_alerts', 'event-1');
  assert.equal(duplicateReservation.reason, 'already_processed', 'duplicate event cannot reserve or send twice');
  assert.equal(await SubscriptionUsageRepository.completeMessageQuota(quotaUserId, 'sms_alerts', 'event-1'), true, 'successful provider delivery finalizes reservation');
  const failedReservation = await SubscriptionUsageRepository.reserveMessageQuota(quotaUserId, 'sms_alerts', 'event-2');
  assert.equal(failedReservation.ok, true, 'second message can reserve remaining quota');
  assert.equal(await SubscriptionUsageRepository.releaseMessageQuota(quotaUserId, 'sms_alerts', 'event-2', failedReservation.month), true, 'provider failure releases reserved quota');
  const retryReservation = await SubscriptionUsageRepository.reserveMessageQuota(quotaUserId, 'sms_alerts', 'event-2');
  assert.equal(retryReservation.ok, true, 'failed provider event can be retried safely');
  assert.equal(await SubscriptionUsageRepository.completeMessageQuota(quotaUserId, 'sms_alerts', 'event-2'), true, 'retried successful delivery finalizes quota');
  const exhaustedReservation = await SubscriptionUsageRepository.reserveMessageQuota(quotaUserId, 'sms_alerts', 'event-3');
  assert.equal(exhaustedReservation.reason, 'quota_exhausted', 'monthly message quota blocks further sends');
  const quotaUser = await UserRepository.getByIdAsync(quotaUserId);
  assert.equal(quotaUser.subscriptionMessageUsage.sms_alerts[retryReservation.month].used, 2, 'failed provider attempt did not consume quota');

  const campaignCreditUserId = 'subscription-campaign-credit-test-user';
  await UserRepository.createAsync({
    id: campaignCreditUserId, walletBalance: 0, membershipStatus: 'Active', subscriptionExpiresAt: future,
    subscriptionFeatureIds: ['campaign_credits'],
    subscriptionEntitlements: {
      campaign_credits: { enabled: true, expiresAt: future, campaignCredits: [
        { placement: 'sidebar', durationHours: 168, includedQuantity: 1, remaining: 1 }
      ] }
    }
  });
  const campaignRedemption = await SubscriptionUsageRepository.consumeCampaignCredit(campaignCreditUserId, 'sidebar', 168, 'campaign-event-1');
  assert.equal(campaignRedemption?.credit.placement, 'sidebar', 'campaign credit matches the requested placement');
  assert.equal(campaignRedemption?.user.subscriptionEntitlements.campaign_credits.campaignCredits[0].remaining, 0, 'campaign credit is consumed atomically');
  assert.equal(await SubscriptionUsageRepository.consumeCampaignCredit(campaignCreditUserId, 'sidebar', 168, 'campaign-event-1'), null, 'campaign redemption is idempotent');
  assert.equal(await SubscriptionUsageRepository.restoreCampaignCredit(campaignCreditUserId, 'sidebar', 168, 'campaign-event-1'), true, 'rejected campaign restores its credit');
  assert.equal(await SubscriptionUsageRepository.restoreCampaignCredit(campaignCreditUserId, 'sidebar', 168, 'campaign-event-1'), true, 'repeated campaign restoration is idempotent');

  const smsCampaignUserId = 'subscription-sms-campaign-credit-test-user';
  await UserRepository.createAsync({
    id: smsCampaignUserId, walletBalance: 0, membershipStatus: 'Active', subscriptionExpiresAt: future,
    subscriptionFeatureIds: ['campaign_credits'],
    subscriptionEntitlements: {
      campaign_credits: { enabled: true, expiresAt: future, campaignCredits: [
        { placement: 'sms-broadcast', durationHours: 24, smsRecipientsCount: 50, includedQuantity: 1, remaining: 1 }
      ] }
    }
  });
  assert.equal(await SubscriptionUsageRepository.consumeCampaignCredit(smsCampaignUserId, 'sms-broadcast', 24, 'sms-campaign-1', 49), null, 'SMS campaign credit rejects a different recipient count');
  const smsCampaignRedemption = await SubscriptionUsageRepository.consumeCampaignCredit(smsCampaignUserId, 'sms-broadcast', 24, 'sms-campaign-1', 50);
  assert.equal(smsCampaignRedemption?.credit.smsRecipientsCount, 50, 'SMS campaign credit matches its configured recipient cap');
  assert.equal(await SubscriptionUsageRepository.restoreCampaignCredit(smsCampaignUserId, 'sms-broadcast', 24, 'sms-campaign-1', 50), true, 'rejected SMS campaign restores the exact recipient credit');

  const manualActivationUserId = 'manual-subscription-activation-test-user';
  await UserRepository.createAsync({ id: manualActivationUserId, email: 'manual-subscription-test@example.com', walletBalance: 0, membershipStatus: 'Inactive' });
  const manualTransaction = PaymentRepository.create({
    id: 'manual-subscription-activation-transaction',
    type: 'Subscription',
    status: 'Pending',
    userId: manualActivationUserId,
    userEmail: 'manual-subscription-test@example.com',
    plan: 'Master Notification + Campaign Plan',
    amount: 1000,
    paymentMethod: 'Bank Transfer',
    packageSnapshot: {
      id: 'master-notification-campaign-plan',
      name: 'Master Notification + Campaign Plan',
      pricePkr: 1000,
      durationDays: 30,
      featureSnapshots: [
        { id: 'sms_alerts', label: 'SMS Alerts', durationDays: 30, includedSlots: 0, slotDurationDays: 30, unlimitedMessages: false, monthlyMessageQuota: 50 },
        { id: 'campaign_credits', label: 'Campaign Credits', durationDays: 30, includedSlots: 0, slotDurationDays: 30, campaignCredits: [{ placement: 'sidebar', durationHours: 168, quantity: 2 }] }
      ]
    }
  });
  const approvedManualTransaction = await PaymentRepository.verify(manualTransaction.id, 'approve');
  assert.equal(approvedManualTransaction.status, 'Success', 'manual subscription approval completes successfully');
  const activatedManualUser = await UserRepository.getByIdAsync(manualActivationUserId);
  assert.deepEqual(activatedManualUser.subscriptionFeatureIds, ['sms_alerts', 'campaign_credits'], 'manual approval grants all purchased feature IDs');
  assert.equal(activatedManualUser.subscriptionEntitlements.sms_alerts.monthlyMessageQuota, 50, 'manual approval grants the purchased message quota');
  assert.equal(activatedManualUser.subscriptionEntitlements.campaign_credits.campaignCredits[0].remaining, 2, 'manual approval grants campaign credits');

  const unlimitedUserId = 'subscription-message-unlimited-test-user';
  await UserRepository.createAsync({
    id: unlimitedUserId, walletBalance: 0, membershipStatus: 'Active', subscriptionExpiresAt: future,
    subscriptionFeatureIds: ['whatsapp_alerts'],
    subscriptionEntitlements: { whatsapp_alerts: { enabled: true, expiresAt: future, unlimitedMessages: true } }
  });
  const unlimitedReservation = await SubscriptionUsageRepository.reserveMessageQuota(unlimitedUserId, 'whatsapp_alerts', 'unlimited-event');
  assert.equal(unlimitedReservation.ok, true, 'explicit Unlimited entitlement does not enforce a numeric cap');
  const noExpiryUserId = 'subscription-message-no-expiry-test-user';
  await UserRepository.createAsync({
    id: noExpiryUserId, walletBalance: 0, membershipStatus: 'Active',
    subscriptionEntitlements: { sms_alerts: { enabled: true, unlimitedMessages: true } }
  });
  const noExpiryReservation = await SubscriptionUsageRepository.reserveMessageQuota(noExpiryUserId, 'sms_alerts', 'no-expiry-event');
  assert.equal(noExpiryReservation.reason, 'unavailable', 'missing subscription expiry fails closed');

  console.log('Subscription entitlement tests passed (50 assertions).');
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
