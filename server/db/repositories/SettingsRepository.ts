import { isMongoConfigured, getSettingsCollection } from '../mongodb.js';
import { Database, safeReadJson, safeWriteJson } from '../database.js';

export const DEFAULT_LANDING_CONFIG = {
  hero: {
    badgeText: '🇵🇰 Pakistan\'s #1 Verified Hybrid & Remote Job Engine',
    headlineMain: 'Find Your Next Dream Job',
    headlineHighlight: 'Anywhere in Pakistan & Worldwide',
    subheadline: 'Browse verified remote, hybrid, overseas, and government opportunities. Create ATS-ready CVs, configure instant WhatsApp alerts, and apply seamlessly.',
    primaryButtonText: 'Explore Verified Jobs',
    secondaryButtonText: 'Build Free ATS Resume',
    searchPlaceholder: 'Job title, skill, scale, or keyword...',
    statBadge1Text: 'Active Verified Vacancies',
    statBadge2Text: 'Automated ATS Resume',
    statBadge3Text: 'Punjab, Sindh, KPK & Global',
    statBadge4Text: 'WhatsApp & Email Alerts'
  },
  sections: [
    { id: 'top-sponsor-ads', name: 'Top Sticky Sponsor Banner', description: 'Top site-wide advertisement bar', isEnabled: true, order: 1, mobileVisible: true, desktopVisible: true },
    { id: 'hero', name: 'Hero Section & Search Header', description: 'Main hero search & CTA block', isEnabled: true, order: 2, mobileVisible: true, desktopVisible: true },
    { id: 'promo-banners', name: 'Promotional & Discount Banners', description: 'Flash sales, gift cards, and discount offer banners', isEnabled: true, order: 3, mobileVisible: true, desktopVisible: true },
    { id: 'quick-stats', name: 'Live Statistics Counter', description: 'Dynamic metrics for jobs, categories, and reach', isEnabled: true, order: 4, mobileVisible: true, desktopVisible: true },
    { id: 'custom-announcements', name: 'Custom Promotional Feature Cards', description: 'Highlight ATS Resume Builder, VIP Alerts, and Employer packages', isEnabled: true, order: 5, mobileVisible: true, desktopVisible: true },
    { id: 'jobs-feed', name: 'Main Job Listings Feed & Filters', description: 'The primary job directory with search & filters', isEnabled: true, order: 6, mobileVisible: true, desktopVisible: true }
  ],
  customCards: [
    {
      id: 'card-cv-builder',
      title: 'Free ATS Resume Generator',
      description: 'Build an industry-standard ATS resume in 3 minutes with automatic formatting and instant PDF download.',
      badge: '100% FREE',
      buttonText: 'Create Resume Now',
      buttonUrl: '#cv',
      bgGradient: 'from-emerald-900/90 via-slate-900 to-slate-900',
      isEnabled: true,
      order: 1,
      mobileVisible: true,
      desktopVisible: true,
      mobileSize: 'standard',
      desktopSize: 'standard'
    },
    {
      id: 'card-whatsapp-alerts',
      title: 'WhatsApp Daily Job Alerts',
      description: 'Never miss government or remote vacancies. Get instant alerts straight to your WhatsApp inbox daily.',
      badge: 'POPULAR',
      buttonText: 'Join WhatsApp Stream',
      buttonUrl: '#alerts',
      bgGradient: 'from-emerald-950 via-slate-900 to-teal-950',
      isEnabled: true,
      order: 2,
      mobileVisible: true,
      desktopVisible: true,
      mobileSize: 'standard',
      desktopSize: 'standard'
    }
  ],
  categoryPostingFees: [],
  exemptUserIds: [],
  exemptUserEmails: []
};

export const DEFAULT_CAMPAIGN_CONFIG = {
  promoBanners: [
    {
      id: 'promo-flash-50',
      isEnabled: true,
      title: 'Mega Launch Discount: 50% Off Employer Job Spotlight & VIP Pinned Ads',
      description: 'Boost your vacancy to #1 pinned rank across Pakistan. Reach over 50,000 active remote and hybrid candidates.',
      discountPercent: 50,
      badgeText: '🔥 SPECIAL OFFER',
      promoCode: 'CAREER50',
      targetPlacement: 'all',
      validUntil: '2026-12-31',
      bgGradient: 'from-amber-600 via-rose-600 to-indigo-700',
      ctaText: 'Book Discount Ad',
      ctaUrl: '#dashboard',
      order: 1,
      mobileVisible: true,
      desktopVisible: true,
      mobileSize: 'standard',
      desktopSize: 'standard'
    }
  ],
  jobPostingFee: {
    isFreeAll: true,
    customStandardFeePkr: 0,
    globalDiscountPercent: 100,
    promoBannerText: '🎉 100% Free Job Postings for Employers & Recruiters during our Launch Promotion!'
  }
};

