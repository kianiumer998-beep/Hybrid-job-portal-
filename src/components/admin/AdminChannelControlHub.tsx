import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Bell,
  CheckCircle2,
  Clock,
  Layers,
  Lock,
  Mail,
  Megaphone,
  MessageCircle,
  Package,
  Plus,
  RefreshCw,
  Save,
  Send,
  ShieldCheck,
  Sliders,
  Smartphone,
  Sparkles,
  Trash2
} from 'lucide-react';
import { api } from '../../services/api';
import { AdminFeatureFlags, Job, Subscriber, UserAccount } from '../../types/job';
import {
  Advertisement,
  AdPricingConfig,
  CampaignCustomizationConfig,
  DEFAULT_AD_PRICING_CONFIG,
  DEFAULT_CAMPAIGN_CUSTOMIZATION_CONFIG,
  DEFAULT_PLACEMENT_OPTIONS,
  CampaignPlacementOption
} from '../../types/ad';
import {
  BroadcastCampaign,
  CommunicationProviderConfig,
  EmailProviderType,
  SafeCommunicationProviderConfig,
  UpdateCommunicationProviderPayload,
  WhatsAppProviderType
} from '../../types/adminSuite';
import { WhatsAppSupportConfig } from '../WhatsAppStickyButton';
import { AdminWhatsAppManager } from './AdminWhatsAppManager';
import { AdminBroadcastCenter } from './AdminBroadcastCenter';
import { AdminMasterRuleEngine } from './AdminMasterRuleEngine';

export type AdminChannelKey = 'whatsapp' | 'email' | 'sms' | 'combined';
type SingleChannelKey = 'whatsapp' | 'email' | 'sms';
type ChannelSubTab = 'pricing' | 'broadcast' | 'widget' | 'gateway' | 'rule-engine';

interface AdminChannelControlHubProps {
  activeChannel: AdminChannelKey;
  featureFlags: AdminFeatureFlags;
  onToggleFeatureFlag: (flagKey: keyof AdminFeatureFlags) => Promise<void> | void;
  whatsAppConfig: WhatsAppSupportConfig;
  onUpdateWhatsAppConfig: (updated: WhatsAppSupportConfig) => Promise<any> | boolean | void;
  subscribersCount?: number;
  adPricingConfig?: AdPricingConfig;
  onUpdatePricingConfig?: (config: AdPricingConfig) => void | Promise<unknown>;
  campaignConfig?: CampaignCustomizationConfig;
  onUpdateCampaignConfig?: (config: CampaignCustomizationConfig) => void | Promise<unknown>;
  onSyncAuthoritativePricing?: (pricing: any) => void;
  onUpdateCommConfig?: (updated: CommunicationProviderConfig) => void;
  canManagePricing: boolean;
  canManageSettings: boolean;
  canManageAds: boolean;
  broadcastCampaigns?: BroadcastCampaign[];
  users?: UserAccount[];
  subscribers?: Subscriber[];
  jobs?: Job[];
  ads?: Advertisement[];
  commConfig?: CommunicationProviderConfig;
  isBroadcastLoading?: boolean;
  broadcastLoadError?: string | null;
  broadcastMigrationError?: string | null;
  onSendBroadcastCampaign?: (newCampaign: Partial<BroadcastCampaign>) => Promise<{ success: boolean; campaign?: BroadcastCampaign; error?: string } | boolean | void> | void;
  onCampaignUpdated?: (campaign: BroadcastCampaign) => void;
  onRefreshBroadcastCampaigns?: () => void;
  onOpenBroadcast?: (subTab: 'compose' | 'history') => void;
}

const CHANNEL_CATALOG_ID: Record<SingleChannelKey, 'whatsapp_alerts' | 'email_alerts' | 'sms_alerts'> = {
  whatsapp: 'whatsapp_alerts',
  email: 'email_alerts',
  sms: 'sms_alerts'
};

const CHANNEL_FLAG_KEY: Record<SingleChannelKey, keyof AdminFeatureFlags> = {
  whatsapp: 'enableWhatsAppAlerts',
  email: 'enableEmailAlerts',
  sms: 'enableSmsAlerts'
};

const isWholeNumberInRange = (val: unknown, min: number, max: number) => {
  if (typeof val === 'string' && val.trim() === '') return false;
  const parsed = Number(val);
  return Number.isSafeInteger(parsed) && parsed >= min && parsed <= max;
};

const isFiniteNumberInRange = (val: unknown, min: number, max: number) => {
  if (typeof val === 'string' && val.trim() === '') return false;
  const parsed = Number(val);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max;
};

const buildDefaultSmsPlacement = (): CampaignPlacementOption =>
  DEFAULT_PLACEMENT_OPTIONS.find((item) => item.id === 'sms-broadcast') || {
    id: 'sms-broadcast',
    name: 'Direct SMS Text Message Broadcast',
    description: 'Targeted plain-text SMS broadcast sent directly to opt-in subscriber phones.',
    type: 'sms',
    multiplier: 1.1,
    iconName: 'Smartphone',
    badge: 'Direct Blast',
    isEnabled: true,
    maxConcurrentSlots: 3,
    allowedPageIds: ['all']
  };

