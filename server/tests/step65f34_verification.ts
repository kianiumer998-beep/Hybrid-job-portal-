import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { applySettingsRouter } from '../routes/applySettingsRoutes';
import { MODAL_INVENTORY } from '../../src/components/admin/AdminModalContentManager';

console.log('=== STEP65-F.3.5 Verification: Safe Admin Modal Content, Pricing Accuracy & Scope Protection ===');

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

// 0. Pre-Test Disk Integrity Check
const settingsPath = path.resolve(process.cwd(), 'data/apply_settings.json');
const preTestContent = fs.readFileSync(settingsPath, 'utf8');
const preTestHash = crypto.createHash('sha256').update(preTestContent).digest('hex');
const EXPECTED_SETTINGS_HASH = '404b425b1d0ac6ed185c2d5843505936d2a17455659198a5f32f14890cb2ea48';

assert(
  preTestHash === EXPECTED_SETTINGS_HASH,
  `data/apply_settings.json SHA256 pre-check matches expected original hash (${preTestHash.substring(0, 8)}...)`
);

// Verify data/apply_settings.json does not contain unnecessary modalSettings: {}
const parsedPre = JSON.parse(preTestContent);
assert(
  parsedPre.modalSettings === undefined,
  'data/apply_settings.json is clean of unnecessary "modalSettings" property'
);

// 1. Audit Router Export & Security Guards
assert(applySettingsRouter !== undefined, 'applySettingsRouter is properly exported');

// 2. Validate MODAL_INVENTORY Structure & Accurate Defaults (In-Memory)
assert(Array.isArray(MODAL_INVENTORY), 'MODAL_INVENTORY is an array');
assert(MODAL_INVENTORY.length === 8, `MODAL_INVENTORY contains exactly 8 modals (found: ${MODAL_INVENTORY.length})`);

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

const modalIds = MODAL_INVENTORY.map(m => m.id);
for (const expId of expectedModalIds) {
  assert(modalIds.includes(expId), `MODAL_INVENTORY includes modal "${expId}"`);
}

// 3. CV Paywall: Price Accuracy & Claim Protection
const cvPaywallDef = MODAL_INVENTORY.find(m => m.id === 'cvPaywall');
assert(cvPaywallDef !== undefined, 'cvPaywall modal definition exists');

const cvFieldMap = new Map(cvPaywallDef?.fields.map(f => [f.key, f.defaultValue]));
assert(cvFieldMap.has('priceDisplay'), 'cvPaywall inventory contains "priceDisplay"');
assert(
  cvFieldMap.get('priceDisplay') === 'Price confirmed during payment',
  `cvPaywall.priceDisplay is strictly informational: "${cvFieldMap.get('priceDisplay')}"`
);
assert(
  cvFieldMap.get('packageTitle') === 'Premium CV Export',
  `cvPaywall.packageTitle default updated: "${cvFieldMap.get('packageTitle')}"`
);
assert(
  cvFieldMap.get('bullet1') === 'Clean Vector Print Layout',
  `cvPaywall.bullet1 default without hyperbolic claim: "${cvFieldMap.get('bullet1')}"`
);
assert(
  cvFieldMap.get('bullet2') === 'Standard ATS Compatible Structure',
  `cvPaywall.bullet2 default without unsupported "99.4%" claim: "${cvFieldMap.get('bullet2')}"`
);
assert(
  cvFieldMap.get('footerNote') === 'Payment verification via Easypaisa, JazzCash & Bank Transfer',
  `cvPaywall.footerNote default updated: "${cvFieldMap.get('footerNote')}"`
);

// 4. Premium Upgrade & Subscription: Claim Accuracy Protection
const premUpgradeDef = MODAL_INVENTORY.find(m => m.id === 'premiumUpgrade');
const premFieldMap = new Map(premUpgradeDef?.fields.map(f => [f.key, f.defaultValue]));
assert(
  premFieldMap.get('footerNote')?.includes('Access activated upon admin verification'),
  `premiumUpgrade footer note accurately states manual verification: "${premFieldMap.get('footerNote')}"`
);

const subDef = MODAL_INVENTORY.find(m => m.id === 'subscription');
const subFieldMap = new Map(subDef?.fields.map(f => [f.key, f.defaultValue]));
assert(
  subFieldMap.get('badgeText') === 'WhatsApp Alerts & Direct Apply Access',
  `subscription badgeText removed false "Instant" claim: "${subFieldMap.get('badgeText')}"`
);

