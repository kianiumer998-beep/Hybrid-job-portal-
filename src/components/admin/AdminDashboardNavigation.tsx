import React, { useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  BarChart3,
  Bot,
  Briefcase,
  ChevronDown,
  ChevronRight,
  Clock,
  Coins,
  CreditCard,
  Database,
  DollarSign,
  Edit3,
  FileText,
  Globe,
  Layers,
  LayoutGrid,
  MapPin,
  Megaphone,
  Menu,
  MessageSquare,
  MoreVertical,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Receipt,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sliders,
  Sparkles,
  Users,
  X
} from 'lucide-react';

export type AdminCategory =
  | 'jobs'
  | 'scraper'
  | 'ads'
  | 'payments'
  | 'users'
  | 'alerts'
  | 'settings';

export type ProAdminCategoryId =
  | 'overview-analytics'
  | 'jobs-moderation'
  | 'jobs-ads-control-center'
  | 'scraper-ingestion'
  | 'ads-campaigns'
  | 'finance-payments'
  | 'users-kyc-support'
  | 'communication-alerts'
  | 'platform-settings-data';

export type AdminNavMode = 'classic' | 'professional';

export type AdminCanonicalTabId =
  | 'analytics'
  | 'jobs-ads-control-center'
  | 'activity-logs'
  | 'jobs'
  | 'pending'
  | 'add-job'
  | 'ai-enhancer'
  | 'scraper'
  | 'campaign-center'
  | 'advertisements'
  | 'landing-customizer'
  | 'pricing-controller'
  | 'cv-settings'
  | 'admin-payment-methods'
  | 'payment-proofs'
  | 'fee-management'
  | 'fee-logs'
  | 'currency-forex'
  | 'user-audit'
  | 'employer-kyc'
  | 'subscribers'
  | 'chat-hub'
  | 'whatsapp-manager'
  | 'broadcast-center'
  | 'bulk-notifications'
  | 'locations-manager'
  | 'apply-settings'
  | 'modal-content-manager'
  | 'job-visibility'
  | 'seo-config'
  | 'settings'
  | 'form-customizer'
  | 'data-backup'
  | 'admin-security';

export type AdminNavTabId = AdminCanonicalTabId | 'stats' | 'url-scraper' | 'scraped-history';

export const ADMIN_TAB_ALIASES: Record<string, AdminCanonicalTabId> = {
  stats: 'analytics',
  'url-scraper': 'scraper',
  'scraped-history': 'scraper'
};

export function resolveCanonicalAdminTab(tabId: string): AdminCanonicalTabId | string {
  return ADMIN_TAB_ALIASES[tabId] || tabId;
}

export interface AdminNavCounts {
  activeJobsCount: number;
  pendingJobsCount: number;
  activeAdsCount: number;
  pendingProofsCount: number;
  feeLogsCount: number;
  usersCount: number;
  kycBadgeText: string;
  kycPendingCount?: number;
  subscribersCount: number;
  chatMessagesCount: number;
}

export interface AdminNavModuleDefinition {
  id: AdminCanonicalTabId;
  classicCategory: AdminCategory;
  proCategory: ProAdminCategoryId;
  label: string;
  description: string;
  classicSubTabLabel?: (counts: AdminNavCounts) => string;
  allModulesLabel?: (counts: AdminNavCounts) => string;
  urdu: string;
  allModulesUrdu?: string;
  classicSubTabUrdu?: string;
  icon: any;
  badge?: string | ((counts: AdminNavCounts) => string | undefined);
  classicSubTabBadge?: (counts: AdminNavCounts) => string | number | undefined;
  isNew?: boolean;
  keywords: string[];
  aliases?: string[];
  hideInProfessionalNav?: boolean;
}

export interface ProCategoryDefinition {
  id: ProAdminCategoryId;
  label: string;
  urdu: string;
  description: string;
  icon: any;
}

export interface ClassicCategoryDefinition {
  id: AdminCategory;
  label: string;
  allModulesTitle: string;
  urdu: string;
}

export const CLASSIC_ADMIN_CATEGORIES: ClassicCategoryDefinition[] = [
  {
    id: 'jobs',
    label: '💼 Jobs & Posts',
    allModulesTitle: '💼 Jobs & Vacancies (ملازمتیں اور پوسٹس)',
    urdu: 'ملازمتیں'
  },
  {
    id: 'scraper',
    label: '🤖 Scraper Center',
    allModulesTitle: '🤖 Scraper Center (خودکار سکریپر سنٹر)',
    urdu: 'سکریپر سنٹر'
  },
  {
    id: 'ads',
    label: '📢 Ads & Campaigns',
    allModulesTitle: '📢 Ads & Campaigns (اشتہارات اور کیمپینز)',
    urdu: 'اشتہارات'
  },
  {
    id: 'payments',
    label: '💳 Payments & Accounts',
    allModulesTitle: '💳 Payments, Fees & Durations (ادائیگیاں، فیس اور پیکیجز)',
    urdu: 'ادائیگیاں'
  },
  {
    id: 'users',
    label: '👥 Users & KYC',
    allModulesTitle: '👥 Users, KYC & Support (صارفین اور تصدیق)',
    urdu: 'صارفین'
  },
  {
    id: 'alerts',
    label: '📣 Alerts & WhatsApp',
    allModulesTitle: '📣 Alerts & Broadcasts (الرٹس اور پیغامات)',
    urdu: 'الرٹس'
  },
  {
    id: 'settings',
    label: '⚙️ Settings & SEO',
    allModulesTitle: '⚙️ Settings, SEO & Vault (سیٹنگز اور گوگل ایس ای او)',
    urdu: 'ترتیبات'
  }
];

