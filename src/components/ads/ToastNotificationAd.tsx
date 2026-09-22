import React, { useState, useEffect } from 'react';
import { Advertisement, AdTargetPage } from '../../types/ad';
import { X, Sparkles, ExternalLink, ArrowRight, Bell, Zap } from 'lucide-react';

interface ToastNotificationAdProps {
  ads: Advertisement[];
  currentPage: AdTargetPage;
  onAdClick: (ad: Advertisement) => void;
  onNavigateTab?: (tab: 'jobs' | 'cv' | 'alerts' | 'dashboard') => void;
}

export const ToastNotificationAd: React.FC<ToastNotificationAdProps> = ({
  ads,
  currentPage,
  onAdClick,
  onNavigateTab
}) => {
  const [dismissedToastIds, setDismissedToastIds] = useState<string[]>([]);
  const [visibleAd, setVisibleAd] = useState<Advertisement | null>(null);

  useEffect(() => {
    const candidate = ads.find(
      (ad) =>
        ad.status === 'active' &&
        (ad.type === 'notification' || ad.placement === 'toast-float') &&
        (ad.targetPages.includes('all') || ad.targetPages.includes(currentPage)) &&
        !dismissedToastIds.includes(ad.id)
    );

    if (candidate) {
      const timer = setTimeout(() => {
        setVisibleAd(candidate);
      }, 2000);

      return () => clearTimeout(timer);
    } else {
      setVisibleAd(null);
    }
  }, [ads, currentPage, dismissedToastIds]);

  if (!visibleAd) return null;

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDismissedToastIds((prev) => [...prev, visibleAd.id]);
    setVisibleAd(null);
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
            <span className="text-[10px] text-slate-500">Just now</span>
          </div>

          <h4 className="text-xs font-bold text-white group-hover:text-emerald-300 transition-colors line-clamp-2">
            {visibleAd.headline}
          </h4>

          {visibleAd.bodyText && (
            <p className="text-[11px] text-slate-300 mt-1 line-clamp-2 leading-tight">
              {visibleAd.bodyText}
            </p>
          )}

          {visibleAd.ctaText && (
            <div className="mt-2.5 flex items-center space-x-1 text-xs font-bold text-emerald-400 group-hover:underline">
              <span>{visibleAd.ctaText}</span>
              <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
            </div>
          )}
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
