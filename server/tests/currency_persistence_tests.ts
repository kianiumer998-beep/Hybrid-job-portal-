import { CurrencyRepository, validateCurrencyConfig } from '../db/repositories/CurrencyRepository';
import { INITIAL_CURRENCY_CONFIG } from '../../src/data/mockAdminSuiteData';
import { isMongoConfigured } from '../db/mongodb';
import { MongoClient } from 'mongodb';

export function isSafeDistinctTestUri(prodUri: string, testUri: string): { safe: boolean; reason?: string } {
  const cleanProd = (prodUri || '').trim();
  const cleanTest = (testUri || '').trim();

  if (!cleanProd) {
    return { safe: false, reason: 'Production MONGODB_URI is not configured or empty.' };
  }

  if (!cleanTest) {
    return { safe: false, reason: 'Dedicated TEST_MONGODB_URI / MONGODB_TEST_URI environment variable is not configured.' };
  }

  if (cleanTest.toLowerCase() === cleanProd.toLowerCase()) {
    return { safe: false, reason: 'TEST_MONGODB_URI is identical to production MONGODB_URI.' };
  }

  const parseDbInfo = (uri: string) => {
    try {
      if (!uri.startsWith('mongodb://') && !uri.startsWith('mongodb+srv://')) {
        return null;
      }
      const normalized = uri.replace(/^mongodb(\+srv)?:\/\//i, 'http://');
      const url = new URL(normalized);
      const host = (url.hostname || '').toLowerCase();
      const port = url.port || (uri.startsWith('mongodb+srv://') ? '27017' : '27017');
      const pathname = url.pathname.replace(/^\//, '').split('?')[0].trim().toLowerCase();
      const dbName = pathname || 'admin';

      if (!host) return null;
      return { host, port, dbName };
    } catch {
      return null;
    }
  };

  const prodInfo = parseDbInfo(cleanProd);
  const testInfo = parseDbInfo(cleanTest);

  // FAIL-CLOSED: If either URI cannot be parsed, refuse DB write tests
  if (!prodInfo) {
    return { safe: false, reason: 'Production MONGODB_URI could not be safely parsed for cluster isolation verification.' };
  }

  if (!testInfo) {
    return { safe: false, reason: 'TEST_MONGODB_URI could not be safely parsed for cluster isolation verification.' };
  }

  // Same database name is strictly rejected regardless of hostname variation
  if (prodInfo.dbName === testInfo.dbName) {
    return { safe: false, reason: `TEST_MONGODB_URI targets the same database name ("${testInfo.dbName}") as production MONGODB_URI.` };
  }

  // Refuse default 'admin' database name
  if (prodInfo.dbName === 'admin' || testInfo.dbName === 'admin') {
    return { safe: false, reason: 'Database name is default "admin" or unassigned; cannot verify isolated test database identity.' };
  }

  return { safe: true };
}

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
    baseCurrency: ''
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

  // 1.5. Database URI Isolation Fail-Closed Unit Tests
  console.log('\n--- 1.5. Database URI Isolation Fail-Closed Tests ---');
  const checkMissingProd = isSafeDistinctTestUri('', 'mongodb://127.0.0.1:27017/test_db');
  assert(checkMissingProd.safe === false, '1.5a: Rejects missing production MONGODB_URI');

  const checkMissingTest = isSafeDistinctTestUri('mongodb://127.0.0.1:27017/prod_db', '');
  assert(checkMissingTest.safe === false, '1.5b: Rejects missing TEST_MONGODB_URI');

  const checkMatching = isSafeDistinctTestUri('mongodb://127.0.0.1:27017/db', 'mongodb://127.0.0.1:27017/db');
  assert(checkMatching.safe === false, '1.5c: Rejects matching production and test URIs');

  const checkInvalidTest = isSafeDistinctTestUri('mongodb://127.0.0.1:27017/prod', 'not-a-valid-uri');
  assert(checkInvalidTest.safe === false, '1.5d: Fail-closed on invalid test URI');

  const checkInvalidProd = isSafeDistinctTestUri('not-a-valid-uri', 'mongodb://127.0.0.1:27017/test');
  assert(checkInvalidProd.safe === false, '1.5e: Fail-closed on invalid production URI');

  const checkSameDbDiffHost = isSafeDistinctTestUri('mongodb+srv://cluster0-node1.mongodb.net/prod_db', 'mongodb+srv://cluster0-node2.mongodb.net/prod_db');
  assert(checkSameDbDiffHost.safe === false, '1.5f: Rejects different hostnames sharing same database name');

  const checkValidDistinct = isSafeDistinctTestUri('mongodb://127.0.0.1:27017/prod_db', 'mongodb://127.0.0.1:27017/test_db');
  assert(checkValidDistinct.safe === true, '1.5g: Accepts distinct valid test database URI');

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

  const invalidDocPayload = { baseCurrency: 'PKR', rates: { USD: -5 } };
  const invalidVal = validateCurrencyConfig(invalidDocPayload);
  assert(invalidVal.valid === false && Boolean(invalidVal.message), '2.2: Invalid existing document structure generates explicit validation error');

  // 3. Database Connection Safety & Write Isolation Checks
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
  } else {
    const separationCheck = isSafeDistinctTestUri(prodDbUri, testDbUri);

    if (!separationCheck.safe) {
      reportNotRun('3.1: Actual CurrencyRepository.saveConfig() persistence test', separationCheck.reason || 'Test DB isolation check failed.');
      reportNotRun('3.2: Actual CurrencyRepository.getConfig() reload test', 'Skipped due to DB isolation check failure.');
      reportNotRun('3.3: CurrencyRepository rejection of invalid rate updates', 'Skipped due to DB isolation check failure.');
      reportNotRun('3.4: CurrencyRepository missing vs invalid document distinction', 'Skipped due to DB isolation check failure.');
    } else {
      console.log('  [INFO] Safe distinct TEST_MONGODB_URI confirmed. Running actual repository logic on isolated test collection...');
      let testClient: MongoClient | null = null;
      const createdKeys: string[] = [];
      const testRunId = `test_currency_config_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      try {
        testClient = new MongoClient(testDbUri);
        await testClient.connect();
        const testDb = testClient.db();
        const testColl = testDb.collection('test_system_settings_isolated');

        // Test 3.1: Actual CurrencyRepository.saveConfig()
        const testConfigPayload = {
          ...INITIAL_CURRENCY_CONFIG,
          lastSyncedAt: '2026-11-08 22:45 UTC',
          rates: {
            ...INITIAL_CURRENCY_CONFIG.rates,
            USD: 0.00359
          }
        };

        const savedResult = await CurrencyRepository.saveConfig(testConfigPayload, testColl, testRunId);
        createdKeys.push(testRunId);
        assert(savedResult.rates.USD === 0.00359, '3.1: CurrencyRepository.saveConfig() saves rates correctly to test collection');

        // Test 3.2: Actual CurrencyRepository.getConfig() reload
        const reloadedResult = await CurrencyRepository.getConfig(testColl, testRunId);
        assert(reloadedResult.isConfigured === true && reloadedResult.config.rates.USD === 0.00359, '3.2: CurrencyRepository.getConfig() reloads exact saved configuration');

        // Test 3.3: Rejection of invalid rates
        try {
          await CurrencyRepository.saveConfig(negativeRateConfig, testColl, testRunId);
          assert(false, '3.3: CurrencyRepository.saveConfig() should reject invalid rates');
        } catch (err: any) {
          assert(err.message.includes('Validation Error'), '3.3: CurrencyRepository.saveConfig() throws Validation Error on invalid payload');
        }

        // Test 3.4: Missing document returns isConfigured: false
        const missingKey = `${testRunId}_missing`;
        const missingResult = await CurrencyRepository.getConfig(testColl, missingKey);
        assert(missingResult.isConfigured === false, '3.4a: Missing document in CurrencyRepository returns isConfigured = false');

        // Test 3.4b: Invalid existing document throws Data Integrity Error
        const invalidKey = `${testRunId}_invalid`;
        await testColl.insertOne({ key: invalidKey, config: { baseCurrency: 'PKR', rates: { USD: -999 } } });
        createdKeys.push(invalidKey);

        try {
          await CurrencyRepository.getConfig(testColl, invalidKey);
          assert(false, '3.4b: Existing invalid document must throw Data Integrity Error');
        } catch (err: any) {
          assert(err.message.includes('Data Integrity Error'), '3.4b: Existing invalid document throws clear Data Integrity Error');
        }

      } catch (err: any) {
        assert(false, '3.0: Database integration test execution error', err?.message);
      } finally {
        if (testClient) {
          try {
            const testDb = testClient.db();
            const testColl = testDb.collection('test_system_settings_isolated');
            for (const key of createdKeys) {
              await testColl.deleteOne({ key });
            }
          } catch (cleanupErr: any) {
            console.error('[CLEANUP WARNING] Failed to clean up test records:', cleanupErr);
          }
          await testClient.close().catch(() => {});
        }
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
