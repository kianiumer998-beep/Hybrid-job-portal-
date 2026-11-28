import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  Layers,
  Megaphone,
  Percent,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2
} from 'lucide-react';
import {
  AdPlacement,
  DEFAULT_AD_PRICING_CONFIG,
  DEFAULT_CAMPAIGN_CUSTOMIZATION_CONFIG,
  calculateCampaignCost,
  getPlacementDisplayName
} from '../../types/ad';

interface SubscriptionPlansBuilderProps {
  pricing: any;
  setPricing: React.Dispatch<React.SetStateAction<any>>;
  showReminderSettings?: boolean;
}

const CV_BENEFIT_DEFAULTS = {
  cvCreateLimit: 0,
  editLimit: 0,
  pdfExportLimit: 0,
  atsExportLimit: 0,
  shareLimit: 0,
  noWatermark: false,
  premiumDesignIds: [] as string[]
};

const ALL_CAMPAIGN_PLACEMENTS: Array<{ id: AdPlacement; label: string }> = [
  { id: 'top-header', label: 'Top Header Announcement Banner' },
  { id: 'feed-inline', label: 'Job Listings Feed Inline Card' },
  { id: 'promo-discount-banner', label: 'Promotional Discount Banner' },
  { id: 'dynamic-announcement-card', label: 'Dynamic Announcement Card' },
  { id: 'popup-modal', label: 'Centered Pop-up Lightbox Modal' },
  { id: 'toast-float', label: 'Floating Toast Notification' },
  { id: 'sidebar', label: 'Sidebar & Filter Widget Card' },
  { id: 'sms-broadcast', label: 'Direct SMS Broadcast' }
];

const FEATURE_META: Record<
  string,
  { group: 'access' | 'alerts' | 'cv' | 'jobs' | 'ads'; badge: string; shortHint: string }
> = {
  early_access: { group: 'access', badge: 'Early Access', shortHint: 'Early unlock window' },
  candidate_premium_membership: { group: 'access', badge: 'Candidate Membership', shortHint: 'Job details, direct apply & source PDF unlocks' },
  email_alerts: { group: 'alerts', badge: 'Alerts', shortHint: 'Email alerts quota' },
  whatsapp_alerts: { group: 'alerts', badge: 'Alerts', shortHint: 'WhatsApp alerts quota' },
  sms_alerts: { group: 'alerts', badge: 'Alerts', shortHint: 'SMS alerts quota' },
  cv_builder: { group: 'cv', badge: 'CV Builder', shortHint: 'CV plans, exports & designs' },
  urgent_job_posting: { group: 'jobs', badge: 'Job Tier', shortHint: 'Urgent Hiring slots' },
  featured_job_posting: { group: 'jobs', badge: 'Job Tier', shortHint: 'Featured Placement slots' },
  pinned_job_posting: { group: 'jobs', badge: 'Job Tier', shortHint: 'Pinned Top #1 slots' },
  vip_job_posting: { group: 'jobs', badge: 'Job Tier', shortHint: 'VIP Ultimate slots' },
  future_job_posting: { group: 'jobs', badge: 'Job Tier', shortHint: 'Future Job slots' },
  premium_job_posting: { group: 'jobs', badge: 'Legacy Tier', shortHint: 'Legacy premium slots' },
  campaign_credits: { group: 'ads', badge: 'Ad Hub', shortHint: 'Banner & campaign credits' }
};

const ALERT_FEATURE_IDS = new Set(['email_alerts', 'whatsapp_alerts', 'sms_alerts']);
const JOB_TIER_FEATURE_IDS = new Set([
  'urgent_job_posting',
  'featured_job_posting',
  'pinned_job_posting',
  'vip_job_posting',
  'future_job_posting',
  'premium_job_posting'
]);

const campaignPresetHours = (preset: any): number => {
  const value = Number(preset?.value);
  if (!Number.isFinite(value) || value <= 0) return 24;
  const unit = String(preset?.unit || 'days');
  return Math.round(
    unit === 'hours' ? value : unit === 'days' ? value * 24 : unit === 'weeks' ? value * 7 * 24 : value * 30 * 24
  );
};

const resolveLiveJobTier = (featureId: string, pricing: any) => {
  const jp = pricing?.jobPosting || {};
  switch (featureId) {
    case 'urgent_job_posting':
      return {
        label: jp.urgentBadgeText || 'Urgent Hiring',
        feePkr: Math.max(0, Number(jp.urgentFeePkr ?? 500) || 0),
        durationDays: Math.max(1, Number(jp.urgentDurationDays ?? 15) || 15),
        enabled: jp.enableUrgent !== false
      };
    case 'featured_job_posting':
      return {
        label: jp.featuredBadgeText || 'Featured Placement',
        feePkr: Math.max(0, Number(jp.featuredFeePkr ?? 1000) || 0),
        durationDays: Math.max(1, Number(jp.featuredDurationDays ?? 30) || 30),
        enabled: jp.enableFeatured !== false
      };
    case 'pinned_job_posting':
      return {
        label: jp.pinnedBadgeText || 'Pinned Top #1',
        feePkr: Math.max(0, Number(jp.featuredTopFeePkr ?? 1500) || 0),
        durationDays: Math.max(1, Number(jp.featuredTopDurationDays ?? 30) || 30),
        enabled: jp.enableFeaturedTop !== false
      };
    case 'vip_job_posting':
    case 'premium_job_posting':
      return {
        label: jp.vipBadgeText || 'VIP Ultimate Placement',
        feePkr: Math.max(0, Number(jp.vipBundleFeePkr ?? 2500) || 0),
        durationDays: Math.max(1, Number(jp.vipBundleDurationDays ?? 45) || 45),
        enabled: jp.enableVipBundle !== false
      };
    case 'future_job_posting':
      return {
        label: jp.futureBadgeText || 'Future Job (Advance Intake)',
        feePkr: Math.max(0, Number(jp.futureJobFeePkr ?? 800) || 0),
        durationDays: Math.max(1, Number(jp.futureJobDurationDays ?? 60) || 60),
        enabled: jp.enableFutureJob !== false
      };
    default:
      return null;
  }
};

const estimateCampaignCreditPrice = (credit: any, pricing: any): number => {
  const adPricing = pricing?.adPricingConfig || DEFAULT_AD_PRICING_CONFIG;
  const campaignCfg = pricing?.campaignCustomizationConfig || DEFAULT_CAMPAIGN_CUSTOMIZATION_CONFIG;
  const hours = Math.max(1, Number(credit?.durationHours) || 24);
  const qty = Math.max(1, Number(credit?.quantity) || 1);
  let durationUnit: 'hours' | 'days' | 'weeks' | 'months' = 'hours';
  let durationValue = hours;
  if (hours % (30 * 24) === 0) {
    durationUnit = 'months';
    durationValue = hours / (30 * 24);
  } else if (hours % (7 * 24) === 0) {
    durationUnit = 'weeks';
    durationValue = hours / (7 * 24);
  } else if (hours % 24 === 0) {
    durationUnit = 'days';
    durationValue = hours / 24;
  }
  const res = calculateCampaignCost(
    adPricing,
    durationUnit,
    durationValue,
    (credit?.placement || 'sidebar') as AdPlacement,
    ['jobs'],
    Number(credit?.smsRecipientsCount || 0),
    { campaignConfig: campaignCfg }
  );
  return Math.max(0, Math.round(res.totalCostPkr * qty));
};

const estimateTotalCampaignCreditsPrice = (credits: any[], pricing: any): number => {
  if (!Array.isArray(credits) || credits.length === 0) return 0;
  return credits.reduce((sum, credit) => sum + estimateCampaignCreditPrice(credit, pricing), 0);
};

const getEffectiveFeatureForPkg = (catalogItem: any, pkg: any) => {
  if (!catalogItem) return null;
  const override = pkg?.featureOverrides?.[catalogItem.id];
  if (!override || typeof override !== 'object') return catalogItem;
  return {
    ...catalogItem,
    pricePkr: override.pricePkr !== undefined && override.pricePkr !== '' ? Math.max(0, Number(override.pricePkr) || 0) : catalogItem.pricePkr,
    durationDays: override.durationDays !== undefined && override.durationDays !== '' ? Math.max(1, Number(override.durationDays) || catalogItem.durationDays || 30) : catalogItem.durationDays,
    includedSlots: override.includedSlots !== undefined && override.includedSlots !== '' ? Math.max(0, Number(override.includedSlots) || 0) : catalogItem.includedSlots,
    slotDurationDays: override.slotDurationDays !== undefined && override.slotDurationDays !== '' ? Math.max(1, Number(override.slotDurationDays) || catalogItem.slotDurationDays || 30) : catalogItem.slotDurationDays,
    unlimitedMessages: typeof override.unlimitedMessages === 'boolean' ? override.unlimitedMessages : catalogItem.unlimitedMessages,
    monthlyMessageQuota: override.monthlyMessageQuota !== undefined && override.monthlyMessageQuota !== '' ? Math.max(1, Number(override.monthlyMessageQuota) || 1) : catalogItem.monthlyMessageQuota,
    campaignCredits: Array.isArray(override.campaignCredits) ? override.campaignCredits : catalogItem.campaignCredits
  };
};

const computePkgPricingSummary = (pkg: any, pricing: any) => {
  const catalog = Array.isArray(pricing?.subscriptionFeatureCatalog) ? pricing.subscriptionFeatureCatalog : [];
  const selectedIds: string[] = Array.isArray(pkg?.featureIds) ? Array.from(new Set(pkg.featureIds.map(String))) : [];
  const effectiveItems = selectedIds
    .map((id) => {
      const base = catalog.find((item: any) => item.id === id);
      return base ? getEffectiveFeatureForPkg(base, pkg) : null;
    })
    .filter(Boolean);

  const subtotal = effectiveItems.reduce((sum: number, item: any) => sum + Math.max(0, Number(item.pricePkr || 0)), 0);
  const globalDiscount = Math.min(100, Math.max(0, Number(pricing?.subscriptionBundleDiscountPercent) || 0));

  if (pkg?.pricingMode === 'catalog') {
    if (
      pkg?.discountMode === 'target_price' &&
      pkg?.targetPriceOverridePkr !== undefined &&
      pkg?.targetPriceOverridePkr !== null &&
      pkg?.targetPriceOverridePkr !== '' &&
      subtotal > 0
    ) {
      const target = Math.max(0, Math.min(subtotal, Math.round(Number(pkg.targetPriceOverridePkr) || 0)));
      const discountPercent = Math.round(((subtotal - target) / subtotal) * 10000) / 100;
      return {
        subtotal,
        finalPrice: target,
        discountPercent,
        savingsPkr: Math.max(0, subtotal - target),
        effectiveItems
      };
    }
    const rawPct = pkg?.bundleDiscountPercent !== undefined && pkg?.bundleDiscountPercent !== ''
      ? Number(pkg.bundleDiscountPercent)
      : globalDiscount;
    const discountPercent = Number.isFinite(rawPct) ? Math.min(100, Math.max(0, rawPct)) : 0;
    const finalPrice = subtotal > 0 ? Math.max(0, Math.round(subtotal * (1 - discountPercent / 100))) : 0;
    return {
      subtotal,
      finalPrice,
      discountPercent,
      savingsPkr: Math.max(0, subtotal - finalPrice),
      effectiveItems
    };
  }

  const fixedPrice = Math.max(0, Number(pkg?.configuredPricePkr ?? pkg?.pricePkr ?? 0) || 0);
  const savingsPkr = Math.max(0, subtotal - fixedPrice);
  const discountPercent = subtotal > 0 && fixedPrice <= subtotal ? Math.round((savingsPkr / subtotal) * 10000) / 100 : 0;
  return {
    subtotal,
    finalPrice: fixedPrice,
    discountPercent,
    savingsPkr,
    effectiveItems
  };
};

