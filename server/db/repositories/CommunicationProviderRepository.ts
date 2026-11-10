import { Collection } from 'mongodb';
import { getMongoDb, isMongoConfigured, withMongoTimeout } from '../mongodb';
import * as crypto from 'crypto';

const COLLECTION_NAME = 'system_settings';
const DOC_KEY = 'communication_provider_config';

export type EmailProviderType = 'smtp' | 'sendgrid' | 'resend';
export type WhatsAppProviderType = 'meta-cloud' | 'twilio';

export interface EncryptedSecretEnvelope {
  version: 1;
  iv: string;       // Hex encoded 12-byte IV
  authTag: string;  // Hex encoded 16-byte Auth Tag
  ciphertext: string; // Hex encoded ciphertext
}

export interface SafeCommunicationProviderConfig {
  emailProvider: EmailProviderType;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpSenderEmail: string;
  whatsappProvider: WhatsAppProviderType;
  whatsappPhoneNumberId: string;
  whatsappBusinessAccountId: string;
  twilioAccountSid: string;
  twilioPhoneNumber: string;

  // Secret status booleans (never actual secret values)
  smtpPasswordConfigured: boolean;
  sendgridApiKeyConfigured: boolean;
  resendApiKeyConfigured: boolean;
  whatsappCloudApiTokenConfigured: boolean;
  twilioAuthTokenConfigured: boolean;
}

export interface StoredCommunicationProviderDocument {
  key: typeof DOC_KEY;
  emailProvider: EmailProviderType;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpSenderEmail: string;
  whatsappProvider: WhatsAppProviderType;
  whatsappPhoneNumberId: string;
  whatsappBusinessAccountId: string;
  twilioAccountSid: string;
  twilioPhoneNumber: string;

  // Encrypted envelopes stored securely
  smtpPasswordEnvelope?: EncryptedSecretEnvelope | null;
  sendgridApiKeyEnvelope?: EncryptedSecretEnvelope | null;
  resendApiKeyEnvelope?: EncryptedSecretEnvelope | null;
  whatsappCloudApiTokenEnvelope?: EncryptedSecretEnvelope | null;
  twilioAuthTokenEnvelope?: EncryptedSecretEnvelope | null;

  updatedAt: string;
}

export const DEFAULT_COMMUNICATION_PROVIDER_CONFIG: SafeCommunicationProviderConfig = {
  emailProvider: 'smtp',
  smtpHost: '',
  smtpPort: 587,
  smtpUser: '',
  smtpSenderEmail: '',
  whatsappProvider: 'meta-cloud',
  whatsappPhoneNumberId: '',
  whatsappBusinessAccountId: '',
  twilioAccountSid: '',
  twilioPhoneNumber: '',
  smtpPasswordConfigured: false,
  sendgridApiKeyConfigured: false,
  resendApiKeyConfigured: false,
  whatsappCloudApiTokenConfigured: false,
  twilioAuthTokenConfigured: false
};

const SECRET_FIELDS = [
  'smtpPassword',
  'sendgridApiKey',
  'resendApiKey',
  'whatsappCloudApiToken',
  'twilioAuthToken'
] as const;

export type CommunicationSecretKey = (typeof SECRET_FIELDS)[number];

export function getSecretsEncryptionKey(): Buffer {
  const rawKey = (process.env.COMMUNICATION_SECRETS_ENCRYPTION_KEY || '').trim();
  if (!rawKey) {
    throw new Error('Encryption Key Missing: COMMUNICATION_SECRETS_ENCRYPTION_KEY environment variable is not configured.');
  }

  let keyBuf: Buffer;
  if (/^[0-9a-fA-F]{64}$/.test(rawKey)) {
    keyBuf = Buffer.from(rawKey, 'hex');
  } else {
    keyBuf = Buffer.from(rawKey, 'base64');
  }

  if (keyBuf.length !== 32) {
    throw new Error('Invalid Encryption Key: COMMUNICATION_SECRETS_ENCRYPTION_KEY must provide exactly 32 bytes (64 hex characters or 32-byte base64 string).');
  }

  return keyBuf;
}

export function encryptSecret(plaintext: string): EncryptedSecretEnvelope {
  if (!plaintext || typeof plaintext !== 'string') {
    throw new Error('Invalid Secret Input: Plaintext must be a non-empty string.');
  }

  const keyBuf = getSecretsEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', keyBuf, iv);

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final()
  ]);

  const authTag = cipher.getAuthTag();

  return {
    version: 1,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    ciphertext: ciphertext.toString('hex')
  };
}

