import React, { useEffect, useState } from 'react';
import { 
  LandingPageConfig, 
  DEFAULT_LANDING_PAGE_CONFIG, 
  CustomLandingCard, 
  LandingSectionOrder,
  LandingSectionId,
  LandingDesignSystem,
  createDefaultLandingDesignSystem,
  JobCardDesignConfig,
  JOB_CARD_ACCENT_STYLES,
  getJobCardAccentColor
} from '../../types/landing';
import { CampaignCustomizationConfig, PromoDiscountBanner } from '../../types/ad';
import { 
  Layout, 
  Edit3, 
  ArrowUp, 
  ArrowDown, 
  Plus, 
  Trash2, 
  Save, 
  RotateCcw, 
  Sparkles, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  ExternalLink, 
  Sliders, 
  Layers, 
  Megaphone,
  Briefcase,
  Type,
  Palette
} from 'lucide-react';

interface LandingPageCustomizerProps {
  config: LandingPageConfig;
  onUpdateConfig: (newConfig: LandingPageConfig) => Promise<any> | void;
  campaignConfig: CampaignCustomizationConfig;
  onUpdateCampaignConfig: (newConfig: CampaignCustomizationConfig) => Promise<any> | void;
  onSaveCombinedConfig?: (landing: LandingPageConfig, campaign: CampaignCustomizationConfig) => Promise<any>;
  designSystem?: LandingDesignSystem;
  onSelectDesign?: (designId: LandingDesignSystem['activeDesignId']) => Promise<any>;
  jobs?: any[];
}

const mergeJobCardDesign = (value?: Partial<JobCardDesignConfig>): JobCardDesignConfig => ({
  ...DEFAULT_LANDING_PAGE_CONFIG.jobCardDesign,
  ...(value || {}),
  theme: { ...DEFAULT_LANDING_PAGE_CONFIG.jobCardDesign.theme, ...(value?.theme || {}) },
  visibility: { ...DEFAULT_LANDING_PAGE_CONFIG.jobCardDesign.visibility, ...(value?.visibility || {}) },
  labels: { ...DEFAULT_LANDING_PAGE_CONFIG.jobCardDesign.labels, ...(value?.labels || {}) },
  limits: { ...DEFAULT_LANDING_PAGE_CONFIG.jobCardDesign.limits, ...(value?.limits || {}) }
});

