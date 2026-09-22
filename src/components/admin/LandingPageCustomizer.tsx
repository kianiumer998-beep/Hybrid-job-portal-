import React, { useState } from 'react';
import { 
  LandingPageConfig, 
  DEFAULT_LANDING_PAGE_CONFIG, 
  CustomLandingCard, 
  LandingSectionOrder,
  LandingSectionId
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
  onUpdateConfig: (newConfig: LandingPageConfig) => void;
  campaignConfig: CampaignCustomizationConfig;
  onUpdateCampaignConfig: (newConfig: CampaignCustomizationConfig) => void;
}

export const LandingPageCustomizer: React.FC<LandingPageCustomizerProps> = ({
  config,
  onUpdateConfig,
  campaignConfig,
  onUpdateCampaignConfig
}) => {
  const [activeTab, setActiveTab] = useState<'hero' | 'sections' | 'custom-cards' | 'promos' | 'preview'>('sections');
  const [heroForm, setHeroForm] = useState(config.hero);
  const [sections, setSections] = useState<LandingSectionOrder[]>(config.sections || DEFAULT_LANDING_PAGE_CONFIG.sections);
  const [customCards, setCustomCards] = useState<CustomLandingCard[]>(config.customCards || DEFAULT_LANDING_PAGE_CONFIG.customCards);
  const [promoBanners, setPromoBanners] = useState<PromoDiscountBanner[]>(campaignConfig.promoBanners || []);
  const [saveToast, setSaveToast] = useState<string | null>(null);

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
    const newBanner: PromoDiscountBanner = {
      id: `promo-custom-${Date.now()}`,
      isEnabled: true,
      title: 'New High-Impact Flash Campaign',
      description: 'Exclusive 40% discount on all header and sidebar ad placements.',
      discountPercent: 40,
      badgeText: '🔥 40% FLASH SALE',
      promoCode: 'FLASH40',
      targetPlacement: 'all',
      validUntil: '2026-10-31',
      bgGradient: 'from-purple-600 via-rose-600 to-amber-600',
      ctaText: 'Claim Discount Now',
      ctaUrl: '#dashboard'
    };
    setPromoBanners([...promoBanners, newBanner]);
  };

  const handleDeletePromo = (id: string) => {
    setPromoBanners(prev => prev.filter(b => b.id !== id));
  };

  // Save All Changes
  const handleSaveAll = () => {
    const newLandingConfig: LandingPageConfig = {
      ...config,
      hero: heroForm,
      sections,
      customCards
    };

    const newCampaignConfig: CampaignCustomizationConfig = {
      ...campaignConfig,
      promoBanners
    };

    onUpdateConfig(newLandingConfig);
    onUpdateCampaignConfig(newCampaignConfig);

    setSaveToast('Landing page design & section sequence saved successfully!');
    setTimeout(() => setSaveToast(null), 3500);
  };

  const handleResetDefaults = () => {
    if (window.confirm('Reset all landing page text, buttons and sequence to factory defaults?')) {
      setHeroForm(DEFAULT_LANDING_PAGE_CONFIG.hero);
      setSections(DEFAULT_LANDING_PAGE_CONFIG.sections);
      setCustomCards(DEFAULT_LANDING_PAGE_CONFIG.customCards);
      const newCfg = { ...DEFAULT_LANDING_PAGE_CONFIG };
      onUpdateConfig(newCfg);
      setSaveToast('Restored default landing page configuration.');
      setTimeout(() => setSaveToast(null), 3000);
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

        <div className="flex items-center space-x-3 shrink-0">
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
          { id: 'promos', label: `🔥 Top Promo Discount Banners (${promoBanners.length})`, icon: Megaphone }
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
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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
                      <p className="text-xs text-slate-400">{section.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    {/* Mobile Visibility Toggle */}
                    <button
                      onClick={() => {
                        setSections(prev =>
                          prev.map(s => (s.id === section.id ? { ...s, mobileVisible: s.mobileVisible === false ? true : false } : s))
                        );
                      }}
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                        section.mobileVisible !== false
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-slate-800 text-slate-500 line-through'
                      }`}
                      title="Toggle Mobile Visibility"
                    >
                      📱 {section.mobileVisible !== false ? 'Mobile' : 'No Mobile'}
                    </button>

                    {/* Desktop Visibility Toggle */}
                    <button
                      onClick={() => {
                        setSections(prev =>
                          prev.map(s => (s.id === section.id ? { ...s, desktopVisible: s.desktopVisible === false ? true : false } : s))
                        );
                      }}
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                        section.desktopVisible !== false
                          ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                          : 'bg-slate-800 text-slate-500 line-through'
                      }`}
                      title="Toggle Desktop Visibility"
                    >
                      💻 {section.desktopVisible !== false ? 'Desktop' : 'No Desktop'}
                    </button>

                    {/* Toggle Global Visibility */}
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
                      disabled={index === 0}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300 transition-all cursor-pointer"
                      title="Move Up"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>

                    {/* Move Down */}
                    <button
                      onClick={() => moveSection(index, 'down')}
                      disabled={index === sections.length - 1}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300 transition-all cursor-pointer"
                      title="Move Down"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Section Granular Dimensions & Layout Controls */}
                <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 pt-2.5 mt-2 border-t border-slate-800/80 text-[10px]">
                  <div>
                    <label className="block text-slate-400 font-semibold mb-0.5">Width:</label>
                    <select
                      value={section.width || 'max-w-7xl'}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSections(prev => prev.map(s => s.id === section.id ? { ...s, width: val } : s));
                      }}
                      className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 text-white"
                    >
                      <option value="max-w-7xl">Standard (7XL)</option>
                      <option value="max-w-5xl">Compact (5XL)</option>
                      <option value="max-w-full">Full Width</option>
                      <option value="max-w-4xl">Narrow (4XL)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-400 font-semibold mb-0.5">Height:</label>
                    <select
                      value={section.height || 'auto'}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSections(prev => prev.map(s => s.id === section.id ? { ...s, height: val } : s));
                      }}
                      className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 text-white"
                    >
                      <option value="auto">Auto</option>
                      <option value="min-h-[140px]">Compact</option>
                      <option value="min-h-[220px]">Standard</option>
                      <option value="min-h-[320px]">Tall</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-400 font-semibold mb-0.5">Padding:</label>
                    <select
                      value={section.padding || 'py-6'}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSections(prev => prev.map(s => s.id === section.id ? { ...s, padding: val } : s));
                      }}
                      className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 text-white"
                    >
                      <option value="py-6">Standard (py-6)</option>
                      <option value="py-2">Compact (py-2)</option>
                      <option value="py-10">Spacious (py-10)</option>
                      <option value="py-0">None (py-0)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-400 font-semibold mb-0.5">Spacing:</label>
                    <select
                      value={section.spacing || 'space-y-6'}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSections(prev => prev.map(s => s.id === section.id ? { ...s, spacing: val } : s));
                      }}
                      className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 text-white"
                    >
                      <option value="space-y-6">Standard (space-y-6)</option>
                      <option value="space-y-3">Compact (space-y-3)</option>
                      <option value="space-y-10">Relaxed (space-y-10)</option>
                      <option value="space-y-0">None</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-400 font-semibold mb-0.5">Mobile Size:</label>
                    <select
                      value={section.mobileSize || 'standard'}
                      onChange={(e) => {
                        const val = e.target.value as any;
                        setSections(prev => prev.map(s => s.id === section.id ? { ...s, mobileSize: val } : s));
                      }}
                      className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 text-white"
                    >
                      <option value="compact">Compact</option>
                      <option value="standard">Standard</option>
                      <option value="large">Large</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-400 font-semibold mb-0.5">Desktop Size:</label>
                    <select
                      value={section.desktopSize || 'standard'}
                      onChange={(e) => {
                        const val = e.target.value as any;
                        setSections(prev => prev.map(s => s.id === section.id ? { ...s, desktopSize: val } : s));
                      }}
                      className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 text-white"
                    >
                      <option value="compact">Compact</option>
                      <option value="standard">Standard</option>
                      <option value="large">Large</option>
                    </select>
                  </div>
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

      {/* TAB 3: DYNAMIC ANNOUNCEMENT CARDS BUILDER */}
      {activeTab === 'custom-cards' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-black text-white">Custom Announcement & Marketing Cards</h3>
              <p className="text-xs text-slate-400">
                Add new customizable blocks and cards on the landing page with custom badges, gradients, and actions.
              </p>
            </div>
            <button
              onClick={handleAddCustomCard}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-400 hover:to-purple-400 text-white font-black text-xs flex items-center space-x-1.5 shadow-lg cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Card</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {customCards.map((card, index) => (
              <div
                key={card.id}
                className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3.5 relative shadow-xl"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="w-6 h-6 rounded-lg bg-indigo-500/20 text-indigo-300 flex items-center justify-center text-xs font-black font-mono">
                      #{index + 1}
                    </span>
                    <input
                      type="text"
                      value={card.badge}
                      onChange={(e) => handleUpdateCard(card.id, { badge: e.target.value })}
                      placeholder="Badge (e.g. Overseas Jobs)"
                      className="px-2 py-0.5 rounded bg-slate-950 border border-slate-700 text-[11px] font-bold text-amber-300 uppercase"
                    />
                  </div>

                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => moveCard(index, 'up')}
                      disabled={index === 0}
                      className="p-1 rounded bg-slate-800 text-slate-300 disabled:opacity-30 hover:bg-slate-700"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => moveCard(index, 'down')}
                      disabled={index === customCards.length - 1}
                      className="p-1 rounded bg-slate-800 text-slate-300 disabled:opacity-30 hover:bg-slate-700"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteCard(card.id)}
                      className="p-1 rounded bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 ml-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <input
                    type="text"
                    value={card.title}
                    onChange={(e) => handleUpdateCard(card.id, { title: e.target.value })}
                    placeholder="Card Title"
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-sm font-black text-white"
                  />

                  <textarea
                    rows={2}
                    value={card.description}
                    onChange={(e) => handleUpdateCard(card.id, { description: e.target.value })}
                    placeholder="Card description text..."
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-300"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-400">Button Label:</label>
                    <input
                      type="text"
                      value={card.buttonText}
                      onChange={(e) => handleUpdateCard(card.id, { buttonText: e.target.value })}
                      className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 text-xs text-white font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400">Button URL / Hash:</label>
                    <input
                      type="text"
                      value={card.buttonUrl}
                      onChange={(e) => handleUpdateCard(card.id, { buttonUrl: e.target.value })}
                      className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 text-xs text-white font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-400">Image/Icon URL (Optional):</label>
                    <input
                      type="text"
                      value={card.imageUrl || ''}
                      onChange={(e) => handleUpdateCard(card.id, { imageUrl: e.target.value })}
                      placeholder="https://..."
                      className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 text-xs text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400">Background Gradient:</label>
                    <select
                      value={card.bgGradient}
                      onChange={(e) => handleUpdateCard(card.id, { bgGradient: e.target.value })}
                      className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 text-xs text-slate-200"
                    >
                      {gradientOptions.map(g => (
                        <option key={g.value} value={g.value}>{g.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-slate-800">
                  <div>
                    <label className="text-[10px] text-slate-400">Card Width:</label>
                    <select
                      value={card.width || 'w-full'}
                      onChange={(e) => handleUpdateCard(card.id, { width: e.target.value })}
                      className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 text-xs text-white"
                    >
                      <option value="w-full">Full (w-full)</option>
                      <option value="w-1/2">Half (w-1/2)</option>
                      <option value="w-auto">Auto</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400">Card Height:</label>
                    <select
                      value={card.height || 'h-auto'}
                      onChange={(e) => handleUpdateCard(card.id, { height: e.target.value })}
                      className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 text-xs text-white"
                    >
                      <option value="h-auto">Auto</option>
                      <option value="min-h-[160px]">Compact (160px)</option>
                      <option value="min-h-[220px]">Standard (220px)</option>
                      <option value="min-h-[280px]">Tall (280px)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400">Card Padding:</label>
                    <select
                      value={card.padding || 'p-5 sm:p-6'}
                      onChange={(e) => handleUpdateCard(card.id, { padding: e.target.value })}
                      className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 text-xs text-white"
                    >
                      <option value="p-5 sm:p-6">Standard (p-5)</option>
                      <option value="p-3 sm:p-4">Compact (p-3)</option>
                      <option value="p-7 sm:p-8">Spacious (p-7)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400">Card Spacing:</label>
                    <select
                      value={card.spacing || 'space-y-4'}
                      onChange={(e) => handleUpdateCard(card.id, { spacing: e.target.value })}
                      className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 text-xs text-white"
                    >
                      <option value="space-y-4">Standard (space-y-4)</option>
                      <option value="space-y-2">Compact (space-y-2)</option>
                      <option value="space-y-6">Spacious (space-y-6)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-slate-800">
                  <div>
                    <label className="text-[10px] text-slate-400">Mobile Size:</label>
                    <select
                      value={card.mobileSize || 'standard'}
                      onChange={(e) => handleUpdateCard(card.id, { mobileSize: e.target.value as any })}
                      className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 text-xs text-white font-bold"
                    >
                      <option value="compact">Compact (Mobile)</option>
                      <option value="standard">Standard</option>
                      <option value="large">Large</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400">Desktop Size:</label>
                    <select
                      value={card.desktopSize || 'standard'}
                      onChange={(e) => handleUpdateCard(card.id, { desktopSize: e.target.value as any })}
                      className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 text-xs text-white font-bold"
                    >
                      <option value="compact">Compact</option>
                      <option value="standard">Standard</option>
                      <option value="large">Large</option>
                    </select>
                  </div>
                  <div className="flex items-center justify-between pt-3">
                    <label className="text-[10px] text-slate-300">Show Mobile:</label>
                    <input
                      type="checkbox"
                      checked={card.mobileVisible !== false}
                      onChange={(e) => handleUpdateCard(card.id, { mobileVisible: e.target.checked })}
                      className="rounded bg-slate-950 border-slate-700 text-emerald-500"
                    />
                  </div>
                  <div className="flex items-center justify-between pt-3">
                    <label className="text-[10px] text-slate-300">Show Desktop:</label>
                    <input
                      type="checkbox"
                      checked={card.desktopVisible !== false}
                      onChange={(e) => handleUpdateCard(card.id, { desktopVisible: e.target.checked })}
                      className="rounded bg-slate-950 border-slate-700 text-indigo-500"
                    />
                  </div>
                </div>

                {/* Card Mockup Mini Preview */}
                <div className={`p-3 rounded-xl bg-gradient-to-r ${card.bgGradient} text-white space-y-1`}>
                  <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-black/40 text-white">
                    {card.badge || 'CARD'}
                  </span>
                  <div className="text-xs font-bold">{card.title}</div>
                  <div className="text-[10px] text-white/80 line-clamp-1">{card.description}</div>
                </div>

              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: PROMOTIONAL DISCOUNT BANNERS */}
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-slate-800">
                  <div>
                    <label className="text-[10px] text-slate-400">Banner Image/Icon URL (Optional):</label>
                    <input
                      type="text"
                      value={promo.imageUrl || ''}
                      onChange={(e) => handleUpdatePromo(promo.id, { imageUrl: e.target.value })}
                      placeholder="https://..."
                      className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 text-xs text-white font-mono"
                    />
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-400">Mobile Size:</label>
                      <select
                        value={promo.mobileSize || 'standard'}
                        onChange={(e) => handleUpdatePromo(promo.id, { mobileSize: e.target.value as any })}
                        className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 text-xs text-white font-bold"
                      >
                        <option value="compact">Compact</option>
                        <option value="standard">Standard</option>
                        <option value="large">Large</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-400">Desktop Size:</label>
                      <select
                        value={promo.desktopSize || 'standard'}
                        onChange={(e) => handleUpdatePromo(promo.id, { desktopSize: e.target.value as any })}
                        className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 text-xs text-white font-bold"
                      >
                        <option value="compact">Compact</option>
                        <option value="standard">Standard</option>
                        <option value="large">Large</option>
                      </select>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <label className="text-[10px] text-slate-300">Mobile:</label>
                      <input
                        type="checkbox"
                        checked={promo.mobileVisible !== false}
                        onChange={(e) => handleUpdatePromo(promo.id, { mobileVisible: e.target.checked })}
                        className="rounded bg-slate-950 border-slate-700 text-emerald-500"
                      />
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <label className="text-[10px] text-slate-300">Desktop:</label>
                      <input
                        type="checkbox"
                        checked={promo.desktopVisible !== false}
                        onChange={(e) => handleUpdatePromo(promo.id, { desktopVisible: e.target.checked })}
                        className="rounded bg-slate-950 border-slate-700 text-indigo-500"
                      />
                    </div>
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
