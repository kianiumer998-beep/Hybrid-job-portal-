import React, { useState, useEffect } from 'react';
import { 
  Job, 
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
  CreditCard
} from 'lucide-react';
import { UserDetailModal } from './UserDetailModal';
import { AdminJobDetailModal } from './AdminJobDetailModal';
import { safeLocalStorageSet, safeLocalStorageGet, safeAlert, clearBulkyStorageCaches } from '../utils/safeStorage';
import { AdminAdHub } from './ads/AdminAdHub';
import { ScrapedJobHistoryModule } from './ScrapedJobHistoryModule';
import { PdfConsolidatedScraperModal } from './PdfConsolidatedScraperModal';
import { AdminQuickEditJobModal } from './admin/AdminQuickEditJobModal';
import { AdminDuplicateCheckerModal, DuplicateCluster } from './admin/AdminDuplicateCheckerModal';
import { AdminSubscriberModal } from './admin/AdminSubscriberModal';
import { BatchUrlIngestModal } from './BatchUrlIngestModal';
import { AdminPaymentMethodsManager } from './admin/AdminPaymentMethodsManager';
import { AdminUrlScraperController } from './admin/AdminUrlScraperController';
import { JobSeoPreviewModal } from './common/JobSeoPreviewModal';
import { injectJobJsonLd } from '../utils/seoHelper';
import { 
  MOCK_CONSOLIDATED_PDF_GAZETTES, 
  ALL_CONSOLIDATED_PDF_GAZETTES,
  getUnifiedAllGazettes,
  generateGazetteFromManualInput,
  OFFICIAL_GOVT_SCRAPER_PORTALS,
  OfficialGovtPdfPortal,
  generateScrapedJobsForPortal
} from '../data/mockPdfConsolidatedAds';
import { INITIAL_SCRAPED_AUDIT_LOGS, INITIAL_SCRAPER_BATCH_RUNS } from '../data/mockScraperHistory';