export const SubscriptionPlansBuilder: React.FC<SubscriptionPlansBuilderProps> = ({
  pricing,
  setPricing,
  showReminderSettings = true
}) => {
  const [showCatalogSection, setShowCatalogSection] = useState(true);
  const [expandedFeatureKeys, setExpandedFeatureKeys] = useState<Record<string, boolean>>({});
  const [featureSourceMode, setFeatureSourceMode] = useState<Record<string, 'existing' | 'manual'>>({});
  const [confirmDeleteIndex, setConfirmDeleteIndex] = useState<number | null>(null);
  const [previewPackageIndex, setPreviewPackageIndex] = useState<number | null>(null);

  const catalog: any[] = Array.isArray(pricing?.subscriptionFeatureCatalog) ? pricing.subscriptionFeatureCatalog : [];
  const packages: any[] = Array.isArray(pricing?.subscriptionPackages) ? pricing.subscriptionPackages : [];
  const cvPackages: any[] = (Array.isArray(pricing?.cvBuilder?.packages) ? pricing.cvBuilder.packages : []).filter(
    (p: any) => p?.enabled !== false
  );
  const placementOptions: any[] = Array.isArray(pricing?.campaignCustomizationConfig?.placementOptions) &&
    pricing.campaignCustomizationConfig.placementOptions.length > 0
    ? pricing.campaignCustomizationConfig.placementOptions
    : DEFAULT_CAMPAIGN_CUSTOMIZATION_CONFIG.placementOptions;
  const durationPresets: any[] = (
    Array.isArray(pricing?.campaignCustomizationConfig?.durationPresets) &&
    pricing.campaignCustomizationConfig.durationPresets.length > 0
      ? pricing.campaignCustomizationConfig.durationPresets
      : DEFAULT_CAMPAIGN_CUSTOMIZATION_CONFIG.durationPresets
  ).filter((preset: any) => preset?.isEnabled !== false);

  const visibleCatalog = catalog.filter(
    (f: any) => f.id !== 'premium_job_posting' || f.enabled === true || packages.some((p: any) => (p.featureIds || []).includes(f.id))
  );

  const updateCatalogFeature = (featureId: string, patch: any) => {
    setPricing((prev: any) => ({
      ...prev,
      subscriptionFeatureCatalog: (prev.subscriptionFeatureCatalog || []).map((item: any) =>
        item.id === featureId ? { ...item, ...patch } : item
      )
    }));
  };

  const updatePackage = (index: number, patch: any) => {
    setPricing((prev: any) => {
      const nextList = [...(prev.subscriptionPackages || [])];
      const updatedPkg = { ...nextList[index], ...patch };
      const summary = computePkgPricingSummary(updatedPkg, prev);
      if (updatedPkg.pricingMode === 'catalog') {
        updatedPkg.pricePkr = summary.finalPrice;
        updatedPkg.configuredPricePkr = summary.finalPrice;
        updatedPkg.undiscountedPricePkr = summary.subtotal;
        updatedPkg.bundleDiscountPercent = summary.discountPercent;
      }
      nextList[index] = updatedPkg;
      return { ...prev, subscriptionPackages: nextList };
    });
  };

  const updatePackageFeatureOverride = (pkgIndex: number, featureId: string, patch: any) => {
    setPricing((prev: any) => {
      const nextList = [...(prev.subscriptionPackages || [])];
      const currentPkg = nextList[pkgIndex];
      const baseCatalog = (prev.subscriptionFeatureCatalog || []).find((f: any) => f.id === featureId) || {};
      const currentOverrides = currentPkg.featureOverrides || {};
      const mergedOverride = {
        pricePkr: baseCatalog.pricePkr ?? 0,
        durationDays: baseCatalog.durationDays ?? 30,
        includedSlots: baseCatalog.includedSlots ?? 0,
        slotDurationDays: baseCatalog.slotDurationDays ?? 30,
        ...(currentOverrides[featureId] || {}),
        ...patch
      };
      const updatedPkg = {
        ...currentPkg,
        featureOverrides: {
          ...currentOverrides,
          [featureId]: mergedOverride
        }
      };
      const summary = computePkgPricingSummary(updatedPkg, prev);
      if (updatedPkg.pricingMode === 'catalog') {
        updatedPkg.pricePkr = summary.finalPrice;
        updatedPkg.configuredPricePkr = summary.finalPrice;
        updatedPkg.undiscountedPricePkr = summary.subtotal;
        updatedPkg.bundleDiscountPercent = summary.discountPercent;
      }
      nextList[pkgIndex] = updatedPkg;
      return { ...prev, subscriptionPackages: nextList };
    });
  };

  const clearPackageFeatureOverride = (pkgIndex: number, featureId: string) => {
    setPricing((prev: any) => {
      const nextList = [...(prev.subscriptionPackages || [])];
      const currentPkg = nextList[pkgIndex];
      const nextOverrides = { ...(currentPkg.featureOverrides || {}) };
      delete nextOverrides[featureId];
      const updatedPkg = {
        ...currentPkg,
        featureOverrides: Object.keys(nextOverrides).length > 0 ? nextOverrides : undefined
      };
      const summary = computePkgPricingSummary(updatedPkg, prev);
      if (updatedPkg.pricingMode === 'catalog') {
        updatedPkg.pricePkr = summary.finalPrice;
        updatedPkg.configuredPricePkr = summary.finalPrice;
        updatedPkg.undiscountedPricePkr = summary.subtotal;
        updatedPkg.bundleDiscountPercent = summary.discountPercent;
      }
      nextList[pkgIndex] = updatedPkg;
      return { ...prev, subscriptionPackages: nextList };
    });
  };

  const addFeatureToPackage = (pkgIndex: number, featureId: string) => {
    if (!featureId) return;
    setPricing((prev: any) => {
      const catalogList = [...(prev.subscriptionFeatureCatalog || [])];
      const fIdx = catalogList.findIndex((f: any) => f.id === featureId);
      if (fIdx >= 0 && catalogList[fIdx].enabled !== true) {
        const currentF = catalogList[fIdx];
        const nextF: any = { ...currentF, enabled: true };
        if (ALERT_FEATURE_IDS.has(featureId) && nextF.unlimitedMessages !== true && !nextF.monthlyMessageQuota) {
          nextF.unlimitedMessages = true;
        }
        if (featureId === 'campaign_credits' && (!Array.isArray(nextF.campaignCredits) || nextF.campaignCredits.length === 0)) {
          const defaultCredit = { placement: 'top-header', durationHours: 24, quantity: 1 };
          nextF.campaignCredits = [defaultCredit];
          if (!nextF.pricePkr) nextF.pricePkr = estimateCampaignCreditPrice(defaultCredit, prev);
        }
        if (JOB_TIER_FEATURE_IDS.has(featureId) && (!nextF.includedSlots || nextF.includedSlots === 0)) {
          const liveTier = resolveLiveJobTier(featureId, prev);
          nextF.includedSlots = 1;
          if (liveTier) {
            nextF.slotDurationDays = liveTier.durationDays;
            if (!nextF.pricePkr) nextF.pricePkr = liveTier.feePkr;
          }
        }
        catalogList[fIdx] = nextF;
      }

      const nextPkgs = [...(prev.subscriptionPackages || [])];
      const currentPkg = nextPkgs[pkgIndex];
      const selected = new Set<string>(currentPkg.featureIds || []);
      selected.add(featureId);
      const updatedPkg: any = {
        ...currentPkg,
        featureIds: Array.from(selected),
        ...(featureId === 'cv_builder'
          ? {
              cvBenefitsEnabled: true,
              cvBenefits: { ...CV_BENEFIT_DEFAULTS, ...(currentPkg.cvBenefits || {}) }
            }
          : {})
      };
      const nextPricing = { ...prev, subscriptionFeatureCatalog: catalogList };
      const summary = computePkgPricingSummary(updatedPkg, nextPricing);
      if (updatedPkg.pricingMode === 'catalog') {
        updatedPkg.pricePkr = summary.finalPrice;
        updatedPkg.configuredPricePkr = summary.finalPrice;
        updatedPkg.undiscountedPricePkr = summary.subtotal;
        updatedPkg.bundleDiscountPercent = summary.discountPercent;
      }
      nextPkgs[pkgIndex] = updatedPkg;
      return { ...nextPricing, subscriptionPackages: nextPkgs };
    });
    const pkgId = packages[pkgIndex]?.id || pkgIndex;
    setExpandedFeatureKeys((prev) => ({ ...prev, [`${pkgId}:${featureId}`]: true }));
  };

  const toggleFeatureInPackage = (pkgIndex: number, featureId: string, checked: boolean) => {
    if (checked) {
      addFeatureToPackage(pkgIndex, featureId);
      const pkg = packages[pkgIndex];
      const pkgKey = pkg?.id || pkgIndex;
      setExpandedFeatureKeys((prev) => ({ ...prev, [`${pkgKey}:${featureId}`]: true }));
      return;
    }
    setPricing((prev: any) => {
      const nextPkgs = [...(prev.subscriptionPackages || [])];
      const currentPkg = nextPkgs[pkgIndex];
      const selected = new Set<string>(currentPkg.featureIds || []);
      selected.delete(featureId);
      const updatedPkg = { ...currentPkg, featureIds: Array.from(selected) };
      const summary = computePkgPricingSummary(updatedPkg, prev);
      if (updatedPkg.pricingMode === 'catalog') {
        updatedPkg.pricePkr = summary.finalPrice;
        updatedPkg.configuredPricePkr = summary.finalPrice;
        updatedPkg.undiscountedPricePkr = summary.subtotal;
        updatedPkg.bundleDiscountPercent = summary.discountPercent;
      }
      nextPkgs[pkgIndex] = updatedPkg;
      return { ...prev, subscriptionPackages: nextPkgs };
    });
  };

  const applyCvPackageToPlan = (pkgIndex: number, cvPkg: any) => {
    if (!cvPkg) return;
    setPricing((prev: any) => {
      const nextPkgs = [...(prev.subscriptionPackages || [])];
      const currentPkg = nextPkgs[pkgIndex];
      const selected = new Set<string>(currentPkg.featureIds || []);
      selected.add('cv_builder');

      const catalogList = [...(prev.subscriptionFeatureCatalog || [])];
      const cvIdx = catalogList.findIndex((f: any) => f.id === 'cv_builder');
      if (cvIdx >= 0 && catalogList[cvIdx].enabled !== true) {
        catalogList[cvIdx] = { ...catalogList[cvIdx], enabled: true };
      }

      const currentOverrides = currentPkg.featureOverrides || {};
      const updatedPkg: any = {
        ...currentPkg,
        featureIds: Array.from(selected),
        cvPackageId: cvPkg.id,
        cvBenefitsEnabled: true,
        cvBenefitsDescription: `${cvPkg.name || 'CV Package'} (${cvPkg.durationDays || 30}d): ${cvPkg.cvCreateLimit || 0} CVs, ${cvPkg.pdfExportLimit || 0} PDF, ${cvPkg.atsExportLimit || 0} ATS`,
        cvBenefits: {
          cvCreateLimit: Number(cvPkg.cvCreateLimit ?? 0),
          editLimit: Number(cvPkg.editLimit ?? 0),
          pdfExportLimit: Number(cvPkg.pdfExportLimit ?? 0),
          atsExportLimit: Number(cvPkg.atsExportLimit ?? 0),
          shareLimit: Number(cvPkg.shareLimit ?? 0),
          noWatermark: cvPkg.noWatermark === true,
          premiumDesignIds: Array.isArray(cvPkg.premiumDesignIds) ? cvPkg.premiumDesignIds : []
        },
        featureOverrides: {
          ...currentOverrides,
          cv_builder: {
            ...(currentOverrides.cv_builder || {}),
            pricePkr: Math.max(0, Number(cvPkg.pricePkr || 0)),
            durationDays: Math.max(1, Number(cvPkg.durationDays || 30))
          }
        }
      };

      const nextPricing = { ...prev, subscriptionFeatureCatalog: catalogList };
      const summary = computePkgPricingSummary(updatedPkg, nextPricing);
      if (updatedPkg.pricingMode === 'catalog') {
        updatedPkg.pricePkr = summary.finalPrice;
        updatedPkg.configuredPricePkr = summary.finalPrice;
        updatedPkg.undiscountedPricePkr = summary.subtotal;
        updatedPkg.bundleDiscountPercent = summary.discountPercent;
      }
      nextPkgs[pkgIndex] = updatedPkg;
      return { ...nextPricing, subscriptionPackages: nextPkgs };
    });
  };

  const generateHighlightsForPackage = (pkg: any) => {
    const summary = computePkgPricingSummary(pkg, pricing);
    const items: string[] = [];
    for (const item of summary.effectiveItems) {
      if (item.id === 'early_access') {
        items.push(`Premium Early Access (${pricing?.earlyAccess?.durationHours ?? 24}h head start)`);
      } else if (ALERT_FEATURE_IDS.has(item.id)) {
        const quotaLabel = item.unlimitedMessages === true ? 'Unlimited' : `${item.monthlyMessageQuota || 0}/mo`;
        items.push(`${item.label} (${quotaLabel})`);
      } else if (JOB_TIER_FEATURE_IDS.has(item.id)) {
        const slots = Number(item.includedSlots || 1);
        items.push(`${slots}× ${item.label} (${item.slotDurationDays || 30}d each)`);
      } else if (item.id === 'campaign_credits') {
        const credits = item.campaignCredits || [];
        if (credits.length) {
          credits.forEach((c: any) => {
            items.push(`${c.quantity}× ${getPlacementDisplayName(c.placement as AdPlacement)} (${c.durationHours}h)`);
          });
        } else {
          items.push(item.label);
        }
      } else if (item.id !== 'cv_builder') {
        items.push(item.label);
      }
    }
    if (pkg.cvBenefitsEnabled === true) {
      const cv = pkg.cvBenefits || {};
      items.push(`CV Builder (${cv.cvCreateLimit || 0} CVs · ${cv.pdfExportLimit || 0} PDFs${cv.noWatermark ? ' · No Watermark' : ''})`);
    }
    return items;
  };

  return (
    <div className="space-y-6 lg:col-span-2">
      {/* SECTION A: SUBSCRIPTION FEATURE CATALOG & RATE PRESETS */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-400" />
              <h3 className="font-bold text-white text-sm sm:text-base">Subscription Feature Catalog (Base Rates & Rules)</h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/25">
                {visibleCatalog.filter((f: any) => f.enabled === true).length} / {visibleCatalog.length} Enabled
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Define base prices, durations, job posting tiers (Urgent, Featured, Pinned Top #1, VIP, Future), alert quotas, and Ad Hub campaign credits.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCatalogSection((v) => !v)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-950 text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1.5 cursor-pointer"
          >
            {showCatalogSection ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            <span>{showCatalogSection ? 'Collapse Catalog' : 'Expand Catalog'}</span>
          </button>
        </div>

        {showCatalogSection && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {visibleCatalog.map((feature: any) => {
                const meta = FEATURE_META[feature.id] || { group: 'access', badge: 'Feature', shortHint: '' };
                const liveJobTier = JOB_TIER_FEATURE_IDS.has(feature.id) ? resolveLiveJobTier(feature.id, pricing) : null;
                const liveAdEstimate =
                  feature.id === 'campaign_credits'
                    ? estimateTotalCampaignCreditsPrice(feature.campaignCredits || [], pricing)
                    : 0;

                return (
                  <div
                    key={feature.id}
                    className={`rounded-xl border p-3 space-y-2.5 transition-colors ${
                      feature.enabled === true
                        ? 'border-emerald-500/30 bg-slate-950/90'
                        : 'border-slate-800 bg-slate-950/50 opacity-85'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-white truncate">{feature.label}</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                            {meta.badge}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500">{meta.shortHint}</p>
                      </div>
                      <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-300 cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          checked={feature.enabled === true}
                          onChange={(e) => updateCatalogFeature(feature.id, { enabled: e.target.checked })}
                          className="w-3.5 h-3.5 rounded border-slate-600 text-emerald-500"
                        />
                        <span>{feature.enabled === true ? 'On' : 'Off'}</span>
                      </label>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <label className="block text-[10px] text-slate-400">
                        Price (PKR)
                        <input
                          type="number"
                          min="0"
                          value={feature.pricePkr ?? 0}
                          onChange={(e) =>
                            updateCatalogFeature(feature.id, {
                              pricePkr: Math.max(0, Math.floor(Number(e.target.value) || 0))
                            })
                          }
                          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-bold text-white"
                        />
                      </label>
                      <label className="block text-[10px] text-slate-400">
                        Duration (Days)
                        <input
                          type="number"
                          min="1"
                          max="3650"
                          value={feature.durationDays ?? 30}
                          onChange={(e) =>
                            updateCatalogFeature(feature.id, {
                              durationDays: Math.max(1, Math.min(3650, Math.floor(Number(e.target.value) || 30)))
                            })
                          }
                          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-white"
                        />
                      </label>
                    </div>

                    {JOB_TIER_FEATURE_IDS.has(feature.id) && (
                      <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-900/60 p-2">
                        <div className="grid grid-cols-2 gap-2">
                          <label className="text-[10px] text-slate-400">
                            Included Slots
                            <input
                              type="number"
                              min="0"
                              max="1000"
                              value={feature.includedSlots ?? 0}
                              onChange={(e) =>
                                updateCatalogFeature(feature.id, {
                                  includedSlots: Math.max(0, Math.min(1000, Math.floor(Number(e.target.value) || 0)))
                                })
                              }
                              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-white"
                            />
                          </label>
                          <label className="text-[10px] text-slate-400">
                            Slot Duration (Days)
                            <input
                              type="number"
                              min="1"
                              max="3650"
                              value={feature.slotDurationDays ?? 30}
                              onChange={(e) =>
                                updateCatalogFeature(feature.id, {
                                  slotDurationDays: Math.max(1, Math.min(3650, Math.floor(Number(e.target.value) || 30)))
                                })
                              }
                              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-white"
                            />
                          </label>
                        </div>
                        {liveJobTier && (
                          <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
                            <span className="text-[10px] text-slate-400 truncate">
                              Live Tier: <strong className="text-amber-300">Rs. {liveJobTier.feePkr}</strong> · {liveJobTier.durationDays}d
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                const slots = Math.max(1, Number(feature.includedSlots || 1));
                                updateCatalogFeature(feature.id, {
                                  enabled: true,
                                  includedSlots: slots,
                                  slotDurationDays: liveJobTier.durationDays,
                                  pricePkr: liveJobTier.feePkr * slots
                                });
                              }}
                              className="px-2 py-0.5 rounded bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-[10px] font-bold text-amber-300 cursor-pointer shrink-0"
                            >
                              Sync Live Rate
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {feature.id === 'early_access' && (
                      <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2 flex items-center justify-between gap-2 text-[10px] text-emerald-200">
                        <span>
                          Window: <strong>{pricing.earlyAccess?.durationHours ?? 24}h</strong> · Sources:{' '}
                          <strong>{(pricing.earlyAccess?.sourceTypes || []).length}/3</strong>
                        </span>
                        <span className="text-[9px] text-slate-400">
                          {pricing.earlyAccess?.enabled ? 'Live Active' : 'Paused'}
                        </span>
                      </div>
                    )}

                    {ALERT_FEATURE_IDS.has(feature.id) && (
                      <div className="space-y-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2">
                        <label className="flex items-center gap-2 text-[10px] font-semibold text-emerald-200 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={feature.unlimitedMessages === true}
                            onChange={(e) =>
                              updateCatalogFeature(feature.id, {
                                unlimitedMessages: e.target.checked,
                                ...(e.target.checked ? {} : { monthlyMessageQuota: feature.monthlyMessageQuota || 50 })
                              })
                            }
                            className="w-3.5 h-3.5 rounded border-slate-600 text-emerald-500"
                          />
                          <span>Unlimited monthly messages</span>
                        </label>
                        {feature.unlimitedMessages !== true && (
                          <label className="block text-[10px] text-slate-300">
                            Monthly message quota
                            <input
                              type="number"
                              min="1"
                              max="1000000"
                              value={feature.monthlyMessageQuota ?? ''}
                              onChange={(e) =>
                                updateCatalogFeature(feature.id, {
                                  monthlyMessageQuota: e.target.value === '' ? '' : Math.max(1, Math.floor(Number(e.target.value) || 1))
                                })
                              }
                              placeholder="e.g. 100"
                              className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-white"
                            />
                          </label>
                        )}
                      </div>
                    )}

                    {feature.id === 'campaign_credits' && (
                      <div className="space-y-2 rounded-lg border border-indigo-500/25 bg-indigo-500/5 p-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-bold text-indigo-200">Ad Placement Credits</span>
                          <div className="flex items-center gap-1">
                            {liveAdEstimate > 0 && (
                              <button
                                type="button"
                                onClick={() => updateCatalogFeature(feature.id, { pricePkr: liveAdEstimate })}
                                className="px-1.5 py-0.5 rounded bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-400/30 text-[9px] font-bold text-indigo-200 cursor-pointer"
                                title="Set feature price to live Ad Hub Rate Card total"
                              >
                                Use Rs. {liveAdEstimate.toLocaleString()}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                updateCatalogFeature(feature.id, {
                                  campaignCredits: [
                                    ...(feature.campaignCredits || []),
                                    { placement: 'top-header', durationHours: 24, quantity: 1 }
                                  ]
                                })
                              }
                              className="px-2 py-0.5 rounded border border-indigo-400/40 bg-indigo-500/15 text-[9px] font-bold text-indigo-200 cursor-pointer"
                            >
                              + Add
                            </button>
                          </div>
                        </div>

                        {(feature.campaignCredits || []).map((credit: any, cIdx: number) => {
                          const unitCost = estimateCampaignCreditPrice(credit, pricing);
                          return (
                            <div key={cIdx} className="rounded border border-slate-800 bg-slate-950/70 p-1.5 space-y-1.5">
                              <div className="flex items-center gap-1.5">
                                <select
                                  value={credit.placement}
                                  onChange={(e) => {
                                    const nextCredits = [...(feature.campaignCredits || [])];
                                    nextCredits[cIdx] = {
                                      ...nextCredits[cIdx],
                                      placement: e.target.value,
                                      ...(e.target.value === 'sms-broadcast'
                                        ? { smsRecipientsCount: nextCredits[cIdx].smsRecipientsCount || 100 }
                                        : {})
                                    };
                                    updateCatalogFeature(feature.id, { campaignCredits: nextCredits });
                                  }}
                                  className="min-w-0 flex-1 rounded bg-slate-900 border border-slate-700 px-1.5 py-1 text-[10px] text-white"
                                >
                                  {ALL_CAMPAIGN_PLACEMENTS.map((opt) => (
                                    <option key={opt.id} value={opt.id}>
                                      {opt.label}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateCatalogFeature(feature.id, {
                                      campaignCredits: (feature.campaignCredits || []).filter((_: any, i: number) => i !== cIdx)
                                    })
                                  }
                                  className="text-[10px] text-rose-400 hover:text-rose-300 px-1 cursor-pointer"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                              <div className="grid grid-cols-3 gap-1.5">
                                <select
                                  value={
                                    durationPresets.find((p: any) => campaignPresetHours(p) === Number(credit.durationHours))?.id ||
                                    'custom'
                                  }
                                  onChange={(e) => {
                                    const preset = durationPresets.find((p: any) => p.id === e.target.value);
                                    if (!preset) return;
                                    const nextCredits = [...(feature.campaignCredits || [])];
                                    nextCredits[cIdx] = { ...nextCredits[cIdx], durationHours: campaignPresetHours(preset) };
                                    updateCatalogFeature(feature.id, { campaignCredits: nextCredits });
                                  }}
                                  className="rounded bg-slate-900 border border-slate-700 px-1 py-1 text-[10px] text-white"
                                >
                                  <option value="custom">Custom hrs</option>
                                  {durationPresets.map((p: any) => (
                                    <option key={p.id} value={p.id}>
                                      {p.label}
                                    </option>
                                  ))}
                                </select>
                                <input
                                  type="number"
                                  min="1"
                                  max="8760"
                                  value={credit.durationHours ?? 24}
                                  onChange={(e) => {
                                    const nextCredits = [...(feature.campaignCredits || [])];
                                    nextCredits[cIdx] = {
                                      ...nextCredits[cIdx],
                                      durationHours: Math.max(1, Math.min(8760, Math.floor(Number(e.target.value) || 24)))
                                    };
                                    updateCatalogFeature(feature.id, { campaignCredits: nextCredits });
                                  }}
                                  title="Hours"
                                  className="rounded bg-slate-900 border border-slate-700 px-1.5 py-1 text-[10px] text-white"
                                />
                                <input
                                  type="number"
                                  min="1"
                                  max="1000"
                                  value={credit.quantity ?? 1}
                                  onChange={(e) => {
                                    const nextCredits = [...(feature.campaignCredits || [])];
                                    nextCredits[cIdx] = {
                                      ...nextCredits[cIdx],
                                      quantity: Math.max(1, Math.min(1000, Math.floor(Number(e.target.value) || 1)))
                                    };
                                    updateCatalogFeature(feature.id, { campaignCredits: nextCredits });
                                  }}
                                  title="Quantity"
                                  className="rounded bg-slate-900 border border-slate-700 px-1.5 py-1 text-[10px] text-white"
                                />
                              </div>
                              {credit.placement === 'sms-broadcast' && (
                                <input
                                  type="number"
                                  min="1"
                                  max="100000"
                                  value={credit.smsRecipientsCount ?? 100}
                                  onChange={(e) => {
                                    const nextCredits = [...(feature.campaignCredits || [])];
                                    nextCredits[cIdx] = {
                                      ...nextCredits[cIdx],
                                      smsRecipientsCount: Math.max(1, Math.min(100000, Math.floor(Number(e.target.value) || 1)))
                                    };
                                    updateCatalogFeature(feature.id, { campaignCredits: nextCredits });
                                  }}
                                  placeholder="SMS recipients"
                                  className="w-full rounded bg-slate-900 border border-slate-700 px-1.5 py-1 text-[10px] text-white"
                                />
                              )}
                              <div className="text-[9px] text-indigo-300 text-right">
                                Rate Card Value: Rs. {unitCost.toLocaleString()}
                              </div>
                            </div>
                          );
                        })}
                        {(feature.campaignCredits || []).length === 0 && (
                          <p className="text-[10px] text-slate-400">Add placements above (Top Header, Feed Inline, Promo Banner, etc.).</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className={`grid grid-cols-1 ${showReminderSettings ? 'sm:grid-cols-2' : ''} gap-3 pt-2 border-t border-slate-800`}>
              <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3 space-y-1.5">
                <label className="block text-xs font-bold text-slate-200">Default Bundle Discount (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={pricing.subscriptionBundleDiscountPercent ?? 0}
                  onChange={(e) =>
                    setPricing((prev: any) => ({
                      ...prev,
                      subscriptionBundleDiscountPercent: Math.max(0, Math.min(100, Number(e.target.value) || 0))
                    }))
                  }
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm font-bold text-white"
                />
                <p className="text-[10px] text-slate-500">Applied by default to catalog-priced packages unless overridden per package.</p>
              </div>
              {showReminderSettings && (
                <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3 space-y-2">
                  <label className="flex items-center justify-between gap-2 text-xs font-bold text-slate-200 cursor-pointer">
                    <span>Enable in-app expiry reminders</span>
                    <input
                      type="checkbox"
                      checked={pricing.subscriptionReminderSettings?.enabled === true}
                      onChange={(e) =>
                        setPricing((prev: any) => ({
                          ...prev,
                          subscriptionReminderSettings: {
                            ...(prev.subscriptionReminderSettings || {}),
                            enabled: e.target.checked
                          }
                        }))
                      }
                      className="w-4 h-4 rounded border-slate-600 text-emerald-500"
                    />
                  </label>
                  <label className="block text-[10px] text-slate-400">
                    Remind this many days before expiry
                    <input
                      type="number"
                      min="1"
                      max="30"
                      value={pricing.subscriptionReminderSettings?.daysBefore ?? 3}
                      onChange={(e) =>
                        setPricing((prev: any) => ({
                          ...prev,
                          subscriptionReminderSettings: {
                            ...(prev.subscriptionReminderSettings || {}),
                            daysBefore: Math.max(1, Math.min(30, Math.floor(Number(e.target.value) || 3)))
                          }
                        }))
                      }
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-white"
                    />
                  </label>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* SECTION B: CANDIDATE SUBSCRIPTION PLANS (DYNAMIC PACKAGES) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <h3 className="font-bold text-white text-base">Candidate Subscription Plans (Dynamic Packages)</h3>
              <p className="text-[11px] text-slate-400">
                Combine Early Access, Alerts, CV Builder, Job Posting Tiers (Urgent, Featured, Pinned Top #1, VIP, Future) and Ad Credits with automatic bundle discount calculation.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              const newPkg = {
                id: `pkg-${Date.now()}`,
                name: 'New Package',
                pricePkr: 0,
                configuredPricePkr: 0,
                durationDays: 30,
                features: [],
                featureIds: [],
                pricingMode: 'catalog',
                discountMode: 'percent',
                bundleDiscountPercent: Number(pricing.subscriptionBundleDiscountPercent || 0),
                enabled: true,
                cvBenefitsEnabled: false,
                cvBenefitsDescription: '',
                cvBenefits: { ...CV_BENEFIT_DEFAULTS }
              };
              setPricing((prev: any) => ({
                ...prev,
                subscriptionPackages: [...(prev.subscriptionPackages || []), newPkg]
              }));
            }}
            className="px-3.5 py-2 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/35 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add New Package</span>
          </button>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {packages.map((pkg: any, idx: number) => {
            const summary = computePkgPricingSummary(pkg, pricing);
            const selectedIds: string[] = Array.isArray(pkg.featureIds) ? pkg.featureIds : [];
            const pkgKey = pkg.id || idx;

            return (
              <div
                key={pkgKey}
                className={`p-4 bg-slate-950/75 rounded-2xl border space-y-3.5 transition-all ${
                  pkg.enabled ? 'border-slate-800' : 'border-slate-800/40 opacity-65'
                }`}
              >
                {/* Package Header */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-800/80">
                  <input
                    type="text"
                    value={pkg.name || ''}
                    onChange={(e) => updatePackage(idx, { name: e.target.value })}
                    className="min-w-0 flex-1 bg-slate-900/70 border border-slate-800 focus:border-emerald-500 rounded-lg text-white font-bold text-sm outline-none px-2.5 py-1.5"
                    placeholder="Package Name"
                  />
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setPreviewPackageIndex(idx)}
                      className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-[11px] font-bold text-emerald-300 flex items-center gap-1 cursor-pointer"
                      title="Preview how candidates will see this package"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>Preview</span>
                    </button>
                    <input
                      type="text"
                      value={pkg.badge || ''}
                      onChange={(e) => updatePackage(idx, { badge: e.target.value })}
                      placeholder="Badge (e.g. Popular)"
                      className="w-28 bg-slate-900/70 border border-slate-800 focus:border-amber-400 rounded-lg text-[11px] text-amber-300 outline-none px-2 py-1"
                    />
                    <label className="flex items-center gap-1.5 cursor-pointer bg-slate-900 border border-slate-800 px-2 py-1 rounded-lg">
                      <input
                        type="checkbox"
                        checked={pkg.enabled === true}
                        onChange={(e) => updatePackage(idx, { enabled: e.target.checked })}
                        className="w-3.5 h-3.5 rounded border-slate-700 text-emerald-500"
                      />
                      <span className="text-[10px] font-bold text-slate-300 uppercase">Enabled</span>
                    </label>
                  </div>
                </div>

                {/* Duration & Pricing Mode */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                  <div className="sm:col-span-4">
                    <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Duration (Days)</label>
                    <input
                      type="number"
                      min="1"
                      max="3650"
                      value={pkg.durationDays ?? ''}
                      onChange={(e) =>
                        updatePackage(idx, {
                          durationDays: e.target.value === '' ? '' : Math.max(1, Math.floor(Number(e.target.value) || 1))
                        })
                      }
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs font-bold"
                    />
                  </div>
                  <div className="sm:col-span-8">
                    <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Package Pricing Mode</label>
                    <select
                      value={pkg.pricingMode === 'catalog' ? 'catalog' : 'fixed'}
                      onChange={(e) => updatePackage(idx, { pricingMode: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs font-semibold"
                    >
                      <option value="catalog">Calculate from selected features + bundle discount</option>
                      <option value="fixed">Use manually configured package price</option>
                    </select>
                  </div>
                </div>

                {/* Live Automatic Price & Bidirectional Discount Box */}
                {pkg.pricingMode === 'catalog' ? (
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-emerald-300 flex items-center gap-1.5">
                        <Percent className="w-3.5 h-3.5" />
                        Auto Price & Bidirectional Bundle Discount
                      </span>
                      {summary.subtotal > 0 ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-200 border border-emerald-500/30">
                          {summary.savingsPkr > 0
                            ? `Save Rs. ${summary.savingsPkr.toLocaleString()} (${summary.discountPercent}% OFF)`
                            : 'No discount (0% OFF)'}
                        </span>
                      ) : (
                        <span className="text-[10px] text-amber-300">Select features below to calculate</span>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-lg border border-slate-800 bg-slate-900/90 p-2">
                        <span className="block text-[9px] text-slate-400 uppercase font-bold">Features Sum</span>
                        <div className="text-xs sm:text-sm font-black text-slate-200 mt-1">
                          Rs. {summary.subtotal.toLocaleString()}
                        </div>
                      </div>

                      <div className="rounded-lg border border-slate-800 bg-slate-900/90 p-2">
                        <label className="block text-[9px] text-slate-400 uppercase font-bold">Discount (%)</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={summary.discountPercent}
                          onChange={(e) => {
                            const val = e.target.value === '' ? 0 : Math.min(100, Math.max(0, Number(e.target.value)));
                            updatePackage(idx, {
                              discountMode: 'percent',
                              bundleDiscountPercent: val,
                              targetPriceOverridePkr: undefined
                            });
                          }}
                          className="mt-1 w-full bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-xs font-bold text-emerald-300"
                        />
                      </div>

                      <div className="rounded-lg border border-emerald-500/35 bg-slate-900/90 p-2">
                        <label className="block text-[9px] text-emerald-300 uppercase font-bold">Final Price (PKR)</label>
                        <input
                          type="number"
                          min="0"
                          max={Math.max(10000000, summary.subtotal)}
                          value={summary.finalPrice}
                          onChange={(e) => {
                            const raw = Math.max(0, Math.floor(Number(e.target.value) || 0));
                            if (summary.subtotal > 0 && raw <= summary.subtotal) {
                              const pct = Math.round(((summary.subtotal - raw) / summary.subtotal) * 10000) / 100;
                              updatePackage(idx, {
                                discountMode: 'target_price',
                                targetPriceOverridePkr: raw,
                                bundleDiscountPercent: pct
                              });
                            } else {
                              updatePackage(idx, {
                                discountMode: 'percent',
                                bundleDiscountPercent: 0,
                                targetPriceOverridePkr: undefined
                              });
                            }
                          }}
                          className="mt-1 w-full bg-slate-950 border border-emerald-500/40 rounded px-1.5 py-1 text-xs font-black text-white"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3 grid grid-cols-2 gap-2.5 items-center">
                    <div>
                      <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Manual Price (PKR)</label>
                      <input
                        type="number"
                        min="0"
                        value={pkg.configuredPricePkr ?? pkg.pricePkr ?? ''}
                        onChange={(e) => {
                          const rawValue = e.target.value;
                          updatePackage(idx, {
                            pricePkr: rawValue === '' ? '' : Number(rawValue),
                            configuredPricePkr: rawValue === '' ? '' : Number(rawValue)
                          });
                        }}
                        className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs font-black"
                      />
                    </div>
                    <div className="text-[11px] text-slate-300 space-y-0.5">
                      <span className="block text-[10px] text-slate-400">Selected Features Value:</span>
                      <strong className="text-emerald-300">Rs. {summary.subtotal.toLocaleString()}</strong>
                      {summary.savingsPkr > 0 && (
                        <span className="block text-[10px] text-emerald-400">
                          Saving Rs. {summary.savingsPkr.toLocaleString()} ({summary.discountPercent}% off)
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Feature Picker Dropdown + Quick Toggle Grid */}
                <div className="space-y-2.5 rounded-xl border border-slate-800 bg-slate-900/50 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-slate-200">
                      Included Features & Services ({selectedIds.length} Selected)
                    </span>
                    <select
                      value=""
                      onChange={(e) => addFeatureToPackage(idx, e.target.value)}
                      className="rounded-lg border border-emerald-500/40 bg-slate-950 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 focus:outline-none"
                    >
                      <option value="">+ Select Feature / Tier from Dropdown...</option>
                      <optgroup label="Access & Job Alerts">
                        {visibleCatalog
                          .filter((f) => ['access', 'alerts'].includes(FEATURE_META[f.id]?.group || ''))
                          .map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.label} (Rs. {Number(f.pricePkr || 0).toLocaleString()}){selectedIds.includes(f.id) ? ' ✓' : ''}
                            </option>
                          ))}
                      </optgroup>
                      <optgroup label="CV Builder">
                        {visibleCatalog
                          .filter((f) => FEATURE_META[f.id]?.group === 'cv')
                          .map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.label} (Rs. {Number(f.pricePkr || 0).toLocaleString()}){selectedIds.includes(f.id) ? ' ✓' : ''}
                            </option>
                          ))}
                      </optgroup>
                      <optgroup label="Job Posting Tiers (Urgent / Featured / Pinned Top #1 / VIP / Future)">
                        {visibleCatalog
                          .filter((f) => FEATURE_META[f.id]?.group === 'jobs')
                          .map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.label} (Rs. {Number(f.pricePkr || 0).toLocaleString()}){selectedIds.includes(f.id) ? ' ✓' : ''}
                            </option>
                          ))}
                      </optgroup>
                      <optgroup label="Advertisement Campaigns">
                        {visibleCatalog
                          .filter((f) => FEATURE_META[f.id]?.group === 'ads')
                          .map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.label} (Rs. {Number(f.pricePkr || 0).toLocaleString()}){selectedIds.includes(f.id) ? ' ✓' : ''}
                            </option>
                          ))}
                      </optgroup>
                    </select>
                  </div>

                  {/* Quick Multi-Select Feature Chips */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {visibleCatalog.map((catalogFeature: any) => {
                      const isIncluded = selectedIds.includes(catalogFeature.id);
                      const eff = getEffectiveFeatureForPkg(catalogFeature, pkg);
                      const expandKey = `${pkgKey}:${catalogFeature.id}`;
                      const isExpanded = Boolean(expandedFeatureKeys[expandKey]);

                      return (
                        <div
                          key={catalogFeature.id}
                          className={`rounded-lg border px-2 py-1.5 text-[11px] flex items-center justify-between gap-1.5 transition-colors ${
                            isIncluded
                              ? 'border-emerald-500/45 bg-emerald-500/10 text-emerald-100'
                              : 'border-slate-800 bg-slate-950/70 text-slate-300'
                          }`}
                        >
                          <label className="flex items-center gap-1.5 min-w-0 flex-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isIncluded}
                              onChange={(e) => toggleFeatureInPackage(idx, catalogFeature.id, e.target.checked)}
                              className="w-3.5 h-3.5 rounded border-slate-600 text-emerald-500 shrink-0"
                            />
                            <span className="truncate font-semibold">{catalogFeature.label}</span>
                          </label>
                          <div className="flex items-center gap-1 shrink-0">
                            <span className="text-[10px] font-mono text-emerald-300">
                              Rs.{Number(eff?.pricePkr || 0).toLocaleString()}
                            </span>
                            {isIncluded && (
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedFeatureKeys((prev) => ({
                                    ...prev,
                                    [expandKey]: !prev[expandKey]
                                  }))
                                }
                                className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-[9px] font-bold text-slate-200 hover:text-white cursor-pointer"
                              >
                                {isExpanded ? 'Hide' : 'Setup'}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Expanded Smart Sub-Panels for Selected Features */}
                  {selectedIds
                    .filter((fId) => expandedFeatureKeys[`${pkgKey}:${fId}`])
                    .map((fId) => {
                      const baseFeature = catalog.find((f: any) => f.id === fId);
                      if (!baseFeature) return null;
                      const eff = getEffectiveFeatureForPkg(baseFeature, pkg);
                      const modeKey = `${pkgKey}:${fId}`;
                      const mode = featureSourceMode[modeKey] || 'existing';
                      const hasOverride = Boolean(pkg?.featureOverrides?.[fId]);
                      const liveJobTier = JOB_TIER_FEATURE_IDS.has(fId) ? resolveLiveJobTier(fId, pricing) : null;

                      return (
                        <div
                          key={fId}
                          className="rounded-xl border border-emerald-500/30 bg-slate-950 p-3 space-y-2.5 animate-in fade-in duration-150"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-white">{baseFeature.label}</span>
                              {hasOverride && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold">
                                  Custom Package Override
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setFeatureSourceMode((prev) => ({ ...prev, [modeKey]: 'existing' }))}
                                className={`px-2 py-1 rounded text-[10px] font-bold cursor-pointer border ${
                                  mode === 'existing'
                                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                    : 'bg-slate-900 text-slate-400 border-slate-700'
                                }`}
                              >
                                Show Enabled Packages / Live Rates
                              </button>
                              <button
                                type="button"
                                onClick={() => setFeatureSourceMode((prev) => ({ ...prev, [modeKey]: 'manual' }))}
                                className={`px-2 py-1 rounded text-[10px] font-bold cursor-pointer border ${
                                  mode === 'manual'
                                    ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                                    : 'bg-slate-900 text-slate-400 border-slate-700'
                                }`}
                              >
                                Manual / Custom
                              </button>
                              {hasOverride && (
                                <button
                                  type="button"
                                  onClick={() => clearPackageFeatureOverride(idx, fId)}
                                  className="px-2 py-1 rounded text-[10px] font-semibold bg-slate-900 border border-slate-700 text-rose-300 hover:text-rose-200 cursor-pointer"
                                >
                                  Reset
                                </button>
                              )}
                            </div>
                          </div>

                          {/* MODE 1: SHOW ENABLED / EXISTING PACKAGES & LIVE RATES */}
                          {mode === 'existing' && (
                            <div className="space-y-2 text-[11px]">
                              {fId === 'early_access' && (
                                <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-2.5 space-y-2">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span className="text-slate-200 font-semibold flex items-center gap-1.5">
                                      <Clock className="w-3.5 h-3.5 text-emerald-400" />
                                      Live Early Access Config: {pricing.earlyAccess?.durationHours ?? 24}h window ·{' '}
                                      {pricing.earlyAccess?.maxJobs ?? 10} max jobs
                                    </span>
                                    <span className="text-[10px] text-emerald-300 font-bold">
                                      Catalog: Rs. {Number(baseFeature.pricePkr || 0).toLocaleString()} · {baseFeature.durationDays || 30}d
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-slate-400">
                                    Eligible Sources: {(pricing.earlyAccess?.sourceTypes || []).join(', ') || 'None selected'}.{' '}
                                    <button
                                      type="button"
                                      onClick={() => clearPackageFeatureOverride(idx, fId)}
                                      className="text-emerald-300 underline font-semibold cursor-pointer"
                                    >
                                      Use Enabled Catalog Rate
                                    </button>
                                  </p>
                                </div>
                              )}

                              {ALERT_FEATURE_IDS.has(fId) && (
                                <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-2.5 flex flex-wrap items-center justify-between gap-2">
                                  <div className="text-slate-300">
                                    <strong>Catalog Plan:</strong> Rs. {Number(baseFeature.pricePkr || 0).toLocaleString()} ·{' '}
                                    {baseFeature.durationDays || 30} days ·{' '}
                                    {baseFeature.unlimitedMessages === true
                                      ? 'Unlimited messages'
                                      : `${baseFeature.monthlyMessageQuota || 0} msgs/month`}
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => clearPackageFeatureOverride(idx, fId)}
                                      className="px-2 py-1 rounded bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-bold text-emerald-300 cursor-pointer"
                                    >
                                      Apply Catalog Preset
                                    </button>
                                    {Number(pricing.subscriptions?.govtAlertsWeeklyPkr || 0) > 0 && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          updatePackageFeatureOverride(idx, fId, {
                                            pricePkr: Number(pricing.subscriptions.govtAlertsWeeklyPkr),
                                            durationDays: 7,
                                            unlimitedMessages: true
                                          })
                                        }
                                        className="px-2 py-1 rounded bg-slate-800 border border-slate-700 text-[10px] font-semibold text-slate-200 cursor-pointer"
                                      >
                                        7d Govt Alerts (Rs. {pricing.subscriptions.govtAlertsWeeklyPkr})
                                      </button>
                                    )}
                                  </div>
                                </div>
                              )}

                              {fId === 'cv_builder' && (
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold text-indigo-300 flex items-center gap-1">
                                      <FileText className="w-3.5 h-3.5" />
                                      Enabled Existing CV Packages ({cvPackages.length})
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => clearPackageFeatureOverride(idx, fId)}
                                      className="text-[10px] text-emerald-300 underline cursor-pointer"
                                    >
                                      Use Base Catalog (Rs. {Number(baseFeature.pricePkr || 0).toLocaleString()})
                                    </button>
                                  </div>
                                  {cvPackages.length > 0 ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                      {cvPackages.map((cvPkg: any) => {
                                        const isPicked = pkg.cvPackageId === cvPkg.id;
                                        return (
                                          <button
                                            key={cvPkg.id}
                                            type="button"
                                            onClick={() => applyCvPackageToPlan(idx, cvPkg)}
                                            className={`text-left rounded-lg border p-2 transition-colors cursor-pointer ${
                                              isPicked
                                                ? 'border-indigo-400 bg-indigo-500/15 text-white'
                                                : 'border-slate-800 bg-slate-900/80 text-slate-300 hover:border-indigo-500/40'
                                            }`}
                                          >
                                            <div className="flex items-center justify-between gap-1 font-bold text-xs">
                                              <span className="truncate">{cvPkg.name}</span>
                                              <span className="text-emerald-300 shrink-0">Rs. {Number(cvPkg.pricePkr || 0).toLocaleString()}</span>
                                            </div>
                                            <p className="text-[10px] text-slate-400 mt-0.5">
                                              {cvPkg.durationDays || 30}d · {cvPkg.cvCreateLimit || 0} CVs · {cvPkg.pdfExportLimit || 0} PDF ·{' '}
                                              {cvPkg.atsExportLimit || 0} ATS{cvPkg.noWatermark ? ' · No Watermark' : ''}
                                            </p>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <p className="text-[10px] text-slate-400">
                                      No separate CV Packages found — switch to Manual / Custom or configure CV benefits directly below.
                                    </p>
                                  )}
                                </div>
                              )}

                              {JOB_TIER_FEATURE_IDS.has(fId) && liveJobTier && (
                                <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-2.5 space-y-2">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span className="text-amber-200 font-bold">
                                      {liveJobTier.label} — Rs. {liveJobTier.feePkr.toLocaleString()} per {liveJobTier.durationDays} days
                                      {!liveJobTier.enabled ? ' (Paused globally)' : ''}
                                    </span>
                                    <span className="text-[10px] text-slate-300">
                                      Current: {eff.includedSlots || 0} slots · {eff.slotDurationDays || 30}d · Rs. {Number(eff.pricePkr || 0).toLocaleString()}
                                    </span>
                                  </div>
                                  <div className="flex flex-wrap gap-1.5">
                                    {[1, 2, 3, 5].map((slotCount) => (
                                      <button
                                        key={slotCount}
                                        type="button"
                                        onClick={() =>
                                          updatePackageFeatureOverride(idx, fId, {
                                            includedSlots: slotCount,
                                            slotDurationDays: liveJobTier.durationDays,
                                            pricePkr: liveJobTier.feePkr * slotCount
                                          })
                                        }
                                        className="px-2 py-1 rounded bg-slate-900 hover:bg-amber-500/20 border border-amber-500/30 text-[10px] font-bold text-amber-200 cursor-pointer"
                                      >
                                        {slotCount} Slot{slotCount > 1 ? 's' : ''} ({liveJobTier.durationDays}d) — Rs. {(liveJobTier.feePkr * slotCount).toLocaleString()}
                                      </button>
                                    ))}
                                    <button
                                      type="button"
                                      onClick={() => clearPackageFeatureOverride(idx, fId)}
                                      className="px-2 py-1 rounded bg-slate-900 border border-slate-700 text-[10px] text-slate-300 cursor-pointer"
                                    >
                                      Catalog Default ({baseFeature.includedSlots || 0} slots · Rs. {Number(baseFeature.pricePkr || 0).toLocaleString()})
                                    </button>
                                  </div>
                                </div>
                              )}

                              {fId === 'campaign_credits' && (
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-[10px] font-bold text-indigo-300 flex items-center gap-1">
                                      <Megaphone className="w-3.5 h-3.5" />
                                      Click any Live Ad Placement to include & auto-calculate price
                                    </span>
                                    <span className="text-[10px] text-emerald-300 font-bold">
                                      Active Credits Total: Rs. {Number(eff.pricePkr || 0).toLocaleString()}
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                    {ALL_CAMPAIGN_PLACEMENTS.map((pItem) => {
                                      const cfgOpt = placementOptions.find((o: any) => o.id === pItem.id);
                                      const sampleCost = estimateCampaignCreditPrice(
                                        { placement: pItem.id, durationHours: 24, quantity: 1, smsRecipientsCount: 100 },
                                        pricing
                                      );
                                      return (
                                        <button
                                          key={pItem.id}
                                          type="button"
                                          onClick={() => {
                                            const existingCredits = Array.isArray(eff.campaignCredits) ? [...eff.campaignCredits] : [];
                                            const matchIdx = existingCredits.findIndex(
                                              (c: any) => c.placement === pItem.id && Number(c.durationHours) === 24
                                            );
                                            if (matchIdx >= 0) {
                                              existingCredits[matchIdx] = {
                                                ...existingCredits[matchIdx],
                                                quantity: Number(existingCredits[matchIdx].quantity || 1) + 1
                                              };
                                            } else {
                                              existingCredits.push({
                                                placement: pItem.id,
                                                durationHours: 24,
                                                quantity: 1,
                                                ...(pItem.id === 'sms-broadcast' ? { smsRecipientsCount: 100 } : {})
                                              });
                                            }
                                            updatePackageFeatureOverride(idx, 'campaign_credits', {
                                              campaignCredits: existingCredits,
                                              pricePkr: estimateTotalCampaignCreditsPrice(existingCredits, pricing)
                                            });
                                          }}
                                          className="text-left rounded-lg border border-slate-800 hover:border-indigo-400/50 bg-slate-900/80 px-2.5 py-1.5 flex items-center justify-between gap-2 cursor-pointer"
                                        >
                                          <div className="min-w-0">
                                            <span className="block text-[10px] font-bold text-white truncate">{pItem.label}</span>
                                            <span className="block text-[9px] text-slate-400">
                                              {cfgOpt?.isEnabled === false ? 'Currently paused in Ad Hub · ' : ''}24h Rate: Rs. {sampleCost.toLocaleString()}
                                            </span>
                                          </div>
                                          <span className="text-[10px] font-bold text-indigo-300 shrink-0">+ Add 24h</span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* MODE 2: MANUAL / CUSTOM BUILDER */}
                          {mode === 'manual' && (
                            <div className="space-y-2.5 text-[11px]">
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                <label className="text-[10px] text-slate-400">
                                  Package Feature Price (PKR)
                                  <input
                                    type="number"
                                    min="0"
                                    value={eff.pricePkr ?? 0}
                                    onChange={(e) =>
                                      updatePackageFeatureOverride(idx, fId, {
                                        pricePkr: Math.max(0, Math.floor(Number(e.target.value) || 0))
                                      })
                                    }
                                    className="mt-1 w-full rounded bg-slate-900 border border-slate-700 px-2 py-1 text-xs font-bold text-white"
                                  />
                                </label>
                                <label className="text-[10px] text-slate-400">
                                  Feature Duration (Days)
                                  <input
                                    type="number"
                                    min="1"
                                    max="3650"
                                    value={eff.durationDays ?? 30}
                                    onChange={(e) =>
                                      updatePackageFeatureOverride(idx, fId, {
                                        durationDays: Math.max(1, Math.min(3650, Math.floor(Number(e.target.value) || 30)))
                                      })
                                    }
                                    className="mt-1 w-full rounded bg-slate-900 border border-slate-700 px-2 py-1 text-xs text-white"
                                  />
                                </label>
                                {JOB_TIER_FEATURE_IDS.has(fId) && (
                                  <>
                                    <label className="text-[10px] text-slate-400">
                                      Included Slots
                                      <input
                                        type="number"
                                        min="0"
                                        max="1000"
                                        value={eff.includedSlots ?? 1}
                                        onChange={(e) =>
                                          updatePackageFeatureOverride(idx, fId, {
                                            includedSlots: Math.max(0, Math.min(1000, Math.floor(Number(e.target.value) || 0)))
                                          })
                                        }
                                        className="mt-1 w-full rounded bg-slate-900 border border-slate-700 px-2 py-1 text-xs text-white"
                                      />
                                    </label>
                                    <label className="text-[10px] text-slate-400">
                                      Slot Active (Days)
                                      <input
                                        type="number"
                                        min="1"
                                        max="3650"
                                        value={eff.slotDurationDays ?? 30}
                                        onChange={(e) =>
                                          updatePackageFeatureOverride(idx, fId, {
                                            slotDurationDays: Math.max(1, Math.min(3650, Math.floor(Number(e.target.value) || 30)))
                                          })
                                        }
                                        className="mt-1 w-full rounded bg-slate-900 border border-slate-700 px-2 py-1 text-xs text-white"
                                      />
                                    </label>
                                  </>
                                )}
                              </div>

                              {ALERT_FEATURE_IDS.has(fId) && (
                                <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/60 p-2">
                                  <label className="flex items-center gap-1.5 text-[11px] text-emerald-200 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={eff.unlimitedMessages === true}
                                      onChange={(e) =>
                                        updatePackageFeatureOverride(idx, fId, {
                                          unlimitedMessages: e.target.checked,
                                          ...(e.target.checked ? {} : { monthlyMessageQuota: eff.monthlyMessageQuota || 50 })
                                        })
                                      }
                                    />
                                    <span>Unlimited Messages</span>
                                  </label>
                                  {eff.unlimitedMessages !== true && (
                                    <label className="flex items-center gap-2 text-[10px] text-slate-300">
                                      <span>Monthly Quota:</span>
                                      <input
                                        type="number"
                                        min="1"
                                        max="1000000"
                                        value={eff.monthlyMessageQuota ?? 50}
                                        onChange={(e) =>
                                          updatePackageFeatureOverride(idx, fId, {
                                            monthlyMessageQuota: Math.max(1, Math.floor(Number(e.target.value) || 1))
                                          })
                                        }
                                        className="w-24 rounded bg-slate-950 border border-slate-700 px-2 py-1 text-xs text-white"
                                      />
                                    </label>
                                  )}
                                </div>
                              )}

                              {fId === 'campaign_credits' && (
                                <div className="space-y-2 rounded-lg border border-indigo-500/20 bg-indigo-500/5 p-2">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-[10px] font-bold text-indigo-200">Package Campaign Credits</span>
                                    <div className="flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const total = estimateTotalCampaignCreditsPrice(eff.campaignCredits || [], pricing);
                                          updatePackageFeatureOverride(idx, 'campaign_credits', { pricePkr: total });
                                        }}
                                        className="px-2 py-0.5 rounded bg-indigo-500/20 border border-indigo-400/30 text-[10px] font-bold text-indigo-200 cursor-pointer"
                                      >
                                        Auto-Price from Ad Hub (Rs. {estimateTotalCampaignCreditsPrice(eff.campaignCredits || [], pricing).toLocaleString()})
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const nextCredits = [
                                            ...(eff.campaignCredits || []),
                                            { placement: 'top-header', durationHours: 24, quantity: 1 }
                                          ];
                                          updatePackageFeatureOverride(idx, 'campaign_credits', {
                                            campaignCredits: nextCredits,
                                            pricePkr: estimateTotalCampaignCreditsPrice(nextCredits, pricing)
                                          });
                                        }}
                                        className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-[10px] font-bold text-white cursor-pointer"
                                      >
                                        + Add Slot
                                      </button>
                                    </div>
                                  </div>
                                  {(eff.campaignCredits || []).map((credit: any, cIdx: number) => (
                                    <div key={cIdx} className="grid grid-cols-1 sm:grid-cols-12 gap-1.5 items-center rounded border border-slate-800 bg-slate-950/70 p-1.5">
                                      <select
                                        value={credit.placement}
                                        onChange={(e) => {
                                          const nextCredits = [...(eff.campaignCredits || [])];
                                          nextCredits[cIdx] = {
                                            ...nextCredits[cIdx],
                                            placement: e.target.value,
                                            ...(e.target.value === 'sms-broadcast'
                                              ? { smsRecipientsCount: nextCredits[cIdx].smsRecipientsCount || 100 }
                                              : {})
                                          };
                                          updatePackageFeatureOverride(idx, 'campaign_credits', {
                                            campaignCredits: nextCredits,
                                            pricePkr: estimateTotalCampaignCreditsPrice(nextCredits, pricing)
                                          });
                                        }}
                                        className="sm:col-span-5 rounded bg-slate-900 border border-slate-700 px-1.5 py-1 text-[10px] text-white"
                                      >
                                        {ALL_CAMPAIGN_PLACEMENTS.map((p) => (
                                          <option key={p.id} value={p.id}>
                                            {p.label}
                                          </option>
                                        ))}
                                      </select>
                                      <select
                                        value={
                                          durationPresets.find((p: any) => campaignPresetHours(p) === Number(credit.durationHours))?.id ||
                                          'custom'
                                        }
                                        onChange={(e) => {
                                          const preset = durationPresets.find((p: any) => p.id === e.target.value);
                                          if (!preset) return;
                                          const nextCredits = [...(eff.campaignCredits || [])];
                                          nextCredits[cIdx] = { ...nextCredits[cIdx], durationHours: campaignPresetHours(preset) };
                                          updatePackageFeatureOverride(idx, 'campaign_credits', {
                                            campaignCredits: nextCredits,
                                            pricePkr: estimateTotalCampaignCreditsPrice(nextCredits, pricing)
                                          });
                                        }}
                                        className="sm:col-span-3 rounded bg-slate-900 border border-slate-700 px-1.5 py-1 text-[10px] text-white"
                                      >
                                        <option value="custom">Custom hrs</option>
                                        {durationPresets.map((p: any) => (
                                          <option key={p.id} value={p.id}>
                                            {p.label}
                                          </option>
                                        ))}
                                      </select>
                                      <input
                                        type="number"
                                        min="1"
                                        max="8760"
                                        value={credit.durationHours ?? 24}
                                        onChange={(e) => {
                                          const nextCredits = [...(eff.campaignCredits || [])];
                                          nextCredits[cIdx] = {
                                            ...nextCredits[cIdx],
                                            durationHours: Math.max(1, Math.min(8760, Math.floor(Number(e.target.value) || 24)))
                                          };
                                          updatePackageFeatureOverride(idx, 'campaign_credits', {
                                            campaignCredits: nextCredits,
                                            pricePkr: estimateTotalCampaignCreditsPrice(nextCredits, pricing)
                                          });
                                        }}
                                        title="Hours"
                                        className="sm:col-span-2 rounded bg-slate-900 border border-slate-700 px-1.5 py-1 text-[10px] text-white"
                                      />
                                      <div className="sm:col-span-2 flex items-center gap-1">
                                        <input
                                          type="number"
                                          min="1"
                                          max="1000"
                                          value={credit.quantity ?? 1}
                                          onChange={(e) => {
                                            const nextCredits = [...(eff.campaignCredits || [])];
                                            nextCredits[cIdx] = {
                                              ...nextCredits[cIdx],
                                              quantity: Math.max(1, Math.min(1000, Math.floor(Number(e.target.value) || 1)))
                                            };
                                            updatePackageFeatureOverride(idx, 'campaign_credits', {
                                              campaignCredits: nextCredits,
                                              pricePkr: estimateTotalCampaignCreditsPrice(nextCredits, pricing)
                                            });
                                          }}
                                          title="Qty"
                                          className="w-full rounded bg-slate-900 border border-slate-700 px-1.5 py-1 text-[10px] text-white"
                                        />
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const nextCredits = (eff.campaignCredits || []).filter((_: any, i: number) => i !== cIdx);
                                            updatePackageFeatureOverride(idx, 'campaign_credits', {
                                              campaignCredits: nextCredits,
                                              pricePkr: estimateTotalCampaignCreditsPrice(nextCredits, pricing)
                                            });
                                          }}
                                          className="text-rose-400 hover:text-rose-300 cursor-pointer shrink-0"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                      {credit.placement === 'sms-broadcast' && (
                                        <div className="sm:col-span-12 flex items-center gap-2 pt-1">
                                          <span className="text-[10px] text-slate-400">SMS Recipients:</span>
                                          <input
                                            type="number"
                                            min="1"
                                            max="100000"
                                            value={credit.smsRecipientsCount ?? 100}
                                            onChange={(e) => {
                                              const nextCredits = [...(eff.campaignCredits || [])];
                                              nextCredits[cIdx] = {
                                                ...nextCredits[cIdx],
                                                smsRecipientsCount: Math.max(1, Math.min(100000, Math.floor(Number(e.target.value) || 1)))
                                              };
                                              updatePackageFeatureOverride(idx, 'campaign_credits', {
                                                campaignCredits: nextCredits,
                                                pricePkr: estimateTotalCampaignCreditsPrice(nextCredits, pricing)
                                              });
                                            }}
                                            className="w-28 rounded bg-slate-900 border border-slate-700 px-2 py-0.5 text-[10px] text-white"
                                          />
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>

                {/* Included CV Builder Benefits (Auto-syncs with CV Packages or Custom Limits) */}
                <div className="rounded-xl border border-indigo-500/25 bg-indigo-500/5 p-3 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="flex items-center gap-2 text-xs font-bold text-indigo-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={pkg.cvBenefitsEnabled === true}
                        onChange={(e) =>
                          updatePackage(idx, {
                            cvBenefitsEnabled: e.target.checked,
                            cvBenefits: { ...CV_BENEFIT_DEFAULTS, ...(pkg.cvBenefits || {}) }
                          })
                        }
                        className="w-3.5 h-3.5 rounded border-slate-600 text-indigo-500"
                      />
                      <span>Include CV Builder benefits in this plan</span>
                    </label>

                    {cvPackages.length > 0 && (
                      <select
                        value={pkg.cvPackageId || ''}
                        onChange={(e) => {
                          const picked = cvPackages.find((item: any) => item.id === e.target.value);
                          if (!picked) {
                            updatePackage(idx, { cvPackageId: '' });
                            return;
                          }
                          applyCvPackageToPlan(idx, picked);
                        }}
                        className="rounded-lg border border-indigo-400/30 bg-slate-900 px-2 py-1 text-[10px] text-indigo-200"
                      >
                        <option value="">Import Existing CV Package...</option>
                        {cvPackages.map((item: any) => (
                          <option key={item.id} value={item.id}>
                            {item.name} · Rs. {Number(item.pricePkr || 0).toLocaleString()} · {item.durationDays || 30}d
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {pkg.cvBenefitsEnabled === true && (
                    <div className="space-y-2 pt-1">
                      <label className="block text-[10px] text-slate-400">
                        CV benefits description
                        <textarea
                          rows={2}
                          maxLength={240}
                          value={pkg.cvBenefitsDescription || ''}
                          onChange={(e) => updatePackage(idx, { cvBenefitsDescription: e.target.value.slice(0, 240) })}
                          className="mt-1 w-full rounded-lg bg-slate-900 border border-slate-700 p-2 text-xs text-white"
                          placeholder="e.g. 2 CVs, 10 edits, 5 PDF downloads and premium designs."
                        />
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                        {(
                          [
                            { field: 'cvCreateLimit', label: 'CV creations' },
                            { field: 'editLimit', label: 'CV edits' },
                            { field: 'pdfExportLimit', label: 'PDF downloads' },
                            { field: 'atsExportLimit', label: 'ATS exports' },
                            { field: 'shareLimit', label: 'CV shares' }
                          ] as const
                        ).map((item) => (
                          <label key={item.field} className="text-[10px] text-slate-400">
                            {item.label}
                            <input
                              type="number"
                              min="0"
                              max="10000"
                              value={pkg.cvBenefits?.[item.field] ?? 0}
                              onChange={(e) =>
                                updatePackage(idx, {
                                  cvBenefits: {
                                    ...(pkg.cvBenefits || CV_BENEFIT_DEFAULTS),
                                    [item.field]: Math.max(0, Math.min(10000, Math.floor(Number(e.target.value) || 0)))
                                  }
                                })
                              }
                              className="mt-1 w-full rounded-lg bg-slate-900 border border-slate-700 px-2 py-1 text-xs text-white"
                            />
                          </label>
                        ))}
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <label className="flex items-center gap-2 text-[10px] text-slate-200 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={pkg.cvBenefits?.noWatermark === true}
                            onChange={(e) =>
                              updatePackage(idx, {
                                cvBenefits: { ...(pkg.cvBenefits || CV_BENEFIT_DEFAULTS), noWatermark: e.target.checked }
                              })
                            }
                          />
                          <span>CV exports without watermark</span>
                        </label>
                      </div>
                      <div className="space-y-1">
                        <span className="block text-[10px] text-slate-400">Premium designs included in this plan</span>
                        <div className="flex flex-wrap gap-2">
                          {(pricing.cvBuilder?.templates || [])
                            .filter((template: any) => template.free !== true)
                            .map((template: any) => (
                              <label key={template.id} className="inline-flex items-center gap-1.5 text-[10px] text-slate-300 bg-slate-900 border border-slate-800 px-2 py-1 rounded">
                                <input
                                  type="checkbox"
                                  checked={(pkg.cvBenefits?.premiumDesignIds || []).includes(template.id)}
                                  onChange={(e) => {
                                    const selected = new Set<string>(pkg.cvBenefits?.premiumDesignIds || []);
                                    if (e.target.checked) selected.add(template.id);
                                    else selected.delete(template.id);
                                    updatePackage(idx, {
                                      cvBenefits: {
                                        ...(pkg.cvBenefits || CV_BENEFIT_DEFAULTS),
                                        premiumDesignIds: Array.from(selected)
                                      }
                                    });
                                  }}
                                />
                                <span>{template.name || template.id}</span>
                              </label>
                            ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Highlights / Features List with Auto-Generate */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-[10px] text-slate-400 font-bold uppercase">Features List (Comma Separated)</label>
                    <button
                      type="button"
                      onClick={() => updatePackage(idx, { features: generateHighlightsForPackage(pkg) })}
                      className="text-[10px] font-bold text-emerald-300 hover:text-emerald-200 flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>Auto-Fill Highlights</span>
                    </button>
                  </div>
                  <textarea
                    value={(pkg.features || []).join(', ')}
                    onChange={(e) =>
                      updatePackage(idx, {
                        features: e.target.value
                          .split(',')
                          .map((s) => s.trim())
                          .filter(Boolean)
                      })
                    }
                    rows={2}
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-[11px] leading-tight outline-none focus:border-emerald-500"
                    placeholder="e.g. Instant WhatsApp Alerts, Priority Apply..."
                  />
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-2.5 border-t border-slate-800/70">
                  <span className="text-[10px] text-slate-500 font-mono">ID: {pkg.id}</span>
                  {confirmDeleteIndex === idx ? (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-rose-300 font-semibold">Delete package?</span>
                      <button
                        type="button"
                        onClick={() => {
                          const newList = packages.filter((_: any, i: number) => i !== idx);
                          setPricing((prev: any) => ({ ...prev, subscriptionPackages: newList }));
                          setConfirmDeleteIndex(null);
                        }}
                        className="px-2 py-0.5 rounded bg-rose-500/20 border border-rose-500/40 text-[10px] font-bold text-rose-200 cursor-pointer"
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteIndex(null)}
                        className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-[10px] text-slate-300 cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteIndex(idx)}
                      className="text-[10px] font-bold text-rose-400 hover:text-rose-300 uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Remove</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {packages.length === 0 && (
            <div className="xl:col-span-2 p-10 text-center border-2 border-dashed border-slate-800 rounded-2xl">
              <AlertCircle className="w-8 h-8 text-slate-700 mx-auto mb-3" />
              <p className="text-slate-500 text-sm">No subscription packages configured. Click "+ Add New Package" above to build one.</p>
            </div>
          )}
        </div>
      </div>

      {/* CANDIDATE VIEW PREVIEW MODAL */}
      {previewPackageIndex !== null && packages[previewPackageIndex] && (() => {
        const pIdx = previewPackageIndex;
        const pkg = packages[pIdx];
        const summary = computePkgPricingSummary(pkg, pricing);
        const highlights = generateHighlightsForPackage(pkg);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
            <div className="bg-slate-900 border border-emerald-500/40 rounded-3xl max-w-xl w-full p-6 space-y-5 shadow-2xl relative">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-300 font-black">
                    ✨
                  </div>
                  <div>
                    <h3 className="text-white font-black text-base flex items-center gap-2">
                      <span>Candidate View Preview</span>
                      {pkg.badge && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                          {pkg.badge}
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-slate-400">Exact appearance & pricing breakdown on the candidate subscription checkout modal.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewPackageIndex(null)}
                  className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Simulated Candidate Card */}
              <div className="rounded-2xl border-2 border-emerald-500/50 bg-gradient-to-b from-slate-950 to-slate-900 p-5 space-y-4 shadow-inner">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="text-lg font-black text-white">{pkg.name || 'Untitled Package'}</h4>
                    <p className="text-xs text-slate-400">Valid for {pkg.durationDays || 30} days access</p>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-black text-emerald-400">Rs. {Number(summary.finalPrice || 0).toLocaleString()}</div>
                    {summary.subtotal > summary.finalPrice && (
                      <div className="text-[10px] text-slate-400 line-through">Rs. {summary.subtotal.toLocaleString()}</div>
                    )}
                  </div>
                </div>

                {summary.savingsPkr > 0 && (
                  <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/25 rounded-xl px-3 py-2 text-xs text-emerald-200">
                    <span className="font-semibold">Bundle Savings Discount:</span>
                    <span className="font-bold">Save Rs. {summary.savingsPkr.toLocaleString()} ({summary.discountPercent}% OFF)</span>
                  </div>
                )}

                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <span className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">Included Benefits & Features:</span>
                  <ul className="space-y-1.5 text-xs text-slate-200">
                    {highlights.map((h, hIdx) => (
                      <li key={hIdx} className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>{h}</span>
                      </li>
                    ))}
                    {highlights.length === 0 && (
                      <li className="text-slate-500 italic text-xs">No features or highlights selected yet.</li>
                    )}
                  </ul>
                </div>
              </div>

              {/* Feature Comparison breakdown for Admin */}
              <div className="space-y-2 rounded-xl bg-slate-950 border border-slate-800 p-3.5 text-xs">
                <span className="block font-bold text-slate-300 mb-1">Feature Rate Comparison:</span>
                <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                  {summary.effectiveItems.map((item: any, iIdx: number) => (
                    <div key={iIdx} className="flex items-center justify-between py-1 border-b border-slate-900 last:border-0">
                      <span className="text-slate-300">{item.label}</span>
                      <span className="font-mono font-bold text-emerald-300">Rs. {Number(item.pricePkr || 0).toLocaleString()} ({item.durationDays || 30}d)</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setPreviewPackageIndex(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold cursor-pointer"
                >
                  Close Preview
                </button>
                <button
                  type="button"
                  onClick={() => {
                    updatePackage(pIdx, { features: generateHighlightsForPackage(pkg) });
                  }}
                  className="px-4 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Auto-Fill Highlights</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
