import { CurrencyRepository, validateCurrencyConfig } from '../db/repositories/CurrencyRepository';
import { INITIAL_CURRENCY_CONFIG } from '../../src/data/mockAdminSuiteData';
import { CurrencyExchangeConfig } from '../../src/types/adminSuite';

export async function runCurrencyPersistenceTests() {
  console.log('====================================================');
  console.log('   CURRENCY CONFIGURATION PERSISTENCE TEST SUITE    ');
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

  // 8.1. Default configuration loads correctly when no saved record exists
  console.log('--- 8.1 Default Configuration Load ---');
  try {
    const loaded = await CurrencyRepository.getConfig();
    assert(Boolean(loaded && loaded.config), '8.1.1: getConfig returns valid object structure');
    assert(loaded.config.baseCurrency === 'PKR', '8.1.2: Default base currency is PKR');
    assert(typeof loaded.config.rates === 'object' && loaded.config.rates.USD > 0, '8.1.3: Default rates include positive USD rate');
  } catch (err: any) {
    assert(false, '8.1 Default Configuration Load', err?.message);
  }

  // 8.2. Valid configuration saves successfully
  console.log('\n--- 8.2 Valid Configuration Saving ---');
  const validTestConfig: CurrencyExchangeConfig = {
    ...INITIAL_CURRENCY_CONFIG,
    lastSyncedAt: '2026-11-08 22:00 UTC',
    rates: {
      ...INITIAL_CURRENCY_CONFIG.rates,
      USD: 0.00355,
      EUR: 0.00325,
      GBP: 0.00275
    }
  };

  try {
    const saved = await CurrencyRepository.saveConfig(validTestConfig);
    assert(saved.rates.USD === 0.00355, '8.2.1: USD rate successfully saved and returned');
    assert(saved.lastSyncedAt === '2026-11-08 22:00 UTC', '8.2.2: lastSyncedAt timestamp updated');
  } catch (err: any) {
    assert(false, '8.2 Valid Configuration Saving', err?.message);
  }

  // 8.3. Saved configuration reloads correctly
  console.log('\n--- 8.3 Reload Saved Configuration ---');
  try {
    const reloaded = await CurrencyRepository.getConfig();
    assert(reloaded.isConfigured === true, '8.3.1: Repository reports isConfigured = true');
    assert(reloaded.config.rates.USD === 0.00355, '8.3.2: USD rate matches saved value of 0.00355');
    assert(reloaded.config.rates.EUR === 0.00325, '8.3.3: EUR rate matches saved value of 0.00325');
  } catch (err: any) {
    assert(false, '8.3 Reload Saved Configuration', err?.message);
  }

  // 8.4. Consistency across sessions / devices
  console.log('\n--- 8.4 Multi-Session Consistency ---');
  try {
    const session1 = await CurrencyRepository.getConfig();
    const session2 = await CurrencyRepository.getConfig();
    assert(JSON.stringify(session1.config.rates) === JSON.stringify(session2.config.rates), '8.4.1: Separate requests yield identical rates configuration');
  } catch (err: any) {
    assert(false, '8.4 Multi-Session Consistency', err?.message);
  }

  // 8.5. Invalid currency codes and exchange rate validation
  console.log('\n--- 8.5 Validation Rules & Error Rejection ---');
  const invalidCodeConfig = {
    ...validTestConfig,
    baseCurrency: '' // Empty code
  };
  const val1 = validateCurrencyConfig(invalidCodeConfig);
  assert(val1.valid === false, '8.5.1: Rejects empty baseCurrency code');

  const negativeRateConfig = {
    ...validTestConfig,
    rates: {
      ...validTestConfig.rates,
      USD: -0.005 // Negative rate
    }
  };
  const val2 = validateCurrencyConfig(negativeRateConfig);
  assert(val2.valid === false, '8.5.2: Rejects negative exchange rate');

  const stringRateConfig = {
    ...validTestConfig,
    rates: {
      ...validTestConfig.rates,
      USD: 'invalid-string-rate' as any // Non-numeric rate
    }
  };
  const val3 = validateCurrencyConfig(stringRateConfig);
  assert(val3.valid === false, '8.5.3: Rejects non-numeric exchange rate');

  const negativeTierConfig = {
    ...validTestConfig,
    internationalPricingTiers: {
      ...validTestConfig.internationalPricingTiers,
      featuredJobFee: {
        ...validTestConfig.internationalPricingTiers.featuredJobFee,
        USD: -100 // Negative fee
      }
    }
  };
  const val4 = validateCurrencyConfig(negativeTierConfig);
  assert(val4.valid === false, '8.5.4: Rejects negative fee tier value');

  // Attempting to save invalid payload via saveConfig must throw an error
  try {
    await CurrencyRepository.saveConfig(negativeRateConfig);
    assert(false, '8.5.5: saveConfig should throw on invalid rates');
  } catch (err: any) {
    assert(err.message.includes('Validation Error'), '8.5.5: saveConfig throws clear Validation Error on invalid payload');
  }

  // 8.8. Legacy LocalStorage migration helper validation
  console.log('\n--- 8.8 Legacy LocalStorage Migration Safety ---');
  const legacyConfig = {
    ...INITIAL_CURRENCY_CONFIG,
    rates: {
      ...INITIAL_CURRENCY_CONFIG.rates,
      USD: 0.00361
    }
  };
  const legacyVal = validateCurrencyConfig(legacyConfig);
  assert(legacyVal.valid === true && legacyVal.sanitized?.rates.USD === 0.00361, '8.8.1: Legacy configuration payload passes validation safely');

  console.log('\n====================================================');
  console.log(`   TEST RESULTS: ${passed} PASSED, ${failed} FAILED      `);
  console.log('====================================================\n');

  if (failed > 0) {
    throw new Error(`Currency Persistence Tests Failed (${failed} failures)`);
  }
}

// Allow direct execution via tsx
if (import.meta.url === `file://${process.argv[1]}`) {
  runCurrencyPersistenceTests().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
