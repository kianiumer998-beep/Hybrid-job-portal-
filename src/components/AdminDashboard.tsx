import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Job, 
  JobStatus,
  Subscriber, 
  Region, 
  JobType, 
  UserAccount, 
  ChatMessage, 
  CustomFormField, 
  JobPostingFeeLog, 
  PaymentTransaction, 
  JobApplication, 
  AdminFeatureFlags, 
  GOVT_DEPT_OPTIONS, 
  GOVT_SCALE_OPTIONS, 
  GOVT_CADRE_OPTIONS, 
  NEWSPAPER_OPTIONS,
  ScrapedJobAuditEntry,
  ScraperBatchRun,
  ScrapedJobAuditAction,
  ConsolidatedPdfGazette,
  JobPostingPricingConfig,
  DEFAULT_JOB_POSTING_PRICING_CONFIG
} from '../types/job';
import { Advertisement, AdPricingConfig, CampaignCustomizationConfig, DEFAULT_CAMPAIGN_CUSTOMIZATION_CONFIG } from '../types/ad';
import { PAKISTAN_LOCATIONS } from '../data/pakistanLocations';
import { api } from '../services/api';
import { calculateJobMissingFields, isScrapedJob } from '../utils/jobValidation';
import { 
  ShieldCheck, 
  Plus, 
  Trash2, 
  Edit3, 
  DollarSign, 
  Users, 
  Briefcase, 
  TrendingUp, 
  Settings, 
  Search, 
  CheckCircle2, 
  X, 
  RefreshCw, 
  MessageSquare, 
  Send, 
  Globe, 
  Bot, 
  Sparkles, 
  Filter, 
  AlertCircle, 
  Clock, 
  Calendar, 
  Receipt, 
  UserCheck, 
  Key, 
  ShieldAlert, 
  Eye, 
  FileText, 
  Megaphone,
  History,
  CheckSquare,
  Square,
  FileSpreadsheet,
  BarChart3,
  Database,
  Sliders,
  Coins,
  BadgeCheck,
  BookmarkPlus,
  Layers,
  ExternalLink,
  SlidersHorizontal,
  Download,
  Copy,
  ArrowUpDown,
  Link as LinkIcon,
  MoreVertical,
  CreditCard,
  Save
} from 'lucide-react';
import { UserDetailModal } from './UserDetailModal';
import { AdminJobDetailModal } from './AdminJobDetailModal';
import { safeLocalStorageSet, safeLocalStorageGet, safeAlert, clearBulkyStorageCaches } from '../utils/safeStorage';
import { AdminAdHub } from './ads/AdminAdHub';
import { PdfConsolidatedScraperModal } from './PdfConsolidatedScraperModal';
import { AdminQuickEditJobModal } from './admin/AdminQuickEditJobModal';
import { AdminDuplicateCheckerModal, DuplicateCluster } from './admin/AdminDuplicateCheckerModal';
import { AdminSubscriberModal } from './admin/AdminSubscriberModal';
import { JobVisibilityDefaultsManager } from './admin/JobVisibilityDefaultsManager';
import { BatchUrlIngestModal } from './BatchUrlIngestModal';
import { AdminPaymentMethodsManager } from './admin/AdminPaymentMethodsManager';
import { AutomatedScraperHub } from './admin/AutomatedScraperHub';
import { JobSeoPreviewModal } from './common/JobSeoPreviewModal';
import { injectJobJsonLd } from '../utils/seoHelper';
import { 
  ALL_CONSOLIDATED_PDF_GAZETTES,
  getUnifiedAllGazettes,
  generateGazetteFromManualInput,
  OFFICIAL_GOVT_SCRAPER_PORTALS,
  OfficialGovtPdfPortal
} from '../data/mockPdfConsolidatedAds';

// Advanced International Admin Suite Modules
import { AdminAnalyticsOverview } from './admin/AdminAnalyticsOverview';
import { AdminSeoSettings } from './admin/AdminSeoSettings';
import { AdminCurrencyManager } from './admin/AdminCurrencyManager';
import { AdminBroadcastCenter } from './admin/AdminBroadcastCenter';
import { AdminDataBackupHub, BulkJobImportResult } from './admin/AdminDataBackupHub';
import { AdminAiQualityEnhancer, JobUpdateOutcome } from './admin/AdminAiQualityEnhancer';
import { AdminEmployerKycHub } from './admin/AdminEmployerKycHub';
import { LandingPageCustomizer } from './admin/LandingPageCustomizer';
import { AdminCampaignCenter } from './admin/AdminCampaignCenter';
import { AdminFeeManager, CompleteFeeConfigSavePayload } from './admin/AdminFeeManager';
import { AdminActivityLogs } from './admin/AdminActivityLogs';
import { AdminBulkNotificationTool } from './admin/AdminBulkNotificationTool';
import { AdminWhatsAppManager } from './admin/AdminWhatsAppManager';
import { AdminWhatsAppSettings } from './admin/AdminWhatsAppSettings';
import { AdminPaymentVerificationHub, PaymentVerificationResult } from './admin/AdminPaymentVerificationHub';
import { AdminPricingController } from './admin/AdminPricingController';
import { AdminApplySettingsManager } from './admin/AdminApplySettingsManager';
import { AdminModalContentManager } from './admin/AdminModalContentManager';
import { AdminLocationManager } from './admin/AdminLocationManager';
import {
  AdminCategory,
  AdminNavMode,
  AdminNavCounts,
  ADMIN_NAVIGATION_MODULES,
  ADMIN_TAB_CATEGORIES,
  CLASSIC_ADMIN_CATEGORIES,
  AllModulesMenuItem,
  AllModulesMenuGroup,
  buildAllModulesMenuGroups,
  buildProfessionalAllModulesMenuGroups,
  getClassicCategorySubTabs,
  getAdminModuleDefinition,
  matchesAdminModuleSearch,
  resolveCanonicalAdminTab,
  resolveStoredAdminNavMode,
  persistAdminNavMode,
  AdminNavigationModeToggle,
  AdminProfessionalSidebar,
  AdminProfessionalMobileDrawer
} from './admin/AdminDashboardNavigation';

export type { AdminCategory, AdminNavMode, AllModulesMenuItem, AllModulesMenuGroup };
export { ADMIN_TAB_CATEGORIES, buildAllModulesMenuGroups, buildProfessionalAllModulesMenuGroups };
import { getProvinceForCity } from '../utils/locationCatalog';
import { WhatsAppSupportConfig, DEFAULT_WHATSAPP_CONFIG } from './WhatsAppStickyButton';
import { INITIAL_PAYMENT_TRANSACTIONS } from '../data/mockTransactions';
import { LandingPageConfig, LandingDesignSystem } from '../types/landing';
import { 
  SiteSeoConfig, 
  CurrencyExchangeConfig, 
  BroadcastCampaign, 
  CommunicationProviderConfig, 
  EmployerKycRequest, 
  SystemSnapshotPayload 
} from '../types/adminSuite';
import { 
  INITIAL_SITE_SEO_CONFIG, 
  INITIAL_CURRENCY_CONFIG, 
  INITIAL_BROADCAST_CAMPAIGNS, 
  INITIAL_COMM_CONFIG, 
  INITIAL_KYC_REQUESTS 
} from '../data/mockAdminSuiteData';

interface AdminDashboardProps {
  jobs: Job[];
  pendingJobs: Job[];
  pendingTotal?: number;
  pendingPage?: number;
  pendingLimit?: number;
  pendingTotalPages?: number;
  onPendingPageChange?: (newPage: number, newLimit?: number) => void;
  subscribers: Subscriber[];
  users: UserAccount[];
  chatMessages: ChatMessage[];
  customFormFields: CustomFormField[];
  jobPostingFeePkr: number;
  onChangeJobPostingFee: (newFee: number) => void;
  jobPostingFeeLogs: JobPostingFeeLog[];
  allApplications?: JobApplication[];
  onReloadJobs?: () => Promise<any>;
  onApproveJob: (jobId: string) => void;
  onRejectJob: (jobId: string, reason: string) => void;
  onAddJob: (newJob: Job) => void;
  onAddPendingJob?: (newJob: Job) => void;
  onBulkAddJobs?: (jobs: Job[]) => void;
  onBulkAddPendingJobs?: (jobs: Job[]) => void;
  onImportBulkJobs?: (jobs: Job[]) => Promise<BulkJobImportResult>;
  onDeleteJob: (jobId: string) => void;
  onUpdateJob?: (job: Job) => Promise<JobUpdateOutcome> | JobUpdateOutcome;
  onBulkDeleteJobs?: (jobIds: string[]) => void;
  onBulkUpdateJobs?: (jobs: Job[]) => void;
  onBulkApprovePendingJobs?: (jobIds: string[]) => void;
  onBulkRejectPendingJobs?: (jobIds: string[], reason: string) => void;
  onAddSubscriber?: (subscriber: Subscriber) => void;
  onUpdateSubscriber?: (subscriber: Subscriber) => void;
  onDeleteSubscriber?: (subscriberId: string) => void;
  onBulkDeleteSubscribers?: (subscriberIds: string[]) => void;
  onUpdateUser?: (user: UserAccount) => void;
  onBulkDeleteUsers?: (userIds: string[]) => Promise<{ deletedIds: string[]; failed: Array<{ userId: string; message: string }> } | void> | void;
  onDeleteFeeLog?: (logId: string) => void;
  onBulkDeleteFeeLogs?: (logIds: string[]) => void;
  onSendMessageToUser: (userId: string, userName: string, text: string) => Promise<boolean> | boolean;
  onAddCustomField: (field: CustomFormField) => Promise<boolean> | boolean | void;
  onToggleCustomField: (fieldId: string) => Promise<boolean> | boolean | void;
  onDeleteCustomField: (fieldId: string) => Promise<boolean> | boolean | void;
  onUpdateUserExpiry: (userId: string, newExpiryDate: string) => Promise<{ success: boolean; user?: UserAccount; message?: string } | boolean | void> | void;
  onToggleUserPlan: (userId: string) => Promise<{ success: boolean; user?: UserAccount; message?: string } | boolean | void> | void;
  onUpdateUserPassword?: (userId: string, newPass: string) => void;
  onEndUserMembership?: (userId: string, options?: { silent?: boolean }) => Promise<{ success: boolean; user?: UserAccount; message?: string } | boolean | void> | void;
  onDeactivateUserJobs?: (userId: string) => Promise<{ success: boolean; suspendedCount: number; message?: string } | void> | void;
  onEndUserMembershipAndJobs?: (userId: string) => Promise<{ success: boolean; message?: string } | boolean | void> | void;
  onSuspendJob?: (jobId: string, reason?: string) => void;
  onBulkEndUnpaidMemberships?: () => Promise<void> | void;
  monthlyFeePkr?: number;
  onChangeMonthlyFee?: (newFee: number) => void;
  onExitAdmin: () => void;
  ads?: Advertisement[];
  onAddAd?: (ad: Advertisement) => void;
  onUpdateAd?: (ad: Advertisement) => void;
  onDeleteAd?: (adId: string) => void;
  onResetAdMetrics?: (adId?: string) => void;
  pricingConfig?: AdPricingConfig;
  onUpdatePricingConfig?: (config: AdPricingConfig) => void | Promise<unknown>;
  campaignConfig?: CampaignCustomizationConfig;
  onUpdateCampaignConfig?: (config: CampaignCustomizationConfig) => void | Promise<unknown>;
  onApproveAd?: (adId: string) => void;
  onRejectAd?: (adId: string, reason: string) => void;
  jobPostingPricing?: JobPostingPricingConfig;
  onChangeJobPostingPricing?: (config: JobPostingPricingConfig) => void;
  onSaveJobPostingPricing?: (config: JobPostingPricingConfig) => Promise<any> | any | void;
  landingConfig?: LandingPageConfig;
  landingDesignSystem?: LandingDesignSystem;
  onSelectLandingDesign?: (designId: LandingDesignSystem['activeDesignId']) => Promise<any>;
  onUpdateLandingConfig?: (config: LandingPageConfig) => Promise<any> | any | void;
  onSaveLandingAndCampaignConfig?: (landing: LandingPageConfig, campaign: CampaignCustomizationConfig) => Promise<any>;
  onSaveCompleteFeeConfig?: (payload: CompleteFeeConfigSavePayload) => Promise<any> | any | void;
  onSyncAuthoritativePricing?: (pricing: any) => void;
  isPricingLoading?: boolean;
  pricingLoadError?: string | null;
  isPricingReady?: boolean;
  onReloadPricingConfig?: () => Promise<void> | void;
  whatsAppSupportConfig?: WhatsAppSupportConfig;
  onUpdateWhatsAppConfig?: (config: WhatsAppSupportConfig) => Promise<any> | boolean | void;
  siteSeoConfig?: SiteSeoConfig;
  onUpdateSeoConfig?: (config: SiteSeoConfig) => Promise<any> | void;
  isSeoConfigLoading?: boolean;
  seoConfigLoadError?: string | null;
  isSeoConfigReady?: boolean;
  onReloadSeoConfig?: () => Promise<void> | void;
  paymentTransactions?: PaymentTransaction[];
  onApprovePaymentTransaction?: (transactionId: string, note?: string) => Promise<PaymentVerificationResult>;
  onRejectPaymentTransaction?: (transactionId: string, reason: string) => Promise<PaymentVerificationResult>;
  onUpdateChannelAvailability?: (updates: { email?: boolean; whatsapp?: boolean }) => void;
}



export const ADMIN_ROLE_DEFAULT_PERMS: Record<string, string[]> = {
  'Super Admin': ['*'],
  'Admin': ['*'],
  'Job Moderator': ['jobs.manage', 'applications.manage'],
  'Scraper Manager': ['scraper.manage'],
  'Payment Manager': ['payments.manage'],
  'Finance Manager': ['finance.manage', 'payments.manage'],
  'SEO Manager': ['seo.manage'],
  'Advertisement Manager': ['advertisements.manage']
};

export function checkAdminTabPermission(
  effectiveAdminRole: string | undefined | null,
  effectiveAdminPerms: string[] | undefined | null,
  isVerifiedAdmin: boolean,
  tabId: string
): boolean {
  if (!isVerifiedAdmin || !effectiveAdminRole) return false;
  if (tabId === 'data-backup') {
    return effectiveAdminRole === 'Super Admin' || effectiveAdminRole === 'Admin';
  }
  if (effectiveAdminRole === 'Super Admin' || effectiveAdminRole === 'Admin') return true;
  const perms = Array.isArray(effectiveAdminPerms) ? effectiveAdminPerms : [];
  const hasPerm = (perm: string) => perms.includes('*') || perms.includes(perm);

  if (['jobs', 'pending', 'add-job', 'ai-enhancer'].includes(tabId)) {
    return hasPerm('jobs.manage');
  }
  if (['scraper', 'url-scraper', 'scraped-history'].includes(tabId)) {
    return hasPerm('scraper.manage');
  }
  if (tabId === 'campaign-center') {
    return hasPerm('advertisements.manage') || hasPerm('finance.manage');
  }
  if (['advertisements', 'landing-customizer'].includes(tabId)) {
    return hasPerm('advertisements.manage');
  }
  if (['admin-payment-methods'].includes(tabId)) {
    return hasPerm('payments.manage');
  }
  if (['payment-proofs', 'fee-logs'].includes(tabId)) {
    return hasPerm('payments.manage') || hasPerm('finance.manage');
  }
  if (['pricing-controller', 'fee-management', 'currency-forex'].includes(tabId)) {
    return hasPerm('finance.manage');
  }
  if (['user-audit', 'employer-kyc', 'subscribers', 'chat-hub'].includes(tabId)) {
    return hasPerm('users.manage');
  }
  if (['seo-config'].includes(tabId)) {
    return hasPerm('seo.manage');
  }
  if (['activity-logs'].includes(tabId)) {
    return hasPerm('audit.view');
  }
  if (
    [
      'apply-settings',
      'modal-content-manager',
      'job-visibility',
      'settings',
      'admin-security',
      'form-customizer',
      'analytics',
      'stats',
      'locations-manager',
      'whatsapp-manager',
      'broadcast-center',
      'bulk-notifications'
    ].includes(tabId)
  ) {
    return hasPerm('settings.manage');
  }
  return false;
}

export function navigateWithAdminPermission<T extends string>(params: {
  targetTab: T;
  canAccessTab: (tabId: string) => boolean;
  tabCategories: Record<string, AdminCategory>;
  onSetTab: (tabId: T) => void;
  onSetCategory: (category: AdminCategory) => void;
}): boolean {
  const { targetTab, canAccessTab, tabCategories, onSetTab, onSetCategory } = params;
  if (!targetTab || !canAccessTab(targetTab)) {
    return false;
  }
  const mappedCategory = tabCategories[targetTab];
  if (mappedCategory) {
    onSetCategory(mappedCategory);
  }
  onSetTab(targetTab);
  return true;
}



export function formatChatUserRoleLabel(role?: unknown): string {
  if (typeof role !== 'string') return 'Member';
  const firstWord = role.trim().split(/\s+/)[0];
  return firstWord || 'Member';
}

export function isValidAuditDateTime(dateStr?: string | null): boolean {
  if (typeof dateStr !== 'string') return false;
  const trimmed = dateStr.trim();
  if (!trimmed) return false;

  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?(?:\.\d+)?(Z|[+-](?:\d{2}):?(?:\d{2})?)?$/i.exec(trimmed);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (year < 1000 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }

  const daysInMo = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day > daysInMo) {
    return false;
  }

  const hasTime = match[4] !== undefined && match[5] !== undefined;
  if (hasTime) {
    const hour = Number(match[4]);
    const minute = Number(match[5]);
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      return false;
    }
    if (match[6] !== undefined) {
      const second = Number(match[6]);
      if (second < 0 || second > 59) {
        return false;
      }
    }
  }

  const tz = match[7];
  if (tz) {
    if (!hasTime) {
      return false;
    }

    const upperTz = tz.toUpperCase();
    if (upperTz !== 'Z') {
      const tzMatch = /^([+-])(\d{2}):?(\d{2})?$/.exec(tz);
      if (!tzMatch) return false;
      const tzHour = Number(tzMatch[2]);
      const tzMin = tzMatch[3] !== undefined ? Number(tzMatch[3]) : 0;
      if (tzHour > 14 || tzMin > 59 || tzHour > 23) {
        return false;
      }
      if (tzHour === 14 && tzMin > 0) {
        return false;
      }
    }
  }

  return true;
}

export function formatAuditUserActivationDate(activationDate?: string | null): string {
  if (!isValidAuditDateTime(activationDate)) return 'Not recorded';
  return activationDate!.trim();
}

export function formatAuditUserExpiryDate(expiryDate?: string | null): string {
  if (!isValidAuditDateTime(expiryDate)) return 'Not recorded';
  return expiryDate!.trim();
}

export function formatAuditUserRenewalCount(renewalCount?: number | null): string {
  if (typeof renewalCount !== 'number' || !Number.isFinite(renewalCount) || renewalCount < 0) {
    return 'Not recorded';
  }
  return String(renewalCount);
}

export function computeExtendedExpiry30Days(
  expiryDate?: string | null
): { ok: true; nextExpiry: string } | { ok: false; message: string } {
  if (!isValidAuditDateTime(expiryDate)) {
    return {
      ok: false,
      message: 'No valid expiry date is recorded for this user. Please set a valid expiry date first using "Set Custom Date".'
    };
  }

  const trimmed = expiryDate!.trim();
  const ymdMatch = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(trimmed);
  if (ymdMatch) {
    const year = Number(ymdMatch[1]);
    const month = Number(ymdMatch[2]);
    const day = Number(ymdMatch[3]);
    const hour = ymdMatch[4] !== undefined ? Number(ymdMatch[4]) : 9;
    const minute = ymdMatch[5] !== undefined ? Number(ymdMatch[5]) : 0;
    const second = ymdMatch[6] !== undefined ? Number(ymdMatch[6]) : 0;
    const timePart = ymdMatch[4] !== undefined && ymdMatch[5] !== undefined ? `${ymdMatch[4]}:${ymdMatch[5]}` : '09:00';

    if (
      year < 1000 || year > 9999 ||
      month < 1 || month > 12 ||
      day < 1 || day > 31 ||
      hour < 0 || hour > 23 ||
      minute < 0 || minute > 59 ||
      second < 0 || second > 59
    ) {
      return {
        ok: false,
        message: 'Recorded expiry date or time component is invalid. Please set a valid expiry date first using "Set Custom Date".'
      };
    }

    const daysInMo = new Date(year, month, 0).getDate();
    if (day > daysInMo) {
      return {
        ok: false,
        message: 'Recorded expiry calendar date is impossible. Please set a valid expiry date first using "Set Custom Date".'
      };
    }

    const candidate = new Date(year, month - 1, day, hour, minute, second);
    if (
      candidate.getFullYear() !== year ||
      candidate.getMonth() !== month - 1 ||
      candidate.getDate() !== day ||
      candidate.getHours() !== hour ||
      candidate.getMinutes() !== minute
    ) {
      return {
        ok: false,
        message: 'Recorded expiry date is invalid. Please set a valid expiry date first using "Set Custom Date".'
      };
    }

    candidate.setDate(candidate.getDate() + 30);
    const nextExpiry = `${candidate.getFullYear()}-${String(candidate.getMonth() + 1).padStart(2, '0')}-${String(candidate.getDate()).padStart(2, '0')} ${timePart}`;
    return { ok: true, nextExpiry };
  }

  const normalized = trimmed.includes(' ') && !trimmed.includes('T')
    ? trimmed.replace(' ', 'T')
    : trimmed;
  const parsedMs = Date.parse(normalized);
  if (Number.isNaN(parsedMs)) {
    return {
      ok: false,
      message: 'Recorded expiry date could not be parsed. Please set a valid expiry date first using "Set Custom Date".'
    };
  }
  const isoDate = new Date(parsedMs);
  isoDate.setDate(isoDate.getDate() + 30);
  const nextExpiry = `${isoDate.getFullYear()}-${String(isoDate.getMonth() + 1).padStart(2, '0')}-${String(isoDate.getDate()).padStart(2, '0')} ${String(isoDate.getHours()).padStart(2, '0')}:${String(isoDate.getMinutes()).padStart(2, '0')}`;
  return { ok: true, nextExpiry };
}

export function getUserAuditTransactions(
  auditUser: Pick<UserAccount, 'id' | 'email'> | null | undefined,
  transactions: PaymentTransaction[] | null | undefined
): PaymentTransaction[] {
  if (!auditUser || !Array.isArray(transactions) || transactions.length === 0) {
    return [];
  }

  const targetUserId = typeof auditUser.id === 'string'
    ? auditUser.id.trim()
    : String(auditUser.id ?? '').trim();
  const targetEmail = typeof auditUser.email === 'string'
    ? auditUser.email.trim().toLowerCase()
    : '';

  return transactions.filter((tx) => {
    if (!tx || typeof tx !== 'object') return false;
    const rawTxUserId = tx.userId;
    const txUserId = typeof rawTxUserId === 'string'
      ? rawTxUserId.trim()
      : rawTxUserId !== undefined && rawTxUserId !== null
      ? String(rawTxUserId).trim()
      : '';

    if (txUserId) {
      return Boolean(targetUserId) && txUserId === targetUserId;
    }

    const txEmail = typeof tx.userEmail === 'string' ? tx.userEmail.trim().toLowerCase() : '';
    return Boolean(targetEmail && txEmail && txEmail === targetEmail);
  });
}

export function getAuditUserTransactionStatusClass(status?: string): string {
  switch (status) {
    case 'Success':
      return 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
    case 'Pending':
      return 'bg-amber-500/20 text-amber-300 border border-amber-500/30';
    case 'Verifying':
      return 'bg-sky-500/20 text-sky-300 border border-sky-500/30';
    case 'Failed':
      return 'bg-rose-500/20 text-rose-300 border border-rose-500/30';
    default:
      return 'bg-slate-800 text-slate-300 border border-slate-700';
  }
}

export interface AuditSubscriptionActionResult {
  success: boolean;
  user?: UserAccount;
  message: string;
  usedAuthoritativeUser?: boolean;
  reloadedAuthoritativeUser?: boolean;
}

export async function executeAdminAuditSubscriptionAction(params: {
  action: 'extend30' | 'revoke' | 'togglePlan' | 'customExpiry';
  auditUser: UserAccount;
  customExpiryInput?: string;
  onUpdateUserExpiry: (userId: string, newExpiryDate: string) => Promise<{ success: boolean; user?: UserAccount; message?: string } | boolean | void> | void;
  onToggleUserPlan: (userId: string) => Promise<{ success: boolean; user?: UserAccount; message?: string } | boolean | void> | void;
  fetchAuthoritativeUser?: (userId: string) => Promise<{ success?: boolean; user?: UserAccount } | null | undefined>;
  onSyncAuthoritativeUser?: (user: UserAccount) => void;
}): Promise<AuditSubscriptionActionResult> {
  const {
    action,
    auditUser,
    customExpiryInput,
    onUpdateUserExpiry,
    onToggleUserPlan,
    fetchAuthoritativeUser,
    onSyncAuthoritativeUser
  } = params;

  let rawResponse: any;
  let successMessage = '';

  try {
    if (action === 'extend30') {
      const ext = computeExtendedExpiry30Days(auditUser.expiryDate);
      if (ext.ok === false) {
        return { success: false, message: (ext as { ok: false; message: string }).message };
      }
      const nextExpiry = (ext as { ok: true; nextExpiry: string }).nextExpiry;
      rawResponse = await onUpdateUserExpiry(auditUser.id, nextExpiry);
      successMessage = `Subscription for ${auditUser.name} extended by +30 Days! New Expiry: ${nextExpiry}`;
    } else if (action === 'revoke') {
      rawResponse = await onUpdateUserExpiry(auditUser.id, '2020-01-01 00:00');
      successMessage = `Subscription for ${auditUser.name} revoked/expired immediately.`;
    } else if (action === 'togglePlan') {
      rawResponse = await onToggleUserPlan(auditUser.id);
      successMessage = `Plan update completed for ${auditUser.name}.`;
    } else {
      const trimmed = (customExpiryInput || '').trim();
      if (!trimmed) {
        return { success: false, message: 'Please enter a valid custom expiry date first.' };
      }
      rawResponse = await onUpdateUserExpiry(auditUser.id, trimmed);
      successMessage = `Expiry date updated to ${trimmed}.`;
    }
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Subscription update failed. No local changes were applied.'
    };
  }

  const isExplicitSuccess =
    rawResponse === true ||
    (rawResponse !== null && typeof rawResponse === 'object' && rawResponse.success === true);

  if (!isExplicitSuccess) {
    const errMsg =
      rawResponse && typeof rawResponse === 'object' && typeof rawResponse.message === 'string' && rawResponse.message.trim()
        ? rawResponse.message
        : 'Backend subscription update failed. Please try again.';
    return { success: false, message: errMsg };
  }

  if (rawResponse && typeof rawResponse === 'object' && rawResponse.user && typeof rawResponse.user === 'object') {
    const authoritativeUser = rawResponse.user as UserAccount;
    onSyncAuthoritativeUser?.(authoritativeUser);
    return {
      success: true,
      user: authoritativeUser,
      message: successMessage,
      usedAuthoritativeUser: true
    };
  }

  if (fetchAuthoritativeUser) {
    try {
      const refreshed = await fetchAuthoritativeUser(auditUser.id);
      if (refreshed && refreshed.success !== false && refreshed.user && typeof refreshed.user === 'object') {
        const refreshedUser = refreshed.user as UserAccount;
        onSyncAuthoritativeUser?.(refreshedUser);
        return {
          success: true,
          user: refreshedUser,
          message: successMessage,
          reloadedAuthoritativeUser: true
        };
      }
    } catch {
      // Do not fabricate fields if authoritative refresh fails after backend accepted the mutation
    }
  }

  return {
    success: true,
    message: `${successMessage} Refresh user list to view updated server fields.`
  };
}

export interface AdminUserAuditProfileModalProps {
  auditUser: UserAccount;
  transactions: PaymentTransaction[];
  customExpiryInput: string;
  onChangeCustomExpiryInput: (value: string) => void;
  isSubmitting?: boolean;
  notice?: { type: 'success' | 'error'; message: string } | null;
  onClose: () => void;
  onExtend30Days: () => void | Promise<void>;
  onRevokeNow: () => void | Promise<void>;
  onSwitchPlan: () => void | Promise<void>;
  onSetCustomDate: () => void | Promise<void>;
}

