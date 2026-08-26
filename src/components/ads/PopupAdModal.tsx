import React, { useState, useEffect } from 'react';
import { Advertisement, AdTargetPage } from '../../types/ad';
import { X, Sparkles, ExternalLink, ArrowRight, ShieldCheck, CheckCircle2 } from 'lucide-react';

interface PopupAdModalProps {
  ads: Advertisement[];
  currentPage: AdTargetPage;
  onAdClick: (ad: Advertisement) => void;
  onNavigateTab?: (tab: 'jobs' | 'cv' | 'alerts' | 'dashboard') => void;
}

export const PopupAdModal: React.FC<PopupAdModalProps> = ({
  ads,
  currentPage,
  onAdClick,
  onNavigateTab
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [activePopup, setActivePopup] = useState<Advertisement | null>(null);
  const [dismissedSessionIds, setDismissedSessionIds] = useState<string[]>(() => {
    try {
      const saved = sessionStorage.getItem('hybrid_dismissed_popup_ads');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Evaluate candidate popup on page change
  useEffect(() => {
    const candidate = ads.find(
      (ad) =>
        ad.status === 'active' &&
        (ad.type === 'popup' || ad.placement === 'popup-modal') &&
        (ad.targetPages.includes('all') || ad.targetPages.includes(currentPage)) &&
        !dismissedSessionIds.includes(ad.id)
    );

    if (candidate) {
      // Delay opening popup slightly so user settles on page
      const timer = setTimeout(() => {
        setActivePopup(candidate);
        setIsOpen(true);
      }, 1200);

      return () => clearTimeout(timer);
    } else {
      setIsOpen(false);
      setActivePopup(null);
    }
  }, [ads, currentPage, dismissedSessionIds]);

  if (!isOpen || !activePopup) return null;

  const handleClose = () => {
    setIsOpen(false);
    if (activePopup) {
      const updated = [...dismissedSessionIds, activePopup.id];
      setDismissedSessionIds(updated);
      try {
        sessionStorage.setItem('hybrid_dismissed_popup_ads', JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleAction = () => {
    if (!activePopup) return;
    onAdClick(activePopup);
    handleClose();

    if (activePopup.ctaUrl) {
      if (activePopup.ctaUrl.startsWith('#') && onNavigateTab) {
        const tab = activePopup.ctaUrl.replace('#', '') as 'jobs' | 'cv' | 'alerts' | 'dashboard';
        if (['jobs', 'cv', 'alerts', 'dashboard'].includes(tab)) {
          onNavigateTab(tab);
          return;
        }
      }

      if (activePopup.ctaUrl.startsWith('http')) {
        window.open(activePopup.ctaUrl, '_blank', 'noopener,noreferrer');
      }
    }
  };

  const themeColors: Record<string, { badge: string; button: string; glow: string }> = {
    amber: {
      badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
      button: 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/30',
      glow: 'bg-amber-500/10'
    },
    emerald: {
      badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      button: 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/30',
      glow: 'bg-emerald-500/10'
    },
    indigo: {
      badge: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
      button: 'bg-indigo-500 hover:bg-indigo-400 text-slate-950 shadow-indigo-500/30',
      glow: 'bg-indigo-500/10'
    },
    rose: {
      badge: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
      button: 'bg-rose-500 hover:bg-rose-400 text-white shadow-rose-500/30',
      glow: 'bg-rose-500/10'
    },
    'gradient-purple': {
      badge: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
      button: 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 text-white shadow-purple-500/30',
      glow: 'bg-purple-500/10'
    },
    'gradient-ocean': {
      badge: 'bg-teal-500/20 text-teal-300 border-teal-500/30',
      button: 'bg-gradient-to-r from-teal-500 to-blue-500 hover:from-teal-400 text-slate-950 shadow-teal-500/30',
      glow: 'bg-teal-500/10'
    },
    slate: {
      badge: 'bg-slate-800 text-slate-300 border-slate-700',
      button: 'bg-white hover:bg-slate-200 text-slate-950 shadow-white/20',
      glow: 'bg-slate-700/10'
    }
  };

  const style = themeColors[activePopup.theme] || themeColors.amber;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-fadeIn">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl transition-all">
        
        {/* Ambient Top Glow */}
        <div className={`absolute -right-20 -top-20 w-60 h-60 ${style.glow} rounded-full blur-3xl pointer-events-none`} />

        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 z-20 w-9 h-9 rounded-full bg-slate-950/70 hover:bg-slate-950 text-slate-400 hover:text-white border border-white/10 flex items-center justify-center transition-all cursor-pointer backdrop-blur-sm"
          title="Close announcement"
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
            
            {activePopup.badgeText && (
              <div className="absolute top-4 left-4 z-10">
                <span className={`text-[10px] uppercase font-extrabold tracking-wider px-3 py-1 rounded-full border shadow-lg backdrop-blur-md ${style.badge}`}>
                  {activePopup.badgeText}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Content Body */}
        <div className="p-6 sm:p-7 space-y-4 text-left">
          {!activePopup.imageUrl && activePopup.badgeText && (
            <div className="flex items-center space-x-2">
              <span className={`text-[10px] uppercase font-extrabold tracking-wider px-3 py-1 rounded-full border ${style.badge}`}>
                {activePopup.badgeText}
              </span>
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

          {/* Action Buttons */}
          <div className="pt-3 flex flex-col-reverse sm:flex-row items-center justify-between gap-3">
            <button
              onClick={handleClose}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer text-center"
            >
              Maybe Later
            </button>

            <button
              onClick={handleAction}
              className={`w-full sm:w-auto px-7 py-3 rounded-xl font-black text-xs sm:text-sm shadow-xl transition-all flex items-center justify-center space-x-2 active:scale-95 cursor-pointer ${style.button}`}
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