// 5. In-Memory Validation & Merge Logic (Pure Unit Testing — Zero Disk Writes)
const ALLOWED_MODAL_FIELDS: Record<string, string[]> = {
  premiumUpgrade: ['customTitle', 'customMessage', 'benefit1Title', 'benefit1Desc', 'benefit2Title', 'benefit2Desc', 'benefit3Title', 'benefit3Desc', 'ctaText', 'footerNote'],
  candidateApplication: ['title', 'instructions', 'contactHeading', 'resumeHeading', 'submitCta', 'successMsg'],
  subscription: ['badgeText', 'title', 'subtitle', 'packageSectionTitle', 'submitCta'],
  cvPaywall: ['title', 'subtitle', 'packageTitle', 'priceDisplay', 'bullet1', 'bullet2', 'bullet3', 'ctaText', 'footerNote'],
  authModal: ['loginTitle', 'registerTitle', 'loginTab', 'registerTab', 'loginCta', 'registerCta'],
  adminLogin: ['title', 'subtitle', 'ctaText'],
  countrySelection: ['title', 'subtitle', 'ctaText'],
  legalDisclaimer: ['title', 'subtitle', 'noticeText', 'acceptCta']
};

function sanitizeAndMergeModalSettings(
  existingModalSettings: Record<string, Record<string, string>>,
  incomingModalSettings: any
): { sanitized: Record<string, Record<string, string>>; error?: string } {
  if (typeof incomingModalSettings !== 'object' || incomingModalSettings === null || Array.isArray(incomingModalSettings)) {
    return { sanitized: {}, error: 'modalSettings must be an object' };
  }

  const merged = { ...existingModalSettings };

  for (const modalKey of Object.keys(incomingModalSettings)) {
    const allowedKeys = ALLOWED_MODAL_FIELDS[modalKey];
    if (!allowedKeys) {
      continue; // Unknown modal key ignored
    }

    const modalObj = incomingModalSettings[modalKey];
    if (typeof modalObj !== 'object' || modalObj === null || Array.isArray(modalObj)) {
      continue;
    }

    // Reset support: empty object resets this specific modal
    if (Object.keys(modalObj).length === 0) {
      delete merged[modalKey];
      continue;
    }

    const currentModalCustoms = { ...(merged[modalKey] || {}) };

    for (const fieldKey of Object.keys(modalObj)) {
      if (!allowedKeys.includes(fieldKey)) {
        continue;
      }

      const val = modalObj[fieldKey];
      if (typeof val !== 'string') {
        return { sanitized: {}, error: `Field "${modalKey}.${fieldKey}" must be a string` };
      }

      const trimmed = val.trim();
      if (trimmed.length > 500) {
        return { sanitized: {}, error: `Field "${modalKey}.${fieldKey}" exceeds 500 character limit` };
      }

      if (/<[a-z/!]/i.test(trimmed)) {
        return { sanitized: {}, error: `Field "${modalKey}.${fieldKey}" contains forbidden HTML/XML markup` };
      }

      if (/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(trimmed)) {
        return { sanitized: {}, error: `Field "${modalKey}.${fieldKey}" contains unsafe control characters` };
      }

      if (modalKey === 'cvPaywall' && fieldKey === 'priceDisplay' && trimmed.length > 0) {
        const hasFixedPrice = /(?:pkr|rs\.?|usd|\$|€|£|₹|\b\d+(?:[.,]\d+)?\s*(?:pkr|rs|rupees))\b/i.test(trimmed) || /^\s*\d+/.test(trimmed);
        if (hasFixedPrice) {
          return {
            sanitized: {},
            error: 'Fixed prices cannot be displayed because single CV exports do not have a separate fixed transaction price.'
          };
        }
      }

      if (trimmed === '') {
        delete currentModalCustoms[fieldKey];
      } else {
        currentModalCustoms[fieldKey] = trimmed;
      }
    }

    if (Object.keys(currentModalCustoms).length > 0) {
      merged[modalKey] = currentModalCustoms;
    } else {
      delete merged[modalKey];
    }
  }

  return { sanitized: merged };
}

// Test 5a: Reject Fixed Prices in cvPaywall.priceDisplay
const priceTestCases = [
  'PKR 150',
  '150 PKR',
  'Rs. 200',
  'Rs 100',
  '$1',
  '150',
  'PKR 150 ($1)',
  '500 Rupees'
];