export const PROFESSIONAL_ADMIN_CATEGORIES: ProCategoryDefinition[] = [
  {
    id: 'overview-analytics',
    label: 'Overview & Analytics',
    description: 'Monitor platform health, activity and key performance metrics.',
    urdu: 'مجموعی جائزہ اور اینالیٹکس',
    icon: BarChart3
  },
  {
    id: 'jobs-moderation',
    label: 'Jobs & Moderation',
    description: 'Manage job listings, moderation queues and quality checks.',
    urdu: 'ملازمتیں اور منظوری',
    icon: Briefcase
  },
  {
    id: 'jobs-ads-control-center',
    label: 'Jobs & Ads Control Center',
    description: 'One place for submitted jobs, approvals, job rates, campaigns, ad placements and performance.',
    urdu: 'جابز اور اشتہارات کا مرکزی کنٹرول',
    icon: Megaphone
  },
  {
    id: 'scraper-ingestion',
    label: 'Scraper & Ingestion',
    description: 'Configure and monitor automated job collection and import workflows.',
    urdu: 'خودکار سکریپر سنٹر',
    icon: Bot
  },
  {
    id: 'ads-campaigns',
    label: 'Ads & Campaigns',
    description: 'Manage ad inventory, banners, campaigns and homepage presentation.',
    urdu: 'اشتہارات اور کیمپینز',
    icon: Megaphone
  },
  {
    id: 'finance-payments',
    label: 'Finance & Payments',
    description: 'Control rates, payment methods, receipt verification and fee records.',
    urdu: 'مالیات، فیس اور ادائیگیاں',
    icon: CreditCard
  },
  {
    id: 'users-kyc-support',
    label: 'Users, KYC & Support',
    description: 'Manage user accounts, employer verification and support cases.',
    urdu: 'صارفین، تصدیق اور سپورٹ',
    icon: Users
  },
  {
    id: 'communication-alerts',
    label: 'Communication & Alerts',
    description: 'Configure WhatsApp, email, SMS and bulk notifications.',
    urdu: 'پیغامات، واٹس ایپ اور الرٹس',
    icon: MessageSquare
  },
  {
    id: 'platform-settings-data',
    label: 'Platform Settings & Data',
    description: 'Manage platform behaviour, forms, locations, security and data.',
    urdu: 'پلیٹ فارم سیٹنگز اور ڈیٹا',
    icon: Settings
  }
];