export const DEFAULT_WHATSAPP_CONFIG = {
  enabled: true,
  phoneNumber: '923001234567',
  defaultMessage: 'Hello! I need assistance regarding job applications and career alerts on HybridJobs.pk.',
  agentName: 'Ayesha (Career Advisor)',
  supportHoursText: 'Online • 9:00 AM - 9:00 PM PKT',
  position: 'bottom-right',
  ctaText: 'Start WhatsApp Chat',
  bubblePromptText: 'Need help applying for remote jobs, hiring candidates, or setting WhatsApp alerts? Chat directly with our team!',
  badgeText: 'HR Support',
  unreadCount: 1,
  mobileSize: 'compact',
  desktopSize: 'standard',
  bubbleSize: 'standard',
  iconSize: 'standard',
  showBubblePrompt: true
};

export const DEFAULT_SEO_BRANDING_CONFIG = {
  siteTitle: 'CareerPak & Global Work Portal — Verified Jobs & Overseas Careers',
  websiteName: 'Hybrid Remote Jobs & ATS Portal',
  tagline: 'Leading Job Recruitment Portal for Pakistan, Gulf & International Careers',
  logoUrl: '/logo.png',
  faviconUrl: '/favicon.ico',
  contactEmail: 'support@jobportal.com',
  contactPhone: '+92 300 1234567',
  whatsappHelpline: '+92 300 1234567',
  socialLinks: {
    facebook: 'https://facebook.com/CareerPakOfficial',
    twitter: '@CareerPakOfficial',
    linkedin: 'https://linkedin.com/company/careerpak',
    instagram: 'https://instagram.com/careerpakofficial'
  },
  primaryBrandColor: '#10B981',
  accentColor: '#F59E0B',
  metaTitle: 'CareerPak & Global Work Portal — Verified Jobs & Overseas Careers',
  metaDescription: 'Find verified jobs across Pakistan, Dubai/UAE, Saudi Arabia, UK, and Remote. Explore Federal FPSC, PPSC, WAPDA, Tech & Corporate Vacancies with instant application tools.',
  metaKeywords: ['Jobs in Pakistan', 'Govt Jobs 2026', 'FPSC Consolidated', 'WAPDA Careers', 'Dubai Jobs', 'Remote Software Engineer', 'Daily Jang Classifieds', 'PPSC Gazette'],
  canonicalUrl: 'https://careerpak.com',
  ogTitle: 'CareerPak & Global Work Portal — Verified Jobs & Overseas Careers',
  ogDescription: 'Find verified jobs across Pakistan, Dubai/UAE, Saudi Arabia, UK, and Remote. Explore Federal FPSC, PPSC, WAPDA, Tech & Corporate Vacancies.',
  ogImageUrl: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200&auto=format&fit=crop&q=80',
  twitterHandle: '@CareerPakOfficial',
  googleSearchConsoleVerification: 'google-site-verification=cpak_verify_998432_prod',
  bingWebmasterVerification: 'bing-verification=BING_AUTH_TOKEN_CP_2026',
  googleAnalyticsId: 'G-CP98234871',
  googleTagManagerId: 'GTM-CP8812K',
  facebookPixelId: 'FB_PIXEL_99214710',
  robotsTxtContent: `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\nSitemap: https://careerpak.com/sitemap.xml`,
  maintenanceMode: false,
  maintenanceNotice: 'Scheduled platform optimization is underway. We will be back online in 15 minutes.',
  announcementBanner: {
    enabled: true,
    text: '🚀 FPSC Consolidated Advertisement No. 08/2026 & WAPDA 2026 Recruitment are now LIVE with direct gazette breakdown!',
    linkUrl: '#jobs',
    linkText: 'View Govt Openings',
    bannerType: 'info'
  }
};

