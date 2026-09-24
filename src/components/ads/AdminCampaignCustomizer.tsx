import React, { useState } from 'react';
import { 
  CampaignCustomizationConfig, 
  PortalPageConfig, 
  CampaignDurationPreset, 
  CampaignPlacementOption, 
  AdDurationUnit,
  AdPlacement,
  AdType,
  PopupDisplaySettings,
  FeedInlineAdSettings,
  BannerDimensionSettings,
  BannerAppearanceSettings,
  BannerBehaviorSettings,
  PopupAppearanceSettings,
  FeedCardAppearanceSettings,
  PromoDiscountBanner,
  JobPostingFeeSettings,
  DEFAULT_CAMPAIGN_CUSTOMIZATION_CONFIG,
  DEFAULT_BANNER_DIMENSIONS,
  DEFAULT_BANNER_APPEARANCE,
  DEFAULT_BANNER_BEHAVIOR,
  DEFAULT_POPUP_APPEARANCE,
  DEFAULT_FEED_CARD_APPEARANCE,
  isPageScheduledActive,
  getPageDisplayName,
  getPlacementDisplayName
} from '../../types/ad';
import { 
  Settings, 
  Sliders, 
  Calendar, 
  Clock, 
  Plus, 
  Trash2, 
  Edit3, 
  Check, 
  X, 
  Sparkles, 
  ShieldCheck, 
  Layers, 
  Bell, 
  Briefcase, 
  FileText, 
  Users, 
  Globe, 
  Tag, 
  AlertCircle, 
  Save, 
  RefreshCw,
  Eye,
  CheckCircle2,
  Lock,
  Unlock,
  Radio,
  Flame,
  Zap,
  DollarSign,
  Smartphone,
  Layout,
  Percent,
  CheckSquare,
  HelpCircle,
  Copy,
  ChevronRight
} from 'lucide-react';

interface AdminCampaignCustomizerProps {
  config?: CampaignCustomizationConfig;
  onSaveConfig: (updatedConfig: CampaignCustomizationConfig) => void;
  onResetDefaults?: () => void;
}

