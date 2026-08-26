export type AdType = 'banner' | 'text' | 'popup' | 'notification' | 'sms';

export type AdTargetPage = 'all' | 'jobs' | 'cv' | 'alerts' | 'dashboard' | 'detail-modal';

export type AdPlacement = 
  | 'top-header'      // Top Announcement Banner (above header)
  | 'feed-inline'     // Clean Card between job posts in listings
  | 'sidebar'         // Sidebar / Filter widget
  | 'popup-modal'     // Centered Modal popup overlay
  | 'toast-float'     // Bottom-right toast notification
  | 'sms-broadcast';  // Direct SMS text message broadcast

export type AdStatus = 'active' | 'paused' | 'pending_approval' | 'rejected' | 'completed' | 'draft';

export type AdDurationUnit = 'hours' | 'days' | 'weeks' | 'months';

export type AdTheme = 'emerald' | 'indigo' | 'amber' | 'rose' | 'slate' | 'gradient-purple' | 'gradient-ocean';

export interface WalletTransaction {
  id: string;
  userId: string;
  dateTime: string; // "YYYY-MM-DD HH:MM"
  type: 'Deposit' | 'Campaign Payment' | 'Campaign Refund' | 'Subscription' | 'Adjustment';
  amount: number; // PKR
  balanceBefore: number;
  balanceAfter: number;
  description: string;
  campaignId?: string;
  campaignTitle?: string;
  paymentMethod?: string;
  status: 'Completed' | 'Pending' | 'Failed';
  receiptNo?: string;
}

export interface PortalPageConfig {
  id: string; // 'all' | 'jobs' | 'cv' | 'alerts' | 'dashboard' | 'detail-modal' | string
  name: string;
  description: string;
  routePath?: string;
  iconName?: string;
  isEnabled: boolean; // Admin can toggle enable/disable
  multiplier: number;
  
  // Timeframe and Duration controls configured by Admin
  scheduleMode: 'always_active' | 'time_window' | 'date_range' | 'disabled';
  activeTimeStart?: string; // "09:00"
  activeTimeEnd?: string;   // "21:00"
  activeDateStart?: string; // "2026-08-01"
  activeDateEnd?: string;   // "2026-12-31"
  allowedDurationIds?: string[]; // IDs of allowed duration presets
  minDurationHours?: number;
  maxDurationHours?: number;
  disabledReason?: string; // e.g. "Reserved for FPSC CSS exam schedule"
}

export interface CampaignDurationPreset {
  id: string;
  label: string;
  subLabel: string;
  unit: AdDurationUnit;
  value: number;
  isPopular?: boolean;
  badge?: string;
  discountPercent?: number;
  fixedPriceOverridePkr?: number;
  isEnabled: boolean;
}

export interface CampaignPlacementOption {
  id: AdPlacement;
  name: string;
  description: string;
  type: AdType;
  multiplier: number;
  iconName: string;
  badge?: string;
  isEnabled: boolean;
  allowedPageIds?: string[];
}

export interface CampaignCustomizationConfig {
  portalPages: PortalPageConfig[];
  durationPresets: CampaignDurationPreset[];
  placementOptions: CampaignPlacementOption[];
  badgePresets: string[];
  ctaPresets: { label: string; defaultUrl?: string }[];
  formRules: {
    requireImage: boolean;
    requireAdminApproval: boolean;
    allowCustomDateRange: boolean;
    maxCampaignDays: number;
    allowDirectSms: boolean;
    instantPublishForPro: boolean;
  };
}

