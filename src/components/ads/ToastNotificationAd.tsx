import React, { useState, useEffect, useMemo } from 'react';
import {
  Advertisement,
  AdTargetPage,
  PlacementRotationConfig,
  DEFAULT_PLACEMENT_ROTATION_CONFIG,
  isAdCurrentlyRunning
} from '../../types/ad';
import { getRotatedItems } from '../../utils/adRotation';
import { X, ArrowRight, Zap, ChevronLeft, ChevronRight } from 'lucide-react';

interface ToastNotificationAdProps {
  ads: Advertisement[];
  currentPage: AdTargetPage;
  onAdClick: (ad: Advertisement) => void;
  onNavigateTab?: (tab: 'jobs' | 'cv' | 'alerts' | 'dashboard') => void;
  rotationSettings?: PlacementRotationConfig;
}

export const ToastNotificationAd: React.FC<ToastNotificationAdProps> = ({
  ads,
  currentPage,
  onAdClick,
  onNavigateTab,
  rotationSettings = DEFAULT_PLACEMENT_ROTATION_CONFIG
}) => {
  const [dismissedToastIds, setDismissedToastIds] = useState<string[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const orderedCandidates = useMemo(() => {
    const filtered = ads.filter(
      (ad) =>
        isAdCurrentlyRunning(ad) &&
        (ad.type === 'notification' || ad.placement === 'toast-float') &&
        (ad.targetPages.includes('all') || ad.targetPages.includes(currentPage)) &&
        !dismissedToastIds.includes(ad.id)
    );
    const rotationEnabled = rotationSettings?.enabled !== false;
    const seqMode = rotationEnabled ? (rotationSettings?.sequenceMode || 'sequential_per_visit') : 'fixed';
    return getRotatedItems(filtered, 'ad_toast-float', seqMode);
  }, [ads, currentPage, dismissedToastIds, rotationSettings?.enabled, rotationSettings?.sequenceMode]);

  useEffect(() => {
    if (orderedCandidates.length === 0) {
      setIsReady(false);
      return;
    }
    const timer = window.setTimeout(() => {
      setIsReady(true);
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [orderedCandidates.length]);

  const rotationEnabled = rotationSettings?.enabled !== false;
  const isAutoRotate = rotationEnabled && rotationSettings?.autoRotateTimed !== false;
  const intervalMs = Math.max(2, Math.min(120, Number(rotationSettings?.intervalSeconds) || 6)) * 1000;

  useEffect(() => {
    if (!isReady || orderedCandidates.length <= 1 || !isAutoRotate || isPaused) return;
    const timer = window.setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % orderedCandidates.length);
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [isReady, orderedCandidates.length, isAutoRotate, isPaused, intervalMs]);

  if (orderedCandidates.length === 0) {
    return (
      <button
        type="button"
        onClick={() => onAdClick({
          id: 'demo-your-ad-here', title: 'Your Ad Here — Floating Toast Placement',
          type: 'banner', placement: 'toast-float', targetPages: ['all'], status: 'active',
          approvalStatus: 'Approved', submittedByUserId: 'system-demo',
          submittedByUserName: 'Platform Promotion', headline: 'Your Ad Here',
          bodyText: 'Promote your campaign in the floating notification placement.',
          badgeText: 'Advertise Here', ctaText: 'Choose Ad Package', ctaUrl: '',
          theme: 'amber', dismissable: false, impressions: 0, clicks: 0,
          createdAt: new Date().toISOString(), durationUnit: 'days', durationValue: 1
        } as Advertisement)}
        className="fixed bottom-5 right-4 z-40 inline-flex items-center gap-1.5 rounded-full border border-amber-400/60 bg-slate-950/95 px-3 py-2 text-[10px] font-black text-amber-200 shadow-[0_0_18px_rgba(251,191,36,0.18)] backdrop-blur transition hover:border-amber-300 hover:bg-amber-400/10"
        aria-label="Advertise in floating notification placement"
      >
        <Zap className="h-3 w-3 text-amber-300" /> Your Ad Here <ArrowRight className="h-3 w-3" />
      </button>
    );
  }
  if (!isReady) return null;

  const safeIndex = currentIndex % orderedCandidates.length;
  const visibleAd = orderedCandidates[safeIndex];
  if (!visibleAd) return null;

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDismissedToastIds((prev) => [...prev, visibleAd.id]);
    setCurrentIndex(0);
  };

  const handleAction = () => {
    onAdClick(visibleAd);

    if (visibleAd.ctaUrl) {
      if (visibleAd.ctaUrl.startsWith('#') && onNavigateTab) {
        const tab = visibleAd.ctaUrl.replace('#', '') as 'jobs' | 'cv' | 'alerts' | 'dashboard';
        if (['jobs', 'cv', 'alerts', 'dashboard'].includes(tab)) {
          onNavigateTab(tab);
          return;
        }
      }

      if (visibleAd.ctaUrl.startsWith('http')) {
        window.open(visibleAd.ctaUrl, '_blank', 'noopener,noreferrer');
      }
    }
  };

  return (
    <div
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onClick={handleAction}
      className="fixed bottom-6 right-6 z-40 max-w-sm w-full bg-slate-900/95 backdrop-blur-md border border-emerald-500/40 hover:border-emerald-400 rounded-2xl p-4 shadow-2xl transition-all duration-300 cursor-pointer group hover:scale-[1.02] animate-slideInRight"
    >
      <div className="flex items-start space-x-3">
        {/* Glowing Icon */}
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-600 p-0.5 shadow-lg shadow-emerald-500/20 flex-shrink-0">
          <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
            <Zap className="w-5 h-5 text-emerald-400 animate-pulse" />
          </div>
        </div>

        {/* Text Content */}
        <div className="flex-1 min-w-0 pr-4">
          <div className="flex items-center space-x-2 mb-1">
            <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              {visibleAd.badgeText || 'Job Alert'}
            </span>
            {orderedCandidates.length > 1 ? (
              <span className="text-[10px] text-slate-400 font-mono font-bold">
                {safeIndex + 1}/{orderedCandidates.length}
              </span>
            ) : (
              <span className="text-[10px] text-slate-500">Just now</span>
            )}
          </div>

          <h4 className="text-xs font-bold text-white group-hover:text-emerald-300 transition-colors line-clamp-2">
            {visibleAd.headline}
          </h4>

          {visibleAd.bodyText && (
            <p className="text-[11px] text-slate-300 mt-1 line-clamp-2 leading-tight">
              {visibleAd.bodyText}
            </p>
          )}

          <div className="mt-2.5 flex items-center justify-between gap-2">
            {visibleAd.ctaText ? (
              <div className="flex items-center space-x-1 text-xs font-bold text-emerald-400 group-hover:underline">
                <span>{visibleAd.ctaText}</span>
                <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
              </div>
            ) : <span />}

            {orderedCandidates.length > 1 && (
              <div className="flex items-center space-x-1" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => setCurrentIndex((prev) => (prev - 1 + orderedCandidates.length) % orderedCandidates.length)}
                  className="p-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer"
                  title="Previous alert"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentIndex((prev) => (prev + 1) % orderedCandidates.length)}
                  className="p-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer"
                  title="Next alert"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Dismiss Button */}
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-all cursor-pointer"
          title="Dismiss notification"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
