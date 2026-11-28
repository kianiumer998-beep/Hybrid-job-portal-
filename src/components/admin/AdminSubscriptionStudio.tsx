import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle, Save, ShieldCheck, AlertCircle, RefreshCw, Layers, DollarSign, Edit3, Plus, Sliders } from 'lucide-react';
import { api } from '../../services/api';
import { SubscriptionPlansBuilder } from './SubscriptionPlansBuilder';

const CAMPAIGN_PLACEMENTS = [
  'top-header',
  'feed-inline',
  'sidebar',
  'popup-modal',
  'toast-float',
  'sms-broadcast',
  'promo-discount-banner',
  'dynamic-announcement-card'
];

const numberIsValid = (value: unknown, min: number, max: number) => {
  if (typeof value === 'string' && value.trim() === '') return false;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= min && parsed <= max;
};

const floatIsValid = (value: unknown, min: number, max: number) => {
  if (typeof value === 'string' && value.trim() === '') return false;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max;
};

export const AdminSubscriptionStudio: React.FC<{ onPricingSaved?: (pricing: any) => void }> = ({ onPricingSaved }) => {
  const [pricing, setPricing] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [studioSubTab, setStudioSubTab] = useState<'packages' | 'direct_rates'>('packages');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await api.pricing.get();
      if (!result?.success || !result.pricing) throw new Error(result?.message || 'Authoritative pricing could not be loaded.');
      setPricing(result.pricing);
    } catch (err: any) {
      setError(err?.message || 'Unable to load subscription settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const packages = Array.isArray(pricing?.subscriptionPackages) ? pricing.subscriptionPackages : [];
  const catalog = Array.isArray(pricing?.subscriptionFeatureCatalog) ? pricing.subscriptionFeatureCatalog : [];
  const enabledFeatures = useMemo(() => catalog.filter((item: any) => item.enabled === true), [catalog]);

  // Health audit checks for missing package categories
  const categoryHealthAudit = useMemo(() => {
    const activePkgs = packages.filter((p: any) => p.enabled !== false);
    const hasJobPosting = activePkgs.some((p: any) => {
      const ids = Array.isArray(p.featureIds) ? p.featureIds : [];
      const text = [p.name, p.badge, ...(p.featureLabels || [])].join(' ').toLowerCase();
      return ids.some((id: string) => id.includes('_job_posting')) || /\b(job posting|urgent|featured|pinned|vip post|future job)\b/i.test(text);
    });
    const hasAds = activePkgs.some((p: any) => {
      const ids = Array.isArray(p.featureIds) ? p.featureIds : [];
      const text = [p.name, p.badge, ...(p.featureLabels || [])].join(' ').toLowerCase();
      return ids.includes('campaign_credits') || /\b(campaign|banner|ad credit|promo)\b/i.test(text);
    });
    const hasAlertsEarlyAccess = activePkgs.some((p: any) => {
      const ids = Array.isArray(p.featureIds) ? p.featureIds : [];
      const text = [p.name, p.badge, ...(p.featureLabels || [])].join(' ').toLowerCase();
      return ids.some((id: string) => ['whatsapp_alerts', 'sms_alerts', 'email_alerts', 'early_access'].includes(id)) || /\b(early access|whatsapp|sms|email|alert)\b/i.test(text);
    });
    const hasCvBuilder = activePkgs.some((p: any) => {
      const ids = Array.isArray(p.featureIds) ? p.featureIds : [];
      const text = [p.name, p.badge, ...(p.featureLabels || [])].join(' ').toLowerCase();
      return ids.includes('cv_builder') || p.cvBenefitsEnabled === true || /\b(cv|resume|ats)\b/i.test(text);
    });
    const hasMega = activePkgs.some((p: any) => !p.isIndividualFeature);

    const missing: string[] = [];
    if (!hasJobPosting) missing.push('Job Posting & Application Tiers');
    if (!hasAds) missing.push('Ads, Banners & Campaign Credits');
    if (!hasAlertsEarlyAccess) missing.push('Alerts & Early Access');
    if (!hasCvBuilder) missing.push('CV Builder & Career Tools');
    if (!hasMega) missing.push('All-in-One Mega Bundles');
    return missing;
  }, [packages]);

  const updateCatalogItem = (index: number, field: string, value: any) => {
    setPricing((prev: any) => {
      const nextCatalog = [...(prev.subscriptionFeatureCatalog || [])];
      if (nextCatalog[index]) {
        nextCatalog[index] = { ...nextCatalog[index], [field]: value };
      }
      return { ...prev, subscriptionFeatureCatalog: nextCatalog };
    });
  };

  const handleSave = async () => {
    setError('');
    setSuccess('');
    for (const pkg of packages) {
      if (!String(pkg.name || '').trim()) {
        setError('Every master package requires a valid name.');
        return;
      }
      if (!numberIsValid(pkg.durationDays, 1, 3650)) {
        setError(`"${pkg.name}" duration must be a whole number between 1 and 3650 days.`);
        return;
      }
      const rawPrice = pkg.configuredPricePkr ?? pkg.pricePkr;
      if (!numberIsValid(rawPrice, 0, Number.MAX_SAFE_INTEGER)) {
        setError(`"${pkg.name}" price must be a valid whole PKR amount.`);
        return;
      }
      const selectedIds = Array.isArray(pkg.featureIds) ? pkg.featureIds : [];
      if (pkg.pricingMode === 'catalog' && pkg.enabled !== false &&
          (!selectedIds.length || selectedIds.some((id: string) => !enabledFeatures.some((f: any) => f.id === id)))) {
        setError(`"${pkg.name}" must only select enabled catalog features, or temporarily disable the package.`);
        return;
      }
      if (pkg.bundleDiscountPercent !== undefined && !floatIsValid(pkg.bundleDiscountPercent, 0, 100)) {
        setError(`"${pkg.name}" discount must be between 0 and 100 percent.`);
        return;
      }
      if (pkg.cvBenefitsEnabled) {
        for (const key of ['cvCreateLimit', 'editLimit', 'pdfExportLimit', 'atsExportLimit', 'shareLimit']) {
          if (!numberIsValid(pkg.cvBenefits?.[key] ?? 0, 0, 10000)) {
            setError(`"${pkg.name}" CV quota values must be between 0 and 10000.`);
            return;
          }
        }
      }
    }
    if (!floatIsValid(pricing.subscriptionBundleDiscountPercent ?? 0, 0, 100)) {
      setError('Default bundle discount must be between 0 and 100 percent.');
      return;
    }
    for (const feature of catalog) {
      if (!numberIsValid(feature.pricePkr ?? 0, 0, Number.MAX_SAFE_INTEGER) ||
          !numberIsValid(feature.durationDays ?? 30, 1, 3650) ||
          !numberIsValid(feature.includedSlots ?? 0, 0, 1000) ||
          !numberIsValid(feature.slotDurationDays ?? 30, 1, 3650)) {
        setError(`"${feature.label || feature.id}" has an invalid price, duration, or slot count.`);
        return;
      }
      if (feature.enabled === true && ['email_alerts', 'whatsapp_alerts', 'sms_alerts'].includes(feature.id) &&
          feature.unlimitedMessages !== true && !numberIsValid(feature.monthlyMessageQuota, 1, 1000000)) {
        setError(`"${feature.label || feature.id}" requires Unlimited or a monthly quota between 1 and 1,000,000.`);
        return;
      }
      if (feature.id === 'campaign_credits' && feature.enabled === true) {
        const credits = Array.isArray(feature.campaignCredits) ? feature.campaignCredits : [];
        if (!credits.length || credits.some((credit: any) =>
          !CAMPAIGN_PLACEMENTS.includes(String(credit.placement)) ||
          !numberIsValid(credit.durationHours, 1, 8760) ||
          !numberIsValid(credit.quantity, 1, 1000) ||
          (credit.placement === 'sms-broadcast' && !numberIsValid(credit.smsRecipientsCount, 1, 100000))) ||
          new Set(credits.map((credit: any) => String(credit.placement) + ':' + String(credit.durationHours) + ':' + String(credit.smsRecipientsCount || 0))).size !== credits.length) {
          setError('Configure unique placement + duration combinations and valid quantities for Campaign Credits.');
          return;
        }
      }
    }

    setSaving(true);
    try {
      const result = await api.pricing.update({
        subscriptionPackages: packages,
        subscriptionFeatureCatalog: catalog,
        subscriptionBundleDiscountPercent: Number(pricing.subscriptionBundleDiscountPercent ?? 0)
      });
      if (!result?.success) throw new Error(result?.message || 'Could not save subscription settings.');
      const authoritative = result.pricing || { ...pricing, subscriptionPackages: packages, subscriptionFeatureCatalog: catalog };
      setPricing((current: any) => ({ ...current, ...authoritative }));
      onPricingSaved?.(authoritative);
      setSuccess('Master subscription settings and feature rates saved successfully.');
    } catch (err: any) {
      setError(err?.message || 'Error saving subscription settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-sm text-slate-300">Loading authoritative subscription settings...</div>;
  if (!pricing) return <div className="p-6 rounded-xl border border-rose-500/30 text-rose-200">{error || 'Subscription settings unavailable.'}<button onClick={load} className="ml-3 underline">Retry</button></div>;

  return (
    <div className="space-y-6 text-white">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-500/20 bg-slate-900 p-5">
        <div>
          <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-emerald-400" /><h2 className="text-lg font-bold">Master Subscription &amp; Rates Studio</h2></div>
          <p className="mt-1 text-xs text-slate-400">Job &amp; Ad Control Center → Manage standalone feature rates (Premium Job Application, Early Access, Alerts) and Master Bundles.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} disabled={saving} className="rounded-lg border border-slate-700 px-3 py-2 text-xs cursor-pointer"><RefreshCw className="mr-1 inline h-3 w-3" />Reload</button>
          <button onClick={handleSave} disabled={saving} className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold disabled:opacity-50 cursor-pointer"><Save className="mr-1 inline h-3 w-3" />{saving ? 'Saving...' : 'Save All Changes'}</button>
        </div>
      </div>

      {/* Studio Sub-Tabs: Master Packages vs Direct Feature Rates */}
      <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-3">
        <button
          type="button"
          onClick={() => setStudioSubTab('packages')}
          className={`px-4 py-2 rounded-xl text-xs font-black tracking-wide cursor-pointer transition-all ${
            studioSubTab === 'packages'
              ? 'bg-emerald-500 text-slate-950 border border-emerald-400 shadow-lg'
              : 'bg-slate-950 text-slate-300 border border-slate-800 hover:bg-slate-900'
          }`}
        >
          Master Packages &amp; Bundles ({packages.length})
        </button>
        <button
          type="button"
          onClick={() => setStudioSubTab('direct_rates')}
          className={`px-4 py-2 rounded-xl text-xs font-black tracking-wide cursor-pointer transition-all ${
            studioSubTab === 'direct_rates'
              ? 'bg-amber-500 text-slate-950 border border-amber-400 shadow-lg'
              : 'bg-slate-950 text-slate-300 border border-slate-800 hover:bg-slate-900'
          }`}
        >
          Direct Feature Rates &amp; Prices ({catalog.length})
        </button>
      </div>

      {/* Health Audit / Missing Category Warning Banner */}
      {categoryHealthAudit.length > 0 && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-xs text-amber-200 space-y-2">
          <div className="flex items-center gap-2 font-bold text-amber-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>Health Audit Warning: Missing Active Plan Categories ({categoryHealthAudit.length})</span>
          </div>
          <p className="text-slate-300">
            The following commercial categories currently have no active enabled packages or plans configured:
          </p>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {categoryHealthAudit.map((cat, idx) => (
              <span key={idx} className="rounded-lg border border-amber-500/30 bg-amber-500/20 px-2.5 py-1 font-bold text-amber-100">
                ⚠️ {cat}
              </span>
            ))}
          </div>
          <p className="text-[11px] text-amber-300/80">
            Please add or enable a plan for these categories in Master Packages or configure standalone rates in Direct Feature Rates.
          </p>
        </div>
      )}

      {error && <div role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200"><AlertCircle className="mr-2 inline h-4 w-4" />{error}</div>}
      {success && <div role="status" className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-200"><CheckCircle className="mr-2 inline h-4 w-4" />{success}</div>}

      {studioSubTab === 'direct_rates' ? (
        <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-950 p-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-black text-amber-300">Direct Feature Rates &amp; Individual Pricing Matrix</h3>
              <p className="text-[11px] text-slate-400">
                Set standalone prices (PKR), validity durations, and quota limits for Premium Job Applications, Early Access, Alerts, and CV Builder.
              </p>
            </div>
            <span className="rounded-lg bg-amber-500/15 border border-amber-500/30 px-3 py-1 text-[11px] font-bold text-amber-200">
              {catalog.length} Features Configured
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {catalog.map((feature: any, idx: number) => (
              <div key={feature.id || idx} className="rounded-xl border border-slate-800 bg-slate-900 p-4 grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                <div className="md:col-span-4 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-white">{feature.label || feature.id}</span>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${feature.enabled !== false ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-slate-800 text-slate-400'}`}>
                      {feature.enabled !== false ? 'Active' : 'Disabled'}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">{feature.id}</div>
                </div>

                <div className="md:col-span-3 space-y-1">
                  <label className="text-[10px] text-slate-400 font-semibold block">Price (PKR)</label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-2 text-xs text-slate-500">Rs.</span>
                    <input
                      type="number"
                      min={0}
                      value={feature.pricePkr ?? 0}
                      onChange={(e) => updateCatalogItem(idx, 'pricePkr', Number(e.target.value) || 0)}
                      className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white font-bold"
                    />
                  </div>
                </div>

                <div className="md:col-span-3 space-y-1">
                  <label className="text-[10px] text-slate-400 font-semibold block">Duration (Days)</label>
                  <input
                    type="number"
                    min={1}
                    value={feature.durationDays ?? 30}
                    onChange={(e) => updateCatalogItem(idx, 'durationDays', Number(e.target.value) || 30)}
                    className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white font-bold"
                  />
                </div>

                <div className="md:col-span-2 flex items-center justify-end gap-2 pt-4 md:pt-0">
                  <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={feature.enabled !== false}
                      onChange={(e) => updateCatalogItem(idx, 'enabled', e.target.checked)}
                      className="rounded border-slate-700 text-emerald-500"
                    />
                    <span>Enabled</span>
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <SubscriptionPlansBuilder pricing={pricing} setPricing={setPricing} showReminderSettings={false} />
      )}
    </div>
  );
};
