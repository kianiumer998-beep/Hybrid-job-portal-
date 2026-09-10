import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Bot,
  Globe,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Calendar,
  Clock,
  ExternalLink,
  Shield,
  FileText,
  Filter,
  CheckSquare,
  Square,
  Search,
  Eye,
  Plus,
  Play,
  Pause,
  ArrowRight,
  Building2,
  MapPin,
  Layers,
  Briefcase,
  SlidersHorizontal,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  FileCode,
  Check,
  X,
  Zap,
  Settings,
  Activity,
  FileCheck,
  HelpCircle
} from 'lucide-react';
import { Job, Region, ScrapedJobAuditEntry } from '../../types/job';
import { api } from '../../services/api';

export interface ScraperSourceItem {
  id: string;
  name: string;
  url: string;
  keywords?: string;
  category: 'Private Corporate' | 'Government Sector' | 'Newspaper Classified' | 'International Remote';
  region: Region;
  depth?: 'Light (10 Jobs)' | 'Standard (25 Jobs)' | 'Deep Crawl (50+ Jobs)';
  deduplication?: boolean;
  interval?: '15m' | '30m' | '1h' | '6h' | '24h' | '7d';
  autoApprove?: boolean;
  status: 'Active Scheduled' | 'Paused';
  lastRun?: string;
  lastSuccessfulScrapeAt?: string;
  lastCompletedAt?: string;
  scrapedCount?: number;
  healthStatus?: 'healthy' | 'warning' | 'error';
  lastErrorMessage?: string;
}

export interface ScraperRunRecord {
  id: string;
  runId?: string;
  timestamp?: string;
  startTime?: string;
  endTime?: string;
  mode?: string;
  sourceId?: string;
  sourceIds?: string[];
  totalFound: number;
  totalNew?: number;
  jobsAccepted?: number;
  approvedCount?: number;
  pendingCount?: number;
  totalDuplicates?: number;
  totalFailedSources?: number;
  executionDurationMs?: number;
  status?: string;
  message?: string;
  sourcesStats?: Array<{
    sourceId: string;
    sourceName: string;
    status: string;
    jobsFound: number;
    newJobs: number;
    duplicates: number;
    error?: string;
  }>;
}

interface AutomatedScraperHubProps {
  scraperSources?: ScraperSourceItem[];
  setScraperSources?: React.Dispatch<React.SetStateAction<ScraperSourceItem[]>>;
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
}

