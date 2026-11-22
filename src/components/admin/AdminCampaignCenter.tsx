import React, { useState, useMemo } from 'react';
import { 
  Advertisement, 
  AdPlacement, 
  AdStatus, 
  formatTimeRemaining
} from '../../types/ad';
import { 
  Megaphone, 
  Layers, 
  Calendar, 
  Clock, 
  Pause, 
  Play, 
  Eye, 
  MousePointer, 
  Sparkles, 
  Smartphone, 
  Send,
  Tag,
  Filter, 
  Search, 
  Edit3, 
  Gift
} from 'lucide-react';

interface AdminCampaignCenterProps {
  ads: Advertisement[];
  onUpdateAd: (updatedAd: Advertisement) => void;
  canManageCampaignOperations: boolean;
  canWaiveCampaignFee: boolean;
  canViewCampaignContactDetails: boolean;
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
  ads,
  onUpdateAd,
  canManageCampaignOperations,
  canWaiveCampaignFee,
  canViewCampaignContactDetails
}) => {
  const [expandedContactAdId, setExpandedContactAdId] = useState<string | null>(null);
  const [selectedPlacementFilter, setSelectedPlacementFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Date Range Edit Modal State
  const [editingDateAd, setEditingDateAd] = useState<Advertisement | null>(null);
  const [editStartDate, setEditStartDate] = useState<string>('');
  const [editEndDate, setEditEndDate] = useState<string>('');

  // Quick Action Handlers
  const handleTogglePause = (ad: Advertisement) => {
    if (!canManageCampaignOperations) return;
    // Only approved campaigns may be paused or resumed.
    // Pending/rejected campaigns must never be promoted by this quick action.
    if (ad.approvalStatus && ad.approvalStatus !== 'Approved') return;
    if (ad.status !== 'active' && ad.status !== 'paused') return;

    const newStatus: AdStatus = ad.status === 'active' ? 'paused' : 'active';
    onUpdateAd({
      ...ad,
      status: newStatus
    });
  };

  const handleOpenDateModal = (ad: Advertisement) => {
    if (!canManageCampaignOperations) return;
    setEditingDateAd(ad);
    setEditStartDate(ad.scheduledStartAt ? ad.scheduledStartAt.slice(0, 16).replace(' ', 'T') : new Date().toISOString().slice(0, 16));
    setEditEndDate(ad.scheduledEndAt ? ad.scheduledEndAt.slice(0, 16).replace(' ', 'T') : new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 16));
  };

  const handleSaveDateRange = () => {
    if (!canManageCampaignOperations || !editingDateAd) return;

    const startMs = new Date(editStartDate).getTime();
    const endMs = new Date(editEndDate).getTime();
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
      alert('Please enter a valid campaign start and end date.');
      return;
    }
    if (endMs <= startMs) {
      alert('Campaign end date and time must be later than the start date and time.');
      return;
    }

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
    if (!canWaiveCampaignFee) return;
    if (ad.paymentStatus === 'Exempt' && Number(ad.campaignCostPkr || 0) === 0) return;
    const confirmed = window.confirm(
      `Waive the campaign fee for "${ad.title}"? This will set its recorded campaign cost to PKR 0 and mark payment as Exempt.`
    );
    if (!confirmed) return;

    onUpdateAd({
      ...ad,
      paymentStatus: 'Exempt',
      campaignCostPkr: 0
    });
  };

  // Filtered Ads
  const filteredAds = useMemo(() => {
    return ads.filter((ad) => {
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
        if (selectedStatusFilter === 'rejected' && dynStatus !== 'Rejected') return false;
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
  }, [ads, selectedPlacementFilter, selectedStatusFilter, searchQuery]);

  const placementIcons: Record<AdPlacement, any> = {
    'top-header': Megaphone,
    'feed-inline': Layers,
    'popup-modal': Sparkles,
    'toast-float': Clock,
    'sidebar': Smartphone,
    'sms-broadcast': Send,
    'promo-discount-banner': Tag,
    'dynamic-announcement-card': Layers
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
              ● {ads.length} Total Campaigns ({ads.filter(a => getCampaignDynamicStatus(a) === 'Active').length} Live Now)
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Campaign Operations & Scheduling
          </h2>
          <p className="text-xs text-slate-300 max-w-2xl">
            Manage campaign operations: pause or resume approved campaigns, adjust start/end dates, and apply authorised fee waivers. Creative editing, approvals, rate settings and placement configuration are handled in Ad Hub.
          </p>
        </div>
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
            { id: 'pending', label: `⏳ Pending (${ads.filter(a => getCampaignDynamicStatus(a) === 'Pending Approval').length})` },
            { id: 'rejected', label: `Rejected (${ads.filter(a => getCampaignDynamicStatus(a) === 'Rejected').length})` }
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
                  {canManageCampaignOperations && <button
                    onClick={() => handleTogglePause(ad)}
                    disabled={
                      (ad.status !== 'active' && ad.status !== 'paused') ||
                      Boolean(ad.approvalStatus && ad.approvalStatus !== 'Approved')
                    }
                    className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    title={
                      ad.approvalStatus && ad.approvalStatus !== 'Approved'
                        ? 'Only approved campaigns can be paused or resumed'
                        : ad.status === 'active'
                        ? 'Pause Campaign'
                        : ad.status === 'paused'
                        ? 'Resume Campaign'
                        : 'Only active or paused campaigns can use this action'
                    }
                  >
                    {ad.status === 'active' ? <Pause className="w-3.5 h-3.5 text-amber-400" /> : <Play className="w-3.5 h-3.5 text-emerald-400" />}
                  </button>}
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
                  {canManageCampaignOperations && <button
                    onClick={() => handleOpenDateModal(ad)}
                    className="text-[10px] font-bold text-purple-400 hover:text-purple-300 flex items-center gap-1 cursor-pointer"
                  >
                    <Edit3 className="w-3 h-3" />
                    <span>Edit Dates</span>
                  </button>}
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
                  {canViewCampaignContactDetails && <button
                    onClick={() => setExpandedContactAdId((current) => current === ad.id ? null : ad.id)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-sky-300"
                    title={expandedContactAdId === ad.id ? 'Hide Advertiser Contact Details' : 'Show Advertiser Contact Details'}
                    aria-label={expandedContactAdId === ad.id ? 'Hide advertiser contact details' : 'Show advertiser contact details'}
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>}
                  {canWaiveCampaignFee && <button
                    onClick={() => handleMakeCampaignFree(ad)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-emerald-400"
                    title="Waive Campaign Fee"
                  >
                    <Gift className="w-3.5 h-3.5" />
                  </button>}
                </div>
              </div>

              {canViewCampaignContactDetails && expandedContactAdId === ad.id && (
                <div className="p-3 rounded-2xl bg-slate-950/70 border border-sky-500/20 space-y-1.5 text-xs">
                  <div className="text-[10px] font-black uppercase tracking-wider text-sky-300">Advertiser Contact Details · Admin Only</div>
                  <div className="text-slate-300">Name: <span className="text-white">{(ad as any).clientName || ad.submittedByUserName || 'Not provided'}</span></div>
                  <div className="text-slate-300">Email: <span className="text-white break-all">{(ad as any).clientEmail || ad.submittedByUserEmail || 'Not provided'}</span></div>
                  <div className="text-slate-300">Phone: <span className="text-white">{ad.submittedByUserPhone || 'Not provided'}</span></div>
                </div>
              )}

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
