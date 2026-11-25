import React, { useState, useMemo } from 'react';
import {
  Advertisement,
  AdPlacement,
  AdStatus,
  AdType,
  AdTargetPage,
  AdTheme,
  AdDurationUnit,
  AdPricingConfig,
  DEFAULT_AD_PRICING_CONFIG,
  CampaignCustomizationConfig,
  DEFAULT_CAMPAIGN_CUSTOMIZATION_CONFIG,
  calculateCampaignCost,
  getPlacementDisplayName,
  getPageDisplayName,
  formatTimeRemaining
} from '../../types/ad';
import { CampaignLiveContextPreview } from '../ads/CampaignLiveContextPreview';
import { api } from '../../services/api';
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
  Search,
  Edit3,
  Gift,
  Plus,
  Trash2,
  RefreshCw,
  Check,
  CheckCircle2,
  X,
  XCircle,
  FileText,
  Image as ImageIcon,
  Upload,
  Monitor,
  Bell,
  AlertTriangle
} from 'lucide-react';

interface AdminCampaignCenterProps {
  ads: Advertisement[];
  onAddAd?: (ad: Advertisement) => void;
  onUpdateAd: (updatedAd: Advertisement) => void;
  onDeleteAd?: (adId: string) => void;
  onResetAdMetrics?: (adId?: string) => void;
  onApproveAd?: (adId: string) => void;
  onRejectAd?: (adId: string, reason: string) => void;
  pricingConfig?: AdPricingConfig;
  campaignConfig?: CampaignCustomizationConfig;
  canManageCampaignOperations: boolean;
  canWaiveCampaignFee: boolean;
  canViewCampaignContactDetails: boolean;
}

export type DynamicCampaignStatus =
  | 'Active'
  | 'Scheduled'
  | 'Expired'
  | 'Pending Approval'
  | 'Paused'
  | 'Rejected';

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

    if (Number.isFinite(startMs) && now < startMs) {
      return 'Scheduled';
    }
    if (Number.isFinite(endMs) && now > endMs) {
      return 'Expired';
    }
  }

  return 'Active';
}

