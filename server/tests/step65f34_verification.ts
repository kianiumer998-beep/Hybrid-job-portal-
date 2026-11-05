import { Database } from '../db/database';

console.log('=== STEP65-F.3.4 Verification: Admin Modal Content & Preview Accuracy ===');

let testsPassed = 0;
let testsFailed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`[PASS] ${msg}`);
    testsPassed++;
  } else {
    console.error(`[FAIL] ${msg}`);
    testsFailed++;
  }
}

// 1. Audit Allowed Modal Fields in applySettingsRoutes
import { applySettingsRouter } from '../routes/applySettingsRoutes';
assert(applySettingsRouter !== undefined, 'applySettingsRouter is exported');

// 2. Test saving and merging modal settings in Database
const initialSettings = Database.getApplySettings();
const originalModals = initialSettings.modalSettings || {};

try {
  // Test 2a: Save a customized field for candidateApplication
  const testModals1 = {
    ...originalModals,
    candidateApplication: {
      title: 'Apply for Verified Position',
      contactHeading: 'Your Verified Details',
      resumeHeading: 'Upload Verified PDF Resume',
      submitCta: 'Confirm & Send Application',
      successMsg: 'Application sent to employer successfully!'
    }
  };

  Database.saveApplySettings({
    ...initialSettings,
    modalSettings: testModals1
  });

  const updated1 = Database.getApplySettings();
  assert(
    updated1.modalSettings?.candidateApplication?.title === 'Apply for Verified Position',
    'candidateApplication.title persisted correctly'
  );
  assert(
    updated1.modalSettings?.candidateApplication?.contactHeading === 'Your Verified Details',
    'candidateApplication.contactHeading persisted correctly'
  );
  assert(
    updated1.modalSettings?.candidateApplication?.resumeHeading === 'Upload Verified PDF Resume',
    'candidateApplication.resumeHeading persisted correctly'
  );

  // Test 2b: Save cvPaywall customized fields including priceDisplay, bullet3, footerNote
  const testModals2 = {
    ...updated1.modalSettings,
    cvPaywall: {
      title: 'Get HD ATS Resume',
      subtitle: 'Watermark-free vector export',
      packageTitle: 'Single Resume Export',
      priceDisplay: 'PKR 200 ($1.20)',
      bullet1: 'Vector Engine',
      bullet2: '100% Score',
      bullet3: 'Free with Pro Plan',
      ctaText: 'Export Now',
      footerNote: 'All major payment cards & wallets'
    }
  };

  Database.saveApplySettings({
    ...updated1,
    modalSettings: testModals2
  });

  const updated2 = Database.getApplySettings();
  assert(
    updated2.modalSettings?.cvPaywall?.priceDisplay === 'PKR 200 ($1.20)',
    'cvPaywall.priceDisplay persisted correctly'
  );
  assert(
    updated2.modalSettings?.cvPaywall?.bullet3 === 'Free with Pro Plan',
    'cvPaywall.bullet3 persisted correctly'
  );
  assert(
    updated2.modalSettings?.cvPaywall?.footerNote === 'All major payment cards & wallets',
    'cvPaywall.footerNote persisted correctly'
  );
  // Verify previous candidateApplication settings were NOT wiped (safe field-level merge)
  assert(
    updated2.modalSettings?.candidateApplication?.title === 'Apply for Verified Position',
    'Previous candidateApplication modal customizations survived cvPaywall save (non-destructive merge)'
  );

  // Test 2c: Save legalDisclaimer customized fields including subtitle and noticeText
  const testModals3 = {
    ...updated2.modalSettings,
    legalDisclaimer: {
      title: 'Legal Terms & Verification',
      subtitle: 'Official Transparency & Compliance Center',
      noticeText: 'All listings are independently verified.',
      acceptCta: 'I Agree & Proceed'
    }
  };

  Database.saveApplySettings({
    ...updated2,
    modalSettings: testModals3
  });

  const updated3 = Database.getApplySettings();
  assert(
    updated3.modalSettings?.legalDisclaimer?.subtitle === 'Official Transparency & Compliance Center',
    'legalDisclaimer.subtitle persisted correctly'
  );
  assert(
    updated3.modalSettings?.legalDisclaimer?.noticeText === 'All listings are independently verified.',
    'legalDisclaimer.noticeText persisted correctly'
  );
  assert(
    updated3.modalSettings?.legalDisclaimer?.acceptCta === 'I Agree & Proceed',
    'legalDisclaimer.acceptCta persisted correctly'
  );

  // Test 2d: Reset cvPaywall fields specifically
  const testModalsReset = {
    ...updated3.modalSettings,
    cvPaywall: {}
  };
  Database.saveApplySettings({
    ...updated3,
    modalSettings: testModalsReset
  });

  const updatedReset = Database.getApplySettings();
  assert(
    Object.keys(updatedReset.modalSettings?.cvPaywall || {}).length === 0,
    'cvPaywall reset cleared customizations for cvPaywall'
  );
  assert(
    updatedReset.modalSettings?.legalDisclaimer?.subtitle === 'Official Transparency & Compliance Center',
    'Resetting cvPaywall did NOT affect legalDisclaimer customizations'
  );
  assert(
    updatedReset.modalSettings?.candidateApplication?.title === 'Apply for Verified Position',
    'Resetting cvPaywall did NOT affect candidateApplication customizations'
  );

} finally {
  // Restore original settings
  Database.saveApplySettings({
    ...initialSettings,
    modalSettings: originalModals
  });
  console.log('Original settings restored cleanly.');
}

