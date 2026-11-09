import { CurrencyExchangeConfig } from '../../../src/types/adminSuite';
import { Currency } from '../../../src/types/job';
import { INITIAL_CURRENCY_CONFIG } from '../../../src/data/mockAdminSuiteData';
import { getMongoDb, isMongoConfigured, withMongoTimeout } from '../mongodb';

const COLLECTION_NAME = 'system_settings';
const DOC_KEY = 'currency_exchange_config';

export const ALLOWED_CURRENCIES: readonly Currency[] = ['PKR', 'USD', 'EUR', 'GBP', 'AED', 'SAR', 'CAD', 'AUD'] as const;
export const ALLOWED_TIER_KEYS = [
  'featuredJobFee',
  'urgentBadgeFee',
  'verifiedCompanyBadgeFee',
  'unlimitedMonthlySlotFee',
  'candidateDatabaseAccessFee'
] as const;

export function validateCurrencyConfig(raw: any): { valid: boolean; message?: string; sanitized?: CurrencyExchangeConfig } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { valid: false, message: 'Invalid payload: Currency configuration must be a JSON object.' };
  }

  const baseCurrency = String(raw.baseCurrency || '').trim().toUpperCase();
  if (baseCurrency !== 'PKR') {
    return { valid: false, message: 'Validation Error: baseCurrency must be "PKR".' };
  }

  if (!raw.rates || typeof raw.rates !== 'object' || Array.isArray(raw.rates)) {
    return { valid: false, message: 'Validation Error: "rates" mapping object is required.' };
  }

  if (!Array.isArray(raw.supportedCurrencies) || raw.supportedCurrencies.length === 0) {
    return { valid: false, message: 'Validation Error: "supportedCurrencies" must be a non-empty array of currency codes.' };
  }

  const cleanSupported: Currency[] = [];
  for (const item of raw.supportedCurrencies) {
    const cleanCode = String(item || '').trim().toUpperCase() as Currency;
    if (!ALLOWED_CURRENCIES.includes(cleanCode)) {
      return { valid: false, message: `Validation Error: Unsupported currency code "${item}" in supportedCurrencies.` };
    }
    if (!cleanSupported.includes(cleanCode)) {
      cleanSupported.push(cleanCode);
    }
  }

  // OBJECTIVE 1: Enforce complete 8-currency configuration in supportedCurrencies
  for (const curr of ALLOWED_CURRENCIES) {
    if (!cleanSupported.includes(curr)) {
      return { valid: false, message: `Validation Error: "supportedCurrencies" must include all 8 supported currencies (PKR, USD, EUR, GBP, AED, SAR, CAD, AUD). Missing "${curr}".` };
    }
  }

  const cleanRates: Record<Currency, number> = {} as any;
  for (const [code, val] of Object.entries(raw.rates)) {
    const cleanCode = String(code).trim().toUpperCase() as Currency;
    if (!ALLOWED_CURRENCIES.includes(cleanCode)) {
      return { valid: false, message: `Validation Error: Unsupported currency code "${code}" in rates.` };
    }
    const numVal = Number(val);
    if (typeof val !== 'number' || !Number.isFinite(numVal) || numVal <= 0) {
      return { valid: false, message: `Validation Error: Rate for currency "${code}" must be a finite positive number.` };
    }
    cleanRates[cleanCode] = numVal;
  }

  if (cleanRates.PKR !== 1) {
    return { valid: false, message: 'Validation Error: Base currency "PKR" rate must be exactly 1.0.' };
  }

  // Ensure valid positive finite rates exist for all 8 supported currencies
  for (const curr of ALLOWED_CURRENCIES) {
    if (cleanRates[curr] === undefined || typeof cleanRates[curr] !== 'number' || !Number.isFinite(cleanRates[curr]) || cleanRates[curr] <= 0) {
      return { valid: false, message: `Validation Error: Missing or invalid rate for supported currency "${curr}".` };
    }
  }

  const autoSyncEnabled = typeof raw.autoSyncEnabled === 'boolean' ? raw.autoSyncEnabled : false;
  const lastSyncedAt = (typeof raw.lastSyncedAt === 'string' && raw.lastSyncedAt.trim())
    ? raw.lastSyncedAt.trim().slice(0, 50)
    : INITIAL_CURRENCY_CONFIG.lastSyncedAt;

  const cleanTiers: any = {
    featuredJobFee: {},
    urgentBadgeFee: {},
    verifiedCompanyBadgeFee: {},
    unlimitedMonthlySlotFee: {},
    candidateDatabaseAccessFee: {}
  };

  const rawTiers = raw.internationalPricingTiers && typeof raw.internationalPricingTiers === 'object' ? raw.internationalPricingTiers : {};

  for (const tierKey of ALLOWED_TIER_KEYS) {
    const rawTierMap = rawTiers[tierKey] && typeof rawTiers[tierKey] === 'object' ? rawTiers[tierKey] : {};
    for (const [code, val] of Object.entries(rawTierMap)) {
      const cleanCode = String(code).trim().toUpperCase() as Currency;
      if (!ALLOWED_CURRENCIES.includes(cleanCode)) {
        return { valid: false, message: `Validation Error: Unsupported currency code "${code}" in fee tier "${tierKey}".` };
      }
      const numVal = Number(val);
      if (typeof val !== 'number' || !Number.isFinite(numVal) || numVal < 0) {
        return { valid: false, message: `Validation Error: Fee tier "${tierKey}" for currency "${code}" must be a non-negative finite number.` };
      }
      cleanTiers[tierKey][cleanCode] = numVal;
    }

    // Safely populate any missing currencies for this tier from INITIAL_CURRENCY_CONFIG without overwriting existing
    for (const curr of ALLOWED_CURRENCIES) {
      if (cleanTiers[tierKey][curr] === undefined) {
        const defaultVal = INITIAL_CURRENCY_CONFIG.internationalPricingTiers[tierKey]?.[curr];
        cleanTiers[tierKey][curr] = typeof defaultVal === 'number' ? defaultVal : 0;
      }
    }
  }

  const sanitized: CurrencyExchangeConfig = {
    baseCurrency: 'PKR',
    rates: cleanRates,
    supportedCurrencies: cleanSupported,
    autoSyncEnabled,
    lastSyncedAt,
    internationalPricingTiers: cleanTiers
  };

  return { valid: true, sanitized };
}

