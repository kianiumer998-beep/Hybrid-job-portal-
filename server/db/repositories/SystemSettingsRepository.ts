import { getMongoDb, isMongoConfigured, withMongoTimeout } from '../mongodb';

const COLLECTION_NAME = 'system_settings';

export interface WhatsAppSupportConfig {
  enabled: boolean;
  phoneNumber: string;
  defaultMessage: string;
  agentName: string;
  supportHoursText: string;
  position: 'bottom-right' | 'bottom-left' | 'right' | 'left';
  showGreetingBubble?: boolean;
  greetingText?: string;
  mobileSize?: 'compact' | 'standard' | 'large';
  desktopSize?: 'compact' | 'standard' | 'large';
  iconSize?: 'compact' | 'standard' | 'large';
  bubbleSize?: 'compact' | 'standard' | 'large';
  autoShowDelaySeconds?: number;
  showOnlineBadge?: boolean;
  greetingCtaText?: string;
  enablePulseAnimation?: boolean;
  groupLink?: string;
}

export const DEFAULT_WHATSAPP_SUPPORT_CONFIG: WhatsAppSupportConfig = {
  enabled: false,
  phoneNumber: '',
  defaultMessage: 'Hello! I need assistance regarding job applications and career alerts on HybridJobs.pk.',
  agentName: 'Ayesha (Career Advisor)',
  supportHoursText: 'Online • 9:00 AM - 9:00 PM PKT',
  position: 'bottom-right',
  showGreetingBubble: true,
  greetingText: 'Need help applying for remote jobs, hiring candidates, or setting WhatsApp alerts? Chat directly with our team!',
  mobileSize: 'standard',
  desktopSize: 'standard',
  iconSize: 'standard',
  bubbleSize: 'standard',
  autoShowDelaySeconds: 4.5,
  showOnlineBadge: true,
  greetingCtaText: 'Start WhatsApp Chat',
  enablePulseAnimation: true,
  groupLink: ''
};

const KNOWN_SAMPLE_WHATSAPP_PHONES = new Set([
  '923001234567',
  '03001234567',
  '923219876543',
  '923000000000',
  '1234567890',
  '123456789012'
]);

const KNOWN_SAMPLE_WHATSAPP_GROUP_CODE = '/samplecareerpakcommunity';

export function isSampleWhatsAppPhoneNumber(phone: unknown): boolean {
  if (typeof phone !== 'string') return false;
  const trimmed = phone.trim();
  if (!trimmed) return false;
  if (!/^\+?[\d\s\-()]+$/.test(trimmed)) return false;
  const digits = trimmed.replace(/[\s\-()+]/g, '');
  if (!digits) return false;
  if (KNOWN_SAMPLE_WHATSAPP_PHONES.has(digits)) return true;
  if (/^(\d)\1+$/.test(digits)) return true;
  return false;
}

export function normalizeWhatsAppPhoneNumber(phone: unknown): string | null {
  if (typeof phone !== 'string') return null;
  const trimmed = phone.trim();
  if (!trimmed) return '';
  if (!/^\+?[\d\s\-()]+$/.test(trimmed)) return null;
  const digits = trimmed.replace(/[\s\-()+]/g, '');
  if (!/^[1-9]\d{7,14}$/.test(digits)) return null;
  if (isSampleWhatsAppPhoneNumber(digits)) return null;
  return digits;
}

export function isValidWhatsAppPhoneNumber(phone: unknown): boolean {
  const normalized = normalizeWhatsAppPhoneNumber(phone);
  return typeof normalized === 'string' && normalized.length > 0;
}

export function isSampleWhatsAppGroupLink(link: unknown): boolean {
  if (typeof link !== 'string') return false;
  const trimmed = link.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    const normalizedPath = parsed.pathname.replace(/\/+$/, '').toLowerCase();
    return (
      parsed.hostname.toLowerCase() === 'chat.whatsapp.com' &&
      normalizedPath === KNOWN_SAMPLE_WHATSAPP_GROUP_CODE
    );
  } catch {
    return trimmed.toLowerCase().includes('samplecareerpakcommunity');
  }
}

export function isValidWhatsAppGroupLink(link: unknown): boolean {
  if (typeof link !== 'string') return false;
  const trimmed = link.trim();
  if (!trimmed) return false;
  if (isSampleWhatsAppGroupLink(trimmed)) return false;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:') return false;
    if (parsed.hostname.toLowerCase() !== 'chat.whatsapp.com') return false;
    const inviteCode = parsed.pathname.replace(/^\/+|\/+$/g, '');
    return inviteCode.length > 0;
  } catch {
    return false;
  }
}