export const AdminCampaignCenter: React.FC<AdminCampaignCenterProps> = ({
  ads,
  onAddAd,
  onUpdateAd,
  onDeleteAd,
  onResetAdMetrics,
  onApproveAd,
  onRejectAd,
  pricingConfig = DEFAULT_AD_PRICING_CONFIG,
  campaignConfig = DEFAULT_CAMPAIGN_CUSTOMIZATION_CONFIG,
  canManageCampaignOperations,
  canWaiveCampaignFee,
  canViewCampaignContactDetails
}) => {
  // Filters
  const [expandedContactAdId, setExpandedContactAdId] = useState<string | null>(null);
  const [selectedPlacementFilter, setSelectedPlacementFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('all');
  const [selectedPageFilter, setSelectedPageFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Date Range Edit Modal State
  const [editingDateAd, setEditingDateAd] = useState<Advertisement | null>(null);
  const [editStartDate, setEditStartDate] = useState<string>('');
  const [editEndDate, setEditEndDate] = useState<string>('');

  // View Details & Submitter Profile Modal State
  const [detailsAd, setDetailsAd] = useState<Advertisement | null>(null);
  const [submitterProfile, setSubmitterProfile] = useState<any>(null);
  const [isSubmitterProfileLoading, setIsSubmitterProfileLoading] = useState(false);

  // Live Simulator Preview Modal State
  const [previewAd, setPreviewAd] = useState<Advertisement | null>(null);

  // Reject with Notification Modal State
  const [rejectingAd, setRejectingAd] = useState<Advertisement | null>(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState<string>(
    'Creative image resolution is too low and does not meet portal quality guidelines.'
  );
  const [customRejectionReason, setCustomRejectionReason] = useState<string>('');

  // Create / Edit Campaign Modal State
  const [isEditorOpen, setIsEditorOpen] = useState<boolean>(false);
  const [editingAd, setEditingAd] = useState<Advertisement | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formType, setFormType] = useState<AdType>('banner');
  const [formTargetPages, setFormTargetPages] = useState<AdTargetPage[]>(['all']);
  const [formPlacement, setFormPlacement] = useState<AdPlacement>('top-header');
  const [formStatus, setFormStatus] = useState<AdStatus>('active');
  const [formHeadline, setFormHeadline] = useState('');
  const [formBodyText, setFormBodyText] = useState('');
  const [formImageUrl, setFormImageUrl] = useState('');
  const [formCtaText, setFormCtaText] = useState('Learn More');
  const [formCtaUrl, setFormCtaUrl] = useState('#jobs');
  const [formBadgeText, setFormBadgeText] = useState('Sponsored');
  const [formTheme, setFormTheme] = useState<AdTheme>('emerald');
  const [formDismissable, setFormDismissable] = useState(true);
  const [formAutoCloseDelay, setFormAutoCloseDelay] = useState(0);
  const [formDurationUnit, setFormDurationUnit] = useState<AdDurationUnit>('days');
  const [formDurationValue, setFormDurationValue] = useState<number>(1);
  const [formSmsSenderId, setFormSmsSenderId] = useState('HybridJobsPK');
  const [formSmsAudience, setFormSmsAudience] = useState<
    'All Registered Users' | 'Pro Subscribers Only' | 'Job Seekers' | 'Employers'
  >('All Registered Users');

  // -------------------------------------------------------------
  // QUICK ACTION HANDLERS
  // -------------------------------------------------------------
  const handleTogglePause = (ad: Advertisement) => {
    if (!canManageCampaignOperations) return;
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
    setEditStartDate(
      ad.scheduledStartAt
        ? ad.scheduledStartAt.slice(0, 16).replace(' ', 'T')
        : new Date().toISOString().slice(0, 16)
    );
    setEditEndDate(
      ad.scheduledEndAt
        ? ad.scheduledEndAt.slice(0, 16).replace(' ', 'T')
        : new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 16)
    );
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

  const handleOpenCampaignDetails = async (ad: Advertisement) => {
    setDetailsAd(ad);
    setSubmitterProfile(null);
    if (!ad.submittedByUserId || ad.submittedByUserId === 'admin') return;
    setIsSubmitterProfileLoading(true);
    try {
      const response = await api.users.getProfile(String(ad.submittedByUserId));
      if (response?.success && response.user) {
        setSubmitterProfile(response.user);
      }
    } catch (error) {
      console.warn('[AdminCampaignCenter] Could not load advertiser profile:', error);
    } finally {
      setIsSubmitterProfileLoading(false);
    }
  };

  const handleApproveCampaign = (ad: Advertisement) => {
    if (!canManageCampaignOperations) return;
    if (onApproveAd) {
      onApproveAd(ad.id);
      return;
    }

    const now = new Date();
    const nowStr = now.toISOString().replace('T', ' ').substring(0, 16);
    const calc = calculateCampaignCost(
      pricingConfig,
      ad.durationUnit || 'days',
      ad.durationValue || 1,
      ad.placement,
      ad.targetPages
    );
    const endTimestamp = new Date(now.getTime() + calc.durationHours * 60 * 60 * 1000)
      .toISOString()
      .replace('T', ' ')
      .substring(0, 16);

    onUpdateAd({
      ...ad,
      status: 'active',
      approvalStatus: 'Approved',
      scheduledStartAt: ad.scheduledStartAt || nowStr,
      scheduledEndAt: ad.scheduledEndAt || endTimestamp,
      approvedAt: nowStr,
      approvedBy: 'Admin'
    });
  };

  const handleOpenRejectModal = (ad: Advertisement) => {
    if (!canManageCampaignOperations) return;
    setRejectingAd(ad);
    setRejectionReasonInput(
      'Creative image resolution is too low and does not meet portal quality guidelines.'
    );
    setCustomRejectionReason('');
  };

  const handleConfirmRejection = () => {
    if (!rejectingAd) return;
    const resolvedReason =
      rejectionReasonInput === 'Other (Specify Custom Reason)'
        ? customRejectionReason.trim()
        : rejectionReasonInput.trim();
    if (!resolvedReason) {
      alert('Please enter a clear rejection reason before continuing.');
      return;
    }

    const isRefundEligible = Boolean(
      rejectingAd.walletTxId ||
        (rejectingAd as any).paymentTransactionId ||
        rejectingAd.paymentStatus === 'Escrow' ||
        rejectingAd.paymentStatus === 'Exempt' ||
        Number(rejectingAd.campaignCostPkr || 0) === 0
    );

    if (isRefundEligible && onRejectAd) {
      onRejectAd(rejectingAd.id, resolvedReason);
      setRejectingAd(null);
      return;
    }

    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 16);
    onUpdateAd({
      ...rejectingAd,
      status: 'rejected',
      approvalStatus: 'Rejected',
      rejectionReason: resolvedReason,
      rejectedAt: nowStr
    });

    if (rejectingAd.submittedByUserId && rejectingAd.submittedByUserId !== 'admin') {
      api.chat
        .adminSendReply({
          id: 'msg-' + Date.now(),
          userId: rejectingAd.submittedByUserId,
          userName: 'Portal Admin',
          text: `⚠️ Campaign Update: Your campaign "${rejectingAd.title}" was rejected by Admin. Reason: ${resolvedReason}.`,
          timestamp: new Date().toISOString()
        })
        .catch((err) =>
          console.warn('[AdminCampaignCenter] Could not send rejection notification:', err)
        );
    }

    setRejectingAd(null);
  };

  const handleDeleteCampaign = (ad: Advertisement) => {
    if (!canManageCampaignOperations || !onDeleteAd) return;
    if (window.confirm(`Delete campaign "${ad.title || ad.headline}"? This cannot be undone.`)) {
      onDeleteAd(ad.id);
    }
  };

  const handleOpenCreate = () => {
    if (!canManageCampaignOperations) return;
    setEditingAd(null);
    setFormTitle('New Administrative Campaign');
    setFormType('banner');
    setFormTargetPages(['all']);
    setFormPlacement('top-header');
    setFormStatus('active');
    setFormDurationUnit('days');
    setFormDurationValue(7);
    setFormHeadline('Accelerate Your Career with Top Verified Opportunities');
    setFormBodyText(
      'Explore verified high-paying local and international remote positions with direct employer contracts.'
    );
    setFormImageUrl(
      'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=1200&auto=format&fit=crop&q=80'
    );
    setFormCtaText('Explore Jobs');
    setFormCtaUrl('#jobs');
    setFormBadgeText('Sponsored Partner');
    setFormTheme('emerald');
    setFormDismissable(true);
    setFormAutoCloseDelay(0);
    setFormSmsSenderId('HybridJobsPK');
    setFormSmsAudience('All Registered Users');
    setIsEditorOpen(true);
  };

  const handleOpenEdit = (ad: Advertisement) => {
    if (!canManageCampaignOperations) return;
    setEditingAd(ad);
    setFormTitle(ad.title || '');
    setFormType(ad.type || 'banner');
    setFormTargetPages(ad.targetPages?.length ? ad.targetPages : ['all']);
    setFormPlacement(ad.placement || 'top-header');
    setFormStatus(ad.status || 'active');
    setFormDurationUnit(ad.durationUnit || 'days');
    setFormDurationValue(ad.durationValue || 1);
    setFormHeadline(ad.headline || '');
    setFormBodyText(ad.bodyText || '');
    setFormImageUrl(ad.imageUrl || '');
    setFormCtaText(ad.ctaText || '');
    setFormCtaUrl(ad.ctaUrl || '');
    setFormBadgeText(ad.badgeText || '');
    setFormTheme(ad.theme || 'emerald');
    setFormDismissable(ad.dismissable !== false);
    setFormAutoCloseDelay(ad.autoCloseDelay || 0);
    setFormSmsSenderId(ad.smsSenderId || 'HybridJobsPK');
    setFormSmsAudience(ad.smsAudience || 'All Registered Users');
    setIsEditorOpen(true);
  };

  const handleSaveAd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageCampaignOperations) return;
    if (!formHeadline.trim()) {
      alert('Please provide a headline or message for the advertisement.');
      return;
    }

    const calc = calculateCampaignCost(
      pricingConfig,
      formDurationUnit,
      formDurationValue,
      formPlacement,
      formTargetPages,
      formType === 'sms' ? 3450 : 0
    );

    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 16);
    const endTimestamp = new Date(Date.now() + calc.durationHours * 60 * 60 * 1000)
      .toISOString()
      .replace('T', ' ')
      .substring(0, 16);

    const adData: Advertisement = {
      ...(editingAd || {}),
      id: editingAd ? editingAd.id : 'ad-' + Date.now(),
      title: formTitle.trim() || 'Untitled Campaign',
      type: formType,
      targetPages: formTargetPages.length > 0 ? formTargetPages : ['all'],
      placement: formPlacement,
      status: formStatus,
      approvalStatus:
        formStatus === 'pending_approval'
          ? 'Pending'
          : formStatus === 'rejected'
          ? 'Rejected'
          : editingAd?.approvalStatus || 'Approved',
      submittedByUserId: editingAd ? editingAd.submittedByUserId : 'admin',
      submittedByUserName: editingAd ? editingAd.submittedByUserName : 'System Admin',
      durationUnit: formDurationUnit,
      durationValue: formDurationValue,
      durationDisplay: editingAd?.durationDisplay || calc.durationDisplay,
      scheduledStartAt: editingAd?.scheduledStartAt || nowStr,
      scheduledEndAt: editingAd?.scheduledEndAt || endTimestamp,
      campaignCostPkr: editingAd ? editingAd.campaignCostPkr : calc.totalCostPkr,
      paymentStatus: editingAd ? editingAd.paymentStatus : 'Paid',
      headline: formHeadline.trim(),
      bodyText: formBodyText.trim(),
      imageUrl: formImageUrl.trim() || undefined,
      ctaText: formCtaText.trim() || undefined,
      ctaUrl: formCtaUrl.trim() || undefined,
      badgeText: formBadgeText.trim() || undefined,
      theme: formTheme,
      dismissable: formDismissable,
      autoCloseDelay: formAutoCloseDelay > 0 ? formAutoCloseDelay : undefined,
      smsSenderId: formType === 'sms' ? formSmsSenderId : undefined,
      smsAudience: formType === 'sms' ? formSmsAudience : undefined,
      smsRecipientsCount:
        formType === 'sms' ? (editingAd ? editingAd.smsRecipientsCount : 3450) : undefined,
      smsSentAt: formType === 'sms' ? (editingAd ? editingAd.smsSentAt : nowStr) : undefined,
      smsStatus: formType === 'sms' ? (editingAd ? editingAd.smsStatus : 'Sent') : undefined,
      impressions: editingAd ? editingAd.impressions : 0,
      clicks: editingAd ? editingAd.clicks : 0,
      createdAt: editingAd ? editingAd.createdAt : nowStr,
      updatedAt: nowStr
    };

    if (editingAd) {
      onUpdateAd(adData);
    } else if (onAddAd) {
      onAddAd(adData);
    }

    setIsEditorOpen(false);
    setEditingAd(null);
  };

  const handleImageFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setFormImageUrl(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Counts & Filtered Ads
  const statusCounts = useMemo(() => {
    const counts = {
      all: ads.length,
      active: 0,
      scheduled: 0,
      expired: 0,
      pending: 0,
      paused: 0,
      rejected: 0
    };
    ads.forEach((ad) => {
      const dyn = getCampaignDynamicStatus(ad);
      if (dyn === 'Active') counts.active += 1;
      else if (dyn === 'Scheduled') counts.scheduled += 1;
      else if (dyn === 'Expired') counts.expired += 1;
      else if (dyn === 'Pending Approval') counts.pending += 1;
      else if (dyn === 'Paused') counts.paused += 1;
      else if (dyn === 'Rejected') counts.rejected += 1;
    });
    return counts;
  }, [ads]);

  const filteredAds = useMemo(() => {
    return ads.filter((ad) => {
      if (selectedPlacementFilter !== 'all' && ad.placement !== selectedPlacementFilter) {
        return false;
      }
      if (selectedTypeFilter !== 'all' && ad.type !== selectedTypeFilter) {
        return false;
      }
      if (selectedPageFilter !== 'all') {
        const pages = ad.targetPages || [];
        if (!pages.includes('all') && !pages.includes(selectedPageFilter as AdTargetPage)) {
          return false;
        }
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
        const matchesTitle = (ad.title || '').toLowerCase().includes(q);
        const matchesHeadline = (ad.headline || '').toLowerCase().includes(q);
        const matchesBody = (ad.bodyText || '').toLowerCase().includes(q);
        const matchesUser = ad.submittedByUserName && ad.submittedByUserName.toLowerCase().includes(q);
        const matchesEmail = ad.submittedByUserEmail && ad.submittedByUserEmail.toLowerCase().includes(q);
        const matchesId = (ad.id || '').toLowerCase().includes(q);
        return matchesTitle || matchesHeadline || matchesBody || matchesUser || matchesEmail || matchesId;
      }

      return true;
    });
  }, [
    ads,
    selectedPlacementFilter,
    selectedStatusFilter,
    selectedTypeFilter,
    selectedPageFilter,
    searchQuery
  ]);

  const hasActiveFilters =
    selectedPlacementFilter !== 'all' ||
    selectedStatusFilter !== 'all' ||
    selectedTypeFilter !== 'all' ||
    selectedPageFilter !== 'all' ||
    searchQuery.trim().length > 0;

  const placementIcons: Record<AdPlacement, any> = {
    'top-header': Megaphone,
    'feed-inline': Layers,
    'popup-modal': Sparkles,
    'toast-float': Clock,
    sidebar: Smartphone,
    'sms-broadcast': Send,
    'promo-discount-banner': Tag,
    'dynamic-announcement-card': Layers
  };

  return (
    <div className="admin-settings-mobile-compact space-y-4 sm:space-y-5">
      {/* Top Banner / Visual Command Hub */}
      <div className="bg-gradient-to-r from-purple-950/80 via-slate-900 to-indigo-950/80 border border-purple-500/30 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
        <div className="space-y-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-purple-400 text-[10px] sm:text-xs font-black uppercase tracking-wider bg-purple-500/10 px-2.5 py-0.5 rounded-full border border-purple-500/20 flex items-center gap-1.5">
              <Megaphone className="w-3.5 h-3.5 shrink-0" />
              <span>Campaign Command Center</span>
            </span>
            <span className="text-emerald-400 text-[11px] sm:text-xs font-bold font-mono">
              ● {ads.length} Total ({statusCounts.active} Live · {statusCounts.pending} Pending)
            </span>
          </div>
          <h2 className="text-lg sm:text-2xl font-black text-white tracking-tight">
            Campaign Operations &amp; Scheduling
          </h2>
          <p className="text-[11px] sm:text-xs text-slate-300 max-w-2xl">
            Inspect submissions, preview live creatives, edit campaigns &amp; date windows, approve or reject with notification &amp; refund, pause/resume, reset analytics, and waive fees.
          </p>
        </div>

        {/* Command Actions (from Directory) */}
        {canManageCampaignOperations && (
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {onResetAdMetrics && (
              <button
                type="button"
                onClick={() => {
                  if (
                    window.confirm(
                      'Reset impression and click counters across ALL campaigns? This cannot be undone.'
                    )
                  ) {
                    onResetAdMetrics();
                  }
                }}
                className="px-3 py-2 bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reset Counters</span>
              </button>
            )}
            {onAddAd && (
              <button
                type="button"
                onClick={handleOpenCreate}
                className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 cursor-pointer active:scale-95 transition-all"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>New Admin Campaign</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* FILTER & SEARCH COMMAND BAR */}
      <div className="bg-slate-900/70 p-3 sm:p-4 rounded-2xl border border-slate-800 space-y-3">
        {/* Status Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto text-[11px] sm:text-xs font-bold pb-0.5 scrollbar-thin">
          {[
            { id: 'all', label: `All (${statusCounts.all})` },
            { id: 'active', label: `🟢 Active (${statusCounts.active})` },
            { id: 'scheduled', label: `🟡 Scheduled (${statusCounts.scheduled})` },
            { id: 'expired', label: `🔴 Expired (${statusCounts.expired})` },
            { id: 'pending', label: `⏳ Pending (${statusCounts.pending})` },
            { id: 'paused', label: `⏸️ Paused (${statusCounts.paused})` },
            { id: 'rejected', label: `❌ Rejected (${statusCounts.rejected})` }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSelectedStatusFilter(tab.id)}
              className={`px-2.5 sm:px-3 py-1.5 rounded-xl transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                selectedStatusFilter === tab.id
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Multi-Dimensional Filters: Search, Placement, Format, Target Page */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2 pt-2 border-t border-slate-800/80">
          <div className="relative lg:col-span-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search title, headline, advertiser..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
            />
          </div>

          <select
            value={selectedPlacementFilter}
            onChange={(e) => setSelectedPlacementFilter(e.target.value)}
            aria-label="Filter by placement"
            className="lg:col-span-3 px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
          >
            <option value="all">All Placements</option>
            <option value="top-header">Top Header Banner</option>
            <option value="feed-inline">Native Feed Card</option>
            <option value="popup-modal">Popup Lightbox</option>
            <option value="toast-float">Toast Notification</option>
            <option value="sidebar">Sidebar Widget</option>
            <option value="sms-broadcast">SMS Broadcast</option>
            <option value="promo-discount-banner">Promotional Discount Banner</option>
            <option value="dynamic-announcement-card">Dynamic Announcement Card</option>
          </select>

          <select
            value={selectedTypeFilter}
            onChange={(e) => setSelectedTypeFilter(e.target.value)}
            aria-label="Filter by ad format"
            className="lg:col-span-2 px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
          >
            <option value="all">All Formats</option>
            <option value="banner">Image Banner</option>
            <option value="popup">Modal Pop-up</option>
            <option value="notification">Toast Float</option>
            <option value="text">Text Box</option>
            <option value="sms">SMS Broadcast</option>
          </select>

          <div className="lg:col-span-3 flex items-center gap-2">
            <select
              value={selectedPageFilter}
              onChange={(e) => setSelectedPageFilter(e.target.value)}
              aria-label="Filter by target page"
              className="w-full px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
            >
              <option value="all">All Target Pages</option>
              <option value="jobs">Jobs Search Feed</option>
              <option value="cv">ATS CV Builder</option>
              <option value="alerts">Job Alerts</option>
              <option value="dashboard">User Dashboard</option>
              <option value="detail-modal">Job Detail Modal</option>
            </select>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => {
                  setSelectedPlacementFilter('all');
                  setSelectedStatusFilter('all');
                  setSelectedTypeFilter('all');
                  setSelectedPageFilter('all');
                  setSearchQuery('');
                }}
                className="shrink-0 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold cursor-pointer"
                title="Clear all filters"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* VISUAL CARDS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5 sm:gap-4">
        {filteredAds.map((ad) => {
          const dynStatus = getCampaignDynamicStatus(ad);
          const Icon = placementIcons[ad.placement] || Megaphone;
          const isPending = ad.status === 'pending_approval' || ad.approvalStatus === 'Pending';
          const isRejected = dynStatus === 'Rejected';
          const isFreeOrExempt = ad.paymentStatus === 'Exempt' && Number(ad.campaignCostPkr || 0) === 0;

          const statusColors: Record<DynamicCampaignStatus, { badge: string; border: string }> = {
            Active: {
              badge: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
              border: 'border-emerald-500/30'
            },
            Scheduled: {
              badge: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
              border: 'border-amber-500/30'
            },
            Expired: {
              badge: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
              border: 'border-slate-800'
            },
            'Pending Approval': {
              badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
              border: 'border-amber-500/40'
            },
            Paused: {
              badge: 'bg-slate-700 text-slate-300 border-slate-600',
              border: 'border-slate-800'
            },
            Rejected: {
              badge: 'bg-rose-950 text-rose-300 border-rose-800',
              border: 'border-rose-900/50'
            }
          };

          const currentTheme = statusColors[dynStatus] || statusColors['Active'];
          const ctr =
            (ad.impressions || 0) > 0
              ? (((ad.clicks || 0) / ad.impressions) * 100).toFixed(1)
              : '0.0';

          return (
            <div
              key={ad.id}
              className={`p-3.5 sm:p-4 rounded-2xl bg-slate-900 border ${currentTheme.border} shadow-xl flex flex-col justify-between space-y-3 relative hover:border-purple-500/40 transition-all`}
            >
              {/* 1. Compact Header Row: Thumbnail + Identity + Pause/Play */}
              <div className="flex items-start justify-between gap-2.5">
                <div className="flex items-start gap-2.5 min-w-0">
                  {ad.imageUrl ? (
                    <img
                      src={ad.imageUrl}
                      alt={ad.headline}
                      className="w-11 h-11 rounded-xl object-cover border border-slate-700 shrink-0"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-xl bg-slate-800/90 border border-slate-700 flex items-center justify-center text-slate-400 shrink-0">
                      <Icon className="w-5 h-5" />
                    </div>
                  )}

                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center flex-wrap gap-1">
                      <span
                        className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full border ${currentTheme.badge}`}
                      >
                        ● {dynStatus}
                      </span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-slate-800 text-slate-300">
                        {getPlacementDisplayName(ad.placement)}
                      </span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-indigo-500/15 text-indigo-300">
                        ⏱ {ad.durationDisplay || '24h'}
                      </span>
                    </div>
                    <h4 className="text-sm font-black text-white tracking-tight truncate">
                      {ad.title || ad.headline}
                    </h4>
                  </div>
                </div>

                {canManageCampaignOperations && (
                  <button
                    type="button"
                    onClick={() => handleTogglePause(ad)}
                    disabled={
                      (ad.status !== 'active' && ad.status !== 'paused') ||
                      Boolean(ad.approvalStatus && ad.approvalStatus !== 'Approved')
                    }
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0 cursor-pointer"
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
                    {ad.status === 'active' ? (
                      <Pause className="w-3.5 h-3.5 text-amber-400" />
                    ) : (
                      <Play className="w-3.5 h-3.5 text-emerald-400" />
                    )}
                  </button>
                )}
              </div>

              {/* 2. Compact Creative Box */}
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/90 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 truncate">
                    {ad.badgeText || 'Sponsored'}
                  </span>
                  <span className="text-[9px] font-mono text-slate-400 truncate">
                    {(ad.targetPages || []).map(getPageDisplayName).join(', ')}
                  </span>
                </div>
                <div className="text-xs font-bold text-white line-clamp-1">{ad.headline}</div>
                <div className="text-[11px] text-slate-400 line-clamp-2 leading-snug">
                  {ad.bodyText}
                </div>
                <div className="flex items-center justify-between gap-2 pt-1 text-[10px]">
                  <span className="text-slate-400 truncate">
                    By:{' '}
                    <button
                      type="button"
                      onClick={() => handleOpenCampaignDetails(ad)}
                      className="text-slate-200 hover:text-indigo-300 underline decoration-dotted underline-offset-2 font-semibold cursor-pointer"
                    >
                      {ad.submittedByUserName || 'System Admin'}
                    </button>
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="font-mono font-bold text-emerald-400">
                      PKR {(ad.campaignCostPkr || 0).toLocaleString()}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[9px] font-bold text-slate-300">
                      {ad.paymentStatus || 'Paid'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Rejection Reason Banner (if rejected) */}
              {isRejected && ad.rejectionReason && (
                <div className="px-2.5 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-[10px] text-rose-200 flex items-start gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                  <span className="line-clamp-2">{ad.rejectionReason}</span>
                </div>
              )}

              {/* 3. Granular Date Window */}
              <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1 text-xs">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-[10px] font-black uppercase flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-purple-400" />
                    <span>Schedule Window</span>
                  </span>
                  {canManageCampaignOperations && (
                    <button
                      type="button"
                      onClick={() => handleOpenDateModal(ad)}
                      className="text-[10px] font-bold text-purple-400 hover:text-purple-300 flex items-center gap-1 cursor-pointer"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>Edit Dates</span>
                    </button>
                  )}
                </div>

                <div className="font-mono text-[10px] sm:text-[11px] text-slate-200 font-bold truncate">
                  {ad.scheduledStartAt ? ad.scheduledStartAt.slice(0, 16) : 'Immediate'} ➔{' '}
                  {ad.scheduledEndAt ? ad.scheduledEndAt.slice(0, 16) : 'Ongoing'}
                </div>

                <div className="text-[10px] text-slate-400 flex items-center justify-between gap-2">
                  <span>Status Note:</span>
                  <span className="text-amber-400 font-medium truncate">
                    {formatTimeRemaining(ad.scheduledEndAt)}
                  </span>
                </div>
              </div>

              {/* 4. Metrics Bar (Impressions, Clicks, CTR + Quick Contact / Fee Waiver) */}
              <div className="pt-1.5 border-t border-slate-800/80 flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center space-x-2.5 text-slate-400 font-mono text-[11px]">
                  <span className="flex items-center gap-1" title="Impressions">
                    <Eye className="w-3 h-3 text-indigo-400" />
                    <span>{(ad.impressions || 0).toLocaleString()}</span>
                  </span>
                  <span className="flex items-center gap-1" title="Clicks">
                    <MousePointer className="w-3 h-3 text-emerald-400" />
                    <span>{(ad.clicks || 0).toLocaleString()}</span>
                  </span>
                  <span className="text-purple-400 font-bold" title="Click-Through Rate (CTR)">
                    {ctr}% CTR
                  </span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {canViewCampaignContactDetails && (
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedContactAdId((current) => (current === ad.id ? null : ad.id))
                      }
                      className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-sky-300 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                      title={
                        expandedContactAdId === ad.id
                          ? 'Hide Advertiser Contact Details'
                          : 'Show Advertiser Contact Details'
                      }
                    >
                      <Eye className="w-3 h-3" />
                      <span>Contact</span>
                    </button>
                  )}
                  {canWaiveCampaignFee && !isFreeOrExempt && (
                    <button
                      type="button"
                      onClick={() => handleMakeCampaignFree(ad)}
                      className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-emerald-400 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                      title="Waive Campaign Fee"
                    >
                      <Gift className="w-3 h-3" />
                      <span>Waive</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Expanded Contact Details (preserved inline view) */}
              {canViewCampaignContactDetails && expandedContactAdId === ad.id && (
                <div className="p-2.5 rounded-xl bg-slate-950/80 border border-sky-500/25 space-y-1 text-[11px]">
                  <div className="text-[9px] font-black uppercase tracking-wider text-sky-300">
                    Advertiser Contact Details · Admin Only
                  </div>
                  <div className="text-slate-300">
                    Name:{' '}
                    <span className="text-white">
                      {(ad as any).clientName || ad.submittedByUserName || 'Not provided'}
                    </span>
                  </div>
                  <div className="text-slate-300">
                    Email:{' '}
                    <span className="text-white break-all">
                      {(ad as any).clientEmail || ad.submittedByUserEmail || 'Not provided'}
                    </span>
                  </div>
                  <div className="text-slate-300">
                    Phone:{' '}
                    <span className="text-white">{ad.submittedByUserPhone || 'Not provided'}</span>
                  </div>
                </div>
              )}

              {/* 5. Organized Compact Action Toolbar (View, Preview, Edit, Approve, Reject w/ Notification, Reset, Delete) */}
              <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleOpenCampaignDetails(ad)}
                  className="px-2.5 py-1.5 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-200 border border-indigo-500/30 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                  title="View Full Campaign & Advertiser Details"
                >
                  <FileText className="w-3 h-3" />
                  <span>View</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPreviewAd(ad)}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                  title="Live Context Preview"
                >
                  <Monitor className="w-3 h-3 text-sky-400" />
                  <span>Preview</span>
                </button>

                {canManageCampaignOperations && (
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(ad)}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                    title="Edit Campaign Content & Targeting"
                  >
                    <Edit3 className="w-3 h-3" />
                    <span>Edit</span>
                  </button>
                )}

                {canManageCampaignOperations && isPending && (
                  <button
                    type="button"
                    onClick={() => handleApproveCampaign(ad)}
                    className="px-2.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[11px] font-black flex items-center gap-1 cursor-pointer shadow-sm shadow-emerald-500/20"
                    title="Approve & Publish Campaign"
                  >
                    <Check className="w-3 h-3 stroke-[3]" />
                    <span>Approve</span>
                  </button>
                )}

                {canManageCampaignOperations && !isRejected && (
                  <button
                    type="button"
                    onClick={() => handleOpenRejectModal(ad)}
                    className="px-2.5 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/35 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                    title="Reject with Notification & Refund"
                  >
                    <Bell className="w-3 h-3" />
                    <span>Reject w/ Notify</span>
                  </button>
                )}

                {canManageCampaignOperations && onResetAdMetrics && (
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        window.confirm(
                          `Reset analytics for campaign "${ad.title || ad.headline}"? Impressions and clicks will be set to zero.`
                        )
                      ) {
                        onResetAdMetrics(ad.id);
                      }
                    }}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-300 cursor-pointer transition-colors"
                    title="Reset Campaign Metrics"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                )}

                {canManageCampaignOperations && onDeleteAd && (
                  <button
                    type="button"
                    onClick={() => handleDeleteCampaign(ad)}
                    className="ml-auto p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/25 text-rose-400 cursor-pointer transition-colors"
                    title="Delete Campaign"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filteredAds.length === 0 && (
        <div className="p-10 rounded-3xl bg-slate-900 border border-slate-800 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center mx-auto">
            <Megaphone className="w-6 h-6" />
          </div>
          <h3 className="text-base font-black text-white">No Matching Campaigns Found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Try adjusting your status, placement, format, or target page filter in the command bar above.
          </p>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. CAMPAIGN SUBMISSION DETAILS & VERIFIED SUBMITTER PROFILE MODAL         */}
      {/* ========================================================================= */}
      {detailsAd && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/85 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl sm:rounded-3xl p-4 sm:p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-4 shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="min-w-0">
                <h3 className="text-base sm:text-lg font-black text-white truncate">
                  Campaign Details &amp; Advertiser Profile
                </h3>
                <p className="text-[11px] text-slate-400">
                  Full submission record, schedule, payment/escrow state, and advertiser verification.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetailsAd(null)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              <div className="rounded-xl bg-slate-950 border border-slate-800 p-3">
                <span className="text-[10px] text-slate-500 uppercase font-bold">Campaign Title</span>
                <div className="text-white font-bold mt-0.5">
                  {detailsAd.title || detailsAd.headline}
                </div>
              </div>
              <div className="rounded-xl bg-slate-950 border border-slate-800 p-3">
                <span className="text-[10px] text-slate-500 uppercase font-bold">Format / Placement</span>
                <div className="text-white font-bold mt-0.5">
                  {detailsAd.type} · {getPlacementDisplayName(detailsAd.placement)}
                </div>
              </div>
              <div className="rounded-xl bg-slate-950 border border-slate-800 p-3">
                <span className="text-[10px] text-slate-500 uppercase font-bold">Duration &amp; Performance</span>
                <div className="text-white font-bold mt-0.5">
                  {detailsAd.durationDisplay || 'Not specified'} · {(detailsAd.impressions || 0).toLocaleString()} views / {(detailsAd.clicks || 0).toLocaleString()} clicks
                </div>
              </div>
              <div className="rounded-xl bg-slate-950 border border-slate-800 p-3">
                <span className="text-[10px] text-slate-500 uppercase font-bold">Campaign Fee</span>
                <div className="text-emerald-300 font-bold mt-0.5 font-mono">
                  PKR {(detailsAd.campaignCostPkr || 0).toLocaleString()} ·{' '}
                  {detailsAd.paymentStatus || 'Not specified'}
                </div>
              </div>
              <div className="rounded-xl bg-slate-950 border border-slate-800 p-3 sm:col-span-2">
                <span className="text-[10px] text-slate-500 uppercase font-bold">Target Pages</span>
                <div className="text-white font-bold mt-0.5">
                  {(detailsAd.targetPages || []).map(getPageDisplayName).join(', ') || 'Not specified'}
                </div>
              </div>
              <div className="rounded-xl bg-slate-950 border border-slate-800 p-3 sm:col-span-2">
                <span className="text-[10px] text-slate-500 uppercase font-bold">Headline &amp; Copy</span>
                <div className="text-white font-bold mt-0.5">
                  {detailsAd.headline || 'Not provided'}
                </div>
                <p className="text-slate-300 mt-1.5 whitespace-pre-wrap text-[11px]">
                  {detailsAd.bodyText || 'No description provided.'}
                </p>
              </div>
              <div className="rounded-xl bg-slate-950 border border-slate-800 p-3">
                <span className="text-[10px] text-slate-500 uppercase font-bold">CTA</span>
                <div className="text-white mt-0.5 font-semibold">
                  {detailsAd.ctaText || 'Not provided'}
                </div>
                <div className="text-indigo-300 break-all text-[11px]">
                  {detailsAd.ctaUrl || 'No URL'}
                </div>
              </div>
              <div className="rounded-xl bg-slate-950 border border-slate-800 p-3">
                <span className="text-[10px] text-slate-500 uppercase font-bold">Schedule</span>
                <div className="text-white mt-0.5 font-mono text-[11px]">
                  Start: {detailsAd.scheduledStartAt || 'Not set'}
                </div>
                <div className="text-white font-mono text-[11px]">
                  End: {detailsAd.scheduledEndAt || 'Not set'}
                </div>
              </div>
            </div>

            {detailsAd.imageUrl && (
              <div className="rounded-xl bg-slate-950 border border-slate-800 p-3">
                <div className="text-[10px] text-slate-500 uppercase font-bold mb-2">
                  Submitted Creative
                </div>
                <img
                  src={detailsAd.imageUrl}
                  alt="Submitted campaign creative"
                  className="max-h-56 max-w-full rounded-lg object-contain mx-auto"
                />
              </div>
            )}

            <div className="rounded-xl bg-slate-950 border border-slate-800 p-3.5 space-y-2">
              <h4 className="text-xs font-black text-white uppercase tracking-wider">
                Advertiser Profile
              </h4>
              <div className="text-[11px] text-slate-300">
                Submitted Name: <strong className="text-white">{detailsAd.submittedByUserName || 'Not provided'}</strong> ·
                Email: <strong className="text-white break-all">{detailsAd.submittedByUserEmail || 'Not provided'}</strong> ·
                Phone: <strong className="text-white">{detailsAd.submittedByUserPhone || 'Not provided'}</strong>
              </div>
              {isSubmitterProfileLoading ? (
                <div className="text-[11px] text-slate-400">Loading verified account profile…</div>
              ) : submitterProfile ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] pt-1 border-t border-slate-800/70">
                  <div>
                    <span className="text-slate-500 block">Account Name</span>
                    <div className="text-white font-semibold">
                      {submitterProfile.name || submitterProfile.fullName || 'Not provided'}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Account Email</span>
                    <div className="text-white break-all">
                      {submitterProfile.email || 'Not provided'}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Phone</span>
                    <div className="text-white">{submitterProfile.phone || 'Not provided'}</div>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Role / Status</span>
                    <div className="text-white">
                      {submitterProfile.role || 'User'} · {submitterProfile.status || 'Active'}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Company</span>
                    <div className="text-white">{submitterProfile.companyName || 'Not provided'}</div>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Location</span>
                    <div className="text-white">
                      {[submitterProfile.city, submitterProfile.province, submitterProfile.country]
                        .filter(Boolean)
                        .join(', ') || 'Not provided'}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-[11px] text-slate-400">
                  {detailsAd.submittedByUserId && detailsAd.submittedByUserId !== 'admin'
                    ? 'Account profile could not be loaded; submitted identity is shown above.'
                    : 'Administrative or system-managed campaign.'}
                </div>
              )}
            </div>

            <div className="flex flex-wrap justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  const ad = detailsAd;
                  setDetailsAd(null);
                  setPreviewAd(ad);
                }}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold cursor-pointer"
              >
                Preview Creative
              </button>
              {canManageCampaignOperations && (
                <button
                  type="button"
                  onClick={() => {
                    const ad = detailsAd;
                    setDetailsAd(null);
                    handleOpenEdit(ad);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 text-xs font-bold cursor-pointer"
                >
                  Edit Campaign
                </button>
              )}
              {canManageCampaignOperations &&
                getCampaignDynamicStatus(detailsAd) !== 'Rejected' && (
                  <button
                    type="button"
                    onClick={() => {
                      const ad = detailsAd;
                      setDetailsAd(null);
                      handleOpenRejectModal(ad);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/35 text-rose-200 text-xs font-bold cursor-pointer"
                  >
                    Reject w/ Notification
                  </button>
                )}
              {canManageCampaignOperations &&
                (detailsAd.status === 'pending_approval' ||
                  detailsAd.approvalStatus === 'Pending') && (
                  <button
                    type="button"
                    onClick={() => {
                      handleApproveCampaign(detailsAd);
                      setDetailsAd(null);
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black cursor-pointer"
                  >
                    Approve &amp; Publish
                  </button>
                )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. LIVE SIMULATOR PREVIEW MODAL                                           */}
      {/* ========================================================================= */}
      {previewAd && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/85 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-6 max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl space-y-4">
            <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <span>Live Context Simulator Preview</span>
                </h3>
                <p className="text-[11px] text-slate-400">
                  {previewAd.title} · {getPlacementDisplayName(previewAd.placement)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewAd(null)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 bg-slate-950 p-2 sm:p-3 rounded-2xl border border-slate-800">
              <CampaignLiveContextPreview
                campaign={previewAd}
                headline={previewAd.headline}
                bodyText={previewAd.bodyText}
                imageUrl={previewAd.imageUrl}
                ctaText={previewAd.ctaText}
                ctaUrl={previewAd.ctaUrl}
                badgeText={previewAd.badgeText}
                theme={previewAd.theme}
                placement={previewAd.placement}
                targetPages={previewAd.targetPages}
                dismissable={previewAd.dismissable}
                smsSenderId={previewAd.smsSenderId}
                smsAudience={previewAd.smsAudience}
                portalPages={campaignConfig?.portalPages}
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPreviewAd(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. REJECT WITH NOTIFICATION & WALLET REFUND MODAL                         */}
      {/* ========================================================================= */}
      {rejectingAd && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl p-5 sm:p-6 max-w-lg w-full shadow-2xl space-y-4 relative">
            <button
              type="button"
              onClick={() => setRejectingAd(null)}
              className="absolute top-4 right-4 p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white cursor-pointer"
            >
              <XCircle className="w-4 h-4" />
            </button>

            <div className="space-y-1 pr-8">
              <div className="flex items-center space-x-2 text-rose-400 text-xs font-bold uppercase">
                <Bell className="w-4 h-4" />
                <span>Reject with Notification &amp; Wallet Settlement</span>
              </div>
              <h3 className="text-lg font-black text-white">Specify Rejection Reason</h3>
              <p className="text-xs text-slate-400">
                A notification will be sent to{' '}
                <strong>{rejectingAd.submittedByUserName || 'the advertiser'}</strong>
                {rejectingAd.paymentStatus === 'Escrow' ||
                rejectingAd.walletTxId ||
                (rejectingAd as any).paymentTransactionId
                  ? ` and PKR ${(rejectingAd.campaignCostPkr || 0).toLocaleString()} held in escrow will be automatically refunded to their wallet.`
                  : '.'}
              </p>
            </div>

            <div className="space-y-2.5">
              <label className="text-xs font-bold text-slate-300 block">
                Select Standard Reason
              </label>
              <select
                value={rejectionReasonInput}
                onChange={(e) => setRejectionReasonInput(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
              >
                <option value="Creative image resolution is too low and does not meet portal quality guidelines.">
                  🖼️ Creative image resolution is too low / blurred
                </option>
                <option value="Headline or description contains misleading or unverified claims.">
                  ⚠️ Headline contains misleading or unverified claims
                </option>
                <option value="Destination CTA URL is broken, inaccessible, or violates advertising guidelines.">
                  🔗 Destination CTA URL is broken or invalid
                </option>
                <option value="Content promotes prohibited financial or unauthorized multi-level schemes.">
                  🚫 Content violates prohibited advertising policy
                </option>
                <option value="Other (Specify Custom Reason)">
                  ✏️ Other (Specify Custom Reason)
                </option>
              </select>

              {rejectionReasonInput === 'Other (Specify Custom Reason)' && (
                <textarea
                  rows={3}
                  value={customRejectionReason}
                  onChange={(e) => setCustomRejectionReason(e.target.value)}
                  placeholder="Type specific feedback to send to the advertiser..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                />
              )}
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setRejectingAd(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRejection}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-black shadow-lg shadow-rose-600/20 cursor-pointer"
              >
                Confirm Reject &amp; Notify
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. CREATE / EDIT CAMPAIGN MODAL WITH LIVE CONTEXT PREVIEW                 */}
      {/* ========================================================================= */}
      {isEditorOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-6 max-w-7xl w-full shadow-2xl space-y-4 my-2 max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
                  <Megaphone className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-white">
                    {editingAd ? 'Edit Campaign & Target Rules' : 'Create Administrative Campaign'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Edit creative details, placement, format, pages, and observe the live preview.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsEditorOpen(false)}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 overflow-y-auto flex-1 pr-1">
              {/* LEFT COLUMN: FORM */}
              <form
                id="campaign-ops-ad-form"
                onSubmit={handleSaveAd}
                className="lg:col-span-6 space-y-3.5"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-300">Campaign Title</label>
                    <input
                      type="text"
                      required
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      placeholder="e.g. Featured Govt Jobs Digest"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-300">Ad Format</label>
                    <select
                      value={formType}
                      onChange={(e) => setFormType(e.target.value as AdType)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                    >
                      <option value="banner">Banner</option>
                      <option value="popup">Pop-up Modal</option>
                      <option value="notification">Toast Float</option>
                      <option value="text">Text Box</option>
                      <option value="sms">SMS Broadcast</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-300">Placement Slot</label>
                    <select
                      value={formPlacement}
                      onChange={(e) => setFormPlacement(e.target.value as AdPlacement)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                    >
                      <option value="top-header">Top Header Banner</option>
                      <option value="feed-inline">Job Feed Inline Card</option>
                      <option value="popup-modal">Popup Modal</option>
                      <option value="toast-float">Toast Float</option>
                      <option value="sidebar">Sidebar Widget</option>
                      <option value="sms-broadcast">SMS Broadcast</option>
                      <option value="promo-discount-banner">Promotional Discount Banner</option>
                      <option value="dynamic-announcement-card">Dynamic Announcement Card</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-300">Status</label>
                    <select
                      value={formStatus}
                      onChange={(e) => setFormStatus(e.target.value as AdStatus)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                    >
                      <option value="active">Active (Live Immediately)</option>
                      <option value="paused">Paused</option>
                      <option value="pending_approval">Pending Review</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </div>
                </div>

                {/* Target Portal Pages */}
                <div className="space-y-1.5 p-3 bg-slate-950 border border-slate-800 rounded-2xl">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-300">Target Portal Pages</label>
                    <span className="text-[10px] text-emerald-400 font-semibold">
                      Multi-Page Distribution
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 pt-1">
                    {[
                      { id: 'all', label: 'All Pages (Global)' },
                      { id: 'alerts', label: 'Job Alerts Page' },
                      { id: 'jobs', label: 'Jobs Search Feed' },
                      { id: 'cv', label: 'ATS CV Builder' },
                      { id: 'dashboard', label: 'User Dashboard' }
                    ].map((pg) => {
                      const isChecked = formTargetPages.includes(pg.id as AdTargetPage);
                      return (
                        <button
                          type="button"
                          key={pg.id}
                          onClick={() => {
                            if (pg.id === 'all') {
                              setFormTargetPages(['all']);
                            } else {
                              const withoutAll = formTargetPages.filter((p) => p !== 'all');
                              if (isChecked) {
                                const next = withoutAll.filter((p) => p !== pg.id);
                                setFormTargetPages(next.length ? next : ['all']);
                              } else {
                                setFormTargetPages([...withoutAll, pg.id as AdTargetPage]);
                              }
                            }
                          }}
                          className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all text-left flex items-center justify-between cursor-pointer border ${
                            isChecked
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                              : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800'
                          }`}
                        >
                          <span className="text-[11px] truncate">{pg.label}</span>
                          {isChecked && (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 ml-1" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300">Headline *</label>
                  <input
                    type="text"
                    required
                    value={formHeadline}
                    onChange={(e) => setFormHeadline(e.target.value)}
                    placeholder="Punchy high-impact headline..."
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300">Body Description</label>
                  <textarea
                    rows={2}
                    value={formBodyText}
                    onChange={(e) => setFormBodyText(e.target.value)}
                    placeholder="Short description highlighting key opportunity details..."
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-300">Badge Label</label>
                    <input
                      type="text"
                      value={formBadgeText}
                      onChange={(e) => setFormBadgeText(e.target.value)}
                      placeholder="Sponsored Partner"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-300">Color Theme</label>
                    <select
                      value={formTheme}
                      onChange={(e) => setFormTheme(e.target.value as AdTheme)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                    >
                      <option value="emerald">Emerald Green (Standard)</option>
                      <option value="indigo">Indigo Blue (Pro)</option>
                      <option value="amber">Amber Gold (Urgent)</option>
                      <option value="rose">Rose Red (Breaking)</option>
                      <option value="slate">Dark Carbon (Minimal)</option>
                      <option value="gradient-purple">Gradient Purple (Executive)</option>
                      <option value="gradient-ocean">Gradient Ocean (Featured)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300">Image URL / Upload</label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={formImageUrl}
                      onChange={(e) => setFormImageUrl(e.target.value)}
                      placeholder="https://..."
                      className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                    />
                    <label className="px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-bold cursor-pointer text-slate-300 flex items-center space-x-1.5 shrink-0">
                      <Upload className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Upload</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageFileUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-300">CTA Button Text</label>
                    <input
                      type="text"
                      value={formCtaText}
                      onChange={(e) => setFormCtaText(e.target.value)}
                      placeholder="Apply Now / Learn More"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-300">CTA Destination URL</label>
                    <input
                      type="text"
                      value={formCtaUrl}
                      onChange={(e) => setFormCtaUrl(e.target.value)}
                      placeholder="#jobs or https://..."
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                    />
                  </div>
                </div>
              </form>

              {/* RIGHT COLUMN: LIVE CONTEXT PREVIEW */}
              <div className="lg:col-span-6 space-y-2.5 flex flex-col">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-xs font-black uppercase tracking-wider text-slate-300">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    <span>Real-Time Live Context Preview</span>
                  </div>
                  <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    Syncs Live With Form
                  </span>
                </div>

                <div className="bg-slate-950 p-2 sm:p-3 rounded-2xl border border-slate-800 flex-1 overflow-hidden">
                  <CampaignLiveContextPreview
                    headline={formHeadline || 'Your Campaign Headline Will Appear Here'}
                    bodyText={
                      formBodyText ||
                      'Your campaign description and call-to-action details will be highlighted here.'
                    }
                    imageUrl={formImageUrl}
                    ctaText={formCtaText || 'Learn More'}
                    ctaUrl={formCtaUrl || '#jobs'}
                    badgeText={formBadgeText || 'Sponsored'}
                    theme={formTheme}
                    placement={formPlacement}
                    targetPages={formTargetPages}
                    dismissable={formDismissable}
                    portalPages={campaignConfig?.portalPages}
                  />
                </div>
              </div>
            </div>

            <div className="pt-3 flex items-center justify-end space-x-2.5 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsEditorOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="campaign-ops-ad-form"
                className="px-5 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 rounded-xl text-xs font-black shadow-lg shadow-emerald-500/20 cursor-pointer"
              >
                {editingAd ? 'Save Campaign Updates' : 'Publish Administrative Campaign'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. GRANULAR DATE RANGE EDIT MODAL                                         */}
      {/* ========================================================================= */}
      {editingDateAd && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-purple-400" />
                <span>Configure Granular Campaign Date Range</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingDateAd(null)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="text-xs text-slate-400">
              Editing scheduling window for:{' '}
              <span className="font-bold text-white">{editingDateAd.title}</span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">
                  Granular Start Date &amp; Time:
                </label>
                <input
                  type="datetime-local"
                  value={editStartDate}
                  onChange={(e) => setEditStartDate(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-xs focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">
                  Granular End Date &amp; Time:
                </label>
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
                type="button"
                onClick={() => setEditingDateAd(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveDateRange}
                className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black text-xs shadow-lg shadow-purple-600/30 cursor-pointer"
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