// Single canonical module registry powering Classic mode, All Modules quick matrix, and Professional mode (32 unique modules)
export const ADMIN_NAVIGATION_MODULES: AdminNavModuleDefinition[] = [
  // 1. Overview & Analytics
  {
    id: 'analytics',
    classicCategory: 'settings',
    proCategory: 'overview-analytics',
    label: 'Executive Analytics & KPIs',
    description: 'View portal-wide KPIs, revenue, job activity, user growth and performance reports.',
    classicSubTabLabel: () => 'Executive Analytics & KPIs',
    urdu: 'اینالیٹکس اور کارکردگی',
    classicSubTabUrdu: 'اینالیٹکس رپورٹس',
    icon: BarChart3,
    aliases: ['stats'],
    keywords: ['analytics', 'stats', 'kpi', 'metrics', 'revenue', 'reports', 'overview', 'charts', 'statistics', 'رپورٹس'],
  },
  {
    id: 'activity-logs',
    classicCategory: 'settings',
    proCategory: 'overview-analytics',
    label: 'Security & Activity Trail',
    description: 'Review administrator and platform activity events for audit and security follow-up.',
    urdu: 'سیکیورٹی لاگز',
    icon: ShieldCheck,
    keywords: ['audit', 'security', 'logs', 'activity', 'trail', 'history', 'events', 'لاگز', 'سیکیورٹی']
  },

  {
    id: 'jobs-ads-control-center',
    classicCategory: 'jobs',
    proCategory: 'jobs-ads-control-center',
    label: 'Jobs & Ads Control Center',
    description: 'One workspace for job submissions, approvals, job rates, campaign slots, sizes, schedules and campaign fees.',
    urdu: 'جابز اور اشتہارات کا مرکزی کنٹرول',
    icon: Megaphone,
    keywords: ['jobs ads control center', 'job submissions', 'campaign settings', 'campaign slots', 'job rates', 'job fees', 'کیمپین', 'جابز']
  },

  // 2. Jobs & Moderation
  {
    id: 'jobs',
    classicCategory: 'jobs',
    proCategory: 'jobs-ads-control-center',
    label: 'Live Listings',
    description: 'Manage published job listings, edits, duplicate checks and bulk actions.',
    classicSubTabLabel: (c) => `Live Listings (${c.activeJobsCount})`,
    urdu: 'لائیو نوکریاں',
    classicSubTabUrdu: 'لائیو جابز',
    icon: Briefcase,
    badge: (c) => `${c.activeJobsCount} Active`,
    keywords: ['jobs', 'listings', 'vacancies', 'live', 'posts', 'careers', 'employment', 'نوکریاں', 'ملازمتیں'],
    hideInProfessionalNav: true,
  },
  {
    id: 'pending',
    classicCategory: 'jobs',
    proCategory: 'jobs-ads-control-center',
    label: 'Pending Approvals Queue',
    description: 'Review pending job submissions and approve or reject them.',
    classicSubTabLabel: (c) => `Pending Approvals (${c.pendingJobsCount})`,
    urdu: 'منظوری کی منتظر نوکریاں',
    classicSubTabUrdu: 'زیرِ التواء منظوری',
    icon: Clock,
    badge: (c) => `${c.pendingJobsCount} Pending`,
    classicSubTabBadge: (c) => (c.pendingJobsCount > 0 ? c.pendingJobsCount : undefined),
    keywords: ['pending', 'approval', 'queue', 'moderation', 'review', 'approve', 'reject', 'منظوری'],
    hideInProfessionalNav: true,
  },
  {
    id: 'add-job',
    classicCategory: 'jobs',
    proCategory: 'jobs-ads-control-center',
    label: 'Post Manual Job',
    description: 'Create and submit a job listing manually using the admin form.',
    urdu: 'نئی جاب شامل کریں',
    classicSubTabUrdu: 'نئی جاب',
    icon: Plus,
    keywords: ['add', 'post', 'create', 'manual', 'new job', 'publish', 'نئی جاب', 'شامل'],
    hideInProfessionalNav: true,
  },
  {
    id: 'ai-enhancer',
    classicCategory: 'jobs',
    proCategory: 'jobs-ads-control-center',
    label: 'AI Quality & Spam Guard',
    description: 'Check job content quality and flag spam or incomplete listings.',
    classicSubTabLabel: () => 'AI Quality & Spam Filter',
    urdu: 'کوالٹی اور اسپیم چیکر',
    classicSubTabUrdu: 'کوالٹی فلٹر',
    icon: Sparkles,
    keywords: ['ai', 'quality', 'spam', 'enhancer', 'filter', 'moderation', 'cleanup', 'اسپیم', 'کوالٹی'],
    hideInProfessionalNav: true,
  },

  // 3. Scraper & Ingestion
  {
    id: 'scraper',
    classicCategory: 'scraper',
    proCategory: 'scraper-ingestion',
    label: 'Scraper Center',
    description: 'Manage scraper runs, sources, imported records and extraction history.',
    urdu: 'خودکار ویب سکریپر سنٹر',
    icon: Bot,
    badge: 'Unified',
    aliases: ['url-scraper', 'scraped-history'],
    keywords: ['scraper', 'url-scraper', 'scraped-history', 'crawl', 'bot', 'ingest', 'gazette', 'pdf', 'automation', 'سکریپر']
  },

  // 4. Ads & Campaigns
  {
    id: 'campaign-center',
    classicCategory: 'ads',
    proCategory: 'jobs-ads-control-center',
    label: 'Campaign Operations',
    description: 'Pause or resume approved campaigns, edit schedule windows and apply authorised fee waivers. Use Ad Hub for creative editing, approvals, pricing, placement settings and analytics.',
    classicSubTabLabel: (c) => `Campaign Operations (${c.activeAdsCount} Live)`,
    urdu: 'اشتہاری کیمپین کمانڈ سنٹر',
    classicSubTabUrdu: 'اشتہاری کیمپینز',
    icon: Megaphone,
    badge: (c) => `${c.activeAdsCount} Live`,
    keywords: ['campaign', 'campaigns', 'ads', 'promotions', 'popup', 'banners', 'کیمپین', 'اشتہارات'],
    hideInProfessionalNav: true,
  },
  {
    id: 'advertisements',
    classicCategory: 'ads',
    proCategory: 'jobs-ads-control-center',
    label: 'Ad Hub & Banner Slots',
    description: 'Manage creative campaigns, approval queue, placement timeline, performance and the active ad rate card. Finance permission is required for pricing and campaign configuration.',
    urdu: 'اشتہاری بینر سلاٹس',
    classicSubTabUrdu: 'بینر سلاٹس',
    icon: Layers,
    keywords: ['advertisements', 'ad hub', 'slots', 'banners', 'approvals', 'بینر', 'سلاٹس'],
    hideInProfessionalNav: true,
  },
  {
    id: 'landing-customizer',
    classicCategory: 'ads',
    proCategory: 'jobs-ads-control-center',
    label: 'Landing Page Customizer',
    description: 'Customize homepage sections, job-card design, banners and landing-page layout.',
    urdu: 'ہوم پیج بینر ڈیزائنر',
    classicSubTabUrdu: 'ہوم پیج بینرز',
    icon: Edit3,
    keywords: ['landing', 'homepage', 'hero', 'customizer', 'cards', 'theme', 'ہوم پیج'],
    hideInProfessionalNav: true,
  },

  // 5. Finance & Payments
  {
    id: 'pricing-controller',
    classicCategory: 'payments',
    proCategory: 'jobs-ads-control-center',
    label: 'Universal Pricing Controller',
    description: 'Manage job-posting, subscription and CV rates. Active ad campaign rates are managed separately in Ad Hub.',
    urdu: 'تمام فیسیں اور اشتہارات ریٹ',
    icon: DollarSign,
    badge: 'NEW',
    isNew: true,
    keywords: ['pricing', 'rates', 'packages', 'subscription', 'plans', 'tiers', 'پیکیجز', 'ریٹ', 'فیسیں'],
    hideInProfessionalNav: true,
  },
  {
    id: 'cv-settings',
    classicCategory: 'payments',
    proCategory: 'finance-payments',
    label: 'CV Management & Entitlements',
    description: 'Manage CV designs, package quotas, export permissions, watermark and subscription CV benefits.',
    urdu: 'سی وی مینجمنٹ',
    icon: FileText,
    keywords: ['cv', 'resume', 'curriculum vitae', 'cv packages', 'cv quotas', 'watermark', 'ats export', 'سی وی', 'ریزیومے'],
  },
  {
    id: 'admin-payment-methods',
    classicCategory: 'payments',
    proCategory: 'finance-payments',
    label: 'Manual Payment Accounts & Proof Setup',
    description: 'Configure payment account details and receipt-proof requirements.',
    classicSubTabLabel: () => '💳 Manual Payment Accounts & Proof Setup',
    urdu: 'ایڈمن کے ادائیگی اکاؤنٹس اور رسید کی تصدیق',
    classicSubTabUrdu: 'ایڈمن ادائیگی اکاؤنٹس',
    icon: CreditCard,
    badge: 'NEW',
    isNew: true,
    keywords: ['easypaisa', 'jazzcash', 'bank', 'payment methods', 'accounts', 'wallet', 'ایزی پیسہ', 'جاز کیش']
  },
  {
    id: 'payment-proofs',
    classicCategory: 'payments',
    proCategory: 'finance-payments',
    label: 'Payment Receipts Verification',
    description: 'Review submitted receipts and approve or reject pending payment transactions.',
    classicSubTabLabel: (c) => `Receipt Proofs Verification (${c.pendingProofsCount})`,
    urdu: 'رسیدوں کی تصدیق',
    icon: Receipt,
    badge: (c) => `${c.pendingProofsCount} Proofs`,
    keywords: ['receipts', 'proofs', 'verify', 'transactions', 'deposits', 'payments', 'رسید', 'تصدیق']
  },
  {
    id: 'fee-management',
    classicCategory: 'payments',
    proCategory: 'jobs-ads-control-center',
    label: 'Category Fees & Pricing',
    description: 'Set category posting fees, employer exemptions and individual job fee waivers.',
    urdu: 'پوسٹنگ فیس اور رعایتیں',
    classicSubTabUrdu: 'پوسٹنگ فیس',
    icon: DollarSign,
    keywords: ['fee', 'fees', 'waivers', 'exemptions', 'category fees', 'discount', 'فیس', 'رعایت'],
    hideInProfessionalNav: true,
  },
  {
    id: 'fee-logs',
    classicCategory: 'payments',
    proCategory: 'jobs-ads-control-center',
    label: 'Per-Job Fee Transaction Logs',
    description: 'Review per-job posting fee records and transaction history.',
    classicSubTabLabel: (c) => `Per-Job Fee Logs (${c.feeLogsCount})`,
    urdu: 'فیس لین دین کا مکمل ریکارڈ',
    classicSubTabUrdu: 'فیس لین دین',
    icon: Receipt,
    badge: (c) => `${c.feeLogsCount} Records`,
    keywords: ['fee logs', 'ledger', 'transactions', 'job fees', 'billing', 'ریکارڈ'],
    hideInProfessionalNav: true,
  },
  {
    id: 'currency-forex',
    classicCategory: 'payments',
    proCategory: 'finance-payments',
    label: 'Multi-Currency & Forex',
    description: 'Manage supported currencies and exchange-rate settings.',
    urdu: 'کرنسی ایکسچینج ریٹس',
    classicSubTabUrdu: 'کرنسی ایکسچینج',
    icon: Coins,
    keywords: ['currency', 'forex', 'exchange', 'pkr', 'usd', 'aed', 'sar', 'کرنسی']
  },

  // 6. Users, KYC & Support
  {
    id: 'user-audit',
    classicCategory: 'users',
    proCategory: 'users-kyc-support',
    label: 'User Directory & Profiles',
    description: 'Search user accounts, inspect profiles and manage account-level actions.',
    classicSubTabLabel: (c) => `User Directory (${c.usersCount})`,
    urdu: 'تمام صارفین کی فہرست',
    classicSubTabUrdu: 'صارفین کی فہرست',
    icon: Users,
    badge: (c) => `${c.usersCount} Users`,
    keywords: ['users', 'accounts', 'directory', 'profiles', 'members', 'roles', 'audit', 'صارفین']
  },
  {
    id: 'employer-kyc',
    classicCategory: 'users',
    proCategory: 'users-kyc-support',
    label: 'Employer KYC Verification',
    description: 'Review employer identity and company verification requests.',
    classicSubTabLabel: (c) => `Employer KYC Verification ${c.kycBadgeText.startsWith('⏳') ? '(Loading...)' : c.kycBadgeText.startsWith('⚠️') ? '(Error loading)' : `(${c.kycPendingCount ?? 0})`}`,
    urdu: 'کمپنی شناختی تصدیق',
    classicSubTabUrdu: 'شناختی تصدیق',
    icon: BadgeCheck,
    badge: (c) => c.kycBadgeText,
    keywords: ['kyc', 'employer', 'verification', 'company', 'badge', 'ntn', 'secp', 'شناختی']
  },
  {
    id: 'subscribers',
    classicCategory: 'users',
    proCategory: 'users-kyc-support',
    label: 'Paid Subscribers',
    description: 'View paid members, subscription status, contact details and expiry.',
    classicSubTabLabel: (c) => `Paid Subscribers (${c.subscribersCount})`,
    urdu: 'سبسکرائبرز',
    icon: DollarSign,
    badge: (c) => `${c.subscribersCount} Members`,
    keywords: ['subscribers', 'memberships', 'alerts', 'premium', 'vip', 'سبسکرائبرز']
  },
  {
    id: 'chat-hub',
    classicCategory: 'users',
    proCategory: 'users-kyc-support',
    label: 'User Support Chat Hub',
    description: 'Respond to user support conversations and manage incoming chats.',
    classicSubTabLabel: (c) => `User Support Chat Hub (${c.chatMessagesCount})`,
    urdu: 'چیٹ سپورٹ ان باکس',
    classicSubTabUrdu: 'چیٹ ان باکس',
    icon: MessageSquare,
    badge: (c) => `${c.chatMessagesCount} Chats`,
    keywords: ['chat', 'inbox', 'support', 'messages', 'helpdesk', 'reply', 'چیٹ', 'سپورٹ']
  },

  // 7. Communication & Alerts
  {
    id: 'whatsapp-manager',
    classicCategory: 'alerts',
    proCategory: 'communication-alerts',
    label: 'WhatsApp Alerts & Proofs Hub',
    description: 'Manage WhatsApp alerts, support widget details and group/contact settings.',
    classicSubTabLabel: () => '💬 WhatsApp Support & Alerts Hub',
    urdu: 'واٹس ایپ الرٹس مینجر',
    classicSubTabUrdu: 'واٹس ایپ الرٹس',
    icon: MessageSquare,
    keywords: ['whatsapp', 'wa', 'alerts', 'group link', 'sticky button', 'support', 'واٹس ایپ']
  },
  {
    id: 'broadcast-center',
    classicCategory: 'alerts',
    proCategory: 'communication-alerts',
    label: 'Broadcast Campaigns (Email/SMS)',
    description: 'Create and manage email/SMS broadcast campaigns and provider settings.',
    classicSubTabLabel: () => '📣 Email & WhatsApp Broadcasts',
    urdu: 'براڈکاسٹ پیغامات',
    classicSubTabUrdu: 'براڈکاسٹ میسجز',
    icon: Send,
    keywords: ['broadcast', 'email', 'sms', 'campaigns', 'templates', 'providers', 'براڈکاسٹ']
  },
  {
    id: 'bulk-notifications',
    classicCategory: 'alerts',
    proCategory: 'communication-alerts',
    label: 'Pro Bulk Notification Tool',
    description: 'Send bulk portal notifications to selected user groups.',
    classicSubTabLabel: () => '🚀 Pro Bulk Notification Tool',
    urdu: 'بلک نوٹیفکیشنز',
    icon: Send,
    keywords: ['bulk', 'notifications', 'push', 'mass alert', 'نوٹیفکیشنز']
  },

  // 8. Platform Settings & Data
  {
    id: 'locations-manager',
    classicCategory: 'settings',
    proCategory: 'platform-settings-data',
    label: 'Cities & Provinces Manager',
    description: 'Manage available cities, provinces and location catalogue entries.',
    classicSubTabLabel: () => '📍 Cities & Provinces Manager',
    urdu: 'شہروں اور صوبوں کی فہرست',
    icon: MapPin,
    keywords: ['location', 'locations', 'cities', 'city', 'province', 'provinces', 'districts', 'pakistan', 'شہر', 'صوبے']
  },
  {
    id: 'apply-settings',
    classicCategory: 'settings',
    proCategory: 'platform-settings-data',
    label: 'Apply Button & Form Flow',
    description: 'Configure application buttons, application flow and employer-facing form behaviour.',
    urdu: 'اپلائی بٹن اور سوالات',
    icon: FileText,
    badge: 'NEW',
    isNew: true,
    keywords: ['apply', 'application', 'form', 'flow', 'button', 'eligibility', 'اپلائی']
  },
  {
    id: 'modal-content-manager',
    classicCategory: 'settings',
    proCategory: 'platform-settings-data',
    label: 'Modals & Popups Content Manager',
    description: 'Edit modal, popup and announcement text displayed across the portal.',
    urdu: 'پاپ اپس اور موڈالز مینیجر',
    icon: Sliders,
    badge: 'NEW',
    isNew: true,
    keywords: ['modal', 'modals', 'popup', 'popups', 'content', 'copy', 'dialogs', 'پاپ اپس']
  },
  {
    id: 'job-visibility',
    classicCategory: 'settings',
    proCategory: 'platform-settings-data',
    label: 'Job Visibility Manager',
    description: 'Control which job fields are visible to public, free and premium users.',
    urdu: 'ملازمت کی نمائش',
    icon: ShieldCheck,
    keywords: ['visibility', 'rules', 'masking', 'defaults', 'public', 'نمائش']
  },
  {
    id: 'seo-config',
    classicCategory: 'settings',
    proCategory: 'platform-settings-data',
    label: 'Google Search SEO & Meta Tags',
    description: 'Manage search metadata, SEO settings and structured page information.',
    classicSubTabLabel: () => '🌐 Google Search SEO & Meta Tags',
    urdu: 'گوگل ایس ای او اور میٹا ٹیگز',
    classicSubTabUrdu: 'گوگل ایس ای او',
    icon: Globe,
    keywords: ['seo', 'google', 'meta', 'sitemap', 'robots', 'json-ld', 'search', 'ایس ای او']
  },
  {
    id: 'admin-security',
    classicCategory: 'settings',
    proCategory: 'platform-settings-data',
    label: 'Administrator Security',
    description: 'Update the signed-in administrator password and review credential security.',
    urdu: 'ایڈمن سیکیورٹی',
    icon: ShieldCheck,
    keywords: ['admin security', 'password', 'credentials', 'administrator', 'security']
  },
  {
    id: 'settings',
    classicCategory: 'settings',
    proCategory: 'platform-settings-data',
    label: 'Global Master Switches',
    description: 'Control site-wide feature switches and enable or disable major portal capabilities.',
    urdu: 'ماسٹر سیٹنگز اور فیس',
    classicSubTabUrdu: 'ماسٹر سیٹنگز',
    icon: Settings,
    keywords: ['settings', 'switches', 'feature flags', 'password', 'whatsapp', 'locations', 'master', 'سیٹنگز']
  },
  {
    id: 'form-customizer',
    classicCategory: 'settings',
    proCategory: 'platform-settings-data',
    label: 'Registration Form Customizer',
    description: 'Configure registration form fields, visibility and required/optional rules.',
    urdu: 'فارم فیلڈز سیٹنگ',
    classicSubTabUrdu: 'فارم سیٹنگز',
    icon: Edit3,
    keywords: ['form', 'registration', 'fields', 'customizer', 'signup', 'فارم']
  },
  {
    id: 'data-backup',
    classicCategory: 'settings',
    proCategory: 'platform-settings-data',
    label: 'Data Vault & CSV Export',
    description: 'Export, restore and manage selected platform data snapshots.',
    classicSubTabLabel: () => 'Data Vault & CSV Backup',
    urdu: 'ڈیٹا بیک اپ اور ایکسپورٹ',
    classicSubTabUrdu: 'بیک اپ اور ایکسپورٹ',
    icon: Database,
    keywords: ['backup', 'export', 'csv', 'json', 'snapshot', 'vault', 'restore', 'بیک اپ']
  }
];

