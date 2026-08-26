import React, { useState } from 'react';
import { 
  Advertisement, 
  AdType, 
  AdTargetPage, 
  AdPlacement, 
  AdStatus, 
  AdTheme, 
  AdDurationUnit,
  AdPricingConfig,
  DEFAULT_AD_PRICING_CONFIG,
  CampaignCustomizationConfig,
  DEFAULT_CAMPAIGN_CUSTOMIZATION_CONFIG,
  calculateCampaignCost,
  getPlacementDisplayName,
  getPageDisplayName,
  formatTimeRemaining,
  isAdCurrentlyRunning,
  AD_BANNER_PRESETS 
} from '../../types/ad';
import { AdminCampaignCustomizer } from './AdminCampaignCustomizer';
import { CampaignLiveContextPreview } from './CampaignLiveContextPreview';
import { 
  Megaphone, 
  Plus, 
  Sparkles, 
  Eye, 
  MousePointerClick, 
  Percent, 
  Smartphone, 
  Image as ImageIcon, 
  Layers, 
  Edit3, 
  Trash2, 
  Copy, 
  Play, 
  Pause, 
  CheckCircle2, 
  X, 
  ExternalLink, 
  ArrowRight, 
  Send, 
  Upload, 
  Filter, 
  Search,
  Bell,
  Zap,
  ShieldCheck,
  RefreshCw,
  Clock,
  AlertCircle,
  XCircle,
  Calendar,
  DollarSign,
  Receipt,
  Settings,
  Users,
  Check,
  Sliders
} from 'lucide-react';

interface AdminAdHubProps {
  ads: Advertisement[];
  onAddAd: (ad: Advertisement) => void;
  onUpdateAd: (ad: Advertisement) => void;
  onDeleteAd: (adId: string) => void;
  onResetAdMetrics: (adId?: string) => void;
  pricingConfig?: AdPricingConfig;
  onUpdatePricingConfig?: (config: AdPricingConfig) => void;
  campaignConfig?: CampaignCustomizationConfig;
  onUpdateCampaignConfig?: (config: CampaignCustomizationConfig) => void;
  onApproveAd?: (adId: string) => void;
  onRejectAd?: (adId: string, reason: string) => void;
}

