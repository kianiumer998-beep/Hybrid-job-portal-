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
      urgentFeePkr: 500,
      featuredTopFeePkr: 1500,
      futureJobFeePkr: 800,
      vipBundleFeePkr: 2500,
      freePostingAllowed: true,
      enableStandard: true,
      enableUrgent: true,
      enableFeaturedTop: true,
      enableFutureJob: true,
      enableVipBundle: true,
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
    subscriptions: {
      freeTierPrice: 0,
      proMonthlyPkr: 1200,
      vipMonthlyPkr: 3000,
      govtAlertsWeeklyPkr: 400
    },
    cvBuilder: {
      standardPdfExportPkr: 0,
      premiumAiOptimizerPkr: 500,
      unlimitedTemplatesPkr: 1000
    }
  });

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
        setPricing(data.pricing);
      } else {
        setLoadError(data?.message || 'Failed to load authoritative pricing configuration.');
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
              <p className="text-xs text-slate-400">Configure public job fees, banner advertisement rates, subscription tiers, and duration limits dynamically.</p>
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

        {/* 2. Advertisements by Placement & Day */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center space-x-2.5">
              <Tag className="w-5 h-5 text-indigo-400" />
              <h3 className="font-bold text-white text-base">Advertisement Placement Rates</h3>
            </div>
            <div className="flex items-center space-x-2">
              <Percent className="w-4 h-4 text-slate-400" />
              <span className="text-xs text-slate-400">Default Discount:</span>
              <input
                type="number"
                value={pricing.advertisements?.defaultDiscountPercent || 0}
                onChange={(e) => updateNested('advertisements', 'defaultDiscountPercent', Number(e.target.value))}
                className="w-16 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-center text-xs text-amber-400 font-bold"
              />
              <span className="text-xs text-slate-400">%</span>
            </div>
          </div>

          <div className="space-y-3.5 text-sm">
            <div className="flex items-center justify-between p-3 bg-slate-950/60 rounded-xl border border-slate-800">
              <div>
                <span className="font-semibold text-white block">Top Header Banner</span>
                <span className="text-xs text-slate-400">Positioned above navigation and hero</span>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  value={pricing.advertisements?.topBannerPerDayPkr || 0}
                  onChange={(e) => updateNested('advertisements', 'topBannerPerDayPkr', Number(e.target.value))}
                  className="w-28 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm font-semibold"
                />
                <span className="text-xs text-slate-400">PKR / Day</span>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-950/60 rounded-xl border border-slate-800">
              <div>
                <span className="font-semibold text-white block">Standard In-Feed Ad Card</span>
                <span className="text-xs text-slate-400">Blended naturally between job search cards</span>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  value={pricing.advertisements?.feedAdPerDayPkr || 0}
                  onChange={(e) => updateNested('advertisements', 'feedAdPerDayPkr', Number(e.target.value))}
                  className="w-28 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm font-semibold"
                />
                <span className="text-xs text-slate-400">PKR / Day</span>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-950/60 rounded-xl border border-slate-800">
              <div>
                <span className="font-semibold text-white block">Interactive Popup Modal Ad</span>
                <span className="text-xs text-slate-400">Centered attention modal on initial visit</span>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  value={pricing.advertisements?.popupPerDayPkr || 0}
                  onChange={(e) => updateNested('advertisements', 'popupPerDayPkr', Number(e.target.value))}
                  className="w-28 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm font-semibold"
                />
                <span className="text-xs text-slate-400">PKR / Day</span>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-950/60 rounded-xl border border-slate-800">
              <div>
                <span className="font-semibold text-white block">Featured Company Profile</span>
                <span className="text-xs text-slate-400">Brand page with verified badge & direct apply</span>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  value={pricing.advertisements?.featuredEmployerPerMonthPkr || 0}
                  onChange={(e) => updateNested('advertisements', 'featuredEmployerPerMonthPkr', Number(e.target.value))}
                  className="w-28 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm font-semibold"
                />
                <span className="text-xs text-slate-400">PKR / Month</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Min Campaign Days</label>
                <input
                  type="number"
                  value={pricing.advertisements?.minCampaignDurationDays || 3}
                  onChange={(e) => updateNested('advertisements', 'minCampaignDurationDays', Number(e.target.value))}
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Max Campaign Days</label>
                <input
                  type="number"
                  value={pricing.advertisements?.maxCampaignDurationDays || 90}
                  onChange={(e) => updateNested('advertisements', 'maxCampaignDurationDays', Number(e.target.value))}
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm"
                />
              </div>
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

        {/* 4. CV Builder Tools */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center space-x-2.5 border-b border-slate-800 pb-4">
            <Sliders className="w-5 h-5 text-purple-400" />
            <h3 className="font-bold text-white text-base">Professional CV Builder Upgrades</h3>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between p-3 bg-slate-950/60 rounded-xl border border-slate-800">
              <div>
                <span className="font-semibold text-white block">Standard PDF CV Export</span>
                <span className="text-xs text-slate-400">Default clean ATS export</span>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  value={pricing.cvBuilder?.standardPdfExportPkr || 0}
                  onChange={(e) => updateNested('cvBuilder', 'standardPdfExportPkr', Number(e.target.value))}
                  className="w-28 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm"
                />
                <span className="text-xs text-slate-400">PKR</span>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-950/60 rounded-xl border border-slate-800">
              <div>
                <span className="font-semibold text-purple-300 block">AI Job Matching & Optimizer</span>
                <span className="text-xs text-slate-400">Tailors resume keywords directly to vacancies</span>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  value={pricing.cvBuilder?.premiumAiOptimizerPkr || 0}
                  onChange={(e) => updateNested('cvBuilder', 'premiumAiOptimizerPkr', Number(e.target.value))}
                  className="w-28 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm"
                />
                <span className="text-xs text-slate-400">PKR</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
