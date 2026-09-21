import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Globe,
  Play,
  CheckCircle2,
  Clock,
  Shield,
  Settings,
  Search,
  Filter,
  RefreshCw,
  AlertTriangle,
  FileText,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Plus,
  Trash2,
  Check,
  X,
  Sliders,
  Copy,
  Download,
  Eye,
  Pause,
  Layers,
  ArrowRight,
  BarChart2,
  FileSpreadsheet,
  Folder,
  FolderPlus,
  Edit3,
  RotateCcw,
  CheckSquare,
  Square,
  Activity,
  AlertCircle,
  Calendar,
  MapPin
} from 'lucide-react';
import { Job, Region, ScrapedJobAuditEntry } from '../../types/job';
import { api } from '../../services/api';
import {
  calculateJobMissingFields,
  isScrapedJob,
  formatMissingFieldsNotice,
  hasMissingDescription,
  hasMissingLocation,
  hasMissingCompany,
  hasMissingSalary,
  hasMissingDeadline,
  hasMissingExperience,
  hasMissingJobType,
  isPdfDocumentJob,
  isOcrRequired,
  isOcrFailed,
  isNonJobRecord,
  isNeedsReviewRecord
} from '../../utils/jobValidation';
import { AdminQuickEditJobModal } from './AdminQuickEditJobModal';

export interface SourceGroup {
  id: string;
  name: string;
  description?: string;
  sourceIds: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ScraperSourceItem {
  id: string;
  name: string;
  url: string;
  category: string;
  region: Region;
  status: 'Active Scheduled' | 'Paused' | 'Error' | string;
  interval?: '15m' | '30m' | '1h' | '6h' | '24h' | '7d' | string;
  depth?: 'Light (10 Jobs)' | 'Standard (25 Jobs)' | 'Deep Crawl (50+ Jobs)' | string;
  keywords: string;
  autoApprove: boolean;
  lastRun?: string;
  scrapedCount?: number;
  healthStatus?: 'Healthy' | 'Jobs Found' | 'No Jobs' | '404' | '403' | 'Timeout' | 'Invalid PDF' | 'HTML' | 'Fetch Error' | 'Disabled' | 'healthy' | 'warning' | 'error' | string;
  lastHttpStatus?: number;
  lastSuccessfulScrapeAt?: string;
  lastErrorMessage?: string;
  groupId?: string;
  [key: string]: any;
}

export interface ScraperRunRecord {
  id?: string;
  runId: string;
  timestamp?: string;
  startedAt?: string;
  completedAt?: string;
  mode?: string;
  totalFound: number;
  approvedCount?: number;
  jobsAccepted?: number;
  pendingCount?: number;
  totalDuplicates?: number;
  totalFailedSources?: number;
  status: 'Completed' | 'Partial' | 'Failed';
  message?: string;
  sourceId?: string;
  sourceIds?: string[];
  executionTimeMs?: number;
  sourcesStats?: any[];
  discoveredJobs?: Array<{
    title: string;
    company: string;
    source: string;
    status: 'Approved' | 'Pending' | 'Duplicate' | 'Error';
    reason?: string;
  }>;
}

export const getRunResolvedStatus = (run: any): 'Completed' | 'Partial' | 'Failed' => {
  if (!run) return 'Completed';

  const rawStatus = typeof run.status === 'string' ? run.status.trim().toLowerCase() : '';
  const failedSources = Number(run.failedSources || run.totalFailedSources || 0);
  const targetsScraped = Number(run.targetsScraped || (Array.isArray(run.sourcesStats) ? run.sourcesStats.length : 0));
  const totalFound = Number(run.totalFound || 0);

  // 1. Explicit failed/error or all targets failed with 0 jobs found
  if (rawStatus === 'failed' || rawStatus === 'error' || rawStatus === 'stopped') {
    return 'Failed';
  }
  if (failedSources > 0 && targetsScraped > 0 && failedSources >= targetsScraped && totalFound === 0) {
    return 'Failed';
  }

  // 2. Explicit partial/warning or some targets failed
  if (rawStatus === 'partial' || rawStatus === 'warning') {
    return 'Partial';
  }
  if (failedSources > 0) {
    return 'Partial';
  }
  if (Array.isArray(run.sourcesStats) && run.sourcesStats.length > 0) {
    const failedStats = run.sourcesStats.filter((s: any) =>
      s.status === 'error' || s.status === 'Failed' || (s.errors && s.errors > 0) ||
      (s.healthStatus && ['error', '404', '403', 'Timeout', 'Fetch Error'].includes(s.healthStatus))
    ).length;
    if (failedStats > 0) {
      if (failedStats >= run.sourcesStats.length && totalFound === 0) {
        return 'Failed';
      }
      return 'Partial';
    }
  }

  // 3. Explicit completed or success
  if (rawStatus === 'completed' || rawStatus === 'success') {
    return 'Completed';
  }

  return 'Completed';
};

interface PaginationControlsProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  labelSingular?: string;
  labelPlural?: string;
}

