import { CurrencyRepository, validateCurrencyConfig } from '../db/repositories/CurrencyRepository';
import { INITIAL_CURRENCY_CONFIG } from '../../src/data/mockAdminSuiteData';
import { CurrencyExchangeConfig } from '../../src/types/adminSuite';
import { isMongoConfigured, getMongoDb } from '../db/mongodb';

export async function runCurrencyPersistenceTests() {
  console.log('====================================================');
  console.log('   CURRENCY PERSISTENCE ISOLATED TEST SUITE        ');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${testName}${detail ? ` - ${detail}` : ''}`);
      failed++;
    }
  }

  // Preserve initial state for cleanup
  let initialConfiguredState: { isConfigured: boolean; config: CurrencyExchangeConfig } | null = null;
  if (isMongoConfigured()) {
    try {
      initialConfiguredState = await CurrencyRepository.getConfig();
    } catch (e) {}
  }

  try {
    // 5.1. Validation Rules & Error Rejection (In-Memory / Isolated)
    console.log('--- 1. Validation Rules & Error Rejection ---');
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
        USD: -0.005 // Negative rate
      }
    };
    const val2 = validateCurrencyConfig(negativeRateConfig);
    assert(val2.valid === false, '1.2: Rejects negative exchange rate');

    const stringRateConfig = {
      ...INITIAL_CURRENCY_CONFIG,
      rates: {
        ...INITIAL_CURRENCY_CONFIG.rates,
        USD: 'invalid-string-rate' as any // Non-numeric rate
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
          USD: -100 // Negative fee
        }
      }
    };
    const val4 = validateCurrencyConfig(negativeTierConfig);
    assert(val4.valid === false, '1.4: Rejects negative fee tier value');

    // 5.2. Unconfigured MongoDB Environment Handling
    console.log('\n--- 2. Environment Configuration Handling ---');
    if (!isMongoConfigured()) {
      const unconfiguredGet = await CurrencyRepository.getConfig();
      assert(unconfiguredGet.isConfigured === false, '2.1: Unconfigured Mongo returns isConfigured = false');
      assert(unconfiguredGet.config.baseCurrency === 'PKR', '2.2: Unconfigured Mongo returns default initial config');

      try {
        await CurrencyRepository.saveConfig(INITIAL_CURRENCY_CONFIG);
        assert(false, '2.3: Unconfigured Mongo saveConfig must throw error');
      } catch (err: any) {
        assert(err.message.includes('MONGODB_URI is not configured'), '2.3: Unconfigured Mongo saveConfig throws clear error');
      }
    } else {
      console.log('  [INFO] MongoDB is configured in environment. Testing real repository persistence...');

      // 5.3. Real MongoDB Persistence & Recovery Cycle
      console.log('\n--- 3. MongoDB Persistence Cycle ---');
      const testRatesConfig: CurrencyExchangeConfig = {
        ...INITIAL_CURRENCY_CONFIG,
        lastSyncedAt: '2026-11-08 22:30 UTC',
        rates: {
          ...INITIAL_CURRENCY_CONFIG.rates,
          USD: 0.00358,
          EUR: 0.00328
        }
      };

      const saved = await CurrencyRepository.saveConfig(testRatesConfig);
      assert(saved.rates.USD === 0.00358, '3.1: saveConfig returns saved rates correctly');

      const reloaded = await CurrencyRepository.getConfig();
      assert(reloaded.isConfigured === true, '3.2: getConfig returns isConfigured = true after save');
      assert(reloaded.config.rates.USD === 0.00358, '3.3: getConfig reloads exact saved USD rate');
      assert(reloaded.config.rates.EUR === 0.00328, '3.4: getConfig reloads exact saved EUR rate');

      // Attempting to save invalid rates must throw validation error
      try {
        await CurrencyRepository.saveConfig(negativeRateConfig);
        assert(false, '3.5: saveConfig should throw on invalid rates');
      } catch (err: any) {
        assert(err.message.includes('Validation Error'), '3.5: saveConfig throws clear Validation Error');
      }
    }

    // 5.4. Legacy Migration Payload Validation
    console.log('\n--- 4. Legacy Migration Safety ---');
    const legacyPayload = {
      ...INITIAL_CURRENCY_CONFIG,
      rates: {
        ...INITIAL_CURRENCY_CONFIG.rates,
        USD: 0.00362
      }
    };
    const legacyVal = validateCurrencyConfig(legacyPayload);
    assert(legacyVal.valid === true && legacyVal.sanitized?.rates.USD === 0.00362, '4.1: Valid legacy LocalStorage payload validates safely');

  } finally {
    // Cleanup: Restore original state so tests leave zero residual artifacts in production DB
    if (isMongoConfigured()) {
      try {
        if (initialConfiguredState && initialConfiguredState.isConfigured) {
          await CurrencyRepository.saveConfig(initialConfiguredState.config);
          console.log('\n  [CLEANUP] Restored original MongoDB currency configuration.');
        } else {
          const db = await getMongoDb();
          await db.collection('system_settings').deleteOne({ key: 'currency_exchange_config' });
          console.log('\n  [CLEANUP] Deleted temporary test document from MongoDB system_settings.');
        }
      } catch (e) {
        console.warn('Cleanup warning:', e);
      }
    }
  }

  console.log('\n====================================================');
  console.log(`   TEST RESULTS: ${passed} PASSED, ${failed} FAILED      `);
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