export const DEFAULT_PORTAL_PAGES_CONFIG: PortalPageConfig[] = [
  {
    id: 'all',
    name: 'All Portal Pages (Site-Wide)',
    description: 'Displays across header and global notifications on every page.',
    routePath: '#all',
    iconName: 'Globe',
    isEnabled: true,
    multiplier: 1.4,
    scheduleMode: 'always_active',
    activeTimeStart: '00:00',
    activeTimeEnd: '23:59',
    minDurationHours: 6,
    maxDurationHours: 2160
  },
  {
    id: 'alerts',
    name: 'Job Alerts Page',
    description: 'Target users actively subscribing to daily/weekly career alerts.',
    routePath: '#alerts',
    iconName: 'Bell',
    isEnabled: true,
    multiplier: 0.85,
    scheduleMode: 'always_active',
    activeTimeStart: '08:00',
    activeTimeEnd: '23:00',
    minDurationHours: 6,
    maxDurationHours: 720
  },
  {
    id: 'jobs',
    name: 'Explore Jobs Search Feed',
    description: 'High intent applicants browsing verified jobs and filters.',
    routePath: '#jobs',
    iconName: 'Briefcase',
    isEnabled: true,
    multiplier: 1.0,
    scheduleMode: 'always_active',
    activeTimeStart: '00:00',
    activeTimeEnd: '23:59',
    minDurationHours: 6,
    maxDurationHours: 2160
  },
  {
    id: 'cv',
    name: 'ATS CV & Resume Builder',
    description: 'Job seekers actively building, formatting, and scoring CVs.',
    routePath: '#cv',
    iconName: 'FileText',
    isEnabled: true,
    multiplier: 0.9,
    scheduleMode: 'always_active',
    activeTimeStart: '00:00',
    activeTimeEnd: '23:59',
    minDurationHours: 6,
    maxDurationHours: 1440
  },
  {
    id: 'dashboard',
    name: 'User Account Dashboard',
    description: 'Registered candidates and employers checking application statuses.',
    routePath: '#dashboard',
    iconName: 'Users',
    isEnabled: true,
    multiplier: 0.75,
    scheduleMode: 'always_active',
    activeTimeStart: '00:00',
    activeTimeEnd: '23:59',
    minDurationHours: 6,
    maxDurationHours: 720
  },
  {
    id: 'detail-modal',
    name: 'Job Detail Popup Modal',
    description: 'Shown when an applicant opens a specific job description modal.',
    routePath: '#jobs',
    iconName: 'Layers',
    isEnabled: true,
    multiplier: 0.65,
    scheduleMode: 'always_active',
    activeTimeStart: '00:00',
    activeTimeEnd: '23:59',
    minDurationHours: 6,
    maxDurationHours: 720
  }
];

export const DEFAULT_DURATION_PRESETS: CampaignDurationPreset[] = [
  {
    id: 'flash-6h',
    label: '6 Hours',
    subLabel: 'Flash Slot',
    unit: 'hours',
    value: 6,
    badge: '⚡ Flash Alert',
    isEnabled: true
  },
  {
    id: 'halfday-12h',
    label: '12 Hours',
    subLabel: 'Half Day',
    unit: 'hours',
    value: 12,
    badge: 'Quick Boost',
    isEnabled: true
  },
  {
    id: 'fullday-24h',
    label: '24 Hours (1 Day)',
    subLabel: 'Standard Daily',
    unit: 'days',
    value: 1,
    isPopular: true,
    badge: '🔥 Most Popular',
    isEnabled: true
  },
  {
    id: 'weekend-3d',
    label: '3 Days',
    subLabel: 'Weekend Sprint',
    unit: 'days',
    value: 3,
    badge: 'Sprint Slot',
    isEnabled: true
  },
  {
    id: 'week-1w',
    label: '1 Week (7 Days)',
    subLabel: 'Full Hiring Week',
    unit: 'weeks',
    value: 1,
    isPopular: true,
    badge: '⭐ High Impact',
    isEnabled: true
  },
  {
    id: 'biweekly-2w',
    label: '2 Weeks (14 Days)',
    subLabel: 'Extended Run',
    unit: 'weeks',
    value: 2,
    discountPercent: 10,
    badge: '10% Discount',
    isEnabled: true
  },
  {
    id: 'month-1m',
    label: '1 Month (30 Days)',
    subLabel: 'Maximum Reach',
    unit: 'months',
    value: 1,
    discountPercent: 20,
    badge: '💎 Best Value (20% Off)',
    isEnabled: true
  },
  {
    id: 'quarter-2m',
    label: '2 Months (60 Days)',
    subLabel: 'Enterprise Sponsor',
    unit: 'months',
    value: 2,
    discountPercent: 30,
    badge: 'Enterprise Plan',
    isEnabled: true
  }
];

