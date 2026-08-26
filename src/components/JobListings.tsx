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
  Layers
} from 'lucide-react';
import { Job } from '../types/job';
import { Advertisement } from '../types/ad';
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {currentJobs.map((job, index) => {
          const isSaved = savedJobIds.includes(job.id);
          const cleanTitle = sanitizeJobTitle(job.title);
          const cleanCompany = sanitizeJobCompanyName(job.company);
          const cleanTags = sanitizeJobTags(job.tags);

          // Find candidate inline ad
          const activeFeedAds = ads.filter(
            (a) =>
              a.status === 'active' &&
              (a.placement === 'feed-inline' || (a.type === 'banner' && a.placement === 'feed-inline')) &&
              (a.targetPages.includes('all') || a.targetPages.includes('jobs'))
          );
          const feedAdToRender = index === 2 && activeFeedAds.length > 0 ? activeFeedAds[0] : null;

          return (
            <React.Fragment key={job.id ? `${job.id}-${index}` : `job-${index}`}>
              <div
                className="group relative bg-slate-900/90 border border-slate-800/90 hover:border-emerald-500/50 rounded-2xl p-5 shadow-xl hover:shadow-emerald-500/10 transition-all duration-300 flex flex-col justify-between"
              >
              <div>
                {/* Header Badges & Saved Button */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex flex-wrap gap-1.5">
                    {/* Government & Newspaper Badges */}
                    {job.isGovtJob && (
                      <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center space-x-1">
                        <Shield className="w-3 h-3 text-amber-400" />
                        <span>Govt {job.govtScale || 'Sector'}</span>
                      </span>
                    )}
                    {job.isNewspaperAd && (
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-teal-500/15 text-teal-300 border border-teal-500/30 flex items-center space-x-1">
                        <Globe className="w-3 h-3 text-teal-400" />
                        <span>{job.newspaperName || 'Newspaper Ad'}</span>
                      </span>
                    )}

                    {/* Job Type Badge */}
                    <span
                      className={`text-xs font-semibold px-2.5 py-1 rounded-md border ${
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
                      <span className="text-xs font-semibold px-2 py-1 rounded-md bg-purple-500/10 text-purple-400 border border-purple-500/30 flex items-center space-x-1">
                        <Sparkles className="w-3 h-3" />
                        <span>Featured</span>
                      </span>
                    )}
                    {job.urgent && (
                      <span className="text-xs font-semibold px-2 py-1 rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/30">
                        Urgent Hiring
                      </span>
                    )}
                  </div>

                  {/* Bookmark Toggle */}
                  <button
                    onClick={() => onToggleSaveJob(job.id)}
                    className={`p-2 rounded-xl transition-all ${
                      isSaved
                        ? 'bg-emerald-500 text-slate-950 font-bold'
                        : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700'
                    }`}
                    title={isSaved ? 'Remove from Saved Jobs' : 'Save Job'}
                  >
                    <Bookmark className="w-4 h-4 fill-current" />
                  </button>
                </div>

                {/* Job Title & Company */}
                <h3
                  onClick={() => onSelectJob(job)}
                  className="text-lg font-bold text-white group-hover:text-emerald-400 transition-colors cursor-pointer leading-snug line-clamp-2 mb-1"
                >
                  {cleanTitle}
                </h3>

                <div className="flex items-center space-x-2 text-slate-400 text-xs font-medium mb-3">
                  <Building2 className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-slate-300 font-semibold">{cleanCompany}</span>
                  <span>•</span>
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  <span>{job.postedAt}</span>
                </div>

                {/* Location Badges (Province, City, District) */}
                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/60 mb-4 space-y-1">
                  <div className="flex items-center space-x-1.5 text-xs text-slate-300 font-medium">
                    {job.region === 'Pakistan' ? (
                      <span className="text-emerald-400 font-bold">🇵🇰 Pakistan</span>
                    ) : job.region === 'US' ? (
                      <span>🇺🇸 United States</span>
                    ) : job.region === 'UK' ? (
                      <span>🇬🇧 United Kingdom</span>
                    ) : job.region === 'UAE' ? (
                      <span className="text-amber-300 font-semibold">🇦🇪 United Arab Emirates</span>
                    ) : job.region === 'Saudi Arabia' ? (
                      <span className="text-emerald-300 font-semibold">🇸🇦 Saudi Arabia</span>
                    ) : job.region === 'Canada' ? (
                      <span>🇨🇦 Canada</span>
                    ) : job.region === 'Europe' ? (
                      <span>🇪🇺 Europe</span>
                    ) : job.region === 'Australia' ? (
                      <span>🇦🇺 Australia</span>
                    ) : (
                      <span className="text-indigo-400 font-semibold">🌐 Global Remote</span>
                    )}

                    {job.province && (
                      <span className="text-slate-400">• {job.province}</span>
                    )}
                  </div>

                  {/* Detailed City/District Badges */}
                  {(job.city || job.district) && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      {job.city && (
                        <span className="inline-flex items-center text-[11px] font-semibold bg-emerald-500/15 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/20">
                          <MapPin className="w-3 h-3 mr-1 text-emerald-400" />
                          {job.city}
                        </span>
                      )}
                      {job.district && (
                        <span className="inline-flex items-center text-[11px] font-semibold bg-teal-500/15 text-teal-300 px-2 py-0.5 rounded border border-teal-500/20">
                          District: {job.district}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {cleanTags.slice(0, 4).map((tag, i) => (
                    <span
                      key={i}
                      className="text-[11px] font-medium bg-slate-800/80 text-slate-300 px-2 py-0.5 rounded border border-slate-700/60"
                    >
                      {tag}
                    </span>
                  ))}
                  {cleanTags.length > 4 && (
                    <span className="text-[10px] text-slate-500 self-center">
                      +{cleanTags.length - 4} more
                    </span>
                  )}
                </div>
              </div>

              {/* Salary & Action Buttons */}
              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-500 block">
                    Salary Range
                  </span>
                  <span className="text-sm font-bold text-emerald-400">
                    {job.salary}
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => onSelectJob(job)}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold text-xs border border-slate-700/60 transition-all cursor-pointer shadow-sm active:scale-95"
                    title="View Full Job Details"
                  >
                    Details
                  </button>

                  <button
                    onClick={() => onApplyClick(job)}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-extrabold text-xs shadow-md shadow-emerald-500/20 flex items-center space-x-1.5 active:scale-95 transition-all cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5 text-slate-950" />
                    <span>Apply Now</span>
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
