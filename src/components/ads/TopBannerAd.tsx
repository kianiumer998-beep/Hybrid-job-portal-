import React, { useState, useEffect, useMemo } from 'react';
import {
  Advertisement,
  AdTargetPage,
  BannerDimensionSettings,
  DEFAULT_BANNER_DIMENSIONS,
  BannerAppearanceSettings,
  DEFAULT_BANNER_APPEARANCE,
  BannerBehaviorSettings,
  DEFAULT_BANNER_BEHAVIOR,
  PlacementRotationConfig,
  DEFAULT_PLACEMENT_ROTATION_CONFIG,
  isAdCurrentlyRunning
} from '../../types/ad';
import { getRotatedItems, getVisibleWindow, getNextStepSize } from '../../utils/adRotation';
import {
  X,
  ExternalLink,
  ArrowRight,
  Megaphone,
  ChevronLeft,
  ChevronRight,
  Crown
} from 'lucide-react';

interface TopBannerAdProps {
  ads: Advertisement[];
  currentPage: AdTargetPage;
  onAdClick: (ad: Advertisement) => void;
  onNavigateTab?: (tab: 'jobs' | 'cv' | 'alerts' | 'dashboard') => void;
  autoPlayIntervalMs?: number;
  showDemoCardIfEmpty?: boolean;
  bannerDimensions?: BannerDimensionSettings;
  bannerAppearance?: BannerAppearanceSettings;
  bannerBehavior?: BannerBehaviorSettings;
  rotationSettings?: PlacementRotationConfig;
  maxConcurrentSlots?: number;
}

