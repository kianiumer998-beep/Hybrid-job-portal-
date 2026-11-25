import React, { useEffect, useState } from 'react';
import { 
  Advertisement, 
  AdType, 
  AdTargetPage, 
  AdPlacement, 
  AdStatus, 
  AdTheme, 
  AdDurationUnit,
  AdPricingConfig,
  DEFAULT_AD_PRICING_CONFIG,
  CampaignCustomizationConfig,
  DEFAULT_CAMPAIGN_CUSTOMIZATION_CONFIG,
  PopupDisplaySettings,
  PopupAppearanceSettings,
  DEFAULT_POPUP_APPEARANCE,
  FeedInlineAdSettings,
  FeedCardAppearanceSettings,
  DEFAULT_FEED_CARD_APPEARANCE,
  BannerAppearanceSettings,
  BannerBehaviorSettings,
  BannerDimensionSettings,
  DEFAULT_BANNER_APPEARANCE,
  DEFAULT_BANNER_BEHAVIOR,
  DEFAULT_BANNER_DIMENSIONS,
  calculateCampaignCost,
  getPlacementDisplayName,
  getPageDisplayName,
  formatTimeRemaining,
  isAdCurrentlyRunning,
  AD_BANNER_PRESETS 
} from '../../types/ad';
import { AdminCampaignCustomizer } from './AdminCampaignCustomizer';
import { CampaignLiveContextPreview } from './CampaignLiveContextPreview';
import { AdminAdPerformanceCharts } from './AdminAdPerformanceCharts';
import { api } from '../../services/api';
import { 
  Megaphone, 
  Plus, 
  Sparkles, 
  Eye, 
  MousePointerClick, 
  Percent, 
  Smartphone, 
  Image as ImageIcon, 
  Layers, 
  Edit3, 
  Trash2, 
  Copy, 
  Play, 
  Pause, 
  CheckCircle2, 
  X, 
  ExternalLink, 
  ArrowRight, 
  Send, 
  Upload, 
  Filter, 
  Search,
  Bell,
  Zap,
  ShieldCheck,
  RefreshCw,
  Clock,
  AlertCircle,
  XCircle,
  Calendar,
  DollarSign,
  Receipt,
  FileText,
  Settings,
  Users,
  Check,
  Sliders,
  TrendingUp,
  BarChart3,
  Radio,
  Layout
} from 'lucide-react';

interface AdminAdHubProps {
  ads: Advertisement[];
  onAddAd: (ad: Advertisement) => void;
  onUpdateAd: (ad: Advertisement) => void;
  onDeleteAd: (adId: string) => void;
  onResetAdMetrics: (adId?: string) => void;
  pricingConfig?: AdPricingConfig;
  onUpdatePricingConfig?: (config: AdPricingConfig) => void | Promise<unknown>;
  campaignConfig?: CampaignCustomizationConfig;
  onUpdateCampaignConfig?: (config: CampaignCustomizationConfig) => void | Promise<unknown>;
  onApproveAd?: (adId: string) => void;
  onRejectAd?: (adId: string, reason: string) => void;
  canManageAdConfiguration?: boolean;
  isPricingReady?: boolean;
  initialTab?: 'directory' | 'approvals' | 'slots' | 'customizer' | 'pricing' | 'performance';
  mode?: 'full' | 'rate-card-only' | 'customizer-only';
}