export const DEFAULT_PLACEMENT_OPTIONS: CampaignPlacementOption[] = [
  {
    id: 'top-header',
    name: 'Top Header Announcement Banner',
    description: 'Sticky banner above the main portal navigation. Highest visibility across screens.',
    type: 'banner',
    multiplier: 1.25,
    iconName: 'Megaphone',
    badge: 'High CTR',
    isEnabled: true
  },
  {
    id: 'feed-inline',
    name: 'Job Listings Feed Inline Card',
    description: 'Blended seamlessly between job postings in search results and category feeds.',
    type: 'banner',
    multiplier: 1.0,
    iconName: 'Layers',
    badge: 'Native Feed',
    isEnabled: true
  },
  {
    id: 'popup-modal',
    name: 'Centered Pop-up Lightbox Modal',
    description: 'Prominent lightbox dialog overlay on entering target pages or job alert signups.',
    type: 'popup',
    multiplier: 1.5,
    iconName: 'Sparkles',
    badge: 'Maximum Impact',
    isEnabled: true
  },
  {
    id: 'toast-float',
    name: 'Floating Toast Notification (Bottom-Right)',
    description: 'Non-intrusive floating alert card with animated entry in the corner.',
    type: 'notification',
    multiplier: 0.9,
    iconName: 'Bell',
    badge: 'Subtle Alert',
    isEnabled: true
  },
  {
    id: 'sidebar',
    name: 'Sidebar & Filter Widget Card',
    description: 'Pinned alongside job search filters and alert subscription widgets.',
    type: 'text',
    multiplier: 0.75,
    iconName: 'Smartphone',
    badge: 'Desktop & Tablet',
    isEnabled: true
  },
  {
    id: 'sms-broadcast',
    name: 'Direct SMS Text Message Broadcast',
    description: 'Direct cellular SMS broadcast sent to registered job seeker phone numbers.',
    type: 'sms',
    multiplier: 1.1,
    iconName: 'Send',
    badge: 'Direct Phone',
    isEnabled: true
  }
];

export const DEFAULT_BADGE_PRESETS: string[] = [
  'Featured Partner',
  'Sponsored',
  'Urgent Hiring',
  'Special Offer',
  'Verified Employer',
  'Public Notice',
  'Direct Relocation',
  'Flash Discount',
  'Govt Exam Prep',
  'Top Rated Academy'
];

export const DEFAULT_CTA_PRESETS: { label: string; defaultUrl?: string }[] = [
  { label: 'Apply Now', defaultUrl: '#jobs' },
  { label: 'Build ATS CV Free', defaultUrl: '#cv' },
  { label: 'Set Instant Job Alert', defaultUrl: '#alerts' },
  { label: 'Explore Remote Roles', defaultUrl: '#jobs' },
  { label: 'Enroll with 40% Off', defaultUrl: 'https://example.com' },
  { label: 'Download Exam Guide', defaultUrl: 'https://example.com/govt-exam' },
  { label: 'Contact on WhatsApp', defaultUrl: 'https://wa.me/923001234567' },
  { label: 'Claim Relocation Bonus', defaultUrl: '#jobs' },
  { label: 'Learn More', defaultUrl: 'https://example.com' }
];

export const DEFAULT_CAMPAIGN_CUSTOMIZATION_CONFIG: CampaignCustomizationConfig = {
  portalPages: DEFAULT_PORTAL_PAGES_CONFIG,
  durationPresets: DEFAULT_DURATION_PRESETS,
  placementOptions: DEFAULT_PLACEMENT_OPTIONS,
  badgePresets: DEFAULT_BADGE_PRESETS,
  ctaPresets: DEFAULT_CTA_PRESETS,
  formRules: {
    requireImage: false,
    requireAdminApproval: true,
    allowCustomDateRange: true,
    maxCampaignDays: 90,
    allowDirectSms: true,
    instantPublishForPro: false
  }
};

export interface AdPricingConfig {
  hourlyRatePkr: number;    // Base PKR per hour (e.g. 100)
  dailyRatePkr: number;     // Base PKR for 24 Hours / 1 Day (e.g. 800)
  weeklyRatePkr: number;    // Base PKR for 1 Week / 7 Days (e.g. 4,500)
  monthlyRatePkr: number;   // Base PKR for 1 Month / 30 Days (e.g. 15,000)
  
  placementMultipliers: Record<AdPlacement, number>;
  pageMultipliers: Record<AdTargetPage, number>;
  
  smsPerContactRatePkr: number; // e.g. 1.5 PKR per contact
  minDepositAmountPkr: number; // e.g. 500 PKR
}

export const DEFAULT_AD_PRICING_CONFIG: AdPricingConfig = {
  hourlyRatePkr: 80,
  dailyRatePkr: 800,
  weeklyRatePkr: 4500,
  monthlyRatePkr: 16000,
  placementMultipliers: {
    'top-header': 1.25,
    'feed-inline': 1.0,
    'popup-modal': 1.5,
    'toast-float': 0.9,
    'sidebar': 0.75,
    'sms-broadcast': 1.1
  },
  pageMultipliers: {
    'all': 1.4,
    'jobs': 1.0,
    'cv': 0.9,
    'alerts': 0.85,
    'dashboard': 0.75,
    'detail-modal': 0.65
  },
  smsPerContactRatePkr: 1.5,
  minDepositAmountPkr: 500
};

