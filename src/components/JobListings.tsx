import React, { useEffect, useState } from 'react';
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
  RefreshCw,
  Megaphone,
  ArrowRight
} from 'lucide-react';
import { Job, HomepagePrioritySlotConfig } from '../types/job';
import { Advertisement, FeedInlineAdSettings, BannerDimensionSettings, FeedCardAppearanceSettings, PlacementRotationConfig, isAdCurrentlyRunning } from '../types/ad';
import { getRotatedItems } from '../utils/adRotation';
import { sanitizeJobTitle, sanitizeJobCompanyName, sanitizeJobTags } from '../utils/jobSanitizer';
import { InlineFeedAd } from './ads/InlineFeedAd';

import { JobCardDesignConfig, JOB_CARD_ACCENT_STYLES, getJobCardAccentColor } from '../types/landing';


const parseJobCardDate = (value?: string, endOfDay = false): Date | null => {
  if (!value || typeof value !== 'string') return null;
  const clean = value.trim();
  if (!clean) return null;
  const dmy = clean.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})$/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]) - 1;
    const year = Number(dmy[3]);
    const parsed = new Date(year, month, day, endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0);
    if (parsed.getFullYear() === year && parsed.getMonth() === month && parsed.getDate() === day) return parsed;
    return null;
  }
  const dateOnly = clean.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    const year = Number(dateOnly[1]);
    const month = Number(dateOnly[2]) - 1;
    const day = Number(dateOnly[3]);
    const parsed = new Date(year, month, day, endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0);
    if (parsed.getFullYear() !== year || parsed.getMonth() !== month || parsed.getDate() !== day) return null;
    return parsed;
  }
  const parsed = new Date(clean);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatJobCardDate = (value?: string): string => {
  const date = parseJobCardDate(value);
  return date ? new Intl.DateTimeFormat('en-PK', { day: 'numeric', month: 'long', year: 'numeric' }).format(date) : '';
};

const getRelativeJobTime = (value: string | undefined, now: number): string => {
  const date = parseJobCardDate(value);
  if (!date) return '';
  const elapsed = now - date.getTime();
  if (elapsed < 0) return '';
  const diff = elapsed;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`;
  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? '' : 's'} ago`;
};

