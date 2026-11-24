import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle, Plus, Save, ShieldCheck, AlertCircle, RefreshCw, Trash2 } from 'lucide-react';
import { api } from '../../services/api';

const CV_BENEFIT_DEFAULTS = {
  cvCreateLimit: 0,
  editLimit: 0,
  pdfExportLimit: 0,
  atsExportLimit: 0,
  shareLimit: 0,
  noWatermark: false,
  premiumDesignIds: [] as string[]
};

const emptyPackage = () => ({
  id: `pkg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  name: 'New Master Plan',
  pricePkr: 0,
  configuredPricePkr: 0,
  durationDays: 30,
  features: [] as string[],
  featureIds: [] as string[],
  pricingMode: 'fixed',
  enabled: true,
  bundleDiscountPercent: 0,
  cvBenefitsEnabled: false,
  cvBenefitsDescription: '',
  cvBenefits: { ...CV_BENEFIT_DEFAULTS }
});

const CAMPAIGN_PLACEMENTS = [
  { id: 'top-header', label: 'Top Header' }, { id: 'feed-inline', label: 'Feed Inline' },
  { id: 'sidebar', label: 'Sidebar' }, { id: 'popup-modal', label: 'Popup Modal' },
  { id: 'toast-float', label: 'Toast / Floating' }, { id: 'sms-broadcast', label: 'SMS Broadcast' },
  { id: 'promo-discount-banner', label: 'Promo Discount Banner' }, { id: 'dynamic-announcement-card', label: 'Announcement Card' }
];

const numberIsValid = (value: unknown, min: number, max: number) => {
  if (typeof value === 'string' && value.trim() === '') return false;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= min && parsed <= max;
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

  const updatePackage = (index: number, patch: any) => {
    setPricing((current: any) => ({
      ...current,
      subscriptionPackages: (current.subscriptionPackages || []).map((item: any, i: number) => i === index ? { ...item, ...patch } : item)
    }));
  };

  const updateFeature = (index: number, patch: any) => {
    setPricing((current: any) => ({
      ...current,
      subscriptionFeatureCatalog: (current.subscriptionFeatureCatalog || []).map((item: any, i: number) => i === index ? { ...item, ...patch } : item)
    }));
  };

  const handleSave = async () => {
    setError('');
    setSuccess('');
    for (const pkg of packages) {
      if (!String(pkg.name || '').trim()) {
        setError('Har master package ka naam zaroori hai.');
        return;
      }
      if (!numberIsValid(pkg.durationDays, 1, 3650)) {
        setError(`"${pkg.name}" ki duration 1 se 3650 days ke darmiyan whole number honi chahiye.`);
        return;
      }
      const rawPrice = pkg.configuredPricePkr ?? pkg.pricePkr;
      if (!numberIsValid(rawPrice, 0, Number.MAX_SAFE_INTEGER)) {
        setError(`"${pkg.name}" ki price valid whole PKR amount honi chahiye.`);
        return;
      }
      const selectedIds = Array.isArray(pkg.featureIds) ? pkg.featureIds : [];
      if (pkg.pricingMode === 'catalog' && pkg.enabled !== false &&
          (!selectedIds.length || selectedIds.some((id: string) => !enabledFeatures.some((f: any) => f.id === id)))) {
        setError(`"${pkg.name}" mein sirf enabled catalog features select karein, ya plan ko temporarily disable karein.`);
        return;
      }
      if (pkg.bundleDiscountPercent !== undefined && !numberIsValid(pkg.bundleDiscountPercent, 0, 100)) {
        setError(`"${pkg.name}" ka discount 0 se 100 percent ke darmiyan hona chahiye.`);
        return;
      }
      if (pkg.cvBenefitsEnabled) {
        for (const key of ['cvCreateLimit', 'editLimit', 'pdfExportLimit', 'atsExportLimit', 'shareLimit']) {
          if (!numberIsValid(pkg.cvBenefits?.[key] ?? 0, 0, 10000)) {
            setError(`"${pkg.name}" mein CV quota values 0 se 10000 ke darmiyan honi chahiye.`);
            return;
          }
        }
      }
    }
    if (!numberIsValid(pricing.subscriptionBundleDiscountPercent ?? 0, 0, 100)) {
      setError('Default bundle discount 0 se 100 percent ke darmiyan hona chahiye.');
      return;
    }
    for (const feature of catalog) {
      if (!numberIsValid(feature.pricePkr ?? 0, 0, Number.MAX_SAFE_INTEGER) ||
          !numberIsValid(feature.durationDays ?? 30, 1, 3650) ||
          !numberIsValid(feature.includedSlots ?? 0, 0, 1000) ||
          !numberIsValid(feature.slotDurationDays ?? 30, 1, 3650)) {
        setError(`"${feature.label || feature.id}" ke price, duration ya slots mein invalid value hai.`);
        return;
      }
      if (['email_alerts', 'whatsapp_alerts', 'sms_alerts'].includes(feature.id) &&
          feature.unlimitedMessages !== true && !numberIsValid(feature.monthlyMessageQuota, 1, 1000000)) {
        setError(`"${feature.label || feature.id}" ke liye Unlimited enable karein ya monthly quota 1 se 1,000,000 set karein.`);
        return;
      }
      if (feature.id === 'campaign_credits' && feature.enabled === true) {
        const credits = Array.isArray(feature.campaignCredits) ? feature.campaignCredits : [];
        if (!credits.length || credits.some((credit: any) =>
          !CAMPAIGN_PLACEMENTS.some(option => option.id === credit.placement) ||
          !numberIsValid(credit.durationHours, 1, 8760) ||
          !numberIsValid(credit.quantity, 1, 1000)) ||
          new Set(credits.map((credit: any) => String(credit.placement) + ':' + String(credit.durationHours))).size !== credits.length) {
          setError('Campaign Credits ke liye unique placement + duration combinations aur valid quantity configure karein.');
          return;
        }
      }
    }

    setSaving(true);
    try {
      // Partial update is intentional: preserve job, ad, CV and other unrelated pricing settings.
      const result = await api.pricing.update({
        subscriptionPackages: packages,
        subscriptionFeatureCatalog: catalog,
        subscriptionBundleDiscountPercent: Number(pricing.subscriptionBundleDiscountPercent ?? 0)
      });
      if (!result?.success) throw new Error(result?.message || 'Subscription settings save nahi huin.');
      const authoritative = result.pricing || { ...pricing, subscriptionPackages: packages, subscriptionFeatureCatalog: catalog };
      setPricing((current: any) => ({ ...current, ...authoritative }));
      onPricingSaved?.(authoritative);
      setSuccess('Master subscription settings successfully save ho gayi hain.');
    } catch (err: any) {
      setError(err?.message || 'Subscription settings save karte waqt error aaya.');
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
          <p className="mt-1 text-xs text-slate-400">Existing backend-supported features, job slots and CV benefits ko combine karke master plans banayein. Purchased plans ke existing entitlement snapshots change nahi honge.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} disabled={saving} className="rounded-lg border border-slate-700 px-3 py-2 text-xs"><RefreshCw className="mr-1 inline h-3 w-3" />Reload</button>
          <button onClick={handleSave} disabled={saving} className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold disabled:opacity-50"><Save className="mr-1 inline h-3 w-3" />{saving ? 'Saving...' : 'Save Master Plans'}</button>
        </div>
      </div>

      {error && <div role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200"><AlertCircle className="mr-2 inline h-4 w-4" />{error}</div>}
      {success && <div role="status" className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-200"><CheckCircle className="mr-2 inline h-4 w-4" />{success}</div>}

      <section className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <div><h3 className="font-bold">Paid Service Feature Catalog</h3><p className="mt-1 text-xs text-slate-400">Yahan service ki base price, duration aur job posting slots define hotay hain. Sirf existing backend feature IDs use hoti hain.</p></div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {catalog.map((feature: any, index: number) => (
            <div key={feature.id} className="space-y-2 rounded-xl border border-slate-800 bg-slate-950 p-3">
              <label className="flex items-center justify-between gap-2 text-xs font-semibold"><span>{feature.label}</span><input type="checkbox" checked={feature.enabled === true} onChange={e => updateFeature(index, { enabled: e.target.checked })} /></label>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-[10px] text-slate-400">Price PKR<input type="number" min="0" value={feature.pricePkr ?? ''} onChange={e => updateFeature(index, { pricePkr: e.target.value === '' ? '' : Number(e.target.value) })} className="mt-1 w-full rounded bg-slate-900 p-2 text-xs text-white" /></label>
                <label className="text-[10px] text-slate-400">Duration days<input type="number" min="1" max="3650" value={feature.durationDays ?? ''} onChange={e => updateFeature(index, { durationDays: e.target.value === '' ? '' : Number(e.target.value) })} className="mt-1 w-full rounded bg-slate-900 p-2 text-xs text-white" /></label>
                <label className="text-[10px] text-slate-400">Included slots<input type="number" min="0" max="1000" value={feature.includedSlots ?? ''} onChange={e => updateFeature(index, { includedSlots: e.target.value === '' ? '' : Number(e.target.value) })} className="mt-1 w-full rounded bg-slate-900 p-2 text-xs text-white" /></label>
                <label className="text-[10px] text-slate-400">Slot duration<input type="number" min="1" max="3650" value={feature.slotDurationDays ?? ''} onChange={e => updateFeature(index, { slotDurationDays: e.target.value === '' ? '' : Number(e.target.value) })} className="mt-1 w-full rounded bg-slate-900 p-2 text-xs text-white" /></label>
              </div>
              {['email_alerts', 'whatsapp_alerts', 'sms_alerts'].includes(feature.id) && <div className="space-y-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2">
                <label className="flex items-center gap-2 text-[11px] text-emerald-200"><input type="checkbox" checked={feature.unlimitedMessages === true || (feature.unlimitedMessages === undefined && feature.monthlyMessageQuota === undefined)} onChange={e => updateFeature(index, { unlimitedMessages: e.target.checked, ...(e.target.checked ? {} : { monthlyMessageQuota: feature.monthlyMessageQuota || 0 }) })} />Unlimited messages</label>
                {feature.unlimitedMessages !== true && !(feature.unlimitedMessages === undefined && feature.monthlyMessageQuota === undefined) && <label className="block text-[10px] text-slate-300">Monthly message quota<input type="number" min="1" max="1000000" value={feature.monthlyMessageQuota ?? ''} onChange={e => updateFeature(index, { monthlyMessageQuota: e.target.value === '' ? '' : Number(e.target.value) })} className="mt-1 w-full rounded bg-slate-900 p-2 text-xs text-white" /></label>}
                <p className="text-[9px] text-slate-500">Quota is reserved before provider delivery and released if the provider fails. Existing older subscriptions retain their legacy access.</p>
              </div>}
              {feature.id === 'campaign_credits' && <div className="space-y-2 rounded-lg border border-indigo-500/20 bg-indigo-500/5 p-2">
                <div className="flex items-center justify-between"><p className="text-[10px] font-semibold text-indigo-200">Placement credits</p><button type="button" onClick={() => updateFeature(index, { campaignCredits: [...(feature.campaignCredits || []), { placement: 'sidebar', durationHours: 168, quantity: 1 }] })} className="rounded border border-indigo-400/40 px-2 py-1 text-[9px]">Add credit</button></div>
                {(feature.campaignCredits || []).map((credit: any, creditIndex: number) => <div key={creditIndex} className="grid grid-cols-1 gap-2 rounded border border-slate-800 p-2 sm:grid-cols-[1fr_90px_75px_auto]">
                  <select value={credit.placement} onChange={e => updateFeature(index, { campaignCredits: feature.campaignCredits.map((item: any, i: number) => i === creditIndex ? { ...item, placement: e.target.value } : item) })} className="rounded bg-slate-900 p-2 text-[10px]">{CAMPAIGN_PLACEMENTS.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select>
                  <label className="text-[9px] text-slate-400">Duration hours<input type="number" min="1" max="8760" value={credit.durationHours ?? ''} onChange={e => updateFeature(index, { campaignCredits: feature.campaignCredits.map((item: any, i: number) => i === creditIndex ? { ...item, durationHours: e.target.value === '' ? '' : Number(e.target.value) } : item) })} className="mt-1 w-full rounded bg-slate-900 p-2 text-[10px] text-white" /></label>
                  <label className="text-[9px] text-slate-400">Quantity<input type="number" min="1" max="1000" value={credit.quantity ?? ''} onChange={e => updateFeature(index, { campaignCredits: feature.campaignCredits.map((item: any, i: number) => i === creditIndex ? { ...item, quantity: e.target.value === '' ? '' : Number(e.target.value) } : item) })} className="mt-1 w-full rounded bg-slate-900 p-2 text-[10px] text-white" /></label>
                  <button type="button" onClick={() => updateFeature(index, { campaignCredits: feature.campaignCredits.filter((_: any, i: number) => i !== creditIndex) })} className="self-end rounded px-2 py-2 text-[10px] text-rose-300">Remove</button>
                </div>)}
                <p className="text-[9px] text-slate-500">Exact placement and duration are matched at redemption. Custom duration must match a configured credit.</p>
              </div>}

            </div>
          ))}
        </div>
        <label className="block max-w-xs text-xs text-slate-300">Default bundle discount (%)<input type="number" min="0" max="100" value={pricing.subscriptionBundleDiscountPercent ?? ''} onChange={e => setPricing((p: any) => ({ ...p, subscriptionBundleDiscountPercent: e.target.value === '' ? '' : Number(e.target.value) }))} className="mt-1 w-full rounded bg-slate-950 p-2 text-white" /></label>
      </section>

      <section className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-bold">Master Plans</h3><p className="mt-1 text-xs text-slate-400">Multiple services ko ek subscription mein combine karein. Fixed ya catalog-based pricing choose karein.</p></div><button onClick={() => setPricing((p: any) => ({ ...p, subscriptionPackages: [...(p.subscriptionPackages || []), emptyPackage()] }))} className="rounded-lg border border-emerald-500/40 px-3 py-2 text-xs font-bold text-emerald-300"><Plus className="mr-1 inline h-3 w-3" />Add Master Plan</button></div>
        {packages.map((pkg: any, index: number) => (
          <article key={pkg.id || index} className="space-y-3 rounded-xl border border-slate-800 bg-slate-950 p-4">
            <div className="grid gap-3 md:grid-cols-4">
              <label className="text-[10px] text-slate-400 md:col-span-2">Plan name<input value={pkg.name || ''} onChange={e => updatePackage(index, { name: e.target.value })} className="mt-1 w-full rounded bg-slate-900 p-2 text-xs text-white" /></label>
              <label className="text-[10px] text-slate-400">Price PKR<input type="number" min="0" value={pkg.configuredPricePkr ?? pkg.pricePkr ?? ''} onChange={e => updatePackage(index, { configuredPricePkr: e.target.value === '' ? '' : Number(e.target.value), pricePkr: e.target.value === '' ? '' : Number(e.target.value) })} className="mt-1 w-full rounded bg-slate-900 p-2 text-xs text-white" /></label>
              <label className="text-[10px] text-slate-400">Duration days<input type="number" min="1" max="3650" value={pkg.durationDays ?? ''} onChange={e => updatePackage(index, { durationDays: e.target.value === '' ? '' : Number(e.target.value) })} className="mt-1 w-full rounded bg-slate-900 p-2 text-xs text-white" /></label>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs">
              <label className="flex items-center gap-2"><input type="checkbox" checked={pkg.enabled !== false} onChange={e => updatePackage(index, { enabled: e.target.checked })} />Enabled / show on subscription pages</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={pkg.cvBenefitsEnabled === true} onChange={e => updatePackage(index, { cvBenefitsEnabled: e.target.checked, cvBenefits: { ...CV_BENEFIT_DEFAULTS, ...(pkg.cvBenefits || {}) } })} />Include CV benefits</label>
              {pkg.cvBenefitsEnabled === true && <label className="text-[10px] text-slate-300">Load existing CV package
                <select value={pkg.cvPackageId || ''} onChange={e => {
                  const selectedCvPackage = (pricing.cvBuilder?.packages || []).find((item: any) => item.id === e.target.value && item.enabled !== false);
                  if (!selectedCvPackage) { updatePackage(index, { cvPackageId: '' }); return; }
                  const otherFeaturesSelected = (pkg.featureIds || []).some((id: string) => id !== 'cv_builder');
                  updatePackage(index, {
                    cvPackageId: selectedCvPackage.id,
                    cvBenefitsEnabled: true,
                    cvBenefitsDescription: String(selectedCvPackage.name || 'Existing CV package') + ' benefits included',
                    cvBenefits: {
                      cvCreateLimit: Number(selectedCvPackage.cvCreateLimit ?? 0),
                      editLimit: Number(selectedCvPackage.editLimit ?? 0),
                      pdfExportLimit: Number(selectedCvPackage.pdfExportLimit ?? 0),
                      atsExportLimit: Number(selectedCvPackage.atsExportLimit ?? 0),
                      shareLimit: Number(selectedCvPackage.shareLimit ?? 0),
                      noWatermark: selectedCvPackage.noWatermark === true,
                      premiumDesignIds: Array.isArray(selectedCvPackage.premiumDesignIds) ? selectedCvPackage.premiumDesignIds : []
                    },
                    ...(!otherFeaturesSelected ? {
                      durationDays: Number(selectedCvPackage.durationDays || 30),
                      configuredPricePkr: Number(selectedCvPackage.pricePkr || 0),
                      pricePkr: Number(selectedCvPackage.pricePkr || 0)
                    } : {})
                  });
                }} className="ml-2 mt-1 rounded bg-slate-900 p-2 text-xs text-white">
                  <option value="">Custom CV benefits</option>
                  {(pricing.cvBuilder?.packages || []).filter((item: any) => item.enabled !== false).map((item: any) => <option key={item.id} value={item.id}>{item.name} · Rs. {Number(item.pricePkr || 0).toLocaleString()} · {item.durationDays} days</option>)}
                </select>
              </label>}
              <select value={pkg.pricingMode === 'catalog' ? 'catalog' : 'fixed'} onChange={e => updatePackage(index, { pricingMode: e.target.value })} className="rounded bg-slate-900 p-2"><option value="fixed">Fixed price</option><option value="catalog">Catalog price + discount</option></select>
              {pkg.pricingMode === 'catalog' && <label className="text-slate-300">Plan discount %<input type="number" min="0" max="100" value={pkg.bundleDiscountPercent ?? pricing.subscriptionBundleDiscountPercent ?? 0} onChange={e => updatePackage(index, { bundleDiscountPercent: e.target.value === '' ? '' : Number(e.target.value) })} className="ml-2 w-20 rounded bg-slate-900 p-1" /></label>}
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {catalog.map((feature: any) => { const selectedNow = (pkg.featureIds || []).includes(feature.id); return <label key={feature.id} className="flex items-center gap-2 rounded border border-slate-800 p-2 text-[11px] text-slate-300"><input type="checkbox" checked={selectedNow} disabled={feature.enabled !== true && !selectedNow} onChange={e => { const selected = new Set(pkg.featureIds || []); if (e.target.checked) selected.add(feature.id); else selected.delete(feature.id); updatePackage(index, { featureIds: Array.from(selected) }); }} /><span>{feature.label} · Rs. {Number(feature.pricePkr || 0).toLocaleString()}{feature.enabled !== true ? ' (disabled)' : ''}</span></label>; })}
            </div>
            {pkg.cvBenefitsEnabled === true && <div className="space-y-2 rounded-lg border border-indigo-500/20 bg-indigo-500/5 p-3"><label className="block text-[10px] text-slate-300">CV benefits description<textarea rows={2} maxLength={240} value={pkg.cvBenefitsDescription || ''} onChange={e => updatePackage(index, { cvBenefitsDescription: e.target.value.slice(0, 240) })} className="mt-1 w-full rounded bg-slate-900 p-2 text-xs" /></label><div className="grid grid-cols-2 gap-2 sm:grid-cols-5">{([{field:'cvCreateLimit',label:'CV creations'},{field:'editLimit',label:'CV edits'},{field:'pdfExportLimit',label:'PDF exports'},{field:'atsExportLimit',label:'ATS exports'},{field:'shareLimit',label:'CV shares'}] as const).map(item => <label key={item.field} className="text-[10px] text-slate-400">{item.label}<input type="number" min="0" max="10000" value={pkg.cvBenefits?.[item.field] ?? ''} onChange={e => updatePackage(index, { cvBenefits: { ...(pkg.cvBenefits || CV_BENEFIT_DEFAULTS), [item.field]: e.target.value === '' ? '' : Number(e.target.value) } })} className="mt-1 w-full rounded bg-slate-900 p-2 text-xs text-white" /></label>)}</div><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={pkg.cvBenefits?.noWatermark === true} onChange={e => updatePackage(index, { cvBenefits: { ...(pkg.cvBenefits || CV_BENEFIT_DEFAULTS), noWatermark: e.target.checked } })} />Watermark-free CV exports</label><div className="space-y-1"><p className="text-[10px] text-slate-400">Premium CV designs included</p>{(pricing.cvBuilder?.templates || []).filter((template: any) => template.free !== true).map((template: any) => <label key={template.id} className="mr-3 inline-flex items-center gap-1 text-[10px] text-slate-300"><input type="checkbox" checked={(pkg.cvBenefits?.premiumDesignIds || []).includes(template.id)} onChange={e => { const selected = new Set(pkg.cvBenefits?.premiumDesignIds || []); if (e.target.checked) selected.add(template.id); else selected.delete(template.id); updatePackage(index, { cvBenefits: { ...(pkg.cvBenefits || CV_BENEFIT_DEFAULTS), premiumDesignIds: Array.from(selected) } }); }} />{template.name || template.id}</label>)}</div></div>}
            <div className="flex justify-between border-t border-slate-800 pt-3"><span className="text-[10px] text-slate-500">Package ID: {pkg.id || 'legacy package'}</span><button onClick={() => setPricing((p: any) => ({ ...p, subscriptionPackages: (p.subscriptionPackages || []).filter((_: any, i: number) => i !== index) }))} className="text-xs text-rose-300"><Trash2 className="mr-1 inline h-3 w-3" />Remove plan</button></div>
          </article>
        ))}
        {!packages.length && <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center text-xs text-slate-500">No master plans configured yet.</div>}
      </section>
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-[11px] text-amber-100">Campaign credits exact placement aur duration ke sath redeem hotay hain. Credit use hone par normal campaign price dobara charge nahi hoti; admin rejection par credit restore hota hai. Email, WhatsApp aur SMS ke monthly quotas bhi backend par enforce hotay hain.</div>
    </div>
  );
};
