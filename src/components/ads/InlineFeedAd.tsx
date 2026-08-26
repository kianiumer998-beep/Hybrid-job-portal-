import React from 'react';
import { Advertisement } from '../../types/ad';
import { Sparkles, ExternalLink, ArrowRight, CheckCircle2, ShieldCheck, Megaphone } from 'lucide-react';

interface InlineFeedAdProps {
  ad: Advertisement;
  onAdClick: (ad: Advertisement) => void;
  onNavigateTab?: (tab: 'jobs' | 'cv' | 'alerts' | 'dashboard') => void;
}

export const InlineFeedAd: React.FC<InlineFeedAdProps> = ({
  ad,
  onAdClick,
  onNavigateTab
}) => {
  const handleAction = () => {
    onAdClick(ad);

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

  const themeGradients: Record<string, string> = {
    emerald: 'from-emerald-950/90 via-slate-900 to-emerald-950/60 border-emerald-500/40 hover:border-emerald-400',
    indigo: 'from-indigo-950/90 via-slate-900 to-indigo-950/60 border-indigo-500/40 hover:border-indigo-400',
    amber: 'from-amber-950/90 via-slate-900 to-amber-950/60 border-amber-500/40 hover:border-amber-400',
    rose: 'from-rose-950/90 via-slate-900 to-rose-950/60 border-rose-500/40 hover:border-rose-400',
    'gradient-purple': 'from-purple-950/90 via-slate-900 to-pink-950/60 border-purple-500/40 hover:border-purple-400',
    'gradient-ocean': 'from-teal-950/90 via-slate-900 to-blue-950/60 border-teal-500/40 hover:border-teal-400',
    slate: 'from-slate-900 via-slate-850 to-slate-900 border-slate-700 hover:border-slate-500'
  };

  const buttonThemes: Record<string, string> = {
    emerald: 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/30',
    indigo: 'bg-indigo-500 hover:bg-indigo-400 text-slate-950 shadow-indigo-500/30',
    amber: 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/30',
    rose: 'bg-rose-500 hover:bg-rose-400 text-white shadow-rose-500/30',
    'gradient-purple': 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 text-white shadow-purple-500/30',
    'gradient-ocean': 'bg-gradient-to-r from-teal-500 to-blue-500 hover:from-teal-400 hover:to-blue-400 text-slate-950 shadow-teal-500/30',
    slate: 'bg-white hover:bg-slate-200 text-slate-950 shadow-white/20'
  };

  const gradient = themeGradients[ad.theme] || themeGradients.emerald;
  const btnStyle = buttonThemes[ad.theme] || buttonThemes.emerald;

  return (
    <div
      onClick={handleAction}
      className={`group relative col-span-1 md:col-span-2 lg:col-span-3 bg-gradient-to-r ${gradient} border rounded-3xl p-6 sm:p-7 shadow-2xl transition-all duration-300 cursor-pointer overflow-hidden my-2`}
    >
      {/* Background Glow */}
      <div className="absolute -right-20 -top-20 w-60 h-60 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-6">
        
        {/* Banner Image / Graphic (if present) */}
        {ad.imageUrl && (
          <div className="w-full lg:w-72 h-44 sm:h-48 rounded-2xl overflow-hidden flex-shrink-0 border border-white/10 shadow-xl group-hover:shadow-2xl transition-all">
            <img
              src={ad.imageUrl}
              alt={ad.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              referrerPolicy="no-referrer"
            />
          </div>
        )}

        {/* Text & Content Block */}
        <div className="flex-1 space-y-3 text-left w-full">
          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
            <span className="text-[10px] uppercase tracking-wider font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center space-x-1">
              <Sparkles className="w-3 h-3 text-emerald-400" />
              <span>{ad.badgeText || 'Sponsored Opportunity'}</span>
            </span>
            <span className="text-xs text-slate-400 font-medium">Verified Partner Campaign</span>
          </div>

          <h3 className="text-xl sm:text-2xl font-black text-white group-hover:text-emerald-300 transition-colors leading-tight">
            {ad.headline}
          </h3>

          <p className="text-sm text-slate-300 leading-relaxed max-w-3xl">
            {ad.bodyText}
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-4 text-xs text-slate-400">
            <div className="flex items-center space-x-1 text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>High Acceptance Rate</span>
            </div>
            <div className="flex items-center space-x-1 text-slate-300">
              <ShieldCheck className="w-4 h-4 text-teal-400" />
              <span>Direct Fast-Track Contact</span>
            </div>
          </div>
        </div>

        {/* Call to Action Button */}
        <div className="flex-shrink-0 w-full lg:w-auto flex justify-end">
          <button
            onClick={handleAction}
            className={`w-full sm:w-auto px-7 py-3.5 rounded-2xl font-black text-sm shadow-xl transition-all flex items-center justify-center space-x-2 active:scale-95 cursor-pointer ${btnStyle}`}
          >
            <span>{ad.ctaText || 'Learn More'}</span>
            {ad.ctaUrl?.startsWith('http') ? (
              <ExternalLink className="w-4 h-4" />
            ) : (
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
