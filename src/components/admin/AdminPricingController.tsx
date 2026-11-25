import React, { useState, useEffect } from 'react';
import { 
  DollarSign, 
  Save, 
  Sparkles, 
  ShieldCheck, 
  Sliders, 
  Clock, 
  Tag, 
  CheckCircle, 
  RefreshCw,
  AlertCircle,
  Search,
  X,
  Users,
  Gift,
  Plus,
  Trash2,
  Percent
} from 'lucide-react';
import { api } from '../../services/api';
import { SubscriptionPlansBuilder } from './SubscriptionPlansBuilder';
import { DEFAULT_CATEGORY_POSTING_FEES } from '../../types/landing';

interface AdminPricingControllerProps {
  onPricingSaved?: (authoritativePricing: any) => void;
  hideCvSettings?: boolean;
  hideSubscriptionSettings?: boolean;
  hideAdPlaceholder?: boolean;
}

export const AdminPricingController: React.FC<AdminPricingControllerProps> = ({
  onPricingSaved,
  hideCvSettings = false,
  hideSubscriptionSettings,
  hideAdPlaceholder
}) => {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<
    'pricing' | 'early-access' | 'subscriptions' | 'category' | 'posting-fee' | 'employer-waiver' | 'quick-job-waiver' | 'cv-builder'
  >('pricing');
  const [jobsList, setJobsList] = useState<any[]>([]);
  const [pendingJobsList, setPendingJobsList] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [newExemptEmail, setNewExemptEmail] = useState('');
  const [pricing, setPricing] = useState<any>({
    globalDiscount: 0,
    jobPosting: {
      standardFeePkr: 1000,
      globalDiscount: 0,
      enableStandard: true,
      enableUrgent: true,
      enableFeatured: true,
      enableFeaturedTop: true,
      enableFutureJob: true,
      enableVipBundle: true,
      standardDescription: 'Regular chronological placement',
      urgentBadgeText: 'Urgent Hiring',
      pinnedBadgeText: 'Pinned Top #1',
      featuredBadgeText: 'Featured Placement',
      futureBadgeText: 'Future Job',
      vipBadgeText: 'VIP Ultimate Placement',
      urgentFeePkr: 500,
      featuredFeePkr: 1000,
      featuredTopFeePkr: 1500,
      futureJobFeePkr: 800,
      vipBundleFeePkr: 2500,
      freePostingAllowed: true,
      standardDurationDays: 30,
      urgentDurationDays: 15,
      featuredDurationDays: 30,
      featuredTopDurationDays: 30,
      futureJobDurationDays: 60,
      vipBundleDurationDays: 45
    },
    advertisements: {
      bannerPerDayPkr: 1500,
      topBannerPerDayPkr: 3000,
      popupPerDayPkr: 4500,
      feedAdPerDayPkr: 2000,
      featuredEmployerPerMonthPkr: 25000,
      allowDiscounts: true,
      defaultDiscountPercent: 10,
      minCampaignDurationDays: 3,
      maxCampaignDurationDays: 90
    },
    earlyAccess: {
      enabled: false, sourceTypes: ['scraped', 'user_posted', 'admin_created'], durationHours: 24,
      showOnLanding: true, showJobCount: true, showCountdown: true, maxJobs: 10,
      heading: 'Premium Early Access', description: 'Explore selected jobs before they become available to other members.',
      displayFields: ['title', 'company', 'department', 'city', 'deadlineDate'], showSource: true, jobOverrides: []
    },
    subscriptions: {
      freeTierPrice: 0,
      proMonthlyPkr: 1200,
      vipMonthlyPkr: 3000,
      govtAlertsWeeklyPkr: 400
    },
    cvBuilder: {
      standardPdfExportPkr: 0, pdfExportEnabled: true, pdfExportPkr: 0,
      atsTextExportEnabled: true, atsTextExportPkr: 0,
      premiumAiOptimizerPkr: 500, unlimitedTemplatesPkr: 1000,
      freeDesignLimit: 2, freeCvLimit: 1, premiumCvLimit: 10, watermarkEnabled: true, watermarkFreeOnly: true,
      watermarkText: 'Hybrid Job Portal', watermarkOpacity: 0.16,
      templates: [
        { id: 'modern', name: 'Modern Clean', enabled: true, free: true, pricePkr: 0 },
        { id: 'executive', name: 'Executive Dark Sidebar', enabled: true, free: false, pricePkr: 300 },
        { id: 'tech', name: 'Tech Minimalist', enabled: true, free: false, pricePkr: 300 },
        { id: 'classic', name: 'Classic Corporate', enabled: true, free: false, pricePkr: 200 },
        { id: 'ats', name: 'ATS Plain Text', enabled: true, free: true, pricePkr: 0 }
      ]
    }
  });

  const [earlyAccessJobs, setEarlyAccessJobs] = useState<any[]>([]);
  const [selectedEarlyAccessJobId, setSelectedEarlyAccessJobId] = useState('');
  const [earlyAccessJobSearch, setEarlyAccessJobSearch] = useState('');

  const [priorityMetrics, setPriorityMetrics] = useState<{
    tierCounts: { vip: number; pinned: number; featured: number; urgent: number; future?: number };
    slotLimits: { vip: number; pinned: number; featured: number; urgent: number; future?: number };
  }>({
    tierCounts: { vip: 0, pinned: 0, featured: 0, urgent: 0, future: 0 },
    slotLimits: { vip: 2, pinned: 2, featured: 4, urgent: 4, future: 4 }
  });

  useEffect(() => {
    loadPricing();
  }, []);

  const loadPricing = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await api.pricing.get();
      if (data && data.success && data.pricing) {
        const isFree = data.pricing.isFreeAllPostings === true || data.pricing.jobPosting?.isFreeAllPostings === true;
        const discount = Number(data.pricing.globalDiscount ?? data.pricing.jobPosting?.globalDiscount ?? data.pricing.landingPageConfig?.globalDiscount ?? 0);
        setPricing((prev: any) => ({
          ...prev,
          ...data.pricing,
          globalDiscount: discount,
          isFreeAllPostings: isFree,
          categoryPostingFees: Array.isArray(data.pricing.categoryPostingFees) ? data.pricing.categoryPostingFees : (Array.isArray(data.pricing.jobPosting?.categoryPostingFees) ? data.pricing.jobPosting.categoryPostingFees : DEFAULT_CATEGORY_POSTING_FEES),
          exemptUserEmails: Array.isArray(data.pricing.exemptUserEmails) ? data.pricing.exemptUserEmails : (Array.isArray(data.pricing.jobPosting?.exemptUserEmails) ? data.pricing.jobPosting.exemptUserEmails : []),
          standardFeePkr: Number(data.pricing.standardFeePkr ?? data.pricing.jobPosting?.standardFeePkr ?? 1000),
          jobPosting: {
            ...prev.jobPosting,
            ...(data.pricing.jobPosting || {}),
            globalDiscount: discount,
            isFreeAllPostings: isFree
          },
          advertisements: { ...prev.advertisements, ...(data.pricing.advertisements || {}) },
          subscriptions: { ...prev.subscriptions, ...(data.pricing.subscriptions || {}) },
          earlyAccess: { ...prev.earlyAccess, ...(data.pricing.earlyAccess || {}) },
          cvBuilder: { ...prev.cvBuilder, ...(data.pricing.cvBuilder || {}), templates: Array.isArray(data.pricing.cvBuilder?.templates) ? data.pricing.cvBuilder.templates : prev.cvBuilder.templates }
        }));
      } else {
        setLoadError(data?.message || 'Failed to load authoritative pricing configuration.');
      }
      const earlyJobsRes = await api.jobs.getAll({ limit: '1000' });
      if (earlyJobsRes && earlyJobsRes.success && Array.isArray(earlyJobsRes.jobs)) {
        setEarlyAccessJobs(earlyJobsRes.jobs);
        setJobsList(earlyJobsRes.jobs);
        setPendingJobsList(earlyJobsRes.jobs.filter((j: any) => j.status === 'pending' || j.status === 'pending_approval'));
      }
      const priorityRes = await api.jobs.getPriority();
      if (priorityRes && priorityRes.success && priorityRes.tierCounts) {
        setPriorityMetrics({
          tierCounts: { future: 0, ...priorityRes.tierCounts },
          slotLimits: priorityRes.slotLimits || { vip: 2, pinned: 2, featured: 4, urgent: 4, future: 4 }
        });
      }
      try {
        const usersRes = await api.users.getAll();
        if (usersRes && usersRes.success && Array.isArray(usersRes.users)) {
          setUsersList(usersRes.users);
        }
      } catch (err) {
        // Non-blocking for pricing controller
      }
    } catch (err: any) {
      console.error('Failed to load pricing:', err);
      setLoadError(err?.message || 'Unable to load authoritative pricing configuration.');
    } finally {
      setLoading(false);
    }
  };

  const updatePrioritySlot = (tier: 'vip' | 'pinned' | 'featured' | 'urgent' | 'future', field: 'enabled' | 'maxSlots', value: any) => {
    setPricing((prev: any) => {
      const currentConfig = prev.jobPosting?.homepagePrioritySlotConfig || {
        enabled: true,
        vip: { enabled: true, maxSlots: 2 },
        pinned: { enabled: true, maxSlots: 2 },
        featured: { enabled: true, maxSlots: 4 },
        urgent: { enabled: true, maxSlots: 4 },
        future: { enabled: true, maxSlots: 4 }
      };
      return {
        ...prev,
        jobPosting: {
          ...prev.jobPosting,
          homepagePrioritySlotConfig: {
            ...currentConfig,
            [tier]: {
              ...(currentConfig[tier] || { enabled: true, maxSlots: 4 }),
              [field]: field === 'maxSlots' ? Math.max(0, Math.floor(Number(value) || 0)) : value
            }
          }
        }
      };
    });
  };

  const handleSave = async () => {
    if (loadError) {
      setSaveError('Cannot save while pricing failed to load. Please reload first.');
      return;
    }
    const packages = Array.isArray(pricing.subscriptionPackages) ? pricing.subscriptionPackages : [];
    const invalidPackage = packages.find((pkg: any) => {
      const rawDuration = pkg?.durationDays;
      const duration = Number(rawDuration);
      if (typeof rawDuration === 'string' && rawDuration.trim() === '') return true;
      if (!Number.isInteger(duration) || duration < 1 || duration > 3650) return true;
      const rawPrice = pkg?.configuredPricePkr ?? pkg?.pricePkr;
      const price = Number(rawPrice);
      if (typeof rawPrice === 'string' && rawPrice.trim() === '') return true;
      if (!Number.isSafeInteger(price) || price < 0) return true;
      return false;
    });
    if (invalidPackage) {
      setSaveError('Please enter a valid whole-number package price (0 or more) and duration (1–3650 days) before saving.');
      return;
    }
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const resolvedGlobalDiscount = Math.min(100, Math.max(0, Number(pricing.globalDiscount ?? pricing.jobPosting?.globalDiscount ?? 0)));
      const resolvedIsFree = Boolean(pricing.isFreeAllPostings || pricing.jobPosting?.isFreeAllPostings);
      const resolvedCategoryFees = pricing.categoryPostingFees || pricing.jobPosting?.categoryPostingFees || DEFAULT_CATEGORY_POSTING_FEES;
      const resolvedExemptEmails = pricing.exemptUserEmails || pricing.jobPosting?.exemptUserEmails || [];

      const savePayload = {
        ...pricing,
        globalDiscount: resolvedGlobalDiscount,
        isFreeAllPostings: resolvedIsFree,
        categoryPostingFees: resolvedCategoryFees,
        exemptUserEmails: resolvedExemptEmails,
        jobPosting: {
          ...pricing.jobPosting,
          standardFeePkr: Number(pricing.jobPosting?.standardFeePkr ?? 1000),
          globalDiscount: resolvedGlobalDiscount,
          isFreeAllPostings: resolvedIsFree,
          categoryPostingFees: resolvedCategoryFees,
          exemptUserEmails: resolvedExemptEmails
        },
        landingPageConfig: {
          ...(pricing.landingPageConfig || {}),
          globalDiscount: resolvedGlobalDiscount,
          isFreeAllPostings: resolvedIsFree,
          categoryPostingFees: resolvedCategoryFees,
          exemptUserEmails: resolvedExemptEmails
        }
      };
      if (hideCvSettings) delete savePayload.cvBuilder;
      const res = await api.pricing.update(savePayload);
      if (res && res.success) {
        if (res.pricing) {
          setPricing((prev: any) => ({
            ...prev,
            ...res.pricing,
            globalDiscount: res.pricing.globalDiscount !== undefined ? res.pricing.globalDiscount : resolvedGlobalDiscount,
            categoryPostingFees: res.pricing.categoryPostingFees || res.pricing.jobPosting?.categoryPostingFees || prev.categoryPostingFees,
            exemptUserEmails: res.pricing.exemptUserEmails || res.pricing.jobPosting?.exemptUserEmails || prev.exemptUserEmails,
            isFreeAllPostings: res.pricing.isFreeAllPostings !== undefined ? res.pricing.isFreeAllPostings : resolvedIsFree
          }));
          onPricingSaved?.(res.pricing);
        }
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        setSaveError(res?.message || 'Failed to save pricing configuration.');
      }
    } catch (err: any) {
      console.error('Failed to save pricing:', err);
      setSaveError(err?.message || 'Error saving pricing configuration.');
    } finally {
      setSaving(false);
    }
  };

  const updateNested = (section: string, field: string, value: any) => {
    setPricing((prev: any) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }));
  };

  const handleUpdateCategoryFee = (categoryId: string, updates: Partial<any>) => {
    setPricing((prev: any) => {
      const currentFees = Array.isArray(prev.categoryPostingFees) ? prev.categoryPostingFees : DEFAULT_CATEGORY_POSTING_FEES;
      const next = currentFees.map((c: any) => c.categoryId === categoryId ? { ...c, ...updates } : c);
      return {
        ...prev,
        categoryPostingFees: next,
        jobPosting: {
          ...prev.jobPosting,
          categoryPostingFees: next
        }
      };
    });
  };

  const handleToggleCategoryFree = (categoryId: string) => {
    setPricing((prev: any) => {
      const currentFees = Array.isArray(prev.categoryPostingFees) ? prev.categoryPostingFees : DEFAULT_CATEGORY_POSTING_FEES;
      const next = currentFees.map((c: any) => c.categoryId === categoryId ? { ...c, isFree: !c.isFree } : c);
      return {
        ...prev,
        categoryPostingFees: next,
        jobPosting: {
          ...prev.jobPosting,
          categoryPostingFees: next
        }
      };
    });
  };

  const handleDeleteCategory = (categoryId: string) => {
    setPricing((prev: any) => {
      const currentFees = Array.isArray(prev.categoryPostingFees) ? prev.categoryPostingFees : DEFAULT_CATEGORY_POSTING_FEES;
      const next = currentFees.filter((c: any) => c.categoryId !== categoryId);
      return {
        ...prev,
        categoryPostingFees: next,
        jobPosting: {
          ...prev.jobPosting,
          categoryPostingFees: next
        }
      };
    });
  };

  const handleAddCategory = () => {
    const newId = `cat_${Date.now()}`;
    const newCat = {
      categoryId: newId,
      categoryName: 'New Job Category',
      feePkr: Math.max(0, Number(pricing.jobPosting?.standardFeePkr) || 1000),
      isFree: false,
      discountPercent: 0
    };
    setPricing((prev: any) => {
      const currentFees = Array.isArray(prev.categoryPostingFees) ? prev.categoryPostingFees : DEFAULT_CATEGORY_POSTING_FEES;
      const next = [...currentFees, newCat];
      return {
        ...prev,
        categoryPostingFees: next,
        jobPosting: {
          ...prev.jobPosting,
          categoryPostingFees: next
        }
      };
    });
  };

  const handleAddExemptEmail = () => {
    const email = newExemptEmail.trim().toLowerCase();
    if (!email) return;
    setPricing((prev: any) => {
      const current = Array.isArray(prev.exemptUserEmails) ? prev.exemptUserEmails : [];
      if (current.includes(email)) return prev;
      const next = [...current, email];
      return {
        ...prev,
        exemptUserEmails: next,
        jobPosting: {
          ...prev.jobPosting,
          exemptUserEmails: next
        }
      };
    });
    setNewExemptEmail('');
  };

  const handleRemoveExemptEmail = (target: string) => {
    setPricing((prev: any) => {
      const current = Array.isArray(prev.exemptUserEmails) ? prev.exemptUserEmails : [];
      const next = current.filter((e: string) => e !== target);
      return {
        ...prev,
        exemptUserEmails: next,
        jobPosting: {
          ...prev.jobPosting,
          exemptUserEmails: next
        }
      };
    });
  };

  const [quickJobSearch, setQuickJobSearch] = useState('');
  const [waivingJobId, setWaivingJobId] = useState<string | null>(null);

  const handleMakeJobFree = async (jobId: string) => {
    setWaivingJobId(jobId);
    try {
      const res = await api.jobs.update(jobId, { paymentStatus: 'Paid', feePaidPkr: 0 });
      if (res && res.success) {
        setJobsList((prev) => prev.map((j) => String(j.id) === String(jobId) ? { ...j, paymentStatus: 'Paid', feePaidPkr: 0 } : j));
        setPendingJobsList((prev) => prev.map((j) => String(j.id) === String(jobId) ? { ...j, paymentStatus: 'Paid', feePaidPkr: 0 } : j));
      }
    } catch (err) {
      console.error('Failed to waive job fee:', err);
    } finally {
      setWaivingJobId(null);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-400 flex items-center justify-center space-x-3">
        <RefreshCw className="w-5 h-5 animate-spin text-amber-500" />
        <span>Loading persistent pricing configuration...</span>
      </div>
    );
  }

  return (
    <div className="admin-settings-mobile-compact space-y-8 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div>
          <div className="flex items-center space-x-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white">Universal Pricing Controller</h2>
              <p className="text-xs text-slate-400">Configure job-posting fees, subscription tiers, CV services and duration limits. Active ad campaign rates are managed separately in Ad Hub.</p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {saveSuccess && (
            <span className="flex items-center space-x-1.5 text-xs text-emerald-400 font-semibold bg-emerald-500/10 border border-emerald-500/30 px-3 py-2 rounded-xl">
              <CheckCircle className="w-4 h-4" />
              <span>Saved to Database!</span>
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving || Boolean(loadError)}
            className={`flex items-center space-x-2 px-5 py-2.5 rounded-xl font-black text-sm shadow-lg transition-all ${
              saving || loadError
                ? 'bg-slate-700 text-slate-300 cursor-not-allowed opacity-70'
                : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-amber-500/20 active:scale-95 cursor-pointer'
            }`}
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>Save All Changes</span>
          </button>
        </div>
      </div>

      {loadError && (
        <div className="p-4 rounded-2xl bg-rose-950/90 border border-rose-500/50 text-rose-200 text-xs font-bold flex items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{loadError}</span>
          </div>
          <button
            type="button"
            onClick={loadPricing}
            className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/40 text-rose-100 text-xs font-bold cursor-pointer shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {saveError && (
        <div className="p-4 rounded-2xl bg-rose-950/90 border border-rose-500/50 text-rose-200 text-xs font-bold flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{saveError}</span>
        </div>
      )}

      {/* Sub-Tabs Navigation */}
      <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-slate-900 border border-slate-800 rounded-2xl">
        {[
          { id: 'pricing', label: 'Job Pricing Control', icon: Sliders },
          { id: 'early-access', label: 'Early Access', icon: Clock },
          { id: 'subscriptions', label: 'Subscriptions', icon: Sparkles },
          { id: 'category', label: 'Category', icon: Tag },
          { id: 'posting-fee', label: 'Posting Fee', icon: DollarSign },
          { id: 'employer-waiver', label: 'Employer Waiver', icon: Users },
          { id: 'quick-job-waiver', label: 'Quick Job Waiver', icon: Gift },
          ...(!hideCvSettings ? [{ id: 'cv-builder', label: 'CV Builder', icon: ShieldCheck }] : [])
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                isActive
                  ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                  : 'bg-slate-950/60 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* SUB-TAB 1: JOB PRICING CONTROL */}
      {activeSubTab === 'pricing' && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* 1. Job Posting & Upgrades */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center space-x-2.5">
              <Sparkles className="w-5 h-5 text-amber-400" />
              <h3 className="font-bold text-white text-base">Job Posting Tiers & Fees</h3>
            </div>
            <label className="flex items-center space-x-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={pricing.jobPosting?.freePostingAllowed}
                onChange={(e) => updateNested('jobPosting', 'freePostingAllowed', e.target.checked)}
                className="w-4 h-4 rounded border-slate-700 text-amber-500 focus:ring-amber-500"
              />
              <span>Allow Free Standard Job Posting</span>
            </label>
          </div>

          <div className="space-y-4 text-sm">
            {/* 1. VIP Ultimate Bundle (Top Priority) */}
            <div className="bg-slate-950/80 p-4 rounded-xl border border-amber-500/40 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[11px] font-black">1. VIP</span>
                  <span className="font-bold text-amber-300">👑 VIP Ultimate Placement</span>
                </div>
                <div className="flex items-center space-x-3">
                  <select
                    value={Number(pricing.jobPosting?.vipBundleFeePkr ?? 2500) === 0 ? 'free' : 'paid'}
                    onChange={(e) => {
                      if (e.target.value === 'free') {
                        updateNested('jobPosting', 'vipBundleFeePkr', 0);
                      } else {
                        updateNested('jobPosting', 'vipBundleFeePkr', pricing.jobPosting?._cachedVipFee || 2500);
                      }
                    }}
                    className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-xs text-amber-300 font-bold"
                  >
                    <option value="paid">Paid Mode</option>
                    <option value="free">100% Free Mode</option>
                  </select>
                  <label className="flex items-center space-x-1 text-xs text-slate-300 cursor-pointer">
                    <span className="text-[11px] text-slate-400">Enable:</span>
                    <input type="checkbox" checked={pricing.jobPosting?.enableVipBundle !== false} onChange={(e) => updateNested('jobPosting', 'enableVipBundle', e.target.checked)} className="w-4 h-4 rounded border-slate-700 text-amber-500" />
                  </label>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                {Number(pricing.jobPosting?.vipBundleFeePkr ?? 2500) > 0 ? (
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Fee (PKR)</label>
                    <input type="number" value={pricing.jobPosting?.vipBundleFeePkr || 0} onChange={(e) => {
                      const val = Number(e.target.value);
                      updateNested('jobPosting', 'vipBundleFeePkr', val);
                      if (val > 0) setPricing((prev: any) => ({ ...prev, jobPosting: { ...prev.jobPosting, _cachedVipFee: val } }));
                    }} className="w-28 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-bold text-sm" />
                  </div>
                ) : (
                  <div className="text-xs text-emerald-400 font-semibold py-1">✨ Free Mode Active (0 PKR)</div>
                )}
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Duration (Days)</label>
                  <input type="number" value={pricing.jobPosting?.vipBundleDurationDays || 45} onChange={(e) => updateNested('jobPosting', 'vipBundleDurationDays', Number(e.target.value))} className="w-28 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm" />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Badge Title (Editable)</label>
                  <input type="text" value={pricing.jobPosting?.vipBadgeText || 'VIP Ultimate Placement'} onChange={(e) => updateNested('jobPosting', 'vipBadgeText', e.target.value)} className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs" />
                </div>
              </div>

              {/* Homepage Priority Placement Slot Configuration for VIP */}
              <div className="pt-2.5 mt-1 border-t border-amber-500/30 flex flex-wrap items-center justify-between gap-2.5 bg-amber-500/10 px-3 py-2 rounded-lg">
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-amber-300 text-xs flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-amber-400" />
                    👑 VIP Placement Slots:
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                    {priorityMetrics.tierCounts.vip} / {pricing.jobPosting?.homepagePrioritySlotConfig?.vip?.maxSlots ?? 4} Occupied
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-[11px] text-slate-300 font-medium">Max Card Slots:</span>
                  <input
                    type="number"
                    min="0"
                    max="50"
                    value={pricing.jobPosting?.homepagePrioritySlotConfig?.vip?.maxSlots ?? 4}
                    onChange={(e) => updatePrioritySlot('vip', 'maxSlots', e.target.value)}
                    className="w-16 px-2 py-1 bg-slate-900 border border-amber-500/40 rounded text-center text-white font-black text-xs focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>
            </div>

            {/* 2. Pinned Top #1 */}
            <div className="bg-slate-950/60 p-4 rounded-xl border border-blue-500/30 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono text-[11px] font-black">2. Pinned</span>
                  <span className="font-bold text-blue-400">📌 Pinned Top #1</span>
                </div>
                <div className="flex items-center space-x-3">
                  <select
                    value={Number(pricing.jobPosting?.featuredTopFeePkr ?? 1500) === 0 ? 'free' : 'paid'}
                    onChange={(e) => {
                      if (e.target.value === 'free') {
                        updateNested('jobPosting', 'featuredTopFeePkr', 0);
                      } else {
                        updateNested('jobPosting', 'featuredTopFeePkr', pricing.jobPosting?._cachedFeaturedFee || 1500);
                      }
                    }}
                    className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-xs text-blue-300 font-bold"
                  >
                    <option value="paid">Paid Mode</option>
                    <option value="free">100% Free Mode</option>
                  </select>
                  <label className="flex items-center space-x-1 text-xs text-slate-300 cursor-pointer">
                    <span className="text-[11px] text-slate-400">Enable:</span>
                    <input type="checkbox" checked={pricing.jobPosting?.enableFeaturedTop !== false} onChange={(e) => updateNested('jobPosting', 'enableFeaturedTop', e.target.checked)} className="w-4 h-4 rounded border-slate-700 text-blue-500" />
                  </label>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                {Number(pricing.jobPosting?.featuredTopFeePkr ?? 1500) > 0 ? (
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Fee (PKR)</label>
                    <input type="number" value={pricing.jobPosting?.featuredTopFeePkr || 0} onChange={(e) => {
                      const val = Number(e.target.value);
                      updateNested('jobPosting', 'featuredTopFeePkr', val);
                      if (val > 0) setPricing((prev: any) => ({ ...prev, jobPosting: { ...prev.jobPosting, _cachedFeaturedFee: val } }));
                    }} className="w-28 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-bold text-sm" />
                  </div>
                ) : (
                  <div className="text-xs text-emerald-400 font-semibold py-1">✨ Free Mode Active (0 PKR)</div>
                )}
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Duration (Days)</label>
                  <input type="number" value={pricing.jobPosting?.featuredTopDurationDays || 30} onChange={(e) => updateNested('jobPosting', 'featuredTopDurationDays', Number(e.target.value))} className="w-28 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm" />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Badge Title (Editable)</label>
                  <input type="text" value={pricing.jobPosting?.pinnedBadgeText || '📌 Pinned Top #1'} onChange={(e) => updateNested('jobPosting', 'pinnedBadgeText', e.target.value)} className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs" />
                </div>
              </div>

              {/* Homepage Priority Placement Slots Configuration for Pinned Top */}
              <div className="pt-2.5 mt-1 border-t border-blue-500/30 space-y-1.5 bg-blue-500/10 px-3 py-2 rounded-lg">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-blue-300 text-xs flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-blue-400" />
                      📌 Pinned Top Slots:
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-bold border border-blue-500/30">
                      {priorityMetrics.tierCounts.pinned} / {pricing.jobPosting?.homepagePrioritySlotConfig?.pinned?.maxSlots ?? 4} Occupied
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-[11px] text-slate-300 font-medium">Max Card Slots:</span>
                    <input
                      type="number"
                      min="0"
                      max="50"
                      value={pricing.jobPosting?.homepagePrioritySlotConfig?.pinned?.maxSlots ?? 4}
                      onChange={(e) => updatePrioritySlot('pinned', 'maxSlots', e.target.value)}
                      className="w-16 px-2 py-1 bg-slate-900 border border-blue-500/40 rounded text-center text-white font-black text-xs focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-blue-200/80">
                  Employer bookings of this tier rank 2nd (right after VIP) in Pinned Top Slots.
                </p>
              </div>
            </div>

            {/* 3. Featured Placement (3rd Rank) */}
            <div className="bg-slate-950/60 p-4 rounded-xl border border-purple-500/30 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono text-[11px] font-black">3. Featured</span>
                  <span className="font-bold text-purple-300">⭐ Featured Placement</span>
                </div>
                <div className="flex items-center space-x-3">
                  <select
                    value={Number(pricing.jobPosting?.featuredFeePkr ?? 1000) === 0 ? 'free' : 'paid'}
                    onChange={(e) => {
                      if (e.target.value === 'free') {
                        updateNested('jobPosting', 'featuredFeePkr', 0);
                      } else {
                        updateNested('jobPosting', 'featuredFeePkr', pricing.jobPosting?._cachedOnlyFeaturedFee || 1000);
                      }
                    }}
                    className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-xs text-purple-300 font-bold"
                  >
                    <option value="paid">Paid Mode</option>
                    <option value="free">100% Free Mode</option>
                  </select>
                  <label className="flex items-center space-x-1 text-xs text-slate-300 cursor-pointer">
                    <span className="text-[11px] text-slate-400">Enable:</span>
                    <input
                      type="checkbox"
                      checked={pricing.jobPosting?.enableFeatured !== false}
                      onChange={(e) => updateNested('jobPosting', 'enableFeatured', e.target.checked)}
                      className="w-4 h-4 rounded border-slate-700 text-purple-500"
                    />
                  </label>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                {Number(pricing.jobPosting?.featuredFeePkr ?? 1000) > 0 ? (
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Fee (PKR)</label>
                    <input
                      type="number"
                      value={pricing.jobPosting?.featuredFeePkr || 0}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        updateNested('jobPosting', 'featuredFeePkr', val);
                        if (val > 0) setPricing((prev: any) => ({ ...prev, jobPosting: { ...prev.jobPosting, _cachedOnlyFeaturedFee: val } }));
                      }}
                      className="w-28 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-bold text-sm"
                    />
                  </div>
                ) : (
                  <div className="text-xs text-emerald-400 font-semibold py-1">✨ Free Mode Active (0 PKR)</div>
                )}
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Duration (Days)</label>
                  <input
                    type="number"
                    value={pricing.jobPosting?.featuredDurationDays || 30}
                    onChange={(e) => updateNested('jobPosting', 'featuredDurationDays', Number(e.target.value))}
                    className="w-28 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Badge Title (Editable)</label>
                  <input
                    type="text"
                    value={pricing.jobPosting?.featuredBadgeText || '⭐ Featured Placement'}
                    onChange={(e) => updateNested('jobPosting', 'featuredBadgeText', e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs"
                  />
                </div>
              </div>

              {/* Homepage Priority Placement Slot Configuration for Featured */}
              <div className="pt-2.5 mt-1 border-t border-purple-500/30 space-y-1.5 bg-purple-500/10 px-3 py-2 rounded-lg">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-purple-300 text-xs flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-purple-400" />
                      ⭐ Featured Slots:
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-bold border border-purple-500/30">
                      {priorityMetrics.tierCounts.featured} / {pricing.jobPosting?.homepagePrioritySlotConfig?.featured?.maxSlots ?? 4} Occupied
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-[11px] text-slate-300 font-medium">Max Card Slots:</span>
                    <input
                      type="number"
                      min="0"
                      max="50"
                      value={pricing.jobPosting?.homepagePrioritySlotConfig?.featured?.maxSlots ?? 4}
                      onChange={(e) => updatePrioritySlot('featured', 'maxSlots', e.target.value)}
                      className="w-16 px-2 py-1 bg-slate-900 border border-purple-500/40 rounded text-center text-white font-black text-xs focus:ring-1 focus:ring-purple-500"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-purple-200/80">
                  Ranks 3rd after VIP and Pinned Top. Separate from Future Job (Advance Intake).
                </p>
              </div>
            </div>

            {/* 4. Urgent Hiring */}
            <div className="bg-slate-950/60 p-4 rounded-xl border border-rose-500/30 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-mono text-[11px] font-black">4. Urgent</span>
                  <span className="font-bold text-rose-400">🔥 Urgent Hiring</span>
                </div>
                <div className="flex items-center space-x-3">
                  <select
                    value={Number(pricing.jobPosting?.urgentFeePkr ?? 500) === 0 ? 'free' : 'paid'}
                    onChange={(e) => {
                      if (e.target.value === 'free') {
                        updateNested('jobPosting', 'urgentFeePkr', 0);
                      } else {
                        updateNested('jobPosting', 'urgentFeePkr', pricing.jobPosting?._cachedUrgentFee || 500);
                      }
                    }}
                    className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-xs text-rose-300 font-bold"
                  >
                    <option value="paid">Paid Mode</option>
                    <option value="free">100% Free Mode</option>
                  </select>
                  <label className="flex items-center space-x-1 text-xs text-slate-300 cursor-pointer">
                    <span className="text-[11px] text-slate-400">Enable:</span>
                    <input type="checkbox" checked={pricing.jobPosting?.enableUrgent !== false} onChange={(e) => updateNested('jobPosting', 'enableUrgent', e.target.checked)} className="w-4 h-4 rounded border-slate-700 text-rose-500" />
                  </label>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                {Number(pricing.jobPosting?.urgentFeePkr ?? 500) > 0 ? (
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Fee (PKR)</label>
                    <input type="number" value={pricing.jobPosting?.urgentFeePkr || 0} onChange={(e) => {
                      const val = Number(e.target.value);
                      updateNested('jobPosting', 'urgentFeePkr', val);
                      if (val > 0) setPricing((prev: any) => ({ ...prev, jobPosting: { ...prev.jobPosting, _cachedUrgentFee: val } }));
                    }} className="w-28 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-bold text-sm" />
                  </div>
                ) : (
                  <div className="text-xs text-emerald-400 font-semibold py-1">✨ Free Mode Active (0 PKR)</div>
                )}
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Duration (Days)</label>
                  <input type="number" value={pricing.jobPosting?.urgentDurationDays || 15} onChange={(e) => updateNested('jobPosting', 'urgentDurationDays', Number(e.target.value))} className="w-28 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm" />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Badge Title (Editable)</label>
                  <input type="text" value={pricing.jobPosting?.urgentBadgeText || 'Urgent Hiring'} onChange={(e) => updateNested('jobPosting', 'urgentBadgeText', e.target.value)} className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs" />
                </div>
              </div>

              {/* Homepage Priority Placement Slot Configuration for Urgent */}
              <div className="pt-2.5 mt-1 border-t border-rose-500/30 flex flex-wrap items-center justify-between gap-2.5 bg-rose-500/10 px-3 py-2 rounded-lg">
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-rose-300 text-xs flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-rose-400" />
                    🔥 Urgent Slots:
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30">
                    {priorityMetrics.tierCounts.urgent} / {pricing.jobPosting?.homepagePrioritySlotConfig?.urgent?.maxSlots ?? 4} Occupied
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-[11px] text-slate-300 font-medium">Max Card Slots:</span>
                  <input
                    type="number"
                    min="0"
                    max="50"
                    value={pricing.jobPosting?.homepagePrioritySlotConfig?.urgent?.maxSlots ?? 4}
                    onChange={(e) => updatePrioritySlot('urgent', 'maxSlots', e.target.value)}
                    className="w-16 px-2 py-1 bg-slate-900 border border-rose-500/40 rounded text-center text-white font-black text-xs focus:ring-1 focus:ring-rose-500"
                  />
                </div>
              </div>
            </div>

            {/* 5. Future Job (Advance Intake — Not Featured) */}
            <div className="bg-slate-950/60 p-4 rounded-xl border border-indigo-500/30 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono text-[11px] font-black">5. Future</span>
                  <span className="font-bold text-indigo-400">🚀 Future Job (Advance Intake)</span>
                </div>
                <div className="flex items-center space-x-3">
                  <select
                    value={Number(pricing.jobPosting?.futureJobFeePkr ?? 800) === 0 ? 'free' : 'paid'}
                    onChange={(e) => {
                      if (e.target.value === 'free') {
                        updateNested('jobPosting', 'futureJobFeePkr', 0);
                      } else {
                        updateNested('jobPosting', 'futureJobFeePkr', pricing.jobPosting?._cachedFutureFee || 800);
                      }
                    }}
                    className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-xs text-indigo-300 font-bold"
                  >
                    <option value="paid">Paid Mode</option>
                    <option value="free">100% Free Mode</option>
                  </select>
                  <label className="flex items-center space-x-1 text-xs text-slate-300 cursor-pointer">
                    <span className="text-[11px] text-slate-400">Enable:</span>
                    <input type="checkbox" checked={pricing.jobPosting?.enableFutureJob !== false} onChange={(e) => updateNested('jobPosting', 'enableFutureJob', e.target.checked)} className="w-4 h-4 rounded border-slate-700 text-indigo-500" />
                  </label>
                </div>
              </div>
              <p className="text-[11px] text-slate-400">
                Upcoming job openings accepting advance registrations with a countdown date (different from <strong className="text-purple-300">Featured</strong> priority slots).
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                {Number(pricing.jobPosting?.futureJobFeePkr ?? 800) > 0 ? (
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Fee (PKR)</label>
                    <input type="number" value={pricing.jobPosting?.futureJobFeePkr || 0} onChange={(e) => {
                      const val = Number(e.target.value);
                      updateNested('jobPosting', 'futureJobFeePkr', val);
                      if (val > 0) setPricing((prev: any) => ({ ...prev, jobPosting: { ...prev.jobPosting, _cachedFutureFee: val } }));
                    }} className="w-28 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-bold text-sm" />
                  </div>
                ) : (
                  <div className="text-xs text-emerald-400 font-semibold py-1">✨ Free Mode Active (0 PKR)</div>
                )}
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Duration (Days)</label>
                  <input type="number" value={pricing.jobPosting?.futureJobDurationDays || 60} onChange={(e) => updateNested('jobPosting', 'futureJobDurationDays', Number(e.target.value))} className="w-28 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm" />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Badge Title (Editable)</label>
                  <input type="text" value={pricing.jobPosting?.futureBadgeText || 'Future Job'} onChange={(e) => updateNested('jobPosting', 'futureBadgeText', e.target.value)} className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs" />
                </div>
              </div>

              {/* Homepage Priority Placement Slot Configuration for Future Job */}
              <div className="pt-2.5 mt-1 border-t border-indigo-500/30 flex flex-wrap items-center justify-between gap-2.5 bg-indigo-500/10 px-3 py-2 rounded-lg">
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-indigo-300 text-xs flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                    🚀 Future Job Slots:
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-500/30">
                    {priorityMetrics.tierCounts.future ?? 0} / {pricing.jobPosting?.homepagePrioritySlotConfig?.future?.maxSlots ?? 4} Occupied
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-[11px] text-slate-300 font-medium">Max Card Slots:</span>
                  <input
                    type="number"
                    min="0"
                    max="50"
                    value={pricing.jobPosting?.homepagePrioritySlotConfig?.future?.maxSlots ?? 4}
                    onChange={(e) => updatePrioritySlot('future', 'maxSlots', e.target.value)}
                    className="w-16 px-2 py-1 bg-slate-900 border border-indigo-500/40 rounded text-center text-white font-black text-xs focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* 6. Standard Job */}
            <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[11px] font-black">6. Standard</span>
                  <span className="font-bold text-white">💼 Standard Job</span>
                </div>
                <div className="flex items-center space-x-3">
                  <select
                    value={Number(pricing.jobPosting?.standardFeePkr ?? 1000) === 0 ? 'free' : 'paid'}
                    onChange={(e) => {
                      if (e.target.value === 'free') {
                        updateNested('jobPosting', 'standardFeePkr', 0);
                      } else {
                        updateNested('jobPosting', 'standardFeePkr', pricing.jobPosting?._cachedStandardFee || 1000);
                      }
                    }}
                    className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-300 font-bold"
                  >
                    <option value="paid">Paid Mode</option>
                    <option value="free">100% Free Mode</option>
                  </select>
                  <label className="flex items-center space-x-1 text-xs text-slate-300 cursor-pointer">
                    <span className="text-[11px] text-slate-400">Enable:</span>
                    <input type="checkbox" checked={pricing.jobPosting?.enableStandard !== false} onChange={(e) => updateNested('jobPosting', 'enableStandard', e.target.checked)} className="w-4 h-4 rounded border-slate-700 text-amber-500" />
                  </label>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                {Number(pricing.jobPosting?.standardFeePkr ?? 1000) > 0 ? (
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Fee (PKR)</label>
                    <input type="number" value={pricing.jobPosting?.standardFeePkr || 0} onChange={(e) => {
                      const val = Number(e.target.value);
                      updateNested('jobPosting', 'standardFeePkr', val);
                      if (val > 0) setPricing((prev: any) => ({ ...prev, jobPosting: { ...prev.jobPosting, _cachedStandardFee: val } }));
                    }} className="w-28 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-bold text-sm" />
                  </div>
                ) : (
                  <div className="text-xs text-emerald-400 font-semibold py-1">✨ Free Mode Active (0 PKR)</div>
                )}
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Duration (Days)</label>
                  <input type="number" value={pricing.jobPosting?.standardDurationDays || 30} onChange={(e) => updateNested('jobPosting', 'standardDurationDays', Number(e.target.value))} className="w-28 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm" />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Description (Editable)</label>
                  <input type="text" value={pricing.jobPosting?.standardDescription || 'Regular chronological placement'} onChange={(e) => updateNested('jobPosting', 'standardDescription', e.target.value)} className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs" />
                </div>
              </div>
            </div>

            {/* Advanced job-tier controls retained from the former mixed Settings page */}
            <div className="mt-5 pt-5 border-t border-slate-800 space-y-4">
              <div>
                <h4 className="font-bold text-white text-sm">Tier Availability & Public Labels</h4>
                <p className="text-xs text-slate-400">Enable or disable each job tier and control the badge text shown on job listings. Prices and durations remain managed above.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {[
                  { field: 'enableStandard', label: 'Standard Listing' },
                  { field: 'enableUrgent', label: 'Urgent Hiring' },
                  { field: 'enableFeatured', label: 'Featured Placement' },
                  { field: 'enableFeaturedTop', label: 'Pinned Top #1' },
                  { field: 'enableFutureJob', label: 'Future Job' },
                  { field: 'enableVipBundle', label: 'VIP Bundle' }
                ].map((tier) => (
                  <label key={tier.field} className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-slate-200">
                    <span className="font-semibold">{tier.label}</span>
                    <input type="checkbox" checked={pricing.jobPosting?.[tier.field] !== false} onChange={(e) => updateNested('jobPosting', tier.field, e.target.checked)} className="h-4 w-4 rounded border-slate-700 text-emerald-500 focus:ring-emerald-500" />
                  </label>
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { field: 'urgentBadgeText', label: 'Urgent Badge Text', fallback: 'Urgent Hiring' },
                  { field: 'pinnedBadgeText', label: 'Pinned Top Badge Text', fallback: '📌 Pinned Top #1' },
                  { field: 'featuredBadgeText', label: 'Featured Badge Text', fallback: '⭐ Featured Placement' },
                  { field: 'futureBadgeText', label: 'Future Job Badge Text', fallback: 'Future Job' },
                  { field: 'vipBadgeText', label: 'VIP Badge Text', fallback: 'VIP Ultimate Placement' }
                ].map((badge) => (
                  <div key={badge.field}>
                    <label className="block text-xs text-slate-400 mb-1">{badge.label}</label>
                    <input type="text" value={pricing.jobPosting?.[badge.field] || badge.fallback} onChange={(e) => updateNested('jobPosting', badge.field, e.target.value)} className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs" />
                  </div>
                ))}
                <div className="sm:col-span-2">
                  <label className="block text-xs text-slate-400 mb-1">Standard Listing Description</label>
                  <input type="text" value={pricing.jobPosting?.standardDescription || 'Regular chronological placement'} onChange={(e) => updateNested('jobPosting', 'standardDescription', e.target.value)} className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs" />
                </div>
              </div>
            </div>

            <div className="mt-4 p-4 bg-slate-950/90 border border-slate-800 rounded-xl space-y-2 text-xs">
              <div className="font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Public Job Ranking Order</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-2 text-[11px] text-slate-300">
                <div className="p-2.5 bg-slate-900 rounded-lg border border-amber-500/30">
                  <strong className="text-amber-300 block mb-1">1st: VIP</strong>
                  VIP bundle listings always appear first at the very top.
                </div>
                <div className="p-2.5 bg-slate-900 rounded-lg border border-blue-500/30">
                  <strong className="text-blue-300 block mb-1">2nd: Pinned Top</strong>
                  Pinned Top listings follow VIP (includes Pinned Top #1 tier).
                </div>
                <div className="p-2.5 bg-slate-900 rounded-lg border border-purple-500/30">
                  <strong className="text-purple-300 block mb-1">3rd: Featured</strong>
                  Standalone Featured listings follow Pinned Top.
                </div>
                <div className="p-2.5 bg-slate-900 rounded-lg border border-rose-500/30">
                  <strong className="text-rose-300 block mb-1">4th: Urgent</strong>
                  Urgent listings follow Featured priority slots.
                </div>
                <div className="p-2.5 bg-slate-900 rounded-lg border border-indigo-500/30">
                  <strong className="text-indigo-300 block mb-1">5th: Future &amp; Standard</strong>
                  Future (advance intake) ranks ahead of regular Standard jobs.
                </div>
              </div>
            </div>

            {/* STEP66-B.1: Homepage Priority Placement Slots Management */}
            <div className="mt-6 pt-6 border-t border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-white text-sm flex items-center space-x-2">
                    <Sliders className="w-4 h-4 text-amber-400" />
                    <span>Homepage Priority Placement Slots</span>
                  </h4>
                  <p className="text-xs text-slate-400">Configure top-of-page slot caps for VIP, Pinned, Featured, Urgent, and Future postings.</p>
                </div>
                <label className="flex items-center space-x-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pricing.jobPosting?.homepagePrioritySlotConfig?.enabled !== false}
                    onChange={(e) => {
                      const cur = pricing.jobPosting?.homepagePrioritySlotConfig || {
                        enabled: true,
                        vip: { enabled: true, maxSlots: 4 },
                        pinned: { enabled: true, maxSlots: 4 },
                        featured: { enabled: true, maxSlots: 4 },
                        urgent: { enabled: true, maxSlots: 4 },
                        future: { enabled: true, maxSlots: 4 }
                      };
                      updateNested('jobPosting', 'homepagePrioritySlotConfig', { ...cur, enabled: e.target.checked });
                    }}
                    className="w-4 h-4 rounded border-slate-700 text-amber-500 focus:ring-amber-500"
                  />
                  <span>Enable System</span>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {/* VIP Slot */}
                <div className="p-3 bg-slate-950/80 rounded-xl border border-amber-500/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-amber-300">👑 VIP Placement Slots</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-medium">
                      {priorityMetrics.tierCounts.vip} / {pricing.jobPosting?.homepagePrioritySlotConfig?.vip?.maxSlots ?? 4} Occupied
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-400">Max Card Slots:</span>
                    <input
                      type="number"
                      min="0"
                      max="50"
                      value={pricing.jobPosting?.homepagePrioritySlotConfig?.vip?.maxSlots ?? 4}
                      onChange={(e) => updatePrioritySlot('vip', 'maxSlots', e.target.value)}
                      className="w-20 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-center text-white font-bold"
                    />
                  </div>
                  {priorityMetrics.tierCounts.vip > (pricing.jobPosting?.homepagePrioritySlotConfig?.vip?.maxSlots ?? 4) && (
                    <p className="text-[10px] text-amber-400 flex items-center space-x-1">
                      <AlertCircle className="w-3 h-3 inline" />
                      <span>Occupied slots exceed configured cap.</span>
                    </p>
                  )}
                </div>

                {/* Pinned Slot */}
                <div className="p-3 bg-slate-950/80 rounded-xl border border-blue-500/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-blue-400">📌 Pinned Top Slots</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-medium">
                      {priorityMetrics.tierCounts.pinned} / {pricing.jobPosting?.homepagePrioritySlotConfig?.pinned?.maxSlots ?? 4} Occupied
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-400">Max Card Slots:</span>
                    <input
                      type="number"
                      min="0"
                      max="50"
                      value={pricing.jobPosting?.homepagePrioritySlotConfig?.pinned?.maxSlots ?? 4}
                      onChange={(e) => updatePrioritySlot('pinned', 'maxSlots', e.target.value)}
                      className="w-20 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-center text-white font-bold"
                    />
                  </div>
                </div>

                {/* Featured Slot */}
                <div className="p-3 bg-slate-950/80 rounded-xl border border-purple-500/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-purple-400">⭐ Featured Slots</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-medium">
                      {priorityMetrics.tierCounts.featured} / {pricing.jobPosting?.homepagePrioritySlotConfig?.featured?.maxSlots ?? 4} Occupied
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-400">Max Card Slots:</span>
                    <input
                      type="number"
                      min="0"
                      max="50"
                      value={pricing.jobPosting?.homepagePrioritySlotConfig?.featured?.maxSlots ?? 4}
                      onChange={(e) => updatePrioritySlot('featured', 'maxSlots', e.target.value)}
                      className="w-20 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-center text-white font-bold"
                    />
                  </div>
                </div>

                {/* Urgent Slot */}
                <div className="p-3 bg-slate-950/80 rounded-xl border border-rose-500/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-rose-400">🔥 Urgent Slots</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-medium">
                      {priorityMetrics.tierCounts.urgent} / {pricing.jobPosting?.homepagePrioritySlotConfig?.urgent?.maxSlots ?? 4} Occupied
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-400">Max Card Slots:</span>
                    <input
                      type="number"
                      min="0"
                      max="50"
                      value={pricing.jobPosting?.homepagePrioritySlotConfig?.urgent?.maxSlots ?? 4}
                      onChange={(e) => updatePrioritySlot('urgent', 'maxSlots', e.target.value)}
                      className="w-20 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-center text-white font-bold"
                    />
                  </div>
                </div>

                {/* Future Job Slot */}
                <div className="p-3 bg-slate-950/80 rounded-xl border border-indigo-500/30 space-y-2 sm:col-span-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-indigo-400">🚀 Future Job (Advance Intake) Slots</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-medium">
                      {priorityMetrics.tierCounts.future ?? 0} / {pricing.jobPosting?.homepagePrioritySlotConfig?.future?.maxSlots ?? 4} Occupied
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-400">Max Card Slots:</span>
                    <input
                      type="number"
                      min="0"
                      max="50"
                      value={pricing.jobPosting?.homepagePrioritySlotConfig?.future?.maxSlots ?? 4}
                      onChange={(e) => updatePrioritySlot('future', 'maxSlots', e.target.value)}
                      className="w-20 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-center text-white font-bold"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Advertisement pricing is maintained in Ad Hub's authoritative Rate Card. */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3">
          <div className="flex items-center gap-2">
            <Tag className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-white text-base">Ad Campaign Rates — Managed in Ad Hub</h3>
          </div>
          <p className="text-xs text-slate-300">
            The active campaign calculator uses the Ad Hub Rate Card (hourly, daily, weekly and monthly rates, placement/page multipliers and SMS charges).
            Open <strong>Ads & Campaigns → Ad Hub & Banner Slots → Rate Card & Pricing Matrix</strong> to manage those values.
          </p>
          <p className="text-[11px] text-slate-500">
            Older advertisement rate fields remain preserved in the saved configuration for backward compatibility. They are not edited here and are not the active campaign-calculation source.
          </p>
        </div>
      </div>
      )}

      {/* SUB-TAB 2: EARLY ACCESS */}
      {activeSubTab === 'early-access' && (
      <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl p-4 sm:p-5 space-y-3.5 lg:col-span-2">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-white text-sm sm:text-base">Premium Early Job Access</h3>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                    pricing.earlyAccess?.enabled === true
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}>
                    {pricing.earlyAccess?.enabled === true ? 'Active' : 'Paused'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">Give active Premium members a configurable time advantage before public release.</p>
              </div>
            </div>
            <label className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-slate-950/80 px-3 py-1.5 text-xs font-bold text-slate-200 cursor-pointer hover:border-emerald-400/50 transition-colors shrink-0">
              <input
                type="checkbox"
                checked={pricing.earlyAccess?.enabled === true}
                onChange={(e) => setPricing((prev: any) => ({ ...prev, earlyAccess: { ...prev.earlyAccess, enabled: e.target.checked } }))}
                className="w-3.5 h-3.5 rounded border-slate-600 text-emerald-500 focus:ring-emerald-500"
              />
              <span>Enable Early Access</span>
            </label>
          </div>

          {/* 1. Timing & Landing Capacity — Compact Side-by-Side Boxes (Mobile & Desktop) */}
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
            <div className="rounded-xl border border-emerald-500/25 bg-slate-950/75 p-2.5 sm:p-3 space-y-1.5">
              <label className="block text-[11px] sm:text-xs text-emerald-300 font-bold leading-tight">
                Early Access Duration (Hours)
              </label>
              <input
                type="number"
                min="1"
                max="8760"
                step="1"
                value={pricing.earlyAccess?.durationHours ?? 24}
                onChange={(e) => setPricing((prev: any) => ({ ...prev, earlyAccess: { ...prev.earlyAccess, durationHours: Math.max(1, Math.min(8760, Math.floor(Number(e.target.value) || 1))) } }))}
                className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-bold text-xs sm:text-sm focus:border-emerald-500/60 focus:outline-none"
              />
              <p className="text-[10px] text-slate-500 leading-tight">24h = 1 day • 48h = 2 days</p>
            </div>

            <div className="rounded-xl border border-emerald-500/25 bg-slate-950/75 p-2.5 sm:p-3 space-y-1.5">
              <label className="block text-[11px] sm:text-xs text-emerald-300 font-bold leading-tight">
                Maximum Landing Page Jobs
              </label>
              <input
                type="number"
                min="1"
                max="100"
                value={pricing.earlyAccess?.maxJobs ?? 10}
                onChange={(e) => setPricing((prev: any) => ({ ...prev, earlyAccess: { ...prev.earlyAccess, maxJobs: Math.max(1, Math.min(100, Math.floor(Number(e.target.value) || 1))) } }))}
                className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-bold text-xs sm:text-sm focus:border-emerald-500/60 focus:outline-none"
              />
              <p className="text-[10px] text-slate-500 leading-tight">Max cards shown (1–100)</p>
            </div>
          </div>

          {/* 2. Apply Early Access to Job Sources */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 sm:p-3.5 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-200">Apply Early Access to Job Sources</span>
              <span className="text-[10px] font-semibold text-emerald-300 bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 rounded">
                {(pricing.earlyAccess?.sourceTypes || []).length} / 3 Selected
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {[
                { id: 'scraped', label: 'Scraper jobs', hint: 'Automated feed' },
                { id: 'user_posted', label: 'User-posted jobs', hint: 'Employer portal' },
                { id: 'admin_created', label: 'Admin-posted jobs', hint: 'Direct staff' }
              ].map((source) => {
                const checked = (pricing.earlyAccess?.sourceTypes || []).includes(source.id);
                return (
                  <label
                    key={source.id}
                    className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-xs cursor-pointer transition-colors ${
                      checked
                        ? 'border-emerald-500/45 bg-emerald-500/10 text-emerald-200'
                        : 'border-slate-800 bg-slate-900/70 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => setPricing((prev: any) => {
                          const current = prev.earlyAccess?.sourceTypes || [];
                          const next = e.target.checked ? [...current, source.id] : current.filter((item: string) => item !== source.id);
                          return { ...prev, earlyAccess: { ...prev.earlyAccess, sourceTypes: next } };
                        })}
                        className="w-3.5 h-3.5 rounded border-slate-600 text-emerald-500 focus:ring-emerald-500 shrink-0"
                      />
                      <span className="font-semibold truncate">{source.label}</span>
                    </div>
                    <span className="text-[10px] text-slate-500 shrink-0">{source.hint}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* 3. Landing Section Display & Copy */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 sm:p-3.5 space-y-2.5">
            <span className="block text-xs font-bold text-slate-200">Landing Section Display & Copy</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                { key: 'showOnLanding', label: 'Show Early Access section on landing page' },
                { key: 'showJobCount', label: 'Show available job count' },
                { key: 'showCountdown', label: 'Show countdown timer' },
                { key: 'showSource', label: 'Show job source / department label' }
              ].map((item) => {
                const isChecked = pricing.earlyAccess?.[item.key] !== false;
                return (
                  <label
                    key={item.key}
                    className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[11px] sm:text-xs cursor-pointer transition-colors ${
                      isChecked
                        ? 'border-slate-700 bg-slate-900/90 text-slate-200'
                        : 'border-slate-800/80 bg-slate-950 text-slate-400'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => setPricing((prev: any) => ({ ...prev, earlyAccess: { ...prev.earlyAccess, [item.key]: e.target.checked } }))}
                      className="w-3.5 h-3.5 rounded border-slate-600 text-emerald-500 focus:ring-emerald-500 shrink-0"
                    />
                    <span>{item.label}</span>
                  </label>
                );
              })}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-slate-800/80">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Landing section heading</label>
                <input
                  type="text"
                  maxLength={100}
                  value={pricing.earlyAccess?.heading || ''}
                  onChange={(e) => setPricing((prev: any) => ({ ...prev, earlyAccess: { ...prev.earlyAccess, heading: e.target.value } }))}
                  placeholder="Premium Early Access"
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs sm:text-sm focus:border-emerald-500/60 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Landing section description</label>
                <input
                  type="text"
                  maxLength={300}
                  value={pricing.earlyAccess?.description || ''}
                  onChange={(e) => setPricing((prev: any) => ({ ...prev, earlyAccess: { ...prev.earlyAccess, description: e.target.value } }))}
                  placeholder="Explore selected jobs before they become available to other members."
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs sm:text-sm focus:border-emerald-500/60 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* 4. Dropdown Visible Fields */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 sm:p-3.5 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-200">
                Fields visible in the Premium Early Access dropdown
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-semibold text-slate-300 bg-slate-900 border border-slate-700 px-2 py-0.5 rounded">
                  {(pricing.earlyAccess?.displayFields || []).length} / 11 Selected
                </span>
                <button
                  type="button"
                  onClick={() => setPricing((prev: any) => ({
                    ...prev,
                    earlyAccess: {
                      ...prev.earlyAccess,
                      displayFields: ['title', 'company', 'department', 'city', 'province', 'jobType', 'deadlineDate', 'salary', 'totalVacancies', 'experienceLevel', 'jobCategory']
                    }
                  }))}
                  className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-900 hover:bg-slate-800 border border-slate-700 text-emerald-300 cursor-pointer"
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setPricing((prev: any) => ({
                    ...prev,
                    earlyAccess: {
                      ...prev.earlyAccess,
                      displayFields: ['title', 'company', 'city', 'deadlineDate']
                    }
                  }))}
                  className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 cursor-pointer"
                >
                  Minimal
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5 sm:gap-2">
              {[
                ['title', 'Job title'], ['company', 'Company'], ['department', 'Department'],
                ['city', 'City'], ['province', 'Province'], ['jobType', 'Job type'],
                ['deadlineDate', 'Deadline'], ['salary', 'Salary'], ['totalVacancies', 'Vacancies'],
                ['experienceLevel', 'Experience'], ['jobCategory', 'Job category']
              ].map(([field, label]) => {
                const isSelected = (pricing.earlyAccess?.displayFields || []).includes(field);
                return (
                  <label
                    key={field}
                    className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 text-[11px] cursor-pointer transition-colors ${
                      isSelected
                        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                        : 'border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => setPricing((prev: any) => {
                        const current = prev.earlyAccess?.displayFields || [];
                        const next = e.target.checked ? [...current, field] : current.filter((item: string) => item !== field);
                        return { ...prev, earlyAccess: { ...prev.earlyAccess, displayFields: next } };
                      })}
                      className="w-3.5 h-3.5 rounded border-slate-600 text-emerald-500 focus:ring-emerald-500 shrink-0"
                    />
                    <span className="truncate">{label}</span>
                  </label>
                );
              })}
            </div>
            <p className="text-[10px] text-slate-500">Sensitive internal moderation, payment and scraper-control fields are never selectable here.</p>
          </div>

          {/* 5. Individual Job Controls */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 sm:p-3.5 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="block text-xs font-bold text-slate-200">Individual job controls</span>
                <p className="text-[10px] text-slate-500">Select a live job to hide it from Early Access or set a custom title for the Premium dropdown.</p>
              </div>
              <span className="text-[10px] font-semibold text-slate-300 bg-slate-900 border border-slate-700 px-2 py-0.5 rounded shrink-0">
                Overrides: {(pricing.earlyAccess?.jobOverrides || []).length}
              </span>
            </div>

            {(() => {
              const searchTerm = earlyAccessJobSearch.trim().toLowerCase();
              const filteredJobs = searchTerm
                ? earlyAccessJobs.filter((job: any) => {
                    const source = job.isScraped || job.isPdfScraped || job.sourceType === 'scraped' || job.sourceType === 'pdf_scraped' || job.scraperSourceId
                      ? 'scraper'
                      : (job.isAdminCreated || job.sourceType === 'admin_created' || job.createdByRole === 'Admin' || job.createdByRole === 'Super Admin' ? 'admin' : 'user');
                    return (
                      String(job.title || '').toLowerCase().includes(searchTerm) ||
                      String(job.company || '').toLowerCase().includes(searchTerm) ||
                      source.includes(searchTerm)
                    );
                  })
                : earlyAccessJobs;

              return (
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                  <div className="relative sm:col-span-5">
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={earlyAccessJobSearch}
                      onChange={(e) => setEarlyAccessJobSearch(e.target.value)}
                      placeholder="Filter live jobs..."
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 pl-8 pr-7 py-1.5 text-xs text-white placeholder:text-slate-500 focus:border-emerald-500/60 focus:outline-none"
                    />
                    {earlyAccessJobSearch && (
                      <button
                        type="button"
                        onClick={() => setEarlyAccessJobSearch('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                        aria-label="Clear job search"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <select
                    value={selectedEarlyAccessJobId}
                    onChange={(e) => setSelectedEarlyAccessJobId(e.target.value)}
                    className="sm:col-span-7 w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white focus:border-emerald-500/60 focus:outline-none"
                  >
                    <option value="">Select a live job ({filteredJobs.length})...</option>
                    {filteredJobs.map((job: any) => {
                      const source = job.isScraped || job.isPdfScraped || job.sourceType === 'scraped' || job.sourceType === 'pdf_scraped' || job.scraperSourceId ? 'Scraper' : (job.isAdminCreated || job.sourceType === 'admin_created' || job.createdByRole === 'Admin' || job.createdByRole === 'Super Admin' ? 'Admin' : 'User');
                      return <option key={job.id} value={String(job.id)}>{job.title || 'Untitled job'} — {source}</option>;
                    })}
                  </select>
                </div>
              );
            })()}

            {selectedEarlyAccessJobId && (() => {
              const selectedJob = earlyAccessJobs.find((job: any) => String(job.id) === selectedEarlyAccessJobId);
              const overrides = pricing.earlyAccess?.jobOverrides || [];
              const currentOverride = overrides.find((item: any) => item.jobId === selectedEarlyAccessJobId);
              const selectedSource = selectedJob?.isScraped || selectedJob?.isPdfScraped || selectedJob?.sourceType === 'scraped' || selectedJob?.sourceType === 'pdf_scraped' || selectedJob?.scraperSourceId
                ? 'scraped'
                : (selectedJob?.isAdminCreated || selectedJob?.sourceType === 'admin_created' || selectedJob?.createdByRole === 'Admin' || selectedJob?.createdByRole === 'Super Admin' ? 'admin_created' : 'user_posted');
              const sourceLabel = selectedSource === 'scraped' ? 'Scraper' : (selectedSource === 'admin_created' ? 'Admin' : 'User');
              const sourceEligible = (pricing.earlyAccess?.sourceTypes || []).includes(selectedSource);
              const enabled = currentOverride ? currentOverride.enabled !== false : sourceEligible;
              const updateOverride = (patch: any) => setPricing((prev: any) => {
                const current = prev.earlyAccess?.jobOverrides || [];
                const existingIndex = current.findIndex((item: any) => item.jobId === selectedEarlyAccessJobId);
                const nextItem = { ...(existingIndex >= 0 ? current[existingIndex] : { jobId: selectedEarlyAccessJobId, enabled }), ...patch };
                const next = existingIndex >= 0 ? current.map((item: any, index: number) => index === existingIndex ? nextItem : item) : [...current, nextItem];
                return { ...prev, earlyAccess: { ...prev.earlyAccess, jobOverrides: next } };
              });
              const clearOverride = () => setPricing((prev: any) => ({
                ...prev,
                earlyAccess: {
                  ...prev.earlyAccess,
                  jobOverrides: (prev.earlyAccess?.jobOverrides || []).filter((item: any) => item.jobId !== selectedEarlyAccessJobId)
                }
              }));
              return (
                <div className="rounded-lg border border-slate-800 bg-slate-900/75 p-2.5 sm:p-3 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-bold text-white truncate">{selectedJob?.title || 'Selected Job'}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 shrink-0">{sourceLabel}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border shrink-0 ${
                        sourceEligible
                          ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25'
                          : 'bg-amber-500/10 text-amber-300 border-amber-500/25'
                      }`}>
                        {sourceEligible ? 'Source eligible' : 'Source excluded'}
                      </span>
                    </div>
                    {currentOverride && (
                      <button
                        type="button"
                        onClick={clearOverride}
                        className="text-[10px] font-semibold text-rose-300 hover:text-rose-200 px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/25 cursor-pointer shrink-0"
                      >
                        Reset Override
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-end">
                    <label className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950/70 px-2.5 py-2 text-xs text-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={enabled}
                        onChange={(e) => updateOverride({ enabled: e.target.checked })}
                        className="w-3.5 h-3.5 rounded border-slate-600 text-emerald-500 focus:ring-emerald-500 shrink-0"
                      />
                      <span>Include this job in Premium Early Access</span>
                    </label>
                    <label className="block text-[11px] font-semibold text-slate-400">
                      Custom display title (optional)
                      <input
                        type="text"
                        maxLength={120}
                        value={currentOverride?.displayTitle || ''}
                        onChange={(e) => updateOverride({ displayTitle: e.target.value })}
                        placeholder={selectedJob?.title || 'Use original job title'}
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white focus:border-emerald-500/60 focus:outline-none"
                      />
                    </label>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* SUB-TAB 3: CANDIDATE SUBSCRIPTIONS */}
      {activeSubTab === 'subscriptions' && (
        <SubscriptionPlansBuilder pricing={pricing} setPricing={setPricing} showReminderSettings />
      )}

      {/* SUB-TAB 4: CATEGORY POSTING FEES */}
      {activeSubTab === 'category' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <div className="flex items-center space-x-2">
                <Tag className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-black text-white">Category Posting Fees & Dynamic Rates</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/25">
                  {(pricing.categoryPostingFees || DEFAULT_CATEGORY_POSTING_FEES).length} Categories
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Configure customized fees per job category, set discounts, or make specific sectors 100% Free (e.g., Govt Jobs, Newspaper Ads, NGOs).
              </p>
            </div>
            <button
              type="button"
              onClick={handleAddCategory}
              className="px-3.5 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-xs font-black border border-amber-500/35 flex items-center space-x-1.5 cursor-pointer shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Custom Category</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(pricing.categoryPostingFees || DEFAULT_CATEGORY_POSTING_FEES).map((cat: any) => (
              <div
                key={cat.categoryId}
                className={`p-4 rounded-2xl border transition-all space-y-3 ${
                  cat.isFree
                    ? 'bg-emerald-950/20 border-emerald-500/40 shadow-emerald-500/5'
                    : 'bg-slate-950/70 border-slate-800'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <input
                    type="text"
                    value={cat.categoryName || ''}
                    onChange={(e) => handleUpdateCategoryFee(cat.categoryId, { categoryName: e.target.value })}
                    className="bg-transparent text-sm font-bold text-white focus:outline-none border-b border-transparent focus:border-amber-500 w-full"
                    placeholder="Category Name"
                  />
                  <button
                    type="button"
                    onClick={() => handleDeleteCategory(cat.categoryId)}
                    className="text-slate-500 hover:text-rose-400 p-1 cursor-pointer"
                    title="Remove Category"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="pt-2 border-t border-slate-800/80 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400 font-bold">Pricing Mode:</span>
                    <button
                      type="button"
                      onClick={() => handleToggleCategoryFree(cat.categoryId)}
                      className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase transition-all cursor-pointer ${
                        cat.isFree
                          ? 'bg-emerald-500 text-slate-950 font-black'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {cat.isFree ? '🎉 100% Free' : '💵 Paid Standard'}
                    </button>
                  </div>

                  {!cat.isFree ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-slate-400">Fee Amount:</span>
                        <div className="flex items-center space-x-1.5">
                          <input
                            type="number"
                            min="0"
                            step="50"
                            value={cat.feePkr ?? 1000}
                            onChange={(e) =>
                              handleUpdateCategoryFee(cat.categoryId, {
                                feePkr: Math.max(0, Number(e.target.value) || 0)
                              })
                            }
                            className="w-24 px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 text-right font-mono font-bold text-white text-xs"
                          />
                          <span className="text-xs font-bold text-slate-400">PKR</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>Discount:</span>
                        <div className="flex items-center space-x-1">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={cat.discountPercent || 0}
                            onChange={(e) =>
                              handleUpdateCategoryFee(cat.categoryId, {
                                discountPercent: Math.max(0, Math.min(100, Number(e.target.value) || 0))
                              })
                            }
                            className="w-14 px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-right font-mono text-xs text-amber-400"
                          />
                          <span>%</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center text-xs text-emerald-400 font-bold">
                      ✨ Employers post in this category at zero cost (100% Free).
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUB-TAB 5: POSTING FEE POLICY */}
      {activeSubTab === 'posting-fee' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-6">
          <div className="border-b border-slate-800 pb-4">
            <div className="flex items-center space-x-2">
              <DollarSign className="w-5 h-5 text-amber-400" />
              <h3 className="text-base font-black text-white">Posting Fee Policy & Global Master Free Switch</h3>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Switch portal-wide billing mode between 100% Free and Standard Paid, configure default base fee, and manage standard posting rules.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Master 1-Click Free Switch */}
            <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col justify-between space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-400">Master Free Mode</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    pricing.isFreeAllPostings || pricing.jobPosting?.isFreeAllPostings
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-slate-800 text-slate-400'
                  }`}>
                    {pricing.isFreeAllPostings || pricing.jobPosting?.isFreeAllPostings ? '100% Free Active' : 'Standard Billing Active'}
                  </span>
                </div>
                <h4 className="text-base font-black text-white">Make All Job Postings 100% Free</h4>
                <p className="text-xs text-slate-400">
                  Instantly bypass posting fees across the entire portal with a single master toggle. When active, employers post free without checkout.
                </p>
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setPricing((prev: any) => ({
                      ...prev,
                      isFreeAllPostings: true,
                      jobPosting: { ...prev.jobPosting, isFreeAllPostings: true }
                    }));
                  }}
                  className={`flex-1 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                    pricing.isFreeAllPostings || pricing.jobPosting?.isFreeAllPostings
                      ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20 font-black'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                  }`}
                >
                  🎉 Enable 100% Free All
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPricing((prev: any) => ({
                      ...prev,
                      isFreeAllPostings: false,
                      jobPosting: { ...prev.jobPosting, isFreeAllPostings: false }
                    }));
                  }}
                  className={`flex-1 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                    !(pricing.isFreeAllPostings || pricing.jobPosting?.isFreeAllPostings)
                      ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20 font-black'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                  }`}
                >
                  💼 Standard Pricing
                </button>
              </div>
            </div>

            {/* Global Base Standard Rate Input */}
            <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-slate-400">Global Base Posting Fee</span>
                <span className="text-xs font-mono font-bold text-amber-400">
                  {pricing.isFreeAllPostings || pricing.jobPosting?.isFreeAllPostings
                    ? `0 PKR (Configured: ${pricing.jobPosting?.standardFeePkr ?? 1000} PKR)`
                    : `${pricing.jobPosting?.standardFeePkr ?? 1000} PKR`}
                </span>
              </div>
              <h4 className="text-base font-black text-white">Default Standard Posting Fee</h4>
              <div className="flex items-center space-x-3">
                <input
                  type="number"
                  min="0"
                  step="50"
                  value={pricing.jobPosting?.standardFeePkr ?? 1000}
                  onChange={(e) => {
                    const val = Math.max(0, Number(e.target.value) || 0);
                    updateNested('jobPosting', 'standardFeePkr', val);
                  }}
                  className="w-full px-4 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono text-base font-bold"
                />
                <span className="text-xs font-bold text-slate-400">PKR</span>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Standard Duration (Days)</label>
                  <input
                    type="number"
                    min="1"
                    max="365"
                    value={pricing.jobPosting?.standardDurationDays ?? 30}
                    onChange={(e) => updateNested('jobPosting', 'standardDurationDays', Number(e.target.value) || 30)}
                    className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs font-bold"
                  />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center space-x-2 text-xs text-slate-300 cursor-pointer p-2 rounded-lg bg-slate-900 border border-slate-800 w-full">
                    <input
                      type="checkbox"
                      checked={pricing.jobPosting?.freePostingAllowed !== false}
                      onChange={(e) => updateNested('jobPosting', 'freePostingAllowed', e.target.checked)}
                      className="w-4 h-4 rounded border-slate-700 text-amber-500"
                    />
                    <span className="text-[11px]">Allow Free Standard</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Card 3: Global Promo Markdown Point / Site-Wide Promotional Discount */}
            <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4 md:col-span-2">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800 pb-3">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <Percent className="w-5 h-5 text-emerald-400" />
                    <h4 className="text-base font-black text-white">Global Promo Markdown Point &amp; Site-Wide Discount</h4>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      {Number(pricing.globalDiscount ?? pricing.jobPosting?.globalDiscount ?? 0)}% OFF Active
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Apply a portal-wide promotional markdown discount percentage across standard job postings and employer checkout.
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                  {[0, 10, 15, 20, 25, 30, 50].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => {
                        setPricing((prev: any) => ({
                          ...prev,
                          globalDiscount: pct,
                          jobPosting: { ...prev.jobPosting, globalDiscount: pct }
                        }));
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        Number(pricing.globalDiscount ?? pricing.jobPosting?.globalDiscount ?? 0) === pct
                          ? 'bg-emerald-500 text-slate-950 font-black shadow-md shadow-emerald-500/20'
                          : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-700/60'
                      }`}
                    >
                      {pct === 0 ? '0% (None)' : `${pct}%`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-center">
                {/* Slider & Numeric Input */}
                <div className="space-y-3 md:col-span-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-300">Promo Markdown Percentage Point</span>
                    <div className="flex items-center space-x-2">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={Number(pricing.globalDiscount ?? pricing.jobPosting?.globalDiscount ?? 0)}
                        onChange={(e) => {
                          const val = Math.min(100, Math.max(0, Number(e.target.value) || 0));
                          setPricing((prev: any) => ({
                            ...prev,
                            globalDiscount: val,
                            jobPosting: { ...prev.jobPosting, globalDiscount: val }
                          }));
                        }}
                        className="w-20 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-right font-mono font-black text-emerald-400 text-sm focus:border-emerald-500 focus:outline-none"
                      />
                      <span className="font-mono font-bold text-emerald-400 text-sm">%</span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={Number(pricing.globalDiscount ?? pricing.jobPosting?.globalDiscount ?? 0)}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setPricing((prev: any) => ({
                        ...prev,
                        globalDiscount: val,
                        jobPosting: { ...prev.jobPosting, globalDiscount: val }
                      }));
                    }}
                    className="w-full accent-emerald-500 cursor-pointer h-2 bg-slate-800 rounded-lg"
                  />
                  <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                    <span>0% (Standard Base Rate)</span>
                    <span>25% Off</span>
                    <span>50% Off</span>
                    <span>75% Off</span>
                    <span>100% Free Promo</span>
                  </div>
                </div>

                {/* Calculation breakdown summary card */}
                {(() => {
                  const baseStandardFee = Number(pricing.jobPosting?.standardFeePkr ?? 1000);
                  const promoDiscountPct = Number(pricing.globalDiscount ?? pricing.jobPosting?.globalDiscount ?? 0);
                  const discountAmount = Math.round((baseStandardFee * promoDiscountPct) / 100);
                  const netEffectiveFee = Math.max(0, baseStandardFee - discountAmount);
                  const isMasterFree = Boolean(pricing.isFreeAllPostings || pricing.jobPosting?.isFreeAllPostings);

                  return (
                    <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2.5 shadow-inner">
                      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                        <span>Live Price Breakdown</span>
                        {promoDiscountPct > 0 && !isMasterFree && (
                          <span className="text-emerald-400 font-mono font-black text-[10px]">
                            Save {discountAmount.toLocaleString()} PKR
                          </span>
                        )}
                      </div>
                      <div className="space-y-1.5 text-xs">
                        <div className="flex items-center justify-between text-slate-300">
                          <span>Standard Base Fee:</span>
                          <span className="font-mono">{baseStandardFee.toLocaleString()} PKR</span>
                        </div>
                        <div className="flex items-center justify-between text-emerald-400 font-semibold">
                          <span>Promo Markdown ({promoDiscountPct}%):</span>
                          <span className="font-mono">-{discountAmount.toLocaleString()} PKR</span>
                        </div>
                        <div className="pt-2 border-t border-slate-800 flex items-center justify-between font-black">
                          <span className="text-white">Net Employer Cost:</span>
                          <span className="font-mono text-base text-amber-400">
                            {isMasterFree ? '0 PKR (100% Free All Active)' : `${netEffectiveFee.toLocaleString()} PKR`}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 6: EMPLOYER 100% WAIVER */}
      {activeSubTab === 'employer-waiver' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <div className="flex items-center space-x-2">
                <Users className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-black text-white">VIP Employers & Whitelisted Free Accounts</h3>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Grant specific companies or registered emails 100% free posting privileges across all job categories.
              </p>
            </div>

            {/* Add Custom Email Form */}
            <div className="flex items-center space-x-2">
              <input
                type="email"
                placeholder="Enter employer email to whitelist..."
                value={newExemptEmail}
                onChange={(e) => setNewExemptEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddExemptEmail();
                  }
                }}
                className="px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 w-64"
              />
              <button
                type="button"
                onClick={handleAddExemptEmail}
                className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center space-x-1 cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Grant Free</span>
              </button>
            </div>
          </div>

          {/* Whitelisted Emails Pills */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2.5">
            <span className="text-xs font-black uppercase text-slate-400">
              Currently Whitelisted Free Emails ({(pricing.exemptUserEmails || []).length}):
            </span>
            <div className="flex flex-wrap gap-2">
              {(pricing.exemptUserEmails || []).map((email: string) => (
                <div
                  key={email}
                  className="px-3 py-1.5 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs font-mono font-bold flex items-center space-x-2"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{email}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveExemptEmail(email)}
                    className="hover:text-rose-400 ml-1 cursor-pointer text-slate-400"
                    title="Revoke Exemption"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {(pricing.exemptUserEmails || []).length === 0 && (
                <p className="text-xs text-slate-500 italic">No employer emails whitelisted yet. Enter an email above to grant 100% free posting.</p>
              )}
            </div>
          </div>

          {/* Quick User List with Search & Toggle */}
          {usersList.length > 0 && (
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <span className="text-xs font-black uppercase text-slate-400">
                  Registered Users &amp; Quick Exemption Toggle ({usersList.length}):
                </span>
                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search users by name, email, company..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
              <div className="overflow-x-auto max-h-72 scrollbar-thin">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase text-[10px]">
                      <th className="py-2 px-3">Name &amp; Company</th>
                      <th className="py-2 px-3">Email</th>
                      <th className="py-2 px-3">Role</th>
                      <th className="py-2 px-3 text-right">Free Waiver</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {(() => {
                      const q = userSearch.trim().toLowerCase();
                      const filtered = q
                        ? usersList.filter((u: any) =>
                            String(u.name || '').toLowerCase().includes(q) ||
                            String(u.email || '').toLowerCase().includes(q) ||
                            String(u.companyName || '').toLowerCase().includes(q)
                          )
                        : usersList.slice(0, 50);

                      if (filtered.length === 0) {
                        return (
                          <tr>
                            <td colSpan={4} className="py-6 text-center text-slate-500 italic">
                              No matching registered users found.
                            </td>
                          </tr>
                        );
                      }

                      return filtered.map((user: any) => {
                      const isExempt = (pricing.exemptUserEmails || []).includes(String(user.email || '').toLowerCase().trim());
                      return (
                        <tr key={user.id || user.email} className="hover:bg-slate-900/40 transition-colors">
                          <td className="py-2 px-3">
                            <div className="font-bold text-white">{user.name || 'Unnamed'}</div>
                            {user.companyName && <div className="text-[11px] text-slate-400">{user.companyName}</div>}
                          </td>
                          <td className="py-2 px-3 font-mono text-slate-300">{user.email}</td>
                          <td className="py-2 px-3 text-slate-400">{user.role || 'Employer'}</td>
                          <td className="py-2 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                const em = String(user.email || '').toLowerCase().trim();
                                if (!em) return;
                                if (isExempt) handleRemoveExemptEmail(em);
                                else {
                                  setPricing((prev: any) => ({
                                    ...prev,
                                    exemptUserEmails: [...(prev.exemptUserEmails || []), em],
                                    jobPosting: {
                                      ...prev.jobPosting,
                                      exemptUserEmails: [...(prev.jobPosting?.exemptUserEmails || []), em]
                                    }
                                  }));
                                }
                              }}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                isExempt
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                  : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
                              }`}
                            >
                              {isExempt ? '✓ Whitelisted Free' : '+ Whitelist'}
                            </button>
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 7: QUICK JOB FEE WAIVERS */}
      {activeSubTab === 'quick-job-waiver' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <div className="flex items-center space-x-2">
                <Gift className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-black text-white">Individual Job Posting Fee Waivers</h3>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                One-click mark individual pending or live jobs as Paid / Fee Exempted (0 PKR) without requiring employer payment.
              </p>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search jobs by title or company..."
                value={quickJobSearch}
                onChange={(e) => setQuickJobSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
            <span className="text-xs font-black uppercase text-slate-400">
              Jobs Queue ({pendingJobsList.length} Pending, {jobsList.length} Active):
            </span>

            <div className="overflow-x-auto max-h-96 scrollbar-thin">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase text-[10px]">
                    <th className="py-2 px-3">Job Title & Company</th>
                    <th className="py-2 px-3">Category</th>
                    <th className="py-2 px-3">Payment Status</th>
                    <th className="py-2 px-3 text-right">1-Click Free Waiver</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {(() => {
                    const combined = [...pendingJobsList, ...jobsList.filter((j) => !pendingJobsList.some((pj) => pj.id === j.id))];
                    const q = quickJobSearch.trim().toLowerCase();
                    const filtered = q
                      ? combined.filter((job) =>
                          String(job.title || '').toLowerCase().includes(q) ||
                          String(job.company || '').toLowerCase().includes(q) ||
                          String(job.jobCategory || '').toLowerCase().includes(q)
                        )
                      : combined.slice(0, 30);

                    if (filtered.length === 0) {
                      return (
                        <tr>
                          <td colSpan={4} className="py-6 text-center text-slate-500 italic">
                            No matching jobs found.
                          </td>
                        </tr>
                      );
                    }

                    return filtered.map((job: any) => {
                      const isPaidOrExempt = job.paymentStatus === 'Paid' || job.paymentStatus === 'Exempt';
                      const isWaiving = waivingJobId === String(job.id);
                      return (
                        <tr key={job.id} className="hover:bg-slate-900/40 transition-colors">
                          <td className="py-2 px-3">
                            <div className="font-bold text-white">{job.title || 'Untitled Job'}</div>
                            <div className="text-[11px] text-slate-400">{job.company || 'Unknown Company'} {job.city ? `• ${job.city}` : ''}</div>
                          </td>
                          <td className="py-2 px-3 text-slate-300">
                            {job.jobCategory || 'General'}
                          </td>
                          <td className="py-2 px-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              job.paymentStatus === 'Paid'
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : job.paymentStatus === 'Exempt'
                                ? 'bg-indigo-500/20 text-indigo-300'
                                : 'bg-amber-500/20 text-amber-300'
                            }`}>
                              {job.paymentStatus || 'Unpaid'}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right">
                            {isPaidOrExempt ? (
                              <span className="text-[11px] text-emerald-400 font-bold flex items-center justify-end gap-1">
                                <CheckCircle className="w-3.5 h-3.5" />
                                <span>Fee Waived</span>
                              </span>
                            ) : (
                              <button
                                type="button"
                                disabled={isWaiving}
                                onClick={() => handleMakeJobFree(job.id)}
                                className="px-3 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-bold border border-emerald-500/30 cursor-pointer"
                              >
                                {isWaiving ? 'Waiving...' : '⚡ Waive Fee (Make Free)'}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 8: CV BUILDER (when enabled) */}
      {activeSubTab === 'cv-builder' && !hideCvSettings && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5 lg:col-span-2">
          <div className="border-b border-slate-800 pb-4"><h3 className="font-bold text-white text-base">CV Builder Access & Monetization</h3><p className="text-xs text-slate-400 mt-1">Control free designs, one-time Premium design prices, export availability and website watermark. A purchased design remains unlocked on the member account.</p></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
            <label className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-slate-300">Maximum CVs for free members<input type="number" min="0" max="10" value={pricing.cvBuilder?.freeCvLimit ?? 1} onChange={(e) => updateNested('cvBuilder', 'freeCvLimit', Math.max(0, Math.min(10, Math.floor(Number(e.target.value) || 0))))} className="mt-2 w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white" /></label>
            <label className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-slate-300">Maximum CVs for premium members<input type="number" min="1" max="10" value={pricing.cvBuilder?.premiumCvLimit ?? 10} onChange={(e) => updateNested('cvBuilder', 'premiumCvLimit', Math.max(1, Math.min(10, Math.floor(Number(e.target.value) || 1))))} className="mt-2 w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white" /></label>
            <label className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-slate-300">Maximum free designs<input type="number" min="0" max="5" value={pricing.cvBuilder?.freeDesignLimit ?? 2} onChange={(e) => updateNested('cvBuilder', 'freeDesignLimit', Math.max(0, Math.min(5, Math.floor(Number(e.target.value) || 0))))} className="mt-2 w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white" /></label>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {[
              { field: 'pdfExportEnabled', label: 'Allow PDF export for free members' },
              { field: 'atsTextExportEnabled', label: 'Allow ATS text export for free members' },
              { field: 'watermarkEnabled', label: 'Enable website watermark' },
              { field: 'watermarkFreeOnly', label: 'Apply watermark to free-member exports only' }
            ].map((item) => <label key={item.field} className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950 p-3 text-slate-300"><span>{item.label}</span><input type="checkbox" checked={pricing.cvBuilder?.[item.field] !== false} onChange={(e) => updateNested('cvBuilder', item.field, e.target.checked)} className="h-4 w-4" /></label>)}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="text-xs text-slate-400">Watermark text / website branding<input type="text" maxLength={80} value={pricing.cvBuilder?.watermarkText || 'Hybrid Job Portal'} onChange={(e) => updateNested('cvBuilder', 'watermarkText', e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white" /></label>
            <label className="text-xs text-slate-400">Watermark opacity (0.05–0.35)<input type="number" min="0.05" max="0.35" step="0.01" value={pricing.cvBuilder?.watermarkOpacity ?? 0.16} onChange={(e) => updateNested('cvBuilder', 'watermarkOpacity', Math.max(0.05, Math.min(0.35, Number(e.target.value) || 0.16)))} className="mt-1 w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white" /></label>
          </div>
          <div className="space-y-3"><div><h4 className="text-sm font-bold text-white">Individual CV Design Controls</h4><p className="text-[11px] text-slate-400">Enable/hide each design, mark it free or premium and set its individual price.</p></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(pricing.cvBuilder?.templates || []).map((template: any, index: number) => <div key={template.id} className="rounded-xl border border-slate-800 bg-slate-950 p-3 space-y-3">
                <div className="flex items-center justify-between gap-2"><input aria-label={`CV design ${index + 1} name`} type="text" maxLength={80} value={template.name || ''} onChange={(e) => { const templates = [...(pricing.cvBuilder?.templates || [])]; templates[index] = { ...templates[index], name: e.target.value }; updateNested('cvBuilder', 'templates', templates); }} className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm font-bold text-white" /><label className="flex items-center gap-2 text-[11px] text-slate-400">Available<input type="checkbox" checked={template.enabled !== false} onChange={(e) => { const templates = [...(pricing.cvBuilder?.templates || [])]; templates[index] = { ...templates[index], enabled: e.target.checked }; updateNested('cvBuilder', 'templates', templates); }} /></label></div>
                <div className="flex items-center justify-between gap-3"><label className="flex items-center gap-2 text-xs text-slate-300">Free for free members<input type="checkbox" checked={template.free === true} onChange={(e) => { const templates = [...(pricing.cvBuilder?.templates || [])]; templates[index] = { ...templates[index], free: e.target.checked }; updateNested('cvBuilder', 'templates', templates); }} /></label><label className="text-[11px] text-slate-400">Price (PKR)<input type="number" min="0" value={template.pricePkr ?? 0} onChange={(e) => { const templates = [...(pricing.cvBuilder?.templates || [])]; templates[index] = { ...templates[index], pricePkr: Math.max(0, Number(e.target.value) || 0) }; updateNested('cvBuilder', 'templates', templates); }} className="ml-2 w-24 px-2 py-1.5 rounded bg-slate-900 border border-slate-700 text-white" /></label></div>
              </div>)}
            </div>
          </div>
          <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/60 p-3">
            <div className="text-xs font-bold text-slate-300">Future AI CV Optimizer price (PKR)</div>
            <p className="mt-1 text-[10px] text-amber-300">Configuration is retained for compatibility. AI CV optimization is not currently enabled for candidates and this value does not trigger a payment.</p>
            <input type="number" min="0" value={pricing.cvBuilder?.premiumAiOptimizerPkr ?? 500} onChange={(e) => updateNested('cvBuilder', 'premiumAiOptimizerPkr', Math.max(0, Number(e.target.value) || 0))} className="mt-2 w-full max-w-xs rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" />
          </div>
        </div>
      )}

    </div>
  );
};
