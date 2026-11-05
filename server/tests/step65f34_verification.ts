import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  applySettingsRouter,
  ALLOWED_MODAL_FIELDS,
  isCvPaywallPriceRejected,
  validateModalField,
  sanitizeAndMergeModalSettings
} from '../routes/applySettingsRoutes';
import { MODAL_INVENTORY } from '../../src/components/admin/AdminModalContentManager';

console.log('=== STEP65-F.3.6 Verification: Server-Side CV Paywall Price Validation & Scope Protection ===');

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

const parsedPre = JSON.parse(preTestContent);
assert(
  parsedPre.modalSettings === undefined,
  'data/apply_settings.json is clean of unnecessary "modalSettings" property'
);

// 1. Router & Export Integrity
assert(applySettingsRouter !== undefined, 'applySettingsRouter is properly exported');
assert(typeof isCvPaywallPriceRejected === 'function', 'isCvPaywallPriceRejected helper exported from route file');
assert(typeof validateModalField === 'function', 'validateModalField helper exported from route file');
assert(typeof sanitizeAndMergeModalSettings === 'function', 'sanitizeAndMergeModalSettings helper exported from route file');

// 2. Exercise Actual Backend Helper: isCvPaywallPriceRejected
console.log('\n--- Section 2: Exercise Actual Backend isCvPaywallPriceRejected Helper ---');

const REQUIRED_REJECTED_FORMATS = [
  'PKR 150',
  '150 PKR',
  'Rs. 150',
  '150 rupees',
  '$1',
  'USD 1',
  'EUR 150',
  '150 euros',
  'GBP 150',
  '£150',
  '€150',
  '₹150',
  'INR 150',
  '150',          // numeric-only integer
  '150.00',       // numeric-only decimal
  '150,00',       // numeric-only comma decimal
  '150/-',        // numeric-only currency notation
  '150 USD',      // digits followed by USD
  '150 EUR',      // digits followed by EUR
  '150 GBP',      // digits followed by GBP
  '150 INR',      // digits followed by INR
  '150$',         // digits directly followed by $
  '150€',         // digits directly followed by €
  '150£',         // digits directly followed by £
  '150₹'          // digits directly followed by ₹
];

for (const price of REQUIRED_REJECTED_FORMATS) {
  const rejected = isCvPaywallPriceRejected(price);
  assert(rejected === true, `isCvPaywallPriceRejected correctly rejected: "${price}"`);
}

const REQUIRED_ALLOWED_FORMATS = [
  'Price confirmed during payment',
  'Included in Pro Plan',
  'Free with active subscription',
  'Dynamic checkout confirmation',
  '',
  '   '
];

for (const text of REQUIRED_ALLOWED_FORMATS) {
  const rejected = isCvPaywallPriceRejected(text);
  assert(rejected === false, `isCvPaywallPriceRejected correctly allowed: "${text}"`);
}

// 3. Exercise Actual Backend Helper: validateModalField
console.log('\n--- Section 3: Exercise Actual Backend validateModalField Helper ---');

// 3a: CV Paywall Price Validation via validateModalField
for (const price of REQUIRED_REJECTED_FORMATS) {
  const res = validateModalField('cvPaywall', 'priceDisplay', price);
  assert(
    res.valid === false && res.error?.includes('cannot be a fixed monetary price'),
    `validateModalField rejected fixed price: "${price}"`
  );
}

const validPriceRes = validateModalField('cvPaywall', 'priceDisplay', 'Price confirmed during payment');
assert(validPriceRes.valid === true, 'validateModalField allowed "Price confirmed during payment"');

// 3b: HTML/XML Tag Rejection
const htmlTestCases = [
  '<script>alert("xss")</script>',
  'Text with <b>bold</b> tag',
  '<img src=x onerror=alert(1)>',
  'Plain text with </close> tag'
];

for (const html of htmlTestCases) {
  const res = validateModalField('candidateApplication', 'title', html);
  assert(
    res.valid === false && res.error?.includes('contains forbidden HTML/XML markup'),
    `validateModalField rejected HTML/XML tag: "${html}"`
  );
}

// 3c: Control Character Rejection
const controlCharTestCases = [
  'Bad\x00Null',
  'Bad\x08Backspace',
  'Bad\x1BControl'
];

for (const cc of controlCharTestCases) {
  const res = validateModalField('legalDisclaimer', 'title', cc);
  assert(
    res.valid === false && res.error?.includes('contains unsafe control characters'),
    'validateModalField rejected unsafe control characters'
  );
}

// 3d: 500-Character Limit
const exactly500 = 'A'.repeat(500);
const res500 = validateModalField('countrySelection', 'title', exactly500);
assert(res500.valid === true, 'validateModalField accepted exactly 500 characters');

const over500 = 'A'.repeat(501);
const resOver500 = validateModalField('countrySelection', 'title', over500);
assert(
  resOver500.valid === false && resOver500.error?.includes('is too long (max 500 chars)'),
  'validateModalField rejected 501 characters'
);