export const LandingPageCustomizer: React.FC<LandingPageCustomizerProps> = ({
  config,
  onUpdateConfig,
  campaignConfig,
  onUpdateCampaignConfig,
  onSaveCombinedConfig,
  designSystem,
  onSelectDesign,
  jobs = []
}) => {
  const [activeTab, setActiveTab] = useState<'hero' | 'sections' | 'custom-cards' | 'design' | 'promos' | 'preview'>('sections');
  const [heroForm, setHeroForm] = useState(config.hero);
  const [sections, setSections] = useState<LandingSectionOrder[]>(config.sections || DEFAULT_LANDING_PAGE_CONFIG.sections);
  const [customCards, setCustomCards] = useState<CustomLandingCard[]>(config.customCards || DEFAULT_LANDING_PAGE_CONFIG.customCards);
  const [jobCardDesignForm, setJobCardDesignForm] = useState<JobCardDesignConfig>(() => mergeJobCardDesign(config.jobCardDesign));
  const [promoBanners, setPromoBanners] = useState<PromoDiscountBanner[]>(campaignConfig.promoBanners || []);
  const [saveToast, setSaveToast] = useState<string | null>(null);
  const [activeDesignId, setActiveDesignId] = useState<LandingDesignSystem['activeDesignId']>(designSystem?.activeDesignId || 'legacy');
  const [isSwitchingDesign, setIsSwitchingDesign] = useState(false);
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');

  // Keep editor fields aligned with the authoritative selected design after a
  // successful design switch or a server-side config refresh. Local edits are
  // not overwritten by unrelated component renders because these dependencies
  // change only when the persisted config/design changes.
  useEffect(() => {
    setHeroForm(config.hero);
    setSections(config.sections || DEFAULT_LANDING_PAGE_CONFIG.sections);
    setCustomCards(config.customCards || DEFAULT_LANDING_PAGE_CONFIG.customCards);
    setJobCardDesignForm(mergeJobCardDesign(config.jobCardDesign));
  }, [config]);

  useEffect(() => {
    setPromoBanners(campaignConfig.promoBanners || []);
  }, [campaignConfig]);

  useEffect(() => {
    if (designSystem?.activeDesignId) setActiveDesignId(designSystem.activeDesignId);
  }, [designSystem?.activeDesignId]);

  const handleSelectDesign = async (designId: LandingDesignSystem['activeDesignId']) => {
    if (!designSystem || !onSelectDesign || designId === activeDesignId) return;
    const selected = designSystem.designs.find((design) => design.id === designId);
    if (!selected) return;
    setIsSwitchingDesign(true);
    setSaveToast('Switching published landing design...');
    try {
      await onSelectDesign(designId);
      setActiveDesignId(designId);
      setHeroForm(selected.config.hero);
      setSections(selected.config.sections || DEFAULT_LANDING_PAGE_CONFIG.sections);
      setCustomCards(selected.config.customCards || DEFAULT_LANDING_PAGE_CONFIG.customCards);
      setJobCardDesignForm(mergeJobCardDesign(selected.config.jobCardDesign));
      setSaveToast('Selected design is now published.');
      setTimeout(() => setSaveToast(null), 3500);
    } catch (error: any) {
      setSaveToast(null);
      alert(error?.message || 'Could not switch landing design. Existing published design was retained.');
    } finally {
      setIsSwitchingDesign(false);
    }
  };

  // Reorder Sections
  const moveSection = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sections.length) return;

    const updated = [...sections];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;

    // Recalculate order index
    const reindexed = updated.map((sec, idx) => ({ ...sec, order: idx + 1 }));
    setSections(reindexed);
  };

  const toggleSectionEnabled = (id: LandingSectionId) => {
    setSections(prev =>
      prev.map(s => (s.id === id ? { ...s, isEnabled: !s.isEnabled } : s))
    );
  };

  // Custom Cards Management
  const handleAddCustomCard = () => {
    const newCard: CustomLandingCard = {
      id: `card-custom-${Date.now()}`,
      title: '🌟 New Featured Career Hub',
      description: 'Highlight high-demand remote vacancies or exclusive partner academy cohorts.',
      badge: 'Special Announcement',
      buttonText: 'Explore Opportunities',
      buttonUrl: '#jobs',
      bgGradient: 'from-indigo-600 via-purple-600 to-pink-700',
      isEnabled: true,
      order: customCards.length + 1
    };
    setCustomCards([...customCards, newCard]);
  };

  const handleUpdateCard = (id: string, updates: Partial<CustomLandingCard>) => {
    setCustomCards(prev =>
      prev.map(c => (c.id === id ? { ...c, ...updates } : c))
    );
  };

  const handleDeleteCard = (id: string) => {
    setCustomCards(prev => prev.filter(c => c.id !== id));
  };

  const moveCard = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= customCards.length) return;

    const updated = [...customCards];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;

    const reindexed = updated.map((c, idx) => ({ ...c, order: idx + 1 }));
    setCustomCards(reindexed);
  };

  // Promo Banners
  const handleUpdatePromo = (id: string, updates: Partial<PromoDiscountBanner>) => {
    setPromoBanners(prev =>
      prev.map(b => (b.id === id ? { ...b, ...updates } : b))
    );
  };

  const handleAddPromoBanner = () => {
    const defaultExpiry = new Date();
    defaultExpiry.setDate(defaultExpiry.getDate() + 30);
    const validUntil = `${defaultExpiry.getFullYear()}-${String(defaultExpiry.getMonth() + 1).padStart(2, '0')}-${String(defaultExpiry.getDate()).padStart(2, '0')}`;
    const newBanner: PromoDiscountBanner = {
      id: `promo-custom-${Date.now()}`,
      isEnabled: false,
      title: '',
      description: '',
      discountPercent: 0,
      badgeText: '',
      promoCode: '',
      targetPlacement: 'all',
      validUntil,
      bgGradient: 'from-purple-600 via-rose-600 to-amber-600',
      ctaText: 'Configure offer',
      ctaUrl: '#dashboard'
    };
    setPromoBanners([...promoBanners, newBanner]);
  };

  const handleDeletePromo = (id: string) => {
    setPromoBanners(prev => prev.filter(b => b.id !== id));
  };

  // Save All Changes
  const handleSaveAll = async () => {
    const newLandingConfig: LandingPageConfig = {
      ...config,
      hero: heroForm,
      sections,
      customCards,
      jobCardDesign: jobCardDesignForm
    };

    const newCampaignConfig: CampaignCustomizationConfig = {
      ...campaignConfig,
      promoBanners
    };

    try {
      setSaveToast('⏳ Publishing changes to production database...');
      
      // App.tsx provides a combined save so landing and campaign settings are
      // persisted together in one authoritative pricing update.
      if (onSaveCombinedConfig) {
        await onSaveCombinedConfig(newLandingConfig, newCampaignConfig);
      } else {
        await onUpdateConfig(newLandingConfig);
        await onUpdateCampaignConfig(newCampaignConfig);
      }

      setSaveToast('✅ Landing page design & section sequence published successfully!');
      setTimeout(() => setSaveToast(null), 4500);
    } catch (err: any) {
      console.error('Failed to publish landing page config:', err);
      setSaveToast(null);
      alert('❌ Failed to publish changes. The database might be temporarily unavailable. Please try again in a moment.');
    }
  };

  const handleResetDefaults = async () => {
    if (!window.confirm('Reset all landing page text, buttons and sequence to factory defaults?')) {
      return;
    }

    const previousHero = heroForm;
    const previousSections = sections;
    const previousCustomCards = customCards;
    const previousJobCardDesign = jobCardDesignForm;

    const selectedDesignDefaults = createDefaultLandingDesignSystem(DEFAULT_LANDING_PAGE_CONFIG).designs.find((design) => design.id === activeDesignId)?.config || DEFAULT_LANDING_PAGE_CONFIG;
    const newLandingConfig: LandingPageConfig = {
      ...selectedDesignDefaults,
      categoryPostingFees: config.categoryPostingFees || DEFAULT_LANDING_PAGE_CONFIG.categoryPostingFees,
      exemptUserIds: config.exemptUserIds || DEFAULT_LANDING_PAGE_CONFIG.exemptUserIds,
      exemptUserEmails: config.exemptUserEmails || DEFAULT_LANDING_PAGE_CONFIG.exemptUserEmails
    };

    setHeroForm(newLandingConfig.hero);
    setSections(newLandingConfig.sections);
    setCustomCards(newLandingConfig.customCards);
    setJobCardDesignForm(newLandingConfig.jobCardDesign);

    try {
      setSaveToast('⏳ Resetting and saving default configuration to database...');
      if (onSaveCombinedConfig) {
        await onSaveCombinedConfig(newLandingConfig, { ...campaignConfig, promoBanners });
      } else {
        await onUpdateConfig(newLandingConfig);
      }
      setSaveToast('✅ Restored and saved defaults for the selected landing design.');
      setTimeout(() => setSaveToast(null), 3500);
    } catch (err: any) {
      console.error('Failed to reset landing page config to defaults:', err);
      // Rollback local form states on failure
      setHeroForm(previousHero);
      setSections(previousSections);
      setCustomCards(previousCustomCards);
      setJobCardDesignForm(previousJobCardDesign);
      setSaveToast(null);
      alert('❌ Failed to reset landing page configuration. The database could not be updated. Changes have been rolled back.');
    }
  };

  const gradientOptions = [
    { label: 'Emerald / Teal', value: 'from-emerald-600 via-teal-600 to-cyan-700' },
    { label: 'Amber / Rose / Indigo', value: 'from-amber-600 via-rose-600 to-indigo-700' },
    { label: 'Indigo / Purple / Pink', value: 'from-indigo-600 via-purple-600 to-pink-700' },
    { label: 'Deep Blue / Slate', value: 'from-blue-700 via-indigo-800 to-slate-900' },
    { label: 'Orange / Flame', value: 'from-orange-600 via-red-600 to-rose-700' }
  ];

  return (
    <div className="space-y-6">
      
      {/* Header Bar */}
      <div className="bg-gradient-to-r from-indigo-950/70 via-slate-900 to-emerald-950/70 border border-indigo-500/30 rounded-3xl p-6 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="text-indigo-400 text-xs font-black uppercase tracking-wider bg-indigo-500/10 px-2.5 py-1 rounded-full border border-indigo-500/20 flex items-center gap-1.5">
              <Layout className="w-3.5 h-3.5" />
              Live Landing Page Visual Builder & Sequencer
            </span>
            <span className="text-emerald-400 text-xs font-bold font-mono">
              ● 100% Fully Customizable
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Landing Page Editor, Text Customizer & Card Sequence
          </h2>
          <p className="text-xs text-slate-300 max-w-2xl">
            Reorder landing page cards, edit headings, configure CTA buttons & URLs, add announcement blocks, and reorganize promotional ads.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {designSystem && (
            <label className="flex flex-col gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
              Published Landing Design
              <select
                value={activeDesignId}
                disabled={isSwitchingDesign}
                onChange={(event) => handleSelectDesign(event.target.value as LandingDesignSystem['activeDesignId'])}
                className="min-w-[190px] rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-xs font-bold text-white disabled:opacity-50"
              >
                {designSystem.designs.map((design) => (
                  <option key={design.id} value={design.id}>{design.name}</option>
                ))}
              </select>
            </label>
          )}
          <button
            onClick={handleResetDefaults}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs border border-slate-700 flex items-center space-x-1.5 transition-all cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>

          <button
            onClick={handleSaveAll}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-xl shadow-emerald-500/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center space-x-2 cursor-pointer"
          >
            <Save className="w-4 h-4 text-slate-950" />
            <span>Publish Landing Page</span>
          </button>
        </div>
      </div>

      {saveToast && (
        <div className="p-4 rounded-2xl bg-emerald-950/90 border border-emerald-500/50 text-emerald-300 text-xs font-bold flex items-center space-x-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{saveToast}</span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-800 pb-2 overflow-x-auto">
        {[
          { id: 'sections', label: '🔢 Section Sequence & Ordering', icon: Layers },
          { id: 'hero', label: '✍️ Hero Text & CTA Buttons', icon: Type },
          { id: 'custom-cards', label: `🎴 Dynamic Announcement Cards (${customCards.length})`, icon: Layout },
          { id: 'design', label: '🎨 Job Card Designer (Layout & Theme)', icon: Palette },
          { id: 'promos', label: `🔥 Top Promo Discount Banners (${promoBanners.length})`, icon: Megaphone },
          { id: 'preview', label: '👁️ Responsive Preview', icon: Eye }
        ].map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all whitespace-nowrap cursor-pointer ${
                activeTab === t.id
                  ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                  : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: SECTION SEQUENCE & REORDERING */}
      {activeTab === 'sections' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-black text-white">Landing Page Card Sequence & Order (1, 2, 3...)</h3>
              <p className="text-xs text-slate-400">
                Move sections up or down to set the exact visual layout and hide/show specific blocks on the live page.
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20">
              {sections.filter(s => s.isEnabled).length} of {sections.length} Sections Active
            </span>
          </div>

          <div className="space-y-3">
            {sections.map((section, index) => (
              <div
                key={section.id}
                className={`p-4 rounded-2xl border flex items-center justify-between gap-4 transition-all ${
                  section.isEnabled
                    ? 'bg-slate-900/90 border-slate-700/80 shadow-md'
                    : 'bg-slate-950/40 border-slate-800/60 opacity-60'
                }`}
              >
                <div className="flex items-center space-x-3.5">
                  <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 text-indigo-400 flex items-center justify-center font-black font-mono text-sm shrink-0">
                    {index + 1}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h4 className="text-sm font-black text-white">{section.name}</h4>
                      {!section.isEnabled && (
                        <span className="text-[10px] font-bold px-2 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 uppercase">
                          Hidden
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400">
                      {section.description}
                      {section.id === 'top-sponsor-ads' && ' Global banner is rendered in a fixed top position; this sequence cannot move it.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  {/* Toggle Visibility */}
                  <button
                    onClick={() => toggleSectionEnabled(section.id)}
                    className={`p-2 rounded-xl transition-all cursor-pointer ${
                      section.isEnabled
                        ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                        : 'bg-slate-800 text-slate-500 hover:text-slate-300'
                    }`}
                    title={section.isEnabled ? 'Hide on Landing Page' : 'Show on Landing Page'}
                  >
                    {section.isEnabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>

                  {/* Move Up */}
                  <button
                    onClick={() => moveSection(index, 'up')}
                    disabled={index === 0 || section.id === 'top-sponsor-ads'}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300 transition-all cursor-pointer"
                    title={section.id === 'top-sponsor-ads' ? 'Fixed global banner position' : 'Move Up'}
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>

                  {/* Move Down */}
                  <button
                    onClick={() => moveSection(index, 'down')}
                    disabled={index === sections.length - 1 || section.id === 'top-sponsor-ads'}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300 transition-all cursor-pointer"
                    title={section.id === 'top-sponsor-ads' ? 'Fixed global banner position' : 'Move Down'}
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: HERO TEXT & CTA BUTTONS CUSTOMIZER */}
      {activeTab === 'hero' && (
        <div className="space-y-6">
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span>Main Hero Headings & Typography</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400">Eyebrow Top Badge Text:</label>
                <input
                  type="text"
                  value={heroForm.eyebrowBadgeText}
                  onChange={(e) => setHeroForm({ ...heroForm, eyebrowBadgeText: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400">Gradient Highlight Word:</label>
                <input
                  type="text"
                  value={heroForm.gradientWord}
                  onChange={(e) => setHeroForm({ ...heroForm, gradientWord: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-emerald-400 font-bold focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400">Main Heading Prefix:</label>
                <input
                  type="text"
                  value={heroForm.mainHeadingPrefix}
                  onChange={(e) => setHeroForm({ ...heroForm, mainHeadingPrefix: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400">Main Heading Suffix:</label>
                <input
                  type="text"
                  value={heroForm.mainHeadingSuffix}
                  onChange={(e) => setHeroForm({ ...heroForm, mainHeadingSuffix: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400">Hero Subheading Text:</label>
              <textarea
                rows={3}
                value={heroForm.subHeading}
                onChange={(e) => setHeroForm({ ...heroForm, subHeading: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* CTA Buttons Customizer */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <ExternalLink className="w-4 h-4 text-indigo-400" />
              <span>CTA Buttons, Labels & Target Links</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <span className="text-xs font-black text-emerald-400 uppercase">Primary Action Button</span>
                <div className="space-y-2">
                  <div>
                    <label className="text-[11px] text-slate-400">Button Label:</label>
                    <input
                      type="text"
                      value={heroForm.primaryBtnText}
                      onChange={(e) => setHeroForm({ ...heroForm, primaryBtnText: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400">Target Link / Action:</label>
                    <input
                      type="text"
                      value={heroForm.primaryBtnUrl}
                      onChange={(e) => setHeroForm({ ...heroForm, primaryBtnUrl: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <span className="text-xs font-black text-indigo-400 uppercase">Secondary Action Button</span>
                <div className="space-y-2">
                  <div>
                    <label className="text-[11px] text-slate-400">Button Label:</label>
                    <input
                      type="text"
                      value={heroForm.secondaryBtnText}
                      onChange={(e) => setHeroForm({ ...heroForm, secondaryBtnText: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400">Target Link / Action:</label>
                    <input
                      type="text"
                      value={heroForm.secondaryBtnUrl}
                      onChange={(e) => setHeroForm({ ...heroForm, secondaryBtnUrl: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Hiring / Employer Banner Customizer */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-amber-400" />
              <span>Hiring Employer Banner Box</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] text-slate-400 font-bold">Banner Headline:</label>
                <input
                  type="text"
                  value={heroForm.hiringBannerTitle}
                  onChange={(e) => setHeroForm({ ...heroForm, hiringBannerTitle: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400 font-bold">Banner Badge Label:</label>
                <input
                  type="text"
                  value={heroForm.hiringBannerBadge}
                  onChange={(e) => setHeroForm({ ...heroForm, hiringBannerBadge: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-[11px] text-slate-400 font-bold">Banner Subtext:</label>
                <input
                  type="text"
                  value={heroForm.hiringBannerSub}
                  onChange={(e) => setHeroForm({ ...heroForm, hiringBannerSub: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400 font-bold">Button Text:</label>
                <input
                  type="text"
                  value={heroForm.hiringBannerBtnText}
                  onChange={(e) => setHeroForm({ ...heroForm, hiringBannerBtnText: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400 font-bold">Button Link:</label>
                <input
                  type="text"
                  value={heroForm.hiringBannerBtnUrl}
                  onChange={(e) => setHeroForm({ ...heroForm, hiringBannerBtnUrl: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white font-mono"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'hero' && (
        <div className="space-y-6">
          <div className="p-5 rounded-2xl bg-slate-900 border border-emerald-500/30 space-y-4">
            <h3 className="text-base font-black text-white">Design 4 & 5 — Photography & Hero Settings</h3>
            <p className="text-xs text-slate-400">Set secure HTTPS image URLs for the Modern Professional background and the two Dual Audience panels. These settings are saved with the selected design only.</p>
            {([
              ['design4HeroImageUrl', 'Design 4 hero image URL'],
              ['design5SeekerImageUrl', 'Design 5 job seeker image URL'],
              ['design5EmployerImageUrl', 'Design 5 employer image URL']
            ] as const).map(([key, label]) => (
              <div key={key} className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">{label}</label>
                <input
                  type="url"
                  value={heroForm[key] || ''}
                  placeholder="https://..."
                  onChange={(e) => setHeroForm({ ...heroForm, [key]: e.target.value })}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-xs text-white"
                />
              </div>
            ))}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300">Design 4 background overlay: {heroForm.design45HeroOverlay ?? 68}%</label>
              <input type="range" min="35" max="90" value={heroForm.design45HeroOverlay ?? 68} onChange={(e) => setHeroForm({ ...heroForm, design45HeroOverlay: Number(e.target.value) })} className="w-full accent-emerald-500" />
            </div>
            <div className="flex items-center gap-3">
              <label htmlFor="landing-design-accent" className="text-xs font-bold text-slate-300">Design 4 accent color</label>
              <input id="landing-design-accent" type="color" value={/^#[0-9a-fA-F]{6}$/.test(heroForm.design45AccentColor || '') ? heroForm.design45AccentColor! : '#0f9f78'} onChange={(e) => setHeroForm({ ...heroForm, design45AccentColor: e.target.value })} className="h-9 w-14 cursor-pointer rounded border border-slate-700 bg-slate-950 p-1" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 border-t border-slate-800 pt-4">
              {([
                ['design4PostJobBtnText', 'Design 4 Post a Job button'],
                ['design5SeekerEyebrow', 'Design 5 seeker label'],
                ['design5SeekerHeading', 'Design 5 seeker heading'],
                ['design5SeekerDescription', 'Design 5 seeker description'],
                ['design5SeekerPrimaryBtnText', 'Design 5 seeker primary button'],
                ['design5SeekerSecondaryBtnText', 'Design 5 seeker secondary button'],
                ['design5EmployerEyebrow', 'Design 5 employer label'],
                ['design5EmployerHeading', 'Design 5 employer heading'],
                ['design5EmployerDescription', 'Design 5 employer description'],
                ['design5EmployerBtnText', 'Design 5 employer button']
              ] as const).map(([key, label]) => (
                <label key={key} className="space-y-1.5">
                  <span className="block text-xs font-bold text-slate-300">{label}</span>
                  <input value={heroForm[key] || ''} onChange={(event) => setHeroForm({ ...heroForm, [key]: event.target.value.slice(0, 500) })} maxLength={500} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-xs text-white" />
                </label>
              ))}
            </div>
            <p className="text-[11px] text-amber-300">Use HTTPS image URLs only. If an image URL is empty or unsafe, the live design uses its built-in fallback image.</p>
          </div>
        </div>
      )}

      {/* TAB 4: JOB CARD DESIGNER */}
      {activeTab === 'design' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-black text-white">Universal Job Card Designer & Layout Engine</h3>
              <p className="text-xs text-slate-400">
                Customize how job postings appear to users. Switch between card layouts, toggle element visibility, and set word limits.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Design Controls */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Layout & Core Theme */}
              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                <h4 className="text-sm font-black text-white flex items-center gap-2">
                  <Layout className="w-4 h-4 text-indigo-400" />
                  Core Layout & Visual Theme
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400">Base Card Layout:</label>
                    <select
                      value={jobCardDesignForm.layout}
                      onChange={(e) => setJobCardDesignForm({ ...jobCardDesignForm, layout: e.target.value as any })}
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"
                    >
                      <option value="default">Standard Design 1 (Modern Cards)</option>
                      <option value="compact">Compact Design 2 (High-Density List)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400">Density Preset:</label>
                    <select
                      value={jobCardDesignForm.theme.density}
                      onChange={(e) => setJobCardDesignForm({ 
                        ...jobCardDesignForm, 
                        theme: { ...jobCardDesignForm.theme, density: e.target.value as any } 
                      })}
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"
                    >
                      <option value="normal">Normal / Balanced</option>
                      <option value="compact">Compact / Narrow</option>
                      <option value="spacious">Spacious / Breathable</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400">Accent Color Theme:</label>
                    <select
                      value={jobCardDesignForm.theme.accentColor}
                      onChange={(e) => setJobCardDesignForm({ 
                        ...jobCardDesignForm, 
                        theme: { ...jobCardDesignForm.theme, accentColor: e.target.value } 
                      })}
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"
                    >
                      <option value="emerald">Emerald Green (Default)</option>
                      <option value="indigo">Indigo Blue</option>
                      <option value="violet">Violet Purple</option>
                      <option value="rose">Rose Red</option>
                      <option value="amber">Amber Orange</option>
                      <option value="sky">Sky Blue</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400">Border Radius Style:</label>
                    <select
                      value={jobCardDesignForm.theme.borderRadius}
                      onChange={(e) => setJobCardDesignForm({ 
                        ...jobCardDesignForm, 
                        theme: { ...jobCardDesignForm.theme, borderRadius: e.target.value as any } 
                      })}
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"
                    >
                      <option value="none">Square (Sharp)</option>
                      <option value="md">Medium (Modern)</option>
                      <option value="xl">Extra Large (Curvy)</option>
                      <option value="3xl">Full Rounded (Bubble)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400">Card Background Preset:</label>
                    <select
                      value={jobCardDesignForm.theme.cardBgPreset}
                      onChange={(e) => setJobCardDesignForm({ 
                        ...jobCardDesignForm, 
                        theme: { ...jobCardDesignForm.theme, cardBgPreset: e.target.value as any } 
                      })}
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"
                    >
                      <option value="slate">Dark Slate (Solid)</option>
                      <option value="glass">Glassmorphism (Frosted)</option>
                      <option value="gradient">Soft Gradient (Subtle)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Element Visibility Toggles */}
              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                <h4 className="text-sm font-black text-white flex items-center gap-2">
                  <Eye className="w-4 h-4 text-emerald-400" />
                  Element Visibility Toggles
                </h4>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {Object.entries(jobCardDesignForm.visibility).map(([key, val]) => (
                    <button
                      key={key}
                      onClick={() => setJobCardDesignForm({
                        ...jobCardDesignForm,
                        visibility: { ...jobCardDesignForm.visibility, [key]: !val }
                      })}
                      className={`flex items-center justify-between px-3 py-2 rounded-xl border text-[10px] font-bold uppercase transition-all cursor-pointer ${
                        val 
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
                          : 'bg-slate-950 border-slate-800 text-slate-500'
                      }`}
                    >
                      <span>{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                      {val ? <CheckCircle2 className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Live field availability: based only on real jobs supplied by AdminDashboard */}
              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                <div>
                  <h4 className="text-sm font-black text-white">Live Job-Data Visibility Status</h4>
                  <p className="text-[10px] text-slate-400 mt-1">Yeh status loaded job records aur Admin ON/OFF setting ko check karta hai. Koi demo ya synthetic job use nahi hoti.</p>
                </div>
                {[
                  { key: 'poster', label: 'Poster / Source' },
                  { key: 'relativePostedTime', label: 'Relative Posted Time' },
                  { key: 'exactPostedDate', label: 'Exact Posted Date' },
                  { key: 'deadlineDate', label: 'Application Deadline' },
                  { key: 'deadlineRemaining', label: 'Deadline Remaining' },
                  { key: 'duplicateOverrideBadge', label: 'Duplicate Override Badge' }
                ].map((field) => {
                  const enabled = jobCardDesignForm.visibility[field.key as keyof typeof jobCardDesignForm.visibility] !== false;
                  // Keep this check aligned with JobListings.renderJobCard: do not infer
                  // availability from unrelated aliases such as company/applicationDeadline.
                  const hasUsableDate = (value: unknown): boolean => {
                    if (typeof value !== 'string' || !value.trim()) return false;
                    const clean = value.trim();
                    const dmy = clean.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})$/);
                    const isoDate = clean.match(/^(\d{4})-(\d{2})-(\d{2})$/);
                    const match = dmy || isoDate;
                    if (match) {
                      const year = Number(dmy ? match[3] : match[1]);
                      const month = Number(match[2]) - 1;
                      const day = Number(dmy ? match[1] : match[3]);
                      const parsed = new Date(year, month, day);
                      return parsed.getFullYear() === year && parsed.getMonth() === month && parsed.getDate() === day;
                    }
                    const parsed = new Date(clean);
                    return !Number.isNaN(parsed.getTime());
                  };
                  const hasData = jobs.some((job) => {
                    if (field.key === 'poster') {
                      // These are the exact inputs used to derive posterLabel.
                      // Renderer falls back to Employer for otherwise unclassified records.
                      return jobs.length > 0;
                    }
                    if (field.key === 'relativePostedTime' || field.key === 'exactPostedDate') {
                      const postedAt = hasUsableDate(job.postedAt) ? job.postedAt : job.createdAt;
                      return hasUsableDate(postedAt);
                    }
                    if (field.key === 'deadlineDate' || field.key === 'deadlineRemaining') {
                      return hasUsableDate(job.deadlineDate);
                    }
                    if (field.key === 'duplicateOverrideBadge') {
                      return job.isDuplicateOverride === true;
                    }
                    return false;
                  });
                  const status = !enabled ? 'Disabled by Admin' : jobs.length === 0 ? 'No live job data loaded' : hasData ? 'Data available in loaded jobs' : 'Data unavailable in loaded jobs';
                  const tone = !enabled ? 'text-rose-300 bg-rose-500/10 border-rose-500/30' : hasData && jobs.length > 0 ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30' : 'text-amber-300 bg-amber-500/10 border-amber-500/30';
                  return <div key={field.key} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2 last:border-0">
                    <span className="text-xs font-bold text-slate-200">{field.label}</span>
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border ${tone}`}>{status}</span>
                  </div>;
                })}
                <p className="text-[10px] text-slate-500">Note: “Data available” ka matlab record mein value mojood hai; premium/access policy ya individual job ki publication state ki wajah se har user ko visible hona guaranteed nahi. Final confirmation public user card par hoti hai.</p>
              </div>

              {/* Labels & Limits */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                  <h4 className="text-sm font-black text-white flex items-center gap-2">
                    <Type className="w-4 h-4 text-amber-400" />
                    Custom Labels
                  </h4>
                  <div className="space-y-3">
                    {Object.entries(jobCardDesignForm.labels).map(([key, val]) => (
                      <div key={key}>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                          {key.replace(/([A-Z])/g, ' $1').trim()} Label:
                        </label>
                        <input
                          type="text"
                          value={val}
                          onChange={(e) => setJobCardDesignForm({
                            ...jobCardDesignForm,
                            labels: { ...jobCardDesignForm.labels, [key]: e.target.value }
                          })}
                          className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                  <h4 className="text-sm font-black text-white flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-purple-400" />
                    Content Limits
                  </h4>
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                        Description Max Words:
                      </label>
                      <input
                        type="number"
                        value={jobCardDesignForm.limits.descriptionMaxWords}
                        onChange={(e) => setJobCardDesignForm({
                          ...jobCardDesignForm,
                          limits: { ...jobCardDesignForm.limits, descriptionMaxWords: Number(e.target.value) }
                        })}
                        className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                        Max Skill Tags Shown:
                      </label>
                      <input
                        type="number"
                        value={jobCardDesignForm.limits.maxTags}
                        onChange={(e) => setJobCardDesignForm({
                          ...jobCardDesignForm,
                          limits: { ...jobCardDesignForm.limits, maxTags: Number(e.target.value) }
                        })}
                        className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Live Preview (Simulated) */}
            <div className="space-y-4">
              <div className="sticky top-6">
                <h4 className="text-xs font-black text-indigo-400 uppercase mb-3 flex items-center gap-2">
                  <Eye className="w-3.5 h-3.5" />
                  Design 1:1 Live Preview
                </h4>
                
                <div className={`p-5 bg-slate-950 border-2 border-dashed border-indigo-500/20 rounded-3xl min-h-[400px] flex items-center justify-center`}>
                  <div className={`w-full max-w-sm p-4 border shadow-2xl transition-all duration-300 ${
                    jobCardDesignForm.theme.cardBgPreset === 'glass' ? 'bg-white/5 backdrop-blur-md border-white/10' :
                    jobCardDesignForm.theme.cardBgPreset === 'gradient' ? 'bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700' :
                    'bg-slate-900 border-slate-800'
                  } ${
                    jobCardDesignForm.theme.borderRadius === 'none' ? 'rounded-none' :
                    jobCardDesignForm.theme.borderRadius === 'md' ? 'rounded-lg' :
                    jobCardDesignForm.theme.borderRadius === 'xl' ? 'rounded-2xl' :
                    'rounded-[2.5rem]'
                  }`}>
                    <div className="space-y-3">
                      <div className="flex justify-between items-start">
                        {jobCardDesignForm.visibility.title && (
                          <div className={`h-4 bg-slate-800 rounded w-2/3 animate-pulse`} />
                        )}
                        {jobCardDesignForm.visibility.saveButton && (
                          <div className="w-6 h-6 rounded-lg bg-slate-800 animate-pulse" />
                        )}
                      </div>
                      
                      {jobCardDesignForm.visibility.company && (
                        <div className="h-3 bg-slate-800/60 rounded w-1/3 animate-pulse" />
                      )}

                      <div className="flex gap-2">
                        {jobCardDesignForm.visibility.jobType && <div className={`h-4 ${JOB_CARD_ACCENT_STYLES[getJobCardAccentColor(jobCardDesignForm.theme.accentColor)].previewSubtle} rounded-full w-12`} />}
                        {jobCardDesignForm.visibility.location && <div className="h-4 bg-slate-800 rounded-full w-16" />}
                      </div>

                      {jobCardDesignForm.visibility.description && (
                        <div className="space-y-1.5 pt-2">
                          <div className="h-2.5 bg-slate-800/40 rounded w-full" />
                          <div className="h-2.5 bg-slate-800/40 rounded w-5/6" />
                        </div>
                      )}

                      <div className="flex justify-between items-center pt-4">
                         {jobCardDesignForm.visibility.salary && (
                           <div className={`h-4 ${JOB_CARD_ACCENT_STYLES[getJobCardAccentColor(jobCardDesignForm.theme.accentColor)].previewSoft} rounded w-16`} />
                         )}
                         <div className="flex gap-2">
                           {jobCardDesignForm.visibility.detailsButton && <div className="h-7 w-16 bg-slate-800 rounded-lg" />}
                           {jobCardDesignForm.visibility.applyButton && <div className={`h-7 w-16 ${JOB_CARD_ACCENT_STYLES[getJobCardAccentColor(jobCardDesignForm.theme.accentColor)].solidBg} rounded-lg`} />}
                         </div>
                      </div>
                    </div>
                  </div>
                </div>
                <p className="text-[10px] text-center text-slate-500 mt-4 font-medium italic">
                  * Preview shows a wireframe representation of Design 1 with current visibility & theme settings.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB: CUSTOM ANNOUNCEMENT CARDS */}
      {activeTab === 'custom-cards' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h3 className="text-base font-black text-white">Announcement Cards Editor</h3><p className="text-xs text-slate-400">Edit each design's own card text, image, CTA, visibility and order. These cards are admin content, not paid sponsor inventory.</p></div>
            <button type="button" onClick={handleAddCustomCard} className="inline-flex items-center gap-2 rounded-xl bg-indigo-500 px-4 py-2 text-xs font-black text-white"><Plus className="h-4 w-4"/>Add Card</button>
          </div>
          {customCards.length === 0 && <div className="rounded-xl border border-slate-800 bg-slate-950 p-6 text-center text-xs text-slate-400">No announcement cards configured for this design.</div>}
          {customCards.map((card,index) => (
            <article key={card.id} className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2"><span className="rounded-lg bg-slate-800 px-2 py-1 text-xs font-mono text-indigo-300">#{index+1}</span><button type="button" onClick={() => handleUpdateCard(card.id,{isEnabled:!card.isEnabled})} className={`rounded-lg px-3 py-1.5 text-[10px] font-black ${card.isEnabled?'bg-emerald-500/20 text-emerald-300':'bg-slate-800 text-slate-400'}`}>{card.isEnabled?'Visible':'Hidden'}</button></div>
                <div className="flex items-center gap-1"><button type="button" disabled={index===0} onClick={() => moveCard(index,'up')} className="rounded-lg bg-slate-800 p-2 text-slate-300 disabled:opacity-30" aria-label="Move card up"><ArrowUp className="h-4 w-4"/></button><button type="button" disabled={index===customCards.length-1} onClick={() => moveCard(index,'down')} className="rounded-lg bg-slate-800 p-2 text-slate-300 disabled:opacity-30" aria-label="Move card down"><ArrowDown className="h-4 w-4"/></button><button type="button" onClick={() => handleDeleteCard(card.id)} className="rounded-lg bg-rose-500/15 p-2 text-rose-300" aria-label="Delete card"><Trash2 className="h-4 w-4"/></button></div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-[10px] font-bold text-slate-400">Title<input value={card.title} onChange={e=>handleUpdateCard(card.id,{title:e.target.value})} maxLength={160} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"/></label>
                <label className="space-y-1 text-[10px] font-bold text-slate-400">Badge<input value={card.badge} onChange={e=>handleUpdateCard(card.id,{badge:e.target.value})} maxLength={60} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"/></label>
                <label className="space-y-1 text-[10px] font-bold text-slate-400 sm:col-span-2">Description<textarea value={card.description} onChange={e=>handleUpdateCard(card.id,{description:e.target.value})} maxLength={600} rows={3} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"/></label>
                <label className="space-y-1 text-[10px] font-bold text-slate-400">Image URL (optional)<input value={card.imageUrl||''} onChange={e=>handleUpdateCard(card.id,{imageUrl:e.target.value})} placeholder="https://... or /uploads/..." className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"/></label>
                <label className="space-y-1 text-[10px] font-bold text-slate-400">Background gradient classes<input value={card.bgGradient} onChange={e=>handleUpdateCard(card.id,{bgGradient:e.target.value})} maxLength={160} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"/></label>
                <label className="space-y-1 text-[10px] font-bold text-slate-400">Button text<input value={card.buttonText} onChange={e=>handleUpdateCard(card.id,{buttonText:e.target.value})} maxLength={80} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"/></label>
                <label className="space-y-1 text-[10px] font-bold text-slate-400">Button URL (HTTPS or #internal)<input value={card.buttonUrl} onChange={e=>handleUpdateCard(card.id,{buttonUrl:e.target.value})} maxLength={1000} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"/></label>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* TAB: RESPONSIVE LANDING PREVIEW (configuration-only; no synthetic ads/jobs) */}
      {activeTab === 'preview' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-black text-white">Landing Design Preview</h3>
              <p className="text-xs text-slate-400">Preview of the current unsaved hero and announcement-card settings. Real job and paid-ad inventory is not fabricated here.</p>
            </div>
            <div className="inline-flex rounded-xl border border-slate-700 bg-slate-950 p-1">
              <button type="button" onClick={() => setPreviewMode('desktop')} aria-pressed={previewMode === 'desktop'} className={`rounded-lg px-3 py-2 text-xs font-bold ${previewMode === 'desktop' ? 'bg-indigo-500 text-white' : 'text-slate-400'}`}>Desktop</button>
              <button type="button" onClick={() => setPreviewMode('mobile')} aria-pressed={previewMode === 'mobile'} className={`rounded-lg px-3 py-2 text-xs font-bold ${previewMode === 'mobile' ? 'bg-indigo-500 text-white' : 'text-slate-400'}`}>Mobile</button>
            </div>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-slate-700 bg-slate-950 p-3 sm:p-5">
            <div className={`mx-auto min-h-[420px] overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 transition-all ${previewMode === 'mobile' ? 'w-[320px] max-w-full' : 'w-full max-w-5xl'}`}>
              {sections.find((section) => section.id === 'hero')?.isEnabled !== false && (
                activeDesignId === 'design-5' ? (
                  <section className={`grid ${previewMode === 'mobile' ? 'grid-cols-1' : 'grid-cols-2'}`}>
                    <article className="relative flex min-h-[260px] items-end overflow-hidden bg-slate-800 p-5 text-left text-white">
                      {heroForm.design5SeekerImageUrl && /^https:\/\//i.test(heroForm.design5SeekerImageUrl) && <img src={heroForm.design5SeekerImageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />}
                      <div className="absolute inset-0 bg-slate-950/70" />
                      <div className="relative z-10"><span className="text-[10px] font-bold uppercase text-emerald-300">{heroForm.design5SeekerEyebrow || 'For Job Seekers'}</span><h2 className="mt-2 text-xl font-black">{heroForm.design5SeekerHeading || 'Find your next opportunity.'}</h2><p className="mt-2 text-xs text-white/80">{heroForm.design5SeekerDescription || 'Discover verified jobs and build your career.'}</p><span className="mt-3 inline-block rounded-lg bg-emerald-400 px-3 py-2 text-[10px] font-black text-slate-950">{heroForm.design5SeekerPrimaryBtnText || 'Explore Jobs'}</span></div>
                    </article>
                    <article className="relative flex min-h-[260px] items-end overflow-hidden bg-slate-800 p-5 text-left text-white">
                      {heroForm.design5EmployerImageUrl && /^https:\/\//i.test(heroForm.design5EmployerImageUrl) && <img src={heroForm.design5EmployerImageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />}
                      <div className="absolute inset-0 bg-slate-950/70" />
                      <div className="relative z-10"><span className="text-[10px] font-bold uppercase text-amber-300">{heroForm.design5EmployerEyebrow || 'For Employers'}</span><h2 className="mt-2 text-xl font-black">{heroForm.design5EmployerHeading || 'Build your team with confidence.'}</h2><p className="mt-2 text-xs text-white/80">{heroForm.design5EmployerDescription || 'Reach skilled talent and publish vacancies.'}</p><span className="mt-3 inline-block rounded-lg bg-white px-3 py-2 text-[10px] font-black text-slate-950">{heroForm.design5EmployerBtnText || 'Post a Job'}</span></div>
                    </article>
                  </section>
                ) : activeDesignId === 'design-4' ? (
                  <section className="relative overflow-hidden bg-slate-950 px-4 py-8 text-left sm:px-8 sm:py-12">
                    {heroForm.design4HeroImageUrl && /^https:\/\//i.test(heroForm.design4HeroImageUrl) && <img src={heroForm.design4HeroImageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />}
                    <div className="absolute inset-0 bg-slate-950/70" />
                    <div className="relative z-10"><p className="text-[10px] font-bold uppercase tracking-widest text-emerald-300">{heroForm.eyebrowBadgeText}</p><h1 className="mt-3 text-2xl font-black leading-tight text-white sm:text-4xl">{heroForm.mainHeadingPrefix} <span style={{ color: /^#[0-9a-fA-F]{6}$/.test(heroForm.design45AccentColor || '') ? heroForm.design45AccentColor : '#0f9f78' }}>{heroForm.gradientWord}</span> {heroForm.mainHeadingSuffix}</h1><p className="mt-3 max-w-2xl text-xs leading-relaxed text-slate-200 sm:text-sm">{heroForm.subHeading}</p><div className="mt-5 grid gap-2 sm:grid-cols-[1fr_auto]"><span className="rounded-lg border border-white/20 bg-slate-900/80 px-3 py-3 text-xs text-slate-300">{heroForm.searchPlaceholder}</span><span className="rounded-lg bg-emerald-400 px-4 py-3 text-center text-xs font-black text-slate-950">Search Jobs</span></div><div className="mt-3 flex flex-wrap gap-2"><span className="rounded-lg bg-emerald-400 px-3 py-2 text-xs font-black text-slate-950">{heroForm.primaryBtnText}</span><span className="rounded-lg border border-white/40 px-3 py-2 text-xs text-white">{heroForm.secondaryBtnText}</span><span className="rounded-lg border border-amber-300/50 px-3 py-2 text-xs text-white">{heroForm.design4PostJobBtnText || 'Post a Job'}</span></div></div>
                  </section>
                ) : (
                  <section className="bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 px-4 py-8 text-center sm:px-8 sm:py-12">
                    {heroForm.eyebrowBadgeText && <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-emerald-300">{heroForm.eyebrowBadgeText}</p>}
                    <h1 className="mx-auto max-w-3xl text-2xl font-black leading-tight text-white sm:text-4xl">{heroForm.mainHeadingPrefix} <span className="text-emerald-400">{heroForm.gradientWord}</span> {heroForm.mainHeadingSuffix}</h1>
                    <p className="mx-auto mt-3 max-w-2xl text-xs leading-relaxed text-slate-300 sm:text-sm">{heroForm.subHeading}</p>
                    <div className="mt-5 flex flex-wrap justify-center gap-2">
                      {heroForm.primaryBtnText && <span className="rounded-xl bg-emerald-400 px-4 py-2 text-xs font-black text-slate-950">{heroForm.primaryBtnText}</span>}
                      {heroForm.secondaryBtnText && <span className="rounded-xl border border-slate-600 px-4 py-2 text-xs font-bold text-white">{heroForm.secondaryBtnText}</span>}
                    </div>
                  </section>
                )
              )}
              {sections.find((section) => section.id === 'custom-announcements')?.isEnabled !== false && customCards.filter((card) => card.isEnabled).length > 0 && (
                <section className={`grid gap-3 p-4 sm:p-6 ${previewMode === 'mobile' ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-3'}`}>
                  {customCards.filter((card) => card.isEnabled).sort((a, b) => a.order - b.order).map((card) => (
                    <article key={card.id} className={`rounded-2xl bg-gradient-to-br ${card.bgGradient} p-4 text-white shadow-lg`}>
                      {card.imageUrl && <img src={card.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" className="mb-3 max-h-36 w-full rounded-xl object-cover" />}
                      {card.badge && <span className="text-[9px] font-black uppercase tracking-wider text-white/80">{card.badge}</span>}
                      <h2 className="mt-2 text-sm font-black">{card.title}</h2>
                      <p className="mt-2 text-xs leading-relaxed text-white/80">{card.description}</p>
                      <span className="mt-4 inline-block rounded-lg bg-white/15 px-3 py-2 text-[10px] font-bold">{card.buttonText}</span>
                    </article>
                  ))}
                </section>
              )}
              {sections.find((section) => section.id === 'jobs-feed')?.isEnabled !== false && <div className="border-t border-slate-800 px-4 py-5 text-center text-xs text-slate-500">Live jobs and eligible paid campaigns render from their existing production data sources.</div>}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: PROMOTIONAL DISCOUNT BANNERS */}
      {activeTab === 'promos' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-black text-white">Top Promotional Discount Banners & Flash Sales</h3>
              <p className="text-xs text-slate-400">
                Display site-wide sticky discount banners at the top of the jobs landing page.
              </p>
            </div>
            <button
              onClick={handleAddPromoBanner}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center space-x-1.5 shadow-lg cursor-pointer"
            >
              <Plus className="w-4 h-4 text-slate-950" />
              <span>Add Promo Banner</span>
            </button>
          </div>

          <div className="space-y-3">
            {promoBanners.map((promo) => (
              <div
                key={promo.id}
                className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleUpdatePromo(promo.id, { isEnabled: !promo.isEnabled })}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase transition-all cursor-pointer ${
                        promo.isEnabled
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {promo.isEnabled ? '🟢 Active on Landing' : '⏸️ Disabled'}
                    </button>
                    <input
                      type="text"
                      value={promo.badgeText}
                      onChange={(e) => handleUpdatePromo(promo.id, { badgeText: e.target.value })}
                      placeholder="Badge (e.g. 🔥 50% OFF)"
                      className="px-2 py-0.5 rounded bg-slate-950 border border-slate-700 text-xs font-bold text-amber-300"
                    />
                  </div>

                  <button
                    onClick={() => handleDeletePromo(promo.id)}
                    className="p-1 rounded bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 cursor-pointer"
                    title="Delete Promo"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={promo.title}
                    onChange={(e) => handleUpdatePromo(promo.id, { title: e.target.value })}
                    placeholder="Banner Headline"
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs font-black text-white"
                  />

                  <input
                    type="text"
                    value={promo.description}
                    onChange={(e) => handleUpdatePromo(promo.id, { description: e.target.value })}
                    placeholder="Banner description..."
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-300"
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-400">Discount %:</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={promo.discountPercent}
                      onChange={(e) => handleUpdatePromo(promo.id, { discountPercent: Number(e.target.value) })}
                      className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 text-xs font-mono font-bold text-emerald-400"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400">Promo Code:</label>
                    <input
                      type="text"
                      value={promo.promoCode || ''}
                      onChange={(e) => handleUpdatePromo(promo.id, { promoCode: e.target.value })}
                      placeholder="e.g. CAREER50"
                      className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 text-xs font-mono text-white"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400">CTA Button Text:</label>
                    <input
                      type="text"
                      value={promo.ctaText || ''}
                      onChange={(e) => handleUpdatePromo(promo.id, { ctaText: e.target.value })}
                      placeholder="Claim Discount"
                      className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400">CTA Link / URL:</label>
                    <input
                      type="text"
                      value={promo.ctaUrl || ''}
                      onChange={(e) => handleUpdatePromo(promo.id, { ctaUrl: e.target.value })}
                      placeholder="#dashboard"
                      className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 text-xs text-white font-mono"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};
