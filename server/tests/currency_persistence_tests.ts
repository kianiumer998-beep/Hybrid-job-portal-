import { CurrencyRepository, validateCurrencyConfig, ALLOWED_CURRENCIES, ALLOWED_TIER_KEYS } from '../db/repositories/CurrencyRepository';
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

  let unit = { p: 0, f: 0 }, config = { p: 0, f: 0 }, integration = { p: 0, f: 0, nr: 0 }, cleanupFailures = 0;
  
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
  // 1.1 Base currency tests
  assert(validateCurrencyConfig({ ...INITIAL_CURRENCY_CONFIG, baseCurrency: '' }).valid === false, '1.1a: Rejects empty baseCurrency', 'unit');
  assert(validateCurrencyConfig({ ...INITIAL_CURRENCY_CONFIG, baseCurrency: 'USD' }).valid === false, '1.1b: Rejects baseCurrency USD (only PKR allowed)', 'unit');
  assert(validateCurrencyConfig({ ...INITIAL_CURRENCY_CONFIG, baseCurrency: 'XYZ' }).valid === false, '1.1c: Rejects unknown baseCurrency XYZ', 'unit');

  // 1.2 PKR rate tests (must be exactly 1.0)
  assert(validateCurrencyConfig({ ...INITIAL_CURRENCY_CONFIG, rates: { ...INITIAL_CURRENCY_CONFIG.rates, PKR: 0.5 } }).valid === false, '1.2a: Rejects PKR rate other than 1.0 (0.5)', 'unit');
  assert(validateCurrencyConfig({ ...INITIAL_CURRENCY_CONFIG, rates: { ...INITIAL_CURRENCY_CONFIG.rates, PKR: 2.0 } }).valid === false, '1.2b: Rejects PKR rate other than 1.0 (2.0)', 'unit');

  // 1.3 Missing required rates for supported currencies
  assert(validateCurrencyConfig({ ...INITIAL_CURRENCY_CONFIG, rates: { PKR: 1 } }).valid === false, '1.3: Rejects missing rates for supported currencies', 'unit');

  // 1.4 Unsupported currency codes
  assert(validateCurrencyConfig({ ...INITIAL_CURRENCY_CONFIG, supportedCurrencies: ['PKR', 'USD', 'INR'] as any }).valid === false, '1.4a: Rejects unsupported currency INR in supportedCurrencies', 'unit');
  assert(validateCurrencyConfig({ ...INITIAL_CURRENCY_CONFIG, rates: { ...INITIAL_CURRENCY_CONFIG.rates, JPY: 0.1 } as any }).valid === false, '1.4b: Rejects unsupported currency JPY in rates', 'unit');
  assert(validateCurrencyConfig({
    ...INITIAL_CURRENCY_CONFIG,
    internationalPricingTiers: {
      ...INITIAL_CURRENCY_CONFIG.internationalPricingTiers,
      featuredJobFee: { ...INITIAL_CURRENCY_CONFIG.internationalPricingTiers.featuredJobFee, BTC: 1 } as any
    }
  }).valid === false, '1.4c: Rejects unsupported currency BTC in fee tiers', 'unit');

  // 1.5 Rate value validations: zero, negative, NaN, Infinity, non-numeric
  assert(validateCurrencyConfig({ ...INITIAL_CURRENCY_CONFIG, rates: { ...INITIAL_CURRENCY_CONFIG.rates, USD: 0 } }).valid === false, '1.5a: Rejects zero exchange rate', 'unit');
  assert(validateCurrencyConfig({ ...INITIAL_CURRENCY_CONFIG, rates: { ...INITIAL_CURRENCY_CONFIG.rates, USD: -0.005 } }).valid === false, '1.5b: Rejects negative exchange rate', 'unit');
  assert(validateCurrencyConfig({ ...INITIAL_CURRENCY_CONFIG, rates: { ...INITIAL_CURRENCY_CONFIG.rates, USD: NaN } }).valid === false, '1.5c: Rejects NaN exchange rate', 'unit');
  assert(validateCurrencyConfig({ ...INITIAL_CURRENCY_CONFIG, rates: { ...INITIAL_CURRENCY_CONFIG.rates, USD: Infinity } }).valid === false, '1.5d: Rejects Infinity exchange rate', 'unit');
  assert(validateCurrencyConfig({ ...INITIAL_CURRENCY_CONFIG, rates: { ...INITIAL_CURRENCY_CONFIG.rates, USD: 'invalid' as any } }).valid === false, '1.5e: Rejects non-numeric rate', 'unit');
  assert(validateCurrencyConfig({
    ...INITIAL_CURRENCY_CONFIG,
    internationalPricingTiers: {
      ...INITIAL_CURRENCY_CONFIG.internationalPricingTiers,
      featuredJobFee: { ...INITIAL_CURRENCY_CONFIG.internationalPricingTiers.featuredJobFee, USD: -100 }
    }
  }).valid === false, '1.5f: Rejects negative fee tier', 'unit');

  // 1.6 Safe tier normalization without losing existing values
  const partialTierPayload = {
    ...INITIAL_CURRENCY_CONFIG,
    internationalPricingTiers: {
      featuredJobFee: { USD: 777 }
    }
  };
  const partialVal = validateCurrencyConfig(partialTierPayload);
  assert(partialVal.valid === true, '1.6a: Incomplete tier configuration safely validates', 'unit');
  assert(partialVal.sanitized?.internationalPricingTiers.featuredJobFee.USD === 777, '1.6b: Custom tier value (777 USD) preserved', 'unit');
  assert(partialVal.sanitized?.internationalPricingTiers.featuredJobFee.PKR === INITIAL_CURRENCY_CONFIG.internationalPricingTiers.featuredJobFee.PKR, '1.6c: Missing PKR in featuredJobFee normalized from defaults', 'unit');
  assert(partialVal.sanitized?.internationalPricingTiers.urgentBadgeFee.PKR === INITIAL_CURRENCY_CONFIG.internationalPricingTiers.urgentBadgeFee.PKR, '1.6d: Entire missing tier (urgentBadgeFee) normalized from defaults', 'unit');

  // 1.7 All 5 pricing tiers survive validation
  const fullVal = validateCurrencyConfig(INITIAL_CURRENCY_CONFIG);
  assert(fullVal.valid === true, '1.7a: Full initial config validates', 'unit');
  const allTiersPresent = ALLOWED_TIER_KEYS.every(tk => fullVal.sanitized?.internationalPricingTiers[tk] !== undefined);
  assert(allTiersPresent, '1.7b: All 5 pricing tiers survive validation', 'unit');

  // 1.8 All 8 currencies survive validation
  const allCurrsPresent = ALLOWED_CURRENCIES.every(c => fullVal.sanitized?.supportedCurrencies.includes(c));
  assert(allCurrsPresent, '1.8: All 8 supported currencies survive validation', 'unit');

  // 1.9 LocalStorage compatibility test
  const KEY = 'career_pak_currency_config';
  const mockStorage = new Map<string, string>();
  const fixture = { ...INITIAL_CURRENCY_CONFIG };
  mockStorage.set(KEY, JSON.stringify(fixture));
  const retrieved = mockStorage.get(KEY);
  assert(retrieved !== undefined, '1.9a: Retrieves from LocalStorage key', 'unit');
  const parsed = JSON.parse(retrieved!);
  const val = validateCurrencyConfig(parsed);
  assert(val.valid === true, '1.9b: Validates genuine legacy LocalStorage payload structure', 'unit');
  assert(val.sanitized?.baseCurrency === fixture.baseCurrency, '1.9c: baseCurrency survives', 'unit');
  assert(JSON.stringify(val.sanitized?.rates) === JSON.stringify(fixture.rates), '1.9d: rates survive', 'unit');
  assert(val.sanitized?.lastSyncedAt === fixture.lastSyncedAt, '1.9e: lastSyncedAt survives', 'unit');
  assert(val.sanitized?.autoSyncEnabled === fixture.autoSyncEnabled, '1.9f: autoSyncEnabled survives', 'unit');
  assert(JSON.stringify(val.sanitized?.supportedCurrencies) === JSON.stringify(fixture.supportedCurrencies), '1.9g: supportedCurrencies survive', 'unit');
  assert(JSON.stringify(val.sanitized?.internationalPricingTiers) === JSON.stringify(fixture.internationalPricingTiers), '1.9h: internationalPricingTiers survive', 'unit');

  // 1.10 MongoDB unacknowledged write error handling
  const unackColl = {
    updateOne: async () => ({ acknowledged: false })
  };
  try {
    await CurrencyRepository.saveConfig(INITIAL_CURRENCY_CONFIG, unackColl as any, 'test_unack_key');
    assert(false, '1.10: Unacknowledged write must throw error', 'unit');
  } catch (err: any) {
    assert(err.message.includes('MongoDB write operation was not acknowledged'), '1.10: Throws on unacknowledged MongoDB write', 'unit');
  }

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
    
    reportNotRun('Integration 3.1: All eight currency rates survive save and reload', 'Unconfigured environment');
    reportNotRun('Integration 3.2: All five pricing tiers survive save and reload', 'Unconfigured environment');
    reportNotRun('Integration 3.3: Custom pricing tier values survive unchanged', 'Unconfigured environment');
    reportNotRun('Integration 3.4: Missing supported currency rejection in DB', 'Unconfigured environment');
    reportNotRun('Integration 3.5: Missing doc returns isConfigured=false', 'Unconfigured environment');
    reportNotRun('Integration 3.6: Invalid existing document error', 'Unconfigured environment');
    reportNotRun('Integration 3.7: Invalid rate rejection in DB', 'Unconfigured environment');
  } else {
    const sep = isSafeDistinctTestUri(prodDbUri, testDbUri);
    if (!sep.safe) {
      reportNotRun('Integration 3.1: All eight currency rates survive save and reload', sep.reason || 'Isolation check failed');
      reportNotRun('Integration 3.2: All five pricing tiers survive save and reload', sep.reason || 'Isolation check failed');
      reportNotRun('Integration 3.3: Custom pricing tier values survive unchanged', sep.reason || 'Isolation check failed');
      reportNotRun('Integration 3.4: Missing supported currency rejection in DB', sep.reason || 'Isolation check failed');
      reportNotRun('Integration 3.5: Missing doc returns isConfigured=false', sep.reason || 'Isolation check failed');
      reportNotRun('Integration 3.6: Invalid existing document error', sep.reason || 'Isolation check failed');
      reportNotRun('Integration 3.7: Invalid rate rejection in DB', sep.reason || 'Isolation check failed');
    } else {
      console.log('  [INFO] Safe distinct TEST_MONGODB_URI confirmed. Running integration tests...');
      let client: MongoClient | null = null;
      const createdKeys: { key: string, id: string }[] = [];
      const runTimestamp = Date.now();

      try {
        client = new MongoClient(testDbUri);
        await client.connect();
        const coll = client.db().collection('test_system_settings_isolated');
        
        // Integration 3.1 & 3.2 & 3.3: Save custom payload with all 8 currencies and custom tier values
        const key = `key_${runTimestamp}_${Math.random()}`;
        const customPayload = {
          ...INITIAL_CURRENCY_CONFIG,
          rates: {
            ...INITIAL_CURRENCY_CONFIG.rates,
            USD: 0.00359,
            EUR: 0.00333
          },
          internationalPricingTiers: {
            ...INITIAL_CURRENCY_CONFIG.internationalPricingTiers,
            featuredJobFee: { ...INITIAL_CURRENCY_CONFIG.internationalPricingTiers.featuredJobFee, USD: 888 },
            urgentBadgeFee: { ...INITIAL_CURRENCY_CONFIG.internationalPricingTiers.urgentBadgeFee, EUR: 555 }
          }
        };
        await CurrencyRepository.saveConfig(customPayload, coll, key);
        createdKeys.push({ key, id: '3.1-3.3' });
        
        const reloadRes = await CurrencyRepository.getConfig(coll, key);
        assert(reloadRes.isConfigured === true, '3.1a: Document is configured after save', 'integration');
        
        // Assert all 8 currencies survive save/reload
        const all8RatesSaved = ALLOWED_CURRENCIES.every(c => reloadRes.config.rates[c] !== undefined && reloadRes.config.rates[c] > 0);
        assert(all8RatesSaved && reloadRes.config.rates.USD === 0.00359, '3.1b: All eight currency rates survive MongoDB save and reload', 'integration');

        // Assert all 5 pricing tiers survive
        const all5TiersSaved = ALLOWED_TIER_KEYS.every(tk => reloadRes.config.internationalPricingTiers[tk] !== undefined);
        assert(all5TiersSaved, '3.2: All five pricing tiers survive MongoDB save and reload', 'integration');

        // Assert custom tier values survive unchanged
        const customPreserved = reloadRes.config.internationalPricingTiers.featuredJobFee.USD === 888 && reloadRes.config.internationalPricingTiers.urgentBadgeFee.EUR === 555;
        assert(customPreserved, '3.3: All existing custom tier values remain unchanged', 'integration');

        // Integration 3.4: Missing supported currency rejection in DB
        const missingCurrKey = `missingCurr_${runTimestamp}_${Math.random()}`;
        try {
          await CurrencyRepository.saveConfig({ ...INITIAL_CURRENCY_CONFIG, supportedCurrencies: ['PKR', 'USD'] as any }, coll, missingCurrKey);
          createdKeys.push({ key: missingCurrKey, id: '3.4' });
          assert(false, '3.4: saveConfig() unexpectedly accepted payload with missing supported currencies', 'integration');
        } catch (err: any) {
          assert(err.message.includes('Validation Error'), '3.4: Missing supported currency rejected in DB', 'integration');
        }

        // Integration 3.5: Missing doc returns isConfigured=false
        assert((await CurrencyRepository.getConfig(coll, `missing_${runTimestamp}`)).isConfigured === false, '3.5: Missing doc returns isConfigured=false', 'integration');

        // Integration 3.6: Invalid existing doc
        const invDocKey = `inv_${runTimestamp}_${Math.random()}`;
        await coll.insertOne({ key: invDocKey, config: { rates: { USD: -99 } } });
        createdKeys.push({ key: invDocKey, id: '3.6' });
        try {
          await CurrencyRepository.getConfig(coll, invDocKey);
          assert(false, '3.6: Invalid doc → Error', 'integration');
        } catch (err: any) { assert(err.message.includes('Data Integrity Error'), '3.6: Invalid existing document error', 'integration'); }

        // Integration 3.7: Invalid rate rejection in DB
        const invRateKey = `invRate_${runTimestamp}_${Math.random()}`;
        try {
          await CurrencyRepository.saveConfig({ ...INITIAL_CURRENCY_CONFIG, rates: { ...INITIAL_CURRENCY_CONFIG.rates, USD: -5 } }, coll, invRateKey);
          createdKeys.push({ key: invRateKey, id: '3.7' });
          assert(false, '3.7: saveConfig() unexpectedly succeeded with invalid rate', 'integration');
        } catch (err: any) {
          if (err.message.includes('Validation Error')) {
            assert(true, '3.7: saveConfig() rejects invalid rate in DB', 'integration');
          } else {
            assert(false, '3.7: saveConfig() unexpected error', 'integration', err.message);
          }
        }
        
      } catch (err: any) { assert(false, '3.0: Database integration test execution error', 'integration', err?.message); }
      finally {
        if (client) {
          try {
            const coll = client.db().collection('test_system_settings_isolated');
            for (const item of createdKeys) { 
              try {
                const deleted = await coll.deleteOne({ key: item.key });
                if (deleted.deletedCount !== 1) { console.error(`[CLEANUP FAILED] Key: ${item.key}`); cleanupFailures++; }
              } catch (delErr) { console.error(`[CLEANUP FAILED] Key: ${item.key}`, delErr); cleanupFailures++; }
            }
          } catch (cleanupErr: any) { console.error('[CLEANUP FAILED]', cleanupErr); cleanupFailures++; }
          try { await client.close(); } catch (closeErr) { console.error('[CLOSE FAILED]', closeErr); cleanupFailures++; }
        }
      }
    }
  }

  console.log(`\nRESULTS: ${unit.p + config.p + integration.p} PASS (${unit.p} unit, ${config.p} config, ${integration.p} integration), ${unit.f + config.f + integration.f} FAIL, ${integration.nr} NOT RUN, ${cleanupFailures} CLEANUP FAILURES`);
  if (unit.f + config.f + integration.f > 0 || cleanupFailures > 0) throw new Error('Tests failed or cleanup error.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCurrencyPersistenceTests().catch((err) => { console.error(err); process.exit(1); });
}
