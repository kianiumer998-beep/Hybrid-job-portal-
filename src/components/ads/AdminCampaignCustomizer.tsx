import React, { useEffect, useState } from 'react';
import { 
  CampaignCustomizationConfig, 
  CampaignPlacementOption, 
  AdPlacement,
  PopupDisplaySettings,
  FeedInlineAdSettings,
  BannerDimensionSettings,
  BannerAppearanceSettings,
  BannerBehaviorSettings,
  PopupAppearanceSettings,
  FeedCardAppearanceSettings,
  DEFAULT_CAMPAIGN_CUSTOMIZATION_CONFIG,
  DEFAULT_BANNER_DIMENSIONS,
  DEFAULT_BANNER_APPEARANCE,
  DEFAULT_BANNER_BEHAVIOR,
  DEFAULT_POPUP_APPEARANCE,
  DEFAULT_FEED_CARD_APPEARANCE
} from '../../types/ad';
import { 
  Sliders, 
  Plus, 
  X, 
  Sparkles, 
  ShieldCheck, 
  Layers, 
  Save, 
  RefreshCw,
  Eye,
  CheckCircle2,
  Radio,
  Smartphone,
  Layout
} from 'lucide-react';

import { CompactAccordion } from '../admin/CompactAccordion';

interface AdminCampaignCustomizerProps {
  config?: CampaignCustomizationConfig;
  onSaveConfig: (updatedConfig: CampaignCustomizationConfig) => void | Promise<unknown>;
  onResetDefaults?: () => void;
  compactMode?: boolean;
}

const buildNormalizedConfig = (config: CampaignCustomizationConfig): CampaignCustomizationConfig => ({
  ...DEFAULT_CAMPAIGN_CUSTOMIZATION_CONFIG,
  ...config,
  popupSettings: config.popupSettings || DEFAULT_CAMPAIGN_CUSTOMIZATION_CONFIG.popupSettings,
  feedInlineSettings: { ...DEFAULT_CAMPAIGN_CUSTOMIZATION_CONFIG.feedInlineSettings, ...(config.feedInlineSettings || {}) },
  bannerDimensions: config.bannerDimensions || DEFAULT_BANNER_DIMENSIONS,
  bannerAppearance: config.bannerAppearance || DEFAULT_CAMPAIGN_CUSTOMIZATION_CONFIG.bannerAppearance,
  bannerBehavior: config.bannerBehavior || DEFAULT_CAMPAIGN_CUSTOMIZATION_CONFIG.bannerBehavior,
  popupAppearance: config.popupAppearance || DEFAULT_POPUP_APPEARANCE,
  feedCardAppearance: config.feedCardAppearance || DEFAULT_FEED_CARD_APPEARANCE,
  promoBanners: config.promoBanners || DEFAULT_CAMPAIGN_CUSTOMIZATION_CONFIG.promoBanners,
  jobPostingFeeSettings: config.jobPostingFeeSettings || DEFAULT_CAMPAIGN_CUSTOMIZATION_CONFIG.jobPostingFeeSettings
});