export const ADMIN_TAB_CATEGORIES: Record<string, AdminCategory> = (() => {
  const map: Record<string, AdminCategory> = {};
  for (const mod of ADMIN_NAVIGATION_MODULES) {
    map[mod.id] = mod.classicCategory;
    if (mod.aliases) {
      for (const alias of mod.aliases) {
        map[alias] = mod.classicCategory;
      }
    }
  }
  return map;
})();

export function getAdminModuleDefinition(tabId: string): AdminNavModuleDefinition | undefined {
  const canonical = resolveCanonicalAdminTab(tabId);
  return ADMIN_NAVIGATION_MODULES.find((m) => m.id === canonical);
}

export function getAdminNavModeStorageKey(adminId?: string | null): string | null {
  const cleanId = typeof adminId === 'string' ? adminId.trim() : '';
  if (!cleanId) return null;
  return `admin_nav_mode_${cleanId}`;
}

export function resolveStoredAdminNavMode(
  adminId?: string | null,
  storage?: Pick<Storage, 'getItem'> | null
): AdminNavMode {
  const key = getAdminNavModeStorageKey(adminId);
  if (!key) return 'classic';
  try {
    const store = storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
    if (!store) return 'classic';
    const raw = store.getItem(key);
    return raw === 'professional' ? 'professional' : 'classic';
  } catch {
    return 'classic';
  }
}

