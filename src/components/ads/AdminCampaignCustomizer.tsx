import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  Plus,
  RotateCcw,
  Save,
  Sparkles,
  Tag,
  Trash2
} from 'lucide-react';
import {
  CampaignCustomizationConfig,
  DEFAULT_CAMPAIGN_CUSTOMIZATION_CONFIG,
  DEFAULT_PROMO_BANNERS,
  DEFAULT_AD_OPPORTUNITY_DISPLAY_CONFIG,
  PromoDiscountBanner
} from '../../types/ad';

interface AdminCampaignCustomizerProps {
  config?: CampaignCustomizationConfig;
  onSaveConfig: (updatedConfig: CampaignCustomizationConfig) => void | Promise<unknown>;
  onResetDefaults?: () => void;
  compactMode?: boolean;
}

const GRADIENT_PRESETS = [
  { label: 'Amber → Rose → Indigo', value: 'from-amber-600 via-rose-600 to-indigo-700' },
  { label: 'Emerald → Teal → Cyan', value: 'from-emerald-600 via-teal-600 to-cyan-700' },
  { label: 'Purple → Rose → Amber', value: 'from-purple-600 via-rose-600 to-amber-600' },
  { label: 'Indigo → Purple → Pink', value: 'from-indigo-600 via-purple-600 to-pink-700' },
  { label: 'Sky → Blue → Indigo', value: 'from-sky-600 via-blue-600 to-indigo-700' }
];

const buildMergedConfig = (cfg?: CampaignCustomizationConfig): CampaignCustomizationConfig => ({
  ...DEFAULT_CAMPAIGN_CUSTOMIZATION_CONFIG,
  ...(cfg || {}),
  adOpportunityDisplay: {
    ...DEFAULT_AD_OPPORTUNITY_DISPLAY_CONFIG, ...(cfg?.adOpportunityDisplay || {}),
    jobTiers: { ...DEFAULT_AD_OPPORTUNITY_DISPLAY_CONFIG.jobTiers, ...(cfg?.adOpportunityDisplay?.jobTiers || {}) },
    adPlacements: { ...(cfg?.adOpportunityDisplay?.adPlacements || {}) }
  },
  promoBanners: Array.isArray(cfg?.promoBanners)
    ? cfg!.promoBanners
    : [...DEFAULT_PROMO_BANNERS]
});