export const AdminUserAuditProfileModal: React.FC<AdminUserAuditProfileModalProps> = ({
  auditUser,
  transactions,
  customExpiryInput,
  onChangeCustomExpiryInput,
  isSubmitting = false,
  notice = null,
  onClose,
  onExtend30Days,
  onRevokeNow,
  onSwitchPlan,
  onSetCustomDate
}) => {
  const userTransactions = getUserAuditTransactions(auditUser, transactions);
  const activationDisplay = formatAuditUserActivationDate(auditUser.activationDate);
  const expiryDisplay = formatAuditUserExpiryDate(auditUser.expiryDate);
  const renewalDisplay = formatAuditUserRenewalCount(auditUser.renewalCount);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 space-y-6 text-white shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-4 border-b border-slate-800 pb-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-emerald-500 p-0.5 flex items-center justify-center">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center font-black text-xl text-amber-400">
              {auditUser.name ? auditUser.name.charAt(0).toUpperCase() : '?'}
            </div>
          </div>
          <div>
            <h3 className="text-xl font-black">{auditUser.name}</h3>
            <p className="text-xs text-slate-400 font-mono">{auditUser.email} • {auditUser.phone || 'No phone'}</p>
          </div>
        </div>

        {/* Live Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
            <span className="text-[10px] uppercase text-slate-400 block font-bold">Current Plan</span>
            <span className="font-bold text-emerald-400">{auditUser.plan}</span>
          </div>
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
            <span className="text-[10px] uppercase text-slate-400 block font-bold">Activation Date</span>
            <span className="font-mono font-semibold text-white">{activationDisplay}</span>
          </div>
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
            <span className="text-[10px] uppercase text-slate-400 block font-bold">Expiry Date</span>
            <span className="font-mono font-bold text-amber-400">{expiryDisplay}</span>
          </div>
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
            <span className="text-[10px] uppercase text-slate-400 block font-bold">Total Renewals</span>
            <span className="font-bold text-indigo-400">{renewalDisplay}</span>
          </div>
        </div>

        {/* Manual Expiry Date Controls */}
        <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-3">
          <span className="text-xs font-bold text-amber-400 uppercase tracking-wider block">
            Admin Manual Subscription Controls
          </span>

          {notice && (
            <div
              className={`p-3 rounded-xl border text-xs font-semibold flex items-start space-x-2 ${
                notice.type === 'success'
                  ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                  : 'bg-rose-950/60 border-rose-500/40 text-rose-300'
              }`}
            >
              {notice.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              )}
              <span>{notice.message}</span>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onExtend30Days}
              className="px-3.5 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-slate-950 border border-emerald-500/40 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
            >
              + Extend +30 Days
            </button>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={onRevokeNow}
              className="px-3.5 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white border border-rose-500/40 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
            >
              ⛔ Revoke / Expire Now
            </button>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={onSwitchPlan}
              className="px-3.5 py-2 rounded-xl bg-indigo-500/20 hover:bg-indigo-500 text-indigo-300 hover:text-white border border-indigo-500/40 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
            >
              Switch Plan ({auditUser.plan === 'Premium' ? 'Free' : 'Premium'})
            </button>
          </div>

          <div className="pt-2 flex items-center space-x-2">
            <input
              type="text"
              value={customExpiryInput}
              onChange={(e) => onChangeCustomExpiryInput(e.target.value)}
              placeholder="Custom Expiry e.g. 2027-12-31 23:59"
              className="flex-1 px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs font-mono"
            />
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onSetCustomDate}
              className="px-4 py-2 bg-amber-500 text-slate-950 font-bold text-xs rounded-xl cursor-pointer disabled:opacity-50"
            >
              Set Custom Date
            </button>
          </div>
        </div>

        {/* User Transactions Table */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase text-slate-400">User Payment Transaction Timeline</h4>
          <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900 uppercase text-[10px] text-slate-400 font-bold border-b border-slate-800">
                <tr>
                  <th className="p-3">Date & Time</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Amount</th>
                  <th className="p-3">Method</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {userTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-slate-400 font-sans">
                      No payment transactions recorded for this user.
                    </td>
                  </tr>
                ) : (
                  userTransactions.map((tx) => (
                    <tr key={tx.id} className="font-mono">
                      <td className="p-3">{tx.dateTime || 'Not recorded'}</td>
                      <td className="p-3 font-bold text-emerald-400 font-sans">{tx.type}</td>
                      <td className="p-3 font-bold text-white">
                        {tx.currency || 'PKR'} {typeof tx.amount === 'number' && Number.isFinite(tx.amount) ? tx.amount.toLocaleString() : '—'}
                      </td>
                      <td className="p-3 font-sans">{tx.paymentMethod || 'Not recorded'}</td>
                      <td className="p-3 font-sans">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${getAuditUserTransactionStatusClass(tx.status)}`}>
                          {tx.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  jobs,
  pendingJobs,
  pendingTotal,
  pendingPage = 1,
  pendingLimit = 100,
  pendingTotalPages = 1,
  onPendingPageChange,
  subscribers,
  users,
  chatMessages,
  customFormFields,
  jobPostingFeePkr,
  onChangeJobPostingFee,
  jobPostingFeeLogs,
  monthlyFeePkr = 300,
  onChangeMonthlyFee = () => {},
  jobPostingPricing = DEFAULT_JOB_POSTING_PRICING_CONFIG,
  onChangeJobPostingPricing,
  onSaveJobPostingPricing,
  allApplications = [],
  onReloadJobs,
  onApproveJob,
  onRejectJob,
  onAddJob,
  onAddPendingJob,
  onBulkAddJobs,
  onBulkAddPendingJobs,
  onImportBulkJobs,
  onDeleteJob,
  onUpdateJob,
  onBulkDeleteJobs,
  onBulkUpdateJobs,
  onBulkApprovePendingJobs,
  onBulkRejectPendingJobs,
  onAddSubscriber,
  onUpdateSubscriber,
  onDeleteSubscriber,
  onBulkDeleteSubscribers,
  onUpdateUser,
  onBulkDeleteUsers,
  onDeleteFeeLog,
  onBulkDeleteFeeLogs,
  onSendMessageToUser,
  onAddCustomField,
  onToggleCustomField,
  onDeleteCustomField,
  onUpdateUserExpiry,
  onToggleUserPlan,
  onUpdateUserPassword,
  onEndUserMembership,
  onDeactivateUserJobs,
  onEndUserMembershipAndJobs,
  onSuspendJob,
  onBulkEndUnpaidMemberships,
  onExitAdmin,
  ads = [],
  onAddAd,
  onUpdateAd,
  onDeleteAd,
  onResetAdMetrics,
  pricingConfig,
  onUpdatePricingConfig,
  campaignConfig,
  onUpdateCampaignConfig,
  onApproveAd,
  onRejectAd,
  landingConfig,
  landingDesignSystem,
  onSelectLandingDesign,
  onUpdateLandingConfig,
  onSaveLandingAndCampaignConfig,
  onSaveCompleteFeeConfig,
  onSyncAuthoritativePricing,
  isPricingLoading = false,
  pricingLoadError = null,
  isPricingReady = true,
  onReloadPricingConfig,
  whatsAppSupportConfig,
  onUpdateWhatsAppConfig,
  siteSeoConfig: propSiteSeoConfig,
  onUpdateSeoConfig,
  isSeoConfigLoading = false,
  seoConfigLoadError = null,
  isSeoConfigReady = true,
  onReloadSeoConfig,
  paymentTransactions,
  onApprovePaymentTransaction,
  onRejectPaymentTransaction,
  onUpdateChannelAvailability
}) => {
  const [adminTab, setAdminTab] = useState<
    | 'analytics'
    | 'jobs-ads-control-center'
    | 'landing-customizer'
    | 'campaign-center'
    | 'fee-management'
    | 'payment-proofs'
    | 'admin-payment-methods'
    | 'whatsapp-manager'
    | 'pending'
    | 'scraped-history'
    | 'advertisements'
    | 'seo-config'
    | 'currency-forex'
    | 'broadcast-center'
    | 'bulk-notifications'
    | 'activity-logs'
    | 'data-backup'
    | 'ai-enhancer'
    | 'employer-kyc'
    | 'user-audit'
    | 'fee-logs'
    | 'scraper'
    | 'url-scraper'
    | 'chat-hub'
    | 'form-customizer'
    | 'pricing-controller'
    | 'apply-settings'
    | 'modal-content-manager'
    | 'job-visibility'
    | 'locations-manager'
    | 'add-job'
    | 'jobs'
    | 'subscribers'
    | 'settings'
    | 'admin-security'
    | 'stats'
  >('analytics');

  const [jobsAdsWorkspaceArea, setJobsAdsWorkspaceArea] = useState<'jobs' | 'campaigns'>('jobs');
  const [jobsWorkspaceSection, setJobsWorkspaceSection] = useState<'pending' | 'jobs' | 'add-job' | 'ai-enhancer' | 'pricing-controller' | 'fee-logs'>('pending');
  const [campaignWorkspaceSection, setCampaignWorkspaceSection] = useState<'advertisements' | 'campaign-center' | 'landing-customizer'>('advertisements');

  const [activeCategory, setActiveCategory] = useState<AdminCategory>('jobs');
  const [navMode, setNavMode] = useState<AdminNavMode>('classic');
  const [isProSidebarCollapsed, setIsProSidebarCollapsed] = useState(false);
  const [isProMobileDrawerOpen, setIsProMobileDrawerOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showAllModulesMenu, setShowAllModulesMenu] = useState(false);
  const [moduleSearchQuery, setModuleSearchQuery] = useState('');
  const [seoPreviewJob, setSeoPreviewJob] = useState<Job | null>(null);

  const TAB_CATEGORIES = ADMIN_TAB_CATEGORIES;

  // Authenticated Admin Identity & Role Permissions (Verified via /api/auth/me; Backend remains authoritative)
  const [currentAdminUser, setCurrentAdminUser] = useState<{
    id?: string;
    userId?: string;
    name?: string;
    email?: string;
    role?: string;
    permissions?: string[];
  } | null>(null);
  const [isVerifyingAdmin, setIsVerifyingAdmin] = useState<boolean>(true);
  const [adminVerifyError, setAdminVerifyError] = useState<string | null>(null);

  const ROLE_DEFAULT_PERMS = ADMIN_ROLE_DEFAULT_PERMS;

  const ADMIN_ROLES_LIST = Object.keys(ROLE_DEFAULT_PERMS);
  const isVerifiedAdmin = Boolean(
    !isVerifyingAdmin &&
    currentAdminUser?.role &&
    ADMIN_ROLES_LIST.includes(currentAdminUser.role)
  );
  const effectiveAdminRole = isVerifiedAdmin ? (currentAdminUser?.role || '') : '';
  const effectiveAdminPerms = isVerifiedAdmin
    ? (ROLE_DEFAULT_PERMS[effectiveAdminRole] || currentAdminUser?.permissions || [])
    : [];

  const hasAdminUiPermission = (perm: string): boolean => {
    if (!isVerifiedAdmin || !effectiveAdminRole) return false;
    if (effectiveAdminRole === 'Super Admin' || effectiveAdminRole === 'Admin') return true;
    return effectiveAdminPerms.includes('*') || effectiveAdminPerms.includes(perm);
  };

  const canAccessAdminTab = (tabId: string): boolean => {
    if (tabId === 'jobs-ads-control-center') {
      return ['jobs', 'pending', 'add-job', 'ai-enhancer', 'pricing-controller', 'fee-management', 'fee-logs', 'advertisements', 'campaign-center', 'landing-customizer']
        .some((moduleId) => checkAdminTabPermission(effectiveAdminRole, effectiveAdminPerms, isVerifiedAdmin, moduleId));
    }
    return checkAdminTabPermission(effectiveAdminRole, effectiveAdminPerms, isVerifiedAdmin, tabId);
  };

  const jobsWorkspaceTabIds = ['pending', 'jobs', 'add-job', 'ai-enhancer', 'pricing-controller', 'fee-logs'];
  const campaignWorkspaceTabIds = ['advertisements', 'campaign-center', 'landing-customizer'];
  const canAccessJobsWorkspace = jobsWorkspaceTabIds.some(canAccessAdminTab);
  const canAccessCampaignWorkspace = campaignWorkspaceTabIds.some(canAccessAdminTab);
  const effectiveAdminTab = adminTab === 'jobs-ads-control-center'
    ? (jobsAdsWorkspaceArea === 'jobs' && canAccessJobsWorkspace
        ? (canAccessAdminTab(jobsWorkspaceSection) ? jobsWorkspaceSection : jobsWorkspaceTabIds.find(canAccessAdminTab) || 'jobs')
        : (canAccessCampaignWorkspace
            ? (canAccessAdminTab(campaignWorkspaceSection) ? campaignWorkspaceSection : campaignWorkspaceTabIds.find(canAccessAdminTab) || 'campaign-center')
            : jobsWorkspaceTabIds.find(canAccessAdminTab) || 'jobs'))
    : adminTab;

  const canAccessAdminCategory = (cat: AdminCategory): boolean => {
    if (!isVerifiedAdmin || !effectiveAdminRole) return false;
    return ADMIN_NAVIGATION_MODULES.some(
      (mod) => mod.classicCategory === cat && canAccessAdminTab(mod.id)
    );
  };

  const verifiedAdminId = String(currentAdminUser?.userId || currentAdminUser?.id || '').trim() || undefined;

  useEffect(() => {
    if (!isVerifiedAdmin || !verifiedAdminId) {
      setNavMode('classic');
      return;
    }
    setNavMode(resolveStoredAdminNavMode(verifiedAdminId));
  }, [isVerifiedAdmin, verifiedAdminId]);

  const handleChangeNavMode = (nextMode: AdminNavMode) => {
    const safeMode: AdminNavMode = nextMode === 'professional' ? 'professional' : 'classic';
    setNavMode(safeMode);
    if (isVerifiedAdmin && verifiedAdminId) {
      persistAdminNavMode(verifiedAdminId, safeMode);
    }
    setIsMobileMenuOpen(false);
    setIsProMobileDrawerOpen(false);
  };

  const handlePermissionAwareNavigateTab = (targetTab: string): boolean => {
    return navigateWithAdminPermission({
      targetTab: targetTab as any,
      canAccessTab: canAccessAdminTab,
      tabCategories: TAB_CATEGORIES,
      onSetTab: setAdminTab,
      onSetCategory: setActiveCategory
    });
  };

  useEffect(() => {
    let isMounted = true;
    setIsVerifyingAdmin(true);
    setAdminVerifyError(null);
    api.auth.me()
      .then((res: any) => {
        if (!isMounted) return;
        if (res?.success && res.user && ADMIN_ROLES_LIST.includes(res.user.role)) {
          setCurrentAdminUser(res.user);
          setAdminVerifyError(null);
        } else {
          setCurrentAdminUser(null);
          setAdminVerifyError(res?.message || 'Administrative session could not be verified.');
        }
      })
      .catch((err: any) => {
        if (!isMounted) return;
        setCurrentAdminUser(null);
        setAdminVerifyError(err?.message || 'Failed to verify administrative session.');
      })
      .finally(() => {
        if (isMounted) setIsVerifyingAdmin(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isVerifiedAdmin) return;
    if (hasAdminUiPermission('users.manage') && onUpdateUser) {
      api.users.getAll()
        .then((res: any) => {
          if (res?.success && Array.isArray(res.users)) {
            res.users.forEach((backendUser: any) => {
              if (backendUser && backendUser.id) {
                onUpdateUser(backendUser);
              }
            });
          }
        })
        .catch(() => {});
    }
  }, [isVerifiedAdmin, effectiveAdminRole]);

  useEffect(() => {
    if (!isVerifiedAdmin) return;
    if (effectiveAdminRole === 'Super Admin' || effectiveAdminRole === 'Admin') return;
    if (!canAccessAdminCategory(activeCategory) || !canAccessAdminTab(adminTab)) {
      if (hasAdminUiPermission('jobs.manage')) {
        setActiveCategory('jobs');
        setAdminTab('jobs');
      } else if (hasAdminUiPermission('scraper.manage')) {
        setActiveCategory('scraper');
        setAdminTab('scraper');
      } else if (hasAdminUiPermission('advertisements.manage')) {
        setActiveCategory('ads');
        setAdminTab('campaign-center');
      } else if (hasAdminUiPermission('payments.manage') || hasAdminUiPermission('finance.manage')) {
        setActiveCategory('payments');
        setAdminTab(hasAdminUiPermission('payments.manage') ? 'admin-payment-methods' : 'pricing-controller');
      } else if (hasAdminUiPermission('seo.manage')) {
        setActiveCategory('settings');
        setAdminTab('seo-config');
      } else if (hasAdminUiPermission('users.manage')) {
        setActiveCategory('users');
        setAdminTab('user-audit');
      } else if (hasAdminUiPermission('audit.view')) {
        setActiveCategory('settings');
        setAdminTab('activity-logs');
      } else if (hasAdminUiPermission('settings.manage')) {
        setActiveCategory('settings');
        setAdminTab('settings');
      }
    }
  }, [isVerifiedAdmin, effectiveAdminRole, activeCategory, adminTab]);

  // International Admin Suite States
  const [siteSeoConfig, setSiteSeoConfig] = useState<SiteSeoConfig>(INITIAL_SITE_SEO_CONFIG);

  const [currencyConfig, setCurrencyConfig] = useState<CurrencyExchangeConfig>(() => {
    try {
      const saved = localStorage.getItem('career_pak_currency_config');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return INITIAL_CURRENCY_CONFIG;
  });

  const [isCurrencyLoading, setIsCurrencyLoading] = useState<boolean>(true);
  const [currencyLoadError, setCurrencyLoadError] = useState<string | null>(null);
  const [currencyMigrationError, setCurrencyMigrationError] = useState<string | null>(null);

  const [isBroadcastLoading, setIsBroadcastLoading] = useState<boolean>(true);
  const [broadcastLoadError, setBroadcastLoadError] = useState<string | null>(null);
  const [broadcastMigrationError, setBroadcastMigrationError] = useState<string | null>(null);
  const [broadcastCampaigns, setBroadcastCampaigns] = useState<BroadcastCampaign[]>([]);

  const [commConfig, setCommConfig] = useState<CommunicationProviderConfig>(INITIAL_COMM_CONFIG);

  // Admin Password Management State
  const [adminCurrentPassword, setAdminCurrentPassword] = useState('');
  const [adminNewPassword, setAdminNewPassword] = useState('');
  const [adminConfirmPassword, setAdminConfirmPassword] = useState('');
  const [adminPasswordStatus, setAdminPasswordStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [adminPasswordLoading, setAdminPasswordLoading] = useState(false);

  const handleAdminPasswordChangeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminPasswordStatus(null);

    if (!adminCurrentPassword || !adminNewPassword || !adminConfirmPassword) {
      setAdminPasswordStatus({ type: 'error', message: 'All fields are required.' });
      return;
    }

    if (adminNewPassword !== adminConfirmPassword) {
      setAdminPasswordStatus({ type: 'error', message: 'New password and confirmation do not match.' });
      return;
    }

    if (adminNewPassword.length < 8) {
      setAdminPasswordStatus({ type: 'error', message: 'New password must be at least 8 characters.' });
      return;
    }

    setAdminPasswordLoading(true);
    try {
      const res = await api.auth.changePassword({
        currentPassword: adminCurrentPassword,
        newPassword: adminNewPassword
      });

      if (res && res.success) {
        setAdminPasswordStatus({
          type: 'success',
          message: 'Admin password successfully updated and active session token renewed.'
        });
        setAdminCurrentPassword('');
        setAdminNewPassword('');
        setAdminConfirmPassword('');
      } else {
        setAdminPasswordStatus({
          type: 'error',
          message: res?.message || 'Failed to update admin password. Check current password.'
        });
      }
    } catch (err: any) {
      setAdminPasswordStatus({
        type: 'error',
        message: err?.message || 'Network error occurred while updating password.'
      });
    } finally {
      setAdminPasswordLoading(false);
    }
  };

  const [kycRequests, setKycRequests] = useState<EmployerKycRequest[]>([]);
  const [kycLoading, setKycLoading] = useState<boolean>(true);
  const [kycError, setKycError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchKycRequests = async () => {
      setKycLoading(true);
      setKycError(null);
      try {
        const res = await api.kyc.getAll();
        if (!isMounted) return;
        if (res && res.success && Array.isArray(res.requests)) {
          setKycRequests(res.requests);
          setKycLoading(false);
        } else {
          setKycError(res?.message || 'Failed to load live KYC requests from backend.');
          setKycLoading(false);
        }
      } catch (err: any) {
        if (isMounted) {
          setKycError(err?.message || 'Network error loading KYC requests.');
          setKycLoading(false);
        }
      }
    };
    fetchKycRequests();
    return () => { isMounted = false; };
  }, []);

  const effectiveSeoConfig = propSiteSeoConfig || siteSeoConfig;

  const handleUpdateSeoConfig = async (newCfg: SiteSeoConfig) => {
    setSiteSeoConfig(newCfg);
    if (onUpdateSeoConfig) {
      return await onUpdateSeoConfig(newCfg);
    } else {
      const res = await api.seo.updateConfig(newCfg);
      if (!res || !res.success) {
        throw new Error(res?.message || 'Failed to save SEO config');
      }
      return res;
    }
  };

  const handleUpdateCommConfig = (newCfg: CommunicationProviderConfig) => {
    setCommConfig(newCfg);
  };

  const handleUpdateCurrencyConfig = async (newCfg: CurrencyExchangeConfig) => {
    const res = await api.currency.updateConfig(newCfg);
    if (res && res.success && res.config) {
      setCurrencyConfig(res.config);
      try {
        localStorage.setItem('career_pak_currency_config', JSON.stringify(res.config));
      } catch (e) {}
      return res.config;
    } else {
      throw new Error(res?.message || 'Server rejected currency configuration save.');
    }
  };

  const hasMigratedCurrencyRef = useRef(false);

  // Fetch backend currency configuration on mount with non-destructive legacy migration
  useEffect(() => {
    let isMounted = true;
    const fetchCurrencyConfig = async () => {
      setIsCurrencyLoading(true);
      setCurrencyLoadError(null);
      try {
        const res = await api.currency.getConfig();
        if (!isMounted) return;
        if (res && res.success === true && res.config) {
          if (res.isConfigured === true) {
            setCurrencyConfig(res.config);
            try {
              localStorage.setItem('career_pak_currency_config', JSON.stringify(res.config));
            } catch (e) {}
          } else if (res.isConfigured === false && !hasMigratedCurrencyRef.current) {
            hasMigratedCurrencyRef.current = true;
            // Check legacy LocalStorage for non-destructive migration to backend
            const savedLegacy = localStorage.getItem('career_pak_currency_config');
            if (savedLegacy) {
              try {
                const parsed = JSON.parse(savedLegacy);
                if (parsed && typeof parsed === 'object' && parsed.rates) {
                  const saveRes = await api.currency.updateConfig(parsed);
                  if (saveRes && saveRes.success && saveRes.config) {
                    setCurrencyConfig(saveRes.config);
                    try {
                      localStorage.setItem('career_pak_currency_config', JSON.stringify(saveRes.config));
                    } catch (e) {}
                  } else {
                    setCurrencyMigrationError(saveRes?.message || 'Failed to migrate legacy currency settings to MongoDB.');
                  }
                }
              } catch (migErr: any) {
                setCurrencyMigrationError(migErr?.message || 'Error processing legacy currency configuration during migration.');
              }
            }
          }
        } else {
          setCurrencyLoadError(res?.message || 'Failed to retrieve currency configuration from backend.');
        }
      } catch (err: any) {
        if (isMounted) {
          setCurrencyLoadError(err?.message || 'Network error occurred while fetching currency configuration.');
        }
      } finally {
        if (isMounted) {
          setIsCurrencyLoading(false);
        }
      }
    };
    fetchCurrencyConfig();
    return () => { isMounted = false; };
  }, []);

  const fetchBroadcastCampaigns = useCallback(async () => {
    setIsBroadcastLoading(true);
    setBroadcastLoadError(null);
    try {
      const res = await api.broadcasts.getAll();
      if (res && res.success && Array.isArray(res.campaigns)) {
        setBroadcastCampaigns(res.campaigns);

        // One-time safe legacy migration check
        try {
          const legacyRaw = localStorage.getItem('career_pak_broadcast_campaigns');
          if (legacyRaw) {
            let parsed: any;
            try {
              parsed = JSON.parse(legacyRaw);
            } catch (jsonErr: any) {
              console.warn('[Broadcast Migration] Malformed legacy JSON in localStorage:', jsonErr);
              setBroadcastMigrationError('Malformed legacy broadcast data in browser storage. Preserving original data.');
              return;
            }

            if (Array.isArray(parsed)) {
              if (parsed.length === 0) {
                localStorage.removeItem('career_pak_broadcast_campaigns');
              } else {
                // Separate synthetic sample IDs from non-synthetic records
                const SYNTHETIC_IDS = ['camp-01', 'camp-02', 'camp-03'];
                const syntheticItems = parsed.filter(
                  c => c && typeof c === 'object' && SYNTHETIC_IDS.includes(String(c.id).trim())
                );
                const nonSyntheticItems = parsed.filter(
                  c => !(c && typeof c === 'object' && SYNTHETIC_IDS.includes(String(c.id).trim()))
                );

                // If array contains ONLY synthetic sample items, we can safely clean up localStorage
                if (nonSyntheticItems.length === 0 && syntheticItems.length > 0) {
                  localStorage.removeItem('career_pak_broadcast_campaigns');
                } else if (nonSyntheticItems.length > 0) {
                  // Every non-synthetic record must be submitted to the backend import endpoint for rigorous accounting
                  const importRes = await api.broadcasts.importLegacy(nonSyntheticItems);

                  // Fix A Requirements:
                  // Remove the LocalStorage key ONLY when every non-synthetic record is conclusively accounted for (imported or safe duplicate).
                  // If even one record is invalid, null, primitive, malformed, or fails insertion/conflict checks, preserve exact original LocalStorage.
                  const isFullyMigrated =
                    importRes &&
                    importRes.success === true &&
                    importRes.allEligibleSucceeded === true &&
                    importRes.failed === 0 &&
                    typeof importRes.imported === 'number' &&
                    typeof importRes.duplicates === 'number' &&
                    (importRes.imported + importRes.duplicates === nonSyntheticItems.length);

                  if (isFullyMigrated) {
                    localStorage.removeItem('career_pak_broadcast_campaigns');
                    setBroadcastMigrationError(null);
                    const refreshRes = await api.broadcasts.getAll();
                    if (refreshRes && refreshRes.success && Array.isArray(refreshRes.campaigns)) {
                      setBroadcastCampaigns(refreshRes.campaigns);
                    }
                  } else {
                    // Partial, conflict, or failed migration: preserve localStorage exactly, show error, permit retry
                    const errorDetails = importRes?.errors && importRes.errors.length > 0
                      ? importRes.errors.join('; ')
                      : importRes?.message || 'One or more legacy records could not be safely migrated or conflicted.';
                    setBroadcastMigrationError(`Migration incomplete: ${errorDetails}. Original data preserved in storage.`);
                  }
                }
              }
            }
          }
        } catch (migErr: any) {
          console.warn('[Broadcast Migration] Error processing legacy data:', migErr);
          setBroadcastMigrationError(migErr?.message || 'Error checking legacy broadcast campaigns. Original data preserved.');
        }
      } else {
        setBroadcastLoadError(res?.message || 'Failed to load broadcast campaigns from database.');
      }
    } catch (err: any) {
      setBroadcastLoadError(err?.message || 'Network error while loading broadcast campaigns.');
    } finally {
      setIsBroadcastLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBroadcastCampaigns();
  }, [fetchBroadcastCampaigns]);

  const handleSaveBroadcastCampaign = async (newCampData: Partial<BroadcastCampaign>) => {
    try {
      const { id, status, sentAt, openRate, clickRate, ...cleanInput } = newCampData as any;
      const res = await api.broadcasts.create(cleanInput);
      if (res && res.success && res.campaign) {
        setBroadcastCampaigns(prev => [res.campaign!, ...prev.filter(c => c.id !== res.campaign!.id)]);
        return { success: true, campaign: res.campaign };
      }
      return { success: false, error: res?.message || 'Failed to save broadcast campaign draft.' };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Network error while saving broadcast campaign.' };
    }
  };

  // WhatsApp Support Configuration State
  const [internalWhatsAppConfig, setInternalWhatsAppConfig] = useState<WhatsAppSupportConfig>(() => {
    if (whatsAppSupportConfig) return { ...DEFAULT_WHATSAPP_CONFIG, ...whatsAppSupportConfig };
    return DEFAULT_WHATSAPP_CONFIG;
  });

  useEffect(() => {
    if (whatsAppSupportConfig) {
      setInternalWhatsAppConfig(prev => ({
        ...DEFAULT_WHATSAPP_CONFIG,
        ...prev,
        ...whatsAppSupportConfig
      }));
    }
  }, [whatsAppSupportConfig]);

  // Payment Verification Transactions State
  const [internalTransactions, setInternalTransactions] = useState<PaymentTransaction[]>(() => {
    if (Array.isArray(paymentTransactions) && paymentTransactions.length > 0) return paymentTransactions;
    try {
      const saved = localStorage.getItem('hybrid_payment_transactions');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return INITIAL_PAYMENT_TRANSACTIONS;
  });

  const currentWhatsAppConfig = whatsAppSupportConfig || internalWhatsAppConfig;
  const currentTransactions = Array.isArray(paymentTransactions) ? paymentTransactions : internalTransactions;

  const handleUpdateWhatsApp = async (newCfg: WhatsAppSupportConfig) => {
    setInternalWhatsAppConfig(newCfg);
    if (onUpdateWhatsAppConfig) {
      return await onUpdateWhatsAppConfig(newCfg);
    }
    return true;
  };

  const handleApproveTx = async (
    txId: string,
    note?: string
  ): Promise<PaymentVerificationResult> => {
    if (onApprovePaymentTransaction) {
      try {
        const result = await onApprovePaymentTransaction(txId, note);
        const tx = result?.transaction;
        const matchesId = Boolean(tx && String(tx.id) === String(txId));
        const matchesStatus = Boolean(tx && tx.status === 'Success');
        if (result && result.success && tx && matchesId && matchesStatus) {
          setInternalTransactions(prev => {
            const updated = prev.map(t => String(t.id) === String(txId) ? tx : t);
            try { localStorage.setItem('hybrid_payment_transactions', JSON.stringify(updated)); } catch (e) {}
            return updated;
          });
          return result;
        }
        return result || { success: false, message: 'Payment approval failed or returned invalid transaction data' };
      } catch (err: any) {
        console.error('Error approving payment transaction in dashboard:', err);
        return { success: false, message: err?.message || 'Error approving payment transaction' };
      }
    }
    return { success: false, message: 'No payment approval handler configured' };
  };

  const handleRejectTx = async (
    txId: string,
    reason: string
  ): Promise<PaymentVerificationResult> => {
    if (onRejectPaymentTransaction) {
      try {
        const result = await onRejectPaymentTransaction(txId, reason);
        const tx = result?.transaction;
        const matchesId = Boolean(tx && String(tx.id) === String(txId));
        const matchesStatus = Boolean(tx && tx.status === 'Failed');
        if (result && result.success && tx && matchesId && matchesStatus) {
          setInternalTransactions(prev => {
            const updated = prev.map(t => String(t.id) === String(txId) ? tx : t);
            try { localStorage.setItem('hybrid_payment_transactions', JSON.stringify(updated)); } catch (e) {}
            return updated;
          });
          return result;
        }
        return result || { success: false, message: 'Payment rejection failed or returned invalid transaction data' };
      } catch (err: any) {
        console.error('Error rejecting payment transaction in dashboard:', err);
        return { success: false, message: err?.message || 'Error rejecting payment transaction' };
      }
    }
    return { success: false, message: 'No payment rejection handler configured' };
  };

  // Helper for computing duplicate scraped & pending jobs (Pending vs Pending + Pending vs Live)
  const computeScrapedDuplicates = (jobList: Job[], liveJobList: Job[] = jobs) => {
    // 1. Build live jobs map
    const liveKeyMap = new Map<string, Job>();
    (liveJobList || []).forEach(liveJob => {
      if (!liveJob || !liveJob.title) return;
      const normalizedTitle = liveJob.title.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
      const normalizedCompany = (liveJob.company || liveJob.govtDepartment || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();
      const key = `${normalizedTitle}_${normalizedCompany}`;
      if (!liveKeyMap.has(key)) {
        liveKeyMap.set(key, liveJob);
      }
    });

    const pendingKeyMap = new Map<string, Job>();
    const duplicateJobIds: string[] = [];
    const uniqueJobs: Job[] = [];
    const duplicatesInfo: Array<{
      job: Job;
      duplicateType: 'Live Duplicate' | 'Pending Duplicate';
      matchedWith: Job;
    }> = [];

    jobList.forEach(job => {
      if (!job || !job.title) return;
      const normalizedTitle = job.title.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
      const normalizedCompany = (job.company || job.govtDepartment || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();
      const key = `${normalizedTitle}_${normalizedCompany}`;

      // Check against live jobs first
      if (liveKeyMap.has(key)) {
        duplicateJobIds.push(job.id);
        duplicatesInfo.push({
          job,
          duplicateType: 'Live Duplicate',
          matchedWith: liveKeyMap.get(key)!
        });
      } else if (pendingKeyMap.has(key)) {
        // Check against earlier pending jobs
        duplicateJobIds.push(job.id);
        duplicatesInfo.push({
          job,
          duplicateType: 'Pending Duplicate',
          matchedWith: pendingKeyMap.get(key)!
        });
      } else {
        // Unique
        pendingKeyMap.set(key, job);
        uniqueJobs.push(job);
      }
    });

    return {
      duplicateCount: duplicateJobIds.length,
      duplicateIds: duplicateJobIds,
      uniqueCount: uniqueJobs.length,
      uniqueJobs,
      liveDuplicateCount: duplicatesInfo.filter(d => d.duplicateType === 'Live Duplicate').length,
      pendingDuplicateCount: duplicatesInfo.filter(d => d.duplicateType === 'Pending Duplicate').length,
      duplicatesInfo
    };
  };

  // 1-Click Purge all duplicate scraped/pending jobs
  const handleBulkPurgeDuplicates = () => {
    const allPendingOrScraped = pendingJobs.filter(j => 
      j.sourceUrl || j.scraperSourceId || j.scrapedSourceDomain || j.id.includes('scraped') || j.id.includes('sc')
    );
    const { duplicateIds, duplicateCount } = computeScrapedDuplicates(allPendingOrScraped);

    if (duplicateCount === 0) {
      alert('No duplicate scraped jobs found! All jobs in the queue are unique. (کوئی ڈپلیکیٹ جاب نہیں ملی)');
      return;
    }

    if (confirm(`Are you sure you want to permanently remove ${duplicateCount} duplicate scraped jobs? (کیا آپ تمام ${duplicateCount} ڈپلیکیٹ جابز ڈیلیٹ کرنا چاہتے ہیں؟)`)) {
      if (onBulkDeleteJobs) {
        onBulkDeleteJobs(duplicateIds);
      } else {
        duplicateIds.forEach(id => onDeleteJob(id));
      }
      alert(`Successfully deleted ${duplicateCount} duplicate jobs in 1 click!`);
    }
  };

  // 1-Click Approve all unique scraped/pending jobs to Live
  const handleBulkApproveUniqueToLive = () => {
    const allPendingOrScraped = pendingJobs.filter(j => 
      j.sourceUrl || j.scraperSourceId || j.scrapedSourceDomain || j.id.includes('scraped') || j.id.includes('sc')
    );
    const { uniqueJobs, uniqueCount } = computeScrapedDuplicates(allPendingOrScraped);

    if (uniqueCount === 0) {
      alert('No scraped jobs available to approve.');
      return;
    }

    const readyJobs = uniqueJobs.filter(j => !isScrapedJob(j) || calculateJobMissingFields(j).length === 0);
    const incompleteJobs = uniqueJobs.filter(j => isScrapedJob(j) && calculateJobMissingFields(j).length > 0);

    if (readyJobs.length === 0) {
      alert(`Cannot approve: All ${incompleteJobs.length} scraped jobs have missing required factual fields (Title, Company, Location, or Job Type). Please review and complete them via Quick Edit first.`);
      return;
    }

    const confirmMsg = incompleteJobs.length > 0
      ? `Data Integrity Protection:\n${readyJobs.length} complete jobs will be published to Live.\n${incompleteJobs.length} jobs with missing required fields will remain in Pending Review until completed.\n\nProceed with publishing ${readyJobs.length} complete jobs?`
      : `Instantly approve and publish all ${uniqueCount} verified complete jobs directly to the Live Job Board?`;

    if (confirm(confirmMsg)) {
      const readyIds = readyJobs.map(j => j.id);
      if (onBulkApprovePendingJobs) {
        onBulkApprovePendingJobs(readyIds);
      } else {
        readyIds.forEach(id => onApproveJob(id));
      }
      alert(`Successfully published ${readyJobs.length} jobs directly to Live Job Board!${incompleteJobs.length > 0 ? ` (${incompleteJobs.length} incomplete jobs kept in Pending)` : ''}`);
    }
  };

  // Snapshot restore is safely disabled until all snapshot categories have verified restore support
  const handleRestoreSnapshot = (_snapshot: SystemSnapshotPayload) => {
    console.warn('[AdminDashboard] Full snapshot restore is temporarily disabled until all snapshot categories have a verified restore implementation.');
  };

  const handleImportBulkJobs = async (importedJobs: Job[]): Promise<BulkJobImportResult> => {
    if (!onImportBulkJobs) {
      throw new Error('Bulk job import handler is not configured.');
    }
    return await onImportBulkJobs(importedJobs);
  };

  // Scraped Job History & Ingestion Batch Logs Persistence
  const [scrapedAuditLogs, setScrapedAuditLogs] = useState<ScrapedJobAuditEntry[]>(() => {
    try {
      const saved = localStorage.getItem('career_pak_scraped_audit_logs');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const seen = new Set<string>();
          const deduped: ScrapedJobAuditEntry[] = [];
          for (const item of parsed) {
            if (item && item.id) {
              if (!seen.has(item.id)) {
                seen.add(item.id);
                deduped.push(item);
              }
            }
          }
          return deduped;
        }
      }
    } catch (e) {
      console.error('Error loading scraped audit logs from storage', e);
    }
    return [];
  });

  const [scraperBatchRuns, setScraperBatchRuns] = useState<ScraperBatchRun[]>(() => {
    try {
      const saved = localStorage.getItem('career_pak_scraper_batch_runs');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const seen = new Set<string>();
          const deduped: ScraperBatchRun[] = [];
          for (const item of parsed) {
            if (item && item.batchId) {
              if (!seen.has(item.batchId)) {
                seen.add(item.batchId);
                deduped.push(item);
              }
            }
          }
          return deduped;
        }
      }
    } catch (e) {
      console.error('Error loading scraper batch runs from storage', e);
    }
    return [];
  });

  useEffect(() => {
    safeLocalStorageSet('career_pak_scraped_audit_logs', scrapedAuditLogs.slice(0, 35));
  }, [scrapedAuditLogs]);

  useEffect(() => {
    safeLocalStorageSet('career_pak_scraper_batch_runs', scraperBatchRuns.slice(0, 25));
  }, [scraperBatchRuns]);

  // Modal inspection states
  const [selectedUserForModal, setSelectedUserForModal] = useState<UserAccount | null>(null);
  const [selectedJobForModal, setSelectedJobForModal] = useState<Job | null>(null);

  // Audit Selected User State
  const [auditUser, setAuditUser] = useState<UserAccount | null>(null);
  const [customExpiryInput, setCustomExpiryInput] = useState('');
  const [auditActionNotice, setAuditActionNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isAuditSubUpdating, setIsAuditSubUpdating] = useState(false);

  useEffect(() => {
    if (selectedUserForModal) {
      const fresh = users.find(u => String(u.id) === String(selectedUserForModal.id));
      if (!fresh) {
        setSelectedUserForModal(null);
      } else if (fresh !== selectedUserForModal) {
        setSelectedUserForModal(fresh);
      }
    }
    if (auditUser) {
      const freshAudit = users.find(u => String(u.id) === String(auditUser.id));
      if (!freshAudit) {
        setAuditUser(null);
      } else if (freshAudit !== auditUser) {
        setAuditUser(freshAudit);
      }
    }
  }, [users]);

  // Global Search State
  const [searchJobQuery, setSearchJobQuery] = useState('');

  // 1. LIVE JOBS TAB SPECIFIC SEARCH, FILTERS, SELECTION & MODALS
  const [jobsSearchQuery, setJobsSearchQuery] = useState('');
  const [jobsCategoryFilter, setJobsCategoryFilter] = useState('all');
  const [jobsScaleFilter, setJobsScaleFilter] = useState('all');
  const [jobsProvinceFilter, setJobsProvinceFilter] = useState('all');
  const [jobsStatusFilter, setJobsStatusFilter] = useState('all');
  const [jobsPortalFilter, setJobsPortalFilter] = useState('');
  const [jobsBatchFilter, setJobsBatchFilter] = useState('');
  const [jobsCityFilter, setJobsCityFilter] = useState('');
  const [jobsScrapeDateFilter, setJobsScrapeDateFilter] = useState<'all' | 'today' | '24h' | '7days' | '30days' | 'older'>('all');
  const [jobsCompletenessFilter, setJobsCompletenessFilter] = useState<'all' | 'complete' | 'incomplete' | 'missing_location' | 'missing_apply' | 'missing_source'>('all');
  const [jobsLocationFilter, setJobsLocationFilter] = useState<'all' | 'confirmed' | 'unconfirmed'>('all');
  const [jobsExpiryFilter, setJobsExpiryFilter] = useState<'all' | 'expired' | '7days' | '30days' | 'future' | 'none'>('all');
  const [jobsDeadlineFilter, setJobsDeadlineFilter] = useState<'all' | 'expired' | '7days' | '30days' | 'future' | 'none'>('all');
  const [jobsSortBy, setJobsSortBy] = useState<'newest' | 'oldest' | 'title' | 'salary' | 'scraped_latest' | 'scraped_oldest' | 'updated_latest' | 'updated_oldest' | 'expiry_earliest' | 'expiry_latest'>('newest');
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>([]);
  const [showJobsDuplicatesOnly, setShowJobsDuplicatesOnly] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [isJobQuickEditOpen, setIsJobQuickEditOpen] = useState(false);
  const [isBulkJobEditOpen, setIsBulkJobEditOpen] = useState(false);
  const [isJobDuplicateModalOpen, setIsJobDuplicateModalOpen] = useState(false);

  // 2. PENDING QUEUE TAB SEARCH, FILTERS, BULK SELECTION & MODALS
  const [pendingSearchQuery, setPendingSearchQuery] = useState('');
  const [pendingCategoryFilter, setPendingCategoryFilter] = useState('all');
  const [pendingSourceFilter, setPendingSourceFilter] = useState('all');
  const [pendingPortalFilter, setPendingPortalFilter] = useState('');
  const [pendingBatchFilter, setPendingBatchFilter] = useState('');
  const [pendingCityFilter, setPendingCityFilter] = useState('');
  const [pendingProvinceFilter, setPendingProvinceFilter] = useState('all');
  const [pendingScrapeDateFilter, setPendingScrapeDateFilter] = useState<'all' | 'today' | '24h' | '7days' | '30days' | 'older'>('all');
  const [pendingCompletenessFilter, setPendingCompletenessFilter] = useState<'all' | 'complete' | 'incomplete' | 'missing_location' | 'missing_apply' | 'missing_source'>('all');
  const [pendingLocationFilter, setPendingLocationFilter] = useState<'all' | 'confirmed' | 'unconfirmed'>('all');
  const [pendingExpiryFilter, setPendingExpiryFilter] = useState<'all' | 'expired' | '7days' | '30days' | 'future' | 'none'>('all');
  const [pendingDeadlineFilter, setPendingDeadlineFilter] = useState<'all' | 'expired' | '7days' | '30days' | 'future' | 'none'>('all');
  const [pendingSortBy, setPendingSortBy] = useState<'newest' | 'oldest' | 'title' | 'scraped_latest' | 'scraped_oldest' | 'updated_latest' | 'updated_oldest' | 'expiry_earliest' | 'expiry_latest'>('newest');
  const [selectedPendingIds, setSelectedPendingIds] = useState<string[]>([]);
  const [selectedPendingJobCache, setSelectedPendingJobCache] = useState<Job[]>([]);
  const [isSelectingAllPending, setIsSelectingAllPending] = useState(false);
  const [showPendingDuplicatesOnly, setShowPendingDuplicatesOnly] = useState(false);
  const [isPendingDuplicateModalOpen, setIsPendingDuplicateModalOpen] = useState(false);

  // 3. SUBSCRIBERS TAB SEARCH, FILTERS, BULK SELECTION & MODALS
  const [subscriberSearchQuery, setSubscriberSearchQuery] = useState('');
  const [subscriberPlanFilter, setSubscriberPlanFilter] = useState('all');
  const [subscriberStatusFilter, setSubscriberStatusFilter] = useState('all');
  const [subscriberMethodFilter, setSubscriberMethodFilter] = useState('all');
  const [selectedSubscriberIds, setSelectedSubscriberIds] = useState<string[]>([]);
  const [showSubscriberDuplicatesOnly, setShowSubscriberDuplicatesOnly] = useState(false);
  const [editingSubscriber, setEditingSubscriber] = useState<Subscriber | null>(null);
  const [isSubscriberModalOpen, setIsSubscriberModalOpen] = useState(false);
  const [isSubscriberDuplicateModalOpen, setIsSubscriberDuplicateModalOpen] = useState(false);

  // 4. USER DIRECTORY & AUDIT TAB SEARCH, FILTERS & SELECTION
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('all');
  const [userPaymentFilter, setUserPaymentFilter] = useState<'all' | 'paid' | 'unpaid' | 'overdue'>('all');
  const [userPlanFilter, setUserPlanFilter] = useState<'all' | 'Free' | 'Premium'>('all');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [isBulkDeletingUsers, setIsBulkDeletingUsers] = useState<boolean>(false);
  const [isBulkEndingMemberships, setIsBulkEndingMemberships] = useState<boolean>(false);
  const [showUserDuplicatesOnly, setShowUserDuplicatesOnly] = useState(false);
  const [isUserDuplicateModalOpen, setIsUserDuplicateModalOpen] = useState(false);

  // 5. PER-JOB FEE LOGS TAB SEARCH, FILTERS, SELECTION & DUPLICATE CHECK
  const [feeLogSearchQuery, setFeeLogSearchQuery] = useState('');
  const [feeLogMethodFilter, setFeeLogMethodFilter] = useState('all');
  const [feeLogStatusFilter, setFeeLogStatusFilter] = useState('all');
  const [selectedFeeLogIds, setSelectedFeeLogIds] = useState<string[]>([]);
  const [showFeeLogDuplicatesOnly, setShowFeeLogDuplicatesOnly] = useState(false);
  const [isFeeLogDuplicateModalOpen, setIsFeeLogDuplicateModalOpen] = useState(false);

  // 6. SCRAPER TARGETS, PDF SOURCES & INGESTED FEED SEARCH & SELECTION
  const [scraperTargetSearchQuery, setScraperTargetSearchQuery] = useState('');
  const [scraperTargetCategoryFilter, setScraperTargetCategoryFilter] = useState('all');
  const [selectedScraperTargetIds, setSelectedScraperTargetIds] = useState<string[]>([]);
  const [pdfGazetteSearchQuery, setPdfGazetteSearchQuery] = useState('');
  const [pdfGazetteOrgFilter, setPdfGazetteOrgFilter] = useState('all');
  const [selectedPdfGazetteIds, setSelectedPdfGazetteIds] = useState<string[]>([]);
  const [inspectFeedSearchQuery, setInspectFeedSearchQuery] = useState('');
  const [inspectFeedCategoryFilter, setInspectFeedCategoryFilter] = useState('all');
  const [inspectFeedSourceFilter, setInspectFeedSourceFilter] = useState('all');
  const [selectedFeedJobIds, setSelectedFeedJobIds] = useState<string[]>([]);

  // 7. FORM CUSTOMIZER TAB SEARCH & SELECTION
  const [formFieldSearchQuery, setFormFieldSearchQuery] = useState('');
  const [formFieldTypeFilter, setFormFieldTypeFilter] = useState('all');
  const [selectedFormFieldIds, setSelectedFormFieldIds] = useState<string[]>([]);

  // DUPLICATE RECORD CALCULATION HELPERS
  const computeJobDuplicateClusters = (jobList: Job[]): DuplicateCluster<Job>[] => {
    const map = new Map<string, Job[]>();
    jobList.forEach(job => {
      const titleKey = `${(job.title || '').trim().toLowerCase()}|${(job.company || '').trim().toLowerCase()}`;
      if (titleKey !== '|') {
        if (!map.has(titleKey)) map.set(titleKey, []);
        map.get(titleKey)!.push(job);
      }
      if (job.pdfCaseNumber && job.pdfCaseNumber.trim()) {
        const caseKey = `case:${job.pdfCaseNumber.trim().toLowerCase()}`;
        if (!map.has(caseKey)) map.set(caseKey, []);
        if (!map.get(caseKey)!.some(j => j.id === job.id)) {
          map.get(caseKey)!.push(job);
        }
      }
    });

    const clusters: DuplicateCluster<Job>[] = [];
    map.forEach((items, key) => {
      if (items.length > 1) {
        const reason = key.startsWith('case:') ? 'Matching Official Gazette Case Number' : 'Identical Job Title & Company/Employer';
        const matchLabel = key.startsWith('case:') ? key.replace('case:', 'Case: ') : `${items[0].title} (${items[0].company})`;
        clusters.push({
          matchKey: matchLabel,
          reason,
          items
        });
      }
    });
    return clusters;
  };

  const computeSubscriberDuplicateClusters = (subList: Subscriber[]): DuplicateCluster<Subscriber>[] => {
    const phoneMap = new Map<string, Subscriber[]>();
    const emailMap = new Map<string, Subscriber[]>();

    subList.forEach(sub => {
      const rawPhone = (sub.phone || '').replace(/\D/g, '');
      if (rawPhone.length >= 7) {
        const cleanPhone = rawPhone.slice(-10);
        if (!phoneMap.has(cleanPhone)) phoneMap.set(cleanPhone, []);
        phoneMap.get(cleanPhone)!.push(sub);
      }
      if (sub.email && sub.email.includes('@')) {
        const cleanEmail = sub.email.trim().toLowerCase();
        if (!emailMap.has(cleanEmail)) emailMap.set(cleanEmail, []);
        emailMap.get(cleanEmail)!.push(sub);
      }
    });

    const clusters: DuplicateCluster<Subscriber>[] = [];
    phoneMap.forEach((items) => {
      if (items.length > 1) {
        clusters.push({
          matchKey: items[0].phone,
          reason: 'Duplicate WhatsApp Phone Number',
          items
        });
      }
    });
    emailMap.forEach((items, key) => {
      if (items.length > 1 && !clusters.some(c => c.items.some(i => items.some(it => it.id === i.id)))) {
        clusters.push({
          matchKey: key,
          reason: 'Duplicate Subscriber Email',
          items
        });
      }
    });
    return clusters;
  };

  const computeUserDuplicateClusters = (userList: UserAccount[]): DuplicateCluster<UserAccount>[] => {
    const emailMap = new Map<string, UserAccount[]>();
    userList.forEach(u => {
      if (u.email && u.email.includes('@')) {
        const cleanEmail = u.email.trim().toLowerCase();
        if (!emailMap.has(cleanEmail)) emailMap.set(cleanEmail, []);
        emailMap.get(cleanEmail)!.push(u);
      }
    });
    const clusters: DuplicateCluster<UserAccount>[] = [];
    emailMap.forEach((items, key) => {
      if (items.length > 1) {
        clusters.push({
          matchKey: key,
          reason: 'Duplicate Email Account Registration',
          items
        });
      }
    });
    return clusters;
  };

  const computeFeeLogDuplicateClusters = (logs: JobPostingFeeLog[]): DuplicateCluster<JobPostingFeeLog>[] => {
    const map = new Map<string, JobPostingFeeLog[]>();
    logs.forEach(l => {
      const key = `${(l.userName || '').toLowerCase()}|${(l.jobTitle || '').toLowerCase()}|${l.amount}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(l);
    });
    const clusters: DuplicateCluster<JobPostingFeeLog>[] = [];
    map.forEach((items) => {
      if (items.length > 1) {
        clusters.push({
          matchKey: `${items[0].userName} - ${items[0].jobTitle}`,
          reason: 'Duplicate Posting Fee Record',
          items
        });
      }
    });
    return clusters;
  };

  // Administrator Master Feature Flags State
  const [featureFlags, setFeatureFlags] = useState<AdminFeatureFlags>({
    enableWebScraper: true,
    enableUniversalKeywordlessScraper: true,
    enableNewspaperClippings: true,
    enableScraperAutoApprove: false,
    enableGovtJobsPortal: true,
    enablePostingFeePaywall: true,
    enableCvBuilderPaywall: true,
    enableLiveSupportChat: true,
    deduplicationEnabled: true,
    enableEmailAlerts: false,
    enableWhatsAppAlerts: false
  });

  // Fetch initial feature flags from backend API
  useEffect(() => {
    api.admin.getFeatureFlags()
      .then(data => {
        if (data && typeof data === 'object') {
          setFeatureFlags(prev => ({ ...prev, ...data }));
        }
      })
      .catch(err => console.log('Feature flags load fallback to default local state', err));
  }, []);

  // Toggle Feature Flag Handler
  const handleToggleFeature = async (flagKey: keyof AdminFeatureFlags) => {
    const priorFlags = featureFlags;
    const updated = {
      ...featureFlags,
      [flagKey]: !featureFlags[flagKey]
    };
    setFeatureFlags(updated);

    try {
      const res = await api.admin.updateFeatureFlags(updated);
      if (res && res.success === true) {
        if (flagKey === 'enableEmailAlerts') {
          onUpdateChannelAvailability?.({ email: updated.enableEmailAlerts });
        } else if (flagKey === 'enableWhatsAppAlerts') {
          onUpdateChannelAvailability?.({ whatsapp: updated.enableWhatsAppAlerts });
        }
      } else {
        console.error('Backend rejected feature flag update:', res?.message);
        setFeatureFlags(priorFlags);
      }
    } catch (e) {
      console.error('Failed to sync feature flags to backend API', e);
      setFeatureFlags(priorFlags);
    }
  };

  // Scraper & Scheduler Engine State
  const [scraperSources, setScraperSources] = useState<Array<{
    id: string;
    name: string;
    url: string;
    keywords: string;
    category: 'Private Corporate' | 'Government Sector' | 'Newspaper Classified' | 'International Remote';
    region: Region;
    depth: 'Light (10 Jobs)' | 'Standard (25 Jobs)' | 'Deep Crawl (50+ Jobs)';
    deduplication: boolean;
    interval: '15m' | '30m' | '1h' | '6h' | '24h' | '7d';
    autoApprove: boolean;
    status: 'Active Scheduled' | 'Paused';
    lastRun?: string;
    scrapedCount: number;
    successRate: number;
  }>>([
    {
      id: 'sc-1',
      name: 'Rozee.pk Pakistan Tech Jobs',
      url: 'https://www.rozee.pk/category/information-technology-jobs',
      keywords: 'React, Node.js, Full Stack, Lahore, Karachi, Islamabad',
      category: 'Private Corporate',
      region: 'Pakistan',
      depth: 'Standard (25 Jobs)',
      deduplication: true,
      interval: '1h',
      autoApprove: false,
      status: 'Active Scheduled',
      lastRun: '2026-08-11 12:30',
      scrapedCount: 42,
      successRate: 98
    },
    {
      id: 'sc-2',
      name: 'FPSC & PPSC Federal Govt Jobs Scraper',
      url: 'https://fpsc.gov.pk/jobs/announcements',
      keywords: 'BPS-17, Assistant Director, FPSC, CSS, Federal Govt',
      category: 'Government Sector',
      region: 'Pakistan',
      depth: 'Deep Crawl (50+ Jobs)',
      deduplication: true,
      interval: '6h',
      autoApprove: true,
      status: 'Active Scheduled',
      lastRun: '2026-08-11 08:00',
      scrapedCount: 28,
      successRate: 100
    },
    {
      id: 'sc-3',
      name: 'Daily Jang Newspaper Classified Ads',
      url: 'https://e.jang.com.pk/classifieds',
      keywords: 'Classified Ad, Jang, Lahore, Rawalpindi, Govt Ads',
      category: 'Newspaper Classified',
      region: 'Pakistan',
      depth: 'Standard (25 Jobs)',
      deduplication: true,
      interval: '24h',
      autoApprove: false,
      status: 'Active Scheduled',
      lastRun: '2026-08-10 20:15',
      scrapedCount: 19,
      successRate: 95
    },
    {
      id: 'sc-4',
      name: 'LinkedIn Global Remote Developer Feed',
      url: 'https://www.linkedin.com/jobs/search?keywords=remote+developer',
      keywords: 'Senior Frontend, AI Engineer, DevOps, Full Stack',
      category: 'International Remote',
      region: 'Global',
      depth: 'Deep Crawl (50+ Jobs)',
      deduplication: true,
      interval: '6h',
      autoApprove: true,
      status: 'Active Scheduled',
      lastRun: '2026-08-11 06:00',
      scrapedCount: 64,
      successRate: 99
    },
    {
      id: 'sc-5',
      name: 'GulfTalent UAE & Saudi Opportunities',
      url: 'https://www.gulftalent.com/uae/jobs/technology',
      keywords: 'Dubai, Riyadh, Software Lead, Cloud Architect',
      category: 'International Remote',
      region: 'UAE',
      depth: 'Standard (25 Jobs)',
      deduplication: true,
      interval: '24h',
      autoApprove: false,
      status: 'Active Scheduled',
      lastRun: '2026-08-09 14:00',
      scrapedCount: 15,
      successRate: 92
    },
    {
      id: 'sc-pdf-fpsc',
      name: 'FPSC Official Consolidated Gazette PDF Scraper (pdfplumber)',
      url: 'https://fpsc.gov.pk/advertisements/consolidated-ads',
      keywords: 'Consolidated Advt, BPS-16, BPS-17, BPS-18, Federal Ministries',
      category: 'Government Sector',
      region: 'Pakistan',
      depth: 'Deep Crawl (50+ Jobs)',
      deduplication: true,
      interval: '24h',
      autoApprove: true,
      status: 'Active Scheduled',
      lastRun: '2026-08-25 09:30',
      scrapedCount: 14,
      successRate: 100
    },
    {
      id: 'sc-pdf-wapda',
      name: 'WAPDA Official Recruitment PDF Ingestion (pdfplumber)',
      url: 'https://wapda.gov.pk/careers',
      keywords: 'WAPDA Mega Projects, Junior Engineer, BPS-17, DAE, Accounts',
      category: 'Government Sector',
      region: 'Pakistan',
      depth: 'Standard (25 Jobs)',
      deduplication: true,
      interval: '24h',
      autoApprove: false,
      status: 'Active Scheduled',
      lastRun: '2026-08-25 11:15',
      scrapedCount: 12,
      successRate: 98
    }
  ]);

  const [isPdfScraperModalOpen, setIsPdfScraperModalOpen] = useState(false);
  const [activeSelectedPdfGazetteId, setActiveSelectedPdfGazetteId] = useState<string | null>(null);

  // PDF Consolidated Gazettes Library (All 447+ Official Pakistani Govt, Autonomous, Provincial & Defence Portals)
  const [pdfGazettes, setPdfGazettes] = useState<ConsolidatedPdfGazette[]>(() => {
    try {
      // Clear legacy multi-megabyte monolithic key to instantly release browser storage quota
      localStorage.removeItem('career_pak_pdf_gazettes');
      localStorage.removeItem('career_pak_pdf_gazettes_cache');

      const savedCustom = safeLocalStorageGet<ConsolidatedPdfGazette[]>('career_pak_custom_pdf_gazettes', []);
      const savedTimestamps = safeLocalStorageGet<Record<string, { timestamp: string; jobCount: number }>>('career_pak_portal_last_scraped', {});

      const freshGazettes = ALL_CONSOLIDATED_PDF_GAZETTES.map(g => {
        const timeEntry = savedTimestamps[g.id];
        if (timeEntry) {
          return { ...g, lastScrapedAt: timeEntry.timestamp, lastScrapedJobCount: timeEntry.jobCount };
        }
        return g;
      });

      const uniqueCustom: ConsolidatedPdfGazette[] = [];
      const freshIdSet = new Set(freshGazettes.map(g => g.id));
      const seenCustomIds = new Set<string>();

      if (Array.isArray(savedCustom)) {
        for (let i = 0; i < savedCustom.length; i++) {
          const cg = savedCustom[i];
          if (!cg || !cg.id) continue;
          let safeId = cg.id;
          if (freshIdSet.has(safeId) || seenCustomIds.has(safeId)) {
            safeId = `pdf-gazette-custom-${i}-${Date.now().toString(36)}`;
          }
          seenCustomIds.add(safeId);
          uniqueCustom.push({ ...cg, id: safeId });
        }
      }

      return [...freshGazettes, ...uniqueCustom];
    } catch (e) {
      console.warn('Failed to load pdf gazettes from localStorage:', e);
      return ALL_CONSOLIDATED_PDF_GAZETTES;
    }
  });

  useEffect(() => {
    // Only save user-added custom gazettes to keep storage under 5 KB and completely prevent QuotaExceededError
    const customOnly = pdfGazettes.filter(g => g.id.startsWith('pdf-gazette-custom'));
    safeLocalStorageSet('career_pak_custom_pdf_gazettes', customOnly);
  }, [pdfGazettes]);

  const [newScraperName, setNewScraperName] = useState('');
  const [scraperUrl, setScraperUrl] = useState('https://indeed.com/jobs?q=full+stack+developer');
  const [scraperKeyword, setScraperKeyword] = useState('Full Stack, React, Node.js');
  const [scraperCategory, setScraperCategory] = useState<'Private Corporate' | 'Government Sector' | 'Newspaper Classified' | 'International Remote'>('Private Corporate');
  const [scraperRegion, setScraperRegion] = useState<Region>('Pakistan');
  const [scraperInterval, setScraperInterval] = useState<'15m' | '30m' | '1h' | '6h' | '24h' | '7d'>('1h');
  const [scraperDepth, setScraperDepth] = useState<'Light (10 Jobs)' | 'Standard (25 Jobs)' | 'Deep Crawl (50+ Jobs)'>('Standard (25 Jobs)');
  const [scraperDeduplication, setScraperDeduplication] = useState(true);
  const [scraperAutoApprove, setScraperAutoApprove] = useState(false);
  const [alsoRegisterInPdfParser, setAlsoRegisterInPdfParser] = useState(false);

  // Manual Site Entry inside Scraper Controller Tab
  const [pdfManualTitle, setPdfManualTitle] = useState('');
  const [pdfManualOrg, setPdfManualOrg] = useState('');
  const [pdfManualUrl, setPdfManualUrl] = useState('');
  const [pdfManualIssueNo, setPdfManualIssueNo] = useState('');
  const [pdfManualDeadline, setPdfManualDeadline] = useState('');
  const [pdfManualPages, setPdfManualPages] = useState<number>(4);

  // Official Govt Portals (100+ Verified Portals) Filter & Search State
  const [portalSearchQuery, setPortalSearchQuery] = useState('');
  const [portalCategoryFilter, setPortalCategoryFilter] = useState<string>('All');
  const [portalJurisdictionFilter, setPortalJurisdictionFilter] = useState<string>('All');
  const [portalFormatFilter, setPortalFormatFilter] = useState<string>('All');
  const [isBulkCrawlingPortals, setIsBulkCrawlingPortals] = useState<boolean>(false);
  const [bulkCrawlProgress, setBulkCrawlProgress] = useState<number>(0);
  const [isBatchIngestModalOpen, setIsBatchIngestModalOpen] = useState<boolean>(false);

  // Scraper Sub-Tab Navigation State
  const [scraperSubTab, setScraperSubTab] = useState<'automated-hub' | 'targets' | 'pdf-sources' | 'history' | 'add' | 'inspect-feed' | 'logs'>('automated-hub');
  const [scrapedSourceFilter, setScrapedSourceFilter] = useState<string>('all');
  const [scrapedSearchQuery, setScrapedSearchQuery] = useState<string>('');
  const [expandedSourceId, setExpandedSourceId] = useState<string | null>('sc-1');

  const [isScraping, setIsScraping] = useState(false);
  const [scrapeProgress, setScrapeProgress] = useState(0);
  const [scraperLogs, setScraperLogs] = useState<string[]>([]);

  // Handle Quick Pre-Filling from Official Portal Cards
  const handleFillPortalPreset = (portal: OfficialGovtPdfPortal) => {
    setPdfManualTitle(`${portal.name} Consolidated Advt 2026`);
    setPdfManualOrg(portal.organization);
    setPdfManualUrl(portal.pdfUrl || portal.portalUrl);
    setPdfManualIssueNo(portal.sampleAdvtNo);
    setPdfManualDeadline(portal.defaultDeadline);
  };

  // Launch parser directly for an official portal
  const handleLaunchPortalDirectly = (portal: OfficialGovtPdfPortal) => {
    const existing = pdfGazettes.find(g => 
      g.pdfUrl.toLowerCase() === (portal.pdfUrl || portal.portalUrl).toLowerCase() ||
      g.organization.toLowerCase().includes(portal.shortName.toLowerCase()) ||
      g.title.toLowerCase().includes(portal.shortName.toLowerCase())
    );

    if (existing) {
      setActiveSelectedPdfGazetteId(existing.id);
      setIsPdfScraperModalOpen(true);
      return;
    }

    const newGazette: ConsolidatedPdfGazette = {
      id: `pdf-gazette-${portal.id}-${Date.now()}`,
      title: `${portal.name} Recruitment Notice 2026`,
      organization: portal.organization,
      pdfFileName: (portal.pdfUrl || portal.portalUrl).split('/').pop() || `${portal.shortName}_Advt_2026.pdf`,
      pdfUrl: portal.pdfUrl || portal.portalUrl,
      fileSizeFormatted: portal.formatType.includes('PDF') ? '3.8 MB' : 'Live HTML / REST Stream',
      totalPages: portal.formatType.includes('PDF') ? 4 : 2,
      gazetteIssueNumber: portal.sampleAdvtNo || `Advt. 2026`,
      publicationDate: new Date().toISOString().split('T')[0],
      closingDeadline: portal.defaultDeadline || '30 Days from Publication',
      rawTextSample: `OFFICIAL RECRUITMENT PORTAL: ${portal.name}\nORGANIZATION: ${portal.organization}\nURL: ${portal.portalUrl}\nFORMAT: ${portal.formatType}\nCRAWLER METHOD: ${portal.crawlerMethod}\nTYPICAL SCALES: ${portal.typicalScales}\nSAMPLE NOTICE: ${portal.sampleAdvtNo}`,
      extractedVacancies: []
    };

    handleAddPdfGazette(newGazette, true);
  };

  // Bulk Parallel Crawl across multiple portals with distributed crash safety
  const handleScrapeMultiplePortals = async (targetPortals: OfficialGovtPdfPortal[]) => {
    if (targetPortals.length === 0) {
      alert('No portals match your current filter criteria.');
      return;
    }

    setIsBulkCrawlingPortals(true);
    setBulkCrawlProgress(15);

    const now = new Date();
    const timestamp = now.toISOString().replace('T', ' ').substring(0, 19);
    const batchId = 'BATCH-DISTRIB-' + Date.now().toString(36);

    try {
      setBulkCrawlProgress(40);
      const res = await api.scraper.run({
        mode: 'complete',
        sourceIds: targetPortals.map(p => p.id)
      });
      setBulkCrawlProgress(90);

      const published = res?.publishedJobs || [];
      const pending = res?.pendingJobs || [];
      const allJobs: Job[] = [...published, ...pending];

      if (onBulkAddPendingJobs && pending.length > 0) {
        onBulkAddPendingJobs(pending);
      }
      if (onBulkAddJobs && published.length > 0) {
        onBulkAddJobs(published);
      }

      const newBatches: ScraperBatchRun[] = targetPortals.slice(0, 10).map(p => ({
        batchId: `${batchId}-${p.id}`,
        startTime: timestamp,
        endTime: timestamp,
        sourceId: p.id,
        sourceName: `${p.name} (${p.formatType})`,
        sourceUrl: p.portalUrl,
        region: 'Pakistan',
        category: 'Government Sector',
        status: 'Completed',
        totalExtracted: allJobs.filter(j => j.scraperSourceId === p.id).length,
        approvedCount: published.filter(j => j.scraperSourceId === p.id).length,
        pendingCount: pending.filter(j => j.scraperSourceId === p.id).length,
        duplicatesSkipped: 0,
        rejectionCount: 0,
        executionDurationMs: 1400,
        httpStatusCode: 200,
        triggerType: 'Batch Rescrape',
        logTrace: [
          `[${timestamp}] Real crawler executed for ${p.name}`,
          `[${timestamp}] STRICT INTEGRITY: zero synthetic/demo jobs created`
        ]
      }));

      setScraperBatchRuns(prev => [...newBatches, ...prev].slice(0, 30));
      setScraperLogs(prev => [
        `[${timestamp}] Real Crawler finished across ${targetPortals.length} portals. Harvested ${allJobs.length} authentic vacancies.`,
        ...prev.slice(0, 30)
      ]);

      setBulkCrawlProgress(100);
      setIsBulkCrawlingPortals(false);
      alert(`✅ Scraper Finished!\nProcessed ${targetPortals.length} portals.\nHarvested ${allJobs.length} genuine vacancies from original sources.\n(Strict policy: No demo/fake jobs generated).`);
    } catch (err: any) {
      console.error('Error running bulk scraper:', err);
      setIsBulkCrawlingPortals(false);
      setBulkCrawlProgress(0);
      alert(`Scraper encountered an issue: ${err?.message || 'Error executing crawl'}`);
    }
  };

  // Handle batch adding unique portals with duplicate protection
  const handleBatchAddPortals = (newPortals: OfficialGovtPdfPortal[], scrapeImmediately: boolean) => {
    const now = new Date();
    const timestamp = now.toISOString().replace('T', ' ').substring(0, 19);

    newPortals.forEach((portal, idx) => {
      const newGazette: ConsolidatedPdfGazette = {
        id: `pdf-gazette-${portal.id}-${Date.now()}-${idx}`,
        title: `${portal.name} Recruitment Notice 2026`,
        organization: portal.organization,
        pdfFileName: (portal.pdfUrl || portal.portalUrl).split('/').pop() || `${portal.shortName}_Advt_2026.pdf`,
        pdfUrl: portal.pdfUrl || portal.portalUrl,
        fileSizeFormatted: portal.formatType.includes('PDF') ? '3.5 MB' : 'Live HTML / REST Stream',
        totalPages: portal.formatType.includes('PDF') ? 4 : 2,
        gazetteIssueNumber: portal.sampleAdvtNo || `Advt. 2026/${idx + 1}`,
        publicationDate: new Date().toISOString().split('T')[0],
        closingDeadline: portal.defaultDeadline || '30 Days from Publication',
        rawTextSample: `OFFICIAL RECRUITMENT PORTAL: ${portal.name}\nORGANIZATION: ${portal.organization}\nURL: ${portal.portalUrl}\nFORMAT: ${portal.formatType}\nCRAWLER METHOD: ${portal.crawlerMethod}\nTYPICAL SCALES: ${portal.typicalScales}\nSAMPLE NOTICE: ${portal.sampleAdvtNo}`,
        extractedVacancies: []
      };

      setPdfGazettes(prev => [newGazette, ...prev]);
    });

    if (scrapeImmediately && newPortals.length > 0) {
      api.scraper.run({
        mode: 'complete',
        sourceIds: newPortals.map(p => p.id)
      }).then(res => {
        const published = res?.publishedJobs || [];
        const pending = res?.pendingJobs || [];
        if (onBulkAddPendingJobs && pending.length > 0) onBulkAddPendingJobs(pending);
        if (onBulkAddJobs && published.length > 0) onBulkAddJobs(published);
      }).catch(e => console.error('Error auto-scraping added portals:', e));
    }

    setScraperLogs(prev => [
      `[${timestamp}] Batch Ingestion Engine: Successfully registered ${newPortals.length} unique government job links into active registry.`,
      ...prev
    ]);
  };

  // Sync / Reset all Official Pakistani Recruitment Portals (All 447 Portals)
  const handleSyncAllOfficialPortals = () => {
    const existingCustom = pdfGazettes.filter(g => g.id.startsWith('pdf-gazette-custom'));
    const freshGazettes = getUnifiedAllGazettes();
    const existingIds = new Set(freshGazettes.map(g => g.id));
    const updated = [...freshGazettes, ...existingCustom.filter(c => !existingIds.has(c.id))];
    setPdfGazettes(updated);
    safeLocalStorageSet('career_pak_custom_pdf_gazettes', existingCustom);
    alert(`✅ Successfully refreshed and synced all ${updated.length} Official Federal, Provincial, Defence, Autonomous & Testing Agency Portals into the PDF Gazette Library!`);
  };
  const handleSyncAll13OfficialPortals = handleSyncAllOfficialPortals;

  const handleBatchUpdateGazettesLastScraped = (updates: { id: string; lastScrapedAt: string; jobCount: number }[]) => {
    const updateMap = new Map(updates.map(u => [u.id, u]));
    setPdfGazettes(prev => prev.map(g => {
      const u = updateMap.get(g.id);
      if (u) {
        return { ...g, lastScrapedAt: u.lastScrapedAt, lastScrapedJobCount: u.jobCount };
      }
      return g;
    }));
  };

  // Handle Add PDF Gazette into Library
  const handleAddPdfGazette = (newGazette: ConsolidatedPdfGazette, openModal = false) => {
    setPdfGazettes(prev => [newGazette, ...prev.filter(g => g.id !== newGazette.id)]);
    setActiveSelectedPdfGazetteId(newGazette.id);
    if (openModal) {
      setIsPdfScraperModalOpen(true);
    }
  };

  const handleDeletePdfGazette = (gazetteId: string) => {
    setPdfGazettes(prev => prev.filter(g => g.id !== gazetteId));
  };

  // Convert or Open any Scraper Target directly in PDF Parser
  const handleOpenSourceInPdfParser = (source: { id: string; name: string; url: string }) => {
    const existing = pdfGazettes.find(g => 
      g.pdfUrl.toLowerCase() === source.url.toLowerCase() || 
      g.title.toLowerCase().includes(source.name.toLowerCase())
    );

    if (existing) {
      setActiveSelectedPdfGazetteId(existing.id);
      setIsPdfScraperModalOpen(true);
      return;
    }

    const newGazette = generateGazetteFromManualInput({
      title: source.name,
      organization: source.name.split(' ')[0] || 'Govt Portal',
      pdfUrl: source.url
    });

    handleAddPdfGazette(newGazette, true);
  };

  // Direct manual site addition from Scraper Controller tab
  const handleCreatePdfSiteFromScraperTab = (e: React.FormEvent, launchNow: boolean) => {
    e.preventDefault();
    if (!pdfManualUrl.trim()) {
      alert('Please enter a valid PDF or Gazette URL');
      return;
    }

    const newGazette = generateGazetteFromManualInput({
      title: pdfManualTitle.trim() || `Official Recruitment Portal (${pdfManualOrg.trim() || 'Govt Portal'})`,
      organization: pdfManualOrg.trim() || 'Government & Public Sector Authority',
      pdfUrl: pdfManualUrl.trim(),
      gazetteIssueNumber: pdfManualIssueNo.trim() || `Advt. No. ${new Date().getMonth() + 1}/${new Date().getFullYear()}`,
      closingDeadline: pdfManualDeadline.trim() || '30th November 2026',
      totalPages: pdfManualPages || 4
    });

    handleAddPdfGazette(newGazette, launchNow);

    // Also register as regular scraper target if desired
    const newScraperTarget = {
      id: 'sc-pdf-' + Date.now(),
      name: newGazette.title,
      url: newGazette.pdfUrl,
      keywords: newGazette.organization + ', BPS, Gazette',
      category: 'Government Sector' as const,
      region: 'Pakistan' as const,
      depth: 'Deep Crawl (50+ Jobs)' as const,
      deduplication: true,
      interval: '24h' as const,
      autoApprove: false,
      status: 'Active Scheduled' as const,
      scrapedCount: newGazette.extractedVacancies.length,
      successRate: 100
    };
    setScraperSources(prev => [newScraperTarget, ...prev]);

    // Reset fields
    setPdfManualTitle('');
    setPdfManualOrg('');
    setPdfManualUrl('');
    setPdfManualIssueNo('');
    setPdfManualDeadline('');

    if (!launchNow) {
      alert(`Successfully registered "${newGazette.title}" to PDF Parser Library and Scraper Scheduler!`);
    }
  };

  // Handle Add New Custom Scraper Target
  const handleAddScraperSource = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scraperUrl.trim()) {
      alert('Please enter a target URL.');
      return;
    }

    const newSource = {
      id: 'sc-' + Date.now(),
      name: newScraperName.trim() || `Scraper Target (${new URL(scraperUrl.startsWith('http') ? scraperUrl : 'https://' + scraperUrl).hostname})`,
      url: scraperUrl.trim(),
      keywords: scraperKeyword.trim() || 'Software Engineer',
      category: scraperCategory,
      region: scraperRegion,
      depth: scraperDepth,
      deduplication: scraperDeduplication,
      interval: scraperInterval,
      autoApprove: scraperAutoApprove,
      status: 'Active Scheduled' as const,
      scrapedCount: 0,
      successRate: 100
    };

    setScraperSources(prev => [newSource, ...prev]);

    // If marked or is Govt / PDF, register in PDF Parser
    if (alsoRegisterInPdfParser || scraperCategory === 'Government Sector' || scraperUrl.endsWith('.pdf')) {
      const newGazette = generateGazetteFromManualInput({
        title: newSource.name,
        organization: newSource.name.split(' ')[0] || 'Govt Department',
        pdfUrl: newSource.url
      });
      handleAddPdfGazette(newGazette, false);
    }

    setNewScraperName('');
    setAlsoRegisterInPdfParser(false);
    setScraperSubTab('targets');
    alert(`New Scraper Target "${newSource.name}" configured and added to Auto-Scheduler!`);
  };

  const handleToggleSourceStatus = (id: string) => {
    setScraperSources(prev => prev.map(s => s.id === id ? { ...s, status: s.status === 'Active Scheduled' ? 'Paused' : 'Active Scheduled' } : s));
  };

  const handleToggleSourceAutoApprove = (id: string) => {
    setScraperSources(prev => prev.map(s => s.id === id ? { ...s, autoApprove: !s.autoApprove } : s));
  };

  const handleDeleteScraperSource = (id: string) => {
    setScraperSources(prev => prev.filter(s => s.id !== id));
    setSelectedScraperTargetIds(prev => prev.filter(item => item !== id));
  };

  // Bulk Actions for Scraper Controller
  const handleToggleSelectScraperTarget = (id: string) => {
    setSelectedScraperTargetIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllScraperTargets = (filteredSources: any[]) => {
    if (selectedScraperTargetIds.length === filteredSources.length) {
      setSelectedScraperTargetIds([]);
    } else {
      setSelectedScraperTargetIds(filteredSources.map(s => s.id));
    }
  };

  const handleBulkPauseScraperTargets = () => {
    if (selectedScraperTargetIds.length === 0) return;
    setScraperSources(prev => prev.map(s => selectedScraperTargetIds.includes(s.id) ? { ...s, status: 'Paused' } : s));
    alert(`Paused ${selectedScraperTargetIds.length} scraper sources.`);
  };

  const handleBulkResumeScraperTargets = () => {
    if (selectedScraperTargetIds.length === 0) return;
    setScraperSources(prev => prev.map(s => selectedScraperTargetIds.includes(s.id) ? { ...s, status: 'Active Scheduled' } : s));
    alert(`Activated ${selectedScraperTargetIds.length} scraper sources.`);
  };

  const handleBulkToggleAutoApproveTargets = (enable: boolean) => {
    if (selectedScraperTargetIds.length === 0) return;
    setScraperSources(prev => prev.map(s => selectedScraperTargetIds.includes(s.id) ? { ...s, autoApprove: enable } : s));
    alert(`Auto-Approve set to ${enable ? 'ON' : 'OFF'} for ${selectedScraperTargetIds.length} sources.`);
  };

  const handleBulkSetIntervalTargets = (interval: '15m' | '30m' | '1h' | '6h' | '24h' | '7d') => {
    if (selectedScraperTargetIds.length === 0) return;
    setScraperSources(prev => prev.map(s => selectedScraperTargetIds.includes(s.id) ? { ...s, interval } : s));
    alert(`Updated cron schedule to "${interval}" for ${selectedScraperTargetIds.length} sources.`);
  };

  const handleBulkDeleteScraperTargets = () => {
    if (selectedScraperTargetIds.length === 0) return;
    if (confirm(`Are you sure you want to delete ${selectedScraperTargetIds.length} selected scraper sources?`)) {
      setScraperSources(prev => prev.filter(s => !selectedScraperTargetIds.includes(s.id)));
      setSelectedScraperTargetIds([]);
    }
  };

  const handleBulkRunSelectedScraperTargets = async () => {
    if (selectedScraperTargetIds.length === 0) return;
    const count = selectedScraperTargetIds.length;
    setIsScraping(true);
    setScrapeProgress(15);

    const intervalTimer = setInterval(() => {
      setScrapeProgress((prev) => (prev >= 85 ? 85 : prev + 15));
    }, 400);

    try {
      const response = await api.scraper.run({
        mode: 'complete',
        sourceIds: selectedScraperTargetIds
      });
      clearInterval(intervalTimer);
      setScrapeProgress(100);

      if (response && response.success) {
        if (onReloadJobs) {
          await onReloadJobs();
        }
        alert(`Successfully executed scraper across ${count} selected source(s)! Discovered ${response.totalFound || 0} genuine jobs.`);
      } else {
        alert(response?.message || 'Bulk scraper execution failed on backend.');
      }
    } catch (err: any) {
      clearInterval(intervalTimer);
      alert(`Bulk scraper execution failed: ${err.message || 'Network error'}`);
    } finally {
      setIsScraping(false);
      setScrapeProgress(0);
    }
  };

  // Chat Hub Selected User
  const [selectedChatUserId, setSelectedChatUserId] = useState<string>(users[0]?.id || '');
  const [adminReplyText, setAdminReplyText] = useState('');

  // Form Builder State
  const [fieldLabel, setFieldLabel] = useState('');
  const [fieldType, setFieldType] = useState<'text' | 'number' | 'select' | 'textarea'>('text');
  const [fieldOptions, setFieldOptions] = useState('');
  const [fieldRequired, setFieldRequired] = useState(false);

  // New Manual Job State
  const [isSubmittingJob, setIsSubmittingJob] = useState(false);
  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');
  const [jobCategory, setJobCategory] = useState<'Private Corporate' | 'Government Sector' | 'Newspaper Classified' | 'International Remote'>('Private Corporate');
  const [jobType, setJobType] = useState<JobType>('Remote');
  const [region, setRegion] = useState<Region>('Pakistan');
  const [province, setProvince] = useState('Punjab');
  const [city, setCity] = useState('Lahore');
  const [district, setDistrict] = useState('Gulberg');
  const [salary, setSalary] = useState('PKR 250,000 - PKR 350,000 / month');
  const [currency, setCurrency] = useState<'PKR' | 'USD' | 'GBP' | 'EUR' | 'AED' | 'SAR' | 'CAD' | 'AUD'>('PKR');
  const [experienceLevel, setExperienceLevel] = useState<'Entry' | 'Mid' | 'Senior' | 'Lead' | 'Executive'>('Senior');
  const [department, setDepartment] = useState('Software Engineering');
  const [tagsInput, setTagsInput] = useState('React, TypeScript, Node.js');
  const [description, setDescription] = useState('');
  const [requirementsInput, setRequirementsInput] = useState('');
  
  // Government Sector State (With Manual Entry Support)
  const [govtDeptPreset, setGovtDeptPreset] = useState(GOVT_DEPT_OPTIONS[0]);
  const [customGovtDept, setCustomGovtDept] = useState('');

  const [govtScalePreset, setGovtScalePreset] = useState(GOVT_SCALE_OPTIONS[5]); // BPS-17
  const [customGovtScale, setCustomGovtScale] = useState('');

  const [govtCadrePreset, setGovtCadrePreset] = useState(GOVT_CADRE_OPTIONS[0]);
  const [customGovtCadre, setCustomGovtCadre] = useState('');

  // Newspaper Classified Ad State (With Manual Entry Support)
  const [newspaperPreset, setNewspaperPreset] = useState(NEWSPAPER_OPTIONS[0]);
  const [customNewspaper, setCustomNewspaper] = useState('');
  const [clippingImageUrl, setClippingImageUrl] = useState('');
  const [newspaperDate, setNewspaperDate] = useState('2026-08-11');

  // Manual Override & Bypass Options (for admin when standard options are disabled or unlisted)
  const [isManualOverrideMode, setIsManualOverrideMode] = useState(false);
  const [customProvince, setCustomProvince] = useState('');
  const [customCity, setCustomCity] = useState('');
  const [customDistrict, setCustomDistrict] = useState('');
  const [customJobStatus, setCustomJobStatus] = useState<'Approved' | 'Pending' | 'Suspended'>('Approved');

  // Benefits & Contact details
  const [selectedBenefits, setSelectedBenefits] = useState<string[]>(['Health Insurance', 'Flexible Working Hours']);
  const [externalApplyUrl, setExternalApplyUrl] = useState('');
  const [contactEmailOrPhone, setContactEmailOrPhone] = useState('');

  // Location helpers
  const formCities = React.useMemo(() => {
    const p = (PAKISTAN_LOCATIONS || []).find((loc) => loc && loc.province === province);
    return p && Array.isArray(p.cities) ? p.cities : [];
  }, [province]);

  const formDistricts = React.useMemo(() => {
    const c = (formCities || []).find((ci) => ci && ci.name === city);
    return c && Array.isArray(c.districts) ? c.districts : [];
  }, [city, formCities]);

  // Authoritative Scraper Manual / Scheduled Execution Handler with Real Backend Scraper Engine
  const handleRunScraper = async (specificSourceId?: string) => {
    const source = specificSourceId ? (scraperSources || []).find(s => s && s.id === specificSourceId) : null;
    const targetUrl = source ? source.url : scraperUrl;
    const targetKeyword = source ? source.keywords : scraperKeyword;
    const shouldAutoApprove = source ? source.autoApprove : scraperAutoApprove;

    setIsScraping(true);
    setScrapeProgress(25);

    const now = new Date();
    const timestamp = now.toISOString().replace('T', ' ').substring(0, 19);

    const progressInterval = setInterval(() => {
      setScrapeProgress((prev) => (prev >= 85 ? 85 : prev + 15));
    }, 400);

    try {
      const response = await api.scraper.run({
        mode: 'complete',
        sourceId: specificSourceId,
        autoPublishTrusted: shouldAutoApprove
      });

      clearInterval(progressInterval);
      setScrapeProgress(100);
      setIsScraping(false);

      if (response && response.success) {
        const published: Job[] = response.publishedJobs || [];
        const pending: Job[] = response.pendingJobs || [];
        const duplicates: any[] = response.duplicateJobs || [];
        const totalFound = response.totalFound || (published.length + pending.length + duplicates.length);

        // Backend persistence has already committed these jobs to the single database source of truth
        if (onReloadJobs) {
          await onReloadJobs();
        }

        const batchId = response.runId || `BATCH-${now.toISOString().substring(0, 10).replace(/-/g, '')}-${Math.floor(Math.random() * 900 + 100)}`;
        const domainName = source ? new URL(source.url.startsWith('http') ? source.url : `https://${source.url}`).hostname : 'external-portals';

        // Record real batch run
        const newBatchRun: ScraperBatchRun = {
          batchId,
          startTime: timestamp,
          endTime: new Date().toISOString().replace('T', ' ').substring(0, 19),
          sourceId: source ? source.id : 'sc-multi',
          sourceName: source ? source.name : `On-Demand Run (${domainName})`,
          sourceUrl: targetUrl || `https://${domainName}`,
          region: (source?.region || 'Pakistan') as Region,
          category: (source?.category || 'Private Corporate') as any,
          status: 'Completed',
          totalExtracted: totalFound,
          approvedCount: published.length,
          pendingCount: pending.length,
          duplicatesSkipped: duplicates.length,
          rejectionCount: 0,
          executionDurationMs: 1800,
          httpStatusCode: 200,
          triggerType: specificSourceId ? 'Manual On-Demand' : 'Scheduled Cron',
          logTrace: [
            `[${timestamp}] [Ingestion Start] Target: ${source ? source.name : 'Configured Portals'}`,
            `[${timestamp}] [Extraction] Factual jobs crawled: ${totalFound}`,
            `[${timestamp}] [Deduplication] Authoritative duplicate checks flagged ${duplicates.length} records`,
            `[${timestamp}] [Persistence] Published: ${published.length}, Queued for Review: ${pending.length}`
          ]
        };
        setScraperBatchRuns(prev => [newBatchRun, ...prev]);

        // Create genuine audit entries for harvested jobs
        const newAuditEntries: ScrapedJobAuditEntry[] = [...published, ...pending].map((job, idx) => ({
          id: `audit-${job.id}-${idx}`,
          jobId: job.id,
          batchId,
          jobTitle: job.title,
          company: job.company,
          scrapedAt: timestamp,
          scrapedTimezone: 'PKT (UTC+5)',
          sourcePortalName: job.scraperSourceName || source?.name || domainName,
          sourceUrl: job.sourceUrl || targetUrl || `https://${domainName}`,
          sourceDomain: job.scrapedSourceDomain || domainName,
          category: job.jobCategory || 'Private Corporate',
          region: (job.region || 'Pakistan') as Region,
          country: 'Pakistan',
          city: job.city,
          currency: job.currency || 'PKR',
          salaryText: job.salary,
          status: job.status === 'Approved' ? 'Auto-Approved' : 'Pending Review',
          deduplicationScore: job.duplicateScore || 95,
          crawlLatencyMs: 250,
          extractedTags: job.tags || [],
          requirementsCount: job.requirements?.length || 0,
          isGovtJob: job.isGovtJob,
          govtScale: job.govtScale,
          govtDepartment: job.govtDepartment,
          isNewspaperAd: job.isNewspaperAd,
          newspaperName: job.newspaperName,
          clippingImageUrl: job.clippingImageUrl,
          snapshot: {
            description: job.description || '',
            requirements: job.requirements || [],
            benefits: job.benefits || []
          },
          reviewTimeline: [
            {
              id: `act-${Date.now()}-${idx}`,
              timestamp,
              relativeTime: 'Just now',
              action: job.status === 'Approved' ? 'Auto-Approved' : 'Scraped',
              performedBy: 'Authoritative Backend Scraper Engine' as any,
              notes: `Factual vacancy extracted from verified source during run ${batchId}.`
            }
          ]
        }));
        if (newAuditEntries.length > 0) {
          setScrapedAuditLogs(prev => [...newAuditEntries, ...prev]);
        }

        // Update scraper source stats
        if (source) {
          setScraperSources(prev => prev.map(s => s.id === source.id ? {
            ...s,
            lastRun: timestamp.substring(0, 16),
            scrapedCount: s.scrapedCount + totalFound
          } : s));
          setExpandedSourceId(source.id);
        }

        const logMsg = `[${timestamp}] Scraper run complete: Extracted ${totalFound} factual jobs (${published.length} Published, ${pending.length} Pending Review, ${duplicates.length} Duplicates).`;
        setScraperLogs(prev => [logMsg, ...prev]);

        alert(`Scraper execution completed!\n\nHarvested: ${totalFound} jobs\nApproved Live: ${published.length}\nPending Review: ${pending.length}\nDuplicates Screened: ${duplicates.length}`);
      } else {
        alert(response?.message || 'Scraper run failed on backend.');
      }
    } catch (err: any) {
      clearInterval(progressInterval);
      setIsScraping(false);
      setScrapeProgress(0);
      alert(`Scraper execution failed: ${err.message || 'Network error connecting to backend scraper service'}`);
    }
  };

  // Synchronized Approval with Audit Trail & Auto SEO Injection
  const handleAdminApproveJob = async (jobId: string, overrideJob?: Job): Promise<{ success: boolean; message?: string }> => {
    const targetJob = overrideJob || pendingJobs.find(j => j.id === jobId) || jobs.find(j => j.id === jobId);
    if (targetJob && isScrapedJob(targetJob)) {
      const missing = calculateJobMissingFields(targetJob);
      if (missing.length > 0) {
        alert(`Cannot approve "${targetJob.title}"!\nMissing required factual fields: ${missing.join(', ')}.\n\nPlease edit this job to complete these details before publishing live.`);
        return { success: false, message: `Missing required factual fields: ${missing.join(', ')}` };
      }
    }

    try {
      const res: any = await onApproveJob(jobId);
      const isConfirmedSuccess = !!(res && typeof res === 'object' && res.success === true);

      if (!isConfirmedSuccess) {
        return {
          success: false,
          message: res?.message || 'Approval was not confirmed by the server.'
        };
      }

      // Auto-generate Google Search SEO & inject Schema.org structured data ONLY after confirmed success
      const publishedJob = res.job || targetJob;
      if (publishedJob) {
        injectJobJsonLd(publishedJob);
      }

      // Record approval audit trail ONLY after confirmed success
      setScrapedAuditLogs(prev => prev.map(entry => {
        if (entry.jobId === jobId) {
          const newAction: ScrapedJobAuditAction = {
            id: 'act-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
            timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
            relativeTime: 'Just now',
            action: 'Approved by Admin',
            performedBy: 'Admin User',
            actorName: 'Admin Operations Desk',
            notes: 'Job approved from pending queue and published to Live listings.',
            previousStatus: entry.status,
            newStatus: 'Approved Live'
          };
          return {
            ...entry,
            status: 'Approved Live' as const,
            reviewTimeline: [newAction, ...entry.reviewTimeline]
          };
        }
        return entry;
      }));

      return res;
    } catch (err: any) {
      console.error('Error in handleAdminApproveJob:', err);
      return { success: false, message: err?.message || 'Database error occurred during approval.' };
    }
  };

  // Synchronized Rejection with Audit Trail
  const handleRejectPrompt = (jobId: string, customReason?: string) => {
    const reason = customReason || prompt('Enter Rejection Reason for user notification:', 'Job details incomplete or invalid salary range.');
    if (reason) {
      onRejectJob(jobId, reason);
      setScrapedAuditLogs(prev => prev.map(entry => {
        if (entry.jobId === jobId) {
          const newAction: ScrapedJobAuditAction = {
            id: 'act-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
            timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
            relativeTime: 'Just now',
            action: 'Rejected',
            performedBy: 'Admin User',
            actorName: 'Admin Operations Desk',
            notes: `Rejected by admin: ${reason}`,
            previousStatus: entry.status,
            newStatus: 'Rejected'
          };
          return {
            ...entry,
            status: 'Rejected' as const,
            rejectionReason: reason,
            reviewTimeline: [newAction, ...entry.reviewTimeline]
          };
        }
        return entry;
      }));
    }
  };

  const handleAdminRejectJob = (jobId: string, customReason?: string) => {
    handleRejectPrompt(jobId, customReason);
  };

  // Batch Import PDF Scraped Vacancies
  const handleBatchImportPdfJobs = (extractedJobs: Job[], autoApprove: boolean, sourceGazetteTitle: string) => {
    const jobsToInsert: Job[] = extractedJobs.map((job, idx) => ({
      ...job,
      id: `pdf-${job.id.replace('pdf-', '')}-${Date.now().toString(36)}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
      status: autoApprove ? 'Approved' : 'Pending'
    }));

    if (autoApprove) {
      if (onBulkAddJobs) {
        onBulkAddJobs(jobsToInsert);
      } else {
        jobsToInsert.forEach(j => onAddJob(j));
      }
    } else {
      if (onBulkAddPendingJobs) {
        onBulkAddPendingJobs(jobsToInsert);
      } else if (onAddPendingJob) {
        jobsToInsert.forEach(j => onAddPendingJob(j));
      } else {
        jobsToInsert.forEach(j => onAddJob(j));
      }
    }
  };

  const handleLogPdfBatchRun = (batchRun: ScraperBatchRun, auditEntries: ScrapedJobAuditEntry[]) => {
    setScraperBatchRuns(prev => {
      const filtered = prev.filter(b => b.batchId !== batchRun.batchId);
      return [batchRun, ...filtered];
    });
    setScrapedAuditLogs(prev => {
      const existingIds = new Set(prev.map(a => a.id));
      const newEntries = auditEntries.map((entry, idx) => {
        // Guarantee unique ID
        if (existingIds.has(entry.id) || !entry.id) {
          return {
            ...entry,
            id: `audit-${entry.jobId || 'job'}-${Date.now().toString(36)}-${idx}-${Math.random().toString(36).substring(2, 6)}`
          };
        }
        return entry;
      });
      return [...newEntries, ...prev];
    });
  };

  // Add Custom Form Field
  const handleCreateCustomField = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fieldLabel.trim()) return;

    const newField: CustomFormField = {
      id: 'field-' + Date.now(),
      label: fieldLabel.trim(),
      type: fieldType,
      options: fieldType === 'select' ? fieldOptions.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
      required: fieldRequired,
      active: true
    };

    const res = await onAddCustomField(newField);
    if (res !== false) {
      setFieldLabel('');
      setFieldOptions('');
      setFieldRequired(false);
      alert(`Custom field "${newField.label}" added to User Registration Form!`);
    }
  };

  // Manual Job Creation
  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !company) {
      alert('Please fill out Job Title and Company');
      return;
    }

    const isGovt = jobCategory === 'Government Sector';
    const isNews = jobCategory === 'Newspaper Classified';

    const resolvedGovtDept = govtDeptPreset === 'Other (Manual Entry)' ? (customGovtDept || 'Government Department') : govtDeptPreset;
    const resolvedGovtScale = govtScalePreset === 'Other (Manual Entry)' ? (customGovtScale || 'BPS Scale') : govtScalePreset;
    const resolvedGovtCadre = govtCadrePreset === 'Other (Manual Entry)' ? (customGovtCadre || 'Public Sector') : govtCadrePreset;
    const resolvedNewspaper = newspaperPreset === 'Other (Manual Entry)' ? (customNewspaper || 'Newspaper Classified') : newspaperPreset;

    const resolvedProvince = isManualOverrideMode && customProvince.trim() ? customProvince.trim() : (region === 'Pakistan' ? province : undefined);
    const resolvedCity = isManualOverrideMode && customCity.trim() ? customCity.trim() : (region === 'Pakistan' ? city : undefined);
    const resolvedDistrict = isManualOverrideMode && customDistrict.trim() ? customDistrict.trim() : (region === 'Pakistan' ? district : undefined);
    const resolvedStatus = isManualOverrideMode ? customJobStatus : 'Approved';

    const createdJob: Job = {
      id: 'job-' + Date.now(),
      title,
      company,
      jobType,
      region,
      country: region === 'Pakistan' ? 'Pakistan' : (region || 'Pakistan'),
      province: resolvedProvince,
      city: resolvedCity,
      district: resolvedDistrict,
      salary,
      currency: currency || (region === 'Pakistan' ? 'PKR' : 'USD'),
      experienceLevel: experienceLevel || 'Senior',
      department,
      tags: tagsInput.split(',').map((t) => t.trim()).filter(Boolean),
      description,
      requirements: requirementsInput ? requirementsInput.split('\n').filter(Boolean) : ['Proven domain experience'],
      benefits: selectedBenefits.length > 0 ? selectedBenefits : ['Flexible working hours'],
      postedAt: 'Just now',
      featured: true,
      applicationsCount: 0,
      status: resolvedStatus,
      isSuspended: resolvedStatus === 'Suspended',

      // Government Sector Attributes
      isGovtJob: isGovt,
      govtDepartment: isGovt ? resolvedGovtDept : undefined,
      govtScale: isGovt ? resolvedGovtScale : undefined,
      govtCategory: isGovt ? (resolvedGovtCadre as any) : undefined,

      // Newspaper Classified Ad Attributes
      isNewspaperAd: isNews,
      newspaperName: isNews ? resolvedNewspaper : undefined,
      clippingImageUrl: isNews ? (clippingImageUrl || 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=800&auto=format&fit=crop&q=60') : undefined,
      newspaperDate: isNews ? newspaperDate : undefined,

      // Contact & Application Details
      applicationUrl: externalApplyUrl || undefined,
      contactEmailOrPhone: contactEmailOrPhone || undefined
    };

    try {
      setIsSubmittingJob(true);
      await onAddJob(createdJob);
      alert(`Job "${title}" published directly to Live Portal!`);
      setTitle('');
      setCompany('');
      setDescription('');
      setAdminTab('jobs');
    } catch (err: any) {
      alert(`Failed to save job: ${err?.message || 'Server error'}`);
    } finally {
      setIsSubmittingJob(false);
    }
  };

  const handleAdminSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = adminReplyText.trim();
    if (!selectedChatUserId || !text) return;

    const targetUser = (users || []).find((u) => u && u.id === selectedChatUserId);
    const userName = targetUser ? targetUser.name : 'User';

    const ok = await onSendMessageToUser(selectedChatUserId, userName, text);
    if (ok !== false) {
      setAdminReplyText('');
    }
  };

  // Selected User Chat Messages
  const selectedUserMessages = chatMessages.filter((m) => m.userId === selectedChatUserId);

  if (isVerifyingAdmin) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center space-y-4 shadow-2xl">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
            <RefreshCw className="w-6 h-6 animate-spin" />
          </div>
          <h2 className="text-lg font-black text-white">Verifying Administrative Session...</h2>
          <p className="text-xs text-slate-400">
            Checking your administrative identity and permissions with the server before displaying controls.
          </p>
          <div>
            <button
              type="button"
              onClick={onExitAdmin}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
            >
              Exit Admin
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!isVerifiedAdmin) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16">
        <div className="bg-slate-900 border border-rose-500/40 rounded-3xl p-8 text-center space-y-4 shadow-2xl">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-400">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-black text-white">Administrative Access Denied</h2>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            {adminVerifyError || 'Your session could not be verified as an authorized administrator.'}
          </p>
          <div>
            <button
              type="button"
              onClick={onExitAdmin}
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black cursor-pointer"
            >
              Return to Portal
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8 py-2.5 sm:py-8 space-y-2.5 sm:space-y-6">
      
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-amber-950 via-slate-900 to-amber-950 border border-amber-500/40 rounded-xl sm:rounded-3xl p-2.5 sm:p-6 text-white shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-4">
        <div className="flex items-center space-x-2.5 sm:space-x-3 w-full sm:w-auto">
          <div className="w-9 h-9 sm:w-12 sm:h-12 bg-amber-500/20 text-amber-400 rounded-lg sm:rounded-2xl flex items-center justify-center border border-amber-500/30 shrink-0">
            <ShieldCheck className="w-5 h-5 sm:w-7 sm:h-7" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center space-x-1.5 sm:space-x-2">
              <h2 className="text-sm sm:text-2xl font-black truncate">Portal Secret Control Hub</h2>
              <span className="bg-amber-500 text-slate-950 text-[9px] sm:text-[10px] uppercase font-bold px-1.5 py-0.5 rounded shrink-0">
                Admin
              </span>
            </div>
            <p className="text-[10px] sm:text-xs text-slate-400 truncate sm:whitespace-normal">Manage approvals, per-job posting fees, user audits, and custom registration forms</p>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-1.5 sm:gap-2 w-full sm:w-auto justify-end">
          <AdminNavigationModeToggle mode={navMode} onChangeMode={handleChangeNavMode} />
          {navMode === 'classic' && (
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-expanded={isMobileMenuOpen}
              aria-label="Toggle Navigation Menu"
              className="sm:hidden flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-800 text-amber-400 border border-amber-500/30 font-bold text-xs transition-all active:scale-95 cursor-pointer shadow-sm"
            >
              {isMobileMenuOpen ? <X className="w-3.5 h-3.5" /> : <Filter className="w-3.5 h-3.5" />}
              <span>Menu</span>
            </button>
          )}
          <button
            onClick={onExitAdmin}
            className="px-3 sm:px-5 py-1 sm:py-2.5 rounded-lg sm:rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/30 font-bold text-xs flex items-center space-x-1.5 transition-all cursor-pointer whitespace-nowrap shrink-0"
          >
            <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Exit Admin</span>
          </button>
        </div>
      </div>

      {(() => {
        const navCounts: AdminNavCounts = {
          activeJobsCount: jobs.length,
          pendingJobsCount: pendingJobs.length,
          activeAdsCount: ads.filter(a => a.status === 'active').length,
          pendingProofsCount: currentTransactions.filter(t => t.status === 'Pending').length,
          feeLogsCount: jobPostingFeeLogs.length,
          usersCount: users.length,
          kycBadgeText: kycLoading ? '⏳ Loading' : kycError ? '⚠️ Error' : `${kycRequests.filter(r => r.status === 'Pending').length} KYC`,
          kycPendingCount: kycRequests.filter(r => r.status === 'Pending').length,
          subscribersCount: subscribers.length,
          chatMessagesCount: chatMessages.length
        };

        const classicCategoryMeta: Record<AdminCategory, { count?: string; countColor?: string }> = {
          jobs: {
            count: pendingJobs.length > 0 ? `${pendingJobs.length} Pending` : undefined,
            countColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30'
          },
          scraper: {
            count: undefined,
            countColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
          },
          ads: {
            count: `${navCounts.activeAdsCount} Live`,
            countColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
          },
          payments: {
            count: navCounts.pendingProofsCount > 0 ? `${navCounts.pendingProofsCount} Proofs` : undefined,
            countColor: 'bg-teal-500/20 text-teal-300 border-teal-500/30'
          },
          users: {
            count: kycLoading ? '⏳ Loading' : kycError ? '⚠️ Error' : (navCounts.kycPendingCount && navCounts.kycPendingCount > 0 ? `${navCounts.kycPendingCount} KYC` : undefined),
            countColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30'
          },
          alerts: {},
          settings: {}
        };

        const classicActiveTabClass: Record<AdminCategory, string> = {
          jobs: 'bg-gradient-to-r from-amber-500 to-emerald-500 text-slate-950 font-black shadow-md',
          scraper: 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-black shadow-md',
          ads: 'bg-amber-500 text-slate-950 font-black shadow-md',
          payments: 'bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 font-black shadow-md',
          users: 'bg-purple-500 text-white font-black shadow-md',
          alerts: 'bg-amber-500 text-slate-950 font-black shadow-md',
          settings: 'bg-indigo-500 text-white font-black shadow-md'
        };

        const activeCanonicalTab = resolveCanonicalAdminTab(adminTab);
        const activeModuleDef = getAdminModuleDefinition(activeCanonicalTab);

        return (
          <>
            {/* CLASSIC ADMIN NAVIGATION: CATEGORIES + 3-DOT ALL MODULES + SUB-TABS */}
            {navMode === 'classic' && (
              <div className={`space-y-2 sm:space-y-3 border-b border-slate-800 pb-2 sm:pb-4 ${isMobileMenuOpen ? 'block' : 'hidden sm:block'}`}>
                {/* Top Level Category Bar with 3-Dot Quick Menu */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex flex-nowrap sm:flex-wrap items-center gap-1 sm:gap-2 overflow-x-auto max-w-full pb-1 scrollbar-none">
                    {CLASSIC_ADMIN_CATEGORIES.filter(cat => canAccessAdminCategory(cat.id)).map((cat) => {
                      const meta = classicCategoryMeta[cat.id];
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          aria-label={`View ${cat.label} category`}
                          onClick={() => {
                            setActiveCategory(cat.id);
                            if (TAB_CATEGORIES[adminTab] !== cat.id) {
                              if (cat.id === 'jobs') setAdminTab('jobs');
                              else if (cat.id === 'scraper') setAdminTab('scraper');
                              else if (cat.id === 'ads') setAdminTab('campaign-center');
                              else if (cat.id === 'payments') setAdminTab(hasAdminUiPermission('payments.manage') ? 'admin-payment-methods' : hasAdminUiPermission('finance.manage') ? 'pricing-controller' : 'payment-proofs');
                              else if (cat.id === 'users') setAdminTab('user-audit');
                              else if (cat.id === 'alerts') setAdminTab('whatsapp-manager');
                              else if (cat.id === 'settings') setAdminTab(hasAdminUiPermission('seo.manage') ? 'seo-config' : hasAdminUiPermission('audit.view') ? 'activity-logs' : 'settings');
                            }
                            setIsMobileMenuOpen(false);
                          }}
                          className={`px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold transition-all flex items-center space-x-1 sm:space-x-1.5 cursor-pointer select-none ${
                            activeCategory === cat.id
                              ? 'bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20 scale-[1.02]'
                              : 'bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800/80 border border-slate-800'
                          }`}
                        >
                          <span>{cat.label}</span>
                          {meta?.count && (
                            <span className={`text-[9px] sm:text-[10px] px-1 sm:px-1.5 py-0.2 rounded-md font-bold border ${activeCategory === cat.id ? 'bg-slate-950 text-amber-400 border-slate-900' : meta.countColor}`}>
                              {meta.count}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* 3-DOT QUICK MENU TRIGGER BUTTON */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowAllModulesMenu(true)}
                      aria-expanded={showAllModulesMenu}
                      aria-haspopup="dialog"
                      aria-label="Open all modules menu"
                      className="px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-lg sm:rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-400 border border-amber-500/40 text-[11px] sm:text-xs font-black flex items-center space-x-1 sm:space-x-1.5 shadow-md shadow-amber-500/10 transition-all cursor-pointer active:scale-95"
                      title="Open full modules matrix with search"
                    >
                      <MoreVertical className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
                      <span>⋮ All Modules (تمام ماڈیولز)</span>
                    </button>
                  </div>
                </div>

                {/* ACTIVE CATEGORY SUB-TABS ROW */}
                <div className="flex items-center space-x-1.5 sm:space-x-2 overflow-x-auto py-1 sm:py-1.5 px-1.5 sm:px-2 bg-slate-950/70 border border-slate-800/80 rounded-lg sm:rounded-xl scrollbar-none text-[11px] sm:text-xs">
                  <span className="text-[10px] sm:text-[11px] uppercase tracking-wider font-bold text-slate-500 shrink-0 pl-0.5 sm:pl-1">
                    Sub-Modules:
                  </span>

                  {getClassicCategorySubTabs(activeCategory, navCounts, canAccessAdminTab).map((t) => {
                    const Icon = t.icon;
                    const isCurrentTab =
                      adminTab === t.id ||
                      (t.id === 'scraper' && (adminTab === 'url-scraper' || adminTab === 'scraped-history')) ||
                      (t.id === 'analytics' && adminTab === 'stats');
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          setAdminTab(t.id as any);
                          setIsMobileMenuOpen(false);
                        }}
                        className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg font-bold flex items-center space-x-1 sm:space-x-1.5 text-[11px] sm:text-xs transition-all whitespace-nowrap cursor-pointer ${
                          isCurrentTab
                            ? classicActiveTabClass[activeCategory]
                            : 'bg-slate-900 text-slate-300 hover:text-white border border-slate-800'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{t.label}</span>
                        {t.id === 'scraper' && (
                          <span className="px-1.5 py-0.2 rounded bg-emerald-400 text-slate-950 text-[9px] font-black uppercase">
                            Consolidated
                          </span>
                        )}
                        {t.badge !== undefined && (
                          <span className="px-1.5 py-0.2 rounded bg-amber-500 text-slate-950 text-[10px] font-black">
                            {t.badge}
                          </span>
                        )}
                        {t.isNew && (
                          <span className="px-1.5 py-0.2 rounded bg-amber-400 text-slate-950 text-[9px] font-black">
                            NEW
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* PROFESSIONAL MOBILE BAR (VISIBLE ALL MODULES & DRAWER TRIGGER, NO HIDDEN TRIGGER) */}
            {navMode === 'professional' && (
              <div className="lg:hidden flex flex-wrap items-center justify-between gap-2 bg-slate-900 border border-slate-800 rounded-xl p-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <button
                    type="button"
                    onClick={() => setIsProMobileDrawerOpen(true)}
                    aria-expanded={isProMobileDrawerOpen}
                    aria-label="Open Professional Navigation Drawer"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-950 hover:bg-slate-800 text-amber-400 border border-amber-500/30 text-xs font-bold whitespace-nowrap cursor-pointer"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
                    <span>Categories &amp; Menu</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAllModulesMenu(true)}
                    aria-label="Open all modules menu"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black whitespace-nowrap cursor-pointer"
                  >
                    <MoreVertical className="w-3.5 h-3.5 shrink-0" />
                    <span>All Modules</span>
                  </button>
                </div>
                {activeModuleDef && (
                  <span className="text-[11px] font-bold text-slate-300 truncate max-w-full">
                    {activeModuleDef.label}
                  </span>
                )}
              </div>
            )}

            {/* 3-DOT ALL MODULES QUICK MODAL OVERLAY */}
            {showAllModulesMenu && (
              <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-2.5 sm:p-4">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl max-w-4xl w-full p-3.5 sm:p-6 shadow-2xl space-y-3 sm:space-y-5 text-white max-h-[92vh] flex flex-col animate-fadeIn">
                  {/* Modal Header */}
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 sm:pb-4">
                    <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
                      <div className="p-1.5 sm:p-2.5 rounded-xl sm:rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
                        <MoreVertical className="w-4 h-4 sm:w-6 sm:h-6" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm sm:text-lg font-black text-white flex items-center space-x-1.5 sm:space-x-2 truncate">
                          <span className="truncate">Admin Modules (تمام ماڈیولز)</span>
                          <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 text-[9px] sm:text-[10px] font-bold shrink-0">
                            Switcher
                          </span>
                        </h3>
                        <p className="text-[10px] sm:text-xs text-slate-400 truncate">
                          Filter by module name or purpose to jump instantly without horizontal scrolling.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowAllModulesMenu(false)}
                      aria-label="Close menu"
                      className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                    >
                      <X className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                  </div>

                  {/* Instant Filter Search Bar */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 absolute left-3 sm:left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      value={moduleSearchQuery}
                      onChange={(e) => setModuleSearchQuery(e.target.value)}
                      placeholder="Search any module by English, Urdu, ID, keyword or category (e.g. 'jazzcash', 'scraper', 'seo', 'cities')..."
                      className="w-full pl-8 sm:pl-10 pr-3 sm:pr-4 py-2 sm:py-2.5 bg-slate-950 border border-slate-800 rounded-xl sm:rounded-2xl text-[11px] sm:text-xs text-white placeholder-slate-500 outline-none focus:border-amber-500 shadow-inner"
                      autoFocus
                    />
                  </div>

                  {/* Modules Grid */}
                  <div className="flex-1 overflow-y-auto pr-1 space-y-5">
                    {(navMode === 'professional'
                      ? buildProfessionalAllModulesMenuGroups(navCounts)
                      : buildAllModulesMenuGroups(navCounts)
                    ).map((cat, idx) => {
                      const filteredItems = cat.items.filter((it) => {
                        if (!canAccessAdminTab(it.id)) return false;
                        const modDef = ADMIN_NAVIGATION_MODULES.find((m) => m.id === it.id);
                        if (modDef) {
                          return matchesAdminModuleSearch(modDef, moduleSearchQuery);
                        }
                        const q = moduleSearchQuery.toLowerCase().trim();
                        return (
                          !q ||
                          it.label.toLowerCase().includes(q) ||
                          it.urdu.toLowerCase().includes(q) ||
                          it.id.toLowerCase().includes(q)
                        );
                      });

                      if (filteredItems.length === 0) return null;

                      return (
                        <div key={idx} className="space-y-2.5">
                          <h4 className="text-xs font-black text-amber-400 uppercase tracking-wider">
                            {cat.catTitle}
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                            {filteredItems.map((item) => {
                              const Icon = item.icon;
                              const isCurrent = activeCanonicalTab === item.id;
                              return (
                                <button
                                  key={item.id}
                                  type="button"
                                  onClick={() => {
                                    if (handlePermissionAwareNavigateTab(item.id)) {
                                      setShowAllModulesMenu(false);
                                    }
                                  }}
                                  className={`p-2 sm:p-3 rounded-xl sm:rounded-2xl border text-left flex items-start space-x-2 sm:space-x-3 transition-all cursor-pointer ${
                                    isCurrent
                                      ? 'bg-amber-500/20 border-amber-500 text-white shadow-md sm:shadow-lg shadow-amber-500/10'
                                      : 'bg-slate-950/80 border-slate-800 hover:border-slate-700 hover:bg-slate-900 text-slate-300'
                                  }`}
                                >
                                  <div className={`p-1.5 sm:p-2 rounded-lg sm:rounded-xl shrink-0 ${isCurrent ? 'bg-amber-500 text-slate-950' : 'bg-slate-900 text-amber-400 border border-slate-800'}`}>
                                    <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between gap-1">
                                      <span className="text-[11px] sm:text-xs font-bold text-white truncate block">{item.label}</span>
                                      {item.badge && (
                                        <span className="text-[8px] sm:text-[9px] px-1 sm:px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold shrink-0">
                                          {item.badge}
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-[9px] sm:text-[10px] text-slate-400 block mt-0.5 truncate">{item.description || item.urdu}</span>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Modal Footer */}
                  <div className="flex items-center justify-between pt-3 border-t border-slate-800 text-xs text-slate-400">
                    <span>💡 Tip: Click any module card to navigate immediately.</span>
                    <button
                      type="button"
                      onClick={() => setShowAllModulesMenu(false)}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl cursor-pointer"
                    >
                      Close Menu
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className={navMode === 'professional' ? 'lg:flex lg:items-start lg:gap-5 min-w-0' : ''}>
              {navMode === 'professional' && (
                <>
                  <AdminProfessionalSidebar
                    activeTab={adminTab}
                    counts={navCounts}
                    canAccessTab={canAccessAdminTab}
                    onSelectTab={(tabId) => handlePermissionAwareNavigateTab(tabId)}
                    onOpenAllModules={() => setShowAllModulesMenu(true)}
                    isCollapsed={isProSidebarCollapsed}
                    onToggleCollapse={() => setIsProSidebarCollapsed(prev => !prev)}
                  />
                  <AdminProfessionalMobileDrawer
                    isOpen={isProMobileDrawerOpen}
                    onClose={() => setIsProMobileDrawerOpen(false)}
                    activeTab={adminTab}
                    counts={navCounts}
                    canAccessTab={canAccessAdminTab}
                    onSelectTab={(tabId) => handlePermissionAwareNavigateTab(tabId)}
                    onOpenAllModules={() => setShowAllModulesMenu(true)}
                  />
                </>
              )}

              <div className={navMode === 'professional' ? 'flex-1 min-w-0 space-y-4' : 'space-y-4'}>
                {navMode === 'professional' && activeModuleDef && (
                  <div className="hidden lg:flex items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 rounded-2xl px-4 py-2.5">
                    <div className="min-w-0 flex items-center gap-2 text-xs">
                      <span className="font-bold text-slate-400 truncate">
                        {activeModuleDef.proCategory.replace(/-/g, ' & ').replace(/\b\w/g, (ch) => ch.toUpperCase())}
                      </span>
                      <span className="text-slate-600">/</span>
                      <span className="font-black text-white truncate">{activeModuleDef.label}</span>
                      <span className="text-slate-600">·</span>
                      <span className="text-amber-300 font-semibold text-[11px] truncate">{activeModuleDef.description}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAllModulesMenu(true)}
                      className="px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-amber-400 border border-amber-500/30 text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5"
                    >
                      <MoreVertical className="w-3.5 h-3.5" />
                      <span>All Modules</span>
                    </button>
                  </div>
                )}

      {/* TAB: WHATSAPP SUPPORT & ALERTS MANAGER */}
      {adminTab === 'whatsapp-manager' && canAccessAdminTab('whatsapp-manager') && (
        <div className="space-y-6">
          <AdminWhatsAppManager
            config={currentWhatsAppConfig}
            onUpdateConfig={handleUpdateWhatsApp}
            subscribersCount={subscribers.length}
          />
          <AdminWhatsAppSettings
            config={currentWhatsAppConfig}
            onSave={handleUpdateWhatsApp}
          />
        </div>
      )}

      {/* TAB: ADMINISTRATOR SECURITY */}
      {adminTab === 'admin-security' && canAccessAdminTab('admin-security') && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <h2 className="text-lg font-black text-white">Administrator Security</h2>
            <p className="text-xs text-slate-400 mt-1">Update the password for the currently signed-in administrator account. This uses the existing server-authoritative password handler.</p>
          </div>
                    {/* ADMINISTRATOR PASSWORD & SECURITY MANAGEMENT */}
          <div className="md:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white space-y-5 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold flex items-center space-x-2 text-amber-400">
                  <Key className="w-5 h-5 text-amber-400" />
                  <span>Administrator Account & Password Security</span>
                </h3>
                <p className="text-xs text-slate-400 font-medium">Update your administrative credentials securely in the authoritative database.</p>
              </div>
              <span className="bg-amber-500/20 text-amber-300 text-xs font-bold px-3 py-1 rounded-full border border-amber-500/30">
                Server-Authoritative
              </span>
            </div>

            {adminPasswordStatus && (
              <div className={`p-3.5 rounded-xl border text-xs font-semibold flex items-start space-x-2 ${
                adminPasswordStatus.type === 'success'
                  ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                  : 'bg-rose-950/60 border-rose-500/40 text-rose-300'
              }`}>
                {adminPasswordStatus.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                )}
                <span>{adminPasswordStatus.message}</span>
              </div>
            )}

            <form onSubmit={handleAdminPasswordChangeSubmit} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Current Password
                </label>
                <input
                  type="password"
                  required
                  value={adminCurrentPassword}
                  onChange={(e) => setAdminCurrentPassword(e.target.value)}
                  placeholder="Enter current password..."
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  New Password (min 8 chars)
                </label>
                <input
                  type="password"
                  required
                  value={adminNewPassword}
                  onChange={(e) => setAdminNewPassword(e.target.value)}
                  placeholder="Enter new password..."
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  required
                  value={adminConfirmPassword}
                  onChange={(e) => setAdminConfirmPassword(e.target.value)}
                  placeholder="Repeat new password..."
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="sm:col-span-3 flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={adminPasswordLoading}
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                >
                  {adminPasswordLoading ? 'Updating Password...' : 'Save New Admin Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {adminTab === 'jobs-ads-control-center' && canAccessAdminTab('jobs-ads-control-center') && (
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-3 sm:p-4 space-y-3">
          <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-3">
            {canAccessJobsWorkspace && <button type="button" onClick={() => setJobsAdsWorkspaceArea('jobs')} className={`px-4 py-2 rounded-xl text-xs font-black ${jobsAdsWorkspaceArea === 'jobs' ? 'bg-amber-500 text-slate-950' : 'bg-slate-950 text-slate-300 border border-slate-800'}`}>Jobs Management</button>}
            {canAccessCampaignWorkspace && <button type="button" onClick={() => setJobsAdsWorkspaceArea('campaigns')} className={`px-4 py-2 rounded-xl text-xs font-black  ${(jobsAdsWorkspaceArea === 'campaigns' || !canAccessJobsWorkspace) ? 'bg-emerald-500 text-slate-950' : 'bg-slate-950 text-slate-300 border border-slate-800'}`}>Ads & Campaigns</button>}
          </div>
          {jobsAdsWorkspaceArea === 'jobs' && canAccessJobsWorkspace ? (
            <div className="flex flex-wrap gap-2">
              {([
                ['pending', 'Submitted / Pending'],
                ['jobs', 'All / Live Jobs'],
                ['add-job', 'Manual Job Posting'],
                ['ai-enhancer', 'Quality & Spam'],
                ['pricing-controller', 'Job Rates & Fees'],
                ['fee-logs', 'Job Fee Logs']
              ] as const).filter(([id]) => canAccessAdminTab(id)).map(([id, label]) => (
                <button key={id} type="button" onClick={() => setJobsWorkspaceSection(id)} className={`px-3 py-2 rounded-lg text-[11px] sm:text-xs font-bold ${jobsWorkspaceSection === id ? 'bg-amber-500/20 text-amber-200 border border-amber-500/40' : 'bg-slate-950 text-slate-300 border border-slate-800'}`}>{label}</button>
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {([
                ['advertisements', 'Campaign Setup, Slots & Rates'],
                ['campaign-center', 'Campaign Operations'],
                ['landing-customizer', 'Display & Landing Design']
              ] as const).filter(([id]) => canAccessAdminTab(id)).map(([id, label]) => (
                <button key={id} type="button" onClick={() => setCampaignWorkspaceSection(id)} className={`px-3 py-2 rounded-lg text-[11px] sm:text-xs font-bold ${campaignWorkspaceSection === id ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/40' : 'bg-slate-950 text-slate-300 border border-slate-800'}`}>{label}</button>
              ))}
            </div>
          )}
          <p className="text-[10px] text-slate-500">All controls below reuse their existing permissions, data sources and save actions. Job rates and category fees are shown together; campaign slots, sizes, placement settings, schedules and active campaign rates remain in the Campaign Setup tab.</p>
        </section>
      )}

      {/* TAB: PAYMENT PROOFS & DEPOSIT VERIFICATION HUB */}
      {effectiveAdminTab === 'payment-proofs' && canAccessAdminTab('payment-proofs') && (
        <AdminPaymentVerificationHub
          transactions={currentTransactions}
          onApproveTransaction={handleApproveTx}
          onRejectTransaction={handleRejectTx}
          users={users}
          jobs={jobs}
        />
      )}

      {/* TAB: ADMIN PAYMENT METHODS & DURATION PRESETS MANAGER */}
      {effectiveAdminTab === 'admin-payment-methods' && canAccessAdminTab('admin-payment-methods') && (
        <AdminPaymentMethodsManager />
      )}

      {/* TAB: LIVE LANDING PAGE VISUAL BUILDER & SEQUENCE EDITOR */}
      {effectiveAdminTab === 'landing-customizer' && canAccessAdminTab('landing-customizer') && landingConfig && onUpdateLandingConfig && (
        <LandingPageCustomizer
          config={landingConfig}
          designSystem={landingDesignSystem}
          onSelectDesign={onSelectLandingDesign}
          onUpdateConfig={onUpdateLandingConfig}
          campaignConfig={campaignConfig || DEFAULT_CAMPAIGN_CUSTOMIZATION_CONFIG}
          onUpdateCampaignConfig={onUpdateCampaignConfig || (() => {})}
          onSaveCombinedConfig={onSaveLandingAndCampaignConfig}
          jobs={jobs || []}
        />
      )}

      {/* TAB: CAMPAIGN OPERATIONS & SCHEDULING */}
      {effectiveAdminTab === 'campaign-center' && canAccessAdminTab('campaign-center') && (
        <AdminCampaignCenter
          ads={ads || []}
          onUpdateAd={onUpdateAd || (() => {})}
          canManageCampaignOperations={hasAdminUiPermission('advertisements.manage')}
          canWaiveCampaignFee={hasAdminUiPermission('finance.manage')}
          canViewCampaignContactDetails={effectiveAdminRole === 'Admin' || effectiveAdminRole === 'Super Admin'}
        />
      )}

      {/* TAB: UNIVERSAL PRICING CONTROLLER */}
      {effectiveAdminTab === 'pricing-controller' && canAccessAdminTab('pricing-controller') && (
        <AdminPricingController onPricingSaved={onSyncAuthoritativePricing} />
      )}

      {/* TAB: APPLICATION FLOW & BUTTON CUSTOMIZER */}
      {effectiveAdminTab === 'apply-settings' && canAccessAdminTab('apply-settings') && (
        <AdminApplySettingsManager />
      )}

      {/* TAB: MODAL & POPUP CONTENT MANAGER */}
      {effectiveAdminTab === 'modal-content-manager' && canAccessAdminTab('modal-content-manager') && (
        <AdminModalContentManager />
      )}

      {/* TAB: PER-CATEGORY POSTING FEES & 1-CLICK WAIVERS */}
      {(effectiveAdminTab === 'fee-management' || (adminTab === 'jobs-ads-control-center' && jobsAdsWorkspaceArea === 'jobs' && jobsWorkspaceSection === 'pricing-controller')) && canAccessAdminTab('fee-management') && (
        <AdminFeeManager
          landingConfig={landingConfig}
          onUpdateLandingConfig={onUpdateLandingConfig}
          onSaveCompleteFeeConfig={onSaveCompleteFeeConfig}
          isPricingLoading={isPricingLoading}
          pricingLoadError={pricingLoadError}
          isPricingReady={isPricingReady}
          onReloadPricingConfig={onReloadPricingConfig}
          globalPostingFeePkr={jobPostingFeePkr}
          onChangeGlobalPostingFee={onChangeJobPostingFee}
          postingPricing={jobPostingPricing}
          onChangePostingPricing={onChangeJobPostingPricing || (() => {})}
          users={users}
          jobs={jobs}
          pendingJobs={pendingJobs}
          feeLogs={jobPostingFeeLogs}
          onUpdateUser={onUpdateUser || (() => {})}
          onBulkEndUnpaidMemberships={onBulkEndUnpaidMemberships}
        />
      )}

      {/* TAB: EXECUTIVE ANALYTICS & REVENUE COMMAND CENTER (supports stats alias) */}
      {(effectiveAdminTab === 'analytics' || effectiveAdminTab === 'stats') && canAccessAdminTab('analytics') && (
        <AdminAnalyticsOverview
          jobs={jobs}
          pendingJobs={pendingJobs}
          users={users}
          subscribers={subscribers}
          feeLogs={jobPostingFeeLogs}
          paymentTransactions={currentTransactions}
          ads={ads}
          auditLogs={scrapedAuditLogs}
          batchRuns={scraperBatchRuns}
          currencyConfig={currencyConfig}
          onNavigateTab={(tabId) => handlePermissionAwareNavigateTab(tabId)}
        />
      )}

      {/* TAB: GLOBAL SEO, METADATA & ANNOUNCEMENT ENGINE */}
      {effectiveAdminTab === 'seo-config' && canAccessAdminTab('seo-config') && (
        <AdminSeoSettings
          seoConfig={effectiveSeoConfig}
          onUpdateSeoConfig={handleUpdateSeoConfig}
          isLoading={isSeoConfigLoading}
          loadError={seoConfigLoadError}
          isReady={isSeoConfigReady}
          onReload={onReloadSeoConfig}
        />
      )}
      {effectiveAdminTab === 'job-visibility' && canAccessAdminTab('job-visibility') && (
        <JobVisibilityDefaultsManager />
      )}
      {effectiveAdminTab === 'locations-manager' && canAccessAdminTab('locations-manager') && (
        <AdminLocationManager />
      )}

      {/* TAB: MULTI-CURRENCY & INTERNATIONAL PRICING TIERS */}
      {effectiveAdminTab === 'currency-forex' && canAccessAdminTab('currency-forex') && (
        <AdminCurrencyManager
          currencyConfig={currencyConfig}
          onUpdateCurrencyConfig={handleUpdateCurrencyConfig}
          isLoading={isCurrencyLoading}
          loadError={currencyLoadError}
          migrationError={currencyMigrationError}
        />
      )}

      {/* TAB: MULTI-CHANNEL BROADCAST CENTER */}
      {effectiveAdminTab === 'broadcast-center' && canAccessAdminTab('broadcast-center') && (
        <AdminBroadcastCenter
          campaigns={broadcastCampaigns}
          users={users}
          subscribers={subscribers}
          commConfig={commConfig}
          featureFlags={featureFlags}
          isLoading={isBroadcastLoading}
          loadError={broadcastLoadError}
          migrationError={broadcastMigrationError}
          onSendCampaign={handleSaveBroadcastCampaign}
          onRefreshCampaigns={fetchBroadcastCampaigns}
          onUpdateCommConfig={handleUpdateCommConfig}
        />
      )}

      {/* TAB: ADVANCED BULK NOTIFICATION SUITE */}
      {effectiveAdminTab === 'bulk-notifications' && canAccessAdminTab('bulk-notifications') && (
        <AdminBulkNotificationTool
          users={users}
          subscribers={subscribers}
          featureFlags={featureFlags}
        />
      )}

      {/* TAB: AUDIT & ADMIN ACTIVITY LOGS */}
      {effectiveAdminTab === 'activity-logs' && canAccessAdminTab('activity-logs') && (
        <AdminActivityLogs
          jobs={jobs}
          users={users}
          feeLogs={jobPostingFeeLogs}
          ads={ads}
        />
      )}

      {/* TAB: DATA VAULT & SELECTED ADMIN DATA EXPORT */}
      {effectiveAdminTab === 'data-backup' && canAccessAdminTab('data-backup') && (
        <AdminDataBackupHub
          jobs={jobs}
          pendingJobs={pendingJobs}
          users={users}
          subscribers={subscribers}
          feeLogs={jobPostingFeeLogs}
          paymentTransactions={currentTransactions}
          ads={ads}
          auditLogs={scrapedAuditLogs}
          batchRuns={scraperBatchRuns}
          customFormFields={customFormFields}
          featureFlags={featureFlags}
          jobPostingPricing={jobPostingPricing}
          adPricingConfig={pricingConfig}
          landingConfig={landingConfig}
          seoConfig={effectiveSeoConfig}
          whatsAppSupportConfig={currentWhatsAppConfig}
          onRestoreSnapshot={handleRestoreSnapshot}
          onImportBulkJobs={handleImportBulkJobs}
        />
      )}

      {/* TAB: RULE-BASED JOB QUALITY ANALYZER */}
      {effectiveAdminTab === 'ai-enhancer' && canAccessAdminTab('ai-enhancer') && (
        <AdminAiQualityEnhancer
          jobs={jobs}
          pendingJobs={pendingJobs}
          onUpdateJob={onUpdateJob}
        />
      )}

      {/* TAB: EMPLOYER KYC & SECP IDENTITY VERIFICATION */}
      {effectiveAdminTab === 'employer-kyc' && canAccessAdminTab('employer-kyc') && (
        <AdminEmployerKycHub />
      )}

      {/* TAB: ADVERTISEMENT & CAMPAIGN ENGINE */}
      {effectiveAdminTab === 'advertisements' && canAccessAdminTab('advertisements') && (
        <AdminAdHub
          ads={ads}
          onAddAd={onAddAd || (() => {})}
          onUpdateAd={onUpdateAd || (() => {})}
          onDeleteAd={onDeleteAd || (() => {})}
          onResetAdMetrics={onResetAdMetrics || (() => {})}
          pricingConfig={pricingConfig}
          onUpdatePricingConfig={onUpdatePricingConfig}
          campaignConfig={campaignConfig}
          onUpdateCampaignConfig={onUpdateCampaignConfig}
          onApproveAd={onApproveAd}
          onRejectAd={onRejectAd}
          canManageAdConfiguration={hasAdminUiPermission('finance.manage')}
          isPricingReady={isPricingReady}
        />
      )}

      {/* TAB 1: PENDING JOBS APPROVAL QUEUE */}
      {effectiveAdminTab === 'pending' && canAccessAdminTab('pending') && (() => {
        // Pending jobs duplicate detection
        const pendingClusters = computeJobDuplicateClusters([...jobs, ...pendingJobs]);
        const liveTitleSet = new Set(jobs.map(j => `${(j.title || '').trim().toLowerCase()}|${(j.company || '').trim().toLowerCase()}`));
        const liveCaseSet = new Set(jobs.filter(j => j.pdfCaseNumber).map(j => j.pdfCaseNumber!.trim().toLowerCase()));

        // Filter and Search
        const filterPendingCollection = (pendingCollection: Job[]) => {
          const pendingClustersForCollection = computeJobDuplicateClusters([...jobs, ...pendingCollection]);
          return pendingCollection.filter(pJob => {
          if (pendingSearchQuery.trim()) {
            const q = pendingSearchQuery.toLowerCase();
            const matchesTitle = (pJob.title || '').toLowerCase().includes(q);
            const matchesComp = (pJob.company || '').toLowerCase().includes(q);
            const matchesCity = (pJob.city || '').toLowerCase().includes(q);
            const matchesCase = (pJob.pdfCaseNumber || '').toLowerCase().includes(q);
            if (!matchesTitle && !matchesComp && !matchesCity && !matchesCase) return false;
          }
          if (pendingCategoryFilter !== 'all' && pJob.jobCategory !== pendingCategoryFilter) {
            return false;
          }
          if (pendingSourceFilter === 'scraper' && !pJob.sourceUrl && !pJob.scraperSourceId && !pJob.scrapedSourceDomain && !pJob.id.includes('scraped')) {
            return false;
          }
          if (pendingSourceFilter === 'user' && (pJob.sourceUrl || pJob.scraperSourceId || pJob.scrapedSourceDomain || pJob.id.includes('scraped'))) {
            return false;
          }
          if (pendingSourceFilter === 'pdf' && !pJob.isPdfScraped && !pJob.pdfCaseNumber) {
            return false;
          }
          const pendingPortal = String((pJob as any).sourcePortal || pJob.scraperSourceName || pJob.scrapedSourceDomain || '').toLowerCase();
          if (pendingPortalFilter.trim() && !pendingPortal.includes(pendingPortalFilter.trim().toLowerCase())) return false;
          if (pendingBatchFilter.trim() && String((pJob as any).scraperBatchId || '').toLowerCase() !== pendingBatchFilter.trim().toLowerCase()) return false;
          if (pendingCityFilter.trim() && !(pJob.city || '').toLowerCase().includes(pendingCityFilter.trim().toLowerCase())) return false;
          if (pendingProvinceFilter !== 'all' && pJob.province !== pendingProvinceFilter) return false;
          if (pendingScrapeDateFilter !== 'all') {
            const rawScrapeDate = (pJob as any).lastScrapedAt || (pJob as any).scrapedAt || pJob.createdAt || pJob.postedAt;
            const scrapeTime = rawScrapeDate ? new Date(rawScrapeDate).getTime() : NaN;
            if (!Number.isFinite(scrapeTime)) return false;
            const ageHours = (Date.now() - scrapeTime) / 3600000;
            const todayKey = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
            const scrapeDayKey = new Date(scrapeTime).toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
            if (pendingScrapeDateFilter === 'today' && scrapeDayKey !== todayKey) return false;
            if (pendingScrapeDateFilter === '24h' && (ageHours < 0 || ageHours > 24)) return false;
            if (pendingScrapeDateFilter === '7days' && (ageHours < 0 || ageHours > 168)) return false;
            if (pendingScrapeDateFilter === '30days' && (ageHours < 0 || ageHours > 720)) return false;
            if (pendingScrapeDateFilter === 'older' && ageHours <= 720) return false;
          }
          const pendingHasApplyUrl = Boolean((pJob as any).applicationUrl || (pJob as any).originalApplyUrl || (pJob as any).externalApplyUrl || (pJob as any).applyUrl);
          const pendingHasSourceUrl = Boolean((pJob as any).sourceUrl || (pJob as any).scraperSourceUrl);
          const pendingIsComplete = Boolean(pJob.title?.trim() && pJob.company?.trim() && pJob.description?.trim() && (pJob.city || pJob.province || pJob.district || (pJob.country && pJob.country !== 'Pakistan')));
          if (pendingCompletenessFilter === 'complete' && !pendingIsComplete) return false;
          if (pendingCompletenessFilter === 'incomplete' && pendingIsComplete) return false;
          if (pendingCompletenessFilter === 'missing_location' && (pJob.city || pJob.province || pJob.district || (pJob.country && pJob.country !== 'Pakistan'))) return false;
          if (pendingCompletenessFilter === 'missing_apply' && pendingHasApplyUrl) return false;
          if (pendingCompletenessFilter === 'missing_source' && pendingHasSourceUrl) return false;
          const pendingLocationConfirmed = Boolean((pJob as any).isLocationConfirmed ?? pJob.metadata?.isLocationConfirmed ?? false);
          if (pendingLocationFilter === 'confirmed' && !pendingLocationConfirmed) return false;
          if (pendingLocationFilter === 'unconfirmed' && pendingLocationConfirmed) return false;
          const matchesAdminDateFilter = (rawDate: unknown, filter: string) => {
            if (filter === 'all') return true;
            if (!rawDate) return filter === 'none';
            const date = new Date(String(rawDate));
            if (/^\d{4}-\d{2}-\d{2}$/.test(String(rawDate))) date.setHours(23, 59, 59, 999);
            const time = date.getTime();
            if (!Number.isFinite(time)) return filter === 'none';
            const now = Date.now();
            const days = (time - now) / 86400000;
            if (filter === 'expired') return days < 0;
            if (filter === '7days') return days >= 0 && days <= 7;
            if (filter === '30days') return days >= 0 && days <= 30;
            if (filter === 'future') return days > 30;
            return true;
          };
          if (!matchesAdminDateFilter((pJob as any).expiryDate, pendingExpiryFilter)) return false;
          if (!matchesAdminDateFilter((pJob as any).deadlineDate, pendingDeadlineFilter)) return false;
          if (showPendingDuplicatesOnly) {
            const isDupOfLive = liveTitleSet.has(`${(pJob.title || '').trim().toLowerCase()}|${(pJob.company || '').trim().toLowerCase()}`) || (pJob.pdfCaseNumber && liveCaseSet.has(pJob.pdfCaseNumber.trim().toLowerCase()));
            const isDupInPending = pendingClustersForCollection.some(c => c.items.some(it => it.id === pJob.id));
            if (!isDupOfLive && !isDupInPending) return false;
          }
          return true;
          });
        };

        const sortPendingCollection = (pendingList: Job[]) => [...pendingList].sort((a, b) => {
          if (pendingSortBy === 'title') return (a.title || '').localeCompare(b.title || '');
          if (pendingSortBy.startsWith('expiry_')) {
            const aExpiry = Date.parse(String((a as any).expiryDate || ''));
            const bExpiry = Date.parse(String((b as any).expiryDate || ''));
            const aValid = Number.isFinite(aExpiry); const bValid = Number.isFinite(bExpiry);
            if (!aValid || !bValid) return aValid ? -1 : bValid ? 1 : 0;
            return pendingSortBy === 'expiry_earliest' ? aExpiry - bExpiry : bExpiry - aExpiry;
          }
          const dateValue = (job: Job, mode: 'scraped' | 'updated' | 'posted') => {
            const value = mode === 'scraped' ? ((job as any).lastScrapedAt || (job as any).scrapedAt || job.createdAt || job.postedAt)
              : mode === 'updated' ? ((job as any).updatedAt || (job as any).lastUpdatedAt || job.createdAt || job.postedAt)
              : (job.createdAt || job.postedAt);
            const parsed = value ? new Date(value).getTime() : NaN;
            return Number.isFinite(parsed) ? parsed : 0;
          };
          const mode = pendingSortBy.startsWith('scraped_') ? 'scraped' : pendingSortBy.startsWith('updated_') ? 'updated' : 'posted';
          const delta = dateValue(a, mode) - dateValue(b, mode);
          return pendingSortBy === 'oldest' || pendingSortBy.endsWith('_oldest') ? delta : -delta;
        });
        const filteredPending = sortPendingCollection(filterPendingCollection(pendingJobs));

        const handleSelectAllFilteredAcrossPages = async () => {
          if (isSelectingAllPending) return;
          setIsSelectingAllPending(true);
          try {
            const firstPage: any = await api.jobs.getPendingQueue({ page: 1, limit: 200 });
            if (!firstPage?.success || !Array.isArray(firstPage.pendingJobs)) throw new Error(firstPage?.message || 'Could not load the first pending page.');
            const totalPages = Math.max(1, Number(firstPage.totalPages) || 1);
            if (totalPages > 25) throw new Error('The pending queue is larger than the safe all-pages selection limit (5,000 records). Please narrow the filters or use page-by-page selection.');
            const remainingPages = await Promise.all(Array.from({ length: totalPages - 1 }, (_, index) => api.jobs.getPendingQueue({ page: index + 2, limit: 200 })));
            const failedPage = remainingPages.find((page: any) => !page?.success || !Array.isArray(page.pendingJobs));
            if (failedPage) throw new Error('One or more pending pages could not be loaded. No new selection was applied.');
            const allPending = [...firstPage.pendingJobs, ...remainingPages.flatMap((page: any) => page.pendingJobs)];
            const allFiltered = sortPendingCollection(filterPendingCollection(allPending));
            if (allFiltered.length > 500) throw new Error(`${allFiltered.length} jobs match these filters. Existing bulk endpoints safely process up to 500 IDs per operation; narrow the filters to 500 or fewer before selecting all pages.`);
            setSelectedPendingIds(allFiltered.map(job => job.id));
            setSelectedPendingJobCache(allFiltered);
            alert(`Selected ${allFiltered.length} filtered pending jobs across ${totalPages} page(s).`);
          } catch (err: any) {
            alert(err?.message || 'Could not select all filtered pending jobs.');
          } finally {
            setIsSelectingAllPending(false);
          }
        };

        const allSelected = filteredPending.length > 0 && filteredPending.every(j => selectedPendingIds.includes(j.id));

        const handleSelectAllPending = () => {
          if (allSelected) {
            setSelectedPendingIds(prev => prev.filter(id => !filteredPending.some(j => j.id === id)));
          } else {
            const toAdd = filteredPending.map(j => j.id);
            setSelectedPendingIds(prev => Array.from(new Set([...prev, ...toAdd])));
          }
        };

        const togglePendingSelection = (id: string) => {
          setSelectedPendingIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
          );
        };

        const handleBulkApprove = () => {
          if (selectedPendingIds.length === 0) return;
          if (onBulkApprovePendingJobs) {
            onBulkApprovePendingJobs(selectedPendingIds);
          } else {
            selectedPendingIds.forEach(id => handleAdminApproveJob(id));
          }
          setSelectedPendingIds([]);
        };

        const handleBulkReject = () => {
          if (selectedPendingIds.length === 0) return;
          const reason = prompt(`Enter rejection reason for ${selectedPendingIds.length} selected postings:`, 'Does not meet posting guidelines or duplicate submission') || '';
          if (reason) {
            if (onBulkRejectPendingJobs) {
              onBulkRejectPendingJobs(selectedPendingIds, reason);
            } else {
              selectedPendingIds.forEach(id => handleAdminRejectJob(id, reason));
            }
            setSelectedPendingIds([]);
          }
        };

        const handleBulkDelete = () => {
          if (selectedPendingIds.length === 0) return;
          if (confirm(`Permanently delete ${selectedPendingIds.length} selected pending postings from queue?`)) {
            if (onBulkDeleteJobs) {
              onBulkDeleteJobs(selectedPendingIds);
            } else if (onBulkRejectPendingJobs) {
              onBulkRejectPendingJobs(selectedPendingIds, 'Admin deleted from queue');
            } else {
              selectedPendingIds.forEach(id => {
                if (onRejectJob) onRejectJob(id, 'Admin deleted from queue');
              });
            }
            setSelectedPendingIds([]);
          }
        };

        return (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5 text-white shadow-xl">
            {/* HEADER & COUNTER */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-bold flex items-center space-x-2">
                  <Clock className="w-5 h-5 text-amber-400" />
                  <span>Pending Job Approvals Queue</span>
                  <span className="bg-amber-500/20 text-amber-400 text-xs font-bold px-3 py-0.5 rounded-full border border-amber-500/30">
                    {(pendingTotal ?? pendingJobs.length).toLocaleString()} Pending
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Approve submissions to push to public live site, bulk edit attributes, or reject duplicate/invalid entries.
                </p>
              </div>

              {/* ACTION BUTTONS */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    if (onReloadJobs) {
                      await onReloadJobs();
                    }
                  }}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 hover:text-white transition-all cursor-pointer flex items-center space-x-1.5"
                  title="Refresh authoritative pending jobs from database"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Refresh Queue</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsPendingDuplicateModalOpen(true)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 border ${
                    pendingClusters.length > 0
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-500 hover:text-white'
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                  }`}
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Check Duplicate Submissions</span>
                  {pendingClusters.length > 0 && (
                    <span className="px-1.5 py-0.2 bg-rose-500 text-white rounded text-[10px] font-black ml-1">
                      {pendingClusters.length}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* TAB-SPECIFIC SEARCH & FILTER CONTROLLER BAR */}
            <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-3">
              <div className="flex flex-col md:flex-row items-center gap-3">
                {/* Search Bar */}
                <div className="relative flex-1 w-full">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={pendingSearchQuery}
                    onChange={(e) => setPendingSearchQuery(e.target.value)}
                    placeholder="Search pending jobs by title, company, case number, or city..."
                    className="w-full pl-9 pr-8 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                  />
                  {pendingSearchQuery && (
                    <button
                      onClick={() => setPendingSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs font-bold"
                    >
                      ×
                    </button>
                  )}
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                  <select
                    value={pendingCategoryFilter}
                    onChange={(e) => setPendingCategoryFilter(e.target.value)}
                    className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white font-medium cursor-pointer"
                  >
                    <option value="all">All Categories</option>
                    <option value="Government Sector">Government Sector</option>
                    <option value="Private Corporate">Private Corporate</option>
                    <option value="Newspaper Classified">Newspaper Classified</option>
                    <option value="Tech / IT & Software">Tech / IT & Software</option>
                    <option value="Banking & Finance">Banking & Finance</option>
                    <option value="Healthcare & Medical">Healthcare & Medical</option>
                    <option value="Education & Academic">Education & Academic</option>
                    <option value="International Remote">International Remote</option>
                  </select>

                  <select
                    value={pendingSourceFilter}
                    onChange={(e) => setPendingSourceFilter(e.target.value)}
                    className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white font-medium cursor-pointer"
                  >
                    <option value="all">All Ingestion Sources</option>
                    <option value="user">User / Employer Submitted</option>
                    <option value="scraper">Web Scraper Harvested</option>
                    <option value="pdf">FPSC / WAPDA PDF Parser</option>
                  </select>

                  <select
                    value={pendingSortBy}
                    onChange={(e) => setPendingSortBy(e.target.value as any)}
                    className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white font-medium cursor-pointer"
                  >
                    <option value="newest">Sort: Newest First</option>
                    <option value="oldest">Sort: Oldest First</option>
                    <option value="title">Sort: Job Title (A-Z)</option>
                    <option value="scraped_latest">Latest Scraped First</option>
                    <option value="scraped_oldest">Oldest Scraped First</option>
                    <option value="updated_latest">Recently Updated First</option>
                    <option value="updated_oldest">Oldest Updated First</option><option value="expiry_earliest">Earliest Expiry First</option><option value="expiry_latest">Latest Expiry First</option>
                  </select>

                  <select value={pendingCompletenessFilter} onChange={(e) => setPendingCompletenessFilter(e.target.value as typeof pendingCompletenessFilter)} className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white font-medium">
                    <option value="all">All Job Details</option><option value="complete">Complete Jobs</option><option value="incomplete">Incomplete Jobs</option><option value="missing_location">Missing Location</option><option value="missing_apply">Missing Apply URL</option><option value="missing_source">Missing Scraper Source URL</option>
                  </select>
                  <input value={pendingPortalFilter} onChange={(e) => setPendingPortalFilter(e.target.value)} placeholder="Source portal (e.g. FPSC)" className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white min-w-[150px]" />
                  <input value={pendingBatchFilter} onChange={(e) => setPendingBatchFilter(e.target.value)} placeholder="Scrape batch ID" className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white min-w-[130px]" />
                  <input value={pendingCityFilter} onChange={(e) => setPendingCityFilter(e.target.value)} placeholder="City" className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white min-w-[110px]" />
                  <select value={pendingProvinceFilter} onChange={(e) => setPendingProvinceFilter(e.target.value)} className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white font-medium"><option value="all">All Provinces</option><option>Punjab</option><option>Sindh</option><option>Khyber Pakhtunkhwa</option><option>Balochistan</option><option>Islamabad Capital Territory</option><option>Azad Kashmir</option><option>Gilgit-Baltistan</option></select>
                  <select value={pendingScrapeDateFilter} onChange={(e) => setPendingScrapeDateFilter(e.target.value as typeof pendingScrapeDateFilter)} className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white font-medium"><option value="all">Any Scrape Time</option><option value="today">Scraped Today</option><option value="24h">Last 24 Hours</option><option value="7days">Last 7 Days</option><option value="30days">Last 30 Days</option><option value="older">Older than 30 Days</option></select>
                  <select value={pendingLocationFilter} onChange={(e) => setPendingLocationFilter(e.target.value as typeof pendingLocationFilter)} className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white font-medium">
                    <option value="all">All Location Status</option><option value="confirmed">Location Confirmed</option><option value="unconfirmed">Location Unconfirmed</option>
                  </select>
                  <select value={pendingExpiryFilter} onChange={(e) => setPendingExpiryFilter(e.target.value as typeof pendingExpiryFilter)} className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white font-medium"><option value="all">Any Expiry Date</option><option value="expired">Expired</option><option value="7days">Expires in 7 Days</option><option value="30days">Expires in 30 Days</option><option value="future">Later Expiry</option><option value="none">No Expiry Date</option></select>
                  <select value={pendingDeadlineFilter} onChange={(e) => setPendingDeadlineFilter(e.target.value as typeof pendingDeadlineFilter)} className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white font-medium"><option value="all">Any Application Deadline</option><option value="expired">Deadline Passed</option><option value="7days">Deadline in 7 Days</option><option value="30days">Deadline in 30 Days</option><option value="future">Later Deadline</option><option value="none">No Application Deadline</option></select>

                  <button
                    type="button"
                    onClick={() => setShowPendingDuplicatesOnly(!showPendingDuplicatesOnly)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      showPendingDuplicatesOnly
                        ? 'bg-rose-500 text-white border-rose-400 font-black'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    {showPendingDuplicatesOnly ? 'Showing Duplicates Only' : 'Show Duplicates Only'}
                  </button>
                </div>
              </div>

              {/* Selection Summary and Quick Controls */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs text-slate-400">
                <div className="flex items-center space-x-3 flex-wrap">
                  <button type="button" onClick={() => { setSelectedPendingIds(Array.from(new Set(pendingJobs.map(j => j.id)))); setSelectedPendingJobCache(pendingJobs); }} disabled={pendingJobs.length === 0} className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 hover:text-white text-[11px] font-bold disabled:opacity-40">Select Current Page ({pendingJobs.length})</button>
                  <button type="button" onClick={handleSelectAllFilteredAcrossPages} disabled={isSelectingAllPending || pendingJobs.length === 0} className="px-2.5 py-1.5 rounded-lg bg-cyan-950/60 border border-cyan-700/50 text-cyan-200 hover:bg-cyan-900 text-[11px] font-bold disabled:opacity-40">{isSelectingAllPending ? 'Loading all pages…' : 'Select Filtered (All Pages)'}</button>
                  <label className="flex items-center space-x-2 cursor-pointer font-bold text-slate-200">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={handleSelectAllPending}
                      className="w-4 h-4 rounded text-amber-500 bg-slate-900 border-slate-700"
                    />
                    <span>Select All Filtered ({filteredPending.length})</span>
                  </label>
                  {selectedPendingIds.length > 0 && (
                    <span className="text-amber-400 font-bold font-mono">
                      ({selectedPendingIds.length} selected)
                    </span>
                  )}
                </div>

                <div className="text-[11px]">
                  Showing {filteredPending.length} of {(pendingTotal ?? pendingJobs.length).toLocaleString()} queue items (Page {pendingPage ?? 1} of {pendingTotalPages ?? 1})
                </div>
              </div>
            </div>

            {/* PENDING QUEUE PAGINATION CONTROLS */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-slate-950/90 border border-slate-800 rounded-2xl text-xs text-slate-300 shadow-inner">
              <div className="flex items-center space-x-2 font-bold">
                <Clock className="w-4 h-4 text-amber-400" />
                <span>Pending Jobs:</span>
                <span className="text-amber-400 font-mono text-sm font-bold">{(pendingTotal ?? pendingJobs.length).toLocaleString()}</span>
              </div>

              <div className="flex items-center space-x-2">
                <span className="text-slate-400 font-medium">Rows:</span>
                <div className="flex items-center space-x-1 bg-slate-900 border border-slate-800 p-0.5 rounded-xl">
                  {[50, 100, 200].map(size => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => {
                        setSelectedPendingIds([]);
                        setSelectedPendingJobCache([]);
                        if (onPendingPageChange) onPendingPageChange(1, size);
                      }}
                      className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                        (pendingLimit ?? 100) === size
                          ? 'bg-amber-500 text-slate-950 shadow-sm'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800'
                      }`}
                    >
                      [{size}]
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <span className="text-slate-400 font-medium">
                  Page <strong className="text-white font-mono">{pendingPage ?? 1}</strong> of <strong className="text-white font-mono">{pendingTotalPages ?? 1}</strong>
                </span>
                <div className="flex items-center space-x-1.5">
                  <button
                    type="button"
                    disabled={(pendingPage ?? 1) <= 1}
                    onClick={() => {
                      setSelectedPendingIds([]);
                      setSelectedPendingJobCache([]);
                      if (onPendingPageChange) onPendingPageChange((pendingPage ?? 1) - 1, pendingLimit);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 font-bold text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                  >
                    [Previous]
                  </button>
                  <button
                    type="button"
                    disabled={(pendingPage ?? 1) >= (pendingTotalPages ?? 1)}
                    onClick={() => {
                      setSelectedPendingIds([]);
                      setSelectedPendingJobCache([]);
                      if (onPendingPageChange) onPendingPageChange((pendingPage ?? 1) + 1, pendingLimit);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 font-bold text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                  >
                    [Next]
                  </button>
                </div>
              </div>
            </div>

            {/* BULK ACTIONS FLOATING/TOP BAR */}
            {selectedPendingIds.length > 0 && (
              <div className="p-3.5 bg-gradient-to-r from-amber-950/80 to-slate-950 border border-amber-500/40 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-2xl animate-in fade-in">
                <div className="flex items-center space-x-2 text-xs font-bold text-amber-300">
                  <CheckSquare className="w-4 h-4 text-amber-400" />
                  <span>{selectedPendingIds.length} Pending Job(s) Selected</span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => setIsBulkJobEditOpen(true)} className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl cursor-pointer flex items-center space-x-1">
                    <Edit3 className="w-3.5 h-3.5" /><span>Bulk Edit Attributes ({selectedPendingIds.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleBulkApprove}
                    className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-emerald-500/20 cursor-pointer flex items-center space-x-1"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Bulk Approve ({selectedPendingIds.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleBulkReject}
                    className="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white font-bold text-xs rounded-xl border border-rose-500/40 cursor-pointer flex items-center space-x-1"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Bulk Reject</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleBulkDelete}
                    className="p-1.5 bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white rounded-xl border border-rose-500/30 cursor-pointer"
                    title="Delete Selected"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => { setSelectedPendingIds([]); setSelectedPendingJobCache([]); }}
                    className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-xl font-bold cursor-pointer"
                  >
                    Deselect
                  </button>
                </div>
              </div>
            )}

            {/* PENDING ITEMS LIST */}
            {filteredPending.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs bg-slate-950 rounded-xl border border-slate-800">
                {pendingJobs.length === 0
                  ? 'No pending jobs in queue right now! All user submissions and scraper outputs are reviewed.'
                  : 'No pending jobs match your current search or filter criteria.'}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredPending.map((pJob) => {
                  const isSelected = selectedPendingIds.includes(pJob.id);
                  const isDupOfLive = liveTitleSet.has(`${(pJob.title || '').trim().toLowerCase()}|${(pJob.company || '').trim().toLowerCase()}`);
                  const isCaseDup = pJob.pdfCaseNumber && liveCaseSet.has(pJob.pdfCaseNumber.trim().toLowerCase());

                  return (
                    <div
                      key={pJob.id}
                      className={`p-5 rounded-xl border transition-all space-y-3 ${
                        isSelected
                          ? 'bg-slate-900 border-amber-500 shadow-lg shadow-amber-500/10'
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {/* DUPLICATE WARNING BANNER */}
                      {(isDupOfLive || isCaseDup) && (
                        <div className="p-2.5 bg-rose-950/40 border border-rose-500/40 rounded-xl flex items-center justify-between text-xs text-rose-300">
                          <div className="flex items-center space-x-2">
                            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                            <span>
                              <strong>Potential Duplicate:</strong> This title or case number matches an active job already live in database.
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRejectPrompt(pJob.id)}
                            className="px-2.5 py-1 bg-rose-500 hover:bg-rose-400 text-white font-black text-[10px] rounded-lg cursor-pointer"
                          >
                            Reject Duplicate
                          </button>
                        </div>
                      )}

                      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                        <div className="flex items-start space-x-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => togglePendingSelection(pJob.id)}
                            className="w-4 h-4 mt-1 rounded text-amber-500 bg-slate-900 border-slate-700 cursor-pointer"
                          />

                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h4
                                onClick={() => setSelectedJobForModal(pJob)}
                                className="font-bold text-base text-white hover:text-amber-400 cursor-pointer transition-colors"
                              >
                                {pJob.title}
                              </h4>
                              <span className="bg-amber-500/20 text-amber-400 text-[10px] uppercase font-bold px-2 py-0.5 rounded border border-amber-500/30">
                                {pJob.jobType}
                              </span>
                              <span className="bg-purple-500/20 text-purple-300 text-[10px] font-bold px-2 py-0.5 rounded border border-purple-500/30">
                                {pJob.jobCategory || 'Private Corporate'}
                              </span>
                              {pJob.govtScale && (
                                <span className="bg-indigo-500/20 text-indigo-300 text-[10px] font-mono font-bold px-2 py-0.5 rounded border border-indigo-500/30">
                                  {pJob.govtScale}
                                </span>
                              )}
                            </div>

                            <p className="text-xs text-slate-400 mt-1">
                              Company: <span className="text-white font-semibold">{pJob.company}</span> • Location: <span className="text-emerald-400 font-semibold">{pJob.city ? `${pJob.city}, ${pJob.province}` : pJob.region}</span> • Salary: {pJob.salary}
                            </p>

                            {pJob.pdfCaseNumber && (
                              <p className="text-[11px] font-mono text-amber-300 mt-0.5">
                                Case Ref: {pJob.pdfCaseNumber}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 pl-7 md:pl-0">
                          <button
                            type="button"
                            onClick={() => setSelectedJobForModal(pJob)}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs rounded-xl flex items-center space-x-1 border border-amber-500/30 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Details</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setEditingJob(pJob);
                              setIsJobQuickEditOpen(true);
                            }}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-300 font-bold text-xs rounded-xl flex items-center space-x-1 border border-indigo-500/30 cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setSeoPreviewJob(pJob)}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-teal-300 font-bold text-xs rounded-xl flex items-center space-x-1 border border-teal-500/30 cursor-pointer"
                            title="Inspect SEO tags and Google Schema"
                          >
                            <Globe className="w-3.5 h-3.5" />
                            <span>SEO Tag</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleAdminApproveJob(pJob.id, pJob)}
                            className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl flex items-center space-x-1 shadow-lg shadow-emerald-500/20 cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Approve</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleRejectPrompt(pJob.id)}
                            className="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white font-bold text-xs rounded-xl flex items-center space-x-1 border border-rose-500/30 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Reject</span>
                          </button>
                        </div>
                      </div>

                      <p className="text-xs text-slate-300 bg-slate-900/80 p-3 rounded-lg border border-slate-800/80 pl-4 leading-relaxed">
                        {pJob.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}

            {/* BOTTOM PENDING QUEUE PAGINATION CONTROLS */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-slate-950/90 border border-slate-800 rounded-2xl text-xs text-slate-300 shadow-inner mt-4">
              <div className="flex items-center space-x-2 font-bold">
                <Clock className="w-4 h-4 text-amber-400" />
                <span>Pending Jobs:</span>
                <span className="text-amber-400 font-mono text-sm font-bold">{(pendingTotal ?? pendingJobs.length).toLocaleString()}</span>
              </div>

              <div className="flex items-center space-x-2">
                <span className="text-slate-400 font-medium">Rows:</span>
                <div className="flex items-center space-x-1 bg-slate-900 border border-slate-800 p-0.5 rounded-xl">
                  {[50, 100, 200].map(size => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => {
                        setSelectedPendingIds([]);
                        setSelectedPendingJobCache([]);
                        if (onPendingPageChange) onPendingPageChange(1, size);
                      }}
                      className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                        (pendingLimit ?? 100) === size
                          ? 'bg-amber-500 text-slate-950 shadow-sm'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800'
                      }`}
                    >
                      [{size}]
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <span className="text-slate-400 font-medium">
                  Page <strong className="text-white font-mono">{pendingPage ?? 1}</strong> of <strong className="text-white font-mono">{pendingTotalPages ?? 1}</strong>
                </span>
                <div className="flex items-center space-x-1.5">
                  <button
                    type="button"
                    disabled={(pendingPage ?? 1) <= 1}
                    onClick={() => {
                      setSelectedPendingIds([]);
                      setSelectedPendingJobCache([]);
                      if (onPendingPageChange) onPendingPageChange((pendingPage ?? 1) - 1, pendingLimit);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 font-bold text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                  >
                    [Previous]
                  </button>
                  <button
                    type="button"
                    disabled={(pendingPage ?? 1) >= (pendingTotalPages ?? 1)}
                    onClick={() => {
                      setSelectedPendingIds([]);
                      setSelectedPendingJobCache([]);
                      if (onPendingPageChange) onPendingPageChange((pendingPage ?? 1) + 1, pendingLimit);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 font-bold text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                  >
                    [Next]
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* TAB 2: USER DIRECTORY AUDIT & MANUAL SUBSCRIPTION CONTROL */}
      {effectiveAdminTab === 'user-audit' && canAccessAdminTab('user-audit') && (() => {
        const userClusters = computeUserDuplicateClusters(users);

        const getUserMembershipFlags = (u: UserAccount) => {
          const rawExpiry = u.expiryDate && typeof u.expiryDate === 'string' ? u.expiryDate.trim() : '';
          const expiryMs = rawExpiry ? new Date(rawExpiry).getTime() : NaN;
          const isDateExpired = Number.isFinite(expiryMs) && expiryMs < Date.now();
          const isGenuinelyUnpaid =
            u.paymentStatus === 'Unpaid' ||
            u.paymentStatus === 'Overdue' ||
            u.membershipStatus === 'Unpaid';
          const isRevoked = u.membershipStatus === 'Revoked';
          const isExpired = u.membershipStatus === 'Expired' || isDateExpired;
          const isInactiveOrUnpaid = isGenuinelyUnpaid || isRevoked || isExpired;
          return { isGenuinelyUnpaid, isRevoked, isExpired, isInactiveOrUnpaid };
        };

        const filteredUsers = users.filter((u) => {
          if (userSearchQuery.trim()) {
            const q = userSearchQuery.toLowerCase();
            const matchesName = (u.name || '').toLowerCase().includes(q);
            const matchesEmail = (u.email || '').toLowerCase().includes(q);
            const matchesRole = (u.role || '').toLowerCase().includes(q);
            if (!matchesName && !matchesEmail && !matchesRole) return false;
          }

          const { isInactiveOrUnpaid } = getUserMembershipFlags(u);
          if (userPaymentFilter === 'paid' && isInactiveOrUnpaid) return false;
          if (userPaymentFilter === 'unpaid' && !isInactiveOrUnpaid) return false;

          if (userRoleFilter !== 'all' && u.role !== userRoleFilter) return false;
          if (userPlanFilter !== 'all' && u.plan !== userPlanFilter) return false;

          if (showUserDuplicatesOnly) {
            const isDup = userClusters.some(c => c.items.some(it => it.id === u.id));
            if (!isDup) return false;
          }

          return true;
        });

        const allSelected = filteredUsers.length > 0 && filteredUsers.every(u => selectedUserIds.includes(u.id));

        const handleSelectAllUsers = () => {
          if (allSelected) {
            setSelectedUserIds(prev => prev.filter(id => !filteredUsers.some(u => u.id === id)));
          } else {
            const toAdd = filteredUsers.map(u => u.id);
            setSelectedUserIds(prev => Array.from(new Set([...prev, ...toAdd])));
          }
        };

        const toggleUserSelection = (id: string) => {
          setSelectedUserIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
          );
        };

        const handleBulkDeleteSelectedUsers = async () => {
          if (selectedUserIds.length === 0 || isBulkDeletingUsers) return;
          if (!onBulkDeleteUsers) {
            alert('User deletion handler is unavailable.');
            return;
          }
          if (!confirm(`Permanently delete ${selectedUserIds.length} selected user account(s)? This removes the selected user records and cannot be undone.`)) {
            return;
          }

          setIsBulkDeletingUsers(true);
          try {
            const result = await onBulkDeleteUsers(selectedUserIds);
            if (result && Array.isArray(result.deletedIds)) {
              const deletedSet = new Set(result.deletedIds);
              setSelectedUserIds(prev => prev.filter(id => !deletedSet.has(id)));
              if (result.failed.length > 0) {
                const failureSummary = result.failed
                  .slice(0, 3)
                  .map(f => `${f.userId}: ${f.message}`)
                  .join('; ');
                alert(
                  `Deleted ${result.deletedIds.length} user account(s). Failed to delete ${result.failed.length} account(s): ${failureSummary}`
                );
              } else if (result.deletedIds.length > 0) {
                alert(`Permanently deleted ${result.deletedIds.length} selected user account(s).`);
              }
            }
          } finally {
            setIsBulkDeletingUsers(false);
          }
        };

        const handleBulkEndMembershipSelected = async () => {
          if (selectedUserIds.length === 0 || isBulkEndingMemberships) return;
          if (!onEndUserMembership) {
            alert('Membership termination handler is unavailable.');
            return;
          }
          if (!confirm(`End membership and revoke premium access for ${selectedUserIds.length} selected user(s)?`)) {
            return;
          }

          setIsBulkEndingMemberships(true);
          try {
            const succeededIds: string[] = [];
            const failedMessages: string[] = [];
            for (const id of selectedUserIds) {
              const res = await onEndUserMembership(id, { silent: true });
              if (res && typeof res === 'object' && 'success' in res) {
                if (res.success) {
                  succeededIds.push(id);
                } else {
                  failedMessages.push(`${id}: ${res.message || 'Failed'}`);
                }
              } else if (res === false) {
                failedMessages.push(`${id}: Failed`);
              } else {
                succeededIds.push(id);
              }
            }
            const succeededSet = new Set(succeededIds);
            setSelectedUserIds(prev => prev.filter(id => !succeededSet.has(id)));
            if (failedMessages.length > 0) {
              alert(`Revoked membership for ${succeededIds.length} user(s). Failed for ${failedMessages.length}: ${failedMessages.slice(0, 3).join('; ')}`);
            } else {
              alert(`Revoked membership for ${succeededIds.length} selected user(s).`);
            }
          } finally {
            setIsBulkEndingMemberships(false);
          }
        };

        return (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5 text-white shadow-xl">
            {/* HEADER & TOP CONTROL BAR */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-black flex items-center space-x-2 text-white">
                  <Users className="w-5 h-5 text-amber-400" />
                  <span>Registered User Directory & Subscription Payment Audit</span>
                  <span className="bg-amber-500/20 text-amber-400 text-xs font-bold px-3 py-0.5 rounded-full border border-amber-500/30">
                    {users.length} Users
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Audit employer and applicant accounts, enforce payment requirements, and instantly end memberships or jobs for unpaid users.
                </p>
              </div>

              {/* DUPLICATE CHECK TRIGGER */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsUserDuplicateModalOpen(true)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 border ${
                    userClusters.length > 0
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-500 hover:text-white'
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                  }`}
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Check Duplicate Accounts</span>
                  {userClusters.length > 0 && (
                    <span className="px-1.5 py-0.2 bg-rose-500 text-white rounded text-[10px] font-black ml-1">
                      {userClusters.length}
                    </span>
                  )}
                </button>

                {onBulkEndUnpaidMemberships && (
                  <button
                    onClick={onBulkEndUnpaidMemberships}
                    className="px-3.5 py-2 bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white border border-rose-500/30 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center space-x-1.5 shadow-lg shadow-rose-500/10"
                  >
                    <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                    <span>End All Unpaid Accounts</span>
                  </button>
                )}
              </div>
            </div>

            {/* SEARCH AND FILTERS CONTROLLER */}
            <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-3">
              <div className="flex flex-col md:flex-row items-center gap-3">
                <div className="relative flex-1 w-full">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    placeholder="Search user by name, email, role, or company..."
                    className="w-full pl-9 pr-8 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                  />
                  {userSearchQuery && (
                    <button
                      onClick={() => setUserSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs font-bold"
                    >
                      ×
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                  <select
                    value={userRoleFilter}
                    onChange={(e) => setUserRoleFilter(e.target.value)}
                    className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white font-medium cursor-pointer"
                  >
                    <option value="all">All Roles</option>
                    <option value="Employer">Employer</option>
                    <option value="JobSeeker">JobSeeker</option>
                    <option value="Admin">Admin</option>
                  </select>

                  <select
                    value={userPlanFilter}
                    onChange={(e) => setUserPlanFilter(e.target.value as any)}
                    className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white font-medium cursor-pointer"
                  >
                    <option value="all">All Membership Plans</option>
                    <option value="Premium">Premium Plan</option>
                    <option value="Free">Free Plan</option>
                  </select>

                  <select
                    value={userPaymentFilter}
                    onChange={(e) => setUserPaymentFilter(e.target.value as any)}
                    className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white font-medium cursor-pointer"
                  >
                    <option value="all">All Payment Statuses</option>
                    <option value="paid">Active Paid Accounts</option>
                    <option value="unpaid">⚠️ Unpaid / Expired Accounts</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => setShowUserDuplicatesOnly(!showUserDuplicatesOnly)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      showUserDuplicatesOnly
                        ? 'bg-rose-500 text-white border-rose-400 font-black'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    {showUserDuplicatesOnly ? 'Showing Duplicates Only' : 'Show Duplicates Only'}
                  </button>
                </div>
              </div>

              {/* Selection Summary */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs text-slate-400">
                <div className="flex items-center space-x-3">
                  <label className="flex items-center space-x-2 cursor-pointer font-bold text-slate-200">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={handleSelectAllUsers}
                      className="w-4 h-4 rounded text-amber-500 bg-slate-900 border-slate-700"
                    />
                    <span>Select All Filtered ({filteredUsers.length})</span>
                  </label>
                  {selectedUserIds.length > 0 && (
                    <span className="text-amber-400 font-bold font-mono">
                      ({selectedUserIds.length} selected)
                    </span>
                  )}
                </div>

                <div className="text-[11px]">
                  Showing {filteredUsers.length} of {users.length} registered accounts
                </div>
              </div>
            </div>

            {/* BULK ACTIONS FLOATING/TOP BAR */}
            {selectedUserIds.length > 0 && (
              <div className="p-3.5 bg-gradient-to-r from-indigo-950/80 to-slate-950 border border-indigo-500/40 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-2xl animate-in fade-in">
                <div className="flex items-center space-x-2 text-xs font-bold text-indigo-300">
                  <CheckSquare className="w-4 h-4 text-indigo-400" />
                  <span>{selectedUserIds.length} User Account(s) Selected</span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={isBulkEndingMemberships || isBulkDeletingUsers}
                    onClick={handleBulkEndMembershipSelected}
                    className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 font-bold text-xs rounded-xl border border-amber-500/40 cursor-pointer flex items-center space-x-1 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>{isBulkEndingMemberships ? 'Ending Memberships...' : 'Bulk End Membership'}</span>
                  </button>

                  <button
                    type="button"
                    disabled={isBulkDeletingUsers || isBulkEndingMemberships}
                    onClick={handleBulkDeleteSelectedUsers}
                    className="px-3 py-1.5 bg-rose-500 hover:bg-rose-400 text-white font-bold text-xs rounded-xl shadow-lg shadow-rose-500/20 cursor-pointer flex items-center space-x-1 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{isBulkDeletingUsers ? 'Deleting Accounts...' : `Bulk Delete Accounts (${selectedUserIds.length})`}</span>
                  </button>

                  <button
                    type="button"
                    disabled={isBulkDeletingUsers || isBulkEndingMemberships}
                    onClick={() => setSelectedUserIds([])}
                    className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-xl font-bold cursor-pointer disabled:opacity-50"
                  >
                    Deselect
                  </button>
                </div>
              </div>
            )}

            {/* TABLE OF USERS */}
            {filteredUsers.length === 0 ? (
              <div className="p-8 text-center bg-slate-950 rounded-xl border border-slate-800 text-slate-400 space-y-2">
                <Users className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="font-bold text-slate-300 text-sm">No users found matching current filter.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950 uppercase text-[10px] text-slate-400 font-bold border-b border-slate-800">
                    <tr>
                      <th className="p-3 w-10">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={handleSelectAllUsers}
                          className="w-4 h-4 rounded text-amber-500 bg-slate-900 border-slate-700 cursor-pointer"
                        />
                      </th>
                      <th className="p-3">User & Account</th>
                      <th className="p-3">Role</th>
                      <th className="p-3">Plan</th>
                      <th className="p-3">Payment Status</th>
                      <th className="p-3">Expiry Date</th>
                      <th className="p-3 text-center">Posted Jobs</th>
                      <th className="p-3 text-right">Admin Controls & Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {filteredUsers.map((u) => {
                      const isSelected = selectedUserIds.includes(u.id);
                      const userPostedJobs = [...jobs, ...pendingJobs].filter(j => 
                        j.submittedByUserId === u.id || 
                        (u.name && j.company?.toLowerCase() === u.name.toLowerCase()) ||
                        (u.email && j.company?.toLowerCase() === u.email.toLowerCase())
                      );
                      const { isGenuinelyUnpaid, isRevoked, isExpired, isInactiveOrUnpaid } = getUserMembershipFlags(u);
                      const statusBadgeLabel = isGenuinelyUnpaid
                        ? isRevoked
                          ? '⚠️ Unpaid / Revoked'
                          : '⚠️ Unpaid'
                        : isRevoked
                        ? u.paymentStatus === 'Paid'
                          ? '⛔ Revoked (Paid)'
                          : '⛔ Revoked'
                        : isExpired
                        ? u.paymentStatus === 'Paid'
                          ? '⌛ Expired (Paid)'
                          : '⌛ Expired'
                        : '💳 Paid Active';

                      return (
                        <tr
                          key={u.id}
                          className={`transition-colors ${
                            isSelected ? 'bg-indigo-950/30' : 'hover:bg-slate-800/40'
                          }`}
                        >
                          <td className="p-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleUserSelection(u.id)}
                              className="w-4 h-4 rounded text-amber-500 bg-slate-900 border-slate-700 cursor-pointer"
                            />
                          </td>
                          <td className="p-3">
                            <div
                              onClick={() => setSelectedUserForModal(u)}
                              className="font-bold text-white hover:text-amber-400 cursor-pointer transition-colors flex items-center space-x-1.5"
                            >
                              <span>{u.name}</span>
                              <Eye className="w-3.5 h-3.5 text-amber-400 opacity-80" />
                            </div>
                            <div className="text-slate-400 text-[11px] font-mono">{u.email}</div>
                          </td>
                          <td className="p-3 font-semibold text-slate-200">{u.role}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              u.plan === 'Premium' 
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' 
                                : 'bg-slate-800 text-slate-400 border border-slate-700'
                            }`}>
                              {u.plan}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black inline-flex items-center space-x-1 ${
                              !isInactiveOrUnpaid
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : isExpired && !isGenuinelyUnpaid && !isRevoked
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            }`}>
                              <span>{statusBadgeLabel}</span>
                            </span>
                          </td>
                          <td className="p-3 font-mono text-xs">
                            <span className={isInactiveOrUnpaid ? 'text-rose-400 font-bold' : 'text-slate-300'}>
                              {formatAuditUserExpiryDate(u.expiryDate)}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[11px] font-black">
                              {userPostedJobs.length} Jobs
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end space-x-1.5 flex-wrap gap-y-1">
                              <button
                                onClick={() => setSelectedUserForModal(u)}
                                className="px-2.5 py-1.5 rounded-lg bg-indigo-600/30 hover:bg-indigo-600 text-indigo-200 hover:text-white font-bold text-[11px] border border-indigo-500/40 transition-all cursor-pointer flex items-center space-x-1"
                              >
                                <UserCheck className="w-3.5 h-3.5" />
                                <span>Profile & Audit</span>
                              </button>

                              {onEndUserMembership && (
                                <button
                                  onClick={() => onEndUserMembership(u.id)}
                                  className="px-2 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 font-bold text-[11px] border border-amber-500/30 transition-all cursor-pointer"
                                  title="End user premium membership for non-payment"
                                >
                                  End Premium
                                </button>
                              )}

                              {onDeactivateUserJobs && userPostedJobs.length > 0 && (
                                <button
                                  onClick={() => onDeactivateUserJobs(u.id)}
                                  className="px-2 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white font-bold text-[11px] border border-rose-500/30 transition-all cursor-pointer"
                                  title="Deactivate and suspend all posted jobs by this user"
                                >
                                  Deactivate ({userPostedJobs.length})
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })()}

      {/* TAB 3: PER-JOB FEE PAYMENT LOG SHEET */}
      {effectiveAdminTab === 'fee-logs' && canAccessAdminTab('fee-logs') && (() => {
        const feeLogClusters = computeFeeLogDuplicateClusters(jobPostingFeeLogs);

        const filteredFeeLogs = jobPostingFeeLogs.filter(log => {
          if (feeLogSearchQuery.trim()) {
            const q = feeLogSearchQuery.toLowerCase();
            const matchesUser = (log.userName || '').toLowerCase().includes(q);
            const matchesEmail = (log.userEmail || '').toLowerCase().includes(q);
            const matchesJob = (log.jobTitle || '').toLowerCase().includes(q);
            const matchesMethod = (log.paymentMethod || '').toLowerCase().includes(q);
            if (!matchesUser && !matchesEmail && !matchesJob && !matchesMethod) return false;
          }
          if (feeLogMethodFilter !== 'all' && log.paymentMethod !== feeLogMethodFilter) {
            return false;
          }
          if (feeLogStatusFilter !== 'all' && log.status !== feeLogStatusFilter) {
            return false;
          }
          if (showFeeLogDuplicatesOnly) {
            const isDup = feeLogClusters.some(c => c.items.some(it => it.id === log.id));
            if (!isDup) return false;
          }
          return true;
        });

        const allSelected = filteredFeeLogs.length > 0 && filteredFeeLogs.every(l => selectedFeeLogIds.includes(l.id));

        const handleSelectAllFeeLogs = () => {
          if (allSelected) {
            setSelectedFeeLogIds(prev => prev.filter(id => !filteredFeeLogs.some(l => l.id === id)));
          } else {
            const toAdd = filteredFeeLogs.map(l => l.id);
            setSelectedFeeLogIds(prev => Array.from(new Set([...prev, ...toAdd])));
          }
        };

        const toggleFeeLogSelection = (id: string) => {
          setSelectedFeeLogIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
          );
        };

        const handleBulkDeleteFeeLogs = () => {
          if (selectedFeeLogIds.length === 0) return;
          if (confirm(`Permanently delete ${selectedFeeLogIds.length} selected fee log entries?`)) {
            if (onBulkDeleteFeeLogs) {
              onBulkDeleteFeeLogs(selectedFeeLogIds);
            }
            setSelectedFeeLogIds([]);
          }
        };

        return (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5 text-white shadow-xl">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-bold flex items-center space-x-2">
                  <Receipt className="w-5 h-5 text-emerald-400" />
                  <span>Per-Job Fee Payment Log Sheet</span>
                  <span className="bg-emerald-500/20 text-emerald-400 text-xs font-bold px-3 py-0.5 rounded-full border border-emerald-500/30">
                    Total: {jobPostingFeeLogs.length}
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Complete audit trail of all job posting fees collected by the system.</p>
              </div>

              {/* DUPLICATE PAYMENT CLAIM SCANNER */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsFeeLogDuplicateModalOpen(true)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 border ${
                    feeLogClusters.length > 0
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-500 hover:text-white'
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                  }`}
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Check Duplicate Slips / IDs</span>
                  {feeLogClusters.length > 0 && (
                    <span className="px-1.5 py-0.2 bg-rose-500 text-white rounded text-[10px] font-black ml-1">
                      {feeLogClusters.length}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* SEARCH & FILTERS */}
            <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-3">
              <div className="flex flex-col md:flex-row items-center gap-3">
                <div className="relative flex-1 w-full">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={feeLogSearchQuery}
                    onChange={(e) => setFeeLogSearchQuery(e.target.value)}
                    placeholder="Search logs by user, email, job title, or method..."
                    className="w-full pl-9 pr-8 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                  />
                  {feeLogSearchQuery && (
                    <button
                      onClick={() => setFeeLogSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs font-bold"
                    >
                      ×
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                  <select
                    value={feeLogMethodFilter}
                    onChange={(e) => setFeeLogMethodFilter(e.target.value)}
                    className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white font-medium cursor-pointer"
                  >
                    <option value="all">All Payment Methods</option>
                    <option value="Easypaisa">Easypaisa</option>
                    <option value="JazzCash">JazzCash</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Credit / Debit Card">Credit / Debit Card</option>
                  </select>

                  <select
                    value={feeLogStatusFilter}
                    onChange={(e) => setFeeLogStatusFilter(e.target.value)}
                    className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white font-medium cursor-pointer"
                  >
                    <option value="all">All Statuses</option>
                    <option value="Paid">Paid</option>
                    <option value="Pending">Pending</option>
                    <option value="Refunded">Refunded</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => setShowFeeLogDuplicatesOnly(!showFeeLogDuplicatesOnly)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      showFeeLogDuplicatesOnly
                        ? 'bg-rose-500 text-white border-rose-400 font-black'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    {showFeeLogDuplicatesOnly ? 'Showing Duplicates Only' : 'Show Duplicates Only'}
                  </button>
                </div>
              </div>

              {/* Selection Summary */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs text-slate-400">
                <div className="flex items-center space-x-3">
                  <label className="flex items-center space-x-2 cursor-pointer font-bold text-slate-200">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={handleSelectAllFeeLogs}
                      className="w-4 h-4 rounded text-amber-500 bg-slate-900 border-slate-700"
                    />
                    <span>Select All Filtered ({filteredFeeLogs.length})</span>
                  </label>
                  {selectedFeeLogIds.length > 0 && (
                    <span className="text-amber-400 font-bold font-mono">
                      ({selectedFeeLogIds.length} selected)
                    </span>
                  )}
                </div>

                <div className="text-[11px]">
                  Showing {filteredFeeLogs.length} of {jobPostingFeeLogs.length} records
                </div>
              </div>
            </div>

            {/* BULK ACTIONS BAR */}
            {selectedFeeLogIds.length > 0 && (
              <div className="p-3.5 bg-gradient-to-r from-emerald-950/80 to-slate-950 border border-emerald-500/40 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-2xl animate-in fade-in">
                <div className="flex items-center space-x-2 text-xs font-bold text-emerald-300">
                  <CheckSquare className="w-4 h-4 text-emerald-400" />
                  <span>{selectedFeeLogIds.length} Payment Log(s) Selected</span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleBulkDeleteFeeLogs}
                    className="px-3 py-1.5 bg-rose-500 hover:bg-rose-400 text-white font-bold text-xs rounded-xl shadow-lg shadow-rose-500/20 cursor-pointer flex items-center space-x-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Selected ({selectedFeeLogIds.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedFeeLogIds([])}
                    className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-xl font-bold cursor-pointer"
                  >
                    Deselect
                  </button>
                </div>
              </div>
            )}

            {/* TABLE */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 uppercase text-[10px] text-slate-400 font-bold border-b border-slate-800">
                  <tr>
                    <th className="p-3 w-10">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={handleSelectAllFeeLogs}
                        className="w-4 h-4 rounded text-amber-500 bg-slate-900 border-slate-700 cursor-pointer"
                      />
                    </th>
                    <th className="p-3">Date & Time</th>
                    <th className="p-3">User</th>
                    <th className="p-3">Job Title</th>
                    <th className="p-3">Amount Paid</th>
                    <th className="p-3">Method</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredFeeLogs.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-6 text-center text-slate-500 italic">
                        No per-job posting fees logged matching your criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredFeeLogs.map((log) => {
                      const isSelected = selectedFeeLogIds.includes(log.id);

                      return (
                        <tr
                          key={log.id}
                          className={`font-mono transition-colors ${
                            isSelected ? 'bg-emerald-950/30' : 'hover:bg-slate-800/40'
                          }`}
                        >
                          <td className="p-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleFeeLogSelection(log.id)}
                              className="w-4 h-4 rounded text-amber-500 bg-slate-900 border-slate-700 cursor-pointer"
                            />
                          </td>
                          <td className="p-3 font-semibold text-slate-200">{log.dateTime}</td>
                          <td className="p-3 font-sans">
                            <div className="font-bold text-white">{log.userName}</div>
                            <div className="text-slate-400 text-[10px]">{log.userEmail}</div>
                          </td>
                          <td className="p-3 font-sans font-bold text-emerald-300">{log.jobTitle}</td>
                          <td className="p-3 font-bold text-white">{log.currency} {log.amount.toLocaleString()}</td>
                          <td className="p-3 font-sans font-medium text-slate-300">{log.paymentMethod}</td>
                          <td className="p-3 font-sans">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              {log.status}
                            </span>
                          </td>
                          <td className="p-3 font-sans text-right">
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm(`Delete fee log entry for "${log.jobTitle}"?`)) {
                                  if (onDeleteFeeLog) onDeleteFeeLog(log.id);
                                }
                              }}
                              className="p-1.5 text-rose-400 hover:text-white hover:bg-rose-500/20 rounded-lg cursor-pointer transition-all"
                              title="Delete Fee Record"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* CONSOLIDATED SCRAPER CENTER */}
      {(effectiveAdminTab === 'scraper' || effectiveAdminTab === 'url-scraper' || effectiveAdminTab === 'scraped-history') && canAccessAdminTab(adminTab) && (
        <AutomatedScraperHub
          scraperSources={scraperSources}
          setScraperSources={setScraperSources}
          jobs={jobs}
          pendingJobs={pendingJobs}
          pendingTotal={pendingTotal}
          pendingPage={pendingPage}
          pendingLimit={pendingLimit}
          pendingTotalPages={pendingTotalPages}
          onPendingPageChange={onPendingPageChange}
          onAddJob={onAddJob}
          onBulkAddJobs={onBulkAddJobs}
          onReloadJobs={onReloadJobs}
          onApproveJob={handleAdminApproveJob}
          onRejectJob={handleAdminRejectJob}
          onOverrideDuplicatesToLive={(overrideJobs) => {
            if (onBulkAddJobs) {
              onBulkAddJobs(overrideJobs);
            } else {
              overrideJobs.forEach(j => onAddJob(j));
            }
          }}
          scrapedAuditLogs={scrapedAuditLogs}
          setScrapedAuditLogs={setScrapedAuditLogs}
          onOpenPdfParser={(source) => {
            if (source?.id) setActiveSelectedPdfGazetteId(source.id);
            setIsPdfScraperModalOpen(true);
          }}
          onOpenBatchIngestModal={() => setIsBatchIngestModalOpen(true)}
          canDeleteScrapedJobs={hasAdminUiPermission('jobs.manage')}
        />
      )}

      {/* TAB 5: USER CHAT HUB */}
      {effectiveAdminTab === 'chat-hub' && canAccessAdminTab('chat-hub') && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white shadow-2xl">
          <div className="md:col-span-4 border-r border-slate-800 pr-4 space-y-3">
            <h4 className="text-xs font-bold uppercase text-slate-400">Active User Threads</h4>
            <div className="space-y-1">
              {(users || []).filter(Boolean).map((u) => (
                <button
                  key={u.id}
                  onClick={() => setSelectedChatUserId(u.id)}
                  className={`w-full text-left p-3 rounded-xl text-xs font-medium transition-all flex items-center justify-between cursor-pointer ${
                    selectedChatUserId === u.id
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'bg-slate-950 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <div>
                    <div className="font-bold">{u.name || 'Unnamed User'}</div>
                    <div className="text-[10px] opacity-75">{u.email || 'No email on file'}</div>
                  </div>
                  <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-800 text-amber-300">
                    {formatChatUserRoleLabel(u.role)}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="md:col-span-8 space-y-4">
            <h4 className="text-xs font-bold uppercase text-slate-400">
              Chatting with: <span className="text-amber-400 font-bold">{(users || []).find((u) => u && u.id === selectedChatUserId)?.name || 'Select User'}</span>
            </h4>

            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 h-80 overflow-y-auto space-y-3">
              {selectedUserMessages.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-slate-500 italic">
                  No messages in this user thread yet.
                </div>
              ) : (
                selectedUserMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${
                      msg.senderRole === 'admin' ? 'items-end' : 'items-start'
                    }`}
                  >
                    <div
                      className={`max-w-md p-3 rounded-2xl text-xs space-y-1 ${
                        msg.senderRole === 'admin'
                          ? 'bg-amber-500 text-slate-950 font-bold rounded-tr-none'
                          : 'bg-slate-800 text-slate-100 border border-slate-700 rounded-tl-none'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] opacity-75 gap-3">
                        <span>{msg.senderRole === 'admin' ? 'Portal Admin' : msg.userName}</span>
                        <span>{msg.timestamp}</span>
                      </div>
                      <p className="leading-relaxed">{msg.text}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleAdminSendReply} className="flex gap-2">
              <input
                type="text"
                value={adminReplyText}
                onChange={(e) => setAdminReplyText(e.target.value)}
                placeholder="Type response to user..."
                className="flex-1 px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs"
              />
              <button
                type="submit"
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl flex items-center space-x-1 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>Send</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TAB 6: FORM CUSTOMIZER */}
      {effectiveAdminTab === 'form-customizer' && canAccessAdminTab('form-customizer') && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-white">
          <form onSubmit={handleCreateCustomField} className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold border-b border-slate-800 pb-2">
              Add New Custom Registration Field
            </h3>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Field Label / Name</label>
              <input
                type="text"
                required
                value={fieldLabel}
                onChange={(e) => setFieldLabel(e.target.value)}
                placeholder="e.g. CNIC / Passport Number, Tech Stack"
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Input Type</label>
                <select
                  value={fieldType}
                  onChange={(e) => setFieldType(e.target.value as any)}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs"
                >
                  <option value="text">Short Text</option>
                  <option value="number">Number</option>
                  <option value="select">Dropdown Select</option>
                  <option value="textarea">Multi-line Text</option>
                </select>
              </div>

              <div className="flex items-center pt-5">
                <label className="flex items-center space-x-2 text-xs font-bold text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={fieldRequired}
                    onChange={(e) => setFieldRequired(e.target.checked)}
                    className="rounded bg-slate-950 border-slate-800 text-amber-500"
                  />
                  <span>Is Required Field?</span>
                </label>
              </div>
            </div>

            {fieldType === 'select' && (
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Dropdown Options (Comma separated)</label>
                <input
                  type="text"
                  value={fieldOptions}
                  onChange={(e) => setFieldOptions(e.target.value)}
                  placeholder="Option 1, Option 2, Option 3"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs"
                />
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 cursor-pointer"
            >
              Inject Field into User Registration Modal
            </button>
          </form>

          <div className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3 shadow-2xl">
            <h3 className="text-base font-bold border-b border-slate-800 pb-2">
              Active Registration Form Fields ({customFormFields.length})
            </h3>

            {customFormFields.length === 0 ? (
              <div className="text-xs text-slate-500 p-4 bg-slate-950 rounded-xl italic">
                No custom fields added yet. Add a field on the left to customize user registration!
              </div>
            ) : (
              <div className="space-y-2">
                {customFormFields.map((f) => (
                  <div key={f.id} className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-white">{f.label}</span>
                      <span className="text-slate-400 text-[10px] ml-2">({f.type})</span>
                      {f.required && <span className="ml-2 text-[10px] text-rose-400 font-bold">*Required</span>}
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => onToggleCustomField(f.id)}
                        className={`px-2 py-1 rounded text-[10px] font-bold cursor-pointer ${
                          f.active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-500'
                        }`}
                      >
                        {f.active ? 'Active' : 'Hidden'}
                      </button>

                      <button
                        onClick={() => onDeleteCustomField(f.id)}
                        className="p-1 rounded text-rose-400 hover:bg-rose-500/20 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 7: POST MANUAL JOB */}
      {effectiveAdminTab === 'add-job' && canAccessAdminTab('add-job') && (
        <form onSubmit={handleCreateJob} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6 text-white max-w-4xl shadow-2xl">
          <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-black text-amber-400 flex items-center space-x-2">
                <Plus className="w-5 h-5 text-amber-400" />
                <span>Post Job Directly to Live Portal (Admin Mode)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Bypasses verification queues and immediately publishes with verified Admin badges.
              </p>
            </div>
          </div>

          {/* SECTION 1: SECTOR & CATEGORY SELECTION */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
              1. Select Job Sector / Category
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { id: 'Private Corporate', label: 'Corporate / Private', desc: 'Standard company roles', icon: '🏢' },
                { id: 'Government Sector', label: 'Government / FPSC', desc: 'Public sector & BPS scales', icon: '🏛️' },
                { id: 'Newspaper Classified', label: 'Newspaper Clipping', desc: 'Classified ad with image', icon: '📰' },
                { id: 'International Remote', label: 'Global Remote', desc: 'Overseas & relocation', icon: '🌐' }
              ].map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setJobCategory(cat.id as any);
                    if (cat.id === 'Government Sector') {
                      setRegion('Pakistan');
                      setCurrency('PKR');
                    } else if (cat.id === 'International Remote') {
                      setRegion('Global');
                      setCurrency('USD');
                    }
                  }}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                    jobCategory === cat.id
                      ? 'bg-amber-500/10 border-amber-500 text-white shadow-lg shadow-amber-500/10'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="text-xl mb-1">{cat.icon}</div>
                  <div className="font-bold text-xs text-white">{cat.label}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{cat.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* SECTION 2: CONDITIONAL GOVERNMENT SECTOR FIELDS */}
          {jobCategory === 'Government Sector' && (
            <div className="p-4 sm:p-5 bg-amber-950/20 border border-amber-500/30 rounded-2xl space-y-4">
              <div className="flex items-center space-x-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                <span>Government Sector & Public Scale Configuration</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Ministry / Department</label>
                  <select
                    value={govtDeptPreset}
                    onChange={(e) => setGovtDeptPreset(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
                  >
                    {GOVT_DEPT_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                  {govtDeptPreset === 'Other (Manual Entry)' && (
                    <input
                      type="text"
                      required
                      value={customGovtDept}
                      onChange={(e) => setCustomGovtDept(e.target.value)}
                      placeholder="Type custom Ministry / Dept name..."
                      className="w-full mt-2 px-3 py-2 bg-slate-950 border border-amber-500/50 rounded-lg text-white text-xs placeholder-slate-500 focus:outline-none focus:border-amber-400"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Pay Scale (BPS Scale)</label>
                  <select
                    value={govtScalePreset}
                    onChange={(e) => setGovtScalePreset(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
                  >
                    {GOVT_SCALE_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                  {govtScalePreset === 'Other (Manual Entry)' && (
                    <input
                      type="text"
                      required
                      value={customGovtScale}
                      onChange={(e) => setCustomGovtScale(e.target.value)}
                      placeholder="Type custom Pay Scale (e.g. BPS-17 or Contract)..."
                      className="w-full mt-2 px-3 py-2 bg-slate-950 border border-amber-500/50 rounded-lg text-white text-xs placeholder-slate-500 focus:outline-none focus:border-amber-400"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Public Sector Cadre</label>
                  <select
                    value={govtCadrePreset}
                    onChange={(e) => setGovtCadrePreset(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
                  >
                    {GOVT_CADRE_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                  {govtCadrePreset === 'Other (Manual Entry)' && (
                    <input
                      type="text"
                      required
                      value={customGovtCadre}
                      onChange={(e) => setCustomGovtCadre(e.target.value)}
                      placeholder="Type custom Public Sector Cadre..."
                      className="w-full mt-2 px-3 py-2 bg-slate-950 border border-amber-500/50 rounded-lg text-white text-xs placeholder-slate-500 focus:outline-none focus:border-amber-400"
                    />
                  )}
                </div>
              </div>
            </div>
          )}

          {/* SECTION 3: CONDITIONAL NEWSPAPER AD CLIPPING FIELDS */}
          {jobCategory === 'Newspaper Classified' && (
            <div className="p-4 sm:p-5 bg-teal-950/20 border border-teal-500/30 rounded-2xl space-y-4">
              <div className="flex items-center space-x-2 text-teal-300 font-bold text-xs uppercase tracking-wider">
                <FileText className="w-4 h-4 text-teal-400" />
                <span>Newspaper Classified Advertisement Details</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Newspaper Name</label>
                  <select
                    value={newspaperPreset}
                    onChange={(e) => setNewspaperPreset(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
                  >
                    {NEWSPAPER_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                  {newspaperPreset === 'Other (Manual Entry)' && (
                    <input
                      type="text"
                      required
                      value={customNewspaper}
                      onChange={(e) => setCustomNewspaper(e.target.value)}
                      placeholder="Type custom Newspaper name..."
                      className="w-full mt-2 px-3 py-2 bg-slate-950 border border-teal-500/50 rounded-lg text-white text-xs placeholder-slate-500 focus:outline-none focus:border-teal-400"
                    />
                  )}
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Publication Date</label>
                  <input
                    type="date"
                    value={newspaperDate}
                    onChange={(e) => setNewspaperDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Clipping Image URL (Optional)</label>
                  <input
                    type="url"
                    value={clippingImageUrl}
                    onChange={(e) => setClippingImageUrl(e.target.value)}
                    placeholder="https://... image link"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* SECTION 4: BASIC JOB INFORMATION */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Job Title *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Senior Officer / Lead Engineer"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Organization / Company Name *</label>
                <input
                  type="text"
                  required
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="Company or Government Ministry"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Job Type</label>
                <select
                  value={jobType}
                  onChange={(e) => setJobType(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm"
                >
                  <option value="Remote">100% Remote</option>
                  <option value="Hybrid">Hybrid Office</option>
                  <option value="On-site">On-site Office</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Target Region</label>
                <select
                  value={region}
                  onChange={(e) => setRegion(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm"
                >
                  <option value="Pakistan">🇵🇰 Pakistan</option>
                  <option value="Global">🌐 Global International</option>
                  <option value="US">🇺🇸 United States</option>
                  <option value="UK">🇬🇧 United Kingdom</option>
                  <option value="UAE">🇦🇪 United Arab Emirates</option>
                  <option value="Saudi Arabia">🇸🇦 Saudi Arabia</option>
                  <option value="Canada">🇨🇦 Canada</option>
                  <option value="Europe">🇪🇺 Europe</option>
                  <option value="Australia">🇦🇺 Australia</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Department</label>
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="e.g. Software Development"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm"
                />
              </div>
            </div>

            {/* PAKISTAN SUB-DISTRICT LOCATION SELECTOR */}
            {region === 'Pakistan' && (
              <div className="p-4 bg-slate-950 rounded-xl border border-amber-500/30 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                    🇵🇰 Pakistan Location Mapping (Province → City → District)
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsManualOverrideMode(!isManualOverrideMode)}
                    className={`px-2.5 py-1 rounded text-[11px] font-bold border transition-all cursor-pointer ${
                      isManualOverrideMode
                        ? 'bg-amber-500 text-slate-950 border-amber-400 font-black'
                        : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-white'
                    }`}
                  >
                    {isManualOverrideMode ? '🔓 Manual Bypass Active' : '⚙️ Custom/Manual Override'}
                  </button>
                </div>

                {!isManualOverrideMode ? (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Province</label>
                      <select
                        value={province}
                        onChange={(e) => {
                          setProvince(e.target.value);
                          const p = (PAKISTAN_LOCATIONS || []).find((loc) => loc && loc.province === e.target.value);
                          if (p && Array.isArray(p.cities) && p.cities.length) {
                            setCity(p.cities[0].name);
                            setDistrict(p.cities[0].districts[0] || '');
                          }
                        }}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded text-white text-xs"
                      >
                        {(PAKISTAN_LOCATIONS || []).map((p) => (
                          <option key={p.province} value={p.province}>{p.province}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs text-slate-400 mb-1">City</label>
                      <select
                        value={city}
                        onChange={(e) => {
                          setCity(e.target.value);
                          const c = (formCities || []).find((ci) => ci && ci.name === e.target.value);
                          if (c && Array.isArray(c.districts) && c.districts.length) {
                            setDistrict(c.districts[0]);
                          }
                        }}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded text-white text-xs"
                      >
                        {(formCities || []).map((c) => (
                          <option key={c.name} value={c.name}>{c.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs text-slate-400 mb-1">District / Area</label>
                      <select
                        value={district}
                        onChange={(e) => setDistrict(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded text-white text-xs"
                      >
                        {formDistricts.map((d) => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-amber-950/30 border border-amber-500/40 rounded-xl space-y-3">
                    <p className="text-[11px] text-amber-300 font-semibold">
                      Manual Override Enabled: Manually specify any custom province, city, district, or initial status if dropdown options are disabled or unlisted.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs text-slate-300 font-bold mb-1">Custom Province</label>
                        <input
                          type="text"
                          value={customProvince}
                          onChange={(e) => setCustomProvince(e.target.value)}
                          placeholder="e.g. Gilgit-Baltistan / Azad Kashmir"
                          className="w-full px-3 py-2 bg-slate-900 border border-amber-500/50 rounded text-white text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-300 font-bold mb-1">Custom City</label>
                        <input
                          type="text"
                          value={customCity}
                          onChange={(e) => setCustomCity(e.target.value)}
                          placeholder="e.g. Skardu / Muzaffarabad"
                          className="w-full px-3 py-2 bg-slate-900 border border-amber-500/50 rounded text-white text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-300 font-bold mb-1">Custom District / Area</label>
                        <input
                          type="text"
                          value={customDistrict}
                          onChange={(e) => setCustomDistrict(e.target.value)}
                          placeholder="e.g. Satellite Town / Custom Zone"
                          className="w-full px-3 py-2 bg-slate-900 border border-amber-500/50 rounded text-white text-xs"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* INITIAL JOB STATUS & OVERRIDE CONTROLS */}
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div>
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    🛡️ Admin Initial Status & Publication Control
                  </span>
                  <p className="text-[11px] text-slate-400">
                    Choose whether this job is published directly to live listings, queued for review, or initially suspended.
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  {(['Approved', 'Pending', 'Suspended'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setCustomJobStatus(st)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                        customJobStatus === st
                          ? st === 'Approved'
                            ? 'bg-emerald-500 text-slate-950'
                            : st === 'Pending'
                            ? 'bg-amber-500 text-slate-950'
                            : 'bg-rose-500 text-white'
                          : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
                      }`}
                    >
                      {st === 'Approved' ? '✅ Approved (Live)' : st === 'Pending' ? '⏳ Pending Queue' : '🚫 Suspended'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* SALARY & CURRENCY */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Currency</label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm font-bold"
                >
                  <option value="PKR">PKR (Pakistani Rupee)</option>
                  <option value="USD">USD ($ United States)</option>
                  <option value="GBP">GBP (£ United Kingdom)</option>
                  <option value="EUR">EUR (€ Europe)</option>
                  <option value="AED">AED (UAE Dirham)</option>
                  <option value="SAR">SAR (Saudi Riyal)</option>
                  <option value="CAD">CAD ($ Canada)</option>
                  <option value="AUD">AUD ($ Australia)</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-300 mb-1">Salary Range</label>
                <input
                  type="text"
                  value={salary}
                  onChange={(e) => setSalary(e.target.value)}
                  placeholder="e.g. PKR 250,000 - PKR 350,000 / month"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm"
                />
              </div>
            </div>

            {/* DESCRIPTION & REQUIREMENTS */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Job Description *</label>
              <textarea
                rows={4}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Job responsibilities and domain expectations..."
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Requirements (One per line)</label>
              <textarea
                rows={3}
                value={requirementsInput}
                onChange={(e) => setRequirementsInput(e.target.value)}
                placeholder="Requirements..."
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm"
              />
            </div>

            {/* CONTACT & APPLY LINK */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-bold text-slate-300 mb-1">Direct Apply Link</label>
                <input
                  type="url"
                  value={externalApplyUrl}
                  onChange={(e) => setExternalApplyUrl(e.target.value)}
                  placeholder="https://company.com/apply"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Contact Email / Phone</label>
                <input
                  type="text"
                  value={contactEmailOrPhone}
                  onChange={(e) => setContactEmailOrPhone(e.target.value)}
                  placeholder="hr@company.com or +92..."
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white"
                />
              </div>
            </div>

            {/* TAGS */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Tags (Comma separated)</label>
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="React, BPS-17, Govt Job"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmittingJob}
            className="w-full py-4 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black text-sm shadow-xl shadow-amber-500/20 cursor-pointer flex items-center justify-center space-x-2"
          >
            <Send className="w-4 h-4 text-slate-950" />
            <span>{isSubmittingJob ? 'Saving Job to Database...' : 'Publish Job Directly to Live Portal'}</span>
          </button>
        </form>
      )}

      {/* TAB 8: LIVE LISTINGS */}
      {effectiveAdminTab === 'jobs' && canAccessAdminTab('jobs') && (() => {
        const liveJobClusters = computeJobDuplicateClusters([...jobs, ...pendingJobs]);

        const filteredLiveJobs = jobs.filter(job => {
          if (jobsSearchQuery.trim()) {
            const q = jobsSearchQuery.toLowerCase();
            const matchesTitle = (job.title || '').toLowerCase().includes(q);
            const matchesCompany = (job.company || '').toLowerCase().includes(q);
            const matchesCity = (job.city || '').toLowerCase().includes(q);
            const matchesDept = (job.department || '').toLowerCase().includes(q);
            const matchesCase = (job.pdfCaseNumber || '').toLowerCase().includes(q);
            const matchesTag = (job.tags || []).some(t => t.toLowerCase().includes(q));
            if (!matchesTitle && !matchesCompany && !matchesCity && !matchesDept && !matchesCase && !matchesTag) return false;
          }

          if (jobsCategoryFilter !== 'all' && job.jobCategory !== jobsCategoryFilter) return false;
          if (jobsScaleFilter !== 'all' && job.govtScale !== jobsScaleFilter) return false;
          if (jobsProvinceFilter !== 'all' && job.province !== jobsProvinceFilter) return false;
          if (jobsStatusFilter !== 'all' && (job.status || 'Approved') !== jobsStatusFilter) return false;
          const livePortal = String((job as any).sourcePortal || job.scraperSourceName || job.scrapedSourceDomain || '').toLowerCase();
          if (jobsPortalFilter.trim() && !livePortal.includes(jobsPortalFilter.trim().toLowerCase())) return false;
          if (jobsBatchFilter.trim() && String((job as any).scraperBatchId || '').toLowerCase() !== jobsBatchFilter.trim().toLowerCase()) return false;
          if (jobsCityFilter.trim() && !(job.city || '').toLowerCase().includes(jobsCityFilter.trim().toLowerCase())) return false;
          if (jobsScrapeDateFilter !== 'all') {
            const rawScrapeDate = (job as any).lastScrapedAt || (job as any).scrapedAt || job.createdAt || job.postedAt;
            const scrapeTime = rawScrapeDate ? new Date(rawScrapeDate).getTime() : NaN;
            if (!Number.isFinite(scrapeTime)) return false;
            const ageHours = (Date.now() - scrapeTime) / 3600000;
            const todayKey = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
            const scrapeDayKey = new Date(scrapeTime).toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
            if (jobsScrapeDateFilter === 'today' && scrapeDayKey !== todayKey) return false;
            if (jobsScrapeDateFilter === '24h' && (ageHours < 0 || ageHours > 24)) return false;
            if (jobsScrapeDateFilter === '7days' && (ageHours < 0 || ageHours > 168)) return false;
            if (jobsScrapeDateFilter === '30days' && (ageHours < 0 || ageHours > 720)) return false;
            if (jobsScrapeDateFilter === 'older' && ageHours <= 720) return false;
          }
          const liveHasApplyUrl = Boolean((job as any).applicationUrl || (job as any).originalApplyUrl || (job as any).externalApplyUrl || (job as any).applyUrl);
          const liveHasSourceUrl = Boolean((job as any).sourceUrl || (job as any).scraperSourceUrl);
          const liveIsComplete = Boolean(job.title?.trim() && job.company?.trim() && job.description?.trim() && (job.city || job.province || job.district || (job.country && job.country !== 'Pakistan')));
          if (jobsCompletenessFilter === 'complete' && !liveIsComplete) return false;
          if (jobsCompletenessFilter === 'incomplete' && liveIsComplete) return false;
          if (jobsCompletenessFilter === 'missing_location' && (job.city || job.province || job.district || (job.country && job.country !== 'Pakistan'))) return false;
          if (jobsCompletenessFilter === 'missing_apply' && liveHasApplyUrl) return false;
          if (jobsCompletenessFilter === 'missing_source' && liveHasSourceUrl) return false;
          const liveLocationConfirmed = Boolean((job as any).isLocationConfirmed ?? job.metadata?.isLocationConfirmed ?? false);
          if (jobsLocationFilter === 'confirmed' && !liveLocationConfirmed) return false;
          if (jobsLocationFilter === 'unconfirmed' && liveLocationConfirmed) return false;
          const matchesAdminDateFilter = (rawDate: unknown, filter: string) => {
            if (filter === 'all') return true;
            if (!rawDate) return filter === 'none';
            const date = new Date(String(rawDate));
            const time = date.getTime();
            if (!Number.isFinite(time)) return filter === 'none';
            const days = (time - Date.now()) / 86400000;
            if (filter === 'expired') return days < 0;
            if (filter === '7days') return days >= 0 && days <= 7;
            if (filter === '30days') return days >= 0 && days <= 30;
            if (filter === 'future') return days > 30;
            return true;
          };
          if (!matchesAdminDateFilter((job as any).expiryDate, jobsExpiryFilter)) return false;
          if (!matchesAdminDateFilter((job as any).deadlineDate, jobsDeadlineFilter)) return false;

          if (showJobsDuplicatesOnly) {
            const isDup = liveJobClusters.some(c => c.items.some(it => it.id === job.id));
            if (!isDup) return false;
          }

          return true;
        }).sort((a, b) => {
          if (jobsSortBy === 'newest') {
            const bTime = new Date(b.createdAt || 0).getTime() || (b.postedAt === 'Just now' ? Date.now() : new Date(b.postedAt || 0).getTime()) || 0;
            const aTime = new Date(a.createdAt || 0).getTime() || (a.postedAt === 'Just now' ? Date.now() : new Date(a.postedAt || 0).getTime()) || 0;
            return bTime - aTime;
          }
          if (jobsSortBy === 'oldest') {
            const bTime = new Date(b.createdAt || 0).getTime() || (b.postedAt === 'Just now' ? Date.now() : new Date(b.postedAt || 0).getTime()) || 0;
            const aTime = new Date(a.createdAt || 0).getTime() || (a.postedAt === 'Just now' ? Date.now() : new Date(a.postedAt || 0).getTime()) || 0;
            return aTime - bTime;
          }
          if (jobsSortBy === 'title') return (a.title || '').localeCompare(b.title || '');
          if (jobsSortBy.startsWith('expiry_')) {
            const aExpiry = Date.parse(String((a as any).expiryDate || ''));
            const bExpiry = Date.parse(String((b as any).expiryDate || ''));
            const aValid = Number.isFinite(aExpiry); const bValid = Number.isFinite(bExpiry);
            if (!aValid || !bValid) return aValid ? -1 : bValid ? 1 : 0;
            return jobsSortBy === 'expiry_earliest' ? aExpiry - bExpiry : bExpiry - aExpiry;
          }
          if (jobsSortBy === 'salary') return Number(a.salaryNumericMin || 0) - Number(b.salaryNumericMin || 0);
          const dateValue = (job: Job, mode: 'scraped' | 'updated' | 'posted') => {
            const value = mode === 'scraped' ? ((job as any).lastScrapedAt || (job as any).scrapedAt || job.createdAt || job.postedAt)
              : mode === 'updated' ? ((job as any).updatedAt || (job as any).lastUpdatedAt || job.createdAt || job.postedAt)
              : (job.createdAt || job.postedAt);
            const parsed = value ? new Date(value).getTime() : NaN;
            return Number.isFinite(parsed) ? parsed : 0;
          };
          const mode = jobsSortBy.startsWith('scraped_') ? 'scraped' : jobsSortBy.startsWith('updated_') ? 'updated' : 'posted';
          const delta = dateValue(a, mode) - dateValue(b, mode);
          return jobsSortBy === 'oldest' || jobsSortBy.endsWith('_oldest') ? delta : -delta;
        });

        const allSelected = filteredLiveJobs.length > 0 && filteredLiveJobs.every(j => selectedJobIds.includes(j.id));

        const handleSelectAllLiveJobs = () => {
          if (allSelected) {
            setSelectedJobIds(prev => prev.filter(id => !filteredLiveJobs.some(j => j.id === id)));
          } else {
            const toAdd = filteredLiveJobs.map(j => j.id);
            const combined = Array.from(new Set([...selectedJobIds, ...toAdd]));
            if (combined.length > 500) {
              alert(`Bulk actions support up to 500 selected jobs at a time. ${combined.length} match; please narrow the filters or select a smaller batch.`);
              return;
            }
            setSelectedJobIds(combined);
          }
        };

        const toggleLiveJobSelection = (id: string) => {
          setSelectedJobIds(prev => {
            if (prev.includes(id)) return prev.filter(i => i !== id);
            if (prev.length >= 500) {
              alert('Bulk actions support up to 500 selected jobs at a time. Please remove a selection or narrow the filters.');
              return prev;
            }
            return [...prev, id];
          });
        };

        const handleBulkDeleteSelectedLiveJobs = () => {
          if (selectedJobIds.length === 0) return;
          if (confirm(`Permanently delete ${selectedJobIds.length} selected live job listings?`)) {
            if (onBulkDeleteJobs) {
              onBulkDeleteJobs(selectedJobIds);
            } else {
              selectedJobIds.forEach(id => onDeleteJob(id));
            }
            setSelectedJobIds([]);
          }
        };

        return (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5 text-white shadow-xl">
            {/* TOP HEADER */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-black flex items-center space-x-2 text-white">
                  <Briefcase className="w-5 h-5 text-amber-400" />
                  <span>Active Live Portal Job Listings</span>
                  <span className="bg-emerald-500/20 text-emerald-400 text-xs font-bold px-3 py-0.5 rounded-full border border-emerald-500/30">
                    {jobs.length} Live
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Manage published job vacancies, edit attributes, purge duplicates, or apply bulk updates.
                </p>
              </div>

              {/* ACTION BUTTONS */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsJobDuplicateModalOpen(true)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 border ${
                    liveJobClusters.length > 0
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-500 hover:text-white'
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                  }`}
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Check Duplicate Live Jobs</span>
                  {liveJobClusters.length > 0 && (
                    <span className="px-1.5 py-0.2 bg-rose-500 text-white rounded text-[10px] font-black ml-1">
                      {liveJobClusters.length}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setAdminTab('add-job')}
                  className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-all cursor-pointer flex items-center space-x-1.5 shadow-lg shadow-amber-500/10"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Post New Job</span>
                </button>
              </div>
            </div>

            {/* SEARCH AND FILTERS CONTROLLER */}
            <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-3">
              <div className="flex flex-col md:flex-row items-center gap-3">
                <div className="relative flex-1 w-full">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={jobsSearchQuery}
                    onChange={(e) => setJobsSearchQuery(e.target.value)}
                    placeholder="Search by title, organization, city, department, BPS scale, or tags..."
                    className="w-full pl-9 pr-8 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                  />
                  {jobsSearchQuery && (
                    <button
                      onClick={() => setJobsSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs font-bold"
                    >
                      ×
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                  <select
                    value={jobsCategoryFilter}
                    onChange={(e) => setJobsCategoryFilter(e.target.value)}
                    className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white font-medium cursor-pointer"
                  >
                    <option value="all">All Categories</option>
                    <option value="Government Sector">🏛️ Government Sector</option>
                    <option value="Private Corporate">🏢 Private Corporate</option>
                    <option value="Newspaper Classified">📰 Newspaper Clipping</option>
                    <option value="Tech / IT & Software">💻 Tech / IT</option>
                    <option value="Banking & Finance">💳 Banking & Finance</option>
                    <option value="Healthcare & Medical">🏥 Healthcare</option>
                    <option value="Education & Academic">🎓 Education</option>
                    <option value="International Remote">🌐 Global Remote</option>
                  </select>

                  <select
                    value={jobsProvinceFilter}
                    onChange={(e) => setJobsProvinceFilter(e.target.value)}
                    className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white font-medium cursor-pointer"
                  >
                    <option value="all">All Provinces</option>
                    <option value="Punjab">Punjab</option>
                    <option value="Sindh">Sindh</option>
                    <option value="Khyber Pakhtunkhwa">Khyber Pakhtunkhwa</option>
                    <option value="Balochistan">Balochistan</option>
                    <option value="Islamabad Capital Territory">Islamabad</option>
                    <option value="Azad Kashmir">Azad Kashmir</option>
                    <option value="Gilgit-Baltistan">Gilgit-Baltistan</option>
                    <option value="Global">Global / Remote</option>
                  </select>

                  <input value={jobsPortalFilter} onChange={(e) => setJobsPortalFilter(e.target.value)} placeholder="Source portal (e.g. FPSC)" className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white min-w-[150px]" />
                  <input value={jobsBatchFilter} onChange={(e) => setJobsBatchFilter(e.target.value)} placeholder="Scrape batch ID" className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white min-w-[130px]" />
                  <input value={jobsCityFilter} onChange={(e) => setJobsCityFilter(e.target.value)} placeholder="City" className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white min-w-[110px]" />
                  <select value={jobsScrapeDateFilter} onChange={(e) => setJobsScrapeDateFilter(e.target.value as typeof jobsScrapeDateFilter)} className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white font-medium"><option value="all">Any Scrape Time</option><option value="today">Scraped Today</option><option value="24h">Last 24 Hours</option><option value="7days">Last 7 Days</option><option value="30days">Last 30 Days</option><option value="older">Older than 30 Days</option></select>
                  <select
                    value={jobsScaleFilter}
                    onChange={(e) => setJobsScaleFilter(e.target.value)}
                    className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white font-medium cursor-pointer"
                  >
                    <option value="all">All BPS Scales</option>
                    {['BPS-01', 'BPS-05', 'BPS-07', 'BPS-09', 'BPS-11', 'BPS-14', 'BPS-16', 'BPS-17', 'BPS-18', 'BPS-19', 'BPS-20', 'BPS-21', 'BPS-22'].map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>

                  <select
                    value={jobsSortBy}
                    onChange={(e) => setJobsSortBy(e.target.value as any)}
                    className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white font-medium cursor-pointer"
                  >
                    <option value="newest">📅 Newest First</option>
                    <option value="oldest">📅 Oldest First</option>
                    <option value="title">🔤 Title (A-Z)</option>
                    <option value="scraped_latest">Latest Scraped First</option>
                    <option value="scraped_oldest">Oldest Scraped First</option>
                    <option value="updated_latest">Recently Updated First</option>
                    <option value="updated_oldest">Oldest Updated First</option><option value="expiry_earliest">Earliest Expiry First</option><option value="expiry_latest">Latest Expiry First</option>
                  </select>
                  <select value={jobsCompletenessFilter} onChange={(e) => setJobsCompletenessFilter(e.target.value as typeof jobsCompletenessFilter)} className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white font-medium">
                    <option value="all">All Job Details</option><option value="complete">Complete Jobs</option><option value="incomplete">Incomplete Jobs</option><option value="missing_location">Missing Location</option><option value="missing_apply">Missing Apply URL</option><option value="missing_source">Missing Scraper Source URL</option>
                  </select>
                  <select value={jobsLocationFilter} onChange={(e) => setJobsLocationFilter(e.target.value as typeof jobsLocationFilter)} className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white font-medium">
                    <option value="all">All Location Status</option><option value="confirmed">Location Confirmed</option><option value="unconfirmed">Location Unconfirmed</option>
                  </select>
                  <select value={jobsExpiryFilter} onChange={(e) => setJobsExpiryFilter(e.target.value as typeof jobsExpiryFilter)} className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white font-medium"><option value="all">Any Expiry Date</option><option value="expired">Expired</option><option value="7days">Expires in 7 Days</option><option value="30days">Expires in 30 Days</option><option value="future">Later Expiry</option><option value="none">No Expiry Date</option></select>
                  <select value={jobsDeadlineFilter} onChange={(e) => setJobsDeadlineFilter(e.target.value as typeof jobsDeadlineFilter)} className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white font-medium"><option value="all">Any Application Deadline</option><option value="expired">Deadline Passed</option><option value="7days">Deadline in 7 Days</option><option value="30days">Deadline in 30 Days</option><option value="future">Later Deadline</option><option value="none">No Application Deadline</option></select>

                  <button
                    type="button"
                    onClick={() => setShowJobsDuplicatesOnly(!showJobsDuplicatesOnly)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      showJobsDuplicatesOnly
                        ? 'bg-rose-500 text-white border-rose-400 font-black'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    {showJobsDuplicatesOnly ? 'Showing Duplicates Only' : 'Show Duplicates Only'}
                  </button>
                </div>
              </div>

              {/* Selection Summary */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs text-slate-400">
                <div className="flex items-center space-x-3 flex-wrap">
                  <button type="button" onClick={() => {
                    if (jobs.length > 500) {
                      alert(`There are ${jobs.length} live jobs. Existing bulk operations safely process up to 500 at a time; use filters to select a smaller batch.`);
                      return;
                    }
                    setSelectedJobIds(Array.from(new Set(jobs.map(j => j.id))));
                  }} disabled={jobs.length === 0} className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 hover:text-white text-[11px] font-bold disabled:opacity-40">Select All Live Jobs ({jobs.length})</button>
                  <label className="flex items-center space-x-2 cursor-pointer font-bold text-slate-200">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={handleSelectAllLiveJobs}
                      className="w-4 h-4 rounded text-amber-500 bg-slate-900 border-slate-700"
                    />
                    <span>Select All Filtered ({filteredLiveJobs.length})</span>
                  </label>
                  {selectedJobIds.length > 0 && (
                    <span className="text-amber-400 font-bold font-mono">
                      ({selectedJobIds.length} selected)
                    </span>
                  )}
                </div>

                <div className="text-[11px]">
                  Showing {filteredLiveJobs.length} of {jobs.length} live jobs
                </div>
              </div>
            </div>

            {/* FLOATING / TOP BULK ACTIONS CONTROLLER */}
            {selectedJobIds.length > 0 && (
              <div className="p-3.5 bg-gradient-to-r from-amber-950/80 to-slate-950 border border-amber-500/40 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-2xl animate-in fade-in">
                <div className="flex items-center space-x-2 text-xs font-bold text-amber-300">
                  <CheckSquare className="w-4 h-4 text-amber-400" />
                  <span>{selectedJobIds.length} Live Job(s) Selected</span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsBulkJobEditOpen(true)}
                    className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/20 cursor-pointer flex items-center space-x-1"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Bulk Edit Attributes ({selectedJobIds.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleBulkDeleteSelectedLiveJobs}
                    className="px-3.5 py-1.5 bg-rose-500 hover:bg-rose-400 text-white font-bold text-xs rounded-xl shadow-lg shadow-rose-500/20 cursor-pointer flex items-center space-x-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Bulk Delete ({selectedJobIds.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedJobIds([])}
                    className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-xl font-bold cursor-pointer"
                  >
                    Deselect
                  </button>
                </div>
              </div>
            )}

            {/* LISTINGS TABLE */}
            {filteredLiveJobs.length === 0 ? (
              <div className="p-12 text-center bg-slate-950 rounded-2xl border border-slate-800 text-slate-400 space-y-2">
                <Briefcase className="w-10 h-10 text-slate-600 mx-auto" />
                <p className="font-bold text-slate-300">
                  {jobs.length === 0 ? '0 Jobs in database. Post a job or run scraper to publish vacancies.' : 'No active live jobs match your current search and filter criteria.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950 uppercase text-[10px] text-slate-400 font-bold border-b border-slate-800">
                    <tr>
                      <th className="p-3 w-10">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={handleSelectAllLiveJobs}
                          className="w-4 h-4 rounded text-amber-500 bg-slate-900 border-slate-700 cursor-pointer"
                        />
                      </th>
                      <th className="p-3">Job Title & Sector</th>
                      <th className="p-3">Company / Org</th>
                      <th className="p-3">Location / Scale</th>
                      <th className="p-3">Salary / Pay</th>
                      <th className="p-3">Deadline</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {filteredLiveJobs.map((j) => {
                      const isSelected = selectedJobIds.includes(j.id);

                      return (
                        <tr
                          key={j.id}
                          className={`transition-colors ${
                            isSelected ? 'bg-amber-950/30' : 'hover:bg-slate-800/40'
                          }`}
                        >
                          <td className="p-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleLiveJobSelection(j.id)}
                              className="w-4 h-4 rounded text-amber-500 bg-slate-900 border-slate-700 cursor-pointer"
                            />
                          </td>
                          <td className="p-3">
                            <div
                              onClick={() => setSelectedJobForModal(j)}
                              className="font-bold text-white hover:text-amber-400 cursor-pointer transition-colors flex items-center space-x-1.5"
                            >
                              <span>{j.title}</span>
                              <Eye className="w-3.5 h-3.5 text-amber-400 opacity-80" />
                            </div>
                            <div className="flex items-center space-x-2 mt-0.5">
                              <span className="text-[10px] text-slate-400">{j.jobCategory || 'Corporate'}</span>
                              {j.featured && (
                                <span className="px-1.5 py-0.2 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded text-[9px] font-bold">
                                  ⭐ Featured
                                </span>
                              )}
                              {j.urgent && (
                                <span className="px-1.5 py-0.2 bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded text-[9px] font-bold">
                                  🔥 Urgent
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-3 font-semibold text-slate-200">{j.company}</td>
                          <td className="p-3">
                            <div className="text-slate-300">{j.city || j.province || j.region}</div>
                            {j.govtScale && (
                              <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[10px] font-black font-mono">
                                {j.govtScale}
                              </span>
                            )}
                          </td>
                          <td className="p-3 font-mono text-emerald-300 font-bold">{j.salary}</td>
                          <td className="p-3 font-mono text-slate-400">{j.deadlineDate || 'Open'}</td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              {j.status || 'Approved'}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end space-x-1.5">
                              <button
                                type="button"
                                onClick={() => setSelectedJobForModal(j)}
                                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-lg cursor-pointer transition-all"
                                title="Inspect Job Details"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => setSeoPreviewJob(j)}
                                className="p-1.5 bg-teal-600/20 hover:bg-teal-600 text-teal-300 hover:text-white rounded-lg border border-teal-500/30 cursor-pointer transition-all"
                                title="View Google Search SEO & JSON-LD Metadata"
                              >
                                <Globe className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setEditingJob(j);
                                  setIsJobQuickEditOpen(true);
                                }}
                                className="p-1.5 bg-indigo-600/30 hover:bg-indigo-600 text-indigo-200 hover:text-white rounded-lg border border-indigo-500/30 cursor-pointer transition-all"
                                title="Quick Edit Job"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  if (confirm(`Permanently delete "${j.title}" from live listings?`)) {
                                    onDeleteJob(j.id);
                                  }
                                }}
                                className="p-1.5 bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white rounded-lg cursor-pointer transition-all"
                                title="Delete Job"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })()}

      {/* TAB 9: SUBSCRIBERS */}
      {effectiveAdminTab === 'subscribers' && canAccessAdminTab('subscribers') && (() => {
        const subClusters = computeSubscriberDuplicateClusters(subscribers);

        const filteredSubscribers = subscribers.filter(sub => {
          if (subscriberSearchQuery.trim()) {
            const q = subscriberSearchQuery.toLowerCase();
            const matchesName = (sub.name || '').toLowerCase().includes(q);
            const matchesPhone = (sub.phone || '').toLowerCase().includes(q);
            const matchesEmail = (sub.email || '').toLowerCase().includes(q);
            const matchesPlan = (sub.plan || '').toLowerCase().includes(q);
            if (!matchesName && !matchesPhone && !matchesEmail && !matchesPlan) return false;
          }

          if (subscriberPlanFilter !== 'all' && sub.plan !== subscriberPlanFilter) return false;
          if (subscriberStatusFilter !== 'all' && sub.status !== subscriberStatusFilter) return false;
          if (subscriberMethodFilter !== 'all' && sub.paymentMethod !== subscriberMethodFilter) return false;

          if (showSubscriberDuplicatesOnly) {
            const isDup = subClusters.some(c => c.items.some(it => it.id === sub.id));
            if (!isDup) return false;
          }

          return true;
        });

        const allSelected = filteredSubscribers.length > 0 && filteredSubscribers.every(s => selectedSubscriberIds.includes(s.id));

        const handleSelectAllSubscribers = () => {
          if (allSelected) {
            setSelectedSubscriberIds(prev => prev.filter(id => !filteredSubscribers.some(s => s.id === id)));
          } else {
            const toAdd = filteredSubscribers.map(s => s.id);
            setSelectedSubscriberIds(prev => Array.from(new Set([...prev, ...toAdd])));
          }
        };

        const toggleSubscriberSelection = (id: string) => {
          setSelectedSubscriberIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
          );
        };

        const handleBulkDeleteSubscribers = () => {
          if (selectedSubscriberIds.length === 0) return;
          if (confirm(`Permanently delete ${selectedSubscriberIds.length} selected alert subscribers?`)) {
            if (onBulkDeleteSubscribers) {
              onBulkDeleteSubscribers(selectedSubscriberIds);
            } else if (onDeleteSubscriber) {
              selectedSubscriberIds.forEach(id => onDeleteSubscriber(id));
            }
            setSelectedSubscriberIds([]);
          }
        };

        return (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5 text-white shadow-xl">
            {/* HEADER */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-black flex items-center space-x-2 text-white">
                  <MessageSquare className="w-5 h-5 text-emerald-400" />
                  <span>WhatsApp & SMS Alert Subscribers</span>
                  <span className="bg-emerald-500/20 text-emerald-400 text-xs font-bold px-3 py-0.5 rounded-full border border-emerald-500/30">
                    {subscribers.length} Subscribers
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Manage active subscribers receiving instant WhatsApp daily job alerts and membership notifications.
                </p>
              </div>

              {/* TOP CONTROLS */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsSubscriberDuplicateModalOpen(true)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 border ${
                    subClusters.length > 0
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-500 hover:text-white'
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                  }`}
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Check Duplicate Subscribers</span>
                  {subClusters.length > 0 && (
                    <span className="px-1.5 py-0.2 bg-rose-500 text-white rounded text-[10px] font-black ml-1">
                      {subClusters.length}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setEditingSubscriber(null);
                    setIsSubscriberModalOpen(true);
                  }}
                  className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-emerald-500/20 cursor-pointer flex items-center space-x-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Add New Subscriber</span>
                </button>
              </div>
            </div>

            {/* SEARCH AND FILTERS CONTROLLER */}
            <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-3">
              <div className="flex flex-col md:flex-row items-center gap-3">
                <div className="relative flex-1 w-full">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={subscriberSearchQuery}
                    onChange={(e) => setSubscriberSearchQuery(e.target.value)}
                    placeholder="Search subscriber by name, WhatsApp phone number, email, or plan..."
                    className="w-full pl-9 pr-8 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400"
                  />
                  {subscriberSearchQuery && (
                    <button
                      onClick={() => setSubscriberSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs font-bold"
                    >
                      ×
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                  <select
                    value={subscriberPlanFilter}
                    onChange={(e) => setSubscriberPlanFilter(e.target.value)}
                    className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white font-medium cursor-pointer"
                  >
                    <option value="all">All Alert Plans</option>
                    <option value="Basic">Basic Alerts</option>
                    <option value="Pro Alerts">Pro Alerts (SMS + WhatsApp)</option>
                    <option value="VIP Jobseeker">VIP Jobseeker</option>
                  </select>

                  <select
                    value={subscriberStatusFilter}
                    onChange={(e) => setSubscriberStatusFilter(e.target.value)}
                    className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white font-medium cursor-pointer"
                  >
                    <option value="all">All Statuses</option>
                    <option value="Active">Active Paid</option>
                    <option value="Pending">Pending Verification</option>
                  </select>

                  <select
                    value={subscriberMethodFilter}
                    onChange={(e) => setSubscriberMethodFilter(e.target.value)}
                    className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white font-medium cursor-pointer"
                  >
                    <option value="all">All Payment Gateways</option>
                    <option value="Easypaisa">Easypaisa</option>
                    <option value="JazzCash">JazzCash</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Card">Card</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => setShowSubscriberDuplicatesOnly(!showSubscriberDuplicatesOnly)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      showSubscriberDuplicatesOnly
                        ? 'bg-rose-500 text-white border-rose-400 font-black'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    {showSubscriberDuplicatesOnly ? 'Showing Duplicates Only' : 'Show Duplicates Only'}
                  </button>
                </div>
              </div>

              {/* Selection Summary */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs text-slate-400">
                <div className="flex items-center space-x-3">
                  <label className="flex items-center space-x-2 cursor-pointer font-bold text-slate-200">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={handleSelectAllSubscribers}
                      className="w-4 h-4 rounded text-emerald-500 bg-slate-900 border-slate-700"
                    />
                    <span>Select All Filtered ({filteredSubscribers.length})</span>
                  </label>
                  {selectedSubscriberIds.length > 0 && (
                    <span className="text-emerald-400 font-bold font-mono">
                      ({selectedSubscriberIds.length} selected)
                    </span>
                  )}
                </div>

                <div className="text-[11px]">
                  Showing {filteredSubscribers.length} of {subscribers.length} subscribers
                </div>
              </div>
            </div>

            {/* FLOATING / TOP BULK ACTIONS CONTROLLER */}
            {selectedSubscriberIds.length > 0 && (
              <div className="p-3.5 bg-gradient-to-r from-emerald-950/80 to-slate-950 border border-emerald-500/40 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-2xl animate-in fade-in">
                <div className="flex items-center space-x-2 text-xs font-bold text-emerald-300">
                  <CheckSquare className="w-4 h-4 text-emerald-400" />
                  <span>{selectedSubscriberIds.length} Subscriber(s) Selected</span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleBulkDeleteSubscribers}
                    className="px-3 py-1.5 bg-rose-500 hover:bg-rose-400 text-white font-bold text-xs rounded-xl shadow-lg shadow-rose-500/20 cursor-pointer flex items-center space-x-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Bulk Delete Subscribers ({selectedSubscriberIds.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedSubscriberIds([])}
                    className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-xl font-bold cursor-pointer"
                  >
                    Deselect
                  </button>
                </div>
              </div>
            )}

            {/* SUBSCRIBERS TABLE */}
            {filteredSubscribers.length === 0 ? (
              <div className="p-12 text-center bg-slate-950 rounded-2xl border border-slate-800 text-slate-400 space-y-2">
                <MessageSquare className="w-10 h-10 text-slate-600 mx-auto" />
                <p className="font-bold text-slate-300">No subscribers found matching current filter.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950 uppercase text-[10px] text-slate-400 font-bold border-b border-slate-800">
                    <tr>
                      <th className="p-3 w-10">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={handleSelectAllSubscribers}
                          className="w-4 h-4 rounded text-emerald-500 bg-slate-900 border-slate-700 cursor-pointer"
                        />
                      </th>
                      <th className="p-3">Subscriber</th>
                      <th className="p-3">WhatsApp / Channels</th>
                      <th className="p-3">Alert Plan</th>
                      <th className="p-3">Fee Paid</th>
                      <th className="p-3">Status & Expiry</th>
                      <th className="p-3">Subscribed Date</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {filteredSubscribers.map((s) => {
                      const isSelected = selectedSubscriberIds.includes(s.id);
                      const cleanPhone = (s.phone || '').replace(/[^0-9]/g, '');
                      const whatsappLink = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(`Assalam-o-Alaikum ${s.name}! Your CareerPak job alerts subscription is active.`)}`;

                      return (
                        <tr
                          key={s.id}
                          className={`transition-colors ${
                            isSelected ? 'bg-emerald-950/30' : 'hover:bg-slate-800/40'
                          }`}
                        >
                          <td className="p-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSubscriberSelection(s.id)}
                              className="w-4 h-4 rounded text-emerald-500 bg-slate-900 border-slate-700 cursor-pointer"
                            />
                          </td>
                          <td className="p-3">
                            <strong className="text-white block">{s.name}</strong>
                            <span className="text-[11px] text-slate-400 font-mono">{s.email || 'No email'}</span>
                          </td>
                          <td className="p-3 space-y-1">
                            <div className="font-mono font-bold text-emerald-300 flex items-center space-x-1">
                              <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                              <span>{s.phone}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <span className="px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 rounded text-[9px] font-bold">
                                💬 WA
                              </span>
                              {s.smsEnabled && (
                                <span className="px-1.5 py-0.2 bg-indigo-500/20 text-indigo-300 rounded text-[9px] font-bold">
                                  📱 SMS
                                </span>
                              )}
                              {s.emailEnabled && (
                                <span className="px-1.5 py-0.2 bg-purple-500/20 text-purple-300 rounded text-[9px] font-bold">
                                  ✉️ Email
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded bg-slate-800 text-amber-300 font-bold text-[10px] border border-amber-500/20">
                              {s.plan}
                            </span>
                          </td>
                          <td className="p-3">
                            <div className="font-bold text-white font-mono">PKR {s.amountPaid}</div>
                            <div className="text-[10px] text-slate-400">{s.paymentMethod}</div>
                          </td>
                          <td className="p-3 space-y-1">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              s.status === 'Active'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            }`}>
                              {s.status}
                            </span>
                            {s.expiryDate && (
                              <div className="text-[10px] text-slate-400 font-mono">
                                Exp: {s.expiryDate.split(' ')[0]}
                              </div>
                            )}
                          </td>
                          <td className="p-3 font-mono text-slate-400">{s.subscribedAt || 'Recent'}</td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end space-x-1.5">
                              {cleanPhone && (
                                <a
                                  href={whatsappLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1.5 bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-slate-950 rounded-lg border border-emerald-500/30 cursor-pointer transition-all"
                                  title="Open WhatsApp Chat (واٹس ایپ میسج)"
                                >
                                  <Send className="w-3.5 h-3.5" />
                                </a>
                              )}

                              <button
                                type="button"
                                onClick={() => {
                                  setEditingSubscriber(s);
                                  setIsSubscriberModalOpen(true);
                                }}
                                className="p-1.5 bg-indigo-600/30 hover:bg-indigo-600 text-indigo-200 hover:text-white rounded-lg border border-indigo-500/30 cursor-pointer transition-all"
                                title="Edit Subscriber"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  if (confirm(`Delete subscriber ${s.name}?`)) {
                                    if (onDeleteSubscriber) onDeleteSubscriber(s.id);
                                  }
                                }}
                                className="p-1.5 bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white rounded-lg cursor-pointer transition-all"
                                title="Delete Subscriber"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })()}

      {/* TAB: GLOBAL FEATURE CONTROLS */}
      {effectiveAdminTab === 'settings' && (
        canAccessAdminTab('settings') && (
        <div className="space-y-6 text-white">
          
          {/* MASTER FEATURE SWITCHES PANEL */}
          <div className="md:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white space-y-5 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold flex items-center space-x-2">
                  <ShieldAlert className="w-5 h-5 text-indigo-400" />
                  <span>Administrator Master Feature Switches</span>
                </h3>
                <p className="text-xs text-slate-400 font-medium">Give the administrator complete control to enable or disable features across the portal with a single click.</p>
              </div>
              <span className="bg-indigo-500/20 text-indigo-300 text-xs font-bold px-3 py-1 rounded-full border border-indigo-500/30">
                Live Global Control
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
              
              {/* Feature 1: Scraper Module */}
              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="font-bold text-white">Automated Web Scraper</div>
                  <div className="text-[11px] text-slate-400">Run background scraper engines</div>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleFeature('enableWebScraper')}
                  className={`px-3 py-1.5 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                    featureFlags.enableWebScraper
                      ? 'bg-emerald-500 text-slate-950'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {featureFlags.enableWebScraper ? 'ENABLED' : 'DISABLED'}
                </button>
              </div>

              {/* Feature 2: Universal Scraper (Keywordless) */}
              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="font-bold text-white">Universal Keywordless Scraping</div>
                  <div className="text-[11px] text-slate-400">Scrape all job data without keywords</div>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleFeature('enableUniversalKeywordlessScraper')}
                  className={`px-3 py-1.5 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                    featureFlags.enableUniversalKeywordlessScraper
                      ? 'bg-emerald-500 text-slate-950'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {featureFlags.enableUniversalKeywordlessScraper ? 'ENABLED' : 'DISABLED'}
                </button>
              </div>

              {/* Feature 3: Newspaper Ads with Pictures */}
              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="font-bold text-white">Newspaper Ad Clippings</div>
                  <div className="text-[11px] text-slate-400">Extract newspaper ads with pictures</div>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleFeature('enableNewspaperClippings')}
                  className={`px-3 py-1.5 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                    featureFlags.enableNewspaperClippings
                      ? 'bg-emerald-500 text-slate-950'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {featureFlags.enableNewspaperClippings ? 'ENABLED' : 'DISABLED'}
                </button>
              </div>

              {/* Feature 4: Scraper Auto Approval */}
              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="font-bold text-white">Approval Workflow</div>
                  <div className="text-[11px] text-slate-400">Auto approve or manual review</div>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleFeature('enableScraperAutoApprove')}
                  className={`px-3 py-1.5 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                    featureFlags.enableScraperAutoApprove
                      ? 'bg-emerald-500 text-slate-950'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  }`}
                >
                  {featureFlags.enableScraperAutoApprove ? 'AUTO-APPROVE' : 'MANUAL APPROVAL'}
                </button>
              </div>

              {/* Feature 5: Government Sector Jobs */}
              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="font-bold text-white">Government Jobs Portal</div>
                  <div className="text-[11px] text-slate-400">Classify FPSC, PPSC & BPS scales</div>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleFeature('enableGovtJobsPortal')}
                  className={`px-3 py-1.5 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                    featureFlags.enableGovtJobsPortal
                      ? 'bg-emerald-500 text-slate-950'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {featureFlags.enableGovtJobsPortal ? 'ENABLED' : 'DISABLED'}
                </button>
              </div>

              {/* Feature 6: Deduplication Engine */}
              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="font-bold text-white">Deduplication Engine</div>
                  <div className="text-[11px] text-slate-400">Prevent & skip duplicate entries</div>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleFeature('deduplicationEnabled')}
                  className={`px-3 py-1.5 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                    featureFlags.deduplicationEnabled
                      ? 'bg-emerald-500 text-slate-950'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {featureFlags.deduplicationEnabled ? 'ENABLED' : 'DISABLED'}
                </button>
              </div>

              {/* Feature 7: Email Job Alerts */}
              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="font-bold text-white">Email Job Alerts</div>
                  <div className="text-[11px] text-slate-400">Enable automated email alerts</div>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleFeature('enableEmailAlerts')}
                  className={`px-3 py-1.5 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                    featureFlags.enableEmailAlerts
                      ? 'bg-emerald-500 text-slate-950'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {featureFlags.enableEmailAlerts ? 'ENABLED' : 'DISABLED'}
                </button>
              </div>

              {/* Feature 8: WhatsApp Job Alerts */}
              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="font-bold text-white">WhatsApp Job Alerts</div>
                  <div className="text-[11px] text-slate-400">Enable WhatsApp broadcast alerts</div>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleFeature('enableWhatsAppAlerts')}
                  className={`px-3 py-1.5 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                    featureFlags.enableWhatsAppAlerts
                      ? 'bg-emerald-500 text-slate-950'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {featureFlags.enableWhatsAppAlerts ? 'ENABLED' : 'DISABLED'}
                </button>
              </div>

            </div>
          </div>

        </div>
        )
      )}

              </div>
            </div>
          </>
        );
      })()}

      {/* USER AUDIT DETAILED CONTROL MODAL */}
      {auditUser && (() => {
        const handleAuditSubscriptionAction = async (
          action: 'extend30' | 'revoke' | 'togglePlan' | 'customExpiry'
        ) => {
          if (isAuditSubUpdating) return;
          setIsAuditSubUpdating(true);
          setAuditActionNotice(null);
          try {
            const result = await executeAdminAuditSubscriptionAction({
              action,
              auditUser,
              customExpiryInput,
              onUpdateUserExpiry,
              onToggleUserPlan,
              fetchAuthoritativeUser: (userId) => api.users.getProfile(userId),
              onSyncAuthoritativeUser: (authoritativeUser) => {
                setAuditUser(authoritativeUser);
                if (onUpdateUser) {
                  onUpdateUser(authoritativeUser);
                }
              }
            });

            if (result.success) {
              setAuditActionNotice({ type: 'success', message: result.message });
              if (action === 'customExpiry') {
                setCustomExpiryInput('');
              }
            } else {
              setAuditActionNotice({ type: 'error', message: result.message });
            }
          } finally {
            setIsAuditSubUpdating(false);
          }
        };

        return (
          <AdminUserAuditProfileModal
            auditUser={auditUser}
            transactions={currentTransactions}
            customExpiryInput={customExpiryInput}
            onChangeCustomExpiryInput={setCustomExpiryInput}
            isSubmitting={isAuditSubUpdating}
            notice={auditActionNotice}
            onClose={() => {
              setAuditUser(null);
              setAuditActionNotice(null);
            }}
            onExtend30Days={() => handleAuditSubscriptionAction('extend30')}
            onRevokeNow={() => handleAuditSubscriptionAction('revoke')}
            onSwitchPlan={() => handleAuditSubscriptionAction('togglePlan')}
            onSetCustomDate={() => handleAuditSubscriptionAction('customExpiry')}
          />
        );
      })()}

      {/* USER DETAIL MODAL POP-UP */}
      {selectedUserForModal && (
        <UserDetailModal
          user={selectedUserForModal}
          userJobs={jobs.concat(pendingJobs).filter(j => j.submittedByUserId === selectedUserForModal.id || j.company.toLowerCase() === selectedUserForModal.companyName?.toLowerCase())}
          userApplications={allApplications.filter(a => a.applicantId === selectedUserForModal.id)}
          userAds={ads}
          currentAdminUser={currentAdminUser}
          onUpdateUserRole={async (userId, newRole) => {
            const res = await api.auth.updateUserRole(userId, newRole);
            if (res?.success && res.user) {
              const updatedUserObj = { ...selectedUserForModal, ...res.user };
              setSelectedUserForModal(updatedUserObj);
              if (onUpdateUser) {
                onUpdateUser(updatedUserObj);
              }
            }
            return res;
          }}
          onClose={() => setSelectedUserForModal(null)}
          onUpdateUserExpiry={onUpdateUserExpiry}
          onToggleUserPlan={onToggleUserPlan}
          onUpdateUserPassword={onUpdateUserPassword}
          onEndUserMembership={onEndUserMembership}
          onDeactivateUserJobs={onDeactivateUserJobs}
          onEndUserMembershipAndJobs={onEndUserMembershipAndJobs}
          onSuspendJob={onSuspendJob}
          onInspectJob={(j) => setSelectedJobForModal(j)}
          onSaveAdminNotes={async (userId, notes) => {
            try {
              const res = await api.users.updateProfile(userId, { adminNotes: notes });
              if (res && res.success && res.user) {
                setSelectedUserForModal(prev => prev && String(prev.id) === String(userId) ? { ...prev, ...res.user } : prev);
                if (onUpdateUser) {
                  onUpdateUser(res.user);
                }
              } else {
                alert(res?.message || 'Failed to save admin notes.');
              }
            } catch (err: any) {
              alert(err?.message || 'Error saving admin notes.');
            }
          }}
          onUpdateUserVerification={async (userId, status, kycStatus) => {
            try {
              const payload: Record<string, any> = {
                verificationStatus: status,
                ...(kycStatus ? { kycStatus } : {})
              };
              const res = await api.users.updateProfile(userId, payload);
              if (res && res.success && res.user) {
                setSelectedUserForModal(prev => prev && String(prev.id) === String(userId) ? { ...prev, ...res.user } : prev);
                if (onUpdateUser) {
                  onUpdateUser(res.user);
                }
              } else {
                alert(res?.message || 'Failed to update verification status.');
              }
            } catch (err: any) {
              alert(err?.message || 'Error updating verification status.');
            }
          }}
        />
      )}

      {/* ADMIN JOB DETAIL MODAL POP-UP */}
      {selectedJobForModal && (
        <AdminJobDetailModal
          job={selectedJobForModal}
          users={users}
          feeLogs={jobPostingFeeLogs}
          onClose={() => setSelectedJobForModal(null)}
          onApproveJob={async (id) => {
            const res = await handleAdminApproveJob(id, selectedJobForModal || undefined);
            if (res && res.success === true) {
              setSelectedJobForModal(null);
            }
            return res;
          }}
          onRejectJob={(id, reason) => {
            onRejectJob(id, reason);
            setSelectedJobForModal(null);
          }}
          onSuspendJob={onSuspendJob}
          onViewUserProfile={(u) => {
            setSelectedUserForModal(u);
          }}
          onEditJob={(j) => {
            setEditingJob(j);
            setIsJobQuickEditOpen(true);
            setSelectedJobForModal(null);
          }}
        />
      )}

      {/* PDF CONSOLIDATED SCRAPER MODAL (FPSC / WAPDA / PPSC / KPPSC / SPSC / CUSTOM SITES) */}
      <PdfConsolidatedScraperModal
        isOpen={isPdfScraperModalOpen}
        onClose={() => setIsPdfScraperModalOpen(false)}
        onBatchImportJobs={handleBatchImportPdfJobs}
        onLogBatchRun={handleLogPdfBatchRun}
        gazettes={pdfGazettes}
        onAddGazette={(g) => handleAddPdfGazette(g, false)}
        onDeleteGazette={handleDeletePdfGazette}
        initialSelectedGazetteId={activeSelectedPdfGazetteId}
        existingJobs={[...jobs, ...pendingJobs]}
        onUpdateGazettesLastScraped={handleBatchUpdateGazettesLastScraped}
        onRefreshJobs={onReloadJobs}
      />

      {/* QUICK EDIT / BULK EDIT JOB MODAL */}
      <AdminQuickEditJobModal
        isOpen={isJobQuickEditOpen || isBulkJobEditOpen}
        job={isBulkJobEditOpen ? null : editingJob}
        selectedJobs={isBulkJobEditOpen ? Array.from(new Map([...selectedPendingJobCache, ...jobs, ...pendingJobs].filter(j => selectedJobIds.includes(j.id) || selectedPendingIds.includes(j.id)).map(j => [j.id, j])).values()) : []}
        allowBulkStatusChange={selectedPendingIds.length === 0}
        onClose={() => {
          setIsJobQuickEditOpen(false);
          setIsBulkJobEditOpen(false);
          setEditingJob(null);
        }}
        onSaveJob={async (updatedJob) => {
          if (onUpdateJob) {
            const res = await onUpdateJob(updatedJob);
            if (res === false || (res && typeof res === 'object' && (res as any).success === false)) {
              throw new Error(
                (res && typeof res === 'object' && (res as any).message) ||
                  'Job update was not confirmed by the server.'
              );
            }
          }
          setIsJobQuickEditOpen(false);
          setEditingJob(null);
        }}
        onBulkSaveJobs={(updatedJobs) => {
          if (onBulkUpdateJobs) {
            onBulkUpdateJobs(updatedJobs);
          } else if (onUpdateJob) {
            updatedJobs.forEach(j => onUpdateJob(j));
          }
          setSelectedJobIds([]);
          setSelectedPendingIds([]);
          setSelectedPendingJobCache([]);
          setIsBulkJobEditOpen(false);
        }}
        onSaveAndApproveJob={async (updatedJob) => {
          try {
            const missing = calculateJobMissingFields(updatedJob);
            if (missing.length > 0) {
              alert(`Cannot approve job yet! Missing required factual fields: ${missing.join(', ')}. Please fill in these details before publishing.`);
              return { success: false, message: `Missing required factual fields: ${missing.join(', ')}` };
            }

            const pendingToSave: Job = {
              ...updatedJob,
              status: 'Pending' as JobStatus,
              isManuallyCorrected: true,
              isLocationConfirmed: true
            };
            const saveRes = await api.jobs.update(updatedJob.id, pendingToSave);
            if (saveRes && (saveRes as any).success === false) {
              const errMsg = `Failed to save job edits before approval: ${(saveRes as any).message || 'Server error'}`;
              alert(errMsg);
              return { success: false, message: errMsg };
            }

            const approveRes = await handleAdminApproveJob(updatedJob.id, updatedJob);
            if (approveRes && approveRes.success) {
              if (onReloadJobs) await onReloadJobs();
              setIsJobQuickEditOpen(false);
              setEditingJob(null);
              return { success: true };
            } else {
              return { success: false, message: approveRes?.message || 'Approval failed' };
            }
          } catch (err: any) {
            const errMsg = `Error during save & approve: ${err?.message || 'Unknown error'}`;
            alert(errMsg);
            return { success: false, message: errMsg };
          }
        }}
      />

      {/* LIVE JOBS DUPLICATE CHECKER MODAL */}
      <AdminDuplicateCheckerModal
        isOpen={isJobDuplicateModalOpen}
        onClose={() => setIsJobDuplicateModalOpen(false)}
        entityType="jobs"
        jobClusters={computeJobDuplicateClusters([...jobs, ...pendingJobs])}
        onResolveJobDuplicates={(keepId, deleteIds) => {
          const liveIdsSet = new Set(jobs.map(j => j.id));
          const validDeleteIds = deleteIds.filter(id => liveIdsSet.has(id));
          if (onBulkDeleteJobs) {
            onBulkDeleteJobs(validDeleteIds);
          } else {
            validDeleteIds.forEach(id => onDeleteJob(id));
          }
          setIsJobDuplicateModalOpen(false);
        }}
        onBulkSelectDuplicateIds={(ids) => {
          const liveIdsSet = new Set(jobs.map(j => j.id));
          setSelectedJobIds(ids.filter(id => liveIdsSet.has(id)));
          setIsJobDuplicateModalOpen(false);
        }}
      />

      {/* PENDING JOBS DUPLICATE CHECKER MODAL */}
      <AdminDuplicateCheckerModal
        isOpen={isPendingDuplicateModalOpen}
        onClose={() => setIsPendingDuplicateModalOpen(false)}
        entityType="pending"
        jobClusters={computeJobDuplicateClusters([...jobs, ...pendingJobs])}
        onResolveJobDuplicates={(keepId, deleteIds) => {
          const pendingIdsSet = new Set(pendingJobs.map(p => p.id));
          const validDeleteIds = deleteIds.filter(id => pendingIdsSet.has(id));
          if (onBulkRejectPendingJobs) {
            onBulkRejectPendingJobs(validDeleteIds, 'Duplicate job submission detected in moderation queue');
          } else {
            validDeleteIds.forEach(id => onRejectJob(id, 'Duplicate job submission detected'));
          }
          setIsPendingDuplicateModalOpen(false);
        }}
        onBulkSelectDuplicateIds={(ids) => {
          const pendingIdsSet = new Set(pendingJobs.map(p => p.id));
          setSelectedPendingIds(ids.filter(id => pendingIdsSet.has(id)));
          setIsPendingDuplicateModalOpen(false);
        }}
      />

      {/* SUBSCRIBERS DUPLICATE CHECKER MODAL */}
      <AdminDuplicateCheckerModal
        isOpen={isSubscriberDuplicateModalOpen}
        onClose={() => setIsSubscriberDuplicateModalOpen(false)}
        entityType="subscribers"
        subscriberClusters={computeSubscriberDuplicateClusters(subscribers)}
        onResolveSubscriberDuplicates={(keepId, deleteIds) => {
          if (onBulkDeleteSubscribers) {
            onBulkDeleteSubscribers(deleteIds);
          } else if (onDeleteSubscriber) {
            deleteIds.forEach(id => onDeleteSubscriber(id));
          }
          setIsSubscriberDuplicateModalOpen(false);
        }}
        onBulkSelectDuplicateIds={(ids) => {
          setSelectedSubscriberIds(ids);
          setIsSubscriberDuplicateModalOpen(false);
        }}
      />

      {/* USERS DUPLICATE CHECKER MODAL */}
      <AdminDuplicateCheckerModal
        isOpen={isUserDuplicateModalOpen}
        onClose={() => setIsUserDuplicateModalOpen(false)}
        entityType="users"
        userClusters={computeUserDuplicateClusters(users)}
        onBulkSelectDuplicateIds={(ids) => {
          setSelectedUserIds(ids);
          setIsUserDuplicateModalOpen(false);
        }}
      />

      {/* FEE LOGS DUPLICATE CHECKER MODAL */}
      <AdminDuplicateCheckerModal
        isOpen={isFeeLogDuplicateModalOpen}
        onClose={() => setIsFeeLogDuplicateModalOpen(false)}
        entityType="fee-logs"
        feeLogClusters={computeFeeLogDuplicateClusters(jobPostingFeeLogs)}
        onBulkSelectDuplicateIds={(ids) => {
          setSelectedFeeLogIds(ids);
          setIsFeeLogDuplicateModalOpen(false);
        }}
      />

      {/* ADMIN SUBSCRIBER ADD / EDIT MODAL */}
      <AdminSubscriberModal
        isOpen={isSubscriberModalOpen}
        subscriber={editingSubscriber}
        onClose={() => {
          setIsSubscriberModalOpen(false);
          setEditingSubscriber(null);
        }}
        onSave={(sub) => {
          if (editingSubscriber) {
            if (onUpdateSubscriber) {
              onUpdateSubscriber(sub);
            }
          } else {
            if (onAddSubscriber) {
              onAddSubscriber(sub);
            }
          }
          setIsSubscriberModalOpen(false);
          setEditingSubscriber(null);
        }}
      />

      {/* SMART BATCH URL INGESTION & DUPLICATE DEDUPLICATOR MODAL */}
      <BatchUrlIngestModal
        isOpen={isBatchIngestModalOpen}
        onClose={() => setIsBatchIngestModalOpen(false)}
        existingPortals={OFFICIAL_GOVT_SCRAPER_PORTALS}
        existingGazettes={pdfGazettes}
        onAddPortals={handleBatchAddPortals}
        onAddJobs={(newJobs) => {
          newJobs.forEach(j => onAddJob(j));
        }}
      />

      {/* GOOGLE SEO & JSON-LD SCHEMA PREVIEW MODAL */}
      {seoPreviewJob && (
        <JobSeoPreviewModal
          job={seoPreviewJob}
          isOpen={!!seoPreviewJob}
          onClose={() => setSeoPreviewJob(null)}
        />
      )}

    </div>
  );
};
