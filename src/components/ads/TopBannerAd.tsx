import React, { useState, useEffect } from 'react';
import { Advertisement, AdTargetPage } from '../../types/ad';
import { 
  X, 
  Sparkles, 
  ExternalLink, 
  ArrowRight, 
  Megaphone, 
  ChevronLeft, 
  ChevronRight, 
  Play, 
  Pause, 
  Flame, 
  Crown 
} from 'lucide-react';

interface TopBannerAdProps {
  ads: Advertisement[];
  currentPage: AdTargetPage;
  onAdClick: (ad: Advertisement) => void;
  onNavigateTab?: (tab: 'jobs' | 'cv' | 'alerts' | 'dashboard') => void;
  autoPlayIntervalMs?: number;
  showDemoCardIfEmpty?: boolean;
}

export const TopBannerAd: React.FC<TopBannerAdProps> = ({
  ads,
  currentPage,
  onAdClick,
  onNavigateTab,
  autoPlayIntervalMs = 6000,
  showDemoCardIfEmpty = true
}) => {
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // Demo fallback ad if no active banner is available
  const demoBannerAd: Advertisement = {
    id: 'demo-your-ad-here',
    title: 'Your Ad Here Commercial Banner',
    type: 'banner',
    targetPages: ['all'],
    placement: 'top-header',
    status: 'active',
    approvalStatus: 'Approved',
    submittedByUserId: 'system-demo',
    submittedByUserName: 'Platform Promotion',
    headline: '🌟 Your Ad / Job Notice Here! Reach 250,000+ Verified Candidates & Employers Daily',
    bodyText: 'Place your urgent hiring campaigns, corporate hiring drives, or commercial services at the top of all pages.',
    badgeText: '👑 Advertise Here',
    ctaText: 'Post Banner Campaign',
    ctaUrl: '#dashboard',
    theme: 'amber',
    dismissable: true,
    impressions: 15420,
    clicks: 890,
    createdAt: '2026-08-20',
    durationUnit: 'days',
    durationValue: 30
  };

  // Find all active banners matching the current page
  const matchingBanners = ads.filter(
    (ad) =>
      ad.status === 'active' &&
      (ad.placement === 'top-header' || (ad.type === 'banner' && ad.placement === 'top-header')) &&
      (ad.targetPages.includes('all') || ad.targetPages.includes(currentPage)) &&
      !dismissedIds.includes(ad.id)
  );

  // If no matching banners and showDemoCard is true, show the demo ad
  const activeBannerList = matchingBanners.length > 0 
    ? matchingBanners 
    : (showDemoCardIfEmpty && !dismissedIds.includes('demo-your-ad-here') ? [demoBannerAd] : []);

  // Ensure index is within range
  const activeCount = activeBannerList.length;
  const safeIndex = activeCount > 0 ? (currentIndex % activeCount) : 0;
  const activeBanner = activeBannerList[safeIndex];

  // Auto-play timer
  useEffect(() => {
    if (activeCount <= 1 || isPaused) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % activeCount);
    }, autoPlayIntervalMs);

    return () => clearInterval(timer);
  }, [activeCount, isPaused, autoPlayIntervalMs]);

  if (!activeBanner) return null;

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDismissedIds((prev) => [...prev, activeBanner.id]);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % activeCount);
  };

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev - 1 + activeCount) % activeCount);
  };

  const handleAction = () => {
    onAdClick(activeBanner);

    if (activeBanner.ctaUrl) {
      if (activeBanner.ctaUrl.startsWith('#') && onNavigateTab) {
        const tab = activeBanner.ctaUrl.replace('#', '') as 'jobs' | 'cv' | 'alerts' | 'dashboard';
        if (['jobs', 'cv', 'alerts', 'dashboard'].includes(tab)) {
          onNavigateTab(tab);
          return;
        }
      }
      
      if (activeBanner.ctaUrl.startsWith('http')) {
        window.open(activeBanner.ctaUrl, '_blank', 'noopener,noreferrer');
      }
    }
  };

  // Theme styling map
  const themeClasses: Record<string, { bg: string; border: string; badge: string; text: string; button: string }> = {
    indigo: {
      bg: 'bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-950',
      border: 'border-indigo-500/40',
      badge: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
      text: 'text-indigo-200',
      button: 'bg-indigo-500 hover:bg-indigo-400 text-slate-950 shadow-indigo-500/25'
    },
    emerald: {
      bg: 'bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-950',
      border: 'border-emerald-500/40',
      badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      text: 'text-emerald-200',
      button: 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/25'
    },
    amber: {
      bg: 'bg-gradient-to-r from-amber-950 via-slate-900 to-amber-950',
      border: 'border-amber-500/40',
      badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
      text: 'text-amber-200',
      button: 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/25'
    },
    rose: {
      bg: 'bg-gradient-to-r from-rose-950 via-slate-900 to-rose-950',
      border: 'border-rose-500/40',
      badge: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
      text: 'text-rose-200',
      button: 'bg-rose-500 hover:bg-rose-400 text-white shadow-rose-500/25'
    },
    'gradient-purple': {
      bg: 'bg-gradient-to-r from-purple-950 via-slate-900 to-pink-950',
      border: 'border-purple-500/40',
      badge: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
      text: 'text-purple-200',
      button: 'bg-purple-500 hover:bg-purple-400 text-white shadow-purple-500/25'
    },
    'gradient-ocean': {
      bg: 'bg-gradient-to-r from-teal-950 via-slate-900 to-blue-950',
      border: 'border-teal-500/40',
      badge: 'bg-teal-500/20 text-teal-300 border-teal-500/30',
      text: 'text-teal-200',
      button: 'bg-teal-500 hover:bg-teal-400 text-slate-950 shadow-teal-500/25'
    },
    slate: {
      bg: 'bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900',
      border: 'border-slate-700',
      badge: 'bg-slate-800 text-slate-300 border-slate-700',
      text: 'text-slate-300',
      button: 'bg-white hover:bg-slate-200 text-slate-950 shadow-white/20'
    }
  };

  const style = themeClasses[activeBanner.theme] || themeClasses.indigo;
  const isDemo = activeBanner.id === 'demo-your-ad-here';

  return (
    <div
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onClick={handleAction}
      className={`relative w-full ${style.bg} border-b ${style.border} px-4 py-2.5 sm:py-3 transition-all duration-300 cursor-pointer group z-30 shadow-lg`}
    >
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-white">
        
        {/* Left Side: Thumbnail / Icon + Headline + Body */}
        <div className="flex items-center space-x-3 w-full sm:w-auto overflow-hidden">
          {activeBanner.imageUrl ? (
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl overflow-hidden flex-shrink-0 border border-white/20 shadow-md">
              <img
                src={activeBanner.imageUrl}
                alt={activeBanner.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                referrerPolicy="no-referrer"
              />
            </div>
          ) : (
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md ${
              isDemo ? 'bg-amber-500/30 border border-amber-400 text-amber-300' : 'bg-white/10 text-emerald-400'
            }`}>
              {isDemo ? (
                <Crown className="w-5 h-5 animate-pulse text-amber-300" />
              ) : (
                <Megaphone className="w-4 h-4 animate-bounce" />
              )}
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2 flex-wrap">
              {activeBanner.badgeText && (
                <span className={`text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full border ${style.badge}`}>
                  {activeBanner.badgeText}
                </span>
              )}
              {isDemo && (
                <span className="text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Demo Card
                </span>
              )}
              <h4 className="text-xs sm:text-sm font-bold text-white group-hover:text-amber-300 transition-colors truncate">
                {activeBanner.headline}
              </h4>
            </div>
            {activeBanner.bodyText && (
              <p className="text-[11px] text-slate-300 hidden md:block truncate mt-0.5 max-w-2xl">
                {activeBanner.bodyText}
              </p>
            )}
          </div>
        </div>

        {/* Right Side: Navigation Dots / Arrows (if multi) + CTA Button + Dismiss Button */}
        <div className="flex items-center space-x-2.5 flex-shrink-0 self-end sm:self-auto">
          {activeCount > 1 && (
            <div className="flex items-center space-x-1.5 mr-1" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={handlePrev}
                className="p-1 rounded-lg bg-black/30 hover:bg-black/50 text-slate-300 hover:text-white transition-all cursor-pointer"
                title="Previous Announcement"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              {/* Dots */}
              <div className="flex items-center space-x-1">
                {activeBannerList.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setCurrentIndex(idx)}
                    className={`h-1.5 rounded-full transition-all cursor-pointer ${
                      idx === safeIndex ? 'w-4 bg-white' : 'w-1.5 bg-white/40 hover:bg-white/70'
                    }`}
                  />
                ))}
              </div>

              <button
                type="button"
                onClick={handleNext}
                className="p-1 rounded-lg bg-black/30 hover:bg-black/50 text-slate-300 hover:text-white transition-all cursor-pointer"
                title="Next Announcement"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {activeBanner.ctaText && (
            <button
              onClick={handleAction}
              className={`px-3.5 py-1.5 rounded-xl font-black text-xs shadow-md transition-all flex items-center space-x-1.5 active:scale-95 cursor-pointer ${style.button}`}
            >
              <span>{activeBanner.ctaText}</span>
              {activeBanner.ctaUrl?.startsWith('http') ? (
                <ExternalLink className="w-3 h-3" />
              ) : (
                <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              )}
            </button>
          )}

          {activeBanner.dismissable && (
            <button
              onClick={handleDismiss}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
              title="Dismiss announcement banner"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
