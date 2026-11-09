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

  let unit = { p: 0, f: 0 }, config = { p: 0, f: 0 }, integration = { p: 0, f: 0, nr: 0 }, failed = 0, notRun = 0, cleanupFailures = 0;
  
  function assert(condition: boolean, testName: string, type: 'unit' | 'config' | 'integration', detail?: string) {
    if (condition) {
      console.log(`  [PASS] ${testName}`);
      if (type === 'unit') unit.p++; else if (type === 'config') config.p++; else integration.p++;
    } else {
      console.error(`  [FAIL] ${testName}${detail ? ` - ${detail}` : ''}`);
      if (type === 'unit') unit.f++; else if (type === 'config') config.f++; else integration.f++;
    }
  }

  function reportNotRun(testName: string, reason: string) {
    console.log(`  [NOT RUN] ${testName} - ${reason}`);
    integration.nr++;
  }

  // 1. Validation & Unit Tests
  console.log('--- 1. Validation & Unit Tests ---');
  assert(validateCurrencyConfig({ ...INITIAL_CURRENCY_CONFIG, baseCurrency: '' }).valid === false, '1.1: Rejects empty baseCurrency', 'unit');
  assert(validateCurrencyConfig({ ...INITIAL_CURRENCY_CONFIG, rates: { ...INITIAL_CURRENCY_CONFIG.rates, USD: -0.005 } }).valid === false, '1.2: Rejects negative exchange rate', 'unit');
  assert(validateCurrencyConfig({ ...INITIAL_CURRENCY_CONFIG, rates: { ...INITIAL_CURRENCY_CONFIG.rates, USD: 'invalid' as any } }).valid === false, '1.3: Rejects non-numeric rate', 'unit');
  assert(validateCurrencyConfig({ ...INITIAL_CURRENCY_CONFIG, internationalPricingTiers: { ...INITIAL_CURRENCY_CONFIG.internationalPricingTiers, featuredJobFee: { USD: -100 } } }).valid === false, '1.4: Rejects negative fee tier', 'unit');
  
  // Genuine LocalStorage structure test
  const legacyPayload = JSON.stringify(INITIAL_CURRENCY_CONFIG);
  assert(validateCurrencyConfig(JSON.parse(legacyPayload)).valid === true, '1.5: Validates genuine legacy LocalStorage payload', 'unit');
  
  assert(validateCurrencyConfig({ baseCurrency: 'PKR', rates: { USD: -5 } }).valid === false, '1.6: Invalid doc structure rejection', 'unit');

  // 2. URI Safety Unit Tests
  console.log('\n--- 2. Database URI Isolation Fail-Closed Unit Tests ---');
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
    } catch (err: any) { assert(err.message.includes('MONGODB_URI is not configured'), '3.2: Unconfigured Mongo saveConfig throws clear error', 'config'); }
    
    reportNotRun('Integration 3.1: Actual saveConfig/getConfig reload', 'Unconfigured environment');
    reportNotRun('Integration 3.2: Missing doc isConfigured=false', 'Unconfigured environment');
    reportNotRun('Integration 3.3: Invalid existing document error', 'Unconfigured environment');
    reportNotRun('Integration 3.4: Invalid rate rejection in DB', 'Unconfigured environment');
  } else {
    const sep = isSafeDistinctTestUri(prodDbUri, testDbUri);
    if (!sep.safe) {
      reportNotRun('Integration 3.1: Actual saveConfig/getConfig reload', sep.reason || 'Isolation check failed');
      reportNotRun('Integration 3.2: Missing doc isConfigured=false', sep.reason || 'Isolation check failed');
      reportNotRun('Integration 3.3: Invalid existing document error', sep.reason || 'Isolation check failed');
      reportNotRun('Integration 3.4: Invalid rate rejection in DB', sep.reason || 'Isolation check failed');
    } else {
      console.log('  [INFO] Safe distinct TEST_MONGODB_URI confirmed. Running integration tests...');
      let client: MongoClient | null = null;
      const createdKeys: { key: string, id: string }[] = [];
      const runTimestamp = Date.now();

      try {
        client = new MongoClient(testDbUri);
        await client.connect();
        const coll = client.db().collection('test_system_settings_isolated');
        
        // 3.1: Save/Reload
        const key = `key_${runTimestamp}_${Math.random()}`;
        const payload = { ...INITIAL_CURRENCY_CONFIG, rates: { USD: 0.00359 } };
        await CurrencyRepository.saveConfig(payload, coll, key);
        createdKeys.push({ key, id: '3.1' });
        
        const res = await CurrencyRepository.getConfig(coll, key);
        assert(res.isConfigured === true && res.config.rates.USD === 0.00359, '3.1: saveConfig/getConfig() integration', 'integration');

        // 3.2: Missing doc
        assert((await CurrencyRepository.getConfig(coll, `missing_${runTimestamp}`)).isConfigured === false, '3.2: Missing doc → isConfigured=false', 'integration');

        // 3.3: Invalid existing doc
        const invDocKey = `inv_${runTimestamp}_${Math.random()}`;
        await coll.insertOne({ key: invDocKey, config: { rates: { USD: -99 } } });
        createdKeys.push({ key: invDocKey, id: '3.3' });
        try {
          await CurrencyRepository.getConfig(coll, invDocKey);
          assert(false, '3.3: Invalid doc → Error', 'integration');
        } catch (err: any) { assert(err.message.includes('Data Integrity Error'), '3.3: Invalid doc → Data Integrity Error', 'integration'); }

        // 3.4: Invalid rate rejection in DB
        const invRateKey = `invRate_${runTimestamp}_${Math.random()}`;
        try {
          await CurrencyRepository.saveConfig({ ...INITIAL_CURRENCY_CONFIG, rates: { USD: -5 } }, coll, invRateKey);
          assert(false, '3.4: saveConfig() rejects invalid rate in DB', 'integration');
        } catch (err: any) { 
          createdKeys.push({ key: invRateKey, id: '3.4' });
          assert(err.message.includes('Validation Error'), '3.4: saveConfig() rejects invalid rate in DB', 'integration'); 
        }
        
      } catch (err: any) { assert(false, '3.0: Database integration test execution error', 'integration', err?.message); }
      finally {
        if (client) {
          const coll = client.db().collection('test_system_settings_isolated');
          for (const item of createdKeys) { 
            try {
              const deleted = await coll.deleteOne({ key: item.key });
              if (deleted.deletedCount !== 1) throw new Error(`Deleted count ${deleted.deletedCount}`);
            } catch (cleanupErr: any) { console.error(`[CLEANUP FAILED] Key: ${item.key}`, cleanupErr); cleanupFailures++; }
          }
          try { await client.close(); } catch (closeErr) { console.error('[CLOSE FAILED]', closeErr); cleanupFailures++; }
        }
      }
    }
  }

  console.log(`\nRESULTS: ${unit.p + config.p + integration.p} PASS (${unit.p} unit, ${config.p} config, ${integration.p} integration), ${unit.f + config.f + integration.f} FAIL, ${notRun + integration.nr} NOT RUN, ${cleanupFailures} CLEANUP FAILURES`);
  if (unit.f + config.f + integration.f > 0 || cleanupFailures > 0) throw new Error('Tests failed or cleanup error.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCurrencyPersistenceTests().catch((err) => { console.error(err); process.exit(1); });
}
