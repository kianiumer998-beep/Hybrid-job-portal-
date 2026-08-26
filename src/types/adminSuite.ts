import { Currency, Job, JobPostingFeeLog, Region, ScrapedJobAuditEntry, ScraperBatchRun, Subscriber, UserAccount, CustomFormField, AdminFeatureFlags } from './job';

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
  subject: string;
  messageBody: string;
  sentAt?: string;
  status: 'Draft' | 'Scheduled' | 'Sent' | 'Failed';
  recipientsCount: number;
  openRate?: number;
  clickRate?: number;
}

export interface CommunicationProviderConfig {
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpSenderEmail: string;
  sendgridApiKey?: string;
  resendApiKey?: string;
  whatsappCloudApiToken?: string;
  whatsappPhoneNumberId?: string;
  twilioAccountSid?: string;
  twilioAuthToken?: string;
  twilioPhoneNumber?: string;
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

export interface SystemSnapshotPayload {
  snapshotVersion: string;
  createdAt: string;
  platformName: string;
  totalJobs: number;
  totalUsers: number;
  jobs: Job[];
  pendingJobs: Job[];
  users: UserAccount[];
  subscribers: Subscriber[];
  feeLogs: JobPostingFeeLog[];
  ads: any[];
  auditLogs: ScrapedJobAuditEntry[];
  batchRuns: ScraperBatchRun[];
  customFormFields: CustomFormField[];
  featureFlags: AdminFeatureFlags;
}
