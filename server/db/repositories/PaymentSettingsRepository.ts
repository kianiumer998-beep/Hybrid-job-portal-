import { getMongoDb, isMongoConfigured, withMongoTimeout } from '../mongodb';
import { PublicPaymentMethodConfig, PublicPaymentSettings } from '../../../src/types/adminPayment';

const SETTINGS_DOC_KEY = 'admin_payment_settings';
const COLLECTION_NAME = 'payment_settings';

async function getPaymentSettingsCollection() {
  const db = await getMongoDb();
  return db.collection(COLLECTION_NAME);
}

export class PaymentSettingsRepository {
  /**
   * Sanitizes payment settings to ensure only public instruction fields are exposed.
   * Strips any internal metadata, credentials, tokens, or pricing configuration.
   */
  static sanitizePublicSettings(raw: any): PublicPaymentSettings {
    if (!raw || typeof raw !== 'object') {
      return {
        isConfigured: false,
        methods: {
          easypaisa: {
            id: 'easypaisa',
            name: 'EasyPaisa',
            enabled: false,
            accountTitle: '',
            accountNumber: '',
            instructions: '',
            transactionIdRequired: true,
            screenshotRequired: true,
            proofNoteRequired: false
          },
          jazzcash: {
            id: 'jazzcash',
            name: 'JazzCash',
            enabled: false,
            accountTitle: '',
            accountNumber: '',
            instructions: '',
            transactionIdRequired: true,
            screenshotRequired: true,
            proofNoteRequired: false
          },
          bank: {
            id: 'bank',
            name: 'Bank Transfer / Raast / IBAN',
            enabled: false,
            accountTitle: '',
            accountNumber: '',
            bankName: '',
            iban: '',
            instructions: '',
            transactionIdRequired: true,
            screenshotRequired: true,
            proofNoteRequired: false
          }
        }
      };
    }

    const sanitizeMethod = (
      id: string,
      defaultName: string,
      methodRaw: any
    ): PublicPaymentMethodConfig => {
      const m = methodRaw && typeof methodRaw === 'object' ? methodRaw : {};
      return {
        id,
        name: String(m.name || defaultName).trim().slice(0, 100),
        enabled: Boolean(m.enabled),
        heading: m.heading ? String(m.heading).trim().slice(0, 100) : undefined,
        accountTitle: String(m.accountTitle || '').trim().slice(0, 100),
        accountNumber: String(m.accountNumber || '').trim().slice(0, 60),
        bankName: m.bankName ? String(m.bankName).trim().slice(0, 100) : undefined,
        iban: m.iban ? String(m.iban).trim().slice(0, 60) : undefined,
        instructions: String(m.instructions || '').trim().slice(0, 1000),
        formTitle: m.formTitle ? String(m.formTitle).trim().slice(0, 100) : undefined,
        formSubtitle: m.formSubtitle ? String(m.formSubtitle).trim().slice(0, 200) : undefined,
        transactionIdRequired: m.transactionIdRequired !== undefined ? Boolean(m.transactionIdRequired) : true,
        transactionIdLabel: m.transactionIdLabel ? String(m.transactionIdLabel).trim().slice(0, 100) : undefined,
        transactionIdPlaceholder: m.transactionIdPlaceholder ? String(m.transactionIdPlaceholder).trim().slice(0, 100) : undefined,
        transactionIdHelpText: m.transactionIdHelpText ? String(m.transactionIdHelpText).trim().slice(0, 200) : undefined,
        screenshotRequired: m.screenshotRequired !== undefined ? Boolean(m.screenshotRequired) : true,
        screenshotLabel: m.screenshotLabel ? String(m.screenshotLabel).trim().slice(0, 100) : undefined,
        screenshotHelpText: m.screenshotHelpText ? String(m.screenshotHelpText).trim().slice(0, 200) : undefined,
        proofNoteRequired: Boolean(m.proofNoteRequired),
        proofNoteLabel: m.proofNoteLabel ? String(m.proofNoteLabel).trim().slice(0, 100) : undefined,
        proofNotePlaceholder: m.proofNotePlaceholder ? String(m.proofNotePlaceholder).trim().slice(0, 100) : undefined
      };
    };

    const rawMethods = raw.methods && typeof raw.methods === 'object' ? raw.methods : {};

    const easypaisa = sanitizeMethod('easypaisa', 'EasyPaisa', rawMethods.easypaisa);
    const jazzcash = sanitizeMethod('jazzcash', 'JazzCash', rawMethods.jazzcash);
    const bank = sanitizeMethod('bank', 'Bank Transfer / Raast / IBAN', rawMethods.bank);

    const hasAnyEnabled = [easypaisa, jazzcash, bank].some(
      (m) => m.enabled && m.accountTitle && m.accountNumber
    );

    return {
      isConfigured: Boolean(raw.isConfigured && hasAnyEnabled),
      methods: {
        easypaisa,
        jazzcash,
        bank
      },
      defaultMethod: raw.defaultMethod ? String(raw.defaultMethod).trim().slice(0, 50) : undefined,
      updatedAt: raw.updatedAt ? String(raw.updatedAt) : undefined,
      updatedBy: raw.updatedBy ? String(raw.updatedBy).trim().slice(0, 100) : undefined
    };
  }

