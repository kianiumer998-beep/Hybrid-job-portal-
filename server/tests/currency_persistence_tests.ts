import { CurrencyRepository, validateCurrencyConfig } from '../db/repositories/CurrencyRepository';
import { INITIAL_CURRENCY_CONFIG } from '../../src/data/mockAdminSuiteData';
import { isMongoConfigured } from '../db/mongodb';
import { MongoClient } from 'mongodb';

export function isSafeDistinctTestUri(prodUri: string, testUri: string): { safe: boolean; reason?: string } {
  const cleanProd = (prodUri || '').trim();
  const cleanTest = (testUri || '').trim();

  if (!cleanProd || !cleanTest) {
    return { safe: false, reason: 'Production or Test MONGODB_URI is missing.' };
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

  if (!prodInfo || !testInfo) {
    return { safe: false, reason: 'Invalid MongoDB URI format.' };
  }

  // Host/Port MUST match for cluster verification
  if (prodInfo.host !== testInfo.host || prodInfo.port !== testInfo.port) {
    return { safe: false, reason: 'Test and Production database must share the same host and port for safe isolation.' };
  }

  // Database names MUST be different and non-admin
  if (prodInfo.dbName === testInfo.dbName) {
    return { safe: false, reason: 'Test database name must be different from production database name.' };
  }
  if (prodInfo.dbName === 'admin' || testInfo.dbName === 'admin') {
    return { safe: false, reason: 'Cannot safely use "admin" database.' };
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

  // 1. Validation Rules & Data Integrity (Unit Tests)
  console.log('--- 1. Validation Rules & Data Integrity ---');
  const invalidCodeConfig = { ...INITIAL_CURRENCY_CONFIG, baseCurrency: '' };
  assert(validateCurrencyConfig(invalidCodeConfig).valid === false, '1.1: Rejects empty baseCurrency');

  const negativeRateConfig = { ...INITIAL_CURRENCY_CONFIG, rates: { ...INITIAL_CURRENCY_CONFIG.rates, USD: -0.005 } };
  assert(validateCurrencyConfig(negativeRateConfig).valid === false, '1.2: Rejects negative exchange rate');

  const stringRateConfig = { ...INITIAL_CURRENCY_CONFIG, rates: { ...INITIAL_CURRENCY_CONFIG.rates, USD: 'invalid' as any } };
  assert(validateCurrencyConfig(stringRateConfig).valid === false, '1.3: Rejects non-numeric rate');

  const negativeTierConfig = { ...INITIAL_CURRENCY_CONFIG, internationalPricingTiers: { ...INITIAL_CURRENCY_CONFIG.internationalPricingTiers, featuredJobFee: { USD: -100 } } };
  assert(validateCurrencyConfig(negativeTierConfig).valid === false, '1.4: Rejects negative fee tier');

  // 2. URI Safety Unit Tests
  console.log('\n--- 2. Database URI Isolation Fail-Closed Unit Tests ---');
  assert(isSafeDistinctTestUri('mongodb://host:27017/prod', 'mongodb://host:27017/test').safe === true, '2A: Same host/port, diff DB → PASS');
  assert(isSafeDistinctTestUri('mongodb://host:27017/prod', 'mongodb://host:27018/test').safe === false, '2B: Same host, diff port, diff DB → REJECT');
  assert(isSafeDistinctTestUri('mongodb://host1:27017/prod', 'mongodb://host2:27017/test').safe === false, '2C: Diff host, same port → REJECT');
  assert(isSafeDistinctTestUri('mongodb://host1:27017/prod', 'mongodb://host2:27018/test').safe === false, '2D: Diff host, diff port → REJECT');
  assert(isSafeDistinctTestUri('mongodb://host:27017/db', 'mongodb://host:27017/db').safe === false, '2E: Same host/port, same DB → REJECT');
  assert(isSafeDistinctTestUri('', 'mongodb://host:27017/test').safe === false, '2F-1: Missing prod URI → REJECT');
  assert(isSafeDistinctTestUri('mongodb://host:27017/prod', '').safe === false, '2F-2: Missing test URI → REJECT');
  assert(isSafeDistinctTestUri('mongodb://host:27017/admin', 'mongodb://host:27017/test').safe === false, '2F-3: Admin DB → REJECT');
  assert(isSafeDistinctTestUri('not-a-uri', 'mongodb://host:27017/test').safe === false, '2F-4: Invalid URI → REJECT');

  // 3. Database Connection Safety & Write Isolation
  console.log('\n--- 3. Database Connection Safety & Write Isolation ---');
  const prodDbUri = (process.env.MONGODB_URI || '').trim();
  const testDbUri = (process.env.TEST_MONGODB_URI || process.env.MONGODB_TEST_URI || '').trim();

  if (!isMongoConfigured()) {
    const unconfiguredGet = await CurrencyRepository.getConfig();
    assert(unconfiguredGet.isConfigured === false, '3.1: Unconfigured Mongo returns isConfigured = false');
    
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
    } else {
      console.log('  [INFO] Safe distinct TEST_MONGODB_URI confirmed. Running integration tests...');
      let testClient: MongoClient | null = null;
      const createdKeys: string[] = [];
      const testRunId = `test_run_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      try {
        testClient = new MongoClient(testDbUri);
        await testClient.connect();
        const testColl = testClient.db().collection('test_system_settings_isolated');

        const testConfigPayload = { ...INITIAL_CURRENCY_CONFIG, rates: { ...INITIAL_CURRENCY_CONFIG.rates, USD: 0.00359 } };
        const savedResult = await CurrencyRepository.saveConfig(testConfigPayload, testColl, testRunId);
        createdKeys.push(testRunId);
        assert(savedResult.rates.USD === 0.00359, '3.1: saveConfig() saves correctly');

        const reloadedResult = await CurrencyRepository.getConfig(testColl, testRunId);
        assert(reloadedResult.isConfigured === true && reloadedResult.config.rates.USD === 0.00359, '3.2: getConfig() reloads correctly');

        const invalidDocKey = `${testRunId}_invalid`;
        await testColl.insertOne({ key: invalidDocKey, config: { baseCurrency: 'PKR', rates: { USD: -999 } } });
        createdKeys.push(invalidDocKey);
        try {
          await CurrencyRepository.getConfig(testColl, invalidDocKey);
          assert(false, '3.3: getConfig() should throw on invalid document');
        } catch (err: any) {
          assert(err.message.includes('Data Integrity Error'), '3.3: getConfig() throws Data Integrity Error');
        }

      } catch (err: any) {
        assert(false, '3.0: Database integration test execution error', err?.message);
      } finally {
        if (testClient) {
          try {
            const testColl = testClient.db().collection('test_system_settings_isolated');
            for (const key of createdKeys) { await testColl.deleteOne({ key }); }
          } catch (cleanupErr: any) { console.error('[CLEANUP WARNING]', cleanupErr); }
          await testClient.close().catch(() => {});
        }
      }
    }
  }

  console.log('\n====================================================');
  console.log(`   TEST RESULTS: ${passed} PASSED, ${failed} FAILED, ${notRun} NOT RUN      `);
  console.log('====================================================\n');

  if (failed > 0) throw new Error(`Currency Persistence Isolated Tests Failed (${failed} failures)`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCurrencyPersistenceTests().catch((err) => { console.error(err); process.exit(1); });
}
