import React, { useState } from 'react';
import { 
  MapPin, 
  Building2, 
  Bookmark, 
  Clock, 
  DollarSign, 
  Send, 
  Sparkles, 
  CheckCircle2, 
  Globe, 
  Shield, 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight,
  Layers,
  Pin,
  Flame,
  Calendar,
  Zap,
  FileText,
  RefreshCw
} from 'lucide-react';
import { Job } from '../types/job';
import { Advertisement, FeedInlineAdSettings, BannerDimensionSettings, FeedCardAppearanceSettings } from '../types/ad';
import { sanitizeJobTitle, sanitizeJobCompanyName, sanitizeJobTags } from '../utils/jobSanitizer';
import { InlineFeedAd } from './ads/InlineFeedAd';

interface JobListingsProps {
  jobs: Job[];
  priorityJobs?: Job[];
  savedJobIds: string[];
  onToggleSaveJob: (jobId: string) => void;
  onSelectJob: (job: Job) => void;
  onApplyClick: (job: Job) => void;
  isSubscribed: boolean;
  currentPage?: number;
  postsPerPage?: number;
  onPageChange?: (page: number) => void;
  onPostsPerPageChange?: (postsPerPage: number) => void;
  ads?: Advertisement[];
  feedInlineSettings?: FeedInlineAdSettings;
  bannerDimensions?: BannerDimensionSettings;
  feedCardAppearance?: FeedCardAppearanceSettings;
  onAdClick?: (ad: Advertisement) => void;
  onNavigateTab?: (tab: 'jobs' | 'cv' | 'alerts' | 'dashboard') => void;
}