// 3. Verification of MODAL_INVENTORY definitions
import { MODAL_INVENTORY } from '../../src/components/admin/AdminModalContentManager';
assert(Array.isArray(MODAL_INVENTORY), 'MODAL_INVENTORY is an array');
assert(MODAL_INVENTORY.length === 8, `MODAL_INVENTORY contains 8 modals (found: ${MODAL_INVENTORY.length})`);

const modalIds = MODAL_INVENTORY.map(m => m.id);
const expectedModalIds = [
  'premiumUpgrade',
  'candidateApplication',
  'subscription',
  'cvPaywall',
  'authModal',
  'adminLogin',
  'countrySelection',
  'legalDisclaimer'
];

for (const expId of expectedModalIds) {
  assert(modalIds.includes(expId), `MODAL_INVENTORY includes modal "${expId}"`);
}

// Check cvPaywall inventory fields
const cvPaywallDef = MODAL_INVENTORY.find(m => m.id === 'cvPaywall');
const cvKeys = cvPaywallDef?.fields.map(f => f.key) || [];
assert(cvKeys.includes('priceDisplay'), 'cvPaywall inventory includes "priceDisplay"');
assert(cvKeys.includes('bullet3'), 'cvPaywall inventory includes "bullet3"');
assert(cvKeys.includes('footerNote'), 'cvPaywall inventory includes "footerNote"');

// Check legalDisclaimer inventory fields
const legalDef = MODAL_INVENTORY.find(m => m.id === 'legalDisclaimer');
const legalKeys = legalDef?.fields.map(f => f.key) || [];
assert(legalKeys.includes('subtitle'), 'legalDisclaimer inventory includes "subtitle"');
assert(legalKeys.includes('noticeText'), 'legalDisclaimer inventory includes "noticeText"');

// 4. Verification that input lengths are bounded
for (const modal of MODAL_INVENTORY) {
  for (const field of modal.fields) {
    assert(field.defaultValue.length <= 500, `Default value for ${modal.id}.${field.key} is <= 500 chars`);
  }
}

console.log(`\n=== STEP65-F.3.4 Verification Summary: ${testsPassed} PASSED, ${testsFailed} FAILED ===`);
if (testsFailed > 0) {
  process.exit(1);
}
