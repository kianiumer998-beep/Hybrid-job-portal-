import React, { useState } from 'react';
import { 
  Advertisement, 
  AdType, 
  AdPlacement, 
  AdTargetPage, 
  AdTheme, 
  AdDurationUnit,
  AdPricingConfig,
  WalletTransaction,
  CampaignCustomizationConfig,
  DEFAULT_AD_PRICING_CONFIG,
  DEFAULT_CAMPAIGN_CUSTOMIZATION_CONFIG,
  calculateCampaignCost,
  getPlacementDisplayName,
  getPageDisplayName,
  formatTimeRemaining,
  isAdCurrentlyRunning,
  isPageScheduledActive,
  validateCampaignTargetPages,
  getOccupiedSlotRangesForPlacement,
  checkSlotDateAvailability,
  getNextAvailableDateForPlacement,
  AD_BANNER_PRESETS
} from '../../types/ad';
import { UserAccount } from '../../types/job';
import { CampaignLiveContextPreview } from './CampaignLiveContextPreview';
import { 
  Megaphone, 
  Plus, 
  Wallet, 
  ArrowUpRight, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  XCircle, 
  Eye, 
  MousePointerClick, 
  Percent, 
  Sparkles, 
  CreditCard, 
  ArrowRight, 
  Layers, 
  Calendar, 
  DollarSign, 
  Copy, 
  Trash2, 
  RefreshCw, 
  Image as ImageIcon, 
  Upload, 
  Smartphone, 
  Check, 
  ShieldCheck, 
  Receipt,
  HelpCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Send,
  Lock,
  Monitor
} from 'lucide-react';

interface UserCampaignHubProps {
  currentUser: UserAccount;
  userAds: Advertisement[];
  allAds?: Advertisement[];
  pricingConfig?: AdPricingConfig;
  campaignConfig?: CampaignCustomizationConfig;
  onDepositWallet: (amount: number, paymentMethod: string) => void;
  onSubmitCampaign: (ad: Advertisement, cost: number) => void;
  onDeleteCampaign: (adId: string) => void;
  onDuplicateCampaign: (ad: Advertisement) => void;
  onOpenGlobalDepositModal?: () => void;
}

