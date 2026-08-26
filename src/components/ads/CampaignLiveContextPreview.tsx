import React, { useState } from 'react';
import { 
  Advertisement, 
  AdPlacement, 
  AdTheme, 
  AdTargetPage,
  PortalPageConfig,
  getPlacementDisplayName,
  getPageDisplayName 
} from '../../types/ad';
import { 
  Eye, 
  Smartphone, 
  Monitor, 
  Tablet, 
  Bell, 
  Briefcase, 
  FileText, 
  Users, 
  Globe, 
  Sparkles, 
  ExternalLink, 
  CheckCircle2, 
  X, 
  Search, 
  Filter, 
  MapPin, 
  DollarSign, 
  ArrowRight, 
  Layers, 
  Mail, 
  Send,
  Radio,
  Clock,
  ShieldCheck,
  Maximize2,
  Megaphone
} from 'lucide-react';

export interface CampaignLiveContextPreviewProps {
  campaign?: Partial<Advertisement>;
  headline?: string;
  bodyText?: string;
  imageUrl?: string;
  ctaText?: string;
  ctaUrl?: string;
  badgeText?: string;
  theme?: AdTheme;
  placement?: AdPlacement;
  targetPages?: AdTargetPage[];
  dismissable?: boolean;
  smsSenderId?: string;
  smsAudience?: string;
  selectedPreviewPage?: string;
  onSelectPreviewPage?: (page: string) => void;
  portalPages?: PortalPageConfig[];
}

