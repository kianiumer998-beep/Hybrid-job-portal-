import React, { useState, useMemo, useEffect } from 'react';
import { 
  Advertisement, 
  AdPlacement, 
  AdStatus, 
  CampaignCustomizationConfig,
  isAdCurrentlyRunning,
  formatTimeRemaining,
  DEFAULT_CAMPAIGN_CUSTOMIZATION_CONFIG,
  DEFAULT_PLACEMENT_OPTIONS
} from '../../types/ad';
import { 
  Megaphone, 
  Layers, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Pause, 
  Play, 
  Trash2, 
  Eye, 
  MousePointer, 
  Sparkles, 
  Smartphone, 
  Send, 
  Filter, 
  Plus, 
  Search, 
  Edit3, 
  RotateCcw,
  Check,
  AlertTriangle,
  Gift,
  Sliders,
  ArrowUp,
  ArrowDown
} from 'lucide-react';

interface AdminCampaignCenterProps {
  ads: Advertisement[];
  campaignConfig: CampaignCustomizationConfig;
  onUpdateCampaignConfig: (newConfig: CampaignCustomizationConfig) => void;
  onUpdateAd: (updatedAd: Advertisement) => void;
  onDeleteAd: (adId: string) => void;
  onResetAdMetrics: (adId: string) => void;
  onApproveAd?: (adId: string) => void;
  onRejectAd?: (adId: string, reason?: string) => void;
}

export type DynamicCampaignStatus = 'Active' | 'Scheduled' | 'Expired' | 'Pending Approval' | 'Paused' | 'Rejected';

export function getCampaignDynamicStatus(ad: Advertisement): DynamicCampaignStatus {
  if (ad.approvalStatus === 'Pending' || ad.status === 'pending_approval') {
    return 'Pending Approval';
  }
  if (ad.approvalStatus === 'Rejected' || ad.status === 'rejected') {
    return 'Rejected';
  }
  if (ad.status === 'paused') {
    return 'Paused';
  }

  const now = Date.now();
  if (ad.scheduledStartAt && ad.scheduledEndAt) {
    const startMs = new Date(ad.scheduledStartAt.replace(' ', 'T')).getTime();
    const endMs = new Date(ad.scheduledEndAt.replace(' ', 'T')).getTime();

    if (now < startMs) {
      return 'Scheduled';
    }
    if (now > endMs) {
      return 'Expired';
    }
  }

  return 'Active';
}