export function sanitizeWhatsAppSupportConfig(
  raw?: Partial<WhatsAppSupportConfig> | null
): WhatsAppSupportConfig {
  const merged: WhatsAppSupportConfig = {
    ...DEFAULT_WHATSAPP_SUPPORT_CONFIG,
    ...(raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {})
  };

  const normalizedPhone = normalizeWhatsAppPhoneNumber(merged.phoneNumber);
  const safePhone = typeof normalizedPhone === 'string' && normalizedPhone.length > 0 ? normalizedPhone : '';

  const rawGroupLink = typeof merged.groupLink === 'string' ? merged.groupLink.trim() : '';
  const safeGroupLink = isValidWhatsAppGroupLink(rawGroupLink) ? rawGroupLink : '';

  const effectiveEnabled = merged.enabled === true && safePhone.length > 0;

  return {
    ...merged,
    enabled: effectiveEnabled,
    phoneNumber: safePhone,
    groupLink: safeGroupLink
  };
}

const isTest = () => process.env.IS_TEST === 'true';
const testSettings = new Map<string, any>();

export function resetSystemSettingsTestStore(): void {
  testSettings.clear();
}

export interface CustomFormField {
  id: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'textarea';
  options?: string[];
  required: boolean;
  active: boolean;
}

export const DEFAULT_CUSTOM_FORM_FIELDS: CustomFormField[] = [
  {
    id: 'cf-cnic',
    label: 'CNIC / Passport Number',
    type: 'text',
    required: true,
    active: true
  },
  {
    id: 'cf-exp',
    label: 'Years of Professional Experience',
    type: 'select',
    options: ['Fresh Graduate', '1-3 Years', '3-5 Years', '5+ Years'],
    required: false,
    active: true
  }
];

const CUSTOM_FORM_FIELDS_KEY = 'custom_registration_form_fields';
const VALID_TYPES = new Set(['text', 'number', 'select', 'textarea']);

function isMalformedCustomFieldsArray(arr: any): boolean {
  if (!Array.isArray(arr)) return true;
  for (const item of arr) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return true;
    if (typeof item.id !== 'string' || !item.id.trim()) return true;
    if (typeof item.label !== 'string' || !item.label.trim()) return true;
    if (typeof item.type !== 'string' || !VALID_TYPES.has(item.type.trim())) return true;
    if (typeof item.required !== 'boolean') return true;
    if (typeof item.active !== 'boolean') return true;
    if (item.options !== undefined) {
      if (item.options === null || !Array.isArray(item.options)) return true;
      for (const opt of item.options) {
        if (typeof opt !== 'string') return true;
      }
    }
  }
  return false;
}

export class SystemSettingsRepository {
  static async getSetting<T>(key: string, defaultValue: T): Promise<T> {
    if (isTest() && !isMongoConfigured()) {
      if (testSettings.has(key)) {
        return testSettings.get(key) as T;
      }
      return defaultValue;
    }
    if (!isMongoConfigured()) {
      return defaultValue;
    }
    const db = await getMongoDb();
    const coll = db.collection(COLLECTION_NAME);
    const doc = await withMongoTimeout(
      coll.findOne({ key }),
      8000,
      `fetch system setting: ${key}`
    );
    if (!doc || doc.value === undefined) {
      return defaultValue;
    }
    return doc.value as T;
  }

  static async saveSetting<T>(key: string, value: T): Promise<T> {
    if (isTest() && !isMongoConfigured()) {
      testSettings.set(key, value);
      return value;
    }
    if (!isMongoConfigured()) {
      throw new Error('Database unavailable: Cannot persist system settings when MongoDB is not configured.');
    }
    const db = await getMongoDb();
    const coll = db.collection(COLLECTION_NAME);
    
    await withMongoTimeout(
      coll.updateOne(
        { key },
        { 
          $set: { 
            value,
            updatedAt: new Date().toISOString()
          } 
        },
        { upsert: true }
      ),
      8000,
      `save system setting: ${key}`
    );

    return value;
  }

  static async getWhatsAppSupportConfig(): Promise<WhatsAppSupportConfig> {
    const raw = await this.getSetting<Partial<WhatsAppSupportConfig>>('whats_app_support_config', DEFAULT_WHATSAPP_SUPPORT_CONFIG);
    return sanitizeWhatsAppSupportConfig(raw);
  }

