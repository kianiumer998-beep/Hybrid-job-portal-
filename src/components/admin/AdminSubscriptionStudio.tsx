import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle, Save, ShieldCheck, AlertCircle, RefreshCw } from 'lucide-react';
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
      setSuccess('Master subscription settings saved successfully.');
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
          <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-emerald-400" /><h2 className="text-lg font-bold">Master Subscription Studio</h2></div>
          <p className="mt-1 text-xs text-slate-400">Combine Early Access, Alerts, CV Builder, Job Posting Tiers and Ad Hub Campaign Credits into automated packages.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} disabled={saving} className="rounded-lg border border-slate-700 px-3 py-2 text-xs cursor-pointer"><RefreshCw className="mr-1 inline h-3 w-3" />Reload</button>
          <button onClick={handleSave} disabled={saving} className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold disabled:opacity-50 cursor-pointer"><Save className="mr-1 inline h-3 w-3" />{saving ? 'Saving...' : 'Save Master Plans'}</button>
        </div>
      </div>

      {error && <div role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200"><AlertCircle className="mr-2 inline h-4 w-4" />{error}</div>}
      {success && <div role="status" className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-200"><CheckCircle className="mr-2 inline h-4 w-4" />{success}</div>}

      <SubscriptionPlansBuilder pricing={pricing} setPricing={setPricing} showReminderSettings={false} />
    </div>
  );
};