export const JobListings: React.FC<JobListingsProps> = ({
  jobs,
  priorityJobs: propPriorityJobs,
  savedJobIds,
  onToggleSaveJob,
  onSelectJob,
  onApplyClick,
  isSubscribed,
  currentPage: controlledPage,
  postsPerPage: controlledPostsPerPage,
  onPageChange,
  onPostsPerPageChange,
  ads = [],
  feedInlineSettings,
  bannerDimensions,
  feedCardAppearance,
  onAdClick,
  onNavigateTab
}) => {
  // Local state fallback if not controlled from parent
  const [internalPage, setInternalPage] = useState<number>(1);
  const [internalPostsPerPage, setInternalPostsPerPage] = useState<number>(10);
  const [jumpPageInput, setJumpPageInput] = useState<string>('');

  const currentPage = controlledPage !== undefined ? controlledPage : internalPage;
  const postsPerPage = controlledPostsPerPage !== undefined ? controlledPostsPerPage : internalPostsPerPage;

  // STEP66-B.1: Separate Priority Jobs and Standard Jobs
  const priorityList = React.useMemo(() => {
    if (Array.isArray(propPriorityJobs) && propPriorityJobs.length > 0) {
      return propPriorityJobs;
    }
    return jobs.filter(j => 
      j.priorityTier === 'vip_bundle' || 
      (j as any).activePriorityTier || 
      (j.isPinnedTop && j.featured && j.urgent)
    ).slice(0, 8);
  }, [propPriorityJobs, jobs]);

  const priorityIdsSet = React.useMemo(() => new Set(priorityList.map(j => j.id)), [priorityList]);

  // Standard jobs excluding priority slot jobs
  const standardJobs = React.useMemo(() => {
    return jobs.filter(j => !priorityIdsSet.has(j.id));
  }, [jobs, priorityIdsSet]);

  const totalStandardJobs = standardJobs.length;
  const totalPages = Math.max(1, Math.ceil(totalStandardJobs / postsPerPage));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);

  const startIndex = (safePage - 1) * postsPerPage;
  const endIndex = Math.min(startIndex + postsPerPage, totalStandardJobs);
  const currentStandardJobs = standardJobs.slice(startIndex, endIndex);

  const handlePageSelect = (pageNumber: number) => {
    const targetPage = Math.min(Math.max(1, pageNumber), totalPages);
    if (onPageChange) {
      onPageChange(targetPage);
    } else {
      setInternalPage(targetPage);
    }
    const el = document.getElementById('jobs-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleJumpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseInt(jumpPageInput, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= totalPages) {
      handlePageSelect(parsed);
      setJumpPageInput('');
    }
  };

  const getPaginationItems = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const items: (number | string)[] = [];
    if (safePage <= 4) {
      for (let i = 1; i <= 5; i++) items.push(i);
      items.push('...');
      items.push(totalPages);
    } else if (safePage >= totalPages - 3) {
      items.push(1);
      items.push('...');
      for (let i = totalPages - 4; i <= totalPages; i++) items.push(i);
    } else {
      items.push(1);
      items.push('...');
      items.push(safePage - 1);
      items.push(safePage);
      items.push(safePage + 1);
      items.push('...');
      items.push(totalPages);
    }
    return items;
  };

  // Card renderer helper function
  const renderJobCard = (job: Job, index: number, isPriorityCard: boolean = false) => {
    const isSaved = savedJobIds.includes(job.id);
    const cleanTitle = sanitizeJobTitle(job.title);
    const cleanCompany = sanitizeJobCompanyName(job.company);
    const cleanTags = sanitizeJobTags(job.tags);

    const activeTier = (job as any).activePriorityTier || (job.priorityTier === 'vip_bundle' ? 'vip' : (job.isPinnedTop ? 'pinned' : (job.featured ? 'featured' : (job.urgent ? 'urgent' : 'standard'))));

    let cardBgStyle = 'bg-slate-900/90 border border-slate-800/90 hover:border-emerald-500/50 hover:shadow-emerald-500/10';
    let tierBadgeText = '';
    let tierBadgeStyle = '';

    if (activeTier === 'vip' || job.priorityTier === 'vip_bundle') {
      cardBgStyle = 'bg-gradient-to-b from-amber-500/15 via-amber-950/20 to-slate-900 border-2 border-amber-400 shadow-lg shadow-amber-500/10 hover:border-amber-300';
      tierBadgeText = '👑 VIP ULTIMATE PLACEMENT';
      tierBadgeStyle = 'from-amber-500/30 via-amber-500/20 to-slate-900 border-amber-400/80 text-amber-300';
    } else if (activeTier === 'pinned' || job.isPinnedTop || job.priorityTier === 'featured_top') {
      cardBgStyle = 'bg-gradient-to-b from-blue-500/15 via-blue-950/20 to-slate-900 border-2 border-blue-400 shadow-lg shadow-blue-500/10 hover:border-blue-300';
      tierBadgeText = '📌 PINNED TOP PLACEMENT';
      tierBadgeStyle = 'from-blue-500/30 via-blue-500/20 to-slate-900 border-blue-400/80 text-blue-300';
    } else if (activeTier === 'featured' || job.featured) {
      cardBgStyle = 'bg-gradient-to-b from-purple-500/15 via-purple-950/20 to-slate-900 border-2 border-purple-400 shadow-lg shadow-purple-500/10 hover:border-purple-300';
      tierBadgeText = '⭐ FEATURED PLACEMENT';
      tierBadgeStyle = 'from-purple-500/30 via-purple-500/20 to-slate-900 border-purple-400/80 text-purple-300';
    } else if (activeTier === 'urgent' || job.urgent) {
      cardBgStyle = 'bg-gradient-to-b from-rose-500/15 via-rose-950/20 to-slate-900 border-2 border-rose-400 shadow-lg shadow-rose-500/10 hover:border-rose-300';
      tierBadgeText = '🔥 URGENT HIRING PLACEMENT';
      tierBadgeStyle = 'from-rose-500/30 via-rose-500/20 to-slate-900 border-rose-400/80 text-rose-300';
    }

    return (
      <div
        key={job.id ? `${job.id}-${index}` : `job-${index}`}
        className={`group relative rounded-xl sm:rounded-2xl p-2 sm:p-5 shadow-sm sm:shadow-xl transition-all duration-300 flex flex-col justify-between ${cardBgStyle}`}
      >
        <div>
          {tierBadgeText && (
            <div className={`mb-1.5 sm:mb-2.5 flex items-center justify-between bg-gradient-to-r ${tierBadgeStyle} px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-md sm:rounded-lg border`}>
              <span className="text-[9px] sm:text-[11px] font-black flex items-center space-x-1 sm:space-x-1.5 uppercase tracking-wider">
                <Sparkles className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                <span>{tierBadgeText}</span>
              </span>
              <span className="text-[8px] sm:text-[10px] font-bold font-mono">Slot Protected</span>
            </div>
          )}
          <div className="flex items-start justify-between gap-1.5 sm:gap-2 mb-1.5 sm:mb-3">
            <div className="flex flex-wrap gap-1 sm:gap-1.5">
              {job.isFutureJob && (
                <span className="text-[9px] sm:text-xs font-bold px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 flex items-center space-x-1">
                  <Calendar className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-cyan-400" />
                  <span>Future {job.futureIntakeDate ? `(${job.futureIntakeDate})` : ''}</span>
                </span>
              )}
              {job.isPdfScraped && (
                <span className="text-[9px] sm:text-xs font-bold px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/35 flex items-center space-x-1">
                  <FileText className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-indigo-400" />
                  <span>PDF</span>
                </span>
              )}
              {job.isGovtJob && (
                <span className="text-[9px] sm:text-xs font-bold px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center space-x-1">
                  <Shield className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-400" />
                  <span>Govt {job.govtScale || ''}</span>
                </span>
              )}
              <span
                className={`text-[9px] sm:text-xs font-semibold px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded border ${
                  job.jobType === 'Remote'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : job.jobType === 'Hybrid'
                    ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                }`}
              >
                {job.jobType}
              </span>
              {job.featured && (
                <span className="text-[9px] sm:text-xs font-bold px-1.5 sm:px-2 py-0.5 sm:py-1 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40 flex items-center space-x-1">
                  <Sparkles className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-purple-400" />
                  <span>Featured</span>
                </span>
              )}
              {job.urgent && (
                <span className="text-[9px] sm:text-xs font-bold px-1.5 sm:px-2 py-0.5 sm:py-1 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center space-x-1">
                  <Flame className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-rose-400 fill-rose-400" />
                  <span>Urgent</span>
                </span>
              )}
            </div>
            <button
              onClick={() => onToggleSaveJob(job.id)}
              className={`p-1 sm:p-2 rounded-lg sm:rounded-xl transition-all shrink-0 cursor-pointer ${
                isSaved
                  ? 'bg-emerald-500 text-slate-950 font-bold'
                  : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
              title={isSaved ? 'Remove from Saved Jobs' : 'Save Job'}
            >
              <Bookmark className="w-3 h-3 sm:w-4 sm:h-4 fill-current" />
            </button>
          </div>
          <h3
            onClick={() => onSelectJob(job)}
            className="text-xs sm:text-lg font-bold text-white group-hover:text-emerald-400 transition-colors cursor-pointer leading-tight sm:leading-snug line-clamp-1 sm:line-clamp-2 mb-1"
          >
            {cleanTitle}
          </h3>
          <div className="hidden sm:flex flex-wrap items-center gap-1.5 text-slate-400 text-xs font-medium mb-3">
            <div className="flex items-center space-x-1">
              <Building2 className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-slate-300 font-semibold">{cleanCompany}</span>
            </div>
            <span>•</span>
            <div className="flex items-center space-x-1">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <span>{job.postedAt}</span>
            </div>
          </div>
        </div>
        <div className="pt-1.5 sm:pt-3 border-t border-slate-800/80 flex items-center justify-between gap-1 sm:gap-2">
          <div className="min-w-0 pr-1">
            <span className="text-[8px] sm:text-[10px] uppercase font-semibold text-slate-500 block truncate">Salary</span>
            <span className="text-[11px] sm:text-sm font-bold text-emerald-400 truncate block">{job.salary}</span>
          </div>
          <div className="flex items-center space-x-1 sm:space-x-2 shrink-0">
            <button
              onClick={() => onSelectJob(job)}
              className="px-2 sm:px-3.5 py-1 sm:py-2 rounded-lg sm:rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold text-[10px] sm:text-xs border border-slate-700/60 transition-all cursor-pointer shadow-sm active:scale-95"
            >
              Details
            </button>
            <button
              onClick={() => onApplyClick(job)}
              className="px-2.5 sm:px-4 py-1 sm:py-2 rounded-lg sm:rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-extrabold text-[10px] sm:text-xs shadow-md shadow-emerald-500/20 flex items-center space-x-1 sm:space-x-1.5 active:scale-95 transition-all cursor-pointer"
            >
              <Send className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 text-slate-950" />
              <span>Apply</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (jobs.length === 0 && priorityList.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center my-8">
        <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-500">
          <Building2 className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-bold text-white mb-2">No Matching Jobs Found</h3>
        <p className="text-slate-400 text-sm max-w-md mx-auto">
          We couldn't find any job postings matching your specific search filters. Try resetting your filters or selecting a broader location.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8 mb-8 sm:mb-12">
      {/* 1. PRIORITY PLACEMENT JOBS SECTION (Independent of standard pagination) */}
      {priorityList.length > 0 && (
        <div className="space-y-3 bg-slate-950/60 p-4 sm:p-6 rounded-2xl border border-amber-500/30 shadow-2xl">
          <div className="flex items-center justify-between border-b border-amber-500/20 pb-3">
            <div className="flex items-center space-x-2.5">
              <Zap className="w-5 h-5 text-amber-400 animate-pulse" />
              <h3 className="font-black text-white text-base sm:text-lg tracking-tight">
                Priority Featured Opportunities
              </h3>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold">
                {priorityList.length} Top Slots
              </span>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
            {priorityList.map((job, idx) => renderJobCard(job, idx, true))}
          </div>
        </div>
      )}

      {/* 2. STANDARD JOBS SECTION HEADER SUMMARY */}
      <div className="flex items-center justify-between bg-slate-900/60 border border-slate-800/80 rounded-xl sm:rounded-2xl px-3.5 py-2 sm:px-5 sm:py-3.5 shadow-md">
        <div className="flex items-center space-x-2 text-xs text-slate-300">
          <Layers className="w-4 h-4 text-emerald-400" />
          <span>
            Showing <strong className="text-white font-bold">{totalStandardJobs > 0 ? startIndex + 1 : 0}–{endIndex}</strong> of{' '}
            <strong className="text-emerald-400 font-bold">{totalStandardJobs}</strong> standard listings
          </span>
        </div>
      </div>

      {/* 3. STANDARD JOBS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-6">
        {currentStandardJobs.map((job, index) => renderJobCard(job, index, false))}
      </div>

      {/* BOTTOM PAGINATION CONTROLS BAR */}
      {totalPages > 1 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl sm:rounded-2xl p-3 sm:p-5 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-3 sm:gap-4 mt-6 sm:mt-8">
          <div className="text-xs text-slate-400">
            Showing <span className="font-bold text-white">{startIndex + 1}–{endIndex}</span> of{' '}
            <span className="font-bold text-emerald-400">{totalStandardJobs}</span> total jobs
          </div>
          <div className="flex flex-wrap items-center justify-center gap-1 sm:gap-1.5">
            <button
              onClick={() => handlePageSelect(1)}
              disabled={safePage === 1}
              className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl border border-slate-800 bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-40 transition-all cursor-pointer min-w-[32px] sm:min-w-[36px] min-h-[32px] sm:min-h-[36px] flex items-center justify-center"
            >
              <ChevronsLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
            <button
              onClick={() => handlePageSelect(safePage - 1)}
              disabled={safePage === 1}
              className="px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg sm:rounded-xl border border-slate-800 bg-slate-950 text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-40 transition-all font-semibold text-xs flex items-center space-x-1 cursor-pointer min-h-[32px] sm:min-h-[36px]"
            >
              <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Prev</span>
            </button>
            <div className="flex flex-wrap items-center justify-center gap-1">
              {getPaginationItems().map((item, idx) => {
                if (item === '...') return <span key={`ellipsis-${idx}`} className="px-1.5 sm:px-2 py-1 text-slate-500 font-bold text-xs">...</span>;
                const pageNum = item as number;
                return (
                  <button
                    key={`page-${pageNum}`}
                    onClick={() => handlePageSelect(pageNum)}
                    className={`min-w-[32px] sm:min-w-[36px] h-8 sm:h-9 px-1.5 sm:px-2 rounded-lg sm:rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      pageNum === safePage
                        ? 'bg-emerald-500 text-slate-950 shadow-lg scale-105 font-black ring-2 ring-emerald-400/40'
                        : 'bg-slate-950 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => handlePageSelect(safePage + 1)}
              disabled={safePage === totalPages}
              className="px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg sm:rounded-xl border border-slate-800 bg-slate-950 text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-40 transition-all font-semibold text-xs flex items-center space-x-1 cursor-pointer min-h-[32px] sm:min-h-[36px]"
            >
              <span className="hidden sm:inline">Next</span>
              <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
            <button
              onClick={() => handlePageSelect(totalPages)}
              disabled={safePage === totalPages}
              className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl border border-slate-800 bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-40 transition-all cursor-pointer min-w-[32px] sm:min-w-[36px] min-h-[32px] sm:min-h-[36px] flex items-center justify-center"
            >
              <ChevronsRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
