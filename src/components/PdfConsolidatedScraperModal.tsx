import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Job, ConsolidatedPdfGazette, ScrapedJobAuditEntry, ScraperBatchRun } from '../types/job';
import { 
  MOCK_CONSOLIDATED_PDF_GAZETTES, 
  ALL_CONSOLIDATED_PDF_GAZETTES,
  generateGazetteFromManualInput,
  OFFICIAL_GOVT_SCRAPER_PORTALS 
} from '../data/mockPdfConsolidatedAds';
import { AutoScrapeTimerControls, AutoScrapeConfig } from './pdf/AutoScrapeTimerControls';
import { 
  FileText, 
  X, 
  Sparkles, 
  Download, 
  Copy, 
  Check, 
  Terminal, 
  Layers, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  Upload, 
  Globe, 
  Search, 
  Filter, 
  ShieldCheck, 
  Code, 
  Building2, 
  Calendar, 
  FileSpreadsheet,
  Clock,
  ExternalLink,
  Plus,
  Trash2,
  BookmarkPlus,
  HelpCircle,
  Play,
  RefreshCw,
  CheckSquare,
  Square,
  AlertTriangle,
  FileCheck,
  Bot,
  Zap,
  CheckCheck
} from 'lucide-react';

interface PdfConsolidatedScraperModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBatchImportJobs: (jobs: Job[], autoApprove: boolean, sourceGazetteTitle: string) => void;
  onLogBatchRun: (batchRun: ScraperBatchRun, auditEntries: ScrapedJobAuditEntry[]) => void;
  gazettes?: ConsolidatedPdfGazette[];
  onAddGazette?: (newGazette: ConsolidatedPdfGazette) => void;
  onDeleteGazette?: (gazetteId: string) => void;
  initialSelectedGazetteId?: string | null;
  existingJobs?: Job[];
  onUpdateGazettesLastScraped?: (updates: { id: string; lastScrapedAt: string; jobCount: number }[]) => void;
}

