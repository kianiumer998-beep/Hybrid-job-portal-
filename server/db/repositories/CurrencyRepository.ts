import { CurrencyExchangeConfig } from '../../../src/types/adminSuite';
import { INITIAL_CURRENCY_CONFIG } from '../../../src/data/mockAdminSuiteData';
import { getMongoDb, isMongoConfigured, withMongoTimeout } from '../mongodb';

const COLLECTION_NAME = 'system_settings';
const DOC_KEY = 'currency_exchange_config';

export function validateCurrencyConfig(raw: any): { valid: boolean; message?: string; sanitized?: CurrencyExchangeConfig } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { valid: false, message: 'Invalid payload: Currency configuration must be a JSON object.' };
  }

  const baseCurrency = String(raw.baseCurrency || '').trim().toUpperCase();
  if (!baseCurrency || baseCurrency.length > 10) {
    return { valid: false, message: 'Validation Error: Invalid baseCurrency specified.' };
  }

  if (!raw.rates || typeof raw.rates !== 'object' || Array.isArray(raw.rates)) {
    return { valid: false, message: 'Validation Error: "rates" mapping object is required.' };
  }

  const cleanRates: Record<string, number> = {};
  for (const [code, val] of Object.entries(raw.rates)) {
    const cleanCode = String(code).trim().toUpperCase();
    const numVal = Number(val);
    if (!cleanCode || cleanCode.length > 10 || typeof val !== 'number' || !Number.isFinite(numVal) || numVal <= 0) {
      return { valid: false, message: `Validation Error: Rate for currency "${code}" must be a finite positive number.` };
    }
    cleanRates[cleanCode] = numVal;
  }

  if (!Array.isArray(raw.supportedCurrencies) || raw.supportedCurrencies.length === 0) {
    return { valid: false, message: 'Validation Error: "supportedCurrencies" must be a non-empty array of currency codes.' };
  }

  const cleanSupported: string[] = [];
  for (const item of raw.supportedCurrencies) {
    const cleanCode = String(item || '').trim().toUpperCase();
    if (!cleanCode || cleanCode.length > 10) {
      return { valid: false, message: 'Validation Error: Invalid currency code in supportedCurrencies.' };
    }
    if (!cleanSupported.includes(cleanCode)) {
      cleanSupported.push(cleanCode);
    }
  }

  const autoSyncEnabled = Boolean(raw.autoSyncEnabled);
  const lastSyncedAt = String(raw.lastSyncedAt || new Date().toISOString().replace('T', ' ').substring(0, 16) + ' UTC').trim().slice(0, 50);

  const cleanTiers: any = {
    featuredJobFee: {},
    urgentBadgeFee: {},
    verifiedCompanyBadgeFee: {},
    unlimitedMonthlySlotFee: {},
    candidateDatabaseAccessFee: {}
  };

  const rawTiers = raw.internationalPricingTiers && typeof raw.internationalPricingTiers === 'object' ? raw.internationalPricingTiers : {};

  for (const tierKey of ['featuredJobFee', 'urgentBadgeFee', 'verifiedCompanyBadgeFee', 'unlimitedMonthlySlotFee', 'candidateDatabaseAccessFee']) {
    const rawTierMap = rawTiers[tierKey] && typeof rawTiers[tierKey] === 'object' ? rawTiers[tierKey] : {};
    for (const [code, val] of Object.entries(rawTierMap)) {
      const cleanCode = String(code).trim().toUpperCase();
      const numVal = Number(val);
      if (!cleanCode || cleanCode.length > 10 || typeof val !== 'number' || !Number.isFinite(numVal) || numVal < 0) {
        return { valid: false, message: `Validation Error: Fee tier "${tierKey}" for currency "${code}" must be a non-negative finite number.` };
      }
      cleanTiers[tierKey][cleanCode] = numVal;
    }
  }

  const sanitized: CurrencyExchangeConfig = {
    baseCurrency: baseCurrency as any,
    rates: cleanRates as any,
    supportedCurrencies: cleanSupported as any,
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
      await overrideCollection.updateOne(
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
    } else {
      const db = await getMongoDb();
      const coll = db.collection(COLLECTION_NAME);

      await withMongoTimeout(
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
    }

    return cleanConfig;
  }
}