export const DEFAULT_COMMUNICATION_CONFIG = {
  smtpHost: process.env.SMTP_HOST || 'smtp.gmail.com',
  smtpPort: Number(process.env.SMTP_PORT) || 587,
  smtpUser: process.env.SMTP_USER || 'notifications@jobportal.com',
  smtpSenderEmail: process.env.SMTP_SENDER_EMAIL || 'no-reply@jobportal.com',
  smtpPassword: process.env.SMTP_PASSWORD || '',
  sendgridApiKey: process.env.SENDGRID_API_KEY || '',
  resendApiKey: process.env.RESEND_API_KEY || '',
  whatsappCloudApiToken: process.env.WHATSAPP_CLOUD_API_TOKEN || '',
  whatsappPhoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID || '',
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN || '',
  twilioPhoneNumber: process.env.TWILIO_PHONE_NUMBER || ''
};

export class SettingsRepository {
  // --- LANDING PAGE CONFIG ---
  static async getLandingConfig(): Promise<any> {
    if (isMongoConfigured()) {
      try {
        const coll = await getSettingsCollection();
        const doc = await coll.findOne({ key: 'landing_page_config' });
        if (doc && doc.value) {
          return { ...DEFAULT_LANDING_CONFIG, ...doc.value };
        }
      } catch (err: any) {
        console.error('[SettingsRepo] Error reading landing config from MongoDB:', err.message);
      }
    }
    return safeReadJson('landing_config.json', DEFAULT_LANDING_CONFIG);
  }

  static async saveLandingConfig(config: any): Promise<any> {
    const merged = { ...DEFAULT_LANDING_CONFIG, ...config, updatedAt: new Date().toISOString() };
    
    // Save to disk JSON fallback
    safeWriteJson('landing_config.json', merged);

    if (isMongoConfigured()) {
      try {
        const coll = await getSettingsCollection();
        await coll.updateOne(
          { key: 'landing_page_config' },
          { $set: { key: 'landing_page_config', value: merged, updatedAt: new Date() } },
          { upsert: true }
        );
      } catch (err: any) {
        console.error('[SettingsRepo] Error saving landing config to MongoDB:', err.message);
      }
    }
    return merged;
  }

  // --- CAMPAIGN & PROMOTIONAL CONFIG ---
  static async getCampaignConfig(): Promise<any> {
    if (isMongoConfigured()) {
      try {
        const coll = await getSettingsCollection();
        const doc = await coll.findOne({ key: 'campaign_config' });
        if (doc && doc.value) {
          return { ...DEFAULT_CAMPAIGN_CONFIG, ...doc.value };
        }
      } catch (err: any) {
        console.error('[SettingsRepo] Error reading campaign config from MongoDB:', err.message);
      }
    }
    return safeReadJson('campaign_config.json', DEFAULT_CAMPAIGN_CONFIG);
  }

  static async saveCampaignConfig(config: any): Promise<any> {
    const merged = { ...DEFAULT_CAMPAIGN_CONFIG, ...config, updatedAt: new Date().toISOString() };
    
    // Save to disk JSON fallback
    safeWriteJson('campaign_config.json', merged);

    if (isMongoConfigured()) {
      try {
        const coll = await getSettingsCollection();
        await coll.updateOne(
          { key: 'campaign_config' },
          { $set: { key: 'campaign_config', value: merged, updatedAt: new Date() } },
          { upsert: true }
        );
      } catch (err: any) {
        console.error('[SettingsRepo] Error saving campaign config to MongoDB:', err.message);
      }
    }
    return merged;
  }

  // --- WHATSAPP SUPPORT CONFIG ---
  static async getWhatsAppConfig(): Promise<any> {
    if (isMongoConfigured()) {
      try {
        const coll = await getSettingsCollection();
        const doc = await coll.findOne({ key: 'whatsapp_config' });
        if (doc && doc.value) {
          return { ...DEFAULT_WHATSAPP_CONFIG, ...doc.value };
        }
      } catch (err: any) {
        console.error('[SettingsRepo] Error reading WhatsApp config from MongoDB:', err.message);
      }
    }
    return safeReadJson('whatsapp_config.json', DEFAULT_WHATSAPP_CONFIG);
  }

