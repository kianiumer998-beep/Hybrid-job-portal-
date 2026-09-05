import React, { useState, useMemo } from 'react';
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
  HelpCircle,
  Building2,
  MapPin,
  Flame,
  Layers,
  Briefcase
} from 'lucide-react';
import { Job, Region, ScrapedJobAuditEntry, ScraperBatchRun } from '../../types/job';
import { api } from '../../services/api';

export interface ScraperSourceItem {
  id: string;
  name: string;
  url: string;
  keywords: string;
  category: 'Private Corporate' | 'Government Sector' | 'Newspaper Classified' | 'International Remote';
  region: Region;
  depth: 'Light (10 Jobs)' | 'Standard (25 Jobs)' | 'Deep Crawl (50+ Jobs)';
  deduplication: boolean;
  interval: '15m' | '30m' | '1h' | '6h' | '24h' | '7d';
  autoApprove: boolean;
  status: 'Active Scheduled' | 'Paused';
  lastRun?: string;
  scrapedCount: number;
  successRate: number;
}

interface AutomatedScraperHubProps {
  scraperSources: ScraperSourceItem[];
  setScraperSources: React.Dispatch<React.SetStateAction<ScraperSourceItem[]>>;
  jobs: Job[];
  pendingJobs: Job[];
  onAddJob: (job: Job) => void;
  onBulkAddJobs?: (jobs: Job[]) => void;
  onApproveJob: (id: string) => void;
  onRejectJob: (id: string, reason?: string) => void;
  onOverrideDuplicatesToLive?: (jobsToOverride: Job[]) => void;
  scrapedAuditLogs: ScrapedJobAuditEntry[];
  setScrapedAuditLogs: React.Dispatch<React.SetStateAction<ScrapedJobAuditEntry[]>>;
  onOpenPdfParser?: (source?: any) => void;
}