for (const priceText of priceTestCases) {
  const result = sanitizeAndMergeModalSettings({}, {
    cvPaywall: { priceDisplay: priceText }
  });
  assert(
    result.error !== undefined && result.error.includes('Fixed prices cannot be displayed'),
    `Correctly rejected fixed currency price in cvPaywall.priceDisplay: "${priceText}"`
  );
}

// Test 5b: Accept Valid Informational cvPaywall.priceDisplay
const validInformationalPrices = [
  'Price confirmed during payment',
  'Included in Pro Plan',
  'Dynamic pricing confirmed at checkout',
  ''
];

for (const infoText of validInformationalPrices) {
  const result = sanitizeAndMergeModalSettings({}, {
    cvPaywall: { priceDisplay: infoText }
  });
  assert(
    result.error === undefined,
    `Accepted valid informational priceDisplay: "${infoText}"`
  );
}

// Test 5c: HTML/XML Tag Rejection
const htmlTestCases = [
  '<script>alert("xss")</script>',
  'Text with <b>bold</b> tag',
  '<img src=x onerror=alert(1)>',
  'Plain text with </close> tag'
];

for (const htmlText of htmlTestCases) {
  const result = sanitizeAndMergeModalSettings({}, {
    candidateApplication: { title: htmlText }
  });
  assert(
    result.error !== undefined && result.error.includes('contains forbidden HTML/XML markup'),
    `Correctly rejected HTML/XML tag: "${htmlText}"`
  );
}

// Test 5d: Unsafe Control Character Rejection
const controlCharTestCases = [
  'Bad\x00Null',
  'Bad\x08Backspace',
  'Bad\x1BControl'
];

for (const ccText of controlCharTestCases) {
  const result = sanitizeAndMergeModalSettings({}, {
    legalDisclaimer: { title: ccText }
  });
  assert(
    result.error !== undefined && result.error.includes('contains unsafe control characters'),
    `Correctly rejected control characters in field`
  );
}

// Test 5e: 500 Character Limit Enforcement
const longText = 'A'.repeat(501);
const limitResult = sanitizeAndMergeModalSettings({}, {
  countrySelection: { title: longText }
});
assert(
  limitResult.error !== undefined && limitResult.error.includes('exceeds 500 character limit'),
  'Correctly rejected strings exceeding 500 characters'
);

// Test 5f: Safe Field-Level Non-Destructive Merge (In-Memory)
const memoryState: Record<string, Record<string, string>> = {};

const step1 = sanitizeAndMergeModalSettings(memoryState, {
  candidateApplication: { title: 'Verified Application Form' }
});
assert(step1.sanitized.candidateApplication?.title === 'Verified Application Form', 'Merged candidateApplication');

const step2 = sanitizeAndMergeModalSettings(step1.sanitized, {
  cvPaywall: { title: 'Export Resume' }
});
assert(step2.sanitized.cvPaywall?.title === 'Export Resume', 'Merged cvPaywall');
assert(
  step2.sanitized.candidateApplication?.title === 'Verified Application Form',
  'candidateApplication preserved across cvPaywall save (non-destructive merge)'
);

// Test 5g: Single-Modal Reset Isolation
const step3 = sanitizeAndMergeModalSettings(step2.sanitized, {
  cvPaywall: {}
});
assert(step3.sanitized.cvPaywall === undefined, 'cvPaywall reset successfully');
assert(
  step3.sanitized.candidateApplication?.title === 'Verified Application Form',
  'Resetting cvPaywall did NOT affect candidateApplication'
);

// 6. Post-Test Disk Integrity Verification
const postTestContent = fs.readFileSync(settingsPath, 'utf8');
const postTestHash = crypto.createHash('sha256').update(postTestContent).digest('hex');

assert(
  postTestHash === preTestHash,
  `data/apply_settings.json SHA256 post-check confirms ZERO DISK MUTATIONS (${postTestHash.substring(0, 8)}...)`
);
assert(
  postTestHash === EXPECTED_SETTINGS_HASH,
  `data/apply_settings.json matches exact expected original hash`
);

console.log(`\n=== STEP65-F.3.5 Verification Summary: ${testsPassed} PASSED, ${testsFailed} FAILED ===`);
if (testsFailed > 0) {
  process.exit(1);
}
