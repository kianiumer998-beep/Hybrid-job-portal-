import React from 'react';
import { Search, MapPin, Sparkles, ShieldCheck, MessageSquare, ArrowRight, Building2, PlusCircle } from 'lucide-react';
import { LandingHeroConfig, LandingDesignId, DEFAULT_LANDING_PAGE_CONFIG } from '../types/landing';


interface HeroDesignStyle {
  sectionBg: string;
  glowGradient: string;
  hiringBannerContainer: string;
  hiringIconRing: string;
  hiringIconColor: string;
  hiringBadge: string;
  hiringBtn: string;
  hiringBtnIconColor: string;
  eyebrowBadge: string;
  eyebrowPingDot: string;
  eyebrowSolidDot: string;
  headingGradient: string;
  primaryBtn: string;
  primaryBtnIconColor: string;
}

const HERO_DESIGN_STYLES: Record<LandingDesignId, HeroDesignStyle> = {
  legacy: {
    sectionBg: 'relative overflow-hidden bg-slate-950 pt-2 pb-2.5 sm:pt-14 sm:pb-16 border-b border-slate-800/80',
    glowGradient: 'absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-tr from-emerald-500/10 via-indigo-500/10 to-transparent blur-3xl pointer-events-none rounded-full',
    hiringBannerContainer: 'bg-gradient-to-r from-emerald-950 via-slate-900 to-indigo-950 border border-emerald-500/30 rounded-xl sm:rounded-2xl p-2 sm:p-5 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-2 sm:gap-4',
    hiringIconRing: 'w-7 h-7 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 p-0.5 shrink-0 shadow-lg shadow-emerald-500/20',
    hiringIconColor: 'text-emerald-400',
    hiringBadge: 'text-emerald-400 font-extrabold text-[8px] sm:text-xs uppercase tracking-wider bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20',
    hiringBtn: 'w-full md:w-auto px-3 py-1.5 sm:px-6 sm:py-3 rounded-lg sm:rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-[10px] sm:text-xs uppercase tracking-wider shadow-md shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center space-x-1.5 sm:space-x-2 shrink-0 cursor-pointer',
    hiringBtnIconColor: 'text-slate-950',
    eyebrowBadge: 'inline-flex items-center space-x-1 sm:space-x-2 px-2 py-0.5 sm:px-3.5 sm:py-1.5 rounded-full bg-slate-900/90 border border-emerald-500/30 text-emerald-400 text-[9px] sm:text-xs font-semibold mb-1 sm:mb-6 shadow-md backdrop-blur-md',
    eyebrowPingDot: 'animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75',
    eyebrowSolidDot: 'relative inline-flex rounded-full h-1.5 w-1.5 sm:h-2 sm:w-2 bg-emerald-500',
    headingGradient: 'bg-gradient-to-r from-emerald-400 via-teal-300 to-indigo-400 bg-clip-text text-transparent',
    primaryBtn: 'flex-1 sm:flex-initial min-h-[34px] sm:min-h-[44px] px-2 sm:px-8 py-1.5 sm:py-4 rounded-lg sm:rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 text-slate-950 font-bold text-[10px] min-[360px]:text-xs sm:text-base shadow-md shadow-emerald-500/20 active:scale-95 transition-all duration-200 flex items-center justify-center space-x-1 sm:space-x-2 cursor-pointer',
    primaryBtnIconColor: 'text-slate-950'
  },
  'design-1': {
    sectionBg: 'relative overflow-hidden bg-slate-950 pt-2 pb-2.5 sm:pt-14 sm:pb-16 border-b border-emerald-900/50',
    glowGradient: 'absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-tr from-emerald-500/15 via-cyan-500/10 to-transparent blur-3xl pointer-events-none rounded-full',
    hiringBannerContainer: 'bg-gradient-to-r from-slate-900 via-emerald-950/70 to-slate-900 border border-emerald-400/30 rounded-xl sm:rounded-2xl p-2 sm:p-5 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-2 sm:gap-4',
    hiringIconRing: 'w-7 h-7 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-gradient-to-tr from-emerald-400 to-cyan-400 p-0.5 shrink-0 shadow-lg shadow-emerald-500/20',
    hiringIconColor: 'text-cyan-400',
    hiringBadge: 'text-cyan-300 font-extrabold text-[8px] sm:text-xs uppercase tracking-wider bg-cyan-500/10 px-1.5 py-0.5 rounded border border-cyan-400/25',
    hiringBtn: 'w-full md:w-auto px-3 py-1.5 sm:px-6 sm:py-3 rounded-lg sm:rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 text-slate-950 font-black text-[10px] sm:text-xs uppercase tracking-wider shadow-md shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center space-x-1.5 sm:space-x-2 shrink-0 cursor-pointer',
    hiringBtnIconColor: 'text-slate-950',
    eyebrowBadge: 'inline-flex items-center space-x-1 sm:space-x-2 px-2 py-0.5 sm:px-3.5 sm:py-1.5 rounded-full bg-slate-900/90 border border-cyan-400/30 text-cyan-300 text-[9px] sm:text-xs font-semibold mb-1 sm:mb-6 shadow-md backdrop-blur-md',
    eyebrowPingDot: 'animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75',
    eyebrowSolidDot: 'relative inline-flex rounded-full h-1.5 w-1.5 sm:h-2 sm:w-2 bg-cyan-400',
    headingGradient: 'bg-gradient-to-r from-emerald-300 via-teal-300 to-cyan-400 bg-clip-text text-transparent',
    primaryBtn: 'flex-1 sm:flex-initial min-h-[34px] sm:min-h-[44px] px-2 sm:px-8 py-1.5 sm:py-4 rounded-lg sm:rounded-xl bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 hover:from-emerald-300 hover:via-teal-300 hover:to-cyan-300 text-slate-950 font-bold text-[10px] min-[360px]:text-xs sm:text-base shadow-md shadow-cyan-500/20 active:scale-95 transition-all duration-200 flex items-center justify-center space-x-1 sm:space-x-2 cursor-pointer',
    primaryBtnIconColor: 'text-slate-950'
  },
  'design-2': {
    sectionBg: 'relative overflow-hidden bg-slate-950 pt-2 pb-2.5 sm:pt-14 sm:pb-16 border-b border-amber-500/30',
    glowGradient: 'absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-tr from-amber-500/15 via-orange-500/10 to-rose-500/10 blur-3xl pointer-events-none rounded-full',
    hiringBannerContainer: 'bg-gradient-to-r from-amber-950/80 via-slate-900 to-rose-950/80 border border-amber-500/40 rounded-xl sm:rounded-2xl p-2 sm:p-5 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-2 sm:gap-4',
    hiringIconRing: 'w-7 h-7 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-gradient-to-tr from-amber-400 to-orange-400 p-0.5 shrink-0 shadow-lg shadow-amber-500/20',
    hiringIconColor: 'text-amber-400',
    hiringBadge: 'text-amber-300 font-extrabold text-[8px] sm:text-xs uppercase tracking-wider bg-amber-500/15 px-1.5 py-0.5 rounded border border-amber-400/30',
    hiringBtn: 'w-full md:w-auto px-3 py-1.5 sm:px-6 sm:py-3 rounded-lg sm:rounded-xl bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-300 hover:to-orange-300 text-slate-950 font-black text-[10px] sm:text-xs uppercase tracking-wider shadow-md shadow-amber-500/25 active:scale-95 transition-all flex items-center justify-center space-x-1.5 sm:space-x-2 shrink-0 cursor-pointer',
    hiringBtnIconColor: 'text-slate-950',
    eyebrowBadge: 'inline-flex items-center space-x-1 sm:space-x-2 px-2 py-0.5 sm:px-3.5 sm:py-1.5 rounded-full bg-slate-900/90 border border-amber-400/35 text-amber-300 text-[9px] sm:text-xs font-semibold mb-1 sm:mb-6 shadow-md backdrop-blur-md',
    eyebrowPingDot: 'animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75',
    eyebrowSolidDot: 'relative inline-flex rounded-full h-1.5 w-1.5 sm:h-2 sm:w-2 bg-amber-400',
    headingGradient: 'bg-gradient-to-r from-amber-300 via-orange-300 to-rose-400 bg-clip-text text-transparent',
    primaryBtn: 'flex-1 sm:flex-initial min-h-[34px] sm:min-h-[44px] px-2 sm:px-8 py-1.5 sm:py-4 rounded-lg sm:rounded-xl bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400 hover:from-amber-300 hover:via-orange-300 hover:to-rose-300 text-slate-950 font-bold text-[10px] min-[360px]:text-xs sm:text-base shadow-md shadow-amber-500/25 active:scale-95 transition-all duration-200 flex items-center justify-center space-x-1 sm:space-x-2 cursor-pointer',
    primaryBtnIconColor: 'text-slate-950'
  },
  'design-3': {
    sectionBg: 'relative overflow-hidden bg-slate-950 pt-2 pb-2.5 sm:pt-14 sm:pb-16 border-b border-indigo-500/30',
    glowGradient: 'absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-tr from-indigo-500/20 via-sky-500/15 to-emerald-500/10 blur-3xl pointer-events-none rounded-full',
    hiringBannerContainer: 'bg-gradient-to-r from-indigo-950 via-slate-900 to-sky-950 border border-indigo-400/35 rounded-xl sm:rounded-2xl p-2 sm:p-5 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-2 sm:gap-4',
    hiringIconRing: 'w-7 h-7 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-gradient-to-tr from-indigo-400 to-sky-400 p-0.5 shrink-0 shadow-lg shadow-indigo-500/25',
    hiringIconColor: 'text-sky-400',
    hiringBadge: 'text-sky-300 font-extrabold text-[8px] sm:text-xs uppercase tracking-wider bg-indigo-500/15 px-1.5 py-0.5 rounded border border-indigo-400/30',
    hiringBtn: 'w-full md:w-auto px-3 py-1.5 sm:px-6 sm:py-3 rounded-lg sm:rounded-xl bg-gradient-to-r from-indigo-400 to-emerald-400 hover:from-indigo-300 hover:to-emerald-300 text-slate-950 font-black text-[10px] sm:text-xs uppercase tracking-wider shadow-md shadow-indigo-500/25 active:scale-95 transition-all flex items-center justify-center space-x-1.5 sm:space-x-2 shrink-0 cursor-pointer',
    hiringBtnIconColor: 'text-slate-950',
    eyebrowBadge: 'inline-flex items-center space-x-1 sm:space-x-2 px-2 py-0.5 sm:px-3.5 sm:py-1.5 rounded-full bg-slate-900/90 border border-indigo-400/35 text-sky-300 text-[9px] sm:text-xs font-semibold mb-1 sm:mb-6 shadow-md backdrop-blur-md',
    eyebrowPingDot: 'animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75',
    eyebrowSolidDot: 'relative inline-flex rounded-full h-1.5 w-1.5 sm:h-2 sm:w-2 bg-sky-400',
    headingGradient: 'bg-gradient-to-r from-indigo-300 via-sky-300 to-emerald-300 bg-clip-text text-transparent',
    primaryBtn: 'flex-1 sm:flex-initial min-h-[34px] sm:min-h-[44px] px-2 sm:px-8 py-1.5 sm:py-4 rounded-lg sm:rounded-xl bg-gradient-to-r from-indigo-400 via-sky-400 to-emerald-400 hover:from-indigo-300 hover:via-sky-300 hover:to-emerald-300 text-slate-950 font-bold text-[10px] min-[360px]:text-xs sm:text-base shadow-md shadow-indigo-500/25 active:scale-95 transition-all duration-200 flex items-center justify-center space-x-1 sm:space-x-2 cursor-pointer',
    primaryBtnIconColor: 'text-slate-950'
  }
};

