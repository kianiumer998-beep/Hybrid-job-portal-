import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Zap,
  Lock,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Upload,
  AlertCircle,
  Building,
  Smartphone,
  RefreshCw,
  Wallet,
  Copy,
  Check,
  Megaphone,
  Briefcase,
  Bell,
  FileText,
  Layers
} from 'lucide-react';
import { Subscriber, UserAccount } from '../types/job';
import { PublicPaymentMethodConfig, PublicPaymentSettings } from '../types/adminPayment';
import { api } from '../services/api';
import { WalletDepositModal, AttachedDepositPlan } from './ads/WalletDepositModal';

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubscribeSuccess: (subscriberData: Subscriber) => void;
  initialSelectedJobTitle?: string;
  initialCategory?: CommercialCategoryId;
  initialFeatureId?: string;
  initialPlacement?: string;
  currentUser?: UserAccount | null;
  whatsappEnabledGlobal?: boolean;
  onDepositWallet?: (depositData: {
    amount: number;
    paymentMethod: string;
    transactionId?: string;
    proofScreenshotUrl?: string;
    senderName?: string;
    senderPhoneOrAccount?: string;
    depositBankOrWalletName?: string;
    proofNote?: string;
    requestedPlanId?: string;
  }) => Promise<{ success: boolean; transaction?: any; message?: string } | boolean | void> | void;
  onWalletPurchaseSuccess?: () => Promise<void> | void;
  onNavigateToCampaigns?: (placement?: string, durationPresetId?: string) => void;
  onNavigateToPostJob?: () => void;
  onNavigateToCv?: () => void;
}

type ModalStage = 'categories' | 'plans' | 'checkout' | 'deposit' | 'activated';
type CommercialCategoryId =
  | 'ads_campaigns'
  | 'job_posting'
  | 'alerts_early_access'
  | 'cv_career'
  | 'mega_packages';
type AdSubOption = 'all' | 'campaign_ads' | 'banners' | 'advertisements';
type AlertSubOption = 'all' | 'whatsapp' | 'sms' | 'email' | 'early_access';

const AD_PLACEMENT_GROUP_MAP: Record<string, Exclude<AdSubOption, 'all'>> = {
  'feed-inline': 'campaign_ads',
  'popup-modal': 'campaign_ads',
  'toast-float': 'campaign_ads',
  'sms-broadcast': 'campaign_ads',
  'top-header': 'banners',
  'promo-discount-banner': 'banners',
  sidebar: 'advertisements',
  'dynamic-announcement-card': 'advertisements'
};

