import React, { useState, useEffect } from 'react';
import { 
  DollarSign, 
  Save, 
  Sparkles, 
  ShieldCheck, 
  Sliders, 
  Clock, 
  Tag, 
  Percent, 
  CheckCircle, 
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { api } from '../../services/api';

interface AdminPricingControllerProps {
  onPricingSaved?: (authoritativePricing: any) => void;
}

export const AdminPricingController: React.FC<AdminPricingControllerProps> = ({
  onPricingSaved
}) => {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pricing, setPricing] = useState<any>({
    jobPosting: {
      standardFeePkr: 1000,
      enableStandard: true,
      enableUrgent: true,
      enableFeaturedTop: true,
      enableFutureJob: true,
      enableVipBundle: true,
      standardDescription: 'Regular chronological placement',
      urgentBadgeText: 'Urgent Hiring',
      featuredBadgeText: 'Featured',
      futureBadgeText: 'Future Job',
      vipBadgeText: 'VIP Ultimate Placement',
      urgentFeePkr: 500,
      featuredTopFeePkr: 1500,
      futureJobFeePkr: 800,
      vipBundleFeePkr: 2500,
      freePostingAllowed: true,
      standardDurationDays: 30,
      urgentDurationDays: 15,
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

  const [priorityMetrics, setPriorityMetrics] = useState<{
    tierCounts: { vip: number; pinned: number; featured: number; urgent: number };
    slotLimits: { vip: number; pinned: number; featured: number; urgent: number };
  }>({
    tierCounts: { vip: 0, pinned: 0, featured: 0, urgent: 0 },
    slotLimits: { vip: 2, pinned: 2, featured: 4, urgent: 4 }
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
        setPricing((prev: any) => ({
          ...prev,
          ...data.pricing,
          jobPosting: { ...prev.jobPosting, ...(data.pricing.jobPosting || {}) },
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
      }
      const priorityRes = await api.jobs.getPriority();
      if (priorityRes && priorityRes.success && priorityRes.tierCounts) {
        setPriorityMetrics({
          tierCounts: priorityRes.tierCounts,
          slotLimits: priorityRes.slotLimits || { vip: 2, pinned: 2, featured: 4, urgent: 4 }
        });
      }
    } catch (err: any) {
      console.error('Failed to load pricing:', err);
      setLoadError(err?.message || 'Unable to load authoritative pricing configuration.');
    } finally {
      setLoading(false);
    }
  };

  const updatePrioritySlot = (tier: 'vip' | 'pinned' | 'featured' | 'urgent', field: 'enabled' | 'maxSlots', value: any) => {
    setPricing((prev: any) => {
      const currentConfig = prev.jobPosting?.homepagePrioritySlotConfig || {
        enabled: true,
        vip: { enabled: true, maxSlots: 2 },
        pinned: { enabled: true, maxSlots: 2 },
        featured: { enabled: true, maxSlots: 4 },
        urgent: { enabled: true, maxSlots: 4 }
      };
      return {
        ...prev,
        jobPosting: {
          ...prev.jobPosting,
          homepagePrioritySlotConfig: {
            ...currentConfig,
            [tier]: {
              ...currentConfig[tier],
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
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const res = await api.pricing.update(pricing);
      if (res && res.success) {
        if (res.pricing) {
          setPricing(res.pricing);
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

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-400 flex items-center justify-center space-x-3">
        <RefreshCw className="w-5 h-5 animate-spin text-amber-500" />
        <span>Loading persistent pricing configuration...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
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

      {/* Grid of Pricing Sections */}
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
            {/* Standard Fee */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
              <div>
                <span className="font-semibold text-white block">Standard Job</span>
                <span className="text-xs text-slate-500">Regular listing</span>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Fee (PKR)</label>
                <input
                  type="number"
                  value={pricing.jobPosting?.standardFeePkr || 0}
                  onChange={(e) => updateNested('jobPosting', 'standardFeePkr', Number(e.target.value))}
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Duration (Days)</label>
                <input
                  type="number"
                  value={pricing.jobPosting?.standardDurationDays || 30}
                  onChange={(e) => updateNested('jobPosting', 'standardDurationDays', Number(e.target.value))}
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm"
                />
              </div>
            </div>

            {/* Urgent Job */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
              <div>
                <span className="font-semibold text-rose-400 block">🔥 Urgent Hiring</span>
                <span className="text-xs text-slate-500">Flashing urgent badge</span>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Fee (PKR)</label>
                <input
                  type="number"
                  value={pricing.jobPosting?.urgentFeePkr || 0}
                  onChange={(e) => updateNested('jobPosting', 'urgentFeePkr', Number(e.target.value))}
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Duration (Days)</label>
                <input
                  type="number"
                  value={pricing.jobPosting?.urgentDurationDays || 15}
                  onChange={(e) => updateNested('jobPosting', 'urgentDurationDays', Number(e.target.value))}
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm"
                />
              </div>
            </div>

            {/* Featured Top */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
              <div>
                <span className="font-semibold text-amber-400 block">⭐ Pinned Top #1</span>
                <span className="text-xs text-slate-500">Pinned atop search</span>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Fee (PKR)</label>
                <input
                  type="number"
                  value={pricing.jobPosting?.featuredTopFeePkr || 0}
                  onChange={(e) => updateNested('jobPosting', 'featuredTopFeePkr', Number(e.target.value))}
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Duration (Days)</label>
                <input
                  type="number"
                  value={pricing.jobPosting?.featuredTopDurationDays || 30}
                  onChange={(e) => updateNested('jobPosting', 'featuredTopDurationDays', Number(e.target.value))}
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm"
                />
              </div>
            </div>

            {/* Future Job Advance Intake */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
              <div>
                <span className="font-semibold text-indigo-400 block">🚀 Future Job Slot</span>
                <span className="text-xs text-slate-500">Batch pre-registration</span>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Fee (PKR)</label>
                <input
                  type="number"
                  value={pricing.jobPosting?.futureJobFeePkr || 0}
                  onChange={(e) => updateNested('jobPosting', 'futureJobFeePkr', Number(e.target.value))}
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Duration (Days)</label>
                <input
                  type="number"
                  value={pricing.jobPosting?.futureJobDurationDays || 60}
                  onChange={(e) => updateNested('jobPosting', 'futureJobDurationDays', Number(e.target.value))}
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm"
                />
              </div>
            </div>

            {/* VIP Bundle */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center bg-slate-950/60 p-3.5 rounded-xl border border-amber-500/30">
              <div>
                <span className="font-semibold text-amber-300 block">👑 VIP Ultimate Bundle</span>
                <span className="text-xs text-slate-500">Top + Urgent + Gold banner</span>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Fee (PKR)</label>
                <input
                  type="number"
                  value={pricing.jobPosting?.vipBundleFeePkr || 0}
                  onChange={(e) => updateNested('jobPosting', 'vipBundleFeePkr', Number(e.target.value))}
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Duration (Days)</label>
                <input
                  type="number"
                  value={pricing.jobPosting?.vipBundleDurationDays || 45}
                  onChange={(e) => updateNested('jobPosting', 'vipBundleDurationDays', Number(e.target.value))}
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm"
                />
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
                  { field: 'enableFeaturedTop', label: 'Pinned / Featured Top' },
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
                  { field: 'featuredBadgeText', label: 'Featured Badge Text', fallback: 'Featured' },
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
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2 text-[11px] text-slate-300">
                <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800">
                  <strong className="text-purple-300 block mb-1">1st: VIP & Pinned Top</strong>
                  VIP and pinned listings appear before all other job tiers.
                </div>
                <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800">
                  <strong className="text-amber-300 block mb-1">2nd: Featured</strong>
                  Featured listings follow pinned jobs.
                </div>
                <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800">
                  <strong className="text-rose-300 block mb-1">3rd: Urgent</strong>
                  Urgent listings appear before regular listings.
                </div>
                <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800">
                  <strong className="text-indigo-300 block mb-1">4th: Future & Standard</strong>
                  Future jobs show their countdown; standard jobs sort by recency.
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
                  <p className="text-xs text-slate-400">Configure top-of-page slot caps for VIP, Pinned, Featured, and Urgent postings.</p>
                </div>
                <label className="flex items-center space-x-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pricing.jobPosting?.homepagePrioritySlotConfig?.enabled !== false}
                    onChange={(e) => {
                      const cur = pricing.jobPosting?.homepagePrioritySlotConfig || {
                        enabled: true,
                        vip: { enabled: true, maxSlots: 2 },
                        pinned: { enabled: true, maxSlots: 2 },
                        featured: { enabled: true, maxSlots: 4 },
                        urgent: { enabled: true, maxSlots: 4 }
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
                      {priorityMetrics.tierCounts.vip} / {pricing.jobPosting?.homepagePrioritySlotConfig?.vip?.maxSlots ?? 2} Occupied
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-400">Max Card Slots:</span>
                    <input
                      type="number"
                      min="0"
                      max="50"
                      value={pricing.jobPosting?.homepagePrioritySlotConfig?.vip?.maxSlots ?? 2}
                      onChange={(e) => updatePrioritySlot('vip', 'maxSlots', e.target.value)}
                      className="w-20 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-center text-white font-bold"
                    />
                  </div>
                  {priorityMetrics.tierCounts.vip > (pricing.jobPosting?.homepagePrioritySlotConfig?.vip?.maxSlots ?? 2) && (
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
                      {priorityMetrics.tierCounts.pinned} / {pricing.jobPosting?.homepagePrioritySlotConfig?.pinned?.maxSlots ?? 2} Occupied
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-400">Max Card Slots:</span>
                    <input
                      type="number"
                      min="0"
                      max="50"
                      value={pricing.jobPosting?.homepagePrioritySlotConfig?.pinned?.maxSlots ?? 2}
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

        {/* Premium Early Job Access — persisted through the existing authoritative pricing configuration. */}
        <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl p-6 space-y-4 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-emerald-400" />
              <div>
                <h3 className="font-bold text-white text-base">Premium Early Job Access</h3>
                <p className="text-[11px] text-slate-400">Give active Premium members a configurable time advantage.</p>
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs font-bold text-slate-300">
              Enable Early Access
              <input type="checkbox" checked={pricing.earlyAccess?.enabled === true} onChange={(e) => setPricing((prev: any) => ({ ...prev, earlyAccess: { ...prev.earlyAccess, enabled: e.target.checked } }))} />
            </label>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-xs text-slate-300 font-semibold">Early access duration (hours)</label>
              <input type="number" min="1" max="8760" step="1" value={pricing.earlyAccess?.durationHours ?? 24} onChange={(e) => setPricing((prev: any) => ({ ...prev, earlyAccess: { ...prev.earlyAccess, durationHours: Math.max(1, Math.min(8760, Math.floor(Number(e.target.value) || 1))) } }))} className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white" />
              <p className="text-[10px] text-slate-500">24 hours = 1 day; 48 hours = 2 days.</p>
            </div>
            <div className="space-y-2">
              <label className="block text-xs text-slate-300 font-semibold">Maximum landing-page jobs</label>
              <input type="number" min="1" max="100" value={pricing.earlyAccess?.maxJobs ?? 10} onChange={(e) => setPricing((prev: any) => ({ ...prev, earlyAccess: { ...prev.earlyAccess, maxJobs: Math.max(1, Math.min(100, Math.floor(Number(e.target.value) || 1))) } }))} className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white" />
            </div>
          </div>
          <div className="space-y-2">
            <span className="block text-xs text-slate-300 font-semibold">Apply Early Access to job sources (multiple selection allowed)</span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {[
                { id: 'scraped', label: 'Scraper jobs' },
                { id: 'user_posted', label: 'User-posted jobs' },
                { id: 'admin_created', label: 'Admin-posted jobs' }
              ].map((source) => (
                <label key={source.id} className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200">
                  <input type="checkbox" checked={(pricing.earlyAccess?.sourceTypes || []).includes(source.id)} onChange={(e) => setPricing((prev: any) => {
                    const current = prev.earlyAccess?.sourceTypes || [];
                    const next = e.target.checked ? [...current, source.id] : current.filter((item: string) => item !== source.id);
                    return { ...prev, earlyAccess: { ...prev.earlyAccess, sourceTypes: next } };
                  })} />
                  {source.label}
                </label>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              { key: 'showOnLanding', label: 'Show Early Access section on landing page' },
              { key: 'showJobCount', label: 'Show available job count' },
              { key: 'showCountdown', label: 'Show countdown timer' },
              { key: 'showSource', label: 'Show job source / department label' }
            ].map((item) => (
              <label key={item.key} className="flex items-center gap-2 text-xs text-slate-300">
                <input type="checkbox" checked={pricing.earlyAccess?.[item.key] !== false} onChange={(e) => setPricing((prev: any) => ({ ...prev, earlyAccess: { ...prev.earlyAccess, [item.key]: e.target.checked } }))} />
                {item.label}
              </label>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-300 mb-1">Landing section heading</label>
              <input type="text" maxLength={100} value={pricing.earlyAccess?.heading || ''} onChange={(e) => setPricing((prev: any) => ({ ...prev, earlyAccess: { ...prev.earlyAccess, heading: e.target.value } }))} className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-sm" />
            </div>
            <div>
              <label className="block text-xs text-slate-300 mb-1">Landing section description</label>
              <input type="text" maxLength={300} value={pricing.earlyAccess?.description || ''} onChange={(e) => setPricing((prev: any) => ({ ...prev, earlyAccess: { ...prev.earlyAccess, description: e.target.value } }))} className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-sm" />
            </div>
          </div>
          <div className="space-y-2">
            <span className="block text-xs text-slate-300 font-semibold">Fields visible in the Premium Early Access dropdown</span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                ['title', 'Job title'], ['company', 'Company'], ['department', 'Department'],
                ['city', 'City'], ['province', 'Province'], ['jobType', 'Job type'],
                ['deadlineDate', 'Deadline'], ['salary', 'Salary'], ['totalVacancies', 'Vacancies'],
                ['experienceLevel', 'Experience'], ['jobCategory', 'Job category']
              ].map(([field, label]) => (
                <label key={field} className="flex items-center gap-2 text-[11px] text-slate-300">
                  <input type="checkbox" checked={(pricing.earlyAccess?.displayFields || []).includes(field)} onChange={(e) => setPricing((prev: any) => {
                    const current = prev.earlyAccess?.displayFields || [];
                    const next = e.target.checked ? [...current, field] : current.filter((item: string) => item !== field);
                    return { ...prev, earlyAccess: { ...prev.earlyAccess, displayFields: next } };
                  })} />
                  {label}
                </label>
              ))}
            </div>
            <p className="text-[10px] text-slate-500">Sensitive internal moderation, payment and scraper-control fields are never selectable here.</p>
          </div>
          <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
            <div>
              <span className="block text-xs font-bold text-slate-200">Individual job controls</span>
              <p className="text-[10px] text-slate-500">Select a job to hide it from Early Access or set a custom title for the Premium dropdown. Source selection above remains the master eligibility rule.</p>
            </div>
            <select value={selectedEarlyAccessJobId} onChange={(e) => setSelectedEarlyAccessJobId(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white">
              <option value="">Select a live job...</option>
              {earlyAccessJobs.map((job: any) => {
                const source = job.isScraped || job.isPdfScraped || job.sourceType === 'scraped' || job.sourceType === 'pdf_scraped' || job.scraperSourceId ? 'Scraper' : (job.isAdminCreated || job.sourceType === 'admin_created' || job.createdByRole === 'Admin' || job.createdByRole === 'Super Admin' ? 'Admin' : 'User');
                return <option key={job.id} value={String(job.id)}>{job.title || 'Untitled job'} — {source}</option>;
              })}
            </select>
            {selectedEarlyAccessJobId && (() => {
              const selectedJob = earlyAccessJobs.find((job: any) => String(job.id) === selectedEarlyAccessJobId);
              const overrides = pricing.earlyAccess?.jobOverrides || [];
              const currentOverride = overrides.find((item: any) => item.jobId === selectedEarlyAccessJobId);
              const selectedSource = selectedJob?.isScraped || selectedJob?.isPdfScraped || selectedJob?.sourceType === 'scraped' || selectedJob?.sourceType === 'pdf_scraped' || selectedJob?.scraperSourceId
                ? 'scraped'
                : (selectedJob?.isAdminCreated || selectedJob?.sourceType === 'admin_created' || selectedJob?.createdByRole === 'Admin' || selectedJob?.createdByRole === 'Super Admin' ? 'admin_created' : 'user_posted');
              const sourceEligible = (pricing.earlyAccess?.sourceTypes || []).includes(selectedSource);
              const enabled = currentOverride ? currentOverride.enabled !== false : sourceEligible;
              const updateOverride = (patch: any) => setPricing((prev: any) => {
                const current = prev.earlyAccess?.jobOverrides || [];
                const existingIndex = current.findIndex((item: any) => item.jobId === selectedEarlyAccessJobId);
                const nextItem = { ...(existingIndex >= 0 ? current[existingIndex] : { jobId: selectedEarlyAccessJobId, enabled }), ...patch };
                const next = existingIndex >= 0 ? current.map((item: any, index: number) => index === existingIndex ? nextItem : item) : [...current, nextItem];
                return { ...prev, earlyAccess: { ...prev.earlyAccess, jobOverrides: next } };
              });
              return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label className="flex items-center gap-2 text-xs text-slate-300">
                    <input type="checkbox" checked={enabled} onChange={(e) => updateOverride({ enabled: e.target.checked })} />
                    Include this job in Premium Early Access
                  </label>
                  <label className="text-[11px] text-slate-400">Custom display title (optional)
                    <input type="text" maxLength={120} value={currentOverride?.displayTitle || ''} onChange={(e) => updateOverride({ displayTitle: e.target.value })} placeholder={selectedJob?.title || 'Use original job title'} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white" />
                  </label>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Subscription Feature Catalog & Renewal Reminders */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 lg:col-span-2">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="font-bold text-white text-base">Subscription Feature Catalog</h3>
            <p className="text-xs text-slate-400 mt-1">Admin-defined feature prices, durations and posting slots. Prices are not hardcoded; disabled features cannot be added to new packages.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {(pricing.subscriptionFeatureCatalog || []).map((feature: any, index: number) => (
              <div key={feature.id} className="rounded-xl border border-slate-800 bg-slate-950 p-3 space-y-2">
                <label className="flex items-center justify-between gap-2 text-xs font-bold text-white">
                  <span>{feature.label}</span>
                  <input type="checkbox" checked={feature.enabled === true} onChange={(e) => {
                    const next = [...(pricing.subscriptionFeatureCatalog || [])];
                    next[index] = { ...next[index], enabled: e.target.checked };
                    setPricing((prev: any) => ({ ...prev, subscriptionFeatureCatalog: next }));
                  }} />
                </label>
                <label className="block text-[10px] text-slate-400">Price (PKR)
                  <input type="number" min="0" value={feature.pricePkr ?? 0} onChange={(e) => {
                    const next = [...(pricing.subscriptionFeatureCatalog || [])];
                    next[index] = { ...next[index], pricePkr: Math.max(0, Math.floor(Number(e.target.value) || 0)) };
                    setPricing((prev: any) => ({ ...prev, subscriptionFeatureCatalog: next }));
                  }} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-white" />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-[10px] text-slate-400">Duration (days)
                    <input type="number" min="1" max="3650" value={feature.durationDays ?? 30} onChange={(e) => {
                      const next = [...(pricing.subscriptionFeatureCatalog || [])];
                      next[index] = { ...next[index], durationDays: Math.max(1, Math.min(3650, Math.floor(Number(e.target.value) || 30))) };
                      setPricing((prev: any) => ({ ...prev, subscriptionFeatureCatalog: next }));
                    }} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-white" />
                  </label>
                  <label className="text-[10px] text-slate-400">Included slots
                    <input type="number" min="0" max="1000" value={feature.includedSlots ?? 0} onChange={(e) => {
                      const next = [...(pricing.subscriptionFeatureCatalog || [])];
                      next[index] = { ...next[index], includedSlots: Math.max(0, Math.min(1000, Math.floor(Number(e.target.value) || 0))) };
                      setPricing((prev: any) => ({ ...prev, subscriptionFeatureCatalog: next }));
                    }} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-white" />
                  </label>
                </div>
                <label className="block text-[10px] text-slate-400">Each slot duration (days)
                  <input type="number" min="1" max="3650" value={feature.slotDurationDays ?? 30} onChange={(e) => {
                    const next = [...(pricing.subscriptionFeatureCatalog || [])];
                    next[index] = { ...next[index], slotDurationDays: Math.max(1, Math.min(3650, Math.floor(Number(e.target.value) || 30))) };
                    setPricing((prev: any) => ({ ...prev, subscriptionFeatureCatalog: next }));
                  }} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-white" />
                </label>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="text-xs text-slate-300">Combined package discount (%)
              <input type="number" min="0" max="100" value={pricing.subscriptionBundleDiscountPercent ?? 0} onChange={(e) => setPricing((prev: any) => ({ ...prev, subscriptionBundleDiscountPercent: Math.max(0, Math.min(100, Number(e.target.value) || 0)) }))} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white" />
            </label>
            <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
              <label className="flex items-center justify-between gap-2 text-xs text-slate-300">Enable in-app expiry reminders
                <input type="checkbox" checked={pricing.subscriptionReminderSettings?.enabled === true} onChange={(e) => setPricing((prev: any) => ({ ...prev, subscriptionReminderSettings: { ...(prev.subscriptionReminderSettings || {}), enabled: e.target.checked } }))} />
              </label>
              <label className="mt-2 block text-[10px] text-slate-400">Remind this many days before expiry
                <input type="number" min="1" max="30" value={pricing.subscriptionReminderSettings?.daysBefore ?? 3} onChange={(e) => setPricing((prev: any) => ({ ...prev, subscriptionReminderSettings: { ...(prev.subscriptionReminderSettings || {}), daysBefore: Math.max(1, Math.min(30, Math.floor(Number(e.target.value) || 3)) } }))} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-white" />
              </label>
              <p className="mt-2 text-[10px] text-slate-500">This scheduler sends in-app notifications only. External channels require configured delivery providers.</p>
            </div>
          </div>
        </div>

        {/* 3. Subscriptions & Candidate Plans */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center space-x-2.5">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <h3 className="font-bold text-white text-base">Candidate Subscription Plans (Dynamic Packages)</h3>
            </div>
            <button
              onClick={() => {
                const newPkg = {
                  id: `pkg-${Date.now()}`,
                  name: 'New Package',
                  pricePkr: 500,
                  durationDays: 30,
                  features: ['Feature 1'],
                  featureIds: [],
                  pricingMode: 'fixed',
                  enabled: true
                };
                setPricing((prev: any) => ({
                  ...prev,
                  subscriptionPackages: [...(prev.subscriptionPackages || []), newPkg]
                }));
              }}
              className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-bold transition-all"
            >
              + Add New Package
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(pricing.subscriptionPackages || []).map((pkg: any, idx: number) => (
              <div key={pkg.id || idx} className={`p-4 bg-slate-950/60 rounded-xl border transition-all ${pkg.enabled ? 'border-slate-800' : 'border-slate-800/40 grayscale opacity-60'}`}>
                <div className="flex items-center justify-between mb-4">
                  <input
                    type="text"
                    value={pkg.name}
                    onChange={(e) => {
                      const newList = [...pricing.subscriptionPackages];
                      newList[idx] = { ...newList[idx], name: e.target.value };
                      setPricing((prev: any) => ({ ...prev, subscriptionPackages: newList }));
                    }}
                    className="bg-transparent border-b border-slate-800 focus:border-emerald-500 text-white font-bold text-sm outline-none px-1 py-0.5"
                    placeholder="Package Name"
                  />
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={pkg.enabled}
                      onChange={(e) => {
                        const newList = [...pricing.subscriptionPackages];
                        newList[idx] = { ...newList[idx], enabled: e.target.checked };
                        setPricing((prev: any) => ({ ...prev, subscriptionPackages: newList }));
                      }}
                      className="w-4 h-4 rounded border-slate-700 text-emerald-500 focus:ring-emerald-500"
                    />
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Enabled</span>
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div>
                    <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Price (PKR)</label>
                    <input
                      type="number"
                      value={pkg.pricePkr}
                      onChange={(e) => {
                        const newList = [...pricing.subscriptionPackages];
                        newList[idx] = { ...newList[idx], pricePkr: Number(e.target.value) };
                        setPricing((prev: any) => ({ ...prev, subscriptionPackages: newList }));
                      }}
                      className="w-full px-2 py-1 bg-slate-900 border border-slate-800 rounded text-white text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Duration (Days)</label>
                    <input
                      type="number"
                      value={pkg.durationDays}
                      onChange={(e) => {
                        const newList = [...pricing.subscriptionPackages];
                        newList[idx] = { ...newList[idx], durationDays: Number(e.target.value) };
                        setPricing((prev: any) => ({ ...prev, subscriptionPackages: newList }));
                      }}
                      className="w-full px-2 py-1 bg-slate-900 border border-slate-800 rounded text-white text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-2 mb-3">
                  <label className="text-[10px] text-slate-500 font-bold uppercase block">Package pricing mode</label>
                  <select value={pkg.pricingMode === 'catalog' ? 'catalog' : 'fixed'} onChange={(e) => {
                    const newList = [...pricing.subscriptionPackages];
                    newList[idx] = { ...newList[idx], pricingMode: e.target.value };
                    setPricing((prev: any) => ({ ...prev, subscriptionPackages: newList }));
                  }} className="w-full px-2 py-2 bg-slate-900 border border-slate-800 rounded text-white text-xs">
                    <option value="fixed">Use manually configured package price</option>
                    <option value="catalog">Calculate from selected feature prices + bundle discount</option>
                  </select>
                  <label className="text-[10px] text-slate-500 font-bold uppercase block">Included paid features</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {(pricing.subscriptionFeatureCatalog || []).filter((feature: any) => feature.enabled === true).map((feature: any) => (
                      <label key={feature.id} className="flex items-center gap-2 text-[11px] text-slate-300">
                        <input type="checkbox" checked={(pkg.featureIds || []).includes(feature.id)} onChange={(e) => {
                          const newList = [...pricing.subscriptionPackages];
                          const selected = new Set(newList[idx].featureIds || []);
                          if (e.target.checked) selected.add(feature.id); else selected.delete(feature.id);
                          newList[idx] = { ...newList[idx], featureIds: Array.from(selected) };
                          setPricing((prev: any) => ({ ...prev, subscriptionPackages: newList }));
                        }} />
                        <span>{feature.label} — Rs. {Number(feature.pricePkr || 0).toLocaleString()}</span>
                      </label>
                    ))}
                  </div>
                  {pkg.pricingMode === 'catalog' && <p className="text-[10px] text-emerald-300">Calculated before checkout from selected feature prices and the configured bundle discount.</p>}
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] text-slate-500 font-bold uppercase block">Features List (Comma Separated)</label>
                  <textarea
                    value={(pkg.features || []).join(', ')}
                    onChange={(e) => {
                      const newList = [...pricing.subscriptionPackages];
                      newList[idx] = { ...newList[idx], features: e.target.value.split(',').map(s => s.trim()).filter(Boolean) };
                      setPricing((prev: any) => ({ ...prev, subscriptionPackages: newList }));
                    }}
                    rows={2}
                    className="w-full px-2 py-1.5 bg-slate-900 border border-slate-800 rounded text-white text-[11px] leading-tight outline-none focus:border-emerald-500 transition-colors"
                    placeholder="e.g. Instant WhatsApp Alerts, Priority Apply..."
                  />
                </div>

                <div className="mt-4 flex items-center justify-between pt-3 border-t border-slate-800/50">
                   <div className="flex items-center space-x-2">
                     <label className="text-[10px] text-slate-500 font-bold uppercase">Badge:</label>
                     <input
                       type="text"
                       value={pkg.badge || ''}
                       onChange={(e) => {
                         const newList = [...pricing.subscriptionPackages];
                         newList[idx] = { ...newList[idx], badge: e.target.value };
                         setPricing((prev: any) => ({ ...prev, subscriptionPackages: newList }));
                       }}
                       placeholder="e.g. Popular"
                       className="bg-transparent border-b border-slate-800 text-[11px] text-amber-400 outline-none px-1"
                     />
                   </div>
                   <button
                     onClick={() => {
                       if (confirm('Are you sure you want to delete this package?')) {
                         const newList = pricing.subscriptionPackages.filter((_: any, i: number) => i !== idx);
                         setPricing((prev: any) => ({ ...prev, subscriptionPackages: newList }));
                       }
                     }}
                     className="text-[10px] font-bold text-rose-500 hover:text-rose-400 uppercase tracking-widest"
                   >
                     Remove
                   </button>
                </div>
              </div>
            ))}
            
            {(!pricing.subscriptionPackages || pricing.subscriptionPackages.length === 0) && (
              <div className="md:col-span-2 p-10 text-center border-2 border-dashed border-slate-800 rounded-2xl">
                <AlertCircle className="w-8 h-8 text-slate-700 mx-auto mb-3" />
                <p className="text-slate-500 text-sm">No subscription packages configured. Users will not be able to upgrade.</p>
              </div>
            )}
          </div>
        </div>

        {/* 4. CV Builder Access, Designs & Export Policy */}
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

      </div>
    </div>
  );
};