export const AdminChannelControlHub: React.FC<AdminChannelControlHubProps> = ({
  activeChannel,
  featureFlags,
  onToggleFeatureFlag,
  whatsAppConfig,
  onUpdateWhatsAppConfig,
  subscribersCount = 0,
  adPricingConfig,
  onUpdatePricingConfig,
  campaignConfig,
  onUpdateCampaignConfig,
  onSyncAuthoritativePricing,
  onUpdateCommConfig,
  canManagePricing,
  canManageSettings,
  canManageAds,
  broadcastCampaigns = [],
  users = [],
  subscribers = [],
  jobs = [],
  ads = [],
  commConfig,
  isBroadcastLoading = false,
  broadcastLoadError = null,
  broadcastMigrationError = null,
  onSendBroadcastCampaign,
  onCampaignUpdated,
  onRefreshBroadcastCampaigns
}) => {
  const [subTab, setSubTab] = useState<ChannelSubTab>(activeChannel === 'combined' ? 'rule-engine' : 'pricing');
  const [broadcastInitialTab, setBroadcastInitialTab] = useState<'compose' | 'history'>('compose');
  const [isTogglingFlag, setIsTogglingFlag] = useState(false);
  const [gatewayChannelChoice, setGatewayChannelChoice] = useState<SingleChannelKey>('whatsapp');

  // Reset invalid sub-tab when switching channels
  useEffect(() => {
    if (activeChannel === 'combined') {
      if (subTab !== 'rule-engine' && subTab !== 'broadcast' && subTab !== 'gateway') {
        setSubTab('rule-engine');
      }
    } else {
      if (subTab === 'rule-engine' || (subTab === 'widget' && activeChannel !== 'whatsapp')) {
        setSubTab('pricing');
      }
    }
    setPricingError('');
    setPricingSuccess('');
    setSmsAdSaveError('');
    setSmsAdSaveSuccess('');
    setProviderSaveError(null);
    setProviderSaveSuccess(false);
    setProviderTestMessage(null);
    setProviderTestError(null);
  }, [activeChannel]);

  // --- Authoritative Pricing, Quotas, Reminders & Channel Packages State ---
  const [pricing, setPricing] = useState<any>(null);
  const [pricingLoading, setPricingLoading] = useState(true);
  const [pricingSaving, setPricingSaving] = useState(false);
  const [pricingError, setPricingError] = useState('');
  const [pricingSuccess, setPricingSuccess] = useState('');

  const loadAuthoritativePricing = async () => {
    setPricingLoading(true);
    setPricingError('');
    try {
      const res = await api.pricing.get();
      if (!res?.success || !res.pricing) {
        throw new Error(res?.message || 'Could not load channel rates & packages.');
      }
      setPricing(res.pricing);
    } catch (err: any) {
      setPricingError(err?.message || 'Failed to load channel pricing configuration.');
    } finally {
      setPricingLoading(false);
    }
  };

  useEffect(() => {
    loadAuthoritativePricing();
  }, []);

  const catalog = useMemo(
    () => (Array.isArray(pricing?.subscriptionFeatureCatalog) ? pricing.subscriptionFeatureCatalog : []),
    [pricing]
  );
  const allPackages = useMemo(
    () => (Array.isArray(pricing?.subscriptionPackages) ? pricing.subscriptionPackages : []),
    [pricing]
  );
  const singleChannelKey: SingleChannelKey = activeChannel === 'combined' ? 'whatsapp' : activeChannel;
  const featureId = CHANNEL_CATALOG_ID[singleChannelKey];
  const channelCatalogFeature = useMemo(
    () => catalog.find((item: any) => item.id === featureId) || null,
    [catalog, featureId]
  );
  const channelPackages = useMemo(
    () =>
      allPackages.filter((pkg: any) => Array.isArray(pkg?.featureIds) && pkg.featureIds.includes(featureId)),
    [allPackages, featureId]
  );
  const reminderSettings = useMemo(() => {
    const raw = pricing?.subscriptionReminderSettings || {};
    const baseDays = Number.isInteger(Number(raw.daysBefore)) ? Number(raw.daysBefore) : 3;
    return {
      enabled: raw.enabled === true,
      daysBefore: baseDays,
      inAppEnabled: raw.inAppEnabled !== undefined ? raw.inAppEnabled === true : raw.enabled !== false,
      inAppDaysBefore: Number.isInteger(Number(raw.inAppDaysBefore)) ? Number(raw.inAppDaysBefore) : baseDays,
      emailEnabled: raw.emailEnabled !== undefined ? raw.emailEnabled === true : raw.enabled === true,
      emailDaysBefore: Number.isInteger(Number(raw.emailDaysBefore)) ? Number(raw.emailDaysBefore) : baseDays,
      whatsappEnabled: raw.whatsappEnabled === true,
      whatsappDaysBefore: Number.isInteger(Number(raw.whatsappDaysBefore)) ? Number(raw.whatsappDaysBefore) : baseDays,
      smsEnabled: raw.smsEnabled === true,
      smsDaysBefore: Number.isInteger(Number(raw.smsDaysBefore)) ? Number(raw.smsDaysBefore) : baseDays
    };
  }, [pricing]);

  const updateCatalogFeatureField = (field: string, value: any) => {
    setPricing((prev: any) => {
      if (!prev) return prev;
      const existingCatalog = Array.isArray(prev.subscriptionFeatureCatalog) ? [...prev.subscriptionFeatureCatalog] : [];
      const idx = existingCatalog.findIndex((item: any) => item.id === featureId);
      if (idx >= 0) {
        existingCatalog[idx] = { ...existingCatalog[idx], [field]: value };
      } else {
        existingCatalog.push({
          id: featureId,
          label: activeChannel === 'whatsapp' ? 'WhatsApp Alerts' : activeChannel === 'email' ? 'Email Alerts' : 'SMS Alerts',
          enabled: false,
          pricePkr: 300,
          durationDays: 30,
          unlimitedMessages: false,
          monthlyMessageQuota: 50,
          [field]: value
        });
      }
      return { ...prev, subscriptionFeatureCatalog: existingCatalog };
    });
  };

  const updatePackageById = (pkgId: string, updater: (pkg: any) => any) => {
    setPricing((prev: any) => {
      if (!prev) return prev;
      const list = Array.isArray(prev.subscriptionPackages) ? prev.subscriptionPackages : [];
      return {
        ...prev,
        subscriptionPackages: list.map((item: any) => (item.id === pkgId ? updater(item) : item))
      };
    });
  };

  const handleAddChannelPackage = () => {
    const channelLabel = activeChannel === 'whatsapp' ? 'WhatsApp' : activeChannel === 'email' ? 'Email' : 'SMS';
    const basePrice = Math.max(0, Number(channelCatalogFeature?.pricePkr ?? 300) || 0);
    const baseDuration = Math.max(1, Number(channelCatalogFeature?.durationDays ?? 30) || 30);
    const baseQuota = Math.max(1, Number(channelCatalogFeature?.monthlyMessageQuota ?? 50) || 50);
    const newPkg = {
      id: `pkg-${activeChannel}-${Date.now()}`,
      name: `${channelLabel} Alerts Plan`,
      badge: `${channelLabel} Pro`,
      description: `Automated ${channelLabel} job alerts with configurable monthly quota.`,
      enabled: true,
      popular: false,
      pricingMode: channelCatalogFeature?.enabled === true ? 'catalog' : 'fixed',
      configuredPricePkr: basePrice,
      pricePkr: basePrice,
      durationDays: baseDuration,
      bundleDiscountPercent: 0,
      featureIds: [featureId],
      featureOverrides: {
        [featureId]: {
          pricePkr: basePrice,
          durationDays: baseDuration,
          unlimitedMessages: Boolean(channelCatalogFeature?.unlimitedMessages),
          monthlyMessageQuota: baseQuota
        }
      },
      features: [
        channelCatalogFeature?.unlimitedMessages
          ? `Unlimited ${channelLabel} alerts`
          : `${baseQuota} ${channelLabel} alerts / month`,
        `${baseDuration}-day active validity`
      ]
    };

    setPricing((prev: any) => {
      if (!prev) return prev;
      const list = Array.isArray(prev.subscriptionPackages) ? prev.subscriptionPackages : [];
      return { ...prev, subscriptionPackages: [...list, newPkg] };
    });
  };

  const handleRemovePackage = (pkgId: string) => {
    setPricing((prev: any) => {
      if (!prev) return prev;
      const list = Array.isArray(prev.subscriptionPackages) ? prev.subscriptionPackages : [];
      return { ...prev, subscriptionPackages: list.filter((p: any) => p.id !== pkgId) };
    });
  };

  const handleSaveChannelRatesAndPackages = async () => {
    if (!pricing || !canManagePricing) return;
    setPricingError('');
    setPricingSuccess('');

    for (const feature of catalog) {
      if (
        !isWholeNumberInRange(feature.pricePkr ?? 0, 0, Number.MAX_SAFE_INTEGER) ||
        !isWholeNumberInRange(feature.durationDays ?? 30, 1, 3650)
      ) {
        setPricingError(`"${feature.label || feature.id}" requires a valid whole PKR rate and duration (1–3650 days).`);
        return;
      }
      if (
        feature.enabled === true &&
        ['email_alerts', 'whatsapp_alerts', 'sms_alerts'].includes(feature.id) &&
        feature.unlimitedMessages !== true &&
        !isWholeNumberInRange(feature.monthlyMessageQuota, 1, 1000000)
      ) {
        setPricingError(`"${feature.label || feature.id}" requires Unlimited or a monthly quota between 1 and 1,000,000.`);
        return;
      }
    }

    for (const pkg of allPackages) {
      if (!String(pkg.name || '').trim()) {
        setPricingError('Every package must have a valid name.');
        return;
      }
      if (!isWholeNumberInRange(pkg.durationDays, 1, 3650)) {
        setPricingError(`"${pkg.name}" duration must be between 1 and 3650 days.`);
        return;
      }
      const rawPrice = pkg.configuredPricePkr ?? pkg.pricePkr;
      if (!isWholeNumberInRange(rawPrice, 0, Number.MAX_SAFE_INTEGER)) {
        setPricingError(`"${pkg.name}" price must be a valid whole PKR amount.`);
        return;
      }
      if (pkg.bundleDiscountPercent !== undefined && !isFiniteNumberInRange(pkg.bundleDiscountPercent, 0, 100)) {
        setPricingError(`"${pkg.name}" discount must be between 0 and 100%.`);
        return;
      }
      const override = pkg.featureOverrides?.[featureId];
      if (override && override.unlimitedMessages === false && !isWholeNumberInRange(override.monthlyMessageQuota, 1, 1000000)) {
        setPricingError(`"${pkg.name}" message quota must be between 1 and 1,000,000.`);
        return;
      }
    }

    if (!isFiniteNumberInRange(pricing.subscriptionBundleDiscountPercent ?? 0, 0, 100)) {
      setPricingError('Global bundle discount must be between 0 and 100%.');
      return;
    }

    if (
      !isWholeNumberInRange(reminderSettings.daysBefore, 1, 30) ||
      !isWholeNumberInRange(reminderSettings.inAppDaysBefore, 1, 30) ||
      !isWholeNumberInRange(reminderSettings.emailDaysBefore, 1, 30) ||
      !isWholeNumberInRange(reminderSettings.whatsappDaysBefore, 1, 30) ||
      !isWholeNumberInRange(reminderSettings.smsDaysBefore, 1, 30)
    ) {
      setPricingError('All expiry reminder lead times must be between 1 and 30 days.');
      return;
    }

    const anyReminderActive =
      reminderSettings.inAppEnabled ||
      reminderSettings.emailEnabled ||
      reminderSettings.whatsappEnabled ||
      reminderSettings.smsEnabled;

    setPricingSaving(true);
    try {
      const payload = {
        subscriptionFeatureCatalog: catalog,
        subscriptionPackages: allPackages,
        subscriptionBundleDiscountPercent: Number(pricing.subscriptionBundleDiscountPercent ?? 0),
        subscriptionReminderSettings: {
          ...reminderSettings,
          enabled: anyReminderActive,
          daysBefore: Number(reminderSettings.inAppDaysBefore ?? reminderSettings.daysBefore ?? 3)
        }
      };
      const result = await api.pricing.update(payload);
      if (!result?.success) {
        throw new Error(result?.message || 'Failed to persist channel pricing & packages.');
      }
      const authoritative = result.pricing || { ...pricing, ...payload };
      setPricing((prev: any) => ({ ...prev, ...authoritative }));
      onSyncAuthoritativePricing?.(authoritative);
      setPricingSuccess('Rates, quotas, and packages saved to authoritative backend pricing.');
    } catch (err: any) {
      setPricingError(err?.message || 'Could not save channel pricing settings.');
    } finally {
      setPricingSaving(false);
    }
  };

  // --- SMS Direct Broadcast Ad Placement & Rate Config State ---
  const [smsPerContactRate, setSmsPerContactRate] = useState<number>(
    adPricingConfig?.smsPerContactRatePkr ?? DEFAULT_AD_PRICING_CONFIG.smsPerContactRatePkr
  );
  const [allowDirectSmsAds, setAllowDirectSmsAds] = useState<boolean>(
    campaignConfig?.formRules?.allowDirectSms !== false
  );
  const [smsPlacementDraft, setSmsPlacementDraft] = useState<CampaignPlacementOption>(() => {
    const existing = campaignConfig?.placementOptions?.find((p) => p.id === 'sms-broadcast');
    return existing ? { ...existing } : buildDefaultSmsPlacement();
  });
  const [smsAdSaving, setSmsAdSaving] = useState(false);
  const [smsAdSaveError, setSmsAdSaveError] = useState('');
  const [smsAdSaveSuccess, setSmsAdSaveSuccess] = useState('');

  useEffect(() => {
    setSmsPerContactRate(adPricingConfig?.smsPerContactRatePkr ?? DEFAULT_AD_PRICING_CONFIG.smsPerContactRatePkr);
  }, [adPricingConfig]);

  useEffect(() => {
    const currentCampaign = campaignConfig || DEFAULT_CAMPAIGN_CUSTOMIZATION_CONFIG;
    setAllowDirectSmsAds(currentCampaign.formRules?.allowDirectSms !== false);
    const existing = currentCampaign.placementOptions?.find((p) => p.id === 'sms-broadcast');
    setSmsPlacementDraft(existing ? { ...existing } : buildDefaultSmsPlacement());
  }, [campaignConfig]);

  const handleSaveSmsAdConfig = async () => {
    if (!canManageAds && !canManagePricing) return;
    if (!Number.isFinite(smsPerContactRate) || smsPerContactRate < 0.1 || smsPerContactRate > 1000) {
      setSmsAdSaveError('Per-contact SMS rate must be between 0.1 and 1000 PKR.');
      return;
    }
    if (!Number.isFinite(smsPlacementDraft.multiplier) || smsPlacementDraft.multiplier <= 0) {
      setSmsAdSaveError('SMS placement multiplier must be greater than 0.');
      return;
    }

    setSmsAdSaving(true);
    setSmsAdSaveError('');
    setSmsAdSaveSuccess('');

    try {
      const currentCampaign = campaignConfig || DEFAULT_CAMPAIGN_CUSTOMIZATION_CONFIG;
      const existingOptions = Array.isArray(currentCampaign.placementOptions)
        ? [...currentCampaign.placementOptions]
        : [...DEFAULT_PLACEMENT_OPTIONS];
      const idx = existingOptions.findIndex((p) => p.id === 'sms-broadcast');
      if (idx >= 0) {
        existingOptions[idx] = { ...smsPlacementDraft };
      } else {
        existingOptions.push({ ...smsPlacementDraft });
      }

      const nextCampaignConfig: CampaignCustomizationConfig = {
        ...currentCampaign,
        placementOptions: existingOptions,
        formRules: {
          ...currentCampaign.formRules,
          allowDirectSms: allowDirectSmsAds
        }
      };

      const currentPricing = adPricingConfig || DEFAULT_AD_PRICING_CONFIG;
      const nextPricingConfig: AdPricingConfig = {
        ...currentPricing,
        smsPerContactRatePkr: Number(smsPerContactRate),
        placementMultipliers: {
          ...currentPricing.placementMultipliers,
          'sms-broadcast': Number(smsPlacementDraft.multiplier)
        }
      };

      if (onUpdateCampaignConfig) {
        const res = await onUpdateCampaignConfig(nextCampaignConfig);
        if (res && typeof res === 'object' && 'success' in res && (res as any).success === false) {
          throw new Error((res as any).message || 'Failed to save SMS placement configuration.');
        }
      }
      if (onUpdatePricingConfig) {
        const res = await onUpdatePricingConfig(nextPricingConfig);
        if (res && typeof res === 'object' && 'success' in res && (res as any).success === false) {
          throw new Error((res as any).message || 'Failed to save SMS contact rate.');
        }
      }
      setSmsAdSaveSuccess('Direct SMS Ad placement & per-contact rate saved.');
    } catch (err: any) {
      setSmsAdSaveError(err?.message || 'Error saving SMS Ad slot settings.');
    } finally {
      setSmsAdSaving(false);
    }
  };

  // --- Encrypted Provider Gateway, Test Connection & Delivery Logs State ---
  const [safeProviderConfig, setSafeProviderConfig] = useState<SafeCommunicationProviderConfig>({
    emailProvider: 'smtp',
    smtpHost: '',
    smtpPort: 587,
    smtpUser: '',
    smtpSenderEmail: '',
    whatsappProvider: 'meta-cloud',
    smsProvider: 'disabled',
    smsFromNumber: '',
    whatsappPhoneNumberId: '',
    whatsappBusinessAccountId: '',
    twilioAccountSid: '',
    twilioPhoneNumber: '',
    smtpPasswordConfigured: false,
    sendgridApiKeyConfigured: false,
    resendApiKeyConfigured: false,
    whatsappCloudApiTokenConfigured: false,
    twilioAuthTokenConfigured: false
  });
  const [emailProvider, setEmailProvider] = useState<EmailProviderType>('smtp');
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState<number>(587);
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpSenderEmail, setSmtpSenderEmail] = useState('');
  const [whatsappProvider, setWhatsappProvider] = useState<WhatsAppProviderType>('meta-cloud');
  const [smsProvider, setSmsProvider] = useState<'disabled' | 'twilio'>('disabled');
  const [smsFromNumber, setSmsFromNumber] = useState('');
  const [whatsappPhoneNumberId, setWhatsappPhoneNumberId] = useState('');
  const [whatsappBusinessAccountId, setWhatsappBusinessAccountId] = useState('');
  const [twilioAccountSid, setTwilioAccountSid] = useState('');
  const [twilioPhoneNumber, setTwilioPhoneNumber] = useState('');

  const [smtpPasswordInput, setSmtpPasswordInput] = useState('');
  const [sendgridApiKeyInput, setSendgridApiKeyInput] = useState('');
  const [resendApiKeyInput, setResendApiKeyInput] = useState('');
  const [whatsappCloudApiTokenInput, setWhatsappCloudApiTokenInput] = useState('');
  const [twilioAuthTokenInput, setTwilioAuthTokenInput] = useState('');
  const [clearSecrets, setClearSecrets] = useState<
    Array<'smtpPassword' | 'sendgridApiKey' | 'resendApiKey' | 'whatsappCloudApiToken' | 'twilioAuthToken'>
  >([]);

  const [isLoadingProviders, setIsLoadingProviders] = useState(false);
  const [isProviderSaving, setIsProviderSaving] = useState(false);
  const [providerSaveSuccess, setProviderSaveSuccess] = useState(false);
  const [providerSaveError, setProviderSaveError] = useState<string | null>(null);
  const [testRecipient, setTestRecipient] = useState('');
  const [isProviderTesting, setIsProviderTesting] = useState(false);
  const [providerTestMessage, setProviderTestMessage] = useState<string | null>(null);
  const [providerTestError, setProviderTestError] = useState<string | null>(null);
  const [deliveryLogs, setDeliveryLogs] = useState<any[]>([]);

  const loadProviderConfig = async () => {
    setIsLoadingProviders(true);
    setProviderSaveError(null);
    try {
      const [res, logsRes] = await Promise.all([
        api.communicationProviders.get(),
        api.communicationProviders.logs(50).catch(() => null)
      ]);
      if (logsRes?.success && Array.isArray(logsRes.logs)) {
        setDeliveryLogs(logsRes.logs);
      }
      if (res?.success && res.config) {
        const cfg = res.config;
        setSafeProviderConfig(cfg);
        setEmailProvider(cfg.emailProvider || 'smtp');
        setSmtpHost(cfg.smtpHost || '');
        setSmtpPort(cfg.smtpPort || 587);
        setSmtpUser(cfg.smtpUser || '');
        setSmtpSenderEmail(cfg.smtpSenderEmail || '');
        setWhatsappProvider(cfg.whatsappProvider || 'meta-cloud');
        setSmsProvider(cfg.smsProvider || 'disabled');
        setSmsFromNumber(cfg.smsFromNumber || '');
        setWhatsappPhoneNumberId(cfg.whatsappPhoneNumberId || '');
        setWhatsappBusinessAccountId(cfg.whatsappBusinessAccountId || '');
        setTwilioAccountSid(cfg.twilioAccountSid || '');
        setTwilioPhoneNumber(cfg.twilioPhoneNumber || '');
      }
    } catch (err: any) {
      setProviderSaveError(err?.message || 'Unable to load gateway configuration.');
    } finally {
      setIsLoadingProviders(false);
    }
  };

  useEffect(() => {
    if (canManageSettings) {
      loadProviderConfig();
    }
  }, [canManageSettings]);

  const handleToggleClearSecret = (
    key: 'smtpPassword' | 'sendgridApiKey' | 'resendApiKey' | 'whatsappCloudApiToken' | 'twilioAuthToken'
  ) => {
    setClearSecrets((prev) => (prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]));
  };

  const handleSaveProviders = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageSettings) return;
    setIsProviderSaving(true);
    setProviderSaveError(null);
    setProviderSaveSuccess(false);

    const payload: UpdateCommunicationProviderPayload = {
      emailProvider,
      smtpHost: smtpHost.trim(),
      smtpPort: Number(smtpPort) || 587,
      smtpUser: smtpUser.trim(),
      smtpSenderEmail: smtpSenderEmail.trim(),
      whatsappProvider,
      smsProvider,
      smsFromNumber: smsFromNumber.trim(),
      whatsappPhoneNumberId: whatsappPhoneNumberId.trim(),
      whatsappBusinessAccountId: whatsappBusinessAccountId.trim(),
      twilioAccountSid: twilioAccountSid.trim(),
      twilioPhoneNumber: twilioPhoneNumber.trim(),
      smtpPassword: smtpPasswordInput.trim() || undefined,
      sendgridApiKey: sendgridApiKeyInput.trim() || undefined,
      resendApiKey: resendApiKeyInput.trim() || undefined,
      whatsappCloudApiToken: whatsappCloudApiTokenInput.trim() || undefined,
      twilioAuthToken: twilioAuthTokenInput.trim() || undefined,
      clearSecrets: clearSecrets.length > 0 ? clearSecrets : undefined
    };

    try {
      const res = await api.communicationProviders.update(payload);
      if (res?.success && res.config) {
        setSafeProviderConfig(res.config);
        setSmtpPasswordInput('');
        setSendgridApiKeyInput('');
        setResendApiKeyInput('');
        setWhatsappCloudApiTokenInput('');
        setTwilioAuthTokenInput('');
        setClearSecrets([]);
        setProviderSaveSuccess(true);
        setTimeout(() => setProviderSaveSuccess(false), 4500);
        onUpdateCommConfig?.({
          smtpHost: res.config.smtpHost,
          smtpPort: res.config.smtpPort,
          smtpUser: res.config.smtpUser,
          smtpSenderEmail: res.config.smtpSenderEmail,
          whatsappPhoneNumberId: res.config.whatsappPhoneNumberId,
          smsProvider: res.config.smsProvider,
          smsFromNumber: res.config.smsFromNumber,
          twilioAccountSid: res.config.twilioAccountSid,
          twilioPhoneNumber: res.config.twilioPhoneNumber
        });
      } else {
        setProviderSaveError(res?.message || 'Failed to persist gateway configuration.');
      }
    } catch (err: any) {
      setProviderSaveError(err?.message || 'Error updating communication gateway settings.');
    } finally {
      setIsProviderSaving(false);
    }
  };

  const currentGatewayChannel: SingleChannelKey = activeChannel === 'combined' ? gatewayChannelChoice : singleChannelKey;

  const handleTestChannelConnection = async () => {
    if (!testRecipient.trim()) {
      setProviderTestError(currentGatewayChannel === 'email' ? 'Enter a test email address first.' : 'Enter an international phone number first.');
      return;
    }
    setIsProviderTesting(true);
    setProviderTestError(null);
    setProviderTestMessage(null);
    try {
      const result = await api.communicationProviders.test({
        channel: currentGatewayChannel,
        recipient: testRecipient.trim()
      });
      if (result?.success) {
        setProviderTestMessage(result.message || 'Test message accepted by gateway.');
        const logsRes = await api.communicationProviders.logs(50).catch(() => null);
        if (logsRes?.success && Array.isArray(logsRes.logs)) {
          setDeliveryLogs(logsRes.logs);
        }
      } else {
        setProviderTestError(result?.message || 'Gateway rejected the test message.');
      }
    } catch (err: any) {
      setProviderTestError(err?.message || 'Provider test request failed.');
    } finally {
      setIsProviderTesting(false);
    }
  };

  // --- Channel Metadata & Master Flag ---
  const flagKey = CHANNEL_FLAG_KEY[singleChannelKey];
  const isChannelEnabled = featureFlags?.[flagKey] === true;

  const channelMeta = useMemo(() => {
    if (activeChannel === 'combined') {
      return {
        title: 'All Channels Combined Broadcast',
        subtitle: 'Send one Job or Ad broadcast simultaneously via Email, WhatsApp & SMS.',
        icon: Megaphone,
        accentClass: 'text-amber-400',
        activePill: 'bg-amber-500 text-slate-950 border-amber-400',
        testPlaceholder: 'alerts-test@yourdomain.com'
      };
    }
    if (activeChannel === 'whatsapp') {
      return {
        title: 'WhatsApp Control Hub',
        subtitle: 'Rates, quotas, packages, chat widget & WhatsApp Cloud/Twilio gateway.',
        icon: MessageCircle,
        accentClass: 'text-emerald-400',
        activePill: 'bg-emerald-500 text-slate-950 border-emerald-400',
        testPlaceholder: '+923001234567'
      };
    }
    if (activeChannel === 'email') {
      return {
        title: 'Email Control Hub',
        subtitle: 'Rates, quotas, expiry reminders, packages & SMTP/SendGrid/Resend API.',
        icon: Mail,
        accentClass: 'text-sky-400',
        activePill: 'bg-sky-400 text-slate-950 border-sky-300',
        testPlaceholder: 'alerts-test@yourdomain.com'
      };
    }
    return {
      title: 'SMS Control Hub',
      subtitle: 'SMS quotas, packages, Direct SMS Ad slots & Twilio SMS API.',
      icon: Smartphone,
      accentClass: 'text-indigo-400',
      activePill: 'bg-indigo-400 text-slate-950 border-indigo-300',
      testPlaceholder: '+923001234567'
    };
  }, [activeChannel]);

  const ChannelIcon = channelMeta.icon;
  const filteredChannelLogs = useMemo(
    () => deliveryLogs.filter((row: any) => String(row?.channel || '').toLowerCase() === currentGatewayChannel),
    [deliveryLogs, currentGatewayChannel]
  );

  const handleToggleChannelMasterSwitch = async (targetFlag: keyof AdminFeatureFlags = flagKey) => {
    if (!canManageSettings || isTogglingFlag) return;
    setIsTogglingFlag(true);
    try {
      await onToggleFeatureFlag(targetFlag);
    } finally {
      setIsTogglingFlag(false);
    }
  };

  const subTabs: Array<{ id: ChannelSubTab; label: string }> = activeChannel === 'combined'
    ? [
        { id: 'rule-engine', label: '⚡ Master Expiry & Usage Rule Engine' },
        { id: 'broadcast', label: '📣 Broadcast & Multi-Channel Center' },
        { id: 'gateway', label: '🔌 Channel Gateways & Delivery Logs' }
      ]
    : [
        {
          id: 'pricing',
          label: activeChannel === 'sms' ? 'Rates & SMS Ad Slot' : 'Rates & Packages'
        },
        { id: 'broadcast', label: 'Broadcast Center' },
        ...(activeChannel === 'whatsapp' ? [{ id: 'widget' as const, label: 'Chat Widget' }] : []),
        { id: 'gateway', label: 'Gateway & Logs' }
      ];

  const openEmbeddedBroadcast = (tab: 'compose' | 'history') => {
    setBroadcastInitialTab(tab);
    setSubTab('broadcast');
  };

  const channelLabelCaps = singleChannelKey === 'whatsapp' ? 'WhatsApp' : singleChannelKey === 'email' ? 'Email' : 'SMS';
  const channelReminderKey = singleChannelKey === 'whatsapp' ? 'whatsappEnabled' : singleChannelKey === 'email' ? 'emailEnabled' : 'smsEnabled';
  const channelReminderDaysKey = singleChannelKey === 'whatsapp' ? 'whatsappDaysBefore' : singleChannelKey === 'email' ? 'emailDaysBefore' : 'smsDaysBefore';

  return (
    <section className="space-y-3 text-white">
      {/* Compact Channel Command Header + Inline Broadcast Shortcuts */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 space-y-2.5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2.5">
          <div className="min-w-0 space-y-0.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <ChannelIcon className={`w-4 h-4 shrink-0 ${channelMeta.accentClass}`} />
              <h3 className="text-xs sm:text-sm font-black text-white truncate">{channelMeta.title}</h3>
              {activeChannel !== 'combined' && (
                <span
                  className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                    isChannelEnabled
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  {isChannelEnabled ? 'Active' : 'Off'}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 leading-snug">{channelMeta.subtitle}</p>
          </div>

          {activeChannel === 'combined' ? (
            <div className="flex flex-wrap items-center gap-1.5 shrink-0">
              {canManageSettings && (['email', 'whatsapp', 'sms'] as const).map((ch) => {
                const k = CHANNEL_FLAG_KEY[ch];
                const on = featureFlags?.[k] === true;
                const lbl = ch === 'email' ? 'Email' : ch === 'whatsapp' ? 'WA' : 'SMS';
                return (
                  <button
                    key={ch}
                    type="button"
                    disabled={isTogglingFlag}
                    onClick={() => handleToggleChannelMasterSwitch(k)}
                    className={`min-h-[32px] px-2.5 py-1 rounded-lg text-[10px] font-black border cursor-pointer whitespace-nowrap disabled:opacity-50 ${
                      on
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                        : 'bg-slate-950 text-slate-400 border-slate-700'
                    }`}
                  >
                    {lbl}: {on ? 'ON' : 'OFF'}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => openEmbeddedBroadcast('compose')}
                className="min-h-[32px] px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-[10px] font-black flex items-center gap-1 cursor-pointer whitespace-nowrap"
              >
                <Megaphone className="w-3 h-3" />
                <span>Compose</span>
              </button>
              <button
                type="button"
                onClick={() => openEmbeddedBroadcast('history')}
                className="min-h-[32px] px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-200 border border-slate-700 text-[10px] font-bold flex items-center gap-1 cursor-pointer whitespace-nowrap"
              >
                <Clock className="w-3 h-3 text-slate-400" />
                <span>History</span>
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-1.5 shrink-0">
              {canManageSettings && (
                <button
                  type="button"
                  onClick={() => handleToggleChannelMasterSwitch(flagKey)}
                  disabled={isTogglingFlag}
                  className={`min-h-[34px] px-2.5 py-1 rounded-lg text-[11px] font-black transition-all cursor-pointer border whitespace-nowrap ${
                    isChannelEnabled
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/25'
                      : 'bg-slate-950 text-slate-300 border-slate-700 hover:border-slate-500'
                  } disabled:opacity-50`}
                >
                  {isTogglingFlag ? '...' : isChannelEnabled ? 'Master: ON' : 'Master: OFF'}
                </button>
              )}

              <button
                type="button"
                onClick={() => openEmbeddedBroadcast('compose')}
                className="min-h-[34px] px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-black flex items-center gap-1 cursor-pointer whitespace-nowrap"
              >
                <Megaphone className="w-3 h-3" />
                <span>Compose</span>
              </button>

              <button
                type="button"
                onClick={() => openEmbeddedBroadcast('history')}
                className="min-h-[34px] px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-200 border border-slate-700 text-[11px] font-bold flex items-center gap-1 cursor-pointer whitespace-nowrap"
              >
                <Clock className="w-3 h-3 text-slate-400" />
                <span>History</span>
              </button>
            </div>
          )}
        </div>

        {/* Segmented Sub-Tab Strip (Mobile + Desktop Compact) */}
        {subTabs.length > 1 && (
          <div className="flex items-center gap-1 overflow-x-auto pb-0.5 pt-2 border-t border-slate-800 scrollbar-none">
            {subTabs.map((t) => {
              const isActive = subTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSubTab(t.id)}
                  className={`min-h-[32px] px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap shrink-0 cursor-pointer border transition-all ${
                    isActive
                      ? channelMeta.activePill
                      : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700 hover:text-white'
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* SUB-TAB: MASTER EXPIRY & USAGE RULE ENGINE */}
      {subTab === 'rule-engine' && activeChannel === 'combined' && (
        <AdminMasterRuleEngine
          pricing={pricing}
          onUpdatePricing={(updated) => {
            setPricing(updated);
            onSyncAuthoritativePricing?.(updated);
          }}
          canManagePricing={canManagePricing}
          canManageSettings={canManageSettings}
          featureFlags={featureFlags}
          commConfig={commConfig}
          users={users}
          subscribers={subscribers}
          ads={ads}
          jobs={jobs}
          onSwitchToBroadcast={() => setSubTab('broadcast')}
          onSwitchToGateways={() => setSubTab('gateway')}
        />
      )}

      {/* SUB-TAB 1: CHANNEL RATES, QUOTAS, SMS AD SLOT & PACKAGES */}
      {subTab === 'pricing' && activeChannel !== 'combined' && (
        <div className="space-y-4">
          {pricingLoading ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-xs text-slate-400 flex items-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
              <span>Loading authoritative {activeChannel.toUpperCase()} rates &amp; packages...</span>
            </div>
          ) : !pricing ? (
            <div className="bg-slate-900 border border-rose-500/30 rounded-2xl p-4 text-xs text-rose-200 flex items-center justify-between gap-3">
              <span>{pricingError || 'Channel pricing configuration unavailable.'}</span>
              <button
                type="button"
                onClick={loadAuthoritativePricing}
                className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-bold cursor-pointer"
              >
                Retry
              </button>
            </div>
          ) : (
            <>
              {/* Alert Catalog Rate, Monthly Quota & Email Reminder Card */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 sm:p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-800 pb-2.5">
                  <div>
                    <h4 className="text-xs sm:text-sm font-black text-white">
                      {activeChannel === 'whatsapp'
                        ? 'WhatsApp Job Alerts Pricing & Quota'
                        : activeChannel === 'email'
                        ? 'Email Job Alerts Pricing, Quota & Expiry Reminders'
                        : 'SMS Job Alerts Pricing & Quota'}
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Authoritative rate card synced directly with Master Subscription Studio and subscriber checkouts.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={loadAuthoritativePricing}
                      disabled={pricingSaving}
                      className="min-h-[36px] px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-[11px] font-bold text-slate-300 hover:text-white cursor-pointer flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Reload</span>
                    </button>
                    {canManagePricing && (
                      <button
                        type="button"
                        onClick={handleSaveChannelRatesAndPackages}
                        disabled={pricingSaving}
                        className="min-h-[36px] px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[11px] font-black cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>{pricingSaving ? 'Saving...' : 'Save Rates & Packages'}</span>
                      </button>
                    )}
                  </div>
                </div>

                {pricingError && (
                  <div role="alert" className="p-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-[11px] text-rose-200 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{pricingError}</span>
                  </div>
                )}
                {pricingSuccess && (
                  <div role="status" className="p-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-[11px] text-emerald-200 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{pricingSuccess}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-2">
                    <div>
                      <div className="text-[11px] font-bold text-white">Catalog Feature Status</div>
                      <div className="text-[10px] text-slate-400">Available in subscription builder</div>
                    </div>
                    <input
                      type="checkbox"
                      aria-label={`Enable ${activeChannel} catalog feature`}
                      checked={channelCatalogFeature?.enabled === true}
                      disabled={!canManagePricing}
                      onChange={(e) => updateCatalogFeatureField('enabled', e.target.checked)}
                      className="w-4 h-4 accent-emerald-500 cursor-pointer"
                    />
                  </div>

                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5">
                    <label className="block text-[10px] font-bold text-slate-400 mb-1">Base Catalog Price (PKR)</label>
                    <input
                      type="number"
                      min={0}
                      disabled={!canManagePricing}
                      value={channelCatalogFeature?.pricePkr ?? 0}
                      onChange={(e) => updateCatalogFeatureField('pricePkr', Math.max(0, Number(e.target.value) || 0))}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono tabular-nums font-bold text-xs"
                    />
                  </div>

                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5">
                    <label className="block text-[10px] font-bold text-slate-400 mb-1">Validity Duration (Days)</label>
                    <input
                      type="number"
                      min={1}
                      max={3650}
                      disabled={!canManagePricing}
                      value={channelCatalogFeature?.durationDays ?? 30}
                      onChange={(e) => updateCatalogFeatureField('durationDays', Math.max(1, Number(e.target.value) || 30))}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono tabular-nums font-bold text-xs"
                    />
                  </div>

                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold text-slate-400">Monthly Message Quota</label>
                      <label className="flex items-center gap-1 text-[10px] text-emerald-300 cursor-pointer">
                        <input
                          type="checkbox"
                          disabled={!canManagePricing}
                          checked={channelCatalogFeature?.unlimitedMessages === true}
                          onChange={(e) => updateCatalogFeatureField('unlimitedMessages', e.target.checked)}
                          className="accent-emerald-500"
                        />
                        <span>Unlimited</span>
                      </label>
                    </div>
                    <input
                      type="number"
                      min={1}
                      max={1000000}
                      disabled={!canManagePricing || channelCatalogFeature?.unlimitedMessages === true}
                      value={channelCatalogFeature?.monthlyMessageQuota ?? 50}
                      onChange={(e) =>
                        updateCatalogFeatureField('monthlyMessageQuota', Math.max(1, Number(e.target.value) || 1))
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono tabular-nums font-bold text-xs disabled:opacity-40"
                    />
                  </div>
                </div>

                {/* Feature Label, Bundle Discount & Dual Pre-Expiry Reminders (In-App Notification + Channel Delivery) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5">
                    <label className="block text-[10px] font-bold text-slate-400 mb-1">Display Feature Label</label>
                    <input
                      type="text"
                      disabled={!canManagePricing}
                      value={channelCatalogFeature?.label || ''}
                      onChange={(e) => updateCatalogFeatureField('label', e.target.value)}
                      placeholder={`${activeChannel.toUpperCase()} Alerts`}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-semibold text-xs"
                    />
                  </div>

                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5">
                    <label className="block text-[10px] font-bold text-slate-400 mb-1">Bundle Discount (%)</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      disabled={!canManagePricing}
                      value={pricing.subscriptionBundleDiscountPercent ?? 0}
                      onChange={(e) =>
                        setPricing((prev: any) => ({
                          ...prev,
                          subscriptionBundleDiscountPercent: Math.min(100, Math.max(0, Number(e.target.value) || 0))
                        }))
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono tabular-nums font-bold text-xs"
                    />
                  </div>

                  {/* In-App Notification Before Expiry (Shared across WhatsApp / Email / SMS) */}
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <Bell className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span className="text-[11px] font-bold text-white truncate">Expiry Notification</span>
                      </div>
                      <div className="text-[10px] text-slate-400">In-App alert before expiry</div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <input
                        type="checkbox"
                        aria-label={`Enable In-App expiry notification on ${activeChannel}`}
                        disabled={!canManagePricing}
                        checked={reminderSettings.inAppEnabled}
                        onChange={(e) =>
                          setPricing((prev: any) => ({
                            ...prev,
                            subscriptionReminderSettings: {
                              ...reminderSettings,
                              inAppEnabled: e.target.checked
                            }
                          }))
                        }
                        className="w-4 h-4 accent-amber-400 cursor-pointer"
                      />
                      <input
                        type="number"
                        min={1}
                        max={30}
                        disabled={!canManagePricing || !reminderSettings.inAppEnabled}
                        value={reminderSettings.inAppDaysBefore}
                        onChange={(e) =>
                          setPricing((prev: any) => ({
                            ...prev,
                            subscriptionReminderSettings: {
                              ...reminderSettings,
                              inAppDaysBefore: Math.min(30, Math.max(1, Number(e.target.value) || 1))
                            }
                          }))
                        }
                        aria-label="In-App notification days before expiry"
                        className="w-12 px-1.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-center font-mono tabular-nums font-bold text-xs text-white disabled:opacity-40"
                      />
                      <span className="text-[10px] text-slate-400">d</span>
                    </div>
                  </div>

                  {/* Channel-Specific Expiry Reminder Message (Email / WhatsApp / SMS) */}
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <ChannelIcon className={`w-3.5 h-3.5 shrink-0 ${channelMeta.accentClass}`} />
                        <span className="text-[11px] font-bold text-white truncate">Expiry Reminder {channelLabelCaps}</span>
                      </div>
                      <div className="text-[10px] text-slate-400">Auto-send via {channelLabelCaps}</div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <input
                        type="checkbox"
                        aria-label={`Enable ${channelLabelCaps} expiry reminder`}
                        disabled={!canManagePricing}
                        checked={Boolean((reminderSettings as any)[channelReminderKey])}
                        onChange={(e) =>
                          setPricing((prev: any) => ({
                            ...prev,
                            subscriptionReminderSettings: {
                              ...reminderSettings,
                              [channelReminderKey]: e.target.checked
                            }
                          }))
                        }
                        className="w-4 h-4 accent-emerald-400 cursor-pointer"
                      />
                      <input
                        type="number"
                        min={1}
                        max={30}
                        disabled={!canManagePricing || !(reminderSettings as any)[channelReminderKey]}
                        value={(reminderSettings as any)[channelReminderDaysKey] ?? 3}
                        onChange={(e) =>
                          setPricing((prev: any) => ({
                            ...prev,
                            subscriptionReminderSettings: {
                              ...reminderSettings,
                              [channelReminderDaysKey]: Math.min(30, Math.max(1, Number(e.target.value) || 1))
                            }
                          }))
                        }
                        aria-label={`${channelLabelCaps} reminder days before expiry`}
                        className="w-12 px-1.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-center font-mono tabular-nums font-bold text-xs text-white disabled:opacity-40"
                      />
                      <span className="text-[10px] text-slate-400">d</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* SMS-ONLY: Direct SMS Broadcast Ad Placement Slot & Per-Contact Pricing */}
              {activeChannel === 'sms' && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 sm:p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-800 pb-2.5">
                    <div>
                      <h4 className="text-xs sm:text-sm font-black text-white">
                        Direct SMS Ad Campaign Slot &amp; Per-Contact Rate
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        Configure advertiser pricing, visibility, and slot limits for the &quot;Direct SMS Broadcast&quot; ad placement.
                      </p>
                    </div>
                    {(canManageAds || canManagePricing) && (
                      <button
                        type="button"
                        onClick={handleSaveSmsAdConfig}
                        disabled={smsAdSaving}
                        className="min-h-[36px] px-3.5 py-1.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-slate-950 text-[11px] font-black cursor-pointer flex items-center gap-1.5 shrink-0 disabled:opacity-50"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>{smsAdSaving ? 'Saving...' : 'Save SMS Ad Slot'}</span>
                      </button>
                    )}
                  </div>

                  {smsAdSaveError && (
                    <div role="alert" className="p-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-[11px] text-rose-200 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{smsAdSaveError}</span>
                    </div>
                  )}
                  {smsAdSaveSuccess && (
                    <div role="status" className="p-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-[11px] text-emerald-200 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>{smsAdSaveSuccess}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between gap-2">
                      <div>
                        <div className="text-[11px] font-bold text-white">Enable SMS Ad Slot</div>
                        <div className="text-[10px] text-slate-400">Show sms-broadcast placement</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={smsPlacementDraft.isEnabled !== false}
                        onChange={(e) => setSmsPlacementDraft((prev) => ({ ...prev, isEnabled: e.target.checked }))}
                        className="w-4 h-4 accent-indigo-400 cursor-pointer"
                      />
                    </div>

                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between gap-2">
                      <div>
                        <div className="text-[11px] font-bold text-white">Allow Advertiser SMS Campaigns</div>
                        <div className="text-[10px] text-slate-400">Form rule: allowDirectSms</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={allowDirectSmsAds}
                        onChange={(e) => setAllowDirectSmsAds(e.target.checked)}
                        className="w-4 h-4 accent-indigo-400 cursor-pointer"
                      />
                    </div>

                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5">
                      <label className="block text-[10px] font-bold text-slate-400 mb-1">Per-Contact Rate (PKR)</label>
                      <input
                        type="number"
                        min={0.1}
                        step={0.1}
                        value={smsPerContactRate}
                        onChange={(e) => setSmsPerContactRate(Math.max(0.1, Number(e.target.value) || 0.1))}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono tabular-nums font-bold text-xs"
                      />
                    </div>

                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5">
                      <label className="block text-[10px] font-bold text-slate-400 mb-1">Slot Multiplier (x)</label>
                      <input
                        type="number"
                        min={0.1}
                        step={0.05}
                        value={smsPlacementDraft.multiplier ?? 1.1}
                        onChange={(e) =>
                          setSmsPlacementDraft((prev) => ({
                            ...prev,
                            multiplier: Math.max(0.1, Number(e.target.value) || 1.0)
                          }))
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono tabular-nums font-bold text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs">
                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5">
                      <label className="block text-[10px] font-bold text-slate-400 mb-1">Hourly Fixed (PKR)</label>
                      <input
                        type="number"
                        min={0}
                        placeholder="Multiplier"
                        value={smsPlacementDraft.timeframeFixedRatesPkr?.hourly ?? ''}
                        onChange={(e) => {
                          const val = e.target.value === '' ? undefined : Math.max(0, Number(e.target.value) || 0);
                          setSmsPlacementDraft((prev) => ({
                            ...prev,
                            timeframeFixedRatesPkr: { ...prev.timeframeFixedRatesPkr, hourly: val }
                          }));
                        }}
                        className="w-full px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono tabular-nums text-xs"
                      />
                    </div>
                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5">
                      <label className="block text-[10px] font-bold text-slate-400 mb-1">Daily Fixed (PKR)</label>
                      <input
                        type="number"
                        min={0}
                        placeholder="Multiplier"
                        value={smsPlacementDraft.timeframeFixedRatesPkr?.daily ?? ''}
                        onChange={(e) => {
                          const val = e.target.value === '' ? undefined : Math.max(0, Number(e.target.value) || 0);
                          setSmsPlacementDraft((prev) => ({
                            ...prev,
                            timeframeFixedRatesPkr: { ...prev.timeframeFixedRatesPkr, daily: val }
                          }));
                        }}
                        className="w-full px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono tabular-nums text-xs"
                      />
                    </div>
                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5">
                      <label className="block text-[10px] font-bold text-slate-400 mb-1">Weekly Fixed (PKR)</label>
                      <input
                        type="number"
                        min={0}
                        placeholder="Multiplier"
                        value={smsPlacementDraft.timeframeFixedRatesPkr?.weekly ?? ''}
                        onChange={(e) => {
                          const val = e.target.value === '' ? undefined : Math.max(0, Number(e.target.value) || 0);
                          setSmsPlacementDraft((prev) => ({
                            ...prev,
                            timeframeFixedRatesPkr: { ...prev.timeframeFixedRatesPkr, weekly: val }
                          }));
                        }}
                        className="w-full px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono tabular-nums text-xs"
                      />
                    </div>
                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5">
                      <label className="block text-[10px] font-bold text-slate-400 mb-1">Monthly Fixed (PKR)</label>
                      <input
                        type="number"
                        min={0}
                        placeholder="Multiplier"
                        value={smsPlacementDraft.timeframeFixedRatesPkr?.monthly ?? ''}
                        onChange={(e) => {
                          const val = e.target.value === '' ? undefined : Math.max(0, Number(e.target.value) || 0);
                          setSmsPlacementDraft((prev) => ({
                            ...prev,
                            timeframeFixedRatesPkr: { ...prev.timeframeFixedRatesPkr, monthly: val }
                          }));
                        }}
                        className="w-full px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono tabular-nums text-xs"
                      />
                    </div>
                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5">
                      <label className="block text-[10px] font-bold text-slate-400 mb-1">Max Concurrent</label>
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={smsPlacementDraft.maxConcurrentSlots ?? 3}
                        onChange={(e) =>
                          setSmsPlacementDraft((prev) => ({
                            ...prev,
                            maxConcurrentSlots: Math.max(1, Number(e.target.value) || 1)
                          }))
                        }
                        className="w-full px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono tabular-nums text-xs"
                      />
                    </div>
                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-300">Free Slot Override</span>
                      <input
                        type="checkbox"
                        checked={smsPlacementDraft.isFreeOverride === true}
                        onChange={(e) => setSmsPlacementDraft((prev) => ({ ...prev, isFreeOverride: e.target.checked }))}
                        className="w-4 h-4 accent-emerald-400 cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Channel Subscription Packages Manager */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 sm:p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-800 pb-2.5">
                  <div>
                    <div className="flex items-center gap-2">
                      <Package className={`w-4 h-4 ${channelMeta.accentClass}`} />
                      <h4 className="text-xs sm:text-sm font-black text-white">
                        {activeChannel === 'whatsapp'
                          ? 'WhatsApp Packages'
                          : activeChannel === 'email'
                          ? 'Email Packages'
                          : 'SMS Packages'}{' '}
                        ({channelPackages.length})
                      </h4>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Manage standalone or bundled subscription plans containing {activeChannel.toUpperCase()} alerts. Changes sync with Master Subscription Studio.
                    </p>
                  </div>
                  {canManagePricing && (
                    <button
                      type="button"
                      onClick={handleAddChannelPackage}
                      className="min-h-[36px] px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-black flex items-center gap-1.5 cursor-pointer shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>
                        Create {activeChannel === 'whatsapp' ? 'WhatsApp' : activeChannel === 'email' ? 'Email' : 'SMS'} Package
                      </span>
                    </button>
                  )}
                </div>

                {channelPackages.length === 0 ? (
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400 text-center">
                    No packages currently include{' '}
                    <span className="font-mono text-slate-200">{featureId}</span>. Click &quot;Create Package&quot; above to add one.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {channelPackages.map((pkg: any) => {
                      const override = pkg.featureOverrides?.[featureId] || {};
                      const isStandalone = Array.isArray(pkg.featureIds) && pkg.featureIds.length === 1;
                      const effectiveUnlimited =
                        typeof override.unlimitedMessages === 'boolean'
                          ? override.unlimitedMessages
                          : Boolean(channelCatalogFeature?.unlimitedMessages);
                      const effectiveQuota =
                        override.monthlyMessageQuota ?? channelCatalogFeature?.monthlyMessageQuota ?? 50;

                      return (
                        <div key={pkg.id} className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2.5 text-xs">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300">
                                  {isStandalone ? 'Standalone' : `Bundle (${pkg.featureIds.length} features)`}
                                </span>
                                {pkg.popular && (
                                  <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300">
                                    Popular
                                  </span>
                                )}
                              </div>
                              <input
                                type="text"
                                disabled={!canManagePricing}
                                value={pkg.name || ''}
                                onChange={(e) => updatePackageById(pkg.id, (cur) => ({ ...cur, name: e.target.value }))}
                                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-bold text-xs"
                              />
                            </div>
                            {canManagePricing && (
                              <button
                                type="button"
                                onClick={() => handleRemovePackage(pkg.id)}
                                title="Delete package"
                                className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/25 cursor-pointer shrink-0"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            <div>
                              <label className="block text-[10px] text-slate-400 mb-0.5">Price (PKR)</label>
                              <input
                                type="number"
                                min={0}
                                disabled={!canManagePricing}
                                value={pkg.configuredPricePkr ?? pkg.pricePkr ?? 0}
                                onChange={(e) => {
                                  const val = Math.max(0, Number(e.target.value) || 0);
                                  updatePackageById(pkg.id, (cur) => ({
                                    ...cur,
                                    configuredPricePkr: val,
                                    pricePkr: val
                                  }));
                                }}
                                className="w-full px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono tabular-nums font-bold text-xs"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] text-slate-400 mb-0.5">Days</label>
                              <input
                                type="number"
                                min={1}
                                max={3650}
                                disabled={!canManagePricing}
                                value={pkg.durationDays ?? 30}
                                onChange={(e) =>
                                  updatePackageById(pkg.id, (cur) => ({
                                    ...cur,
                                    durationDays: Math.max(1, Number(e.target.value) || 30)
                                  }))
                                }
                                className="w-full px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono tabular-nums font-bold text-xs"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] text-slate-400 mb-0.5">Discount %</label>
                              <input
                                type="number"
                                min={0}
                                max={100}
                                disabled={!canManagePricing}
                                value={pkg.bundleDiscountPercent ?? 0}
                                onChange={(e) =>
                                  updatePackageById(pkg.id, (cur) => ({
                                    ...cur,
                                    bundleDiscountPercent: Math.min(100, Math.max(0, Number(e.target.value) || 0))
                                  }))
                                }
                                className="w-full px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono tabular-nums font-bold text-xs"
                              />
                            </div>

                            <div>
                              <div className="flex items-center justify-between mb-0.5">
                                <label className="text-[10px] text-slate-400">Msg Quota</label>
                                <label className="flex items-center gap-0.5 text-[9px] text-emerald-300 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    disabled={!canManagePricing}
                                    checked={effectiveUnlimited}
                                    onChange={(e) =>
                                      updatePackageById(pkg.id, (cur) => ({
                                        ...cur,
                                        featureOverrides: {
                                          ...(cur.featureOverrides || {}),
                                          [featureId]: {
                                            ...(cur.featureOverrides?.[featureId] || {}),
                                            unlimitedMessages: e.target.checked
                                          }
                                        }
                                      }))
                                    }
                                    className="accent-emerald-500"
                                  />
                                  <span>Unl</span>
                                </label>
                              </div>
                              <input
                                type="number"
                                min={1}
                                max={1000000}
                                disabled={!canManagePricing || effectiveUnlimited}
                                value={effectiveQuota}
                                onChange={(e) =>
                                  updatePackageById(pkg.id, (cur) => ({
                                    ...cur,
                                    featureOverrides: {
                                      ...(cur.featureOverrides || {}),
                                      [featureId]: {
                                        ...(cur.featureOverrides?.[featureId] || {}),
                                        unlimitedMessages: false,
                                        monthlyMessageQuota: Math.max(1, Number(e.target.value) || 1)
                                      }
                                    }
                                  }))
                                }
                                className="w-full px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono tabular-nums font-bold text-xs disabled:opacity-40"
                              />
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/80 text-[11px]">
                            <div className="flex items-center gap-3">
                              <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
                                <input
                                  type="checkbox"
                                  disabled={!canManagePricing}
                                  checked={pkg.enabled !== false}
                                  onChange={(e) => updatePackageById(pkg.id, (cur) => ({ ...cur, enabled: e.target.checked }))}
                                  className="accent-emerald-500"
                                />
                                <span>Enabled</span>
                              </label>
                              <label className="flex items-center gap-1.5 text-amber-300 cursor-pointer">
                                <input
                                  type="checkbox"
                                  disabled={!canManagePricing}
                                  checked={pkg.popular === true}
                                  onChange={(e) => updatePackageById(pkg.id, (cur) => ({ ...cur, popular: e.target.checked }))}
                                  className="accent-amber-400"
                                />
                                <span>Popular</span>
                              </label>
                            </div>

                            <select
                              disabled={!canManagePricing}
                              value={pkg.pricingMode || 'fixed'}
                              onChange={(e) =>
                                updatePackageById(pkg.id, (cur) => ({ ...cur, pricingMode: e.target.value }))
                              }
                              className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 text-[10px] font-bold text-slate-200"
                            >
                              <option value="fixed">Fixed Price Mode</option>
                              <option value="catalog">Catalog Auto-Sum Mode</option>
                            </select>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* SUB-TAB 2: EMBEDDED BROADCAST COMPOSER, TEMPLATES & HISTORY (NO REDIRECT) */}
      {subTab === 'broadcast' && (
        <AdminBroadcastCenter
          embedded
          hideProvidersTab
          lockedChannel={activeChannel === 'combined' ? undefined : channelLabelCaps}
          initialTab={broadcastInitialTab}
          campaigns={broadcastCampaigns}
          users={users}
          subscribers={subscribers}
          jobs={jobs}
          ads={ads}
          commConfig={commConfig}
          featureFlags={featureFlags}
          isLoading={isBroadcastLoading}
          loadError={broadcastLoadError}
          migrationError={broadcastMigrationError}
          onSendCampaign={onSendBroadcastCampaign}
          onCampaignUpdated={onCampaignUpdated}
          onRefreshCampaigns={onRefreshBroadcastCampaigns}
          onUpdateCommConfig={onUpdateCommConfig}
        />
      )}

      {/* SUB-TAB 3 (WHATSAPP ONLY): WIDGET & CHAT DESIGN */}
      {subTab === 'widget' && activeChannel === 'whatsapp' && (
        <AdminWhatsAppManager
          config={whatsAppConfig}
          onUpdateConfig={onUpdateWhatsAppConfig}
          subscribersCount={subscribersCount}
        />
      )}

      {/* SUB-TAB 3: GATEWAY API, TEST CONNECTION & DELIVERY LOGS */}
      {subTab === 'gateway' && (
        <div className="space-y-4">
          {!canManageSettings ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-xs text-slate-400">
              Settings management permission is required to view or modify encrypted provider credentials.
            </div>
          ) : (
            <>
              {/* Channel Selector when inside Broadcast & Notifications Gateway Tab */}
              {activeChannel === 'combined' && (
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="text-xs font-black text-amber-300 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-amber-400" />
                    <span>Select Gateway Configuration Target:</span>
                  </div>
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                    <button
                      type="button"
                      onClick={() => setGatewayChannelChoice('whatsapp')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        currentGatewayChannel === 'whatsapp'
                          ? 'bg-emerald-500 text-slate-950 font-black shadow-sm'
                          : 'bg-slate-900 text-slate-300 hover:text-white'
                      }`}
                    >
                      💬 WhatsApp Gateway
                    </button>
                    <button
                      type="button"
                      onClick={() => setGatewayChannelChoice('email')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        currentGatewayChannel === 'email'
                          ? 'bg-sky-400 text-slate-950 font-black shadow-sm'
                          : 'bg-slate-900 text-slate-300 hover:text-white'
                      }`}
                    >
                      ✉️ Email Gateway
                    </button>
                    <button
                      type="button"
                      onClick={() => setGatewayChannelChoice('sms')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        currentGatewayChannel === 'sms'
                          ? 'bg-indigo-400 text-slate-950 font-black shadow-sm'
                          : 'bg-slate-900 text-slate-300 hover:text-white'
                      }`}
                    >
                      📱 SMS Gateway
                    </button>
                  </div>
                </div>
              )}

              {/* Live Channel Gateway Test Box */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 sm:p-4 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs sm:text-sm font-black text-white">
                      Test Live {currentGatewayChannel.toUpperCase()} Gateway
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Send a real test dispatch through the saved encrypted provider credentials (rate-limited to 1 per 30s).
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={loadProviderConfig}
                    disabled={isLoadingProviders}
                    className="min-h-[34px] px-2.5 py-1 rounded-xl bg-slate-950 border border-slate-700 text-[11px] font-bold text-slate-300 hover:text-white cursor-pointer flex items-center gap-1 shrink-0"
                  >
                    <RefreshCw className={`w-3 h-3 ${isLoadingProviders ? 'animate-spin' : ''}`} />
                    <span>Refresh</span>
                  </button>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 text-xs">
                  <input
                    type={currentGatewayChannel === 'email' ? 'email' : 'text'}
                    value={testRecipient}
                    onChange={(e) => setTestRecipient(e.target.value)}
                    placeholder={currentGatewayChannel === 'email' ? 'alerts-test@yourdomain.com' : '+923001234567'}
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleTestChannelConnection}
                    disabled={isProviderTesting}
                    className="min-h-[38px] px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isProviderTesting ? 'Sending Test...' : `Send Test ${currentGatewayChannel.toUpperCase()}`}</span>
                  </button>
                </div>

                {providerTestMessage && (
                  <p role="status" className="text-[11px] text-emerald-300 font-semibold">
                    {providerTestMessage}
                  </p>
                )}
                {providerTestError && (
                  <p role="alert" className="text-[11px] text-rose-300 font-semibold">
                    {providerTestError}
                  </p>
                )}
                {currentGatewayChannel === 'email' && emailProvider === 'smtp' && (
                  <p className="text-[10px] text-amber-300">
                    Note: SMTP live test dispatch requires Resend or SendGrid API adapter selected.
                  </p>
                )}
              </div>

              {/* Channel-Specific Encrypted Provider Form */}
              <form
                onSubmit={handleSaveProviders}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 sm:p-4 space-y-3 text-xs"
              >
                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className={`w-4 h-4 ${channelMeta.accentClass}`} />
                    <span className="font-black text-white uppercase text-[11px] tracking-wider">
                      {currentGatewayChannel === 'whatsapp'
                        ? 'WhatsApp Encrypted Gateway API'
                        : currentGatewayChannel === 'email'
                        ? 'Email Encrypted Gateway API'
                        : 'SMS Encrypted Gateway API'}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">AES-256-GCM</span>
                </div>

                {providerSaveError && (
                  <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[11px] flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{providerSaveError}</span>
                  </div>
                )}
                {providerSaveSuccess && (
                  <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 text-[11px] font-bold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Encrypted gateway credentials saved securely.</span>
                  </div>
                )}

                {currentGatewayChannel === 'email' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <div>
                      <label className="block font-bold text-slate-300 mb-1">Email Adapter</label>
                      <select
                        value={emailProvider}
                        onChange={(e) => setEmailProvider(e.target.value as EmailProviderType)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-bold"
                      >
                        <option value="smtp">Custom SMTP Server</option>
                        <option value="sendgrid">SendGrid Web API</option>
                        <option value="resend">Resend API</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-bold text-slate-300 mb-1">Sender Email Address</label>
                      <input
                        type="email"
                        value={smtpSenderEmail}
                        onChange={(e) => setSmtpSenderEmail(e.target.value)}
                        placeholder="alerts@yourdomain.com"
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-300 mb-1">SMTP Host</label>
                      <input
                        type="text"
                        value={smtpHost}
                        onChange={(e) => setSmtpHost(e.target.value)}
                        placeholder="smtp.sendgrid.net"
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-300 mb-1">SMTP Port</label>
                      <input
                        type="number"
                        min={1}
                        max={65535}
                        value={smtpPort}
                        onChange={(e) => setSmtpPort(Number(e.target.value) || 587)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-300 mb-1">SMTP Username</label>
                      <input
                        type="text"
                        value={smtpUser}
                        onChange={(e) => setSmtpUser(e.target.value)}
                        placeholder="apikey"
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="font-bold text-slate-300">SMTP Password</label>
                        <span className="text-[10px] text-slate-400">
                          {safeProviderConfig.smtpPasswordConfigured ? 'Configured' : 'Empty'}
                        </span>
                      </div>
                      <input
                        type="password"
                        value={smtpPasswordInput}
                        onChange={(e) => setSmtpPasswordInput(e.target.value)}
                        placeholder={safeProviderConfig.smtpPasswordConfigured ? '(Keep existing)' : 'Enter password'}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono"
                      />
                      {safeProviderConfig.smtpPasswordConfigured && (
                        <label className="mt-1 flex items-center gap-1.5 text-[10px] text-rose-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={clearSecrets.includes('smtpPassword')}
                            onChange={() => handleToggleClearSecret('smtpPassword')}
                          />
                          <span>Clear saved password</span>
                        </label>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="font-bold text-slate-300">SendGrid API Key</label>
                        <span className="text-[10px] text-slate-400">
                          {safeProviderConfig.sendgridApiKeyConfigured ? 'Configured' : 'Empty'}
                        </span>
                      </div>
                      <input
                        type="password"
                        value={sendgridApiKeyInput}
                        onChange={(e) => setSendgridApiKeyInput(e.target.value)}
                        placeholder={safeProviderConfig.sendgridApiKeyConfigured ? '(Keep existing)' : 'SG....'}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono"
                      />
                      {safeProviderConfig.sendgridApiKeyConfigured && (
                        <label className="mt-1 flex items-center gap-1.5 text-[10px] text-rose-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={clearSecrets.includes('sendgridApiKey')}
                            onChange={() => handleToggleClearSecret('sendgridApiKey')}
                          />
                          <span>Clear SendGrid key</span>
                        </label>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="font-bold text-slate-300">Resend API Key</label>
                        <span className="text-[10px] text-slate-400">
                          {safeProviderConfig.resendApiKeyConfigured ? 'Configured' : 'Empty'}
                        </span>
                      </div>
                      <input
                        type="password"
                        value={resendApiKeyInput}
                        onChange={(e) => setResendApiKeyInput(e.target.value)}
                        placeholder={safeProviderConfig.resendApiKeyConfigured ? '(Keep existing)' : 're_...'}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono"
                      />
                      {safeProviderConfig.resendApiKeyConfigured && (
                        <label className="mt-1 flex items-center gap-1.5 text-[10px] text-rose-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={clearSecrets.includes('resendApiKey')}
                            onChange={() => handleToggleClearSecret('resendApiKey')}
                          />
                          <span>Clear Resend key</span>
                        </label>
                      )}
                    </div>
                  </div>
                )}

                {currentGatewayChannel === 'whatsapp' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <div>
                      <label className="block font-bold text-slate-300 mb-1">WhatsApp Adapter</label>
                      <select
                        value={whatsappProvider}
                        onChange={(e) => setWhatsappProvider(e.target.value as WhatsAppProviderType)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-bold"
                      >
                        <option value="meta-cloud">Meta WhatsApp Cloud API</option>
                        <option value="twilio">Twilio WhatsApp</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-bold text-slate-300 mb-1">WhatsApp Phone Number ID</label>
                      <input
                        type="text"
                        value={whatsappPhoneNumberId}
                        onChange={(e) => setWhatsappPhoneNumberId(e.target.value)}
                        placeholder="e.g. 10928374619"
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-300 mb-1">Business Account ID (WABA)</label>
                      <input
                        type="text"
                        value={whatsappBusinessAccountId}
                        onChange={(e) => setWhatsappBusinessAccountId(e.target.value)}
                        placeholder="e.g. 99283746102"
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="font-bold text-slate-300">Meta Cloud Access Token</label>
                        <span className="text-[10px] text-slate-400">
                          {safeProviderConfig.whatsappCloudApiTokenConfigured ? 'Configured' : 'Empty'}
                        </span>
                      </div>
                      <input
                        type="password"
                        value={whatsappCloudApiTokenInput}
                        onChange={(e) => setWhatsappCloudApiTokenInput(e.target.value)}
                        placeholder={safeProviderConfig.whatsappCloudApiTokenConfigured ? '(Keep existing)' : 'EAAQ...'}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono"
                      />
                      {safeProviderConfig.whatsappCloudApiTokenConfigured && (
                        <label className="mt-1 flex items-center gap-1.5 text-[10px] text-rose-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={clearSecrets.includes('whatsappCloudApiToken')}
                            onChange={() => handleToggleClearSecret('whatsappCloudApiToken')}
                          />
                          <span>Clear Meta token</span>
                        </label>
                      )}
                    </div>
                    <div>
                      <label className="block font-bold text-slate-300 mb-1">Twilio WhatsApp Sender</label>
                      <input
                        type="text"
                        value={twilioPhoneNumber}
                        onChange={(e) => setTwilioPhoneNumber(e.target.value)}
                        placeholder="+14155238886"
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-300 mb-1">Twilio Account SID (if Twilio)</label>
                      <input
                        type="text"
                        value={twilioAccountSid}
                        onChange={(e) => setTwilioAccountSid(e.target.value)}
                        placeholder="AC..."
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="font-bold text-slate-300">Twilio Auth Token (if Twilio)</label>
                        <span className="text-[10px] text-slate-400">
                          {safeProviderConfig.twilioAuthTokenConfigured ? 'Configured' : 'Empty'}
                        </span>
                      </div>
                      <input
                        type="password"
                        value={twilioAuthTokenInput}
                        onChange={(e) => setTwilioAuthTokenInput(e.target.value)}
                        placeholder={safeProviderConfig.twilioAuthTokenConfigured ? '(Keep existing)' : 'Auth token'}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono"
                      />
                    </div>
                  </div>
                )}

                {currentGatewayChannel === 'sms' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div>
                      <label className="block font-bold text-slate-300 mb-1">SMS Provider Adapter</label>
                      <select
                        value={smsProvider}
                        onChange={(e) => setSmsProvider(e.target.value as 'disabled' | 'twilio')}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-bold"
                      >
                        <option value="disabled">Disabled</option>
                        <option value="twilio">Twilio SMS</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-bold text-slate-300 mb-1">SMS Sender Number</label>
                      <input
                        type="text"
                        value={smsFromNumber}
                        onChange={(e) => setSmsFromNumber(e.target.value)}
                        placeholder="+923001234567"
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-300 mb-1">Twilio Account SID</label>
                      <input
                        type="text"
                        value={twilioAccountSid}
                        onChange={(e) => setTwilioAccountSid(e.target.value)}
                        placeholder="AC..."
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="font-bold text-slate-300">Twilio Auth Token</label>
                        <span className="text-[10px] text-slate-400">
                          {safeProviderConfig.twilioAuthTokenConfigured ? 'Configured' : 'Empty'}
                        </span>
                      </div>
                      <input
                        type="password"
                        value={twilioAuthTokenInput}
                        onChange={(e) => setTwilioAuthTokenInput(e.target.value)}
                        placeholder={safeProviderConfig.twilioAuthTokenConfigured ? '(Keep existing)' : 'Auth token'}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono"
                      />
                      {safeProviderConfig.twilioAuthTokenConfigured && (
                        <label className="mt-1 flex items-center gap-1.5 text-[10px] text-rose-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={clearSecrets.includes('twilioAuthToken')}
                            onChange={() => handleToggleClearSecret('twilioAuthToken')}
                          />
                          <span>Clear Twilio token</span>
                        </label>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={isProviderSaving}
                    className="min-h-[38px] px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>{isProviderSaving ? 'Encrypting & Saving...' : `Save ${currentGatewayChannel.toUpperCase()} Gateway`}</span>
                  </button>
                </div>
              </form>

              {/* Channel Delivery Logs */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 sm:p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-white">
                    Recent {currentGatewayChannel.toUpperCase()} Delivery Logs ({filteredChannelLogs.length})
                  </h4>
                  <span className="text-[10px] text-slate-500">90-day retention</span>
                </div>
                {filteredChannelLogs.length === 0 ? (
                  <p className="text-[11px] text-slate-500">
                    No {currentGatewayChannel} delivery logs recorded yet.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[11px]">
                      <thead className="text-slate-500 border-b border-slate-800">
                        <tr>
                          <th className="py-1.5 px-2">Provider</th>
                          <th className="py-1.5 px-2">Status</th>
                          <th className="py-1.5 px-2">Attempts</th>
                          <th className="py-1.5 px-2">Last Attempt</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/70">
                        {filteredChannelLogs.slice(0, 20).map((log: any, idx: number) => (
                          <tr key={`${log.eventId || idx}-${log.channel}`} className="text-slate-300">
                            <td className="py-1.5 px-2 font-mono">{log.provider || '—'}</td>
                            <td className={`py-1.5 px-2 font-bold ${log.status === 'SENT' ? 'text-emerald-300' : 'text-rose-300'}`}>
                              {log.status || 'UNKNOWN'}
                            </td>
                            <td className="py-1.5 px-2 font-mono tabular-nums">{log.attempts ?? 1}</td>
                            <td className="py-1.5 px-2 text-slate-400">
                              {log.lastAttemptAt ? new Date(log.lastAttemptAt).toLocaleString() : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
};