export function persistAdminNavMode(
  adminId: string | undefined | null,
  mode: AdminNavMode,
  storage?: Pick<Storage, 'setItem'> | null
): boolean {
  const key = getAdminNavModeStorageKey(adminId);
  if (!key) return false;
  const safeMode: AdminNavMode = mode === 'professional' ? 'professional' : 'classic';
  try {
    const store = storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
    if (!store) return false;
    store.setItem(key, safeMode);
    return true;
  } catch {
    return false;
  }
}

export interface AllModulesMenuItem {
  id: string;
  label: string;
  urdu: string;
  description?: string;
  icon: any;
  badge?: string;
}

export interface AllModulesMenuGroup<K extends string = AdminCategory> {
  catKey: K;
  catTitle: string;
  items: AllModulesMenuItem[];
}

export function resolveModuleBadge(
  mod: AdminNavModuleDefinition,
  counts: AdminNavCounts
): string | undefined {
  if (typeof mod.badge === 'function') return mod.badge(counts);
  return mod.badge;
}

export const CLASSIC_CATEGORY_MODULE_ORDER: Record<AdminCategory, AdminCanonicalTabId[]> = {
  jobs: ['jobs', 'pending', 'add-job', 'ai-enhancer'],
  scraper: ['scraper'],
  ads: ['campaign-center', 'advertisements', 'landing-customizer'],
  payments: [
    'pricing-controller',
    'cv-settings',
    'admin-payment-methods',
    'payment-proofs',
    'fee-management',
    'fee-logs',
    'currency-forex'
  ],
  users: ['user-audit', 'employer-kyc', 'subscribers', 'chat-hub'],
  alerts: ['whatsapp-manager', 'broadcast-center', 'bulk-notifications'],
  settings: [
    'locations-manager',
    'apply-settings',
    'modal-content-manager',
    'job-visibility',
    'seo-config',
    'settings',
    'form-customizer',
    'activity-logs',
    'data-backup',
    'admin-security',
    'analytics'
  ]
};