const getDeadlineRemaining = (value: string | undefined, now: number): string => {
  const date = parseJobCardDate(value, true);
  if (!date) return '';
  const remaining = date.getTime() - now;
  if (remaining <= 0) return 'Deadline passed';
  const totalHours = Math.floor(remaining / 3600000);
  const days = Math.floor(totalHours / 24);
  if (days > 0) return `${days} day${days === 1 ? '' : 's'} left`;
  const hours = totalHours;
  if (hours > 0) return `${hours} hour${hours === 1 ? '' : 's'} left`;
  const minutes = Math.max(1, Math.floor(remaining / 60000));
  return `${minutes} minute${minutes === 1 ? '' : 's'} left`;
};

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
  jobCardDesign?: JobCardDesignConfig;
  feedRotationSettings?: PlacementRotationConfig;
  homepagePrioritySlotConfig?: HomepagePrioritySlotConfig;
  isLoading?: boolean;
  showAdOpportunity?: boolean;
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
  onNavigateTab,
  jobCardDesign,
  feedRotationSettings,
  homepagePrioritySlotConfig,
  isLoading = false,
  showAdOpportunity = true
}) => {
  // Local state fallback if not controlled from parent
  const [internalPage, setInternalPage] = useState<number>(1);
  const [internalPostsPerPage, setInternalPostsPerPage] = useState<number>(10);
  const [jumpPageInput, setJumpPageInput] = useState<string>('');
  const [clockNow, setClockNow] = useState<number>(() => Date.now());
  const [feedRotationTick, setFeedRotationTick] = useState<number>(0);

  useEffect(() => {
    const timer = window.setInterval(() => setClockNow(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  const feedTimedEnabled = feedRotationSettings?.enabled !== false && feedRotationSettings?.autoRotateTimed === true;
  const feedIntervalMs = Math.max(2, Math.min(120, Number(feedRotationSettings?.intervalSeconds) || 8)) * 1000;

  useEffect(() => {
    if (!feedTimedEnabled) return;
    const timer = window.setInterval(() => {
      setFeedRotationTick((prev) => prev + 1);
    }, feedIntervalMs);
    return () => window.clearInterval(timer);
  }, [feedTimedEnabled, feedIntervalMs]);

  const currentPage = controlledPage !== undefined ? controlledPage : internalPage;
  const postsPerPage = controlledPostsPerPage !== undefined ? controlledPostsPerPage : internalPostsPerPage;

  // STEP66-B.2: Default Design configuration if missing
  const design: JobCardDesignConfig = jobCardDesign || {
    layout: 'default',
    theme: { accentColor: 'emerald', borderRadius: 'xl', cardBgPreset: 'slate', density: 'normal' },
    visibility: {
      title: true, company: true, location: true, postedDate: true, description: true,
      tags: true, salary: true, jobType: true, govtBadge: true, featuredBadge: true,
      urgentBadge: true, newspaperBadge: true, pdfBadge: true, futureBadge: true,
      vipBadge: true, pinnedBadge: true, poster: true, relativePostedTime: true,
      exactPostedDate: true, deadlineDate: true, deadlineRemaining: true,
      duplicateOverrideBadge: true, saveButton: true,
      detailsButton: true, applyButton: true
    },
    labels: { saveButton: 'Save', detailsButton: 'Details', applyButton: 'Apply', cardHeading: '' },
    limits: { descriptionMaxWords: 25, maxTags: 4 }
  };

  const accentColor = getJobCardAccentColor(design.theme.accentColor);
  const accentStyles = JOB_CARD_ACCENT_STYLES[accentColor];

  // STEP66-B.1: Separate Priority Jobs and Standard Jobs (with within-tier rotation preserving strict tier hierarchy)
  const priorityList = React.useMemo(() => {
    const rawList = (Array.isArray(propPriorityJobs) && propPriorityJobs.length > 0)
      ? propPriorityJobs
      : jobs.filter(j =>
          j.priorityTier === 'vip_bundle' ||
          (j as any).activePriorityTier ||
          (j.isPinnedTop && j.featured && j.urgent)
        ).slice(0, 8);

    const resolveTier = (job: Job): 'vip' | 'pinned' | 'featured' | 'urgent' | 'future' => {
      const activeTier = (job as any).activePriorityTier;
      if (activeTier === 'vip' || activeTier === 'pinned' || activeTier === 'featured' || activeTier === 'urgent' || activeTier === 'future') {
        return activeTier;
      }
      if (job.priorityTier === 'vip_bundle') return 'vip';
      if (job.priorityTier === 'featured_top' || job.isPinnedTop) return 'pinned';
      if (job.priorityTier === 'featured' || job.featured) return 'featured';
      if (job.priorityTier === 'urgent' || job.urgent) return 'urgent';
      return 'future';
    };

    const grouped: Record<'vip' | 'pinned' | 'featured' | 'urgent' | 'future', Job[]> = {
      vip: [],
      pinned: [],
      featured: [],
      urgent: [],
      future: []
    };

    for (const j of rawList) {
      grouped[resolveTier(j)].push(j);
    }

    const orderKeys = ['vip', 'pinned', 'featured', 'urgent', 'future'] as const;
    return orderKeys.flatMap((tierKey) => {
      const mode = homepagePrioritySlotConfig?.[tierKey]?.rotateOrder || 'sequential';
      return getRotatedItems(grouped[tierKey], `priority_tier_${tierKey}`, mode);
    });
  }, [propPriorityJobs, jobs, homepagePrioritySlotConfig]);

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

    const postedDateCandidates = [job.postedAt, job.datePosted, job.createdAt];
    const postedTimeSource = postedDateCandidates.find((value) => !!value && !!parseJobCardDate(value)) || '';
    // Prefer a timestamp with a time component for accurate 'X minutes ago' labels.
    // Scraper records may expose the source date as datePosted, while some records
    // store postedAt as date-only; createdAt is the precise fallback when available.
    const relativeTimeSource =
      postedDateCandidates.find((value) => !!value && /T|\d{1,2}:\d{2}/.test(value) && !!parseJobCardDate(value)) ||
      [job.createdAt, job.postedAt, job.datePosted].find((value) => !!value && !!parseJobCardDate(value)) ||
      postedTimeSource;
    const relativePostedTime = getRelativeJobTime(relativeTimeSource, clockNow);
    const exactPostedDate = formatJobCardDate(postedTimeSource);
    const deadlineDisplayDate = formatJobCardDate(job.deadlineDate);
    const deadlineRemaining = getDeadlineRemaining(job.deadlineDate, clockNow);
    const posterLabel = job.sourceType === 'admin_created' || job.isAdminCreated
      ? 'Admin'
      : job.sourceType === 'scraped' || job.isScraped
        ? (job.scraperSourceName || 'Scraper source')
        : 'Employer';

    const activeTier = (job as any).activePriorityTier || (job.priorityTier === 'vip_bundle' ? 'vip' : (job.isPinnedTop || job.priorityTier === 'featured_top' ? 'pinned' : (job.featured || job.priorityTier === 'featured' ? 'featured' : (job.urgent ? 'urgent' : 'standard'))));

    let cardBgStyle = 'bg-slate-900/90 border border-slate-800/90 hover:border-emerald-500/50 hover:shadow-emerald-500/10';
    let tierBadgeText = '';
    let tierBadgeStyle = '';

    if (activeTier === 'vip' || job.priorityTier === 'vip_bundle') {
      cardBgStyle = 'bg-gradient-to-b from-amber-500/15 via-amber-950/20 to-slate-900 border-2 border-amber-400 shadow-lg shadow-amber-500/10 hover:border-amber-300';
      if (design.visibility.vipBadge !== false) {
        tierBadgeText = '👑 VIP ULTIMATE PLACEMENT';
        tierBadgeStyle = 'from-amber-500/30 via-amber-500/20 to-slate-900 border-amber-400/80 text-amber-300';
      }
    } else if (activeTier === 'pinned' || job.isPinnedTop || job.priorityTier === 'featured_top') {
      cardBgStyle = 'bg-gradient-to-b from-blue-500/15 via-blue-950/20 to-slate-900 border-2 border-blue-400 shadow-lg shadow-blue-500/10 hover:border-blue-300';
      if (design.visibility.pinnedBadge !== false) {
        tierBadgeText = '📌 PINNED TOP PLACEMENT';
        tierBadgeStyle = 'from-blue-500/30 via-blue-500/20 to-slate-900 border-blue-400/80 text-blue-300';
      }
    } else if (activeTier === 'featured' || job.featured || job.priorityTier === 'featured') {
      cardBgStyle = 'bg-gradient-to-b from-purple-500/15 via-purple-950/20 to-slate-900 border-2 border-purple-400 shadow-lg shadow-purple-500/10 hover:border-purple-300';
      if (design.visibility.featuredBadge !== false) {
        tierBadgeText = '⭐ FEATURED PLACEMENT';
        tierBadgeStyle = 'from-purple-500/30 via-purple-500/20 to-slate-900 border-purple-400/80 text-purple-300';
      }
    } else if (activeTier === 'urgent' || job.urgent) {
      cardBgStyle = 'bg-gradient-to-b from-rose-500/15 via-rose-950/20 to-slate-900 border-2 border-rose-400 shadow-lg shadow-rose-500/10 hover:border-rose-300';
      if (design.visibility.urgentBadge !== false) {
        tierBadgeText = '🔥 URGENT HIRING PLACEMENT';
        tierBadgeStyle = 'from-rose-500/30 via-rose-500/20 to-slate-900 border-rose-400/80 text-rose-300';
      }
    } else if (activeTier === 'future' || (isPriorityCard && job.isFutureJob)) {
      cardBgStyle = 'bg-gradient-to-b from-indigo-500/15 via-indigo-950/20 to-slate-900 border-2 border-indigo-400 shadow-lg shadow-indigo-500/10 hover:border-indigo-300';
      if (design.visibility.futureBadge !== false) {
        tierBadgeText = '🚀 ADVANCE INTAKE PLACEMENT';
        tierBadgeStyle = 'from-indigo-500/30 via-indigo-500/20 to-slate-900 border-indigo-400/80 text-indigo-300';
      }
    }

    // Apply design theme overrides
    const borderRadiusClass = design.theme.borderRadius === 'none' ? 'rounded-none' : design.theme.borderRadius === 'md' ? 'rounded-md' : design.theme.borderRadius === 'xl' ? 'rounded-xl' : 'rounded-3xl';
  const densityPadding = design.theme.density === 'compact' ? 'p-2 sm:p-3.5' : design.theme.density === 'spacious' ? 'p-4 sm:p-7' : 'p-2 sm:p-5';
    
    if (design.theme.cardBgPreset === 'glass') {
      cardBgStyle = `bg-slate-950/40 backdrop-blur-md border border-white/10 ${accentStyles.hoverBorder}`;
    } else if (design.theme.cardBgPreset === 'gradient' && !tierBadgeText) {
      cardBgStyle = `bg-gradient-to-br from-slate-900 via-slate-900 ${accentStyles.gradientEnd} border border-slate-800 ${accentStyles.hoverBorder}`;
    }

    const description = job.description || '';
    const words = description.split(' ');
    const shortDesc = words.slice(0, design.limits.descriptionMaxWords || 25).join(' ') + (words.length > (design.limits.descriptionMaxWords || 25) ? '...' : '');

    // DESIGN 2: COMPACT MODERN
    if (design.layout === 'compact' || design.layout === 'editorial') {
        return (
            <div
              key={job.id ? `${job.id}-${index}` : `job-${index}`}
              className={`group relative ${borderRadiusClass} ${densityPadding} shadow-xl transition-all duration-300 ${design.layout === 'editorial' ? 'flex flex-col lg:flex-row lg:items-center lg:gap-6' : 'flex flex-col justify-between'} ${cardBgStyle}`}
            >
               <div className={design.layout === 'editorial' ? 'min-w-0 flex-1 space-y-2' : 'space-y-2'}>
                    <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                            {design.visibility.title && (
                                <h3 
                                    onClick={() => onSelectJob(job)}
                                    className="text-sm sm:text-base font-bold text-white group-hover:text-emerald-400 transition-colors cursor-pointer leading-tight line-clamp-1"
                                >
                                    {cleanTitle}
                                </h3>
                            )}
                            {design.visibility.company && (
                                <div className="flex items-center space-x-1 mt-0.5">
                                    <span className="text-[10px] sm:text-xs text-slate-400 font-medium truncate">{cleanCompany}</span>
                                </div>
                            )}
                        </div>
                        {design.visibility.saveButton && (
                            <button
                                onClick={() => onToggleSaveJob(job.id)}
                                className={`p-1.5 rounded-lg transition-all shrink-0 cursor-pointer ${isSaved ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800/80 text-slate-400'}`}
                            >
                                <Bookmark className="w-3 h-3 fill-current" />
                            </button>
                        )}
                    </div>

                    <div className="flex flex-wrap gap-1 items-center">
                        {design.visibility.salary && (
                             <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">{job.salary}</span>
                        )}
                        {design.visibility.jobType && (
                             <span className="text-[10px] font-semibold text-slate-300 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">{job.jobType}</span>
                        )}
                        {design.visibility.location && job.city && (
                             <span className="text-[10px] font-medium text-slate-400 flex items-center gap-1">
                                 <MapPin className="w-2.5 h-2.5" />
                                 {job.city}
                             </span>
                        )}
                        {design.visibility.postedDate && (
                             <span className="text-[10px] font-medium text-slate-500 flex items-center gap-1">
                                 <Clock className="w-2.5 h-2.5" />
                                 {design.visibility.relativePostedTime !== false && relativePostedTime ? relativePostedTime : design.visibility.exactPostedDate !== false ? exactPostedDate : ''}
                             </span>
                        )}
                    </div>
                    {(design.visibility.poster !== false || design.visibility.relativePostedTime !== false || design.visibility.exactPostedDate !== false || design.visibility.deadlineDate !== false || design.visibility.deadlineRemaining !== false) && (
                      <div className="flex flex-wrap gap-x-2 gap-y-1 text-[9px] sm:text-[10px] text-slate-500">
                        {design.visibility.poster !== false && <span>Posted by: {posterLabel}</span>}
                        {design.visibility.postedDate === false && design.visibility.relativePostedTime !== false && relativePostedTime && <span>{relativePostedTime}</span>}
                        {design.visibility.postedDate === false && design.visibility.exactPostedDate !== false && exactPostedDate && <span>{exactPostedDate}</span>}
                        {design.visibility.deadlineDate !== false && deadlineDisplayDate && <span>Deadline: {deadlineDisplayDate}</span>}
                        {design.visibility.deadlineRemaining !== false && deadlineRemaining && <span className={deadlineRemaining === 'Deadline passed' ? 'text-rose-400' : 'text-amber-400'}>{deadlineRemaining}</span>}
                      </div>
                    )}

                    {/* Status Badges in Compact */}
                    <div className="flex flex-wrap gap-1">
                        {(design.visibility.vipBadge !== false) && (activeTier === 'vip' || job.priorityTier === 'vip_bundle') && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">VIP</span>
                        )}
                        {(design.visibility.pinnedBadge !== false) && (activeTier === 'pinned' || job.isPinnedTop || job.priorityTier === 'featured_top') && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/40">Pinned</span>
                        )}
                        {(design.visibility.featuredBadge !== false) && (activeTier === 'featured' || (job.featured && !job.isPinnedTop && job.priorityTier !== 'featured_top' && job.priorityTier !== 'vip_bundle') || job.priorityTier === 'featured') && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40">Featured</span>
                        )}
                        {design.visibility.duplicateOverrideBadge !== false && job.isDuplicateOverride && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/40">Override</span>
                        )}
                        {design.visibility.govtBadge && job.isGovtJob && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">Govt</span>
                        )}
                        {design.visibility.pdfBadge && job.isPdfScraped && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/35">PDF</span>
                        )}
                        {design.visibility.newspaperBadge && job.isNewspaperAd && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-300 border border-orange-500/40">News</span>
                        )}
                        {design.visibility.futureBadge && job.isFutureJob && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">Future</span>
                        )}
                    </div>

                    {design.visibility.description && description && (
                         <p className="text-[10px] sm:text-xs text-slate-400 line-clamp-2 leading-snug">
                             {shortDesc}
                         </p>
                    )}

                    {design.visibility.tags && cleanTags.length > 0 && (
                       <div className="flex flex-wrap gap-1">
                           {cleanTags.slice(0, design.limits.maxTags || 3).map((tag, idx) => (
                               <span key={idx} className="text-[9px] font-medium px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                                   {tag}
                               </span>
                           ))}
                       </div>
                    )}
               </div>

               <div className={design.layout === 'editorial' ? 'mt-3 flex items-center justify-between gap-2 border-t border-slate-800/50 pt-2 lg:mt-0 lg:min-w-[190px] lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0' : 'mt-3 flex items-center justify-between gap-2 border-t border-slate-800/50 pt-2'}>
                   <div className="flex items-center gap-2">
                        {design.visibility.urgentBadge && job.urgent && <Flame className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />}
                        {design.visibility.featuredBadge && job.featured && <Sparkles className="w-3.5 h-3.5 text-purple-400" />}
                   </div>
                   <div className="flex items-center gap-1.5">
                       {design.visibility.detailsButton && (
                            <button 
                                onClick={() => onSelectJob(job)}
                                className="px-2.5 py-1.5 rounded-lg bg-slate-800 text-white text-[10px] font-bold hover:bg-slate-700 transition-colors"
                            >
                                {design.labels.detailsButton || 'Details'}
                            </button>
                       )}
                       {design.visibility.applyButton && (
                            <button 
                                onClick={() => onApplyClick(job)}
                                className={`px-3 py-1.5 rounded-lg ${accentStyles.solidBg} text-slate-950 text-[10px] font-black ${accentStyles.solidHover} transition-colors`}
                            >
                                {design.labels.applyButton || 'Apply'}
                            </button>
                       )}
                   </div>
               </div>
            </div>
        );
    }

    // DESIGN 1: DEFAULT (RESTORED & ENHANCED)
    return (
      <div
        key={job.id ? `${job.id}-${index}` : `job-${index}`}
        className={`group relative ${borderRadiusClass} ${densityPadding} shadow-sm sm:shadow-xl transition-all duration-300 flex flex-col justify-between ${cardBgStyle}`}
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
              {design.visibility.futureBadge && job.isFutureJob && (
                <span className="text-[9px] sm:text-xs font-bold px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 flex items-center space-x-1">
                  <Calendar className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-cyan-400" />
                  <span>Future {job.futureIntakeDate ? `(${job.futureIntakeDate})` : ''}</span>
                </span>
              )}
              {design.visibility.pdfBadge && job.isPdfScraped && (
                <span className="text-[9px] sm:text-xs font-bold px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/35 flex items-center space-x-1">
                  <FileText className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-indigo-400" />
                  <span>PDF</span>
                </span>
              )}
              {design.visibility.newspaperBadge && job.isNewspaperAd && (
                <span className="text-[9px] sm:text-xs font-bold px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded bg-orange-500/20 text-orange-300 border border-orange-500/40 flex items-center space-x-1">
                  <FileText className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-orange-400" />
                  <span>Newspaper ({job.newspaperName})</span>
                </span>
              )}
              {design.visibility.duplicateOverrideBadge !== false && job.isDuplicateOverride && (
                <span className="text-[9px] sm:text-xs font-bold px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded bg-red-500/20 text-red-300 border border-red-500/40 flex items-center space-x-1">
                  <Shield className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-red-400" />
                  <span>Override: {job.duplicateOverrideNote || 'Active'}</span>
                </span>
              )}
              {design.visibility.govtBadge && job.isGovtJob && (
                <span className="text-[9px] sm:text-xs font-bold px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center space-x-1">
                  <Shield className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-400" />
                  <span>Govt {job.govtScale || ''}</span>
                </span>
              )}
              {design.visibility.jobType && (
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
              )}
              {design.visibility.featuredBadge && job.featured && (
                <span className="text-[9px] sm:text-xs font-bold px-1.5 sm:px-2 py-0.5 sm:py-1 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40 flex items-center space-x-1">
                  <Sparkles className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-purple-400" />
                  <span>Featured</span>
                </span>
              )}
              {design.visibility.urgentBadge && job.urgent && (
                <span className="text-[9px] sm:text-xs font-bold px-1.5 sm:px-2 py-0.5 sm:py-1 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center space-x-1">
                  <Flame className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-rose-400 fill-rose-400" />
                  <span>Urgent</span>
                </span>
              )}
            </div>
            {design.visibility.saveButton && (
                <button
                onClick={() => onToggleSaveJob(job.id)}
                className={`p-1 sm:p-2 rounded-lg sm:rounded-xl transition-all shrink-0 cursor-pointer ${
                    isSaved
                    ? `${accentStyles.solidBg} text-slate-950 font-bold`
                    : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700'
                }`}
                title={isSaved ? 'Remove from Saved Jobs' : 'Save Job'}
                >
                <Bookmark className="w-3 h-3 sm:w-4 sm:h-4 fill-current" />
                </button>
            )}
          </div>
          {design.visibility.title && (
            <h3
                onClick={() => onSelectJob(job)}
                className="text-xs sm:text-lg font-bold text-white group-hover:text-emerald-400 transition-colors cursor-pointer leading-tight sm:leading-snug line-clamp-1 sm:line-clamp-2 mb-1"
            >
                {cleanTitle}
            </h3>
          )}
          <div className="flex flex-wrap items-center gap-1.5 text-slate-400 text-xs font-medium mb-3">
            {design.visibility.company && (
                <div className="flex items-center space-x-1">
                    <Building2 className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-slate-300 font-semibold">{cleanCompany}</span>
                </div>
            )}
            {design.visibility.location && job.city && (
                <>
                <span>•</span>
                <div className="flex items-center space-x-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-500" />
                    <span>{job.city}{job.province ? `, ${job.province}` : ''}</span>
                </div>
                </>
            )}
            {design.visibility.postedDate && (
                <>
                <span>•</span>
                <div className="flex items-center space-x-1">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                <span>{design.visibility.relativePostedTime !== false && relativePostedTime ? relativePostedTime : design.visibility.exactPostedDate !== false ? exactPostedDate : ''}</span>
                </div>
                </>
            )}
          </div>
          {(design.visibility.poster !== false || design.visibility.relativePostedTime !== false || design.visibility.exactPostedDate !== false || design.visibility.deadlineDate !== false || design.visibility.deadlineRemaining !== false) && (
            <div className="flex flex-wrap gap-x-2 gap-y-1 text-[10px] text-slate-500 mb-2">
              {design.visibility.poster !== false && <span>Posted by: {posterLabel}</span>}
              {design.visibility.postedDate === false && design.visibility.relativePostedTime !== false && relativePostedTime && <span>{relativePostedTime}</span>}
              {design.visibility.postedDate === false && design.visibility.exactPostedDate !== false && exactPostedDate && <span>{exactPostedDate}</span>}
              {design.visibility.deadlineDate !== false && deadlineDisplayDate && <span>Deadline: {deadlineDisplayDate}</span>}
              {design.visibility.deadlineRemaining !== false && deadlineRemaining && <span className={deadlineRemaining === 'Deadline passed' ? 'text-rose-400' : 'text-amber-400'}>{deadlineRemaining}</span>}
            </div>
          )}
          {design.visibility.description && description && (
            <p className="text-xs text-slate-400 line-clamp-2 mb-3">
                {shortDesc}
            </p>
          )}
          {design.visibility.tags && cleanTags.length > 0 && (
             <div className="flex flex-wrap gap-1 mb-3">
                 {cleanTags.slice(0, design.limits.maxTags || 4).map((tag, idx) => (
                     <span key={idx} className={`text-[10px] font-medium px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700/50`}>
                         {tag}
                     </span>
                 ))}
             </div>
          )}
        </div>
        <div className="pt-1.5 sm:pt-3 border-t border-slate-800/80 flex items-center justify-between gap-1 sm:gap-2">
          <div className="min-w-0 pr-1">
            {design.visibility.salary && (
                <>
                    <span className="text-[8px] sm:text-[10px] uppercase font-semibold text-slate-500 block truncate">Salary</span>
                    <span className={`text-[11px] sm:text-sm font-bold ${accentStyles.text} truncate block`}>{job.salary}</span>
                </>
            )}
          </div>
          <div className="flex items-center space-x-1 sm:space-x-2 shrink-0">
            {design.visibility.detailsButton && (
                <button
                    onClick={() => onSelectJob(job)}
                    className="px-2 sm:px-3.5 py-1 sm:py-2 rounded-lg sm:rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold text-[10px] sm:text-xs border border-slate-700/60 transition-all cursor-pointer shadow-sm active:scale-95"
                >
                    {design.labels.detailsButton || 'Details'}
                </button>
            )}
            {design.visibility.applyButton && (
                <button
                    onClick={() => onApplyClick(job)}
                    className={`px-2.5 sm:px-4 py-1 sm:py-2 rounded-lg sm:rounded-xl bg-gradient-to-r ${accentStyles.gradientFrom} to-teal-600 ${accentStyles.gradientHoverFrom} hover:to-teal-500 text-slate-950 font-extrabold text-[10px] sm:text-xs shadow-md ${accentStyles.shadow} flex items-center space-x-1 sm:space-x-1.5 active:scale-95 transition-all cursor-pointer`}
                >
                    <Send className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 text-slate-950" />
                    <span>{design.labels.applyButton || 'Apply'}</span>
                </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (jobs.length === 0 && priorityList.length === 0) {
    if (isLoading) {
      return (
        <div className="space-y-4 my-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/80 border border-emerald-500/30 rounded-2xl p-4 sm:px-6 sm:py-4 shadow-xl">
            <div className="flex items-center space-x-3.5">
              <div className="relative flex items-center justify-center">
                <div className="w-6 h-6 rounded-full border-2 border-emerald-500/20 border-t-emerald-400 animate-spin" />
                <Sparkles className="w-3 h-3 text-emerald-400 absolute animate-pulse" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                  <span>Fetching Verified Vacancies...</span>
                </h4>
                <p className="text-xs text-slate-400">
                  Retrieving latest opportunities from the verified portal directory.
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2 self-start sm:self-auto">
              <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 animate-pulse">
                Live Syncing
              </span>
            </div>
          </div>

          {/* Skeleton Cards Grid */}
          <div className={`grid grid-cols-1 ${design.layout === 'editorial' ? '' : 'md:grid-cols-2 lg:grid-cols-3'} gap-3 sm:gap-4`}>
            {[1, 2, 3, 4, 5, 6].map((idx) => (
              <div
                key={`job-skeleton-${idx}`}
                className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 sm:p-5 space-y-3.5 animate-pulse shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center space-x-3 min-w-0 flex-1">
                    <div className="w-11 h-11 rounded-xl bg-slate-800/90 shrink-0" />
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="h-4 w-3/4 bg-slate-800 rounded" />
                      <div className="h-3 w-1/2 bg-slate-800/60 rounded" />
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-slate-800/50 shrink-0" />
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <div className="h-5 w-16 bg-slate-800/80 rounded-md" />
                  <div className="h-5 w-20 bg-slate-800/60 rounded-md" />
                  <div className="h-5 w-24 bg-slate-800/50 rounded-md" />
                </div>
                <div className="space-y-1.5 pt-1">
                  <div className="h-3 w-full bg-slate-800/50 rounded" />
                  <div className="h-3 w-4/5 bg-slate-800/40 rounded" />
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-slate-800/60">
                  <div className="h-4 w-24 bg-slate-800/60 rounded" />
                  <div className="h-8 w-20 bg-slate-800/80 rounded-xl" />
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

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
                {design.labels.cardHeading || 'Priority Featured Opportunities'}
              </h3>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold">
                {priorityList.length} Top Slots
              </span>
            </div>
          </div>
          <div className={`grid grid-cols-1 ${design.layout === 'editorial' ? '' : 'md:grid-cols-2 lg:grid-cols-3'} gap-3 sm:gap-4`}>
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
        {isLoading && (
          <div className="flex items-center space-x-1.5 text-[11px] text-amber-300 font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20">
            <div className="w-3 h-3 rounded-full border border-amber-400/40 border-t-amber-400 animate-spin" />
            <span className="hidden sm:inline">Updating in background...</span>
            <span className="sm:hidden">Updating...</span>
          </div>
        )}
      </div>

      {showAdOpportunity && <div className="flex justify-end -mt-1 mb-3">
        <button
          type="button"
          onClick={() => onAdClick?.({
            id: 'demo-your-ad-here',
            title: 'Your Ad Here — Inline Job Feed',
            type: 'banner',
            placement: 'feed-inline',
            targetPages: ['jobs'],
            status: 'active',
            approvalStatus: 'Approved',
            submittedByUserId: 'system-demo',
            submittedByUserName: 'Platform Promotion',
            headline: 'Your Ad Here',
            bodyText: 'Promote your company or campaign in the job feed.',
            badgeText: 'Advertise Here',
            ctaText: 'Choose Ad Package',
            ctaUrl: '',
            theme: 'amber',
            dismissable: false,
            impressions: 0,
            clicks: 0,
            createdAt: new Date().toISOString(),
            durationUnit: 'days',
            durationValue: 1
          } as Advertisement)}
          className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/60 bg-amber-400/10 px-2.5 py-1 text-[10px] font-black tracking-wide text-amber-200 shadow-[0_0_12px_rgba(251,191,36,0.12)] transition-all hover:border-amber-300 hover:bg-amber-400/20 hover:shadow-[0_0_18px_rgba(251,191,36,0.22)]"
          aria-label="Advertise in the job feed"
        >
          <Megaphone className="h-3 w-3" />
          Your Ad Here
          <ArrowRight className="h-3 w-3" />
        </button>
      </div>}

      {/* 3. STANDARD JOBS GRID */}
      <div className={`grid grid-cols-1 ${design.layout === 'editorial' ? '' : 'md:grid-cols-2 lg:grid-cols-3'} gap-2 sm:gap-4`}>
        {(() => {
          const eligibleAds = (ads || []).filter(
            (a) => a.placement === 'feed-inline' && isAdCurrentlyRunning(a)
          );
          const feedRotationEnabled = feedRotationSettings?.enabled !== false && feedInlineSettings?.rotateMultipleAds !== false;
          const seqMode = feedRotationEnabled ? (feedRotationSettings?.sequenceMode || 'sequential_per_visit') : 'fixed';
          const activeAdsList = getRotatedItems(eligibleAds, 'ad_feed-inline', seqMode);

          const configuredMaxAds = Number(feedInlineSettings?.maxAdsPerPage ?? 3);
          const maxAds = Number.isInteger(configuredMaxAds) ? Math.max(0, Math.min(10, configuredMaxAds)) : 3;
          const isCustomMode = feedInlineSettings?.insertionMode === 'custom_indices';
          const targetIndices = (safePage === 1 && feedInlineSettings?.page1SpecificIndices && feedInlineSettings.page1SpecificIndices.length > 0)
            ? feedInlineSettings.page1SpecificIndices
            : (feedInlineSettings?.customIndices || [2, 5, 8]);
          const configuredCadence = Number(feedInlineSettings?.repeatEveryNJobs ?? 3);
          const repeatCadence = Number.isInteger(configuredCadence) && configuredCadence > 0 ? Math.min(100, configuredCadence) : 3;

          let adInsertedCount = 0;

          return currentStandardJobs.map((job, index) => {
            const elements = [renderJobCard(job, index, false)];

            let shouldInsert = false;
            if (feedInlineSettings) {
              if (isCustomMode) {
                shouldInsert = targetIndices.includes(index + 1);
              } else {
                shouldInsert = (index + 1) % repeatCadence === 0;
              }
            } else {
              shouldInsert = (index + 1) % 3 === 0;
            }

            if (shouldInsert && adInsertedCount < maxAds && activeAdsList.length > 0) {
              const selectedAd = feedRotationEnabled
                ? activeAdsList[(adInsertedCount + feedRotationTick) % activeAdsList.length]
                : activeAdsList[0];

              elements.push(
                <InlineFeedAd 
                  key={`ad-${index}`} 
                  ad={selectedAd} 
                  onAdClick={onAdClick}
                  onNavigateTab={onNavigateTab}
                  bannerDimensions={bannerDimensions}
                  feedCardAppearance={feedCardAppearance}
                  feedInlineSettings={feedInlineSettings}
                />
              );
              adInsertedCount++;
            }

            return elements;
          });
        })()}
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
                        ? `${accentStyles.solidBg} text-slate-950 shadow-lg scale-105 font-black ring-2 ${accentStyles.ring}`
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