export interface Advertisement {
  id: string;
  title: string; // Campaign Internal Title
  type: AdType;
  targetPages: AdTargetPage[]; // e.g. ['all'] or ['jobs', 'cv']
  placement: AdPlacement;
  status: AdStatus;
  
  // User & Submission Details
  submittedByUserId?: string; // If submitted by regular user (or 'admin' / 'system')
  submittedByUserName?: string;
  submittedByUserEmail?: string;
  submittedByUserPhone?: string;
  
  // Approval / Rejection Workflow
  approvalStatus?: 'Approved' | 'Pending' | 'Rejected';
  rejectionReason?: string;
  approvedAt?: string;
  rejectedAt?: string;
  approvedBy?: string;
  
  // Timeframe, Duration & Scheduling
  durationUnit?: AdDurationUnit;
  durationValue?: number;
  durationDisplay?: string; // e.g. "24 Hours (1 Day)", "1 Week", "12 Hours", "2 Months"
  scheduledStartAt?: string; // "YYYY-MM-DD HH:MM"
  scheduledEndAt?: string;   // "YYYY-MM-DD HH:MM"
  
  // Financial & Wallet
  campaignCostPkr?: number;
  paymentStatus?: 'Paid' | 'Pending Wallet Deduction' | 'Refunded' | 'Exempt';
  walletTxId?: string;
  
  // Visual & Content Details
  headline: string;
  bodyText: string;
  imageUrl?: string; // Banner graphic / Sponsor logo
  ctaText?: string; // e.g. "Apply Now", "Claim 50% Discount", "Join Live Masterclass"
  ctaUrl?: string; // External URL or internal tab link (e.g. '#cv', '#alerts', 'https://...')
  badgeText?: string; // e.g. "Sponsored", "Featured Partner", "Urgent Notice", "Special Offer"
  
  // Style / Colors
  theme: AdTheme;
  customBgColor?: string;
  customTextColor?: string;
  
  // Settings
  dismissable: boolean;
  autoCloseDelay?: number; // In seconds (for popups/toasts)
  priority?: 'high' | 'normal' | 'low';
  
  // SMS Broadcast specific
  smsSenderId?: string; // e.g., "HybridJobsPK", "PakCareers", "GovtExamPrep"
  smsAudience?: 'All Registered Users' | 'Pro Subscribers Only' | 'Job Seekers' | 'Employers';
  smsRecipientsCount?: number;
  smsSentAt?: string;
  smsStatus?: 'Sent' | 'Scheduled' | 'Draft';
  
  // Analytics Tracking
  impressions: number;
  clicks: number;
  createdAt: string;
  updatedAt?: string;
}

export interface AdPresetBanner {
  id: string;
  name: string;
  category: string;
  imageUrl: string;
  headline: string;
  bodyText: string;
  ctaText: string;
  ctaUrl: string;
  badgeText: string;
  theme: AdTheme;
}

