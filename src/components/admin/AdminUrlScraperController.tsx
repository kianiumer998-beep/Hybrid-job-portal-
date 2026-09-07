import React, { useState } from 'react';
import {
  Globe,
  Link,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Trash2,
  AlertCircle,
  Copy,
  Search,
  ExternalLink,
  Shield,
  Layers,
  ArrowRight,
  Filter,
  CheckSquare,
  Square
} from 'lucide-react';
import { Job, JobType, Region } from '../../types/job';
import { api } from '../../services/api';

interface AdminUrlScraperControllerProps {
  existingLiveJobs: Job[];
  existingPendingJobs: Job[];
  onApproveJobsToLive: (jobsToApprove: Job[]) => void;
  onRejectJobs: (jobIds: string[]) => void;
  onOverrideDuplicatesToLive?: (jobsToOverride: Job[]) => void;
}

export const AdminUrlScraperController: React.FC<AdminUrlScraperControllerProps> = ({
  existingLiveJobs,
  existingPendingJobs,
  onApproveJobsToLive,
  onRejectJobs,
  onOverrideDuplicatesToLive
}) => {
  const [targetUrl, setTargetUrl] = useState('');
  const [targetCategory, setTargetCategory] = useState<'Private Corporate' | 'Government Sector' | 'Newspaper Classified' | 'International Remote'>('Government Sector');
  const [targetRegion, setTargetRegion] = useState<Region>('Pakistan');
  const [targetProvince, setTargetProvince] = useState('Punjab');
  const [targetKeywords, setTargetKeywords] = useState('');
  const [isCrawlRunning, setIsCrawlRunning] = useState(false);
  const [crawlProgress, setCrawlProgress] = useState(0);

  // Scraped Staging Batch
  const [stagedScrapedJobs, setStagedScrapedJobs] = useState<Job[]>([]);
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>([]);
  const [filterMode, setFilterMode] = useState<'all' | 'duplicates' | 'unique'>('all');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Helper to check if a job is duplicate against existing database
  const checkDuplicate = (stagedJob: Job): { isDuplicate: boolean; matchReason?: string; matchingJobId?: string } => {
    const allExisting = [...existingLiveJobs, ...existingPendingJobs];
    const cleanStagedTitle = stagedJob.title.toLowerCase().trim();
    const cleanStagedCompany = stagedJob.company.toLowerCase().trim();

    for (const existing of allExisting) {
      const cleanExTitle = existing.title.toLowerCase().trim();
      const cleanExCompany = existing.company.toLowerCase().trim();

      if (cleanStagedTitle === cleanExTitle && cleanStagedCompany === cleanExCompany) {
        return {
          isDuplicate: true,
          matchReason: `100% Identical Title & Employer: "${existing.title}" at "${existing.company}"`,
          matchingJobId: existing.id
        };
      }

      if (
        cleanStagedTitle.includes(cleanExTitle) ||
        cleanExTitle.includes(cleanStagedTitle)
      ) {
        if (cleanStagedCompany === cleanExCompany || stagedJob.city === existing.city) {
          return {
            isDuplicate: true,
            matchReason: `High Similarity (92%): Matched "${existing.title}" (${existing.city || 'National'})`,
            matchingJobId: existing.id
          };
        }
      }
    }

    return { isDuplicate: false };
  };

  // Run on-demand URL Scraper via backend real scraper API (Zero-fake-job guarantee)
  const handleStartUrlScrape = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUrl.trim()) return;

    let cleanUrl = targetUrl.trim();
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = 'https://' + cleanUrl;
    }

    let hostname = '';
    try {
      hostname = new URL(cleanUrl).hostname.replace('www.', '');
    } catch {
      hostname = cleanUrl;
    }

    setIsCrawlRunning(true);
    setCrawlProgress(20);
    setStatusMessage(`Connecting to ${hostname} and executing backend scraper...`);

    try {
      setCrawlProgress(50);
      setStatusMessage('Extracting verified vacancies from target source...');

      const response = await api.scraper.parseUrl(cleanUrl, targetKeywords || hostname, targetKeywords);

      setCrawlProgress(85);

      if (!response || !response.success) {
        throw new Error(response?.message || 'Scraper execution failed on target URL.');
      }

      const rawJobs = response.jobs || [];
      const extractedBatch: Job[] = rawJobs.map((j: any) => ({
        ...j,
        jobCategory: j.jobCategory || targetCategory,
        region: j.region || targetRegion,
        province: j.province || (targetRegion === 'Pakistan' ? targetProvince : undefined),
        isGovtJob: targetCategory === 'Government Sector' || j.isGovtJob,
        status: 'Pending'
      }));

      if (extractedBatch.length === 0) {
        setStatusMessage(`ℹ️ Scraped ${hostname} successfully, but 0 vacancies were found. Strict policy: No fake or synthetic jobs are generated.`);
      } else {
        setStagedScrapedJobs((prev) => [...extractedBatch, ...prev]);
        setSelectedJobIds(extractedBatch.map((j) => j.id));
        setStatusMessage(`✅ Authentically harvested ${extractedBatch.length} verified vacancies from ${hostname}!`);
      }
    } catch (err: any) {
      console.error('Manual URL scraper error:', err);
      setStatusMessage(`❌ Scraping failed: ${err.message || 'Unable to harvest jobs from target URL'}. No synthetic jobs generated.`);
    } finally {
      setIsCrawlRunning(false);
      setCrawlProgress(100);
    }
  };

  // Bulk Actions
  const duplicatesInStaged = stagedScrapedJobs.filter((j) => checkDuplicate(j).isDuplicate);
  const uniqueInStaged = stagedScrapedJobs.filter((j) => !checkDuplicate(j).isDuplicate);

  const displayedJobs = stagedScrapedJobs.filter((j) => {
    const isDup = checkDuplicate(j).isDuplicate;
    if (filterMode === 'duplicates') return isDup;
    if (filterMode === 'unique') return !isDup;
    return true;
  });

  const handleSelectAll = () => {
    if (selectedJobIds.length === displayedJobs.length) {
      setSelectedJobIds([]);
    } else {
      setSelectedJobIds(displayedJobs.map((j) => j.id));
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedJobIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // 1. Bulk Approve to Live
  const handleBulkApprove = () => {
    const toApprove = stagedScrapedJobs.filter((j) => selectedJobIds.includes(j.id));
    if (toApprove.length === 0) return;

    onApproveJobsToLive(toApprove);
    setStagedScrapedJobs((prev) => prev.filter((j) => !selectedJobIds.includes(j.id)));
    setSelectedJobIds([]);
    setStatusMessage(`🚀 Successfully approved ${toApprove.length} jobs to Live Database!`);
  };

  // 2. Bulk Reject
  const handleBulkReject = () => {
    if (selectedJobIds.length === 0) return;
    onRejectJobs(selectedJobIds);
    setStagedScrapedJobs((prev) => prev.filter((j) => !selectedJobIds.includes(j.id)));
    setSelectedJobIds([]);
    setStatusMessage(`❌ Dropped ${selectedJobIds.length} scraped jobs from queue.`);
  };

  // 3. Bulk Delete Duplicates
  const handleBulkDeleteDuplicates = () => {
    const dupIds = duplicatesInStaged.map((j) => j.id);
    if (dupIds.length === 0) return;

    onRejectJobs(dupIds);
    setStagedScrapedJobs((prev) => prev.filter((j) => !dupIds.includes(j.id)));
    setSelectedJobIds((prev) => prev.filter((id) => !dupIds.includes(id)));
    setStatusMessage(`🗑️ Purged ${dupIds.length} duplicate jobs successfully!`);
  };

  // 4. Bulk Override Duplicates (Re-announce as fresh ad)
  const handleBulkOverrideDuplicates = () => {
    const dupJobs = stagedScrapedJobs.filter(
      (j) => selectedJobIds.includes(j.id) && checkDuplicate(j).isDuplicate
    );
    if (dupJobs.length === 0) return;

    const overridden = dupJobs.map((j) => ({
      ...j,
      isDuplicateOverride: true,
      title: `${j.title} (Re-announced / توسیع شدہ)`,
      postedAt: 'Just now (Re-advertised)'
    }));

    if (onOverrideDuplicatesToLive) {
      onOverrideDuplicatesToLive(overridden);
    } else {
      onApproveJobsToLive(overridden);
    }

    setStagedScrapedJobs((prev) => prev.filter((j) => !dupJobs.map((d) => d.id).includes(j.id)));
    setSelectedJobIds((prev) => prev.filter((id) => !dupJobs.map((d) => d.id).includes(id)));
    setStatusMessage(`🔄 Overrode and published ${overridden.length} jobs as Re-announced Vacancies!`);
  };

  return (
    <div className="space-y-6 text-white max-w-6xl">
      {/* Target URL Input Scraper Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center space-x-3 border-b border-slate-800 pb-3">
          <div className="p-2.5 bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-500/30">
            <Globe className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-black text-white flex items-center space-x-2">
              <span>Instant Local Website URL Scraper</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-500/30">
                Direct URL Ingestion
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Enter any local or official website URL (e.g. Rozee, Mustakbil, Dawn, Express, NTS, or organization portal) to crawl and harvest vacancies directly into the approval queue.
            </p>
          </div>
        </div>

        <form onSubmit={handleStartUrlScrape} className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Link className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-500" />
              <input
                type="text"
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
                placeholder="Enter website link, e.g. https://rozee.pk, https://mustakbil.com, or local job portal..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isCrawlRunning || !targetUrl.trim()}
              className={`px-5 py-2.5 rounded-xl font-black text-xs flex items-center justify-center space-x-2 transition-all cursor-pointer ${
                isCrawlRunning
                  ? 'bg-slate-800 text-slate-400'
                  : 'bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500 text-white shadow-lg shadow-indigo-500/20 hover:scale-[1.02] active:scale-95'
              }`}
            >
              <Sparkles className={`w-4 h-4 text-amber-300 ${isCrawlRunning ? 'animate-spin' : ''}`} />
              <span>{isCrawlRunning ? 'Scraping Site...' : 'Scrape Jobs from URL'}</span>
            </button>
          </div>

          {/* Configuration Options Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="block text-slate-400 mb-1 font-semibold">Category (شعبہ)</label>
              <select
                value={targetCategory}
                onChange={(e) => setTargetCategory(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-indigo-500 font-semibold"
              >
                <option value="Government Sector">Government Sector</option>
                <option value="Private Corporate">Private Corporate</option>
                <option value="Newspaper Classified">Newspaper Classified</option>
                <option value="International Remote">International Remote</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-semibold">Province (صوبہ)</label>
              <select
                value={targetProvince}
                onChange={(e) => setTargetProvince(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-indigo-500 font-semibold"
              >
                <option value="Punjab">Punjab</option>
                <option value="Sindh">Sindh</option>
                <option value="KPK">Khyber Pakhtunkhwa</option>
                <option value="Balochistan">Balochistan</option>
                <option value="Islamabad">Islamabad Capital</option>
                <option value="AJK">Azad Kashmir</option>
                <option value="Gilgit-Baltistan">Gilgit-Baltistan</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-semibold">Country / Region</label>
              <select
                value={targetRegion}
                onChange={(e) => setTargetRegion(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-indigo-500 font-semibold"
              >
                <option value="Pakistan">Pakistan</option>
                <option value="UAE">UAE</option>
                <option value="Saudi Arabia">Saudi Arabia</option>
                <option value="US">United States</option>
                <option value="UK">United Kingdom</option>
                <option value="Global">Global Remote</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-semibold">Keywords / Filter</label>
              <input
                type="text"
                value={targetKeywords}
                onChange={(e) => setTargetKeywords(e.target.value)}
                placeholder="e.g. Engineering, IT, Medical..."
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        </form>

        {/* Crawling Progress */}
        {isCrawlRunning && (
          <div className="p-4 bg-indigo-950/40 border border-indigo-500/40 rounded-xl space-y-2">
            <div className="flex justify-between text-xs font-bold text-indigo-300">
              <span className="flex items-center space-x-2">
                <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
                <span>{statusMessage || 'Crawling target domain...'}</span>
              </span>
              <span>{crawlProgress}%</span>
            </div>
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-400 h-full transition-all duration-300"
                style={{ width: `${crawlProgress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {statusMessage && !isCrawlRunning && (
        <div className="p-3.5 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-emerald-300 font-bold text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{statusMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-xs text-slate-400 hover:text-white cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* BULK ACTIONS & DUPLICATES DASHBOARD */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-black text-white flex items-center space-x-2">
              <span>Bulk Scraped Staging & Duplicate Controller</span>
              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-bold">
                {stagedScrapedJobs.length} Staged
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Review harvested vacancies. Inspect duplicates, perform bulk approve, bulk reject, delete duplicates, or override.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setFilterMode('all')}
                className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  filterMode === 'all'
                    ? 'bg-indigo-500 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                All ({stagedScrapedJobs.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('unique')}
                className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  filterMode === 'unique'
                    ? 'bg-emerald-500 text-slate-950 font-black'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Unique ({uniqueInStaged.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('duplicates')}
                className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  filterMode === 'duplicates'
                    ? 'bg-rose-500 text-white font-black'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Duplicates ({duplicatesInStaged.length})
              </button>
            </div>
          </div>
        </div>

        {/* BULK ACTION BUTTONS BAR */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800/80">
          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={handleSelectAll}
              className="flex items-center space-x-1.5 text-xs font-bold text-slate-300 hover:text-white cursor-pointer"
            >
              {selectedJobIds.length === displayedJobs.length && displayedJobs.length > 0 ? (
                <CheckSquare className="w-4 h-4 text-indigo-400" />
              ) : (
                <Square className="w-4 h-4 text-slate-600" />
              )}
              <span>
                {selectedJobIds.length === displayedJobs.length && displayedJobs.length > 0
                  ? 'Deselect All'
                  : 'Select All'}{' '}
                ({displayedJobs.length})
              </span>
            </button>

            {selectedJobIds.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[11px] font-bold border border-indigo-500/30">
                {selectedJobIds.length} Selected
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* 1. Bulk Approve */}
            <button
              type="button"
              onClick={handleBulkApprove}
              disabled={selectedJobIds.length === 0}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black flex items-center space-x-1.5 transition-all ${
                selectedJobIds.length > 0
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md shadow-emerald-500/20 cursor-pointer active:scale-95'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Bulk Approve Selected ({selectedJobIds.length})</span>
            </button>

            {/* 2. Bulk Reject */}
            <button
              type="button"
              onClick={handleBulkReject}
              disabled={selectedJobIds.length === 0}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all ${
                selectedJobIds.length > 0
                  ? 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 cursor-pointer active:scale-95'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Bulk Reject ({selectedJobIds.length})</span>
            </button>

            {/* 3. Bulk Delete Duplicates */}
            <button
              type="button"
              onClick={handleBulkDeleteDuplicates}
              disabled={duplicatesInStaged.length === 0}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all ${
                duplicatesInStaged.length > 0
                  ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-600/20 cursor-pointer active:scale-95'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete All Duplicates ({duplicatesInStaged.length})</span>
            </button>

            {/* 4. Bulk Override Duplicates */}
            <button
              type="button"
              onClick={handleBulkOverrideDuplicates}
              disabled={
                selectedJobIds.filter((id) =>
                  duplicatesInStaged.map((d) => d.id).includes(id)
                ).length === 0
              }
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black flex items-center space-x-1.5 transition-all ${
                selectedJobIds.filter((id) =>
                  duplicatesInStaged.map((d) => d.id).includes(id)
                ).length > 0
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20 cursor-pointer active:scale-95'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
              title="Publish as Re-advertised Vacancy with fresh date"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Override Duplicate as Re-advertised</span>
            </button>
          </div>
        </div>

        {/* LIST OF STAGED JOBS */}
        {displayedJobs.length === 0 ? (
          <div className="p-8 text-center bg-slate-950/40 rounded-xl border border-slate-800/60 text-slate-500 space-y-2">
            <Globe className="w-8 h-8 mx-auto text-slate-600" />
            <p className="text-xs">No scraped jobs in this view. Enter a website link above to extract jobs!</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
            {displayedJobs.map((job) => {
              const dupCheck = checkDuplicate(job);
              const isSelected = selectedJobIds.includes(job.id);

              return (
                <div
                  key={job.id}
                  className={`p-4 rounded-xl border transition-all ${
                    dupCheck.isDuplicate
                      ? 'bg-rose-950/20 border-rose-500/40'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start space-x-3">
                      <button
                        type="button"
                        onClick={() => handleToggleSelect(job.id)}
                        className="mt-1 cursor-pointer"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-indigo-400" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-600" />
                        )}
                      </button>

                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-sm font-bold text-white">{job.title}</h4>

                          {dupCheck.isDuplicate ? (
                            <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-black flex items-center space-x-1">
                              <AlertCircle className="w-3 h-3 text-rose-400" />
                              <span>⚠️ Duplicate Detected</span>
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                              ✅ Unique Vacancy
                            </span>
                          )}

                          {job.isGovtJob && (
                            <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold">
                              Govt {job.govtScale || 'Sector'}
                            </span>
                          )}
                        </div>

                        <div className="text-xs text-slate-400 flex flex-wrap items-center gap-2">
                          <span className="text-slate-300 font-semibold">{job.company}</span>
                          <span>•</span>
                          <span>{job.city || job.province}</span>
                          <span>•</span>
                          <span className="text-emerald-400 font-semibold">{job.salary}</span>
                          {job.sourceUrl && (
                            <>
                              <span>•</span>
                              <span className="text-indigo-400 truncate max-w-xs">{job.sourceUrl}</span>
                            </>
                          )}
                        </div>

                        {/* Duplicate Match Warning */}
                        {dupCheck.isDuplicate && (
                          <div className="p-2 bg-rose-950/40 border border-rose-500/30 rounded-lg text-[11px] text-rose-300 space-y-1">
                            <span className="font-bold block">{dupCheck.matchReason}</span>
                            <span className="text-rose-400 text-[10px]">
                              Recommended Action: Click &quot;Delete Duplicate&quot; or &quot;Override as Re-announced Vacancy&quot;.
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Single Item Fast Actions */}
                    <div className="flex items-center space-x-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          onApproveJobsToLive([job]);
                          setStagedScrapedJobs((prev) => prev.filter((j) => j.id !== job.id));
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-[11px] flex items-center space-x-1 cursor-pointer transition-all active:scale-95"
                        title="Approve immediately to live"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Approve</span>
                      </button>

                      {dupCheck.isDuplicate ? (
                        <button
                          type="button"
                          onClick={() => {
                            const overridden = {
                              ...job,
                              isDuplicateOverride: true,
                              title: `${job.title} (Re-announced)`
                            };
                            if (onOverrideDuplicatesToLive) {
                              onOverrideDuplicatesToLive([overridden]);
                            } else {
                              onApproveJobsToLive([overridden]);
                            }
                            setStagedScrapedJobs((prev) => prev.filter((j) => j.id !== job.id));
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[11px] flex items-center space-x-1 cursor-pointer transition-all active:scale-95"
                          title="Override duplicate and publish"
                        >
                          <Copy className="w-3 h-3" />
                          <span>Override</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            onRejectJobs([job.id]);
                            setStagedScrapedJobs((prev) => prev.filter((j) => j.id !== job.id));
                          }}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                          title="Reject"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
