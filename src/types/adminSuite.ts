import {
  Currency,
  Job,
  JobPostingFeeLog,
  JobPostingPricingConfig,
  PaymentTransaction,
  Region,
  ScrapedJobAuditEntry,
  ScraperBatchRun,
  Subscriber,
  UserAccount,
  CustomFormField,
  AdminFeatureFlags
} from './job';
import { AdPricingConfig } from './ad';
import { LandingPageConfig } from './landing';
import type { WhatsAppSupportConfig } from '../components/WhatsAppStickyButton';

export const BACKUP_SNAPSHOT_SCHEMA_VERSION = '3.0.0-ADMIN-EXPORT';

export interface SiteSeoConfig {
  siteTitle: string;
  tagline: string;
  metaDescription: string;
  metaKeywords: string[];
  canonicalUrl: string;
  ogImageUrl: string;
  twitterHandle: string;
  googleSearchConsoleVerification: string;
  bingWebmasterVerification: string;
  googleAnalyticsId: string;
  googleTagManagerId: string;
  facebookPixelId: string;
  robotsTxtContent: string;
  maintenanceMode: boolean;
  maintenanceNotice: string;
  announcementBanner: {
    enabled: boolean;
    text: string;
    linkUrl?: string;
    linkText?: string;
    bannerType: 'info' | 'warning' | 'success' | 'urgent';
  };
}

export interface CurrencyExchangeConfig {
  baseCurrency: Currency;
  rates: Record<Currency, number>;
  lastSyncedAt: string;
  autoSyncEnabled: boolean;
  supportedCurrencies: Currency[];
  internationalPricingTiers: {
    featuredJobFee: Record<Currency, number>;
    urgentBadgeFee: Record<Currency, number>;
    verifiedCompanyBadgeFee: Record<Currency, number>;
    unlimitedMonthlySlotFee: Record<Currency, number>;
    candidateDatabaseAccessFee: Record<Currency, number>;
  };
}

export interface BroadcastCampaign {
  id: string;
  title: string;
  channel: 'Email' | 'WhatsApp' | 'SMS' | 'Push Notification' | 'Multi-Channel';
  targetAudience: 'All Users' | 'Job Seekers Only' | 'Employers / Posters' | 'Subscribed Members' | 'Unpaid / Expired Users' | 'Government Job Seekers' | 'Overseas / Gulf Candidates';
  categoryFilter?: string;
  linkedAdId?: string;
  subject: string;
  messageBody: string;
  sentAt?: string;
  status: 'Draft' | 'Scheduled' | 'Sent' | 'Failed';
  recipientsCount: number;
  openRate?: number;
  clickRate?: number;
}

export type EmailProviderType = 'smtp' | 'sendgrid' | 'resend';
export type WhatsAppProviderType = 'meta-cloud' | 'twilio';
export type SmsProviderType = 'disabled' | 'twilio';

export interface CommunicationProviderConfig {
  emailProvider?: EmailProviderType;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpSenderEmail: string;
  whatsappProvider?: WhatsAppProviderType;
  smsProvider?: SmsProviderType;
  smsFromNumber?: string;
  sendgridApiKey?: string;
  resendApiKey?: string;
  whatsappCloudApiToken?: string;
  whatsappPhoneNumberId?: string;
  whatsappBusinessAccountId?: string;
  twilioAccountSid?: string;
  twilioAuthToken?: string;
  twilioPhoneNumber?: string;
}

export interface SafeCommunicationProviderConfig {
  emailProvider: EmailProviderType;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpSenderEmail: string;
  whatsappProvider: WhatsAppProviderType;
  smsProvider: SmsProviderType;
  smsFromNumber: string;
  whatsappPhoneNumberId: string;
  whatsappBusinessAccountId: string;
  twilioAccountSid: string;
  twilioPhoneNumber: string;

  smtpPasswordConfigured: boolean;
  sendgridApiKeyConfigured: boolean;
  resendApiKeyConfigured: boolean;
  whatsappCloudApiTokenConfigured: boolean;
  twilioAuthTokenConfigured: boolean;
}

