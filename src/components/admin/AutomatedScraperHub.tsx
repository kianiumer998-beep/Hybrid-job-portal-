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
  FileSpreadsheet
} from 'lucide-react';
import { Job, Region, ScrapedJobAuditEntry } from '../../types/job';
import { api } from '../../services/api';

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
  healthStatus?: 'healthy' | 'warning' | 'error';
  lastSuccessfulScrapeAt?: string;
  lastErrorMessage?: string;
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
  discoveredJobs?: Array<{
    title: string;
    company: string;
    source: string;
    status: 'Approved' | 'Pending' | 'Duplicate' | 'Error';
    reason?: string;
  }>;
}

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
  const [reviewTypeFilter, setReviewTypeFilter] = useState<'all' | 'pending' | 'duplicate'>('all');

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
  const [newSourceInterval, setNewSourceInterval] = useState<'15m' | '30m' | '1h' | '6h' | '24h' | '7d'>('24h');
  const [newSourceKeywords, setNewSourceKeywords] = useState('');
  const [newSourceAutoApprove, setNewSourceAutoApprove] = useState(false);

  // Inspect Run Modal State
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
        if (statusFilter === 'Error' && source.healthStatus !== 'error') return false;
      }

      if (categoryFilter !== 'all' && source.category !== categoryFilter) return false;
      if (regionFilter !== 'all' && source.region !== regionFilter) return false;

      return true;
    });
  }, [sourcesList, searchQuery, statusFilter, categoryFilter, regionFilter]);

  // -------------------------------------------------------------
  // Filtered Runs for Step 5: History
  // -------------------------------------------------------------
  const filteredRuns = useMemo(() => {
    return liveRuns.filter(run => {
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

      return true;
    });
  }, [liveRuns, searchQuery, dateFilter]);

  // -------------------------------------------------------------
  // Review Queue Items (Pending jobs & duplicate warnings)
  // -------------------------------------------------------------
  const reviewItems = useMemo(() => {
    return pendingJobs.filter(job => {
      const isDuplicate = (job as any).isDuplicate || (job as any).duplicateWarning ||
        job.description?.toLowerCase().includes('duplicate') ||
        ((job as any).confidenceScore && (job as any).confidenceScore < 60);

      if (reviewTypeFilter === 'pending' && isDuplicate) return false;
      if (reviewTypeFilter === 'duplicate' && !isDuplicate) return false;

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
  }, [pendingJobs, reviewTypeFilter, searchQuery, sourceFilter]);

  // -------------------------------------------------------------
  // Results Feed Items (Discovered Jobs from recent runs & live db)
  // -------------------------------------------------------------
  const resultsItems = useMemo(() => {
    const list: Array<{
      id: string;
      title: string;
      company: string;
      portal: string;
      date: string;
      status: 'Approved' | 'Pending' | 'Duplicate' | 'Error';
      reason?: string;
      rawJob?: Job;
    }> = [];

    // Add approved live jobs
    jobs.slice(0, 50).forEach(j => {
      list.push({
        id: j.id,
        title: j.title,
        company: j.company,
        portal: (j as any).sourcePortal || j.scraperSourceName || j.scrapedSourceDomain || 'Official Portal',
        date: j.createdAt || new Date().toISOString(),
        status: 'Approved',
        rawJob: j
      });
    });

    // Add pending & duplicate jobs
    pendingJobs.slice(0, 50).forEach(pj => {
      const isDup = (pj as any).isDuplicate || (pj as any).duplicateWarning || pj.description?.toLowerCase().includes('duplicate');
      list.push({
        id: pj.id,
        title: pj.title,
        company: pj.company,
        portal: (pj as any).sourcePortal || pj.scraperSourceName || pj.scrapedSourceDomain || 'Web Scraper',
        date: pj.createdAt || new Date().toISOString(),
        status: isDup ? 'Duplicate' : 'Pending',
        reason: isDup ? 'Similar vacancy found in database' : 'Awaiting admin approval',
        rawJob: pj
      });
    });

    // Filter results by resultsTypeFilter
    if (resultsTypeFilter !== 'all') {
      return list.filter(item => item.status === resultsTypeFilter);
    }

    return list;
  }, [jobs, pendingJobs, resultsTypeFilter]);

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
    setIsAddSourceOpen(false);
    setStatusMessage({ text: `Source "${newSource.name}" added successfully!`, type: 'success' });
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
  // Review Queue Handlers (Step 4)
  // -------------------------------------------------------------
  const handleApproveSelectedReview = () => {
    if (selectedReviewIds.length === 0) return;
    selectedReviewIds.forEach(id => onApproveJob(id));
    setSelectedReviewIds([]);
    setStatusMessage({ text: `Approved ${selectedReviewIds.length} jobs to live site.`, type: 'success' });
  };

  const handleApproveAllPending = () => {
    if (pendingJobs.length === 0) return;
    pendingJobs.forEach(j => onApproveJob(j.id));
    setStatusMessage({ text: `Approved all ${pendingJobs.length} pending jobs to live site!`, type: 'success' });
  };

  const handleRejectAllPending = () => {
    if (pendingJobs.length === 0) return;
    if (!confirm(`Are you sure you want to reject all ${pendingJobs.length} pending jobs?`)) return;
    pendingJobs.forEach(j => onRejectJob(j.id, 'Bulk admin rejection'));
    setStatusMessage({ text: `Rejected ${pendingJobs.length} jobs from queue.`, type: 'info' });
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
      r.status || 'Completed',
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
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              r.status === 'Completed'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : r.status === 'Partial'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            }`}
                          >
                            {r.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
            </div>
          </div>

          {/* Bulk Action Controls */}
          {selectedSourceIds.length > 0 && (
            <div className="bg-indigo-950/40 border border-indigo-800/50 rounded-2xl p-3 px-4 flex flex-wrap items-center justify-between gap-3 text-xs">
              <span className="font-bold text-indigo-200">
                {selectedSourceIds.length} sources selected
              </span>
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
                <button
                  type="button"
                  onClick={() => {
                    setActiveStep('run');
                  }}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold flex items-center space-x-1 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Run Selected in Step 2</span>
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
                          checked={selectedSourceIds.length === filteredSources.length && filteredSources.length > 0}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedSourceIds(filteredSources.map(s => s.id));
                            } else {
                              setSelectedSourceIds([]);
                            }
                          }}
                          className="rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-0 cursor-pointer"
                        />
                      </th>
                      <th className="p-4">Source Name & Category</th>
                      <th className="p-4">Website Link</th>
                      <th className="p-4">Region</th>
                      <th className="p-4">Run Frequency</th>
                      <th className="p-4 text-center">Auto-Approve</th>
                      <th className="p-4 text-center">Status</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {filteredSources.map(source => {
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
                          <td className="p-4 max-w-[200px] truncate">
                            <a
                              href={source.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-slate-400 hover:text-indigo-400 flex items-center space-x-1 truncate"
                            >
                              <span className="truncate">{source.url}</span>
                              <ExternalLink className="w-3 h-3 flex-shrink-0" />
                            </a>
                          </td>
                          <td className="p-4">
                            <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 text-[11px]">
                              {source.region}
                            </span>
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
                          <td className="p-4 text-right space-x-1">
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
                {isScrapingActive && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse">
                    Crawler Running...
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

          {/* Quick Action Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
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
                  Only scrape the websites you checked in Step 1.
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

            {/* Card 3: Run Single Source Now */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-lg flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Option C</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300">
                    Single Source
                  </span>
                </div>
                <h4 className="text-base font-bold text-white">Run One Specific Source</h4>
                <p className="text-xs text-slate-400">
                  Pick any configured portal and test or scrape it immediately.
                </p>
              </div>

              <div className="space-y-3 pt-2">
                <select
                  value={selectedSingleSourceId}
                  onChange={(e) => setSelectedSingleSourceId(e.target.value)}
                  aria-label="Select source to run"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none"
                >
                  <option value="">-- Choose a portal --</option>
                  {sourcesList.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.category})
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  disabled={isScrapingActive || !selectedSingleSourceId}
                  onClick={() => handleRunSingleSource(selectedSingleSourceId)}
                  className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold text-xs flex items-center justify-center space-x-2 transition-all shadow-md cursor-pointer disabled:opacity-50"
                >
                  <Play className="w-4 h-4" />
                  <span>Run This Source Now</span>
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
                  {pendingJobs.length} waiting
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Approve or reject scraped jobs before they appear on the public website. You can also override duplicate warnings.
              </p>
            </div>

            <div className="flex items-center space-x-2 flex-wrap gap-2">
              <button
                type="button"
                disabled={pendingJobs.length === 0}
                onClick={handleApproveAllPending}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50 flex items-center space-x-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Approve All Pending ({pendingJobs.length})</span>
              </button>
              <button
                type="button"
                disabled={pendingJobs.length === 0}
                onClick={handleRejectAllPending}
                className="px-4 py-2 bg-slate-800 hover:bg-rose-900/50 text-slate-300 hover:text-rose-300 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
              >
                Reject All
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

          {/* Queue Filters */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center space-x-2 flex-1 min-w-[240px]">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search jobs by title or company..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {(['all', 'pending', 'duplicate'] as const).map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setReviewTypeFilter(type)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    reviewTypeFilter === type
                      ? 'bg-indigo-600 text-white shadow'
                      : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {type === 'all' ? 'All Review Items' : type === 'pending' ? 'Pending Only' : 'Duplicates Only'}
                </button>
              ))}
            </div>
          </div>

          {/* Review Items List */}
          <div className="space-y-3">
            {reviewItems.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center space-y-3 shadow-lg">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                <h4 className="text-sm font-bold text-white">No data yet</h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  The review queue is clear! All scraped jobs have either been published or screened out.
                </p>
              </div>
            ) : (
              reviewItems.map(job => {
                const isDup = (job as any).isDuplicate || (job as any).duplicateWarning || job.description?.toLowerCase().includes('duplicate');
                const isSelected = selectedReviewIds.includes(job.id);

                return (
                  <div
                    key={job.id}
                    className={`bg-slate-900 border rounded-2xl p-5 transition-all shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                      isDup ? 'border-purple-800/60 bg-purple-950/10' : 'border-slate-800'
                    }`}
                  >
                    <div className="flex items-start space-x-3.5">
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

                      <div className="space-y-1">
                        <div className="flex items-center space-x-2 flex-wrap">
                          <h4 className="text-sm font-black text-white">{job.title}</h4>
                          {isDup ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center space-x-1">
                              <AlertTriangle className="w-3 h-3" />
                              <span>Duplicate Alert</span>
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              Pending Review
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-slate-400">
                          {job.company} • {job.region} • Source: <span className="text-indigo-400 font-semibold">{(job as any).sourcePortal || job.scraperSourceName || job.scrapedSourceDomain || 'External'}</span>
                        </p>

                        {isDup && (
                          <p className="text-[11px] text-purple-300/80 pt-0.5">
                            Notice: A job with a very similar title and employer already exists in active listings.
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => onApproveJob(job.id)}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center space-x-1 transition-all cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Approve to Live</span>
                      </button>

                      {isDup && onOverrideDuplicatesToLive && (
                        <button
                          type="button"
                          onClick={() => onOverrideDuplicatesToLive([job])}
                          className="px-3 py-1.5 bg-purple-700 hover:bg-purple-600 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                        >
                          Force Publish
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => onRejectJob(job.id, 'Admin discarded from review')}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-rose-900/50 text-slate-300 hover:text-rose-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                );
              })
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
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
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
                    {filteredRuns.map(run => (
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
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                              run.status === 'Completed'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : run.status === 'Partial'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            }`}
                          >
                            {run.status}
                          </span>
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
    </div>
  );
};