const PaginationControls: React.FC<PaginationControlsProps> = ({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [25, 50, 100],
  labelSingular = 'item',
  labelPlural = 'items'
}) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);

  const startItem = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endItem = Math.min(safePage * pageSize, totalItems);

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (safePage > 3) pages.push('...');
      const start = Math.max(2, safePage - 1);
      const end = Math.min(totalPages - 1, safePage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (safePage < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-slate-950/70 border-t border-slate-800 text-xs text-slate-400">
      <div className="flex items-center space-x-3 w-full sm:w-auto justify-between sm:justify-start">
        <span>
          Showing <span className="text-white font-bold">{startItem}–{endItem}</span> of <span className="text-white font-bold">{totalItems}</span> {totalItems === 1 ? labelSingular : labelPlural}
        </span>
        {onPageSizeChange && (
          <div className="flex items-center space-x-1.5 pl-2 sm:border-l sm:border-slate-800">
            <span className="text-[11px] text-slate-500">Per page:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              aria-label="Items per page"
              className="px-2 py-1 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              {pageSizeOptions.map(size => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="flex items-center space-x-1 self-center sm:self-auto">
        <button
          type="button"
          disabled={safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
          className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all font-semibold cursor-pointer flex items-center space-x-1"
          aria-label="Previous page"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span>Prev</span>
        </button>

        <div className="hidden sm:flex items-center space-x-1">
          {getPageNumbers().map((p, idx) => {
            if (p === '...') {
              return <span key={`ellipsis-${idx}`} className="px-1 text-slate-600">…</span>;
            }
            const isCurr = p === safePage;
            return (
              <button
                key={`page-${p}`}
                type="button"
                onClick={() => onPageChange(Number(p))}
                className={`w-7 h-7 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  isCurr
                    ? 'bg-indigo-600 text-white shadow'
                    : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
                }`}
              >
                {p}
              </button>
            );
          })}
        </div>

        <span className="sm:hidden px-2 text-xs font-bold text-slate-300">
          {safePage} / {totalPages}
        </span>

        <button
          type="button"
          disabled={safePage >= totalPages}
          onClick={() => onPageChange(safePage + 1)}
          className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all font-semibold cursor-pointer flex items-center space-x-1"
          aria-label="Next page"
        >
          <span>Next</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

interface AutomatedScraperHubProps {
  scraperSources?: any[];
  setScraperSources?: React.Dispatch<React.SetStateAction<any[]>>;
  jobs: Job[];
  pendingJobs: Job[];
  onAddJob: (job: Job) => void;
  onBulkAddJobs?: (jobs: Job[]) => void;
  onReloadJobs?: () => Promise<void>;
  onApproveJob: (id: string) => void;
  onRejectJob: (id: string, reason?: string) => void;
  onOverrideDuplicatesToLive?: (jobsToOverride: Job[]) => void;
  scrapedAuditLogs?: ScrapedJobAuditEntry[];
  setScrapedAuditLogs?: React.Dispatch<React.SetStateAction<ScrapedJobAuditEntry[]>>;
  onOpenPdfParser?: (source?: any) => void;
  onOpenBatchIngestModal?: () => void;
}

export type ScraperStep = 'overview' | 'sources' | 'run' | 'history' | 'review' | 'settings';

export const AutomatedScraperHub: React.FC<AutomatedScraperHubProps> = ({
  scraperSources: propsSources,
  setScraperSources: propsSetSources,
  jobs,
  pendingJobs,
  onAddJob,
  onBulkAddJobs,
  onReloadJobs,
  onApproveJob,
  onRejectJob,
  onOverrideDuplicatesToLive,
  onOpenPdfParser,
  onOpenBatchIngestModal
}) => {
  // Navigation: Step 1 through Step 6
  const [activeStep, setActiveStep] = useState<ScraperStep>('overview');

  // Live Backend State (Strict MongoDB-backed data)
  const [liveSources, setLiveSources] = useState<ScraperSourceItem[]>([]);
  const [liveRuns, setLiveRuns] = useState<ScraperRunRecord[]>([]);
  const [schedulerStatus, setSchedulerStatus] = useState<any>(null);
  const [isLoadingLive, setIsLoadingLive] = useState(true);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Active' | 'Paused' | 'Error'>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [regionFilter, setRegionFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | '7days' | '30days'>('all');
  const [resultsTypeFilter, setResultsTypeFilter] = useState<'all' | 'Approved' | 'Pending' | 'Duplicate' | 'Error'>('all');
  const [reviewTypeFilter, setReviewTypeFilter] = useState<
    | 'all'
    | 'jobs'
    | 'non_jobs'
    | 'needs_review'
    | 'missing_description'
    | 'missing_location'
    | 'missing_company'
    | 'missing_salary'
    | 'missing_deadline'
    | 'missing_experience'
    | 'missing_job_type'
    | 'pdf_document'
    | 'ocr_required'
    | 'ocr_failed'
    | 'pending'
    | 'duplicate'
    | 'expired'
  >('all');

  // Step 1: Sources Table Pagination
  const [sourcesPage, setSourcesPage] = useState(1);
  const [sourcesPageSize, setSourcesPageSize] = useState(25);

  // Step 2: Source-by-Source Execution Results Pagination & Filters
  const [sourceStatsPage, setSourceStatsPage] = useState(1);
  const [sourceStatsPageSize, setSourceStatsPageSize] = useState(25);
  const [statsSearchQuery, setStatsSearchQuery] = useState('');
  const [statsStatusFilter, setStatsStatusFilter] = useState<'all' | 'jobs_found' | 'no_jobs' | 'error_failed'>('all');
  const [statsMinFound, setStatsMinFound] = useState<string>('');
  const [statsMaxFound, setStatsMaxFound] = useState<string>('');
  const [statsMinNew, setStatsMinNew] = useState<string>('');
  const [statsMaxNew, setStatsMaxNew] = useState<string>('');
  const [statsMinDup, setStatsMinDup] = useState<string>('');
  const [statsMaxDup, setStatsMaxDup] = useState<string>('');
  const [statsSortBy, setStatsSortBy] = useState<'found_desc' | 'found_asc' | 'new_desc' | 'dup_desc' | 'name_asc' | 'name_desc'>('found_desc');

  // Step 4: Scraper History Pagination & Filters
  const [runsPage, setRunsPage] = useState(1);
  const [runsPageSize, setRunsPageSize] = useState(25);
  const [runStatusFilter, setRunStatusFilter] = useState<'all' | 'Completed' | 'Partial' | 'Failed'>('all');
  const [runMinFound, setRunMinFound] = useState<string>('');
  const [runMaxFound, setRunMaxFound] = useState<string>('');
  const [runMinDup, setRunMinDup] = useState<string>('');
  const [runMaxDup, setRunMaxDup] = useState<string>('');
  const [runSortBy, setRunSortBy] = useState<'date_desc' | 'date_asc' | 'found_desc' | 'found_asc' | 'dup_desc' | 'dup_asc'>('date_desc');

  // Step 5: Duplicates & Review Queue Pagination
  const [reviewPage, setReviewPage] = useState(1);
  const [reviewPageSize, setReviewPageSize] = useState(25);

  // Results / Discovered Jobs Feed Pagination & Filters
  const [resultsPage, setResultsPage] = useState(1);
  const [resultsPageSize, setResultsPageSize] = useState(25);
  const [resultsSearchQuery, setResultsSearchQuery] = useState('');
  const [resultsSortBy, setResultsSortBy] = useState<'newest' | 'oldest' | 'title_asc' | 'title_desc'>('newest');

  // Multi-Selection State for Sources
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
  const [selectedReviewIds, setSelectedReviewIds] = useState<string[]>([]);

  // Execution State
  const [isScrapingActive, setIsScrapingActive] = useState(false);
  const [scrapeScanType, setScrapeScanType] = useState<'full' | 'quick'>('full');
  const [autoPublishTrusted, setAutoPublishTrusted] = useState(false);
  const [selectedSingleSourceId, setSelectedSingleSourceId] = useState('');
  const [runProgressMessage, setRunProgressMessage] = useState('');
  const [scraperLogs, setScraperLogs] = useState<string[]>([]);
  const [isLogPaused, setIsLogPaused] = useState(false);

  // Direct Live URL Ingestion State
  const [directUrl, setDirectUrl] = useState('');
  const [directOrg, setDirectOrg] = useState('');
  const [directTitle, setDirectTitle] = useState('');
  const [isParsingDirectUrl, setIsParsingDirectUrl] = useState(false);

  // Batch URL Ingestion State
  const [batchUrlsInput, setBatchUrlsInput] = useState('');
  const [isBatchParsing, setIsBatchParsing] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });

  // PDF Gazette Ingestion State
  const [directPdfUrl, setDirectPdfUrl] = useState('');
  const [isParsingPdf, setIsParsingPdf] = useState(false);

  // Add Source Modal State
  const [isAddSourceOpen, setIsAddSourceOpen] = useState(false);
  const [newSourceName, setNewSourceName] = useState('');
  const [newSourceUrl, setNewSourceUrl] = useState('');
  const [newSourceCategory, setNewSourceCategory] = useState<ScraperSourceItem['category']>('Government Sector');
  const [newSourceRegion, setNewSourceRegion] = useState<Region>('Pakistan');
  const [newSourceProvince, setNewSourceProvince] = useState('');
  const [newSourceCity, setNewSourceCity] = useState('');
  const [newSourceDistrict, setNewSourceDistrict] = useState('');
  const [newSourceUseLocation, setNewSourceUseLocation] = useState(true);
  const [newSourceInterval, setNewSourceInterval] = useState<'15m' | '30m' | '1h' | '6h' | '24h' | '7d'>('24h');
  const [newSourceKeywords, setNewSourceKeywords] = useState('');
  const [newSourceAutoApprove, setNewSourceAutoApprove] = useState(false);

  // Edit Source Modal State
  const [isEditSourceOpen, setIsEditSourceOpen] = useState(false);
  const [editingSourceItem, setEditingSourceItem] = useState<ScraperSourceItem | null>(null);

  // Active Scraper Run Real-Time Engine State
  const [activeRunState, setActiveRunState] = useState<any>(null);
  const [isPausing, setIsPausing] = useState(false);
  const [isResuming, setIsResuming] = useState(false);
  const [isStopping, setIsStopping] = useState(false);

  // Expiry Settings State
  const [expiryOffsetDays, setExpiryOffsetDays] = useState<number>(1);
  const [isSavingExpiry, setIsSavingExpiry] = useState(false);
  const [isScanningExpiry, setIsScanningExpiry] = useState(false);

  // Bulk Location Update Modal State
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [targetLocationJobIds, setTargetLocationJobIds] = useState<string[]>([]);
  const [bulkRegion, setBulkRegion] = useState('Pakistan');
  const [bulkProvince, setBulkProvince] = useState('');
  const [bulkCity, setBulkCity] = useState('');
  const [bulkDistrict, setBulkDistrict] = useState('');
  const [isUpdatingLocation, setIsUpdatingLocation] = useState(false);

  // Inspect Run Modal State
  const [inspectingRun, setInspectingRun] = useState<ScraperRunRecord | null>(null);

  // Quick Edit Modal State for Review Queue
  const [quickEditingJob, setQuickEditingJob] = useState<Job | null>(null);
  const [bulkEditingJobs, setBulkEditingJobs] = useState<Job[]>([]);
  const [isQuickEditOpen, setIsQuickEditOpen] = useState(false);

  // Global Settings State
  const [globalInterval, setGlobalInterval] = useState('24h');
  const [globalDepth, setGlobalDepth] = useState('Standard (25 Jobs)');
  const [globalKeywords, setGlobalKeywords] = useState('jobs, careers, recruitment, vacancies, officers, lecturer');
  const [globalAutoApprove, setGlobalAutoApprove] = useState(false);
  const [globalSchedulerEnabled, setGlobalSchedulerEnabled] = useState(true);

  // Source Groups State
  const [sourceGroups, setSourceGroups] = useState<SourceGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('all');
  const [healthFilter, setHealthFilter] = useState<string>('all');
  const [copiedSourceId, setCopiedSourceId] = useState<string | null>(null);
  const [lastRunSourcesStats, setLastRunSourcesStats] = useState<any[]>([]);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [groupModalMode, setGroupModalMode] = useState<'create' | 'edit'>('create');
  const [editingGroup, setEditingGroup] = useState<SourceGroup | null>(null);
  const [groupNameInput, setGroupNameInput] = useState('');
  const [groupDescInput, setGroupDescInput] = useState('');

  // Pending Queue Real-Time MongoDB State (Step 5)
  const [localPendingJobs, setLocalPendingJobs] = useState<Job[]>(pendingJobs || []);
  const [isProcessingReview, setIsProcessingReview] = useState(false);
  const [isRefreshingReview, setIsRefreshingReview] = useState(false);

  const handleCopyUrl = (url: string, id: string) => {
    if (!url) return;
    navigator.clipboard.writeText(url);
    setCopiedSourceId(id);
    setTimeout(() => setCopiedSourceId(null), 2000);
    setStatusMessage({ text: `Copied URL to clipboard: ${url}`, type: 'info' });
  };

  const handleMoveSourceGroup = async (sourceId: string, targetGroupId: string | null) => {
    try {
      const res = await api.scraper.moveSourceToGroup(sourceId, targetGroupId);
      if (res?.success) {
        setStatusMessage({ text: 'Source group updated successfully.', type: 'success' });
        await fetchLiveScraperData();
      } else {
        setStatusMessage({ text: res?.message || 'Failed to move source group.', type: 'error' });
      }
    } catch (err: any) {
      setStatusMessage({ text: err.message || 'Error moving source group.', type: 'error' });
    }
  };

  const handleBulkMoveSourcesGroup = async (targetGroupId: string | null) => {
    if (selectedSourceIds.length === 0) return;
    try {
      const res = await api.scraper.bulkMoveSourcesToGroup(selectedSourceIds, targetGroupId);
      if (res?.success) {
        setStatusMessage({ text: `Moved ${selectedSourceIds.length} sources successfully.`, type: 'success' });
        setSelectedSourceIds([]);
        await fetchLiveScraperData();
      } else {
        setStatusMessage({ text: res?.message || 'Failed to move sources.', type: 'error' });
      }
    } catch (err: any) {
      setStatusMessage({ text: err.message || 'Error moving sources.', type: 'error' });
    }
  };

  // -------------------------------------------------------------
  // Data Fetching: Live MongoDB Scraper APIs
  // -------------------------------------------------------------
  const fetchPendingQueue = useCallback(async () => {
    try {
      const res = await api.jobs.getPendingQueue();
      const list = res?.pendingJobs || res?.jobs;
      if (res?.success && Array.isArray(list)) {
        setLocalPendingJobs(list);
      }
    } catch (err: any) {
      console.error('Error fetching pending queue:', err);
    }
    if (onReloadJobs) {
      await onReloadJobs();
    }
  }, [onReloadJobs]);

  const fetchLiveScraperData = useCallback(async () => {
    setIsLoadingLive(true);
    try {
      // 1. Fetch Sources
      const configsRes = await api.scraper.getConfigs();
      if (configsRes?.success && Array.isArray(configsRes.configs)) {
        setLiveSources(configsRes.configs);
        if (propsSetSources) {
          propsSetSources(configsRes.configs);
        }
      } else if (propsSources && propsSources.length > 0) {
        setLiveSources(propsSources);
      }

      // 2. Fetch Runs
      const runsRes = await api.scraper.getRuns();
      if (runsRes?.success && Array.isArray(runsRes.runs)) {
        setLiveRuns(runsRes.runs);
      } else {
        setLiveRuns([]);
      }

      // 3. Fetch Scheduler Status
      const statusRes = await api.scraper.getSchedulerStatus();
      if (statusRes?.success && statusRes.status) {
        setSchedulerStatus(statusRes.status);
      }

      // 4. Fetch Source Groups
      const groupsRes = await api.scraper.getGroups();
      if (groupsRes?.success && Array.isArray(groupsRes.groups)) {
        setSourceGroups(groupsRes.groups);
      }

      // 5. Fetch Pending Jobs Queue
      const pendingRes = await api.jobs.getPendingQueue();
      const pendingList = pendingRes?.pendingJobs || pendingRes?.jobs;
      if (pendingRes?.success && Array.isArray(pendingList)) {
        setLocalPendingJobs(pendingList);
      }

      // 6. Fetch Expiry Settings
      try {
        const expRes = await api.scraper.getExpirySettings();
        if (expRes?.success && expRes.settings) {
          setExpiryOffsetDays(expRes.settings.offsetDays ?? 1);
        }
      } catch (e) {}

      // 7. Fetch Active Run Status
      try {
        const actRes = await api.scraper.getActiveStatus();
        if (actRes?.success && actRes.status) {
          setActiveRunState(actRes.status);
          if (actRes.status.isActive) {
            setIsScrapingActive(true);
          }
        }
      } catch (e) {}
    } catch (err: any) {
      console.error('Error fetching live scraper data:', err);
      setStatusMessage({
        text: `Error connecting to scraper backend: ${err.message || 'Network error'}`,
        type: 'error'
      });
    } finally {
      setIsLoadingLive(false);
    }
  }, [propsSources, propsSetSources]);

  // Polling for Active Scraper Run Controls & Live Progress
  useEffect(() => {
    let timer: any = null;
    const pollActiveStatus = async () => {
      try {
        const res = await api.scraper.getActiveStatus();
        if (res?.success && res.status) {
          setActiveRunState(res.status);
          if (res.status.isActive) {
            setIsScrapingActive(true);
          } else if (res.status.status === 'Completed' || res.status.status === 'Stopped') {
            if (isScrapingActive && !res.status.isActive) {
              setIsScrapingActive(false);
              fetchLiveScraperData();
            }
          }
        }
      } catch (err) {}
    };

    pollActiveStatus();
    timer = setInterval(pollActiveStatus, 1500);

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isScrapingActive, fetchLiveScraperData]);

  useEffect(() => {
    if (pendingJobs && pendingJobs.length > 0) {
      setLocalPendingJobs(pendingJobs);
    }
  }, [pendingJobs]);

  useEffect(() => {
    fetchLiveScraperData();
  }, [fetchLiveScraperData]);

  const sourcesList = useMemo(() => {
    return liveSources.length > 0 ? liveSources : (propsSources || []);
  }, [liveSources, propsSources]);

  // Set default selected sources if empty
  useEffect(() => {
    if (selectedSourceIds.length === 0 && sourcesList.length > 0) {
      setSelectedSourceIds(sourcesList.map(s => s.id));
    }
  }, [sourcesList]);

  // -------------------------------------------------------------
  // Overview & Results Calculated Metrics (Real backend data only)
  // -------------------------------------------------------------
  const metrics = useMemo(() => {
    let totalFound = 0;
    let totalApproved = 0;
    let totalDuplicates = 0;
    let totalErrors = 0;

    liveRuns.forEach(r => {
      totalFound += r.totalFound || 0;
      totalApproved += r.approvedCount || r.jobsAccepted || 0;
      totalDuplicates += r.totalDuplicates || 0;
      if (r.status === 'Failed' || (r.totalFailedSources && r.totalFailedSources > 0)) {
        totalErrors += (r.totalFailedSources || 1);
      }
    });

    // Also include live jobs and pending count
    const approvedJobsCount = jobs.filter(j => j.status === 'Approved').length;
    const pendingJobsCount = pendingJobs.length;

    return {
      totalFound: totalFound > 0 ? totalFound : (approvedJobsCount + pendingJobsCount),
      approvedCount: totalApproved > 0 ? totalApproved : approvedJobsCount,
      pendingCount: pendingJobsCount,
      duplicatesCount: totalDuplicates,
      errorsCount: totalErrors,
      hasRuns: liveRuns.length > 0
    };
  }, [liveRuns, jobs, pendingJobs]);

  const [isTogglingScheduler, setIsTogglingScheduler] = useState(false);

  const handleStartScheduler = async () => {
    setIsTogglingScheduler(true);
    setStatusMessage({ text: 'Starting background scheduler...', type: 'info' });
    try {
      const res = await api.scraper.startScheduler();
      if (res?.success) {
        setStatusMessage({ text: 'Background scheduler started successfully.', type: 'success' });
        await fetchLiveScraperData();
      } else {
        setStatusMessage({ text: res?.message || 'Failed to start scheduler.', type: 'error' });
      }
    } catch (err: any) {
      setStatusMessage({ text: `Error starting scheduler: ${err?.message || 'Network error'}`, type: 'error' });
    } finally {
      setIsTogglingScheduler(false);
    }
  };

  const handleStopScheduler = async () => {
    setIsTogglingScheduler(true);
    setStatusMessage({ text: 'Stopping background scheduler & cancelling active batch...', type: 'info' });
    try {
      const res = await api.scraper.stopScheduler();
      if (res?.success) {
        setStatusMessage({ text: 'Background scheduler stopped successfully.', type: 'success' });
        await fetchLiveScraperData();
      } else {
        setStatusMessage({ text: res?.message || 'Failed to stop scheduler.', type: 'error' });
      }
    } catch (err: any) {
      setStatusMessage({ text: `Error stopping scheduler: ${err?.message || 'Network error'}`, type: 'error' });
    } finally {
      setIsTogglingScheduler(false);
    }
  };

  const [isTriggeringTick, setIsTriggeringTick] = useState(false);

  const handleTriggerTick = async () => {
    setIsTriggeringTick(true);
    setStatusMessage({ text: 'Triggering dynamic scheduler tick...', type: 'info' });
    try {
      const res = await api.scraper.schedulerTick();
      if (res?.success) {
        setStatusMessage({
          text: `Scheduler tick executed successfully! ${res.summary || ''}`,
          type: 'success'
        });
        await fetchLiveScraperData();
      } else {
        setStatusMessage({
          text: res?.message || 'Scheduler tick failed to execute.',
          type: 'error'
        });
      }
    } catch (err: any) {
      setStatusMessage({
        text: `Error executing scheduler tick: ${err?.message || 'Network error'}`,
        type: 'error'
      });
    } finally {
      setIsTriggeringTick(false);
    }
  };

  const lastRunDisplay = useMemo(() => {
    if (liveRuns.length > 0 && (liveRuns[0].completedAt || liveRuns[0].startedAt || liveRuns[0].timestamp)) {
      const ts = liveRuns[0].completedAt || liveRuns[0].startedAt || liveRuns[0].timestamp;
      try {
        return new Date(ts).toLocaleString();
      } catch {
        return ts;
      }
    }
    const runsWithDate = (schedulerStatus?.sources || [])
      .map((s: any) => s.lastRunAt)
      .filter(Boolean)
      .sort((a: string, b: string) => new Date(b).getTime() - new Date(a).getTime());
    if (runsWithDate.length > 0) {
      try {
        return new Date(runsWithDate[0]).toLocaleString();
      } catch {
        return runsWithDate[0];
      }
    }
    return 'Not run yet';
  }, [liveRuns, schedulerStatus]);

  const nextRunDisplay = useMemo(() => {
    const activeFuture = (schedulerStatus?.sources || [])
      .filter((s: any) => s.status === 'Active Scheduled' && s.nextRunAt)
      .map((s: any) => s.nextRunAt)
      .sort((a: string, b: string) => new Date(a).getTime() - new Date(b).getTime());
    if (activeFuture.length > 0) {
      try {
        return new Date(activeFuture[0]).toLocaleString();
      } catch {
        return activeFuture[0];
      }
    }
    return schedulerStatus?.isRunning ? 'Dynamic (checks every 2m)' : 'Scheduler paused';
  }, [schedulerStatus]);

  // -------------------------------------------------------------
  // Filtered Sources for Step 1
  // -------------------------------------------------------------
  const filteredSources = useMemo(() => {
    return sourcesList.filter(source => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = source.name?.toLowerCase().includes(q);
        const matchesUrl = source.url?.toLowerCase().includes(q);
        const matchesKeywords = source.keywords?.toLowerCase().includes(q);
        if (!matchesName && !matchesUrl && !matchesKeywords) return false;
      }

      if (statusFilter !== 'all') {
        if (statusFilter === 'Active' && source.status !== 'Active Scheduled') return false;
        if (statusFilter === 'Paused' && source.status !== 'Paused') return false;
        if (statusFilter === 'Error' && source.healthStatus !== 'error' && !['404', '403', 'Timeout', 'Invalid PDF', 'HTML', 'Fetch Error'].includes(source.healthStatus || '')) return false;
      }

      if (categoryFilter !== 'all' && source.category !== categoryFilter) return false;
      if (regionFilter !== 'all' && source.region !== regionFilter) return false;

      // Group filter
      if (selectedGroupId !== 'all') {
        const group = sourceGroups.find(g => g.id === selectedGroupId);
        if (!group || !group.sourceIds.includes(source.id)) return false;
      }

      // Granular Health filter
      if (healthFilter !== 'all') {
        const isPaused = source.status === 'Paused' || source.status === 'Disabled';
        const actualHealth = source.healthStatus || (isPaused ? 'Disabled' : (source.scrapedCount && source.scrapedCount > 0 ? 'Jobs Found' : 'Healthy'));
        if (healthFilter === 'Failed') {
          if (!['404', '403', 'Timeout', 'Invalid PDF', 'HTML', 'Fetch Error', 'error'].includes(actualHealth)) return false;
        } else if (actualHealth !== healthFilter) {
          return false;
        }
      }

      return true;
    });
  }, [sourcesList, searchQuery, statusFilter, categoryFilter, regionFilter, selectedGroupId, healthFilter, sourceGroups]);

  const paginatedSources = useMemo(() => {
    const start = (sourcesPage - 1) * sourcesPageSize;
    return filteredSources.slice(start, start + sourcesPageSize);
  }, [filteredSources, sourcesPage, sourcesPageSize]);

  // -------------------------------------------------------------
  // Filtered Runs for Step 4: History
  // -------------------------------------------------------------
  const filteredRuns = useMemo(() => {
    let result = liveRuns.filter(run => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const runIdMatch = (run.runId || run.id || '').toLowerCase().includes(q);
        const msgMatch = (run.message || '').toLowerCase().includes(q);
        if (!runIdMatch && !msgMatch) return false;
      }

      if (dateFilter !== 'all') {
        const runTime = run.startedAt || run.timestamp;
        if (runTime) {
          const runDate = new Date(runTime);
          const now = new Date();
          const diffHours = (now.getTime() - runDate.getTime()) / (1000 * 60 * 60);
          if (dateFilter === 'today' && diffHours > 24) return false;
          if (dateFilter === '7days' && diffHours > 24 * 7) return false;
          if (dateFilter === '30days' && diffHours > 24 * 30) return false;
        }
      }

      if (runStatusFilter !== 'all') {
        const resolved = getRunResolvedStatus(run);
        if (resolved !== runStatusFilter) {
          return false;
        }
      }

      if (runMinFound !== '') {
        const min = Number(runMinFound);
        if (!isNaN(min) && (run.totalFound || 0) < min) return false;
      }
      if (runMaxFound !== '') {
        const max = Number(runMaxFound);
        if (!isNaN(max) && (run.totalFound || 0) > max) return false;
      }

      if (runMinDup !== '') {
        const min = Number(runMinDup);
        if (!isNaN(min) && (run.totalDuplicates || 0) < min) return false;
      }
      if (runMaxDup !== '') {
        const max = Number(runMaxDup);
        if (!isNaN(max) && (run.totalDuplicates || 0) > max) return false;
      }

      return true;
    });

    result.sort((a, b) => {
      if (runSortBy === 'found_desc') return (b.totalFound || 0) - (a.totalFound || 0);
      if (runSortBy === 'found_asc') return (a.totalFound || 0) - (b.totalFound || 0);
      if (runSortBy === 'dup_desc') return (b.totalDuplicates || 0) - (a.totalDuplicates || 0);
      if (runSortBy === 'dup_asc') return (a.totalDuplicates || 0) - (b.totalDuplicates || 0);
      if (runSortBy === 'date_asc') {
        const tA = new Date(a.startedAt || a.timestamp || 0).getTime();
        const tB = new Date(b.startedAt || b.timestamp || 0).getTime();
        return tA - tB;
      }
      // default 'date_desc'
      const tA = new Date(a.startedAt || a.timestamp || 0).getTime();
      const tB = new Date(b.startedAt || b.timestamp || 0).getTime();
      return tB - tA;
    });

    return result;
  }, [liveRuns, searchQuery, dateFilter, runStatusFilter, runMinFound, runMaxFound, runMinDup, runMaxDup, runSortBy]);

  const paginatedRuns = useMemo(() => {
    const start = (runsPage - 1) * runsPageSize;
    return filteredRuns.slice(start, start + runsPageSize);
  }, [filteredRuns, runsPage, runsPageSize]);

  // -------------------------------------------------------------
  // Review Queue Items (Pending jobs, duplicate warnings, and expired jobs)
  // -------------------------------------------------------------
  const effectivePendingList = useMemo(() => {
    return localPendingJobs.length > 0 ? localPendingJobs : (pendingJobs || []);
  }, [localPendingJobs, pendingJobs]);

  const expiredJobsList = useMemo(() => {
    return (jobs || []).filter(j => j.status === 'Expired');
  }, [jobs]);

  const pendingOnlyCount = useMemo(() => {
    return effectivePendingList.filter(j => !((j as any).isDuplicate || (j as any).duplicateWarning || j.description?.toLowerCase().includes('duplicate'))).length;
  }, [effectivePendingList]);

  const duplicateCount = useMemo(() => {
    return effectivePendingList.filter(j => (j as any).isDuplicate || (j as any).duplicateWarning || j.description?.toLowerCase().includes('duplicate')).length;
  }, [effectivePendingList]);

  const expiredCount = useMemo(() => {
    return expiredJobsList.length;
  }, [expiredJobsList]);

  const nonJobsCount = useMemo(() => {
    return effectivePendingList.filter(j => isNonJobRecord(j)).length;
  }, [effectivePendingList]);

  const needsReviewCount = useMemo(() => {
    return effectivePendingList.filter(j => isNeedsReviewRecord(j)).length;
  }, [effectivePendingList]);

  const reviewCounts = useMemo(() => {
    const list = effectivePendingList;
    return {
      all: list.length,
      jobs: list.filter(j => !isNonJobRecord(j) && !isNeedsReviewRecord(j)).length,
      non_jobs: list.filter(j => isNonJobRecord(j)).length,
      needs_review: list.filter(j => isNeedsReviewRecord(j)).length,
      missing_description: list.filter(j => hasMissingDescription(j)).length,
      missing_location: list.filter(j => hasMissingLocation(j)).length,
      missing_company: list.filter(j => hasMissingCompany(j)).length,
      missing_salary: list.filter(j => hasMissingSalary(j)).length,
      missing_deadline: list.filter(j => hasMissingDeadline(j)).length,
      missing_experience: list.filter(j => hasMissingExperience(j)).length,
      missing_job_type: list.filter(j => hasMissingJobType(j)).length,
      pdf_document: list.filter(j => isPdfDocumentJob(j)).length,
      ocr_required: list.filter(j => isOcrRequired(j)).length,
      ocr_failed: list.filter(j => isOcrFailed(j)).length,
      duplicate: duplicateCount,
      expired: expiredCount
    };
  }, [effectivePendingList, duplicateCount, expiredCount]);

  const selectedDuplicateCount = useMemo(() => {
    return effectivePendingList.filter(j => selectedReviewIds.includes(j.id) && ((j as any).isDuplicate || (j as any).duplicateWarning || j.description?.toLowerCase().includes('duplicate'))).length;
  }, [effectivePendingList, selectedReviewIds]);

  const selectedExpiredCount = useMemo(() => {
    return expiredJobsList.filter(j => selectedReviewIds.includes(j.id)).length;
  }, [expiredJobsList, selectedReviewIds]);

  const selectedNonJobsCount = useMemo(() => {
    return effectivePendingList.filter(j => selectedReviewIds.includes(j.id) && isNonJobRecord(j)).length;
  }, [effectivePendingList, selectedReviewIds]);

  const reviewItems = useMemo(() => {
    if (reviewTypeFilter === 'expired') {
      return expiredJobsList.filter(job => {
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchTitle = job.title?.toLowerCase().includes(q);
          const matchCompany = job.company?.toLowerCase().includes(q);
          const matchPortal = ((job as any).sourcePortal || job.scraperSourceName || job.scrapedSourceDomain || '').toLowerCase().includes(q);
          if (!matchTitle && !matchCompany && !matchPortal) return false;
        }
        if (sourceFilter !== 'all') {
          const portal = (job as any).sourcePortal || job.scraperSourceName || job.scrapedSourceDomain || '';
          if (!portal.toLowerCase().includes(sourceFilter.toLowerCase())) return false;
        }
        return true;
      });
    }

    return effectivePendingList.filter(job => {
      const isDuplicate = (job as any).isDuplicate || (job as any).duplicateWarning ||
        job.description?.toLowerCase().includes('duplicate') ||
        ((job as any).confidenceScore && (job as any).confidenceScore < 60);

      // Filter tabs routing
      if (reviewTypeFilter === 'pending' && isDuplicate) return false;
      if (reviewTypeFilter === 'duplicate' && !isDuplicate) return false;
      if (reviewTypeFilter === 'jobs' && (isNonJobRecord(job) || isNeedsReviewRecord(job))) return false;
      if (reviewTypeFilter === 'non_jobs' && !isNonJobRecord(job)) return false;
      if (reviewTypeFilter === 'needs_review' && !isNeedsReviewRecord(job)) return false;
      if (reviewTypeFilter === 'missing_description' && !hasMissingDescription(job)) return false;
      if (reviewTypeFilter === 'missing_location' && !hasMissingLocation(job)) return false;
      if (reviewTypeFilter === 'missing_company' && !hasMissingCompany(job)) return false;
      if (reviewTypeFilter === 'missing_salary' && !hasMissingSalary(job)) return false;
      if (reviewTypeFilter === 'missing_deadline' && !hasMissingDeadline(job)) return false;
      if (reviewTypeFilter === 'missing_experience' && !hasMissingExperience(job)) return false;
      if (reviewTypeFilter === 'missing_job_type' && !hasMissingJobType(job)) return false;
      if (reviewTypeFilter === 'pdf_document' && !isPdfDocumentJob(job)) return false;
      if (reviewTypeFilter === 'ocr_required' && !isOcrRequired(job)) return false;
      if (reviewTypeFilter === 'ocr_failed' && !isOcrFailed(job)) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = job.title?.toLowerCase().includes(q);
        const matchCompany = job.company?.toLowerCase().includes(q);
        const matchPortal = ((job as any).sourcePortal || job.scraperSourceName || job.scrapedSourceDomain || '').toLowerCase().includes(q);
        if (!matchTitle && !matchCompany && !matchPortal) return false;
      }

      if (sourceFilter !== 'all') {
        const portal = (job as any).sourcePortal || job.scraperSourceName || job.scrapedSourceDomain || '';
        if (!portal.toLowerCase().includes(sourceFilter.toLowerCase())) return false;
      }

      return true;
    });
  }, [effectivePendingList, expiredJobsList, reviewTypeFilter, searchQuery, sourceFilter]);

  const paginatedReviewItems = useMemo(() => {
    const start = (reviewPage - 1) * reviewPageSize;
    return reviewItems.slice(start, start + reviewPageSize);
  }, [reviewItems, reviewPage, reviewPageSize]);

  // -------------------------------------------------------------
  // Source-by-Source Execution Results (Step 2 in Run Scraper)
  // -------------------------------------------------------------
  const activeSourcesStats = useMemo(() => {
    return lastRunSourcesStats.length > 0
      ? lastRunSourcesStats
      : (liveRuns[0]?.sourcesStats || []);
  }, [lastRunSourcesStats, liveRuns]);

  const filteredActiveSourcesStats = useMemo(() => {
    let result = [...activeSourcesStats];

    // Search source name / URL
    if (statsSearchQuery.trim()) {
      const q = statsSearchQuery.toLowerCase();
      result = result.filter((s: any) =>
        (s.sourceName || '').toLowerCase().includes(q) ||
        (s.sourceUrl || '').toLowerCase().includes(q)
      );
    }

    // Status: All / Jobs Found / No Jobs / Error / Failed
    if (statsStatusFilter === 'jobs_found') {
      result = result.filter((s: any) => (s.found || 0) > 0 && !s.failed);
    } else if (statsStatusFilter === 'no_jobs') {
      result = result.filter((s: any) => (s.found || 0) === 0 && !s.failed && !s.error);
    } else if (statsStatusFilter === 'error_failed') {
      result = result.filter((s: any) => s.failed || Boolean(s.error));
    }

    // Min / Max Jobs Found
    if (statsMinFound !== '') {
      const min = Number(statsMinFound);
      if (!isNaN(min)) result = result.filter((s: any) => (s.found || 0) >= min);
    }
    if (statsMaxFound !== '') {
      const max = Number(statsMaxFound);
      if (!isNaN(max)) result = result.filter((s: any) => (s.found || 0) <= max);
    }

    // Min / Max New Jobs
    if (statsMinNew !== '') {
      const min = Number(statsMinNew);
      if (!isNaN(min)) result = result.filter((s: any) => (s.newCount || 0) >= min);
    }
    if (statsMaxNew !== '') {
      const max = Number(statsMaxNew);
      if (!isNaN(max)) result = result.filter((s: any) => (s.newCount || 0) <= max);
    }

    // Min / Max Duplicates
    if (statsMinDup !== '') {
      const min = Number(statsMinDup);
      if (!isNaN(min)) result = result.filter((s: any) => (s.dupCount || 0) >= min);
    }
    if (statsMaxDup !== '') {
      const max = Number(statsMaxDup);
      if (!isNaN(max)) result = result.filter((s: any) => (s.dupCount || 0) <= max);
    }

    // Sort by
    result.sort((a: any, b: any) => {
      switch (statsSortBy) {
        case 'found_desc':
          return (b.found || 0) - (a.found || 0);
        case 'found_asc':
          return (a.found || 0) - (b.found || 0);
        case 'new_desc':
          return (b.newCount || 0) - (a.newCount || 0);
        case 'dup_desc':
          return (b.dupCount || 0) - (a.dupCount || 0);
        case 'name_asc':
          return (a.sourceName || '').localeCompare(b.sourceName || '');
        case 'name_desc':
          return (b.sourceName || '').localeCompare(a.sourceName || '');
        default:
          return 0;
      }
    });

    return result;
  }, [activeSourcesStats, statsSearchQuery, statsStatusFilter, statsMinFound, statsMaxFound, statsMinNew, statsMaxNew, statsMinDup, statsMaxDup, statsSortBy]);

  const paginatedActiveSourcesStats = useMemo(() => {
    const start = (sourceStatsPage - 1) * sourceStatsPageSize;
    return filteredActiveSourcesStats.slice(start, start + sourceStatsPageSize);
  }, [filteredActiveSourcesStats, sourceStatsPage, sourceStatsPageSize]);

  // -------------------------------------------------------------
  // Results Feed Items (Discovered Jobs from recent runs & live db)
  // -------------------------------------------------------------
  const resultsItems = useMemo(() => {
    let list: Array<{
      id: string;
      title: string;
      company: string;
      portal: string;
      date: string;
      status: 'Approved' | 'Pending' | 'Duplicate' | 'Error';
      reason?: string;
      rawJob?: Job;
    }> = [];

    // Add approved live jobs (without artificial slice limit)
    (jobs || []).forEach(j => {
      list.push({
        id: j.id,
        title: j.title || 'Untitled Vacancy',
        company: j.company || 'Unknown Organization',
        portal: (j as any).sourcePortal || j.scraperSourceName || j.scrapedSourceDomain || 'Official Portal',
        date: j.createdAt || new Date().toISOString(),
        status: 'Approved',
        rawJob: j
      });
    });

    // Add pending & duplicate jobs (without artificial slice limit)
    (pendingJobs || []).forEach(pj => {
      const isDup = (pj as any).isDuplicate || (pj as any).duplicateWarning || pj.description?.toLowerCase().includes('duplicate');
      list.push({
        id: pj.id,
        title: pj.title || 'Untitled Vacancy',
        company: pj.company || 'Unknown Organization',
        portal: (pj as any).sourcePortal || pj.scraperSourceName || pj.scrapedSourceDomain || 'Web Scraper',
        date: pj.createdAt || new Date().toISOString(),
        status: isDup ? 'Duplicate' : 'Pending',
        reason: isDup ? 'Similar vacancy found in database' : 'Awaiting admin approval',
        rawJob: pj
      });
    });

    // Filter results by resultsTypeFilter
    if (resultsTypeFilter !== 'all') {
      list = list.filter(item => item.status === resultsTypeFilter);
    }

    // Search title/company/source
    if (resultsSearchQuery.trim()) {
      const q = resultsSearchQuery.toLowerCase();
      list = list.filter(item =>
        item.title.toLowerCase().includes(q) ||
        item.company.toLowerCase().includes(q) ||
        item.portal.toLowerCase().includes(q)
      );
    }

    // Sort newest/oldest and title A-Z/Z-A
    list.sort((a, b) => {
      if (resultsSortBy === 'oldest') {
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      }
      if (resultsSortBy === 'title_asc') {
        return a.title.localeCompare(b.title);
      }
      if (resultsSortBy === 'title_desc') {
        return b.title.localeCompare(a.title);
      }
      // default 'newest'
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

    return list;
  }, [jobs, pendingJobs, resultsTypeFilter, resultsSearchQuery, resultsSortBy]);

  const paginatedResultsItems = useMemo(() => {
    const start = (resultsPage - 1) * resultsPageSize;
    return resultsItems.slice(start, start + resultsPageSize);
  }, [resultsItems, resultsPage, resultsPageSize]);

  // -------------------------------------------------------------
  // Reset pagination to page 1 whenever respective filters change
  // -------------------------------------------------------------
  useEffect(() => {
    setSourcesPage(1);
  }, [searchQuery, statusFilter, categoryFilter, regionFilter, selectedGroupId, healthFilter]);

  useEffect(() => {
    setSourceStatsPage(1);
  }, [statsSearchQuery, statsStatusFilter, statsMinFound, statsMaxFound, statsMinNew, statsMaxNew, statsMinDup, statsMaxDup, statsSortBy]);

  useEffect(() => {
    setRunsPage(1);
  }, [searchQuery, dateFilter, runStatusFilter, runMinFound, runMaxFound, runMinDup, runMaxDup, runSortBy]);

  useEffect(() => {
    setReviewPage(1);
  }, [searchQuery, reviewTypeFilter, sourceFilter]);

  useEffect(() => {
    setResultsPage(1);
  }, [resultsSearchQuery, resultsTypeFilter, resultsSortBy]);

  // -------------------------------------------------------------
  // Execution Handlers (Step 2: Run Scraper)
  // -------------------------------------------------------------
  const logMessage = (msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    if (!isLogPaused) {
      setScraperLogs(prev => [`[${timestamp}] ${msg}`, ...prev.slice(0, 200)]);
    }
  };

  // Run All Enabled Sources
  const handleRunAllSources = async () => {
    const enabledSources = sourcesList.filter(s => s.status === 'Active Scheduled');
    if (enabledSources.length === 0) {
      setStatusMessage({ text: 'No active sources found. Please enable sources in Step 1 first.', type: 'error' });
      return;
    }
    await executeScraperRun({
      targetSourceIds: enabledSources.map(s => s.id),
      label: `All Enabled Sources (${enabledSources.length})`
    });
  };

  // Run Selected Sources
  const handleRunSelectedSources = async () => {
    if (selectedSourceIds.length === 0) {
      setStatusMessage({ text: 'No sources selected. Check sources in Step 1 or select below.', type: 'error' });
      return;
    }
    await executeScraperRun({
      targetSourceIds: selectedSourceIds,
      label: `Selected Sources (${selectedSourceIds.length})`
    });
  };

  // Run Single Source Now
  const handleRunSingleSource = async (sourceId: string) => {
    if (!sourceId) return;
    const s = sourcesList.find(item => item.id === sourceId);
    await executeScraperRun({
      targetSourceIds: [sourceId],
      label: s?.name || 'Single Source'
    });
  };

  // Core execution function
  const executeScraperRun = async (options: { targetSourceIds: string[]; label: string }) => {
    if (isScrapingActive) return;
    setIsScrapingActive(true);
    setRunProgressMessage(`Starting crawler across ${options.label}...`);
    logMessage(`Started run for ${options.label}`);

    try {
      const payload: any = {
        mode: scrapeScanType === 'full' ? 'complete' : 'quick',
        autoPublishTrusted,
        sourceIds: options.targetSourceIds
      };

      const res = await api.scraper.run(payload);
      if (res?.success) {
        if (Array.isArray(res.sourcesStats)) {
          setLastRunSourcesStats(res.sourcesStats);
        }
        const found = res.totalFound || 0;
        const approved = res.jobsAccepted || res.approvedCount || 0;
        const duplicates = res.totalDuplicates || 0;

        logMessage(`Run completed successfully: ${found} found (${approved} approved, ${duplicates} duplicates)`);
        setStatusMessage({
          text: `Scraper finished! Discovered ${found} jobs (${approved} approved, ${duplicates} duplicates).`,
          type: 'success'
        });

        if (onReloadJobs) await onReloadJobs();
        await fetchLiveScraperData();
      } else {
        logMessage(`Run warning: ${res?.message || 'Check server logs'}`);
        setStatusMessage({ text: res?.message || 'Scraper execution finished with notices.', type: 'error' });
      }
    } catch (err: any) {
      logMessage(`Run error: ${err.message || 'Network error'}`);
      setStatusMessage({ text: `Scraper run error: ${err.message || 'Network error'}`, type: 'error' });
    } finally {
      setIsScrapingActive(false);
      setRunProgressMessage('');
    }
  };

  // Single Direct URL Scraper
  const handleDirectUrlScrape = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!directUrl.trim() || !directUrl.startsWith('http')) {
      setStatusMessage({ text: 'Please enter a valid web link starting with http:// or https://', type: 'error' });
      return;
    }

    setIsParsingDirectUrl(true);
    logMessage(`Starting direct extraction from link: ${directUrl}`);
    try {
      const res = await api.scraper.parseUrl({
        url: directUrl.trim(),
        organization: directOrg.trim() || undefined,
        title: directTitle.trim() || undefined
      });

      if (res?.success && Array.isArray(res.jobs)) {
        if (onBulkAddJobs) {
          onBulkAddJobs(res.jobs);
        } else {
          res.jobs.forEach(j => onAddJob(j));
        }

        logMessage(`Direct URL extraction completed: Found ${res.jobs.length} jobs.`);
        setStatusMessage({
          text: `Success! Extracted ${res.jobs.length} jobs directly from ${directUrl}.`,
          type: 'success'
        });
        setDirectUrl('');
        if (onReloadJobs) await onReloadJobs();
      } else {
        logMessage(`Direct URL warning: ${res?.message || 'No jobs found on link'}`);
        setStatusMessage({ text: res?.message || 'No active jobs could be identified on that web page.', type: 'error' });
      }
    } catch (err: any) {
      logMessage(`Direct URL error: ${err.message}`);
      setStatusMessage({ text: `Failed to scrape URL: ${err.message}`, type: 'error' });
    } finally {
      setIsParsingDirectUrl(false);
    }
  };

  // Batch URL Import Scraper
  const handleBatchUrlScrape = async () => {
    const urls = batchUrlsInput
      .split('\n')
      .map(u => u.trim())
      .filter(u => u.startsWith('http'));

    if (urls.length === 0) {
      setStatusMessage({ text: 'Please paste at least one valid web link (http:// or https://) in the box.', type: 'error' });
      return;
    }

    setIsBatchParsing(true);
    setBatchProgress({ current: 0, total: urls.length });
    logMessage(`Starting batch import for ${urls.length} web links...`);

    let totalHarvested = 0;
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      setBatchProgress({ current: i + 1, total: urls.length });
      logMessage(`Processing link [${i + 1}/${urls.length}]: ${url}`);

      try {
        const res = await api.scraper.parseUrl({ url });
        if (res?.success && Array.isArray(res.jobs) && res.jobs.length > 0) {
          totalHarvested += res.jobs.length;
          if (onBulkAddJobs) {
            onBulkAddJobs(res.jobs);
          } else {
            res.jobs.forEach(j => onAddJob(j));
          }
          logMessage(`✓ Found ${res.jobs.length} jobs from ${url}`);
        } else {
          logMessage(`⚠ 0 jobs found on ${url}`);
        }
      } catch (err: any) {
        logMessage(`✕ Error on ${url}: ${err.message}`);
      }
    }

    setIsBatchParsing(false);
    setBatchUrlsInput('');
    logMessage(`Batch import finished. Harvested total of ${totalHarvested} jobs.`);
    setStatusMessage({
      text: `Batch link scraping finished! Harvested ${totalHarvested} jobs from ${urls.length} links.`,
      type: 'success'
    });
    if (onReloadJobs) await onReloadJobs();
  };

  // Direct PDF Gazette Scraper
  const handlePdfScrape = async (urlToParse?: string) => {
    const target = urlToParse || directPdfUrl;
    if (!target || !target.trim()) {
      setStatusMessage({ text: 'Please enter a valid PDF advertisement link.', type: 'error' });
      return;
    }

    setIsParsingPdf(true);
    logMessage(`Parsing PDF circular: ${target}`);
    try {
      const res = await api.scraper.parseUrl({ url: target.trim() });
      if (res?.success && Array.isArray(res.jobs)) {
        if (onBulkAddJobs) {
          onBulkAddJobs(res.jobs);
        } else {
          res.jobs.forEach(j => onAddJob(j));
        }
        logMessage(`✓ Extracted ${res.jobs.length} vacancies from PDF.`);
        setStatusMessage({ text: `Successfully extracted ${res.jobs.length} vacancies from PDF!`, type: 'success' });
        setDirectPdfUrl('');
        if (onReloadJobs) await onReloadJobs();
      } else {
        setStatusMessage({ text: res?.message || 'Could not extract jobs from this PDF.', type: 'error' });
      }
    } catch (err: any) {
      setStatusMessage({ text: `PDF extraction error: ${err.message}`, type: 'error' });
    } finally {
      setIsParsingPdf(false);
    }
  };

  // -------------------------------------------------------------
  // Source Management Handlers (Step 1)
  // -------------------------------------------------------------
  const handleToggleSourceStatus = async (sourceId: string) => {
    const updated = sourcesList.map(s => {
      if (s.id === sourceId) {
        return {
          ...s,
          status: s.status === 'Active Scheduled' ? 'Paused' : 'Active Scheduled'
        } as ScraperSourceItem;
      }
      return s;
    });

    setLiveSources(updated);
    if (propsSetSources) propsSetSources(updated);
    await api.scraper.saveConfigs(updated);
    setStatusMessage({ text: 'Source status updated.', type: 'success' });
  };

  const handleToggleAutoApprove = async (sourceId: string) => {
    const updated = sourcesList.map(s => {
      if (s.id === sourceId) {
        return { ...s, autoApprove: !s.autoApprove } as ScraperSourceItem;
      }
      return s;
    });

    setLiveSources(updated);
    if (propsSetSources) propsSetSources(updated);
    await api.scraper.saveConfigs(updated);
    setStatusMessage({ text: 'Auto-approve setting updated for source.', type: 'success' });
  };

  const handleDeleteSource = async (sourceId: string) => {
    if (!confirm('Are you sure you want to delete this source?')) return;
    const updated = sourcesList.filter(s => s.id !== sourceId);
    setLiveSources(updated);
    if (propsSetSources) propsSetSources(updated);
    setSelectedSourceIds(prev => prev.filter(id => id !== sourceId));
    await api.scraper.saveConfigs(updated);
    setStatusMessage({ text: 'Source removed successfully.', type: 'success' });
  };

  const handleAddNewSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSourceName.trim() || !newSourceUrl.trim()) {
      setStatusMessage({ text: 'Please provide both source name and website URL.', type: 'error' });
      return;
    }

    const newSource: ScraperSourceItem = {
      id: `src-${Date.now()}`,
      name: newSourceName.trim(),
      url: newSourceUrl.trim(),
      category: newSourceCategory,
      region: newSourceRegion,
      province: newSourceProvince.trim() || undefined,
      city: newSourceCity.trim() || undefined,
      district: newSourceDistrict.trim() || undefined,
      useSourceLocation: newSourceUseLocation,
      status: 'Active Scheduled',
      interval: newSourceInterval,
      depth: 'Standard (25 Jobs)',
      keywords: newSourceKeywords.trim() || 'Software, Engineer, Officer, Manager',
      autoApprove: newSourceAutoApprove
    };

    const updated = [newSource, ...sourcesList];
    setLiveSources(updated);
    if (propsSetSources) propsSetSources(updated);
    await api.scraper.saveConfigs(updated);

    setNewSourceName('');
    setNewSourceUrl('');
    setNewSourceKeywords('');
    setNewSourceProvince('');
    setNewSourceCity('');
    setNewSourceDistrict('');
    setIsAddSourceOpen(false);
    setStatusMessage({ text: `Source "${newSource.name}" added successfully!`, type: 'success' });
  };

  const handleOpenEditSource = (source: ScraperSourceItem) => {
    setEditingSourceItem({ ...source });
    setIsEditSourceOpen(true);
  };

  const handleSaveEditSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSourceItem) return;

    const updated = sourcesList.map(s => s.id === editingSourceItem.id ? editingSourceItem : s);
    setLiveSources(updated);
    if (propsSetSources) propsSetSources(updated);
    await api.scraper.saveConfigs(updated);
    setIsEditSourceOpen(false);
    setEditingSourceItem(null);
    setStatusMessage({ text: `Source "${editingSourceItem.name}" updated successfully!`, type: 'success' });
  };

  // Run Controls: Pause / Resume / Stop
  const handlePauseActiveRun = async () => {
    setIsPausing(true);
    try {
      const res = await api.scraper.pause();
      if (res?.success) {
        setStatusMessage({ text: 'Scraper run paused. Click Resume to continue crawling.', type: 'info' });
        const st = await api.scraper.getActiveStatus();
        if (st?.status) setActiveRunState(st.status);
      }
    } catch (err: any) {
      setStatusMessage({ text: err.message || 'Error pausing run.', type: 'error' });
    } finally {
      setIsPausing(false);
    }
  };

  const handleResumeActiveRun = async () => {
    setIsResuming(true);
    try {
      const res = await api.scraper.resume();
      if (res?.success) {
        setStatusMessage({ text: 'Scraper run resumed.', type: 'success' });
        const st = await api.scraper.getActiveStatus();
        if (st?.status) setActiveRunState(st.status);
      }
    } catch (err: any) {
      setStatusMessage({ text: err.message || 'Error resuming run.', type: 'error' });
    } finally {
      setIsResuming(false);
    }
  };

  const handleStopActiveRun = async () => {
    if (!confirm('Are you sure you want to stop the active scraper run?')) return;
    setIsStopping(true);
    try {
      const res = await api.scraper.stop();
      if (res?.success) {
        setStatusMessage({ text: 'Scraper run stopped.', type: 'info' });
        setIsScrapingActive(false);
        const st = await api.scraper.getActiveStatus();
        if (st?.status) setActiveRunState(st.status);
        await fetchLiveScraperData();
      }
    } catch (err: any) {
      setStatusMessage({ text: err.message || 'Error stopping run.', type: 'error' });
    } finally {
      setIsStopping(false);
    }
  };

  const handleResetActiveRun = async () => {
    if (!confirm('Force reset scraper engine to Idle state? This clears any stuck or orphaned run.')) return;
    try {
      const res = await api.scraper.reset();
      if (res?.success) {
        setStatusMessage({ text: 'Scraper engine state has been reset to Idle.', type: 'info' });
        setIsScrapingActive(false);
        const st = await api.scraper.getActiveStatus();
        if (st?.status) setActiveRunState(st.status);
        await fetchLiveScraperData();
      }
    } catch (err: any) {
      setStatusMessage({ text: err.message || 'Error resetting scraper.', type: 'error' });
    }
  };

  // Expiry Settings & Controls
  const handleSaveExpiryOffset = async () => {
    setIsSavingExpiry(true);
    try {
      const res = await api.scraper.updateExpirySettings({ offsetDays: expiryOffsetDays });
      if (res?.success) {
        setStatusMessage({ text: `Portal expiry offset saved (+${expiryOffsetDays} days). Real application deadlines remain untouched.`, type: 'success' });
      } else {
        setStatusMessage({ text: res?.message || 'Failed to update expiry offset.', type: 'error' });
      }
    } catch (err: any) {
      setStatusMessage({ text: err.message || 'Error saving expiry offset.', type: 'error' });
    } finally {
      setIsSavingExpiry(false);
    }
  };

  const handleScanExpiryNow = async () => {
    setIsScanningExpiry(true);
    try {
      const res = await api.scraper.scanExpiry();
      if (res?.success) {
        setStatusMessage({ text: res.message || `Expiry scan completed. ${res.expiredCount} jobs updated to Expired.`, type: 'success' });
        if (onReloadJobs) await onReloadJobs();
      } else {
        setStatusMessage({ text: res?.message || 'Expiry scan encountered notices.', type: 'error' });
      }
    } catch (err: any) {
      setStatusMessage({ text: err.message || 'Error executing expiry scan.', type: 'error' });
    } finally {
      setIsScanningExpiry(false);
    }
  };

  // Restoring Expired Jobs
  const handleRestoreExpiredJob = async (jobId: string) => {
    try {
      const res = await api.jobs.restoreExpired(jobId);
      if (res?.success) {
        setStatusMessage({ text: 'Job restored to live status! Original application deadline preserved.', type: 'success' });
        if (onReloadJobs) await onReloadJobs();
      } else {
        setStatusMessage({ text: res?.message || 'Failed to restore job.', type: 'error' });
      }
    } catch (err: any) {
      setStatusMessage({ text: err.message || 'Error restoring job.', type: 'error' });
    }
  };

  const handleBulkRestoreExpiredJobs = async (ids: string[]) => {
    if (ids.length === 0) return;
    try {
      const res = await api.jobs.bulkRestoreExpired(ids);
      if (res?.success) {
        setStatusMessage({ text: `${res.count} jobs restored to live status. Real application deadlines preserved.`, type: 'success' });
        setSelectedReviewIds([]);
        if (onReloadJobs) await onReloadJobs();
      } else {
        setStatusMessage({ text: res?.message || 'Failed to bulk restore jobs.', type: 'error' });
      }
    } catch (err: any) {
      setStatusMessage({ text: err.message || 'Error bulk restoring jobs.', type: 'error' });
    }
  };

  const handlePermanentDeleteJob = async (jobId: string) => {
    if (!confirm('Permanently delete this job from the database? This cannot be undone.')) return;
    try {
      const res = await api.jobs.permanentDelete(jobId);
      if (res?.success) {
        setStatusMessage({ text: 'Job permanently deleted.', type: 'success' });
        if (onReloadJobs) await onReloadJobs();
      } else {
        setStatusMessage({ text: res?.message || 'Failed to delete job permanently.', type: 'error' });
      }
    } catch (err: any) {
      setStatusMessage({ text: err.message || 'Error permanently deleting job.', type: 'error' });
    }
  };

  const handleBulkPermanentDeleteJobs = async (ids: string[]) => {
    if (ids.length === 0) return;
    if (!confirm(`Permanently delete ${ids.length} jobs from the database? This cannot be undone.`)) return;
    try {
      let deleted = 0;
      for (const id of ids) {
        const res = await api.jobs.permanentDelete(id);
        if (res?.success) deleted++;
      }
      setStatusMessage({ text: `Permanently deleted ${deleted} jobs.`, type: 'success' });
      setSelectedReviewIds([]);
      if (onReloadJobs) await onReloadJobs();
    } catch (err: any) {
      setStatusMessage({ text: err.message || 'Error bulk deleting jobs.', type: 'error' });
    }
  };

  const handleExecuteBulkLocationUpdate = async () => {
    if (targetLocationJobIds.length === 0) return;
    setIsUpdatingLocation(true);
    try {
      const res = await api.jobs.bulkUpdateLocation(targetLocationJobIds, {
        region: bulkRegion,
        province: bulkProvince.trim() || undefined,
        city: bulkCity.trim() || undefined,
        district: bulkDistrict.trim() || undefined
      });
      if (res?.success) {
        setStatusMessage({ text: `Updated location for ${res.count} jobs.`, type: 'success' });
        setIsLocationModalOpen(false);
        setTargetLocationJobIds([]);
        if (onReloadJobs) await onReloadJobs();
      } else {
        setStatusMessage({ text: res?.message || 'Failed to update locations.', type: 'error' });
      }
    } catch (err: any) {
      setStatusMessage({ text: err.message || 'Error updating job locations.', type: 'error' });
    } finally {
      setIsUpdatingLocation(false);
    }
  };

  // Bulk actions for Step 1
  const handleBulkToggleStatus = async (enable: boolean) => {
    if (selectedSourceIds.length === 0) return;
    const updated = sourcesList.map(s => {
      if (selectedSourceIds.includes(s.id)) {
        return { ...s, status: enable ? 'Active Scheduled' : 'Paused' } as ScraperSourceItem;
      }
      return s;
    });
    setLiveSources(updated);
    if (propsSetSources) propsSetSources(updated);
    await api.scraper.saveConfigs(updated);
    setStatusMessage({ text: `${enable ? 'Enabled' : 'Paused'} ${selectedSourceIds.length} sources.`, type: 'success' });
  };

  const handleBulkSetAutoApprove = async (enable: boolean) => {
    if (selectedSourceIds.length === 0) return;
    const updated = sourcesList.map(s => {
      if (selectedSourceIds.includes(s.id)) {
        return { ...s, autoApprove: enable } as ScraperSourceItem;
      }
      return s;
    });
    setLiveSources(updated);
    if (propsSetSources) propsSetSources(updated);
    await api.scraper.saveConfigs(updated);
    setStatusMessage({ text: `Auto-approve turned ${enable ? 'ON' : 'OFF'} for ${selectedSourceIds.length} sources.`, type: 'success' });
  };

  // -------------------------------------------------------------
  // Source Group Management Handlers
  // -------------------------------------------------------------
  const fetchGroups = useCallback(async () => {
    try {
      const res = await api.scraper.getGroups();
      if (res?.success && Array.isArray(res.groups)) {
        setSourceGroups(res.groups);
      }
    } catch (err: any) {
      console.error('Error fetching source groups:', err);
    }
  }, []);

  const handleOpenCreateGroupModal = () => {
    setGroupModalMode('create');
    setEditingGroup(null);
    setGroupNameInput('');
    setGroupDescInput('');
    setIsGroupModalOpen(true);
  };

  const handleOpenEditGroupModal = (group: SourceGroup) => {
    setGroupModalMode('edit');
    setEditingGroup(group);
    setGroupNameInput(group.name);
    setGroupDescInput(group.description || '');
    setIsGroupModalOpen(true);
  };

  const handleCreateOrUpdateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupNameInput.trim()) {
      setStatusMessage({ text: 'Please enter a group name.', type: 'error' });
      return;
    }
    try {
      if (groupModalMode === 'create') {
        const res = await api.scraper.createGroup({
          name: groupNameInput.trim(),
          description: groupDescInput.trim(),
          sourceIds: selectedSourceIds
        });
        if (res?.success) {
          setStatusMessage({ text: `Group "${res.group.name}" created successfully!`, type: 'success' });
          await fetchGroups();
          setIsGroupModalOpen(false);
        } else {
          setStatusMessage({ text: res?.message || 'Failed to create group.', type: 'error' });
        }
      } else if (editingGroup) {
        const res = await api.scraper.updateGroup(editingGroup.id, {
          name: groupNameInput.trim(),
          description: groupDescInput.trim()
        });
        if (res?.success) {
          setStatusMessage({ text: `Group "${res.group.name}" updated successfully!`, type: 'success' });
          await fetchGroups();
          setIsGroupModalOpen(false);
        } else {
          setStatusMessage({ text: res?.message || 'Failed to update group.', type: 'error' });
        }
      }
    } catch (err: any) {
      setStatusMessage({ text: `Group error: ${err.message}`, type: 'error' });
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    const grp = sourceGroups.find(g => g.id === groupId);
    const grpName = grp?.name || 'this group';
    if (!confirm(`Are you sure you want to delete "${grpName}"? (The sources themselves will NOT be deleted).`)) return;
    try {
      const res = await api.scraper.deleteGroup(groupId);
      if (res?.success) {
        setStatusMessage({ text: `Group "${grpName}" deleted.`, type: 'success' });
        if (selectedGroupId === groupId) setSelectedGroupId('all');
        await fetchGroups();
      } else {
        setStatusMessage({ text: res?.message || 'Failed to delete group.', type: 'error' });
      }
    } catch (err: any) {
      setStatusMessage({ text: `Delete group error: ${err.message}`, type: 'error' });
    }
  };

  const handleAddSelectedToGroup = async (groupId: string) => {
    if (selectedSourceIds.length === 0) {
      setStatusMessage({ text: 'Please select one or more sources first.', type: 'info' });
      return;
    }
    try {
      const res = await api.scraper.addSourcesToGroup(groupId, selectedSourceIds);
      if (res?.success) {
        setStatusMessage({ text: `Added ${selectedSourceIds.length} sources to group.`, type: 'success' });
        await fetchGroups();
      } else {
        setStatusMessage({ text: res?.message || 'Failed to add sources to group.', type: 'error' });
      }
    } catch (err: any) {
      setStatusMessage({ text: `Add to group error: ${err.message}`, type: 'error' });
    }
  };

  const handleRemoveSelectedFromGroup = async (groupId: string) => {
    if (selectedSourceIds.length === 0) return;
    try {
      const res = await api.scraper.removeSourcesFromGroup(groupId, selectedSourceIds);
      if (res?.success) {
        setStatusMessage({ text: `Removed selected sources from group.`, type: 'success' });
        await fetchGroups();
      } else {
        setStatusMessage({ text: res?.message || 'Failed to remove sources.', type: 'error' });
      }
    } catch (err: any) {
      setStatusMessage({ text: `Remove from group error: ${err.message}`, type: 'error' });
    }
  };

  const handleSaveGroup = async (e?: React.FormEvent) => {
    if (e && e.preventDefault) e.preventDefault();
    return handleCreateOrUpdateGroup(e as any);
  };

  const handleAddSourcesToGroup = async (groupId: string, sourceIds: string[]) => {
    if (!sourceIds || sourceIds.length === 0) return;
    try {
      const res = await api.scraper.addSourcesToGroup(groupId, sourceIds);
      if (res?.success) {
        setStatusMessage({ text: `Added ${sourceIds.length} sources to group.`, type: 'success' });
        await fetchGroups();
      } else {
        setStatusMessage({ text: res?.message || 'Failed to add sources to group.', type: 'error' });
      }
    } catch (err: any) {
      setStatusMessage({ text: `Add to group error: ${err.message}`, type: 'error' });
    }
  };

  const handleRemoveSourcesFromGroup = async (groupId: string, sourceIds: string[]) => {
    if (!sourceIds || sourceIds.length === 0) return;
    try {
      const res = await api.scraper.removeSourcesFromGroup(groupId, sourceIds);
      if (res?.success) {
        setStatusMessage({ text: `Removed sources from group.`, type: 'success' });
        await fetchGroups();
      } else {
        setStatusMessage({ text: res?.message || 'Failed to remove sources.', type: 'error' });
      }
    } catch (err: any) {
      setStatusMessage({ text: `Remove from group error: ${err.message}`, type: 'error' });
    }
  };

  const handleRunGroup = async (groupId: string) => {
    if (isScrapingActive) return;
    const targetGroup = sourceGroups.find(g => g.id === groupId);
    if (!targetGroup) return;
    setIsScrapingActive(true);
    setRunProgressMessage(`Running group "${targetGroup.name}" (${targetGroup.sourceIds.length} sources)...`);
    logMessage(`Starting group run: ${targetGroup.name} (${targetGroup.sourceIds.length} sources)`);

    try {
      const res = await api.scraper.runGroup(groupId);
      if (res?.success) {
        if (Array.isArray(res.sourcesStats)) {
          setLastRunSourcesStats(res.sourcesStats);
        }
        setStatusMessage({
          text: `Group "${targetGroup.name}" scraped! Found ${res.totalFound || 0} jobs, ${res.duplicatesFound || 0} duplicates.`,
          type: 'success'
        });
        if (onReloadJobs) await onReloadJobs();
        await fetchLiveScraperData();
        await fetchPendingQueue();
      } else {
        setStatusMessage({ text: res?.message || 'Error running group scraper.', type: 'error' });
      }
    } catch (err: any) {
      setStatusMessage({ text: `Run group error: ${err.message}`, type: 'error' });
    } finally {
      setIsScrapingActive(false);
      setRunProgressMessage('');
    }
  };

  // -------------------------------------------------------------
  // Real Scraper Retry Handlers (Retry Selected / Failed / All Failed)
  // -------------------------------------------------------------
  const handleRetrySources = async (targetSourceIds?: string[], retryAllFailed?: boolean) => {
    if (isScrapingActive) return;
    setIsScrapingActive(true);
    const count = targetSourceIds?.length || 0;
    const label = retryAllFailed ? 'All Failed Sources' : `${count} Selected Source(s)`;
    setRunProgressMessage(`Retrying ${label} via real scraper engine...`);
    logMessage(`[RETRY] Launching real scraper engine for ${label}`);

    try {
      const res = await api.scraper.retrySources(targetSourceIds, retryAllFailed);
      if (res?.success) {
        if (Array.isArray(res.sourcesStats)) {
          setLastRunSourcesStats(res.sourcesStats);
        }
        logMessage(`[RETRY COMPLETED] Found ${res.totalFound || 0} jobs, ${res.duplicatesFound || 0} duplicates`);
        setStatusMessage({
          text: `Retry completed! Harvested ${res.totalFound || 0} jobs across ${res.retriedCount || count} retried sources.`,
          type: 'success'
        });
        if (onReloadJobs) await onReloadJobs();
        await fetchLiveScraperData();
        await fetchPendingQueue();
      } else {
        setStatusMessage({ text: res?.message || 'Retry completed with notice.', type: 'error' });
      }
    } catch (err: any) {
      setStatusMessage({ text: `Retry error: ${err.message || 'Network error'}`, type: 'error' });
    } finally {
      setIsScrapingActive(false);
      setRunProgressMessage('');
    }
  };

  // -------------------------------------------------------------
  // Step 5: Duplicates & Review Multi-Select MongoDB Bulk Actions
  // -------------------------------------------------------------
  const handleSelectAllPending = () => {
    const pendingOnlyIds = effectivePendingList
      .filter(j => !((j as any).isDuplicate || (j as any).duplicateWarning || j.description?.toLowerCase().includes('duplicate')))
      .map(j => j.id);
    setSelectedReviewIds(pendingOnlyIds);
    setStatusMessage({ text: `Selected all ${pendingOnlyIds.length} pending items.`, type: 'info' });
  };

  const handleSelectAllDuplicates = () => {
    const duplicateOnlyIds = effectivePendingList
      .filter(j => (j as any).isDuplicate || (j as any).duplicateWarning || j.description?.toLowerCase().includes('duplicate'))
      .map(j => j.id);
    setSelectedReviewIds(duplicateOnlyIds);
    setStatusMessage({ text: `Selected all ${duplicateOnlyIds.length} duplicate warning items.`, type: 'info' });
  };

  const handleSelectAllFiltered = () => {
    const fullFilteredIds = reviewItems.map(j => j.id);
    setSelectedReviewIds(fullFilteredIds);
    setStatusMessage({ text: `Selected all ${fullFilteredIds.length} items in the filtered review dataset across all pages.`, type: 'info' });
  };

  const handleDeselectAllReview = () => {
    setSelectedReviewIds([]);
  };

  const handleSaveQuickEditJob = async (updatedJob: Job) => {
    try {
      const res = await api.jobs.update(updatedJob.id, updatedJob);
      if (res?.success) {
        setStatusMessage({ text: `Updated job "${updatedJob.title}" successfully.`, type: 'success' });
        await fetchPendingQueue();
        if (onReloadJobs) await onReloadJobs();
      } else {
        setStatusMessage({ text: res?.message || 'Failed to update job.', type: 'error' });
      }
    } catch (err: any) {
      setStatusMessage({ text: `Update error: ${err.message}`, type: 'error' });
    }
  };

  const handleSaveAndApproveJob = async (updatedJob: Job) => {
    try {
      await api.jobs.update(updatedJob.id, updatedJob);
      const approveRes = await api.jobs.bulkApprove([updatedJob.id]);
      if (approveRes?.success) {
        if (approveRes.skippedMissingFieldsCount > 0) {
          const missing = calculateJobMissingFields(updatedJob);
          setStatusMessage({ text: `Cannot approve "${updatedJob.title}": Missing required fields (${missing.join(', ')}).`, type: 'error' });
        } else {
          setStatusMessage({ text: `Saved and published "${updatedJob.title}" directly to Live!`, type: 'success' });
          await fetchPendingQueue();
          if (onReloadJobs) await onReloadJobs();
        }
      } else {
        setStatusMessage({ text: approveRes?.message || 'Failed to approve job.', type: 'error' });
      }
    } catch (err: any) {
      setStatusMessage({ text: `Approve error: ${err.message}`, type: 'error' });
    }
  };

  const handleApproveSelected = async () => {
    if (selectedReviewIds.length === 0) return;

    const selectedJobsData = reviewItems.filter(j => selectedReviewIds.includes(j.id));
    const jobsWithMissing = selectedJobsData.filter(j => isScrapedJob(j) && calculateJobMissingFields(j).length > 0);
    if (jobsWithMissing.length > 0) {
      const summaryList = jobsWithMissing.map(j => `• "${j.title}" (Missing: ${calculateJobMissingFields(j).join(', ')})`).slice(0, 5).join('\n');
      const proceed = confirm(
        `Data Integrity Notice:\n${jobsWithMissing.length} of ${selectedReviewIds.length} selected scraped jobs have missing required factual fields:\n\n${summaryList}${jobsWithMissing.length > 5 ? `\n...and ${jobsWithMissing.length - 5} more` : ''}\n\nIncomplete scraped jobs will be safely skipped from live publishing until completed via Quick Edit.\n\nDo you want to proceed approving the valid jobs?`
      );
      if (!proceed) {
        return;
      }
    }

    setIsProcessingReview(true);
    try {
      const res = await api.jobs.bulkApprove(selectedReviewIds);
      if (res?.success) {
        const skippedMissing = res.skippedMissingFieldsCount || 0;
        const skippedDups = res.skippedDuplicatesCount || 0;

        if (res.failureCount > 0 && Array.isArray(res.errors) && res.errors.length > 0) {
          const errDetails = res.errors.map((e: any) => `${e.id}: ${e.error}`).join('; ');
          setStatusMessage({
            text: `Approved ${res.successCount} job(s), but ${res.failureCount} failed: ${errDetails}`,
            type: 'error'
          });
        } else {
          let msg = `Successfully approved ${res.successCount || 0} jobs to live listings!`;
          if (skippedMissing > 0) {
            msg += ` (${skippedMissing} skipped with missing required fields)`;
          }
          if (skippedDups > 0) {
            msg += ` (${skippedDups} duplicates skipped)`;
          }
          setStatusMessage({
            text: msg,
            type: skippedMissing > 0 ? 'info' : 'success'
          });
        }
        setSelectedReviewIds([]);
        await fetchPendingQueue();
        if (onReloadJobs) await onReloadJobs();
      } else {
        setStatusMessage({ text: res?.message || 'Failed to approve selected jobs.', type: 'error' });
      }
    } catch (err: any) {
      setStatusMessage({ text: `Approve error: ${err.message}`, type: 'error' });
    } finally {
      setIsProcessingReview(false);
    }
  };

  const handleRejectSelected = async () => {
    if (selectedReviewIds.length === 0) return;
    setIsProcessingReview(true);
    try {
      const res = await api.jobs.bulkReject(selectedReviewIds, 'Bulk admin rejection from Duplicates & Review');
      if (res?.success) {
        if (res.failureCount > 0 && Array.isArray(res.errors) && res.errors.length > 0) {
          const errDetails = res.errors.map((e: any) => `${e.id}: ${e.error}`).join('; ');
          setStatusMessage({
            text: `Rejected ${res.successCount} job(s), but ${res.failureCount} failed: ${errDetails}`,
            type: 'error'
          });
        } else {
          setStatusMessage({
            text: `Successfully rejected ${res.successCount || selectedReviewIds.length} jobs.`,
            type: 'info'
          });
        }
        setSelectedReviewIds([]);
        await fetchPendingQueue();
      } else {
        setStatusMessage({ text: res?.message || 'Failed to reject selected jobs.', type: 'error' });
      }
    } catch (err: any) {
      setStatusMessage({ text: `Reject error: ${err.message}`, type: 'error' });
    } finally {
      setIsProcessingReview(false);
    }
  };

  const handleDeleteSelectedDuplicates = async () => {
    if (selectedReviewIds.length === 0) return;
    setIsProcessingReview(true);
    try {
      const res = await api.jobs.bulkDeleteDuplicates(selectedReviewIds);
      if (res?.success) {
        if (res.failureCount > 0 && Array.isArray(res.errors) && res.errors.length > 0) {
          const errDetails = res.errors.map((e: any) => `${e.id}: ${e.error}`).join('; ');
          setStatusMessage({
            text: `Deleted ${res.successCount} duplicate(s), but ${res.failureCount} failed: ${errDetails}`,
            type: 'error'
          });
        } else {
          setStatusMessage({
            text: `Successfully deleted ${res.successCount || selectedReviewIds.length} duplicate jobs from MongoDB.`,
            type: 'success'
          });
        }
        setSelectedReviewIds([]);
        await fetchPendingQueue();
      } else {
        setStatusMessage({ text: res?.message || 'Failed to delete duplicate jobs.', type: 'error' });
      }
    } catch (err: any) {
      setStatusMessage({ text: `Delete duplicates error: ${err.message}`, type: 'error' });
    } finally {
      setIsProcessingReview(false);
    }
  };

  const handleKeepOriginalDeleteDuplicates = async (singleId?: string) => {
    const targetIds = singleId ? [singleId] : selectedReviewIds;
    if (targetIds.length === 0) return;
    setIsProcessingReview(true);
    try {
      const res = await api.jobs.keepOriginal(targetIds);
      if (res?.success) {
        if (res.failureCount > 0 && Array.isArray(res.errors) && res.errors.length > 0) {
          const errDetails = res.errors.map((e: any) => `${e.id}: ${e.error}`).join('; ');
          setStatusMessage({
            text: `Original kept. Purged ${res.successCount} duplicate(s), but ${res.failureCount} failed: ${errDetails}`,
            type: 'error'
          });
        } else {
          setStatusMessage({
            text: `Original active job(s) kept intact; removed ${res.successCount || targetIds.length} duplicate job(s) from pending queue.`,
            type: 'success'
          });
        }
        if (!singleId) setSelectedReviewIds([]);
        await fetchPendingQueue();
      } else {
        setStatusMessage({ text: res?.message || 'Failed to keep original jobs.', type: 'error' });
      }
    } catch (err: any) {
      setStatusMessage({ text: `Keep original error: ${err.message}`, type: 'error' });
    } finally {
      setIsProcessingReview(false);
    }
  };

  const handleOverwriteOriginalWithDuplicates = async (singleId?: string) => {
    const targetIds = singleId ? [singleId] : selectedReviewIds;
    if (targetIds.length === 0) return;
    setIsProcessingReview(true);
    try {
      const res = await api.jobs.overwriteOriginal(targetIds);
      if (res?.success) {
        if (res.failureCount > 0 && Array.isArray(res.errors) && res.errors.length > 0) {
          const errDetails = res.errors.map((e: any) => `${e.id}: ${e.error}`).join('; ');
          setStatusMessage({
            text: `Overwrote ${res.successCount} original job(s), but ${res.failureCount} failed: ${errDetails}`,
            type: 'error'
          });
        } else {
          setStatusMessage({
            text: `Successfully overwritten ${res.successCount || targetIds.length} active job(s) with new duplicate details. Duplicate removed from queue.`,
            type: 'success'
          });
        }
        if (!singleId) setSelectedReviewIds([]);
        await fetchPendingQueue();
      } else {
        setStatusMessage({ text: res?.message || 'Failed to overwrite original jobs.', type: 'error' });
      }
    } catch (err: any) {
      setStatusMessage({ text: `Overwrite original error: ${err.message}`, type: 'error' });
    } finally {
      setIsProcessingReview(false);
    }
  };

  const handleRefreshReviewQueue = async () => {
    setIsRefreshingReview(true);
    try {
      await fetchPendingQueue();
      setStatusMessage({ text: 'Pending review queue reloaded fresh from MongoDB.', type: 'info' });
    } catch (err: any) {
      setStatusMessage({ text: `Refresh error: ${err.message}`, type: 'error' });
    } finally {
      setIsRefreshingReview(false);
    }
  };

  const handleBulkMarkNonJob = async (singleId?: string) => {
    const targetIds = singleId ? [singleId] : selectedReviewIds;
    if (targetIds.length === 0) return;
    setIsProcessingReview(true);
    try {
      const res = await api.jobs.bulkMarkNonJob(targetIds, 'Classified as Non-Job by administrator');
      if (res?.success) {
        setStatusMessage({
          text: `Marked ${res.successCount || targetIds.length} record(s) as Non-Job. Retained in queue.`,
          type: 'info'
        });
        if (!singleId) setSelectedReviewIds([]);
        await fetchPendingQueue();
      } else {
        setStatusMessage({ text: res?.message || 'Failed to mark records as Non-Job.', type: 'error' });
      }
    } catch (err: any) {
      setStatusMessage({ text: `Non-Job classification error: ${err.message}`, type: 'error' });
    } finally {
      setIsProcessingReview(false);
    }
  };

  const handleConvertToJob = async (id: string) => {
    setIsProcessingReview(true);
    try {
      const res = await api.jobs.convertToJob(id);
      if (res?.success) {
        setStatusMessage({
          text: 'Record re-classified as standard Job successfully. Ready for review & publishing.',
          type: 'success'
        });
        await fetchPendingQueue();
      } else {
        setStatusMessage({ text: res?.message || 'Failed to convert record to job.', type: 'error' });
      }
    } catch (err: any) {
      setStatusMessage({ text: `Conversion error: ${err.message}`, type: 'error' });
    } finally {
      setIsProcessingReview(false);
    }
  };

  const handleBulkSaveJobs = async (updatedJobs: Job[]) => {
    setIsProcessingReview(true);
    try {
      const res = await api.jobs.bulkUpdate(updatedJobs);
      if (res?.success) {
        setStatusMessage({
          text: `Successfully bulk updated ${res.updatedCount || updatedJobs.length} job(s)!`,
          type: 'success'
        });
        await fetchPendingQueue();
        if (onReloadJobs) await onReloadJobs();
      } else {
        setStatusMessage({ text: res?.message || 'Failed to bulk update jobs.', type: 'error' });
      }
    } catch (err: any) {
      setStatusMessage({ text: `Bulk save error: ${err.message}`, type: 'error' });
    } finally {
      setIsProcessingReview(false);
    }
  };

  const handleOpenBulkQuickEdit = () => {
    const selectedJobsList = effectivePendingList.filter(j => selectedReviewIds.includes(j.id));
    if (selectedJobsList.length === 0) return;
    setBulkEditingJobs(selectedJobsList);
    setQuickEditingJob(selectedJobsList[0]);
    setIsQuickEditOpen(true);
  };

  // -------------------------------------------------------------
  // History CSV Export (Step 5)
  // -------------------------------------------------------------
  const handleExportRunsCSV = () => {
    if (filteredRuns.length === 0) {
      setStatusMessage({ text: 'No run records to export.', type: 'info' });
      return;
    }

    const headers = ['Run ID', 'Date', 'Total Found', 'Approved', 'Pending', 'Duplicates', 'Errors', 'Status', 'Message'];
    const rows = filteredRuns.map(r => [
      r.runId || r.id,
      r.startedAt || r.timestamp || '',
      r.totalFound || 0,
      r.approvedCount || r.jobsAccepted || 0,
      r.pendingCount || 0,
      r.totalDuplicates || 0,
      r.totalFailedSources || 0,
      getRunResolvedStatus(r),
      `"${(r.message || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `scraper_runs_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // -------------------------------------------------------------
  // Settings Handlers (Step 6)
  // -------------------------------------------------------------
  const handleSaveSettings = async () => {
    try {
      setStatusMessage({ text: 'Saving scraper settings...', type: 'info' });
      const updated = sourcesList.map(s => ({
        ...s,
        interval: globalInterval as any,
        depth: globalDepth as any,
        keywords: globalKeywords,
        autoApprove: globalAutoApprove
      }));

      await api.scraper.saveConfigs(updated);
      setLiveSources(updated);
      if (propsSetSources) propsSetSources(updated);
      setStatusMessage({ text: 'Settings saved successfully to MongoDB!', type: 'success' });
    } catch (err: any) {
      setStatusMessage({ text: `Failed to save settings: ${err.message}`, type: 'error' });
    }
  };

  // -------------------------------------------------------------
  // STEP DEFINITIONS (Ordered strictly Step 1 through Step 6)
  // -------------------------------------------------------------
  const STEPS: { id: ScraperStep; stepNumber: string; label: string; sub: string; icon: any; count?: number | null }[] = [
    { id: 'overview', stepNumber: '1. Overview', label: 'Overview', sub: 'Scheduler & Metrics', icon: BarChart2, count: null },
    { id: 'sources', stepNumber: '2. Sources', label: 'Sources', sub: 'All sources in 1 table', icon: Globe, count: sourcesList.length },
    { id: 'run', stepNumber: '3. Run Scraper', label: 'Run Scraper', sub: 'Run All / Selected / Now', icon: Play, count: null },
    { id: 'history', stepNumber: '4. History', label: 'History', sub: 'Real backend scraper runs', icon: Clock, count: liveRuns.length || null },
    { id: 'review', stepNumber: '5. Duplicates & Review', label: 'Duplicates & Review', sub: 'Pending & duplicate jobs', icon: CheckCircle2, count: pendingJobs.length || null },
    { id: 'settings', stepNumber: '6. Settings', label: 'Settings', sub: 'Interval, depth, rules', icon: Settings, count: null }
  ];

  return (
    <div className="space-y-6 text-slate-100">
      {/* TOP HEADER & REAL-TIME SCHEDULER BANNER */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-indigo-600/20 text-indigo-400 rounded-xl border border-indigo-500/30">
              <Globe className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-xl font-black text-white">Scraper Center</h2>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Step-by-Step Flow
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Manage job sources, run scrapers, inspect results, and review pending jobs.
              </p>
            </div>
          </div>

          {/* Quick Real-Time Scheduler Status Badge */}
          <div className="flex items-center space-x-2">
            <div className="px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs flex items-center space-x-2.5">
              <span className={`w-2.5 h-2.5 rounded-full ${schedulerStatus?.isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-emerald-500'}`} />
              <div>
                <span className="text-slate-400 text-[10px] uppercase font-bold block leading-none">Background Scheduler</span>
                <span className="text-white font-bold text-xs mt-0.5 block">
                  {schedulerStatus?.isRunning ? 'Active & Running' : 'Scheduled (Cron)'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={fetchLiveScraperData}
              disabled={isLoadingLive}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700 transition-all cursor-pointer disabled:opacity-50"
              title="Refresh live data"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingLive ? 'animate-spin text-indigo-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* Global Feedback Banner */}
        {statusMessage && (
          <div
            className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all ${
              statusMessage.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : statusMessage.type === 'error'
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                : 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300'
            }`}
          >
            <div className="flex items-center space-x-2">
              {statusMessage.type === 'success' ? (
                <Check className="w-4 h-4 flex-shrink-0" />
              ) : statusMessage.type === 'error' ? (
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              ) : (
                <RefreshCw className="w-4 h-4 flex-shrink-0" />
              )}
              <span>{statusMessage.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setStatusMessage(null)}
              className="text-slate-400 hover:text-white p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* STEP NAVIGATION TABS (Simple English, Step 1 through Step 6) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-1.5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1 shadow-lg">
        {STEPS.map(s => {
          const Icon = s.icon;
          const isActive = activeStep === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setActiveStep(s.id);
                setStatusMessage(null);
              }}
              className={`p-3 rounded-xl text-left transition-all cursor-pointer flex flex-col justify-between ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/70 border border-transparent'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-[10px] uppercase font-black tracking-wider ${isActive ? 'text-indigo-200' : 'text-slate-500'}`}>
                  {s.stepNumber}
                </span>
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
              </div>
              <div className="mt-2">
                <div className="flex items-center space-x-1.5">
                  <span className="text-sm font-black text-white">{s.label}</span>
                  {s.count !== null && s.count !== undefined && (
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                        isActive ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {s.count}
                    </span>
                  )}
                </div>
                <span className={`text-[11px] block mt-0.5 line-clamp-1 ${isActive ? 'text-indigo-100' : 'text-slate-400'}`}>
                  {s.sub}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* ============================================================= */}
      {/* 1. OVERVIEW (Scheduler Status, Stats, Recent Runs, Discovered) */}
      {/* ============================================================= */}
      {activeStep === 'overview' && (
        <div className="space-y-6">
          {/* Top Scheduler & Live Health Status Card */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/5 rounded-full blur-3xl pointer-events-none" />
            
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
              <div className="space-y-1">
                <div className="flex items-center space-x-2.5">
                  <span className={`w-3 h-3 rounded-full ${schedulerStatus?.isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                  <span className="text-xs uppercase font-black tracking-wider text-slate-400">Automated Pipeline Status</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                    schedulerStatus?.isRunning ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  }`}>
                    {schedulerStatus?.isRunning ? 'Scheduler Active (Tick: */2 * * * *)' : 'Scheduler Paused'}
                  </span>
                </div>
                <h3 className="text-lg font-black text-white">Universal Job Scraper & Ingestion Center</h3>
                <p className="text-xs text-slate-400">
                  Continuous pipeline monitoring federal commissions (FPSC, PPSC), provincial portals, and newspaper classifieds.
                </p>
              </div>

              {/* Timing details & Action */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="px-4 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-xs space-y-0.5">
                  <span className="text-slate-500 text-[10px] uppercase font-bold block">Last Run</span>
                  <span className="text-white font-bold block">{lastRunDisplay}</span>
                </div>

                <div className="px-4 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-xs space-y-0.5">
                  <span className="text-slate-500 text-[10px] uppercase font-bold block">Next Scheduled Run</span>
                  <span className="text-indigo-300 font-bold block">{nextRunDisplay}</span>
                </div>

                <button
                  type="button"
                  onClick={handleTriggerTick}
                  disabled={isTriggeringTick}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-600/30 flex items-center space-x-2 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${isTriggeringTick ? 'animate-spin' : ''}`} />
                  <span>{isTriggeringTick ? 'Triggering...' : 'Trigger Scheduler Now'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* 6 Core Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {/* 1. Jobs Found */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Jobs Found</span>
                <Globe className="w-4 h-4 text-indigo-400" />
              </div>
              <div className="mt-3">
                <div className="text-2xl font-black text-white">{metrics.totalFound.toLocaleString()}</div>
                <p className="text-[10px] text-slate-500 mt-0.5">Harvested across portals</p>
              </div>
            </div>

            {/* 2. Approved */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">Approved</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="mt-3">
                <div className="text-2xl font-black text-white">{metrics.approvedCount.toLocaleString()}</div>
                <p className="text-[10px] text-emerald-500/80 mt-0.5">Live on public website</p>
              </div>
            </div>

            {/* 3. Pending */}
            <div
              onClick={() => setActiveStep('review')}
              className={`bg-slate-900 border rounded-2xl p-4 shadow-lg flex flex-col justify-between transition-all cursor-pointer ${
                metrics.pendingCount > 0 ? 'border-amber-500/50 hover:border-amber-400' : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">Pending</span>
                <Clock className="w-4 h-4 text-amber-400" />
              </div>
              <div className="mt-3">
                <div className="flex items-center space-x-2">
                  <span className="text-2xl font-black text-white">{metrics.pendingCount.toLocaleString()}</span>
                  {metrics.pendingCount > 0 && (
                    <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">
                      Review →
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-amber-500/80 mt-0.5">Awaiting confirmation</p>
              </div>
            </div>

            {/* 4. Duplicates */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-purple-400 uppercase tracking-wider">Duplicates</span>
                <Shield className="w-4 h-4 text-purple-400" />
              </div>
              <div className="mt-3">
                <div className="text-2xl font-black text-white">{metrics.duplicatesCount.toLocaleString()}</div>
                <p className="text-[10px] text-purple-400/80 mt-0.5">Screened & prevented</p>
              </div>
            </div>

            {/* 5. Errors */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-rose-400 uppercase tracking-wider">Errors</span>
                <AlertTriangle className="w-4 h-4 text-rose-400" />
              </div>
              <div className="mt-3">
                <div className="text-2xl font-black text-white">{metrics.errorsCount.toLocaleString()}</div>
                <p className="text-[10px] text-rose-400/80 mt-0.5">Portal access notices</p>
              </div>
            </div>

            {/* 6. Active Sources */}
            <div
              onClick={() => setActiveStep('sources')}
              className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 shadow-lg flex flex-col justify-between transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-blue-400 uppercase tracking-wider">Sources</span>
                <Sliders className="w-4 h-4 text-blue-400" />
              </div>
              <div className="mt-3">
                <div className="text-2xl font-black text-white">
                  {sourcesList.filter(s => s.status === 'Active Scheduled').length}
                  <span className="text-xs text-slate-500 font-normal"> / {sourcesList.length}</span>
                </div>
                <p className="text-[10px] text-blue-400/80 mt-0.5">Active targets in table</p>
              </div>
            </div>
          </div>

          {/* Quick Action Navigation Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <button
              type="button"
              onClick={() => setActiveStep('sources')}
              className="p-4 bg-slate-900 hover:bg-slate-800/80 border border-slate-800 rounded-2xl text-left transition-all cursor-pointer group shadow-lg flex items-center justify-between"
            >
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl group-hover:bg-indigo-500/20 transition-all">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">Manage Sources</h4>
                  <p className="text-[11px] text-slate-400">{sourcesList.length} targets in one table</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-all" />
            </button>

            <button
              type="button"
              onClick={() => setActiveStep('run')}
              className="p-4 bg-slate-900 hover:bg-slate-800/80 border border-slate-800 rounded-2xl text-left transition-all cursor-pointer group shadow-lg flex items-center justify-between"
            >
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl group-hover:bg-emerald-500/20 transition-all">
                  <Play className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">Run Scraper</h4>
                  <p className="text-[11px] text-slate-400">Run All, Selected, or Now</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-all" />
            </button>

            <button
              type="button"
              onClick={() => setActiveStep('review')}
              className="p-4 bg-slate-900 hover:bg-slate-800/80 border border-slate-800 rounded-2xl text-left transition-all cursor-pointer group shadow-lg flex items-center justify-between"
            >
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-xl group-hover:bg-amber-500/20 transition-all">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">Duplicates & Review</h4>
                  <p className="text-[11px] text-slate-400">{pendingJobs.length} jobs awaiting review</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-all" />
            </button>

            <button
              type="button"
              onClick={() => setActiveStep('history')}
              className="p-4 bg-slate-900 hover:bg-slate-800/80 border border-slate-800 rounded-2xl text-left transition-all cursor-pointer group shadow-lg flex items-center justify-between"
            >
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-purple-500/10 text-purple-400 rounded-xl group-hover:bg-purple-500/20 transition-all">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">Scraper History</h4>
                  <p className="text-[11px] text-slate-400">{liveRuns.length} recorded runs</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-all" />
            </button>
          </div>

          {/* Recent Runs Table (Real backend scraper runs only) */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-indigo-400" />
                  <span>Recent Backend Scraper Runs</span>
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Real runs logged directly in MongoDB storage.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setActiveStep('history')}
                className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center space-x-1 cursor-pointer"
              >
                <span>View Full History ({liveRuns.length})</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {liveRuns.length === 0 ? (
              <div className="p-8 text-center bg-slate-950/50 rounded-xl border border-slate-800/80">
                <Clock className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <div className="text-xs font-bold text-slate-300">No scraper runs recorded yet</div>
                <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto">
                  Click below to execute your first live scraping run across enabled portals.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveStep('run')}
                  className="mt-3 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md inline-flex items-center space-x-1.5 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Run Scraper Now</span>
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/60 text-slate-400 font-bold border-b border-slate-800">
                    <tr>
                      <th className="p-3">Run ID</th>
                      <th className="p-3">Executed At</th>
                      <th className="p-3">Mode</th>
                      <th className="p-3 text-center">Jobs Discovered</th>
                      <th className="p-3 text-center">Approved</th>
                      <th className="p-3 text-center">Duplicates</th>
                      <th className="p-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {liveRuns.slice(0, 5).map(r => (
                      <tr key={r.runId || r.id} className="hover:bg-slate-800/30 transition-all">
                        <td className="p-3 font-mono text-[11px] text-indigo-400 font-bold">
                          {r.runId?.slice(0, 16) || 'run-latest'}
                        </td>
                        <td className="p-3 text-slate-400">
                          {r.startedAt || r.timestamp ? new Date(r.startedAt || r.timestamp!).toLocaleString() : 'Recent'}
                        </td>
                        <td className="p-3 text-slate-300 capitalize">
                          {r.mode ? r.mode.replace(/_/g, ' ') : 'Standard'}
                        </td>
                        <td className="p-3 text-center font-bold text-white">
                          {r.totalFound || 0}
                        </td>
                        <td className="p-3 text-center text-emerald-400 font-bold">
                          {r.approvedCount || r.jobsAccepted || 0}
                        </td>
                        <td className="p-3 text-center text-purple-400 font-bold">
                          {r.totalDuplicates || 0}
                        </td>
                        <td className="p-3 text-right">
                          {(() => {
                            const resolvedStatus = getRunResolvedStatus(r);
                            return (
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  resolvedStatus === 'Completed'
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                    : resolvedStatus === 'Partial'
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                }`}
                              >
                                {resolvedStatus}
                              </span>
                            );
                          })()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Discovered Jobs & Scraper Ingestion Feed */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center space-x-2">
                  <Globe className="w-4 h-4 text-emerald-400" />
                  <span>Discovered Vacancies & Ingestion Feed</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300">
                    {resultsItems.length} jobs
                  </span>
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Browse all vacancies harvested across sources. Filter by status, search keywords, and sort without arbitrary limits.
                </p>
              </div>
            </div>

            {/* Filters Bar */}
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {/* Search */}
                <div className="relative sm:col-span-2">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search by title, organization, or portal..."
                    value={resultsSearchQuery}
                    onChange={(e) => setResultsSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Sort By */}
                <div className="flex items-center space-x-1.5">
                  <span className="text-[11px] text-slate-500 shrink-0">Sort:</span>
                  <select
                    value={resultsSortBy}
                    onChange={(e) => setResultsSortBy(e.target.value as any)}
                    aria-label="Sort Discovered Jobs"
                    className="w-full px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="newest">Newest First</option>
                    <option value="oldest">Oldest First</option>
                    <option value="title_asc">Title: A → Z</option>
                    <option value="title_desc">Title: Z → A</option>
                  </select>
                </div>
              </div>

              {/* Status Pills & Reset */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
                <div className="flex items-center space-x-1.5 flex-wrap gap-1">
                  <span className="text-[11px] text-slate-500 mr-1">Status:</span>
                  {(['all', 'Approved', 'Pending', 'Duplicate'] as const).map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setResultsTypeFilter(type)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        resultsTypeFilter === type
                          ? 'bg-indigo-600 text-white shadow'
                          : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                      }`}
                    >
                      {type === 'all' ? 'All' : type}
                    </button>
                  ))}
                </div>

                {(resultsSearchQuery || resultsTypeFilter !== 'all' || resultsSortBy !== 'newest') && (
                  <button
                    type="button"
                    onClick={() => {
                      setResultsSearchQuery('');
                      setResultsTypeFilter('all');
                      setResultsSortBy('newest');
                    }}
                    className="px-2.5 py-1 text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-all cursor-pointer"
                  >
                    Reset Filters
                  </button>
                )}
              </div>
            </div>

            {/* Results Table */}
            {resultsItems.length === 0 ? (
              <div className="p-8 text-center bg-slate-950/50 rounded-xl border border-slate-800/80 text-xs text-slate-500">
                No discovered vacancies match your search and filter criteria.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/80 text-slate-400 font-bold border-b border-slate-800">
                    <tr>
                      <th className="p-3">Job Title & Company</th>
                      <th className="p-3">Source Portal</th>
                      <th className="p-3 text-center">Discovered Date</th>
                      <th className="p-3 text-center">Status</th>
                      <th className="p-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {paginatedResultsItems.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-800/40 transition-all">
                        <td className="p-3">
                          <div className="font-bold text-white">{item.title}</div>
                          <div className="text-[11px] text-slate-400">{item.company}</div>
                        </td>
                        <td className="p-3 text-slate-300">
                          <span className="px-2 py-0.5 bg-slate-950 border border-slate-800 rounded text-[11px] text-indigo-300">
                            {item.portal}
                          </span>
                        </td>
                        <td className="p-3 text-center text-[11px] text-slate-400">
                          {item.date ? new Date(item.date).toLocaleDateString() : 'Recent'}
                        </td>
                        <td className="p-3 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              item.status === 'Approved'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : item.status === 'Duplicate'
                                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            }`}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          {item.status === 'Pending' || item.status === 'Duplicate' ? (
                            <button
                              type="button"
                              onClick={() => {
                                setActiveStep('review');
                                setSearchQuery(item.title);
                              }}
                              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-white rounded-lg text-xs font-semibold cursor-pointer"
                            >
                              Review
                            </button>
                          ) : (item.rawJob?.applicationUrl || item.rawJob?.sourceUrl) ? (
                            <a
                              href={item.rawJob?.applicationUrl || item.rawJob?.sourceUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center space-x-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-semibold"
                            >
                              <span>View</span>
                              <ExternalLink className="w-3 h-3 text-slate-400" />
                            </a>
                          ) : (
                            <span className="text-[11px] text-slate-500">Live</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <PaginationControls
                  currentPage={resultsPage}
                  totalItems={resultsItems.length}
                  pageSize={resultsPageSize}
                  onPageChange={setResultsPage}
                  onPageSizeChange={(sz) => {
                    setResultsPageSize(sz);
                    setResultsPage(1);
                  }}
                  labelSingular="vacancy"
                  labelPlural="vacancies"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* 2. SOURCES (All scraper sources in ONE table)                 */}
      {/* ============================================================= */}
      {activeStep === 'sources' && (
        <div className="space-y-6">
          {/* Step Helper Banner */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <span>Step 2: Sources — All Scraper Sources in ONE Table</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300">
                  {sourcesList.length} configured
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Select which job portals and government websites the scraper should visit. You can turn sources on or off, add new ones, or change run intervals.
              </p>
            </div>

            <div className="flex items-center space-x-2 flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setIsAddSourceOpen(true)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all shadow-md cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Source</span>
              </button>
              {onOpenPdfParser && (
                <button
                  type="button"
                  onClick={() => onOpenPdfParser()}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all border border-slate-700 cursor-pointer"
                >
                  <FileText className="w-4 h-4 text-amber-400" />
                  <span>Import PDF Gazette</span>
                </button>
              )}
              {onOpenBatchIngestModal && (
                <button
                  type="button"
                  onClick={onOpenBatchIngestModal}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all border border-slate-700 cursor-pointer"
                >
                  <Layers className="w-4 h-4 text-indigo-400" />
                  <span>Batch URL Import</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setActiveStep('run')}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all shadow-md cursor-pointer"
              >
                <span>Continue to Step 3: Run Scraper</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Search & Filters */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center space-x-2 flex-1 min-w-[240px]">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search sources by name or URL..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="flex items-center space-x-2 flex-wrap gap-2">
              {/* Source Group Filter & Manager */}
              <select
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                aria-label="Filter by Source Group"
                className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none"
              >
                <option value="all">All Groups ({sourcesList.length})</option>
                {sourceGroups.map(g => (
                  <option key={g.id} value={g.id}>
                    📁 {g.name} ({g.sourceIds?.length || 0})
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => setIsGroupModalOpen(true)}
                className="px-3 py-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs font-semibold text-slate-300 hover:text-white flex items-center space-x-1.5 cursor-pointer transition-all"
                title="Manage source groups"
              >
                <Folder className="w-3.5 h-3.5 text-amber-400" />
                <span>Groups ({sourceGroups.length})</span>
              </button>

              {/* Health Status Filter */}
              <select
                value={healthFilter}
                onChange={(e) => setHealthFilter(e.target.value)}
                aria-label="Filter by Health Status"
                className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none"
              >
                <option value="all">All Health</option>
                <option value="Healthy">Healthy Only</option>
                <option value="Jobs Found">Jobs Found</option>
                <option value="No Jobs">No Jobs</option>
                <option value="404">404 Not Found</option>
                <option value="403">403 Forbidden</option>
                <option value="Timeout">Timeout</option>
                <option value="Invalid PDF">Invalid PDF</option>
                <option value="HTML">HTML / JS Only</option>
                <option value="Fetch Error">Fetch Error</option>
                <option value="Disabled">Disabled</option>
                <option value="All Failed">All Failed (Errors)</option>
              </select>

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                aria-label="Filter by Category"
                className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none"
              >
                <option value="all">All Categories</option>
                <option value="Government Sector">Government Sector</option>
                <option value="Testing Agency">Testing Agency</option>
                <option value="Corporate">Corporate Portals</option>
                <option value="International / Gulf">International / Gulf</option>
                <option value="Newspaper Feed">Newspaper Feeds</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                aria-label="Filter by Status"
                className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none"
              >
                <option value="all">All Status</option>
                <option value="Active">Active Only</option>
                <option value="Paused">Paused Only</option>
                <option value="Error">Error Only</option>
              </select>

              <select
                value={regionFilter}
                onChange={(e) => setRegionFilter(e.target.value)}
                aria-label="Filter by Region"
                className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none"
              >
                <option value="all">All Regions</option>
                <option value="Pakistan">Pakistan</option>
                <option value="Punjab">Punjab</option>
                <option value="Sindh">Sindh</option>
                <option value="KPK">KPK</option>
                <option value="Balochistan">Balochistan</option>
                <option value="Federal / Islamabad">Federal</option>
                <option value="Gulf / Middle East">Gulf</option>
              </select>

              {/* Retry All Failed Button */}
              {sourcesList.some(s => ['404', '403', 'Timeout', 'Invalid PDF', 'Fetch Error'].includes(s.healthStatus || '')) && (
                <button
                  type="button"
                  disabled={isScrapingActive}
                  onClick={() => handleRetrySources(undefined, true)}
                  className="px-3 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-bold flex items-center space-x-1.5 cursor-pointer transition-all disabled:opacity-50"
                  title="Run real scraper engine on all failed sources (skips permanently disabled & blocked)"
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${isScrapingActive ? 'animate-spin' : ''}`} />
                  <span>Retry All Failed ({sourcesList.filter(s => ['404', '403', 'Timeout', 'Invalid PDF', 'Fetch Error'].includes(s.healthStatus || '')).length})</span>
                </button>
              )}

              {(searchQuery || selectedGroupId !== 'all' || healthFilter !== 'all' || categoryFilter !== 'all' || statusFilter !== 'all' || regionFilter !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedGroupId('all');
                    setHealthFilter('all');
                    setCategoryFilter('all');
                    setStatusFilter('all');
                    setRegionFilter('all');
                  }}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold transition-all cursor-pointer"
                >
                  Reset Filters
                </button>
              )}
            </div>
          </div>

          {/* Bulk Action Controls */}
          {selectedSourceIds.length > 0 && (
            <div className="bg-indigo-950/40 border border-indigo-800/50 rounded-2xl p-3 px-4 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center space-x-2">
                <span className="font-bold text-indigo-200">
                  {selectedSourceIds.length} sources selected
                </span>
                {selectedSourceIds.length < filteredSources.length && (
                  <button
                    type="button"
                    onClick={() => {
                      const allFilteredIds = filteredSources.map(s => s.id);
                      setSelectedSourceIds(allFilteredIds);
                    }}
                    className="px-2 py-1 text-[11px] bg-indigo-900/60 hover:bg-indigo-800 text-indigo-200 rounded font-semibold cursor-pointer"
                  >
                    Select All Filtered ({filteredSources.length})
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedSourceIds([])}
                  className="px-2 py-1 text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-semibold cursor-pointer"
                >
                  Clear
                </button>
              </div>
              <div className="flex items-center space-x-2 flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleBulkToggleStatus(true)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-semibold cursor-pointer"
                >
                  Turn On
                </button>
                <button
                  type="button"
                  onClick={() => handleBulkToggleStatus(false)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-semibold cursor-pointer"
                >
                  Turn Off
                </button>
                <button
                  type="button"
                  onClick={() => handleBulkSetAutoApprove(true)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-semibold cursor-pointer"
                >
                  Auto-Approve: On
                </button>
                <button
                  type="button"
                  onClick={() => handleBulkSetAutoApprove(false)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-semibold cursor-pointer"
                >
                  Auto-Approve: Off
                </button>

                {/* Retry Selected Sources via Real Scraper Engine */}
                <button
                  type="button"
                  disabled={isScrapingActive}
                  onClick={() => handleRetrySources(selectedSourceIds, false)}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-bold flex items-center space-x-1 cursor-pointer disabled:opacity-50"
                  title="Run real scraper engine on selected sources"
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${isScrapingActive ? 'animate-spin' : ''}`} />
                  <span>Retry Selected ({selectedSourceIds.length})</span>
                </button>

                {/* Add / Move to Group Dropdown */}
                {sourceGroups.length > 0 && (
                  <>
                    <select
                      defaultValue=""
                      onChange={(e) => {
                        if (e.target.value) {
                          handleAddSourcesToGroup(e.target.value, selectedSourceIds);
                          e.target.value = '';
                        }
                      }}
                      aria-label="Add selected to group"
                      className="px-2.5 py-1.5 bg-slate-900 border border-indigo-700/60 rounded-lg text-xs text-indigo-200 focus:outline-none"
                    >
                      <option value="" disabled>+ Add to Group...</option>
                      {sourceGroups.map(g => (
                        <option key={g.id} value={g.id}>Group: {g.name}</option>
                      ))}
                    </select>

                    <select
                      defaultValue=""
                      onChange={(e) => {
                        if (e.target.value !== undefined && e.target.value !== '') {
                          const targetVal = e.target.value === '__NONE__' ? null : e.target.value;
                          handleBulkMoveSourcesGroup(targetVal);
                          e.target.value = '';
                        }
                      }}
                      aria-label="Move selected to group"
                      className="px-2.5 py-1.5 bg-slate-900 border border-indigo-700/60 rounded-lg text-xs text-indigo-200 focus:outline-none"
                    >
                      <option value="" disabled>Move {selectedSourceIds.length} to...</option>
                      <option value="__NONE__">Remove from all groups</option>
                      {sourceGroups.map(g => (
                        <option key={g.id} value={g.id}>Move to: {g.name}</option>
                      ))}
                    </select>
                  </>
                )}

                {selectedGroupId !== 'all' && (
                  <button
                    type="button"
                    onClick={() => handleRemoveSourcesFromGroup(selectedGroupId, selectedSourceIds)}
                    className="px-3 py-1.5 bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/40 rounded-lg font-semibold cursor-pointer"
                    title="Remove selected sources from current group"
                  >
                    Remove from Group
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setActiveStep('run');
                  }}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold flex items-center space-x-1 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Run Selected in Step 3</span>
                </button>
              </div>
            </div>
          )}

          {/* Sources Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            {filteredSources.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <Globe className="w-10 h-10 text-slate-600 mx-auto" />
                <h4 className="text-sm font-bold text-slate-300">No data yet</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  No sources match your current filter. Clear filters or click "Add Source" above to configure a job website.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/80 text-slate-400 font-bold border-b border-slate-800">
                    <tr>
                      <th className="p-4 w-10">
                        <input
                          type="checkbox"
                          aria-label="Select all sources"
                          checked={filteredSources.length > 0 && filteredSources.every(s => selectedSourceIds.includes(s.id))}
                          onChange={(e) => {
                            if (e.target.checked) {
                              const allFilteredIds = filteredSources.map(s => s.id);
                              setSelectedSourceIds(prev => Array.from(new Set([...prev, ...allFilteredIds])));
                            } else {
                              const filteredIdSet = new Set(filteredSources.map(s => s.id));
                              setSelectedSourceIds(prev => prev.filter(id => !filteredIdSet.has(id)));
                            }
                          }}
                          className="rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-0 cursor-pointer"
                        />
                      </th>
                      <th className="p-4">Source Name & Category</th>
                      <th className="p-4">Website Link</th>
                      <th className="p-4">Region</th>
                      <th className="p-4">Health & Diagnostics</th>
                      <th className="p-4">Run Frequency</th>
                      <th className="p-4 text-center">Auto-Approve</th>
                      <th className="p-4 text-center">Status</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {paginatedSources.map(source => {
                      const isSelected = selectedSourceIds.includes(source.id);
                      const isActive = source.status === 'Active Scheduled';

                      return (
                        <tr key={source.id} className={`hover:bg-slate-800/40 transition-all ${isSelected ? 'bg-indigo-950/20' : ''}`}>
                          <td className="p-4">
                            <input
                              type="checkbox"
                              aria-label={`Select source ${source.name}`}
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedSourceIds(prev => [...prev, source.id]);
                                } else {
                                  setSelectedSourceIds(prev => prev.filter(id => id !== source.id));
                                }
                              }}
                              className="rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-0 cursor-pointer"
                            />
                          </td>
                          <td className="p-4">
                            <div className="font-bold text-white text-sm">{source.name}</div>
                            <span className="text-[10px] text-indigo-400 font-semibold uppercase tracking-wider">
                              {source.category}
                            </span>
                          </td>
                          <td className="p-4 max-w-[220px]">
                            <div className="flex items-center space-x-1.5">
                              <a
                                href={source.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-slate-400 hover:text-indigo-400 flex items-center space-x-1 truncate"
                                title={source.url}
                              >
                                <span className="truncate max-w-[150px]">{source.url}</span>
                                <ExternalLink className="w-3 h-3 flex-shrink-0" />
                              </a>
                              <button
                                type="button"
                                onClick={() => handleCopyUrl(source.url, source.id)}
                                className="p-1 rounded bg-slate-800 hover:bg-indigo-600 text-slate-400 hover:text-white transition-all shrink-0 cursor-pointer"
                                title="Copy URL"
                              >
                                {copiedSourceId === source.id ? (
                                  <Check className="w-3 h-3 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          </td>
                          <td className="p-4">
                            <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 text-[11px]">
                              {source.region}
                            </span>
                          </td>
                          <td className="p-4">
                            <div className="flex flex-col space-y-1">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold w-fit ${
                                source.healthStatus === 'Healthy' || source.healthStatus === 'Jobs Found'
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                  : source.healthStatus === '404'
                                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                  : source.healthStatus === '403'
                                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                  : source.healthStatus === 'Timeout'
                                  ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                                  : source.healthStatus === 'Invalid PDF'
                                  ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                                  : source.healthStatus === 'HTML'
                                  ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                                  : source.healthStatus === 'No Jobs'
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                  : 'bg-slate-800 text-slate-400 border border-slate-700'
                              }`}>
                                {source.healthStatus || 'Healthy'}
                              </span>
                              {source.lastHttpStatus && (
                                <span className="text-[10px] text-slate-500 font-mono">
                                  HTTP {source.lastHttpStatus}
                                </span>
                              )}
                              {source.lastErrorMessage && (
                                <span className="text-[10px] text-rose-400/90 line-clamp-1 max-w-[140px]" title={source.lastErrorMessage}>
                                  {source.lastErrorMessage}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-4 text-slate-400">
                            Every {source.interval || '24h'}
                          </td>
                          <td className="p-4 text-center">
                            <button
                              type="button"
                              onClick={() => handleToggleAutoApprove(source.id)}
                              className={`px-2.5 py-1 rounded-full text-[10px] font-bold cursor-pointer transition-all ${
                                source.autoApprove
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                  : 'bg-slate-800 text-slate-400 border border-slate-700'
                              }`}
                            >
                              {source.autoApprove ? 'Yes (Live)' : 'No (Review)'}
                            </button>
                          </td>
                          <td className="p-4 text-center">
                            <button
                              type="button"
                              onClick={() => handleToggleSourceStatus(source.id)}
                              className={`px-2.5 py-1 rounded-full text-[10px] font-bold cursor-pointer transition-all ${
                                isActive
                                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                                  : 'bg-slate-800 text-slate-500 border border-slate-700'
                              }`}
                            >
                              {isActive ? 'Active' : 'Paused'}
                            </button>
                          </td>
                          <td className="p-4 text-right space-x-1 whitespace-nowrap">
                            {sourceGroups.length > 0 && (
                              <select
                                value={sourceGroups.find(g => g.sourceIds?.includes(source.id))?.id || ''}
                                onChange={(e) => handleMoveSourceGroup(source.id, e.target.value || null)}
                                aria-label="Move Source Group"
                                className="px-2 py-1 bg-slate-950 border border-slate-700 text-[10px] text-slate-300 rounded-lg focus:outline-none"
                                title="Move/Change Group"
                              >
                                <option value="">(No Group)</option>
                                {sourceGroups.map(g => (
                                  <option key={g.id} value={g.id}>{g.name}</option>
                                ))}
                              </select>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                handleRunSingleSource(source.id);
                                setActiveStep('run');
                              }}
                              className="p-1.5 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 rounded-lg transition-all cursor-pointer inline-flex items-center"
                              title="Run Now"
                            >
                              <Play className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={isScrapingActive}
                              onClick={() => handleRetrySources([source.id], false)}
                              className="p-1.5 bg-amber-600/20 hover:bg-amber-600/40 text-amber-400 rounded-lg transition-all cursor-pointer inline-flex items-center disabled:opacity-50"
                              title="Retry with Real Scraper Engine"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteSource(source.id)}
                              className="p-1.5 bg-slate-800 hover:bg-rose-900/40 text-slate-400 hover:text-rose-400 rounded-lg transition-all cursor-pointer inline-flex items-center"
                              title="Delete source"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <PaginationControls
                  currentPage={sourcesPage}
                  totalItems={filteredSources.length}
                  pageSize={sourcesPageSize}
                  onPageChange={setSourcesPage}
                  onPageSizeChange={(sz) => {
                    setSourcesPageSize(sz);
                    setSourcesPage(1);
                  }}
                  labelSingular="source"
                  labelPlural="sources"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* 3. RUN SCRAPER (Run All / Selected / Now / Links / PDF)       */}
      {/* ============================================================= */}
      {activeStep === 'run' && (
        <div className="space-y-6">
          {/* Step Helper Banner */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <span>Step 3: Run Scraper — Run All / Run Selected / Run Now</span>
                {activeRunState?.isActive && (
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                    activeRunState.isPaused
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 animate-pulse'
                  }`}>
                    {activeRunState.isPaused ? 'Crawler Paused' : 'Crawler Active & Harvesting'}
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Start scraping jobs now. Run all enabled websites, run your selected list, test a specific link, or extract government PDF circulars.
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setActiveStep('history')}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all shadow-md cursor-pointer"
              >
                <span>Continue to Step 4: History</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Real-time Active Run Monitor & Control Bar */}
          {activeRunState && (activeRunState.isActive || activeRunState.status === 'Running' || activeRunState.status === 'Paused') && (
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/30 rounded-2xl p-5 space-y-4 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-xl border ${
                    activeRunState.isPaused
                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 animate-pulse'
                  }`}>
                    <Activity className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center space-x-2">
                      <span>Real-Time Scraper Engine Activity</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        activeRunState.isPaused
                          ? 'bg-amber-500/20 text-amber-300'
                          : 'bg-emerald-500/20 text-emerald-300'
                      }`}>
                        {activeRunState.isPaused ? 'PAUSED' : 'RUNNING'}
                      </span>
                    </h4>
                    <p className="text-xs text-slate-400">
                      Processing source: <span className="text-indigo-300 font-semibold">{activeRunState.currentSourceName || 'Initializing...'}</span> ({activeRunState.completedSources || 0} / {activeRunState.totalSources || 0} completed)
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {activeRunState.isPaused ? (
                    <button
                      type="button"
                      disabled={isResuming}
                      onClick={handleResumeActiveRun}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer flex items-center space-x-1.5"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>Resume Run</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={isPausing}
                      onClick={handlePauseActiveRun}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer flex items-center space-x-1.5"
                    >
                      <Pause className="w-3.5 h-3.5" />
                      <span>Pause Run</span>
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={isStopping}
                    onClick={handleStopActiveRun}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer flex items-center space-x-1.5"
                  >
                    <Square className="w-3.5 h-3.5" />
                    <span>Stop Run</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleResetActiveRun}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold transition-all border border-slate-700 cursor-pointer flex items-center space-x-1.5"
                    title="Force reset scraper state to Idle"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset</span>
                  </button>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Batch Source Progress</span>
                  <span className="font-mono text-white">
                    {activeRunState.totalSources > 0 ? Math.round((activeRunState.completedSources / activeRunState.totalSources) * 100) : 0}%
                  </span>
                </div>
                <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 via-emerald-500 to-teal-400 transition-all duration-300"
                    style={{
                      width: `${activeRunState.totalSources > 0 ? (activeRunState.completedSources / activeRunState.totalSources) * 100 : 0}%`
                    }}
                  />
                </div>
              </div>

              {/* Live Run Metric Counters */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-1">
                <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 text-center">
                  <div className="text-[10px] text-slate-400 font-semibold uppercase">Total Found</div>
                  <div className="text-base font-black text-indigo-400 mt-0.5">{activeRunState.totalFound || 0}</div>
                </div>
                <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 text-center">
                  <div className="text-[10px] text-slate-400 font-semibold uppercase">New Harvested</div>
                  <div className="text-base font-black text-emerald-400 mt-0.5">{activeRunState.newJobs || 0}</div>
                </div>
                <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 text-center">
                  <div className="text-[10px] text-slate-400 font-semibold uppercase">Duplicates Filtered</div>
                  <div className="text-base font-black text-purple-400 mt-0.5">{activeRunState.duplicates || 0}</div>
                </div>
                <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 text-center">
                  <div className="text-[10px] text-slate-400 font-semibold uppercase">Pending Review</div>
                  <div className="text-base font-black text-amber-400 mt-0.5">{activeRunState.pending || 0}</div>
                </div>
                <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 text-center">
                  <div className="text-[10px] text-slate-400 font-semibold uppercase">Failed Sources</div>
                  <div className="text-base font-black text-rose-400 mt-0.5">{activeRunState.failedSources || 0}</div>
                </div>
              </div>

              {activeRunState.currentError && (
                <div className="p-2.5 bg-rose-950/40 border border-rose-800/40 rounded-xl text-xs text-rose-300 flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>Notice: {activeRunState.currentError}</span>
                </div>
              )}
            </div>
          )}

          {/* Quick Action Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Card 1: Run All Enabled */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-lg flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Option A</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300">
                    {sourcesList.filter(s => s.status === 'Active Scheduled').length} Active
                  </span>
                </div>
                <h4 className="text-base font-bold text-white">Run All Enabled Sources</h4>
                <p className="text-xs text-slate-400">
                  Scrape all job websites marked as Active in your sources list.
                </p>
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between text-xs text-slate-300">
                  <span>Scan Depth</span>
                  <select
                    value={scrapeScanType}
                    onChange={(e) => setScrapeScanType(e.target.value as any)}
                    aria-label="Scan Depth"
                    className="px-2 py-1 bg-slate-950 border border-slate-800 rounded-lg text-xs"
                  >
                    <option value="full">Full Scan</option>
                    <option value="quick">Quick Scan (Recent only)</option>
                  </select>
                </div>

                <button
                  type="button"
                  disabled={isScrapingActive}
                  onClick={handleRunAllSources}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs flex items-center justify-center space-x-2 transition-all shadow-md cursor-pointer disabled:opacity-50"
                >
                  <Play className="w-4 h-4" />
                  <span>Run All Enabled Sources</span>
                </button>
              </div>
            </div>

            {/* Card 2: Run Selected */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-lg flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Option B</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300">
                    {selectedSourceIds.length} Selected
                  </span>
                </div>
                <h4 className="text-base font-bold text-white">Run Selected Sources</h4>
                <p className="text-xs text-slate-400">
                  Only scrape the websites you checked in Step 2.
                </p>
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between text-xs text-slate-300">
                  <span>Auto-Publish Trusted</span>
                  <input
                    type="checkbox"
                    aria-label="Auto-Publish Trusted"
                    checked={autoPublishTrusted}
                    onChange={(e) => setAutoPublishTrusted(e.target.checked)}
                    className="rounded bg-slate-800 border-slate-700 text-indigo-600 cursor-pointer"
                  />
                </div>

                <button
                  type="button"
                  disabled={isScrapingActive || selectedSourceIds.length === 0}
                  onClick={handleRunSelectedSources}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs flex items-center justify-center space-x-2 transition-all shadow-md cursor-pointer disabled:opacity-50"
                >
                  <Play className="w-4 h-4" />
                  <span>Run Selected ({selectedSourceIds.length})</span>
                </button>
              </div>
            </div>

            {/* Card 3: Run by Source Group */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-lg flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Option C</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300">
                    {sourceGroups.length} Groups
                  </span>
                </div>
                <h4 className="text-base font-bold text-white">Run by Source Group</h4>
                <p className="text-xs text-slate-400">
                  Crawl all portals clustered inside a specific named source group.
                </p>
              </div>

              <div className="space-y-3 pt-2">
                <select
                  value={selectedGroupId === 'all' ? '' : selectedGroupId}
                  onChange={(e) => setSelectedGroupId(e.target.value)}
                  aria-label="Select group to run"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none"
                >
                  <option value="">-- Choose a group --</option>
                  {sourceGroups.map(g => (
                    <option key={g.id} value={g.id}>
                      📁 {g.name} ({g.sourceIds?.length || 0} sources)
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  disabled={isScrapingActive || !selectedGroupId || selectedGroupId === 'all'}
                  onClick={() => handleRunGroup(selectedGroupId)}
                  className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-bold text-xs flex items-center justify-center space-x-2 transition-all shadow-md cursor-pointer disabled:opacity-50"
                >
                  <Folder className="w-4 h-4" />
                  <span>Run Group Now</span>
                </button>
              </div>
            </div>

            {/* Card 4: Retry Failed Sources */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-lg flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Option D</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300">
                    Real Scraper Retry
                  </span>
                </div>
                <h4 className="text-base font-bold text-white">Retry Failed Sources</h4>
                <p className="text-xs text-slate-400">
                  Execute the real scraper engine against sources with HTTP or extraction errors.
                </p>
              </div>

              <div className="space-y-3 pt-2">
                <div className="text-[11px] text-slate-400 p-2 bg-slate-950 rounded-lg border border-slate-800">
                  <span>Failed: </span>
                  <span className="font-bold text-rose-300">
                    {sourcesList.filter(s => ['404', '403', 'Timeout', 'Invalid PDF', 'Fetch Error'].includes(s.healthStatus || '')).length} sources
                  </span>
                </div>

                <button
                  type="button"
                  disabled={isScrapingActive}
                  onClick={() => handleRetrySources(undefined, true)}
                  className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold text-xs flex items-center justify-center space-x-2 transition-all shadow-md cursor-pointer disabled:opacity-50"
                >
                  <RotateCcw className={`w-4 h-4 ${isScrapingActive ? 'animate-spin' : ''}`} />
                  <span>Retry All Failed</span>
                </button>
              </div>
            </div>
          </div>

          {/* Web Links & PDF Gazette Extraction Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Direct Web Link Scraper */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-lg">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-white flex items-center space-x-2">
                  <Globe className="w-4 h-4 text-indigo-400" />
                  <span>Direct Web Link Scraper</span>
                </h4>
                <span className="text-[10px] text-slate-500">Single URL</span>
              </div>
              <p className="text-xs text-slate-400">
                Paste any job advertisement link or career page to harvest vacancies instantly.
              </p>

              <form onSubmit={handleDirectUrlScrape} className="space-y-3">
                <input
                  type="url"
                  placeholder="https://example.com/careers/vacancy-123"
                  value={directUrl}
                  onChange={(e) => setDirectUrl(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />

                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Company name (optional)"
                    value={directOrg}
                    onChange={(e) => setDirectOrg(e.target.value)}
                    className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none"
                  />
                  <input
                    type="text"
                    placeholder="Job title filter (optional)"
                    value={directTitle}
                    onChange={(e) => setDirectTitle(e.target.value)}
                    className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isParsingDirectUrl || !directUrl.trim()}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs flex items-center justify-center space-x-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isParsingDirectUrl ? 'animate-spin' : ''}`} />
                  <span>{isParsingDirectUrl ? 'Scraping Web Link...' : 'Scrape Web Link'}</span>
                </button>
              </form>
            </div>

            {/* Batch URL Import */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-lg flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-white flex items-center space-x-2">
                    <Layers className="w-4 h-4 text-emerald-400" />
                    <span>Batch Link Import</span>
                  </h4>
                  {onOpenBatchIngestModal && (
                    <button
                      type="button"
                      onClick={onOpenBatchIngestModal}
                      className="text-[11px] text-indigo-400 hover:underline font-bold"
                    >
                      Open Import Wizard →
                    </button>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Paste multiple links below (one per line) to scrape several pages in sequence.
                </p>

                <textarea
                  rows={3}
                  placeholder="https://site1.com/jobs&#10;https://site2.com/careers&#10;https://site3.com/vacancies"
                  value={batchUrlsInput}
                  onChange={(e) => setBatchUrlsInput(e.target.value)}
                  className="w-full mt-3 p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  disabled={isBatchParsing || !batchUrlsInput.trim()}
                  onClick={handleBatchUrlScrape}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs flex items-center justify-center space-x-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isBatchParsing ? 'animate-spin' : ''}`} />
                  <span>
                    {isBatchParsing
                      ? `Scraping [${batchProgress.current}/${batchProgress.total}]...`
                      : 'Scrape All Pasted Links'}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Government PDF Gazette Extractor */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-lg">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center space-x-2">
                  <FileText className="w-4 h-4 text-purple-400" />
                  <span>Government PDF Gazette Extractor</span>
                </h4>
                <p className="text-xs text-slate-400 mt-1">
                  Extract job vacancies directly from official PDF circulars and newspaper gazettes.
                </p>
              </div>

              {onOpenPdfParser && (
                <button
                  type="button"
                  onClick={() => onOpenPdfParser()}
                  className="px-3.5 py-1.5 bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 border border-purple-500/30 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Open Advanced PDF Tool
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {[
                { name: 'FPSC (Federal)', url: 'https://fpsc.gov.pk' },
                { name: 'PPSC (Punjab)', url: 'https://ppsc.gop.pk' },
                { name: 'KPPSC (Khyber)', url: 'https://kppsc.gov.pk' },
                { name: 'SPSC (Sindh)', url: 'https://spsc.gos.pk' },
                { name: 'NTS Testing', url: 'https://nts.org.pk' }
              ].map(gazette => (
                <button
                  key={gazette.name}
                  type="button"
                  onClick={() => {
                    if (onOpenPdfParser) {
                      onOpenPdfParser({ name: gazette.name, url: gazette.url });
                    } else {
                      setDirectPdfUrl(gazette.url);
                    }
                  }}
                  className="p-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-left text-xs transition-all cursor-pointer"
                >
                  <div className="font-bold text-white truncate">{gazette.name}</div>
                  <div className="text-[10px] text-slate-500 truncate mt-0.5">{gazette.url}</div>
                </button>
              ))}
            </div>

            <div className="flex items-center space-x-2 pt-1">
              <input
                type="url"
                placeholder="Or paste any direct PDF link: https://fpsc.gov.pk/advertisement-09-2026.pdf"
                value={directPdfUrl}
                onChange={(e) => setDirectPdfUrl(e.target.value)}
                className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none"
              />
              <button
                type="button"
                disabled={isParsingPdf || !directPdfUrl.trim()}
                onClick={() => handlePdfScrape()}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50 flex items-center space-x-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isParsingPdf ? 'animate-spin' : ''}`} />
                <span>Extract PDF</span>
              </button>
            </div>
          </div>

          {/* Real-Time Live Log Viewer */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className={`w-2.5 h-2.5 rounded-full ${isScrapingActive ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  Live Execution Log {runProgressMessage ? `• ${runProgressMessage}` : ''}
                </h4>
              </div>

              <div className="flex items-center space-x-2 text-xs">
                <button
                  type="button"
                  onClick={() => setIsLogPaused(!isLogPaused)}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
                >
                  {isLogPaused ? 'Resume' : 'Pause'}
                </button>
                <button
                  type="button"
                  onClick={() => setScraperLogs([])}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(scraperLogs.join('\n'));
                    setStatusMessage({ text: 'Log copied to clipboard.', type: 'info' });
                  }}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg flex items-center space-x-1"
                >
                  <Copy className="w-3 h-3" />
                  <span>Copy</span>
                </button>
              </div>
            </div>

            <div className="h-44 overflow-y-auto bg-slate-950 rounded-xl p-3 font-mono text-[11px] text-slate-300 space-y-1 border border-slate-850">
              {scraperLogs.length === 0 ? (
                <div className="text-slate-600 text-center py-12">
                  No log messages yet. Click "Run All Enabled Sources" or test a link to see live crawler activity.
                </div>
              ) : (
                scraperLogs.map((log, i) => (
                  <div key={i} className="leading-relaxed">
                    {log}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Individual Source Run Results (Status, Found, Error, Copy URL, Actions) */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <BarChart2 className="w-4 h-4 text-emerald-400" />
                <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                  Source-by-Source Execution Results
                </h4>
                {activeSourcesStats.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300">
                    {filteredActiveSourcesStats.length} of {activeSourcesStats.length} sources
                  </span>
                )}
              </div>

              <div className="flex items-center space-x-2 text-xs">
                <span className="text-[11px] text-slate-400">
                  <span className="text-emerald-400 font-bold">{activeSourcesStats.filter((s: any) => (s.found || 0) > 0 && !s.failed).length}</span> with jobs found •{' '}
                  <span className="text-rose-400 font-bold">{activeSourcesStats.filter((s: any) => (s.found || 0) === 0 || s.failed).length}</span> 0 jobs/error
                </span>
              </div>
            </div>

            {/* Advanced Source Execution Results Filters */}
            {activeSourcesStats.length > 0 && (
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                  {/* Search source name / URL */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search source name or URL..."
                      value={statsSearchQuery}
                      onChange={(e) => setStatsSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  {/* Status: All / Jobs Found / No Jobs / Error / Failed */}
                  <div className="flex items-center space-x-1.5">
                    <span className="text-[11px] text-slate-500 shrink-0">Status:</span>
                    <select
                      value={statsStatusFilter}
                      onChange={(e) => setStatsStatusFilter(e.target.value as any)}
                      aria-label="Filter by Status"
                      className="w-full px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-indigo-500 cursor-pointer"
                    >
                      <option value="all">All Statuses</option>
                      <option value="jobs_found">Jobs Found (&gt; 0)</option>
                      <option value="no_jobs">No Jobs (0)</option>
                      <option value="error_failed">Error / Failed</option>
                    </select>
                  </div>

                  {/* Sort by */}
                  <div className="flex items-center space-x-1.5 sm:col-span-2">
                    <span className="text-[11px] text-slate-500 shrink-0">Sort By:</span>
                    <select
                      value={statsSortBy}
                      onChange={(e) => setStatsSortBy(e.target.value as any)}
                      aria-label="Sort source execution results"
                      className="w-full px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-indigo-500 cursor-pointer"
                    >
                      <option value="found_desc">Jobs Found: High → Low</option>
                      <option value="found_asc">Jobs Found: Low → High</option>
                      <option value="new_desc">New Jobs: High → Low</option>
                      <option value="dup_desc">Duplicates: High → Low</option>
                      <option value="name_asc">Source Name: A → Z</option>
                      <option value="name_desc">Source Name: Z → A</option>
                    </select>
                  </div>
                </div>

                {/* Range Inputs: Found, New, Duplicates */}
                <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-800/80 text-xs text-slate-400">
                  <div className="flex items-center space-x-1.5">
                    <span className="text-[11px] text-slate-500 font-medium">Found:</span>
                    <input
                      type="number"
                      placeholder="Min"
                      min="0"
                      value={statsMinFound}
                      onChange={(e) => setStatsMinFound(e.target.value)}
                      className="w-16 px-2 py-1 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-600 focus:outline-none"
                    />
                    <span className="text-slate-600">–</span>
                    <input
                      type="number"
                      placeholder="Max"
                      min="0"
                      value={statsMaxFound}
                      onChange={(e) => setStatsMaxFound(e.target.value)}
                      className="w-16 px-2 py-1 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-600 focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center space-x-1.5">
                    <span className="text-[11px] text-slate-500 font-medium">New:</span>
                    <input
                      type="number"
                      placeholder="Min"
                      min="0"
                      value={statsMinNew}
                      onChange={(e) => setStatsMinNew(e.target.value)}
                      className="w-16 px-2 py-1 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-600 focus:outline-none"
                    />
                    <span className="text-slate-600">–</span>
                    <input
                      type="number"
                      placeholder="Max"
                      min="0"
                      value={statsMaxNew}
                      onChange={(e) => setStatsMaxNew(e.target.value)}
                      className="w-16 px-2 py-1 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-600 focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center space-x-1.5">
                    <span className="text-[11px] text-slate-500 font-medium">Duplicates:</span>
                    <input
                      type="number"
                      placeholder="Min"
                      min="0"
                      value={statsMinDup}
                      onChange={(e) => setStatsMinDup(e.target.value)}
                      className="w-16 px-2 py-1 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-600 focus:outline-none"
                    />
                    <span className="text-slate-600">–</span>
                    <input
                      type="number"
                      placeholder="Max"
                      min="0"
                      value={statsMaxDup}
                      onChange={(e) => setStatsMaxDup(e.target.value)}
                      className="w-16 px-2 py-1 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-600 focus:outline-none"
                    />
                  </div>

                  {(statsSearchQuery || statsStatusFilter !== 'all' || statsMinFound || statsMaxFound || statsMinNew || statsMaxNew || statsMinDup || statsMaxDup || statsSortBy !== 'found_desc') && (
                    <button
                      type="button"
                      onClick={() => {
                        setStatsSearchQuery('');
                        setStatsStatusFilter('all');
                        setStatsMinFound('');
                        setStatsMaxFound('');
                        setStatsMinNew('');
                        setStatsMaxNew('');
                        setStatsMinDup('');
                        setStatsMaxDup('');
                        setStatsSortBy('found_desc');
                      }}
                      className="px-2.5 py-1 text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-all cursor-pointer ml-auto"
                    >
                      Reset Filters
                    </button>
                  )}
                </div>
              </div>
            )}

            {activeSourcesStats.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs">
                No individual source breakdown available for recent runs yet. Run any source or scheduler above to view real-time source diagnostics.
              </div>
            ) : filteredActiveSourcesStats.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs">
                No source execution results match the active filter criteria. Clear filters above.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/80 text-slate-400 font-bold border-b border-slate-800">
                    <tr>
                      <th className="p-3">Source Name</th>
                      <th className="p-3">Source URL</th>
                      <th className="p-3 text-center">Status</th>
                      <th className="p-3 text-center">Jobs Found</th>
                      <th className="p-3 text-center">New / Duplicates</th>
                      <th className="p-3">Error / Reason</th>
                      <th className="p-3">Last Run</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {paginatedActiveSourcesStats.map((stat: any, idx: number) => {
                      const hasJobs = (stat.found || 0) > 0 && !stat.failed;
                      const sourceItem = sourcesList.find(s => s.id === stat.sourceId || s.name === stat.sourceName);
                      const sourceGroup = sourceGroups.find(g => g.sourceIds?.includes(stat.sourceId || sourceItem?.id || ''));

                      return (
                        <tr key={stat.sourceId || idx} className="hover:bg-slate-800/40 transition-all">
                          <td className="p-3 font-bold text-white">
                            <div className="flex items-center space-x-1.5">
                              <span>{stat.sourceName || 'Source'}</span>
                              {sourceGroup && (
                                <span className="text-[9px] px-1.5 py-0.5 bg-indigo-950/80 border border-indigo-800/50 text-indigo-300 rounded">
                                  {sourceGroup.name}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-3 max-w-[200px]">
                            <div className="flex items-center space-x-1.5">
                              <a
                                href={stat.sourceUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-slate-400 hover:text-indigo-400 truncate max-w-[150px] inline-block"
                                title={stat.sourceUrl}
                              >
                                {stat.sourceUrl || '—'}
                              </a>
                              {stat.sourceUrl && (
                                <button
                                  type="button"
                                  onClick={() => handleCopyUrl(stat.sourceUrl, stat.sourceId || `stat-${idx}`)}
                                  className="p-1 rounded bg-slate-800 hover:bg-indigo-600 text-slate-400 hover:text-white transition-all shrink-0 cursor-pointer"
                                  title="Copy URL"
                                >
                                  {copiedSourceId === (stat.sourceId || `stat-${idx}`) ? (
                                    <Check className="w-3 h-3 text-emerald-400" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="p-3 text-center">
                            <span
                              className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                hasJobs
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              }`}
                            >
                              {hasJobs ? 'Jobs Found' : (stat.error ? 'Error / Failed' : 'No Jobs')}
                            </span>
                          </td>
                          <td className="p-3 text-center font-bold text-sm">
                            <span className={hasJobs ? 'text-emerald-400' : 'text-slate-500'}>
                              {stat.found || 0}
                            </span>
                          </td>
                          <td className="p-3 text-center text-[11px] text-slate-400">
                            <span className="text-emerald-300 font-semibold">{stat.newCount || 0} new</span>
                            <span className="mx-1 text-slate-600">/</span>
                            <span className="text-purple-300">{stat.dupCount || 0} dup</span>
                          </td>
                          <td className="p-3 text-xs max-w-[200px]">
                            {stat.error ? (
                              <span className="text-rose-400 font-mono text-[11px] line-clamp-2" title={stat.error}>
                                {stat.error}
                              </span>
                            ) : stat.found === 0 ? (
                              <span className="text-amber-400/80 text-[11px]">0 matching vacancies on page</span>
                            ) : (
                              <span className="text-emerald-400/80 text-[11px]">Harvested successfully</span>
                            )}
                          </td>
                          <td className="p-3 text-slate-400 text-[11px]">
                            {stat.completedAt ? new Date(stat.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recent'}
                          </td>
                          <td className="p-3 text-right space-x-1 whitespace-nowrap">
                            {stat.sourceId && (
                              <>
                                <button
                                  type="button"
                                  disabled={isScrapingActive}
                                  onClick={() => handleRetrySources([stat.sourceId], false)}
                                  className="p-1.5 bg-amber-600/20 hover:bg-amber-600/40 text-amber-400 rounded-lg transition-all cursor-pointer inline-flex items-center disabled:opacity-50"
                                  title="Retry Source"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </button>
                                {sourceGroups.length > 0 && (
                                  <select
                                    value={sourceGroup?.id || ''}
                                    onChange={(e) => handleMoveSourceGroup(stat.sourceId, e.target.value || null)}
                                    aria-label="Change Group"
                                    className="px-2 py-1 bg-slate-950 border border-slate-700 text-[10px] text-slate-300 rounded-lg focus:outline-none"
                                    title="Move/Change Group"
                                  >
                                    <option value="">(No Group)</option>
                                    {sourceGroups.map(g => (
                                      <option key={g.id} value={g.id}>{g.name}</option>
                                    ))}
                                  </select>
                                )}
                              </>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <PaginationControls
                  currentPage={sourceStatsPage}
                  totalItems={filteredActiveSourcesStats.length}
                  pageSize={sourceStatsPageSize}
                  pageSizeOptions={[25, 50, 100]}
                  onPageChange={setSourceStatsPage}
                  onPageSizeChange={(sz) => {
                    setSourceStatsPageSize(sz);
                    setSourceStatsPage(1);
                  }}
                  labelSingular="source result"
                  labelPlural="source results"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* 5. DUPLICATES & REVIEW (Pending & Duplicate Jobs Queue)       */}
      {/* ============================================================= */}
      {activeStep === 'review' && (
        <div className="space-y-6">
          {/* Step Helper Banner */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <span>Step 5: Duplicates & Review — Pending & Duplicate Jobs Queue</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {effectivePendingList.length} in queue ({pendingOnlyCount} pending, {duplicateCount} duplicates)
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Approve, reject, or resolve duplicate scraped jobs using direct MongoDB operations. Changes sync immediately with the database.
              </p>
            </div>

            <div className="flex items-center space-x-2 flex-wrap gap-2">
              <button
                type="button"
                disabled={isRefreshingReview}
                onClick={handleRefreshReviewQueue}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 border border-slate-700"
                title="Reload fresh queue from MongoDB"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingReview ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveStep('settings')}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all shadow-md cursor-pointer"
              >
                <span>Continue to Step 6: Settings</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Real Multi-Select Bulk Actions Toolbar */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
              <div className="flex items-center space-x-2 flex-wrap gap-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Multi-Select:</span>
                <button
                  type="button"
                  onClick={handleSelectAllPending}
                  className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5"
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  <span>Select All Pending ({pendingOnlyCount})</span>
                </button>
                <button
                  type="button"
                  onClick={handleSelectAllDuplicates}
                  className="px-3 py-1.5 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Select All Duplicates ({duplicateCount})</span>
                </button>
                {nonJobsCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedReviewIds(effectivePendingList.filter(j => isNonJobRecord(j)).map(j => j.id))}
                    className="px-3 py-1.5 bg-slate-500/10 hover:bg-slate-500/20 text-slate-300 border border-slate-500/30 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Select Non-Jobs ({nonJobsCount})</span>
                  </button>
                )}
                {expiredCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedReviewIds(expiredJobsList.map(j => j.id))}
                    className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5"
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>Select All Expired ({expiredCount})</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleSelectAllFiltered}
                  className="px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5"
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  <span>Select All Filtered ({reviewItems.length})</span>
                </button>
                {selectedReviewIds.length > 0 && (
                  <button
                    type="button"
                    onClick={handleDeselectAllReview}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg text-xs transition-all cursor-pointer"
                  >
                    Clear Selection
                  </button>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <span className="text-xs font-semibold text-indigo-300 bg-indigo-950/60 border border-indigo-800/50 px-3 py-1 rounded-full">
                  {selectedReviewIds.length} Selected
                </span>
              </div>
            </div>

            {/* Execution Buttons (MongoDB Operations) */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                disabled={selectedReviewIds.length === 0 || isProcessingReview}
                onClick={handleApproveSelected}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center space-x-1.5 shadow-sm"
                title="Publish selected jobs to live listings via MongoDB"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Approve Selected ({selectedReviewIds.length})</span>
              </button>

              <button
                type="button"
                disabled={selectedReviewIds.length === 0 || isProcessingReview}
                onClick={handleOpenBulkQuickEdit}
                className="px-3.5 py-2 bg-amber-600/30 hover:bg-amber-600/50 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center space-x-1.5 shadow-sm"
                title="Open Bulk Quick Edit to edit missing fields across selected records"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Bulk Quick Edit ({selectedReviewIds.length})</span>
              </button>

              <button
                type="button"
                disabled={selectedReviewIds.length === 0}
                onClick={() => {
                  setTargetLocationJobIds(selectedReviewIds);
                  setIsLocationModalOpen(true);
                }}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center space-x-1.5"
                title="Bulk set province, city, and district for selected jobs"
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>Set Location ({selectedReviewIds.length})</span>
              </button>

              <button
                type="button"
                disabled={selectedReviewIds.length === 0 || isProcessingReview}
                onClick={() => handleBulkMarkNonJob()}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center space-x-1.5"
                title="Retain selected records in queue marked as Non-Job (e.g. notices, syllabus, circulars)"
              >
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                <span>Keep as Non-Job ({selectedReviewIds.length})</span>
              </button>

              {selectedNonJobsCount > 0 && (
                <button
                  type="button"
                  disabled={isProcessingReview}
                  onClick={async () => {
                    for (const id of selectedReviewIds) {
                      const item = effectivePendingList.find(j => j.id === id);
                      if (item && isNonJobRecord(item)) {
                        await handleConvertToJob(id);
                      }
                    }
                  }}
                  className="px-3.5 py-2 bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-200 border border-emerald-700/50 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5"
                  title="Convert selected Non-Job records back to standard Jobs"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Convert to Job ({selectedNonJobsCount})</span>
                </button>
              )}

              <button
                type="button"
                disabled={selectedReviewIds.length === 0 || isProcessingReview}
                onClick={handleRejectSelected}
                className="px-3.5 py-2 bg-slate-800 hover:bg-rose-900/50 text-slate-300 hover:text-rose-300 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center space-x-1.5 border border-slate-700"
                title="Reject selected jobs in MongoDB"
              >
                <X className="w-3.5 h-3.5" />
                <span>Reject Selected</span>
              </button>

              {selectedExpiredCount > 0 && (
                <>
                  <button
                    type="button"
                    disabled={isProcessingReview}
                    onClick={() => handleBulkRestoreExpiredJobs(selectedReviewIds)}
                    className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 shadow-sm"
                    title="Restore selected expired jobs back to Live status"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Restore Expired to Live ({selectedExpiredCount})</span>
                  </button>

                  <button
                    type="button"
                    disabled={isProcessingReview}
                    onClick={() => handleBulkPermanentDeleteJobs(selectedReviewIds)}
                    className="px-3.5 py-2 bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5"
                    title="Permanently remove selected expired jobs from database"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Expired ({selectedExpiredCount})</span>
                  </button>
                </>
              )}

              {selectedDuplicateCount > 0 && (
                <>
                  <button
                    type="button"
                    disabled={isProcessingReview}
                    onClick={handleDeleteSelectedDuplicates}
                    className="px-3.5 py-2 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/50 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5"
                    title="Delete selected duplicate jobs permanently from MongoDB pending collection"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Duplicates ({selectedDuplicateCount})</span>
                  </button>

                  <button
                    type="button"
                    disabled={isProcessingReview}
                    onClick={() => handleKeepOriginalDeleteDuplicates()}
                    className="px-3.5 py-2 bg-indigo-950/40 hover:bg-indigo-900/60 text-indigo-200 border border-indigo-800/50 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5"
                    title="Keep original active listing untouched, and remove selected duplicate from pending collection"
                  >
                    <Shield className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Keep Original + Delete Duplicates</span>
                  </button>

                  <button
                    type="button"
                    disabled={isProcessingReview}
                    onClick={() => handleOverwriteOriginalWithDuplicates()}
                    className="px-3.5 py-2 bg-amber-950/40 hover:bg-amber-900/60 text-amber-200 border border-amber-800/50 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5"
                    title="Overwrite original active jobs with this duplicate's data"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                    <span>Overwrite Original ({selectedDuplicateCount})</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Queue Filters & Tabs */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center space-x-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search jobs by title, company, or portal..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center space-x-1.5 flex-wrap gap-y-1.5">
              {[
                { id: 'all', label: 'All Records', count: reviewCounts.all },
                { id: 'jobs', label: 'Jobs', count: reviewCounts.jobs },
                { id: 'non_jobs', label: 'Non-Jobs', count: reviewCounts.non_jobs },
                { id: 'needs_review', label: 'Needs Review', count: reviewCounts.needs_review },
                { id: 'missing_description', label: 'Missing Desc', count: reviewCounts.missing_description },
                { id: 'missing_location', label: 'Missing Location', count: reviewCounts.missing_location },
                { id: 'missing_company', label: 'Missing Org', count: reviewCounts.missing_company },
                { id: 'missing_salary', label: 'Missing Salary', count: reviewCounts.missing_salary },
                { id: 'missing_deadline', label: 'Missing Deadline', count: reviewCounts.missing_deadline },
                { id: 'missing_experience', label: 'Missing Exp', count: reviewCounts.missing_experience },
                { id: 'missing_job_type', label: 'Missing Job Type', count: reviewCounts.missing_job_type },
                { id: 'pdf_document', label: 'PDF Docs', count: reviewCounts.pdf_document },
                { id: 'ocr_required', label: 'OCR Required', count: reviewCounts.ocr_required },
                { id: 'ocr_failed', label: 'OCR Failed', count: reviewCounts.ocr_failed },
                { id: 'duplicate', label: 'Duplicates', count: reviewCounts.duplicate },
                { id: 'expired', label: 'Expired', count: reviewCounts.expired },
              ].map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setReviewTypeFilter(tab.id as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                    reviewTypeFilter === tab.id
                      ? 'bg-indigo-600 text-white shadow'
                      : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                    reviewTypeFilter === tab.id ? 'bg-indigo-900/80 text-white' : 'bg-slate-800 text-slate-300'
                  }`}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Review Items List */}
          <div className="space-y-3">
            {reviewItems.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center space-y-3 shadow-lg">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                <h4 className="text-sm font-bold text-white">No items in this view</h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  No records match your selected criteria in this review filter.
                </p>
              </div>
            ) : (
              <>
                <div className="bg-slate-900/80 border border-slate-800 rounded-xl px-4 py-2.5 flex items-center justify-between text-xs text-slate-400">
                  <label className="flex items-center space-x-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      aria-label="Select all filtered jobs across all pages"
                      checked={reviewItems.length > 0 && reviewItems.every(j => selectedReviewIds.includes(j.id))}
                      onChange={(e) => {
                        if (e.target.checked) {
                          handleSelectAllFiltered();
                        } else {
                          const filteredIdSet = new Set(reviewItems.map(j => j.id));
                          setSelectedReviewIds(prev => prev.filter(id => !filteredIdSet.has(id)));
                          setStatusMessage({ text: `Deselected ${filteredIdSet.size} filtered items.`, type: 'info' });
                        }
                      }}
                      className="rounded bg-slate-800 border-slate-700 text-indigo-600 cursor-pointer"
                    />
                    <span className="font-semibold text-slate-300">
                      Select All Filtered ({reviewItems.length} records across all pages)
                    </span>
                  </label>
                  <div className="text-[11px] text-slate-500">
                    Showing page {reviewPage} of {Math.max(1, Math.ceil(reviewItems.length / reviewPageSize))}
                  </div>
                </div>

                {paginatedReviewItems.map(job => {
                  const isExpired = job.status === 'Expired';
                  const isDup = (job as any).isDuplicate || (job as any).duplicateWarning || job.description?.toLowerCase().includes('duplicate');
                  const isNonJob = isNonJobRecord(job);
                  const isNeedsReview = isNeedsReviewRecord(job);
                  const isOcrReq = isOcrRequired(job);
                  const isOcrFail = isOcrFailed(job);
                  const isPdf = isPdfDocumentJob(job);
                  const isSelected = selectedReviewIds.includes(job.id);
                  const missingFields = calculateJobMissingFields(job);
                  const hasMissingFields = isScrapedJob(job) && missingFields.length > 0;

                  return (
                    <div
                      key={job.id}
                      className={`bg-slate-900 border rounded-2xl p-5 transition-all shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                        isExpired
                          ? 'border-rose-800/40 bg-rose-950/10'
                          : isDup
                          ? 'border-purple-800/60 bg-purple-950/10'
                          : isNonJob
                          ? 'border-slate-700/60 bg-slate-950/40'
                          : isNeedsReview
                          ? 'border-amber-700/50 bg-amber-950/10'
                          : hasMissingFields
                          ? 'border-amber-700/50 bg-amber-950/10'
                          : 'border-slate-800'
                      }`}
                    >
                      <div className="flex items-start space-x-3.5 flex-1 min-w-0">
                        <input
                          type="checkbox"
                          aria-label={`Select job ${job.title}`}
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedReviewIds(prev => [...prev, job.id]);
                            } else {
                              setSelectedReviewIds(prev => prev.filter(id => id !== job.id));
                            }
                          }}
                          className="mt-1 rounded bg-slate-800 border-slate-700 text-indigo-600 cursor-pointer"
                        />

                        <div className="space-y-1.5 flex-1 min-w-0">
                          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                            <h4 className="text-sm font-black text-white">{job.title}</h4>
                            
                            {isExpired ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center space-x-1">
                                <Clock className="w-3 h-3" />
                                <span>Expired (Deadline: {job.deadlineDate || 'Passed'})</span>
                              </span>
                            ) : isDup ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center space-x-1">
                                <AlertTriangle className="w-3 h-3" />
                                <span>Duplicate Alert</span>
                              </span>
                            ) : isNonJob ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-700/40 text-slate-300 border border-slate-600/40 flex items-center space-x-1">
                                <FileText className="w-3 h-3 text-slate-400" />
                                <span>Non-Job ({job.nonJobClassificationReason || (job as any).nonJobReason || 'Notice/Document'})</span>
                              </span>
                            ) : isNeedsReview ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center space-x-1">
                                <AlertCircle className="w-3 h-3 text-amber-400" />
                                <span>Needs Review</span>
                              </span>
                            ) : null}

                            {isOcrReq && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-orange-500/20 text-orange-300 border border-orange-500/30 flex items-center space-x-1">
                                <FileText className="w-3 h-3 text-orange-400" />
                                <span>OCR Required</span>
                              </span>
                            )}

                            {isOcrFail && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center space-x-1" title={(job as any).documentProcessingError || 'OCR extraction failed'}>
                                <AlertCircle className="w-3 h-3 text-rose-400" />
                                <span>OCR Failed</span>
                              </span>
                            )}

                            {isPdf && !isOcrReq && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 flex items-center space-x-1">
                                <FileText className="w-3 h-3 text-cyan-400" />
                                <span>PDF Doc</span>
                              </span>
                            )}

                            {hasMissingFields && !isExpired && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center space-x-1" title={`Missing: ${missingFields.join(', ')}`}>
                                <AlertCircle className="w-3 h-3 text-rose-400" />
                                <span>Missing: {missingFields.join(', ')}</span>
                              </span>
                            )}

                            {!isExpired && !isDup && !isNonJob && !isNeedsReview && !hasMissingFields && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                Ready for Approval
                              </span>
                            )}
                          </div>

                          <p className="text-xs text-slate-400">
                            {job.company} • {job.region} • Source: <span className="text-indigo-400 font-semibold">{(job as any).sourcePortal || job.scraperSourceName || job.scrapedSourceDomain || 'External'}</span>
                            {job.deadlineDate && (
                              <span className="ml-2 text-slate-500">
                                • Official Deadline: <span className="text-amber-300/90 font-mono">{job.deadlineDate}</span>
                              </span>
                            )}
                            {(job.documentUrl || job.originalPostingUrl) && (
                              <a
                                href={job.documentUrl || job.originalPostingUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="ml-2 text-indigo-400 hover:text-indigo-300 inline-flex items-center space-x-0.5 font-medium underline"
                              >
                                <span>View Source</span>
                                <ExternalLink className="w-3 h-3 ml-0.5" />
                              </a>
                            )}
                          </p>

                          {hasMissingFields && !isExpired && (
                            <p className="text-[11px] text-amber-300/90 pt-0.5 flex items-center space-x-1 font-medium">
                              <AlertCircle className="w-3 h-3 flex-shrink-0 text-amber-400" />
                              <span>Missing required factual data: <strong className="text-rose-300">{missingFields.join(', ')}</strong>. Complete via Quick Edit before publishing.</span>
                            </p>
                          )}

                          {isNonJob && (
                            <p className="text-[11px] text-slate-400 pt-0.5">
                              Retained as Non-Job: {job.nonJobClassificationReason || (job as any).nonJobReason || 'Scraped document was classified as an informational notice, syllabus, or general advertisement rather than a direct vacancy.'}
                            </p>
                          )}

                          {(job as any).documentProcessingError && (
                            <p className="text-[11px] text-rose-300/90 pt-0.5 font-mono">
                              Document notice: {(job as any).documentProcessingError}
                            </p>
                          )}

                          {isExpired && (
                            <p className="text-[11px] text-rose-300/80 pt-0.5">
                              Notice: This job passed its application deadline and was transitioned to Expired by the portal scheduler.
                            </p>
                          )}

                          {isDup && !isExpired && (
                            <p className="text-[11px] text-purple-300/80 pt-0.5">
                              Notice: A job with a very similar title and employer already exists in active listings.
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 flex-wrap gap-2">
                        {!isExpired && (
                          <button
                            type="button"
                            onClick={() => {
                              setBulkEditingJobs([]);
                              setQuickEditingJob(job);
                              setIsQuickEditOpen(true);
                            }}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-bold flex items-center space-x-1 transition-all cursor-pointer"
                            title="Edit job and complete missing fields"
                          >
                            <Edit3 className="w-3 h-3 text-amber-400" />
                            <span>Quick Edit</span>
                          </button>
                        )}

                        {isExpired ? (
                          <>
                            <button
                              type="button"
                              disabled={isProcessingReview}
                              onClick={() => handleRestoreExpiredJob(job.id)}
                              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center space-x-1 transition-all cursor-pointer disabled:opacity-50"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Restore to Live</span>
                            </button>

                            <button
                              type="button"
                              disabled={isProcessingReview}
                              onClick={() => handlePermanentDeleteJob(job.id)}
                              className="px-3 py-1.5 bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/40 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete</span>
                            </button>
                          </>
                        ) : isDup ? (
                          <>
                            <button
                              type="button"
                              disabled={isProcessingReview}
                              onClick={() => handleKeepOriginalDeleteDuplicates(job.id)}
                              className="px-3 py-1.5 bg-indigo-950/60 hover:bg-indigo-900/80 text-indigo-200 border border-indigo-700/50 rounded-xl text-xs font-bold flex items-center space-x-1 transition-all cursor-pointer disabled:opacity-50"
                              title="Keep original active job and delete duplicate"
                            >
                              <Shield className="w-3.5 h-3.5 text-indigo-400" />
                              <span>Keep Original</span>
                            </button>

                            <button
                              type="button"
                              disabled={isProcessingReview}
                              onClick={() => handleOverwriteOriginalWithDuplicates(job.id)}
                              className="px-3 py-1.5 bg-amber-950/60 hover:bg-amber-900/80 text-amber-200 border border-amber-700/50 rounded-xl text-xs font-bold flex items-center space-x-1 transition-all cursor-pointer disabled:opacity-50"
                              title="Overwrite original active job with this duplicate's data"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                              <span>Overwrite Original</span>
                            </button>

                            <button
                              type="button"
                              disabled={isProcessingReview}
                              onClick={async () => {
                                setIsProcessingReview(true);
                                try {
                                  const res = await api.jobs.bulkDeleteDuplicates([job.id]);
                                  if (res?.success) {
                                    setStatusMessage({ text: 'Duplicate job removed from MongoDB.', type: 'success' });
                                    await fetchPendingQueue();
                                  }
                                } catch (err: any) {
                                  setStatusMessage({ text: `Delete error: ${err.message}`, type: 'error' });
                                } finally {
                                  setIsProcessingReview(false);
                                }
                              }}
                              className="px-2.5 py-1.5 bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/40 rounded-xl text-xs font-bold transition-all cursor-pointer"
                              title="Delete this duplicate"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : isNonJob ? (
                          <>
                            <button
                              type="button"
                              disabled={isProcessingReview}
                              onClick={() => handleConvertToJob(job.id)}
                              className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center space-x-1 transition-all cursor-pointer disabled:opacity-50"
                              title="Convert this record back to a standard Job"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Convert to Job</span>
                            </button>

                            <button
                              type="button"
                              disabled={isProcessingReview}
                              onClick={async () => {
                                setIsProcessingReview(true);
                                try {
                                  const res = await api.jobs.bulkReject([job.id], 'Deleted non-job record');
                                  if (res?.success) {
                                    setStatusMessage({ text: 'Non-job record deleted.', type: 'info' });
                                    await fetchPendingQueue();
                                  }
                                } catch (err: any) {
                                  setStatusMessage({ text: `Delete error: ${err.message}`, type: 'error' });
                                } finally {
                                  setIsProcessingReview(false);
                                }
                              }}
                              className="px-2.5 py-1.5 bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/40 rounded-xl text-xs font-bold transition-all cursor-pointer"
                              title="Delete non-job record"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              disabled={isProcessingReview}
                              onClick={async () => {
                                if (hasMissingFields) {
                                  setStatusMessage({
                                    text: `Cannot approve "${job.title}": Missing required factual fields (${missingFields.join(', ')}). Please complete them via Quick Edit before publishing.`,
                                    type: 'error'
                                  });
                                  setBulkEditingJobs([]);
                                  setQuickEditingJob(job);
                                  setIsQuickEditOpen(true);
                                  return;
                                }
                                setIsProcessingReview(true);
                                try {
                                  const res = await api.jobs.bulkApprove([job.id]);
                                  if (res?.success) {
                                    if (res.skippedMissingFieldsCount > 0) {
                                      setStatusMessage({
                                        text: `Cannot approve "${job.title}": Missing required fields (${missingFields.join(', ')}).`,
                                        type: 'error'
                                      });
                                    } else {
                                      setStatusMessage({ text: `Approved "${job.title}" to live listings!`, type: 'success' });
                                      await fetchPendingQueue();
                                      if (onReloadJobs) await onReloadJobs();
                                    }
                                  } else {
                                    setStatusMessage({ text: res?.message || 'Failed to approve job.', type: 'error' });
                                  }
                                } catch (err: any) {
                                  setStatusMessage({ text: `Approve error: ${err.message}`, type: 'error' });
                                } finally {
                                  setIsProcessingReview(false);
                                }
                              }}
                              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1 transition-all cursor-pointer disabled:opacity-50 ${
                                hasMissingFields
                                  ? 'bg-amber-600/70 hover:bg-amber-600 text-amber-100 border border-amber-500/40'
                                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                              }`}
                              title={hasMissingFields ? `Missing: ${missingFields.join(', ')} - Click to Quick Edit` : 'Approve job to live listings'}
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>{hasMissingFields ? 'Complete & Approve' : 'Approve to Live'}</span>
                            </button>

                            <button
                              type="button"
                              disabled={isProcessingReview}
                              onClick={() => handleBulkMarkNonJob(job.id)}
                              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                              title="Keep as Non-Job (tender, notice, circular)"
                            >
                              <FileText className="w-3 h-3 text-slate-400" />
                              <span>Non-Job</span>
                            </button>

                            <button
                              type="button"
                              disabled={isProcessingReview}
                              onClick={async () => {
                                setIsProcessingReview(true);
                                try {
                                  const res = await api.jobs.bulkReject([job.id], 'Rejected from Duplicates & Review');
                                  if (res?.success) {
                                    setStatusMessage({ text: `Rejected "${job.title}".`, type: 'info' });
                                    await fetchPendingQueue();
                                  }
                                } catch (err: any) {
                                  setStatusMessage({ text: `Reject error: ${err.message}`, type: 'error' });
                                } finally {
                                  setIsProcessingReview(false);
                                }
                              }}
                              className="px-3 py-1.5 bg-slate-800 hover:bg-rose-900/50 text-slate-300 hover:text-rose-300 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                            >
                              Reject
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                <PaginationControls
                  currentPage={reviewPage}
                  totalItems={reviewItems.length}
                  pageSize={reviewPageSize}
                  onPageChange={setReviewPage}
                  onPageSizeChange={(sz) => {
                    setReviewPageSize(sz);
                    setReviewPage(1);
                  }}
                  labelSingular="review item"
                  labelPlural="review items"
                />
              </div>
            </>
            )}
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* 4. HISTORY (Real backend scraper runs only)                   */}
      {/* ============================================================= */}
      {activeStep === 'history' && (
        <div className="space-y-6">
          {/* Step Helper Banner */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <span>Step 4: History — Real Backend Scraper Runs</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300">
                  {liveRuns.length} recorded
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                View previous scraper runs saved in MongoDB. Inspect how many jobs were found, approved, or if any errors occurred.
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={handleExportRunsCSV}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Export CSV</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveStep('review')}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all shadow-md cursor-pointer"
              >
                <span>Continue to Step 5: Duplicates & Review</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* History Filters */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center space-x-2 flex-1 min-w-[240px]">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search runs by ID or message..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                {(['all', 'today', '7days', '30days'] as const).map(d => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDateFilter(d)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      dateFilter === d
                        ? 'bg-indigo-600 text-white shadow'
                        : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    {d === 'all' ? 'All Time' : d === 'today' ? 'Today' : d === '7days' ? 'Past 7 Days' : 'Past 30 Days'}
                  </button>
                ))}
              </div>
            </div>

            {/* Run Result Filters & Sorting */}
            <div className="pt-3 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {/* Run Status */}
              <div className="flex items-center space-x-1.5">
                <span className="text-[11px] text-slate-500 shrink-0">Status:</span>
                <select
                  value={runStatusFilter}
                  onChange={(e) => setRunStatusFilter(e.target.value as any)}
                  aria-label="Filter by Run Status"
                  className="w-full px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none cursor-pointer"
                >
                  <option value="all">All</option>
                  <option value="Completed">Completed</option>
                  <option value="Partial">Partial</option>
                  <option value="Failed">Failed</option>
                </select>
              </div>

              {/* Sort By */}
              <div className="flex items-center space-x-1.5">
                <span className="text-[11px] text-slate-500 shrink-0">Sort By:</span>
                <select
                  value={runSortBy}
                  onChange={(e) => setRunSortBy(e.target.value as any)}
                  aria-label="Sort Runs"
                  className="w-full px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none cursor-pointer"
                >
                  <option value="date_desc">Date: Newest first</option>
                  <option value="date_asc">Date: Oldest first</option>
                  <option value="found_desc">Jobs Found: High → Low</option>
                  <option value="found_asc">Jobs Found: Low → High</option>
                  <option value="dup_desc">Duplicates: High → Low</option>
                  <option value="dup_asc">Duplicates: Low → High</option>
                </select>
              </div>

              {/* Found Min/Max */}
              <div className="flex items-center space-x-1.5 text-xs text-slate-400">
                <span className="text-[11px] text-slate-500 font-medium shrink-0">Found:</span>
                <input
                  type="number"
                  placeholder="Min"
                  min="0"
                  value={runMinFound}
                  onChange={(e) => setRunMinFound(e.target.value)}
                  className="w-16 px-2 py-1 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-600 focus:outline-none"
                />
                <span className="text-slate-600">–</span>
                <input
                  type="number"
                  placeholder="Max"
                  min="0"
                  value={runMaxFound}
                  onChange={(e) => setRunMaxFound(e.target.value)}
                  className="w-16 px-2 py-1 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-600 focus:outline-none"
                />
              </div>

              {/* Duplicates Min/Max & Reset */}
              <div className="flex items-center space-x-1.5 text-xs text-slate-400">
                <span className="text-[11px] text-slate-500 font-medium shrink-0">Dups:</span>
                <input
                  type="number"
                  placeholder="Min"
                  min="0"
                  value={runMinDup}
                  onChange={(e) => setRunMinDup(e.target.value)}
                  className="w-16 px-2 py-1 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-600 focus:outline-none"
                />
                <span className="text-slate-600">–</span>
                <input
                  type="number"
                  placeholder="Max"
                  min="0"
                  value={runMaxDup}
                  onChange={(e) => setRunMaxDup(e.target.value)}
                  className="w-16 px-2 py-1 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-600 focus:outline-none"
                />

                {(runStatusFilter !== 'all' || runMinFound || runMaxFound || runMinDup || runMaxDup || runSortBy !== 'date_desc') && (
                  <button
                    type="button"
                    onClick={() => {
                      setRunStatusFilter('all');
                      setRunMinFound('');
                      setRunMaxFound('');
                      setRunMinDup('');
                      setRunMaxDup('');
                      setRunSortBy('date_desc');
                    }}
                    className="px-2 py-1 text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-all cursor-pointer shrink-0"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* History Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            {filteredRuns.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <Clock className="w-10 h-10 text-slate-600 mx-auto" />
                <h4 className="text-sm font-bold text-slate-300">No data yet</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Historical runs will appear here as the scraper executes in the background or manually.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/80 text-slate-400 font-bold border-b border-slate-800">
                    <tr>
                      <th className="p-4">Run ID</th>
                      <th className="p-4">Started At</th>
                      <th className="p-4 text-center">Found</th>
                      <th className="p-4 text-center">Approved</th>
                      <th className="p-4 text-center">Duplicates</th>
                      <th className="p-4 text-center">Status</th>
                      <th className="p-4 text-right">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {paginatedRuns.map(run => (
                      <tr key={run.runId || run.id} className="hover:bg-slate-800/40 transition-all">
                        <td className="p-4 font-mono font-bold text-white">
                          {run.runId || run.id}
                        </td>
                        <td className="p-4 text-slate-400">
                          {run.startedAt ? new Date(run.startedAt).toLocaleString() : run.timestamp || 'Recent'}
                        </td>
                        <td className="p-4 text-center font-bold text-indigo-400">
                          {run.totalFound || 0}
                        </td>
                        <td className="p-4 text-center font-bold text-emerald-400">
                          {run.approvedCount || run.jobsAccepted || 0}
                        </td>
                        <td className="p-4 text-center text-purple-400">
                          {run.totalDuplicates || 0}
                        </td>
                        <td className="p-4 text-center">
                          {(() => {
                            const resolvedStatus = getRunResolvedStatus(run);
                            return (
                              <span
                                className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                  resolvedStatus === 'Completed'
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                    : resolvedStatus === 'Partial'
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                }`}
                              >
                                {resolvedStatus}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="p-4 text-right">
                          <button
                            type="button"
                            onClick={() => setInspectingRun(run)}
                            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold cursor-pointer"
                          >
                            View Log
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <PaginationControls
                  currentPage={runsPage}
                  totalItems={filteredRuns.length}
                  pageSize={runsPageSize}
                  onPageChange={setRunsPage}
                  onPageSizeChange={(sz) => {
                    setRunsPageSize(sz);
                    setRunsPage(1);
                  }}
                  labelSingular="run"
                  labelPlural="runs"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* STEP 6: SETTINGS (Scheduler & Scraper Settings)               */}
      {/* ============================================================= */}
      {activeStep === 'settings' && (
        <div className="space-y-6">
          {/* Step Helper Banner */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <span>Step 6: Scheduler & Scraper Settings</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Configure background scheduler frequency, target keywords, and automated approval rules.
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setActiveStep('overview')}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Back to Step 1: Overview
              </button>
              <button
                type="button"
                onClick={handleSaveSettings}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer flex items-center space-x-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Save Settings to Database</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Automatic Scheduler Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-lg">
              <h4 className="text-sm font-bold text-white flex items-center space-x-2">
                <Clock className="w-4 h-4 text-indigo-400" />
                <span>Automatic Background Scheduler</span>
              </h4>
              <p className="text-xs text-slate-400">
                The scheduler runs automatically in the background on the server to harvest new vacancies.
              </p>

              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <div>
                    <span className="text-xs font-bold text-white block">Scheduler Status</span>
                    <span className="text-[11px] text-slate-400">Enable automatic periodic scans</span>
                  </div>
                  <input
                    type="checkbox"
                    aria-label="Scheduler Status"
                    checked={globalSchedulerEnabled}
                    onChange={(e) => setGlobalSchedulerEnabled(e.target.checked)}
                    className="rounded bg-slate-800 border-slate-700 text-indigo-600 cursor-pointer"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1.5">
                    How Often to Run (Frequency)
                  </label>
                  <select
                    value={globalInterval}
                    onChange={(e) => setGlobalInterval(e.target.value)}
                    aria-label="How Often to Run"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none"
                  >
                    <option value="15m">Every 15 minutes</option>
                    <option value="30m">Every 30 minutes</option>
                    <option value="1h">Every 1 hour</option>
                    <option value="6h">Every 6 hours</option>
                    <option value="12h">Every 12 hours</option>
                    <option value="24h">Every 24 hours (Daily)</option>
                    <option value="7d">Every 7 days (Weekly)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Scraping Rules & Preferences */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-lg">
              <h4 className="text-sm font-bold text-white flex items-center space-x-2">
                <Sliders className="w-4 h-4 text-purple-400" />
                <span>Scraping Preferences</span>
              </h4>
              <p className="text-xs text-slate-400">
                Control crawl depth, keywords, and automatic approval thresholds.
              </p>

              <div className="space-y-4 pt-2">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1.5">
                    Scan Depth per Website
                  </label>
                  <select
                    value={globalDepth}
                    onChange={(e) => setGlobalDepth(e.target.value)}
                    aria-label="Scan Depth per Website"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none"
                  >
                    <option value="Light (10 Jobs)">Light (10 Jobs per portal)</option>
                    <option value="Standard (25 Jobs)">Standard (25 Jobs per portal)</option>
                    <option value="Deep Crawl (50+ Jobs)">Deep Crawl (50+ Jobs per portal)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1.5">
                    Target Job Keywords (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={globalKeywords}
                    onChange={(e) => setGlobalKeywords(e.target.value)}
                    placeholder="e.g. engineer, officer, manager, teacher, lecturer"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <div>
                    <span className="text-xs font-bold text-white block">Auto-Approval</span>
                    <span className="text-[11px] text-slate-400">Automatically publish high-confidence jobs</span>
                  </div>
                  <input
                    type="checkbox"
                    aria-label="Auto-Approval"
                    checked={globalAutoApprove}
                    onChange={(e) => setGlobalAutoApprove(e.target.checked)}
                    className="rounded bg-slate-800 border-slate-700 text-indigo-600 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Portal Expiry Lifespan Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-lg md:col-span-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center space-x-2">
                    <Calendar className="w-4 h-4 text-amber-400" />
                    <span>Portal Expiry Lifespan & Application Deadlines</span>
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Preserves the REAL source application deadline in <code className="text-indigo-300 font-mono">deadlineDate</code>. Automates transition from live to Expired when current date exceeds the source deadline plus the configured portal offset.
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    disabled={isScanningExpiry}
                    onClick={handleScanExpiryNow}
                    className="px-3.5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer flex items-center space-x-1.5 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isScanningExpiry ? 'animate-spin' : ''}`} />
                    <span>Run Expiry Scan Now</span>
                  </button>
                  <button
                    type="button"
                    disabled={isSavingExpiry}
                    onClick={handleSaveExpiryOffset}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer flex items-center space-x-1.5 disabled:opacity-50"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Save Expiry Setting</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
                <div
                  onClick={() => setExpiryOffsetDays(0)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${
                    expiryOffsetDays === 0
                      ? 'bg-indigo-950/40 border-indigo-500/60 ring-1 ring-indigo-500/30'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">0 Days (Strict)</span>
                    <input
                      type="radio"
                      name="expiryOffset"
                      checked={expiryOffsetDays === 0}
                      onChange={() => setExpiryOffsetDays(0)}
                      className="text-indigo-600 focus:ring-0"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-2">
                    Jobs expire immediately at the stroke of midnight on the exact application deadline date.
                  </p>
                </div>

                <div
                  onClick={() => setExpiryOffsetDays(1)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${
                    expiryOffsetDays === 1
                      ? 'bg-indigo-950/40 border-indigo-500/60 ring-1 ring-indigo-500/30'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">+1 Day (Default)</span>
                    <input
                      type="radio"
                      name="expiryOffset"
                      checked={expiryOffsetDays === 1}
                      onChange={() => setExpiryOffsetDays(1)}
                      className="text-indigo-600 focus:ring-0"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-2">
                    Remains live through the closing day, transitioning to Expired the following morning.
                  </p>
                </div>

                <div
                  onClick={() => setExpiryOffsetDays(2)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${
                    expiryOffsetDays === 2
                      ? 'bg-indigo-950/40 border-indigo-500/60 ring-1 ring-indigo-500/30'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">+2 Days (Grace Period)</span>
                    <input
                      type="radio"
                      name="expiryOffset"
                      checked={expiryOffsetDays === 2}
                      onChange={() => setExpiryOffsetDays(2)}
                      className="text-indigo-600 focus:ring-0"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-2">
                    Provides a 48-hour buffer allowing jobseekers to view archived vacancies just past closing.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* MODAL: ADD NEW SOURCE (Simple English Inputs)                  */}
      {/* ============================================================= */}
      {isAddSourceOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">Add New Job Source</h3>
              <button
                type="button"
                onClick={() => setIsAddSourceOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddNewSource} className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-slate-300 block mb-1">Source Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Punjab Public Service Commission"
                  value={newSourceName}
                  onChange={(e) => setNewSourceName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">Website URL or PDF Endpoint *</label>
                <input
                  type="url"
                  required
                  placeholder="https://ppsc.gop.pk/jobs"
                  value={newSourceUrl}
                  onChange={(e) => setNewSourceUrl(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-300 block mb-1">Category</label>
                  <select
                    value={newSourceCategory}
                    onChange={(e) => setNewSourceCategory(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none"
                  >
                    <option value="Government Sector">Government Sector</option>
                    <option value="Testing Agency">Testing Agency</option>
                    <option value="Corporate">Corporate Portals</option>
                    <option value="International / Gulf">International / Gulf</option>
                    <option value="Newspaper Feed">Newspaper Feeds</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-300 block mb-1">Region</label>
                  <select
                    value={newSourceRegion}
                    onChange={(e) => setNewSourceRegion(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none"
                  >
                    <option value="Pakistan">Pakistan (All)</option>
                    <option value="Punjab">Punjab</option>
                    <option value="Sindh">Sindh</option>
                    <option value="KPK">KPK</option>
                    <option value="Balochistan">Balochistan</option>
                    <option value="Federal / Islamabad">Federal</option>
                    <option value="Gulf / Middle East">Gulf</option>
                  </select>
                </div>
              </div>

              {/* Source Location Targeting */}
              <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-200">Source Location Targeting</span>
                  <div className="flex items-center space-x-1.5">
                    <input
                      type="checkbox"
                      id="newSourceUseLocation"
                      checked={newSourceUseLocation}
                      onChange={(e) => setNewSourceUseLocation(e.target.checked)}
                      className="rounded bg-slate-800 border-slate-700 text-indigo-600 cursor-pointer"
                    />
                    <label htmlFor="newSourceUseLocation" className="text-[11px] text-slate-300 cursor-pointer">
                      Use as fallback for scraped jobs
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-0.5">Province</label>
                    <input
                      type="text"
                      placeholder="e.g. Punjab"
                      value={newSourceProvince}
                      onChange={(e) => setNewSourceProvince(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-white text-[11px] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-0.5">City</label>
                    <input
                      type="text"
                      placeholder="e.g. Lahore"
                      value={newSourceCity}
                      onChange={(e) => setNewSourceCity(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-white text-[11px] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-0.5">District</label>
                    <input
                      type="text"
                      placeholder="e.g. Lahore"
                      value={newSourceDistrict}
                      onChange={(e) => setNewSourceDistrict(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-white text-[11px] focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-300 block mb-1">Run Frequency</label>
                  <select
                    value={newSourceInterval}
                    onChange={(e) => setNewSourceInterval(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none"
                  >
                    <option value="15m">Every 15m</option>
                    <option value="1h">Every 1 hour</option>
                    <option value="6h">Every 6 hours</option>
                    <option value="24h">Every 24 hours</option>
                    <option value="7d">Every 7 days</option>
                  </select>
                </div>

                <div className="flex items-center space-x-2 pt-5">
                  <input
                    type="checkbox"
                    id="newSourceAutoApprove"
                    checked={newSourceAutoApprove}
                    onChange={(e) => setNewSourceAutoApprove(e.target.checked)}
                    className="rounded bg-slate-800 border-slate-700 text-indigo-600 cursor-pointer"
                  />
                  <label htmlFor="newSourceAutoApprove" className="font-bold text-slate-300 cursor-pointer">
                    Auto-Approve Jobs
                  </label>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">Keywords Filter (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Officer, Engineer, Clerk, Specialist"
                  value={newSourceKeywords}
                  onChange={(e) => setNewSourceKeywords(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none"
                />
              </div>

              <div className="pt-3 flex items-center justify-end space-x-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddSourceOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold"
                >
                  Add Source
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* MODAL: SOURCE GROUPS MANAGEMENT                               */}
      {/* ============================================================= */}
      {isGroupModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Folder className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">Source Groups Manager</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300">
                  {sourceGroups.length} Groups
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsGroupModalOpen(false);
                  setEditingGroup(null);
                  setGroupNameInput('');
                  setGroupDescInput('');
                }}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Create / Edit Group Inline Form */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3">
              <h4 className="text-xs font-bold text-slate-200">
                {groupModalMode === 'edit' ? `Rename Group: ${editingGroup?.name}` : 'Create New Group'}
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Group Name (e.g. Government Portals, Punjab Exams)..."
                  value={groupNameInput}
                  onChange={(e) => setGroupNameInput(e.target.value)}
                  className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
                <input
                  type="text"
                  placeholder="Description (optional)..."
                  value={groupDescInput}
                  onChange={(e) => setGroupDescInput(e.target.value)}
                  className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="flex justify-end space-x-2 pt-1">
                {groupModalMode === 'edit' && (
                  <button
                    type="button"
                    onClick={() => {
                      setGroupModalMode('create');
                      setEditingGroup(null);
                      setGroupNameInput('');
                      setGroupDescInput('');
                    }}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold cursor-pointer"
                  >
                    Cancel Edit
                  </button>
                )}
                <button
                  type="button"
                  disabled={!groupNameInput.trim()}
                  onClick={handleSaveGroup}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                >
                  {groupModalMode === 'edit' ? 'Save Changes' : '+ Create Group'}
                </button>
              </div>
            </div>

            {/* List of Existing Groups */}
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                Configured Groups
              </span>
              {sourceGroups.length === 0 ? (
                <div className="p-6 text-center border border-dashed border-slate-800 rounded-xl text-xs text-slate-500">
                  No source groups configured yet. Create one above to organize your portals!
                </div>
              ) : (
                sourceGroups.map(group => {
                  const memberSources = sourcesList.filter(s => group.sourceIds?.includes(s.id));

                  return (
                    <div
                      key={group.id}
                      className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-bold text-white">{group.name}</span>
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-800 text-slate-300">
                            {group.sourceIds?.length || 0} sources
                          </span>
                        </div>
                        {group.description && (
                          <p className="text-xs text-slate-400">{group.description}</p>
                        )}
                        {memberSources.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-1">
                            {memberSources.map(s => (
                              <span
                                key={s.id}
                                className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] bg-indigo-950/50 text-indigo-300 border border-indigo-800/40"
                              >
                                <span>{s.name}</span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveSourcesFromGroup(group.id, [s.id])}
                                  className="text-slate-400 hover:text-rose-300 ml-1 cursor-pointer"
                                  title={`Remove ${s.name} from ${group.name}`}
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center space-x-2 flex-shrink-0">
                        <button
                          type="button"
                          disabled={isScrapingActive || group.sourceIds.length === 0}
                          onClick={() => {
                            setIsGroupModalOpen(false);
                            handleRunGroup(group.id);
                            setActiveStep('run');
                          }}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center space-x-1 cursor-pointer disabled:opacity-50"
                          title="Run all sources in this group"
                        >
                          <Play className="w-3 h-3" />
                          <span>Run</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setGroupModalMode('edit');
                            setEditingGroup(group);
                            setGroupNameInput(group.name);
                            setGroupDescInput(group.description || '');
                          }}
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs cursor-pointer"
                          title="Rename / Edit"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteGroup(group.id)}
                          className="p-1.5 bg-slate-800 hover:bg-rose-900/50 text-slate-400 hover:text-rose-300 rounded-lg text-xs cursor-pointer"
                          title="Delete group"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-2 flex justify-end border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setIsGroupModalOpen(false);
                  setEditingGroup(null);
                  setGroupNameInput('');
                  setGroupDescInput('');
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* MODAL: INSPECT RUN DETAILS                                    */}
      {/* ============================================================= */}
      {inspectingRun && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">
                  Run Details: <span className="font-mono text-indigo-400">{inspectingRun.runId || inspectingRun.id}</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Started at {inspectingRun.startedAt || inspectingRun.timestamp || 'Unknown'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectingRun(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-4 gap-3 text-center">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 font-bold block">Total Discovered</span>
                <span className="text-base font-black text-indigo-400 mt-0.5 block">{inspectingRun.totalFound || 0}</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 font-bold block">Approved</span>
                <span className="text-base font-black text-emerald-400 mt-0.5 block">{inspectingRun.approvedCount || inspectingRun.jobsAccepted || 0}</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 font-bold block">Duplicates</span>
                <span className="text-base font-black text-purple-400 mt-0.5 block">{inspectingRun.totalDuplicates || 0}</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 font-bold block">Status</span>
                <span className="text-xs font-black text-white mt-1 block">{inspectingRun.status}</span>
              </div>
            </div>

            <div className="space-y-1 text-xs">
              <span className="font-bold text-slate-300">Run Summary Message:</span>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 font-mono text-[11px] text-slate-400">
                {inspectingRun.message || 'No additional log messages recorded for this execution.'}
              </div>
            </div>

            {Array.isArray(inspectingRun.sourcesStats) && inspectingRun.sourcesStats.length > 0 && (
              <div className="space-y-2 text-xs">
                <span className="font-bold text-slate-300">Sources Breakdown ({inspectingRun.sourcesStats.length} sources):</span>
                <div className="max-h-48 overflow-y-auto border border-slate-800 rounded-xl bg-slate-950 p-2 divide-y divide-slate-850">
                  {inspectingRun.sourcesStats.map((st: any, i: number) => (
                    <div key={i} className="py-1.5 flex items-center justify-between text-[11px]">
                      <div className="flex items-center space-x-2 truncate max-w-[280px]">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${st.found > 0 && !st.failed ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                        <span className="font-bold text-slate-200 truncate">{st.sourceName}</span>
                      </div>
                      <div className="flex items-center space-x-3 text-slate-400 text-[10px]">
                        <span className="text-emerald-400 font-bold">{st.found || 0} jobs</span>
                        {st.error ? (
                          <span className="text-rose-400 truncate max-w-[120px]" title={st.error}>{st.error}</span>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setInspectingRun(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* MODAL: EDIT SOURCE                                            */}
      {/* ============================================================= */}
      {isEditSourceOpen && editingSourceItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">Edit Job Source</h3>
              <button
                type="button"
                onClick={() => {
                  setIsEditSourceOpen(false);
                  setEditingSourceItem(null);
                }}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditSource} className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-slate-300 block mb-1">Source Name *</label>
                <input
                  type="text"
                  required
                  value={editingSourceItem.name}
                  onChange={(e) => setEditingSourceItem({ ...editingSourceItem, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">Website URL or PDF Endpoint *</label>
                <input
                  type="url"
                  required
                  value={editingSourceItem.url}
                  onChange={(e) => setEditingSourceItem({ ...editingSourceItem, url: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-300 block mb-1">Category</label>
                  <select
                    value={editingSourceItem.category}
                    onChange={(e) => setEditingSourceItem({ ...editingSourceItem, category: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none"
                  >
                    <option value="Government Sector">Government Sector</option>
                    <option value="Testing Agency">Testing Agency</option>
                    <option value="Corporate">Corporate Portals</option>
                    <option value="International / Gulf">International / Gulf</option>
                    <option value="Newspaper Feed">Newspaper Feeds</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-300 block mb-1">Region</label>
                  <select
                    value={editingSourceItem.region}
                    onChange={(e) => setEditingSourceItem({ ...editingSourceItem, region: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none"
                  >
                    <option value="Pakistan">Pakistan (All)</option>
                    <option value="Punjab">Punjab</option>
                    <option value="Sindh">Sindh</option>
                    <option value="KPK">KPK</option>
                    <option value="Balochistan">Balochistan</option>
                    <option value="Federal / Islamabad">Federal</option>
                    <option value="Gulf / Middle East">Gulf</option>
                  </select>
                </div>
              </div>

              {/* Source Location Targeting */}
              <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-200">Source Location Targeting</span>
                  <div className="flex items-center space-x-1.5">
                    <input
                      type="checkbox"
                      id="editSourceUseLocation"
                      checked={editingSourceItem.useSourceLocation ?? true}
                      onChange={(e) => setEditingSourceItem({ ...editingSourceItem, useSourceLocation: e.target.checked })}
                      className="rounded bg-slate-800 border-slate-700 text-indigo-600 cursor-pointer"
                    />
                    <label htmlFor="editSourceUseLocation" className="text-[11px] text-slate-300 cursor-pointer">
                      Use as fallback for scraped jobs
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-0.5">Province</label>
                    <input
                      type="text"
                      placeholder="e.g. Punjab"
                      value={editingSourceItem.province || ''}
                      onChange={(e) => setEditingSourceItem({ ...editingSourceItem, province: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-white text-[11px] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-0.5">City</label>
                    <input
                      type="text"
                      placeholder="e.g. Lahore"
                      value={editingSourceItem.city || ''}
                      onChange={(e) => setEditingSourceItem({ ...editingSourceItem, city: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-white text-[11px] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-0.5">District</label>
                    <input
                      type="text"
                      placeholder="e.g. Lahore"
                      value={editingSourceItem.district || ''}
                      onChange={(e) => setEditingSourceItem({ ...editingSourceItem, district: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-white text-[11px] focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-300 block mb-1">Run Frequency</label>
                  <select
                    value={editingSourceItem.interval}
                    onChange={(e) => setEditingSourceItem({ ...editingSourceItem, interval: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none"
                  >
                    <option value="15m">Every 15m</option>
                    <option value="30m">Every 30m</option>
                    <option value="1h">Every 1 hour</option>
                    <option value="6h">Every 6 hours</option>
                    <option value="24h">Every 24 hours</option>
                    <option value="7d">Every 7 days</option>
                  </select>
                </div>

                <div className="flex items-center space-x-2 pt-5">
                  <input
                    type="checkbox"
                    id="editSourceAutoApprove"
                    checked={editingSourceItem.autoApprove ?? false}
                    onChange={(e) => setEditingSourceItem({ ...editingSourceItem, autoApprove: e.target.checked })}
                    className="rounded bg-slate-800 border-slate-700 text-indigo-600 cursor-pointer"
                  />
                  <label htmlFor="editSourceAutoApprove" className="font-bold text-slate-300 cursor-pointer">
                    Auto-Approve Jobs
                  </label>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">Keywords Filter (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Officer, Engineer, Clerk, Specialist"
                  value={editingSourceItem.keywords || ''}
                  onChange={(e) => setEditingSourceItem({ ...editingSourceItem, keywords: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none"
                />
              </div>

              <div className="pt-3 flex items-center justify-end space-x-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditSourceOpen(false);
                    setEditingSourceItem(null);
                  }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* MODAL: BULK LOCATION UPDATER                                  */}
      {/* ============================================================= */}
      {isLocationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <MapPin className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-bold text-white">Bulk Set Job Locations</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsLocationModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Update location targeting for the <span className="text-indigo-300 font-bold">{targetLocationJobIds.length}</span> selected job(s). Leave fields blank to keep existing values.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-300 block mb-1">Province</label>
                <input
                  type="text"
                  placeholder="e.g. Punjab, Sindh, KPK, Balochistan, Federal"
                  value={bulkProvince}
                  onChange={(e) => setBulkProvince(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">City</label>
                <input
                  type="text"
                  placeholder="e.g. Lahore, Karachi, Islamabad, Rawalpindi"
                  value={bulkCity}
                  onChange={(e) => setBulkCity(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">District</label>
                <input
                  type="text"
                  placeholder="e.g. Lahore District, Rawalpindi District"
                  value={bulkDistrict}
                  onChange={(e) => setBulkDistrict(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none"
                />
              </div>
            </div>

            <div className="pt-3 flex items-center justify-end space-x-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsLocationModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isUpdatingLocation}
                onClick={handleExecuteBulkLocationUpdate}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs flex items-center space-x-1.5 shadow-md"
              >
                <Check className="w-4 h-4" />
                <span>Apply Location to {targetLocationJobIds.length} Job(s)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Edit Job Modal (Single & Bulk) */}
      {isQuickEditOpen && (
        <AdminQuickEditJobModal
          job={quickEditingJob}
          jobs={bulkEditingJobs.length > 0 ? bulkEditingJobs : undefined}
          isOpen={isQuickEditOpen}
          onClose={() => {
            setIsQuickEditOpen(false);
            setQuickEditingJob(null);
            setBulkEditingJobs([]);
          }}
          onSaveJob={handleSaveQuickEditJob}
          onSaveJobs={handleBulkSaveJobs}
          onSaveAndApproveJob={handleSaveAndApproveJob}
        />
      )}
    </div>
  );
};
