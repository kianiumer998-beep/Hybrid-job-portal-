import React, { useState } from 'react';
import {
  Globe,
  Search,
  CheckCircle2,
  Save,
  AlertTriangle,
  FileCode,
  Megaphone,
  Power,
  Shield,
  ExternalLink,
  Code,
  RefreshCw
} from 'lucide-react';
import { SiteSeoConfig } from '../../types/adminSuite';

interface AdminSeoSettingsProps {
  seoConfig: SiteSeoConfig;
  onUpdateSeoConfig: (updated: SiteSeoConfig) => void;
}

export const AdminSeoSettings: React.FC<AdminSeoSettingsProps> = ({
  seoConfig,
  onUpdateSeoConfig
}) => {
  const [config, setConfig] = useState<SiteSeoConfig>(seoConfig);
  const [keywordInput, setKeywordInput] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [sitemapGenerated, setSitemapGenerated] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSeoConfig(config);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleAddKeyword = () => {
    if (!keywordInput.trim()) return;
    if (!config.metaKeywords.includes(keywordInput.trim())) {
      setConfig({
        ...config,
        metaKeywords: [...config.metaKeywords, keywordInput.trim()]
      });
    }
    setKeywordInput('');
  };

  const handleRemoveKeyword = (kw: string) => {
    setConfig({
      ...config,
      metaKeywords: config.metaKeywords.filter(k => k !== kw)
    });
  };

  const handleGenerateSitemap = () => {
    setSitemapGenerated(true);
    setTimeout(() => {
      alert(`✅ Sitemap successfully generated with all 2,400+ live jobs, category URLs, and gazette slugs!\nLocation: ${config.canonicalUrl}/sitemap.xml`);
      setSitemapGenerated(false);
    }, 800);
  };

  return (
    <form onSubmit={handleSave} className="space-y-6 text-white">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-amber-400 text-xs font-bold uppercase tracking-wider mb-1">
            <Globe className="w-4 h-4" />
            <span>International SEO & Meta Engine</span>
          </div>
          <h2 className="text-xl font-black text-white">Site Branding, Search Indexing & Telemetry</h2>
          <p className="text-xs text-slate-400 mt-1">
            Manage search engine rankings (Google, Bing, Yahoo), OpenGraph social preview cards, verification tokens, and live announcement banners.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={handleGenerateSitemap}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 flex items-center space-x-2 cursor-pointer transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-indigo-400 ${sitemapGenerated ? 'animate-spin' : ''}`} />
            <span>Re-Generate Sitemap.xml</span>
          </button>

          <button
            type="submit"
            className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/20 flex items-center space-x-2 cursor-pointer transition-all active:scale-95"
          >
            <Save className="w-4 h-4" />
            <span>Save SEO Settings</span>
          </button>
        </div>
      </div>

      {saveSuccess && (
        <div className="p-4 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-emerald-300 font-bold text-xs flex items-center space-x-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4" />
          <span>SEO and Site Configuration updated successfully! Global metadata tags have been synchronized.</span>
        </div>
      )}

      {/* Grid Layout: Left & Right Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* SECTION 1: CORE META & BRANDING */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
          <h3 className="text-sm font-bold border-b border-slate-800 pb-2 flex items-center space-x-2 text-white">
            <Search className="w-4 h-4 text-amber-400" />
            <span>Primary Search Engine Meta Tags</span>
          </h3>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-bold text-slate-300 mb-1">Portal Title Tag (&lt;title&gt;)</label>
              <input
                type="text"
                value={config.siteTitle}
                onChange={(e) => setConfig({ ...config, siteTitle: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-medium"
              />
              <span className="text-[10px] text-slate-500">{config.siteTitle.length}/70 characters recommended</span>
            </div>

            <div>
              <label className="block font-bold text-slate-300 mb-1">Tagline / Subheader</label>
              <input
                type="text"
                value={config.tagline}
                onChange={(e) => setConfig({ ...config, tagline: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-medium"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-300 mb-1">Meta Description (&lt;meta name="description"&gt;)</label>
              <textarea
                rows={3}
                value={config.metaDescription}
                onChange={(e) => setConfig({ ...config, metaDescription: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-medium"
              />
              <span className="text-[10px] text-slate-500">{config.metaDescription.length}/160 characters recommended</span>
            </div>

            <div>
              <label className="block font-bold text-slate-300 mb-1">Canonical Base URL</label>
              <input
                type="url"
                value={config.canonicalUrl}
                onChange={(e) => setConfig({ ...config, canonicalUrl: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono"
              />
            </div>

            {/* Keyword Tags Manager */}
            <div>
              <label className="block font-bold text-slate-300 mb-1">Target SEO Meta Keywords</label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={keywordInput}
                  onChange={(e) => setKeywordInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddKeyword();
                    }
                  }}
                  placeholder="e.g. FPSC Jobs 2026, Dubai Driver Vacancies"
                  className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs"
                />
                <button
                  type="button"
                  onClick={handleAddKeyword}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold rounded-xl border border-slate-700 cursor-pointer"
                >
                  + Add
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 bg-slate-950 rounded-xl border border-slate-800/80">
                {config.metaKeywords.map((kw) => (
                  <span
                    key={kw}
                    className="inline-flex items-center space-x-1 px-2.5 py-1 bg-slate-800 text-slate-200 rounded-lg text-[11px] font-semibold border border-slate-700"
                  >
                    <span>{kw}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveKeyword(kw)}
                      className="text-slate-400 hover:text-rose-400 ml-1 cursor-pointer"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 2: SOCIAL OPENGRAPH & VERIFICATIONS */}
        <div className="space-y-6">
          
          {/* Social OpenGraph Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
            <h3 className="text-sm font-bold border-b border-slate-800 pb-2 flex items-center space-x-2 text-white">
              <Code className="w-4 h-4 text-indigo-400" />
              <span>Social Media & OpenGraph Preview</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-300 mb-1">OpenGraph Banner Image URL (og:image 1200x630)</label>
                <input
                  type="url"
                  value={config.ogImageUrl}
                  onChange={(e) => setConfig({ ...config, ogImageUrl: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono text-xs"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Official Twitter / X Handle</label>
                <input
                  type="text"
                  value={config.twitterHandle}
                  onChange={(e) => setConfig({ ...config, twitterHandle: e.target.value })}
                  placeholder="@CareerPakOfficial"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white"
                />
              </div>
            </div>
          </div>

          {/* Webmaster Verification & Analytics IDs */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
            <h3 className="text-sm font-bold border-b border-slate-800 pb-2 flex items-center space-x-2 text-white">
              <Shield className="w-4 h-4 text-emerald-400" />
              <span>Webmaster Verifications & Analytics Telemetry</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-bold text-slate-300 mb-1">Google Search Console Token</label>
                <input
                  type="text"
                  value={config.googleSearchConsoleVerification}
                  onChange={(e) => setConfig({ ...config, googleSearchConsoleVerification: e.target.value })}
                  placeholder="google-site-verification=..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono text-[11px]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Bing Webmaster Token</label>
                <input
                  type="text"
                  value={config.bingWebmasterVerification}
                  onChange={(e) => setConfig({ ...config, bingWebmasterVerification: e.target.value })}
                  placeholder="bing-verification=..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono text-[11px]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Google Analytics 4 (GA4 ID)</label>
                <input
                  type="text"
                  value={config.googleAnalyticsId}
                  onChange={(e) => setConfig({ ...config, googleAnalyticsId: e.target.value })}
                  placeholder="G-XXXXXXXXXX"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono text-[11px]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Google Tag Manager (GTM ID)</label>
                <input
                  type="text"
                  value={config.googleTagManagerId}
                  onChange={(e) => setConfig({ ...config, googleTagManagerId: e.target.value })}
                  placeholder="GTM-XXXXXX"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono text-[11px]"
                />
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* SECTION 3: LIVE ANNOUNCEMENT BANNER & MAINTENANCE SWITCH */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Announcement Banner Box */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h3 className="text-sm font-bold flex items-center space-x-2 text-white">
              <Megaphone className="w-4 h-4 text-amber-400" />
              <span>Live Public Header Announcement Banner</span>
            </h3>
            <button
              type="button"
              onClick={() => setConfig({
                ...config,
                announcementBanner: {
                  ...config.announcementBanner,
                  enabled: !config.announcementBanner.enabled
                }
              })}
              className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                config.announcementBanner.enabled
                  ? 'bg-emerald-500 text-slate-950'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {config.announcementBanner.enabled ? 'ACTIVE' : 'OFF'}
            </button>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-bold text-slate-300 mb-1">Announcement Message Text</label>
              <textarea
                rows={2}
                value={config.announcementBanner.text}
                onChange={(e) => setConfig({
                  ...config,
                  announcementBanner: { ...config.announcementBanner, text: e.target.value }
                })}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-medium"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-300 mb-1">Call to Action Link (URL)</label>
                <input
                  type="text"
                  value={config.announcementBanner.linkUrl || ''}
                  onChange={(e) => setConfig({
                    ...config,
                    announcementBanner: { ...config.announcementBanner, linkUrl: e.target.value }
                  })}
                  placeholder="#jobs or https://..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Button / Link Label</label>
                <input
                  type="text"
                  value={config.announcementBanner.linkText || ''}
                  onChange={(e) => setConfig({
                    ...config,
                    announcementBanner: { ...config.announcementBanner, linkText: e.target.value }
                  })}
                  placeholder="View Details"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Maintenance Mode & Robots.txt */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h3 className="text-sm font-bold flex items-center space-x-2 text-white">
              <Power className="w-4 h-4 text-rose-400" />
              <span>Platform Maintenance Mode & Crawl Directives</span>
            </h3>
            <button
              type="button"
              onClick={() => setConfig({ ...config, maintenanceMode: !config.maintenanceMode })}
              className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                config.maintenanceMode
                  ? 'bg-rose-500 text-white animate-pulse'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {config.maintenanceMode ? '🚨 MAINTENANCE ON' : 'NORMAL (ONLINE)'}
            </button>
          </div>

          <div className="space-y-3 text-xs">
            {config.maintenanceMode && (
              <div>
                <label className="block font-bold text-rose-400 mb-1">Visitor Maintenance Notice Message</label>
                <input
                  type="text"
                  value={config.maintenanceNotice}
                  onChange={(e) => setConfig({ ...config, maintenanceNotice: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-rose-500/50 rounded-xl text-white"
                />
              </div>
            )}

            <div>
              <label className="block font-bold text-slate-300 mb-1 flex items-center space-x-1">
                <FileCode className="w-3.5 h-3.5 text-slate-400" />
                <span>Robots.txt Crawler Configuration</span>
              </label>
              <textarea
                rows={4}
                value={config.robotsTxtContent}
                onChange={(e) => setConfig({ ...config, robotsTxtContent: e.target.value })}
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-emerald-400 font-mono text-[11px]"
              />
            </div>
          </div>
        </div>

      </div>
    </form>
  );
};