export const AdminAdHub: React.FC<AdminAdHubProps> = ({
  ads,
  onAddAd,
  onUpdateAd,
  onDeleteAd,
  onResetAdMetrics,
  pricingConfig = DEFAULT_AD_PRICING_CONFIG,
  onUpdatePricingConfig,
  campaignConfig = DEFAULT_CAMPAIGN_CUSTOMIZATION_CONFIG,
  onUpdateCampaignConfig,
  onApproveAd,
  onRejectAd,
  canManageAdConfiguration = false,
  isPricingReady = false,
  initialTab = 'approvals',
  mode = 'full'
}) => {
  // Main Sub-Tab: Directory, Pending Approvals, Placement Slots, Campaign Customizer, Pricing Engine, Performance Charts
  const [activeTab, setActiveTab] = useState<'directory' | 'approvals' | 'slots' | 'customizer' | 'pricing' | 'performance'>(
    mode === 'rate-card-only' ? 'pricing' : mode === 'customizer-only' ? 'customizer' : initialTab
  );

  // Filters for Directory
  const [filterType, setFilterType] = useState<string>('all');
  const [filterPage, setFilterPage] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modal State for Create/Edit
  const [isEditorOpen, setIsEditorOpen] = useState<boolean>(false);
  const [editingAd, setEditingAd] = useState<Advertisement | null>(null);
  
  // Rejection Modal State
  const [rejectingAd, setRejectingAd] = useState<Advertisement | null>(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState<string>('Creative image resolution is too low and does not meet portal quality guidelines.');
  const [customRejectionReason, setCustomRejectionReason] = useState<string>('');

  // Live Simulator State
  const [previewAd, setPreviewAd] = useState<Advertisement | null>(null);
  const [detailsAd, setDetailsAd] = useState<Advertisement | null>(null);
  const [submitterProfile, setSubmitterProfile] = useState<any>(null);
  const [isSubmitterProfileLoading, setIsSubmitterProfileLoading] = useState(false);
  const [simulatorMode, setSimulatorMode] = useState<'desktop-banner' | 'feed-inline' | 'popup-modal' | 'toast-float' | 'sms-phone'>('desktop-banner');

  // Pricing Matrix Form State
  const [editablePricing, setEditablePricing] = useState<AdPricingConfig>(pricingConfig);
  const [editableCampaignConfig, setEditableCampaignConfig] = useState<CampaignCustomizationConfig>(campaignConfig);
  const [isPlacementRatesSaving, setIsPlacementRatesSaving] = useState(false);
  const [isPlacementRatesSaved, setIsPlacementRatesSaved] = useState(false);
  const [isPopupSettingsModalOpen, setIsPopupSettingsModalOpen] = useState(false);
  const [isFeedSettingsModalOpen, setIsFeedSettingsModalOpen] = useState(false);
  const [isBannerSettingsModalOpen, setIsBannerSettingsModalOpen] = useState(false);
  const [quickFeedIndexInput, setQuickFeedIndexInput] = useState('');

  const [cachedTimeframeRates, setCachedTimeframeRates] = useState<{
    hourlyRatePkr: number;
    dailyRatePkr: number;
    weeklyRatePkr: number;
    monthlyRatePkr: number;
  }>({
    hourlyRatePkr: pricingConfig.hourlyRatePkr || 100,
    dailyRatePkr: pricingConfig.dailyRatePkr || 1500,
    weeklyRatePkr: pricingConfig.weeklyRatePkr || 8000,
    monthlyRatePkr: pricingConfig.monthlyRatePkr || 25000
  });

  const [cachedPlacementFixedRates, setCachedPlacementFixedRates] = useState<Record<string, number>>({});

  const getOccupiedPlacementCount = (placementId: AdPlacement) => {
    return ads.filter((a) => a.placement === placementId && isAdCurrentlyRunning(a)).length;
  };

  useEffect(() => {
    setEditablePricing(pricingConfig);
    setCachedTimeframeRates({
      hourlyRatePkr: pricingConfig.hourlyRatePkr || 100,
      dailyRatePkr: pricingConfig.dailyRatePkr || 1500,
      weeklyRatePkr: pricingConfig.weeklyRatePkr || 8000,
      monthlyRatePkr: pricingConfig.monthlyRatePkr || 25000
    });
  }, [pricingConfig]);
  useEffect(() => {
    setEditableCampaignConfig(campaignConfig);
  }, [campaignConfig]);
  const [isPricingSaved, setIsPricingSaved] = useState<boolean>(false);
  const [isPricingSaving, setIsPricingSaving] = useState<boolean>(false);

  const handleSavePlacementRates = async () => {
    if (!onUpdateCampaignConfig) {
      alert('Placement rate settings save is unavailable. Please contact the administrator.');
      return;
    }
    setIsPlacementRatesSaving(true);
    setIsPlacementRatesSaved(false);
    try {
      await Promise.all([
        onUpdatePricingConfig ? onUpdatePricingConfig(editablePricing) : Promise.resolve(),
        onUpdateCampaignConfig(editableCampaignConfig)
      ]);
      setIsPlacementRatesSaved(true);
      setIsPricingSaved(true);
      setTimeout(() => {
        setIsPlacementRatesSaved(false);
        setIsPricingSaved(false);
      }, 3000);
    } catch (error: any) {
      console.error('[AdminAdHub] Failed to save placement rate settings:', error);
      alert(error?.message || 'Placement rate settings could not be saved. Please try again.');
    } finally {
      setIsPlacementRatesSaving(false);
    }
  };

  const handleUpdatePlacementRate = (placementId: AdPlacement, updates: Partial<CampaignCustomizationConfig['placementOptions'][number]>) => {
    setEditableCampaignConfig((previous) => ({
      ...previous,
      placementOptions: previous.placementOptions.map((option) =>
        option.id === placementId ? { ...option, ...updates } : option
      )
    }));
  };

  const handleUpdatePopupSettings = (updates: Partial<PopupDisplaySettings>) => {
    setEditableCampaignConfig((previous) => ({
      ...previous,
      popupSettings: {
        ...(previous.popupSettings || DEFAULT_CAMPAIGN_CUSTOMIZATION_CONFIG.popupSettings),
        ...updates
      }
    }));
  };

  const handleUpdatePopupAppearance = (updates: Partial<PopupAppearanceSettings>) => {
    setEditableCampaignConfig((previous) => ({
      ...previous,
      popupAppearance: {
        ...(previous.popupAppearance || DEFAULT_POPUP_APPEARANCE),
        ...updates
      }
    }));
  };

  const handleRestorePopupAppearanceDefault = () => {
    setEditableCampaignConfig((previous) => ({
      ...previous,
      popupAppearance: { ...DEFAULT_POPUP_APPEARANCE }
    }));
  };

  const handleUpdateFeedInlineSettings = (updates: Partial<FeedInlineAdSettings>) => {
    setEditableCampaignConfig((previous) => ({
      ...previous,
      feedInlineSettings: {
        ...DEFAULT_CAMPAIGN_CUSTOMIZATION_CONFIG.feedInlineSettings,
        ...(previous.feedInlineSettings || {}),
        ...updates
      }
    }));
  };

  const handleUpdateFeedCardAppearance = (updates: Partial<FeedCardAppearanceSettings>) => {
    setEditableCampaignConfig((previous) => ({
      ...previous,
      feedCardAppearance: {
        ...(previous.feedCardAppearance || DEFAULT_FEED_CARD_APPEARANCE),
        ...updates
      }
    }));
  };

  const handleRestoreFeedCardAppearanceDefault = () => {
    setEditableCampaignConfig((previous) => ({
      ...previous,
      feedCardAppearance: { ...DEFAULT_FEED_CARD_APPEARANCE }
    }));
  };

  const handleAddFeedCustomIndex = (indexNum: number) => {
    if (indexNum <= 0 || isNaN(indexNum)) return;
    const current = editableCampaignConfig.feedInlineSettings?.customIndices || [];
    if (!current.includes(indexNum)) {
      const updated = [...current, indexNum].sort((a, b) => a - b);
      handleUpdateFeedInlineSettings({ customIndices: updated });
    }
  };

  const handleRemoveFeedCustomIndex = (indexNum: number) => {
    const current = editableCampaignConfig.feedInlineSettings?.customIndices || [];
    handleUpdateFeedInlineSettings({
      customIndices: current.filter((n) => n !== indexNum)
    });
  };

  const handleUpdateBannerAppearance = (updates: Partial<BannerAppearanceSettings>) => {
    setEditableCampaignConfig((previous) => ({
      ...previous,
      bannerAppearance: {
        ...(previous.bannerAppearance || DEFAULT_BANNER_APPEARANCE),
        ...updates
      }
    }));
  };

  const handleUpdateBannerBehavior = (updates: Partial<BannerBehaviorSettings>) => {
    setEditableCampaignConfig((previous) => ({
      ...previous,
      bannerBehavior: {
        ...(previous.bannerBehavior || DEFAULT_BANNER_BEHAVIOR),
        ...updates
      }
    }));
  };

  const handleRestoreBannerAppearanceDefault = () => {
    setEditableCampaignConfig((previous) => ({
      ...previous,
      bannerAppearance: { ...DEFAULT_BANNER_APPEARANCE },
      bannerBehavior: { ...DEFAULT_BANNER_BEHAVIOR }
    }));
  };

  const handleUpdateBannerDimensions = (updates: Partial<BannerDimensionSettings>) => {
    setEditableCampaignConfig((previous) => ({
      ...previous,
      bannerDimensions: {
        ...(previous.bannerDimensions || DEFAULT_BANNER_DIMENSIONS),
        ...updates
      }
    }));
  };

  const handleRestoreBannerDimensionsDefault = () => {
    setEditableCampaignConfig((previous) => ({
      ...previous,
      bannerDimensions: { ...DEFAULT_BANNER_DIMENSIONS }
    }));
  };

  const handleUpdatePlacementMultiplier = (placementKey: AdPlacement, newMultiplier: number) => {
    const validMultiplier = Math.max(0.05, Math.min(10.0, Number(newMultiplier.toFixed(2)) || 1.0));
    setEditablePricing(prev => ({
      ...prev,
      placementMultipliers: {
        ...prev.placementMultipliers,
        [placementKey]: validMultiplier
      }
    }));
    setEditableCampaignConfig(prev => ({
      ...prev,
      placementOptions: prev.placementOptions.map(opt =>
        opt.id === placementKey ? { ...opt, multiplier: validMultiplier } : opt
      )
    }));
  };

  const getPlacementIcon = (placement: string) => {
    switch (placement) {
      case 'top-header': return '📌';
      case 'feed-inline': return '📰';
      case 'popup-modal': return '🪟';
      case 'toast-float': return '💬';
      case 'sidebar': return '📱';
      case 'sms-broadcast': return '✉️';
      case 'promo-discount-banner': return '🏷️';
      case 'dynamic-announcement-card': return '📢';
      default: return '🎯';
    }
  };

  // Form State for Create/Edit
  const [formTitle, setFormTitle] = useState('');
  const [formType, setFormType] = useState<AdType>('banner');
  const [formTargetPages, setFormTargetPages] = useState<AdTargetPage[]>(['all']);
  const [formPlacement, setFormPlacement] = useState<AdPlacement>('top-header');
  const [formStatus, setFormStatus] = useState<AdStatus>('active');
  const [formHeadline, setFormHeadline] = useState('');
  const [formBodyText, setFormBodyText] = useState('');
  const [formImageUrl, setFormImageUrl] = useState('');
  const [formCtaText, setFormCtaText] = useState('Learn More');
  const [formCtaUrl, setFormCtaUrl] = useState('#jobs');
  const [formBadgeText, setFormBadgeText] = useState('Sponsored');
  const [formTheme, setFormTheme] = useState<AdTheme>('emerald');
  const [formDismissable, setFormDismissable] = useState(true);
  const [formAutoCloseDelay, setFormAutoCloseDelay] = useState(0);

  // Duration State for Form
  const [formDurationUnit, setFormDurationUnit] = useState<AdDurationUnit>('days');
  const [formDurationValue, setFormDurationValue] = useState<number>(1);

  // SMS specific state
  const [formSmsSenderId, setFormSmsSenderId] = useState('HybridJobsPK');
  const [formSmsAudience, setFormSmsAudience] = useState<'All Registered Users' | 'Pro Subscribers Only' | 'Job Seekers' | 'Employers'>('All Registered Users');

  // Pending Approvals List
  const pendingAds = ads.filter((a) => a.status === 'pending_approval' || a.approvalStatus === 'Pending');

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingAd(null);
    setFormTitle('New Administrative Campaign');
    setFormType('banner');
    setFormTargetPages(['all']);
    setFormPlacement('top-header');
    setFormStatus('active');
    setFormDurationUnit('days');
    setFormDurationValue(7);
    setFormHeadline('Accelerate Your Career with Top Verified Opportunities');
    setFormBodyText('Explore verified high-paying local and international remote positions with direct employer contracts.');
    setFormImageUrl('https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=1200&auto=format&fit=crop&q=80');
    setFormCtaText('Explore Jobs');
    setFormCtaUrl('#jobs');
    setFormBadgeText('Sponsored Partner');
    setFormTheme('emerald');
    setFormDismissable(true);
    setFormAutoCloseDelay(0);
    setFormSmsSenderId('HybridJobsPK');
    setFormSmsAudience('All Registered Users');
    setIsEditorOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (ad: Advertisement) => {
    setEditingAd(ad);
    setFormTitle(ad.title);
    setFormType(ad.type);
    setFormTargetPages(ad.targetPages);
    setFormPlacement(ad.placement);
    setFormStatus(ad.status);
    setFormDurationUnit(ad.durationUnit || 'days');
    setFormDurationValue(ad.durationValue || 1);
    setFormHeadline(ad.headline);
    setFormBodyText(ad.bodyText);
    setFormImageUrl(ad.imageUrl || '');
    setFormCtaText(ad.ctaText || '');
    setFormCtaUrl(ad.ctaUrl || '');
    setFormBadgeText(ad.badgeText || '');
    setFormTheme(ad.theme || 'emerald');
    setFormDismissable(ad.dismissable);
    setFormAutoCloseDelay(ad.autoCloseDelay || 0);
    setFormSmsSenderId(ad.smsSenderId || 'HybridJobsPK');
    setFormSmsAudience(ad.smsAudience || 'All Registered Users');
    setIsEditorOpen(true);
  };

  // Save Ad (Create / Update)
  const handleSaveAd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formHeadline.trim()) {
      alert('Please provide a headline or message for the advertisement.');
      return;
    }

    const calc = calculateCampaignCost(
      editablePricing,
      formDurationUnit,
      formDurationValue,
      formPlacement,
      formTargetPages,
      formType === 'sms' ? 3450 : 0
    );

    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 16);
    const endTimestamp = new Date(Date.now() + calc.durationHours * 60 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 16);

    const adData: Advertisement = {
      id: editingAd ? editingAd.id : 'ad-' + Date.now(),
      title: formTitle.trim() || 'Untitled Campaign',
      type: formType,
      targetPages: formTargetPages.length > 0 ? formTargetPages : ['all'],
      placement: formPlacement,
      status: formStatus,
      approvalStatus: editingAd?.approvalStatus || 'Approved',
      submittedByUserId: editingAd ? editingAd.submittedByUserId : 'admin',
      submittedByUserName: editingAd ? editingAd.submittedByUserName : 'System Admin',
      durationUnit: formDurationUnit,
      durationValue: formDurationValue,
      durationDisplay: calc.durationDisplay,
      scheduledStartAt: editingAd?.scheduledStartAt || nowStr,
      scheduledEndAt: editingAd?.scheduledEndAt || endTimestamp,
      campaignCostPkr: editingAd ? editingAd.campaignCostPkr : calc.totalCostPkr,
      paymentStatus: editingAd ? editingAd.paymentStatus : 'Paid',
      headline: formHeadline.trim(),
      bodyText: formBodyText.trim(),
      imageUrl: formImageUrl.trim() || undefined,
      ctaText: formCtaText.trim() || undefined,
      ctaUrl: formCtaUrl.trim() || undefined,
      badgeText: formBadgeText.trim() || undefined,
      theme: formTheme,
      dismissable: formDismissable,
      autoCloseDelay: formAutoCloseDelay > 0 ? formAutoCloseDelay : undefined,
      smsSenderId: formType === 'sms' ? formSmsSenderId : undefined,
      smsAudience: formType === 'sms' ? formSmsAudience : undefined,
      smsRecipientsCount: formType === 'sms' ? (editingAd ? editingAd.smsRecipientsCount : 3450) : undefined,
      smsSentAt: formType === 'sms' ? (editingAd ? editingAd.smsSentAt : nowStr) : undefined,
      smsStatus: formType === 'sms' ? (editingAd ? editingAd.smsStatus : 'Sent') : undefined,
      impressions: editingAd ? editingAd.impressions : 0,
      clicks: editingAd ? editingAd.clicks : 0,
      createdAt: editingAd ? editingAd.createdAt : nowStr,
      updatedAt: nowStr
    };

    if (editingAd) {
      onUpdateAd(adData);
    } else {
      onAddAd(adData);
    }

    setIsEditorOpen(false);
    setEditingAd(null);
  };

  // Approve Ad Handler
  const handleApprove = (ad: Advertisement) => {
    if (onApproveAd) {
      onApproveAd(ad.id);
      return;
    }

    const now = new Date();
    const nowStr = now.toISOString().replace('T', ' ').substring(0, 16);
    
    const calc = calculateCampaignCost(
      editablePricing,
      ad.durationUnit || 'days',
      ad.durationValue || 1,
      ad.placement,
      ad.targetPages
    );
    
    const endTimestamp = new Date(now.getTime() + calc.durationHours * 60 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 16);

    onUpdateAd({
      ...ad,
      status: 'active',
      approvalStatus: 'Approved',
      scheduledStartAt: nowStr,
      scheduledEndAt: endTimestamp,
      approvedAt: nowStr,
      approvedBy: 'Admin'
    });
  };

  // Load the advertiser's safe, admin-authorized profile when campaign details are opened.
  const handleOpenCampaignDetails = async (ad: Advertisement) => {
    setDetailsAd(ad);
    setSubmitterProfile(null);
    if (!ad.submittedByUserId || ad.submittedByUserId === 'admin') return;
    setIsSubmitterProfileLoading(true);
    try {
      const response = await api.users.getProfile(String(ad.submittedByUserId));
      if (response?.success && response.user) setSubmitterProfile(response.user);
    } catch (error) {
      console.warn('[AdminAdHub] Could not load advertiser profile:', error);
    } finally {
      setIsSubmitterProfileLoading(false);
    }
  };

  // Confirm Rejection Handler
  const handleConfirmRejection = () => {
    if (!rejectingAd) return;

    const resolvedReason = rejectionReasonInput === 'Other (Specify Custom Reason)' ? customRejectionReason.trim() : rejectionReasonInput.trim();
    if (!resolvedReason) {
      alert('Please enter a clear rejection reason before continuing.');
      return;
    }

    if (onRejectAd) {
      onRejectAd(rejectingAd.id, resolvedReason);
      setRejectingAd(null);
      return;
    }

    onUpdateAd({
      ...rejectingAd,
      status: 'rejected',
      approvalStatus: 'Rejected',
      rejectionReason: resolvedReason,
      rejectedAt: new Date().toISOString().replace('T', ' ').substring(0, 16)
    });
    setRejectingAd(null);
  };

  // Save only after the authoritative API confirms persistence.
  const handleSavePricingConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onUpdatePricingConfig) {
      alert('Ad pricing save is unavailable. Please contact the administrator.');
      return;
    }

    setIsPricingSaving(true);
    setIsPricingSaved(false);
    try {
      await Promise.all([
        onUpdatePricingConfig(editablePricing),
        onUpdateCampaignConfig ? onUpdateCampaignConfig(editableCampaignConfig) : Promise.resolve()
      ]);
      setIsPricingSaved(true);
      setIsPlacementRatesSaved(true);
      setTimeout(() => {
        setIsPricingSaved(false);
        setIsPlacementRatesSaved(false);
      }, 3000);
    } catch (error: any) {
      console.error('[AdminAdHub] Failed to save authoritative ad pricing:', error);
      alert(error?.message || 'Ad pricing could not be saved. Please try again.');
    } finally {
      setIsPricingSaving(false);
    }
  };

  // Image Upload helper
  const handleImageFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setFormImageUrl(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Total Performance Metrics
  const totalImpressions = ads.reduce((acc, curr) => acc + (curr.impressions || 0), 0);
  const totalClicks = ads.reduce((acc, curr) => acc + (curr.clicks || 0), 0);
  const overallCtr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : '0.00';
  const activeCount = ads.filter((a) => a.status === 'active').length;

  // Filtered Ads Directory
  const filteredAds = ads.filter((ad) => {
    if (filterType !== 'all' && ad.type !== filterType) return false;
    if (filterStatus !== 'all' && ad.status !== filterStatus) return false;
    if (filterPage !== 'all') {
      if (!ad.targetPages.includes('all') && !ad.targetPages.includes(filterPage as AdTargetPage)) {
        return false;
      }
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        ad.title.toLowerCase().includes(q) ||
        ad.headline.toLowerCase().includes(q) ||
        (ad.submittedByUserName && ad.submittedByUserName.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="admin-settings-mobile-compact space-y-6 text-white">
      
      {/* Top Metrics Cards */}
      {mode === 'full' && (
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-semibold">Pending Approvals</div>
            <div className="text-xl font-black text-amber-300">{pendingAds.length} <span className="text-xs font-normal text-slate-500">Queued</span></div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
            <Megaphone className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-semibold">Active Campaigns</div>
            <div className="text-xl font-black text-white">{activeCount} <span className="text-xs font-normal text-slate-500">/ {ads.length} Total</span></div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
            <Eye className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-semibold">Total Impressions</div>
            <div className="text-xl font-black text-indigo-300">{totalImpressions.toLocaleString()}</div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center border border-teal-500/30">
            <MousePointerClick className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-semibold">Total Clicks & CTR</div>
            <div className="text-xl font-black text-teal-300">{totalClicks.toLocaleString()} ({overallCtr}%)</div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center border border-purple-500/30">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-semibold">Rate Matrix</div>
            <div className="text-xl font-black text-purple-300">PKR {editablePricing.dailyRatePkr}/day</div>
          </div>
        </div>
      </div>
      )}

      {/* Main Admin Sub-Tabs Navigation */}
      {mode === 'full' && (
      <div className="flex flex-nowrap items-center space-x-2 border-b border-slate-800 pb-3 overflow-x-auto overscroll-x-contain touch-pan-x text-xs font-bold">
        <button
          onClick={() => setActiveTab('approvals')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer shrink-0 whitespace-nowrap ${
            activeTab === 'approvals'
              ? 'bg-amber-500 text-slate-950 font-extrabold shadow-lg shadow-amber-500/20'
              : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Pending Approvals Queue ({pendingAds.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('slots')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer shrink-0 whitespace-nowrap ${
            activeTab === 'slots'
              ? 'bg-emerald-500 text-slate-950 font-extrabold shadow-lg shadow-emerald-500/20'
              : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Placement Slots & Live Timeline</span>
        </button>

        {canManageAdConfiguration && isPricingReady && <button
          onClick={() => setActiveTab('customizer')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer shrink-0 whitespace-nowrap ${
            activeTab === 'customizer'
              ? 'bg-indigo-500 text-white font-extrabold shadow-lg shadow-indigo-500/20'
              : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Campaign Options & Page Scheduler</span>
        </button>}

        <button
          onClick={() => setActiveTab('directory')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer shrink-0 whitespace-nowrap ${
            activeTab === 'directory'
              ? 'bg-emerald-500 text-slate-950 font-extrabold shadow-lg shadow-emerald-500/20'
              : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>All Campaigns Directory ({ads.length})</span>
        </button>

        {canManageAdConfiguration && isPricingReady && <button
          onClick={() => setActiveTab('pricing')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer shrink-0 whitespace-nowrap ${
            activeTab === 'pricing'
              ? 'bg-emerald-500 text-slate-950 font-extrabold shadow-lg shadow-emerald-500/20'
              : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>Rate Card & Pricing Matrix</span>
        </button>}

        <button
          onClick={() => setActiveTab('performance')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer shrink-0 whitespace-nowrap ${
            activeTab === 'performance'
              ? 'bg-gradient-to-r from-teal-500 to-indigo-500 text-white font-extrabold shadow-lg shadow-teal-500/20'
              : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
          }`}
        >
          <TrendingUp className="w-4 h-4 text-teal-300" />
          <span>Ad Performance & Yield Charts</span>
        </button>
      </div>
      )}

      {mode !== 'full' && (!canManageAdConfiguration || !isPricingReady) && (
        <div className="rounded-2xl border border-amber-500/30 bg-slate-900 p-5 text-xs text-amber-200 space-y-1">
          <div className="font-black text-sm">
            {!canManageAdConfiguration ? 'Finance Permission Required' : 'Waiting for Authoritative Pricing Configuration'}
          </div>
          <p className="text-slate-400">
            {!canManageAdConfiguration
              ? 'Ad Rate Card and Campaign Display configuration require Finance management permission.'
              : 'Authoritative pricing settings are still loading or failed to load from the server.'}
          </p>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: PENDING APPROVALS QUEUE */}
      {/* ========================================================================= */}
      {activeTab === 'approvals' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex items-center justify-between">
            <div>
              <h3 className="text-base font-black text-white flex items-center space-x-2">
                <Clock className="w-5 h-5 text-amber-400" />
                <span>User Campaign Approval Queue</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Review self-serve advertiser submissions. Approve to publish immediately, or reject with a reason to initiate an automatic wallet refund.
              </p>
            </div>
            <span className="px-3 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full text-xs font-bold font-mono">
              {pendingAds.length} Awaiting Verification
            </span>
          </div>

          {pendingAds.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/20">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h4 className="text-lg font-bold text-white">No Pending Campaign Approvals</h4>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                All user submitted campaigns have been reviewed. New advertiser submissions will appear here automatically.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {pendingAds.map((ad) => (
                <div key={ad.id} className="bg-slate-900 border border-amber-500/30 rounded-2xl p-5 shadow-xl space-y-4">
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    
                    {/* Left details */}
                    <div className="flex items-start space-x-4">
                      {ad.imageUrl ? (
                        <img src={ad.imageUrl} alt={ad.headline} className="w-20 h-20 rounded-xl object-cover border border-slate-700 shadow-md shrink-0" />
                      ) : (
                        <div className="w-20 h-20 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-500 shrink-0">
                          <ImageIcon className="w-8 h-8" />
                        </div>
                      )}

                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[11px] font-black uppercase">
                            Pending Admin Review
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 text-[10px] font-semibold">
                            {getPlacementDisplayName(ad.placement)}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 text-[10px] font-bold">
                            ⏱️ {ad.durationDisplay || '24 Hours'}
                          </span>
                        </div>

                        <h4 className="text-base font-bold text-white">{ad.headline}</h4>
                        <p className="text-xs text-slate-400 max-w-2xl">{ad.bodyText}</p>

                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 pt-1">
                          <span>Advertiser: <button type="button" onClick={() => handleOpenCampaignDetails(ad)} className="text-white underline decoration-dotted underline-offset-2 hover:text-indigo-300 font-bold">{ad.submittedByUserName || 'Not provided'} ({ad.submittedByUserEmail || 'Not provided'})</button></span>
                          <span>•</span>
                          <span>{ad.paymentStatus === 'Escrow' ? 'Fee Held in Escrow:' : 'Fee Paid:'} <strong className="text-emerald-400 font-mono">PKR {(ad.campaignCostPkr || 0).toLocaleString()}</strong></span>
                          <span>•</span>
                          <span>Target Pages: <strong className="text-slate-200">{ad.targetPages.map(getPageDisplayName).join(', ')}</strong></span>
                        </div>
                      </div>
                    </div>

                    {/* Right actions */}
                    <div className="flex items-center space-x-2 w-full md:w-auto justify-end">
                      <button
                        onClick={() => handleOpenCampaignDetails(ad)}
                        className="px-3 py-2 bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-200 border border-indigo-500/30 rounded-xl text-xs font-bold flex items-center space-x-1.5 cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Details</span>
                      </button>

                      <button
                        onClick={() => {
                          setPreviewAd(ad);
                          setSimulatorMode(ad.placement === 'top-header' ? 'desktop-banner' : ad.placement === 'popup-modal' ? 'popup-modal' : 'feed-inline');
                        }}
                        className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center space-x-1.5 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Preview</span>
                      </button>

                      <button
                        onClick={() => handleApprove(ad)}
                        className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-xs font-black flex items-center space-x-1.5 shadow-lg shadow-emerald-500/20 cursor-pointer active:scale-95"
                      >
                        <Check className="w-4 h-4 stroke-[3]" />
                        <span>Approve & Publish</span>
                      </button>

                      <button
                        onClick={() => {
                          setRejectingAd(ad);
                          setRejectionReasonInput('Creative image resolution is too low and does not meet portal quality guidelines.');
                        }}
                        className="px-4 py-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded-xl text-xs font-bold flex items-center space-x-1.5 cursor-pointer active:scale-95"
                      >
                        <X className="w-4 h-4 stroke-[3]" />
                        <span>Reject & Refund</span>
                      </button>
                    </div>

                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: PLACEMENT SLOTS & SCHEDULE TIMELINE */}
      {/* ========================================================================= */}
      {activeTab === 'slots' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex items-center justify-between">
            <div>
              <h3 className="text-base font-black text-white flex items-center space-x-2">
                <Calendar className="w-5 h-5 text-emerald-400" />
                <span>Placement Slots & Live Running Schedule</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Inspect which campaign is currently live in each placement slot, when it expires, and which campaign is queued next.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {[
              { slot: 'top-header' as AdPlacement, title: 'Top Sticky Header Announcement Banner', desc: 'Sits above navigation bar on all pages' },
              { slot: 'feed-inline' as AdPlacement, title: 'Job Listings Feed Inline Card', desc: 'Appears after every 3-4 job cards' },
              { slot: 'popup-modal' as AdPlacement, title: 'Centered Pop-up Lightbox Modal', desc: 'Prominent modal on user entrance' },
              { slot: 'toast-float' as AdPlacement, title: 'Floating Toast Notification Alert', desc: 'Bottom-right alert card' },
              { slot: 'sidebar' as AdPlacement, title: 'Sidebar / Filter Widget Card', desc: 'Filter column promotional box' },
              { slot: 'sms-broadcast' as AdPlacement, title: 'Direct SMS Text Broadcast', desc: 'Direct phone dispatch to subscribers' }
            ].map(({ slot, title, desc }) => {
              const currentRunningAds = ads.filter((a) => a.placement === slot && isAdCurrentlyRunning(a));
              const queuedAds = ads.filter((a) => a.placement === slot && (a.status === 'pending_approval' || a.approvalStatus === 'Approved') && !isAdCurrentlyRunning(a));
              const activeSlotAd = currentRunningAds[0];

              return (
                <div key={slot} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
                  
                  {/* Slot Header */}
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div>
                      <div className="text-sm font-black text-white">{title}</div>
                      <div className="text-[11px] text-slate-400">{desc}</div>
                    </div>
                    {activeSlotAd ? (
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-black uppercase flex items-center space-x-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping mr-1"></span>
                        <span>Slot Occupied</span>
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 text-[10px] font-bold uppercase">
                        Slot Available
                      </span>
                    )}
                  </div>

                  {/* Currently Running Card */}
                  <div className="space-y-2">
                    <div className="text-[11px] font-bold uppercase text-slate-400">Currently Running Campaign:</div>
                    {activeSlotAd ? (
                      <div className="p-4 rounded-2xl bg-slate-950 border border-emerald-500/40 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-white line-clamp-1">{activeSlotAd.headline}</span>
                          <span className="text-[11px] font-black text-emerald-400 font-mono">
                            {formatTimeRemaining(activeSlotAd.scheduledEndAt)}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 line-clamp-1">{activeSlotAd.bodyText}</p>
                        <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-800/80">
                          <span>By: <strong className="text-slate-300">{activeSlotAd.submittedByUserName || 'System Admin'}</strong></span>
                          <span>Ends: <strong className="text-slate-300">{activeSlotAd.scheduledEndAt || 'Ongoing'}</strong></span>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 rounded-2xl bg-slate-950/60 border border-dashed border-slate-800 text-center text-xs text-slate-500">
                        No active campaign running in this placement slot right now.
                      </div>
                    )}
                  </div>

                  {/* Next in Line Queue */}
                  <div className="space-y-1.5 pt-1">
                    <div className="text-[11px] font-bold uppercase text-slate-400 flex items-center justify-between">
                      <span>Next in Queue / Scheduled:</span>
                      <span className="text-[10px] text-slate-500">{queuedAds.length} in queue</span>
                    </div>

                    {queuedAds.length > 0 ? (
                      <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-indigo-300 line-clamp-1">{queuedAds[0].headline}</span>
                          <span className="text-[10px] text-amber-400 font-bold capitalize">{queuedAds[0].status.replace('_', ' ')}</span>
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Advertiser: {queuedAds[0].submittedByUserName || 'User'} • Duration: {queuedAds[0].durationDisplay || '24 Hours'}
                        </div>
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-500 italic">
                        No campaigns queued for this slot.
                      </div>
                    )}
                  </div>

                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: ALL CAMPAIGNS DIRECTORY */}
      {/* ========================================================================= */}
      {activeTab === 'directory' && (
        <div className="space-y-4">
          
          {/* Control Bar: Search & Action */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-black text-white flex items-center space-x-2">
                  <Layers className="w-5 h-5 text-emerald-400" />
                  <span>Campaigns Master Directory</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Manage, duplicate, toggle status, and inspect analytics for all user and admin campaigns.
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => onResetAdMetrics()}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold flex items-center space-x-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Reset Counters</span>
                </button>

                <button
                  onClick={handleOpenCreate}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-xs font-black flex items-center space-x-1.5 shadow-lg shadow-emerald-500/20 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>New Admin Campaign</span>
                </button>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 pt-2.5 border-t border-slate-800">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search campaigns..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                />
              </div>

              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
              >
                <option value="all">All Formats</option>
                <option value="banner">Image Banner</option>
                <option value="popup">Modal Pop-up</option>
                <option value="notification">Toast Float</option>
                <option value="sms">SMS Broadcast</option>
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active (Running)</option>
                <option value="pending_approval">Pending Approval</option>
                <option value="paused">Paused</option>
                <option value="rejected">Rejected</option>
              </select>

              <select
                value={filterPage}
                onChange={(e) => setFilterPage(e.target.value)}
                className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
              >
                <option value="all">All Pages</option>
                <option value="jobs">Jobs Feed</option>
                <option value="cv">ATS CV Builder</option>
                <option value="alerts">Job Alerts</option>
                <option value="dashboard">Dashboard</option>
              </select>
            </div>
          </div>

          {/* Directory Cards */}
          <div className="grid grid-cols-1 gap-4">
            {filteredAds.map((ad) => (
              <div key={ad.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  
                  <div className="flex items-start space-x-4">
                    {ad.imageUrl ? (
                      <img src={ad.imageUrl} alt={ad.headline} className="w-16 h-16 rounded-xl object-cover border border-slate-700 shrink-0" />
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-500 shrink-0">
                        <ImageIcon className="w-6 h-6" />
                      </div>
                    )}

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                          ad.status === 'active' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                          ad.status === 'pending_approval' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                          ad.status === 'rejected' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
                          'bg-slate-800 text-slate-400'
                        }`}>
                          {ad.status.replace('_', ' ')}
                        </span>
                        <span className="text-[10px] font-semibold text-slate-400">
                          {getPlacementDisplayName(ad.placement)}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          • {ad.durationDisplay || '24 Hours'}
                        </span>
                      </div>

                      <h4 className="text-sm font-bold text-white">{ad.headline}</h4>
                      <div className="text-xs text-slate-400 line-clamp-1 max-w-xl">{ad.bodyText}</div>

                      <div className="text-[11px] text-slate-500">
                        Advertiser: <strong className="text-slate-300">{ad.submittedByUserName || 'Admin'}</strong> • Fee: <strong className="text-emerald-400 font-mono">PKR {(ad.campaignCostPkr || 0).toLocaleString()}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => {
                        setPreviewAd(ad);
                        setSimulatorMode(ad.placement === 'top-header' ? 'desktop-banner' : ad.placement === 'popup-modal' ? 'popup-modal' : 'feed-inline');
                      }}
                      className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl"
                      title="Preview"
                    >
                      <Eye className="w-4 h-4 text-indigo-400" />
                    </button>

                    <button
                      onClick={() => handleOpenEdit(ad)}
                      className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl"
                      title="Edit"
                    >
                      <Edit3 className="w-4 h-4 text-emerald-400" />
                    </button>

                    <button
                      onClick={() => {
                        if (window.confirm(`Reset analytics for campaign "${ad.title}"? Impressions and clicks will be set to zero.`)) {
                          onResetAdMetrics(ad.id);
                        }
                      }}
                      className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl"
                      title="Reset campaign analytics"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => {
                        if (confirm(`Delete campaign "${ad.title}"?`)) {
                          onDeleteAd(ad.id);
                        }
                      }}
                      className="p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-xl"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                </div>

                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 pt-3 border-t border-slate-800/60 text-xs text-slate-400">
                  <div>Impressions: <strong className="text-white">{(ad.impressions || 0).toLocaleString()}</strong></div>
                  <div>Clicks: <strong className="text-white">{(ad.clicks || 0).toLocaleString()}</strong></div>
                  <div>CTR: <strong className="text-white">{(ad.impressions || 0) > 0 ? (((ad.clicks || 0) / ad.impressions) * 100).toFixed(2) : '0.00'}%</strong></div>
                  <div className="text-right text-[11px] text-slate-500">Ends: {ad.scheduledEndAt || 'Ongoing'}</div>
                </div>
              </div>
            ))}
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: CAMPAIGN OPTIONS & PORTAL PAGE SCHEDULER */}
      {/* ========================================================================= */}
      {activeTab === 'customizer' && canManageAdConfiguration && isPricingReady && (
        <AdminCampaignCustomizer
          config={campaignConfig}
          onSaveConfig={(updated) => {
            if (!onUpdateCampaignConfig) {
              throw new Error('Campaign settings save is unavailable.');
            }
            return onUpdateCampaignConfig(updated);
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* TAB 4: RATE CARD & PRICING MATRIX CONFIGURATION */}
      {/* ========================================================================= */}
      {activeTab === 'pricing' && canManageAdConfiguration && isPricingReady && (
        <div className="space-y-6">
          <form onSubmit={handleSavePricingConfig} className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-7 shadow-2xl space-y-6">
            
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-black uppercase tracking-wider text-emerald-400">
                    Live Rate Card · Single Source of Truth
                  </span>
                </div>
                <h3 className="text-lg font-black text-white flex items-center space-x-2 mt-1">
                  <Settings className="w-5 h-5 text-emerald-400" />
                  <span>Advertising Rate Card &amp; Matrix Configuration</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Configure base duration rates, placement multipliers, slot caps, and page distribution charges. Updates take effect immediately in the user campaign calculator.
                </p>
              </div>

              <div className="flex items-center gap-3">
                {isPricingSaved && (
                  <span role="status" className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 rounded-xl">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    Saved to database
                  </span>
                )}
                <button
                  type="submit"
                  disabled={isPricingSaving}
                  className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black text-xs sm:text-sm rounded-xl shadow-lg shadow-emerald-500/20 flex items-center space-x-2 cursor-pointer active:scale-95 disabled:opacity-60 disabled:cursor-wait"
                >
                  {isPricingSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 stroke-[3]" />}
                  <span>{isPricingSaving ? 'Saving...' : 'Save Rate Matrix'}</span>
                </button>
              </div>
            </div>

            {/* 1. Base Duration Rates (Compact PKR inputs, Timeframe Weights & Integrated Placement Multipliers Matrix) */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-emerald-400" />
                  <span>1. Baseline Timeframe Rates (PKR) &amp; Placement Multipliers</span>
                </h4>
                <span className="text-[10px] text-slate-500 font-medium">Free/Paid per timeframe · Compact numeric fees · Live multiplier calculations</span>
              </div>

              {/* 4 Baseline Timeframe Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {/* Hourly */}
                <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-2.5">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span>⚡</span> Base Hourly Rate
                    </span>
                    <select
                      value={editablePricing.hourlyRatePkr === 0 ? 'free' : 'paid'}
                      onChange={(e) => {
                        if (e.target.value === 'free') {
                          setEditablePricing(prev => ({ ...prev, hourlyRatePkr: 0 }));
                        } else {
                          setEditablePricing(prev => ({ ...prev, hourlyRatePkr: cachedTimeframeRates.hourlyRatePkr || 100 }));
                        }
                      }}
                      className="px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-700 text-[11px] text-emerald-400 font-bold"
                    >
                      <option value="paid">Paid Mode</option>
                      <option value="free">100% Free</option>
                    </select>
                  </div>
                  {editablePricing.hourlyRatePkr > 0 ? (
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-slate-400 font-bold">Fee (PKR):</span>
                      <input
                        type="number"
                        min="0"
                        step="10"
                        value={editablePricing.hourlyRatePkr}
                        onChange={(e) => {
                          const val = Math.max(0, parseInt(e.target.value) || 0);
                          setEditablePricing(prev => ({ ...prev, hourlyRatePkr: val }));
                          if (val > 0) setCachedTimeframeRates(prev => ({ ...prev, hourlyRatePkr: val }));
                        }}
                        className="w-24 px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-sm font-black text-emerald-400 font-mono text-center"
                      />
                    </div>
                  ) : (
                    <div className="text-xs text-emerald-400 font-bold py-0.5">✨ Free Mode Active (0 PKR)</div>
                  )}

                  {/* Timeframe Weight */}
                  <div className="flex items-center justify-between pt-1.5 border-t border-slate-800/80 text-[10px]">
                    <span className="text-slate-400 font-medium">Timeframe Weight:</span>
                    <div className="flex items-center space-x-1">
                      <input
                        type="number"
                        step="0.05"
                        min="0.1"
                        max="5.0"
                        value={editablePricing.timeframeMultipliers?.hourly ?? 1.0}
                        onChange={(e) => {
                          const m = parseFloat(e.target.value) || 1.0;
                          setEditablePricing(prev => ({
                            ...prev,
                            timeframeMultipliers: {
                              ...(prev.timeframeMultipliers || { hourly: 1.0, daily: 1.0, weekly: 0.85, monthly: 0.65 }),
                              hourly: m
                            }
                          }));
                        }}
                        className="w-16 px-1.5 py-0.5 bg-slate-900 border border-slate-700 rounded text-center text-xs font-mono font-bold text-emerald-400"
                      />
                      <span className="text-slate-500 font-mono">x</span>
                    </div>
                  </div>

                  {/* Quick placement multiplier preview */}
                  <div className="bg-slate-900/60 rounded-lg p-2 text-[10px] space-y-1 border border-slate-800/50">
                    <span className="text-slate-400 font-bold block text-[9px] uppercase tracking-wider">Placement Multiplier Preview:</span>
                    <div className="flex flex-wrap gap-1 text-[9px]">
                      <span className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-300 font-mono">
                        Header ({editablePricing.placementMultipliers?.['top-header'] || 1.25}x):{' '}
                        <strong className="text-emerald-400">
                          {editablePricing.hourlyRatePkr === 0 ? 'Free' : `PKR ${Math.round(editablePricing.hourlyRatePkr * (editablePricing.placementMultipliers?.['top-header'] || 1.25)).toLocaleString()}`}
                        </strong>
                      </span>
                      <span className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-300 font-mono">
                        Popup ({editablePricing.placementMultipliers?.['popup-modal'] || 1.5}x):{' '}
                        <strong className="text-amber-400">
                          {editablePricing.hourlyRatePkr === 0 ? 'Free' : `PKR ${Math.round(editablePricing.hourlyRatePkr * (editablePricing.placementMultipliers?.['popup-modal'] || 1.5)).toLocaleString()}`}
                        </strong>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Daily */}
                <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-2.5">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span>📅</span> 24h / 1 Day Rate
                    </span>
                    <select
                      value={editablePricing.dailyRatePkr === 0 ? 'free' : 'paid'}
                      onChange={(e) => {
                        if (e.target.value === 'free') {
                          setEditablePricing(prev => ({ ...prev, dailyRatePkr: 0 }));
                        } else {
                          setEditablePricing(prev => ({ ...prev, dailyRatePkr: cachedTimeframeRates.dailyRatePkr || 1500 }));
                        }
                      }}
                      className="px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-700 text-[11px] text-emerald-400 font-bold"
                    >
                      <option value="paid">Paid Mode</option>
                      <option value="free">100% Free</option>
                    </select>
                  </div>
                  {editablePricing.dailyRatePkr > 0 ? (
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-slate-400 font-bold">Fee (PKR):</span>
                      <input
                        type="number"
                        min="0"
                        step="50"
                        value={editablePricing.dailyRatePkr}
                        onChange={(e) => {
                          const val = Math.max(0, parseInt(e.target.value) || 0);
                          setEditablePricing(prev => ({ ...prev, dailyRatePkr: val }));
                          if (val > 0) setCachedTimeframeRates(prev => ({ ...prev, dailyRatePkr: val }));
                        }}
                        className="w-24 px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-sm font-black text-emerald-400 font-mono text-center"
                      />
                    </div>
                  ) : (
                    <div className="text-xs text-emerald-400 font-bold py-0.5">✨ Free Mode Active (0 PKR)</div>
                  )}

                  {/* Timeframe Weight */}
                  <div className="flex items-center justify-between pt-1.5 border-t border-slate-800/80 text-[10px]">
                    <span className="text-slate-400 font-medium">Timeframe Weight:</span>
                    <div className="flex items-center space-x-1">
                      <input
                        type="number"
                        step="0.05"
                        min="0.1"
                        max="5.0"
                        value={editablePricing.timeframeMultipliers?.daily ?? 1.0}
                        onChange={(e) => {
                          const m = parseFloat(e.target.value) || 1.0;
                          setEditablePricing(prev => ({
                            ...prev,
                            timeframeMultipliers: {
                              ...(prev.timeframeMultipliers || { hourly: 1.0, daily: 1.0, weekly: 0.85, monthly: 0.65 }),
                              daily: m
                            }
                          }));
                        }}
                        className="w-16 px-1.5 py-0.5 bg-slate-900 border border-slate-700 rounded text-center text-xs font-mono font-bold text-emerald-400"
                      />
                      <span className="text-slate-500 font-mono">x</span>
                    </div>
                  </div>

                  {/* Quick placement multiplier preview */}
                  <div className="bg-slate-900/60 rounded-lg p-2 text-[10px] space-y-1 border border-slate-800/50">
                    <span className="text-slate-400 font-bold block text-[9px] uppercase tracking-wider">Placement Multiplier Preview:</span>
                    <div className="flex flex-wrap gap-1 text-[9px]">
                      <span className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-300 font-mono">
                        Header ({editablePricing.placementMultipliers?.['top-header'] || 1.25}x):{' '}
                        <strong className="text-emerald-400">
                          {editablePricing.dailyRatePkr === 0 ? 'Free' : `PKR ${Math.round(editablePricing.dailyRatePkr * (editablePricing.placementMultipliers?.['top-header'] || 1.25)).toLocaleString()}`}
                        </strong>
                      </span>
                      <span className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-300 font-mono">
                        Popup ({editablePricing.placementMultipliers?.['popup-modal'] || 1.5}x):{' '}
                        <strong className="text-amber-400">
                          {editablePricing.dailyRatePkr === 0 ? 'Free' : `PKR ${Math.round(editablePricing.dailyRatePkr * (editablePricing.placementMultipliers?.['popup-modal'] || 1.5)).toLocaleString()}`}
                        </strong>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Weekly */}
                <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-2.5">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span>🚀</span> 1 Week / 7 Days
                    </span>
                    <select
                      value={editablePricing.weeklyRatePkr === 0 ? 'free' : 'paid'}
                      onChange={(e) => {
                        if (e.target.value === 'free') {
                          setEditablePricing(prev => ({ ...prev, weeklyRatePkr: 0 }));
                        } else {
                          setEditablePricing(prev => ({ ...prev, weeklyRatePkr: cachedTimeframeRates.weeklyRatePkr || 8000 }));
                        }
                      }}
                      className="px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-700 text-[11px] text-indigo-300 font-bold"
                    >
                      <option value="paid">Paid Mode</option>
                      <option value="free">100% Free</option>
                    </select>
                  </div>
                  {editablePricing.weeklyRatePkr > 0 ? (
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-slate-400 font-bold">Fee (PKR):</span>
                      <input
                        type="number"
                        min="0"
                        step="100"
                        value={editablePricing.weeklyRatePkr}
                        onChange={(e) => {
                          const val = Math.max(0, parseInt(e.target.value) || 0);
                          setEditablePricing(prev => ({ ...prev, weeklyRatePkr: val }));
                          if (val > 0) setCachedTimeframeRates(prev => ({ ...prev, weeklyRatePkr: val }));
                        }}
                        className="w-24 px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-sm font-black text-indigo-400 font-mono text-center"
                      />
                    </div>
                  ) : (
                    <div className="text-xs text-emerald-400 font-bold py-0.5">✨ Free Mode Active (0 PKR)</div>
                  )}

                  {/* Timeframe Weight */}
                  <div className="flex items-center justify-between pt-1.5 border-t border-slate-800/80 text-[10px]">
                    <span className="text-slate-400 font-medium">Timeframe Weight:</span>
                    <div className="flex items-center space-x-1">
                      <input
                        type="number"
                        step="0.05"
                        min="0.1"
                        max="5.0"
                        value={editablePricing.timeframeMultipliers?.weekly ?? 0.85}
                        onChange={(e) => {
                          const m = parseFloat(e.target.value) || 0.85;
                          setEditablePricing(prev => ({
                            ...prev,
                            timeframeMultipliers: {
                              ...(prev.timeframeMultipliers || { hourly: 1.0, daily: 1.0, weekly: 0.85, monthly: 0.65 }),
                              weekly: m
                            }
                          }));
                        }}
                        className="w-16 px-1.5 py-0.5 bg-slate-900 border border-slate-700 rounded text-center text-xs font-mono font-bold text-indigo-400"
                      />
                      <span className="text-slate-500 font-mono">x</span>
                    </div>
                  </div>

                  {/* Quick placement multiplier preview */}
                  <div className="bg-slate-900/60 rounded-lg p-2 text-[10px] space-y-1 border border-slate-800/50">
                    <span className="text-slate-400 font-bold block text-[9px] uppercase tracking-wider">Placement Multiplier Preview:</span>
                    <div className="flex flex-wrap gap-1 text-[9px]">
                      <span className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-300 font-mono">
                        Header ({editablePricing.placementMultipliers?.['top-header'] || 1.25}x):{' '}
                        <strong className="text-indigo-400">
                          {editablePricing.weeklyRatePkr === 0 ? 'Free' : `PKR ${Math.round(editablePricing.weeklyRatePkr * (editablePricing.placementMultipliers?.['top-header'] || 1.25)).toLocaleString()}`}
                        </strong>
                      </span>
                      <span className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-300 font-mono">
                        Popup ({editablePricing.placementMultipliers?.['popup-modal'] || 1.5}x):{' '}
                        <strong className="text-amber-400">
                          {editablePricing.weeklyRatePkr === 0 ? 'Free' : `PKR ${Math.round(editablePricing.weeklyRatePkr * (editablePricing.placementMultipliers?.['popup-modal'] || 1.5)).toLocaleString()}`}
                        </strong>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Monthly */}
                <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-2.5">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span>👑</span> 1 Month / 30 Days
                    </span>
                    <select
                      value={editablePricing.monthlyRatePkr === 0 ? 'free' : 'paid'}
                      onChange={(e) => {
                        if (e.target.value === 'free') {
                          setEditablePricing(prev => ({ ...prev, monthlyRatePkr: 0 }));
                        } else {
                          setEditablePricing(prev => ({ ...prev, monthlyRatePkr: cachedTimeframeRates.monthlyRatePkr || 25000 }));
                        }
                      }}
                      className="px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-700 text-[11px] text-amber-300 font-bold"
                    >
                      <option value="paid">Paid Mode</option>
                      <option value="free">100% Free</option>
                    </select>
                  </div>
                  {editablePricing.monthlyRatePkr > 0 ? (
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-slate-400 font-bold">Fee (PKR):</span>
                      <input
                        type="number"
                        min="0"
                        step="500"
                        value={editablePricing.monthlyRatePkr}
                        onChange={(e) => {
                          const val = Math.max(0, parseInt(e.target.value) || 0);
                          setEditablePricing(prev => ({ ...prev, monthlyRatePkr: val }));
                          if (val > 0) setCachedTimeframeRates(prev => ({ ...prev, monthlyRatePkr: val }));
                        }}
                        className="w-24 px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-sm font-black text-amber-400 font-mono text-center"
                      />
                    </div>
                  ) : (
                    <div className="text-xs text-emerald-400 font-bold py-0.5">✨ Free Mode Active (0 PKR)</div>
                  )}

                  {/* Timeframe Weight */}
                  <div className="flex items-center justify-between pt-1.5 border-t border-slate-800/80 text-[10px]">
                    <span className="text-slate-400 font-medium">Timeframe Weight:</span>
                    <div className="flex items-center space-x-1">
                      <input
                        type="number"
                        step="0.05"
                        min="0.1"
                        max="5.0"
                        value={editablePricing.timeframeMultipliers?.monthly ?? 0.65}
                        onChange={(e) => {
                          const m = parseFloat(e.target.value) || 0.65;
                          setEditablePricing(prev => ({
                            ...prev,
                            timeframeMultipliers: {
                              ...(prev.timeframeMultipliers || { hourly: 1.0, daily: 1.0, weekly: 0.85, monthly: 0.65 }),
                              monthly: m
                            }
                          }));
                        }}
                        className="w-16 px-1.5 py-0.5 bg-slate-900 border border-slate-700 rounded text-center text-xs font-mono font-bold text-amber-400"
                      />
                      <span className="text-slate-500 font-mono">x</span>
                    </div>
                  </div>

                  {/* Quick placement multiplier preview */}
                  <div className="bg-slate-900/60 rounded-lg p-2 text-[10px] space-y-1 border border-slate-800/50">
                    <span className="text-slate-400 font-bold block text-[9px] uppercase tracking-wider">Placement Multiplier Preview:</span>
                    <div className="flex flex-wrap gap-1 text-[9px]">
                      <span className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-300 font-mono">
                        Header ({editablePricing.placementMultipliers?.['top-header'] || 1.25}x):{' '}
                        <strong className="text-amber-400">
                          {editablePricing.monthlyRatePkr === 0 ? 'Free' : `PKR ${Math.round(editablePricing.monthlyRatePkr * (editablePricing.placementMultipliers?.['top-header'] || 1.25)).toLocaleString()}`}
                        </strong>
                      </span>
                      <span className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-300 font-mono">
                        Popup ({editablePricing.placementMultipliers?.['popup-modal'] || 1.5}x):{' '}
                        <strong className="text-amber-400">
                          {editablePricing.monthlyRatePkr === 0 ? 'Free' : `PKR ${Math.round(editablePricing.monthlyRatePkr * (editablePricing.placementMultipliers?.['popup-modal'] || 1.5)).toLocaleString()}`}
                        </strong>
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Integrated Placement Multipliers (Weight Factors), Manual Simple Rates, Min Duration & Slot Occupancy */}
              <div className="mt-4 p-3.5 sm:p-5 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-3.5 shadow-inner">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-800/80 pb-3">
                  <div>
                    <h5 className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-2">
                      <Layers className="w-4 h-4 text-emerald-400" />
                      <span>Placement Multipliers (Weight Factors) Across Timeframes</span>
                    </h5>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Configure Enable/Disable, Free/Paid mode, Weight Multiplier or Manual PKR numbers (Hourly, 24h, Week, Month), Min Duration (Hours), and Slot Occupancy per placement.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-full flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      Live Calculation Matrix
                    </span>
                    <button
                      type="button"
                      onClick={handleSavePlacementRates}
                      disabled={isPlacementRatesSaving || !onUpdateCampaignConfig}
                      className="shrink-0 rounded-xl bg-teal-500 hover:bg-teal-400 px-3.5 py-1.5 text-xs font-black text-slate-950 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {isPlacementRatesSaving ? 'Saving…' : isPlacementRatesSaved ? 'Saved ✓' : 'Save Placement Settings'}
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  {editableCampaignConfig.placementOptions.map((placement) => {
                    const typedKey = placement.id;
                    const val = Number(editablePricing.placementMultipliers?.[typedKey] ?? placement.multiplier ?? 1.0);
                    const occupied = getOccupiedPlacementCount(typedKey);
                    const maxSlots = placement.maxConcurrentSlots ?? 4;
                    const isOverCapacity = occupied > maxSlots;
                    const isEnabled = placement.isEnabled !== false;
                    const isFree = Boolean(placement.isFreeOverride);
                    const hasManualValues =
                      Number(placement.fixedPriceOverridePkr || 0) > 0 ||
                      Boolean(
                        placement.timeframeFixedRatesPkr &&
                        Object.values(placement.timeframeFixedRatesPkr).some((v) => typeof v === 'number' && v > 0)
                      );
                    const isManualMode = placement.rateEditMode === 'manual' || (!placement.rateEditMode && hasManualValues);

                    const autoHourly = Math.round((editablePricing.hourlyRatePkr || 0) * val);
                    const autoDaily = Math.round((editablePricing.dailyRatePkr || 0) * val);
                    const autoWeekly = Math.round((editablePricing.weeklyRatePkr || 0) * val);
                    const autoMonthly = Math.round((editablePricing.monthlyRatePkr || 0) * val);

                    const isHourlyFree = editablePricing.hourlyRatePkr === 0;
                    const isDailyFree = editablePricing.dailyRatePkr === 0;
                    const isWeeklyFree = editablePricing.weeklyRatePkr === 0;
                    const isMonthlyFree = editablePricing.monthlyRatePkr === 0;

                    const manualTimeframes = placement.timeframeFixedRatesPkr || {};
                    const flatOverride = Number(placement.fixedPriceOverridePkr || 0) > 0 ? Number(placement.fixedPriceOverridePkr) : undefined;

                    const displayHourly = isManualMode && manualTimeframes.hourly ? manualTimeframes.hourly : isManualMode && flatOverride ? flatOverride : autoHourly;
                    const displayDaily = isManualMode && manualTimeframes.daily ? manualTimeframes.daily : isManualMode && flatOverride ? flatOverride : autoDaily;
                    const displayWeekly = isManualMode && manualTimeframes.weekly ? manualTimeframes.weekly : isManualMode && flatOverride ? flatOverride : autoWeekly;
                    const displayMonthly = isManualMode && manualTimeframes.monthly ? manualTimeframes.monthly : isManualMode && flatOverride ? flatOverride : autoMonthly;

                    const updateTimeframeFixedRate = (unitKey: 'hourly' | 'daily' | 'weekly' | 'monthly', rawValue: string) => {
                      const num = rawValue === '' ? undefined : Math.min(10000000, Math.max(0, Math.floor(Number(rawValue) || 0)));
                      const nextRates = { ...(placement.timeframeFixedRatesPkr || {}) };
                      if (num && num > 0) {
                        nextRates[unitKey] = num;
                      } else {
                        delete nextRates[unitKey];
                      }
                      handleUpdatePlacementRate(typedKey, {
                        rateEditMode: 'manual',
                        timeframeFixedRatesPkr: Object.keys(nextRates).length > 0 ? nextRates : undefined
                      });
                    };

                    return (
                      <div
                        key={typedKey}
                        className={`p-3.5 bg-slate-900/75 border rounded-2xl space-y-3 transition-all ${
                          isEnabled
                            ? 'border-slate-800 hover:border-slate-700'
                            : 'border-slate-800/50 opacity-75'
                        }`}
                      >
                        {/* Row 1: Placement Identity + Mode Controls + Enable/Disable */}
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
                          <div className="min-w-0">
                            <div className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5 flex-wrap">
                              <span>{getPlacementIcon(typedKey)}</span>
                              <span className="truncate">{placement.name || getPlacementDisplayName(typedKey)}</span>
                              <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-mono font-bold ${
                                !isEnabled
                                  ? 'bg-slate-800 text-slate-400'
                                  : isFree
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : isManualMode
                                  ? 'bg-amber-500/20 text-amber-300'
                                  : 'bg-teal-500/15 text-teal-300'
                              }`}>
                                {!isEnabled ? 'Disabled' : isFree ? 'Free Mode' : isManualMode ? 'Manual PKR' : `${val.toFixed(2)}x`}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono mt-0.5">{typedKey}</div>
                          </div>

                          <div className="flex items-center gap-2 flex-wrap">
                            {/* Free / Paid Mode */}
                            <select
                              value={isFree ? 'free' : 'paid'}
                              onChange={(e) => {
                                const makeFree = e.target.value === 'free';
                                handleUpdatePlacementRate(typedKey, { isFreeOverride: makeFree });
                              }}
                              aria-label={`${placement.name} billing mode`}
                              className="px-2 py-1 rounded-lg bg-slate-950 border border-slate-700 text-[11px] font-bold text-amber-300"
                            >
                              <option value="paid">Paid Mode</option>
                              <option value="free">100% Free</option>
                            </select>

                            {/* Multiplier vs Manual Simple Number Mode */}
                            {!isFree && (
                              <select
                                value={isManualMode ? 'manual' : 'multiplier'}
                                onChange={(e) => {
                                  const mode = e.target.value === 'manual' ? 'manual' : 'multiplier';
                                  handleUpdatePlacementRate(typedKey, { rateEditMode: mode });
                                }}
                                aria-label={`${placement.name} rate entry mode`}
                                className="px-2 py-1 rounded-lg bg-slate-950 border border-slate-700 text-[11px] font-bold text-emerald-300"
                              >
                                <option value="multiplier">Multiplier (×)</option>
                                <option value="manual">Manual (PKR)</option>
                              </select>
                            )}

                            {/* Enable / Disable Toggle */}
                            <label className="flex items-center space-x-1.5 cursor-pointer bg-slate-950 border border-slate-800 px-2.5 py-1 rounded-lg">
                              <span className="text-[11px] font-bold text-slate-300">
                                {isEnabled ? 'Enabled' : 'Disabled'}
                              </span>
                              <input
                                type="checkbox"
                                checked={isEnabled}
                                onChange={(e) => handleUpdatePlacementRate(typedKey, { isEnabled: e.target.checked })}
                                className="w-4 h-4 rounded border-slate-700 text-emerald-500 focus:ring-emerald-500"
                              />
                            </label>
                          </div>
                        </div>

                        {/* Row 2: Weight Factor (or Manual Flat Fee) + Uplift + 4 Timeframes */}
                        <div className="grid grid-cols-1 xl:grid-cols-12 gap-3 items-center">
                          {/* Left: Weight Multiplier OR Manual Simple Fee controls (5 cols) */}
                          <div className="xl:col-span-5 space-y-2">
                            {isFree ? (
                              <div className="px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs font-bold text-emerald-300">
                                ✨ 100% Free Placement Active (0 PKR across all timeframes)
                              </div>
                            ) : !isManualMode ? (
                              <div className="flex items-center gap-2 flex-wrap">
                                <div className="flex items-center space-x-1 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                                  <span className="text-[10px] text-slate-400 font-bold">Weight:</span>
                                  <input
                                    type="number"
                                    step="0.05"
                                    min="0.1"
                                    max="5.0"
                                    value={val}
                                    onChange={(e) => {
                                      const newM = parseFloat(e.target.value) || 1.0;
                                      handleUpdatePlacementMultiplier(typedKey, newM);
                                    }}
                                    className="w-16 px-1.5 py-0.5 bg-slate-900 border border-slate-700 rounded text-xs font-mono font-black text-emerald-400 text-center"
                                  />
                                  <span className="text-xs text-slate-500 font-mono font-bold">x</span>
                                </div>

                                <div className="flex items-center space-x-1">
                                  {[0.75, 1.0, 1.25, 1.5, 2.0].map((preset) => (
                                    <button
                                      key={preset}
                                      type="button"
                                      onClick={() => handleUpdatePlacementMultiplier(typedKey, preset)}
                                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold cursor-pointer transition-all ${
                                        Math.abs(val - preset) < 0.01
                                          ? 'bg-emerald-500 text-slate-950 shadow-sm'
                                          : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                                      }`}
                                    >
                                      {preset}x
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 flex-wrap">
                                <div className="flex items-center space-x-1.5 bg-slate-950 px-2.5 py-1 rounded-lg border border-amber-500/30">
                                  <span className="text-[10px] text-amber-300 font-bold">Flat Fee (All):</span>
                                  <span className="text-[10px] text-slate-500 font-bold">PKR</span>
                                  <input
                                    type="number"
                                    min="0"
                                    max="10000000"
                                    step="50"
                                    value={placement.fixedPriceOverridePkr ?? ''}
                                    placeholder="Per box →"
                                    onChange={(e) => {
                                      const raw = e.target.value;
                                      const amount = raw === '' ? 0 : Number(raw);
                                      const finalVal = !Number.isFinite(amount) || amount <= 0 ? undefined : Math.min(10000000, amount);
                                      handleUpdatePlacementRate(typedKey, { rateEditMode: 'manual', fixedPriceOverridePkr: finalVal });
                                      if (finalVal) setCachedPlacementFixedRates(prev => ({ ...prev, [typedKey]: finalVal }));
                                    }}
                                    className="w-24 px-2 py-0.5 bg-slate-900 border border-slate-700 rounded text-xs font-mono font-bold text-white text-center"
                                  />
                                </div>
                                <span className="text-[10px] text-slate-400">
                                  Or set each timeframe rate →
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Right: 4 Timeframe Rates (Live Calculated OR Manual Simple Number Inputs) (7 cols) */}
                          <div className="xl:col-span-7 grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {/* Hourly */}
                            <div
                              onClick={() => {
                                if (!isFree && !isManualMode) {
                                  handleUpdatePlacementRate(typedKey, { rateEditMode: 'manual' });
                                }
                              }}
                              className={`px-2.5 py-1.5 bg-slate-950/85 border rounded-xl text-center transition-colors ${
                                isManualMode && !isFree
                                  ? 'border-emerald-500/40'
                                  : 'border-slate-800/90 hover:border-slate-700 cursor-pointer'
                              }`}
                            >
                              <div className="text-[9px] text-slate-400 font-semibold flex items-center justify-center gap-1">
                                <span>⚡ Hourly</span>
                                {!isFree && manualTimeframes.hourly ? <span className="text-amber-300">●</span> : null}
                              </div>
                              {isFree ? (
                                <div className="text-xs font-mono font-bold text-emerald-400 py-0.5">Free (0)</div>
                              ) : isManualMode ? (
                                <div className="flex items-center justify-center gap-1 mt-0.5">
                                  <span className="text-[9px] text-slate-500 font-bold">PKR</span>
                                  <input
                                    type="number"
                                    min="0"
                                    max="10000000"
                                    step="10"
                                    value={manualTimeframes.hourly ?? ''}
                                    placeholder={String(flatOverride ?? autoHourly)}
                                    onChange={(e) => updateTimeframeFixedRate('hourly', e.target.value)}
                                    className="w-20 px-1.5 py-0.5 bg-slate-900 border border-slate-700 rounded text-xs font-mono font-bold text-emerald-400 text-center"
                                  />
                                </div>
                              ) : (
                                <div className="text-xs font-mono font-bold text-emerald-400 truncate py-0.5">
                                  {isHourlyFree ? 'Free (0)' : `PKR ${displayHourly.toLocaleString()}`}
                                </div>
                              )}
                            </div>

                            {/* Daily (24 Hours) */}
                            <div
                              onClick={() => {
                                if (!isFree && !isManualMode) {
                                  handleUpdatePlacementRate(typedKey, { rateEditMode: 'manual' });
                                }
                              }}
                              className={`px-2.5 py-1.5 bg-slate-950/85 border rounded-xl text-center transition-colors ${
                                isManualMode && !isFree
                                  ? 'border-emerald-500/40'
                                  : 'border-slate-800/90 hover:border-slate-700 cursor-pointer'
                              }`}
                            >
                              <div className="text-[9px] text-slate-400 font-semibold flex items-center justify-center gap-1">
                                <span>📅 24 Hours</span>
                                {!isFree && manualTimeframes.daily ? <span className="text-amber-300">●</span> : null}
                              </div>
                              {isFree ? (
                                <div className="text-xs font-mono font-bold text-emerald-400 py-0.5">Free (0)</div>
                              ) : isManualMode ? (
                                <div className="flex items-center justify-center gap-1 mt-0.5">
                                  <span className="text-[9px] text-slate-500 font-bold">PKR</span>
                                  <input
                                    type="number"
                                    min="0"
                                    max="10000000"
                                    step="50"
                                    value={manualTimeframes.daily ?? ''}
                                    placeholder={String(flatOverride ?? autoDaily)}
                                    onChange={(e) => updateTimeframeFixedRate('daily', e.target.value)}
                                    className="w-20 px-1.5 py-0.5 bg-slate-900 border border-slate-700 rounded text-xs font-mono font-bold text-emerald-400 text-center"
                                  />
                                </div>
                              ) : (
                                <div className="text-xs font-mono font-bold text-emerald-400 truncate py-0.5">
                                  {isDailyFree ? 'Free (0)' : `PKR ${displayDaily.toLocaleString()}`}
                                </div>
                              )}
                            </div>

                            {/* Weekly */}
                            <div
                              onClick={() => {
                                if (!isFree && !isManualMode) {
                                  handleUpdatePlacementRate(typedKey, { rateEditMode: 'manual' });
                                }
                              }}
                              className={`px-2.5 py-1.5 bg-slate-950/85 border rounded-xl text-center transition-colors ${
                                isManualMode && !isFree
                                  ? 'border-indigo-500/40'
                                  : 'border-slate-800/90 hover:border-slate-700 cursor-pointer'
                              }`}
                            >
                              <div className="text-[9px] text-slate-400 font-semibold flex items-center justify-center gap-1">
                                <span>🚀 1 Week</span>
                                {!isFree && manualTimeframes.weekly ? <span className="text-amber-300">●</span> : null}
                              </div>
                              {isFree ? (
                                <div className="text-xs font-mono font-bold text-emerald-400 py-0.5">Free (0)</div>
                              ) : isManualMode ? (
                                <div className="flex items-center justify-center gap-1 mt-0.5">
                                  <span className="text-[9px] text-slate-500 font-bold">PKR</span>
                                  <input
                                    type="number"
                                    min="0"
                                    max="10000000"
                                    step="100"
                                    value={manualTimeframes.weekly ?? ''}
                                    placeholder={String(flatOverride ?? autoWeekly)}
                                    onChange={(e) => updateTimeframeFixedRate('weekly', e.target.value)}
                                    className="w-20 px-1.5 py-0.5 bg-slate-900 border border-slate-700 rounded text-xs font-mono font-bold text-indigo-400 text-center"
                                  />
                                </div>
                              ) : (
                                <div className="text-xs font-mono font-bold text-indigo-400 truncate py-0.5">
                                  {isWeeklyFree ? 'Free (0)' : `PKR ${displayWeekly.toLocaleString()}`}
                                </div>
                              )}
                            </div>

                            {/* Monthly */}
                            <div
                              onClick={() => {
                                if (!isFree && !isManualMode) {
                                  handleUpdatePlacementRate(typedKey, { rateEditMode: 'manual' });
                                }
                              }}
                              className={`px-2.5 py-1.5 bg-slate-950/85 border rounded-xl text-center transition-colors ${
                                isManualMode && !isFree
                                  ? 'border-amber-500/40'
                                  : 'border-slate-800/90 hover:border-slate-700 cursor-pointer'
                              }`}
                            >
                              <div className="text-[9px] text-slate-400 font-semibold flex items-center justify-center gap-1">
                                <span>👑 1 Month</span>
                                {!isFree && manualTimeframes.monthly ? <span className="text-amber-300">●</span> : null}
                              </div>
                              {isFree ? (
                                <div className="text-xs font-mono font-bold text-emerald-400 py-0.5">Free (0)</div>
                              ) : isManualMode ? (
                                <div className="flex items-center justify-center gap-1 mt-0.5">
                                  <span className="text-[9px] text-slate-500 font-bold">PKR</span>
                                  <input
                                    type="number"
                                    min="0"
                                    max="10000000"
                                    step="500"
                                    value={manualTimeframes.monthly ?? ''}
                                    placeholder={String(flatOverride ?? autoMonthly)}
                                    onChange={(e) => updateTimeframeFixedRate('monthly', e.target.value)}
                                    className="w-20 px-1.5 py-0.5 bg-slate-900 border border-slate-700 rounded text-xs font-mono font-bold text-amber-400 text-center"
                                  />
                                </div>
                              ) : (
                                <div className="text-xs font-mono font-bold text-amber-400 truncate py-0.5">
                                  {isMonthlyFree ? 'Free (0)' : `PKR ${displayMonthly.toLocaleString()}`}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Row 3: Min Duration (Hours), Uplift (% Extra), and Slot Occupancy / Max Card Slots */}
                        <div className="pt-2.5 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2.5 bg-slate-950/50 px-3 py-2 rounded-xl">
                          <div className="flex flex-wrap items-center gap-3">
                            {/* Min Duration Hours */}
                            <div className="flex items-center space-x-1.5">
                              <Clock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              <span className="text-[11px] font-bold text-slate-300">Min Duration:</span>
                              <input
                                type="number"
                                min="1"
                                max="2160"
                                step="1"
                                value={placement.minDurationHours ?? 1}
                                onChange={(e) =>
                                  handleUpdatePlacementRate(typedKey, {
                                    minDurationHours: Math.min(2160, Math.max(1, Math.floor(Number(e.target.value) || 1)))
                                  })
                                }
                                className="w-16 px-1.5 py-1 rounded-lg border border-slate-700 bg-slate-900 text-xs font-mono font-bold text-white text-center"
                              />
                              <span className="text-[10px] text-slate-400 font-medium">Hours</span>
                            </div>

                            {/* Percentage Uplift */}
                            {!isFree && !isManualMode && (
                              <div className="flex items-center space-x-1.5">
                                <span className="text-[11px] font-bold text-slate-300">Uplift:</span>
                                <input
                                  type="number"
                                  min="0"
                                  max="1000"
                                  step="5"
                                  value={placement.percentageUpliftPercent ?? 0}
                                  onChange={(e) =>
                                    handleUpdatePlacementRate(typedKey, {
                                      percentageUpliftPercent: Math.min(1000, Math.max(0, Number(e.target.value) || 0))
                                    })
                                  }
                                  className="w-14 px-1.5 py-1 rounded-lg border border-slate-700 bg-slate-900 text-xs font-mono font-bold text-white text-center"
                                />
                                <span className="text-[10px] text-slate-400">%</span>
                              </div>
                            )}
                          </div>

                          {/* Slot Occupancy & Max Card Slots */}
                          <div className="flex flex-wrap items-center gap-2.5">
                            <div className="flex items-center space-x-1.5">
                              <Sliders className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                              <span className="text-[11px] font-bold text-slate-300">Slot Occupancy:</span>
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                                  isOverCapacity
                                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                    : occupied > 0
                                    ? 'bg-teal-500/20 text-teal-300 border-teal-500/30'
                                    : 'bg-slate-800 text-slate-400 border-slate-700'
                                }`}
                              >
                                {occupied} / {maxSlots} Occupied
                              </span>
                            </div>
                            <div className="flex items-center space-x-1.5">
                              <span className="text-[10px] text-slate-400 font-medium">Max Card Slots:</span>
                              <input
                                type="number"
                                min="1"
                                max="50"
                                value={maxSlots}
                                onChange={(e) =>
                                  handleUpdatePlacementRate(typedKey, {
                                    maxConcurrentSlots: Math.min(50, Math.max(1, parseInt(e.target.value) || 1))
                                  })
                                }
                                className="w-14 px-1.5 py-1 bg-slate-900 border border-slate-700 rounded-lg text-center text-white font-black text-xs focus:ring-1 focus:ring-teal-500"
                              />
                            </div>
                          </div>
                        </div>

                        {typedKey === 'top-header' && (
                          <div className="pt-2.5 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-indigo-500/5 border border-indigo-500/20 px-3 py-2.5 rounded-xl">
                            <div className="space-y-1 min-w-0">
                              <div className="text-[11px] font-black text-indigo-300 flex items-center gap-1.5">
                                <Eye className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                <span>Top Header Announcement Banner Appearance &amp; Rotation</span>
                              </div>
                              <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                                <span className="px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-slate-300 font-semibold">
                                  Image: <strong className="text-indigo-300">{editableCampaignConfig.bannerAppearance?.showBannerImage !== false ? 'On' : 'Off'}</strong>
                                </span>
                                <span className="px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-slate-300 font-semibold">
                                  CTA: <strong className="text-white">{editableCampaignConfig.bannerAppearance?.showCtaButton !== false ? 'On' : 'Off'}</strong>
                                </span>
                                <span className="px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-slate-300 font-semibold">
                                  Badge: <strong className="text-white">{editableCampaignConfig.bannerAppearance?.showBadge !== false ? 'On' : 'Off'}</strong>
                                </span>
                                <span className="px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-slate-300 font-semibold">
                                  Rotate: <strong className="text-emerald-400">{editableCampaignConfig.bannerBehavior?.autoRotate !== false ? `${editableCampaignConfig.bannerBehavior?.rotationIntervalSeconds ?? 6}s` : 'Off'}</strong>
                                </span>
                                <span className="px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-slate-300 font-semibold">
                                  Arrows: <strong className="text-white">{editableCampaignConfig.bannerBehavior?.showNavigationArrows !== false ? 'On' : 'Off'}</strong>
                                </span>
                                <span className="px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-slate-300 font-semibold font-mono">
                                  Desktop: <strong className="text-indigo-300">{editableCampaignConfig.bannerDimensions?.desktopWidth || '100%'}×{editableCampaignConfig.bannerDimensions?.desktopHeight || 'auto'}</strong>
                                </span>
                                <span className="px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-slate-300 font-semibold font-mono">
                                  Mobile: <strong className="text-cyan-300">{editableCampaignConfig.bannerDimensions?.mobileWidth || '100%'}×{editableCampaignConfig.bannerDimensions?.mobileHeight || 'auto'}</strong>
                                </span>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setIsBannerSettingsModalOpen(true)}
                              className="shrink-0 px-3.5 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-md shadow-indigo-500/20 cursor-pointer transition-all active:scale-95"
                            >
                              <Settings className="w-3.5 h-3.5" />
                              <span>Banner Styling &amp; Rotation</span>
                            </button>
                          </div>
                        )}

                        {typedKey === 'feed-inline' && (
                          <div className="pt-2.5 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-emerald-500/5 border border-emerald-500/20 px-3 py-2.5 rounded-xl">
                            <div className="space-y-1 min-w-0">
                              <div className="text-[11px] font-black text-emerald-300 flex items-center gap-1.5">
                                <Layers className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                <span>Job Feed Inline Frequency &amp; Card Styling</span>
                              </div>
                              <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                                <span className="px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-slate-300 font-semibold">
                                  Max/Page: <strong className="text-emerald-300">{editableCampaignConfig.feedInlineSettings?.maxAdsPerPage ?? 3}</strong>
                                </span>
                                <span className="px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-slate-300 font-semibold">
                                  Mode: <strong className="text-white">{editableCampaignConfig.feedInlineSettings?.insertionMode === 'cadence' ? `Every ${editableCampaignConfig.feedInlineSettings?.repeatEveryNJobs || 3} jobs` : 'Custom slots'}</strong>
                                </span>
                                <span className="px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-slate-300 font-semibold">
                                  Rotate: <strong className="text-white">{editableCampaignConfig.feedInlineSettings?.rotateMultipleAds !== false ? 'On' : 'Off'}</strong>
                                </span>
                                <span className="px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-slate-300 font-semibold">
                                  Style: <strong className="text-white">{editableCampaignConfig.feedCardAppearance?.paddingPreset || 'standard'} · {editableCampaignConfig.feedCardAppearance?.imagePosition || 'left'}</strong>
                                </span>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setIsFeedSettingsModalOpen(true)}
                              className="shrink-0 px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/15 cursor-pointer transition-all active:scale-95"
                            >
                              <Settings className="w-3.5 h-3.5" />
                              <span>Feed Frequency &amp; Styling</span>
                            </button>
                          </div>
                        )}

                        {typedKey === 'popup-modal' && (
                          <div className="pt-2.5 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-amber-500/5 border border-amber-500/20 px-3 py-2.5 rounded-xl">
                            <div className="space-y-1 min-w-0">
                              <div className="text-[11px] font-black text-amber-300 flex items-center gap-1.5">
                                <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                <span>Centered Popup Lightbox Customizer &amp; Appearance</span>
                              </div>
                              <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                                <span className="px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-slate-300 font-semibold">
                                  Mode: <strong className="text-amber-300">{editableCampaignConfig.popupSettings?.displayMode === 'stacked_dual' ? 'Stacked Dual' : editableCampaignConfig.popupSettings?.displayMode === 'single' ? 'Single Priority' : 'Sequential'}</strong>
                                </span>
                                <span className="px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-slate-300 font-semibold">
                                  Width: <strong className="text-white">{editableCampaignConfig.popupAppearance?.popupWidthPreset || 'standard'}</strong>
                                </span>
                                <span className="px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-slate-300 font-semibold">
                                  Overlay: <strong className="text-white">{editableCampaignConfig.popupAppearance?.overlayOpacityPreset || 'standard'}</strong>
                                </span>
                                <span className="px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-slate-300 font-semibold">
                                  Delay: <strong className="text-emerald-400">{editableCampaignConfig.popupAppearance?.initialDisplayDelaySeconds ?? 1}s</strong>
                                </span>
                                <span className="px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-slate-300 font-semibold">
                                  Close (X): <strong className="text-white">{editableCampaignConfig.popupAppearance?.showCloseButton !== false ? 'Visible' : 'Hidden'}</strong>
                                </span>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setIsPopupSettingsModalOpen(true)}
                              className="shrink-0 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/15 cursor-pointer transition-all active:scale-95"
                            >
                              <Settings className="w-3.5 h-3.5" />
                              <span>Popup Customizer &amp; Appearance</span>
                            </button>
                          </div>
                        )}

                        {isOverCapacity && (
                          <p className="text-[10px] text-amber-400 flex items-center space-x-1">
                            <AlertCircle className="w-3 h-3 inline shrink-0" />
                            <span>Active campaigns ({occupied}) currently exceed configured slot cap ({maxSlots}).</span>
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 2. Page Multipliers */}
            <div className="space-y-3 pt-2">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center space-x-2">
                <Zap className="w-4 h-4 text-amber-400" />
                <span>2. Portal Page Distribution Multipliers</span>
              </h4>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                {Object.entries(editablePricing.pageMultipliers).map(([pageKey, val]) => (
                  <div key={pageKey} className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1.5 text-center">
                    <div className="text-xs font-bold text-white truncate">{getPageDisplayName(pageKey as AdTargetPage)}</div>
                    <input
                      type="number"
                      step="0.05"
                      min="0.1"
                      max="3.0"
                      value={val}
                      onChange={(e) => {
                        const newM = parseFloat(e.target.value) || 1.0;
                        setEditablePricing({
                          ...editablePricing,
                          pageMultipliers: {
                            ...editablePricing.pageMultipliers,
                            [pageKey]: newM
                          }
                        });
                      }}
                      className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-xs font-bold text-indigo-300 text-center font-mono"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* 4. SMS & Minimums */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-300">SMS Broadcast Dispatch Fee (PKR / Contact)</label>
                  <span className="text-[10px] text-purple-400 font-mono">Per Recipient</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-slate-400 font-bold">PKR:</span>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={editablePricing.smsPerContactRatePkr}
                    onChange={(e) => setEditablePricing({ ...editablePricing, smsPerContactRatePkr: parseFloat(e.target.value) || 1.5 })}
                    className="w-28 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-sm font-black text-purple-300 font-mono text-center"
                  />
                </div>
              </div>

              <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-300">Minimum User Wallet Deposit (PKR)</label>
                  <span className="text-[10px] text-emerald-400 font-mono">Wallet Threshold</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-slate-400 font-bold">PKR:</span>
                  <input
                    type="number"
                    min="100"
                    step="100"
                    value={editablePricing.minDepositAmountPkr}
                    onChange={(e) => setEditablePricing({ ...editablePricing, minDepositAmountPkr: parseInt(e.target.value) || 500 })}
                    className="w-28 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-sm font-black text-emerald-400 font-mono text-center"
                  />
                </div>
              </div>
            </div>

          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 6: AD PERFORMANCE & YIELD CHARTS (RECHARTS) */}
      {/* ========================================================================= */}
      {activeTab === 'performance' && (
        <AdminAdPerformanceCharts
          ads={ads}
          pricingConfig={pricingConfig}
          onSelectAd={(selectedAd) => {
            setEditingAd(selectedAd);
            setIsEditorOpen(true);
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* CAMPAIGN DETAILS & SAFE SUBMITTER PROFILE */}
      {/* ========================================================================= */}
      {detailsAd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/85 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 sm:p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto space-y-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-black text-white">Campaign Submission Details</h3>
                <p className="text-xs text-slate-400">Review the submitted record and advertiser information before approval or rejection.</p>
              </div>
              <button type="button" onClick={() => setDetailsAd(null)} className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl bg-slate-950 border border-slate-800 p-3"><span className="text-slate-500">Campaign title</span><div className="text-white font-bold mt-1">{detailsAd.title || detailsAd.headline}</div></div>
              <div className="rounded-xl bg-slate-950 border border-slate-800 p-3"><span className="text-slate-500">Format / placement</span><div className="text-white font-bold mt-1">{detailsAd.type} · {getPlacementDisplayName(detailsAd.placement)}</div></div>
              <div className="rounded-xl bg-slate-950 border border-slate-800 p-3"><span className="text-slate-500">Duration</span><div className="text-white font-bold mt-1">{detailsAd.durationDisplay || 'Not specified'}</div></div>
              <div className="rounded-xl bg-slate-950 border border-slate-800 p-3"><span className="text-slate-500">Campaign fee</span><div className="text-emerald-300 font-bold mt-1">PKR {(detailsAd.campaignCostPkr || 0).toLocaleString()} · {detailsAd.paymentStatus || 'Not specified'}</div></div>
              <div className="rounded-xl bg-slate-950 border border-slate-800 p-3 sm:col-span-2"><span className="text-slate-500">Target pages</span><div className="text-white font-bold mt-1">{(detailsAd.targetPages || []).map(getPageDisplayName).join(', ') || 'Not specified'}</div></div>
              <div className="rounded-xl bg-slate-950 border border-slate-800 p-3 sm:col-span-2"><span className="text-slate-500">Headline</span><div className="text-white font-bold mt-1">{detailsAd.headline || 'Not provided'}</div><p className="text-slate-300 mt-2 whitespace-pre-wrap">{detailsAd.bodyText || 'No description provided.'}</p></div>
              <div className="rounded-xl bg-slate-950 border border-slate-800 p-3"><span className="text-slate-500">CTA</span><div className="text-white mt-1">{detailsAd.ctaText || 'Not provided'}</div><div className="text-indigo-300 break-all">{detailsAd.ctaUrl || 'No URL'}</div></div>
              <div className="rounded-xl bg-slate-950 border border-slate-800 p-3"><span className="text-slate-500">Schedule</span><div className="text-white mt-1">Start: {detailsAd.scheduledStartAt || 'Not set'}</div><div className="text-white">End: {detailsAd.scheduledEndAt || 'Not set'}</div></div>
            </div>
            {detailsAd.imageUrl && <div className="rounded-xl bg-slate-950 border border-slate-800 p-3"><div className="text-xs text-slate-500 mb-2">Submitted creative</div><img src={detailsAd.imageUrl} alt="Submitted campaign creative" className="max-h-64 max-w-full rounded-lg object-contain" /></div>}
            <div className="rounded-xl bg-slate-950 border border-slate-800 p-4 space-y-2">
              <h4 className="text-sm font-bold text-white">Advertiser Profile</h4>
              <div className="text-xs text-slate-300">Submitted name: {detailsAd.submittedByUserName || 'Not provided'} · Email: {detailsAd.submittedByUserEmail || 'Not provided'} · Phone: {detailsAd.submittedByUserPhone || 'Not provided'}</div>
              {isSubmitterProfileLoading ? <div className="text-xs text-slate-400">Loading verified account profile…</div> : submitterProfile ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div><span className="text-slate-500">Account name</span><div className="text-white">{submitterProfile.name || submitterProfile.fullName || 'Not provided'}</div></div>
                  <div><span className="text-slate-500">Account email</span><div className="text-white">{submitterProfile.email || 'Not provided'}</div></div>
                  <div><span className="text-slate-500">Account phone</span><div className="text-white">{submitterProfile.phone || 'Not provided'}</div></div>
                  <div><span className="text-slate-500">Role / status</span><div className="text-white">{submitterProfile.role || 'User'} · {submitterProfile.status || 'Status not provided'}</div></div>
                  <div><span className="text-slate-500">Company</span><div className="text-white">{submitterProfile.companyName || 'Not provided'}</div></div>
                  <div><span className="text-slate-500">Location</span><div className="text-white">{[submitterProfile.city, submitterProfile.province, submitterProfile.country].filter(Boolean).join(', ') || 'Not provided'}</div></div>
                </div>
              ) : <div className="text-xs text-slate-400">{detailsAd.submittedByUserId && detailsAd.submittedByUserId !== 'admin' ? 'Account profile could not be loaded; submitted identity is shown above.' : 'No registered advertiser account is linked to this campaign.'}</div>}
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" onClick={() => { setDetailsAd(null); setPreviewAd(detailsAd); setSimulatorMode(detailsAd.placement === 'top-header' ? 'desktop-banner' : detailsAd.placement === 'popup-modal' ? 'popup-modal' : 'feed-inline'); }} className="px-3 py-2 rounded-lg bg-slate-800 text-slate-200 text-xs font-bold">Preview creative</button>
              {(detailsAd.status === 'pending_approval' || detailsAd.approvalStatus === 'Pending') && <button type="button" onClick={() => { const ad = detailsAd; setDetailsAd(null); setRejectingAd(ad); setRejectionReasonInput('Creative image resolution is too low and does not meet portal quality guidelines.'); setCustomRejectionReason(''); }} className="px-3 py-2 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs font-bold">Reject with reason</button>}
              {(detailsAd.status === 'pending_approval' || detailsAd.approvalStatus === 'Pending') && <button type="button" onClick={() => { handleApprove(detailsAd); setDetailsAd(null); }} className="px-3 py-2 rounded-lg bg-emerald-500 text-slate-950 text-xs font-black">Approve & Publish</button>}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* REJECTION MODAL */}
      {/* ========================================================================= */}
      {rejectingAd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-5 relative">
            <button
              onClick={() => setRejectingAd(null)}
              className="absolute top-5 right-5 p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
            >
              <XCircle className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <div className="flex items-center space-x-2 text-rose-400 text-xs font-bold uppercase">
                <XCircle className="w-4 h-4" />
                <span>Reject & Refund Campaign</span>
              </div>
              <h3 className="text-xl font-black text-white">Specify Rejection Reason</h3>
              <p className="text-xs text-slate-400">
                The reason will be communicated to <strong>{rejectingAd.submittedByUserName}</strong> and PKR {(rejectingAd.campaignCostPkr || 0).toLocaleString()} will be automatically refunded to their wallet.
              </p>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-300">Select Standard Reason</label>
              <select
                value={rejectionReasonInput}
                onChange={(e) => setRejectionReasonInput(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
              >
                <option value="Creative image resolution is too low and does not meet portal quality guidelines.">🖼️ Creative image resolution is too low / blurred</option>
                <option value="Headline or description contains misleading or unverified claims.">⚠️ Headline contains misleading or unverified claims</option>
                <option value="Destination CTA URL is broken, inaccessible, or violates advertising guidelines.">🔗 Destination CTA URL is broken or invalid</option>
                <option value="Content promotes prohibited financial or unauthorized multi-level schemes.">🚫 Content violates prohibited advertising policy</option>
                <option value="Other (Specify Custom Reason)">✏️ Other (Specify Custom Reason)</option>
              </select>

              {rejectionReasonInput === 'Other (Specify Custom Reason)' && (
                <textarea
                  rows={3}
                  value={customRejectionReason}
                  onChange={(e) => setCustomRejectionReason(e.target.value)}
                  placeholder="Type specific feedback for the advertiser..."
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                ></textarea>
              )}
            </div>

            <div className="pt-2 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setRejectingAd(null)}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmRejection}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-black shadow-lg shadow-rose-600/20"
              >
                Confirm Rejection & Refund Wallet
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CREATE / EDIT MODAL WITH LIVE CONTEXT PREVIEW */}
      {/* ========================================================================= */}
      {isEditorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-8 max-w-7xl w-full shadow-2xl space-y-6 my-4 max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
                  <Megaphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-black text-white">
                    {editingAd ? 'Edit Campaign & Target Rules' : 'Create Administrative Campaign'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Configure campaign creative parameters and observe the real-time preview across portal pages.
                  </p>
                </div>
              </div>

              <button 
                onClick={() => setIsEditorOpen(false)} 
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-y-auto flex-1 pr-1">
              {/* LEFT COLUMN: CAMPAIGN CONFIGURATION FORM */}
              <form id="admin-ad-form" onSubmit={handleSaveAd} className="lg:col-span-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="text-xs font-bold text-slate-300">Campaign Title</label>
                    <input
                      type="text"
                      required
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      placeholder="e.g. Featured Govt Jobs Digest"
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-300">Ad Format</label>
                    <select
                      value={formType}
                      onChange={(e) => setFormType(e.target.value as AdType)}
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                    >
                      <option value="banner">Banner</option>
                      <option value="popup">Pop-up Modal</option>
                      <option value="notification">Toast Float</option>
                      <option value="text">Text Box</option>
                      <option value="sms">SMS Broadcast</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="text-xs font-bold text-slate-300">Placement Slot</label>
                    <select
                      value={formPlacement}
                      onChange={(e) => setFormPlacement(e.target.value as AdPlacement)}
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                    >
                      <option value="top-header">Top Header Banner</option>
                      <option value="feed-inline">Job Feed Inline Card</option>
                      <option value="popup-modal">Popup Modal</option>
                      <option value="toast-float">Toast Float</option>
                      <option value="sidebar">Sidebar Widget</option>
                      <option value="sms-broadcast">SMS Broadcast</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-300">Status</label>
                    <select
                      value={formStatus}
                      onChange={(e) => setFormStatus(e.target.value as AdStatus)}
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                    >
                      <option value="active">Active (Live Immediately)</option>
                      <option value="paused">Paused</option>
                      <option value="pending_approval">Pending Review</option>
                    </select>
                  </div>
                </div>

                {/* Target Portal Pages */}
                <div className="space-y-1.5 p-3.5 bg-slate-950 border border-slate-800 rounded-2xl">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-300">Target Portal Pages</label>
                    <span className="text-[10px] text-emerald-400 font-semibold">Multi-Page Distribution</span>
                  </div>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                    {[
                      { id: 'all', label: 'All Pages (Global)' },
                      { id: 'alerts', label: 'Job Alerts Page' },
                      { id: 'jobs', label: 'Jobs Search Feed' },
                      { id: 'cv', label: 'ATS CV Builder' },
                      { id: 'dashboard', label: 'User Dashboard' }
                    ].map((pg) => {
                      const isChecked = formTargetPages.includes(pg.id as AdTargetPage);
                      return (
                        <button
                          type="button"
                          key={pg.id}
                          onClick={() => {
                            if (pg.id === 'all') {
                              setFormTargetPages(['all']);
                            } else {
                              const withoutAll = formTargetPages.filter(p => p !== 'all');
                              if (isChecked) {
                                const next = withoutAll.filter(p => p !== pg.id);
                                setFormTargetPages(next.length ? next : ['all']);
                              } else {
                                setFormTargetPages([...withoutAll, pg.id as AdTargetPage]);
                              }
                            }
                          }}
                          className={`px-3 py-2 rounded-xl text-xs font-bold transition-all text-left flex items-center justify-between cursor-pointer border ${
                            isChecked
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                              : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800'
                          }`}
                        >
                          <span className="text-[11px] truncate">{pg.label}</span>
                          {isChecked && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 ml-1" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300">Headline *</label>
                  <input
                    type="text"
                    required
                    value={formHeadline}
                    onChange={(e) => setFormHeadline(e.target.value)}
                    placeholder="Punchy high-impact headline..."
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300">Body Description</label>
                  <textarea
                    rows={2}
                    value={formBodyText}
                    onChange={(e) => setFormBodyText(e.target.value)}
                    placeholder="Short description highlighting key opportunity details..."
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                  ></textarea>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="text-xs font-bold text-slate-300">Badge Label</label>
                    <input
                      type="text"
                      value={formBadgeText}
                      onChange={(e) => setFormBadgeText(e.target.value)}
                      placeholder="Sponsored Partner"
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-300">Color Theme</label>
                    <select
                      value={formTheme}
                      onChange={(e) => setFormTheme(e.target.value as AdTheme)}
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                    >
                      <option value="emerald">Emerald Green (Standard)</option>
                      <option value="indigo">Indigo Blue (Pro)</option>
                      <option value="amber">Amber Gold (Urgent)</option>
                      <option value="rose">Rose Red (Breaking)</option>
                      <option value="purple">Purple (Executive)</option>
                      <option value="dark">Dark Carbon (Minimal)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300">Image URL / Upload</label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={formImageUrl}
                      onChange={(e) => setFormImageUrl(e.target.value)}
                      placeholder="https://..."
                      className="flex-1 px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                    />
                    <label className="px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-bold cursor-pointer text-slate-300 flex items-center space-x-1.5">
                      <Upload className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Upload</span>
                      <input type="file" accept="image/*" onChange={handleImageFileUpload} className="hidden" />
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="text-xs font-bold text-slate-300">CTA Button Text</label>
                    <input
                      type="text"
                      value={formCtaText}
                      onChange={(e) => setFormCtaText(e.target.value)}
                      placeholder="Apply Now / Learn More"
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-300">CTA Destination URL</label>
                    <input
                      type="text"
                      value={formCtaUrl}
                      onChange={(e) => setFormCtaUrl(e.target.value)}
                      placeholder="#jobs or https://..."
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                    />
                  </div>
                </div>
              </form>

              {/* RIGHT COLUMN: LIVE CONTEXT SIMULATOR */}
              <div className="lg:col-span-6 space-y-3 flex flex-col">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-xs font-black uppercase tracking-wider text-slate-300">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    <span>Real-Time Live Context Preview</span>
                  </div>
                  <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    Syncs Live With Form
                  </span>
                </div>

                <div className="bg-slate-950 p-2 sm:p-3 rounded-2xl border border-slate-800 flex-1 overflow-hidden">
                  <CampaignLiveContextPreview
                    headline={formHeadline || 'Your Campaign Headline Will Appear Here'}
                    bodyText={formBodyText || 'Your campaign description and call-to-action details will be highlighted here.'}
                    imageUrl={formImageUrl}
                    ctaText={formCtaText || 'Learn More'}
                    ctaUrl={formCtaUrl || '#jobs'}
                    badgeText={formBadgeText || 'Sponsored'}
                    theme={formTheme}
                    placement={formPlacement}
                    targetPages={formTargetPages}
                    dismissable={formDismissable}
                    portalPages={campaignConfig?.portalPages}
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 flex items-center justify-end space-x-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsEditorOpen(false)}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="admin-ad-form"
                className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 rounded-xl text-xs font-black shadow-lg shadow-emerald-500/20 cursor-pointer"
              >
                {editingAd ? 'Save Campaign Updates' : 'Publish Administrative Campaign'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SIMULATOR PREVIEW MODAL */}
      {/* ========================================================================= */}
      {previewAd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-white">Live Simulator Preview</h3>
              <button onClick={() => setPreviewAd(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-3">
              {previewAd.imageUrl && (
                <img src={previewAd.imageUrl} alt={previewAd.headline} className="w-full h-44 rounded-xl object-cover" />
              )}
              <div className="text-[10px] font-black uppercase text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-md inline-block">
                {previewAd.badgeText || 'Sponsored'}
              </div>
              <h4 className="text-sm font-black text-white">{previewAd.headline}</h4>
              <p className="text-xs text-slate-300">{previewAd.bodyText}</p>
              <button className="w-full py-2.5 bg-emerald-500 text-slate-950 font-black text-xs rounded-xl">
                {previewAd.ctaText || 'Learn More'}
              </button>
            </div>

            <div className="flex justify-end">
              <button onClick={() => setPreviewAd(null)} className="px-4 py-2 bg-slate-800 rounded-xl text-xs font-bold">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CENTERED POPUP LIGHTBOX CUSTOMIZER & APPEARANCE SETTINGS MODAL */}
      {/* ========================================================================= */}
      {isPopupSettingsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between gap-3 bg-slate-950/60">
              <div className="min-w-0">
                <h3 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400 shrink-0" />
                  <span className="truncate">Centered Popup Lightbox Modal Customizer</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Customize how centered popup lightbox ads are presented, along with modal width, overlay opacity, entry delay, and close button visibility.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsPopupSettingsModalOpen(false)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-6">
              {/* 1. Display Mode Selection Cards */}
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Option 1: Sequential One-by-One Queue on Cross */}
                  <div
                    onClick={() => handleUpdatePopupSettings({ displayMode: 'sequential' })}
                    className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                      editableCampaignConfig.popupSettings?.displayMode === 'sequential'
                        ? 'bg-amber-500/10 border-amber-500 shadow-lg shadow-amber-500/10'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-black text-amber-400 uppercase tracking-wider">Sequential Queue</span>
                        <Radio className={`w-4 h-4 ${editableCampaignConfig.popupSettings?.displayMode === 'sequential' ? 'text-amber-400' : 'text-slate-600'}`} />
                      </div>
                      <h4 className="text-xs sm:text-sm font-bold text-white mb-1">One-By-One On Dismiss</h4>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        When candidate closes popup 1, popup 2 smoothly transitions after 0.8 seconds.
                      </p>
                    </div>
                  </div>

                  {/* Option 2: Stacked Dual Popups */}
                  <div
                    onClick={() => handleUpdatePopupSettings({ displayMode: 'stacked_dual' })}
                    className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                      editableCampaignConfig.popupSettings?.displayMode === 'stacked_dual'
                        ? 'bg-amber-500/10 border-amber-500 shadow-lg shadow-amber-500/10'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-black text-amber-400 uppercase tracking-wider">Stacked Dual Grid</span>
                        <Radio className={`w-4 h-4 ${editableCampaignConfig.popupSettings?.displayMode === 'stacked_dual' ? 'text-amber-400' : 'text-slate-600'}`} />
                      </div>
                      <h4 className="text-xs sm:text-sm font-bold text-white mb-1">Two Side-By-Side Popups</h4>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        Displays top 2 matching popup sponsors side-by-side in a split grid.
                      </p>
                    </div>
                  </div>

                  {/* Option 3: Single Priority Popup Only */}
                  <div
                    onClick={() => handleUpdatePopupSettings({ displayMode: 'single' })}
                    className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                      editableCampaignConfig.popupSettings?.displayMode === 'single'
                        ? 'bg-amber-500/10 border-amber-500 shadow-lg shadow-amber-500/10'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-black text-amber-400 uppercase tracking-wider">Single Priority</span>
                        <Radio className={`w-4 h-4 ${editableCampaignConfig.popupSettings?.displayMode === 'single' ? 'text-amber-400' : 'text-slate-600'}`} />
                      </div>
                      <h4 className="text-xs sm:text-sm font-bold text-white mb-1">Highest Priority Only</h4>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        Only shows 1 top priority popup. No queue when dismissed.
                      </p>
                    </div>
                  </div>
                </div>

                {editableCampaignConfig.popupSettings?.displayMode === 'sequential' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-800/80">
                    <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3.5 space-y-1.5">
                      <label className="text-xs font-bold text-slate-300 block">Delay Between Sequential Popups (sec)</label>
                      <input
                        type="number"
                        min="0"
                        max="15"
                        step="0.2"
                        value={editableCampaignConfig.popupSettings?.delayBetweenPopupsSec ?? 0.8}
                        onChange={(e) => handleUpdatePopupSettings({ delayBetweenPopupsSec: Math.max(0, Number(e.target.value) || 0) })}
                        className="w-full bg-slate-900 border border-slate-700 text-xs text-white rounded-xl px-3 py-2 font-mono font-bold focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3.5 space-y-1.5">
                      <label className="text-xs font-bold text-slate-300 block">Max Queued Popups Per Visit</label>
                      <select
                        value={editableCampaignConfig.popupSettings?.maxPopupsPerVisit ?? 3}
                        onChange={(e) => handleUpdatePopupSettings({ maxPopupsPerVisit: Number(e.target.value) })}
                        className="w-full bg-slate-900 border border-slate-700 text-xs text-white rounded-xl px-3 py-2 font-bold focus:outline-none focus:border-amber-500"
                      >
                        <option value={2}>Up to 2 popups</option>
                        <option value={3}>Up to 3 popups</option>
                        <option value={5}>Up to 5 popups</option>
                        <option value={99}>Unlimited queue</option>
                      </select>
                    </div>
                  </div>
                )}

                {editableCampaignConfig.popupSettings?.displayMode === 'stacked_dual' && (
                  <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3.5 flex items-center justify-between gap-4">
                    <div>
                      <div className="text-xs font-bold text-white">Show Stacked Dual Grid on Desktop</div>
                      <div className="text-[11px] text-slate-400">Render top 2 popup ads side-by-side on wide screens instead of collapsing into single view.</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={editableCampaignConfig.popupSettings?.showStackedDualOnDesktop !== false}
                      onChange={(e) => handleUpdatePopupSettings({ showStackedDualOnDesktop: e.target.checked })}
                      className="h-4 w-4 accent-amber-500 cursor-pointer"
                    />
                  </div>
                )}
              </div>

              {/* 2. Popup Lightbox Appearance & Entry Delay */}
              <div className="pt-5 border-t border-slate-800 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-black text-white flex items-center space-x-2">
                      <Eye className="w-4 h-4 text-amber-400" />
                      <span>Popup Lightbox Appearance &amp; Entry Delay</span>
                    </h4>
                    <p className="text-xs text-slate-400">Configure modal width, overlay backdrop tint, entry delay, and close button.</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleRestorePopupAppearanceDefault}
                    className="self-start sm:self-auto px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold border border-slate-700 transition-all cursor-pointer flex items-center space-x-1"
                  >
                    <RefreshCw className="w-3 h-3 text-amber-400" />
                    <span>Restore Default</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Popup Width Preset */}
                  <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3.5 space-y-1.5">
                    <label className="text-xs font-bold text-slate-300 block">Popup Modal Width</label>
                    <select
                      value={editableCampaignConfig.popupAppearance?.popupWidthPreset || 'standard'}
                      onChange={(e) => handleUpdatePopupAppearance({ popupWidthPreset: e.target.value as any })}
                      className="w-full bg-slate-900 border border-slate-700 text-xs text-white rounded-xl px-3 py-2 font-bold focus:outline-none focus:border-amber-500 cursor-pointer"
                    >
                      <option value="compact">Compact (Max 480px)</option>
                      <option value="standard">Standard (Max 600px)</option>
                      <option value="wide">Wide (Max 768px)</option>
                    </select>
                  </div>

                  {/* Overlay Backdrop Opacity */}
                  <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3.5 space-y-1.5">
                    <label className="text-xs font-bold text-slate-300 block">Overlay Backdrop Opacity</label>
                    <select
                      value={editableCampaignConfig.popupAppearance?.overlayOpacityPreset || 'standard'}
                      onChange={(e) => handleUpdatePopupAppearance({ overlayOpacityPreset: e.target.value as any })}
                      className="w-full bg-slate-900 border border-slate-700 text-xs text-white rounded-xl px-3 py-2 font-bold focus:outline-none focus:border-amber-500 cursor-pointer"
                    >
                      <option value="light">Light Tint (60% Opacity)</option>
                      <option value="standard">Standard Dark (80% Opacity)</option>
                      <option value="dark">Heavy Dark (95% Opacity)</option>
                    </select>
                  </div>

                  {/* Initial Display Delay */}
                  <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3.5 space-y-1.5">
                    <label className="text-xs font-bold text-slate-300 block">Initial Entry Delay</label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="number"
                        min="0"
                        max="10"
                        step="0.5"
                        value={editableCampaignConfig.popupAppearance?.initialDisplayDelaySeconds ?? 1}
                        onChange={(e) => handleUpdatePopupAppearance({ initialDisplayDelaySeconds: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-slate-900 border border-slate-700 text-xs text-white rounded-xl px-3 py-2 font-mono font-bold focus:outline-none focus:border-amber-500"
                      />
                      <span className="text-xs text-slate-400 font-bold">sec</span>
                    </div>
                  </div>

                  {/* Close Button Visibility */}
                  <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3.5 flex flex-col justify-between space-y-1.5">
                    <label className="text-xs font-bold text-slate-300 block">Show Close (X) Button</label>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] font-bold text-slate-400">
                        {editableCampaignConfig.popupAppearance?.showCloseButton !== false ? 'VISIBLE' : 'HIDDEN'}
                      </span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editableCampaignConfig.popupAppearance?.showCloseButton !== false}
                          onChange={(e) => handleUpdatePopupAppearance({ showCloseButton: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500" />
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3.5 border-t border-slate-800 bg-slate-950/60 flex flex-wrap items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsPopupSettingsModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
              >
                Done
              </button>
              <button
                type="button"
                onClick={async () => {
                  await handleSavePlacementRates();
                  setIsPopupSettingsModalOpen(false);
                }}
                disabled={isPlacementRatesSaving || !onUpdateCampaignConfig}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 text-xs font-black flex items-center gap-1.5 shadow-lg shadow-amber-500/20 cursor-pointer disabled:opacity-60"
              >
                {isPlacementRatesSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5 stroke-[3]" />}
                <span>{isPlacementRatesSaving ? 'Saving...' : 'Save Popup & Rate Settings'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* JOB FEED INLINE SPONSORED CARD FREQUENCY & APPEARANCE MODAL */}
      {/* ========================================================================= */}
      {isFeedSettingsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between gap-3 bg-slate-950/60">
              <div className="min-w-0">
                <h3 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400 shrink-0" />
                  <span className="truncate">Job Feed Inline Sponsored Card Frequency</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Control inline sponsored card limits, insertion rules, active campaign rotation, and card appearance.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsFeedSettingsModalOpen(false)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
              {/* Maximum Inline Ads Per Page */}
              <div className="bg-slate-950/60 border border-emerald-500/30 rounded-2xl p-4 space-y-2">
                <label className="block text-xs font-bold text-slate-200">Maximum Inline Ads Per Page</label>
                <select
                  value={editableCampaignConfig.feedInlineSettings?.maxAdsPerPage ?? 3}
                  onChange={(e) => handleUpdateFeedInlineSettings({ maxAdsPerPage: Number(e.target.value) })}
                  className="w-full bg-slate-900 border border-slate-700 text-xs sm:text-sm text-white rounded-xl px-3 py-2 font-bold focus:outline-none focus:border-emerald-500"
                >
                  {[0, 1, 2, 3, 4, 5, 6, 8, 10].map((value) => (
                    <option key={value} value={value}>
                      {value === 0 ? '0 — Disable inline feed ads' : `${value} inline ads max`}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400">Set to 0 to disable all inline sponsored cards in the jobs feed.</p>
              </div>

              {(editableCampaignConfig.feedInlineSettings?.maxAdsPerPage ?? 3) > 0 ? (
                <>
                  {/* Ad Insertion Mode & Multiple Active Ads */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-2">
                      <label className="block text-xs font-bold text-slate-200">Ad Insertion Mode</label>
                      <select
                        value={editableCampaignConfig.feedInlineSettings?.insertionMode || 'custom_indices'}
                        onChange={(e) =>
                          handleUpdateFeedInlineSettings({
                            insertionMode: e.target.value as FeedInlineAdSettings['insertionMode']
                          })
                        }
                        className="w-full bg-slate-900 border border-slate-700 text-xs sm:text-sm text-white rounded-xl px-3 py-2 font-bold focus:outline-none focus:border-emerald-500"
                      >
                        <option value="cadence">Automatic frequency (every N standard jobs)</option>
                        <option value="custom_indices">Custom positions (selected job numbers)</option>
                      </select>
                      <p className="text-[10px] text-slate-400">Choose one placement rule; only its matching options appear below.</p>
                    </div>

                    <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-2">
                      <label className="block text-xs font-bold text-slate-300">Multiple Active Ads</label>
                      <label className="flex items-center gap-3 text-xs text-slate-300 pt-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editableCampaignConfig.feedInlineSettings?.rotateMultipleAds !== false}
                          onChange={(e) => handleUpdateFeedInlineSettings({ rotateMultipleAds: e.target.checked })}
                          className="h-4 w-4 accent-emerald-500"
                        />
                        Rotate ads between available active campaigns
                      </label>
                      <p className="text-[10px] text-slate-500">Off = repeat the first eligible active ad.</p>
                    </div>
                  </div>

                  {editableCampaignConfig.feedInlineSettings?.insertionMode === 'cadence' ? (
                    <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-2 max-w-sm">
                      <label className="block text-xs font-bold text-slate-300">Insert Ad After Every (N Jobs)</label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        step="1"
                        value={editableCampaignConfig.feedInlineSettings?.repeatEveryNJobs || 3}
                        onChange={(e) => {
                          const value = Number(e.target.value);
                          if (Number.isInteger(value) && value >= 1 && value <= 100) {
                            handleUpdateFeedInlineSettings({ repeatEveryNJobs: value });
                          }
                        }}
                        className="w-full bg-slate-900 border border-slate-700 text-xs sm:text-sm text-white rounded-xl px-3 py-2 font-bold"
                      />
                      <p className="text-[10px] text-slate-500">Example: 3 = after standard jobs 3, 6, 9...</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="space-y-2.5">
                        <label className="block text-xs font-bold text-slate-300">
                          Custom Feed Index Slots (e.g., after 2nd job, after 5th job, after 8th job)
                        </label>

                        <div className="flex flex-wrap items-center gap-2">
                          {(editableCampaignConfig.feedInlineSettings?.customIndices || []).map((idxNum) => (
                            <div
                              key={idxNum}
                              className="px-3 py-1.5 rounded-xl bg-slate-950 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center space-x-2"
                            >
                              <span>Slot {idxNum}</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveFeedCustomIndex(idxNum)}
                                className="p-0.5 rounded-full hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}

                          <div className="flex items-center space-x-2">
                            <input
                              type="number"
                              min="1"
                              placeholder="Index #"
                              value={quickFeedIndexInput}
                              onChange={(e) => setQuickFeedIndexInput(e.target.value)}
                              className="w-24 bg-slate-950 border border-slate-700 text-xs text-white rounded-xl px-3 py-1.5 font-mono focus:outline-none focus:border-emerald-500"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                handleAddFeedCustomIndex(parseInt(quickFeedIndexInput));
                                setQuickFeedIndexInput('');
                              }}
                              className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold flex items-center space-x-1 cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Add Slot</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-2">
                        <label className="block text-xs font-bold text-slate-300">Page 1 Special Ad Positions (Optional)</label>
                        <input
                          type="text"
                          value={(editableCampaignConfig.feedInlineSettings?.page1SpecificIndices || []).join(', ')}
                          onChange={(e) => {
                            const values = Array.from(
                              new Set(
                                e.target.value
                                  .split(',')
                                  .map((part) => Number(part.trim()))
                                  .filter((value) => Number.isInteger(value) && value >= 1 && value <= 100)
                              )
                            ).sort((a, b) => a - b);
                            handleUpdateFeedInlineSettings({ page1SpecificIndices: values });
                          }}
                          placeholder="Example: 2, 5, 8"
                          className="w-full bg-slate-900 border border-slate-700 text-xs text-white rounded-xl px-3 py-2 font-mono"
                        />
                        <p className="text-[10px] text-slate-500">Optional page 1 override. Leave empty to use the general custom positions.</p>
                      </div>
                    </div>
                  )}

                  {/* Inline Feed Card Styling & Appearance */}
                  <div className="pt-5 border-t border-slate-800 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <h4 className="text-sm font-black text-white flex items-center space-x-2">
                          <Eye className="w-4 h-4 text-emerald-400" />
                          <span>Inline Feed Card Styling &amp; Appearance</span>
                        </h4>
                        <p className="text-xs text-slate-400">Customize corner radius, padding, graphic positioning, and CTA button placement.</p>
                      </div>
                      <button
                        type="button"
                        onClick={handleRestoreFeedCardAppearanceDefault}
                        className="self-start sm:self-auto px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold border border-slate-700 transition-all cursor-pointer flex items-center space-x-1"
                      >
                        <RefreshCw className="w-3 h-3 text-emerald-400" />
                        <span>Restore Default</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3.5 space-y-1.5">
                        <label className="text-xs font-bold text-slate-300 block">Border Radius</label>
                        <select
                          value={editableCampaignConfig.feedCardAppearance?.borderRadiusPreset || '3xl'}
                          onChange={(e) => handleUpdateFeedCardAppearance({ borderRadiusPreset: e.target.value as any })}
                          className="w-full bg-slate-900 border border-slate-700 text-xs text-white rounded-xl px-3 py-2 font-bold focus:outline-none focus:border-emerald-500 cursor-pointer"
                        >
                          <option value="none">Square (0px)</option>
                          <option value="md">Rounded Medium (12px)</option>
                          <option value="xl">Rounded Large (20px)</option>
                          <option value="3xl">Extra Rounded (24px - Default)</option>
                        </select>
                      </div>

                      <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3.5 space-y-1.5">
                        <label className="text-xs font-bold text-slate-300 block">Card Padding</label>
                        <select
                          value={editableCampaignConfig.feedCardAppearance?.paddingPreset || 'standard'}
                          onChange={(e) => handleUpdateFeedCardAppearance({ paddingPreset: e.target.value as any })}
                          className="w-full bg-slate-900 border border-slate-700 text-xs text-white rounded-xl px-3 py-2 font-bold focus:outline-none focus:border-emerald-500 cursor-pointer"
                        >
                          <option value="compact">Compact Padding</option>
                          <option value="standard">Standard Padding</option>
                          <option value="spacious">Spacious Padding</option>
                        </select>
                      </div>

                      <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3.5 space-y-1.5">
                        <label className="text-xs font-bold text-slate-300 block">Image Position</label>
                        <select
                          value={editableCampaignConfig.feedCardAppearance?.imagePosition || 'left'}
                          onChange={(e) => handleUpdateFeedCardAppearance({ imagePosition: e.target.value as any })}
                          className="w-full bg-slate-900 border border-slate-700 text-xs text-white rounded-xl px-3 py-2 font-bold focus:outline-none focus:border-emerald-500 cursor-pointer"
                        >
                          <option value="left">Left Side (Standard)</option>
                          <option value="right">Right Side</option>
                        </select>
                      </div>

                      <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3.5 space-y-1.5">
                        <label className="text-xs font-bold text-slate-300 block">CTA Alignment</label>
                        <select
                          value={editableCampaignConfig.feedCardAppearance?.ctaAlignment || 'right'}
                          onChange={(e) => handleUpdateFeedCardAppearance({ ctaAlignment: e.target.value as any })}
                          className="w-full bg-slate-900 border border-slate-700 text-xs text-white rounded-xl px-3 py-2 font-bold focus:outline-none focus:border-emerald-500 cursor-pointer"
                        >
                          <option value="right">Right Aligned (Default)</option>
                          <option value="center">Center Aligned</option>
                          <option value="left">Left Aligned</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 text-xs text-slate-400">
                  Inline feed ads are currently disabled (Maximum Inline Ads = 0). Increase the limit above to configure insertion mode, slot positions, and inline card styling.
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3.5 border-t border-slate-800 bg-slate-950/60 flex flex-wrap items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsFeedSettingsModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
              >
                Done
              </button>
              <button
                type="button"
                onClick={async () => {
                  await handleSavePlacementRates();
                  setIsFeedSettingsModalOpen(false);
                }}
                disabled={isPlacementRatesSaving || !onUpdateCampaignConfig}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 text-xs font-black flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 cursor-pointer disabled:opacity-60"
              >
                {isPlacementRatesSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5 stroke-[3]" />}
                <span>{isPlacementRatesSaving ? 'Saving...' : 'Save Feed & Rate Settings'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TOP HEADER ANNOUNCEMENT BANNER APPEARANCE & ROTATION MODAL (COMPACT)      */}
      {/* ========================================================================= */}
      {isBannerSettingsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/85 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl w-full max-w-2xl max-h-[88vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Compact Modal Header */}
            <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between gap-2.5 bg-slate-950/60">
              <div className="min-w-0">
                <h3 className="text-xs sm:text-sm font-black text-white flex items-center gap-1.5">
                  <Eye className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span className="truncate">Top Header Banner Appearance &amp; Rotation</span>
                </h3>
                <p className="text-[10px] sm:text-[11px] text-slate-400 truncate mt-0.5">
                  Image visibility, alignment, padding, auto-rotation, and controls.
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={handleRestoreBannerAppearanceDefault}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold border border-slate-700 transition-all cursor-pointer flex items-center gap-1"
                  title="Restore Defaults"
                >
                  <RefreshCw className="w-3 h-3 text-indigo-400" />
                  <span className="hidden sm:inline">Restore Default</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsBannerSettingsModalOpen(false)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Compact Scrollable Body */}
            <div className="p-3.5 sm:p-5 overflow-y-auto space-y-4">
              {/* 1. Visibility Toggles Grid */}
              <div className="space-y-2">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Banner Elements Visibility</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {/* Show Banner Graphic / Image */}
                  <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-2.5 flex flex-col justify-between gap-2">
                    <div className="text-[11px] font-bold text-white leading-tight">Show Banner Graphic / Image</div>
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-bold text-slate-400">
                        {editableCampaignConfig.bannerAppearance?.showBannerImage !== false ? 'SHOW' : 'HIDE'}
                      </span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editableCampaignConfig.bannerAppearance?.showBannerImage !== false}
                          onChange={(e) => handleUpdateBannerAppearance({ showBannerImage: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-500" />
                      </label>
                    </div>
                  </div>

                  {/* Show CTA Action Button */}
                  <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-2.5 flex flex-col justify-between gap-2">
                    <div className="text-[11px] font-bold text-white leading-tight">Show CTA Action Button</div>
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-bold text-slate-400">
                        {editableCampaignConfig.bannerAppearance?.showCtaButton !== false ? 'SHOW' : 'HIDE'}
                      </span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editableCampaignConfig.bannerAppearance?.showCtaButton !== false}
                          onChange={(e) => handleUpdateBannerAppearance({ showCtaButton: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-500" />
                      </label>
                    </div>
                  </div>

                  {/* Show Badge Label */}
                  <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-2.5 flex flex-col justify-between gap-2">
                    <div className="text-[11px] font-bold text-white leading-tight">Show Badge Label</div>
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-bold text-slate-400">
                        {editableCampaignConfig.bannerAppearance?.showBadge !== false ? 'SHOW' : 'HIDE'}
                      </span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editableCampaignConfig.bannerAppearance?.showBadge !== false}
                          onChange={(e) => handleUpdateBannerAppearance({ showBadge: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-500" />
                      </label>
                    </div>
                  </div>

                  {/* Allow Dismiss (X) Button */}
                  <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-2.5 flex flex-col justify-between gap-2">
                    <div className="text-[11px] font-bold text-white leading-tight">Allow Dismiss (X) Button</div>
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-bold text-slate-400">
                        {editableCampaignConfig.bannerAppearance?.showDismissButton !== false ? 'ON' : 'OFF'}
                      </span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editableCampaignConfig.bannerAppearance?.showDismissButton !== false}
                          onChange={(e) => handleUpdateBannerAppearance({ showDismissButton: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-500" />
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Styling & Alignment Selectors */}
              <div className="pt-3 border-t border-slate-800/80 space-y-2">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Styling &amp; Layout Alignment</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {/* Banner Padding */}
                  <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-2.5 space-y-1">
                    <label className="text-[11px] font-bold text-slate-300 block">Banner Padding</label>
                    <select
                      value={editableCampaignConfig.bannerAppearance?.paddingPreset || 'standard'}
                      onChange={(e) => handleUpdateBannerAppearance({ paddingPreset: e.target.value as any })}
                      className="w-full bg-slate-900 border border-slate-700 text-[11px] text-white rounded-lg px-2 py-1.5 font-bold focus:outline-none focus:border-indigo-500 cursor-pointer"
                    >
                      <option value="compact">Compact</option>
                      <option value="standard">Standard (Default)</option>
                      <option value="spacious">Spacious</option>
                    </select>
                  </div>

                  {/* Image Position (shown only when banner image is enabled) */}
                  {editableCampaignConfig.bannerAppearance?.showBannerImage !== false && (
                    <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-2.5 space-y-1">
                      <label className="text-[11px] font-bold text-slate-300 block">Image Position</label>
                      <select
                        value={editableCampaignConfig.bannerAppearance?.imagePosition || 'left'}
                        onChange={(e) => handleUpdateBannerAppearance({ imagePosition: e.target.value as any })}
                        className="w-full bg-slate-900 border border-slate-700 text-[11px] text-white rounded-lg px-2 py-1.5 font-bold focus:outline-none focus:border-indigo-500 cursor-pointer"
                      >
                        <option value="left">Left Side</option>
                        <option value="right">Right Side</option>
                        <option value="top">Top Stacked</option>
                      </select>
                    </div>
                  )}

                  {/* Text Alignment */}
                  <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-2.5 space-y-1">
                    <label className="text-[11px] font-bold text-slate-300 block">Text Alignment</label>
                    <select
                      value={editableCampaignConfig.bannerAppearance?.textAlignment || 'left'}
                      onChange={(e) => handleUpdateBannerAppearance({ textAlignment: e.target.value as any })}
                      className="w-full bg-slate-900 border border-slate-700 text-[11px] text-white rounded-lg px-2 py-1.5 font-bold focus:outline-none focus:border-indigo-500 cursor-pointer"
                    >
                      <option value="left">Left Aligned</option>
                      <option value="center">Center Aligned</option>
                      <option value="right">Right Aligned</option>
                    </select>
                  </div>

                  {/* CTA Button Alignment (shown only when CTA button is enabled) */}
                  {editableCampaignConfig.bannerAppearance?.showCtaButton !== false && (
                    <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-2.5 space-y-1">
                      <label className="text-[11px] font-bold text-slate-300 block">CTA Alignment</label>
                      <select
                        value={editableCampaignConfig.bannerAppearance?.ctaAlignment || 'right'}
                        onChange={(e) => handleUpdateBannerAppearance({ ctaAlignment: e.target.value as any })}
                        className="w-full bg-slate-900 border border-slate-700 text-[11px] text-white rounded-lg px-2 py-1.5 font-bold focus:outline-none focus:border-indigo-500 cursor-pointer"
                      >
                        <option value="right">Right Aligned</option>
                        <option value="center">Center Aligned</option>
                        <option value="left">Left Aligned</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* 3. Rotation & Behavior Options */}
              <div className="pt-3 border-t border-slate-800/80 space-y-2">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Rotation &amp; Behavior Options</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {/* Auto-Rotate Multiple Banners */}
                  <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-2.5 flex flex-col justify-between gap-2">
                    <div className="text-[11px] font-bold text-white leading-tight">Auto-Rotate Banners</div>
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-bold text-slate-400">
                        {editableCampaignConfig.bannerBehavior?.autoRotate !== false ? 'ON' : 'OFF'}
                      </span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editableCampaignConfig.bannerBehavior?.autoRotate !== false}
                          onChange={(e) => handleUpdateBannerBehavior({ autoRotate: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-500" />
                      </label>
                    </div>
                  </div>

                  {/* Rotation Interval & Pause on Hover shown only when autoRotate is ON */}
                  {editableCampaignConfig.bannerBehavior?.autoRotate !== false && (
                    <>
                      <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-2.5 space-y-1">
                        <label className="text-[11px] font-bold text-slate-300 block">Rotation Interval</label>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min="2"
                            max="30"
                            value={editableCampaignConfig.bannerBehavior?.rotationIntervalSeconds ?? 6}
                            onChange={(e) => handleUpdateBannerBehavior({ rotationIntervalSeconds: parseInt(e.target.value) || 6 })}
                            className="w-full bg-slate-900 border border-slate-700 text-xs text-white rounded-lg px-2 py-1 font-mono font-bold focus:outline-none focus:border-indigo-500"
                          />
                          <span className="text-[11px] text-slate-400 font-bold">sec</span>
                        </div>
                      </div>

                      <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-2.5 flex flex-col justify-between gap-2">
                        <div className="text-[11px] font-bold text-white leading-tight">Pause on Hover</div>
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-bold text-slate-400">
                            {editableCampaignConfig.bannerBehavior?.pauseOnHover !== false ? 'PAUSE' : 'CONTINUE'}
                          </span>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={editableCampaignConfig.bannerBehavior?.pauseOnHover !== false}
                              onChange={(e) => handleUpdateBannerBehavior({ pauseOnHover: e.target.checked })}
                              className="sr-only peer"
                            />
                            <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-500" />
                          </label>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Show Navigation Arrows */}
                  <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-2.5 flex flex-col justify-between gap-2">
                    <div className="text-[11px] font-bold text-white leading-tight">Navigation Arrows</div>
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-bold text-slate-400">
                        {editableCampaignConfig.bannerBehavior?.showNavigationArrows !== false ? 'ON' : 'OFF'}
                      </span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editableCampaignConfig.bannerBehavior?.showNavigationArrows !== false}
                          onChange={(e) => handleUpdateBannerBehavior({ showNavigationArrows: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-500" />
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* 4. Top Announcement & Ad Banner Dimensions (Desktop & Mobile) */}
              <div className="pt-3 border-t border-slate-800/80 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-[10px] font-black text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Top Announcement &amp; Ad Banner Dimensions</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Adjust max-width and min-height bounds across desktop and mobile screens.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleRestoreBannerDimensionsDefault}
                    className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold border border-slate-700 transition-all cursor-pointer flex items-center gap-1 shrink-0"
                  >
                    <RefreshCw className="w-2.5 h-2.5 text-indigo-400" />
                    <span>Default Size</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* Desktop Screen Dimensions */}
                  <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 space-y-2">
                    <div className="text-[10px] font-black text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                      <Layout className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Desktop Screen Dimensions</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-300 mb-1">Desktop Max-Width</label>
                        <input
                          type="text"
                          value={editableCampaignConfig.bannerDimensions?.desktopWidth || '100%'}
                          onChange={(e) => handleUpdateBannerDimensions({ desktopWidth: e.target.value })}
                          placeholder="100%, 1280px"
                          className="w-full bg-slate-900 border border-slate-700 text-[11px] text-white rounded-lg px-2.5 py-1.5 font-mono focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-300 mb-1">Desktop Min-Height</label>
                        <input
                          type="text"
                          value={editableCampaignConfig.bannerDimensions?.desktopHeight || 'auto'}
                          onChange={(e) => handleUpdateBannerDimensions({ desktopHeight: e.target.value })}
                          placeholder="auto, 120px"
                          className="w-full bg-slate-900 border border-slate-700 text-[11px] text-white rounded-lg px-2.5 py-1.5 font-mono focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Mobile Screen Dimensions */}
                  <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 space-y-2">
                    <div className="text-[10px] font-black text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                      <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Mobile Screen Dimensions</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-300 mb-1">Mobile Max-Width</label>
                        <input
                          type="text"
                          value={editableCampaignConfig.bannerDimensions?.mobileWidth || '100%'}
                          onChange={(e) => handleUpdateBannerDimensions({ mobileWidth: e.target.value })}
                          placeholder="100%, 360px"
                          className="w-full bg-slate-900 border border-slate-700 text-[11px] text-white rounded-lg px-2.5 py-1.5 font-mono focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-300 mb-1">Mobile Min-Height</label>
                        <input
                          type="text"
                          value={editableCampaignConfig.bannerDimensions?.mobileHeight || 'auto'}
                          onChange={(e) => handleUpdateBannerDimensions({ mobileHeight: e.target.value })}
                          placeholder="auto, 100px"
                          className="w-full bg-slate-900 border border-slate-700 text-[11px] text-white rounded-lg px-2.5 py-1.5 font-mono focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Compact Modal Footer */}
            <div className="px-4 py-3 border-t border-slate-800 bg-slate-950/60 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsBannerSettingsModalOpen(false)}
                className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
              >
                Done
              </button>
              <button
                type="button"
                onClick={async () => {
                  await handleSavePlacementRates();
                  setIsBannerSettingsModalOpen(false);
                }}
                disabled={isPlacementRatesSaving || !onUpdateCampaignConfig}
                className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-400 hover:to-blue-400 text-white text-xs font-black flex items-center gap-1.5 shadow-lg shadow-indigo-500/20 cursor-pointer disabled:opacity-60"
              >
                {isPlacementRatesSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5 stroke-[3]" />}
                <span>{isPlacementRatesSaving ? 'Saving...' : 'Save Banner & Rate Settings'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