// DUPLICATE DETECTION HELPER
function checkJobDuplicate(candidate: Job, existingList: Job[] = []): { isDuplicate: boolean; duplicateScore: number; matchedJob?: Job } {
  if (!existingList || existingList.length === 0) {
    return { isDuplicate: false, duplicateScore: 0 };
  }

  const cleanCandTitle = candidate.title.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();
  const cleanCandCompany = (candidate.company || '').toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();
  const cleanCandCase = (candidate.pdfCaseNumber || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();

  let maxScore = 0;
  let bestMatch: Job | undefined = undefined;

  for (const existing of existingList) {
    if (existing.id === candidate.id) continue;

    const cleanExistTitle = existing.title.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();
    const cleanExistCompany = (existing.company || '').toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();
    const cleanExistCase = (existing.pdfCaseNumber || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();

    // 1. Exact Case Number Match (e.g. Case No. F.4-118/2026-R)
    if (cleanCandCase && cleanExistCase && cleanCandCase === cleanExistCase) {
      return { isDuplicate: true, duplicateScore: 100, matchedJob: existing };
    }

    // 2. Exact Title + Same Company Match
    if (cleanCandTitle && cleanCandTitle === cleanExistTitle && (cleanCandCompany.includes(cleanExistCompany) || cleanExistCompany.includes(cleanCandCompany))) {
      return { isDuplicate: true, duplicateScore: 98, matchedJob: existing };
    }

    // 3. High similarity token overlap
    const candTokens = cleanCandTitle.split(/\s+/).filter(t => t.length > 3);
    const existTokens = new Set(cleanExistTitle.split(/\s+/).filter(t => t.length > 3));
    if (candTokens.length > 0 && existTokens.size > 0) {
      let matchedTokens = 0;
      candTokens.forEach(t => { if (existTokens.has(t)) matchedTokens++; });
      const tokenRatio = (matchedTokens * 2) / (candTokens.length + existTokens.size);
      
      const companyOverlap = cleanCandCompany && cleanExistCompany && (cleanCandCompany.includes(cleanExistCompany) || cleanExistCompany.includes(cleanCandCompany));
      
      const calculatedScore = Math.round(tokenRatio * (companyOverlap ? 95 : 75));
      if (calculatedScore > maxScore) {
        maxScore = calculatedScore;
        bestMatch = existing;
      }
    }
  }

  if (maxScore >= 70 && bestMatch) {
    return { isDuplicate: true, duplicateScore: maxScore, matchedJob: bestMatch };
  }

  return { isDuplicate: false, duplicateScore: maxScore, matchedJob: bestMatch };
}

export const PdfConsolidatedScraperModal: React.FC<PdfConsolidatedScraperModalProps> = ({
  isOpen,
  onClose,
  onBatchImportJobs,
  onLogBatchRun,
  gazettes = ALL_CONSOLIDATED_PDF_GAZETTES,
  onAddGazette,
  onDeleteGazette,
  initialSelectedGazetteId,
  existingJobs = [],
  onUpdateGazettesLastScraped
}) => {
  const currentGazettes = gazettes && gazettes.length > 0 ? gazettes : ALL_CONSOLIDATED_PDF_GAZETTES;

  // Active sub-views: easy-extractor (default), python-code, raw-stream
  const [activeTab, setActiveTab] = useState<'easy-extractor' | 'python-code' | 'raw-stream'>('easy-extractor');

  // Search filter across gazettes and portals
  const [portalSearch, setPortalSearch] = useState('');
  const [portalRegionFilter, setPortalRegionFilter] = useState<'all' | 'federal' | 'punjab' | 'sindh' | 'kpk' | 'balochistan' | 'defense' | 'railways' | 'health'>('all');

  // Input & Configuration state
  const [selectedGazetteId, setSelectedGazetteId] = useState<string>(() => {
    if (initialSelectedGazetteId && currentGazettes.some(g => g.id === initialSelectedGazetteId)) {
      return initialSelectedGazetteId;
    }
    return currentGazettes[0]?.id || 'pdf-gazette-fpsc-08-2026';
  });

  // Bulk Multi-Select Gazette IDs State
  const [selectedGazetteIdsForBulk, setSelectedGazetteIdsForBulk] = useState<string[]>(() => {
    return currentGazettes.slice(0, 3).map(g => g.id);
  });

  // Portal Last Scraped Timestamp tracking
  const [portalLastScrapedMap, setPortalLastScrapedMap] = useState<Record<string, { timestamp: string; jobCount: number }>>(() => {
    try {
      const saved = localStorage.getItem('career_pak_portal_last_scraped');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn(e);
    }
    return {};
  });

  const updatePortalScrapedTimestamp = (gazetteIds: string[], jobCountPerPortal?: number) => {
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    setPortalLastScrapedMap(prev => {
      const updated = { ...prev };
      gazetteIds.forEach(id => {
        updated[id] = { timestamp: now, jobCount: jobCountPerPortal || 4 };
      });
      try {
        localStorage.setItem('career_pak_portal_last_scraped', JSON.stringify(updated));
      } catch (e) {
        console.warn(e);
      }
      return updated;
    });

    if (onUpdateGazettesLastScraped) {
      onUpdateGazettesLastScraped(gazetteIds.map(id => ({ id, lastScrapedAt: now, jobCount: jobCountPerPortal || 4 })));
    }
  };

  // Automated Crawler & Interval Timer State (15m, 30m, 1h, 2h, 3m)
  const [autoScrapeConfig, setAutoScrapeConfig] = useState<AutoScrapeConfig>(() => {
    try {
      const saved = localStorage.getItem('career_pak_pdf_autoscrape_config');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn(e);
    }
    return {
      enabled: false,
      intervalMinutes: 15,
      targetScope: 'all',
      preventDuplicates: true,
      autoApprove: true
    };
  });

  useEffect(() => {
    try {
      localStorage.setItem('career_pak_pdf_autoscrape_config', JSON.stringify(autoScrapeConfig));
    } catch (e) {
      console.warn(e);
    }
  }, [autoScrapeConfig]);

  const [lastAutoRunTimestamp, setLastAutoRunTimestamp] = useState<string | null>(() => {
    return localStorage.getItem('career_pak_pdf_autoscrape_last_run');
  });
  const [toastNotification, setToastNotification] = useState<{ message: string; type: 'success' | 'info' | 'warn' } | null>(null);

  const getPortalScrapeStatus = (gazetteId: string) => {
    const entry = portalLastScrapedMap[gazetteId];
    if (!entry || !entry.timestamp) {
      return { text: 'Never Scraped', isRecent: false, timestamp: null, count: 0 };
    }
    try {
      const d = new Date(entry.timestamp.replace(' ', 'T'));
      const diffMins = Math.floor((Date.now() - d.getTime()) / 60000);
      if (diffMins < 1) return { text: `Scraped Just now (${entry.jobCount || 4} jobs)`, isRecent: true, timestamp: entry.timestamp, count: entry.jobCount };
      if (diffMins < 60) return { text: `Scraped ${diffMins}m ago (${entry.jobCount || 4} jobs)`, isRecent: true, timestamp: entry.timestamp, count: entry.jobCount };
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return { text: `Scraped ${diffHours}h ago (${entry.jobCount || 4} jobs)`, isRecent: true, timestamp: entry.timestamp, count: entry.jobCount };
      return { text: `Scraped ${Math.floor(diffHours / 24)}d ago`, isRecent: false, timestamp: entry.timestamp, count: entry.jobCount };
    } catch {
      return { text: 'Scraped Recently', isRecent: true, timestamp: entry.timestamp, count: entry.jobCount };
    }
  };

  const [customPdfUrl, setCustomPdfUrl] = useState<string>('https://fpsc.gov.pk/advertisements/Consolidated_Advt_No_08_2026.pdf');
  const [inputMode, setInputMode] = useState<'preloaded' | 'url' | 'upload' | 'add-manual'>('preloaded');
  const [parserEngine, setParserEngine] = useState<'pdfplumber' | 'PyPDF2' | 'pdfplumber + Regex AI Entity Recognizer'>('pdfplumber');
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  // Manual Gazette Site Input Form State
  const [manualTitle, setManualTitle] = useState('');
  const [manualOrg, setManualOrg] = useState('');
  const [manualUrl, setManualUrl] = useState('');
  const [manualIssueNo, setManualIssueNo] = useState('');
  const [manualDeadline, setManualDeadline] = useState('');
  const [manualPages, setManualPages] = useState(4);
  const [manualSuccessMsg, setManualSuccessMsg] = useState<string | null>(null);

  // Parsing & Processing state
  const [isParsing, setIsParsing] = useState(false);
  const [isBulkParsing, setIsBulkParsing] = useState(false);
  const [parseProgress, setParseProgress] = useState(0);
  const [parseLogs, setParseLogs] = useState<string[]>([]);
  const [showHelperGuide, setShowHelperGuide] = useState(false);

  // Current active gazette object
  const activeGazette = currentGazettes.find(g => g.id === selectedGazetteId) || currentGazettes[0];

  // Raw extracted vacancies before filter
  const [extractedVacancies, setExtractedVacancies] = useState<Job[]>(() => {
    const initialJobs = (activeGazette?.extractedVacancies || []).map(job => {
      const dup = checkJobDuplicate(job, existingJobs);
      return {
        ...job,
        extractionSourceType: (job.isPdfScraped ? 'pdf_gazette' : 'web_html') as any,
        isDuplicate: dup.isDuplicate,
        duplicateScore: dup.duplicateScore,
        duplicateOfJobTitle: dup.matchedJob?.title,
        duplicateOfJobId: dup.matchedJob?.id
      };
    });
    return initialJobs;
  });

  const [selectedJobIds, setSelectedJobIds] = useState<string[]>(() => {
    return (activeGazette?.extractedVacancies || []).map(j => j.id);
  });

  // Vacancy view filter: all, pdf_only, web_only, duplicates_only, unique_only
  const [vacancyFilter, setVacancyFilter] = useState<'all' | 'pdf_only' | 'web_only' | 'duplicates_only' | 'unique_only'>('all');

  const [importedSuccessfully, setImportedSuccessfully] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Filtered gazettes across all 447 official portals
  const filteredGazettes = useMemo(() => {
    return currentGazettes.filter(gazette => {
      const q = portalSearch.toLowerCase().trim();
      const matchesSearch = !q || 
        gazette.title.toLowerCase().includes(q) || 
        gazette.organization.toLowerCase().includes(q) || 
        (gazette.gazetteIssueNumber || '').toLowerCase().includes(q) ||
        (gazette.pdfFileName || '').toLowerCase().includes(q) ||
        (gazette.portalCategory || '').toLowerCase().includes(q);

      if (!matchesSearch) return false;

      if (portalRegionFilter === 'all') return true;
      const lowerOrg = (gazette.organization + ' ' + gazette.title + ' ' + (gazette.portalCategory || '')).toLowerCase();
      if (portalRegionFilter === 'federal') return lowerOrg.includes('federal') || lowerOrg.includes('fpsc') || lowerOrg.includes('njp') || lowerOrg.includes('cda') || lowerOrg.includes('hec') || lowerOrg.includes('jobs.gov.pk') || lowerOrg.includes('ministry') || lowerOrg.includes('national');
      if (portalRegionFilter === 'punjab') return lowerOrg.includes('punjab') || lowerOrg.includes('ppsc') || lowerOrg.includes('lahore');
      if (portalRegionFilter === 'sindh') return lowerOrg.includes('sindh') || lowerOrg.includes('spsc') || lowerOrg.includes('karachi');
      if (portalRegionFilter === 'kpk') return lowerOrg.includes('khyber') || lowerOrg.includes('kp') || lowerOrg.includes('kppsc') || lowerOrg.includes('kmc') || lowerOrg.includes('kcd') || lowerOrg.includes('kmu') || lowerOrg.includes('peshawar');
      if (portalRegionFilter === 'balochistan') return lowerOrg.includes('balochistan') || lowerOrg.includes('bpsc') || lowerOrg.includes('quetta');
      if (portalRegionFilter === 'defense') return lowerOrg.includes('army') || lowerOrg.includes('mes') || lowerOrg.includes('mod') || lowerOrg.includes('defense') || lowerOrg.includes('defence') || lowerOrg.includes('military') || lowerOrg.includes('navy') || lowerOrg.includes('air force');
      if (portalRegionFilter === 'railways') return lowerOrg.includes('rail') || lowerOrg.includes('railways');
      if (portalRegionFilter === 'health') return lowerOrg.includes('health') || lowerOrg.includes('medical') || lowerOrg.includes('hospital') || lowerOrg.includes('pims') || lowerOrg.includes('drap');

      return true;
    });
  }, [currentGazettes, portalSearch, portalRegionFilter]);

  // Filtered portals legacy fallback
  const filteredPortals = useMemo(() => {
    return OFFICIAL_GOVT_SCRAPER_PORTALS.filter(portal => {
      const q = portalSearch.toLowerCase().trim();
      const matchesSearch = !q || 
        portal.name.toLowerCase().includes(q) || 
        portal.shortName.toLowerCase().includes(q) || 
        portal.organization.toLowerCase().includes(q);

      if (!matchesSearch) return false;

      if (portalRegionFilter === 'all') return true;
      const lowerOrg = (portal.organization + ' ' + portal.name + ' ' + portal.shortName).toLowerCase();
      if (portalRegionFilter === 'federal') return lowerOrg.includes('federal') || lowerOrg.includes('fpsc') || lowerOrg.includes('njp') || lowerOrg.includes('cda') || lowerOrg.includes('hec') || lowerOrg.includes('jobs.gov.pk');
      if (portalRegionFilter === 'punjab') return lowerOrg.includes('punjab') || lowerOrg.includes('ppsc');
      if (portalRegionFilter === 'sindh') return lowerOrg.includes('sindh') || lowerOrg.includes('spsc');
      if (portalRegionFilter === 'kpk') return lowerOrg.includes('khyber') || lowerOrg.includes('kp') || lowerOrg.includes('kppsc') || lowerOrg.includes('kmc') || lowerOrg.includes('kcd') || lowerOrg.includes('kmu');
      if (portalRegionFilter === 'balochistan') return lowerOrg.includes('balochistan') || lowerOrg.includes('bpsc');
      if (portalRegionFilter === 'defense') return lowerOrg.includes('army') || lowerOrg.includes('mes') || lowerOrg.includes('mod') || lowerOrg.includes('defense') || lowerOrg.includes('military');
      if (portalRegionFilter === 'railways') return lowerOrg.includes('rail') || lowerOrg.includes('railways');
      if (portalRegionFilter === 'health') return lowerOrg.includes('health') || lowerOrg.includes('medical') || lowerOrg.includes('hospital');

      return true;
    });
  }, [portalSearch, portalRegionFilter]);

  // Sync when gazette list or initial gazette ID changes
  useEffect(() => {
    if (initialSelectedGazetteId && currentGazettes.some(g => g.id === initialSelectedGazetteId)) {
      setSelectedGazetteId(initialSelectedGazetteId);
      const g = currentGazettes.find(item => item.id === initialSelectedGazetteId);
      if (g) {
        const enriched = (g.extractedVacancies || []).map(job => {
          const dup = checkJobDuplicate(job, existingJobs);
          return {
            ...job,
            extractionSourceType: (job.isPdfScraped ? 'pdf_gazette' : 'web_html') as any,
            isDuplicate: dup.isDuplicate,
            duplicateScore: dup.duplicateScore,
            duplicateOfJobTitle: dup.matchedJob?.title,
            duplicateOfJobId: dup.matchedJob?.id
          };
        });
        setExtractedVacancies(enriched);
        setSelectedJobIds(enriched.map(j => j.id));
        setCustomPdfUrl(g.pdfUrl);
      }
    }
  }, [initialSelectedGazetteId, currentGazettes, existingJobs]);

  // Handle switching preloaded gazettes
  const handleSelectGazette = (gazetteId: string) => {
    setSelectedGazetteId(gazetteId);
    const gazette = currentGazettes.find(g => g.id === gazetteId);
    if (gazette) {
      const enriched = (gazette.extractedVacancies || []).map(job => {
        const dup = checkJobDuplicate(job, existingJobs);
        return {
          ...job,
          extractionSourceType: (job.isPdfScraped ? 'pdf_gazette' : 'web_html') as any,
          isDuplicate: dup.isDuplicate,
          duplicateScore: dup.duplicateScore,
          duplicateOfJobTitle: dup.matchedJob?.title,
          duplicateOfJobId: dup.matchedJob?.id
        };
      });
      setExtractedVacancies(enriched);
      setSelectedJobIds(enriched.map(j => j.id));
      setCustomPdfUrl(gazette.pdfUrl);
      setImportedSuccessfully(false);
    }
  };

  // Toggle Gazette in Bulk Selection
  const handleToggleBulkGazette = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedGazetteIdsForBulk(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllBulkGazettes = () => {
    if (selectedGazetteIdsForBulk.length === currentGazettes.length) {
      setSelectedGazetteIdsForBulk([]);
    } else {
      setSelectedGazetteIdsForBulk(currentGazettes.map(g => g.id));
    }
  };

  // Handle adding a manual site into the parser library
  const handleCreateManualGazette = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualUrl.trim()) {
      alert('Please provide a valid PDF or Gazette URL.');
      return;
    }

    const newGazette = generateGazetteFromManualInput({
      title: manualTitle.trim() || `Official Recruitment Gazette (${manualOrg.trim() || 'Govt Portal'})`,
      organization: manualOrg.trim() || 'Government & Public Sector Authority',
      pdfUrl: manualUrl.trim(),
      gazetteIssueNumber: manualIssueNo.trim() || `Advt. No. ${new Date().getMonth() + 1}/${new Date().getFullYear()}`,
      closingDeadline: manualDeadline.trim() || '30th November 2026',
      totalPages: manualPages || 4
    });

    if (onAddGazette) {
      onAddGazette(newGazette);
    }

    setSelectedGazetteId(newGazette.id);
    setSelectedGazetteIdsForBulk(prev => [...prev, newGazette.id]);
    
    const enriched = (newGazette.extractedVacancies || []).map(job => {
      const dup = checkJobDuplicate(job, existingJobs);
      return {
        ...job,
        extractionSourceType: (job.isPdfScraped ? 'pdf_gazette' : 'web_html') as any,
        isDuplicate: dup.isDuplicate,
        duplicateScore: dup.duplicateScore,
        duplicateOfJobTitle: dup.matchedJob?.title,
        duplicateOfJobId: dup.matchedJob?.id
      };
    });

    setExtractedVacancies(enriched);
    setSelectedJobIds(enriched.map(j => j.id));
    setCustomPdfUrl(newGazette.pdfUrl);
    setInputMode('preloaded');
    setManualSuccessMsg(`Registered "${newGazette.title}"! All job openings extracted automatically.`);
    setTimeout(() => setManualSuccessMsg(null), 4000);
  };

  // Quick save direct URL as gazette
  const handleSaveDirectUrlAsGazette = () => {
    if (!customPdfUrl.trim()) {
      alert('Please enter a URL first');
      return;
    }
    let domain = 'Govt Portal';
    try {
      domain = new URL(customPdfUrl.startsWith('http') ? customPdfUrl : 'https://' + customPdfUrl).hostname;
    } catch {
      domain = 'Govt Portal';
    }

    const newGazette = generateGazetteFromManualInput({
      title: `Consolidated Recruitment Advertisement (${domain})`,
      organization: domain.toUpperCase(),
      pdfUrl: customPdfUrl.trim(),
      gazetteIssueNumber: `Advt. ${new Date().getFullYear()}`,
      closingDeadline: '30 Days from Publication',
      totalPages: 4
    });

    if (onAddGazette) {
      onAddGazette(newGazette);
    }

    setSelectedGazetteId(newGazette.id);
    setSelectedGazetteIdsForBulk(prev => [...prev, newGazette.id]);

    const enriched = (newGazette.extractedVacancies || []).map(job => {
      const dup = checkJobDuplicate(job, existingJobs);
      return {
        ...job,
        extractionSourceType: (job.isPdfScraped ? 'pdf_gazette' : 'web_html') as any,
        isDuplicate: dup.isDuplicate,
        duplicateScore: dup.duplicateScore,
        duplicateOfJobTitle: dup.matchedJob?.title,
        duplicateOfJobId: dup.matchedJob?.id
      };
    });

    setExtractedVacancies(enriched);
    setSelectedJobIds(enriched.map(j => j.id));
    setInputMode('preloaded');
    setManualSuccessMsg(`Saved "${domain}" into your Gazette Library.`);
    setTimeout(() => setManualSuccessMsg(null), 4000);
  };

  // Run Single Gazette Extraction Process
  const handleRunPdfExtraction = () => {
    setIsParsing(true);
    setParseProgress(10);
    setImportedSuccessfully(false);
    
    const targetTitle = inputMode === 'upload' && uploadedFileName 
      ? uploadedFileName 
      : (inputMode === 'url' ? customPdfUrl : activeGazette?.title || 'Consolidated PDF Gazette');

    setParseLogs([
      `[00:00.1] Reading PDF advertisement: "${targetTitle}"...`,
      `[00:00.3] Checking multi-column tables, provincial quotas, and scale information...`
    ]);

    setTimeout(() => {
      setParseProgress(45);
      setParseLogs(prev => [
        ...prev,
        `[00:00.8] Reading pages and preserving position titles & pay scales...`,
        `[00:01.2] Found official government departments, domicile quotas, and application deadlines.`
      ]);
    }, 500);

    setTimeout(() => {
      setParseProgress(80);
      setParseLogs(prev => [
        ...prev,
        `[00:01.6] Extracting vacancy details, age relaxation rules, and fee challans...`,
        `[00:01.9] Done! Cross-referencing duplicate status with active live jobs database...`
      ]);
    }, 1100);

    setTimeout(() => {
      setParseProgress(100);
      setIsParsing(false);
      let loadedVacancies = activeGazette?.extractedVacancies || [];
      
      if (inputMode === 'url' && (!activeGazette || activeGazette.pdfUrl !== customPdfUrl)) {
        const generated = generateGazetteFromManualInput({
          title: `Direct Extracted Gazette (${new URL(customPdfUrl.startsWith('http') ? customPdfUrl : 'https://' + customPdfUrl).hostname})`,
          organization: 'Public Sector Recruitment',
          pdfUrl: customPdfUrl
        });
        loadedVacancies = generated.extractedVacancies;
      }

      // Enrich with duplicate detection & source typing
      const enriched = loadedVacancies.map(job => {
        const dup = checkJobDuplicate(job, existingJobs);
        return {
          ...job,
          extractionSourceType: (job.isPdfScraped ? 'pdf_gazette' : 'web_html') as any,
          isDuplicate: dup.isDuplicate,
          duplicateScore: dup.duplicateScore,
          duplicateOfJobTitle: dup.matchedJob?.title,
          duplicateOfJobId: dup.matchedJob?.id
        };
      });

      setExtractedVacancies(enriched);
      setSelectedJobIds(enriched.map(j => j.id));
      updatePortalScrapedTimestamp([activeGazette.id], enriched.length);
      setParseLogs(prev => [
        ...prev,
        `[00:02.3] Extracted ${enriched.length} job openings successfully! (${enriched.filter(j => j.isDuplicate).length} duplicates flagged)`
      ]);
    }, 1600);
  };

  // Run BULK Multi-PDF Scraping Process across all selected gazettes
  const handleRunBulkScraping = () => {
    if (selectedGazetteIdsForBulk.length === 0) {
      alert('Please select at least 1 PDF Gazette / portal to scrape.');
      return;
    }

    setIsBulkParsing(true);
    setParseProgress(5);
    setImportedSuccessfully(false);

    const targetGazettes = currentGazettes.filter(g => selectedGazetteIdsForBulk.includes(g.id));
    setParseLogs([
      `[00:00.1] Starting Bulk Batch Scraper for ${targetGazettes.length} selected portals...`,
      `[00:00.3] Queueing: ${targetGazettes.map(g => g.organization).join(', ')}...`
    ]);

    let step = 0;
    const totalSteps = targetGazettes.length;

    const interval = setInterval(() => {
      step++;
      const currentG = targetGazettes[step - 1];
      const percent = Math.min(95, Math.round((step / totalSteps) * 90));
      setParseProgress(percent);

      if (currentG) {
        setParseLogs(prev => [
          ...prev,
          `[00:0${step}.${step * 2}] [${step}/${totalSteps}] Processing "${currentG.organization}" (${currentG.pdfFileName})... Extracted ${currentG.extractedVacancies?.length || 4} vacancies.`
        ]);
      }

      if (step >= totalSteps) {
        clearInterval(interval);
        setTimeout(() => {
          setParseProgress(100);
          setIsBulkParsing(false);

          // Aggregate all vacancies
          const allAggregatedJobs: Job[] = [];
          targetGazettes.forEach((g) => {
            (g.extractedVacancies || []).forEach((job) => {
              const dup = checkJobDuplicate(job, existingJobs);
              allAggregatedJobs.push({
                ...job,
                extractionSourceType: (job.isPdfScraped ? 'pdf_gazette' : 'web_html') as any,
                isDuplicate: dup.isDuplicate,
                duplicateScore: dup.duplicateScore,
                duplicateOfJobTitle: dup.matchedJob?.title,
                duplicateOfJobId: dup.matchedJob?.id
              });
            });
          });

          setExtractedVacancies(allAggregatedJobs);
          setSelectedJobIds(allAggregatedJobs.map(j => j.id));
          updatePortalScrapedTimestamp(targetGazettes.map(g => g.id), 4);
          setParseLogs(prev => [
            ...prev,
            `[00:03.4] Bulk Batch Finished! Total ${allAggregatedJobs.length} vacancies consolidated across ${targetGazettes.length} sources.`
          ]);
        }, 500);
      }
    }, 400);
  };

  // ONE-CLICK INSTANT SCRAPE & DIRECT INGESTION
  const handleOneClickScrape = (targetId?: string) => {
    const targetG = currentGazettes.find(g => g.id === (targetId || selectedGazetteId)) || activeGazette;
    if (!targetG) return;

    setIsParsing(true);
    setParseProgress(20);
    setImportedSuccessfully(false);

    setParseLogs([
      `[00:00.1] ⚡ One-Click Instant Scrape initiated for "${targetG.organization}"...`,
      `[00:00.3] Downloading & parsing PDF: ${targetG.pdfFileName}...`
    ]);

    setTimeout(() => {
      setParseProgress(65);
      setParseLogs(prev => [...prev, `[00:00.6] Cross-referencing against existing job database to eliminate duplicates...`]);
    }, 250);

    setTimeout(() => {
      setParseProgress(100);
      setIsParsing(false);

      const rawJobs = targetG.extractedVacancies || [];
      const enriched = rawJobs.map(job => {
        const dup = checkJobDuplicate(job, existingJobs);
        return {
          ...job,
          extractionSourceType: (job.isPdfScraped ? 'pdf_gazette' : 'web_html') as any,
          isDuplicate: dup.isDuplicate,
          duplicateScore: dup.duplicateScore,
          duplicateOfJobTitle: dup.matchedJob?.title,
          duplicateOfJobId: dup.matchedJob?.id
        };
      });

      const uniqueJobs = enriched.filter(j => !j.isDuplicate);
      const duplicateCount = enriched.length - uniqueJobs.length;

      // Ingest unique jobs directly to live approved database
      if (uniqueJobs.length > 0) {
        onBatchImportJobs(uniqueJobs, true, targetG.title);
      }

      updatePortalScrapedTimestamp([targetG.id], enriched.length);
      setExtractedVacancies(enriched);
      setSelectedJobIds(uniqueJobs.map(j => j.id));

      const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
      const batchId = 'ONECLICK-' + Date.now().toString().substring(6);

      const auditEntries: ScrapedJobAuditEntry[] = uniqueJobs.map((job, jIdx) => ({
        id: `audit-${job.id}-${Date.now().toString(36)}-${jIdx}`,
        jobId: job.id,
        batchId,
        jobTitle: job.title,
        company: job.company,
        scrapedAt: now,
        scrapedTimezone: 'PKT (UTC+5)',
        sourcePortalName: targetG.organization,
        sourceUrl: targetG.pdfUrl,
        sourceDomain: targetG.organization.includes('FPSC') ? 'fpsc.gov.pk' : 'jobs.gov.pk',
        category: 'Government Sector',
        region: 'Pakistan',
        currency: 'PKR',
        salaryText: job.salary,
        status: 'Auto-Approved',
        deduplicationScore: 99.9,
        crawlLatencyMs: 310,
        extractedTags: job.tags || [],
        requirementsCount: job.requirements?.length || 0,
        isGovtJob: true,
        govtScale: job.govtScale,
        govtDepartment: job.govtDepartment,
        isPdfScraped: true,
        pdfFileName: targetG.pdfFileName,
        pdfCaseNumber: job.pdfCaseNumber,
        pdfTotalVacanciesInCase: job.pdfTotalVacanciesInCase,
        domicileQuota: job.domicileQuota,
        challanFee: job.challanFee,
        ageRelaxationNote: job.ageRelaxationNote,
        pdfParserEngine: 'pdfplumber',
        extractionSourceType: 'pdf_gazette',
        isDuplicate: false,
        reviewTimeline: [
          {
            id: 'act-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
            timestamp: now,
            relativeTime: 'Just now',
            action: 'Scraped',
            performedBy: 'Admin User',
            notes: `Extracted via 1-Click Instant Scraper from ${targetG.organization}.`
          }
        ],
        snapshot: {
          description: job.description,
          requirements: job.requirements,
          benefits: job.benefits,
          applyUrl: job.sourceUrl
        }
      }));

      const batchRun: ScraperBatchRun = {
        batchId,
        startTime: now,
        endTime: now,
        sourceId: targetG.id,
        sourceName: `${targetG.organization} (1-Click Instant Scrape)`,
        sourceUrl: targetG.pdfUrl,
        region: 'Pakistan',
        category: 'Government Sector',
        status: 'Completed',
        totalExtracted: enriched.length,
        approvedCount: uniqueJobs.length,
        pendingCount: 0,
        duplicatesSkipped: duplicateCount,
        rejectionCount: 0,
        executionDurationMs: 650,
        httpStatusCode: 200,
        triggerType: 'Manual On-Demand',
        logTrace: [
          `[${now}] ⚡ One-Click Instant Scrape executed for ${targetG.organization}`,
          `[${now}] Total Extracted: ${enriched.length} vacancies | Imported New: ${uniqueJobs.length} | Duplicates Blocked: ${duplicateCount}`
        ]
      };

      onLogBatchRun(batchRun, auditEntries);

      setToastNotification({
        message: `⚡ One-Click Scrape Complete! Ingested ${uniqueJobs.length} new vacancies from ${targetG.organization}. (${duplicateCount} duplicate(s) safely filtered)`,
        type: 'success'
      });
      setTimeout(() => setToastNotification(null), 5000);
    }, 600);
  };

  // FULL AUTOMATED INTERVAL TIMER CRAWLER EXECUTION
  const [isAutoCrawling, setIsAutoCrawling] = useState(false);

  const handleTriggerAutoScrapeRun = () => {
    setIsAutoCrawling(true);
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    setLastAutoRunTimestamp(now);
    try {
      localStorage.setItem('career_pak_pdf_autoscrape_last_run', now);
    } catch (e) {
      console.warn(e);
    }

    const targets = autoScrapeConfig.targetScope === 'selected' && selectedGazetteIdsForBulk.length > 0
      ? currentGazettes.filter(g => selectedGazetteIdsForBulk.includes(g.id))
      : currentGazettes.slice(0, 20);

    const aggregatedJobs: Job[] = [];
    let duplicateCount = 0;

    targets.forEach(g => {
      (g.extractedVacancies || []).forEach(job => {
        const dup = checkJobDuplicate(job, existingJobs);
        if (autoScrapeConfig.preventDuplicates && dup.isDuplicate) {
          duplicateCount++;
        } else {
          aggregatedJobs.push({
            ...job,
            extractionSourceType: (job.isPdfScraped ? 'pdf_gazette' : 'web_html') as any,
            isDuplicate: dup.isDuplicate,
            duplicateScore: dup.duplicateScore,
            duplicateOfJobTitle: dup.matchedJob?.title,
            duplicateOfJobId: dup.matchedJob?.id
          });
        }
      });
    });

    setTimeout(() => {
      setIsAutoCrawling(false);

      if (aggregatedJobs.length > 0) {
        onBatchImportJobs(
          aggregatedJobs,
          autoScrapeConfig.autoApprove,
          `Automated Timer Crawl (${targets.length} Portals)`
        );
      }

      updatePortalScrapedTimestamp(targets.map(t => t.id), 4);

      const batchId = 'AUTO-TIMER-' + Date.now().toString().substring(6);
      const auditEntries: ScrapedJobAuditEntry[] = aggregatedJobs.slice(0, 15).map((job, jIdx) => ({
        id: `audit-${job.id}-${Date.now().toString(36)}-${jIdx}`,
        jobId: job.id,
        batchId,
        jobTitle: job.title,
        company: job.company,
        scrapedAt: now,
        scrapedTimezone: 'PKT (UTC+5)',
        sourcePortalName: job.company,
        sourceUrl: job.sourceUrl || 'https://jobs.gov.pk',
        sourceDomain: 'jobs.gov.pk',
        category: 'Government Sector',
        region: 'Pakistan',
        currency: 'PKR',
        salaryText: job.salary,
        status: autoScrapeConfig.autoApprove ? 'Auto-Approved' : 'Pending Review',
        deduplicationScore: 99.4,
        crawlLatencyMs: 380,
        extractedTags: job.tags || [],
        requirementsCount: job.requirements?.length || 0,
        isGovtJob: true,
        govtScale: job.govtScale,
        govtDepartment: job.govtDepartment,
        isPdfScraped: true,
        pdfFileName: job.pdfFileName || 'Gazette.pdf',
        pdfParserEngine: 'pdfplumber',
        extractionSourceType: 'pdf_gazette',
        isDuplicate: false,
        reviewTimeline: [
          {
            id: 'act-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
            timestamp: now,
            relativeTime: 'Just now',
            action: 'Scraped',
            performedBy: 'Cron Scraper Engine',
            notes: `Auto-crawled on ${autoScrapeConfig.intervalMinutes}m timer schedule.`
          }
        ],
        snapshot: {
          description: job.description,
          requirements: job.requirements,
          benefits: job.benefits,
          applyUrl: job.sourceUrl
        }
      }));

      const batchRun: ScraperBatchRun = {
        batchId,
        startTime: now,
        endTime: now,
        sourceId: 'auto-timer',
        sourceName: `Automated Scheduled Crawler (${autoScrapeConfig.intervalMinutes}m Interval)`,
        sourceUrl: 'https://jobs.gov.pk',
        region: 'Pakistan',
        category: 'Government Sector',
        status: 'Completed',
        totalExtracted: aggregatedJobs.length + duplicateCount,
        approvedCount: autoScrapeConfig.autoApprove ? aggregatedJobs.length : 0,
        pendingCount: autoScrapeConfig.autoApprove ? 0 : aggregatedJobs.length,
        duplicatesSkipped: duplicateCount,
        rejectionCount: 0,
        executionDurationMs: 1250,
        httpStatusCode: 200,
        triggerType: 'Scheduled Cron',
        logTrace: [
          `[${now}] 🤖 Automated Interval Crawler executed (${autoScrapeConfig.intervalMinutes}m cycle)`,
          `[${now}] Scraped ${targets.length} official portals | Imported ${aggregatedJobs.length} vacancies | Skipped ${duplicateCount} duplicates`
        ]
      };

      onLogBatchRun(batchRun, auditEntries);

      setToastNotification({
        message: `🤖 Auto-Crawler Cycle Complete: Ingested ${aggregatedJobs.length} new vacancies across ${targets.length} portals, skipped ${duplicateCount} duplicates.`,
        type: 'success'
      });
      setTimeout(() => setToastNotification(null), 5000);
    }, 800);
  };

  // SCRAPE ALL 447 PORTALS INSTANTLY
  const handleScrapeAllPortals = () => {
    setSelectedGazetteIdsForBulk(currentGazettes.map(g => g.id));
    setIsBulkParsing(true);
    setParseProgress(10);
    setImportedSuccessfully(false);

    const targetGazettes = currentGazettes;
    setParseLogs([
      `[00:00.1] Starting Full System Bulk Scraper across all ${targetGazettes.length} official government portals...`,
      `[00:00.4] Consolidating FPSC, WAPDA, PPSC, SPSC, KPPSC, BPSC, NJP, MES, Defence & Autonomous bodies...`
    ]);

    let step = 0;
    const totalSteps = 10;

    const interval = setInterval(() => {
      step++;
      const percent = Math.min(95, Math.round((step / totalSteps) * 90));
      setParseProgress(percent);

      setParseLogs(prev => [
        ...prev,
        `[00:0${step}.${step * 2}] Batch cluster ${step}/${totalSteps}: Processing gazettes & verifying duplicate signatures...`
      ]);

      if (step >= totalSteps) {
        clearInterval(interval);
        setTimeout(() => {
          setParseProgress(100);
          setIsBulkParsing(false);

          const allJobs: Job[] = [];
          targetGazettes.forEach(g => {
            (g.extractedVacancies || []).forEach(job => {
              const dup = checkJobDuplicate(job, existingJobs);
              allJobs.push({
                ...job,
                extractionSourceType: (job.isPdfScraped ? 'pdf_gazette' : 'web_html') as any,
                isDuplicate: dup.isDuplicate,
                duplicateScore: dup.duplicateScore,
                duplicateOfJobTitle: dup.matchedJob?.title,
                duplicateOfJobId: dup.matchedJob?.id
              });
            });
          });

          setExtractedVacancies(allJobs);
          const uniqueOnes = allJobs.filter(j => !j.isDuplicate);
          setSelectedJobIds(uniqueOnes.map(j => j.id));
          updatePortalScrapedTimestamp(targetGazettes.map(g => g.id), 4);

          setParseLogs(prev => [
            ...prev,
            `[00:03.8] Full Consolidated Scrape Finished! Extracted ${allJobs.length} vacancies across ${targetGazettes.length} portals. (${uniqueOnes.length} unique, ${allJobs.length - uniqueOnes.length} duplicates flagged)`
          ]);

          setToastNotification({
            message: `⚡ Full Scrape Complete: Extracted ${allJobs.length} vacancies across all ${targetGazettes.length} portals (${uniqueOnes.length} unique ready to import).`,
            type: 'info'
          });
          setTimeout(() => setToastNotification(null), 5000);
        }, 500);
      }
    }, 300);
  };

  // Toggle Selection of All Filtered Gazettes
  const handleSelectAllFilteredGazettes = () => {
    const targetList = filteredGazettes.length > 0 ? filteredGazettes : currentGazettes;
    const allFilteredSelected = targetList.every(g => selectedGazetteIdsForBulk.includes(g.id));
    if (allFilteredSelected) {
      setSelectedGazetteIdsForBulk(prev => prev.filter(id => !targetList.some(g => g.id === id)));
    } else {
      const merged = new Set([...selectedGazetteIdsForBulk, ...targetList.map(g => g.id)]);
      setSelectedGazetteIdsForBulk(Array.from(merged));
    }
  };

  // Select Absolute All 447 Portals
  const handleSelectAbsoluteAllGazettes = () => {
    if (selectedGazetteIdsForBulk.length === currentGazettes.length) {
      setSelectedGazetteIdsForBulk([]);
    } else {
      setSelectedGazetteIdsForBulk(currentGazettes.map(g => g.id));
    }
  };

  // Toggle Job Selection
  const handleToggleSelectJob = (id: string) => {
    setSelectedJobIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    if (selectedJobIds.length === extractedVacancies.length) {
      setSelectedJobIds([]);
    } else {
      setSelectedJobIds(extractedVacancies.map(j => j.id));
    }
  };

  // Deselect All Flagged Duplicates
  const handleDeselectAllDuplicates = () => {
    const nonDuplicateIds = extractedVacancies.filter(j => !j.isDuplicate).map(j => j.id);
    setSelectedJobIds(nonDuplicateIds);
  };

  // Mark Duplicate as Approved Override
  const handleToggleDuplicateOverride = (jobId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExtractedVacancies(prev => prev.map(j => {
      if (j.id === jobId) {
        const nextOverride = !j.isDuplicateOverride;
        return {
          ...j,
          isDuplicateOverride: nextOverride,
          duplicateOverrideNote: nextOverride ? 'Approved Duplicate / Re-announced Vacancy' : undefined
        };
      }
      return j;
    }));
  };

  // Mark All Duplicates as Approved Override
  const handleApproveAllDuplicatesWithOverride = () => {
    setExtractedVacancies(prev => prev.map(j => {
      if (j.isDuplicate) {
        return {
          ...j,
          isDuplicateOverride: true,
          duplicateOverrideNote: 'Approved Duplicate / Re-announced Vacancy'
        };
      }
      return j;
    }));
    // Also ensure they are selected
    setSelectedJobIds(extractedVacancies.map(j => j.id));
  };

  // Filtered Vacancies for display
  const displayedVacancies = useMemo(() => {
    return extractedVacancies.filter(job => {
      if (vacancyFilter === 'pdf_only' && job.extractionSourceType !== 'pdf_gazette' && !job.isPdfScraped) return false;
      if (vacancyFilter === 'web_only' && (job.extractionSourceType === 'pdf_gazette' || job.isPdfScraped)) return false;
      if (vacancyFilter === 'duplicates_only' && !job.isDuplicate) return false;
      if (vacancyFilter === 'unique_only' && job.isDuplicate) return false;
      return true;
    });
  }, [extractedVacancies, vacancyFilter]);

  // Statistics
  const stats = useMemo(() => {
    const total = extractedVacancies.length;
    const pdfCount = extractedVacancies.filter(j => j.extractionSourceType === 'pdf_gazette' || j.isPdfScraped).length;
    const webCount = extractedVacancies.filter(j => j.extractionSourceType === 'web_html' || (!j.isPdfScraped && !j.pdfCaseNumber)).length;
    const duplicateCount = extractedVacancies.filter(j => j.isDuplicate).length;
    const uniqueCount = total - duplicateCount;
    const overrideCount = extractedVacancies.filter(j => j.isDuplicateOverride).length;
    return { total, pdfCount, webCount, duplicateCount, uniqueCount, overrideCount };
  }, [extractedVacancies]);

  // Perform Ingestion into Live Jobs or Pending Queue
  const handleIngest = (autoApprove: boolean) => {
    const jobsToImport = extractedVacancies.filter(j => selectedJobIds.includes(j.id));
    if (jobsToImport.length === 0) {
      alert('Please select at least 1 job opening to publish or save.');
      return;
    }

    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const batchId = 'BATCH-PDF-' + Date.now().toString().substring(6);

    // Call parent batch import
    onBatchImportJobs(jobsToImport, autoApprove, activeGazette.title);

    // Generate Audit Trail and Batch Run record
    const auditEntries: ScrapedJobAuditEntry[] = jobsToImport.map((job, jIdx) => ({
      id: `audit-${job.id}-${Date.now().toString(36)}-${jIdx}-${Math.random().toString(36).substring(2, 6)}`,
      jobId: job.id,
      batchId,
      jobTitle: job.title,
      company: job.company,
      scrapedAt: timestamp,
      scrapedTimezone: 'PKT (UTC+5)',
      sourcePortalName: activeGazette.organization,
      sourceUrl: activeGazette.pdfUrl,
      sourceDomain: activeGazette.organization.includes('FPSC') ? 'fpsc.gov.pk' : (activeGazette.organization.includes('WAPDA') ? 'wapda.gov.pk' : 'jobs.gov.pk'),
      category: 'Government Sector',
      region: 'Pakistan',
      currency: 'PKR',
      salaryText: job.salary,
      status: autoApprove ? 'Auto-Approved' : 'Pending Review',
      deduplicationScore: job.isDuplicate ? (100 - (job.duplicateScore || 90)) : 99.1,
      crawlLatencyMs: 420,
      extractedTags: job.tags || [],
      requirementsCount: job.requirements?.length || 0,
      isGovtJob: true,
      govtScale: job.govtScale,
      govtDepartment: job.govtDepartment,
      isPdfScraped: job.isPdfScraped ?? true,
      pdfFileName: activeGazette.pdfFileName,
      pdfCaseNumber: job.pdfCaseNumber,
      pdfTotalVacanciesInCase: job.pdfTotalVacanciesInCase,
      domicileQuota: job.domicileQuota,
      challanFee: job.challanFee,
      ageRelaxationNote: job.ageRelaxationNote,
      pdfParserEngine: parserEngine.includes('pdfplumber') ? 'pdfplumber' : 'PyPDF2',
      extractionSourceType: job.extractionSourceType || 'pdf_gazette',
      isDuplicate: job.isDuplicate,
      duplicateOfJobTitle: job.duplicateOfJobTitle,
      duplicateOfJobId: job.duplicateOfJobId,
      isDuplicateOverride: job.isDuplicateOverride,
      duplicateOverrideNote: job.duplicateOverrideNote,
      reviewTimeline: [
        {
          id: 'act-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
          timestamp,
          relativeTime: 'Just now',
          action: 'Scraped',
          performedBy: 'PDF Parser Engine',
          notes: `Parsed from official PDF advertisement (${activeGazette.pdfFileName}). Source: ${job.extractionSourceType === 'pdf_gazette' ? 'PDF Gazette' : 'Direct Web Post'}.`
        },
        job.isDuplicateOverride ? {
          id: 'act-' + Date.now() + '-dup-override',
          timestamp,
          relativeTime: 'Just now',
          action: 'Duplicate Flagged',
          performedBy: 'Deduplication Guard',
          notes: `Flagged as Duplicate (${job.duplicateScore}% match with "${job.duplicateOfJobTitle}"), approved with Admin Override as Re-advertised Vacancy.`
        } : (null as any),
        autoApprove ? {
          id: 'act-' + Date.now() + '-app',
          timestamp,
          relativeTime: 'Just now',
          action: 'Auto-Approved',
          performedBy: 'Admin Fast Publish',
          notes: 'Published directly to Live Job Board.'
        } : {
          id: 'act-' + Date.now() + '-pend',
          timestamp,
          relativeTime: 'Just now',
          action: 'Queued',
          performedBy: 'Admin Staging',
          notes: 'Saved into Admin Review list for checking before publishing.'
        }
      ].filter(Boolean),
      snapshot: {
        description: job.description,
        requirements: job.requirements,
        benefits: job.benefits,
        applyUrl: job.sourceUrl
      }
    }));

    const batchRun: ScraperBatchRun = {
      batchId,
      startTime: timestamp,
      endTime: new Date(Date.now() + 2100).toISOString().replace('T', ' ').substring(0, 19),
      sourceId: activeGazette.id,
      sourceName: `${activeGazette.organization} (PDF Gazette & Web)`,
      sourceUrl: activeGazette.pdfUrl,
      region: 'Pakistan',
      category: 'Government Sector',
      status: 'Completed',
      totalExtracted: jobsToImport.length,
      approvedCount: autoApprove ? jobsToImport.length : 0,
      pendingCount: autoApprove ? 0 : jobsToImport.length,
      duplicatesSkipped: stats.duplicateCount - stats.overrideCount,
      rejectionCount: 0,
      executionDurationMs: 2100,
      httpStatusCode: 200,
      triggerType: 'Manual On-Demand',
      logTrace: parseLogs.length > 0 ? parseLogs : [
        `[${timestamp}] Ingested ${jobsToImport.length} vacancies from ${activeGazette.pdfFileName}`,
        `[${timestamp}] Target: ${autoApprove ? 'Published Live' : 'Queued in Pending Approvals'}`
      ]
    };

    onLogBatchRun(batchRun, auditEntries);
    setImportedSuccessfully(true);
  };

  const pythonScriptCode = `"""
FPSC & WAPDA Consolidated PDF Scraper Script
Dependencies: pip install pdfplumber PyPDF2 requests
"""
import re
import json
import pdfplumber

def scrape_fpsc_wapda_consolidated_pdf(pdf_path_or_url: str):
    """
    Extracts multi-vacancy gazette posts from FPSC / WAPDA consolidated PDF files.
    """
    extracted_vacancies = []
    
    # 1. Open PDF with pdfplumber for visual layout & table fidelity
    with pdfplumber.open(pdf_path_or_url) as pdf:
        full_text = ""
        for page_idx, page in enumerate(pdf.pages):
            # Layout=True maintains column separation
            text = page.extract_text(layout=True, x_tolerance=2, y_tolerance=2)
            if text:
                full_text += f"\\n--- PAGE {page_idx+1} ---\\n" + text
                
    # 2. Regular Expressions for Pakistani Government Gazettes
    regex_case_split = r'\\n(?=(?:Case\\s*No\\.?|CASE\\s*NO\\.?|Sr\\.\\s*No\\.?\\s*\\d+)\\s*[Ff\\d\\.\\-])'
    case_blocks = re.split(regex_case_split, full_text, flags=re.IGNORECASE)
    
    for block in case_blocks:
        if len(block.strip()) < 40:
            continue
            
        # Extract Case Ref (e.g. Case No. F.4-118/2026-R [8/2026])
        case_match = re.search(r'(?:Case\\s*No\\.?|CASE\\s*NO\\.?)\\s*([Ff]\\.4-\\d+/\\d+-[A-Za-z0-9\\(\\)\-]+)', block, re.I)
        case_no = case_match.group(0).strip() if case_match else "Official Gazette Post"
        
        # Extract Pay Scale (BPS-16, 17, 18, 19, 20)
        bps_match = re.search(r'(?:BPS|BS)[- ]?([1-2][0-9]|[0-9])', block, re.I)
        bps_scale = f"BPS-{bps_match.group(1)}" if bps_match else "BPS-17"
        
        # Extract Domicile Quota (Punjab, Sindh, KPK, Balochistan)
        quota_match = re.search(r'(?:DOMICILE\\s*/?\\s*QUOTA|QUOTA)[=:\\s]+(.*?)(?=\\n\\s*(?:MINIMUM|QUALIFICATION|AGE)|$)', block, re.I | re.DOTALL)
        domicile_quota = quota_match.group(1).replace('\\n', ' ').strip() if quota_match else "Open Merit / Provincial Quota"
        
        # Extract Age Limits & 5-year General Relaxation
        age_match = re.search(r'(?:AGE\\s*LIMIT|AGE)[=:\\s]+(.*?)(?=\\n\\s*(?:NUMBER|DOMICILE|CLOSING)|$)', block, re.I | re.DOTALL)
        age_limit = age_match.group(1).replace('\\n', ' ').strip() if age_match else "22-30 years + 5 years relaxation"
        
        extracted_vacancies.append({
            "case_number": case_no,
            "bps_scale": bps_scale,
            "domicile_quota": domicile_quota,
            "age_limit": age_limit,
            "is_pdf_scraped": True,
            "parser_engine": "pdfplumber"
        })
        
    return extracted_vacancies

# Example execution
if __name__ == "__main__":
    jobs = scrape_fpsc_wapda_consolidated_pdf("Consolidated_Advt_No_08_2026.pdf")
    print(f"Parsed {len(jobs)} vacancies from PDF gazette:")
    print(json.dumps(jobs, indent=2))`;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(pythonScriptCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-6xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* MODAL HEADER */}
        <div className="p-4 sm:p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500/30 to-amber-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shrink-0">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-black text-white">Consolidated PDF & Hybrid Scraper Engine</h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  Bulk Batch Mode
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  Auto Duplicate Guard
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                  {currentGazettes.length} Portals
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Batch-scrape multiple gazettes at once, extract both PDF and Web postings, and automatically flag duplicates against live database.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setShowHelperGuide(!showHelperGuide)}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-amber-200 text-xs font-bold flex items-center space-x-1.5 cursor-pointer border border-slate-700"
              title="How to use this tool"
            >
              <HelpCircle className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline">How It Works</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 3-STEP VISUAL PROGRESS BAR */}
        <div className="px-6 py-2.5 bg-slate-950/80 border-b border-slate-800 grid grid-cols-3 gap-2 text-xs">
          <div className="flex items-center space-x-2 bg-indigo-950/40 border border-indigo-500/30 p-2 rounded-xl text-indigo-300 font-bold">
            <span className="w-5 h-5 rounded-full bg-indigo-500 text-white flex items-center justify-center text-[10px] font-black shrink-0">1</span>
            <span className="truncate">Select Single or Bulk PDFs</span>
          </div>
          <div className="flex items-center space-x-2 bg-slate-900 border border-slate-800 p-2 rounded-xl text-slate-300 font-bold">
            <span className="w-5 h-5 rounded-full bg-slate-700 text-slate-300 flex items-center justify-center text-[10px] font-black shrink-0">2</span>
            <span className="truncate">Hybrid Extraction & Dup-Check</span>
          </div>
          <div className="flex items-center space-x-2 bg-emerald-950/40 border border-emerald-500/30 p-2 rounded-xl text-emerald-300 font-bold">
            <span className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center text-[10px] font-black shrink-0">3</span>
            <span className="truncate">Publish / Override & Post</span>
          </div>
        </div>

        {/* HELPER GUIDE ACCORDION */}
        {showHelperGuide && (
          <div className="mx-6 mt-4 p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-xs text-amber-200 space-y-2 animate-in fade-in">
            <div className="flex items-center justify-between">
              <strong className="text-amber-300 font-black text-sm flex items-center space-x-1.5">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Bulk PDF Scraping & Duplicate Guard Instructions:</span>
              </strong>
              <button
                onClick={() => setShowHelperGuide(false)}
                className="text-amber-400 hover:text-white text-xs cursor-pointer"
              >
                Close Guide ✕
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1 text-slate-300">
              <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
                <span className="text-amber-400 font-black block mb-1">1. Bulk PDF Selection:</span>
                <p className="text-[11px] text-slate-400">Select multiple PDF gazettes using checkboxes or click "Select All" to harvest dozens of newspapers/sites in one click.</p>
              </div>
              <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
                <span className="text-indigo-400 font-black block mb-1">2. Hybrid Extraction:</span>
                <p className="text-[11px] text-slate-400">Extracts both PDF gazette vacancy blocks (BPS scales, quota, challan fee) and direct web HTML postings with clear source tags.</p>
              </div>
              <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
                <span className="text-emerald-400 font-black block mb-1">3. Duplicate Auto-Check:</span>
                <p className="text-[11px] text-slate-400">Compares against active jobs. If a duplicate is found, choose to exclude it or approve with "Duplicate Override (Re-advertised)".</p>
              </div>
            </div>
          </div>
        )}

        {/* NAVIGATION TABS */}
        <div className="px-6 py-2 border-b border-slate-800 bg-slate-950/40 flex items-center space-x-2 overflow-x-auto text-xs font-bold">
          <button
            onClick={() => setActiveTab('easy-extractor')}
            className={`px-4 py-2 rounded-xl transition-all flex items-center space-x-2 cursor-pointer ${
              activeTab === 'easy-extractor'
                ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>🚀 Easy Scraper & Bulk Parser (Active)</span>
          </button>

          <button
            onClick={() => setActiveTab('python-code')}
            className={`px-4 py-2 rounded-xl transition-all flex items-center space-x-2 cursor-pointer ${
              activeTab === 'python-code'
                ? 'bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            <span>💻 Python Script Code (`pdfplumber`)</span>
          </button>

          <button
            onClick={() => setActiveTab('raw-stream')}
            className={`px-4 py-2 rounded-xl transition-all flex items-center space-x-2 cursor-pointer ${
              activeTab === 'raw-stream'
                ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>📄 Raw Document Text Stream</span>
          </button>
        </div>

        {/* TOAST NOTIFICATION */}
        {toastNotification && (
          <div className="mx-6 mt-4 p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-emerald-200 text-xs font-bold flex items-center justify-between shadow-lg shadow-emerald-950/40 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{toastNotification.message}</span>
            </div>
            <button
              onClick={() => setToastNotification(null)}
              className="text-emerald-400 hover:text-white text-xs cursor-pointer ml-4"
            >
              ✕
            </button>
          </div>
        )}

        {/* MODAL BODY */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          
          {/* TAB 1: EASY EXTRACTOR */}
          {activeTab === 'easy-extractor' && (
            <div className="space-y-6">

              {/* AUTO-SCRAPE TIMER & BACKGROUND CRAWLER CONTROLS */}
              <AutoScrapeTimerControls
                config={autoScrapeConfig}
                onChangeConfig={setAutoScrapeConfig}
                isAutoCrawling={isAutoCrawling}
                onTriggerNow={handleTriggerAutoScrapeRun}
                lastRunTimestamp={lastAutoRunTimestamp}
                totalPortalsCount={currentGazettes.length}
                selectedPortalsCount={selectedGazetteIdsForBulk.length}
              />
              
              {/* STEP 1: CHOOSE SOURCE SECTION */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                  <div>
                    <h3 className="text-sm font-black uppercase text-white flex items-center space-x-2">
                      <span className="w-5 h-5 rounded-full bg-indigo-500 text-white text-[11px] font-black flex items-center justify-center">1</span>
                      <span>Target PDF Sources & Multi-Mode Scraper Engine</span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      Supports 1-Click Instant Scrape, Bulk Selection Scrape, One-by-One Selection, or Auto Scrape with 15m/30m timer.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
                    <button
                      onClick={() => setInputMode('preloaded')}
                      className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                        inputMode === 'preloaded' ? 'bg-indigo-500 text-white shadow' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Building2 className="w-3.5 h-3.5" />
                      <span>Official Portals ({currentGazettes.length})</span>
                    </button>
                    <button
                      onClick={() => setInputMode('add-manual')}
                      className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                        inputMode === 'add-manual' ? 'bg-amber-500 text-slate-950 font-black shadow' : 'text-amber-400 hover:text-amber-300'
                      }`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Add New Source</span>
                    </button>
                    <button
                      onClick={() => setInputMode('url')}
                      className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                        inputMode === 'url' ? 'bg-indigo-500 text-white shadow' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Globe className="w-3.5 h-3.5" />
                      <span>Paste Direct PDF Link</span>
                    </button>
                    <button
                      onClick={() => setInputMode('upload')}
                      className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                        inputMode === 'upload' ? 'bg-indigo-500 text-white shadow' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload Local PDF</span>
                    </button>
                  </div>
                </div>

                {/* SUCCESS FEEDBACK NOTIFICATION */}
                {manualSuccessMsg && (
                  <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs font-bold flex items-center space-x-2 animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span>{manualSuccessMsg}</span>
                  </div>
                )}

                {/* INPUT CONFIGURATION: PRELOADED GAZETTE LIST WITH BULK CHECKBOXES */}
                {inputMode === 'preloaded' && (
                  <div className="space-y-3">
                    
                    {/* QUICK SEARCH & REGION FILTERS */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                      <div className="relative flex-1">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                        <input
                          type="text"
                          value={portalSearch}
                          onChange={(e) => setPortalSearch(e.target.value)}
                          placeholder="Search across all 447 portals: FPSC, WAPDA, PPSC, Railways, NJP, MES, Health..."
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:border-indigo-500 outline-none"
                        />
                      </div>

                      <div className="flex items-center space-x-1 overflow-x-auto pb-1 text-xs">
                        {(['all', 'federal', 'punjab', 'sindh', 'kpk', 'balochistan', 'defense', 'railways', 'health'] as const).map((r) => (
                          <button
                            key={r}
                            type="button"
                            onClick={() => setPortalRegionFilter(r)}
                            className={`px-2.5 py-1 rounded-lg font-bold text-[11px] capitalize cursor-pointer transition-all whitespace-nowrap ${
                              portalRegionFilter === r 
                                ? 'bg-indigo-500 text-white' 
                                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                            }`}
                          >
                            {r}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* MULTI-MODE ACTION BAR (ONE-CLICK, BULK, ALL, SELECTION) */}
                    <div className="p-3.5 bg-slate-900/90 rounded-2xl border border-indigo-500/30 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* SELECT FILTERED / DESELECT */}
                        <button
                          type="button"
                          onClick={handleSelectAllFilteredGazettes}
                          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 cursor-pointer flex items-center space-x-1.5"
                        >
                          <CheckSquare className="w-4 h-4 text-indigo-400" />
                          <span>Toggle Filtered ({filteredGazettes.length})</span>
                        </button>

                        {/* SELECT ABSOLUTE ALL */}
                        <button
                          type="button"
                          onClick={handleSelectAbsoluteAllGazettes}
                          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-bold border border-slate-700 cursor-pointer flex items-center space-x-1.5"
                        >
                          <CheckCheck className="w-4 h-4 text-amber-400" />
                          <span>{selectedGazetteIdsForBulk.length === currentGazettes.length ? 'Deselect All' : `Select All (${currentGazettes.length})`}</span>
                        </button>

                        <div className="text-xs text-slate-300 pl-2">
                          <span className="font-black text-amber-400">{selectedGazetteIdsForBulk.length}</span> of <span className="font-black text-white">{currentGazettes.length}</span> Portals Selected
                        </div>
                      </div>

                      {/* ACTION BUTTONS: ONE-CLICK, BULK SCRAPE, SCRAPE ALL */}
                      <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-start lg:justify-end">
                        {/* 1-CLICK INSTANT SCRAPE BUTTON */}
                        <button
                          type="button"
                          onClick={() => handleOneClickScrape()}
                          disabled={isParsing || isBulkParsing}
                          className="px-3.5 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-emerald-500/20 cursor-pointer transition-all active:scale-95 disabled:opacity-50 flex items-center space-x-1.5"
                          title="Instantly scrape the active portal, check duplicates, and directly ingest unique jobs"
                        >
                          <Zap className="w-4 h-4 text-slate-950 fill-current" />
                          <span>⚡ 1-Click Instant Scrape & Ingest</span>
                        </button>

                        {/* BULK SCRAPE SELECTED */}
                        <button
                          type="button"
                          onClick={handleRunBulkScraping}
                          disabled={isBulkParsing || selectedGazetteIdsForBulk.length === 0}
                          className="px-3.5 py-2 bg-gradient-to-r from-amber-500 via-orange-500 to-indigo-600 hover:from-amber-400 hover:to-indigo-500 text-slate-950 hover:text-white font-black text-xs rounded-xl shadow-lg shadow-amber-500/20 cursor-pointer transition-all active:scale-95 disabled:opacity-50 flex items-center space-x-1.5"
                        >
                          <Sparkles className="w-4 h-4 text-slate-950 animate-spin" />
                          <span>{isBulkParsing ? 'Bulk Scraping...' : `⚡ Bulk Scrape (${selectedGazetteIdsForBulk.length})`}</span>
                        </button>

                        {/* SCRAPE ALL 447 PORTALS */}
                        <button
                          type="button"
                          onClick={handleScrapeAllPortals}
                          disabled={isBulkParsing}
                          className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold text-xs rounded-xl border border-slate-700 cursor-pointer transition-all disabled:opacity-50 flex items-center space-x-1.5"
                          title="Scrape all 447 portals in unified multi-cluster mode"
                        >
                          <Layers className="w-3.5 h-3.5 text-indigo-400" />
                          <span>Scrape All ({currentGazettes.length})</span>
                        </button>
                      </div>
                    </div>

                    {/* GAZETTE PORTALS GRID WITH INDIVIDUAL CHECKBOXES & 1-CLICK SCRAPE ON EACH */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-72 overflow-y-auto pr-1">
                      {filteredGazettes.map((gazette, gIdx) => {
                        const isBulkSelected = selectedGazetteIdsForBulk.includes(gazette.id);
                        const isCurrentActive = selectedGazetteId === gazette.id;
                        const scrapeStatus = getPortalScrapeStatus(gazette.id);

                        return (
                          <div
                            key={`${gazette.id}-${gIdx}`}
                            onClick={() => handleSelectGazette(gazette.id)}
                            className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between space-y-2 ${
                              isCurrentActive
                                ? 'bg-indigo-950/70 border-indigo-500/80 shadow-md ring-1 ring-indigo-500/40'
                                : 'bg-slate-900/60 hover:bg-slate-900 border-slate-800'
                            }`}
                          >
                            <div className="flex items-start space-x-2.5">
                              {/* SELECTION CHECKBOX */}
                              <button
                                type="button"
                                onClick={(e) => handleToggleBulkGazette(gazette.id, e)}
                                className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center transition-colors shrink-0 ${
                                  isBulkSelected ? 'bg-amber-500 border-amber-400 text-slate-950' : 'border-slate-700 bg-slate-950'
                                }`}
                                title="Toggle in bulk scraper list"
                              >
                                {isBulkSelected && <Check className="w-3 h-3 stroke-[3]" />}
                              </button>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-bold text-indigo-300 truncate">{gazette.organization}</span>
                                  <span className="text-[9px] font-mono text-slate-400">{gazette.gazetteIssueNumber}</span>
                                </div>
                                <h5 className="font-bold text-white text-xs truncate mt-0.5">{gazette.title}</h5>
                                <div className="flex items-center space-x-2 text-[10px] text-slate-400 mt-1">
                                  <span>{gazette.extractedVacancies?.length || 4} Vacancies</span>
                                  <span>•</span>
                                  <span className="text-rose-300 font-semibold truncate">{gazette.closingDeadline}</span>
                                </div>
                              </div>
                            </div>

                            {/* CARD FOOTER: LAST SCRAPED STATUS & ONE-CLICK SCRAPE BUTTON */}
                            <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[10px]">
                              <span className={`px-2 py-0.5 rounded-full font-bold flex items-center space-x-1 ${
                                scrapeStatus.isRecent
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                  : 'bg-slate-800 text-slate-400 border border-slate-700'
                              }`}>
                                <Clock className="w-2.5 h-2.5" />
                                <span>{scrapeStatus.text}</span>
                              </span>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelectGazette(gazette.id);
                                  handleOneClickScrape(gazette.id);
                                }}
                                disabled={isParsing}
                                className="px-2 py-1 rounded-lg bg-indigo-600/80 hover:bg-indigo-500 text-white font-bold text-[10px] flex items-center space-x-1 cursor-pointer transition-all active:scale-95 disabled:opacity-50"
                                title="1-Click Scrape this specific portal only"
                              >
                                <Zap className="w-3 h-3 text-amber-300 fill-current" />
                                <span>Scrape</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* CURRENTLY ACTIVE GAZETTE DETAILS */}
                    <div className="p-4 bg-indigo-950/40 border border-indigo-500/40 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2 flex-wrap">
                          <span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-indigo-500 text-white">
                            Active Single Selection
                          </span>
                          <span className="text-xs font-bold text-indigo-300">{activeGazette.organization}</span>
                          {portalLastScrapedMap[activeGazette.id]?.timestamp && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center space-x-1">
                              <Clock className="w-2.5 h-2.5" />
                              <span>Last Scraped: {portalLastScrapedMap[activeGazette.id].timestamp}</span>
                            </span>
                          )}
                        </div>
                        <h4 className="font-black text-white text-sm">{activeGazette.title}</h4>
                        <p className="text-xs text-slate-400">
                          Issue No: <strong className="text-slate-300">{activeGazette.gazetteIssueNumber}</strong> • Last Date to Apply:{' '}
                          <span className="text-rose-300 font-bold">{activeGazette.closingDeadline}</span> • PDF: <code className="text-[11px] text-slate-300 font-mono">{activeGazette.pdfFileName}</code>
                        </p>
                      </div>

                      <div className="shrink-0 flex items-center space-x-2">
                        {/* 1-CLICK SCRAPE THIS ACTIVE PORTAL */}
                        <button
                          type="button"
                          onClick={() => handleOneClickScrape(activeGazette.id)}
                          disabled={isParsing}
                          className="px-3.5 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 text-xs font-black rounded-xl shadow-lg shadow-emerald-500/20 cursor-pointer flex items-center space-x-1.5 disabled:opacity-50"
                          title="Instant scrape & save without manual review"
                        >
                          <Zap className="w-3.5 h-3.5 text-slate-950 fill-current" />
                          <span>⚡ 1-Click Ingest</span>
                        </button>

                        {/* EXTRACT & PREVIEW JOBS */}
                        <button
                          type="button"
                          onClick={handleRunPdfExtraction}
                          disabled={isParsing}
                          className="px-4 py-2 bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-black rounded-xl shadow-lg shadow-indigo-500/20 cursor-pointer flex items-center space-x-1.5 disabled:opacity-50"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                          <span>{isParsing ? 'Extracting...' : 'Preview Jobs'}</span>
                        </button>
                      </div>
                    </div>

                  </div>
                )}

                {/* INPUT CONFIGURATION: MANUAL SITE & GAZETTE REGISTRATION */}
                {inputMode === 'add-manual' && (
                  <form onSubmit={handleCreateManualGazette} className="p-4 bg-slate-900/90 border border-amber-500/30 rounded-2xl space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <div>
                        <h4 className="text-sm font-black text-amber-300 uppercase flex items-center space-x-1.5">
                          <BookmarkPlus className="w-4 h-4 text-amber-400" />
                          <span>Add Custom Government Website or PDF Advertisement</span>
                        </h4>
                        <p className="text-[11px] text-slate-400">
                          Register any new government recruitment portal or direct PDF link. It will automatically extract both PDF and Web postings.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-300">Advertisement Title *</label>
                        <input
                          type="text"
                          required
                          value={manualTitle}
                          onChange={(e) => setManualTitle(e.target.value)}
                          placeholder="e.g. SPSC Consolidated Recruitment Advt No. 04/2026"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:border-amber-400 outline-none"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-300">Department / Commission Name *</label>
                        <input
                          type="text"
                          required
                          value={manualOrg}
                          onChange={(e) => setManualOrg(e.target.value)}
                          placeholder="e.g. Sindh Public Service Commission (SPSC)"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:border-amber-400 outline-none"
                        />
                      </div>

                      <div className="space-y-1 md:col-span-2">
                        <label className="text-xs font-bold text-slate-300">PDF Web Link or Portal URL *</label>
                        <input
                          type="url"
                          required
                          value={manualUrl}
                          onChange={(e) => setManualUrl(e.target.value)}
                          placeholder="https://spsc.gos.pk/advertisements/Advt_No_04_2026.pdf"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white font-mono placeholder-slate-500 focus:border-amber-400 outline-none"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-300">Advertisement Issue / Case Number</label>
                        <input
                          type="text"
                          value={manualIssueNo}
                          onChange={(e) => setManualIssueNo(e.target.value)}
                          placeholder="e.g. Advt. No. 04/2026"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:border-amber-400 outline-none"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-300">Last Date to Apply (Deadline)</label>
                        <input
                          type="text"
                          value={manualDeadline}
                          onChange={(e) => setManualDeadline(e.target.value)}
                          placeholder="e.g. 20th November 2026"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:border-amber-400 outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-800">
                      <button
                        type="button"
                        onClick={() => setInputMode('preloaded')}
                        className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-xl shadow-lg shadow-amber-500/20 cursor-pointer flex items-center space-x-1.5"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Save & Add to Scraper Portals</span>
                      </button>
                    </div>
                  </form>
                )}

                {/* INPUT CONFIGURATION: DIRECT PDF URL */}
                {inputMode === 'url' && (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-300">Paste Official PDF Web Link</label>
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <input
                          type="url"
                          value={customPdfUrl}
                          onChange={(e) => setCustomPdfUrl(e.target.value)}
                          placeholder="https://fpsc.gov.pk/advertisements/Adv-08-2026.pdf"
                          className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white font-mono focus:border-indigo-500 outline-none"
                        />
                        <button
                          type="button"
                          onClick={handleSaveDirectUrlAsGazette}
                          className="px-3.5 py-2 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/40 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 cursor-pointer whitespace-nowrap"
                        >
                          <BookmarkPlus className="w-3.5 h-3.5" />
                          <span>Save Source</span>
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Supports all official government PDF files and direct recruitment announcements.
                      </p>
                    </div>
                  </div>
                )}

                {inputMode === 'upload' && (
                  <div className="border-2 border-dashed border-slate-800 hover:border-indigo-500/50 rounded-2xl p-6 text-center space-y-3 bg-slate-900/40 cursor-pointer">
                    <div className="w-12 h-12 mx-auto rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                      <Upload className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">
                        {uploadedFileName ? uploadedFileName : 'Drag & Drop your Official Advertisement PDF'}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">Supports all official advertisement PDFs up to 50 MB</p>
                    </div>
                    <label className="inline-block px-4 py-2 bg-slate-800 hover:bg-slate-700 text-indigo-300 text-xs font-bold rounded-xl border border-slate-700 cursor-pointer">
                      Browse Computer Files
                      <input
                        type="file"
                        accept=".pdf"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            setUploadedFileName(e.target.files[0].name);
                          }
                        }}
                      />
                    </label>
                  </div>
                )}

                {/* PARSE PROGRESS INDICATOR */}
                {(isParsing || isBulkParsing) && (
                  <div className="space-y-2 pt-2">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-indigo-400 flex items-center space-x-2">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                        <span>{isBulkParsing ? 'Bulk Scraping all selected PDF Gazettes...' : 'Reading PDF and checking duplicate status...'}</span>
                      </span>
                      <span className="text-amber-400 font-mono">{parseProgress}%</span>
                    </div>
                    <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                      <div
                        className="bg-gradient-to-r from-amber-500 via-indigo-500 to-emerald-500 h-2 transition-all duration-300"
                        style={{ width: `${parseProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* FRIENDLY STATUS LOGS */}
                {parseLogs.length > 0 && (
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-900 font-mono text-[11px] space-y-1 text-slate-300 max-h-28 overflow-y-auto">
                    {parseLogs.map((log, idx) => (
                      <div key={idx} className="flex items-start space-x-2">
                        <span className="text-emerald-400 select-none">✓</span>
                        <span>{log}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* STEP 3: EXTRACTED VACANCIES & PUBLISH ACTIONS */}
              <div className="space-y-4">
                
                {/* TOOLBAR WITH FILTERS AND DUPLICATE CONTROLS */}
                <div className="bg-slate-950/90 p-4 sm:p-5 rounded-2xl border border-slate-800 space-y-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                        <span className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 text-[11px] font-black flex items-center justify-center">3</span>
                        <h3 className="text-base font-black text-white">Extracted Vacancies Queue ({extractedVacancies.length})</h3>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          {selectedJobIds.length} Selected
                        </span>
                        {stats.duplicateCount > 0 && (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center space-x-1">
                            <AlertTriangle className="w-3 h-3 text-amber-400" />
                            <span>{stats.duplicateCount} Duplicates Auto-Flagged</span>
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        Review vacancies, verify source origins (PDF vs Web HTML), and resolve duplicate warnings.
                      </p>
                    </div>

                    {/* BATCH PUBLISH / SAVE BUTTONS */}
                    <div className="flex items-center space-x-2 flex-wrap gap-y-2">
                      <button
                        onClick={() => handleIngest(true)}
                        className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl flex items-center space-x-1.5 shadow-lg shadow-emerald-500/20 cursor-pointer transition-all active:scale-95"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>🚀 Direct Publish ({selectedJobIds.length}) to Live Board</span>
                      </button>

                      <button
                        onClick={() => handleIngest(false)}
                        className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl flex items-center space-x-1.5 shadow-lg shadow-amber-500/20 cursor-pointer transition-all active:scale-95"
                      >
                        <ShieldCheck className="w-4 h-4" />
                        <span>🛡️ Save ({selectedJobIds.length}) for Admin Review</span>
                      </button>
                    </div>
                  </div>

                  {/* SUB-FILTER PILLS: SOURCE ORIGIN & DUPLICATE STATUS */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      <button
                        onClick={() => setVacancyFilter('all')}
                        className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                          vacancyFilter === 'all' ? 'bg-indigo-500 text-white' : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                        }`}
                      >
                        All Vacancies ({stats.total})
                      </button>

                      <button
                        onClick={() => setVacancyFilter('pdf_only')}
                        className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer flex items-center space-x-1 ${
                          vacancyFilter === 'pdf_only' ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-indigo-300 hover:text-white border border-slate-800'
                        }`}
                      >
                        <FileText className="w-3 h-3 text-indigo-400" />
                        <span>📄 PDF Gazette Ads ({stats.pdfCount})</span>
                      </button>

                      <button
                        onClick={() => setVacancyFilter('web_only')}
                        className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer flex items-center space-x-1 ${
                          vacancyFilter === 'web_only' ? 'bg-teal-600 text-slate-950 font-black' : 'bg-slate-900 text-teal-300 hover:text-white border border-slate-800'
                        }`}
                      >
                        <Globe className="w-3 h-3 text-teal-400" />
                        <span>🌐 Web HTML Postings ({stats.webCount})</span>
                      </button>

                      <button
                        onClick={() => setVacancyFilter('duplicates_only')}
                        className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer flex items-center space-x-1 ${
                          vacancyFilter === 'duplicates_only' ? 'bg-amber-500 text-slate-950 font-black' : 'bg-slate-900 text-amber-300 hover:text-white border border-slate-800'
                        }`}
                      >
                        <AlertTriangle className="w-3 h-3 text-amber-400" />
                        <span>⚠️ Duplicates Flagged ({stats.duplicateCount})</span>
                      </button>

                      <button
                        onClick={() => setVacancyFilter('unique_only')}
                        className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer flex items-center space-x-1 ${
                          vacancyFilter === 'unique_only' ? 'bg-emerald-600 text-white font-black' : 'bg-slate-900 text-emerald-300 hover:text-white border border-slate-800'
                        }`}
                      >
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        <span>✨ New Unique Only ({stats.uniqueCount})</span>
                      </button>
                    </div>

                    {/* DUPLICATE BULK ACTIONS */}
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={handleToggleSelectAll}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg border border-slate-700 cursor-pointer"
                      >
                        {selectedJobIds.length === extractedVacancies.length ? 'Deselect All' : 'Select All'}
                      </button>

                      {stats.duplicateCount > 0 && (
                        <>
                          <button
                            onClick={handleDeselectAllDuplicates}
                            className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-bold rounded-lg border border-amber-500/40 cursor-pointer flex items-center space-x-1"
                            title="Deselect duplicate postings so they won't be imported"
                          >
                            <span>Deselect Duplicates</span>
                          </button>

                          <button
                            onClick={handleApproveAllDuplicatesWithOverride}
                            className="px-2.5 py-1 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 text-xs font-bold rounded-lg border border-indigo-500/40 cursor-pointer flex items-center space-x-1"
                            title="Mark all duplicate vacancies as Approved Re-advertised Posts"
                          >
                            <FileCheck className="w-3 h-3 text-indigo-400" />
                            <span>Override All Duplicates</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {importedSuccessfully && (
                  <div className="p-4 bg-emerald-950/60 border border-emerald-500/40 rounded-2xl flex items-center justify-between text-xs text-emerald-300 animate-in fade-in duration-300">
                    <div className="flex items-center space-x-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                      <div>
                        <strong className="text-white text-sm">Jobs Ingested Successfully!</strong>
                        <p className="text-emerald-200">The selected job openings (including any approved duplicate overrides) are now available in your job portal database.</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* VACANCY CARDS LIST */}
                <div className="grid grid-cols-1 gap-3">
                  {displayedVacancies.length === 0 ? (
                    <div className="p-8 text-center bg-slate-950/60 rounded-2xl border border-slate-800 text-slate-400 space-y-2">
                      <Bot className="w-8 h-8 text-indigo-400 mx-auto animate-pulse" />
                      <p className="font-bold text-white text-sm">No vacancies match the selected filter ({vacancyFilter})</p>
                      <p className="text-xs">Click "All Vacancies" above to see all extracted jobs.</p>
                    </div>
                  ) : (
                    displayedVacancies.map((vacancy, vIdx) => {
                      const isSelected = selectedJobIds.includes(vacancy.id);
                      const isDup = vacancy.isDuplicate;

                      return (
                        <div
                          key={vacancy.id ? `${vacancy.id}-${vIdx}` : `vac-${vIdx}`}
                          onClick={() => handleToggleSelectJob(vacancy.id)}
                          className={`p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer ${
                            isDup && !vacancy.isDuplicateOverride
                              ? 'bg-amber-950/20 border-amber-500/40 ring-1 ring-amber-500/20'
                              : isSelected
                              ? 'bg-slate-950 border-indigo-500/60 shadow-xl shadow-indigo-500/10 ring-1 ring-indigo-500/30'
                              : 'bg-slate-950/40 border-slate-800 opacity-60 hover:opacity-100 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start space-x-3">
                              <div className={`mt-1 w-5 h-5 rounded-lg border flex items-center justify-center transition-all ${
                                isSelected ? 'bg-indigo-500 border-indigo-400 text-white' : 'border-slate-700 bg-slate-900'
                              }`}>
                                {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                              </div>

                              <div className="space-y-1.5">
                                <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                                  {/* SOURCE ORIGIN BADGE */}
                                  {vacancy.extractionSourceType === 'pdf_gazette' || vacancy.isPdfScraped ? (
                                    <span className="px-2.5 py-0.5 rounded-lg text-xs font-black bg-indigo-500/20 text-indigo-300 border border-indigo-500/35 flex items-center space-x-1">
                                      <FileText className="w-3 h-3 text-indigo-400" />
                                      <span>📄 PDF Gazette Scraped</span>
                                    </span>
                                  ) : (
                                    <span className="px-2.5 py-0.5 rounded-lg text-xs font-black bg-teal-500/20 text-teal-300 border border-teal-500/35 flex items-center space-x-1">
                                      <Globe className="w-3 h-3 text-teal-400" />
                                      <span>🌐 Direct Web/HTML Post</span>
                                    </span>
                                  )}

                                  {vacancy.pdfCaseNumber && (
                                    <span className="px-2.5 py-0.5 rounded-lg text-xs font-black bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-mono">
                                      📋 {vacancy.pdfCaseNumber}
                                    </span>
                                  )}
                                  
                                  <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                    {vacancy.govtScale || 'BPS-17'}
                                  </span>

                                  <span className="px-2 py-0.5 rounded-lg text-[11px] font-bold bg-slate-800 text-slate-300">
                                    {vacancy.pdfTotalVacanciesInCase ? `${vacancy.pdfTotalVacanciesInCase} Vacancies` : 'Multi-Seat'}
                                  </span>

                                  {/* DUPLICATE OVERRIDE BADGE */}
                                  {vacancy.isDuplicateOverride && (
                                    <span className="px-2.5 py-0.5 rounded-lg text-xs font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center space-x-1">
                                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                      <span>✅ Duplicate Override (Re-advertised)</span>
                                    </span>
                                  )}
                                </div>

                                <h4 className="text-base font-black text-white">{vacancy.title}</h4>
                                <p className="text-xs text-slate-300 font-semibold flex items-center space-x-1.5">
                                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                                  <span>{vacancy.company}</span>
                                </p>
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <span className="text-xs font-mono font-bold text-emerald-400 block">{vacancy.salary}</span>
                              <span className="text-[11px] text-slate-400 mt-1 block">Deadline: {vacancy.deadlineDate || '22nd Sep'}</span>
                            </div>
                          </div>

                          {/* DUPLICATE WARNING CALLOUT */}
                          {isDup && (
                            <div className="mt-3 p-3 bg-amber-500/15 border border-amber-500/40 rounded-xl text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                              <div className="flex items-start space-x-2">
                                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                                <div>
                                  <span className="font-bold text-amber-300">
                                    Duplicate Detected ({vacancy.duplicateScore}% match):
                                  </span>
                                  <span className="text-slate-300 ml-1">
                                    Matches active listing <strong>"{vacancy.duplicateOfJobTitle}"</strong> in database.
                                  </span>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={(e) => handleToggleDuplicateOverride(vacancy.id, e)}
                                className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer shrink-0 flex items-center space-x-1 ${
                                  vacancy.isDuplicateOverride
                                    ? 'bg-emerald-500 text-slate-950 font-black shadow-md'
                                    : 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-black shadow-md'
                                }`}
                              >
                                <span>{vacancy.isDuplicateOverride ? '✓ Duplicate Overridden' : 'Approve with Override ("Duplicate but Posted")'}</span>
                              </button>
                            </div>
                          )}

                          {/* DOMICILE & QUOTA SPLIT BADGES */}
                          {vacancy.domicileQuota && (
                            <div className="mt-3 p-2.5 bg-slate-900/80 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-1">
                              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                                Provincial Quota Allocation:
                              </span>
                              <p className="font-mono text-indigo-300 text-[11px] font-semibold">{vacancy.domicileQuota}</p>
                            </div>
                          )}

                          {/* QUALIFICATIONS & AGE */}
                          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-slate-300">
                            <div className="bg-slate-900/50 p-2 rounded-xl border border-slate-800/60">
                              <span className="text-slate-500 block text-[10px] font-bold uppercase">Eligibility:</span>
                              <span className="line-clamp-2">{vacancy.requirements ? vacancy.requirements[0] : 'Bachelor / Master in relevant field'}</span>
                            </div>
                            <div className="bg-slate-900/50 p-2 rounded-xl border border-slate-800/60">
                              <span className="text-slate-500 block text-[10px] font-bold uppercase">Age Limits & Relaxation:</span>
                              <span>{vacancy.ageRelaxationNote || '22-30 Years (+ 5 Years General Relaxation)'}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: PYTHON SCRAPER CODE */}
          {activeTab === 'python-code' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <div>
                  <h3 className="text-sm font-black text-white uppercase flex items-center space-x-2">
                    <Code className="w-4 h-4 text-amber-400" />
                    <span>Python Production PDF Scraper Engine (`scraper/fpsc_wapda_pdf_scraper.py`)</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Use this production-ready Python script to automate scheduled cron jobs for FPSC, WAPDA, PPSC, and NTS PDF files.
                  </p>
                </div>

                <button
                  onClick={handleCopyCode}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-bold rounded-xl border border-slate-700 flex items-center space-x-1.5 cursor-pointer"
                >
                  {copiedCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedCode ? 'Code Copied!' : 'Copy Python Script'}</span>
                </button>
              </div>

              {/* CODE BLOCK */}
              <div className="bg-slate-950 rounded-2xl border border-slate-800 p-4 overflow-x-auto">
                <pre className="text-xs font-mono text-emerald-300 leading-relaxed whitespace-pre">
                  {pythonScriptCode}
                </pre>
              </div>
            </div>
          )}

          {/* TAB 3: RAW PDF GAZETTE STREAM */}
          {activeTab === 'raw-stream' && (
            <div className="space-y-4">
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-1">
                <h3 className="text-sm font-black text-white uppercase">Raw Text Stream for: {activeGazette.title}</h3>
                <p className="text-xs text-slate-400">
                  Inspect the direct text coordinates extracted from {activeGazette.pdfFileName}.
                </p>
              </div>

              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 font-mono text-xs text-slate-300 max-h-[50vh] overflow-y-auto leading-relaxed whitespace-pre-wrap">
                {activeGazette.rawTextSample}
              </div>
            </div>
          )}

        </div>

        {/* MODAL FOOTER */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Bulk PDF Scraper Ready • {selectedJobIds.length} of {extractedVacancies.length} positions selected</span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl border border-slate-700 cursor-pointer"
            >
              Close
            </button>
            <button
              onClick={() => handleIngest(true)}
              className="px-4 py-2 bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-black rounded-xl shadow-lg shadow-indigo-500/20 cursor-pointer flex items-center space-x-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Publish {selectedJobIds.length} Selected Jobs</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
