import React from 'react';
import { Advertisement } from '../../types/ad';
import { X, Bell, Sparkles, ExternalLink, ArrowRight, CheckCircle2, MessageSquare, Megaphone, Zap } from 'lucide-react';

interface AdNotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  ads: Advertisement[];
  onAdClick: (ad: Advertisement) => void;
  onNavigateTab?: (tab: 'jobs' | 'cv' | 'alerts' | 'dashboard') => void;
}

export const AdNotificationDrawer: React.FC<AdNotificationDrawerProps> = ({
  isOpen,
  onClose,
  ads,
  onAdClick,
  onNavigateTab
}) => {
  if (!isOpen) return null;

  const activeAds = ads.filter((a) => a.status === 'active');

  const handleAction = (ad: Advertisement) => {
    onAdClick(ad);
    onClose();

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

  return (
    <div className="fixed inset-0 z-50 overflow-hidden animate-fadeIn">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm transition-opacity"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col justify-between text-white animate-slideInRight">
          
          {/* Header */}
          <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-white">Live Announcements & Alerts</h3>
                <p className="text-xs text-slate-400">Sponsored campaigns, urgent job alerts, & digests</p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* List of Ads / Notifications */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {activeAds.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-sm">
                <Bell className="w-10 h-10 mx-auto mb-2 opacity-30" />
                No active announcements right now. Check back soon!
              </div>
            ) : (
              activeAds.map((ad) => (
                <div
                  key={ad.id}
                  onClick={() => handleAction(ad)}
                  className="group relative bg-slate-950/90 border border-slate-800 hover:border-emerald-500/50 rounded-2xl p-4 shadow-lg hover:shadow-emerald-500/10 transition-all duration-200 cursor-pointer space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center space-x-1">
                      <Sparkles className="w-2.5 h-2.5" />
                      <span>{ad.badgeText || 'Announcement'}</span>
                    </span>
                    <span className="text-[10px] text-slate-500 capitalize">{ad.type} format</span>
                  </div>

                  {ad.imageUrl && (
                    <div className="w-full h-28 rounded-xl overflow-hidden border border-white/10">
                      <img
                        src={ad.imageUrl}
                        alt={ad.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  )}

                  <h4 className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors leading-snug">
                    {ad.headline}
                  </h4>

                  <p className="text-xs text-slate-300 line-clamp-3 leading-relaxed">
                    {ad.bodyText}
                  </p>

                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                    <span className="text-[11px] text-slate-400 font-medium">
                      {ad.targetPages.includes('all') ? 'All Pages' : ad.targetPages.join(', ')}
                    </span>
                    
                    <span className="font-extrabold text-emerald-400 flex items-center space-x-1 group-hover:underline">
                      <span>{ad.ctaText || 'View Details'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-slate-800 bg-slate-950/90 text-center text-xs text-slate-400">
            <span>Powered by HybridJobs.pk Automated Campaign Engine</span>
          </div>

        </div>
      </div>
    </div>
  );
};
