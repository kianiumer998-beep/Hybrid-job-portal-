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
    <section className="relative overflow-hidden bg-slate-950 pt-8 pb-12 sm:pt-14 sm:pb-16 border-b border-slate-800/80">
      {/* Subtle Background Glow Elements */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-tr from-emerald-500/10 via-indigo-500/10 to-transparent blur-3xl pointer-events-none rounded-full" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 space-y-8">
        
        {/* PROMINENT HIRING / EMPLOYER CTA BANNER */}
        <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-indigo-950 border border-emerald-500/30 rounded-2xl p-4 sm:p-5 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 p-0.5 shrink-0 shadow-lg shadow-emerald-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Building2 className="w-6 h-6 text-emerald-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-emerald-400 font-extrabold text-xs uppercase tracking-wider bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  {heroConfig.hiringBannerBadge || 'Hiring Employers & Recruiters'}
                </span>
                <span className="text-amber-400 text-xs font-bold animate-pulse">● Instant Approval Portal</span>
              </div>
              <h2 className="text-base sm:text-lg font-black text-white mt-0.5">
                {heroConfig.hiringBannerTitle || 'Want to Hire? Register now to post a job instantly!'}
              </h2>
              <p className="text-xs text-slate-300">
                {heroConfig.hiringBannerSub || 'Post your job today and find top verified remote & hybrid talent in Pakistan and worldwide.'}
              </p>
            </div>
          </div>

          <button
            onClick={onPostJobClick}
            className="w-full md:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-xl shadow-emerald-500/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center space-x-2 shrink-0 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4 text-slate-950" />
            <span>{heroConfig.hiringBannerBtnText || 'Post a Job Now'}</span>
          </button>
        </div>

        <div className="text-center max-w-4xl mx-auto">
          
          {/* Eyebrow Badge */}
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-slate-900/90 border border-emerald-500/30 text-emerald-400 text-xs font-semibold mb-6 shadow-xl backdrop-blur-md">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>{heroConfig.eyebrowBadgeText || '#1 Unified Remote Portal & Automated CV Engine for Pakistan & Global'}</span>
          </div>

          {/* Main Heading */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-tight">
            {heroConfig.mainHeadingPrefix || 'Find Your Next'}{' '}
            <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-indigo-400 bg-clip-text text-transparent">
              {heroConfig.gradientWord || 'Hybrid or Remote'}
            </span>{' '}
            {heroConfig.mainHeadingSuffix || 'Role'}
          </h1>

          {/* Subheading */}
          <p className="mt-4 text-base sm:text-xl text-slate-300 leading-relaxed font-normal max-w-2xl mx-auto">
            {heroConfig.subHeading || 'Browse verified opportunities globally or target localized jobs across Pakistan down to Province, City, and District levels. Build ATS-optimized resumes in minutes.'}
          </p>

          {/* Quick Action Buttons */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={onExploreClick}
              className="w-full sm:w-auto px-8 py-4 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 text-slate-950 font-bold text-base shadow-xl shadow-emerald-500/20 hover:shadow-emerald-500/35 hover:scale-[1.02] active:scale-95 transition-all duration-200 flex items-center justify-center space-x-2 cursor-pointer"
            >
              <Search className="w-5 h-5 text-slate-950" />
              <span>{heroConfig.primaryBtnText || `Browse ${totalJobsCount} Verified Jobs`}</span>
              <ArrowRight className="w-4 h-4 ml-1 text-slate-950" />
            </button>

            <button
              onClick={onCvClick}
              className="w-full sm:w-auto px-8 py-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white border border-slate-700/80 font-semibold text-base shadow-lg hover:border-indigo-500/50 hover:scale-[1.02] active:scale-95 transition-all duration-200 flex items-center justify-center space-x-2 cursor-pointer"
            >
              <Sparkles className="w-5 h-5 text-indigo-400" />
              <span>{heroConfig.secondaryBtnText || 'Build ATS Resume (Free)'}</span>
            </button>
          </div>

          {/* Key Feature Anchors */}
          <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-3 text-left">
            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
              <div className="flex items-center space-x-2 text-emerald-400 font-bold text-sm">
                <MapPin className="w-4 h-4 shrink-0" />
                <span>{heroConfig.statBadge1Text || 'Localized PK Sorting'}</span>
              </div>
              <p className="text-xs text-slate-400 mt-1">Province, City & District filter for Punjab, Sindh, KPK & Islamabad</p>
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
