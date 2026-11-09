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
  enabled: true,
  phoneNumber: '923001234567',
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
  groupLink: 'https://chat.whatsapp.com/sampleCareerPakCommunity'
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
    return {
      ...DEFAULT_WHATSAPP_SUPPORT_CONFIG,
      ...(raw || {})
    };
  }

  static async saveWhatsAppSupportConfig(config: Partial<WhatsAppSupportConfig>): Promise<WhatsAppSupportConfig> {
    const current = await this.getWhatsAppSupportConfig();
    const updated: WhatsAppSupportConfig = {
      ...current,
      ...(config || {})
    };
    return this.saveSetting<WhatsAppSupportConfig>('whats_app_support_config', updated);
  }
}