  static async saveWhatsAppConfig(config: any): Promise<any> {
    const merged = { ...DEFAULT_WHATSAPP_CONFIG, ...config, updatedAt: new Date().toISOString() };
    
    // Save to disk JSON fallback
    safeWriteJson('whatsapp_config.json', merged);

    if (isMongoConfigured()) {
      try {
        const coll = await getSettingsCollection();
        await coll.updateOne(
          { key: 'whatsapp_config' },
          { $set: { key: 'whatsapp_config', value: merged, updatedAt: new Date() } },
          { upsert: true }
        );
      } catch (err: any) {
        console.error('[SettingsRepo] Error saving WhatsApp config to MongoDB:', err.message);
      }
    }
    return merged;
  }

  // --- SEO & BRANDING CONFIG ---
  static async getSeoConfig(): Promise<any> {
    if (isMongoConfigured()) {
      try {
        const coll = await getSettingsCollection();
        const doc = await coll.findOne({ key: 'seo_branding_config' });
        if (doc && doc.value) {
          return { ...DEFAULT_SEO_BRANDING_CONFIG, ...doc.value };
        }
      } catch (err: any) {
        console.error('[SettingsRepo] Error reading SEO config from MongoDB:', err.message);
      }
    }
    return safeReadJson('seo_branding_config.json', DEFAULT_SEO_BRANDING_CONFIG);
  }

  static async saveSeoConfig(config: any): Promise<any> {
    const merged = { ...DEFAULT_SEO_BRANDING_CONFIG, ...config, updatedAt: new Date().toISOString() };
    
    safeWriteJson('seo_branding_config.json', merged);

    if (isMongoConfigured()) {
      try {
        const coll = await getSettingsCollection();
        await coll.updateOne(
          { key: 'seo_branding_config' },
          { $set: { key: 'seo_branding_config', value: merged, updatedAt: new Date() } },
          { upsert: true }
        );
      } catch (err: any) {
        console.error('[SettingsRepo] Error saving SEO config to MongoDB:', err.message);
      }
    }
    return merged;
  }

  // --- COMMUNICATION PROVIDER SECRETS CONFIG ---
  static async getCommConfig(): Promise<any> {
    if (isMongoConfigured()) {
      try {
        const coll = await getSettingsCollection();
        const doc = await coll.findOne({ key: 'communication_config' });
        if (doc && doc.value) {
          return { ...DEFAULT_COMMUNICATION_CONFIG, ...doc.value };
        }
      } catch (err: any) {
        console.error('[SettingsRepo] Error reading Comm config from MongoDB:', err.message);
      }
    }
    return safeReadJson('communication_config.json', DEFAULT_COMMUNICATION_CONFIG);
  }

  static async saveCommConfig(config: any): Promise<any> {
    const existing = await this.getCommConfig();
    const mask = '••••••••';

    // Preserve existing secrets if caller sent masked placeholders
    const safeConfig = { ...config };
    if (safeConfig.smtpPassword === mask || !safeConfig.smtpPassword) safeConfig.smtpPassword = existing.smtpPassword;
    if (safeConfig.sendgridApiKey === mask || !safeConfig.sendgridApiKey) safeConfig.sendgridApiKey = existing.sendgridApiKey;
    if (safeConfig.resendApiKey === mask || !safeConfig.resendApiKey) safeConfig.resendApiKey = existing.resendApiKey;
    if (safeConfig.whatsappCloudApiToken === mask || !safeConfig.whatsappCloudApiToken) safeConfig.whatsappCloudApiToken = existing.whatsappCloudApiToken;
    if (safeConfig.twilioAuthToken === mask || !safeConfig.twilioAuthToken) safeConfig.twilioAuthToken = existing.twilioAuthToken;

    const merged = { ...DEFAULT_COMMUNICATION_CONFIG, ...safeConfig, updatedAt: new Date().toISOString() };
    
    safeWriteJson('communication_config.json', merged);

    if (isMongoConfigured()) {
      try {
        const coll = await getSettingsCollection();
        await coll.updateOne(
          { key: 'communication_config' },
          { $set: { key: 'communication_config', value: merged, updatedAt: new Date() } },
          { upsert: true }
        );
      } catch (err: any) {
        console.error('[SettingsRepo] Error saving Comm config to MongoDB:', err.message);
      }
    }
    return merged;
  }
}