// 3e: Non-string values & invalid keys
const nonStringRes = validateModalField('countrySelection', 'title', 12345 as any);
assert(nonStringRes.valid === false && nonStringRes.error?.includes('must be a string'), 'validateModalField rejected non-string value');

const unknownFieldRes = validateModalField('cvPaywall', 'unknownField', 'test');
assert(unknownFieldRes.valid === false && unknownFieldRes.error?.includes('Unsupported field key'), 'validateModalField rejected unknown field key');

const unknownModalRes = validateModalField('nonExistentModal', 'title', 'test');
assert(unknownModalRes.valid === false && unknownModalRes.error?.includes('Unsupported modal ID'), 'validateModalField rejected unknown modal ID');

// 4. Exercise Actual Backend Helper: sanitizeAndMergeModalSettings
console.log('\n--- Section 4: Exercise Actual Backend sanitizeAndMergeModalSettings Helper ---');

// 4a: Field-Level Merge Preservation across different modals
const state0: Record<string, Record<string, string>> = {};
const step1 = sanitizeAndMergeModalSettings(state0, {
  candidateApplication: {
    title: 'Verified Application Form',
    contactHeading: 'Candidate Contact Credentials'
  }
});
assert(step1.success === true, 'Saved candidateApplication modal settings');
assert(step1.merged?.candidateApplication?.title === 'Verified Application Form', 'Candidate title saved');

const step2 = sanitizeAndMergeModalSettings(step1.merged, {
  cvPaywall: {
    title: 'Export Verified Resume',
    priceDisplay: 'Price confirmed during payment'
  }
});
assert(step2.success === true, 'Saved cvPaywall modal settings');
assert(
  step2.merged?.candidateApplication?.title === 'Verified Application Form' &&
  step2.merged?.candidateApplication?.contactHeading === 'Candidate Contact Credentials',
  'Field-level merge preserved candidateApplication settings when cvPaywall was saved'
);
assert(
  step2.merged?.cvPaywall?.title === 'Export Verified Resume' &&
  step2.merged?.cvPaywall?.priceDisplay === 'Price confirmed during payment',
  'cvPaywall settings saved alongside existing modals'
);

// 4b: Field-Level Merge Preservation within the same modal
const step3 = sanitizeAndMergeModalSettings(step2.merged, {
  candidateApplication: {
    title: 'Updated Application Title'
  }
});
assert(step3.success === true, 'Updated only title in candidateApplication');
assert(
  step3.merged?.candidateApplication?.title === 'Updated Application Title',
  'candidateApplication title updated'
);
assert(
  step3.merged?.candidateApplication?.contactHeading === 'Candidate Contact Credentials',
  'candidateApplication contactHeading preserved during partial field update'
);
assert(
  step3.merged?.cvPaywall?.title === 'Export Verified Resume',
  'cvPaywall settings preserved during candidateApplication partial update'
);

// 4c: Reset Isolation
const step4 = sanitizeAndMergeModalSettings(step3.merged, {
  cvPaywall: {}
});
assert(step4.success === true, 'Reset cvPaywall with empty object');
assert(
  Object.keys(step4.merged?.cvPaywall || {}).length === 0,
  'cvPaywall customizations cleared upon reset'
);
assert(
  step4.merged?.candidateApplication?.title === 'Updated Application Title' &&
  step4.merged?.candidateApplication?.contactHeading === 'Candidate Contact Credentials',
  'Resetting cvPaywall did NOT affect candidateApplication customizations'
);

// 4d: Full Payload Price Rejection
const badPricePayload = sanitizeAndMergeModalSettings(step4.merged, {
  cvPaywall: {
    priceDisplay: 'PKR 150'
  }
});
assert(
  badPricePayload.success === false && badPricePayload.error?.includes('cannot be a fixed monetary price'),
  'sanitizeAndMergeModalSettings rejected full payload with fixed price "PKR 150"'
);

// 4e: Full Payload HTML Rejection
const badHtmlPayload = sanitizeAndMergeModalSettings(step4.merged, {
  candidateApplication: {
    title: '<script>alert(1)</script>'
  }
});
assert(
  badHtmlPayload.success === false && badHtmlPayload.error?.includes('contains forbidden HTML/XML markup'),
  'sanitizeAndMergeModalSettings rejected full payload with HTML tag'
);

// 4f: Invalid Payload Structure Rejection
assert(sanitizeAndMergeModalSettings({}, null as any).success === false, 'Rejected null modalSettings');
assert(sanitizeAndMergeModalSettings({}, [] as any).success === false, 'Rejected array modalSettings');
assert(sanitizeAndMergeModalSettings({}, 'string' as any).success === false, 'Rejected string modalSettings');

// 5. MODAL_INVENTORY Verification
console.log('\n--- Section 5: Verify MODAL_INVENTORY ---');
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

// 6. Post-Test Disk Integrity Verification (Zero Disk Mutations Proof)
console.log('\n--- Section 6: Post-Test Disk Integrity Verification ---');
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

console.log(`\n=== STEP65-F.3.6 Verification Summary: ${testsPassed} PASSED, ${testsFailed} FAILED ===`);
if (testsFailed > 0) {
  process.exit(1);
}