interface HeroSectionProps {
  onSearchFocus?: () => void;
  onExploreClick: () => void;
  onCvClick: () => void;
  onPostJobClick: () => void;
  totalJobsCount: number;
  heroConfig?: LandingHeroConfig;
  designId?: LandingDesignId;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  onExploreClick,
  onCvClick,
  onPostJobClick,
  totalJobsCount,
  heroConfig = DEFAULT_LANDING_PAGE_CONFIG.hero,
  designId = 'legacy'
}) => {
  const theme = HERO_DESIGN_STYLES[designId] ?? HERO_DESIGN_STYLES.legacy;

  return (
    <section className={theme.sectionBg}>
      {/* Subtle Background Glow Elements */}
      <div className={theme.glowGradient} />
      
      <div className="max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8 relative z-10 space-y-2 sm:space-y-8">
        
        {/* PROMINENT HIRING / EMPLOYER CTA BANNER */}
        <div className={theme.hiringBannerContainer}>
          <div className="flex items-center space-x-2 sm:space-x-3.5 w-full md:w-auto">
            <div className={theme.hiringIconRing}>
              <div className="w-full h-full bg-slate-950 rounded-[6px] sm:rounded-[10px] flex items-center justify-center">
                <Building2 className={`w-3.5 h-3.5 sm:w-6 sm:h-6 ${theme.hiringIconColor}`} />
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center space-x-1.5 sm:space-x-2 flex-wrap">
                <span className={theme.hiringBadge}>
                  {heroConfig.hiringBannerBadge || 'Hiring Employers & Recruiters'}
                </span>
                <span className="text-amber-400 text-[9px] sm:text-xs font-bold animate-pulse">● Instant Approval</span>
              </div>
              <h2 className="text-[11px] sm:text-lg font-black text-white mt-0.5 truncate sm:whitespace-normal">
                {heroConfig.hiringBannerTitle || 'Want to Hire? Register now to post a job instantly!'}
              </h2>
              <p className="text-[10px] sm:text-xs text-slate-300 hidden sm:block">
                {heroConfig.hiringBannerSub || 'Post your job today and find top verified remote & hybrid talent in Pakistan and worldwide.'}
              </p>
            </div>
          </div>

          <button
            onClick={onPostJobClick}
            className={theme.hiringBtn}
          >
            <PlusCircle className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${theme.hiringBtnIconColor}`} />
            <span>{heroConfig.hiringBannerBtnText || 'Post a Job Now'}</span>
          </button>
        </div>

        <div className="text-center max-w-4xl mx-auto">
          
          {/* Eyebrow Badge */}
          <div className={theme.eyebrowBadge}>
            <span className="flex h-1.5 w-1.5 sm:h-2 sm:w-2 relative">
              <span className={theme.eyebrowPingDot}></span>
              <span className={theme.eyebrowSolidDot}></span>
            </span>
            <span className="truncate max-w-[240px] min-[360px]:max-w-[290px] sm:max-w-none">{heroConfig.eyebrowBadgeText || '#1 Unified Remote Portal & Automated CV Engine for Pakistan & Global'}</span>
          </div>

          {/* Main Heading */}
          <h1 className="text-lg sm:text-4xl md:text-5xl lg:text-6xl font-black text-white tracking-tight leading-tight">
            {heroConfig.mainHeadingPrefix || 'Find Your Next'}{' '}
            <span className={theme.headingGradient}>
              {heroConfig.gradientWord || 'Hybrid or Remote'}
            </span>{' '}
            {heroConfig.mainHeadingSuffix || 'Role'}
          </h1>

          {/* Subheading */}
          <p className="mt-1 sm:mt-4 text-[11px] sm:text-xl text-slate-300 leading-relaxed font-normal max-w-2xl mx-auto line-clamp-1 sm:line-clamp-none">
            {heroConfig.subHeading || 'Browse verified opportunities globally or target localized jobs across Pakistan down to Province, City, and District levels. Build ATS-optimized resumes in minutes.'}
          </p>

          {/* Quick Action Buttons */}
          <div className="mt-2 sm:mt-8 flex flex-row items-center justify-center gap-1.5 sm:gap-4">
            <button
              onClick={onExploreClick}
              className={theme.primaryBtn}
            >
              <Search className={`w-3 h-3 sm:w-5 sm:h-5 ${theme.primaryBtnIconColor} shrink-0`} />
              <span className="truncate">{heroConfig.primaryBtnText || `Browse ${totalJobsCount} Jobs`}</span>
              <ArrowRight className={`w-3 h-3 sm:w-4 sm:h-4 ${theme.primaryBtnIconColor} shrink-0`} />
            </button>

            <button
              onClick={onCvClick}
              className="flex-1 sm:flex-initial min-h-[34px] sm:min-h-[44px] px-2 sm:px-8 py-1.5 sm:py-4 rounded-lg sm:rounded-xl bg-slate-900 hover:bg-slate-800 text-white border border-slate-700/80 font-semibold text-[10px] min-[360px]:text-xs sm:text-base shadow-md hover:border-indigo-500/50 active:scale-95 transition-all duration-200 flex items-center justify-center space-x-1 sm:space-x-2 cursor-pointer"
            >
              <Sparkles className="w-3 h-3 sm:w-5 sm:h-5 text-indigo-400 shrink-0" />
              <span className="truncate">{heroConfig.secondaryBtnText || 'Build ATS CV'}</span>
            </button>
          </div>

          {/* Key Feature Anchors */}
          <div className="mt-2 sm:mt-10 grid grid-cols-2 sm:grid-cols-4 gap-1 sm:gap-3 text-left">
            <div className="p-1 sm:p-3.5 rounded-lg sm:rounded-xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
              <div className="flex items-center space-x-1 sm:space-x-2 text-emerald-400 font-bold text-[10px] sm:text-sm">
                <MapPin className="w-2.5 h-2.5 sm:w-4 sm:h-4 shrink-0" />
                <span className="truncate">{heroConfig.statBadge1Text || 'Localized PK'}</span>
              </div>
              <p className="text-[9px] sm:text-xs text-slate-400 mt-0.5 sm:mt-1 line-clamp-1 sm:line-clamp-none hidden sm:block">Province, City & District filter</p>
            </div>

            <div className="p-1 sm:p-3.5 rounded-lg sm:rounded-xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
              <div className="flex items-center space-x-1 sm:space-x-2 text-teal-400 font-bold text-[10px] sm:text-sm">
                <MessageSquare className="w-2.5 h-2.5 sm:w-4 sm:h-4 shrink-0" />
                <span className="truncate">{heroConfig.statBadge4Text || 'WhatsApp Job Alerts'}</span>
              </div>
              <p className="text-[9px] sm:text-xs text-slate-400 mt-0.5 sm:mt-1 line-clamp-1 sm:line-clamp-none hidden sm:block">Instant WhatsApp alerts when matching jobs post</p>
            </div>

            <div className="p-1 sm:p-3.5 rounded-lg sm:rounded-xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
              <div className="flex items-center space-x-1 sm:space-x-2 text-indigo-400 font-bold text-[10px] sm:text-sm">
                <Sparkles className="w-2.5 h-2.5 sm:w-4 sm:h-4 shrink-0" />
                <span className="truncate">{heroConfig.statBadge2Text || 'Automated CV Engine'}</span>
              </div>
              <p className="text-[9px] sm:text-xs text-slate-400 mt-0.5 sm:mt-1 line-clamp-1 sm:line-clamp-none hidden sm:block">4 live templates with one-click print & ATS compliance</p>
            </div>

            <div className="p-1 sm:p-3.5 rounded-lg sm:rounded-xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
              <div className="flex items-center space-x-1 sm:space-x-2 text-amber-400 font-bold text-[10px] sm:text-sm">
                <ShieldCheck className="w-2.5 h-2.5 sm:w-4 sm:h-4 shrink-0" />
                <span className="truncate">{heroConfig.statBadge3Text || 'Direct HR Connect'}</span>
              </div>
              <p className="text-[9px] sm:text-xs text-slate-400 mt-0.5 sm:mt-1 line-clamp-1 sm:line-clamp-none hidden sm:block">Verified recruiters & fast application routing</p>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};