export const AD_BANNER_PRESETS: AdPresetBanner[] = [
  {
    id: 'preset-tech-bootcamp',
    name: 'Silicon Valley Remote Tech Bootcamp',
    category: 'Education & Tech',
    imageUrl: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=1200&auto=format&fit=crop&q=80',
    headline: 'Accelerate Your Global Remote Tech Career',
    bodyText: 'Fast-track your transition into high-paying US & European tech positions with 1-on-1 mentorship and mock technical interviews.',
    ctaText: 'Apply for Cohort',
    ctaUrl: 'https://example.com/tech-bootcamp',
    badgeText: 'Featured Academy',
    theme: 'indigo'
  },
  {
    id: 'preset-ats-cv',
    name: 'Executive ATS Resume & LinkedIn Revamp',
    category: 'Career Services',
    imageUrl: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=1200&auto=format&fit=crop&q=80',
    headline: 'Double Your Interview Callbacks in 14 Days',
    bodyText: 'Get your CV scored and rewritten by ex-FAANG & top recruitment leaders with automated keyword optimization for Pakistani & international hiring ATS.',
    ctaText: 'Build Pro CV Now',
    ctaUrl: '#cv',
    badgeText: 'Top Rated Pro Tool',
    theme: 'emerald'
  },
  {
    id: 'preset-fpsc-govt',
    name: 'FPSC & PPSC Public Sector Examination Prep',
    category: 'Government Exams',
    imageUrl: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=1200&auto=format&fit=crop&q=80',
    headline: 'Comprehensive BPS-17 & CSS Preparation 2026',
    bodyText: 'Access official past papers, screening mock tests, and subject matter masterclasses compiled by senior retired civil officers.',
    ctaText: 'Get Exam Guide',
    ctaUrl: 'https://example.com/govt-exam-guide',
    badgeText: 'Govt Portal Partner',
    theme: 'amber'
  },
  {
    id: 'preset-gulf-relocation',
    name: 'Dubai & Saudi Arabia Tax-Free Relocation Package',
    category: 'International Hiring',
    imageUrl: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=1200&auto=format&fit=crop&q=80',
    headline: 'High-Paying UAE & Saudi Healthcare and Engineering Roles',
    bodyText: 'Direct visa sponsorship, family relocation allowances, and tax-free remuneration packages for experienced Pakistani professionals.',
    ctaText: 'Explore Gulf Roles',
    ctaUrl: '#jobs',
    badgeText: 'Direct Sponsorship',
    theme: 'gradient-ocean'
  },
  {
    id: 'preset-remote-devs',
    name: 'Global Employer Talent Network',
    category: 'Recruiter Sponsor',
    imageUrl: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&auto=format&fit=crop&q=80',
    headline: 'Hiring Remote Developers, Designers & Product Leads',
    bodyText: 'Over 85 venture-backed startups are hiring remote Pakistani talent with USD compensation contracts.',
    ctaText: 'View Open Roles',
    ctaUrl: '#jobs',
    badgeText: 'Sponsored Recruiter',
    theme: 'slate'
  },
  {
    id: 'preset-ai-cert',
    name: 'AI Engineering & Data Science Certification',
    category: 'Certifications',
    imageUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1200&auto=format&fit=crop&q=80',
    headline: 'Master Generative AI, LLMs & Cloud Pipelines',
    bodyText: 'Earn globally recognized credentials and build real-world AI production systems with industry verified certificates.',
    ctaText: 'Enroll with 40% Off',
    ctaUrl: 'https://example.com/ai-certification',
    badgeText: 'Special Discount',
    theme: 'gradient-purple'
  }
];