export const AutomatedScraperHub: React.FC<AutomatedScraperHubProps> = ({
  scraperSources,
  setScraperSources,
  jobs,
  pendingJobs,
  onAddJob,
  onBulkAddJobs,
  onApproveJob,
  onRejectJob,
  onOverrideDuplicatesToLive,
  scrapedAuditLogs,
  setScrapedAuditLogs,
  onOpenPdfParser
}) => {
  // 1. Site Selection State (One-by-one, Select All, Category-wise)
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>(() =>
    scraperSources.map((s) => s.id)
  );

  // 2. Date & Time Filter Settings before Scraping
  const [dateFilterMode, setDateFilterMode] = useState<'all' | '24h' | '3d' | '7d' | 'custom'>('24h');
  const [customDateTime, setCustomDateTime] = useState<string>(() => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return yesterday.toISOString().slice(0, 16);
  });
  const [skipAlreadyScraped, setSkipAlreadyScraped] = useState<boolean>(true);

  // 3. Execution / Scraping Simulation State
  const [isScrapingActive, setIsScrapingActive] = useState<boolean>(false);
  const [scrapingProgress, setScrapingProgress] = useState<number>(0);
  const [currentScrapingSource, setCurrentScrapingSource] = useState<string>('');

  // 4. Session Tracking Counters
  const [sessionScrapedJobs, setSessionScrapedJobs] = useState<Job[]>([]);
  const [sessionApprovedCount, setSessionApprovedCount] = useState<number>(0);
  const [statusNotification, setStatusNotification] = useState<string | null>(null);

  // 5. Staged Scraped Jobs Selection & Inspection
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>([]);
  const [jobFilterMode, setJobFilterMode] = useState<'all' | 'unique' | 'duplicates'>('all');
  const [targetSearchQuery, setTargetSearchQuery] = useState('');
  const [targetCategoryFilter, setTargetCategoryFilter] = useState<string>('all');
  const [inspectingJob, setInspectingJob] = useState<Job | null>(null);

  // 6. Add New Portal Modal State
  const [isAddPortalOpen, setIsAddPortalOpen] = useState(false);
  const [newPortalName, setNewPortalName] = useState('');
  const [newPortalUrl, setNewPortalUrl] = useState('');
  const [newPortalKeywords, setNewPortalKeywords] = useState('');
  const [newPortalCategory, setNewPortalCategory] = useState<'Private Corporate' | 'Government Sector' | 'Newspaper Classified' | 'International Remote'>('Government Sector');
  const [newPortalRegion, setNewPortalRegion] = useState<Region>('Pakistan');
  const [newPortalAutoApprove, setNewPortalAutoApprove] = useState(false);

  // Duplicate Checker Logic
  const checkIsDuplicate = (candidate: Job): { isDuplicate: boolean; matchReason?: string; matchingJobId?: string } => {
    const allExisting = [...jobs, ...pendingJobs.filter(p => p.id !== candidate.id)];
    const cleanCandTitle = candidate.title.toLowerCase().trim();
    const cleanCandCompany = candidate.company.toLowerCase().trim();

    for (const ex of allExisting) {
      const cleanExTitle = ex.title.toLowerCase().trim();
      const cleanExCompany = ex.company.toLowerCase().trim();

      // Exact Match
      if (cleanCandTitle === cleanExTitle && cleanCandCompany === cleanExCompany) {
        return {
          isDuplicate: true,
          matchReason: `100% Identical Title & Employer: "${ex.title}" (${ex.company})`,
          matchingJobId: ex.id
        };
      }

      // High similarity
      if (cleanCandTitle.includes(cleanExTitle) || cleanExTitle.includes(cleanCandTitle)) {
        if (cleanCandCompany === cleanExCompany || candidate.city === ex.city) {
          return {
            isDuplicate: true,
            matchReason: `Similar Vacancy Found: "${ex.title}" in ${ex.city || 'Pakistan'}`,
            matchingJobId: ex.id
          };
        }
      }
    }
    return { isDuplicate: false };
  };

  // Combine session-scraped jobs with pending jobs that originated from scrapers
  const allScrapedList = useMemo(() => {
    const map = new Map<string, Job>();
    // First session scraped
    sessionScrapedJobs.forEach((j) => map.set(j.id, j));
    // Also pending scraper jobs
    pendingJobs.forEach((j) => {
      if (j.sourceUrl || j.scraperSourceId || j.scrapedSourceDomain || j.id.includes('scraped') || j.id.includes('sc-')) {
        if (!map.has(j.id)) map.set(j.id, j);
      }
    });
    return Array.from(map.values());
  }, [sessionScrapedJobs, pendingJobs]);

  // Filtered displayed jobs
  const displayedJobs = useMemo(() => {
    return allScrapedList.filter((j) => {
      const dup = checkIsDuplicate(j).isDuplicate;
      if (jobFilterMode === 'duplicates' && !dup) return false;
      if (jobFilterMode === 'unique' && dup) return false;
      return true;
    });
  }, [allScrapedList, jobFilterMode, jobs, pendingJobs]);

  const duplicatesInList = useMemo(() => {
    return allScrapedList.filter((j) => checkIsDuplicate(j).isDuplicate);
  }, [allScrapedList, jobs, pendingJobs]);

  const uniqueInList = useMemo(() => {
    return allScrapedList.filter((j) => !checkIsDuplicate(j).isDuplicate);
  }, [allScrapedList, jobs, pendingJobs]);

  // Site Selection Handlers
  const handleSelectAllSources = () => {
    if (selectedSourceIds.length === scraperSources.length) {
      setSelectedSourceIds([]);
    } else {
      setSelectedSourceIds(scraperSources.map((s) => s.id));
    }
  };

  const handleToggleSource = (id: string) => {
    setSelectedSourceIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const handleSelectByCategory = (category: string) => {
    const matchingIds = scraperSources.filter((s) => s.category === category).map((s) => s.id);
    const allAlreadySelected = matchingIds.every((id) => selectedSourceIds.includes(id));

    if (allAlreadySelected) {
      setSelectedSourceIds((prev) => prev.filter((id) => !matchingIds.includes(id)));
    } else {
      setSelectedSourceIds((prev) => Array.from(new Set([...prev, ...matchingIds])));
    }
  };

  // Run Scraper Engine on Selected Sites with Date/Time filter applied
  const handleRunSelectedScrapers = async (overrideSourceIds?: string[]) => {
    const targetIds = overrideSourceIds || selectedSourceIds;
    if (targetIds.length === 0) {
      alert('براہِ کرم پہلے کم از کم ایک سائٹ منتخب کریں۔ (Please select at least one portal)');
      return;
    }

    const selectedSources = scraperSources.filter((s) => targetIds.includes(s.id));
    if (selectedSources.length === 0) return;

    setIsScrapingActive(true);
    setScrapingProgress(15);
    setCurrentScrapingSource(selectedSources[0].name);

    // Calculate cutoff date string based on dateFilterMode
    let cutoffDescription = 'Any time';
    let sinceTimestamp: string | undefined = undefined;
    const mode: 'complete' | 'since_last' | 'custom_date' = 
      dateFilterMode === 'all' ? 'complete' :
      dateFilterMode === 'custom' ? 'custom_date' :
      'since_last';

    if (dateFilterMode === '24h') {
      cutoffDescription = 'Past 24 Hours (پچھلے 24 گھنٹے)';
      sinceTimestamp = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    } else if (dateFilterMode === '3d') {
      cutoffDescription = 'Past 3 Days (پچھلے 3 دن)';
      sinceTimestamp = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    } else if (dateFilterMode === '7d') {
      cutoffDescription = 'Past 7 Days (پچھلے ایک ہفتے کی)';
      sinceTimestamp = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    } else if (dateFilterMode === 'custom') {
      cutoffDescription = `After ${customDateTime}`;
      sinceTimestamp = new Date(customDateTime).toISOString();
    }

    setStatusNotification(`⏳ Querying ${selectedSources.length} selected portals via backend scraper (${cutoffDescription})...`);

    let currentIdx = 0;
    const progressTimer = setInterval(() => {
      setScrapingProgress((prev) => {
        if (prev >= 85) return 85;
        if (currentIdx < selectedSources.length) {
          setCurrentScrapingSource(selectedSources[currentIdx].name);
          currentIdx++;
        }
        return prev + 10;
      });
    }, 400);

    try {
      const response = await api.scraper.run({
        mode,
        sourceIds: targetIds,
        sinceTimestamp,
        autoPublishTrusted: false
      });

      clearInterval(progressTimer);
      setScrapingProgress(100);
      setIsScrapingActive(false);

      if (response && response.success) {
        const published = response.publishedJobs || [];
        const pending = response.pendingJobs || [];
        const duplicates = response.duplicateJobs || [];
        const allNewHarvested: Job[] = [...published, ...pending];

        // Notify parent state of newly published or pending jobs
        published.forEach((j: Job) => onAddJob({ ...j, status: 'Approved' }));
        pending.forEach((j: Job) => onAddJob({ ...j, status: 'Pending' }));

        setSessionScrapedJobs((prev) => [...allNewHarvested, ...prev]);
        setSessionApprovedCount((prev) => prev + published.length);
        setSelectedJobIds(allNewHarvested.map((j) => j.id));

        // Update scraper source stats from backend source statistics
        if (response.sourcesStats && Array.isArray(response.sourcesStats)) {
          setScraperSources((prev) =>
            prev.map((s) => {
              const stat = response.sourcesStats.find((st: any) => st.sourceId === s.id);
              if (stat) {
                return {
                  ...s,
                  lastRun: new Date().toISOString().substring(0, 16),
                  scrapedCount: s.scrapedCount + (stat.found || 0),
                  successRate: stat.failed ? Math.max(50, s.successRate - 10) : 100
                };
              }
              return s;
            })
          );
        }

        setStatusNotification(
          `✅ کامیابی! ${response.sourcesStats?.length || selectedSources.length} پورٹلز سے ${response.totalFound || 0} اسامیاں حاصل ہوئیں۔ (${published.length} لائیو، ${pending.length} جائزہ کے لیے تیار، ${duplicates.length} ڈپلیکیٹ)`
        );
      } else {
        setStatusNotification(`⚠️ اسکریپر نے ایرر واپس کیا: ${response?.message || 'نامعلوم غلطی'}`);
      }
    } catch (err: any) {
      clearInterval(progressTimer);
      setIsScrapingActive(false);
      setScrapingProgress(100);
      console.error('Backend scraper execution error:', err);
      setStatusNotification(`❌ اسکریپر کال ناکام رہی: ${err.message || 'کنکشن ایرر'}`);
    }
  };

  // Bulk Actions on Scraped Jobs
  const handleToggleSelectJob = (id: string) => {
    setSelectedJobIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSelectAllJobs = () => {
    if (selectedJobIds.length === displayedJobs.length) {
      setSelectedJobIds([]);
    } else {
      setSelectedJobIds(displayedJobs.map((j) => j.id));
    }
  };

  // 1. Bulk Approve to Live
  const handleBulkApproveToLive = () => {
    const toApprove = allScrapedList.filter((j) => selectedJobIds.includes(j.id));
    if (toApprove.length === 0) return;

    if (onBulkAddJobs) {
      const liveApproved = toApprove.map((j) => ({ ...j, status: 'Approved' as const }));
      onBulkAddJobs(liveApproved);
    } else {
      toApprove.forEach((j) => onApproveJob(j.id));
    }

    setSessionApprovedCount((prev) => prev + toApprove.length);
    setSelectedJobIds([]);
    setStatusNotification(`🚀 ${toApprove.length} جابز فوری طور پر لائیو پورٹل پر شائع کر دی گئیں!`);
  };

  // 2. Bulk Overwrite Duplicates (Re-announce as fresh ad)
  const handleBulkOverwriteDuplicates = () => {
    const dupJobs = allScrapedList.filter(
      (j) => selectedJobIds.includes(j.id) && checkIsDuplicate(j).isDuplicate
    );
    if (dupJobs.length === 0) {
      alert('براہِ کرم منتخب لسٹ میں ڈپلیکیٹ جابز چنیں۔ (Please select duplicate jobs to overwrite)');
      return;
    }

    const overridden = dupJobs.map((j) => ({
      ...j,
      status: 'Approved' as const,
      isDuplicateOverride: true,
      title: `${j.title} (Re-announced / توسیع شدہ)`,
      postedAt: 'Just now (Re-advertised)',
      description: `[RE-ANNOUNCED VACANCY] Previously advertised opportunity re-opened with updated closing date.\n\n${j.description || ''}`
    }));

    if (onOverrideDuplicatesToLive) {
      onOverrideDuplicatesToLive(overridden);
    } else if (onBulkAddJobs) {
      onBulkAddJobs(overridden);
    } else {
      overridden.forEach((j) => onAddJob(j));
    }

    setSessionApprovedCount((prev) => prev + overridden.length);
    setSelectedJobIds((prev) => prev.filter((id) => !dupJobs.map((d) => d.id).includes(id)));
    setStatusNotification(`🔄 ${overridden.length} ڈپلیکیٹ جابز کو اوور رائٹ کر کے نئی تاریخ کے ساتھ لائیو پوسٹ کر دیا گیا!`);
  };

  // 3. Skip / Purge Duplicates
  const handleBulkPurgeDuplicates = () => {
    const dups = duplicatesInList;
    if (dups.length === 0) return;

    const dupIds = dups.map((d) => d.id);
    dupIds.forEach((id) => onRejectJob(id, 'Purged duplicate from Scraper Hub'));
    setSessionScrapedJobs((prev) => prev.filter((j) => !dupIds.includes(j.id)));
    setSelectedJobIds((prev) => prev.filter((id) => !dupIds.includes(id)));
    setStatusNotification(`🗑️ ${dups.length} ڈپلیکیٹ جابز کو کامیابی سے حذف کر دیا گیا اور اصل جابز محفوظ رہیں۔`);
  };

  // 4. Move Selected to Pending for manual review
  const handleBulkMoveToPending = () => {
    const toPending = allScrapedList.filter((j) => selectedJobIds.includes(j.id));
    if (toPending.length === 0) return;

    // They are already in pending or session staging
    setSelectedJobIds([]);
    setStatusNotification(`⏳ ${toPending.length} جابز کو تفصیلی جائزے کے لیے پینڈنگ کیو میں رکھ دیا گیا ہے۔`);
  };

  // Add Portal Submission
  const handleAddNewPortal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPortalName.trim() || !newPortalUrl.trim()) return;

    let cleanUrl = newPortalUrl.trim();
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = 'https://' + cleanUrl;
    }

    const newSource: ScraperSourceItem = {
      id: `sc-${Date.now().toString(36)}`,
      name: newPortalName.trim(),
      url: cleanUrl,
      keywords: newPortalKeywords.trim() || 'Vacancies, Jobs, Careers',
      category: newPortalCategory,
      region: newPortalRegion,
      depth: 'Standard (25 Jobs)',
      deduplication: true,
      interval: '6h',
      autoApprove: newPortalAutoApprove,
      status: 'Active Scheduled',
      scrapedCount: 0,
      successRate: 100
    };

    setScraperSources((prev) => [newSource, ...prev]);
    setSelectedSourceIds((prev) => [...prev, newSource.id]);
    setIsAddPortalOpen(false);
    setNewPortalName('');
    setNewPortalUrl('');
    setNewPortalKeywords('');
    setStatusNotification(`🎉 نیا پورٹل "${newSource.name}" کامیابی سے شامل ہو گیا!`);
  };

  return (
    <div className="space-y-6 text-white max-w-7xl">
      {/* 1. TOP HEADER & SYSTEM OVERVIEW BANNER */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-start space-x-3.5">
            <div className="p-3 bg-gradient-to-tr from-indigo-500 to-emerald-500 text-slate-950 rounded-2xl shadow-lg shadow-indigo-500/20 shrink-0">
              <Bot className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center space-x-2 flex-wrap">
                <h3 className="text-xl font-black text-white">
                  Automated Scraper Controller & Source Hub
                </h3>
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase">
                  خودکار اسکریپر نظام
                </span>
                <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  All-in-One Controller
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 max-w-3xl leading-relaxed">
                تمام سرکاری، اخباری اور کارپوریٹ پورٹلز سے جابز ایک کلک میں حاصل کریں، ڈپلیکیٹ چیک کریں اور براہِ راست لائیو کریں۔ (Scrape, Deduplicate & Publish Live in 1 Click).
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {onOpenPdfParser && (
              <button
                type="button"
                onClick={() => onOpenPdfParser()}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-rose-300 border border-rose-500/30 font-bold text-xs flex items-center space-x-1.5 cursor-pointer transition-all active:scale-95"
              >
                <FileText className="w-4 h-4 text-rose-400" />
                <span>📄 PDF گزٹ پارسر (FPSC/WAPDA)</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsAddPortalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/30 font-bold text-xs flex items-center space-x-1.5 cursor-pointer transition-all active:scale-95"
            >
              <Plus className="w-4 h-4 text-emerald-400" />
              <span>نئی ویب سائٹ شامل کریں (+Add Site)</span>
            </button>
          </div>
        </div>

        {/* 2. REAL-TIME PLATFORM COUNTERS */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl space-y-1">
            <div className="text-[10px] font-bold uppercase text-slate-400 flex items-center justify-between">
              <span>کل لائیو جابز (Live)</span>
              <Briefcase className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-xl font-black text-emerald-400">{jobs.length}</div>
            <div className="text-[10px] text-slate-500">ویب سائٹ پر فعال</div>
          </div>

          <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl space-y-1">
            <div className="text-[10px] font-bold uppercase text-slate-400 flex items-center justify-between">
              <span>اس سیشن میں اسکریپ</span>
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            </div>
            <div className="text-xl font-black text-white">{sessionScrapedJobs.length}</div>
            <div className="text-[10px] text-slate-500">تازہ حاصل شدہ جابز</div>
          </div>

          <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl space-y-1">
            <div className="text-[10px] font-bold uppercase text-slate-400 flex items-center justify-between">
              <span>فوری لائیو کی گئیں</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-xl font-black text-emerald-300">{sessionApprovedCount}</div>
            <div className="text-[10px] text-slate-500">Approved to Live</div>
          </div>

          <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl space-y-1">
            <div className="text-[10px] font-bold uppercase text-slate-400 flex items-center justify-between">
              <span>منظوری کی منتظر (Review)</span>
              <Clock className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-xl font-black text-amber-400">
              {pendingJobs.filter(j => j.sourceUrl || j.scraperSourceId || j.scrapedSourceDomain || j.id.includes('scraped')).length}
            </div>
            <div className="text-[10px] text-slate-500">زیرِ التواء جائزہ</div>
          </div>

          <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl space-y-1">
            <div className="text-[10px] font-bold uppercase text-slate-400 flex items-center justify-between">
              <span>ڈپلیکیٹس (Duplicates)</span>
              <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
            </div>
            <div className="text-xl font-black text-rose-400">{duplicatesInList.length}</div>
            <div className="text-[10px] text-slate-500">پہلے سے موجود اشتہارات</div>
          </div>
        </div>

        {/* NOTIFICATION MESSAGE */}
        {statusNotification && (
          <div className="p-3 bg-emerald-500/15 border border-emerald-500/40 rounded-xl text-emerald-200 text-xs font-bold flex items-center justify-between animate-in fade-in">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{statusNotification}</span>
            </div>
            <button
              onClick={() => setStatusNotification(null)}
              className="text-slate-400 hover:text-white text-xs cursor-pointer ml-3"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* EASY TO USE 3-STEP EXPLANATION BANNER FOR ADMIN (آسان 3 مرحلہ گائیڈ) */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/30 to-slate-900 border border-indigo-500/30 rounded-2xl p-5 shadow-xl">
        <div className="flex items-center space-x-2.5 text-indigo-400 font-black text-sm mb-3">
          <HelpCircle className="w-5 h-5 text-indigo-400" />
          <span>ایڈمن کے لیے آسان رہنما گائیڈ — 3 مراحل میں جابز لائیو کریں (Easy 3-Step Guide)</span>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 text-xs">
          <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl space-y-1.5">
            <div className="flex items-center space-x-2 text-amber-400 font-bold">
              <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-[10px] font-black">1</span>
              <span>ویب سائٹس منتخب کریں (Select Sites)</span>
            </div>
            <p className="text-slate-300 leading-relaxed">
              نیچے دی گئی لسٹ میں سے جن پورٹلز سے نوکریاں لینی ہیں ان پر نشان لگائیں (یا اوپر <strong>تمام سائٹس</strong> کا بٹن دبائیں)۔
            </p>
          </div>

          <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl space-y-1.5">
            <div className="flex items-center space-x-2 text-indigo-400 font-bold">
              <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-[10px] font-black">2</span>
              <span>اسکریپنگ شروع کریں (Start Scraping)</span>
            </div>
            <p className="text-slate-300 leading-relaxed">
              سبز رنگ کا <strong>"منتخب سائٹس سے جابز اسکریپ کریں"</strong> بٹن دبائیں۔ خودکار نظام انٹرنیٹ سے تازہ اشتہارات اکٹھے کر لے گا۔
            </p>
          </div>

          <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl space-y-1.5">
            <div className="flex items-center space-x-2 text-emerald-400 font-bold">
              <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[10px] font-black">3</span>
              <span>ایک کلک میں لائیو کریں (Publish Live)</span>
            </div>
            <p className="text-slate-300 leading-relaxed">
              حاصل شدہ جابز کا جائزہ لیں اور <strong>"ایک کلک میں لائیو شائع کریں"</strong> دبائیں تاکہ وہ فوری طور پر پورٹل پر نظر آئیں۔
            </p>
          </div>
        </div>
      </div>

      {/* 3. STEP 1 & 2: SITE SELECTION & DATE-TIME FILTER CARD */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-5">
        <div className="border-b border-slate-800 pb-3 flex flex-col md:flex-row md:items-center justify-between gap-2">
          <div>
            <h4 className="text-sm font-black uppercase text-white flex items-center space-x-2">
              <Globe className="w-4 h-4 text-indigo-400" />
              <span>مرحلہ 1: ویب سائٹس اور تاریخ کا انتخاب (Step 1: Select Sites & Date Filter)</span>
            </h4>
            <p className="text-xs text-slate-400">
              وہ پورٹلز چنیں جن سے آپ نئی جابز نکالنا چاہتے ہیں، اور بتائیں کہ کس وقت کے بعد کی جابز حاصل کرنی ہیں۔
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-xs text-slate-300 font-bold">
              {selectedSourceIds.length} of {scraperSources.length} سائٹس منتخب ہیں
            </span>
          </div>
        </div>

        {/* QUICK CATEGORY SELECTION BUTTONS */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-400 font-bold shrink-0">فوری سلیکشن:</span>
          
          <button
            type="button"
            onClick={handleSelectAllSources}
            className={`px-3 py-1.5 rounded-lg font-bold flex items-center space-x-1.5 transition-all cursor-pointer ${
              selectedSourceIds.length === scraperSources.length
                ? 'bg-indigo-500 text-white shadow-md'
                : 'bg-slate-800 text-slate-300 hover:text-white border border-slate-700'
            }`}
          >
            {selectedSourceIds.length === scraperSources.length ? (
              <CheckSquare className="w-3.5 h-3.5" />
            ) : (
              <Square className="w-3.5 h-3.5" />
            )}
            <span>تمام سائٹس ({scraperSources.length})</span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectByCategory('Government Sector')}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 font-bold cursor-pointer transition-all"
          >
            🏛️ تمام سرکاری پورٹلز (Govt)
          </button>

          <button
            type="button"
            onClick={() => handleSelectByCategory('Newspaper Classified')}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-teal-300 border border-teal-500/30 font-bold cursor-pointer transition-all"
          >
            📰 تمام اخباری اشتہارات (Newspapers)
          </button>

          <button
            type="button"
            onClick={() => handleSelectByCategory('Private Corporate')}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-indigo-500/30 font-bold cursor-pointer transition-all"
          >
            🏢 پرائیویٹ و کارپوریٹ (Corporate)
          </button>

          <button
            type="button"
            onClick={() => handleSelectByCategory('International Remote')}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/30 font-bold cursor-pointer transition-all"
          >
            🌐 بین الاقوامی و ریموٹ (Remote)
          </button>
        </div>

        {/* DATE & TIME FILTER CONTROL BAR */}
        <div className="p-4 bg-slate-950 border border-indigo-500/30 rounded-xl space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
            <div className="flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-indigo-400" />
              <span className="text-xs font-black text-white">
                تاریخ اور وقت کی حد کا فلٹر (Date & Time Cutoff for Scraping)
              </span>
            </div>
            <span className="text-[11px] text-slate-400">
              صرف منتخب تاریخ کے بعد شائع ہونے والی نئی جابز حاصل ہوں گی۔
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            {[
              { id: '24h', label: '⏱️ پچھلے 24 گھنٹے (Past 24 Hours)', sub: 'تازہ ترین' },
              { id: '3d', label: '📅 پچھلے 3 دن (Past 3 Days)', sub: 'آخری 72 گھنٹے' },
              { id: '7d', label: '🗓️ پچھلے 7 دن (Past 7 Days)', sub: 'ایک ہفتہ' },
              { id: 'all', label: '⚡ تمام دستیاب جابز (All Available)', sub: 'بغیر تاریخ' },
              { id: 'custom', label: '🕒 مخصوص تاریخ و وقت (Custom Date & Time)', sub: 'اپنی مرضی' }
            ].map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setDateFilterMode(option.id as any)}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                  dateFilterMode === option.id
                    ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md'
                    : 'bg-slate-900 text-slate-300 hover:text-white border border-slate-800'
                }`}
              >
                <span>{option.label}</span>
              </button>
            ))}

            {dateFilterMode === 'custom' && (
              <div className="flex items-center space-x-2 mt-1 sm:mt-0">
                <input
                  type="datetime-local"
                  value={customDateTime}
                  onChange={(e) => setCustomDateTime(e.target.value)}
                  className="px-3 py-1 bg-slate-900 border border-indigo-500/50 rounded-lg text-xs text-white font-mono outline-none"
                />
              </div>
            )}
          </div>

          <div className="flex items-center space-x-2 pt-1 text-xs text-slate-300">
            <input
              type="checkbox"
              id="skipDuplicatesCheck"
              checked={skipAlreadyScraped}
              onChange={(e) => setSkipAlreadyScraped(e.target.checked)}
              className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-indigo-500 focus:ring-indigo-500 cursor-pointer"
            />
            <label htmlFor="skipDuplicatesCheck" className="cursor-pointer select-none">
              جو جابز پہلے سے ڈیٹا بیس میں موجود ہیں ان کی شناخت کر کے ڈپلیکیٹ ٹیگ لگائیں (Auto-Detect Duplicate Vacancies)
            </label>
          </div>
        </div>

        {/* 1-CLICK SCRAPE ACTION BAR */}
        <div className="p-4 bg-gradient-to-r from-slate-950 via-indigo-950/40 to-slate-950 border-2 border-indigo-500/50 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
          <div className="space-y-0.5 text-center sm:text-left">
            <h5 className="text-sm font-black text-white flex items-center justify-center sm:justify-start space-x-2">
              <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
              <span>ایک کلک میں اسکریپ شروع کریں (Execute 1-Click Multi-Site Scraping)</span>
            </h5>
            <p className="text-xs text-slate-300">
              آپ کی منتخب کردہ <span className="text-amber-300 font-bold">{selectedSourceIds.length} سائٹس</span> سے تمام نئی جابز بیک وقت حاصل کی جائیں گی۔
            </p>
          </div>

          <button
            type="button"
            onClick={() => handleRunSelectedScrapers()}
            disabled={isScrapingActive || selectedSourceIds.length === 0}
            className={`w-full sm:w-auto px-6 py-3 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center space-x-2 shadow-xl transition-all cursor-pointer ${
              isScrapingActive || selectedSourceIds.length === 0
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-emerald-400 via-teal-400 to-indigo-500 text-slate-950 hover:scale-[1.02] active:scale-95 shadow-emerald-500/20'
            }`}
          >
            <Sparkles className={`w-4 h-4 text-slate-950 ${isScrapingActive ? 'animate-spin' : ''}`} />
            <span>
              {isScrapingActive
                ? `Scraping Active (${scrapingProgress}%)...`
                : `⚡ منتخب ${selectedSourceIds.length} سائٹس سے جابز اسکریپ کریں (Scrape Now)`}
            </span>
          </button>
        </div>

        {/* LIVE SCRAPING PROGRESS BAR */}
        {isScrapingActive && (
          <div className="p-4 bg-indigo-950/60 border border-indigo-500/50 rounded-xl space-y-2 animate-pulse">
            <div className="flex justify-between text-xs font-bold text-indigo-200">
              <span className="flex items-center space-x-2">
                <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
                <span>پورٹل پر کارروائی جاری ہے: {currentScrapingSource}...</span>
              </span>
              <span>{scrapingProgress}%</span>
            </div>
            <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-400 h-full transition-all duration-300"
                style={{ width: `${scrapingProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* CONFIGURED TARGET SOURCES LIST (Collapsible / Checkable Cards) */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-bold uppercase tracking-wider">
              دستیاب اسکریپر پورٹلز ({scraperSources.length} Portals Available)
            </span>
            <span>ہر سائٹ کو انفرادی طور پر منتخب یا ڈی سلیکٹ کریں</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {scraperSources.map((source) => {
              const isSelected = selectedSourceIds.includes(source.id);
              const isGovt = source.category === 'Government Sector';
              const isNews = source.category === 'Newspaper Classified';
              const isRemote = source.category === 'International Remote';

              return (
                <div
                  key={source.id}
                  onClick={() => handleToggleSource(source.id)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start justify-between gap-3 ${
                    isSelected
                      ? 'bg-slate-950 border-indigo-500 shadow-md shadow-indigo-500/10'
                      : 'bg-slate-950/50 border-slate-800 hover:border-slate-700 opacity-70'
                  }`}
                >
                  <div className="flex items-start space-x-3 min-w-0">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}} // handled by parent onClick
                      className="w-4 h-4 mt-1 rounded bg-slate-900 border-slate-700 text-indigo-500 focus:ring-indigo-500 cursor-pointer shrink-0"
                    />
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center space-x-1.5 flex-wrap">
                        <h6 className="font-black text-white text-xs truncate max-w-[220px]">
                          {source.name}
                        </h6>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                            isGovt
                              ? 'bg-amber-500/20 text-amber-300'
                              : isNews
                              ? 'bg-teal-500/20 text-teal-300'
                              : isRemote
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-indigo-500/20 text-indigo-300'
                          }`}
                        >
                          {source.category}
                        </span>
                      </div>

                      <div className="text-[10px] text-slate-400 font-mono truncate flex items-center space-x-1">
                        <ExternalLink className="w-2.5 h-2.5 text-slate-500 shrink-0" />
                        <span className="truncate">{source.url}</span>
                      </div>

                      <div className="flex items-center space-x-2 text-[10px] text-slate-400 pt-0.5">
                        <span>کل جابز: <b className="text-amber-300">{source.scrapedCount}</b></span>
                        <span>•</span>
                        <span>شیڈول: <b className="text-slate-300">{source.interval}</b></span>
                        <span>•</span>
                        <span className={source.autoApprove ? 'text-emerald-400' : 'text-slate-400'}>
                          {source.autoApprove ? '⚡ خودکار لائیو' : '🛡️ ریویو ضروری'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRunSelectedScrapers([source.id]);
                    }}
                    disabled={isScrapingActive}
                    className="px-2.5 py-1 bg-indigo-500/20 hover:bg-indigo-500/40 text-indigo-300 border border-indigo-500/30 rounded-lg text-[10px] font-bold shrink-0 cursor-pointer transition-all active:scale-95"
                    title="Run only this portal right now"
                  >
                    صرف یہ چلائیں
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 4. STEP 3: SCRAPED JOBS AUDIT, DEDUPLICATION & 1-CLICK PUBLISH */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2 py-0.5 rounded bg-emerald-500 text-slate-950 font-black text-[10px] uppercase">
                مرحلہ 2 (Step 2)
              </span>
              <h4 className="text-sm font-black text-white">
                حاصل شدہ جابز کا آڈٹ اور لائیو کرنے کا پینل (Scraped Jobs Audit & Live Publishing)
              </h4>
              <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[10px] font-bold">
                {displayedJobs.length} جابز موجود ہیں
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              ہر جاب کے سامنے اس کی سائٹ کی پوری تفصیل موجود ہے۔ ڈپلیکیٹس کو اوور رائٹ کریں، چھوڑ دیں یا تمام یونیک جابز فوری لائیو کریں۔
            </p>
          </div>

          {/* VIEW FILTER TABS */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => setJobFilterMode('all')}
              className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                jobFilterMode === 'all'
                  ? 'bg-indigo-500 text-white shadow-md'
                  : 'bg-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              تمام ({allScrapedList.length})
            </button>

            <button
              type="button"
              onClick={() => setJobFilterMode('unique')}
              className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                jobFilterMode === 'unique'
                  ? 'bg-emerald-500 text-slate-950 font-black shadow-md'
                  : 'bg-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              یونیک ({uniqueInList.length})
            </button>

            <button
              type="button"
              onClick={() => setJobFilterMode('duplicates')}
              className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                jobFilterMode === 'duplicates'
                  ? 'bg-rose-500 text-white font-black shadow-md'
                  : 'bg-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              ڈپلیکیٹس ({duplicatesInList.length})
            </button>
          </div>
        </div>

        {/* BULK ACTION CONTROLS FOR SCRAPED JOBS */}
        <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <label className="flex items-center space-x-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={selectedJobIds.length > 0 && selectedJobIds.length === displayedJobs.length}
                onChange={handleSelectAllJobs}
                className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-indigo-500 focus:ring-indigo-500 cursor-pointer"
              />
              <span className="text-xs font-bold text-slate-200">
                {selectedJobIds.length === displayedJobs.length ? 'سب غیر منتخب کریں' : 'تمام منتخب کریں (Select All)'}
              </span>
            </label>

            {selectedJobIds.length > 0 && (
              <span className="px-2.5 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 rounded-full text-[11px] font-black">
                {selectedJobIds.length} منتخب ہیں
              </span>
            )}
          </div>

          {/* DEDUPLICATION & APPROVAL BUTTONS */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* 1. Bulk Approve to Live */}
            <button
              type="button"
              onClick={handleBulkApproveToLive}
              disabled={selectedJobIds.length === 0}
              className={`px-3.5 py-2 rounded-xl font-black flex items-center space-x-1.5 transition-all ${
                selectedJobIds.length > 0
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-lg shadow-emerald-500/20 cursor-pointer active:scale-95'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              <CheckCircle2 className="w-4 h-4 text-slate-950" />
              <span>🚀 منتخب جابز فوری لائیو کریں ({selectedJobIds.length})</span>
            </button>

            {/* 2. Overwrite Duplicates (Re-announce) */}
            <button
              type="button"
              onClick={handleBulkOverwriteDuplicates}
              disabled={selectedJobIds.length === 0 || duplicatesInList.length === 0}
              className={`px-3.5 py-2 rounded-xl font-bold flex items-center space-x-1.5 transition-all ${
                selectedJobIds.length > 0 && duplicatesInList.length > 0
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20 cursor-pointer active:scale-95'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
              title="ڈپلیکیٹ کو نئی تاریخ دے کر تازہ اشتہار کے طور پر پوسٹ کریں"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>🔄 ڈپلیکیٹ اوور رائٹ کریں (نئی جاب بنائیں)</span>
            </button>

            {/* 3. Delete / Purge Duplicates */}
            <button
              type="button"
              onClick={handleBulkPurgeDuplicates}
              disabled={duplicatesInList.length === 0}
              className={`px-3 py-2 rounded-xl font-bold flex items-center space-x-1.5 transition-all ${
                duplicatesInList.length > 0
                  ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-600/20 cursor-pointer active:scale-95'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>🗑️ تمام ڈپلیکیٹ حذف کریں ({duplicatesInList.length})</span>
            </button>

            {/* 4. Move to Pending */}
            <button
              type="button"
              onClick={handleBulkMoveToPending}
              disabled={selectedJobIds.length === 0}
              className={`px-3 py-2 rounded-xl font-bold flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all ${
                selectedJobIds.length > 0 ? 'cursor-pointer active:scale-95' : 'opacity-60 cursor-not-allowed'
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>پینڈنگ میں ڈالیں (Keep in Pending)</span>
            </button>
          </div>
        </div>

        {/* SCRAPED JOBS LISTING WITH FULL AUDIT & SOURCE DETAILS */}
        {displayedJobs.length === 0 ? (
          <div className="p-8 text-center bg-slate-950 rounded-2xl border border-slate-800 text-slate-400 space-y-2">
            <Bot className="w-8 h-8 text-indigo-400 mx-auto animate-pulse" />
            <p className="text-sm font-bold text-slate-200">
              فی الحال اس فلٹر میں کوئی جاب موجود نہیں ہے۔
            </p>
            <p className="text-xs text-slate-500">
              اوپر دیے گئے بٹن "⚡ منتخب سائٹس سے جابز اسکریپ کریں" پر کلک کر کے تازہ جابز حاصل کریں۔
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {displayedJobs.map((job) => {
              const isSelected = selectedJobIds.includes(job.id);
              const dupInfo = checkIsDuplicate(job);
              const isDup = dupInfo.isDuplicate;
              const sourceDomain = job.scrapedSourceDomain || (job.sourceUrl ? new URL(job.sourceUrl.startsWith('http') ? job.sourceUrl : 'https://' + job.sourceUrl).hostname : 'Official Portal');

              return (
                <div
                  key={job.id}
                  className={`p-4 rounded-xl border transition-all ${
                    isDup
                      ? 'bg-slate-950/90 border-rose-500/40 hover:border-rose-500/60'
                      : 'bg-slate-950/90 border-slate-800 hover:border-indigo-500/50'
                  } ${isSelected ? 'ring-2 ring-indigo-500' : ''}`}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
                    <div className="flex items-start space-x-3 min-w-0">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelectJob(job.id)}
                        className="w-4 h-4 mt-1 rounded bg-slate-900 border-slate-700 text-indigo-500 focus:ring-indigo-500 cursor-pointer shrink-0"
                      />

                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                          {/* UNICITY STATUS BADGE */}
                          {isDup ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center space-x-1">
                              <AlertCircle className="w-3 h-3 text-rose-400" />
                              <span>⚠️ ڈپلیکیٹ (Duplicate)</span>
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center space-x-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              <span>✨ تازہ یونیک (Unique)</span>
                            </span>
                          )}

                          {/* EXACT SOURCE PORTAL BADGE */}
                          <div className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center space-x-1 truncate max-w-xs">
                            <Globe className="w-3 h-3 text-indigo-400 shrink-0" />
                            <span className="truncate">سائٹ: {job.scraperSourceName || sourceDomain}</span>
                          </div>

                          {job.isGovtJob && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              🏛️ Govt {job.govtScale || 'Sector'}
                            </span>
                          )}

                          {job.isNewspaperAd && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30">
                              📰 {job.newspaperName || 'Newspaper'}
                            </span>
                          )}

                          <span className="text-[10px] text-slate-500">
                            حاصل وقت: {job.scrapedTime || job.postedAt || 'Just now'}
                          </span>
                        </div>

                        <h5 className="font-black text-white text-sm hover:text-indigo-400 transition-colors cursor-pointer" onClick={() => setInspectingJob(job)}>
                          {job.title}
                        </h5>

                        <div className="text-xs text-slate-400 flex items-center space-x-2 flex-wrap">
                          <span className="text-slate-200 font-semibold">{job.company}</span>
                          <span>•</span>
                          <span>📍 {job.city ? `${job.city}, ${job.province || job.region}` : job.region}</span>
                          <span>•</span>
                          <span className="text-emerald-400 font-bold">{job.salary}</span>
                        </div>
                      </div>
                    </div>

                    {/* ACTIONS FOR THIS INDIVIDUAL JOB */}
                    <div className="flex flex-wrap items-center gap-1.5 self-end md:self-center shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          onApproveJob(job.id);
                          setSessionApprovedCount((prev) => prev + 1);
                          setStatusNotification(`✅ جاب "${job.title}" کامیابی سے لائیو ہو گئی!`);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-md shadow-emerald-500/20 cursor-pointer flex items-center space-x-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>لائیو کریں (Approve)</span>
                      </button>

                      {isDup && (
                        <button
                          type="button"
                          onClick={() => {
                            const overridden = {
                              ...job,
                              status: 'Approved' as const,
                              isDuplicateOverride: true,
                              title: `${job.title} (Re-announced / توسیع شدہ)`,
                              postedAt: 'Just now (Re-advertised)'
                            };
                            if (onOverrideDuplicatesToLive) {
                              onOverrideDuplicatesToLive([overridden]);
                            } else {
                              onAddJob(overridden);
                            }
                            setStatusNotification(`🔄 جاب اوور رائٹ کر کے نئی جاب کی صورت میں لائیو ہو گئی!`);
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer flex items-center space-x-1"
                          title="اس ڈپلیکیٹ کو تازہ جاب بنا کر شائع کریں"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>اوور رائٹ (Overwrite)</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setInspectingJob(job)}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 cursor-pointer flex items-center space-x-1"
                      >
                        <Eye className="w-3.5 h-3.5 text-indigo-400" />
                        <span>تفصیل (Details)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          onRejectJob(job.id, 'Dropped by Admin from Scraper Controller');
                          setSessionScrapedJobs((prev) => prev.filter((j) => j.id !== job.id));
                        }}
                        className="p-1.5 text-rose-400 hover:text-white hover:bg-rose-500/20 rounded-lg cursor-pointer"
                        title="حذف کریں (Delete)"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* SOURCE AUDIT FOOTER */}
                  <div className="mt-2.5 pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] text-slate-400">
                    <div className="flex items-center space-x-1.5 truncate">
                      <span className="font-bold text-slate-500">اصل لنک (Source URL):</span>
                      <a
                        href={job.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-indigo-400 hover:underline font-mono truncate max-w-md flex items-center space-x-1"
                      >
                        <span>{job.sourceUrl}</span>
                        <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                      </a>
                    </div>

                    {isDup && dupInfo.matchReason && (
                      <div className="text-rose-400 font-medium">
                        {dupInfo.matchReason}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL: ADD NEW TARGET PORTAL */}
      {isAddPortalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h4 className="text-base font-black text-white flex items-center space-x-2">
                <Globe className="w-5 h-5 text-emerald-400" />
                <span>نیا اسکریپر پورٹل شامل کریں (Add New Target Portal)</span>
              </h4>
              <button
                type="button"
                onClick={() => setIsAddPortalOpen(false)}
                className="text-slate-400 hover:text-white text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddNewPortal} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1">
                  پورٹل کا نام (Portal Name) *
                </label>
                <input
                  type="text"
                  value={newPortalName}
                  onChange={(e) => setNewPortalName(e.target.value)}
                  placeholder="مثلاً: PPSC Punjab Govt Jobs یا Daily Express"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">
                  ویب سائٹ کا مکمل لنک (Website URL) *
                </label>
                <input
                  type="text"
                  value={newPortalUrl}
                  onChange={(e) => setNewPortalUrl(e.target.value)}
                  placeholder="https://ppsc.gop.pk یا https://e.express.com.pk"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">شعبہ (Category)</label>
                  <select
                    value={newPortalCategory}
                    onChange={(e) => setNewPortalCategory(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-emerald-500"
                  >
                    <option value="Government Sector">Government Sector (سرکاری)</option>
                    <option value="Newspaper Classified">Newspaper Classified (اخباری)</option>
                    <option value="Private Corporate">Private Corporate (کارپوریٹ)</option>
                    <option value="International Remote">International Remote (ریموٹ)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">ملک / علاقہ (Region)</label>
                  <select
                    value={newPortalRegion}
                    onChange={(e) => setNewPortalRegion(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-emerald-500"
                  >
                    <option value="Pakistan">Pakistan</option>
                    <option value="UAE">UAE</option>
                    <option value="Saudi Arabia">Saudi Arabia</option>
                    <option value="Global">Global Remote</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">
                  مخصوص الفاظ / فلٹر (Keywords / Filter)
                </label>
                <input
                  type="text"
                  value={newPortalKeywords}
                  onChange={(e) => setNewPortalKeywords(e.target.value)}
                  placeholder="BPS-17, Engineer, Manager, Clerk..."
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="portalAutoApproveCheck"
                  checked={newPortalAutoApprove}
                  onChange={(e) => setNewPortalAutoApprove(e.target.checked)}
                  className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                />
                <label htmlFor="portalAutoApproveCheck" className="text-slate-300 cursor-pointer select-none">
                  اس سائٹ کی جابز بغیر تصدیق کے فوری لائیو کریں (Auto-Approve to Live)
                </label>
              </div>

              <div className="flex justify-end space-x-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddPortalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold cursor-pointer"
                >
                  منسوخ کریں (Cancel)
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black cursor-pointer shadow-lg shadow-emerald-500/20"
                >
                  پورٹل محفوظ کریں (Save Portal)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: VIEW DETAILED JOB AUDIT */}
      {inspectingJob && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-200 text-xs">
            <div className="flex justify-between items-start border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] uppercase font-bold text-indigo-400">Scraped Vacancy Audit</span>
                <h4 className="text-base font-black text-white">{inspectingJob.title}</h4>
                <div className="text-slate-400">{inspectingJob.company} • {inspectingJob.city || inspectingJob.region}</div>
              </div>
              <button
                type="button"
                onClick={() => setInspectingJob(null)}
                className="text-slate-400 hover:text-white text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800">
                <div><span className="text-slate-500">سورس پورٹل:</span> <b className="text-indigo-300">{inspectingJob.scraperSourceName || inspectingJob.scrapedSourceDomain}</b></div>
                <div><span className="text-slate-500">تنخواہ / اسکیل:</span> <b className="text-emerald-400">{inspectingJob.salary}</b></div>
                <div><span className="text-slate-500">حاصل کرنے کا وقت:</span> <b className="text-slate-200">{inspectingJob.scrapedTime || inspectingJob.postedAt}</b></div>
                <div><span className="text-slate-500">شعبہ:</span> <b className="text-slate-200">{inspectingJob.jobCategory}</b></div>
              </div>

              <div>
                <span className="text-slate-400 font-bold block mb-1">جاب کی تفصیل (Description):</span>
                <p className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-slate-300 leading-relaxed whitespace-pre-line">
                  {inspectingJob.description}
                </p>
              </div>

              {inspectingJob.requirements && inspectingJob.requirements.length > 0 && (
                <div>
                  <span className="text-slate-400 font-bold block mb-1">ضروری شرائط (Requirements):</span>
                  <ul className="list-disc pl-5 space-y-1 text-slate-300">
                    {inspectingJob.requirements.map((req, i) => (
                      <li key={i}>{req}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <span className="text-slate-400 font-bold block mb-1">اصل سورس لنک (Original Link):</span>
                <a
                  href={inspectingJob.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-indigo-400 hover:underline flex items-center space-x-1 break-all"
                >
                  <span>{inspectingJob.sourceUrl}</span>
                  <ExternalLink className="w-3 h-3 shrink-0" />
                </a>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setInspectingJob(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold cursor-pointer"
              >
                بند کریں (Close)
              </button>
              <button
                type="button"
                onClick={() => {
                  onApproveJob(inspectingJob.id);
                  setInspectingJob(null);
                  setSessionApprovedCount((prev) => prev + 1);
                  setStatusNotification(`✅ جاب "${inspectingJob.title}" کو لائیو کر دیا گیا!`);
                }}
                className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black cursor-pointer shadow-lg shadow-emerald-500/20"
              >
                لائیو شائع کریں (Approve to Live)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