export class CurrencyRepository {
  static async getConfig(overrideCollection?: any, overrideDocKey?: string): Promise<{ isConfigured: boolean; config: CurrencyExchangeConfig }> {
    if (!overrideCollection && !isMongoConfigured()) {
      return { isConfigured: false, config: INITIAL_CURRENCY_CONFIG };
    }

    const docKey = overrideDocKey || DOC_KEY;
    let doc: any = null;

    if (overrideCollection) {
      doc = await overrideCollection.findOne({ key: docKey });
    } else {
      const db = await getMongoDb();
      const coll = db.collection(COLLECTION_NAME);
      doc = await withMongoTimeout(
        coll.findOne({ key: docKey }),
        8000,
        'fetch currency config'
      );
    }

    if (!doc) {
      return { isConfigured: false, config: INITIAL_CURRENCY_CONFIG };
    }

    if (!doc.config || typeof doc.config !== 'object') {
      throw new Error('Data Integrity Error: Currency configuration document exists in database but has invalid or missing "config" field.');
    }

    const validation = validateCurrencyConfig(doc.config);
    if (!validation.valid || !validation.sanitized) {
      throw new Error(`Data Integrity Error: Existing currency configuration document in database is invalid: ${validation.message || 'Validation failed'}`);
    }

    return { isConfigured: true, config: validation.sanitized };
  }

  static async saveConfig(rawConfig: any, overrideCollection?: any, overrideDocKey?: string): Promise<CurrencyExchangeConfig> {
    if (!overrideCollection && !isMongoConfigured()) {
      throw new Error('Database Configuration Error: MONGODB_URI is not configured in the environment.');
    }

    const validation = validateCurrencyConfig(rawConfig);
    if (!validation.valid || !validation.sanitized) {
      throw new Error(validation.message || 'Validation Error: Invalid currency configuration.');
    }

    const cleanConfig = validation.sanitized;
    const docKey = overrideDocKey || DOC_KEY;

    if (overrideCollection) {
      const result = await overrideCollection.updateOne(
        { key: docKey },
        {
          $set: {
            key: docKey,
            config: cleanConfig,
            updatedAt: new Date().toISOString()
          }
        },
        { upsert: true }
      );
      if (result && result.acknowledged === false) {
        throw new Error('Database Write Error: MongoDB write operation was not acknowledged.');
      }
    } else {
      const db = await getMongoDb();
      const coll = db.collection(COLLECTION_NAME);

      const result = await withMongoTimeout(
        coll.updateOne(
          { key: docKey },
          {
            $set: {
              key: docKey,
              config: cleanConfig,
              updatedAt: new Date().toISOString()
            }
          },
          { upsert: true }
        ),
        8000,
        'save currency config'
      );
      if (result && result.acknowledged === false) {
        throw new Error('Database Write Error: MongoDB write operation was not acknowledged.');
      }
    }

    return cleanConfig;
  }
}
