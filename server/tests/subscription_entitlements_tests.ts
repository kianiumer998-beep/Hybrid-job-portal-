process.env.IS_TEST = 'true';

import assert from 'node:assert/strict';
import { normalizeSubscriptionFeatureCatalog, resolveSubscriptionPackage } from '../services/subscriptionEntitlements';

function run() {
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
  console.log('Subscription entitlement tests passed (8 assertions).');
}

run();