  /**
   * Retrieves public payment settings from MongoDB.
   * Throws if MongoDB is configured but unavailable.
   * Returns explicit unconfigured state if no valid settings have been saved.
   */
  static async getPublicSettings(): Promise<{ isConfigured: boolean; settings: PublicPaymentSettings | null }> {
    if (!isMongoConfigured()) {
      throw new Error('Database Configuration Error: MONGODB_URI is not configured.');
    }

    const coll = await getPaymentSettingsCollection();
    const doc = await withMongoTimeout(
      coll.findOne({ key: SETTINGS_DOC_KEY }),
      8000,
      'fetch public payment settings'
    );

    if (!doc || !doc.isConfigured || !doc.settings) {
      return { isConfigured: false, settings: null };
    }

    const sanitized = this.sanitizePublicSettings(doc.settings);
    if (!sanitized.isConfigured) {
      return { isConfigured: false, settings: null };
    }

    return { isConfigured: true, settings: sanitized };
  }

  /**
   * Validates and updates payment settings in MongoDB.
   * Enforces complete server-side payload validation, string lengths, and proof requirement constraints.
   */
  static async updateSettings(
    payload: any,
    user?: { name?: string; email?: string }
  ): Promise<PublicPaymentSettings> {
    if (!isMongoConfigured()) {
      throw new Error('Database Configuration Error: MONGODB_URI is not configured.');
    }

    if (!payload || typeof payload !== 'object') {
      throw new Error('Invalid request payload: Expected a JSON object.');
    }

    const rawMethods = payload.methods;
    if (!rawMethods || typeof rawMethods !== 'object') {
      throw new Error('Validation Error: "methods" configuration object is required.');
    }

    // Validate each supported method
    const supportedKeys = ['easypaisa', 'jazzcash', 'bank'] as const;
    const validatedMethods: Record<string, PublicPaymentMethodConfig> = {};

    for (const key of supportedKeys) {
      const m = rawMethods[key];
      if (!m || typeof m !== 'object') {
        throw new Error(`Validation Error: Method configuration for "${key}" is missing.`);
      }

      const enabled = Boolean(m.enabled);
      const name = String(m.name || key).trim();
      if (!name || name.length > 100) {
        throw new Error(`Validation Error for ${key}: Display name must be between 1 and 100 characters.`);
      }

      const accountTitle = String(m.accountTitle || '').trim();
      const accountNumber = String(m.accountNumber || '').trim();
      const instructions = String(m.instructions || '').trim();

      const transactionIdRequired = m.transactionIdRequired !== undefined ? Boolean(m.transactionIdRequired) : true;
      const screenshotRequired = m.screenshotRequired !== undefined ? Boolean(m.screenshotRequired) : true;
      const proofNoteRequired = Boolean(m.proofNoteRequired);

      if (enabled) {
        if (!accountTitle) {
          throw new Error(`Validation Error for "${name}": Account Title is required when enabled.`);
        }
        if (accountTitle.length > 100) {
          throw new Error(`Validation Error for "${name}": Account Title cannot exceed 100 characters.`);
        }

        if (!accountNumber) {
          throw new Error(`Validation Error for "${name}": Account or Mobile Number is required when enabled.`);
        }
        if (accountNumber.length > 60) {
          throw new Error(`Validation Error for "${name}": Account or Mobile Number cannot exceed 60 characters.`);
        }

        if (!instructions) {
          throw new Error(`Validation Error for "${name}": Transfer instructions are required when enabled.`);
        }
        if (instructions.length > 1000) {
          throw new Error(`Validation Error for "${name}": Instructions cannot exceed 1000 characters.`);
        }

        if (key === 'bank') {
          const bankName = String(m.bankName || '').trim();
          if (!bankName) {
            throw new Error('Validation Error for Bank Transfer: Bank Name is required when enabled.');
          }
          if (bankName.length > 100) {
            throw new Error('Validation Error for Bank Transfer: Bank Name cannot exceed 100 characters.');
          }
        }

        // ENFORCE AT LEAST ONE PROOF MECHANISM FOR EVERY ENABLED MANUAL PAYMENT METHOD
        if (!transactionIdRequired && !screenshotRequired) {
          throw new Error(
            `Validation Error for "${name}": At least one proof mechanism (Transaction ID or Payment Receipt Screenshot) must be required for enabled methods.`
          );
        }
      }

      validatedMethods[key] = {
        id: key,
        name,
        enabled,
        heading: m.heading ? String(m.heading).trim().slice(0, 100) : undefined,
        accountTitle,
        accountNumber,
        bankName: key === 'bank' && m.bankName ? String(m.bankName).trim().slice(0, 100) : undefined,
        iban: key === 'bank' && m.iban ? String(m.iban).trim().slice(0, 60) : undefined,
        instructions,
        formTitle: m.formTitle ? String(m.formTitle).trim().slice(0, 100) : undefined,
        formSubtitle: m.formSubtitle ? String(m.formSubtitle).trim().slice(0, 200) : undefined,
        transactionIdRequired,
        transactionIdLabel: m.transactionIdLabel ? String(m.transactionIdLabel).trim().slice(0, 100) : undefined,
        transactionIdPlaceholder: m.transactionIdPlaceholder ? String(m.transactionIdPlaceholder).trim().slice(0, 100) : undefined,
        transactionIdHelpText: m.transactionIdHelpText ? String(m.transactionIdHelpText).trim().slice(0, 200) : undefined,
        screenshotRequired,
        screenshotLabel: m.screenshotLabel ? String(m.screenshotLabel).trim().slice(0, 100) : undefined,
        screenshotHelpText: m.screenshotHelpText ? String(m.screenshotHelpText).trim().slice(0, 200) : undefined,
        proofNoteRequired,
        proofNoteLabel: m.proofNoteLabel ? String(m.proofNoteLabel).trim().slice(0, 100) : undefined,
        proofNotePlaceholder: m.proofNotePlaceholder ? String(m.proofNotePlaceholder).trim().slice(0, 100) : undefined
      };
    }

    const defaultMethod = payload.defaultMethod ? String(payload.defaultMethod).trim() : 'easypaisa';
    const hasAnyEnabled = Object.values(validatedMethods).some(
      (m) => m.enabled && m.accountTitle && m.accountNumber
    );

    const nowIso = new Date().toISOString();
    const updatedBy = user?.name || user?.email || 'Administrator';

    const cleanSettings: PublicPaymentSettings = {
      isConfigured: hasAnyEnabled,
      methods: {
        easypaisa: validatedMethods.easypaisa,
        jazzcash: validatedMethods.jazzcash,
        bank: validatedMethods.bank
      },
      defaultMethod,
      updatedAt: nowIso,
      updatedBy
    };

    const coll = await getPaymentSettingsCollection();
    await withMongoTimeout(
      coll.updateOne(
        { key: SETTINGS_DOC_KEY },
        {
          $set: {
            key: SETTINGS_DOC_KEY,
            isConfigured: cleanSettings.isConfigured,
            settings: cleanSettings,
            updatedAt: nowIso,
            updatedBy
          }
        },
        { upsert: true }
      ),
      8000,
      'save payment settings'
    );

    return cleanSettings;
  }
}
