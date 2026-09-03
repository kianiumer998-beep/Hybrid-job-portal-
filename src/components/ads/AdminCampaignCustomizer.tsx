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
  PromoDiscountBanner,
  JobPostingFeeSettings,
  DEFAULT_CAMPAIGN_CUSTOMIZATION_CONFIG,
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
    promoBanners: config.promoBanners || DEFAULT_CAMPAIGN_CUSTOMIZATION_CONFIG.promoBanners,
    jobPostingFeeSettings: config.jobPostingFeeSettings || DEFAULT_CAMPAIGN_CUSTOMIZATION_CONFIG.jobPostingFeeSettings
  }));

  const [activeTab, setActiveTab] = useState<
    'popup-modes' | 'feed-positioning' | 'placements' | 'promo-banners' | 'job-fees' | 'pages' | 'durations' | 'rules'
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
    setSaveSuccessMessage('All campaign settings, placement rules, and popup modes saved successfully!');
    setTimeout(() => setSaveSuccessMessage(null), 3500);
  };

  // Reset handler
  const handleReset = () => {
    if (window.confirm('Reset all popup queue settings, feed positions, placement rates, and promotional discount banners to platform defaults?')) {
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
  // PLACEMENT OPTION HANDLERS
  // -------------------------------------------------------------
  const handleUpdatePlacement = (placementId: AdPlacement, updates: Partial<CampaignPlacementOption>) => {
    setLocalConfig(prev => ({
      ...prev,
      placementOptions: prev.placementOptions.map(p =>
        p.id === placementId ? { ...p, ...updates } : p
      )
    }));
  };

  // -------------------------------------------------------------
  // PROMO DISCOUNT BANNERS HANDLERS
  // -------------------------------------------------------------
  const handleTogglePromoBanner = (promoId: string) => {
    setLocalConfig(prev => ({
      ...prev,
      promoBanners: prev.promoBanners.map(p =>
        p.id === promoId ? { ...p, isEnabled: !p.isEnabled } : p
      )
    }));
  };

  const handleDeletePromoBanner = (promoId: string) => {
    setLocalConfig(prev => ({
      ...prev,
      promoBanners: prev.promoBanners.filter(p => p.id !== promoId)
    }));
  };

  const handleCreatePromoBanner = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPromoTitle.trim()) return;

    const newBanner: PromoDiscountBanner = {
      id: 'promo-' + Date.now(),
      isEnabled: true,
      title: newPromoTitle.trim(),
      description: newPromoDesc.trim(),
      discountPercent: Number(newPromoDiscount) || 50,
      badgeText: newPromoBadge.trim() || '🔥 SPECIAL OFFER',
      promoCode: newPromoCode.trim() || undefined,
      targetPlacement: newPromoPlacement,
      validUntil: newPromoValidUntil,
      bgGradient: newPromoGradient,
      ctaText: 'Claim Discount Slot',
      ctaUrl: '#dashboard'
    };

    setLocalConfig(prev => ({
      ...prev,
      promoBanners: [newBanner, ...prev.promoBanners]
    }));

    setIsAddPromoOpen(false);
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
            Configure Centered Popup Lightbox queue modes, Job Feed Inline Card frequencies, All 6 Ad Placements, 100% Free overrides, and Promotional Discount Banners.
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
          <button onClick={() => setSaveSuccessMessage(null)} className="text-emerald-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div className="flex flex-wrap gap-2 p-1.5 bg-slate-900/80 border border-slate-800 rounded-2xl">
        {[
          { id: 'popup-modes', label: 'Centered Popup Lightbox', icon: Sparkles, badge: localConfig.popupSettings.displayMode },
          { id: 'feed-positioning', label: 'Job Feed Inline Frequency', icon: Layers, badge: `${localConfig.feedInlineSettings.customIndices.length} slots` },
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
      {/* 1. CENTERED POPUP LIGHTBOX QUEUE & LAYOUTS TAB           */}
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
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black px-2.5 py-1 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase">
                      Recommended
                    </span>
                    <input
                      type="radio"
                      checked={localConfig.popupSettings.displayMode === 'sequential'}
                      onChange={() => handleUpdatePopupSettings({ displayMode: 'sequential' })}
                      className="accent-amber-500"
                    />
                  </div>
                  <h4 className="text-sm font-black text-white">Sequential Queue (1-by-1 On Cross)</h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Shows 1st popup modal first. When visitor clicks <strong className="text-amber-400">X (Close)</strong>, the 2nd popup appears right away, continuing through all active queued sponsor announcements!
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/80 text-[11px] font-bold text-amber-400 flex items-center space-x-1">
                  <Check className="w-3.5 h-3.5" />
                  <span>Unlimited Queue Support</span>
                </div>
              </div>

              {/* Option 2: Stacked Dual Modal (Simultaneous Top & Bottom) */}
              <div
                onClick={() => handleUpdatePopupSettings({ displayMode: 'stacked_dual' })}
                className={`p-5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                  localConfig.popupSettings.displayMode === 'stacked_dual'
                    ? 'bg-indigo-500/10 border-indigo-500 shadow-lg shadow-indigo-500/10'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black px-2.5 py-1 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase">
                      Dual Simultaneous
                    </span>
                    <input
                      type="radio"
                      checked={localConfig.popupSettings.displayMode === 'stacked_dual'}
                      onChange={() => handleUpdatePopupSettings({ displayMode: 'stacked_dual' })}
                      className="accent-indigo-500"
                    />
                  </div>
                  <h4 className="text-sm font-black text-white">Stacked Dual (Top & Bottom on Screen)</h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Shows 2 separate popup announcement cards simultaneously on screen (Top and Bottom or Side-by-Side) so both campaigns gain instant visitor eyeballs at once.
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/80 text-[11px] font-bold text-indigo-300 flex items-center space-x-1">
                  <Check className="w-3.5 h-3.5" />
                  <span>Dual Multi-Sponsor View</span>
                </div>
              </div>

              {/* Option 3: Single High-Priority Modal */}
              <div
                onClick={() => handleUpdatePopupSettings({ displayMode: 'single' })}
                className={`p-5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                  localConfig.popupSettings.displayMode === 'single'
                    ? 'bg-emerald-500/10 border-emerald-500 shadow-lg shadow-emerald-500/10'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black px-2.5 py-1 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase">
                      Single Modal
                    </span>
                    <input
                      type="radio"
                      checked={localConfig.popupSettings.displayMode === 'single'}
                      onChange={() => handleUpdatePopupSettings({ displayMode: 'single' })}
                      className="accent-emerald-500"
                    />
                  </div>
                  <h4 className="text-sm font-black text-white">Single Exclusive Focus Modal</h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Displays only the single highest-priority active popup per session. No subsequent popups appear upon closing.
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/80 text-[11px] font-bold text-emerald-400 flex items-center space-x-1">
                  <Check className="w-3.5 h-3.5" />
                  <span>Exclusive Slot Focus</span>
                </div>
              </div>
            </div>

            {/* Fine-Tuning Sliders & Queue Controls */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-800">
              
              {/* Max Popups Queue Limit */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-300">
                    Maximum Sequential Popups Allowed:
                  </label>
                  <span className="text-xs font-mono font-bold text-amber-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                    {localConfig.popupSettings.allowUnlimitedQueue ? 'Unlimited (All Active)' : `${localConfig.popupSettings.maxPopupsPerVisit} Popups`}
                  </span>
                </div>

                <div className="flex items-center space-x-3">
                  <label className="flex items-center space-x-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={localConfig.popupSettings.allowUnlimitedQueue}
                      onChange={(e) => handleUpdatePopupSettings({ allowUnlimitedQueue: e.target.checked })}
                      className="rounded accent-amber-500"
                    />
                    <span>Allow Unlimited Queue (All active sponsor popups shown in sequence)</span>
                  </label>
                </div>

                {!localConfig.popupSettings.allowUnlimitedQueue && (
                  <div className="pt-2">
                    <input
                      type="range"
                      min="1"
                      max="10"
                      step="1"
                      value={localConfig.popupSettings.maxPopupsPerVisit}
                      onChange={(e) => handleUpdatePopupSettings({ maxPopupsPerVisit: Number(e.target.value) })}
                      className="w-full accent-amber-500"
                    />
                    <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                      <span>1 (Single)</span>
                      <span>2 (Dual)</span>
                      <span>3 (Triple)</span>
                      <span>5</span>
                      <span>10 Max</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Delay between sequential popups */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-300">
                    Delay Between Sequential Popups:
                  </label>
                  <span className="text-xs font-mono font-bold text-teal-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                    {localConfig.popupSettings.delayBetweenPopupsSec} Seconds
                  </span>
                </div>

                <input
                  type="range"
                  min="0.2"
                  max="3.0"
                  step="0.1"
                  value={localConfig.popupSettings.delayBetweenPopupsSec}
                  onChange={(e) => handleUpdatePopupSettings({ delayBetweenPopupsSec: Number(e.target.value) })}
                  className="w-full accent-teal-500"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>0.2s (Instant)</span>
                  <span>0.8s (Smooth)</span>
                  <span>1.5s (Comfortable)</span>
                  <span>3.0s (Relaxed)</span>
                </div>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. JOB FEED INLINE CARD FREQUENCY TAB                     */}
      {/* ========================================================= */}
      {activeTab === 'feed-positioning' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
            <div>
              <div className="flex items-center space-x-2">
                <Layers className="w-5 h-5 text-emerald-400" />
                <h3 className="text-lg font-black text-white">Job Listing Feed Inline Card Frequency</h3>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Control exactly after how many job cards inline sponsored banner cards appear in the feed.
              </p>
            </div>

            {/* Mode Selector */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Cadence Mode (Every N Jobs) */}
              <div
                onClick={() => handleUpdateFeedInlineSettings({ insertionMode: 'cadence' })}
                className={`p-5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                  localConfig.feedInlineSettings.insertionMode === 'cadence'
                    ? 'bg-emerald-500/10 border-emerald-500 shadow-lg shadow-emerald-500/10'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black px-2.5 py-1 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase">
                      Regular Cadence
                    </span>
                    <input
                      type="radio"
                      checked={localConfig.feedInlineSettings.insertionMode === 'cadence'}
                      onChange={() => handleUpdateFeedInlineSettings({ insertionMode: 'cadence' })}
                      className="accent-emerald-500"
                    />
                  </div>
                  <h4 className="text-sm font-black text-white">Repeat Every N Job Cards (e.g. Every 2 or 3 Jobs)</h4>
                  <p className="text-xs text-slate-300">
                    Inserts an inline card predictably across the entire feed (e.g. after card #3, #6, #9, #12...).
                  </p>
                </div>

                {localConfig.feedInlineSettings.insertionMode === 'cadence' && (
                  <div className="mt-4 pt-3 border-t border-slate-800 space-y-2">
                    <label className="text-xs font-bold text-slate-300">Insert Ad After Every:</label>
                    <div className="flex items-center space-x-2">
                      {[2, 3, 4, 5, 6].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUpdateFeedInlineSettings({ repeatEveryNJobs: num });
                          }}
                          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            localConfig.feedInlineSettings.repeatEveryNJobs === num
                              ? 'bg-emerald-500 text-slate-950 font-black shadow-md'
                              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                          }`}
                        >
                          {num} Jobs
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Custom Indices Mode (e.g. After 2nd, 5th, 8th job) */}
              <div
                onClick={() => handleUpdateFeedInlineSettings({ insertionMode: 'custom_indices' })}
                className={`p-5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                  localConfig.feedInlineSettings.insertionMode === 'custom_indices'
                    ? 'bg-amber-500/10 border-amber-500 shadow-lg shadow-amber-500/10'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black px-2.5 py-1 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase">
                      Custom Manual Slots
                    </span>
                    <input
                      type="radio"
                      checked={localConfig.feedInlineSettings.insertionMode === 'custom_indices'}
                      onChange={() => handleUpdateFeedInlineSettings({ insertionMode: 'custom_indices' })}
                      className="accent-amber-500"
                    />
                  </div>
                  <h4 className="text-sm font-black text-white">Manual Selected Positions (e.g. After #2, #5, #8)</h4>
                  <p className="text-xs text-slate-300">
                    Specify exact positions where you want ads placed. Perfect for highlighting top tier slots without clutter.
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] font-bold text-amber-400 flex items-center space-x-1">
                  <Check className="w-3.5 h-3.5" />
                  <span>Precision Slot Control</span>
                </div>
              </div>

            </div>

            {/* Custom Indices List & Quick Adder */}
            {localConfig.feedInlineSettings.insertionMode === 'custom_indices' && (
              <div className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h5 className="text-xs font-black text-white uppercase tracking-wider">Active Manual Insertion Positions:</h5>
                    <p className="text-[11px] text-slate-400">An ad will be placed immediately following each selected job position number.</p>
                  </div>

                  {/* Quick Preset Buttons */}
                  <div className="flex items-center space-x-1.5 text-xs">
                    <span className="text-slate-500 text-[10px] font-semibold">Presets:</span>
                    <button
                      type="button"
                      onClick={() => handleUpdateFeedInlineSettings({ customIndices: [2, 5, 8] })}
                      className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-mono font-bold cursor-pointer"
                    >
                      [2, 5, 8]
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdateFeedInlineSettings({ customIndices: [3, 7, 12] })}
                      className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-mono font-bold cursor-pointer"
                    >
                      [3, 7, 12]
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdateFeedInlineSettings({ customIndices: [1, 4, 8, 12] })}
                      className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-mono font-bold cursor-pointer"
                    >
                      [1, 4, 8, 12]
                    </button>
                  </div>
                </div>

                {/* Chips of Active Indices */}
                <div className="flex flex-wrap gap-2 items-center">
                  {localConfig.feedInlineSettings.customIndices.map((idxNum) => (
                    <div
                      key={idxNum}
                      className="px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-black flex items-center space-x-2"
                    >
                      <span>After Job #{idxNum}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveCustomIndex(idxNum)}
                        className="text-amber-400 hover:text-white cursor-pointer"
                        title="Remove position"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}

                  {/* Add Number Input */}
                  <div className="flex items-center space-x-1.5">
                    <input
                      type="number"
                      min="1"
                      max="30"
                      placeholder="Card #"
                      value={quickIndexInput}
                      onChange={(e) => setQuickIndexInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const val = parseInt(quickIndexInput, 10);
                          if (!isNaN(val)) {
                            handleAddCustomIndex(val);
                            setQuickIndexInput('');
                          }
                        }
                      }}
                      className="w-20 px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const val = parseInt(quickIndexInput, 10);
                        if (!isNaN(val)) {
                          handleAddCustomIndex(val);
                          setQuickIndexInput('');
                        }
                      }}
                      className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black transition-all cursor-pointer"
                    >
                      + Add
                    </button>
                  </div>
                </div>

              </div>
            )}

            {/* General Feed Settings */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-800">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">Max Ads Rendered Per Feed Page:</label>
                <div className="flex items-center space-x-2">
                  {[1, 2, 3, 4, 5].map((count) => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => handleUpdateFeedInlineSettings({ maxAdsPerPage: count })}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        localConfig.feedInlineSettings.maxAdsPerPage === count
                          ? 'bg-indigo-500 text-white font-black'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {count} {count === 1 ? 'Ad' : 'Ads'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">Rotate Multiple Sponsor Ads:</label>
                <label className="flex items-center space-x-2 text-xs text-slate-400 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={localConfig.feedInlineSettings.rotateMultipleAds}
                    onChange={(e) => handleUpdateFeedInlineSettings({ rotateMultipleAds: e.target.checked })}
                    className="rounded accent-emerald-500"
                  />
                  <span>Rotate different active campaigns across positions instead of repeating the same ad</span>
                </label>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. ALL 6 PLACEMENT MODELS FULL MANAGEMENT TAB             */}
      {/* ========================================================= */}
      {activeTab === 'placements' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
            <div>
              <div className="flex items-center space-x-2">
                <Layout className="w-5 h-5 text-indigo-400" />
                <h3 className="text-lg font-black text-white">All 6 Placement Models & Fee Overrides</h3>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Manage all 6 ad formats: Top Sticky Header, Native Job Feed Card, Centered Popup Modal, Floating Toast Alert, Sidebar Filter Widget, and Direct SMS Text Broadcast.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {localConfig.placementOptions.map((placement) => {
                const isFree = !!placement.isFreeOverride;

                return (
                  <div
                    key={placement.id}
                    className={`p-5 rounded-2xl border transition-all flex flex-col justify-between ${
                      placement.isEnabled
                        ? isFree
                          ? 'bg-emerald-950/20 border-emerald-500/40 shadow-emerald-500/5'
                          : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                        : 'bg-slate-950/40 border-slate-800/60 opacity-60'
                    }`}
                  >
                    <div className="space-y-3">
                      
                      {/* Top Header of Card */}
                      <div className="flex items-center justify-between">
                        <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border ${
                          placement.isEnabled ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' : 'bg-slate-800 text-slate-500 border-slate-700'
                        }`}>
                          {placement.type}
                        </span>

                        <div className="flex items-center space-x-2">
                          <label className="text-[11px] font-bold text-slate-400 cursor-pointer flex items-center space-x-1">
                            <span>{placement.isEnabled ? 'Active' : 'Disabled'}</span>
                            <input
                              type="checkbox"
                              checked={placement.isEnabled}
                              onChange={(e) => handleUpdatePlacement(placement.id, { isEnabled: e.target.checked })}
                              className="rounded accent-emerald-500"
                            />
                          </label>
                        </div>
                      </div>

                      <h4 className="text-sm font-black text-white">{placement.name}</h4>
                      <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                        {placement.description}
                      </p>

                      {/* 100% Free Toggle */}
                      <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                        <label className="flex items-center justify-between text-xs cursor-pointer">
                          <span className="font-bold text-slate-300 flex items-center space-x-1">
                            <Percent className="w-3.5 h-3.5 text-emerald-400" />
                            <span>100% Free Placement:</span>
                          </span>
                          <input
                            type="checkbox"
                            checked={isFree}
                            onChange={(e) => handleUpdatePlacement(placement.id, { isFreeOverride: e.target.checked })}
                            className="rounded accent-emerald-500"
                          />
                        </label>
                        {isFree && (
                          <div className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-1 rounded">
                            ✓ Advertisers can book this placement at 0 PKR fee!
                          </div>
                        )}
                      </div>

                      {/* Rate Multiplier / Flat Override */}
                      {!isFree && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-400 font-medium">Pricing Multiplier:</span>
                            <span className="font-mono font-bold text-amber-400">{placement.multiplier}x</span>
                          </div>
                          <input
                            type="range"
                            min="0.5"
                            max="3.0"
                            step="0.1"
                            value={placement.multiplier}
                            onChange={(e) => handleUpdatePlacement(placement.id, { multiplier: Number(e.target.value) })}
                            className="w-full accent-amber-500"
                          />
                        </div>
                      )}

                    </div>

                    {/* Footer concurrent slots */}
                    <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                      <span>Max Concurrent Slots:</span>
                      <span className="font-mono font-bold text-slate-200">
                        {placement.maxConcurrentSlots || 2} Slots
                      </span>
                    </div>

                  </div>
                );
              })}
            </div>

          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 4. PROMOTIONAL DISCOUNT & PERCENTAGE-OFF BANNERS TAB      */}
      {/* ========================================================= */}
      {activeTab === 'promo-banners' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <div className="flex items-center space-x-2">
                  <Percent className="w-5 h-5 text-amber-400" />
                  <h3 className="text-lg font-black text-white">Promotional Discount & Percentage-Off Banners</h3>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Broadcast site-wide flash discounts (e.g. 50% OFF, 100% Free Week) to drive ad campaign bookings.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsAddPromoOpen(true)}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black transition-all cursor-pointer flex items-center space-x-1.5 self-start sm:self-auto"
              >
                <Plus className="w-4 h-4" />
                <span>Create Promo Banner</span>
              </button>
            </div>

            {/* List of Active & Inactive Promo Banners */}
            <div className="space-y-4">
              {localConfig.promoBanners.map((promo) => (
                <div
                  key={promo.id}
                  className={`p-5 rounded-2xl border transition-all ${
                    promo.isEnabled
                      ? 'bg-slate-950/80 border-slate-800 shadow-lg'
                      : 'bg-slate-950/40 border-slate-800/60 opacity-60'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    
                    {/* Left: Info */}
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-gradient-to-r ${promo.bgGradient || 'from-amber-600 to-rose-600'} text-white shadow`}>
                          {promo.badgeText}
                        </span>

                        <span className="text-xs font-bold text-amber-400 font-mono">
                          {promo.discountPercent}% Discount
                        </span>

                        {promo.promoCode && (
                          <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                            Code: {promo.promoCode}
                          </span>
                        )}

                        {promo.validUntil && (
                          <span className="text-[11px] text-slate-500 font-mono">
                            Valid until: {promo.validUntil}
                          </span>
                        )}
                      </div>

                      <h4 className="text-base font-black text-white">{promo.title}</h4>
                      <p className="text-xs text-slate-300">{promo.description}</p>
                    </div>

                    {/* Right: Toggle & Actions */}
                    <div className="flex items-center space-x-3 self-end lg:self-auto">
                      <button
                        type="button"
                        onClick={() => handleTogglePromoBanner(promo.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                          promo.isEnabled
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}
                      >
                        {promo.isEnabled ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                        <span>{promo.isEnabled ? 'Active on Portal' : 'Inactive'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeletePromoBanner(promo.id)}
                        className="p-2 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 transition-all cursor-pointer"
                        title="Delete promo banner"
                      >
                        <Trash2 className="w-4 h-4" />
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
      {/* 5. JOB POSTING FEE OVERRIDE & 1-CLICK FREE TAB            */}
      {/* ========================================================= */}
      {activeTab === 'job-fees' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
            <div>
              <div className="flex items-center space-x-2">
                <DollarSign className="w-5 h-5 text-emerald-400" />
                <h3 className="text-lg font-black text-white">Job Posting Fee Override & Free Publishing</h3>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Make job postings 100% Free for employers or adjust custom fee tiers and global discount rates.
              </p>
            </div>

            {/* 1-Click 100% Free Job Postings Big Switch */}
            <div className={`p-6 rounded-3xl border-2 transition-all ${
              localConfig.jobPostingFeeSettings?.isFreeAll
                ? 'bg-emerald-950/30 border-emerald-500 shadow-xl shadow-emerald-500/10'
                : 'bg-slate-950/80 border-slate-800'
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-black text-xs border border-emerald-500/30">
                      ⚡ 1-Click Master Control
                    </span>
                  </div>
                  <h4 className="text-base font-black text-white">Make All Job Postings 100% Free (0 PKR)</h4>
                  <p className="text-xs text-slate-300 max-w-xl">
                    When enabled, all employers can publish unlimited verified job openings completely free with zero invoice barriers.
                  </p>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={localConfig.jobPostingFeeSettings?.isFreeAll || false}
                    onChange={(e) => handleUpdateJobPostingFeeSettings({ isFreeAll: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-14 h-8 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-emerald-500"></div>
                </label>
              </div>
            </div>

            {/* Custom Standard Rate & Discount Sliders */}
            {!localConfig.jobPostingFeeSettings?.isFreeAll && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-800">
                
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-300">
                    Standard Job Posting Base Fee (PKR):
                  </label>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-bold text-slate-500">PKR</span>
                    <input
                      type="number"
                      min="0"
                      step="50"
                      value={localConfig.jobPostingFeeSettings?.customStandardFeePkr || 500}
                      onChange={(e) => handleUpdateJobPostingFeeSettings({ customStandardFeePkr: Number(e.target.value) })}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm font-bold text-white font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-300">
                      Global Job Posting Discount:
                    </label>
                    <span className="text-xs font-mono font-bold text-emerald-400">
                      {localConfig.jobPostingFeeSettings?.globalDiscountPercent || 0}% OFF
                    </span>
                  </div>

                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={localConfig.jobPostingFeeSettings?.globalDiscountPercent || 0}
                    onChange={(e) => handleUpdateJobPostingFeeSettings({ globalDiscountPercent: Number(e.target.value) })}
                    className="w-full accent-emerald-500"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                    <span>0% (Standard)</span>
                    <span>25%</span>
                    <span>50% (Half Price)</span>
                    <span>100% (Free)</span>
                  </div>
                </div>

              </div>
            )}

          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 6. POLICY RULES TAB                                       */}
      {/* ========================================================= */}
      {activeTab === 'rules' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
          <div>
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-5 h-5 text-teal-400" />
              <h3 className="text-lg font-black text-white">Campaign Submission Policies</h3>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Global requirements and verification policies enforced on user submitted campaigns.
            </p>
          </div>

          <div className="space-y-3">
            {[
              {
                id: 'requireAdminApproval',
                label: 'Require Admin Approval Before Publishing',
                desc: 'User campaigns enter pending queue until an admin approves creative & payment.'
              },
              {
                id: 'allowCustomDateRange',
                label: 'Allow Flexible Date Range Booking',
                desc: 'Let advertisers select exact start and end calendar dates for their campaign.'
              },
              {
                id: 'adminFreeCampaignBypass',
                label: 'Admin Manual Campaigns Exempt From Fees (100% Free Admin Ads)',
                desc: 'Allows portal admins to create and publish official announcements with 0 cost.'
              },
              {
                id: 'requireImage',
                label: 'Require Creative Image / Banner Graphic',
                desc: 'Enforce mandatory banner graphic upload for all visual placements.'
              }
            ].map((rule) => {
              const isChecked = !!(localConfig.formRules as any)[rule.id];
              return (
                <div
                  key={rule.id}
                  className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-start justify-between gap-4"
                >
                  <div className="space-y-1">
                    <h5 className="text-xs font-bold text-white">{rule.label}</h5>
                    <p className="text-[11px] text-slate-400">{rule.desc}</p>
                  </div>

                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={(e) => {
                      setLocalConfig(prev => ({
                        ...prev,
                        formRules: {
                          ...prev.formRules,
                          [rule.id]: e.target.checked
                        }
                      }));
                    }}
                    className="mt-1 rounded accent-emerald-500"
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: CREATE PROMOTIONAL DISCOUNT BANNER                 */}
      {/* ========================================================= */}
      {isAddPromoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Percent className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-black text-white">Create Promotional Discount Banner</h3>
              </div>
              <button onClick={() => setIsAddPromoOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePromoBanner} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">Banner Headline Title:</label>
                <input
                  type="text"
                  required
                  value={newPromoTitle}
                  onChange={(e) => setNewPromoTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">Description Subtitle:</label>
                <textarea
                  rows={2}
                  value={newPromoDesc}
                  onChange={(e) => setNewPromoDesc(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300">Discount %:</label>
                  <input
                    type="number"
                    min="5"
                    max="100"
                    value={newPromoDiscount}
                    onChange={(e) => setNewPromoDiscount(Number(e.target.value))}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300">Promo Code:</label>
                  <input
                    type="text"
                    value={newPromoCode}
                    onChange={(e) => setNewPromoCode(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">Badge Text:</label>
                <input
                  type="text"
                  value={newPromoBadge}
                  onChange={(e) => setNewPromoBadge(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddPromoOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black shadow-lg shadow-amber-500/20"
                >
                  Publish Promo Banner
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
