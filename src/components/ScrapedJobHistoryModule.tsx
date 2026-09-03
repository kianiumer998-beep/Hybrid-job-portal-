import React, { useState, useMemo } from 'react';
import { 
  Job, 
  ScrapedJobAuditEntry, 
  ScraperBatchRun, 
  ScrapedJobAuditAction, 
  Region, 
  Currency 
} from '../types/job';
import { 
  Bot, 
  History, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  X, 
  Eye, 
  Globe, 
  Download, 
  Filter, 
  Search, 
  Trash2, 
  ArrowUpRight, 
  ShieldCheck, 
  FileText, 
  RefreshCw, 
  Sparkles, 
  ChevronRight, 
  Layers, 
  Calendar, 
  Activity, 
  Zap, 
  SlidersHorizontal,
  ExternalLink,
  CheckSquare,
  Square,
  ChevronDown,
  Building2,
  DollarSign
} from 'lucide-react';

interface ScrapedJobHistoryModuleProps {
  auditLogs: ScrapedJobAuditEntry[];
  batchRuns: ScraperBatchRun[];
  jobs: Job[];
  pendingJobs: Job[];
  onApproveJob: (jobId: string) => void;
  onRejectJob: (jobId: string, reason?: string) => void;
  onDeleteJob: (jobId: string) => void;
  onBatchApprove?: (jobIds: string[]) => void;
  onBatchReject?: (jobIds: string[], reason: string) => void;
  onRunScraperNow?: (sourceId?: string) => void;
  onUpdateAuditLogs?: (logs: ScrapedJobAuditEntry[]) => void;
}