type ScraperCenterTab = 'overview' | 'sources' | 'run' | 'history' | 'duplicates' | 'settings';

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
  onOverrideDuplicatesToLive
}) => {
  // Navigation: The 6 consolidated tabs
  const [activeTab, setActiveTab] = useState<ScraperCenterTab>('overview');

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
  const [lastRunFilter, setLastRunFilter] = useState<'all' | 'today' | '7days' | '30days' | 'never'>('all');
  const [resultTypeFilter, setResultTypeFilter] = useState<'all' | 'Approved' | 'Pending' | 'Duplicate' | 'Error'>('all');

  // Multi-Selection State for Sources
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);

  // Execution State
  const [isScrapingActive, setIsScrapingActive] = useState(false);
  const [scrapeMode, setScrapeMode] = useState<'complete' | 'since_last' | 'page_range' | 'custom'>('complete');
  const [autoPublishTrusted, setAutoPublishTrusted] = useState(false);
  const [startPage, setStartPage] = useState(1);
  const [endPage, setEndPage] = useState(3);
  const [customFromTime, setCustomFromTime] = useState(() => {
    const d = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return d.toISOString().slice(0, 16);
  });
  const [customToTime, setCustomToTime] = useState(() => new Date().toISOString().slice(0, 16));
  const [runProgressMessage, setRunProgressMessage] = useState('');
  const [recentRunResult, setRecentRunResult] = useState<any>(null);

  // Direct Live URL & PDF Ingestion Tool State
  const [directUrl, setDirectUrl] = useState('');
  const [directOrg, setDirectOrg] = useState('');
  const [directTitle, setDirectTitle] = useState('');
  const [isParsingDirectUrl, setIsParsingDirectUrl] = useState(false);
  const [directParseResult, setDirectParseResult] = useState<{
    jobs: Job[];
    totalExtracted: number;
    message?: string;
    sample?: string;
  } | null>(null);

  // Add Source Modal State
  const [isAddSourceOpen, setIsAddSourceOpen] = useState(false);
  const [newSourceName, setNewSourceName] = useState('');
  const [newSourceUrl, setNewSourceUrl] = useState('');
  const [newSourceCategory, setNewSourceCategory] = useState<ScraperSourceItem['category']>('Government Sector');
  const [newSourceRegion, setNewSourceRegion] = useState<Region>('Pakistan');
  const [newSourceInterval, setNewSourceInterval] = useState<'15m' | '30m' | '1h' | '6h' | '24h' | '7d'>('24h');
  const [newSourceDepth, setNewSourceDepth] = useState<'Light (10 Jobs)' | 'Standard (25 Jobs)' | 'Deep Crawl (50+ Jobs)'>('Standard (25 Jobs)');
  const [newSourceKeywords, setNewSourceKeywords] = useState('');
  const [newSourceAutoApprove, setNewSourceAutoApprove] = useState(false);

  // Inspect Run Details Modal State
  const [inspectingRun, setInspectingRun] = useState<ScraperRunRecord | null>(null);

  // Global Settings State
  const [globalInterval, setGlobalInterval] = useState('24h');
  const [globalDepth, setGlobalDepth] = useState('Standard (25 Jobs)');
  const [globalKeywords, setGlobalKeywords] = useState('jobs, careers, recruitment, vacancies, officers, lecturer');
  const [globalAutoApprove, setGlobalAutoApprove] = useState(false);
  const [globalSchedulerEnabled, setGlobalSchedulerEnabled] = useState(true);

  // -------------------------------------------------------------
  // Data Fetching: Live MongoDB Scraper APIs
  // -------------------------------------------------------------
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
  // Overview Tab Calculated Metrics (Real backend data only)
  // -------------------------------------------------------------
  const overviewStats = useMemo(() => {
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

    const pendingCount = pendingJobs.length;
    const lastRun = liveRuns.length > 0 ? liveRuns[0] : null;

    return {
      totalFound,
      totalApproved,
      totalDuplicates,
      totalErrors,
      pendingCount,
      lastRun,
      hasRuns: liveRuns.length > 0
    };
  }, [liveRuns, pendingJobs]);

  // -------------------------------------------------------------
  // Filtered Sources for Sources Tab
  // -------------------------------------------------------------
  const filteredSources = useMemo(() => {
    return sourcesList.filter(source => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = source.name?.toLowerCase().includes(q);
        const matchesUrl = source.url?.toLowerCase().includes(q);
        const matchesKeywords = source.keywords?.toLowerCase().includes(q);
        if (!matchesName && !matchesUrl && !matchesKeywords) return false;
      }

      // Status
      if (statusFilter !== 'all') {
        if (statusFilter === 'Active' && source.status !== 'Active Scheduled') return false;
        if (statusFilter === 'Paused' && source.status !== 'Paused') return false;
        if (statusFilter === 'Error' && source.healthStatus !== 'error') return false;
      }

      // Category
      if (categoryFilter !== 'all' && source.category !== categoryFilter) return false;

      // Region
      if (regionFilter !== 'all' && source.region !== regionFilter) return false;

      // Last Run
      if (lastRunFilter !== 'all') {
        const lastRunTime = source.lastRun || source.lastSuccessfulScrapeAt;
        if (!lastRunTime && lastRunFilter !== 'never') return false;
        if (lastRunFilter === 'never' && lastRunTime) return false;

        if (lastRunTime) {
          const runDate = new Date(lastRunTime);
          const now = new Date();
          const diffHours = (now.getTime() - runDate.getTime()) / (1000 * 60 * 60);

          if (lastRunFilter === 'today' && diffHours > 24) return false;
          if (lastRunFilter === '7days' && diffHours > 24 * 7) return false;
          if (lastRunFilter === '30days' && diffHours > 24 * 30) return false;
        }
      }

      return true;
    });
  }, [sourcesList, searchQuery, statusFilter, categoryFilter, regionFilter, lastRunFilter]);

  // -------------------------------------------------------------
  // Filtered History Runs
  // -------------------------------------------------------------
  const filteredRuns = useMemo(() => {
    return liveRuns.filter(run => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const runIdMatch = (run.runId || run.id || '').toLowerCase().includes(q);
        const msgMatch = (run.message || '').toLowerCase().includes(q);
        if (!runIdMatch && !msgMatch) return false;
      }

      if (sourceFilter !== 'all') {
        const matchesSource = run.sourceId === sourceFilter ||
          (Array.isArray(run.sourceIds) && run.sourceIds.includes(sourceFilter));
        if (!matchesSource) return false;
      }

      if (resultTypeFilter !== 'all') {
        if (resultTypeFilter === 'Approved' && (!run.approvedCount && !run.jobsAccepted)) return false;
        if (resultTypeFilter === 'Duplicate' && !run.totalDuplicates) return false;
        if (resultTypeFilter === 'Error' && run.status !== 'Failed' && !run.totalFailedSources) return false;
        if (resultTypeFilter === 'Pending' && !run.pendingCount) return false;
      }

      return true;
    });
  }, [liveRuns, searchQuery, sourceFilter, resultTypeFilter]);

  // -------------------------------------------------------------
  // Duplicates & Pending Review Items
  // -------------------------------------------------------------
  const reviewJobs = useMemo(() => {
    return pendingJobs.filter(job => {
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

      if (resultTypeFilter === 'Duplicate') {
        return Boolean(job.isDuplicate || (job.duplicateScore && job.duplicateScore >= 60));
      }
      if (resultTypeFilter === 'Pending') {
        return !job.isDuplicate && (!job.duplicateScore || job.duplicateScore < 60);
      }

      return true;
    });
  }, [pendingJobs, searchQuery, sourceFilter, resultTypeFilter]);

  // -------------------------------------------------------------
  // Actions: Scraper Execution (Run All / Run Selected / Run Now)
  // -------------------------------------------------------------
  const handleExecuteScraper = async (options: {
    runMode: 'complete' | 'since_last' | 'page_range' | 'custom';
    targetSourceIds?: string[];
  }) => {
    setIsScrapingActive(true);
    setRecentRunResult(null);
    setRunProgressMessage(`Initiating authentic scraper run (${options.targetSourceIds ? `${options.targetSourceIds.length} sources` : 'All sources'})...`);

    try {
      const payload: any = {
        mode: options.runMode === 'custom' ? 'custom_date' : options.runMode,
        autoPublishTrusted,
        sourceIds: options.targetSourceIds
      };

      if (options.runMode === 'page_range') {
        payload.startPage = startPage;
        payload.endPage = endPage;
      } else if (options.runMode === 'custom') {
        payload.fromTimestamp = customFromTime;
        payload.toTimestamp = customToTime;
      }

      const res = await api.scraper.run(payload);
      if (res?.success) {
        setRecentRunResult(res);
        setStatusMessage({
          text: `Scraper execution completed: ${res.totalFound || 0} jobs found, ${res.jobsAccepted || res.approvedCount || 0} approved, ${res.totalDuplicates || 0} duplicates skipped.`,
          type: 'success'
        });
        // Reload jobs and runs from backend
        if (onReloadJobs) await onReloadJobs();
        await fetchLiveScraperData();
      } else {
        setStatusMessage({
          text: res?.message || 'Scraper execution reported errors.',
          type: 'error'
        });
      }
    } catch (err: any) {
      console.error('Scraper run error:', err);
      setStatusMessage({
        text: `Scraper run failed: ${err.message || 'Unknown network error'}`,
        type: 'error'
      });
    } finally {
      setIsScrapingActive(false);
      setRunProgressMessage('');
    }
  };

  // Run Single Source Now
  const handleRunSingleSource = (sourceId: string) => {
    handleExecuteScraper({ runMode: 'complete', targetSourceIds: [sourceId] });
  };

  // Trigger Scheduler Tick
  const handleTriggerSchedulerTick = async () => {
    try {
      setStatusMessage({ text: 'Triggering scheduler tick...', type: 'info' });
      const res = await api.scraper.schedulerTick();
      if (res?.success) {
        setStatusMessage({
          text: `Scheduler tick executed successfully! Triggered sources: ${(res.triggeredSources || []).join(', ') || 'None due currently'}.`,
          type: 'success'
        });
        await fetchLiveScraperData();
      } else {
        setStatusMessage({ text: res?.message || 'Scheduler tick execution failed.', type: 'error' });
      }
    } catch (err: any) {
      setStatusMessage({ text: `Scheduler tick error: ${err.message}`, type: 'error' });
    }
  };

  // Direct Live URL / PDF Parser
  const handleDirectParseUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!directUrl.trim() || !directUrl.startsWith('http')) {
      setStatusMessage({ text: 'Please enter a valid HTTP/HTTPS URL.', type: 'error' });
      return;
    }

    setIsParsingDirectUrl(true);
    setDirectParseResult(null);
    try {
      const res = await api.scraper.parseUrl({
        url: directUrl.trim(),
        organization: directOrg.trim() || undefined,
        title: directTitle.trim() || undefined
      });

      if (res?.success) {
        setDirectParseResult({
          jobs: res.jobs || [],
          totalExtracted: res.totalExtracted || 0,
          message: res.message,
          sample: res.rawTextSample
        });
        setStatusMessage({
          text: res.message || `Successfully harvested ${res.jobs?.length || 0} vacancies.`,
          type: 'success'
        });
      } else {
        setStatusMessage({
          text: res?.message || 'Failed to extract vacancies from target URL.',
          type: 'error'
        });
      }
    } catch (err: any) {
      setStatusMessage({ text: `Direct URL parsing failed: ${err.message}`, type: 'error' });
    } finally {
      setIsParsingDirectUrl(false);
    }
  };

  // Save Direct Extracted Jobs (Live or Pending)
  const handleIngestExtractedJobs = async (targetStatus: 'Approved' | 'Pending') => {
    if (!directParseResult || directParseResult.jobs.length === 0) return;

    const jobsToSave = directParseResult.jobs.map(j => ({
      ...j,
      status: targetStatus
    }));

    try {
      if (onBulkAddJobs) {
        onBulkAddJobs(jobsToSave);
      } else {
        jobsToSave.forEach(j => onAddJob(j));
      }

      setStatusMessage({
        text: `Successfully saved ${jobsToSave.length} jobs to ${targetStatus === 'Approved' ? 'Live Jobs' : 'Pending Queue'}!`,
        type: 'success'
      });
      setDirectParseResult(null);
      setDirectUrl('');
      if (onReloadJobs) await onReloadJobs();
    } catch (err: any) {
      setStatusMessage({ text: `Error saving jobs: ${err.message}`, type: 'error' });
    }
  };

  // -------------------------------------------------------------
  // Source Management (Add, Toggle, Delete, Save)
  // -------------------------------------------------------------
  const handleToggleSourceStatus = async (sourceId: string) => {
    const updated = sourcesList.map(s => {
      if (s.id === sourceId) {
        return {
          ...s,
          status: (s.status === 'Active Scheduled' ? 'Paused' : 'Active Scheduled') as any
        };
      }
      return s;
    });

    setLiveSources(updated);
    if (propsSetSources) propsSetSources(updated);

    try {
      await api.scraper.saveConfigs(updated);
      setStatusMessage({ text: 'Source status updated in backend MongoDB.', type: 'success' });
    } catch (err: any) {
      setStatusMessage({ text: `Error updating source: ${err.message}`, type: 'error' });
    }
  };

  const handleDeleteSource = async (sourceId: string) => {
    if (!window.confirm('Are you sure you want to remove this scraper source configuration?')) return;
    const updated = sourcesList.filter(s => s.id !== sourceId);
    setLiveSources(updated);
    if (propsSetSources) propsSetSources(updated);

    try {
      await api.scraper.saveConfigs(updated);
      setStatusMessage({ text: 'Scraper source removed successfully.', type: 'success' });
    } catch (err: any) {
      setStatusMessage({ text: `Error removing source: ${err.message}`, type: 'error' });
    }
  };

  const handleCreateNewSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSourceName.trim() || !newSourceUrl.trim()) {
      setStatusMessage({ text: 'Name and valid URL are required.', type: 'error' });
      return;
    }

    const newSource: ScraperSourceItem = {
      id: `portal-${Date.now()}`,
      name: newSourceName.trim(),
      url: newSourceUrl.trim(),
      category: newSourceCategory,
      region: newSourceRegion,
      interval: newSourceInterval,
      depth: newSourceDepth,
      keywords: newSourceKeywords.trim() || undefined,
      autoApprove: newSourceAutoApprove,
      status: 'Active Scheduled',
      scrapedCount: 0,
      healthStatus: 'healthy'
    };

    const updated = [newSource, ...sourcesList];
    setLiveSources(updated);
    if (propsSetSources) propsSetSources(updated);

    try {
      await api.scraper.saveConfigs(updated);
      setStatusMessage({ text: `Target source "${newSource.name}" added successfully!`, type: 'success' });
      setIsAddSourceOpen(false);
      setNewSourceName('');
      setNewSourceUrl('');
      setNewSourceKeywords('');
    } catch (err: any) {
      setStatusMessage({ text: `Failed to save new source: ${err.message}`, type: 'error' });
    }
  };

  // Save Global Settings
  const handleSaveGlobalSettings = async () => {
    try {
      // Update all sources with global settings
      const updated = sourcesList.map(s => ({
        ...s,
        interval: globalInterval as any,
        depth: globalDepth as any,
        keywords: globalKeywords,
        autoApprove: globalAutoApprove,
        status: (globalSchedulerEnabled ? 'Active Scheduled' : 'Paused') as any
      }));

      setLiveSources(updated);
      if (propsSetSources) propsSetSources(updated);
      await api.scraper.saveConfigs(updated);

      setStatusMessage({
        text: 'Global scraper settings persisted to MongoDB and scheduler synchronized.',
        type: 'success'
      });
    } catch (err: any) {
      setStatusMessage({ text: `Failed to save settings: ${err.message}`, type: 'error' });
    }
  };

  // -------------------------------------------------------------
  // Bulk Selection Helpers
  // -------------------------------------------------------------
  const toggleSelectAllSources = () => {
    if (selectedSourceIds.length === filteredSources.length) {
      setSelectedSourceIds([]);
    } else {
      setSelectedSourceIds(filteredSources.map(s => s.id));
    }
  };

  const toggleSelectSource = (id: string) => {
    setSelectedSourceIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 text-slate-100 p-2 sm:p-4">
      {/* HEADER BANNER */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start space-x-4">
            <div className="p-3.5 bg-indigo-500/20 text-indigo-400 rounded-2xl border border-indigo-500/30 shadow-inner">
              <Bot className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center space-x-3">
                <h2 className="text-2xl font-black text-white tracking-tight">Scraper Center</h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center space-x-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse mr-1" />
                  Live MongoDB Connected
                </span>
              </div>
              <p className="text-sm text-slate-400 mt-1">
                Unified controller for automated portal crawlers, gazette/PDF ingestion, duplicate screening, and execution audit history.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={fetchLiveScraperData}
              disabled={isLoadingLive}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-semibold text-xs flex items-center space-x-2 transition border border-slate-700 shadow-sm"
              title="Refresh live metrics from backend"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLive ? 'animate-spin' : ''}`} />
              <span>Refresh Backend</span>
            </button>
            <button
              type="button"
              onClick={handleTriggerSchedulerTick}
              className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center space-x-2 transition shadow-md shadow-indigo-600/20"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Trigger Scheduler Tick</span>
            </button>
          </div>
        </div>

        {/* FEEDBACK STATUS ALERT */}
        {statusMessage && (
          <div
            className={`mt-4 p-3.5 rounded-xl border text-xs font-medium flex items-center justify-between ${
              statusMessage.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : statusMessage.type === 'error'
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                : 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300'
            }`}
          >
            <div className="flex items-center space-x-2">
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              ) : statusMessage.type === 'error' ? (
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
              ) : (
                <Activity className="w-4 h-4 flex-shrink-0" />
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

      {/* PRIMARY CONSOLIDATED NAVIGATION TABS */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-1.5 flex flex-wrap gap-1 shadow-lg">
        {[
          { id: 'overview', label: '1. Overview', icon: Activity, count: null },
          { id: 'sources', label: '2. Sources', icon: Globe, count: sourcesList.length },
          { id: 'run', label: '3. Run Scraper', icon: Play, count: null },
          { id: 'history', label: '4. History', icon: Clock, count: liveRuns.length },
          { id: 'duplicates', label: '5. Duplicates & Review', icon: Shield, count: pendingJobs.length },
          { id: 'settings', label: '6. Settings', icon: Settings, count: null }
        ].map(t => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setActiveTab(t.id as ScraperCenterTab);
                setStatusMessage(null);
              }}
              className={`flex-1 min-w-[140px] px-3.5 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center space-x-2 transition-all cursor-pointer ${
                isActive
                  ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-lg shadow-indigo-500/25'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{t.label}</span>
              {t.count !== null && (
                <span
                  className={`ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                    isActive ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ============================================================= */}
      {/* 1. OVERVIEW SECTION */}
      {/* ============================================================= */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* SCHEDULER DIAGNOSTICS BANNER */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex items-center space-x-4">
              <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
                <Activity className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-slate-400 font-medium">Scheduler Status</p>
                <div className="flex items-center space-x-2 mt-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <p className="text-lg font-black text-white">
                    {schedulerStatus?.isRunning ? 'Running (Active)' : 'Active (Cron)'}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex items-center space-x-4">
              <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-slate-400 font-medium">Last Scheduler Tick</p>
                <p className="text-sm font-bold text-white mt-1 truncate">
                  {schedulerStatus?.lastTickTimestamp && schedulerStatus.lastTickTimestamp !== 'Never'
                    ? schedulerStatus.lastTickTimestamp
                    : overviewStats.lastRun?.timestamp || 'No data yet'}
                </p>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex items-center space-x-4">
              <div className="p-3 bg-purple-500/10 text-purple-400 rounded-xl border border-purple-500/20">
                <Calendar className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-slate-400 font-medium">Next Scheduled Run</p>
                <p className="text-sm font-bold text-white mt-1">
                  {schedulerStatus?.tickCronPattern ? `Pattern: ${schedulerStatus.tickCronPattern}` : 'Every 15 minutes'}
                </p>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex items-center space-x-4">
              <div className="p-3 bg-cyan-500/10 text-cyan-400 rounded-xl border border-cyan-500/20">
                <Globe className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-slate-400 font-medium">Configured Sources</p>
                <p className="text-lg font-black text-white mt-1">
                  {sourcesList.length} Portals
                </p>
              </div>
            </div>
          </div>

          {/* LIVE METRICS CARDS */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
              <p className="text-xs text-slate-400 font-medium">Total Jobs Found</p>
              <p className="text-2xl font-black text-indigo-400 mt-2">
                {overviewStats.hasRuns ? overviewStats.totalFound.toLocaleString() : '0'}
              </p>
              <p className="text-[10px] text-slate-500 mt-1">
                {overviewStats.hasRuns ? 'Across recorded scraper runs' : 'No data yet in MongoDB'}
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
              <p className="text-xs text-slate-400 font-medium">Approved Live</p>
              <p className="text-2xl font-black text-emerald-400 mt-2">
                {overviewStats.hasRuns ? overviewStats.totalApproved.toLocaleString() : jobs.filter(j => j.status === 'Approved').length.toLocaleString()}
              </p>
              <p className="text-[10px] text-slate-500 mt-1">Live in MongoDB.jobs</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
              <p className="text-xs text-slate-400 font-medium">Pending Review</p>
              <p className="text-2xl font-black text-amber-400 mt-2">
                {pendingJobs.length.toLocaleString()}
              </p>
              <p className="text-[10px] text-slate-500 mt-1">
                {pendingJobs.length > 0 ? 'Awaiting moderator approval' : 'Queue is currently empty'}
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
              <p className="text-xs text-slate-400 font-medium">Duplicates Screened</p>
              <p className="text-2xl font-black text-purple-400 mt-2">
                {overviewStats.hasRuns ? overviewStats.totalDuplicates.toLocaleString() : '0'}
              </p>
              <p className="text-[10px] text-slate-500 mt-1">Detected by similarity engine</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg col-span-2 md:col-span-1">
              <p className="text-xs text-slate-400 font-medium">Scraper Errors</p>
              <p className="text-2xl font-black text-rose-400 mt-2">
                {overviewStats.totalErrors}
              </p>
              <p className="text-[10px] text-slate-500 mt-1">Failed portal executions</p>
            </div>
          </div>

          {/* LATEST RUN DETAILS OR "NO DATA YET" */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center space-x-3">
                <FileText className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-bold text-white">Latest Backend Scraper Execution</h3>
              </div>
              {overviewStats.lastRun && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                  ID: {overviewStats.lastRun.runId || overviewStats.lastRun.id}
                </span>
              )}
            </div>

            {overviewStats.lastRun ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
                <div className="p-4 bg-slate-800/40 rounded-xl border border-slate-800">
                  <p className="text-xs text-slate-400">Timestamp</p>
                  <p className="text-sm font-semibold text-white mt-1">
                    {overviewStats.lastRun.timestamp || overviewStats.lastRun.startTime || 'Recent'}
                  </p>
                </div>
                <div className="p-4 bg-slate-800/40 rounded-xl border border-slate-800">
                  <p className="text-xs text-slate-400">Run Mode & Duration</p>
                  <p className="text-sm font-semibold text-white mt-1">
                    {overviewStats.lastRun.mode || 'Complete'} ({((overviewStats.lastRun.executionDurationMs || 0) / 1000).toFixed(1)}s)
                  </p>
                </div>
                <div className="p-4 bg-slate-800/40 rounded-xl border border-slate-800">
                  <p className="text-xs text-slate-400">Extracted / Approved</p>
                  <p className="text-sm font-semibold text-white mt-1">
                    {overviewStats.lastRun.totalFound} found / {overviewStats.lastRun.jobsAccepted || overviewStats.lastRun.approvedCount || 0} approved
                  </p>
                </div>
                <div className="p-4 bg-slate-800/40 rounded-xl border border-slate-800">
                  <p className="text-xs text-slate-400">Execution Status</p>
                  <p className="text-sm font-semibold text-emerald-400 mt-1 flex items-center space-x-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{overviewStats.lastRun.status || 'Completed'}</span>
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-10 space-y-3">
                <AlertCircle className="w-10 h-10 text-slate-500 mx-auto" />
                <p className="text-base font-bold text-slate-300">No data yet</p>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  No scraper executions have been recorded in backend MongoDB. Click "Run Scraper" below to launch your first extraction.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('run')}
                  className="mt-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs inline-flex items-center space-x-2 transition"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Go to Run Scraper</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* 2. SOURCES SECTION */}
      {/* ============================================================= */}
      {activeTab === 'sources' && (
        <div className="space-y-6">
          {/* ACTION BAR WITH FILTERS & ADD SOURCE BUTTON */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center space-x-3">
                <Globe className="w-5 h-5 text-indigo-400" />
                <h3 className="text-lg font-bold text-white">All Scraper Sources ({filteredSources.length})</h3>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {selectedSourceIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => handleExecuteScraper({ runMode: 'complete', targetSourceIds: selectedSourceIds })}
                    disabled={isScrapingActive}
                    className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center space-x-1.5 transition shadow-sm"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Run Selected ({selectedSourceIds.length})</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsAddSourceOpen(true)}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center space-x-1.5 transition shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add New Source</span>
                </button>
              </div>
            </div>

            {/* SIMPLE FILTERS ROW */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-2">
              {/* Search */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search portal name or URL..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as any)}
                className="px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="all">Status: All Statuses</option>
                <option value="Active">Status: Active</option>
                <option value="Paused">Status: Paused</option>
                <option value="Error">Status: Error</option>
              </select>

              {/* Category Filter */}
              <select
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                className="px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="all">Category: All Categories</option>
                <option value="Government Sector">Government Sector</option>
                <option value="Private Corporate">Private Corporate</option>
                <option value="Newspaper Classified">Newspaper Classified</option>
                <option value="International Remote">International Remote</option>
              </select>

              {/* Region Filter */}
              <select
                value={regionFilter}
                onChange={e => setRegionFilter(e.target.value)}
                className="px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="all">Region: All Regions</option>
                <option value="Pakistan">Pakistan</option>
                <option value="Middle East">Middle East</option>
                <option value="Europe">Europe</option>
                <option value="North America">North America</option>
                <option value="Remote">Remote</option>
              </select>

              {/* Last Run Filter */}
              <select
                value={lastRunFilter}
                onChange={e => setLastRunFilter(e.target.value as any)}
                className="px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="all">Last Run: Any time</option>
                <option value="today">Last Run: Past 24 Hours</option>
                <option value="7days">Last Run: Past 7 Days</option>
                <option value="30days">Last Run: Past 30 Days</option>
                <option value="never">Last Run: Never Run</option>
              </select>
            </div>
          </div>

          {/* ALL SCRAPER SOURCES IN ONE TABLE */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-800/60 text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="p-3.5 w-10 text-center">
                      <button
                        type="button"
                        onClick={toggleSelectAllSources}
                        className="text-slate-400 hover:text-white"
                      >
                        {selectedSourceIds.length === filteredSources.length && filteredSources.length > 0 ? (
                          <CheckSquare className="w-4 h-4 text-indigo-400" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </th>
                    <th className="p-3.5">Portal / Source</th>
                    <th className="p-3.5">Target URL</th>
                    <th className="p-3.5">Category & Region</th>
                    <th className="p-3.5">Interval / Depth</th>
                    <th className="p-3.5">Auto-Approve</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5">Last Run</th>
                    <th className="p-3.5">Scraped</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredSources.length > 0 ? (
                    filteredSources.map(source => {
                      const isSelected = selectedSourceIds.includes(source.id);
                      const isPaused = source.status === 'Paused';

                      return (
                        <tr
                          key={source.id}
                          className={`hover:bg-slate-800/30 transition ${isSelected ? 'bg-indigo-950/20' : ''}`}
                        >
                          <td className="p-3.5 text-center">
                            <button
                              type="button"
                              onClick={() => toggleSelectSource(source.id)}
                              className="text-slate-400 hover:text-white"
                            >
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-indigo-400" />
                              ) : (
                                <Square className="w-4 h-4" />
                              )}
                            </button>
                          </td>
                          <td className="p-3.5 font-bold text-white whitespace-nowrap">
                            <div className="flex items-center space-x-2">
                              <span>{source.name}</span>
                              {source.healthStatus === 'error' && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                  Error
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-3.5 max-w-[200px] truncate">
                            <a
                              href={source.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-indigo-400 hover:underline flex items-center space-x-1"
                              title={source.url}
                            >
                              <span className="truncate">{source.url}</span>
                              <ExternalLink className="w-3 h-3 flex-shrink-0" />
                            </a>
                          </td>
                          <td className="p-3.5 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 mr-1.5 border border-slate-700">
                              {source.category}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-950 text-indigo-300 border border-indigo-800">
                              {source.region}
                            </span>
                          </td>
                          <td className="p-3.5 whitespace-nowrap">
                            <span className="text-slate-200 font-medium">{source.interval || '24h'}</span>
                            <span className="text-slate-500 text-[10px] block">{source.depth || 'Standard'}</span>
                          </td>
                          <td className="p-3.5 whitespace-nowrap">
                            {source.autoApprove ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                Yes (Live)
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                Moderated
                              </span>
                            )}
                          </td>
                          <td className="p-3.5 whitespace-nowrap">
                            {isPaused ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                                Paused
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center space-x-1 w-fit">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse mr-1" />
                                Active
                              </span>
                            )}
                          </td>
                          <td className="p-3.5 whitespace-nowrap text-slate-400">
                            {source.lastRun || source.lastSuccessfulScrapeAt || (
                              <span className="text-slate-500 italic">No data yet</span>
                            )}
                          </td>
                          <td className="p-3.5 whitespace-nowrap font-bold text-slate-200">
                            {(source.scrapedCount || 0).toLocaleString()} jobs
                          </td>
                          <td className="p-3.5 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end space-x-1.5">
                              <button
                                type="button"
                                onClick={() => handleRunSingleSource(source.id)}
                                disabled={isScrapingActive}
                                className="p-1.5 rounded-lg bg-indigo-600/30 hover:bg-indigo-600 text-indigo-300 hover:text-white transition"
                                title="Run this scraper now"
                              >
                                <Play className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggleSourceStatus(source.id)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                                title={isPaused ? 'Resume scraping' : 'Pause scraping'}
                              >
                                {isPaused ? <Play className="w-3.5 h-3.5 text-emerald-400" /> : <Pause className="w-3.5 h-3.5 text-amber-400" />}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteSource(source.id)}
                                className="p-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-600 text-rose-300 hover:text-white transition"
                                title="Delete source"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-slate-400">
                        <AlertCircle className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                        <p className="text-sm font-semibold">No scraper sources match your filters</p>
                        <p className="text-xs text-slate-500 mt-1">Try clearing your search query or reset filter settings.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* 3. RUN SCRAPER SECTION */}
      {/* ============================================================= */}
      {activeTab === 'run' && (
        <div className="space-y-6">
          {/* PRIMARY RUN CONTROLLER */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                  <Play className="w-5 h-5 text-indigo-400" />
                  <span>Run Scraper Execution Wizard</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Launch an authentic on-demand scrape across configured job portals or selected sources.
                </p>
              </div>

              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={() => handleExecuteScraper({ runMode: scrapeMode, targetSourceIds: selectedSourceIds })}
                  disabled={isScrapingActive || selectedSourceIds.length === 0}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs flex items-center space-x-2 transition shadow-md shadow-indigo-600/20"
                >
                  <Play className="w-4 h-4" />
                  <span>Run Selected ({selectedSourceIds.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleExecuteScraper({ runMode: scrapeMode })}
                  disabled={isScrapingActive}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs flex items-center space-x-2 transition shadow-md shadow-emerald-600/20"
                >
                  <Zap className="w-4 h-4" />
                  <span>Run All Sources</span>
                </button>
              </div>
            </div>

            {/* RUN SETTINGS & PARAMETERS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Mode Selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Extraction Mode</label>
                <select
                  value={scrapeMode}
                  onChange={e => setScrapeMode(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="complete">Complete Full Crawl</option>
                  <option value="since_last">Only Vacancies Since Last Run</option>
                  <option value="page_range">Specific Page Range</option>
                  <option value="custom">Custom Date & Time Range</option>
                </select>
              </div>

              {/* Page Range Sub-options */}
              {scrapeMode === 'page_range' && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300">Start Page</label>
                    <input
                      type="number"
                      min={1}
                      value={startPage}
                      onChange={e => setStartPage(parseInt(e.target.value, 10) || 1)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300">End Page</label>
                    <input
                      type="number"
                      min={1}
                      value={endPage}
                      onChange={e => setEndPage(parseInt(e.target.value, 10) || 1)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
                    />
                  </div>
                </div>
              )}

              {/* Custom Date Range Sub-options */}
              {scrapeMode === 'custom' && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300">From Date/Time</label>
                    <input
                      type="datetime-local"
                      value={customFromTime}
                      onChange={e => setCustomFromTime(e.target.value)}
                      className="w-full px-2 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300">To Date/Time</label>
                    <input
                      type="datetime-local"
                      value={customToTime}
                      onChange={e => setCustomToTime(e.target.value)}
                      className="w-full px-2 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
                    />
                  </div>
                </div>
              )}

              {/* Auto Publish Trusted Option */}
              <div className="flex items-center space-x-3 pt-6">
                <input
                  type="checkbox"
                  id="autoPublishCheck"
                  checked={autoPublishTrusted}
                  onChange={e => setAutoPublishTrusted(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 bg-slate-800 border-slate-700 focus:ring-indigo-500"
                />
                <label htmlFor="autoPublishCheck" className="text-xs text-slate-300 font-medium cursor-pointer">
                  Auto-publish approved vacancies from trusted portals (skip pending queue)
                </label>
              </div>
            </div>

            {/* LIVE SCRAPING PROGRESS BAR & STATUS */}
            {isScrapingActive && (
              <div className="p-4 bg-indigo-950/40 border border-indigo-500/30 rounded-xl space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-indigo-300">
                  <span className="flex items-center space-x-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
                    <span>Scraper Running Live: {runProgressMessage}</span>
                  </span>
                  <span className="animate-pulse">Processing...</span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div className="bg-indigo-500 h-full rounded-full animate-pulse w-3/4" />
                </div>
              </div>
            )}

            {/* LAST RUN SUMMARY CALLOUT */}
            {recentRunResult && (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl space-y-2">
                <p className="text-xs font-bold text-emerald-300 flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Scraper Execution Finished: {recentRunResult.runId}</span>
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-slate-300 pt-1">
                  <div>Found: <strong className="text-white">{recentRunResult.totalFound || 0}</strong></div>
                  <div>Approved: <strong className="text-emerald-400">{recentRunResult.jobsAccepted || recentRunResult.approvedCount || 0}</strong></div>
                  <div>Duplicates: <strong className="text-purple-400">{recentRunResult.totalDuplicates || 0}</strong></div>
                  <div>Failed Sources: <strong className="text-rose-400">{recentRunResult.totalFailedSources || 0}</strong></div>
                </div>
              </div>
            )}
          </div>

          {/* CONSOLIDATED DIRECT LIVE URL & PDF PARSER */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <Globe className="w-5 h-5 text-emerald-400" />
                <span>Direct Target URL & PDF Ingestion Engine</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Paste any live career portal URL or official PDF gazette circular. The backend engine extracts factual vacancies without fabricating data.
              </p>
            </div>

            <form onSubmit={handleDirectParseUrl} className="space-y-4 pt-1">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2 space-y-1">
                  <label className="text-xs font-bold text-slate-300">Target Web URL or PDF Document URL</label>
                  <input
                    type="url"
                    placeholder="https://fpsc.gov.pk/jobs/advertisement-09-2026.pdf or career portal link..."
                    value={directUrl}
                    onChange={e => setDirectUrl(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300">Organization / Source Name (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. FPSC, WAPDA, TechCorp"
                    value={directOrg}
                    onChange={e => setDirectOrg(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isParsingDirectUrl || !directUrl.trim()}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white font-bold text-xs flex items-center space-x-2 transition shadow-md"
              >
                {isParsingDirectUrl ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Extracting Vacancies via SSRF-Safe Pipeline...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5" />
                    <span>Inspect & Extract Vacancies</span>
                  </>
                )}
              </button>
            </form>

            {/* DIRECT PARSE RESULT PREVIEW */}
            {directParseResult && (
              <div className="mt-4 p-5 bg-slate-800/60 border border-slate-700 rounded-xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-700 pb-3">
                  <div>
                    <p className="text-sm font-bold text-white">
                      Extracted: {directParseResult.totalExtracted} Vacancies
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">{directParseResult.message}</p>
                  </div>
                  {directParseResult.totalExtracted > 0 && (
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => handleIngestExtractedJobs('Pending')}
                        className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs transition"
                      >
                        Send to Pending Queue
                      </button>
                      <button
                        type="button"
                        onClick={() => handleIngestExtractedJobs('Approved')}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition"
                      >
                        Approve Directly to Live
                      </button>
                    </div>
                  )}
                </div>

                {directParseResult.jobs.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-1">
                    {directParseResult.jobs.map((job, idx) => (
                      <div key={job.id || idx} className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
                        <p className="text-xs font-bold text-white truncate">{job.title}</p>
                        <p className="text-[11px] text-slate-400">{job.company} • {job.region}</p>
                        <p className="text-[10px] text-indigo-400 truncate">{job.sourceUrl || directUrl}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">
                    0 vacancies detected. No fabricated synthetic jobs were created.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* 4. HISTORY SECTION */}
      {/* ============================================================= */}
      {activeTab === 'history' && (
        <div className="space-y-6">
          {/* HISTORY CONTROLS & FILTERS */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                  <Clock className="w-5 h-5 text-indigo-400" />
                  <span>Real Backend Scraper Runs ({liveRuns.length})</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Historical log of authentic execution audits persisted directly in MongoDB.
                </p>
              </div>

              <button
                type="button"
                onClick={fetchLiveScraperData}
                disabled={isLoadingLive}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold flex items-center space-x-1.5 transition border border-slate-700"
              >
                <RefreshCw className={`w-3 h-3 ${isLoadingLive ? 'animate-spin' : ''}`} />
                <span>Refresh Runs</span>
              </button>
            </div>

            {/* FILTERS */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Filter by Run ID or keyword..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <select
                value={sourceFilter}
                onChange={e => setSourceFilter(e.target.value)}
                className="px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="all">Source: All Sources</option>
                {sourcesList.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>

              <select
                value={resultTypeFilter}
                onChange={e => setResultTypeFilter(e.target.value as any)}
                className="px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="all">Result: All Executions</option>
                <option value="Approved">Runs with Approved Jobs</option>
                <option value="Duplicate">Runs with Duplicates</option>
                <option value="Pending">Runs with Pending Jobs</option>
                <option value="Error">Failed Runs</option>
              </select>
            </div>
          </div>

          {/* HISTORY TABLE */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            {filteredRuns.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-800/60 text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="p-3.5">Run ID & Timestamp</th>
                      <th className="p-3.5">Mode</th>
                      <th className="p-3.5">Duration</th>
                      <th className="p-3.5">Jobs Found</th>
                      <th className="p-3.5">Approved</th>
                      <th className="p-3.5">Pending</th>
                      <th className="p-3.5">Duplicates</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5 text-right">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredRuns.map(run => {
                      const isFailed = run.status === 'Failed' || (run.totalFailedSources && run.totalFailedSources > 0);
                      return (
                        <tr key={run.id || run.runId} className="hover:bg-slate-800/30 transition">
                          <td className="p-3.5 whitespace-nowrap">
                            <span className="font-bold text-white block">{run.runId || run.id}</span>
                            <span className="text-[10px] text-slate-500">{run.timestamp || run.startTime || 'Recent'}</span>
                          </td>
                          <td className="p-3.5 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                              {run.mode || 'Complete'}
                            </span>
                          </td>
                          <td className="p-3.5 whitespace-nowrap font-medium text-slate-300">
                            {((run.executionDurationMs || 0) / 1000).toFixed(1)}s
                          </td>
                          <td className="p-3.5 whitespace-nowrap font-bold text-indigo-400">
                            {(run.totalFound || 0).toLocaleString()}
                          </td>
                          <td className="p-3.5 whitespace-nowrap font-bold text-emerald-400">
                            {(run.jobsAccepted || run.approvedCount || 0).toLocaleString()}
                          </td>
                          <td className="p-3.5 whitespace-nowrap font-bold text-amber-400">
                            {(run.pendingCount || 0).toLocaleString()}
                          </td>
                          <td className="p-3.5 whitespace-nowrap font-bold text-purple-400">
                            {(run.totalDuplicates || 0).toLocaleString()}
                          </td>
                          <td className="p-3.5 whitespace-nowrap">
                            {isFailed ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                Failed / Errors
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                {run.status || 'Completed'}
                              </span>
                            )}
                          </td>
                          <td className="p-3.5 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => setInspectingRun(run)}
                              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-300 font-bold text-xs transition inline-flex items-center space-x-1"
                            >
                              <Eye className="w-3 h-3" />
                              <span>Inspect</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12 space-y-3">
                <AlertCircle className="w-10 h-10 text-slate-500 mx-auto" />
                <p className="text-base font-bold text-slate-300">No data yet</p>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  No scraper runs have been recorded in backend MongoDB. Once the scheduler or manual scraper executes, real audits appear here.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* 5. DUPLICATES & REVIEW SECTION */}
      {/* ============================================================= */}
      {activeTab === 'duplicates' && (
        <div className="space-y-6">
          {/* DUPLICATE SCREENING CONTROLLER */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                  <Shield className="w-5 h-5 text-indigo-400" />
                  <span>Duplicates & Moderation Review ({reviewJobs.length})</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Screen pending vacancies and duplicate matches before publishing them to the live jobs repository.
                </p>
              </div>

              {reviewJobs.length > 0 && (
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => {
                      reviewJobs.forEach(j => onApproveJob(j.id));
                      setStatusMessage({ text: `Approved ${reviewJobs.length} jobs to Live!`, type: 'success' });
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition shadow-sm"
                  >
                    Approve All Filtered
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      reviewJobs.forEach(j => onRejectJob(j.id, 'Bulk rejection from review hub'));
                      setStatusMessage({ text: `Rejected ${reviewJobs.length} jobs from queue.`, type: 'info' });
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition shadow-sm"
                  >
                    Reject All Filtered
                  </button>
                </div>
              )}
            </div>

            {/* FILTERS */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search title, company, portal..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <select
                value={resultTypeFilter}
                onChange={e => setResultTypeFilter(e.target.value as any)}
                className="px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="all">Type: All Staged Jobs</option>
                <option value="Duplicate">Flagged as Duplicate</option>
                <option value="Pending">Standard Pending Only</option>
              </select>

              <select
                value={sourceFilter}
                onChange={e => setSourceFilter(e.target.value)}
                className="px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="all">Source: All Portals</option>
                {sourcesList.map(s => (
                  <option key={s.id} value={s.name}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* JOBS LIST / CARDS */}
          {reviewJobs.length > 0 ? (
            <div className="grid grid-cols-1 gap-3">
              {reviewJobs.map(job => {
                const isDuplicate = Boolean(job.isDuplicate || (job.duplicateScore && job.duplicateScore >= 60));
                return (
                  <div
                    key={job.id}
                    className={`p-4 bg-slate-900 border rounded-2xl shadow-lg transition space-y-3 ${
                      isDuplicate ? 'border-purple-500/40 bg-purple-950/10' : 'border-slate-800'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <h4 className="text-sm font-bold text-white">{job.title}</h4>
                          {isDuplicate && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-purple-500/20 text-purple-300 border border-purple-500/30">
                              Duplicate Match ({job.duplicateScore || 75}%)
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400">
                          {job.company} • {job.region} • Portal: <span className="text-indigo-400">{(job as any).sourcePortal || job.scraperSourceName || job.scrapedSourceDomain || 'External'}</span>
                        </p>
                      </div>

                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => onApproveJob(job.id)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition"
                        >
                          Approve Live
                        </button>
                        <button
                          type="button"
                          onClick={() => onRejectJob(job.id, 'Rejected by reviewer')}
                          className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition"
                        >
                          Reject
                        </button>
                        {isDuplicate && onOverrideDuplicatesToLive && (
                          <button
                            type="button"
                            onClick={() => onOverrideDuplicatesToLive([job])}
                            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition"
                            title="Force publish duplicate as separate listing"
                          >
                            Override Duplicate
                          </button>
                        )}
                      </div>
                    </div>

                    {isDuplicate && (
                      <div className="p-2.5 bg-purple-900/20 border border-purple-800/40 rounded-xl text-xs text-purple-300 space-y-1">
                        <p className="font-semibold">Duplicate Diagnostic:</p>
                        <p className="text-[11px] text-purple-200">
                          {job.duplicateMatchReason || `Similarity detected with existing posting in ${job.company || 'same portal'}.`}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center space-y-3 shadow-lg">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
              <p className="text-base font-bold text-white">No data yet</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                No pending or duplicate jobs currently require review. All scraped postings have been reviewed or are pending new extractions.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ============================================================= */}
      {/* 6. SETTINGS SECTION */}
      {/* ============================================================= */}
      {activeTab === 'settings' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="border-b border-slate-800 pb-4">
            <h3 className="text-lg font-bold text-white flex items-center space-x-2">
              <Settings className="w-5 h-5 text-indigo-400" />
              <span>Global Scraper Engine Settings</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Configure default scheduler intervals, crawl depth, keywords, and automated publishing policies in MongoDB.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Interval Setting */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300">Default Scheduler Polling Interval</label>
              <select
                value={globalInterval}
                onChange={e => setGlobalInterval(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="15m">Every 15 Minutes (Aggressive)</option>
                <option value="30m">Every 30 Minutes</option>
                <option value="1h">Every 1 Hour (Recommended)</option>
                <option value="6h">Every 6 Hours</option>
                <option value="24h">Daily (Every 24 Hours)</option>
                <option value="7d">Weekly (Every 7 Days)</option>
              </select>
              <p className="text-[11px] text-slate-500">How frequently the automated cron runner inspects portal feeds.</p>
            </div>

            {/* Depth Setting */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300">Default Crawl Depth</label>
              <select
                value={globalDepth}
                onChange={e => setGlobalDepth(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="Light (10 Jobs)">Light (10 Jobs per portal)</option>
                <option value="Standard (25 Jobs)">Standard (25 Jobs per portal)</option>
                <option value="Deep Crawl (50+ Jobs)">Deep Crawl (50+ Jobs per portal)</option>
              </select>
              <p className="text-[11px] text-slate-500">Maximum page traversal depth during scheduled background passes.</p>
            </div>

            {/* Keywords */}
            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-bold text-slate-300">Global Target Keywords (Comma Separated)</label>
              <input
                type="text"
                value={globalKeywords}
                onChange={e => setGlobalKeywords(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
              />
              <p className="text-[11px] text-slate-500">Keywords used by the extraction parser to prioritize relevant vacancy headers.</p>
            </div>

            {/* Toggles */}
            <div className="p-4 bg-slate-800/40 rounded-xl border border-slate-800 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-white">Master Scheduler Active</p>
                <p className="text-[11px] text-slate-400">Enables automated node-cron background harvesting.</p>
              </div>
              <input
                type="checkbox"
                checked={globalSchedulerEnabled}
                onChange={e => setGlobalSchedulerEnabled(e.target.checked)}
                className="w-5 h-5 rounded text-indigo-600 bg-slate-800 border-slate-700 focus:ring-indigo-500"
              />
            </div>

            <div className="p-4 bg-slate-800/40 rounded-xl border border-slate-800 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-white">Auto-Approve Trusted Sources</p>
                <p className="text-[11px] text-slate-400">Directly publishes vacancies from verified government portals.</p>
              </div>
              <input
                type="checkbox"
                checked={globalAutoApprove}
                onChange={e => setGlobalAutoApprove(e.target.checked)}
                className="w-5 h-5 rounded text-indigo-600 bg-slate-800 border-slate-700 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800 flex items-center justify-end">
            <button
              type="button"
              onClick={handleSaveGlobalSettings}
              className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition shadow-md shadow-indigo-600/20"
            >
              Save Settings to MongoDB
            </button>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* ADD SOURCE MODAL */}
      {/* ============================================================= */}
      {isAddSourceOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <Plus className="w-5 h-5 text-emerald-400" />
                <span>Add Target Scraper Portal</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsAddSourceOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateNewSource} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-300">Portal / Organization Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. FPSC Official Gazette"
                  value={newSourceName}
                  onChange={e => setNewSourceName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-300">Target URL or PDF Endpoint</label>
                <input
                  type="url"
                  required
                  placeholder="https://example.gov.pk/careers"
                  value={newSourceUrl}
                  onChange={e => setNewSourceUrl(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-300">Category</label>
                  <select
                    value={newSourceCategory}
                    onChange={e => setNewSourceCategory(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  >
                    <option value="Government Sector">Government Sector</option>
                    <option value="Private Corporate">Private Corporate</option>
                    <option value="Newspaper Classified">Newspaper Classified</option>
                    <option value="International Remote">International Remote</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-300">Region</label>
                  <select
                    value={newSourceRegion}
                    onChange={e => setNewSourceRegion(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  >
                    <option value="Pakistan">Pakistan</option>
                    <option value="Middle East">Middle East</option>
                    <option value="Europe">Europe</option>
                    <option value="North America">North America</option>
                    <option value="Remote">Remote</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-300">Interval</label>
                  <select
                    value={newSourceInterval}
                    onChange={e => setNewSourceInterval(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  >
                    <option value="1h">1 Hour</option>
                    <option value="6h">6 Hours</option>
                    <option value="24h">24 Hours</option>
                    <option value="7d">7 Days</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-300">Crawl Depth</label>
                  <select
                    value={newSourceDepth}
                    onChange={e => setNewSourceDepth(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  >
                    <option value="Light (10 Jobs)">Light (10 Jobs)</option>
                    <option value="Standard (25 Jobs)">Standard (25 Jobs)</option>
                    <option value="Deep Crawl (50+ Jobs)">Deep Crawl (50+ Jobs)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <input
                  type="checkbox"
                  id="modalAutoApprove"
                  checked={newSourceAutoApprove}
                  onChange={e => setNewSourceAutoApprove(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 bg-slate-800 border-slate-700"
                />
                <label htmlFor="modalAutoApprove" className="text-slate-300 font-medium">
                  Auto-publish extracted jobs without manual moderation
                </label>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddSourceOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                >
                  Save Target Source
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* INSPECT RUN DETAILS MODAL */}
      {/* ============================================================= */}
      {inspectingRun && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">Execution Run Inspection</h3>
                <p className="text-xs text-slate-400">ID: {inspectingRun.runId || inspectingRun.id}</p>
              </div>
              <button
                type="button"
                onClick={() => setInspectingRun(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-slate-800/50 rounded-xl">
                <p className="text-slate-400">Total Found</p>
                <p className="text-sm font-bold text-white mt-0.5">{inspectingRun.totalFound || 0}</p>
              </div>
              <div className="p-3 bg-slate-800/50 rounded-xl">
                <p className="text-slate-400">Approved Live</p>
                <p className="text-sm font-bold text-emerald-400 mt-0.5">{inspectingRun.jobsAccepted || inspectingRun.approvedCount || 0}</p>
              </div>
              <div className="p-3 bg-slate-800/50 rounded-xl">
                <p className="text-slate-400">Duplicates</p>
                <p className="text-sm font-bold text-purple-400 mt-0.5">{inspectingRun.totalDuplicates || 0}</p>
              </div>
              <div className="p-3 bg-slate-800/50 rounded-xl">
                <p className="text-slate-400">Duration</p>
                <p className="text-sm font-bold text-slate-200 mt-0.5">{((inspectingRun.executionDurationMs || 0) / 1000).toFixed(1)}s</p>
              </div>
            </div>

            {inspectingRun.message && (
              <div className="p-3 bg-slate-800/40 rounded-xl text-xs text-slate-300 border border-slate-800">
                <p className="font-bold text-slate-400 mb-1">Message / Output:</p>
                <p>{inspectingRun.message}</p>
              </div>
            )}

            {inspectingRun.sourcesStats && inspectingRun.sourcesStats.length > 0 && (
              <div className="space-y-2 text-xs">
                <p className="font-bold text-slate-300">Sources Breakdown ({inspectingRun.sourcesStats.length}):</p>
                <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden">
                  {inspectingRun.sourcesStats.map((st, i) => (
                    <div key={i} className="p-2.5 bg-slate-800/20 flex items-center justify-between">
                      <div>
                        <p className="font-bold text-white">{st.sourceName}</p>
                        <p className="text-[10px] text-slate-400">Found: {st.jobsFound} • New: {st.newJobs} • Duplicates: {st.duplicates}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        st.status === 'Completed' || st.status === 'Success'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-rose-500/20 text-rose-300'
                      }`}>
                        {st.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setInspectingRun(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs"
              >
                Close Inspection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
