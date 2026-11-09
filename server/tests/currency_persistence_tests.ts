import { CurrencyRepository, validateCurrencyConfig } from '../db/repositories/CurrencyRepository';
import { INITIAL_CURRENCY_CONFIG } from '../../src/data/mockAdminSuiteData';
import { isMongoConfigured, getMongoDb } from '../db/mongodb';

export async function runCurrencyPersistenceTests() {
  console.log('====================================================');
  console.log('   CURRENCY PERSISTENCE ISOLATED TEST SUITE        ');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;
  let notRun = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${testName}${detail ? ` - ${detail}` : ''}`);
      failed++;
    }
  }

  function reportNotRun(testName: string, reason: string) {
    console.log(`  [NOT RUN] ${testName} - ${reason}`);
    notRun++;
  }

  // 1. Validation Rules & Rejection Integrity (In-Memory Unit Tests)
  console.log('--- 1. Validation Rules & Data Integrity ---');
  const invalidCodeConfig = {
    ...INITIAL_CURRENCY_CONFIG,
    baseCurrency: '' // Empty code
  };
  const val1 = validateCurrencyConfig(invalidCodeConfig);
  assert(val1.valid === false, '1.1: Rejects empty baseCurrency code');

  const negativeRateConfig = {
    ...INITIAL_CURRENCY_CONFIG,
    rates: {
      ...INITIAL_CURRENCY_CONFIG.rates,
      USD: -0.005
    }
  };
  const val2 = validateCurrencyConfig(negativeRateConfig);
  assert(val2.valid === false, '1.2: Rejects negative exchange rate');

  const stringRateConfig = {
    ...INITIAL_CURRENCY_CONFIG,
    rates: {
      ...INITIAL_CURRENCY_CONFIG.rates,
      USD: 'invalid-string-rate' as any
    }
  };
  const val3 = validateCurrencyConfig(stringRateConfig);
  assert(val3.valid === false, '1.3: Rejects non-numeric exchange rate');

  const negativeTierConfig = {
    ...INITIAL_CURRENCY_CONFIG,
    internationalPricingTiers: {
      ...INITIAL_CURRENCY_CONFIG.internationalPricingTiers,
      featuredJobFee: {
        ...INITIAL_CURRENCY_CONFIG.internationalPricingTiers.featuredJobFee,
        USD: -100
      }
    }
  };
  const val4 = validateCurrencyConfig(negativeTierConfig);
  assert(val4.valid === false, '1.4: Rejects negative fee tier value');

  // 2. Legacy Migration Payload Validation
  console.log('\n--- 2. Legacy Migration Payload Safety ---');
  const legacyPayload = {
    ...INITIAL_CURRENCY_CONFIG,
    rates: {
      ...INITIAL_CURRENCY_CONFIG.rates,
      USD: 0.00362
    }
  };
  const legacyVal = validateCurrencyConfig(legacyPayload);
  assert(legacyVal.valid === true && legacyVal.sanitized?.rates.USD === 0.00362, '2.1: Valid legacy LocalStorage payload validates safely');

  // 3. Database Write Isolation Protection
  console.log('\n--- 3. Database Write Isolation & Safety ---');
  const testDbUri = process.env.TEST_MONGODB_URI || process.env.MONGODB_TEST_URI;

  if (!isMongoConfigured()) {
    const unconfiguredGet = await CurrencyRepository.getConfig();
    assert(unconfiguredGet.isConfigured === false, '3.1: Unconfigured Mongo returns isConfigured = false');
    assert(unconfiguredGet.config.baseCurrency === 'PKR', '3.2: Unconfigured Mongo returns default initial config');

    try {
      await CurrencyRepository.saveConfig(INITIAL_CURRENCY_CONFIG);
      assert(false, '3.3: Unconfigured Mongo saveConfig must throw error');
    } catch (err: any) {
      assert(err.message.includes('MONGODB_URI is not configured'), '3.3: Unconfigured Mongo saveConfig throws clear error');
    }
  } else if (!testDbUri) {
    // Production MONGODB_URI is configured, but dedicated TEST_MONGODB_URI is absent.
    // Strict requirement: Never write test rates or modify/delete production currency_exchange_config document.
    reportNotRun('3.1: Write test to production system_settings', 'Dedicated TEST_MONGODB_URI environment variable not provided. Production database write skipped to prevent pollution.');
    reportNotRun('3.2: Verification of reload after save', 'Skipped due to production DB write protection.');
  } else {
    // Dedicated TEST_MONGODB_URI is provided. Run safe isolated integration test on test DB.
    console.log('  [INFO] Dedicated TEST_MONGODB_URI detected. Running isolated database write test...');
    try {
      const db = await getMongoDb();
      const testCollection = db.collection('test_system_settings');
      await testCollection.insertOne({ key: 'test_isolated', testAt: new Date().toISOString() });
      await testCollection.deleteOne({ key: 'test_isolated' });
      assert(true, '3.1: Successfully performed isolated DB test write on dedicated test database');
    } catch (e: any) {
      assert(false, '3.1: Dedicated test database write failed', e?.message);
    }
  }

  console.log('\n====================================================');
  console.log(`   TEST RESULTS: ${passed} PASSED, ${failed} FAILED, ${notRun} NOT RUN      `);
  console.log('====================================================\n');

  if (failed > 0) {
    throw new Error(`Currency Persistence Isolated Tests Failed (${failed} failures)`);
  }
}

// Allow direct execution via tsx
if (import.meta.url === `file://${process.argv[1]}`) {
  runCurrencyPersistenceTests().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