function getPackageTextCorpus(pkg: any): string {
  return [
    pkg?.name,
    pkg?.badge,
    pkg?.cvBenefitsDescription,
    ...(Array.isArray(pkg?.features) ? pkg.features : []),
    ...(Array.isArray(pkg?.featureLabels) ? pkg.featureLabels : [])
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function getPackageCategories(pkg: any): Set<CommercialCategoryId> {
  const cats = new Set<CommercialCategoryId>();
  const featureIds: string[] = Array.isArray(pkg?.featureIds)
    ? pkg.featureIds.map((id: any) => String(id))
    : [];
  const corpus = getPackageTextCorpus(pkg);

  if (
    featureIds.includes('campaign_credits') ||
    /\b(campaign|banner|advert|promo|announcement|popup|toast)\b/i.test(corpus)
  ) {
    cats.add('ads_campaigns');
  }

  if (
    featureIds.some((id) => id.endsWith('_job_posting') || id === 'candidate_premium_membership') ||
    /\b(job post|job posting|candidate premium|membership|urgent|featured|pinned|vip.*post|future.*job|advance intake)\b/i.test(corpus)
  ) {
    cats.add('job_posting');
  }

  if (
    featureIds.some((id) =>
      ['whatsapp_alerts', 'sms_alerts', 'email_alerts', 'early_access'].includes(id)
    ) ||
    /\b(whatsapp|sms|email|alert|early access|instant)\b/i.test(corpus)
  ) {
    cats.add('alerts_early_access');
  }

  if (
    featureIds.includes('cv_builder') ||
    pkg?.cvBenefitsEnabled === true ||
    /\b(cv|resume|ats|watermark)\b/i.test(corpus)
  ) {
    cats.add('cv_career');
  }

  if (!pkg?.isIndividualFeature) {
    cats.add('mega_packages');
  }

  return cats;
}

function matchesAdSubOption(pkg: any, subOption: AdSubOption): boolean {
  if (subOption === 'all') return true;
  const corpus = getPackageTextCorpus(pkg);
  if (subOption === 'banners') {
    return /\b(banner|top-header|promo-discount-banner|header)\b/i.test(corpus) || corpus.includes('campaign');
  }
  if (subOption === 'advertisements') {
    return /\b(advert|sidebar|dynamic-announcement-card|display)\b/i.test(corpus) || corpus.includes('campaign');
  }
  return /\b(campaign|feed-inline|popup|toast|sms-broadcast|credit)\b/i.test(corpus);
}

function matchesAlertSubOption(pkg: any, subOption: AlertSubOption): boolean {
  if (subOption === 'all') return true;
  const featureIds: string[] = Array.isArray(pkg?.featureIds) ? pkg.featureIds.map(String) : [];
  const corpus = getPackageTextCorpus(pkg);
  if (subOption === 'whatsapp') return featureIds.includes('whatsapp_alerts') || corpus.includes('whatsapp');
  if (subOption === 'sms') return featureIds.includes('sms_alerts') || corpus.includes('sms');
  if (subOption === 'email') return featureIds.includes('email_alerts') || corpus.includes('email');
  return featureIds.includes('early_access') || corpus.includes('early access');
}

export const SubscriptionModal: React.FC<SubscriptionModalProps> = ({
  isOpen,
  onClose,
  onSubscribeSuccess,
  initialSelectedJobTitle,
  initialCategory,
  initialFeatureId,
  initialPlacement,
  currentUser,
  whatsappEnabledGlobal = false,
  onDepositWallet,
  onWalletPurchaseSuccess,
  onNavigateToCampaigns,
  onNavigateToPostJob,
  onNavigateToCv
}) => {
  const [stage, setStage] = useState<ModalStage>(initialCategory ? 'plans' : 'categories');
  const [selectedCategory, setSelectedCategory] = useState<CommercialCategoryId>(initialCategory || 'mega_packages');
  const [adSubOption, setAdSubOption] = useState<AdSubOption>(initialPlacement ? (AD_PLACEMENT_GROUP_MAP[initialPlacement] || 'all') : 'all');
  const [alertSubOption, setAlertSubOption] = useState<AlertSubOption>(
    initialFeatureId === 'whatsapp_alerts' ? 'whatsapp' : initialFeatureId === 'sms_alerts' ? 'sms' : initialFeatureId === 'email_alerts' ? 'email' : initialFeatureId === 'early_access' ? 'early_access' : 'all'
  );
  const [confirmWalletPay, setConfirmWalletPay] = useState(false);
  const [selectedCampaignDurationPresetId, setSelectedCampaignDurationPresetId] = useState<string | undefined>(undefined);
  const [walletActivationSummary, setWalletActivationSummary] = useState<{
    planName: string;
    amountPaid: number;
    remainingBalance: number;
  } | null>(null);

  const [name, setName] = useState(currentUser?.name || '');
  const [phone, setPhone] = useState(currentUser?.phone || '');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [senderName, setSenderName] = useState('');
  const [senderPhone, setSenderPhone] = useState('');
  const [trxId, setTrxId] = useState('');
  const [proofScreenshotUrl, setProofScreenshotUrl] = useState('');
  const [proofNote, setProofNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isWalletPurchasing, setIsWalletPurchasing] = useState(false);
  const [submittedTx, setSubmittedTx] = useState<any | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [syncError, setSyncError] = useState('');
  const [isRetryingSync, setIsRetryingSync] = useState(false);
  const [copiedGuestField, setCopiedGuestField] = useState<'account' | 'iban' | null>(null);

  const [pricingData, setPricingData] = useState<any | null>(null);
  const [packages, setPackages] = useState<any[]>([]);
  const [selectedPackageId, setSelectedPackageId] = useState<string>('');
  const [isLoadingPackages, setIsLoadingPackages] = useState(true);

  const [paymentSettings, setPaymentSettings] = useState<PublicPaymentSettings | null>(null);
  const [isSettingsConfigured, setIsSettingsConfigured] = useState<boolean>(false);
  const [isLoadingSettings, setIsLoadingSettings] = useState<boolean>(true);
  const [selectedMethodKey, setSelectedMethodKey] = useState<string>('');
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});
  const [modalCustoms, setModalCustoms] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isOpen) return;
    setStage(initialCategory ? 'plans' : 'categories');
    setSelectedCategory(initialCategory || 'mega_packages');
    setAdSubOption(initialPlacement ? (AD_PLACEMENT_GROUP_MAP[initialPlacement] || 'all') : 'all');
    setAlertSubOption(
      initialFeatureId === 'whatsapp_alerts' ? 'whatsapp' : initialFeatureId === 'sms_alerts' ? 'sms' : initialFeatureId === 'email_alerts' ? 'email' : initialFeatureId === 'early_access' ? 'early_access' : 'all'
    );
    setConfirmWalletPay(false);
    setWalletActivationSummary(null);
    setSubmittedTx(null);
    setErrorMessage('');
    setSyncError('');
    setName(currentUser?.name || '');
    setPhone(currentUser?.phone || '');
    setEmail(currentUser?.email || '');
    setSenderName('');
    setSenderPhone('');
    setTrxId('');
    setProofScreenshotUrl('');
    setProofNote('');
    setCustomFieldValues({});

    setIsLoadingPackages(true);
    setPricingData(null);
    api.pricing
      .get()
      .then((res) => {
        if (res && res.success && res.pricing) {
          setPricingData(res.pricing);
          const enabledPkgs = (Array.isArray(res.pricing.subscriptionPackages) ? res.pricing.subscriptionPackages : [])
            .filter((p: any) => p && p.enabled)
            .sort((a: any, b: any) => Number(a.pricePkr || 0) - Number(b.pricePkr || 0));

          const individualFeatures = (
            Array.isArray(res.pricing.subscriptionFeatureCatalog) ? res.pricing.subscriptionFeatureCatalog : []
          )
            .filter((feature: any) => feature?.enabled === true)
            .map((feature: any) => ({
              id: `feature:${feature.id}`,
              name: feature.label,
              pricePkr: Number(feature.pricePkr || 0),
              durationDays: Number(feature.durationDays || 30),
              featureIds: [feature.id],
              featureLabels: [
                feature.label,
                ...(feature.id === 'campaign_credits'
                  ? (feature.campaignCredits || []).map(
                      (credit: any) =>
                        `${credit.placement} · ${credit.durationHours}h × ${credit.quantity}${
                          credit.placement === 'sms-broadcast' ? ` · ${credit.smsRecipientsCount} recipients` : ''
                        }`
                    )
                  : [])
              ],
              features: [],
              isIndividualFeature: true,
              enabled: true
            }))
            .filter((feature: any) => Number.isSafeInteger(feature.pricePkr) && feature.pricePkr > 0)
            .sort((a: any, b: any) => Number(a.pricePkr || 0) - Number(b.pricePkr || 0));

          const availablePackages = [...enabledPkgs, ...individualFeatures];
          setPackages(availablePackages);
          if (availablePackages.length > 0) {
            let targetPkg = availablePackages[0];
            if (initialFeatureId) {
              const found = availablePackages.find((p: any) => {
                const featureIds = Array.isArray(p.featureIds) ? p.featureIds.map(String) : [];
                return featureIds.includes(initialFeatureId) ||
                  (initialFeatureId === 'premium_job_posting' && featureIds.includes('candidate_premium_membership'));
              });
              if (found) targetPkg = found;
            } else if (initialCategory) {
              const foundCat = availablePackages.find((p: any) => {
                const cats = getPackageCategories(p);
                return cats.has(initialCategory);
              });
              if (foundCat) targetPkg = foundCat;
            }
            setSelectedPackageId(targetPkg.id);
          }
        }
      })
      .finally(() => {
        setIsLoadingPackages(false);
      });

    api.applySettings
      .get()
      .then((res) => {
        if (res && res.success && res.settings && res.settings.modalSettings?.subscription) {
          setModalCustoms(res.settings.modalSettings.subscription);
        }
      })
      .catch(() => {});
  }, [isOpen, currentUser?.id, currentUser?.name, currentUser?.email, currentUser?.phone, initialPlacement]);

  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    setIsLoadingSettings(true);

    api.paymentSettings
      .get()
      .then((res) => {
        if (!isMounted) return;
        if (res && res.success && res.configured && res.settings && res.settings.methods) {
          setPaymentSettings(res.settings);
          setIsSettingsConfigured(true);

          const enabledKeys = Object.entries(res.settings.methods)
            .filter(([_, m]: [string, any]) => m && m.enabled && m.accountNumber)
            .map(([k]) => k);

          if (res.settings.defaultMethod && enabledKeys.includes(res.settings.defaultMethod)) {
            setSelectedMethodKey(res.settings.defaultMethod);
          } else if (enabledKeys.length > 0) {
            setSelectedMethodKey(enabledKeys[0]);
          }
        } else {
          setPaymentSettings(null);
          setIsSettingsConfigured(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setPaymentSettings(null);
          setIsSettingsConfigured(false);
        }
      })
      .finally(() => {
        if (isMounted) setIsLoadingSettings(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  const packagesWithCategories = useMemo(
    () =>
      packages.map((pkg) => ({
        pkg,
        categories: getPackageCategories(pkg)
      })),
    [packages]
  );

  const categoryCounts = useMemo(() => {
    const counts: Record<CommercialCategoryId, number> = {
      ads_campaigns: 0,
      job_posting: 0,
      alerts_early_access: 0,
      cv_career: 0,
      mega_packages: 0
    };
    for (const item of packagesWithCategories) {
      item.categories.forEach((cat) => {
        counts[cat] += 1;
      });
    }
    return counts;
  }, [packagesWithCategories]);

  const enabledAdPlacements = useMemo(() => {
    // Show only placements and duration packages explicitly enabled in admin settings.
    const savedOptions = pricingData?.campaignCustomizationConfig?.placementOptions;
    const baseOptions = Array.isArray(savedOptions) ? savedOptions : [];
    const durationPresets = Array.isArray(pricingData?.campaignCustomizationConfig?.durationPresets)
      ? pricingData.campaignCustomizationConfig.durationPresets
      : [];

    return baseOptions
      .filter((opt: any) => opt && opt.isEnabled === true)
      .map((opt: any) => {
        const allowedIds = Array.isArray(opt.allowedDurationIds) ? opt.allowedDurationIds : null;
        const durationOptions = durationPresets
          .filter((preset: any) =>
            preset &&
            preset.isEnabled === true &&
            (!allowedIds || allowedIds.includes(preset.id))
          )
          .map((preset: any) => ({
            id: String(preset.id),
            label: String(preset.label || preset.id),
            subLabel: String(preset.subLabel || ''),
            badge: String(preset.badge || ''),
            unit: String(preset.unit),
            value: Number(preset.value || 1)
          }));

        return {
          id: String(opt.id),
          name: String(opt.name || opt.id),
          description: String(opt.description || ''),
          badge: String(opt.badge || ''),
          group: AD_PLACEMENT_GROUP_MAP[String(opt.id)] || 'advertisements',
          durationOptions
        };
      });
  }, [pricingData]);
  const enabledJobTiers = useMemo(() => {
    const jp = pricingData?.jobPosting;
    if (!jp) return [];
    const tiers = [
      {
        id: 'standard',
        name: 'Standard Job Post',
        enabled: jp.enableStandard !== false,
        feePkr: Number(jp.standardFeePkr || 0),
        days: Number(jp.standardDurationDays || 30),
        desc: jp.standardDescription || 'Listed in main job feed'
      },
      {
        id: 'urgent',
        name: 'Urgent Job Post',
        enabled: jp.enableUrgent !== false,
        feePkr: Number(jp.urgentFeePkr || 0),
        days: Number(jp.urgentDurationDays || 14),
        desc: jp.urgentDescription || 'Priority urgent hiring highlight'
      },
      {
        id: 'featured',
        name: 'Featured Top Job Post',
        enabled: jp.enableFeaturedTop !== false,
        feePkr: Number(jp.featuredTopFeePkr || 0),
        days: Number(jp.featuredTopDurationDays || 21),
        desc: jp.featuredDescription || jp.featuredTopDescription || 'Pinned near top search results'
      },
      {
        id: 'future',
        name: 'Future Job (Advance Intake)',
        enabled: jp.enableFutureJob !== false,
        feePkr: Number(jp.futureJobFeePkr || 0),
        days: Number(jp.futureJobDurationDays || 30),
        desc: jp.futureJobDescription || 'Upcoming hiring pipeline slot'
      },
      {
        id: 'vip',
        name: 'VIP Ultimate Job Bundle',
        enabled: jp.enableVipBundle !== false,
        feePkr: Number(jp.vipBundleFeePkr || 0),
        days: Number(jp.vipBundleDurationDays || 30),
        desc: jp.vipBundleDescription || 'Maximum visibility & alerts boost'
      }
    ];
    return tiers.filter((t) => t.enabled);
  }, [pricingData]);

  const filteredCategoryPackages = useMemo(() => {
    const list = packagesWithCategories
      .filter((item) => item.categories.has(selectedCategory))
      .map((item) => item.pkg);

    if (selectedCategory === 'ads_campaigns') {
      return list.filter((pkg) => matchesAdSubOption(pkg, adSubOption));
    }
    if (selectedCategory === 'alerts_early_access') {
      return list.filter((pkg) => matchesAlertSubOption(pkg, alertSubOption));
    }
    if (selectedCategory === 'mega_packages') {
      return [...list].sort((a, b) => {
        const aScore = (Array.isArray(a.featureIds) ? a.featureIds.length : 0) + (Number(a.bundleDiscountPercent || 0) > 0 ? 5 : 0);
        const bScore = (Array.isArray(b.featureIds) ? b.featureIds.length : 0) + (Number(b.bundleDiscountPercent || 0) > 0 ? 5 : 0);
        if (bScore !== aScore) return bScore - aScore;
        return Number(a.pricePkr || 0) - Number(b.pricePkr || 0);
      });
    }
    return list;
  }, [packagesWithCategories, selectedCategory, adSubOption, alertSubOption]);

  const selectedPlacementInfo = useMemo(
    () => enabledAdPlacements.find((placement) => placement.id === initialPlacement) || null,
    [enabledAdPlacements, initialPlacement]
  );
  useEffect(() => {
    setSelectedCampaignDurationPresetId(undefined);
  }, [initialPlacement, isOpen]);

  const filteredPlacementsForAdSubOption = useMemo(() => {
    if (adSubOption === 'all') return enabledAdPlacements;
    return enabledAdPlacements.filter((p) => p.group === adSubOption);
  }, [enabledAdPlacements, adSubOption]);

  if (!isOpen) return null;

  const activePackage = packages.find((p) => p.id === selectedPackageId) || packages[0] || null;
  const amountPaid = activePackage ? Number(activePackage.pricePkr) : 0;
  const plan = activePackage ? activePackage.id : '';
  const planName = activePackage ? activePackage.name : 'Selected Plan';
  const walletBalance = Number((currentUser as any)?.walletBalance || 0);
  const safeWalletBalance = Number.isFinite(walletBalance) ? Math.max(0, walletBalance) : 0;
  const isWalletSufficient = Boolean(currentUser?.id && activePackage && amountPaid > 0 && safeWalletBalance >= amountPaid);
  const walletShortfall = Math.max(0, amountPaid - safeWalletBalance);

  const attachedDepositPlan: AttachedDepositPlan | null = activePackage
    ? {
        id: activePackage.id,
        name: activePackage.name,
        pricePkr: amountPaid,
        durationDays: Number(activePackage.durationDays || 30)
      }
    : null;

  const handleCloseAll = () => {
    setStage('categories');
    setConfirmWalletPay(false);
    setSubmittedTx(null);
    setWalletActivationSummary(null);
    setErrorMessage('');
    onClose();
  };

  const handleOpenCategory = (cat: CommercialCategoryId, initialAdSub: AdSubOption = 'all') => {
    setSelectedCategory(cat);
    setAdSubOption(initialAdSub);
    setAlertSubOption('all');
    setErrorMessage('');
    setStage('plans');
  };

  const handleChoosePlan = (pkgId: string) => {
    setSelectedPackageId(pkgId);
    setErrorMessage('');
    setConfirmWalletPay(false);
    setStage('checkout');
  };

  const handleDepositSubmitFallback = async (depositData: {
    amount: number;
    paymentMethod: string;
    transactionId?: string;
    proofScreenshotUrl?: string;
    senderName?: string;
    senderPhoneOrAccount?: string;
    depositBankOrWalletName?: string;
    proofNote?: string;
    requestedPlanId?: string;
  }) => {
    if (onDepositWallet) {
      return onDepositWallet(depositData);
    }
    if (!currentUser?.id) {
      return { success: false, message: 'Please log in to submit a wallet deposit.' };
    }
    const txRes = await api.transactions.submit({
      amount: depositData.amount,
      currency: 'PKR',
      type: 'Wallet Deposit',
      paymentMethod: depositData.paymentMethod,
      transactionId: depositData.transactionId || undefined,
      senderName: depositData.senderName || currentUser.name,
      senderPhoneOrAccount: depositData.senderPhoneOrAccount || undefined,
      depositBankOrWalletName: depositData.depositBankOrWalletName || undefined,
      proofScreenshotUrl: depositData.proofScreenshotUrl || undefined,
      proofNote: depositData.proofNote || undefined,
      requestedPlanId: depositData.requestedPlanId || undefined,
      userId: currentUser.id,
      userName: currentUser.name,
      userEmail: currentUser.email,
      idempotencyKey: `dep-${currentUser.id}-${depositData.transactionId || Date.now()}`
    });
    if (txRes && txRes.success && txRes.transaction) {
      await onWalletPurchaseSuccess?.();
      return {
        success: true,
        transaction: txRes.transaction,
        message: txRes.message
      };
    }
    return {
      success: false,
      message: txRes?.message || 'Failed to submit deposit request.'
    };
  };

  if (stage === 'deposit' && attachedDepositPlan) {
    return (
      <WalletDepositModal
        isOpen={true}
        initialAmount={walletShortfall > 0 ? walletShortfall : amountPaid}
        attachedPlan={attachedDepositPlan}
        currentWalletBalance={safeWalletBalance}
        onBackToPlans={() => setStage('checkout')}
        onClose={handleCloseAll}
        onDepositWallet={handleDepositSubmitFallback}
      />
    );
  }

  const enabledMethods: [string, PublicPaymentMethodConfig][] = paymentSettings?.methods
    ? (Object.entries(paymentSettings.methods).filter(
        ([_, m]) => m && m.enabled && m.accountNumber && m.accountTitle
      ) as [string, PublicPaymentMethodConfig][])
    : [];

  const selectedMethod: PublicPaymentMethodConfig | null =
    selectedMethodKey && paymentSettings?.methods
      ? (paymentSettings.methods[selectedMethodKey] as PublicPaymentMethodConfig) || null
      : enabledMethods.length > 0
      ? enabledMethods[0][1]
      : null;

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage('Receipt screenshot file size must be under 5MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setProofScreenshotUrl(reader.result);
        setErrorMessage('');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCopyGuestText = async (value: string, field: 'account' | 'iban') => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedGuestField(field);
      setTimeout(() => {
        setCopiedGuestField((prev) => (prev === field ? null : prev));
      }, 1800);
    } catch {}
  };

  const handleRetrySync = async () => {
    const internalTxId = submittedTx?.id;
    if (!internalTxId) return;
    setIsRetryingSync(true);
    setSyncError('');
    try {
      const subRes = await api.subscribers.createPending({
        paymentTransactionId: internalTxId,
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        whatsappEnabled: Boolean(whatsappEnabledGlobal),
        senderPhoneOrAccount: senderPhone.trim() || undefined
      });

      if (subRes && subRes.success && subRes.subscriber) {
        setSyncError('');
        setIsRetryingSync(false);
        onSubscribeSuccess(subRes.subscriber);
      } else {
        setSyncError(
          subRes?.message || 'Subscriber synchronization retry failed. Payment remains logged in Pending status.'
        );
        setIsRetryingSync(false);
      }
    } catch (err: any) {
      setSyncError(
        err?.message || 'Subscriber synchronization retry error. Payment remains logged in Pending status.'
      );
      setIsRetryingSync(false);
    }
  };

  const handleWalletPurchase = async () => {
    if (!currentUser?.id || !activePackage || !Number.isSafeInteger(amountPaid) || amountPaid <= 0) {
      setErrorMessage('Please sign in and select a valid paid package.');
      return;
    }
    if (safeWalletBalance < amountPaid) {
      setErrorMessage(
        `Insufficient wallet balance. Required PKR ${amountPaid.toLocaleString()}, available PKR ${safeWalletBalance.toLocaleString()}.`
      );
      return;
    }

    setIsWalletPurchasing(true);
    setErrorMessage('');
    try {
      const result: any = await api.transactions.submit({
        amount: amountPaid,
        currency: 'PKR',
        type: 'Subscription',
        plan,
        paymentMethod: 'Wallet Balance',
        userId: currentUser.id,
        userEmail: currentUser.email,
        userName: currentUser.name,
        idempotencyKey: 'sub-wallet-' + currentUser.id + '-' + plan + '-' + Date.now()
      });
      if (!result?.success || result?.transaction?.status !== 'Success') {
        throw new Error(result?.message || 'Wallet purchase could not be confirmed.');
      }
      const updatedBalance = Number(result.transaction.balanceAfter);
      const remaining = Number.isFinite(updatedBalance) ? updatedBalance : Math.max(0, safeWalletBalance - amountPaid);
      setWalletActivationSummary({
        planName,
        amountPaid,
        remainingBalance: remaining
      });
      setConfirmWalletPay(false);
      setStage('activated');
      await onWalletPurchaseSuccess?.();
    } catch (error: any) {
      setErrorMessage(error?.message || 'Wallet purchase failed. Please try again.');
    } finally {
      setIsWalletPurchasing(false);
    }
  };

  const handleGuestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSyncError('');
    if (!plan) {
      setErrorMessage('Please select a valid subscription package.');
      return;
    }

    if (!isSettingsConfigured || !selectedMethod) {
      setErrorMessage('Payment details are currently unavailable. Please check back later.');
      return;
    }

    if (!name.trim() || (whatsappEnabledGlobal && !phone.trim()) || !email.trim()) {
      setErrorMessage(
        whatsappEnabledGlobal
          ? 'Please fill out your Full Name, Phone (WhatsApp), and Email address.'
          : 'Please fill out your Full Name and Email address.'
      );
      return;
    }

    if (selectedMethod.senderNameRequired && !senderName.trim()) {
      setErrorMessage(`Please enter the ${selectedMethod.senderNameLabel || 'Sender Name / Account Holder'}.`);
      return;
    }

    if (selectedMethod.senderPhoneRequired && !senderPhone.trim()) {
      setErrorMessage(`Please enter the ${selectedMethod.senderPhoneLabel || 'Sender Mobile / Account Number'}.`);
      return;
    }

    if (selectedMethod.transactionIdRequired && !trxId.trim()) {
      setErrorMessage(`Please enter the ${selectedMethod.transactionIdLabel || 'Transaction ID (TID)'}.`);
      return;
    }

    if (selectedMethod.screenshotRequired && !proofScreenshotUrl) {
      setErrorMessage(`Please upload a ${selectedMethod.screenshotLabel || 'Payment Receipt Screenshot'}.`);
      return;
    }

    if (selectedMethod.proofNoteRequired && !proofNote.trim()) {
      setErrorMessage(`Please provide ${selectedMethod.proofNoteLabel || 'a deposit note'}.`);
      return;
    }

    if (selectedMethod.customFields && selectedMethod.customFields.length > 0) {
      for (const cf of selectedMethod.customFields) {
        const val = (customFieldValues[cf.id] || '').trim();
        if (cf.required && !val) {
          setErrorMessage(`Please enter the required field "${cf.label}".`);
          return;
        }
      }
    }

    if (!trxId.trim() && !proofScreenshotUrl) {
      setErrorMessage('Please provide either the Transaction ID or upload a Payment Receipt Screenshot.');
      return;
    }

    setIsSubmitting(true);
    const cleanTrxId = trxId.trim() || undefined;
    const depositAccountDesc = `${selectedMethod.name}: ${selectedMethod.accountNumber}${
      selectedMethod.bankName ? ` (${selectedMethod.bankName})` : ''
    }`;

    const customDetails =
      selectedMethod.customFields && selectedMethod.customFields.length > 0
        ? selectedMethod.customFields
            .map((f) => {
              const rawVal = (customFieldValues[f.id] || '').trim();
              const cleanLabel = f.label.replace(/[:\r\n]+/g, ' ').trim();
              const cleanVal = rawVal.replace(/[\r\n]+/g, ' ').trim();
              return `${cleanLabel}: ${cleanVal || 'N/A'}`;
            })
            .join('\n')
        : '';

    const cleanUserNote = proofNote.replace(/--- Custom Proof Details ---/gi, '').trim();
    const effectiveProofNote = [
      cleanUserNote ? `User Note: ${cleanUserNote}` : '',
      customDetails ? `--- Custom Proof Details ---\n${customDetails}` : ''
    ]
      .filter(Boolean)
      .join('\n\n');

    const cleanSenderName = senderName.trim() || undefined;
    const cleanSenderPhone = senderPhone.trim() || undefined;

    try {
      const txRes = await api.transactions.submit({
        amount: amountPaid,
        currency: 'PKR',
        type: 'Subscription',
        plan,
        paymentMethod: selectedMethod.name,
        transactionId: cleanTrxId,
        senderName: cleanSenderName,
        senderPhoneOrAccount: cleanSenderPhone,
        depositBankOrWalletName: depositAccountDesc,
        proofScreenshotUrl: proofScreenshotUrl.trim() || undefined,
        proofNote: effectiveProofNote.trim() || undefined,
        userId: currentUser?.id || undefined,
        userEmail: email.trim(),
        userName: name.trim(),
        jobTitleRef: initialSelectedJobTitle || undefined,
        idempotencyKey: `sub-${email.trim().toLowerCase()}-${cleanTrxId || Date.now()}`
      });

      if (txRes && txRes.success && txRes.transaction) {
        const internalTxId = txRes.transaction.id;
        setSubmittedTx(txRes.transaction);

        if (!internalTxId) {
          setSyncError('Payment recorded, but server did not return a valid internal transaction ID.');
          setIsSubmitting(false);
          return;
        }

        try {
          const subRes = await api.subscribers.createPending({
            paymentTransactionId: internalTxId,
            name: name.trim(),
            email: email.trim(),
            phone: phone.trim(),
            whatsappEnabled: Boolean(whatsappEnabledGlobal),
            senderPhoneOrAccount: cleanSenderPhone
          });

          if (subRes && subRes.success && subRes.subscriber) {
            setSyncError('');
            setIsSubmitting(false);
            onSubscribeSuccess(subRes.subscriber);
          } else {
            setSyncError(
              subRes?.message || 'Payment recorded successfully, but subscriber creation synchronization is pending.'
            );
            setIsSubmitting(false);
          }
        } catch (subErr: any) {
          setSyncError(
            subErr?.message || 'Payment recorded successfully, but subscriber creation synchronization failed.'
          );
          setIsSubmitting(false);
        }
      } else {
        setErrorMessage(txRes?.message || 'Could not record payment. Please check your details and try again.');
        setIsSubmitting(false);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error submitting payment transaction.');
      setIsSubmitting(false);
    }
  };

  const CATEGORY_META: Record<
    CommercialCategoryId,
    { title: string; subtitle: string; icon: React.ReactNode; accent: string }
  > = {
    ads_campaigns: {
      title: 'Premium Ads, Banners & Campaigns',
      subtitle: 'Premium Ad Placements · Campaigns · Banners · Advertisements',
      icon: <Megaphone className="w-4 h-4 text-amber-400" />,
      accent: 'border-amber-500/30 hover:border-amber-400'
    },
    job_posting: {
      title: 'Job Posting Plans',
      subtitle: 'Premium Membership · Standard, Urgent, Featured, Pinned & VIP',
      icon: <Briefcase className="w-4 h-4 text-sky-400" />,
      accent: 'border-sky-500/30 hover:border-sky-400'
    },
    alerts_early_access: {
      title: 'Alerts & Early Access',
      subtitle: 'WhatsApp, SMS, Email & Early Access',
      icon: <Bell className="w-4 h-4 text-emerald-400" />,
      accent: 'border-emerald-500/30 hover:border-emerald-400'
    },
    cv_career: {
      title: 'CV Builder & Career Tools',
      subtitle: 'ATS Exports, Premium Designs & Quotas',
      icon: <FileText className="w-4 h-4 text-indigo-400" />,
      accent: 'border-indigo-500/30 hover:border-indigo-400'
    },
    mega_packages: {
      title: 'All-in-One Mega Packages',
      subtitle: 'Combined Multi-Feature Subscription Bundles',
      icon: <Layers className="w-4 h-4 text-emerald-400" />,
      accent: 'border-emerald-500/40 hover:border-emerald-400'
    }
  };

  const renderPlanCard = (pkg: any) => {
    const price = Number(pkg.pricePkr || 0);
    const days = Number(pkg.durationDays || 30);
    const isSelected = selectedPackageId === pkg.id;
    const isMatchedByRequest = initialFeatureId && Array.isArray(pkg.featureIds) && pkg.featureIds.includes(initialFeatureId);
    const hasSaving =
      Number(pkg.bundleDiscountPercent || 0) > 0 && Number(pkg.undiscountedPricePkr || 0) > price;
    const featureLines: string[] = [
      ...(Array.isArray(pkg.features) ? pkg.features : []),
      ...(Array.isArray(pkg.featureLabels) ? pkg.featureLabels : [])
    ];
    const coversWithWallet = Boolean(currentUser?.id && safeWalletBalance >= price);

    return (
      <div
        key={pkg.id}
        onClick={() => setSelectedPackageId(pkg.id)}
        className={`rounded-xl border p-3.5 flex flex-col justify-between gap-3 transition-colors cursor-pointer ${
          isSelected || isMatchedByRequest
            ? 'bg-emerald-500/[0.08] border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.15)] ring-1 ring-emerald-500/40'
            : 'bg-slate-950 border-slate-800 hover:border-slate-700'
        }`}
      >
        <div className="space-y-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              {isMatchedByRequest && (
                <span className="inline-block mb-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-black uppercase tracking-wider">
                  ★ Recommended for Your Request
                </span>
              )}
              <h3 className="text-sm font-bold text-white leading-snug truncate">{pkg.name}</h3>
              {pkg.badge ? (
                <span className="text-[10px] font-semibold text-amber-300">{pkg.badge}</span>
              ) : pkg.isIndividualFeature ? (
                <span className="text-[10px] font-medium text-sky-300">Single Feature Plan</span>
              ) : (
                <span className="text-[10px] font-medium text-emerald-300">Subscription Package</span>
              )}
            </div>
            <div className="text-right shrink-0 font-mono tabular-nums">
              <div className="text-base font-black text-emerald-400">PKR {price.toLocaleString()}</div>
              <div className="text-[10px] text-slate-400">/ {days} days</div>
            </div>
          </div>

          {hasSaving && (
            <div className="text-[11px] text-emerald-300 tabular-nums">
              Save PKR {(Number(pkg.undiscountedPricePkr) - price).toLocaleString()} (
              {Number(pkg.bundleDiscountPercent)}% bundle discount)
            </div>
          )}

          {featureLines.length > 0 && (
            <ul className="space-y-1 pt-2 border-t border-slate-800/80 text-[11px] text-slate-300">
              {featureLines.map((line, idx) => (
                <li key={idx} className="flex items-start gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span className="leading-snug">{line}</span>
                </li>
              ))}
            </ul>
          )}

          {pkg.cvBenefitsEnabled === true && (
            <div className="pt-2 border-t border-slate-800/80 text-[10px] text-indigo-200 leading-snug">
              <strong className="text-indigo-300">Included CV Benefits:</strong>{' '}
              {String(pkg.cvBenefitsDescription || '').trim() ||
                `CVs: ${pkg.cvBenefits?.cvCreateLimit ?? 0} · Edits: ${pkg.cvBenefits?.editLimit ?? 0} · PDF: ${
                  pkg.cvBenefits?.pdfExportLimit ?? 0
                } · ATS: ${pkg.cvBenefits?.atsExportLimit ?? 0}`}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleChoosePlan(pkg.id);
          }}
          className={`w-full py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
            isSelected
              ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
              : 'bg-slate-800 hover:bg-slate-700 text-white'
          }`}
        >
          <span>{coversWithWallet ? 'Select & Activate' : 'Select Plan'}</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/85 backdrop-blur-sm overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Membership and Plans"
    >
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Compact Modal Header */}
        <div className="px-4 py-3.5 sm:px-5 sm:py-4 bg-slate-950 border-b border-slate-800 flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-400">
              <Zap className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">
                {modalCustoms.badgeText ||
                  (whatsappEnabledGlobal ? 'Commercial Services & Plans' : 'Membership & Commercial Plans')}
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-white leading-snug">
              {modalCustoms.title ? (
                modalCustoms.title
              ) : initialSelectedJobTitle ? (
                <>
                  Unlock Access for <span className="text-emerald-400">{initialSelectedJobTitle}</span>
                </>
              ) : (
                'Membership & Commercial Plans'
              )}
            </h2>
            {(stage === 'categories' || stage === 'plans') && (
              <p className="text-[11px] text-slate-400 leading-snug">
                {stage === 'categories'
                  ? 'Select a commercial service category or mega package to view available plans.'
                  : CATEGORY_META[selectedCategory].subtitle}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={handleCloseAll}
            aria-label="Close membership modal"
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
          {/* Logged-in Account & Wallet Strip */}
          {currentUser?.id && stage !== 'activated' && (
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-slate-400">Current Plan:</span>
                <span className="font-semibold text-white truncate">
                  {currentUser.membershipStatus === 'Active' && currentUser.membershipTier
                    ? currentUser.membershipTier
                    : 'Free Tier'}
                </span>
              </div>
              <div className="flex items-center gap-1.5 font-mono tabular-nums shrink-0">
                <Wallet className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-slate-400 text-[11px]">Wallet:</span>
                <span className="font-bold text-emerald-400">PKR {safeWalletBalance.toLocaleString()}</span>
              </div>
            </div>
          )}

          {/* ACTIVATED VIA WALLET SUCCESS VIEW */}
          {stage === 'activated' && walletActivationSummary ? (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-3 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-white">Plan Activated Immediately</h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    {walletActivationSummary.planName} is now active on your account.
                  </p>
                </div>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl divide-y divide-slate-800/80 text-xs">
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-slate-400">Activated Plan</span>
                  <span className="font-semibold text-white">{walletActivationSummary.planName}</span>
                </div>
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-slate-400">Wallet Deducted</span>
                  <span className="font-mono font-bold text-emerald-400 tabular-nums">
                    PKR {walletActivationSummary.amountPaid.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-slate-400">Remaining Wallet Balance</span>
                  <span className="font-mono font-bold text-white tabular-nums">
                    PKR {walletActivationSummary.remainingBalance.toLocaleString()}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCloseAll}
                className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          ) : submittedTx ? (
            /* GUEST SUBMISSION CONFIRMATION VIEW */
            <div className="space-y-4 py-1">
              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
                <Clock className="w-5 h-5 text-amber-400 shrink-0" />
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-white">Payment Proof Submitted</h3>
                  <p className="text-[11px] text-slate-300 mt-0.5 leading-snug">
                    Your request for <strong className="text-emerald-400">{planName}</strong> is pending administrator
                    verification.
                  </p>
                </div>
              </div>

              {syncError && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300 space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-amber-400">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>Subscriber Record Sync Pending</span>
                  </div>
                  <p className="text-[11px]">{syncError}</p>
                  <button
                    type="button"
                    onClick={handleRetrySync}
                    disabled={isRetryingSync}
                    className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer disabled:opacity-50"
                  >
                    {isRetryingSync ? 'Retrying...' : 'Retry Sync'}
                  </button>
                </div>
              )}

              <div className="bg-slate-950 border border-slate-800 rounded-xl divide-y divide-slate-800/80 text-xs">
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-slate-400">TID / Reference</span>
                  <code className="font-mono font-bold text-amber-300">
                    {submittedTx.transactionId || trxId || 'Pending'}
                  </code>
                </div>
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-slate-400">Plan &amp; Fee</span>
                  <span className="font-semibold text-white tabular-nums">
                    {planName} (PKR {amountPaid.toLocaleString()})
                  </span>
                </div>
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-slate-400">Method</span>
                  <span className="font-semibold text-white">{submittedTx.paymentMethod || selectedMethod?.name}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCloseAll}
                className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          ) : stage === 'categories' ? (
            /* STAGE 1: COMMERCIAL SERVICES & PACKAGES CATEGORY HUB */
            isLoadingPackages ? (
              <div className="py-10 text-center space-y-2 bg-slate-950 border border-slate-800 rounded-xl">
                <RefreshCw className="w-5 h-5 animate-spin text-emerald-400 mx-auto" />
                <p className="text-xs text-slate-400">Loading commercial plans...</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* 1. Ads, Banners & Campaigns (with exact 3 sub-options) */}
                  <div
                    className={`p-3.5 rounded-xl bg-slate-950 border ${CATEGORY_META.ads_campaigns.accent} flex flex-col justify-between gap-3 transition-colors`}
                  >
                    <div
                      onClick={() => handleOpenCategory('ads_campaigns', 'all')}
                      className="space-y-2 cursor-pointer"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {CATEGORY_META.ads_campaigns.icon}
                          <h3 className="text-sm font-bold text-white truncate">
                            {CATEGORY_META.ads_campaigns.title}
                          </h3>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                      </div>
                      <p className="text-[11px] text-slate-400 leading-snug">
                        Promote jobs or brands across portal placements &amp; broadcasts.
                      </p>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-slate-800/80">
                      <button
                        type="button"
                        onClick={() => handleOpenCategory('ads_campaigns', 'campaign_ads')}
                        className="px-2 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[10px] font-semibold text-slate-200 text-center transition-colors cursor-pointer truncate"
                      >
                        Campaign Ads
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenCategory('ads_campaigns', 'banners')}
                        className="px-2 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[10px] font-semibold text-slate-200 text-center transition-colors cursor-pointer truncate"
                      >
                        Banners
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenCategory('ads_campaigns', 'advertisements')}
                        className="px-2 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[10px] font-semibold text-slate-200 text-center transition-colors cursor-pointer truncate"
                      >
                        Advertisements
                      </button>
                    </div>
                  </div>

                  {/* 2. Job Posting Plans */}
                  <button
                    type="button"
                    onClick={() => handleOpenCategory('job_posting')}
                    className={`p-3.5 rounded-xl bg-slate-950 border ${CATEGORY_META.job_posting.accent} text-left flex flex-col justify-between gap-3 transition-colors cursor-pointer`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {CATEGORY_META.job_posting.icon}
                          <h3 className="text-sm font-bold text-white truncate">
                            {CATEGORY_META.job_posting.title}
                          </h3>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                      </div>
                      <p className="text-[11px] text-slate-400 leading-snug">
                        Urgent, Featured, Pinned Top #1, Future Intake &amp; VIP posting options.
                      </p>
                    </div>
                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono tabular-nums">
                      <span className="text-sky-300 font-semibold">
                        {categoryCounts.job_posting > 0
                          ? `${categoryCounts.job_posting} Plans`
                          : `${enabledJobTiers.length} Posting Tiers`}
                      </span>
                      <span className="text-slate-400">View Options →</span>
                    </div>
                  </button>

                  {/* 3. Alerts & Early Access */}
                  <button
                    type="button"
                    onClick={() => handleOpenCategory('alerts_early_access')}
                    className={`p-3.5 rounded-xl bg-slate-950 border ${CATEGORY_META.alerts_early_access.accent} text-left flex flex-col justify-between gap-3 transition-colors cursor-pointer`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {CATEGORY_META.alerts_early_access.icon}
                          <h3 className="text-sm font-bold text-white truncate">
                            {CATEGORY_META.alerts_early_access.title}
                          </h3>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                      </div>
                      <p className="text-[11px] text-slate-400 leading-snug">
                        WhatsApp, SMS &amp; Email instant job alerts plus Early Access program.
                      </p>
                    </div>
                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono tabular-nums">
                      <span className="text-emerald-300 font-semibold">
                        {categoryCounts.alerts_early_access} Plans Available
                      </span>
                      <span className="text-slate-400">View Plans →</span>
                    </div>
                  </button>

                  {/* 4. CV Builder & Career Tools */}
                  <button
                    type="button"
                    onClick={() => handleOpenCategory('cv_career')}
                    className={`p-3.5 rounded-xl bg-slate-950 border ${CATEGORY_META.cv_career.accent} text-left flex flex-col justify-between gap-3 transition-colors cursor-pointer`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {CATEGORY_META.cv_career.icon}
                          <h3 className="text-sm font-bold text-white truncate">
                            {CATEGORY_META.cv_career.title}
                          </h3>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                      </div>
                      <p className="text-[11px] text-slate-400 leading-snug">
                        ATS resume export quotas, premium CV templates &amp; watermark-free access.
                      </p>
                    </div>
                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono tabular-nums">
                      <span className="text-indigo-300 font-semibold">
                        {categoryCounts.cv_career > 0 ? `${categoryCounts.cv_career} Plans` : 'Resume Tools'}
                      </span>
                      <span className="text-slate-400">Explore →</span>
                    </div>
                  </button>
                </div>

                {/* 5. Featured All-in-One Mega Packages Card */}
                <button
                  type="button"
                  onClick={() => handleOpenCategory('mega_packages')}
                  className="w-full p-3.5 rounded-xl bg-emerald-500/[0.06] border border-emerald-500/40 hover:border-emerald-400 text-left flex items-center justify-between gap-3 transition-colors cursor-pointer"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      {CATEGORY_META.mega_packages.icon}
                      <h3 className="text-sm font-bold text-white">
                        {CATEGORY_META.mega_packages.title}
                      </h3>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-snug">
                      Combined subscription packages bundling Alerts, Early Access, Job Posting, CV Tools &amp; Ad Credits.
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs font-bold text-emerald-400 font-mono tabular-nums">
                      {categoryCounts.mega_packages} Bundles
                    </div>
                    <div className="text-[10px] text-slate-300 mt-0.5">View All →</div>
                  </div>
                </button>
              </div>
            )
          ) : stage === 'plans' ? (
            /* STAGE 2: PLANS & OPTIONS FOR SELECTED CATEGORY */
            <div className="space-y-3.5">
              <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setErrorMessage('');
                    setStage('categories');
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-200 flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>All Categories</span>
                </button>
                <div className="flex items-center gap-1.5 text-xs font-bold text-white truncate">
                  {CATEGORY_META[selectedCategory].icon}
                  <span className="truncate">{CATEGORY_META[selectedCategory].title}</span>
                </div>
              </div>

              {/* Sub-Option Filter inside Ads, Banners & Campaigns */}
              {selectedCategory === 'ads_campaigns' && (
                <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-slate-950 border border-slate-800">
                  {(
                    [
                      { id: 'all', label: 'All' },
                      { id: 'campaign_ads', label: 'Campaign Ads' },
                      { id: 'banners', label: 'Banners' },
                      { id: 'advertisements', label: 'Advertisements' }
                    ] as Array<{ id: AdSubOption; label: string }>
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setAdSubOption(tab.id)}
                      className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer truncate ${
                        adSubOption === tab.id
                          ? 'bg-emerald-500 text-slate-950 font-bold'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Sub-Option Filter inside Alerts & Early Access */}
              {selectedCategory === 'alerts_early_access' && (
                <div className="grid grid-cols-5 gap-1 p-1 rounded-xl bg-slate-950 border border-slate-800">
                  {(
                    [
                      { id: 'all', label: 'All' },
                      { id: 'whatsapp', label: 'WhatsApp' },
                      { id: 'sms', label: 'SMS' },
                      { id: 'email', label: 'Email' },
                      { id: 'early_access', label: 'Early Access' }
                    ] as Array<{ id: AlertSubOption; label: string }>
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setAlertSubOption(tab.id)}
                      className={`py-1.5 px-1.5 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer truncate ${
                        alertSubOption === tab.id
                          ? 'bg-emerald-500 text-slate-950 font-bold'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Early Access Schedule Info Banner */}
              {selectedCategory === 'alerts_early_access' && pricingData?.earlyAccess?.enabled && (
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-300 flex items-center justify-between gap-2">
                  <span>
                    <strong className="text-emerald-400">Early Access Window:</strong>{' '}
                    {pricingData.earlyAccess.description || 'Access selected jobs before public release.'}
                  </span>
                  <span className="font-mono font-bold text-amber-300 shrink-0 tabular-nums">
                    {Number(pricingData.earlyAccess.durationHours || 24)}h Early
                  </span>
                </div>
              )}

              {/* Selectable Subscription Packages & Add-ons for Chosen Category */}
              {filteredCategoryPackages.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Available Plans &amp; Packages ({filteredCategoryPackages.length})
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {filteredCategoryPackages.map(renderPlanCard)}
                  </div>
                </div>
              )}

              {/* Category-Specific Live Pay-Per-Use Placements (Ads, Banners, Advertisements) */}
              {selectedCategory === 'ads_campaigns' && (
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-xs font-bold text-white">
                        {adSubOption === 'all'
                          ? 'Direct Commercial Placements'
                          : adSubOption === 'campaign_ads'
                          ? 'Campaign Ads Placements'
                          : adSubOption === 'banners'
                          ? 'Banner Placements'
                          : 'Advertisement Display Placements'}
                      </div>
                      <p className="text-[10px] text-slate-400">
                        Pay-per-duration rates configured by Admin for custom campaigns.
                      </p>
                    </div>
                    {onNavigateToCampaigns && selectedPlacementInfo?.durationOptions.length ? (
                      <button
                        type="button"
                        onClick={() => {
                          const selectedIsAvailable = selectedPlacementInfo.durationOptions.some((item: any) => item.id === selectedCampaignDurationPresetId);
                          const packageId = selectedIsAvailable ? selectedCampaignDurationPresetId : selectedPlacementInfo.durationOptions[0].id;
                          onNavigateToCampaigns(initialPlacement, packageId);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-bold shrink-0 cursor-pointer"
                      >
                        Continue with Package →
                      </button>
                    ) : (
                      <span className="rounded-lg border border-amber-500/30 px-3 py-1.5 text-[10px] font-bold text-amber-200 shrink-0">
                        No Package
                      </span>
                    )}
                  </div>

                  {selectedPlacementInfo && (
                    <div className="mb-3 rounded-xl border border-amber-400/40 bg-amber-400/10 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-[10px] font-black uppercase tracking-wide text-amber-300">Selected Ad Placement</div>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <span className="text-xs font-bold text-white">{selectedPlacementInfo.name}</span>
                            {selectedPlacementInfo.badge && (
                              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[9px] font-bold text-amber-200">{selectedPlacementInfo.badge}</span>
                            )}
                          </div>
                          {selectedPlacementInfo.description && (
                            <p className="mt-1 text-[10px] leading-snug text-slate-300">{selectedPlacementInfo.description}</p>
                          )}
                          <p className="mt-1.5 text-[10px] text-slate-300">Only packages enabled by the administrator are listed. The final amount is calculated in campaign setup using the selected package, placement and target pages.</p>
                        </div>
                      </div>
                      {selectedPlacementInfo.durationOptions.length > 0 ? (
                        <div className="mt-3 space-y-1.5">
                          <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Admin-enabled packages</div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            {selectedPlacementInfo.durationOptions.map((duration: any) => (
                              <button
                                type="button"
                                key={duration.id}
                                onClick={() => setSelectedCampaignDurationPresetId(duration.id)}
                                className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-left transition ${selectedCampaignDurationPresetId === duration.id ? 'border-emerald-400/70 bg-emerald-500/10' : 'border-transparent bg-slate-950/70 hover:border-slate-700'}`}
                              >
                                <span className="min-w-0">
                                  <span className="block text-[10px] text-slate-300">{duration.label}</span>
                                  {duration.subLabel && <span className="block text-[9px] text-slate-500">{duration.subLabel}</span>}
                                  {duration.badge && <span className="mt-0.5 inline-block rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[8px] font-bold text-emerald-300">{duration.badge}</span>}
                                </span>
                                <span className="shrink-0 text-right">
                                  <span className="block text-[10px] font-bold text-emerald-300">{selectedCampaignDurationPresetId === duration.id ? 'Selected' : 'Select package'}</span>
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[10px] text-amber-200">
                          No package is currently configured for this ad placement. Please check back later.
                        </p>
                      )}
                    </div>
                  )}

                  <div className="divide-y divide-slate-800/80">
                    {filteredPlacementsForAdSubOption.map((pl) => (
                      <div key={pl.id} className="py-2 flex items-center justify-between gap-2 text-xs">
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-200 truncate">{pl.name}</div>
                          {pl.description && (
                            <div className="text-[10px] text-slate-400 truncate">{pl.description}</div>
                          )}
                        </div>
                        <span className="font-mono font-bold text-emerald-400 text-[10px] tabular-nums shrink-0 text-right">
                          {pl.durationOptions.length ? `${pl.durationOptions.length} admin package${pl.durationOptions.length === 1 ? '' : 's'}` : 'No package configured'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Category-Specific Single Job Posting Rates */}
              {selectedCategory === 'job_posting' && enabledJobTiers.length > 0 && (
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-xs font-bold text-white">Single Job Posting Rates</div>
                      <p className="text-[10px] text-slate-400">
                        Per-job visibility tiers configured for employers.
                      </p>
                    </div>
                    {onNavigateToPostJob && (
                      <button
                        type="button"
                        onClick={onNavigateToPostJob}
                        className="px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-[11px] font-bold shrink-0 cursor-pointer"
                      >
                        Post a Job →
                      </button>
                    )}
                  </div>

                  <div className="divide-y divide-slate-800/80">
                    {enabledJobTiers.map((tier) => (
                      <div key={tier.id} className="py-2 flex items-center justify-between gap-2 text-xs">
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-200 truncate">{tier.name}</div>
                          <div className="text-[10px] text-slate-400 truncate">{tier.desc}</div>
                        </div>
                        <div className="text-right shrink-0 font-mono tabular-nums">
                          <div className="font-bold text-emerald-400 text-[11px]">
                            {tier.feePkr > 0 ? `PKR ${tier.feePkr.toLocaleString()}` : 'Free'}
                          </div>
                          <div className="text-[10px] text-slate-500">{tier.days}d</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* CV Builder Quick Action when viewing CV Career Tools */}
              {selectedCategory === 'cv_career' && onNavigateToCv && (
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2">
                  <div className="text-xs text-slate-300">
                    <strong className="text-white block">Automated ATS CV Builder</strong>
                    <span className="text-[10px] text-slate-400">
                      Build, preview &amp; export professional resumes anytime.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={onNavigateToCv}
                    className="px-3 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white text-[11px] font-bold shrink-0 cursor-pointer"
                  >
                    Open CV Builder →
                  </button>
                </div>
              )}

              {/* Empty Plans Fallback with Direct Link to Mega Packages */}
              {filteredCategoryPackages.length === 0 && (
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs">
                  <span className="text-slate-300">
                    No standalone subscription plans are currently listed under this filter.
                    {categoryCounts.mega_packages > 0 ? ' Check All-in-One Mega Packages for bundled access.' : ''}
                  </span>
                  {selectedCategory !== 'mega_packages' && categoryCounts.mega_packages > 0 && (
                    <button
                      type="button"
                      onClick={() => handleOpenCategory('mega_packages')}
                      className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-[11px] shrink-0 cursor-pointer"
                    >
                      View Mega Packages
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* STAGE 3: CLEAN CHECKOUT FOR SELECTED PLAN */
            <div className="space-y-4">
              {activePackage && (
                <div className="flex items-center justify-between gap-2 p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                      Selected Plan
                    </div>
                    <div className="text-sm font-bold text-white truncate">{planName}</div>
                    <div className="text-[11px] font-mono text-emerald-400 tabular-nums">
                      PKR {amountPaid.toLocaleString()} · {activePackage.durationDays || 30} days
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMessage('');
                      setConfirmWalletPay(false);
                      setStage('plans');
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Change Plan</span>
                  </button>
                </div>
              )}

              {errorMessage && (
                <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {currentUser?.id && activePackage ? (
                <div className="space-y-3">
                  <div className="bg-slate-950 border border-slate-800 rounded-xl divide-y divide-slate-800/80 text-xs">
                    <div className="flex items-center justify-between px-3 py-2.5">
                      <span className="text-slate-400">Plan Fee</span>
                      <span className="font-mono font-bold text-white tabular-nums">
                        PKR {amountPaid.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between px-3 py-2.5">
                      <span className="text-slate-400">Your Wallet Balance</span>
                      <span
                        className={`font-mono font-bold tabular-nums ${
                          isWalletSufficient ? 'text-emerald-400' : 'text-amber-300'
                        }`}
                      >
                        PKR {safeWalletBalance.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between px-3 py-2.5">
                      <span className="text-slate-400">
                        {isWalletSufficient ? 'Remaining After Activation' : 'Shortfall Needed'}
                      </span>
                      <span
                        className={`font-mono font-bold tabular-nums ${
                          isWalletSufficient ? 'text-emerald-400' : 'text-amber-300'
                        }`}
                      >
                        PKR {(isWalletSufficient ? safeWalletBalance - amountPaid : walletShortfall).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {isWalletSufficient ? (
                    <div className="space-y-2.5">
                      {!confirmWalletPay ? (
                        <button
                          type="button"
                          onClick={() => {
                            setErrorMessage('');
                            setConfirmWalletPay(true);
                          }}
                          className="w-full py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Wallet className="w-4 h-4" />
                          <span>Activate Now Using Wallet Balance (PKR {amountPaid.toLocaleString()})</span>
                        </button>
                      ) : (
                        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-2.5">
                          <p className="text-xs text-slate-200 leading-snug">
                            Confirm deducting{' '}
                            <strong className="text-emerald-300 font-mono">
                              PKR {amountPaid.toLocaleString()}
                            </strong>{' '}
                            from your wallet to activate <strong>{planName}</strong> immediately?
                          </p>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setConfirmWalletPay(false)}
                              disabled={isWalletPurchasing}
                              className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={handleWalletPurchase}
                              disabled={isWalletPurchasing}
                              className="flex-1 py-2 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                              {isWalletPurchasing ? (
                                <>
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                  <span>Activating...</span>
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Confirm &amp; Activate</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => setStage('deposit')}
                        className="w-full py-2 px-3 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-[11px] font-semibold text-slate-300 transition-colors cursor-pointer"
                      >
                        Or Deposit Funds Instead
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-200 leading-snug">
                        Deposit funds using your preferred payment method. This plan stays attached to your deposit —
                        once verified by admin, your wallet will be credited and <strong>{planName}</strong> activates
                        automatically if total balance covers{' '}
                        <strong className="font-mono">PKR {amountPaid.toLocaleString()}</strong>.
                      </div>
                      <button
                        type="button"
                        onClick={() => setStage('deposit')}
                        className="w-full py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <span>Proceed to Deposit Funds</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <form onSubmit={handleGuestSubmit} className="space-y-3.5">
                  {isLoadingSettings ? (
                    <div className="py-6 text-center text-slate-400 space-y-2">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto text-emerald-400" />
                      <p className="text-xs">Loading payment methods...</p>
                    </div>
                  ) : !isSettingsConfigured || enabledMethods.length === 0 ? (
                    <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300 space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-amber-400">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>Payment Submission Temporarily Unavailable</span>
                      </div>
                      <p className="text-[11px]">
                        Administrator receiving payment accounts are currently unconfigured.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1.5">
                          Payment Method
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {enabledMethods.map(([key, method]) => (
                            <button
                              key={key}
                              type="button"
                              onClick={() => setSelectedMethodKey(key)}
                              className={`py-2 px-2 text-xs font-bold rounded-lg border text-center transition-colors cursor-pointer ${
                                selectedMethodKey === key || (!selectedMethodKey && enabledMethods[0][0] === key)
                                  ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                                  : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                              }`}
                            >
                              {method.name}
                            </button>
                          ))}
                        </div>
                      </div>

                      {selectedMethod && (
                        <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs space-y-1.5">
                          <div className="flex items-center justify-between font-bold text-amber-300 pb-1.5 border-b border-slate-800">
                            <span className="flex items-center gap-1.5">
                              {selectedMethod.id === 'bank' ? (
                                <Building className="w-3.5 h-3.5 text-indigo-400" />
                              ) : (
                                <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                              )}
                              <span>{selectedMethod.heading || selectedMethod.name}</span>
                            </span>
                            <span className="text-emerald-400 font-mono tabular-nums">
                              PKR {amountPaid.toLocaleString()}
                            </span>
                          </div>
                          {selectedMethod.bankName && (
                            <div className="text-[11px] text-slate-400">
                              Bank: <strong className="text-white">{selectedMethod.bankName}</strong>
                            </div>
                          )}
                          <div className="text-[11px] text-slate-400">
                            Account Title: <strong className="text-white">{selectedMethod.accountTitle}</strong>
                          </div>
                          <div className="flex items-center justify-between gap-2 text-[11px] text-slate-300">
                            <span>
                              Account No.:{' '}
                              <strong className="text-emerald-400 font-mono select-all">
                                {selectedMethod.accountNumber}
                              </strong>
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopyGuestText(selectedMethod.accountNumber, 'account')}
                              className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-200 inline-flex items-center gap-1 cursor-pointer"
                            >
                              {copiedGuestField === 'account' ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                              <span>{copiedGuestField === 'account' ? 'Copied' : 'Copy'}</span>
                            </button>
                          </div>
                          {selectedMethod.iban && (
                            <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400">
                              <span className="truncate">
                                IBAN: <span className="text-indigo-300 font-mono select-all">{selectedMethod.iban}</span>
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopyGuestText(selectedMethod.iban!, 'iban')}
                                className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-200 inline-flex items-center gap-1 cursor-pointer shrink-0"
                              >
                                {copiedGuestField === 'iban' ? (
                                  <Check className="w-3 h-3 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                                <span>{copiedGuestField === 'iban' ? 'Copied' : 'Copy'}</span>
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-300 mb-1">Full Name *</label>
                          <input
                            type="text"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Muhammad Ali"
                            className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-white text-xs focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-300 mb-1">Email Address *</label>
                          <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="ali@example.com"
                            className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-white text-xs focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                        {whatsappEnabledGlobal && (
                          <div className="sm:col-span-2">
                            <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                              WhatsApp Phone Number *
                            </label>
                            <input
                              type="tel"
                              required={whatsappEnabledGlobal}
                              value={phone}
                              onChange={(e) => setPhone(e.target.value)}
                              placeholder="+92 300 1234567"
                              className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-white text-xs focus:outline-none focus:border-emerald-500"
                            />
                          </div>
                        )}
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                            {selectedMethod?.senderNameLabel || 'Sender Name'}
                            {selectedMethod?.senderNameRequired && ' *'}
                          </label>
                          <input
                            type="text"
                            required={selectedMethod?.senderNameRequired}
                            value={senderName}
                            onChange={(e) => setSenderName(e.target.value)}
                            placeholder="Account title"
                            className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-white text-xs focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                            {selectedMethod?.senderPhoneLabel || 'Sender Number'}
                            {selectedMethod?.senderPhoneRequired && ' *'}
                          </label>
                          <input
                            type="text"
                            required={selectedMethod?.senderPhoneRequired}
                            value={senderPhone}
                            onChange={(e) => setSenderPhone(e.target.value)}
                            placeholder={selectedMethod?.senderPhonePlaceholder || '0300-1234567'}
                            className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-white text-xs focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                            {selectedMethod?.transactionIdLabel || 'Transaction ID (TID)'}
                            {selectedMethod?.transactionIdRequired && ' *'}
                          </label>
                          <input
                            type="text"
                            required={selectedMethod?.transactionIdRequired}
                            value={trxId}
                            onChange={(e) => setTrxId(e.target.value)}
                            placeholder={selectedMethod?.transactionIdPlaceholder || 'e.g. 11-digit TID'}
                            className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-white text-xs font-mono focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                            {selectedMethod?.screenshotLabel || 'Receipt Screenshot'}
                            {selectedMethod?.screenshotRequired && ' *'}
                          </label>
                          <label className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-950 border border-dashed border-slate-700 hover:border-emerald-500 rounded-lg cursor-pointer text-xs text-slate-300">
                            <Upload className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="truncate">{proofScreenshotUrl ? 'Replace Image' : 'Attach Receipt'}</span>
                            <input type="file" accept="image/*" onChange={handleImageFileChange} className="hidden" />
                          </label>
                        </div>
                      </div>

                      {selectedMethod?.customFields && selectedMethod.customFields.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-slate-800">
                          {selectedMethod.customFields.map((cf) => (
                            <div key={cf.id}>
                              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                                {cf.label}
                                {cf.required && ' *'}
                              </label>
                              <input
                                type={cf.type === 'number' ? 'number' : 'text'}
                                required={cf.required}
                                value={customFieldValues[cf.id] || ''}
                                onChange={(e) =>
                                  setCustomFieldValues((prev) => ({ ...prev, [cf.id]: e.target.value }))
                                }
                                placeholder={cf.placeholder || cf.label}
                                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-white text-xs focus:outline-none focus:border-emerald-500"
                              />
                            </div>
                          ))}
                        </div>
                      )}

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                          {selectedMethod?.proofNoteLabel || 'Deposit Note (Optional)'}
                          {selectedMethod?.proofNoteRequired && ' *'}
                        </label>
                        <input
                          type="text"
                          required={selectedMethod?.proofNoteRequired}
                          value={proofNote}
                          onChange={(e) => setProofNote(e.target.value)}
                          placeholder={selectedMethod?.proofNotePlaceholder || 'Short note if needed'}
                          className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-white text-xs focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        <span>
                          {isSubmitting
                            ? 'Submitting Proof...'
                            : modalCustoms.submitCta || `Submit Payment Proof (PKR ${amountPaid.toLocaleString()})`}
                        </span>
                      </button>

                      <p className="text-[10px] text-center text-slate-500 flex items-center justify-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-emerald-400" />
                        <span>All manual submissions require admin verification before activation.</span>
                      </p>
                    </>
                  )}
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