export function buildAllModulesMenuGroups(counts: AdminNavCounts): AllModulesMenuGroup[] {
  return CLASSIC_ADMIN_CATEGORIES.map((cat) => {
    const orderedIds = CLASSIC_CATEGORY_MODULE_ORDER[cat.id] || [];
    const items = orderedIds
      .map((id) => ADMIN_NAVIGATION_MODULES.find((m) => m.id === id))
      .filter((m): m is AdminNavModuleDefinition => Boolean(m))
      .map((m) => {
        const badge = resolveModuleBadge(m, counts);
        return {
          id: m.id,
          label: m.allModulesLabel ? m.allModulesLabel(counts) : m.label,
          urdu: m.allModulesUrdu || m.urdu,
          icon: m.icon,
          ...(badge ? { badge } : {})
        };
      });
    return {
      catKey: cat.id,
      catTitle: cat.allModulesTitle,
      items
    };
  });
}

export function buildProfessionalAllModulesMenuGroups(
  counts: AdminNavCounts
): AllModulesMenuGroup<ProAdminCategoryId>[] {
  return PROFESSIONAL_ADMIN_CATEGORIES.map((cat) => {
    const items = ADMIN_NAVIGATION_MODULES.filter((m) => m.proCategory === cat.id && !m.hideInProfessionalNav).map((m) => {
      const badge = resolveModuleBadge(m, counts);
      return {
        id: m.id,
        label: m.allModulesLabel ? m.allModulesLabel(counts) : m.label,
        urdu: m.allModulesUrdu || m.urdu,
        icon: m.icon,
        ...(badge ? { badge } : {})
      };
    });
    return {
      catKey: cat.id,
      catTitle: cat.label,
      items
    };
  });
}

export interface ClassicSubTabItem {
  id: string;
  label: string;
  urdu: string;
  icon: any;
  badge?: string | number;
  isNew?: boolean;
}

export function getClassicCategorySubTabs(
  category: AdminCategory,
  counts: AdminNavCounts,
  canAccessTab: (tabId: string) => boolean
): ClassicSubTabItem[] {
  const orderedIds = CLASSIC_CATEGORY_MODULE_ORDER[category] || [];
  return orderedIds
    .filter((id) => canAccessTab(id))
    .map((id) => ADMIN_NAVIGATION_MODULES.find((m) => m.id === id))
    .filter((m): m is AdminNavModuleDefinition => Boolean(m))
    .map((m) => ({
      id: m.id,
      label: m.classicSubTabLabel ? m.classicSubTabLabel(counts) : m.label,
      urdu: m.classicSubTabUrdu || m.urdu,
      icon: m.icon,
      badge: m.classicSubTabBadge ? m.classicSubTabBadge(counts) : undefined,
      isNew: m.isNew
    }));
}

export interface ProMenuModuleItem {
  id: AdminCanonicalTabId;
  label: string;
  urdu: string;
  description: string;
  icon: any;
  badge?: string;
  isNew?: boolean;
  proCategory: ProAdminCategoryId;
  classicCategory: AdminCategory;
}

export interface ProMenuCategoryGroup {
  id: ProAdminCategoryId;
  label: string;
  urdu: string;
  description: string;
  icon: any;
  items: ProMenuModuleItem[];
}

export function matchesAdminModuleSearch(
  mod: AdminNavModuleDefinition,
  rawQuery: string
): boolean {
  const q = rawQuery.toLowerCase().trim();
  if (!q) return true;

  const proCat = PROFESSIONAL_ADMIN_CATEGORIES.find((c) => c.id === mod.proCategory);
  const classicCat = CLASSIC_ADMIN_CATEGORIES.find((c) => c.id === mod.classicCategory);

  const haystack = [
    mod.id,
    mod.label,
    mod.urdu,
    mod.description,
    mod.allModulesUrdu || '',
    mod.classicSubTabUrdu || '',
    ...(mod.aliases || []),
    ...mod.keywords,
    proCat?.label || '',
    proCat?.urdu || '',
    classicCat?.label || '',
    classicCat?.allModulesTitle || '',
    classicCat?.urdu || ''
  ]
    .join(' ')
    .toLowerCase();

  const tokens = q.split(/\s+/).filter(Boolean);
  return tokens.every((tok) => haystack.includes(tok));
}

export function buildProfessionalMenuCategories(
  counts: AdminNavCounts,
  canAccessTab: (tabId: string) => boolean,
  searchQuery = ''
): ProMenuCategoryGroup[] {
  return PROFESSIONAL_ADMIN_CATEGORIES.map((cat) => {
    const items: ProMenuModuleItem[] = ADMIN_NAVIGATION_MODULES.filter(
      (mod) =>
        mod.proCategory === cat.id &&
        !mod.hideInProfessionalNav &&
        canAccessTab(mod.id) &&
        matchesAdminModuleSearch(mod, searchQuery)
    ).map((mod) => ({
      id: mod.id,
      label: mod.label,
      urdu: mod.urdu,
      description: mod.description,
      icon: mod.icon,
      badge: resolveModuleBadge(mod, counts),
      isNew: mod.isNew,
      proCategory: mod.proCategory,
      classicCategory: mod.classicCategory
    }));

    return {
      id: cat.id,
      label: cat.label,
      urdu: cat.urdu,
      description: cat.description,
      icon: cat.icon,
      items
    };
  }).filter((group) => group.items.length > 0);
}

export function searchAdminNavigationModules(
  query: string,
  counts: AdminNavCounts,
  canAccessTab: (tabId: string) => boolean
): ProMenuModuleItem[] {
  return ADMIN_NAVIGATION_MODULES.filter(
    (mod) => !mod.hideInProfessionalNav && canAccessTab(mod.id) && matchesAdminModuleSearch(mod, query)
  ).map((mod) => ({
    id: mod.id,
    label: mod.label,
    urdu: mod.urdu,
    description: mod.description,
    icon: mod.icon,
    badge: resolveModuleBadge(mod, counts),
    isNew: mod.isNew,
    proCategory: mod.proCategory,
    classicCategory: mod.classicCategory
  }));
}

interface AdminNavigationModeToggleProps {
  mode: AdminNavMode;
  onChangeMode: (nextMode: AdminNavMode) => void;
}

