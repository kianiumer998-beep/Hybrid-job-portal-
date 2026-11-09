import { CurrencyExchangeConfig } from '../../../src/types/adminSuite';
import { INITIAL_CURRENCY_CONFIG } from '../../../src/data/mockAdminSuiteData';
import { getMongoDb, isMongoConfigured, withMongoTimeout } from '../mongodb';
import { Database } from '../database';

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
  static async getConfig(): Promise<{ isConfigured: boolean; config: CurrencyExchangeConfig }> {
    if (isMongoConfigured()) {
      try {
        const db = await getMongoDb();
        const coll = db.collection(COLLECTION_NAME);
        const doc = await withMongoTimeout(
          coll.findOne({ key: DOC_KEY }),
          8000,
          'fetch currency config'
        );
        if (doc && doc.config) {
          const validation = validateCurrencyConfig(doc.config);
          if (validation.valid && validation.sanitized) {
            return { isConfigured: true, config: validation.sanitized };
          }
        }
      } catch (err) {
        console.error('[CurrencyRepository] Failed to fetch from MongoDB, checking disk fallback:', err);
      }
    }

    // Disk JSON fallback via Database
    const diskConfig = Database.getCurrencyConfig();
    if (diskConfig) {
      const validation = validateCurrencyConfig(diskConfig);
      if (validation.valid && validation.sanitized) {
        return { isConfigured: true, config: validation.sanitized };
      }
    }

    return { isConfigured: false, config: INITIAL_CURRENCY_CONFIG };
  }

  static async saveConfig(rawConfig: any): Promise<CurrencyExchangeConfig> {
    const validation = validateCurrencyConfig(rawConfig);
    if (!validation.valid || !validation.sanitized) {
      throw new Error(validation.message || 'Validation Error: Invalid currency configuration.');
    }

    const cleanConfig = validation.sanitized;

    if (isMongoConfigured()) {
      const db = await getMongoDb();
      const coll = db.collection(COLLECTION_NAME);

      await withMongoTimeout(
        coll.updateOne(
          { key: DOC_KEY },
          {
            $set: {
              key: DOC_KEY,
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

    // Always update disk fallback for consistency across container reboots
    Database.saveCurrencyConfig(cleanConfig);
    return cleanConfig;
  }
}
