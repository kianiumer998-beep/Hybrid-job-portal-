import { CurrencyRepository, validateCurrencyConfig } from '../db/repositories/CurrencyRepository';
import { INITIAL_CURRENCY_CONFIG } from '../../src/data/mockAdminSuiteData';
import { isMongoConfigured } from '../db/mongodb';
import { MongoClient } from 'mongodb';

export function isSafeDistinctTestUri(prodUri: string, testUri: string): { safe: boolean; reason?: string } {
  const cleanProd = (prodUri || '').trim();
  const cleanTest = (testUri || '').trim();

  if (!cleanProd || !cleanTest) return { safe: false, reason: 'Production or Test MONGODB_URI is missing.' };
  if (cleanTest.toLowerCase() === cleanProd.toLowerCase()) return { safe: false, reason: 'TEST_MONGODB_URI is identical to production MONGODB_URI.' };

  const parseDbInfo = (uri: string) => {
    try {
      if (!uri.startsWith('mongodb://') && !uri.startsWith('mongodb+srv://')) return null;
      const normalized = uri.replace(/^mongodb(\+srv)?:\/\//i, 'http://');
      const url = new URL(normalized);
      const host = (url.hostname || '').toLowerCase();
      const port = url.port || '27017';
      const pathname = url.pathname.replace(/^\//, '').split('?')[0].trim().toLowerCase();
      return { host, port, dbName: pathname || 'admin' };
    } catch { return null; }
  };

  const prodInfo = parseDbInfo(cleanProd);
  const testInfo = parseDbInfo(cleanTest);

  if (!prodInfo || !testInfo) return { safe: false, reason: 'Invalid MongoDB URI format.' };
  if (prodInfo.host !== testInfo.host || prodInfo.port !== testInfo.port) return { safe: false, reason: 'Test and Production database must share the same host and port for safe isolation.' };
  if (prodInfo.dbName === testInfo.dbName) return { safe: false, reason: 'Test database name must be different from production database name.' };
  if (prodInfo.dbName === 'admin' || testInfo.dbName === 'admin') return { safe: false, reason: 'Cannot safely use "admin" database.' };
  return { safe: true };
}

export async function runCurrencyPersistenceTests() {
  console.log('====================================================');
  console.log('   CURRENCY PERSISTENCE ISOLATED TEST SUITE        ');
  console.log('====================================================\n');

  let unitPassed = 0, configPassed = 0, integrationPassed = 0, failed = 0, notRun = 0;
  
  function assert(condition: boolean, testName: string, type: 'unit' | 'config' | 'integration', detail?: string) {
    if (condition) {
      console.log(`  [PASS] ${testName}`);
      if (type === 'unit') unitPassed++;
      else if (type === 'config') configPassed++;
      else integrationPassed++;
    } else {
      console.error(`  [FAIL] ${testName}${detail ? ` - ${detail}` : ''}`);
      failed++;
    }
  }

  function reportNotRun(testName: string, reason: string) {
    console.log(`  [NOT RUN] ${testName} - ${reason}`);
    notRun++;
  }

  // 1. Validation & Unit Tests
  console.log('--- 1. Validation & Unit Tests ---');
  assert(validateCurrencyConfig({ ...INITIAL_CURRENCY_CONFIG, baseCurrency: '' }).valid === false, '1.1: Rejects empty baseCurrency', 'unit');
  assert(validateCurrencyConfig({ ...INITIAL_CURRENCY_CONFIG, rates: { ...INITIAL_CURRENCY_CONFIG.rates, USD: -0.005 } }).valid === false, '1.2: Rejects negative exchange rate', 'unit');
  assert(validateCurrencyConfig({ ...INITIAL_CURRENCY_CONFIG, rates: { ...INITIAL_CURRENCY_CONFIG.rates, USD: 'invalid' as any } }).valid === false, '1.3: Rejects non-numeric rate', 'unit');
  assert(validateCurrencyConfig({ ...INITIAL_CURRENCY_CONFIG, internationalPricingTiers: { ...INITIAL_CURRENCY_CONFIG.internationalPricingTiers, featuredJobFee: { USD: -100 } } }).valid === false, '1.4: Rejects negative fee tier', 'unit');
  assert(validateCurrencyConfig({ ...INITIAL_CURRENCY_CONFIG, rates: { ...INITIAL_CURRENCY_CONFIG.rates, USD: 0.00362 } }).valid === true, '1.5: Validates legacy payload', 'unit');
  assert(validateCurrencyConfig({ baseCurrency: 'PKR', rates: { USD: -5 } }).valid === false, '1.6: Invalid doc structure rejection', 'unit');

  // 2. URI Safety Unit Tests
  console.log('\n--- 2. Database URI Isolation Unit Tests ---');
  assert(isSafeDistinctTestUri('mongodb://h:27017/prod', 'mongodb://h:27017/test').safe === true, '2A: Distinct DB name → PASS', 'unit');
  assert(isSafeDistinctTestUri('mongodb://h:27017/prod', 'mongodb://h:27018/test').safe === false, '2B: Diff port → REJECT', 'unit');
  assert(isSafeDistinctTestUri('mongodb://h1:27017/prod', 'mongodb://h2:27017/test').safe === false, '2C: Diff host → REJECT', 'unit');
  assert(isSafeDistinctTestUri('mongodb://h:27017/db', 'mongodb://h:27017/db').safe === false, '2D: Same DB → REJECT', 'unit');

  // 3. Database Connection Safety & Integration
  console.log('\n--- 3. Database Connection Safety & Integration ---');
  const prodDbUri = (process.env.MONGODB_URI || '').trim();
  const testDbUri = (process.env.TEST_MONGODB_URI || '').trim();

  if (!isMongoConfigured()) {
    const unconfiguredGet = await CurrencyRepository.getConfig();
    assert(unconfiguredGet.isConfigured === false, '3.1: Unconfigured Mongo getConfig → isConfigured=false', 'config');
    try {
      await CurrencyRepository.saveConfig(INITIAL_CURRENCY_CONFIG);
      assert(false, '3.2: Unconfigured Mongo saveConfig must throw', 'config');
    } catch (err: any) {
      assert(err.message.includes('MONGODB_URI is not configured'), '3.2: Unconfigured Mongo saveConfig throws clear error', 'config');
    }
  } else {
    const sep = isSafeDistinctTestUri(prodDbUri, testDbUri);
    if (!sep.safe) {
      reportNotRun('3.1: saveConfig/getConfig() integration', sep.reason || 'Isolation check failed');
      reportNotRun('3.2: Invalid rate rejection in DB', 'Skipped due to isolation failure');
      reportNotRun('3.3: Missing/invalid doc distinction', 'Skipped due to isolation failure');
    } else {
      console.log('  [INFO] Safe distinct TEST_MONGODB_URI confirmed. Running integration tests...');
      let client: MongoClient | null = null;
      const testRunId = `test_run_${Date.now()}`;
      try {
        client = new MongoClient(testDbUri);
        await client.connect();
        const coll = client.db().collection('test_system_settings_isolated');
        
        // 3.1 & 3.2: Save/Reload
        const payload = { ...INITIAL_CURRENCY_CONFIG, rates: { USD: 0.00359 } };
        await CurrencyRepository.saveConfig(payload, coll, testRunId);
        const res = await CurrencyRepository.getConfig(coll, testRunId);
        assert(res.isConfigured === true && res.config.rates.USD === 0.00359, '3.1: saveConfig/getConfig() integration', 'integration');

        // 3.3: Invalid rate rejection
        try {
          await CurrencyRepository.saveConfig({ ...INITIAL_CURRENCY_CONFIG, rates: { USD: -5 } }, coll, `${testRunId}_inv`);
          assert(false, '3.2: saveConfig() rejects invalid rate', 'integration');
        } catch (err: any) { assert(err.message.includes('Validation Error'), '3.2: saveConfig() rejects invalid rate', 'integration'); }

        // 3.4: Missing/invalid doc
        assert((await CurrencyRepository.getConfig(coll, 'nonexistent')).isConfigured === false, '3.3a: Missing doc → isConfigured=false', 'integration');
        await coll.insertOne({ key: 'inv', config: { rates: { USD: -99 } } });
        try {
          await CurrencyRepository.getConfig(coll, 'inv');
          assert(false, '3.3b: Invalid doc → Error', 'integration');
        } catch (err: any) { assert(err.message.includes('Data Integrity Error'), '3.3b: Invalid doc → Data Integrity Error', 'integration'); }
        
        await coll.deleteMany({});
      } finally { await client?.close().catch(() => {}); }
    }
  }

  console.log(`\nRESULTS: ${unitPassed + configPassed} PASS (${unitPassed} unit, ${configPassed} config), ${integrationPassed} Integration PASS, ${failed} FAIL, ${notRun} NOT RUN`);
  if (failed > 0) throw new Error('Tests failed.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCurrencyPersistenceTests().catch((err) => { console.error(err); process.exit(1); });
}