export const AdminCampaignCenter: React.FC<AdminCampaignCenterProps> = ({
  ads = [],
  campaignConfig = DEFAULT_CAMPAIGN_CUSTOMIZATION_CONFIG,
  onUpdateCampaignConfig,
  onUpdateAd,
  onDeleteAd,
  onResetAdMetrics,
  onApproveAd,
  onRejectAd
}) => {
  const safeAds = Array.isArray(ads) ? ads : [];
  const safePlacementOptions = Array.isArray(campaignConfig?.placementOptions) && campaignConfig.placementOptions.length > 0
    ? campaignConfig.placementOptions
    : DEFAULT_PLACEMENT_OPTIONS;

  const [selectedPlacementFilter, setSelectedPlacementFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Date Range Edit Modal State
  const [editingDateAd, setEditingDateAd] = useState<Advertisement | null>(null);
  const [editStartDate, setEditStartDate] = useState<string>('');
  const [editEndDate, setEditEndDate] = useState<string>('');

  // Job Feed & Inline Ads Settings State
  const initialDefaultPosts = campaignConfig?.jobFeedSettings?.defaultPostsPerPage ?? 10;
  const initialOptions = campaignConfig?.jobFeedSettings?.postsPerPageOptions ?? [10, 15, 20, 25, 50];
  const initialMaxAds = campaignConfig?.feedInlineSettings?.maxAdsPerPage ?? 3;

  const [feedDefaultPosts, setFeedDefaultPosts] = useState<number>(initialDefaultPosts);
  const [feedOptionsInput, setFeedOptionsInput] = useState<string>(initialOptions.join(', '));
  const [feedMaxAds, setFeedMaxAds] = useState<number>(initialMaxAds);
  const [feedInsertionMode, setFeedInsertionMode] = useState<'cadence' | 'custom_indices' | 'custom_pattern'>(
    campaignConfig?.feedInlineSettings?.insertionMode || 'custom_pattern'
  );
  const [feedCustomPattern, setFeedCustomPattern] = useState<{ jobsInterval: number; adCount: number }[]>(
    campaignConfig?.feedInlineSettings?.customPattern || [
      { jobsInterval: 1, adCount: 1 },
      { jobsInterval: 3, adCount: 1 },
      { jobsInterval: 2, adCount: 1 },
      { jobsInterval: 4, adCount: 2 }
    ]
  );
  const [feedSettingsMsg, setFeedSettingsMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleAddPatternEntry = () => {
    setFeedCustomPattern(prev => [...prev, { jobsInterval: 2, adCount: 1 }]);
  };

  const handleRemovePatternEntry = (index: number) => {
    setFeedCustomPattern(prev => prev.filter((_, i) => i !== index));
  };

  const handleMovePatternEntry = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= feedCustomPattern.length) return;
    const copy = [...feedCustomPattern];
    const temp = copy[index];
    copy[index] = copy[targetIdx];
    copy[targetIdx] = temp;
    setFeedCustomPattern(copy);
  };

  const handleUpdatePatternEntry = (index: number, field: 'jobsInterval' | 'adCount', val: number) => {
    setFeedCustomPattern(prev => prev.map((entry, i) => i === index ? { ...entry, [field]: Math.max(1, val) } : entry));
  };

  useEffect(() => {
    if (campaignConfig?.jobFeedSettings) {
      setFeedDefaultPosts(campaignConfig.jobFeedSettings.defaultPostsPerPage ?? 10);
      if (Array.isArray(campaignConfig.jobFeedSettings.postsPerPageOptions)) {
        setFeedOptionsInput(campaignConfig.jobFeedSettings.postsPerPageOptions.join(', '));
      }
    }
    if (campaignConfig?.feedInlineSettings?.maxAdsPerPage !== undefined) {
      setFeedMaxAds(campaignConfig.feedInlineSettings.maxAdsPerPage);
    }
    if (campaignConfig?.feedInlineSettings?.insertionMode) {
      setFeedInsertionMode(campaignConfig.feedInlineSettings.insertionMode);
    }
    if (Array.isArray(campaignConfig?.feedInlineSettings?.customPattern)) {
      setFeedCustomPattern(campaignConfig.feedInlineSettings.customPattern);
    }
  }, [campaignConfig]);

  const handleSaveFeedSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedSettingsMsg(null);

    const parsedOptions = feedOptionsInput
      .split(',')
      .map(s => parseInt(s.trim(), 10))
      .filter(n => !isNaN(n) && n > 0);
    
    const uniqueOptions = Array.from(new Set(parsedOptions)).sort((a, b) => a - b);

    if (uniqueOptions.length === 0) {
      setFeedSettingsMsg({
        type: 'error',
        text: 'Please enter at least one valid positive integer for allowed options (e.g. 10, 15, 20).'
      });
      return;
    }

    const def = parseInt(String(feedDefaultPosts), 10);
    if (isNaN(def) || def <= 0) {
      setFeedSettingsMsg({
        type: 'error',
        text: 'Default jobs per page must be a positive integer.'
      });
      return;
    }

    if (!uniqueOptions.includes(def)) {
      setFeedSettingsMsg({
        type: 'error',
        text: `Default jobs per page (${def}) must be one of the allowed options [${uniqueOptions.join(', ')}].`
      });
      return;
    }

    const maxAds = parseInt(String(feedMaxAds), 10);
    if (isNaN(maxAds) || maxAds < 0) {
      setFeedSettingsMsg({
        type: 'error',
        text: 'Maximum inline ads per page must be a non-negative integer.'
      });
      return;
    }

    const updatedConfig: CampaignCustomizationConfig = {
      ...(campaignConfig || DEFAULT_CAMPAIGN_CUSTOMIZATION_CONFIG),
      jobFeedSettings: {
        defaultPostsPerPage: def,
        postsPerPageOptions: uniqueOptions
      },
      feedInlineSettings: {
        ...(campaignConfig?.feedInlineSettings || DEFAULT_CAMPAIGN_CUSTOMIZATION_CONFIG.feedInlineSettings),
        maxAdsPerPage: maxAds,
        insertionMode: feedInsertionMode,
        customPattern: feedCustomPattern
      }
    };

    onUpdateCampaignConfig(updatedConfig);
    setFeedOptionsInput(uniqueOptions.join(', '));
    setFeedSettingsMsg({
      type: 'success',
      text: 'Job feed and inline ad settings saved successfully!'
    });
    setTimeout(() => setFeedSettingsMsg(null), 4000);
  };

  // Placement Toggles
  const handleTogglePlacement = (placementId: AdPlacement) => {
    const updatedOptions = safePlacementOptions.map((opt) =>
      opt.id === placementId ? { ...opt, isEnabled: !opt.isEnabled } : opt
    );
    onUpdateCampaignConfig({
      ...(campaignConfig || DEFAULT_CAMPAIGN_CUSTOMIZATION_CONFIG),
      placementOptions: updatedOptions
    });
  };

  // Quick Action Handlers
  const handleTogglePause = (ad: Advertisement) => {
    const newStatus: AdStatus = ad.status === 'active' ? 'paused' : 'active';
    onUpdateAd({
      ...ad,
      status: newStatus
    });
  };

  const handleOpenDateModal = (ad: Advertisement) => {
    setEditingDateAd(ad);
    setEditStartDate(ad.scheduledStartAt ? ad.scheduledStartAt.slice(0, 16).replace(' ', 'T') : new Date().toISOString().slice(0, 16));
    setEditEndDate(ad.scheduledEndAt ? ad.scheduledEndAt.slice(0, 16).replace(' ', 'T') : new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 16));
  };

  const handleSaveDateRange = () => {
    if (!editingDateAd) return;
    const cleanStart = editStartDate.replace('T', ' ');
    const cleanEnd = editEndDate.replace('T', ' ');
    onUpdateAd({
      ...editingDateAd,
      scheduledStartAt: cleanStart,
      scheduledEndAt: cleanEnd
    });
    setEditingDateAd(null);
  };

  const handleMakeCampaignFree = (ad: Advertisement) => {
    onUpdateAd({
      ...ad,
      paymentStatus: 'Exempt',
      campaignCostPkr: 0
    });
  };

  // Filtered Ads
  const filteredAds = useMemo(() => {
    return safeAds.filter((ad) => {
      if (selectedPlacementFilter !== 'all' && ad.placement !== selectedPlacementFilter) {
        return false;
      }

      const dynStatus = getCampaignDynamicStatus(ad);
      if (selectedStatusFilter !== 'all') {
        if (selectedStatusFilter === 'active' && dynStatus !== 'Active') return false;
        if (selectedStatusFilter === 'scheduled' && dynStatus !== 'Scheduled') return false;
        if (selectedStatusFilter === 'expired' && dynStatus !== 'Expired') return false;
        if (selectedStatusFilter === 'pending' && dynStatus !== 'Pending Approval') return false;
        if (selectedStatusFilter === 'paused' && dynStatus !== 'Paused') return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = ad.title.toLowerCase().includes(q);
        const matchesHeadline = ad.headline.toLowerCase().includes(q);
        const matchesUser = ad.submittedByUserName && ad.submittedByUserName.toLowerCase().includes(q);
        const matchesEmail = ad.submittedByUserEmail && ad.submittedByUserEmail.toLowerCase().includes(q);
        return matchesTitle || matchesHeadline || matchesUser || matchesEmail;
      }

      return true;
    });
  }, [safeAds, selectedPlacementFilter, selectedStatusFilter, searchQuery]);

  const placementIcons: Record<AdPlacement, any> = {
    'top-header': Megaphone,
    'feed-inline': Layers,
    'popup-modal': Sparkles,
    'toast-float': Clock,
    'sidebar': Smartphone,
    'sms-broadcast': Send
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner / Visual Command Hub */}
      <div className="bg-gradient-to-r from-purple-950/80 via-slate-900 to-indigo-950/80 border border-purple-500/30 rounded-3xl p-6 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="text-purple-400 text-xs font-black uppercase tracking-wider bg-purple-500/10 px-2.5 py-1 rounded-full border border-purple-500/20 flex items-center gap-1.5">
              <Megaphone className="w-3.5 h-3.5" />
              Visual Advertisement & Campaign Command Center
            </span>
            <span className="text-emerald-400 text-xs font-bold font-mono">
              ● {safeAds.length} Total Campaigns ({safeAds.filter(a => getCampaignDynamicStatus(a) === 'Active').length} Live Now)
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Campaign Center, Granular Date Ranges & Placement Toggles
          </h2>
          <p className="text-xs text-slate-300 max-w-2xl">
            Visually manage all client and admin advertisements with real-time status indicators (Scheduled, Active, Expired) and granular start/end date controls.
          </p>
        </div>
      </div>

      {/* PLACEMENT MASTER TOGGLES BAR */}
      <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black uppercase tracking-wider text-slate-400">
            Ad Placements Master Toggles (Enable / Disable Across Portal):
          </span>
          <span className="text-xs text-slate-400">
            Instant live switches for each channel
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {safePlacementOptions.map((opt) => {
            const Icon = placementIcons[opt.id] || Megaphone;
            return (
              <button
                key={opt.id}
                onClick={() => handleTogglePlacement(opt.id)}
                className={`p-3.5 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                  opt.isEnabled
                    ? 'bg-purple-950/30 border-purple-500/40 text-white shadow-lg shadow-purple-500/5'
                    : 'bg-slate-950/40 border-slate-800 text-slate-500 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-2">
                  <div className={`p-2 rounded-xl ${opt.isEnabled ? 'bg-purple-500/20 text-purple-300' : 'bg-slate-800 text-slate-500'}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase ${
                    opt.isEnabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-500'
                  }`}>
                    {opt.isEnabled ? 'ON' : 'OFF'}
                  </span>
                </div>
                <div className="text-xs font-black truncate">{opt.name.split(' ')[0]}</div>
                <div className="text-[10px] text-slate-400 line-clamp-1">{opt.type}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* JOB FEED & INLINE ADS SETTINGS */}
      <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-800/80 pb-3">
          <div className="flex items-center space-x-2">
            <Sliders className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-black uppercase tracking-wider text-slate-300">
              Job Feed & Inline Ads Settings
            </span>
          </div>
          <span className="text-[11px] text-slate-400">
            Configure pagination sizes and inline sponsored ad frequency
          </span>
        </div>

        <form onSubmit={handleSaveFeedSettings} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Default Jobs per Page
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={feedDefaultPosts}
                onChange={(e) => setFeedDefaultPosts(parseInt(e.target.value, 10) || 0)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                placeholder="e.g. 10"
                required
              />
              <span className="text-[10px] text-slate-500 mt-1 block">Initial page size for visitors</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Allowed Options (comma-separated)
              </label>
              <input
                type="text"
                value={feedOptionsInput}
                onChange={(e) => setFeedOptionsInput(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                placeholder="e.g. 10, 15, 20, 25, 50"
                required
              />
              <span className="text-[10px] text-slate-500 mt-1 block">Must include default jobs per page</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Max Inline Ads per Page
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={feedMaxAds}
                onChange={(e) => setFeedMaxAds(parseInt(e.target.value, 10) || 0)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                placeholder="e.g. 3"
                required
              />
              <span className="text-[10px] text-slate-500 mt-1 block">Limits sponsored insertions per page</span>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800/80 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <label className="block text-xs font-semibold text-slate-300">
                Ad Insertion Mode & Custom Sequence Pattern
              </label>
              <div className="flex items-center space-x-2">
                {[
                  { id: 'cadence', label: 'Cadence (Every N)' },
                  { id: 'custom_indices', label: 'Specific Indices' },
                  { id: 'custom_pattern', label: 'Custom Pattern Sequence' }
                ].map(mode => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => setFeedInsertionMode(mode.id as any)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                      feedInsertionMode === mode.id
                        ? 'bg-emerald-600 text-slate-950 shadow-sm'
                        : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>

            {feedInsertionMode === 'custom_pattern' && (
              <div className="space-y-2.5 bg-slate-950/60 p-3 rounded-2xl border border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 font-medium">
                    Configure custom insertion intervals and ad counts (e.g. after X jobs, insert Y ads):
                  </span>
                  <button
                    type="button"
                    onClick={handleAddPatternEntry}
                    className="px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center space-x-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Sequence Step</span>
                  </button>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {feedCustomPattern.map((entry, idx) => (
                    <div key={idx} className="flex items-center space-x-2 bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                      <span className="text-[10px] font-mono text-slate-400 w-6">#{idx + 1}</span>
                      <div className="flex-1 flex items-center space-x-2">
                        <div className="flex-1">
                          <label className="text-[10px] text-slate-400 block mb-0.5">Jobs Interval</label>
                          <input
                            type="number"
                            min="1"
                            value={entry.jobsInterval}
                            onChange={(e) => handleUpdatePatternEntry(idx, 'jobsInterval', parseInt(e.target.value, 10) || 1)}
                            className="w-full px-2.5 py-1 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs font-mono"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="text-[10px] text-slate-400 block mb-0.5">Ad Count (Ads together)</label>
                          <input
                            type="number"
                            min="1"
                            value={entry.adCount}
                            onChange={(e) => handleUpdatePatternEntry(idx, 'adCount', parseInt(e.target.value, 10) || 1)}
                            className="w-full px-2.5 py-1 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs font-mono"
                          />
                        </div>
                      </div>

                      <div className="flex items-center space-x-1 pt-4">
                        <button
                          type="button"
                          onClick={() => handleMovePatternEntry(idx, 'up')}
                          disabled={idx === 0}
                          className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded disabled:opacity-30 cursor-pointer"
                          title="Move Up"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMovePatternEntry(idx, 'down')}
                          disabled={idx === feedCustomPattern.length - 1}
                          className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded disabled:opacity-30 cursor-pointer"
                          title="Move Down"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemovePatternEntry(idx)}
                          className="p-1 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-500/30 rounded cursor-pointer ml-1"
                          title="Remove Step"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {feedCustomPattern.length === 0 && (
                    <div className="text-center py-4 text-xs text-slate-500">
                      No custom pattern steps defined. Click "Add Sequence Step" above.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {feedSettingsMsg && (
            <div className={`p-2.5 rounded-xl text-xs flex items-center space-x-2 font-medium ${
              feedSettingsMsg.type === 'success'
                ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-500/30'
                : 'bg-rose-950/40 text-rose-300 border border-rose-500/30'
            }`}>
              {feedSettingsMsg.type === 'success' ? <Check className="w-3.5 h-3.5 shrink-0" /> : <AlertTriangle className="w-3.5 h-3.5 shrink-0" />}
              <span>{feedSettingsMsg.text}</span>
            </div>
          )}

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs rounded-xl transition-all shadow-md shadow-emerald-600/20 cursor-pointer flex items-center space-x-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Save Feed Settings</span>
            </button>
          </div>
        </form>
      </div>

      {/* FILTER & SEARCH COMMAND BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
        
        {/* Status Filter Pills */}
        <div className="flex items-center space-x-1.5 overflow-x-auto text-xs font-bold scrollbar-thin">
          {[
            { id: 'all', label: `All (${ads.length})` },
            { id: 'active', label: `🟢 Active (${ads.filter(a => getCampaignDynamicStatus(a) === 'Active').length})` },
            { id: 'scheduled', label: `🟡 Scheduled (${ads.filter(a => getCampaignDynamicStatus(a) === 'Scheduled').length})` },
            { id: 'expired', label: `🔴 Expired (${ads.filter(a => getCampaignDynamicStatus(a) === 'Expired').length})` },
            { id: 'pending', label: `⏳ Pending (${ads.filter(a => getCampaignDynamicStatus(a) === 'Pending Approval').length})` }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                selectedStatusFilter === tab.id
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Input & Placement Filter */}
        <div className="flex items-center space-x-2">
          <select
            value={selectedPlacementFilter}
            onChange={(e) => setSelectedPlacementFilter(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
          >
            <option value="all">All Placements</option>
            <option value="top-header">Top Header Banner</option>
            <option value="feed-inline">Native Feed Card</option>
            <option value="popup-modal">Popup Lightbox</option>
            <option value="toast-float">Toast Notification</option>
            <option value="sidebar">Sidebar Widget</option>
            <option value="sms-broadcast">SMS Broadcast</option>
          </select>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search campaigns..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 w-44 sm:w-56"
            />
          </div>
        </div>
      </div>

      {/* VISUAL CARDS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredAds.map((ad) => {
          const dynStatus = getCampaignDynamicStatus(ad);
          const Icon = placementIcons[ad.placement] || Megaphone;

          const statusColors: Record<DynamicCampaignStatus, { badge: string; border: string }> = {
            'Active': { badge: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', border: 'border-emerald-500/30' },
            'Scheduled': { badge: 'bg-amber-500/20 text-amber-400 border-amber-500/30', border: 'border-amber-500/30' },
            'Expired': { badge: 'bg-rose-500/20 text-rose-400 border-rose-500/30', border: 'border-slate-800' },
            'Pending Approval': { badge: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30', border: 'border-indigo-500/30' },
            'Paused': { badge: 'bg-slate-700 text-slate-300 border-slate-600', border: 'border-slate-800' },
            'Rejected': { badge: 'bg-rose-950 text-rose-300 border-rose-800', border: 'border-rose-900/40' }
          };

          const currentTheme = statusColors[dynStatus] || statusColors['Active'];

          return (
            <div
              key={ad.id}
              className={`p-5 rounded-3xl bg-slate-900 border ${currentTheme.border} shadow-xl flex flex-col justify-between space-y-4 relative group hover:border-purple-500/40 transition-all`}
            >
              
              {/* Top Meta Bar */}
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${currentTheme.badge}`}>
                      ● {dynStatus}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 flex items-center gap-1">
                      <Icon className="w-3 h-3" />
                      <span>{ad.placement}</span>
                    </span>
                  </div>
                  <h4 className="text-base font-black text-white tracking-tight line-clamp-1">{ad.title}</h4>
                </div>

                <div className="flex items-center space-x-1 shrink-0">
                  <button
                    onClick={() => handleTogglePause(ad)}
                    className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all"
                    title={ad.status === 'active' ? 'Pause Campaign' : 'Resume Campaign'}
                  >
                    {ad.status === 'active' ? <Pause className="w-3.5 h-3.5 text-amber-400" /> : <Play className="w-3.5 h-3.5 text-emerald-400" />}
                  </button>
                  <button
                    onClick={() => onDeleteAd(ad.id)}
                    className="p-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 transition-all cursor-pointer"
                    title="Delete Campaign"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Live Card Mockup Box */}
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    {ad.badgeText || 'Sponsored'}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    {ad.targetPages.join(', ')}
                  </span>
                </div>
                <div className="text-xs font-black text-white line-clamp-1">{ad.headline}</div>
                <div className="text-[11px] text-slate-400 line-clamp-2">{ad.bodyText}</div>
                {ad.ctaText && (
                  <div className="text-right">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white text-slate-950">
                      {ad.ctaText} →
                    </span>
                  </div>
                )}
              </div>

              {/* GRANULAR DATE RANGE & TIME REMAINING */}
              <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-[10px] font-black uppercase flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-purple-400" />
                    Granular Date Window
                  </span>
                  <button
                    onClick={() => handleOpenDateModal(ad)}
                    className="text-[10px] font-bold text-purple-400 hover:text-purple-300 flex items-center gap-1 cursor-pointer"
                  >
                    <Edit3 className="w-3 h-3" />
                    <span>Edit Dates</span>
                  </button>
                </div>

                <div className="font-mono text-[11px] text-slate-200 font-bold">
                  {ad.scheduledStartAt ? ad.scheduledStartAt.slice(0, 16) : 'Immediate'} ➔ {ad.scheduledEndAt ? ad.scheduledEndAt.slice(0, 16) : 'Ongoing'}
                </div>

                <div className="text-[10px] text-slate-400 flex items-center justify-between">
                  <span>Status Note:</span>
                  <span className="text-amber-400 font-medium">{formatTimeRemaining(ad.scheduledEndAt)}</span>
                </div>
              </div>

              {/* Metrics & Advertiser Info Bar */}
              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                <div className="flex items-center space-x-3 text-slate-400 font-mono text-[11px]">
                  <span className="flex items-center gap-1" title="Impressions">
                    <Eye className="w-3 h-3 text-indigo-400" />
                    <span>{ad.impressions}</span>
                  </span>
                  <span className="flex items-center gap-1" title="Clicks">
                    <MousePointer className="w-3 h-3 text-emerald-400" />
                    <span>{ad.clicks}</span>
                  </span>
                  <span className="text-purple-400 font-bold" title="Click-Through Rate (CTR)">
                    {ad.impressions > 0 ? `${((ad.clicks / ad.impressions) * 100).toFixed(1)}%` : '0.0%'}
                  </span>
                </div>

                <div className="flex items-center space-x-1.5">
                  {ad.approvalStatus === 'Pending' && onApproveAd && (
                    <button
                      onClick={() => onApproveAd(ad.id)}
                      className="px-2.5 py-1 rounded-lg bg-emerald-500 text-slate-950 text-[10px] font-black hover:bg-emerald-400 cursor-pointer"
                    >
                      Approve
                    </button>
                  )}
                  {ad.approvalStatus === 'Pending' && onRejectAd && (
                    <button
                      onClick={() => onRejectAd(ad.id, 'Admin Policy')}
                      className="px-2 py-1 rounded-lg bg-rose-500/20 text-rose-300 text-[10px] font-bold hover:bg-rose-500/30 cursor-pointer"
                    >
                      Reject
                    </button>
                  )}
                  <button
                    onClick={() => handleMakeCampaignFree(ad)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-emerald-400"
                    title="Waive Campaign Fee"
                  >
                    <Gift className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onResetAdMetrics(ad.id)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
                    title="Reset Analytics"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

            </div>
          );
        })}
      </div>

      {filteredAds.length === 0 && (
        <div className="p-12 rounded-3xl bg-slate-900 border border-slate-800 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center mx-auto">
            <Megaphone className="w-6 h-6" />
          </div>
          <h3 className="text-base font-black text-white">No Matching Campaigns Found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Try adjusting your status filter or placement channel in the command bar above.
          </p>
        </div>
      )}

      {/* GRANULAR DATE RANGE EDIT MODAL */}
      {editingDateAd && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-purple-400" />
                <span>Configure Granular Campaign Date Range</span>
              </h3>
              <button
                onClick={() => setEditingDateAd(null)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="text-xs text-slate-400">
              Editing scheduling window for: <span className="font-bold text-white">{editingDateAd.title}</span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-400">Granular Start Date & Time:</label>
                <input
                  type="datetime-local"
                  value={editStartDate}
                  onChange={(e) => setEditStartDate(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-xs focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400">Granular End Date & Time:</label>
                <input
                  type="datetime-local"
                  value={editEndDate}
                  onChange={(e) => setEditEndDate(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-xs focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                onClick={() => setEditingDateAd(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveDateRange}
                className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black text-xs shadow-lg shadow-purple-600/30"
              >
                Save Schedule
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