export function decryptSecret(envelope: EncryptedSecretEnvelope): string {
  if (!envelope || envelope.version !== 1 || !envelope.iv || !envelope.authTag || !envelope.ciphertext) {
    throw new Error('Invalid Envelope: Corrupted or unsupported secret envelope.');
  }

  const keyBuf = getSecretsEncryptionKey();
  const iv = Buffer.from(envelope.iv, 'hex');
  const authTag = Buffer.from(envelope.authTag, 'hex');
  const ciphertext = Buffer.from(envelope.ciphertext, 'hex');

  if (iv.length !== 12 || authTag.length !== 16) {
    throw new Error('Invalid Envelope Data: Incorrect IV or Auth Tag length.');
  }

  const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuf, iv);
  decipher.setAuthTag(authTag);

  try {
    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final()
    ]).toString('utf8');
    return plaintext;
  } catch (err: any) {
    throw new Error('Decryption Failed: Authentication tag verification failed or key is incorrect.');
  }
}

export class CommunicationProviderRepository {
  private static async getRawDoc(coll?: Collection<any>): Promise<StoredCommunicationProviderDocument | null> {
    if (!coll && !isMongoConfigured()) {
      throw new Error('Database unavailable: Cannot fetch provider settings when MongoDB is not configured.');
    }
    const dbColl = coll || (await getMongoDb()).collection(COLLECTION_NAME);
    const doc = await withMongoTimeout(
      dbColl.findOne({ key: DOC_KEY }),
      8000,
      'fetch provider settings'
    );
    return (doc as unknown as StoredCommunicationProviderDocument) || null;
  }

  static async getConfig(coll?: Collection<any>): Promise<SafeCommunicationProviderConfig> {
    const raw = await this.getRawDoc(coll);
    if (!raw) {
      return { ...DEFAULT_COMMUNICATION_PROVIDER_CONFIG };
    }

    return {
      emailProvider: ['smtp', 'sendgrid', 'resend'].includes(raw.emailProvider) ? raw.emailProvider : 'smtp',
      smtpHost: typeof raw.smtpHost === 'string' ? raw.smtpHost : '',
      smtpPort: typeof raw.smtpPort === 'number' && Number.isInteger(raw.smtpPort) ? raw.smtpPort : 587,
      smtpUser: typeof raw.smtpUser === 'string' ? raw.smtpUser : '',
      smtpSenderEmail: typeof raw.smtpSenderEmail === 'string' ? raw.smtpSenderEmail : '',
      whatsappProvider: ['meta-cloud', 'twilio'].includes(raw.whatsappProvider) ? raw.whatsappProvider : 'meta-cloud',
      whatsappPhoneNumberId: typeof raw.whatsappPhoneNumberId === 'string' ? raw.whatsappPhoneNumberId : '',
      whatsappBusinessAccountId: typeof raw.whatsappBusinessAccountId === 'string' ? raw.whatsappBusinessAccountId : '',
      twilioAccountSid: typeof raw.twilioAccountSid === 'string' ? raw.twilioAccountSid : '',
      twilioPhoneNumber: typeof raw.twilioPhoneNumber === 'string' ? raw.twilioPhoneNumber : '',

      smtpPasswordConfigured: Boolean(raw.smtpPasswordEnvelope?.ciphertext),
      sendgridApiKeyConfigured: Boolean(raw.sendgridApiKeyEnvelope?.ciphertext),
      resendApiKeyConfigured: Boolean(raw.resendApiKeyEnvelope?.ciphertext),
      whatsappCloudApiTokenConfigured: Boolean(raw.whatsappCloudApiTokenEnvelope?.ciphertext),
      twilioAuthTokenConfigured: Boolean(raw.twilioAuthTokenEnvelope?.ciphertext)
    };
  }