export const TopBannerAd: React.FC<TopBannerAdProps> = ({
  ads,
  currentPage,
  onAdClick,
  onNavigateTab,
  autoPlayIntervalMs = 6000,
  showDemoCardIfEmpty = true,
  bannerDimensions = DEFAULT_BANNER_DIMENSIONS,
  bannerAppearance = DEFAULT_BANNER_APPEARANCE,
  bannerBehavior = DEFAULT_BANNER_BEHAVIOR,
  rotationSettings = DEFAULT_PLACEMENT_ROTATION_CONFIG,
  maxConcurrentSlots = 1
}) => {
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isMobile, setIsMobile] = useState<boolean>(() => typeof window !== 'undefined' ? window.innerWidth < 640 : false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Demo fallback ad if no active banner is available
  const demoBannerAd: Advertisement = useMemo(() => ({
    id: 'demo-your-ad-here',
    title: 'Your Ad Here Commercial Banner',
    type: 'banner',
    targetPages: ['all'],
    placement: 'top-header',
    status: 'active',
    approvalStatus: 'Approved',
    submittedByUserId: 'system-demo',
    submittedByUserName: 'Platform Promotion',
    headline: '🌟 Promote Your Brand, Job Notice, or Service Here',
    bodyText: 'Place your urgent hiring campaigns, corporate hiring drives, or commercial services at the top of all pages.',
    badgeText: '👑 Advertise Here',
    ctaText: 'Post Banner Campaign',
    ctaUrl: '#dashboard',
    theme: 'amber',
    dismissable: true,
    impressions: 0,
    clicks: 0,
    createdAt: '2026-08-20',
    durationUnit: 'days',
    durationValue: 30
  }), []);

  // Find all active banners matching the current page
  const matchingBanners = useMemo(() => {
    const filtered = ads.filter(
      (ad) =>
        isAdCurrentlyRunning(ad) &&
        ((ad.placement as string) === 'top-header' || (ad.type === 'banner' && (ad.placement as string) === 'top-header')) &&
        (ad.targetPages.includes('all') || ad.targetPages.includes(currentPage)) &&
        !dismissedIds.includes(ad.id)
    );
    const rotationEnabled = rotationSettings?.enabled !== false;
    const seqMode = rotationEnabled ? (rotationSettings?.sequenceMode || 'sequential_per_visit') : 'fixed';
    return getRotatedItems(filtered, 'ad_top-header', seqMode);
  }, [ads, currentPage, dismissedIds, rotationSettings?.enabled, rotationSettings?.sequenceMode]);

  // If no matching banners and showDemoCard is true, show the demo ad
  const activeBannerList = useMemo(() => (
    matchingBanners.length > 0
      ? matchingBanners
      : (showDemoCardIfEmpty && !dismissedIds.includes('demo-your-ad-here') ? [demoBannerAd] : [])
  ), [matchingBanners, showDemoCardIfEmpty, dismissedIds, demoBannerAd]);

  const activeCount = activeBannerList.length;
  const slotsLimit = Math.max(1, Math.min(4, Math.floor(Number(maxConcurrentSlots) || 1)));
  const visibleSlotsCount = activeCount > 0 ? Math.min(activeCount, slotsLimit) : 0;
  const safeIndex = activeCount > 0 ? (currentIndex % activeCount) : 0;
  const visibleBanners = useMemo(
    () => getVisibleWindow(activeBannerList, safeIndex, visibleSlotsCount),
    [activeBannerList, safeIndex, visibleSlotsCount]
  );

  // Auto-play timer
  const rotationEnabled = rotationSettings?.enabled !== false;
  const isAutoRotate = rotationEnabled && (rotationSettings?.autoRotateTimed ?? bannerBehavior?.autoRotate) !== false && bannerBehavior?.autoRotate !== false;
  const configuredIntervalSec = rotationSettings?.intervalSeconds ?? bannerBehavior?.rotationIntervalSeconds ?? (autoPlayIntervalMs / 1000) ?? 6;
  const effectiveInterval = Math.max(2, Math.min(120, Number(configuredIntervalSec) || 6)) * 1000;
  const isPauseOnHover = bannerBehavior?.pauseOnHover !== false;
  const stepSize = getNextStepSize(activeCount, visibleSlotsCount);

  useEffect(() => {
    if (activeCount <= visibleSlotsCount || !isAutoRotate || (isPauseOnHover && isPaused)) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + stepSize) % activeCount);
    }, effectiveInterval);

    return () => clearInterval(timer);
  }, [activeCount, visibleSlotsCount, stepSize, isPaused, isAutoRotate, isPauseOnHover, effectiveInterval]);

  if (visibleBanners.length === 0) return null;

  const handleDismiss = (e: React.MouseEvent, bannerId: string) => {
    e.stopPropagation();
    setDismissedIds((prev) => [...prev, bannerId]);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev + stepSize) % activeCount);
  };

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev - stepSize + activeCount) % activeCount);
  };

  const handleAction = (banner: Advertisement) => {
    onAdClick(banner);

    if (banner.ctaUrl) {
      if (banner.ctaUrl.startsWith('#') && onNavigateTab) {
        const tab = banner.ctaUrl.replace('#', '') as 'jobs' | 'cv' | 'alerts' | 'dashboard';
        if (['jobs', 'cv', 'alerts', 'dashboard'].includes(tab)) {
          onNavigateTab(tab);
          return;
        }
      }

      if (banner.ctaUrl.startsWith('http')) {
        window.open(banner.ctaUrl, '_blank', 'noopener,noreferrer');
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

  const targetWidth = isMobile
    ? (bannerDimensions?.mobileWidth && bannerDimensions.mobileWidth !== '100%' ? bannerDimensions.mobileWidth : undefined)
    : (bannerDimensions?.desktopWidth && bannerDimensions.desktopWidth !== '100%' ? bannerDimensions.desktopWidth : undefined);

  const targetHeight = isMobile
    ? (bannerDimensions?.mobileHeight && bannerDimensions.mobileHeight !== 'auto' ? bannerDimensions.mobileHeight : undefined)
    : (bannerDimensions?.desktopHeight && bannerDimensions.desktopHeight !== 'auto' ? bannerDimensions.desktopHeight : undefined);

  const containerStyle: React.CSSProperties = {
    maxWidth: targetWidth,
    minHeight: targetHeight
  };

  const paddingClass = bannerAppearance?.paddingPreset === 'compact' ? 'px-3 py-1.5 sm:py-2' : bannerAppearance?.paddingPreset === 'spacious' ? 'px-6 py-4 sm:py-5' : 'px-4 py-2.5 sm:py-3';
  const radiusClass = bannerAppearance?.borderRadiusPreset === 'none' ? 'rounded-none' : bannerAppearance?.borderRadiusPreset === 'sm' ? 'rounded-sm' : bannerAppearance?.borderRadiusPreset === 'md' ? 'rounded-md' : bannerAppearance?.borderRadiusPreset === 'lg' ? 'rounded-lg' : bannerAppearance?.borderRadiusPreset === 'xl' ? 'rounded-xl' : bannerAppearance?.borderRadiusPreset === '2xl' ? 'rounded-2xl' : bannerAppearance?.borderRadiusPreset === 'full' ? 'rounded-full' : 'rounded-none';
  const imgPosClass = bannerAppearance?.imagePosition === 'right' ? 'flex-row-reverse space-x-reverse' : bannerAppearance?.imagePosition === 'top' ? 'flex-col space-y-2' : 'flex-row';
  const textAlignClass = bannerAppearance?.textAlignment === 'center' ? 'text-center' : bannerAppearance?.textAlignment === 'right' ? 'text-right' : 'text-left';

  const hasMorePages = activeCount > visibleSlotsCount;

  return (
    <div
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      style={containerStyle}
      className="relative w-full z-30 mx-auto space-y-0"
    >
      {visibleBanners.map((activeBanner, slotIdx) => {
        const style = themeClasses[activeBanner.theme] || themeClasses.indigo;
        const isDemo = activeBanner.id === 'demo-your-ad-here';

        return (
          <div
            key={`${activeBanner.id}-${slotIdx}`}
            onClick={() => handleAction(activeBanner)}
            className={`relative w-full ${style.bg} border-b ${style.border} ${paddingClass} ${radiusClass} transition-all duration-300 cursor-pointer group shadow-lg`}
          >
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-white">
              {/* Left Side: Thumbnail / Icon + Headline + Body */}
              <div className={`flex items-center space-x-3 ${imgPosClass} w-full sm:w-auto overflow-hidden`}>
                {bannerAppearance?.showBannerImage !== false && (
                  activeBanner.imageUrl ? (
                    <div className={`rounded-xl overflow-hidden flex-shrink-0 border border-white/20 shadow-md ${
                      bannerAppearance?.imageSizePreset === 'small' ? 'w-8 h-8' :
                      bannerAppearance?.imageSizePreset === 'large' ? 'w-14 h-14' : 'w-10 h-10 sm:w-12 sm:h-12'
                    }`}>
                      <img
                        src={activeBanner.imageUrl}
                        alt={activeBanner.title}
                        className={`w-full h-full group-hover:scale-105 transition-transform duration-300 ${
                          bannerAppearance?.imageFit === 'contain' ? 'object-contain' : 'object-cover'
                        }`}
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
                  )
                )}

                <div className={`flex-1 min-w-0 ${textAlignClass}`}>
                  <div className="flex items-center space-x-2 flex-wrap">
                    {bannerAppearance?.showBadge !== false && activeBanner.badgeText && (
                      <span className={`text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full border ${style.badge}`}>
                        {activeBanner.badgeText}
                      </span>
                    )}
                    {bannerAppearance?.showBadge !== false && isDemo && (
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

              {/* Right Side: Navigation Dots / Arrows (only on primary slot if multi) + CTA Button + Dismiss Button */}
              <div className="flex items-center space-x-2.5 flex-shrink-0 self-end sm:self-auto">
                {slotIdx === 0 && hasMorePages && (
                  <div className="flex items-center space-x-1.5 mr-1" onClick={(e) => e.stopPropagation()}>
                    {bannerBehavior?.showNavigationArrows !== false && (
                      <button
                        type="button"
                        onClick={handlePrev}
                        className="p-1 rounded-lg bg-black/30 hover:bg-black/50 text-slate-300 hover:text-white transition-all cursor-pointer"
                        title="Previous Announcement"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* Dots */}
                    {bannerBehavior?.showNavigationDots !== false && (
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
                    )}

                    {bannerBehavior?.showNavigationArrows !== false && (
                      <button
                        type="button"
                        onClick={handleNext}
                        className="p-1 rounded-lg bg-black/30 hover:bg-black/50 text-slate-300 hover:text-white transition-all cursor-pointer"
                        title="Next Announcement"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}

                {bannerAppearance?.showCtaButton !== false && activeBanner.ctaText && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAction(activeBanner);
                    }}
                    className={`rounded-xl font-black text-xs shadow-md transition-all flex items-center space-x-1.5 active:scale-95 cursor-pointer ${style.button} ${
                      bannerAppearance?.ctaSizePreset === 'small' ? 'px-2.5 py-1 text-[11px]' :
                      bannerAppearance?.ctaSizePreset === 'large' ? 'px-4 py-2 text-xs' : 'px-3.5 py-1.5'
                    }`}
                  >
                    <span>{activeBanner.ctaText}</span>
                    {activeBanner.ctaUrl?.startsWith('http') ? (
                      <ExternalLink className="w-3 h-3" />
                    ) : (
                      <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                    )}
                  </button>
                )}

                {bannerAppearance?.showDismissButton !== false && bannerBehavior?.allowDismiss !== false && activeBanner.dismissable && (
                  <button
                    onClick={(e) => handleDismiss(e, activeBanner.id)}
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
      })}
    </div>
  );
};
