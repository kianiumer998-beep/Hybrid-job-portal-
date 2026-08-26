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
  ScrapedJobAuditAction
} from '../types/job';
import { Advertisement, AdPricingConfig, CampaignCustomizationConfig } from '../types/ad';
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
  FileSpreadsheet,
  BarChart3,
  Database,
  Coins,
  BadgeCheck
} from 'lucide-react';
import { UserDetailModal } from './UserDetailModal';
import { AdminJobDetailModal } from './AdminJobDetailModal';
import { AdminAdHub } from './ads/AdminAdHub';
import { ScrapedJobHistoryModule } from './ScrapedJobHistoryModule';
import { PdfConsolidatedScraperModal } from './PdfConsolidatedScraperModal';
import { INITIAL_SCRAPED_AUDIT_LOGS, INITIAL_SCRAPER_BATCH_RUNS } from '../data/mockScraperHistory';

// Advanced International Admin Suite Modules
import { AdminAnalyticsOverview } from './admin/AdminAnalyticsOverview';
import { AdminSeoSettings } from './admin/AdminSeoSettings';
import { AdminCurrencyManager } from './admin/AdminCurrencyManager';
import { AdminBroadcastCenter } from './admin/AdminBroadcastCenter';
import { AdminDataBackupHub } from './admin/AdminDataBackupHub';
import { AdminAiQualityEnhancer } from './admin/AdminAiQualityEnhancer';
import { AdminEmployerKycHub } from './admin/AdminEmployerKycHub';
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
  onDeleteJob: (jobId: string) => void;
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
  allApplications = [],
  onApproveJob,
  onRejectJob,
  onAddJob,
  onAddPendingJob,
  onDeleteJob,
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
  onRejectAd
}) => {
  const [adminTab, setAdminTab] = useState<
    | 'analytics'
    | 'pending'
    | 'scraped-history'
    | 'advertisements'
    | 'seo-config'
    | 'currency-forex'
    | 'broadcast-center'
    | 'data-backup'
    | 'ai-enhancer'
    | 'employer-kyc'
    | 'user-audit'
    | 'fee-logs'
    | 'scraper'
    | 'chat-hub'
    | 'form-customizer'
    | 'add-job'
    | 'jobs'
    | 'subscribers'
    | 'settings'
    | 'stats'
  >('analytics');

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
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Error loading scraped audit logs from storage', e);
    }
    return INITIAL_SCRAPED_AUDIT_LOGS;
  });

  const [scraperBatchRuns, setScraperBatchRuns] = useState<ScraperBatchRun[]>(() => {
    try {
      const saved = localStorage.getItem('career_pak_scraper_batch_runs');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Error loading scraper batch runs from storage', e);
    }
    return INITIAL_SCRAPER_BATCH_RUNS;
  });

  useEffect(() => {
    try {
      localStorage.setItem('career_pak_scraped_audit_logs', JSON.stringify(scrapedAuditLogs));
    } catch (e) {}
  }, [scrapedAuditLogs]);

  useEffect(() => {
    try {
      localStorage.setItem('career_pak_scraper_batch_runs', JSON.stringify(scraperBatchRuns));
    } catch (e) {}
  }, [scraperBatchRuns]);

  // Modal inspection states
  const [selectedUserForModal, setSelectedUserForModal] = useState<UserAccount | null>(null);
  const [selectedJobForModal, setSelectedJobForModal] = useState<Job | null>(null);

  // Audit Selected User State
  const [auditUser, setAuditUser] = useState<UserAccount | null>(null);
  const [customExpiryInput, setCustomExpiryInput] = useState('');

  // Search
  const [searchJobQuery, setSearchJobQuery] = useState('');

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
  const [newScraperName, setNewScraperName] = useState('');
  const [scraperUrl, setScraperUrl] = useState('https://indeed.com/jobs?q=full+stack+developer');
  const [scraperKeyword, setScraperKeyword] = useState('Full Stack, React, Node.js');
  const [scraperCategory, setScraperCategory] = useState<'Private Corporate' | 'Government Sector' | 'Newspaper Classified' | 'International Remote'>('Private Corporate');
  const [scraperRegion, setScraperRegion] = useState<Region>('Pakistan');
  const [scraperInterval, setScraperInterval] = useState<'15m' | '30m' | '1h' | '6h' | '24h' | '7d'>('1h');
  const [scraperDepth, setScraperDepth] = useState<'Light (10 Jobs)' | 'Standard (25 Jobs)' | 'Deep Crawl (50+ Jobs)'>('Standard (25 Jobs)');
  const [scraperDeduplication, setScraperDeduplication] = useState(true);
  const [scraperAutoApprove, setScraperAutoApprove] = useState(false);

  // Scraper Sub-Tab Navigation State
  const [scraperSubTab, setScraperSubTab] = useState<'targets' | 'history' | 'add' | 'inspect-feed' | 'logs'>('targets');
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
    setNewScraperName('');
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

  // User Audit search and filter states
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userPaymentFilter, setUserPaymentFilter] = useState<'all' | 'paid' | 'unpaid'>('all');

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
        id: 'audit-' + mockScraped1.id,
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
        id: 'audit-' + mockScraped2.id,
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

  // Synchronized Approval with Audit Trail
  const handleAdminApproveJob = (jobId: string) => {
    onApproveJob(jobId);
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
    extractedJobs.forEach((job) => {
      const uniqueId = `pdf-${job.id.replace('pdf-', '')}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;
      const jobToInsert: Job = {
        ...job,
        id: uniqueId,
        status: autoApprove ? 'Approved' : 'Pending'
      };
      if (autoApprove) {
        onAddJob(jobToInsert);
      } else {
        if (onAddPendingJob) {
          onAddPendingJob(jobToInsert);
        } else {
          onAddJob(jobToInsert);
        }
      }
    });
  };

  const handleLogPdfBatchRun = (batchRun: ScraperBatchRun, auditEntries: ScrapedJobAuditEntry[]) => {
    setScraperBatchRuns(prev => [batchRun, ...prev]);
    setScrapedAuditLogs(prev => [...auditEntries, ...prev]);
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

      {/* Admin Navigation Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-800 pb-4 overflow-x-auto text-xs font-bold scrollbar-thin">
        {[
          { id: 'analytics', label: '📊 Executive Analytics & KPIs', icon: BarChart3 },
          { id: 'pending', label: `Pending Approvals (${pendingJobs.length})`, icon: Clock },
          { id: 'scraped-history', label: `Scraped Jobs History (${scrapedAuditLogs.length})`, icon: History },
          { id: 'advertisements', label: `📢 Ad & Campaigns (${ads.filter(a => a.status === 'active').length} Active)`, icon: Megaphone },
          { id: 'seo-config', label: '🌐 Global SEO & Meta', icon: Globe },
          { id: 'currency-forex', label: '💱 Multi-Currency & Forex', icon: Coins },
          { id: 'broadcast-center', label: '📣 Broadcasts (WhatsApp/Email)', icon: Send },
          { id: 'data-backup', label: '💾 Data Vault & CSV Exporter', icon: Database },
          { id: 'ai-enhancer', label: '✨ AI Quality & Spam Filter', icon: Sparkles },
          { id: 'employer-kyc', label: `🛡️ Employer KYC Queue (${kycRequests.filter(r => r.status === 'Pending').length})`, icon: BadgeCheck },
          { id: 'user-audit', label: `User Directory & Audit (${users.length})`, icon: Users },
          { id: 'fee-logs', label: `Per-Job Fee Logs (${jobPostingFeeLogs.length})`, icon: Receipt },
          { id: 'scraper', label: 'Automated Scraper Controller', icon: Bot },
          { id: 'chat-hub', label: `User Chat Hub (${chatMessages.length})`, icon: MessageSquare },
          { id: 'form-customizer', label: 'Registration Form Customizer', icon: Edit3 },
          { id: 'add-job', label: 'Post Manual Job', icon: Plus },
          { id: 'jobs', label: `Live Listings (${jobs.length})`, icon: Briefcase },
          { id: 'subscribers', label: `Subscribers (${subscribers.length})`, icon: DollarSign },
          { id: 'settings', label: 'Global Fee & Master Switches', icon: Settings }
        ].map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setAdminTab(t.id as any)}
              className={`flex items-center space-x-2 px-3.5 py-2.5 rounded-xl transition-all whitespace-nowrap cursor-pointer ${
                adminTab === t.id
                  ? 'bg-amber-500 text-slate-950 font-extrabold shadow-lg shadow-amber-500/20'
                  : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

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
      {adminTab === 'pending' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 text-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-base font-bold flex items-center space-x-2">
                <Clock className="w-5 h-5 text-amber-400" />
                <span>Pending Job Approvals Queue</span>
              </h3>
              <p className="text-xs text-slate-400">Approve jobs to push to public live site or reject with custom user feedback.</p>
            </div>
            <span className="bg-amber-500/20 text-amber-400 text-xs font-bold px-3 py-1 rounded-full border border-amber-500/30">
              {pendingJobs.length} Items Pending
            </span>
          </div>

          {pendingJobs.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs bg-slate-950 rounded-xl border border-slate-800">
              No pending jobs in queue right now! All user submissions and scraper outputs are reviewed.
            </div>
          ) : (
            <div className="space-y-4">
              {pendingJobs.map((pJob) => (
                <div key={pJob.id} className="p-5 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
                    <div>
                      <div className="flex items-center space-x-2">
                        <h4
                          onClick={() => setSelectedJobForModal(pJob)}
                          className="font-bold text-base text-white hover:text-amber-400 cursor-pointer transition-colors"
                        >
                          {pJob.title}
                        </h4>
                        <span className="bg-amber-500/20 text-amber-400 text-[10px] uppercase font-bold px-2 py-0.5 rounded">
                          {pJob.jobType}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        Company: <span className="text-white font-semibold">{pJob.company}</span> • Location: <span className="text-emerald-400 font-semibold">{pJob.city ? `${pJob.city}, ${pJob.province}` : pJob.region}</span> • Salary: {pJob.salary}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => setSelectedJobForModal(pJob)}
                        className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs rounded-xl flex items-center space-x-1 border border-amber-500/30 cursor-pointer"
                      >
                        <Eye className="w-4 h-4" />
                        <span>Job Details</span>
                      </button>

                      <button
                        onClick={() => handleAdminApproveJob(pJob.id)}
                        className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl flex items-center space-x-1 shadow-lg shadow-emerald-500/20 cursor-pointer"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Approve to Live Site</span>
                      </button>

                      <button
                        onClick={() => handleRejectPrompt(pJob.id)}
                        className="px-4 py-2 bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white font-bold text-xs rounded-xl flex items-center space-x-1 border border-rose-500/30 cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                        <span>Reject with Reason</span>
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 bg-slate-900 p-3 rounded-lg border border-slate-800/80">
                    {pJob.description}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: USER DIRECTORY AUDIT & MANUAL SUBSCRIPTION CONTROL */}
      {adminTab === 'user-audit' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5 text-white shadow-xl">
          {/* HEADER & TOP CONTROL BAR */}
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-lg font-black flex items-center space-x-2 text-white">
                <Users className="w-5 h-5 text-amber-400" />
                <span>Registered User Directory & Subscription Payment Audit</span>
              </h3>
              <p className="text-xs text-slate-400">
                Audit employer and applicant accounts, enforce payment requirements, and instantly end memberships or jobs for unpaid users.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
              <input
                type="text"
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                placeholder="Search user by name or email..."
                className="px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 w-full sm:w-64"
              />

              <select
                value={userPaymentFilter}
                onChange={(e) => setUserPaymentFilter(e.target.value as any)}
                className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-bold cursor-pointer"
              >
                <option value="all">All Users ({users.length})</option>
                <option value="paid">Active Paid Accounts</option>
                <option value="unpaid">⚠️ Unpaid / Expired Accounts</option>
              </select>

              {onBulkEndUnpaidMemberships && (
                <button
                  onClick={onBulkEndUnpaidMemberships}
                  className="px-3.5 py-2 bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white border border-rose-500/30 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center space-x-1.5 shadow-lg shadow-rose-500/10"
                >
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                  <span>End All Unpaid Accounts & Jobs</span>
                </button>
              )}
            </div>
          </div>

          {/* TABLE OF USERS */}
          {(() => {
            const filteredUsers = users.filter((u) => {
              if (userSearchQuery.trim()) {
                const q = userSearchQuery.toLowerCase();
                const matchesName = u.name.toLowerCase().includes(q);
                const matchesEmail = u.email.toLowerCase().includes(q);
                const matchesRole = u.role.toLowerCase().includes(q);
                if (!matchesName && !matchesEmail && !matchesRole) return false;
              }

              const isUnpaid = u.paymentStatus === 'Unpaid' || u.membershipStatus === 'Revoked' || (u.expiryDate && new Date(u.expiryDate).getTime() < Date.now());
              if (userPaymentFilter === 'paid' && isUnpaid) return false;
              if (userPaymentFilter === 'unpaid' && !isUnpaid) return false;

              return true;
            });

            if (filteredUsers.length === 0) {
              return (
                <div className="p-8 text-center bg-slate-950 rounded-xl border border-slate-800 text-slate-400 space-y-2">
                  <Users className="w-8 h-8 text-slate-600 mx-auto" />
                  <p className="font-bold text-slate-300 text-sm">No users found matching current filter.</p>
                </div>
              );
            }

            return (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950 uppercase text-[10px] text-slate-400 font-bold border-b border-slate-800">
                    <tr>
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
                      const userPostedJobs = [...jobs, ...pendingJobs].filter(j => 
                        j.submittedByUserId === u.id || 
                        (u.name && j.company?.toLowerCase() === u.name.toLowerCase()) ||
                        (u.email && j.company?.toLowerCase() === u.email.toLowerCase())
                      );
                      const isUnpaidOrRevoked = u.paymentStatus === 'Unpaid' || u.membershipStatus === 'Revoked' || (u.expiryDate && new Date(u.expiryDate).getTime() < Date.now());

                      return (
                        <tr key={u.id} className="hover:bg-slate-800/40 transition-colors">
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
                                  Deactivate Jobs ({userPostedJobs.length})
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
            );
          })()}
        </div>
      )}

      {/* TAB 3: PER-JOB FEE PAYMENT LOG SHEET */}
      {adminTab === 'fee-logs' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 text-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-base font-bold flex items-center space-x-2">
                <Receipt className="w-5 h-5 text-emerald-400" />
                <span>Per-Job Fee Payment Log Sheet</span>
              </h3>
              <p className="text-xs text-slate-400">Complete audit trail of all job posting fees collected by the system.</p>
            </div>
            <span className="bg-emerald-500/20 text-emerald-400 text-xs font-bold px-3 py-1 rounded-full border border-emerald-500/30">
              Total Logged: {jobPostingFeeLogs.length}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 uppercase text-[10px] text-slate-400 font-bold border-b border-slate-800">
                <tr>
                  <th className="p-3">Date & Time</th>
                  <th className="p-3">User</th>
                  <th className="p-3">Job Title</th>
                  <th className="p-3">Amount Paid</th>
                  <th className="p-3">Method</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {jobPostingFeeLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-slate-500 italic">
                      No per-job posting fees logged yet. (Set Per-Job Fee in Global Settings to enable requirement).
                    </td>
                  </tr>
                ) : (
                  jobPostingFeeLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-800/40 font-mono">
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
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
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
                <h4 className="text-sm font-black uppercase text-white flex items-center space-x-2">
                  <span>Active Scraper Feeds & Schedule Rules</span>
                </h4>
                <div className="text-xs text-slate-400">
                  Auto-judges job titles, company names, BPS scale, newspaper clipping URL, and location mappings.
                </div>
              </div>

              <div className="space-y-4">
                {scraperSources.map((source) => (
                  <div key={source.id} className="p-5 bg-slate-950 border border-slate-800 rounded-2xl space-y-4 hover:border-indigo-500/40 transition-all">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
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
                ))}
              </div>
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
      {adminTab === 'jobs' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 text-white">
          <h3 className="text-base font-bold">Active Live Listings ({jobs.length})</h3>
          <div className="divide-y divide-slate-800">
            {jobs.map((j) => (
              <div key={j.id} className="py-3 flex justify-between items-center text-xs">
                <div>
                  <div
                    onClick={() => setSelectedJobForModal(j)}
                    className="font-bold text-white hover:text-amber-400 cursor-pointer transition-colors"
                  >
                    {j.title}
                  </div>
                  <div className="text-slate-400">{j.company} • {j.salary}</div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setSelectedJobForModal(j)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs rounded-lg flex items-center space-x-1 border border-amber-500/30 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Detail</span>
                  </button>
                  <button
                    onClick={() => onDeleteJob(j.id)}
                    className="p-2 bg-rose-500/20 text-rose-400 rounded-lg hover:bg-rose-500 hover:text-white cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 9: SUBSCRIBERS */}
      {adminTab === 'subscribers' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white space-y-4">
          <h3 className="text-base font-bold">WhatsApp Alert Subscribers ({subscribers.length})</h3>
          <div className="divide-y divide-slate-800 text-xs">
            {subscribers.map((s) => (
              <div key={s.id} className="py-3 flex justify-between">
                <div>
                  <div className="font-bold">{s.name} ({s.phone})</div>
                  <div className="text-slate-400">{s.email}</div>
                </div>
                <div className="text-emerald-400 font-bold">PKR {s.amountPaid}</div>
              </div>
            ))}
          </div>
        </div>
      )}

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

          {/* PER-JOB POSTING FEE CONTROLLER */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white space-y-4 shadow-xl">
            <h3 className="text-base font-bold border-b border-slate-800 pb-2 flex items-center space-x-2">
              <Receipt className="w-5 h-5 text-amber-400" />
              <span>Set Per-Job Posting Fee Controller</span>
            </h3>
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1">Per-Job Fee Amount (PKR) [Set to 0 for Free]</label>
              <input
                type="number"
                value={jobPostingFeePkr}
                onChange={(e) => onChangeJobPostingFee(Number(e.target.value))}
                placeholder="1000"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm font-bold"
              />
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              When set &gt; 0, users who click "Post a Job" will be prompted with a payment invoice of PKR {jobPostingFeePkr.toLocaleString()} before their job enters Admin Pending Queue.
            </p>
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
          allJobs={jobs.concat(pendingJobs)}
          allApplications={allApplications}
          allTransactions={selectedUserForModal.transactions || []}
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
          posterUser={users.find(u => u.name.toLowerCase() === selectedJobForModal.company.toLowerCase() || u.email.toLowerCase() === selectedJobForModal.company.toLowerCase()) || users[0]}
          onClose={() => setSelectedJobForModal(null)}
          onApproveJob={(id) => {
            onApproveJob(id);
            setSelectedJobForModal(null);
          }}
          onRejectJob={(id, reason) => {
            onRejectJob(id, reason);
            setSelectedJobForModal(null);
          }}
          onDeleteJob={(id) => {
            onDeleteJob(id);
            setSelectedJobForModal(null);
          }}
          onSuspendJob={onSuspendJob}
          onViewUserProfile={(u) => {
            setSelectedUserForModal(u);
          }}
        />
      )}

      {/* PDF CONSOLIDATED SCRAPER MODAL (FPSC / WAPDA / PPSC) */}
      <PdfConsolidatedScraperModal
        isOpen={isPdfScraperModalOpen}
        onClose={() => setIsPdfScraperModalOpen(false)}
        onBatchImportJobs={handleBatchImportPdfJobs}
        onLogBatchRun={handleLogPdfBatchRun}
      />

    </div>
  );
};