export const INITIAL_ADVERTISEMENTS: Advertisement[] = [
  {
    id: 'ad-top-banner-1',
    title: 'Global Tech & Gulf Career Acceleration Banner',
    type: 'banner',
    targetPages: ['all'],
    placement: 'top-header',
    status: 'active',
    approvalStatus: 'Approved',
    submittedByUserId: 'admin',
    submittedByUserName: 'System Admin',
    durationUnit: 'months',
    durationValue: 1,
    durationDisplay: '1 Month (30 Days)',
    scheduledStartAt: '2026-08-20 00:00',
    scheduledEndAt: '2026-09-20 23:59',
    campaignCostPkr: 28000,
    paymentStatus: 'Paid',
    headline: '🚀 Fast-Track Your International Tech Career: Top US, UK & Gulf Remote Openings',
    bodyText: 'Verified positions with direct USD & AED contracts. Join 12,000+ Pakistani professionals working globally.',
    imageUrl: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=1200&auto=format&fit=crop&q=80',
    ctaText: 'Explore Remote Roles',
    ctaUrl: '#jobs',
    badgeText: 'Featured Partner',
    theme: 'indigo',
    dismissable: true,
    impressions: 1420,
    clicks: 184,
    createdAt: '2026-08-20 10:00'
  },
  {
    id: 'ad-feed-inline-1',
    title: 'ATS Resume Review & Optimization Feed Banner',
    type: 'banner',
    targetPages: ['jobs'],
    placement: 'feed-inline',
    status: 'active',
    approvalStatus: 'Approved',
    submittedByUserId: 'admin',
    submittedByUserName: 'System Admin',
    durationUnit: 'weeks',
    durationValue: 2,
    durationDisplay: '2 Weeks (14 Days)',
    scheduledStartAt: '2026-08-21 00:00',
    scheduledEndAt: '2026-09-04 23:59',
    campaignCostPkr: 9000,
    paymentStatus: 'Paid',
    headline: 'Stand Out to Recruiters with an ATS-Optimized Professional CV',
    bodyText: 'Over 75% of resumes are rejected before human review. Use our built-in ATS formatting engine to double your interview callbacks.',
    imageUrl: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=1200&auto=format&fit=crop&q=80',
    ctaText: 'Build Your Free ATS CV',
    ctaUrl: '#cv',
    badgeText: 'Pro Career Service',
    theme: 'emerald',
    dismissable: false,
    impressions: 2840,
    clicks: 412,
    createdAt: '2026-08-21 14:30'
  },
  {
    id: 'ad-popup-modal-1',
    title: 'FPSC & PPSC Public Sector Examination Masterclass Popup',
    type: 'popup',
    targetPages: ['jobs', 'alerts'],
    placement: 'popup-modal',
    status: 'active',
    approvalStatus: 'Approved',
    submittedByUserId: 'user-demo-1',
    submittedByUserName: 'Tariq Mehmood',
    submittedByUserEmail: 'tariq.academy@gmail.com',
    durationUnit: 'weeks',
    durationValue: 1,
    durationDisplay: '1 Week (7 Days)',
    scheduledStartAt: '2026-08-22 00:00',
    scheduledEndAt: '2026-08-29 23:59',
    campaignCostPkr: 6750,
    paymentStatus: 'Paid',
    headline: '📢 Official Federal & Provincial Public Service Exam Alert 2026',
    bodyText: 'New consolidated BPS-16 through BPS-19 recruitment quotas announced for Federal Ministries, Revenue Authority, and Education boards. Download screening test syllabi, past solved papers, and apply before deadline.',
    imageUrl: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=1200&auto=format&fit=crop&q=80',
    ctaText: 'Access Govt Syllabus & Papers',
    ctaUrl: 'https://example.com/govt-exam-guide',
    badgeText: 'Public Notice',
    theme: 'amber',
    dismissable: true,
    autoCloseDelay: 0,
    impressions: 980,
    clicks: 135,
    createdAt: '2026-08-22 09:15'
  },
  {
    id: 'ad-notification-toast-1',
    title: 'Instant Job Alert Toast Notification',
    type: 'notification',
    targetPages: ['all'],
    placement: 'toast-float',
    status: 'active',
    approvalStatus: 'Approved',
    submittedByUserId: 'admin',
    submittedByUserName: 'System Admin',
    durationUnit: 'days',
    durationValue: 7,
    durationDisplay: '7 Days',
    scheduledStartAt: '2026-08-23 00:00',
    scheduledEndAt: '2026-08-30 23:59',
    campaignCostPkr: 5040,
    paymentStatus: 'Paid',
    headline: '⚡ 24 New Verified Remote Developer Positions Added Today!',
    bodyText: 'Silicon Valley and London companies are actively hiring Node.js, React, and Python developers with remote Pakistani contracts.',
    ctaText: 'View Opportunities',
    ctaUrl: '#jobs',
    badgeText: 'Urgent Hiring',
    theme: 'emerald',
    dismissable: true,
    autoCloseDelay: 12,
    impressions: 3120,
    clicks: 348,
    createdAt: '2026-08-23 11:45'
  },
  {
    id: 'ad-pending-sample-1',
    title: 'Fast-Track Cloud & DevOps Certification 2026',
    type: 'banner',
    targetPages: ['jobs', 'cv'],
    placement: 'top-header',
    status: 'pending_approval',
    approvalStatus: 'Pending',
    submittedByUserId: 'user-2',
    submittedByUserName: 'CloudSkills Academy',
    submittedByUserEmail: 'info@cloudskills.pk',
    durationUnit: 'days',
    durationValue: 3,
    durationDisplay: '3 Days',
    scheduledStartAt: '2026-08-26 00:00',
    scheduledEndAt: '2026-08-29 00:00',
    campaignCostPkr: 2880,
    paymentStatus: 'Paid',
    headline: 'Become an AWS & Kubernetes Certified Cloud Engineer in 6 Weeks',
    bodyText: '100% live interactive labs, guaranteed project portfolio, and hiring partner referrals in Lahore, Karachi & Islamabad.',
    imageUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1200&auto=format&fit=crop&q=80',
    ctaText: 'View Syllabus & Enroll',
    ctaUrl: 'https://example.com/devops',
    badgeText: 'Certification Partner',
    theme: 'indigo',
    dismissable: true,
    impressions: 0,
    clicks: 0,
    createdAt: '2026-08-25 01:20'
  },
  {
    id: 'ad-sms-broadcast-1',
    title: 'Weekly Premium Remote Job Openings SMS Broadcast',
    type: 'sms',
    targetPages: ['all'],
    placement: 'sms-broadcast',
    status: 'active',
    approvalStatus: 'Approved',
    submittedByUserId: 'admin',
    submittedByUserName: 'System Admin',
    durationUnit: 'hours',
    durationValue: 24,
    durationDisplay: '24 Hours (1 Day)',
    scheduledStartAt: '2026-08-24 18:00',
    scheduledEndAt: '2026-08-25 18:00',
    campaignCostPkr: 6375,
    paymentStatus: 'Paid',
    headline: 'Weekly Career Digest SMS',
    bodyText: 'HybridJobs Alert: 18 high-paying Remote & Gulf software engineer jobs matching your profile were posted today. Apply now at https://hybridjobs.pk/jobs',
    smsSenderId: 'HybridJobsPK',
    smsAudience: 'All Registered Users',
    smsRecipientsCount: 4250,
    smsSentAt: '2026-08-24 18:00',
    smsStatus: 'Sent',
    badgeText: 'SMS Dispatch',
    theme: 'emerald',
    dismissable: false,
    impressions: 4250,
    clicks: 680,
    createdAt: '2026-08-24 18:00'
  }
];