export const AdminNavigationModeToggle: React.FC<AdminNavigationModeToggleProps> = ({
  mode,
  onChangeMode
}) => {
  return (
    <div
      role="group"
      aria-label="Admin Navigation Mode"
      className="inline-flex items-center p-0.5 sm:p-1 rounded-lg sm:rounded-xl bg-slate-950/90 border border-slate-800 shrink-0"
    >
      <button
        type="button"
        onClick={() => onChangeMode('classic')}
        aria-pressed={mode === 'classic'}
        className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-md sm:rounded-lg text-[10px] sm:text-xs font-bold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
          mode === 'classic'
            ? 'bg-amber-500 text-slate-950 shadow-sm font-black'
            : 'text-slate-300 hover:text-white'
        }`}
      >
        Classic Menu
      </button>
      <button
        type="button"
        onClick={() => onChangeMode('professional')}
        aria-pressed={mode === 'professional'}
        className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-md sm:rounded-lg text-[10px] sm:text-xs font-bold whitespace-nowrap shrink-0 transition-all cursor-pointer flex items-center gap-1 ${
          mode === 'professional'
            ? 'bg-emerald-500 text-slate-950 shadow-sm font-black'
            : 'text-slate-300 hover:text-white'
        }`}
      >
        <LayoutGrid className="w-3 h-3 shrink-0" />
        <span>Professional Menu</span>
      </button>
    </div>
  );
};

