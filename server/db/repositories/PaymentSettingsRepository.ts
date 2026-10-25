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

    const sanitizeCustomFields = (rawList: any): any[] => {
      if (!Array.isArray(rawList)) return [];
      return rawList
        .slice(0, 20)
        .filter((f) => f && typeof f === 'object' && f.label)
        .map((f, idx) => ({
          id: String(f.id || `field-${idx + 1}`).trim().slice(0, 50),
          label: String(f.label).trim().slice(0, 100),
          type: f.type === 'number' ? 'number' : 'text',
          placeholder: f.placeholder ? String(f.placeholder).trim().slice(0, 100) : undefined,
          helpText: f.helpText ? String(f.helpText).trim().slice(0, 200) : undefined,
          required: Boolean(f.required),
          order: typeof f.order === 'number' && Number.isFinite(f.order) ? f.order : idx
        }))
        .sort((a, b) => a.order - b.order);
    };

    const sanitizeMethod = (
      id: string,
      defaultName: string,
      methodRaw: any,
      isCustomDefault = false
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
        isCustom: m.isCustom !== undefined ? Boolean(m.isCustom) : isCustomDefault,
        transactionIdRequired: m.transactionIdRequired !== undefined ? Boolean(m.transactionIdRequired) : true,
        transactionIdLabel: m.transactionIdLabel ? String(m.transactionIdLabel).trim().slice(0, 100) : undefined,
        transactionIdPlaceholder: m.transactionIdPlaceholder ? String(m.transactionIdPlaceholder).trim().slice(0, 100) : undefined,
        transactionIdHelpText: m.transactionIdHelpText ? String(m.transactionIdHelpText).trim().slice(0, 200) : undefined,
        screenshotRequired: m.screenshotRequired !== undefined ? Boolean(m.screenshotRequired) : true,
        screenshotLabel: m.screenshotLabel ? String(m.screenshotLabel).trim().slice(0, 100) : undefined,
        screenshotHelpText: m.screenshotHelpText ? String(m.screenshotHelpText).trim().slice(0, 200) : undefined,
        senderNameRequired: m.senderNameRequired !== undefined ? Boolean(m.senderNameRequired) : false,
        senderNameLabel: m.senderNameLabel ? String(m.senderNameLabel).trim().slice(0, 100) : undefined,
        senderPhoneRequired: m.senderPhoneRequired !== undefined ? Boolean(m.senderPhoneRequired) : false,
        senderPhoneLabel: m.senderPhoneLabel ? String(m.senderPhoneLabel).trim().slice(0, 100) : undefined,
        senderPhonePlaceholder: m.senderPhonePlaceholder ? String(m.senderPhonePlaceholder).trim().slice(0, 100) : undefined,
        proofNoteRequired: Boolean(m.proofNoteRequired),
        proofNoteLabel: m.proofNoteLabel ? String(m.proofNoteLabel).trim().slice(0, 100) : undefined,
        proofNotePlaceholder: m.proofNotePlaceholder ? String(m.proofNotePlaceholder).trim().slice(0, 100) : undefined,
        customFields: sanitizeCustomFields(m.customFields)
      };
    };

    const rawMethods = raw.methods && typeof raw.methods === 'object' ? raw.methods : {};

    const easypaisa = sanitizeMethod('easypaisa', 'EasyPaisa', rawMethods.easypaisa, false);
    const jazzcash = sanitizeMethod('jazzcash', 'JazzCash', rawMethods.jazzcash, false);
    const bank = sanitizeMethod('bank', 'Bank Transfer / Raast / IBAN', rawMethods.bank, false);

    const methodsMap: Record<string, PublicPaymentMethodConfig> = {
      easypaisa,
      jazzcash,
      bank
    };

    // Sanitize any additional custom methods present in raw.methods
    for (const [key, rawVal] of Object.entries(rawMethods)) {
      if (key !== 'easypaisa' && key !== 'jazzcash' && key !== 'bank') {
        const cleanKey = String(key).trim().slice(0, 50);
        if (cleanKey && rawVal && typeof rawVal === 'object') {
          methodsMap[cleanKey] = sanitizeMethod(cleanKey, (rawVal as any).name || cleanKey, rawVal, true);
        }
      }
    }

    // Also support raw.customMethods array if provided
    if (Array.isArray(raw.customMethods)) {
      for (const cm of raw.customMethods) {
        if (cm && typeof cm === 'object' && cm.id) {
          const cleanKey = String(cm.id).trim().slice(0, 50);
          if (cleanKey && cleanKey !== 'easypaisa' && cleanKey !== 'jazzcash' && cleanKey !== 'bank') {
            methodsMap[cleanKey] = sanitizeMethod(cleanKey, cm.name || cleanKey, cm, true);
          }
        }
      }
    }

    const customMethodsList = Object.values(methodsMap).filter(
      (m) => m.isCustom || (m.id !== 'easypaisa' && m.id !== 'jazzcash' && m.id !== 'bank')
    );

    const hasAnyEnabled = Object.values(methodsMap).some(
      (m) => m.enabled && m.accountTitle && m.accountNumber
    );

    return {
      isConfigured: Boolean(raw.isConfigured && hasAnyEnabled),
      methods: methodsMap as any,
      customMethods: customMethodsList,
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

    // Collect all methods to validate (base + custom)
    const methodsToValidate: Record<string, any> = { ...rawMethods };
    if (Array.isArray(payload.customMethods)) {
      for (const cm of payload.customMethods) {
        if (cm && typeof cm === 'object' && cm.id) {
          methodsToValidate[cm.id] = cm;
        }
      }
    }

    const validatedMethods: Record<string, PublicPaymentMethodConfig> = {};

    // Validate base methods and all custom methods
    for (const [key, m] of Object.entries(methodsToValidate)) {
      if (!m || typeof m !== 'object') {
        throw new Error(`Validation Error: Method configuration for "${key}" is missing.`);
      }

      const isBaseMethod = key === 'easypaisa' || key === 'jazzcash' || key === 'bank';
      const cleanKey = String(key).trim().slice(0, 50);
      if (!cleanKey || !/^[a-zA-Z0-9_-]+$/.test(cleanKey)) {
        throw new Error(`Validation Error: Invalid payment method ID "${key}". Only alphanumeric, dashes and underscores allowed.`);
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

      // Validate customFields if provided
      let customFields: any[] = [];
      if (Array.isArray(m.customFields)) {
        if (m.customFields.length > 20) {
          throw new Error(`Validation Error for "${name}": A maximum of 20 custom proof fields are allowed.`);
        }
        customFields = m.customFields.map((f: any, idx: number) => {
          if (!f || typeof f !== 'object') {
            throw new Error(`Validation Error for "${name}": Invalid custom proof field at index ${idx}.`);
          }
          const label = String(f.label || '').trim();
          if (!label) {
            throw new Error(`Validation Error for "${name}": Custom field label is required at field #${idx + 1}.`);
          }
          if (label.length > 100) {
            throw new Error(`Validation Error for "${name}": Custom field label cannot exceed 100 characters.`);
          }
          const fieldType = f.type === 'number' ? 'number' : 'text';
          return {
            id: String(f.id || `field-${idx + 1}`).trim().slice(0, 50),
            label,
            type: fieldType,
            placeholder: f.placeholder ? String(f.placeholder).trim().slice(0, 100) : undefined,
            helpText: f.helpText ? String(f.helpText).trim().slice(0, 200) : undefined,
            required: Boolean(f.required),
            order: typeof f.order === 'number' && Number.isFinite(f.order) ? f.order : idx
          };
        }).sort((a: any, b: any) => a.order - b.order);
      }

      validatedMethods[cleanKey] = {
        id: cleanKey,
        name,
        enabled,
        heading: m.heading ? String(m.heading).trim().slice(0, 100) : undefined,
        accountTitle,
        accountNumber,
        bankName: m.bankName ? String(m.bankName).trim().slice(0, 100) : undefined,
        iban: m.iban ? String(m.iban).trim().slice(0, 60) : undefined,
        instructions,
        formTitle: m.formTitle ? String(m.formTitle).trim().slice(0, 100) : undefined,
        formSubtitle: m.formSubtitle ? String(m.formSubtitle).trim().slice(0, 200) : undefined,
        isCustom: !isBaseMethod,
        transactionIdRequired,
        transactionIdLabel: m.transactionIdLabel ? String(m.transactionIdLabel).trim().slice(0, 100) : undefined,
        transactionIdPlaceholder: m.transactionIdPlaceholder ? String(m.transactionIdPlaceholder).trim().slice(0, 100) : undefined,
        transactionIdHelpText: m.transactionIdHelpText ? String(m.transactionIdHelpText).trim().slice(0, 200) : undefined,
        screenshotRequired,
        screenshotLabel: m.screenshotLabel ? String(m.screenshotLabel).trim().slice(0, 100) : undefined,
        screenshotHelpText: m.screenshotHelpText ? String(m.screenshotHelpText).trim().slice(0, 200) : undefined,
        senderNameRequired: m.senderNameRequired !== undefined ? Boolean(m.senderNameRequired) : false,
        senderNameLabel: m.senderNameLabel ? String(m.senderNameLabel).trim().slice(0, 100) : undefined,
        senderPhoneRequired: m.senderPhoneRequired !== undefined ? Boolean(m.senderPhoneRequired) : false,
        senderPhoneLabel: m.senderPhoneLabel ? String(m.senderPhoneLabel).trim().slice(0, 100) : undefined,
        senderPhonePlaceholder: m.senderPhonePlaceholder ? String(m.senderPhonePlaceholder).trim().slice(0, 100) : undefined,
        proofNoteRequired,
        proofNoteLabel: m.proofNoteLabel ? String(m.proofNoteLabel).trim().slice(0, 100) : undefined,
        proofNotePlaceholder: m.proofNotePlaceholder ? String(m.proofNotePlaceholder).trim().slice(0, 100) : undefined,
        customFields
      };
    }

    // Ensure base methods exist
    if (!validatedMethods.easypaisa || !validatedMethods.jazzcash || !validatedMethods.bank) {
      throw new Error('Validation Error: Default methods (easypaisa, jazzcash, bank) must be present in settings.');
    }

    const defaultMethod = payload.defaultMethod ? String(payload.defaultMethod).trim() : 'easypaisa';
    const hasAnyEnabled = Object.values(validatedMethods).some(
      (m) => m.enabled && m.accountTitle && m.accountNumber
    );

    const customMethodsList = Object.values(validatedMethods).filter(
      (m) => m.isCustom || (m.id !== 'easypaisa' && m.id !== 'jazzcash' && m.id !== 'bank')
    );

    const nowIso = new Date().toISOString();
    const updatedBy = user?.name || user?.email || 'Administrator';

    const cleanSettings: PublicPaymentSettings = {
      isConfigured: hasAnyEnabled,
      methods: validatedMethods as any,
      customMethods: customMethodsList,
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
