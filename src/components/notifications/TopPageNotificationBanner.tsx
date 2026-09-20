import React, { useState } from 'react';
import { NotificationItem } from '../../types/notification';
import { 
  X, 
  Sparkles, 
  AlertTriangle, 
  Info, 
  CheckCircle2, 
  ExternalLink, 
  ArrowRight,
  Bell,
  Megaphone
} from 'lucide-react';

interface TopPageNotificationBannerProps {
  notifications: NotificationItem[];
  onDismiss: (id: string) => void;
  onNavigateTab?: (tab: 'jobs' | 'cv' | 'alerts' | 'dashboard') => void;
}

export const TopPageNotificationBanner: React.FC<TopPageNotificationBannerProps> = ({
  notifications,
  onDismiss,
  onNavigateTab
}) => {
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);

  // Filter active, enabled notifications where channels.pageBanner is true and not dismissed
  const activeBanners = notifications.filter(n => {
    if (n.enabled === false || n.status === 'archived' || n.status === 'draft') return false;
    if (!n.channels?.pageBanner) return false;
    if (n.userState?.dismissed || dismissedIds.includes(n.id)) return false;
    return true;
  });

  if (activeBanners.length === 0) return null;

  // Take highest priority banner or first active
  const banner = activeBanners[0];

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDismissedIds(prev => [...prev, banner.id]);
    onDismiss(banner.id);
  };

  const handleCtaClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (banner.ctaUrl) {
      if (banner.ctaUrl.startsWith('#') && onNavigateTab) {
        const tab = banner.ctaUrl.replace('#', '') as 'jobs' | 'cv' | 'alerts' | 'dashboard';
        if (['jobs', 'cv', 'alerts', 'dashboard'].includes(tab)) {
          onNavigateTab(tab);
          return;
        }
      }
      if (banner.ctaUrl.startsWith('http')) {
        window.open(banner.ctaUrl, banner.target || '_blank', 'noopener,noreferrer');
      }
    }
  };

  // Priority styling
  const priorityStyles: Record<string, { bg: string; border: string; text: string; badge: string; button: string }> = {
    urgent: {
      bg: 'bg-gradient-to-r from-rose-950 via-slate-900 to-rose-950',
      border: 'border-rose-500/50',
      text: 'text-rose-200',
      badge: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
      button: 'bg-rose-500 hover:bg-rose-400 text-white shadow-rose-500/20'
    },
    high: {
      bg: 'bg-gradient-to-r from-amber-950 via-slate-900 to-amber-950',
      border: 'border-amber-500/50',
      text: 'text-amber-200',
      badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
      button: 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
    },
    normal: {
      bg: 'bg-gradient-to-r from-emerald-950 via-slate-900 to-teal-950',
      border: 'border-emerald-500/40',
      text: 'text-emerald-200',
      badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
      button: 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20'
    },
    low: {
      bg: 'bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-950',
      border: 'border-indigo-500/40',
      text: 'text-indigo-200',
      badge: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
      button: 'bg-indigo-500 hover:bg-indigo-400 text-slate-950 shadow-indigo-500/20'
    }
  };

  const style = priorityStyles[banner.priority] || priorityStyles.normal;

  return (
    <div 
      id={`top-page-notification-banner-${banner.id}`}
      className={`relative w-full ${style.bg} border-b ${style.border} px-4 py-2.5 sm:py-3 transition-all duration-300 z-40 shadow-md`}
    >
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-white">
        
        {/* Left Side: Thumbnail / Icon + Title + Plaintext/Body */}
        <div className="flex items-center space-x-3 w-full sm:w-auto overflow-hidden">
          {banner.imageUrl ? (
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl overflow-hidden flex-shrink-0 border border-white/20 shadow-md">
              <img
                src={banner.imageUrl}
                alt={banner.title}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
          ) : (
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md ${
              banner.priority === 'urgent' 
                ? 'bg-rose-500/30 text-rose-300 border border-rose-400/40' 
                : banner.priority === 'high' 
                ? 'bg-amber-500/30 text-amber-300 border border-amber-400/40' 
                : 'bg-emerald-500/30 text-emerald-300 border border-emerald-400/40'
            }`}>
              {banner.priority === 'urgent' ? (
                <AlertTriangle className="w-5 h-5 animate-bounce" />
              ) : banner.priority === 'high' ? (
                <Megaphone className="w-4 h-4 animate-pulse" />
              ) : (
                <Bell className="w-4 h-4" />
              )}
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2 flex-wrap">
              <span className={`text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full border ${style.badge}`}>
                {banner.priority === 'urgent' ? '🚨 URGENT NOTICE' : banner.priority === 'high' ? '⚡ ANNOUNCEMENT' : '📣 NOTIFICATION'}
              </span>
              <h4 className="text-xs sm:text-sm font-bold text-white truncate">
                {banner.title}
              </h4>
            </div>

            {(banner.plainText || banner.body) && (
              <p className="text-[11px] text-slate-300 hidden md:block truncate mt-0.5 max-w-2xl">
                {banner.plainText || banner.body.replace(/<[^>]*>/g, '')}
              </p>
            )}
          </div>
        </div>

        {/* Right Side: CTA Button + Dismiss Button */}
        <div className="flex items-center space-x-2.5 flex-shrink-0 self-end sm:self-auto">
          {banner.ctaText && (
            <button
              onClick={handleCtaClick}
              className={`px-3.5 py-1.5 rounded-xl font-black text-xs shadow-md transition-all flex items-center space-x-1.5 active:scale-95 cursor-pointer ${style.button}`}
            >
              <span>{banner.ctaText}</span>
              {banner.ctaUrl?.startsWith('http') ? (
                <ExternalLink className="w-3 h-3" />
              ) : (
                <ArrowRight className="w-3 h-3" />
              )}
            </button>
          )}

          {banner.dismissible !== false && (
            <button
              onClick={handleDismiss}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
              title="Dismiss page banner"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