/**
 * Robust Dynamic Pricing Calculator Function
 */
export function calculateCampaignCost(
  pricing: AdPricingConfig,
  durationUnit: AdDurationUnit,
  durationValue: number,
  placement: AdPlacement,
  targetPages: AdTargetPage[],
  smsRecipientsCount: number = 0
): {
  baseCost: number;
  placementMultiplier: number;
  pageMultiplier: number;
  smsFee: number;
  totalCostPkr: number;
  durationHours: number;
  durationDisplay: string;
} {
  let durationHours = 24;
  let baseRate = 0;
  let durationDisplay = '';

  const cleanVal = Math.max(1, durationValue || 1);

  if (durationUnit === 'hours') {
    durationHours = cleanVal;
    baseRate = pricing.hourlyRatePkr * cleanVal;
    durationDisplay = `${cleanVal} Hour${cleanVal > 1 ? 's' : ''}`;
  } else if (durationUnit === 'days') {
    durationHours = cleanVal * 24;
    // If exactly 1 day, use dailyRate, else daily rate * days
    baseRate = pricing.dailyRatePkr * cleanVal;
    durationDisplay = cleanVal === 1 ? '24 Hours (1 Day)' : `${cleanVal} Days`;
  } else if (durationUnit === 'weeks') {
    durationHours = cleanVal * 7 * 24;
    baseRate = pricing.weeklyRatePkr * cleanVal;
    durationDisplay = cleanVal === 1 ? '1 Week (7 Days)' : `${cleanVal} Weeks`;
  } else if (durationUnit === 'months') {
    durationHours = cleanVal * 30 * 24;
    baseRate = pricing.monthlyRatePkr * cleanVal;
    durationDisplay = cleanVal === 1 ? '1 Month (30 Days)' : `${cleanVal} Months`;
  }

  const pMultiplier = pricing.placementMultipliers[placement] || 1.0;

  // Compute page multiplier (max of individual page multipliers or 'all' multiplier)
  let pageMultiplier = 1.0;
  if (targetPages.includes('all')) {
    pageMultiplier = pricing.pageMultipliers['all'] || 1.4;
  } else {
    const multipliers = targetPages.map((p) => pricing.pageMultipliers[p] || 1.0);
    // Highest multiplier + 10% for each extra page
    const maxM = Math.max(...multipliers, 1.0);
    const extraCount = Math.max(0, targetPages.length - 1);
    pageMultiplier = parseFloat((maxM + extraCount * 0.15).toFixed(2));
  }

  let smsFee = 0;
  if (placement === 'sms-broadcast') {
    smsFee = Math.round(smsRecipientsCount * pricing.smsPerContactRatePkr);
  }

  const calculatedSubtotal = Math.round(baseRate * pMultiplier * pageMultiplier);
  const totalCostPkr = calculatedSubtotal + smsFee;

  return {
    baseCost: Math.round(baseRate),
    placementMultiplier: pMultiplier,
    pageMultiplier,
    smsFee,
    totalCostPkr: Math.max(pricing.hourlyRatePkr, totalCostPkr),
    durationHours,
    durationDisplay
  };
}

export function getPlacementDisplayName(placement: AdPlacement): string {
  switch (placement) {
    case 'top-header':
      return 'Top Header Announcement Banner';
    case 'feed-inline':
      return 'Job Listings Feed Inline Card';
    case 'popup-modal':
      return 'Centered Pop-up Lightbox Modal';
    case 'toast-float':
      return 'Floating Toast Alert (Bottom-Right)';
    case 'sidebar':
      return 'Sidebar / Filter Widget Card';
    case 'sms-broadcast':
      return 'Direct SMS Text Message Broadcast';
    default:
      return placement;
  }
}