export const AdminAdHub: React.FC<AdminAdHubProps> = ({
  ads,
  onAddAd,
  onUpdateAd,
  onDeleteAd,
  onResetAdMetrics,
  pricingConfig = DEFAULT_AD_PRICING_CONFIG,
  onUpdatePricingConfig,
  campaignConfig = DEFAULT_CAMPAIGN_CUSTOMIZATION_CONFIG,
  onUpdateCampaignConfig,
  onApproveAd,
  onRejectAd
}) => {
  // Main Sub-Tab: Directory, Pending Approvals, Placement Slots, Campaign Customizer, Pricing Engine
  const [activeTab, setActiveTab] = useState<'directory' | 'approvals' | 'slots' | 'customizer' | 'pricing'>('approvals');

  // Filters for Directory
  const [filterType, setFilterType] = useState<string>('all');
  const [filterPage, setFilterPage] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modal State for Create/Edit
  const [isEditorOpen, setIsEditorOpen] = useState<boolean>(false);
  const [editingAd, setEditingAd] = useState<Advertisement | null>(null);
  
  // Rejection Modal State
  const [rejectingAd, setRejectingAd] = useState<Advertisement | null>(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState<string>('Creative image resolution is too low and does not meet portal quality guidelines.');
  const [customRejectionReason, setCustomRejectionReason] = useState<string>('');

  // Live Simulator State
  const [previewAd, setPreviewAd] = useState<Advertisement | null>(null);
  const [simulatorMode, setSimulatorMode] = useState<'desktop-banner' | 'feed-inline' | 'popup-modal' | 'toast-float' | 'sms-phone'>('desktop-banner');

  // Pricing Matrix Form State
  const [editablePricing, setEditablePricing] = useState<AdPricingConfig>(pricingConfig);
  const [isPricingSaved, setIsPricingSaved] = useState<boolean>(false);

  // Form State for Create/Edit
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

  // Duration State for Form
  const [formDurationUnit, setFormDurationUnit] = useState<AdDurationUnit>('days');
  const [formDurationValue, setFormDurationValue] = useState<number>(1);

  // SMS specific state
  const [formSmsSenderId, setFormSmsSenderId] = useState('HybridJobsPK');
  const [formSmsAudience, setFormSmsAudience] = useState<'All Registered Users' | 'Pro Subscribers Only' | 'Job Seekers' | 'Employers'>('All Registered Users');

  // Pending Approvals List
  const pendingAds = ads.filter((a) => a.status === 'pending_approval' || a.approvalStatus === 'Pending');

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingAd(null);
    setFormTitle('New Administrative Campaign');
    setFormType('banner');
    setFormTargetPages(['all']);
    setFormPlacement('top-header');
    setFormStatus('active');
    setFormDurationUnit('days');
    setFormDurationValue(7);
    setFormHeadline('Accelerate Your Career with Top Verified Opportunities');
    setFormBodyText('Explore verified high-paying local and international remote positions with direct employer contracts.');
    setFormImageUrl('https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=1200&auto=format&fit=crop&q=80');
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

  // Open Edit Modal
  const handleOpenEdit = (ad: Advertisement) => {
    setEditingAd(ad);
    setFormTitle(ad.title);
    setFormType(ad.type);
    setFormTargetPages(ad.targetPages);
    setFormPlacement(ad.placement);
    setFormStatus(ad.status);
    setFormDurationUnit(ad.durationUnit || 'days');
    setFormDurationValue(ad.durationValue || 1);
    setFormHeadline(ad.headline);
    setFormBodyText(ad.bodyText);
    setFormImageUrl(ad.imageUrl || '');
    setFormCtaText(ad.ctaText || '');
    setFormCtaUrl(ad.ctaUrl || '');
    setFormBadgeText(ad.badgeText || '');
    setFormTheme(ad.theme || 'emerald');
    setFormDismissable(ad.dismissable);
    setFormAutoCloseDelay(ad.autoCloseDelay || 0);
    setFormSmsSenderId(ad.smsSenderId || 'HybridJobsPK');
    setFormSmsAudience(ad.smsAudience || 'All Registered Users');
    setIsEditorOpen(true);
  };

  // Save Ad (Create / Update)
  const handleSaveAd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formHeadline.trim()) {
      alert('Please provide a headline or message for the advertisement.');
      return;
    }

    const calc = calculateCampaignCost(
      editablePricing,
      formDurationUnit,
      formDurationValue,
      formPlacement,
      formTargetPages,
      formType === 'sms' ? 3450 : 0
    );

    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 16);
    const endTimestamp = new Date(Date.now() + calc.durationHours * 60 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 16);

    const adData: Advertisement = {
      id: editingAd ? editingAd.id : 'ad-' + Date.now(),
      title: formTitle.trim() || 'Untitled Campaign',
      type: formType,
      targetPages: formTargetPages.length > 0 ? formTargetPages : ['all'],
      placement: formPlacement,
      status: formStatus,
      approvalStatus: editingAd?.approvalStatus || 'Approved',
      submittedByUserId: editingAd?.submittedByUserId || 'admin',
      submittedByUserName: editingAd?.submittedByUserName || 'System Admin',
      durationUnit: formDurationUnit,
      durationValue: formDurationValue,
      durationDisplay: calc.durationDisplay,
      scheduledStartAt: editingAd?.scheduledStartAt || nowStr,
      scheduledEndAt: editingAd?.scheduledEndAt || endTimestamp,
      campaignCostPkr: editingAd?.campaignCostPkr || calc.totalCostPkr,
      paymentStatus: 'Paid',
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
      smsRecipientsCount: formType === 'sms' ? (editingAd?.smsRecipientsCount || 3450) : undefined,
      smsSentAt: formType === 'sms' ? (editingAd?.smsSentAt || nowStr) : undefined,
      smsStatus: formType === 'sms' ? 'Sent' : undefined,
      impressions: editingAd ? editingAd.impressions : 0,
      clicks: editingAd ? editingAd.clicks : 0,
      createdAt: editingAd ? editingAd.createdAt : nowStr,
      updatedAt: nowStr
    };

    if (editingAd) {
      onUpdateAd(adData);
    } else {
      onAddAd(adData);
    }

    setIsEditorOpen(false);
    setEditingAd(null);
  };

  // Approve Ad Handler
  const handleApprove = (ad: Advertisement) => {
    if (onApproveAd) {
      onApproveAd(ad.id);
    } else {
      const now = new Date();
      const nowStr = now.toISOString().replace('T', ' ').substring(0, 16);
      
      const calc = calculateCampaignCost(
        editablePricing,
        ad.durationUnit || 'days',
        ad.durationValue || 1,
        ad.placement,
        ad.targetPages
      );
      
      const endTimestamp = new Date(now.getTime() + calc.durationHours * 60 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 16);

      onUpdateAd({
        ...ad,
        status: 'active',
        approvalStatus: 'Approved',
        scheduledStartAt: nowStr,
        scheduledEndAt: endTimestamp,
        approvedAt: nowStr,
        approvedBy: 'Admin'
      });
    }

    alert(`Campaign "${ad.title}" has been APPROVED and is now LIVE on ${getPlacementDisplayName(ad.placement)}!`);
  };

  // Confirm Rejection Handler
  const handleConfirmRejection = () => {
    if (!rejectingAd) return;

    const resolvedReason = rejectionReasonInput === 'Other (Specify Custom Reason)' ? (customRejectionReason || 'Violates advertising policy') : rejectionReasonInput;

    if (onRejectAd) {
      onRejectAd(rejectingAd.id, resolvedReason);
    } else {
      onUpdateAd({
        ...rejectingAd,
        status: 'rejected',
        approvalStatus: 'Rejected',
        rejectionReason: resolvedReason,
        rejectedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
        paymentStatus: 'Refunded'
      });
    }

    alert(`Campaign "${rejectingAd.title}" has been REJECTED. PKR ${(rejectingAd.campaignCostPkr || 0).toLocaleString()} has been refunded to the user's wallet.`);
    setRejectingAd(null);
  };

  // Save Pricing Configuration
  const handleSavePricingConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (onUpdatePricingConfig) {
      onUpdatePricingConfig(editablePricing);
    }
    setIsPricingSaved(true);
    setTimeout(() => setIsPricingSaved(false), 2000);
    alert('Advertising Rate Card & Matrix Configuration saved successfully!');
  };

  // Image Upload helper
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

  // Total Performance Metrics
  const totalImpressions = ads.reduce((acc, curr) => acc + (curr.impressions || 0), 0);
  const totalClicks = ads.reduce((acc, curr) => acc + (curr.clicks || 0), 0);
  const overallCtr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : '0.00';
  const activeCount = ads.filter((a) => a.status === 'active').length;

  // Filtered Ads Directory
  const filteredAds = ads.filter((ad) => {
    if (filterType !== 'all' && ad.type !== filterType) return false;
    if (filterStatus !== 'all' && ad.status !== filterStatus) return false;
    if (filterPage !== 'all') {
      if (!ad.targetPages.includes('all') && !ad.targetPages.includes(filterPage as AdTargetPage)) {
        return false;
      }
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        ad.title.toLowerCase().includes(q) ||
        ad.headline.toLowerCase().includes(q) ||
        (ad.submittedByUserName && ad.submittedByUserName.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="space-y-6 text-white">
      
      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-semibold">Pending Approvals</div>
            <div className="text-xl font-black text-amber-300">{pendingAds.length} <span className="text-xs font-normal text-slate-500">Queued</span></div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
            <Megaphone className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-semibold">Active Campaigns</div>
            <div className="text-xl font-black text-white">{activeCount} <span className="text-xs font-normal text-slate-500">/ {ads.length} Total</span></div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
            <Eye className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-semibold">Total Impressions</div>
            <div className="text-xl font-black text-indigo-300">{totalImpressions.toLocaleString()}</div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center border border-teal-500/30">
            <MousePointerClick className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-semibold">Total Clicks & CTR</div>
            <div className="text-xl font-black text-teal-300">{totalClicks.toLocaleString()} ({overallCtr}%)</div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center border border-purple-500/30">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-semibold">Rate Matrix</div>
            <div className="text-xl font-black text-purple-300">PKR {editablePricing.dailyRatePkr}/day</div>
          </div>
        </div>
      </div>

      {/* Main Admin Sub-Tabs Navigation */}
      <div className="flex items-center space-x-2 border-b border-slate-800 pb-3 overflow-x-auto text-xs font-bold">
        <button
          onClick={() => setActiveTab('approvals')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer ${
            activeTab === 'approvals'
              ? 'bg-amber-500 text-slate-950 font-extrabold shadow-lg shadow-amber-500/20'
              : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Pending Approvals Queue ({pendingAds.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('slots')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer ${
            activeTab === 'slots'
              ? 'bg-emerald-500 text-slate-950 font-extrabold shadow-lg shadow-emerald-500/20'
              : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Placement Slots & Live Timeline</span>
        </button>

        <button
          onClick={() => setActiveTab('customizer')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer ${
            activeTab === 'customizer'
              ? 'bg-indigo-500 text-white font-extrabold shadow-lg shadow-indigo-500/20'
              : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Campaign Options & Page Scheduler</span>
        </button>

        <button
          onClick={() => setActiveTab('directory')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer ${
            activeTab === 'directory'
              ? 'bg-emerald-500 text-slate-950 font-extrabold shadow-lg shadow-emerald-500/20'
              : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>All Campaigns Directory ({ads.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('pricing')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer ${
            activeTab === 'pricing'
              ? 'bg-emerald-500 text-slate-950 font-extrabold shadow-lg shadow-emerald-500/20'
              : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>Rate Card & Pricing Matrix</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: PENDING APPROVALS QUEUE */}
      {/* ========================================================================= */}
      {activeTab === 'approvals' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex items-center justify-between">
            <div>
              <h3 className="text-base font-black text-white flex items-center space-x-2">
                <Clock className="w-5 h-5 text-amber-400" />
                <span>User Campaign Approval Queue</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Review self-serve advertiser submissions. Approve to publish immediately, or reject with a reason to initiate an automatic wallet refund.
              </p>
            </div>
            <span className="px-3 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full text-xs font-bold font-mono">
              {pendingAds.length} Awaiting Verification
            </span>
          </div>

          {pendingAds.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/20">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h4 className="text-lg font-bold text-white">No Pending Campaign Approvals</h4>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                All user submitted campaigns have been reviewed. New advertiser submissions will appear here automatically.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {pendingAds.map((ad) => (
                <div key={ad.id} className="bg-slate-900 border border-amber-500/30 rounded-2xl p-5 shadow-xl space-y-4">
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    
                    {/* Left details */}
                    <div className="flex items-start space-x-4">
                      {ad.imageUrl ? (
                        <img src={ad.imageUrl} alt={ad.headline} className="w-20 h-20 rounded-xl object-cover border border-slate-700 shadow-md shrink-0" />
                      ) : (
                        <div className="w-20 h-20 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-500 shrink-0">
                          <ImageIcon className="w-8 h-8" />
                        </div>
                      )}

                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[11px] font-black uppercase">
                            Pending Admin Review
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 text-[10px] font-semibold">
                            {getPlacementDisplayName(ad.placement)}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 text-[10px] font-bold">
                            ⏱️ {ad.durationDisplay || '24 Hours'}
                          </span>
                        </div>

                        <h4 className="text-base font-bold text-white">{ad.headline}</h4>
                        <p className="text-xs text-slate-400 max-w-2xl">{ad.bodyText}</p>

                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 pt-1">
                          <span>Advertiser: <strong className="text-white">{ad.submittedByUserName || 'Portal User'} ({ad.submittedByUserEmail || 'user@example.com'})</strong></span>
                          <span>•</span>
                          <span>Fee Paid: <strong className="text-emerald-400 font-mono">PKR {(ad.campaignCostPkr || 0).toLocaleString()}</strong></span>
                          <span>•</span>
                          <span>Target Pages: <strong className="text-slate-200">{ad.targetPages.map(getPageDisplayName).join(', ')}</strong></span>
                        </div>
                      </div>
                    </div>

                    {/* Right actions */}
                    <div className="flex items-center space-x-2 w-full md:w-auto justify-end">
                      <button
                        onClick={() => {
                          setPreviewAd(ad);
                          setSimulatorMode(ad.placement === 'top-header' ? 'desktop-banner' : ad.placement === 'popup-modal' ? 'popup-modal' : 'feed-inline');
                        }}
                        className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center space-x-1.5 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Preview</span>
                      </button>

                      <button
                        onClick={() => handleApprove(ad)}
                        className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-xs font-black flex items-center space-x-1.5 shadow-lg shadow-emerald-500/20 cursor-pointer active:scale-95"
                      >
                        <Check className="w-4 h-4 stroke-[3]" />
                        <span>Approve & Publish</span>
                      </button>

                      <button
                        onClick={() => {
                          setRejectingAd(ad);
                          setRejectionReasonInput('Creative image resolution is too low and does not meet portal quality guidelines.');
                        }}
                        className="px-4 py-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded-xl text-xs font-bold flex items-center space-x-1.5 cursor-pointer active:scale-95"
                      >
                        <X className="w-4 h-4 stroke-[3]" />
                        <span>Reject & Refund</span>
                      </button>
                    </div>

                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: PLACEMENT SLOTS & SCHEDULE TIMELINE */}
      {/* ========================================================================= */}
      {activeTab === 'slots' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex items-center justify-between">
            <div>
              <h3 className="text-base font-black text-white flex items-center space-x-2">
                <Calendar className="w-5 h-5 text-emerald-400" />
                <span>Placement Slots & Live Running Schedule</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Inspect which campaign is currently live in each placement slot, when it expires, and which campaign is queued next.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {[
              { slot: 'top-header' as AdPlacement, title: 'Top Sticky Header Announcement Banner', desc: 'Sits above navigation bar on all pages' },
              { slot: 'feed-inline' as AdPlacement, title: 'Job Listings Feed Inline Card', desc: 'Appears after every 3-4 job cards' },
              { slot: 'popup-modal' as AdPlacement, title: 'Centered Pop-up Lightbox Modal', desc: 'Prominent modal on user entrance' },
              { slot: 'toast-float' as AdPlacement, title: 'Floating Toast Notification Alert', desc: 'Bottom-right alert card' },
              { slot: 'sidebar' as AdPlacement, title: 'Sidebar / Filter Widget Card', desc: 'Filter column promotional box' },
              { slot: 'sms-broadcast' as AdPlacement, title: 'Direct SMS Text Broadcast', desc: 'Direct phone dispatch to subscribers' }
            ].map(({ slot, title, desc }) => {
              const currentRunningAds = ads.filter((a) => a.placement === slot && isAdCurrentlyRunning(a));
              const queuedAds = ads.filter((a) => a.placement === slot && (a.status === 'pending_approval' || a.approvalStatus === 'Approved') && !isAdCurrentlyRunning(a));
              const activeSlotAd = currentRunningAds[0];

              return (
                <div key={slot} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
                  
                  {/* Slot Header */}
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div>
                      <div className="text-sm font-black text-white">{title}</div>
                      <div className="text-[11px] text-slate-400">{desc}</div>
                    </div>
                    {activeSlotAd ? (
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-black uppercase flex items-center space-x-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping mr-1"></span>
                        <span>Slot Occupied</span>
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 text-[10px] font-bold uppercase">
                        Slot Available
                      </span>
                    )}
                  </div>

                  {/* Currently Running Card */}
                  <div className="space-y-2">
                    <div className="text-[11px] font-bold uppercase text-slate-400">Currently Running Campaign:</div>
                    {activeSlotAd ? (
                      <div className="p-4 rounded-2xl bg-slate-950 border border-emerald-500/40 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-white line-clamp-1">{activeSlotAd.headline}</span>
                          <span className="text-[11px] font-black text-emerald-400 font-mono">
                            {formatTimeRemaining(activeSlotAd.scheduledEndAt)}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 line-clamp-1">{activeSlotAd.bodyText}</p>
                        <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-800/80">
                          <span>By: <strong className="text-slate-300">{activeSlotAd.submittedByUserName || 'System Admin'}</strong></span>
                          <span>Ends: <strong className="text-slate-300">{activeSlotAd.scheduledEndAt || 'Ongoing'}</strong></span>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 rounded-2xl bg-slate-950/60 border border-dashed border-slate-800 text-center text-xs text-slate-500">
                        No active campaign running in this placement slot right now.
                      </div>
                    )}
                  </div>

                  {/* Next in Line Queue */}
                  <div className="space-y-1.5 pt-1">
                    <div className="text-[11px] font-bold uppercase text-slate-400 flex items-center justify-between">
                      <span>Next in Queue / Scheduled:</span>
                      <span className="text-[10px] text-slate-500">{queuedAds.length} in queue</span>
                    </div>

                    {queuedAds.length > 0 ? (
                      <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-indigo-300 line-clamp-1">{queuedAds[0].headline}</span>
                          <span className="text-[10px] text-amber-400 font-bold capitalize">{queuedAds[0].status.replace('_', ' ')}</span>
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Advertiser: {queuedAds[0].submittedByUserName || 'User'} • Duration: {queuedAds[0].durationDisplay || '24 Hours'}
                        </div>
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-500 italic">
                        No campaigns queued for this slot.
                      </div>
                    )}
                  </div>

                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: ALL CAMPAIGNS DIRECTORY */}
      {/* ========================================================================= */}
      {activeTab === 'directory' && (
        <div className="space-y-4">
          
          {/* Control Bar: Search & Action */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-black text-white flex items-center space-x-2">
                  <Layers className="w-5 h-5 text-emerald-400" />
                  <span>Campaigns Master Directory</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Manage, duplicate, toggle status, and inspect analytics for all user and admin campaigns.
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => onResetAdMetrics()}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold flex items-center space-x-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Reset Counters</span>
                </button>

                <button
                  onClick={handleOpenCreate}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-xs font-black flex items-center space-x-1.5 shadow-lg shadow-emerald-500/20 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>New Admin Campaign</span>
                </button>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-800">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search campaigns..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                />
              </div>

              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
              >
                <option value="all">All Formats</option>
                <option value="banner">Image Banner</option>
                <option value="popup">Modal Pop-up</option>
                <option value="notification">Toast Float</option>
                <option value="sms">SMS Broadcast</option>
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active (Running)</option>
                <option value="pending_approval">Pending Approval</option>
                <option value="paused">Paused</option>
                <option value="rejected">Rejected</option>
              </select>

              <select
                value={filterPage}
                onChange={(e) => setFilterPage(e.target.value)}
                className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
              >
                <option value="all">All Pages</option>
                <option value="jobs">Jobs Feed</option>
                <option value="cv">ATS CV Builder</option>
                <option value="alerts">Job Alerts</option>
                <option value="dashboard">Dashboard</option>
              </select>
            </div>
          </div>

          {/* Directory Cards */}
          <div className="grid grid-cols-1 gap-4">
            {filteredAds.map((ad) => (
              <div key={ad.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  
                  <div className="flex items-start space-x-4">
                    {ad.imageUrl ? (
                      <img src={ad.imageUrl} alt={ad.headline} className="w-16 h-16 rounded-xl object-cover border border-slate-700 shrink-0" />
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-500 shrink-0">
                        <ImageIcon className="w-6 h-6" />
                      </div>
                    )}

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                          ad.status === 'active' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                          ad.status === 'pending_approval' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                          ad.status === 'rejected' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
                          'bg-slate-800 text-slate-400'
                        }`}>
                          {ad.status.replace('_', ' ')}
                        </span>
                        <span className="text-[10px] font-semibold text-slate-400">
                          {getPlacementDisplayName(ad.placement)}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          • {ad.durationDisplay || '24 Hours'}
                        </span>
                      </div>

                      <h4 className="text-sm font-bold text-white">{ad.headline}</h4>
                      <div className="text-xs text-slate-400 line-clamp-1 max-w-xl">{ad.bodyText}</div>

                      <div className="text-[11px] text-slate-500">
                        Advertiser: <strong className="text-slate-300">{ad.submittedByUserName || 'Admin'}</strong> • Fee: <strong className="text-emerald-400 font-mono">PKR {(ad.campaignCostPkr || 0).toLocaleString()}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => {
                        setPreviewAd(ad);
                        setSimulatorMode(ad.placement === 'top-header' ? 'desktop-banner' : ad.placement === 'popup-modal' ? 'popup-modal' : 'feed-inline');
                      }}
                      className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl"
                      title="Preview"
                    >
                      <Eye className="w-4 h-4 text-indigo-400" />
                    </button>

                    <button
                      onClick={() => handleOpenEdit(ad)}
                      className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl"
                      title="Edit"
                    >
                      <Edit3 className="w-4 h-4 text-emerald-400" />
                    </button>

                    <button
                      onClick={() => {
                        if (confirm(`Delete campaign "${ad.title}"?`)) {
                          onDeleteAd(ad.id);
                        }
                      }}
                      className="p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-xl"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                </div>

                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 pt-3 border-t border-slate-800/60 text-xs text-slate-400">
                  <div>Impressions: <strong className="text-white">{(ad.impressions || 0).toLocaleString()}</strong></div>
                  <div>Clicks: <strong className="text-white">{(ad.clicks || 0).toLocaleString()}</strong></div>
                  <div>CTR: <strong className="text-white">{(ad.impressions || 0) > 0 ? (((ad.clicks || 0) / ad.impressions) * 100).toFixed(2) : '0.00'}%</strong></div>
                  <div className="text-right text-[11px] text-slate-500">Ends: {ad.scheduledEndAt || 'Ongoing'}</div>
                </div>
              </div>
            ))}
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: CAMPAIGN OPTIONS & PORTAL PAGE SCHEDULER */}
      {/* ========================================================================= */}
      {activeTab === 'customizer' && (
        <AdminCampaignCustomizer
          config={campaignConfig}
          onSaveConfig={(updated) => {
            if (onUpdateCampaignConfig) {
              onUpdateCampaignConfig(updated);
            }
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* TAB 4: RATE CARD & PRICING MATRIX CONFIGURATION */}
      {/* ========================================================================= */}
      {activeTab === 'pricing' && (
        <div className="space-y-6">
          <form onSubmit={handleSavePricingConfig} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
            
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
              <div>
                <h3 className="text-lg font-black text-white flex items-center space-x-2">
                  <Settings className="w-5 h-5 text-emerald-400" />
                  <span>Advertising Rate Card & Matrix Configuration</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Configure base duration rates, placement multipliers, and page distribution charges. Updates take effect immediately in the user campaign calculator.
                </p>
              </div>

              <button
                type="submit"
                className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black text-xs sm:text-sm rounded-xl shadow-lg shadow-emerald-500/20 flex items-center space-x-2 cursor-pointer active:scale-95"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Save Rate Matrix</span>
              </button>
            </div>

            {/* 1. Base Duration Rates */}
            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center space-x-2">
                <Clock className="w-4 h-4 text-emerald-400" />
                <span>1. Baseline Timeframe Rates (PKR)</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">Base Hourly Rate (PKR/hour)</label>
                  <input
                    type="number"
                    min="10"
                    step="10"
                    value={editablePricing.hourlyRatePkr}
                    onChange={(e) => setEditablePricing({ ...editablePricing, hourlyRatePkr: parseInt(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm font-black text-emerald-400 font-mono"
                  />
                  <div className="text-[10px] text-slate-500">For flash hourly campaigns (6h, 12h, custom)</div>
                </div>

                <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">24 Hours / 1 Day Rate (PKR)</label>
                  <input
                    type="number"
                    min="100"
                    step="50"
                    value={editablePricing.dailyRatePkr}
                    onChange={(e) => setEditablePricing({ ...editablePricing, dailyRatePkr: parseInt(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm font-black text-emerald-400 font-mono"
                  />
                  <div className="text-[10px] text-slate-500">Standard 24-hour full-day slot</div>
                </div>

                <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">1 Week / 7 Days Rate (PKR)</label>
                  <input
                    type="number"
                    min="500"
                    step="100"
                    value={editablePricing.weeklyRatePkr}
                    onChange={(e) => setEditablePricing({ ...editablePricing, weeklyRatePkr: parseInt(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm font-black text-indigo-400 font-mono"
                  />
                  <div className="text-[10px] text-slate-500">Weekly hiring acceleration package</div>
                </div>

                <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">1 Month / 30 Days Rate (PKR)</label>
                  <input
                    type="number"
                    min="1000"
                    step="500"
                    value={editablePricing.monthlyRatePkr}
                    onChange={(e) => setEditablePricing({ ...editablePricing, monthlyRatePkr: parseInt(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm font-black text-amber-400 font-mono"
                  />
                  <div className="text-[10px] text-slate-500">Monthly corporate sponsor tier</div>
                </div>
              </div>
            </div>

            {/* 2. Placement Multipliers */}
            <div className="space-y-3 pt-2">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center space-x-2">
                <Layers className="w-4 h-4 text-indigo-400" />
                <span>2. Placement Multipliers (Weight Factors)</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {Object.entries(editablePricing.placementMultipliers).map(([placementKey, val]) => (
                  <div key={placementKey} className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-white">{getPlacementDisplayName(placementKey as AdPlacement)}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{placementKey}</div>
                    </div>
                    <div className="w-24">
                      <input
                        type="number"
                        step="0.05"
                        min="0.1"
                        max="5.0"
                        value={val}
                        onChange={(e) => {
                          const newM = parseFloat(e.target.value) || 1.0;
                          setEditablePricing({
                            ...editablePricing,
                            placementMultipliers: {
                              ...editablePricing.placementMultipliers,
                              [placementKey]: newM
                            }
                          });
                        }}
                        className="w-full px-2.5 py-1 bg-slate-900 border border-slate-700 rounded-lg text-xs font-bold text-emerald-400 text-right font-mono"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. Page Multipliers */}
            <div className="space-y-3 pt-2">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center space-x-2">
                <Zap className="w-4 h-4 text-amber-400" />
                <span>3. Portal Page Distribution Multipliers</span>
              </h4>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {Object.entries(editablePricing.pageMultipliers).map(([pageKey, val]) => (
                  <div key={pageKey} className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1">
                    <div className="text-xs font-bold text-white line-clamp-1">{getPageDisplayName(pageKey as AdTargetPage)}</div>
                    <input
                      type="number"
                      step="0.05"
                      min="0.1"
                      max="3.0"
                      value={val}
                      onChange={(e) => {
                        const newM = parseFloat(e.target.value) || 1.0;
                        setEditablePricing({
                          ...editablePricing,
                          pageMultipliers: {
                            ...editablePricing.pageMultipliers,
                            [pageKey]: newM
                          }
                        });
                      }}
                      className="w-full px-2.5 py-1 bg-slate-900 border border-slate-700 rounded-lg text-xs font-bold text-indigo-300 text-right font-mono"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* 4. SMS & Minimums */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-1.5">
                <label className="text-xs font-bold text-slate-300">SMS Broadcast Dispatch Fee (PKR / Contact)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0.5"
                  value={editablePricing.smsPerContactRatePkr}
                  onChange={(e) => setEditablePricing({ ...editablePricing, smsPerContactRatePkr: parseFloat(e.target.value) || 1.5 })}
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm font-black text-purple-300 font-mono"
                />
              </div>

              <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Minimum User Wallet Deposit (PKR)</label>
                <input
                  type="number"
                  min="100"
                  step="100"
                  value={editablePricing.minDepositAmountPkr}
                  onChange={(e) => setEditablePricing({ ...editablePricing, minDepositAmountPkr: parseInt(e.target.value) || 500 })}
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm font-black text-emerald-400 font-mono"
                />
              </div>
            </div>

          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* REJECTION MODAL */}
      {/* ========================================================================= */}
      {rejectingAd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-5 relative">
            <button
              onClick={() => setRejectingAd(null)}
              className="absolute top-5 right-5 p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
            >
              <XCircle className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <div className="flex items-center space-x-2 text-rose-400 text-xs font-bold uppercase">
                <XCircle className="w-4 h-4" />
                <span>Reject & Refund Campaign</span>
              </div>
              <h3 className="text-xl font-black text-white">Specify Rejection Reason</h3>
              <p className="text-xs text-slate-400">
                The reason will be communicated to <strong>{rejectingAd.submittedByUserName}</strong> and PKR {(rejectingAd.campaignCostPkr || 0).toLocaleString()} will be automatically refunded to their wallet.
              </p>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-300">Select Standard Reason</label>
              <select
                value={rejectionReasonInput}
                onChange={(e) => setRejectionReasonInput(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
              >
                <option value="Creative image resolution is too low and does not meet portal quality guidelines.">🖼️ Creative image resolution is too low / blurred</option>
                <option value="Headline or description contains misleading or unverified claims.">⚠️ Headline contains misleading or unverified claims</option>
                <option value="Destination CTA URL is broken, inaccessible, or violates advertising guidelines.">🔗 Destination CTA URL is broken or invalid</option>
                <option value="Content promotes prohibited financial or unauthorized multi-level schemes.">🚫 Content violates prohibited advertising policy</option>
                <option value="Other (Specify Custom Reason)">✏️ Other (Specify Custom Reason)</option>
              </select>

              {rejectionReasonInput === 'Other (Specify Custom Reason)' && (
                <textarea
                  rows={3}
                  value={customRejectionReason}
                  onChange={(e) => setCustomRejectionReason(e.target.value)}
                  placeholder="Type specific feedback for the advertiser..."
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                ></textarea>
              )}
            </div>

            <div className="pt-2 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setRejectingAd(null)}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmRejection}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-black shadow-lg shadow-rose-600/20"
              >
                Confirm Rejection & Refund Wallet
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CREATE / EDIT MODAL WITH LIVE CONTEXT PREVIEW */}
      {/* ========================================================================= */}
      {isEditorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-8 max-w-7xl w-full shadow-2xl space-y-6 my-4 max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
                  <Megaphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-black text-white">
                    {editingAd ? 'Edit Campaign & Target Rules' : 'Create Administrative Campaign'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Configure campaign creative parameters and observe the real-time preview across portal pages.
                  </p>
                </div>
              </div>

              <button 
                onClick={() => setIsEditorOpen(false)} 
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-y-auto flex-1 pr-1">
              {/* LEFT COLUMN: CAMPAIGN CONFIGURATION FORM */}
              <form id="admin-ad-form" onSubmit={handleSaveAd} className="lg:col-span-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="text-xs font-bold text-slate-300">Campaign Title</label>
                    <input
                      type="text"
                      required
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      placeholder="e.g. Featured Govt Jobs Digest"
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-300">Ad Format</label>
                    <select
                      value={formType}
                      onChange={(e) => setFormType(e.target.value as AdType)}
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                    >
                      <option value="banner">Banner</option>
                      <option value="popup">Pop-up Modal</option>
                      <option value="notification">Toast Float</option>
                      <option value="text">Text Box</option>
                      <option value="sms">SMS Broadcast</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="text-xs font-bold text-slate-300">Placement Slot</label>
                    <select
                      value={formPlacement}
                      onChange={(e) => setFormPlacement(e.target.value as AdPlacement)}
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                    >
                      <option value="top-header">Top Header Banner</option>
                      <option value="feed-inline">Job Feed Inline Card</option>
                      <option value="popup-modal">Popup Modal</option>
                      <option value="toast-float">Toast Float</option>
                      <option value="sidebar">Sidebar Widget</option>
                      <option value="sms-broadcast">SMS Broadcast</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-300">Status</label>
                    <select
                      value={formStatus}
                      onChange={(e) => setFormStatus(e.target.value as AdStatus)}
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                    >
                      <option value="active">Active (Live Immediately)</option>
                      <option value="paused">Paused</option>
                      <option value="pending_approval">Pending Review</option>
                    </select>
                  </div>
                </div>

                {/* Target Portal Pages */}
                <div className="space-y-1.5 p-3.5 bg-slate-950 border border-slate-800 rounded-2xl">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-300">Target Portal Pages</label>
                    <span className="text-[10px] text-emerald-400 font-semibold">Multi-Page Distribution</span>
                  </div>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
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
                              const withoutAll = formTargetPages.filter(p => p !== 'all');
                              if (isChecked) {
                                const next = withoutAll.filter(p => p !== pg.id);
                                setFormTargetPages(next.length ? next : ['all']);
                              } else {
                                setFormTargetPages([...withoutAll, pg.id as AdTargetPage]);
                              }
                            }
                          }}
                          className={`px-3 py-2 rounded-xl text-xs font-bold transition-all text-left flex items-center justify-between cursor-pointer border ${
                            isChecked
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                              : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800'
                          }`}
                        >
                          <span className="text-[11px] truncate">{pg.label}</span>
                          {isChecked && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 ml-1" />}
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
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300">Body Description</label>
                  <textarea
                    rows={2}
                    value={formBodyText}
                    onChange={(e) => setFormBodyText(e.target.value)}
                    placeholder="Short description highlighting key opportunity details..."
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                  ></textarea>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="text-xs font-bold text-slate-300">Badge Label</label>
                    <input
                      type="text"
                      value={formBadgeText}
                      onChange={(e) => setFormBadgeText(e.target.value)}
                      placeholder="Sponsored Partner"
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-300">Color Theme</label>
                    <select
                      value={formTheme}
                      onChange={(e) => setFormTheme(e.target.value as AdTheme)}
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                    >
                      <option value="emerald">Emerald Green (Standard)</option>
                      <option value="indigo">Indigo Blue (Pro)</option>
                      <option value="amber">Amber Gold (Urgent)</option>
                      <option value="rose">Rose Red (Breaking)</option>
                      <option value="purple">Purple (Executive)</option>
                      <option value="dark">Dark Carbon (Minimal)</option>
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
                      className="flex-1 px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                    />
                    <label className="px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-bold cursor-pointer text-slate-300 flex items-center space-x-1.5">
                      <Upload className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Upload</span>
                      <input type="file" accept="image/*" onChange={handleImageFileUpload} className="hidden" />
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="text-xs font-bold text-slate-300">CTA Button Text</label>
                    <input
                      type="text"
                      value={formCtaText}
                      onChange={(e) => setFormCtaText(e.target.value)}
                      placeholder="Apply Now / Learn More"
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-300">CTA Destination URL</label>
                    <input
                      type="text"
                      value={formCtaUrl}
                      onChange={(e) => setFormCtaUrl(e.target.value)}
                      placeholder="#jobs or https://..."
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                    />
                  </div>
                </div>
              </form>

              {/* RIGHT COLUMN: LIVE CONTEXT SIMULATOR */}
              <div className="lg:col-span-6 space-y-3 flex flex-col">
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
                    bodyText={formBodyText || 'Your campaign description and call-to-action details will be highlighted here.'}
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

            <div className="pt-4 flex items-center justify-end space-x-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsEditorOpen(false)}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="admin-ad-form"
                className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 rounded-xl text-xs font-black shadow-lg shadow-emerald-500/20 cursor-pointer"
              >
                {editingAd ? 'Save Campaign Updates' : 'Publish Administrative Campaign'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SIMULATOR PREVIEW MODAL */}
      {/* ========================================================================= */}
      {previewAd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-white">Live Simulator Preview</h3>
              <button onClick={() => setPreviewAd(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-3">
              {previewAd.imageUrl && (
                <img src={previewAd.imageUrl} alt={previewAd.headline} className="w-full h-44 rounded-xl object-cover" />
              )}
              <div className="text-[10px] font-black uppercase text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-md inline-block">
                {previewAd.badgeText || 'Sponsored'}
              </div>
              <h4 className="text-sm font-black text-white">{previewAd.headline}</h4>
              <p className="text-xs text-slate-300">{previewAd.bodyText}</p>
              <button className="w-full py-2.5 bg-emerald-500 text-slate-950 font-black text-xs rounded-xl">
                {previewAd.ctaText || 'Learn More'}
              </button>
            </div>

            <div className="flex justify-end">
              <button onClick={() => setPreviewAd(null)} className="px-4 py-2 bg-slate-800 rounded-xl text-xs font-bold">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
