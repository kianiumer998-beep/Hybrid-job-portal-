import React, { useState, useEffect, useMemo, useRef } from 'react';
import { UserAccount, Job, JobType, Region, ChatMessage, PaymentTransaction, JobApplication, Currency, GOVT_DEPT_OPTIONS, GOVT_SCALE_OPTIONS, GOVT_CADRE_OPTIONS, NEWSPAPER_OPTIONS, JobPostingPricingConfig, DEFAULT_JOB_POSTING_PRICING_CONFIG, FeePaymentData } from '../types/job';
import { Advertisement, AdPricingConfig, DEFAULT_AD_PRICING_CONFIG, CampaignCustomizationConfig } from '../types/ad';
import { EmployerKycRequest } from '../types/adminSuite';
import { UserCampaignHub } from './ads/UserCampaignHub';
import { PAKISTAN_LOCATIONS } from '../data/pakistanLocations';
import { api } from '../services/api';
import { User, Building2, Briefcase, Plus, MessageSquare, Send, CheckCircle2, AlertCircle, Clock, ShieldCheck, Sparkles, RefreshCw, X, CreditCard, DollarSign, Calendar, History, Receipt, Lock, Key, FileText, Edit3, Megaphone, Pin, Flame, Zap, Crown, Star, ArrowRight, Bookmark, ThumbsUp, Globe, Wallet, Check, Upload, Info, Bell, LayoutDashboard, Menu } from 'lucide-react';
import { PublicPaymentSettings, PublicPaymentMethodConfig } from '../types/adminPayment';
import { JobSeoPreviewModal } from './common/JobSeoPreviewModal';

import { UserDashboardNavigation } from './UserDashboardNavigation';
import { safeLocalStorageGet, safeLocalStorageSet } from '../utils/safeStorage';
import { getUserDashboardPath, getUserDashboardRouteId, getUserDashboardRouteIdForState, USER_DASHBOARD_ROUTES } from '../utils/userDashboardRouting';

const EMPLOYER_ALLOWED_APP_STATUSES = [
  'Pending',
  'Reviewed',
  'Shortlisted',
  'Rejected',
  'Accepted'
] as const;

interface UserDashboardProps {
  currentUser: UserAccount;
  userJobs: Job[];
  chatMessages: ChatMessage[];
  jobPostingFeePkr: number;
  userApplications?: JobApplication[];
  allJobs?: Job[];
  savedJobIds?: string[];
  onSelectJob?: (job: Job) => void;
  onApplyJob?: (job: Job) => void;
  onToggleSaveJob?: (jobId: string) => void;
  initialTab?: 'overview' | 'profile' | 'applications' | 'post-job' | 'my-jobs' | 'chat' | 'campaigns';
  userAds?: Advertisement[];
  allAds?: Advertisement[];
  pricingConfig?: AdPricingConfig;
  campaignConfig?: CampaignCustomizationConfig;
  jobPostingPricing?: JobPostingPricingConfig;
  onSubmitCampaign?: (ad: Advertisement, cost: number) => Promise<any> | any;
  onDepositFunds?: (depositData: {
    amount: number;
    paymentMethod: string;
    transactionId?: string;
    proofScreenshotUrl?: string;
    senderName?: string;
    senderPhoneOrAccount?: string;
    depositBankOrWalletName?: string;
    proofNote?: string;
  }) => Promise<{ success: boolean; transaction?: any; message?: string } | boolean | void> | void;
  onDeleteAd?: (adId: string) => void;
  onDuplicateAd?: (ad: Advertisement) => void;
  onRenewSubscription: () => void;
  onSubmitJobForApproval: (
    job: Job,
    feePayment?: FeePaymentData
  ) => Promise<{ success: boolean; transaction?: any; job?: Job; message?: string } | void> | void;
  onSendMessageToAdmin: (text: string) => Promise<boolean> | boolean;
  onUpdateProfile?: (updated: Partial<UserAccount> | UserAccount) => Promise<boolean> | boolean | void;
  onChangePassword?: (currentPass: string, newPass: string) => Promise<{ success: boolean; message?: string } | boolean> | { success: boolean; message?: string } | boolean;
  savedJobsList?: any[];
  jobAlerts?: any[];
  userDocuments?: any[];
  onCreateJobAlert?: (data: { keyword?: string; city?: string; jobType?: string; frequency?: string; email?: string }) => Promise<boolean> | boolean;
  onDeleteJobAlert?: (id: string) => Promise<boolean> | boolean;
  onAddDocument?: (file: File, title?: string, type?: string) => Promise<boolean> | boolean;
  onDeleteDocument?: (id: string) => Promise<boolean> | boolean;
  onLoadJobApplications?: (jobId: string) => Promise<{ success: boolean; applications: JobApplication[]; message?: string }>;
  onUpdateApplicationStatus?: (
    applicationId: string,
    newStatus: string,
    jobId?: string
  ) => Promise<{ success: boolean; application?: JobApplication; message?: string }>;
  onLogout: () => void;
  onOpenSubscriptionModal: () => void;
  onNavigateGlobalTab?: (tab: 'jobs' | 'cv' | 'alerts' | 'dashboard') => void;
}

type PaymentStatusPresentation = { label: string; className: string };