// Advanced International Admin Suite Modules
import { AdminAnalyticsOverview } from './admin/AdminAnalyticsOverview';
import { AdminSeoSettings } from './admin/AdminSeoSettings';
import { AdminCurrencyManager } from './admin/AdminCurrencyManager';
import { AdminBroadcastCenter } from './admin/AdminBroadcastCenter';
import { AdminDataBackupHub } from './admin/AdminDataBackupHub';
import { AdminAiQualityEnhancer } from './admin/AdminAiQualityEnhancer';
import { AdminEmployerKycHub } from './admin/AdminEmployerKycHub';
import { LandingPageCustomizer } from './admin/LandingPageCustomizer';
import { AdminCampaignCenter } from './admin/AdminCampaignCenter';
import { AdminFeeManager } from './admin/AdminFeeManager';
import { AdminActivityLogs } from './admin/AdminActivityLogs';
import { AdminBulkNotificationTool } from './admin/AdminBulkNotificationTool';
import { AdminWhatsAppManager } from './admin/AdminWhatsAppManager';
import { AdminPaymentVerificationHub } from './admin/AdminPaymentVerificationHub';
import { WhatsAppSupportConfig } from './WhatsAppStickyButton';
import { INITIAL_PAYMENT_TRANSACTIONS } from '../data/mockTransactions';
import { LandingPageConfig } from '../types/landing';
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
  subscribers: Subscriber[];
  users: UserAccount[];
  chatMessages: ChatMessage[];
  customFormFields: CustomFormField[];
  jobPostingFeePkr: number;
  onChangeJobPostingFee: (newFee: number) => void;
  jobPostingFeeLogs: JobPostingFeeLog[];
  allApplications?: JobApplication[];
  onApproveJob: (jobId: string) => void;
  onRejectJob: (jobId: string, reason: string) => void;
  onAddJob: (newJob: Job) => void;
  onAddPendingJob?: (newJob: Job) => void;
  onBulkAddJobs?: (jobs: Job[]) => void;
  onBulkAddPendingJobs?: (jobs: Job[]) => void;
  onDeleteJob: (jobId: string) => void;
  onUpdateJob?: (job: Job) => void;
  onBulkDeleteJobs?: (jobIds: string[]) => void;
  onBulkUpdateJobs?: (jobs: Job[]) => void;
  onBulkApprovePendingJobs?: (jobIds: string[]) => void;
  onBulkRejectPendingJobs?: (jobIds: string[], reason: string) => void;
  onAddSubscriber?: (subscriber: Subscriber) => void;
  onUpdateSubscriber?: (subscriber: Subscriber) => void;
  onDeleteSubscriber?: (subscriberId: string) => void;
  onBulkDeleteSubscribers?: (subscriberIds: string[]) => void;
  onUpdateUser?: (user: UserAccount) => void;
  onBulkDeleteUsers?: (userIds: string[]) => void;
  onDeleteFeeLog?: (logId: string) => void;
  onBulkDeleteFeeLogs?: (logIds: string[]) => void;
  onSendMessageToUser: (userId: string, userName: string, text: string) => void;
  onAddCustomField: (field: CustomFormField) => void;
  onToggleCustomField: (fieldId: string) => void;
  onDeleteCustomField: (fieldId: string) => void;
  onUpdateUserExpiry: (userId: string, newExpiryDate: string) => void;
  onToggleUserPlan: (userId: string) => void;
  onUpdateUserPassword?: (userId: string, newPass: string) => void;
  onEndUserMembership?: (userId: string) => void;
  onDeactivateUserJobs?: (userId: string) => void;
  onEndUserMembershipAndJobs?: (userId: string) => void;
  onSuspendJob?: (jobId: string, reason?: string) => void;
  onBulkEndUnpaidMemberships?: () => void;
  monthlyFeePkr: number;
  onChangeMonthlyFee: (newFee: number) => void;
  onExitAdmin: () => void;
  ads?: Advertisement[];
  onAddAd?: (ad: Advertisement) => void;
  onUpdateAd?: (ad: Advertisement) => void;
  onDeleteAd?: (adId: string) => void;
  onResetAdMetrics?: (adId?: string) => void;
  pricingConfig?: AdPricingConfig;
  onUpdatePricingConfig?: (config: AdPricingConfig) => void;
  campaignConfig?: CampaignCustomizationConfig;
  onUpdateCampaignConfig?: (config: CampaignCustomizationConfig) => void;
  onApproveAd?: (adId: string) => void;
  onRejectAd?: (adId: string, reason: string) => void;
  jobPostingPricing?: JobPostingPricingConfig;
  onChangeJobPostingPricing?: (config: JobPostingPricingConfig) => void;
  landingConfig?: LandingPageConfig;
  onUpdateLandingConfig?: (config: LandingPageConfig) => void;
  whatsAppSupportConfig?: WhatsAppSupportConfig;
  onUpdateWhatsAppConfig?: (config: WhatsAppSupportConfig) => void;
  paymentTransactions?: PaymentTransaction[];
  onApprovePaymentTransaction?: (transactionId: string, note?: string) => void;
  onRejectPaymentTransaction?: (transactionId: string, reason: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  jobs,
  pendingJobs,
  subscribers,
  users,
  chatMessages,
  customFormFields,
  jobPostingFeePkr,
  onChangeJobPostingFee,
  jobPostingFeeLogs,
  jobPostingPricing = DEFAULT_JOB_POSTING_PRICING_CONFIG,
  onChangeJobPostingPricing,
  allApplications = [],
  onApproveJob,
  onRejectJob,
  onAddJob,
  onAddPendingJob,
  onBulkAddJobs,
  onBulkAddPendingJobs,
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
  monthlyFeePkr,
  onChangeMonthlyFee,
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
  onUpdateLandingConfig,
  whatsAppSupportConfig,
  onUpdateWhatsAppConfig,
  paymentTransactions,
  onApprovePaymentTransaction,
  onRejectPaymentTransaction
}) => {
  const [adminTab, setAdminTab] = useState<
    | 'analytics'
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
    | 'add-job'
    | 'jobs'
    | 'subscribers'
    | 'settings'
    | 'stats'
  >('analytics');

  // Modern Admin Category & Quick 3-Dot Drawer State
  type AdminCategory = 'jobs' | 'scraper' | 'ads' | 'payments' | 'users' | 'alerts' | 'settings';
  const [activeCategory, setActiveCategory] = useState<AdminCategory>('jobs');
  const [showAllModulesMenu, setShowAllModulesMenu] = useState(false);
  const [moduleSearchQuery, setModuleSearchQuery] = useState('');
  const [seoPreviewJob, setSeoPreviewJob] = useState<Job | null>(null);

  // International Admin Suite States (Persisted in LocalStorage)
  const [siteSeoConfig, setSiteSeoConfig] = useState<SiteSeoConfig>(() => {
    try {
      const saved = localStorage.getItem('career_pak_seo_config');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return INITIAL_SITE_SEO_CONFIG;
  });

  const [currencyConfig, setCurrencyConfig] = useState<CurrencyExchangeConfig>(() => {
    try {
      const saved = localStorage.getItem('career_pak_currency_config');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return INITIAL_CURRENCY_CONFIG;
  });

  const [broadcastCampaigns, setBroadcastCampaigns] = useState<BroadcastCampaign[]>(() => {
    try {
      const saved = localStorage.getItem('career_pak_broadcast_campaigns');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return INITIAL_BROADCAST_CAMPAIGNS;
  });

  const [commConfig, setCommConfig] = useState<CommunicationProviderConfig>(() => {
    try {
      const saved = localStorage.getItem('career_pak_comm_config');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return INITIAL_COMM_CONFIG;
  });

  const [kycRequests, setKycRequests] = useState<EmployerKycRequest[]>(() => {
    try {
      const saved = localStorage.getItem('career_pak_kyc_requests');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return INITIAL_KYC_REQUESTS;
  });

  useEffect(() => {
    try {
      localStorage.setItem('career_pak_seo_config', JSON.stringify(siteSeoConfig));
    } catch (e) {}
  }, [siteSeoConfig]);

  useEffect(() => {
    try {
      localStorage.setItem('career_pak_currency_config', JSON.stringify(currencyConfig));
    } catch (e) {}
  }, [currencyConfig]);

  useEffect(() => {
    try {
      localStorage.setItem('career_pak_broadcast_campaigns', JSON.stringify(broadcastCampaigns));
    } catch (e) {}
  }, [broadcastCampaigns]);

  useEffect(() => {
    try {
      localStorage.setItem('career_pak_comm_config', JSON.stringify(commConfig));
    } catch (e) {}
  }, [commConfig]);

  useEffect(() => {
    try {
      localStorage.setItem('career_pak_kyc_requests', JSON.stringify(kycRequests));
    } catch (e) {}
  }, [kycRequests]);

  // WhatsApp Support Configuration State
  const [internalWhatsAppConfig, setInternalWhatsAppConfig] = useState<WhatsAppSupportConfig>(() => {
    if (whatsAppSupportConfig) return whatsAppSupportConfig;
    try {
      const saved = localStorage.getItem('hybrid_whatsapp_support_config');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {
      phoneNumber: '923001234567',
      agentName: 'Ayesha (Lead Career Advisor)',
      defaultMessage: 'Hello! I need assistance regarding job applications on CareerPak...',
      supportHoursText: 'Online • 9:00 AM - 9:00 PM PKT',
      enabled: true,
      position: 'bottom-right'
    };
  });

  // Payment Verification Transactions State
  const [internalTransactions, setInternalTransactions] = useState<PaymentTransaction[]>(() => {
    if (paymentTransactions && paymentTransactions.length > 0) return paymentTransactions;
    try {
      const saved = localStorage.getItem('hybrid_payment_transactions');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return INITIAL_PAYMENT_TRANSACTIONS;
  });

  const currentWhatsAppConfig = whatsAppSupportConfig || internalWhatsAppConfig;
  const currentTransactions = paymentTransactions && paymentTransactions.length > 0 ? paymentTransactions : internalTransactions;

  const handleUpdateWhatsApp = (newCfg: WhatsAppSupportConfig) => {
    setInternalWhatsAppConfig(newCfg);
    if (onUpdateWhatsAppConfig) {
      onUpdateWhatsAppConfig(newCfg);
    }
    try {
      localStorage.setItem('hybrid_whatsapp_support_config', JSON.stringify(newCfg));
    } catch (e) {}
  };

  const handleApproveTx = (txId: string, note?: string) => {
    if (onApprovePaymentTransaction) {
      onApprovePaymentTransaction(txId, note);
    }
    setInternalTransactions(prev => {
      const updated = prev.map(t => t.id === txId ? { ...t, status: 'Success' as const, verifiedAt: new Date().toISOString(), adminNote: note } : t);
      try { localStorage.setItem('hybrid_payment_transactions', JSON.stringify(updated)); } catch (e) {}
      return updated;
    });
  };

  const handleRejectTx = (txId: string, reason: string) => {
    if (onRejectPaymentTransaction) {
      onRejectPaymentTransaction(txId, reason);
    }
    setInternalTransactions(prev => {
      const updated = prev.map(t => t.id === txId ? { ...t, status: 'Failed' as const, rejectionReason: reason } : t);
      try { localStorage.setItem('hybrid_payment_transactions', JSON.stringify(updated)); } catch (e) {}
      return updated;
    });
  };

  // Helper for computing duplicate scraped & pending jobs
  const computeScrapedDuplicates = (jobList: Job[]) => {
    const keyMap = new Map<string, Job[]>();
    jobList.forEach(job => {
      if (!job || !job.title) return;
      const normalizedTitle = job.title.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
      const normalizedCompany = (job.company || job.govtDepartment || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();
      const key = `${normalizedTitle}_${normalizedCompany}`;
      if (!keyMap.has(key)) {
        keyMap.set(key, []);
      }
      keyMap.get(key)!.push(job);
    });

    const duplicateJobIds: string[] = [];
    const uniqueJobs: Job[] = [];

    keyMap.forEach((group) => {
      if (group.length > 0) {
        uniqueJobs.push(group[0]); // Keep the first as unique
        if (group.length > 1) {
          group.slice(1).forEach(dup => duplicateJobIds.push(dup.id));
        }
      }
    });

    return {
      duplicateCount: duplicateJobIds.length,
      duplicateIds: duplicateJobIds,
      uniqueCount: uniqueJobs.length,
      uniqueJobs
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

    if (confirm(`Instantly approve and publish all ${uniqueCount} verified unique scraped jobs directly to the Live Job Board? (کیا آپ تمام ${uniqueCount} یونیک جابز کو فوری لائیو کرنا چاہتے ہیں؟)`)) {
      const uniqueIds = uniqueJobs.map(j => j.id);
      if (onBulkApprovePendingJobs) {
        onBulkApprovePendingJobs(uniqueIds);
      } else {
        uniqueIds.forEach(id => onApproveJob(id));
      }
      alert(`Successfully published ${uniqueCount} unique jobs directly to Live Job Board! (تمام جابز لائیو ہوگئیں)`);
    }
  };

  // Snapshot restore and bulk jobs ingestion handlers
  const handleRestoreSnapshot = (snapshot: SystemSnapshotPayload) => {
    if (snapshot.jobs && Array.isArray(snapshot.jobs)) {
      snapshot.jobs.forEach((j) => onAddJob(j));
    }
    if (snapshot.customFormFields) {
      snapshot.customFormFields.forEach((f) => onAddCustomField(f));
    }
    alert('System state restored successfully from Snapshot!');
  };

  const handleImportBulkJobs = (importedJobs: Job[]) => {
    importedJobs.forEach((j) => onAddJob(j));
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
    return INITIAL_SCRAPED_AUDIT_LOGS;
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
    return INITIAL_SCRAPER_BATCH_RUNS;
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

  // Global Search State
  const [searchJobQuery, setSearchJobQuery] = useState('');

  // 1. LIVE JOBS TAB SPECIFIC SEARCH, FILTERS, SELECTION & MODALS
  const [jobsSearchQuery, setJobsSearchQuery] = useState('');
  const [jobsCategoryFilter, setJobsCategoryFilter] = useState('all');
  const [jobsScaleFilter, setJobsScaleFilter] = useState('all');
  const [jobsProvinceFilter, setJobsProvinceFilter] = useState('all');
  const [jobsStatusFilter, setJobsStatusFilter] = useState('all');
  const [jobsSortBy, setJobsSortBy] = useState<'newest' | 'oldest' | 'title' | 'salary'>('newest');
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
  const [pendingSortBy, setPendingSortBy] = useState<'newest' | 'oldest' | 'title'>('newest');
  const [selectedPendingIds, setSelectedPendingIds] = useState<string[]>([]);
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
    deduplicationEnabled: true
  });

  // Fetch initial feature flags from backend API
  useEffect(() => {
    fetch('/api/admin/feature-flags')
      .then(res => res.json())
      .then(data => {
        if (data && typeof data === 'object') {
          setFeatureFlags(prev => ({ ...prev, ...data }));
        }
      })
      .catch(err => console.log('Feature flags load fallback to default local state', err));
  }, []);

  // Toggle Feature Flag Handler
  const handleToggleFeature = async (flagKey: keyof AdminFeatureFlags) => {
    const updated = {
      ...featureFlags,
      [flagKey]: !featureFlags[flagKey]
    };
    setFeatureFlags(updated);

    try {
      await fetch('/api/admin/feature-flags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
    } catch (e) {
      console.error('Failed to sync feature flags to backend API', e);
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
  const [scraperSubTab, setScraperSubTab] = useState<'targets' | 'pdf-sources' | 'history' | 'add' | 'inspect-feed' | 'logs'>('targets');
  const [scrapedSourceFilter, setScrapedSourceFilter] = useState<string>('all');
  const [scrapedSearchQuery, setScrapedSearchQuery] = useState<string>('');
  const [expandedSourceId, setExpandedSourceId] = useState<string | null>('sc-1');

  const [isScraping, setIsScraping] = useState(false);
  const [scrapeProgress, setScrapeProgress] = useState(0);
  const [scraperLogs, setScraperLogs] = useState<string[]>([
    '[2026-08-11 12:30:00] Scheduler triggered: Rozee.pk Pakistan Tech Jobs. Harvested 4 jobs (Sent to Pending Approval Queue).',
    '[2026-08-11 08:00:00] Scheduler triggered: FPSC & PPSC Federal Govt Jobs. Harvested 3 jobs (Auto-Approved to Live Board).',
    '[2026-08-11 06:00:00] Scheduler triggered: LinkedIn Global Remote Developer Feed. Harvested 6 jobs (Auto-Approved to Live Board).',
    '[2026-08-10 20:15:00] Scheduler triggered: Daily Jang Newspaper Classified Ads. Extracted 2 newspaper clippings.'
  ]);

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

    const generatedJobs = generateScrapedJobsForPortal(portal);
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
      extractedVacancies: generatedJobs
    };

    handleAddPdfGazette(newGazette, true);
  };

  // Bulk Parallel Crawl across multiple portals with distributed crash safety
  const handleScrapeMultiplePortals = (targetPortals: OfficialGovtPdfPortal[]) => {
    if (targetPortals.length === 0) {
      alert('No portals match your current filter criteria.');
      return;
    }

    setIsBulkCrawlingPortals(true);
    setBulkCrawlProgress(10);

    const now = new Date();
    const timestamp = now.toISOString().replace('T', ' ').substring(0, 19);
    const batchId = 'BATCH-DISTRIB-' + Date.now().toString(36);

    const progressTimer = setInterval(() => {
      setBulkCrawlProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressTimer);
          return 90;
        }
        return prev + 25;
      });
    }, 400);

    setTimeout(() => {
      clearInterval(progressTimer);
      setIsBulkCrawlingPortals(false);
      setBulkCrawlProgress(100);

      const allJobs: Job[] = [];
      const newBatches: ScraperBatchRun[] = [];

      targetPortals.forEach((portal) => {
        const portalJobs = generateScrapedJobsForPortal(portal);
        allJobs.push(...portalJobs);

        // Add to batch runs
        const newBatch: ScraperBatchRun = {
          batchId: `${batchId}-${portal.id}`,
          startTime: timestamp,
          endTime: timestamp,
          sourceId: portal.id,
          sourceName: `${portal.name} (${portal.formatType})`,
          sourceUrl: portal.portalUrl,
          region: 'Pakistan',
          category: 'Government Sector',
          status: 'Completed',
          totalExtracted: portalJobs.length,
          approvedCount: 0,
          pendingCount: portalJobs.length,
          duplicatesSkipped: 0,
          rejectionCount: 0,
          executionDurationMs: 1400,
          httpStatusCode: 200,
          triggerType: 'Batch Rescrape',
          logTrace: [
            `[${timestamp}] Parsed using ${portal.crawlerMethod}`,
            `[${timestamp}] Harvested ${portalJobs.length} vacancies with BPS scales and quotas`
          ]
        };
        newBatches.push(newBatch);
      });

      // Efficient single-batch update for jobs to prevent cascading re-renders and quota overflows
      if (onBulkAddPendingJobs) {
        onBulkAddPendingJobs(allJobs);
      } else if (onBulkAddJobs) {
        onBulkAddJobs(allJobs);
      } else {
        allJobs.forEach(j => onAddJob(j));
      }

      setScraperBatchRuns(prev => [...newBatches.slice(0, 20), ...prev].slice(0, 30));

      setScraperLogs(prev => [
        `[${timestamp}] Distributed Crawler finished across ${targetPortals.length} portals. Total ${allJobs.length} vacancies ingested to Pending Review.`,
        ...prev.slice(0, 30)
      ]);

      alert(`✅ Distributed Scraper Finished!\nSuccessfully crawled ${targetPortals.length} portals in parallel using format-specific engines (pdfplumber, BeautifulSoup, REST endpoints).\nTotal ${allJobs.length} vacancies harvested and added to Pending Review.`);
    }, 2200);
  };

  // Handle batch adding unique portals with duplicate protection
  const handleBatchAddPortals = (newPortals: OfficialGovtPdfPortal[], scrapeImmediately: boolean) => {
    const now = new Date();
    const timestamp = now.toISOString().replace('T', ' ').substring(0, 19);

    newPortals.forEach((portal, idx) => {
      const generatedJobs = generateScrapedJobsForPortal(portal);
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
        extractedVacancies: generatedJobs
      };

      setPdfGazettes(prev => [newGazette, ...prev]);

      if (scrapeImmediately) {
        const batchRun: ScraperBatchRun = {
          batchId: `BATCH-INGEST-${Date.now().toString(36)}-${idx}`,
          startTime: timestamp,
          endTime: timestamp,
          sourceId: portal.id,
          sourceName: `${portal.name} (${portal.formatType})`,
          sourceUrl: portal.portalUrl,
          region: (portal.jurisdiction === 'Federal' ? 'Islamabad' : portal.jurisdiction) as any,
          category: portal.category || 'Government Sector',
          status: 'Completed',
          totalExtracted: generatedJobs.length,
          approvedCount: 0,
          pendingCount: generatedJobs.length,
          duplicatesSkipped: 0,
          rejectionCount: 0,
          executionDurationMs: 1200,
          httpStatusCode: 200,
          triggerType: 'Batch Rescrape',
          logTrace: [
            `[${timestamp}] Batch Ingest Deduplicator approved unique link: ${portal.portalUrl}`,
            `[${timestamp}] Configured with crawler: ${portal.crawlerMethod}`,
            `[${timestamp}] Harvested ${generatedJobs.length} vacancies with BPS scales and quotas`
          ]
        };
        setScraperBatchRuns(prev => [batchRun, ...prev]);
      }
    });

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

  const handleBulkRunSelectedScraperTargets = () => {
    if (selectedScraperTargetIds.length === 0) return;
    const count = selectedScraperTargetIds.length;
    setIsScraping(true);
    setScrapeProgress(10);

    const intervalTimer = setInterval(() => {
      setScrapeProgress((prev) => {
        if (prev >= 90) {
          clearInterval(intervalTimer);
          return 90;
        }
        return prev + 20;
      });
    }, 400);

    setTimeout(() => {
      clearInterval(intervalTimer);
      setIsScraping(false);
      setScrapeProgress(100);

      const now = new Date();
      const timestamp = now.toISOString().replace('T', ' ').substring(0, 19);

      setScraperSources(prev => prev.map(s => {
        if (selectedScraperTargetIds.includes(s.id)) {
          return {
            ...s,
            lastRun: timestamp.substring(0, 16),
            scrapedCount: s.scrapedCount + 2
          };
        }
        return s;
      }));

      const newJobsToAdd: Job[] = [];
      const newBatchesToAdd: ScraperBatchRun[] = [];

      // Generate batch runs and jobs
      selectedScraperTargetIds.forEach((sourceId, idx) => {
        const source = scraperSources.find(s => s.id === sourceId);
        if (!source) return;
        const batchId = 'BATCH-BULK-' + Date.now().toString(36) + '-' + idx;
        const job1: Job = {
          id: `job-bulk-${source.id}-${Date.now().toString(36)}-${idx}`,
          title: `Senior Officer (${source.keywords.split(',')[0]?.trim() || 'Operations'})`,
          company: `${source.name.split(' ')[0]} Enterprise`,
          jobType: source.category === 'International Remote' ? 'Remote' : 'Hybrid',
          region: source.region,
          salary: source.region === 'Pakistan' ? 'PKR 180,000 - PKR 260,000 / month' : '$3,500 - $5,000 / month',
          currency: source.region === 'Pakistan' ? 'PKR' : 'USD',
          experienceLevel: 'Senior',
          department: 'Executive Operations',
          tags: [source.category, source.region, 'Full Time', 'Bulk Scraped'],
          description: `Extracted via bulk scraper execution from ${source.url}.\nKey requirements include domain leadership, team management, and operations reporting.`,
          requirements: ['3+ years domain experience', 'Strong communication skills', 'Bachelor\'s degree in relevant discipline'],
          benefits: ['Health coverage', 'Performance bonus'],
          postedAt: 'Just now',
          applicationsCount: 0,
          status: source.autoApprove ? 'Approved' : 'Pending',
          sourceUrl: source.url,
          scraperSourceId: source.id,
          scraperSourceName: source.name,
          scrapedSourceDomain: source.url.replace('https://', '').replace('http://', '').split('/')[0],
          scrapedAt: timestamp,
          jobCategory: source.category,
          isGovtJob: source.category === 'Government Sector',
          govtScale: source.category === 'Government Sector' ? 'BPS-17' : undefined,
          isNewspaperAd: source.category === 'Newspaper Classified'
        };
        newJobsToAdd.push(job1);

        const newBatch: ScraperBatchRun = {
          batchId,
          startTime: timestamp,
          endTime: timestamp,
          sourceId: source.id,
          sourceName: source.name,
          sourceUrl: source.url,
          region: source.region,
          category: source.category,
          status: 'Completed',
          totalExtracted: 1,
          approvedCount: source.autoApprove ? 1 : 0,
          pendingCount: source.autoApprove ? 0 : 1,
          duplicatesSkipped: 0,
          rejectionCount: 0,
          executionDurationMs: 1800,
          httpStatusCode: 200,
          triggerType: 'Batch Rescrape',
          logTrace: [`[${timestamp}] Bulk multi-source crawl finished for ${source.name}`]
        };
        newBatchesToAdd.push(newBatch);
      });

      if (onBulkAddJobs) {
        onBulkAddJobs(newJobsToAdd);
      } else {
        newJobsToAdd.forEach(j => onAddJob(j));
      }

      setScraperBatchRuns(prev => [...newBatchesToAdd, ...prev].slice(0, 30));

      alert(`Successfully executed bulk crawl across ${count} selected scraper sources! New jobs added to database.`);
    }, 2000);
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

  // Scraper Simulation Handler
  // Scraper Manual / Scheduled Execution Handler
  const handleRunScraper = (specificSourceId?: string) => {
    const source = specificSourceId ? (scraperSources || []).find(s => s && s.id === specificSourceId) : null;
    const targetUrl = source ? source.url : scraperUrl;
    const targetKeyword = source ? source.keywords : scraperKeyword;
    const shouldAutoApprove = source ? source.autoApprove : scraperAutoApprove;

    if (!targetUrl && !targetKeyword) {
      alert('Please enter a target URL or Keyword to scrape.');
      return;
    }

    setIsScraping(true);
    setScrapeProgress(15);

    const interval = setInterval(() => {
      setScrapeProgress((prev) => {
        if (prev >= 90) {
          clearInterval(interval);
          return 90;
        }
        return prev + 25;
      });
    }, 500);

    setTimeout(() => {
      clearInterval(interval);
      setIsScraping(false);
      setScrapeProgress(100);

      const jobStatus = shouldAutoApprove ? 'Approved' : 'Pending';
      const now = new Date();
      const timestamp = now.toISOString().replace('T', ' ').substring(0, 19);
      const timeFormatted = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });

      let domainName = 'target-portal.com';
      try {
        if (targetUrl) {
          domainName = new URL(targetUrl.startsWith('http') ? targetUrl : 'https://' + targetUrl).hostname;
        }
      } catch (e) {
        domainName = targetUrl || 'target-portal.com';
      }

      const isGovt = (source && source.category === 'Government Sector') || (targetUrl && targetUrl.includes('gov')) || targetKeyword.toLowerCase().includes('bps');
      const isNews = (source && source.category === 'Newspaper Classified') || (targetUrl && targetUrl.includes('jang'));
      const isRemote = (source && source.category === 'International Remote') || targetKeyword.toLowerCase().includes('remote');

      const catType = isGovt ? 'Government Sector' : isNews ? 'Newspaper Classified' : isRemote ? 'International Remote' : 'Private Corporate';

      // Job 1 Auto-Judged as Remote / High Scale
      const mockScraped1: Job = {
        id: 'job-scraped-' + Date.now() + '-1',
        title: `${targetKeyword.split(',')[0]?.trim() || 'Senior Full Stack Engineer'}`,
        company: source ? `${source.name.split(' ')[0]} Technologies` : 'Global Software Solutions',
        jobType: isRemote ? 'Remote' : 'Hybrid',
        region: isRemote ? 'Global' : 'Pakistan',
        province: isRemote ? undefined : 'Sindh',
        city: isRemote ? undefined : 'Karachi',
        district: isRemote ? undefined : 'Clifton',
        salary: isRemote ? '$4,500 - $7,000 / month' : 'PKR 280,000 - PKR 420,000 / month',
        currency: isRemote ? 'USD' : 'PKR',
        experienceLevel: 'Senior',
        department: isGovt ? 'Information Technology Directorate' : 'Engineering',
        tags: [catType, isRemote ? 'Remote' : 'Hybrid', 'React', 'Node.js', 'Full Time'],
        description: `About the Organization:\nA premier high-growth organization seeking high-caliber professionals to lead key initiatives.\n\nCore Responsibilities:\n• Architect, develop, and maintain mission-critical modules and microservices.\n• Collaborate with cross-functional teams to design scalable domain architectures.\n• Perform automated testing, security audits, and code optimization.\n• Mentor junior team members and conduct rigorous peer code reviews.\n• Ensure 99.9% uptime and high performance across distributed platforms.`,
        requirements: [
          '5+ years of production experience in software engineering',
          'Proficiency with modern frameworks (React, Node.js, TypeScript, PostgreSQL)',
          'Solid understanding of cloud architecture and CI/CD deployment pipelines',
          'Excellent problem-solving and analytical communication skills'
        ],
        benefits: [
          'Competitive market-leading compensation package',
          'Comprehensive health insurance (employee + dependents)',
          'Provident fund / annual performance bonuses',
          'Flexible remote work arrangements and continuous learning stipend'
        ],
        postedAt: 'Just now',
        applicationsCount: 0,
        status: jobStatus,
        sourceUrl: targetUrl,
        scraperSourceId: source?.id,
        scraperSourceName: source?.name,
        scrapedSourceDomain: domainName,
        scrapedAt: timestamp,
        scrapedTime: timeFormatted,
        jobCategory: catType,
        isGovtJob: isGovt,
        govtScale: isGovt ? 'BPS-17' : undefined,
        govtDepartment: isGovt ? 'Ministry of Science & Technology' : undefined,
        isNewspaperAd: isNews,
        newspaperName: isNews ? 'Daily Jang' : undefined,
        clippingImageUrl: isNews ? 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=800&auto=format&fit=crop&q=60' : undefined
      };

      // Job 2 Auto-Judged as Regional Hub
      const mockScraped2: Job = {
        id: 'job-scraped-' + Date.now() + '-2',
        title: `Lead ${targetKeyword.split(',')[1]?.trim() || 'Software Architect'} - Lahore Hub`,
        company: source ? `${source.name.split(' ')[0]} Enterprise` : 'Systems Tech Pakistan',
        jobType: 'Hybrid',
        region: 'Pakistan',
        province: 'Punjab',
        city: 'Lahore',
        district: 'Gulberg',
        salary: 'PKR 350,000 - PKR 500,000 / month',
        currency: 'PKR',
        experienceLevel: 'Lead',
        department: 'Enterprise Systems',
        tags: ['Pakistan', 'Lahore', 'Punjab', catType, 'Full Time'],
        description: `Role Summary:\nSeeking an experienced technical leader based in Lahore to oversee core development workflows.\n\nKey Responsibilities:\n• Lead technical roadmap and architecture reviews for enterprise software products.\n• Drive agile sprint ceremonies and establish development best practices.\n• Optimize SQL and NoSQL queries for massive-scale throughput.\n• Spearhead security reviews and compliance certifications.`,
        requirements: [
          '6+ years experience in enterprise full-stack development',
          'Strong command of distributed systems, REST/gRPC APIs, and cloud services',
          'Bachelor\'s or Master\'s degree in Computer Science or related field'
        ],
        benefits: [
          'Executive health coverage and family OPD allowances',
          'Company vehicle / fuel allowance according to policy',
          'Annual performance profit-sharing bonus'
        ],
        postedAt: 'Just now',
        applicationsCount: 0,
        status: jobStatus,
        sourceUrl: targetUrl,
        scraperSourceId: source?.id,
        scraperSourceName: source?.name,
        scrapedSourceDomain: domainName,
        scrapedAt: timestamp,
        scrapedTime: timeFormatted,
        jobCategory: catType,
        isGovtJob: isGovt,
        govtScale: isGovt ? 'BPS-18' : undefined,
        govtDepartment: isGovt ? 'National Information Technology Board' : undefined,
        isNewspaperAd: isNews,
        newspaperName: isNews ? 'Daily Dawn' : undefined,
        clippingImageUrl: isNews ? 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=800&auto=format&fit=crop&q=60' : undefined
      };

      onAddJob(mockScraped1);
      onAddJob(mockScraped2);

      // Create Scraper Batch Run Record
      const batchId = 'BATCH-' + now.toISOString().substring(0, 10).replace(/-/g, '') + '-' + now.toTimeString().substring(0, 5).replace(/:/g, '') + '-' + Math.floor(Math.random() * 900 + 100);
      const newBatchRun: ScraperBatchRun = {
        batchId,
        startTime: timestamp,
        endTime: new Date(Date.now() + 2500).toISOString().replace('T', ' ').substring(0, 19),
        sourceId: source ? source.id : 'sc-custom',
        sourceName: source ? source.name : `On-Demand Scrape (${domainName})`,
        sourceUrl: targetUrl || 'https://' + domainName,
        region: (source?.region || (isRemote ? 'Global' : 'Pakistan')) as Region,
        category: catType,
        status: 'Completed',
        totalExtracted: 2,
        approvedCount: shouldAutoApprove ? 2 : 0,
        pendingCount: shouldAutoApprove ? 0 : 2,
        duplicatesSkipped: 1,
        rejectionCount: 0,
        executionDurationMs: 2500,
        httpStatusCode: 200,
        triggerType: specificSourceId ? 'Manual On-Demand' : 'Scheduled Cron',
        logTrace: [
          `[${timestamp}] [Ingestion Start] Target host: ${domainName} (${targetUrl})`,
          `[${timestamp}] [Keyword Filter] Parsing query terms: "${targetKeyword}"`,
          `[${timestamp}] [Deduplication Engine] Content uniqueness scored at 98.4% (1 duplicate filtered)`,
          `[${timestamp}] [Classifier] Assigned Sector: "${catType}", Region: "${isRemote ? 'Global' : 'Pakistan'}"`,
          `[${timestamp}] [Rule Engine] ${shouldAutoApprove ? 'Auto-Approve policy active: Direct published to live board.' : 'Queued into Admin Pending Review table.'}`
        ]
      };
      setScraperBatchRuns(prev => [newBatchRun, ...prev]);

      // Create Audit Log Entries for Both Scraped Jobs
      const audit1: ScrapedJobAuditEntry = {
        id: `audit-${mockScraped1.id}-${Date.now().toString(36)}-1-${Math.random().toString(36).substring(2, 6)}`,
        jobId: mockScraped1.id,
        batchId,
        jobTitle: mockScraped1.title,
        company: mockScraped1.company,
        scrapedAt: timestamp,
        scrapedTimezone: 'PKT (UTC+5)',
        sourcePortalName: source ? source.name : domainName,
        sourceUrl: targetUrl || 'https://' + domainName,
        sourceDomain: domainName,
        category: catType,
        region: (isRemote ? 'Global' : 'Pakistan') as Region,
        country: isRemote ? 'United States' : 'Pakistan',
        city: mockScraped1.city,
        currency: mockScraped1.currency || (isRemote ? 'USD' : 'PKR'),
        salaryText: mockScraped1.salary,
        status: shouldAutoApprove ? 'Auto-Approved' : 'Pending Review',
        deduplicationScore: 98.5,
        crawlLatencyMs: 310,
        extractedTags: mockScraped1.tags || [],
        requirementsCount: mockScraped1.requirements?.length || 0,
        isGovtJob: isGovt,
        govtScale: isGovt ? 'BPS-17' : undefined,
        govtDepartment: isGovt ? 'Ministry of Science & Technology' : undefined,
        isNewspaperAd: isNews,
        newspaperName: isNews ? 'Daily Jang' : undefined,
        clippingImageUrl: isNews ? mockScraped1.clippingImageUrl : undefined,
        reviewTimeline: [
          {
            id: 'act-' + Date.now() + '-1',
            timestamp,
            relativeTime: 'Just now',
            action: 'Scraped',
            performedBy: 'Cron Scraper Engine',
            notes: `Extracted from ${domainName} during batch run ${batchId}.`
          },
          shouldAutoApprove ? {
            id: 'act-' + Date.now() + '-2',
            timestamp,
            relativeTime: 'Just now',
            action: 'Auto-Approved',
            performedBy: 'Cron Scraper Engine',
            notes: 'Feed autoApprove rule is enabled. Published live to portal.'
          } : {
            id: 'act-' + Date.now() + '-2',
            timestamp,
            relativeTime: 'Just now',
            action: 'Re-queued',
            performedBy: 'System Deduplicator',
            notes: 'AutoApprove is disabled for this feed. Routed to Admin Pending Queue.'
          }
        ],
        snapshot: {
          description: mockScraped1.description,
          requirements: mockScraped1.requirements,
          benefits: mockScraped1.benefits,
          applyUrl: mockScraped1.sourceUrl
        }
      };

      const audit2: ScrapedJobAuditEntry = {
        id: `audit-${mockScraped2.id}-${Date.now().toString(36)}-2-${Math.random().toString(36).substring(2, 6)}`,
        jobId: mockScraped2.id,
        batchId,
        jobTitle: mockScraped2.title,
        company: mockScraped2.company,
        scrapedAt: timestamp,
        scrapedTimezone: 'PKT (UTC+5)',
        sourcePortalName: source ? source.name : domainName,
        sourceUrl: targetUrl || 'https://' + domainName,
        sourceDomain: domainName,
        category: catType,
        region: 'Pakistan',
        country: 'Pakistan',
        city: 'Lahore',
        currency: 'PKR',
        salaryText: mockScraped2.salary,
        status: shouldAutoApprove ? 'Auto-Approved' : 'Pending Review',
        deduplicationScore: 97.9,
        crawlLatencyMs: 380,
        extractedTags: mockScraped2.tags || [],
        requirementsCount: mockScraped2.requirements?.length || 0,
        isGovtJob: isGovt,
        govtScale: isGovt ? 'BPS-18' : undefined,
        govtDepartment: isGovt ? 'National Information Technology Board' : undefined,
        isNewspaperAd: isNews,
        newspaperName: isNews ? 'Daily Dawn' : undefined,
        clippingImageUrl: isNews ? mockScraped2.clippingImageUrl : undefined,
        reviewTimeline: [
          {
            id: 'act-' + Date.now() + '-3',
            timestamp,
            relativeTime: 'Just now',
            action: 'Scraped',
            performedBy: 'Cron Scraper Engine',
            notes: `Extracted from ${domainName} during batch run ${batchId}.`
          },
          shouldAutoApprove ? {
            id: 'act-' + Date.now() + '-4',
            timestamp,
            relativeTime: 'Just now',
            action: 'Auto-Approved',
            performedBy: 'Cron Scraper Engine',
            notes: 'Feed autoApprove rule is enabled. Published live to portal.'
          } : {
            id: 'act-' + Date.now() + '-4',
            timestamp,
            relativeTime: 'Just now',
            action: 'Re-queued',
            performedBy: 'System Deduplicator',
            notes: 'AutoApprove is disabled for this feed. Routed to Admin Pending Queue.'
          }
        ],
        snapshot: {
          description: mockScraped2.description,
          requirements: mockScraped2.requirements,
          benefits: mockScraped2.benefits,
          applyUrl: mockScraped2.sourceUrl
        }
      };

      setScrapedAuditLogs(prev => [audit1, audit2, ...prev]);

      // Update scraper sources statistics
      if (source) {
        setScraperSources(prev => prev.map(s => s.id === source.id ? {
          ...s,
          lastRun: timestamp.substring(0, 16),
          scrapedCount: s.scrapedCount + 2
        } : s));
        setExpandedSourceId(source.id);
      }

      const logMsg = `[${timestamp}] ${source ? source.name : 'Custom Scraper'}: Successfully scraped 2 jobs from ${targetUrl} (${jobStatus === 'Approved' ? 'Auto-Approved to Live Listings' : 'Sent to Pending Queue'}).`;
      setScraperLogs(prev => [logMsg, ...prev]);

      if (shouldAutoApprove) {
        alert(`Scraper execution complete! 2 jobs were automatically judged, approved, and posted directly to live listings.`);
      } else {
        alert(`Scraper execution complete! 2 jobs were extracted and placed under this target portal for admin review.`);
      }
    }, 2500);
  };

  // Synchronized Approval with Audit Trail & Auto SEO Injection
  const handleAdminApproveJob = (jobId: string) => {
    onApproveJob(jobId);
    
    // Auto-generate Google Search SEO & inject Schema.org structured data
    const approvedJob = pendingJobs.find(j => j.id === jobId) || jobs.find(j => j.id === jobId);
    if (approvedJob) {
      injectJobJsonLd(approvedJob);
    }

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
  const handleCreateCustomField = (e: React.FormEvent) => {
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

    onAddCustomField(newField);
    setFieldLabel('');
    setFieldOptions('');
    setFieldRequired(false);
    alert(`Custom field "${newField.label}" added to User Registration Form!`);
  };

  // Manual Job Creation
  const handleCreateJob = (e: React.FormEvent) => {
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

    onAddJob(createdJob);
    alert(`Job "${title}" published directly to Live Portal!`);
    setTitle('');
    setCompany('');
    setDescription('');
    setAdminTab('jobs');
  };

  const handleAdminSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChatUserId || !adminReplyText.trim()) return;

    const targetUser = (users || []).find((u) => u && u.id === selectedChatUserId);
    const userName = targetUser ? targetUser.name : 'User';

    onSendMessageToUser(selectedChatUserId, userName, adminReplyText.trim());
    setAdminReplyText('');
  };

  // Selected User Chat Messages
  const selectedUserMessages = chatMessages.filter((m) => m.userId === selectedChatUserId);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-amber-950 via-slate-900 to-amber-950 border border-amber-500/40 rounded-3xl p-6 text-white shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-amber-500/20 text-amber-400 rounded-2xl flex items-center justify-center border border-amber-500/30">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-2xl font-black">Portal Secret Control Hub</h2>
              <span className="bg-amber-500 text-slate-950 text-[10px] uppercase font-bold px-2 py-0.5 rounded">
                Admin Authorized
              </span>
            </div>
            <p className="text-xs text-slate-400">Manage approvals, per-job posting fees, user audits, and custom registration forms</p>
          </div>
        </div>

        <button
          onClick={onExitAdmin}
          className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/30 font-bold text-xs flex items-center space-x-1.5 transition-all cursor-pointer"
        >
          <X className="w-4 h-4" />
          <span>Exit Admin Panel</span>
        </button>
      </div>

      {/* MODERN ADMIN NAVIGATION: CATEGORIES + 3-DOT ALL MODULES + SUB-TABS */}
      <div className="space-y-3 border-b border-slate-800 pb-4">
        {/* Top Level Category Bar with 3-Dot Quick Menu */}
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {[
              { id: 'jobs' as AdminCategory, label: '💼 Jobs & Posts', urdu: 'ملازمتیں', count: pendingJobs.length > 0 ? `${pendingJobs.length} Pending` : undefined, countColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
              { id: 'scraper' as AdminCategory, label: '🤖 Web Scrapers', urdu: 'سکریپرز', count: 'URL Tool', countColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' },
              { id: 'ads' as AdminCategory, label: '📢 Ads & Campaigns', urdu: 'اشتہارات', count: `${ads.filter(a => a.status === 'active').length} Live`, countColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
              { id: 'payments' as AdminCategory, label: '💳 Payments & Accounts', urdu: 'ادائیگیاں', count: currentTransactions.filter(t => t.status === 'Pending').length > 0 ? `${currentTransactions.filter(t => t.status === 'Pending').length} Proofs` : undefined, countColor: 'bg-teal-500/20 text-teal-300 border-teal-500/30' },
              { id: 'users' as AdminCategory, label: '👥 Users & KYC', urdu: 'صارفین', count: kycRequests.filter(r => r.status === 'Pending').length > 0 ? `${kycRequests.filter(r => r.status === 'Pending').length} KYC` : undefined, countColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
              { id: 'alerts' as AdminCategory, label: '📣 Alerts & WhatsApp', urdu: 'الرٹس', count: undefined },
              { id: 'settings' as AdminCategory, label: '⚙️ Settings & SEO', urdu: 'ترتیبات', count: undefined }
            ].map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  setActiveCategory(cat.id);
                  // Auto-switch to first sub-tab of that category if current tab is outside
                  if (cat.id === 'jobs' && !['jobs', 'pending', 'add-job', 'ai-enhancer'].includes(adminTab)) setAdminTab('jobs');
                  if (cat.id === 'scraper' && !['url-scraper', 'scraper', 'scraped-history'].includes(adminTab)) setAdminTab('url-scraper');
                  if (cat.id === 'ads' && !['campaign-center', 'advertisements', 'landing-customizer'].includes(adminTab)) setAdminTab('campaign-center');
                  if (cat.id === 'payments' && !['admin-payment-methods', 'payment-proofs', 'fee-management', 'fee-logs', 'currency-forex'].includes(adminTab)) setAdminTab('admin-payment-methods');
                  if (cat.id === 'users' && !['user-audit', 'employer-kyc', 'subscribers', 'chat-hub'].includes(adminTab)) setAdminTab('user-audit');
                  if (cat.id === 'alerts' && !['whatsapp-manager', 'broadcast-center', 'bulk-notifications'].includes(adminTab)) setAdminTab('whatsapp-manager');
                  if (cat.id === 'settings' && !['seo-config', 'settings', 'form-customizer', 'activity-logs', 'data-backup', 'analytics'].includes(adminTab)) setAdminTab('seo-config');
                }}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer select-none ${
                  activeCategory === cat.id
                    ? 'bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20 scale-[1.02]'
                    : 'bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800/80 border border-slate-800'
                }`}
              >
                <span>{cat.label}</span>
                {cat.count && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-bold border ${activeCategory === cat.id ? 'bg-slate-950 text-amber-400 border-slate-900' : cat.countColor}`}>
                    {cat.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* 3-DOT QUICK MENU TRIGGER BUTTON */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowAllModulesMenu(true)}
              className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-400 border border-amber-500/40 text-xs font-black flex items-center space-x-1.5 shadow-lg shadow-amber-500/10 transition-all cursor-pointer active:scale-95"
              title="Open full modules matrix with search"
            >
              <MoreVertical className="w-4 h-4 text-amber-400" />
              <span>⋮ All Modules (تمام ماڈیولز)</span>
            </button>
          </div>
        </div>

        {/* ACTIVE CATEGORY SUB-TABS ROW */}
        <div className="flex items-center space-x-2 overflow-x-auto py-1.5 px-2 bg-slate-950/70 border border-slate-800/80 rounded-xl scrollbar-none text-xs">
          <span className="text-[11px] uppercase tracking-wider font-bold text-slate-500 shrink-0 pl-1">
            Sub-Modules:
          </span>

          {activeCategory === 'jobs' && (
            <>
              {[
                { id: 'jobs', label: `Live Listings (${jobs.length})`, urdu: 'لائیو جابز', icon: Briefcase },
                { id: 'pending', label: `Pending Approvals (${pendingJobs.length})`, urdu: 'زیرِ التواء منظوری', icon: Clock, badge: pendingJobs.length > 0 ? pendingJobs.length : undefined },
                { id: 'add-job', label: 'Post Manual Job', urdu: 'نئی جاب', icon: Plus },
                { id: 'ai-enhancer', label: 'AI Quality & Spam Filter', urdu: 'کوالٹی فلٹر', icon: Sparkles }
              ].map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setAdminTab(t.id as any)}
                    className={`px-3 py-1.5 rounded-lg font-bold flex items-center space-x-1.5 transition-all whitespace-nowrap cursor-pointer ${
                      adminTab === t.id
                        ? 'bg-gradient-to-r from-amber-500 to-emerald-500 text-slate-950 font-black shadow-md'
                        : 'bg-slate-900 text-slate-300 hover:text-white border border-slate-800'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{t.label}</span>
                    {t.badge && (
                      <span className="px-1.5 py-0.2 rounded bg-amber-500 text-slate-950 text-[10px] font-black">
                        {t.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </>
          )}

          {activeCategory === 'scraper' && (
            <>
              {[
                { id: 'url-scraper', label: '🔗 Instant URL Scraper & Bulk Actions', urdu: 'براہِ راست لنک سے سکریپ', icon: Globe, isNew: true },
                { id: 'scraper', label: 'Automated Scraper Controller', urdu: 'خودکار پورٹلز', icon: Bot },
                { id: 'scraped-history', label: `Ingested Feed & Audit (${scrapedAuditLogs.length})`, urdu: 'حاصل شدہ فیڈ', icon: History }
              ].map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setAdminTab(t.id as any)}
                    className={`px-3 py-1.5 rounded-lg font-bold flex items-center space-x-1.5 transition-all whitespace-nowrap cursor-pointer ${
                      adminTab === t.id
                        ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-black shadow-md'
                        : 'bg-slate-900 text-slate-300 hover:text-white border border-slate-800'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{t.label}</span>
                    {t.isNew && (
                      <span className="px-1.5 py-0.2 rounded bg-emerald-400 text-slate-950 text-[9px] font-black">
                        NEW
                      </span>
                    )}
                  </button>
                );
              })}
            </>
          )}

          {activeCategory === 'ads' && (
            <>
              {[
                { id: 'campaign-center', label: `Campaign Center (${ads.filter(a => a.status === 'active').length} Live)`, urdu: 'اشتہاری کیمپینز', icon: Megaphone },
                { id: 'advertisements', label: 'Ad Hub & Banner Slots', urdu: 'بینر سلاٹس', icon: Layers },
                { id: 'landing-customizer', label: 'Landing Page Customizer', urdu: 'ہوم پیج بینرز', icon: Edit3 }
              ].map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setAdminTab(t.id as any)}
                    className={`px-3 py-1.5 rounded-lg font-bold flex items-center space-x-1.5 transition-all whitespace-nowrap cursor-pointer ${
                      adminTab === t.id
                        ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                        : 'bg-slate-900 text-slate-300 hover:text-white border border-slate-800'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </>
          )}

          {activeCategory === 'payments' && (
            <>
              {[
                { id: 'admin-payment-methods', label: '💳 EasyPaisa, JazzCash & Duration Setup', urdu: 'ایڈمن اکاؤنٹس اور دن', icon: CreditCard, isNew: true },
                { id: 'payment-proofs', label: `Receipt Proofs Verification (${currentTransactions.filter(t => t.status === 'Pending').length})`, urdu: 'رسیدوں کی تصدیق', icon: Receipt },
                { id: 'fee-management', label: 'Category Fees & Pricing', urdu: 'پوسٹنگ فیس', icon: DollarSign },
                { id: 'fee-logs', label: `Per-Job Fee Logs (${jobPostingFeeLogs.length})`, urdu: 'فیس لین دین', icon: Receipt },
                { id: 'currency-forex', label: 'Multi-Currency & Forex', urdu: 'کرنسی ایکسچینج', icon: Coins }
              ].map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setAdminTab(t.id as any)}
                    className={`px-3 py-1.5 rounded-lg font-bold flex items-center space-x-1.5 transition-all whitespace-nowrap cursor-pointer ${
                      adminTab === t.id
                        ? 'bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 font-black shadow-md'
                        : 'bg-slate-900 text-slate-300 hover:text-white border border-slate-800'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{t.label}</span>
                    {t.isNew && (
                      <span className="px-1.5 py-0.2 rounded bg-amber-400 text-slate-950 text-[9px] font-black">
                        NEW
                      </span>
                    )}
                  </button>
                );
              })}
            </>
          )}

          {activeCategory === 'users' && (
            <>
              {[
                { id: 'user-audit', label: `User Directory (${users.length})`, urdu: 'صارفین کی فہرست', icon: Users },
                { id: 'employer-kyc', label: `Employer KYC Verification (${kycRequests.filter(r => r.status === 'Pending').length})`, urdu: 'شناختی تصدیق', icon: BadgeCheck },
                { id: 'subscribers', label: `Paid Subscribers (${subscribers.length})`, urdu: 'سبسکرائبرز', icon: DollarSign },
                { id: 'chat-hub', label: `User Support Chat Hub (${chatMessages.length})`, urdu: 'چیٹ ان باکس', icon: MessageSquare }
              ].map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setAdminTab(t.id as any)}
                    className={`px-3 py-1.5 rounded-lg font-bold flex items-center space-x-1.5 transition-all whitespace-nowrap cursor-pointer ${
                      adminTab === t.id
                        ? 'bg-purple-500 text-white font-black shadow-md'
                        : 'bg-slate-900 text-slate-300 hover:text-white border border-slate-800'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </>
          )}

          {activeCategory === 'alerts' && (
            <>
              {[
                { id: 'whatsapp-manager', label: '💬 WhatsApp Support & Alerts Hub', urdu: 'واٹس ایپ الرٹس', icon: MessageSquare },
                { id: 'broadcast-center', label: '📣 Email & WhatsApp Broadcasts', urdu: 'براڈکاسٹ میسجز', icon: Send },
                { id: 'bulk-notifications', label: '🚀 Pro Bulk Notification Tool', urdu: 'بلک نوٹیفکیشنز', icon: Send }
              ].map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setAdminTab(t.id as any)}
                    className={`px-3 py-1.5 rounded-lg font-bold flex items-center space-x-1.5 transition-all whitespace-nowrap cursor-pointer ${
                      adminTab === t.id
                        ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                        : 'bg-slate-900 text-slate-300 hover:text-white border border-slate-800'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </>
          )}

          {activeCategory === 'settings' && (
            <>
              {[
                { id: 'seo-config', label: '🌐 Google Search SEO & Meta Tags', urdu: 'گوگل ایس ای او', icon: Globe },
                { id: 'settings', label: 'Global Master Switches', urdu: 'ماسٹر سیٹنگز', icon: Settings },
                { id: 'form-customizer', label: 'Registration Form Customizer', urdu: 'فارم سیٹنگز', icon: Edit3 },
                { id: 'activity-logs', label: 'Security & Activity Trail', urdu: 'سیکیورٹی لاگز', icon: ShieldCheck },
                { id: 'data-backup', label: 'Data Vault & CSV Backup', urdu: 'بیک اپ اور ایکسپورٹ', icon: Database },
                { id: 'analytics', label: 'Executive Analytics & KPIs', urdu: 'اینالیٹکس رپورٹس', icon: BarChart3 }
              ].map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setAdminTab(t.id as any)}
                    className={`px-3 py-1.5 rounded-lg font-bold flex items-center space-x-1.5 transition-all whitespace-nowrap cursor-pointer ${
                      adminTab === t.id
                        ? 'bg-indigo-500 text-white font-black shadow-md'
                        : 'bg-slate-900 text-slate-300 hover:text-white border border-slate-800'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </>
          )}
        </div>
      </div>

      {/* 3-DOT ALL MODULES QUICK MODAL OVERLAY */}
      {showAllModulesMenu && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-4xl w-full p-6 shadow-2xl space-y-5 text-white max-h-[90vh] flex flex-col animate-fadeIn">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <MoreVertical className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white flex items-center space-x-2">
                    <span>Admin Control Hub: All Modules (تمام ماڈیولز)</span>
                    <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[10px] font-bold">
                      Quick Switcher
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Filter by module name or purpose to jump instantly without horizontal scrolling.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowAllModulesMenu(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Instant Filter Search Bar */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-500" />
              <input
                type="text"
                value={moduleSearchQuery}
                onChange={(e) => setModuleSearchQuery(e.target.value)}
                placeholder="Search any module by English or Urdu keywords (e.g. 'jazzcash', 'scraper', 'seo', 'fees', 'whatsapp', 'kyc')..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-2xl text-xs text-white placeholder-slate-500 outline-none focus:border-amber-500 shadow-inner"
                autoFocus
              />
            </div>

            {/* Modules Grid */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-5">
              {[
                {
                  catTitle: '💼 Jobs & Vacancies (ملازمتیں اور پوسٹس)',
                  items: [
                    { id: 'jobs', label: 'Live Listings', urdu: 'لائیو نوکریاں', icon: Briefcase, badge: `${jobs.length} Active` },
                    { id: 'pending', label: 'Pending Approvals Queue', urdu: 'منظوری کی منتظر نوکریاں', icon: Clock, badge: `${pendingJobs.length} Pending` },
                    { id: 'add-job', label: 'Post Manual Job', urdu: 'نئی جاب شامل کریں', icon: Plus },
                    { id: 'ai-enhancer', label: 'AI Quality & Spam Guard', urdu: 'کوالٹی اور اسپیم چیکر', icon: Sparkles }
                  ]
                },
                {
                  catTitle: '🤖 Web Scrapers & Gazettes (سکریپرز اور گزٹس)',
                  items: [
                    { id: 'url-scraper', label: 'Instant URL Scraper & Bulk Actions', urdu: 'براہِ راست لنک سے سکریپ اور بلک', icon: Globe, badge: 'NEW' },
                    { id: 'scraper', label: 'Automated Scraper Controller', urdu: 'خودکار ویب سکریپر پورٹلز', icon: Bot },
                    { id: 'scraped-history', label: 'Ingested Jobs Feed & Audit', urdu: 'حاصل کردہ جاب فیڈ', icon: History, badge: `${scrapedAuditLogs.length} Logs` }
                  ]
                },
                {
                  catTitle: '📢 Ads & Campaigns (اشتہارات اور کیمپینز)',
                  items: [
                    { id: 'campaign-center', label: 'Visual Campaign Center', urdu: 'اشتہاری کیمپین کمانڈ سنٹر', icon: Megaphone, badge: `${ads.filter(a => a.status === 'active').length} Live` },
                    { id: 'advertisements', label: 'Ad Hub & Banner Slots', urdu: 'اشتہاری بینر سلاٹس', icon: Layers },
                    { id: 'landing-customizer', label: 'Landing Page Customizer', urdu: 'ہوم پیج بینر ڈیزائنر', icon: Edit3 }
                  ]
                },
                {
                  catTitle: '💳 Payments, Fees & Durations (ادائیگیاں، فیس اور پیکیجز)',
                  items: [
                    { id: 'admin-payment-methods', label: 'EasyPaisa, JazzCash & Durations Setup', urdu: 'ایڈمن کے اکاؤنٹس اور دن (1-دن، 1-ہفتہ، 15-دن، 20-دن)', icon: CreditCard, badge: 'NEW' },
                    { id: 'payment-proofs', label: 'Payment Receipts Verification', urdu: 'رسیدوں کی تصدیق', icon: Receipt, badge: `${currentTransactions.filter(t => t.status === 'Pending').length} Proofs` },
                    { id: 'fee-management', label: 'Category Fees & Pricing', urdu: 'پوسٹنگ فیس اور رعایتیں', icon: DollarSign },
                    { id: 'fee-logs', label: 'Per-Job Fee Transaction Logs', urdu: 'فیس لین دین کا مکمل ریکارڈ', icon: Receipt, badge: `${jobPostingFeeLogs.length} Records` },
                    { id: 'currency-forex', label: 'Multi-Currency & Forex', urdu: 'کرنسی ایکسچینج ریٹس', icon: Coins }
                  ]
                },
                {
                  catTitle: '👥 Users, KYC & Support (صارفین اور تصدیق)',
                  items: [
                    { id: 'user-audit', label: 'User Directory & Profiles', urdu: 'تمام صارفین کی فہرست', icon: Users, badge: `${users.length} Users` },
                    { id: 'employer-kyc', label: 'Employer KYC Verification', urdu: 'کمپنی شناختی تصدیق', icon: BadgeCheck, badge: `${kycRequests.filter(r => r.status === 'Pending').length} KYC` },
                    { id: 'subscribers', label: 'Paid Subscribers', urdu: 'سبسکرائبرز', icon: DollarSign, badge: `${subscribers.length} Members` },
                    { id: 'chat-hub', label: 'User Support Chat Hub', urdu: 'چیٹ سپورٹ ان باکس', icon: MessageSquare, badge: `${chatMessages.length} Chats` }
                  ]
                },
                {
                  catTitle: '📣 Alerts & Broadcasts (الرٹس اور پیغامات)',
                  items: [
                    { id: 'whatsapp-manager', label: 'WhatsApp Alerts & Proofs Hub', urdu: 'واٹس ایپ الرٹس مینجر', icon: MessageSquare },
                    { id: 'broadcast-center', label: 'Broadcast Campaigns (Email/SMS)', urdu: 'براڈکاسٹ پیغامات', icon: Send },
                    { id: 'bulk-notifications', label: 'Pro Bulk Notification Tool', urdu: 'بلک نوٹیفکیشنز', icon: Send }
                  ]
                },
                {
                  catTitle: '⚙️ Settings, SEO & Vault (سیٹنگز اور گوگل ایس ای او)',
                  items: [
                    { id: 'seo-config', label: 'Google Search SEO & Meta Tags', urdu: 'گوگل ایس ای او اور میٹا ٹیگز', icon: Globe },
                    { id: 'settings', label: 'Global Master Switches', urdu: 'ماسٹر سیٹنگز اور فیس', icon: Settings },
                    { id: 'form-customizer', label: 'Registration Form Customizer', urdu: 'فارم فیلڈز سیٹنگ', icon: Edit3 },
                    { id: 'activity-logs', label: 'Security & Activity Trail', urdu: 'سیکیورٹی لاگز', icon: ShieldCheck },
                    { id: 'data-backup', label: 'Data Vault & CSV Export', urdu: 'ڈیٹا بیک اپ اور ایکسپورٹ', icon: Database },
                    { id: 'analytics', label: 'Executive Analytics & KPIs', urdu: 'اینالیٹکس اور کارکردگی', icon: BarChart3 }
                  ]
                }
              ].map((cat, idx) => {
                const q = moduleSearchQuery.toLowerCase().trim();
                const filteredItems = cat.items.filter(
                  (it) =>
                    !q ||
                    it.label.toLowerCase().includes(q) ||
                    it.urdu.toLowerCase().includes(q) ||
                    it.id.toLowerCase().includes(q)
                );

                if (filteredItems.length === 0) return null;

                return (
                  <div key={idx} className="space-y-2.5">
                    <h4 className="text-xs font-black text-amber-400 uppercase tracking-wider">
                      {cat.catTitle}
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      {filteredItems.map((item) => {
                        const Icon = item.icon;
                        const isCurrent = adminTab === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              setAdminTab(item.id as any);
                              // update category
                              if (['jobs', 'pending', 'add-job', 'ai-enhancer'].includes(item.id)) setActiveCategory('jobs');
                              else if (['url-scraper', 'scraper', 'scraped-history'].includes(item.id)) setActiveCategory('scraper');
                              else if (['campaign-center', 'advertisements', 'landing-customizer'].includes(item.id)) setActiveCategory('ads');
                              else if (['admin-payment-methods', 'payment-proofs', 'fee-management', 'fee-logs', 'currency-forex'].includes(item.id)) setActiveCategory('payments');
                              else if (['user-audit', 'employer-kyc', 'subscribers', 'chat-hub'].includes(item.id)) setActiveCategory('users');
                              else if (['whatsapp-manager', 'broadcast-center', 'bulk-notifications'].includes(item.id)) setActiveCategory('alerts');
                              else setActiveCategory('settings');
                              setShowAllModulesMenu(false);
                            }}
                            className={`p-3 rounded-2xl border text-left flex items-start space-x-3 transition-all cursor-pointer ${
                              isCurrent
                                ? 'bg-amber-500/20 border-amber-500 text-white shadow-lg shadow-amber-500/10'
                                : 'bg-slate-950/80 border-slate-800 hover:border-slate-700 hover:bg-slate-900 text-slate-300'
                            }`}
                          >
                            <div className={`p-2 rounded-xl shrink-0 ${isCurrent ? 'bg-amber-500 text-slate-950' : 'bg-slate-900 text-amber-400 border border-slate-800'}`}>
                              <Icon className="w-4 h-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-xs font-bold text-white truncate block">{item.label}</span>
                                {item.badge && (
                                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold shrink-0">
                                    {item.badge}
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-400 block mt-0.5">{item.urdu}</span>
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

      {/* TAB: WHATSAPP SUPPORT & ALERTS MANAGER */}
      {adminTab === 'whatsapp-manager' && (
        <AdminWhatsAppManager
          config={currentWhatsAppConfig}
          onUpdateConfig={handleUpdateWhatsApp}
          subscribersCount={subscribers.length}
        />
      )}

      {/* TAB: PAYMENT PROOFS & DEPOSIT VERIFICATION HUB */}
      {adminTab === 'payment-proofs' && (
        <AdminPaymentVerificationHub
          transactions={currentTransactions}
          onApproveTransaction={handleApproveTx}
          onRejectTransaction={handleRejectTx}
          users={users}
          jobs={jobs}
        />
      )}

      {/* TAB: ADMIN PAYMENT METHODS & DURATION PRESETS MANAGER */}
      {adminTab === 'admin-payment-methods' && (
        <AdminPaymentMethodsManager />
      )}

      {/* TAB: LIVE LANDING PAGE VISUAL BUILDER & SEQUENCE EDITOR */}
      {adminTab === 'landing-customizer' && landingConfig && onUpdateLandingConfig && (
        <LandingPageCustomizer
          config={landingConfig}
          onUpdateConfig={onUpdateLandingConfig}
          campaignConfig={campaignConfig || DEFAULT_CAMPAIGN_CUSTOMIZATION_CONFIG}
          onUpdateCampaignConfig={onUpdateCampaignConfig || (() => {})}
        />
      )}

      {/* TAB: VISUAL CAMPAIGN COMMAND CENTER & GRANULAR DATES */}
      {adminTab === 'campaign-center' && (
        <AdminCampaignCenter
          ads={ads}
          campaignConfig={campaignConfig || DEFAULT_CAMPAIGN_CUSTOMIZATION_CONFIG}
          onUpdateCampaignConfig={onUpdateCampaignConfig || (() => {})}
          onUpdateAd={onUpdateAd || (() => {})}
          onDeleteAd={onDeleteAd || (() => {})}
          onResetAdMetrics={onResetAdMetrics || (() => {})}
          onApproveAd={onApproveAd}
          onRejectAd={onRejectAd}
        />
      )}

      {/* TAB: PER-CATEGORY POSTING FEES & 1-CLICK WAIVERS */}
      {adminTab === 'fee-management' && (
        <AdminFeeManager
          landingConfig={landingConfig}
          onUpdateLandingConfig={onUpdateLandingConfig}
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

      {/* TAB: EXECUTIVE ANALYTICS & REVENUE COMMAND CENTER */}
      {adminTab === 'analytics' && (
        <AdminAnalyticsOverview
          jobs={jobs}
          pendingJobs={pendingJobs}
          users={users}
          subscribers={subscribers}
          feeLogs={jobPostingFeeLogs}
          ads={ads}
          auditLogs={scrapedAuditLogs}
          batchRuns={scraperBatchRuns}
          currencyConfig={currencyConfig}
          onNavigateTab={(tabId) => setAdminTab(tabId)}
        />
      )}

      {/* TAB: GLOBAL SEO, METADATA & ANNOUNCEMENT ENGINE */}
      {adminTab === 'seo-config' && (
        <AdminSeoSettings
          seoConfig={siteSeoConfig}
          onUpdateSeoConfig={setSiteSeoConfig}
        />
      )}

      {/* TAB: MULTI-CURRENCY & INTERNATIONAL PRICING TIERS */}
      {adminTab === 'currency-forex' && (
        <AdminCurrencyManager
          currencyConfig={currencyConfig}
          onUpdateCurrencyConfig={setCurrencyConfig}
        />
      )}

      {/* TAB: MULTI-CHANNEL BROADCAST CENTER */}
      {adminTab === 'broadcast-center' && (
        <AdminBroadcastCenter
          campaigns={broadcastCampaigns}
          users={users}
          subscribers={subscribers}
          commConfig={commConfig}
          onSendCampaign={(newCamp) => setBroadcastCampaigns(prev => [newCamp, ...prev])}
          onUpdateCommConfig={setCommConfig}
        />
      )}

      {/* TAB: ADVANCED BULK NOTIFICATION SUITE */}
      {adminTab === 'bulk-notifications' && (
        <AdminBulkNotificationTool
          users={users}
          subscribers={subscribers}
        />
      )}

      {/* TAB: AUDIT & ADMIN ACTIVITY LOGS */}
      {adminTab === 'activity-logs' && (
        <AdminActivityLogs
          jobs={jobs}
          users={users}
          feeLogs={jobPostingFeeLogs}
          ads={ads}
        />
      )}

      {/* TAB: DATA VAULT & 1-CLICK SYSTEM SNAPSHOT BACKUP */}
      {adminTab === 'data-backup' && (
        <AdminDataBackupHub
          jobs={jobs}
          pendingJobs={pendingJobs}
          users={users}
          subscribers={subscribers}
          feeLogs={jobPostingFeeLogs}
          ads={ads}
          auditLogs={scrapedAuditLogs}
          batchRuns={scraperBatchRuns}
          customFormFields={customFormFields}
          featureFlags={featureFlags}
          onRestoreSnapshot={handleRestoreSnapshot}
          onImportBulkJobs={handleImportBulkJobs}
        />
      )}

      {/* TAB: AI QUALITY SCORER, AUDIT & SPAM FILTER */}
      {adminTab === 'ai-enhancer' && (
        <AdminAiQualityEnhancer
          jobs={jobs}
          pendingJobs={pendingJobs}
          onUpdateJob={(updatedJob) => {
            onAddJob(updatedJob);
          }}
        />
      )}

      {/* TAB: EMPLOYER KYC & SECP IDENTITY VERIFICATION */}
      {adminTab === 'employer-kyc' && (
        <AdminEmployerKycHub
          kycRequests={kycRequests}
          onUpdateKycRequest={(updated) => {
            setKycRequests(prev => prev.map(r => r.id === updated.id ? updated : r));
          }}
        />
      )}

      {/* TAB: SCRAPED JOBS HISTORY & AUDIT TRAIL MODULE */}
      {adminTab === 'scraped-history' && (
        <ScrapedJobHistoryModule
          auditLogs={scrapedAuditLogs}
          batchRuns={scraperBatchRuns}
          jobs={jobs}
          pendingJobs={pendingJobs}
          onApproveJob={handleAdminApproveJob}
          onRejectJob={handleAdminRejectJob}
          onDeleteJob={onDeleteJob}
          onBatchApprove={(jobIds) => jobIds.forEach(id => handleAdminApproveJob(id))}
          onBatchReject={(jobIds, reason) => jobIds.forEach(id => handleAdminRejectJob(id, reason))}
          onRunScraperNow={handleRunScraper}
          onUpdateAuditLogs={setScrapedAuditLogs}
        />
      )}

      {/* TAB: ADVERTISEMENT & CAMPAIGN ENGINE */}
      {adminTab === 'advertisements' && (
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
        />
      )}

      {/* TAB 1: PENDING JOBS APPROVAL QUEUE */}
      {adminTab === 'pending' && (() => {
        // Pending jobs duplicate detection
        const pendingClusters = computeJobDuplicateClusters(pendingJobs);
        const liveTitleSet = new Set(jobs.map(j => `${(j.title || '').trim().toLowerCase()}|${(j.company || '').trim().toLowerCase()}`));
        const liveCaseSet = new Set(jobs.filter(j => j.pdfCaseNumber).map(j => j.pdfCaseNumber!.trim().toLowerCase()));

        // Filter and Search
        const filteredPending = pendingJobs.filter(pJob => {
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
          if (showPendingDuplicatesOnly) {
            const isDupOfLive = liveTitleSet.has(`${(pJob.title || '').trim().toLowerCase()}|${(pJob.company || '').trim().toLowerCase()}`) || (pJob.pdfCaseNumber && liveCaseSet.has(pJob.pdfCaseNumber.trim().toLowerCase()));
            const isDupInPending = pendingClusters.some(c => c.items.some(it => it.id === pJob.id));
            if (!isDupOfLive && !isDupInPending) return false;
          }
          return true;
        }).sort((a, b) => {
          if (pendingSortBy === 'title') return a.title.localeCompare(b.title);
          if (pendingSortBy === 'oldest') return (a.postedAt || '').localeCompare(b.postedAt || '');
          return (b.postedAt || '').localeCompare(a.postedAt || '');
        });

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
            selectedPendingIds.forEach(id => {
              if (onRejectJob) onRejectJob(id, 'Admin deleted from queue');
            });
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
                    {pendingJobs.length} Pending
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Approve submissions to push to public live site, bulk edit attributes, or reject duplicate/invalid entries.
                </p>
              </div>

              {/* DUPLICATE CHECK TRIGGER BUTTON */}
              <div className="flex flex-wrap items-center gap-2">
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
                  </select>

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
                <div className="flex items-center space-x-3">
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
                  Showing {filteredPending.length} of {pendingJobs.length} queue items
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
                    onClick={() => setSelectedPendingIds([])}
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
                            onClick={() => handleAdminApproveJob(pJob.id)}
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
          </div>
        );
      })()}

      {/* TAB 2: USER DIRECTORY AUDIT & MANUAL SUBSCRIPTION CONTROL */}
      {adminTab === 'user-audit' && (() => {
        const userClusters = computeUserDuplicateClusters(users);

        const filteredUsers = users.filter((u) => {
          if (userSearchQuery.trim()) {
            const q = userSearchQuery.toLowerCase();
            const matchesName = (u.name || '').toLowerCase().includes(q);
            const matchesEmail = (u.email || '').toLowerCase().includes(q);
            const matchesRole = (u.role || '').toLowerCase().includes(q);
            if (!matchesName && !matchesEmail && !matchesRole) return false;
          }

          const isUnpaid = u.paymentStatus === 'Unpaid' || u.membershipStatus === 'Revoked' || (u.expiryDate && new Date(u.expiryDate).getTime() < Date.now());
          if (userPaymentFilter === 'paid' && isUnpaid) return false;
          if (userPaymentFilter === 'unpaid' && !isUnpaid) return false;

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

        const handleBulkDeleteSelectedUsers = () => {
          if (selectedUserIds.length === 0) return;
          if (confirm(`Permanently delete ${selectedUserIds.length} selected user accounts and clean up their sessions?`)) {
            if (onBulkDeleteUsers) {
              onBulkDeleteUsers(selectedUserIds);
            } else {
              selectedUserIds.forEach(id => {
                if (onEndUserMembership) onEndUserMembership(id);
              });
            }
            setSelectedUserIds([]);
          }
        };

        const handleBulkEndMembershipSelected = () => {
          if (selectedUserIds.length === 0) return;
          if (confirm(`End membership and revoke premium access for ${selectedUserIds.length} selected users?`)) {
            selectedUserIds.forEach(id => {
              if (onEndUserMembership) onEndUserMembership(id);
            });
            setSelectedUserIds([]);
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
                    onClick={handleBulkEndMembershipSelected}
                    className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 font-bold text-xs rounded-xl border border-amber-500/40 cursor-pointer flex items-center space-x-1"
                  >
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>Bulk End Membership</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleBulkDeleteSelectedUsers}
                    className="px-3 py-1.5 bg-rose-500 hover:bg-rose-400 text-white font-bold text-xs rounded-xl shadow-lg shadow-rose-500/20 cursor-pointer flex items-center space-x-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Bulk Delete Accounts ({selectedUserIds.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedUserIds([])}
                    className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-xl font-bold cursor-pointer"
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
                      const isUnpaidOrRevoked = u.paymentStatus === 'Unpaid' || u.membershipStatus === 'Revoked' || (u.expiryDate && new Date(u.expiryDate).getTime() < Date.now());

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
                              !isUnpaidOrRevoked
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            }`}>
                              <span>{!isUnpaidOrRevoked ? '💳 Paid Active' : '⚠️ Unpaid / Revoked'}</span>
                            </span>
                          </td>
                          <td className="p-3 font-mono text-xs">
                            <span className={isUnpaidOrRevoked ? 'text-rose-400 font-bold' : 'text-slate-300'}>
                              {u.expiryDate || '2026-08-24 09:00'}
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
      {adminTab === 'fee-logs' && (() => {
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

      {/* TAB: INSTANT URL SCRAPER & BULK DEDUPLICATION CONTROLLER */}
      {adminTab === 'url-scraper' && (
        <AdminUrlScraperController
          existingLiveJobs={jobs}
          existingPendingJobs={pendingJobs}
          onApproveJobsToLive={(stagedJobs) => {
            if (onBulkAddJobs) {
              onBulkAddJobs(stagedJobs);
            } else {
              stagedJobs.forEach(j => onAddJob(j));
            }
          }}
          onRejectJobs={(rejectedIds) => {
            rejectedIds.forEach(id => {
              if (onRejectJob) onRejectJob(id, 'Scraped job rejected by admin from URL Scraper Hub');
            });
          }}
          onOverrideDuplicatesToLive={(overrideJobs) => {
            if (onBulkAddJobs) {
              onBulkAddJobs(overrideJobs);
            } else {
              overrideJobs.forEach(j => onAddJob(j));
            }
          }}
        />
      )}

      {/* TAB 4: AUTOMATED SCRAPER & CRON SCHEDULER CONTROLLER */}
      {adminTab === 'scraper' && (
        <div className="space-y-6 text-white max-w-6xl shadow-2xl">
          
          {/* HEADER & CONTROLLER SUMMARY BANNER */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div className="flex items-start space-x-3">
                <div className="p-3 bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-500/30">
                  <Bot className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white flex items-center space-x-2">
                    <span>Automated Scraper Controller & Source Origin Engine</span>
                    <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full">
                      Auto-Scheduler Active
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Monitor, manage, and inspect all automated job postings coming from external portals, newspaper ads, and government announcements.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => setIsPdfScraperModalOpen(true)}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-indigo-600 hover:from-amber-400 hover:to-indigo-500 text-slate-950 hover:text-white font-black text-xs shadow-xl shadow-amber-500/20 flex items-center justify-center space-x-2 cursor-pointer transition-all active:scale-95"
                >
                  <FileSpreadsheet className="w-4 h-4 text-slate-950" />
                  <span>📄 FPSC & WAPDA PDF Parser (pdfplumber)</span>
                </button>

                <button
                  onClick={() => handleRunScraper()}
                  disabled={isScraping}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500 text-white font-black text-xs shadow-xl shadow-indigo-500/20 flex items-center justify-center space-x-2 cursor-pointer hover:scale-105 transition-all"
                >
                  <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
                  <span>{isScraping ? 'Scraping Active...' : 'Scrape All Targets On-Demand'}</span>
                </button>
              </div>
            </div>

            {/* TOP METRIC CARDS GRID */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-1">
              <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl space-y-1">
                <div className="text-[10px] font-bold uppercase text-slate-400 flex items-center justify-between">
                  <span>Configured Targets</span>
                  <Globe className="w-3.5 h-3.5 text-indigo-400" />
                </div>
                <div className="text-xl font-black text-white">{scraperSources.length} <span className="text-xs text-emerald-400 font-normal">({scraperSources.filter(s => s.status === 'Active Scheduled').length} Active)</span></div>
                <div className="text-[10px] text-slate-500">Corporate, Govt & Classifieds</div>
              </div>

              <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl space-y-1">
                <div className="text-[10px] font-bold uppercase text-slate-400 flex items-center justify-between">
                  <span>Total Harvested Jobs</span>
                  <Briefcase className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <div className="text-xl font-black text-emerald-400">
                  {scraperSources.reduce((acc, curr) => acc + curr.scrapedCount, 0)}
                </div>
                <div className="text-[10px] text-slate-500">Extracted across all feeds</div>
              </div>

              <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl space-y-1">
                <div className="text-[10px] font-bold uppercase text-slate-400 flex items-center justify-between">
                  <span>Pending Approval Queue</span>
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                </div>
                <div className="text-xl font-black text-amber-400">
                  {pendingJobs.filter(j => j.sourceUrl || j.scraperSourceId || j.scrapedSourceDomain || j.id.includes('scraped') || j.id.includes('sc1') || j.id.includes('sc2')).length}
                </div>
                <div className="text-[10px] text-slate-500">Awaiting Admin Verification</div>
              </div>

              <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl space-y-1">
                <div className="text-[10px] font-bold uppercase text-slate-400 flex items-center justify-between">
                  <span>AI Parsing Accuracy</span>
                  <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                </div>
                <div className="text-xl font-black text-purple-300">98.6%</div>
                <div className="text-[10px] text-slate-500">Universal Keywordless Active</div>
              </div>
            </div>

            {/* EASY WORKFLOW & 1-CLICK DEDUPLICATION / BULK LIVE BAR */}
            {(() => {
              const allScrapedPendingJobs = pendingJobs.filter(j => 
                j.sourceUrl || j.scraperSourceId || j.scrapedSourceDomain || j.id.includes('scraped') || j.id.includes('sc')
              );
              const { duplicateCount, uniqueCount } = computeScrapedDuplicates(allScrapedPendingJobs);

              return (
                <div className="bg-slate-950 border-2 border-indigo-500/40 rounded-xl p-4 space-y-3">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="px-2 py-0.5 rounded bg-indigo-500 text-slate-950 font-black text-[10px] uppercase">
                          Easy Admin Workflow (آسان طریقہ کار)
                        </span>
                        <span className="text-xs font-black text-white">Smart Scraper & Deduplication Hub</span>
                      </div>
                      <p className="text-[11px] text-slate-300 mt-1">
                        1️⃣ <span className="text-amber-300 font-bold">Scrape</span> (جابز لائیں) ➔ 
                        2️⃣ <span className="text-rose-300 font-bold">Remove Duplicates</span> (ڈپلیکیٹ ڈیلیٹ کریں) ➔ 
                        3️⃣ <span className="text-emerald-300 font-bold">Approve Live</span> (فوری لائیو کریں)
                      </p>
                    </div>

                    <div className="flex items-center space-x-3 text-xs">
                      <div className="px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 font-bold flex items-center space-x-1.5">
                        <AlertCircle className="w-4 h-4 text-rose-400" />
                        <span>{duplicateCount} Duplicates (ڈپلیکیٹ)</span>
                      </div>
                      <div className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-bold flex items-center space-x-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>{uniqueCount} Unique (یونیک)</span>
                      </div>
                    </div>
                  </div>

                  {/* 1-CLICK ACTIONS */}
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={handleBulkPurgeDuplicates}
                      disabled={duplicateCount === 0}
                      className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center space-x-2 cursor-pointer transition-all ${
                        duplicateCount > 0
                          ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/20 active:scale-95'
                          : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>🗑️ 1-Click Remove {duplicateCount} Duplicates (تمام ڈپلیکیٹ حذف کریں)</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleBulkApproveUniqueToLive}
                      disabled={uniqueCount === 0}
                      className={`px-4 py-2 rounded-xl text-xs font-black flex items-center space-x-2 cursor-pointer transition-all ${
                        uniqueCount > 0
                          ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20 active:scale-95'
                          : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4 text-slate-950" />
                      <span>🚀 1-Click Approve All {uniqueCount} Unique Jobs to Live (تمام یونیک جابز فوری لائیو کریں)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsPendingDuplicateModalOpen(true)}
                      className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 text-xs font-bold flex items-center space-x-1.5 cursor-pointer transition-all"
                    >
                      <Search className="w-3.5 h-3.5" />
                      <span>Detailed Duplicate Inspector (تفصیلی چیکر)</span>
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* SCRAPING LIVE PROGRESS BAR */}
            {isScraping && (
              <div className="p-4 bg-indigo-950/40 border border-indigo-500/40 rounded-xl space-y-2">
                <div className="flex justify-between text-xs font-bold text-indigo-300">
                  <span className="flex items-center space-x-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
                    <span>Extracting & Auto-Judging Jobs across target web portals...</span>
                  </span>
                  <span>{scrapeProgress}%</span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-indigo-500 to-emerald-400 h-full transition-all duration-300"
                    style={{ width: `${scrapeProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* SUB-NAVIGATION TAB BAR */}
          <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-2">
            <button
              onClick={() => setScraperSubTab('targets')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
                scraperSubTab === 'targets'
                  ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Configured Scraper Portals ({scraperSources.length})</span>
            </button>

            <button
              onClick={() => setScraperSubTab('pdf-sources')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
                scraperSubTab === 'pdf-sources'
                  ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20 font-black'
                  : 'bg-slate-900 text-rose-300 hover:text-white border border-slate-800'
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-rose-400" />
              <span>📄 FPSC/WAPDA PDF Gazette Sources ({pdfGazettes.length})</span>
            </button>

            <button
              onClick={() => setScraperSubTab('history')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
                scraperSubTab === 'history'
                  ? 'bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/20'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Scraped History & Audit Ledger ({scrapedAuditLogs.length})</span>
            </button>

            <button
              onClick={() => setScraperSubTab('add')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
                scraperSubTab === 'add'
                  ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Configure New Target Portal</span>
            </button>

            <button
              onClick={() => setScraperSubTab('inspect-feed')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
                scraperSubTab === 'inspect-feed'
                  ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Ingested Scraped Jobs Feed ({[...jobs, ...pendingJobs].filter(j => j.sourceUrl || j.scraperSourceId || j.scrapedSourceDomain || j.id.includes('scraped') || j.id.includes('sc1') || j.id.includes('sc2')).length})</span>
            </button>

            <button
              onClick={() => setScraperSubTab('logs')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
                scraperSubTab === 'logs'
                  ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/20'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <Bot className="w-3.5 h-3.5" />
              <span>System Cron Terminal Logs</span>
            </button>
          </div>

          {/* SUB-TAB: SCRAPED HISTORY & AUDIT LEDGER */}
          {scraperSubTab === 'history' && (
            <ScrapedJobHistoryModule
              auditLogs={scrapedAuditLogs}
              batchRuns={scraperBatchRuns}
              jobs={jobs}
              pendingJobs={pendingJobs}
              onApproveJob={handleAdminApproveJob}
              onRejectJob={handleAdminRejectJob}
              onDeleteJob={onDeleteJob}
              onBatchApprove={(jobIds) => jobIds.forEach(id => handleAdminApproveJob(id))}
              onBatchReject={(jobIds, reason) => jobIds.forEach(id => handleAdminRejectJob(id, reason))}
              onRunScraperNow={handleRunScraper}
              onUpdateAuditLogs={setScrapedAuditLogs}
            />
          )}

          {/* SUB-TAB 1: CONFIGURED TARGET PORTALS LIST */}
          {scraperSubTab === 'targets' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-800 pb-3">
                <div>
                  <h4 className="text-sm font-black uppercase text-white flex items-center space-x-2">
                    <Bot className="w-4 h-4 text-indigo-400" />
                    <span>Active Scraper Feeds & Schedule Rules ({scraperSources.length})</span>
                  </h4>
                  <p className="text-xs text-slate-400">
                    Manage automated scraper portals, configure cron frequencies, toggle auto-approval, and run bulk operations.
                  </p>
                </div>

                {/* SEARCH & CATEGORY FILTER */}
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={scraperTargetSearchQuery}
                      onChange={(e) => setScraperTargetSearchQuery(e.target.value)}
                      placeholder="Search targets..."
                      className="pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:border-indigo-500 outline-none w-48 sm:w-56"
                    />
                  </div>

                  <select
                    value={scraperTargetCategoryFilter}
                    onChange={(e) => setScraperTargetCategoryFilter(e.target.value)}
                    className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-bold focus:border-indigo-500 outline-none"
                  >
                    <option value="all">All Categories</option>
                    <option value="Private Corporate">Corporate</option>
                    <option value="Government Sector">Government</option>
                    <option value="Newspaper Classified">Newspaper</option>
                    <option value="International Remote">Remote</option>
                  </select>
                </div>
              </div>

              {/* BULK ACTIONS TOOLBAR */}
              {(() => {
                const filteredSources = scraperSources.filter((source) => {
                  const matchesCat = scraperTargetCategoryFilter === 'all' || source.category === scraperTargetCategoryFilter;
                  const q = scraperTargetSearchQuery.toLowerCase().trim();
                  const matchesQ = !q || source.name.toLowerCase().includes(q) || source.url.toLowerCase().includes(q) || source.keywords.toLowerCase().includes(q);
                  return matchesCat && matchesQ;
                });
                const allSelected = filteredSources.length > 0 && filteredSources.every(s => selectedScraperTargetIds.includes(s.id));
                const someSelected = selectedScraperTargetIds.length > 0;

                return (
                  <>
                    <div className="p-3.5 bg-slate-950 border border-indigo-500/30 rounded-xl flex flex-wrap items-center justify-between gap-3 shadow-inner">
                      <div className="flex items-center space-x-3">
                        <label className="flex items-center space-x-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={allSelected}
                            onChange={() => handleSelectAllScraperTargets(filteredSources)}
                            className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-indigo-500 focus:ring-indigo-500 cursor-pointer"
                          />
                          <span className="text-xs font-bold text-slate-200">
                            {allSelected ? 'Deselect All' : 'Select All'} ({filteredSources.length})
                          </span>
                        </label>

                        {someSelected && (
                          <span className="px-2.5 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 rounded-full text-[11px] font-black">
                            {selectedScraperTargetIds.length} Selected
                          </span>
                        )}
                      </div>

                      {/* BULK ACTION BUTTONS */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={handleBulkRunSelectedScraperTargets}
                          disabled={!someSelected || isScraping}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-all ${
                            someSelected
                              ? 'bg-indigo-500 hover:bg-indigo-400 text-white shadow-md shadow-indigo-500/20 cursor-pointer'
                              : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-60'
                          }`}
                          title="Trigger crawl on all selected portals simultaneously"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                          <span>Bulk Run ({selectedScraperTargetIds.length})</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleBulkPauseScraperTargets}
                          disabled={!someSelected}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1 transition-all ${
                            someSelected
                              ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 cursor-pointer'
                              : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-60'
                          }`}
                        >
                          <span>⏸️ Pause Selected</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleBulkResumeScraperTargets}
                          disabled={!someSelected}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1 transition-all ${
                            someSelected
                              ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 cursor-pointer'
                              : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-60'
                          }`}
                        >
                          <span>▶️ Resume Selected</span>
                        </button>

                        <div className="relative inline-block">
                          <select
                            disabled={!someSelected}
                            onChange={(e) => {
                              if (e.target.value) {
                                handleBulkSetIntervalTargets(e.target.value as any);
                                e.target.value = '';
                              }
                            }}
                            defaultValue=""
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                              someSelected
                                ? 'bg-slate-900 border-slate-700 text-slate-200 cursor-pointer'
                                : 'bg-slate-800 border-slate-800 text-slate-500 cursor-not-allowed opacity-60'
                            }`}
                          >
                            <option value="" disabled>⏱️ Set Frequency...</option>
                            <option value="15m">Every 15 Minutes</option>
                            <option value="30m">Every 30 Minutes</option>
                            <option value="1h">Hourly (1 Hour)</option>
                            <option value="6h">Every 6 Hours</option>
                            <option value="24h">Daily (24 Hours)</option>
                            <option value="7d">Weekly (7 Days)</option>
                          </select>
                        </div>

                        <div className="relative inline-block">
                          <select
                            disabled={!someSelected}
                            onChange={(e) => {
                              if (e.target.value !== '') {
                                handleBulkToggleAutoApproveTargets(e.target.value === 'true');
                                e.target.value = '';
                              }
                            }}
                            defaultValue=""
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                              someSelected
                                ? 'bg-slate-900 border-slate-700 text-slate-200 cursor-pointer'
                                : 'bg-slate-800 border-slate-800 text-slate-500 cursor-not-allowed opacity-60'
                            }`}
                          >
                            <option value="" disabled>🛡️ Auto-Approve...</option>
                            <option value="true">Enable Auto-Approve (ON)</option>
                            <option value="false">Require Admin Review (OFF)</option>
                          </select>
                        </div>

                        <button
                          type="button"
                          onClick={handleBulkDeleteScraperTargets}
                          disabled={!someSelected}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1 transition-all ${
                            someSelected
                              ? 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 cursor-pointer'
                              : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-60'
                          }`}
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {filteredSources.map((source) => {
                        const isSelected = selectedScraperTargetIds.includes(source.id);
                        return (
                        <div key={source.id} className={`p-5 bg-slate-950 border rounded-2xl space-y-4 transition-all ${
                          isSelected ? 'border-indigo-500 shadow-lg shadow-indigo-500/10 bg-slate-950/95' : 'border-slate-800 hover:border-indigo-500/40'
                        }`}>
                          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                            <div className="flex items-start space-x-3">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleSelectScraperTarget(source.id)}
                                className="w-4 h-4 mt-1 rounded bg-slate-900 border-slate-700 text-indigo-500 focus:ring-indigo-500 cursor-pointer"
                              />
                              <div className="space-y-1">
                                <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                                  <h5 className="font-black text-white text-base">{source.name}</h5>
                                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                    source.status === 'Active Scheduled' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-slate-800 text-slate-400'
                                  }`}>
                                    {source.status}
                                  </span>
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                    {source.interval} Cron Schedule
                                  </span>
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                    {source.category}
                                  </span>
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300">
                                    📍 {source.region}
                                  </span>
                                </div>
                                <a href={source.url} target="_blank" rel="noreferrer" className="text-xs font-mono text-indigo-400 hover:underline flex items-center space-x-1 truncate max-w-xl">
                                  <span>{source.url}</span>
                                </a>
                              </div>
                            </div>

                      {/* QUICK ACTION CONTROLS */}
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => setExpandedSourceId(expandedSourceId === source.id ? null : source.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer flex items-center space-x-1.5 ${
                            expandedSourceId === source.id
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-lg shadow-amber-500/10'
                              : 'bg-indigo-950/80 hover:bg-indigo-900/80 text-indigo-300 border-indigo-500/30'
                          }`}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>{expandedSourceId === source.id ? 'Hide Extracted Jobs' : `Inspect Harvested Jobs`}</span>
                        </button>

                        <button
                          onClick={() => handleToggleSourceAutoApprove(source.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                            source.autoApprove
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}
                        >
                          {source.autoApprove ? '⚡ Auto-Approve: ON' : '🛡️ Review Required'}
                        </button>

                        <button
                          onClick={() => handleToggleSourceStatus(source.id)}
                          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 cursor-pointer"
                        >
                          {source.status === 'Active Scheduled' ? 'Pause' : 'Resume'}
                        </button>

                        <button
                          onClick={() => handleOpenSourceInPdfParser(source)}
                          className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 font-bold text-xs cursor-pointer flex items-center space-x-1"
                          title="Open this portal in FPSC/WAPDA PDF Parser"
                        >
                          <FileText className="w-3.5 h-3.5 text-rose-400" />
                          <span>PDF Parser</span>
                        </button>

                        <button
                          onClick={() => handleRunScraper(source.id)}
                          disabled={isScraping}
                          className="px-3.5 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-xs shadow-lg shadow-indigo-500/20 cursor-pointer flex items-center space-x-1"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                          <span>Run Target Now</span>
                        </button>

                        <button
                          onClick={() => handleDeleteScraperSource(source.id)}
                          className="p-1.5 text-rose-400 hover:text-white hover:bg-rose-500/20 rounded-lg cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* METRICS FOOTER */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs bg-slate-900/60 p-3 rounded-xl border border-slate-800/80 font-mono text-slate-300">
                      <div><span className="text-slate-500">Keywords:</span> {source.keywords || 'Universal Keywordless'}</div>
                      <div><span className="text-slate-500">Depth Level:</span> {source.depth}</div>
                      <div><span className="text-slate-500">Last Executed:</span> <span className="text-emerald-400 font-bold">{source.lastRun || 'Just Now'}</span></div>
                      <div>
                        <span className="text-slate-500">Jobs Extracted:</span>{' '}
                        <button
                          onClick={() => setExpandedSourceId(expandedSourceId === source.id ? null : source.id)}
                          className="text-amber-300 font-black hover:underline cursor-pointer"
                        >
                          {source.scrapedCount} Jobs (Click to Inspect)
                        </button>
                      </div>
                    </div>

                    {/* EXPANDED EXTRACTED JOBS DRAWER */}
                    {expandedSourceId === source.id && (
                      <div className="mt-4 p-4 bg-slate-900 border border-indigo-500/30 rounded-2xl space-y-4 animate-in fade-in duration-200">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-800 pb-3">
                          <div>
                            <h6 className="text-xs font-black uppercase text-amber-300 flex items-center space-x-2">
                              <Globe className="w-4 h-4 text-indigo-400" />
                              <span>Extracted Jobs Harvested from "{source.name}"</span>
                            </h6>
                            <p className="text-[11px] text-slate-400">
                              Review job details, auto-assigned sector tags, salary ranges, and take immediate verification action.
                            </p>
                          </div>
                          <span className="px-3 py-1 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full text-[10px] font-bold">
                            Source Domain: {source.url.replace('https://', '').replace('http://', '').split('/')[0]}
                          </span>
                        </div>

                        {/* LIST OF JOBS MATCHING THIS SOURCE */}
                        {(() => {
                          const rawTargetJobs = [...pendingJobs, ...jobs].filter(j => 
                            j && j.id && (
                              j.scraperSourceId === source.id ||
                              (j.sourceUrl && (
                                j.sourceUrl.toLowerCase().includes(source.url.toLowerCase()) ||
                                source.url.toLowerCase().includes(j.sourceUrl.toLowerCase()) ||
                                (source.id === 'sc-1' && j.sourceUrl.includes('rozee')) ||
                                (source.id === 'sc-2' && (j.sourceUrl.includes('fpsc') || j.isGovtJob)) ||
                                (source.id === 'sc-3' && (j.sourceUrl.includes('jang') || j.isNewspaperAd)) ||
                                (source.id === 'sc-4' && (j.sourceUrl.includes('linkedin') || j.tags?.includes('LinkedIn Feed'))) ||
                                (source.id === 'sc-5' && (j.sourceUrl.includes('gulftalent') || j.tags?.includes('GulfTalent')))
                              ))
                            )
                          );
                          const targetJobsMap = new Map<string, Job>();
                          rawTargetJobs.forEach(j => targetJobsMap.set(j.id, j));
                          const targetJobs = Array.from(targetJobsMap.values());

                          if (targetJobs.length === 0) {
                            return (
                              <div className="p-6 text-center bg-slate-950/80 rounded-xl border border-slate-800 text-slate-400 space-y-2">
                                <Bot className="w-6 h-6 text-indigo-400 mx-auto animate-pulse" />
                                <p className="text-xs font-bold text-slate-300">No pending jobs currently waiting in queue for this feed.</p>
                                <p className="text-[11px] text-slate-500">Click "Run Target Now" above to trigger instant live extraction!</p>
                              </div>
                            );
                          }

                          return (
                            <div className="space-y-3">
                              {targetJobs.map((job) => {
                                const isPending = job.status === 'Pending';
                                return (
                                  <div key={job.id} className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3 hover:border-slate-700 transition-all">
                                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 border-b border-slate-800/60 pb-2">
                                      <div className="space-y-1">
                                        <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                            isPending ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                          }`}>
                                            {isPending ? '⏳ Awaiting Admin Approval' : '✅ Published Live'}
                                          </span>

                                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                            {source.category}
                                          </span>

                                          {job.isGovtJob && (
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                              🏛️ Govt ({job.govtScale || 'BPS Scale'})
                                            </span>
                                          )}

                                          {job.isNewspaperAd && (
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30">
                                              📰 Newspaper Ad ({job.newspaperName || 'Classified'})
                                            </span>
                                          )}
                                        </div>

                                        <h5 className="font-black text-white text-sm">{job.title}</h5>
                                        <div className="text-xs text-slate-400 font-medium flex items-center space-x-2">
                                          <span className="text-indigo-300 font-bold">{job.company}</span>
                                          <span>•</span>
                                          <span>📍 {job.city ? `${job.city}, ${job.region}` : job.region}</span>
                                          <span>•</span>
                                          <span className="text-emerald-400 font-bold">{job.salary}</span>
                                        </div>
                                      </div>

                                      {/* DIRECT ACTION BUTTONS */}
                                      <div className="flex flex-wrap items-center gap-2 mt-2 md:mt-0">
                                        {isPending && (
                                          <button
                                            onClick={() => {
                                              onApproveJob(job.id);
                                              alert(`Job "${job.title}" successfully approved & posted to Live Job Board!`);
                                            }}
                                            className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-lg shadow-emerald-500/20 cursor-pointer flex items-center space-x-1"
                                          >
                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                            <span>Approve & Publish</span>
                                          </button>
                                        )}

                                        {isPending && (
                                          <button
                                            onClick={() => handleRejectPrompt(job.id)}
                                            className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-xs font-bold cursor-pointer flex items-center space-x-1"
                                          >
                                            <X className="w-3.5 h-3.5" />
                                            <span>Reject</span>
                                          </button>
                                        )}

                                        <button
                                          onClick={() => setSelectedJobForModal(job)}
                                          className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 cursor-pointer flex items-center space-x-1"
                                        >
                                          <Eye className="w-3.5 h-3.5 text-indigo-400" />
                                          <span>Details</span>
                                        </button>

                                        {job.sourceUrl && (
                                          <a
                                            href={job.sourceUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="px-2.5 py-1.5 rounded-lg bg-indigo-950/80 hover:bg-indigo-900/80 text-indigo-300 border border-indigo-500/30 text-xs font-bold flex items-center space-x-1"
                                          >
                                            <Globe className="w-3.5 h-3.5 text-indigo-400" />
                                            <span>Source Link</span>
                                          </a>
                                        )}

                                        <button
                                          onClick={() => {
                                            if (confirm(`Are you sure you want to delete "${job.title}"?`)) {
                                              onDeleteJob(job.id);
                                            }
                                          }}
                                          className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded-lg cursor-pointer"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </div>

                                    {/* DESCRIPTION & REQUIREMENTS PREVIEW */}
                                    <div className="text-xs text-slate-300 leading-relaxed bg-slate-900/50 p-3 rounded-xl border border-slate-800/80">
                                      <p className="line-clamp-2">{job.description}</p>
                                      {job.requirements && job.requirements.length > 0 && (
                                        <div className="mt-2 flex flex-wrap gap-1">
                                          {job.requirements.map((req, idx) => (
                                            <span key={idx} className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded text-[10px]">
                                              ✓ {req}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        );
      })()}
    </div>
  )}

          {/* SUB-TAB 2: CONFIGURE NEW TARGET PORTAL FORM */}
          {scraperSubTab === 'add' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
              <h4 className="text-sm font-black uppercase text-emerald-300 flex items-center space-x-2 border-b border-slate-800 pb-2">
                <Plus className="w-4 h-4 text-emerald-400" />
                <span>Configure New Scraper Portal / Target Source</span>
              </h4>

              <form onSubmit={handleAddScraperSource} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4 text-xs">
                
                <div className="lg:col-span-4">
                  <label className="block font-bold text-slate-300 mb-1">Target Portal Name / Title</label>
                  <input
                    type="text"
                    value={newScraperName}
                    onChange={(e) => setNewScraperName(e.target.value)}
                    placeholder="e.g. Rozee.pk Lahore Tech Jobs or PPSC Govt Jobs"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-medium"
                  />
                </div>

                <div className="lg:col-span-5">
                  <label className="block font-bold text-slate-300 mb-1">Target Website URL Address</label>
                  <input
                    type="url"
                    value={scraperUrl}
                    onChange={(e) => setScraperUrl(e.target.value)}
                    required
                    placeholder="https://rozee.pk/jobs or https://fpsc.gov.pk"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono"
                  />
                </div>

                <div className="lg:col-span-3">
                  <label className="block font-bold text-slate-300 mb-1">Target Keywords (Optional)</label>
                  <input
                    type="text"
                    value={scraperKeyword}
                    onChange={(e) => setScraperKeyword(e.target.value)}
                    placeholder="React, Full Stack, BPS-17"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-medium"
                  />
                </div>

                <div className="lg:col-span-3">
                  <label className="block font-bold text-slate-300 mb-1">Job Sector Category</label>
                  <select
                    value={scraperCategory}
                    onChange={(e) => setScraperCategory(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-bold"
                  >
                    <option value="Private Corporate">🏢 Corporate Private Sector</option>
                    <option value="Government Sector">🏛️ Government Sector (BPS)</option>
                    <option value="Newspaper Classified">📰 Newspaper Classified Ads</option>
                    <option value="International Remote">🌐 International Remote Jobs</option>
                  </select>
                </div>

                <div className="lg:col-span-3">
                  <label className="block font-bold text-slate-300 mb-1">Geographic Region Target</label>
                  <select
                    value={scraperRegion}
                    onChange={(e) => setScraperRegion(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-bold"
                  >
                    <option value="Pakistan">🇵🇰 Pakistan (All Provinces)</option>
                    <option value="Global">🌐 Overseas / Global Remote</option>
                    <option value="United States">🇺🇸 United States</option>
                    <option value="United Kingdom">🇬🇧 United Kingdom</option>
                    <option value="UAE">🇦🇪 United Arab Emirates</option>
                    <option value="Saudi Arabia">🇸🇦 Saudi Arabia</option>
                    <option value="Canada">🇨🇦 Canada</option>
                    <option value="Europe">🇪🇺 Europe</option>
                    <option value="Australia">🇦🇺 Australia</option>
                  </select>
                </div>

                <div className="lg:col-span-3">
                  <label className="block font-bold text-slate-300 mb-1">Cron Schedule Frequency</label>
                  <select
                    value={scraperInterval}
                    onChange={(e) => setScraperInterval(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-bold"
                  >
                    <option value="15m">Every 15 Minutes</option>
                    <option value="30m">Every 30 Minutes</option>
                    <option value="1h">Hourly (1 Hour)</option>
                    <option value="6h">Every 6 Hours</option>
                    <option value="24h">Daily (24 Hours)</option>
                    <option value="7d">Weekly (7 Days)</option>
                  </select>
                </div>

                <div className="lg:col-span-3">
                  <label className="block font-bold text-slate-300 mb-1">Crawl Depth / Limit</label>
                  <select
                    value={scraperDepth}
                    onChange={(e) => setScraperDepth(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-bold"
                  >
                    <option value="Light (10 Jobs)">Light Scan (10 Jobs / run)</option>
                    <option value="Standard (25 Jobs)">Standard Crawl (25 Jobs / run)</option>
                    <option value="Deep Crawl (50+ Jobs)">Deep Crawl (50+ Jobs / run)</option>
                  </select>
                </div>

                <div className="lg:col-span-6 flex items-center space-x-3 pt-2">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={scraperAutoApprove}
                      onChange={(e) => setScraperAutoApprove(e.target.checked)}
                      className="w-4 h-4 rounded bg-slate-950 border-slate-800 text-emerald-500 focus:ring-emerald-500"
                    />
                    <span className="font-bold text-slate-200">
                      Auto-Approve directly to Live Listings (Bypass Pending Review Queue)
                    </span>
                  </label>
                </div>

                <div className="lg:col-span-6 flex items-center space-x-3 pt-2">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={scraperDeduplication}
                      onChange={(e) => setScraperDeduplication(e.target.checked)}
                      className="w-4 h-4 rounded bg-slate-950 border-slate-800 text-indigo-500 focus:ring-indigo-500"
                    />
                    <span className="font-bold text-slate-200">
                      Smart Deduplication Engine (Skip existing company & title matches)
                    </span>
                  </label>
                </div>

                <div className="lg:col-span-12 p-3.5 bg-slate-950/80 border border-rose-500/30 rounded-xl space-y-1">
                  <label className="flex items-center space-x-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={alsoRegisterInPdfParser}
                      onChange={(e) => setAlsoRegisterInPdfParser(e.target.checked)}
                      className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-rose-500 focus:ring-rose-500"
                    />
                    <span className="font-bold text-rose-300 flex items-center space-x-1.5">
                      <FileText className="w-3.5 h-3.5 text-rose-400" />
                      <span>Also register this portal into 📄 FPSC & WAPDA PDF Parser (pdfplumber) Gazette library</span>
                    </span>
                  </label>
                  <p className="text-[11px] text-slate-400 pl-6">
                    Allows you to extract multi-column table gazettes, BPS scale quotas, and challan fees directly via Python pdfplumber stream parser.
                  </p>
                </div>

                <div className="lg:col-span-12 pt-2">
                  <button
                    type="submit"
                    className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-sm rounded-xl shadow-lg shadow-emerald-500/20 cursor-pointer"
                  >
                    Save & Activate Scraper Target Schedule
                  </button>
                </div>

              </form>
            </div>
          )}

          {/* SUB-TAB: PDF PARSER GAZETTE SOURCES LIBRARY & MANUAL SITE INGESTION */}
          {scraperSubTab === 'pdf-sources' && (
            <div className="space-y-6">
              {/* HEADER BANNER */}
              <div className="p-6 bg-gradient-to-r from-slate-900 via-rose-950/30 to-slate-900 border border-rose-500/30 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-xl">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white uppercase tracking-wider">
                      📄 AI PDF Parser & Gazette Reader
                    </span>
                    <span className="text-xs text-rose-300 font-bold">Simple Official Jobs Importer</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      13 Official Pakistan Portals Ready
                    </span>
                  </div>
                  <h3 className="text-lg font-black text-white flex items-center space-x-2">
                    <FileText className="w-5 h-5 text-rose-400" />
                    <span>Government & Testing Service Job Scanner</span>
                  </h3>
                  <p className="text-xs text-slate-400 max-w-3xl">
                    Easily extract all job openings from FPSC, WAPDA, Pakistan Army, Railways, and testing services (NTS, OTS, STS, CTSP). No coding or complex setup needed!
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={handleSyncAll13OfficialPortals}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-bold rounded-xl border border-slate-700 flex items-center space-x-1.5 cursor-pointer transition-all"
                    title="Reload all 13 official Pakistani recruitment websites"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                    <span>Refresh 13 Portals</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveSelectedPdfGazetteId(pdfGazettes[0]?.id || null);
                      setIsPdfScraperModalOpen(true);
                    }}
                    className="px-4 py-2 bg-rose-500 hover:bg-rose-400 text-white font-black text-xs rounded-xl shadow-lg shadow-rose-500/25 flex items-center space-x-2 cursor-pointer transition-all"
                  >
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>Open Full PDF Reader Screen</span>
                  </button>
                </div>
              </div>

              {/* EASY 3-STEP ADMIN GUIDE */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-3 shadow-xl">
                <div className="flex items-center space-x-2">
                  <span className="p-1 bg-amber-500/20 text-amber-400 rounded-lg">
                    <Sparkles className="w-4 h-4" />
                  </span>
                  <h4 className="text-sm font-black text-white">
                    🌟 Easy 3-Step Guide for Admins (How It Works)
                  </h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5">
                    <div className="flex items-center space-x-2 text-rose-300 font-bold">
                      <span className="w-5 h-5 rounded-full bg-rose-500/20 text-rose-300 flex items-center justify-center text-[11px] font-black border border-rose-500/40">1</span>
                      <span>Choose a Website or PDF</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Pick any of the 13 verified portals below (like FPSC, WAPDA, Army, or NTS) or paste your own government PDF link.
                    </p>
                  </div>

                  <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5">
                    <div className="flex items-center space-x-2 text-amber-300 font-bold">
                      <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center text-[11px] font-black border border-amber-500/40">2</span>
                      <span>Click "Scan & Read Jobs"</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Our system reads the file, detects BPS scales, job titles, seat quotas, and deadlines automatically in seconds.
                    </p>
                  </div>

                  <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5">
                    <div className="flex items-center space-x-2 text-emerald-300 font-bold">
                      <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center text-[11px] font-black border border-emerald-500/40">3</span>
                      <span>Approve & Publish</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Quickly review the list of detected jobs and click "Approve" to publish them straight to your public job board.
                    </p>
                  </div>
                </div>
              </div>

              {/* 100+ OFFICIAL PAKISTAN JOB & TESTING PORTALS SECTION */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
                {(() => {
                  const filteredPortals = OFFICIAL_GOVT_SCRAPER_PORTALS.filter((portal) => {
                    const matchesCategory = portalCategoryFilter === 'All' || portal.category === portalCategoryFilter;
                    const matchesJurisdiction = portalJurisdictionFilter === 'All' || portal.jurisdiction === portalJurisdictionFilter;
                    const matchesFormat = portalFormatFilter === 'All' || portal.formatType.toLowerCase().includes(portalFormatFilter.toLowerCase());
                    const q = portalSearchQuery.toLowerCase().trim();
                    const matchesQuery = !q || 
                      portal.name.toLowerCase().includes(q) || 
                      portal.shortName.toLowerCase().includes(q) || 
                      portal.portalUrl.toLowerCase().includes(q) || 
                      portal.organization.toLowerCase().includes(q) ||
                      portal.typicalScales.toLowerCase().includes(q) ||
                      portal.crawlerMethod.toLowerCase().includes(q);
                    return matchesCategory && matchesJurisdiction && matchesFormat && matchesQuery;
                  });

                  return (
                    <>
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                        <div>
                          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                              Verified Official Portals Directory
                            </span>
                            <span className="text-xs text-slate-400 font-mono">
                              Showing <strong className="text-rose-400">{filteredPortals.length}</strong> of {OFFICIAL_GOVT_SCRAPER_PORTALS.length} Portals
                            </span>
                          </div>
                          <h4 className="text-sm font-black uppercase text-white flex items-center space-x-2 mt-1">
                            <Globe className="w-4 h-4 text-rose-400" />
                            <span>Federal, Provincial, Autonomous, Police, Health, Universities & UN Portals</span>
                          </h4>
                          <p className="text-xs text-slate-400">
                            Select any portal to instantly scan, or run a distributed batch crawl across all matching portals in parallel.
                          </p>
                        </div>

                        {/* BULK ACTION BUTTONS */}
                        <div className="flex items-center space-x-2 flex-wrap gap-y-2">
                          <button
                            type="button"
                            onClick={() => setIsBatchIngestModalOpen(true)}
                            className="px-4 py-2 bg-gradient-to-r from-indigo-600 via-purple-600 to-rose-600 hover:from-indigo-500 hover:to-rose-500 text-white font-black text-xs rounded-xl shadow-lg shadow-indigo-500/25 flex items-center space-x-1.5 cursor-pointer transition-all border border-indigo-400/30"
                          >
                            <LinkIcon className="w-4 h-4 text-amber-300" />
                            <span>⚡ Batch Import URLs (Auto-Skip Duplicates)</span>
                          </button>

                          <button
                            type="button"
                            disabled={isBulkCrawlingPortals || filteredPortals.length === 0}
                            onClick={() => handleScrapeMultiplePortals(filteredPortals)}
                            className="px-3.5 py-2 bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-400 hover:to-amber-400 text-white font-black text-xs rounded-xl shadow-lg shadow-rose-500/20 flex items-center space-x-1.5 cursor-pointer disabled:opacity-50 transition-all"
                          >
                            <Sparkles className="w-4 h-4 text-amber-200" />
                            <span>{isBulkCrawlingPortals ? `Crawling (${bulkCrawlProgress}%)...` : `⚡ Crawl All Filtered (${filteredPortals.length}) Portals`}</span>
                          </button>

                          <button
                            type="button"
                            onClick={handleSyncAll13OfficialPortals}
                            className="px-3 py-2 bg-slate-950 hover:bg-slate-800 text-slate-300 text-xs font-bold rounded-xl border border-slate-800 flex items-center space-x-1"
                            title="Reset portal cache"
                          >
                            <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
                            <span>Reset Registry</span>
                          </button>
                        </div>
                      </div>

                      {/* FILTER BAR: SEARCH, SECTOR, JURISDICTION, FORMAT */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1">
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            value={portalSearchQuery}
                            onChange={(e) => setPortalSearchQuery(e.target.value)}
                            placeholder="Search by name, scale, method..."
                            className="w-full pl-8 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 font-medium focus:border-rose-400 outline-none"
                          />
                        </div>

                        <select
                          value={portalCategoryFilter}
                          onChange={(e) => setPortalCategoryFilter(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-bold focus:border-rose-400 outline-none"
                        >
                          <option value="All">All Sectors ({OFFICIAL_GOVT_SCRAPER_PORTALS.length})</option>
                          <option value="National / Federal Portal">National / Federal Portals</option>
                          <option value="Public Service Commission">Public Service Commissions</option>
                          <option value="Defence & Armed Forces">Defence & Armed Forces</option>
                          <option value="Autonomous / Public Sector">Autonomous / Energy / Infrastructure</option>
                          <option value="Provincial Government Portal">Provincial Govt Portals</option>
                          <option value="Law Enforcement & Police">Law Enforcement & Police</option>
                          <option value="Healthcare & Medical Cadres">Healthcare & Medical Cadres</option>
                          <option value="Higher Education & Universities">Higher Education & Universities</option>
                          <option value="Technical Training & Skills">Technical Skills (NAVTTC / TEVTA)</option>
                          <option value="Testing & Assessment Service">Testing Services (NTS / OTS / STS)</option>
                          <option value="International / UN Agencies">International & UN Agencies</option>
                        </select>

                        <select
                          value={portalJurisdictionFilter}
                          onChange={(e) => setPortalJurisdictionFilter(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-bold focus:border-rose-400 outline-none"
                        >
                          <option value="All">All Jurisdictions</option>
                          <option value="Federal">Federal / National</option>
                          <option value="Punjab">Punjab</option>
                          <option value="Sindh">Sindh</option>
                          <option value="Khyber Pakhtunkhwa">Khyber Pakhtunkhwa</option>
                          <option value="Balochistan">Balochistan</option>
                          <option value="Gilgit-Baltistan">Gilgit-Baltistan</option>
                          <option value="Azad Jammu & Kashmir">AJK</option>
                          <option value="International">International</option>
                        </select>

                        <select
                          value={portalFormatFilter}
                          onChange={(e) => setPortalFormatFilter(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-bold focus:border-rose-400 outline-none"
                        >
                          <option value="All">All Ingestion Formats</option>
                          <option value="PDF">📄 PDF Advertisements (pdfplumber)</option>
                          <option value="HTML Table">📊 Structured HTML Tables (BeautifulSoup)</option>
                          <option value="Dynamic JS">⚡ Dynamic JS / REST (Selenium / API)</option>
                          <option value="ASPX">🔒 ASPX Forms (ViewState & PostBack)</option>
                          <option value="UN">🌍 UN / NGO Feeds (REST / JSON)</option>
                        </select>
                      </div>

                      {/* PORTALS CARDS GRID */}
                      {filteredPortals.length === 0 ? (
                        <div className="text-center py-10 bg-slate-950 border border-slate-800 rounded-xl text-slate-400 space-y-2">
                          <Bot className="w-8 h-8 text-slate-600 mx-auto" />
                          <p className="font-bold text-slate-300 text-sm">No scraper portals found matching your filter.</p>
                          <button
                            type="button"
                            onClick={() => {
                              setPortalSearchQuery('');
                              setPortalCategoryFilter('All');
                              setPortalJurisdictionFilter('All');
                              setPortalFormatFilter('All');
                            }}
                            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-xs text-white rounded-lg cursor-pointer"
                          >
                            Reset All Filters
                          </button>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 max-h-[700px] overflow-y-auto pr-1">
                          {filteredPortals.map((portal, pIdx) => {
                            const isPdf = portal.formatType.includes('PDF');
                            const isTable = portal.formatType.includes('HTML Table');
                            const isDynamic = portal.formatType.includes('Dynamic');
                            const isAspx = portal.formatType.includes('ASPX');
                            const isUN = portal.formatType.includes('UN') || portal.formatType.includes('REST');

                            return (
                              <div
                                key={`${portal.id}-${pIdx}`}
                                className="p-4 bg-slate-950/90 border border-slate-800 hover:border-rose-500/50 rounded-2xl flex flex-col justify-between space-y-3 transition-all group shadow-md"
                              >
                                <div className="space-y-2">
                                  {/* TOP BADGES: JURISDICTION, BADGE, SCALES */}
                                  <div className="flex items-center justify-between flex-wrap gap-1">
                                    <div className="flex items-center space-x-1.5">
                                      <span className="px-2 py-0.5 rounded text-[10px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                        {portal.badge}
                                      </span>
                                      <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                                        📍 {portal.jurisdiction}
                                      </span>
                                    </div>
                                    <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                                      {portal.typicalScales}
                                    </span>
                                  </div>

                                  {/* PORTAL TITLE & LINK */}
                                  <div>
                                    <h5 className="font-bold text-white text-sm leading-snug group-hover:text-rose-300 transition-colors">
                                      {portal.name}
                                    </h5>
                                    <a
                                      href={portal.portalUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-xs font-mono text-indigo-400 hover:underline flex items-center space-x-1 mt-0.5 truncate"
                                    >
                                      <span>{portal.portalUrl}</span>
                                      <ExternalLink className="w-3 h-3 text-slate-500 flex-shrink-0" />
                                    </a>
                                  </div>

                                  <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                                    {portal.description}
                                  </p>

                                  {/* FORMAT & CRAWLER METHOD NOTICE */}
                                  <div className="text-[10px] bg-slate-900/90 p-2.5 rounded-xl border border-slate-800 text-slate-300 space-y-1">
                                    <div className="flex items-center justify-between">
                                      <span className="text-slate-500">Format:</span>
                                      <span className={`font-bold px-1.5 py-0.5 rounded text-[9px] ${
                                        isPdf ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
                                        isTable ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                                        isDynamic ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                                        isAspx ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' :
                                        'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                                      }`}>
                                        {portal.formatType}
                                      </span>
                                    </div>
                                    <div className="flex items-start justify-between gap-1">
                                      <span className="text-slate-500 flex-shrink-0">Engine:</span>
                                      <span className="font-mono text-slate-300 text-[10px] text-right truncate">
                                        {portal.crawlerMethod}
                                      </span>
                                    </div>
                                    <div className="flex justify-between pt-0.5 border-t border-slate-800/60">
                                      <span className="text-slate-500">Sample Notice:</span>
                                      <span className="font-mono text-slate-300 font-bold">{portal.sampleAdvtNo}</span>
                                    </div>
                                  </div>
                                </div>

                                {/* ACTION BUTTONS */}
                                <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleFillPortalPreset(portal)}
                                    className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-amber-200 text-[11px] font-bold rounded-lg border border-slate-700 cursor-pointer flex items-center space-x-1 transition-all"
                                    title="Fill details in the custom form below"
                                  >
                                    <BookmarkPlus className="w-3 h-3 text-amber-400" />
                                    <span>Fill Form</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleLaunchPortalDirectly(portal)}
                                    className="px-3 py-1.5 bg-rose-500 hover:bg-rose-400 text-white text-[11px] font-black rounded-lg shadow-md shadow-rose-500/20 cursor-pointer flex items-center space-x-1 transition-all"
                                  >
                                    <Sparkles className="w-3 h-3 text-amber-300" />
                                    <span>Scan & Read Jobs</span>
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>

              {/* MANUAL SITE ENTRY CARD WITH QUICK PRESET CHIPS */}
              <div className="bg-slate-900 border border-rose-500/30 rounded-2xl p-5 space-y-4 shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                  <div>
                    <h4 className="text-sm font-black uppercase text-rose-300 flex items-center space-x-2">
                      <BookmarkPlus className="w-4 h-4 text-rose-400" />
                      <span>Add Any Custom Government Website or PDF File</span>
                    </h4>
                    <p className="text-xs text-slate-400">
                      Enter any Pakistani Government Department or PDF Gazette link to scan it, or open the Batch Ingestion Engine to add multiple links with auto-duplicate filtering.
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => setIsBatchIngestModalOpen(true)}
                      className="px-3 py-1.5 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 text-xs font-black rounded-xl transition-all flex items-center space-x-1.5 cursor-pointer shadow-sm"
                    >
                      <LinkIcon className="w-3.5 h-3.5 text-amber-300" />
                      <span>Bulk Ingest Links (Zero Duplicates)</span>
                    </button>
                    <span className="text-[10px] font-mono bg-slate-950 px-2.5 py-1.5 rounded-lg text-slate-400 border border-slate-800 self-start sm:self-auto">
                      Auto-Reads Job Openings
                    </span>
                  </div>
                </div>

                {/* QUICK PRESET CHIPS */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-400">Quick Portal Fill Buttons:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {OFFICIAL_GOVT_SCRAPER_PORTALS.map((portal, pIdx) => (
                      <button
                        key={`${portal.id}-${pIdx}`}
                        type="button"
                        onClick={() => handleFillPortalPreset(portal)}
                        className="px-2.5 py-1 bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white text-[11px] font-bold rounded-lg border border-slate-800 cursor-pointer transition-all flex items-center space-x-1"
                      >
                        <span>{portal.shortName}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <form className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-3 text-xs pt-1">
                  <div className="lg:col-span-4 space-y-1">
                    <label className="block font-bold text-slate-300">Job Notice / Advertisement Title *</label>
                    <input
                      type="text"
                      required
                      value={pdfManualTitle}
                      onChange={(e) => setPdfManualTitle(e.target.value)}
                      placeholder="e.g. SPSC Consolidated Recruitment Advt No. 04/2026"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 font-medium focus:border-rose-400 outline-none"
                    />
                  </div>

                  <div className="lg:col-span-4 space-y-1">
                    <label className="block font-bold text-slate-300">Department or Commission Name *</label>
                    <input
                      type="text"
                      required
                      value={pdfManualOrg}
                      onChange={(e) => setPdfManualOrg(e.target.value)}
                      placeholder="e.g. Sindh Public Service Commission (SPSC)"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 font-medium focus:border-rose-400 outline-none"
                    />
                  </div>

                  <div className="lg:col-span-4 space-y-1">
                    <label className="block font-bold text-slate-300">Notice Issue Number (Optional)</label>
                    <input
                      type="text"
                      value={pdfManualIssueNo}
                      onChange={(e) => setPdfManualIssueNo(e.target.value)}
                      placeholder="e.g. Advt. No. 04/2026"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 font-medium focus:border-rose-400 outline-none"
                    />
                  </div>

                  <div className="lg:col-span-6 space-y-1">
                    <label className="block font-bold text-slate-300">Official Website or PDF Link *</label>
                    <input
                      type="url"
                      required
                      value={pdfManualUrl}
                      onChange={(e) => setPdfManualUrl(e.target.value)}
                      placeholder="https://spsc.gos.pk/advertisements/Advt_No_04_2026.pdf"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono placeholder-slate-500 focus:border-rose-400 outline-none"
                    />
                  </div>

                  <div className="lg:col-span-3 space-y-1">
                    <label className="block font-bold text-slate-300">Last Date to Apply</label>
                    <input
                      type="text"
                      value={pdfManualDeadline}
                      onChange={(e) => setPdfManualDeadline(e.target.value)}
                      placeholder="e.g. 20th November 2026"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 font-medium focus:border-rose-400 outline-none"
                    />
                  </div>

                  <div className="lg:col-span-3 space-y-1">
                    <label className="block font-bold text-slate-300">Document Size</label>
                    <select
                      value={pdfManualPages}
                      onChange={(e) => setPdfManualPages(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-bold focus:border-rose-400 outline-none"
                    >
                      <option value={2}>2 Pages (Short Notice)</option>
                      <option value={4}>4 Pages (Standard Gazette)</option>
                      <option value={8}>8 Pages (Consolidated Mega Advt)</option>
                      <option value={16}>16+ Pages (Annual Federal Gazette)</option>
                    </select>
                  </div>

                  <div className="lg:col-span-12 flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={(e) => handleCreatePdfSiteFromScraperTab(e, false)}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 cursor-pointer flex items-center space-x-1.5"
                    >
                      <BookmarkPlus className="w-3 h-3 text-rose-400" />
                      <span>Save for Later</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => handleCreatePdfSiteFromScraperTab(e, true)}
                      className="px-5 py-2 bg-rose-500 hover:bg-rose-400 text-white text-xs font-black rounded-xl shadow-lg shadow-rose-500/20 cursor-pointer flex items-center space-x-1.5"
                    >
                      <Sparkles className="w-3 h-3 text-amber-300" />
                      <span>Save & Read Jobs Now</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* GAZETTE SOURCES GRID */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-black uppercase text-white flex items-center space-x-2">
                    <Layers className="w-4 h-4 text-rose-400" />
                    <span>Registered PDF Gazette Sources ({pdfGazettes.length})</span>
                  </h4>
                  <span className="text-xs text-slate-400">
                    Total Detected Vacancies: <strong className="text-emerald-400">{pdfGazettes.reduce((acc, curr) => acc + (curr.extractedVacancies?.length || 0), 0)} positions</strong>
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {pdfGazettes.map((gazette, gIdx) => {
                    const isCustom = gazette.id.startsWith('pdf-gazette-custom');
                    return (
                      <div
                        key={`${gazette.id}-${gIdx}`}
                        className="p-5 bg-slate-900 border border-slate-800 hover:border-rose-500/40 rounded-2xl space-y-4 transition-all shadow-lg flex flex-col justify-between"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/30 uppercase">
                                {gazette.organization}
                              </span>
                              {isCustom && (
                                <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                  Manually Added
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                              {gazette.fileSizeFormatted} • {gazette.totalPages} Pages
                            </span>
                          </div>

                          <h4 className="text-sm font-bold text-white leading-snug">{gazette.title}</h4>

                          <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                            <div>
                              <span className="text-slate-500 block">Gazette Issue:</span>
                              <span className="text-slate-200 font-mono font-bold">{gazette.gazetteIssueNumber}</span>
                            </div>
                            <div>
                              <span className="text-slate-500 block">Closing Deadline:</span>
                              <span className="text-rose-300 font-bold">{gazette.closingDeadline}</span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-xs pt-1">
                            <span className="text-emerald-400 font-bold flex items-center space-x-1">
                              <span>✨</span>
                              <span>{gazette.extractedVacancies?.length || 0} Vacancies Ready for Extraction</span>
                            </span>
                            <span className="text-slate-500 font-mono text-[11px] truncate max-w-[150px]">
                              {gazette.pdfFileName}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t border-slate-800/80 gap-2">
                          <a
                            href={gazette.pdfUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3 py-1.5 bg-slate-950 hover:bg-slate-800 text-slate-300 text-xs font-bold rounded-xl border border-slate-800 flex items-center space-x-1.5 transition-all"
                          >
                            <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                            <span>View PDF Link</span>
                          </a>

                          <div className="flex items-center space-x-2">
                            {isCustom && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (confirm(`Remove "${gazette.title}" from PDF sources?`)) {
                                    handleDeletePdfGazette(gazette.id);
                                  }
                                }}
                                className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl cursor-pointer"
                                title="Delete custom gazette"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => {
                                setActiveSelectedPdfGazetteId(gazette.id);
                                setIsPdfScraperModalOpen(true);
                              }}
                              className="px-3.5 py-1.5 bg-rose-500 hover:bg-rose-400 text-white text-xs font-black rounded-xl shadow-md shadow-rose-500/20 flex items-center space-x-1.5 cursor-pointer transition-all"
                            >
                              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                              <span>Launch Parser</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* SUB-TAB 3: INGESTED SCRAPED JOBS FEED ("Which jobs are coming from where") */}
          {scraperSubTab === 'inspect-feed' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-800 pb-3">
                <div>
                  <h4 className="text-sm font-black uppercase text-amber-300 flex items-center space-x-2">
                    <FileText className="w-4 h-4 text-amber-400" />
                    <span>Ingested Scraped Jobs Inspector & Origin Tracker</span>
                  </h4>
                  <p className="text-xs text-slate-400">
                    Detailed origin tracking showing which jobs were ingested from which automated sources, their extracted details, and instant admin verification actions.
                  </p>
                </div>

                {/* SOURCE FILTER & SEARCH */}
                <div className="flex items-center space-x-2 w-full sm:w-auto">
                  <input
                    type="text"
                    value={scrapedSearchQuery}
                    onChange={(e) => setScrapedSearchQuery(e.target.value)}
                    placeholder="Search scraped jobs..."
                    className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                  />
                  <select
                    value={scrapedSourceFilter}
                    onChange={(e) => setScrapedSourceFilter(e.target.value)}
                    className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-bold"
                  >
                    <option value="all">All Source Feeds</option>
                    <option value="rozee">Rozee.pk Feeds</option>
                    <option value="fpsc">FPSC / Govt Sector Feeds</option>
                    <option value="jang">Daily Jang Newspaper Classifieds</option>
                    <option value="linkedin">LinkedIn Remote Feeds</option>
                    <option value="gulftalent">GulfTalent Feeds</option>
                  </select>
                </div>
              </div>

              {/* SCRAPED JOBS GRID */}
              {(() => {
                const combinedMap = new Map<string, Job>();
                [...jobs, ...pendingJobs].forEach(j => {
                  if (j && j.id) combinedMap.set(j.id, j);
                });
                const combined = Array.from(combinedMap.values());
                const scrapedJobs = combined.filter(j => 
                  j.sourceUrl || 
                  j.scraperSourceId ||
                  j.scrapedSourceDomain ||
                  (j.tags && j.tags.some(t => t.toLowerCase().includes('scraped'))) || 
                  j.title.includes('AI Scraped') || 
                  j.id.includes('scraped') ||
                  j.id.includes('sc1') ||
                  j.id.includes('sc2') ||
                  j.id.includes('sc3') ||
                  j.id.includes('sc4') ||
                  j.id.includes('sc5')
                ).filter(j => {
                  if (scrapedSourceFilter !== 'all') {
                    const q = scrapedSourceFilter.toLowerCase();
                    const src = (j.sourceUrl || '').toLowerCase();
                    const company = (j.company || '').toLowerCase();
                    const title = (j.title || '').toLowerCase();
                    if (!src.includes(q) && !company.includes(q) && !title.includes(q)) return false;
                  }
                  if (scrapedSearchQuery.trim()) {
                    const sq = scrapedSearchQuery.toLowerCase();
                    return j.title.toLowerCase().includes(sq) || j.company.toLowerCase().includes(sq) || (j.sourceUrl || '').toLowerCase().includes(sq);
                  }
                  return true;
                });

                if (scrapedJobs.length === 0) {
                  return (
                    <div className="text-center py-12 bg-slate-950 border border-slate-800 rounded-xl text-slate-400 space-y-2">
                      <Bot className="w-8 h-8 text-slate-600 mx-auto" />
                      <p className="font-bold text-slate-300 text-sm">No Scraped Jobs Found matching your filter.</p>
                      <p className="text-xs text-slate-500">Run the scraper on-demand or configure a new source portal above!</p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-3">
                    {scrapedJobs.map((job) => {
                      const isPending = job.status === 'Pending';
                      let originDomain = job.scrapedSourceDomain || 'Automated Scraper';
                      if (!job.scrapedSourceDomain && job.sourceUrl) {
                        try {
                          originDomain = new URL(job.sourceUrl.startsWith('http') ? job.sourceUrl : 'https://' + job.sourceUrl).hostname;
                        } catch (e) {
                          originDomain = job.sourceUrl;
                        }
                      }

                      const displayTime = job.scrapedTime || job.scrapedAt || 'Recent scrape';
                      const categoryLabel = job.jobCategory || (job.isGovtJob ? 'Government Sector' : job.isNewspaperAd ? 'Newspaper Classified' : 'Private Corporate');

                      return (
                        <div key={job.id} className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3 hover:border-slate-700 transition-all">
                          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">
                            <div className="space-y-1">
                              {/* SOURCE ORIGIN, CATEGORY, & SCRAPED TIMESTAMP BADGES */}
                              <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                                <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center space-x-1">
                                  <Globe className="w-3 h-3 text-indigo-400" />
                                  <span>SOURCE: {originDomain}</span>
                                </span>

                                <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                  📂 {categoryLabel}
                                </span>

                                <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700 flex items-center space-x-1">
                                  <Clock className="w-3 h-3 text-amber-400" />
                                  <span>Scraped: {displayTime}</span>
                                </span>

                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                  isPending ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                }`}>
                                  {isPending ? '⏳ Pending Approval' : '✅ Live Listing'}
                                </span>

                                {job.isGovtJob && (
                                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                    🏛️ Govt Scale: {job.govtScale || 'BPS Scale'}
                                  </span>
                                )}
                                {job.isNewspaperAd && (
                                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30">
                                    📰 Newspaper: {job.newspaperName || 'Daily Jang'}
                                  </span>
                                )}
                              </div>

                              <h5 className="font-black text-white text-base flex items-center space-x-2">
                                <span>{job.title}</span>
                              </h5>
                              <p className="text-xs text-slate-300 font-medium">
                                <span className="text-indigo-400 font-bold">{job.company}</span> • 📍 {job.city ? `${job.city}, ${job.province || ''}` : job.region} • 💰 {job.salary}
                              </p>
                            </div>

                            {/* ACTIONS */}
                            <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                              <button
                                onClick={() => setSelectedJobForModal(job)}
                                className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 text-xs font-bold border border-amber-500/30 flex items-center space-x-1 cursor-pointer transition-all"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Details & Audit</span>
                              </button>

                              {job.sourceUrl && (
                                <a
                                  href={job.sourceUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 flex items-center space-x-1"
                                >
                                  <span>View Source Page</span>
                                </a>
                              )}

                              {isPending && (
                                <button
                                  onClick={() => onApproveJob(job.id)}
                                  className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-lg shadow-emerald-500/20 cursor-pointer"
                                >
                                  Approve & Publish
                                </button>
                              )}

                              {isPending && (
                                <button
                                  onClick={() => handleRejectPrompt(job.id)}
                                  className="px-3 py-1.5 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500 hover:text-white text-xs font-bold cursor-pointer"
                                >
                                  Reject
                                </button>
                              )}

                              <button
                                onClick={() => onDeleteJob(job.id)}
                                className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg cursor-pointer"
                                title="Delete job"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {/* JOB DESCRIPTION & REQUIREMENTS PREVIEW */}
                          <div className="space-y-2 pt-1 border-t border-slate-900">
                            <div className="text-xs text-slate-300 bg-slate-900/60 p-3 rounded-lg border border-slate-800/80">
                              <span className="font-bold text-slate-400 text-[11px] block mb-1">Extracted Job Description:</span>
                              <p className="line-clamp-3 leading-relaxed">{job.description}</p>
                            </div>

                            {job.requirements && job.requirements.length > 0 && (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[10px] font-bold text-slate-400">Requirements:</span>
                                {job.requirements.slice(0, 3).map((req, idx) => (
                                  <span key={idx} className="px-2 py-0.5 bg-slate-900 border border-slate-800 text-slate-300 text-[10px] rounded-md">
                                    • {req}
                                  </span>
                                ))}
                                {job.requirements.length > 3 && (
                                  <span className="text-[10px] text-indigo-400 font-bold">+{job.requirements.length - 3} more</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}

          {/* SUB-TAB 4: AUDIT LOG & SCHEDULER TERMINAL */}
          {scraperSubTab === 'logs' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3 shadow-xl">
              <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                <h4 className="text-xs font-bold uppercase text-slate-300 flex items-center space-x-2">
                  <Bot className="w-4 h-4 text-emerald-400" />
                  <span>Real-time Cron Terminal & Extraction Logs</span>
                </h4>
                <button
                  onClick={() => setScraperLogs([])}
                  className="text-[11px] font-bold text-slate-400 hover:text-white cursor-pointer"
                >
                  Clear Logs
                </button>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 h-64 overflow-y-auto font-mono text-[11px] text-slate-300 space-y-1.5">
                {scraperLogs.length === 0 ? (
                  <div className="text-slate-600 text-center py-8">No terminal logs recorded yet.</div>
                ) : (
                  scraperLogs.map((log, i) => (
                    <div key={i} className="text-emerald-400 flex items-start space-x-2">
                      <span className="text-slate-600 font-bold">&gt;</span>
                      <span>{log}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

        </div>
      )}

      {/* TAB 5: USER CHAT HUB */}
      {adminTab === 'chat-hub' && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white shadow-2xl">
          <div className="md:col-span-4 border-r border-slate-800 pr-4 space-y-3">
            <h4 className="text-xs font-bold uppercase text-slate-400">Active User Threads</h4>
            <div className="space-y-1">
              {users.map((u) => (
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
                    <div className="font-bold">{u.name}</div>
                    <div className="text-[10px] opacity-75">{u.email}</div>
                  </div>
                  <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-800 text-amber-300">
                    {u.role.split(' ')[0]}
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
      {adminTab === 'form-customizer' && (
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
      {adminTab === 'add-job' && (
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
            className="w-full py-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm shadow-xl shadow-amber-500/20 cursor-pointer flex items-center justify-center space-x-2"
          >
            <Send className="w-4 h-4 text-slate-950" />
            <span>Publish Job Directly to Live Portal</span>
          </button>
        </form>
      )}

      {/* TAB 8: LIVE LISTINGS */}
      {adminTab === 'jobs' && (() => {
        const liveJobClusters = computeJobDuplicateClusters(jobs);

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

          if (showJobsDuplicatesOnly) {
            const isDup = liveJobClusters.some(c => c.items.some(it => it.id === job.id));
            if (!isDup) return false;
          }

          return true;
        }).sort((a, b) => {
          if (jobsSortBy === 'newest') {
            return new Date(b.postedAt || 0).getTime() - new Date(a.postedAt || 0).getTime();
          }
          if (jobsSortBy === 'oldest') {
            return new Date(a.postedAt || 0).getTime() - new Date(b.postedAt || 0).getTime();
          }
          if (jobsSortBy === 'title') {
            return (a.title || '').localeCompare(b.title || '');
          }
          return 0;
        });

        const allSelected = filteredLiveJobs.length > 0 && filteredLiveJobs.every(j => selectedJobIds.includes(j.id));

        const handleSelectAllLiveJobs = () => {
          if (allSelected) {
            setSelectedJobIds(prev => prev.filter(id => !filteredLiveJobs.some(j => j.id === id)));
          } else {
            const toAdd = filteredLiveJobs.map(j => j.id);
            setSelectedJobIds(prev => Array.from(new Set([...prev, ...toAdd])));
          }
        };

        const toggleLiveJobSelection = (id: string) => {
          setSelectedJobIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
          );
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
                  </select>

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
                <div className="flex items-center space-x-3">
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
                <p className="font-bold text-slate-300">No active live jobs match your current search and filter criteria.</p>
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
      {adminTab === 'subscribers' && (() => {
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

      {/* TAB 10: SETTINGS (MONTHLY SUBSCRIPTION & PER-JOB POSTING FEE) */}
      {adminTab === 'settings' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-white">
          
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white space-y-4 shadow-xl">
            <h3 className="text-base font-bold border-b border-slate-800 pb-2 flex items-center space-x-2">
              <DollarSign className="w-5 h-5 text-emerald-400" />
              <span>User Monthly Subscription Fee</span>
            </h3>
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1">Monthly Subscription Fee (PKR)</label>
              <input
                type="number"
                value={monthlyFeePkr}
                onChange={(e) => onChangeMonthlyFee(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm font-bold"
              />
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Sets the cost of monthly pro access for job alert notifications and portal tools.
            </p>
          </div>

          {/* PER-JOB POSTING & PRIORITY PLACEMENT FEE CONTROLLER */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white space-y-4 shadow-xl">
            <h3 className="text-base font-bold border-b border-slate-800 pb-2 flex items-center justify-between">
              <span className="flex items-center space-x-2">
                <Receipt className="w-5 h-5 text-amber-400" />
                <span>Base Per-Job Posting Fee</span>
              </span>
              <span className="text-[10px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold">
                {jobPostingPricing.standardFeePkr > 0 ? `PKR ${jobPostingPricing.standardFeePkr.toLocaleString()}` : 'Free'}
              </span>
            </h3>
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1">Standard Job Posting Fee (PKR) [Set to 0 for Free]</label>
              <input
                type="number"
                value={jobPostingPricing.standardFeePkr}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  onChangeJobPostingFee(val);
                  if (onChangeJobPostingPricing) {
                    onChangeJobPostingPricing({
                      ...jobPostingPricing,
                      standardFeePkr: val
                    });
                  }
                }}
                placeholder="1000"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm font-bold focus:border-amber-400 outline-none"
              />
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              When set &gt; 0, employers posting regular standard jobs will be invoiced PKR {jobPostingPricing.standardFeePkr.toLocaleString()} before their job listing is reviewed and published.
            </p>
          </div>

          {/* PRIORITY PLACEMENT & URGENT / FUTURE JOB FEES CONFIGURATION */}
          <div className="md:col-span-2 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/40 border border-indigo-500/40 rounded-2xl p-6 text-white space-y-6 shadow-2xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Priority Monetization & Tier Placements
                  </span>
                  <span className="text-xs text-slate-400 font-mono">Live Pricing & Duration Engine</span>
                </div>
                <h3 className="text-lg font-black text-white flex items-center space-x-2 mt-1">
                  <Sparkles className="w-5 h-5 text-amber-400" />
                  <span>Job Feature Toggles, Rates & Duration Customization</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Enable or disable any job placement tier, set custom rates (PKR), define listing duration (Days) shown to employers, and customize badge labels and descriptions.
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    if (onChangeJobPostingPricing) {
                      onChangeJobPostingPricing(DEFAULT_JOB_POSTING_PRICING_CONFIG);
                    }
                    onChangeJobPostingFee(DEFAULT_JOB_POSTING_PRICING_CONFIG.standardFeePkr);
                  }}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl border border-slate-700 cursor-pointer transition-all"
                >
                  Reset Defaults
                </button>
              </div>
            </div>

            {/* 5 TIER FEE CONTROLS GRID WITH ENABLE/DISABLE & DURATION CONTROLS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 text-xs">
              
              {/* TIER 1: STANDARD LISTING */}
              <div className={`p-4 bg-slate-950/80 border rounded-2xl space-y-3 shadow-md transition-all ${
                jobPostingPricing.enableStandard !== false ? 'border-slate-700' : 'border-slate-800 opacity-60'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded text-[10px] font-black bg-slate-800 text-slate-300 border border-slate-700">
                    🏢 Standard Post
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (onChangeJobPostingPricing) {
                        onChangeJobPostingPricing({
                          ...jobPostingPricing,
                          enableStandard: !(jobPostingPricing.enableStandard !== false)
                        });
                      }
                    }}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold cursor-pointer transition-all ${
                      jobPostingPricing.enableStandard !== false
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                    }`}
                  >
                    {jobPostingPricing.enableStandard !== false ? '✓ Enabled' : '✕ Disabled'}
                  </button>
                </div>

                <div>
                  <div className="font-bold text-white text-sm">Standard Listing</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Regular chronological placement</div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">Base Fee (PKR) [0 = Free]</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-xs">PKR</span>
                    <input
                      type="number"
                      value={jobPostingPricing.standardFeePkr}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        onChangeJobPostingFee(val);
                        if (onChangeJobPostingPricing) {
                          onChangeJobPostingPricing({
                            ...jobPostingPricing,
                            standardFeePkr: val
                          });
                        }
                      }}
                      className="w-full pl-11 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-white font-bold font-mono focus:border-amber-400 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">Display Duration (Days)</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={jobPostingPricing.standardDurationDays ?? 30}
                      onChange={(e) => {
                        if (onChangeJobPostingPricing) {
                          onChangeJobPostingPricing({
                            ...jobPostingPricing,
                            standardDurationDays: Number(e.target.value)
                          });
                        }
                      }}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono focus:border-amber-400 outline-none"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-[10px]">Days</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">Description for Users</label>
                  <input
                    type="text"
                    value={jobPostingPricing.standardDescription || 'Standard chronological listing on public board.'}
                    onChange={(e) => {
                      if (onChangeJobPostingPricing) {
                        onChangeJobPostingPricing({
                          ...jobPostingPricing,
                          standardDescription: e.target.value
                        });
                      }
                    }}
                    className="w-full px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-lg text-slate-300 text-[11px] outline-none"
                  />
                </div>
              </div>

              {/* TIER 2: URGENT HIRING */}
              <div className={`p-4 bg-slate-950/80 border rounded-2xl space-y-3 shadow-md transition-all ${
                jobPostingPricing.enableUrgent !== false ? 'border-rose-500/30' : 'border-slate-800 opacity-60'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded text-[10px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    🔥 Urgent Hiring
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (onChangeJobPostingPricing) {
                        onChangeJobPostingPricing({
                          ...jobPostingPricing,
                          enableUrgent: !(jobPostingPricing.enableUrgent !== false)
                        });
                      }
                    }}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold cursor-pointer transition-all ${
                      jobPostingPricing.enableUrgent !== false
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                    }`}
                  >
                    {jobPostingPricing.enableUrgent !== false ? '✓ Enabled' : '✕ Disabled'}
                  </button>
                </div>

                <div>
                  <div className="font-bold text-white text-sm">Urgent Placement Fee</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Flashing badge & ranks above regular jobs</div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">Fee Surcharge (PKR)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-xs">PKR</span>
                    <input
                      type="number"
                      value={jobPostingPricing.urgentFeePkr}
                      onChange={(e) => {
                        if (onChangeJobPostingPricing) {
                          onChangeJobPostingPricing({
                            ...jobPostingPricing,
                            urgentFeePkr: Number(e.target.value)
                          });
                        }
                      }}
                      className="w-full pl-11 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-rose-300 font-bold font-mono focus:border-rose-400 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">Display Duration (Days)</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={jobPostingPricing.urgentDurationDays ?? 15}
                      onChange={(e) => {
                        if (onChangeJobPostingPricing) {
                          onChangeJobPostingPricing({
                            ...jobPostingPricing,
                            urgentDurationDays: Number(e.target.value)
                          });
                        }
                      }}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-rose-300 font-mono focus:border-rose-400 outline-none"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-[10px]">Days</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">Badge Text</label>
                  <input
                    type="text"
                    value={jobPostingPricing.urgentBadgeText || '🔥 Urgent Hiring'}
                    onChange={(e) => {
                      if (onChangeJobPostingPricing) {
                        onChangeJobPostingPricing({
                          ...jobPostingPricing,
                          urgentBadgeText: e.target.value
                        });
                      }
                    }}
                    className="w-full px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-lg text-rose-300 text-[11px] outline-none"
                  />
                </div>

                <div className="text-[11px] bg-slate-900/90 p-2 rounded-xl border border-slate-800 text-slate-300">
                  Total: <strong className="text-white font-mono">PKR {(jobPostingPricing.standardFeePkr + jobPostingPricing.urgentFeePkr).toLocaleString()}</strong>
                </div>
              </div>

              {/* TIER 3: FEATURED & PINNED TOP */}
              <div className={`p-4 bg-slate-950/80 border rounded-2xl space-y-3 shadow-md transition-all ${
                jobPostingPricing.enableFeaturedTop !== false ? 'border-amber-500/30' : 'border-slate-800 opacity-60'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    ⭐ Featured Top
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (onChangeJobPostingPricing) {
                        onChangeJobPostingPricing({
                          ...jobPostingPricing,
                          enableFeaturedTop: !(jobPostingPricing.enableFeaturedTop !== false)
                        });
                      }
                    }}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold cursor-pointer transition-all ${
                      jobPostingPricing.enableFeaturedTop !== false
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                    }`}
                  >
                    {jobPostingPricing.enableFeaturedTop !== false ? '✓ Enabled' : '✕ Disabled'}
                  </button>
                </div>

                <div>
                  <div className="font-bold text-white text-sm">Pinned Top Placement Fee</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Locks position at top of search & cards</div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">Fee Surcharge (PKR)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-xs">PKR</span>
                    <input
                      type="number"
                      value={jobPostingPricing.featuredTopFeePkr}
                      onChange={(e) => {
                        if (onChangeJobPostingPricing) {
                          onChangeJobPostingPricing({
                            ...jobPostingPricing,
                            featuredTopFeePkr: Number(e.target.value)
                          });
                        }
                      }}
                      className="w-full pl-11 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-amber-300 font-bold font-mono focus:border-amber-400 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">Display Duration (Days)</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={jobPostingPricing.featuredTopDurationDays ?? 30}
                      onChange={(e) => {
                        if (onChangeJobPostingPricing) {
                          onChangeJobPostingPricing({
                            ...jobPostingPricing,
                            featuredTopDurationDays: Number(e.target.value)
                          });
                        }
                      }}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-amber-300 font-mono focus:border-amber-400 outline-none"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-[10px]">Days</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">Badge Text</label>
                  <input
                    type="text"
                    value={jobPostingPricing.featuredBadgeText || '⭐ Pinned Top & Featured'}
                    onChange={(e) => {
                      if (onChangeJobPostingPricing) {
                        onChangeJobPostingPricing({
                          ...jobPostingPricing,
                          featuredBadgeText: e.target.value
                        });
                      }
                    }}
                    className="w-full px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-lg text-amber-300 text-[11px] outline-none"
                  />
                </div>

                <div className="text-[11px] bg-slate-900/90 p-2 rounded-xl border border-slate-800 text-slate-300">
                  Total: <strong className="text-white font-mono">PKR {(jobPostingPricing.standardFeePkr + jobPostingPricing.featuredTopFeePkr).toLocaleString()}</strong>
                </div>
              </div>

              {/* TIER 4: FUTURE JOB / ADVANCE INTAKE */}
              <div className={`p-4 bg-slate-950/80 border rounded-2xl space-y-3 shadow-md transition-all ${
                jobPostingPricing.enableFutureJob !== false ? 'border-indigo-500/30' : 'border-slate-800 opacity-60'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded text-[10px] font-black bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    🚀 Future Intake
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (onChangeJobPostingPricing) {
                        onChangeJobPostingPricing({
                          ...jobPostingPricing,
                          enableFutureJob: !(jobPostingPricing.enableFutureJob !== false)
                        });
                      }
                    }}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold cursor-pointer transition-all ${
                      jobPostingPricing.enableFutureJob !== false
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                    }`}
                  >
                    {jobPostingPricing.enableFutureJob !== false ? '✓ Enabled' : '✕ Disabled'}
                  </button>
                </div>

                <div>
                  <div className="font-bold text-white text-sm">Future Intake Placement</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Collect pre-registrations ahead of intake</div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">Fee Surcharge (PKR)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-xs">PKR</span>
                    <input
                      type="number"
                      value={jobPostingPricing.futureJobFeePkr}
                      onChange={(e) => {
                        if (onChangeJobPostingPricing) {
                          onChangeJobPostingPricing({
                            ...jobPostingPricing,
                            futureJobFeePkr: Number(e.target.value)
                          });
                        }
                      }}
                      className="w-full pl-11 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-indigo-300 font-bold font-mono focus:border-indigo-400 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">Display Duration (Days)</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={jobPostingPricing.futureJobDurationDays ?? 60}
                      onChange={(e) => {
                        if (onChangeJobPostingPricing) {
                          onChangeJobPostingPricing({
                            ...jobPostingPricing,
                            futureJobDurationDays: Number(e.target.value)
                          });
                        }
                      }}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-indigo-300 font-mono focus:border-indigo-400 outline-none"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-[10px]">Days</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">Badge Text</label>
                  <input
                    type="text"
                    value={jobPostingPricing.futureBadgeText || '🚀 Advance Intake'}
                    onChange={(e) => {
                      if (onChangeJobPostingPricing) {
                        onChangeJobPostingPricing({
                          ...jobPostingPricing,
                          futureBadgeText: e.target.value
                        });
                      }
                    }}
                    className="w-full px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-lg text-indigo-300 text-[11px] outline-none"
                  />
                </div>

                <div className="text-[11px] bg-slate-900/90 p-2 rounded-xl border border-slate-800 text-slate-300">
                  Total: <strong className="text-white font-mono">PKR {(jobPostingPricing.standardFeePkr + jobPostingPricing.futureJobFeePkr).toLocaleString()}</strong>
                </div>
              </div>

              {/* TIER 5: VIP ALL-IN-ONE BUNDLE */}
              <div className={`p-4 bg-slate-950/80 border rounded-2xl space-y-3 shadow-md transition-all ${
                jobPostingPricing.enableVipBundle !== false ? 'border-purple-500/30' : 'border-slate-800 opacity-60'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded text-[10px] font-black bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    👑 VIP Power Bundle
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (onChangeJobPostingPricing) {
                        onChangeJobPostingPricing({
                          ...jobPostingPricing,
                          enableVipBundle: !(jobPostingPricing.enableVipBundle !== false)
                        });
                      }
                    }}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold cursor-pointer transition-all ${
                      jobPostingPricing.enableVipBundle !== false
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                    }`}
                  >
                    {jobPostingPricing.enableVipBundle !== false ? '✓ Enabled' : '✕ Disabled'}
                  </button>
                </div>

                <div>
                  <div className="font-bold text-white text-sm">VIP Power Package</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Top Pinned + Urgent + Featured + Future Tag</div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">Flat Price (PKR)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-xs">PKR</span>
                    <input
                      type="number"
                      value={jobPostingPricing.vipBundleFeePkr}
                      onChange={(e) => {
                        if (onChangeJobPostingPricing) {
                          onChangeJobPostingPricing({
                            ...jobPostingPricing,
                            vipBundleFeePkr: Number(e.target.value)
                          });
                        }
                      }}
                      className="w-full pl-11 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-purple-300 font-bold font-mono focus:border-purple-400 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">Display Duration (Days)</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={jobPostingPricing.vipBundleDurationDays ?? 45}
                      onChange={(e) => {
                        if (onChangeJobPostingPricing) {
                          onChangeJobPostingPricing({
                            ...jobPostingPricing,
                            vipBundleDurationDays: Number(e.target.value)
                          });
                        }
                      }}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-purple-300 font-mono focus:border-purple-400 outline-none"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-[10px]">Days</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">Badge Text</label>
                  <input
                    type="text"
                    value={jobPostingPricing.vipBadgeText || '👑 VIP Ultimate Placement'}
                    onChange={(e) => {
                      if (onChangeJobPostingPricing) {
                        onChangeJobPostingPricing({
                          ...jobPostingPricing,
                          vipBadgeText: e.target.value
                        });
                      }
                    }}
                    className="w-full px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-lg text-purple-300 text-[11px] outline-none"
                  />
                </div>

                <div className="text-[11px] bg-slate-900/90 p-2 rounded-xl border border-slate-800 text-slate-300">
                  Flat Price: <strong className="text-purple-300 font-mono font-bold">PKR {jobPostingPricing.vipBundleFeePkr.toLocaleString()}</strong>
                </div>
              </div>

            </div>

            {/* LIVE PRIORITY RANKING EXPLANATION */}
            <div className="p-4 bg-slate-950/90 border border-slate-800 rounded-xl space-y-2 text-xs">
              <div className="font-bold text-white flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>How the Priority Algorithm Sorts Jobs on the Public Board:</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-[11px] text-slate-300">
                <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800">
                  <strong className="text-purple-300 block mb-1">1st: VIP & Pinned Top</strong>
                  Jobs with Pinned Top & VIP bundle always display first above all listings.
                </div>
                <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800">
                  <strong className="text-amber-300 block mb-1">2nd: Featured Posts</strong>
                  Highlighted in warm gold border and displayed right after top pinned jobs.
                </div>
                <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800">
                  <strong className="text-rose-300 block mb-1">3rd: Urgent Hiring</strong>
                  Shows blinking fire badge and sits ahead of general regular listings.
                </div>
                <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800">
                  <strong className="text-indigo-300 block mb-1">4th: Future & Standard</strong>
                  Future jobs show advance countdown; standard listings sort by recency.
                </div>
              </div>
            </div>
          </div>

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

            </div>
          </div>

        </div>
      )}

      {/* USER AUDIT DETAILED CONTROL MODAL */}
      {auditUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 space-y-6 text-white shadow-2xl relative max-h-[90vh] overflow-y-auto">
            
            <button
              onClick={() => setAuditUser(null)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-4 border-b border-slate-800 pb-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-emerald-500 p-0.5 flex items-center justify-center">
                <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center font-black text-xl text-amber-400">
                  {auditUser.name.charAt(0).toUpperCase()}
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
                <span className="font-mono font-semibold text-white">{auditUser.activationDate || '2026-07-25 09:00'}</span>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-[10px] uppercase text-slate-400 block font-bold">Expiry Date</span>
                <span className="font-mono font-bold text-amber-400">{auditUser.expiryDate || '2026-08-24 09:00'}</span>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-[10px] uppercase text-slate-400 block font-bold">Total Renewals</span>
                <span className="font-bold text-indigo-400">{auditUser.renewalCount || 1}</span>
              </div>
            </div>

            {/* Manual Expiry Date Controls */}
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-3">
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider block">
                Admin Manual Subscription Controls
              </span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const currentExp = auditUser.expiryDate || '2026-08-24 09:00';
                    const parts = currentExp.split(' ');
                    const dateParts = parts[0].split('-');
                    const d = new Date(Number(dateParts[0]), Number(dateParts[1]) - 1, Number(dateParts[2]));
                    d.setDate(d.getDate() + 30);
                    const newExp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${parts[1] || '09:00'}`;
                    onUpdateUserExpiry(auditUser.id, newExp);
                    setAuditUser({ ...auditUser, expiryDate: newExp, renewalCount: (auditUser.renewalCount || 1) + 1 });
                    alert(`Subscription for ${auditUser.name} extended by +30 Days! New Expiry: ${newExp}`);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-slate-950 border border-emerald-500/40 text-xs font-bold transition-all cursor-pointer"
                >
                  + Extend +30 Days
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const revExp = '2020-01-01 00:00';
                    onUpdateUserExpiry(auditUser.id, revExp);
                    setAuditUser({ ...auditUser, expiryDate: revExp, plan: 'Free' });
                    alert(`Subscription for ${auditUser.name} revoked/expired immediately.`);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white border border-rose-500/40 text-xs font-bold transition-all cursor-pointer"
                >
                  ⛔ Revoke / Expire Now
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onToggleUserPlan(auditUser.id);
                    const newPlan = auditUser.plan === 'Premium' ? 'Free' : 'Premium';
                    setAuditUser({ ...auditUser, plan: newPlan });
                  }}
                  className="px-3.5 py-2 rounded-xl bg-indigo-500/20 hover:bg-indigo-500 text-indigo-300 hover:text-white border border-indigo-500/40 text-xs font-bold transition-all cursor-pointer"
                >
                  Switch Plan ({auditUser.plan === 'Premium' ? 'Free' : 'Premium'})
                </button>
              </div>

              <div className="pt-2 flex items-center space-x-2">
                <input
                  type="text"
                  value={customExpiryInput}
                  onChange={(e) => setCustomExpiryInput(e.target.value)}
                  placeholder="Custom Expiry e.g. 2027-12-31 23:59"
                  className="flex-1 px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs font-mono"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!customExpiryInput.trim()) return;
                    onUpdateUserExpiry(auditUser.id, customExpiryInput.trim());
                    setAuditUser({ ...auditUser, expiryDate: customExpiryInput.trim() });
                    alert(`Expiry date updated to ${customExpiryInput.trim()}`);
                    setCustomExpiryInput('');
                  }}
                  className="px-4 py-2 bg-amber-500 text-slate-950 font-bold text-xs rounded-xl cursor-pointer"
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
                    {(auditUser.transactions || [
                      {
                        id: 'tx-audit-default',
                        dateTime: auditUser.activationDate || '2026-07-25 09:00',
                        amount: 300,
                        currency: 'PKR',
                        type: 'Subscription',
                        status: 'Success',
                        paymentMethod: 'JazzCash'
                      }
                    ]).map((tx) => (
                      <tr key={tx.id} className="font-mono">
                        <td className="p-3">{tx.dateTime}</td>
                        <td className="p-3 font-bold text-emerald-400 font-sans">{tx.type}</td>
                        <td className="p-3 font-bold text-white">{tx.currency} {tx.amount.toLocaleString()}</td>
                        <td className="p-3 font-sans">{tx.paymentMethod}</td>
                        <td className="p-3 font-sans">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            {tx.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* USER DETAIL MODAL POP-UP */}
      {selectedUserForModal && (
        <UserDetailModal
          user={selectedUserForModal}
          userJobs={jobs.concat(pendingJobs).filter(j => j.submittedByUserId === selectedUserForModal.id || j.company.toLowerCase() === selectedUserForModal.companyName?.toLowerCase())}
          userApplications={allApplications.filter(a => a.applicantId === selectedUserForModal.id)}
          onClose={() => setSelectedUserForModal(null)}
          onUpdateUserExpiry={onUpdateUserExpiry}
          onToggleUserPlan={onToggleUserPlan}
          onUpdateUserPassword={onUpdateUserPassword}
          onEndUserMembership={onEndUserMembership}
          onDeactivateUserJobs={onDeactivateUserJobs}
          onEndUserMembershipAndJobs={onEndUserMembershipAndJobs}
          onSuspendJob={onSuspendJob}
          onInspectJob={(j) => setSelectedJobForModal(j)}
        />
      )}

      {/* ADMIN JOB DETAIL MODAL POP-UP */}
      {selectedJobForModal && (
        <AdminJobDetailModal
          job={selectedJobForModal}
          users={users}
          feeLogs={jobPostingFeeLogs}
          onClose={() => setSelectedJobForModal(null)}
          onApproveJob={(id) => {
            onApproveJob(id);
            setSelectedJobForModal(null);
          }}
          onRejectJob={(id, reason) => {
            onRejectJob(id, reason);
            setSelectedJobForModal(null);
          }}
          onSuspendJob={onSuspendJob}
          onViewUserProfile={(u) => {
            setSelectedUserForModal(u);
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
      />

      {/* QUICK EDIT / BULK EDIT JOB MODAL */}
      <AdminQuickEditJobModal
        isOpen={isJobQuickEditOpen || isBulkJobEditOpen}
        job={isBulkJobEditOpen ? null : editingJob}
        selectedJobs={isBulkJobEditOpen ? jobs.concat(pendingJobs).filter(j => selectedJobIds.includes(j.id) || selectedPendingIds.includes(j.id)) : []}
        onClose={() => {
          setIsJobQuickEditOpen(false);
          setIsBulkJobEditOpen(false);
          setEditingJob(null);
        }}
        onSaveJob={(updatedJob) => {
          if (onUpdateJob) onUpdateJob(updatedJob);
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
          setIsBulkJobEditOpen(false);
        }}
      />

      {/* LIVE JOBS DUPLICATE CHECKER MODAL */}
      <AdminDuplicateCheckerModal
        isOpen={isJobDuplicateModalOpen}
        onClose={() => setIsJobDuplicateModalOpen(false)}
        entityType="jobs"
        jobClusters={computeJobDuplicateClusters(jobs)}
        onResolveJobDuplicates={(keepId, deleteIds) => {
          if (onBulkDeleteJobs) {
            onBulkDeleteJobs(deleteIds);
          } else {
            deleteIds.forEach(id => onDeleteJob(id));
          }
          setIsJobDuplicateModalOpen(false);
        }}
        onBulkSelectDuplicateIds={(ids) => {
          setSelectedJobIds(ids);
          setIsJobDuplicateModalOpen(false);
        }}
      />

      {/* PENDING JOBS DUPLICATE CHECKER MODAL */}
      <AdminDuplicateCheckerModal
        isOpen={isPendingDuplicateModalOpen}
        onClose={() => setIsPendingDuplicateModalOpen(false)}
        entityType="pending"
        jobClusters={computeJobDuplicateClusters(pendingJobs)}
        onResolveJobDuplicates={(keepId, deleteIds) => {
          if (onBulkRejectPendingJobs) {
            onBulkRejectPendingJobs(deleteIds, 'Duplicate job submission detected in moderation queue');
          } else {
            deleteIds.forEach(id => onRejectJob(id, 'Duplicate job submission detected'));
          }
          setIsPendingDuplicateModalOpen(false);
        }}
        onBulkSelectDuplicateIds={(ids) => {
          setSelectedPendingIds(ids);
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