export const UserCampaignHub: React.FC<UserCampaignHubProps> = ({
  currentUser,
  userAds,
  allAds = [],
  pricingConfig = DEFAULT_AD_PRICING_CONFIG,
  campaignConfig = DEFAULT_CAMPAIGN_CUSTOMIZATION_CONFIG,
  onDepositWallet,
  onSubmitCampaign,
  onDeleteCampaign,
  onDuplicateCampaign,
  onOpenGlobalDepositModal
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'my-campaigns' | 'create' | 'wallet'>('my-campaigns');
  
  // Status Filter for My Campaigns
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'pending' | 'rejected' | 'completed'>('all');
  
  // Expanded rejection details accordion
  const [expandedRejectionId, setExpandedRejectionId] = useState<string | null>(null);

  // Preview Modal for user ads
  const [previewAd, setPreviewAd] = useState<Advertisement | null>(null);

  // Deposit Modal State
  const [isDepositModalOpen, setIsDepositModalOpen] = useState<boolean>(false);
  const [depositAmountInput, setDepositAmountInput] = useState<number>(2500);
  const [depositPaymentMethod, setDepositPaymentMethod] = useState<'JazzCash' | 'Easypaisa' | 'Bank Raast / IBAN' | 'Visa / Mastercard'>('JazzCash');
  const [depositAccountNumber, setDepositAccountNumber] = useState<string>('0300-1234567');
  const [depositTxRef, setDepositTxRef] = useState<string>('');
  const [isDepositSuccess, setIsDepositSuccess] = useState<boolean>(false);

  // --- Campaign Creation Wizard State ---
  const [formTitle, setFormTitle] = useState<string>('');
  const [formType, setFormType] = useState<AdType>('banner');
  const [formPlacement, setFormPlacement] = useState<AdPlacement>('top-header');
  const [formTargetPages, setFormTargetPages] = useState<AdTargetPage[]>(['alerts']);
  
  // Duration State
  const [selectedDurationId, setSelectedDurationId] = useState<string>('fullday-24h');
  const [customDurationUnit, setCustomDurationUnit] = useState<AdDurationUnit>('days');
  const [customDurationValue, setCustomDurationValue] = useState<number>(1);
  
  // Creative Content
  const [formHeadline, setFormHeadline] = useState<string>('');
  const [formBodyText, setFormBodyText] = useState<string>('');
  const [formImageUrl, setFormImageUrl] = useState<string>('https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=1200&auto=format&fit=crop&q=80');
  const [formCtaText, setFormCtaText] = useState<string>('Learn More');
  const [formCtaUrl, setFormCtaUrl] = useState<string>('#jobs');
  const [formBadgeText, setFormBadgeText] = useState<string>('Featured Partner');
  const [formTheme, setFormTheme] = useState<AdTheme>('indigo');
  const [formDismissable, setFormDismissable] = useState<boolean>(true);
  
  // SMS specific
  const [formSmsSenderId, setFormSmsSenderId] = useState<string>('HybridJobs');
  const [formSmsAudience, setFormSmsAudience] = useState<'All Registered Users' | 'Pro Subscribers Only' | 'Job Seekers' | 'Employers'>('All Registered Users');
  const [formSmsRecipientsCount, setFormSmsRecipientsCount] = useState<number>(2500);

  // Live Context Preview mode switcher: 'context' (Full Portal Simulation) | 'card' (Isolated Card)
  const [previewDisplayMode, setPreviewDisplayMode] = useState<'context' | 'card'>('context');
  const [selectedContextPage, setSelectedContextPage] = useState<string>('alerts');

  // Calculate duration unit & value from preset or custom
  const getResolvedDuration = (): { unit: AdDurationUnit; value: number } => {
    if (selectedDurationId === 'custom') {
      return { unit: customDurationUnit, value: Math.max(1, customDurationValue) };
    }
    const matchedPreset = campaignConfig.durationPresets.find(d => d.id === selectedDurationId);
    if (matchedPreset) {
      return { unit: matchedPreset.unit, value: matchedPreset.value };
    }
    // Fallback standard presets
    if (selectedDurationId === '6h') return { unit: 'hours', value: 6 };
    if (selectedDurationId === '12h') return { unit: 'hours', value: 12 };
    if (selectedDurationId === '24h') return { unit: 'days', value: 1 };
    if (selectedDurationId === '3d') return { unit: 'days', value: 3 };
    if (selectedDurationId === '1w') return { unit: 'weeks', value: 1 };
    if (selectedDurationId === '2w') return { unit: 'weeks', value: 2 };
    if (selectedDurationId === '1m') return { unit: 'months', value: 1 };
    return { unit: 'days', value: 1 };
  };

  const { unit: resolvedDurationUnit, value: resolvedDurationValue } = getResolvedDuration();

  // Compute live price
  const costCalculation = calculateCampaignCost(
    pricingConfig,
    resolvedDurationUnit,
    resolvedDurationValue,
    formPlacement,
    formTargetPages,
    formType === 'sms' ? formSmsRecipientsCount : 0
  );

  const walletBalance = currentUser.walletBalance ?? 12000;
  const isWalletSufficient = walletBalance >= costCalculation.totalCostPkr;
  const walletDeficit = costCalculation.totalCostPkr - walletBalance;

  // Handle Preset Select
  const handleApplyPreset = (preset: typeof AD_BANNER_PRESETS[0]) => {
    setFormHeadline(preset.headline);
    setFormBodyText(preset.bodyText);
    setFormImageUrl(preset.imageUrl);
    setFormCtaText(preset.ctaText);
    setFormCtaUrl(preset.ctaUrl);
    setFormBadgeText(preset.badgeText);
    setFormTheme(preset.theme);
  };

  // Image Upload helper
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
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

  // Submit Campaign with Admin Schedule & Policy Validation
  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formHeadline.trim()) {
      alert('Please enter a headline or message for your campaign.');
      return;
    }

    // 1. Mandatory image rule check
    if (campaignConfig.formRules.requireImage && !formImageUrl.trim()) {
      alert('Admin policy requires an image / banner graphic for all self-serve campaigns.');
      return;
    }

    // 2. Target page schedule and availability validation
    const pageValidation = validateCampaignTargetPages(formTargetPages, campaignConfig.portalPages);
    if (!pageValidation.valid) {
      const reasonsList = pageValidation.blockedPages.map(p => `• ${p.name}: ${p.reason}`).join('\n');
      alert(`Cannot submit campaign due to portal page restrictions:\n\n${reasonsList}\n\nPlease uncheck the restricted pages or select active pages.`);
      return;
    }

    if (!isWalletSufficient) {
      setDepositAmountInput(Math.max(500, walletDeficit));
      setIsDepositModalOpen(true);
      return;
    }

    const newAd: Advertisement = {
      id: 'ad-user-' + Date.now(),
      title: formTitle.trim() || `${getPlacementDisplayName(formPlacement)} Campaign`,
      type: formType,
      targetPages: formTargetPages.length > 0 ? formTargetPages : ['all'],
      placement: formPlacement,
      status: campaignConfig.formRules.requireAdminApproval ? 'pending_approval' : 'active',
      approvalStatus: campaignConfig.formRules.requireAdminApproval ? 'Pending' : 'Approved',
      submittedByUserId: currentUser.id,
      submittedByUserName: currentUser.name,
      submittedByUserEmail: currentUser.email,
      submittedByUserPhone: currentUser.phone || undefined,
      durationUnit: resolvedDurationUnit,
      durationValue: resolvedDurationValue,
      durationDisplay: costCalculation.durationDisplay,
      campaignCostPkr: costCalculation.totalCostPkr,
      paymentStatus: 'Paid',
      headline: formHeadline.trim(),
      bodyText: formBodyText.trim(),
      imageUrl: formImageUrl.trim() || undefined,
      ctaText: formCtaText.trim() || undefined,
      ctaUrl: formCtaUrl.trim() || undefined,
      badgeText: formBadgeText.trim() || undefined,
      theme: formTheme,
      dismissable: formDismissable,
      smsSenderId: formType === 'sms' ? formSmsSenderId : undefined,
      smsAudience: formType === 'sms' ? formSmsAudience : undefined,
      smsRecipientsCount: formType === 'sms' ? formSmsRecipientsCount : undefined,
      impressions: 0,
      clicks: 0,
      createdAt: new Date().toISOString().replace('T', ' ').substring(0, 16)
    };

    onSubmitCampaign(newAd, costCalculation.totalCostPkr);
    
    // Reset form & navigate to my campaigns
    setFormTitle('');
    setFormHeadline('');
    setFormBodyText('');
    setActiveSubTab('my-campaigns');
    alert(`Campaign "${newAd.title}" submitted successfully! PKR ${costCalculation.totalCostPkr.toLocaleString()} has been deducted from your wallet balance. ${campaignConfig.formRules.requireAdminApproval ? 'The portal administrator will review and verify your campaign shortly.' : 'Your campaign is now live!'}`);
  };

  // Process Deposit
  const handleConfirmDeposit = (e: React.FormEvent) => {
    e.preventDefault();
    if (depositAmountInput < (pricingConfig.minDepositAmountPkr || 500)) {
      alert(`Minimum deposit amount is PKR ${(pricingConfig.minDepositAmountPkr || 500).toLocaleString()}`);
      return;
    }

    onDepositWallet(depositAmountInput, depositPaymentMethod);
    setIsDepositSuccess(true);
    setTimeout(() => {
      setIsDepositSuccess(false);
      setIsDepositModalOpen(false);
    }, 1200);
  };

  // Filter user ads
  const filteredUserAds = userAds.filter((ad) => {
    if (statusFilter === 'active') return ad.status === 'active' && ad.approvalStatus === 'Approved';
    if (statusFilter === 'pending') return ad.status === 'pending_approval' || ad.approvalStatus === 'Pending';
    if (statusFilter === 'rejected') return ad.status === 'rejected' || ad.approvalStatus === 'Rejected';
    if (statusFilter === 'completed') return ad.status === 'completed' || (ad.scheduledEndAt && new Date(ad.scheduledEndAt.replace(' ', 'T')).getTime() < Date.now());
    return true;
  });

  const totalUserSpend = userAds
    .filter((a) => a.paymentStatus === 'Paid')
    .reduce((acc, curr) => acc + (curr.campaignCostPkr || 0), 0);

  const totalUserImpressions = userAds.reduce((acc, curr) => acc + (curr.impressions || 0), 0);
  const totalUserClicks = userAds.reduce((acc, curr) => acc + (curr.clicks || 0), 0);

  // Slot availability info for selected placement
  const adsPool = allAds.length > 0 ? allAds : userAds;
  const occupiedRanges = getOccupiedSlotRangesForPlacement(adsPool, formPlacement);
  const nextOpenDate = getNextAvailableDateForPlacement(adsPool, formPlacement);
  const isRunningNow = adsPool.some(a => a.placement === formPlacement && isAdCurrentlyRunning(a));
  const selectedPlacementOpt = campaignConfig.placementOptions.find(p => p.id === formPlacement);
  const isPlacementFree = !!selectedPlacementOpt?.isFreeOverride;
  const userCtr = totalUserImpressions > 0 ? ((totalUserClicks / totalUserImpressions) * 100).toFixed(2) : '0.00';

  return (
    <div className="space-y-6 text-white">
      
      {/* Wallet Balance & Financial Header Card */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <div className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold flex items-center space-x-1.5">
                <Megaphone className="w-3.5 h-3.5" />
                <span>Advertiser & Campaign Portal</span>
              </div>
              <span className="text-xs text-slate-400 font-medium">Self-Service Ad Manager</span>
            </div>
            
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Promote Your Jobs, Academy & Services
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 max-w-2xl leading-relaxed">
              Launch targeted banners, job feed cards, modal lightboxes, and SMS text message broadcasts across the portal. Admin-approved with transparent hourly, daily, weekly, or monthly rate cards.
            </p>
          </div>

          {/* User Wallet Balance Box */}
          <div className="bg-slate-900/90 border border-slate-700/80 rounded-2xl p-5 shadow-xl flex flex-col sm:flex-row items-start sm:items-center gap-5 w-full lg:w-auto backdrop-blur-md">
            <div className="space-y-1">
              <div className="text-[11px] uppercase font-bold tracking-wider text-slate-400 flex items-center space-x-1.5">
                <Wallet className="w-4 h-4 text-emerald-400" />
                <span>My Wallet Balance</span>
              </div>
              <div className="text-3xl font-black text-emerald-400 flex items-baseline space-x-1">
                <span>PKR</span>
                <span>{walletBalance.toLocaleString()}</span>
              </div>
              <div className="text-[11px] text-slate-400">
                Available for instant campaign publishing
              </div>
            </div>

            <div className="flex sm:flex-col gap-2 w-full sm:w-auto">
              <button
                onClick={() => {
                  setDepositAmountInput(2500);
                  setIsDepositModalOpen(true);
                }}
                className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black text-xs shadow-lg shadow-emerald-500/20 flex items-center justify-center space-x-1.5 transition-all cursor-pointer active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>Deposit Funds</span>
              </button>

              <button
                onClick={() => setActiveSubTab('create')}
                className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/20 flex items-center justify-center space-x-1.5 transition-all cursor-pointer active:scale-95"
              >
                <Sparkles className="w-4 h-4 text-indigo-200" />
                <span>New Campaign</span>
              </button>
            </div>
          </div>
        </div>

        {/* Aggregate KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6 mt-6 border-t border-slate-800/80 text-xs">
          <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800">
            <div className="text-slate-400 text-[11px] font-semibold">Total Campaigns</div>
            <div className="text-lg font-black text-white mt-0.5">{userAds.length}</div>
          </div>
          <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800">
            <div className="text-slate-400 text-[11px] font-semibold">Active Running</div>
            <div className="text-lg font-black text-emerald-400 mt-0.5">
              {userAds.filter((a) => a.status === 'active').length}
            </div>
          </div>
          <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800">
            <div className="text-slate-400 text-[11px] font-semibold">Total Ad Impressions</div>
            <div className="text-lg font-black text-indigo-300 mt-0.5">{totalUserImpressions.toLocaleString()}</div>
          </div>
          <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800">
            <div className="text-slate-400 text-[11px] font-semibold">Ad Clicks & CTR</div>
            <div className="text-lg font-black text-amber-300 mt-0.5">{totalUserClicks.toLocaleString()} ({userCtr}%)</div>
          </div>
        </div>
      </div>

      {/* Sub-Tabs Navigation */}
      <div className="flex items-center space-x-2 border-b border-slate-800 pb-3 overflow-x-auto text-xs font-bold">
        <button
          onClick={() => setActiveSubTab('my-campaigns')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer ${
            activeSubTab === 'my-campaigns'
              ? 'bg-emerald-500 text-slate-950 font-extrabold shadow-lg shadow-emerald-500/20'
              : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>My Campaigns & Status ({userAds.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('create')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer ${
            activeSubTab === 'create'
              ? 'bg-emerald-500 text-slate-950 font-extrabold shadow-lg shadow-emerald-500/20'
              : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
          }`}
        >
          <Plus className="w-4 h-4" />
          <span>Create & Submit Campaign</span>
        </button>

        <button
          onClick={() => setActiveSubTab('wallet')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer ${
            activeSubTab === 'wallet'
              ? 'bg-emerald-500 text-slate-950 font-extrabold shadow-lg shadow-emerald-500/20'
              : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>Wallet Ledger & Rate Card</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* SUB-TAB 1: MY CAMPAIGNS & STATUS TRACKER */}
      {/* ========================================================================= */}
      {activeSubTab === 'my-campaigns' && (
        <div className="space-y-4">
          
          {/* Status Filter Chips */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/80 border border-slate-800 p-3.5 rounded-2xl">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
              <span className="text-slate-400 mr-1">Filter by Status:</span>
              {[
                { id: 'all', label: `All (${userAds.length})` },
                { id: 'active', label: `Live / Running (${userAds.filter((a) => a.status === 'active').length})` },
                { id: 'pending', label: `Pending Approval (${userAds.filter((a) => a.status === 'pending_approval' || a.approvalStatus === 'Pending').length})` },
                { id: 'rejected', label: `Rejected (${userAds.filter((a) => a.status === 'rejected' || a.approvalStatus === 'Rejected').length})` },
                { id: 'completed', label: `Completed (${userAds.filter((a) => a.status === 'completed').length})` }
              ].map((filter) => (
                <button
                  key={filter.id}
                  onClick={() => setStatusFilter(filter.id as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    statusFilter === filter.id
                      ? 'bg-emerald-500 text-slate-950 shadow-sm'
                      : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            <button
              onClick={() => setActiveSubTab('create')}
              className="px-3.5 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/40 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Campaign</span>
            </button>
          </div>

          {/* Campaigns List */}
          {filteredUserAds.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-slate-800 flex items-center justify-center mx-auto text-slate-500">
                <Megaphone className="w-8 h-8" />
              </div>
              <div>
                <h4 className="text-lg font-bold text-white">No campaigns found in this view</h4>
                <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
                  You haven't submitted any campaigns under this filter. Launch your first targeted advertisement to reach tens of thousands of applicants!
                </p>
              </div>
              <button
                onClick={() => setActiveSubTab('create')}
                className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-lg shadow-emerald-500/20 inline-flex items-center space-x-2 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Create Your First Campaign</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredUserAds.map((ad) => {
                const isRunning = isAdCurrentlyRunning(ad);
                const isPending = ad.status === 'pending_approval' || ad.approvalStatus === 'Pending';
                const isRejected = ad.status === 'rejected' || ad.approvalStatus === 'Rejected';
                const isCompleted = ad.status === 'completed';

                return (
                  <div
                    key={ad.id}
                    className={`bg-slate-900 border rounded-2xl p-5 shadow-xl transition-all space-y-4 ${
                      isRunning
                        ? 'border-emerald-500/50 shadow-emerald-500/5'
                        : isPending
                        ? 'border-amber-500/40'
                        : isRejected
                        ? 'border-rose-500/40 bg-rose-950/10'
                        : 'border-slate-800'
                    }`}
                  >
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                      
                      {/* Left: Thumbnail & Main Info */}
                      <div className="flex items-start space-x-4">
                        {ad.imageUrl ? (
                          <img
                            src={ad.imageUrl}
                            alt={ad.headline}
                            className="w-20 h-20 rounded-xl object-cover border border-slate-700 shadow-md shrink-0"
                          />
                        ) : (
                          <div className="w-20 h-20 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-500 shrink-0">
                            <ImageIcon className="w-8 h-8" />
                          </div>
                        )}

                        <div className="space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            {/* Status Badge */}
                            {isRunning ? (
                              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[11px] font-black uppercase flex items-center space-x-1">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping mr-1"></span>
                                <span>🟢 Live & Running</span>
                              </span>
                            ) : isPending ? (
                              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40 text-[11px] font-black uppercase flex items-center space-x-1">
                                <Clock className="w-3 h-3" />
                                <span>Pending Admin Review</span>
                              </span>
                            ) : isRejected ? (
                              <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/40 text-[11px] font-black uppercase flex items-center space-x-1">
                                <XCircle className="w-3 h-3" />
                                <span>Rejected by Admin</span>
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 text-[11px] font-bold uppercase">
                                Ended / Inactive
                              </span>
                            )}

                            {/* Placement Chip */}
                            <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-semibold">
                              {getPlacementDisplayName(ad.placement)}
                            </span>

                            {/* Duration Chip */}
                            <span className="px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-bold">
                              ⏱️ {ad.durationDisplay || '24 Hours'}
                            </span>
                          </div>

                          <h3 className="text-base font-bold text-white line-clamp-1">{ad.headline}</h3>
                          <p className="text-xs text-slate-400 line-clamp-2 max-w-2xl">{ad.bodyText}</p>

                          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 pt-1">
                            <span>Target Pages: <strong className="text-slate-200">{ad.targetPages.map(getPageDisplayName).join(', ')}</strong></span>
                            <span>•</span>
                            <span>Fee: <strong className="text-emerald-400 font-mono">PKR {(ad.campaignCostPkr || 0).toLocaleString()}</strong></span>
                            <span>•</span>
                            <span>Submitted: <strong>{ad.createdAt}</strong></span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Actions & Performance */}
                      <div className="flex flex-col sm:flex-row items-end md:items-center gap-3 w-full md:w-auto justify-between md:justify-end">
                        
                        {/* Live Counter (if running) */}
                        {isRunning && ad.scheduledEndAt && (
                          <div className="text-right p-2.5 bg-slate-950/70 border border-slate-800 rounded-xl">
                            <div className="text-[10px] text-slate-400 uppercase font-bold">Time Remaining</div>
                            <div className="text-xs font-black text-emerald-400 font-mono">
                              {formatTimeRemaining(ad.scheduledEndAt)}
                            </div>
                            <div className="text-[10px] text-slate-500">Ends: {ad.scheduledEndAt}</div>
                          </div>
                        )}

                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => setPreviewAd(ad)}
                            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer"
                            title="Preview how this campaign appears"
                          >
                            <Eye className="w-3.5 h-3.5 text-indigo-400" />
                            <span>Preview</span>
                          </button>

                          <button
                            onClick={() => onDuplicateCampaign(ad)}
                            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-xl transition-all cursor-pointer"
                            title="Duplicate as new campaign draft"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => {
                              if (confirm(`Are you sure you want to delete campaign "${ad.title}"?`)) {
                                onDeleteCampaign(ad.id);
                              }
                            }}
                            className="p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl transition-all cursor-pointer"
                            title="Delete campaign"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* REJECTION REASON ALERT (If Rejected) */}
                    {isRejected && (
                      <div className="p-4 bg-rose-950/30 border border-rose-800/60 rounded-xl space-y-2 text-rose-200 text-xs">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2 font-bold text-rose-300">
                            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                            <span>Campaign Rejected by Administrator</span>
                          </div>
                          <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                            Wallet Refunded: PKR {(ad.campaignCostPkr || 0).toLocaleString()}
                          </span>
                        </div>
                        
                        <div className="bg-slate-950/80 p-3 rounded-lg border border-rose-900/40 text-slate-300">
                          <span className="text-rose-400 font-semibold">Admin Reason: </span>
                          <span>{ad.rejectionReason || 'The campaign creative or CTA content does not comply with portal advertising standards. Please review our advertising terms and submit an updated campaign.'}</span>
                        </div>
                        
                        <div className="text-[11px] text-rose-300/80">
                          Note: The full campaign fee has been credited back to your wallet balance. You can edit the campaign guidelines and re-submit at any time.
                        </div>
                      </div>
                    )}

                    {/* Analytics Strip for Active/Completed Ads */}
                    {!isPending && !isRejected && (
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 pt-3 border-t border-slate-800/60 text-xs">
                        <div className="flex items-center space-x-2 text-slate-400">
                          <Eye className="w-3.5 h-3.5 text-indigo-400" />
                          <span>Impressions: <strong className="text-white">{(ad.impressions || 0).toLocaleString()}</strong></span>
                        </div>
                        <div className="flex items-center space-x-2 text-slate-400">
                          <MousePointerClick className="w-3.5 h-3.5 text-teal-400" />
                          <span>Clicks: <strong className="text-white">{(ad.clicks || 0).toLocaleString()}</strong></span>
                        </div>
                        <div className="flex items-center space-x-2 text-slate-400">
                          <Percent className="w-3.5 h-3.5 text-amber-400" />
                          <span>CTR: <strong className="text-white">{(ad.impressions || 0) > 0 ? (((ad.clicks || 0) / ad.impressions) * 100).toFixed(2) : '0.00'}%</strong></span>
                        </div>
                        <div className="flex items-center space-x-2 text-slate-400 col-span-3 sm:col-span-1 justify-end">
                          <span className="text-[11px] text-slate-500">Starts: {ad.scheduledStartAt || 'Immediate'}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 2: CREATE & SUBMIT CAMPAIGN WIZARD */}
      {/* ========================================================================= */}
      {activeSubTab === 'create' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Form (8 Cols) */}
          <div className="lg:col-span-7 space-y-6">
            <form onSubmit={handleCreateSubmit} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6">
              
              <div className="border-b border-slate-800 pb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black text-white flex items-center space-x-2">
                    <Sparkles className="w-5 h-5 text-emerald-400" />
                    <span>Create & Launch Advertisement</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Configure your placement, timeframe, and creative assets. Pricing updates dynamically.
                  </p>
                </div>

                <div className="text-right">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Your Wallet Balance</div>
                  <div className="text-sm font-black text-emerald-400 font-mono">
                    PKR {walletBalance.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* 1. Quick Presets Bar */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                  <span>🚀 Fast-Track with Verified Templates</span>
                  <span className="text-[10px] text-slate-400">One-click auto-fill</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {AD_BANNER_PRESETS.slice(0, 6).map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleApplyPreset(preset)}
                      className="p-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-left transition-all cursor-pointer group"
                    >
                      <div className="text-[11px] font-bold text-white group-hover:text-emerald-400 line-clamp-1">{preset.name}</div>
                      <div className="text-[10px] text-slate-400">{preset.category}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Format & Placement Selector */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">Campaign Format / Medium</label>
                  <select
                    value={formType}
                    onChange={(e) => {
                      const t = e.target.value as AdType;
                      setFormType(t);
                      if (t === 'popup') setFormPlacement('popup-modal');
                      else if (t === 'notification') setFormPlacement('toast-float');
                      else if (t === 'sms') setFormPlacement('sms-broadcast');
                      else if (t === 'text') setFormPlacement('sidebar');
                      else setFormPlacement('top-header');
                    }}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="banner">🖼️ Visual Image / Announcement Banner</option>
                    <option value="popup">📢 Centered Lightbox Modal Pop-up</option>
                    <option value="notification">🔔 Floating Toast Notification</option>
                    <option value="text">📝 Formatted Text Announcement Box</option>
                    <option value="sms">📱 Direct SMS Text Broadcast</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">Portal Placement Slot</label>
                  <select
                    value={formPlacement}
                    onChange={(e) => setFormPlacement(e.target.value as AdPlacement)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {campaignConfig.placementOptions.filter(p => p.isEnabled).map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.name} ({opt.multiplier}x Multiplier) - {opt.description}
                      </option>
                    ))}
                    {campaignConfig.placementOptions.filter(p => p.isEnabled).length === 0 && (
                      <>
                        <option value="top-header">Top Sticky Header Announcement (1.25x)</option>
                        <option value="feed-inline">Job Listings Feed Inline Card (1.00x)</option>
                        <option value="popup-modal">Centered Pop-up Lightbox Modal (1.50x)</option>
                        <option value="toast-float">Floating Toast Notification (0.90x)</option>
                        <option value="sidebar">Sidebar / Filter Widget Box (0.75x)</option>
                        <option value="sms-broadcast">Direct SMS Text Broadcast</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              {/* Slot Availability & Real-Time Booking Timeline Card */}
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <Calendar className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-black text-white">Live Slot Schedule & Availability:</span>
                  </div>

                  <div className="flex items-center space-x-2">
                    {isPlacementFree && (
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 uppercase">
                        🎉 100% Free Placement!
                      </span>
                    )}
                    {isRunningNow ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center space-x-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping mr-1"></span>
                        <span>Currently Active Campaign</span>
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        🟢 Slot Open for Immediate Booking
                      </span>
                    )}
                  </div>
                </div>

                {/* Booked Date Ranges Visualizer */}
                {occupiedRanges.length > 0 ? (
                  <div className="space-y-1.5 pt-1 border-t border-slate-800/80">
                    <div className="text-[11px] font-semibold text-slate-400">
                      Reserved / Occupied Booking Windows:
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {occupiedRanges.map((r, i) => (
                        <div
                          key={i}
                          className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-[11px] font-mono text-slate-300 flex items-center space-x-1.5"
                        >
                          <Clock className="w-3 h-3 text-amber-400" />
                          <span>{r.startDate} ➔ {r.endDate}</span>
                          <span className="text-[9px] text-slate-500">({r.title})</span>
                        </div>
                      ))}
                    </div>
                    <div className="text-[11px] font-bold text-emerald-400 pt-1">
                      ✨ Next completely available open date begins on: <strong className="text-white font-mono">{nextOpenDate}</strong>
                    </div>
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
                    ✨ No reservations queued for this placement. Your campaign will launch <strong className="text-emerald-400">immediately</strong> upon submission!
                  </div>
                )}
              </div>

              {/* 3. Target Pages (Multi-Select with Admin Schedule Enforced) */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                  <span className="flex items-center space-x-1.5">
                    <span>Target Portal Pages</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400">Admin Managed Schedules</span>
                  </span>
                  <span className="text-[10px] text-slate-400">Where this ad will be visible</span>
                </label>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {campaignConfig.portalPages.map((page) => {
                    const isSelected = formTargetPages.includes(page.id as AdTargetPage);
                    const scheduleStatus = isPageScheduledActive(page);
                    const isAvailable = scheduleStatus.isActive;

                    return (
                      <button
                        key={page.id}
                        type="button"
                        onClick={() => {
                          if (!isAvailable) {
                            alert(`"${page.name}" is currently unavailable for campaign distribution: ${scheduleStatus.reason}`);
                            return;
                          }

                          if (page.id === 'all') {
                            setFormTargetPages(['all']);
                          } else {
                            const withoutAll = formTargetPages.filter((x) => x !== 'all');
                            if (isSelected) {
                              const remaining = withoutAll.filter((x) => x !== page.id);
                              setFormTargetPages(remaining.length > 0 ? remaining : ['jobs']);
                            } else {
                              setFormTargetPages([...withoutAll, page.id as AdTargetPage]);
                            }
                          }
                        }}
                        className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between space-y-1.5 ${
                          isSelected
                            ? 'bg-emerald-500/15 border-emerald-500/60 shadow-sm shadow-emerald-500/10'
                            : isAvailable
                            ? 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-300'
                            : 'bg-slate-950/40 border-slate-800/50 text-slate-600 cursor-not-allowed opacity-60'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center space-x-2">
                            <div className={`w-4 h-4 rounded-md flex items-center justify-center border transition-all ${
                              isSelected 
                                ? 'bg-emerald-500 border-emerald-500 text-slate-950 font-black' 
                                : 'border-slate-700 bg-slate-900'
                            }`}>
                              {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                            </div>
                            <span className={`text-xs font-bold ${isSelected ? 'text-emerald-300' : isAvailable ? 'text-white' : 'text-slate-500'}`}>
                              {page.name}
                            </span>
                          </div>

                          {/* Status pill */}
                          {isAvailable ? (
                            <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              Active
                            </span>
                          ) : (
                            <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center space-x-0.5">
                              <Lock className="w-2.5 h-2.5 inline mr-0.5" />
                              Blocked
                            </span>
                          )}
                        </div>

                        <div className="text-[10px] text-slate-400 line-clamp-1">
                          {page.description}
                        </div>

                        {page.scheduleMode === 'date_range' && page.activeDateStart && page.activeDateEnd && (
                          <div className="text-[9px] font-mono text-amber-400/90 pt-0.5">
                            Window: {page.activeDateStart} to {page.activeDateEnd}
                          </div>
                        )}
                        {page.scheduleMode === 'time_window' && page.activeTimeStart && page.activeTimeEnd && (
                          <div className="text-[9px] font-mono text-amber-400/90 pt-0.5">
                            Daily: {page.activeTimeStart} - {page.activeTimeEnd}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 4. Timeframe & Duration Selection */}
              <div className="space-y-3 bg-slate-950/70 border border-slate-800 p-4 rounded-2xl">
                <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                  <span className="flex items-center space-x-1.5">
                    <Clock className="w-4 h-4 text-emerald-400" />
                    <span>Select Timeframe & Duration</span>
                  </span>
                  <span className="text-xs font-mono font-bold text-emerald-400">
                    Duration: {costCalculation.durationDisplay}
                  </span>
                </label>

                {/* Preset Duration Buttons from Admin Config */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {campaignConfig.durationPresets.filter(d => d.isEnabled).map((dur) => {
                    const isChosen = selectedDurationId === dur.id;
                    return (
                      <button
                        key={dur.id}
                        type="button"
                        onClick={() => setSelectedDurationId(dur.id)}
                        className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer relative ${
                          isChosen
                            ? 'bg-gradient-to-r from-emerald-500 to-teal-600 border-emerald-400 text-slate-950 font-black shadow-md shadow-emerald-500/20'
                            : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        {dur.badge && (
                          <span className={`absolute -top-2 right-2 text-[9px] font-black px-1.5 py-0.2 rounded-full uppercase tracking-tighter ${
                            isChosen ? 'bg-slate-950 text-emerald-300' : 'bg-emerald-500 text-slate-950'
                          }`}>
                            {dur.badge}
                          </span>
                        )}
                        <div className="text-xs font-bold">{dur.label}</div>
                        <div className={`text-[10px] ${isChosen ? 'text-slate-900 font-semibold' : 'text-slate-400'}`}>
                          {dur.subLabel || `${dur.value} ${dur.unit}`}
                        </div>
                      </button>
                    );
                  })}

                  {/* Custom option */}
                  <button
                    type="button"
                    onClick={() => setSelectedDurationId('custom')}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                      selectedDurationId === 'custom'
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-600 border-emerald-400 text-slate-950 font-black shadow-md'
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div className="text-xs font-bold">Custom Duration</div>
                    <div className={`text-[10px] ${selectedDurationId === 'custom' ? 'text-slate-900 font-semibold' : 'text-slate-400'}`}>
                      Configurable
                    </div>
                  </button>
                </div>

                {/* Custom duration inputs if selected */}
                {selectedDurationId === 'custom' && (
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800">
                    <div>
                      <label className="text-[11px] text-slate-400 font-bold">Duration Value</label>
                      <input
                        type="number"
                        min="1"
                        max={campaignConfig.formRules.maxCampaignDays || 365}
                        value={customDurationValue}
                        onChange={(e) => setCustomDurationValue(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 font-bold">Time Unit</label>
                      <select
                        value={customDurationUnit}
                        onChange={(e) => setCustomDurationUnit(e.target.value as AdDurationUnit)}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white"
                      >
                        <option value="hours">Hours (Flash)</option>
                        <option value="days">Days (24h blocks)</option>
                        <option value="weeks">Weeks (7-day cycles)</option>
                        <option value="months">Months (30-day blocks)</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* 5. Creative Details */}
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">Campaign Headline / Title *</label>
                  <input
                    type="text"
                    required
                    value={formHeadline}
                    onChange={(e) => setFormHeadline(e.target.value)}
                    placeholder="e.g. Hiring 15+ Remote React Developers | Direct USD Payroll"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">Body Copy / Description</label>
                  <textarea
                    rows={3}
                    value={formBodyText}
                    onChange={(e) => setFormBodyText(e.target.value)}
                    placeholder="Provide details about the job, course, relocation offer, or special announcement..."
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  ></textarea>
                </div>

                {/* Banner Graphic URL + Upload */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">Banner Graphic or Logo Image URL</label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={formImageUrl}
                      onChange={(e) => setFormImageUrl(e.target.value)}
                      placeholder="https://..."
                      className="flex-1 px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <label className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-xl text-xs font-bold flex items-center space-x-1.5 cursor-pointer transition-all">
                      <Upload className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Upload</span>
                      <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                    </label>
                  </div>
                </div>

                {/* CTA text & link */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300">CTA Button Text</label>
                    <input
                      type="text"
                      value={formCtaText}
                      onChange={(e) => setFormCtaText(e.target.value)}
                      placeholder="e.g. Apply Now, Enroll Today"
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300">CTA Target URL or Tab</label>
                    <input
                      type="text"
                      value={formCtaUrl}
                      onChange={(e) => setFormCtaUrl(e.target.value)}
                      placeholder="#jobs, #cv, or https://example.com"
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                    />
                  </div>
                </div>

                {/* Badge text & Color theme */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300">Badge Label Tag</label>
                    <input
                      type="text"
                      value={formBadgeText}
                      onChange={(e) => setFormBadgeText(e.target.value)}
                      placeholder="e.g. Featured Employer, Special Offer"
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300">Color Theme & Palette</label>
                    <select
                      value={formTheme}
                      onChange={(e) => setFormTheme(e.target.value as AdTheme)}
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                    >
                      <option value="emerald">Emerald Green (Verified Pro)</option>
                      <option value="indigo">Indigo Tech (High Tech)</option>
                      <option value="amber">Amber Gold (Urgent / Govt)</option>
                      <option value="rose">Rose Red (Special Promo)</option>
                      <option value="slate">Slate Charcoal (Corporate)</option>
                      <option value="gradient-purple">Purple Gradient (AI & Tech)</option>
                      <option value="gradient-ocean">Ocean Blue (Gulf & Relocation)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Submit Button & Wallet Deduction Notice */}
              <div className="pt-4 border-t border-slate-800 space-y-3">
                {isWalletSufficient ? (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-between text-xs text-emerald-300">
                    <span className="flex items-center space-x-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>Wallet balance sufficient: <strong>PKR {costCalculation.totalCostPkr.toLocaleString()}</strong> will be deducted.</span>
                    </span>
                    <span className="font-mono font-bold text-emerald-400">Balance after: PKR {(walletBalance - costCalculation.totalCostPkr).toLocaleString()}</span>
                  </div>
                ) : (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-between text-xs text-amber-300">
                    <span className="flex items-center space-x-2">
                      <AlertCircle className="w-4 h-4 text-amber-400" />
                      <span>Deficit: <strong>PKR {walletDeficit.toLocaleString()}</strong> needed to submit this campaign.</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setDepositAmountInput(Math.max(500, walletDeficit));
                        setIsDepositModalOpen(true);
                      }}
                      className="px-3 py-1 bg-amber-500 text-slate-950 rounded-lg font-black text-xs hover:bg-amber-400 cursor-pointer"
                    >
                      + Deposit PKR {walletDeficit.toLocaleString()}
                    </button>
                  </div>
                )}

                <button
                  type="submit"
                  className={`w-full py-3.5 rounded-2xl font-black text-sm shadow-xl flex items-center justify-center space-x-2 transition-all cursor-pointer active:scale-95 ${
                    isWalletSufficient
                      ? 'bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-emerald-500/20'
                      : 'bg-gradient-to-r from-amber-500 to-orange-600 text-slate-950 hover:from-amber-400 hover:to-orange-500'
                  }`}
                >
                  <Send className="w-4 h-4" />
                  <span>
                    {isWalletSufficient 
                      ? `Submit Campaign for Admin Approval (PKR ${costCalculation.totalCostPkr.toLocaleString()})`
                      : `Deposit Funds to Submit Campaign (Deficit: PKR ${walletDeficit.toLocaleString()})`
                    }
                  </span>
                </button>
              </div>

            </form>
          </div>

          {/* Right Live Summary & Dynamic Pricing Matrix (5 Cols) */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Dynamic Price Breakdown Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-400 flex items-center justify-between">
                <span className="flex items-center space-x-1.5">
                  <Receipt className="w-4 h-4 text-emerald-400" />
                  <span>Itemized Fee Calculation</span>
                </span>
                <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  Live Rate Card
                </span>
              </h3>

              <div className="space-y-2.5 text-xs text-slate-300">
                <div className="flex items-center justify-between py-1.5 border-b border-slate-800/80">
                  <span className="text-slate-400">Duration ({costCalculation.durationDisplay}) Base Fee:</span>
                  <span className="font-mono font-bold text-white">PKR {costCalculation.baseCost.toLocaleString()}</span>
                </div>

                <div className="flex items-center justify-between py-1.5 border-b border-slate-800/80">
                  <span className="text-slate-400">Placement Multiplier ({getPlacementDisplayName(formPlacement)}):</span>
                  <span className="font-mono font-bold text-indigo-300">{costCalculation.placementMultiplier}x</span>
                </div>

                <div className="flex items-center justify-between py-1.5 border-b border-slate-800/80">
                  <span className="text-slate-400">Page Distribution Multiplier ({formTargetPages.length} Pages):</span>
                  <span className="font-mono font-bold text-amber-300">{costCalculation.pageMultiplier}x</span>
                </div>

                {formType === 'sms' && (
                  <div className="flex items-center justify-between py-1.5 border-b border-slate-800/80">
                    <span className="text-slate-400">SMS Contacts Dispatch Fee ({formSmsRecipientsCount} SMS):</span>
                    <span className="font-mono font-bold text-purple-300">PKR {costCalculation.smsFee.toLocaleString()}</span>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 text-sm font-black text-white">
                  <span className="text-emerald-400">Total Campaign Fee:</span>
                  <span className="font-mono text-xl text-emerald-400">PKR {costCalculation.totalCostPkr.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Live Context & Placement Simulator */}
            <CampaignLiveContextPreview
              campaign={{
                id: 'preview-draft',
                title: formTitle || 'My Ad Campaign',
                type: formType,
                targetPages: formTargetPages,
                placement: formPlacement,
                status: 'active',
                headline: formHeadline || 'Boost Your Career with Top Verified Recruiters',
                bodyText: formBodyText || 'Get matched with remote tech and engineering positions across Pakistan & abroad.',
                imageUrl: formImageUrl,
                ctaText: formCtaText || 'Explore Now',
                ctaUrl: formCtaUrl || '#',
                badgeText: formBadgeText || 'Featured Opportunity',
                theme: formTheme,
                dismissable: formDismissable
              }}
              portalPages={campaignConfig.portalPages}
            />

          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 3: WALLET LEDGER & RATE CARD */}
      {/* ========================================================================= */}
      {activeSubTab === 'wallet' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Rate Card Matrix (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-base font-black text-white flex items-center space-x-2">
                    <Receipt className="w-5 h-5 text-emerald-400" />
                    <span>Official Portal Advertising Rate Card</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Transparent, admin-configured baseline pricing matrix for all placements and timeframes.
                  </p>
                </div>
              </div>

              {/* Timeframe Baseline Pricing Table */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">1. Timeframe Rates</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-2xl text-center">
                    <div className="text-[11px] text-slate-400 font-semibold">Hourly Rate</div>
                    <div className="text-base font-black text-white mt-1">PKR {pricingConfig.hourlyRatePkr.toLocaleString()}</div>
                    <div className="text-[10px] text-slate-500">Per hour</div>
                  </div>

                  <div className="bg-slate-950 border border-emerald-500/30 p-3.5 rounded-2xl text-center">
                    <div className="text-[11px] text-emerald-400 font-semibold">24 Hours / 1 Day</div>
                    <div className="text-base font-black text-emerald-400 mt-1">PKR {pricingConfig.dailyRatePkr.toLocaleString()}</div>
                    <div className="text-[10px] text-slate-500">Save 58% vs hourly</div>
                  </div>

                  <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-2xl text-center">
                    <div className="text-[11px] text-indigo-400 font-semibold">1 Week (7 Days)</div>
                    <div className="text-base font-black text-indigo-300 mt-1">PKR {pricingConfig.weeklyRatePkr.toLocaleString()}</div>
                    <div className="text-[10px] text-slate-500">Popular for hiring</div>
                  </div>

                  <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-2xl text-center">
                    <div className="text-[11px] text-amber-400 font-semibold">1 Month (30 Days)</div>
                    <div className="text-base font-black text-amber-300 mt-1">PKR {pricingConfig.monthlyRatePkr.toLocaleString()}</div>
                    <div className="text-[10px] text-slate-500">Maximum exposure</div>
                  </div>
                </div>
              </div>

              {/* Placement Multipliers Table */}
              <div className="space-y-2 pt-2">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">2. Placement Multipliers</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {Object.entries(pricingConfig.placementMultipliers).map(([placementKey, multiplier]) => (
                    <div key={placementKey} className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between">
                      <span className="text-slate-300">{getPlacementDisplayName(placementKey as AdPlacement)}</span>
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-emerald-400 font-mono font-bold">{multiplier}x</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Page Distribution Multipliers */}
              <div className="space-y-2 pt-2">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">3. Page Multipliers</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  {Object.entries(pricingConfig.pageMultipliers).map(([pageKey, multiplier]) => (
                    <div key={pageKey} className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between">
                      <span className="text-slate-300">{getPageDisplayName(pageKey as AdTargetPage)}</span>
                      <span className="text-indigo-300 font-mono font-bold">{multiplier}x</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>

          {/* Wallet Balance & Deposit Actions (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black text-white flex items-center space-x-2">
                  <Wallet className="w-5 h-5 text-emerald-400" />
                  <span>Wallet Management</span>
                </h3>
                <span className="text-xs text-slate-400">Unified Account</span>
              </div>

              <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-950 to-slate-900 border border-slate-700/80 space-y-3">
                <div className="text-xs text-slate-400 font-bold uppercase">Current Usable Balance</div>
                <div className="text-3xl font-black text-emerald-400 flex items-baseline space-x-1.5 font-mono">
                  <span>PKR</span>
                  <span>{walletBalance.toLocaleString()}</span>
                </div>
                <p className="text-xs text-slate-400">
                  Funds in your wallet are automatically deducted when campaigns or jobs are submitted. Unapproved or rejected campaigns are instantly refunded.
                </p>
                <button
                  onClick={() => {
                    setDepositAmountInput(5000);
                    setIsDepositModalOpen(true);
                  }}
                  className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-emerald-500/20 flex items-center justify-center space-x-2 transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Funds via JazzCash / EasyPaisa / Card</span>
                </button>
              </div>

              {/* Supported Gateways list */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <div className="text-xs font-bold text-slate-300">Supported Instant Payment Gateways:</div>
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
                  <div className="p-2 bg-slate-950 rounded-lg border border-slate-800 flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-red-500"></span>
                    <span>JazzCash Instant</span>
                  </div>
                  <div className="p-2 bg-slate-950 rounded-lg border border-slate-800 flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span>Easypaisa Mobile</span>
                  </div>
                  <div className="p-2 bg-slate-950 rounded-lg border border-slate-800 flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                    <span>Raast / IBAN Transfer</span>
                  </div>
                  <div className="p-2 bg-slate-950 rounded-lg border border-slate-800 flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    <span>Visa / Mastercard</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: DEPOSIT FUNDS INTO WALLET */}
      {/* ========================================================================= */}
      {isDepositModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6 relative">
            <button
              onClick={() => setIsDepositModalOpen(false)}
              className="absolute top-5 right-5 p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white cursor-pointer"
            >
              <XCircle className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <div className="flex items-center space-x-2 text-emerald-400 text-xs font-bold uppercase">
                <Wallet className="w-4 h-4" />
                <span>Instant Wallet Top-up</span>
              </div>
              <h3 className="text-xl font-black text-white">Deposit Advertising Funds</h3>
              <p className="text-xs text-slate-400">
                Select your preferred Pakistani or international payment channel for instant balance credit.
              </p>
            </div>

            <form onSubmit={handleConfirmDeposit} className="space-y-4">
              
              {/* Quick Amount Buttons */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Select Amount (PKR)</label>
                <div className="grid grid-cols-3 gap-2">
                  {[1000, 2500, 5000, 10000, 25000, 50000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setDepositAmountInput(amt)}
                      className={`py-2 rounded-xl border text-xs font-black transition-all cursor-pointer ${
                        depositAmountInput === amt
                          ? 'bg-emerald-500 border-emerald-400 text-slate-950'
                          : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      PKR {amt.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Amount Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Custom Amount (PKR)</label>
                <input
                  type="number"
                  min={pricingConfig.minDepositAmountPkr || 500}
                  step="100"
                  value={depositAmountInput}
                  onChange={(e) => setDepositAmountInput(parseInt(e.target.value) || 0)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm font-bold text-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Payment Gateway Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Payment Gateway</label>
                <select
                  value={depositPaymentMethod}
                  onChange={(e) => setDepositPaymentMethod(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="JazzCash">🔴 JazzCash Mobile Account / Till ID</option>
                  <option value="Easypaisa">🟢 Easypaisa Wallet Direct</option>
                  <option value="Bank Raast / IBAN">🏛️ Raast Instant / 1Link Bank Transfer</option>
                  <option value="Visa / Mastercard">💳 Visa / Mastercard / Stripe</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Account / Mobile Number</label>
                <input
                  type="text"
                  value={depositAccountNumber}
                  onChange={(e) => setDepositAccountNumber(e.target.value)}
                  placeholder="0300-1234567"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                />
              </div>

              {isDepositSuccess ? (
                <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-center text-xs font-black text-emerald-400 flex items-center justify-center space-x-2 animate-in zoom-in">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Deposit Successful! Crediting wallet...</span>
                </div>
              ) : (
                <button
                  type="submit"
                  className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black text-sm rounded-2xl shadow-xl shadow-emerald-500/20 flex items-center justify-center space-x-2 transition-all cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Confirm Deposit of PKR {depositAmountInput.toLocaleString()}</span>
                </button>
              )}

            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: LIVE PREVIEW LIGHTBOX */}
      {/* ========================================================================= */}
      {previewAd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-6 relative">
            <button
              onClick={() => setPreviewAd(null)}
              className="absolute top-5 right-5 p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white cursor-pointer"
            >
              <XCircle className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-500/30">
                Interactive Preview
              </span>
              <h3 className="text-lg font-black text-white">{previewAd.title}</h3>
              <p className="text-xs text-slate-400">
                Placement: <strong>{getPlacementDisplayName(previewAd.placement)}</strong> • Duration: <strong>{previewAd.durationDisplay || '24 Hours'}</strong>
              </p>
            </div>

            {/* Render Ad Body */}
            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-3">
              {previewAd.imageUrl && (
                <img
                  src={previewAd.imageUrl}
                  alt={previewAd.headline}
                  className="w-full h-44 rounded-xl object-cover border border-slate-800"
                />
              )}
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-black uppercase">
                  {previewAd.badgeText || 'Sponsored'}
                </span>
                <span className="text-[10px] text-slate-400">Live Preview</span>
              </div>
              <h4 className="text-sm font-black text-white">{previewAd.headline}</h4>
              <p className="text-xs text-slate-300 leading-relaxed">{previewAd.bodyText}</p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => alert(`Redirecting to: ${previewAd.ctaUrl || '#jobs'}`)}
                  className="w-full py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-emerald-500/20 cursor-pointer"
                >
                  {previewAd.ctaText || 'Learn More'}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800">
              <span>Status: <strong className="text-white capitalize">{previewAd.status}</strong></span>
              <button
                onClick={() => setPreviewAd(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