  static async saveConfig(
    updates: Record<string, any>,
    clearSecrets: string[] = [],
    coll?: Collection<any>
  ): Promise<SafeCommunicationProviderConfig> {
    if (!coll && !isMongoConfigured()) {
      throw new Error('Database unavailable: Cannot persist provider settings when MongoDB is not configured.');
    }

    // Check for unknown secret fields in input
    const knownKeys = new Set([
      'emailProvider',
      'smtpHost',
      'smtpPort',
      'smtpUser',
      'smtpSenderEmail',
      'whatsappProvider',
      'whatsappPhoneNumberId',
      'whatsappBusinessAccountId',
      'twilioAccountSid',
      'twilioPhoneNumber',
      'smtpPassword',
      'sendgridApiKey',
      'resendApiKey',
      'whatsappCloudApiToken',
      'twilioAuthToken',
      'clearSecrets'
    ]);

    for (const k of Object.keys(updates)) {
      if (!knownKeys.has(k)) {
        throw new Error(`Validation Error: Unknown configuration field '${k}' is rejected.`);
      }
    }

    const currentRaw = await this.getRawDoc(coll);

    const newDoc: StoredCommunicationProviderDocument = {
      key: DOC_KEY,
      emailProvider: ['smtp', 'sendgrid', 'resend'].includes(updates.emailProvider)
        ? updates.emailProvider
        : (currentRaw?.emailProvider || 'smtp'),
      smtpHost: typeof updates.smtpHost === 'string'
        ? updates.smtpHost.trim()
        : (currentRaw?.smtpHost || ''),
      smtpPort: typeof updates.smtpPort === 'number' && Number.isInteger(updates.smtpPort) && updates.smtpPort >= 1 && updates.smtpPort <= 65535
        ? updates.smtpPort
        : (currentRaw?.smtpPort || 587),
      smtpUser: typeof updates.smtpUser === 'string'
        ? updates.smtpUser.trim()
        : (currentRaw?.smtpUser || ''),
      smtpSenderEmail: typeof updates.smtpSenderEmail === 'string'
        ? updates.smtpSenderEmail.trim()
        : (currentRaw?.smtpSenderEmail || ''),
      whatsappProvider: ['meta-cloud', 'twilio'].includes(updates.whatsappProvider)
        ? updates.whatsappProvider
        : (currentRaw?.whatsappProvider || 'meta-cloud'),
      whatsappPhoneNumberId: typeof updates.whatsappPhoneNumberId === 'string'
        ? updates.whatsappPhoneNumberId.trim()
        : (currentRaw?.whatsappPhoneNumberId || ''),
      whatsappBusinessAccountId: typeof updates.whatsappBusinessAccountId === 'string'
        ? updates.whatsappBusinessAccountId.trim()
        : (currentRaw?.whatsappBusinessAccountId || ''),
      twilioAccountSid: typeof updates.twilioAccountSid === 'string'
        ? updates.twilioAccountSid.trim()
        : (currentRaw?.twilioAccountSid || ''),
      twilioPhoneNumber: typeof updates.twilioPhoneNumber === 'string'
        ? updates.twilioPhoneNumber.trim()
        : (currentRaw?.twilioPhoneNumber || ''),

      smtpPasswordEnvelope: currentRaw?.smtpPasswordEnvelope || null,
      sendgridApiKeyEnvelope: currentRaw?.sendgridApiKeyEnvelope || null,
      resendApiKeyEnvelope: currentRaw?.resendApiKeyEnvelope || null,
      whatsappCloudApiTokenEnvelope: currentRaw?.whatsappCloudApiTokenEnvelope || null,
      twilioAuthTokenEnvelope: currentRaw?.twilioAuthTokenEnvelope || null,

      updatedAt: new Date().toISOString()
    };

    // Apply explicit clearSecrets list
    if (Array.isArray(clearSecrets)) {
      for (const secretName of clearSecrets) {
        if (!SECRET_FIELDS.includes(secretName as any)) {
          throw new Error(`Validation Error: Unknown secret field '${secretName}' specified in clearSecrets.`);
        }
        if (secretName === 'smtpPassword') newDoc.smtpPasswordEnvelope = null;
        if (secretName === 'sendgridApiKey') newDoc.sendgridApiKeyEnvelope = null;
        if (secretName === 'resendApiKey') newDoc.resendApiKeyEnvelope = null;
        if (secretName === 'whatsappCloudApiToken') newDoc.whatsappCloudApiTokenEnvelope = null;
        if (secretName === 'twilioAuthToken') newDoc.twilioAuthTokenEnvelope = null;
      }
    }

    // Process new non-empty secret updates
    const secretMap: Record<CommunicationSecretKey, keyof StoredCommunicationProviderDocument> = {
      smtpPassword: 'smtpPasswordEnvelope',
      sendgridApiKey: 'sendgridApiKeyEnvelope',
      resendApiKey: 'resendApiKeyEnvelope',
      whatsappCloudApiToken: 'whatsappCloudApiTokenEnvelope',
      twilioAuthToken: 'twilioAuthTokenEnvelope'
    };

    for (const secretKey of SECRET_FIELDS) {
      const envelopeField = secretMap[secretKey];
      const val = updates[secretKey];
      if (typeof val === 'string' && val.trim().length > 0) {
        // New non-empty secret input: encrypt and replace
        const envelope = encryptSecret(val.trim());
        (newDoc as any)[envelopeField] = envelope;
      }
      // Omitted or empty string = preserve existing envelope (already defaulted from currentRaw)
    }

    const dbColl = coll || (await getMongoDb()).collection(COLLECTION_NAME);

    await withMongoTimeout(
      dbColl.updateOne(
        { key: DOC_KEY },
        { $set: newDoc },
        { upsert: true }
      ),
      8000,
      'save provider settings'
    );

    return this.getConfig(coll);
  }

  static async getDecryptedSecret(secretKey: CommunicationSecretKey, coll?: Collection<any>): Promise<string | null> {
    const raw = await this.getRawDoc(coll);
    if (!raw) return null;

    let envelope: EncryptedSecretEnvelope | null | undefined = null;
    if (secretKey === 'smtpPassword') envelope = raw.smtpPasswordEnvelope;
    if (secretKey === 'sendgridApiKey') envelope = raw.sendgridApiKeyEnvelope;
    if (secretKey === 'resendApiKey') envelope = raw.resendApiKeyEnvelope;
    if (secretKey === 'whatsappCloudApiToken') envelope = raw.whatsappCloudApiTokenEnvelope;
    if (secretKey === 'twilioAuthToken') envelope = raw.twilioAuthTokenEnvelope;

    if (!envelope) return null;
    return decryptSecret(envelope);
  }
}