interface AdminProfessionalSidebarProps {
  activeTab: string;
  counts: AdminNavCounts;
  canAccessTab: (tabId: string) => boolean;
  onSelectTab: (tabId: string) => void;
  onOpenAllModules: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export const AdminProfessionalSidebar: React.FC<AdminProfessionalSidebarProps> = ({
  activeTab,
  counts,
  canAccessTab,
  onSelectTab,
  onOpenAllModules,
  isCollapsed,
  onToggleCollapse
}) => {
  const canonicalTab = resolveCanonicalAdminTab(activeTab);
  const activeDef = getAdminModuleDefinition(canonicalTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategoryId, setExpandedCategoryId] = useState<ProAdminCategoryId | null>(activeDef?.proCategory || 'overview-analytics');

  useEffect(() => {
    if (activeDef?.proCategory) {
      setExpandedCategoryId(activeDef.proCategory);
    }
  }, [activeDef?.proCategory]);

  const categories = useMemo(
    () => buildProfessionalMenuCategories(counts, canAccessTab, searchQuery),
    [counts, canAccessTab, searchQuery]
  );

  const toggleCategory = (catId: ProAdminCategoryId) => {
    setExpandedCategoryId((prev) => (prev === catId ? null : catId));
  };

  return (
    <aside
      aria-label="Professional Admin Sidebar"
      className={`hidden lg:flex flex-col shrink-0 bg-slate-900 border border-slate-800 rounded-2xl transition-all duration-200 sticky top-4 max-h-[calc(100vh-2rem)] overflow-hidden ${
        isCollapsed ? 'w-[74px]' : 'w-72'
      }`}
    >
      {/* Sidebar Header */}
      <div className="p-3 border-b border-slate-800 flex items-center justify-between gap-2">
        {!isCollapsed && (
          <div className="min-w-0">
            <p className="text-xs font-black text-white truncate">Admin Workspace</p>
            <p className="text-[11px] text-slate-400 truncate">Organized admin workspace</p>
          </div>
        )}
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="p-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 cursor-pointer shrink-0 mx-auto lg:mx-0"
        >
          {isCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        </button>
      </div>

      {/* Search Bar (Expanded) / Expand-to-search (Collapsed) */}
      {!isCollapsed ? (
        <div className="p-2.5 border-b border-slate-800/80">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search modules or keywords..."
              aria-label="Search professional admin modules"
              className="w-full pl-8 pr-7 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear sidebar search"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="p-2 border-b border-slate-800/80 flex justify-center">
          <button
            type="button"
            onClick={onToggleCollapse}
            title="Expand sidebar to search modules"
            aria-label="Expand sidebar to search modules"
            className="p-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-amber-400 border border-slate-800 cursor-pointer"
          >
            <Search className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Categorized Scrollable Navigation */}
      <nav aria-label="Admin Modules Navigation" className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {categories.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-slate-400">
            {isCollapsed ? '—' : 'No matching modules available for your role.'}
          </div>
        ) : (
          categories.map((cat) => {
            const CatIcon = cat.icon;
            const isSearching = searchQuery.trim().length > 0;
            const isExpanded = isSearching || expandedCategoryId === cat.id;
            const hasActiveChild = cat.items.some((item) => item.id === canonicalTab);

            if (isCollapsed) {
              return (
                <div key={cat.id} className="space-y-1 pb-1.5 border-b border-slate-800/60 last:border-b-0">
                  {cat.items.map((item) => {
                    const ItemIcon = item.icon;
                    const isCurrent = item.id === canonicalTab;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onSelectTab(item.id)}
                        title={`${cat.label} — ${item.label}: ${item.description}`}
                        aria-label={item.label}
                        aria-current={isCurrent ? 'page' : undefined}
                        className={`w-full flex items-center justify-center p-2.5 rounded-xl transition-all cursor-pointer ${
                          isCurrent
                            ? 'bg-amber-500 text-slate-950 shadow-md'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800'
                        }`}
                      >
                        <ItemIcon className="w-4 h-4 shrink-0" />
                      </button>
                    );
                  })}
                </div>
              );
            }

            return (
              <div key={cat.id} className="rounded-xl border border-slate-800/70 bg-slate-950/40 overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleCategory(cat.id)}
                  aria-expanded={isExpanded}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-xs font-bold transition-colors cursor-pointer ${
                    hasActiveChild
                      ? 'bg-slate-800/90 text-amber-300'
                      : 'text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <CatIcon className={`w-4 h-4 shrink-0 ${hasActiveChild ? 'text-amber-400' : 'text-slate-400'}`} />
                    <div className="min-w-0">
                      <span className="block truncate">{cat.label}</span>
                      <span className="block text-[9px] leading-tight text-slate-500 truncate">{cat.description}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] font-mono tabular-nums text-slate-400">
                      {cat.items.length}
                    </span>
                    {isExpanded ? (
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div className="p-1.5 space-y-1 border-t border-slate-800/70">
                    {cat.items.map((item) => {
                      const ItemIcon = item.icon;
                      const isCurrent = item.id === canonicalTab;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => onSelectTab(item.id)}
                          aria-current={isCurrent ? 'page' : undefined}
                          className={`w-full flex items-start justify-between gap-2 px-2.5 py-2 rounded-lg text-left transition-all cursor-pointer ${
                            isCurrent
                              ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                              : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                          }`}
                        >
                          <div className="flex items-start gap-2 min-w-0">
                            <ItemIcon
                              className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${
                                isCurrent ? 'text-slate-950' : 'text-amber-400'
                              }`}
                            />
                            <div className="min-w-0">
                              <span className="block text-[11px] leading-snug font-bold truncate">
                                {item.label}
                              </span>
                              <span
                                className={`block text-[10px] leading-tight truncate ${
                                  isCurrent ? 'text-slate-900 font-semibold' : 'text-slate-400'
                                }`}
                              >
                                {item.description}
                              </span>
                            </div>
                          </div>
                          {item.badge && (
                            <span
                              className={`text-[9px] font-mono tabular-nums px-1.5 py-0.5 rounded shrink-0 font-bold ${
                                isCurrent
                                  ? 'bg-slate-950 text-amber-300'
                                  : 'bg-slate-900 text-amber-300 border border-slate-800'
                              }`}
                            >
                              {item.badge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </nav>

      {/* Footer Launcher */}
      <div className="p-2.5 border-t border-slate-800 bg-slate-950/60">
        <button
          type="button"
          onClick={onOpenAllModules}
          aria-label="Open all modules menu"
          className="w-full flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-400 border border-amber-500/30 text-xs font-bold whitespace-nowrap cursor-pointer"
        >
          <MoreVertical className="w-3.5 h-3.5 shrink-0" />
          {!isCollapsed && <span>All Modules Matrix</span>}
        </button>
      </div>
    </aside>
  );
};

interface AdminProfessionalMobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: string;
  counts: AdminNavCounts;
  canAccessTab: (tabId: string) => boolean;
  onSelectTab: (tabId: string) => void;
  onOpenAllModules: () => void;
}

export const AdminProfessionalMobileDrawer: React.FC<AdminProfessionalMobileDrawerProps> = ({
  isOpen,
  onClose,
  activeTab,
  counts,
  canAccessTab,
  onSelectTab,
  onOpenAllModules
}) => {
  const canonicalTab = resolveCanonicalAdminTab(activeTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategoryId, setExpandedCategoryId] = useState<ProAdminCategoryId | null>(null);

  useEffect(() => {
    const activeDef = getAdminModuleDefinition(canonicalTab);
    if (activeDef?.proCategory) setExpandedCategoryId(activeDef.proCategory);
  }, [canonicalTab]);

  const categories = useMemo(
    () => buildProfessionalMenuCategories(counts, canAccessTab, searchQuery),
    [counts, canAccessTab, searchQuery]
  );

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Professional Admin Mobile Navigation Drawer"
      className="lg:hidden fixed inset-0 z-50 flex"
    >
      <div
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative z-10 w-80 max-w-[88vw] h-full bg-slate-900 border-r border-slate-800 flex flex-col shadow-2xl overflow-x-hidden">
        {/* Drawer Header */}
        <div className="p-3.5 border-b border-slate-800 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-sm font-black text-white truncate">Professional Admin Menu</h3>
            <p className="text-[11px] text-slate-400 truncate">Choose a category, then a module</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation drawer"
            className="p-2 rounded-xl bg-slate-950 text-slate-300 hover:text-white border border-slate-800 cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Searchable Module Input */}
        <div className="p-3 border-b border-slate-800">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search modules, purpose or category..."
              aria-label="Search modules in mobile drawer"
              className="w-full pl-9 pr-8 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear mobile search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Categories & Modules */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 space-y-3">
          {categories.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-400">
              No matching modules found.
            </div>
          ) : (
            categories.map((cat) => {
              const CatIcon = cat.icon;
              return (
                <div key={cat.id} className="rounded-xl border border-slate-800 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setExpandedCategoryId((prev) => (prev === cat.id ? null : cat.id))}
                    aria-expanded={searchQuery.trim().length > 0 || expandedCategoryId === cat.id}
                    className="w-full flex items-center justify-between gap-2 px-3 py-3 text-left bg-slate-950/70"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <CatIcon className="w-4 h-4 text-amber-400 shrink-0" />
                      <div className="min-w-0">
                        <span className="block text-xs font-black text-amber-300 truncate">{cat.label}</span>
                        <span className="block text-[10px] text-slate-500 line-clamp-2">{cat.description}</span>
                      </div>
                    </div>
                    <span className="flex items-center gap-1.5 shrink-0 text-[10px] text-slate-400 tabular-nums">
                      {cat.items.length} modules
                      {(searchQuery.trim().length > 0 || expandedCategoryId === cat.id)
                        ? <ChevronDown className="w-3.5 h-3.5" />
                        : <ChevronRight className="w-3.5 h-3.5" />}
                    </span>
                  </button>
                  {(searchQuery.trim().length > 0 || expandedCategoryId === cat.id) && (
                  <div className="p-2 space-y-1">
                    {cat.items.map((item) => {
                      const ItemIcon = item.icon;
                      const isCurrent = item.id === canonicalTab;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            onSelectTab(item.id);
                            onClose();
                          }}
                          aria-current={isCurrent ? 'page' : undefined}
                          className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-left border transition-all cursor-pointer ${
                            isCurrent
                              ? 'bg-amber-500 text-slate-950 border-amber-400 font-black'
                              : 'bg-slate-950/70 text-slate-200 border-slate-800 hover:bg-slate-800'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <ItemIcon
                              className={`w-4 h-4 shrink-0 ${
                                isCurrent ? 'text-slate-950' : 'text-amber-400'
                              }`}
                            />
                            <div className="min-w-0">
                              <span className="block text-xs font-bold truncate">{item.label}</span>
                              <span
                                className={`block text-[10px] truncate ${
                                  isCurrent ? 'text-slate-900' : 'text-slate-400'
                                }`}
                              >
                                {item.description}
                              </span>
                            </div>
                          </div>
                          {item.badge && (
                            <span
                              className={`text-[10px] font-mono tabular-nums px-1.5 py-0.5 rounded shrink-0 font-bold ${
                                isCurrent
                                  ? 'bg-slate-950 text-amber-300'
                                  : 'bg-slate-900 text-amber-300 border border-slate-800'
                              }`}
                            >
                              {item.badge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/80 flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenAllModules();
            }}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-amber-500 text-slate-950 font-black text-xs cursor-pointer"
          >
            <MoreVertical className="w-3.5 h-3.5" />
            <span>All Modules</span>
          </button>
        </div>
      </div>
    </div>
  );
};