const getPaymentStatusPresentation = (status: PaymentTransaction['status'] | string | undefined): PaymentStatusPresentation => {
  switch (String(status || '').trim().toLowerCase()) {
    case 'success':
      return { label: 'Approved', className: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' };
    case 'pending':
      return { label: 'Pending Review', className: 'bg-amber-500/15 text-amber-300 border-amber-500/30' };
    case 'verifying':
      return { label: 'Under Verification', className: 'bg-sky-500/15 text-sky-300 border-sky-500/30' };
    case 'verificationuncertain':
      return { label: 'Verification Uncertain', className: 'bg-orange-500/15 text-orange-300 border-orange-500/30' };
    case 'refunded':
      return { label: 'Refunded', className: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30' };
    case 'failed':
    case 'rejected':
      return { label: 'Failed / Rejected', className: 'bg-rose-500/15 text-rose-300 border-rose-500/30' };
    default:
      return { label: status ? String(status) : 'Status unavailable', className: 'bg-slate-700/50 text-slate-300 border-slate-600' };
  }
};

export function resolveDefaultPaymentMethod(
  methods: PublicPaymentMethodConfig[],
  defaultSetting?: string
): PublicPaymentMethodConfig | null {
  if (!methods || methods.length === 0) return null;
  if (defaultSetting && typeof defaultSetting === 'string') {
    const cleanDefault = defaultSetting.trim().toLowerCase();
    if (cleanDefault) {
      // 1. Method ID first
      const byId = methods.find((m) => m.id.toLowerCase() === cleanDefault);
      if (byId) return byId;

      // 2. Method Name for compatibility
      const byName = methods.find((m) => m.name.trim().toLowerCase() === cleanDefault);
      if (byName) return byName;
    }
  }
  // Safely fallback to first valid enabled method
  return methods[0] || null;
}

export const UserDashboard: React.FC<UserDashboardProps> = ({
  currentUser,
  userJobs,
  chatMessages,
  jobPostingFeePkr,
  userApplications = [],
  allJobs = [],
  savedJobIds = [],
  onSelectJob,
  onApplyJob,
  onToggleSaveJob,
  initialTab = 'overview',
  userAds = [],
  allAds = [],
  pricingConfig = DEFAULT_AD_PRICING_CONFIG,
  campaignConfig,
  jobPostingPricing = DEFAULT_JOB_POSTING_PRICING_CONFIG,
  onSubmitCampaign,
  onDepositFunds,
  onDeleteAd,
  onDuplicateAd,
  onRenewSubscription,
  onSubmitJobForApproval,
  onSendMessageToAdmin,
  onUpdateProfile,
  onChangePassword,
  savedJobsList = [],
  jobAlerts = [],
  userDocuments = [],
  onCreateJobAlert,
  onDeleteJobAlert,
  onAddDocument,
  onDeleteDocument,
  onLoadJobApplications,
  onUpdateApplicationStatus,
  onLogout,
  onOpenSubscriptionModal,
  onNavigateGlobalTab
}) => {
  const initialRouteId = typeof window !== 'undefined' ? getUserDashboardRouteId(window.location.pathname) : null;
  const initialRoute = initialRouteId ? USER_DASHBOARD_ROUTES[initialRouteId] : null;
  const [activeTab, setActiveTab] = useState<'overview' | 'profile' | 'applications' | 'post-job' | 'my-jobs' | 'chat' | 'campaigns'>(initialRoute?.tab || initialTab);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [overviewSubView, setOverviewSubView] = useState<'metrics' | 'recommendations' | 'history'>(initialRoute?.subView || 'metrics');
  const [appSubTab, setAppSubTab] = useState<'submitted' | 'saved' | 'alerts' | 'documents'>(
    initialRoute?.tab === 'applications' && initialRoute.subTab ? initialRoute.subTab as 'submitted' | 'saved' | 'alerts' | 'documents' : 'submitted'
  );
  const [campaignSubTab, setCampaignSubTab] = useState<'my-campaigns' | 'create' | 'wallet'>(
    initialRoute?.tab === 'campaigns' && initialRoute.subTab ? initialRoute.subTab as 'my-campaigns' | 'create' | 'wallet' : 'my-campaigns'
  );
  const [accountSubTab, setAccountSubTab] = useState<'profile' | 'security'>(
    initialRoute?.accountSubTab || (safeLocalStorageGet<string | null>(`dashboard_active_nav_id_${currentUser.id}`, null) === 'acc-security' ? 'security' : 'profile')
  );
  const [selectedPaymentTransaction, setSelectedPaymentTransaction] = useState<PaymentTransaction | null>(null);
  const [openDepositModalTrigger, setOpenDepositModalTrigger] = useState<boolean>(false);
  const [renewalPackages, setRenewalPackages] = useState<any[]>([]);
  const [renewalPackageId, setRenewalPackageId] = useState<string>(String((currentUser as any).autoRenewPackageId || ''));
  const [renewalPreferenceBusy, setRenewalPreferenceBusy] = useState(false);
  const [renewalPreferenceMessage, setRenewalPreferenceMessage] = useState('');
  const [postingSlotBusyJobId, setPostingSlotBusyJobId] = useState<string | null>(null);
  const [ownSubmissionHistory, setOwnSubmissionHistory] = useState<Job[]>([]);
  const [resubmissionLimit, setResubmissionLimit] = useState(3);
  const [resubmittingJobId, setResubmittingJobId] = useState<string | null>(null);
  const [resubmissionDraft, setResubmissionDraft] = useState<Job | null>(null);

  useEffect(() => {
    let active = true;
    const loadOwnSubmissions = () => {
      api.jobs.getMySubmissions().then((result: any) => {
        if (!active || !result?.success) return;
        setOwnSubmissionHistory(Array.isArray(result.jobs) ? result.jobs : []);
        setResubmissionLimit(Number.isInteger(result.maxResubmissionAttempts) ? result.maxResubmissionAttempts : 3);
      }).catch(() => {});
    };
    loadOwnSubmissions();
    const refreshTimer = window.setInterval(loadOwnSubmissions, 60000);
    window.addEventListener('focus', loadOwnSubmissions);
    return () => {
      active = false;
      window.clearInterval(refreshTimer);
      window.removeEventListener('focus', loadOwnSubmissions);
    };
  }, [currentUser.id]);

  const displayUserJobs = useMemo(() => {
    const merged = new Map<string, Job>();
    [...userJobs, ...ownSubmissionHistory].forEach((job) => merged.set(String(job.id), job));
    return Array.from(merged.values()).sort((a: any, b: any) =>
      Date.parse(String(b.updatedAt || b.createdAt || 0)) - Date.parse(String(a.updatedAt || a.createdAt || 0))
    );
  }, [userJobs, ownSubmissionHistory]);

  const updateResubmissionField = (field: keyof Job, value: any) => {
    setResubmissionDraft((current) => current ? { ...current, [field]: value } : current);
  };

  const parseResubmissionLines = (value: string) =>
    value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean).slice(0, 100);

  const [navigationMode, setNavigationMode] = useState<'classic' | 'professional' | 'new' | 'classic-new'>(() => 
    safeLocalStorageGet<'classic' | 'professional' | 'new' | 'classic-new'>(
      `dashboard_nav_mode_v2_${currentUser.id}`,
      safeLocalStorageGet<'classic' | 'professional' | 'new' | 'classic-new'>(`dashboard_nav_mode_${currentUser.id}`, 'professional')
    )
  );

  const [dashboardNavConfig, setDashboardNavConfig] = useState<any>({
    enabledModes: ['classic', 'professional', 'new', 'classic-new'],
    defaultMode: 'professional',
    allowModeSwitching: true,
    quickActions: [
      { id: 'dash-overview', label: 'Home', icon: 'LayoutDashboard', destination: '/dashboard', enabled: true, mobile: true, desktop: false },
      { id: 'jobs-explore', label: 'Jobs', icon: 'Search', destination: '/jobs', enabled: true, mobile: true, desktop: false },
      { id: 'career-cv', label: 'CV', icon: 'FileText', destination: '/cv', enabled: true, mobile: true, desktop: false },
      { id: 'mem-whatsapp', label: 'Alerts', icon: 'Bell', destination: '/alerts', enabled: true, mobile: true, desktop: false },
      { id: 'acc-profile', label: 'Account', icon: 'User', destination: '/dashboard/profile', enabled: true, mobile: true, desktop: false }
    ]
  });
  useEffect(() => {
    let mounted = true;
    api.settings.getUserDashboardNavigation().then((result: any) => {
      if (!mounted || !result?.success || !result.config) return;
      const next = result.config;
      setDashboardNavConfig(next);
      setNavigationMode((current) => {
        const modes = Array.isArray(next.enabledModes) ? next.enabledModes : [];
        if (!modes.length) return current;
        if (next.allowModeSwitching !== true || modes.length === 1) return modes.includes(next.defaultMode) ? next.defaultMode : modes[0];
        return modes.includes(current) ? current : (modes.includes(next.defaultMode) ? next.defaultMode : modes[0]);
      });
    }).catch(() => {});
    return () => { mounted = false; };
  }, [currentUser.id]);

  const enabledMenuModes = (['classic', 'professional', 'new', 'classic-new'] as const)
    .filter((mode) => Array.isArray(dashboardNavConfig.enabledModes) && dashboardNavConfig.enabledModes.includes(mode));
  const showMenuModeSwitcher = dashboardNavConfig.allowModeSwitching === true && enabledMenuModes.length > 1;

  const safeProfileAvatarUrl = useMemo(() => {
    try {
      const parsed = new URL(String(currentUser.avatarUrl || ''));
      return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.href : null;
    } catch {
      return null;
    }
  }, [currentUser.avatarUrl]);
  const [isProMenuOpen, setIsProMenuOpen] = useState<boolean>(false);
  const [activeNavId, setActiveNavId] = useState<string | null>(() =>
    initialRouteId || safeLocalStorageGet<string | null>(`dashboard_active_nav_id_${currentUser.id}`, null)
  );

  useEffect(() => {
    safeLocalStorageSet(`dashboard_nav_mode_v2_${currentUser.id}`, navigationMode);
  }, [navigationMode, currentUser.id]);

  useEffect(() => {
    let active = true;
    api.pricing.get().then((res: any) => {
      if (!active || !res?.success || !Array.isArray(res?.pricing?.subscriptionPackages)) return;
      const available = res.pricing.subscriptionPackages.filter((pkg: any) => pkg?.enabled === true && pkg?.id);
      setRenewalPackages(available);
      setRenewalPackageId((previous) =>
        available.some((pkg: any) => pkg.id === previous)
          ? previous
          : (available.some((pkg: any) => pkg.id === (currentUser as any).autoRenewPackageId)
            ? String((currentUser as any).autoRenewPackageId)
            : String(available[0]?.id || ''))
      );
    }).catch(() => {});
    return () => { active = false; };
  }, [currentUser.id]);


  useEffect(() => {
    safeLocalStorageSet(`dashboard_active_nav_id_${currentUser.id}`, activeNavId);
    if (activeNavId === 'acc-security') setAccountSubTab('security');
    else if (activeNavId === 'acc-profile') setAccountSubTab('profile');
  }, [activeNavId, currentUser.id]);

  // In-App Notifications State
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadNotifCount, setUnreadNotifCount] = useState<number>(0);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState<boolean>(false);
  const [showNotificationDrawer, setShowNotificationDrawer] = useState<boolean>(false);

  // Employer KYC State
  const [myKycRequest, setMyKycRequest] = useState<EmployerKycRequest | null>(null);
  const [isLoadingKyc, setIsLoadingKyc] = useState<boolean>(false);
  const [kycSubmitStatus, setKycSubmitStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isSubmittingKyc, setIsSubmittingKyc] = useState<boolean>(false);

  const [kycCompany, setKycCompany] = useState<string>(currentUser?.companyName || '');
  const [kycContact, setKycContact] = useState<string>(currentUser?.name || '');
  const [kycPhone, setKycPhone] = useState<string>(currentUser?.phone || '');
  const [kycNtn, setKycNtn] = useState<string>('');
  const [kycWebsite, setKycWebsite] = useState<string>('');
  const [kycSecp, setKycSecp] = useState<string>('');
  const [kycDocUrl, setKycDocUrl] = useState<string>('');

  useEffect(() => {
    if (currentUser?.role === 'Employer/Job Poster') {
      let isMounted = true;
      const fetchMyKyc = async () => {
        setIsLoadingKyc(true);
        try {
          const res = await api.kyc.getMyRequest();
          if (isMounted && res && res.success) {
            setMyKycRequest(res.request || null);
          }
        } catch (e) {}
        finally {
          if (isMounted) setIsLoadingKyc(false);
        }
      };
      fetchMyKyc();
      return () => { isMounted = false; };
    }
  }, [currentUser?.role, currentUser?.id]);

  const handleKycSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingKyc) return;
    setIsSubmittingKyc(true);
    setKycSubmitStatus(null);
    try {
      const res = await api.kyc.submitRequest({
        companyName: kycCompany,
        contactPerson: kycContact,
        phone: kycPhone,
        ntnOrTaxNumber: kycNtn,
        companyWebsite: kycWebsite,
        secpRegistrationNumber: kycSecp.trim() || undefined,
        officialDocUrl: kycDocUrl.trim() || undefined
      });
      if (res && res.success && res.request) {
        setMyKycRequest(res.request);
        setKycSubmitStatus({ type: 'success', message: 'KYC Verification request submitted successfully! It is now under review by moderation.' });
      } else {
        setKycSubmitStatus({ type: 'error', message: res?.message || 'Failed to submit KYC request.' });
      }
    } catch (err: any) {
      setKycSubmitStatus({ type: 'error', message: err?.message || 'Error submitting KYC request.' });
    } finally {
      setIsSubmittingKyc(false);
    }
  };

  const currentUserId = currentUser?.id;
  const activeUserIdRef = useRef<string | undefined>(currentUserId);

  useEffect(() => {
    activeUserIdRef.current = currentUserId;
  }, [currentUserId]);

  const inFlightNotifIds = useRef<Set<string>>(new Set());
  const isMarkAllInFlight = useRef<boolean>(false);

  const loadNotifications = React.useCallback(async () => {
    const requestUserId = currentUserId;
    if (!requestUserId) return;
    setIsLoadingNotifications(true);
    try {
      const [listRes, countRes] = await Promise.all([
        api.notifications.getAll(),
        api.notifications.getUnreadCount()
      ]);

      // Guard against account switches while request was in-flight
      if (activeUserIdRef.current !== requestUserId) {
        return;
      }

      if (listRes && listRes.success && Array.isArray(listRes.notifications)) {
        setNotifications(listRes.notifications);
      }
      if (countRes && countRes.success && typeof countRes.unreadCount === 'number') {
        setUnreadNotifCount(countRes.unreadCount);
      }
    } catch (err) {
      if (activeUserIdRef.current === requestUserId) {
        console.error('[UserDashboard] Failed to load notifications:', err);
      }
    } finally {
      if (activeUserIdRef.current === requestUserId) {
        setIsLoadingNotifications(false);
      }
    }
  }, [currentUserId]);

  useEffect(() => {
    // Reset notification state whenever authenticated user changes to prevent cross-user leakage
    setNotifications([]);
    setUnreadNotifCount(0);
    setShowNotificationDrawer(false);
    setIsLoadingNotifications(false);

    if (currentUserId) {
      loadNotifications();
    }
    const interval = setInterval(() => {
      if (currentUserId) {
        loadNotifications();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [currentUserId, loadNotifications]);

  const handleMarkNotificationRead = async (id: string) => {
    if (inFlightNotifIds.current.has(id)) return;

    const currentNotif = notifications.find((n) => n.id === id);
    if (!currentNotif || currentNotif.read) return;

    const requestUserId = currentUserId;
    if (!requestUserId) return;

    inFlightNotifIds.current.add(id);
    try {
      const res = await api.notifications.markAsRead(id);
      
      if (activeUserIdRef.current !== requestUserId) return;

      if (res && res.success) {
        // Capture whether the notification was unread in the state from the current render closure.
        // This allows moving setUnreadNotifCount outside the pure setNotifications updater.
        const wasUnread = notifications.some((n) => n.id === id && !n.read);

        setNotifications((prev) => {
          const target = prev.find((n) => n.id === id);
          if (!target || target.read) return prev;
          return prev.map((n) => (n.id === id ? { ...n, read: true } : n));
        });

        if (wasUnread) {
          setUnreadNotifCount((count) => Math.max(0, count - 1));
        }
      }
    } catch (err) {
      if (activeUserIdRef.current === requestUserId) {
        console.error('[UserDashboard] Failed to mark notification read:', err);
      }
    } finally {
      inFlightNotifIds.current.delete(id);
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    if (isMarkAllInFlight.current) return;

    const requestUserId = currentUserId;
    if (!requestUserId) return;

    isMarkAllInFlight.current = true;
    try {
      const res = await api.notifications.markAllAsRead();
      
      if (activeUserIdRef.current !== requestUserId) return;

      if (res && res.success) {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        setUnreadNotifCount(0);
      }
    } catch (err) {
      if (activeUserIdRef.current === requestUserId) {
        console.error('[UserDashboard] Failed to mark all notifications read:', err);
      }
    } finally {
      isMarkAllInFlight.current = false;
    }
  };

  // Job Alert & Document Form State
  const [alertKeyword, setAlertKeyword] = useState('');
  const [alertCity, setAlertCity] = useState('');
  const [alertJobType, setAlertJobType] = useState('Remote');
  const [alertFrequency, setAlertFrequency] = useState('daily');
  const [docTitle, setDocTitle] = useState('');
  const [docType, setDocType] = useState('CV');
  const [docUploading, setDocUploading] = useState(false);

  useEffect(() => {
    if (initialTab && !getUserDashboardRouteId(window.location.pathname)) {
      setActiveTab(initialTab);
      // Clear a previously saved Professional-menu selection when the parent opens
      // the dashboard on a different destination. The menu then derives the active
      // item from the actual tab/subtab state instead of highlighting a stale item.
      setActiveNavId(null);
    }
  }, [initialTab]);

  // Restore dashboard sections from deep links and browser Back/Forward events.
  useEffect(() => {
    const restoreDashboardRoute = () => {
      const routeId = getUserDashboardRouteId(window.location.pathname);
      if (!routeId) return;
      const route = USER_DASHBOARD_ROUTES[routeId];
      setActiveNavId(routeId);
      setActiveTab(route.tab);
      if (route.subView) setOverviewSubView(route.subView);
      if (route.tab === 'applications' && route.subTab) {
        setAppSubTab(route.subTab as 'submitted' | 'saved' | 'alerts' | 'documents');
      }
      if (route.tab === 'campaigns' && route.subTab) {
        setCampaignSubTab(route.subTab as 'my-campaigns' | 'create' | 'wallet');
      }
      if (route.accountSubTab) setAccountSubTab(route.accountSubTab);
    };
    window.addEventListener('popstate', restoreDashboardRoute);
    return () => window.removeEventListener('popstate', restoreDashboardRoute);
  }, []);

  // Every dashboard destination has a shareable, refresh-safe URL. pushState is
  // used rather than assigning location so the app remains a fast SPA.
  useEffect(() => {
    if (!window.location.pathname.startsWith('/user/dashboard')) return;
    const routeId = getUserDashboardRouteIdForState({
      activeNavId,
      activeTab,
      overviewSubView,
      appSubTab,
      campaignSubTab,
      accountSubTab
    });
    const nextPath = getUserDashboardPath(routeId);
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, '', nextPath);
    }
  }, [activeNavId, activeTab, overviewSubView, appSubTab, campaignSubTab, accountSubTab]);

  // User Profile Form State
  const [profileName, setProfileName] = useState(currentUser.name);
  const [profilePhone, setProfilePhone] = useState(currentUser.phone || '');
  const [profileCompany, setProfileCompany] = useState(currentUser.companyName || '');
  const [profileAddress, setProfileAddress] = useState(currentUser.address || '');
  const [profileBio, setProfileBio] = useState(currentUser.bio || '');
  const [profileExtendedFields, setProfileExtendedFields] = useState<Record<string, string | boolean>>({
    avatarUrl: (currentUser as any).avatarUrl || '', location: (currentUser as any).location || '', city: (currentUser as any).city || '', country: (currentUser as any).country || 'Pakistan',
    headline: (currentUser as any).headline || '', title: (currentUser as any).title || '', website: (currentUser as any).website || '',
    skills: Array.isArray(currentUser.skills) ? currentUser.skills.join(', ') : '', cvUrl: (currentUser as any).cvUrl || '', resumeUrl: (currentUser as any).resumeUrl || '',
    preferences: JSON.stringify((currentUser as any).preferences ?? {}, null, 2), experience: JSON.stringify((currentUser as any).experience ?? [], null, 2),
    education: JSON.stringify((currentUser as any).education ?? [], null, 2), socialLinks: JSON.stringify((currentUser as any).socialLinks ?? {}, null, 2),
    notificationsEnabled: (currentUser as any).notificationsEnabled ?? 'Not recorded', whatsappAlertsEnabled: (currentUser as any).whatsappAlertsEnabled ?? 'Not recorded'
  });

  useEffect(() => {
    setProfileName(currentUser.name || '');
    setProfilePhone(currentUser.phone || '');
    setProfileCompany(currentUser.companyName || '');
    setProfileAddress(currentUser.address || '');
    setProfileBio(currentUser.bio || '');
    setProfileExtendedFields({
      avatarUrl: (currentUser as any).avatarUrl || '', location: (currentUser as any).location || '', city: (currentUser as any).city || '', country: (currentUser as any).country || 'Pakistan',
      headline: (currentUser as any).headline || '', title: (currentUser as any).title || '', website: (currentUser as any).website || '',
      skills: Array.isArray(currentUser.skills) ? currentUser.skills.join(', ') : '', cvUrl: (currentUser as any).cvUrl || '', resumeUrl: (currentUser as any).resumeUrl || '',
      preferences: JSON.stringify((currentUser as any).preferences ?? {}, null, 2), experience: JSON.stringify((currentUser as any).experience ?? [], null, 2),
      education: JSON.stringify((currentUser as any).education ?? [], null, 2), socialLinks: JSON.stringify((currentUser as any).socialLinks ?? {}, null, 2),
      notificationsEnabled: (currentUser as any).notificationsEnabled ?? true, whatsappAlertsEnabled: (currentUser as any).whatsappAlertsEnabled ?? false
    });
  }, [
    currentUser.id,
    currentUser.name,
    currentUser.phone,
    currentUser.companyName,
    currentUser.address,
    currentUser.bio,
    currentUser.avatarUrl,
    currentUser.location,
    currentUser.city,
    currentUser.country,
    currentUser.headline,
    currentUser.title,
    currentUser.website,
    currentUser.skills,
    currentUser.preferences,
    currentUser.experience,
    currentUser.education,
    currentUser.cvUrl,
    currentUser.resumeUrl,
    currentUser.socialLinks,
    currentUser.notificationsEnabled,
    currentUser.whatsappAlertsEnabled
  ]);

  // Password Change Form State
  const [currentPasswordInput, setCurrentPasswordInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');

  // New Job Post Form State
  const [title, setTitle] = useState('');
  const [company, setCompany] = useState(currentUser.companyName || currentUser.name || '');
  const [jobCategory, setJobCategory] = useState<'Private Corporate' | 'Government Sector' | 'Newspaper Classified' | 'International Remote'>('Private Corporate');
  const [jobType, setJobType] = useState<JobType>('Remote');
  const [region, setRegion] = useState<Region>('Pakistan');
  const [province, setProvince] = useState('Punjab');
  const [city, setCity] = useState('Lahore');
  const [district, setDistrict] = useState('Gulberg');
  const [salary, setSalary] = useState('PKR 250,000 - PKR 350,000 / month');
  const [currency, setCurrency] = useState<Currency>('PKR');
  const [experienceLevel, setExperienceLevel] = useState<'Entry' | 'Mid' | 'Senior' | 'Lead' | 'Executive'>('Mid');
  const [department, setDepartment] = useState('Software Development');
  const [tagsInput, setTagsInput] = useState('React, TypeScript, Remote');
  const [description, setDescription] = useState('');
  const [requirementsInput, setRequirementsInput] = useState('');

  // Priority & Placement Boost Options
  const [priorityTier, setPriorityTier] = useState<'standard' | 'urgent' | 'featured' | 'featured_top' | 'future_job' | 'vip_bundle'>('standard');
  const [futureIntakeDate, setFutureIntakeDate] = useState('2026-11-01');

  // Extended Government Sector Form Fields (With Manual Entry Support)
  const [govtDeptPreset, setGovtDeptPreset] = useState(GOVT_DEPT_OPTIONS[0]);
  const [customGovtDept, setCustomGovtDept] = useState('');

  const [govtScalePreset, setGovtScalePreset] = useState(GOVT_SCALE_OPTIONS[5]); // BPS-17
  const [customGovtScale, setCustomGovtScale] = useState('');

  const [govtCadrePreset, setGovtCadrePreset] = useState(GOVT_CADRE_OPTIONS[0]);
  const [customGovtCadre, setCustomGovtCadre] = useState('');

  // Extended Newspaper Classified Ad Form Fields (With Manual Entry Support)
  const [newspaperPreset, setNewspaperPreset] = useState(NEWSPAPER_OPTIONS[0]);
  const [customNewspaper, setCustomNewspaper] = useState('');
  const [clippingImageUrl, setClippingImageUrl] = useState('');
  const [newspaperDate, setNewspaperDate] = useState('2026-08-11');

  // Extended Contact & Benefits Fields
  const [selectedBenefits, setSelectedBenefits] = useState<string[]>(['Health Insurance', 'Remote Work Options', 'EOBI Registration']);
  const [externalApplyUrl, setExternalApplyUrl] = useState('');
  const [contactEmailOrPhone, setContactEmailOrPhone] = useState('');
  const [applicationDeadline, setApplicationDeadline] = useState('');

  // Per-Job Fee Payment Modal State
  const [showFeeInvoiceModal, setShowFeeInvoiceModal] = useState(false);
  const [pendingJobData, setPendingJobData] = useState<Job | null>(null);
  const [calculatedPostingFee, setCalculatedPostingFee] = useState<number | null>(null);
  const [isCalculatingFee, setIsCalculatingFee] = useState<boolean>(false);
  const [calculationError, setCalculationError] = useState<string | null>(null);
  const [tierCalculatedFees, setTierCalculatedFees] = useState<
    Partial<Record<'standard' | 'urgent' | 'featured' | 'featured_top' | 'future_job' | 'vip_bundle', number>>
  >({});
  const [isCalculatingTierFees, setIsCalculatingTierFees] = useState<boolean>(false);
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [jobFeeTid, setJobFeeTid] = useState<string>('');
  const [jobFeeSenderName, setJobFeeSenderName] = useState<string>('');
  const [jobFeeSenderPhone, setJobFeeSenderPhone] = useState<string>('');
  const [jobFeeBankInfo, setJobFeeBankInfo] = useState<string>('');
  const [jobFeeScreenshotUrl, setJobFeeScreenshotUrl] = useState<string>('');
  const [jobFeeNote, setJobFeeNote] = useState<string>('');
  const [isSubmittingFeePayment, setIsSubmittingFeePayment] = useState<boolean>(false);
  const [feePaymentError, setFeePaymentError] = useState<string | null>(null);
  const [customFieldAnswers, setCustomFieldAnswers] = useState<Record<string, string>>({});

  // Public Payment Settings State
  const [publicPaymentSettings, setPublicPaymentSettings] = useState<PublicPaymentSettings | null>(null);
  const [isLoadingPaymentSettings, setIsLoadingPaymentSettings] = useState<boolean>(false);

  const loadPublicPaymentSettings = React.useCallback(async () => {
    setIsLoadingPaymentSettings(true);
    try {
      const res = await api.paymentSettings.get();
      if (res && res.success && res.configured && res.settings) {
        setPublicPaymentSettings(res.settings);
      } else {
        setPublicPaymentSettings(null);
      }
    } catch (err) {
      console.error('[UserDashboard] Failed to load payment settings:', err);
      setPublicPaymentSettings(null);
    } finally {
      setIsLoadingPaymentSettings(false);
    }
  }, []);

  useEffect(() => {
    loadPublicPaymentSettings();
  }, [loadPublicPaymentSettings]);

  useEffect(() => {
    if (showFeeInvoiceModal) {
      loadPublicPaymentSettings();
    }
  }, [showFeeInvoiceModal, loadPublicPaymentSettings]);

  // Enabled Payment Methods from Administrator Configuration (canonical methods map first, fallback to customMethods)
  const enabledPaymentMethods = useMemo((): PublicPaymentMethodConfig[] => {
    if (!publicPaymentSettings || !publicPaymentSettings.isConfigured || !publicPaymentSettings.methods) {
      return [];
    }

    const result: PublicPaymentMethodConfig[] = [];
    const seenIds = new Set<string>();

    const isValidConfig = (m: any): boolean => {
      return Boolean(
        m &&
        m.enabled &&
        typeof m.accountTitle === 'string' &&
        m.accountTitle.trim().length > 0 &&
        typeof m.accountNumber === 'string' &&
        m.accountNumber.trim().length > 0
      );
    };

    // 1. Canonical source: methods map
    const methodsMap = publicPaymentSettings.methods || {};
    const methodsList = Object.values(methodsMap) as PublicPaymentMethodConfig[];
    for (const m of methodsList) {
      if (!m || !m.id) continue;
      const normId = String(m.id).trim().toLowerCase();
      if (!normId) continue;
      if (!seenIds.has(normId)) {
        seenIds.add(normId);
        if (isValidConfig(m)) {
          result.push(m);
        }
      }
    }

    // 2. Backward-compatibility fallback: customMethods (only when ID is missing from canonical methods)
    if (Array.isArray(publicPaymentSettings.customMethods)) {
      for (const cm of publicPaymentSettings.customMethods) {
        if (!cm || !cm.id) continue;
        const normId = String(cm.id).trim().toLowerCase();
        if (!normId) continue;
        if (!seenIds.has(normId)) {
          seenIds.add(normId);
          if (isValidConfig(cm)) {
            result.push(cm);
          }
        }
      }
    }

    return result;
  }, [publicPaymentSettings]);

  const activePaymentMethodConfig = useMemo((): PublicPaymentMethodConfig | null => {
    if (!enabledPaymentMethods || enabledPaymentMethods.length === 0) return null;
    const cleanCurrent = String(paymentMethod || '').trim().toLowerCase();
    if (cleanCurrent) {
      // 1. Method ID first
      const byId = enabledPaymentMethods.find(
        (m) => m.id.toLowerCase() === cleanCurrent
      );
      if (byId) return byId;

      // 2. Method Name for compatibility
      const byName = enabledPaymentMethods.find(
        (m) => m.name.trim().toLowerCase() === cleanCurrent
      );
      if (byName) return byName;
    }
    const defaultFallback = resolveDefaultPaymentMethod(
      enabledPaymentMethods,
      publicPaymentSettings?.defaultMethod
    );
    return defaultFallback || enabledPaymentMethods[0] || null;
  }, [enabledPaymentMethods, paymentMethod, publicPaymentSettings?.defaultMethod]);

  // Track invoice modal sessions and manual user selection
  const prevShowFeeInvoiceModalRef = useRef<boolean>(false);
  const hasUserManuallySelectedMethodRef = useRef<boolean>(false);

  useEffect(() => {
    const isOpening = showFeeInvoiceModal && !prevShowFeeInvoiceModalRef.current;
    prevShowFeeInvoiceModalRef.current = showFeeInvoiceModal;

    if (isOpening) {
      hasUserManuallySelectedMethodRef.current = false;
    }

    if (!showFeeInvoiceModal) return;
    if (enabledPaymentMethods.length === 0) return;

    if (isOpening || !hasUserManuallySelectedMethodRef.current) {
      const defaultMethodConfig = resolveDefaultPaymentMethod(
        enabledPaymentMethods,
        publicPaymentSettings?.defaultMethod
      );
      if (defaultMethodConfig) {
        setPaymentMethod((prev) => {
          const normPrev = String(prev || '').trim().toLowerCase();
          if (
            normPrev === defaultMethodConfig.id.toLowerCase() ||
            normPrev === defaultMethodConfig.name.trim().toLowerCase()
          ) {
            return prev;
          }
          return defaultMethodConfig.id;
        });
      }
    } else {
      // User manually selected a method in this session; preserve it unless disabled
      const isCurrentStillValid = enabledPaymentMethods.some(
        (m) =>
          m.id.toLowerCase() === String(paymentMethod || '').trim().toLowerCase() ||
          m.name.trim().toLowerCase() === String(paymentMethod || '').trim().toLowerCase()
      );
      if (!isCurrentStillValid) {
        const fallback = resolveDefaultPaymentMethod(
          enabledPaymentMethods,
          publicPaymentSettings?.defaultMethod
        );
        if (fallback) {
          setPaymentMethod(fallback.id);
          hasUserManuallySelectedMethodRef.current = false;
        }
      }
    }
  }, [showFeeInvoiceModal, enabledPaymentMethods, publicPaymentSettings?.defaultMethod]);

  // Clear stale custom answers when active payment method changes
  const prevMethodIdRef = useRef<string | undefined>(activePaymentMethodConfig?.id);
  useEffect(() => {
    if (activePaymentMethodConfig?.id !== prevMethodIdRef.current) {
      setCustomFieldAnswers({});
      prevMethodIdRef.current = activePaymentMethodConfig?.id;
    }
  }, [activePaymentMethodConfig?.id]);

  // Chat message input state
  const [newMessageText, setNewMessageText] = useState('');

  // SEO Preview Modal State for User Postings
  const [userJobSeoPreview, setUserJobSeoPreview] = useState<Job | null>(null);

  // Employer Job Applications State (per owned job ID)
  const [expandedJobApps, setExpandedJobApps] = useState<Record<string, boolean>>({});
  const [jobApplicationsByJobId, setJobApplicationsByJobId] = useState<Record<string, JobApplication[]>>({});
  const [jobApplicationsLoading, setJobApplicationsLoading] = useState<Record<string, boolean>>({});
  const [jobApplicationsError, setJobApplicationsError] = useState<Record<string, string>>({});
  const [updatingApplicationId, setUpdatingApplicationId] = useState<string | null>(null);
  const [jobApplicationStatusNotice, setJobApplicationStatusNotice] = useState<
    Record<string, { type: 'success' | 'error'; message: string }>
  >({});

  const isJobOwnedByCurrentEmployer = (job: Job): boolean => {
    if (!currentUser || !currentUser.id) return false;
    const ownerId = String(job.submittedByUserId || (job as any).postedByUserId || '');
    return (
      ownerId === String(currentUser.id) &&
      userJobs.some((uj) => String(uj.id) === String(job.id))
    );
  };

  const handleToggleEmployerJobApplications = async (job: Job) => {
    const jobId = String(job.id);
    if (!isJobOwnedByCurrentEmployer(job)) {
      setJobApplicationsError((prev) => ({
        ...prev,
        [jobId]: 'You can only view applications for jobs owned by your account.'
      }));
      return;
    }

    const willExpand = !expandedJobApps[jobId];
    setExpandedJobApps((prev) => ({ ...prev, [jobId]: willExpand }));
    if (!willExpand) {
      return;
    }

    setJobApplicationsLoading((prev) => ({ ...prev, [jobId]: true }));
    setJobApplicationsError((prev) => {
      const next = { ...prev };
      delete next[jobId];
      return next;
    });

    try {
      const res = onLoadJobApplications
        ? await onLoadJobApplications(jobId)
        : await api.applications.getAll(jobId);

      if (res && res.success && Array.isArray(res.applications)) {
        setJobApplicationsByJobId((prev) => ({
          ...prev,
          [jobId]: res.applications
        }));
      } else {
        setJobApplicationsError((prev) => ({
          ...prev,
          [jobId]: res?.message || 'Failed to load applications for this job.'
        }));
      }
    } catch (err: any) {
      setJobApplicationsError((prev) => ({
        ...prev,
        [jobId]: err?.message || 'Error loading applications for this job.'
      }));
    } finally {
      setJobApplicationsLoading((prev) => ({ ...prev, [jobId]: false }));
    }
  };

  const handleEmployerStatusChange = async (
    job: Job,
    applicationId: string,
    newStatus: string
  ) => {
    const jobId = String(job.id);
    if (!isJobOwnedByCurrentEmployer(job)) {
      setJobApplicationStatusNotice((prev) => ({
        ...prev,
        [jobId]: {
          type: 'error',
          message: 'You can only update applications for jobs owned by your account.'
        }
      }));
      return;
    }

    if (
      !(EMPLOYER_ALLOWED_APP_STATUSES as readonly string[]).includes(newStatus)
    ) {
      return;
    }

    setUpdatingApplicationId(String(applicationId));
    setJobApplicationStatusNotice((prev) => {
      const next = { ...prev };
      delete next[jobId];
      return next;
    });

    try {
      const res = onUpdateApplicationStatus
        ? await onUpdateApplicationStatus(String(applicationId), newStatus, jobId)
        : await api.applications.updateStatus(String(applicationId), newStatus);

      if (res && res.success) {
        const confirmedStatus = (res.application?.status || newStatus) as JobApplication['status'];
        setJobApplicationsByJobId((prev) => {
          const currentList = prev[jobId] || [];
          return {
            ...prev,
            [jobId]: currentList.map((app) =>
              String(app.id) === String(applicationId)
                ? { ...app, ...(res.application || {}), status: confirmedStatus }
                : app
            )
          };
        });
        setJobApplicationStatusNotice((prev) => ({
          ...prev,
          [jobId]: {
            type: 'success',
            message: res.message || `Application status updated to "${confirmedStatus}".`
          }
        }));
      } else {
        setJobApplicationStatusNotice((prev) => ({
          ...prev,
          [jobId]: {
            type: 'error',
            message: res?.message || 'Failed to update application status.'
          }
        }));
      }
    } catch (err: any) {
      setJobApplicationStatusNotice((prev) => ({
        ...prev,
        [jobId]: {
          type: 'error',
          message: err?.message || 'Error updating application status.'
        }
      }));
    } finally {
      setUpdatingApplicationId(null);
    }
  };

  // Authoritative Server-Side Pricing Calculation for All Tiers & Selected Tier
  useEffect(() => {
    let active = true;
    const allTiers: Array<'standard' | 'urgent' | 'featured' | 'featured_top' | 'future_job' | 'vip_bundle'> = [
      'standard',
      'urgent',
      'featured',
      'featured_top',
      'future_job',
      'vip_bundle'
    ];
    setIsCalculatingTierFees(true);

    Promise.all(
      allTiers.map(async (tier) => {
        try {
          const res = await api.pricing.calculateJob({
            priorityTier: tier,
            jobCategory,
            userEmail: currentUser?.email,
            userId: currentUser?.id
          });
          if (res && res.success && res.calculation && typeof res.calculation.finalPrice === 'number') {
            return [tier, res.calculation.finalPrice] as const;
          }
        } catch {}
        return [tier, undefined] as const;
      })
    ).then((entries) => {
      if (!active) return;
      const nextMap: Partial<Record<'standard' | 'urgent' | 'featured' | 'featured_top' | 'future_job' | 'vip_bundle', number>> = {};
      for (const [tier, price] of entries) {
        if (typeof price === 'number') {
          nextMap[tier] = price;
        }
      }
      setTierCalculatedFees(nextMap);
      setIsCalculatingTierFees(false);
    });

    return () => {
      active = false;
    };
  }, [jobCategory, currentUser?.email, currentUser?.id, jobPostingPricing]);

  useEffect(() => {
    let active = true;
    setIsCalculatingFee(true);
    setCalculationError(null);
    setCalculatedPostingFee(null);

    api.pricing.calculateJob({
      priorityTier,
      jobCategory,
      userEmail: currentUser?.email,
      userId: currentUser?.id
    }).then(res => {
      if (!active) return;
      setIsCalculatingFee(false);
      if (res && res.success && res.calculation && typeof res.calculation.finalPrice === 'number') {
        const finalPrice = res.calculation.finalPrice;
        setCalculatedPostingFee(finalPrice);
        setTierCalculatedFees((prev) => ({ ...prev, [priorityTier]: finalPrice }));
      } else {
        setCalculationError('Calculation unavailable');
      }
    }).catch(err => {
      if (!active) return;
      setIsCalculatingFee(false);
      setCalculationError(err?.message || 'Error');
    });

    return () => {
      active = false;
    };
  }, [priorityTier, jobCategory, currentUser?.email, currentUser?.id, jobPostingPricing]);

  const formatServerTierFee = (tier: 'standard' | 'urgent' | 'featured' | 'featured_top' | 'future_job' | 'vip_bundle'): string => {
    const val = tier === priorityTier && calculatedPostingFee !== null ? calculatedPostingFee : tierCalculatedFees[tier];
    if (typeof val === 'number') {
      return val === 0 ? 'Free' : `PKR ${val.toLocaleString()}`;
    }
    if (isCalculatingTierFees || (tier === priorityTier && isCalculatingFee)) {
      return 'Calculating...';
    }
    return 'Unavailable';
  };

  const currentTotalFee = calculatedPostingFee;

  const myApplications = currentUser.appliedJobs && currentUser.appliedJobs.length > 0
    ? currentUser.appliedJobs
    : userApplications.filter(a => a.applicantId === currentUser.id);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileName.trim()) {
      alert('Full name cannot be empty.');
      return;
    }

    let structuredProfile: Record<string, any>;
    try {
      structuredProfile = {
        preferences: JSON.parse(String(profileExtendedFields.preferences || '{}')),
        experience: JSON.parse(String(profileExtendedFields.experience || '[]')),
        education: JSON.parse(String(profileExtendedFields.education || '[]')),
        socialLinks: JSON.parse(String(profileExtendedFields.socialLinks || '{}'))
      };
      // The backend historically accepts experience/education as either structured arrays or legacy text strings.
      // Preserve existing string values rather than forcing old accounts into an incompatible array shape.
      const isValidListOrLegacyText = (value: unknown) => Array.isArray(value) || typeof value === 'string';
      if (!isValidListOrLegacyText(structuredProfile.experience) || !isValidListOrLegacyText(structuredProfile.education) || !structuredProfile.preferences || typeof structuredProfile.preferences !== 'object' || Array.isArray(structuredProfile.preferences) || !structuredProfile.socialLinks || typeof structuredProfile.socialLinks !== 'object' || Array.isArray(structuredProfile.socialLinks)) {
        throw new Error('Preferences and social links must be JSON objects; experience and education must be JSON arrays or legacy text strings.');
      }
    } catch (error: any) {
      alert(error?.message?.includes('JSON') ? 'Please correct the JSON in Preferences, Experience, Education, and Social Links.' : (error?.message || 'Invalid structured profile data.'));
      return;
    }

    const allowedUpdates: Partial<UserAccount> = {
      name: profileName.trim(),
      phone: profilePhone.trim(),
      companyName: profileCompany.trim(),
      address: profileAddress.trim(),
      bio: profileBio.trim(),
      avatarUrl: String(profileExtendedFields.avatarUrl || '').trim(),
      location: String(profileExtendedFields.location || '').trim(),
      city: String(profileExtendedFields.city || '').trim(),
      country: String(profileExtendedFields.country || '').trim(),
      headline: String(profileExtendedFields.headline || '').trim(),
      title: String(profileExtendedFields.title || '').trim(),
      website: String(profileExtendedFields.website || '').trim(),
      skills: String(profileExtendedFields.skills || '').split(',').map((skill) => skill.trim()).filter(Boolean),
      cvUrl: String(profileExtendedFields.cvUrl || '').trim(),
      resumeUrl: String(profileExtendedFields.resumeUrl || '').trim(),
      ...structuredProfile
    };

    if (onUpdateProfile) {
      const ok = await onUpdateProfile(allowedUpdates);
      if (ok !== false) {
        alert('Profile details saved successfully! Email remains fixed as your primary account key.');
      }
    }
  };

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPasswordInput || !newPasswordInput) {
      alert('Please fill out both current and new password fields.');
      return;
    }

    if (newPasswordInput !== confirmPasswordInput) {
      alert('New password and confirm password do not match.');
      return;
    }

    if (newPasswordInput.length < 8) {
      alert('New password must be at least 8 characters long.');
      return;
    }

    if (onChangePassword) {
      const result = await onChangePassword(currentPasswordInput, newPasswordInput);
      const success =
        typeof result === 'object' && result !== null ? result.success : Boolean(result);
      const message =
        typeof result === 'object' && result !== null ? result.message : undefined;
      if (success) {
        alert('Password changed successfully!');
        setCurrentPasswordInput('');
        setNewPasswordInput('');
        setConfirmPasswordInput('');
      } else {
        alert(message || 'Incorrect current password. Please try again.');
      }
    }
  };

  const formCities = React.useMemo(() => {
    const p = (PAKISTAN_LOCATIONS || []).find((loc) => loc && loc.province === province);
    return p && Array.isArray(p.cities) ? p.cities : [];
  }, [province]);

  const formDistricts = React.useMemo(() => {
    const c = (formCities || []).find((ci) => ci && ci.name === city);
    return c && Array.isArray(c.districts) ? c.districts : [];
  }, [city, formCities]);

  const handleJobSubmitInitiate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !description) {
      alert('Please fill out Job Title and Description.');
      return;
    }

    const isGovt = jobCategory === 'Government Sector';
    const isNews = jobCategory === 'Newspaper Classified';

    const resolvedGovtDept = govtDeptPreset === 'Other (Manual Entry)' ? (customGovtDept || 'Government Department') : govtDeptPreset;
    const resolvedGovtScale = govtScalePreset === 'Other (Manual Entry)' ? (customGovtScale || 'BPS Scale') : govtScalePreset;
    const resolvedGovtCadre = govtCadrePreset === 'Other (Manual Entry)' ? (customGovtCadre || 'Public Sector') : govtCadrePreset;
    const resolvedNewspaper = newspaperPreset === 'Other (Manual Entry)' ? (customNewspaper || 'Newspaper Classified') : newspaperPreset;

    const isPinnedTop = priorityTier === 'featured_top' || priorityTier === 'vip_bundle';
    const isUrgent = priorityTier === 'urgent' || priorityTier === 'vip_bundle';
    const isFeatured = priorityTier === 'featured' || priorityTier === 'featured_top' || priorityTier === 'vip_bundle';
    const isFuture = priorityTier === 'future_job' || priorityTier === 'vip_bundle';

    if (isCalculatingFee) {
      alert('Fee calculation is in progress. Please wait a moment...');
      return;
    }

    if (calculationError || calculatedPostingFee === null) {
      alert(calculationError || 'Pricing calculation is unavailable. Please check your connection or try selecting options again.');
      return;
    }

    const totalCalculatedFee = calculatedPostingFee;

    const newJob: Job = {
      id: 'job-user-' + Date.now(),
      title,
      company: company || currentUser.name,
      jobType,
      region,
      province: region === 'Pakistan' ? province : undefined,
      city: region === 'Pakistan' ? city : undefined,
      district: region === 'Pakistan' ? district : undefined,
      salary,
      currency: currency || (region === 'Pakistan' ? 'PKR' : 'USD'),
      experienceLevel: experienceLevel || 'Mid',
      department,
      tags: tagsInput.split(',').map((t) => t.trim()).filter(Boolean),
      description,
      requirements: requirementsInput.split('\n').filter(Boolean),
      benefits: selectedBenefits.length > 0 ? selectedBenefits : ['Health Insurance', 'Remote Flexibility'],
      postedAt: 'Just now',
      applicationsCount: 0,
      status: 'Pending',
      submittedByUserId: currentUser.id,

      // Priority & Placement Options
      priorityTier: (priorityTier === 'future_job' ? 'standard' : priorityTier) as any,
      isPinnedTop,
      urgent: isUrgent,
      featured: isFeatured,
      isFutureJob: isFuture,
      futureIntakeDate: isFuture ? futureIntakeDate : undefined,

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

      // External Details
      applicationUrl: externalApplyUrl || undefined,
      contactEmailOrPhone: contactEmailOrPhone || undefined,
      deadlineDate: applicationDeadline || undefined
    };

    if (totalCalculatedFee > 0) {
      // Require fee payment step
      setPendingJobData(newJob);
      setShowFeeInvoiceModal(true);
    } else {
      // Free posting
      onSubmitJobForApproval(newJob);
      alert('Job submitted successfully! Status: Pending Approval. The admin will verify and publish your job listing.');
      resetJobForm();
    }
  };

  const resetJobFeeProofForm = () => {
    setJobFeeTid('');
    setJobFeeSenderName('');
    setJobFeeSenderPhone('');
    setJobFeeBankInfo('');
    setJobFeeScreenshotUrl('');
    setJobFeeNote('');
    setCustomFieldAnswers({});
    setIsSubmittingFeePayment(false);
    setFeePaymentError(null);
  };

  const handleJobFeeScreenshotChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    const allowedExts = ['jpg', 'jpeg', 'png', 'webp'];

    if (!allowedTypes.includes(file.type.toLowerCase()) || !allowedExts.includes(ext)) {
      setFeePaymentError('Only image files (JPEG, PNG, WebP) are permitted for receipt screenshots.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setFeePaymentError(`Receipt screenshot size exceeds 5MB limit (${(file.size / (1024 * 1024)).toFixed(2)} MB).`);
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setJobFeeScreenshotUrl(reader.result as string);
      setFeePaymentError(null);
    };
    reader.onerror = () => {
      setFeePaymentError('Failed to read image file. Please select a valid receipt screenshot.');
    };
    reader.readAsDataURL(file);
  };

  const handleConfirmFeePayment = async () => {
    if (!pendingJobData || isSubmittingFeePayment) return;

    if (isCalculatingFee) {
      alert('Fee calculation is in progress. Please wait a moment...');
      return;
    }

    if (calculationError || calculatedPostingFee === null) {
      alert(calculationError || 'Pricing calculation is unavailable. Please check your connection or try selecting options again.');
      return;
    }

    const feeToPay = calculatedPostingFee;

    if (feeToPay > 0) {
      if (!publicPaymentSettings || !publicPaymentSettings.isConfigured || enabledPaymentMethods.length === 0) {
        setFeePaymentError('Payment receiving details are currently unconfigured by administration. Manual payment submission is disabled.');
        return;
      }

      if (!activePaymentMethodConfig) {
        setFeePaymentError(`Payment method "${paymentMethod}" is not configured or enabled.`);
        return;
      }

      const reqTid = activePaymentMethodConfig.transactionIdRequired;
      const reqScreenshot = activePaymentMethodConfig.screenshotRequired;
      const reqSenderName = activePaymentMethodConfig.senderNameRequired;
      const reqSenderPhone = activePaymentMethodConfig.senderPhoneRequired;
      const reqNote = activePaymentMethodConfig.proofNoteRequired;

      if (reqTid && !jobFeeTid.trim()) {
        setFeePaymentError(`Please enter the ${activePaymentMethodConfig.transactionIdLabel || 'Transaction ID (TID)'}.`);
        return;
      }

      if (reqScreenshot && !jobFeeScreenshotUrl) {
        setFeePaymentError(`Please upload a ${activePaymentMethodConfig.screenshotLabel || 'Payment Receipt Screenshot'}.`);
        return;
      }

      if (!jobFeeTid.trim() && !jobFeeScreenshotUrl) {
        setFeePaymentError('Please enter a Transaction ID (TID) or upload a payment receipt screenshot as proof.');
        return;
      }

      if (reqSenderName && !jobFeeSenderName.trim()) {
        setFeePaymentError(`Please enter the ${activePaymentMethodConfig.senderNameLabel || 'Sender Full Name'}.`);
        return;
      }

      if (reqSenderPhone && !jobFeeSenderPhone.trim()) {
        setFeePaymentError(`Please enter the ${activePaymentMethodConfig.senderPhoneLabel || 'Sender Mobile / Account Number'}.`);
        return;
      }

      if (reqNote && !jobFeeNote.trim()) {
        setFeePaymentError(`Please enter the ${activePaymentMethodConfig.proofNoteLabel || 'Deposit Note'}.`);
        return;
      }

      // Validate Custom Proof Fields configured by administration
      if (Array.isArray(activePaymentMethodConfig.customFields) && activePaymentMethodConfig.customFields.length > 0) {
        const sortedFields = [...activePaymentMethodConfig.customFields].sort(
          (a, b) => (a.order ?? 0) - (b.order ?? 0)
        );

        for (const cf of sortedFields) {
          const rawVal = customFieldAnswers[cf.id];
          const trimmedVal = typeof rawVal === 'string' ? rawVal.trim() : String(rawVal || '').trim();

          if (cf.required && !trimmedVal) {
            setFeePaymentError(`Please enter the required field "${cf.label}".`);
            return;
          }

          if (trimmedVal) {
            if (trimmedVal.length > 500) {
              setFeePaymentError(`Field "${cf.label}" exceeds maximum allowed length of 500 characters.`);
              return;
            }

            if (cf.type === 'number') {
              const numericClean = trimmedVal.replace(/[\s,]+/g, '');
              if (!/^-?\d+(\.\d+)?$/.test(numericClean)) {
                setFeePaymentError(`Field "${cf.label}" must be a valid number.`);
                return;
              }
            }
          }
        }
      }
    }

    setIsSubmittingFeePayment(true);
    setFeePaymentError(null);

    // Build structured customFieldValues and serialize into proofNote with Admin-compatible format
    const collectedCustomValues: Record<string, string> = {};
    const customLines: string[] = [];

    if (activePaymentMethodConfig && Array.isArray(activePaymentMethodConfig.customFields)) {
      const sortedFields = [...activePaymentMethodConfig.customFields].sort(
        (a, b) => (a.order ?? 0) - (b.order ?? 0)
      );

      for (const cf of sortedFields) {
        const rawVal = customFieldAnswers[cf.id];
        const trimmedVal = typeof rawVal === 'string' ? rawVal.trim() : String(rawVal || '').trim();
        if (trimmedVal) {
          collectedCustomValues[cf.id] = trimmedVal;
          const safeLabel = cf.label.replace(/[\r\n:]+/g, ' ').trim();
          const safeVal = trimmedVal.replace(/[\r\n]+/g, ' ').trim();
          if (safeLabel && safeVal) {
            customLines.push(`${safeLabel}: ${safeVal}`);
          }
        }
      }
    }

    // Sanitize user note so it cannot contain the reserved separator token
    const sanitizedUserNote = jobFeeNote
      .trim()
      .replace(/--+[\s\t]*Custom Proof Details[\s\t]*--+/gi, '[Custom Proof Details]');

    let finalProofNote = sanitizedUserNote;
    if (customLines.length > 0) {
      const header = finalProofNote ? `User Note: ${finalProofNote}` : 'User Note:';
      finalProofNote = `${header}\n\n--- Custom Proof Details ---\n${customLines.join('\n')}`;
    }

    const feePaymentData: FeePaymentData = {
      amount: feeToPay,
      paymentMethod: activePaymentMethodConfig?.id || activePaymentMethodConfig?.name || paymentMethod,
      transactionId: jobFeeTid.trim() || undefined,
      senderName: jobFeeSenderName.trim() || currentUser.name,
      senderPhoneOrAccount: jobFeeSenderPhone.trim() || undefined,
      depositBankOrWalletName: jobFeeBankInfo.trim() || undefined,
      proofScreenshotUrl: jobFeeScreenshotUrl || undefined,
      proofNote: finalProofNote || undefined,
      customFieldValues: Object.keys(collectedCustomValues).length > 0 ? collectedCustomValues : undefined
    };

    try {
      const res = await onSubmitJobForApproval(pendingJobData, feePaymentData);

      if (res && typeof res === 'object' && res.success === false) {
        setFeePaymentError(res.message || 'Payment proof submission could not be completed. Please check details and try again.');
        if (res.job) {
          // Store backend-created pending job so retries reuse the existing job ID
          setPendingJobData(res.job);
        }
        setIsSubmittingFeePayment(false);
        return;
      }

      alert(
        feeToPay === 0
          ? `Job "${pendingJobData.title}" submitted successfully! Status: Pending Verification.`
          : `Payment proof of PKR ${feeToPay.toLocaleString()} via ${activePaymentMethodConfig?.name || feePaymentData.paymentMethod} submitted! Transaction status: Pending Verification. Job "${pendingJobData.title}" submitted to Admin queue for verification.`
      );

      setShowFeeInvoiceModal(false);
      setPendingJobData(null);
      resetJobForm();
      resetJobFeeProofForm();
    } catch (err: any) {
      setFeePaymentError(err?.message || 'Error submitting payment proof.');
    } finally {
      setIsSubmittingFeePayment(false);
    }
  };

  const resetJobForm = () => {
    setTitle('');
    setDescription('');
    setRequirementsInput('');
    setActiveTab('my-jobs');
  };

  const handleProNavigate = (params: {
    id: string;
    tab?: any;
    subView?: any;
    subTab?: any;
    accountSubTab?: 'profile' | 'security';
    isGlobal?: boolean;
    globalTab?: any;
  }) => {
    setActiveNavId(params.id);

    if (params.isGlobal && params.globalTab && onNavigateGlobalTab) {
      onNavigateGlobalTab(params.globalTab);
      return;
    }

    if (params.tab) setActiveTab(params.tab);
    if (params.subView) setOverviewSubView(params.subView);
    if (params.accountSubTab) setAccountSubTab(params.accountSubTab);
    if (params.subTab) {
      if (params.tab === 'applications') setAppSubTab(params.subTab);
      if (params.tab === 'campaigns') setCampaignSubTab(params.subTab);
    }
  };

  const changeOverviewSubView = (subView: 'metrics' | 'recommendations' | 'history') => {
    setOverviewSubView(subView);
    if (navigationMode === 'professional') {
      setActiveNavId(
        subView === 'metrics' ? 'dash-overview' :
        subView === 'recommendations' ? 'jobs-recommended' : 'mem-history'
      );
    }
  };

  const handleLogout = () => {
    // Explicitly do not reset user-scoped preferences here to ensure they persist 
    // for the same account upon next login, as required by the safety check.
    onLogout();
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = newMessageText.trim();
    if (!text) return;
    const ok = await onSendMessageToAdmin(text);
    if (ok !== false) {
      setNewMessageText('');
    }
  };

  // Filter messages for current user
  const myMessages = chatMessages.filter((m) => m.userId === currentUser.id);

  // Recommended Jobs Calculation Engine
  const recommendedJobs = useMemo(() => {
    if (!allJobs || allJobs.length === 0) return [];
    
    // Gather user affinity keywords
    const keywords: string[] = [];
    if (currentUser.skills) {
      keywords.push(...currentUser.skills.map((s) => s.toLowerCase()));
    }
    if (currentUser.name) {
      keywords.push(...currentUser.name.toLowerCase().split(' '));
    }
    if (currentUser.bio) {
      keywords.push(...currentUser.bio.toLowerCase().split(/[\s,]+/));
    }
    // From applied jobs
    userApplications.forEach((app) => {
      if (app.jobTitle) keywords.push(...app.jobTitle.toLowerCase().split(/[\s,]+/));
    });
    // From saved jobs
    if (savedJobIds && savedJobIds.length > 0) {
      const saved = allJobs.filter((j) => savedJobIds.includes(j.id));
      saved.forEach((j) => {
        keywords.push(...(j.title || '').toLowerCase().split(/[\s,]+/));
        (j.tags || []).forEach((t) => keywords.push((t || '').toLowerCase()));
      });
    }

    const stopWords = new Set(['and', 'for', 'the', 'with', 'from', 'into', 'that', 'this', 'jobs', 'remote', 'hybrid', 'lead', 'senior', 'junior']);
    const uniqueKeywords = Array.from(new Set(keywords.filter((k) => k.length > 2 && !stopWords.has(k))));

    return allJobs
      .filter((j) => j.status === 'Approved' || !j.status)
      .map((job) => {
        let matchScore = 60; // base fit
        const matchedReasons: string[] = [];

        const jobText = `${job.title || ''} ${job.description || ''} ${(job.tags || []).join(' ')} ${job.department || ''} ${job.city || ''} ${job.region || ''}`.toLowerCase();
        
        let keywordHits = 0;
        uniqueKeywords.forEach((kw) => {
          if (jobText.includes(kw)) {
            keywordHits++;
          }
        });

        if (keywordHits > 0) {
          matchScore += Math.min(35, keywordHits * 12);
          matchedReasons.push(`Matches ${keywordHits} saved skills & target keywords`);
        }

        if (job.jobType === 'Remote' || job.jobType === 'Hybrid') {
          matchScore += 4;
          matchedReasons.push('High-flexibility Remote/Hybrid role');
        }

        if (job.featured || job.urgent) {
          matchScore += 3;
        }

        const fitPercent = Math.min(99, Math.max(65, matchScore));

        return {
          job,
          fitPercent,
          reasons: matchedReasons.length > 0 ? matchedReasons : ['Matches trending hybrid opportunities in your region']
        };
      })
      .sort((a, b) => b.fitPercent - a.fitPercent)
      .slice(0, 6);
  }, [allJobs, currentUser, userApplications, savedJobIds]);

  // Derived Billing Dates & Times
  const planDisplayName = currentUser.plan || 'Not recorded';
  const activationTimeStr = currentUser.activationDate || 'Not recorded';
  const expiryTimeStr = currentUser.expiryDate || 'Not set';
  const renewalCount =
    typeof currentUser.renewalCount === 'number' && Number.isFinite(currentUser.renewalCount)
      ? currentUser.renewalCount
      : null;
  const userTransactions: PaymentTransaction[] = Array.isArray(currentUser.transactions) ? currentUser.transactions : [];

  // Subscription Plan Expiry & Days Remaining
  const isPlanExpired = useMemo(() => {
    if (currentUser.membershipStatus === 'Expired') return true;
    if (!currentUser.expiryDate) return false;
    const expiryTime = new Date(currentUser.expiryDate).getTime();
    return !isNaN(expiryTime) && expiryTime < Date.now();
  }, [currentUser.membershipStatus, currentUser.expiryDate]);

  const daysRemaining = useMemo(() => {
    if (!currentUser.expiryDate) return null;
    const expiryTime = new Date(currentUser.expiryDate).getTime();
    if (isNaN(expiryTime)) return null;
    return Math.ceil((expiryTime - Date.now()) / (1000 * 60 * 60 * 24));
  }, [currentUser.expiryDate]);

  const membershipStatusLabel = useMemo(() => {
    const status = String(currentUser.membershipStatus || '').trim().toLowerCase();
    if (status === 'revoked') return 'Revoked';
    if (status === 'unpaid') return 'Payment required';
    if (status === 'expired' || isPlanExpired || (daysRemaining !== null && daysRemaining <= 0)) return 'Expired';
    if (status === 'active') return daysRemaining === null ? 'Expiry not recorded' : 'Active & Verified';
    if (status === 'suspended' || status === 'cancelled' || status === 'inactive') {
      return status.charAt(0).toUpperCase() + status.slice(1);
    }
    return 'Status unavailable';
  }, [currentUser.membershipStatus, isPlanExpired, daysRemaining]);

  const membershipStatusClass =
    membershipStatusLabel === 'Active & Verified'
      ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
      : ['Expired', 'Revoked', 'Suspended', 'Cancelled'].includes(membershipStatusLabel)
        ? 'bg-rose-500/10 text-rose-300 border-rose-500/30'
        : membershipStatusLabel === 'Payment required'
          ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
          : 'bg-slate-800 text-slate-300 border-slate-700';

  return (
    <div className={`min-h-screen bg-slate-950 transition-all duration-300 ${navigationMode === 'professional' || navigationMode === 'new' ? 'lg:pl-64 pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pb-0' : navigationMode === 'classic-new' ? 'pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pb-0' : ''}`}>
      
      {(
        <UserDashboardNavigation
          quickActionsOnly={navigationMode === 'classic'}
          variant={navigationMode === 'new' ? 'new' : navigationMode === 'classic-new' ? 'classic-new' : 'professional'}
          quickActions={dashboardNavConfig.quickActions || []}
          userIdentity={currentUser.username || currentUser.email || currentUser.id || ''}
          activeTab={activeTab}
          overviewSubView={overviewSubView}
          appSubTab={appSubTab}
          campaignSubTab={campaignSubTab}
          accountSubTab={accountSubTab}
          activeNavId={activeNavId}
          userRole={currentUser.role}
          counts={{
            applications: userApplications.length,
            recommendedJobs: recommendedJobs.length,
            savedJobs: savedJobsList.length || savedJobIds.length,
            jobAlerts: jobAlerts.length,
            documents: userDocuments.length,
            jobListings: displayUserJobs.length,
            campaigns: userAds.length,
            paymentTransactions: userTransactions.length,
            unreadNotifications: unreadNotifCount
          }}
          onOpenNotifications={() => setShowNotificationDrawer(true)}
          onOpenDeposit={() => setOpenDepositModalTrigger(true)}
          onOpenSubscription={onOpenSubscriptionModal}
          onNavigate={handleProNavigate}
          onLogout={handleLogout}
          isOpen={isProMenuOpen}
          onClose={() => setIsProMenuOpen(false)}
        />
      )}

      <div className="max-w-7xl mx-auto w-full min-w-0 px-3 sm:px-6 lg:px-8 py-3 sm:py-8 space-y-3 sm:space-y-6">
        
        {/* Header Profile Card - UNIFIED ACCOUNT */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl p-3 sm:p-6 text-white shadow-xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 sm:gap-6">
          <div className="flex items-center space-x-2.5 sm:space-x-4 w-full md:w-auto min-w-0">
            {(navigationMode === 'professional' || navigationMode === 'new' || navigationMode === 'classic-new') && (
              <button 
                onClick={() => setIsProMenuOpen(true)}
                aria-label="Open dashboard navigation"
                aria-expanded={isProMenuOpen}
                className="lg:hidden p-2.5 min-h-11 min-w-11 bg-slate-800 border border-slate-700 rounded-xl text-emerald-400 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
              >
                <Menu className="w-4 h-4" /><span className="ml-1 text-[10px] font-black tracking-wide">MENU</span>
              </button>
            )}
            <div className="w-10 h-10 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-gradient-to-tr from-emerald-500 via-teal-400 to-indigo-600 p-0.5 flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0">
              <div className="relative w-full h-full bg-slate-950 rounded-[10px] sm:rounded-[14px] flex items-center justify-center overflow-hidden font-black text-base sm:text-2xl text-emerald-400">
                <span>{(currentUser.name || '?').charAt(0).toUpperCase()}</span>
                {safeProfileAvatarUrl && (
                  <img
                    src={safeProfileAvatarUrl}
                    alt="Profile"
                    referrerPolicy="no-referrer"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                )}
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center space-x-1.5 sm:space-x-2">
                <h2 className="text-base sm:text-2xl font-black truncate">{currentUser.name}</h2>
                <span className="hidden sm:inline-block bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-full">
                  Unified Portal Member
                </span>
              </div>
              <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5 truncate">
                <strong className="text-white font-mono">{currentUser.username || currentUser.email.split('@')[0]}</strong> • {currentUser.email}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2 w-full md:w-auto">
            {showMenuModeSwitcher && (
              <div className="w-full sm:w-auto bg-slate-800/80 border border-slate-700 p-1 rounded-xl flex flex-wrap items-center justify-center shadow-lg mr-0 sm:mr-2" role="group" aria-label="Choose dashboard menu">
                {enabledMenuModes.map((mode) => <button key={mode} type="button" aria-pressed={navigationMode === mode} onClick={() => { setNavigationMode(mode); if (mode === "classic") setActiveNavId(null); }}
                  className={"px-2.5 py-2 rounded-lg text-[9px] font-black transition-all " + (navigationMode === mode ? "bg-emerald-500 text-slate-950 shadow-md" : "text-slate-500 hover:text-slate-300")}>
                  {mode === "classic" ? "CLASSIC" : mode === "professional" ? "PRO MENU" : mode === "new" ? "NEW MENU" : "CLASSIC NEW"}
                </button>)}
              </div>
            )}

            {navigationMode === 'classic' && (
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                aria-expanded={isMobileMenuOpen}
                aria-label="Toggle Classic Navigation Menu"
                className="md:hidden flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-800 text-emerald-400 border border-emerald-500/30 text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-sm"
              >
                {isMobileMenuOpen ? <X className="w-3.5 h-3.5" /> : <Menu className="w-3.5 h-3.5" />}
                <span>MENU</span>
              </button>
            )}
          <button
            onClick={() => setShowNotificationDrawer(!showNotificationDrawer)}
            aria-label="Notifications"
            className="relative p-2.5 sm:px-3 sm:py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs border border-slate-700 transition-colors cursor-pointer flex items-center space-x-1.5"
            title="In-App Notifications"
          >
            <Bell className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">Notifications</span>
            {unreadNotifCount > 0 && (
              <span className="bg-rose-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full animate-pulse">
                {unreadNotifCount}
              </span>
            )}
          </button>
          {navigationMode === 'classic' && (
            <button
              onClick={handleLogout}
              className="px-2.5 sm:px-4 py-1 sm:py-2 rounded-lg sm:rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs border border-slate-700 transition-colors cursor-pointer"
            >
              Log Out
            </button>
          )}
        </div>
      </div>

      {/* Persistent dashboard breadcrumb: keep users oriented and provide a safe return path. */}
      {navigationMode !== 'classic' && (() => {
        const sectionNames: Record<string, string> = {
          overview: 'Overview',
          profile: 'My Account',
          applications: 'Find Jobs / Career',
          'post-job': 'Employer Center',
          'my-jobs': 'Employer Center',
          chat: 'Help & Support',
          campaigns: campaignSubTab === 'wallet' ? 'Wallet & Payments' : 'Ads & Campaigns'
        };
        const pageNames: Record<string, string> = {
          'dash-overview': 'Dashboard Overview',
          'jobs-recommended': 'Recommended Jobs',
          'jobs-applications': 'My Applications',
          'jobs-saved': 'Saved Jobs',
          'jobs-alerts': 'Job Alerts',
          'career-docs': 'My Documents',
          'career-cv': 'CV Builder',
          'emp-post': 'Post a Job',
          'emp-listings': 'My Job Listings & Applicants',
          'emp-verification': 'Business Verification',
          'ads-list': 'My Campaigns',
          'ads-create': 'Create Campaign',
          'mem-wallet': 'Wallet & Balance',
          'membership-plan': 'Membership & Plans',
          'wallet-deposit': 'Add Funds / Deposit',
          'mem-history': 'Payment History',
          'mem-whatsapp': 'WhatsApp & Job Alerts',
          'notifications-center': 'Notifications Center',
          'acc-chat': 'Support Inbox',
          'acc-profile': 'Profile & Preferences',
          'acc-security': 'Security & Password'
        };
        const currentPage = pageNames[activeNavId || ''] || (
          activeTab === 'overview' ? (overviewSubView === 'history' ? 'Payment History' : overviewSubView === 'recommendations' ? 'Recommended Jobs' : 'Dashboard Overview') :
          activeTab === 'profile' ? (accountSubTab === 'security' ? 'Security & Password' : 'Profile & Preferences') :
          activeTab === 'applications' ? ({ submitted: 'My Applications', saved: 'Saved Jobs', alerts: 'Job Alerts', documents: 'My Documents' } as Record<string, string>)[appSubTab] :
          activeTab === 'post-job' ? 'Post a Job' :
          activeTab === 'my-jobs' ? 'My Job Listings & Applicants' :
          activeTab === 'chat' ? 'Support Inbox' :
          ({ 'my-campaigns': 'My Campaigns', create: 'Create Campaign', wallet: 'Wallet & Balance' } as Record<string, string>)[campaignSubTab]
        );
        return (
          <nav aria-label="Dashboard breadcrumb" className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-xs">
            <button type="button" onClick={() => onNavigateGlobalTab?.('jobs')} className="font-bold text-emerald-300 hover:text-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded" title="Go to HybridJobs.pk homepage">HybridJobs.pk</button>
            <span aria-hidden="true" className="text-slate-600">/</span>
            <button type="button" onClick={() => { setActiveTab('overview'); setOverviewSubView('metrics'); setActiveNavId('dash-overview'); }} className="text-slate-300 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded">Dashboard</button>
            <span aria-hidden="true" className="text-slate-600">/</span>
            <span className="text-slate-400">{sectionNames[activeTab] || 'Dashboard'}</span>
            <span aria-hidden="true" className="text-slate-600">/</span>
            <span aria-current="page" className="font-semibold text-white">{currentPage}</span>
            <button type="button" onClick={() => { setActiveTab('overview'); setOverviewSubView('metrics'); setActiveNavId('dash-overview'); }} className="ml-auto rounded-lg border border-slate-700 px-2.5 py-1 text-[10px] font-bold text-slate-300 hover:border-emerald-500/40 hover:text-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400">Back to Dashboard</button>
          </nav>
        );
      })()}

      {/* PERSISTENT GLOBAL QUICK ACTION BAR (VISIBLE ACROSS ALL DASHBOARD TABS) */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 border border-slate-800 rounded-2xl sm:rounded-2xl p-3 sm:p-4 shadow-lg flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <Wallet className="w-3.5 h-3.5 shrink-0" />
            <span className="text-[10px] sm:text-xs font-semibold text-slate-300">Wallet:</span>
            <span className="text-xs sm:text-sm font-black font-mono">
              PKR {(currentUser.walletBalance ?? 0).toLocaleString()}
            </span>
            <span className="text-[10px] sm:text-xs font-bold text-amber-300 ml-1">
              Held: PKR {(currentUser.walletEscrowBalance ?? 0).toLocaleString()}
            </span>
          </div>

          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-[11px]">
            <span className="text-slate-400">Membership:</span>
            <span className={`font-bold flex items-center space-x-1 ${membershipStatusLabel === 'Active & Verified' ? 'text-emerald-400' : membershipStatusLabel === 'Expired' || membershipStatusLabel === 'Revoked' ? 'text-rose-400' : 'text-amber-300'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${membershipStatusLabel === 'Active & Verified' ? 'bg-emerald-400' : membershipStatusLabel === 'Expired' || membershipStatusLabel === 'Revoked' ? 'bg-rose-500' : 'bg-amber-400'}`} />
              <span>{membershipStatusLabel === 'Active & Verified' && daysRemaining !== null ? `${daysRemaining}d Left` : membershipStatusLabel}</span>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 min-[360px]:grid-cols-3 sm:flex sm:flex-wrap items-stretch sm:items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              setActiveNavId('emp-post');
              setActiveTab('post-job');
            }}
            className="w-full sm:w-auto justify-center px-3 sm:px-3.5 py-2 sm:py-1.5 rounded-xl sm:rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold text-[11px] sm:text-xs flex items-center space-x-1 cursor-pointer active:scale-95 transition-all"
            title="Open the existing job posting form"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Post a Job</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveNavId('mem-wallet');
              setActiveTab('campaigns');
              setCampaignSubTab('wallet');
              setOpenDepositModalTrigger(true);
            }}
            className="w-full sm:w-auto justify-center px-3 sm:px-3.5 py-2 sm:py-1.5 rounded-xl sm:rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-[11px] sm:text-xs shadow-md shadow-emerald-500/20 flex items-center space-x-1 cursor-pointer active:scale-95 transition-all"
            title="Deposit funds into your wallet"
          >
            <Plus className="w-3.5 h-3.5 stroke-[3]" />
            <span>Deposit Funds</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveNavId('ads-create');
              setActiveTab('campaigns');
              setCampaignSubTab('create');
            }}
            className="w-full sm:w-auto justify-center px-3 sm:px-3.5 py-2 sm:py-1.5 rounded-xl sm:rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-[11px] sm:text-xs shadow-md shadow-indigo-600/20 flex items-center space-x-1 cursor-pointer active:scale-95 transition-all"
            title="Create and launch a new ad campaign"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-200" />
            <span>Create Campaign</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs - 4-column compact grid on mobile (Classic Mode Only) */}
      {navigationMode === 'classic' && (isMobileMenuOpen || window.innerWidth >= 768) && (
        <div className={`border-b border-slate-800 pb-2 sm:pb-3 transition-all duration-300 ${isMobileMenuOpen ? 'block' : 'hidden md:block'}`}>
          <div className="mb-1.5 flex items-center justify-between px-1"><span className="text-[10px] font-black tracking-wider text-white">MENU</span><span className="truncate text-[9px] text-slate-500">{currentUser.username || currentUser.email}</span></div>
          <div className="flex flex-col md:flex-row gap-1.5 sm:gap-2">
            <div className="grid grid-cols-4 md:flex md:flex-wrap gap-1 sm:gap-2">
              {[
                { id: 'overview', label: 'Dashboard', icon: Receipt },
                { id: 'applications', label: 'Job Center', icon: FileText },
                { id: 'post-job', label: 'Post Job', icon: Plus },
                { id: 'my-jobs', label: 'My Listings', icon: Briefcase },
                { id: 'campaigns', label: 'Ads & Wallet', icon: Megaphone },
                { id: 'profile', label: 'Profile', icon: User },
                { id: 'chat', label: 'Inbox', icon: MessageSquare }
              ].map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    aria-label={`Switch to ${t.label} tab`}
                    onClick={() => {
                      setActiveTab(t.id as any);
                      setIsMobileMenuOpen(false);
                    }}
                    className={`flex flex-col sm:flex-row items-center justify-center space-y-0.5 sm:space-y-0 sm:space-x-1.5 px-1 sm:px-3 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[10px] sm:text-sm font-bold transition-all text-center cursor-pointer ${
                      activeTab === t.id
                        ? 'bg-emerald-500 text-slate-950 shadow-md sm:shadow-lg shadow-emerald-500/20 scale-[1.02]'
                        : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span className="truncate max-w-full">{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 1: ADVANCED SUBSCRIPTION METRICS & PAYMENT HISTORY TABLE */}
      {activeTab === 'overview' && (
        <div className="space-y-3 sm:space-y-6">

          {/* CINEMATIC SUBSCRIPTION & PLAN HERO CARD */}
          <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 border border-slate-800 rounded-xl sm:rounded-3xl p-3.5 sm:p-6 shadow-2xl text-white">
            <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
            <div className="absolute bottom-0 left-1/4 w-60 h-60 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3 sm:pb-4">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] sm:text-xs font-black tracking-wider uppercase flex items-center space-x-1">
                      <Sparkles className="w-3 h-3" />
                      <span>{planDisplayName}</span>
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-bold border ${membershipStatusClass}`}>
                      {membershipStatusLabel === 'Active & Verified' ? '✓ Active & Verified' : membershipStatusLabel}
                    </span>
                  </div>

                  <h3 className="text-base sm:text-2xl font-black text-white tracking-tight flex items-center space-x-2">
                    <span>{planDisplayName} Membership</span>
                    <Crown className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400 fill-amber-400/20 shrink-0" />
                  </h3>
                  <p className="text-[11px] sm:text-xs text-slate-400">
                    Plan features and access depend on your recorded subscription status.
                  </p>
                </div>

                <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                  <button
                    onClick={onRenewSubscription}
                    className={`px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-lg sm:rounded-xl font-black text-xs transition-all active:scale-95 cursor-pointer shadow-lg flex items-center space-x-1.5 ${
                      isPlanExpired
                        ? 'bg-gradient-to-r from-rose-500 via-amber-500 to-rose-600 text-slate-950 shadow-rose-500/30 animate-pulse'
                        : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-emerald-500/20'
                    }`}
                  >
                    <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                    <span>{isPlanExpired ? 'Request Renewal' : 'Renew Subscription'}</span>
                  </button>

                  <button
                    onClick={onOpenSubscriptionModal}
                    className="px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg sm:rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-bold text-xs transition-all cursor-pointer"
                  >
                    Upgrade Plan
                  </button>
                </div>
              </div>

              {/* Expired Alert Notice Banner */}
              {isPlanExpired && (
                <div className="p-3 sm:p-4 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-200 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                  <div className="flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span className="font-semibold">
                      Your Pro subscription expired on {expiryTimeStr}. Renew now to submit new applications, maintain top visibility, and publish job listings.
                    </span>
                  </div>
                  <button
                    onClick={onRenewSubscription}
                    className="px-3 py-1.5 rounded-lg bg-rose-500 text-slate-950 font-black text-xs shrink-0 cursor-pointer shadow-md"
                  >
                    Request Renewal
                  </button>
                </div>
              )}

              {/* 4 Compact Metric Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
                <div className="p-2.5 sm:p-3.5 bg-slate-950/70 border border-slate-800 rounded-lg sm:rounded-xl">
                  <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center justify-between">
                    <span>Plan Type</span>
                    <Sparkles className="w-3 h-3 text-emerald-400" />
                  </div>
                  <div className="text-xs sm:text-base font-black text-emerald-400 mt-1 truncate">
                    {planDisplayName}
                  </div>
                  <div className="text-[9px] text-slate-400 mt-0.5 truncate">Job Portal & CV Engine</div>
                </div>

                <div className="p-2.5 sm:p-3.5 bg-slate-950/70 border border-slate-800 rounded-lg sm:rounded-xl">
                  <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center justify-between">
                    <span>Activation</span>
                    <Clock className="w-3 h-3 text-teal-400" />
                  </div>
                  <div className="text-xs sm:text-sm font-black text-white font-mono mt-1 truncate">
                    {activationTimeStr}
                  </div>
                  <div className="text-[9px] text-teal-400 mt-0.5 truncate">{currentUser.activationDate ? 'Activation recorded' : 'Activation not recorded'}</div>
                </div>

                <div className="p-2.5 sm:p-3.5 bg-slate-950/70 border border-slate-800 rounded-lg sm:rounded-xl">
                  <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center justify-between">
                    <span>Expiry Date</span>
                    <Calendar className="w-3 h-3 text-amber-400" />
                  </div>
                  <div className={`text-xs sm:text-sm font-black font-mono mt-1 truncate ${isPlanExpired ? 'text-rose-400' : 'text-amber-400'}`}>
                    {expiryTimeStr}
                  </div>
                  <div className="text-[9px] text-slate-400 mt-0.5 truncate">
                    {membershipStatusLabel === 'Active & Verified' && daysRemaining !== null ? `${daysRemaining} days left` : membershipStatusLabel === 'Expired' ? 'Validity Ended' : membershipStatusLabel}
                  </div>
                </div>

                <div className="p-2.5 sm:p-3.5 bg-slate-950/70 border border-slate-800 rounded-lg sm:rounded-xl">
                  <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center justify-between">
                    <span>Renewals</span>
                    <RefreshCw className="w-3 h-3 text-indigo-400" />
                  </div>
                  <div className="text-xs sm:text-base font-black text-indigo-400 mt-1 truncate">
                    {renewalCount === null ? 'Not recorded' : `${renewalCount} Cycles`}
                  </div>
                  <div className="text-[9px] text-slate-400 mt-0.5 truncate">Loyalty Counter</div>
                </div>
              </div>

              <div className="p-3 sm:p-4 bg-slate-950/80 rounded-xl sm:rounded-2xl border border-slate-800/90 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-white text-xs sm:text-sm">Subscription Renewal Setting</span>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${currentUser.autoRenew === true ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                    {currentUser.autoRenew === true ? 'Wallet auto-renew ON' : 'Manual renewal'}
                  </span>
                </div>
                <p className="text-[10px] sm:text-xs text-slate-400">
                  Optional: choose a package and explicitly allow the portal to deduct its configured price from your wallet when your current subscription is due. You can turn this off any time.
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <select value={renewalPackageId} onChange={(e) => setRenewalPackageId(e.target.value)} disabled={renewalPreferenceBusy || renewalPackages.length === 0} className="flex-1 min-w-0 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white">
                    {renewalPackages.length === 0 ? <option value="">No active packages available</option> : renewalPackages.map((pkg: any) => <option key={pkg.id} value={pkg.id}>{pkg.name} — PKR {Number(pkg.pricePkr || 0).toLocaleString()} / {pkg.durationDays} days</option>)}
                  </select>
                  {currentUser.autoRenew === true ? (
                    <button type="button" disabled={renewalPreferenceBusy} onClick={async () => {
                      setRenewalPreferenceBusy(true); setRenewalPreferenceMessage('');
                      try {
                        const result: any = await api.users.updateRenewalPreference({ enabled: false });
                        if (!result?.success) throw new Error(result?.message || 'Could not disable auto-renewal.');
                        setRenewalPreferenceMessage('Auto-renewal disabled. Your current plan remains active until expiry.');
                        window.location.reload();
                      } catch (error: any) { setRenewalPreferenceMessage(error?.message || 'Could not update setting.'); }
                      finally { setRenewalPreferenceBusy(false); }
                    }} className="rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{renewalPreferenceBusy ? 'Saving…' : 'Turn Off'}</button>
                  ) : (
                    <button type="button" disabled={renewalPreferenceBusy || !renewalPackageId || isPlanExpired} onClick={async () => {
                      const accepted = window.confirm('I authorize Hybrid Job Portal to automatically deduct the selected package price from my available wallet balance when my current subscription is due. If my balance is insufficient, renewal will fail and I will be notified. I can disable auto-renewal at any time.');
                      if (!accepted) return;
                      setRenewalPreferenceBusy(true); setRenewalPreferenceMessage('');
                      try {
                        const result: any = await api.users.updateRenewalPreference({ enabled: true, packageId: renewalPackageId, consent: true });
                        if (!result?.success) throw new Error(result?.message || 'Could not enable auto-renewal.');
                        setRenewalPreferenceMessage('Auto-renewal enabled with your consent.');
                        window.location.reload();
                      } catch (error: any) { setRenewalPreferenceMessage(error?.message || 'Could not update setting.'); }
                      finally { setRenewalPreferenceBusy(false); }
                    }} className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-black text-slate-950 disabled:opacity-50">{renewalPreferenceBusy ? 'Saving…' : 'Enable Auto-renew'}</button>
                  )}
                </div>
                {renewalPreferenceMessage && <p className="text-[10px] text-emerald-300">{renewalPreferenceMessage}</p>}
              </div>
              <div className="p-3 sm:p-4 bg-slate-950/80 rounded-xl sm:rounded-2xl border border-slate-800/90 space-y-3">
                <div>
                  <span className="font-bold text-white text-xs sm:text-sm">Premium Alert Channels</span>
                  <p className="text-[10px] sm:text-xs text-slate-400 mt-1">Turn on channels you want to receive. Actual email, WhatsApp or SMS delivery requires the matching active subscription feature and configured portal provider.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    { field: 'emailAlertsEnabled', label: 'Email alerts' },
                    { field: 'whatsappAlertsEnabled', label: 'WhatsApp alerts' },
                    { field: 'smsAlertsEnabled', label: 'SMS alerts' }
                  ].map((channel: any) => (
                    <label key={channel.field} className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-300">
                      <span>{channel.label}</span>
                      <input type="checkbox" checked={(currentUser as any)[channel.field] === true} onChange={async (e) => {
                        const enabled = e.target.checked;
                        try {
                          const result: any = await api.users.updateProfile(currentUser.id, { [channel.field]: enabled });
                          if (!result?.success) throw new Error(result?.message || 'Could not save alert preference.');
                          window.location.reload();
                        } catch (error: any) {
                          window.alert(error?.message || 'Could not save alert preference.');
                        }
                      }} />
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Classic mode keeps the legacy overview pills; Professional mode uses the sidebar sub-navigation. */}
          {navigationMode === 'classic' && (
            <div className="flex items-center space-x-1.5 sm:space-x-2 border-b border-slate-800 pb-2.5">
            <button
              onClick={() => changeOverviewSubView('metrics')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                overviewSubView === 'metrics'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20 font-black'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>Plan & Summary</span>
            </button>

            <button
              onClick={() => changeOverviewSubView('recommendations')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                overviewSubView === 'recommendations'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20 font-black'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Job Recommendations ({recommendedJobs.length})</span>
            </button>

            <button
              onClick={() => changeOverviewSubView('history')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                overviewSubView === 'history'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20 font-black'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <History className="w-3.5 h-3.5 text-teal-400" />
              <span>Payment History ({userTransactions.length})</span>
            </button>
          </div>
          )}

          {/* SUB-VIEW 1: METRICS SNEAK-PEEKS */}
          {overviewSubView === 'metrics' && (
            <div className="space-y-4 sm:space-y-6">
              
              {/* Quick Preview of Personalized Job Recommendations */}
              {recommendedJobs.length > 0 && (
                <div className="p-3.5 sm:p-6 bg-slate-900 border border-slate-800 rounded-xl sm:rounded-2xl text-white space-y-3 sm:space-y-4 shadow-xl">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                    <div className="flex items-center space-x-2">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      <h4 className="text-sm sm:text-base font-black">Recommended Openings For You</h4>
                    </div>
                    <button
                      onClick={() => setOverviewSubView('recommendations')}
                      className="text-xs text-emerald-400 hover:text-emerald-300 font-bold flex items-center space-x-1 cursor-pointer"
                    >
                      <span>View All ({recommendedJobs.length})</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {recommendedJobs.slice(0, 3).map(({ job, fitPercent, reasons }) => (
                      <div
                        key={`rec-mini-${job.id}`}
                        className="p-3 bg-slate-950 border border-slate-800 hover:border-emerald-500/50 rounded-xl flex flex-col justify-between space-y-2.5 transition-all text-xs"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              {fitPercent}% Match
                            </span>
                            <span className="text-[10px] text-slate-400">{job.jobType}</span>
                          </div>
                          <div className="font-bold text-white truncate text-xs sm:text-sm">{job.title}</div>
                          <div className="text-[11px] text-slate-400 truncate">{job.company} • {job.city || job.region}</div>
                          <div className="text-[11px] font-bold text-emerald-400 font-mono">{job.salary}</div>
                        </div>

                        <div className="pt-2 border-t border-slate-900 flex items-center justify-between gap-2">
                          {onToggleSaveJob && (
                            <button
                              type="button"
                              onClick={() => onToggleSaveJob(job.id)}
                              className={`p-1.5 rounded-lg border text-xs ${
                                savedJobIds.includes(job.id)
                                  ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                                  : 'bg-slate-900 border-slate-800 text-slate-400'
                              }`}
                              title="Save Job"
                            >
                              <Bookmark className="w-3 h-3" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onSelectJob && onSelectJob(job)}
                            className="flex-1 py-1.5 px-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-lg text-xs font-black flex items-center justify-center space-x-1 transition-all"
                          >
                            <span>View Details</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick Preview of Recent Billing Transactions */}
              <div className="p-3.5 sm:p-6 bg-slate-900 border border-slate-800 rounded-xl sm:rounded-2xl text-white space-y-3 sm:space-y-4 shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                  <div className="flex items-center space-x-2">
                    <History className="w-4 h-4 text-emerald-400" />
                    <h4 className="text-sm sm:text-base font-black">Recent Billing Transactions</h4>
                  </div>
                  <button
                    onClick={() => setOverviewSubView('history')}
                    className="text-xs text-emerald-400 hover:text-emerald-300 font-bold flex items-center space-x-1 cursor-pointer"
                  >
                    <span>View All ({userTransactions.length})</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950 text-slate-400 uppercase text-[9px] font-bold border-b border-slate-800">
                      <tr>
                        <th className="py-2 px-3">Date</th>
                        <th className="py-2 px-3">Item</th>
                        <th className="py-2 px-3">Amount</th>
                        <th className="py-2 px-3">Method</th>
                        <th className="py-2 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {userTransactions.slice(0, 3).map((tx) => (
                        <tr key={tx.id} className="hover:bg-slate-800/40">
                          <td className="py-2.5 px-3 font-mono text-white text-[11px]">{tx.dateTime}</td>
                          <td className="py-2.5 px-3 text-slate-300 font-medium truncate max-w-[160px]">{tx.jobTitleRef || tx.type}</td>
                          <td className="py-2.5 px-3 font-bold text-emerald-400 font-mono">{tx.currency} {tx.amount.toLocaleString()}</td>
                          <td className="py-2.5 px-3 text-slate-400">{tx.paymentMethod}</td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
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
          )}

          {/* SUB-VIEW 2: FULL PERSONALIZED RECOMMENDATIONS */}
          {overviewSubView === 'recommendations' && (
            <div className="p-3.5 sm:p-6 bg-slate-900 border border-slate-800 rounded-xl sm:rounded-2xl text-white space-y-4 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-base font-black flex items-center space-x-2 text-white">
                    <Sparkles className="w-5 h-5 text-amber-400" />
                    <span>Personalized Job Recommendations</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Matched automatically to your profile skills, applied roles, and saved preferences.
                  </p>
                </div>
                <span className="text-xs text-amber-400 font-bold bg-amber-400/10 px-2.5 py-1 rounded-full border border-amber-400/20 self-start sm:self-auto">
                  {recommendedJobs.length} Recommendations Found
                </span>
              </div>

              {recommendedJobs.length === 0 ? (
                <div className="p-8 text-center bg-slate-950 rounded-xl border border-slate-800 text-slate-400 text-xs">
                  No personalized jobs calculated yet. Add skills to your profile or save jobs from the main feed to train recommendations!
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {recommendedJobs.map(({ job, fitPercent, reasons }) => (
                    <div
                      key={`rec-full-${job.id}`}
                      className="p-4 bg-slate-950/80 border border-slate-800 hover:border-emerald-500/50 rounded-xl flex flex-col justify-between space-y-3 transition-all hover:shadow-lg group"
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            {fitPercent}% Match
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {job.jobType} • {job.region}
                          </span>
                        </div>

                        <div>
                          <h4 className="font-bold text-sm text-white group-hover:text-emerald-400 transition-colors line-clamp-1">
                            {job.title}
                          </h4>
                          <p className="text-xs text-slate-400 font-medium">
                            {job.company} • <span className="text-slate-300">{job.city || job.region}</span>
                          </p>
                        </div>

                        <p className="text-xs font-semibold text-emerald-400 font-mono">
                          {job.salary}
                        </p>

                        <div className="text-[10px] text-amber-300/90 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2 flex items-center space-x-1.5">
                          <ThumbsUp className="w-3 h-3 shrink-0 text-amber-400" />
                          <span className="truncate">{reasons[0]}</span>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-900 flex items-center justify-between gap-2">
                        {onToggleSaveJob && (
                          <button
                            type="button"
                            onClick={() => onToggleSaveJob(job.id)}
                            className={`p-2 rounded-lg border text-xs font-medium transition-all ${
                              savedJobIds.includes(job.id)
                                ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                            }`}
                            title="Save Job"
                          >
                            <Bookmark className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => onSelectJob && onSelectJob(job)}
                          className="flex-1 py-2 px-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-lg text-xs font-extrabold flex items-center justify-center space-x-1 transition-all shadow-md"
                        >
                          <span>View Details</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* SUB-VIEW 3: FULL PAYMENT HISTORY */}
          {overviewSubView === 'history' && (
            <div className="p-3.5 sm:p-6 bg-slate-900 border border-slate-800 rounded-xl sm:rounded-2xl text-white space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-base font-black flex items-center space-x-2">
                    <History className="w-5 h-5 text-emerald-400" />
                    <span>Payment History & Billing Transactions</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">Timeline of all subscription renewals and per-job posting fees paid.</p>
                </div>
                <span className="text-xs text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                  {userTransactions.length} Transactions
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-bold border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Date & Time</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4">Reference / Item</th>
                      <th className="py-3 px-4">Amount</th>
                      <th className="py-3 px-4">Payment Method</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {userTransactions.length === 0 ? (
                      <tr><td colSpan={7} className="py-8 px-4 text-center text-slate-400">No payment records yet.</td></tr>
                    ) : userTransactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-800/50 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-semibold text-white">{tx.dateTime}</td>
                        <td className="py-3.5 px-4 font-bold text-emerald-400">{tx.type}</td>
                        <td className="py-3.5 px-4 text-slate-300">{tx.jobTitleRef || tx.adTitleRef || (tx.type === 'Subscription' ? 'Subscription' : tx.type === 'Wallet Deposit' ? 'Wallet Deposit' : '—')}</td>
                        <td className="py-3.5 px-4 font-black text-white font-mono">{tx.currency} {tx.amount.toLocaleString()}</td>
                        <td className="py-3.5 px-4 font-medium text-slate-300">{tx.paymentMethod}</td>
                        <td className="py-3.5 px-4">
                          {(() => {
                            const status = getPaymentStatusPresentation(tx.status);
                            return <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${status.className}`}>{status.label}</span>;
                          })()}
                        </td>
                        <td className="py-3.5 px-4">
                          <button type="button" onClick={() => setSelectedPaymentTransaction(tx)} className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-emerald-300 font-bold text-[10px]">View details</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {selectedPaymentTransaction && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Payment transaction details">
                  <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-slate-900 border border-slate-700 rounded-2xl p-4 sm:p-6 space-y-4 shadow-2xl">
                    <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3">
                      <div>
                        <h3 className="text-base sm:text-lg font-black text-white">Payment Transaction Details</h3>
                        <p className="text-[11px] text-slate-400 mt-1">Reference: {selectedPaymentTransaction.transactionId || selectedPaymentTransaction.id}</p>
                      </div>
                      <button type="button" onClick={() => setSelectedPaymentTransaction(null)} className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white" aria-label="Close details"><X className="w-4 h-4" /></button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      {[
                        ['Date & Time', selectedPaymentTransaction.dateTime],
                        ['Transaction Type', selectedPaymentTransaction.type],
                        ['Amount', `${selectedPaymentTransaction.currency || 'PKR'} ${Number(selectedPaymentTransaction.amount || 0).toLocaleString()}`],
                        ['Payment Method', selectedPaymentTransaction.paymentMethod],
                        ['Status', getPaymentStatusPresentation(selectedPaymentTransaction.status).label],
                        ['Item / Campaign', selectedPaymentTransaction.jobTitleRef || selectedPaymentTransaction.adTitleRef || '—'],
                        ['Sender Name', selectedPaymentTransaction.senderName],
                        ['Sender Account / Phone', selectedPaymentTransaction.senderPhoneOrAccount],
                        ['Bank / Wallet', selectedPaymentTransaction.depositBankOrWalletName],
                        ['Verified At', selectedPaymentTransaction.verifiedAt],
                        ['Verified By', selectedPaymentTransaction.verifiedBy],
                        ['Admin Note', selectedPaymentTransaction.adminNote],
                        ['Rejection Reason', selectedPaymentTransaction.rejectionReason],
                        ['Proof Note', selectedPaymentTransaction.proofNote]
                      ].filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== '').map(([label, value]) => (
                        <div key={label} className="p-3 bg-slate-950 border border-slate-800 rounded-xl min-w-0">
                          <div className="text-[10px] uppercase tracking-wide text-slate-500 font-bold mb-1">{label}</div>
                          <div className="text-slate-200 break-words">{String(value)}</div>
                        </div>
                      ))}
                    </div>
                    {selectedPaymentTransaction.proofScreenshotUrl && (
                      <a href={selectedPaymentTransaction.proofScreenshotUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
                        <FileText className="w-4 h-4" /> View submitted payment proof
                      </a>
                    )}
                    <div className="flex justify-end pt-2 border-t border-slate-800">
                      <button type="button" onClick={() => setSelectedPaymentTransaction(null)} className="px-4 py-2 rounded-lg bg-slate-800 text-slate-200 text-xs font-bold">Close</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      )}

      {/* TAB 2: MY PROFILE & SECURITY */}
      {activeTab === 'profile' && (
        <div className="space-y-4 text-white">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
          
          {/* PROFILE EDIT FORM */}
          {(navigationMode === 'classic' || accountSubTab === 'profile') && (
          <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl sm:rounded-2xl p-3.5 sm:p-6 space-y-4 sm:space-y-6 shadow-xl">
            <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
              <div>
                <h3 className="text-base sm:text-lg font-black text-white flex items-center space-x-2">
                  <User className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
                  <span>My Profile Details</span>
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">
                  Update your contact details and company representation.
                </p>
              </div>
              <span className="text-[10px] uppercase font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full">
                Active Member
              </span>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* FIXED EMAIL ADDRESS INPUT */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center justify-between">
                    <span>Email Address (Fixed Identity)</span>
                    <Lock className="w-3.5 h-3.5 text-amber-400" />
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      value={currentUser.email}
                      disabled
                      readOnly
                      className="w-full px-3.5 py-2.5 bg-slate-950/60 border border-amber-500/30 rounded-xl text-amber-300 font-mono text-xs font-bold cursor-not-allowed opacity-90"
                    />
                    <span className="absolute right-3 top-2.5 text-[10px] font-sans font-bold bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded">
                      FIXED
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Primary account identifier cannot be altered for security auditing.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={profilePhone}
                    onChange={(e) => setProfilePhone(e.target.value)}
                    placeholder="+92 300 0000000"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Company / Organization</label>
                  <input
                    type="text"
                    value={profileCompany}
                    onChange={(e) => setProfileCompany(e.target.value)}
                    placeholder="e.g. Acme Tech Solutions"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-medium"
                  />
                </div>

              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Address / Location</label>
                <input
                  type="text"
                  value={profileAddress}
                  onChange={(e) => setProfileAddress(e.target.value)}
                  placeholder="e.g. Gulberg III, Lahore, Punjab, Pakistan"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Professional Summary / Bio</label>
                <textarea
                  value={profileBio}
                  onChange={(e) => setProfileBio(e.target.value)}
                  rows={3}
                  placeholder="Tell employers or job candidates about yourself or your organization..."
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs leading-relaxed"
                />
              </div>

              <details className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                <summary className="cursor-pointer text-xs font-black text-emerald-300">Additional Profile & Career Details</summary>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                  {(['headline', 'title', 'location', 'city', 'country', 'website', 'avatarUrl', 'cvUrl', 'resumeUrl'] as const).map((field) => (
                    <label key={field} className="block text-xs font-bold text-slate-300">
                      {({ headline: 'Professional Headline', title: 'Professional Title', location: 'Location', city: 'City', country: 'Country', website: 'Website', avatarUrl: 'Profile Image URL', cvUrl: 'CV URL', resumeUrl: 'Resume URL' } as Record<string, string>)[field]}
                      <input value={String(profileExtendedFields[field] || '')} onChange={(e) => setProfileExtendedFields((prev) => ({ ...prev, [field]: e.target.value }))} className="mt-1 w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs font-normal" />
                    </label>
                  ))}
                  <label className="block text-xs font-bold text-slate-300 sm:col-span-2">Skills (comma-separated)
                    <input value={String(profileExtendedFields.skills || '')} onChange={(e) => setProfileExtendedFields((prev) => ({ ...prev, skills: e.target.value }))} placeholder="e.g. React, Communication, Project Management" className="mt-1 w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs font-normal" />
                  </label>
                  {(['preferences', 'experience', 'education', 'socialLinks'] as const).map((field) => (
                    <label key={field} className="block text-xs font-bold text-slate-300 sm:col-span-2">
                      {field === 'socialLinks' ? 'Social Links (JSON object)' : field[0].toUpperCase() + field.slice(1) + (field === 'experience' || field === 'education' ? ' (JSON array)' : ' (JSON object)')}
                      <textarea rows={3} value={String(profileExtendedFields[field] || '')} onChange={(e) => setProfileExtendedFields((prev) => ({ ...prev, [field]: e.target.value }))} className="mt-1 w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs font-mono" />
                    </label>
                  ))}
                  <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3 text-xs text-slate-300">
                    <div className="flex items-center justify-between gap-3"><span>Email / in-app notification preference</span><strong>{typeof profileExtendedFields.notificationsEnabled === 'boolean' ? (profileExtendedFields.notificationsEnabled ? 'Enabled' : 'Disabled') : 'Not recorded'}</strong></div>
                    <div className="flex items-center justify-between gap-3 mt-2"><span>WhatsApp alert preference</span><strong>{typeof profileExtendedFields.whatsappAlertsEnabled === 'boolean' ? (profileExtendedFields.whatsappAlertsEnabled ? 'Enabled' : 'Disabled') : 'Not recorded'}</strong></div>
                  </div>
                </div>
                <p className="text-[10px] text-amber-300/80 mt-3">These legacy preference values are displayed read-only. The current notification delivery routes do not enforce them, so changing them here would incorrectly suggest that email or WhatsApp delivery is controlled by these switches. Other profile fields are saved through the authenticated API; account permissions, wallet, membership, and verification fields remain protected.</p>
              </details>

              <div className="pt-2">
                <button
                  type="submit"
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black text-xs shadow-lg shadow-emerald-500/20 hover:scale-105 transition-all cursor-pointer"
                >
                  Save Profile Changes
                </button>
              </div>
            </form>
          </div>
          )}

          {/* CHANGE PASSWORD & SECURITY FORM */}
          {(navigationMode === 'classic' || accountSubTab === 'security') && (
          <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl sm:rounded-2xl p-3.5 sm:p-6 space-y-4 sm:space-y-6 shadow-xl">
            <div className="border-b border-slate-800 pb-3">
              <h3 className="text-base sm:text-lg font-black text-white flex items-center space-x-2">
                <Key className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
                <span>Security & Change Password</span>
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">
                Update your login password securely.
              </p>
            </div>

            <form onSubmit={handleChangePasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Current Password</label>
                <input
                  type="password"
                  value={currentPasswordInput}
                  onChange={(e) => setCurrentPasswordInput(e.target.value)}
                  required
                  placeholder="Enter your current password"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">New Password</label>
                <input
                  type="password"
                  value={newPasswordInput}
                  onChange={(e) => setNewPasswordInput(e.target.value)}
                  required
                  placeholder="Minimum 6 characters"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPasswordInput}
                  onChange={(e) => setConfirmPasswordInput(e.target.value)}
                  required
                  placeholder="Re-enter new password"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-mono"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 cursor-pointer"
                >
                  Update Password Now
                </button>
              </div>
            </form>
          </div>
          )}

          {/* EMPLOYER BUSINESS VERIFICATION (KYC) CARD */}
          {(navigationMode === 'classic' || accountSubTab === 'profile') && currentUser.role === 'Employer/Job Poster' && (
            <div className="lg:col-span-12 bg-slate-900 border border-slate-800 rounded-xl sm:rounded-2xl p-3.5 sm:p-6 space-y-4 shadow-xl">
              <div className="border-b border-slate-800 pb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-base sm:text-lg font-black text-white flex items-center space-x-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                    <span>Employer Business Verification (KYC)</span>
                  </h3>
                  <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">
                    Verify your business identity to display the Verified Employer badge and build trust with job seekers.
                  </p>
                </div>
                {myKycRequest && (
                  <span className={`text-[10px] uppercase font-bold px-2.5 py-1 rounded-full border ${
                    myKycRequest.status === 'Verified'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : myKycRequest.status === 'Rejected'
                      ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                  }`}>
                    {myKycRequest.status === 'Verified' ? '✓ Verified Employer' : myKycRequest.status === 'Rejected' ? '✕ Verification Rejected' : '⏳ Pending Approval'}
                  </span>
                )}
              </div>

              {isLoadingKyc ? (
                <div className="flex items-center space-x-2 py-4 text-xs text-slate-400">
                  <Clock className="w-4 h-4 animate-spin text-emerald-400" />
                  <span>Loading KYC verification details...</span>
                </div>
              ) : myKycRequest?.status === 'Verified' ? (
                <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-xl p-4 space-y-2">
                  <div className="flex items-center space-x-2 text-emerald-400 font-bold text-sm">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <span>Your Organization is Fully Verified!</span>
                  </div>
                  <p className="text-xs text-slate-300">
                    Your official verification badge is active on all your job postings.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs text-slate-300 border-t border-emerald-500/20">
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase font-bold">Company</span>
                      <span className="font-semibold">{myKycRequest.companyName}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase font-bold">NTN / Tax #</span>
                      <span className="font-mono font-semibold">{myKycRequest.ntnOrTaxNumber}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase font-bold">Verified Date</span>
                      <span className="font-semibold">{myKycRequest.verifiedAt ? new Date(myKycRequest.verifiedAt).toLocaleDateString() : 'Active'}</span>
                    </div>
                  </div>
                </div>
              ) : myKycRequest?.status === 'Pending' ? (
                <div className="bg-amber-950/30 border border-amber-500/30 rounded-xl p-4 space-y-2">
                  <div className="flex items-center space-x-2 text-amber-400 font-bold text-sm">
                    <Clock className="w-5 h-5 text-amber-400" />
                    <span>Verification Request Under Administrative Review</span>
                  </div>
                  <p className="text-xs text-slate-300">
                    Your business documents and NTN registration details are currently being processed by our compliance team. You will be notified once reviewed.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs text-slate-300 border-t border-amber-500/20">
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase font-bold">Submitted Company</span>
                      <span className="font-semibold">{myKycRequest.companyName}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase font-bold">NTN / Tax #</span>
                      <span className="font-mono font-semibold">{myKycRequest.ntnOrTaxNumber}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase font-bold">Status</span>
                      <span className="font-semibold text-amber-400">Pending Review</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {myKycRequest?.status === 'Rejected' && (
                    <div className="bg-rose-950/30 border border-rose-500/30 rounded-xl p-4 space-y-1 text-xs">
                      <div className="flex items-center space-x-2 text-rose-400 font-bold">
                        <AlertCircle className="w-4 h-4 text-rose-400" />
                        <span>Previous Verification Request Rejected</span>
                      </div>
                      <p className="text-slate-300">
                        Reason: <span className="text-rose-300 font-medium">{myKycRequest.rejectionReason || 'Required business tax or company document verification failed.'}</span>
                      </p>
                      <p className="text-slate-400 text-[11px] pt-1">
                        Please review your details below and resubmit with valid verification information.
                      </p>
                    </div>
                  )}

                  {kycSubmitStatus && (
                    <div className={`p-3.5 rounded-xl border text-xs font-medium flex items-center space-x-2 ${
                      kycSubmitStatus.type === 'success'
                        ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-300'
                        : 'bg-rose-950/50 border-rose-500/40 text-rose-300'
                    }`}>
                      {kycSubmitStatus.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
                      <span>{kycSubmitStatus.message}</span>
                    </div>
                  )}

                  <form onSubmit={handleKycSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1">Company / Business Name *</label>
                        <input
                          type="text"
                          value={kycCompany}
                          onChange={(e) => setKycCompany(e.target.value)}
                          required
                          placeholder="Registered Organization Name"
                          className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-medium focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1">Contact Person *</label>
                        <input
                          type="text"
                          value={kycContact}
                          onChange={(e) => setKycContact(e.target.value)}
                          required
                          placeholder="Authorized Representative Name"
                          className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-medium focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1">Contact Phone *</label>
                        <input
                          type="text"
                          value={kycPhone}
                          onChange={(e) => setKycPhone(e.target.value)}
                          required
                          placeholder="+92 300 1234567"
                          className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-mono focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1">NTN / Tax ID Number *</label>
                        <input
                          type="text"
                          value={kycNtn}
                          onChange={(e) => setKycNtn(e.target.value)}
                          required
                          placeholder="e.g. 1234567-8"
                          className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-mono focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1">Company Website *</label>
                        <input
                          type="url"
                          value={kycWebsite}
                          onChange={(e) => setKycWebsite(e.target.value)}
                          required
                          placeholder="https://company.com"
                          className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-medium focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1">SECP Reg # (Optional)</label>
                        <input
                          type="text"
                          value={kycSecp}
                          onChange={(e) => setKycSecp(e.target.value)}
                          placeholder="e.g. 0012345"
                          className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-mono focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">Official Document URL (Optional)</label>
                      <input
                        type="url"
                        value={kycDocUrl}
                        onChange={(e) => setKycDocUrl(e.target.value)}
                        placeholder="https://drive.google.com/... or https://company.com/ntn.pdf"
                        className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-mono focus:ring-2 focus:ring-emerald-500"
                      />
                      <p className="text-[10px] text-slate-500 mt-1">
                        Link to SECP Registration, FBR NTN Certificate, or Business Incorporation Certificate.
                      </p>
                    </div>

                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={isSubmittingKyc}
                        className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black text-xs shadow-lg shadow-emerald-500/20 hover:scale-105 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                      >
                        {isSubmittingKyc && <Clock className="w-3.5 h-3.5 animate-spin text-slate-950" />}
                        <span>{isSubmittingKyc ? 'Submitting Verification...' : 'Submit Verification Request'}</span>
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}

          </div>
        </div>
      )}

      {/* TAB 3: JOB CENTER — SUBMITTED APPLICATIONS, SAVED JOBS, ALERTS & DOCUMENTS */}
      {activeTab === 'applications' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl sm:rounded-2xl p-3.5 sm:p-6 text-white space-y-4 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-base sm:text-lg font-black flex items-center space-x-2">
                <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
                <span>Job Center & Career Management</span>
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">
                Track submitted job applications, your saved job watchlist, customized job alerts, and uploaded CV documents.
              </p>
            </div>
          </div>

          {/* Classic mode keeps the legacy in-page tabs; Professional mode uses the sidebar sub-navigation. */}
          {navigationMode === 'classic' && (
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 border-b border-slate-800 pb-3">
            <button
              onClick={() => setAppSubTab('submitted')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                appSubTab === 'submitted'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20 font-black'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Submitted Applications ({myApplications.length})</span>
            </button>

            <button
              onClick={() => setAppSubTab('saved')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                appSubTab === 'saved'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20 font-black'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <Bookmark className="w-3.5 h-3.5" />
              <span>Saved Jobs ({savedJobsList.length || savedJobIds.length})</span>
            </button>

            <button
              onClick={() => setAppSubTab('alerts')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                appSubTab === 'alerts'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20 font-black'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Job Alerts ({jobAlerts.length})</span>
            </button>

            <button
              onClick={() => setAppSubTab('documents')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                appSubTab === 'documents'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20 font-black'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-teal-400" />
              <span>My Documents & CV ({userDocuments.length})</span>
            </button>
          </div>
          )}

          {/* SUB-TAB 1: SUBMITTED JOB APPLICATIONS */}
          {appSubTab === 'submitted' && (
            <div className="space-y-3">
              {myApplications.length === 0 ? (
                <div className="p-10 text-center bg-slate-950 border border-slate-800 rounded-xl text-slate-500 italic space-y-2">
                  <p className="font-bold text-slate-400 text-sm">No job applications submitted yet.</p>
                  <p className="text-xs">Browse the live job board and click "Apply Now" to submit your CV and application!</p>
                </div>
              ) : (
                <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-900 uppercase text-[10px] text-slate-400 font-bold border-b border-slate-800">
                      <tr>
                        <th className="p-3.5">Job Title & Company</th>
                        <th className="p-3.5">Applied Timestamp</th>
                        <th className="p-3.5">Application Status</th>
                        <th className="p-3.5">Subscription Tier</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {myApplications.map((app) => (
                        <tr key={app.id} className="hover:bg-slate-900/50">
                          <td className="p-3.5">
                            <div className="font-bold text-white text-sm">{app.jobTitle}</div>
                            <div className="text-slate-400 text-xs">{app.companyName}</div>
                          </td>
                          <td className="p-3.5 font-mono text-slate-300">{app.appliedAt}</td>
                          <td className="p-3.5 font-bold text-emerald-400">
                            <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px]">
                              {app.status}
                            </span>
                          </td>
                          <td className="p-3.5">
                            <span className="px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-bold text-[10px]">
                              {app.paymentStatus || 'Subscription Active'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* SUB-TAB 2: SAVED JOBS WATCHLIST */}
          {appSubTab === 'saved' && (
            <div className="space-y-3">
              {savedJobIds.length === 0 && savedJobsList.length === 0 ? (
                <div className="p-10 text-center bg-slate-950 border border-slate-800 rounded-xl text-slate-500 italic space-y-2">
                  <p className="font-bold text-slate-400 text-sm">No saved jobs in your watchlist yet.</p>
                  <p className="text-xs">Click the bookmark icon on any job card from the main feed to pin it here!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {(savedJobsList.length > 0
                    ? savedJobsList
                    : allJobs.filter((j) => savedJobIds.includes(j.id))
                  ).map((sj: any) => (
                    <div key={sj.id} className="p-3.5 bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl flex flex-col justify-between space-y-3 text-xs">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            Saved Job
                          </span>
                          <span className="text-[10px] text-slate-400">{sj.jobType || 'Remote'}</span>
                        </div>
                        <div className="font-bold text-white text-sm truncate">{sj.title || sj.id}</div>
                        <div className="text-[11px] text-slate-400 truncate">{sj.company || 'Direct Employer'} {sj.city ? `• ${sj.city}` : ''}</div>
                        {sj.salary && <div className="text-emerald-400 font-mono font-bold text-[11px]">{sj.salary}</div>}
                      </div>

                      <div className="pt-2 border-t border-slate-900 flex items-center gap-2">
                        {onToggleSaveJob && (
                          <button
                            type="button"
                            onClick={() => onToggleSaveJob(sj.id)}
                            className="px-2.5 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-[10px] font-bold shrink-0 cursor-pointer"
                          >
                            Remove
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            if (onSelectJob) {
                              const found = allJobs.find((j) => String(j.id) === String(sj.id)) || sj;
                              onSelectJob(found);
                            }
                          }}
                          className="flex-1 py-1.5 px-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-lg text-xs font-black flex items-center justify-center space-x-1 transition-all"
                        >
                          <span>View Details</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* SUB-TAB 3: MY JOB ALERTS */}
          {appSubTab === 'alerts' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <div className="lg:col-span-5 bg-slate-950 border border-slate-800 rounded-xl p-3.5 sm:p-5 space-y-3">
                <div className="border-b border-slate-800 pb-2">
                  <h4 className="font-bold text-sm text-white flex items-center space-x-1.5">
                    <Plus className="w-4 h-4 text-emerald-400" />
                    <span>Create New Job Alert</span>
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">Receive instant matching openings in your email inbox.</p>
                </div>

                {onCreateJobAlert && (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!alertKeyword.trim() && !alertCity.trim()) return;
                      const ok = await onCreateJobAlert({
                        keyword: alertKeyword.trim() || undefined,
                        city: alertCity.trim() || undefined,
                        jobType: alertJobType,
                        frequency: alertFrequency,
                        email: currentUser.email
                      });
                      if (ok) {
                        setAlertKeyword('');
                        setAlertCity('');
                      }
                    }}
                    className="space-y-2.5 text-xs"
                  >
                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">Target Keyword / Role</label>
                      <input
                        type="text"
                        value={alertKeyword}
                        onChange={(e) => setAlertKeyword(e.target.value)}
                        placeholder="e.g. React Developer, Account Officer"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-white text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">City / Region Filter</label>
                      <input
                        type="text"
                        value={alertCity}
                        onChange={(e) => setAlertCity(e.target.value)}
                        placeholder="e.g. Lahore, Islamabad, Karachi"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-white text-xs"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-300 mb-1">Work Type</label>
                        <select
                          value={alertJobType}
                          onChange={(e) => setAlertJobType(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-white text-xs"
                        >
                          <option value="Remote">Remote</option>
                          <option value="Hybrid">Hybrid</option>
                          <option value="On-site">On-site</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-300 mb-1">Frequency</label>
                        <select
                          value={alertFrequency}
                          onChange={(e) => setAlertFrequency(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-white text-xs"
                        >
                          <option value="instant">Instant Alerts</option>
                          <option value="daily">Daily Digest</option>
                          <option value="weekly">Weekly Round-up</option>
                        </select>
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs cursor-pointer shadow-md transition-all active:scale-95"
                    >
                      + Save & Activate Alert
                    </button>
                  </form>
                )}
              </div>

              <div className="lg:col-span-7 bg-slate-950 border border-slate-800 rounded-xl p-3.5 sm:p-5 space-y-3">
                <div className="border-b border-slate-800 pb-2 flex items-center justify-between">
                  <h4 className="font-bold text-sm text-white">Active Subscribed Alerts ({jobAlerts.length})</h4>
                  <span className="text-[10px] text-slate-400">Direct Notification Engine</span>
                </div>

                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {jobAlerts.length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-6 text-center">No active job alerts configured yet.</p>
                  ) : (
                    jobAlerts.map((al: any) => (
                      <div key={al.id} className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between gap-2 text-xs">
                        <div className="min-w-0">
                          <div className="font-bold text-white truncate text-xs sm:text-sm">
                            {al.keyword || 'All Target Roles'} {al.city ? `• ${al.city}` : ''}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            Work: {al.jobType || 'Any'} • Schedule: {al.frequency || 'daily'}
                          </div>
                        </div>
                        {onDeleteJobAlert && (
                          <button
                            type="button"
                            onClick={() => onDeleteJobAlert(al.id)}
                            className="px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-[10px] font-bold shrink-0 cursor-pointer"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* SUB-TAB 4: MY DOCUMENTS & CV */}
          {appSubTab === 'documents' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <div className="lg:col-span-5 bg-slate-950 border border-slate-800 rounded-xl p-3.5 sm:p-5 space-y-3">
                <div className="border-b border-slate-800 pb-2">
                  <h4 className="font-bold text-sm text-white flex items-center space-x-1.5">
                    <FileText className="w-4 h-4 text-teal-400" />
                    <span>Upload New Career Document</span>
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">Store resumes, certificates, and cover letters for 1-click applications.</p>
                </div>

                {onAddDocument && (
                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">Document Title (Optional)</label>
                      <input
                        type="text"
                        value={docTitle}
                        onChange={(e) => setDocTitle(e.target.value)}
                        placeholder="e.g. Senior Frontend Resume 2026"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-white text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">Document Category</label>
                      <select
                        value={docType}
                        onChange={(e) => setDocType(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-white text-xs"
                      >
                        <option value="CV">CV / Resume</option>
                        <option value="Cover Letter">Cover Letter</option>
                        <option value="Certificate">Certificate / Degree</option>
                      </select>
                    </div>

                    <label className="block w-full py-3 px-3 text-center rounded-xl bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border border-teal-500/40 font-bold text-xs cursor-pointer transition-all active:scale-95 shadow-md">
                      {docUploading ? 'Uploading Document...' : '+ Choose PDF / DOC / DOCX File'}
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx"
                        className="hidden"
                        disabled={docUploading}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setDocUploading(true);
                          try {
                            await onAddDocument(file, docTitle.trim() || file.name, docType);
                            setDocTitle('');
                          } finally {
                            setDocUploading(false);
                            e.target.value = '';
                          }
                        }}
                      />
                    </label>
                  </div>
                )}
              </div>

              <div className="lg:col-span-7 bg-slate-950 border border-slate-800 rounded-xl p-3.5 sm:p-5 space-y-3">
                <div className="border-b border-slate-800 pb-2 flex items-center justify-between">
                  <h4 className="font-bold text-sm text-white">Stored Career Documents ({userDocuments.length})</h4>
                  <span className="text-[10px] text-slate-400">Vault & Cloud Documents</span>
                </div>

                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {userDocuments.length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-6 text-center">No uploaded documents in your vault yet.</p>
                  ) : (
                    userDocuments.map((doc: any) => (
                      <div key={doc.id} className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between gap-2 text-xs">
                        <div className="min-w-0">
                          <div className="font-bold text-white truncate text-xs sm:text-sm">{doc.title || doc.fileName || doc.id}</div>
                          <div className="text-[11px] text-slate-400 truncate mt-0.5">
                            Type: <span className="text-teal-400 font-semibold">{doc.type || 'CV'}</span> {doc.fileName ? `• ${doc.fileName}` : ''}
                          </div>
                        </div>
                        {onDeleteDocument && (
                          <button
                            type="button"
                            onClick={() => onDeleteDocument(doc.id)}
                            className="px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-[10px] font-bold shrink-0 cursor-pointer"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

        </div>
      )}

      {/* TAB 4: POST NEW JOB FORM */}
      {activeTab === 'post-job' && (
        <form onSubmit={handleJobSubmitInitiate} className="bg-slate-900 border border-slate-800 rounded-xl sm:rounded-2xl p-3.5 sm:p-8 space-y-4 sm:space-y-6 text-white max-w-4xl shadow-2xl">
          <div className="border-b border-slate-800 pb-3 sm:pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
            <div>
              <h3 className="text-base sm:text-xl font-black text-white flex items-center space-x-2">
                <Briefcase className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
                <span>Create Detailed Job Post</span>
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5 sm:mt-1">
                Post corporate openings, public sector government positions, or newspaper classified clipping ads.
              </p>
            </div>
            <span className="text-[11px] sm:text-xs bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-full self-start sm:self-auto">
              {isCalculatingFee
                ? 'Calculating Fee...'
                : calculationError || calculatedPostingFee === null
                ? 'Fee Unavailable'
                : calculatedPostingFee === 0
                ? 'Posting Fee: FREE'
                : `Posting Fee: PKR ${calculatedPostingFee.toLocaleString()}`}
            </span>
          </div>

          {/* SECTION 1: SECTOR & CATEGORY SELECTION - 2x2 on Mobile */}
          <div className="space-y-1.5 sm:space-y-2">
            <label className="block text-[11px] sm:text-xs font-bold text-slate-300 uppercase tracking-wider">
              1. Select Job Sector / Category
            </label>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
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
                  className={`p-2.5 sm:p-3.5 rounded-lg sm:rounded-xl border text-left transition-all cursor-pointer ${
                    jobCategory === cat.id
                      ? 'bg-emerald-500/10 border-emerald-500 text-white shadow-md sm:shadow-lg shadow-emerald-500/10'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="text-base sm:text-xl mb-0.5 sm:mb-1">{cat.icon}</div>
                  <div className="font-bold text-[11px] sm:text-xs text-white truncate">{cat.label}</div>
                  <div className="text-[9px] sm:text-[10px] text-slate-400 mt-0.5 truncate">{cat.desc}</div>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Job Title *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Senior Accounts Officer or Full Stack Engineer"
                  className="w-full px-3 sm:px-3.5 py-2 sm:py-2.5 bg-slate-950 border border-slate-800 rounded-lg sm:rounded-xl text-white text-xs sm:text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Organization / Company Name *</label>
                <input
                  type="text"
                  required
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="Company or Recruiting Agency"
                  className="w-full px-3 sm:px-3.5 py-2 sm:py-2.5 bg-slate-950 border border-slate-800 rounded-lg sm:rounded-xl text-white text-xs sm:text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-4">
              <div>
                <label className="block text-[11px] sm:text-xs font-bold text-slate-300 mb-1 truncate">Job Arrangement</label>
                <select
                  value={jobType}
                  onChange={(e) => setJobType(e.target.value as any)}
                  className="w-full px-2 sm:px-3.5 py-1.5 sm:py-2.5 bg-slate-950 border border-slate-800 rounded-lg sm:rounded-xl text-white text-xs sm:text-sm"
                >
                  <option value="Remote">100% Remote</option>
                  <option value="Hybrid">Hybrid</option>
                  <option value="On-site">On-site</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] sm:text-xs font-bold text-slate-300 mb-1 truncate">Target Region</label>
                <select
                  value={region}
                  onChange={(e) => setRegion(e.target.value as any)}
                  className="w-full px-2 sm:px-3.5 py-1.5 sm:py-2.5 bg-slate-950 border border-slate-800 rounded-lg sm:rounded-xl text-white text-xs sm:text-sm"
                >
                  <option value="Pakistan">🇵🇰 Pakistan</option>
                  <option value="Global">🌐 Global Remote</option>
                  <option value="US">🇺🇸 United States</option>
                  <option value="UK">🇬🇧 United Kingdom</option>
                  <option value="UAE">🇦🇪 UAE</option>
                  <option value="Saudi Arabia">🇸🇦 Saudi Arabia</option>
                  <option value="Canada">🇨🇦 Canada</option>
                  <option value="Europe">🇪🇺 Europe</option>
                  <option value="Australia">🇦🇺 Australia</option>
                </select>
              </div>

              <div className="col-span-2 sm:col-span-1">
                <label className="block text-[11px] sm:text-xs font-bold text-slate-300 mb-1 truncate">Discipline / Sector</label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full px-2 sm:px-3.5 py-1.5 sm:py-2.5 bg-slate-950 border border-slate-800 rounded-lg sm:rounded-xl text-white text-xs sm:text-sm"
                >
                  <option value="Software Development">Software & Technology</option>
                  <option value="Public Administration">Public Administration / Govt</option>
                  <option value="Finance & Accounts">Finance & Accounts</option>
                  <option value="Healthcare">Healthcare & Medicine</option>
                  <option value="Education">Education & Academia</option>
                  <option value="Operations & Logistics">Operations & Logistics</option>
                  <option value="Marketing & Sales">Marketing & Digital Media</option>
                  <option value="Engineering & Construction">Engineering & Construction</option>
                </select>
              </div>
            </div>

            {/* PAKISTAN SUB-DISTRICT UNLOCKED LOCATION SELECTOR - 2 cols on mobile */}
            {region === 'Pakistan' && (
              <div className="p-3 sm:p-4 bg-slate-950 rounded-xl border border-emerald-500/30 space-y-2.5 sm:space-y-3">
                <span className="text-[11px] sm:text-xs font-bold text-emerald-400 uppercase tracking-wider block">
                  🇵🇰 Detailed Location Mapping (Pakistan Sub-Districts)
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                  <div>
                    <label className="block text-[10px] sm:text-xs text-slate-400 mb-1 truncate">Province</label>
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
                      className="w-full px-2 sm:px-3 py-1.5 sm:py-2 bg-slate-900 border border-slate-800 rounded-lg text-white text-xs"
                    >
                      {(PAKISTAN_LOCATIONS || []).map((p) => (
                        <option key={p.province} value={p.province}>{p.province}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] sm:text-xs text-slate-400 mb-1 truncate">City</label>
                    <select
                      value={city}
                      onChange={(e) => {
                        setCity(e.target.value);
                        const c = (formCities || []).find((ci) => ci && ci.name === e.target.value);
                        if (c && Array.isArray(c.districts) && c.districts.length) {
                          setDistrict(c.districts[0]);
                        }
                      }}
                      className="w-full px-2 sm:px-3 py-1.5 sm:py-2 bg-slate-900 border border-slate-800 rounded-lg text-white text-xs"
                    >
                      {(formCities || []).map((c) => (
                        <option key={c.name} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-[10px] sm:text-xs text-slate-400 mb-1 truncate">Sub-District / Area</label>
                    <select
                      value={district}
                      onChange={(e) => setDistrict(e.target.value)}
                      className="w-full px-2 sm:px-3 py-1.5 sm:py-2 bg-slate-900 border border-slate-800 rounded-lg text-white text-xs"
                    >
                      {formDistricts.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* SALARY & CURRENCY SELECTION - 2 cols on mobile */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-4">
              <div>
                <label className="block text-[11px] sm:text-xs font-bold text-slate-300 mb-1 truncate">Currency</label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as Currency)}
                  className="w-full px-2 sm:px-3.5 py-1.5 sm:py-2.5 bg-slate-950 border border-slate-800 rounded-lg sm:rounded-xl text-white text-xs sm:text-sm font-bold"
                >
                  <option value="PKR">PKR (₨ Rupee)</option>
                  <option value="USD">USD ($ USA)</option>
                  <option value="GBP">GBP (£ UK)</option>
                  <option value="EUR">EUR (€ Europe)</option>
                  <option value="AED">AED (Dirham)</option>
                  <option value="SAR">SAR (Riyal)</option>
                  <option value="CAD">CAD ($ Canada)</option>
                  <option value="AUD">AUD ($ Australia)</option>
                </select>
              </div>

              <div className="col-span-1 sm:col-span-2">
                <label className="block text-[11px] sm:text-xs font-bold text-slate-300 mb-1 truncate">Salary Range / Package</label>
                <input
                  type="text"
                  value={salary}
                  onChange={(e) => setSalary(e.target.value)}
                  placeholder="e.g. PKR 150k - 250k / month"
                  className="w-full px-2.5 sm:px-3.5 py-1.5 sm:py-2.5 bg-slate-950 border border-slate-800 rounded-lg sm:rounded-xl text-white text-xs sm:text-sm"
                />
              </div>
            </div>

            {/* DESCRIPTION & REQUIREMENTS */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Job Description & Overview *</label>
              <textarea
                rows={4}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Provide a comprehensive job summary, role expectations, and responsibilities..."
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Requirements (One requirement per line)</label>
              <textarea
                rows={3}
                value={requirementsInput}
                onChange={(e) => setRequirementsInput(e.target.value)}
                placeholder="e.g. 3+ years experience with React & TypeScript&#10;Bachelor's degree in CS or equivalent&#10;Excellent communication skills"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm"
              />
            </div>

            {/* BENEFITS & PERKS MULTI-CHECKBOX */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-300 mb-1">Job Benefits & Perks Offered</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                {[
                  'Health Insurance',
                  'Pension & Gratuity',
                  '100% Remote Work',
                  'Free Medical Cover',
                  'Relocation Allowance',
                  'Annual Bonus',
                  'EOBI Registration',
                  'Education Stipend'
                ].map((benefit) => {
                  const isChecked = selectedBenefits.includes(benefit);
                  return (
                    <button
                      key={benefit}
                      type="button"
                      onClick={() => {
                        if (isChecked) {
                          setSelectedBenefits(selectedBenefits.filter(b => b !== benefit));
                        } else {
                          setSelectedBenefits([...selectedBenefits, benefit]);
                        }
                      }}
                      className={`p-2.5 rounded-lg border text-left flex items-center space-x-2 transition-all cursor-pointer ${
                        isChecked
                          ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                          : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      <input type="checkbox" checked={isChecked} readOnly className="rounded text-emerald-500" />
                      <span className="font-semibold text-[11px] truncate">{benefit}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* APPLICATION CONTACT & DEADLINE */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block font-bold text-slate-300 mb-1">Direct Apply Link (Optional)</label>
                <input
                  type="url"
                  value={externalApplyUrl}
                  onChange={(e) => setExternalApplyUrl(e.target.value)}
                  placeholder="https://company.com/careers"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">HR Contact Email or WhatsApp</label>
                <input
                  type="text"
                  value={contactEmailOrPhone}
                  onChange={(e) => setContactEmailOrPhone(e.target.value)}
                  placeholder="hr@company.com or +92 300 1234567"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Application Deadline</label>
                <input
                  type="date"
                  value={applicationDeadline}
                  onChange={(e) => setApplicationDeadline(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white"
                />
              </div>
            </div>

            {/* SECTION 5: PRIORITY & TOP-OF-BOARD PLACEMENT BOOSTS */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-slate-800 rounded-2xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-800 pb-3">
                <div className="flex items-center space-x-2">
                  <Crown className="w-5 h-5 text-amber-400" />
                  <div>
                    <h4 className="font-bold text-sm text-white">Choose Placement & Visibility Boost</h4>
                    <p className="text-[11px] text-slate-400">Select where and how long your job is highlighted on the public job board</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-slate-400">Total Posting Fee:</span>
                  <div className="text-base font-black text-emerald-400 font-mono">
                    {isCalculatingFee
                      ? 'Calculating...'
                      : calculationError
                      ? 'Error'
                      : currentTotalFee === 0
                      ? 'FREE'
                      : currentTotalFee !== null && currentTotalFee !== undefined
                      ? `PKR ${currentTotalFee.toLocaleString()}`
                      : 'Calculating...'}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                {/* 1. Standard Option */}
                {jobPostingPricing.enableStandard !== false && (
                  <button
                    type="button"
                    onClick={() => setPriorityTier('standard')}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      priorityTier === 'standard'
                        ? 'bg-slate-800 border-slate-400 text-white shadow-lg'
                        : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-white flex items-center space-x-1.5">
                          <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                          <span>Standard Listing</span>
                        </span>
                        <span className="font-mono font-bold text-slate-300">
                          {formatServerTierFee('standard')}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-snug">
                        {jobPostingPricing.standardDescription || 'Regular chronological placement on the public board.'}
                      </p>
                    </div>
                    <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400">
                      <span>Listing Duration:</span>
                      <span className="font-bold text-slate-300 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                        {jobPostingPricing.standardDurationDays || 30} Days
                      </span>
                    </div>
                  </button>
                )}

                {/* 2. Urgent Hiring Boost */}
                {jobPostingPricing.enableUrgent !== false && (
                  <button
                    type="button"
                    onClick={() => setPriorityTier('urgent')}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      priorityTier === 'urgent'
                        ? 'bg-rose-500/20 border-rose-500 text-white shadow-lg shadow-rose-500/10'
                        : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:border-rose-500/40'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-rose-300 flex items-center space-x-1.5">
                          <Flame className="w-3.5 h-3.5 text-rose-400 fill-rose-400" />
                          <span>{jobPostingPricing.urgentBadgeText || '🔥 Urgent Hiring'}</span>
                        </span>
                        <span className="font-mono font-bold text-rose-300">
                          {formatServerTierFee('urgent')}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-snug">
                        {jobPostingPricing.urgentDescription || 'Shows glowing Urgent Flame badge & ranks above regular jobs for instant applicant attention.'}
                      </p>
                    </div>
                    <div className="mt-3 pt-2 border-t border-rose-900/30 flex items-center justify-between text-[10px] text-rose-300">
                      <span>Boost Duration:</span>
                      <span className="font-bold bg-rose-950/60 px-2 py-0.5 rounded border border-rose-800/50">
                        {jobPostingPricing.urgentDurationDays || 15} Days
                      </span>
                    </div>
                  </button>
                )}

                {/* 3. Featured Placement */}
                {jobPostingPricing.enableFeatured !== false && (
                  <button
                    type="button"
                    onClick={() => setPriorityTier('featured')}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      priorityTier === 'featured'
                        ? 'bg-purple-500/20 border-purple-500 text-white shadow-lg shadow-purple-500/10'
                        : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:border-purple-500/40'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-purple-300 flex items-center space-x-1.5">
                          <Star className="w-3.5 h-3.5 text-purple-400 fill-purple-400" />
                          <span>{jobPostingPricing.featuredBadgeText || '⭐ Featured Placement'}</span>
                        </span>
                        <span className="font-mono font-bold text-purple-300">
                          {formatServerTierFee('featured')}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-snug">
                        {jobPostingPricing.featuredDescription || 'Highlighted Featured placement on homepage & board right after Pinned Top.'}
                      </p>
                    </div>
                    <div className="mt-3 pt-2 border-t border-purple-900/30 flex items-center justify-between text-[10px] text-purple-300">
                      <span>Featured Duration:</span>
                      <span className="font-bold bg-purple-950/60 px-2 py-0.5 rounded border border-purple-800/50">
                        {jobPostingPricing.featuredDurationDays || 30} Days
                      </span>
                    </div>
                  </button>
                )}

                {/* 4. Pinned Top of Board */}
                {jobPostingPricing.enableFeaturedTop !== false && (
                  <button
                    type="button"
                    onClick={() => setPriorityTier('featured_top')}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      priorityTier === 'featured_top'
                        ? 'bg-blue-500/20 border-blue-400 text-white shadow-lg shadow-blue-500/10'
                        : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:border-blue-500/40'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-blue-300 flex items-center space-x-1.5">
                          <Pin className="w-3.5 h-3.5 text-blue-400 fill-blue-400" />
                          <span>{jobPostingPricing.pinnedBadgeText || '📌 Pinned Top #1'}</span>
                        </span>
                        <span className="font-mono font-bold text-blue-300">
                          {formatServerTierFee('featured_top')}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-snug">
                        {jobPostingPricing.featuredTopDescription || 'Locks position at the top of search results and homepage cards right after VIP.'}
                      </p>
                    </div>
                    <div className="mt-3 pt-2 border-t border-blue-900/30 flex items-center justify-between text-[10px] text-blue-300">
                      <span>Top Lock Duration:</span>
                      <span className="font-bold bg-blue-950/60 px-2 py-0.5 rounded border border-blue-800/50">
                        {jobPostingPricing.featuredTopDurationDays || 30} Days
                      </span>
                    </div>
                  </button>
                )}

                {/* 5. Future Job Opportunity */}
                {jobPostingPricing.enableFutureJob !== false && (
                  <button
                    type="button"
                    onClick={() => setPriorityTier('future_job')}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      priorityTier === 'future_job'
                        ? 'bg-cyan-500/20 border-cyan-500 text-white shadow-lg shadow-cyan-500/10'
                        : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:border-cyan-500/40'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-cyan-300 flex items-center space-x-1.5">
                          <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                          <span>{jobPostingPricing.futureBadgeText || '🚀 Advance Intake'}</span>
                        </span>
                        <span className="font-mono font-bold text-cyan-300">
                          {formatServerTierFee('future_job')}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-snug">
                        {jobPostingPricing.futureJobDescription || 'Post upcoming openings in advance with batch date countdown. Priority placement above standard listings.'}
                      </p>
                    </div>
                    <div className="mt-3 pt-2 border-t border-cyan-900/30 flex items-center justify-between text-[10px] text-cyan-300">
                      <span>Advance Window:</span>
                      <span className="font-bold bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/50">
                        {jobPostingPricing.futureJobDurationDays || 60} Days
                      </span>
                    </div>
                  </button>
                )}

                {/* 6. VIP All-in-One Bundle */}
                {jobPostingPricing.enableVipBundle !== false && (
                  <button
                    type="button"
                    onClick={() => setPriorityTier('vip_bundle')}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      priorityTier === 'vip_bundle'
                        ? 'bg-amber-500/20 border-amber-500 text-white shadow-lg shadow-amber-500/10'
                        : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:border-amber-500/40'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-amber-300 flex items-center space-x-1.5">
                          <Crown className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                          <span>{jobPostingPricing.vipBadgeText || '👑 VIP All-in-One Power Bundle'}</span>
                        </span>
                        <span className="font-mono font-bold text-amber-300">
                          {formatServerTierFee('vip_bundle')}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-snug">
                        {jobPostingPricing.vipBundleDescription || 'All privileges included: Pinned Top #1 + Urgent Flame Badge + Featured Gold Styling + Advance Intake options.'}
                      </p>
                    </div>
                    <div className="mt-3 pt-2 border-t border-amber-900/30 flex items-center justify-between text-[10px] text-amber-300">
                      <span>Complete VIP Validity:</span>
                      <span className="font-bold bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/50">
                        {jobPostingPricing.vipBundleDurationDays || 45} Days Full Coverage
                      </span>
                    </div>
                  </button>
                )}
              </div>

              {/* Conditional Future Job Date Input */}
              {(priorityTier === 'future_job' || priorityTier === 'vip_bundle') && (
                <div className="p-3.5 bg-cyan-950/20 border border-cyan-500/30 rounded-xl space-y-2">
                  <div className="flex items-center space-x-2 text-cyan-300 font-bold text-xs">
                    <Calendar className="w-4 h-4 text-cyan-400" />
                    <span>Expected Future Intake / Joining Date</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-300 mb-1">Estimated Intake Date or Month</label>
                      <input
                        type="date"
                        value={futureIntakeDate}
                        onChange={(e) => setFutureIntakeDate(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-950 border border-cyan-500/40 rounded-lg text-white text-xs"
                      />
                    </div>
                    <div className="text-[11px] text-slate-400 flex items-center">
                      Candidates can view and register their early interest for your upcoming hiring batch.
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* TAGS INPUT */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Tags / Keywords (Comma separated)</label>
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="React, TypeScript, Remote, BPS-17, Tax Free"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isCalculatingFee || calculatedPostingFee === null || !!calculationError}
            className={`w-full py-4 rounded-xl font-black text-sm shadow-xl transition-all flex items-center justify-center space-x-2 ${
              isCalculatingFee || calculatedPostingFee === null || !!calculationError
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-60'
                : 'bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 shadow-emerald-500/20 cursor-pointer'
            }`}
          >
            <Send className="w-4 h-4" />
            <span>
              {isCalculatingFee
                ? 'Calculating Fee...'
                : calculationError
                ? 'Pricing Error - Select Options Again'
                : currentTotalFee === 0
                ? 'Submit Free Job Listing for Approval'
                : currentTotalFee !== null && currentTotalFee !== undefined
                ? `Proceed to Pay Fee (PKR ${currentTotalFee.toLocaleString()}) & Submit Listing`
                : 'Calculating Fee...'}
            </span>
          </button>
        </form>
      )}

      {/* TAB 3: MY SUBMITTED JOBS */}
      {activeTab === 'my-jobs' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl sm:rounded-2xl p-3.5 sm:p-6 space-y-3 sm:space-y-4 text-white shadow-xl">
          <h3 className="text-base font-bold">My Submitted Job Listings</h3>
          {displayUserJobs.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs bg-slate-950 rounded-xl border border-slate-800">
              You have not submitted any jobs yet. Switch to "Post a New Job" to list a job opening!
            </div>
          ) : (
            <div className="space-y-3">
              {displayUserJobs.map((j) => {
                const jobId = String(j.id);
                const isExpanded = Boolean(expandedJobApps[jobId]);
                const isLoadingApps = Boolean(jobApplicationsLoading[jobId]);
                const appsError = jobApplicationsError[jobId];
                const jobApps = jobApplicationsByJobId[jobId] || [];
                const statusNotice = jobApplicationStatusNotice[jobId];
                const postingEntitlements = (currentUser as any).subscriptionEntitlements || {};
                const hasPostingSlot = (featureId: string) => {
                  const entitlement = postingEntitlements[featureId];
                  const expiry = Date.parse(String(entitlement?.expiresAt || ''));
                  return entitlement?.enabled === true && Number.isFinite(expiry) && expiry > Date.now() && Number(entitlement?.remainingSlots || 0) > 0;
                };

                return (
                  <div key={j.id} className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <h4 className="font-bold text-sm text-white">{j.title}</h4>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            j.status === 'Approved'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : j.status === 'Rejected'
                              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                              : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          }`}>
                            Status: {j.status || 'Pending Approval'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">{j.company} • {j.city ? `${j.city}, ${j.province}` : j.region} • {j.salary}</p>
                        
                        {j.status === 'Rejected' && (
                          <div className="mt-2 p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-lg text-xs text-rose-300 space-y-2">
                            <div><span className="font-bold">Admin Rejection Reason:</span> {j.rejectionReason || 'Please review and correct the submitted details.'}</div>
                            {Array.isArray((j as any).moderationHistory) && (j as any).moderationHistory.length > 0 && (
                              <div className="pt-2 border-t border-rose-500/20 space-y-1.5">
                                <div className="font-bold text-rose-200">Moderation History</div>
                                {(j as any).moderationHistory.map((entry: any, index: number) => (
                                  <div key={index} className="text-[10px] text-rose-100/80">
                                    <span className="font-semibold">{String(entry.action || 'Update').replace(/_/g, ' ')}</span>
                                    {entry.at ? ` • ${new Date(entry.at).toLocaleString()}` : ''}
                                    {entry.actorName ? ` • by ${entry.actorName}` : ''}
                                    {entry.attempt ? ` • attempt ${entry.attempt}` : ''}
                                    {entry.reason ? <div className="whitespace-pre-wrap">{entry.reason}</div> : null}
                                  </div>
                                ))}
                              </div>
                            )}
                            <div className="text-[10px] text-rose-200/80">Resubmissions used: {Number((j as any).resubmissionCount || 0)} / {resubmissionLimit}</div>
                            {Number((j as any).resubmissionCount || 0) < resubmissionLimit && (
                              <button
                                type="button"
                                disabled={resubmittingJobId === jobId}
                                onClick={() => {
                                  setResubmissionDraft({ ...j });
                                }}
                                className="px-3 py-1.5 rounded-lg bg-rose-500/15 border border-rose-400/40 text-rose-200 font-bold disabled:opacity-50"
                              >
                                {resubmittingJobId === jobId ? 'Submitting…' : 'Correct & Resubmit'}
                              </button>
                            )}
                            {Number((j as any).resubmissionCount || 0) >= resubmissionLimit && (
                              <div className="font-semibold">
                                {resubmissionLimit === 0 ? 'Resubmission is currently disabled by the portal administrator.' : 'Maximum resubmission attempts reached. Please contact support.'}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center space-x-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleToggleEmployerJobApplications(j)}
                          className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>
                            {isExpanded
                              ? 'Hide Applications'
                              : `View Applications${
                                  jobApplicationsByJobId[jobId]
                                    ? ` (${jobApplicationsByJobId[jobId].length})`
                                    : typeof j.applicationsCount === 'number'
                                    ? ` (${j.applicationsCount})`
                                    : ''
                                }`}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setUserJobSeoPreview(j)}
                          className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-teal-400 border border-teal-500/30 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer"
                          title="Inspect Google Search SEO Metadata & Schema"
                        >
                          <Globe className="w-3.5 h-3.5" />
                          <span>Google SEO Tag</span>
                        </button>
                      </div>
                    </div>

                    {j.status === 'Pending' && !j.subscriptionSlotFeatureId && (
                      <div className="pt-3 border-t border-slate-800 space-y-2">
                        <p className="text-[10px] text-slate-400">Use an included subscription posting slot on this pending job. The job will still require normal admin approval.</p>
                        <div className="flex flex-wrap gap-2">
                          {[
                            { tier: 'vip' as const, featureId: 'vip_job_posting', label: 'Use VIP Ultimate Slot' },
                            { tier: 'pinned' as const, featureId: 'pinned_job_posting', label: 'Use Pinned Top #1 Slot' },
                            { tier: 'featured' as const, featureId: 'featured_job_posting', label: 'Use Featured Slot' },
                            { tier: 'urgent' as const, featureId: 'urgent_job_posting', label: 'Use Urgent Slot' },
                            { tier: 'future' as const, featureId: 'future_job_posting', label: 'Use Future Job Slot' },
                            { tier: 'premium' as const, featureId: 'premium_job_posting', label: 'Use Premium Slot' }
                          ].filter((option) => hasPostingSlot(option.featureId)).map((option) => (
                            <button key={option.tier} type="button" disabled={postingSlotBusyJobId === jobId} onClick={async () => {
                              const accepted = window.confirm(`Apply one ${option.tier} posting slot to "${j.title}"? One included slot will be used. The job remains pending until admin approval.`);
                              if (!accepted) return;
                              setPostingSlotBusyJobId(jobId);
                              try {
                                const result: any = await api.jobs.redeemSubscriptionSlot(jobId, option.tier);
                                if (!result?.success) throw new Error(result?.message || 'Could not apply posting slot.');
                                window.alert(`Posting slot applied. Remaining slots: ${Number(result.remainingSlots || 0)}. Priority is valid until ${new Date(result.priorityExpiresAt).toLocaleString()} or subscription expiry.`);
                                window.location.reload();
                              } catch (error: any) {
                                window.alert(error?.message || 'Could not apply posting slot.');
                              } finally {
                                setPostingSlotBusyJobId(null);
                              }
                            }} className="px-3 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-[10px] font-bold disabled:opacity-50">
                              {postingSlotBusyJobId === jobId ? 'Applying…' : option.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {j.subscriptionSlotFeatureId && (
                      <p className="text-[10px] text-slate-400 border-t border-slate-800 pt-2">
                        Subscription posting slot: <span className="text-emerald-300 font-bold">{String(j.subscriptionSlotFeatureId).replace(/_job_posting/g, '').replace(/_/g, ' ')}</span>
                        {j.subscriptionSlotExpiresAt ? ` • Priority expires ${new Date(j.subscriptionSlotExpiresAt).toLocaleString()}` : ''}
                      </p>
                    )}
                    {isExpanded && (
                      <div className="pt-3 border-t border-slate-800 space-y-3">
                        {statusNotice && (
                          <div
                            className={`p-2.5 rounded-lg border text-xs font-semibold flex items-center space-x-2 ${
                              statusNotice.type === 'success'
                                ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                                : 'bg-rose-950/60 border-rose-500/40 text-rose-300'
                            }`}
                          >
                            {statusNotice.type === 'success' ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                            ) : (
                              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                            )}
                            <span>{statusNotice.message}</span>
                          </div>
                        )}

                        {isLoadingApps ? (
                          <div className="p-4 text-center text-xs text-slate-400 flex items-center justify-center space-x-2">
                            <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                            <span>Loading applications...</span>
                          </div>
                        ) : appsError ? (
                          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-xs text-rose-300 flex items-center space-x-2">
                            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                            <span>{appsError}</span>
                          </div>
                        ) : jobApps.length === 0 ? (
                          <div className="p-4 text-center text-xs text-slate-400 bg-slate-900/50 rounded-lg border border-slate-800">
                            No applications received for this job yet.
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {jobApps.map((app) => {
                              const currentStatus = String(app.status || 'Pending');
                              const isCustomInitialStatus = !(
                                EMPLOYER_ALLOWED_APP_STATUSES as readonly string[]
                              ).includes(currentStatus);
                              const cvUrl = (app as any).cvFileUrl as string | undefined;

                              return (
                                <div
                                  key={app.id}
                                  className="p-3 bg-slate-900 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                                >
                                  <div className="space-y-1 min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="font-bold text-white">{app.applicantName}</span>
                                      <span className="text-slate-400 font-mono">{app.applicantEmail}</span>
                                      {app.applicantPhone && (
                                        <span className="text-slate-400 font-mono">• {app.applicantPhone}</span>
                                      )}
                                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                        {currentStatus}
                                      </span>
                                    </div>

                                    {app.appliedAt && (
                                      <div className="text-[11px] text-slate-400 font-mono">
                                        Applied: {app.appliedAt}
                                      </div>
                                    )}

                                    {app.coverLetter && (
                                      <p className="text-[11px] text-slate-300 whitespace-pre-wrap mt-1">
                                        {app.coverLetter}
                                      </p>
                                    )}

                                    {cvUrl && (
                                      <div className="pt-1">
                                        <a
                                          href={cvUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="inline-flex items-center space-x-1 text-[11px] font-bold text-teal-400 hover:underline"
                                        >
                                          <FileText className="w-3 h-3" />
                                          <span>View Candidate CV</span>
                                        </a>
                                      </div>
                                    )}
                                  </div>

                                  <div className="flex items-center space-x-2 shrink-0">
                                    <label className="text-[11px] font-bold text-slate-400">
                                      Status:
                                    </label>
                                    <select
                                      value={currentStatus}
                                      disabled={updatingApplicationId === String(app.id)}
                                      onChange={(e) =>
                                        handleEmployerStatusChange(j, String(app.id), e.target.value)
                                      }
                                      className="px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs font-bold focus:outline-none focus:border-emerald-500 disabled:opacity-50"
                                    >
                                      {isCustomInitialStatus && (
                                        <option value={currentStatus} disabled>
                                          {currentStatus}
                                        </option>
                                      )}
                                      {EMPLOYER_ALLOWED_APP_STATUSES.map((statusOption) => (
                                        <option key={statusOption} value={statusOption}>
                                          {statusOption}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: TWO-WAY USER-ADMIN CHAT INBOX SYSTEM */}
      {activeTab === 'chat' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl sm:rounded-2xl p-3.5 sm:p-6 text-white space-y-3 sm:space-y-4 max-w-3xl shadow-2xl">
          <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold flex items-center space-x-2">
                <MessageSquare className="w-5 h-5 text-emerald-400" />
                <span>Admin Support & Verification Chat</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Direct two-way line with portal administration regarding job approvals & support.
              </p>
            </div>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 h-80 overflow-y-auto space-y-3">
            {myMessages.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-500 italic">
                No chat messages yet. Type a message below to reach Admin!
              </div>
            ) : (
              myMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${
                    msg.senderRole === 'user' ? 'items-end' : 'items-start'
                  }`}
                >
                  <div
                    className={`max-w-md p-3 rounded-2xl text-xs space-y-1 ${
                      msg.senderRole === 'user'
                        ? 'bg-emerald-500 text-slate-950 font-medium rounded-tr-none'
                        : 'bg-slate-800 text-slate-100 border border-slate-700 rounded-tl-none'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] opacity-75 gap-3 font-bold">
                      <span>{msg.senderRole === 'user' ? 'You' : 'Portal Admin'}</span>
                      <span>{msg.timestamp}</span>
                    </div>
                    <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                  </div>
                </div>
              ))
            )}
          </div>

          <form onSubmit={handleSendChat} className="flex gap-2">
            <input
              type="text"
              value={newMessageText}
              onChange={(e) => setNewMessageText(e.target.value)}
              placeholder="Type your message to Admin..."
              className="flex-1 px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button
              type="submit"
              className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl flex items-center space-x-1.5 shadow-lg shadow-emerald-500/20 cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>Send</span>
            </button>
          </form>

        </div>
      )}

      {/* TAB 7: SELF-SERVE AD CAMPAIGNS & WALLET */}
      {activeTab === 'campaigns' && (
        <UserCampaignHub
          currentUser={currentUser}
          userAds={userAds}
          allAds={allAds}
          pricingConfig={pricingConfig}
          campaignConfig={campaignConfig}
          initialSubTab={campaignSubTab}
          openDepositModal={openDepositModalTrigger}
          onDepositModalClose={() => setOpenDepositModalTrigger(false)}
          onSubmitCampaign={(newAd, cost) => {
            if (onSubmitCampaign) {
              return onSubmitCampaign(newAd, cost);
            }
            return { success: false };
          }}
          onDepositWallet={async (depositData) => {
            if (onDepositFunds) {
              return await onDepositFunds(depositData);
            }
            return { success: false, message: 'Deposit service unavailable.' };
          }}
          onDeleteCampaign={(adId) => {
            if (onDeleteAd) {
              onDeleteAd(adId);
            }
          }}
          onDuplicateCampaign={(ad) => {
            if (onDuplicateAd) {
              onDuplicateAd(ad);
            }
          }}
          onNavigateGlobalTab={onNavigateGlobalTab}
          onCampaignSubTabChange={(subTab) => {
            setCampaignSubTab(subTab);
            if (navigationMode === 'professional') {
              setActiveNavId(subTab === 'my-campaigns' ? 'ads-list' : subTab === 'create' ? 'ads-create' : 'mem-wallet');
            }
          }}
          showInternalNavigation={navigationMode === 'classic'}
        />
      )}

      {/* JOB POSTING FEE PAYMENT INVOICE MODAL */}
      {showFeeInvoiceModal && pendingJobData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-2.5 sm:p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl max-w-md w-full p-3.5 sm:p-6 space-y-3 sm:space-y-5 text-white shadow-2xl relative animate-in fade-in zoom-in duration-200">
            
            <button
              onClick={() => setShowFeeInvoiceModal(false)}
              className="absolute top-3 sm:top-4 right-3 sm:right-4 text-slate-400 hover:text-white p-1 rounded-lg"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            <div className="flex items-center space-x-2.5 sm:space-x-3 border-b border-slate-800 pb-3 sm:pb-4">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center font-bold shrink-0">
                <Receipt className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="font-extrabold text-sm sm:text-base text-white truncate">Job Posting Fee Required</h3>
                <p className="text-[11px] sm:text-xs text-slate-400 truncate">Admin configured per-job posting fee</p>
              </div>
            </div>

            <div className="p-3 sm:p-4 bg-slate-950 rounded-xl sm:rounded-2xl border border-slate-800 space-y-2 sm:space-y-2.5 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Job Opening:</span>
                <span className="font-bold text-white text-right line-clamp-1">{pendingJobData.title}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Employer / Company:</span>
                <span className="font-bold text-white truncate max-w-[50%]">{pendingJobData.company}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Selected Placement:</span>
                <span className="font-bold text-amber-300 uppercase tracking-wider text-[9px] sm:text-[10px] bg-amber-500/10 px-1.5 sm:px-2 py-0.5 rounded border border-amber-500/20">
                  {pendingJobData.priorityTier ? pendingJobData.priorityTier.replace('_', ' ') : 'Standard Listing'}
                </span>
              </div>
              {pendingJobData.isFutureJob && (
                <div className="flex justify-between text-slate-400">
                  <span>Intake Target:</span>
                  <span className="font-bold text-cyan-300">{pendingJobData.futureIntakeDate || 'Advance Batch'}</span>
                </div>
              )}
              <div className="pt-2 border-t border-slate-800 flex justify-between items-center">
                <span className="font-bold text-slate-300">Total Posting Fee:</span>
                <span className="font-black text-emerald-400 font-mono text-sm sm:text-base">
                  {isCalculatingFee
                    ? 'Calculating...'
                    : calculationError
                    ? 'Error'
                    : calculatedPostingFee === 0
                    ? 'FREE'
                    : calculatedPostingFee !== null && calculatedPostingFee !== undefined
                    ? `PKR ${calculatedPostingFee.toLocaleString()}`
                    : 'Calculating...'}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-[11px] sm:text-xs font-bold text-slate-300 mb-1.5 sm:mb-2">
                Select Payment Method
              </label>
              {isLoadingPaymentSettings ? (
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-400 text-center animate-pulse">
                  Loading administrator payment options...
                </div>
              ) : enabledPaymentMethods.length === 0 ? (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4" /> Payment Options Unavailable
                  </div>
                  <p className="text-[11px] text-slate-300">
                    Payment receiving options are currently unconfigured by administration. Manual payment submission is unavailable.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-1.5 sm:gap-2 text-xs">
                  {enabledPaymentMethods.map((m) => {
                    const isSelected =
                      activePaymentMethodConfig?.id === m.id ||
                      String(paymentMethod).trim().toLowerCase() === m.id.toLowerCase() ||
                      String(paymentMethod).trim().toLowerCase() === m.name.trim().toLowerCase();

                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          hasUserManuallySelectedMethodRef.current = true;
                          setPaymentMethod(m.id);
                          setCustomFieldAnswers({});
                        }}
                        className={`py-2 sm:py-2.5 px-2.5 sm:px-3 rounded-lg sm:rounded-xl font-bold border transition-all text-[11px] sm:text-xs ${
                          isSelected
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                            : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800'
                        }`}
                      >
                        {m.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {calculatedPostingFee !== null && calculatedPostingFee > 0 && activePaymentMethodConfig && (
              <div className="space-y-3 pt-1 border-t border-slate-800/80">
                <div className="bg-slate-950/80 rounded-xl p-3 border border-slate-800 space-y-1.5 text-xs">
                  <div className="text-amber-400 font-bold text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5" /> Deposit Instructions ({activePaymentMethodConfig.name})
                  </div>
                  <div className="text-slate-300 text-[11px] space-y-1 leading-relaxed">
                    <div>
                      <span className="font-bold text-slate-200">Account Title:</span> {activePaymentMethodConfig.accountTitle}
                    </div>
                    <div>
                      <span className="font-bold text-slate-200">Account / Mobile No:</span>{' '}
                      <span className="font-mono text-emerald-400 font-bold">{activePaymentMethodConfig.accountNumber}</span>
                    </div>
                    {activePaymentMethodConfig.bankName && (
                      <div>
                        <span className="font-bold text-slate-200">Bank Name:</span> {activePaymentMethodConfig.bankName}
                      </div>
                    )}
                    {activePaymentMethodConfig.iban && (
                      <div>
                        <span className="font-bold text-slate-200">IBAN:</span>{' '}
                        <span className="font-mono text-cyan-300">{activePaymentMethodConfig.iban}</span>
                      </div>
                    )}
                    {activePaymentMethodConfig.instructions && (
                      <div className="pt-1 text-slate-400 italic text-[10.5px]">
                        {activePaymentMethodConfig.instructions}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      {activePaymentMethodConfig.transactionIdLabel || 'Transaction ID / TID'}{' '}
                      {activePaymentMethodConfig.transactionIdRequired && <span className="text-emerald-400">*</span>}
                    </label>
                    <input
                      type="text"
                      value={jobFeeTid}
                      onChange={(e) => setJobFeeTid(e.target.value)}
                      placeholder={activePaymentMethodConfig.transactionIdPlaceholder || 'e.g. 1029384756'}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 text-xs"
                    />
                    {activePaymentMethodConfig.transactionIdHelpText && (
                      <p className="text-[10px] text-slate-500 mt-0.5">{activePaymentMethodConfig.transactionIdHelpText}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      {activePaymentMethodConfig.senderNameLabel || 'Sender Full Name'}{' '}
                      {activePaymentMethodConfig.senderNameRequired && <span className="text-emerald-400">*</span>}
                    </label>
                    <input
                      type="text"
                      value={jobFeeSenderName}
                      onChange={(e) => setJobFeeSenderName(e.target.value)}
                      placeholder={currentUser.name}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      {activePaymentMethodConfig.senderPhoneLabel || 'Sender Phone / Account'}{' '}
                      {activePaymentMethodConfig.senderPhoneRequired && <span className="text-emerald-400">*</span>}
                    </label>
                    <input
                      type="text"
                      value={jobFeeSenderPhone}
                      onChange={(e) => setJobFeeSenderPhone(e.target.value)}
                      placeholder={activePaymentMethodConfig.senderPhonePlaceholder || 'e.g. 03001234567'}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">Bank / Wallet Name</label>
                    <input
                      type="text"
                      value={jobFeeBankInfo}
                      onChange={(e) => setJobFeeBankInfo(e.target.value)}
                      placeholder="e.g. JazzCash App, Meezan Bank"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 text-xs"
                    />
                  </div>
                </div>

                {/* Dynamic Administrator-Configured Custom Proof Fields */}
                {Array.isArray(activePaymentMethodConfig.customFields) && activePaymentMethodConfig.customFields.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {[...activePaymentMethodConfig.customFields]
                      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                      .map((cf) => (
                        <div key={cf.id}>
                          <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                            {cf.label}{' '}
                            {cf.required ? (
                              <span className="text-emerald-400">*</span>
                            ) : (
                              <span className="text-slate-500 text-[10px]">(Optional)</span>
                            )}
                          </label>
                          <input
                            type={cf.type === 'number' ? 'number' : 'text'}
                            value={customFieldAnswers[cf.id] ?? ''}
                            onChange={(e) =>
                              setCustomFieldAnswers((prev) => ({
                                ...prev,
                                [cf.id]: e.target.value
                              }))
                            }
                            maxLength={500}
                            placeholder={cf.placeholder || `Enter ${cf.label.toLowerCase()}`}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 text-xs"
                          />
                          {cf.helpText && (
                            <p className="text-[10px] text-slate-500 mt-0.5">{cf.helpText}</p>
                          )}
                        </div>
                      ))}
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    {activePaymentMethodConfig.screenshotLabel || 'Receipt Screenshot'}{' '}
                    {activePaymentMethodConfig.screenshotRequired ? (
                      <span className="text-emerald-400">*</span>
                    ) : (
                      <span className="text-slate-500 text-[10px]">(Optional if TID provided)</span>
                    )}
                  </label>
                  {jobFeeScreenshotUrl ? (
                    <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg p-1.5">
                      <img src={jobFeeScreenshotUrl} alt="Receipt preview" className="w-10 h-10 object-cover rounded" />
                      <span className="text-[11px] text-emerald-400 font-semibold truncate flex-1">Screenshot attached</span>
                      <button
                        type="button"
                        onClick={() => setJobFeeScreenshotUrl('')}
                        className="text-slate-400 hover:text-red-400 p-1 text-xs"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <label className="flex items-center justify-center gap-2 bg-slate-950 border border-dashed border-slate-700 hover:border-emerald-500 rounded-lg p-2 cursor-pointer transition-colors text-xs text-slate-400 hover:text-slate-200">
                      <Upload className="w-4 h-4 text-emerald-400" />
                      <span>Upload receipt image (JPEG, PNG, WebP - Max 5MB)</span>
                      <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleJobFeeScreenshotChange} className="hidden" />
                    </label>
                  )}
                  {activePaymentMethodConfig.screenshotHelpText && (
                    <p className="text-[10px] text-slate-500 mt-0.5">{activePaymentMethodConfig.screenshotHelpText}</p>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    {activePaymentMethodConfig.proofNoteLabel || 'Payment Note'}{' '}
                    {activePaymentMethodConfig.proofNoteRequired && <span className="text-emerald-400">*</span>}
                  </label>
                  <input
                    type="text"
                    value={jobFeeNote}
                    onChange={(e) => setJobFeeNote(e.target.value)}
                    placeholder={activePaymentMethodConfig.proofNotePlaceholder || 'Optional details for verification...'}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 text-xs"
                  />
                </div>
              </div>
            )}

            {feePaymentError && (
              <div className="p-2.5 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{feePaymentError}</span>
              </div>
            )}

            <div className="pt-1.5 sm:pt-2">
              <button
                type="button"
                disabled={
                  isCalculatingFee ||
                  calculatedPostingFee === null ||
                  !!calculationError ||
                  isSubmittingFeePayment ||
                  (calculatedPostingFee > 0 && enabledPaymentMethods.length === 0)
                }
                onClick={handleConfirmFeePayment}
                className={`w-full py-2.5 sm:py-3.5 rounded-lg sm:rounded-xl font-black text-xs shadow-xl transition-all ${
                  isCalculatingFee ||
                  calculatedPostingFee === null ||
                  !!calculationError ||
                  isSubmittingFeePayment ||
                  (calculatedPostingFee > 0 && enabledPaymentMethods.length === 0)
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-60'
                    : 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 shadow-emerald-500/20 cursor-pointer active:scale-95'
                }`}
              >
                {isSubmittingFeePayment
                  ? 'Submitting Payment Proof...'
                  : isCalculatingFee
                  ? 'Calculating Fee...'
                  : calculationError
                  ? 'Calculation Error'
                  : calculatedPostingFee === 0
                  ? 'Confirm Free Job Submission'
                  : enabledPaymentMethods.length === 0
                  ? 'Payment Options Unavailable'
                  : calculatedPostingFee !== null && calculatedPostingFee !== undefined
                  ? `Submit Proof & Post Job (PKR ${calculatedPostingFee.toLocaleString()})`
                  : 'Calculating Fee...'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* IN-APP NOTIFICATIONS MODAL / DRAWER */}
      {showNotificationDrawer && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center space-x-2">
                <Bell className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-black text-white">Notifications</h3>
                {unreadNotifCount > 0 && (
                  <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {unreadNotifCount} unread
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-2">
                {unreadNotifCount > 0 && (
                  <button
                    onClick={handleMarkAllNotificationsRead}
                    className="text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
                  >
                    Mark all read
                  </button>
                )}
                <button
                  onClick={() => setShowNotificationDrawer(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-4 overflow-y-auto space-y-3 flex-1">
              {isLoadingNotifications && notifications.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs flex items-center justify-center space-x-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                  <span>Loading notifications...</span>
                </div>
              ) : notifications.length === 0 ? (
                <div className="py-10 text-center space-y-2">
                  <Bell className="w-8 h-8 text-slate-600 mx-auto" />
                  <p className="text-sm font-semibold text-slate-400">No notifications yet</p>
                  <p className="text-xs text-slate-500">You will receive updates here regarding your job applications, postings, and account status.</p>
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`p-3.5 rounded-xl border transition-all space-y-1.5 ${
                      n.read
                        ? 'bg-slate-950/40 border-slate-800/80 text-slate-400'
                        : n.type === 'success'
                        ? 'bg-emerald-950/20 border-emerald-500/40 text-slate-200'
                        : n.type === 'warning'
                        ? 'bg-amber-950/20 border-amber-500/40 text-slate-200'
                        : 'bg-slate-950 border-slate-700 text-slate-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center space-x-2">
                        {!n.read && (
                          <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                        )}
                        <h4 className="text-xs sm:text-sm font-bold text-white">{n.title}</h4>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono shrink-0">
                        {n.createdAt ? new Date(n.createdAt).toLocaleString() : ''}
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed">{n.message}</p>

                    {!n.read && (
                      <div className="pt-1 flex justify-end">
                        <button
                          onClick={() => handleMarkNotificationRead(n.id)}
                          className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
                        >
                          Mark as read
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {resubmissionDraft && (
        <div className="fixed inset-0 z-[90] bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
          <div className="w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-2xl border border-rose-500/30 bg-slate-900 shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-800 bg-slate-950 px-4 py-3">
              <div>
                <h3 className="text-sm font-black text-white">Correct & Resubmit Job</h3>
                <p className="text-[10px] text-slate-400">Review the admin's reason, correct all relevant details and send the job back for review. Your moderation history is retained.</p>
              </div>
              <button type="button" onClick={() => setResubmissionDraft(null)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-5 p-4">
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 text-xs text-rose-200">
                <strong>Admin's correction request:</strong>
                <p className="mt-1 whitespace-pre-wrap">{resubmissionDraft.rejectionReason || 'Please review the job details and correct any missing or inaccurate information.'}</p>
              </div>

              <section className="space-y-3">
                <h4 className="border-b border-slate-800 pb-2 text-xs font-black uppercase tracking-wide text-emerald-300">Basic job information</h4>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="text-xs font-semibold text-slate-300">Job Title *
                    <input value={resubmissionDraft.title || ''} onChange={(e) => updateResubmissionField('title', e.target.value)} maxLength={180} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white" />
                  </label>
                  <label className="text-xs font-semibold text-slate-300">Company / Employer *
                    <input value={resubmissionDraft.company || ''} onChange={(e) => updateResubmissionField('company', e.target.value)} maxLength={180} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white" />
                  </label>
                  <label className="text-xs font-semibold text-slate-300">Job Type
                    <select value={resubmissionDraft.jobType || 'On-site'} onChange={(e) => updateResubmissionField('jobType', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white">
                      <option>On-site</option><option>Hybrid</option><option>Remote</option>
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-slate-300">Region
                    <select value={resubmissionDraft.region || 'Pakistan'} onChange={(e) => updateResubmissionField('region', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white">
                      {['Pakistan','Global','US','UK','UAE','Saudi Arabia','Canada','Europe','Australia'].map((value) => <option key={value}>{value}</option>)}
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-slate-300">Country
                    <input value={resubmissionDraft.country || 'Pakistan'} onChange={(e) => updateResubmissionField('country', e.target.value)} maxLength={80} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white" />
                  </label>
                  <label className="text-xs font-semibold text-slate-300">Province / State
                    <input value={resubmissionDraft.province || ''} onChange={(e) => updateResubmissionField('province', e.target.value)} maxLength={100} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white" />
                  </label>
                  <label className="text-xs font-semibold text-slate-300">City
                    <input value={resubmissionDraft.city || ''} onChange={(e) => updateResubmissionField('city', e.target.value)} maxLength={100} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white" />
                  </label>
                  <label className="text-xs font-semibold text-slate-300">District
                    <input value={resubmissionDraft.district || ''} onChange={(e) => updateResubmissionField('district', e.target.value)} maxLength={100} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white" />
                  </label>
                </div>
              </section>

              <section className="space-y-3">
                <h4 className="border-b border-slate-800 pb-2 text-xs font-black uppercase tracking-wide text-emerald-300">Salary and requirements</h4>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="text-xs font-semibold text-slate-300">Salary / Pay Range
                    <input value={resubmissionDraft.salary || ''} onChange={(e) => updateResubmissionField('salary', e.target.value)} maxLength={120} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white" />
                  </label>
                  <label className="text-xs font-semibold text-slate-300">Currency
                    <select value={resubmissionDraft.currency || 'PKR'} onChange={(e) => updateResubmissionField('currency', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white">
                      {['PKR','USD','GBP','EUR','CAD','AUD','AED','SAR'].map((value) => <option key={value}>{value}</option>)}
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-slate-300">Experience Level
                    <select value={resubmissionDraft.experienceLevel || 'Entry'} onChange={(e) => updateResubmissionField('experienceLevel', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white">
                      {['Entry','Mid','Senior','Lead','Executive'].map((value) => <option key={value}>{value}</option>)}
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-slate-300">Department
                    <input value={resubmissionDraft.department || ''} onChange={(e) => updateResubmissionField('department', e.target.value)} maxLength={120} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white" />
                  </label>
                  <label className="text-xs font-semibold text-slate-300">Job Category
                    <input value={resubmissionDraft.jobCategory || ''} onChange={(e) => updateResubmissionField('jobCategory', e.target.value)} maxLength={100} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white" />
                  </label>
                  <label className="text-xs font-semibold text-slate-300">Total Vacancies
                    <input type="number" min="0" value={resubmissionDraft.totalVacancies ?? ''} onChange={(e) => updateResubmissionField('totalVacancies', e.target.value === '' ? undefined : Number(e.target.value))} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white" />
                  </label>
                  <label className="text-xs font-semibold text-slate-300">Minimum Age
                    <input type="number" min="0" value={resubmissionDraft.minimumAge ?? ''} onChange={(e) => updateResubmissionField('minimumAge', e.target.value === '' ? undefined : Number(e.target.value))} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white" />
                  </label>
                  <label className="text-xs font-semibold text-slate-300">Maximum Age
                    <input type="number" min="0" value={resubmissionDraft.maximumAge ?? ''} onChange={(e) => updateResubmissionField('maximumAge', e.target.value === '' ? undefined : Number(e.target.value))} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white" />
                  </label>
                </div>
                <label className="block text-xs font-semibold text-slate-300">Job Description *
                  <textarea value={resubmissionDraft.description || ''} onChange={(e) => updateResubmissionField('description', e.target.value)} rows={7} maxLength={30000} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white" />
                </label>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="text-xs font-semibold text-slate-300">Requirements (one per line)
                    <textarea value={(resubmissionDraft.requirements || []).join('\n')} onChange={(e) => updateResubmissionField('requirements', parseResubmissionLines(e.target.value))} rows={5} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white" />
                  </label>
                  <label className="text-xs font-semibold text-slate-300">Responsibilities (one per line)
                    <textarea value={(resubmissionDraft.responsibilities || []).join('\n')} onChange={(e) => updateResubmissionField('responsibilities', parseResubmissionLines(e.target.value))} rows={5} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white" />
                  </label>
                  <label className="text-xs font-semibold text-slate-300">Benefits (one per line)
                    <textarea value={(resubmissionDraft.benefits || []).join('\n')} onChange={(e) => updateResubmissionField('benefits', parseResubmissionLines(e.target.value))} rows={4} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white" />
                  </label>
                  <label className="text-xs font-semibold text-slate-300">Skills / Tags (one per line)
                    <textarea value={(resubmissionDraft.tags || []).join('\n')} onChange={(e) => updateResubmissionField('tags', parseResubmissionLines(e.target.value))} rows={4} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white" />
                  </label>
                </div>
              </section>

              <section className="space-y-3">
                <h4 className="border-b border-slate-800 pb-2 text-xs font-black uppercase tracking-wide text-emerald-300">Application and important dates</h4>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="text-xs font-semibold text-slate-300">Application Type
                    <select value={resubmissionDraft.applicationType || 'external'} onChange={(e) => updateResubmissionField('applicationType', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white">
                      <option value="internal">Portal application</option><option value="external">External application</option><option value="both">Both</option>
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-slate-300">Application URL
                    <input type="url" value={resubmissionDraft.applicationUrl || ''} onChange={(e) => updateResubmissionField('applicationUrl', e.target.value)} maxLength={2000} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white" />
                  </label>
                  <label className="text-xs font-semibold text-slate-300">External Apply URL
                    <input type="url" value={resubmissionDraft.externalApplyUrl || ''} onChange={(e) => updateResubmissionField('externalApplyUrl', e.target.value)} maxLength={2000} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white" />
                  </label>
                  <label className="text-xs font-semibold text-slate-300">Original Apply URL
                    <input type="url" value={resubmissionDraft.originalApplyUrl || ''} onChange={(e) => updateResubmissionField('originalApplyUrl', e.target.value)} maxLength={2000} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white" />
                  </label>
                  <label className="text-xs font-semibold text-slate-300">Contact Email
                    <input type="email" value={resubmissionDraft.contactEmail || ''} onChange={(e) => updateResubmissionField('contactEmail', e.target.value)} maxLength={254} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white" />
                  </label>
                  <label className="text-xs font-semibold text-slate-300">Contact Email / Phone
                    <input value={resubmissionDraft.contactEmailOrPhone || ''} onChange={(e) => updateResubmissionField('contactEmailOrPhone', e.target.value)} maxLength={254} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white" />
                  </label>
                  {[
                    ['applicationStartDate','Application Start Date'],
                    ['deadlineDate','Application Deadline'],
                    ['expiryDate','Listing Expiry Date'],
                    ['futureIntakeDate','Future Intake Date']
                  ].map(([field,label]) => (
                    <label key={field} className="text-xs font-semibold text-slate-300">{label}
                      <input type="date" value={String((resubmissionDraft as any)[field] || '').slice(0,10)} onChange={(e) => updateResubmissionField(field as keyof Job, e.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white" />
                    </label>
                  ))}
                </div>
              </section>

              <section className="space-y-3">
                <h4 className="border-b border-slate-800 pb-2 text-xs font-black uppercase tracking-wide text-emerald-300">Government / newspaper details (if applicable)</h4>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-300"><input type="checkbox" checked={Boolean(resubmissionDraft.isGovtJob)} onChange={(e) => updateResubmissionField('isGovtJob', e.target.checked)} /> Government job</label>
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-300"><input type="checkbox" checked={Boolean(resubmissionDraft.isNewspaperAd)} onChange={(e) => updateResubmissionField('isNewspaperAd', e.target.checked)} /> Newspaper advertisement</label>
                  {[
                    ['govtDepartment','Government Department'],
                    ['govtScale','BPS / Scale'],
                    ['govtCategory','Government Category'],
                    ['newspaperName','Newspaper Name'],
                    ['newspaperDate','Newspaper Date'],
                    ['clippingImageUrl','Newspaper Clipping URL'],
                    ['employmentType','Employment Type'],
                    ['ageLimit','Age Limit'],
                    ['qualificationSummary','Qualification Summary'],
                    ['domicile','Domicile / Quota'],
                    ['challanFee','Challan Fee'],
                    ['ageRelaxationNote','Age Relaxation']
                  ].map(([field,label]) => (
                    <label key={field} className="text-xs font-semibold text-slate-300">{label}
                      <input value={String((resubmissionDraft as any)[field] || '')} onChange={(e) => updateResubmissionField(field as keyof Job, e.target.value)} maxLength={2000} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white" />
                    </label>
                  ))}
                  <label className="text-xs font-semibold text-slate-300">Advertised Positions (one per line)
                    <textarea value={(resubmissionDraft.advertisedPositions || []).join('\n')} onChange={(e) => updateResubmissionField('advertisedPositions', parseResubmissionLines(e.target.value))} rows={3} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white" />
                  </label>
                </div>
              </section>
            </div>
            <div className="sticky bottom-0 flex flex-col-reverse gap-2 border-t border-slate-800 bg-slate-950 p-4 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setResubmissionDraft(null)} className="rounded-xl border border-slate-700 px-4 py-2.5 text-xs font-bold text-slate-300 hover:bg-slate-800">Cancel</button>
              <button
                type="button"
                disabled={Boolean(resubmittingJobId) || !String(resubmissionDraft.title || '').trim() || !String(resubmissionDraft.company || '').trim() || !String(resubmissionDraft.description || '').trim()}
                onClick={async () => {
                  const jobId = String(resubmissionDraft.id);
                  setResubmittingJobId(jobId);
                  try {
                    const result: any = await api.jobs.resubmitRejected(jobId, resubmissionDraft);
                    if (!result?.success) throw new Error(result?.message || 'Resubmission failed.');
                    setOwnSubmissionHistory((current) => current.map((item) => item.id === jobId ? result.job : item));
                    setResubmissionDraft(null);
                    window.alert('Corrected job submitted again. It is now Pending admin review.');
                  } catch (error: any) {
                    window.alert(error?.message || 'Could not resubmit this job.');
                  } finally {
                    setResubmittingJobId(null);
                  }
                }}
                className="rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-black text-slate-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {resubmittingJobId ? 'Submitting…' : 'Submit corrected job for review'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* USER JOB GOOGLE SEARCH SEO & SCHEMA PREVIEW MODAL */}
      {userJobSeoPreview && (
        <JobSeoPreviewModal
          job={userJobSeoPreview}
          isOpen={!!userJobSeoPreview}
          onClose={() => setUserJobSeoPreview(null)}
        />
      )}

      </div>
    </div>
  );
};
