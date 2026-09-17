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
import { Advertisement, FeedInlineAdSettings } from '../types/ad';
import { sanitizeJobTitle, sanitizeJobCompanyName, sanitizeJobTags } from '../utils/jobSanitizer';
import { InlineFeedAd } from './ads/InlineFeedAd';

interface JobListingsProps {
  jobs: Job[];
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
  onAdClick?: (ad: Advertisement) => void;
  onNavigateTab?: (tab: 'jobs' | 'cv' | 'alerts' | 'dashboard') => void;
}

export const JobListings: React.FC<JobListingsProps> = ({
  jobs,
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
  onAdClick,
  onNavigateTab
}) => {
  // Local state fallback if not controlled from parent
  const [internalPage, setInternalPage] = useState<number>(1);
  const [internalPostsPerPage, setInternalPostsPerPage] = useState<number>(10);
  const [jumpPageInput, setJumpPageInput] = useState<string>('');

  const currentPage = controlledPage !== undefined ? controlledPage : internalPage;
  const postsPerPage = controlledPostsPerPage !== undefined ? controlledPostsPerPage : internalPostsPerPage;

  const totalJobs = jobs.length;
  const totalPages = Math.max(1, Math.ceil(totalJobs / postsPerPage));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);

  const startIndex = (safePage - 1) * postsPerPage;
  const endIndex = Math.min(startIndex + postsPerPage, totalJobs);
  const currentJobs = jobs.slice(startIndex, endIndex);

  const handlePageSelect = (pageNumber: number) => {
    const targetPage = Math.min(Math.max(1, pageNumber), totalPages);
    if (onPageChange) {
      onPageChange(targetPage);
    } else {
      setInternalPage(targetPage);
    }
    // Smooth scroll back to top of jobs section
    const el = document.getElementById('jobs-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handlePostsPerPageSelect = (count: number) => {
    if (onPostsPerPageChange) {
      onPostsPerPageChange(count);
    } else {
      setInternalPostsPerPage(count);
      setInternalPage(1);
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

  // Helper to generate smart windowed pagination array
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

  if (jobs.length === 0) {
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
    <div className="space-y-6 mb-12">
      {/* Top Header Summary & Posts Per Page Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-900/60 border border-slate-800/80 rounded-2xl px-5 py-3.5 shadow-md">
        <div className="flex items-center space-x-2 text-xs text-slate-300">
          <Layers className="w-4 h-4 text-emerald-400" />
          <span>
            Showing <strong className="text-white font-bold">{startIndex + 1}–{endIndex}</strong> of{' '}
            <strong className="text-emerald-400 font-bold">{totalJobs}</strong> jobs
          </span>
          <span className="text-slate-600">•</span>
          <span className="text-slate-400">
            Page <strong className="text-slate-200">{safePage}</strong> of{' '}
            <strong className="text-slate-200">{totalPages}</strong>
          </span>
        </div>

        {/* Posts per page filter options: 10, 15, 20 */}
        <div className="flex items-center space-x-2 self-start sm:self-auto">
          <span className="text-xs font-semibold text-slate-400">Posts per page:</span>
          <div className="inline-flex bg-slate-950 p-1 rounded-xl border border-slate-800">
            {[10, 15, 20].map((count) => {
              const isActive = postsPerPage === count;
              return (
                <button
                  key={count}
                  type="button"
                  onClick={() => handlePostsPerPageSelect(count)}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    isActive
                      ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                  title={`Show ${count} posts per page`}
                >
                  {count}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Job Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-6">
        {currentJobs.map((job, index) => {
          const isSaved = savedJobIds.includes(job.id);
          const cleanTitle = sanitizeJobTitle(job.title);
          const cleanCompany = sanitizeJobCompanyName(job.company);
          const cleanTags = sanitizeJobTags(job.tags);

          // Find candidate inline ad
          const activeFeedAds = ads.filter(
            (a) =>
              a.status === 'active' &&
              ((a.placement as string) === 'feed-inline' || (a.type === 'banner' && (a.placement as string) === 'feed-inline')) &&
              (a.targetPages.includes('all') || a.targetPages.includes('jobs'))
          );

          let shouldInsertAd = false;
          const maxAds = feedInlineSettings?.maxAdsPerPage ?? 3;

          if (activeFeedAds.length > 0) {
            const positionNumber = index + 1; // 1-based index (e.g. 2nd job is position 2)

            if (feedInlineSettings?.insertionMode === 'cadence') {
              const cadence = feedInlineSettings.repeatEveryNJobs || 3;
              shouldInsertAd = positionNumber % cadence === 0;
            } else {
              // Custom indices (e.g. [2, 5, 8])
              const targetIndices =
                safePage === 1 &&
                feedInlineSettings?.page1SpecificIndices &&
                feedInlineSettings.page1SpecificIndices.length > 0
                  ? feedInlineSettings.page1SpecificIndices
                  : feedInlineSettings?.customIndices || [2, 5, 8];

              shouldInsertAd = targetIndices.includes(positionNumber);
            }
          }

          // Compute which ad to display if any
          let feedAdToRender: Advertisement | null = null;
          if (shouldInsertAd && activeFeedAds.length > 0) {
            const adIndex = Math.floor(index / (feedInlineSettings?.repeatEveryNJobs || 3)) % activeFeedAds.length;
            feedAdToRender = activeFeedAds[adIndex] || activeFeedAds[0];
          }

          const isTopPriority = job.isPinnedTop || job.priorityTier === 'vip_bundle' || job.priorityTier === 'featured_top';

          return (
            <React.Fragment key={job.id ? `${job.id}-${index}` : `job-${index}`}>
              <div
                className={`group relative rounded-xl sm:rounded-2xl p-2.5 sm:p-5 shadow-sm sm:shadow-xl transition-all duration-300 flex flex-col justify-between ${
                  isTopPriority
                    ? 'bg-gradient-to-b from-slate-900 via-slate-900 to-amber-950/20 border-2 border-amber-500/50 shadow-amber-500/10 hover:border-amber-400 hover:shadow-amber-500/20'
                    : job.urgent
                    ? 'bg-slate-900/90 border border-rose-500/40 hover:border-rose-500/70 shadow-rose-500/5'
                    : 'bg-slate-900/90 border border-slate-800/90 hover:border-emerald-500/50 hover:shadow-emerald-500/10'
                }`}
              >
              <div>
                {/* TOP PRIORITY / PINNED / FUTURE BANNER TAG */}
                {isTopPriority && (
                  <div className="mb-1.5 sm:mb-2.5 flex items-center justify-between bg-gradient-to-r from-amber-500/20 via-rose-500/15 to-purple-500/20 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-md sm:rounded-lg border border-amber-500/40">
                    <span className="text-[9px] sm:text-[11px] font-black text-amber-300 flex items-center space-x-1 sm:space-x-1.5 uppercase tracking-wider">
                      <Pin className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-400 fill-amber-400" />
                      <span>{job.priorityTier === 'vip_bundle' ? '🚀 VIP TOP' : '📌 PINNED'}</span>
                    </span>
                    <span className="text-[8px] sm:text-[10px] text-amber-400/90 font-bold font-mono">Rank #1</span>
                  </div>
                )}

                {/* Header Badges & Saved Button */}
                <div className="flex items-start justify-between gap-1.5 sm:gap-2 mb-1.5 sm:mb-3">
                  <div className="flex flex-wrap gap-1 sm:gap-1.5">
                    {/* Future Job Badge */}
                    {job.isFutureJob && (
                      <span className="text-[9px] sm:text-xs font-bold px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 flex items-center space-x-1">
                        <Calendar className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-cyan-400" />
                        <span>Future {job.futureIntakeDate ? `(${job.futureIntakeDate})` : ''}</span>
                      </span>
                    )}

                    {/* PDF Scraped Gazette Badge */}
                    {job.isPdfScraped && (
                      <span className="text-[9px] sm:text-xs font-bold px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/35 flex items-center space-x-1">
                        <FileText className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-indigo-400" />
                        <span>PDF</span>
                      </span>
                    )}

                    {/* Duplicate Override / Re-announced Posting Badge */}
                    {job.isDuplicateOverride && (
                      <span className="text-[9px] sm:text-xs font-bold px-1.5 sm:px-2 py-0.5 sm:py-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center space-x-1" title="Approved as Re-advertised Vacancy">
                        <RefreshCw className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-400" />
                        <span>Re-announced</span>
                      </span>
                    )}

                    {/* Government & Newspaper Badges */}
                    {job.isGovtJob && (
                      <span className="text-[9px] sm:text-xs font-bold px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center space-x-1">
                        <Shield className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-400" />
                        <span>Govt {job.govtScale || ''}</span>
                      </span>
                    )}
                    {job.isNewspaperAd && (
                      <span className="text-[9px] sm:text-xs font-semibold px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded bg-teal-500/15 text-teal-300 border border-teal-500/30 flex items-center space-x-1">
                        <Globe className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-teal-400" />
                        <span>{job.newspaperName || 'Newspaper'}</span>
                      </span>
                    )}

                    {/* Job Type Badge */}
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

                    {/* Urgent / Featured Badges */}
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

                  {/* Bookmark Toggle */}
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

                {/* Job Title & Company */}
                <h3
                  onClick={() => onSelectJob(job)}
                  className="text-xs sm:text-lg font-bold text-white group-hover:text-emerald-400 transition-colors cursor-pointer leading-tight sm:leading-snug line-clamp-1 sm:line-clamp-2 mb-1"
                >
                  {cleanTitle}
                </h3>

                {/* Mobile compact company, location and posted line */}
                <div className="flex sm:hidden items-center justify-between text-[10px] text-slate-400 mb-1.5">
                  <div className="flex items-center space-x-1 truncate max-w-[70%]">
                    <Building2 className="w-2.5 h-2.5 text-slate-500 shrink-0" />
                    <span className="text-slate-300 font-semibold truncate">{cleanCompany}</span>
                    <span className="text-slate-600">•</span>
                    <span className="text-emerald-400 font-medium truncate">{job.city || (job.region === 'Pakistan' ? 'Pakistan' : job.region)}</span>
                  </div>
                  <span className="text-[9px] text-slate-500 shrink-0">{job.postedAt}</span>
                </div>

                {/* Desktop metadata row */}
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

                {/* Location Badges (Province, City, District) - Desktop view */}
                <div className="hidden sm:block bg-slate-950/60 p-2.5 sm:p-3 rounded-lg sm:rounded-xl border border-slate-800/60 mb-2 sm:mb-3 space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] sm:text-xs text-slate-300 font-medium">
                    {job.region === 'Pakistan' ? (
                      <span className="text-emerald-400 font-bold">🇵🇰 Pakistan</span>
                    ) : job.region === 'US' ? (
                      <span>🇺🇸 United States</span>
                    ) : job.region === 'UK' ? (
                      <span>🇬🇧 United Kingdom</span>
                    ) : job.region === 'UAE' ? (
                      <span className="text-amber-300 font-semibold">🇦🇪 UAE</span>
                    ) : job.region === 'Saudi Arabia' ? (
                      <span className="text-emerald-300 font-semibold">🇸🇦 Saudi Arabia</span>
                    ) : job.region === 'Canada' ? (
                      <span>🇨🇦 Canada</span>
                    ) : job.region === 'Europe' ? (
                      <span>🇪🇺 Europe</span>
                    ) : job.region === 'Australia' ? (
                      <span>🇦🇺 Australia</span>
                    ) : (
                      <span className="text-indigo-400 font-semibold">🌐 Remote</span>
                    )}

                    {job.province && (
                      <span className="text-slate-400">• {job.province}</span>
                    )}

                    {job.city && (
                      <span className="inline-flex items-center text-[10px] sm:text-[11px] font-semibold bg-emerald-500/15 text-emerald-300 px-1.5 sm:px-2 py-0.5 rounded border border-emerald-500/20">
                        <MapPin className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-0.5 sm:mr-1 text-emerald-400" />
                        {job.city}
                      </span>
                    )}
                    {job.district && (
                      <span className="inline-flex items-center text-[10px] sm:text-[11px] font-semibold bg-teal-500/15 text-teal-300 px-1.5 sm:px-2 py-0.5 rounded border border-teal-500/20">
                        {job.district}
                      </span>
                    )}
                  </div>
                </div>

                {/* Brief Job Description & Overview Excerpt on Front Card */}
                {job.description && (
                  <div className="mb-1.5 sm:mb-3">
                    <p className="text-[10px] sm:text-xs text-slate-400 sm:text-slate-300 line-clamp-1 sm:line-clamp-2 leading-relaxed font-normal sm:bg-slate-950/60 sm:p-2.5 sm:rounded-xl sm:border sm:border-slate-800/80">
                      {job.description.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim()}
                    </p>
                    {job.domicileQuota && (
                      <div className="mt-0.5 sm:mt-1 pt-0.5 sm:pt-1 sm:border-t sm:border-slate-800/80 text-[9px] sm:text-[10px] text-amber-300 font-medium truncate flex items-center space-x-1">
                        <span className="font-bold text-amber-400">Quota:</span>
                        <span className="truncate">{job.domicileQuota}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Tags - 2 tags on mobile, 3+ on desktop */}
                <div className="flex flex-wrap gap-1 sm:gap-1.5 mb-1.5 sm:mb-4">
                  {cleanTags.slice(0, 2).map((tag, i) => (
                    <span
                      key={i}
                      className="text-[9px] sm:text-[11px] font-medium bg-slate-800/80 text-slate-300 px-1.5 sm:px-2 py-0.5 rounded border border-slate-700/60"
                    >
                      {tag}
                    </span>
                  ))}
                  {cleanTags.length > 2 && (
                    <span className="text-[9px] sm:text-[10px] text-slate-500 self-center">
                      +{cleanTags.length - 2}
                    </span>
                  )}
                </div>
              </div>

              {/* Salary & Action Buttons */}
              <div className="pt-1.5 sm:pt-3 border-t border-slate-800/80 flex items-center justify-between gap-1 sm:gap-2">
                <div className="min-w-0 pr-1">
                  <span className="text-[8px] sm:text-[10px] uppercase font-semibold text-slate-500 block truncate">
                    Salary
                  </span>
                  <span className="text-[11px] sm:text-sm font-bold text-emerald-400 truncate block">
                    {job.salary}
                  </span>
                </div>

                <div className="flex items-center space-x-1 sm:space-x-2 shrink-0">
                  <button
                    onClick={() => onSelectJob(job)}
                    className="px-2 sm:px-3.5 py-1 sm:py-2 rounded-lg sm:rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold text-[10px] sm:text-xs border border-slate-700/60 transition-all cursor-pointer shadow-sm active:scale-95"
                    title="View Full Job Details"
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

            {/* Inline Sponsored Feed Ad if matched */}
            {feedAdToRender && (
              <InlineFeedAd
                ad={feedAdToRender}
                onAdClick={onAdClick || (() => {})}
                onNavigateTab={onNavigateTab}
              />
            )}
          </React.Fragment>
          );
        })}
      </div>

      {/* BOTTOM PAGINATION CONTROLS BAR */}
      {totalPages > 1 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-4 mt-8">
          
          {/* Left: Summary and Posts-Per-Page Selector */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
            <div>
              Showing <span className="font-bold text-white">{startIndex + 1}–{endIndex}</span> of{' '}
              <span className="font-bold text-emerald-400">{totalJobs}</span> total jobs
            </div>
            
            <div className="hidden sm:flex items-center space-x-1.5 pl-3 border-l border-slate-800">
              <span>Per page:</span>
              <div className="inline-flex bg-slate-950 p-0.5 rounded-lg border border-slate-800">
                {[10, 15, 20].map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => handlePostsPerPageSelect(count)}
                    className={`px-2 py-0.5 text-xs font-bold rounded ${
                      postsPerPage === count
                        ? 'bg-emerald-500 text-slate-950'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Center: Pagination Buttons */}
          <div className="flex items-center space-x-1 sm:space-x-1.5">
            {/* First Page Button */}
            <button
              onClick={() => handlePageSelect(1)}
              disabled={safePage === 1}
              className="p-2 rounded-xl border border-slate-800 bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-slate-950 disabled:hover:text-slate-400 disabled:cursor-not-allowed transition-all cursor-pointer"
              title="First Page"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>

            {/* Previous Page Button */}
            <button
              onClick={() => handlePageSelect(safePage - 1)}
              disabled={safePage === 1}
              className="px-3 py-2 rounded-xl border border-slate-800 bg-slate-950 text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-slate-950 disabled:hover:text-slate-300 disabled:cursor-not-allowed transition-all font-semibold text-xs flex items-center space-x-1 cursor-pointer"
              title="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Prev</span>
            </button>

            {/* Numbered Page Buttons with Windowing */}
            <div className="flex items-center space-x-1">
              {getPaginationItems().map((item, idx) => {
                if (item === '...') {
                  return (
                    <span
                      key={`ellipsis-${idx}`}
                      className="px-2 py-1 text-slate-500 font-bold text-xs"
                    >
                      ...
                    </span>
                  );
                }

                const pageNum = item as number;
                const isCurrent = pageNum === safePage;

                return (
                  <button
                    key={`page-${pageNum}`}
                    onClick={() => handlePageSelect(pageNum)}
                    className={`min-w-[36px] h-9 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      isCurrent
                        ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/30 scale-105 font-black ring-2 ring-emerald-400/40'
                        : 'bg-slate-950 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            {/* Next Page Button */}
            <button
              onClick={() => handlePageSelect(safePage + 1)}
              disabled={safePage === totalPages}
              className="px-3 py-2 rounded-xl border border-slate-800 bg-slate-950 text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-slate-950 disabled:hover:text-slate-300 disabled:cursor-not-allowed transition-all font-semibold text-xs flex items-center space-x-1 cursor-pointer"
              title="Next Page"
            >
              <span className="hidden sm:inline">Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>

            {/* Last Page Button */}
            <button
              onClick={() => handlePageSelect(totalPages)}
              disabled={safePage === totalPages}
              className="p-2 rounded-xl border border-slate-800 bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-slate-950 disabled:hover:text-slate-400 disabled:cursor-not-allowed transition-all cursor-pointer"
              title="Last Page"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>

          {/* Right: Quick Jump to Page Form */}
          {totalPages > 3 && (
            <form onSubmit={handleJumpSubmit} className="flex items-center space-x-1.5 text-xs">
              <span className="text-slate-400">Go to:</span>
              <input
                type="number"
                min={1}
                max={totalPages}
                value={jumpPageInput}
                onChange={(e) => setJumpPageInput(e.target.value)}
                placeholder={String(safePage)}
                className="w-14 px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-white text-center font-bold text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
              <button
                type="submit"
                className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold rounded-lg transition-all cursor-pointer"
              >
                Go
              </button>
            </form>
          )}

        </div>
      )}
    </div>
  );
};