export const AdminCampaignCustomizer: React.FC<AdminCampaignCustomizerProps> = ({
  config,
  onSaveConfig,
  onResetDefaults
}) => {
  const [localConfig, setLocalConfig] = useState<CampaignCustomizationConfig>(() =>
    buildMergedConfig(config)
  );
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState('');
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    setLocalConfig(buildMergedConfig(config));
  }, [config]);

  const promoBanners: PromoDiscountBanner[] = Array.isArray(localConfig.promoBanners)
    ? localConfig.promoBanners
    : [];

  const handleUpdatePromo = (id: string, updates: Partial<PromoDiscountBanner>) => {
    setSaveSuccess('');
    setSaveError('');
    setLocalConfig((prev) => ({
      ...prev,
      promoBanners: (prev.promoBanners || []).map((b) =>
        b.id === id ? { ...b, ...updates } : b
      )
    }));
  };

  const handleAddPromoBanner = () => {
    setSaveSuccess('');
    setSaveError('');
    const defaultExpiry = new Date();
    defaultExpiry.setDate(defaultExpiry.getDate() + 30);
    const validUntil = `${defaultExpiry.getFullYear()}-${String(defaultExpiry.getMonth() + 1).padStart(2, '0')}-${String(defaultExpiry.getDate()).padStart(2, '0')}`;

    const newBanner: PromoDiscountBanner = {
      id: `promo-custom-${Date.now()}`,
      isEnabled: true,
      title: 'Limited-Time Sponsored Campaign Discount',
      description: 'Save on featured placements across top jobs, alerts, and landing pages.',
      discountPercent: 25,
      badgeText: '🔥 25% OFF PROMO',
      promoCode: 'SAVE25',
      targetPlacement: 'all',
      validUntil,
      bgGradient: 'from-amber-600 via-rose-600 to-indigo-700',
      ctaText: 'Claim Offer',
      ctaUrl: '#dashboard'
    };

    setLocalConfig((prev) => ({
      ...prev,
      promoBanners: [newBanner, ...(prev.promoBanners || [])]
    }));
  };

  const handleLoadSamplePresets = () => {
    setSaveSuccess('');
    setSaveError('');
    setLocalConfig((prev) => {
      const existing = prev.promoBanners || [];
      const existingIds = new Set(existing.map((b) => b.id));
      const missingSamples = DEFAULT_PROMO_BANNERS.filter((s) => !existingIds.has(s.id));
      const nextBanners =
        missingSamples.length > 0
          ? [...existing, ...missingSamples.map((s) => ({ ...s }))]
          : existing.length === 0
          ? [...DEFAULT_PROMO_BANNERS.map((s) => ({ ...s }))]
          : existing;
      return {
        ...prev,
        promoBanners: nextBanners
      };
    });
    setSaveSuccess('Sample promo templates loaded into editor. Click "Save Banners" to publish.');
  };

  const handleDeletePromo = (id: string) => {
    setSaveSuccess('');
    setSaveError('');
    setLocalConfig((prev) => ({
      ...prev,
      promoBanners: (prev.promoBanners || []).filter((b) => b.id !== id)
    }));
  };

  const handleSave = async () => {
    if (saving) return;
    const previousConfig = buildMergedConfig(config);
    setSaving(true);
    setSaveSuccess('');
    setSaveError('');
    try {
      const res: any = await onSaveConfig(localConfig);
      if (res && typeof res === 'object' && 'success' in res && res.success === false) {
        throw new Error(res.message || 'Failed to save promotional banners.');
      }
      setSaveSuccess('Promotional discount banners saved to authoritative campaign configuration.');
    } catch (err: any) {
      setLocalConfig(previousConfig);
      setSaveError(err?.message || 'Could not save promotional banners. Reverted to previous state.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 text-white">
      {/* Compact Header Bar */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-amber-400 shrink-0" />
            <h3 className="text-xs sm:text-sm font-black text-white truncate">
              Promotional Discount Banners
            </h3>
            <span className="text-[10px] font-mono text-slate-400 tabular-nums">
              ({promoBanners.filter((p) => p.isEnabled).length}/{promoBanners.length} Active)
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
            Create custom flash discount banners, promo codes, and load built-in promotional templates. Synced directly with landing &amp; advertiser rate promo banners.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleLoadSamplePresets}
            className="min-h-[36px] px-2.5 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-700 text-indigo-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer whitespace-nowrap"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Load Sample Promos</span>
          </button>

          <button
            type="button"
            onClick={handleAddPromoBanner}
            className="min-h-[36px] px-2.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-[11px] font-black flex items-center gap-1 cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Banner</span>
          </button>

          {onResetDefaults && (
            <button
              type="button"
              onClick={onResetDefaults}
              className="min-h-[36px] px-2.5 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="min-h-[36px] px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[11px] font-black flex items-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Saving...' : 'Save Banners'}</span>
          </button>
        </div>
      </div>


      <section className="rounded-xl border border-slate-700 bg-slate-950/70 p-3 space-y-3">
        <div><h3 className="text-sm font-black text-white">Your Jobs Here Display Rules</h3><p className="text-[11px] text-slate-400">Choose one CTA per category or show it inside every matching paid job card.</p></div>
        {(['vip', 'pinned', 'featured', 'urgent', 'future'] as const).map((tier) => {
          const rule = localConfig.adOpportunityDisplay?.jobTiers?.[tier] || DEFAULT_AD_OPPORTUNITY_DISPLAY_CONFIG.jobTiers[tier];
          const updateRule = (updates: any) => setLocalConfig((prev) => ({ ...prev, adOpportunityDisplay: { ...(prev.adOpportunityDisplay || DEFAULT_AD_OPPORTUNITY_DISPLAY_CONFIG), jobTiers: { ...DEFAULT_AD_OPPORTUNITY_DISPLAY_CONFIG.jobTiers, ...(prev.adOpportunityDisplay?.jobTiers || {}), [tier]: { ...rule, ...updates } } } }));
          return <div key={tier} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 items-center rounded-lg border border-slate-800 p-2">
            <span className="text-xs font-bold text-slate-200 capitalize">{tier} job placement</span>
            <select value={rule.displayMode} onChange={(e) => updateRule({ displayMode: e.target.value, showOnCategory: e.target.value === 'whole_category', showOnPlacement: e.target.value === 'placement_level', showOnEachCard: e.target.value === 'each_card' })} className="rounded-lg bg-slate-900 border border-slate-700 px-2 py-2 text-xs text-white">
              <option value="whole_category">Once above category</option><option value="each_card">Inside every matching card</option><option value="placement_level">Once at placement</option><option value="manual">Manual selection</option>
            </select>
            <label className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={rule.enabled} onChange={(e) => updateRule({ enabled: e.target.checked })} /> Enabled</label>
            {rule.displayMode === 'manual' && <div className="sm:col-span-3 flex flex-wrap gap-3 text-xs text-slate-300">
              <label><input type="checkbox" checked={rule.showOnCategory} onChange={(e) => updateRule({ showOnCategory: e.target.checked })} /> Category</label>
              <label><input type="checkbox" checked={rule.showOnPlacement} onChange={(e) => updateRule({ showOnPlacement: e.target.checked })} /> Placement</label>
              <label><input type="checkbox" checked={rule.showOnEachCard} onChange={(e) => updateRule({ showOnEachCard: e.target.checked })} /> Each card</label>
            </div>}
          </div>;
        })}
      </section>
      <section className="rounded-xl border border-slate-700 bg-slate-950/70 p-3 space-y-3">
        <div><h3 className="text-sm font-black text-white">Your Ad Here Display Rules</h3><p className="text-[11px] text-slate-400">Control the opportunity CTA independently for each paid ad placement. Disabled rules hide the CTA without disabling the paid placement itself.</p></div>
        {([
          ['top-header', 'Top header / banner'], ['feed-inline', 'Inline job-feed ad'], ['sidebar', 'Sidebar advertisement'],
          ['popup-modal', 'Popup / lightbox'], ['toast-float', 'Floating toast'], ['promo-discount-banner', 'Promotional banner'],
          ['dynamic-announcement-card', 'Announcement card'], ['sms-broadcast', 'SMS broadcast']
        ] as Array<[string, string]>).map(([placement, label]) => {
          const rule = localConfig.adOpportunityDisplay?.adPlacements?.[placement] || { ...DEFAULT_AD_OPPORTUNITY_DISPLAY_CONFIG.adPlacements[placement] };
          const updateRule = (updates: any) => setLocalConfig((prev) => ({ ...prev, adOpportunityDisplay: { ...(prev.adOpportunityDisplay || DEFAULT_AD_OPPORTUNITY_DISPLAY_CONFIG), adPlacements: { ...DEFAULT_AD_OPPORTUNITY_DISPLAY_CONFIG.adPlacements, ...(prev.adOpportunityDisplay?.adPlacements || {}), [placement]: { ...rule, ...updates } } } }));
          return <div key={placement} className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_auto] gap-2 items-center rounded-lg border border-slate-800 p-2">
            <span className="text-xs font-bold text-slate-200">{label}</span>
            <select value={rule.displayMode} onChange={(e) => updateRule({ displayMode: e.target.value, showOnCategory: e.target.value === 'whole_category', showOnPlacement: e.target.value === 'placement_level', showOnEachCard: e.target.value === 'each_card' })} className="w-full rounded-lg bg-slate-900 border border-slate-700 px-2 py-2 text-xs text-white">
              <option value="whole_category">Once for category</option><option value="placement_level">Once at placement</option><option value="each_card">Inside each ad card</option><option value="manual">Manual selection</option>
            </select>
            <label className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={rule.enabled} onChange={(e) => updateRule({ enabled: e.target.checked })} /> Enabled</label>
            {rule.displayMode === 'manual' && <div className="sm:col-span-3 flex flex-wrap gap-3 text-xs text-slate-300">
              <label><input type="checkbox" checked={rule.showOnCategory} onChange={(e) => updateRule({ showOnCategory: e.target.checked })} /> Category</label>
              <label><input type="checkbox" checked={rule.showOnPlacement} onChange={(e) => updateRule({ showOnPlacement: e.target.checked })} /> Placement</label>
              <label><input type="checkbox" checked={rule.showOnEachCard} onChange={(e) => updateRule({ showOnEachCard: e.target.checked })} /> Each card</label>
            </div>}
          </div>;
        })}
      </section>
      {saveError && (
        <div role="alert" className="p-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-[11px] text-rose-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{saveError}</span>
        </div>
      )}

      {saveSuccess && (
        <div role="status" className="p-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-[11px] text-emerald-200 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{saveSuccess}</span>
        </div>
      )}

      {promoBanners.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/60 p-6 text-center space-y-2.5">
          <p className="text-xs font-bold text-slate-300">No promotional discount banners configured yet.</p>
          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={handleLoadSamplePresets}
              className="min-h-[36px] px-3 py-1.5 rounded-lg bg-indigo-500 text-white text-xs font-bold cursor-pointer"
            >
              Load Sample Promos (50% Flash &amp; Free Postings)
            </button>
            <button
              type="button"
              onClick={handleAddPromoBanner}
              className="min-h-[36px] px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 text-xs font-black cursor-pointer"
            >
              Create Custom Promo Banner
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2.5">
          {promoBanners.map((promo) => (
            <div
              key={promo.id}
              className={`rounded-xl border p-3 space-y-2.5 transition-colors ${
                promo.isEnabled
                  ? 'bg-slate-900 border-slate-700/80'
                  : 'bg-slate-950/70 border-slate-800/70 opacity-85'
              }`}
            >
              {/* Card Top Row */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2 min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => handleUpdatePromo(promo.id, { isEnabled: !promo.isEnabled })}
                    className={`min-h-[30px] px-2.5 py-1 rounded-lg text-[10px] font-black uppercase cursor-pointer border whitespace-nowrap ${
                      promo.isEnabled
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    {promo.isEnabled ? 'Active' : 'Paused'}
                  </button>

                  <input
                    type="text"
                    value={promo.badgeText}
                    onChange={(e) => handleUpdatePromo(promo.id, { badgeText: e.target.value })}
                    placeholder="Badge (e.g. 🔥 50% OFF)"
                    className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-700 text-[11px] font-bold text-amber-300 min-w-[140px]"
                  />

                  <span className="text-[10px] font-mono text-slate-500 truncate">
                    ID: {promo.id}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleDeletePromo(promo.id)}
                  className="p-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 cursor-pointer shrink-0"
                  title="Delete Promo Banner"
                  aria-label="Delete Promo Banner"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Fields Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-0.5">Banner Headline</label>
                  <input
                    type="text"
                    value={promo.title}
                    onChange={(e) => handleUpdatePromo(promo.id, { title: e.target.value })}
                    placeholder="50% Flash Discount On All Placements"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs font-bold text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-0.5">Banner Description</label>
                  <input
                    type="text"
                    value={promo.description}
                    onChange={(e) => handleUpdatePromo(promo.id, { description: e.target.value })}
                    placeholder="Short promotional copy..."
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-0.5">Discount %</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={promo.discountPercent}
                    onChange={(e) =>
                      handleUpdatePromo(promo.id, {
                        discountPercent: Math.max(0, Math.min(100, Number(e.target.value) || 0))
                      })
                    }
                    className="w-full px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono tabular-nums font-bold text-emerald-400"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-0.5">Promo Code</label>
                  <input
                    type="text"
                    value={promo.promoCode || ''}
                    onChange={(e) => handleUpdatePromo(promo.id, { promoCode: e.target.value })}
                    placeholder="CAREER50"
                    className="w-full px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono text-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-0.5">Valid Until</label>
                  <input
                    type="date"
                    value={promo.validUntil || ''}
                    onChange={(e) => handleUpdatePromo(promo.id, { validUntil: e.target.value })}
                    className="w-full px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-0.5">Target Slot</label>
                  <select
                    value={promo.targetPlacement || 'all'}
                    onChange={(e) => handleUpdatePromo(promo.id, { targetPlacement: e.target.value as any })}
                    className="w-full px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white"
                  >
                    <option value="all">All Placements</option>
                    <option value="top-header">Top Header</option>
                    <option value="popup-modal">Lightbox Popup</option>
                    <option value="feed-inline">Inline Feed Card</option>
                    <option value="sidebar-card">Sidebar Card</option>
                    <option value="footer-banner">Footer Banner</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-0.5">CTA Text</label>
                  <input
                    type="text"
                    value={promo.ctaText || ''}
                    onChange={(e) => handleUpdatePromo(promo.id, { ctaText: e.target.value })}
                    placeholder="Claim Discount"
                    className="w-full px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-0.5">Gradient Theme</label>
                  <select
                    value={promo.bgGradient || 'from-amber-600 via-rose-600 to-indigo-700'}
                    onChange={(e) => handleUpdatePromo(promo.id, { bgGradient: e.target.value })}
                    className="w-full px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white"
                  >
                    {GRADIENT_PRESETS.map((g) => (
                      <option key={g.value} value={g.value}>{g.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <div className="sm:w-56">
                  <label className="block text-[10px] font-bold text-slate-400 mb-0.5">CTA Link / URL</label>
                  <input
                    type="text"
                    value={promo.ctaUrl || ''}
                    onChange={(e) => handleUpdatePromo(promo.id, { ctaUrl: e.target.value })}
                    placeholder="#dashboard"
                    className="w-full px-2 py-1 rounded-lg bg-slate-950 border border-slate-700 text-[11px] font-mono text-white"
                  />
                </div>

                {/* Live Strip Preview */}
                <div
                  className={`flex-1 rounded-lg bg-gradient-to-r ${promo.bgGradient || 'from-amber-600 via-rose-600 to-indigo-700'} px-3 py-2 flex items-center justify-between gap-2 text-white`}
                >
                  <div className="min-w-0 flex items-center gap-2">
                    {promo.badgeText && (
                      <span className="text-[10px] font-black bg-slate-950/40 px-1.5 py-0.5 rounded shrink-0">
                        {promo.badgeText}
                      </span>
                    )}
                    <span className="text-[11px] font-bold truncate">
                      {promo.title || 'Promo headline preview'}
                    </span>
                    {promo.promoCode && (
                      <span className="text-[10px] font-mono bg-white/15 px-1.5 py-0.5 rounded shrink-0">
                        Code: {promo.promoCode}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-black bg-slate-950/75 text-amber-300 px-2 py-0.5 rounded shrink-0 whitespace-nowrap">
                    {promo.ctaText || 'Claim'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminCampaignCustomizer;