export const AdminCampaignCustomizer: React.FC<AdminCampaignCustomizerProps> = ({
  config = DEFAULT_CAMPAIGN_CUSTOMIZATION_CONFIG,
  onSaveConfig,
  onResetDefaults,
  compactMode = false
}) => {
  const [localConfig, setLocalConfig] = useState<CampaignCustomizationConfig>(() => buildNormalizedConfig(config));

  useEffect(() => {
    setLocalConfig(buildNormalizedConfig(config));
  }, [config]);

  const [activeTab, setActiveTab] = useState<
    'popup-modes' | 'feed-positioning' | 'banner-dimensions' | 'banner-appearance' | 'placements' | 'rules'
  >('popup-modes');

  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Custom Index Quick Adder State
  const [quickIndexInput, setQuickIndexInput] = useState<string>('');

  // Show success only after the parent confirms the authoritative save.
  const handleSave = async () => {
    setIsSaving(true);
    setSaveErrorMessage(null);
    setSaveSuccessMessage(null);
    try {
      await onSaveConfig(localConfig);
      setSaveSuccessMessage('Campaign settings saved to the database.');
      setTimeout(() => setSaveSuccessMessage(null), 3500);
    } catch (error: any) {
      console.error('[AdminCampaignCustomizer] Save failed:', error);
      setSaveErrorMessage(error?.message || 'Campaign settings could not be saved. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Reset only reports success after the authoritative save succeeds.
  const handleReset = async () => {
    if (!window.confirm('Reset all campaign settings to platform defaults?')) return;

    const previousConfig = localConfig;
    setIsSaving(true);
    setSaveErrorMessage(null);
    setSaveSuccessMessage(null);
    setLocalConfig(DEFAULT_CAMPAIGN_CUSTOMIZATION_CONFIG);
    try {
      await onSaveConfig(DEFAULT_CAMPAIGN_CUSTOMIZATION_CONFIG);
      if (onResetDefaults) onResetDefaults();
      setSaveSuccessMessage('Campaign settings reset to platform defaults.');
      setTimeout(() => setSaveSuccessMessage(null), 3000);
    } catch (error: any) {
      setLocalConfig(previousConfig);
      console.error('[AdminCampaignCustomizer] Reset failed:', error);
      setSaveErrorMessage(error?.message || 'Campaign settings could not be reset. Please try again.');
    } finally {
      setIsSaving(false);
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
  // PLACEMENT OPTION HANDLERS
  // -------------------------------------------------------------
  const handleUpdatePlacement = (id: AdPlacement, updates: Partial<CampaignPlacementOption>) => {
    setLocalConfig(prev => ({
      ...prev,
      placementOptions: prev.placementOptions.map(p => p.id === id ? { ...p, ...updates } : p)
    }));
  };

  return (
    <div className={compactMode ? 'space-y-3 overflow-x-hidden' : 'space-y-6'}>
      {/* Top Header Card */}
      {compactMode ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="min-w-0">
            <h3 className="text-sm sm:text-base font-black text-white">
              Ad Display, Popups, Feed &amp; Placement Rules
            </h3>
            <p className="text-[11px] text-slate-400">
              Select an area below to configure popup queues, feed inline ads, banner sizing, placement availability, or approval policy.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleReset}
              disabled={isSaving}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold border border-slate-700 flex items-center gap-1 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Saving...' : 'Save All'}</span>
            </button>
          </div>
        </div>
      ) : (
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-2 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30">
              <Sliders className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-black text-white">Campaign & Placement Engine</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Configure popup queue behavior, inline ad feed frequency, banner dimensions & rotation, placement availability & slot caps, and campaign submission rules. Top promo banners are edited in Display & Landing Design.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleReset}
            disabled={isSaving}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 disabled:opacity-50 disabled:cursor-wait"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 text-xs font-black shadow-lg shadow-emerald-500/20 transition-all cursor-pointer flex items-center space-x-1.5 active:scale-95 disabled:opacity-50 disabled:cursor-wait"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Saving...' : 'Save All Configurations'}</span>
          </button>
        </div>
      </div>
      )}

      {/* Save Success Alert Banner */}
      {saveSuccessMessage && (
        <div className="p-3 sm:p-4 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center justify-between animate-fadeIn">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{saveSuccessMessage}</span>
          </div>
        </div>
      )}

      {saveErrorMessage && (
        <div role="alert" className="p-3 sm:p-4 rounded-xl bg-rose-500/10 border border-rose-500/40 text-rose-300 text-xs font-bold">
          {saveErrorMessage}
        </div>
      )}

      {/* Navigation Area Selector */}
      {compactMode ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-3 space-y-2.5">
          <label className="text-[11px] font-bold text-slate-300 flex flex-col sm:flex-row sm:items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 shrink-0">Rule Area:</span>
            <select
              aria-label="Ad display rule area"
              value={activeTab}
              onChange={(e) => setActiveTab(e.target.value as any)}
              className="w-full sm:max-w-sm rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-bold text-white"
            >
              <option value="popup-modes">1. Centered Popup Lightbox ({localConfig.popupSettings.displayMode})</option>
              <option value="feed-positioning">2. Feed Ad Frequency &amp; Card Style</option>
              <option value="banner-dimensions">3. Banner Dimensions (Desktop &amp; Mobile)</option>
              <option value="banner-appearance">4. Banner Styling &amp; Rotation</option>
              <option value="placements">5. All 8 Placements &amp; Slot Caps ({localConfig.placementOptions.filter(p => p.isEnabled).length}/8 On)</option>
              <option value="rules">6. Campaign Approval &amp; Bypass Policy Rules</option>
            </select>
          </label>
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: 'popup-modes', label: 'Popups' },
              { id: 'feed-positioning', label: 'Feed Ads' },
              { id: 'banner-dimensions', label: 'Banner Sizes' },
              { id: 'banner-appearance', label: 'Banner Styling' },
              { id: 'placements', label: '8 Placements' },
              { id: 'rules', label: 'Policy Rules' }
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-colors ${
                  activeTab === tab.id
                    ? 'bg-emerald-500 text-slate-950 font-black'
                    : 'bg-slate-950 text-slate-300 border border-slate-800 hover:border-slate-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
      <div className="flex flex-nowrap gap-2 p-1.5 bg-slate-900/80 border border-slate-800 rounded-2xl overflow-x-auto overscroll-x-contain touch-pan-x max-w-full">
        {[
          { id: 'popup-modes', label: 'Centered Popup Lightbox', icon: Sparkles, badge: localConfig.popupSettings.displayMode },
          { id: 'feed-positioning', label: 'Feed Ad Frequency', icon: Layers, badge: (localConfig.feedInlineSettings.maxAdsPerPage ?? 3) === 0 ? 'Ads Off' : localConfig.feedInlineSettings.insertionMode === 'cadence' ? `Every ${localConfig.feedInlineSettings.repeatEveryNJobs || 3}` : `${(localConfig.feedInlineSettings.customIndices || []).length} slots` },
          { id: 'banner-dimensions', label: 'Banner Dimensions', icon: Sliders, badge: 'Custom Sizes' },
          { id: 'banner-appearance', label: 'Banner Styling & Rotation', icon: Eye, badge: 'Appearance' },
          { id: 'placements', label: 'All 8 Placements & Slots', icon: Layout, badge: `${localConfig.placementOptions.filter(p => p.isEnabled).length}/8 On` },
          { id: 'rules', label: 'Policy Rules', icon: ShieldCheck }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 sm:px-4 py-2.5 rounded-xl text-xs font-bold flex items-center space-x-2 transition-all cursor-pointer shrink-0 whitespace-nowrap ${
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
      )}

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

            {localConfig.popupSettings.displayMode === 'sequential' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-800/80">
                <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-2">
                  <label className="text-xs font-bold text-slate-300 block">Delay Between Sequential Popups (sec)</label>
                  <input
                    type="number"
                    min="0"
                    max="15"
                    step="0.2"
                    value={localConfig.popupSettings.delayBetweenPopupsSec ?? 0.8}
                    onChange={(e) => handleUpdatePopupSettings({ delayBetweenPopupsSec: Math.max(0, Number(e.target.value) || 0) })}
                    className="w-full bg-slate-900 border border-slate-700 text-xs text-white rounded-xl px-3 py-2 font-mono font-bold focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-2">
                  <label className="text-xs font-bold text-slate-300 block">Max Queued Popups Per Visit</label>
                  <select
                    value={localConfig.popupSettings.maxPopupsPerVisit ?? 3}
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

            {localConfig.popupSettings.displayMode === 'stacked_dual' && (
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 flex items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-bold text-white">Show Stacked Dual Grid on Desktop</div>
                  <div className="text-[11px] text-slate-400">Render top 2 popup ads side-by-side on wide screens instead of collapsing into single view.</div>
                </div>
                <input
                  type="checkbox"
                  checked={localConfig.popupSettings.showStackedDualOnDesktop !== false}
                  onChange={(e) => handleUpdatePopupSettings({ showStackedDualOnDesktop: e.target.checked })}
                  className="h-4 w-4 accent-amber-500 cursor-pointer"
                />
              </div>
            )}

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
                Set the standard job count and control exactly where sponsored cards appear. Priority jobs stay above this feed and do not reduce its job limit.
              </p>
            </div>

            {/* Shared Public Feed Pagination vs Ad Injection Master Switch */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-2">
                <label className="block text-xs font-bold text-slate-200">Public Jobs Feed Pagination (Shared Default)</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  step="1"
                  value={localConfig.feedInlineSettings.standardJobsPerPage ?? 10}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    if (Number.isInteger(value) && value >= 1 && value <= 100) {
                      handleUpdateFeedInlineSettings({ standardJobsPerPage: value });
                    }
                  }}
                  className="w-full bg-slate-900 border border-slate-700 text-sm text-white rounded-xl px-3 py-2 font-bold focus:outline-none focus:border-emerald-500"
                />
                <p className="text-[10px] text-slate-400">Default standard jobs per page before visitors change it (1–100). Synced with Display &amp; Landing Design → Section Sequence &amp; Ordering.</p>
              </div>
              <div className="bg-slate-950/60 border border-emerald-500/30 rounded-2xl p-4 space-y-2">
                <label className="block text-xs font-bold text-slate-200">Maximum Inline Ads Per Page</label>
                <select
                  value={localConfig.feedInlineSettings.maxAdsPerPage ?? 3}
                  onChange={(e) => handleUpdateFeedInlineSettings({ maxAdsPerPage: Number(e.target.value) })}
                  className="w-full bg-slate-900 border border-slate-700 text-sm text-white rounded-xl px-3 py-2 font-bold focus:outline-none focus:border-emerald-500"
                >
                  {[0, 1, 2, 3, 4, 5, 6, 8, 10].map((value) => <option key={value} value={value}>{value === 0 ? '0 — Disable inline feed ads' : `${value} inline ads max`}</option>)}
                </select>
                <p className="text-[10px] text-slate-400">Set to 0 to disable all inline sponsored cards in the jobs feed.</p>
              </div>
            </div>

            {(localConfig.feedInlineSettings.maxAdsPerPage ?? 3) > 0 ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-2">
                    <label className="block text-xs font-bold text-slate-200">Ad Insertion Mode</label>
                    <select
                      value={localConfig.feedInlineSettings.insertionMode || 'custom_indices'}
                      onChange={(e) => handleUpdateFeedInlineSettings({ insertionMode: e.target.value as FeedInlineAdSettings['insertionMode'] })}
                      className="w-full bg-slate-900 border border-slate-700 text-sm text-white rounded-xl px-3 py-2 font-bold focus:outline-none focus:border-emerald-500"
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
                        checked={localConfig.feedInlineSettings.rotateMultipleAds !== false}
                        onChange={(e) => handleUpdateFeedInlineSettings({ rotateMultipleAds: e.target.checked })}
                        className="h-4 w-4 accent-emerald-500"
                      />
                      Rotate ads between available active campaigns
                    </label>
                    <p className="text-[10px] text-slate-500">Off = repeat the first eligible active ad.</p>
                  </div>
                </div>

                {localConfig.feedInlineSettings.insertionMode === 'cadence' ? (
                  <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-2 max-w-sm">
                    <label className="block text-xs font-bold text-slate-300">Insert Ad After Every (N Jobs)</label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      step="1"
                      value={localConfig.feedInlineSettings.repeatEveryNJobs || 3}
                      onChange={(e) => {
                        const value = Number(e.target.value);
                        if (Number.isInteger(value) && value >= 1 && value <= 100) handleUpdateFeedInlineSettings({ repeatEveryNJobs: value });
                      }}
                      className="w-full bg-slate-900 border border-slate-700 text-sm text-white rounded-xl px-3 py-2 font-bold"
                    />
                    <p className="text-[10px] text-slate-500">Example: 3 = after standard jobs 3, 6, 9...</p>
                  </div>
                ) : (
                  <div className="space-y-4">
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

                    <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-2">
                      <label className="block text-xs font-bold text-slate-300">Page 1 Special Ad Positions (Optional)</label>
                      <input
                        type="text"
                        value={(localConfig.feedInlineSettings.page1SpecificIndices || []).join(', ')}
                        onChange={(e) => {
                          const values = Array.from(new Set(e.target.value.split(',').map((part) => Number(part.trim())).filter((value) => Number.isInteger(value) && value >= 1 && value <= 100))).sort((a, b) => a - b);
                          handleUpdateFeedInlineSettings({ page1SpecificIndices: values });
                        }}
                        placeholder="Example: 2, 5, 8"
                        className="w-full bg-slate-900 border border-slate-700 text-xs text-white rounded-xl px-3 py-2 font-mono"
                      />
                      <p className="text-[10px] text-slate-500">Optional page 1 override. Leave empty to use the general custom positions.</p>
                    </div>
                  </div>
                )}

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
              </>
            ) : (
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 text-xs text-slate-400">
                Inline feed ads are currently disabled (Maximum Inline Ads = 0). Increase the limit above to configure insertion mode, slot positions, and inline card styling.
              </div>
            )}
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

            {/* Additional Styling & Alignment Selectors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-slate-800/80">
              {/* Padding Preset */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-2">
                <label className="text-xs font-bold text-slate-300 block">Banner Padding</label>
                <select
                  value={localConfig.bannerAppearance?.paddingPreset || 'standard'}
                  onChange={(e) => handleUpdateBannerAppearance({ paddingPreset: e.target.value as any })}
                  className="w-full bg-slate-900 border border-slate-700 text-xs text-white rounded-xl px-3 py-2 font-bold focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="compact">Compact Padding</option>
                  <option value="standard">Standard Padding (Default)</option>
                  <option value="spacious">Spacious Padding</option>
                </select>
              </div>

              {/* Image Position (shown only when banner image is enabled) */}
              {localConfig.bannerAppearance?.showBannerImage !== false && (
                <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-2">
                  <label className="text-xs font-bold text-slate-300 block">Image Position</label>
                  <select
                    value={localConfig.bannerAppearance?.imagePosition || 'left'}
                    onChange={(e) => handleUpdateBannerAppearance({ imagePosition: e.target.value as any })}
                    className="w-full bg-slate-900 border border-slate-700 text-xs text-white rounded-xl px-3 py-2 font-bold focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="left">Left Side (Default)</option>
                    <option value="right">Right Side</option>
                    <option value="top">Top Stacked</option>
                  </select>
                </div>
              )}

              {/* Text Alignment */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-2">
                <label className="text-xs font-bold text-slate-300 block">Text Alignment</label>
                <select
                  value={localConfig.bannerAppearance?.textAlignment || 'left'}
                  onChange={(e) => handleUpdateBannerAppearance({ textAlignment: e.target.value as any })}
                  className="w-full bg-slate-900 border border-slate-700 text-xs text-white rounded-xl px-3 py-2 font-bold focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="left">Left Aligned (Default)</option>
                  <option value="center">Center Aligned</option>
                  <option value="right">Right Aligned</option>
                </select>
              </div>

              {/* CTA Alignment (shown only when CTA button is enabled) */}
              {localConfig.bannerAppearance?.showCtaButton !== false && (
                <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-2">
                  <label className="text-xs font-bold text-slate-300 block">CTA Button Alignment</label>
                  <select
                    value={localConfig.bannerAppearance?.ctaAlignment || 'right'}
                    onChange={(e) => handleUpdateBannerAppearance({ ctaAlignment: e.target.value as any })}
                    className="w-full bg-slate-900 border border-slate-700 text-xs text-white rounded-xl px-3 py-2 font-bold focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="right">Right Aligned (Default)</option>
                    <option value="center">Center Aligned</option>
                    <option value="left">Left Aligned</option>
                  </select>
                </div>
              )}
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

                {/* Rotation Interval & Pause on Hover shown only when autoRotate is ON */}
                {localConfig.bannerBehavior?.autoRotate !== false && (
                  <>
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
                  </>
                )}

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
      {/* 5. ALL 8 PLACEMENT MODELS TAB                             */}
      {/* ========================================================= */}
      {activeTab === 'placements' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
            <div>
              <div className="flex items-center space-x-2">
                <Layout className="w-5 h-5 text-teal-400" />
                <h3 className="text-lg font-black text-white">All 8 Placement Availability, Free Overrides & Slot Limits</h3>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Enable or disable each placement slot, toggle 100% Free overrides, and set concurrent slot limits. Pricing multipliers and rates are configured in <strong>Rate Card & Pricing Matrix</strong>.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              {localConfig.placementOptions.map((placement, idx) =>
                compactMode ? (
                  <CompactAccordion
                    key={placement.id}
                    title={placement.name}
                    subtitle={placement.description}
                    badgeText={placement.isEnabled ? (placement.isFreeOverride ? 'Enabled · Free' : 'Enabled · Standard Fee') : 'Disabled'}
                    badgeTone={!placement.isEnabled ? 'slate' : placement.isFreeOverride ? 'emerald' : 'indigo'}
                    defaultOpen={idx < 2}
                    headerRight={
                      <select
                        aria-label={`${placement.name} status`}
                        value={placement.isEnabled ? 'enabled' : 'disabled'}
                        onChange={(e) => handleUpdatePlacement(placement.id, { isEnabled: e.target.value === 'enabled' })}
                        className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] font-bold text-white"
                      >
                        <option value="enabled">Enabled</option>
                        <option value="disabled">Disabled</option>
                      </select>
                    }
                  >
                    {!placement.isEnabled ? (
                      <div className="text-[11px] text-slate-400">
                        Placement disabled — hidden from campaign booking (saved settings preserved).
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <label className="space-y-1 text-[10px] text-slate-400 font-bold">
                          <span>Fee Mode ({Number(placement.multiplier || 1).toFixed(2)}x Rate Card)</span>
                          <select
                            aria-label={`${placement.name} fee mode`}
                            value={placement.isFreeOverride ? 'free' : 'paid'}
                            onChange={(e) => handleUpdatePlacement(placement.id, { isFreeOverride: e.target.value === 'free' })}
                            className="w-full bg-slate-950 border border-slate-700 text-xs text-white rounded-lg px-2.5 py-1.5 font-bold"
                          >
                            <option value="paid">Standard Fee</option>
                            <option value="free">Free Placement (100% Off)</option>
                          </select>
                        </label>
                        <label className="space-y-1 text-[10px] text-slate-400 font-bold">
                          <span>Max Concurrent Slots</span>
                          <input
                            type="number"
                            min="1"
                            max="50"
                            step="1"
                            value={placement.maxConcurrentSlots ?? ''}
                            placeholder={placement.id === 'promo-discount-banner' || placement.id === 'dynamic-announcement-card' ? 'Required (1–50)' : 'No limit'}
                            onChange={(e) => {
                              const raw = e.target.value;
                              const requiresSlots = placement.id === 'promo-discount-banner' || placement.id === 'dynamic-announcement-card';
                              const parsed = raw === '' ? (requiresSlots ? 1 : undefined) : Number(raw);
                              handleUpdatePlacement(placement.id, { maxConcurrentSlots: parsed === undefined ? undefined : Math.min(50, Math.max(1, Math.floor(parsed))) });
                            }}
                            className="w-full bg-slate-950 border border-slate-700 text-xs text-white rounded-lg px-2.5 py-1.5 font-mono"
                          />
                        </label>
                      </div>
                    )}
                  </CompactAccordion>
                ) : (
                  <div key={placement.id} className={`bg-slate-950/60 border rounded-2xl p-5 space-y-3 transition-all ${placement.isEnabled ? 'border-slate-800' : 'border-slate-800/50 opacity-75'}`}>
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

                    {placement.isEnabled ? (
                      <>
                        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800">
                          <div>
                            <label className="text-[10px] text-slate-400 block mb-1 font-bold">Rate Multiplier</label>
                            <div className="w-full bg-slate-900/70 border border-slate-800 text-[11px] text-slate-300 rounded-xl px-3 py-1.5 font-medium">
                              Managed in Rate Card ({Number(placement.multiplier || 1).toFixed(2)}x)
                            </div>
                          </div>

                          <div>
                            <label className="text-[10px] text-slate-400 block mb-1 font-bold">100% Free Override</label>
                            <button
                              type="button"
                              onClick={() => handleUpdatePlacement(placement.id, { isFreeOverride: !placement.isFreeOverride })}
                              className={`w-full py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                                placement.isFreeOverride
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                  : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-white'
                              }`}
                            >
                              {placement.isFreeOverride ? 'FREE PLACEMENT' : 'STANDARD FEE'}
                            </button>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 gap-3 pt-2 border-t border-slate-800">
                          <div>
                            <label className="text-[10px] text-slate-400 block mb-1 font-bold">Maximum Concurrent Slots</label>
                            <input
                              type="number"
                              min="1"
                              max="50"
                              step="1"
                              value={placement.maxConcurrentSlots ?? ''}
                              placeholder={placement.id === 'promo-discount-banner' || placement.id === 'dynamic-announcement-card' ? 'Required (1–50)' : 'No limit'}
                              onChange={(e) => {
                                const raw = e.target.value;
                                const requiresSlots = placement.id === 'promo-discount-banner' || placement.id === 'dynamic-announcement-card';
                                const parsed = raw === '' ? (requiresSlots ? 1 : undefined) : Number(raw);
                                handleUpdatePlacement(placement.id, { maxConcurrentSlots: parsed === undefined ? undefined : Math.min(50, Math.max(1, Math.floor(parsed))) });
                              }}
                              className="w-full bg-slate-900 border border-slate-700 text-xs text-white rounded-xl px-3 py-1.5 font-mono focus:outline-none focus:border-teal-500"
                            />
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="pt-2 border-t border-slate-800/70 text-[11px] text-slate-500">
                        Placement disabled — hidden from campaign booking. Enable above to configure free override and concurrent slots.
                      </div>
                    )}
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 6. POLICY RULES TAB                                       */}
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

            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400">
              Top Sticky Promo Discount Banners are managed in <strong>Ads &amp; Campaigns → Display &amp; Landing Design → Top Promo Discount Banners</strong>, and employer job posting fees are managed in <strong>Jobs Management → Job Rates &amp; Fees</strong>.
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