export const ScrapedJobHistoryModule: React.FC<ScrapedJobHistoryModuleProps> = ({
  auditLogs = [],
  batchRuns = [],
  jobs = [],
  pendingJobs = [],
  onApproveJob,
  onRejectJob,
  onDeleteJob,
  onBatchApprove,
  onBatchReject,
  onRunScraperNow,
  onUpdateAuditLogs
}) => {
  // Navigation sub-tabs
  const [subTab, setSubTab] = useState<'catalog' | 'batches' | 'pipelines' | 'telemetry'>('catalog');

  // Filter and Search States
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Pending Review' | 'Approved Live' | 'Auto-Approved' | 'Rejected'>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [regionFilter, setRegionFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'yesterday' | 'week'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'uniqueness' | 'latency'>('newest');

  // Selected Jobs for Bulk Actions
  const [selectedAuditIds, setSelectedAuditIds] = useState<string[]>([]);

  // Detailed Modal View
  const [selectedAuditEntry, setSelectedAuditEntry] = useState<ScrapedJobAuditEntry | null>(null);
  const [selectedBatchDetails, setSelectedBatchDetails] = useState<ScraperBatchRun | null>(null);

  // Timezone selector display (UTC, PKT, EST, GMT, GST)
  const [activeTimezone, setActiveTimezone] = useState<'PKT' | 'UTC' | 'EST' | 'GMT' | 'GST'>('PKT');

  // Compute live combined audit entries
  const currentLogs = useMemo(() => {
    // Reconcile and deduplicate audit logs by id to guarantee zero duplicate keys
    const seen = new Set<string>();
    const uniqueLogs: ScrapedJobAuditEntry[] = [];
    (auditLogs || []).forEach((entry) => {
      if (entry && entry.id) {
        if (!seen.has(entry.id)) {
          seen.add(entry.id);
          uniqueLogs.push(entry);
        }
      }
    });
    return uniqueLogs;
  }, [auditLogs]);

  // Filtered Audit Entries
  const filteredAuditLogs = useMemo(() => {
    return currentLogs.filter((entry) => {
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = entry.jobTitle.toLowerCase().includes(q);
        const matchesCompany = entry.company.toLowerCase().includes(q);
        const matchesSource = entry.sourcePortalName.toLowerCase().includes(q);
        const matchesDomain = entry.sourceDomain.toLowerCase().includes(q);
        const matchesBatch = entry.batchId.toLowerCase().includes(q);
        if (!matchesTitle && !matchesCompany && !matchesSource && !matchesDomain && !matchesBatch) {
          return false;
        }
      }

      // Status filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'Pending Review' && entry.status !== 'Pending Review') return false;
        if (statusFilter === 'Approved Live' && entry.status !== 'Approved Live') return false;
        if (statusFilter === 'Auto-Approved' && entry.status !== 'Auto-Approved') return false;
        if (statusFilter === 'Rejected' && entry.status !== 'Rejected') return false;
      }

      // Source filter
      if (sourceFilter !== 'all') {
        if (sourceFilter === 'rozee' && !entry.sourceDomain.includes('rozee')) return false;
        if (sourceFilter === 'fpsc' && !entry.sourceDomain.includes('fpsc') && !entry.sourceDomain.includes('gov')) return false;
        if (sourceFilter === 'jang' && !entry.sourceDomain.includes('jang')) return false;
        if (sourceFilter === 'linkedin' && !entry.sourceDomain.includes('linkedin')) return false;
        if (sourceFilter === 'gulftalent' && !entry.sourceDomain.includes('gulftalent')) return false;
      }

      // Region filter
      if (regionFilter !== 'all' && entry.region !== regionFilter) {
        return false;
      }

      // Category filter
      if (categoryFilter !== 'all' && entry.category !== categoryFilter) {
        return false;
      }

      // Date filter
      if (dateFilter !== 'all') {
        const dateStr = entry.scrapedAt.substring(0, 10);
        if (dateFilter === 'today' && dateStr !== '2026-08-26') return false;
        if (dateFilter === 'yesterday' && dateStr !== '2026-08-25') return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'newest') return b.scrapedAt.localeCompare(a.scrapedAt);
      if (sortBy === 'oldest') return a.scrapedAt.localeCompare(b.scrapedAt);
      if (sortBy === 'uniqueness') return b.deduplicationScore - a.deduplicationScore;
      if (sortBy === 'latency') return a.crawlLatencyMs - b.crawlLatencyMs;
      return 0;
    });
  }, [currentLogs, searchQuery, statusFilter, sourceFilter, regionFilter, categoryFilter, dateFilter, sortBy]);

  // Overall Statistics
  const stats = useMemo(() => {
    const totalScraped = currentLogs.length;
    const pendingCount = currentLogs.filter(l => l.status === 'Pending Review').length;
    const approvedCount = currentLogs.filter(l => l.status === 'Approved Live' || l.status === 'Auto-Approved').length;
    const autoApprovedCount = currentLogs.filter(l => l.status === 'Auto-Approved').length;
    const rejectedCount = currentLogs.filter(l => l.status === 'Rejected').length;
    const totalBatches = batchRuns.length;
    const avgLatency = currentLogs.length > 0 
      ? Math.round(currentLogs.reduce((acc, c) => acc + (c.crawlLatencyMs || 300), 0) / currentLogs.length) 
      : 340;

    return {
      totalScraped,
      pendingCount,
      approvedCount,
      autoApprovedCount,
      rejectedCount,
      totalBatches,
      avgLatency
    };
  }, [currentLogs, batchRuns]);

  // Bulk Selection Handlers
  const handleSelectAll = () => {
    if (selectedAuditIds.length === filteredAuditLogs.length) {
      setSelectedAuditIds([]);
    } else {
      setSelectedAuditIds(filteredAuditLogs.map(l => l.id));
    }
  };

  const handleToggleSelectOne = (id: string) => {
    setSelectedAuditIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleBulkApprove = () => {
    if (selectedAuditIds.length === 0) return;
    const selectedEntries = currentLogs.filter(l => selectedAuditIds.includes(l.id));
    const jobIds = selectedEntries.map(e => e.jobId);

    if (onBatchApprove) {
      onBatchApprove(jobIds);
    } else {
      jobIds.forEach(id => onApproveJob(id));
    }

    // Update internal audit logs
    const updated = currentLogs.map(entry => {
      if (selectedAuditIds.includes(entry.id) && entry.status === 'Pending Review') {
        const newTimelineAction: ScrapedJobAuditAction = {
          id: 'act-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
          timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
          relativeTime: 'Just now',
          action: 'Approved by Admin',
          performedBy: 'Admin User',
          actorName: 'Admin Control Center',
          notes: 'Batch approved in bulk via Scraped Job History Module.',
          previousStatus: entry.status,
          newStatus: 'Approved Live'
        };
        return {
          ...entry,
          status: 'Approved Live' as const,
          reviewTimeline: [newTimelineAction, ...entry.reviewTimeline]
        };
      }
      return entry;
    });

    if (onUpdateAuditLogs) onUpdateAuditLogs(updated);
    setSelectedAuditIds([]);
    alert(`Successfully approved and published ${jobIds.length} scraped jobs to the live board!`);
  };

  const handleBulkReject = () => {
    if (selectedAuditIds.length === 0) return;
    const reason = prompt('Enter Rejection Reason for all selected scraped jobs:', 'Failed editorial compliance check or inaccurate salary bracket.');
    if (!reason) return;

    const selectedEntries = currentLogs.filter(l => selectedAuditIds.includes(l.id));
    const jobIds = selectedEntries.map(e => e.jobId);

    if (onBatchReject) {
      onBatchReject(jobIds, reason);
    } else {
      jobIds.forEach(id => onRejectJob(id, reason));
    }

    // Update internal audit logs
    const updated = currentLogs.map(entry => {
      if (selectedAuditIds.includes(entry.id)) {
        const newTimelineAction: ScrapedJobAuditAction = {
          id: 'act-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
          timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
          relativeTime: 'Just now',
          action: 'Rejected',
          performedBy: 'Admin User',
          actorName: 'Admin Control Center',
          notes: `Batch rejected: ${reason}`,
          previousStatus: entry.status,
          newStatus: 'Rejected'
        };
        return {
          ...entry,
          status: 'Rejected' as const,
          rejectionReason: reason,
          reviewTimeline: [newTimelineAction, ...entry.reviewTimeline]
        };
      }
      return entry;
    });

    if (onUpdateAuditLogs) onUpdateAuditLogs(updated);
    setSelectedAuditIds([]);
    alert(`Marked ${jobIds.length} scraped jobs as Rejected.`);
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = ['Audit ID', 'Batch ID', 'Job Title', 'Company', 'Scraped At (UTC)', 'Source Portal', 'Source Domain', 'Category', 'Region', 'Salary', 'Status', 'Deduplication Score', 'Latency (ms)'];
    const rows = filteredAuditLogs.map(l => [
      `"${l.id}"`,
      `"${l.batchId}"`,
      `"${l.jobTitle.replace(/"/g, '""')}"`,
      `"${l.company.replace(/"/g, '""')}"`,
      `"${l.scrapedAt}"`,
      `"${l.sourcePortalName}"`,
      `"${l.sourceDomain}"`,
      `"${l.category}"`,
      `"${l.region}"`,
      `"${l.salaryText}"`,
      `"${l.status}"`,
      `"${l.deduplicationScore}%"`,
      `"${l.crawlLatencyMs}ms"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `scraped-jobs-audit-${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Single job approval with audit update
  const handleSingleApprove = (entry: ScrapedJobAuditEntry) => {
    onApproveJob(entry.jobId);

    const newAction: ScrapedJobAuditAction = {
      id: 'act-' + Date.now(),
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      relativeTime: 'Just now',
      action: 'Approved by Admin',
      performedBy: 'Admin User',
      actorName: 'Admin Review Desk',
      notes: 'Job approved and posted directly to Live portal board.',
      previousStatus: entry.status,
      newStatus: 'Approved Live'
    };

    const updated = currentLogs.map(item => item.id === entry.id ? {
      ...item,
      status: 'Approved Live' as const,
      reviewTimeline: [newAction, ...item.reviewTimeline]
    } : item);

    if (onUpdateAuditLogs) onUpdateAuditLogs(updated);
    if (selectedAuditEntry && selectedAuditEntry.id === entry.id) {
      setSelectedAuditEntry({
        ...selectedAuditEntry,
        status: 'Approved Live',
        reviewTimeline: [newAction, ...selectedAuditEntry.reviewTimeline]
      });
    }
  };

  // Single job reject with audit update
  const handleSingleReject = (entry: ScrapedJobAuditEntry) => {
    const reason = prompt(`Enter rejection reason for "${entry.jobTitle}":`, 'Salary range inconsistent with regional standards.');
    if (!reason) return;

    onRejectJob(entry.jobId, reason);

    const newAction: ScrapedJobAuditAction = {
      id: 'act-' + Date.now(),
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      relativeTime: 'Just now',
      action: 'Rejected',
      performedBy: 'Admin User',
      actorName: 'Admin Review Desk',
      notes: `Rejected by editorial desk: ${reason}`,
      previousStatus: entry.status,
      newStatus: 'Rejected'
    };

    const updated = currentLogs.map(item => item.id === entry.id ? {
      ...item,
      status: 'Rejected' as const,
      rejectionReason: reason,
      reviewTimeline: [newAction, ...item.reviewTimeline]
    } : item);

    if (onUpdateAuditLogs) onUpdateAuditLogs(updated);
    if (selectedAuditEntry && selectedAuditEntry.id === entry.id) {
      setSelectedAuditEntry({
        ...selectedAuditEntry,
        status: 'Rejected',
        rejectionReason: reason,
        reviewTimeline: [newAction, ...selectedAuditEntry.reviewTimeline]
      });
    }
  };

  return (
    <div className="space-y-6 text-white">
      {/* ========================================================================= */}
      {/* EXECUTIVE SUMMARY & TELEMETRY HEADER CARDS */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* TOTAL SCRAPED ALL TIME */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase tracking-wider">
            <span>Total Ingested</span>
            <Bot className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-black text-white">{stats.totalScraped}</div>
          <div className="text-[10px] text-slate-400 font-medium flex items-center space-x-1">
            <span className="text-emerald-400 font-bold">100% cataloged</span>
            <span>in history</span>
          </div>
        </div>

        {/* PENDING ADMIN REVIEW QUEUE */}
        <div className="bg-amber-950/20 border border-amber-500/30 rounded-2xl p-4 space-y-1 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between text-amber-300 text-xs font-bold uppercase tracking-wider">
            <span>Pending Review</span>
            <Clock className="w-4 h-4 text-amber-400 animate-pulse" />
          </div>
          <div className="text-2xl font-black text-amber-400">{stats.pendingCount}</div>
          <div className="text-[10px] text-amber-300/80 font-medium">
            Awaiting Admin Verification
          </div>
        </div>

        {/* APPROVED / LIVE ON PORTAL */}
        <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-2xl p-4 space-y-1 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between text-emerald-300 text-xs font-bold uppercase tracking-wider">
            <span>Published Live</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400">{stats.approvedCount}</div>
          <div className="text-[10px] text-emerald-300/80 font-medium">
            Active on Public Board
          </div>
        </div>

        {/* AUTO-APPROVED BY CRON RULE */}
        <div className="bg-purple-950/20 border border-purple-500/30 rounded-2xl p-4 space-y-1 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between text-purple-300 text-xs font-bold uppercase tracking-wider">
            <span>Auto-Approved</span>
            <Sparkles className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-black text-purple-300">{stats.autoApprovedCount}</div>
          <div className="text-[10px] text-purple-300/80 font-medium">
            Cron Policy Direct Sync
          </div>
        </div>

        {/* TOTAL SCRAPING SESSIONS / RUNS */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase tracking-wider">
            <span>Batch Runs</span>
            <Layers className="w-4 h-4 text-teal-400" />
          </div>
          <div className="text-2xl font-black text-white">{stats.totalBatches}</div>
          <div className="text-[10px] text-teal-400 font-medium">
            Automated Cron Sessions
          </div>
        </div>

        {/* INGESTION HEALTH & SPEED */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase tracking-wider">
            <span>Avg Latency</span>
            <Zap className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-white">{stats.avgLatency}<span className="text-xs text-slate-400 font-normal ml-0.5">ms</span></div>
          <div className="text-[10px] text-emerald-400 font-medium flex items-center space-x-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping inline-block"></span>
            <span>99.8% System Uptime</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SUB-NAVIGATION TAB CONTROLLER */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 p-2 sm:p-2.5 rounded-2xl">
        <div className="flex items-center space-x-1.5 sm:space-x-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          <button
            onClick={() => setSubTab('catalog')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center space-x-2 shrink-0 cursor-pointer ${
              subTab === 'catalog'
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                : 'bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Scraped Jobs History Catalog</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${subTab === 'catalog' ? 'bg-slate-950 text-amber-400' : 'bg-slate-800 text-slate-300'}`}>
              {currentLogs.length}
            </span>
          </button>

          <button
            onClick={() => setSubTab('batches')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center space-x-2 shrink-0 cursor-pointer ${
              subTab === 'batches'
                ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                : 'bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>When Did Jobs Get Scraped? (Batch Logs)</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${subTab === 'batches' ? 'bg-indigo-950 text-indigo-300' : 'bg-slate-800 text-slate-300'}`}>
              {batchRuns.length}
            </span>
          </button>

          <button
            onClick={() => setSubTab('pipelines')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center space-x-2 shrink-0 cursor-pointer ${
              subTab === 'pipelines'
                ? 'bg-teal-500 text-slate-950 shadow-lg shadow-teal-500/20'
                : 'bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Globe className="w-4 h-4" />
            <span>International Pipelines & Geo-Taxonomy</span>
          </button>

          <button
            onClick={() => setSubTab('telemetry')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center space-x-2 shrink-0 cursor-pointer ${
              subTab === 'telemetry'
                ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/20'
                : 'bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Scraper Intelligence & Telemetry</span>
          </button>
        </div>

        {/* FAST ACTION BUTTONS: TIMEZONE SWITCHER & EXPORT */}
        <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
          <div className="flex items-center space-x-1 bg-slate-950 border border-slate-800 rounded-xl p-1 text-[11px] font-bold">
            <span className="text-slate-500 px-1 text-[10px]">TZ:</span>
            {(['PKT', 'UTC', 'EST', 'GST'] as const).map((tz) => (
              <button
                key={tz}
                onClick={() => setActiveTimezone(tz)}
                className={`px-1.5 py-0.5 rounded-lg transition-all cursor-pointer ${
                  activeTimezone === tz
                    ? 'bg-amber-500/20 text-amber-300 font-black border border-amber-500/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tz}
              </button>
            ))}
          </div>

          <button
            onClick={handleExportCSV}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl flex items-center space-x-1.5 border border-slate-700 cursor-pointer transition-all shrink-0"
            title="Export CSV Audit Ledger"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Export Audit CSV</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SUB-TAB 1: SCRAPED JOBS HISTORY CATALOG & AUDIT TRAIL */}
      {/* ========================================================================= */}
      {subTab === 'catalog' && (
        <div className="space-y-4">
          {/* SEARCH, FILTER & BULK CONTROLS BAR */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xl">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 text-xs">
              {/* SEARCH INPUT */}
              <div className="lg:col-span-4 relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by job title, company, batch ID, domain..."
                  className="w-full pl-9 pr-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                />
              </div>

              {/* STATUS FILTER */}
              <div className="lg:col-span-2">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-bold"
                >
                  <option value="all">All Review Statuses ({currentLogs.length})</option>
                  <option value="Pending Review">⏳ Pending Review ({stats.pendingCount})</option>
                  <option value="Approved Live">✅ Approved Live ({stats.approvedCount})</option>
                  <option value="Auto-Approved">⚡ Auto-Approved ({stats.autoApprovedCount})</option>
                  <option value="Rejected">❌ Rejected ({stats.rejectedCount})</option>
                </select>
              </div>

              {/* SOURCE PORTAL FILTER */}
              <div className="lg:col-span-2">
                <select
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-bold"
                >
                  <option value="all">All Source Portals</option>
                  <option value="rozee">Rozee.pk Tech Jobs</option>
                  <option value="fpsc">FPSC / Govt Portals</option>
                  <option value="jang">Daily Jang Classifieds</option>
                  <option value="linkedin">LinkedIn Global Remote</option>
                  <option value="gulftalent">GulfTalent UAE/Saudi</option>
                </select>
              </div>

              {/* GEOGRAPHIC REGION FILTER */}
              <div className="lg:col-span-2">
                <select
                  value={regionFilter}
                  onChange={(e) => setRegionFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-bold"
                >
                  <option value="all">All Regions (Global)</option>
                  <option value="Pakistan">🇵🇰 Pakistan</option>
                  <option value="Global">🌐 Global Remote</option>
                  <option value="UAE">🇦🇪 UAE / Dubai</option>
                  <option value="Saudi Arabia">🇸🇦 Saudi Arabia</option>
                  <option value="US">🇺🇸 United States</option>
                  <option value="UK">🇬🇧 United Kingdom</option>
                  <option value="Europe">🇪🇺 Europe</option>
                  <option value="Canada">🇨🇦 Canada</option>
                  <option value="Australia">🇦🇺 Australia</option>
                </select>
              </div>

              {/* DATE RANGE FILTER */}
              <div className="lg:col-span-2">
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-bold"
                >
                  <option value="all">All Scraping Dates</option>
                  <option value="today">Today (2026-08-26)</option>
                  <option value="yesterday">Yesterday (2026-08-25)</option>
                </select>
              </div>
            </div>

            {/* BULK ACTION CONTROLLER (WHEN JOBS ARE SELECTED) */}
            {selectedAuditIds.length > 0 && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fadeIn">
                <div className="flex items-center space-x-2 text-xs font-bold text-amber-300">
                  <CheckSquare className="w-4 h-4 text-amber-400" />
                  <span>{selectedAuditIds.length} Scraped Positions Selected</span>
                </div>

                <div className="flex items-center space-x-2 flex-wrap gap-y-1.5">
                  <button
                    onClick={handleBulkApprove}
                    className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black rounded-lg shadow-lg shadow-emerald-500/20 flex items-center space-x-1.5 cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Batch Approve & Publish ({selectedAuditIds.length})</span>
                  </button>

                  <button
                    onClick={handleBulkReject}
                    className="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white text-xs font-bold rounded-lg border border-rose-500/30 flex items-center space-x-1.5 cursor-pointer transition-all"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Batch Reject ({selectedAuditIds.length})</span>
                  </button>

                  <button
                    onClick={() => setSelectedAuditIds([])}
                    className="px-2.5 py-1.5 bg-slate-800 text-slate-400 hover:text-white text-xs font-bold rounded-lg cursor-pointer"
                  >
                    Deselect All
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* AUDIT LOG TABLE & CARDS */}
          {filteredAuditLogs.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 space-y-3 shadow-xl">
              <Bot className="w-12 h-12 text-slate-600 mx-auto" />
              <h4 className="text-base font-bold text-white">No Scraped Positions Found</h4>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                No scraped jobs match your current search filters. Try adjusting your status, date, or source filter options.
              </p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                  setSourceFilter('all');
                  setRegionFilter('all');
                  setDateFilter('all');
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl cursor-pointer"
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
              {/* TABLE HEADER */}
              <div className="p-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between text-xs">
                <div className="flex items-center space-x-3">
                  <button
                    onClick={handleSelectAll}
                    className="text-slate-400 hover:text-white flex items-center space-x-1.5 font-bold cursor-pointer"
                  >
                    {selectedAuditIds.length === filteredAuditLogs.length ? (
                      <CheckSquare className="w-4 h-4 text-amber-400" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-500" />
                    )}
                    <span>Select Page ({filteredAuditLogs.length})</span>
                  </button>

                  <span className="text-slate-600">|</span>

                  <span className="text-slate-400">
                    Showing <strong className="text-white">{filteredAuditLogs.length}</strong> scraped audit logs
                  </span>
                </div>

                <div className="flex items-center space-x-2 text-xs">
                  <span className="text-slate-500 hidden sm:inline">Sort:</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white font-bold"
                  >
                    <option value="newest">Newest Scraped First</option>
                    <option value="oldest">Oldest Scraped First</option>
                    <option value="uniqueness">Highest Deduplication Score</option>
                    <option value="latency">Fastest Ingestion Latency</option>
                  </select>
                </div>
              </div>

              {/* TABLE ITEMS */}
              <div className="divide-y divide-slate-800/80">
                {filteredAuditLogs.map((entry, aIdx) => {
                  const isSelected = selectedAuditIds.includes(entry.id);
                  const isPending = entry.status === 'Pending Review';
                  const isApproved = entry.status === 'Approved Live' || entry.status === 'Auto-Approved';
                  const isAuto = entry.status === 'Auto-Approved';
                  const isRejected = entry.status === 'Rejected';

                  return (
                    <div
                      key={entry.id ? `${entry.id}-${aIdx}` : `audit-entry-${aIdx}`}
                      className={`p-4 sm:p-5 transition-all hover:bg-slate-800/30 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 ${
                        isSelected ? 'bg-amber-500/5' : ''
                      }`}
                    >
                      {/* LEFT: SELECTION CHECKBOX & JOB CORE INFO */}
                      <div className="flex items-start space-x-3 flex-1 min-w-0">
                        <button
                          onClick={() => handleToggleSelectOne(entry.id)}
                          className="mt-1 text-slate-500 hover:text-amber-400 cursor-pointer shrink-0"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-amber-400" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-600" />
                          )}
                        </button>

                        <div className="space-y-1.5 min-w-0 flex-1">
                          {/* BADGES ROW */}
                          <div className="flex items-center space-x-2 flex-wrap gap-y-1 text-[10px]">
                            {/* REVIEW STATUS BADGE */}
                            <span className={`px-2.5 py-0.5 rounded-full font-black flex items-center space-x-1 ${
                              isPending
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : isAuto
                                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                : isApproved
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            }`}>
                              {isPending && <Clock className="w-3 h-3 text-amber-400" />}
                              {isAuto && <Sparkles className="w-3 h-3 text-purple-400" />}
                              {isApproved && !isAuto && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                              {isRejected && <AlertCircle className="w-3 h-3 text-rose-400" />}
                              <span>{entry.status}</span>
                            </span>

                            {/* SOURCE PORTAL DOMAIN BADGE */}
                            <span className="px-2 py-0.5 rounded-md font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 flex items-center space-x-1">
                              <Globe className="w-3 h-3 text-indigo-400" />
                              <span>{entry.sourceDomain}</span>
                            </span>

                            {/* SECTOR CATEGORY */}
                            <span className="px-2 py-0.5 rounded-md font-bold bg-slate-800 text-slate-300 border border-slate-700">
                              {entry.category}
                            </span>

                            {/* GOVT SCALE / NEWSPAPER SPECIFIC BADGES */}
                            {entry.isGovtJob && (
                              <span className="px-2 py-0.5 rounded-md font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                🏛️ {entry.govtScale || 'BPS Scale'}
                              </span>
                            )}

                            {entry.isNewspaperAd && (
                              <span className="px-2 py-0.5 rounded-md font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30">
                                📰 {entry.newspaperName || 'Daily Jang'}
                              </span>
                            )}

                            {/* DEDUPLICATION SCORE */}
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-slate-950 text-slate-400 border border-slate-800" title="Deduplication uniqueness score">
                              {entry.deduplicationScore}% unique
                            </span>
                          </div>

                          {/* JOB TITLE & COMPANY */}
                          <div className="flex items-center space-x-2">
                            <h4
                              onClick={() => setSelectedAuditEntry(entry)}
                              className="font-black text-white text-sm sm:text-base hover:text-amber-400 cursor-pointer transition-colors line-clamp-1"
                            >
                              {entry.jobTitle}
                            </h4>
                          </div>

                          {/* COMPANY, LOCATION, SALARY INFO */}
                          <div className="text-xs text-slate-400 font-medium flex items-center space-x-2 flex-wrap gap-y-1">
                            <span className="text-indigo-400 font-bold flex items-center space-x-1">
                              <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                              <span>{entry.company}</span>
                            </span>
                            <span>•</span>
                            <span>📍 {entry.city ? `${entry.city}, ${entry.country || entry.region}` : (entry.country || entry.region)}</span>
                            <span>•</span>
                            <span className="text-emerald-400 font-bold flex items-center space-x-1">
                              <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                              <span>{entry.salaryText}</span>
                            </span>
                          </div>

                          {/* SCRAPED TIMESTAMP & BATCH REFERENCE */}
                          <div className="flex items-center space-x-3 text-[11px] text-slate-500 pt-0.5">
                            <div className="flex items-center space-x-1 text-slate-400">
                              <Clock className="w-3 h-3 text-amber-400/80" />
                              <span>Scraped: <strong className="text-slate-300 font-mono">{entry.scrapedAt} {entry.scrapedTimezone}</strong></span>
                            </div>
                            <span>•</span>
                            <div className="font-mono text-slate-500">
                              Batch: <strong className="text-indigo-400/90">{entry.batchId}</strong>
                            </div>
                            <span>•</span>
                            <div className="text-slate-500">
                              Latency: <strong className="text-slate-400">{entry.crawlLatencyMs}ms</strong>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* RIGHT: ACTION CONTROLS & AUDIT INSPECT */}
                      <div className="flex items-center space-x-2 shrink-0 self-end lg:self-center flex-wrap gap-y-1.5">
                        {/* AUDIT INSPECTOR BUTTON */}
                        <button
                          onClick={() => setSelectedAuditEntry(entry)}
                          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 flex items-center space-x-1.5 cursor-pointer transition-all"
                        >
                          <Eye className="w-3.5 h-3.5 text-indigo-400" />
                          <span>Audit Trail ({entry.reviewTimeline.length})</span>
                        </button>

                        {/* SOURCE LINK */}
                        {entry.sourceUrl && (
                          <a
                            href={entry.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center justify-center cursor-pointer"
                            title="Open Original Source Website"
                          >
                            <ExternalLink className="w-3.5 h-3.5 text-indigo-400" />
                          </a>
                        )}

                        {/* APPROVE BUTTON (IF PENDING) */}
                        {isPending && (
                          <button
                            onClick={() => handleSingleApprove(entry)}
                            className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-lg shadow-emerald-500/20 flex items-center space-x-1 cursor-pointer transition-all"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Approve & Publish</span>
                          </button>
                        )}

                        {/* REJECT BUTTON (IF PENDING) */}
                        {isPending && (
                          <button
                            onClick={() => handleSingleReject(entry)}
                            className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white text-xs font-bold border border-rose-500/30 flex items-center space-x-1 cursor-pointer transition-all"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Reject</span>
                          </button>
                        )}

                        {/* DELETE ACTION */}
                        <button
                          onClick={() => {
                            if (confirm(`Remove scraped job "${entry.jobTitle}" from database?`)) {
                              onDeleteJob(entry.jobId);
                              if (onUpdateAuditLogs) {
                                onUpdateAuditLogs(currentLogs.filter(l => l.id !== entry.id));
                              }
                            }
                          }}
                          className="p-2 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded-xl cursor-pointer"
                          title="Delete from history"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 2: WHEN DID JOBS GET SCRAPED? (SCRAPER RUN SESSIONS & BATCHES) */}
      {/* ========================================================================= */}
      {subTab === 'batches' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-800 pb-3">
              <div>
                <h4 className="text-base font-black text-white flex items-center space-x-2">
                  <Clock className="w-5 h-5 text-indigo-400" />
                  <span>Scraper Execution Sessions & Exact Cron Timestamps</span>
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Complete chronological trace of when the scraping engine executed, which portals were scraped, duration, and whether positions were auto-approved or queued for review.
                </p>
              </div>

              {onRunScraperNow && (
                <button
                  onClick={() => onRunScraperNow()}
                  className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white font-black text-xs rounded-xl shadow-lg shadow-indigo-500/20 flex items-center space-x-2 cursor-pointer shrink-0"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Trigger Immediate Scrape Session</span>
                </button>
              )}
            </div>

            {/* BATCH RUNS LIST */}
            <div className="space-y-3">
              {batchRuns.map((batch, bIdx) => (
                <div
                  key={batch.batchId ? `${batch.batchId}-${bIdx}` : `batch-run-${bIdx}`}
                  className="bg-slate-950 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-3 hover:border-slate-700 transition-all"
                >
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                          {batch.batchId}
                        </span>

                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          HTTP {batch.httpStatusCode} OK
                        </span>

                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300">
                          ⚡ {batch.triggerType}
                        </span>

                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300">
                          📍 {batch.region}
                        </span>
                      </div>

                      <h5 className="font-black text-white text-sm sm:text-base">
                        {batch.sourceName}
                      </h5>

                      <div className="text-xs text-slate-400 flex items-center space-x-2 flex-wrap">
                        <span>Started: <strong className="text-amber-300 font-mono">{batch.startTime}</strong></span>
                        <span>•</span>
                        <span>Finished: <strong className="text-slate-300 font-mono">{batch.endTime}</strong></span>
                        <span>•</span>
                        <span>Duration: <strong className="text-slate-300">{(batch.executionDurationMs / 1000).toFixed(2)}s</strong></span>
                      </div>
                    </div>

                    {/* METRICS PILLS */}
                    <div className="flex items-center space-x-2 shrink-0">
                      <div className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-center">
                        <div className="text-xs font-black text-white">{batch.totalExtracted}</div>
                        <div className="text-[9px] text-slate-500 uppercase font-bold">Extracted</div>
                      </div>

                      <div className="px-3 py-1.5 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-center">
                        <div className="text-xs font-black text-emerald-400">{batch.approvedCount}</div>
                        <div className="text-[9px] text-emerald-500/80 uppercase font-bold">Approved</div>
                      </div>

                      <div className="px-3 py-1.5 bg-amber-950/40 border border-amber-500/30 rounded-xl text-center">
                        <div className="text-xs font-black text-amber-400">{batch.pendingCount}</div>
                        <div className="text-[9px] text-amber-500/80 uppercase font-bold">In Review</div>
                      </div>

                      <div className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-center">
                        <div className="text-xs font-black text-slate-400">{batch.duplicatesSkipped}</div>
                        <div className="text-[9px] text-slate-500 uppercase font-bold">Duplicates</div>
                      </div>

                      <button
                        onClick={() => setSelectedBatchDetails(selectedBatchDetails?.batchId === batch.batchId ? null : batch)}
                        className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-bold rounded-xl cursor-pointer text-slate-200 ml-1"
                      >
                        {selectedBatchDetails?.batchId === batch.batchId ? 'Hide Logs' : 'View Trace'}
                      </button>
                    </div>
                  </div>

                  {/* EXPANDED TRACE LOG */}
                  {selectedBatchDetails?.batchId === batch.batchId && (
                    <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-2 text-xs font-mono">
                      <div className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider flex items-center justify-between">
                        <span>Ingestion Execution Trace</span>
                        <span className="text-[10px] text-slate-500">Source: {batch.sourceUrl}</span>
                      </div>
                      <div className="space-y-1 text-slate-300 text-[11px]">
                        {batch.logTrace.map((line, idx) => (
                          <div key={idx} className="flex items-start space-x-2">
                            <span className="text-slate-600 font-bold">&gt;</span>
                            <span className="text-emerald-400/90">{line}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 3: INTERNATIONAL PIPELINES & GEO-TAXONOMY */}
      {/* ========================================================================= */}
      {subTab === 'pipelines' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            {
              region: 'Pakistan',
              flag: '🇵🇰',
              currency: 'PKR',
              sources: ['Rozee.pk Tech Feed', 'FPSC Federal Govt Portal', 'Daily Jang Sunday Classifieds', 'PPSC Gazette'],
              autoApproveRule: 'Govt jobs: Auto-Approved; Classifieds: Pending Review',
              dedupStatus: 'Enabled (98.5% Accuracy)',
              status: 'Active Live',
              lastRun: '15 mins ago'
            },
            {
              region: 'Global / International Remote',
              flag: '🌐',
              currency: 'USD',
              sources: ['LinkedIn Global Remote API', 'RemoteOK Developers', 'WeWorkRemotely Lead Feed'],
              autoApproveRule: 'Auto-Approved with $ USD indexation',
              dedupStatus: 'Enabled (99.4% Accuracy)',
              status: 'Active Live',
              lastRun: '45 mins ago'
            },
            {
              region: 'UAE & Saudi Arabia (Gulf Hub)',
              flag: '🇦🇪 🇸🇦',
              currency: 'AED / SAR',
              sources: ['GulfTalent Dubai & Riyadh', 'Bayt Tech Hub', 'Dubai Internet City Portal'],
              autoApproveRule: 'Tax-Free compensation tagged; Expat rules applied',
              dedupStatus: 'Enabled (97.9% Accuracy)',
              status: 'Active Live',
              lastRun: '2 hours ago'
            },
            {
              region: 'United States',
              flag: '🇺🇸',
              currency: 'USD',
              sources: ['Indeed US Technology', 'BuiltIn Silicon Valley / Austin Feed', 'Dice Tech Feed'],
              autoApproveRule: 'Hourly / Annual conversion with 401(k) extraction',
              dedupStatus: 'Enabled (99.1% Accuracy)',
              status: 'Active Live',
              lastRun: '3 hours ago'
            },
            {
              region: 'United Kingdom',
              flag: '🇬🇧',
              currency: 'GBP',
              sources: ['Jobserve UK Engineering', 'CWJobs London Tech', 'Totaljobs UK Remote'],
              autoApproveRule: 'Auto currency conversion to £ GBP bracket',
              dedupStatus: 'Enabled (98.2% Accuracy)',
              status: 'Active Live',
              lastRun: '4 hours ago'
            },
            {
              region: 'Europe & Canada',
              flag: '🇪🇺 🇨🇦',
              currency: 'EUR / CAD',
              sources: ['Relocate.me Tech Pipeline', 'Jobbank Canada Federal', 'Eurojobs Remote'],
              autoApproveRule: 'Visa Sponsorship tags & relocation package extractor',
              dedupStatus: 'Enabled (98.7% Accuracy)',
              status: 'Active Live',
              lastRun: '6 hours ago'
            }
          ].map((pipeline, idx) => (
            <div key={idx} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3.5 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <div className="flex items-center space-x-2">
                  <span className="text-xl">{pipeline.flag}</span>
                  <h4 className="text-sm font-black text-white">{pipeline.region}</h4>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {pipeline.status}
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] font-bold uppercase">Currency Normalization:</span>
                  <span className="text-white font-bold">{pipeline.currency}</span>
                </div>

                <div>
                  <span className="text-slate-400 block text-[10px] font-bold uppercase">Active Target Sources:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {pipeline.sources.map((s, i) => (
                      <span key={i} className="px-2 py-0.5 bg-slate-950 border border-slate-800 text-slate-300 rounded text-[10px]">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="text-slate-400 block text-[10px] font-bold uppercase">Auto-Approve / Review Rule:</span>
                  <p className="text-slate-300 text-[11px] mt-0.5">{pipeline.autoApproveRule}</p>
                </div>

                <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-800/80 text-slate-400">
                  <span>Deduplication: <strong className="text-slate-200">{pipeline.dedupStatus}</strong></span>
                  <span>Ran: <strong className="text-amber-400">{pipeline.lastRun}</strong></span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 4: SCRAPER INTELLIGENCE & TELEMETRY */}
      {/* ========================================================================= */}
      {subTab === 'telemetry' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
            <h4 className="text-sm font-black uppercase text-amber-300 flex items-center space-x-2 border-b border-slate-800 pb-2">
              <Activity className="w-4 h-4 text-amber-400" />
              <span>Ingestion Sector & Category Breakdown</span>
            </h4>
            <div className="space-y-3 text-xs">
              {[
                { name: 'Private Corporate IT & Software', pct: 45, count: '69 jobs', color: 'bg-indigo-500' },
                { name: 'Government Sector (FPSC / PPSC / BPS)', pct: 28, count: '43 jobs', color: 'bg-amber-500' },
                { name: 'International Remote & Overseas Relocation', pct: 18, count: '28 jobs', color: 'bg-purple-500' },
                { name: 'Newspaper Classified Image Clippings', pct: 9, count: '14 jobs', color: 'bg-teal-500' }
              ].map((item, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex justify-between font-bold">
                    <span className="text-slate-300">{item.name}</span>
                    <span className="text-white">{item.pct}% ({item.count})</span>
                  </div>
                  <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden">
                    <div className={`h-full ${item.color} rounded-full`} style={{ width: `${item.pct}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
            <h4 className="text-sm font-black uppercase text-emerald-300 flex items-center space-x-2 border-b border-slate-800 pb-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Deduplication & Quality Assurance Engine</span>
            </h4>
            <div className="space-y-3 text-xs text-slate-300">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="font-bold text-white">SHA-256 Title & Company Content Hashing</div>
                  <div className="text-[10px] text-slate-400">Prevents multiple redundant job postings across crawl cycles.</div>
                </div>
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold text-[10px]">Active</span>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="font-bold text-white">Salary Range Normalization & Currency Conversion</div>
                  <div className="text-[10px] text-slate-400">Standardizes monthly and annual brackets across USD, PKR, AED, SAR, GBP.</div>
                </div>
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold text-[10px]">Active</span>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="font-bold text-white">AI Gazette & BPS Scale Entity Extraction</div>
                  <div className="text-[10px] text-slate-400">Automatically parses BPS-17 to BPS-21 pay grades from govt notifications.</div>
                </div>
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold text-[10px]">Active</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* AUDIT DETAILS & SNAPSHOT MODAL */}
      {/* ========================================================================= */}
      {selectedAuditEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-7 max-w-3xl w-full shadow-2xl space-y-6 my-6 max-h-[92vh] flex flex-col">
            {/* MODAL HEADER */}
            <div className="flex items-start justify-between border-b border-slate-800 pb-4">
              <div className="space-y-1">
                <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    Audit ID: {selectedAuditEntry.id}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300">
                    Batch: {selectedAuditEntry.batchId}
                  </span>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                    selectedAuditEntry.status === 'Pending Review'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : selectedAuditEntry.status === 'Approved Live' || selectedAuditEntry.status === 'Auto-Approved'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  }`}>
                    {selectedAuditEntry.status}
                  </span>
                </div>

                <h3 className="text-lg sm:text-xl font-black text-white">
                  {selectedAuditEntry.jobTitle}
                </h3>
                <p className="text-xs text-slate-400">
                  <strong className="text-indigo-400">{selectedAuditEntry.company}</strong> • 📍 {selectedAuditEntry.city ? `${selectedAuditEntry.city}, ${selectedAuditEntry.region}` : selectedAuditEntry.region} • 💰 {selectedAuditEntry.salaryText}
                </p>
              </div>

              <button
                onClick={() => setSelectedAuditEntry(null)}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* MODAL BODY */}
            <div className="space-y-5 overflow-y-auto flex-1 pr-1 text-xs">
              {/* TIMELINE AUDIT TRAIL */}
              <div className="space-y-3 bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <h4 className="text-xs font-black uppercase text-amber-300 flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-amber-400" />
                  <span>Chronological Ingestion & Review History</span>
                </h4>

                <div className="relative pl-6 space-y-4 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
                  {selectedAuditEntry.reviewTimeline.map((item, idx) => (
                    <div key={item.id || idx} className="relative">
                      <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-amber-400 border-2 border-slate-950"></div>
                      <div className="space-y-0.5">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-white text-xs">{item.action}</span>
                          <span className="text-[10px] text-slate-500 font-mono">{item.timestamp}</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-900 text-indigo-300 font-bold">
                            {item.performedBy}
                          </span>
                        </div>
                        {item.notes && <p className="text-slate-400 text-[11px] leading-relaxed">{item.notes}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* RAW EXTRACTION DATA SNAPSHOT */}
              <div className="space-y-3 bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <h4 className="text-xs font-black uppercase text-indigo-300 flex items-center space-x-2">
                  <FileText className="w-4 h-4 text-indigo-400" />
                  <span>Raw Ingested Job Description & Specifications</span>
                </h4>

                <div className="space-y-3 text-slate-300">
                  <div className="p-3 bg-slate-900/70 rounded-xl border border-slate-800/80 leading-relaxed">
                    <span className="font-bold text-slate-400 text-[10px] uppercase block mb-1">Extracted Summary:</span>
                    <p>{selectedAuditEntry.snapshot.description}</p>
                  </div>

                  {selectedAuditEntry.snapshot.requirements && selectedAuditEntry.snapshot.requirements.length > 0 && (
                    <div className="p-3 bg-slate-900/70 rounded-xl border border-slate-800/80 space-y-1">
                      <span className="font-bold text-slate-400 text-[10px] uppercase block">Requirements:</span>
                      <ul className="list-disc pl-4 space-y-1 text-slate-300">
                        {selectedAuditEntry.snapshot.requirements.map((req, i) => (
                          <li key={i}>{req}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {selectedAuditEntry.snapshot.benefits && selectedAuditEntry.snapshot.benefits.length > 0 && (
                    <div className="p-3 bg-slate-900/70 rounded-xl border border-slate-800/80 space-y-1">
                      <span className="font-bold text-slate-400 text-[10px] uppercase block">Compensation & Perks:</span>
                      <ul className="list-disc pl-4 space-y-1 text-emerald-300">
                        {selectedAuditEntry.snapshot.benefits.map((ben, i) => (
                          <li key={i}>{ben}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              {/* NEWSPAPER CLIPPING IF AVAILABLE */}
              {selectedAuditEntry.clippingImageUrl && (
                <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
                  <span className="text-xs font-bold text-teal-300 uppercase block">Newspaper Classified Clipping Image:</span>
                  <img
                    src={selectedAuditEntry.clippingImageUrl}
                    alt="Newspaper Clipping"
                    className="rounded-xl border border-slate-800 max-h-64 object-cover w-full"
                  />
                </div>
              )}
            </div>

            {/* MODAL ACTIONS */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
              {selectedAuditEntry.sourceUrl ? (
                <a
                  href={selectedAuditEntry.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl flex items-center space-x-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Open Target Web Page</span>
                </a>
              ) : <div></div>}

              <div className="flex items-center space-x-2">
                {selectedAuditEntry.status === 'Pending Review' && (
                  <button
                    onClick={() => handleSingleApprove(selectedAuditEntry)}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-emerald-500/20 cursor-pointer flex items-center space-x-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Approve & Post to Live</span>
                  </button>
                )}

                {selectedAuditEntry.status === 'Pending Review' && (
                  <button
                    onClick={() => handleSingleReject(selectedAuditEntry)}
                    className="px-4 py-2 bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white font-bold text-xs rounded-xl border border-rose-500/30 cursor-pointer flex items-center space-x-1.5"
                  >
                    <X className="w-4 h-4" />
                    <span>Reject</span>
                  </button>
                )}

                <button
                  onClick={() => setSelectedAuditEntry(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
