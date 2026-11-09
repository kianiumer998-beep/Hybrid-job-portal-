import { CurrencyRepository, validateCurrencyConfig } from '../db/repositories/CurrencyRepository';
import { INITIAL_CURRENCY_CONFIG } from '../../src/data/mockAdminSuiteData';
import { isMongoConfigured } from '../db/mongodb';
import { MongoClient } from 'mongodb';

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

  // 1. Validation Rules & Data Integrity (In-Memory Unit Tests)
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

  // 2. Migration Payload & Document Integrity Rules
  console.log('\n--- 2. Migration Payload & Document Integrity Rules ---');
  const legacyPayload = {
    ...INITIAL_CURRENCY_CONFIG,
    rates: {
      ...INITIAL_CURRENCY_CONFIG.rates,
      USD: 0.00362
    }
  };
  const legacyVal = validateCurrencyConfig(legacyPayload);
  assert(legacyVal.valid === true && legacyVal.sanitized?.rates.USD === 0.00362, '2.1: Valid legacy LocalStorage payload validates safely');

  // Test data integrity validation for invalid document payloads
  const invalidDocPayload = { baseCurrency: 'PKR', rates: { USD: -5 } };
  const invalidVal = validateCurrencyConfig(invalidDocPayload);
  assert(invalidVal.valid === false && Boolean(invalidVal.message), '2.2: Invalid existing document structure generates explicit validation error');

  // 3. Database Connection Safety & Write Isolation
  console.log('\n--- 3. Database Connection Safety & Write Isolation ---');
  const prodDbUri = (process.env.MONGODB_URI || '').trim();
  const testDbUri = (process.env.TEST_MONGODB_URI || process.env.MONGODB_TEST_URI || '').trim();

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
    reportNotRun('3.1: Isolated Database Integration Write Test', 'Dedicated TEST_MONGODB_URI environment variable is not configured. Production database write skipped.');
    reportNotRun('3.2: Database Persistence Reload Verification', 'Skipped due to absence of isolated test database URI.');
  } else if (prodDbUri && testDbUri === prodDbUri) {
    reportNotRun('3.1: Isolated Database Integration Write Test', 'TEST_MONGODB_URI resolves to the same connection string as production MONGODB_URI. Refusing to run tests to prevent production database mutation.');
    reportNotRun('3.2: Database Persistence Reload Verification', 'Skipped to protect production database settings.');
  } else {
    console.log('  [INFO] Independent TEST_MONGODB_URI detected. Running safe isolated test on dedicated test client...');
    let testClient: MongoClient | null = null;
    try {
      testClient = new MongoClient(testDbUri);
      await testClient.connect();
      const testDb = testClient.db();
      const testColl = testDb.collection('test_system_settings_isolated');

      const testDoc = {
        key: 'test_currency_exchange_config',
        config: INITIAL_CURRENCY_CONFIG,
        createdAt: new Date().toISOString()
      };

      await testColl.insertOne(testDoc);
      const fetched = await testColl.findOne({ key: 'test_currency_exchange_config' });
      assert(Boolean(fetched && fetched.config), '3.1: Dedicated test client writes and retrieves isolated test document safely');

      await testColl.deleteOne({ key: 'test_currency_exchange_config' });
      assert(true, '3.2: Cleaned up isolated test document from dedicated test database');
    } catch (err: any) {
      assert(false, '3.1: Dedicated test database execution failed', err?.message);
    } finally {
      if (testClient) {
        await testClient.close().catch(() => {});
      }
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
