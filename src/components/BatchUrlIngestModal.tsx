import React, { useState, useMemo } from 'react';
import { 
  X, 
  Link as LinkIcon, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  Sparkles, 
  Trash2, 
  FileText, 
  Globe, 
  Layers, 
  Cpu, 
  ArrowRight,
  ExternalLink,
  Filter,
  Check,
  RefreshCw
} from 'lucide-react';
import { OfficialGovtPdfPortal } from '../data/mockPdfConsolidatedAds';
import { ConsolidatedPdfGazette, Job } from '../types/job';
import { analyzeBatchUrls, BatchAnalysisSummary, AnalyzedUrlResult } from '../utils/urlDeduplicator';
import { generateScrapedJobsForPortal } from '../data/mockPdfConsolidatedAds';

interface BatchUrlIngestModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingPortals: OfficialGovtPdfPortal[];
  existingGazettes: ConsolidatedPdfGazette[];
  onAddPortals: (newPortals: OfficialGovtPdfPortal[], scrapeImmediately: boolean) => void;
  onAddJobs: (newJobs: Job[]) => void;
}

export const BatchUrlIngestModal: React.FC<BatchUrlIngestModalProps> = ({
  isOpen,
  onClose,
  existingPortals,
  existingGazettes,
  onAddPortals,
  onAddJobs
}) => {
  const [rawTextInput, setRawTextInput] = useState<string>('');
  const [filterView, setFilterView] = useState<'all' | 'unique' | 'duplicates'>('all');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingProgress, setProcessingProgress] = useState<number>(0);

  // Analyze pasted text in real time with duplicate detection
  const analysis: BatchAnalysisSummary = useMemo(() => {
    return analyzeBatchUrls(rawTextInput, existingPortals, existingGazettes);
  }, [rawTextInput, existingPortals, existingGazettes]);

  if (!isOpen) return null;

  const handleLoadSample = () => {
    const sample = `https://fpsc.gov.pk/advertisement/advt-09-2026.pdf
https://ppsc.gop.pk/jobs/advt-31-2026.pdf
https://www.joinpakarmy.gov.pk/careers/pma-156
https://www.joinpakarmy.gov.pk/careers/pma-156/
https://wapda.gov.pk/careers/rect-2026
https://sindhpolice.gov.pk/jobs/constable-2026.pdf
https://kppsc.gov.pk/jobs/gazette-2026.pdf
https://hec.gov.pk/careers/faculty-2026
https://fpsc.gov.pk/advertisement/advt-09-2026.pdf
https://punjabpolice.gov.pk/jobs/constable-recruitment-2026
https://punjabpolice.gov.pk/jobs/constable-recruitment-2026?utm_source=facebook
https://spsc.gos.pk/advt-05-2026.pdf
https://nts.org.pk/project-details/3409
https://custom-department.gop.pk/careers/advt-2026.pdf
https://unicef.org/pakistan/careers/vacancies-2026`;
    setRawTextInput(sample);
  };

  const handleClear = () => {
    setRawTextInput('');
  };

  const handleExecuteIngestion = (scrapeImmediately: boolean) => {
    const uniqueResults = analysis.results.filter(r => r.status === 'unique');
    if (uniqueResults.length === 0) {
      alert('کوئی یونیک لنک نہیں ملا! تمام لنکس یا تو ڈپلیکیٹ ہیں یا غلط فارمیٹ میں ہیں۔');
      return;
    }

    setIsProcessing(true);
    setProcessingProgress(15);

    const timer = setInterval(() => {
      setProcessingProgress(prev => {
        if (prev >= 85) {
          clearInterval(timer);
          return 85;
        }
        return prev + 20;
      });
    }, 300);

    setTimeout(() => {
      clearInterval(timer);
      setProcessingProgress(100);
      setIsProcessing(false);

      // Convert unique analyzed items into official portals
      const newPortals: OfficialGovtPdfPortal[] = uniqueResults.map((item, idx) => {
        const id = `custom-portal-${Date.now()}-${idx}`;
        const isPdf = item.detectedFormat === 'PDF Advertisement (pdfplumber)';
        return {
          id,
          name: item.detectedName,
          shortName: item.detectedName.substring(0, 15),
          portalUrl: item.rawUrl,
          pdfUrl: isPdf ? item.rawUrl : undefined,
          organization: item.detectedOrg,
          category: (item.detectedSector === 'International & UN Agencies' 
            ? 'International & UN Agencies' 
            : item.detectedSector === 'Law Enforcement & Security'
            ? 'Law Enforcement & Security'
            : item.detectedSector === 'Higher Education & Training'
            ? 'Higher Education & Universities'
            : item.detectedSector === 'Provincial & Local / Municipal'
            ? 'Provincial Govt & Development'
            : 'Autonomous / Public Sector') as any,
          formatType: item.detectedFormat as any,
          formatBadge: item.detectedFormat.includes('PDF') ? 'PDF' : item.detectedFormat.includes('HTML') ? 'HTML Table' : item.detectedFormat.includes('ASPX') ? 'ASPX Form' : 'REST Stream',
          sector: item.detectedSector as any,
          jurisdiction: item.detectedJurisdiction as any,
          crawlerMethod: item.detectedCrawlerMethod,
          badge: item.detectedJurisdiction,
          description: `Custom ingested source for ${item.detectedOrg}. Configured with ${item.detectedCrawlerMethod}.`,
          typicalScales: 'BPS-07 to BPS-19',
          defaultDeadline: '25 Days from Posting',
          sampleAdvtNo: `Notice-${new Date().getFullYear()}/${idx + 1}`
        };
      });

      // If scrape immediately, extract jobs
      let extractedJobs: Job[] = [];
      if (scrapeImmediately) {
        newPortals.forEach(portal => {
          const jobs = generateScrapedJobsForPortal(portal);
          extractedJobs = [...extractedJobs, ...jobs];
        });
        onAddJobs(extractedJobs);
      }

      onAddPortals(newPortals, scrapeImmediately);

      alert(`✅ کامیابی سے ${newPortals.length} نئے یونیک پورٹلز ایڈ ہو گئے!\n` +
            `❌ ${analysis.duplicateCount} ڈپلیکیٹ لنکس کو خودکار طریقے سے چھوڑ دیا گیا (Skipped).\n` +
            (scrapeImmediately ? `✨ ${extractedJobs.length} جابز اسکریپ کر کے پینڈنگ ریویو میں شامل کر دی گئی ہیں۔` : ''));
      onClose();
    }, 1800);
  };

  const filteredList = analysis.results.filter(item => {
    if (filterView === 'unique') return item.status === 'unique';
    if (filterView === 'duplicates') return item.status === 'duplicate';
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* MODAL HEADER */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <LinkIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-black text-white">Smart Batch URL Ingestion & Duplicate Deduplicator</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Zero Duplication Engine
                </span>
              </div>
              <p className="text-xs text-slate-400">
                یہاں ایک ساتھ تمام جاب لنکس پیسٹ کریں۔ سسٹم خودکار طور پر ڈپلیکیٹ لنکس کو چھوڑ دے گا اور صرف یونیک لنکس کو اسکریپ کرے گا۔
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-800 rounded-xl transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          
          {/* TEXTAREA INPUT */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black uppercase text-slate-300 flex items-center space-x-1.5">
                <span>Paste Links (URLs, Advertisements, Websites, or Raw Text)</span>
                <span className="text-rose-400">*</span>
              </label>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleLoadSample}
                  className="px-2.5 py-1 text-[11px] font-bold bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-lg transition-all"
                >
                  Load Sample List (With Duplicates)
                </button>
                {rawTextInput && (
                  <button
                    type="button"
                    onClick={handleClear}
                    className="px-2.5 py-1 text-[11px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-all flex items-center space-x-1"
                  >
                    <Trash2 className="w-3 h-3 text-rose-400" />
                    <span>Clear</span>
                  </button>
                )}
              </div>
            </div>

            <div className="relative">
              <textarea
                value={rawTextInput}
                onChange={(e) => setRawTextInput(e.target.value)}
                placeholder="Paste any government links here, e.g.&#10;https://fpsc.gov.pk/advertisement/advt-09-2026.pdf&#10;https://ppsc.gop.pk/jobs/advt-31-2026.pdf&#10;https://joinpakarmy.gov.pk/careers/pma-156&#10;https://wapda.gov.pk/careers/rect-2026"
                rows={6}
                className="w-full p-3.5 bg-slate-950 border border-slate-800 focus:border-rose-500 rounded-2xl text-xs text-white font-mono placeholder-slate-600 outline-none leading-relaxed resize-y"
              />
            </div>
            <p className="text-[11px] text-slate-500">
              💡 آپ لنکس کو ایک لائن میں یا پیراگراف میں بھی پیسٹ کر سکتے ہیں۔ سسٹم خود بخود لنکس تلاش کر کے نارملائز کرے گا۔
            </p>
          </div>

          {/* DEDUPLICATION ANALYSIS SUMMARY CARDS */}
          {analysis.totalUrlsExtracted > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-2xl">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Detected URLs</span>
                <span className="text-xl font-black text-white font-mono">{analysis.totalUrlsExtracted}</span>
              </div>

              <div className="p-3.5 bg-emerald-950/40 border border-emerald-500/40 rounded-2xl">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-emerald-300 block">Unique New Links</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                </div>
                <span className="text-xl font-black text-emerald-400 font-mono">{analysis.uniqueCount}</span>
                <span className="text-[10px] text-emerald-400/80 block mt-0.5">Ready for Ingestion</span>
              </div>

              <div className="p-3.5 bg-amber-950/40 border border-amber-500/40 rounded-2xl">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-amber-300 block">Duplicate Skipped</span>
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                </div>
                <span className="text-xl font-black text-amber-400 font-mono">{analysis.duplicateCount}</span>
                <span className="text-[10px] text-amber-400/80 block mt-0.5">Auto-Filtered</span>
              </div>

              <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-2xl">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Required Scraper Setup</span>
                <span className="text-xs font-bold text-indigo-300 block mt-1">Auto-Configured</span>
                <span className="text-[10px] text-slate-400 block">Bypass SSL & Headers</span>
              </div>
            </div>
          )}

          {/* DETAILED RESULTS TABLE / BREAKDOWN */}
          {analysis.totalUrlsExtracted > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black uppercase text-slate-300 flex items-center space-x-1.5">
                  <Layers className="w-4 h-4 text-rose-400" />
                  <span>Ingestion Analysis Breakdown ({filteredList.length})</span>
                </h4>

                {/* FILTER PILLS */}
                <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setFilterView('all')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all ${filterView === 'all' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`}
                  >
                    All ({analysis.results.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterView('unique')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all ${filterView === 'unique' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'text-slate-400 hover:text-white'}`}
                  >
                    Unique ({analysis.uniqueCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterView('duplicates')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all ${filterView === 'duplicates' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'text-slate-400 hover:text-white'}`}
                  >
                    Duplicates ({analysis.duplicateCount})
                  </button>
                </div>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden max-h-72 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/90 text-slate-400 text-[10px] font-black uppercase border-b border-slate-800 sticky top-0">
                    <tr>
                      <th className="p-3">Status</th>
                      <th className="p-3">Detected Portal / Department</th>
                      <th className="p-3">Target URL</th>
                      <th className="p-3">Scraper Engine</th>
                      <th className="p-3">Deduplication Reason / Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {filteredList.map((item, idx) => {
                      const isUnique = item.status === 'unique';
                      return (
                        <tr key={idx} className={isUnique ? 'bg-emerald-950/10 hover:bg-emerald-950/20' : 'bg-amber-950/10 hover:bg-amber-950/20'}>
                          <td className="p-3 whitespace-nowrap">
                            {isUnique ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center space-x-1 w-max">
                                <Check className="w-3 h-3" />
                                <span>Unique Link</span>
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center space-x-1 w-max">
                                <AlertTriangle className="w-3 h-3" />
                                <span>Duplicate Skipped</span>
                              </span>
                            )}
                          </td>
                          <td className="p-3">
                            <div className="font-bold text-white leading-snug">{item.detectedName}</div>
                            <div className="text-[10px] text-slate-400 font-mono">📍 {item.detectedJurisdiction} • {item.detectedOrg}</div>
                          </td>
                          <td className="p-3 font-mono text-[11px] text-indigo-400 max-w-[200px] truncate">
                            <a href={item.rawUrl} target="_blank" rel="noreferrer" className="hover:underline flex items-center space-x-1">
                              <span className="truncate">{item.rawUrl}</span>
                              <ExternalLink className="w-2.5 h-2.5 flex-shrink-0 text-slate-500" />
                            </a>
                          </td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-900 border border-slate-800 text-slate-300 block w-max">
                              {item.detectedFormat}
                            </span>
                            <span className="text-[10px] text-slate-500 block mt-0.5">{item.detectedCrawlerMethod}</span>
                          </td>
                          <td className="p-3 text-[11px]">
                            {isUnique ? (
                              <span className="text-emerald-400 font-medium">Ready to scrape vacancies with custom headers</span>
                            ) : (
                              <span className="text-amber-400/90 font-medium">{item.duplicateReason}</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SCRAPER REQUIREMENTS & SPECS */}
          <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-2">
            <h5 className="text-xs font-bold text-white flex items-center space-x-1.5">
              <Cpu className="w-3.5 h-3.5 text-rose-400" />
              <span>Scraper Engine Requirements & Environment Settings (خودکار ترتیب شدہ)</span>
            </h5>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-slate-300">
              <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800">
                <span className="text-slate-500 block text-[10px]">User-Agent & Headers:</span>
                <span className="font-mono text-xs text-white">Mozilla/5.0 (Windows NT 10.0; Win64)</span>
              </div>
              <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800">
                <span className="text-slate-500 block text-[10px]">SSL Certificate Bypass:</span>
                <span className="font-mono text-xs text-emerald-400">Enabled (verify=False for .gov.pk)</span>
              </div>
              <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800">
                <span className="text-slate-500 block text-[10px]">Extraction Pipeline:</span>
                <span className="font-mono text-xs text-indigo-300">pdfplumber + BS4 + REST</span>
              </div>
            </div>
          </div>

        </div>

        {/* MODAL FOOTER */}
        <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-400">
            {analysis.uniqueCount > 0 ? (
              <span>
                Ready to ingest <strong className="text-emerald-400">{analysis.uniqueCount} Unique Link(s)</strong> • Automatically skipping <strong className="text-amber-400">{analysis.duplicateCount} Duplicate(s)</strong>
              </span>
            ) : (
              <span>Paste links above to begin duplicate analysis</span>
            )}
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-all"
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={isProcessing || analysis.uniqueCount === 0}
              onClick={() => handleExecuteIngestion(false)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-bold rounded-xl border border-slate-700 transition-all disabled:opacity-40"
            >
              Save Unique to Registry
            </button>

            <button
              type="button"
              disabled={isProcessing || analysis.uniqueCount === 0}
              onClick={() => handleExecuteIngestion(true)}
              className="px-5 py-2 bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-400 hover:to-amber-400 text-white text-xs font-black rounded-xl shadow-lg shadow-rose-500/20 transition-all flex items-center space-x-1.5 disabled:opacity-40"
            >
              <Sparkles className="w-4 h-4 text-amber-200" />
              <span>{isProcessing ? `Ingesting (${processingProgress}%)...` : `⚡ Ingest & Scrape ${analysis.uniqueCount} Unique Links Now`}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
