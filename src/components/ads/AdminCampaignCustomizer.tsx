import React, { useState } from 'react';
import { 
  CampaignCustomizationConfig, 
  PortalPageConfig, 
  CampaignDurationPreset, 
  CampaignPlacementOption, 
  AdDurationUnit,
  AdPlacement,
  AdType,
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
  DollarSign
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
  const [localConfig, setLocalConfig] = useState<CampaignCustomizationConfig>(config);
  const [activeTab, setActiveTab] = useState<'pages' | 'durations' | 'placements' | 'rules'>('pages');
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  // New Page Modal State
  const [isAddPageModalOpen, setIsAddPageModalOpen] = useState(false);
  const [newPageId, setNewPageId] = useState('');
  const [newPageName, setNewPageName] = useState('');
  const [newPageDesc, setNewPageDesc] = useState('');
  const [newPageMultiplier, setNewPageMultiplier] = useState(1.0);
  const [newPageScheduleMode, setNewPageScheduleMode] = useState<'always_active' | 'time_window' | 'date_range'>('always_active');
  const [newPageTimeStart, setNewPageTimeStart] = useState('08:00');
  const [newPageTimeEnd, setNewPageTimeEnd] = useState('22:00');
  const [newPageDateStart, setNewPageDateStart] = useState(new Date().toISOString().slice(0, 10));
  const [newPageDateEnd, setNewPageDateEnd] = useState(new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10));

  // New Duration Preset Modal State
  const [isAddDurationModalOpen, setIsAddDurationModalOpen] = useState(false);
  const [newDurLabel, setNewDurLabel] = useState('');
  const [newDurSub, setNewDurSub] = useState('');
  const [newDurUnit, setNewDurUnit] = useState<AdDurationUnit>('days');
  const [newDurValue, setNewDurValue] = useState<number>(1);
  const [newDurDiscount, setNewDurDiscount] = useState<number>(0);
  const [newDurBadge, setNewDurBadge] = useState('');

  // Editing existing page state
  const [editingPageId, setEditingPageId] = useState<string | null>(null);

  // Save changes handler
  const handleSave = () => {
    onSaveConfig(localConfig);
    setSaveSuccessMessage('Campaign customization & page schedules saved successfully!');
    setTimeout(() => setSaveSuccessMessage(null), 3500);
  };

  // Reset handler
  const handleReset = () => {
    if (window.confirm('Reset all portal page schedules, duration presets, and campaign submission rules to platform defaults?')) {
      setLocalConfig(DEFAULT_CAMPAIGN_CUSTOMIZATION_CONFIG);
      onSaveConfig(DEFAULT_CAMPAIGN_CUSTOMIZATION_CONFIG);
      if (onResetDefaults) onResetDefaults();
      setSaveSuccessMessage('Reset to platform defaults successfully!');
      setTimeout(() => setSaveSuccessMessage(null), 3000);
    }
  };

  // Toggle page enable/disable
  const handleTogglePage = (pageId: string) => {
    setLocalConfig(prev => ({
      ...prev,
      portalPages: prev.portalPages.map(p => 
        p.id === pageId ? { ...p, isEnabled: !p.isEnabled } : p
      )
    }));
  };

  // Update specific page config
  const handleUpdatePage = (pageId: string, updates: Partial<PortalPageConfig>) => {
    setLocalConfig(prev => ({
      ...prev,
      portalPages: prev.portalPages.map(p => 
        p.id === pageId ? { ...p, ...updates } : p
      )
    }));
  };

  // Delete custom page
  const handleDeletePage = (pageId: string) => {
    if (['all', 'jobs', 'alerts', 'cv', 'dashboard'].includes(pageId)) {
      alert('Core portal system pages cannot be removed, but you can toggle them disabled.');
      return;
    }
    setLocalConfig(prev => ({
      ...prev,
      portalPages: prev.portalPages.filter(p => p.id !== pageId)
    }));
  };

  // Add new custom page
  const handleCreatePage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPageName.trim()) return;

    const generatedId = (newPageId.trim() || newPageName.toLowerCase().replace(/[^a-z0-9]/g, '-')).slice(0, 20);
    
    if (localConfig.portalPages.some(p => p.id === generatedId)) {
      alert('A portal page with this ID already exists. Please choose a unique identifier.');
      return;
    }

    const newPage: PortalPageConfig = {
      id: generatedId,
      name: newPageName.trim(),
      description: newPageDesc.trim() || `Target campaigns specifically for ${newPageName.trim()}`,
      routePath: `#${generatedId}`,
      isEnabled: true,
      multiplier: Number(newPageMultiplier) || 1.0,
      scheduleMode: newPageScheduleMode,
      activeTimeStart: newPageScheduleMode === 'time_window' ? newPageTimeStart : undefined,
      activeTimeEnd: newPageScheduleMode === 'time_window' ? newPageTimeEnd : undefined,
      activeDateStart: newPageScheduleMode === 'date_range' ? newPageDateStart : undefined,
      activeDateEnd: newPageScheduleMode === 'date_range' ? newPageDateEnd : undefined,
      minDurationHours: 6,
      maxDurationHours: 2160
    };

    setLocalConfig(prev => ({
      ...prev,
      portalPages: [...prev.portalPages, newPage]
    }));

    setIsAddPageModalOpen(false);
    setNewPageId('');
    setNewPageName('');
    setNewPageDesc('');
    setNewPageMultiplier(1.0);
  };

  // Toggle duration preset
  const handleToggleDuration = (durId: string) => {
    setLocalConfig(prev => ({
      ...prev,
      durationPresets: prev.durationPresets.map(d => 
        d.id === durId ? { ...d, isEnabled: !d.isEnabled } : d
      )
    }));
  };

  // Add new duration preset
  const handleCreateDuration = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDurLabel.trim()) return;

    const generatedId = 'dur-' + Date.now();
    const newPreset: CampaignDurationPreset = {
      id: generatedId,
      label: newDurLabel.trim(),
      subLabel: newDurSub.trim() || `${newDurValue} ${newDurUnit}`,
      unit: newDurUnit,
      value: Number(newDurValue) || 1,
      discountPercent: Number(newDurDiscount) || undefined,
      badge: newDurBadge.trim() || undefined,
      isEnabled: true
    };

    setLocalConfig(prev => ({
      ...prev,
      durationPresets: [...prev.durationPresets, newPreset]
    }));

    setIsAddDurationModalOpen(false);
    setNewDurLabel('');
    setNewDurSub('');
    setNewDurBadge('');
    setNewDurDiscount(0);
    setNewDurValue(1);
  };

  // Delete duration preset
  const handleDeleteDuration = (durId: string) => {
    setLocalConfig(prev => ({
      ...prev,
      durationPresets: prev.durationPresets.filter(d => d.id !== durId)
    }));
  };

  // Toggle placement
  const handleTogglePlacement = (placementId: AdPlacement) => {
    setLocalConfig(prev => ({
      ...prev,
      placementOptions: prev.placementOptions.map(p => 
        p.id === placementId ? { ...p, isEnabled: !p.isEnabled } : p
      )
    }));
  };

  // Update placement multiplier
  const handleUpdatePlacementMultiplier = (placementId: AdPlacement, mult: number) => {
    setLocalConfig(prev => ({
      ...prev,
      placementOptions: prev.placementOptions.map(p => 
        p.id === placementId ? { ...p, multiplier: Math.max(0.1, mult) } : p
      )
    }));
  };

  return (
    <div className="space-y-6 text-white">
      
      {/* Top Header Banner with Action Buttons */}
      <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-950 border border-indigo-500/40 rounded-3xl p-6 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl font-black text-white flex items-center space-x-2">
                <span>Campaign Customizer & Portal Page Scheduler</span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Admin Master Controller
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Customize, add, and edit options for campaign creation; schedule target portal pages with manual time frames and duration rules.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3 w-full md:w-auto justify-end">
          <button
            type="button"
            onClick={handleReset}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold border border-slate-700 flex items-center space-x-1.5 cursor-pointer transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs shadow-lg shadow-emerald-500/20 flex items-center space-x-1.5 cursor-pointer active:scale-95 transition-all"
          >
            <Save className="w-4 h-4" />
            <span>Save All Customizations</span>
          </button>
        </div>
      </div>

      {/* Success Notification Alert */}
      {saveSuccessMessage && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between text-xs text-emerald-300 animate-in fade-in duration-300">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{saveSuccessMessage}</span>
          </div>
          <button onClick={() => setSaveSuccessMessage(null)} className="text-emerald-400 hover:text-white p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-800 pb-3 overflow-x-auto text-xs font-bold">
        {[
          { id: 'pages', label: `Target Portal Pages & Schedules (${localConfig.portalPages.length})`, icon: Globe },
          { id: 'durations', label: `Timeframe & Duration Presets (${localConfig.durationPresets.length})`, icon: Clock },
          { id: 'placements', label: `Placement Formats & Multipliers (${localConfig.placementOptions.length})`, icon: Layers },
          { id: 'rules', label: 'Campaign Submission Rules & Policies', icon: ShieldCheck }
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-indigo-500 text-white font-extrabold shadow-lg shadow-indigo-500/20'
                  : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: TARGET PORTAL PAGES & SCHEDULE TIMEFRAME CONTROLLER */}
      {/* ========================================================================= */}
      {activeTab === 'pages' && (
        <div className="space-y-6">
          
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <div>
              <h4 className="text-sm font-black uppercase text-white flex items-center space-x-2">
                <span>Manage Target Portal Pages Availability</span>
              </h4>
              <p className="text-xs text-slate-400">
                Enable or disable ad spaces per portal page (e.g. Job Alerts, Explore Jobs feed, ATS CV Builder) and set manual time frames, daily hours, and custom duration limits.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsAddPageModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-black text-xs flex items-center space-x-1.5 shadow-lg shadow-indigo-500/20 cursor-pointer transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Custom Portal Page</span>
            </button>
          </div>

          {/* List of Portal Pages Config Cards */}
          <div className="grid grid-cols-1 gap-4">
            {localConfig.portalPages.map((page) => {
              const statusCheck = isPageScheduledActive(page);
              const isEditing = editingPageId === page.id;

              return (
                <div 
                  key={page.id}
                  className={`p-5 rounded-2xl border transition-all space-y-4 ${
                    page.isEnabled 
                      ? statusCheck.isActive
                        ? 'bg-slate-900/90 border-slate-800 hover:border-indigo-500/40'
                        : 'bg-amber-950/20 border-amber-500/30'
                      : 'bg-slate-950/60 border-slate-800/80 opacity-75'
                  }`}
                >
                  {/* Top Line: Name, Status Badge, Enable Switch, Edit Button */}
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-slate-800 pb-3">
                    <div className="flex items-center space-x-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm ${
                        page.isEnabled 
                          ? statusCheck.isActive ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-slate-800 text-slate-500'
                      }`}>
                        {page.id === 'alerts' && <Bell className="w-4 h-4" />}
                        {page.id === 'jobs' && <Briefcase className="w-4 h-4" />}
                        {page.id === 'cv' && <FileText className="w-4 h-4" />}
                        {page.id === 'dashboard' && <Users className="w-4 h-4" />}
                        {page.id === 'all' && <Globe className="w-4 h-4" />}
                        {page.id === 'detail-modal' && <Layers className="w-4 h-4" />}
                        {!['alerts', 'jobs', 'cv', 'dashboard', 'all', 'detail-modal'].includes(page.id) && <Tag className="w-4 h-4" />}
                      </div>

                      <div>
                        <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                          <h5 className="text-base font-black text-white">{page.name}</h5>
                          <span className="text-xs font-mono text-slate-500 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                            ID: {page.id}
                          </span>
                          
                          {/* Real-time Status Badge */}
                          {page.isEnabled ? (
                            statusCheck.isActive ? (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center space-x-1">
                                <Check className="w-3 h-3" />
                                <span>Active & Accepting Campaigns</span>
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center space-x-1">
                                <Clock className="w-3 h-3" />
                                <span>Outside Schedule ({statusCheck.reason})</span>
                              </span>
                            )
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center space-x-1">
                              <Lock className="w-3 h-3" />
                              <span>Disabled by Admin</span>
                            </span>
                          )}

                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                            Rate Multiplier: {page.multiplier}x
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">{page.description}</p>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center space-x-2 self-end md:self-auto">
                      <button
                        type="button"
                        onClick={() => setEditingPageId(isEditing ? null : page.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center space-x-1 ${
                          isEditing
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
                        }`}
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>{isEditing ? 'Close Schedule Editor' : 'Configure Time Frame & Duration'}</span>
                      </button>

                      {/* Enable/Disable Master Switch */}
                      <button
                        type="button"
                        onClick={() => handleTogglePage(page.id)}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                          page.isEnabled
                            ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-md shadow-emerald-500/10'
                            : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
                        }`}
                      >
                        {page.isEnabled ? 'ENABLED' : 'DISABLED'}
                      </button>

                      {!['all', 'jobs', 'alerts', 'cv', 'dashboard'].includes(page.id) && (
                        <button
                          type="button"
                          onClick={() => handleDeletePage(page.id)}
                          className="p-1.5 text-rose-400 hover:text-white hover:bg-rose-500/20 rounded-lg cursor-pointer transition-all"
                          title="Delete Custom Page"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Schedule Details Summary Strip */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-slate-950/80 p-3.5 rounded-xl border border-slate-800/80 font-mono text-slate-300">
                    <div>
                      <span className="text-slate-500 font-sans">Schedule Mode:</span>{' '}
                      <span className="text-indigo-400 font-bold">
                        {page.scheduleMode === 'always_active' && '24/7 Always Active'}
                        {page.scheduleMode === 'time_window' && `Daily Time Window (${page.activeTimeStart || '00:00'} - ${page.activeTimeEnd || '23:59'})`}
                        {page.scheduleMode === 'date_range' && `Date Range (${page.activeDateStart || 'Start'} to ${page.activeDateEnd || 'End'})`}
                        {page.scheduleMode === 'disabled' && 'Permanently Disabled'}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-500 font-sans">Duration Preference:</span>{' '}
                      <span className="text-white">
                        Min: {page.minDurationHours || 6}h • Max: {page.maxDurationHours ? `${Math.round(page.maxDurationHours / 24)}d` : '30d'}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-500 font-sans">Cost Multiplier:</span>{' '}
                      <span className="text-emerald-400 font-bold">{page.multiplier}x Base Rate</span>
                    </div>
                  </div>

                  {/* Expandable Schedule & Duration Settings Panel */}
                  {isEditing && (
                    <div className="p-4 bg-slate-950 border border-indigo-500/30 rounded-2xl space-y-4 animate-in fade-in duration-200">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                        <span className="text-xs font-black uppercase text-amber-300 flex items-center space-x-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Edit Schedule & Duration Preferences for "{page.name}"</span>
                        </span>
                        <span className="text-[11px] text-slate-500">Changes apply immediately to user campaign creation</span>
                      </div>

                      {/* 1. Schedule Mode Selection */}
                      <div className="space-y-2">
                        <label className="block text-xs font-bold text-slate-300">Schedule Activation Mode</label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          {[
                            { id: 'always_active', label: '24/7 Always Active', desc: 'Accept ads anytime without restriction' },
                            { id: 'time_window', label: 'Daily Time Window', desc: 'Active only between specific hours of the day' },
                            { id: 'date_range', label: 'Manual Date Range Window', desc: 'Active only between start and end dates' }
                          ].map((mode) => (
                            <button
                              key={mode.id}
                              type="button"
                              onClick={() => handleUpdatePage(page.id, { scheduleMode: mode.id as any })}
                              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                                page.scheduleMode === mode.id
                                  ? 'bg-indigo-500/20 border-indigo-500/50 text-white'
                                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                              }`}
                            >
                              <div className="text-xs font-bold">{mode.label}</div>
                              <div className="text-[10px] text-slate-500 mt-0.5">{mode.desc}</div>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* 2. Manual Time Window Inputs (If time_window selected) */}
                      {page.scheduleMode === 'time_window' && (
                        <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-bold text-slate-300 mb-1">Daily Start Time (HH:MM)</label>
                            <input
                              type="time"
                              value={page.activeTimeStart || '08:00'}
                              onChange={(e) => handleUpdatePage(page.id, { activeTimeStart: e.target.value })}
                              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-300 mb-1">Daily End Time (HH:MM)</label>
                            <input
                              type="time"
                              value={page.activeTimeEnd || '22:00'}
                              onChange={(e) => handleUpdatePage(page.id, { activeTimeEnd: e.target.value })}
                              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-mono"
                            />
                          </div>
                        </div>
                      )}

                      {/* 3. Manual Date Range Inputs (If date_range selected) */}
                      {page.scheduleMode === 'date_range' && (
                        <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-bold text-slate-300 mb-1">Active Start Date</label>
                            <input
                              type="date"
                              value={page.activeDateStart || new Date().toISOString().slice(0, 10)}
                              onChange={(e) => handleUpdatePage(page.id, { activeDateStart: e.target.value })}
                              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-300 mb-1">Active End Date</label>
                            <input
                              type="date"
                              value={page.activeDateEnd || new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10)}
                              onChange={(e) => handleUpdatePage(page.id, { activeDateEnd: e.target.value })}
                              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-mono"
                            />
                          </div>
                        </div>
                      )}

                      {/* 4. Duration and Pricing Modifiers */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-slate-300 mb-1">Page Rate Multiplier</label>
                          <input
                            type="number"
                            step="0.05"
                            min="0.1"
                            max="5.0"
                            value={page.multiplier}
                            onChange={(e) => handleUpdatePage(page.id, { multiplier: parseFloat(e.target.value) || 1.0 })}
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs font-mono"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-300 mb-1">Min Duration (Hours)</label>
                          <input
                            type="number"
                            min="1"
                            value={page.minDurationHours || 6}
                            onChange={(e) => handleUpdatePage(page.id, { minDurationHours: parseInt(e.target.value) || 1 })}
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs font-mono"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-300 mb-1">Max Duration (Hours)</label>
                          <input
                            type="number"
                            min="6"
                            value={page.maxDurationHours || 720}
                            onChange={(e) => handleUpdatePage(page.id, { maxDurationHours: parseInt(e.target.value) || 720 })}
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs font-mono"
                          />
                        </div>
                      </div>

                      {/* 5. Disabled / Restriction Reason Notice */}
                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1">Custom Notice / Restriction Reason for Users</label>
                        <input
                          type="text"
                          value={page.disabledReason || ''}
                          onChange={(e) => handleUpdatePage(page.id, { disabledReason: e.target.value })}
                          placeholder="e.g. This placement is reserved during the FPSC examination cycle."
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs"
                        />
                      </div>
                    </div>
                  )}

                </div>
              );
            })}
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: TIMEFRAME & DURATION PRESETS MANAGER */}
      {/* ========================================================================= */}
      {activeTab === 'durations' && (
        <div className="space-y-6">
          
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <div>
              <h4 className="text-sm font-black uppercase text-white flex items-center space-x-2">
                <span>Campaign Duration Presets & Timeframe Options</span>
              </h4>
              <p className="text-xs text-slate-400">
                Configure duration buttons shown to users during campaign creation (e.g. 6 Hours, 24 Hours, 1 Week, 1 Month, Custom).
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsAddDurationModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-black text-xs flex items-center space-x-1.5 shadow-lg shadow-indigo-500/20 cursor-pointer transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Custom Duration Preset</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {localConfig.durationPresets.map((dur) => (
              <div 
                key={dur.id}
                className={`p-4 rounded-2xl border transition-all space-y-3 ${
                  dur.isEnabled
                    ? 'bg-slate-900 border-slate-800 hover:border-indigo-500/40'
                    : 'bg-slate-950/60 border-slate-800/80 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-base font-black text-white">{dur.label}</span>
                    <div className="text-[11px] text-slate-400">{dur.subLabel}</div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggleDuration(dur.id)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer ${
                      dur.isEnabled ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {dur.isEnabled ? 'ACTIVE' : 'OFF'}
                  </button>
                </div>

                <div className="space-y-1 text-xs text-slate-300">
                  <div className="flex justify-between py-1 border-t border-slate-800">
                    <span className="text-slate-500">Duration Value:</span>
                    <span className="font-mono font-bold text-white">{dur.value} {dur.unit}</span>
                  </div>

                  {dur.discountPercent ? (
                    <div className="flex justify-between py-1 border-t border-slate-800 text-emerald-400">
                      <span>Discount:</span>
                      <span className="font-mono font-bold">{dur.discountPercent}% Off</span>
                    </div>
                  ) : null}

                  {dur.badge && (
                    <div className="pt-1">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        {dur.badge}
                      </span>
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-800 flex justify-end">
                  <button
                    type="button"
                    onClick={() => handleDeleteDuration(dur.id)}
                    className="text-slate-500 hover:text-rose-400 text-xs font-semibold p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: PLACEMENT FORMATS & MULTIPLIERS */}
      {/* ========================================================================= */}
      {activeTab === 'placements' && (
        <div className="space-y-6">
          
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-1">
            <h4 className="text-sm font-black uppercase text-white flex items-center space-x-2">
              <span>Placement Slot Formats & Rate Multipliers</span>
            </h4>
            <p className="text-xs text-slate-400">
              Control the rate cards, allowed mediums, and enable/disable specific placement slots across the portal.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {localConfig.placementOptions.map((placement) => (
              <div 
                key={placement.id}
                className={`p-5 rounded-2xl border space-y-4 ${
                  placement.isEnabled ? 'bg-slate-900 border-slate-800' : 'bg-slate-950/60 border-slate-800/80 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-3">
                  <div>
                    <div className="flex items-center space-x-2">
                      <h5 className="text-sm font-black text-white">{placement.name}</h5>
                      {placement.badge && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                          {placement.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{placement.description}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleTogglePlacement(placement.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                      placement.isEnabled ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {placement.isEnabled ? 'ENABLED' : 'DISABLED'}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Pricing Multiplier</label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="number"
                        step="0.05"
                        min="0.1"
                        max="5.0"
                        value={placement.multiplier}
                        onChange={(e) => handleUpdatePlacementMultiplier(placement.id, parseFloat(e.target.value) || 1.0)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono text-xs"
                      />
                      <span className="text-slate-400 font-bold">x</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Campaign Type</label>
                    <div className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-indigo-300 font-bold text-xs uppercase">
                      {placement.type} format
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: CAMPAIGN SUBMISSION RULES & POLICIES */}
      {/* ========================================================================= */}
      {activeTab === 'rules' && (
        <div className="space-y-6">
          
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
            <div className="border-b border-slate-800 pb-3">
              <h4 className="text-base font-black text-white flex items-center space-x-2">
                <ShieldCheck className="w-5 h-5 text-indigo-400" />
                <span>Campaign Approval & Publishing Guardrails</span>
              </h4>
              <p className="text-xs text-slate-400">
                Configure validation rules, review policies, and maximum timeframe limits for all self-serve campaigns.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              
              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="font-bold text-white">Require Admin Approval Workflow</div>
                  <div className="text-[11px] text-slate-400">Campaigns enter admin queue before going live</div>
                </div>
                <button
                  type="button"
                  onClick={() => setLocalConfig(prev => ({
                    ...prev,
                    formRules: { ...prev.formRules, requireAdminApproval: !prev.formRules.requireAdminApproval }
                  }))}
                  className={`px-3 py-1.5 rounded-lg font-bold text-[11px] cursor-pointer ${
                    localConfig.formRules.requireAdminApproval ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {localConfig.formRules.requireAdminApproval ? 'REQUIRED' : 'AUTO-PUBLISH'}
                </button>
              </div>

              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="font-bold text-white">Allow Custom Date Ranges</div>
                  <div className="text-[11px] text-slate-400">Users can pick custom start & end timeframes</div>
                </div>
                <button
                  type="button"
                  onClick={() => setLocalConfig(prev => ({
                    ...prev,
                    formRules: { ...prev.formRules, allowCustomDateRange: !prev.formRules.allowCustomDateRange }
                  }))}
                  className={`px-3 py-1.5 rounded-lg font-bold text-[11px] cursor-pointer ${
                    localConfig.formRules.allowCustomDateRange ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {localConfig.formRules.allowCustomDateRange ? 'ENABLED' : 'DISABLED'}
                </button>
              </div>

              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="font-bold text-white">Direct SMS Cellular Broadcasts</div>
                  <div className="text-[11px] text-slate-400">Allow users to schedule direct SMS alerts</div>
                </div>
                <button
                  type="button"
                  onClick={() => setLocalConfig(prev => ({
                    ...prev,
                    formRules: { ...prev.formRules, allowDirectSms: !prev.formRules.allowDirectSms }
                  }))}
                  className={`px-3 py-1.5 rounded-lg font-bold text-[11px] cursor-pointer ${
                    localConfig.formRules.allowDirectSms ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {localConfig.formRules.allowDirectSms ? 'ALLOWED' : 'BLOCKED'}
                </button>
              </div>

              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="font-bold text-white">Mandatory Image Graphic Upload</div>
                  <div className="text-[11px] text-slate-400">Enforce logo or banner image on all banners</div>
                </div>
                <button
                  type="button"
                  onClick={() => setLocalConfig(prev => ({
                    ...prev,
                    formRules: { ...prev.formRules, requireImage: !prev.formRules.requireImage }
                  }))}
                  className={`px-3 py-1.5 rounded-lg font-bold text-[11px] cursor-pointer ${
                    localConfig.formRules.requireImage ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {localConfig.formRules.requireImage ? 'MANDATORY' : 'OPTIONAL'}
                </button>
              </div>

            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD CUSTOM PORTAL PAGE */}
      {/* ========================================================================= */}
      {isAddPageModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
          <form onSubmit={handleCreatePage} className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-4 text-white shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h4 className="text-base font-black flex items-center space-x-2">
                <Globe className="w-5 h-5 text-indigo-400" />
                <span>Add Custom Portal Page for Campaigns</span>
              </h4>
              <button type="button" onClick={() => setIsAddPageModalOpen(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Portal Page Name *</label>
              <input
                type="text"
                required
                value={newPageName}
                onChange={(e) => setNewPageName(e.target.value)}
                placeholder="e.g. FPSC Exam Hub, Gulf Relocation Portal"
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Page ID / Slug</label>
              <input
                type="text"
                value={newPageId}
                onChange={(e) => setNewPageId(e.target.value)}
                placeholder="e.g. fpsc-exam-hub"
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Description</label>
              <input
                type="text"
                value={newPageDesc}
                onChange={(e) => setNewPageDesc(e.target.value)}
                placeholder="Target candidates browsing this specific section..."
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Price Multiplier</label>
                <input
                  type="number"
                  step="0.05"
                  value={newPageMultiplier}
                  onChange={(e) => setNewPageMultiplier(parseFloat(e.target.value) || 1.0)}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Schedule Mode</label>
                <select
                  value={newPageScheduleMode}
                  onChange={(e) => setNewPageScheduleMode(e.target.value as any)}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs"
                >
                  <option value="always_active">24/7 Always Active</option>
                  <option value="time_window">Daily Time Window</option>
                  <option value="date_range">Manual Date Range</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-black text-xs shadow-lg shadow-indigo-500/20 cursor-pointer transition-all"
            >
              Add Portal Page to Campaign Target List
            </button>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD DURATION PRESET */}
      {/* ========================================================================= */}
      {isAddDurationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
          <form onSubmit={handleCreateDuration} className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4 text-white shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h4 className="text-base font-black flex items-center space-x-2">
                <Clock className="w-5 h-5 text-emerald-400" />
                <span>Add Custom Duration Preset</span>
              </h4>
              <button type="button" onClick={() => setIsAddDurationModalOpen(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Button Label *</label>
              <input
                type="text"
                required
                value={newDurLabel}
                onChange={(e) => setNewDurLabel(e.target.value)}
                placeholder="e.g. 48 Hours (2 Days) or 3 Weeks"
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Time Unit</label>
                <select
                  value={newDurUnit}
                  onChange={(e) => setNewDurUnit(e.target.value as AdDurationUnit)}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs"
                >
                  <option value="hours">Hours</option>
                  <option value="days">Days</option>
                  <option value="weeks">Weeks</option>
                  <option value="months">Months</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Amount / Value</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={newDurValue}
                  onChange={(e) => setNewDurValue(parseInt(e.target.value) || 1)}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Discount % (Optional)</label>
                <input
                  type="number"
                  min="0"
                  max="90"
                  value={newDurDiscount}
                  onChange={(e) => setNewDurDiscount(parseInt(e.target.value) || 0)}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Badge Tag (Optional)</label>
                <input
                  type="text"
                  value={newDurBadge}
                  onChange={(e) => setNewDurBadge(e.target.value)}
                  placeholder="e.g. 🔥 Flash Promo"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-lg shadow-emerald-500/20 cursor-pointer transition-all"
            >
              Add Duration Preset to Form
            </button>
          </form>
        </div>
      )}

    </div>
  );
};
