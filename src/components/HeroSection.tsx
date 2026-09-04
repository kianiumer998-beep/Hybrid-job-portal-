import React from 'react';
import { Search, MapPin, Sparkles, ShieldCheck, MessageSquare, ArrowRight, Building2, PlusCircle } from 'lucide-react';
import { LandingHeroConfig, DEFAULT_LANDING_PAGE_CONFIG } from '../types/landing';

interface HeroSectionProps {
  onSearchFocus?: () => void;
  onExploreClick: () => void;
  onCvClick: () => void;
  onPostJobClick: () => void;
  totalJobsCount: number;
  heroConfig?: LandingHeroConfig;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  onExploreClick,
  onCvClick,
  onPostJobClick,
  totalJobsCount,
  heroConfig = DEFAULT_LANDING_PAGE_CONFIG.hero
}) => {
  return (
    <section className="relative overflow-hidden bg-slate-950 pt-5 pb-8 sm:pt-14 sm:pb-16 border-b border-slate-800/80">
      {/* Subtle Background Glow Elements */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-tr from-emerald-500/10 via-indigo-500/10 to-transparent blur-3xl pointer-events-none rounded-full" />
      
      <div className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 relative z-10 space-y-4 sm:space-y-8">
        
        {/* PROMINENT HIRING / EMPLOYER CTA BANNER */}
        <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-indigo-950 border border-emerald-500/30 rounded-xl sm:rounded-2xl p-3 sm:p-5 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center space-x-2.5 sm:space-x-3.5 w-full md:w-auto">
            <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 p-0.5 shrink-0 shadow-lg shadow-emerald-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[7px] sm:rounded-[10px] flex items-center justify-center">
                <Building2 className="w-4 h-4 sm:w-6 sm:h-6 text-emerald-400" />
              </div>
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-1.5 sm:space-x-2 flex-wrap">
                <span className="text-emerald-400 font-extrabold text-[9px] sm:text-xs uppercase tracking-wider bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                  {heroConfig.hiringBannerBadge || 'Hiring Employers & Recruiters'}
                </span>
                <span className="text-amber-400 text-[10px] sm:text-xs font-bold animate-pulse">● Instant Approval</span>
              </div>
              <h2 className="text-xs sm:text-lg font-black text-white mt-0.5 truncate sm:whitespace-normal">
                {heroConfig.hiringBannerTitle || 'Want to Hire? Register now to post a job instantly!'}
              </h2>
              <p className="text-[10px] sm:text-xs text-slate-300 hidden sm:block">
                {heroConfig.hiringBannerSub || 'Post your job today and find top verified remote & hybrid talent in Pakistan and worldwide.'}
              </p>
            </div>
          </div>

          <button
            onClick={onPostJobClick}
            className="w-full md:w-auto px-4 py-2 sm:px-6 sm:py-3 rounded-lg sm:rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-[11px] sm:text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center space-x-1.5 sm:space-x-2 shrink-0 cursor-pointer"
          >
            <PlusCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-950" />
            <span>{heroConfig.hiringBannerBtnText || 'Post a Job Now'}</span>
          </button>
        </div>

        <div className="text-center max-w-4xl mx-auto">
          
          {/* Eyebrow Badge */}
          <div className="inline-flex items-center space-x-1.5 sm:space-x-2 px-2.5 py-1 sm:px-3.5 sm:py-1.5 rounded-full bg-slate-900/90 border border-emerald-500/30 text-emerald-400 text-[10px] sm:text-xs font-semibold mb-3 sm:mb-6 shadow-xl backdrop-blur-md">
            <span className="flex h-1.5 w-1.5 sm:h-2 sm:w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 sm:h-2 sm:w-2 bg-emerald-500"></span>
            </span>
            <span className="truncate max-w-[280px] sm:max-w-none">{heroConfig.eyebrowBadgeText || '#1 Unified Remote Portal & Automated CV Engine for Pakistan & Global'}</span>
          </div>

          {/* Main Heading */}
          <h1 className="text-2xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-tight">
            {heroConfig.mainHeadingPrefix || 'Find Your Next'}{' '}
            <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-indigo-400 bg-clip-text text-transparent">
              {heroConfig.gradientWord || 'Hybrid or Remote'}
            </span>{' '}
            {heroConfig.mainHeadingSuffix || 'Role'}
          </h1>

          {/* Subheading */}
          <p className="mt-2 sm:mt-4 text-xs sm:text-xl text-slate-300 leading-relaxed font-normal max-w-2xl mx-auto line-clamp-2 sm:line-clamp-none">
            {heroConfig.subHeading || 'Browse verified opportunities globally or target localized jobs across Pakistan down to Province, City, and District levels. Build ATS-optimized resumes in minutes.'}
          </p>

          {/* Quick Action Buttons */}
          <div className="mt-4 sm:mt-8 flex flex-row items-center justify-center gap-2 sm:gap-4">
            <button
              onClick={onExploreClick}
              className="flex-1 sm:flex-initial px-4 py-2.5 sm:px-8 sm:py-4 rounded-lg sm:rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 text-slate-950 font-bold text-xs sm:text-base shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/35 hover:scale-[1.02] active:scale-95 transition-all duration-200 flex items-center justify-center space-x-1.5 sm:space-x-2 cursor-pointer"
            >
              <Search className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-slate-950" />
              <span>{heroConfig.primaryBtnText || `Browse ${totalJobsCount} Jobs`}</span>
              <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 text-slate-950" />
            </button>

            <button
              onClick={onCvClick}
              className="flex-1 sm:flex-initial px-4 py-2.5 sm:px-8 sm:py-4 rounded-lg sm:rounded-xl bg-slate-900 hover:bg-slate-800 text-white border border-slate-700/80 font-semibold text-xs sm:text-base shadow-lg hover:border-indigo-500/50 hover:scale-[1.02] active:scale-95 transition-all duration-200 flex items-center justify-center space-x-1.5 sm:space-x-2 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-indigo-400" />
              <span>{heroConfig.secondaryBtnText || 'Build ATS CV'}</span>
            </button>
          </div>

          {/* Key Feature Anchors */}
          <div className="mt-5 sm:mt-10 grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 text-left">
            <div className="p-2 sm:p-3.5 rounded-lg sm:rounded-xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
              <div className="flex items-center space-x-1.5 sm:space-x-2 text-emerald-400 font-bold text-xs sm:text-sm">
                <MapPin className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" />
                <span className="truncate">{heroConfig.statBadge1Text || 'Localized PK'}</span>
              </div>
              <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5 sm:mt-1 line-clamp-1 sm:line-clamp-none">Province, City & District filter</p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
              <div className="flex items-center space-x-2 text-teal-400 font-bold text-sm">
                <MessageSquare className="w-4 h-4 shrink-0" />
                <span>{heroConfig.statBadge4Text || 'WhatsApp Job Alerts'}</span>
              </div>
              <p className="text-xs text-slate-400 mt-1">Get instant WhatsApp notifications when new matching jobs post</p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
              <div className="flex items-center space-x-2 text-indigo-400 font-bold text-sm">
                <Sparkles className="w-4 h-4 shrink-0" />
                <span>{heroConfig.statBadge2Text || 'Automated CV Engine'}</span>
              </div>
              <p className="text-xs text-slate-400 mt-1">4 live templates with one-click print and ATS compliance</p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
              <div className="flex items-center space-x-2 text-amber-400 font-bold text-sm">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>{heroConfig.statBadge3Text || 'Direct HR Connect'}</span>
              </div>
              <p className="text-xs text-slate-400 mt-1">Verified company recruiters and fast application routing</p>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};
