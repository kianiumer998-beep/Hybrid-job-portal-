import { getMongoDb, isMongoConfigured, withMongoTimeout } from '../mongodb';

const COLLECTION_NAME = 'system_settings';

export interface WhatsAppSupportConfig {
  phoneNumber: string;
  welcomeMessage: string;
  enabled: boolean;
  position: 'right' | 'left';
  themeColor: string;
}

export const DEFAULT_WHATSAPP_SUPPORT_CONFIG: WhatsAppSupportConfig = {
  phoneNumber: '',
  welcomeMessage: 'Hi! I need help with...',
  enabled: true,
  position: 'right',
  themeColor: '#25D366'
};

export class SystemSettingsRepository {
  static async getSetting<T>(key: string, defaultValue: T): Promise<T> {
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
    if (!isMongoConfigured()) {
      return value;
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
    return this.getSetting<WhatsAppSupportConfig>('whats_app_support_config', DEFAULT_WHATSAPP_SUPPORT_CONFIG);
  }

  static async saveWhatsAppSupportConfig(config: Partial<WhatsAppSupportConfig>): Promise<WhatsAppSupportConfig> {
    const current = await this.getWhatsAppSupportConfig();
    const updated = { ...current, ...config };
    return this.saveSetting<WhatsAppSupportConfig>('whats_app_support_config', updated);
  }

  static async getCommConfig(): Promise<any> {
    return this.getSetting<any>('comm_config', {
      smtpHost: 'smtp.sendgrid.net',
      smtpPort: 587,
      smtpUser: 'apikey',
      smtpSenderEmail: 'jobs@careerpak.pk'
    });
  }

  static async saveCommConfig(config: any): Promise<any> {
    const current = await this.getCommConfig();
    const updated = { ...current, ...config };
    return this.saveSetting<any>('comm_config', updated);
  }
}
