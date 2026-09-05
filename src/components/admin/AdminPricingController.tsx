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

export const AdminPricingController: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
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

  useEffect(() => {
    loadPricing();
  }, []);

  const loadPricing = async () => {
    setLoading(true);
    try {
      const data = await api.pricing.get();
      if (data.success && data.pricing) {
        setPricing(data.pricing);
      }
    } catch (err) {
      console.error('Failed to load pricing:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await api.pricing.update(pricing);
      if (res.success) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err) {
      console.error('Failed to save pricing:', err);
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
            disabled={saving}
            className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-sm shadow-lg shadow-amber-500/20 active:scale-95 transition-all"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>Save All Changes</span>
          </button>
        </div>
      </div>

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
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center space-x-2.5 border-b border-slate-800 pb-4">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-white text-base">Candidate Subscription Plans</h3>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between p-3 bg-slate-950/60 rounded-xl border border-slate-800">
              <div>
                <span className="font-semibold text-white block">Pro Candidate Monthly</span>
                <span className="text-xs text-slate-400">Unlimited applications & instant alerts</span>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  value={pricing.subscriptions?.proMonthlyPkr || 0}
                  onChange={(e) => updateNested('subscriptions', 'proMonthlyPkr', Number(e.target.value))}
                  className="w-28 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm"
                />
                <span className="text-xs text-slate-400">PKR</span>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-950/60 rounded-xl border border-slate-800">
              <div>
                <span className="font-semibold text-amber-300 block">VIP Candidate Monthly</span>
                <span className="text-xs text-slate-400">Top candidate badge + employer direct messaging</span>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  value={pricing.subscriptions?.vipMonthlyPkr || 0}
                  onChange={(e) => updateNested('subscriptions', 'vipMonthlyPkr', Number(e.target.value))}
                  className="w-28 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm"
                />
                <span className="text-xs text-slate-400">PKR</span>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-950/60 rounded-xl border border-slate-800">
              <div>
                <span className="font-semibold text-sky-300 block">Govt WhatsApp Alerts Weekly</span>
                <span className="text-xs text-slate-400">Official FPSC/PPSC gazette notifications</span>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  value={pricing.subscriptions?.govtAlertsWeeklyPkr || 0}
                  onChange={(e) => updateNested('subscriptions', 'govtAlertsWeeklyPkr', Number(e.target.value))}
                  className="w-28 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm"
                />
                <span className="text-xs text-slate-400">PKR</span>
              </div>
            </div>
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
