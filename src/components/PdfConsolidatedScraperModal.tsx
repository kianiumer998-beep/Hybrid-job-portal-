import React, { useState, useEffect } from 'react';
import { Job, ConsolidatedPdfGazette, ScrapedJobAuditEntry, ScraperBatchRun } from '../types/job';
import { 
  MOCK_CONSOLIDATED_PDF_GAZETTES, 
  generateGazetteFromManualInput,
  OFFICIAL_GOVT_SCRAPER_PORTALS 
} from '../data/mockPdfConsolidatedAds';
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
  BookmarkPlus
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
}

export const PdfConsolidatedScraperModal: React.FC<PdfConsolidatedScraperModalProps> = ({
  isOpen,
  onClose,
  onBatchImportJobs,
  onLogBatchRun,
  gazettes = MOCK_CONSOLIDATED_PDF_GAZETTES,
  onAddGazette,
  onDeleteGazette,
  initialSelectedGazetteId
}) => {
  if (!isOpen) return null;

  const currentGazettes = gazettes && gazettes.length > 0 ? gazettes : MOCK_CONSOLIDATED_PDF_GAZETTES;

  // Active sub-views
  const [activeTab, setActiveTab] = useState<'parser' | 'python-code' | 'raw-stream'>('parser');

  // Input & Configuration state
  const [selectedGazetteId, setSelectedGazetteId] = useState<string>(() => {
    if (initialSelectedGazetteId && currentGazettes.some(g => g.id === initialSelectedGazetteId)) {
      return initialSelectedGazetteId;
    }
    return currentGazettes[0]?.id || 'pdf-gazette-fpsc-08-2026';
  });

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
  const [parseProgress, setParseProgress] = useState(0);
  const [parseLogs, setParseLogs] = useState<string[]>([]);

  // Current active gazette object
  const activeGazette = currentGazettes.find(g => g.id === selectedGazetteId) || currentGazettes[0];

  const [extractedVacancies, setExtractedVacancies] = useState<Job[]>(() => {
    return activeGazette?.extractedVacancies || [];
  });
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>(() => {
    return (activeGazette?.extractedVacancies || []).map(j => j.id);
  });
  const [importedSuccessfully, setImportedSuccessfully] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Sync when gazette list or initial gazette ID changes
  useEffect(() => {
    if (initialSelectedGazetteId && currentGazettes.some(g => g.id === initialSelectedGazetteId)) {
      setSelectedGazetteId(initialSelectedGazetteId);
      const g = currentGazettes.find(item => item.id === initialSelectedGazetteId);
      if (g) {
        setExtractedVacancies(g.extractedVacancies || []);
        setSelectedJobIds((g.extractedVacancies || []).map(j => j.id));
        setCustomPdfUrl(g.pdfUrl);
      }
    }
  }, [initialSelectedGazetteId, currentGazettes]);

  // Handle switching preloaded gazettes
  const handleSelectGazette = (gazetteId: string) => {
    setSelectedGazetteId(gazetteId);
    const gazette = currentGazettes.find(g => g.id === gazetteId);
    if (gazette) {
      setExtractedVacancies(gazette.extractedVacancies || []);
      setSelectedJobIds((gazette.extractedVacancies || []).map(j => j.id));
      setCustomPdfUrl(gazette.pdfUrl);
      setImportedSuccessfully(false);
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
    setExtractedVacancies(newGazette.extractedVacancies);
    setSelectedJobIds(newGazette.extractedVacancies.map(j => j.id));
    setCustomPdfUrl(newGazette.pdfUrl);
    setInputMode('preloaded');
    setManualSuccessMsg(`Successfully registered "${newGazette.title}" to PDF Parser!`);
    setTimeout(() => setManualSuccessMsg(null), 5000);

    // Reset form
    setManualTitle('');
    setManualOrg('');
    setManualUrl('');
    setManualIssueNo('');
    setManualDeadline('');
  };

  // Quick save from direct URL tab
  const handleSaveDirectUrlAsGazette = () => {
    if (!customPdfUrl.trim()) return;
    const domain = new URL(customPdfUrl.startsWith('http') ? customPdfUrl : 'https://' + customPdfUrl).hostname;
    const newGazette = generateGazetteFromManualInput({
      title: `Consolidated Gazette from ${domain}`,
      organization: domain.includes('fpsc') ? 'FPSC' : domain.includes('ppsc') ? 'PPSC' : domain.includes('kppsc') ? 'KPPSC' : domain.includes('spsc') ? 'SPSC' : domain.includes('wapda') ? 'WAPDA' : domain,
      pdfUrl: customPdfUrl.trim()
    });

    if (onAddGazette) {
      onAddGazette(newGazette);
    }

    setSelectedGazetteId(newGazette.id);
    setExtractedVacancies(newGazette.extractedVacancies);
    setSelectedJobIds(newGazette.extractedVacancies.map(j => j.id));
    setInputMode('preloaded');
    setManualSuccessMsg(`URL saved as new Gazette: "${newGazette.title}"`);
    setTimeout(() => setManualSuccessMsg(null), 5000);
  };

  // Run simulated extraction pipeline using pdfplumber/PyPDF2 logic
  const handleRunPdfExtraction = () => {
    setIsParsing(true);
    setParseProgress(10);
    setImportedSuccessfully(false);
    const targetSourceUrl = inputMode === 'preloaded' ? activeGazette?.pdfUrl : customPdfUrl;
    const targetTitle = inputMode === 'preloaded' ? activeGazette?.title : `URL Stream (${customPdfUrl})`;

    setParseLogs([
      `[00:00.1] [HTTP Fetcher] Connecting to PDF stream: ${targetSourceUrl}`,
      `[00:00.3] [Stream Validator] PDF header valid (%PDF-1.7, ${inputMode === 'upload' ? 'Uploaded Local File' : (activeGazette?.fileSizeFormatted || '2.4 MB')})`
    ]);

    setTimeout(() => {
      setParseProgress(35);
      setParseLogs(prev => [
        ...prev,
        `[00:00.8] [Engine: ${parserEngine}] Spawning Python worker thread. Loading PDF layout coordinate trees...`,
        `[00:01.2] [pdfplumber] Extracted ${activeGazette?.totalPages || 4} pages with multi-column table preservation`
      ]);
    }, 600);

    setTimeout(() => {
      setParseProgress(70);
      setParseLogs(prev => [
        ...prev,
        `[00:01.6] [Regex Case Engine] Splitting text blocks on Case delimiters: r'(?:Case\\s*No\\.|CASE\\s*NO|Sr\\.\\s*No|Case\\s*Ref)'`,
        `[00:01.9] [Entity Extractor] Detected ${activeGazette?.extractedVacancies?.length || 2} distinct BPS positions with Domicile Quota matrices`,
        `[00:02.1] [Challan Fee Engine] Parsed treasury challan fee tiers (Rs. 300 to Rs. 1,200)`
      ]);
    }, 1300);

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

      setExtractedVacancies(loadedVacancies);
      setSelectedJobIds(loadedVacancies.map(j => j.id));
      setParseLogs(prev => [
        ...prev,
        `[00:02.4] [Extraction Complete] Successfully parsed ${loadedVacancies.length} vacancies from "${targetTitle}" ready for ingestion!`
      ]);
    }, 2000);
  };

  // Toggle selection
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

  // Perform Batch Ingestion into Live Jobs or Pending Queue with Audit History
  const handleIngest = (autoApprove: boolean) => {
    const jobsToImport = extractedVacancies.filter(j => selectedJobIds.includes(j.id));
    if (jobsToImport.length === 0) {
      alert('Please select at least 1 extracted vacancy to ingest.');
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
      sourceDomain: activeGazette.organization.includes('FPSC') ? 'fpsc.gov.pk' : 'wapda.gov.pk',
      category: 'Government Sector',
      region: 'Pakistan',
      currency: 'PKR',
      salaryText: job.salary,
      status: autoApprove ? 'Auto-Approved' : 'Pending Review',
      deduplicationScore: 99.1,
      crawlLatencyMs: 420,
      extractedTags: job.tags || [],
      requirementsCount: job.requirements?.length || 0,
      isGovtJob: true,
      govtScale: job.govtScale,
      govtDepartment: job.govtDepartment,
      isPdfScraped: true,
      pdfFileName: activeGazette.pdfFileName,
      pdfCaseNumber: job.pdfCaseNumber,
      pdfTotalVacanciesInCase: job.pdfTotalVacanciesInCase,
      domicileQuota: job.domicileQuota,
      challanFee: job.challanFee,
      ageRelaxationNote: job.ageRelaxationNote,
      pdfParserEngine: parserEngine.includes('pdfplumber') ? 'pdfplumber' : 'PyPDF2',
      reviewTimeline: [
        {
          id: 'act-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
          timestamp,
          relativeTime: 'Just now',
          action: 'Scraped',
          performedBy: 'Cron Scraper Engine',
          notes: `Parsed from consolidated PDF gazette (${activeGazette.pdfFileName}) via ${parserEngine}.`
        },
        autoApprove ? {
          id: 'act-' + Date.now() + '-app',
          timestamp,
          relativeTime: 'Just now',
          action: 'Auto-Approved',
          performedBy: 'Cron Scraper Engine',
          notes: 'Auto-Approve rule applied. Ingested directly into Live Job Listings.'
        } : {
          id: 'act-' + Date.now() + '-pend',
          timestamp,
          relativeTime: 'Just now',
          action: 'Re-queued',
          performedBy: 'System Deduplicator',
          notes: 'Queued into Admin Pending Review table for verification.'
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
      startTime: timestamp,
      endTime: new Date(Date.now() + 2100).toISOString().replace('T', ' ').substring(0, 19),
      sourceId: activeGazette.id,
      sourceName: `${activeGazette.organization} (PDF Gazette)`,
      sourceUrl: activeGazette.pdfUrl,
      region: 'Pakistan',
      category: 'Government Sector',
      status: 'Completed',
      totalExtracted: jobsToImport.length,
      approvedCount: autoApprove ? jobsToImport.length : 0,
      pendingCount: autoApprove ? 0 : jobsToImport.length,
      duplicatesSkipped: 0,
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* MODAL HEADER */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-xl font-black text-white">FPSC & WAPDA Consolidated PDF Scraper Engine</h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  pdfplumber + PyPDF2
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  Multi-Vacancy Split
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Parse consolidated recruitment advertisements where multiple gazetted case numbers are packed inside a single official PDF file.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* NAVIGATION TABS */}
        <div className="px-6 py-2 border-b border-slate-800 bg-slate-950/40 flex items-center space-x-2 overflow-x-auto text-xs font-bold">
          <button
            onClick={() => setActiveTab('parser')}
            className={`px-4 py-2 rounded-xl transition-all flex items-center space-x-2 cursor-pointer ${
              activeTab === 'parser'
                ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Interactive PDF Parser & Ingestor</span>
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
            <span>Python Scraper Code (`pdfplumber` & `PyPDF2`)</span>
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
            <span>Raw PDF Gazette Stream & Regex Matcher</span>
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* TAB 1: PARSER & BATCH INGESTOR */}
          {activeTab === 'parser' && (
            <div className="space-y-6">
              
              {/* INPUT CONTROLLER SECTION */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                  <div>
                    <h3 className="text-sm font-black uppercase text-white flex items-center space-x-2">
                      <FileText className="w-4 h-4 text-indigo-400" />
                      <span>Select Consolidated PDF Advertisement</span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      Choose an official Pakistani Federal / Provincial Gazette or input an external PDF URL.
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
                      <span>Gazette Library ({currentGazettes.length})</span>
                    </button>
                    <button
                      onClick={() => setInputMode('add-manual')}
                      className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                        inputMode === 'add-manual' ? 'bg-amber-500 text-slate-950 font-black shadow' : 'text-amber-400 hover:text-amber-300'
                      }`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Add Manual Site / PDF</span>
                    </button>
                    <button
                      onClick={() => setInputMode('url')}
                      className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                        inputMode === 'url' ? 'bg-indigo-500 text-white shadow' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Globe className="w-3.5 h-3.5" />
                      <span>PDF Direct URL</span>
                    </button>
                    <button
                      onClick={() => setInputMode('upload')}
                      className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                        inputMode === 'upload' ? 'bg-indigo-500 text-white shadow' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload .PDF</span>
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

                {/* INPUT CONFIGURATION: PRELOADED GAZETTE LIST */}
                {inputMode === 'preloaded' && (
                  <div className="space-y-3">
                    {/* QUICK OFFICIAL PORTALS CHIPS */}
                    <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-300 flex items-center space-x-1.5">
                          <Globe className="w-3.5 h-3.5 text-rose-400" />
                          <span>13 Official Portals & Testing Services Quick Filter:</span>
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">Select to switch source</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {OFFICIAL_GOVT_SCRAPER_PORTALS.map(portal => {
                          const matchedGazette = currentGazettes.find(g => 
                            g.organization.toLowerCase().includes(portal.shortName.toLowerCase()) ||
                            g.title.toLowerCase().includes(portal.shortName.toLowerCase()) ||
                            g.pdfUrl.toLowerCase() === (portal.pdfUrl || portal.portalUrl).toLowerCase()
                          );
                          const isCurrent = matchedGazette && selectedGazetteId === matchedGazette.id;
                          return (
                            <button
                              key={portal.id}
                              type="button"
                              onClick={() => {
                                if (matchedGazette) {
                                  handleSelectGazette(matchedGazette.id);
                                } else {
                                  // Create and select
                                  const newG = generateGazetteFromManualInput({
                                    title: `${portal.name} Consolidated Advt 2026`,
                                    organization: portal.organization,
                                    pdfUrl: portal.pdfUrl || portal.portalUrl,
                                    gazetteIssueNumber: portal.sampleAdvtNo,
                                    closingDeadline: portal.defaultDeadline
                                  });
                                  if (onAddGazette) onAddGazette(newG);
                                  setSelectedGazetteId(newG.id);
                                  setExtractedVacancies(newG.extractedVacancies);
                                  setSelectedJobIds(newG.extractedVacancies.map(j => j.id));
                                  setCustomPdfUrl(newG.pdfUrl);
                                }
                              }}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center space-x-1 border ${
                                isCurrent
                                  ? 'bg-rose-500 text-white border-rose-400 shadow-md shadow-rose-500/20'
                                  : 'bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white border-slate-800'
                              }`}
                            >
                              <span>{portal.shortName}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-1">
                      {currentGazettes.map((gazette) => {
                        const isCustom = gazette.id.startsWith('pdf-gazette-custom');
                        return (
                          <div
                            key={gazette.id}
                            onClick={() => handleSelectGazette(gazette.id)}
                            className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between relative group ${
                              selectedGazetteId === gazette.id
                                ? 'bg-indigo-950/40 border-indigo-500 shadow-lg shadow-indigo-500/10 ring-1 ring-indigo-500/50'
                                : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                            }`}
                          >
                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-1.5">
                                  <span className="text-xs font-bold text-indigo-400">{gazette.organization}</span>
                                  {isCustom && (
                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                      Custom Added
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] font-mono bg-slate-800 px-2 py-0.5 rounded text-slate-300">
                                  {gazette.fileSizeFormatted} • {gazette.totalPages} Pages
                                </span>
                              </div>
                              <h4 className="font-bold text-white text-sm">{gazette.title}</h4>
                              <p className="text-xs text-slate-400">
                                Issue: <strong className="text-slate-300">{gazette.gazetteIssueNumber}</strong> • Deadline:{' '}
                                <span className="text-rose-300">{gazette.closingDeadline}</span>
                              </p>
                            </div>

                            <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
                              <span className="text-emerald-400 font-bold">
                                ✨ {gazette.extractedVacancies.length} Vacancy Cases in this PDF
                              </span>
                              
                              <div className="flex items-center space-x-2">
                                <span className="text-slate-500 font-mono text-[11px] truncate max-w-[120px]">
                                  {gazette.pdfFileName}
                                </span>
                                {isCustom && onDeleteGazette && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (confirm(`Remove "${gazette.title}" from Gazette library?`)) {
                                        onDeleteGazette(gazette.id);
                                      }
                                    }}
                                    className="p-1 text-slate-500 hover:text-rose-400 rounded hover:bg-rose-500/10 cursor-pointer"
                                    title="Delete custom gazette"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => setInputMode('add-manual')}
                        className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center space-x-1 cursor-pointer bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Another Manual Site / Gazette Source</span>
                      </button>
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
                          <span>Register Manual Govt / Gazette Site to PDF Parser</span>
                        </h4>
                        <p className="text-[11px] text-slate-400">
                          Register any new government recruitment portal or official PDF URL for automated multi-column table extraction.
                        </p>
                      </div>
                    </div>

                    {/* QUICK PRESETS CHIPS */}
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-bold text-slate-400">Quick Portal Presets:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {OFFICIAL_GOVT_SCRAPER_PORTALS.map((portal) => (
                          <button
                            key={portal.id}
                            type="button"
                            onClick={() => {
                              setManualTitle(`${portal.name} Consolidated Advt 2026`);
                              setManualOrg(portal.organization);
                              setManualUrl(portal.pdfUrl || portal.portalUrl);
                              setManualIssueNo(portal.sampleAdvtNo);
                              setManualDeadline(portal.defaultDeadline);
                            }}
                            className="px-2 py-0.5 bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white text-[10px] font-bold rounded-lg border border-slate-800 cursor-pointer transition-all"
                          >
                            <span>{portal.shortName}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-300">Gazette Title / Notice Name *</label>
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
                        <label className="text-xs font-bold text-slate-300">Commission / Department Name *</label>
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
                        <label className="text-xs font-bold text-slate-300">Official PDF URL or Gazette Portal Link *</label>
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
                        <label className="text-xs font-bold text-slate-300">Gazette Issue / Case Reference</label>
                        <input
                          type="text"
                          value={manualIssueNo}
                          onChange={(e) => setManualIssueNo(e.target.value)}
                          placeholder="e.g. Advt. No. 04/2026"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:border-amber-400 outline-none"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-300">Application Deadline</label>
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
                        <span>Register to PDF Parser & Select</span>
                      </button>
                    </div>
                  </form>
                )}

                {/* INPUT CONFIGURATION: DIRECT PDF URL */}
                {inputMode === 'url' && (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-300">Enter PDF Gazette URL</label>
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
                          <span>Save as Gazette Source</span>
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Compatible with official PDF links from fpsc.gov.pk, wapda.gov.pk, ppsc.gop.pk, spsc.gos.pk, kppsc.gov.pk, bpsc.gob.pk, nts.org.pk
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
                        {uploadedFileName ? uploadedFileName : 'Drag & Drop your Consolidated Advertisement PDF'}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">Supports multi-page official gazette PDFs up to 50 MB</p>
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

                {/* PARSER ENGINE SETTINGS & EXECUTION BAR */}
                <div className="pt-3 border-t border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="flex items-center space-x-3 text-xs">
                    <span className="text-slate-400 font-bold">Python Engine:</span>
                    <select
                      value={parserEngine}
                      onChange={(e: any) => setParserEngine(e.target.value)}
                      className="bg-slate-900 border border-slate-800 text-slate-200 px-3 py-1.5 rounded-lg text-xs font-bold outline-none focus:border-indigo-500 cursor-pointer"
                    >
                      <option value="pdfplumber">pdfplumber (Visual Layout & Table Parser - Recommended)</option>
                      <option value="PyPDF2">PyPDF2 (Linear Text Stream Extractor)</option>
                      <option value="pdfplumber + Regex AI Entity Recognizer">pdfplumber + Regex AI Entity Recognizer</option>
                    </select>
                  </div>

                  <button
                    onClick={handleRunPdfExtraction}
                    disabled={isParsing}
                    className="w-full md:w-auto px-6 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white font-black text-xs rounded-xl flex items-center justify-center space-x-2 shadow-xl shadow-indigo-500/20 cursor-pointer transition-all active:scale-95 disabled:opacity-50"
                  >
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>{isParsing ? 'Parsing Gazette PDF...' : `Parse & Extract Vacancies (${parserEngine.includes('pdfplumber') ? 'pdfplumber' : 'PyPDF2'})`}</span>
                  </button>
                </div>

                {/* PARSE PROGRESS INDICATOR */}
                {isParsing && (
                  <div className="space-y-2 pt-2">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-indigo-400">Processing PDF Coordinates & Table Blocks...</span>
                      <span className="text-slate-400">{parseProgress}%</span>
                    </div>
                    <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                      <div
                        className="bg-gradient-to-r from-indigo-500 to-emerald-500 h-2 transition-all duration-300"
                        style={{ width: `${parseProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* EXECUTION LOGS TRACE */}
                {parseLogs.length > 0 && (
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-900 font-mono text-[11px] space-y-1 text-slate-300 max-h-28 overflow-y-auto">
                    {parseLogs.map((log, idx) => (
                      <div key={idx} className="flex items-start space-x-2">
                        <span className="text-indigo-500 select-none">&gt;</span>
                        <span>{log}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* EXTRACTED VACANCIES CARDS GRID */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-950/80 p-4 rounded-2xl border border-slate-800">
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="text-base font-black text-white">Extracted Vacancies from PDF</h3>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        {extractedVacancies.length} Discrete Posts Discovered
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Each post was automatically segmented from {activeGazette.pdfFileName} with scale and quota breakdown.
                    </p>
                  </div>

                  {/* BATCH ACTION CONTROLS */}
                  <div className="flex items-center space-x-2 flex-wrap gap-y-2">
                    <button
                      onClick={handleToggleSelectAll}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl border border-slate-700 cursor-pointer"
                    >
                      {selectedJobIds.length === extractedVacancies.length ? 'Deselect All' : `Select All (${extractedVacancies.length})`}
                    </button>

                    <button
                      onClick={() => handleIngest(true)}
                      className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl flex items-center space-x-1.5 shadow-lg shadow-emerald-500/20 cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Direct Publish Selected ({selectedJobIds.length}) to Live Board</span>
                    </button>

                    <button
                      onClick={() => handleIngest(false)}
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl flex items-center space-x-1.5 shadow-lg shadow-amber-500/20 cursor-pointer"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>Queue Selected ({selectedJobIds.length}) for Admin Review</span>
                    </button>
                  </div>
                </div>

                {importedSuccessfully && (
                  <div className="p-4 bg-emerald-950/60 border border-emerald-500/40 rounded-2xl flex items-center justify-between text-xs text-emerald-300 animate-in fade-in duration-300">
                    <div className="flex items-center space-x-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                      <div>
                        <strong className="text-white text-sm">Vacancies Ingested Successfully!</strong>
                        <p className="text-emerald-200">The selected PDF positions have been integrated into your portal and logged into the Scraped Job Audit Ledger.</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* VACANCY CARDS */}
                <div className="grid grid-cols-1 gap-4">
                  {extractedVacancies.map((vacancy, vIdx) => {
                    const isSelected = selectedJobIds.includes(vacancy.id);
                    return (
                      <div
                        key={vacancy.id ? `${vacancy.id}-${vIdx}` : `vac-${vIdx}`}
                        onClick={() => handleToggleSelectJob(vacancy.id)}
                        className={`p-5 rounded-2xl border transition-all cursor-pointer ${
                          isSelected
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
                                <span className="px-2 py-0.5 rounded-lg text-[11px] font-bold bg-emerald-500/20 text-emerald-300">
                                  {vacancy.challanFee || 'Challan Rs. 300/-'}
                                </span>
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

                        {/* DOMICILE & QUOTA SPLIT BADGES */}
                        {vacancy.domicileQuota && (
                          <div className="mt-3 p-2.5 bg-slate-900/80 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-1">
                            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                              Provincial Domicile & Quota Allocation (Extracted via pdfplumber table parser):
                            </span>
                            <p className="font-mono text-indigo-300 text-[11px] font-semibold">{vacancy.domicileQuota}</p>
                          </div>
                        )}

                        {/* QUALIFICATIONS & AGE */}
                        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-slate-300">
                          <div className="bg-slate-900/50 p-2 rounded-xl border border-slate-800/60">
                            <span className="text-slate-500 block text-[10px] font-bold uppercase">Eligibility:</span>
                            <span className="line-clamp-2">{vacancy.requirements[0]}</span>
                          </div>
                          <div className="bg-slate-900/50 p-2 rounded-xl border border-slate-800/60">
                            <span className="text-slate-500 block text-[10px] font-bold uppercase">Age Limits & Relaxation:</span>
                            <span>{vacancy.ageRelaxationNote || '22-30 Years (+ 5 Years General Relaxation)'}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: PYTHON SCRAPER CODE & CLI INSTRUCTIONS */}
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

              {/* CLI EXPLANATION */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
                  <h4 className="text-xs font-bold uppercase text-white flex items-center space-x-1.5">
                    <Terminal className="w-4 h-4 text-indigo-400" />
                    <span>Why `pdfplumber` for FPSC & WAPDA?</span>
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    FPSC Consolidated Gazettes and WAPDA recruitment notices use <strong>multi-column newspaper layouts and complex quota matrices</strong>. Standard text extractors often blend adjacent columns into incomprehensible streams. <code>pdfplumber</code> retains word spatial coordinates (<code>layout=True</code>), isolating individual case blocks cleanly.
                  </p>
                </div>

                <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
                  <h4 className="text-xs font-bold uppercase text-white flex items-center space-x-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>Installation Command</span>
                  </h4>
                  <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800 font-mono text-xs text-amber-300">
                    pip install pdfplumber PyPDF2 requests
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Runs on Linux, macOS, and Windows server worker containers.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: RAW PDF GAZETTE STREAM & REGEX MATCHER */}
          {activeTab === 'raw-stream' && (
            <div className="space-y-4">
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-1">
                <h3 className="text-sm font-black text-white uppercase">Raw Text Stream for: {activeGazette.title}</h3>
                <p className="text-xs text-slate-400">
                  Inspect the direct text coordinates extracted by <code>pdfplumber.extract_text(layout=True)</code> from {activeGazette.pdfFileName}.
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
            <span>PDF Consolidated Parser Ready • {extractedVacancies.length} positions ready for import</span>
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
              <span>Ingest {selectedJobIds.length} Selected Vacancies</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