export interface UpdateCommunicationProviderPayload {
  emailProvider?: EmailProviderType;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpSenderEmail?: string;
  whatsappProvider?: WhatsAppProviderType;
  smsProvider?: SmsProviderType;
  smsFromNumber?: string;
  whatsappPhoneNumberId?: string;
  whatsappBusinessAccountId?: string;
  twilioAccountSid?: string;
  twilioPhoneNumber?: string;

  smtpPassword?: string;
  sendgridApiKey?: string;
  resendApiKey?: string;
  whatsappCloudApiToken?: string;
  twilioAuthToken?: string;

  clearSecrets?: Array<
    | 'smtpPassword'
    | 'sendgridApiKey'
    | 'resendApiKey'
    | 'whatsappCloudApiToken'
    | 'twilioAuthToken'
  >;
}

export interface SecurityConfig {
  blacklistedIps: string[];
  blacklistedEmailDomains: string[];
  rateLimitRequestsPerMin: number;
  enableCaptchaOnJobPost: boolean;
  enableCaptchaOnRegistration: boolean;
  captchaProvider: 'Cloudflare Turnstile' | 'Google reCAPTCHA v3' | 'hCaptcha';
  captchaSiteKey: string;
  requireEmailVerificationForPosting: boolean;
  blockDisposableEmails: boolean;
  adminSessionAuditLogs: Array<{
    id: string;
    timestamp: string;
    ipAddress: string;
    adminEmail: string;
    action: string;
    details: string;
    status: 'Success' | 'Warning' | 'Blocked';
  }>;
}

export interface EmployerKycRequest {
  id: string;
  userId: string;
  companyName: string;
  contactPerson: string;
  email: string;
  phone: string;
  ntnOrTaxNumber: string;
  secpRegistrationNumber?: string;
  companyWebsite: string;
  officialDocUrl?: string;
  submittedAt: string;
  status: 'Pending' | 'Verified' | 'Rejected';
  rejectionReason?: string;
  verifiedAt?: string;
  verifiedBy?: string;
  badgeLevel: 'Standard Verified' | 'Top Employer' | 'Government Agency';
}

export interface AiJobAuditReport {
  jobId: string;
  overallScore: number; // 0-100
  titleClarity: number;
  salaryTransparency: number;
  descriptionDepth: number;
  seoKeywordDensity: number;
  suggestedSalaryRange?: string;
  suggestedTags?: string[];
  spamConfidenceScore: number; // 0-100 (lower is safer)
  grammarIssuesDetected: number;
  enhancedDescriptionPreview?: string;
}

export interface SnapshotManifestCategoryInfo {
  key: string;
  label: string;
  description: string;
  recordCount: number;
}

export interface SnapshotManifestExcludedCategory {
  key: string;
  label: string;
  reason: string;
}

export interface SnapshotManifest {
  schemaVersion: string;
  createdAt: string;
  exportScope: string;
  isCompleteDatabaseBackup: false;
  sanitizationApplied: {
    usersCredentialsStripped: boolean;
    strippedUserFields: string[];
    secretsExcluded: boolean;
  };
  includedCategories: SnapshotManifestCategoryInfo[];
  excludedCategories: SnapshotManifestExcludedCategory[];
  recordCounts: Record<string, number>;
}

export interface SnapshotAdminConfig {
  jobPostingPricing?: JobPostingPricingConfig;
  adPricingConfig?: AdPricingConfig;
  landingConfig?: LandingPageConfig;
  seoConfig?: SiteSeoConfig;
  whatsAppSupportConfig?: WhatsAppSupportConfig;
}

export interface SystemSnapshotPayload {
  snapshotVersion: string;
  createdAt: string;
  platformName: string;
  manifest: SnapshotManifest;
  totalJobs: number;
  totalPendingJobs: number;
  totalUsers: number;
  totalPaymentTransactions: number;
  totalFeeLogs: number;
  jobs: Job[];
  pendingJobs: Job[];
  users: Array<Omit<UserAccount, 'password'> & Record<string, any>>;
  subscribers: Subscriber[];
  feeLogs: JobPostingFeeLog[];
  paymentTransactions: PaymentTransaction[];
  ads: any[];
  scraperAuditLogs: ScrapedJobAuditEntry[];
  scraperBatchRuns: ScraperBatchRun[];
  customFormFields: CustomFormField[];
  featureFlags: AdminFeatureFlags;
  adminConfig: SnapshotAdminConfig;
}
