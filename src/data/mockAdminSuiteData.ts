import {
  SiteSeoConfig,
  CurrencyExchangeConfig,
  BroadcastCampaign,
  CommunicationProviderConfig,
  SecurityConfig,
  EmployerKycRequest,
  AiJobAuditReport
} from '../types/adminSuite';

export const INITIAL_SITE_SEO_CONFIG: SiteSeoConfig = {
  siteTitle: 'CareerPak & Global Work Portal — Verified Jobs & Overseas Careers',
  tagline: 'Leading Job Recruitment Portal for Pakistan, Gulf & International Careers',
  metaDescription: 'Find verified jobs across Pakistan, Dubai/UAE, Saudi Arabia, UK, and Remote. Explore Federal FPSC, PPSC, WAPDA, Tech & Corporate Vacancies with instant application tools.',
  metaKeywords: ['Jobs in Pakistan', 'Govt Jobs 2026', 'FPSC Consolidated', 'WAPDA Careers', 'Dubai Jobs', 'Remote Software Engineer', 'Daily Jang Classifieds', 'PPSC Gazette'],
  canonicalUrl: 'https://careerpak.com',
  ogImageUrl: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200&auto=format&fit=crop&q=80',
  twitterHandle: '@CareerPakOfficial',
  googleSearchConsoleVerification: 'google-site-verification=cpak_verify_998432_prod',
  bingWebmasterVerification: 'bing-verification=BING_AUTH_TOKEN_CP_2026',
  googleAnalyticsId: 'G-CP98234871',
  googleTagManagerId: 'GTM-CP8812K',
  facebookPixelId: 'FB_PIXEL_99214710',
  robotsTxtContent: `User-agent: *
Allow: /
Disallow: /admin
Disallow: /api/
Sitemap: https://careerpak.com/sitemap.xml`,
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

export const INITIAL_CURRENCY_CONFIG: CurrencyExchangeConfig = {
  baseCurrency: 'PKR',
  rates: {
    PKR: 1.0,
    USD: 0.0036, // 1 USD = 278 PKR approx
    EUR: 0.0033,
    GBP: 0.0028,
    AED: 0.0132,
    SAR: 0.0135,
    CAD: 0.0049,
    AUD: 0.0055
  },
  lastSyncedAt: '2026-08-26 09:30 UTC',
  autoSyncEnabled: true,
  supportedCurrencies: ['PKR', 'USD', 'AED', 'SAR', 'GBP', 'EUR', 'CAD', 'AUD'],
  internationalPricingTiers: {
    featuredJobFee: {
      PKR: 2500,
      USD: 15,
      AED: 55,
      SAR: 60,
      GBP: 12,
      EUR: 14,
      CAD: 20,
      AUD: 22
    },
    urgentBadgeFee: {
      PKR: 1500,
      USD: 9,
      AED: 35,
      SAR: 38,
      GBP: 7,
      EUR: 8,
      CAD: 12,
      AUD: 14
    },
    verifiedCompanyBadgeFee: {
      PKR: 5000,
      USD: 30,
      AED: 110,
      SAR: 115,
      GBP: 24,
      EUR: 28,
      CAD: 40,
      AUD: 45
    },
    unlimitedMonthlySlotFee: {
      PKR: 18000,
      USD: 99,
      AED: 365,
      SAR: 375,
      GBP: 79,
      EUR: 89,
      CAD: 135,
      AUD: 150
    },
    candidateDatabaseAccessFee: {
      PKR: 12000,
      USD: 69,
      AED: 250,
      SAR: 260,
      GBP: 55,
      EUR: 62,
      CAD: 95,
      AUD: 105
    }
  }
};

export const INITIAL_BROADCAST_CAMPAIGNS: BroadcastCampaign[] = [
  {
    id: 'camp-01',
    title: 'Weekly Top 50 Government & Private Jobs Digest',
    channel: 'Email',
    targetAudience: 'Job Seekers Only',
    categoryFilter: 'All Categories',
    subject: '🎯 Top 50 New Jobs This Week: FPSC, WAPDA, Tech & Gulf Vacancies',
    messageBody: 'Hello {{candidate_name}},\n\nOver 250+ new jobs were posted this week across Pakistan and Overseas. Check out the top featured openings matched to your profile:\n\n1. FPSC Assistant Director (BPS-17) - Ministry of Energy\n2. Senior Full Stack Engineer (Remote - $4,500/mo)\n3. WAPDA Junior Civil Engineers (50+ Vacancies)\n\nApply directly with 1-click on CareerPak!',
    sentAt: '2026-08-25 10:00',
    status: 'Sent',
    recipientsCount: 1420,
    openRate: 48.2,
    clickRate: 21.6
  },
  {
    id: 'camp-02',
    title: 'Urgent WhatsApp Alert: FPSC Advt No. 08/2026 Deadline',
    channel: 'WhatsApp',
    targetAudience: 'Subscribed Members',
    categoryFilter: 'Government Sector',
    subject: 'FPSC Deadline Reminder',
    messageBody: '🚨 *URGENT FPSC RECRUITMENT ALERT*:\nDeadline for FPSC Consolidated Gazette Advt No. 08/2026 is approaching. Challan fee Rs. 300 payable at NBP. Ensure your online application is submitted before 28th August.',
    sentAt: '2026-08-25 15:30',
    status: 'Sent',
    recipientsCount: 412,
    openRate: 94.5,
    clickRate: 67.8
  },
  {
    id: 'camp-03',
    title: 'Employer Autumn Recruitment 30% Off Promotion',
    channel: 'Email',
    targetAudience: 'Employers / Posters',
    categoryFilter: 'Private Corporate',
    subject: '💼 Boost Your Hiring: 30% Off Featured Job Slots & Verified Company Badge',
    messageBody: 'Dear Hiring Manager,\n\nAttract top talent 5x faster. Upgrade to our Featured Listing or Unlimited Monthly Employer Plan with promo code **HIREPRO30** valid through this weekend.',
    sentAt: '2026-08-24 11:15',
    status: 'Sent',
    recipientsCount: 235,
    openRate: 42.1,
    clickRate: 18.3
  }
];

export const INITIAL_COMM_CONFIG: CommunicationProviderConfig = {
  smtpHost: 'smtp.sendgrid.net',
  smtpPort: 587,
  smtpUser: 'apikey',
  smtpSenderEmail: 'alerts@careerpak.com',
  sendgridApiKey: 'SG.mock_sendgrid_key_99841',
  resendApiKey: 're_mock_resend_live_881',
  whatsappCloudApiToken: 'EAAQmockTokenWhatsAppCloud2026',
  whatsappPhoneNumberId: '10928374619',
  twilioAccountSid: 'ACmockTwilioSid884210',
  twilioAuthToken: 'mockTwilioAuthToken992',
  twilioPhoneNumber: '+18005559821'
};

export const INITIAL_SECURITY_CONFIG: SecurityConfig = {
  blacklistedIps: ['185.220.101.5', '45.154.255.89', '194.26.29.112'],
  blacklistedEmailDomains: ['tempmail.com', 'throwawaymail.org', 'guerrillamail.com', 'mailinator.com', '10minutemail.com'],
  rateLimitRequestsPerMin: 120,
  enableCaptchaOnJobPost: true,
  enableCaptchaOnRegistration: true,
  captchaProvider: 'Cloudflare Turnstile',
  captchaSiteKey: '0x4AAAAAAAMockSiteKeyTurnstile',
  requireEmailVerificationForPosting: false,
  blockDisposableEmails: true,
  adminSessionAuditLogs: [
    {
      id: 'sec-log-01',
      timestamp: '2026-08-26 09:15',
      ipAddress: '110.38.12.94 (Islamabad, PK)',
      adminEmail: 'admin@careerpak.com',
      action: 'Super Admin Login',
      details: 'Two-factor session authenticated successfully',
      status: 'Success'
    },
    {
      id: 'sec-log-02',
      timestamp: '2026-08-26 08:44',
      ipAddress: '194.26.29.112 (Frankfurt, DE)',
      adminEmail: 'root@unknown.com',
      action: 'Unauthorized Admin Endpoint Probe',
      details: 'Blocked by Automated IP Rate Limiter',
      status: 'Blocked'
    },
    {
      id: 'sec-log-03',
      timestamp: '2026-08-25 21:10',
      ipAddress: '39.40.114.202 (Lahore, PK)',
      adminEmail: 'admin@careerpak.com',
      action: 'Scraper Feature Flag Modification',
      details: 'Enabled FPSC & WAPDA PDF Scraper Module',
      status: 'Success'
    },
    {
      id: 'sec-log-04',
      timestamp: '2026-08-25 18:30',
      ipAddress: '185.220.101.5 (Tor Exit Node)',
      adminEmail: 'spambot@guerrillamail.com',
      action: 'Disposable Email Registration Blocked',
      details: 'Rejected domain guerrillamail.com by Email Shield',
      status: 'Blocked'
    }
  ]
};

export const INITIAL_KYC_REQUESTS: EmployerKycRequest[] = [
  {
    id: 'kyc-01',
    userId: 'user-emp-systems',
    companyName: 'Systems Limited',
    contactPerson: 'Zubair Tariq (Head of HR Talent Acquisition)',
    email: 'careers@systemsltd.com',
    phone: '+92 42 111 797 836',
    ntnOrTaxNumber: '0812948-4',
    secpRegistrationNumber: 'CU-0019482/1995',
    companyWebsite: 'https://systemsltd.com',
    officialDocUrl: 'https://cdn.careerpak.com/kyc/secp_systems_ltd_cert.pdf',
    submittedAt: '2026-08-24 14:30',
    status: 'Verified',
    verifiedAt: '2026-08-24 16:00',
    verifiedBy: 'Admin (Kiani)',
    badgeLevel: 'Top Employer'
  },
  {
    id: 'kyc-02',
    userId: 'user-emp-ffc',
    companyName: 'Fauji Fertilizer Company (FFC)',
    contactPerson: 'Col. (R) Imran Farooq (General Manager HR)',
    email: 'recruitment@ffc.com.pk',
    phone: '+92 51 845 0001',
    ntnOrTaxNumber: '0710293-1',
    secpRegistrationNumber: 'SECP-ISB-1978/0021',
    companyWebsite: 'https://ffc.com.pk',
    officialDocUrl: 'https://cdn.careerpak.com/kyc/ffc_tax_ntn_cert.pdf',
    submittedAt: '2026-08-25 11:20',
    status: 'Verified',
    verifiedAt: '2026-08-25 12:45',
    verifiedBy: 'Admin (Kiani)',
    badgeLevel: 'Top Employer'
  },
  {
    id: 'kyc-03',
    userId: 'user-emp-gulftech',
    companyName: 'Gulf Recruitment Agency UAE LLC',
    contactPerson: 'Tariq Al-Mansoor',
    email: 'recruitment@gulftech-careers.ae',
    phone: '+971 4 398 2900',
    ntnOrTaxNumber: 'UAE-TAX-TRN-100492837100003',
    companyWebsite: 'https://gulftech-careers.ae',
    officialDocUrl: 'https://cdn.careerpak.com/kyc/dubai_ded_trade_license.pdf',
    submittedAt: '2026-08-26 08:15',
    status: 'Pending',
    badgeLevel: 'Standard Verified'
  },
  {
    id: 'kyc-04',
    userId: 'user-emp-fastdevs',
    companyName: 'FastDevs Innovations (Pvt) Ltd',
    contactPerson: 'M. Ali Raza',
    email: 'ali@fastdevsinnovations.com',
    phone: '+92 300 4819203',
    ntnOrTaxNumber: '5819204-7',
    secpRegistrationNumber: '0189342',
    companyWebsite: 'https://fastdevsinnovations.com',
    officialDocUrl: 'https://cdn.careerpak.com/kyc/secp_fastdevs.pdf',
    submittedAt: '2026-08-26 09:00',
    status: 'Pending',
    badgeLevel: 'Standard Verified'
  }
];

export const INITIAL_AI_AUDIT_REPORTS: Record<string, AiJobAuditReport> = {
  'job-1': {
    jobId: 'job-1',
    overallScore: 96,
    titleClarity: 98,
    salaryTransparency: 95,
    descriptionDepth: 94,
    seoKeywordDensity: 97,
    suggestedSalaryRange: '$120,000 - $150,000 / year ($10k - $12.5k / mo)',
    suggestedTags: ['React', 'Node.js', 'PostgreSQL', 'TypeScript', 'GraphQL', 'AWS'],
    spamConfidenceScore: 2,
    grammarIssuesDetected: 0,
    enhancedDescriptionPreview: 'Seeking an exceptional Senior Full Stack Developer to spearhead our core cloud infrastructure and scalable React frontend systems...'
  },
  'job-9-govt': {
    jobId: 'job-9-govt',
    overallScore: 92,
    titleClarity: 95,
    salaryTransparency: 90,
    descriptionDepth: 92,
    seoKeywordDensity: 94,
    suggestedSalaryRange: 'PKR 110,000 - 165,000 / mo (BPS-17 Standard + Allowances)',
    suggestedTags: ['FPSC', 'BPS-17', 'Federal Govt', 'Ministry of Energy', 'Challan Rs 300', 'Islamabad'],
    spamConfidenceScore: 1,
    grammarIssuesDetected: 0,
    enhancedDescriptionPreview: 'Federal Public Service Commission (FPSC) invites online applications for permanent positions of Assistant Director (BPS-17) in the Ministry of Energy...'
  }
};