export const CampaignLiveContextPreview: React.FC<CampaignLiveContextPreviewProps> = ({
  campaign,
  headline: propHeadline,
  bodyText: propBodyText,
  imageUrl: propImageUrl,
  ctaText: propCtaText,
  ctaUrl: propCtaUrl,
  badgeText: propBadgeText,
  theme: propTheme,
  placement: propPlacement,
  targetPages: propTargetPages,
  dismissable: propDismissable,
  smsSenderId: propSmsSenderId,
  smsAudience: propSmsAudience,
  selectedPreviewPage: externalPreviewPage,
  onSelectPreviewPage,
  portalPages
}) => {
  // Resolve unified fields
  const headline = campaign?.headline ?? propHeadline ?? '';
  const bodyText = campaign?.bodyText ?? propBodyText ?? '';
  const imageUrl = campaign?.imageUrl ?? propImageUrl;
  const ctaText = campaign?.ctaText ?? propCtaText ?? 'Apply Now';
  const ctaUrl = campaign?.ctaUrl ?? propCtaUrl ?? '#jobs';
  const badgeText = campaign?.badgeText ?? propBadgeText ?? 'Featured Partner';
  const theme = (campaign?.theme ?? propTheme ?? 'indigo') as AdTheme;
  const placement = (campaign?.placement ?? propPlacement ?? 'top-header') as AdPlacement;
  const targetPages = (campaign?.targetPages ?? propTargetPages ?? ['alerts']) as AdTargetPage[];
  const dismissable = campaign?.dismissable ?? propDismissable ?? true;
  const smsSenderId = propSmsSenderId ?? 'HybridJobs';
  const smsAudience = propSmsAudience ?? 'All Registered Users';

  // Viewport mode: Desktop, Tablet, Mobile
  const [deviceViewport, setDeviceViewport] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  
  // Target Page simulator: 'alerts' (Job Alerts Page), 'jobs' (Jobs Feed), 'cv' (CV Builder), 'dashboard' (Dashboard), 'all' (Global Header), 'sms' (Phone)
  const [internalPreviewPage, setInternalPreviewPage] = useState<string>(() => {
    if (targetPages.includes('alerts')) return 'alerts';
    if (targetPages.includes('jobs')) return 'jobs';
    if (targetPages.includes('cv')) return 'cv';
    if (targetPages.includes('dashboard')) return 'dashboard';
    return 'alerts';
  });

  const activePreviewPage = externalPreviewPage || internalPreviewPage;
  const setActivePreviewPage = (p: string) => {
    if (onSelectPreviewPage) onSelectPreviewPage(p);
    else setInternalPreviewPage(p);
  };

  // Highlighting & interactive state
  const [isHighlightOn, setIsHighlightOn] = useState<boolean>(true);
  const [isDismissedInPreview, setIsDismissedInPreview] = useState<boolean>(false);
  const [lastActionToast, setLastActionToast] = useState<string | null>(null);

  const handleSimulateClick = () => {
    setLastActionToast(`Simulated Click ➔ Redirecting to "${ctaUrl || '#jobs'}"`);
    setTimeout(() => setLastActionToast(null), 3000);
  };

  // Theme styling helper
  const getThemeClasses = () => {
    switch (theme) {
      case 'emerald':
        return {
          bannerBg: 'bg-gradient-to-r from-emerald-950 via-slate-900 to-teal-950 border-emerald-500/40 text-white',
          badgeBg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
          btnBg: 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black shadow-emerald-500/20',
          cardBorder: 'border-emerald-500/40',
          accentText: 'text-emerald-400',
          highlightRing: 'ring-2 ring-emerald-400 ring-offset-2 ring-offset-slate-950'
        };
      case 'indigo':
        return {
          bannerBg: 'bg-gradient-to-r from-indigo-950 via-slate-900 to-blue-950 border-indigo-500/40 text-white',
          badgeBg: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
          btnBg: 'bg-indigo-500 hover:bg-indigo-400 text-white font-black shadow-indigo-500/20',
          cardBorder: 'border-indigo-500/40',
          accentText: 'text-indigo-400',
          highlightRing: 'ring-2 ring-indigo-400 ring-offset-2 ring-offset-slate-950'
        };
      case 'amber':
        return {
          bannerBg: 'bg-gradient-to-r from-amber-950 via-slate-900 to-orange-950 border-amber-500/40 text-white',
          badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
          btnBg: 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-black shadow-amber-500/20',
          cardBorder: 'border-amber-500/40',
          accentText: 'text-amber-400',
          highlightRing: 'ring-2 ring-amber-400 ring-offset-2 ring-offset-slate-950'
        };
      case 'rose':
        return {
          bannerBg: 'bg-gradient-to-r from-rose-950 via-slate-900 to-pink-950 border-rose-500/40 text-white',
          badgeBg: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
          btnBg: 'bg-rose-500 hover:bg-rose-400 text-white font-black shadow-rose-500/20',
          cardBorder: 'border-rose-500/40',
          accentText: 'text-rose-400',
          highlightRing: 'ring-2 ring-rose-400 ring-offset-2 ring-offset-slate-950'
        };
      case 'gradient-purple':
        return {
          bannerBg: 'bg-gradient-to-r from-purple-900 via-indigo-950 to-slate-950 border-purple-500/40 text-white',
          badgeBg: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
          btnBg: 'bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-400 hover:to-indigo-400 text-white font-black',
          cardBorder: 'border-purple-500/40',
          accentText: 'text-purple-400',
          highlightRing: 'ring-2 ring-purple-400 ring-offset-2 ring-offset-slate-950'
        };
      case 'gradient-ocean':
        return {
          bannerBg: 'bg-gradient-to-r from-cyan-950 via-blue-950 to-slate-900 border-cyan-500/40 text-white',
          badgeBg: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
          btnBg: 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 font-black',
          cardBorder: 'border-cyan-500/40',
          accentText: 'text-cyan-400',
          highlightRing: 'ring-2 ring-cyan-400 ring-offset-2 ring-offset-slate-950'
        };
      case 'slate':
      default:
        return {
          bannerBg: 'bg-slate-900 border-slate-700 text-white',
          badgeBg: 'bg-slate-800 text-slate-300 border-slate-700',
          btnBg: 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black',
          cardBorder: 'border-slate-700',
          accentText: 'text-emerald-400',
          highlightRing: 'ring-2 ring-emerald-400 ring-offset-2 ring-offset-slate-950'
        };
    }
  };

  const themeStyle = getThemeClasses();

  // Render the Ad Component in Place
  const renderActualAdComponent = (contextLocation: string) => {
    if (isDismissedInPreview) {
      return (
        <div className="p-3 bg-slate-900/60 border border-dashed border-slate-700 rounded-xl text-center text-xs text-slate-400 flex items-center justify-center space-x-2">
          <span>Ad Dismissed in Preview.</span>
          <button 
            type="button" 
            onClick={() => setIsDismissedInPreview(false)}
            className="text-emerald-400 underline font-bold cursor-pointer"
          >
            Show Again
          </button>
        </div>
      );
    }

    const highlightBorder = isHighlightOn ? `${themeStyle.highlightRing} animate-pulse` : '';

    // 1. TOP HEADER BANNER
    if (placement === 'top-header') {
      return (
        <div id="ad-live-preview-top-header" className={`relative rounded-xl border p-3.5 sm:p-4 shadow-lg transition-all ${themeStyle.bannerBg} ${highlightBorder}`}>
          {isHighlightOn && (
            <div className="absolute -top-2.5 left-4 px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 text-[9px] font-black uppercase tracking-wider flex items-center space-x-1 shadow-md">
              <Sparkles className="w-2.5 h-2.5" />
              <span>Live Campaign Display Location</span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-start space-x-3 max-w-2xl">
              {imageUrl ? (
                <img 
                  src={imageUrl} 
                  alt="Campaign Graphic" 
                  className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg object-cover border border-white/10 shrink-0" 
                />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                  <Megaphone className="w-5 h-5 text-white" />
                </div>
              )}

              <div className="space-y-0.5">
                <div className="flex items-center space-x-2">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${themeStyle.badgeBg}`}>
                    {badgeText || 'Sponsored'}
                  </span>
                  <span className="text-[10px] text-slate-300/80 font-medium">Top Announcement</span>
                </div>
                <h4 className="text-xs sm:text-sm font-black text-white leading-tight">
                  {headline || 'Enter your compelling campaign headline...'}
                </h4>
                <p className="text-[11px] text-slate-300 line-clamp-1">
                  {bodyText || 'Your promotional text, course summary, or job details will be showcased here.'}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 w-full sm:w-auto justify-end shrink-0 pt-2 sm:pt-0">
              <button
                type="button"
                onClick={handleSimulateClick}
                className={`px-4 py-2 rounded-xl text-xs font-black flex items-center space-x-1.5 transition-all cursor-pointer shadow-md active:scale-95 ${themeStyle.btnBg}`}
              >
                <span>{ctaText || 'Learn More'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              {dismissable && (
                <button
                  type="button"
                  onClick={() => setIsDismissedInPreview(true)}
                  className="p-1.5 rounded-lg bg-black/20 hover:bg-black/40 text-slate-400 hover:text-white transition-all cursor-pointer"
                  title="Simulate Dismiss"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    // 2. INLINE FEED CARD (Job Listings Feed or Alert Subscriptions Feed)
    if (placement === 'feed-inline') {
      return (
        <div id="ad-live-preview-feed-inline" className={`relative rounded-2xl border p-4 sm:p-5 shadow-xl transition-all ${themeStyle.bannerBg} ${highlightBorder}`}>
          {isHighlightOn && (
            <div className="absolute -top-2.5 left-4 px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 text-[9px] font-black uppercase tracking-wider flex items-center space-x-1 shadow-md">
              <Sparkles className="w-2.5 h-2.5" />
              <span>Native Feed Placement: {contextLocation}</span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-4 items-start">
            {imageUrl && (
              <img 
                src={imageUrl} 
                alt="Banner" 
                className="w-full sm:w-40 h-28 sm:h-28 rounded-xl object-cover border border-white/10 shrink-0" 
              />
            )}

            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase border ${themeStyle.badgeBg}`}>
                    {badgeText || 'Featured Employer'}
                  </span>
                  <span className="text-[10px] text-slate-400">Verified Partner</span>
                </div>
                <span className="text-[10px] text-slate-400">Sponsored Notice</span>
              </div>

              <h4 className="text-sm sm:text-base font-black text-white">
                {headline || 'Exciting Career & Academic Opportunity Headline'}
              </h4>

              <p className="text-xs text-slate-300 leading-relaxed line-clamp-2">
                {bodyText || 'Comprehensive description of the open positions, Gulf relocation contracts, or technical training certifications.'}
              </p>

              <div className="flex items-center justify-between pt-2 border-t border-white/10">
                <div className="text-[10px] text-slate-400">
                  Target Link: <span className="text-slate-200 font-mono">{ctaUrl || '#jobs'}</span>
                </div>

                <button
                  type="button"
                  onClick={handleSimulateClick}
                  className={`px-4 py-1.5 rounded-xl text-xs font-black flex items-center space-x-1.5 transition-all cursor-pointer ${themeStyle.btnBg}`}
                >
                  <span>{ctaText || 'Apply Now'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // 3. FLOATING TOAST NOTIFICATION (Bottom Right)
    if (placement === 'toast-float') {
      return (
        <div id="ad-live-preview-toast" className={`relative rounded-2xl border p-4 shadow-2xl transition-all max-w-sm ml-auto ${themeStyle.bannerBg} ${highlightBorder}`}>
          {isHighlightOn && (
            <div className="absolute -top-2.5 right-4 px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 text-[9px] font-black uppercase tracking-wider flex items-center space-x-1 shadow-md">
              <Sparkles className="w-2.5 h-2.5" />
              <span>Floating Toast (Bottom-Right)</span>
            </div>
          )}

          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center space-x-2">
              <span className="p-1 rounded-lg bg-white/10">
                <Bell className="w-3.5 h-3.5 text-white" />
              </span>
              <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase border ${themeStyle.badgeBg}`}>
                {badgeText || 'Instant Alert'}
              </span>
            </div>

            {dismissable && (
              <button 
                type="button"
                onClick={() => setIsDismissedInPreview(true)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="mt-2 space-y-1">
            <h5 className="text-xs font-black text-white leading-snug">
              {headline || 'Instant Job Opportunity Notification'}
            </h5>
            <p className="text-[11px] text-slate-300 line-clamp-2">
              {bodyText || 'Alert details will be highlighted here in a floating corner notification.'}
            </p>
          </div>

          <div className="mt-3 pt-2 border-t border-white/10 flex justify-end">
            <button
              type="button"
              onClick={handleSimulateClick}
              className={`px-3 py-1 rounded-lg text-[11px] font-black flex items-center space-x-1 cursor-pointer ${themeStyle.btnBg}`}
            >
              <span>{ctaText || 'Check Now'}</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      );
    }

    // 4. CENTERED LIGHTBOX POPUP MODAL
    if (placement === 'popup-modal') {
      return (
        <div id="ad-live-preview-popup" className={`relative rounded-3xl border p-6 shadow-2xl max-w-md mx-auto my-4 transition-all ${themeStyle.bannerBg} ${highlightBorder}`}>
          {isHighlightOn && (
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-black uppercase tracking-wider flex items-center space-x-1 shadow-lg">
              <Sparkles className="w-3 h-3" />
              <span>Centered Lightbox Popup Display</span>
            </div>
          )}

          <div className="flex justify-between items-center mb-3">
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${themeStyle.badgeBg}`}>
              {badgeText || 'Special Announcement'}
            </span>
            {dismissable && (
              <button 
                type="button"
                onClick={() => setIsDismissedInPreview(true)}
                className="p-1 rounded-full bg-black/30 hover:bg-black/60 text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {imageUrl && (
            <img 
              src={imageUrl} 
              alt="Popup Modal Graphic" 
              className="w-full h-36 rounded-2xl object-cover border border-white/10 mb-4 shadow-md" 
            />
          )}

          <div className="space-y-2 text-center">
            <h3 className="text-base font-black text-white leading-tight">
              {headline || 'Special Pop-up Announcement Title'}
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              {bodyText || 'Full details of your high-priority campaign, admissions deadline, or government exam recruitment schedule.'}
            </p>
          </div>

          <div className="mt-5 space-y-2">
            <button
              type="button"
              onClick={handleSimulateClick}
              className={`w-full py-2.5 rounded-xl text-xs font-black shadow-lg flex items-center justify-center space-x-2 transition-all cursor-pointer ${themeStyle.btnBg}`}
            >
              <span>{ctaText || 'Claim Opportunity'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            {dismissable && (
              <button
                type="button"
                onClick={() => setIsDismissedInPreview(true)}
                className="w-full py-1 text-[11px] text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                Dismiss / Continue to Page
              </button>
            )}
          </div>
        </div>
      );
    }

    // 5. SIDEBAR WIDGET CARD
    if (placement === 'sidebar') {
      return (
        <div id="ad-live-preview-sidebar" className={`relative rounded-2xl border p-4 shadow-xl transition-all ${themeStyle.bannerBg} ${highlightBorder}`}>
          {isHighlightOn && (
            <div className="absolute -top-2.5 left-3 px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 text-[9px] font-black uppercase tracking-wider flex items-center space-x-1 shadow-md">
              <Sparkles className="w-2.5 h-2.5" />
              <span>Sidebar / Filter Card</span>
            </div>
          )}

          <div className="space-y-2.5">
            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase border ${themeStyle.badgeBg}`}>
              {badgeText || 'Sponsored Service'}
            </span>

            {imageUrl && (
              <img 
                src={imageUrl} 
                alt="Sidebar Graphic" 
                className="w-full h-24 rounded-xl object-cover border border-white/10" 
              />
            )}

            <h5 className="text-xs font-black text-white leading-snug">
              {headline || 'Career Acceleration Service'}
            </h5>

            <p className="text-[11px] text-slate-300 line-clamp-2 leading-relaxed">
              {bodyText || 'Sidebar placement appears alongside search filters and form builders.'}
            </p>

            <button
              type="button"
              onClick={handleSimulateClick}
              className={`w-full py-2 rounded-xl text-[11px] font-black flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${themeStyle.btnBg}`}
            >
              <span>{ctaText || 'Learn More'}</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      );
    }

    // 6. SMS TEXT MESSAGE BROADCAST
    return (
      <div id="ad-live-preview-sms" className="p-4 bg-emerald-950/40 border border-emerald-500/40 rounded-2xl space-y-2">
        <div className="flex items-center justify-between text-xs text-emerald-400 font-bold">
          <span>📱 Direct Cellular SMS Preview</span>
          <span>From: {smsSenderId || 'HybridJobs'}</span>
        </div>
        <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs text-white font-mono leading-relaxed">
          {headline && <strong>{headline}: </strong>}
          {bodyText || 'HybridJobs Alert: 18 high-paying Remote & Gulf software engineer jobs matching your profile were posted today. Apply now at https://hybridjobs.pk/jobs'}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 text-white">
      
      {/* Top Controls Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        
        {/* Target Page Mockup Switcher */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-bold text-slate-400 mr-1 flex items-center space-x-1">
            <Globe className="w-3.5 h-3.5 text-emerald-400" />
            <span>Display Location:</span>
          </span>

          {[
            { id: 'alerts', label: 'Job Alerts Page', icon: Bell, badge: 'Popular' },
            { id: 'jobs', label: 'Jobs Search Feed', icon: Briefcase },
            { id: 'cv', label: 'ATS CV Builder', icon: FileText },
            { id: 'dashboard', label: 'User Dashboard', icon: Users },
            { id: 'all', label: 'Global Header (All)', icon: Globe }
          ].map((page) => {
            const Icon = page.icon;
            const isCurrent = activePreviewPage === page.id;
            const isTargeted = targetPages.includes(page.id as any) || targetPages.includes('all' as any);
            return (
              <button
                key={page.id}
                type="button"
                onClick={() => setActivePreviewPage(page.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer relative ${
                  isCurrent 
                    ? 'bg-emerald-500 text-slate-950 shadow-md font-black'
                    : isTargeted
                    ? 'bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/30'
                    : 'bg-slate-950 hover:bg-slate-800 text-slate-400 border border-slate-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{page.label}</span>
                {isTargeted && !isCurrent && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                )}
              </button>
            );
          })}
        </div>

        {/* Viewport Frame Selector & Highlight Toggle */}
        <div className="flex items-center space-x-2 self-end md:self-auto">
          {/* Highlight Placement Switch */}
          <button
            type="button"
            onClick={() => setIsHighlightOn(!isHighlightOn)}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
              isHighlightOn 
                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40' 
                : 'bg-slate-800 text-slate-400 border border-slate-700'
            }`}
            title="Toggle animated spotlight on ad placement"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Spotlight Ad</span>
          </button>

          {/* Device icons */}
          <div className="p-1 bg-slate-950 border border-slate-800 rounded-xl flex items-center space-x-1">
            <button
              type="button"
              onClick={() => setDeviceViewport('desktop')}
              className={`p-1.5 rounded-lg text-xs font-bold transition-all ${
                deviceViewport === 'desktop' ? 'bg-slate-800 text-emerald-400 shadow' : 'text-slate-400 hover:text-white'
              }`}
              title="Desktop Monitor View"
            >
              <Monitor className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setDeviceViewport('tablet')}
              className={`p-1.5 rounded-lg text-xs font-bold transition-all ${
                deviceViewport === 'tablet' ? 'bg-slate-800 text-emerald-400 shadow' : 'text-slate-400 hover:text-white'
              }`}
              title="Tablet (iPad) View"
            >
              <Tablet className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setDeviceViewport('mobile')}
              className={`p-1.5 rounded-lg text-xs font-bold transition-all ${
                deviceViewport === 'mobile' ? 'bg-slate-800 text-emerald-400 shadow' : 'text-slate-400 hover:text-white'
              }`}
              title="Mobile (iPhone) View"
            >
              <Smartphone className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>

      {/* Simulated Click Toast */}
      {lastActionToast && (
        <div className="p-3 bg-emerald-500 text-slate-950 rounded-xl text-xs font-black shadow-2xl flex items-center justify-between animate-in slide-in-from-top duration-200">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{lastActionToast}</span>
          </div>
          <span className="text-[10px] uppercase font-bold bg-slate-950/20 px-2 py-0.5 rounded">Live Simulation</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* AUTHENTIC BROWSER / DEVICE CANVAS MOCKUP */}
      {/* ========================================================================= */}
      <div className={`mx-auto transition-all duration-300 ${
        deviceViewport === 'mobile' 
          ? 'max-w-[400px]' 
          : deviceViewport === 'tablet' 
          ? 'max-w-[768px]' 
          : 'w-full'
      }`}>
        
        {/* Browser / Phone Wrapper Frame */}
        <div className="bg-slate-950 border-2 border-slate-800 rounded-3xl shadow-2xl overflow-hidden">
          
          {/* Top Browser Chrome / Window Header */}
          <div className="bg-slate-900/90 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="w-3 h-3 rounded-full bg-rose-500/80"></span>
              <span className="w-3 h-3 rounded-full bg-amber-500/80"></span>
              <span className="w-3 h-3 rounded-full bg-emerald-500/80"></span>
            </div>

            {/* URL Address Bar */}
            <div className="px-4 py-1 rounded-full bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-400 flex items-center space-x-2 max-w-sm w-full mx-3 justify-center">
              <span className="text-emerald-400">🔒 https://hybridjobs.pk</span>
              <span className="text-slate-500">
                {activePreviewPage === 'alerts' ? '/job-alerts' : activePreviewPage === 'jobs' ? '/explore-jobs' : activePreviewPage === 'cv' ? '/cv-builder' : '/dashboard'}
              </span>
            </div>

            <div className="flex items-center space-x-2 text-[11px] text-slate-400">
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold text-[10px]">
                {deviceViewport.toUpperCase()} PREVIEW
              </span>
            </div>
          </div>

          {/* PAGE CONTENT SIMULATION CANVAS */}
          <div className="p-4 sm:p-6 bg-slate-950 space-y-6 min-h-[480px]">
            
            {/* 1. Global Navigation Bar in Mockup */}
            <div className="pb-3 border-b border-slate-800/80 flex items-center justify-between text-xs">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-500 flex items-center justify-center font-black text-slate-950 text-xs">
                  HJ
                </div>
                <div>
                  <span className="font-black text-white text-sm tracking-tight">HybridJobs</span>
                  <span className="text-[10px] text-emerald-400 font-bold ml-1.5">PAKISTAN</span>
                </div>
              </div>

              <div className="hidden sm:flex items-center space-x-3 text-slate-300 text-xs font-semibold">
                <span className={activePreviewPage === 'jobs' ? 'text-emerald-400 font-bold underline' : 'hover:text-white'}>Jobs Feed</span>
                <span className={activePreviewPage === 'alerts' ? 'text-emerald-400 font-bold underline' : 'hover:text-white'}>Job Alerts</span>
                <span className={activePreviewPage === 'cv' ? 'text-emerald-400 font-bold underline' : 'hover:text-white'}>ATS CV Builder</span>
                <span className={activePreviewPage === 'dashboard' ? 'text-emerald-400 font-bold underline' : 'hover:text-white'}>Dashboard</span>
              </div>

              <div className="px-3 py-1 bg-emerald-500 text-slate-950 rounded-lg font-black text-[11px]">
                Post a Job
              </div>
            </div>

            {/* AD RENDERED IN TOP HEADER POSITION (If selected placement is top-header) */}
            {placement === 'top-header' && (
              <div className="space-y-1">
                {renderActualAdComponent(getPageDisplayName(activePreviewPage as any))}
              </div>
            )}

            {/* ================================================================= */}
            {/* VIEW A: REALISTIC JOB ALERTS PAGE MOCKUP */}
            {/* ================================================================= */}
            {activePreviewPage === 'alerts' && (
              <div className="space-y-6">
                
                {/* Page Title Header */}
                <div className="text-center max-w-xl mx-auto space-y-1 pt-1">
                  <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
                    <Bell className="w-3.5 h-3.5" />
                    <span>Automated Career Alert Engine</span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-white">
                    Instant Job Alerts & Notifications
                  </h2>
                  <p className="text-xs text-slate-400">
                    Get customized daily or weekly job digests sent directly to your Email and WhatsApp.
                  </p>
                </div>

                {/* AD RENDERED AS CENTERED POPUP OVERLAY */}
                {placement === 'popup-modal' && renderActualAdComponent('Job Alerts Lightbox')}

                {/* Job Alert Creator Box */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3 max-w-2xl mx-auto shadow-lg">
                  <div className="flex items-center space-x-2 text-xs font-bold text-white">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    <span>Create New Keyword Alert Subscription</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input 
                      type="text" 
                      readOnly 
                      value="Software Engineer, React, Remote" 
                      className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300"
                    />
                    <input 
                      type="text" 
                      readOnly 
                      value="candidate.talent@gmail.com" 
                      className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-1 text-xs">
                    <div className="flex items-center space-x-2 text-slate-400 text-[11px]">
                      <span>⚡ Daily Notification</span>
                      <span>•</span>
                      <span>📍 Islamabad, Lahore & Remote</span>
                    </div>
                    <span className="px-3 py-1 bg-emerald-500 text-slate-950 font-bold rounded-lg text-xs">
                      Subscribe Alert
                    </span>
                  </div>
                </div>

                {/* AD RENDERED INLINE IN ALERT FEED */}
                {placement === 'feed-inline' && (
                  <div className="max-w-2xl mx-auto">
                    {renderActualAdComponent('Job Alerts Feed')}
                  </div>
                )}

                {/* Existing Subscribed Alerts List */}
                <div className="max-w-2xl mx-auto space-y-3">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Your Active Job Alert Subscriptions (3)
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-white">Full Stack Node.js</span>
                        <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">Daily Email</span>
                      </div>
                      <div className="text-[11px] text-slate-400">USD Contracts • 14 New Matches This Week</div>
                    </div>

                    <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-white">FPSC Assistant Director</span>
                        <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">Govt Exam</span>
                      </div>
                      <div className="text-[11px] text-slate-400">BPS-17 Quota • Federal Public Service</div>
                    </div>
                  </div>
                </div>

                {/* AD RENDERED AS SIDEBAR CARD */}
                {placement === 'sidebar' && (
                  <div className="max-w-md mx-auto">
                    {renderActualAdComponent('Job Alerts Sidebar Widget')}
                  </div>
                )}

              </div>
            )}

            {/* ================================================================= */}
            {/* VIEW B: REALISTIC EXPLORE JOBS FEED MOCKUP */}
            {/* ================================================================= */}
            {activePreviewPage === 'jobs' && (
              <div className="space-y-5">
                
                {/* Search Bar */}
                <div className="bg-slate-900 border border-slate-800 p-3 rounded-2xl flex flex-col sm:flex-row items-center gap-2">
                  <div className="flex items-center space-x-2 flex-1 px-2 text-slate-400 text-xs w-full">
                    <Search className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Search 1,450+ verified Pakistani and remote jobs...</span>
                  </div>
                  <button className="px-4 py-2 bg-emerald-500 text-slate-950 font-black text-xs rounded-xl w-full sm:w-auto">
                    Find Jobs
                  </button>
                </div>

                {placement === 'popup-modal' && renderActualAdComponent('Jobs Feed Lightbox Modal')}

                {/* Jobs Feed Grid with Inline Ad */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  
                  {/* Left Column: Job Cards + Inline Ad */}
                  <div className="lg:col-span-2 space-y-3">
                    
                    {/* Simulated Job Card 1 */}
                    <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-white">Senior React & Next.js Engineer</span>
                        <span className="text-xs font-mono font-bold text-emerald-400">$3,500 - $5,000 / mo</span>
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center space-x-2">
                        <span>DevsHub Global</span>
                        <span>•</span>
                        <span>📍 Remote (Pakistan / US Hours)</span>
                      </div>
                    </div>

                    {/* AD DISPLAYED DIRECTLY INLINE BETWEEN JOBS */}
                    {placement === 'feed-inline' && (
                      <div className="py-1">
                        {renderActualAdComponent('Between Job Cards')}
                      </div>
                    )}

                    {/* Simulated Job Card 2 */}
                    <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-white">DevOps & Cloud Architect (AWS)</span>
                        <span className="text-xs font-mono font-bold text-indigo-300">PKR 350,000 - 500,000</span>
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center space-x-2">
                        <span>TechLogix Lahore</span>
                        <span>•</span>
                        <span>📍 On-site Gulberg III, Lahore</span>
                      </div>
                    </div>

                  </div>

                  {/* Right Column: Sidebar */}
                  <div className="space-y-4">
                    {placement === 'sidebar' ? (
                      renderActualAdComponent('Jobs Feed Filter Sidebar')
                    ) : (
                      <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-3 text-xs">
                        <div className="font-bold text-white flex items-center space-x-2">
                          <Filter className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Search Filters</span>
                        </div>
                        <div className="space-y-1.5 text-slate-400 text-[11px]">
                          <label className="flex items-center space-x-2">
                            <input type="checkbox" checked readOnly className="rounded" />
                            <span>Remote / Work from Home</span>
                          </label>
                          <label className="flex items-center space-x-2">
                            <input type="checkbox" checked readOnly className="rounded" />
                            <span>USD / Foreign Currency Contracts</span>
                          </label>
                          <label className="flex items-center space-x-2">
                            <input type="checkbox" readOnly className="rounded" />
                            <span>Government FPSC / PPSC BPS-17+</span>
                          </label>
                        </div>
                      </div>
                    )}
                  </div>

                </div>

              </div>
            )}

            {/* ================================================================= */}
            {/* VIEW C: ATS CV BUILDER PAGE MOCKUP */}
            {/* ================================================================= */}
            {activePreviewPage === 'cv' && (
              <div className="space-y-5">
                <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between">
                  <div className="space-y-0.5">
                    <h3 className="text-sm font-black text-white">ATS Resume Score: 94 / 100</h3>
                    <p className="text-xs text-slate-400">Optimized for Pakistani IT & Gulf Relocation hiring ATS.</p>
                  </div>
                  <div className="px-3 py-1.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold">
                    Export PDF
                  </div>
                </div>

                {placement === 'popup-modal' && renderActualAdComponent('CV Builder Popup')}
                {placement === 'feed-inline' && renderActualAdComponent('CV Builder Template Carousel')}
                {placement === 'sidebar' && renderActualAdComponent('CV Builder Sidebar')}

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 space-y-1">
                    <div className="font-bold text-white">Executive faang template</div>
                    <div className="text-[10px] text-slate-500">2-Column Minimalist ATS Format</div>
                  </div>
                  <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 space-y-1">
                    <div className="font-bold text-white">Gulf Healthcare & Engineering</div>
                    <div className="text-[10px] text-slate-500">MOH / DHA UAE Verified Layout</div>
                  </div>
                </div>
              </div>
            )}

            {/* ================================================================= */}
            {/* VIEW D: USER DASHBOARD MOCKUP */}
            {/* ================================================================= */}
            {activePreviewPage === 'dashboard' && (
              <div className="space-y-4">
                <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between">
                  <div>
                    <div className="text-sm font-black text-white">Candidate Account Dashboard</div>
                    <div className="text-xs text-slate-400">3 Submitted Applications • 1 Shortlisted Interview</div>
                  </div>
                  <span className="px-2.5 py-1 bg-indigo-500/20 text-indigo-300 rounded-lg text-xs font-bold">
                    Pro Verified
                  </span>
                </div>

                {placement === 'popup-modal' && renderActualAdComponent('Dashboard Lightbox')}
                {placement === 'feed-inline' && renderActualAdComponent('Dashboard Stream')}
                {placement === 'sidebar' && renderActualAdComponent('Dashboard Activity Widget')}
              </div>
            )}

            {/* ================================================================= */}
            {/* VIEW E: GLOBAL HEADER / ALL PAGES MOCKUP */}
            {activePreviewPage === 'all' && placement !== 'top-header' && (
              <div className="space-y-4">
                <div className="text-xs text-slate-400 text-center">
                  Campaign will be displayed site-wide on all pages as a <strong>{getPlacementDisplayName(placement)}</strong>.
                </div>
                {renderActualAdComponent('Site-Wide Placement')}
              </div>
            )}

            {/* FLOATING TOAST NOTIFICATION RENDER (Bottom-Right corner of canvas) */}
            {placement === 'toast-float' && (
              <div className="pt-4">
                {renderActualAdComponent(getPageDisplayName(activePreviewPage as any))}
              </div>
            )}

          </div>

          {/* Footer Bar inside Mockup */}
          <div className="bg-slate-900 px-4 py-2 border-t border-slate-800 text-[10px] text-slate-500 flex items-center justify-between">
            <span>© 2026 HybridJobs Pakistan • Official Career & Ad Network</span>
            <span className="text-emerald-400 font-bold">Preview Mode: Real-Time Optical Sync Active</span>
          </div>

        </div>

      </div>

    </div>
  );
};