export function getPageDisplayName(page: AdTargetPage): string {
  switch (page) {
    case 'all':
      return 'All Pages (Site-Wide)';
    case 'jobs':
      return 'Explore Jobs Feed';
    case 'cv':
      return 'ATS CV Builder';
    case 'alerts':
      return 'Job Alerts Page';
    case 'dashboard':
      return 'User Account Dashboard';
    case 'detail-modal':
      return 'Job Detail Modal';
    default:
      return page;
  }
}

/**
 * Checks whether a specific target portal page is currently enabled and within its scheduled time frame and duration window.
 */
export function isPageScheduledActive(pageConfig: PortalPageConfig, targetDate: Date = new Date()): { isActive: boolean; reason?: string } {
  if (!pageConfig.isEnabled) {
    return { isActive: false, reason: pageConfig.disabledReason || 'Ad placements on this page are currently disabled by the administrator.' };
  }

  if (pageConfig.scheduleMode === 'disabled') {
    return { isActive: false, reason: pageConfig.disabledReason || 'Page disabled for ad campaigns.' };
  }

  if (pageConfig.scheduleMode === 'time_window' && pageConfig.activeTimeStart && pageConfig.activeTimeEnd) {
    const currentHours = targetDate.getHours().toString().padStart(2, '0');
    const currentMins = targetDate.getMinutes().toString().padStart(2, '0');
    const currentTimeStr = `${currentHours}:${currentMins}`;
    
    if (currentTimeStr < pageConfig.activeTimeStart || currentTimeStr > pageConfig.activeTimeEnd) {
      return { 
        isActive: false, 
        reason: `Page ads are active only between ${pageConfig.activeTimeStart} and ${pageConfig.activeTimeEnd} daily.` 
      };
    }
  }

  if (pageConfig.scheduleMode === 'date_range' && pageConfig.activeDateStart && pageConfig.activeDateEnd) {
    const currentDateStr = targetDate.toISOString().slice(0, 10);
    if (currentDateStr < pageConfig.activeDateStart || currentDateStr > pageConfig.activeDateEnd) {
      return { 
        isActive: false, 
        reason: `Page campaign schedule is restricted to the window ${pageConfig.activeDateStart} to ${pageConfig.activeDateEnd}.` 
      };
    }
  }

  return { isActive: true };
}

/**
 * Validates selected target pages against portal configuration rules
 */
export function validateCampaignTargetPages(selectedPages: string[], portalConfigs: PortalPageConfig[]): { 
  valid: boolean; 
  blockedPages: { id: string; name: string; reason: string }[];
} {
  const blockedPages: { id: string; name: string; reason: string }[] = [];

  for (const pId of selectedPages) {
    const cfg = portalConfigs.find(c => c.id === pId);
    if (cfg) {
      const check = isPageScheduledActive(cfg);
      if (!check.isActive) {
        blockedPages.push({ id: cfg.id, name: cfg.name, reason: check.reason || 'Disabled' });
      }
    }
  }

  return {
    valid: blockedPages.length === 0,
    blockedPages
  };
}

export function isAdCurrentlyRunning(ad: Advertisement, nowIso?: string): boolean {
  if (ad.status !== 'active') return false;
  if (ad.approvalStatus && ad.approvalStatus !== 'Approved') return false;

  if (!ad.scheduledStartAt || !ad.scheduledEndAt) {
    return true; // Unscheduled admin ads default to always running when active
  }

  const now = nowIso ? new Date(nowIso).getTime() : Date.now();
  const start = new Date(ad.scheduledStartAt.replace(' ', 'T')).getTime();
  const end = new Date(ad.scheduledEndAt.replace(' ', 'T')).getTime();

  return now >= start && now <= end;
}

/**
 * Formats time remaining until an expiration date
 */
export function formatTimeRemaining(endString?: string): string {
  if (!endString) return 'Ongoing';
  const end = new Date(endString.replace(' ', 'T')).getTime();
  const now = Date.now();
  const diffMs = end - now;

  if (diffMs <= 0) return 'Expired';

  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);
  const remainingHours = diffHours % 24;

  if (diffDays > 0) {
    return `${diffDays}d ${remainingHours}h remaining`;
  }
  const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  return `${diffHours}h ${diffMinutes}m remaining`;
}