export const AdminCampaignCustomizer: React.FC<AdminCampaignCustomizerProps> = ({
  config = DEFAULT_CAMPAIGN_CUSTOMIZATION_CONFIG,
  onSaveConfig,
  onResetDefaults
}) => {
  const [localConfig, setLocalConfig] = useState<CampaignCustomizationConfig>(() => ({
    ...DEFAULT_CAMPAIGN_CUSTOMIZATION_CONFIG,
    ...config,
    popupSettings: config.popupSettings || DEFAULT_CAMPAIGN_CUSTOMIZATION_CONFIG.popupSettings,
    feedInlineSettings: config.feedInlineSettings || DEFAULT_CAMPAIGN_CUSTOMIZATION_CONFIG.feedInlineSettings,
    bannerDimensions: config.bannerDimensions || DEFAULT_BANNER_DIMENSIONS,
    bannerAppearance: config.bannerAppearance || DEFAULT_CAMPAIGN_CUSTOMIZATION_CONFIG.bannerAppearance,
    bannerBehavior: config.bannerBehavior || DEFAULT_CAMPAIGN_CUSTOMIZATION_CONFIG.bannerBehavior,
    popupAppearance: config.popupAppearance || DEFAULT_CAMPAIGN_CUSTOMIZATION_CONFIG.popupAppearance,
    feedCardAppearance: config.feedCardAppearance || DEFAULT_CAMPAIGN_CUSTOMIZATION_CONFIG.feedCardAppearance,
    promoBanners: config.promoBanners || DEFAULT_CAMPAIGN_CUSTOMIZATION_CONFIG.promoBanners,
    jobPostingFeeSettings: config.jobPostingFeeSettings || DEFAULT_CAMPAIGN_CUSTOMIZATION_CONFIG.jobPostingFeeSettings
  }));

  const [activeTab, setActiveTab] = useState<
    'popup-modes' | 'feed-positioning' | 'banner-dimensions' | 'banner-appearance' | 'placements' | 'promo-banners' | 'job-fees' | 'rules'
  >('popup-modes');

  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  // New Promo Banner Modal State
  const [isAddPromoOpen, setIsAddPromoOpen] = useState(false);
  const [newPromoTitle, setNewPromoTitle] = useState('50% Flash Discount Special');
  const [newPromoDesc, setNewPromoDesc] = useState('Book any premium banner or popup at flat 50% discount this week.');
  const [newPromoDiscount, setNewPromoDiscount] = useState(50);
  const [newPromoBadge, setNewPromoBadge] = useState('🔥 50% OFF FLASH SALE');
  const [newPromoCode, setNewPromoCode] = useState('CAREER50');
  const [newPromoPlacement, setNewPromoPlacement] = useState<AdPlacement | 'all'>('all');
  const [newPromoValidUntil, setNewPromoValidUntil] = useState(new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10));
  const [newPromoGradient, setNewPromoGradient] = useState('from-amber-600 via-rose-600 to-indigo-700');

  // Custom Index Quick Adder State
  const [quickIndexInput, setQuickIndexInput] = useState<string>('');

  // Save changes handler
  const handleSave = () => {
    onSaveConfig(localConfig);
    setSaveSuccessMessage('All campaign settings, placement rules, and appearance modes saved successfully!');
    setTimeout(() => setSaveSuccessMessage(null), 3500);
  };

  // Global reset handler
  const handleReset = () => {
    if (window.confirm('Reset all campaign settings to platform defaults?')) {
      setLocalConfig(DEFAULT_CAMPAIGN_CUSTOMIZATION_CONFIG);
      onSaveConfig(DEFAULT_CAMPAIGN_CUSTOMIZATION_CONFIG);
      if (onResetDefaults) onResetDefaults();
      setSaveSuccessMessage('Reset to platform defaults successfully!');
      setTimeout(() => setSaveSuccessMessage(null), 3000);
    }
  };

  // -------------------------------------------------------------
  // POPUP DISPLAY SETTINGS HANDLERS
  // -------------------------------------------------------------
  const handleUpdatePopupSettings = (updates: Partial<PopupDisplaySettings>) => {
    setLocalConfig(prev => ({
      ...prev,
      popupSettings: {
        ...prev.popupSettings,
        ...updates
      }
    }));
  };

  const handleUpdatePopupAppearance = (updates: Partial<PopupAppearanceSettings>) => {
    setLocalConfig(prev => ({
      ...prev,
      popupAppearance: {
        ...(prev.popupAppearance || DEFAULT_POPUP_APPEARANCE),
        ...updates
      }
    }));
  };

  const handleRestorePopupAppearanceDefault = () => {
    setLocalConfig(prev => ({
      ...prev,
      popupAppearance: { ...DEFAULT_POPUP_APPEARANCE }
    }));
    setSaveSuccessMessage('Popup lightbox appearance restored to defaults!');
    setTimeout(() => setSaveSuccessMessage(null), 3000);
  };

  // -------------------------------------------------------------
  // FEED INLINE SETTINGS HANDLERS
  // -------------------------------------------------------------
  const handleUpdateFeedInlineSettings = (updates: Partial<FeedInlineAdSettings>) => {
    setLocalConfig(prev => ({
      ...prev,
      feedInlineSettings: {
        ...prev.feedInlineSettings,
        ...updates
      }
    }));
  };

  const handleUpdateFeedCardAppearance = (updates: Partial<FeedCardAppearanceSettings>) => {
    setLocalConfig(prev => ({
      ...prev,
      feedCardAppearance: {
        ...(prev.feedCardAppearance || DEFAULT_FEED_CARD_APPEARANCE),
        ...updates
      }
    }));
  };

  const handleRestoreFeedCardAppearanceDefault = () => {
    setLocalConfig(prev => ({
      ...prev,
      feedCardAppearance: { ...DEFAULT_FEED_CARD_APPEARANCE }
    }));
    setSaveSuccessMessage('Inline feed card appearance restored to defaults!');
    setTimeout(() => setSaveSuccessMessage(null), 3000);
  };

  const handleAddCustomIndex = (indexNum: number) => {
    if (indexNum <= 0 || isNaN(indexNum)) return;
    const current = localConfig.feedInlineSettings.customIndices || [];
    if (!current.includes(indexNum)) {
      const updated = [...current, indexNum].sort((a, b) => a - b);
      handleUpdateFeedInlineSettings({ customIndices: updated });
    }
  };

  const handleRemoveCustomIndex = (indexNum: number) => {
    const current = localConfig.feedInlineSettings.customIndices || [];
    handleUpdateFeedInlineSettings({
      customIndices: current.filter(n => n !== indexNum)
    });
  };

  // -------------------------------------------------------------
  // BANNER DIMENSION HANDLERS
  // -------------------------------------------------------------
  const handleUpdateBannerDimensions = (updates: Partial<BannerDimensionSettings>) => {
    setLocalConfig(prev => ({
      ...prev,
      bannerDimensions: {
        ...(prev.bannerDimensions || DEFAULT_BANNER_DIMENSIONS),
        ...updates
      }
    }));
  };

  const handleRestoreBannerDimensionsDefault = () => {
    setLocalConfig(prev => ({
      ...prev,
      bannerDimensions: { ...DEFAULT_BANNER_DIMENSIONS }
    }));
    setSaveSuccessMessage('Banner dimensions restored to default working values (100% x auto)!');
    setTimeout(() => setSaveSuccessMessage(null), 3500);
  };

  // -------------------------------------------------------------
  // BANNER APPEARANCE & BEHAVIOR HANDLERS
  // -------------------------------------------------------------
  const handleUpdateBannerAppearance = (updates: Partial<BannerAppearanceSettings>) => {
    setLocalConfig(prev => ({
      ...prev,
      bannerAppearance: {
        ...(prev.bannerAppearance || DEFAULT_BANNER_APPEARANCE),
        ...updates
      }
    }));
  };

  const handleUpdateBannerBehavior = (updates: Partial<BannerBehaviorSettings>) => {
    setLocalConfig(prev => ({
      ...prev,
      bannerBehavior: {
        ...(prev.bannerBehavior || DEFAULT_BANNER_BEHAVIOR),
        ...updates
      }
    }));
  };

  const handleRestoreBannerAppearanceDefault = () => {
    setLocalConfig(prev => ({
      ...prev,
      bannerAppearance: { ...DEFAULT_BANNER_APPEARANCE },
      bannerBehavior: { ...DEFAULT_BANNER_BEHAVIOR }
    }));
    setSaveSuccessMessage('Banner appearance & behavior restored to defaults!');
    setTimeout(() => setSaveSuccessMessage(null), 3000);
  };

  // -------------------------------------------------------------
  // PROMO DISCOUNT BANNERS HANDLERS
  // -------------------------------------------------------------
  const handleTogglePromoBanner = (id: string) => {
    setLocalConfig(prev => ({
      ...prev,
      promoBanners: prev.promoBanners.map(b => b.id === id ? { ...b, isEnabled: !b.isEnabled } : b)
    }));
  };

  const handleDeletePromoBanner = (id: string) => {
    setLocalConfig(prev => ({
      ...prev,
      promoBanners: prev.promoBanners.filter(b => b.id !== id)
    }));
  };

  const handleCreatePromoBanner = () => {
    const newBanner: PromoDiscountBanner = {
      id: `promo-custom-${Date.now()}`,
      isEnabled: true,
      title: newPromoTitle,
      description: newPromoDesc,
      discountPercent: newPromoDiscount,
      badgeText: newPromoBadge,
      promoCode: newPromoCode,
      targetPlacement: newPromoPlacement,
      validUntil: newPromoValidUntil,
      bgGradient: newPromoGradient,
      ctaText: 'Claim Discount Now',
      ctaUrl: '#dashboard'
    };

    setLocalConfig(prev => ({
      ...prev,
      promoBanners: [newBanner, ...prev.promoBanners]
    }));

    setIsAddPromoOpen(false);
    setSaveSuccessMessage(`Created promo banner "${newPromoTitle}"! Click Save All to make permanent.`);
    setTimeout(() => setSaveSuccessMessage(null), 3500);
  };

  // -------------------------------------------------------------
  // PLACEMENT OPTION HANDLERS
  // -------------------------------------------------------------
  const handleUpdatePlacement = (id: AdPlacement, updates: Partial<CampaignPlacementOption>) => {
    setLocalConfig(prev => ({
      ...prev,
      placementOptions: prev.placementOptions.map(p => p.id === id ? { ...p, ...updates } : p)
    }));
  };

  // -------------------------------------------------------------
  // JOB POSTING FEE HANDLERS
  // -------------------------------------------------------------
  const handleUpdateJobPostingFeeSettings = (updates: Partial<JobPostingFeeSettings>) => {
    setLocalConfig(prev => ({
      ...prev,
      jobPostingFeeSettings: {
        ...(prev.jobPostingFeeSettings || {
          isFreeAll: false,
          customStandardFeePkr: 500,
          globalDiscountPercent: 0,
          promoBannerText: ''
        }),
        ...updates
      }
    }));
  };

  return (
    <div className="space-y-6">
      
      {/* Top Header Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-2 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30">
              <Sliders className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-black text-white">Campaign & Placement Engine</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Configure Centered Popup Lightbox queue modes, Job Feed Inline Card frequencies, All 6 Ad Placements, 100% Free overrides, Banner Dimensions, and Promotional Discount Banners.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleReset}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>

          <button
            onClick={handleSave}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 text-xs font-black shadow-lg shadow-emerald-500/20 transition-all cursor-pointer flex items-center space-x-1.5 active:scale-95"
          >
            <Save className="w-4 h-4" />
            <span>Save All Configurations</span>
          </button>
        </div>
      </div>

      {/* Save Success Alert Banner */}
      {saveSuccessMessage && (
        <div className="p-4 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center justify-between animate-fadeIn">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{saveSuccessMessage}</span>
          </div>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div className="flex flex-wrap gap-2 p-1.5 bg-slate-900/80 border border-slate-800 rounded-2xl">
        {[
          { id: 'popup-modes', label: 'Centered Popup Lightbox', icon: Sparkles, badge: localConfig.popupSettings.displayMode },
          { id: 'feed-positioning', label: 'Job Feed Inline Frequency', icon: Layers, badge: `${localConfig.feedInlineSettings.customIndices.length} slots` },
          { id: 'banner-dimensions', label: 'Banner Dimensions', icon: Sliders, badge: 'Custom Sizes' },
          { id: 'banner-appearance', label: 'Banner Styling & Rotation', icon: Eye, badge: 'Appearance' },
          { id: 'placements', label: 'All 6 Placement Models', icon: Layout, badge: 'Full Control' },
          { id: 'promo-banners', label: 'Promotional Discount Banners', icon: Percent, badge: `${localConfig.promoBanners.filter(b => b.isEnabled).length} active` },
          { id: 'job-fees', label: 'Job Posting Fee Override', icon: DollarSign, badge: localConfig.jobPostingFeeSettings?.isFreeAll ? '100% FREE' : 'Custom' },
          { id: 'rules', label: 'Policy Rules', icon: ShieldCheck }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center space-x-2 transition-all cursor-pointer ${
                isActive
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20 font-black'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
              {tab.badge && (
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold uppercase ${
                  isActive ? 'bg-slate-950/30 text-slate-950' : 'bg-slate-800 text-slate-300 border border-slate-700'
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ========================================================= */}
      {/* 1. CENTERED POPUP LIGHTBOX QUEUE & APPEARANCE TAB        */}
      {/* ========================================================= */}
      {activeTab === 'popup-modes' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
            <div>
              <div className="flex items-center space-x-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                <h3 className="text-lg font-black text-white">Centered Popup Lightbox Modal Customizer</h3>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Customize how centered popup lightbox ads are presented to visitors upon entering the portal.
              </p>
            </div>

            {/* Display Mode Selection Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Option 1: Sequential One-by-One Queue on Cross */}
              <div
                onClick={() => handleUpdatePopupSettings({ displayMode: 'sequential' })}
                className={`p-5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                  localConfig.popupSettings.displayMode === 'sequential'
                    ? 'bg-amber-500/10 border-amber-500 shadow-lg shadow-amber-500/10'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-black text-amber-400 uppercase tracking-wider">Sequential Queue</span>
                    <Radio className={`w-4 h-4 ${localConfig.popupSettings.displayMode === 'sequential' ? 'text-amber-400' : 'text-slate-600'}`} />
                  </div>
                  <h4 className="text-sm font-bold text-white mb-1">One-By-One On Dismiss</h4>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    When candidate closes popup 1, popup 2 smoothly transitions after 0.8 seconds.
                  </p>
                </div>
              </div>

              {/* Option 2: Stacked Dual Popups */}
              <div
                onClick={() => handleUpdatePopupSettings({ displayMode: 'stacked_dual' })}
                className={`p-5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                  localConfig.popupSettings.displayMode === 'stacked_dual'
                    ? 'bg-amber-500/10 border-amber-500 shadow-lg shadow-amber-500/10'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-black text-amber-400 uppercase tracking-wider">Stacked Dual Grid</span>
                    <Radio className={`w-4 h-4 ${localConfig.popupSettings.displayMode === 'stacked_dual' ? 'text-amber-400' : 'text-slate-600'}`} />
                  </div>
                  <h4 className="text-sm font-bold text-white mb-1">Two Side-By-Side Popups</h4>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Displays top 2 matching popup sponsors side-by-side in a split grid.
                  </p>
                </div>
              </div>

              {/* Option 3: Single Priority Popup Only */}
              <div
                onClick={() => handleUpdatePopupSettings({ displayMode: 'single' })}
                className={`p-5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                  localConfig.popupSettings.displayMode === 'single'
                    ? 'bg-amber-500/10 border-amber-500 shadow-lg shadow-amber-500/10'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-black text-amber-400 uppercase tracking-wider">Single Priority</span>
                    <Radio className={`w-4 h-4 ${localConfig.popupSettings.displayMode === 'single' ? 'text-amber-400' : 'text-slate-600'}`} />
                  </div>
                  <h4 className="text-sm font-bold text-white mb-1">Highest Priority Only</h4>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Only shows 1 top priority popup. No queue when dismissed.
                  </p>
                </div>
              </div>
            </div>

            {/* Popup Appearance Controls */}
            <div className="pt-6 border-t border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-black text-white flex items-center space-x-2">
                    <Eye className="w-4 h-4 text-amber-400" />
                    <span>Popup Lightbox Appearance & Entry Delay</span>
                  </h4>
                  <p className="text-xs text-slate-400">Configure modal width, overlay backdrop tint, entry delay, and close button.</p>
                </div>
                <button
                  type="button"
                  onClick={handleRestorePopupAppearanceDefault}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold border border-slate-700 transition-all cursor-pointer flex items-center space-x-1"
                >
                  <RefreshCw className="w-3 h-3 text-amber-400" />
                  <span>Restore Default</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                {/* Popup Width Preset */}
                <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-2">
                  <label className="text-xs font-bold text-slate-300 block">Popup Modal Width</label>
                  <select
                    value={localConfig.popupAppearance?.popupWidthPreset || 'standard'}
                    onChange={(e) => handleUpdatePopupAppearance({ popupWidthPreset: e.target.value as any })}
                    className="w-full bg-slate-900 border border-slate-700 text-xs text-white rounded-xl px-3 py-2 font-bold focus:outline-none focus:border-amber-500 cursor-pointer"
                  >
                    <option value="compact">Compact (Max 480px)</option>
                    <option value="standard">Standard (Max 600px)</option>
                    <option value="wide">Wide (Max 768px)</option>
                  </select>
                </div>

                {/* Overlay Backdrop Opacity */}
                <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-2">
                  <label className="text-xs font-bold text-slate-300 block">Overlay Backdrop Opacity</label>
                  <select
                    value={localConfig.popupAppearance?.overlayOpacityPreset || 'standard'}
                    onChange={(e) => handleUpdatePopupAppearance({ overlayOpacityPreset: e.target.value as any })}
                    className="w-full bg-slate-900 border border-slate-700 text-xs text-white rounded-xl px-3 py-2 font-bold focus:outline-none focus:border-amber-500 cursor-pointer"
                  >
                    <option value="light">Light Tint (60% Opacity)</option>
                    <option value="standard">Standard Dark (80% Opacity)</option>
                    <option value="dark">Heavy Dark (95% Opacity)</option>
                  </select>
                </div>

                {/* Initial Display Delay */}
                <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-2">
                  <label className="text-xs font-bold text-slate-300 block">Initial Entry Delay</label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      min="0"
                      max="10"
                      step="0.5"
                      value={localConfig.popupAppearance?.initialDisplayDelaySeconds ?? 1}
                      onChange={(e) => handleUpdatePopupAppearance({ initialDisplayDelaySeconds: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-slate-900 border border-slate-700 text-xs text-white rounded-xl px-3 py-2 font-mono font-bold focus:outline-none focus:border-amber-500"
                    />
                    <span className="text-xs text-slate-400 font-bold">sec</span>
                  </div>
                </div>

                {/* Close Button Visibility */}
                <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between space-y-2">
                  <label className="text-xs font-bold text-slate-300 block">Show Close (X) Button</label>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] font-bold text-slate-400">
                      {localConfig.popupAppearance?.showCloseButton !== false ? 'VISIBLE' : 'HIDDEN'}
                    </span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={localConfig.popupAppearance?.showCloseButton !== false}
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
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. JOB FEED INLINE FREQUENCY & CARD STYLING TAB            */}
      {/* ========================================================= */}
      {activeTab === 'feed-positioning' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
            <div>
              <div className="flex items-center space-x-2">
                <Layers className="w-5 h-5 text-emerald-400" />
                <h3 className="text-lg font-black text-white">Job Feed Inline Sponsored Card Frequency</h3>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Control exact job listing slot positions where sponsored cards are inserted.
              </p>
            </div>

            {/* Custom Indices Slots */}
            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-300">
                Custom Feed Index Slots (e.g., after 2nd job, after 5th job, after 8th job)
              </label>

              <div className="flex flex-wrap items-center gap-2">
                {(localConfig.feedInlineSettings.customIndices || []).map((idxNum) => (
                  <div key={idxNum} className="px-3 py-1.5 rounded-xl bg-slate-950 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center space-x-2">
                    <span>Slot {idxNum}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveCustomIndex(idxNum)}
                      className="p-0.5 rounded-full hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors"
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
                    value={quickIndexInput}
                    onChange={(e) => setQuickIndexInput(e.target.value)}
                    className="w-24 bg-slate-950 border border-slate-700 text-xs text-white rounded-xl px-3 py-1.5 font-mono focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      handleAddCustomIndex(parseInt(quickIndexInput));
                      setQuickIndexInput('');
                    }}
                    className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold flex items-center space-x-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Slot</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Feed Card Appearance Controls */}
            <div className="pt-6 border-t border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-black text-white flex items-center space-x-2">
                    <Eye className="w-4 h-4 text-emerald-400" />
                    <span>Inline Feed Card Styling & Appearance</span>
                  </h4>
                  <p className="text-xs text-slate-400">Customize corner radius, padding, graphic positioning, and CTA button placement.</p>
                </div>
                <button
                  type="button"
                  onClick={handleRestoreFeedCardAppearanceDefault}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold border border-slate-700 transition-all cursor-pointer flex items-center space-x-1"
                >
                  <RefreshCw className="w-3 h-3 text-emerald-400" />
                  <span>Restore Default</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                {/* Border Radius */}
                <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-2">
                  <label className="text-xs font-bold text-slate-300 block">Border Radius</label>
                  <select
                    value={localConfig.feedCardAppearance?.borderRadiusPreset || '3xl'}
                    onChange={(e) => handleUpdateFeedCardAppearance({ borderRadiusPreset: e.target.value as any })}
                    className="w-full bg-slate-900 border border-slate-700 text-xs text-white rounded-xl px-3 py-2 font-bold focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="none">Square (0px)</option>
                    <option value="md">Rounded Medium (12px)</option>
                    <option value="xl">Rounded Large (20px)</option>
                    <option value="3xl">Extra Rounded (24px - Default)</option>
                  </select>
                </div>

                {/* Padding Preset */}
                <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-2">
                  <label className="text-xs font-bold text-slate-300 block">Card Padding</label>
                  <select
                    value={localConfig.feedCardAppearance?.paddingPreset || 'standard'}
                    onChange={(e) => handleUpdateFeedCardAppearance({ paddingPreset: e.target.value as any })}
                    className="w-full bg-slate-900 border border-slate-700 text-xs text-white rounded-xl px-3 py-2 font-bold focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="compact">Compact Padding</option>
                    <option value="standard">Standard Padding</option>
                    <option value="spacious">Spacious Padding</option>
                  </select>
                </div>

                {/* Image Position */}
                <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-2">
                  <label className="text-xs font-bold text-slate-300 block">Image Position</label>
                  <select
                    value={localConfig.feedCardAppearance?.imagePosition || 'left'}
                    onChange={(e) => handleUpdateFeedCardAppearance({ imagePosition: e.target.value as any })}
                    className="w-full bg-slate-900 border border-slate-700 text-xs text-white rounded-xl px-3 py-2 font-bold focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="left">Left Side (Standard)</option>
                    <option value="right">Right Side</option>
                  </select>
                </div>

                {/* CTA Alignment */}
                <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-2">
                  <label className="text-xs font-bold text-slate-300 block">CTA Alignment</label>
                  <select
                    value={localConfig.feedCardAppearance?.ctaAlignment || 'right'}
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
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. BANNER DIMENSIONS TAB                                  */}
      {/* ========================================================= */}
      {activeTab === 'banner-dimensions' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <div className="flex items-center space-x-2">
                  <Sliders className="w-5 h-5 text-indigo-400" />
                  <h3 className="text-lg font-black text-white">Top Announcement & Ad Banner Dimensions</h3>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Adjust max-width and min-height bounds across desktop and mobile screens.
                </p>
              </div>

              <button
                type="button"
                onClick={handleRestoreBannerDimensionsDefault}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold border border-slate-700 transition-all cursor-pointer flex items-center space-x-1.5 shrink-0"
              >
                <RefreshCw className="w-4 h-4 text-indigo-400" />
                <span>Restore Default</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Desktop Dimensions */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-5 space-y-4">
                <h4 className="text-xs font-black text-slate-200 uppercase tracking-wider flex items-center space-x-2">
                  <Layout className="w-4 h-4 text-indigo-400" />
                  <span>Desktop Screen Dimensions</span>
                </h4>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Desktop Max-Width</label>
                    <input
                      type="text"
                      value={localConfig.bannerDimensions?.desktopWidth || '100%'}
                      onChange={(e) => handleUpdateBannerDimensions({ desktopWidth: e.target.value })}
                      placeholder="e.g. 100%, 1280px, 728px"
                      className="w-full bg-slate-900 border border-slate-700 text-xs text-white rounded-xl px-3.5 py-2 font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Desktop Min-Height</label>
                    <input
                      type="text"
                      value={localConfig.bannerDimensions?.desktopHeight || 'auto'}
                      onChange={(e) => handleUpdateBannerDimensions({ desktopHeight: e.target.value })}
                      placeholder="e.g. auto, 120px, 90px"
                      className="w-full bg-slate-900 border border-slate-700 text-xs text-white rounded-xl px-3.5 py-2 font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Mobile Dimensions */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-5 space-y-4">
                <h4 className="text-xs font-black text-slate-200 uppercase tracking-wider flex items-center space-x-2">
                  <Smartphone className="w-4 h-4 text-cyan-400" />
                  <span>Mobile Screen Dimensions</span>
                </h4>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Mobile Max-Width</label>
                    <input
                      type="text"
                      value={localConfig.bannerDimensions?.mobileWidth || '100%'}
                      onChange={(e) => handleUpdateBannerDimensions({ mobileWidth: e.target.value })}
                      placeholder="e.g. 100%, 360px, 320px"
                      className="w-full bg-slate-900 border border-slate-700 text-xs text-white rounded-xl px-3.5 py-2 font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Mobile Min-Height</label>
                    <input
                      type="text"
                      value={localConfig.bannerDimensions?.mobileHeight || 'auto'}
                      onChange={(e) => handleUpdateBannerDimensions({ mobileHeight: e.target.value })}
                      placeholder="e.g. auto, 100px, 50px"
                      className="w-full bg-slate-900 border border-slate-700 text-xs text-white rounded-xl px-3.5 py-2 font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 4. BANNER STYLING & ROTATION TAB                          */}
      {/* ========================================================= */}
      {activeTab === 'banner-appearance' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center space-x-2">
                  <Eye className="w-5 h-5 text-indigo-400" />
                  <h3 className="text-lg font-black text-white">Top Header Announcement Banner Appearance & Rotation</h3>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Customize image visibility, button sizes, auto-rotation interval, pause on hover, navigation controls, and dismiss options.
                </p>
              </div>

              <button
                type="button"
                onClick={handleRestoreBannerAppearanceDefault}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold border border-slate-700 transition-all cursor-pointer flex items-center space-x-1.5"
              >
                <RefreshCw className="w-4 h-4 text-indigo-400" />
                <span>Restore Default</span>
              </button>
            </div>

            {/* Appearance Toggles Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {/* Show Image */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between space-y-3">
                <div className="text-xs font-bold text-white">Show Banner Graphic / Image</div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] font-bold text-slate-400">
                    {localConfig.bannerAppearance?.showBannerImage !== false ? 'SHOW IMAGE' : 'HIDE IMAGE'}
                  </span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={localConfig.bannerAppearance?.showBannerImage !== false}
                      onChange={(e) => handleUpdateBannerAppearance({ showBannerImage: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500" />
                  </label>
                </div>
              </div>

              {/* Show CTA Button */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between space-y-3">
                <div className="text-xs font-bold text-white">Show CTA Action Button</div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] font-bold text-slate-400">
                    {localConfig.bannerAppearance?.showCtaButton !== false ? 'SHOW BUTTON' : 'HIDE BUTTON'}
                  </span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={localConfig.bannerAppearance?.showCtaButton !== false}
                      onChange={(e) => handleUpdateBannerAppearance({ showCtaButton: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500" />
                  </label>
                </div>
              </div>

              {/* Show Badge */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between space-y-3">
                <div className="text-xs font-bold text-white">Show Badge Label</div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] font-bold text-slate-400">
                    {localConfig.bannerAppearance?.showBadge !== false ? 'SHOW BADGE' : 'HIDE BADGE'}
                  </span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={localConfig.bannerAppearance?.showBadge !== false}
                      onChange={(e) => handleUpdateBannerAppearance({ showBadge: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500" />
                  </label>
                </div>
              </div>

              {/* Show Dismiss (X) */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between space-y-3">
                <div className="text-xs font-bold text-white">Allow Dismiss (X) Button</div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] font-bold text-slate-400">
                    {localConfig.bannerAppearance?.showDismissButton !== false ? 'DISMISS ON' : 'DISMISS OFF'}
                  </span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={localConfig.bannerAppearance?.showDismissButton !== false}
                      onChange={(e) => handleUpdateBannerAppearance({ showDismissButton: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500" />
                  </label>
                </div>
              </div>
            </div>

            {/* Behavior & Rotation Controls */}
            <div className="pt-4 border-t border-slate-800 space-y-4">
              <h4 className="text-xs font-black text-slate-200 uppercase tracking-wider">Rotation & Behavior Options</h4>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                {/* Auto Rotate */}
                <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between space-y-3">
                  <div className="text-xs font-bold text-white">Auto-Rotate Multiple Banners</div>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] font-bold text-slate-400">
                      {localConfig.bannerBehavior?.autoRotate !== false ? 'AUTO-ROTATE ON' : 'AUTO-ROTATE OFF'}
                    </span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={localConfig.bannerBehavior?.autoRotate !== false}
                        onChange={(e) => handleUpdateBannerBehavior({ autoRotate: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500" />
                    </label>
                  </div>
                </div>

                {/* Rotation Interval */}
                <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-2">
                  <label className="text-xs font-bold text-slate-300 block">Rotation Interval</label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      min="2"
                      max="30"
                      value={localConfig.bannerBehavior?.rotationIntervalSeconds ?? 6}
                      onChange={(e) => handleUpdateBannerBehavior({ rotationIntervalSeconds: parseInt(e.target.value) || 6 })}
                      className="w-full bg-slate-900 border border-slate-700 text-xs text-white rounded-xl px-3 py-2 font-mono font-bold focus:outline-none focus:border-indigo-500"
                    />
                    <span className="text-xs text-slate-400 font-bold">sec</span>
                  </div>
                </div>

                {/* Pause on Hover */}
                <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between space-y-3">
                  <div className="text-xs font-bold text-white">Pause Rotation on Hover</div>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] font-bold text-slate-400">
                      {localConfig.bannerBehavior?.pauseOnHover !== false ? 'PAUSE ON HOVER' : 'CONTINUE ROTATION'}
                    </span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={localConfig.bannerBehavior?.pauseOnHover !== false}
                        onChange={(e) => handleUpdateBannerBehavior({ pauseOnHover: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500" />
                    </label>
                  </div>
                </div>

                {/* Navigation Arrows */}
                <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between space-y-3">
                  <div className="text-xs font-bold text-white">Show Navigation Arrows</div>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] font-bold text-slate-400">
                      {localConfig.bannerBehavior?.showNavigationArrows !== false ? 'ARROWS ON' : 'ARROWS OFF'}
                    </span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={localConfig.bannerBehavior?.showNavigationArrows !== false}
                        onChange={(e) => handleUpdateBannerBehavior({ showNavigationArrows: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500" />
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 5. ALL 6 PLACEMENT MODELS TAB                             */}
      {/* ========================================================= */}
      {activeTab === 'placements' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
            <div>
              <div className="flex items-center space-x-2">
                <Layout className="w-5 h-5 text-teal-400" />
                <h3 className="text-lg font-black text-white">All 6 Placement Models & Pricing Multipliers</h3>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Configure rate multipliers, 100% Free overrides, or flat fees across all placement options.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {localConfig.placementOptions.map((placement) => (
                <div key={placement.id} className="bg-slate-950/60 border border-slate-800 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-white text-sm">{placement.name}</span>
                      {placement.badge && (
                        <span className="text-[10px] px-2 py-0.5 rounded font-black bg-teal-500/20 text-teal-300 border border-teal-500/30">
                          {placement.badge}
                        </span>
                      )}
                    </div>

                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={placement.isEnabled}
                        onChange={(e) => handleUpdatePlacement(placement.id, { isEnabled: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-10 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500" />
                    </label>
                  </div>

                  <p className="text-xs text-slate-400">{placement.description}</p>

                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800">
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1 font-bold">Pricing Multiplier</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0.5"
                        value={placement.multiplier}
                        onChange={(e) => handleUpdatePlacement(placement.id, { multiplier: parseFloat(e.target.value) || 1 })}
                        className="w-full bg-slate-900 border border-slate-700 text-xs text-white rounded-xl px-3 py-1.5 font-mono focus:outline-none focus:border-teal-500"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1 font-bold">100% Free Override</label>
                      <button
                        type="button"
                        onClick={() => handleUpdatePlacement(placement.id, { isFreeOverride: !placement.isFreeOverride })}
                        className={`w-full py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                          placement.isFreeOverride
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-white'
                        }`}
                      >
                        {placement.isFreeOverride ? 'FREE PLACEMENT' : 'STANDARD FEE'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 6. PROMOTIONAL DISCOUNT BANNERS TAB                      */}
      {/* ========================================================= */}
      {activeTab === 'promo-banners' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <div className="flex items-center space-x-2">
                  <Percent className="w-5 h-5 text-rose-400" />
                  <h3 className="text-lg font-black text-white">Promotional Discount Banners</h3>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Manage active promotional discount headers shown above checkout forms.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsAddPromoOpen(true)}
                className="px-4 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white text-xs font-black shadow-lg shadow-rose-500/20 transition-all cursor-pointer flex items-center space-x-1.5 shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Create Promo Banner</span>
              </button>
            </div>

            <div className="space-y-4">
              {localConfig.promoBanners.map((banner) => (
                <div key={banner.id} className="bg-slate-950/60 border border-slate-800 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-black text-white">{banner.title}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                        {banner.badgeText}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">{banner.description}</p>
                    <div className="text-[10px] text-slate-500 font-mono">
                      Code: <code className="text-rose-400">{banner.promoCode || 'NONE'}</code> • Valid until: {banner.validUntil || 'Indefinite'}
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <button
                      type="button"
                      onClick={() => handleTogglePromoBanner(banner.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                        banner.isEnabled
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                    >
                      {banner.isEnabled ? 'ACTIVE' : 'PAUSED'}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeletePromoBanner(banner.id)}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 7. JOB POSTING FEE OVERRIDE TAB                          */}
      {/* ========================================================= */}
      {activeTab === 'job-fees' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
            <div>
              <div className="flex items-center space-x-2">
                <DollarSign className="w-5 h-5 text-emerald-400" />
                <h3 className="text-lg font-black text-white">Job Posting Fee Override & Free Campaign Policies</h3>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Configure standard employer posting fees, global discounts, or toggle 100% Free posting.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Free All Toggle */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between space-y-4">
                <div>
                  <h4 className="text-xs font-black text-white uppercase tracking-wider">100% Free Job Postings for All</h4>
                  <p className="text-xs text-slate-400 mt-1">Bypass all publishing fees for employers.</p>
                </div>
                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs font-bold text-slate-300">
                    {localConfig.jobPostingFeeSettings?.isFreeAll ? 'FREE POSTINGS ACTIVE' : 'STANDARD FEES ACTIVE'}
                  </span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={localConfig.jobPostingFeeSettings?.isFreeAll || false}
                      onChange={(e) => handleUpdateJobPostingFeeSettings({ isFreeAll: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500" />
                  </label>
                </div>
              </div>

              {/* Standard Fee Input */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-5 space-y-3">
                <h4 className="text-xs font-black text-white uppercase tracking-wider">Standard Job Posting Fee (PKR)</h4>
                <input
                  type="number"
                  min="0"
                  step="50"
                  value={localConfig.jobPostingFeeSettings?.customStandardFeePkr ?? 500}
                  onChange={(e) => handleUpdateJobPostingFeeSettings({ customStandardFeePkr: parseInt(e.target.value) || 0 })}
                  className="w-full bg-slate-900 border border-slate-700 text-xs text-white rounded-xl px-3.5 py-2.5 font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 8. POLICY RULES TAB                                       */}
      {/* ========================================================= */}
      {activeTab === 'rules' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
            <div>
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-5 h-5 text-indigo-400" />
                <h3 className="text-lg font-black text-white">Campaign & Submission Form Policy Rules</h3>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Configure mandatory approval rules and bypass options for advertising submissions.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-white">Require Admin Review & Approval</div>
                  <div className="text-[10px] text-slate-400">All submitted campaigns require manual approval</div>
                </div>
                <input
                  type="checkbox"
                  checked={localConfig.formRules.requireAdminApproval}
                  onChange={(e) => setLocalConfig(prev => ({ ...prev, formRules: { ...prev.formRules, requireAdminApproval: e.target.checked } }))}
                  className="w-4 h-4 text-emerald-500 rounded cursor-pointer"
                />
              </div>

              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-white">Admin 100% Free Bypass</div>
                  <div className="text-[10px] text-slate-400">Admins can create campaigns at 0 PKR</div>
                </div>
                <input
                  type="checkbox"
                  checked={localConfig.formRules.adminFreeCampaignBypass}
                  onChange={(e) => setLocalConfig(prev => ({ ...prev, formRules: { ...prev.formRules, adminFreeCampaignBypass: e.target.checked } }))}
                  className="w-4 h-4 text-emerald-500 rounded cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CREATE PROMO BANNER MODAL */}
      {isAddPromoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-black text-white flex items-center space-x-2">
                <Percent className="w-4 h-4 text-rose-400" />
                <span>Create Promotional Discount Banner</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsAddPromoOpen(false)}
                className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Banner Title</label>
                <input
                  type="text"
                  value={newPromoTitle}
                  onChange={(e) => setNewPromoTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Banner Description</label>
                <input
                  type="text"
                  value={newPromoDesc}
                  onChange={(e) => setNewPromoDesc(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Discount %</label>
                  <input
                    type="number"
                    value={newPromoDiscount}
                    onChange={(e) => setNewPromoDiscount(parseInt(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Promo Code</label>
                  <input
                    type="text"
                    value={newPromoCode}
                    onChange={(e) => setNewPromoCode(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setIsAddPromoOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreatePromoBanner}
                className="px-5 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-white text-xs font-black"
              >
                Add Banner
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