  static async saveWhatsAppSupportConfig(config: Partial<WhatsAppSupportConfig>): Promise<WhatsAppSupportConfig> {
    const current = await this.getWhatsAppSupportConfig();
    const updated = sanitizeWhatsAppSupportConfig({
      ...current,
      ...(config || {})
    });
    return this.saveSetting<WhatsAppSupportConfig>('whats_app_support_config', updated);
  }

  static async getCustomFormFields(): Promise<CustomFormField[]> {
    if (isTest() && !isMongoConfigured()) {
      if (testSettings.has(CUSTOM_FORM_FIELDS_KEY)) {
        const stored = testSettings.get(CUSTOM_FORM_FIELDS_KEY);
        if (isMalformedCustomFieldsArray(stored)) {
          throw new Error('Database contains malformed custom form fields configuration.');
        }
        return stored;
      }
      return DEFAULT_CUSTOM_FORM_FIELDS;
    }
    if (!isMongoConfigured()) {
      return DEFAULT_CUSTOM_FORM_FIELDS;
    }
    const db = await getMongoDb();
    const coll = db.collection(COLLECTION_NAME);
    const doc = await withMongoTimeout(
      coll.findOne({ key: CUSTOM_FORM_FIELDS_KEY }),
      8000,
      `fetch system setting: ${CUSTOM_FORM_FIELDS_KEY}`
    );
    if (!doc || doc.value === undefined) {
      return DEFAULT_CUSTOM_FORM_FIELDS;
    }
    if (isMalformedCustomFieldsArray(doc.value)) {
      throw new Error('Database contains malformed custom form fields configuration: stored document failed validation.');
    }
    return doc.value as CustomFormField[];
  }

  static async saveCustomFormFields(fields: CustomFormField[]): Promise<CustomFormField[]> {
    if (isTest() && !isMongoConfigured()) {
      testSettings.set(CUSTOM_FORM_FIELDS_KEY, fields);
      const verifiedTest = await this.getCustomFormFields();
      return verifiedTest;
    }
    if (!isMongoConfigured()) {
      throw new Error('Database unavailable: Cannot persist custom form fields when MongoDB is not configured.');
    }
    const db = await getMongoDb();
    const coll = db.collection(COLLECTION_NAME);

    await withMongoTimeout(
      coll.updateOne(
        { key: CUSTOM_FORM_FIELDS_KEY },
        {
          $set: {
            value: fields,
            updatedAt: new Date().toISOString()
          }
        },
        { upsert: true }
      ),
      8000,
      `save system setting: ${CUSTOM_FORM_FIELDS_KEY}`
    );

    // Database Readback Verification
    const verified = await this.getCustomFormFields();

    if (verified.length !== fields.length) {
      throw new Error('Database readback verification failed: field count mismatch after update.');
    }

    for (let i = 0; i < fields.length; i++) {
      const req = fields[i];
      const stored = verified[i];
      if (
        stored.id !== req.id ||
        stored.label !== req.label ||
        stored.type !== req.type ||
        stored.required !== req.required ||
        stored.active !== req.active ||
        JSON.stringify(stored.options || []) !== JSON.stringify(req.options || [])
      ) {
        throw new Error(`Database readback verification failed: field '${req.id}' mismatch after update.`);
      }
    }

    return verified;
  }

  static async importCustomFormFieldsIfUnconfigured(fields: CustomFormField[]): Promise<{
    saved: boolean;
    fields: CustomFormField[];
  }> {
    if (isTest() && !isMongoConfigured()) {
      if (!testSettings.has(CUSTOM_FORM_FIELDS_KEY)) {
        testSettings.set(CUSTOM_FORM_FIELDS_KEY, fields);
        return { saved: true, fields };
      }
      return { saved: false, fields: testSettings.get(CUSTOM_FORM_FIELDS_KEY) };
    }
    if (!isMongoConfigured()) {
      throw new Error('Database unavailable: Cannot migrate custom form fields when MongoDB is not configured.');
    }
    const db = await getMongoDb();
    const coll = db.collection(COLLECTION_NAME);

    const res = await withMongoTimeout(
      coll.updateOne(
        { key: CUSTOM_FORM_FIELDS_KEY },
        {
          $setOnInsert: {
            key: CUSTOM_FORM_FIELDS_KEY,
            value: fields,
            updatedAt: new Date().toISOString()
          }
        },
        { upsert: true }
      ),
      8000,
      `import custom form fields if unconfigured`
    );

    const isInserted = Boolean(res && res.upsertedCount && res.upsertedCount > 0);
    const currentFields = await this.getCustomFormFields();
    return {
      saved: isInserted,
      fields: currentFields
    };
  }
}
