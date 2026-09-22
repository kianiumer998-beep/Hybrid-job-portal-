import React, { useState, useEffect } from 'react';
import { Advertisement, AdTargetPage, PopupDisplaySettings } from '../../types/ad';
import { X, Sparkles, ExternalLink, ArrowRight, ShieldCheck, CheckCircle2, Layers, ChevronRight } from 'lucide-react';

interface PopupAdModalProps {
  ads: Advertisement[];
  currentPage: AdTargetPage;
  popupSettings?: PopupDisplaySettings;
  onAdClick: (ad: Advertisement) => void;
  onNavigateTab?: (tab: 'jobs' | 'cv' | 'alerts' | 'dashboard') => void;
}

const DEFAULT_POPUP_SETTINGS: PopupDisplaySettings = {
  displayMode: 'sequential',
  maxPopupsPerVisit: 99,
  delayBetweenPopupsSec: 0.8,
  showStackedDualOnDesktop: true,
  allowUnlimitedQueue: true
};

export const PopupAdModal: React.FC<PopupAdModalProps> = ({
  ads,
  currentPage,
  popupSettings = DEFAULT_POPUP_SETTINGS,
  onAdClick,
  onNavigateTab
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [popupQueue, setPopupQueue] = useState<Advertisement[]>([]);
  const [currentQueueIndex, setCurrentQueueIndex] = useState<number>(0);
  const [dualClosedAdIds, setDualClosedAdIds] = useState<string[]>([]);

  const [dismissedSessionIds, setDismissedSessionIds] = useState<string[]>(() => {
    try {
      const saved = sessionStorage.getItem('hybrid_dismissed_popup_ads');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Evaluate matching popup advertisements on mount / page change / ads update
  useEffect(() => {
    const candidates = ads.filter(
      (ad) =>
        ad.status === 'active' &&
        (ad.type === 'popup' || ad.placement === 'popup-modal') &&
        (ad.targetPages.includes('all') || ad.targetPages.includes(currentPage)) &&
        !dismissedSessionIds.includes(ad.id)
    );

    if (candidates.length > 0) {
      // Determine how many popups are permitted in the queue
      const maxAllowed = popupSettings.allowUnlimitedQueue
        ? candidates.length
        : Math.min(candidates.length, popupSettings.maxPopupsPerVisit || 2);

      const queued = candidates.slice(0, maxAllowed);
      setPopupQueue(queued);
      setCurrentQueueIndex(0);
      setDualClosedAdIds([]);

      // Initial entry delay for comfortable reading
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 1000);

      return () => clearTimeout(timer);
    } else {
      setIsOpen(false);
      setPopupQueue([]);
      setCurrentQueueIndex(0);
    }
  }, [ads, currentPage, dismissedSessionIds, popupSettings]);

  if (!isOpen || popupQueue.length === 0) return null;

  const mode = popupSettings.displayMode || 'sequential';

  // Handler for closing an individual popup
  const handleCloseCurrent = (adId: string) => {
    // Record dismissed in session
    const updated = Array.from(new Set([...dismissedSessionIds, adId]));
    setDismissedSessionIds(updated);
    try {
      sessionStorage.setItem('hybrid_dismissed_popup_ads', JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }

    if (mode === 'stacked_dual') {
      const newClosed = [...dualClosedAdIds, adId];
      setDualClosedAdIds(newClosed);
      if (newClosed.length >= popupQueue.length) {
        setIsOpen(false);
      }
      return;
    }

    if (mode === 'sequential') {
      // Check if there is another popup next in queue
      const nextIdx = currentQueueIndex + 1;
      if (nextIdx < popupQueue.length) {
        // Smooth transition to the next queued popup after delay
        setIsOpen(false);
        const delayMs = Math.max(300, (popupSettings.delayBetweenPopupsSec || 0.8) * 1000);
        setTimeout(() => {
          setCurrentQueueIndex(nextIdx);
          setIsOpen(true);
        }, delayMs);
      } else {
        // Reached end of queue
        setIsOpen(false);
      }
      return;
    }

    // Default 'single' mode
    setIsOpen(false);
  };

  const handleAction = (ad: Advertisement) => {
    onAdClick(ad);
    handleCloseCurrent(ad.id);

    if (ad.ctaUrl) {
      if (ad.ctaUrl.startsWith('#') && onNavigateTab) {
        const tab = ad.ctaUrl.replace('#', '') as 'jobs' | 'cv' | 'alerts' | 'dashboard';
        if (['jobs', 'cv', 'alerts', 'dashboard'].includes(tab)) {
          onNavigateTab(tab);
          return;
        }
      }

      if (ad.ctaUrl.startsWith('http')) {
        window.open(ad.ctaUrl, '_blank', 'noopener,noreferrer');
      }
    }
  };

  const themeColors: Record<string, { badge: string; button: string; glow: string; border: string }> = {
    amber: {
      badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
      button: 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/30',
      glow: 'bg-amber-500/10',
      border: 'border-amber-500/30'
    },
    emerald: {
      badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      button: 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/30',
      glow: 'bg-emerald-500/10',
      border: 'border-emerald-500/30'
    },
    indigo: {
      badge: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
      button: 'bg-indigo-500 hover:bg-indigo-400 text-slate-950 shadow-indigo-500/30',
      glow: 'bg-indigo-500/10',
      border: 'border-indigo-500/30'
    },
    rose: {
      badge: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
      button: 'bg-rose-500 hover:bg-rose-400 text-white shadow-rose-500/30',
      glow: 'bg-rose-500/10',
      border: 'border-rose-500/30'
    },
    'gradient-purple': {
      badge: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
      button: 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 text-white shadow-purple-500/30',
      glow: 'bg-purple-500/10',
      border: 'border-purple-500/30'
    },
    'gradient-ocean': {
      badge: 'bg-teal-500/20 text-teal-300 border-teal-500/30',
      button: 'bg-gradient-to-r from-teal-500 to-blue-500 hover:from-teal-400 text-slate-950 shadow-teal-500/30',
      glow: 'bg-teal-500/10',
      border: 'border-teal-500/30'
    },
    slate: {
      badge: 'bg-slate-800 text-slate-300 border-slate-700',
      button: 'bg-white hover:bg-slate-200 text-slate-950 shadow-white/20',
      glow: 'bg-slate-700/10',
      border: 'border-slate-700'
    }
  };

  // -------------------------------------------------------------
  // RENDER DUAL STACKED POPUPS (Both Top & Bottom on same screen)
  // -------------------------------------------------------------
  if (mode === 'stacked_dual' && popupQueue.length >= 2) {
    const visibleAds = popupQueue.slice(0, 2).filter((a) => !dualClosedAdIds.includes(a.id));
    if (visibleAds.length === 0) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-md overflow-y-auto animate-fadeIn">
        <div className="relative w-full max-w-5xl my-auto space-y-4">
          
          {/* Top Info Bar */}
          <div className="flex items-center justify-between px-2 text-xs text-slate-400">
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-500/30 flex items-center space-x-1">
                <Layers className="w-3.5 h-3.5" />
                <span>Featured Dual Sponsor Broadcasts ({visibleAds.length} Active)</span>
              </span>
            </div>
            <button
              onClick={() => {
                popupQueue.forEach((a) => handleCloseCurrent(a.id));
                setIsOpen(false);
              }}
              className="text-xs text-slate-400 hover:text-white underline cursor-pointer"
            >
              Dismiss All Popups
            </button>
          </div>

          {/* Dual Grid / Stack */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {visibleAds.map((ad, idx) => {
              const style = themeColors[ad.theme] || themeColors.amber;

              return (
                <div
                  key={ad.id}
                  className={`relative bg-slate-900 border ${style.border} rounded-3xl overflow-hidden shadow-2xl transition-all flex flex-col justify-between`}
                >
                  {/* Ambient Glow */}
                  <div className={`absolute -right-16 -top-16 w-40 h-40 ${style.glow} rounded-full blur-2xl pointer-events-none`} />

                  {/* Close button for card */}
                  <button
                    onClick={() => handleCloseCurrent(ad.id)}
                    className="absolute top-3 right-3 z-20 w-8 h-8 rounded-full bg-slate-950/80 hover:bg-slate-950 text-slate-400 hover:text-white border border-white/10 flex items-center justify-center transition-all cursor-pointer backdrop-blur-sm"
                    title="Close this announcement"
                  >
                    <X className="w-4 h-4" />
                  </button>

                  {/* Image */}
                  {ad.imageUrl && (
                    <div className="relative w-full h-40 sm:h-44 overflow-hidden bg-slate-950">
                      <img
                        src={ad.imageUrl}
                        alt={ad.title}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-black/30" />
                      {ad.badgeText && (
                        <div className="absolute top-3 left-3 z-10">
                          <span className={`text-[9px] uppercase font-black tracking-wider px-2.5 py-0.5 rounded-full border shadow-lg backdrop-blur-md ${style.badge}`}>
                            {ad.badgeText}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Content */}
                  <div className="p-5 sm:p-6 space-y-3 text-left flex-1 flex flex-col justify-between">
                    <div className="space-y-2">
                      {!ad.imageUrl && ad.badgeText && (
                        <span className={`text-[9px] uppercase font-black tracking-wider px-2.5 py-0.5 rounded-full border ${style.badge}`}>
                          {ad.badgeText}
                        </span>
                      )}
                      <h4 className="text-lg font-black text-white leading-tight">
                        {ad.headline}
                      </h4>
                      <p className="text-xs text-slate-300 line-clamp-3 leading-relaxed">
                        {ad.bodyText}
                      </p>
                    </div>

                    <div className="pt-4 mt-2 border-t border-slate-800 flex items-center justify-between gap-2">
                      <button
                        onClick={() => handleCloseCurrent(ad.id)}
                        className="text-xs font-semibold text-slate-400 hover:text-white px-2 py-1 cursor-pointer"
                      >
                        Skip
                      </button>

                      <button
                        onClick={() => handleAction(ad)}
                        className={`px-5 py-2.5 rounded-xl font-bold text-xs shadow-lg flex items-center space-x-1.5 active:scale-95 transition-all cursor-pointer ${style.button}`}
                      >
                        <span>{ad.ctaText || 'Learn More'}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // RENDER SEQUENTIAL / SINGLE POPUP MODAL
  // -------------------------------------------------------------
  const activePopup = popupQueue[currentQueueIndex] || popupQueue[0];
  if (!activePopup) return null;

  const style = themeColors[activePopup.theme] || themeColors.amber;
  const isMultiQueue = popupQueue.length > 1;
  const currentStep = currentQueueIndex + 1;
  const totalSteps = popupQueue.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-fadeIn">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl transition-all">
        
        {/* Ambient Top Glow */}
        <div className={`absolute -right-20 -top-20 w-60 h-60 ${style.glow} rounded-full blur-3xl pointer-events-none`} />

        {/* Close Button (Trigger next in queue if sequential) */}
        <button
          onClick={() => handleCloseCurrent(activePopup.id)}
          className="absolute top-4 right-4 z-20 w-9 h-9 rounded-full bg-slate-950/70 hover:bg-slate-950 text-slate-400 hover:text-white border border-white/10 flex items-center justify-center transition-all cursor-pointer backdrop-blur-sm"
          title={isMultiQueue && currentStep < totalSteps ? "Close & view next announcement" : "Close announcement"}
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Banner Image */}
        {activePopup.imageUrl && (
          <div className="relative w-full h-52 sm:h-60 overflow-hidden bg-slate-950">
            <img
              src={activePopup.imageUrl}
              alt={activePopup.title}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-black/30" />
            
            <div className="absolute top-4 left-4 z-10 flex items-center space-x-2">
              {activePopup.badgeText && (
                <span className={`text-[10px] uppercase font-extrabold tracking-wider px-3 py-1 rounded-full border shadow-lg backdrop-blur-md ${style.badge}`}>
                  {activePopup.badgeText}
                </span>
              )}

              {/* Multi-Queue Badge */}
              {isMultiQueue && (
                <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-slate-950/80 text-slate-300 border border-white/10 backdrop-blur-md flex items-center space-x-1">
                  <span>Ad {currentStep} of {totalSteps}</span>
                  {currentStep < totalSteps && <ChevronRight className="w-3 h-3 text-amber-400" />}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Content Body */}
        <div className="p-6 sm:p-7 space-y-4 text-left">
          {!activePopup.imageUrl && (
            <div className="flex items-center space-x-2">
              {activePopup.badgeText && (
                <span className={`text-[10px] uppercase font-extrabold tracking-wider px-3 py-1 rounded-full border ${style.badge}`}>
                  {activePopup.badgeText}
                </span>
              )}
              {isMultiQueue && (
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  Announcement {currentStep} of {totalSteps}
                </span>
              )}
            </div>
          )}

          <h3 className="text-xl sm:text-2xl font-black text-white leading-tight">
            {activePopup.headline}
          </h3>

          <p className="text-sm text-slate-300 leading-relaxed">
            {activePopup.bodyText}
          </p>

          <div className="py-2 border-y border-slate-800/80 flex flex-wrap items-center gap-4 text-xs text-slate-400">
            <div className="flex items-center space-x-1.5 text-slate-300 font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Verified Official Partner</span>
            </div>
            <div className="flex items-center space-x-1.5 text-slate-300 font-medium">
              <ShieldCheck className="w-4 h-4 text-teal-400" />
              <span>Direct Link Access</span>
            </div>
          </div>

          {/* Sequential Queue Advance Prompt */}
          {isMultiQueue && currentStep < totalSteps && (
            <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
              <span>Next sponsored announcement will load automatically upon close.</span>
              <span className="font-bold text-amber-400">{totalSteps - currentStep} more in queue</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-3 flex flex-col-reverse sm:flex-row items-center justify-between gap-3">
            <button
              onClick={() => handleCloseCurrent(activePopup.id)}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer text-center"
            >
              {isMultiQueue && currentStep < totalSteps ? 'Close (Show Next)' : 'Maybe Later'}
            </button>

            <button
              onClick={() => handleAction(activePopup)}
              className={`w-full sm:w-auto px-7 py-3 rounded-xl font-black text-xs shadow-xl flex items-center justify-center space-x-2 transition-all cursor-pointer active:scale-95 ${style.button}`}
            >
              <span>{activePopup.ctaText || 'Learn More'}</span>
              {activePopup.ctaUrl?.startsWith('http') ? (
                <ExternalLink className="w-4 h-4" />
              ) : (
                <ArrowRight className="w-4 h-4" />
              )}
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};
